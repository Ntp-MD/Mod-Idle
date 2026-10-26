import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/engine/client-helpers';
import {
  arenaDistance, captureCombatArena, createCombatArena, syncCombatArena,
} from '../src/sim/combat-arena';
import { characterSheet, hitColour, newGame, setLevel, spawnMob, tick } from '../src/sim/game';

function rangedFight(distance = 3, over: Record<string, unknown> = {}) {
  const state = newGame(41);
  setLevel(state, 30);
  state.hunting = true;
  state.spawnIn = 999;
  const mob = spawnMob(mulberry32(23), 1, 'normal');
  Object.assign(mob, {
    id: 'archer', species: 'Archer', hp: 1e8, hpMax: 1e8, ps: 1, acc: 1e9, evasion: 0, dodgeRate: 0,
    armour: 0, line: 'stand-off', damage: 'physical', innate: [], skillIds: [], hitsPerSec: 1, atkTimer: 0,
    engageSec: 0, ...over,
  });
  state.group = [mob];
  state.skills.list.fill(null);
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 1, y: 6 });
  Object.assign(arena.mobs[mob.id], { x: 1 + distance, y: 6 });
  captureCombatArena(arena, state, 0);
  return { state, mob, arena };
}

const shots = (arena: ReturnType<typeof createCombatArena>) => arena.actions.filter((action) => action.ranged);

describe('ordinary ranged mob defaults', () => {
  it('releases on the attack beat and applies damage at projectile contact', () => {
    const { state, arena } = rangedFight(3);
    tick(state, { arena, autoSkills: false });
    expect(arena.mobFlights).toHaveLength(1);
    expect(state.fx.some((event) => event.kind === 'taken')).toBe(false);
    expect(shots(arena)).toHaveLength(1);
    const release = shots(arena)[0];
    expect(release.timing!.releaseAtUs).toBe(1_000_000);
    expect(release.timing!.impactAtUs).toBeGreaterThan(release.timing!.releaseAtUs);

    tick(state, { arena, autoSkills: false });
    const taken = state.fx.filter((event) => event.kind === 'taken' && event.byId === 'archer');
    const resolved = arena.actions.find((action) => action.id === release.id)!;
    expect(taken).toHaveLength(1);
    expect(taken[0].atUs).toBe(resolved.timing!.impactAtUs);
    expect(resolved.timing!.impactAtUs).toBeLessThan(release.timing!.impactAtUs);
    expect(release.cancelledAtUs).toBeUndefined();
    expect(arena.mobFlights).toHaveLength(1);
  });

  it('fires once per attack interval and never adds a second damage stream', () => {
    const { state, arena } = rangedFight(3);
    tick(state, { arena, autoSkills: false });
    tick(state, { arena, autoSkills: false });
    tick(state, { arena, autoSkills: false });
    expect(shots(arena)).toHaveLength(3);
    const taken = state.fx.filter((event) => event.kind === 'taken' && event.byId === 'archer');
    expect(taken).toHaveLength(2);
    const beats = shots(arena).map((action) => action.timing!.releaseAtUs);
    expect(beats).toEqual([1_000_000, 2_000_000, 3_000_000]);
  });

  it('fizzles a shot that reaches its committed endpoint without contact', () => {
    const { state, mob, arena } = rangedFight(3);
    tick(state, { arena, autoSkills: false });
    const release = shots(arena)[0];
    arena.player.y = 10;
    arena.intent = { skillId: 'attack.firestorm', targetId: mob.id, targetPoint: { x: 1, y: 10 },
      phase: 'windup', releaseAtUs: 10_000_000 };
    tick(state, { arena, autoSkills: true });
    expect(state.fx.filter((event) => event.kind === 'taken' && event.byId === 'archer')).toHaveLength(0);
    expect(arena.mobFlights).toHaveLength(1);
    const resolved = arena.actions.find((action) => action.id === release.id)!;
    expect(resolved.cancelledAtUs).toBeUndefined();
    expect(resolved.timing!.impactAtUs).toBeGreaterThan(release.timing!.releaseAtUs);
  });

  it('keeps a released shot after its source dies', () => {
    const { state, mob, arena } = rangedFight(3);
    tick(state, { arena, autoSkills: false });
    expect(arena.mobFlights).toHaveLength(1);
    mob.hp = 0;
    state.group = [];
    tick(state, { arena, autoSkills: false });
    expect(state.fx.filter((event) => event.kind === 'taken' && event.byId === 'archer')).toHaveLength(1);
  });

  it('keeps the shot physical or elemental while matching the visible colour', () => {
    const { state, arena } = rangedFight(3, { damage: 'magic', innate: ['fire'] });
    tick(state, { arena, autoSkills: false });
    tick(state, { arena, autoSkills: false });
    const taken = state.fx.filter((event) => event.kind === 'taken' && event.byId === 'archer');
    expect(taken).toHaveLength(1);
    expect(taken[0].colour).toBe(hitColour('fire'));
    expect(taken[0].value).toBeGreaterThan(0);
  });

  it('cancels a released shot when the encounter changes', () => {
    const { state, arena } = rangedFight(3);
    tick(state, { arena, autoSkills: false });
    const release = shots(arena)[0];
    state.cell = { q: 5, r: 5, sub: null, wild: null };
    tick(state, { arena, autoSkills: false });
    const resolved = arena.actions.find((action) => action.id === release.id)!;
    expect(resolved.cancelReason).toBe('area-exit');
    expect(arena.mobFlights.some((shot) => shot.actionId === release.id)).toBe(false);
    expect(state.fx.filter((event) => event.kind === 'taken' && event.byId === 'archer')).toHaveLength(0);
  });

  it('cancels a released shot at the fatal latch', () => {
    const { state, arena } = rangedFight(3);
    tick(state, { arena, autoSkills: false });
    state.player.hp = 0;
    tick(state, { arena, autoSkills: false });
    expect(arena.mobFlights).toHaveLength(0);
    expect(state.fx.filter((event) => event.kind === 'taken' && event.byId === 'archer')).toHaveLength(0);
  });

  it('lets a ready strike replace the shot instead of firing both', () => {
    const { state, arena } = rangedFight(3, { skillIds: ['mob.lightning.static-jab'], skillReadyAtUs: {} });
    tick(state, { arena, autoSkills: false });
    expect(shots(arena)).toHaveLength(0);
    expect(arena.mobFlights).toHaveLength(0);
    expect(state.fx.filter((event) => event.kind === 'taken').length).toBe(1);
  });

  it('falls back to the ordinary shot when a ready strike is out of its role reach', () => {
    const { state, mob, arena } = rangedFight(4, { skillIds: ['mob.lightning.static-jab'], skillReadyAtUs: {} });
    arena.intent = { skillId: 'attack.firestorm', targetId: mob.id, targetPoint: { x: 1, y: 6 },
      phase: 'windup', releaseAtUs: 10_000_000 };
    tick(state, { arena, autoSkills: true });
    expect(shots(arena)).toHaveLength(1);
    expect(arena.mobFlights).toHaveLength(1);
    expect(state.fx.filter((event) => event.kind === 'taken')).toHaveLength(0);
    expect(mob.skillReadyAtUs?.['mob.lightning.static-jab']).toBeUndefined();
  });

  it('uses the ready strike when the player is inside its role reach', () => {
    const { state, mob, arena } = rangedFight(1.5, { skillIds: ['mob.lightning.static-jab'], skillReadyAtUs: {} });
    arena.intent = { skillId: 'attack.firestorm', targetId: mob.id, targetPoint: { x: 1, y: 6 },
      phase: 'windup', releaseAtUs: 10_000_000 };
    tick(state, { arena, autoSkills: true });
    expect(shots(arena)).toHaveLength(0);
    expect(arena.mobFlights).toHaveLength(0);
    expect(state.fx.filter((event) => event.kind === 'taken' && event.byId === 'archer')).toHaveLength(1);
    expect(mob.skillReadyAtUs?.['mob.lightning.static-jab']).toBeGreaterThan(0);
  });

  it('holds ordinary stand-off bodies at 80% of their reach', () => {
    const { state, mob, arena } = rangedFight(8);
    arena.intent = { skillId: 'attack.firestorm', targetId: mob.id, targetPoint: { x: 1, y: 6 },
      phase: 'windup', releaseAtUs: 10_000_000 };
    for (let i = 0; i < 4; i++) tick(state, { arena, autoSkills: true });
    const distance = arenaDistance(arena.player, arena.mobs[mob.id]);
    expect(distance).toBeGreaterThan(4);
    expect(distance).toBeLessThan(4.3);
    expect(shots(arena).length).toBeGreaterThanOrEqual(1);
  });
});
