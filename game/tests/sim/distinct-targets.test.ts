import { describe, expect, it } from 'vitest';
import { distinctSkillTargets } from '@engine/skill-area.ts';
import { normalizeSkillAction } from '@engine/skills.ts';
import { arenaBurstCandidates, arenaSkillTargets, createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { intentTargets } from '@sim/combat/combat-actions';
import { dispatchSkillFlights } from '@sim/core/tick/flights';
import { buildCharacter, emptyGear } from '@sim/core/player';
import { characterSheet, newGame, setLevel, stepCombat } from '@sim/core/game';
import { newSkillState, prepareSkillCast, resolvePreparedCast } from '@sim/combat/skills';
import { mulberry32 } from '../../src/engine/client-helpers';
import { sm } from '../../src/engine/client';
import { installSyntheticSkill } from '../fixtures/skillFixture';
import { mobFixture } from '../fixtures/mobFixture';
import type { CombatFlight } from '@sim/combat/combat-actions';
import { captureCombatArena } from '@sim/combat/combat-arena';
import { snapshotPendingWork, restorePendingWork } from '@sim/core/pending-work';
import { exportJson, importJson } from '../../src/state/save';
import { pinFieldPopulation } from '../fixtures/mobFixture';

const id = 'test.distinct-volley';
const override = {
  cast: { delivery: 'projectile', range_m: 5, windup_sec: .1, recovery_sec: .2 },
  area: { origin: 'caster', radius_m: 0 }, offline_targets: '8',
  action: { kind: 'targeted-burst', distinct_targets: true, tracking: 'homing', interval_sec: .2 },
  effects: [{ stat: 'hits', op: 'add_flat', value: 4, subject: 'self' }],
};

describe('distinct-target acquisition', () => {
  it('selects without replacement using seed and stable identity, independent of input order', () => {
    const targets = ['d', 'a', 'c', 'b', 'e'].map(id => ({ id }));
    const select = (seed: number, rows = targets) => distinctSkillTargets(rows, 4, mulberry32(seed)).map(t => t.id);
    expect(select(11)).toEqual(select(11, [...targets].reverse()));
    expect(new Set(select(11)).size).toBe(4);
    expect(select(11)).not.toEqual(select(12));
    expect(distinctSkillTargets([], 4, () => { throw Error('empty selection spends RNG'); })).toEqual([]);
  });

  it.each([0, 1, 2, 7])('binds %i candidates once and preserves all emission slots', count => {
    const installed = installSyntheticSkill(id, override);
    try {
      const targets = Array.from({ length: count }, (_, i) => mobFixture({ id: `body-${i}` }));
      const skill = sm.byId[id];
      const profile = sm.castProfileOf(skill);
      const timing = { delivery: 'projectile' as const, startedAtUs: 0, releaseAtUs: 100_000, impactAtUs: 300_000, recoveryUntilUs: 400_000 };
      const flight = { actionId: 1, cast: { id, targets }, profile, timing,
        source: { x: 0, y: 0 }, destination: { x: 1, y: 0 } } as CombatFlight;
      const result = dispatchSkillFlights(flight, sm.actionOf(skill), skill, timing, 1e6,
        { rng: mulberry32(12), positionOf: () => ({ x: 2, y: 1 }) });
      expect(result.flights).toHaveLength(4);
      expect(result.recoveryUntilUs).toBe(1_000_000);
      const bound = result.flights.filter(f => f.cast.targets.length);
      expect(new Set(bound.map(f => f.boundTargetId)).size).toBe(Math.min(4, count));
      expect(new Set(result.flights.map(f => f.rolls)).size).toBe(4);
      for (const f of bound) {
        expect(f.area?.targetId).toBe(f.boundTargetId);
        expect(f.cast.targets.map(t => t.id)).toEqual([f.boundTargetId]);
      }
    } finally { installed.restore(); }
  });

  it('acquires across caster reach despite zero-radius impacts and manual focus/point', () => {
    const installed = installSyntheticSkill(id, override);
    try {
      const state = newGame(41); setLevel(state, 30);
      state.group = ['near', 'edge', 'outside', 'dead'].map(id => mobFixture({ id }));
      state.group[3].hp = 0;
      const arena = createCombatArena();
      syncCombatArena(arena, state, 0, 1e6, characterSheet(state).maxHp);
      Object.assign(arena.player, { x: 1, y: 6 });
      for (const [index, mob] of state.group.entries()) {
        if (arena.mobs[mob.id]) Object.assign(arena.mobs[mob.id], { x: [2, 6, 6.001, 2][index], y: 6 });
      }
      expect(arenaBurstCandidates(arena, id, state.group).map(m => m.id)).toEqual(['near', 'edge']);
      expect(arenaSkillTargets(arena, id, state.group).targets.map(m => m.id)).toEqual(['near', 'edge']);
      expect(intentTargets(arena, state.group, { skillId: id, targetId: 'near',
        targetPoint: { x: 2, y: 6 }, phase: 'windup', manual: true, aimPoint: true }).targets.map(m => m.id))
        .toEqual(['near', 'edge']);
    } finally { installed.restore(); }
  });

  it('offline queue resolves each binding once, without rebinding a lethal hit', () => {
    const installed = installSyntheticSkill(id, override);
    try {
      const state = newSkillState(); state.owned[id] = 0; state.list[0] = id;
      const c = buildCharacter(30, emptyGear());
      const group = ['a', 'b', 'c'].map(id => mobFixture({ id, hp: 1, hpMax: 1, evasion: 0, dodgeRate: 0 }));
      const prepared = prepareSkillCast(state, c, id, 1e9, group, {})!;
      const report = resolvePreparedCast(state, c, prepared, {}, mulberry32(12));
      expect(report.byMob).toHaveLength(3);
      expect(new Set(report.byMob.map(hit => hit.id)).size).toBe(3);
    } finally { installed.restore(); }
  });

  it('rejects invalid distinct and pursuit declarations before payment', () => {
    const installed = installSyntheticSkill(id, override);
    try {
      const row = sm.byId[id];
      for (const action of [
        { ...row.action!, distinct_targets: 'yes' }, { ...row.action!, kind: 'projectile-burst' },
        { ...row.action!, tracking: 'unknown' }, { ...row.action!, pursuit_sec: -1 },
        { ...row.action!, tracking: 'straight', pursuit_range_m: Infinity },
      ]) expect(() => normalizeSkillAction({ ...row, action } as any)).toThrow();
    } finally { installed.restore(); }
  });

  it('live release binds separate bodies and reload preserves unspent bindings without selection RNG', () => {
    const installed = installSyntheticSkill(id, override);
    try {
      const state = newGame(41); setLevel(state, 30); state.hunting = true;
      state.skills.owned[id] = 0; state.skills.list.fill(null); state.skills.list[0] = id;
      state.group = ['a', 'b', 'c'].map(id => mobFixture({ id, hp: 1e9, hpMax: 1e9, ps: 0,
        evasion: 0, dodgeRate: 0, innate: [], skillIds: [] }));
      state.player.mana = characterSheet(state).maxMana;
      const arena = createCombatArena(); syncCombatArena(arena, state, 0, 1e6, characterSheet(state).maxHp);
      Object.assign(arena.player, { x: 1, y: 6 });
      for (const [index, mob] of state.group.entries()) Object.assign(arena.mobs[mob.id], { x: 4, y: 5 + index });
      captureCombatArena(arena, state, 0); pinFieldPopulation(state);
      for (let step = 0; step < 20 && !arena.flights.some(f => f.cast.id === id); step++) stepCombat(state, { arena });
      const pending = arena.flights.filter(f => f.cast.id === id);
      expect(pending).toHaveLength(4);
      expect(new Set(pending.map(f => f.boundTargetId).filter(value => !value?.startsWith('__fizzle__'))).size).toBe(3);
      state.pendingWork = snapshotPendingWork(arena, state.group);
      const restoredState = importJson(exportJson(state));
      const restoredArena = createCombatArena();
      syncCombatArena(restoredArena, restoredState, arena.nowUs, 1e6, characterSheet(restoredState).maxHp);
      const seed = restoredState.rngState;
      restorePendingWork(restoredArena, restoredState);
      expect(restoredArena.flights.map(f => f.boundTargetId)).toEqual(pending.map(f => f.boundTargetId));
      expect(restoredState.rngState).toBe(seed);
      expect(restoredArena.flights.map(f => f.timing.releaseAtUs)).toEqual(pending.map(f => f.timing.releaseAtUs));
    } finally { installed.restore(); }
  });
});
