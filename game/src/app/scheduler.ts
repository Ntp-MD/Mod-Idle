import { COMBAT_STEP_US, MAX_WORK_SLICE_MS, schedulerSteps } from '@sim/core/game';

/**
 * Shared fixed-step scheduling mechanics (plan phase-5 scheduler-shared).
 * Minimum reusable elapsed/accumulator/work-slice mechanism extracted from app/loop.ts.
 * Two policies share it but stay distinct:
 * - Live: banks throttled-tab debt across pause (loop.ts own wake).
 * - Preview: caps elapsed at 0.5s and discards debt while paused/stopped/hidden (App preview effect).
 * No general scheduling framework: callers pass only the policy inputs they need.
 */
export interface StepBatch {
  steps: number;
  acc: number;
}

export function planSteps(acc: number, speed: number, elapsedSec: number): StepBatch {
  const stepSec = COMBAT_STEP_US() / 1_000_000;
  const batch = schedulerSteps(acc, speed, elapsedSec, stepSec);
  return { steps: batch.steps, acc: batch.acc };
}

/** Run up to `requested` steps, yielding at MAX_WORK_SLICE_MS and retaining unpaid debt. */
export function runWorkSlice(requested: number, readWallMs: () => number, runStep: () => void): { completed: number; elapsedMs: number } {
  const beganAt = readWallMs();
  let completed = 0;
  while (completed < requested) {
    runStep();
    completed++;
    if (readWallMs() - beganAt >= MAX_WORK_SLICE_MS) break;
  }
  return { completed, elapsedMs: readWallMs() - beganAt };
}

/** Preview policy: cap elapsed, discard debt while paused/stopped/hidden. */
export function previewTick(state: { acc: number; previous: number }, nowMs: number, opts: { running: boolean; paused: boolean; hidden: boolean; speed: number }): StepBatch {
  const elapsed = Math.min(0.5, Math.max(0, (nowMs - state.previous) / 1000));
  state.previous = nowMs;
  if (!opts.running || opts.paused || opts.hidden) {
    state.acc = 0;
    return { steps: 0, acc: 0 };
  }
  const batch = planSteps(state.acc, opts.speed, elapsed);
  state.acc = batch.acc;
  return batch;
}
