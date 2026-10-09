/**
 * Shared drop-roll primitives — the RNG, the line skeleton and the item-level value window
 * `tools/loot.ts` already runs, lifted out so the client rolls the same way.
 *
 * The unremovable head is fixed (line 1 the Frame Mod + the Bound pair), the Unbound lines are drawn from
 * the range `item_level.unbound_slots` publishes, and an item's level answers the other question: what
 * range its lines may roll in (item-level.md). The Bases a slot may carry live in `tools/data/bases.json`;
 * the client rolls only the Mod lines `mods.json` owns.
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

/**
 * A variant's lean (`loot.variant_lean` · `mob.variant_drops` `lean`). Redistributes probability MASS
 * among the three collectible streams — gear, herbs, junk — toward the one the variant names: the leaned
 * stream's share rises while the total expected drops/kill is preserved by renormalizing, so drops/hr and
 * the timeline do not move. `lean === 'none'` is the identity, which is what Elite and Boss carry. The
 * variant row is the only author — there is no player control on top of it. Stones ride the elite/boss
 * lines and are not a category.
 */
export function leanReweight(
  p: { gear: number; herb: number; junk: number },
  lean: 'none' | 'gear' | 'herb' | 'junk',
  shiftPct: number,
): { gear: number; herb: number; junk: number } {
  if (lean === 'none') return { ...p };
  const total = p.gear + p.herb + p.junk;
  if (!(total > 0)) return { ...p };
  const s = shiftPct / 100;
  const f = (k: 'gear' | 'herb' | 'junk') => (k === lean ? 1 + s : 1 - s);
  const scaled = p.gear * f('gear') + p.herb * f('herb') + p.junk * f('junk');
  const norm = total / scaled; // renormalize → Σ stays exactly `total`
  const clamp = (x: number) => Math.max(0, Math.min(1, x));
  return {
    gear: clamp(p.gear * f('gear') * norm),
    herb: clamp(p.herb * f('herb') * norm),
    junk: clamp(p.junk * f('junk') * norm),
  };
}

export function createLoot(E: EngineData, MODS: ModsData) {
  // The earring is appended last (index 12) on purpose: the doll grid, `element.test.ts` and the
  // gear array address the other slots by position, so appending keeps every existing index stable
  // (— the order is cosmetic in the filter panel only).
  const SLOTS = ['helmet', 'chest', 'pant', 'boots', 'belt', 'gloves', 'ring', 'ring', 'amulet', 'cape', 'main hand', 'off hand', 'earring'];
  const GEAR_MOD_SLOTS = ['helmet', 'chest', 'pant', 'boots', 'gloves'];
  const GEAR_MODS = ['armour_flat', 'evasion_flat', 'energy_shield_flat'];
  const TIER_NAME = { 0: 'T1', 1: 'T2', 2: 'T3' };
  const BAND_LABEL = ['low', 'mid', 'high'];
  // The window's thirds, best last: the TOP third is the rarest, so a good roll is a chance and not a
  // formality, and the bottom third is the common outcome (item-level.md). T1 names the top.
  const TIER_SPLIT = [0.50, 0.83];
  const WINDOW_THIRDS = 3;

  const WEIGHT_BY_ID: Record<string, number | number[]> = {};
  for (const row of E.mod_weights.rows) for (const id of row.ids) WEIGHT_BY_ID[id] = row.weight;
  const RW = E.mod_weights.role_weights;
  const MAX_OF: Record<string, number> = {}, NAME_OF: Record<string, string> = {}, BANDS_OF: Record<string, number[][][]> = {};
  for (const m of MODS.mods) { MAX_OF[m.id] = m.max; NAME_OF[m.id] = m.name; BANDS_OF[m.id] = m.bands; }

  /** The Mod weight for one line at one band (the Flat group steps by band). */
  function weightOf(id: string, q: number) {
    const w = WEIGHT_BY_ID[id];
    return Array.isArray(w) ? w[q] : w;
  }

  /** How far through its band's level span a level sits — 0 at the span's start, 1 at its end. */
  function spanT(ilvl: number, q: number) {
    const sp = (E.item_level.spans || [])[q] || { from: 1, to: 1 };
    const span = Math.max(1, (sp.to || 1) - (sp.from || 1));
    return Math.min(1, Math.max(0, ((ilvl == null ? sp.from : ilvl) - sp.from) / span));
  }

  /**
   * The value window one Mod line publishes at one item level inside one band (item-level.md). The
   * ceiling is the band's own top and the floor climbs from the band below — so a mid-band piece
   * starts able to roll the low band's floor and ends above it — and a level past its band's span
   * clamps, which is what keeps the later loops on the band the zone label names.
   */
  function windowAt(id: string, ilvl: number, q: number): [number, number] {
    const bands = BANDS_OF[id] || [];
    const band = bands[q] || bands[0];
    if (!band) throw new Error(`no value window for mod "${id}" (band ${q})`);
    const lo = band[0][0];
    const hi = band[band.length - 1][1];
    const below = bands[q - 1];
    const floorFrom = below ? below[0][0] : lo;
    return [Math.round(floorFrom + (lo - floorFrom) * spanT(ilvl, q)), hi];
  }

  /**
   * One third of the window — tier 0 the top (T1), tier 2 the bottom (T3). Thirds are uniform for every
   * Mod, so the skew is one rule rather than a per-Mod ladder, and `tierSlice` spends the weights on it.
   */
  function rangeOf(id: string, ilvl: number, q: number, tier: number): [number, number] {
    const [lo, hi] = windowAt(id, ilvl, q);
    const size = Math.ceil((hi - lo + 1) / WINDOW_THIRDS);
    const topLo = Math.max(lo, hi - size + 1);
    if (tier <= 0) return [topLo, hi];
    const midHi = Math.max(lo, topLo - 1);
    const midLo = Math.max(lo, midHi - size + 1);
    if (tier === 1) return [midLo, Math.max(midLo, midHi)];
    return [lo, Math.max(lo, midLo - 1)];
  }

  /** How many positions a window publishes. Uniform now — the thirds are every Mod's ladder. */
  const sliceCount = () => WINDOW_THIRDS;

  const FLAT_GROUP = new Set(E.mod_weights.flat_group);
  const ELEMENTS = E.elements.order;

  // ---- the rollable pool and line 1 (item-base.md)

  const STAT_ID = 'stat_mod_flat';
  // The Stat Mod slot (item-base.md · equipment-slot-pools.md): one line, and the piece may hold it as
  // a single Core stat (`stat_mod_flat`) or as all seven at once (`all_stat_flat`). The
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
   * The piece's rollable pool: the slot's union of Bases plus the lines the slot adds on its
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
      // the armour slots' line-1 lines are also rollable on the other lines: the three flat defence
      // lines a frame may carry, so a frame that carries one can still find another on a later line
      if (ARMOUR_SLOTS.includes(slot)) for (const id of (BASES?.frame_mod?.defence || [])) push(id, RW.secondary);
      if (slot === 'off hand' && frame?.family) {
        for (const id of (wp['off hand']?.[frame.family] || [])) push(id, RW.secondary);
      }
    }
    for (const id of STAT_IDS) push(id, RW.stat_mod);
    return out;
  }

  /**
   * The pool of one frame with the odds each line has of filling a pool slot, at one Item quality band.
   * It is the same `role x weightOf` product `weightedPick` draws from, normalised here, so a table can
   * print the chances without becoming a second author of the weight model.
   */
  function poolChances(BASES: any, slot: string, frame: any, weapon: any, q: number) {
    const weighted = poolFor(BASES, slot, frame, weapon).map((e) => ({ id: e.id, w: e.role * (weightOf(e.id, q) ?? 1) }));
    const total = weighted.reduce((sum, e) => sum + e.w, 0) || 1;
    return weighted.map((e) => ({ id: e.id, chance: e.w / total }));
  }

  /**
   * Ids the pool must drop because the piece already holds a family member whose slot allows only one
   *: the Stat Mod slot is a single line, so once any `STAT_IDS` id is taken every sibling is
   * blocked. A no-op for every mod outside the family. Callers spread the result over `taken`.
   */
  function blockedBy(taken: Set<string>): Set<string> {
    const out = new Set<string>();
    if (STAT_IDS.some((id) => taken.has(id))) for (const id of STAT_IDS) out.add(id);
    return out;
  }

  /**
   * Line 1 — the Frame Mod. An armour frame NAMES the flat defence lines it carries (one, two or all
   * three of Armour flat, Evasion flat, Energy Shield flat — the seven non-empty combinations the
   * frames of a slot cover without repeating one, so the frame's own name tells the player what line 1
   * is); a weapon forces every Mod its type lists; an off-hand frame carries its family's row; belt /
   * ring / amulet / earring draw one from the slot's pool. A multi-line Frame Mod shares one budget, which
   * `value_scale` applies. All of it is ONE line, the first Mod in `id` and the rest in `extra`, so the
   * line skeleton's counts and the unremovable floor stay fixed. `u` is the item's one Tier draw,
   * shared with the Unbound lines exactly as `tools/loot.ts` rolls them.
   */
  function frameModRoll(BASES: any, slot: string, frame: any, weapon: any, rng: Rng, ilvl: number, q: number, u: number): any[] {
    const BM = E.loot.frame_mod;
    const scale = (n: number) => BM.value_scale[String(n)] ?? 1;
    const ids: string[] = [];
    if (weapon) {
      // a weapon (main hand, or a dual-wielded off hand) forces every Mod its own type lists — and a
      // main hand carries a FRAME (A10), whose own list wins over its type's when it has one
      for (const id of (frame?.frame_mod || BASES?.frame_mod?.weapons?.[weapon.name] || [])) ids.push(id);
    } else if (ARMOUR_SLOTS.includes(slot) && frame?.base_lines?.length) {
      // the frame names the flat defence lines its Frame Mod carries (one, two or all three, the seven
      // combinations the roster covers without repeating one) — never a random draw, and a multi-line
      // Frame Mod shares one budget, which `scale` applies below.
      for (const id of frame.base_lines) ids.push(id);
    } else if (slot === 'off hand' && frame?.family) {
      // an off-hand frame carries its family's pair (a Shield the block line, a Book the magic pair)
      for (const id of (BASES?.frame_mod?.off_hand?.[frame.family] || [])) ids.push(id);
    } else if ((BASES?.frame_mod?.drawn_line1_slots || []).includes(slot)) {
      const pool = poolFor(BASES, slot, frame, null).filter((e) => !STAT_IDS.includes(e.id));
      if (pool.length) ids.push(weightedPick(rng, pool.map((e) => ({ id: e.id, w: e.role * weightOf(e.id, q) }))));
    }
    const k = scale(ids.length);
    const roll = (id: string) => {
      const slice = tierSlice(u);
      const [lo, hi] = rangeOf(id, ilvl, q, slice);
      return { id, value: Math.max(1, Math.round((lo + Math.floor(rng() * (hi - lo + 1))) * k)), slice };
    };
    if (!ids.length) return [];
    const first = roll(ids[0]);
    // an Elemental line carries its Element at drop, exactly as a Unbound line does
    return [{
      id: first.id, value: first.value, slice: first.slice,
      element: first.id.startsWith('elemental_') ? pick(rng, ELEMENTS) : null,
      ...(ids.length > 1 ? { extra: ids.slice(1).map((id) => { const r = roll(id); return { id: r.id, value: r.value }; }) } : {}),
    }];
  }

  /**
   * The lines a dropped piece carries: line 1 + the Bound pair + the Unbound lines, whose count is drawn
   * inside the published range at drop (`item_level.unbound_slots`). Both the client and `tools/loot.ts`
   * call this one function, so a piece and its simulation cannot disagree on how wide a drop is.
   */
  function linesAtDrop(rng: Rng) {
    const L = E.item_level;
    return L.frame_mod_slots + L.bound_slots + intBetween(rng, L.unbound_slots.min, L.unbound_slots.max);
  }

  /**
   * Line 1 at its floor, for a piece restored from a pre-skeleton save or handed over at minute one. The
   * same Mods a fresh roll would force, but at the lowest value of the window with no RNG at all, so two
   * loads of one save agree to the digit. Still one line, the extra Mods in `extra`.
   */
  function frameModAtFloor(BASES: any, slot: string, frame: any, weapon: any, ilvl: number, q: number): any[] {
    const BM = E.loot.frame_mod;
    const scale = (n: number) => BM.value_scale[String(n)] ?? 1;
    const ids: string[] = [];
    if (weapon) for (const id of (BASES?.frame_mod?.weapons?.[weapon.name] || [])) ids.push(id);
    else if (ARMOUR_SLOTS.includes(slot) && frame?.base_lines?.length) for (const id of frame.base_lines) ids.push(id);
    else if (slot === 'off hand' && frame?.family) for (const id of (BASES?.frame_mod?.off_hand?.[frame.family] || [])) ids.push(id);
    else if ((BASES?.frame_mod?.drawn_line1_slots || []).includes(slot)) {
      const pool = poolFor(BASES, slot, frame, null).filter((e) => !STAT_IDS.includes(e.id));
      if (pool.length) ids.push(pool[0].id);
    }
    if (!ids.length) return [];
    const k = scale(ids.length);
    const value = (id: string) => Math.max(1, Math.round(windowAt(id, ilvl, q)[0] * k));
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
      // a Frame Mod line's extra Mods are part of the same line and count too 
      for (const x of (l.extra || [])) s += weightOf(x.id, item.q) * (x.value / MAX_OF[x.id]);
    }
    return s;
  }

  /**
   * The bag filter: keep a drop only when it beats the piece worn in the same slot by more than
   * noise — `upgrade_margin_pct` — or when it carries an Element the player has no answer to
   * (loot.md §4). Anything else dissolves for 1 Value stone, never for gold (`economy.md`).
   *
   * The last argument is one slot's configured thresholds (`save.md`): a raised margin and the Element
   * keep-list switch. Every value falls back to the published rule, so a caller that configures nothing
   * gets exactly the behaviour `tools/loot.ts` measures.
   */
  function keepsDrop(item: any, wornScore: number | undefined, knownElements: Set<string> | undefined, marginPct: number, rule?: any) {
    const o = rule || {};
    const margin = o.margin_pct != null ? o.margin_pct / 100 : marginPct;
    const keepElement = o.keep_missing_element !== false;
    const s = score(item);
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
   * once instead of one, so it carries no `rolls` and bakes nothing.
   */
  const statOf = (id: string, rng: Rng): string | undefined => {
    const rolls = STAT_ROLLS_OF[id];
    return rolls ? pick(rng, rolls) : undefined;
  };

  /**
   * Which third of the window this roll lands in. The top third is the rarest and the bottom the common
   * outcome (item-level.md): the weights are the one skew every Mod shares, so "best is never free" is a
   * property of the roll rather than of a per-Mod ladder.
   */
  function tierSlice(u: number) {
    if (u < TIER_SPLIT[0]) return 2;
    if (u < TIER_SPLIT[1]) return 1;
    return 0;
  }

  return {
    SLOTS, GEAR_MOD_SLOTS, STAT_IDS, GEAR_MODS, STAT_ROLLS, TIER_SPLIT, TIER_NAME,
    BAND_LABEL, RW, MAX_OF, NAME_OF, BANDS_OF, WEIGHT_BY_ID, FLAT_GROUP, ELEMENTS, ARMOUR_SLOTS,
    weightOf, windowAt, spanT, rangeOf, sliceCount, tierSlice, score, keepsDrop, notYetFound, statOf, blockedBy,
    slotUnion, poolFor, poolChances, frameModRoll, frameModAtFloor, linesAtDrop,
    mulberry32, pick, intBetween, pickBand, weightedPick,
  };
}
