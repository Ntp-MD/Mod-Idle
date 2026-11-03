import { describe, expect, it } from 'vitest';
import { normalizeSkillAction } from '@engine/skills.ts';
import { skillAreaSnapshot } from '@engine/skill-area.ts';
import { createCombatArena, type CombatArenaAction } from '@sim/combat/combat-arena';
import { skillActionGeometry } from '../../src/ui/combat/skill-geometry';
import { activeSkillVfx } from '../../src/ui/combat/arena-skill-vfx';
import { skillMechanicPreview } from '../../src/ui/dev/skill-mechanic-preview';
import { describeSkill } from '@sim/combat/skill-copy';
import { installSyntheticSkill } from '../fixtures/skillFixture';

describe('synthetic mechanic previews', () => {
  it.each(['ray', 'field', 'orbs'])('authors a valid isolated %s capability', kind => {
    const row = skillMechanicPreview(kind)!;
    expect(row.id.startsWith('test.')).toBe(true);
    expect(normalizeSkillAction(row)).toBeDefined();
    expect(skillMechanicPreview('unknown')).toBeUndefined();
  });

  it('renders a stationary ray line only during ownership and describes its complete gross price', () => {
    const row = skillMechanicPreview('ray')!;
    const installed = installSyntheticSkill(row.id, row as any);
    try {
      const arena = createCombatArena();
      const action: CombatArenaAction = {
        id: 1, actorId: 'player', kind: 'cast', skillId: row.id, x: 1, y: 2, targetX: 5, targetY: 2,
        atUs: 0, endsAtUs: 5e6, channel: true,
        area: skillAreaSnapshot(row.area!, { x: 1, y: 2 }, { x: 5, y: 2 }, 'target'),
        timing: { delivery: 'projectile', startedAtUs: 0, releaseAtUs: 1e6, impactAtUs: 1.5e6, recoveryUntilUs: 4.2e6 },
      };
      expect(activeSkillVfx(row.id)?.form).toBe('line');
      expect(activeSkillVfx(row.id)?.projectile).toBe(false);
      const mark = skillActionGeometry(action, arena, 2e6, 1e6)!;
      expect(mark.phase).toBe('Channel');
      expect(mark.area.shape).toBe('line');
      expect(skillActionGeometry(action, arena, 4e6, 1e6)).toBeUndefined();
      expect(skillActionGeometry({ ...action, channel: false }, arena, 2e6, 1e6)).toBeUndefined();
      const copy = describeSkill(row);
      expect(copy.type).toBe('Channel');
      expect(copy.target).toBe('Enemies in Area');
      expect(copy.sp).toBe('10');
      expect(copy.sustain).toBe('10 Mana/s');
    } finally { installed.restore(); }
  });

  it('keeps a field visual anchored to deployment rather than restarting at its next pulse', () => {
    const row = skillMechanicPreview('field')!;
    const installed = installSyntheticSkill(row.id, row as any);
    try {
      const arena = createCombatArena();
      const action: CombatArenaAction = { id: 1, actorId: 'player', kind: 'cast', skillId: row.id,
        x: 1, y: 2, atUs: 0, endsAtUs: 5e6,
        area: skillAreaSnapshot(row.area!, { x: 1, y: 2 }, { x: 5, y: 2 }, 'target'),
        timing: { delivery: 'ground', startedAtUs: 0, releaseAtUs: 1e6, impactAtUs: 2e6, recoveryUntilUs: 1.2e6 } };
      expect(skillActionGeometry(action, arena, 2e6, 1e6, 2.25e6)?.phaseElapsedSec).toBe(1);
      expect(skillActionGeometry(action, arena, 5e6, 1e6, 6e6)).toBeUndefined();
    } finally { installed.restore(); }
  });
});
