import { describe, expect, it } from 'vitest';
import type { NavLayout } from '@engine/navigation.ts';
import { isClear } from '@engine/navigation.ts';
import { E } from '../../src/engine/client';
import { mulberry32 } from '../../src/engine/client-helpers';
import { advanceCombatArena, captureCombatArena, createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, spawnMob } from '@sim/core/game';
import { pinFieldPopulation } from '../fixtures/mobFixture';

const BOUNDS = { x: 0, y: 0, width: E.combat_arena.width, height: E.combat_arena.height };
const wallAt = (x: number, width = 1): NavLayout => ({
  version: 1, bounds: BOUNDS, cellSize: 1,
  obstacles: [{ kind: 'box', id: 'wall', x, y: 0, width, height: BOUNDS.height,
    flags: { movement: true, sight: true, projectiles: true } }],
});
const openNav = (): NavLayout => ({ version: 1, bounds: BOUNDS, cellSize: 1, obstacles: [] });

function fight(playerX: number, mobX: number) {
  const state = newGame(17);
  setLevel(state, 30);
  state.hunting = true;
  const mob = spawnMob(mulberry32(23), 1, 'normal');
  Object.assign(mob, {
    id: 'arena-target', hp: 1e8, hpMax: 1e8, ps: 1, evasion: 0, dodgeRate: 0,
    armour: 0, line: 'front', damage: 'physical', innate: [], skillIds: [],
  });
  state.group = [mob];
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: playerX, y: 6 });
  Object.assign(arena.mobs[mob.id], { x: mobX, y: 6 });
  captureCombatArena(arena, state, 0);
  pinFieldPopulation(state, 1, new Map([[mob.id, arena.mobs[mob.id]]]));
  return { state, mob, arena };
}

const sample = (engagedIds: string[] = []) => ({
  playerRange: 0, playerSpeedMult: 0, mobSpeedMult: () => 1, engagedIds: new Set(engagedIds),
});

describe('static ground in the combat arena', () => {
  it('stops a pursuer at a wall instead of letting it cross', () => {
    const { state, mob, arena } = fight(1, 8);
    arena.nav = wallAt(4);
    for (let index = 0; index < 40; index++) advanceCombatArena(arena, state, (index + 1) * 100_000, sample([mob.id]));
    const actor = arena.mobs[mob.id];
    const radius = actor.radiusM ?? 0.25;
    expect(isClear(arena.nav, actor, radius)).toBe(true);
    expect(actor.x).toBeGreaterThan(5 + radius - 1e-6);
    expect(actor.x).toBeLessThan(8);
  });

  it('crosses the same wall when no geometry is authored, so the block above is the geometry', () => {
    const { state, mob, arena } = fight(1, 8);
    for (let index = 0; index < 40; index++) advanceCombatArena(arena, state, (index + 1) * 100_000, sample([mob.id]));
    expect(arena.mobs[mob.id].x).toBeLessThan(4);
  });

  it('sweeps a manual order and stops at the wall face', () => {
    const { state, arena } = fight(1, 20);
    arena.nav = wallAt(4);
    for (let index = 0; index < 2; index++) {
      advanceCombatArena(arena, state, (index + 1) * 1_000_000, { ...sample(), playerSpeedMult: 1, playerMoveTo: { x: 10, y: 6 } });
    }
    expect(arena.player.x).toBeLessThan(4);
    expect(arena.player.x).toBeCloseTo(3.75, 4);
    expect(isClear(arena.nav, arena.player, arena.player.radiusM ?? 0.25)).toBe(true);
  });

  it('reverts a separation push that would finish inside the wall', () => {
    const { state, mob, arena } = fight(3.9, 4.3);
    arena.nav = wallAt(4.6, 1.4);
    const actor = arena.mobs[mob.id];
    const start = { x: actor.x, y: actor.y };
    advanceCombatArena(arena, state, 100_000, sample());
    expect(arenaDistanceish(actor, start)).toBeLessThan(1e-9);
    expect(isClear(arena.nav, actor, actor.radiusM ?? 0.25)).toBe(true);
    expect(isClear(arena.nav, arena.player, arena.player.radiusM ?? 0.25)).toBe(true);
  });

  it('never plans a contact claim inside the wall', () => {
    const { state, mob, arena } = fight(3.7, 2.6);
    arena.nav = wallAt(4);
    advanceCombatArena(arena, state, 100_000, sample([mob.id]));
    const claim = arena.contacts[mob.id];
    expect(claim).toBeDefined();
    expect(claim!.x).toBeLessThan(4);
    expect(isClear(arena.nav, claim!, arena.mobs[mob.id].radiusM ?? 0.25)).toBe(true);
  });

  it('keeps an empty nav layout identical to no layout at all', () => {
    const first = fight(1, 8);
    const second = fight(1, 8);
    first.arena.nav = undefined;
    second.arena.nav = openNav();
    for (let index = 0; index < 20; index++) {
      const at = (index + 1) * 100_000;
      advanceCombatArena(first.arena, first.state, at, sample([first.mob.id]));
      advanceCombatArena(second.arena, second.state, at, sample([second.mob.id]));
    }
    expect(second.arena.player.x).toBe(first.arena.player.x);
    expect(second.arena.player.y).toBe(first.arena.player.y);
    expect(second.arena.mobs[second.mob.id].x).toBe(first.arena.mobs[first.mob.id].x);
    expect(second.arena.mobs[second.mob.id].y).toBe(first.arena.mobs[first.mob.id].y);
    expect(second.arena.contacts).toEqual(first.arena.contacts);
  });
});

function arenaDistanceish(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
