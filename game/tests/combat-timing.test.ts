import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/engine/client-helpers';
import { sm } from '../src/engine/client';
import {
  arenaAction, captureCombatArena, createCombatArena, sampleCombatArena, syncCombatArena,
} from '../src/sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '../src/sim/core/game';
import { prepareSkillCast } from '../src/sim/combat/skills';
import { skillCastTiming } from '../../engine/skill-actions.ts';
import { pinFieldPopulation } from './mobFixture';
import { mobSkillById } from '../src/sim/combat/mobSkills';

function arenaFight(skillId: string, distance: number) {
  const state = newGame(41);
  setLevel(state, 30);
  state.hunting = true;
  state.spawnIn = 999;
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
  it('publishes release and impact separately and does not damage before impact', () => {
    const { state, mob, arena } = arenaFight('attack.firestorm', 3);
    const initialHp = mob.hp;
    tick(state, { arena });
    const cast = state.fx.find((event) => event.kind === 'cast' && event.skillId === 'attack.firestorm')!;
    const action = arena.actions.find((entry) => entry.kind === 'cast' && entry.skillId === 'attack.firestorm')!;
    expect(cast.actionId).toBe(action.id);
    expect(cast.atUs).toBe(action.timing?.releaseAtUs);
    const hit = state.fx.find((event) => event.kind === 'hit' && event.actionId === action.id)!;
    expect(hit.atUs).toBe(action.timing?.impactAtUs);
    expect(action.hitIds).toContain(mob.id);
    expect(sampleCombatArena(arena, cast.atUs!).mobs[mob.id]?.hp).toBe(initialHp);
    expect(sampleCombatArena(arena, hit.atUs!).mobs[mob.id]?.hp).toBeLessThan(initialHp);
    expect(state.skills.cd['attack.firestorm']).toBeGreaterThan(0);
  });

  it('cancels a windup without paying or starting cooldown when auto skills turn off', () => {
    const { state, arena, mob } = arenaFight('attack.firestorm', 3);
    const profile = sm.castProfileOf(sm.byId['attack.firestorm']);
    const area = { origin: 'target' as const, radiusM: 3, center: { x: 4, y: 6 }, targetId: mob.id };
    const timing = { ...skillCastTiming(profile, 0, 1_000_000, { x: 1, y: 6 }, area.center),
      releaseAtUs: 3_000_000, impactAtUs: 4_000_000, recoveryUntilUs: 4_500_000 };
    const action = arenaAction(arena, 'player', 'cast', 0, mob.id, 'attack.firestorm', area, timing)!;
    arena.intent = { skillId: 'attack.firestorm', targetId: mob.id, targetPoint: { x: 4, y: 6 },
      phase: 'windup', actionId: action.id, releaseAtUs: 3_000_000, recoveryUntilUs: 4_500_000 };
    tick(state, { arena, autoSkills: false });
    expect(arena.intent).toBeUndefined();
    expect(arena.actions.find((entry) => entry.id === action.id)?.cancelledAtUs).toBeDefined();
    expect(state.skills.cd['attack.firestorm'] || 0).toBe(0);
    expect(state.fx.some((event) => event.kind === 'cast' && event.skillId === 'attack.firestorm')).toBe(false);
  });

  it('lands a projectile after its release rather than on the cast beat', () => {
    const { state, mob, arena } = arenaFight('attack.fireball', 3);
    tick(state, { arena });
    const cast = state.fx.find((event) => event.kind === 'cast' && event.skillId === 'attack.fireball')!;
    const action = arena.actions.find((entry) => entry.kind === 'cast' && entry.skillId === 'attack.fireball')!;
    const hit = state.fx.find((event) => event.kind === 'hit' && event.actionId === action.id)!;
    expect(hit.atUs).toBeGreaterThan(cast.atUs!);
    expect(hit.atUs).toBe(action.timing?.impactAtUs);
    expect(mob.hp).toBeLessThan(mob.hpMax);
    expect(arena.flights).toHaveLength(0);
  });

  it('resolves a melee cast on its release beat', () => {
    const { state, mob, arena } = arenaFight('attack.cleave', 2);
    state.gear[0] = { slot: 'main hand', base: 'one-handed axe', ilvl: 1, quality: 'Normal', tier: 'T1', lines: [] };
    tick(state, { arena });
    const cast = state.fx.find((event) => event.kind === 'cast' && event.skillId === 'attack.cleave')!;
    const action = arena.actions.find((entry) => entry.kind === 'cast' && entry.skillId === 'attack.cleave')!;
    const hit = state.fx.find((event) => event.kind === 'hit' && event.actionId === action.id)!;
    expect(hit.atUs).toBe(cast.atUs);
    expect(hit.atUs).toBe(action.timing?.impactAtUs);
    expect(action.hitIds).toContain(mob.id);
  });

  it('launches a live trigger cast without taking over the primary action', () => {
    const { state, mob, arena } = arenaFight('attack.cleave', 2);
    state.gear[0] = {
      slot: 'main hand', base: 'one-handed axe', ilvl: 1, quality: 'Normal', tier: 'T1',
      lines: [{ id: 'critical_chance', value: 100 }],
    };
    state.skills.list = ['attack.cleave', 'attack.fireball'];
    state.skills.owned['attack.cleave'] = 0;
    state.skills.owned['attack.fireball'] = 0;
    state.skills.owned['aura.cast_on_crit'] = 0;
    state.skills.auras['aura.cast_on_crit'] = true;
    mob.hp = mob.hpMax = 1e9;
    mob.ps = 0;
    mob.evasion = 0;
    mob.dodgeRate = 0;
    state.player.mana = characterSheet(state).maxMana;
    tick(state, { arena });
    const trigger = arena.actions.find((action) => action.kind === 'cast'
      && action.skillId === 'attack.fireball' && action.timing?.releaseAtUs === action.atUs)!;
    expect(trigger).toBeTruthy();
    expect(trigger.atUs).toBe(arena.actions.find((action) => action.skillId === 'attack.cleave')!.timing!.impactAtUs);
    expect(trigger.timing!.recoveryUntilUs).toBe(trigger.atUs);
    expect(arena.player.action?.id).not.toBe(trigger.id);
    expect(arena.player.action!.timing!.releaseAtUs).toBeGreaterThan(arena.player.action!.atUs);
    expect(state.skills.cd['aura.cast_on_crit']).toBeGreaterThan(0);
    expect(state.fx.filter((event) => event.kind === 'cast' && event.actionId === trigger.id)).toHaveLength(1);
    expect(state.fx.filter((event) => event.kind === 'hit' && event.actionId === trigger.id)).toHaveLength(1);
  });

  it('commits a ground centre and reads enter and leave at impact', () => {
    const { state, mob, arena } = arenaFight('attack.firestorm', 3);
    const second = spawnMob(mulberry32(7), state.zone, 'normal');
    second.hp = second.hpMax = 1e9;
    second.ps = 0;
    state.group.push(second);
    const c = characterSheet(state);
    const center = { x: arena.mobs[mob.id].x, y: arena.mobs[mob.id].y };
    const area = { origin: 'target' as const, radiusM: 3, center, targetId: mob.id };
    const prepared = prepareSkillCast(state.skills, c, 'attack.firestorm', c.maxMana, [mob],
      state.playerStatuses, { spatialTargets: true }, area)!;
    const profile = sm.castProfileOf(sm.byId['attack.firestorm']);
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
    const { state, mob, arena } = arenaFight('attack.cleave', 2);
    state.gear[0] = {
      slot: 'main hand', base: 'one-handed axe', ilvl: 1, quality: 'Normal', tier: 'T1', lines: [],
    };
    const c = characterSheet(state);
    const center = { x: arena.player.x, y: arena.player.y };
    const area = { origin: 'caster' as const, radiusM: 2.1, center, targetId: mob.id };
    const prepared = prepareSkillCast(state.skills, c, 'attack.cleave', c.maxMana, [mob],
      state.playerStatuses, { spatialTargets: true }, area)!;
    const profile = sm.castProfileOf(sm.byId['attack.cleave']);
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
    const { state, mob, arena } = arenaFight('attack.fireball', 3);
    // Keep Shock contact at .52s; its selected mob skill now performs its full preparation.
    const prepareAtUs = 520_000 - Math.ceil(mobSkillById('mob.lightning.static-jab')!.cast_sec! * 1_000_000);
    Object.assign(mob, { hitsPerSec: 2, atkTimer: 1 - prepareAtUs / 1_000_000 * 2, acc: 1e12, ps: 5,
      skillIds: ['mob.lightning.static-jab'], skillReadyAtUs: {} });
    Object.assign(arena.mobs[mob.id], { x: 1.6, y: 6 });
    const profile = sm.castProfileOf(sm.byId['attack.fireball']);
    const area = { origin: 'target' as const, radiusM: 0,
      center: { x: 1.6, y: 6 }, targetId: mob.id };
    const timing = { ...skillCastTiming(profile, 0, 1_000_000, { x: 1, y: 6 }, area.center),
      releaseAtUs: 530_000, impactAtUs: 1_000_000, recoveryUntilUs: 800_000 };
    const action = arenaAction(arena, 'player', 'cast', 0, mob.id, 'attack.fireball', area, timing)!;
    arena.intent = { skillId: 'attack.fireball', targetId: mob.id, targetPoint: { x: 1.6, y: 6 },
      phase: 'windup', actionId: action.id, releaseAtUs: 530_000, recoveryUntilUs: 800_000 };
    tick(state, { arena });
    expect(state.playerStatuses.shock?.secLeft ?? 0).toBeGreaterThan(0);
    expect(state.fx.some((event) => event.kind === 'cast' && event.actionId === action.id)).toBe(false);
    const resolved = arena.actions.find((entry) => entry.id === action.id)!;
    expect(resolved.cancelledAtUs).toBe(520_000);
    expect(resolved.cancelReason).toBe('shock');
    expect(state.skills.cd['attack.fireball'] || 0).toBe(0);
    expect(state.player.mana).toBe(characterSheet(state).maxMana);
  });

  it('recomputes released travel from the release aim instead of the windup snapshot', () => {
    const { state, mob, arena } = arenaFight('attack.fireball', 3);
    const profile = sm.castProfileOf(sm.byId['attack.fireball']);
    const source = { x: arena.player.x, y: arena.player.y };
    const windupArea = { origin: 'target' as const, radiusM: 0,
      center: { x: arena.mobs[mob.id].x, y: arena.mobs[mob.id].y }, targetId: mob.id };
    const windupTiming = skillCastTiming(profile, 0, 1_000_000, source, windupArea.center);
    const action = arenaAction(arena, 'player', 'cast', 0, mob.id, 'attack.fireball', windupArea, windupTiming)!;
    arena.intent = { skillId: 'attack.fireball', targetId: mob.id, targetPoint: { ...windupArea.center },
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
    const { state, mob, arena } = arenaFight('attack.fireball', 3);
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
    const prepared = prepareSkillCast(state.skills, c, 'attack.fireball', c.maxMana, [mob],
      state.playerStatuses, { spatialTargets: true }, area)!;
    const profile = sm.castProfileOf(sm.byId['attack.fireball']);
    const timing = { ...skillCastTiming(profile, 0, 1_000_000, { x: 1, y: 6 }, { x: 9, y: 6 }),
      impactAtUs: 900_000 };
    const action = arenaAction(arena, 'player', 'cast', 0, mob.id, 'attack.fireball', area, timing)!;
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
    const { state, mob, arena } = arenaFight('attack.firestorm', 3);
    const c = characterSheet(state);
    const pose = arena.mobs[mob.id];
    const area = { origin: 'target' as const, radiusM: 3, center: { x: pose.x, y: pose.y }, targetId: mob.id };
    const prepared = prepareSkillCast(state.skills, c, 'attack.firestorm', c.maxMana, [mob],
      state.playerStatuses, { spatialTargets: true }, area)!;
    const profile = sm.castProfileOf(sm.byId['attack.firestorm']);
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
