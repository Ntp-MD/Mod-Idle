import { describe, expect, it } from 'vitest';
import { arenaAction, createCombatArena } from '@sim/combat/combat-arena';
import { equipWindowOpen } from '../../src/ui/combat/equip-policy';

describe('F22 — gear changes only between committed actions', () => {
  it('closes the window through windup, release and recovery', () => {
    const arena = createCombatArena();
    arenaAction(arena, 'player', 'swing', 0, 'mob', undefined, undefined, {
      delivery: 'melee', startedAtUs: 0, releaseAtUs: 200_000, impactAtUs: 200_000, recoveryUntilUs: 500_000,
    });
    arena.nowUs = 100_000;
    expect(equipWindowOpen(arena)).toBe(false);
    arena.nowUs = 400_000;
    expect(equipWindowOpen(arena)).toBe(false);
    arena.nowUs = 500_000;
    expect(equipWindowOpen(arena)).toBe(true);
  });

  it('treats a pending windup or recovery intent as busy even without an action field', () => {
    const arena = createCombatArena();
    arena.intent = { skillId: 'attack.fireball', targetId: 'mob', targetPoint: { x: 1, y: 1 }, phase: 'windup' };
    expect(equipWindowOpen(arena)).toBe(false);
    arena.intent.phase = 'recovery';
    expect(equipWindowOpen(arena)).toBe(false);
    arena.intent = undefined;
    expect(equipWindowOpen(arena)).toBe(true);
    expect(equipWindowOpen(undefined)).toBe(true);
  });
});
