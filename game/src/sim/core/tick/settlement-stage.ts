import type { GameState } from '../types';
import type { CombatArena } from '../../combat/combat-arena';
import { clampPools } from '../state';
import { syncFieldState } from '../../world/field-area';
import { snapshotPendingWork } from '../pending-work';

/**
 * The closing stage of one tick, in the order the tick always used.
 *
 * The pools are re-read against the sheet the tick ended on, the field registry mirrors the
 * authoritative group by id, and the arena's released work is refreshed into the pure-data ledger so
 * a save cannot hold the reward with an unapplied (or already-applied) impact.
 */
export function settleTick(s: GameState, arena?: CombatArena): void {
  clampPools(s);
  // The field registry mirrors the authoritative group by id and records the cohort/session facts.
  syncFieldState(s, arena);
  // The active arena's released work is canonical saved state: refresh the pure-data ledger after
  // the tick so a save cannot hold the reward with an unapplied (or already-applied) impact.
  if (arena) {
    const pending = snapshotPendingWork(arena, s.group);
    if (pending || s.pendingWork) s.pendingWork = pending;
  }
}
