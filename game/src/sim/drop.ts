import { loot, eng, E, BASES } from '../engine/client';
import type { Item } from './types';

/**
 * A dropped piece, rolled with the same primitives tools/loot.ts runs (loot.md §1):
 * slot → Base (frame, weight) → the item's level (the value window) → the third of the window the roll
 * lands in → value.
 *
 * The line skeleton (item-base.md): line 1 is the Frame Mod, lines 2-3 the Bound pair, then the Normal
 * lines the drop drew — `item_level.unbound_slots` publishes the range, so two pieces of one band and
 * level can differ in width. The `mods_added_cap` Add stones each widen the piece by one more Normal
 * line, up to `crafted_max` in all. The Base tables come from `tools/data/bases.json`, which
 * `node tools/bases.ts --checks` gates, so the game rolls from the same frame list the loot simulation
 * scores.
 */

/**
 * Weapon weight is a column in `equipment-weapon.md`, imported into `bases.json` by
 * `tools/bases.ts --write` (B13) — every type carries one, so no weapon reads as weightless,
 * and an off-hand weapon counts ×`dual_wield_weight_mult` of its own type (`mod-pool.md`). The rule
 * itself lives in `engine/index.ts`, because the cages have to weigh the opening character's sword
 * exactly the way the client does; this is the client's call site.
 */
export const weaponWeightOf = (name: string, slot = 'main hand'): number =>
  eng.weaponWeightOf(BASES, name, slot);

/**
 * Step 2 — the frame inside the rolled slot (loot.md §1 · item-base.md) and the lines the piece
 * carries: both live in `engine/loot.ts`, which the loot cage runs too, so a drop the game rolls and
 * a drop the simulation scores come off one builder.
 */
export function itemFromFrame(rng: () => number, slot: string, frame: any, weapon: any, ilvl: number, q: number): Item {
  const { lines, u } = loot.buildLines(BASES, { slot, frame, weapon, ilvl, q }, rng);
  const baseWeight = weapon ? weaponWeightOf(weapon.name, slot) : frame.weight;

  return {
    slot,
    base: weapon ? String(weapon.name) : frame.name,
    ilvl,
    weaponAspd: slot === 'main hand' && weapon ? E.weapons.find((row: any) => row.name === weapon.name)?.weapon_aspd : undefined,
    quality: loot.BAND_LABEL[q],
    tier: loot.TIER_NAME[loot.tierSlice(u)],
    lines,
    q,
    weight: eng.weightAtQuality(baseWeight, q, BASES.quality_weight_multiplier),
    // how many Unbound lines it dropped with: the +2 Add cap is net against this
    unbound_at_drop: lines.length - (E.item_level.frame_mod_slots + E.item_level.bound_slots),
  };
}

export function rollDrop(rng: () => number, band: string, ilvl: number, _weaponAspd?: number, carriesWeapon = true): Item {
  const slots = carriesWeapon ? loot.SLOTS : loot.SLOTS.filter((slot: string) => slot !== 'main hand' && slot !== 'off hand');
  const slot = loot.pick(rng, slots);
  const chosen = loot.rollBase(rng, BASES, slot);
  const frame = chosen.frame || null;
  const weapon = chosen.weapon || null;
  // the band is what the drop source declares — the weight half and the label; the level is what the
  // window's floor and ceiling are read at (`item-level.md`)
  const q = eng.qualityIndexOf(band);
  return itemFromFrame(rng, slot, frame, weapon, ilvl, q);
}

export const modName = (id: string) => loot.NAME_OF[id] || id;
