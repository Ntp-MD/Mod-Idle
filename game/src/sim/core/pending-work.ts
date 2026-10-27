/**
 * Released, still-unpaid arena work in a save-safe shape.
 *
 * A cast is paid and committed at release; its impact can land in a later tick. The arena itself is
 * transient, so without this ledger a save or reload between release and impact would lose the hit
 * the character already paid for. Only the executable facts are stored: identities, prepared cast,
 * committed geometry, timing, the attacker snapshot and the last gameplay positions.
 */
import { sm } from '../../engine/client';
import type { SkillAreaSnapshot, SkillCastProfile, SkillCastTiming } from '../../../../engine/types.ts';
import type { CombatArena, CombatArenaAction } from '../combat/combat-arena';
import type { CombatFlight } from '../combat/combat-actions';
import type { Character } from './player';
import type { CastRollCache } from '../combat/skills';
import type { GameState, Mob } from './types';

type Point = { x: number; y: number };

export interface PendingFlightState {
  actionId: number;
  skillId: string;
  /** Living bodies selected at release; anything gone by the restore is dropped. */
  targetIds: string[];
  prepared: Omit<CombatFlight['cast'], 'targets'>;
  character: Character;
  modifiers: CombatFlight['modifiers'];
  profile: SkillCastProfile;
  timing: SkillCastTiming;
  source: Point;
  destination: Point;
  area?: SkillAreaSnapshot;
  position: Point;
  lastCheckedAtUs: number;
  /** Encounter identity at release; a restore in another area cancels the flight with a receipt. */
  areaKey?: string;
  /** Multi-impact identity and shared cast cache, so a reload cannot reroll a prepared press. */
  impactIndex?: number;
  impactSharePct?: number;
  rolls?: CastRollCache;
  follow?: boolean;
  hitTargetId?: string;
}

export interface PendingMobFlightState {
  actionId: number;
  mobId: string;
  /** Offensive receipt at release; live death or control cannot invalidate the committed shot. */
  mob: Mob;
  source: Point;
  destination: Point;
  position: Point;
  releaseAtUs: number;
  impactAtUs: number;
  speedMps: number;
  radiusM: number;
  skillId?: string;
  kind?: 'projectile' | 'ground';
  impactRadiusM?: number;
  areaKey?: string;
}

export interface PendingWorkState {
  clockUs: number;
  unitsPerSec: number;
  player: Point;
  actors: { id: string; x: number; y: number }[];
  actions: CombatArenaAction[];
  flights: PendingFlightState[];
  mobFlights: PendingMobFlightState[];
}

/** Copy through JSON so the ledger never aliases a live arena, Character or mob record. */
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const isPoint = (value: unknown): value is Point => {
  const point = value as Point | null;
  return !!point && finite(point.x) && finite(point.y);
};

export function snapshotPendingWork(arena: CombatArena, group: readonly Mob[]): PendingWorkState | null {
  if (!arena.flights.length && !arena.mobFlights.length) return null;
  const actionIds = new Set([...arena.flights.map((flight) => flight.actionId),
    ...arena.mobFlights.map((shot) => shot.actionId)]);
  return copy({
    clockUs: arena.nowUs,
    unitsPerSec: arena.unitsPerSec,
    player: { x: arena.player.x, y: arena.player.y },
    actors: group
      .filter((mob) => mob.hp > 0 && arena.mobs[mob.id])
      .map((mob) => ({ id: mob.id, x: arena.mobs[mob.id].x, y: arena.mobs[mob.id].y })),
    actions: arena.actions.filter((action) => actionIds.has(action.id)).map(({ payloads, ...action }) => action),
    flights: arena.flights.map((flight) => ({
      actionId: flight.actionId,
      skillId: flight.cast.id,
      targetIds: flight.cast.targets.map((mob) => mob.id),
      prepared: { id: flight.cast.id, manaCost: flight.cast.manaCost, hpCost: flight.cast.hpCost,
        level: flight.cast.level, cooldownSec: flight.cast.cooldownSec,
        spatial: flight.cast.spatial, area: flight.cast.area },
      character: flight.character,
      modifiers: flight.modifiers,
      profile: flight.profile,
      timing: flight.timing,
      source: flight.source,
      destination: flight.destination,
      area: flight.area,
      position: flight.position,
      lastCheckedAtUs: flight.lastCheckedAtUs,
      ...(flight.areaKey ? { areaKey: flight.areaKey } : {}),
      ...(flight.impactIndex != null ? { impactIndex: flight.impactIndex } : {}),
      ...(flight.impactSharePct != null ? { impactSharePct: flight.impactSharePct } : {}),
      ...(flight.rolls ? { rolls: flight.rolls } : {}),
      ...(flight.follow ? { follow: true } : {}),
      ...(flight.hitTargetId ? { hitTargetId: flight.hitTargetId } : {}),
    })),
    mobFlights: arena.mobFlights.map((shot) => ({
      actionId: shot.actionId,
      mobId: shot.mobId,
      mob: shot.mob,
      source: shot.source,
      destination: shot.destination,
      position: shot.position,
      releaseAtUs: shot.releaseAtUs,
      impactAtUs: shot.impactAtUs,
      speedMps: shot.speedMps,
      radiusM: shot.radiusM,
      ...(shot.skillId ? { skillId: shot.skillId } : {}),
      ...(shot.kind ? { kind: shot.kind } : {}),
      ...(shot.impactRadiusM != null ? { impactRadiusM: shot.impactRadiusM } : {}),
      ...(shot.areaKey ? { areaKey: shot.areaKey } : {}),
    })),
  });
}

/**
 * Put the saved ledger back into a freshly synced arena. The state keeps its copy until the next
 * writer tick refreshes it, so an immediate unload after a load still carries the pending work.
 * Returns how many flights were restored.
 */
export function restorePendingWork(arena: CombatArena, state: GameState): number {
  const work = state.pendingWork;
  if (!work) return 0;
  const living = new Map(state.group.filter((mob) => mob.hp > 0).map((mob) => [mob.id, mob]));
  arena.unitsPerSec = work.unitsPerSec;
  Object.assign(arena.player, { x: work.player.x, y: work.player.y });
  for (const actor of work.actors) {
    const saved = arena.mobs[actor.id];
    if (saved && saved.hp > 0) Object.assign(saved, { x: actor.x, y: actor.y });
  }
  for (const action of work.actions) {
    if (!arena.actions.some((entry) => entry.id === action.id)) arena.actions.push(copy(action));
    arena.actionSeq = Math.max(arena.actionSeq, action.id);
  }
  let restored = 0;
  for (const flight of work.flights) {
    if (!sm.byId[flight.skillId]) continue;
    const targets = flight.targetIds.map((id) => living.get(id)).filter((mob): mob is Mob => !!mob);
    arena.flights.push({
      actionId: flight.actionId,
      cast: { ...copy(flight.prepared), targets },
      character: copy(flight.character),
      modifiers: copy(flight.modifiers),
      profile: copy(flight.profile),
      timing: copy(flight.timing),
      source: { x: flight.source.x, y: flight.source.y },
      destination: { x: flight.destination.x, y: flight.destination.y },
      ...(flight.area ? { area: copy(flight.area) } : {}),
      position: { x: flight.position.x, y: flight.position.y },
      lastCheckedAtUs: flight.lastCheckedAtUs,
      ...(flight.areaKey ? { areaKey: flight.areaKey } : {}),
      ...(flight.impactIndex != null ? { impactIndex: flight.impactIndex } : {}),
      ...(flight.impactSharePct != null ? { impactSharePct: flight.impactSharePct } : {}),
      ...(flight.rolls ? { rolls: copy(flight.rolls) } : {}),
      ...(flight.follow ? { follow: true } : {}),
      ...(flight.hitTargetId ? { hitTargetId: flight.hitTargetId } : {}),
    });
    restored++;
  }
  for (const shot of work.mobFlights) {
    arena.mobFlights.push({
      actionId: shot.actionId,
      mobId: shot.mobId,
      mob: copy(shot.mob),
      source: { x: shot.source.x, y: shot.source.y },
      destination: { x: shot.destination.x, y: shot.destination.y },
      position: { x: shot.position.x, y: shot.position.y },
      releaseAtUs: shot.releaseAtUs,
      impactAtUs: shot.impactAtUs,
      speedMps: shot.speedMps,
      radiusM: shot.radiusM,
      ...(shot.skillId ? { skillId: shot.skillId } : {}),
      ...(shot.kind ? { kind: shot.kind } : {}),
      ...(shot.impactRadiusM != null ? { impactRadiusM: shot.impactRadiusM } : {}),
      ...(shot.areaKey ? { areaKey: shot.areaKey } : {}),
    });
    restored++;
  }
  return restored;
}

/** Save input is a boundary: drop an impossible ledger or an impossible flight by shape, never guess. */
export function normalizePendingWork(value: unknown): PendingWorkState | null {
  if (!value || typeof value !== 'object') return null;
  const work = value as Partial<PendingWorkState>;
  if (!finite(work.unitsPerSec) || work.unitsPerSec <= 0 || !isPoint(work.player)) return null;
  const seen = new Set<number>();
  const seenImpacts = new Set<string>();
  const flights = (Array.isArray(work.flights) ? work.flights : []).filter((flight) => {
    if (!flight || typeof flight !== 'object') return false;
    if (!Number.isInteger(flight.actionId) || flight.actionId <= 0) return false;
    // A multi-impact press deliberately shares its action id; the impact index keeps entries unique.
    const impactKey = `${flight.actionId}:${flight.impactIndex ?? 0}`;
    if (seenImpacts.has(impactKey)) return false;
    if (flight.impactIndex != null && (!Number.isInteger(flight.impactIndex) || flight.impactIndex < 0)) return false;
    if (flight.impactSharePct != null && !finite(flight.impactSharePct)) return false;
    if (flight.follow != null && typeof flight.follow !== 'boolean') return false;
    if (flight.rolls != null && (typeof flight.rolls !== 'object' || !flight.rolls.targets || !flight.rolls.effects))
      return false;
    if (!flight.skillId || !sm.byId[flight.skillId]) return false;
    if (!flight.prepared || flight.prepared.id !== flight.skillId) return false;
    if (!finite(flight.prepared.manaCost) || !finite(flight.prepared.hpCost)) return false;
    if (!isPoint(flight.source) || !isPoint(flight.destination) || !isPoint(flight.position)) return false;
    if (!flight.timing || !finite(flight.timing.releaseAtUs) || !finite(flight.timing.impactAtUs)
      || !finite(flight.timing.startedAtUs) || !finite(flight.timing.recoveryUntilUs)) return false;
    if (!flight.profile || typeof flight.profile.delivery !== 'string'
      || !finite(flight.profile.hit_radius_m)) return false;
    if (!flight.modifiers || typeof flight.modifiers !== 'object') return false;
    const mods = flight.modifiers as Record<string, unknown>;
    const trigger = mods.trigger as Record<string, unknown> | undefined;
    if (trigger && (!finite(trigger.manaMult) || !finite(trigger.damageMult))) return false;
    for (const key of ['critDamageBonusPct', 'missingHpPct']) {
      if (mods[key] != null && !finite(mods[key])) return false;
    }
    if (flight.area && (!isPoint(flight.area.center) || !finite(flight.area.radiusM)
      || (flight.area.origin !== 'caster' && flight.area.origin !== 'target'))) return false;
    if (flight.area) {
      // A committed line/cone keeps its dimensions and direction; drop a ledger that names a
      // shape or a dimension the engine never commits instead of guessing the footprint.
      const shape = (flight.area as { shape?: unknown }).shape;
      if (shape != null && shape !== 'single' && shape !== 'circle' && shape !== 'line' && shape !== 'cone') return false;
      const dims = flight.area as { lengthM?: unknown; widthM?: unknown; angleDeg?: unknown; directionRad?: unknown };
      for (const value of [dims.lengthM, dims.widthM, dims.angleDeg, dims.directionRad]) {
        if (value != null && !finite(value)) return false;
      }
      if (shape === 'line' && (!(finite(dims.lengthM) && (dims.lengthM as number) > 0)
        || !finite(dims.widthM) || !finite(dims.directionRad))) return false;
      if (shape === 'cone' && (!finite(dims.lengthM) || !finite(dims.directionRad)
        || !(finite(dims.angleDeg) && (dims.angleDeg as number) > 0 && (dims.angleDeg as number) <= 180))) return false;
    }
    if (flight.areaKey != null && typeof flight.areaKey !== 'string') return false;
    const character = flight.character;
    if (!character || !finite(character.phys) || !finite(character.magic) || !finite(character.maxHp)
      || !finite(character.critChance) || !finite(character.critDmg)) return false;
    if (!Array.isArray(flight.targetIds) || !flight.targetIds.every((id) => typeof id === 'string')) return false;
    seenImpacts.add(impactKey);
    return true;
  }).slice(0, 32);
  const mobFlights = (Array.isArray(work.mobFlights) ? work.mobFlights : []).filter((shot) => {
    if (!shot || typeof shot !== 'object') return false;
    if (!Number.isInteger(shot.actionId) || shot.actionId <= 0 || seen.has(shot.actionId)) return false;
    if (typeof shot.mobId !== 'string' || !shot.mob || shot.mob.id !== shot.mobId) return false;
    const mob = shot.mob;
    if (!finite(mob.ps) || !finite(mob.hp) || !finite(mob.hpMax) || !finite(mob.hitsPerSec)
      || !finite(mob.acc) || typeof mob.damage !== 'string') return false;
    if (!isPoint(shot.source) || !isPoint(shot.destination) || !isPoint(shot.position)) return false;
    if (!finite(shot.releaseAtUs) || !finite(shot.impactAtUs)) return false;
    if (!finite(shot.speedMps) || shot.speedMps <= 0 || !finite(shot.radiusM) || shot.radiusM < 0) return false;
    if (shot.skillId != null && typeof shot.skillId !== 'string') return false;
    if (shot.kind != null && shot.kind !== 'projectile' && shot.kind !== 'ground') return false;
    if (shot.impactRadiusM != null && (!finite(shot.impactRadiusM) || shot.impactRadiusM < 0)) return false;
    if (shot.areaKey != null && typeof shot.areaKey !== 'string') return false;
    seen.add(shot.actionId);
    return true;
  }).slice(0, 16);
  if (!flights.length && !mobFlights.length) return null;
  const actionIds = new Set([...flights.map((flight) => flight.actionId),
    ...mobFlights.map((shot) => shot.actionId)]);
  const seenActors = new Set<string>();
  return {
    clockUs: finite(work.clockUs) ? work.clockUs : 0,
    unitsPerSec: work.unitsPerSec,
    player: { x: work.player.x, y: work.player.y },
    actors: (Array.isArray(work.actors) ? work.actors : [])
      .filter((actor) => actor && typeof actor.id === 'string' && isPoint(actor)
        && !seenActors.has(actor.id) && (seenActors.add(actor.id), true))
      .slice(0, 64),
    actions: (Array.isArray(work.actions) ? work.actions : [])
      .filter((action) => action && Number.isInteger(action.id) && actionIds.has(action.id))
      .slice(0, 32).map(({ payloads, ...action }) => action),
    flights,
    mobFlights,
  };
}
