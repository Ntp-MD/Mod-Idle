import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/engine/client-helpers';
import { captureCombatArena, createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import { arenaFlightWindow } from '../../src/ui/combat/combat-arena-view';
import { pinFieldPopulation } from '../fixtures/mobFixture';

function boulderFight() {
  const state = newGame(41);
  setLevel(state, 30);
  state.hunting = true;
  const mob = spawnMob(mulberry32(23), 1, 'normal');
  Object.assign(mob, {
    id: 'boulder', hp: 1e9, hpMax: 1e9, ps: 1, acc: 1e9, evasion: 0, dodgeRate: 0,
    armour: 0, line: 'front', damage: 'physical', innate: [], hitsPerSec: 1, atkTimer: 0,
    skillIds: ['mob.earth.boulder-toss'], skillReadyAtUs: {},
  });
  state.group = [mob];
  state.skills.list.fill(null);
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 1, y: 6 });
  Object.assign(arena.mobs[mob.id], { x: 2.2, y: 6 });
  captureCombatArena(arena, state, 0);
  pinFieldPopulation(state);
  return { state, mob, arena };
}

describe('mob ground telegraph', () => {
  it('commits the circle at release, shows it through the flight, and lands once', () => {
    const { state, mob, arena } = boulderFight();
    let telegraph: { area?: { origin?: string; radiusM?: number; center?: { x: number; y: number } }; timing?: { releaseAtUs: number; impactAtUs: number } } | undefined;
    let feet = { x: 0, y: 0 };
    let resolved = false;
    for (let index = 0; index < 5 && !resolved; index++) {
      tick(state, { arena, autoSkills: false });
      const cast = arena.actions.find((entry) => entry.skillId === 'mob.earth.boulder-toss');
      if (!cast) continue;
      if (cast.releasedAtUs != null && cast.impactCount == null)
      {
        telegraph = structuredClone({ area: cast.area, timing: {
          releaseAtUs: cast.timing!.releaseAtUs, impactAtUs: cast.timing!.impactAtUs } });
        feet = { x: arena.player.x, y: arena.player.y };
      }
      if (cast.impactCount != null) resolved = true;
    }

    expect(telegraph?.area?.origin).toBe('target');
    expect(telegraph?.area?.radiusM).toBe(1.5);
    // The circle lands where the player's feet stood at release, not at the mob and not at the click.
    expect(telegraph?.area?.center?.x).toBeCloseTo(feet.x, 5);
    expect(telegraph?.area?.center?.y).toBeCloseTo(feet.y, 5);
    expect(telegraph!.area!.center!.x).toBeLessThan(2.2);
    expect(arenaFlightWindow(telegraph!.timing!, 1_000_000)?.leadSec).toBeCloseTo(0.8, 6);

    expect(resolved).toBe(true);
    expect(arena.mobFlights).toHaveLength(0);
    const taken = state.fx.filter((event) => event.kind === 'taken' && event.byId === mob.id
      && event.skillId === 'mob.earth.boulder-toss');
    expect(taken).toHaveLength(1);
    expect(taken[0].value).toBeGreaterThan(0);
  });
});
