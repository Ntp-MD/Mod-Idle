import { E, TOWN, road } from '../../engine/client';
import { currentCell as travelCurrentCell, warpCost as travelWarpCost, warpTo as travelWarpTo,
  completeJourney, startWalk as travelStartWalk, journeyTrailCells, journeyWalkedCells, resolveCell } from './travel';
import type { Hex } from '../../../../engine/road.ts';
import { type GameState, type Cell, type Walk } from '../core/types';

/** The walk model is `client.ts`'s own instance — one object for the sim, the map views and the wiki. */
export { road };

const settlementById = (id: string) => TOWN.settlements.find((s) => s.id === id);

export const settlementZone = (id: string): number | null => settlementById(id)?.zone ?? null;

/**
 * The order a tied bare cell is resolved in: `road.standing_rule` gives it to the settlement holding the
 * lowest zone, and the zone belongs to `town.json`, so the preference list is built here rather than
 * copied into the Road.
 */
export const standingOrder: string[] = TOWN.settlements
  .slice()
  .sort((a, b) => (a.zone ?? 0) - (b.zone ?? 0))
  .map((s) => s.id);

/** The settlement a cell belongs to — itself when the cell is a town, its nearest one otherwise. */
export const ownerOf = (h: Hex) => road.owningNode(h, standingOrder);
/** The zone a cell stands in, read off the settlement that owns it. */
export const zoneOf = (h: Hex): number | null => settlementZone(ownerOf(h).id);
/** 0 is a settlement, 1 a side of one, 2 and out bare ground. */
export const rankOf = (h: Hex): number => road.cellRank(h);

/** The cell the feet are on: the committed position, including mid-walk — never a route reconstruction. */
export function currentCell(state: GameState): Hex {
  return travelCurrentCell(state);
}

/**
 * What the HUD says while a walk runs: the cell the feet are heading for, named by what stands on it
 * and the settlement whose ground it is. Destination facts resolve through World from the target
 * coordinates, never from stored journey metadata. A walk joins two cells, so the sentence quotes
 * the destination rather than a settlement pair (`road.standing_rule`).
 */
export function walkNote(state: GameState): string {
  const w = state.walk;
  if (!w) return '';
  const dest = resolveCell(w.to);
  const own = dest ? settlementById(dest.ownerId) : null;
  const name = own?.name ?? 'the field';
  const subs = own ? (E.mob.zones.find((z) => z.id === own.zone)?.subzones || []) : [];
  const site = dest?.cell.site;
  const where = dest?.kind === 'town' ? name
    : dest?.kind === 'sub' ? `${subs[dest.cell.sub ?? 0]?.name ?? `sub-zone ${(dest.cell.sub ?? 0) + 1}`} of ${name}`
      : site ? `the ${site === 'fishing' ? 'Fishing' : site === 'grove' ? 'Grove' : site === 'mine' ? 'Mine' : 'Dungeon'} wild-side cell near ${name}`
        : `bare ground in the field of ${name}`;
  return where;
}

export const walkBlocks = (fromId: string, toId: string): number => road.blocksBetween(fromId, toId);

/** A Waypoint exists for every settlement the character has arrived at on foot, once. */
export function waypointUnlocked(state: GameState, id: string): boolean {
  return state.town.visited.includes(id);
}

export function canTravel(state: GameState, id: string): boolean {
  return waypointUnlocked(state, id);
}

/**
 * The Waypoint's own price line (`town.json` `waypoint_warp`): minutes per block the walk would have
 * crossed, charged at the destination settlement's band. It is not a stall line — no `stock` array
 * names it and no vendor sells it — so it is priced here rather than bought through `canBuy`.
 */
export { warpRow } from './travel';

/** What a warp to this settlement costs right now, quoted from the actual committed position. */
export function warpCost(state: GameState, id: string): number {
  return travelWarpCost(state, id);
}

/**
 * Take the Waypoint: instant, and it pays gold for the time the walk would have taken. It opens no new
 * destination — the settlement is reachable because the foot earned it (`road.waypoint_rule`).
 */
export function warpTo(state: GameState, id: string): { ok: boolean; why?: string; gold?: number; forfeit?: string } {
  return travelWarpTo(state, id);
}

/** Every cell the route has already been walked through, up to and including the current block. */
export function walkedCells(state: GameState): string[] {
  return journeyWalkedCells(state);
}

/**
 * The whole road the running walk lies on, in the order it is crossed. The sheet lights this, not the
 * route re-plotted from the feet: a trail that went dark behind the walker would leave only the cell
 * under them lit, and the walk would read as a jump from block to block.
 */
export function trailCells(state: GameState): string[] {
  return journeyTrailCells(state);
}

/**
 * Lay a walk down to any cell of the field. The blocks are the hex distance between the cell the feet
 * are on and the cell clicked, never typed, and the route is the chain of adjacent cells the foot
 * crosses — one cell per block, never a jump. Re-clicking mid-walk is refused: the route is re-laid
 * from where the feet stand, so the walked prefix stays lit and no block is paid twice.
 */
export function startWalk(state: GameState, dest: Cell): { ok: boolean; why?: string; forfeit?: string } {
  return travelStartWalk(state, dest);
}

/**
 * Arriving puts the feet on the cell. Only rank 0 opens a settlement and its Waypoint — a Waypoint
 * marks a town, not a patch of ground (`road.standing_rule`) — while any arrival sets the zone from
 * the settlement that owns the cell. Content resolves through World, so a stopped-at mine is a mine.
 */
export function arrive(state: GameState, walk: Walk) {
  return completeJourney(state, walk);
}

/** Which zone an encounter on a walk draws from: the lower-numbered of the two it joins. */
export function walkZonesHex(from: Hex, to: Hex): { lower: number; higher: number } {
  const a = settlementZone(ownerOf(from).id) ?? 0;
  const b = settlementZone(ownerOf(to).id) ?? 0;
  return { lower: Math.min(a, b), higher: Math.max(a, b) };
}

/** A walk has no purse and no chest: an encounter is a fight and pays a normal drop. */

/** The cell a settlement stands on, for a caller that has a name rather than a clicked hex. */
export function settlementCell(id: string): Cell | null {
  const n = road.nodeById(id);
  return n ? { q: n.q, r: n.r, sub: null, site: null } : null;
}

/** Blocks from where the feet are to a cell — the price a destination card quotes. */
export const cellBlocks = (state: GameState, dest: Hex): number =>
  road.blocksLand(currentCell(state), dest) ?? road.blocksBetweenHex(currentCell(state), dest);
/** Seconds the same walk would take, at the one rate the Road charges. */
export const cellSec = (state: GameState, dest: Hex): number =>
  (road.blocksLand(currentCell(state), dest) ?? road.blocksBetweenHex(currentCell(state), dest)) * road.blockSec;
/** The plotted chain to a cell, keyed the way the sheet keys a cell — lit one cell per block. */
export function cellsTo(state: GameState, dest: Hex): string[] {
  return road.hexKeys(road.routeLand(currentCell(state), dest) ?? []);
}
