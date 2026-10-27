import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/engine/client-helpers';
import { sm } from '../src/engine/client';
import { captureCombatArena, createCombatArena, syncCombatArena } from '../src/sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '../src/sim/core/game';
import { restorePendingWork } from '../src/sim/core/pending-work';
import { prepareSkillCast, resolvePreparedCast, newCastRollCache } from '../src/sim/combat/skills';
import type { ManualControl } from '../src/sim/combat/combat-actions';
import { exportJson, importJson } from '../src/state/save';
import { pinFieldPopulation } from './mobFixture';
import { mobSkillById } from '../src/sim/combat/mobSkills';

function skillFight(skillId: string, distance = 2) {
  const state = newGame(41);
  setLevel(state, 30);
  state.hunting = true;
  const mob = spawnMob(mulberry32(23), 1, 'normal');
  Object.assign(mob, {
    id: 'multi-target', hp: 1e9, hpMax: 1e9, ps: 1, evasion: 0, dodgeRate: 0,
    armour: 0, line: 'front', damage: 'physical', innate: [], skillIds: [],
  });
  state.group = [mob];
  state.skills.owned[skillId] = 0;
  state.skills.list.fill(null);
  state.skills.list[0] = skillId;
  state.player.mana = characterSheet(state).maxMana;
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 1, y: 6 });
  Object.assign(arena.mobs[mob.id], { x: 1 + distance, y: 6 });
  captureCombatArena(arena, state, 0);
  pinFieldPopulation(state);
  return { state, mob, arena };
}

function controlDamage(skillId: string, distance = 2) {
  const { state, mob } = skillFight(skillId, distance);
  const c = characterSheet(state);
  const area = { origin: 'target' as const, radiusM: sm.byId[skillId].area?.radius_m ?? 0,
    center: { x: 1 + distance, y: 6 }, targetId: mob.id };
  const prepared = prepareSkillCast(state.skills, c, skillId, c.maxMana, [mob],
    state.playerStatuses, { spatialTargets: true }, area)!;
  const report = resolvePreparedCast(state.skills, c, prepared, state.playerStatuses,
    mulberry32(state.rngState), { spatialTargets: true, mobStatus: state.mobStatus, curses: state.curses });
  return report.dealt ?? 0;
}

describe('real multi-hit impacts', () => {
  it('does not sweep a later burst projectile before its own release at point-blank range', () => {
    const { state, arena } = skillFight('attack.ice_lance', .52);
    tick(state, { arena });
    const action = arena.actions.find(entry => entry.skillId === 'attack.ice_lance')!;
    expect(action.payloads).toHaveLength(2);
    for (const payload of action.payloads!) {
      expect(payload.impactAtUs).toBeDefined();
      expect(payload.impactAtUs!).toBeGreaterThanOrEqual(payload.releaseAtUs);
    }
    const hits = state.fx.filter(event => event.kind === 'hit' && event.actionId === action.id)
      .sort((a, b) => a.atUs! - b.atUs!);
    expect(hits).toHaveLength(2);
    expect(hits[1].atUs! - hits[0].atUs!).toBeGreaterThanOrEqual(100_000);
  });
  it('lands Overload as two scheduled half-shares without doubling the press', () => {
    const { state, mob, arena } = skillFight('attack.overload', 3);
    const control = controlDamage('attack.overload', 3);
    tick(state, { arena });
    tick(state, { arena });
    const cast = arena.actions.find((action) => action.skillId === 'attack.overload')!;
    const hits = state.fx.filter((event) => event.kind === 'hit' && event.actionId === cast.id)
      .sort((a, b) => (a.atUs ?? 0) - (b.atUs ?? 0));
    expect(hits).toHaveLength(2);
    expect(hits[1].atUs! - hits[0].atUs!).toBe(300_000);
    const total = hits.reduce((sum, hit) => sum + (hit.value ?? 0), 0);
    expect(total).toBeGreaterThan(control * 0.98);
    expect(total).toBeLessThan(control * 1.02);
    expect(hits[0].crit).toBe(hits[1].crit);
    expect(mob.hp).toBeLessThan(mob.hpMax);
  });

  it('lands Ice Lance as two projectiles with one cast-level effect receipt', () => {
    const { state, mob, arena } = skillFight('attack.ice_lance', 1.2);
    const control = controlDamage('attack.ice_lance', 1.2);
    tick(state, { arena });
    tick(state, { arena });
    const cast = arena.actions.find((action) => action.skillId === 'attack.ice_lance')!;
    const hits = state.fx.filter((event) => event.kind === 'hit' && event.actionId === cast.id)
      .sort((a, b) => (a.atUs ?? 0) - (b.atUs ?? 0));
    expect(hits).toHaveLength(2);
    expect(hits[1].atUs! - hits[0].atUs!).toBeGreaterThanOrEqual(150_000);
    expect(cast.payloads).toHaveLength(2);
    expect(cast.payloads![1].releaseAtUs - cast.payloads![0].releaseAtUs).toBe(150_000);
    expect(cast.payloads!.map(payload => payload.index)).toEqual([0, 1]);
    expect(state.mobStatus[mob.id]?.statuses.chill?.stacks).toBe(1);
    const total = hits.reduce((sum, hit) => sum + (hit.value ?? 0), 0);
    expect(total).toBeGreaterThan(control * 0.98);
    expect(total).toBeLessThan(control * 1.02);
    expect(mob.hp).toBeLessThan(mob.hpMax);
  });

  it('lands Whirlwind as three caster pulses while the primary action stays mobile', () => {
    const { state, mob, arena } = skillFight('attack.whirlwind', 0.6);
    tick(state, { arena });
    tick(state, { arena });
    const cast = arena.actions.find((action) => action.skillId === 'attack.whirlwind')!;
    const hits = state.fx.filter((event) => event.kind === 'hit' && event.actionId === cast.id)
      .sort((a, b) => (a.atUs ?? 0) - (b.atUs ?? 0));
    expect(hits).toHaveLength(3);
    expect(hits.map((hit) => hit.atUs)).toEqual([580_000, 980_000, 1_380_000]);
    expect(mob.hp).toBeLessThan(mob.hpMax);
    tick(state, { arena });
    expect(state.fx.filter((event) => event.kind === 'hit' && event.actionId === cast.id)).toHaveLength(3);
  });

  it('keeps the pending second Overload pulse and its cached rolls through a reload', () => {    const control = controlDamage('attack.overload', 3);
    const { state, arena } = skillFight('attack.overload', 3);
    tick(state, { arena });
    const cast = arena.actions.find((action) => action.skillId === 'attack.overload')!;
    expect(state.fx.filter((event) => event.kind === 'hit' && event.actionId === cast.id)).toHaveLength(1);
    const loaded = importJson(exportJson(state));
    expect(loaded.pendingWork?.flights).toHaveLength(1);
    const fresh = createCombatArena();
    syncCombatArena(fresh, loaded, loaded.clockSec * 1_000_000, 1_000_000, characterSheet(loaded).maxHp);
    expect(restorePendingWork(fresh, loaded)).toBe(1);
    tick(loaded, { arena: fresh });
    const hits = loaded.fx.filter((event) => event.kind === 'hit' && event.actionId === cast.id)
      .sort((a, b) => (a.atUs ?? 0) - (b.atUs ?? 0));
    expect(hits).toHaveLength(2);
    expect(hits[0].crit).toBe(hits[1].crit);
    const total = hits.reduce((sum, hit) => sum + (hit.value ?? 0), 0);
    expect(total).toBeGreaterThan(control * 0.98);
    expect(total).toBeLessThan(control * 1.02);
    tick(loaded, { arena: fresh });
    expect(loaded.fx.filter((event) => event.kind === 'hit' && event.actionId === cast.id)).toHaveLength(2);
  });
  it('lets a body that enters between pulses take only the later eligible pulse', () => {
    const { state, mob, arena } = skillFight('attack.overload', 3);
    tick(state, { arena });
    const cast = arena.actions.find((action) => action.skillId === 'attack.overload')!;
    const second = spawnMob(mulberry32(77), 1, 'normal');
    Object.assign(second, {
      id: 'late-body', hp: 1e9, hpMax: 1e9, ps: 1, evasion: 0, dodgeRate: 0,
      armour: 0, line: 'front', damage: 'physical', innate: [], skillIds: [],
    });
    state.group.push(second);
    syncCombatArena(arena, state, 1_000_000, 1_000_000, characterSheet(state).maxHp);
    Object.assign(arena.mobs[second.id], { x: 3.2, y: 6 });
    tick(state, { arena });
    const lateHits = state.fx.filter((event) => event.kind === 'hit'
      && event.actionId === cast.id && event.mobId === second.id);
    expect(lateHits).toHaveLength(1);
    expect(state.fx.filter((event) => event.kind === 'hit'
      && event.actionId === cast.id && event.mobId === mob.id)).toHaveLength(2);
  });
  it('deploys Blizzard as twenty fixed-field pulses and resumes them after a reload', () => {
    const control = controlDamage('attack.blizzard', 2.5);
    const { state, mob, arena } = skillFight('attack.blizzard', 2.5);
    mob.line = 'stand-off';
    tick(state, { arena });
    const cast = arena.actions.find((action) => action.skillId === 'attack.blizzard')!;
    expect(cast.impactCount).toBe(1);
    expect(state.mobStatus[mob.id]?.statuses.chill).toBeDefined();
    const loaded = importJson(exportJson(state));
    expect(loaded.pendingWork?.flights.length).toBe(19);
    const fresh = createCombatArena();
    syncCombatArena(fresh, loaded, loaded.clockSec * 1_000_000, 1_000_000, characterSheet(loaded).maxHp);
    expect(restorePendingWork(fresh, loaded)).toBe(19);
    for (let index = 0; index < 8; index++) tick(loaded, { arena: fresh });
    const resolved = fresh.actions.find((action) => action.id === cast.id)!;
    expect(resolved.impactCount).toBe(20);
    expect(loaded.pendingWork).toBeNull();
    const castDamage = loaded.counters.damageBy?.cast ?? 0;
    expect(castDamage).toBeGreaterThan(control * 0.95);
    expect(castDamage).toBeLessThan(control * 1.05);
  });
  it('converts Sand Storm into one direct press plus one-second field pulses', () => {
    const { state, mob, arena } = skillFight('attack.sand_storm', 2.5);
    mob.line = 'stand-off';
    for (let index = 0; index < 6; index++) tick(state, { arena });
    expect(state.curses[mob.id]?.field_presence).toBeDefined();
    for (let index = 0; index < 6; index++) tick(state, { arena });
    const cast = arena.actions.find((action) => action.skillId === 'attack.sand_storm')!;
    expect(cast.impactCount).toBe(11);
    expect(state.mobStatus[mob.id]?.statuses.erosion).toBeUndefined();
    expect(state.counters.damageBy?.cast ?? 0).toBeGreaterThan(0);
    for (let index = 0; index < 3; index++) tick(state, { arena, autoSkills: false });
    expect(state.curses[mob.id]?.field_presence).toBeUndefined();
  });

  it('replaces a deployed Blizzard on a deliberate recast and cancels only its unspent pulses', () => {
    const { state, arena } = skillFight('attack.blizzard', 2.5);
    tick(state, { arena });
    const first = arena.actions.find((action) => action.skillId === 'attack.blizzard')!;
    expect(first.impactCount).toBe(1);
    state.skills.cd['attack.blizzard'] = 0;
    state.player.mana = characterSheet(state).maxMana;
    const manual: ManualControl = { cast: { skillId: 'attack.blizzard' } };
    tick(state, { arena, autoSkills: false, manual });
    tick(state, { arena, autoSkills: false });
    const casts = arena.actions.filter((action) => action.skillId === 'attack.blizzard');
    expect(casts.length).toBeGreaterThanOrEqual(2);
    expect(casts[0].cancelReason).toBe('replaced');
    const replacement = casts.at(-1)!;
    expect(replacement.cancelledAtUs).toBeUndefined();
    expect(arena.flights.every((flight) => flight.actionId === replacement.id)).toBe(true);
  });

  it('keeps a useful deployed field instead of replacing it from the automatic rotation', () => {
    const { state, arena } = skillFight('attack.blizzard', 2.5);
    tick(state, { arena });
    const first = arena.actions.find((action) => action.skillId === 'attack.blizzard')!;
    state.skills.cd['attack.blizzard'] = 0;
    state.player.mana = characterSheet(state).maxMana;
    for (let index = 0; index < 3; index++) tick(state, { arena });
    expect(arena.actions.filter((action) => action.skillId === 'attack.blizzard')).toHaveLength(1);
    expect(arena.actions.find((action) => action.id === first.id)?.cancelReason).toBeUndefined();
  });

  it('lets a new body entering the deployed area take later Blizzard pulses', () => {
    const { state, arena } = skillFight('attack.blizzard', 2.5);
    tick(state, { arena });
    const cast = arena.actions.find((action) => action.skillId === 'attack.blizzard')!;
    const late = spawnMob(mulberry32(91), 1, 'normal');
    Object.assign(late, {
      id: 'blizzard-late', hp: 1e9, hpMax: 1e9, ps: 1, evasion: 0, dodgeRate: 0,
      armour: 0, line: 'front', damage: 'physical', innate: [], skillIds: [],
    });
    state.group.push(late);
    syncCombatArena(arena, state, 1_000_000, 1_000_000, characterSheet(state).maxHp);
    Object.assign(arena.mobs[late.id], { x: 2.2, y: 6 });
    tick(state, { arena });
    expect(arena.actions.find((action) => action.id === cast.id)?.hitIds).toContain(late.id);
  });
  it('chains Chain Lightning to the nearest unused body at 0.08s hops', () => {
    const { state, arena } = skillFight('attack.chain_lightning', 2);
    const extras = [
      { id: 'chain-2', x: 4.5, y: 6 }, { id: 'chain-3', x: 5.5, y: 6 }, { id: 'chain-far', x: 10.5, y: 6 },
    ];
    for (const [index, spot] of extras.entries()) {
      const mob = spawnMob(mulberry32(120 + index), 1, 'normal');
      Object.assign(mob, {
        id: spot.id, hp: 1e9, hpMax: 1e9, ps: 1, evasion: 0, dodgeRate: 0,
        armour: 0, line: 'front', damage: 'physical', innate: [], skillIds: [],
      });
      state.group.push(mob);
    }
    syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
    for (const spot of extras) Object.assign(arena.mobs[spot.id], { x: spot.x, y: spot.y });
    tick(state, { arena });
    const cast = arena.actions.find((action) => action.skillId === 'attack.chain_lightning')!;
    const hits = state.fx.filter((event) => event.kind === 'hit' && event.actionId === cast.id)
      .sort((a, b) => (a.atUs ?? 0) - (b.atUs ?? 0));
    expect(hits.map((hit) => hit.mobId)).toEqual(['multi-target', 'chain-2', 'chain-3']);
    expect(hits[1].atUs! - hits[0].atUs!).toBe(80_000);
    expect(hits[2].atUs! - hits[1].atUs!).toBe(80_000);
    expect(hits[0].value!).toBeGreaterThan(hits[1].value!);
    expect(hits.every((hit) => hit.mobId !== 'chain-far')).toBe(true);
    for (const id of ['multi-target', 'chain-2', 'chain-3'])
      expect(state.mobStatus[id]?.statuses.shock).toBeDefined();
  });
  it('spreads Catalyst poison to the nearest bodies inside 3m before consuming the primary', () => {
    const { state, arena } = skillFight('attack.catalyst', 2);
    const near = spawnMob(mulberry32(140), 1, 'normal');
    const far = spawnMob(mulberry32(141), 1, 'normal');
    Object.assign(near, {
      id: 'catalyst-near', hp: 1e9, hpMax: 1e9, ps: 1, evasion: 0, dodgeRate: 0,
      armour: 0, line: 'front', damage: 'physical', innate: [], skillIds: [],
    });
    Object.assign(far, {
      id: 'catalyst-far', hp: 1e9, hpMax: 1e9, ps: 1, evasion: 0, dodgeRate: 0,
      armour: 0, line: 'front', damage: 'physical', innate: [], skillIds: [],
    });
    state.group.push(near, far);
    state.mobStatus[state.group[0].id] = {
      statuses: { poison: { stacks: 5, secLeft: 10, perSec: 0 } },
      alignedPerSec: 0, elapsedSec: 0, stoppedSec: 0,
    };
    syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
    Object.assign(arena.mobs[state.group[0].id], { x: 3, y: 6 });
    Object.assign(arena.mobs[near.id], { x: 5, y: 6 });
    Object.assign(arena.mobs[far.id], { x: 8, y: 6 });
    tick(state, { arena });
    expect(state.mobStatus[near.id]?.statuses.poison?.stacks).toBeGreaterThan(0);
    expect(state.mobStatus[far.id]?.statuses.poison).toBeUndefined();
    expect(state.mobStatus[state.group[0].id]?.statuses.poison?.stacks ?? 0).toBe(0);
  });
});

describe('channel interruption', () => {
  function channelFight(atkTimer: number) {
    const { state, mob, arena } = skillFight('attack.whirlwind', 0.6);
    Object.assign(mob, {
      acc: 1e9, skillIds: ['mob.lightning.static-jab'], skillReadyAtUs: {},
      // The argument places contact; the opportunity must now include the real preparation.
      hitsPerSec: 1, atkTimer: atkTimer + mobSkillById('mob.lightning.static-jab')!.cast_sec!,
    });
    return { state, mob, arena };
  }

  it('drops every unspent Whirlwind pulse when Shock lands during the channel', () => {
    const { state, arena } = channelFight(0.5);
    tick(state, { arena });
    const cast = arena.actions.find((action) => action.skillId === 'attack.whirlwind')!;
    expect(state.fx.filter((event) => event.kind === 'hit' && event.actionId === cast.id)).toHaveLength(0);
    expect(state.skills.cd['attack.whirlwind']).toBeGreaterThan(0);
    expect(arena.flights.filter((flight) => flight.actionId === cast.id)).toHaveLength(0);
  });

  it('keeps a completed pulse when Shock lands after the first beat', () => {
    const { state, arena } = channelFight(0.3);
    tick(state, { arena });
    const cast = arena.actions.find((action) => action.skillId === 'attack.whirlwind')!;
    expect(state.fx.filter((event) => event.kind === 'hit' && event.actionId === cast.id)).toHaveLength(1);
    expect(arena.flights.filter((flight) => flight.actionId === cast.id)).toHaveLength(0);
  });
});
