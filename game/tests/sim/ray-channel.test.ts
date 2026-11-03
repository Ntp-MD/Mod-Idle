import { describe, expect, it } from 'vitest';
import { normalizeSkillAction } from '@engine/skills.ts';
import { arenaAction, createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { catchUp, catchUpAsync, characterSheet, newGame, setLevel, stepCombat, tick } from '@sim/core/game';
import { castOnce, newSkillState, prepareSkillCast, reservedMana, skillEligibility, usableMana } from '@sim/combat/skills';
import { snapshotPendingWork, normalizePendingWork, restorePendingWork } from '@sim/core/pending-work';
import { finishRayChannel } from '@sim/combat/ray-channel';
import { createFlights, dispatchSkillFlights } from '@sim/core/tick/flights';
import { CombatClock } from '@sim/combat/combat-clock';
import { createCastTrigger } from '@sim/core/tick/cast-trigger';
import type { KeystoneBundle } from '@engine/keystones.ts';
import { buildCharacter, emptyGear } from '@sim/core/player';
import type { CombatFlight, ManualControl } from '@sim/combat/combat-actions';
import { SKILLS, sm } from '../../src/engine/client';
import { mulberry32 } from '../../src/engine/client-helpers';
import { installSyntheticSkill } from '../fixtures/skillFixture';
import { mobFixture, pinFieldPopulation } from '../fixtures/mobFixture';
import { exportJson, importJson } from '../../src/state/save';

const id = 'test.draining-ray';
const row = {
  cd: 5, mana: '10 flat', channel: { mana_per_sec: 10 }, duration: '3 sec',
  cast: { delivery: 'projectile', range_m: 5, windup_sec: .1, recovery_sec: .2 },
  area: { origin: 'caster', radius_m: 0, shape: 'line', length_m: 5, width_m: 1 },
  action: { kind: 'ray-channel', interval_sec: .5, active_sec: 3, effect_policy: 'refresh-status' },
  effects: [{ stat: 'hits', op: 'add_flat', value: 6, subject: 'self' }],
};

function channelFixture(mana = 100, manual: ManualControl = {}, bundles: KeystoneBundle[] = [], free = false) {
  const state = newGame(41); setLevel(state, 30);
  const c = { ...buildCharacter(30, emptyGear(), {}, 0, { add: {}, mult: {} }, undefined, undefined, {}, bundles), manaRegen: 0 };
  state.player.mana = mana;
  state.skills.owned[id] = 0; state.skills.list.fill(null); state.skills.list[0] = id;
  state.group = [mobFixture({ id: 'target', hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0 })];
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1e6, c.maxHp);
  Object.assign(arena.player, { x: 1, y: 6 });
  Object.assign(arena.mobs.target, { x: 3, y: 6 });
  const area = { origin: 'caster' as const, shape: 'line' as const, radiusM: 0,
    center: { x: 1, y: 6 }, directionRad: 0, lengthM: 5, widthM: 1, targetId: 'target' };
  const prepared = prepareSkillCast(state.skills, c, id, mana, state.group, {}, { spatialTargets: true, freeCast: free }, area)!;
  const timing = { delivery: 'projectile' as const, startedAtUs: 0, releaseAtUs: 0, impactAtUs: 0, recoveryUntilUs: 200_000 };
  arenaAction(arena, 'player', 'cast', 0, 'target', id, area, timing);
  const flight = { actionId: 1, cast: prepared, character: c, modifiers: { freeCast: free }, profile: sm.castProfileOf(sm.byId[id]),
    timing, area, source: { x: 1, y: 6 }, destination: { x: 6, y: 6 }, position: { x: 1, y: 6 }, lastCheckedAtUs: 0 } as CombatFlight;
  arena.flights = dispatchSkillFlights(flight, sm.actionOf(sm.byId[id]), sm.byId[id], timing, 1e6).flights;
  arena.channelTemplate = arena.flights[0];
  arena.intent = { skillId: id, targetId: 'target', targetPoint: { x: 3, y: 6 }, phase: 'recovery', actionId: 1,
    recoveryUntilUs: 3_200_000, channel: { manaPerTick: free ? 0 : 5, freeCast: free, floorPct: 0, nextTick: 0, ticks: 6,
      cooldownSec: 5, recoveryUs: 200_000, origin: { x: 1, y: 6 }, endsAtUs: 3_000_000 } };
  // This scenario executes only the production payment closure; other trigger callbacks are unused.
  const { payCast } = createCastTrigger({ s: state, c } as Parameters<typeof createCastTrigger>[0]);
  payCast(prepared);
  const clock = new CombatClock(0, 4_000_000);
  const payments: number[] = [], hits: number[] = [];
  const work = createFlights({ arena, clock, rng: mulberry32(1), s: state, c, statuses: state.playerStatuses,
    units: 1e6, tickStartUs: 0, tickEndUs: 4_000_000, advanceLiveClocks: () => {},
    applyCastOutcome: report => { if (report?.targets) hits.push(report.dealt ?? 0); }, cancelIntent: () => {},
    cancelFlight: () => {}, manual,
    payCast: cost => { payments.push(cost.manaCost); payCast(cost); } });
  return { state, arena, c, clock, payments, hits, work, manual };
}

describe('draining ray lifecycle', () => {
  it('protects reserved Mana and the conditional floor before paying any interval', () => {
    const tier = Object.entries(SKILLS.reserve_tiers).find(([, value]) => value.pct > 0 && value.pct < 50)?.[0];
    if (!tier) throw new Error('The reservation contract requires a positive sub-half-pool tier');
    const installed = installSyntheticSkill(id, row);
    const aura = installSyntheticSkill('test.ray-reservation', { type: 'aura', reserve: tier });
    try {
      const f = channelFixture();
      f.state.skills.owned[aura.row.id] = 0; f.state.skills.auras[aura.row.id] = true;
      const reserved = reservedMana(f.c, f.state.skills);
      f.state.player.mana = reserved + 4;
      f.work.resolveFlight(f.arena.flights[0], 500_000);
      expect(f.payments).toHaveLength(0);
      expect(f.state.player.mana).toBe(reserved + 4);
      const floor = channelFixture();
      floor.arena.intent!.channel!.floorPct = 50;
      const protectedMana = usableMana(floor.c, floor.state.skills) / 2;
      floor.state.player.mana = protectedMana + 4;
      floor.work.resolveFlight(floor.arena.flights[0], 500_000);
      expect(floor.payments).toHaveLength(0);
      expect(floor.state.player.mana).toBe(protectedMana + 4);
      const s = newSkillState(); s.owned[id] = 0; s.list[0] = id; s.mode[id] = 'conditional';
      s.conditions[id] = { boss: true, manaFloorPct: 50 } as any;
      expect(skillEligibility(s, floor.c, id, protectedMana + 14, [mobFixture()], {}, { isBoss: true }).reason).toBe('mana-floor');
    } finally { aura.restore(); installed.restore(); }
  });

  it('trigger selection skips a ray and funds the next eligible row with the ordinary trigger multiplier', () => {
    const installed = installSyntheticSkill(id, row);
    const follow = installSyntheticSkill('test.trigger-followup', { mana: '2 flat' });
    try {
      const s = newSkillState(); s.owned[id] = 0; s.owned[follow.row.id] = 0;
      s.list[0] = id; s.list[1] = follow.row.id;
      const c = buildCharacter(30, emptyGear());
      const report = castOnce(s, c, 100, [mobFixture()], {}, () => .5, { trigger: { manaMult: 3, damageMult: 1 } });
      expect(report?.id).toBe(follow.row.id);
      expect(report?.manaCost).toBe(6);
      expect(s.cd[id] || 0).toBe(0);
      expect(s.cd[follow.row.id] || 0).toBe(0);
    } finally { follow.restore(); installed.restore(); }
  });
  it('pays funded-spend effects only on owned Mana, records debt, then ends immediately', () => {
    const installed = installSyntheticSkill(id, row);
    try {
      const f = channelFixture(13, {}, [
        { key: 'mana-debt', params: { debtLimitUsableManaPct: 20, negativeRegenMult: 2 } },
        { key: 'capacitive-casting', params: { spentManaEsPct: 20, naturalEsRegenMult: 0 } },
      ]);
      f.c.es = 100; f.state.player.es = 0;
      f.work.resolveFlight(f.arena.flights[0], 500_000);
      expect(f.state.player.mana).toBe(-2);
      expect(f.state.player.es).toBeCloseTo(.6, 8);
      expect(f.state.keystoneRuntime.manaDebtLimit).toBeGreaterThan(0);
      expect(f.arena.intent?.channel).toBeUndefined();
      expect(f.arena.flights).toHaveLength(0);
    } finally { installed.restore(); }
  });

  it('free-cast ownership remains finite, pays zero, and grants no funded-spend reward', () => {
    const installed = installSyntheticSkill(id, row);
    try {
      const f = channelFixture(0, {}, [{ key: 'capacitive-casting', params: { spentManaEsPct: 20, naturalEsRegenMult: 0 } }], true);
      f.c.es = 100; f.state.player.es = 0;
      for (const flight of [...f.arena.flights]) f.work.resolveFlight(flight, flight.timing.impactAtUs);
      expect(f.payments).toEqual([0, 0, 0, 0, 0, 0]);
      expect(f.hits).toHaveLength(6);
      expect(f.state.player.mana).toBe(0);
      expect(f.state.player.es).toBe(0);
      expect(f.arena.intent?.channel).toBeUndefined();
      expect(f.state.skills.cd[id]).toBe(5);
    } finally { installed.restore(); }
  });
  it('retains a channel with no currently queued pulse and restores only unpaid work', () => {
    const installed = installSyntheticSkill(id, row);
    try {
      const f = channelFixture();
      f.work.resolveFlight(f.arena.flights[0], 500_000);
      f.arena.flights = [];
      f.state.pendingWork = normalizePendingWork(snapshotPendingWork(f.arena, f.state.group));
      expect(f.state.pendingWork?.flights.map(flight => flight.impactIndex)).toEqual([1, 2, 3, 4, 5]);
      restorePendingWork(f.arena, f.state);
      for (const flight of [...f.arena.flights]) f.work.resolveFlight(flight, flight.timing.impactAtUs);
      expect(f.payments).toHaveLength(6);
      expect(f.state.player.mana).toBe(60);
    } finally { installed.restore(); }
  });

  it('exhausts exact final funding immediately and still pays missed intervals', () => {
    const installed = installSyntheticSkill(id, row);
    try {
      const exact = channelFixture(15);
      exact.work.resolveFlight(exact.arena.flights[0], 500_000);
      expect(exact.state.player.mana).toBe(0);
      expect(exact.arena.intent?.channel).toBeUndefined();
      expect(exact.arena.flights).toHaveLength(0);
      const missed = channelFixture();
      missed.c.accuracy = 0; missed.state.group[0].evasion = 1e9;
      for (const flight of [...missed.arena.flights]) missed.work.resolveFlight(flight, flight.timing.impactAtUs);
      expect(missed.payments).toHaveLength(6);
      expect(missed.hits).toHaveLength(0);
      expect(missed.state.player.mana).toBe(60);
    } finally { installed.restore(); }
  });

  it('hits every line member before a projectile barrier with one interval payment', () => {
    const installed = installSyntheticSkill(id, row);
    try {
      const f = channelFixture();
      f.state.group.push(mobFixture({ id: 'behind', hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0 }));
      f.arena.mobs.behind = { ...f.arena.mobs.target, id: 'behind', x: 5, y: 6 };
      f.arena.nav = { version: 1, bounds: { x: 0, y: 0, width: 20, height: 20 }, cellSize: 1,
        obstacles: [{ kind: 'box', id: 'screen', x: 4, y: 4, width: .2, height: 4,
          flags: { movement: false, sight: false, projectiles: true } }] };
      f.work.resolveFlight(f.arena.flights[0], 500_000);
      expect(f.state.group[0].hp).toBeLessThan(1e9);
      expect(f.state.group[1].hp).toBe(1e9);
      f.arena.nav = undefined;
      f.work.resolveFlight(f.arena.flights[0], 1_000_000);
      expect(f.state.group[1].hp).toBeLessThan(1e9);
      expect(f.payments).toEqual([5, 5]);
    } finally { installed.restore(); }
  });

  it.each(['rate', 'index', 'gap', 'unfunded-free'] as const)('repairs malformed channel %s without replaying it', corruption => {
    const installed = installSyntheticSkill(id, row);
    try {
      const f = channelFixture();
      const work = snapshotPendingWork(f.arena, f.state.group)!;
      if (corruption === 'rate') work.intent!.channel!.manaPerTick = Infinity;
      if (corruption === 'index') work.intent!.channel!.nextTick = .5;
      if (corruption === 'gap') work.flights.splice(1, 1);
      if (corruption === 'unfunded-free') work.intent!.channel!.manaPerTick = 0;
      expect(normalizePendingWork(work)).toBeNull();
      expect(f.state.player.mana).toBe(90);
    } finally { installed.restore(); }
  });
  it('pays six complete intervals, retains line membership, and begins cooldown only after last hit', () => {
    const installed = installSyntheticSkill(id, row);
    try {
      const f = channelFixture();
      expect(f.state.skills.cd[id] || 0).toBe(0);
      for (const flight of [...f.arena.flights]) {
        f.work.resolveFlight(flight, flight.timing.impactAtUs);
      }
      expect(f.payments).toEqual([5, 5, 5, 5, 5, 5]);
      expect(f.hits).toHaveLength(6);
      expect(f.state.player.mana).toBe(60);
      expect(f.state.skills.cd[id]).toBe(5);
      expect(f.arena.intent?.channel).toBeUndefined();
      expect(f.arena.intent?.recoveryUntilUs).toBe(3_200_000);
    } finally { installed.restore(); }
  });

  it.each(['release', 'movement', 'control', 'new-cast', 'payment'] as const)('ends on %s with no partial interval or stale callback damage', reason => {
    const installed = installSyntheticSkill(id, row);
    try {
      const f = channelFixture();
      const flights = [...f.arena.flights];
      f.work.resolveFlight(flights[0], 500_000);
      if (reason === 'release') { f.arena.intent!.manual = true; f.arena.intent!.holdToken = 'key:Digit1'; }
      if (reason === 'movement') f.arena.player.x += .2;
      if (reason === 'control') f.state.playerStatuses.shock = { secLeft: 1 } as any;
      if (reason === 'new-cast') f.manual.cast = { skillId: id };
      if (reason === 'payment') f.state.player.mana = 4;
      f.work.resolveFlight(flights[1], 1_000_000);
      f.work.resolveFlight(flights[0], 1_000_000);
      for (const flight of flights.slice(2)) f.work.resolveFlight(flight, flight.timing.impactAtUs);
      expect(f.payments).toEqual([5]);
      expect(f.hits).toHaveLength(1);
      expect(f.state.skills.cd[id]).toBe(5);
      finishRayChannel(f.arena, f.state, 9_000_000, 'again');
      expect(f.arena.intent?.recoveryUntilUs).toBe(1_200_000);
    } finally { installed.restore(); }
  });

  it('requires upfront plus first tick, skips triggers, and snapshots the canonical level cost', () => {
    const installed = installSyntheticSkill(id, row);
    try {
      const s = newSkillState(); s.owned[id] = 0; s.list[0] = id;
      const c = buildCharacter(30, emptyGear()); const targets = [mobFixture()];
      expect(prepareSkillCast(s, c, id, 14.99, targets, {})).toBeNull();
      expect(s.cd[id] || 0).toBe(0);
      expect(prepareSkillCast(s, c, id, 15, targets, {})).not.toBeNull();
      // Merged channel contract: an immediate aggregate funds the whole window offline.
      const s2 = newSkillState(); s2.owned[id] = 0; s2.list[0] = id;
      const offline = castOnce(s2, c, 100, targets, {}, () => .5);
      expect(offline).not.toBeNull();
      expect(offline!.manaCost).toBeCloseTo(40, 6);
      expect(skillEligibility(s, c, id, 100, targets, {}, { trigger: { manaMult: 1, damageMult: 1 } }).ready).toBe(false);
      expect(sm.channelRateOf(sm.byId[id], { skillLevel: 10 })).toBeGreaterThan(10);
    } finally { installed.restore(); }
  });

  it('retains ownership between ticks across JSON and stops a restored manual hold at checkpoint', () => {
    const installed = installSyntheticSkill(id, row);
    try {
      const f = channelFixture();
      f.work.resolveFlight(f.arena.flights[0], 500_000);
      f.arena.nowUs = 750_000;
      f.arena.intent!.manual = true; f.arena.intent!.holdToken = 'pointer:1';
      f.state.pendingWork = normalizePendingWork(JSON.parse(JSON.stringify(snapshotPendingWork(f.arena, f.state.group))));
      expect(f.state.pendingWork?.intent?.channel?.nextTick).toBe(1);
      const restored = createCombatArena();
      syncCombatArena(restored, f.state, 750_000, 1e6, f.c.maxHp);
      restorePendingWork(restored, f.state);
      expect(restored.flights).toHaveLength(0);
      expect(f.state.player.mana).toBe(85);
      expect(f.state.skills.cd[id]).toBe(5);
      expect(restored.intent?.recoveryUntilUs).toBe(950_000);
    } finally { installed.restore(); }
  });

  it('launches through the live intent, then cancels on physical release before the first payment', () => {
    const installed = installSyntheticSkill(id, row);
    try {
      const state = newGame(41); setLevel(state, 30); state.hunting = true;
      state.group = [mobFixture({ id: 'target', hp: 1e9, hpMax: 1e9, innate: [], skillIds: [] })];
      state.skills.owned[id] = 0; state.skills.list.fill(null); state.skills.list[0] = id;
      state.player.mana = characterSheet(state).maxMana;
      const arena = createCombatArena(); syncCombatArena(arena, state, 0, 1e6, characterSheet(state).maxHp);
      Object.assign(arena.player, { x: 1, y: 6 }); Object.assign(arena.mobs.target, { x: 3, y: 6 });
      pinFieldPopulation(state);
      const manual: ManualControl = { holdToken: 'key:Digit1', cast: { skillId: id, holdToken: 'key:Digit1' } };
      for (let i = 0; i < 10 && !arena.intent?.channel; i++) stepCombat(state, { arena, manual });
      expect(arena.intent?.channel).toBeDefined();
      expect(state.skills.cd[id] || 0).toBe(0);
      manual.holdToken = undefined;
      stepCombat(state, { arena, manual });
      expect(arena.intent?.channel).toBeUndefined();
      expect(arena.flights.filter(f => f.cast.id === id)).toHaveLength(0);
      expect(state.skills.cd[id]).toBeGreaterThan(0);
    } finally { installed.restore(); }
  });

  it.each([NaN, Infinity, -1, 0])('rejects invalid drain %s', rate => {
    const installed = installSyntheticSkill(id, { ...row, channel: { mana_per_sec: rate } });
    try { expect(() => normalizeSkillAction(installed.row)).toThrow(); }
    finally { installed.restore(); }
  });

  it('offline ticks retain the automatic channel and charge only the elapsed intervals', async () => {
    const installed = installSyntheticSkill(id, { ...row,
      area: { origin: 'caster', radius_m: 0, shape: 'line', length_m: 100, width_m: 20 } });
    try {
      const state = newGame(41); setLevel(state, 30); state.hunting = true;
      state.group = [mobFixture({ id: 'target', hp: 1e9, hpMax: 1e9, innate: [], skillIds: [] })];
      state.skills.owned[id] = 0; state.skills.list.fill(null); state.skills.list[0] = id;
      state.player.mana = 100;
      pinFieldPopulation(state);
      state.field!.offlineCredit = 1;
      tick(state, { online: false });
      expect(state.pendingWork?.offline, JSON.stringify({ log: state.log.slice(-5), skills: state.skills,
        hp: state.player.hp, group: state.group.map(m => m.id), field: state.field?.engagementIds })).toBe(true);
      expect(state.pendingWork?.intent?.channel?.nextTick).toBe(1);
      const saved = JSON.parse(JSON.stringify(state));
      const sync = JSON.parse(JSON.stringify(saved));
      const async = JSON.parse(JSON.stringify(saved));
      const reloaded = importJson(exportJson(importJson(exportJson(state))));
      expect(reloaded.pendingWork?.intent?.channel?.nextTick).toBe(1);
      expect(reloaded.pendingWork?.flights.map(flight => flight.timing.impactAtUs)).toEqual(state.pendingWork?.flights.map(flight => flight.timing.impactAtUs));
      expect(catchUp(sync, 3).simulated).toBe(3);
      expect((await catchUpAsync(async, 3)).simulated).toBe(3);
      expect(catchUp(reloaded, 3).simulated).toBe(3);
      expect(reloaded.player.mana).toBeCloseTo(sync.player.mana, 8);
      expect(reloaded.group.map(mob => mob.hp)).toEqual(sync.group.map((mob: any) => mob.hp));
      expect(reloaded.skills.cd[id]).toBeCloseTo(sync.skills.cd[id], 8);
      expect(sync.player.mana).toBeCloseTo(async.player.mana, 8);
      expect(sync.group.map((m: any) => m.hp)).toEqual(async.group.map((m: any) => m.hp));
      expect(sync.pendingWork?.intent?.channel).toBeUndefined();
      expect(sync.skills.cd[id]).toBeGreaterThan(0);
    } finally { installed.restore(); }
  });
});
