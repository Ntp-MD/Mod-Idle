import { sm } from '../../engine/client';
import { bundleOf, bloodPriceHp, manaDebtFloor } from '../../../../engine/keystones.ts';
import { payHpCost } from '../../../../engine/skills.ts';
import { push } from '../core/log';
import { spendableMana, usableMana, type PreparedSkillCast } from './skills';
import { updateArenaAction, type CombatArena, type CombatArenaAction } from './combat-arena';
import type { CombatFlight } from './combat-actions';
import type { Character } from '../core/player';
import type { GameState } from '../core/types';
import type { SkillRow } from '../../../../engine/types.ts';

/**
 * A bounded channel's live payment clock. One authoritative record per released action,
 * held on the arena action itself: the effective sustain rate, the funded watermark, and
 * the skill the receipt names. The intent, the flights and the save ledger never keep
 * their own copy of the paid position.
 */

/** Capture the effective sustain rate at release; the start cost is paid separately. */
export function initChannelPayment(
  arena: CombatArena | undefined, actionId: number, skill: SkillRow, skillLevel: number, atUs: number,
): void {
  if (!arena || sm.channelRateSpec(skill) == null) return;
  updateArenaAction(arena, actionId, {
    channelRatePerSec: sm.channelRateOf(skill, { skillLevel }),
    channelPaidUntilUs: atUs,
  });
}

/**
 * Stop one channel exactly once: drop only its unspent future flights, keep resolved
 * pulses, damage, drops and paid cost, and stamp the terminal reason on the action.
 * A repeated call finds no future work and no unstamped action, so it changes nothing.
 */
export function stopChannel(
  arena: CombatArena | undefined, actionId: number, atUs: number, reason: string,
  cancelIntent?: (reason: string) => void,
): void {
  if (!arena) return;
  for (const flight of [...arena.flights]) {
    if (flight.actionId !== actionId || flight.timing.impactAtUs <= atUs) continue;
    arena.flights.splice(arena.flights.indexOf(flight), 1);
  }
  const action = arena.actions.find((entry) => entry.id === actionId);
  if (action && action.cancelledAtUs == null)
    updateArenaAction(arena, action.id, { cancelledAtUs: atUs, cancelReason: reason, endsAtUs: atUs });
  if (arena.intent?.actionId === actionId) cancelIntent?.(reason);
}

/**
 * Fund the interval up to one impact's timestamp before the impact may resolve.
 * Mana is the only sustain resource: a Blood Price bundle converts the due amount to
 * HP exactly like a press price, Mana Debt borrows to its usual floor, and Capacitive
 * Casting answers funded Mana spend through the shared release payment. A free release
 * (Trance) never frees the sustain: only the start cost was free.
 *
 * Returns true when the impact may resolve, false when the flight was dropped.
 */
export function settleChannelDue(opts: {
  arena: CombatArena | undefined;
  s: GameState;
  c: Character;
  action: CombatArenaAction | undefined;
  flight: CombatFlight;
  atUs: number;
  units: number;
  payCast: (cast: Pick<PreparedSkillCast, 'manaCost' | 'hpCost'>) => void;
  cancelIntent?: (reason: string) => void;
}): boolean {
  const { arena, s, c, action, flight, atUs, units, payCast, cancelIntent } = opts;
  const rate = action?.channelRatePerSec;
  if (!(arena && rate != null && rate > 0)) return true;
  const dropFlight = () => {
    const at = arena.flights.indexOf(flight);
    if (at >= 0) arena.flights.splice(at, 1);
  };
  // A stopped channel never resolves a leftover: the receipt is already terminal.
  if (action?.cancelledAtUs != null) {
    dropFlight();
    return false;
  }
  const paidUntil = action?.channelPaidUntilUs ?? atUs;
  const elapsed = Math.max(0, atUs - paidUntil);
  if (elapsed <= 0) return true;
  const due = rate * elapsed / units;
  const stop = () => {
    dropFlight();
    stopChannel(arena, flight.actionId, atUs, 'mana exhausted', cancelIntent);
    const name = sm.byId[flight.cast.id]?.name ?? flight.cast.id;
    push(s, `${name} runs out of Mana and the channel stops`);
  };
  const blood = bundleOf(c.keystones, 'blood-price');
  if (blood && due > 0) {
    const hpDue = bloodPriceHp(due, blood.params as Record<string, number>);
    if (s.player.hp - hpDue < 1) {
      stop();
      return false;
    }
    s.player.hp = payHpCost(s.player.hp, hpDue);
  } else {
    const spendable = spendableMana(c, s.skills, s.player.mana);
    const debt = bundleOf(c.keystones, 'mana-debt');
    const floor = debt ? manaDebtFloor(usableMana(c, s.skills), debt.params as Record<string, number>) : 0;
    // A pool repaying debt funds no new interval, and a shortfall stops the channel
    // instead of borrowing past the floor: a low pool is an affordability fact, not a price.
    if (spendable < 0 || spendable - due < floor) {
      stop();
      return false;
    }
    payCast({ manaCost: due, hpCost: 0 });
  }
  updateArenaAction(arena, flight.actionId, { channelPaidUntilUs: atUs });
  return true;
}
