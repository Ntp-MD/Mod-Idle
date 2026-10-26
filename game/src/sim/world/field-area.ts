/**
 * The active field's population identity.
 *
 * `s.group` is the single authoritative living-mob/HP list. A field owns the spawn slots that say
 * where a mob belongs, when its slot refills, and the last ground positions needed to resume the
 * same field after a reload. No slot holds a second Mob copy; it holds an id and a timer.
 */
import { E, spawns } from '../../engine/client';
import type { CombatArena } from '../combat/combat-arena';
import type { GameState, Mob } from '../core/types';

export type FieldPoint = { x: number; y: number };

/** One authored home. The slot is empty while `mobId` is absent and `respawnAtSec` is counting. */
export interface FieldSpawnSlot {
  id: string;
  pointId: string;
  home: FieldPoint;
  roamM: number;
  /** Absolute clock second when this empty slot may refill; 0 means due now. */
  respawnAtSec: number;
  /** How many times this slot has refilled; part of the deterministic spawn seed. */
  respawnCount: number;
  mobId?: string;
}

export interface FieldState {
  areaKey: string;
  arenaEpoch: number;
  nextSlotSeq: number;
  slots: FieldSpawnSlot[];
  /** Bodies currently inside their aggro/leash window; combat and mob attack scheduling read this. */
  engagementIds: string[];
  combatSessionId: number;
  sessionActive: boolean;
  quietSec: number;
  /** Clock second a Boss died in this field; the arena settles its epoch once at that receipt. */
  bossDefeatedAtSec?: number;
  /** Fractional offline duty credit; `offline_share` accumulates here across wall seconds. */
  offlineCredit?: number;
  farmingAnchor: FieldPoint;
  player: FieldPoint;
  actors: { id: string; x: number; y: number }[];
  /** Last wall second this field was current; the offline catch-up starts from here. */
  lastSeenAtSec?: number;
}

const MAX_SLOTS = 16;
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

/** Slot homes for one field; the authored cap and points come from `spawns.json`. */
export function createFieldSlots(zone: number, sub: number | null | undefined, atSec: number): FieldSpawnSlot[] {
  const profile = spawns.profileFor(zone, sub ?? null);
  const points = spawns.pointsFor(zone, sub ?? null);
  const count = Math.min(MAX_SLOTS, profile.cap, points.length);
  return Array.from({ length: count }, (_, index) => {
    const point = points[index];
    return {
      id: `s${index + 1}`,
      pointId: point.id,
      home: { x: point.x, y: point.y },
      roamM: point.roam_m > 0 ? point.roam_m : profile.roam_m,
      respawnAtSec: atSec,
      respawnCount: 0,
    };
  });
}

export function createFieldState(s: Pick<GameState, 'zone' | 'cell' | 'dungeon' | 'clockSec'>): FieldState {
  const slots = createFieldSlots(s.zone, s.cell?.sub, s.clockSec);
  return {
    areaKey: fieldAreaKey(s),
    arenaEpoch: 1,
    nextSlotSeq: slots.length + 1,
    slots,
    engagementIds: [],
    combatSessionId: 0,
    sessionActive: false,
    quietSec: 0,
    farmingAnchor: { x: E.combat_arena.player_start.x, y: E.combat_arena.player_start.y },
    player: { x: E.combat_arena.player_start.x, y: E.combat_arena.player_start.y },
    actors: [],
    lastSeenAtSec: s.clockSec,
  };
}

/**
 * Keep the field in step with its area, slots and the arena. Spawning and respawning belong to the
 * caller; this function reconciles identities, timers and saved positions only.
 */
export function syncFieldState(s: GameState, arena?: CombatArena, quietTicks = 2, advanceQuiet = true): boolean {
  const key = fieldAreaKey(s);
  if (!s.field) s.field = createFieldState(s);
  let field = s.field;
  if (field.areaKey !== key) {
    s.fieldArchive ??= {};
    s.fieldArchive[field.areaKey] = copy({
      ...field,
      savedAtSec: s.clockSec,
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
        savedAtSec: undefined,
        sessionActive: false,
        quietSec: 0,
        engagementIds: [],
        actors: [],
        lastSeenAtSec: s.clockSec,
      } as unknown as FieldState;
    } else {
      field = { ...createFieldState(s), arenaEpoch: field.arenaEpoch + 1 };
    }
    s.field = field;
  }
  if (!field.slots?.length) field.slots = createFieldSlots(s.zone, s.cell?.sub, s.clockSec);

  const living = new Map(s.group.filter((mob) => mob.hp > 0).map((mob) => [mob.id, mob]));
  // A live body without a slot (legacy save, first purchase) takes the first free authored home.
  for (const mob of living.values()) {
    if (mob.spawnSlotId && field.slots.some((slot) => slot.id === mob.spawnSlotId)) continue;
    const slot = field.slots.find((entry) => !entry.mobId || !living.has(entry.mobId));
    if (!slot) continue;
    slot.mobId = mob.id;
    slot.respawnAtSec = 0;
    mob.spawnSlotId = slot.id;
  }
  for (const slot of field.slots) {
    if (slot.mobId && !living.has(slot.mobId)) {
      slot.mobId = undefined;
      if (!(slot.respawnAtSec > s.clockSec)) slot.respawnAtSec = s.clockSec;
    }
  }

  if (arena) {
    field.player = { x: arena.player.x, y: arena.player.y };
    field.actors = s.group.filter((mob) => mob.hp > 0 && arena.mobs[mob.id])
      .slice(0, MAX_ACTORS)
      .map((mob) => ({ id: mob.id, x: arena.mobs[mob.id].x, y: arena.mobs[mob.id].y }));
  }
  // Engagement is written by the combat loop; a session starts on the first engaged body and ends
  // after the field has been quiet for `quietTicks`.
  const engagementIds = field.engagementIds.filter((id) => living.has(id));
  field.engagementIds = engagementIds;
  let startedSession = false;
  if (engagementIds.length) {
    if (!field.sessionActive) {
      const firstSession = field.combatSessionId === 0;
      field.combatSessionId++;
      field.sessionActive = true;
      startedSession = true;
      if (firstSession && arena) field.farmingAnchor = { x: arena.player.x, y: arena.player.y };
    }
    field.quietSec = 0;
  } else if (field.sessionActive) {
    if (advanceQuiet) field.quietSec++;
    if (field.quietSec >= quietTicks) {
      field.sessionActive = false;
      field.quietSec = 0;
    }
  }
  field.lastSeenAtSec = s.clockSec;
  return startedSession;
}

/** True while a field body is inside its aggro/leash window; non-combat actions read this, not group size. */
export function fieldInFight(s: Pick<GameState, 'field'>): boolean {
  return !!s.field?.engagementIds.length;
}

/** Return a dead body's slot to its own authored timer. Rewards and group removal stay elsewhere. */
export function releaseSpawnSlot(s: GameState, mob: Mob): boolean {
  if (!mob.spawnSlotId || !s.field) return false;
  const slot = s.field.slots.find((entry) => entry.id === mob.spawnSlotId);
  if (!slot || (slot.mobId && slot.mobId !== mob.id)) return false;
  const profile = spawns.profileFor(s.zone, s.cell?.sub ?? null);
  slot.mobId = undefined;
  slot.respawnAtSec = s.clockSec + Math.max(1, Math.round(profile.respawn_sec));
  slot.respawnCount++;
  return true;
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

function finitePoint(value: unknown): value is FieldPoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as FieldPoint;
  return typeof point.x === 'number' && Number.isFinite(point.x)
    && typeof point.y === 'number' && Number.isFinite(point.y);
}

/** Save input is a boundary: keep a coherent field or none, never a guessed cohort or HP copy. */
export function normalizeFieldState(value: unknown): FieldState | null {
  if (!value || typeof value !== 'object') return null;
  const field = value as Partial<FieldState>;
  const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
  if (typeof field.areaKey !== 'string' || !finite(field.arenaEpoch)) return null;
  if (!finitePoint(field.farmingAnchor) || !finitePoint(field.player)) return null;
  const slots = (Array.isArray(field.slots) ? field.slots : []).filter((slot): slot is FieldSpawnSlot =>
    !!slot && typeof slot.id === 'string' && typeof slot.pointId === 'string'
    && finitePoint(slot.home) && finite(slot.roamM) && finite(slot.respawnAtSec)
    && Number.isInteger(slot.respawnCount)).slice(0, MAX_SLOTS)
    .map((slot) => ({
      ...slot,
      respawnAtSec: Math.max(0, Math.floor(slot.respawnAtSec)),
      respawnCount: Math.max(0, Math.floor(slot.respawnCount)),
      ...(typeof slot.mobId === 'string' ? { mobId: slot.mobId } : {}),
    }));
  const actors = (Array.isArray(field.actors) ? field.actors : []).filter((actor) =>
    !!actor && typeof actor.id === 'string' && finite(actor.x) && finite(actor.y)).slice(0, MAX_ACTORS);
  return {
    areaKey: field.areaKey,
    arenaEpoch: Math.max(1, Math.floor(field.arenaEpoch)),
    nextSlotSeq: Math.max(1, Math.floor(finite(field.nextSlotSeq) ? field.nextSlotSeq : 1)),
    slots,
    engagementIds: (Array.isArray(field.engagementIds) ? field.engagementIds : [])
      .filter((id) => typeof id === 'string').slice(0, MAX_SLOTS),
    combatSessionId: Math.max(0, Math.floor(finite(field.combatSessionId) ? field.combatSessionId : 0)),
    sessionActive: !!field.sessionActive,
    quietSec: Math.max(0, Math.floor(finite(field.quietSec) ? field.quietSec : 0)),
    ...(finite(field.bossDefeatedAtSec) ? { bossDefeatedAtSec: Math.max(0, Math.floor(field.bossDefeatedAtSec)) } : {}),
    ...(finite(field.offlineCredit) ? { offlineCredit: Math.max(0, Math.min(1, field.offlineCredit)) } : {}),
    farmingAnchor: { x: field.farmingAnchor.x, y: field.farmingAnchor.y },
    player: { x: field.player.x, y: field.player.y },
    actors,
    ...(finite(field.lastSeenAtSec) ? { lastSeenAtSec: Math.max(0, Math.floor(field.lastSeenAtSec)) } : {}),
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
