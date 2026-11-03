import type { GameState } from '../types';
import type { Character } from '../player';
import { eng } from '../../../engine/client';
import { finishPushAtCamp } from '../../world/fieldwork';
import { push } from '../log';

/**
 * The Field Camp step: a Push recovers at the camp and the walk back costs nothing.
 *
 * Returns true on every second spent in the camp — the tick ends there, exactly as the inline
 * `return s` did, so nothing after this stage runs while the character rests.
 */
export function advanceCampStage(s: GameState, c: Character): boolean {
  if (s.phase !== 'camp') return false;
  s.campSec--;
  s.player.hp = Math.min(c.maxHp, s.player.hp + c.hpRegen * 8);
  if (s.campSec <= 0) {
    if (finishPushAtCamp(s)) push(s, `Recovered at your field Camp in ${eng.zoneById(s.zone).name}`);
    else {
      s.phase = 'fighting';
      push(s, `Back in ${eng.zoneById(s.zone).name} — the walk-back costs no items and no XP`);
    }
  }
  return true;
}
