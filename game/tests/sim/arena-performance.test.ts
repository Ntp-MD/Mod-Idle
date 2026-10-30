import { describe, expect, it } from 'vitest';
import {
  AIM_DIAGNOSTICS, aimForSkill, captureCombatArena, createCombatArena, syncCombatArena,
} from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel } from '@sim/core/game';
import { mobFixture } from '../fixtures/mobFixture';

/** A crowded, deterministic field for the coverage memo and the capture alloc checks. */
function crowd(count: number, spread = 0.35) {
  const arena = createCombatArena();
  Object.assign(arena.player, { x: 2, y: 6, facing: 0 });
  const group = Array.from({ length: count }, (_, index) => mobFixture({
    id: `perf-${index}`, hp: 1e9, hpMax: 1e9, innate: [], skillIds: [],
  }));
  group.forEach((mob, index) => {
    arena.mobs[mob.id] = {
      id: mob.id, x: 4 + (index % 6) * spread, y: 6 + Math.floor(index / 6) * spread,
      facing: 0, moving: false, radiusM: 0.3, hp: mob.hp, hpMax: mob.hpMax,
    } as never;
  });
  return { arena, group };
}

function resetAimDiagnostics(): void {
  AIM_DIAGNOSTICS.hits = 0;
  AIM_DIAGNOSTICS.misses = 0;
  AIM_DIAGNOSTICS.coverageChecks = 0;
}

describe('P9 performance — coverage memo and capture allocation', () => {
  it('skips the quadratic coverage scan on a repeated aim and invalidates on a pose change', () => {
    const { arena, group } = crowd(24);
    resetAimDiagnostics();
    const first = aimForSkill(arena, group, 'attack.firestorm')!;
    expect(first).toBeDefined();
    expect(AIM_DIAGNOSTICS.misses).toBe(1);
    expect(AIM_DIAGNOSTICS.coverageChecks).toBe(group.length * group.length);

    const second = aimForSkill(arena, group, 'attack.firestorm')!;
    expect(AIM_DIAGNOSTICS.hits).toBe(1);
    expect(AIM_DIAGNOSTICS.coverageChecks).toBe(group.length * group.length);
    expect(second.mob.id).toBe(first.mob.id);
    expect(second.point).toEqual(first.point);

    // A moved body is a different sample: the memo must miss, and the result must equal a cold read.
    arena.mobs[group[0].id].x = 100;
    const cold = crowd(24);
    Object.assign(cold.arena.player, { x: arena.player.x, y: arena.player.y });
    cold.arena.mobs[group[0].id].x = 100;
    const missesBefore = AIM_DIAGNOSTICS.misses;
    const expected = aimForSkill(cold.arena, cold.group, 'attack.firestorm')!;
    expect(AIM_DIAGNOSTICS.misses).toBe(missesBefore + 1);
    const actual = aimForSkill(arena, group, 'attack.firestorm')!;
    expect(AIM_DIAGNOSTICS.misses).toBe(missesBefore + 2);
    expect(actual.mob.id).toBe(expected.mob.id);
    expect(actual.point).toEqual(expected.point);
  });

  it('invalidates a caster cone memo when the player turns', () => {
    const { arena, group } = crowd(16);
    resetAimDiagnostics();
    aimForSkill(arena, group, 'attack.cleave');
    aimForSkill(arena, group, 'attack.cleave');
    expect(AIM_DIAGNOSTICS.hits).toBe(1);
    const checks = AIM_DIAGNOSTICS.coverageChecks;

    arena.player.facing += Math.PI / 2;
    aimForSkill(arena, group, 'attack.cleave');
    expect(AIM_DIAGNOSTICS.misses).toBe(2);
    expect(AIM_DIAGNOSTICS.coverageChecks).toBeGreaterThan(checks);
  });

  it('reuses body/action/frame lists when a capture expires nothing, and trims only the expired', () => {
    const state = newGame(902);
    setLevel(state, 30);
    state.hunting = true;
    state.group = Array.from({ length: 32 }, (_, index) => mobFixture({
      id: `capture-${index}`, hp: 1000, hpMax: 1000, innate: [], skillIds: [],
    }));
    const arena = createCombatArena();
    syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
    captureCombatArena(arena, state, 0);
    const frames = arena.frames;
    const actions = arena.actions;
    const bodies = arena.bodies;

    // Same sample, nothing expired: none of the three lists is reallocated.
    captureCombatArena(arena, state, 0);
    expect(arena.frames).toBe(frames);
    expect(arena.actions).toBe(actions);
    expect(arena.bodies).toBe(bodies);

    arena.actions.push({
      id: 999, actorId: 'player', kind: 'swing', atUs: 0, endsAtUs: 0, x: 0, y: 0,
    });
    captureCombatArena(arena, state, 5_000_000);
    // The expired action is gone; the sample that produced it was trimmed, not silently kept.
    expect(arena.actions).not.toBe(actions);
    expect(arena.actions.some((action) => action.id === 999)).toBe(false);
    expect(arena.frames.some((frame) => frame.atUs === 0)).toBe(false);
    expect(arena.frames.at(-1)?.atUs).toBe(5_000_000);
  });
});
