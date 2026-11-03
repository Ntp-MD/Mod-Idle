import { SKILL_EFFECT_OVERRIDES } from './overrides';
import type { ArenaShape, EffectShape, FieldEventLike, MobLike, MobSkillLike, SkillLike } from './types';

const ELEMENT_SHAPES: Record<string, EffectShape> = {
  fire: 'fire',
  cold: 'cold',
  lightning: 'lightning',
  earth: 'earth',
  poison: 'poison',
  chaos: 'chaos',
};

/** An Element with no authored shape (including physical) falls back to the generic bolt. */
export function elementShape(element?: string | null): EffectShape {
  return ELEMENT_SHAPES[String(element ?? '').toLowerCase()] ?? 'bolt';
}

/** A player skill or a weapon swing, in the FieldPlates vocabulary. */
export function skillShape(skill?: SkillLike | null, fallbackGroup = 'melee', fallbackElement?: string | null): EffectShape {
  const override = skill?.id ? SKILL_EFFECT_OVERRIDES[skill.id] : undefined;
  if (override) return override;
  const group = skill?.group && skill.group !== 'all' ? skill.group : fallbackGroup;
  if (group === 'melee') return 'slash';
  if (group === 'ranged') return 'bolt';
  return elementShape(skill?.element || fallbackElement);
}

/** A mob skill response, or the body's own damage when the event carries no skill. */
export function mobSkillShape(skill?: MobSkillLike | null, mob?: MobLike | null): EffectShape {
  if (skill) {
    if (skill.element && skill.element !== 'physical') return elementShape(skill.element);
    return skill.cast?.delivery === 'melee' ? 'slash' : 'bolt';
  }
  if (!mob) return 'burst';
  return mob.damage === 'physical' ? 'slash' : elementShape(mob.innate?.[0]);
}

/** One FieldPlates event: heal, buff, block/dodge, an incoming skill, or a player hit. */
export function fieldShape(event: FieldEventLike, ctx: {
  mob?: MobLike | null;
  skill?: SkillLike | null;
  mobSkill?: MobSkillLike | null;
  weaponGroup?: string | null;
  weaponElement?: string | null;
} = {}): EffectShape {
  if (event.kind === 'heal') return 'heal';
  if (event.kind === 'buff') return 'ward';
  if (event.kind === 'block') return /block/i.test(event.text ?? '') ? 'block' : 'dodge';
  if (event.kind === 'taken') return mobSkillShape(ctx.mobSkill, ctx.mob);
  return skillShape(ctx.skill, ctx.weaponGroup || 'melee', ctx.weaponElement);
}

/** The ARPG keeps the raw Element for magic, `arrow` for ranged and `slash` for melee. */
export function arenaSkillShape(skill?: SkillLike | null, weaponGroup?: string | null, weaponElement?: string | null): ArenaShape {
  const group = skill ? skill.group : weaponGroup;
  if (group === 'ranged') return 'arrow';
  if (group === 'magic') return (skill?.element || weaponElement || 'bolt') as ArenaShape;
  return 'slash';
}

/** A mob action in the ARPG: ranged, ground and magic bodies keep their Element; physical melee slashes. */
export function arenaMobShape(skill?: MobSkillLike | null, mob?: MobLike | null): ArenaShape {
  const ranged = skill?.mode === 'aura' || (!!skill?.cast && skill.cast.delivery !== 'melee');
  if (ranged || mob?.damage === 'magic') {
    return (skill?.element || mob?.innate?.[0] || 'bolt') as ArenaShape;
  }
  return 'slash';
}
