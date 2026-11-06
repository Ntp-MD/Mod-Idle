import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/engine/client-helpers';
import { sm } from '../../src/engine/client';
import {
  arenaAction, captureCombatArena, createCombatArena, sampleCombatArena, syncCombatArena,
} from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import { prepareSkillCast } from '@sim/combat/skills';
import { skillCastTiming } from '@engine/skill-actions.ts';
import { skillAreaSnapshot } from '@engine/skill-area.ts';
import { pinFieldPopulation } from '../fixtures/mobFixture';
import { mobSkillById } from '@sim/combat/mobSkills';
import { liveMobSkill } from '../fixtures/liveMob';
import { liveId } from '../fixtures/liveSkill';
const GROUND_CAST = liveId(row => row.type === 'attack' && row.cast?.delivery === 'ground' && !row.action, 'ground timing');
const MELEE_CAST = liveId(row => row.type === 'attack' && row.cast?.delivery === 'melee' && row.area?.shape === 'cone' && row.basis === 'phys' && !row.action, 'melee timing');
const PROJECTILE_CAST = liveId(row => row.type === 'attack' && row.cast?.delivery === 'projectile' && !row.action, 'projectile timing');
const CONTROL = liveMobSkill(row => row.mode === 'strike' && row.cast?.delivery === 'melee' && !row.phase && row.status === 'shock' && row.cast.windup_sec < 0.5, 'control during a windup');

function arenaFight(skillId: string, distance: number) {
  const state = newGame(41);
  setLevel(state, 30);
  state.hunting = true;
  const mob = spawnMob(mulberry32(23), 1, 'normal');
  Object.assign(mob, {
    id: 'timing-target', hp: 1e8, hpMax: 1e8, ps: 1, evasion: 0, dodgeRate: 0,
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

describe('live cast timing', () => {
  it.each(['attack.meteor', GROUND_CAST])('keeps %s on its windup footprint when the target moves before release', (skillId) => {
    const { state, mob, arena } = arenaFight(skillId, 3);
    const source = { x: arena.player.x, y: arena.player.y };
    const aim = { x: arena.mobs[mob.id].x, y: arena.mobs[mob.id].y };
    const area = skillAreaSnapshot(sm.byId[skillId].area!, source, aim, mob.id);
    const timing = { ...skillCastTiming(sm.castProfileOf(sm.byId[skillId]), 0, arena.unitsPerSec, source, aim),
      releaseAtUs: 500_000, impactAtUs: 750_000, recoveryUntilUs: 1_000_000 };
    const action = arenaAction(arena, 'player', 'cast', 0, mob.id, skillId, area, timing)!;
    arena.intent = { skillId, targetId: mob.id, targetPoint: aim, phase: 'windup', actionId: action.id,
      releaseAtUs: timing.releaseAtUs, recoveryUntilUs: timing.recoveryUntilUs };
    Object.assign(arena.mobs[mob.id], { x: aim.x, y: aim.y + 1 });

    tick(state, { arena });

    const casts = state.fx.filter(event => event.kind === 'cast' && event.actionId === action.id);
    expect(casts).toHaveLength(1);
    expect(casts[0].skillOutcome!.area).toEqual(area);
    expect(arena.actions.find(entry => entry.id === action.id)!.area).toEqual(area);
    expect(Math.hypot(arena.mobs[mob.id].x - aim.x, arena.mobs[mob.id].y - aim.y)).toBeGreaterThan(.05);
  });

  it('publishes release and impact separately and does not damage before impact', () => {
    const { state, mob, arena } = arenaFight(GROUND_CAST, 3);
    const initialHp = mob.hp;
    tick(state, { arena });
    const cast = state.fx.find((event) => event.kind === 'cast' && event.skillId === GROUND_CAST)!;
    const action = arena.actions.find((entry) => entry.kind === 'cast' && entry.skillId === GROUND_CAST)!;
    expect(cast.actionId).toBe(action.id);
    expect(cast.atUs).toBe(action.timing?.releaseAtUs);
    const hit = state.fx.find((event) => event.kind === 'hit' && event.actionId === action.id)!;
    expect(hit.atUs).toBe(action.timing?.impactAtUs);
    expect(action.hitIds).toContain(mob.id);
    expect(sampleCombatArena(arena, cast.atUs!).mobs[mob.id]?.hp).toBe(initialHp);
    expect(sampleCombatArena(arena, hit.atUs!).mobs[mob.id]?.hp).toBeLessThan(initialHp);
    expect(state.skills.cd[GROUND_CAST]).toBeGreaterThan(0);
  });

  it.each(['dies', 'leaves'] as const)('releases committed ground even when its original target %s', (change) => {
    const skillId = 'attack.meteor';
    const { state, mob, arena } = arenaFight(skillId, 3);
    const other = { ...mob, id: 'ground-survivor' };
    state.group.push(other);
    syncCombatArena(arena, state, 0, arena.unitsPerSec, characterSheet(state).maxHp);
    Object.assign(arena.player, { x: 1, y: 6 });
    Object.assign(arena.mobs[other.id], { x: 4, y: 6.5 });
    const aim = { x: 4, y: 6 };
    const area = skillAreaSnapshot(sm.byId[skillId].area!, arena.player, aim, mob.id);
    const timing = { ...skillCastTiming(sm.castProfileOf(sm.byId[skillId]), 0, arena.unitsPerSec, arena.player, aim),
      releaseAtUs: 500_000, impactAtUs: 750_000, recoveryUntilUs: 1_000_000 };
    const action = arenaAction(arena, 'player', 'cast', 0, mob.id, skillId, area, timing)!;
    arena.intent = { skillId, targetId: mob.id, targetPoint: aim, phase: 'windup', actionId: action.id,
      releaseAtUs: timing.releaseAtUs, recoveryUntilUs: timing.recoveryUntilUs };
    if (change === 'dies') {
      mob.hp = 0;
      state.group = [other];
    } else {
      Object.assign(arena.mobs[mob.id], { x: 4, y: 11 });
      Object.assign(arena.mobs[other.id], { x: 1, y: 11 });
    }
    pinFieldPopulation(state);

    tick(state, { arena });

    const casts = state.fx.filter(event => event.kind === 'cast' && event.actionId === action.id);
    expect(casts).toHaveLength(1);
    expect(casts[0].skillOutcome!.area).toEqual(area);
    expect(state.skills.cd[skillId]).toBeGreaterThan(0);
    expect(arena.actions.find(entry => entry.id === action.id)!.cancelledAtUs).toBeUndefined();
  });

  it('cancels a windup without paying or starting cooldown when auto skills turn off', () => {
    const { state, arena, mob } = arenaFight(GROUND_CAST, 3);
    const profile = sm.castProfileOf(sm.byId[GROUND_CAST]);
    const area = { origin: 'target' as const, radiusM: 3, center: { x: 4, y: 6 }, targetId: mob.id };
    const timing = { ...skillCastTiming(profile, 0, 1_000_000, { x: 1, y: 6 }, area.center),
      releaseAtUs: 3_000_000, impactAtUs: 4_000_000, recoveryUntilUs: 4_500_000 };
    const action = arenaAction(arena, 'player', 'cast', 0, mob.id, GROUND_CAST, area, timing)!;
    arena.intent = { skillId: GROUND_CAST, targetId: mob.id, targetPoint: { x: 4, y: 6 },
      phase: 'windup', actionId: action.id, releaseAtUs: 3_000_000, recoveryUntilUs: 4_500_000 };
    tick(state, { arena, autoSkills: false });
    expect(arena.intent).toBeUndefined();
    expect(arena.actions.find((entry) => entry.id === action.id)?.cancelledAtUs).toBeDefined();
    expect(state.skills.cd[GROUND_CAST] || 0).toBe(0);
    expect(state.fx.some((event) => event.kind === 'cast' && event.skillId === GROUND_CAST)).toBe(false);
  });

  it('lands a projectile after its release rather than on the cast beat', () => {
    const { state, mob, arena } = arenaFight(PROJECTILE_CAST, 3);
    tick(state, { arena });
    const cast = state.fx.find((event) => event.kind === 'cast' && event.skillId === PROJECTILE_CAST)!;
    const action = arena.actions.find((entry) => entry.kind === 'cast' && entry.skillId === PROJECTILE_CAST)!;
    const hit = state.fx.find((event) => event.kind === 'hit' && event.actionId === action.id)!;
    expect(hit.atUs).toBeGreaterThan(cast.atUs!);
    expect(hit.atUs).toBe(action.timing?.impactAtUs);
    expect(mob.hp).toBeLessThan(mob.hpMax);
    expect(arena.flights).toHaveLength(0);
  });

  it('resolves a melee cast on its release beat', () => {
    const { state, mob, arena } = arenaFight(MELEE_CAST, 2);
    state.gear[0] = { slot: 'main hand', base: 'one-handed axe', ilvl: 1, quality: 'Normal', tier: 'T1', lines: [] };
    tick(state, { arena });
    const cast = state.fx.find((event) => event.kind === 'cast' && event.skillId === MELEE_CAST)!;
    const action = arena.actions.find((entry) => entry.kind === 'cast' && entry.skillId === MELEE_CAST)!;
    const hit = state.fx.find((event) => event.kind === 'hit' && event.actionId === action.id)!;
    expect(hit.atUs).toBe(cast.atUs);
    expect(hit.atUs).toBe(action.timing?.impactAtUs);
    expect(action.hitIds).toContain(mob.id);
  });

  it('launches a live trigger cast without taking over the primary action', () => {
    const { state, mob, arena } = arenaFight(MELEE_CAST, 2);
    state.gear[0] = {
      slot: 'main hand', base: 'one-handed axe', ilvl: 1, quality: 'Normal', tier: 'T1',
      lines: [{ id: 'critical_chance', value: 100 }],
    };
    state.skills.list = [MELEE_CAST, PROJECTILE_CAST];
    state.skills.owned[MELEE_CAST] = 0;
    state.skills.owned[PROJECTILE_CAST] = 0;
    state.skills.owned['aura.cast_on_crit'] = 0;
    state.skills.auras['aura.cast_on_crit'] = true;
    mob.hp = mob.hpMax = 1e9;
    mob.ps = 0;
    mob.evasion = 0;
    mob.dodgeRate = 0;
    state.player.mana = characterSheet(state).maxMana;
    tick(state, { arena });
    const trigger = arena.actions.find((action) => action.kind === 'cast'
      && action.skillId === PROJECTILE_CAST && action.timing?.releaseAtUs === action.atUs)!;
    expect(trigger).toBeTruthy();
    expect(trigger.atUs).toBe(arena.actions.find((action) => action.skillId === MELEE_CAST)!.timing!.impactAtUs);
    expect(trigger.timing!.recoveryUntilUs).toBe(trigger.atUs);
    expect(arena.player.action?.id).not.toBe(trigger.id);
    expect(arena.player.action!.timing!.releaseAtUs).toBeGreaterThan(arena.player.action!.atUs);
    expect(state.skills.cd['aura.cast_on_crit']).toBeGreaterThan(0);
    expect(state.fx.filter((event) => event.kind === 'cast' && event.actionId === trigger.id)).toHaveLength(1);
    expect(state.fx.filter((event) => event.kind === 'hit' && event.actionId === trigger.id)).toHaveLength(1);
  });

  it('commits a ground centre and reads enter and leave at impact', () => {
    const { state, mob, arena } = arenaFight(GROUND_CAST, 3);
    const second = spawnMob(mulberry32(7), state.zone, 'normal');
    second.hp = second.hpMax = 1e9;
    second.ps = 0;
    state.group.push(second);
    const c = characterSheet(state);
    const center = { x: arena.mobs[mob.id].x, y: arena.mobs[mob.id].y };
    const area = { origin: 'target' as const, radiusM: 3, center, targetId: mob.id };
    const prepared = prepareSkillCast(state.skills, c, GROUND_CAST, c.maxMana, [mob],
      state.playerStatuses, { spatialTargets: true }, area)!;
    const profile = sm.castProfileOf(sm.byId[GROUND_CAST]);
    const timing = { ...skillCastTiming(profile, 0, 1_000_000, arena.player, center), impactAtUs: 1_500_000 };
    arena.flights.push({
      actionId: 997, cast: prepared, character: c, modifiers: {}, profile, timing,
      source: { x: arena.player.x, y: arena.player.y }, destination: { ...center },
      area, position: { x: arena.player.x, y: arena.player.y }, lastCheckedAtUs: 0,
    });
    tick(state, { arena, autoSkills: false });
    arena.mobs[mob.id].x = 9;
    arena.mobs[second.id].x = center.x;
    arena.mobs[second.id].y = center.y;
    tick(state, { arena, autoSkills: false });
    expect(state.fx.filter((event) => event.kind === 'hit' && event.actionId === 997).map((event) => event.mobId))
      .toEqual([second.id]);
  });

  it('re-tests melee range at impact and misses a target that left', () => {
    const { state, mob, arena } = arenaFight(MELEE_CAST, 2);
    state.gear[0] = {
      slot: 'main hand', base: 'one-handed axe', ilvl: 1, quality: 'Normal', tier: 'T1', lines: [],
    };
    const c = characterSheet(state);
    const center = { x: arena.player.x, y: arena.player.y };
    const area = { origin: 'caster' as const, radiusM: 2.1, center, targetId: mob.id };
    const prepared = prepareSkillCast(state.skills, c, MELEE_CAST, c.maxMana, [mob],
      state.playerStatuses, { spatialTargets: true }, area)!;
    const profile = sm.castProfileOf(sm.byId[MELEE_CAST]);
    const timing = { ...skillCastTiming(profile, 0, 1_000_000, center, center), impactAtUs: 1_500_000 };
    arena.flights.push({
      actionId: 998, cast: prepared, character: c, modifiers: {}, profile, timing,
      source: { ...center }, destination: { ...center },
      area, position: { ...center }, lastCheckedAtUs: 0,
    });
    tick(state, { arena, autoSkills: false });
    arena.mobs[mob.id].x = 9;
    tick(state, { arena, autoSkills: false });
    expect(state.fx.filter((event) => event.kind === 'hit' && event.actionId === 998)).toHaveLength(0);
  });

  it('cancels an unpaid windup at the shock timestamp rather than at the next sample', () => {
    const { state, mob, arena } = arenaFight(PROJECTILE_CAST, 3);
    // Keep Shock contact at .52s; its selected mob skill now performs its full preparation.
    const prepareAtUs = 520_000 - Math.ceil(mobSkillById(CONTROL.id)!.cast_sec! * 1_000_000);
    Object.assign(mob, { hitsPerSec: 2, atkTimer: 1 - prepareAtUs / 1_000_000 * 2, acc: 1e12, ps: 5,
      skillIds: [CONTROL.id], skillReadyAtUs: {} });
    Object.assign(arena.mobs[mob.id], { x: 1.6, y: 6 });
    const profile = sm.castProfileOf(sm.byId[PROJECTILE_CAST]);
    const area = { origin: 'target' as const, radiusM: 0,
      center: { x: 1.6, y: 6 }, targetId: mob.id };
    const timing = { ...skillCastTiming(profile, 0, 1_000_000, { x: 1, y: 6 }, area.center),
      releaseAtUs: 530_000, impactAtUs: 1_000_000, recoveryUntilUs: 800_000 };
    const action = arenaAction(arena, 'player', 'cast', 0, mob.id, PROJECTILE_CAST, area, timing)!;
    arena.intent = { skillId: PROJECTILE_CAST, targetId: mob.id, targetPoint: { x: 1.6, y: 6 },
      phase: 'windup', actionId: action.id, releaseAtUs: 530_000, recoveryUntilUs: 800_000 };
    tick(state, { arena });
    expect(state.playerStatuses.shock?.secLeft ?? 0).toBeGreaterThan(0);
    expect(state.fx.some((event) => event.kind === 'cast' && event.actionId === action.id)).toBe(false);
    const resolved = arena.actions.find((entry) => entry.id === action.id)!;
    expect(resolved.cancelledAtUs).toBe(520_000);
    expect(resolved.cancelReason).toBe('shock');
    expect(state.skills.cd[PROJECTILE_CAST] || 0).toBe(0);
    expect(state.player.mana).toBe(characterSheet(state).maxMana);
  });

  it('recomputes released travel from the release aim instead of the windup snapshot', () => {
    const { state, mob, arena } = arenaFight(PROJECTILE_CAST, 3);
    const profile = sm.castProfileOf(sm.byId[PROJECTILE_CAST]);
    const source = { x: arena.player.x, y: arena.player.y };
    const windupArea = { origin: 'target' as const, radiusM: 0,
      center: { x: arena.mobs[mob.id].x, y: arena.mobs[mob.id].y }, targetId: mob.id };
    const windupTiming = skillCastTiming(profile, 0, 1_000_000, source, windupArea.center);
    const action = arenaAction(arena, 'player', 'cast', 0, mob.id, PROJECTILE_CAST, windupArea, windupTiming)!;
    arena.intent = { skillId: PROJECTILE_CAST, targetId: mob.id, targetPoint: { ...windupArea.center },
      phase: 'windup', actionId: action.id, releaseAtUs: windupTiming.releaseAtUs,
      recoveryUntilUs: windupTiming.recoveryUntilUs };
    tick(state, { arena });
    const cast = state.fx.find((event) => event.kind === 'cast' && event.actionId === action.id)!;
    const released = cast.castTiming!;
    const releaseAim = cast.skillOutcome!.area!.center;
    const resolved = arena.actions.find((entry) => entry.id === action.id)!;
    expect(released.releaseAtUs).toBe(windupTiming.releaseAtUs);
    expect(released.startedAtUs).toBe(0);
    const liveDistance = Math.hypot(releaseAim.x - action.x, releaseAim.y - action.y);
    expect(released.impactAtUs).toBe(released.releaseAtUs
      + Math.ceil(liveDistance / profile.projectile_speed_mps * arena.unitsPerSec));
    // The body closed in during the windup: reusing the windup distance would land later than this.
    expect(released.impactAtUs).not.toBe(windupTiming.impactAtUs);
    expect(Math.hypot(releaseAim.x - windupArea.center.x, releaseAim.y - windupArea.center.y))
      .toBeGreaterThan(.05);
    expect(resolved.timing?.releaseAtUs).toBe(released.releaseAtUs);
    const hit = state.fx.find((event) => event.kind === 'hit' && event.actionId === action.id)!;
    expect(hit.atUs).toBe(resolved.timing?.impactAtUs);
    expect(resolved.timing!.impactAtUs).toBeLessThanOrEqual(released.impactAtUs);
  });

  it('records the intercepting body and contact point as the resolved action facts', () => {
    const { state, mob, arena } = arenaFight(PROJECTILE_CAST, 3);
    const blocker = spawnMob(mulberry32(29), 1, 'normal');
    Object.assign(blocker, {
      id: 'timing-blocker', hp: 1e8, hpMax: 1e8, ps: 0, evasion: 0, dodgeRate: 0,
      armour: 0, line: 'stand-off', damage: 'physical', innate: [], skillIds: [],
    });
    state.group.push(blocker);
    const c = characterSheet(state);
    syncCombatArena(arena, state, 0, 1_000_000, c.maxHp);
    Object.assign(arena.player, { x: 1, y: 6 });
    Object.assign(arena.mobs[mob.id], { x: 9, y: 6 });
    Object.assign(arena.mobs[blocker.id], { x: 4.5, y: 6 });
    captureCombatArena(arena, state, 0);
    const area = { origin: 'target' as const, radiusM: 0, center: { x: 9, y: 6 }, targetId: mob.id };
    const prepared = prepareSkillCast(state.skills, c, PROJECTILE_CAST, c.maxMana, [mob],
      state.playerStatuses, { spatialTargets: true }, area)!;
    const profile = sm.castProfileOf(sm.byId[PROJECTILE_CAST]);
    const timing = { ...skillCastTiming(profile, 0, 1_000_000, { x: 1, y: 6 }, { x: 9, y: 6 }),
      impactAtUs: 900_000 };
    const action = arenaAction(arena, 'player', 'cast', 0, mob.id, PROJECTILE_CAST, area, timing)!;
    arena.flights.push({
      actionId: action.id, cast: prepared, character: c, modifiers: {}, profile, timing,
      source: { x: 1, y: 6 }, destination: { x: 9, y: 6 },
      area, position: { x: 1, y: 6 }, lastCheckedAtUs: 0,
    });
    tick(state, { arena, autoSkills: false });
    const hits = state.fx.filter((event) => event.kind === 'hit' && event.actionId === action.id);
    const resolved = arena.actions.find((entry) => entry.id === action.id)!;
    expect(hits).toHaveLength(1);
    expect(hits[0].mobId).toBe(blocker.id);
    expect(resolved.targetId).toBe(blocker.id);
    expect(hits[0].atUs).toBe(resolved.timing?.impactAtUs);
    expect(hits[0].atUs).toBeLessThan(timing.impactAtUs);
    expect(resolved.targetX).toBeDefined();
    expect(resolved.targetX!).toBeGreaterThan(1);
    expect(resolved.targetX!).toBeLessThan(4.5);
    expect(resolved.area?.center).toEqual({ x: resolved.targetX, y: resolved.targetY });
    expect(mob.hp).toBe(mob.hpMax);
  });

  it('resolves a released flight on the next world tick and only once', () => {
    const { state, mob, arena } = arenaFight(GROUND_CAST, 3);
    const c = characterSheet(state);
    const pose = arena.mobs[mob.id];
    const area = { origin: 'target' as const, radiusM: 3, center: { x: pose.x, y: pose.y }, targetId: mob.id };
    const prepared = prepareSkillCast(state.skills, c, GROUND_CAST, c.maxMana, [mob],
      state.playerStatuses, { spatialTargets: true }, area)!;
    const profile = sm.castProfileOf(sm.byId[GROUND_CAST]);
    const timing = { ...skillCastTiming(profile, 0, 1_000_000, arena.player, area.center), impactAtUs: 1_500_000 };
    arena.flights.push({
      actionId: 999, cast: prepared, character: c, modifiers: {}, profile, timing,
      source: { x: arena.player.x, y: arena.player.y }, destination: { ...area.center },
      area, position: { x: arena.player.x, y: arena.player.y }, lastCheckedAtUs: 0,
    });
    tick(state, { arena, autoSkills: false });
    expect(arena.flights).toHaveLength(1);
    expect(state.fx.some((event) => event.kind === 'hit' && event.actionId === 999)).toBe(false);
    tick(state, { arena, autoSkills: false });
    expect(arena.flights).toHaveLength(0);
    expect(state.fx.filter((event) => event.kind === 'hit' && event.actionId === 999)).toHaveLength(1);
    tick(state, { arena, autoSkills: false });
    expect(state.fx.filter((event) => event.kind === 'hit' && event.actionId === 999)).toHaveLength(1);
  });
});
