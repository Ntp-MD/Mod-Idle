import { describe, expect, it } from 'vitest';
import { isClear } from '@engine/navigation.ts';
import { mulberry32 } from '../../src/engine/client-helpers';
import { spawns } from '../../src/engine/client';
import { aimForSkill, createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import { mobFixture, pinFieldPopulation } from '../fixtures/mobFixture';

/** P0 obstacle fixture on live ground: zone 2 authors the ridge and thicket, the sim walks it. */
function sliceNav() {
  return spawns.navigation(spawns.profileFor(2).layout)!;
}

/** P0 slice fight: player and mob start on opposite sides of the ridge. */
function sliceFight() {
  const state = newGame(17);
  setLevel(state, 30);
  state.hunting = true;
  const mob = spawnMob(mulberry32(23), 1, 'normal');
  Object.assign(mob, {
    id: 'slice-bystander', hp: 1e8, hpMax: 1e8, ps: 1, evasion: 0, dodgeRate: 0,
    armour: 0, line: 'stand-off', damage: 'physical', innate: [], skillIds: [],
  });
  state.group = [mob];
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  arena.nav = sliceNav();
  Object.assign(arena.player, { x: 14, y: 6 });
  Object.assign(arena.mobs[mob.id], { x: 44, y: 26 });
  pinFieldPopulation(state, 1, new Map([[mob.id, arena.mobs[mob.id]]]));
  return { state, mob, arena };
}

/** A pinned body on live ground, far enough from the camera start to place by hand. */
function pinnedFight(playerX: number, mobX: number, y: number) {
  const arena = createCombatArena();
  const mob = mobFixture({ id: 'pinned-target', hp: 1000, hpMax: 1000, innate: [], skillIds: [] });
  arena.mobs[mob.id] = {
    id: mob.id, x: mobX, y, facing: 0, moving: false, radiusM: 0.3, hp: 1000, hpMax: 1000, mob,
  } as never;
  Object.assign(arena.player, { x: playerX, y });
  arena.focusId = mob.id;
  arena.nav = sliceNav();
  return { arena, group: [mob] };
}

describe('P0 obstacle fixture — live zone-2 geometry', () => {
  it('walks a manual order around the ridge through the proven gap', () => {
    const { state, arena } = sliceFight();
    expect(arena.nav).not.toBeNull();
    const manual: { moveTo?: { x: number; y: number } } = { moveTo: { x: 30, y: 6 } };
    const radius = arena.player.radiusM ?? 0.25;
    let arrived = false;
    for (let index = 0; index < 30 && !arrived; index++) {
      tick(state, { arena, manual });
      expect(isClear(arena.nav!, arena.player, radius)).toBe(true);
      arrived = manual.moveTo === undefined;
    }
    // The straight line crosses ridge-north; arrival proves the route went through the gap.
    // (After the order completes the farmer resumes toward its body, so only nearness is pinned.)
    expect(arrived).toBe(true);
    expect(Math.hypot(arena.player.x - 30, arena.player.y - 6)).toBeLessThan(2);
  });

  it('holds every authored home clear of the live ground', () => {
    const nav = sliceNav();
    expect(nav.obstacles.map((obstacle) => obstacle.id)).toEqual(['ridge-north', 'ridge-south', 'thicket']);
    for (const point of spawns.pointsFor(2)) expect(isClear(nav, point, 0.3)).toBe(true);
  });

  it('resolves the live zone profile into arena ground and leaves the clearing bare', () => {
    const state = newGame(17);
    const two = createCombatArena();
    state.zone = 2;
    syncCombatArena(two, state, 0, 1_000_000, characterSheet(state).maxHp);
    expect(two.navLayoutId).toBe('forest-ridge');
    expect(two.nav?.obstacles.map((obstacle) => obstacle.id)).toEqual(['ridge-north', 'ridge-south', 'thicket']);
    const one = createCombatArena();
    state.zone = 1;
    syncCombatArena(one, state, 0, 1_000_000, characterSheet(state).maxHp);
    expect(one.navLayoutId).toBe('forest-clearing');
    expect(one.nav).toBeUndefined();
  });

  it('refuses to aim a pinned target behind a sight ridge', () => {
    const { arena, group } = pinnedFight(14, 44, 6);
    expect(aimForSkill(arena, group, 'attack.fireball')).toBeUndefined();
  });

  it('aims a pinned target through the movement-only thicket', () => {
    const { arena, group } = pinnedFight(33, 41, 16);
    expect(aimForSkill(arena, group, 'attack.fireball')?.mob.id).toBe('pinned-target');
  });
});
