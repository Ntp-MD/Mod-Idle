import type { FieldworkCfg } from './types.ts';

export type LifeSkillId = 'mining' | 'woodcutting' | 'hunting' | 'cooking' | 'farming' | 'fishing' | 'smithing';
export type LifeSkillBonus = Partial<Record<'armour_pct' | 'evasion_pct' | 'accuracy_pct' | 'hp_regen_pct' | 'mana_regen_pct' | 'armour_pen', number>>;

/** Fixed allocations never redistribute a track's unused share to another skill. */
export function createLifeSkills(F: FieldworkCfg) {
  const C = F.life_skill_combat;
  const bonuses = (levels: Partial<Record<LifeSkillId, number>>): LifeSkillBonus => {
    const out: LifeSkillBonus = {};
    const rungCount = C.rungs.length;
    for (const id of Object.keys(C.weights) as LifeSkillId[]) {
      const level = levels[id] || 0;
      const unlocked = C.rungs.filter((rung) => level >= rung).length;
      const budget = Math.min(C.track_cap, C.budget * C.weights[id] * unlocked / rungCount);
      const effect = C.effects[id];
      if (effect) out[effect.stat as keyof LifeSkillBonus] = (out[effect.stat as keyof LifeSkillBonus] || 0) + budget;
    }
    return out;
  };
  return { C, bonuses };
}
