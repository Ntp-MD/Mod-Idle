import { describe, expect, it } from 'vitest';
import {
  captureCombatArena, createCombatArena, syncCombatArena,
} from '@sim/combat/combat-arena';
import { CombatClock } from '@sim/combat/combat-clock';
import { createMobShots } from '@sim/core/tick/mob-shots';
import { mobCastProfile } from '@sim/combat/mobSkills';
import { arenaActionPose, arenaRangedShots } from '../../src/ui/combat/combat-arena-view';
import { characterSheet, newGame, setLevel, tick } from '@sim/core/game';
import { mobFixture, pinFieldPopulation } from '../fixtures/mobFixture';
import { mulberry32 } from '../../src/engine/client-helpers';

function fight(skillId: string, distance: number, over: Record<string, unknown> = {}) {
  const state = newGame(77);
  setLevel(state, 30);
  state.hunting = true;
  const mob = mobFixture({
    id: 'caster', hp: 1e9, hpMax: 1e9, ps: 1, acc: 1e9, evasion: 0, dodgeRate: 0,
    armour: 0, line: 'front', damage: 'physical', innate: [], hitsPerSec: 1, atkTimer: 0,
    skillIds: [skillId], skillReadyAtUs: {}, ...over,
  });
  state.group = [mob];
  state.skills.list.fill(null);
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 1, y: 6 });
  Object.assign(arena.mobs[mob.id], { x: 1 + distance, y: 6 });
  captureCombatArena(arena, state, 0);
  pinFieldPopulation(state);
  // The caster is already alerted; these tests measure delivery, not acquisition.
  state.field!.engagementIds = [mob.id];
  state.field!.engagementCauses = { [mob.id]: 'contact' };
  // Hold the player in place so the delivery, not the player's approach, decides the test.
  arena.intent = { skillId: 'attack.firestorm', targetId: mob.id, targetPoint: { x: 1, y: 6 },
    phase: 'windup', releaseAtUs: 10_000_000 } as never;
  return { state, mob, arena };
}

const casts = (arena: ReturnType<typeof createCombatArena>, skillId: string) =>
  arena.actions.filter((action) => action.skillId === skillId);

describe('typed mob skill delivery', () => {
  it('resolves Skull Crack only after its full melee windup at body contact', () => {
    const skillId = 'mob.physical.skull-crack';
    const { state, mob, arena } = fight(skillId, 0.6);
    const row = state.group[0].skillIds![0];
    expect(mobCastProfile({ ...mob, skillIds: [row] } as never, mob).delivery).toBe('melee');
    tick(state, { arena, autoSkills: true });
    const action = casts(arena, skillId)[0];
    expect(action.timing!.delivery).toBe('melee');
    expect(action.timing!.releaseAtUs - action.timing!.startedAtUs).toBe(600_000);
    expect(state.fx.filter((event) => event.kind === 'taken' && event.skillId === skillId)).toHaveLength(0);
    expect(mob.skillReadyAtUs?.[skillId]).toBeUndefined();

    tick(state, { arena, autoSkills: true });
    const hits = state.fx.filter((event) => event.kind === 'taken' && event.skillId === skillId);
    expect(hits).toHaveLength(1);
    expect(hits[0].atUs).toBe(action.timing!.releaseAtUs);
    expect(mob.skillReadyAtUs?.[skillId]).toBeGreaterThan(0);
    expect(arena.actions.find((entry) => entry.id === action.id)?.impactCount).toBe(1);
  });

  it('cancels Skull Crack without a hit or cooldown when the target leaves before release', () => {
    const skillId = 'mob.physical.skull-crack';
    const { state, arena } = fight(skillId, 0.6);
    tick(state, { arena, autoSkills: true });
    const action = casts(arena, skillId)[0];
    arena.player.x = 10;
    tick(state, { arena, autoSkills: true });
    const resolved = arena.actions.find((entry) => entry.id === action.id)!;
    expect(resolved.cancelReason).toBe('release-invalid');
    expect(state.fx.filter((event) => event.kind === 'taken' && event.skillId === skillId)).toHaveLength(0);
  });

  it('flies Venom Spit to a committed endpoint and applies damage only at contact', () => {
    const skillId = 'mob.poison.venom-spit';
    const { state, mob, arena } = fight(skillId, 3, { line: 'stand-off' });
    tick(state, { arena, autoSkills: true });
    const action = casts(arena, skillId)[0];
    expect(action.timing!.delivery).toBe('projectile');
    expect(state.fx.filter((event) => event.kind === 'taken' && event.skillId === skillId)).toHaveLength(0);

    tick(state, { arena, autoSkills: true });
    const hits = state.fx.filter((event) => event.kind === 'taken' && event.skillId === skillId);
    const resolved = arena.actions.find((entry) => entry.id === action.id)!;
    expect(hits).toHaveLength(1);
    expect(hits[0].atUs).toBe(resolved.timing!.impactAtUs);
    expect(resolved.timing!.impactAtUs).toBeGreaterThan(resolved.timing!.releaseAtUs);
    expect(mob.skillReadyAtUs?.[skillId]).toBeGreaterThan(0);
  });

  it('lets Venom Spit miss when the player keeps moving after the release', () => {
    const skillId = 'mob.poison.venom-spit';
    const { state, arena } = fight(skillId, 3, { line: 'stand-off' });
    tick(state, { arena, autoSkills: true });
    tick(state, { arena, autoSkills: false, manual: { moveTo: { x: 1, y: 11 } } });
    expect(state.fx.filter((event) => event.kind === 'taken' && event.skillId === skillId)).toHaveLength(0);
  });

  it('drives the presentation adapter with the same delivery/timing for all three references', () => {
    const melee = fight('mob.physical.skull-crack', 0.6);
    tick(melee.state, { arena: melee.arena, autoSkills: true });
    const meleeAction = casts(melee.arena, 'mob.physical.skull-crack')[0];
    expect(arenaActionPose(meleeAction, meleeAction.timing!.startedAtUs + 100_000,
      melee.arena.unitsPerSec)?.phase).toBe('windup');
    expect(arenaActionPose(meleeAction, meleeAction.timing!.releaseAtUs,
      melee.arena.unitsPerSec)?.phase).toBe('contact');

    const spit = fight('mob.poison.venom-spit', 3, { line: 'stand-off' });
    tick(spit.state, { arena: spit.arena, autoSkills: true });
    tick(spit.state, { arena: spit.arena, autoSkills: true });
    const spitAction = casts(spit.arena, 'mob.poison.venom-spit')[0];
    expect(spitAction.ranged).toBe(true);
    expect(arenaRangedShots(spit.arena, spitAction.timing!.releaseAtUs + 1)
      .some((shot) => shot.id === spitAction.id)).toBe(true);

    const ground = fight('mob.earth.boulder-toss', 3.5, { line: 'stand-off' });
    tick(ground.state, { arena: ground.arena, autoSkills: true });
    tick(ground.state, { arena: ground.arena, autoSkills: true });
    const groundAction = casts(ground.arena, 'mob.earth.boulder-toss')[0];
    expect(groundAction.area?.radiusM).toBe(1.5);
    expect(arenaActionPose(groundAction, groundAction.timing!.releaseAtUs,
      ground.arena.unitsPerSec)?.phase).toBe('contact');
  });

  it('commits Boulder Toss to the ground point and resolves only bodies still inside at impact', () => {
    const skillId = 'mob.earth.boulder-toss';
    const { state, arena } = fight(skillId, 3.5, { line: 'stand-off' });
    state.autoAvoidOff = true;
    tick(state, { arena, autoSkills: true });
    const action = casts(arena, skillId)[0];
    expect(action.timing!.delivery).toBe('ground');
    expect(action.area).toBeUndefined();
    tick(state, { arena, autoSkills: true });
    const released = arena.actions.find((entry) => entry.id === action.id)!;
    expect(released.area?.radiusM).toBe(1.5);
    expect(released.releasedAtUs).toBeDefined();
    expect(state.fx.filter((event) => event.kind === 'taken' && event.skillId === skillId)).toHaveLength(0);
    expect(released.timing!.impactAtUs).toBeGreaterThan(released.timing!.releaseAtUs);

    tick(state, { arena, autoSkills: true });
    const hits = state.fx.filter((event) => event.kind === 'taken' && event.skillId === skillId);
    expect(hits).toHaveLength(1);
    const resolved = arena.actions.find((entry) => entry.id === action.id)!;
    expect(hits[0].atUs).toBe(resolved.timing!.impactAtUs);

    const dodge = fight(skillId, 3.5, { line: 'stand-off' });
    tick(dodge.state, { arena: dodge.arena, autoSkills: true });
    tick(dodge.state, { arena: dodge.arena, autoSkills: true });
    dodge.arena.player.x = 12;
    tick(dodge.state, { arena: dodge.arena, autoSkills: true });
    expect(dodge.state.fx.filter((event) => event.kind === 'taken' && event.skillId === skillId)).toHaveLength(0);
  });
});

describe('F20 time-of-impact — the receipt carries the crossing beat', () => {
  it('stamps a mob projectile at its body crossing, not the noticing sample', () => {
    const state = newGame(78);
    setLevel(state, 30);
    state.hunting = true;
    const mob = mobFixture({
      id: 'shooter', hp: 1e9, hpMax: 1e9, ps: 1, evasion: 0, dodgeRate: 0,
      armour: 0, line: 'stand-off', damage: 'physical', innate: [], hitsPerSec: 1, atkTimer: 0,
    });
    state.group = [mob];
    state.skills.list.fill(null);
    const arena = createCombatArena();
    syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
    Object.assign(arena.player, { x: 1, y: 6 });
    Object.assign(arena.mobs[mob.id], { x: 5, y: 6 });
    captureCombatArena(arena, state, 0);
    pinFieldPopulation(state);
    const clock = new CombatClock(0, 2_000_000, () => false);
    const { launchMobShot, sweepMobShots } = createMobShots({
      arena, clock, rng: mulberry32(3), s: state,
      tickStartUs: 0, tickEndUs: 2_000_000, units: 1_000_000, resolveIncomingHit: () => {},
    });
    launchMobShot(mob, 0);
    const shot = arena.mobFlights[0];
    expect(shot).toBeDefined();
    // Sweep once with the head already past the player's edge: the old code stamps this
    // sample, the crossing beat lands strictly inside the segment.
    const atUs = shot.releaseAtUs + Math.floor((shot.impactAtUs - shot.releaseAtUs) * 0.9);
    sweepMobShots(atUs);
    const action = arena.actions.find((entry) => entry.id === shot.actionId)!;
    expect(action.timing!.impactAtUs).toBeGreaterThan(shot.releaseAtUs);
    expect(action.timing!.impactAtUs).toBeLessThan(atUs);
  });
});

describe('authored projectile barriers', () => {
  const barrier = {
    version: 1, bounds: { x: 0, y: 0, width: 50, height: 32 }, cellSize: 1,
    obstacles: [{ kind: 'box' as const, id: 'barrier', x: 2.5, y: 0, width: 1, height: 20,
      flags: { movement: false, sight: false, projectiles: true } }],
  };
  const skillId = 'mob.fire.ember-lash';

  it('lands on the player when no barrier is authored', () => {
    const { state, arena } = fight(skillId, 4.5);
    for (let index = 0; index < 6; index++) tick(state, { arena, autoSkills: false });
    expect(state.fx.filter((event) => event.kind === 'taken' && event.skillId === skillId)).toHaveLength(1);
  });

  it('stops a projectile at the barrier instead of reaching the player', () => {
    const { state, arena } = fight(skillId, 4.5);
    arena.nav = barrier;
    for (let index = 0; index < 6; index++) tick(state, { arena, autoSkills: false });
    expect(state.fx.filter((event) => event.kind === 'taken' && event.skillId === skillId)).toHaveLength(0);
    expect(arena.mobFlights).toHaveLength(0);
  });
});
