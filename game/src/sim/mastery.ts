import { BASES } from '../engine/client';
import { createMastery } from '../../../engine/mastery.ts';
import type { GameState } from './types';

/** The Mastery model is shared with the cage data — `bases.json` carries the constants. */
export const mastery: any = createMastery(BASES);

export const WEAPONS: any[] = BASES.weapons;
export const weaponByName = (name: string) =>
  WEAPONS.find((w) => name === w.name) || WEAPONS.find((w) => String(name || '').toLowerCase().includes(w.name)) || null;

/** A bare hand has no type to keep XP, so it holds mastery 0 like any weapon nobody uses. */
export function masteryLevel(state: GameState, weaponName: string | null): number {
  return mastery.level(weaponName ? state.mastery[weaponName] || 0 : 0);
}

/** The held weapon earns 4 XP per kill; nothing else is counted. */
export function payMastery(state: GameState, weaponName: string | null) {
  if (!weaponName) return;
  state.mastery[weaponName] = mastery.payKill(state.mastery[weaponName]);
}

/** Account-wide: types at L10+ each add their share of drop rate. */
export function dropMultiplier(state: GameState): number {
  const levels: Record<string, number> = {};
  for (const w of WEAPONS) levels[w.name] = mastery.level(state.mastery[w.name] || 0);
  return mastery.dropMultiplier(levels);
}

export function dropBonusPct(state: GameState): number {
  return Math.round((dropMultiplier(state) - 1) * 1000) / 10;
}

export const masteryLabel = (lvl: number) =>
  `Mastery ${lvl}/${mastery.M.level_cap} · weight -${mastery.weightDiscount(lvl)}%`;
