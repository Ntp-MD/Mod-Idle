/**
 * Shared drop-roll primitives — the RNG and the Rarity / Item quality / Tier mechanics
 * `tools/loot.js` already runs, lifted out so the client rolls the same way.
 *
 * Rarity = Mod count · Item quality = value range · Tier = sub-range (AGENT.md §2 — never mix them).
 * The Bases a slot may carry are still parsed from `item-base.md` on the cage side; the client
 * rolls only the Mod lines that `mods.json` owns (harness/todo.md B6 will move the Bases into data).
 */

/** Seeded, reproducible, no top-level await: a save cannot be rerolled for a better outcome. */
export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];
export const intBetween = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));
export const pickBand = (rng, table) => {
  const r = rng();
  let acc = 0;
  for (const [band, chance] of table) { acc += chance; if (r < acc) return band; }
  return table[table.length - 1][0];
};

export function weightedPick(rng, entries) {
  let total = 0;
  for (const e of entries) total += e.w;
  let r = rng() * total;
  for (const e of entries) { r -= e.w; if (r <= 0) return e.id; }
  return entries[entries.length - 1].id;
}

export function createLoot(E, MODS) {
  const SLOTS = ['helmet', 'chest', 'pant', 'boots', 'belt', 'gloves', 'ring', 'ring', 'amulet', 'cape', 'main hand', 'off hand'];
  const GEAR_MOD_SLOTS = ['helmet', 'chest', 'pant', 'boots', 'gloves'];
  const STAT_MODS = ['stat_mod_flat'];
  const GEAR_MODS = ['armour_flat', 'evasion_flat', 'energy_shield_flat'];
  // Rarity is the Mod count (loot.md §1 · item-rarity.md)
  const RARITY = [{ name: 'Common', chance: 0.82, mods: [2, 3] }, { name: 'Rare', chance: 0.18, mods: [3, 5] }];
  const TIER_SPLIT = [0.17, 0.50]; // T1 17% · T2 33% · T3 50% (item-rarity.md)
  const QUALITY_MIX = { low: [[0, 1]], mid: [[0, 0.55], [1, 0.45]], high: [[1, 0.40], [2, 0.60]] };
  const TIER_NAME = { 0: 'T1', 1: 'T2', 2: 'T3' };
  const BAND_LABEL = ['low', 'mid', 'high'];

  const WEIGHT_BY_ID = {};
  for (const row of E.mod_weights.rows) for (const id of row.ids) WEIGHT_BY_ID[id] = row.weight;
  const RW = E.mod_weights.role_weights;
  const MAX_OF = {}, NAME_OF = {}, BANDS_OF = {};
  for (const m of MODS.mods) { MAX_OF[m.id] = m.max; NAME_OF[m.id] = m.name; BANDS_OF[m.id] = m.bands; }

  /** The Mod weight for one line at one Item quality band (the Flat group steps by band). */
  function weightOf(id, q) {
    const w = WEIGHT_BY_ID[id];
    return Array.isArray(w) ? w[q] : w;
  }

  /** min..max of one Mod line at one Item quality band and one Tier slice. */
  function rangeOf(id, q, tier) {
    const band = (BANDS_OF[id] || [])[q];
    const b = band && band[tier];
    if (!b) throw new Error(`no value range for mod "${id}" (quality ${q}, tier ${tier})`);
    return [b[0], b[1]];
  }

  /** How many Tier slices this Mod actually publishes at this Item quality (2 or 3). */
  const sliceCount = (id, q) => ((BANDS_OF[id] || [])[q] || []).length || 1;

  const FLAT_GROUP = new Set(E.mod_weights.flat_group);
  const ELEMENTS = E.elements.order;

  /** The score the filter compares: Σ weight(line) × value ÷ Total (loot.md §4). */
  function score(item) {
    let s = 0;
    for (const l of item.lines) s += weightOf(l.id, item.q) * (l.value / MAX_OF[l.id]);
    return s;
  }

  /**
   * The bag filter: keep a drop only when it beats the piece worn in the same slot by more than
   * noise — `upgrade_margin_pct` — or when it carries an Element the player has no answer to
   * (loot.md §4). Anything else dissolves for 1 Reroll value stone, never for gold (`economy.md`).
   *
   * The last argument is one slot's configured thresholds (`save.md`): a raised margin, a Rarity
   * floor and the Element keep-list switch. Every value falls back to the published rule, so a
   * caller that configures nothing gets exactly the behaviour `tools/loot.js` measures.
   */
  function keepsDrop(item, wornScore, knownElements, marginPct, rule) {
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
      && item.lines.some((l) => l.element && !(knownElements || new Set()).has(l.element));
    if (fresh) return { keep: true, reason: 'element', score: s, margin };
    return { keep: false, reason: 'dissolve', score: s, margin };
  }

  /**
   * The "Elements/slots the player has not yet found" list (loot.md §4 · save.md): an Element no
   * worn piece resists is still a keep reason, and a hole in the equip list is still unfound.
   */
  function notYetFound(gear) {
    const covered = new Set();
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
   * Which Tier slice of a Mod this roll lands on. Mods carry 2 or 3 slices per Item quality
   * band, and the published weights are per Tier (T1 17% · T2 33% · T3 50%), so a 2-slice Mod
   * spends its T2 and T3 weights on its better slice instead of dropping them.
   */
  function tierSlice(u, slices) {
    if (slices <= 1) return 0;
    if (u < TIER_SPLIT[0]) return 0;
    if (u < TIER_SPLIT[1]) return Math.round((slices - 1) / 2);
    return slices - 1;
  }

  return {
    SLOTS, GEAR_MOD_SLOTS, STAT_MODS, GEAR_MODS, RARITY, TIER_SPLIT, QUALITY_MIX, TIER_NAME,
    BAND_LABEL, RW, MAX_OF, NAME_OF, BANDS_OF, WEIGHT_BY_ID, FLAT_GROUP, ELEMENTS,
    weightOf, rangeOf, sliceCount, tierSlice, score, keepsDrop, notYetFound,
    mulberry32, pick, intBetween, pickBand, weightedPick,
  };
}
