/**
 * Weapon Mastery — the level-independent side track (`equipment-weapon.md` · D-065).
 *
 * Mastery is earned per kill by the weapon actually held, and it pays in weight and drop rate only.
 * It never touches damage, because all 12 types are already tuned to equal DPS — a damage bonus
 * would make one type permanently better and kill the reason the track exists.
 */

export function createMastery(BASES) {
  const M = BASES.mastery;

  /** level = floor(sqrt(xp ÷ 100)) + 1, Cap 20 — the same curve as Farming. */
  const level = (xp) => Math.min(M.level_cap, Math.floor(Math.sqrt(xp / M.level_divisor)) + 1);
  const xpForLevel = (lvl) => Math.pow(lvl - 1, 2) * M.level_divisor;
  const payKill = (xp) => (xp || 0) + M.xp_per_kill;

  /** While held: the weapon's own weight falls 1% a level, to −20%. */
  const weightDiscount = (lvl) => Math.min(M.weight_discount_cap_pct, lvl * M.weight_discount_per_level_pct);
  const weaponWeight = (baseWeight, lvl) => baseWeight * (1 - weightDiscount(lvl) / 100);

  /** While held: skills with this weapon gain 0.5% a level from L5, to +8%. */
  const skillBonus = (lvl) => 1 + Math.min(M.skill_bonus_cap_pct, Math.max(0, lvl >= M.skill_bonus_from_level ? (lvl - M.skill_bonus_from_level + 1) * M.skill_bonus_per_level_pct : 0)) / 100;

  /** Account-wide: every type at L10 or better adds +1% drop rate, to +12% across 12 types. */
  const dropBonusPct = (levelsByType) => Object.values(levelsByType || {})
    .filter((lvl) => lvl >= M.drop_bonus_level_required).length * M.drop_bonus_per_type_pct;
  const dropMultiplier = (levelsByType) => 1 + dropBonusPct(levelsByType) / 100;

  const MAX_DROP_BONUS = (BASES.weapons || []).length * M.drop_bonus_per_type_pct;

  return { M, level, xpForLevel, payKill, weightDiscount, weaponWeight, skillBonus, dropBonusPct, dropMultiplier, MAX_DROP_BONUS };
}
