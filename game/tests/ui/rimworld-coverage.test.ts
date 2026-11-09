import { describe, expect, it } from 'vitest';
import { activeSkillVfx, activeSkillVfxIds } from '../../src/ui/combat/arena-skill-vfx';
import { RIMWORLD_FORMS } from '../../src/ui/combat/rimworld-vfx';
import { activeVfxVersionId, setActiveVfxVersion, vfxVersionsFor } from '../../src/ui/fx/catalog';
import { resolveVfxPresentation } from '../../src/ui/combat/arena-skill-art';

describe('rimworld coverage', () => {
  it('offers the renderer-only version for every live skill', () => {
    const ids = activeSkillVfxIds();
    expect(ids.length).toBeGreaterThanOrEqual(90);
    for (const id of ids) {
      const variant = vfxVersionsFor(id).find((version) => version.id === 'pool-rimworld');
      expect(variant, id).toBeTruthy();
      expect(variant!.renderer, id).toBe('procedural');
      expect(variant!.layers, id).toEqual([]);
      expect(variant!.default, id).toBe(false);
    }
  });

  it('handles every live form with a renderer branch', () => {
    const forms = new Set(activeSkillVfxIds().map((id) => activeSkillVfx(id)!.form));
    for (const form of forms) expect(RIMWORLD_FORMS).toContain(form);
    expect(forms.size).toBe(RIMWORLD_FORMS.length);
  });

  it('routes a sample of attack and support skills to the procedural renderer', () => {
    const sample = ['attack.fireball', 'attack.meteor', 'attack.whirlwind', 'aura.grace', 'heal.heal', 'curse.curse_of_weakness'];
    const previous = new Map(sample.map((id) => [id, activeVfxVersionId(id)]));
    try {
      for (const id of sample) {
        if (!vfxVersionsFor(id).some((version) => version.id === 'pool-rimworld')) continue;
        expect(setActiveVfxVersion(id, 'pool-rimworld')).toBe(true);
        expect(resolveVfxPresentation(id, 'auto')).toEqual({ kind: 'procedural', versionId: 'pool-rimworld' });
      }
    } finally {
      for (const [id, version] of previous) if (version) setActiveVfxVersion(id, version);
    }
  });
});
