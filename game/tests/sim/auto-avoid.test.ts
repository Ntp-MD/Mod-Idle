import { describe, expect, it } from 'vitest';
import { characterSheet, newGame, stepCombat, tick } from '@sim/core/game';
import { arenaAction, arenaWeaponStopRange, createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { planAutoAvoid } from '@sim/combat/auto-avoid';
import { mobFixture, pinFieldPopulation } from '../fixtures/mobFixture';

const heavy = (over: Record<string, unknown> = {}) => ({
  actionId: 1, mobId: 'm1', mob: mobFixture(), source: { x: 0, y: 0 },
  destination: { x: 10, y: 10 }, position: { x: 0, y: 0 },
  releaseAtUs: 0, impactAtUs: 2_000_000, speedMps: 5, radiusM: 0.25,
  skillId: 'mob.earth.boulder-toss', kind: 'ground' as const, impactRadiusM: 1.5,
  ...over,
});

const setup = (threat = heavy()) => {
  const state = newGame();
  const arena = createCombatArena();
  Object.assign(arena.player, { x: 10, y: 10 });
  arena.mobFlights.push(threat as never);
  return { state, arena };
};

describe('bounded auto-avoid', () => {
  it('leaves a tagged heavy ground landing circle when time allows', () => {
    const { state, arena } = setup();
    const plan = planAutoAvoid(arena, state, 0, 1_000_000);
    expect(plan).not.toBeNull();
    expect(Math.hypot(plan!.x - 10, plan!.y - 10)).toBeGreaterThan(1.5);
    expect(plan!.x).toBeGreaterThanOrEqual(0.25);
    expect(plan!.x).toBeLessThanOrEqual(49.75);
  });

  it('ignores a rim graze the damage would also miss (centre semantics, F19)', () => {
    // Centre 1.6 m out: the footprint edge is inside the 1.5 m circle but the centre is not,
    // and `resolveMobShot` reads the centre — so no escape is owed.
    const { state, arena } = setup();
    Object.assign(arena.player, { x: 11.6, y: 10 });
    expect(planAutoAvoid(arena, state, 0, 1_000_000)).toBeNull();
  });

  it('holds a fixed safe position until the flight lands, even beyond the old hold band', () => {
    const { state, arena } = setup();
    const first = planAutoAvoid(arena, state, 0, 1_000_000)!;
    expect(first).not.toBeNull();
    expect(arena.player.avoidActionId).toBe(first.actionId);
    // Just outside the rim: a graze would plan nothing, but the held escape still answers.
    Object.assign(arena.player, { x: 11.8, y: 10 });
    const held = planAutoAvoid(arena, state, 500_000, 1_000_000);
    expect(held).toEqual({ x: 11.8, y: 10, actionId: first.actionId });
    Object.assign(arena.player, { x: 13, y: 10 });
    expect(planAutoAvoid(arena, state, 600_000, 1_000_000)).toEqual({ x: 13, y: 10, actionId: first.actionId });
    expect(planAutoAvoid(arena, state, 2_000_000, 1_000_000)).toEqual({ x: 13, y: 10, actionId: first.actionId });
    // A landed flight releases the hold even inside the circle.
    Object.assign(arena.player, { x: 10, y: 10 });
    planAutoAvoid(arena, state, 700_000, 1_000_000);
    expect(arena.player.avoidActionId).toBe(first.actionId);
    arena.mobFlights.length = 0;
    expect(planAutoAvoid(arena, state, 800_000, 1_000_000)).toBeNull();
    expect(arena.player.avoidActionId).toBeUndefined();
  });

  it('dodges a centre that is still inside, even at the rim', () => {
    const { state, arena } = setup();
    Object.assign(arena.player, { x: 11.4, y: 10 });
    const plan = planAutoAvoid(arena, state, 0, 1_000_000);
    expect(plan).not.toBeNull();
    expect(Math.hypot(plan!.x - 10, plan!.y - 10)).toBeGreaterThan(1.5);
  });

  it('ignores a non-heavy or uncommitted threat', () => {
    const nonHeavy = setup(heavy({ skillId: 'mob.physical.backstab' }));
    expect(planAutoAvoid(nonHeavy.arena, nonHeavy.state, 0, 1_000_000)).toBeNull();
    const landed = setup(heavy({ impactAtUs: 0 }));
    expect(planAutoAvoid(landed.arena, landed.state, 0, 1_000_000)).toBeNull();
  });

  it('does not promise a perfect dodge when the reaction budget is short', () => {
    const { state, arena } = setup(heavy({ impactAtUs: 300_000 }));
    expect(planAutoAvoid(arena, state, 0, 1_000_000)).toBeNull();
  });

  it('picks the earliest of several threats', () => {
    const first = setup(heavy({ actionId: 7, impactAtUs: 2_000_000 }));
    const second = setup(heavy({ actionId: 8, impactAtUs: 1_000_000 }));
    first.arena.mobFlights.push(second.arena.mobFlights[0]);
    expect(planAutoAvoid(first.arena, first.state, 0, 1_000_000)?.actionId).toBe(8);
  });

  it('answers the earliest actual danger before an already-safe held landing', () => {
    const { state, arena } = setup(heavy({ actionId: 7, impactAtUs: 500_000 }));
    Object.assign(arena.player, { x: 11.8, y: 10, avoidActionId: 7 });
    arena.mobFlights.push(heavy({ actionId: 8, impactAtUs: 2_000_000,
      destination: { x: 11.8, y: 10 } }) as never);
    arena.mobFlights.push(heavy({ actionId: 9, impactAtUs: 1_000_000,
      destination: { x: 11.8, y: 10 } }) as never);
    const plan = planAutoAvoid(arena, state, 0, 1_000_000);
    expect(plan?.actionId).toBe(9);
    expect(plan!.x).toBeGreaterThan(arena.player.x);
    expect(Math.hypot(plan!.x - 11.8, plan!.y - 10)).toBeGreaterThan(1.5);
  });

  it('keeps escaping while the body is still inside, even right after a dodge', () => {
    const { state, arena } = setup(heavy({ actionId: 7, impactAtUs: 2_000_000 }));
    state.avoidCooldownUntilSec = 5;
    expect(planAutoAvoid(arena, state, 0, 1_000_000)).not.toBeNull();
  });

  it('does not plan once the body is outside the landing circle', () => {
    const { state, arena } = setup(heavy({ actionId: 7, impactAtUs: 2_000_000 }));
    Object.assign(arena.player, { x: 20, y: 20 });
    expect(planAutoAvoid(arena, state, 0, 1_000_000)).toBeNull();
  });

  it('stays inside the arena and rejects a clamped point that cannot clear the circle', () => {
    const { state, arena } = setup(heavy({ destination: { x: 0.25, y: 0.25 } }));
    Object.assign(arena.player, { x: 0.25, y: 0.25 });
    const plan = planAutoAvoid(arena, state, 0, 1_000_000);
    expect(plan?.x).toBeGreaterThanOrEqual(0.25);
    expect(plan?.y).toBeGreaterThanOrEqual(0.25);

    const corner = setup(heavy({ destination: { x: 49.75, y: 16 }, impactRadiusM: 10 }));
    Object.assign(corner.arena.player, { x: 49.75, y: 16 });
    expect(planAutoAvoid(corner.arena, corner.state, 0, 1_000_000)).toBeNull();
  });

  it('moves the live player out of a committed heavy landing', () => {
    const { state, arena } = setup(heavy({ impactAtUs: 2_000_000 }));
    tick(state, { arena, autoSkills: false });
    expect(Math.hypot(arena.player.x - 10, arena.player.y - 10)).toBeGreaterThan(1.5);
  });

  it('escapes once, holds without drifting or re-entering, then resumes chasing after impact', () => {
    const { state, arena } = setup();
    state.hunting = true;
    state.group = [mobFixture({ ps: 0, acc: 0, innate: [], skillIds: [] })];
    syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
    Object.assign(arena.player, { x: 11.4, y: 10 });
    Object.assign(arena.mobs.m1, { x: 10, y: 10 });
    pinFieldPopulation(state, 1, new Map([['m1', { x: 10, y: 10 }]]));
    let safe: { x: number; y: number } | undefined;
    for (let sample = 0; sample < 39; sample++) {
      stepCombat(state, { arena, autoSkills: false });
      const distance = Math.hypot(arena.player.x - 10, arena.player.y - 10);
      if (safe) {
        expect(arena.player.x).toBeCloseTo(safe.x, 8);
        expect(arena.player.y).toBeCloseTo(safe.y, 8);
      } else if (distance > 1.5) safe = { x: arena.player.x, y: arena.player.y };
    }
    expect(safe).toBeDefined();
    expect(arena.player.avoidActionId).toBe(1);
    // Pin the next target away from the safe point, so the released hold has visible pursuit.
    Object.assign(arena.mobs.m1, { x: 8, y: 10 });
    for (let sample = 0; sample < 4; sample++) stepCombat(state, { arena, autoSkills: false });
    expect(arena.player.avoidActionId).toBeUndefined();
    expect(arena.player.x).toBeLessThan(safe!.x);
  });

  it.each([false, true])('allows in-range attacks during a stationary safe hold (auto skills %s)', (autoSkills) => {
    const { state, arena } = setup();
    state.hunting = true;
    state.group = [mobFixture({ ps: 0, acc: 0, innate: [], skillIds: [] })];
    const c = characterSheet(state);
    syncCombatArena(arena, state, 0, 1_000_000, c.maxHp);
    Object.assign(arena.player, { x: 11.8, y: 10, avoidActionId: 1 });
    const target = { x: 11.8 + arenaWeaponStopRange(c.weaponName), y: 10 };
    Object.assign(arena.mobs.m1, target);
    pinFieldPopulation(state, 1, new Map([['m1', target]]));
    state.player.atkTimer = 0.95;
    state.skills.owned['attack.fireball'] = 0;
    state.skills.list[0] = 'attack.fireball';
    const hp = state.group[0].hp;
    tick(state, { arena, autoSkills });
    expect(arena.player.x).toBeCloseTo(11.8, 8);
    expect(state.group[0].hp).toBeLessThan(hp);
    expect(arena.actions.some((action) => action.actorId === 'player' && action.cancelReason === 'auto-avoid')).toBe(false);
    if (autoSkills) expect(arena.actions.some((action) => action.skillId === 'attack.fireball' && action.impactCount)).toBe(true);
  });

  it('still cancels an unreleased basic when escaping requires movement', () => {
    const { state, arena } = setup();
    state.hunting = true;
    state.group = [mobFixture({ ps: 0, acc: 0, innate: [], skillIds: [] })];
    syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
    Object.assign(arena.player, { x: 11.4, y: 10 });
    Object.assign(arena.mobs.m1, { x: 12, y: 10 });
    pinFieldPopulation(state, 1, new Map([['m1', { x: 12, y: 10 }]]));
    const action = arenaAction(arena, 'player', 'swing', 0, 'm1', undefined, undefined, {
      delivery: 'melee', startedAtUs: 0, releaseAtUs: 500_000,
      impactAtUs: 500_000, recoveryUntilUs: 700_000,
    })!;
    stepCombat(state, { arena, autoSkills: false });
    expect(arena.actions.find((entry) => entry.id === action.id)?.cancelReason).toBe('auto-avoid');
    expect(arena.player.x).toBeGreaterThan(11.4);
  });
});
