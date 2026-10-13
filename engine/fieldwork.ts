import type { FieldworkCfg } from './types.ts';

/** Shared field-skill reads. Runtime resource counts stay in the game state; the formulas and unlocks
 *  are derived from engine.json so the client and any data cage use the same progression. */
export function createFieldwork(F: FieldworkCfg) {
  const skillLevel = (xp: number) => Math.min(F.level_cap, Math.floor(Math.sqrt(Math.max(0, xp) / F.level_divisor)) + 1);
  const masteryLevel = (xp: number) => Math.min(F.mastery_cap, Math.floor(Math.sqrt(Math.max(0, xp) / F.mastery_divisor)) + 1);
  const harvestBonus = (level: number) => F.progression.harvest_bonus_levels
    .filter((milestone) => level >= milestone).length * F.progression.harvest_bonus_per_level;
  const dropChanceAt = (baseChance: number, level: number, mastery: number) => {
    const levelBonus = Math.max(0, level - 1) * F.progression.drop_rate_bonus_per_skill_level_pct;
    const masteryBonus = Math.max(0, mastery - 1) * F.progression.drop_rate_bonus_per_mastery_level_pct;
    const bonusPct = Math.min(F.progression.drop_rate_bonus_cap_pct, levelBonus + masteryBonus);
    return Math.min(1, Math.max(0, baseChance) * (1 + bonusPct / 100));
  };
  const recipeById = Object.fromEntries(F.recipes.map((recipe) => [recipe.id, recipe]));
  const foodById = Object.fromEntries(F.foods.map((food) => [food.id, food]));
  const siteAt = (wild: number | null | undefined): 'dungeon' | 'mine' | 'grove' | null => {
    if (wild == null) return null;
    const sites = F.wild_site_index;
    return wild === sites.dungeon ? 'dungeon' : wild === sites.mine ? 'mine' : wild === sites.grove ? 'grove' : null;
  };
  return { F, skillLevel, masteryLevel, harvestBonus, dropChanceAt, recipeById, foodById, siteAt };
}
