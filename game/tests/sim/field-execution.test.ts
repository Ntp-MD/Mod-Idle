import { describe, expect, it } from 'vitest';
import { sm } from '../../src/engine/client';
import { dispatchSkillFlights } from '@sim/core/tick/flights';
import { installSyntheticSkill } from '../fixtures/skillFixture';
import { usefulFieldActive, type CombatFlight } from '@sim/combat/combat-actions';
import { captureCombatArena, createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { catchUp, characterSheet, newGame, setLevel, stepCombat, tick } from '@sim/core/game';
import { mobFixture, pinFieldPopulation } from '../fixtures/mobFixture';
import { exportJson, importJson } from '../../src/state/save';
import { NO_COND } from '@sim/combat/skills';

function fieldFight(id: string) {
  const state = newGame(41); setLevel(state, 30); state.hunting = true;
  state.skills.owned[id] = 0; state.skills.list.fill(null); state.skills.list[0] = id;
  state.group = [mobFixture({ id: 'target', hp: 1e9, hpMax: 1e9, ps: 0, evasion: 0,
    dodgeRate: 0, innate: [], skillIds: [] })];
  state.player.mana = characterSheet(state).maxMana;
  const arena = createCombatArena(); syncCombatArena(arena, state, 0, 1e6, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 1, y: 6 }); Object.assign(arena.mobs.target, { x: 3, y: 6 });
  captureCombatArena(arena, state, 0); pinFieldPopulation(state);
  return { state, arena };
}

describe('shared deployed field scheduler', () => {
  it('keeps queue fields useful only while a committed target lives', () => {
    const installed = installSyntheticSkill('test.queue-field', { action: { kind: 'meteor-field' } });
    try {
      const arena = createCombatArena(); arena.queueOnly = true;
      const target = mobFixture();
      arena.flights = [{ cast: { id: installed.row.id, targets: [target] }, timing: { impactAtUs: 100 } }] as CombatFlight[];
      expect(usefulFieldActive(arena, [target], installed.row.id)).toBe(true);
      expect(usefulFieldActive(arena, [{ ...target, hp: 0 }], installed.row.id)).toBe(false);
      expect(usefulFieldActive(arena, [mobFixture({ id: 'replacement' })], installed.row.id)).toBe(false);
      arena.nowUs = 100;
      expect(usefulFieldActive(arena, [target], installed.row.id)).toBe(false);
    } finally { installed.restore(); }
  });

  it('offline rotation skips a useful field and casts the next ordinary row', () => {
    const id = 'test.offline-field';
    const field = installSyntheticSkill(id, { cd: 1, mana: '0 flat', duration: '6 sec',
      area: { origin: 'target', radius_m: 100 },
      cast: { delivery: 'ground', range_m: 5, windup_sec: .1, recovery_sec: .1 },
      action: { kind: 'meteor-field', interval_sec: .5 },
      effects: [{ stat: 'hits', op: 'add_flat', value: 12, subject: 'self' }] });
    const follow = installSyntheticSkill('test.offline-follow', { cd: 5, mana: '0 flat' });
    try {
      const { state } = fieldFight(id);
      state.skills.owned[follow.row.id] = 0; state.skills.list[1] = follow.row.id;
      state.field!.offlineCredit = 1;
      tick(state, { online: false });
      const actionId = state.pendingWork!.flights[0].actionId;
      state.skills.cd[id] = 0;
      state.field!.offlineCredit = 1;
      tick(state, { online: false });
      expect(state.skills.cd[follow.row.id]).toBeGreaterThan(0);
      expect(state.skills.cd[id]).toBe(0);
      expect(state.pendingWork!.flights.every(flight => flight.actionId === actionId)).toBe(true);
    } finally { follow.restore(); field.restore(); }
  });

  it('offline timed selection uses the current missing HP condition', () => {
    const id = 'test.conditional-field';
    const field = installSyntheticSkill(id, { mana: '0 flat', duration: '2 sec',
      area: { origin: 'target', radius_m: 100 },
      cast: { delivery: 'ground', range_m: 5, windup_sec: .1, recovery_sec: .1 },
      action: { kind: 'meteor-field', interval_sec: .5 },
      effects: [{ stat: 'hits', op: 'add_flat', value: 4, subject: 'self' }] });
    try {
      const { state } = fieldFight(id);
      state.skills.mode[id] = 'conditional';
      state.skills.conditions[id] = { ...NO_COND, hpBelowPct: 10 };
      state.player.hp = characterSheet(state).maxHp / 2;
      state.field!.offlineCredit = 1;
      tick(state, { online: false });
      expect(state.pendingWork?.flights.some(flight => flight.skillId === id)).toBe(true);
      const reloaded = importJson(exportJson(importJson(exportJson(state))));
      expect(reloaded.pendingWork?.flights.map(flight => flight.timing.impactAtUs)).toEqual(state.pendingWork?.flights.map(flight => flight.timing.impactAtUs));
      const baseline = JSON.parse(JSON.stringify(state));
      catchUp(baseline, 2); catchUp(reloaded, 2);
      expect(reloaded.group.map(mob => mob.hp)).toEqual(baseline.group.map((mob: any) => mob.hp));
      expect(reloaded.player.mana).toBeCloseTo(baseline.player.mana, 8);
      expect(reloaded.pendingWork).toBeNull();
    } finally { field.restore(); }
  });
  it.each(['meteor-field', 'thunder-field'] as const)('%s refuses a useful recast before payment and replaces an empty deployment', kind => {
    const id = 'test.recast-field';
    const installed = installSyntheticSkill(id, { duration: '2 sec', area: { origin: 'target', radius_m: 1 },
      cast: { delivery: 'ground', range_m: 5, windup_sec: .1, recovery_sec: .1 },
      action: { kind, interval_sec: .5, effect_policy: 'per-impact' },
      effects: [{ stat: 'hits', op: 'add_flat', value: 4, subject: 'self' }],
    });
    try {
      const { state, arena } = fieldFight(id);
      for (let i = 0; i < 12 && !arena.flights.some(f => f.cast.id === id); i++) stepCombat(state, { arena });
      const old = arena.actions.find(action => action.skillId === id)!;
      expect(old).toBeDefined();
      const centre = { ...arena.flights[0].area!.center };
      const mana = state.player.mana;
      state.skills.cd[id] = 0;
      const manual = { cast: { skillId: id } as { skillId: string } | undefined };
      for (let i = 0; i < 12 && manual.cast; i++) stepCombat(state, { arena, manual });
      expect(manual.cast).toBeUndefined();
      expect(state.player.mana).toBe(mana);
      expect(state.skills.cd[id] || 0).toBe(0);
      expect(state.combatReceipts?.at(-1)?.reason).toBe('field-active');
      Object.assign(arena.mobs.target, { x: 5, y: 6 });
      manual.cast = { skillId: id };
      for (let i = 0; i < 12 && arena.actions.find(action => action.id === old.id)?.cancelledAtUs == null; i++) stepCombat(state, { arena, manual });
      expect(arena.actions.find(action => action.id === old.id)?.cancelReason).toBe('replaced');
      expect(arena.flights.every(f => f.actionId !== old.id)).toBe(true);
      expect(state.player.mana).toBeLessThan(mana);
      expect(arena.actions.find(action => action.id === old.id)?.area?.center).toEqual(centre);
    } finally { installed.restore(); }
  });
  it.each(['meteor-field', 'thunder-field', 'blizzard-field'] as const)('%s includes exactly its authored hit budget with shared rolls', kind => {
    const installed = installSyntheticSkill('test.pulsing-field', {
      duration: '4 sec', area: { origin: 'target', radius_m: 3 },
      cast: { delivery: 'ground', range_m: 5, windup_sec: .1, recovery_sec: .2 },
      action: { kind, interval_sec: .25, effect_policy: 'refresh-status' },
      effects: [{ stat: 'hits', op: 'add_flat', value: 16, subject: 'self' },
        { stat: 'hit_pct', op: 'add_pct', value: 25, subject: 'self' }],
    });
    try {
      const skill = installed.row;
      const timing = { delivery: 'ground' as const, startedAtUs: 0, releaseAtUs: 100_000,
        impactAtUs: 100_000, recoveryUntilUs: 300_000 };
      const flight = { actionId: 1, cast: { id: skill.id, targets: [] }, timing,
        area: { origin: 'target', radiusM: 3, center: { x: 4, y: 6 } } } as unknown as CombatFlight;
      const result = dispatchSkillFlights(flight, sm.actionOf(skill), skill, timing, 1e6);
      expect(result.flights).toHaveLength(16);
      expect(result.flights.map(f => f.timing.impactAtUs)).toEqual(Array.from({ length: 16 },
        (_, index) => 100_000 + (index + (kind === 'blizzard-field' ? 1 : 0)) * 250_000));
      expect(result.flights.every(f => f.impactSharePct === 25)).toBe(true);
      expect(new Set(result.flights.map(f => f.rolls)).size).toBe(1);
      expect(result.flights.every(f => f.area === flight.area && !f.follow)).toBe(true);
      expect(result.endsAtUs).toBe(4_100_000);
      expect(result.recoveryUntilUs).toBeUndefined();
    } finally { installed.restore(); }
  });
});
