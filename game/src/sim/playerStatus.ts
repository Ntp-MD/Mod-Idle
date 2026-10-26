/**
 * The player-status instance adapter (§7.6, D1).
 *
 * `GameState.playerStatuses` is the one canonical store: the native aggregate lines combat writes
 * (stacks, one shared clock, the per-stack damage ladder) stay exactly as they are. This module is
 * the single door every aggregate reader and derived view walks through, so the UI views and the
 * §7.6 instance model can never become a second source of truth. The packets that move a family to
 * real instances (D2's clock, K's lanes) fill the fields the native aggregate does not record.
 */

import { statusDamagePerSec } from './combat';
import type { Statuses, StatusLine, StatusName } from './combat';
import type { StatusInstance } from '../../../engine/keystones.ts';

/** The DoT families the instance model covers; the rest are debuffs with their own current values. */
const DOT_FAMILIES: readonly StatusName[] = ['burn', 'poison', 'bleed'];

/** One family's aggregate view — the shape the UI reads, never a second store. */
export interface PlayerStatusView {
  family: StatusName;
  stacks: number;
  /** The family's total damage per second, stack ladder summed — what actually pays. */
  dps: number;
  secLeft: number;
}

/** The one adapter for the `stacks / perSec / secLeft` views the screen used to read off the raw line. */
export function statusViews(statuses: Statuses): PlayerStatusView[] {
  const out: PlayerStatusView[] = [];
  for (const name of Object.keys(statuses) as StatusName[]) {
    const line = statuses[name];
    if (!line) continue;
    out.push({ family: name, stacks: line.stacks, dps: statusDamagePerSec(line), secLeft: line.secLeft });
  }
  return out;
}

export const stacksOf = (statuses: Statuses, family: StatusName): number => statuses[family]?.stacks ?? 0;
export const perSecOf = (statuses: Statuses, family: StatusName): number => statusDamagePerSec(statuses[family]);

/**
 * The §7.6 instances the native aggregate supports today: one per DoT family, on the native lane.
 * The aggregate records a remaining clock but no per-instance apply time, so `appliedAtUs` is null
 * until a family is held as real instances; `decayGroupId` names the family's own decay clock and
 * `sourceId` is null because the aggregate does not store which mob dealt the line.
 */
export function deriveDotInstances(
  statuses: Statuses,
  clockSec: number,
  unitsPerSec: number,
  periodSec: number,
): StatusInstance[] {
  const nowUs = clockSec * unitsPerSec;
  const out: StatusInstance[] = [];
  for (const family of DOT_FAMILIES) {
    const line: StatusLine | undefined = statuses[family];
    if (!line || line.secLeft <= 0 || line.stacks <= 0) continue;
    const dps = statusDamagePerSec(line);
    if (dps <= 0) continue;
    out.push({
      family,
      lane: 'native',
      dps,
      // burn and poison answer the elemental DoT budget; bleed is physical and sits outside it
      budgetDps: family === 'bleed' ? 0 : dps,
      appliedAtUs: null,
      nextPayAtUs: nowUs + periodSec * unitsPerSec,
      expiresAtUs: nowUs + line.secLeft * unitsPerSec,
      decayGroupId: family === 'poison' ? 'native:poison:decay' : null,
      sourceId: null,
    });
  }
  return out;
}
