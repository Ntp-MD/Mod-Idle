import { eng } from '../engine/client';
import type { GameState, Mob } from './types';

/**
 * The win condition (`concept.md`): kill the final zone's boss inside a single spawn without being
 * Pushed. Nothing here carries a number — the target's zone, level and HP come from the same mob
 * curve the spawn uses, so the figure the panel shows is the figure the fight rolls.
 *
 * Completion does not end the run (`concept.md`: no prestige, levels 91-100 are the item-quality
 * push in that same zone), so this records the first time it happened and keeps playing.
 */
export interface GoalState {
  /** The boss spawn under attempt right now, or null while no such boss is on the clock. */
  spawnId: string | null;
  /** Pushes counted the moment that spawn appeared — one more voids the attempt. */
  pushesAtSpawn: number;
  /** How many times the boss has spawned in the final zone, so a player can see the odds are real. */
  attempts: number;
  /** The first completion, or null while the gate is still open. */
  done: { clockSec: number; level: number; hp: number } | null;
}

export const newGoal = (): GoalState => ({ spawnId: null, pushesAtSpawn: 0, attempts: 0, done: null });

/** The gate as data: the last zone in `mob.zones`, its boss, and the HP the curve gives it. */
export const target = () => eng.winTarget();

const isFinalBoss = (mob: Mob) => mob.kind.startsWith('Boss') && mob.zone === target().zone;

/** Arm the attempt when that boss appears; a second boss while one is armed keeps the first record. */
export function onSpawn(s: GameState, mob: Mob): void {
  if (!isFinalBoss(mob) || s.goal.spawnId) return;
  s.goal.spawnId = mob.id;
  s.goal.pushesAtSpawn = s.counters.pushes;
  s.goal.attempts++;
}

/**
 * Called when a mob dies. The gate closes only on the armed spawn and only while the Push counter
 * has not moved since it appeared — a walk-back ends the attempt, exactly as losing costs the spawn.
 */
export function onKill(s: GameState, mob: Mob): boolean {
  if (!s.goal.spawnId || mob.id !== s.goal.spawnId) return false;
  const clean = s.counters.pushes === s.goal.pushesAtSpawn;
  s.goal.spawnId = null;
  if (!clean) return false;
  if (!s.goal.done) {
    s.goal.done = { clockSec: s.clockSec, level: s.player.level, hp: mob.hpMax };
    return true;
  }
  return false;
}

/** The armed boss left without dying — the spawn is spent, so wait for the next one. */
export function watch(s: GameState): void {
  if (s.goal.spawnId && !s.group.some((m) => m.id === s.goal!.spawnId)) s.goal.spawnId = null;
}

/** How the panel states the gate, in the doc's own terms. */
export function describe(): string {
  const t = target();
  return `${t.name} · ${t.zoneName} (zone ${t.zone}) · level ${t.level} · HP ${Math.round(t.hp).toLocaleString('en-US')} · one spawn, no Push`;
}
