/**
 * The loaded local field's identity and its population facts.
 *
 * `s.group` is still the single authoritative combat/HP list during this migration: a spawn unit and
 * the actor registry hold ids, never a second Mob copy. The field owns the cohort/session identity that
 * rewards, per-fight rules and respawn entitlement will read, plus the last gameplay positions needed
 * to resume the same field after a reload.
 */
import { E } from '../engine/client';
import type { CombatArena } from './combat-arena';
import type { GameState, Mob } from './types';

export type FieldPoint = { x: number; y: number };

export interface FieldSpawnUnit {
  id: string;
  cohortId: string;
  /** Original cohort members at spawn; reward/clear attribution reads this set. */
  actorIds: string[];
  kind: string;
  zone: number;
  subzone?: number | string | null;
  /** Set when the unit is cleared; the current wave spawn timer still owns the next spawn. */
  clearedAtSec?: number;
  nextSpawnAtSec?: number;
}

/** A visible unit that is not in the combat group; its Mob objects are the only state it owns. */
export interface FieldIdleUnit {
  id: string;
  cohortId: string;
  home: FieldPoint;
  mobs: Mob[];
  nextSpawnAtSec?: number;
}

export interface FieldState {
  areaKey: string;
  arenaEpoch: number;
  nextUnitSeq: number;
  activeUnitId?: string;
  spawnUnits: FieldSpawnUnit[];
  idleUnits: FieldIdleUnit[];
  engagementIds: string[];
  combatSessionId: number;
  sessionActive: boolean;
  quietSec: number;
  /** Earliest due time for a replacement visible unit after an engaged unit cleared. */
  nextIdleAtSec?: number;
  farmingAnchor: FieldPoint;
  player: FieldPoint;
  actors: { id: string; x: number; y: number }[];
}

const MAX_UNITS = 8;
const MAX_ACTORS = 64;
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export interface FieldArchiveEntry extends FieldState {
  savedAtSec: number;
}

export type FieldArchive = Record<string, FieldArchiveEntry>;

const MAX_ARCHIVES = 6;

export function fieldAreaKey(s: Pick<GameState, 'zone' | 'cell' | 'dungeon'>): string {
  const key = `${s.zone}|${s.cell?.q ?? ''}|${s.cell?.r ?? ''}|${s.cell?.sub ?? ''}|${s.cell?.wild ?? ''}`;
  return s.dungeon ? `${key}|dungeon:${s.dungeon.zone}` : `${key}|field`;
}

export function createFieldState(s: Pick<GameState, 'zone' | 'cell' | 'dungeon'>): FieldState {
  return {
    areaKey: fieldAreaKey(s),
    arenaEpoch: 1,
    nextUnitSeq: 1,
    spawnUnits: [],
    idleUnits: [],
    engagementIds: [],
    combatSessionId: 0,
    sessionActive: false,
    quietSec: 0,
    farmingAnchor: { x: E.combat_arena.player_start.x, y: E.combat_arena.player_start.y },
    player: { x: E.combat_arena.player_start.x, y: E.combat_arena.player_start.y },
    actors: [],
  };
}

/** Living bodies that may participate; engagement is spatial, not a fixed array slice. */
export function engagementOf(group: readonly Mob[]): string[] {
  return group.filter((mob) => mob.hp > 0).slice(0, 16).map((mob) => mob.id);
}

/**
 * Keep the field's identity in step with the wave and arena. Behavior-preserving during this stage:
 * one active spawn unit per wave, the existing clear → spawn timer still owns the next spawn.
 */
export function syncFieldState(s: GameState, arena?: CombatArena, quietTicks = 2, advanceQuiet = true): boolean {
  const key = fieldAreaKey(s);
  if (!s.field) s.field = createFieldState(s);
  let field = s.field;
  if (field.areaKey !== key) {
    // Persist this field's spawn/idle/timer facts before leaving; another area's checkpoint may
    // already be waiting and must be restored with the same identities, never rerolled.
    s.fieldArchive ??= {};
    s.fieldArchive[field.areaKey] = copy({
      ...field,
      savedAtSec: s.clockSec,
      activeUnitId: undefined,
      combatSessionId: field.combatSessionId,
      sessionActive: false,
      quietSec: 0,
      engagementIds: [],
      actors: [],
    });
    const entries = Object.entries(s.fieldArchive).sort((a, b) => b[1].savedAtSec - a[1].savedAtSec);
    for (const [stale] of entries.slice(MAX_ARCHIVES)) delete s.fieldArchive[stale];
    const restored = s.fieldArchive[key];
    if (restored) {
      delete s.fieldArchive[key];
      field = {
        ...restored,
        areaKey: key,
        arenaEpoch: Math.max(restored.arenaEpoch, field.arenaEpoch) + 1,
        savedAtSec: s.clockSec,
        sessionActive: false,
        quietSec: 0,
        engagementIds: [],
        actors: [],
      } as FieldState;
    } else {
      field = { ...createFieldState(s), arenaEpoch: field.arenaEpoch + 1 };
    }
    s.field = field;
  }
  let startedSession = false;

  const living = s.group.filter((mob) => mob.hp > 0);
  const engagementIds = engagementOf(s.group);
  if (arena) {
    field.player = { x: arena.player.x, y: arena.player.y };
    field.actors = s.group.filter((mob) => mob.hp > 0 && arena.mobs[mob.id])
      .slice(0, MAX_ACTORS)
      .map((mob) => ({ id: mob.id, x: arena.mobs[mob.id].x, y: arena.mobs[mob.id].y }));
  }

  if (living.length) {
    const active = field.spawnUnits.find((entry) => entry.id === field.activeUnitId);
    // A wave whose members share no id with the active unit is a new cohort (dungeon exit, new spawn
    // after an out-of-tick clear, a changed group), never an extension of the old one.
    const sameCohort = !!active && s.group.some((mob) => active.actorIds.includes(mob.id));
    if (!sameCohort) {
      if (active) {
        active.clearedAtSec ??= s.clockSec;
        const clearedSpawnSec = Number(E.loot.group_spawn_sec);
        active.nextSpawnAtSec ??= s.clockSec + (Number.isFinite(clearedSpawnSec) ? clearedSpawnSec : 0);
      }
      const id = `u${field.nextUnitSeq++}`;
      const cohortId = `${field.arenaEpoch}-${id}`;
      field.activeUnitId = id;
      field.spawnUnits = [...field.spawnUnits, {
        id, cohortId, actorIds: s.group.map((mob) => mob.id),
        kind: s.group[0]?.kind ?? 'Normal', zone: s.zone, subzone: s.cell?.sub ?? null,
      }].slice(-MAX_UNITS);
    }
  }

  if (engagementIds.length) {
    if (!field.sessionActive) {
      field.combatSessionId++;
      field.sessionActive = true;
      startedSession = true;
      if (arena) field.farmingAnchor = { x: arena.player.x, y: arena.player.y };
    }
    field.quietSec = 0;
  } else if (field.sessionActive) {
    if (advanceQuiet) field.quietSec++;
    if (field.quietSec >= quietTicks) {
      field.sessionActive = false;
      field.quietSec = 0;
    }
  }

  if (!living.length && field.activeUnitId) {
    const unit = field.spawnUnits.find((entry) => entry.id === field.activeUnitId);
    if (unit) {
      unit.clearedAtSec ??= s.clockSec;
      const spawnSec = Number(E.loot.group_spawn_sec);
      unit.nextSpawnAtSec ??= s.clockSec + (Number.isFinite(spawnSec) ? spawnSec : 0);
      const due = unit.nextSpawnAtSec;
      field.nextIdleAtSec = field.nextIdleAtSec == null ? due : Math.min(field.nextIdleAtSec, due);
    }
    field.activeUnitId = undefined;
  }
  field.engagementIds = engagementIds;
  return startedSession;
}

/** Reapply saved ground positions to a freshly synced arena; no HP or identity is copied. */
export function restoreFieldPositions(arena: CombatArena, s: GameState): void {
  const field = s.field;
  if (!field) return;
  if (Number.isFinite(field.player.x) && Number.isFinite(field.player.y)
    && (field.player.x !== 0 || field.player.y !== 0))
    Object.assign(arena.player, { x: field.player.x, y: field.player.y });
  for (const actor of field.actors) {
    const saved = arena.mobs[actor.id];
    if (saved && saved.hp > 0) Object.assign(saved, { x: actor.x, y: actor.y });
  }
}

/** Save input is a boundary: keep a coherent field or none, never a guessed cohort or HP copy. */
export function normalizeFieldState(value: unknown): FieldState | null {  if (!value || typeof value !== 'object') return null;
  const field = value as Partial<FieldState>;
  const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  if (typeof field.areaKey !== 'string' || !finite(field.arenaEpoch)) return null;
  if (!field.farmingAnchor || !finite(field.farmingAnchor.x) || !finite(field.farmingAnchor.y)) return null;
  if (!field.player || !finite(field.player.x) || !finite(field.player.y)) return null;
  const units = (Array.isArray(field.spawnUnits) ? field.spawnUnits : []).filter((unit) =>
    !!unit && typeof unit.id === 'string' && typeof unit.cohortId === 'string'
    && Array.isArray(unit.actorIds) && unit.actorIds.every((id) => typeof id === 'string')).slice(-MAX_UNITS);
  const actors = (Array.isArray(field.actors) ? field.actors : []).filter((actor) =>
    !!actor && typeof actor.id === 'string' && finite(actor.x) && finite(actor.y)).slice(0, MAX_ACTORS);
  const idleUnits = (Array.isArray(field.idleUnits) ? field.idleUnits : []).filter((unit) => {
    if (!unit || typeof unit.id !== 'string' || typeof unit.cohortId !== 'string') return false;
    if (!unit.home || !finite(unit.home.x) || !finite(unit.home.y)) return false;
    if (!Array.isArray(unit.mobs) || !unit.mobs.length) return false;
    return unit.mobs.every((mob) => mob && typeof mob.id === 'string' && typeof mob.species === 'string'
      && finite(mob.hp) && finite(mob.hpMax) && finite(mob.ps));
  }).slice(0, 3).map((unit) => ({ ...unit, mobs: unit.mobs.slice(0, 8) }));
  return {
    areaKey: field.areaKey,
    arenaEpoch: Math.max(1, Math.floor(field.arenaEpoch)),
    nextUnitSeq: Math.max(1, Math.floor(finite(field.nextUnitSeq) ? field.nextUnitSeq : 1)),
    ...(typeof field.activeUnitId === 'string' ? { activeUnitId: field.activeUnitId } : {}),
    spawnUnits: units,
    idleUnits,
    engagementIds: (Array.isArray(field.engagementIds) ? field.engagementIds : [])
      .filter((id) => typeof id === 'string').slice(0, 3),
    combatSessionId: Math.max(0, Math.floor(finite(field.combatSessionId) ? field.combatSessionId : 0)),
    sessionActive: !!field.sessionActive,
    quietSec: Math.max(0, Math.floor(finite(field.quietSec) ? field.quietSec : 0)),
    ...(finite(field.nextIdleAtSec) ? { nextIdleAtSec: field.nextIdleAtSec } : {}),
    farmingAnchor: { x: field.farmingAnchor.x, y: field.farmingAnchor.y },
    player: { x: field.player.x, y: field.player.y },
    actors,
  };
}

/** Save input for visited-field checkpoints: only a coherent archive with matching area ids. */
export function normalizeFieldArchive(value: unknown): FieldArchive {
  if (!value || typeof value !== 'object') return {};
  const out: FieldArchive = {};
  const entries = Object.entries(value as Record<string, unknown>);
  for (const [key, raw] of entries.slice(0, MAX_ARCHIVES)) {
    const field = normalizeFieldState(raw);
    if (!field || field.areaKey !== key) continue;
    const savedAt = (raw as { savedAtSec?: unknown })?.savedAtSec;
    out[key] = { ...field,
      savedAtSec: typeof savedAt === 'number' && Number.isFinite(savedAt) ? savedAt : 0 };
  }
  return out;
}
