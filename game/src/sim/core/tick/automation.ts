import type { GameState } from '../types';
import { stashTabCount, depositMany } from '../../town/town';
import {
  driveAutoReturn, drivePatrol, finishAutoReturnDeposit, maybeStartAutoReturn,
} from '../../world/exploration';
import { push } from '../log';

/**
 * Patrol, Auto-Return and the bag-full deposit, in the order the tick always ran them: the return is
 * started, driven, and — on the second its deposit lands — stashed and re-driven before the patrol
 * gets its turn.
 */
export function runExplorationAutomation(s: GameState, online: boolean, wasPatrolling = s.patrol.active): void {
  const triggered = maybeStartAutoReturn(s, online, wasPatrolling);
  if (triggered) push(s, triggered);
  const automatic = driveAutoReturn(s, online);
  if (automatic.message) push(s, automatic.message);
  if (automatic.deposit) {
    s.hunting = false;
    const moved = stashTabCount(s) > 0 ? depositMany(s, s.bag.map((_, i) => i), 0) : 0;
    push(s, finishAutoReturnDeposit(s, moved));
    const resume = driveAutoReturn(s, online);
    if (resume.message) push(s, resume.message);
  }
  if (s.autoReturn.phase === 'idle') {
    const patrol = drivePatrol(s, online);
    if (patrol) push(s, patrol);
  }
}
