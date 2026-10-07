import { E, TOWN } from '../engine/client';
import { createRoad } from '../../../engine/road.ts';
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

/** Lay a walk down. The blocks are the hex distance between the two settlements, never typed. */
export function startWalk(state: GameState, fromId: string, toId: string): { ok: boolean; why?: string } {
  if (state.walk) return { ok: false, why: 'already walking' };
  if (state.phase === 'camp') return { ok: false, why: 'recovering at camp' };
  if (fromId === toId) return { ok: false, why: 'you are already there' };
  if (!settlementById(fromId) || !settlementById(toId)) return { ok: false, why: 'no such settlement' };
  const blocks = road.blocksBetween(fromId, toId);
  if (blocks <= 0) return { ok: false, why: 'those two settlements share no blocks' };
  state.walk = {
    from: fromId,
    to: toId,
    blocksTotal: blocks,
    blocksLeft: blocks,
    secLeft: road.blockSec,
    blocksWalked: 0,
  };
  return { ok: true };
}

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