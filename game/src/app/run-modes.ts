/**
 * The run-mode matrix (F32): which shell states simulate, which hold, and which must persist a
 * time-accounting boundary first. One table, read by the loop wiring and the P3 presentation
 * cutover alike — a mode the table does not name does not run.
 *
 * - live: the wake advances the sim; a throttled (hidden) tab banks what it missed.
 * - preview: the showcase advances a capped slice for inspection, never the account.
 * - held: the wake banks but steps nothing; resume continues the backlog, never the held span.
 */
export type RunMode = 'live' | 'preview' | 'held';

export interface RunCondition {
  /** Tab/frame actually painting. */
  visible: boolean;
  /** The player asked the loop to run. */
  running: boolean;
  /** Deliberate hold (user pause or presentation loss). */
  paused: boolean;
  /** Inspection slice, never the account. */
  showcase: boolean;
  /** This tab owns account writes. */
  writer: boolean;
}

export interface RunDecision {
  mode: RunMode;
  /** The presentation may read the sim this tick. */
  present: boolean;
  /** Persist the time-accounting boundary on entry (stamp lastSavedAt), so a later load cannot
   *  recount the held span as away progress (F33). */
  persistBoundary: boolean;
}

export function resolveRunMode(condition: RunCondition): RunDecision {
  if (condition.showcase) return { mode: 'preview', present: true, persistBoundary: false };
  if (condition.paused || !condition.running || !condition.writer)
    return { mode: 'held', present: true, persistBoundary: false };
  return { mode: 'live', present: true, persistBoundary: false };
}

/** Entering presentation loss: freeze the sim AND persist the boundary first. Readers of a lost
 *  renderer keep an accessible HUD; nothing advances until the context is back. */
export function renderLossDecision(): RunDecision {
  return { mode: 'held', present: false, persistBoundary: true };
}
