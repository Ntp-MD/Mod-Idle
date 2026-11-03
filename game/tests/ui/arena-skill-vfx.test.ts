import { describe, expect, it } from 'vitest';
import { sm, MS } from '../../src/engine/client';
import { activeSkillVfx, activeSkillVfxIds, SKILL_VFX_DESIGN_IDS, type SkillVfxSpec } from '../../src/ui/combat/arena-skill-vfx';

/** The live attack roster, read straight from the canonical client the sim uses. */
const liveAttacks = (): { id: string; element?: string; area?: any; cast?: any; action?: any }[] =>
  sm.all().filter((skill: any) => skill.type === 'attack' && !skill.retired);

describe('active-skill VFX specs', () => {
  it('authors an explicit design row for every live attack skill', () => {
    const ids = activeSkillVfxIds().sort();
    expect(ids).toEqual(liveAttacks().map((skill) => skill.id).sort());
    expect([...SKILL_VFX_DESIGN_IDS].sort()).toEqual(ids);
  });

  it('resolves a spec for each live attack and mirrors the canonical geometry', () => {
    for (const skill of liveAttacks()) {
      const spec = activeSkillVfx(skill.id) as SkillVfxSpec;
      expect(spec, skill.id).toBeTruthy();
      expect(spec.id).toBe(skill.id);
      expect(spec.radiusM).toBe(Number(skill.area?.radius_m ?? 0));
      expect(spec.lengthM).toBe(Number(skill.area?.length_m ?? 0));
      expect(spec.widthM).toBe(Number(skill.area?.width_m ?? 0));
      expect(spec.angleDeg).toBe(Number(skill.area?.angle_deg ?? 0));
      const profile = sm.castProfileOf(skill);
      expect(spec.projectile, skill.id).toBe(spec.lob || profile.delivery === 'projectile');
    }
  });

  it('keeps every particle budget deliberate and in bounds', () => {
    const bound = (count: number, max: number) => Number.isInteger(count) && count >= 0 && count <= max;
    for (const id of activeSkillVfxIds()) {
      const spec = activeSkillVfx(id) as SkillVfxSpec;
      expect(bound(spec.particles.gather, 12), `${id} gather`).toBe(true);
      expect(bound(spec.particles.burst, 24), `${id} burst`).toBe(true);
      expect(bound(spec.particles.embers, 18), `${id} embers`).toBe(true);
      expect(bound(spec.particles.ground, 24), `${id} ground`).toBe(true);
      expect(bound(spec.particles.loop, 20), `${id} loop`).toBe(true);
      expect(bound(spec.particles.trail, 10), `${id} trail`).toBe(true);
      expect(spec.heightM).toBeGreaterThan(.1);
      expect(spec.heightM).toBeLessThan(4.6);
      expect(spec.apexM).toBeGreaterThanOrEqual(0);
      expect(spec.apexM).toBeLessThan(4.6);
      expect(spec.pulses).toBeGreaterThanOrEqual(1);
      expect(spec.pulses).toBeLessThanOrEqual(5);
    }
  });

  it('keeps the presentation forms inside the authored vocabulary', () => {
    const forms = new Set(['bolt', 'lob', 'strike', 'cleave', 'line', 'nova', 'cone',
      'chain', 'skybolt', 'sigil', 'field', 'channel', 'volley']);
    for (const id of activeSkillVfxIds()) {
      const spec = activeSkillVfx(id) as SkillVfxSpec;
      expect(forms.has(spec.form), `${id} → ${spec.form}`).toBe(true);
      // Split rows never pulse per impact; only folded multihits carry beats.
      const row = sm.byId[id];
      const folded = !(row as any).action?.kind
        && ((row as any).effects ?? []).some((effect: any) => effect.stat === 'hits');
      if (!folded) expect(spec.pulses, id).toBe(1);
    }
  });

  it('resolves the same spec twice (stable budgets, no hidden state)', () => {
    for (const skill of liveAttacks()) {
      const first = activeSkillVfx(skill.id);
      const second = activeSkillVfx(skill.id);
      expect(second, skill.id).toEqual(first);
    }
  });

  it('returns null for non-attack, retired and mob rows', () => {
    for (const skill of sm.all().filter(skill => skill.type !== 'attack' || skill.retired))
      expect(activeSkillVfx(skill.id), skill.id).toBeNull();
    for (const skill of MS.skills) expect(activeSkillVfx(skill.id), skill.id).toBeNull();
    expect(activeSkillVfx('test.unknown-skill')).toBeNull();
    expect(activeSkillVfx(undefined)).toBeNull();
  });
});
