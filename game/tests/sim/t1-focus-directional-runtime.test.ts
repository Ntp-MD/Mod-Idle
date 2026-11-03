import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/engine/client-helpers';
import { captureCombatArena, createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import type { ManualControl } from '@sim/combat/combat-actions';
import { pinFieldPopulation } from '../fixtures/mobFixture';

function controlledFight(spots: { id: string; x: number; y: number }[]) {
  const state = newGame(318);
  setLevel(state, 30);
  state.hunting = true;
  state.player.hp = 1e9;
  state.group = spots.map((spot, index) => {
    const mob = spawnMob(mulberry32(318 + index), 1, 'normal');
    Object.assign(mob, {
      id: spot.id, hp: 1e9, hpMax: 1e9, ps: 0, acc: 1e9, evasion: 0, dodgeRate: 0,
      armour: 0, line: 'front', damage: 'physical', innate: [], skillIds: [],
    });
    return mob;
  });
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 1, y: 6 });
  for (const spot of spots) Object.assign(arena.mobs[spot.id], { x: spot.x, y: spot.y });
  captureCombatArena(arena, state, 0);
  pinFieldPopulation(state);
  state.skills.list.fill(null);
  return { state, arena };
}

function slot(state: ReturnType<typeof newGame>, skillId: string) {
  state.skills.owned[skillId] = 0;
  state.skills.list[0] = skillId;
}

describe('T1 focus and directional range through live ticks', () => {
  it('replaces an eastern approach with northern focus, pursues it, then starts its action', () => {
    const { state, arena } = controlledFight([
      { id: 'east', x: 12, y: 6 },
      { id: 'north', x: 1, y: 14 },
    ]);
    slot(state, 'attack.fireball');
    arena.focusId = 'east';
    tick(state, { arena });
    expect(arena.intent?.targetId).toBe('east');
    const beforeY = arena.player.y;

    arena.focusId = 'north';
    tick(state, { arena });
    expect(arena.intent).toBeDefined();
    expect(arena.intent?.targetId).toBe('north');
    expect(arena.player.y).toBeGreaterThan(beforeY);

    Object.assign(arena.mobs.north, { x: arena.player.x, y: arena.player.y + 4 });
    tick(state, { arena });
    const action = arena.actions.find((entry) => entry.skillId === 'attack.fireball');
    expect(action).toBeDefined();
    expect(action?.targetId).toBe('north');
  });

  it('releases automatic Cleave across two nearby ±40° bodies without pursuing the distant anchor', () => {
    const radius = 2;
    const diagonal = radius * Math.sin(40 * Math.PI / 180);
    const forward = radius * Math.cos(40 * Math.PI / 180);
    const { state, arena } = controlledFight([
      { id: 'upper', x: 1 + forward, y: 6 + diagonal },
      { id: 'lower', x: 1 + forward, y: 6 - diagonal },
      { id: 'anchor', x: 9, y: 6 },
    ]);
    slot(state, 'attack.cleave');
    tick(state, { arena });

    const action = arena.actions.find((entry) => entry.skillId === 'attack.cleave');
    expect(action, 'Cleave must release instead of approaching the distant anchor').toBeDefined();
    expect(action?.targetId).toBe('anchor');
    const landed = new Set(state.fx.filter((event) => event.kind === 'hit' && event.skillId === 'attack.cleave')
      .map((event) => event.mobId));
    expect(landed.has('upper')).toBe(true);
    expect(landed.has('lower')).toBe(true);
    expect(landed.has('anchor')).toBe(false);
    expect(Math.hypot(arena.player.x - 1, arena.player.y - 6)).toBeLessThan(0.5);
  });

  it('manual Venom Spray releases with the same bearing for a near or far collinear point', () => {
    const run = (pointX: number) => {
      const { state, arena } = controlledFight([
        { id: 'near', x: 2.5, y: 6 },
        { id: 'far', x: 4.5, y: 6 },
      ]);
      const manual: ManualControl = { cast: { skillId: 'attack.venom_spray', point: { x: pointX, y: 6 } } };
      slot(state, 'attack.venom_spray');
      for (let index = 0; index < 3; index++) tick(state, { arena, autoSkills: false, ...(index === 0 ? { manual } : {}) });
      const action = arena.actions.find((entry) => entry.skillId === 'attack.venom_spray');
      expect(action?.timing?.releaseAtUs).toBeDefined();
      return action?.area?.directionRad;
    };

    const nearBearing = run(2.5);
    const farBearing = run(4.5);
    expect(nearBearing).toBeCloseTo(0, 6);
    expect(farBearing).toBeCloseTo(nearBearing!, 6);
  });
});
