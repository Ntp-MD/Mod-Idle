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

import type { EngineData, RoadLocationCfg, Rng } from './types.ts';
import { HEX_DIRECTIONS, hexDistance, hexKey, hexNeighbours, hexPath, type Hex } from './hex.ts';
import { planCells, planTravel, type TravelContext } from './travel.ts';

/** Hex geometry lives in `engine/hex.ts`; re-exported here so existing callers do not move. */
export { HEX_DIRECTIONS, hexAdjacent, hexDistance, hexKey, hexKeys, hexNeighbours, hexPath, type Hex } from './hex.ts';

export interface RoadNode {
  id: string;
  q: number;
  r: number;
}

/** One authored place on the land mask, with its canonical id and printed ground. */
export type RoadLocation = RoadLocationCfg;

/** A named place with a stable id: a sub-zone side or a wild-side site of a zone. */
export interface LocationRef {
  id: string;
  zoneId: number;
  kind: 'sub' | 'site';
  /** Sub-zone index, or site order within its kind. */
  index: number;
  site?: 'dungeon' | 'mine' | 'grove' | 'fishing';
}

/** Canonical identity for a named side: `zone:7:sub:2`. Names and coordinates stay with their owners. */
export function locationId(zoneId: number, kind: 'sub' | 'site', index: number, site?: LocationRef['site']): string {
  return site ? `zone:${zoneId}:${kind}:${index}:${site}` : `zone:${zoneId}:${kind}:${index}`;
}

/** Read a canonical location id back; null where the id is not one the registry writes. */
export function parseLocationRef(id: string): LocationRef | null {
  const m = /^zone:(\d+):(sub|site):(\d+)(?::(dungeon|mine|grove|fishing))?$/.exec(id);
  if (!m) return null;
  return { id, zoneId: Number(m[1]), kind: m[2] as 'sub' | 'site', index: Number(m[3]),
    ...(m[4] ? { site: m[4] as LocationRef['site'] } : {}) };
}

export function createRoad(E: EngineData) {
  const R = E.road;

  const nodes: RoadNode[] = R.nodes.map((n) => ({ id: n.id, q: n.q, r: n.r }));
  const nodeById = (id: string) => nodes.find((n) => n.id === id) || null;
  const blocksBetween = (a: string, b: string) => {
    const na = nodeById(a);
    const nb = nodeById(b);
    return na && nb ? (blocksLand(na, nb) ?? 0) : 0;
  };
  const secBetween = (a: string, b: string) => blocksBetween(a, b) * R.block_sec;
  /** The plotted route between two settlements, as the cells it crosses (both ends included). */
  const routeBetween = (a: string, b: string): Hex[] => {
    const na = nodeById(a);
    const nb = nodeById(b);
    return na && nb ? (routeLand(na, nb) ?? []) : [];
  };
  /** The route as sheet keys, in the order the foot crosses them — one step per block. */
  const routeKeys = (a: string, b: string): string[] => routeBetween(a, b).map((h) => `${h.q},${h.r}`);

  /* --- the field itself: any cell is a place to stand (`standing_rule`) ------------------------- */

  /**
   * The canonical land mask: axial cells feet may stand on. Absent means the whole lattice,
   * which is the open field a save without a renovated world still uses.
   */
  const landVersion = (R as { land_version?: unknown }).land_version ?? 1;
  const landRaw = (R as { land?: unknown }).land as Array<[number, number]> | undefined;
  const land: Hex[] = (landRaw ?? []).map(([q, r]) => ({ q, r }));
  const landCells = new Set(land.map(({ q, r }) => `${q},${r}`));
  const hasLandMask = landCells.size > 0;
  /** True on land; with no authored mask every cell of the lattice counts as land. */
  const isLand = (h: Hex): boolean => !hasLandMask || landCells.has(`${h.q},${h.r}`);

  /** The authored places: one settlement, named side or wild-side site per land cell. */
  const locations: RoadLocation[] = (R.locations ?? []).map((l) => ({ ...l }));
  const locationById = (id: string): RoadLocation | null => locations.find((l) => l.id === id) || null;
  const locationAt = (h: Hex): RoadLocation | null => locations.find((l) => l.q === h.q && l.r === h.r) || null;

  /**
   * Walkable distances from every settlement, one BFS per node. They are measured over the land
   * mask, so "nearest settlement" means nearest on foot and never the crow's line across a bay.
   */
  const distFrom = new Map<string, Map<string, number>>();
  if (hasLandMask) {
    for (const n of nodes) {
      const dist = new Map<string, number>([[`${n.q},${n.r}`, 0]]);
      const queue: Hex[] = [{ q: n.q, r: n.r }];
      while (queue.length) {
        const here = queue.shift()!;
        const d = dist.get(`${here.q},${here.r}`)!;
        for (const [dq, dr] of HEX_DIRECTIONS) {
          const next = { q: here.q + dq, r: here.r + dr };
          const key = `${next.q},${next.r}`;
          if (dist.has(key) || !isLand(next)) continue;
          dist.set(key, d + 1);
          queue.push(next);
        }
      }
      distFrom.set(n.id, dist);
    }
  }
  /** Blocks on foot from a cell to a settlement; null where no walkable chain exists. */
  const walkDist = (h: Hex, n: RoadNode): number | null => {
    if (!hasLandMask) return hexDistance(h, n);
    if (!isLand(h)) return hexDistance(h, n);
    return distFrom.get(n.id)?.get(`${h.q},${h.r}`) ?? null;
  };

  /**
   * The walkable route between two cells: the movement planner over the uniform-cost land context,
   * so preview, quote and execution share one route authority (`engine/travel.ts`). BFS with the fixed
   * neighbour order plots the same steps the Road always plotted. Null where no walkable chain exists —
   * the caller refuses the walk with a reason instead of charging for it. With no authored mask this is
   * the straight lattice line, the same cells `hexPath` has always plotted.
   */
  const travelContext: TravelContext = {
    worldRevision: `land:${landVersion}`,
    movementRevision: 'uniform',
    isLand,
    walkDurationUs: R.block_sec,
  };
  function routeLand(a: Hex, b: Hex): Hex[] | null {
    if (!isLand(a) || !isLand(b)) return null;
    if (!hasLandMask) return hexPath(a, b);
    const plan = planTravel(a, b, travelContext);
    return plan ? planCells(plan) : null;
  }
  /** Blocks along the walkable route, or null where the destination cannot be reached on foot. */
  const blocksLand = (a: Hex, b: Hex): number | null => {
    if (!hasLandMask) return hexDistance(a, b);
    const path = routeLand(a, b);
    return path ? path.length - 1 : null;
  };

  /** One cell to sheet-key form, so a walk, a route and a click all speak the same address. */
  const hexKeys = (cells: Hex[]): string[] => cells.map((h) => hexKey(h));
  /** The plotted route between two cells — the same chain a settlement-to-settlement route is. */
  const routeHex = (a: Hex, b: Hex): Hex[] => routeLand(a, b) ?? [];
  /** Blocks between two cells: one per land cell the foot crosses, whatever the ground under it. */
  const blocksBetweenHex = (a: Hex, b: Hex) => blocksLand(a, b) ?? 0;
  const secFromHex = (a: Hex, b: Hex) => blocksBetweenHex(a, b) * R.block_sec;
  /** The six cells one step from `h` — the ring a single block is allowed to enter. */
  const neighbours = (h: Hex): Hex[] => hexNeighbours(h);

  /** Every settlement exactly as far from a cell as the closest one is — more than one is a tie. */
  function owners(h: Hex): RoadNode[] {
    let best = Infinity;
    const ring: RoadNode[] = [];
    for (const n of nodes) {
      const d = walkDist(h, n);
      if (d == null) continue;
      if (d < best) { best = d; ring.length = 0; ring.push(n); }
      else if (d === best) ring.push(n);
    }
    return ring.length ? ring : nodes.slice();
  }

  /**
   * The settlement a cell belongs to: the nearest one on foot. A tie is broken by `prefer` — the
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

  /** How many blocks on foot from the nearest settlement: 0 is a town, 1 is a side of it, 2 is out. */
  const cellRank = (h: Hex) => blocksLand(h, owningNode(h)) ?? 0;

  /** The whole world on foot: every reachable ordered pair, so the UI can offer any destination. */
  const pairs = nodes.flatMap((a) => nodes.filter((b) => b.id !== a.id).flatMap((b) => {
    const blocks = blocksLand(a, b);
    return blocks == null ? [] : [{ a: a.id, b: b.id, blocks, sec: blocks * R.block_sec }];
  }));

  return {
    R, nodes, nodeById, blocksBetween, secBetween, routeBetween, routeKeys, pairs,
    hexKeys, routeHex, blocksBetweenHex, secFromHex, neighbours, owners, owningNode, cellRank,
    blockSec: R.block_sec,
    landVersion, land, isLand, locations, locationById, locationAt, routeLand, blocksLand, hasLandMask,
  };
}

export type Road = ReturnType<typeof createRoad>;