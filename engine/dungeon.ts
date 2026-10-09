/**
 * The dungeon run — one dungeon per zone, on the first wild side of its settlement.
 *
 * A run is a mode, not a place: the sim never reads a coordinate (M7), it only knows whether a
 * run is open. The run fields `mob_cap` normal mobs of the zone it was entered in and pays the
 * ordinary per-kill roll, so the escrow only delays payment and `mob_HP`, the drop line and the
 * timeline never move (one static HP table). Loot waits in escrow until the last mob falls; a Push ends the run at
 * once and the escrow is forfeited. A cleared run cools down for `cooldown_sec`.
 */

import type { EngineData } from './types.ts';

export function createDungeon(E: EngineData) {
  const D = E.dungeon;

  const mobCap = D.mob_cap;
  const groupCap = D.group_cap;
  const cooldownSec = D.cooldown_sec;

  /** A dungeon group is the zone's own roll clamped to the run's cap and to what is left. */
  const clampGroup = (want: number, left: number) => Math.max(0, Math.min(want, groupCap, left));

  /** Seconds of cooldown left at `nowSec`, given the clock second of the last clear (or null). */
  const cooldownLeft = (nowSec: number, clearedAtSec: number | null | undefined) => {
    if (clearedAtSec == null) return 0;
    return Math.max(0, clearedAtSec + cooldownSec - nowSec);
  };

  const canEnter = (nowSec: number, clearedAtSec: number | null | undefined, active: boolean) =>
    !active && cooldownLeft(nowSec, clearedAtSec) <= 0;

  return {
    D, mobCap, groupCap, cooldownSec, clampGroup, cooldownLeft, canEnter,
  };
}
