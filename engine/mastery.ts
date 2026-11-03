/**
 * Weapon Mastery — the level-independent side track (`equipment-weapon.md`).
 *
 * Mastery is earned per kill by the weapon actually held. It pays in weight, drop rate and skill
 * damage, never in basic-attack damage.
 */

import type { BasesData } from './types.ts';

export function createMastery(BASES: BasesData) {
  const M = BASES.mastery;

  /** level = floor(sqrt(xp ÷ 100)) + 1, Cap 20 — the same curve as Farming. */
  const level = (xp: number) => Math.min(M.level_cap, Math.floor(Math.sqrt(xp / M.level_divisor)) + 1);
  const xpForLevel = (lvl: number) => Math.pow(lvl - 1, 2) * M.level_divisor;
  const payKill = (xp: number) => (xp || 0) + M.xp_per_kill;

  /** While held: the weapon's own weight falls 1% a level, to −20%. */
  const weightDiscount = (lvl: number) => Math.min(M.weight_discount_cap_pct, lvl * M.weight_discount_per_level_pct);
  const weaponWeight = (baseWeight: number, lvl: number) => baseWeight * (1 - weightDiscount(lvl) / 100);

  /** While held: matching skills gain full Mastery damage and other skills gain half. */
  const skillBonus = (lvl: number, matchesWeapon = true) => {
    const pct = Math.min(M.skill_bonus_cap_pct, Math.max(0, lvl >= M.skill_bonus_from_level ? (lvl - M.skill_bonus_from_level + 1) * M.skill_bonus_per_level_pct : 0));
    return 1 + pct * (matchesWeapon ? 1 : M.skill_bonus_off_type_mult) / 100;
  };

  /** Account-wide: every type at L10 or better adds +1% drop rate — the cap is one point per type. */
  const dropBonusPct = (levelsByType?: Record<string, number>) => Object.values(levelsByType || {})
    .filter((lvl) => lvl >= M.drop_bonus_level_required).length * M.drop_bonus_per_type_pct;
  const dropMultiplier = (levelsByType?: Record<string, number>) => 1 + dropBonusPct(levelsByType) / 100;

  const MAX_DROP_BONUS = (BASES.weapons || []).length * M.drop_bonus_per_type_pct;

  return { M, level, xpForLevel, payKill, weightDiscount, weaponWeight, skillBonus, dropBonusPct, dropMultiplier, MAX_DROP_BONUS };
}
