import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/engine/client-helpers';
import { captureCombatArena, createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import { pinFieldPopulation } from '../fixtures/mobFixture';

function shapedFight(skillId: string, weapon: string | null, spots: { id: string; x: number; y: number }[]) {
  const state = newGame(41);
  setLevel(state, 30);
  state.hunting = true;
  state.group = spots.map((spot, index) => {
    const mob = spawnMob(mulberry32(30 + index), 1, 'normal');
    Object.assign(mob, {
      id: spot.id, hp: 1e9, hpMax: 1e9, ps: 1, evasion: 0, dodgeRate: 0,
      armour: 0, line: 'front', damage: 'physical', innate: [], skillIds: [],
    });
    return mob;
  });
  if (weapon) state.gear[0] = { slot: 'main hand', base: weapon, ilvl: 1, quality: 'Normal', tier: 'T1', lines: [] };
  state.skills.owned[skillId] = 0;
  state.skills.list.fill(null);
  state.skills.list[0] = skillId;
  state.player.mana = characterSheet(state).maxMana;
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 9, y: 6 });
  for (const spot of spots) Object.assign(arena.mobs[spot.id], { x: spot.x, y: spot.y });
  captureCombatArena(arena, state, 0);
  pinFieldPopulation(state);
  return { state, arena };
}

describe('the selected four shapes in a real cast', () => {
  it('hits only the forward cone for Cleave', () => {
    const { state, arena } = shapedFight('attack.cleave', 'one-handed axe', [
      { id: 'front', x: 10, y: 6 }, { id: 'behind', x: 7.5, y: 6 },
    ]);
    tick(state, { arena });
    const front = state.group.find((mob) => mob.id === 'front')!;
    const behind = state.group.find((mob) => mob.id === 'behind')!;
    expect(front.hp).toBeLessThan(front.hpMax);
    const action = arena.actions.find((entry) => entry.skillId === 'attack.cleave')!;
    expect(action.hitIds).toEqual(['front']);
    expect(action.hitIds).not.toContain('behind');
    expect(action.area?.shape).toBe('cone');
    expect(action.area?.angleDeg).toBe(120);
  });

  it('strikes every body on Piercing Shot line once and ignores the off-line body', () => {
    const { state, arena } = shapedFight('attack.piercing_shot', 'bow', [
      { id: 'front', x: 11.4, y: 6 }, { id: 'second', x: 12.9, y: 6 }, { id: 'off', x: 11.4, y: 7.4 },
    ]);
    tick(state, { arena });
    const byId = Object.fromEntries(state.group.map((mob) => [mob.id, mob]));
    expect(byId.front.hp).toBeLessThan(byId.front.hpMax);
    expect(byId.second.hp).toBeLessThan(byId.second.hpMax);
    const action = arena.actions.find((entry) => entry.skillId === 'attack.piercing_shot')!;
    expect([...action.hitIds!].sort()).toEqual(['front', 'second']);
    expect(action.hitIds).not.toContain('off');
    expect(action.area?.shape).toBe('line');
    expect(action.area?.widthM).toBe(0.75);
  });
});
describe('self and target circles in a real cast', () => {
  it('fires a caster-origin ring around the player and leaves a distant body alone', () => {
    const { state, arena } = shapedFight('attack.frost_nova', null, [
      { id: 'near', x: 10.4, y: 6 }, { id: 'far', x: 13.2, y: 6 },
    ]);
    tick(state, { arena });
    const action = arena.actions.find((entry) => entry.skillId === 'attack.frost_nova')!;
    expect(action.area?.origin).toBe('caster');
    expect(action.area?.center).toEqual({ x: 9, y: 6 });
    expect(action.hitIds).toEqual(['near']);
    const far = state.group.find((mob) => mob.id === 'far')!;
    expect(far.hp).toBe(far.hpMax);
  });

  it('centres a target circle on the aimed body and hits only its radius', () => {
    const { state, arena } = shapedFight('attack.firestorm', null, [
      { id: 'aim', x: 11.6, y: 6 }, { id: 'inside', x: 14.2, y: 6 }, { id: 'outside', x: 18, y: 6 },
    ]);
    tick(state, { arena });
    const action = arena.actions.find((entry) => entry.skillId === 'attack.firestorm')!;
    expect(action.area?.origin).toBe('target');
    // The circle follows the aimed body to its release position, never the caster (9) or the ring body.
    expect(action.area?.targetId).toBe('aim');
    expect(action.area!.center.x).toBeGreaterThan(9.2);
    expect(action.area!.center.x).toBeLessThan(12.5);
    expect(action.area!.center.y).toBeCloseTo(6, 1);
    expect([...action.hitIds!].sort()).toEqual(['aim', 'inside']);
    const outside = state.group.find((mob) => mob.id === 'outside')!;
    expect(outside.hp).toBe(outside.hpMax);
  });
});
