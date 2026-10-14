import { STAT_KEYS } from '../engine/client';
import type { GameState } from './types';
import { atSettlement } from './craft';

export function respecStats(state: GameState): { ok: boolean; refunded: number } {
  if (!atSettlement(state)) return { ok: false, refunded: 0 };
  const refunded = STAT_KEYS.reduce((sum, key) => sum + state.player.points[key], 0);
  if (!refunded) return { ok: false, refunded: 0 };
  for (const key of STAT_KEYS) state.player.points[key] = 0;
  state.player.statPoints += refunded;
  return { ok: true, refunded };
}
