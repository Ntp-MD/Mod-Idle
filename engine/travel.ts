/**
 * Route planning — the movement-graph extension boundary (HX2).
 *
 * Pure functions over an explicit context: land comes from the World's land mask (or a fixture's copy
 * of it), ordinary walking costs one uniform duration, and every faster road, closure or directed
 * connection is a fixture-supplied typed edge — there is no live road catalog, discount, toll or
 * weather here, and nothing in this module reads `GameState`, the save or the renderer.
 *
 * Two planners share one edge query (`edgesFrom`), so a preview and a later execution cannot drift into
 * separate cost logic:
 *   - uniform costs → BFS, byte-for-byte the walk order `engine/road.ts` `routeLand` plots (fixed
 *     `HEX_DIRECTIONS` order, FIFO queue, visited-on-enqueue, prev-map reconstruction);
 *   - any differing cost → deterministic Dijkstra, discovery order breaking ties, so the same context
 *     always plans the same route with no new dependency.
 *
 * Costs are validated before planning: a non-finite, zero or negative duration throws, as does a walk
 * edge that is not adjacent, a duplicate edge id, or an override/connection of the wrong kind. An
 * unregistered non-adjacent jump is never usable: non-adjacent edges exist only as declared
 * `connection` edges whose id the context explicitly allows, and they are directed — no reverse edge is
 * ever implied. A plan freezes its leg durations when it is built; `validatePlanForContext` and
 * `replanSuffix` answer the only two questions execution needs later: "is the next leg still there?"
 * and "what is the cheapest suffix from where the feet actually are?"
 *
 * Base geography never moves here: planning reads `isLand` only and changes no zone, terrain or habitat.
 * Static world revision and movement revision are carried separately; route cache keys include both.
 */

import { HEX_DIRECTIONS, hexAdjacent, hexKey, type Hex } from './hex.ts';
import type { MovementEdge } from './world.ts';

/** The movement-edge contract, shared with `engine/world.ts` (HX1 declared it; HX2 plans over it). */
export type { MovementEdge } from './world.ts';
/** Hex coordinates, re-exported so plan/progress callers need one import. */
export type { Hex } from './hex.ts';

/** Static geography vs. movement data: a road closure bumps only `movementRevision`. */
export interface TravelRevisions {
  worldRevision: string;
  movementRevision: string;
}

/**
 * One planning snapshot. `edgeOverrides` are directed fixture walk edges (typically a cheaper longer
 * road); each replaces the ordinary walk across that exact `from`→`to` step. `connections` are declared
 * special transitions; only ids in `allowedConnectionIds` are traversable, so registration alone never
 * opens a jump. `blockedEdgeIds` are closures — ordinary walk ids are `walk:q,r>q,r`, any edge id may be
 * named. All lists are fixture data, not a live catalog.
 */
export interface TravelContext extends TravelRevisions {
  isLand: (h: Hex) => boolean;
  /** The uniform ordinary-walk duration in the simulation time unit (`durationUs` on edges). */
  walkDurationUs: number;
  edgeOverrides?: readonly MovementEdge[];
  connections?: readonly MovementEdge[];
  blockedEdgeIds?: ReadonlySet<string> | readonly string[];
  allowedConnectionIds?: ReadonlySet<string> | readonly string[];
}

/** One planned step: the frozen edge that was chosen. */
export interface TravelLeg {
  edge: MovementEdge;
}

/** A validated route, saved once at travel start; preview/ETA/progress all derive from it. */
export interface TravelPlan {
  origin: Hex;
  destination: Hex;
  legs: readonly TravelLeg[];
  totalDurationUs: number;
  worldRevision: string;
  movementRevision: string;
}

/** Where a plan stands: the committed position plus derived ETA numbers, never new state. */
export interface PlanProgress {
  position: Hex;
  completedLegs: number;
  totalLegs: number;
  completedDurationUs: number;
  activeLegElapsedUs: number;
  remainingDurationUs: number;
  nextLeg: TravelLeg | null;
  done: boolean;
}

export type PlanCheck = { ok: true } | { ok: false; reason: string };

const nz = (n: number): number => (n === 0 ? 0 : n);
const copy = (h: Hex): Hex => ({ q: nz(h.q), r: nz(h.r) });

const assertHex = (h: Hex, what = 'travel'): void => {
  if (!h || !Number.isInteger(h.q) || !Number.isInteger(h.r)) {
    throw new TypeError(`${what}: invalid hex coordinates ${JSON.stringify(h)}`);
  }
};

const assertDuration = (durationUs: number, what: string): void => {
  if (!Number.isFinite(durationUs) || durationUs <= 0) {
    throw new RangeError(`${what}: durationUs must be a finite positive number, got ${String(durationUs)}`);
  }
};

/** The deterministic id of the ordinary walk across one step — the id a closure names to block it. */
export const walkEdgeId = (from: Hex, to: Hex): string => `walk:${hexKey(from)}>${hexKey(to)}`;

/**
 * Validate one typed edge. Throws on a non-finite/zero/negative cost (that is what "reject" means for
 * this module), on non-integer coordinates, on an unknown kind, on a walk edge that is not adjacent,
 * and on a connection that does not move. A connection may be non-adjacent — adjacency is exactly the
 * thing a declared connection is allowed to escape.
 */
export function validateTravelEdge(edge: MovementEdge): void {
  assertHex(edge?.from, 'travel edge from');
  assertHex(edge?.to, 'travel edge to');
  if (!edge.id || typeof edge.id !== 'string') throw new TypeError('travel edge: id must be a non-empty string');
  if (edge.kind !== 'walk' && edge.kind !== 'connection') {
    throw new TypeError(`travel edge ${edge.id}: kind must be 'walk' or 'connection'`);
  }
  assertDuration(edge.durationUs, `travel edge ${edge.id}`);
  if (edge.from.q === edge.to.q && edge.from.r === edge.to.r) {
    throw new Error(`travel edge ${edge.id}: from and to must differ`);
  }
  if (edge.kind === 'walk' && !hexAdjacent(edge.from, edge.to)) {
    throw new Error(`travel edge ${edge.id}: a walk edge must join adjacent cells, ${hexKey(edge.from)} -> ${hexKey(edge.to)} is a jump`);
  }
}

const asSet = (v: ReadonlySet<string> | readonly string[] | undefined): ReadonlySet<string> =>
  v === undefined ? new Set() : v instanceof Set ? v : new Set(v);

/** Validate the whole context once, so every planner entry point fails the same way on bad costs. */
function validateContext(ctx: TravelContext): void {
  if (typeof ctx?.isLand !== 'function') throw new TypeError('travel: context needs an isLand function');
  if (!ctx.worldRevision || typeof ctx.worldRevision !== 'string') throw new TypeError('travel: worldRevision must be a non-empty string');
  if (!ctx.movementRevision || typeof ctx.movementRevision !== 'string') throw new TypeError('travel: movementRevision must be a non-empty string');
  assertDuration(ctx.walkDurationUs, 'travel walkDurationUs');
  const seen = new Set<string>();
  for (const edge of ctx.edgeOverrides ?? []) {
    validateTravelEdge(edge);
    if (edge.kind !== 'walk') throw new TypeError(`travel override ${edge.id}: overrides must be kind 'walk'`);
    if (seen.has(edge.id)) throw new Error(`travel: duplicate edge id ${edge.id}`);
    seen.add(edge.id);
  }
  for (const edge of ctx.connections ?? []) {
    validateTravelEdge(edge);
    if (edge.kind !== 'connection') throw new TypeError(`travel connection ${edge.id}: connections must be kind 'connection'`);
    if (seen.has(edge.id)) throw new Error(`travel: duplicate edge id ${edge.id}`);
    seen.add(edge.id);
  }
}

/**
 * Every traversable directed edge leaving `h`, in planner order: the six walk steps in fixed
 * `HEX_DIRECTIONS` order (each at its override cost, or the uniform default), then allowed declared
 * connections in declaration order. Blocked edges never appear; nothing non-adjacent appears unless
 * the context explicitly allows that connection id.
 */
export function edgesFrom(h: Hex, ctx: TravelContext): MovementEdge[] {
  assertHex(h);
  validateContext(ctx);
  if (!ctx.isLand(h)) return [];
  return edgesFromPrepared(h, ctx, prepareContext(ctx));
}

/** The per-plan lookup tables, built once instead of once per expanded node. */
interface PreparedContext {
  blocked: ReadonlySet<string>;
  allowed: ReadonlySet<string>;
  overrides: Map<string, MovementEdge>;
}

const prepareContext = (ctx: TravelContext): PreparedContext => ({
  blocked: asSet(ctx.blockedEdgeIds),
  allowed: asSet(ctx.allowedConnectionIds),
  overrides: new Map((ctx.edgeOverrides ?? []).map((e) => [`${hexKey(e.from)}>${hexKey(e.to)}`, e])),
});

function edgesFromPrepared(h: Hex, ctx: TravelContext, prep: PreparedContext): MovementEdge[] {
  const origin = copy(h);
  const out: MovementEdge[] = [];
  for (const [dq, dr] of HEX_DIRECTIONS) {
    const to = { q: origin.q + dq, r: origin.r + dr };
    if (!ctx.isLand(to)) continue;
    const override = prep.overrides.get(`${hexKey(origin)}>${hexKey(to)}`);
    const edge = override ?? { id: walkEdgeId(origin, to), from: { q: origin.q, r: origin.r }, to, kind: 'walk' as const, durationUs: ctx.walkDurationUs };
    if (prep.blocked.has(edge.id)) continue;
    out.push({ ...edge, from: copy(edge.from), to: copy(edge.to) });
  }
  const seenTo = new Set(out.map((e) => hexKey(e.to)));
  for (const conn of ctx.connections ?? []) {
    if (conn.from.q !== origin.q || conn.from.r !== origin.r) continue;
    if (!prep.allowed.has(conn.id) || prep.blocked.has(conn.id) || seenTo.has(hexKey(conn.to))) continue;
    if (!ctx.isLand(conn.to)) continue;
    out.push({ ...conn, from: copy(conn.from), to: copy(conn.to) });
  }
  return out;
}

/** True when any traversable fixture edge costs different from the uniform walk — Dijkstra's trigger. */
function hasWeightedEdges(ctx: TravelContext): boolean {
  return (ctx.edgeOverrides ?? []).some((e) => e.durationUs !== ctx.walkDurationUs)
    || (ctx.connections ?? []).some((e) => asSet(ctx.allowedConnectionIds).has(e.id) && e.durationUs !== ctx.walkDurationUs);
}

function buildPlan(from: Hex, to: Hex, edges: MovementEdge[], ctx: TravelContext): TravelPlan {
  const legs = edges.map((edge) => ({ edge: { ...edge, from: copy(edge.from), to: copy(edge.to) } }));
  return {
    origin: copy(from),
    destination: copy(to),
    legs,
    totalDurationUs: edges.reduce((sum, e) => sum + e.durationUs, 0),
    worldRevision: ctx.worldRevision,
    movementRevision: ctx.movementRevision,
  };
}

/** BFS over `edgesFrom` — the exact order `engine/road.ts` `routeLand` plots, with blocked edges removed. */
function planUniform(from: Hex, to: Hex, ctx: TravelContext, prep: PreparedContext): MovementEdge[] | null {
  const startKey = hexKey(from);
  const prev = new Map<string, MovementEdge>([]);
  const seen = new Set<string>([startKey]);
  const queue: Hex[] = [{ q: from.q, r: from.r }];
  for (let head = 0; head < queue.length; head++) {
    const here = queue[head];
    if (hexKey(here) === hexKey(to)) break;
    for (const edge of edgesFromPrepared(here, ctx, prep)) {
      const key = hexKey(edge.to);
      if (seen.has(key)) continue;
      seen.add(key);
      prev.set(key, edge);
      queue.push(edge.to);
    }
  }
  if (!seen.has(hexKey(to))) return null;
  const edges: MovementEdge[] = [];
  for (let at = hexKey(to); at !== startKey; ) {
    const edge = prev.get(at);
    if (!edge) return null;
    edges.unshift(edge);
    at = hexKey(edge.from);
  }
  return edges;
}

/** Dijkstra over `edgesFrom`: smallest total duration wins; equal totals keep discovery order. */
function planWeighted(from: Hex, to: Hex, ctx: TravelContext, prep: PreparedContext): MovementEdge[] | null {
  const startKey = hexKey(from);
  const goalKey = hexKey(to);
  const dist = new Map<string, number>([[startKey, 0]]);
  const prev = new Map<string, MovementEdge>();
  const discovery = new Map<string, number>([[startKey, 0]]);
  const settled = new Set<string>();
  let seq = 0;
  for (;;) {
    let best: string | null = null;
    let bestDist = Infinity;
    let bestSeq = Infinity;
    for (const [key, d] of dist) {
      if (settled.has(key)) continue;
      const order = discovery.get(key) ?? Infinity;
      if (d < bestDist || (d === bestDist && order < bestSeq)) { best = key; bestDist = d; bestSeq = order; }
    }
    if (best === null) return null;
    if (best === goalKey) break;
    settled.add(best);
    const [q, r] = best.split(',').map(Number);
    for (const edge of edgesFromPrepared({ q, r }, ctx, prep)) {
      const key = hexKey(edge.to);
      const next = bestDist + edge.durationUs;
      const known = dist.get(key);
      if (known === undefined) {
        dist.set(key, next);
        discovery.set(key, ++seq);
        prev.set(key, edge);
      } else if (next < known && !settled.has(key)) {
        dist.set(key, next);
        prev.set(key, edge);
      }
    }
  }
  const edges: MovementEdge[] = [];
  for (let at = goalKey; at !== startKey; ) {
    const edge = prev.get(at);
    if (!edge) return null;
    edges.unshift(edge);
    at = hexKey(edge.from);
  }
  return edges;
}

/**
 * Plan from `from` to `to`, or null where no traversable chain exists (either end off land, or the
 * land/edge set disconnects them) — unreachable is an answer, never a throw. Bad costs and malformed
 * edges throw instead, before any route is returned. The returned plan's durations are frozen at this
 * context; re-plan the suffix if the context changes.
 */
export function planTravel(from: Hex, to: Hex, ctx: TravelContext): TravelPlan | null {
  assertHex(from, 'travel from');
  assertHex(to, 'travel to');
  validateContext(ctx);
  if (!ctx.isLand(from) || !ctx.isLand(to)) return null;
  if (from.q === to.q && from.r === to.r) {
    return buildPlan(from, to, [], ctx);
  }
  const prep = prepareContext(ctx);
  const edges = hasWeightedEdges(ctx) ? planWeighted(from, to, ctx, prep) : planUniform(from, to, ctx, prep);
  return edges ? buildPlan(from, to, edges, ctx) : null;
}

/** The ordered cells a plan crosses, origin included — the chain a preview lights up. */
export const planCells = (plan: TravelPlan): Hex[] =>
  [plan.origin, ...plan.legs.map((leg) => leg.edge.to)];

export const planKeys = (plan: TravelPlan): string[] => planCells(plan).map(hexKey);

/**
 * Project a plan's progress without re-solving anything: the committed position after
 * `completedLegs` finished legs, the frozen durations already spent, and what remains (ETA). Painting
 * and HUD counters read this; they never call the pathfinder.
 */
export function projectProgress(plan: TravelPlan, completedLegs: number, activeLegElapsedUs = 0): PlanProgress {
  if (!Number.isInteger(completedLegs) || completedLegs < 0 || completedLegs > plan.legs.length) {
    throw new RangeError(`travel progress: completedLegs ${String(completedLegs)} is outside 0..${plan.legs.length}`);
  }
  if (!Number.isFinite(activeLegElapsedUs) || activeLegElapsedUs < 0) {
    throw new RangeError(`travel progress: activeLegElapsedUs must be a finite non-negative number, got ${String(activeLegElapsedUs)}`);
  }
  const completedDurationUs = plan.legs.slice(0, completedLegs).reduce((sum, leg) => sum + leg.edge.durationUs, 0);
  const nextLeg = plan.legs[completedLegs] ?? null;
  const active = nextLeg ? Math.min(activeLegElapsedUs, nextLeg.edge.durationUs) : 0;
  const position = completedLegs === 0 ? copy(plan.origin) : copy(plan.legs[completedLegs - 1].edge.to);
  return {
    position,
    completedLegs,
    totalLegs: plan.legs.length,
    completedDurationUs,
    activeLegElapsedUs: active,
    remainingDurationUs: Math.max(0, plan.totalDurationUs - completedDurationUs - active),
    nextLeg,
    done: nextLeg === null,
  };
}

/**
 * Is this saved plan still the plan this context would execute? Checks both revisions, land under
 * every leg, and that each planned edge is still traversable at its frozen duration. Anything stale
 * reports an explicit reason instead of silently executing.
 */
export function validatePlanForContext(plan: TravelPlan, ctx: TravelContext): PlanCheck {
  validateContext(ctx);
  if (plan.worldRevision !== ctx.worldRevision) return { ok: false, reason: `stale world revision ${plan.worldRevision} (context ${ctx.worldRevision})` };
  if (plan.movementRevision !== ctx.movementRevision) return { ok: false, reason: `stale movement revision ${plan.movementRevision} (context ${ctx.movementRevision})` };
  if (!ctx.isLand(plan.origin) || !ctx.isLand(plan.destination)) return { ok: false, reason: 'plan endpoint is no longer land' };
  for (const leg of plan.legs) {
    validateTravelEdge(leg.edge);
    const live = edgesFrom(leg.edge.from, ctx).find((e) => e.id === leg.edge.id);
    if (!live) return { ok: false, reason: `edge ${leg.edge.id} is no longer traversable` };
    if (live.durationUs !== leg.edge.durationUs) {
      return { ok: false, reason: `edge ${leg.edge.id} duration changed ${leg.edge.durationUs} -> ${live.durationUs}` };
    }
  }
  return { ok: true };
}

/**
 * Re-plan only the unwalked suffix from the committed position after `completedLegs` legs, against the
 * current context. Null means no suffix exists: the caller stops safely at the committed position —
 * completed progress is never rewritten here. The frozen prefix stays the caller's to keep.
 */
export function replanSuffix(plan: TravelPlan, completedLegs: number, ctx: TravelContext): TravelPlan | null {
  const progress = projectProgress(plan, completedLegs);
  if (progress.done) return buildPlan(progress.position, plan.destination, [], ctx);
  return planTravel(progress.position, plan.destination, ctx);
}

/** A cache key that separates static geography from movement costs and fixture context. */
export function travelCacheKey(from: Hex, to: Hex, ctx: TravelContext): string {
  const ids = (list: readonly MovementEdge[]) =>
    list.map((e) => `${e.id}@${e.durationUs}`).sort().join('|');
  const sorted = (v: ReadonlySet<string> | readonly string[] | undefined) => [...asSet(v)].sort().join('|');
  return `t1|${hexKey(from)}>${hexKey(to)}|w${ctx.worldRevision}|m${ctx.movementRevision}|d${ctx.walkDurationUs}|o${ids(ctx.edgeOverrides ?? [])}|c${ids(ctx.connections ?? [])}|b${sorted(ctx.blockedEdgeIds)}|a${sorted(ctx.allowedConnectionIds)}`;
}
