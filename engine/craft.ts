/**
 * The craft bench — the three tiers `crafting.md` prices in `engine.json` `craft`.
 *
 * Reroll moves a value inside its own Tier and never down. Refine moves one slot up a Tier.
 * Ascend raises the whole piece one Item quality step and carries every line with it.
 * Element, Mod identity and Mod count are never touched by Reroll or Refine — those are the
 * blocking rules. Upgrade, Repair and Corrupt now run too (`crafting.md`'s published ladder and its
 * Vaal table, both copied into `engine.json` `craft`). The one figure that pass still owes is the
 * Gear Mod value per +1, which `crafting.md` sends to the mob-sheet rebalance pass, so
 * `craft.gear_mod_per_level` is 0 and the uplift is switched off rather than guessed.
 */

import type * as lootMod from './loot.ts';
import type { EngineData, Rng } from './types.ts';

export const QUALITY_STEPS = ['low', 'mid', 'high'];

/**
 * What each purse key is called in the player's words — the names `crafting.md`'s cost table prints.
 * One home, so the purse, the bench and any future panel say the same thing instead of a JSON dump.
 */
export const STONE_NAME = {
  reroll_value: 'Reroll value stone', tier: 'Reroll tier stone', add: 'Add mod stone',
  remove: 'Remove mod stone', quality: 'Quality Stone', repair: 'Repair stone', corrupt: 'Corrupt stone',
};

export function createCraft(E: EngineData, loot: ReturnType<typeof lootMod.createLoot>) {
  const C = E.craft;

  const costOf = (op: string, item: any): Record<string, number> => ({
    reroll: { reroll_value: C.reroll_value_stones_per_use },
    refine: { tier: C.refine_stones_per_use },
    randomize: { tier: 1 },
    ascend: { add: C.ascend_add_stones, tier: C.ascend_tier_stones },
    remove: { remove: C.remove_stones_per_use },
    add: { add: E.item_level.add_stones_per_fill[Math.min((item?.mods_added || 0), 1)] },
    // Quality Stones per step are `crafting.md`'s ladder: 1/2/3/4/5, 7/9/11/13/15, 18/21/24/27/30
    upgrade: { quality: C.upgrade_costs[Math.min(item?.upgrade_lv || 0, C.upgrade_cap - 1)] },
    repair: { repair: C.repair_stones },
    corrupt: { corrupt: 1 },
  } as Record<string, Record<string, number>>)[op];

  /**
   * The gates every stone respects. A corrupted piece accepts no further stones of any kind
   * (`crafting.md`), a Broken one can only be revived, and Revise-and-climb crafts need the line
   * count the piece still has.
   */
  function guard(item: any, op: string): any {
    if (!item) return { ok: false, why: 'no such slot' };
    if (op === 'repair') {
      if (!item.broken) return { ok: false, why: 'this piece is not Broken' };
      return { ok: true };
    }
    if (item.corrupted) return { ok: false, why: 'a corrupted piece accepts no further stones' };
    if (item.broken) return { ok: false, why: 'Broken — Repair it first' };
    if (op === 'upgrade' && (item.upgrade_lv || 0) >= C.upgrade_cap) {
      return { ok: false, why: `already at its +${C.upgrade_cap}` };
    }
    return { ok: true };
  }

  /**
   * Success chance for the step being attempted: +1..+4 safe, +5..+10 from 90% down to 60%,
   * +11..+15 from 50% down to 20% (`crafting.md`). Only the endpoints are data; the run between
   * them is the straight line the words "down to" describe.
   */
  function successPct(step: number) {
    const S = C.upgrade_success_endpoints;
    if (step <= S.safe_to) return 100;
    const [from, to] = step <= 10 ? S.mid : S.high;
    const first = step <= 10 ? S.safe_to + 1 : 11;
    const last = step <= 10 ? 10 : C.upgrade_cap;
    if (last === first) return from;
    return from + ((to - from) * (step - first)) / (last - first);
  }

  // The skeleton's unremovable head (item-base.md): line 1 is the Base Mod and lines 2-3 the
  // Sub pair, so the floor every line-editing verb refuses to cross is base_mod_slots + sub_slots.
  const BASE_MOD_SLOTS = E.item_level.base_mod_slots || 1;
  const SUB_SLOTS = E.item_level.sub_slots || 2;
  const UNTOUCHABLE = BASE_MOD_SLOTS + SUB_SLOTS;

  /** A line the bench may edit. The Base Mod and the Sub pair are refused by every verb. */
  function editable(item: any, index: number) {
    if (index < UNTOUCHABLE) return { ok: false, why: 'the Base Mod and Sub lines cannot be changed' };
    const line = item.lines[index];
    if (!line) return { ok: false, why: 'no such slot' };
    return { ok: true, line };
  }

  function payable(stones: Record<string, number>, op: string, item: any) {
    const cost = costOf(op, item);
    return Object.entries(cost).every(([stone, n]) => (stones[stone] || 0) >= n);
  }

  function spend(stones: Record<string, number>, op: string, item: any) {
    const cost = costOf(op, item);
    for (const [stone, n] of Object.entries(cost)) stones[stone] = (stones[stone] || 0) - n;
    return stones;
  }

  const lineSlice = (line: any, fallback: number) => (line.slice == null ? fallback : line.slice);

  /**
   * Reroll one line inside its own Tier. The floor is the highest value that slot has *ever*
   * held (save.md "Reroll baseline"), not just the value it holds now, so a later Refine cannot
   * turn Reroll into a free downgrade.
   */
  function reroll(item: any, index: number, rng: Rng): any {
    const g = guard(item, 'reroll');
    if (!g.ok) return g;
    const e = editable(item, index);
    if (!e.ok) return e;
    const line = e.line;
    const [lo, hi] = loot.rangeOf(line.id, item.ilvl, item.q, lineSlice(line, 2));
    const baseline = (item.baselines && item.baselines[index]) != null ? item.baselines[index] : line.value;
    const floor = Math.max(lo, baseline, line.value);
    const value = floor + Math.floor(rng() * (hi - floor + 1));
    const baselines = { ...(item.baselines || {}), [index]: Math.max(baseline, value) };
    const next = { ...item, baselines, lines: item.lines.map((l: any, i: number) => (i === index ? { ...l, value } : l)) };
    return { ok: true, item: next, changed: { index, from: line.value, to: value, lo, hi, floor } };
  }

  /** Refine: push one slot up exactly one Tier (T3 → T2 → T1), never past T1. */
  function refine(item: any, index: number, rng: Rng): any {
    const g = guard(item, 'refine');
    if (!g.ok) return g;
    const e = editable(item, index);
    if (!e.ok) return e;
    const line = e.line;
    const slice = lineSlice(line, 2);
    if (slice <= 0) return { ok: false, why: 'that slot is already T1' };
    const to = slice - 1;
    const [lo, hi] = loot.rangeOf(line.id, item.ilvl, item.q, to);
    const value = lo + Math.floor(rng() * (hi - lo + 1));
    const next = { ...item, lines: item.lines.map((l: any, i: number) => (i === index ? { ...l, slice: to, value } : l)) };
    return { ok: true, item: next, changed: { index, from: slice, to, lo, hi } };
  }

  /** Randomize (the 1-stone roll): a fresh Tier slice on one slot with the published weights. */
  function randomize(item: any, index: number, rng: Rng): any {
    const g = guard(item, 'randomize');
    if (!g.ok) return g;
    const e = editable(item, index);
    if (!e.ok) return e;
    const line = e.line;
    const slices = loot.sliceCount();
    const slice = loot.tierSlice(rng());
    const [lo, hi] = loot.rangeOf(line.id, item.ilvl, item.q, slice);
    const value = lo + Math.floor(rng() * (hi - lo + 1));
    const next = { ...item, lines: item.lines.map((l: any, i: number) => (i === index ? { ...l, slice, value } : l)) };
    return { ok: true, item: next, changed: { index, from: lineSlice(line, 2), to: slice, lo, hi } };
  }

  /**
   * Ascend: the whole piece one band up, with its level shifted by one span so the window moves with it
   * (item-level.md). Every line re-rolls inside the same third of the new, higher window.
   */
  function ascend(item: any, rng: Rng): any {
    const g = guard(item, 'ascend');
    if (!g.ok) return g;
    if (item.q >= QUALITY_STEPS.length - 1) return { ok: false, why: 'already the top band' };
    const q = item.q + 1;
    const ilvl = (item.ilvl || 0) + E.item_level.ascend_levels;
    const lines = item.lines.map((l: any) => {
      const [lo, hi] = loot.rangeOf(l.id, ilvl, q, lineSlice(l, 2));
      return { ...l, value: lo + Math.floor(rng() * (hi - lo + 1)) };
    });
    return { ok: true, item: { ...item, ilvl, q, quality: QUALITY_STEPS[q], lines }, changed: { q, ilvl } };
  }

  /** Remove: delete one random non-sub line. Identity changes only via Remove + Add. */
  function remove(item: any, rng: Rng): any {
    const g = guard(item, 'remove');
    if (!g.ok) return g;
    if (item.lines.length <= UNTOUCHABLE) return { ok: false, why: 'only the Base and Sub lines are left on this piece' };
    const candidates = item.lines.map((l: any, i: number) => i).slice(UNTOUCHABLE);
    const pick = candidates[Math.floor(rng() * candidates.length)];
    return { ok: true, item: { ...item, lines: item.lines.filter((_: any, i: number) => i !== pick) }, changed: { index: pick } };
  }

  /**
   * Add mod stone: fill the next empty line from the Base pool. The stone draws, it does not ask —
   * the player never picks the line (crafting.md rule 6), and the same line never appears twice.
   * The Stat Mod slot holds one line, so a piece that already carries one blocks every sibling
   * (`stat_mod_flat` and `all_stat_flat` cannot sit on the same piece — equipment-slot-pools.md).
   */
  function add(item: any, pool: string[], rng: Rng, opts: { ignoreAddCap?: boolean } = {}): any {
    const g = guard(item, 'add');
    if (!g.ok) return g;
    const L = E.item_level;
    const added = item.mods_added || 0;
    // `Corrupt`'s +1 Mod is not an Add stone, so it stops at the crafted ceiling instead
    if (added >= L.mods_added_cap && !opts.ignoreAddCap) {
      return { ok: false, why: `this piece has taken its ${L.mods_added_cap} Add stones` };
    }
    if (item.lines.length >= L.crafted_max) return { ok: false, why: `a piece stops at ${L.crafted_max} Mods` };
    const taken = new Set<string>(item.lines.flatMap((l: any) => [l.id, ...((l.extra || []).map((x: any) => x.id))]));
    const blocked = loot.blockedBy(taken);
    const free = pool.filter((id) => !taken.has(id) && !blocked.has(id));
    if (!free.length) return { ok: false, why: 'this Base has no line left that the piece may carry' };
    const id = loot.weightedPick(rng, free.map((m) => ({ id: m, w: loot.weightOf(m, item.q) })));
    const slice = loot.tierSlice(rng());
    const [lo, hi] = loot.rangeOf(id, item.ilvl, item.q, slice);
    // a Stat Mod stone bakes the Core stat too, the same way a drop does: the piece's own
    // line carries which stat it feeds, so an added Stat Mod is as specific as a rolled one
    const stat = loot.statOf(id, rng);
    const line = { id, value: lo + Math.floor(rng() * (hi - lo + 1)), slice, ...(stat ? { stat } : {}) };
    return {
      ok: true,
      item: { ...item, lines: [...item.lines, line], mods_added: added + 1 },
      changed: { id, value: line.value, slice, cost: L.add_stones_per_fill[added] },
    };
  }

  /**
   * Upgrade (+1..+15, online only): the attempt rolls against the published curve, a fail below
   * +11 drops one level, a fail at +11 and above breaks the piece — unless protection absorbs it,
   * spending one charge and dropping one level instead (`crafting.md`).
   */
  function upgrade(item: any, rng: Rng): any {
    const g = guard(item, 'upgrade');
    if (!g.ok) return g;
    const from = item.upgrade_lv || 0;
    const step = from + 1;
    const chance = successPct(step);
    if (rng() * 100 < chance) {
      return {
        ok: true,
        item: { ...item, upgrade_lv: step, gearMod: (item.gearMod || 0) + stepOf(item, 1) },
        changed: { outcome: 'up', level: step, chance },
      };
    }
    if (step < C.upgrade_breaks_from) {
      return {
        ok: true,
        item: { ...item, upgrade_lv: Math.max(0, from - 1) },
        changed: { outcome: 'dropped', level: Math.max(0, from - 1), chance },
      };
    }
    const left = item.protection_left == null ? C.protection_start : item.protection_left;
    if (left > 0) {
      return {
        ok: true,
        item: { ...item, protection_left: left - 1, upgrade_lv: Math.max(0, from - 1) },
        changed: { outcome: 'protected', level: Math.max(0, from - 1), protection_left: left - 1, chance },
      };
    }
    return {
      ok: true,
      item: { ...item, broken: true, broken_at: from, upgrade_lv: Math.max(0, from - 1) },
      changed: { outcome: 'broken', level: Math.max(0, from - 1), chance },
    };
  }

  /**
   * Repair: one Repair stone revives the piece at the level it broke at and refills protection
   * (`crafting.md` / `engine.json` `craft.repair_stones`). Nothing else about the piece changes.
   */
  function repair(item: any): any {
    const g = guard(item, 'repair');
    if (!g.ok) return g;
    return {
      ok: true,
      item: { ...item, broken: false, protection_left: C.protection_start },
      changed: { outcome: 'repaired', level: item.upgrade_lv || 0, protection_left: C.protection_start },
    };
  }

  /** One gamble per piece, on `crafting.md`'s table, and the piece is then closed to stones. */
  function corrupt(item: any, pool: string[], rng: Rng): any {
    const g = guard(item, 'corrupt');
    if (!g.ok) return g;
    const total = C.corrupt_outcomes.reduce((a, o) => a + o.weight, 0);
    let roll = rng() * total;
    let outcome = C.corrupt_outcomes[C.corrupt_outcomes.length - 1];
    for (const o of C.corrupt_outcomes) { roll -= o.weight; if (roll <= 0) { outcome = o; break; } }
    let next = { ...item, corrupted: true };
    let detail = {};
    if (outcome.kind === 'reroll_values') {
      next.lines = item.lines.map((l: any) => {
        const [lo, hi] = loot.rangeOf(l.id, next.ilvl, next.q, lineSlice(l, 2));
        return { ...l, value: lo + Math.floor(rng() * (hi - lo + 1)) };
      });
      detail = { lines: next.lines.length };
    } else if (outcome.kind === 'add_mod') {
      const added = add(next, pool, rng, { ignoreAddCap: true });
      if (added.ok) next = { ...added.item, corrupted: true };
      detail = { added: added.ok, why: added.why };
    } else if (outcome.kind === 'remove_mod') {
      const cut = remove({ ...next, corrupted: false }, rng);
      if (cut.ok) next = { ...cut.item, corrupted: true };
      detail = { removed: cut.ok };
    } else if (outcome.kind === 'reroll_element') {
      const elements = E.elements.order;
      next.lines = item.lines.map((l: any) => (l.element
        ? { ...l, element: elements[Math.floor(rng() * elements.length)] }
        : l));
    } else if (outcome.kind === 'gear_mod_up') {
      const steps = outcome.steps || 2;
      next.upgrade_lv = Math.min(C.upgrade_cap, (item.upgrade_lv || 0) + steps);
      next.gearMod = (item.gearMod || 0) + stepOf(item, steps);
      detail = { level: next.upgrade_lv };
    } else if (outcome.kind === 'quality_down') {
      const q = Math.max(0, (item.q || 0) - 1);
      const ilvl = Math.max(1, (item.ilvl || 0) - E.item_level.ascend_levels);
      next = { ...next, ilvl, q, quality: QUALITY_STEPS[q] };
      next.lines = next.lines.map((l: any) => {
        const [lo, hi] = loot.rangeOf(l.id, ilvl, q, lineSlice(l, 2));
        return { ...l, value: lo + Math.floor(rng() * (hi - lo + 1)) };
      });
      detail = { q, ilvl };
    }
    return { ok: true, item: next, changed: { outcome: outcome.kind, weight: outcome.weight, ...detail } };
  }

  /**
   * What one Upgrade step adds to the piece's Gear Mod. `craft.gear_mod_per_level` is bounded by the
   * published line ceiling — the same `mod_max` line `tools/loot.ts` rolls the Gear Mod from — so a
   * full ladder cannot pass one T1 line on the piece (gate LD7).
   */
  const stepOf = (item: any, n: number) => (C.gear_mod_per_level || 0) * n;

  /** What the bench still cannot do, said in the player's terms. */
  const LOCKED: Record<string, string> = {};
  const PENDING_POWER: Record<string, string> = {};

  return {
    C, QUALITY_STEPS, STONE_NAME, BASE_MOD_SLOTS, SUB_SLOTS, UNTOUCHABLE, LOCKED, PENDING_POWER, costOf, guard, payable, spend,
    successPct, stepOf, reroll, refine, randomize, ascend, remove, add, upgrade, repair, corrupt,
  };
}
