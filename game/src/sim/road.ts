import { E, TOWN } from '../engine/client';
import { createRoad } from '../../../engine/road.js';
import type { GameState, RoadTrip } from './types';

/** The Road model comes from the shared module, so the purse bound is one number in one place. */
export const road: any = createRoad(E);

const settlementByName = (name: string) => TOWN.settlements.find((s: any) => s.name === name);

export const linkLabel = (index: number) => {
  const l = road.links[index];
  return `${l.a} ↔ ${l.b}`;
};

/**
 * Mode C is the walk: it needs only the end you are standing at, and it is how a settlement you
 * have never seen is opened without paying the carriage (mode B). The Waypoint then makes the
 * return free and instant (`towns.md` §7 · "never required for anything").
 */
export function linkReachable(state: GameState, index: number, bothEnds = false): boolean {
  const l = road.links[index];
  const a = settlementByName(l.a);
  const b = settlementByName(l.b);
  if (!a || !b) return false;
  const visitedA = state.town.visited.includes(a.id);
  const visitedB = state.town.visited.includes(b.id);
  return bothEnds ? visitedA && visitedB : visitedA || visitedB;
}

export function tripDay(state: GameState): number {
  return Math.floor(state.clockSec / 86400);
}

export function purseReady(state: GameState, index: number): boolean {
  if (!E.road.purse_once_per_link_per_day) return true;
  return (state.purseDay[index] || 0) !== tripDay(state);
}

/** Opt-in and online only: a trip replaces zone farming for its five minutes. */
export function startTrip(state: GameState, index: number): { ok: boolean; why?: string } {
  if (state.road) return { ok: false, why: 'already on the Road' };
  if (!linkReachable(state, index)) return { ok: false, why: 'one end of that link is not reachable yet' };
  if (state.phase === 'camp') return { ok: false, why: 'recovering at camp' };
  const l = road.links[index];
  const a = settlementByName(l.a);
  const b = settlementByName(l.b);
  const here = (s: any) => s.zone === state.zone && state.town.visited.includes(s.id);
  const from = here(a) ? a : here(b) ? b : state.town.visited.includes(a.id) ? a : b;
  const to = from === a ? b : a;
  state.road = {
    linkIndex: index,
    settlementFrom: from.id,
    settlementTo: to.id,
    kind: null,
    secLeft: road.tripSec,
    nextEncounterSec: state.clockSec + road.encounterGapSec,
    encountersLeft: road.encountersPerTrip,
    pursePaid: false,
  };
  state.group = [];
  return { ok: true };
}

/** Which zone's cast an encounter draws from: the lower-numbered zone is the link's first town. */
export function encounterZones(index: number): { lower: number; higher: number } {
  const l = road.links[index];
  return { lower: settlementByName(l.a).zone, higher: settlementByName(l.b).zone };
}

/** How many mobs this encounter type brings, from the doc's own wording. */
export function encounterSizes(kind: string, rng: () => number): { large: number; small: number; medium: number } {
  if (kind === 'ambush') return { large: 0, small: rng() < 0.5 ? 2 : 3, medium: 0 };
  if (kind === 'caravan') return { large: 1, small: 2, medium: 0 };
  return { large: 0, small: 0, medium: 0 };
}

export function endTrip(state: GameState, reason: 'complete' | 'forfeit') {
  state.road = null;
  state.group = [];
  return reason;
}

/** The purse is the only gold the Road pays, and it is once per link per day. */
export function payPurse(state: GameState): number {
  const trip = state.road;
  if (!trip || trip.pursePaid) return 0;
  if (!purseReady(state, trip.linkIndex)) return 0;
  trip.pursePaid = true;
  state.purseDay[trip.linkIndex] = tripDay(state);
  state.counters.gold += E.road.purse_gold;
  return E.road.purse_gold;
}

/** Standing arrives as kill-equivalents in the arrival settlement's own zone, and the walk opens it. */
export function grantTripStanding(state: GameState, trip: RoadTrip) {
  const l = road.links[trip.linkIndex];
  const a = settlementByName(l.a);
  const b = settlementByName(l.b);
  const dest = trip.settlementTo === a.id ? a : b;
  if (!state.town.visited.includes(dest.id)) state.town.visited.push(dest.id);
  state.zone = dest.zone;
  state.town.waypoint = dest.id;
  state.counters.zoneKills[dest.zone] = (state.counters.zoneKills[dest.zone] || 0) + E.road.standing_per_trip_kills;
}
