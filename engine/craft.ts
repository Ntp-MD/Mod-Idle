/**
 * The craft bench — the stones `crafting.md` prices in `engine.json` `craft`, each with the scope it
 * works in. **No verb redraws the Frame Mod's identity** — line 1 is the frame's own — and the two
 * whole-piece stones are the only ones that move its value.
 *
 * **Unbound only** (the head of the piece stays untouched): Reroll value on a line or on a line the
 * stone picks, Refine, Randomize, Imprint, Remove (random or named) and Add (random or named).
 * **Reach the Bound pair too**: Reroll mod and Replace, and the two whole-piece stones — **Polish**
 * re-rolls every line's value inside its own Tier and cannot move a Tier, **Reforge** redraws the
 * piece's Tier once and rolls every value under it, so the whole piece can climb or fall together
 * (owner ruling: the identity verbs and the whole-piece stones cross the head, nothing removes a
 * Bound line and nothing redraws line 1).
 *
 * A bulk press costs the single-line press times the lines the press edits — no discount, no premium —
 * so `craft` prices one line and the count is read off the piece.
 *
 * Upgrade, Repair and Corrupt run on `crafting.md`'s published ladder and Vaal table, both copied into
 * `engine.json` `craft`. The one figure that pass still owes is the Gear Mod value per +1, which
 * `crafting.md` sends to the mob-sheet rebalance pass, so `craft.gear_mod_per_level` is 0 and the
 * uplift is switched off rather than guessed.
 */

import type * as lootMod from './loot.ts';
import type { EngineData, Rng } from './types.ts';

export const QUALITY_STEPS = ['low', 'mid', 'high'];

/** One stone per Mod line in the game: the stone that rewrites a line as its own Mod. */
export const imprintStoneFor = (modId: string) => 'imprint_' + modId;

/**
 * What each purse key is called in the player's words — the purse, the bench and the wiki all read
 * this map, so a stone has one name in the game and not one per screen. The scheme is `<verb> stone`:
 * the stone is the purse item, and the press it buys is named in `PRESS_NAME` below, never folded into
 * the stone's name. `imprint_<id>` keys read as `Imprint — <Mod name>` (one stone per Mod).
 */
export const STONE_NAME: Record<string, string> = {
  reroll_value: 'Value stone', tier: 'Tier stone', add: 'Add stone',
  remove: 'Remove stone', replace: 'Replace stone', quality: 'Quality stone', repair: 'Repair stone',
  corrupt: 'Corrupt stone', polish: 'Polish stone', reforge: 'Reforge stone', rebirth: 'Rebirth stone',
  // the family label only — a purse never holds this key, it holds `imprint_<modId>`, which the client
  // reads as `Imprint — <Mod name>` so one stone per Mod stays one line in the purse
  imprint: 'Imprint stone',
};

/**
 * What each press is called — one name per op, and the scope lives in the name because the scope is
 * the thing the player is choosing. A stone with three presses has three names.
 */
export const PRESS_NAME: Record<string, string> = {
  reroll: 'Reroll value on a line',
  reroll_random: 'Reroll value on a random line',
  refine: 'Refine a line',
  randomize: 'Roll a tier on a line',
  reroll_mod: 'Roll a new Mod on a line',
  reroll_mod_all: 'Roll a new Mod on the piece',
  ascend: 'Ascend the piece',
  replace: 'Replace a Mod on a line',
  replace_random: 'Replace a Mod on a random line',
  replace_all: 'Replace a Mod on the piece',
  imprint: 'Imprint a Mod on a line',
  add: 'Add a Mod on the piece',
  add_specific: 'Add a chosen Mod on the piece',
  remove: 'Remove a Mod on a random line',
  remove_at: 'Remove a Mod on a line',
  polish: 'Polish the piece',
  reforge: 'Reforge the piece',
  // the set, not the piece: the Frame Mod and the Bound pair keep their identity
  rebirth: 'Rebirth the Unbound lines',
  upgrade: 'Upgrade a step',
  repair: 'Repair the piece',
  corrupt: 'Corrupt the piece',
};

/** The press name, or the op id when a screen has not been given a name for it yet. */
export const pressName = (op: string) => PRESS_NAME[op] || op;

export function createCraft(E: EngineData, loot: ReturnType<typeof lootMod.createLoot>) {
  const C = E.craft;

  const costOf = (op: string, item: any, extra?: string): Record<string, number> => ({
    reroll: { reroll_value: C.reroll_value_stones_per_use },
    // the stone spends the Reroll rule on a line the player did not pick: same price, same purse
    reroll_random: { reroll_value: C.reroll_value_stones_per_use },
    refine: { tier: C.refine_stones_per_use },
    randomize: { tier: C.roll_stones_per_use },
    // Reroll mod = a fresh Mod identity on the line, rolled the way a drop rolls one
    reroll_mod: { tier: C.roll_stones_per_use },
    reroll_mod_all: { tier: C.roll_stones_per_use * editableCount(item, PIECE_FLOOR) },
    ascend: { add: C.ascend_add_stones, tier: C.ascend_tier_stones },
    remove: { remove: C.remove_stones_per_use },
    remove_at: { remove: C.remove_stones_per_use },
    replace: { replace: C.replace_stones_per_use },
    replace_random: { replace: C.replace_stones_per_use },
    replace_all: { replace: C.replace_stones_per_use * editableCount(item, PIECE_FLOOR) },
    imprint: extra ? { [imprintStoneFor(extra)]: C.imprint_stones_per_use } : {},
    polish: { polish: C.polish_stones_per_use },
    reforge: { reforge: C.reforge_stones_per_use },
    // one stone buys the whole Unbound set redrawn — the price does not count the lines
    rebirth: { rebirth: C.rebirth_stones_per_use },
    add: { add: E.item_level.add_stones_per_fill[Math.min((item?.mods_added || 0), 1)] },
    add_specific: { add: E.item_level.add_stones_per_fill[Math.min((item?.mods_added || 0), 1)] },
    // Quality stones per step are `crafting.md`'s ladder: 1/2/3/4/5, 7/9/11/13/15, 18/21/24/27/30
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
   * Success chance for the step being attempted: +1..+4 safe, +5..+10 from 90% down to 45%,
   * +11..+15 from 40% down to 10% (`crafting.md`). Only the endpoints are data; the run between
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

  // The skeleton's head (item-base.md): line 1 is the Frame Mod and lines 2-3 the Bound pair.
  // Two floors, because the bench now has two reach rules. `UNTOUCHABLE` is the head no slot-by-slot
  // value or count verb crosses — Reroll value, Refine, Randomize, Remove, Add and Imprint all stop
  // below the Bound pair. `PIECE_FLOOR` is the Frame Mod alone: the identity verbs (Reroll mod,
  // Replace) reach the Bound pair by the owner's ruling, and so do the two whole-piece stones,
  // which is the reach no other stone has. The Frame Mod is in no scope at all: it is the frame's
  // own identity, and every verb that redraws a Mod leaves it where it is.
  const FRAME_MOD_SLOTS = E.item_level.frame_mod_slots || 1;
  const BOUND_SLOTS = E.item_level.bound_slots || 2;
  const UNTOUCHABLE = FRAME_MOD_SLOTS + BOUND_SLOTS;
  const PIECE_FLOOR = FRAME_MOD_SLOTS;

  /** How many lines one verb will edit at one floor — the divisor every bulk price is read off. */
  const editableCount = (item: any, floor: number) =>
    Math.max(0, ((item?.lines || []).length) - floor);

  /** A line the bench may edit at one floor. Above it the head stays where the drop put it. */
  function editable(item: any, index: number, floor: number = UNTOUCHABLE) {
    if (index < floor) {
      return { ok: false, why: floor === UNTOUCHABLE
        ? 'the Frame Mod and Bound lines cannot be changed'
        : 'the Frame Mod cannot be changed' };
    }
    const line = item.lines[index];
    if (!line) return { ok: false, why: 'no such slot' };
    return { ok: true, line };
  }

  function payable(stones: Record<string, number>, op: string, item: any, extra?: string) {
    if (op === 'imprint' && !extra) return false;
    const cost = costOf(op, item, extra);
    return Object.entries(cost).every(([stone, n]) => (stones[stone] || 0) >= n);
  }

  function spend(stones: Record<string, number>, op: string, item: any, extra?: string) {
    const cost = costOf(op, item, extra);
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

  /** Remove: delete one random non-bound line. Identity changes only via Remove + Add. */
  function remove(item: any, rng: Rng): any {
    const g = guard(item, 'remove');
    if (!g.ok) return g;
    if (item.lines.length <= UNTOUCHABLE) return { ok: false, why: 'only the Frame and Bound lines are left on this piece' };
    const candidates = item.lines.map((l: any, i: number) => i).slice(UNTOUCHABLE);
    const pick = candidates[Math.floor(rng() * candidates.length)];
    return { ok: true, item: { ...item, lines: item.lines.filter((_: any, i: number) => i !== pick) }, changed: { index: pick } };
  }

  /**
   * The lines a Replace stone may bring in: the piece's own pool, minus what it already carries and
   * minus anything its pool blocks. The choice is the player's, the pool is the Base's.
   */
  function choicesOf(item: any, pool: string[]): string[] {
    if (!item) return [];
    const taken = new Set<string>(item.lines.flatMap((l: any) => [l.id, ...((l.extra || []).map((x: any) => x.id))]));
    const blocked = loot.blockedBy(taken);
    return pool.filter((id) => !taken.has(id) && !blocked.has(id));
  }

  /**
   * Replace stone: one named line leaves, one named line comes in, and the incoming line's Tier is
   * the stone's own roll. The identity stops being a gamble and the Tier stays one, so a chosen Mod
   * still has to be climbed with Reroll tier. The slot's Reroll baseline is cleared with the old
   * identity: a baseline is the highest value *that line* ever held, and a different Mod sitting in
   * the same slot is not the same line (`crafting.md`'s Reroll rule). This verb reaches the Bound
   * pair — the owner's ruling — and no further: the Frame Mod is the frame's own identity.
   */
  function replaceLine(item: any, index: number, id: string, pool: string[], rng: Rng): any {
    const g = guard(item, 'replace');
    if (!g.ok) return g;
    const e = editable(item, index, PIECE_FLOOR);
    if (!e.ok) return e;
    if (!pool.includes(id)) return { ok: false, why: 'that line is not in this Base pool' };
    if (!choicesOf(item, pool).includes(id)) return { ok: false, why: 'this piece already carries that Mod' };
    const slice = loot.tierSlice(rng());
    const [lo, hi] = loot.rangeOf(id, item.ilvl, item.q, slice);
    const value = lo + Math.floor(rng() * (hi - lo + 1));
    const stat = loot.statOf(id, rng);
    const baselines = { ...(item.baselines || {}) };
    delete baselines[index];
    const next = {
      ...item,
      baselines,
      lines: item.lines.map((l: any, i: number) => (i === index
        ? { id, value, slice, ...(stat ? { stat } : {}), ...(l.crafted ? { crafted: true } : {}) }
        : l)),
    };
    return {
      ok: true,
      item: next,
      changed: { index, out: e.line.id, in: id, value, slice, lo, hi },
    };
  }

  /**
   * Imprint stone: one named Unbound line leaves, the stone's own Mod comes in, and the incoming
   * line's Tier and value are a fresh roll the way a drop rolls them. The identity stops being a
   * gamble and the Tier stays one, so a chosen Mod still has to be climbed. Like Replace, it never
   * touches the Frame Mod or the Bound pair, spends no Add charge and changes no line count — and
   * the slot's Reroll baseline is cleared with the old identity.
   */
  function imprint(item: any, index: number, modId: string, rng: Rng): any {
    const g = guard(item, 'imprint');
    if (!g.ok) return g;
    const e = editable(item, index);
    if (!e.ok) return e;
    if (!modId || !loot.NAME_OF[modId]) return { ok: false, why: 'no such Mod line' };
    const taken = new Set<string>(item.lines.flatMap((l: any) => [l.id, ...((l.extra || []).map((x: any) => x.id))]));
    if (taken.has(modId)) return { ok: false, why: 'this piece already carries that Mod' };
    if (loot.blockedBy(taken).has(modId)) return { ok: false, why: 'that Mod is blocked on this piece' };
    const slice = loot.tierSlice(rng());
    const [lo, hi] = loot.rangeOf(modId, item.ilvl, item.q, slice);
    const value = lo + Math.floor(rng() * (hi - lo + 1));
    const stat = loot.statOf(modId, rng);
    const element = modId.startsWith('elemental_') ? loot.pick(rng, loot.ELEMENTS) : null;
    const baselines = { ...(item.baselines || {}) };
    delete baselines[index];
    const next = {
      ...item,
      baselines,
      lines: item.lines.map((l: any, i: number) => (i === index
        ? { id: modId, value, slice, ...(stat ? { stat } : {}), ...(element ? { element } : {}), ...(l.crafted ? { crafted: true } : {}) }
        : l)),
    };
    return {
      ok: true,
      item: next,
      changed: { index, out: e.line.id, in: modId, value, slice, lo, hi },
    };
  }
  /**
   * One line's fresh identity, drawn the way a drop draws one: the Base's own pool, minus what the
   * piece already carries and minus anything that family blocks, on the same `weight` odds. A bulk
   * pass grows `taken` as it goes, so two lines never land on one Mod.
   */
  function drawIdentity(item: any, pool: string[], taken: Set<string>, rng: Rng): string | null {
    const blocked = loot.blockedBy(taken);
    const free = pool.filter((id) => !taken.has(id) && !blocked.has(id));
    if (!free.length) return null;
    return loot.weightedPick(rng, free.map((id) => ({ id, w: loot.weightOf(id, item.q) })));
  }

  /** The line one Mod identity makes: a fresh Tier, a value inside it, and the roll's own stat and Element. */
  function rolledLine(item: any, id: string, rng: Rng): any {
    const slice = loot.tierSlice(rng());
    const [lo, hi] = loot.rangeOf(id, item.ilvl, item.q, slice);
    const stat = loot.statOf(id, rng);
    const element = id.startsWith('elemental_') ? loot.pick(rng, loot.ELEMENTS) : null;
    return { id, value: lo + Math.floor(rng() * (hi - lo + 1)), slice,
      ...(stat ? { stat } : {}), ...(element ? { element } : {}) };
  }

  /**
   * Replace a set of lines with fresh identities. The count never moves, no Add charge is spent, and
   * each slot's Reroll baseline goes with the identity it held — a floor is the highest value *that
   * Mod* held, and a different Mod in the same slot is not the same line.
   */
  function redrawLines(item: any, indexes: number[], pool: string[], rng: Rng): any {
    const taken = new Set<string>(item.lines.flatMap((l: any) => [l.id, ...((l.extra || []).map((x: any) => x.id))]));
    const baselines = { ...(item.baselines || {}) };
    const lines = [...item.lines];
    const changed: { index: number; out: string; in: string }[] = [];
    for (const i of indexes) {
      taken.delete(lines[i].id);
      for (const x of (lines[i].extra || [])) taken.delete(x.id);
      const id = drawIdentity(item, pool, taken, rng);
      if (!id) return { ok: false, why: 'this Base has no Mod left that the piece may carry' };
      taken.add(id);
      const wasCrafted = lines[i].crafted ? { crafted: true } : {};
      lines[i] = { ...rolledLine(item, id, rng), ...wasCrafted };
      delete baselines[i];
      changed.push({ index: i, out: item.lines[i].id, in: id });
    }
    return { ok: true, item: { ...item, baselines, lines }, changed };
  }

  /** The lines one scope holds: everything above the floor it is told to work in. */
  const scopeOf = (item: any, floor: number) =>
    item.lines.map((l: any, i: number) => i).slice(floor);

  /**
   * Reroll mod: one named line (Frame Mod excepted) loses its identity and draws a fresh Mod from the
   * piece's own pool. The player does not choose what arrives — that is Replace and Imprint.
   */
  function rerollMod(item: any, index: number, pool: string[], rng: Rng): any {
    const g = guard(item, 'reroll_mod');
    if (!g.ok) return g;
    const e = editable(item, index, PIECE_FLOOR);
    if (!e.ok) return e;
    const cut = redrawLines(item, [index], pool, rng);
    if (!cut.ok) return cut;
    return { ok: true, item: cut.item, changed: { ...cut.changed[0], value: cut.item.lines[index].value, slice: cut.item.lines[index].slice } };
  }

  /** Reroll mod across the piece: every line but the Frame Mod redrawn in one press. */
  function rerollModAll(item: any, pool: string[], rng: Rng): any {
    const g = guard(item, 'reroll_mod_all');
    if (!g.ok) return g;
    if (editableCount(item, PIECE_FLOOR) <= 0) return { ok: false, why: 'only the Frame Mod is left on this piece' };
    return redrawLines(item, scopeOf(item, PIECE_FLOOR), pool, rng);
  }

  /**
   * Rebirth stone: the whole Unbound set redrawn in one press — every line past the Bound pair,
   * including any line an Add stone filled, leaves and a fresh Mod is drawn in its place. One stone buys
   * the press, not one stone a line, because the reach is the product: the player chooses none of it.
   * The Frame Mod and the Bound pair are untouched, the line count never moves, no Add charge is spent,
   * and each slot's Reroll floor leaves with the identity it held.
   */
  function rebirth(item: any, pool: string[], rng: Rng): any {
    const g = guard(item, 'rebirth');
    if (!g.ok) return g;
    const set = scopeOf(item, UNTOUCHABLE);
    if (!set.length) return { ok: false, why: 'this piece has no Unbound line to redraw' };
    return redrawLines(item, set, pool, rng);
  }

  /**
   * Replace across the piece, priced as Replace: the player pays the chosen-swap price for every line
   * the press redraws. The Mod that arrives is still the pool's draw — a chosen identity per line is
   * one press of Replace or Imprint on that line, not a bulk press.
   */
  function replaceAll(item: any, pool: string[], rng: Rng): any {
    const g = guard(item, 'replace_all');
    if (!g.ok) return g;
    if (editableCount(item, PIECE_FLOOR) <= 0) return { ok: false, why: 'only the Frame Mod is left on this piece' };
    return redrawLines(item, scopeOf(item, PIECE_FLOOR), pool, rng);
  }

  /** Replace with a chosen Mod, into a line the stone picks: the Unbound lines only, and one of them at random. */
  function replaceRandom(item: any, id: string, pool: string[], rng: Rng): any {
    const candidates = scopeOf(item, UNTOUCHABLE);
    if (!candidates.length) return { ok: false, why: 'this piece has no Unbound line to replace' };
    return replaceLine(item, candidates[Math.floor(rng() * candidates.length)], id, pool, rng);
  }

  /** Reroll value on a line the stone picks: the Reroll rule, the same floor, an Unbound line at random. */
  function rerollRandom(item: any, rng: Rng): any {
    const candidates = scopeOf(item, UNTOUCHABLE);
    if (!candidates.length) return { ok: false, why: 'this piece has no Unbound line to reroll' };
    return reroll(item, candidates[Math.floor(rng() * candidates.length)], rng);
  }

  /** Remove the line the player names. Still never the Frame Mod and never the Bound pair. */
  function removeAt(item: any, index: number): any {
    const g = guard(item, 'remove_at');
    if (!g.ok) return g;
    const e = editable(item, index, UNTOUCHABLE);
    if (!e.ok) return e;
    return {
      ok: true,
      item: { ...item, lines: item.lines.filter((_: any, i: number) => i !== index) },
      changed: { index, out: e.line.id },
    };
  }

  /**
   * Add the Mod the player names into the next empty line. The stone is the Add stone and the price is
   * `add_stones_per_fill`'s own ladder, so choosing costs exactly what gambling costs — what the choice
   * buys is the identity, not a cheaper line.
   */
  function addSpecific(item: any, pool: string[], id: string, rng: Rng): any {
    const g = guard(item, 'add_specific');
    if (!g.ok) return g;
    const L = E.item_level;
    const dropped = item.unbound_at_drop ?? Math.max(0, (item.lines.length - UNTOUCHABLE) - (item.mods_added || 0));
    const added = (item.lines.length - UNTOUCHABLE) - dropped;
    if (added >= L.mods_added_cap) return { ok: false, why: `this piece has taken its ${L.mods_added_cap} Add stones` };
    if (item.lines.length >= L.crafted_max) return { ok: false, why: `a piece stops at ${L.crafted_max} Mods` };
    if (!pool.includes(id)) return { ok: false, why: 'that line is not in this Base pool' };
    const taken = new Set<string>(item.lines.flatMap((l: any) => [l.id, ...((l.extra || []).map((x: any) => x.id))]));
    if (taken.has(id)) return { ok: false, why: 'this piece already carries that Mod' };
    if (loot.blockedBy(taken).has(id)) return { ok: false, why: 'that Mod is blocked on this piece' };
    const line = { ...rolledLine(item, id, rng), crafted: true };
    return {
      ok: true,
      item: { ...item, lines: [...item.lines, line], mods_added: (item.mods_added || 0) + 1 },
      changed: { id, value: line.value, slice: line.slice, cost: L.add_stones_per_fill[Math.min(item.mods_added || 0, 1)] },
    };
  }

  /**
   * The Frame Mod's shared budget: one line may carry up to three Mods, and `loot.frame_mod.value_scale`
   * divides one window between them. The same published figure the drop spends, read here rather than
   * copied, so a whole-piece stone cannot disagree with a fresh drop about what line 1 is worth.
   */
  const frameScale = (line: any) =>
    E.loot.frame_mod.value_scale[String(1 + ((line?.extra || []).length))] ?? 1;

  /** One line's window at one Tier, with the Frame Mod's shared budget applied. */
  function windowOf(item: any, id: string, slice: number, k: number): [number, number] {
    const [lo, hi] = loot.rangeOf(id, item.ilvl, item.q, slice);
    const scaled = (v: number) => Math.max(1, Math.round(v * k));
    const a = scaled(lo), b = scaled(hi);
    return [a, Math.max(a, b)];
  }

  /**
   * Polish stone: the Reroll rule spent across the whole piece in one press. Every line's value
   * re-rolls inside its own Tier and never below the floor that slot has ever held, and no Tier moves —
   * the Frame Mod and the Bound pair are included, which is the reach no other stone has. Identity,
   * Element, line count and the Add charge are untouched.
   */
  function polish(item: any, rng: Rng): any {
    const g = guard(item, 'polish');
    if (!g.ok) return g;
    const baselines = { ...(item.baselines || {}) };
    const lines = item.lines.map((l: any, i: number) => {
      const k = i === 0 ? frameScale(l) : 1;
      const slice = lineSlice(l, 2);
      const rollLine = (id: string, now: number) => {
        const [lo, hi] = windowOf(item, id, slice, k);
        const floor = Math.max(lo, baselines[i] ?? 0, now);
        const value = floor + Math.floor(rng() * Math.max(0, hi - floor + 1));
        return { value, hi: Math.max(floor, hi) };
      };
      const r = rollLine(l.id, l.value);
      baselines[i] = Math.max(baselines[i] ?? 0, r.value);
      const extra = (l.extra || []).map((x: any) => ({ ...x, value: rollLine(x.id, x.value).value }));
      return { ...l, value: r.value, ...(extra.length ? { extra } : {}) };
    });
    return { ok: true, item: { ...item, baselines, lines }, changed: { lines: lines.length, tiers: 'held' } };
  }

  /**
   * Reforge stone: the piece's Tier redrawn the way a drop draws it — one roll on the published
   * weights, spent on every line at once — then each line's value rolled inside the Tier it landed on.
   * So the whole piece can climb together or be dragged down: the Tier is the gamble and the values
   * follow it. A slot whose Tier moved loses its Reroll floor, because a floor is the highest value
   * that line held *at that Tier*; a slot the draw left where it was keeps its floor.
   */
  function reforge(item: any, rng: Rng): any {
    const g = guard(item, 'reforge');
    if (!g.ok) return g;
    const slice = loot.tierSlice(rng());
    const baselines = { ...(item.baselines || {}) };
    let moved = 0;
    const lines = item.lines.map((l: any, i: number) => {
      const was = lineSlice(l, 2);
      if (was !== slice) { delete baselines[i]; moved++; }
      const k = i === 0 ? frameScale(l) : 1;
      const [lo, hi] = windowOf(item, l.id, slice, k);
      const value = lo + Math.floor(rng() * Math.max(0, hi - lo + 1));
      const extra = (l.extra || []).map((x: any) => {
        const [xlo, xhi] = windowOf(item, x.id, slice, k);
        return { ...x, value: xlo + Math.floor(rng() * Math.max(0, xhi - xlo + 1)) };
      });
      return { ...l, slice, value, ...(extra.length ? { extra } : {}) };
    });
    return { ok: true, item: { ...item, baselines, lines }, changed: { lines: lines.length, slice, moved } };
  }

  /**
   * Add stone: fill the next empty line from the Base pool. The stone draws, it does not ask —
   * the player never picks the line (crafting.md rule 6), and the same line never appears twice.
   * The Stat Mod slot holds one line, so a piece that already carries one blocks every sibling
   * (`stat_mod_flat` and `all_stat_flat` cannot sit on the same piece — equipment-slot-pools.md).
   */
  function add(item: any, pool: string[], rng: Rng, opts: { ignoreAddCap?: boolean } = {}): any {
    const g = guard(item, 'add');
    if (!g.ok) return g;
    const L = E.item_level;
    // the cap is net, not gross: the piece remembers how many Unbound lines it dropped with
    // (`unbound_at_drop`), and Remove refunds room — but `mods_added` keeps counting every stone
    // taken, so the fill price still climbs and never resets.
    const dropped = item.unbound_at_drop ?? Math.max(0, (item.lines.length - UNTOUCHABLE) - (item.mods_added || 0));
    const added = (item.lines.length - UNTOUCHABLE) - dropped;
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
    // the line an Add stone filled is a crafted line whatever Mod later replaces its identity
    const line = { id, value: lo + Math.floor(rng() * (hi - lo + 1)), slice, crafted: true, ...(stat ? { stat } : {}) };
    return {
      ok: true,
      item: { ...item, lines: [...item.lines, line], mods_added: (item.mods_added || 0) + 1 },
      changed: { id, value: line.value, slice, cost: L.add_stones_per_fill[Math.min(item.mods_added || 0, 1)] },
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
    C, QUALITY_STEPS, STONE_NAME, PRESS_NAME, pressName, FRAME_MOD_SLOTS, BOUND_SLOTS, UNTOUCHABLE, PIECE_FLOOR, LOCKED, PENDING_POWER,
    costOf, guard, payable, spend, editable, editableCount, scopeOf,
    successPct, stepOf, reroll, refine, randomize, ascend, remove, replaceLine, choicesOf, add, upgrade, repair, corrupt,
    imprint, polish, reforge, rebirth, imprintStoneFor,
    rerollRandom, rerollMod, rerollModAll, replaceAll, replaceRandom, removeAt, addSpecific,
  };
}
