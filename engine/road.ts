/**
 * The Road — travel by walking, and the only travel-time system (`engine.json` `road`).
 *
 * The world is a pointy-top hex lattice — the 20 x 15 field the map sheet draws. A settlement owns
 * one cell; the blocks between two settlements are their hex distance, derived from the axial
 * coordinates and never typed, so a walk's length is never a hand-written number. A far destination
 * is plotted as a chain of adjacent cells (`routeBetween`) and crossed one cell at a time, which is
 * where an encounter comes from. There is no link list: every pair of settlements is walkable, and a
 * Waypoint covers the distance for free once both ends have been walked to.
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

/** One cell of the field, addressed by its axial coordinates. */
export interface Hex {
  q: number;
  r: number;
}

/** Axial hex distance: the number of blocks walked between two settlements. */
export function hexDistance(a: RoadNode, b: RoadNode): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

/** Cube rounding, the one way back from a fractional lerp onto the lattice. */
function cubeRound(qf: number, rf: number): Hex {
  const sf = -qf - rf;
  let q = Math.round(qf), r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  return { q, r };
}

/**
 * The plotted route: the ordered cells walked between two settlements, one per block, each adjacent
 * to the one before it. A far destination is never jumped to — it is a chain of blocks the sheet can
 * light up one at a time, and its length is the hex distance, so the route and the walk's cost are
 * the same number derived twice rather than a path traded against a distance.
 */
export function hexPath(a: RoadNode, b: RoadNode): Hex[] {
  const n = hexDistance(a, b);
  const out: Hex[] = [];
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    out.push(cubeRound(a.q + (b.q - a.q) * t, a.r + (b.r - a.r) * t));
  }
  return out;
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
  /** The plotted route between two settlements, as the cells it crosses (both ends included). */
  const routeBetween = (a: string, b: string): Hex[] => {
    const na = nodeById(a);
    const nb = nodeById(b);
    return na && nb ? hexPath(na, nb) : [];
  };

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
    R, nodes, nodeById, blocksBetween, secBetween, routeBetween, pairs,
    encounterChance, rollEncounter,
    blockSec: R.block_sec,
  };
}

export type Road = ReturnType<typeof createRoad>;