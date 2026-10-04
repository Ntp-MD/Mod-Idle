import { loot, eng, E, BASES } from '../engine/client';
import type { Item, ModLine } from './types';

/**
 * A dropped piece, rolled with the same primitives tools/loot.js runs (loot.md §1):
 * slot → Rarity (Mod count) → Base (frame, weight, which Mods it may carry) → Item quality
 * (value range) → Tier (sub-range) → value.
 *
 * The Base tables come from `tools/data/bases.json`, which `node tools/bases.js --checks` gates
 * against `item-base.md`, so the game rolls from the same frame list the loot simulation scores.
 */

/**
 * Weapon weight is a column in `equipment-weapon.md`, imported into `bases.json` by
 * `tools/bases.js --write` (B13 · D-101) — every type carries one, so no weapon reads as weightless,
 * and an off-hand weapon counts ×`dual_wield_weight_mult` of its own type (`mod-pool.md`). The rule
 * itself lives in `engine/index.js`, because the cages have to weigh the opening character's sword
 * exactly the way the client does (D-108); this is the client's call site.
 */
export const weaponWeightOf = (name: string, slot = 'main hand'): number =>
  eng.weaponWeightOf(BASES, name, slot);

const basesFor = (slot: string) => BASES.bases.filter((b: any) => b.slot === slot);

export function rollDrop(rng: () => number, band: string, _weaponAspd?: number, forceQuality?: number): Item {
  const slot = loot.pick(rng, loot.SLOTS);
  const rarity = loot.pickBand(rng, loot.RARITY.map((r: any) => [r.name, r.chance]));
  const rarityRow = loot.RARITY.find((r: any) => r.name === rarity)!;
  const modCount = loot.intBetween(rng, rarityRow.mods[0], rarityRow.mods[1]);
  // offline results are AFK: same drops, but Item quality limited to the zone floor (save.md)
  const q = forceQuality != null ? forceQuality
    : loot.pickBand(rng, loot.QUALITY_MIX[band === 'high_full_lck' ? 'high' : band]);
  const u = rng();
  const tier = loot.tierSlice(u, 3);

  const weapon = slot === 'main hand' || slot === 'off hand' ? loot.pick(rng, BASES.weapons) : null;
  const frame = weapon ? null : loot.pick(rng, basesFor(slot));

  const pool: string[] = [];
  if (frame) {
    for (const id of frame.primary) pool.push(id);
    for (const id of frame.secondary) pool.push(id);
    if (frame.school && loot.GEAR_MOD_SLOTS.includes(slot)) pool.push(frame.school);
  } else {
    // the weapon pools come from equipment-slot-weapon.md through bases.json: the union pool, plus
    // the per-type swap (a magic type rolls Magic power where a physical one rolls Physical), plus
    // Elemental power flat, which every weapon carries as secondary
    const wp = BASES.weapon_pools['main hand'];
    const physical = weapon.damage !== 'magic';
    const primary = physical ? wp.Primary : ['magic_power_flat', 'magic_power', 'critical_chance', 'critical_damage'];
    pool.push(...primary, ...wp.Secondary, 'elemental_power_flat');
    if (slot === 'off hand' && weapon.name === 'off hand') pool.push(...(BASES.weapon_pools['off hand'].Shield || []));
  }

  const lines: ModLine[] = [];
  const taken = new Set<string>();
  let statLeft = Math.max(0, Math.min(2, modCount - pool.length));

  while (lines.length < modCount) {
    const remaining = pool.filter((id) => !taken.has(id));
    if (!remaining.length && statLeft <= 0) break;
    let id: string;
    if (remaining.length && (!statLeft || rng() < remaining.length / (remaining.length + statLeft))) {
      id = loot.weightedPick(rng, remaining.map((m) => ({ id: m, w: loot.weightOf(m, q) })));
    } else {
      id = 'stat_mod_flat';
      statLeft--;
    }
    if (taken.has(id)) continue;
    taken.add(id);
    const slice = loot.tierSlice(u, loot.sliceCount(id, q));
    const [lo, hi] = loot.rangeOf(id, q, slice);
    // an Elemental line always carries its Element: it is a stored value, never derived from a
    // resistance number, because crafting must not change it (item-rarity.md · save.md)
    lines.push({
      id,
      value: lo + Math.floor(rng() * (hi - lo + 1)),
      slice,
      element: id.startsWith('elemental_') ? loot.pick(rng, loot.ELEMENTS) : null,
    });
  }

  const baseWeight = weapon ? weaponWeightOf(weapon.name, slot) : frame!.weight;

  return {
    slot,
    base: weapon ? String(weapon.name) : frame!.name,
    weaponAspd: slot === 'main hand' && weapon ? weapon.weapon_aspd : undefined,    rarity: rarityRow.name,
    quality: loot.BAND_LABEL[q],
    tier: loot.TIER_NAME[tier],
    lines,
    q,
    weight: eng.weightAtQuality(baseWeight, q, BASES.quality_weight_multiplier),
  };
}

/** The value one line would reach on its best roll, so the UI can show headroom honestly. */
export const lineMax = (id: string) => loot.MAX_OF[id];

export const modName = (id: string) => loot.NAME_OF[id] || id;

void E;
