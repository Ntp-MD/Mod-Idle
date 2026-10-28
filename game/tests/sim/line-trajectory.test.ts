import { describe, expect, it } from 'vitest';
import { loot } from '../../src/engine/client';
import { mulberry32 } from '../../src/engine/client-helpers';
import { createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import { pinFieldPopulation } from '../fixtures/mobFixture';

/** A caster-origin line commits a trajectory, not a point: the bolt flies the footprint's length. */
function lineEncounter() {
  const state = newGame(97);
  setLevel(state, 30);
  state.hunting = true;
  state.player.hp = 1e9;
  const mainHand = loot.SLOTS.findIndex((slot: string) => slot === 'main hand');
  state.gear[mainHand] = { slot: 'main hand', base: 'crossbow', ilvl: 1, quality: 'Normal', tier: 'T1', lines: [] } as never;
  state.skills.owned['attack.piercing_shot'] = 0;
  state.skills.list.fill(null);
  state.skills.list[0] = 'attack.piercing_shot';
  const mobs = ['near', 'far'].map((id, index) => {
    const mob = spawnMob(mulberry32(40 + index), 1, 'normal');
    Object.assign(mob, {
      id, hp: 1e9, hpMax: 1e9, ps: 0, accuracy: 0, evasion: 0, dodgeRate: 0,
      armour: 0, line: 'stand-off', damage: 'physical', innate: [], skillIds: [],
    });
    return mob;
  });
  state.group = mobs;
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 1, y: 6 });
  Object.assign(arena.mobs.near, { x: 4, y: 6 });
  Object.assign(arena.mobs.far, { x: 5.5, y: 6 });
  pinFieldPopulation(state);
  return { state, mobs, arena };
}

describe('F16 line — the bolt travels the footprint, damage follows the line', () => {
  it('flies Piercing Shot to the footprint edge and strikes every body on it', () => {
    const { state, mobs, arena } = lineEncounter();
    for (let index = 0; index < 10; index++) tick(state, { arena });
    const cast = arena.actions.find((action) => action.actorId === 'player'
      && action.skillId === 'attack.piercing_shot'
      && action.timing && (action.impactCount ?? 0) > 0)! as unknown as {
        timing: { delivery: string; releaseAtUs: number; impactAtUs: number };
        x: number; y: number;
        payloads?: { destination: { x: number; y: number } }[];
      };
    expect(cast).toBeDefined();
    expect(cast.timing.delivery).toBe('projectile');
    // The trajectory is the 5.2 m footprint, not a zero-length point at the caster.
    expect(cast.timing.impactAtUs).toBeGreaterThan(cast.timing.releaseAtUs);
    const mouth = cast.payloads?.[0]?.destination;
    expect(mouth).toBeDefined();
    expect(Math.hypot(mouth!.x - cast.x, mouth!.y - cast.y)).toBeCloseTo(5.2, 1);
    expect(mobs[0].hp).toBeLessThan(1e9);
    expect(mobs[1].hp).toBeLessThan(1e9);
    // F20: the line resolves at its body crossing, not the noticing sample — the impact
    // beat falls strictly inside a movement sample instead of on the sample grid.
    expect(cast.timing.impactAtUs % 50_000).not.toBe(0);
  });
});
