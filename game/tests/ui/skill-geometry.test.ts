import { describe, expect, it } from 'vitest';
import { sm } from '../../src/engine/client';
import { skillAreaSnapshot } from '@engine/skill-area';
import { createCombatArena, type CombatArenaAction } from '@sim/combat/combat-arena';
import { skillActionGeometry, skillAimGeometry } from '../../src/ui/combat/skill-geometry';

function fixture(skillId: string) {
  const arena = createCombatArena();
  Object.assign(arena.player, { x: 1, y: 2 });
  const skill = sm.byId[skillId];
  const action: CombatArenaAction = {
    id: 1, kind: 'cast', actorId: 'player', skillId, targetId: 'target', x: 1, y: 2,
    targetX: 4, targetY: 2, atUs: 0, endsAtUs: 10_000_000,
    area: skillAreaSnapshot(skill.area ?? { origin: 'target', radius_m: 0 }, arena.player, { x: 4, y: 2 }, 'target'),
    timing: { delivery: 'projectile', startedAtUs: 0, releaseAtUs: 1_000_000,
      impactAtUs: 2_000_000, recoveryUntilUs: 2_500_000 },
  };
  return { arena, action };
}

describe('functional skill geometry', () => {
  it('reads every canonical cast without requiring an authored VFX definition', () => {
    for (const skill of sm.all()) {
      const { arena, action } = fixture(skill.id);
      const mark = skillActionGeometry(action, arena, 500_000, arena.unitsPerSec);
      expect(mark, skill.id).toBeDefined();
      expect(mark!.name, skill.id).toBe(skill.name);
      expect(mark!.phase, skill.id).toBe('Windup');
      expect(mark!.vertices.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)), skill.id).toBe(true);
    }
  });

  it('keeps a release-committed circle when the target/contact moves', () => {
    const { arena, action } = fixture('attack.split_shot');
    const committed = structuredClone(action.area!);
    action.targetX = 1.5;
    action.targetY = 2;
    const before = JSON.stringify(action);
    const mark = skillActionGeometry(action, arena, 1_500_000, arena.unitsPerSec)!;
    expect(mark.area).toEqual(committed);
    expect(mark.phase).toBe('Travel');
    expect(JSON.stringify(action)).toBe(before);
  });

  it('shows chain radius as hop reach, with a single-body impact footprint', () => {
    const { arena, action } = fixture('attack.chain_lightning');
    const mark = skillActionGeometry(action, arena, 500_000, arena.unitsPerSec)!;
    expect(mark.area.radiusM).toBe(0);
    expect(mark.area.shape).toBe('single');
    expect(mark.dimensions).toContain('Hop');
    const aim = skillAimGeometry({ skillId: action.skillId!, area: action.area!,
      source: arena.player, rangeM: 5, valid: true })!;
    expect(aim.area.radiusM).toBe(0);
  });

  it('retains width and direction for a zero-radius line', () => {
    const { arena, action } = fixture('attack.piercing_shot');
    const mark = skillActionGeometry(action, arena, 500_000, arena.unitsPerSec)!;
    expect(mark.area.radiusM).toBe(0);
    expect(mark.area.shape).toBe('line');
    expect(mark.vertices).toHaveLength(4);
    expect(mark.dimensions).toContain('Line');
    expect(mark.area.widthM).toBe(sm.byId[action.skillId!].area!.width_m);
    expect(mark.direction.to.x).toBeGreaterThan(mark.direction.from.x);
  });

  it('shows heals on the player even when the cast has an incidental enemy target', () => {
    const { arena, action } = fixture('heal.greater_heal');
    const mark = skillActionGeometry(action, arena, 500_000, arena.unitsPerSec)!;
    expect(mark.area.center).toEqual({ x: arena.player.x, y: arena.player.y });
    expect(mark.dimensions).toContain('Self');
    expect(mark.range).toBe('');
  });

  it('follows sampled caster feet only for a mobile channel and retains deployed fields', () => {
    const moving = fixture('attack.whirlwind');
    moving.action.channel = true;
    Object.assign(moving.arena.player, { x: 7, y: 8 });
    expect(skillActionGeometry(moving.action, moving.arena, 3_000_000, 1_000_000)!.area.center).toEqual({ x: 7, y: 8 });
    const field = fixture('attack.blizzard');
    const center = { ...field.action.area!.center };
    Object.assign(field.arena.player, { x: 7, y: 8 });
    const mark = skillActionGeometry(field.action, field.arena, 5_000_000, 1_000_000)!;
    expect(mark.area.center).toEqual(center);
    expect(mark.phase).toBe('Field');
  });

  it('keeps distinct payload paths and their terminal obstacle receipts', () => {
    const { arena, action } = fixture('attack.double_strafe');
    action.payloads = [0, 1, 2].map(index => ({ index, source: { x: 1, y: 2 }, destination: { x: 4, y: 2 },
      releaseAtUs: 1_000_000 + index * 100_000, plannedImpactAtUs: 2_000_000 + index * 100_000,
      ...(index === 0 ? { impactAtUs: 1_500_000, contact: { x: 2, y: 2 }, cancelReason: 'obstacle' } : {}) }));
    const mark = skillActionGeometry(action, arena, 1_600_000, 1_000_000)!;
    expect(mark.paths.map(path => path.index)).toEqual([0, 1, 2]);
    expect(mark.paths[0].blocked).toBe(true);
    expect(mark.paths[1].blocked).toBe(false);
    expect(mark.dimensions).toContain('Hit Ø');
    action.cancelledAtUs = 1_700_000;
    expect(skillActionGeometry(action, arena, 1_800_000, 1_000_000)).toBeUndefined();
  });
});
