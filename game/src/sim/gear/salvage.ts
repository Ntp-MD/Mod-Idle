import { E } from '../../engine/client';
import { fitsTransaction } from './slots';
import type { GameState } from '../core/types';

export const salvageGrants = (s: GameState) => Object.entries(E.salvage.outputs).map(([key, amount]) => ({
  bucket: s.fieldwork.materials, key, amount, capKind: 'material',
}));

export function canDissolve(s: GameState): boolean {
  if (!Number.isSafeInteger((s.counters.salvaged || 0) + 1)) return false;
  if (s.dungeon) return Object.entries(E.salvage.outputs).every(([key, amount]) =>
    Number.isSafeInteger(amount) && amount > 0 && Number.isSafeInteger((s.dungeon!.escrow.materials?.[key] || 0) + amount));
  return fitsTransaction(s, [], salvageGrants(s));
}

/** Every caller uses the complete resource bundle; refusal never deletes gear or earns history. */
export function dissolve(s: GameState): boolean {
  if (!canDissolve(s)) { s.counters.stopped = (s.counters.stopped || 0) + 1; return false; }
  const bucket = s.dungeon ? (s.dungeon.escrow.materials ||= {}) : s.fieldwork.materials;
  for (const [key, amount] of Object.entries(E.salvage.outputs)) bucket[key] = (bucket[key] || 0) + amount;
  s.counters.salvaged = (s.counters.salvaged || 0) + 1;
  return true;
}
