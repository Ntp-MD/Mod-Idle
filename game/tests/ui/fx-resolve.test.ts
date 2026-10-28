import { describe, expect, it } from 'vitest';
import { sm } from '../../src/engine/client';
import {
  EFFECT_SHAPES, SKILL_EFFECT_OVERRIDES,
  arenaMobShape, arenaSkillShape, elementShape, fieldShape, isEffectShape, mobSkillShape, skillShape,
} from '../../src/ui/fx';

describe('effect shape resolver', () => {
  it('maps every Element to a shape, with a generic bolt fallback', () => {
    expect(elementShape('fire')).toBe('fire');
    expect(elementShape('COLD')).toBe('cold');
    expect(elementShape('lightning')).toBe('lightning');
    expect(elementShape('earth')).toBe('earth');
    expect(elementShape('poison')).toBe('poison');
    expect(elementShape('chaos')).toBe('chaos');
    expect(elementShape('physical')).toBe('bolt');
    expect(elementShape(undefined)).toBe('bolt');
  });

  it('resolves every active skill to a known shape', () => {
    for (const skill of sm.all()) {
      const shape = skillShape(skill, 'melee', 'physical');
      expect(isEffectShape(shape), skill.id).toBe(true);
      expect(EFFECT_SHAPES).toContain(shape);
    }
  });

  it('uses group and Element defaults for a player skill', () => {
    expect(skillShape({ id: 'attack.fireball', group: 'magic', element: 'fire' })).toBe('fire');
    expect(skillShape({ group: 'melee', element: 'fire' })).toBe('slash');
    expect(skillShape({ group: 'ranged', element: 'cold' })).toBe('bolt');
    expect(skillShape({ group: 'all' }, 'ranged')).toBe('bolt');
    expect(skillShape(null, 'magic', 'earth')).toBe('earth');
  });

  it('resolves a mob response from its skill first, then its body', () => {
    expect(mobSkillShape({ element: 'cold', role: 'any' })).toBe('cold');
    expect(mobSkillShape({ element: 'physical', role: 'stand-off' })).toBe('bolt');
    expect(mobSkillShape({ element: 'physical', role: 'front' })).toBe('slash');
    expect(mobSkillShape(null, { damage: 'physical', innate: ['fire'] })).toBe('slash');
    expect(mobSkillShape(null, { damage: 'magic', innate: ['poison'] })).toBe('poison');
    expect(mobSkillShape(null, null)).toBe('burst');
  });

  it('maps a whole FieldPlates event, not just its skill', () => {
    expect(fieldShape({ kind: 'heal' })).toBe('heal');
    expect(fieldShape({ kind: 'buff' })).toBe('ward');
    expect(fieldShape({ kind: 'block', text: 'Block' })).toBe('block');
    expect(fieldShape({ kind: 'block', text: 'dodge' })).toBe('dodge');
    expect(fieldShape({ kind: 'taken' }, { mob: { damage: 'physical' } })).toBe('slash');
    expect(fieldShape({ kind: 'taken' }, { mobSkill: { element: 'fire', role: 'any' } })).toBe('fire');
    expect(fieldShape({ kind: 'hit' }, { skill: { group: 'magic', element: 'chaos' } })).toBe('chaos');
  });

  it('keeps the ARPG vocabulary: arrow for ranged and raw Element for magic', () => {
    expect(arenaSkillShape({ group: 'magic', element: 'fire' })).toBe('fire');
    expect(arenaSkillShape({ group: 'ranged' })).toBe('arrow');
    expect(arenaSkillShape({ group: 'melee' })).toBe('slash');
    expect(arenaSkillShape({ group: 'all' })).toBe('slash');
    expect(arenaSkillShape(null, 'magic', 'cold')).toBe('cold');
    expect(arenaMobShape({ element: 'cold', role: 'stand-off' })).toBe('cold');
    expect(arenaMobShape(null, { damage: 'magic', innate: ['earth'] })).toBe('earth');
    expect(arenaMobShape(null, { damage: 'physical' })).toBe('slash');
  });

  it('keeps bespoke overrides pointed at active skills and valid shapes', () => {
    const ids = new Set(sm.all().map((skill) => skill.id));
    for (const [id, shape] of Object.entries(SKILL_EFFECT_OVERRIDES)) {
      expect(ids.has(id), id).toBe(true);
      expect(isEffectShape(shape), id).toBe(true);
    }
  });
});
