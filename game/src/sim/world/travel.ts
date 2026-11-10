/**
 * Travel transitions (HX3) — the one owner of departure, step commits, arrival, warp and recovery
 * position changes.
 *
 * `commitPosition` is the single transition function: every start/stop/step/warp writes `state.cell`
 * plus its World projections (zone, content, terrain) from the hex coordinates together. `currentCell`
 * reads that committed position — never a route — so the pawn, the sim and the map always agree.
 *
 * Content is resolved from coordinates (F4): a mine hex is a mine no matter what the caller supplied,
 * and a bare hex is hunting ground even if a stale `site` was attached. Field lives are parked once
 * on departure and activated only on a real stop; transit commits carry no field and write no archive
 * (F7). Zone changes mid-walk commit position but never auto-select a preset; arrival selects once.
 */
import { E, ED, TOWN, road } from '../../engine/client';
import { checkpointFieldLives, createFieldState, fieldAreaKey } from './field-area';
import { hexAdjacent } from '../../../../engine/hex.ts';
import type { Hex } from '../../../../engine/hex.ts';
import { createWorld } from '../../../../engine/world.ts';
import type { WorldCell } from '../../../../engine/world.ts';
import { priceGold, rowById } from '../town/pricing';
import { abandonRun } from './dungeon';
import { autoSelect } from '../core/presets';
import type { Cell, FieldSite, GameState, Walk } from '../core/types';
import { spendGold } from '../core/types';
import type { EngineData } from '../../../../engine/types.ts';

/** Canonical world queries (HX1): content resolves from coordinates, never from caller metadata. */
const world = createWorld(ED as unknown as EngineData, TOWN.settlements as Array<{ id: string; zone: number }>);

export interface ResolvedCell {
  coord: Hex;
  cell: Cell;
  zone: number;
  ownerId: string;
  kind: 'town' | 'sub' | 'bare';
  rank: number;
  feature: WorldCell['features'][number] | null;
}

/** World projections for one hex: content, zone, owner and rank, derived in one place. */
export function resolveCell(h: Hex): ResolvedCell | null {
  const wc = world.cellAt(h);
  if (!wc) return null;
  const owner = road.owningNode(h, standingOrder);
  const feature = wc.features[0] ?? null;
  const kind: 'town' | 'sub' | 'bare' = feature
    ? feature.kind === 'town' ? 'town' : feature.kind === 'sub' ? 'sub' : 'bare'
    : 'bare';
  return {
    coord: { q: h.q, r: h.r },
    cell: {
      q: h.q, r: h.r,
      sub: feature?.kind === 'sub' ? feature.index : null,
      site: feature?.kind === 'site' ? (feature.site as FieldSite) ?? null : null,
      terrain: wc.locationId ? (wc.terrainId as string) : null,
    },
    zone: wc.zoneId,
    ownerId: owner.id,
    kind,
    rank: road.cellRank(h),
    feature,
  };
}

/** The standing order a tied bare cell resolves in: lowest zone wins (`road.standing_rule`). */
export const standingOrder: string[] = TOWN.settlements
  .slice()
  .sort((a: { zone: number }, b: { zone: number }) => a.zone - b.zone)
  .map((s: { id: string }) => s.id);

/** The one position transition: committed cell plus every World projection, always together. */
export function commitPosition(state: GameState, h: Hex): ResolvedCell | null {
  const resolved = resolveCell(h);
  if (!resolved) return null;
  state.cell = resolved.cell;
  state.zone = resolved.zone;
  return resolved;
}

/** The committed feet: the last written position, including mid-walk. Never a route reconstruction. */
export function currentCell(state: GameState): Hex {
  if (state.cell) return { q: state.cell.q, r: state.cell.r };
  const home = road.nodeById(state.town?.waypoint || E.road.nodes[0].id) || E.road.nodes[0];
  return { q: home.q, r: home.r };
}

// ---------- journey representation ----------

export interface JourneyLeg { from: Hex; to: Hex }

export function journeyCells(walk: Walk): Hex[] {
  return [walk.origin, ...walk.legs.map((leg) => leg.to)];
}

/** Every cell entered, up to and including the current step (map lighting key). */
export function journeyWalkedCells(state: GameState): string[] {
  const w = state.walk;
  if (!w) return [];
  const cells = journeyCells(w);
  const done = Math.min(w.stepIndex, cells.length - 1);
  return road.hexKeys(cells.slice(0, Math.max(0, done) + 1));
}

/** The whole planned road, in crossing order (map lighting key). */
export function journeyTrailCells(state: GameState): string[] {
  const w = state.walk;
  return w ? road.hexKeys(journeyCells(w)) : [];
}

// ---------- field park / activate ----------

/**
 * Park the origin field exactly once, on departure: lives checkpoint into slots, the whole field
 * archives under its own area key (bounded retention), and no live field is carried through transit.
 */
function parkFieldAtDeparture(state: GameState): void {
  if (!state.field) return;
  checkpointFieldLives(state);
  const entry = {
    ...JSON.parse(JSON.stringify(state.field)),
    savedAtSec: state.clockSec,
    sessionActive: false,
    quietSec: 0,
    engagementIds: [] as string[],
    engagementCauses: {} as Record<string, unknown>,
  };
  state.fieldArchive ??= {};
  state.fieldArchive[state.field.areaKey] = entry;
  const entries = Object.entries(state.fieldArchive).sort((a, b) => b[1].savedAtSec - a[1].savedAtSec);
  for (const [stale] of entries.slice(6)) delete state.fieldArchive[stale];
}

/**
 * Activate the stopped field once: restore the archived lives for this exact area key when one
 * exists, otherwise leave `state.field` empty so the next population tick creates it fresh.
 */
function activateFieldOnStop(state: GameState): void {
  const key = fieldAreaKey(state);
  const archived = state.fieldArchive?.[key];
  if (!archived) {
    // No archived field for this stop: drop any transit placeholder so a fresh one is created.
    if (state.field && state.field.areaKey !== key) state.field = null;
    else if (state.field && state.field.areaKey === key) {
      state.field.engagementIds = [];
      state.field.sessionActive = false;
    }
    return;
  }
  delete state.fieldArchive![key];
  const restored = {
    ...JSON.parse(JSON.stringify(archived)),
    areaKey: key,
    arenaEpoch: Math.max(archived.arenaEpoch, state.field?.arenaEpoch ?? 1) + 1,
    savedAtSec: undefined,
    sessionActive: false,
    quietSec: 0,
    engagementIds: [] as string[],
    engagementCauses: {} as Record<string, 'proximity' | 'contact' | 'assist'>,
    lastSeenAtSec: state.clockSec,
  } as unknown as NonNullable<GameState['field']>;
  state.field = restored;
  if (state.group.some((mob) => mob.hp > 0)) return;
  for (const slot of restored.slots) {
    if (!slot.mobId || !slot.life) continue;
    const mob = JSON.parse(JSON.stringify(slot.life.mob));
    mob.id = slot.mobId;
    mob.hp = slot.life.hp;
    mob.hpMax = slot.life.hpMax;
    mob.spawnSlotId = slot.id;
    state.group.push(mob);
    if (slot.life.mark) state.mobStatus[mob.id] = JSON.parse(JSON.stringify(slot.life.mark));
  }
}

// ---------- departure ----------

/**
 * Lay a journey to any land cell: one deterministic route, frozen once. Rejects before any mutation,
 * so a rejected start spends nothing and consumes no journey id. `dest` carries only coordinates —
 * every other fact resolves through World, so a mine hex is a mine whatever the caller supplied.
 */
export function startWalk(state: GameState, dest: Cell): { ok: boolean; why?: string; forfeit?: string } {
  if (state.walk) return { ok: false, why: 'already walking' };
  if (state.phase === 'camp') return { ok: false, why: 'recovering at camp' };
  const from = currentCell(state);
  const to: Hex = { q: dest.q, r: dest.r };
  const path = road.routeLand(from, to);
  if (!path) return { ok: false, why: 'no walkable route — the destination is across land feet cannot cross' };
  const legs: JourneyLeg[] = path.slice(1).map((cell: Hex, i: number) => ({ from: { ...path[i] }, to: { ...cell } }));
  if (!legs.length) return { ok: false, why: 'you are already there' };
  const keys = road.hexKeys(path);
  for (let i = 1; i < keys.length; i++) {
    if (!adjacentKey(keys[i - 1], keys[i])) return { ok: false, why: 'the plotted route leaves the lattice' };
  }
  state.travelSeq = Math.max(0, Math.floor(Number(state.travelSeq ?? 0))) + 1;
  const walk: Walk = {
    from, to,
    fromZone: state.zone,
    journeyId: state.travelSeq,
    origin: { ...from },
    legs,
    stepIndex: 0,
    secLeft: road.blockSec,
    lastEventStep: 0,
  };
  state.walk = walk;
  if (state.fieldwork) state.fieldwork.action = null;
  // Park once: the standing fight ends, its lives stay in their slots for the return. The
  // origin field stays current until the first step commit drops it, so a pre-step save and
  // the re-laid route keep their parked lives; only real transit nulls it.
  parkFieldAtDeparture(state);
  state.group = [];
  state.player.atkTimer = 0;
  const forfeit = state.dungeon ? abandonRun(state, 'Walked out') : undefined;
  return { ok: true, forfeit };
}

/** Two sheet keys share an edge — the one step a block is allowed to take. */
const adjacentKey = (a: string, b: string) => {
  const [aq, ar] = a.split(',').map(Number);
  const [bq, br] = b.split(',').map(Number);
  return hexAdjacent({ q: aq, r: ar }, { q: bq, r: br });
};

// ---------- step commit ----------

export interface StepCommit {
  entered: Hex | null;
  zone: number;
  final: boolean;
  duplicate: boolean;
  stopped: boolean;
}

/**
 * Cross one leg: validate the frozen edge, then commit the entered cell and its projections
 * together. Idempotent per leg — a receipt already processed never commits or events twice.
 * Transit carries no field and selects no preset; those activate only on a real stop.
 */
export function commitStep(state: GameState): StepCommit {
  const walk = state.walk;
  if (!walk) return { entered: null, zone: state.zone, final: false, duplicate: true, stopped: false };
  const legs = walk.legs;
  const index = walk.stepIndex;
  if (index >= legs.length) return { entered: legs.at(-1)?.to ?? walk.to, zone: state.zone, final: true, duplicate: true, stopped: false };
  const leg = legs[index];
  // The leg must still be the frozen walk across one edge onto land.
  if (!leg || !hexAdjacent(leg.from, leg.to) || !road.isLand(leg.to)) {
    // Stop safely at the committed position: progress so far is never rewritten.
    state.walk = null;
    return { entered: currentCell(state), zone: state.zone, final: true, duplicate: false, stopped: true };
  }
  const resolved = commitPosition(state, leg.to);
  if (!resolved) {
    state.walk = null;
    return { entered: leg.from, zone: state.zone, final: true, duplicate: false, stopped: true };
  }
  walk.stepIndex = index + 1;
  walk.secLeft = road.blockSec;
  // Suppress transit preset selection: game.ts auto-selects when `lastAutoZone` lags the zone,
  // so syncing it here keeps arrival the one selection point.
  state.lastAutoZone = state.zone;
  const final = walk.stepIndex >= legs.length;
  if (!final) {
    // Transit: drop the placeholder field so later ticks create per-step fields without
    // writing any transit archive. The origin already lives in `fieldArchive`.
    state.field = null;
  }
  return { entered: { q: leg.to.q, r: leg.to.r }, zone: state.zone, final, duplicate: false, stopped: false };
}

// ---------- arrival ----------

export interface ArrivalInfo {
  name: string;
  first: boolean;
  town: boolean;
  kind: 'town' | 'sub' | 'bare';
  cell: Cell | null;
}

/**
 * Arrive or stop: finalize the journey against the actual cell, unlock a stopped-at town once,
 * select the arrival activity/preset, and activate the stopped field only when one is archived.
 * Content always re-resolves from coordinates, so a stopped-at mine is a mine whatever metadata
 * the walk once carried.
 */
export function completeJourney(state: GameState, walk?: Walk): ArrivalInfo | null {
  const finished = walk ?? state.walk;
  if (!finished) return null;
  const resolved = commitPosition(state, finished.to);
  const node = resolved?.ownerId ?? '';
  const dest = (TOWN.settlements as Array<{ id: string; name: string; zone: number }>).find((s) => s.id === node);
  const rank = road.cellRank(finished.to);
  let first = false;
  if (rank === 0 && dest) {
    first = !state.town.visited.includes(dest.id);
    if (first) state.town.visited.push(dest.id);
    state.town.waypoint = dest.id;
  }
  state.walk = null;
  checkpointFieldLives(state);
  state.group = [];
  // A settlement, a same-cell Field Camp, or a wild-side cell is safe ground.
  const camp = state.fieldwork?.camp;
  const atCamp = !!camp && camp.zone === state.zone && camp.cell.q === state.cell?.q && camp.cell.r === state.cell?.r;
  const safe = rank === 0 || atCamp || !!resolved?.cell.site;
  state.hunting = !safe;
  activateFieldOnStop(state);
  // The one arrival preset selection (transit synced `lastAutoZone` past every mid-walk change).
  if (finished.fromZone !== state.zone && state.lastAutoZone !== state.zone) {
    state.lastAutoZone = state.zone;
    autoSelect(state, state.zone);
  }
  return { name: dest?.name ?? node, first, town: rank === 0, kind: resolved?.kind ?? 'bare', cell: state.cell };
}

// ---------- warp ----------

export const warpRow: any = () => rowById('waypoint_warp');

/** What a warp to this settlement costs, quoted from the actual committed position. */
export function warpCost(state: GameState, id: string): number {
  const row = warpRow();
  if (!row) return 0;
  const dest = road.nodeById(id);
  const feet = currentCell(state);
  const blocks = dest ? (road.blocksLand(feet, dest) ?? road.blocksBetweenHex(feet, dest)) : road.blocksBetween(state.town.waypoint, id);
  return priceGold(row, id, state, Math.max(1, blocks));
}

/**
 * The one Waypoint readiness: the card's button and fare and the command's recheck read this same
 * result, so they cannot disagree (F3). Pure — it never mutates and a refusal spends nothing.
 */
export function warpReadiness(state: GameState, id: string): { ok: boolean; why: string; fare: number } {
  const dest = (TOWN.settlements as Array<{ id: string }>).find((s) => s.id === id);
  const fare = dest ? warpCost(state, id) : 0;
  if (state.walk) return { ok: false, why: 'mid-walk — finish the route or turn back', fare };
  if (state.phase === 'camp') return { ok: false, why: 'recovering at camp', fare };
  if (!dest) return { ok: false, why: 'no such settlement', fare };
  const stop = road.nodeById(id);
  if (stop) {
    const feet = currentCell(state);
    if (feet.q === stop.q && feet.r === stop.r) return { ok: false, why: 'you already stand there', fare };
  }
  if (!state.town.visited.includes(id)) return { ok: false, why: 'no Waypoint — reach it on foot first', fare };
  if (state.counters.gold < fare) return { ok: false, why: `needs ${fare} gold`, fare };
  return { ok: true, why: '', fare };
}

/**
 * Warp: the same commit + arrival policy with an explicit reason. Rechecks the shared readiness
 * against current state, then debits once — every refusal spends nothing.
 */
export function warpTo(state: GameState, id: string, reason = 'Warped out'): { ok: boolean; why?: string; gold?: number; forfeit?: string } {
  const ready = warpReadiness(state, id);
  if (!ready.ok) return { ok: false, why: ready.why };
  const stop = road.nodeById(id);
  const fromZone = state.zone;
  parkFieldAtDeparture(state);
  spendGold(state.counters, ready.fare);
  commitPosition(state, stop ?? { q: 0, r: 0 });
  state.town.waypoint = id;
  checkpointFieldLives(state);
  state.group = [];
  state.hunting = false;
  if (state.fieldwork) state.fieldwork.action = null;
  activateFieldOnStop(state);
  if (fromZone !== state.zone && state.lastAutoZone !== state.zone) {
    state.lastAutoZone = state.zone;
    autoSelect(state, state.zone);
  }
  const forfeit = state.dungeon ? abandonRun(state, reason) : undefined;
  return { ok: true, gold: ready.fare, forfeit };
}

/** Recovery (Push) keeps the published interrupted-walk policy: `push-stage` ends or resumes. */
export function journeyWalk(state: GameState): Walk | null {
  return state.walk;
}
