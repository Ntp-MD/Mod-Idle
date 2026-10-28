import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/engine/client-helpers';
import { arenaAction, captureCombatArena, createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import type { ManualControl } from '@sim/combat/combat-actions';
import { pinFieldPopulation } from '../fixtures/mobFixture';

function manualFight(spots: { id: string; x: number; y: number }[]) {
  const state = newGame(41);
  setLevel(state, 30);
  state.hunting = true;
  state.group = spots.map((spot, index) => {
    const mob = spawnMob(mulberry32(80 + index), 1, 'normal');
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
  return { state, arena };
}

describe('deliberate local control', () => {
  it('pins the basic target to the chosen focus until it is gone', () => {
    const { state, arena } = manualFight([
      { id: 'near', x: 3, y: 6 }, { id: 'far', x: 6, y: 6 },
    ]);
    arena.focusId = 'far';
    for (let index = 0; index < 2; index++) tick(state, { arena, autoSkills: false });
    const swings = state.fx.filter((event) => event.kind === 'hit' && event.via === 'swing');
    expect(swings.some((event) => event.mobId === 'far')).toBe(true);
    expect(swings.some((event) => event.mobId === 'near')).toBe(false);
  });

  it('moves to a local point, pauses new automatic casts, then establishes the anchor', () => {
    const { state, arena } = manualFight([{ id: 'target', x: 8, y: 6 }]);
    state.skills.owned['attack.fireball'] = 0;
    state.skills.list.fill(null);
    state.skills.list[0] = 'attack.fireball';
    const manual: ManualControl = { moveTo: { x: 3, y: 9 } };
    tick(state, { arena, manual });
    expect(arena.actions.some((action) => action.skillId === 'attack.fireball')).toBe(false);
    expect(state.fx.some((event) => event.kind === 'hit' && event.via === 'swing')).toBe(false);
    expect(arena.player.x).toBeGreaterThan(1);
    expect(manual.moveTo).toBeDefined();
    manual.moveTo = { x: arena.player.x + 0.1, y: arena.player.y };
    tick(state, { arena, manual });
    expect(manual.moveTo).toBeUndefined();
    expect(manual.anchor).toBeDefined();
    expect(arena.anchor).toEqual(manual.anchor);
  });

  it('cancels an unpaid windup when a local move arrives', () => {
    const { state, arena } = manualFight([{ id: 'target', x: 3, y: 6 }]);
    const action = arenaAction(arena, 'player', 'cast', 0, 'target', 'attack.fireball', undefined, {
      delivery: 'instant', startedAtUs: 0, releaseAtUs: 1_500_000, impactAtUs: 1_500_000,
      recoveryUntilUs: 1_800_000,
    })!;
    arena.intent = { skillId: 'attack.fireball', targetId: 'target', targetPoint: { x: 3, y: 6 },
      phase: 'windup', actionId: action.id, releaseAtUs: 1_500_000, recoveryUntilUs: 1_800_000 };
    const manual: ManualControl = { moveTo: { x: 2, y: 9 } };
    tick(state, { arena, manual });
    expect(arena.actions.find((entry) => entry.id === action.id)?.cancelReason).toBe('manual move');
    expect(arena.intent).toBeUndefined();
  });

  it('performs one manual cast even when automatic skills are off', () => {
    const { state, arena } = manualFight([{ id: 'target', x: 3, y: 6 }]);
    state.skills.owned['attack.fireball'] = 0;
    state.skills.list.fill(null);
    state.skills.list[0] = 'attack.fireball';
    // Automatic slot gates do not silence an explicit press.
    state.skills.mode['attack.fireball'] = 'never';
    const manual: ManualControl = { cast: { skillId: 'attack.fireball' } };
    tick(state, { arena, autoSkills: false, manual });
    expect(state.fx.some((event) => event.kind === 'cast' && event.skillId === 'attack.fireball')).toBe(true);
    expect(state.skills.cd['attack.fireball']).toBeGreaterThan(0);
    expect(manual.cast).toBeUndefined();
  });

  it('commits a manual ground cast to empty permitted ground and pays for it', () => {
    const { state, arena } = manualFight([{ id: 'target', x: 3.6, y: 6 }]);
    state.skills.owned['attack.meteor'] = 0;
    state.skills.list.fill(null);
    state.skills.list[0] = 'attack.meteor';
    const mana = state.player.mana;
    const manual: ManualControl = { cast: { skillId: 'attack.meteor', point: { x: 1, y: 9 } } };
    tick(state, { arena, autoSkills: false, manual });
    const cast = arena.actions.find((action) => action.skillId === 'attack.meteor')!;
    expect(cast.cancelReason).toBeUndefined();
    expect(cast.area?.center.x).toBeCloseTo(1, 5);
    expect(cast.area?.center.y).toBeCloseTo(9, 5);
    expect(state.skills.cd['attack.meteor']).toBeGreaterThan(0);
    expect(state.player.mana).toBeLessThan(mana);
    expect(state.fx.some((event) => event.kind === 'hit' && event.skillId === 'attack.meteor')).toBe(false);
  });

  it('walks a placed ground order into cast range before committing it', () => {
    const { state, arena } = manualFight([{ id: 'target', x: 3.6, y: 6 }]);
    state.skills.owned['attack.meteor'] = 0;
    state.skills.list.fill(null);
    state.skills.list[0] = 'attack.meteor';
    const manual: ManualControl = { cast: { skillId: 'attack.meteor', point: { x: 1, y: 12 } } };
    tick(state, { arena, autoSkills: false, manual });
    expect(arena.player.y).toBeGreaterThan(6);
    tick(state, { arena, autoSkills: false });
    tick(state, { arena, autoSkills: false });
    const cast = arena.actions.find((action) => action.skillId === 'attack.meteor')!;
    expect(cast).toBeDefined();
    expect(cast.area?.center.y).toBeCloseTo(12, 5);
  });

  it('aims a manual cast at the focused body', () => {
    // Nearer body sits off the firing line: this test measures the focus pin, not the
    // projectile sweep's interception of a body standing in the path.
    const { state, arena } = manualFight([
      { id: 'near', x: 1, y: 9 }, { id: 'far', x: 5.5, y: 6 },
    ]);
    state.skills.owned['attack.fireball'] = 0;
    state.skills.list.fill(null);
    state.skills.list[0] = 'attack.fireball';
    arena.focusId = 'far';
    const manual: ManualControl = { cast: { skillId: 'attack.fireball' } };
    tick(state, { arena, autoSkills: false, manual });
    const cast = arena.actions.find((action) => action.skillId === 'attack.fireball')!;
    expect(cast.targetId).toBe('far');
    expect(state.fx.some((event) => event.kind === 'hit' && event.skillId === 'attack.fireball'
      && event.mobId === 'far')).toBe(true);
  });
});
describe('manual command feedback', () => {
  it('names the reason a deliberate cast was refused, once', async () => {
    const { createArenaWork } = await import('@sim/core/tick/arena-work');
    const { CombatClock } = await import('@sim/combat/combat-clock');
    const { state, arena } = manualFight([{ id: 'near', x: 3, y: 6 }]);
    const clock = new CombatClock(0, 1_000_000);
    const work = createArenaWork({ arena, clock, s: state });
    arena.intent = { skillId: 'attack.firestorm', targetId: 'near', targetPoint: { x: 1, y: 6 },
      phase: 'windup', manual: true };
    work.cancelIntent('out of range');
    work.cancelIntent('out of range');
    const lines = state.log.filter((line) => line.text === 'Cast cancelled · out of range');
    expect(lines).toHaveLength(1);
    arena.intent = { skillId: 'attack.firestorm', targetId: 'near', targetPoint: { x: 1, y: 6 }, phase: 'windup' };
    work.cancelIntent('target lost');
    expect(state.log.some((line) => line.text.startsWith('Cast cancelled'))).toBe(true);
    expect(state.log.filter((line) => line.text === 'Cast cancelled · target lost')).toHaveLength(0);
  });
});
