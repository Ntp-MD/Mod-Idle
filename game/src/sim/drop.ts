import { loot, eng, E, BASES } from '../engine/client';
import type { Item, ModLine } from './types';

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

const basesFor = (slot: string) => BASES.bases.filter((b: any) => b.slot === slot);

/** One option out of a weighted list — the frame / weapon pick at step 2. */
function pickWeighted(rng: () => number, options: any[]): any {
  const total = options.reduce((s: number, o: any) => s + o.weight, 0);
  let r = rng() * total;
  for (const o of options) { r -= o.weight; if (r <= 0) return o; }
  return options[options.length - 1];
}

/**
 * Step 2 — the frame inside the rolled slot (loot.md §1 · item-base.md). Main hand picks a
 * weapon type by weight; the off hand picks equally among its three frames (Buckler · Kite Shield ·
 * Grimoire) and one dual-wielded weapon, so a shield or a book can actually drop; every other slot
 * picks a Base by weight.
 */
function rollBase(rng: () => number, slot: string): { frame?: any; weapon?: any } {
  if (slot === 'main hand') {
    return { weapon: pickWeighted(rng, BASES.weapons.map((w: any) => ({ value: w, weight: 1 }))).value };
  }
  if (slot === 'off hand') {
    const dual = BASES.weapons.filter((w: any) => w.dual_wield);
    const options = [
      ...basesFor('off hand').map((f: any) => ({ kind: 'frame', value: f, weight: 1 })),
      ...(dual.length ? [{ kind: 'weapon', value: loot.pick(rng, dual), weight: 1 }] : []),
    ];
    const chosen = pickWeighted(rng, options);
    return chosen.kind === 'frame' ? { frame: chosen.value } : { weapon: chosen.value };
  }
  return { frame: pickWeighted(rng, basesFor(slot).map((b: any) => ({ value: b, weight: 1 }))).value };
}

export function rollDrop(rng: () => number, band: string, ilvl: number, _weaponAspd?: number): Item {
  const slot = loot.pick(rng, loot.SLOTS);
  const chosen = rollBase(rng, slot);
  const frame = chosen.frame || null;
  const weapon = chosen.weapon || null;
  // the band is what the drop source declares — the weight half and the label; the level is what the
  // window's floor and ceiling are read at (`item-level.md`)
  const q = eng.qualityIndexOf(band);
  const u = rng(); // one Tier draw per item, shared by line 1 and every Unbound line

  // line 1 is the Frame Mod: it is rolled first, off the frame, before any Unbound line
  const lines: ModLine[] = loot.frameModRoll(BASES, slot, frame, weapon, rng, ilvl, q, u);
  const taken = new Set<string>(lines.flatMap((l: any) => [l.id, ...((l.extra || []).map((x: any) => x.id))]));
  const pool = loot.poolFor(BASES, slot, frame, weapon).filter((e: any) => !taken.has(e.id));
  const target = loot.linesAtDrop(rng);

  while (lines.length < target) {
    const blocked = loot.blockedBy(taken);
    const remaining = pool.filter((e: any) => !taken.has(e.id) && !blocked.has(e.id));
    if (!remaining.length) break; // an off hand simply publishes fewer lines (item-base.md)
    const id = loot.weightedPick(rng, remaining.map((e: any) => ({ id: e.id, w: e.role * loot.weightOf(e.id, q) })));
    taken.add(id);
    const slice = loot.tierSlice(u);
    const [lo, hi] = loot.rangeOf(id, ilvl, q, slice);
    // a Stat Mod bakes the Core stat it feeds here, at drop, the way a PoE implicit carries its own
    // stat; every other id leaves `stat` undefined (`mods.json` `rolls`)
    const stat = loot.statOf(id, rng);
    // an Elemental line always carries its Element: it is a stored value, never derived from a
    // resistance number, because crafting must not change it (item-level.md · save.md)
    lines.push({
      id,
      value: loot.intBetween(rng, lo, hi),
      slice,
      element: id.startsWith('elemental_') ? loot.pick(rng, loot.ELEMENTS) : null,
      ...(stat ? { stat } : {}),
    });
  }

  const baseWeight = weapon ? weaponWeightOf(weapon.name, slot) : frame!.weight;

  return {
    slot,
    base: weapon ? String(weapon.name) : frame!.name,
    ilvl,
    weaponAspd: slot === 'main hand' && weapon ? weapon.weapon_aspd : undefined,
    quality: loot.BAND_LABEL[q],
    tier: loot.TIER_NAME[loot.tierSlice(u)],
    lines,
    q,
    weight: eng.weightAtQuality(baseWeight, q, BASES.quality_weight_multiplier),
    // how many Unbound lines it dropped with: the +2 Add cap is net against this
    unbound_at_drop: lines.length - (E.item_level.frame_mod_slots + E.item_level.bound_slots),
  };
}

/** The value one line would reach on its best roll, so the UI can show headroom honestly. */
export const lineMax = (id: string) => loot.MAX_OF[id];

export const modName = (id: string) => loot.NAME_OF[id] || id;

void E;
