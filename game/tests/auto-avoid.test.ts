import { describe, expect, it } from 'vitest';
import { newGame, tick } from '../src/sim/core/game';
import { createCombatArena } from '../src/sim/combat/combat-arena';
import { planAutoAvoid } from '../src/sim/combat/auto-avoid';
import { mobFixture } from './mobFixture';

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

  it('respects the reaction cooldown and picks the earliest of several threats', () => {
    const first = setup(heavy({ actionId: 7, impactAtUs: 2_000_000 }));
    const second = setup(heavy({ actionId: 8, impactAtUs: 1_000_000 }));
    first.arena.mobFlights.push(second.arena.mobFlights[0]);
    expect(planAutoAvoid(first.arena, first.state, 0, 1_000_000)?.actionId).toBe(8);
    first.state.avoidCooldownUntilSec = 5;
    expect(planAutoAvoid(first.arena, first.state, 0, 1_000_000)).toBeNull();
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
});
