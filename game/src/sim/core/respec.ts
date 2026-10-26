import { STAT_KEYS, type StatKey } from '../../engine/client';
import type { GameState } from './types';
import { atSettlement } from '../gear/craft';

/** Spending banked points is allowed in the field; returning spent points is a town service. */
export function allocateStats(state: GameState, key: StatKey, delta: number, access = { writer: true }): { ok: boolean; why?: string } {
  if (!access.writer) return { ok: false, why: 'this tab is read-only' };
  if (!STAT_KEYS.includes(key) || !Number.isSafeInteger(delta) || delta === 0)
    return { ok: false, why: 'choose a whole number of Core points' };
  if (delta < 0 && !atSettlement(state)) return { ok: false, why: 'visit a settlement to return Core points' };
  const player = state.player;
  const count = Math.min(Math.abs(delta), delta > 0 ? player.statPoints : player.points[key]);
  if (count <= 0) return { ok: false, why: 'no points available' };
  player.points[key] += delta > 0 ? count : -count;
  player.statPoints += delta > 0 ? -count : count;
  return { ok: true };
}

export function respecStats(state: GameState): { ok: boolean; refunded: number } {
  if (!atSettlement(state)) return { ok: false, refunded: 0 };
  const refunded = STAT_KEYS.reduce((sum, key) => sum + state.player.points[key], 0);
  if (!refunded) return { ok: false, refunded: 0 };
  for (const key of STAT_KEYS) state.player.points[key] = 0;
  state.player.statPoints += refunded;
  return { ok: true, refunded };
}
