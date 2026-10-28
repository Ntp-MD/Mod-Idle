import { describe, expect, it } from 'vitest';
import { isClear } from '@engine/navigation.ts';
import { mulberry32 } from '../../src/engine/client-helpers';
import { spawns } from '../../src/engine/client';
import { createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import { pinFieldPopulation } from '../fixtures/mobFixture';

/** P0 obstacle fixture on authored ground: the slice layout proves the geometry, the sim walks it. */
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
  arena.nav = spawns.navigation('grove-slice')!;
  Object.assign(arena.player, { x: 14, y: 6 });
  Object.assign(arena.mobs[mob.id], { x: 44, y: 26 });
  pinFieldPopulation(state, 1, new Map([[mob.id, arena.mobs[mob.id]]]));
  return { state, mob, arena };
}

describe('P0 obstacle fixture — authored slice geometry', () => {
  it('walks a manual order around the ridge through the proven gap', () => {
    const { state, arena } = sliceFight();
    expect(arena.nav).not.toBeNull();
    const manual: { moveTo?: { x: number; y: number } } = { moveTo: { x: 26, y: 6 } };
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
    expect(Math.hypot(arena.player.x - 26, arena.player.y - 6)).toBeLessThan(2);
  });
});
