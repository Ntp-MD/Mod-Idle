import type { GameState } from '../types';
import { spendReference } from '../state';
import { push } from '../log';
import { advanceEconomy } from '../economy';
import { tickHunger } from '../../world/fieldwork';

/**
 * The opening stage of one tick: the world clock, the played-second counter, hunger, and the idle
 * default that spends a level's points before the pool is clamped for the tick.
 */
export function advancePreTick(s: GameState, online: boolean): void {
  advanceEconomy(s);
  s.counters.playSec++;
  const foodNote = tickHunger(s, online);
  if (foodNote) push(s, foodNote);
  // the idle default spends this tick's level points before the pool is clamped, so the sheet the
  // pool is read against already includes them; manual players bank and spend by hand.
  if (s.player.autoSpend && s.player.statPoints > 0) spendReference(s);
}
