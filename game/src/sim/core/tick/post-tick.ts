import type { GameState } from '../types';
import type { Character } from '../player';
import { E, eng } from '../../../engine/client';
import { decayStatusStack, type Statuses, type StatusName } from '../../combat/combat';
import { tickCurses } from '../../combat/curse';
import { forgetDead as forgetMobStatus } from '../../combat/mobStatus';
import { maybeDrink, maybeFarm } from '../../world/farm';
import { tickFieldwork } from '../../world/fieldwork';
import { isBossKind } from '../kinds';
import { push } from '../log';

/**
 * The closing world stage of one tick: the curses and statuses that expire, the character's own
 * status clock, the potion and farm automations, and the fieldwork that runs every second.
 *
 * Runs whether or not the combat clock halted, exactly as the tick always ordered it.
 */
export function advancePostTick(
  s: GameState,
  c: Character,
  rng: () => number,
  statuses: Statuses,
  statusesAppliedThisTick: Set<StatusName>,
): void {
  const groupIds = new Set(s.group.map((m) => m.id));
  tickCurses(s.curses, groupIds);
  forgetMobStatus(s.mobStatus, groupIds);
  for (const key of Object.keys(statuses) as (keyof Statuses)[]) {
    const st = statuses[key]!;
    // A Shock inflicted in the mob phase starts at the end of this step, so its duration begins next step.
    if (key === 'shock' && statusesAppliedThisTick.has('shock')) continue;
    if (key === 'poison' || key === 'mark') {
      st.secLeft--;
      if (st.secLeft <= 0) {
        decayStatusStack(st);
        if (st.stacks > 0) st.secLeft = key === 'poison'
          ? E.status.poison.decay_sec : E.status.mark.decay_sec;
        else delete statuses[key];
      }
    } else if (key === 'shock') {
      // A shock's clock is its fractional stop. One world second spends only the slice it could stop
      // (`game.ts` reads that same slice for `playerActiveFraction`), so expiry never overdraws a
      // 0.5 s shock by a whole second: it spends the stop, and the status ends when it is spent.
      st.secLeft = Math.max(0, st.secLeft - Math.min(1, st.secLeft));
      if (st.secLeft <= 0) delete statuses[key];
    } else {
      st.secLeft--;
      if (st.secLeft <= 0) delete statuses[key];
    }
  }

  const drank = s.player.hp > 0 ? maybeDrink(s, c, s.group.some((m) => isBossKind(m.kind))) : null;
  if (drank) push(s, `${drank.name} restores ${eng.fmt(drank.amount)} ${drank.pool} (shared ${E.potions.shared_cooldown_sec}s cooldown)`);

  // the farm's own automation, the twin of the potion path (parking: "Auto plant, harvest and brew")
  for (const line of maybeFarm(s)) push(s, line);
  tickFieldwork(s, rng);
}
