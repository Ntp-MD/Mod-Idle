import type { CombatArenaAction, CombatArenaActor } from '@sim/combat/combat-arena';
import { arenaActionPose, arenaPhaseOffset } from '../combat/combat-arena-view';
import { ARENA_VIEW, arenaCameraOffset, projectArenaPoint, projectArenaVector } from '../../presentation/arena-camera';

export type SourceModelClip = 'Idle' | 'Walk' | 'Weapon' | 'HitReact' | 'Death';
export type SourceModelActor = {
  actor: CombatArenaActor & { diedAtUs?: number };
  action?: CombatArenaAction;
  walkPhase: number;
  hitElapsedMs?: number;
  opacity: number;
};
export type SourceModelDurations = Record<SourceModelClip, number>;
export type ThreeArenaLayerProps = {
  actors: SourceModelActor[];
  player: { x: number; y: number };
  atUs: number;
  unitsPerSec: number;
  bounds: { width: number; height: number };
  reducedMotion?: boolean;
  onReadyChange?: (ready: boolean) => void;
};

/** Display calibration only: fit the source humanoids to the existing Field body/nameplate scale. */
export function sourceModelScale(radiusM: number) {
  return Math.max(.05, radiusM) * 1.15;
}

const groundX = projectArenaVector({ x: 1, y: 0 });
const groundZ = projectArenaVector({ x: 0, y: 1 });
export const SOURCE_MODEL_VERTICAL_PX = Math.hypot(groundX.x, groundZ.x);

/** The model feet use the exact same affine ground projection as the existing Field artwork. */
export function sourceModelScreenPoint(point: { x: number; y: number; z: number }, player: { x: number; y: number }) {
  const ground = projectArenaPoint({ x: point.x, y: point.z });
  const camera = arenaCameraOffset(player);
  return { x: ground.x - camera.x, y: ground.y - camera.y - point.y * SOURCE_MODEL_VERTICAL_PX };
}

/** Row-major world-to-clip matrix; its depth axis is perpendicular to both screen axes. */
export function sourceModelProjection(player: { x: number; y: number }): number[] {
  const origin = sourceModelScreenPoint({ x: 0, y: 0, z: 0 }, player);
  const nx = -groundZ.x * SOURCE_MODEL_VERTICAL_PX;
  const ny = groundZ.x * groundX.y - groundX.x * groundZ.y;
  const nz = groundX.x * SOURCE_MODEL_VERTICAL_PX;
  // Screen y points down, so reverse its ground cross product for a camera above the ground.
  const normal = { x: nx, y: -ny, z: nz };
  const length = Math.hypot(normal.x, normal.y, normal.z);
  const depth = { x: -normal.x / length / 100, y: -normal.y / length / 100, z: -normal.z / length / 100 };
  return [
    2 * groundX.x / ARENA_VIEW.width, 0, 2 * groundZ.x / ARENA_VIEW.width, 2 * origin.x / ARENA_VIEW.width - 1,
    -2 * groundX.y / ARENA_VIEW.height, 2 * SOURCE_MODEL_VERTICAL_PX / ARENA_VIEW.height,
    -2 * groundZ.y / ARENA_VIEW.height, 1 - 2 * origin.y / ARENA_VIEW.height,
    depth.x, depth.y, depth.z, -depth.x * player.x - depth.z * player.y,
    0, 0, 0, 1,
  ];
}

/** Absolute source clip time makes pause, speed changes and backwards inspection deterministic. */
export function sourceModelAnimation(view: SourceModelActor, atUs: number, unitsPerSec: number,
  durations: SourceModelDurations, reducedMotion = false): { clip: SourceModelClip; time: number } {
  const units = unitsPerSec > 0 ? unitsPerSec : 1_000_000;
  const dead = view.actor.diedAtUs != null || view.actor.hp <= 0;
  if (dead) return { clip: 'Death', time: reducedMotion ? durations.Death
    : Math.max(0, Math.min(durations.Death, (atUs - (view.actor.diedAtUs ?? atUs)) / units)) };
  if (reducedMotion) return { clip: 'Idle', time: 0 };
  if (view.hitElapsedMs != null) return { clip: 'HitReact', time: Math.min(durations.HitReact, view.hitElapsedMs / 1000) };
  if (view.action) {
    const duration = durations.Weapon;
    // The source has no contact event. This explicit visual marker maps its strike to the
    // existing action's release/impact/recovery beats; it never schedules a gameplay event.
    const pose = arenaActionPose(view.action, atUs, units, {
      href: '', frameWidth: 1, frameHeight: 1, columns: 100, rows: 1,
      frames: 100, frameMs: duration * 10, impactMs: duration * .45 * 1000, loop: false,
    });
    if (pose) return { clip: 'Weapon', time: Math.min(duration, pose.elapsedMs / 1000) };
  }
  if (view.actor.moving) return { clip: 'Walk', time: ((view.walkPhase % 1) + 1) % 1 * durations.Walk };
  return { clip: 'Idle', time: (atUs / units + arenaPhaseOffset(view.actor.id) * durations.Idle) % durations.Idle };
}
