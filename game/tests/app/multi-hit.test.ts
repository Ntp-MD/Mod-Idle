import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/engine/client-helpers';
import { E, sm } from '../../src/engine/client';
import { captureCombatArena, createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, spawnMob, stepCombat, tick } from '@sim/core/game';
import type { GameState, Mob } from '@sim/core/types';
import { restorePendingWork } from '@sim/core/pending-work';
import { prepareSkillCast, resolvePreparedCast, newCastRollCache } from '@sim/combat/skills';
import type { ManualControl } from '@sim/combat/combat-actions';
import { exportJson, importJson } from '../../src/state/save';
import { pinFieldPopulation } from '../fixtures/mobFixture';
import { mobSkillById } from '@sim/combat/mobSkills';

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
    expect(cast.payloads).toHaveLength(2);
    expect(cast.payloads![1].releaseAtUs - cast.payloads![0].releaseAtUs).toBe(150_000);
    // Each hit lands at its own pulse's crossing: no earlier than its release. A walking
    // target shortens the second travel, so the hits may land closer together than the
    // releases — the order and the per-pulse windows are what the burst guarantees.
    for (const [index, hit] of hits.entries()) {
      const release = cast.payloads!.find((payload) => payload.index === index)!.releaseAtUs;
      expect(hit.atUs!).toBeGreaterThanOrEqual(release);
    }
    expect(hits[1].atUs!).toBeGreaterThan(hits[0].atUs!);
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
    // Three pulses on a steady beat: spacing is the property, not the wall clock.
    // (Whirlwind's entry windup is 0.20, tuned up from the 0.18 melee bucket.)
    const beats = hits.map((hit) => hit.atUs!);
    expect(beats.slice(1).map((beat, index) => beat - beats[index])).toEqual([400_000, 400_000]);
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

describe('T5 chain lightning — canonical hops and preserved policies', () => {
  const CHAIN = 'attack.chain_lightning';

  const neutral = (mob: Mob): Mob => Object.assign(mob, {
    hp: 1e9, hpMax: 1e9, ps: 0, evasion: 0, dodgeRate: 0,
    armour: 0, res: 0, resByElement: {}, effRes: 0, effResByElement: {},
    line: 'front', damage: 'physical', innate: [], skillIds: [],
    immune: [],
  });

  function chainArena(spots: { id: string; x: number; y: number }[], distance = 2) {
    const { state, mob, arena } = skillFight(CHAIN, distance);
    neutral(mob);
    // Identical bodies from one seed: same Species/size/speed/behavior, so hop order answers to
    // ground distance alone and hop shares read back exactly.
    spots.forEach((spot) => {
      const extra = spawnMob(mulberry32(500), 1, 'normal');
      extra.id = spot.id;
      neutral(extra);
      state.group.push(extra);
    });
    syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
    Object.assign(arena.player, { x: 1, y: 6 });
    Object.assign(arena.mobs[mob.id], { x: 1 + distance, y: 6 });
    for (const spot of spots) Object.assign(arena.mobs[spot.id], { x: spot.x, y: spot.y });
    // No re-pin: the extras stay slotless exactly like the existing chain test above, so the
    // engagement pass keeps them in the fight through the chain.
    return { state, mob, arena };
  }

  const chainHits = (state: GameState, actionId: number) =>
    state.fx.filter((event) => event.kind === 'hit' && event.actionId === actionId)
      .sort((a, b) => (a.atUs ?? 0) - (b.atUs ?? 0));

  const chainTotal = (state: GameState, actionId: number) =>
    chainHits(state, actionId).reduce((sum, hit) => sum + (hit.value ?? 0), 0);

  // Hops read live ground poses, and bodies + player drift every second they fight. Resetting the
  // feet to the authored setup between ticks keeps multi-cast assertions about authored geometry.
  const reposition = (
    arena: ReturnType<typeof chainArena>['arena'],
    player: { x: number; y: number },
    spots: { id: string; x: number; y: number }[],
    primary: { id: string; x: number; y: number },
  ) => {
    Object.assign(arena.player, { x: player.x, y: player.y });
    Object.assign(arena.mobs[primary.id], { x: primary.x, y: primary.y });
    for (const spot of spots) Object.assign(arena.mobs[spot.id], { x: spot.x, y: spot.y });
  };

  // The 3 m boundary has zero margin by construction, so this one test freezes ground speeds and
  // restores them after: the authored distances then read back exactly at hop time.
  const freezeGroundSpeeds = () => {
    const arenaCfg = E.combat_arena as unknown as { mob_speed: number; player_speed: number };
    const prev = { mob: arenaCfg.mob_speed, player: arenaCfg.player_speed };
    arenaCfg.mob_speed = 0;
    arenaCfg.player_speed = 0;
    return () => { arenaCfg.mob_speed = prev.mob; arenaCfg.player_speed = prev.player; };
  };

  it('carries the 80ms hop cadence and 60% hop share in canonical action data', () => {
    const action = sm.byId[CHAIN].action!;
    expect(action.kind).toBe('chain-strike');
    expect(action.interval_sec).toBe(0.08);
    expect(action.hop_share_pct).toBe(60);
  });

  it('drives hop timing and shares from canonical data rather than hardcoded constants', () => {
    const row = sm.byId[CHAIN];
    const prev = { ...row.action! };
    try {
      row.action = { kind: 'chain-strike', interval_sec: 0.16, hop_share_pct: 50 };
      const { state, arena } = chainArena([
        { id: 'chain-2', x: 4.5, y: 6 }, { id: 'chain-3', x: 5.5, y: 6 },
      ]);
      tick(state, { arena });
      const cast = arena.actions.find((action) => action.skillId === CHAIN)!;
      const hits = chainHits(state, cast.id);
      expect(hits.map((hit) => hit.mobId)).toEqual(['multi-target', 'chain-2', 'chain-3']);
      expect(hits[1].atUs! - hits[0].atUs!).toBe(160_000);
      expect(hits[2].atUs! - hits[1].atUs!).toBe(160_000);
      expect(hits[1].value! / hits[0].value!).toBeCloseTo(0.5, 1);
    } finally {
      row.action = prev;
    }
  });

  it('lands three contacts with exact order, 80ms gaps, 60% hop shares, shock and one payment', () => {
    const { state, arena } = chainArena([
      { id: 'chain-2', x: 4.5, y: 6 }, { id: 'chain-3', x: 5.5, y: 6 },
    ]);
    const manaBefore = state.player.mana;
    tick(state, { arena });
    const casts = arena.actions.filter((action) => action.skillId === CHAIN);
    expect(casts).toHaveLength(1);
    const cast = casts[0];
    expect(state.skills.cd[CHAIN]).toBeGreaterThan(0);
    expect(state.fx.filter((event) => event.kind === 'cast' && event.actionId === cast.id)).toHaveLength(1);
    const hits = chainHits(state, cast.id);
    expect(hits.map((hit) => hit.mobId)).toEqual(['multi-target', 'chain-2', 'chain-3']);
    expect(hits[1].atUs! - hits[0].atUs!).toBe(80_000);
    expect(hits[2].atUs! - hits[1].atUs!).toBe(80_000);
    expect(hits[1].value! / hits[0].value!).toBeCloseTo(0.6, 1);
    expect(hits[2].value! / hits[1].value!).toBeCloseTo(1, 1);
    for (const id of ['multi-target', 'chain-2', 'chain-3'])
      expect(state.mobStatus[id]?.statuses.shock).toBeDefined();
    expect(state.player.mana).toBeLessThan(manaBefore);
    expect(cast.impactCount).toBe(3);
    // Follow-up contacts pay nothing: with the rotation held, a later second only regens.
    const manaAfterFirst = state.player.mana;
    tick(state, { arena, autoSkills: false });
    expect(chainHits(state, cast.id)).toHaveLength(3);
    expect(state.player.mana).toBeGreaterThanOrEqual(manaAfterFirst);
  });

  it('hops to the nearest unused body, not the array-first body', () => {
    const { state, arena } = chainArena([
      { id: 'chain-far', x: 10.5, y: 6 },
      { id: 'chain-near', x: 4.5, y: 6 },
    ]);
    expect(state.group[1].id).toBe('chain-far');
    tick(state, { arena });
    const cast = arena.actions.find((action) => action.skillId === CHAIN)!;
    expect(chainHits(state, cast.id).map((hit) => hit.mobId))
      .toEqual(['multi-target', 'chain-near']);
    expect(state.group.find((mob) => mob.id === 'chain-far')!.hp).toBe(1e9);
  });

  it('breaks equal-distance ties by stable id order and replays deterministically', () => {
    // Mirror-symmetric about the player's own axis (player on the x=3 bisector): every body drifts
    // in mirror image, so the 1.5 m tie holds exactly at hop time whatever the approach does.
    const build = () => {
      const fight = chainArena([
        { id: 'chain-mm', x: 4.5, y: 6 },
        { id: 'chain-aa', x: 1.5, y: 6 },
      ]);
      Object.assign(fight.arena.player, { x: 3, y: 2 });
      return fight;
    };
    const run = () => {
      const { state, arena } = build();
      tick(state, { arena });
      const cast = arena.actions.find((action) => action.skillId === CHAIN)!;
      return chainHits(state, cast.id).map((hit) => ({ id: hit.mobId, at: hit.atUs, value: hit.value }));
    };
    const first = run();
    expect(first.map((hit) => hit.id)).toEqual(['multi-target', 'chain-aa', 'chain-mm']);
    expect(run()).toEqual(first);
  });

  it('treats the 3m hop reach as inclusive and spares bodies past it', () => {
    const restore = freezeGroundSpeeds();
    try {
      const edge = chainArena([{ id: 'chain-edge', x: 6, y: 6 }]);
      tick(edge.state, { arena: edge.arena });
      const edgeCast = edge.arena.actions.find((action) => action.skillId === CHAIN)!;
      expect(chainHits(edge.state, edgeCast.id).map((hit) => hit.mobId))
        .toEqual(['multi-target', 'chain-edge']);

      const beyond = chainArena([{ id: 'chain-beyond', x: 6.02, y: 6 }]);
      tick(beyond.state, { arena: beyond.arena });
      const beyondCast = beyond.arena.actions.find((action) => action.skillId === CHAIN)!;
      expect(chainHits(beyond.state, beyondCast.id).map((hit) => hit.mobId)).toEqual(['multi-target']);
      expect(beyondCast.impactCount).toBe(1);
    } finally {
      restore();
    }
  });

  it('fizzles remaining hops finitely with a single hit when nothing is in reach', () => {
    const { state, arena } = chainArena([]);
    tick(state, { arena });
    const cast = arena.actions.find((action) => action.skillId === CHAIN)!;
    expect(chainHits(state, cast.id)).toHaveLength(1);
    expect(cast.impactCount).toBe(1);
    expect(arena.flights.filter((flight) => flight.cast.id === CHAIN)).toHaveLength(0);
    tick(state, { arena, autoSkills: false });
    expect(chainHits(state, cast.id)).toHaveLength(1);
  });

  it('skips bodies removed from the living group on later casts', () => {
    const restore = freezeGroundSpeeds();
    try {
      const { state, arena } = chainArena([
        { id: 'chain-mid', x: 4.5, y: 6 }, { id: 'chain-last', x: 5.5, y: 6 },
      ]);
      tick(state, { arena });
      const first = arena.actions.find((action) => action.skillId === CHAIN)!;
      expect(chainHits(state, first.id).map((hit) => hit.mobId))
        .toEqual(['multi-target', 'chain-mid', 'chain-last']);
      // The middle body leaves the field outright (group and pose removed, no re-pin so no
      // respawn slot opens), the feet are reset to the authored setup, and the next cast hops
      // straight to the last body.
      state.group = state.group.filter((mob) => mob.id !== 'chain-mid');
      delete arena.mobs['chain-mid'];
      state.skills.cd[CHAIN] = 0;
      state.player.mana = characterSheet(state).maxMana;
      reposition(arena, { x: 1, y: 6 },
        [{ id: 'chain-last', x: 5.5, y: 6 }], { id: 'multi-target', x: 3, y: 6 });
      tick(state, { arena });
      const casts = arena.actions.filter((action) => action.skillId === CHAIN);
      expect(casts).toHaveLength(2);
      expect(chainHits(state, casts[1].id).map((hit) => hit.mobId))
        .toEqual(['multi-target', 'chain-last']);
    } finally {
      restore();
    }
  });

  it('credits ordinary chain kills once with rewards and keeps hopping', () => {
    const { state, mob, arena } = chainArena([
      { id: 'chain-2', x: 7, y: 6 }, { id: 'chain-3', x: 8, y: 6 },
    ], 4);
    const victim = state.group.find((entry) => entry.id === mob.id)!;
    const victimXp = victim.xp;
    victim.hp = 1;
    const killsBefore = state.counters.kills;
    const xpBefore = state.player.xp;
    tick(state, { arena });
    const cast = arena.actions.find((action) => action.skillId === CHAIN)!;
    expect(chainHits(state, cast.id).map((hit) => hit.mobId))
      .toEqual(['multi-target', 'chain-2', 'chain-3']);
    expect(state.group.some((entry) => entry.id === 'multi-target')).toBe(false);
    expect(state.counters.kills - killsBefore).toBe(1);
    expect(state.player.xp - xpBefore).toBe(victimXp);
  });

  it('keeps separate visited sets per cast so a later cast re-hits the same bodies', () => {
    const spots = [{ id: 'chain-2', x: 4.5, y: 6 }, { id: 'chain-3', x: 5.5, y: 6 }];
    const { state, arena } = chainArena(spots);
    tick(state, { arena });
    state.skills.cd[CHAIN] = 0;
    state.player.mana = characterSheet(state).maxMana;
    reposition(arena, { x: 1, y: 6 }, spots, { id: 'multi-target', x: 3, y: 6 });
    tick(state, { arena });
    const casts = arena.actions.filter((action) => action.skillId === CHAIN);
    expect(casts).toHaveLength(2);
    expect(casts[0].id).not.toBe(casts[1].id);
    for (const cast of casts)
      expect(chainHits(state, cast.id).map((hit) => hit.mobId))
        .toEqual(['multi-target', 'chain-2', 'chain-3']);
  });

  it('matches whole-second ticks with combat-step stepping exactly', () => {
    const spots = [{ id: 'chain-2', x: 4.5, y: 6 }, { id: 'chain-3', x: 5.5, y: 6 }];
    const whole = chainArena(spots);
    tick(whole.state, { arena: whole.arena });
    tick(whole.state, { arena: whole.arena });
    const stepped = chainArena(spots);
    let guard = 0;
    while (stepped.state.clockSec < 2 && guard++ < 100) stepCombat(stepped.state, { arena: stepped.arena });
    expect(stepped.state.clockSec).toBe(2);
    const snapshot = (state: GameState, arena: typeof whole.arena) =>
      arena.actions.filter((action) => action.skillId === CHAIN)
        .map((action) => chainHits(state, action.id)
          .map((hit) => [hit.mobId, hit.atUs, hit.value]));
    expect(snapshot(stepped.state, stepped.arena)).toEqual(snapshot(whole.state, whole.arena));
  });

  it('cancels remaining hops with an area-exit receipt when the encounter changes', () => {
    const { state, arena } = chainArena([
      { id: 'chain-2', x: 4.5, y: 6 }, { id: 'chain-3', x: 5.5, y: 6 },
    ]);
    let castId = 0;
    for (let i = 0; i < 40; i++) {
      stepCombat(state, { arena });
      const cast = arena.actions.find((action) => action.skillId === CHAIN);
      if (cast && (cast.impactCount ?? 0) >= 1) { castId = cast.id; break; }
    }
    expect(castId).toBeGreaterThan(0);
    expect(chainHits(state, castId)).toHaveLength(1);
    expect(arena.flights.some((flight) => flight.chain && flight.chain.remaining > 0)).toBe(true);
    state.cell = { q: 5, r: 5, sub: null, wild: null };
    for (let i = 0; i < 40; i++) stepCombat(state, { arena });
    expect(arena.actions.find((action) => action.id === castId)?.cancelReason).toBe('area-exit');
    expect(chainHits(state, castId)).toHaveLength(1);
  });

  it('keeps Demolition/Thornbound policies: chain hits feed neither the demolition count nor a thorn cut', () => {
    const spots = [{ id: 'chain-2', x: 4.5, y: 6 }, { id: 'chain-3', x: 5.5, y: 6 }];
    const plain = chainArena(spots);
    tick(plain.state, { arena: plain.arena });
    const plainCast = plain.arena.actions.find((action) => action.skillId === CHAIN)!;
    const plainTotal = chainTotal(plain.state, plainCast.id);

    const demo = chainArena(spots);
    demo.state.player.treeRanks ||= {};
    demo.state.player.treeRanks['keystone.demolition-sequence'] = 1;
    tick(demo.state, { arena: demo.arena });
    expect(demo.state.log.some((line) => line.text.startsWith('Demolition Sequence'))).toBe(false);

    const thorn = chainArena(spots);
    thorn.state.player.treeRanks ||= {};
    thorn.state.player.treeRanks['keystone.thornbound'] = 1;
    tick(thorn.state, { arena: thorn.arena });
    const thornCast = thorn.arena.actions.find((action) => action.skillId === CHAIN)!;
    expect(chainTotal(thorn.state, thornCast.id)).toBe(plainTotal);
  });

  it('shares the per-world-tick trigger guard while a crit trigger fires once beside the chain', () => {
    const spots = [{ id: 'chain-2', x: 4.5, y: 6 }, { id: 'chain-3', x: 5.5, y: 6 }];
    const { state, mob, arena } = chainArena(spots);
    neutral(mob);
    state.gear[0] = {
      slot: 'main hand', base: 'one-handed axe', ilvl: 1, quality: 'Normal', tier: 'T1',
      lines: [{ id: 'critical_chance', value: 100 }],
    };
    state.skills.list = ['attack.cleave', 'attack.fireball', CHAIN];
    state.skills.owned['attack.cleave'] = 0;
    state.skills.owned['attack.fireball'] = 0;
    state.skills.owned['aura.cast_on_crit'] = 0;
    state.skills.auras['aura.cast_on_crit'] = true;
    state.player.mana = characterSheet(state).maxMana;
    for (const entry of state.group) entry.hp = entry.hpMax = 1e9;
    tick(state, { arena });
    state.player.mana = characterSheet(state).maxMana;
    reposition(arena, { x: 1, y: 6 }, spots, { id: 'multi-target', x: 3, y: 6 });
    tick(state, { arena });
    state.player.mana = characterSheet(state).maxMana;
    reposition(arena, { x: 1, y: 6 }, spots, { id: 'multi-target', x: 3, y: 6 });
    tick(state, { arena });
    expect(state.log.filter((line) => line.text.includes('triggers'))).toHaveLength(1);
    const casts = arena.actions.filter((action) => action.skillId === CHAIN);
    expect(casts.length).toBeGreaterThanOrEqual(1);
    const hopped = casts.find((cast) => chainHits(state, cast.id).length === 3)!;
    expect(hopped).toBeDefined();
    const hops = chainHits(state, hopped.id);
    expect(hops[1].atUs! - hops[0].atUs!).toBe(80_000);
    expect(hops[2].atUs! - hops[1].atUs!).toBe(80_000);
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
