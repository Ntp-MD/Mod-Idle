import { describe, expect, it } from 'vitest';
import { MOB_SKILLS, sm } from '../src/engine/client';
import { auraFxFor, skillFxFor } from '../src/ui/combat/arena-skill-effects';

describe('skill FX assembly', () => {
  it('has composed cast, projectile and impact art for every player skill', () => {
    for (const skill of sm.all()) {
      const fx = skillFxFor(skill.id);
      expect(fx, skill.id).toBeDefined();
      expect(fx!.path.length, skill.id).toBeGreaterThan(0);
      expect(fx!.posePath.length, skill.id).toBeGreaterThan(0);
      expect(fx!.projectilePath.length, skill.id).toBeGreaterThan(0);
      if (skill.type === 'aura') expect(auraFxFor(skill.id), skill.id).toBeDefined();
    }
  });

  it('has art for every mob-only skill too', () => {
    for (const skill of MOB_SKILLS.skills) {
      const fx = skillFxFor(skill.id);
      expect(fx, skill.id).toBeDefined();
      expect(fx!.path.length, skill.id).toBeGreaterThan(0);
      if (skill.mode === 'aura') expect(auraFxFor(skill.id), skill.id).toBeDefined();
    }
  });

  it('composes shared atoms into distinct fireball and meteor projectile art', () => {
    const fireball = skillFxFor('attack.fireball')!;
    const meteor = skillFxFor('attack.firestorm')!;
    expect(fireball.projectilePath).not.toBe(meteor.projectilePath);
    expect(meteor.projectilePath.length).toBeGreaterThan(fireball.projectilePath.length);
    expect(fireball.path.length).toBeGreaterThan(0);
    expect(meteor.path.length).toBeGreaterThan(0);
  });
});
