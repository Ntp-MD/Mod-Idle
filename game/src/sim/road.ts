import { E, TOWN } from '../engine/client';
import { createRoad, hexAdjacent } from '../../../engine/road.ts';
import { abandonRun } from './dungeon';
import { priceGold, rowById } from './town';
import type { GameState, Walk } from './types';

/** The walk model comes from the shared module, so every bound is one number in one place. */
export const road: any = createRoad(E);

const settlementById = (id: string) => TOWN.settlements.find((s: any) => s.id === id);

export const settlementZone = (id: string): number | null => settlementById(id)?.zone ?? null;

/** "Eastgate → Millbrook", the label the UI shows for a walk in either direction. */
export function walkLabel(fromId: string, toId: string): string {
  const a = settlementById(fromId)?.name ?? fromId;
  const b = settlementById(toId)?.name ?? toId;
  return `${a} → ${b}`;
}

export const walkBlocks = (fromId: string, toId: string): number => road.blocksBetween(fromId, toId);
export const walkSec = (fromId: string, toId: string): number => road.secBetween(fromId, toId);

/**
 * The plotted route as the cells it crosses, keyed the way the sheet keys a cell. A far destination
 * is never jumped to: the walk is this chain, one cell per block, and the map lights it up one cell
 * at a time. The keys come from the walk graph's own coordinates, so the client matches a label the
 * generated sheet already carries and reads no position table (X33 · M7).
 */
export function walkRoute(fromId: string, toId: string): string[] {
  return road.routeBetween(fromId, toId).map((h: { q: number; r: number }) => `${h.q},${h.r}`);
}

/** The settlement the character stands in right now, or null while walking. */
export function standingSettlement(state: GameState): any {
  if (state.walk) return null;
  return TOWN.settlements.find((s: any) => s.zone === state.zone && state.town.visited.includes(s.id)) || null;
}

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
export const warpRow: any = () => rowById('waypoint_warp');

/** What a warp to this settlement costs right now, in gold. */
export function warpCost(state: GameState, id: string): number {
  const row = warpRow();
  if (!row) return 0;
  return priceGold(row, id, state, Math.max(1, road.blocksBetween(state.town.waypoint, id)));
}

/**
 * Take the Waypoint: instant, and it pays gold for the time the walk would have taken. It opens no new
 * destination — the settlement is reachable because the foot earned it (`road.waypoint_rule`).
 */
export function warpTo(state: GameState, id: string): { ok: boolean; why?: string; gold?: number; forfeit?: string } {
  if (state.walk) return { ok: false, why: 'mid-walk — finish the route or turn back' };
  if (state.phase === 'camp') return { ok: false, why: 'recovering at camp' };
  if (id === state.town.waypoint) return { ok: false, why: 'you already stand there' };
  if (!waypointUnlocked(state, id)) return { ok: false, why: 'no Waypoint — reach it on foot first' };
  const gold = warpCost(state, id);
  if (state.counters.gold < gold) return { ok: false, why: `needs ${gold} gold`, gold };
  state.counters.gold = Math.round((state.counters.gold - gold) * 100) / 100;
  const dest = settlementById(id);
  if (!dest) return { ok: false, why: 'no such settlement' };
  state.zone = dest.zone;
  state.town.waypoint = id;
  state.group = [];
  // warping home is safe ground: town fields no mobs until the character heads back out
  state.hunting = false;
  const forfeit = state.dungeon ? abandonRun(state, 'Warped out') : undefined;
  return { ok: true, gold, forfeit };
}

/** Every cell the route has already been walked through, up to and including the current block. */
export function walkedCells(state: GameState): string[] {
  const w = state.walk;
  if (!w) return [];
  return road.routeKeys(w.from, w.to).slice(0, w.blocksWalked + 1);
}

/**
 * Lay a walk down. The blocks are the hex distance between the two settlements, never typed, and the
 * route is the chain of adjacent cells the foot crosses — one cell per block, never a jump.
 */
export function startWalk(state: GameState, fromId: string, toId: string): { ok: boolean; why?: string; forfeit?: string } {
  if (state.walk) return { ok: false, why: 'already walking' };
  if (state.phase === 'camp') return { ok: false, why: 'recovering at camp' };
  if (fromId === toId) return { ok: false, why: 'you are already there' };
  if (!settlementById(fromId) || !settlementById(toId)) return { ok: false, why: 'no such settlement' };
  const blocks = road.blocksBetween(fromId, toId);
  if (blocks <= 0) return { ok: false, why: 'those two settlements share no blocks' };
  const keys = road.routeKeys(fromId, toId);
  // a plotted route is a chain of single steps: each cell enters one that shares an edge with the
  // cell before it, which is what makes a far destination a walk rather than a jump
  if (keys.some((k: string, i: number) => i > 0 && !adjacent(keys[i - 1], k))) {
    return { ok: false, why: 'the plotted route leaves the lattice' };
  }
  state.walk = {
    from: fromId,
    to: toId,
    blocksTotal: blocks,
    blocksLeft: blocks,
    secLeft: road.blockSec,
    blocksWalked: 0,
  };
  // walking out abandons the open run: a dungeon is entered ground, not a destination
  const forfeit = state.dungeon ? abandonRun(state, 'Walked out') : undefined;
  return { ok: true, forfeit };
}

/** Two sheet keys share an edge — the one step a block is allowed to take. */
const adjacent = (a: string, b: string) => {
  const [aq, ar] = a.split(',').map(Number);
  const [bq, br] = b.split(',').map(Number);
  return hexAdjacent({ q: aq, r: ar }, { q: bq, r: br });
};

/** Arriving on foot opens the settlement and its Waypoint, and parks the character there. */
export function arrive(state: GameState, walk: Walk) {
  const dest = settlementById(walk.to);
  if (!dest) return;
  const first = !state.town.visited.includes(dest.id);
  if (first) state.town.visited.push(dest.id);
  state.zone = dest.zone;
  state.town.waypoint = dest.id;
  state.walk = null;
  state.group = [];
  // arriving is safe ground — unless Forward Mode is on, which is one long hunt
  state.hunting = state.travel === 'forward';
  return { name: dest.name, first };
}

export function endWalk(state: GameState) {
  state.walk = null;
  state.group = [];
}

/** Which zone an encounter on a walk draws from: the lower-numbered of the two it joins. */
export function walkZones(fromId: string, toId: string): { lower: number; higher: number } {
  const a = settlementZone(fromId) ?? 0;
  const b = settlementZone(toId) ?? 0;
  return { lower: Math.min(a, b), higher: Math.max(a, b) };
}

/** A walk has no purse, no chest and no Standing: an encounter is a fight and pays a normal drop. */