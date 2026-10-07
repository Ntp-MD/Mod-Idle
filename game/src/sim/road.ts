import { E, TOWN } from '../engine/client';
import { createRoad } from '../../../engine/road.ts';
import type { GameState, RoadTrip } from './types';

/** The Road model comes from the shared module, so every bound is one number in one place. */
export const road: any = createRoad(E);

const settlementByName = (name: string) => TOWN.settlements.find((s: any) => s.name === name);
const settlementById = (id: string) => TOWN.settlements.find((s: any) => s.id === id);

/** The zone a settlement id sits in — used to aim a chest's quality at the destination. */
export const settlementZone = (id: string): number | null => settlementById(id)?.zone ?? null;

export const linkLabel = (index: number) => road.links[index].text;

/** The settlement the character is standing in right now, or null while on the Road. */
export function standingSettlement(state: GameState): any {
  if (state.road) return null;
  return TOWN.settlements.find((s: any) => s.zone === state.zone && state.town.visited.includes(s.id)) || null;
}

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

/** A ledger entry of `undefined` (never claimed) must read as ready even on day 0. */
export function purseReady(state: GameState, index: number): boolean {
  if (!E.road.purse_once_per_link_per_day) return true;
  return (state.purseDay[index] ?? -1) !== tripDay(state);
}

/** The chest shares the purse's shape: once per link per day, the same ledger shape. */
export function chestReady(state: GameState, index: number): boolean {
  if (!E.road.chest_once_per_link_per_day) return true;
  return (state.chestDay[index] ?? -1) !== tripDay(state);
}

/** Lay a leg down: the end you are standing at is the origin, the other end is the destination. */
function setupLeg(state: GameState, index: number, fromId?: string): RoadTrip {
  const l = road.links[index];
  const a = settlementByName(l.a);
  const b = settlementByName(l.b);
  const origin = fromId
    ? (a.id === fromId ? a : b)
    : (() => {
      const here = standingSettlement(state);
      if (here && (here.id === a.id || here.id === b.id)) return here;
      return state.town.visited.includes(a.id) ? a : b;
    })();
  const to = origin.id === a.id ? b : a;
  const blocks = road.blocksFor(index);
  return {
    linkIndex: index,
    settlementFrom: origin.id,
    settlementTo: to.id,
    kind: null,
    secLeft: road.blockSec,
    blockIndex: 0,
    blocks,
    encountersLeft: road.encountersFor(index),
    pursePaid: false,
    chestPaid: false,
    route: [index],
    loop: false,
    destination: to.id,
    legIndex: 0,
    laps: 0,
    // every fresh leg starts the clean-lap clock at the Push counter as it stands, so a lap that
    // never moved it counts as clean when the loop wraps (`advanceLeg`)
    pushesAtLapStart: state.counters.pushes,
  };
}

/** Opt-in and online-friendly: a one-off trip replaces zone farming for its own link's minutes. */
export function startTrip(state: GameState, index: number): { ok: boolean; why?: string } {
  if (state.road) return { ok: false, why: 'already on the Road' };
  if (!linkReachable(state, index)) return { ok: false, why: 'one end of that link is not reachable yet' };
  if (state.phase === 'camp') return { ok: false, why: 'recovering at camp' };
  state.road = setupLeg(state, index);
  state.group = [];
  return { ok: true };
}

const sharesSettlement = (a: number, b: number) => {
  const la = road.links[a], lb = road.links[b];
  return la.a === lb.a || la.a === lb.b || la.b === lb.a || la.b === lb.b;
};

/**
 * Plot a route to any settlement the character can reach: the shortest chain of links, laid down one
 * go and walked block by block. It is the same structure as a Circuit (`route` + `loop`), which is
 * why one validator serves both — the only difference is that a route ends and a Circuit repeats.
 */
export function plotRoute(state: GameState, destinationId: string): { ok: boolean; why?: string; route?: number[] } {
  const here = standingSettlement(state);
  if (!here) return { ok: false, why: 'a route may only be plotted while standing in a settlement' };
  if (state.phase === 'camp') return { ok: false, why: 'recovering at camp' };
  if (destinationId === here.id) return { ok: false, why: 'that is where you stand' };
  const route = road.routeLinks(here.name, settlementById(destinationId)?.name);
  if (!route) return { ok: false, why: 'no road reaches that settlement' };
  // Only the first link must touch known ground: every next link is reached by arriving at the
  // settlement before it, so a plotted route can open new settlements without skipping them.
  if (!linkReachable(state, route[0])) return { ok: false, why: 'the first link on that route is not reachable yet' };
  const trip = setupLeg(state, route[0], here.id);
  trip.route = route;
  trip.destination = destinationId;
  state.road = trip;
  state.group = [];
  return { ok: true, route };
}

/** How far a plotted route would take, in blocks and encounters — the price of the choice, up front. */
export function routePreview(state: GameState, destinationId: string): { blocks: number; encounters: number; links: number } | null {
  const here = standingSettlement(state);
  const dest = settlementById(destinationId);
  if (!here || !dest) return null;
  const route = road.routeLinks(here.name, dest.name);
  if (!route) return null;
  const s = road.routeStats(route);
  return { blocks: s.blocks, encounters: s.encounters, links: route.length };
}

/**
 * A Circuit is a route with `loop` set: an ordered list of links that repeats until stopped. It
 * must be a real walk — every consecutive pair shares a settlement, the loop closes, and it must
 * start where the player stands. Editing is a settlement-only act, never while walking (§5).
 */
export function circuitValid(state: GameState, links: number[]): { ok: boolean; why?: string } {
  const here = standingSettlement(state);
  if (!here) return { ok: false, why: 'a Circuit may only be edited in a settlement' };
  if (!links.length) return { ok: false, why: 'a Circuit needs at least one link' };
  for (const i of links) if (!linkReachable(state, i)) return { ok: false, why: `${linkLabel(i)} is not reachable yet` };
  const first = road.links[links[0]];
  if (first.a !== here.name && first.b !== here.name) return { ok: false, why: 'the Circuit must start at the settlement you stand in' };
  for (let i = 0; i < links.length; i++) {
    if (!sharesSettlement(links[i], links[(i + 1) % links.length])) {
      return { ok: false, why: `${linkLabel(links[i])} and ${linkLabel(links[(i + 1) % links.length])} do not meet` };
    }
  }
  return { ok: true };
}

export function startCircuit(state: GameState, links: number[]): { ok: boolean; why?: string } {
  if (state.road) return { ok: false, why: 'already on the Road' };
  if (state.phase === 'camp') return { ok: false, why: 'recovering at camp' };
  const v = circuitValid(state, links);
  if (!v.ok) return v;
  const trip = setupLeg(state, links[0], standingSettlement(state).id);
  trip.route = [...links];
  trip.loop = true;
  trip.destination = null;
  state.road = trip;
  state.group = [];
  return { ok: true };
}

/**
 * Stop a Circuit. Mid-leg it lets the current leg finish — the route is cut down to the leg being
 * walked and becomes a plotted route to that leg's destination, so the character arrives somewhere
 * legal rather than being dropped on the road. Standing in a settlement ends the walk outright.
 */
export function stopCircuit(state: GameState): { ok: boolean; why?: string } {
  if (!state.road) return { ok: true };
  if (!state.road.loop) return { ok: false, why: 'that is a plotted route, not a Circuit' };
  if (standingSettlement(state)) { endTrip(state, 'complete'); return { ok: true }; }
  const trip = state.road;
  trip.loop = false;
  trip.route = trip.route.slice(0, trip.legIndex + 1);
  trip.destination = trip.settlementTo;
  return { ok: true };
}

/** Which zone's cast an encounter draws from: the lower-numbered zone first, read off the link. */
export function encounterZones(index: number): { lower: number; higher: number } {
  const p = road.zonePair(index);
  return { lower: Math.min(p.a, p.b), higher: Math.max(p.a, p.b) };
}

/** How many mobs this encounter type brings, from the doc's own wording. */
export function encounterSizes(kind: string, rng: () => number): { large: number; small: number; medium: number } {
  if (kind === 'ambush') return { large: 0, small: rng() < 0.5 ? 2 : 3, medium: 0 };
  if (kind === 'caravan') return { large: 1, small: 2, medium: 0 };
  return { large: 0, small: 0, medium: 0 };
}

/**
 * A save written before the walk arrives with a leg and no block, and with the old `circuit` list.
 * Filling the missing keys here keeps every restore path one line long, and it is idempotent — a
 * walk already in progress passes through untouched.
 */
export function normaliseTrip(state: GameState) {
  const t = state.road as any;
  if (!t) return state;
  const legacy: number[] = Array.isArray((t as any).circuit) ? (t as any).circuit : [];
  t.route = Array.isArray(t.route) && t.route.length ? t.route : (legacy.length ? [...legacy] : [t.linkIndex]);
  t.loop = typeof t.loop === 'boolean' ? t.loop : legacy.length > 0;
  t.destination = t.destination ?? (t.loop ? null : t.settlementTo);
  t.blocks = t.blocks ?? road.blocksFor(t.linkIndex);
  t.blockIndex = typeof t.blockIndex === 'number' ? t.blockIndex : 0;
  t.secLeft = typeof t.secLeft === 'number' ? t.secLeft : road.blockSec;
  t.encountersLeft = typeof t.encountersLeft === 'number' ? t.encountersLeft : road.encountersFor(t.linkIndex);
  return state;
}

/** Which block the character is standing on, named the way the map names it. */
export function currentBlock(state: GameState): string | null {
  const t = state.road;
  return t ? road.blockId(t.linkIndex, t.blockIndex) : null;
}

/** Every block id a route covers, in the order it is walked — the plotted path on the sheet. */
export function routeBlockIds(t: { route: number[] }): string[] {
  const out: string[] = [];
  for (const i of t.route) for (let n = 0; n < road.blocksFor(i); n++) out.push(road.blockId(i, n));
  return out;
}
export const routeBlocks = (state: GameState) => (state.road ? routeBlockIds(state.road) : []);

export function endTrip(state: GameState, reason: 'complete' | 'forfeit') {
  state.road = null;
  state.group = [];
  return reason;
}

/** The purse is ladder-link gold only, once per link per day. A branch link never pays one. */
export function payPurse(state: GameState): number {
  const trip = state.road;
  if (!trip || trip.pursePaid) return 0;
  const gold = road.purseGoldFor(trip.linkIndex);
  if (!gold || !purseReady(state, trip.linkIndex)) return 0;
  trip.pursePaid = true;
  state.purseDay[trip.linkIndex] = tripDay(state);
  state.counters.gold += gold;
  return gold;
}

/** One chest roll per link per day; the roll itself belongs to the caller (it needs the drop line). */
export function claimChest(state: GameState): boolean {
  const trip = state.road;
  if (!trip || trip.chestPaid) return false;
  if (!chestReady(state, trip.linkIndex)) return false;
  trip.chestPaid = true;
  state.chestDay[trip.linkIndex] = tripDay(state);
  return true;
}

/** Arriving opens the settlement and parks the character there; Standing is a separate grant. */
export function openArrival(state: GameState, trip: RoadTrip) {
  const dest = settlementById(trip.settlementTo);
  if (!dest) return;
  if (!state.town.visited.includes(dest.id)) state.town.visited.push(dest.id);
  state.zone = dest.zone;
  state.town.waypoint = dest.id;
}

/** Standing arrives as kill-equivalents in the arrival settlement's own zone. */
export function grantTripStanding(state: GameState, trip: RoadTrip) {
  const dest = settlementById(trip.settlementTo);
  if (!dest) return;
  state.counters.zoneKills[dest.zone] = (state.counters.zoneKills[dest.zone] || 0) + E.road.standing_per_trip_kills;
}

/**
 * Finish the block chain just walked. A one-off trip and a plotted route end here; a Circuit
 * advances to the next link in its list, wrapping the loop, and the settled character is where the
 * last leg arrived.
 */
export function advanceLeg(state: GameState, trip: RoadTrip): 'next' | 'done' {
  const last = trip.legIndex + 1;
  if (!trip.loop && last >= trip.route.length) return 'done';
  const next = trip.loop ? last % trip.route.length : last;
  const wrapped = trip.loop && next === 0;
  // the Circuit objective: a lap closed without a Push is recorded as a completion. Non-material on
  // purpose — the Road's gold is capped by G6-G9 and a stone would be a new source, so the reward is
  // the log line; the mint bounds bar a paid reward, so nothing further is owed.
  if (wrapped && state.counters.pushes === (trip.pushesAtLapStart ?? state.counters.pushes)) {
    state.counters.cleanLaps = (state.counters.cleanLaps || 0) + 1;
  }
  const laps = trip.laps + (wrapped ? 1 : 0);
  const fresh = setupLeg(state, trip.route[next], trip.settlementTo);
  fresh.route = trip.route;
  fresh.loop = trip.loop;
  fresh.destination = trip.destination;
  fresh.legIndex = next;
  fresh.laps = laps;
  state.road = fresh;
  return 'next';
}

/**
 * A Push in the middle of a walk skips the rest of the leg instead of ending the route — otherwise
 * a repeated Push would loop forever (§5). A one-off trip still forfeits, and so does the last leg
 * of a plotted route that has nowhere left to go.
 */
export function skipLeg(state: GameState, trip: RoadTrip): 'next' | 'forfeit' {
  if (!trip.loop && trip.legIndex + 1 >= trip.route.length) return 'forfeit';
  // you still arrive where the leg was headed — Standing is what a skipped leg does not pay
  openArrival(state, trip);
  advanceLeg(state, trip);
  return 'next';
}
