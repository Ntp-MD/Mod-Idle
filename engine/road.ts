/**
 * The Road — the only travel-time system (`engine.json` `road`), walked in blocks (`road.walk`).
 *
 * A link is an object, not a "A ↔ B" string: it carries its own zone pair, its own kind
 * (ladder or branch), its own terrain and its own trip length, which the walk re-expresses as a
 * whole number of blocks. Nothing here derives a zone from the index of a link in the array — a
 * branch link joins zone i to zone i+2, so array order is not zone order any more.
 *
 * The walkable world is blocks: a block is `<link>#<n>`, it touches only the blocks either side of
 * it on its own link, and the ends of a link touch the settlements there. Nothing in this file knows
 * where anything is drawn, so the simulation cannot read a coordinate (M7 · X33).
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
  /** The link's id, which is also the map's `data-link` and every block's prefix. */
  id: string;
  /** How many blocks this link is walked in — `trip_min x 60 / walk.block_sec`. */
  blocks: number;
  paysPurse: boolean;
  text: string;
}

/**
 * One block of ground on a link (`engine.json` `road.walk`). A block is named `<link>#<n>`, so the
 * whole walkable world is named the way the link graph already is and no coordinate is ever read —
 * the sheet draws these where it likes and the simulation cannot tell (M7).
 */
export interface WalkBlock {
  id: string;
  linkIndex: number;
  /** 0-based position on the link, and how many blocks the link has. */
  n: number;
  total: number;
  terrain: string;
  /** The settlement the leg leaves from / arrives at, by the block's own position. */
  from: string;
  to: string;
}

export function createRoad(E: EngineData) {
  const R = E.road;
  const W = R.walk;
  /** The link id the Road graph, the map overlay and every block name share. */
  const linkId = (l: { zoneA: number; zoneB: number }) => `${l.zoneA}-${l.zoneB}`;

  const links: RoadLink[] = R.links.map((l, i) => ({
    index: i,
    a: l.a,
    b: l.b,
    zoneA: l.zoneA,
    zoneB: l.zoneB,
    kind: l.kind,
    terrain: l.terrain,
    trip_min: l.trip_min,
    id: linkId(l),
    blocks: (l.trip_min * 60) / W.block_sec,
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

  /** ---------------------------------------------------------------- the walk, in blocks */

  const blockSec = W.block_sec;
  const encounterGapBlocks = W.encounter_gap_blocks;
  const blocksFor = (index: number) => links[index].blocks;
  const blockId = (index: number, n: number) => `${links[index].id}#${n}`;

  /** Every block of every link, in link order then position. One flat list is the whole world. */
  const blocks: WalkBlock[] = [];
  for (const l of links) {
    for (let n = 0; n < l.blocks; n++) {
      blocks.push({ id: blockId(l.index, n), linkIndex: l.index, n, total: l.blocks, terrain: l.terrain, from: l.a, to: l.b });
    }
  }
  const blockById = new Map(blocks.map((b) => [b.id, b]));

  /**
   * The whole adjacency rule, as one function (`road.walk.adjacency_rule`): a block touches only
   * its own neighbours on its own link, and the two ends of a link touch the settlements there.
   * Nothing else is an edge, so no two blocks that do not touch can be stepped between.
   */
  function neighboursOf(index: number, n: number): string[] {
    const l = links[index];
    const out: string[] = [];
    if (n > 0) out.push(blockId(index, n - 1));
    if (n < l.blocks - 1) out.push(blockId(index, n + 1));
    return out;
  }

  /** The blocks on either side of a settlement: the first block of every link that leaves it. */
  const blocksAtSettlement = (settlement: string) =>
    blocks.filter((b) => b.n === 0 && b.from === settlement).map((b) => b.id);

  /** Every block of a link is reachable from every other only by walking the chain — proven below. */
  const chainIsWalkable = links.every((l) =>
    Array.from({ length: l.blocks - 1 }, (_, i) => neighboursOf(l.index, i).includes(blockId(l.index, i + 1))).every(Boolean));

  /**
   * The shortest chain of links from one settlement to another, walked breadth-first over the link
   * graph. Ties break on the array order of the links, so the same pair always plots the same path.
   * `[]` means the destination is the settlement you are already in; `null` means no route exists.
   */
  function routeLinks(from: string, to: string): number[] | null {
    if (from === to) return [];
    if (!linkByName(from).length) return null;
    const seen = new Set<string>([from]);
    const queue: { at: string; path: number[] }[] = [{ at: from, path: [] }];
    while (queue.length) {
      const { at, path } = queue.shift()!;
      for (const l of linkByName(at)) {
        if (seen.has(l.a) && seen.has(l.b)) continue;
        const next = path.concat(l.index);
        const arrived = l.a === at ? l.b : l.a;
        if (arrived === to) return next;
        seen.add(arrived);
        queue.push({ at: arrived, path: next });
      }
    }
    return null;
  }

  /** How many blocks a plotted route is walked over, and the encounters that ride on it. */
  const routeStats = (route: number[]) => ({
    blocks: route.reduce((t, i) => t + links[i].blocks, 0),
    encounters: route.reduce((t, i) => t + links[i].blocks / W.encounter_gap_blocks, 0),
  });

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
    walk: W, blockSec, encounterGapBlocks, blocksFor, blockId, blocks, blockById,
    neighboursOf, blocksAtSettlement, chainIsWalkable, routeLinks, routeStats,
    standingPerTripKills: R.standing_per_trip_kills, forfeitKills: R.forfeit_kills,
  };
}

export type Road = ReturnType<typeof createRoad>;
