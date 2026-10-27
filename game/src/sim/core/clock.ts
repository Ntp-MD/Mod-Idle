import { E } from '../../engine/client';

/** Which day the run's clock stands on — the one home, so two callers cannot disagree. */
export const dayOf = (clockSec: number): number => Math.floor(clockSec / 86400);

/** The boss cadence the loot document publishes; the spawn stage and the offline gate share it. */
export const BOSS_EVERY_SEC = Math.round(3600 / E.loot.boss_per_hour);

export const WAKE_SEC = 0.25;
export const MAX_BATCH = 8;

/**
 * Real time into sim seconds, for one wake. `elapsedSec` is what actually passed since the last wake — a
 * timer that ran late banks what it missed instead of a fixed slice, so a throttled tab (a hidden one
 * fires at most once a second) still earns, and a stalled wake keeps its backlog as debt instead of
 * losing it. The batch is what runs: at most `MAX_BATCH` ticks a wake, so a queued backlog drains over
 * later wakes rather than bursting in the foreground and costing the frame its stutter-free draw.
 * Offline catch-up stays uncapped; the live loop matches it by never dropping whole seconds either.
 */
export function schedulerBatch(acc: number, speed: number, elapsedSec: number = WAKE_SEC): { ticks: number; acc: number } {
  const total = acc + elapsedSec * speed;
  const ticks = Math.floor(total);
  if (ticks <= 0) return { ticks: 0, acc: total };
  if (ticks > MAX_BATCH) return { ticks: MAX_BATCH, acc: total - MAX_BATCH };
  return { ticks, acc: total - ticks };
}

/** A null configured limit pays every valid whole elapsed second. */
export function catchUpPlan(elapsedSec: number) {
  // an away period never walks: a walk is online only, so the catch-up never crosses a block
  const configured: number | null = E.inventory.offline_cap_hr;
  const cap = configured == null ? Infinity : configured * 3600;
  const whole = Math.floor(elapsedSec);
  const elapsed = Number.isSafeInteger(whole) ? Math.max(0, whole) : 0;
  return { secs: Math.min(elapsed, cap), capped: elapsed > cap };
}
