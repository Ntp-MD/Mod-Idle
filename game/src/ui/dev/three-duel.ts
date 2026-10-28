/**
 * Pure beat table for the dev-only Three.js duel showcase (sample `three-duel`).
 * No WebGL here: the Svelte scene owns the renderer, mixer and meshes; this module owns
 * the only thing the plan lets a showcase assert — which clip plays on which beat and what
 * a strike resolves (F44 phases: windup → release → recovery, read off data-like numbers).
 */

/** Committed clip names, exactly as the Quaternius glTF animations are named. */
export const DUEL_CLIPS = {
  idle: 'Idle',
  walk: 'Walk',
  run: 'Run',
  attack: 'Punch',
  hit: 'HitReact',
  death: 'Death',
} as const;

export type DuelClip = keyof typeof DUEL_CLIPS;

/** One beat of a scripted exchange, in seconds from the exchange start. */
export interface DuelBeat {
  at: number;
  kind: 'windup' | 'release' | 'recover' | 'done';
}

/**
 * One attack exchange: the attacker commits at t=0, the blow lands at the release beat
 * (damage + victim HitReact own that timestamp), the tail ends at recovery.
 */
export function exchangeTimeline(opts: { windupSec: number; releaseSec: number; recoverySec: number }): DuelBeat[] {
  const windup = Math.max(0, opts.windupSec);
  const release = Math.max(windup, opts.releaseSec);
  const recovery = Math.max(release, opts.recoverySec);
  return [
    { at: 0, kind: 'windup' },
    { at: release, kind: 'release' },
    { at: recovery, kind: 'recover' },
    { at: recovery, kind: 'done' },
  ];
}

/** The clip a fighter shows for a promise state; death wins and sticks. */
export function clipForPhase(phase: 'idle' | 'walk' | 'attack' | 'hit' | 'dead'): DuelClip {
  if (phase === 'attack') return 'attack';
  if (phase === 'hit') return 'hit';
  if (phase === 'dead') return 'death';
  if (phase === 'walk') return 'walk';
  return 'idle';
}

/** Step toward a goal at most `speed * dt` meters, never past it. */
export function approachPoint(
  from: { x: number; z: number }, to: { x: number; z: number }, speed: number, dt: number,
): { x: number; z: number; arrived: boolean } {
  const dx = to.x - from.x, dz = to.z - from.z;
  const gap = Math.hypot(dx, dz);
  const step = Math.max(0, speed) * Math.max(0, dt);
  if (gap <= step || gap <= 1e-9) return { x: to.x, z: to.z, arrived: true };
  return { x: from.x + (dx / gap) * step, z: from.z + (dz / gap) * step, arrived: false };
}
