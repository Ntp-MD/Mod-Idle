import { describe, expect, it } from 'vitest';
import { skillCastTiming } from '@engine/skill-actions.ts';
import { mulberry32 } from '../../src/engine/client-helpers';
import { sm } from '../../src/engine/client';
import {
  arenaAction, captureCombatArena, createCombatArena, syncCombatArena, updateArenaAction,
} from '@sim/combat/combat-arena';
import { catchUp, characterSheet, encounterKeyOf, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import { normalizePendingWork, restorePendingWork } from '@sim/core/pending-work';
import { prepareSkillCast, type CastRollCache } from '@sim/combat/skills';
import { pinFieldPopulation } from '../fixtures/mobFixture';
import { exportJson, importJson, migrate, SCHEMA_VERSION } from '../../src/state/save';

function pendingFight() {
  const state = newGame(41);
  setLevel(state, 30);
  state.hunting = true;
  const mob = spawnMob(mulberry32(23), 1, 'normal');
  Object.assign(mob, {
    id: 'pending-target', hp: 1e8, hpMax: 1e8, ps: 1, evasion: 0, dodgeRate: 0,
    armour: 0, line: 'front', damage: 'physical', innate: [], skillIds: [],
  });
  state.group = [mob];
  state.skills.owned['attack.firestorm'] = 0;
  state.skills.list.fill(null);
  state.skills.list[0] = 'attack.firestorm';
  state.player.mana = characterSheet(state).maxMana;
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 1, y: 6 });
  Object.assign(arena.mobs[mob.id], { x: 1.6, y: 6 });
  captureCombatArena(arena, state, 0);
  pinFieldPopulation(state);
  const c = characterSheet(state);
  const area = { origin: 'target' as const, radiusM: 3, center: { x: 1.6, y: 6 }, targetId: mob.id };
  const prepared = prepareSkillCast(state.skills, c, 'attack.firestorm', c.maxMana, [mob],
    state.playerStatuses, { spatialTargets: true }, area)!;
  const profile = sm.castProfileOf(sm.byId['attack.firestorm']);
  const timing = { ...skillCastTiming(profile, 0, 1_000_000, { x: 1, y: 6 }, area.center),
    releaseAtUs: 250_000, impactAtUs: 1_500_000, recoveryUntilUs: 500_000 };
  const action = arenaAction(arena, 'player', 'cast', 0, mob.id, 'attack.firestorm', area, timing)!;
  arena.flights.push({
    actionId: action.id, cast: prepared, character: c, modifiers: {}, profile, timing,
    source: { x: 1, y: 6 }, destination: { x: 1.6, y: 6 },
    area, position: { x: 1, y: 6 }, lastCheckedAtUs: 0,
  });
  return { state, mob, arena, action };
}

function pendingShot() {
  const state = newGame(41);
  setLevel(state, 30);
  state.hunting = true;
  const mob = spawnMob(mulberry32(23), 1, 'normal');
  Object.assign(mob, {
    id: 'archer', hp: 1e8, hpMax: 1e8, ps: 1, acc: 1e9, evasion: 0, dodgeRate: 0,
    armour: 0, line: 'stand-off', damage: 'physical', innate: [], skillIds: [],
    hitsPerSec: 1, atkTimer: 0, engageSec: 0,
  });
  state.group = [mob];
  state.skills.list.fill(null);
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 1, y: 6 });
  Object.assign(arena.mobs[mob.id], { x: 4, y: 6 });
  // A released shot already in flight: the windup is over and only contact remains.
  const timing = { delivery: 'projectile' as const, startedAtUs: 0, releaseAtUs: 0,
    impactAtUs: 1_500_000, recoveryUntilUs: 1_000_000 };
  const action = arenaAction(arena, mob.id, 'swing', 0, 'player', undefined, undefined, timing)!;
  updateArenaAction(arena, action.id, { ranged: true, releasedAtUs: 0, targetX: 1, targetY: 6 });
  arena.mobFlights.push({
    actionId: action.id, mobId: mob.id, mob: { ...mob }, source: { x: 4, y: 6 },
    destination: { x: 1, y: 6 }, position: { x: 4, y: 6 },
    releaseAtUs: 0, impactAtUs: 1_500_000, speedMps: 12, radiusM: 0.35,
  });
  arena.intent = { skillId: 'attack.firestorm', targetId: mob.id, targetPoint: { x: 1, y: 6 },
    phase: 'windup', releaseAtUs: 10_000_000 } as never;
  captureCombatArena(arena, state, 0);
  return { state, mob, arena };
}

describe('released pending work across a save', () => {
  it('keeps one owed impact through export/import and settles it exactly once after reload', () => {
    const live = pendingFight();
    tick(live.state, { arena: live.arena, autoSkills: false });
    expect(live.arena.flights).toHaveLength(1);
    const ledger = live.state.pendingWork!;
    expect(ledger.flights).toHaveLength(1);
    expect(ledger.flights[0]).toMatchObject({
      actionId: live.action.id, skillId: 'attack.firestorm', targetIds: [live.mob.id],
      timing: { releaseAtUs: 250_000, impactAtUs: 1_500_000 },
      character: { level: 30 },
    });

    const loaded = importJson(exportJson(live.state));
    expect(loaded.pendingWork?.flights).toHaveLength(1);
    const fresh = createCombatArena();
    syncCombatArena(fresh, loaded, loaded.clockSec * 1_000_000, 1_000_000, characterSheet(loaded).maxHp);
    expect(restorePendingWork(fresh, loaded)).toBe(1);
    expect(fresh.flights).toHaveLength(1);
    expect(fresh.flights[0].cast.targets.map((mob) => mob.id)).toEqual([live.mob.id]);
    expect(fresh.actions.some((entry) => entry.id === live.action.id)).toBe(true);
    expect(fresh.mobs[live.mob.id].x).toBeCloseTo(ledger.actors[0].x);
    expect(fresh.mobs[live.mob.id].y).toBeCloseTo(ledger.actors[0].y);

    tick(loaded, { arena: fresh, autoSkills: false });
    const hits = loaded.fx.filter((event) => event.kind === 'hit' && event.actionId === live.action.id);
    expect(hits).toHaveLength(1);
    expect(hits[0].value).toBeGreaterThan(0);
    expect(loaded.pendingWork).toBeNull();
    const settledHp = loaded.group[0].hp;

    tick(loaded, { arena: fresh, autoSkills: false });
    expect(loaded.fx.filter((event) => event.kind === 'hit' && event.actionId === live.action.id)).toHaveLength(1);
    expect(loaded.pendingWork).toBeNull();
  });

  it('restores a flight with no living target but resolves no ghost hit', () => {
    const { state, mob, arena } = pendingFight();
    tick(state, { arena, autoSkills: false });
    const hpBefore = mob.hp;
    state.hunting = false;
    const loaded = importJson(exportJson(state));
    loaded.group = [];
    loaded.fx = [];
    const fresh = createCombatArena();
    syncCombatArena(fresh, loaded, loaded.clockSec * 1_000_000, 1_000_000, characterSheet(loaded).maxHp);
    expect(restorePendingWork(fresh, loaded)).toBe(1);
    expect(fresh.flights[0].cast.targets).toHaveLength(0);
    tick(loaded, { arena: fresh, autoSkills: false });
    tick(loaded, { arena: fresh, autoSkills: false });
    expect(loaded.fx.filter((event) => event.kind === 'hit')).toHaveLength(0);
    expect(mob.hp).toBe(hpBefore);
    expect(loaded.pendingWork).toBeNull();
  });

  it('settles the saved impact before offline time and pays its death once', () => {
    const { state, mob, arena } = pendingFight();
    tick(state, { arena, autoSkills: false });
    mob.hp = 50;
    const loaded = importJson(exportJson(state));
    expect(loaded.pendingWork?.flights).toHaveLength(1);
    const result = catchUp(loaded, 5, { autoSkills: false });
    expect(result.simulated).toBeGreaterThanOrEqual(1);
    expect(loaded.counters.kills).toBe(1);
    expect(loaded.pendingWork).toBeNull();
    expect(loaded.group.some((entry) => entry.id === mob.id)).toBe(false);
    tick(loaded, { autoSkills: false });
    expect(loaded.counters.kills).toBe(1);
  });

  it('keeps a released impact after its caster is shocked', () => {
    const { state, mob, arena } = pendingFight();
    tick(state, { arena, autoSkills: false });
    state.playerStatuses.shock = { stacks: 1, secLeft: 2, perSec: 0 };
    tick(state, { arena, autoSkills: false });
    expect(state.fx.filter((event) => event.kind === 'hit' && event.actionId === 1)).toHaveLength(1);
    expect(mob.hp).toBeLessThan(mob.hpMax);
    expect(state.pendingWork).toBeNull();
  });

  it('cancels pending work at the fatal latch and never lands it later', () => {
    const { state, arena } = pendingFight();
    tick(state, { arena, autoSkills: false });
    state.player.hp = 0;
    tick(state, { arena, autoSkills: false });
    expect(arena.flights).toHaveLength(0);
    expect(state.pendingWork).toBeNull();
    tick(state, { arena, autoSkills: false });
    expect(state.fx.filter((event) => event.kind === 'hit' && event.actionId === 1)).toHaveLength(0);
  });

  it('cancels a released impact with an area-exit receipt when the encounter changes', () => {
    const { state, arena } = pendingFight();
    arena.flights[0].areaKey = encounterKeyOf(state);
    tick(state, { arena, autoSkills: false });
    expect(state.pendingWork?.flights[0].areaKey).toBe(encounterKeyOf(state));
    state.cell = { q: 5, r: 5, sub: null, wild: null };
    tick(state, { arena, autoSkills: false });
    const resolved = arena.actions.find((entry) => entry.id === 1)!;
    expect(resolved.cancelReason).toBe('area-exit');
    expect(resolved.cancelledAtUs).toBeDefined();
    expect(state.fx.filter((event) => event.kind === 'hit' && event.actionId === 1)).toHaveLength(0);
    expect(state.pendingWork).toBeNull();
  });

  it('keeps an incoming ordinary shot through a reload and lands it once', () => {
    const control = pendingShot();
    tick(control.state, { arena: control.arena, autoSkills: true });
    control.state.group = [];
    tick(control.state, { arena: control.arena, autoSkills: true });
    const controlHp = control.state.player.hp;

    const live = pendingShot();
    tick(live.state, { arena: live.arena, autoSkills: true });
    expect(live.arena.mobFlights).toHaveLength(1);
    expect(live.state.pendingWork?.mobFlights).toHaveLength(1);
    live.state.group = [];
    const loaded = importJson(exportJson(live.state));
    expect(loaded.pendingWork?.mobFlights).toHaveLength(1);
    const fresh = createCombatArena();
    syncCombatArena(fresh, loaded, loaded.clockSec * 1_000_000, 1_000_000, characterSheet(loaded).maxHp);
    expect(restorePendingWork(fresh, loaded)).toBe(1);
    tick(loaded, { arena: fresh, autoSkills: true });
    expect(loaded.fx.filter((event) => event.kind === 'taken' && event.byId === 'archer')).toHaveLength(1);
    expect(loaded.player.hp).toBe(controlHp);
    expect(loaded.pendingWork).toBeNull();
    tick(loaded, { arena: fresh, autoSkills: false });
    expect(loaded.fx.filter((event) => event.kind === 'taken' && event.byId === 'archer')).toHaveLength(1);
  });

  it('settles an incoming shot before offline time without replaying it', () => {
    const { state, mob, arena } = pendingShot();
    mob.ps = 100;
    tick(state, { arena, autoSkills: true });
    expect(state.pendingWork?.mobFlights).toHaveLength(1);
    state.hunting = false;
    state.group = [];
    const hpBefore = state.player.hp;
    const loaded = importJson(exportJson(state));
    catchUp(loaded, 3, { autoSkills: false });
    expect(loaded.pendingWork).toBeNull();
    expect(loaded.fx.filter((event) => event.kind === 'taken' && event.byId === 'archer')).toHaveLength(1);
    const afterOffline = loaded.player.hp;
    tick(loaded, { autoSkills: false });
    expect(loaded.fx.filter((event) => event.kind === 'taken' && event.byId === 'archer')).toHaveLength(1);
    expect(loaded.player.hp).toBeGreaterThanOrEqual(afterOffline);
  });

  it('migrates a pre-ledger save to none and validates a current ledger by shape', () => {
    const state = newGame(7);
    const preLedger = JSON.parse(JSON.stringify(state));
    delete preLedger.pendingWork;
    expect(migrate(preLedger, 21).pendingWork).toBeNull();

    const current = JSON.parse(JSON.stringify(state));
    current.pendingWork = { unitsPerSec: 1_000_000, clockUs: 1_000_000, player: { x: 1, y: 1 },
      actors: [], actions: [], flights: [{ actionId: 3, skillId: 'attack.nope', targetIds: [], prepared: { id: 'attack.nope' } }] };
    expect(migrate(current, SCHEMA_VERSION).pendingWork).toBeNull();
    expect(normalizePendingWork({ unitsPerSec: 0, flights: [] })).toBeNull();
  });
  it('keeps committed line/cone dimensions and drops a ledger with impossible geometry', () => {
    const base = { actionId: 3, skillId: 'attack.firestorm', targetIds: [],
      prepared: { id: 'attack.firestorm', manaCost: 1, hpCost: 0, level: 1, cooldownSec: 1, spatial: true },
      character: { phys: 1, magic: 1, maxHp: 1, critChance: 1, critDmg: 1 },
      modifiers: {}, profile: { delivery: 'melee', hit_radius_m: 0.5 },
      timing: { releaseAtUs: 0, impactAtUs: 1, startedAtUs: 0, recoveryUntilUs: 2 },
      source: { x: 0, y: 0 }, destination: { x: 1, y: 1 }, position: { x: 0, y: 0 }, lastCheckedAtUs: 0 };
    const ledger = (area: unknown) => normalizePendingWork({ unitsPerSec: 1_000_000, player: { x: 0, y: 0 },
      actors: [], actions: [], flights: [{ ...base, area }] });
    const line = { origin: 'caster', radiusM: 0, center: { x: 0, y: 0 }, targetId: 'a',
      shape: 'line', lengthM: 6, widthM: 1.2, directionRad: 0 };
    expect(ledger(line)?.flights.length).toBe(1);
    expect(ledger({ ...line, shape: 'wedge' })).toBeNull();
    expect(ledger({ ...line, lengthM: 0 })).toBeNull();
    expect(ledger({ ...line, directionRad: Number.NaN })).toBeNull();
    const cone = { origin: 'caster', radiusM: 2.1, center: { x: 0, y: 0 }, targetId: 'a',
      shape: 'cone', lengthM: 2.1, angleDeg: 120, directionRad: 0 };
    expect(ledger(cone)?.flights.length).toBe(1);
    expect(ledger({ ...cone, angleDeg: 181 })).toBeNull();
    expect(ledger({ ...line, origin: 'side' })).toBeNull();
  });
});

describe('pending work payloads beyond the first contact', () => {
  it('keeps deployed-field and chain facts plus one shared roll cache through a reload', () => {
    const live = pendingFight();
    const rolls: CastRollCache = { targets: {}, effects: {} };
    const first = live.arena.flights[0];
    Object.assign(first, {
      rolls,
      fieldInitial: true,
      fieldPulseDamage: 42,
      chain: { visited: [live.mob.id], remaining: 2, hopRange: 4, sharePct: 60, intervalSec: 0.3 },
    });
    live.arena.flights.push({ ...first, impactIndex: 1, impactSharePct: 50 });
    tick(live.state, { arena: live.arena, autoSkills: false });

    const ledger = live.state.pendingWork!;
    expect(ledger.flights).toHaveLength(2);
    expect(ledger.flights[0]).toMatchObject({
      fieldInitial: true, fieldPulseDamage: 42,
      chain: { visited: [live.mob.id], remaining: 2, hopRange: 4, sharePct: 60, intervalSec: 0.3 },
    });

    const loaded = importJson(exportJson(live.state));
    expect(loaded.pendingWork?.flights).toHaveLength(2);
    const fresh = createCombatArena();
    syncCombatArena(fresh, loaded, loaded.clockSec * 1_000_000, 1_000_000, characterSheet(loaded).maxHp);
    expect(restorePendingWork(fresh, loaded)).toBe(2);
    const second = fresh.flights.find((flight) => flight.impactIndex === 1)!;
    expect(second.fieldInitial).toBe(true);
    expect(second.fieldPulseDamage).toBe(42);
    expect(second.chain).toEqual({ visited: [live.mob.id], remaining: 2, hopRange: 4, sharePct: 60, intervalSec: 0.3 });
    // One press, one cache: the second impact must not reroll what the first already spent.
    expect(fresh.flights[0].rolls).toBe(second.rolls);
  });

  it('rejects a chain or pulse payload the engine never commits', () => {
    const live = pendingFight();
    tick(live.state, { arena: live.arena, autoSkills: false });
    const base = live.state.pendingWork!;
    const badChain = structuredClone(base) as typeof base;
    (badChain.flights[0] as { chain?: unknown }).chain = { visited: [], remaining: -1, hopRange: 4, sharePct: 60 };
    expect(normalizePendingWork(badChain)).toBeNull();
    const badPulse = structuredClone(base) as typeof base;
    badPulse.flights[0].fieldPulseDamage = -5;
    expect(normalizePendingWork(badPulse)).toBeNull();
    const badInitial = structuredClone(base) as typeof base;
    (badInitial.flights[0] as { fieldInitial?: unknown }).fieldInitial = 'yes';
    expect(normalizePendingWork(badInitial)).toBeNull();
  });
});
