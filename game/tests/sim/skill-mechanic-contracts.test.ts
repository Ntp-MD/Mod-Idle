import { describe, expect, it } from 'vitest';
import { E, sm } from '../../src/engine/client';
import { buildCharacter, emptyGear } from '@sim/core/player';
import { newSkillState, prepareSkillCast, resolvePreparedCast } from '@sim/combat/skills';
import { newMobStatusStore, setStacks, stepMobParts } from '@sim/combat/mobStatus';
import { dispatchSkillFlights } from '@sim/core/tick/flights';
import { normalizePendingWork, restorePendingWork, snapshotPendingWork } from '@sim/core/pending-work';
import { createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel } from '@sim/core/game';
import type { CombatFlight } from '@sim/combat/combat-actions';
import { installSyntheticSkill } from '../fixtures/skillFixture';
import { mobFixture } from '../fixtures/mobFixture';

const projectile = { delivery: 'projectile', range_m: 5, windup_sec: .1, recovery_sec: .2 };
const timing = { delivery: 'projectile' as const, startedAtUs: 0, releaseAtUs: 0, impactAtUs: 100_000, recoveryUntilUs: 200_000 };

describe('status mechanic contracts through committed payloads', () => {
  it.each(['dodge', 'expiry'] as const)('does not consume setup stacks after %s', reason => {
    const id = 'test.consume-refusal';
    const status = reason === 'expiry' ? 'burn' : 'poison';
    const installed = installSyntheticSkill(id, { effects: [
      { stat: 'consume_status', status, op: 'add_pct', value: 10, subject: 'target' },
    ] });
    try {
      const s = newSkillState(); s.owned[id] = 0; s.list[0] = id;
      const c = { ...buildCharacter(30, emptyGear()), accuracy: 1, alignment: 0 };
      const target = mobFixture({ id: 'target', hp: 1e9, hpMax: 1e9, evasion: 0,
        dodgeRate: reason === 'dodge' ? 1e9 : 0 });
      const store = newMobStatusStore(); setStacks(store, target.id, status, 3, 0);
      if (reason === 'expiry') store.target.statuses.burn!.secLeft = 0;
      const prepared = prepareSkillCast(s, c, id, 100, [target], {})!;
      const report = resolvePreparedCast(s, c, prepared, {}, () => .01, { mobStatus: store });
      expect(report.consumed).toBeUndefined();
      expect(store.target.statuses[status]?.stacks).toBe(3);
      if (reason === 'dodge') expect(report.targets).toBe(0);
    } finally { installed.restore(); }
  });

  it.each([1, 3])('queue footprint copying uses exactly the committed %i-body target budget', count => {
    const id = 'test.queue-copy';
    const installed = installSyntheticSkill(id, { offline_targets: String(count), area: { origin: 'target', radius_m: 3 },
      effects: [{ stat: 'spread_status', status: 'poison', op: 'add_flat', value: 100, subject: 'target', spread_scope: 'footprint' }],
    });
    try {
      const s = newSkillState(); s.owned[id] = 0; s.list[0] = id;
      const c = { ...buildCharacter(30, emptyGear()), accuracy: 1e9, alignment: 0 };
      const group = ['primary', 'second', 'third', 'outside-queue'].map(id => mobFixture({ id, hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0 }));
      const store = newMobStatusStore(); setStacks(store, 'primary', 'poison', 2, 0);
      const prepared = prepareSkillCast(s, c, id, 100, group, {})!;
      const report = resolvePreparedCast(s, c, prepared, {}, () => .5, { mobStatus: store, availableGroup: group });
      expect(report.spread?.[0].to.length ?? 0).toBe(count - 1);
      expect(store['outside-queue']?.statuses.poison).toBeUndefined();
    } finally { installed.restore(); }
  });
  it.each(['per-impact', 'refresh-status'] as const)('%s repeats weapon riders while preserving control bounds and the one self window', policy => {
    const id = 'test.control-cadence';
    const installed = installSyntheticSkill(id, { cast: projectile, element: 'lightning', duration: '3 sec',
      rules: ['every_target', 'guaranteed_status', 'self_window'],
      action: { kind: 'projectile-burst', effect_policy: policy, interval_sec: .2 },
      effects: [{ stat: 'hits', op: 'add_flat', value: 3, subject: 'self' }],
    });
    try {
      const s = newSkillState(); s.owned[id] = 0; s.list[0] = id;
      const c = { ...buildCharacter(30, emptyGear()), accuracy: 1e9, alignment: 100, bleedChance: 100 };
      const targets = ['target', 'immune'].map(id => mobFixture({ id, hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0,
        immune: id === 'immune' ? ['shock', 'bleed'] : [] }));
      const store = newMobStatusStore();
      const prepared = prepareSkillCast(s, c, id, 100, targets, {}, { spatialTargets: true })!;
      const base = { actionId: 1, cast: prepared, timing, profile: sm.castProfileOf(installed.row) } as CombatFlight;
      const flights = dispatchSkillFlights(base, sm.actionOf(installed.row), installed.row, timing, 1e6).flights;
      const pulse = (index: number) => resolvePreparedCast(s, c, prepared, {}, () => .5,
        { mobStatus: store, impact: { index, sharePct: 100, cache: flights[index].rolls! } });
      pulse(0);
      expect(s.buffUp[id]).toBe(3);
      const stopped = store.target.stoppedUntil;
      s.buffUp[id] = 1;
      store.target.statuses.bleed!.secLeft = 1;
      pulse(1); pulse(2);
      expect(store.target.statuses.bleed?.secLeft).toBeGreaterThan(1);
      expect(store.target.stoppedUntil).toBe(stopped);
      expect(store.immune?.statuses.shock).toBeUndefined();
      expect(store.immune?.statuses.bleed).toBeUndefined();
      expect(s.buffUp[id]).toBe(1);
    } finally { installed.restore(); }
  });

  it('validates footprint scope on actionless rows and keeps its full-copy marker unscaled', () => {
    const id = 'test.copy-validation';
    const installed = installSyntheticSkill(id, { effects: [
      { stat: 'spread_status', status: 'poison', op: 'add_flat', value: 100, subject: 'target', spread_scope: 'footprint' },
    ] });
    try {
      expect(sm.effectsAt(installed.row, 20)[0].value).toBe(100);
      for (const patch of [{ spread_scope: 'unknown' }, { value: 50 }, { cap: 2 }, { radius_m: 3 }, { status: 'unknown' }]) {
        const effects = [{ ...installed.row.effects![0], ...patch }];
        expect(() => sm.actionOf({ ...installed.row, effects })).toThrow();
      }
    } finally { installed.restore(); }
  });
  it('shares consumed-stack payoff across independent rolls and preserves it across reload', () => {
    const id = 'test.consuming-burst';
    const installed = installSyntheticSkill(id, { cast: projectile,
      action: { kind: 'projectile-burst', roll_policy: 'independent', effect_policy: 'per-impact', interval_sec: .2 },
      effects: [{ stat: 'hits', op: 'add_flat', value: 2, subject: 'self' },
        { stat: 'consume_status', status: 'poison', op: 'add_pct', value: 10, subject: 'target' }],
    });
    try {
      const state = newGame(41); setLevel(state, 30);
      state.skills.owned[id] = 0; state.skills.list[0] = id;
      const c = { ...characterSheet(state), accuracy: 1e9, critChance: 0, alignment: 0 };
      const mob = mobFixture({ id: 'target', hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0, armour: 0 });
      state.group = [mob]; setStacks(state.mobStatus, mob.id, 'poison', 3, 0);
      const prepared = prepareSkillCast(state.skills, c, id, 100, state.group, {})!;
      const base = { actionId: 1, cast: prepared, character: c, modifiers: {}, timing,
        profile: sm.castProfileOf(installed.row), source: { x: 0, y: 0 }, destination: { x: 1, y: 0 },
        position: { x: 0, y: 0 }, lastCheckedAtUs: 0 } as CombatFlight;
      const flights = dispatchSkillFlights(base, sm.actionOf(installed.row), installed.row, timing, 1e6).flights;
      const first = resolvePreparedCast(state.skills, c, prepared, {}, () => .5, { mobStatus: state.mobStatus,
        impact: { index: 0, sharePct: 100, cache: flights[0].rolls! } });
      expect(first.consumed?.[0].stacks).toBe(3);
      const arena = createCombatArena(); syncCombatArena(arena, state, 0, 1e6, c.maxHp);
      arena.flights = [flights[1]];
      state.pendingWork = normalizePendingWork(JSON.parse(JSON.stringify(snapshotPendingWork(arena, state.group))));
      const restored = createCombatArena(); syncCombatArena(restored, state, 0, 1e6, c.maxHp);
      restorePendingWork(restored, state);
      const second = resolvePreparedCast(state.skills, c, prepared, {}, () => .5, { mobStatus: state.mobStatus,
        impact: { index: 1, sharePct: 100, cache: restored.flights[0].rolls! } });
      expect(second.consumed).toBeUndefined();
      expect(second.byMob[0].amount).toBeCloseTo(first.byMob[0].amount, 8);
      expect(restored.flights[0].rolls?.payoffs?.target.consumeStacks).toBe(3);
    } finally { installed.restore(); }
  });

  it.each([false, true])('copies only the primary snapshot, including a lethal primary: %s', lethal => {
    const id = 'test.primary-footprint';
    const installed = installSyntheticSkill(id, { cast: projectile, offline_targets: '1',
      area: { origin: 'target', radius_m: 3 },
      effects: [{ stat: 'spread_status', status: 'poison', op: 'add_flat', value: 100, subject: 'target', spread_scope: 'footprint' }],
    });
    try {
      const s = newSkillState(); s.owned[id] = 0; s.list[0] = id;
      const c = { ...buildCharacter(30, emptyGear()), accuracy: 1e9, critChance: 0, alignment: 0 };
      const primary = mobFixture({ id: 'primary', hp: lethal ? 1 : 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0 });
      const recipient = mobFixture({ id: 'recipient', hp: 1e9, hpMax: 1e9 });
      const immune = mobFixture({ id: 'immune', hp: 1e9, hpMax: 1e9, immune: ['poison'] });
      const outside = mobFixture({ id: 'outside', hp: 1e9, hpMax: 1e9 });
      const store = newMobStatusStore(); setStacks(store, primary.id, 'poison', 3, 10);
      setStacks(store, recipient.id, 'poison', 5, 20);
      const area = { origin: 'target' as const, radiusM: 3, targetId: primary.id, center: { x: 0, y: 0 } };
      const prepared = prepareSkillCast(s, c, id, 100, [primary], {}, { spatialTargets: true }, area)!;
      const report = resolvePreparedCast(s, c, prepared, {}, () => .5, { mobStatus: store,
        availableGroup: [primary, recipient, immune, outside], positionOf: body => ({ x: body === 'outside' ? 10 : 1, y: 0 }) });
      expect(report.spread?.[0].to).toEqual(['recipient']);
      expect(store.recipient.statuses.poison?.stacks).toBe(5);
      expect(store.primary.statuses.poison?.stacks).toBe(3);
      expect(store.immune?.statuses.poison).toBeUndefined();
      expect(store.outside?.statuses.poison).toBeUndefined();
      expect(primary.hp <= 0).toBe(lethal);
    } finally { installed.restore(); }
  });

  it('does not use an infected secondary when the primary is clean or later in input order', () => {
    const id = 'test.no-cascade';
    const installed = installSyntheticSkill(id, { cast: projectile, offline_targets: '3', area: { origin: 'target', radius_m: 3 },
      rules: ['every_target'], effects: [{ stat: 'spread_status', status: 'poison', op: 'add_flat', value: 100, subject: 'target', spread_scope: 'footprint' }],
    });
    try {
      const s = newSkillState(); s.owned[id] = 0; s.list[0] = id;
      const c = { ...buildCharacter(30, emptyGear()), accuracy: 1e9, alignment: 0 };
      const group = ['secondary', 'primary', 'recipient'].map(id => mobFixture({ id, hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0 }));
      const store = newMobStatusStore(); setStacks(store, 'secondary', 'poison', 5, 10);
      const area = { origin: 'target' as const, radiusM: 3, targetId: 'primary', center: { x: 0, y: 0 } };
      const prepared = prepareSkillCast(s, c, id, 100, group, {}, { spatialTargets: true }, area)!;
      const report = resolvePreparedCast(s, c, prepared, {}, () => .5,
        { mobStatus: store, availableGroup: group, positionOf: () => ({ x: 1, y: 0 }) });
      expect(report.spread).toBeUndefined();
      expect(store.recipient?.statuses.poison).toBeUndefined();
    } finally { installed.restore(); }
  });

  it('refreshes the poison decay window through a payload without growing stacks or rate', () => {
    const id = 'test.refresh-decay';
    const installed = installSyntheticSkill(id, { cast: projectile,
      action: { kind: 'projectile-burst', effect_policy: 'refresh-status', interval_sec: .2 },
      effects: [{ stat: 'hits', op: 'add_flat', value: 2, subject: 'self' },
        { stat: 'poison_stacks', op: 'add_flat', value: 3, subject: 'target' }],
    });
    const priorDecay = E.status.poison.decay_sec;
    try {
      E.status.poison.decay_sec = 3;
      const s = newSkillState(); s.owned[id] = 0; s.list[0] = id;
      const c = { ...buildCharacter(30, emptyGear()), accuracy: 1e9, alignment: 0 };
      const targets = [mobFixture({ id: 'target', hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0 })];
      const store = newMobStatusStore();
      const prepared = prepareSkillCast(s, c, id, 100, targets, {})!;
      const base = { actionId: 1, cast: prepared, timing, profile: sm.castProfileOf(installed.row) } as CombatFlight;
      const flights = dispatchSkillFlights(base, sm.actionOf(installed.row), installed.row, timing, 1e6).flights;
      const pulse = (index: number) => resolvePreparedCast(s, c, prepared, {}, () => .5,
        { mobStatus: store, impact: { index, sharePct: 100, cache: flights[index].rolls! } });
      pulse(0); stepMobParts(store, 'target'); stepMobParts(store, 'target');
      const rate = store.target.statuses.poison!.perSec;
      pulse(1); stepMobParts(store, 'target');
      expect(store.target.statuses.poison?.stacks).toBe(3);
      expect(store.target.statuses.poison?.perSec).toBe(rate);
      stepMobParts(store, 'target'); stepMobParts(store, 'target');
      expect(store.target.statuses.poison?.stacks).toBe(2);
    } finally { E.status.poison.decay_sec = priorDecay; installed.restore(); }
  });
});
