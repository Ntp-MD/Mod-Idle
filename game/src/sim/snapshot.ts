import { E } from '../engine/client';
import type { GameState, SnapshotReason } from './types';

/**
 * Which snapshot is owed and when (`save.md` item 5).
 *
 * Three walking snapshots, taken on a level up, on a successful Ascend or Refine, and every ten
 * minutes of play. They guard against a corrupt file only — a restore rewinds the whole character,
 * so it can never be used to drop the latest craft result while keeping its stones (item 3).
 * The trigger list is data, so a design change there moves the game without a code edit.
 */
export const SAVE_CFG = E.save;

/** `timer` is not a trigger name, it is the fallback; only listed triggers may fire early. */
export function mark(s: GameState, reason: SnapshotReason): void {
  if (SAVE_CFG.snapshot_triggers.includes(reason)) s.pendingSnapshot = reason;
}

/** Why a snapshot is owed right now, or null. An event reason beats the timer. */
export function reason(s: GameState): SnapshotReason | null {
  if (s.pendingSnapshot) return s.pendingSnapshot;
  return s.clockSec >= s.nextSnapshotAt ? 'timer' : null;
}

/** Called by the save layer once a snapshot is actually stored. */
export function arm(s: GameState): GameState {
  s.pendingSnapshot = null;
  s.nextSnapshotAt = s.clockSec + SAVE_CFG.snapshot_interval_min * 60;
  return s;
}
