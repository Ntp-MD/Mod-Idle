/**
 * The Road — travel by walking, and the only travel-time system (`engine.json` `road`).
 *
 * The world is a pointy-top hex lattice — the 20 x 15 field the map sheet draws. A cell is a place to
 * stand (`standing_rule`): the foot crosses one cell per block and any cell may be a destination, so a
 * walk joins two cells, not two settlements. The blocks between them are their hex distance, derived
 * from the axial coordinates and never typed, so a walk's length is never a hand-written number. A far
 * destination is plotted as a chain of adjacent cells (`hexPath`) and crossed one cell at a time, which
 * is where an encounter comes from. There is no link list: every cell is walkable from every other, and
 * a Waypoint covers the distance for gold once the settlement at the destination has been walked to
 * (`town.json` `waypoint_warp` — a warp buys back the walk's time, which is what gold is for).
 *
 * A cell that names no settlement belongs to the nearest one (`owningNode`), which is where a bare
 * hex's zone, hunt ground and encounter band come from. Nothing here stores a second copy of that:
 * the lattice itself answers it, and the sheet's own marks are what the map cage checks it against.
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

/** True when two cells share an edge — the adjacency a single block of walking is allowed to cross. */
export const hexAdjacent = (a: Hex, b: Hex) => {
  const dq = a.q - b.q, dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2 === 1;
};

/** Axial hex distance: the number of blocks walked between two cells. */
export function hexDistance(a: Hex, b: Hex): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
}

/**
 * The six offsets a single step may cross. They are the pairs `hexAdjacent` accepts at distance 1, so
 * the ring and the adjacency rule cannot drift apart into two different ideas of a neighbour.
 */
export const HEX_DIRECTIONS: ReadonlyArray<readonly [number, number]> =
  [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

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
 * The plotted route: the ordered cells walked between two cells, one per block, each adjacent to the
 * one before it. A far destination is never jumped to — it is a chain of blocks the sheet can light up
 * one at a time, and its length is the hex distance, so the route and the walk's cost are the same
 * number derived twice rather than a path traded against a distance.
 */
export function hexPath(a: Hex, b: Hex): Hex[] {
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
  /** The route as sheet keys, in the order the foot crosses them — one step per block. */
  const routeKeys = (a: string, b: string): string[] => routeBetween(a, b).map((h) => `${h.q},${h.r}`);

  /* --- the field itself: any cell is a place to stand (`standing_rule`) ------------------------- */

  /** One cell to sheet-key form, so a walk, a route and a click all speak the same address. */
  const hexKeys = (cells: Hex[]): string[] => cells.map((h) => `${h.q},${h.r}`);
  /** The plotted route between two cells — the same chain a settlement-to-settlement route is. */
  const routeHex = (a: Hex, b: Hex): Hex[] => hexPath(a, b);
  /** Blocks between two cells: one per cell the foot crosses, whatever the ground under it. */
  const blocksBetweenHex = (a: Hex, b: Hex) => hexDistance(a, b);
  const secFromHex = (a: Hex, b: Hex) => hexDistance(a, b) * R.block_sec;
  /** The six cells one step from `h` — the ring a single block is allowed to enter. */
  const neighbours = (h: Hex): Hex[] => HEX_DIRECTIONS.map(([dq, dr]) => ({ q: h.q + dq, r: h.r + dr }));

  /** Every settlement exactly as far from a cell as the closest one is — more than one is a tie. */
  function owners(h: Hex): RoadNode[] {
    let best = Infinity;
    const ring: RoadNode[] = [];
    for (const n of nodes) {
      const d = hexDistance(h, n);
      if (d < best) { best = d; ring.length = 0; ring.push(n); }
      else if (d === best) ring.push(n);
    }
    return ring;
  }

  /**
   * The settlement a cell belongs to: the nearest one in blocks. A tie is broken by `prefer` — the
   * caller's list of settlement ids, earliest wins — because the rule that decides it (`standing_rule`:
   * the lowest zone) is town data, and the Road holds no copy of it. With no list given, tied ground
   * belongs to the first node in `road.nodes`, which is the same answer every time.
   */
  function owningNode(h: Hex, prefer?: string[]): RoadNode {
    const tied = owners(h);
    if (tied.length === 1 || !prefer?.length) return tied[0];
    return tied.reduce((a, b) => (prefer.indexOf(b.id) !== -1 && (prefer.indexOf(a.id) === -1
      || prefer.indexOf(b.id) < prefer.indexOf(a.id)) ? b : a), tied[0]);
  }

  /** How many blocks from the nearest settlement: 0 is a town, 1 is a side of it, 2 and out is bare. */
  const cellRank = (h: Hex) => hexDistance(h, owningNode(h));

  /** The whole world on foot: every ordered pair, so the UI can offer any destination. */
  const pairs = nodes.flatMap((a) => nodes.filter((b) => b.id !== a.id).map((b) => ({
    a: a.id,
    b: b.id,
    blocks: hexDistance(a, b),
    sec: hexDistance(a, b) * R.block_sec,
  })));

  return {
    R, nodes, nodeById, blocksBetween, secBetween, routeBetween, routeKeys, pairs,
    hexKeys, routeHex, blocksBetweenHex, secFromHex, neighbours, owners, owningNode, cellRank,
    blockSec: R.block_sec,
  };
}

export type Road = ReturnType<typeof createRoad>;