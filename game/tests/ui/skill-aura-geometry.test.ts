import { describe, expect, it } from 'vitest';
import { createCombatArena } from '@sim/combat/combat-arena';
import { newSkillState } from '@sim/combat/skills';
import { sm } from '../../src/engine/client';
import { createFieldViewFrame } from '../../src/presentation/arena-view-frame';
import { fieldPointM } from '../../src/presentation/view-transform';
import { projectSkillGeometry } from '../../src/ui/combat/skill-geometry';
import { activeAuraGeometry } from '../../src/ui/combat/skill-aura-geometry';

const frameFor = (x: number, y: number) => createFieldViewFrame({
  sceneKey: 'test', atUs: 0,
  viewportCss: { width: 1920, height: 1080 },
  focusM: fieldPointM(x, y), worldScale: 1,
});

describe('active reservation VFX', () => {
  it('shows only owned, enabled aura rows and removes them immediately on toggle off', () => {
    const skills = newSkillState();
    skills.owned['aura.clarity'] = 0;
    skills.owned['attack.fireball'] = 0;
    skills.auras = { 'aura.clarity': true, 'aura.haste': true,
      'attack.fireball': true, 'missing.aura': true };
    const frame = createCombatArena();
    frame.player.hp = 100;
    const before = JSON.stringify({ skills, frame });
    expect(activeAuraGeometry(skills, frame, 5_000_000, 1_000_000).map(mark => mark.skillId))
      .toEqual(['aura.clarity']);
    expect(JSON.stringify({ skills, frame })).toBe(before);
    skills.auras['aura.clarity'] = false;
    expect(activeAuraGeometry(skills, frame, 6_000_000, 1_000_000)).toEqual([]);
  });

  it('loops every canonical aura at sampled player feet with stable keys and body size', () => {
    const skills = newSkillState();
    const ids = sm.all().filter(row => row.type === 'aura' && !row.retired).map(row => row.id);
    for (const id of ids) { skills.owned[id] = 0; skills.auras[id] = true; }
    const frame = createCombatArena();
    Object.assign(frame.player, { x: 2, y: 3, hp: 100 });
    const bodyM = { width: 72 / 140, height: 160 / 140 };
    const marks = activeAuraGeometry(skills, frame, 5_000_000, 1_000_000, bodyM);
    expect(marks).toHaveLength(ids.length);
    for (const mark of marks) {
      expect(mark.phase).toBe('Field');
      expect(mark.phaseElapsedSec).toBe(5);
      expect(mark.area.radiusM).toBe(0);
      expect(mark.center).toEqual({ x: frame.player.x, y: frame.player.y });
      expect(mark.bodyM).toEqual(bodyM);
      // The painted anchor follows the world point through the frame.
      const screen = projectSkillGeometry(mark, frameFor(frame.player.x, frame.player.y))!;
      expect(screen.center).toEqual(screen.vfxAim.groundImpact);
    }
    Object.assign(frame.player, { x: 3, y: 4 });
    const later = activeAuraGeometry(skills, frame, 8_000_000, 1_000_000);
    expect(later.map(mark => mark.key)).toEqual(marks.map(mark => mark.key));
    expect(later[0].center).toEqual({ x: frame.player.x, y: frame.player.y });
    expect(later[0].phaseElapsedSec).toBe(8);
    frame.player.hp = 0;
    expect(activeAuraGeometry(skills, frame, 8_000_000, 1_000_000)).toEqual([]);
  });
});
