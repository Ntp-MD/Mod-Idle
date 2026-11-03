import { describe, expect, it } from 'vitest';
import { E, sm } from '../../src/engine/client';
import { captureCombatArena, createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import type { ManualControl } from '@sim/combat/combat-actions';
import { characterSheet, newGame, setLevel, stepCombat } from '@sim/core/game';
import { lineValue } from '@sim/combat/curse';
import { mobFixture, pinFieldPopulation } from '../fixtures/mobFixture';
import { liveProximitySpecies } from '../fixtures/liveMob';

const PROXIMITY = () => { const species = liveProximitySpecies(); return { species: species.name, speciesId: species.id }; };
import { installSyntheticSkill } from '../fixtures/skillFixture';
import { liveId, hasStat } from '../fixtures/liveSkill';
const INSTANT_HEAL = liveId(row => row.type === 'heal' && hasStat(row, 'heal_instant'), 'instant healing');
const HEAL_OVER_TIME = liveId(row => row.type === 'heal' && hasStat(row, 'heal_per_sec'), 'healing over time');
const WEAKEN = liveId(row => row.type === 'curse' && hasStat(row, 'damage_dealt'), 'curse damage scaling');
const ELEMENT_DEBUFF = liveId(row => row.type === 'attack' && (row.effects ?? []).some((effect: any) => effect.stat === 'mob_elemental_damage_taken_pct' && !effect.condition), 'target effect scaling');

function fight(skillId: string, level = E.skill_xp.level_cap) {
  const state = newGame(31);
  setLevel(state, 60);
  state.hunting = true;
  state.group = [mobFixture({ id: 'target', hp: 1e9, hpMax: 1e9, ps: 0, acc: 0,
    innate: [], skillIds: [], line: 'stand-off', ...PROXIMITY() })];
  state.skills.list.fill(null);
  state.skills.list[0] = skillId;
  state.skills.owned[skillId] = 0;
  state.skills.xp[skillId] = sm.skillXpForLevel(level);
  const weapon = sm.byId[skillId]?.weapon;
  if (weapon) state.gear[0] = { slot: 'main hand', base: weapon, ilvl: 1, quality: 'Normal', tier: 'T1', lines: [] } as never;
  const sheet = characterSheet(state);
  state.player.hp = 1;
  state.player.mana = sheet.maxMana;
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, sheet.maxHp);
  Object.assign(arena.player, { x: 1, y: 6 });
  Object.assign(arena.mobs.target, { x: 2, y: 6 });
  captureCombatArena(arena, state, 0);
  pinFieldPopulation(state);
  const manual: ManualControl = { cast: { skillId } };
  const stepUntil = (done: () => boolean, limit = 100) => {
    for (let i = 0; i < limit && !done(); i++) stepCombat(state, { arena, autoSkills: false, manual });
    expect(done()).toBe(true);
  };
  return { state, arena, sheet, stepUntil };
}

const scaledValue = (id: string, stat: string, level = E.skill_xp.level_cap) =>
  sm.effectsAt(sm.byId[id], level).find(effect => effect.stat === stat)!.value;

describe('skill effect levels reach live cast outcomes', () => {
  it('restores the scaled instant-heal share to the player with one payment and cooldown', () => {
    const id = INSTANT_HEAL;
    const { state, sheet, stepUntil } = fight(id);
    const hpBefore = state.player.hp;
    const targetHp = state.group[0].hp;
    stepUntil(() => state.fx.some(event => event.kind === 'heal' && event.skillId === id));
    expect(state.player.hp - hpBefore).toBeCloseTo(sheet.maxHp * scaledValue(id, 'heal_instant') / 100, 8);
    expect(state.group[0].hp).toBe(targetHp);
    expect(state.fx.filter(event => event.kind === 'cast' && event.skillId === id)).toHaveLength(1);
    expect(state.skills.cd[id]).toBeGreaterThan(0);
    expect(state.player.mana).toBeCloseTo(sheet.maxMana - sm.manaCostOf(sm.byId[id], { skillLevel: E.skill_xp.level_cap }), 8);
  });

  it('applies the scaled healing-over-time strength without scaling its authored duration', () => {
    const id = HEAL_OVER_TIME;
    const { state, stepUntil } = fight(id);
    stepUntil(() => !!state.healUp);
    expect(state.healUp!.pctPerSec).toBeCloseTo(scaledValue(id, 'heal_per_sec') / 100, 10);
    expect(state.healUp!.secLeft).toBe(Number.parseFloat(sm.byId[id].duration!));
  });

  it('writes the curse skill strength at its level without direct damage or a longer duration', () => {
    const id = WEAKEN;
    const { state, stepUntil } = fight(id);
    const targetHp = state.group[0].hp;
    stepUntil(() => lineValue(state.curses, 'target', 'damage_dealt') !== 0);
    expect(lineValue(state.curses, 'target', 'damage_dealt')).toBeCloseTo(scaledValue(id, 'damage_dealt'), 10);
    expect(state.curses.target.damage_dealt.secLeft).toBe(Number.parseFloat(sm.byId[id].duration!));
    expect(state.group[0].hp).toBe(targetHp);
  });

  it('writes scaled target effects from an attack after its actual damage lands', () => {
    const id = ELEMENT_DEBUFF;
    const { state, stepUntil } = fight(id);
    const targetHp = state.group[0].hp;
    stepUntil(() => state.fx.some(event => event.kind === 'hit' && event.skillId === id));
    expect(state.group[0].hp).toBeLessThan(targetHp);
    expect(lineValue(state.curses, 'target', 'mob_elemental_damage_taken_pct'))
      .toBeCloseTo(scaledValue(id, 'mob_elemental_damage_taken_pct'), 10);
  });

  it('keeps the release level when a curse levels up during projectile travel', () => {
    // A scenario-owned curse: the travel window is the mechanic under test,
    // not any live row's numbers.
    const installed = installSyntheticSkill('test.curse_level_snapshot', {
      name: 'Snapshot Curse', type: 'curse', duration: '8 sec',
      effects: [{ stat: 'damage_dealt', op: 'add_pct', value: -25, subject: 'target' }],
      cast: { delivery: 'projectile', range_m: 5, windup_sec: 0.15, recovery_sec: 0.15,
        projectile_speed_mps: 1, hit_radius_m: 0.01 } });
    const id = installed.row.id;
    try {
      const { state, arena, stepUntil } = fight(id, 1);
      stepUntil(() => arena.flights.some(flight => flight.cast.id === id));
      state.skills.xp[id] = sm.skillXpForLevel(E.skill_xp.level_cap);
      stepUntil(() => lineValue(state.curses, 'target', 'damage_dealt') !== 0);
      expect(lineValue(state.curses, 'target', 'damage_dealt'))
        .toBeCloseTo(scaledValue(id, 'damage_dealt', 1), 10);
    } finally {
      installed.restore();
    }
  });
});

describe('authored impact counts and shares at skill cap', () => {
  it.each(sm.all().filter(row => !row.retired && ['targeted-burst', 'projectile-burst', 'blizzard-field'].includes(row.action?.kind ?? '')).map(row => row.id))('%s executes the authored count and share', (id) => {
    const { state, arena, stepUntil } = fight(id);
    const row = sm.byId[id];
    const expectedCount = row.effects!.find(effect => effect.stat === 'hits')!.value;
    const expectedShare = row.effects!.find(effect => effect.stat === 'hit_pct')?.value ?? 100;
    stepUntil(() => state.fx.some(event => event.kind === 'cast' && event.skillId === id));
    const action = arena.actions.find(entry => entry.skillId === id)!;
    expect(action).toBeDefined();
    const pending = arena.flights.filter(flight => flight.actionId === action.id);
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every(flight => flight.impactSharePct === expectedShare)).toBe(true);
    stepUntil(() => !arena.flights.some(flight => flight.actionId === action.id), 600);
    const resolved = arena.actions.find(entry => entry.id === action.id)!;
    expect(resolved.impactCount).toBe(expectedCount);
    if (row.cast?.delivery === 'projectile') expect(resolved.payloads).toHaveLength(expectedCount);
    expect(arena.actions.filter(entry => entry.skillId === id)).toHaveLength(1);
    expect(state.skills.cd[id]).toBeGreaterThan(0);
  });
});

describe('live skill phase commitments', () => {
  const hasteId = 'test.skill_contract_haste';
  function addHaste(state: ReturnType<typeof newGame>, haste: number) {
    sm.byId[hasteId] = { id: hasteId, type: 'buff', duration: '1000 sec',
      effects: [{ stat: 'global_speed', op: 'mult', value: haste, subject: 'self' }] };
    state.skills.owned[hasteId] = 0;
    state.skills.buffUp[hasteId] = 1000;
    expect(characterSheet(state).castSpeed).toBe(haste);
  }

  it('keeps actual release and recovery at the authored animation floor under high haste', () => {
    const installed = installSyntheticSkill('test.animation-floor', { name: 'Animation Floor',
      cast: { delivery: 'projectile', range_m: 5, windup_sec: 0.5, fixed_windup_sec: 0,
        recovery_sec: 0.5, fixed_recovery_sec: 0 } });
    const id = installed.row.id;
    try {
      const { state, arena, stepUntil } = fight(id);
      addHaste(state, 100);
      stepUntil(() => state.fx.some(event => event.kind === 'cast' && event.skillId === id));
      const action = arena.actions.find(entry => entry.skillId === id)!;
      const timing = action.primaryTiming!;
      const floorUs = Math.round(Math.max(E.combat_arena.movement_step_sec,
        E.combat_arena.animation_phase_floor_sec) * arena.unitsPerSec);
      expect(timing.releaseAtUs - timing.startedAtUs).toBe(floorUs);
      expect(timing.recoveryUntilUs - timing.releaseAtUs).toBe(floorUs);
      expect(state.fx.find(event => event.kind === 'cast' && event.skillId === id)!.atUs).toBe(timing.releaseAtUs);
    } finally {
      installed.restore();
      delete sm.byId[hasteId];
    }
  });

  it.each(sm.all().filter(row => !row.retired && ['targeted-burst', 'projectile-burst', 'whirlwind-channel'].includes(row.action?.kind ?? '')).map(row => row.id))('%s preserves fixed recovery after its final scheduled beat', (sourceId) => {
    const id = `test.fixed_tail_${sourceId}`;
    sm.byId[id] = { ...sm.byId[sourceId], id,
      cast: { ...sm.byId[sourceId].cast!, recovery_sec: 0.3, fixed_recovery_sec: 0.2 } };
    try {
      const { state, arena, stepUntil } = fight(id);
      const haste = 4;
      addHaste(state, haste);
      stepUntil(() => state.fx.some(event => event.kind === 'cast' && event.skillId === id));
      const action = arena.actions.find(entry => entry.skillId === id)!;
      const pending = arena.flights.filter(flight => flight.actionId === action.id);
      expect(pending.length).toBeGreaterThan(0);
      const profile = sm.castProfileOf(sm.byId[id]);
      const fixed = profile.fixed_recovery_sec!;
      const expectedTail = Math.ceil((fixed + (profile.recovery_sec - fixed) / haste) * arena.unitsPerSec);
      const lastBeat = Math.max(...pending.map(flight => sm.byId[sourceId].action?.kind === 'whirlwind-channel'
        ? flight.timing.impactAtUs : flight.timing.releaseAtUs));
      expect(arena.intent!.recoveryUntilUs).toBe(lastBeat + expectedTail);
    } finally {
      delete sm.byId[id];
      delete sm.byId[hasteId];
    }
  });
});
