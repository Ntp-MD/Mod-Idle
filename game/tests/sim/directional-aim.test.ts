import { describe, expect, it } from 'vitest';
import { aimForSkill, arenaSkillTargets, createCombatArena } from '@sim/combat/combat-arena';
import { mobFixture } from '../fixtures/mobFixture';

/** Nearest body east; a tighter cluster north. */
function crowd(pinNearest = false) {
  const arena = createCombatArena();
  Object.assign(arena.player, { x: 0, y: 0 });
  const spots = [
    ['m1', 1, 0],
    ['m2', 0, 2],
    ['m3', 0.1, 2],
    ['m4', -0.1, 2],
  ] as const;
  const group = spots.map(([id, x, y]) => {
    const mob = mobFixture({ id, hp: 1000, hpMax: 1000 });
    arena.mobs[id] = { id, x, y, facing: 0, moving: false, radiusM: 0.3, hp: 1000, hpMax: 1000 } as never;
    return mob;
  });
  if (pinNearest) arena.focusId = 'm1';
  return { arena, group };
}

describe('P2 directional aim — score the direction, not just the nearest body', () => {
  it('aims a cone at the direction that reaches the most bodies', () => {
    const { arena, group } = crowd();
    const aim = aimForSkill(arena, group, 'attack.cleave');
    expect(aim).toBeDefined();
    expect(aim!.point.y).toBeGreaterThan(1.5);
    expect(arenaSkillTargets(arena, 'attack.cleave', group).targets).toHaveLength(3);
  });

  it('aims a line the same way', () => {
    const { arena, group } = crowd();
    const aim = aimForSkill(arena, group, 'attack.impale');
    expect(aim).toBeDefined();
    expect(aim!.point.y).toBeGreaterThan(1.5);
    expect(arenaSkillTargets(arena, 'attack.impale', group).targets).toHaveLength(3);
  });

  it('still honours a pinned focus even when another direction covers more', () => {
    const { arena, group } = crowd(true);
    const aim = aimForSkill(arena, group, 'attack.cleave');
    expect(aim).toBeDefined();
    expect(aim!.mob.id).toBe('m1');
    expect(aim!.point.x).toBeCloseTo(1, 5);
  });

  it('falls back to the nearest body when the score ties', () => {
    const arena = createCombatArena();
    Object.assign(arena.player, { x: 0, y: 0 });
    const group = [
      ['e1', 2, 0],
      ['e2', 0, 2],
    ].map(([id, x, y]) => {
      const mob = mobFixture({ id: id as string, hp: 1000, hpMax: 1000 });
      arena.mobs[id as string] = { id, x, y, facing: 0, moving: false, radiusM: 0.3, hp: 1000, hpMax: 1000 } as never;
      return mob;
    });
    const aim = aimForSkill(arena, group, 'attack.cleave');
    expect(aim?.mob.id).toBe('e1');
  });
});
