import type { CombatArena, CombatArenaAction, CombatArenaActor } from '../../sim/combat-arena';
import type { FxEvent, GameState } from '../../sim/types';
import type { ArenaDirection, ArenaSpriteSheet } from './arena/arena-art';

export const ARENA_VIEW = { width: 1920, height: 1080 };
export const ARENA_ACTOR_WIDTH_M = .5;
const PROJECT_CX = 1040;
const PROJECT_CY = 530;
const PROJECT_U = 42, PROJECT_V = 10, PROJECT_W = -8, PROJECT_Z = 30;
/** Presentation ruler: the approved player's ~70px body represents half a meter. */
const PROJECTION_SCALE = 70 / (ARENA_ACTOR_WIDTH_M * Math.hypot(PROJECT_U, PROJECT_W));

/** A fixed oblique camera. Feet share one ground plane; screen Y also owns depth sorting. */
export function projectArenaPoint(point: { x: number; y: number }) {
  return {
    x: PROJECT_CX + ((point.x - 9) * PROJECT_U + (point.y - 6) * PROJECT_V) * PROJECTION_SCALE,
    y: PROJECT_CY + ((point.y - 6) * PROJECT_Z + (point.x - 9) * PROJECT_W) * PROJECTION_SCALE,
  };
}

/** Follow the player so the half-meter actor ruler does not make distant ground inaccessible. */
export function arenaCameraOffset(player: {x:number;y:number}, target?: {x:number;y:number}) {
  const point=projectArenaPoint(target ? {x:(player.x+target.x)/2,y:(player.y+target.y)/2} : player);
  return {x:point.x-PROJECT_CX,y:point.y-PROJECT_CY};
}

/** The idle silhouette is the stable presentation footprint; attack poses can extend beyond it. */
export function arenaActorPixelScale(idleWidth: number, viewportScale: number) {
  const origin=projectArenaPoint({x:0,y:0}), x=projectArenaPoint({x:ARENA_ACTOR_WIDTH_M,y:0}), y=projectArenaPoint({x:0,y:ARENA_ACTOR_WIDTH_M});
  return Math.hypot(x.x-origin.x,y.x-origin.x)/Math.max(1,idleWidth)*viewportScale;
}

/** The inverse of the fixed ground projection, for a pointer command in arena-view pixels. */
export function unprojectArenaPoint(point: { x: number; y: number }) {
  const a = (point.x - PROJECT_CX) / PROJECTION_SCALE;
  const b = (point.y - PROJECT_CY) / PROJECTION_SCALE;
  const determinant = PROJECT_U * PROJECT_Z - PROJECT_V * PROJECT_W;
  return {
    x: (PROJECT_Z * a - PROJECT_V * b) / determinant + 9,
    y: (PROJECT_U * b - PROJECT_W * a) / determinant + 6,
  };
}

const directions: ArenaDirection[] = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'];

/** Facing follows the projected travel vector, including the camera's compressed ground axis. */
export function arenaDirection(facing: number, available: Partial<Record<ArenaDirection, ArenaSpriteSheet>>): ArenaDirection {
  const x = Math.cos(facing);
  const y = Math.sin(facing);
  const angle = Math.atan2(y * 30 - x * 8, x * 42 + y * 10);
  const index = (Math.round(angle / (Math.PI / 4)) + 8) % 8;
  for (let distance = 0; distance <= 4; distance++) {
    for (const offset of distance ? [distance, -distance] : [0]) {
      const candidate = directions[(index + offset + 8) % 8];
      if (available[candidate]) return candidate;
    }
  }
  return 'south';
}

export function arenaSpriteIndex(sheet: ArenaSpriteSheet, elapsedMs: number, reducedMotion = false, once = false) {
  const frame = reducedMotion ? once ? sheet.frames - 1 : 0 : Math.max(0, Math.floor(elapsedMs / sheet.frameMs));
  return (sheet.startFrame ?? 0) + (sheet.loop && !once ? frame % sheet.frames : Math.min(frame, sheet.frames - 1));
}

export function arenaSpriteFrame(sheet: ArenaSpriteSheet, elapsedMs: number, reducedMotion = false, once = false) {
  const index = arenaSpriteIndex(sheet, elapsedMs, reducedMotion, once);
  return `${index % sheet.columns * sheet.frameWidth} ${Math.floor(index / sheet.columns) * sheet.frameHeight} ${sheet.frameWidth} ${sheet.frameHeight}`;
}

export function arenaAttackElapsedMs(action: CombatArenaAction, atUs: number, unitsPerSec: number, sheet?: ArenaSpriteSheet) {
  return (atUs - action.atUs) / unitsPerSec * 1000 + (sheet?.impactMs ?? 340);
}

/** A received action can be played before its impact because the scene holds one sim second. */
export function arenaActorAction(
  arena: CombatArena, actor: CombatArenaActor, atUs: number,
  attackClip?: Partial<Record<ArenaDirection, ArenaSpriteSheet>>,
): CombatArenaAction | undefined {
  const sheet = attackClip?.[arenaDirection(actor.facing, attackClip)];
  let upcoming: CombatArenaAction | undefined;
  for (let index = arena.actions.length - 1; index >= 0; index--) {
    const action = arena.actions[index];
    if (action.actorId !== actor.id || action.kind === 'death') continue;
    const clipEnd = sheet ? action.atUs + (sheet.frames * sheet.frameMs - (sheet.impactMs ?? 340)) / 1000 * arena.unitsPerSec : action.endsAtUs;
    if (arenaAttackElapsedMs(action, atUs, arena.unitsPerSec, sheet) < 0 || atUs > Math.max(action.endsAtUs, clipEnd)) continue;
    // An upcoming windup must not erase an attack before its resolved contact.
    if (action.atUs <= atUs) return action;
    if (!upcoming || action.atUs < upcoming.atUs) upcoming = action;
  }
  return upcoming;
}

export function arenaPlaybackTime(nowUs: number, unitsPerSec: number, elapsedMs: number, speed: number, paused = false) {
  return Math.max(0, Math.min(nowUs, nowUs - unitsPerSec + (paused ? 0 : Math.max(0, elapsedMs) * unitsPerSec * speed / 1000)));
}

/**
 * A live event follows its executable action's latest timing so an early contact or a re-aimed
 * release cannot be overwritten by the event's older snapshot. History keeps its resolved snapshot.
 */
export function arenaEventTiming(event: FxEvent, arena: CombatArena) {
  const linked = event.actionId != null
    ? arena.actions.find((action) => action.id === event.actionId) : undefined;
  return linked?.timing ?? event.castTiming;
}

/** Presentation-only interpolation for an ordinary mob shot; the simulation owns contact. */
export function arenaRangedShots(arena: CombatArena, atUs: number) {
  const live: { id: number; x: number; y: number; angle: number; element: string | null }[] = [];
  for (const action of arena.actions) {
    if (!action.ranged || !action.timing || action.cancelledAtUs != null) continue;
    const { releaseAtUs, impactAtUs } = action.timing;
    if (atUs < releaseAtUs || atUs > impactAtUs + arena.unitsPerSec * 0.08) continue;
    const span = impactAtUs - releaseAtUs;
    const progress = span > 0 ? Math.max(0, Math.min(1, (atUs - releaseAtUs) / span)) : 1;
    const toX = action.targetX ?? action.x, toY = action.targetY ?? action.y;
    const mob = arena.mobs[action.actorId]?.mob;
    live.push({
      id: action.id,
      x: action.x + (toX - action.x) * progress,
      y: action.y + (toY - action.y) * progress,
      angle: Math.atan2(toY - action.y, toX - action.x) * 180 / Math.PI,
      element: mob && mob.damage !== 'physical' ? (mob.innate?.[0] ?? null) : null,
    });
  }
  return live;
}

/** The field says why it is empty; a Push is its own state, not a quiet clearing. */
export function arenaFieldNote(
  state: { phase: GameState['phase']; hunting: boolean; walk: unknown; group: readonly unknown[] },
): { text: string; camp: boolean } | null {
  if (state.phase === 'camp') return { text: 'Pushed to camp · recovering', camp: true };
  if (!state.hunting && !state.walk && !state.group.length) return { text: 'The clearing is quiet.', camp: false };
  return null;
}
