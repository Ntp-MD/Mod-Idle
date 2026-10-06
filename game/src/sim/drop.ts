import { loot, eng, E, BASES } from '../engine/client';
import type { Item, ModLine } from './types';

/**
 * A dropped piece, rolled with the same primitives tools/loot.ts runs (loot.md §1):
 * slot → Base (frame, weight) → Rarity (how many of the 7 lines are filled) → Item quality
 * (value range) → Tier (sub-range) → value.
 *
 * The skeleton is seven lines (item-base.md): line 1 is the Base Mod, lines 2-3 the Legacy
 * pair, lines 4-7 the Random lines a Rarity fills at drop. The Base tables come from
 * `tools/data/bases.json`, which `node tools/bases.ts --checks` gates against `item-base.md`, so the
 * game rolls from the same frame list the loot simulation scores.
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

export function rollDrop(rng: () => number, band: string, _weaponAspd?: number, forceQuality?: number): Item {
  const slot = loot.pick(rng, loot.SLOTS);
  const chosen = rollBase(rng, slot);
  const frame = chosen.frame || null;
  const weapon = chosen.weapon || null;
  const rarity = loot.pickBand(rng, loot.RARITY.map((r: any) => [r.name, r.chance]));
  const rarityRow = loot.RARITY.find((r: any) => r.name === rarity)!;
  // offline results are AFK: same drops, but Item quality limited to the zone floor (save.md)
  const q = forceQuality != null ? forceQuality
    : loot.pickBand(rng, loot.QUALITY_MIX[band === 'high_full_lck' ? 'high' : band]);
  const u = rng(); // one Tier draw per item, shared by line 1 and every Random line

  // line 1 is the Base Mod: it is rolled first, off the frame, before any Random line
  const lines: ModLine[] = loot.baseModRoll(BASES, slot, frame, weapon, rng, q, u);
  const taken = new Set<string>(lines.flatMap((l: any) => [l.id, ...((l.extra || []).map((x: any) => x.id))]));
  const pool = loot.poolFor(BASES, slot, frame, weapon).filter((e: any) => !taken.has(e.id));
  const target = loot.linesAtDrop(rarityRow.name);

  while (lines.length < target) {
    const blocked = loot.blockedBy(taken);
    const remaining = pool.filter((e: any) => !taken.has(e.id) && !blocked.has(e.id));
    if (!remaining.length) break; // an off hand simply publishes fewer lines (item-base.md)
    const id = loot.weightedPick(rng, remaining.map((e: any) => ({ id: e.id, w: e.role * loot.weightOf(e.id, q) })));
    taken.add(id);
    const slice = loot.tierSlice(u, loot.sliceCount(id, q));
    const [lo, hi] = loot.rangeOf(id, q, slice);
    // a Stat Mod bakes the Core stat it feeds here, at drop, the way a PoE implicit carries its own
    // stat; every other id leaves `stat` undefined (`mods.json` `rolls`)
    const stat = loot.statOf(id, rng);
    // an Elemental line always carries its Element: it is a stored value, never derived from a
    // resistance number, because crafting must not change it (item-rarity.md · save.md)
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
    weaponAspd: slot === 'main hand' && weapon ? weapon.weapon_aspd : undefined,
    rarity: rarityRow.name,
    quality: loot.BAND_LABEL[q],
    tier: loot.TIER_NAME[loot.tierSlice(u, 3)],
    lines,
    q,
    weight: eng.weightAtQuality(baseWeight, q, BASES.quality_weight_multiplier),
  };
}

/** The value one line would reach on its best roll, so the UI can show headroom honestly. */
export const lineMax = (id: string) => loot.MAX_OF[id];

export const modName = (id: string) => loot.NAME_OF[id] || id;

void E;
