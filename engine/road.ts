/**
 * The Road — the only travel-time system (`engine.json` `road`).
 *
 * A link is an object, not a "A ↔ B" string: it carries its own zone pair, its kind
 * (ladder or branch), its terrain and its own trip length. Nothing here derives a zone from the
 * index of a link in the array — a branch link joins zone i to zone i+2, so array order is not
 * zone order any more (owner/travel-route-combat.md section 4).
 *
 * Online an encounter rolls the link's own terrain row; offline it rolls the untilted base table
 * (`encounters[].weight`). That split is what keeps an away period from routing into
 * mountain country and paying out at the tilted ambush rate (section 6).
 */

import type { EngineData, Rng } from './types.ts';

export interface RoadLink {
  index: number;
  a: string;
  b: string;
  zoneA: number;
  zoneB: number;
  kind: 'ladder' | 'branch';
  terrain: string;
  trip_min: number;
  paysPurse: boolean;
  text: string;
}

export function createRoad(E: EngineData) {
  const R = E.road;

  const links: RoadLink[] = R.links.map((l, i) => ({
    index: i,
    a: l.a,
    b: l.b,
    zoneA: l.zoneA,
    zoneB: l.zoneB,
    kind: l.kind,
    terrain: l.terrain,
    trip_min: l.trip_min,
    paysPurse: l.kind === 'ladder',
    text: `${l.a} ↔ ${l.b}`,
  }));

  const linkByName = (settlementId: string) => links.filter((l) => l.a === settlementId || l.b === settlementId);
  const linkBetween = (a: string, b: string) =>
    links.find((l) => (l.a === a && l.b === b) || (l.a === b && l.b === a)) || null;
  const zonePair = (index: number) => ({ a: links[index].zoneA, b: links[index].zoneB });

  const KINDS = Object.entries(R.encounters).map(([id, e]) => ({
    id,
    weight: e.weight,
    mobs: e.mobs,
    resolve: e.resolve,
    win: e.win,
    loss: e.loss,
    hasMobs: e.mobs !== 'none',
  }));
  const KIND_IDS = KINDS.map((k) => k.id);

  /** `encounters[].weight` is the base table and the plain average of the terrain rows, so the
   * untilted row is read, never typed a second time. */
  const baseWeights: Record<string, number> = {};
  for (const k of KINDS) baseWeights[k.id] = k.weight;
  const totalWeight = KINDS.reduce((t, k) => t + k.weight, 0);

  /** A terrain row must name every kind; a missing kind falls back to its base weight. */
  function weightsFor(terrainId: string | null | undefined): Record<string, number> {
    if (!terrainId || !R.terrain[terrainId]) return { ...baseWeights };
    const row = R.terrain[terrainId];
    const w: Record<string, number> = {};
    for (const id of KIND_IDS) w[id] = row[id] ?? baseWeights[id];
    return w;
  }

  function rollEncounter(rng: Rng, terrainId: string | null = null) {
    const w = weightsFor(terrainId);
    const sum = KIND_IDS.reduce((t, id) => t + w[id], 0);
    let r = rng() * sum;
    for (const k of KINDS) {
      r -= w[k.id];
      if (r <= 0) return { ...k, weight: w[k.id] };
    }
    const last = KINDS[KINDS.length - 1];
    return { ...last, weight: w[last.id] };
  }

  const tripSecFor = (index: number) => links[index].trip_min * 60;
  const encountersFor = (index: number) => links[index].trip_min * R.encounters_per_min;
  const encounterGapSec = 60 / R.encounters_per_min;

  /** Only the 8 ladder links pay, so the mint cap is unchanged by the branch links (section 4). */
  const purseCapPerDay = links.filter((l) => l.paysPurse).length * R.purse_gold;
  const purseGoldFor = (index: number) => (links[index].paysPurse ? R.purse_gold : 0);

  return {
    R, links, linkByName, linkBetween, zonePair, tripSecFor, encountersFor, encounterGapSec,
    KINDS, KIND_IDS, baseWeights, totalWeight, weightsFor, rollEncounter,
    terrainIds: Object.keys(R.terrain), terrainRows: R.terrain,
    purseGold: R.purse_gold, purseCapPerDay, purseGoldFor, purseOncePerLinkPerDay: R.purse_once_per_link_per_day,
    chestOncePerLinkPerDay: R.chest_once_per_link_per_day,
    circuit: R.circuit,
    standingPerTripKills: R.standing_per_trip_kills, forfeitKills: R.forfeit_kills,
  };
}

export type Road = ReturnType<typeof createRoad>;
