import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/engine/client-helpers';
import {
  arenaDistance, captureCombatArena, createCombatArena, syncCombatArena,
} from '@sim/combat/combat-arena';
import { characterSheet, hitColour, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import { pinFieldPopulation } from '../fixtures/mobFixture';
import { arenaActionPose } from '../../src/ui/combat/combat-arena-view';

function rangedFight(distance = 3, over: Record<string, unknown> = {}) {
  const state = newGame(41);
  setLevel(state, 30);
  state.hunting = true;
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
  pinFieldPopulation(state);
  return { state, mob, arena };
}

const shots = (arena: ReturnType<typeof createCombatArena>) =>
  arena.actions.filter((action) => action.ranged && !action.skillId);

describe('ordinary ranged mob defaults', () => {
  it('cancels an out-of-range release and resumes pursuit without spending the skill', () => {
    const { state, mob, arena } = rangedFight(1, {
      line: 'front', skillIds: ['mob.physical.crushing-blow'], skillReadyAtUs: {},
    });
    tick(state, { arena, autoSkills: false });
    const action = arena.actions.find(entry => entry.actorId === mob.id && entry.skillId === 'mob.physical.crushing-blow')!;
    const x = arena.mobs[mob.id].x;
    arena.player.x = 15;
    state.playerStatuses.shock = { stacks: 1, secLeft: 3, perSec: 0 };
    tick(state, { arena, autoSkills: false });
    expect(arena.actions.find(entry => entry.id === action.id)?.cancelReason).toBe('release-invalid');
    expect(mob.skillReadyAtUs?.['mob.physical.crushing-blow']).toBeUndefined();
    expect(state.fx.filter(event => event.kind === 'taken' && event.skillId === 'mob.physical.crushing-blow')).toHaveLength(0);
    expect(arena.mobs[mob.id].x).toBeGreaterThan(x);
  });

  it('shows the firing pose at the committed release of an ordinary projectile', () => {
    const { state, arena } = rangedFight(3);
    tick(state, { arena, autoSkills: false });
    const action = arena.actions.find(entry => entry.actorId === 'archer' && entry.timing)!;
    expect(action.timing!.releaseAtUs).toBeGreaterThan(action.timing!.startedAtUs);
    expect(arenaActionPose(action, action.timing!.releaseAtUs, arena.unitsPerSec)?.phase).toBe('contact');
  });

  it('keeps the contact pose alive when a prepared mob strike actually lands', () => {
    const { state, mob, arena } = rangedFight(1, {
      line: 'front', skillIds: ['mob.physical.crushing-blow'], skillReadyAtUs: {},
    });
    tick(state, { arena, autoSkills: false });
    tick(state, { arena, autoSkills: false });
    const action = arena.actions.find(entry => entry.actorId === mob.id && entry.skillId === 'mob.physical.crushing-blow')!;
    expect(action.impactCount).toBe(1);
    expect(arenaActionPose(action, action.timing!.impactAtUs, arena.unitsPerSec)?.phase).toBe('contact');
  });

  it('prepares the first usable kit entry for its full cast time before releasing it', () => {
    const { state, mob, arena } = rangedFight(3, {
      skillIds: ['mob.physical.cleave', 'mob.cold.ice-shard'], skillReadyAtUs: {},
    });
    state.gear[0] = { slot: 'main hand', base: 'bow', ilvl: 1, quality: 'Normal', tier: 'T1', lines: [] };
    tick(state, { arena, autoSkills: false });
    const action = arena.actions.find(entry => entry.actorId === mob.id && entry.skillId === 'mob.cold.ice-shard')!;
    expect(action?.timing).toBeDefined();
    expect(action.timing!.releaseAtUs - action.timing!.startedAtUs).toBe(400_000);
    expect(state.fx.filter(event => event.kind === 'taken' && event.skillId === 'mob.cold.ice-shard')).toHaveLength(0);
    expect(mob.skillReadyAtUs?.['mob.cold.ice-shard']).toBeUndefined();
    tick(state, { arena, autoSkills: false });
    const hits = state.fx.filter(event => event.kind === 'taken' && event.skillId === 'mob.cold.ice-shard');
    expect(hits).toHaveLength(1);
    const resolved = arena.actions.find(entry => entry.id === action.id)!;
    expect(resolved.timing!.impactAtUs).toBeGreaterThan(resolved.timing!.releaseAtUs);
    expect(hits[0].atUs).toBe(resolved.timing!.impactAtUs);
    expect(shots(arena).some(shot => shot.atUs === 1_000_000)).toBe(false);
  });

  it('keeps a heavy preparation across ticks without shortening it to the first opportunity', () => {
    const { state, mob, arena } = rangedFight(1, {
      line: 'front', hitsPerSec: 2, skillIds: ['mob.physical.crushing-blow'], skillReadyAtUs: {},
    });
    tick(state, { arena, autoSkills: false });
    const action = arena.actions.find(entry => entry.actorId === mob.id && entry.skillId === 'mob.physical.crushing-blow')!;
    expect(action?.timing?.startedAtUs).toBe(500_000);
    expect(action?.timing?.releaseAtUs).toBe(1_300_000);
    expect(state.fx.filter(event => event.kind === 'taken' && event.byId === mob.id)).toHaveLength(0);
    tick(state, { arena, autoSkills: false });
    expect(state.fx.filter(event => event.kind === 'taken' && event.skillId === 'mob.physical.crushing-blow').map(event => event.atUs)).toEqual([1_300_000]);
    expect(arena.actions.filter(entry => entry.actorId === mob.id && entry.skillId === 'mob.physical.crushing-blow')).toHaveLength(1);
  });

  it('cancels a carried preparation on control without spending its strike cooldown', () => {
    const { state, mob, arena } = rangedFight(1, {
      line: 'front', hitsPerSec: 2, skillIds: ['mob.physical.crushing-blow'], skillReadyAtUs: {},
    });
    tick(state, { arena, autoSkills: false });
    const action = arena.actions.find(entry => entry.actorId === mob.id && entry.skillId === 'mob.physical.crushing-blow')!;
    state.mobStatus[mob.id] = { statuses: { shock: { stacks: 1, secLeft: 2, perSec: 0 } },
      alignedPerSec: 0, elapsedSec: 0, stoppedSec: 0, stoppedUntil: 1.5 };
    tick(state, { arena, autoSkills: false });
    expect(arena.actions.find(entry => entry.id === action.id)?.cancelledAtUs).toBeLessThanOrEqual(1_300_000);
    expect(mob.skillReadyAtUs?.['mob.physical.crushing-blow']).toBeUndefined();
    expect(state.fx.filter(event => event.kind === 'taken' && event.skillId === 'mob.physical.crushing-blow')).toHaveLength(0);
  });
  it('starts a windup, releases at its own beat, and lands at projectile contact', () => {
    const { state, arena } = rangedFight(3);
    tick(state, { arena, autoSkills: false });
    const action = arena.actions.find(entry => entry.actorId === 'archer' && entry.timing)!;
    expect(action.timing!.startedAtUs).toBe(1_000_000);
    expect(action.timing!.releaseAtUs).toBe(1_350_000);
    expect(action.releasedAtUs).toBeUndefined();
    expect(arena.mobFlights).toHaveLength(0);
    expect(state.fx.some((event) => event.kind === 'taken')).toBe(false);

    tick(state, { arena, autoSkills: false });
    const taken = state.fx.filter((event) => event.kind === 'taken' && event.byId === 'archer');
    const resolved = arena.actions.find((entry) => entry.id === action.id)!;
    expect(taken).toHaveLength(1);
    expect(resolved.releasedAtUs).toBe(1_350_000);
    expect(resolved.ranged).toBe(true);
    expect(taken[0].atUs).toBe(resolved.timing!.impactAtUs);
    expect(resolved.timing!.impactAtUs).toBeGreaterThan(resolved.timing!.releaseAtUs);
    expect(resolved.cancelledAtUs).toBeUndefined();
  });

  it('fires once per attack interval and never adds a second damage stream', () => {
    const { state, arena } = rangedFight(3);
    for (let index = 0; index < 4; index++) tick(state, { arena, autoSkills: false });
    expect(shots(arena)).toHaveLength(3);
    const taken = state.fx.filter((event) => event.kind === 'taken' && event.byId === 'archer');
    expect(taken).toHaveLength(3);
    const beats = shots(arena).map((action) => action.timing!.releaseAtUs);
    expect(beats).toEqual([1_350_000, 2_350_000, 3_350_000]);
  });

  it('cancels a shot whose release no longer has its target in reach', () => {
    const { state, mob, arena } = rangedFight(3);
    tick(state, { arena, autoSkills: false });
    const action = arena.actions.find(entry => entry.actorId === 'archer' && entry.timing)!;
    arena.player.x = 15;
    arena.intent = { skillId: 'attack.firestorm', targetId: mob.id, targetPoint: { x: 15, y: 6 },
      phase: 'windup', releaseAtUs: 10_000_000 };
    tick(state, { arena, autoSkills: true });
    expect(state.fx.filter((event) => event.kind === 'taken' && event.byId === 'archer')).toHaveLength(0);
    expect(arena.actions.find(entry => entry.id === action.id)?.cancelReason).toBe('release-invalid');
    expect(arena.mobFlights).toHaveLength(0);
  });

  it('cancels an unreleased shot when its source dies', () => {
    const { state, mob, arena } = rangedFight(3);
    tick(state, { arena, autoSkills: false });
    const action = arena.actions.find(entry => entry.actorId === 'archer' && entry.timing)!;
    mob.hp = 0;
    state.group = [];
    tick(state, { arena, autoSkills: false });
    const resolved = arena.actions.find(entry => entry.id === action.id)!;
    expect(resolved.releasedAtUs).toBeUndefined();
    expect(['source-unavailable', 'release-invalid']).toContain(resolved.cancelReason);
    expect(state.fx.filter((event) => event.kind === 'taken' && event.byId === 'archer')).toHaveLength(0);
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

  it('cancels an unreleased shot when the encounter changes', () => {
    const { state, arena } = rangedFight(3);
    tick(state, { arena, autoSkills: false });
    const action = arena.actions.find(entry => entry.actorId === 'archer' && entry.timing)!;
    state.cell = { q: 5, r: 5, sub: null, wild: null };
    tick(state, { arena, autoSkills: false });
    const resolved = arena.actions.find((entry) => entry.id === action.id)!;
    expect(resolved.cancelReason).toBe('area-exit');
    expect(arena.mobFlights.some((shot) => shot.actionId === action.id)).toBe(false);
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
    expect(state.fx.filter((event) => event.kind === 'taken')).toHaveLength(0);
    tick(state, { arena, autoSkills: false });
    expect(state.fx.filter((event) => event.kind === 'taken').length).toBe(1);
  });

  it('falls back to the ordinary shot when a ready strike is out of its role reach', () => {
    const { state, mob, arena } = rangedFight(4, { skillIds: ['mob.lightning.static-jab'], skillReadyAtUs: {} });
    arena.intent = { skillId: 'attack.firestorm', targetId: mob.id, targetPoint: { x: 1, y: 6 },
      phase: 'windup', releaseAtUs: 10_000_000 };
    tick(state, { arena, autoSkills: true });
    expect(shots(arena)).toHaveLength(0);
    tick(state, { arena, autoSkills: true });
    expect(shots(arena)).toHaveLength(1);
    const taken = state.fx.filter((event) => event.kind === 'taken');
    expect(taken).toHaveLength(1);
    expect(taken[0].skillId).toBeUndefined();
    expect(mob.skillReadyAtUs?.['mob.lightning.static-jab']).toBeUndefined();
  });

  it('spends the strike cooldown when a perfect dodge deletes the released hit', () => {
    const { state, mob, arena } = rangedFight(1.5, {
      line: 'front', skillIds: ['mob.lightning.static-jab'], skillReadyAtUs: {},
    });
    state.player.charges = 1;
    tick(state, { arena, autoSkills: false });
    tick(state, { arena, autoSkills: false });
    expect(state.player.charges).toBe(0);
    expect(state.fx.filter((event) => event.kind === 'taken' && event.byId === 'archer')).toHaveLength(0);
    expect(mob.skillReadyAtUs?.['mob.lightning.static-jab']).toBeGreaterThan(0);
  });

  it('uses the ready strike when the player is inside its role reach', () => {
    const { state, mob, arena } = rangedFight(1.5, {
      line: 'front', skillIds: ['mob.lightning.static-jab'], skillReadyAtUs: {},
    });
    arena.intent = { skillId: 'attack.firestorm', targetId: mob.id, targetPoint: { x: 1, y: 6 },
      phase: 'windup', releaseAtUs: 10_000_000 };
    tick(state, { arena, autoSkills: true });
    expect(shots(arena)).toHaveLength(0);
    expect(arena.mobFlights).toHaveLength(0);
    expect(mob.skillReadyAtUs?.['mob.lightning.static-jab']).toBeUndefined();
    tick(state, { arena, autoSkills: true });
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
