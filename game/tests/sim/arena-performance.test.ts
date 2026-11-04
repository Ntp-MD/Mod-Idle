import { describe, expect, it } from 'vitest';
import {
  AIM_DIAGNOSTICS, advanceCombatArena, aimForSkill, captureCombatArena, createCombatArena, syncCombatArena,
} from '@sim/combat/combat-arena';
import { E, sm } from '../../src/engine/client';
import { characterSheet, newGame, setLevel } from '@sim/core/game';
import { selectCombatIntent } from '@sim/combat/combat-actions';
import { mobFixture } from '../fixtures/mobFixture';
import { installSyntheticSkill } from '../fixtures/skillFixture';

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

  it('keeps exact simple collision corrections and rejects separated pairs before the hypot path', () => {
    const clearance = Number((E as any).combat_arena.normal_attack.contact_clearance_m);
    const radius = 0.25;
    const need = radius * 2 + clearance;
    const collision = (positions: { x: number; y: number }[], player = { x: 20, y: 20, radiusM: 0.3 }) => {
      const state = newGame(902);
      const arena = createCombatArena();
      arena.player.x = player.x;
      arena.player.y = player.y;
      arena.player.radiusM = player.radiusM;
      state.player.hp = 100;
      state.group = positions.map((_, index) => mobFixture({
        id: `collision-${index}`, hp: 1000, hpMax: 1000, innate: [], skillIds: [],
      }));
      state.group.forEach((mob, index) => {
        const point = positions[index];
        arena.mobs[mob.id] = {
          id: mob.id, x: point.x, y: point.y, facing: 0, moving: false,
          radiusM: radius, hp: mob.hp, hpMax: mob.hpMax,
        } as never;
      });
      arena.nowUs = 0;
      advanceCombatArena(arena, state, 1, {
        playerRange: 0, playerSpeedMult: 0, mobSpeedMult: () => 0,
        playerLocked: true, holdPosition: true, engagedIds: new Set(),
      });
      return { arena, state };
    };

    const separated = collision([{ x: 2, y: 2 }, { x: 10, y: 10 }]);
    expect(separated.arena.mobs['collision-0']).toMatchObject({ x: 2, y: 2 });
    expect(separated.arena.mobs['collision-1']).toMatchObject({ x: 10, y: 10 });

    const touchingX = collision([{ x: 5, y: 5 }, { x: 5 + need, y: 5 }]);
    expect(touchingX.arena.mobs['collision-0']).toMatchObject({ x: 5, y: 5 });
    expect(touchingX.arena.mobs['collision-1']).toMatchObject({ x: 5 + need, y: 5 });

    const touchingY = collision([{ x: 5, y: 5 }, { x: 5, y: 5 + need }]);
    expect(touchingY.arena.mobs['collision-0']).toMatchObject({ x: 5, y: 5 });
    expect(touchingY.arena.mobs['collision-1']).toMatchObject({ x: 5, y: 5 + need });

    const overlapping = collision([{ x: 5.4, y: 5 }, { x: 5, y: 5 }]);
    expect(overlapping.arena.mobs['collision-0'].x).toBeCloseTo(5.46, 9);
    expect(overlapping.arena.mobs['collision-1'].x).toBeCloseTo(4.94, 9);

    const coincident = collision([{ x: 5, y: 5 }, { x: 5, y: 5 }]);
    expect(coincident.arena.mobs['collision-0'].x).toBeCloseTo(5 - need / 2, 9);
    expect(coincident.arena.mobs['collision-1'].x).toBeCloseTo(5 + need / 2, 9);

    const playerOverlap = collision([{ x: 20.3, y: 20 }], { x: 20, y: 20, radiusM: 0.3 });
    expect(playerOverlap.arena.player).toMatchObject({ x: 20, y: 20 });
    expect(playerOverlap.arena.mobs['collision-0'].x).toBeCloseTo(20 + radius + 0.3 + clearance, 9);

    let hypotCalls = 0;
    const originalHypot = Math.hypot;
    Math.hypot = (...args: number[]) => { hypotCalls++; return originalHypot(...args); };
    try {
      const wide = Array.from({ length: 32 }, (_, index) => ({
        x: 10 + (index % 8) * 20, y: 10 + Math.floor(index / 8) * 20,
      }));
      collision(wide);
    } finally {
      Math.hypot = originalHypot;
    }
    // 496 is the complete mob-pair count for 32 bodies; distant pairs never reach the narrow phase.
    expect(hypotCalls).toBeLessThan(496);
  });

  it('rejects impossible automatic candidates before aim work and recovers when they become eligible', () => {
    const id = 'test.aim-early';
    const installed = installSyntheticSkill(id, {
      name: 'Aim Early', type: 'attack', group: 'all', element: 'physical',
      cd: 1, mana: '0 flat', basis: 'phys', offline_targets: '1',
      area: { origin: 'target', radius_m: 2 },
      cast: { delivery: 'melee', range_m: 5, windup_sec: 0.1, recovery_sec: 0.1 },
      effects: [], base_flat: 10, eff: 0,
    });
    try {
      const { arena, group } = crowd(4);
      const state = newGame(903);
      setLevel(state, 30);
      state.hunting = true;
      state.group = group;
      state.player.hp = 100;
      state.player.mana = characterSheet(state).maxMana;
      state.skills.owned[id] = 0;
      state.skills.list.fill(null);
      state.skills.list[0] = id;
      const character = characterSheet(state);

      const expectNoAim = (label: string) => {
        resetAimDiagnostics();
        expect(selectCombatIntent(arena, state, character, true), label).toBeUndefined();
        expect(AIM_DIAGNOSTICS.misses, label).toBe(0);
        expect(AIM_DIAGNOSTICS.coverageChecks, label).toBe(0);
      };
      const expectAim = (label: string) => {
        resetAimDiagnostics();
        expect(selectCombatIntent(arena, state, character, true)?.skillId, label).toBe(id);
      };

      state.skills.cd[id] = 2;
      expectNoAim('cooldown');
      delete state.skills.cd[id];
      expectAim('ready');

      state.skills.mode[id] = 'never';
      expectNoAim('never');
      state.skills.mode[id] = 'always';
      expectAim('always');

      state.skills.autoMode![id] = 'manual';
      expectNoAim('manual');
      state.skills.autoMode![id] = 'auto';
      expectAim('auto');

      const original = sm.byId[id];
      sm.byId[id] = { ...original, weapon: 'bow' };
      try {
        expectNoAim('wrong weapon');
        const bowCharacter = { ...character, weaponName: 'bow' };
        resetAimDiagnostics();
        expect(selectCombatIntent(arena, state, bowCharacter, true)?.skillId).toBe(id);
      } finally {
        sm.byId[id] = original;
      }
    } finally {
      installed.restore();
    }
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
