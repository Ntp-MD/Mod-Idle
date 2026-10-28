import { describe, expect, it } from 'vitest';
import type { NavLayout } from '@engine/navigation.ts';
import { loot } from '../../src/engine/client';
import { mulberry32 } from '../../src/engine/client-helpers';
import { createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import { pinFieldPopulation } from '../fixtures/mobFixture';

/** Ranged basics fly; a wall the arrow cannot cross must stop them. */
function encounter(weaponName: string, distance = 4, nav?: NavLayout) {
  const state = newGame(91);
  setLevel(state, 30);
  state.hunting = true;
  state.player.hp = 1e9;
  const mainHand = loot.SLOTS.findIndex((slot: string) => slot === 'main hand');
  state.gear[mainHand] = { slot: 'main hand', base: weaponName, ilvl: 1, quality: 'Normal', tier: 'T1', lines: [] } as never;
  state.skills.list.fill(null);
  const mob = spawnMob(mulberry32(23), 1, 'normal');
  Object.assign(mob, {
    id: 'proof-target', hp: 1e9, hpMax: 1e9, ps: 0, accuracy: 0, evasion: 0, dodgeRate: 0,
    armour: 0, line: 'stand-off', damage: 'physical', innate: [], skillIds: [],
  });
  state.group = [mob];
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 1, y: 6 });
  Object.assign(arena.mobs[mob.id], { x: 1 + distance, y: 6 });
  if (nav) arena.nav = nav;
  pinFieldPopulation(state);
  return { state, mob, arena };
}

const projectileWall = (x0: number, x1: number): NavLayout => ({
  version: 1, bounds: { x: 0, y: 0, width: 50, height: 32 }, cellSize: 1,
  obstacles: [{ kind: 'box', id: 'wall', x: x0, y: 0, width: x1 - x0, height: 32,
    flags: { movement: false, sight: false, projectiles: true } }],
});

function firstSwing(arena: { actions: { actorId: string; kind: string }[] }) {
  return arena.actions.find((action) => action.actorId === 'player' && action.kind === 'swing')!;
}

describe('F15 delivery — basics fly or land according to their profile', () => {
  it('lands a melee basic at its release beat', () => {
    const { state, mob, arena } = encounter('one-handed sword', 14);
    for (let index = 0; index < 8; index++) tick(state, { arena, autoSkills: false });
    const swing = firstSwing(arena) as unknown as { timing: { delivery: string; releaseAtUs: number; impactAtUs: number } };
    expect(swing.timing.delivery).toBe('melee');
    expect(swing.timing.impactAtUs).toBe(swing.timing.releaseAtUs);
    expect(mob.hp).toBeLessThan(1e9);
  });

  it('flies a bow basic and lands it one travel leg later', () => {
    const { state, mob, arena } = encounter('bow', 4);
    for (let index = 0; index < 8; index++) tick(state, { arena, autoSkills: false });
    const swing = firstSwing(arena) as unknown as {
      timing: { delivery: string; releaseAtUs: number; impactAtUs: number };
      x: number; y: number; targetX: number; targetY: number; impactCount: number;
    };
    expect(swing.timing.delivery).toBe('projectile');
    expect(swing.timing.impactAtUs).toBeGreaterThan(swing.timing.releaseAtUs);
    const leg = Math.hypot(swing.targetX - swing.x, swing.targetY - swing.y);
    const centerArrival = swing.timing.releaseAtUs + Math.ceil(leg / 12 * 1_000_000);
    // Edge contact ends the flight before the planned center arrival, never after it —
    // the receipt carries the crossing beat (F20: time-of-impact, not the sample grid).
    expect(swing.timing.impactAtUs).toBeLessThan(centerArrival);
    expect(swing.impactCount).toBe(1);
    expect(mob.hp).toBeLessThan(1e9);
    expect(arena.playerShots).toHaveLength(0);
  });

  it('stops a bow basic on an authored projectile barrier', () => {
    const { state, mob, arena } = encounter('bow', 4, projectileWall(2, 3.5));
    for (let index = 0; index < 8; index++) tick(state, { arena, autoSkills: false });
    const swing = firstSwing(arena) as unknown as { impactCount: number; releasedAtUs?: number };
    // Released, resolved, and missed: the arrow is spent, never a ghost hit.
    expect(swing.releasedAtUs).toBeDefined();
    expect(swing.impactCount).toBe(1);
    expect(mob.hp).toBe(1e9);
    expect(arena.playerShots).toHaveLength(0);
  });
});
