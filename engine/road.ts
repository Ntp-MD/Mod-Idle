/**
 * The Road — travel by walking, and the only travel-time system (`engine.json` `road`).
 *
 * The world is a pointy-top hex lattice. A settlement owns one hex; the blocks between two
 * settlements are their hex distance, derived from the axial coordinates and never typed, so a
 * walk's length is never a hand-written number. There is no link list: every pair of settlements
 * is walkable, and a Waypoint covers the distance for free once both ends have been walked to.
 *
 * The Road mints nothing. An encounter is an ordinary mob group that pays the ordinary drop roll
 * (`encounter_rule`), so gold and junk come from killing mobs and from nowhere else.
 */

import type { EngineData, Rng } from './types.ts';

export interface RoadNode {
  id: string;
  q: number;
  r: number;
}

/** Axial hex distance: the number of blocks walked between two settlements. */
export function hexDistance(a: RoadNode, b: RoadNode): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

export function createRoad(E: EngineData) {
  const R = E.road;

  const nodes: RoadNode[] = R.nodes.map((n) => ({ id: n.id, q: n.q, r: n.r }));
  const nodeById = (id: string) => nodes.find((n) => n.id === id) || null;
  const blocksBetween = (a: string, b: string) => {
    const na = nodeById(a);
    const nb = nodeById(b);
    return na && nb ? hexDistance(na, nb) : 0;
  };
  const secBetween = (a: string, b: string) => blocksBetween(a, b) * R.block_sec;

  /** One encounter chance per block walked, so a longer walk is a longer series of chances. */
  const encounterChance = () => R.encounter_chance_pct / 100;
  /** True when a block rolls an encounter. Offline it never does: an away period never walks. */
  const rollEncounter = (rng: Rng) => rng() < encounterChance();

  /** The whole world on foot: every ordered pair, so the UI can offer any destination. */
  const pairs = nodes.flatMap((a) => nodes.filter((b) => b.id !== a.id).map((b) => ({
    a: a.id,
    b: b.id,
    blocks: hexDistance(a, b),
    sec: hexDistance(a, b) * R.block_sec,
  })));

  return {
    R, nodes, nodeById, blocksBetween, secBetween, pairs,
    encounterChance, rollEncounter,
    blockSec: R.block_sec,
  };
}

export type Road = ReturnType<typeof createRoad>;