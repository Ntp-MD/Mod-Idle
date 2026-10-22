/**
 * The status shapes, kept apart from `combat.ts` so a pure reader (the keystone runtime adapter,
 * which also runs in Node) can name them without pulling the live combat module and its client
 * imports behind it.
 */

import type { PLAYER_STATUS_FAMILIES } from '../../../engine/keystones.ts';

/** The families one side of the field can carry — the engine's list, so the save schema and this file never drift. */
export type StatusName = (typeof PLAYER_STATUS_FAMILIES)[number];
export interface StatusLine {
  stacks: number;
  secLeft: number;
  perSec: number;
  /** The dealer's aligned Elemental DPS at apply time, the mirror of the mob record's `alignedPerSec`:
   *  the DoT budget is priced off the dealer, never off the character taking the damage. */
  alignedSec?: number;
  /** Per-stack snapshots for DoTs applied by multiple mobs with different damage. */
  stackPerSec?: number[];
}
export type Statuses = Partial<Record<StatusName, StatusLine>>;
