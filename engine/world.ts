/**
 * World queries — the canonical read side of the hex world (`docs/plan/hex-world-travel-rework.md` §4, HX1).
 *
 * Pure and indexed: land, authored locations, base ownership, terrain, habitat and static features
 * resolve from coordinates here, never from SVG attributes, `GameState`, the renderer or the save.
 * `createWorld(E, settlements)` validates the data once and answers `cellAt` / `locationAt` /
 * `ownerOf` / `bareTerrain` / `habitatOf` for every land cell. Movement planning (HX2) and travel
 * transitions (HX3) build on these queries; no movement or save behaviour changes here.
 *
 * Data owners stay where they are: the land mask and locations come from `road`, zones/sub-zones
 * from `mob.zones`, and the settlement→zone map from the caller's settlement list (`town.json` in
 * the client and the map generator). When the list is omitted it is derived from the `town`
 * locations and `road.nodes`, which carry the same pairs.
 */

import type { EngineData, RoadLocationCfg } from './types.ts';
import { createRoad, type RoadNode } from './road.ts';
import { hexDistance, hexKey, type Hex } from './hex.ts';

export type { Hex } from './hex.ts';
export { hexAdjacent, hexDistance, hexKey, hexKeys, hexNeighbours, hexPath, HEX_DIRECTIONS } from './hex.ts';

export type WorldSiteKind = 'dungeon' | 'mine' | 'grove' | 'fishing';

/** A static feature standing on a hex: a reference, never a copy of dynamic activity state. */
export interface WorldFeatureRef {
  id: string;
  kind: 'town' | 'sub' | 'site';
  index: number;
  site?: WorldSiteKind;
}

/** The effective habitat: a reference to the zone/sub-zone whose species pool the hex draws from. */
export interface WorldHabitat {
  zoneId: number;
  subzoneIndex: number;
}

/**
 * One resolved land cell. `locationId` is the stable authored id (`road.locations[].id`) or null on
 * bare ground; `habitat` is null only on a town cell. A bare hex stays bare (`locationId: null`)
 * even though its habitat is inherited from a named side.
 */
export interface WorldCell {
  coord: Hex;
  locationId: string | null;
  zoneId: number;
  terrainId: string;
  habitat: WorldHabitat | null;
  features: readonly WorldFeatureRef[];
}

/**
 * One directed movement edge (HX2 planner input shape). Declared here so world and planner agree on
 * the contract; HX1 builds no graph and prices nothing.
 */
export interface MovementEdge {
  id: string;
  from: Hex;
  to: Hex;
  kind: 'walk' | 'connection';
  durationUs: number;
  sourceFeatureId?: string;
}

export interface SettlementRef {
  id: string;
  zone: number;
}

export interface World {
  readonly land: readonly Hex[];
  readonly locations: readonly RoadLocationCfg[];
  readonly nodes: readonly RoadNode[];
  /** The standing order: settlement ids sorted by zone, lowest first (`road.standing_rule`). */
  readonly standingOrder: readonly string[];
  isLand: (h: Hex) => boolean;
  /** The resolved cell, or null on sea. Throws on non-integer coordinates. */
  cellAt: (h: Hex) => WorldCell | null;
  /** The authored location on a cell, or null on bare ground and sea. Throws on invalid coordinates. */
  locationAt: (h: Hex) => RoadLocationCfg | null;
  locationById: (id: string) => RoadLocationCfg | null;
  /** The settlement a land cell belongs to: nearest on foot, ties by standing order. */
  ownerOf: (h: Hex) => RoadNode;
  zoneOf: (h: Hex) => number;
  terrainOf: (h: Hex) => string | null;
  habitatOf: (h: Hex) => WorldHabitat | null;
  /**
   * The terrain bare ground takes: its owner's nearest named side, with the generator's fixed
   * deterministic drift (`hash01(q*3+7, r*5+11) * 1.15`) and first-wins ties in location order.
   * The same resolver the map sheet prints, so generation and runtime cannot disagree.
   */
  bareTerrain: (townId: string, h: Hex) => string;
  /** Every resolved land cell, in land-mask order. */
  cells: () => readonly WorldCell[];
}

/** A stable per-cell jitter, so bare ground is not a perfect Voronoi of the nearest named side. */
const hash01 = (q: number, r: number): number => {
  let h = 2166136261 ^ Math.imul(q, 374761393) ^ Math.imul(r, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h >>> 0) / 4294967295;
};

const SITE_KINDS: readonly string[] = ['dungeon', 'mine', 'grove', 'fishing'];

const assertHex = (h: Hex): void => {
  if (!h || !Number.isInteger(h.q) || !Number.isInteger(h.r)) {
    throw new TypeError(`world: invalid hex coordinates ${JSON.stringify(h)}`);
  }
};

export function createWorld(E: EngineData, settlements?: readonly SettlementRef[]): World {
  const road = createRoad(E);
  const zones = (E.mob?.zones ?? []) as { id: number; subzones?: { name: string }[] }[];
  const zoneById = new Map(zones.map((z) => [z.id, z]));

  // Settlement → zone. An explicit list wins; otherwise derive it from the town locations
  // (each names its zone and sits on its settlement's node cell).
  const settlementList: SettlementRef[] = settlements
    ? settlements.map((s) => ({ id: s.id, zone: s.zone }))
    : (road.locations.filter((l) => l.kind === 'town').flatMap((l) => {
        const node = road.nodes.find((n) => n.q === l.q && n.r === l.r);
        return node ? [{ id: node.id, zone: l.zone }] : [];
      }));
  const settlementById = new Map(settlementList.map((s) => [s.id, s]));
  const settlementByZone = new Map(settlementList.map((s) => [s.zone, s]));
  const standingOrder = settlementList.slice().sort((a, b) => a.zone - b.zone).map((s) => s.id);

  // ---- validate land + locations (the same facts tools/map.ts gates as M2/M3/M11) ----
  const landKeys = new Set<string>();
  for (const h of road.land) {
    assertHex(h);
    const k = hexKey(h);
    if (landKeys.has(k)) throw new Error(`world: duplicate land cell ${k}`);
    landKeys.add(k);
  }
  const locationByCell = new Map<string, RoadLocationCfg>();
  const locationByIdMap = new Map<string, RoadLocationCfg>();
  for (const loc of road.locations) {
    assertHex(loc);
    const k = hexKey(loc);
    if (!road.isLand(loc)) throw new Error(`world: road location ${loc.id} sits on ${loc.q},${loc.r}, which is not land`);
    if (locationByCell.has(k)) throw new Error(`world: two road locations claim ${k}`);
    if (locationByIdMap.has(loc.id)) throw new Error(`world: duplicate road location id ${loc.id}`);
    if (zoneById.size && !zoneById.has(loc.zone)) throw new Error(`world: road location ${loc.id} names zone ${loc.zone}, which mob.zones does not carry`);
    if (settlementList.length && !settlementByZone.has(loc.zone)) throw new Error(`world: road location ${loc.id} names zone ${loc.zone}, which no settlement holds`);
    if (loc.kind === 'town') {
      const node = road.nodes.find((n) => n.q === loc.q && n.r === loc.r);
      if (!node) throw new Error(`world: town location ${loc.id} sits on ${loc.q},${loc.r}, which holds no settlement node`);
      const s = settlementById.get(node.id);
      if (s && s.zone !== loc.zone) throw new Error(`world: town location ${loc.id} is zone ${loc.zone} but settlement ${node.id} holds zone ${s.zone}`);
    } else if (loc.kind === 'sub') {
      const zone = zoneById.get(loc.zone);
      if (zone && !(loc.index >= 0 && loc.index < (zone.subzones?.length ?? 0))) {
        throw new Error(`world: road location ${loc.id} names sub-zone ${loc.index}, which zone ${loc.zone} does not carry`);
      }
    } else if (loc.kind === 'site') {
      if (!loc.site || !SITE_KINDS.includes(loc.site)) throw new Error(`world: road location ${loc.id} names unknown site ${String(loc.site)}`);
    } else {
      throw new Error(`world: road location ${loc.id} has unknown kind ${String((loc as { kind?: unknown }).kind)}`);
    }
    locationByCell.set(k, loc);
    locationByIdMap.set(loc.id, loc);
  }

  // Named sides grouped by the settlement that authored them, in location order (tie order).
  const subsByTown = new Map<string, RoadLocationCfg[]>();
  for (const loc of road.locations) {
    if (loc.kind !== 'sub') continue;
    const town = settlementByZone.get(loc.zone)?.id;
    if (!town) continue;
    const list = subsByTown.get(town) ?? [];
    list.push(loc);
    subsByTown.set(town, list);
  }

  /** The winning named side of `townId` for bare ground at `h`: nearest, with the fixed drift. */
  const bareSub = (townId: string, h: Hex): RoadLocationCfg | null => {
    let best: { d: number; sub: RoadLocationCfg } | null = null;
    for (const sub of subsByTown.get(townId) ?? []) {
      const d = hexDistance(h, sub) + hash01(h.q * 3 + 7, h.r * 5 + 11) * 1.15;
      if (!best || d < best.d) best = { d, sub };
    }
    return best?.sub ?? null;
  };

  const bareTerrain = (townId: string, h: Hex): string => bareSub(townId, h)?.terrain ?? 'grass';

  const ownerOf = (h: Hex): RoadNode => road.owningNode(h, standingOrder);
  const zoneOf = (h: Hex): number => {
    const loc = locationByCell.get(hexKey(h));
    if (loc) return loc.zone;
    const owner = ownerOf(h);
    return settlementById.get(owner.id)?.zone ?? 0;
  };

  const habitatOf = (h: Hex): WorldHabitat | null => {
    const loc = locationByCell.get(hexKey(h));
    if (loc?.kind === 'town') return null;
    if (loc?.kind === 'sub') return { zoneId: loc.zone, subzoneIndex: loc.index };
    // Bare ground and wild-side sites draw their pool from the owner's winning named side.
    const owner = ownerOf(h);
    const sub = bareSub(owner.id, h);
    return sub ? { zoneId: sub.zone, subzoneIndex: sub.index } : null;
  };

  const cellAt = (h: Hex): WorldCell | null => {
    assertHex(h);
    if (!road.isLand(h)) return null;
    const loc = locationByCell.get(hexKey(h)) ?? null;
    const owner = ownerOf(h);
    const terrainId = loc ? (loc.kind === 'town' ? 'town' : loc.terrain) : bareTerrain(owner.id, h);
    const features: WorldFeatureRef[] = loc
      ? [{ id: loc.id, kind: loc.kind, index: loc.index, ...(loc.site ? { site: loc.site as WorldSiteKind } : {}) }]
      : [];
    return {
      coord: { q: h.q, r: h.r },
      locationId: loc?.id ?? null,
      zoneId: zoneOf(h),
      terrainId,
      habitat: habitatOf(h),
      features,
    };
  };

  // Indexed once per data revision; `cells()` hands back the same frozen rows.
  const cellIndex = new Map<string, WorldCell>();
  for (const h of road.land) {
    const cell = cellAt(h);
    if (cell) cellIndex.set(hexKey(h), Object.freeze(cell));
  }

  return {
    land: road.land.map((h) => ({ q: h.q, r: h.r })),
    locations: road.locations.map((l) => ({ ...l })),
    nodes: road.nodes.map((n) => ({ ...n })),
    standingOrder: standingOrder.slice(),
    isLand: (h) => { assertHex(h); return road.isLand(h); },
    cellAt,
    locationAt: (h) => { assertHex(h); return locationByCell.get(hexKey(h)) ?? null; },
    locationById: (id) => locationByIdMap.get(id) ?? null,
    ownerOf: (h) => { assertHex(h); return ownerOf(h); },
    zoneOf: (h) => { assertHex(h); return zoneOf(h); },
    terrainOf: (h) => cellAt(h)?.terrainId ?? null,
    habitatOf: (h) => { assertHex(h); return road.isLand(h) ? habitatOf(h) : null; },
    bareTerrain: (townId, h) => { assertHex(h); return bareTerrain(townId, h); },
    cells: () => [...cellIndex.values()],
  };
}

export type WorldInstance = ReturnType<typeof createWorld>;
