/**
 * Shared drop-roll primitives — the RNG and the Rarity / Item quality / Tier mechanics
 * `tools/loot.ts` already runs, lifted out so the client rolls the same way.
 *
 * Rarity = Mod count · Item quality = value range · Tier = sub-range (AGENT.md §2 — never mix them).
 * The Bases a slot may carry are still parsed from `item-base.md` on the cage side; the client
 * rolls only the Mod lines that `mods.json` owns (harness/todo.md B6 will move the Bases into data).
 */

import type { EngineData, ModsData, Rng } from './types.ts';

/** Seeded, reproducible, no top-level await: a save cannot be rerolled for a better outcome. */
export function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = (rng: Rng, arr: any[]): any => arr[Math.floor(rng() * arr.length)];
export const intBetween = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
export const pickBand = (rng: Rng, table: [string, number][]) => {
  const r = rng();
  let acc = 0;
  for (const [band, chance] of table) { acc += chance; if (r < acc) return band; }
  return table[table.length - 1][0];
};

export function weightedPick(rng: Rng, entries: { id: string; w: number }[]) {
  let total = 0;
  for (const e of entries) total += e.w;
  let r = rng() * total;
  for (const e of entries) { r -= e.w; if (r <= 0) return e.id; }
  return entries[entries.length - 1].id;
}

export function createLoot(E: EngineData, MODS: ModsData) {
  // The earring is appended last (index 12) on purpose: the doll grid, `element.test.ts` and the
  // gear array address the other slots by position, so appending keeps every existing index stable
  // (D-131 — the order is cosmetic in the filter panel only).
  const SLOTS = ['helmet', 'chest', 'pant', 'boots', 'belt', 'gloves', 'ring', 'ring', 'amulet', 'cape', 'main hand', 'off hand', 'earring'];
  const GEAR_MOD_SLOTS = ['helmet', 'chest', 'pant', 'boots', 'gloves'];
  const GEAR_MODS = ['armour_flat', 'evasion_flat', 'energy_shield_flat'];
  // Rarity is the line count (loot.md §1 · item-rarity.md · D-123). Every piece carries line 1
  // (Base Mod) and the Legacy pair; `dropped_random` says how many of the 4 Random lines arrive
  // rolled, and `crafted_max` is the ceiling both Rarities share.
  const RARITY = Object.keys(E.rarity.drop_chance).map((name) => {
    const row = (E.rarity as any)[name] || {};
    return {
      name,
      chance: E.rarity.drop_chance[name],
      dropped_random: row.dropped_random ?? 0,
      crafted_max: row.crafted_max ?? 0,
    };
  });
  const TIER_SPLIT = [0.17, 0.50]; // T1 17% · T2 33% · T3 50% (item-rarity.md)
  const QUALITY_MIX = { low: [[0, 1]], mid: [[0, 0.55], [1, 0.45]], high: [[1, 0.40], [2, 0.60]] };
  const TIER_NAME = { 0: 'T1', 1: 'T2', 2: 'T3' };
  const BAND_LABEL = ['low', 'mid', 'high'];

  const WEIGHT_BY_ID: Record<string, number | number[]> = {};
  for (const row of E.mod_weights.rows) for (const id of row.ids) WEIGHT_BY_ID[id] = row.weight;
  const RW = E.mod_weights.role_weights;
  const MAX_OF: Record<string, number> = {}, NAME_OF: Record<string, string> = {}, BANDS_OF: Record<string, number[][][]> = {};
  for (const m of MODS.mods) { MAX_OF[m.id] = m.max; NAME_OF[m.id] = m.name; BANDS_OF[m.id] = m.bands; }

  /** The Mod weight for one line at one Item quality band (the Flat group steps by band). */
  function weightOf(id: string, q: number) {
    const w = WEIGHT_BY_ID[id];
    return Array.isArray(w) ? w[q] : w;
  }

  /** min..max of one Mod line at one Item quality band and one Tier slice. */
  function rangeOf(id: string, q: number, tier: number) {
    const band = (BANDS_OF[id] || [])[q];
    const b = band && band[tier];
    if (!b) throw new Error(`no value range for mod "${id}" (quality ${q}, tier ${tier})`);
    return [b[0], b[1]];
  }

  /** How many Tier slices this Mod actually publishes at this Item quality (2 or 3). */
  const sliceCount = (id: string, q: number) => ((BANDS_OF[id] || [])[q] || []).length || 1;

  const FLAT_GROUP = new Set(E.mod_weights.flat_group);
  const ELEMENTS = E.elements.order;

  // ---- the rollable pool and line 1 (item-base.md · D-123)

  const STAT_ID = 'stat_mod_flat';
  // The Stat Mod slot (item-base.md · equipment-slot-pools.md): one line, and the piece may hold it as
  // a single Core stat (`stat_mod_flat`, D-127) or as all seven at once (`all_stat_flat`, D-129). The
  // family is every `group: "Stat Mod"` row in `mods.json`, so a third sibling would join it with no
  // code change; the slot holds exactly one of them (`blockedBy` below).
  const STAT_IDS: string[] = MODS.mods.filter((m) => m.group === 'Stat Mod').map((m) => m.id);
  // The stats a Stat Mod line may feed, owned by the Mod row itself (`mods.json` `rolls`, gated by
  // checks.md X44 against core-stats.md's seven). A `stat_mod_flat` line bakes its stat at drop, so
  // the pick is data the roller reads, not a per-character choice made later; a sibling that feeds no
  // single stat (`all_stat_flat`) carries no `rolls` and bakes nothing.
  const STAT_ROLLS_OF: Record<string, string[]> = {};
  for (const m of MODS.mods) if (m.rolls) STAT_ROLLS_OF[m.id] = m.rolls;
  const STAT_ROLLS: string[] = STAT_ROLLS_OF[STAT_ID] || ['str', 'vit', 'dex', 'agi', 'wis', 'int', 'lck'];
  const ARMOUR_SLOTS = ['helmet', 'chest', 'pant', 'boots', 'gloves', 'cape'];

  /** The union of one slot's Bases, in pool order — the matrix `equipment-slot-pools.md` prints. */
  function slotUnion(BASES: any, slot: string, frame: any): { id: string; role: number }[] {
    const out: { id: string; role: number }[] = [];
    const push = (id: string, role: number) => { if (id && !out.some((e) => e.id === id)) out.push({ id, role }); };
    for (const b of (BASES?.bases || []).filter((x: any) => x.slot === slot)) {
      const own = b.name === frame?.name;
      for (const id of b.primary || []) push(id, own ? RW.primary : RW.secondary);
      for (const id of b.secondary || []) push(id, RW.secondary);
    }
    return out;
  }

  /**
   * The piece's rollable pool (D-123): the slot's union of Bases plus the lines the slot adds on its
   * own. Lines 2-7 all draw from this one list — the frame's own Primary keeps role 1.0 and
   * everything it does not own enters at 0.5, so the frame still steers the roll. A main-hand weapon
   * draws its type's pool (the physical / magic split) and a dual-wield off hand the same at half
   * weight; an off-hand frame (Shield · Book) draws its slot union plus its family's row.
   */
  function poolFor(BASES: any, slot: string, frame: any, weapon: any): { id: string; role: number }[] {
    const out: { id: string; role: number }[] = [];
    const push = (id: string, role: number) => { if (id && !out.some((e) => e.id === id)) out.push({ id, role }); };
    const wp = BASES?.weapon_pools || {};
    if (weapon) {
      const magic = weapon.damage === 'magic';
      const half = slot === 'off hand'; // a dual-wielded off hand is the same pool at half Primary
      // the Primary list is the physical pair plus the crit pair; a magic weapon swaps the pair
      // (`equipment-slot-weapon.md`) and keeps crit — crit is physical-only in use, rollable anywhere
      const power = magic ? ['magic_power_flat', 'magic_power'] : ['physical_power_flat', 'physical_power'];
      const crit = (wp['main hand']?.Primary || []).filter((id: string) => !id.startsWith('physical') && !id.startsWith('magic'));
      for (const id of [...power, ...crit]) push(id, half ? RW.secondary : RW.primary);
      for (const id of (wp['main hand']?.Secondary || [])) push(id, RW.secondary);
      push('elemental_power_flat', RW.secondary);
    } else {
      for (const e of slotUnion(BASES, slot, frame)) push(e.id, e.role);
      // the Gear Mod is the frame's own school, not all three: a heavy frame carries Armour alone
      if (GEAR_MOD_SLOTS.includes(slot) && frame?.school) push(frame.school, RW.gear_mod);
      // the armour slots' line-1 pool is also rollable (item-base.md): that is where Armour % and
      // Max Energy Shield % live, since no frame table names them
      if (ARMOUR_SLOTS.includes(slot)) for (const id of (BASES?.base_mod?.defence || [])) push(id, RW.secondary);
      if (slot === 'off hand' && frame?.family) {
        for (const id of (wp['off hand']?.[frame.family] || [])) push(id, RW.secondary);
      }
    }
    for (const id of STAT_IDS) push(id, RW.stat_mod);
    return out;
  }

  /**
   * Ids the pool must drop because the piece already holds a family member whose slot allows only one
   * (D-129): the Stat Mod slot is a single line, so once any `STAT_IDS` id is taken every sibling is
   * blocked. A no-op for every mod outside the family. Callers spread the result over `taken`.
   */
  function blockedBy(taken: Set<string>): Set<string> {
    const out = new Set<string>();
    if (STAT_IDS.some((id) => taken.has(id))) for (const id of STAT_IDS) out.add(id);
    return out;
  }

  /**
   * Line 1 — the Base Mod (item-base.md · D-123). Armour slots lock the frame's own defence type and
   * roll `hybrid_chance` for the next ones, in the pool's own order; a weapon forces every Mod its
   * type lists; an off-hand frame carries its family's pair; belt / ring / amulet draw one from the
   * slot's pool. The line shares one budget: one Mod keeps its roll, two take `value_scale` for 2,
   * three for 3 — so more is better, sublinearly. All of it is ONE line, the first Mod in `id` and the
   * rest in `extra`, so the 7-line skeleton's counts and the unremovable floor stay fixed. `u` is the
   * item's one Tier draw, shared with the Random lines exactly as `tools/loot.ts` rolls them.
   */
  function baseModRoll(BASES: any, slot: string, frame: any, weapon: any, rng: Rng, q: number, u: number): any[] {
    const BM = E.loot.base_mod;
    const scale = (n: number) => BM.value_scale[String(n)] ?? 1;
    const ids: string[] = [];
    if (weapon) {
      // a weapon (main hand, or a dual-wielded off hand) forces every Mod its own type lists
      for (const id of (BASES?.base_mod?.weapons?.[weapon.name] || [])) ids.push(id);
    } else if (ARMOUR_SLOTS.includes(slot) && frame?.defence) {
      ids.push(frame.defence);
      const others = (BASES?.base_mod?.defence || []).filter((id: string) => id !== frame.defence);
      for (const id of others) {
        if (rng() >= (BM.hybrid_chance[ids.length - 1] ?? 0)) break;
        ids.push(id);
      }
    } else if (slot === 'off hand' && frame?.family) {
      // an off-hand frame carries its family's pair (a Shield the block line, a Book the magic pair)
      for (const id of (BASES?.base_mod?.off_hand?.[frame.family] || [])) ids.push(id);
    } else if ((BASES?.base_mod?.legacy_slots || []).includes(slot)) {
      const pool = poolFor(BASES, slot, frame, null).filter((e) => !STAT_IDS.includes(e.id));
      if (pool.length) ids.push(weightedPick(rng, pool.map((e) => ({ id: e.id, w: e.role * weightOf(e.id, q) }))));
    }
    const k = scale(ids.length);
    const roll = (id: string) => {
      const slice = tierSlice(u, sliceCount(id, q));
      const [lo, hi] = rangeOf(id, q, slice);
      return { id, value: Math.max(1, Math.round((lo + Math.floor(rng() * (hi - lo + 1))) * k)), slice };
    };
    if (!ids.length) return [];
    const first = roll(ids[0]);
    // an Elemental line carries its Element at drop, exactly as a Random line does
    return [{
      id: first.id, value: first.value, slice: first.slice,
      element: first.id.startsWith('elemental_') ? pick(rng, ELEMENTS) : null,
      ...(ids.length > 1 ? { extra: ids.slice(1).map((id) => { const r = roll(id); return { id: r.id, value: r.value }; }) } : {}),
    }];
  }

  /** The lines a dropped piece carries: line 1 + the Legacy pair + its rolled Random lines. */
  function linesAtDrop(rarityName: string) {
    const row = RARITY.find((r) => r.name === rarityName) || RARITY[RARITY.length - 1];
    return (E.rarity.base_mod_slots || 0) + (E.rarity.legacy_slots || 0) + (row?.dropped_random || 0);
  }

  /**
   * Line 1 at its floor, for a piece restored from a pre-skeleton save (D-123). The same Mods a fresh
   * roll would force, but at the lowest Tier and lowest value of the quality band and with no RNG at
   * all, so two loads of one save agree to the digit. Still one line, the extra Mods in `extra`.
   */
  function baseModAtFloor(BASES: any, slot: string, frame: any, weapon: any, q: number): any[] {
    const BM = E.loot.base_mod;
    const scale = (n: number) => BM.value_scale[String(n)] ?? 1;
    const ids: string[] = [];
    if (weapon) for (const id of (BASES?.base_mod?.weapons?.[weapon.name] || [])) ids.push(id);
    else if (ARMOUR_SLOTS.includes(slot) && frame?.defence) ids.push(frame.defence);
    else if (slot === 'off hand' && frame?.family) for (const id of (BASES?.base_mod?.off_hand?.[frame.family] || [])) ids.push(id);
    else if ((BASES?.base_mod?.legacy_slots || []).includes(slot)) {
      const pool = poolFor(BASES, slot, frame, null).filter((e) => !STAT_IDS.includes(e.id));
      if (pool.length) ids.push(pool[0].id);
    }
    if (!ids.length) return [];
    const k = scale(ids.length);
    const value = (id: string) => Math.max(1, Math.round(rangeOf(id, q, 0)[0] * k));
    return [{
      id: ids[0], value: value(ids[0]), slice: 0, element: null,
      ...(ids.length > 1 ? { extra: ids.slice(1).map((id) => ({ id, value: value(id) })) } : {}),
    }];
  }

  /** The score the filter compares: Σ weight(line) × value ÷ Total (loot.md §4). */
  function score(item: any) {
    let s = 0;
    for (const l of item.lines) {
      s += weightOf(l.id, item.q) * (l.value / MAX_OF[l.id]);
      // a Base Mod line's extra Mods are part of the same line and count too (D-123)
      for (const x of (l.extra || [])) s += weightOf(x.id, item.q) * (x.value / MAX_OF[x.id]);
    }
    return s;
  }

  /**
   * The bag filter: keep a drop only when it beats the piece worn in the same slot by more than
   * noise — `upgrade_margin_pct` — or when it carries an Element the player has no answer to
   * (loot.md §4). Anything else dissolves for 1 Reroll value stone, never for gold (`economy.md`).
   *
   * The last argument is one slot's configured thresholds (`save.md`): a raised margin, a Rarity
   * floor and the Element keep-list switch. Every value falls back to the published rule, so a
   * caller that configures nothing gets exactly the behaviour `tools/loot.ts` measures.
   */
  function keepsDrop(item: any, wornScore: number | undefined, knownElements: Set<string> | undefined, marginPct: number, rule?: any) {
    const o = rule || {};
    const margin = o.margin_pct != null ? o.margin_pct / 100 : marginPct;
    const keepElement = o.keep_missing_element !== false;
    const s = score(item);
    if (o.min_rarity && o.min_rarity !== 'any' && item.rarity !== o.min_rarity) {
      return { keep: false, reason: 'threshold', score: s, margin };
    }
    if (wornScore === undefined || s > wornScore * (1 + margin)) {
      return { keep: true, reason: 'upgrade', score: s, margin };
    }
    const fresh = keepElement
      && item.lines.some((l: any) => l.element && !(knownElements || new Set()).has(l.element));
    if (fresh) return { keep: true, reason: 'element', score: s, margin };
    return { keep: false, reason: 'dissolve', score: s, margin };
  }

  /**
   * The "Elements/slots the player has not yet found" list (loot.md §4 · save.md): an Element no
   * worn piece resists is still a keep reason, and a hole in the equip list is still unfound.
   */
  function notYetFound(gear?: (any | null)[]) {
    const covered = new Set<string>();
    for (const item of gear || []) {
      if (!item) continue;
      for (const l of item.lines || []) if (l.element) covered.add(l.element);
    }
    return {
      covered,
      elements: ELEMENTS.filter((e) => !covered.has(e)),
      slots: SLOTS.filter((_, i) => !(gear || [])[i]),
    };
  }

  /**
   * The Core stat a `stat_mod_flat` line bakes at drop — `undefined` for every Mod with no `rolls`,
   * so a caller can spread it straight onto the line it is building. The pool is the Mod row's own
   * `rolls` (`mods.json`), one home for the seven (checks.md X44). `all_stat_flat` feeds all seven at
   * once instead of one, so it carries no `rolls` and bakes nothing (D-129).
   */
  const statOf = (id: string, rng: Rng): string | undefined => {
    const rolls = STAT_ROLLS_OF[id];
    return rolls ? pick(rng, rolls) : undefined;
  };

  /**
   * Which Tier slice of a Mod this roll lands on. Mods carry 2 or 3 slices per Item quality
   * band, and the published weights are per Tier (T1 17% · T2 33% · T3 50%), so a 2-slice Mod
   * spends its T2 and T3 weights on its better slice instead of dropping them.
   */
  function tierSlice(u: number, slices: number) {
    if (slices <= 1) return 0;
    if (u < TIER_SPLIT[0]) return 0;
    if (u < TIER_SPLIT[1]) return Math.round((slices - 1) / 2);
    return slices - 1;
  }

  return {
    SLOTS, GEAR_MOD_SLOTS, STAT_IDS, GEAR_MODS, STAT_ROLLS, RARITY, TIER_SPLIT, QUALITY_MIX, TIER_NAME,
    BAND_LABEL, RW, MAX_OF, NAME_OF, BANDS_OF, WEIGHT_BY_ID, FLAT_GROUP, ELEMENTS, ARMOUR_SLOTS,
    weightOf, rangeOf, sliceCount, tierSlice, score, keepsDrop, notYetFound, statOf, blockedBy,
    slotUnion, poolFor, baseModRoll, baseModAtFloor, linesAtDrop,
    mulberry32, pick, intBetween, pickBand, weightedPick,
  };
}
