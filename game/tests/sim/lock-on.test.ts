import { describe, expect, it } from 'vitest';
import { characterSheet, newGame, setLevel, stepCombat, tick } from '@sim/core/game';
import { createCombatArena, syncCombatArena, captureCombatArena } from '@sim/combat/combat-arena';
import { buildCharacter, emptyGear } from '@sim/core/player';
import { newSkillState, prepareSkillCast, resolvePreparedCast } from '@sim/combat/skills';
import { mobFixture } from '../fixtures/mobFixture';
import { pinFieldPopulation } from '../fixtures/mobFixture';
import type { NavLayout } from '@engine/navigation.ts';

/**
 * C3 — lock-on bursts (decided round 3, filler mirror).
 *
 * Double Strafe (straight, phys/ranged/attack) and Seeker Strafe (homing, lightning/magic/spell):
 * 3 payloads each, one cost/CD; straight keeps the release-aim snapshot while homing tracks the
 * same body id inside 5m / 0.8s; a dead or returned target fizzles the rest with no re-acquire.
 */
function lockonState(skillId: string, weapon: string) {
  const state = newGame(81);
  setLevel(state, 30);
  state.hunting = true;
  state.player.hp = 1e9;
  state.group = [
    mobFixture({ id: 't', hp: 1e9, hpMax: 1e9, innate: [], skillIds: [] }),
    mobFixture({ id: 'other', hp: 1e9, hpMax: 1e9, innate: [], skillIds: [] }),
  ];
  state.skills.owned[skillId] = 0;
  state.skills.list = new Array(16).fill(null);
  state.skills.list[0] = skillId;
  state.gear[0] = { slot: 'main hand', base: weapon, ilvl: 1, quality: 'Normal', tier: 'T1', lines: [] } as never;
  state.player.mana = characterSheet(state).maxMana;
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 0, y: 0 });
  Object.assign(arena.mobs['t'], { x: 3, y: 0 });
  Object.assign(arena.mobs['other'], { x: 1.5, y: 4 });
  captureCombatArena(arena, state, 0);
  pinFieldPopulation(state);
  for (const mob of state.group) {
    const slot = state.field?.slots.find((e) => e.mobId === mob.id);
    if (slot) slot.home = { x: arena.mobs[mob.id].x, y: arena.mobs[mob.id].y };
  }
  return { state, arena };
}

const hitsFor = (state: any, skillId: string) =>
  state.fx.filter((e: any) => e.kind === 'hit' && e.skillId === skillId);
const actionFor = (arena: any, skillId: string) =>
  arena.actions.find((e: any) => e.skillId === skillId);

describe('C3 lock-on bursts', () => {
  it('lands 3 straight payloads on the snapshot with one cost/CD', () => {
    const { state, arena } = lockonState('attack.double_strafe', 'bow');
    for (let i = 0; i < 25; i++) stepCombat(state, { online: true, arena });
    const action = actionFor(arena, 'attack.double_strafe');
    expect(action).toBeDefined();
    expect(action.impactCount).toBe(3);
    expect(action.payloads).toHaveLength(3);
    const hits = hitsFor(state, 'attack.double_strafe');
    expect(hits).toHaveLength(3);
    expect(new Set(hits.map((h: any) => h.mobId))).toEqual(new Set(['t']));
    // one press: one cast fx, one cooldown
    expect(state.fx.filter((e: any) => e.kind === 'cast' && e.skillId === 'attack.double_strafe')).toHaveLength(1);
    expect(state.skills.cd['attack.double_strafe']).toBeGreaterThan(0);
  });

  it('fizzles straight payloads whose bound target left cast range', () => {
    const { state, arena } = lockonState('attack.double_strafe', 'bow');
    let teleported = false;
    for (let i = 0; i < 30 && !teleported; i++) {
      stepCombat(state, { online: true, arena });
      const action = actionFor(arena, 'attack.double_strafe');
      if (action?.payloads?.some((p: any) => p.impactAtUs != null)) {
        Object.assign(arena.mobs['t'], { x: 10, y: 0 });
        teleported = true;
      }
    }
    expect(teleported).toBe(true);
    for (let i = 0; i < 25; i++) stepCombat(state, { online: true, arena });
    const action = actionFor(arena, 'attack.double_strafe');
    // first payload landed; the moved-out rest fizzled with terminal receipts
    expect(hitsFor(state, 'attack.double_strafe')).toHaveLength(1);
    expect(action.impactCount).toBe(3);
  });

  it('tracks a homing target that moves inside the pursuit bound', () => {
    const { state, arena } = lockonState('attack.seeker_strafe', 'staff');
    let teleported = false;
    for (let i = 0; i < 40; i++) {
      stepCombat(state, { online: true, arena });
      const action = actionFor(arena, 'attack.seeker_strafe');
      if (!teleported && action?.payloads?.some((p: any) => p.impactAtUs != null)) {
        Object.assign(arena.mobs['t'], { x: 4, y: 1 });
        teleported = true;
      }
    }
    expect(teleported).toBe(true);
    const action = actionFor(arena, 'attack.seeker_strafe');
    const hits = hitsFor(state, 'attack.seeker_strafe');
    expect(action.impactCount).toBe(3);
    expect(hits).toHaveLength(3);
    expect(new Set(hits.map((h: any) => h.mobId))).toEqual(new Set(['t']));
  });

  it('fizzles homing payloads whose target outruns the pursuit bound', () => {
    const { state, arena } = lockonState('attack.seeker_strafe', 'staff');
    let teleported = false;
    for (let i = 0; i < 40; i++) {
      stepCombat(state, { online: true, arena });
      const action = actionFor(arena, 'attack.seeker_strafe');
      if (!teleported && action?.payloads?.some((p: any) => p.impactAtUs != null)) {
        Object.assign(arena.mobs['t'], { x: 10, y: 0 });
        teleported = true;
      }
    }
    expect(teleported).toBe(true);
    const action = actionFor(arena, 'attack.seeker_strafe');
    expect(hitsFor(state, 'attack.seeker_strafe')).toHaveLength(1);
    expect(action.impactCount).toBe(3);
  });

  it('fizzles the rest when the bound body dies mid-burst, crediting the kill once', () => {
    const { state, arena } = lockonState('attack.seeker_strafe', 'staff');
    state.group.find((m) => m.id === 't')!.hp = 100;
    for (let i = 0; i < 40; i++) stepCombat(state, { online: true, arena });
    const action = actionFor(arena, 'attack.seeker_strafe');
    expect(state.counters.kills).toBe(1);
    expect(state.group.some((m) => m.id === 't')).toBe(false);
    expect(hitsFor(state, 'attack.seeker_strafe')).toHaveLength(1);
    expect(action.impactCount).toBe(3);
  });

  it('keeps the bound body when UI focus changes mid-burst', () => {
    const { state, arena } = lockonState('attack.double_strafe', 'bow');
    for (let i = 0; i < 12; i++) stepCombat(state, { online: true, arena });
    arena.focusId = 'other';
    for (let i = 0; i < 20; i++) stepCombat(state, { online: true, arena });
    const hits = hitsFor(state, 'attack.double_strafe');
    expect(hits.length).toBeGreaterThan(0);
    expect(new Set(hits.map((h: any) => h.mobId))).toEqual(new Set(['t']));
  });

  it('intercepts straight payloads on bodies standing in the path', () => {
    const { state, arena } = lockonState('attack.double_strafe', 'bow');
    arena.focusId = 't';
    Object.assign(arena.mobs['other'], { x: 1.5, y: 0 });
    for (let i = 0; i < 25; i++) stepCombat(state, { online: true, arena });
    const action = actionFor(arena, 'attack.double_strafe');
    const hits = hitsFor(state, 'attack.double_strafe');
    expect(action.impactCount).toBe(3);
    // the interceptor takes at least one payload; the press still costs once
    expect(hits.some((h: any) => h.mobId === 'other')).toBe(true);
    // the lock-on action keeps its intended body; interception is a payload receipt
    expect(action.targetId).toBe('t');
    expect(state.fx.filter((e: any) => e.kind === 'cast' && e.skillId === 'attack.double_strafe')).toHaveLength(1);
  });

  it('keeps the straight release snapshot when the target moves but stays in cast range', () => {
    const { state, arena } = lockonState('attack.double_strafe', 'bow');
    arena.focusId = 't';
    let moved = false;
    for (let i = 0; i < 45; i++) {
      stepCombat(state, { online: true, arena });
      const action = actionFor(arena, 'attack.double_strafe');
      const first = action?.payloads?.find((payload: any) => payload.index === 0);
      if (!moved && first?.releaseAtUs != null && arena.flights.some((flight: any) => flight.impactIndex === 0)) {
        Object.assign(arena.mobs.t, { x: 4, y: 2 });
        moved = true;
      }
    }
    expect(moved).toBe(true);
    expect(Math.hypot(arena.mobs.t.x - arena.player.x, arena.mobs.t.y - arena.player.y)).toBeLessThan(5);
    const action = actionFor(arena, 'attack.double_strafe');
    expect(action.targetId).toBe('t');
    expect(action.payloads).toHaveLength(3);
    expect(new Set(action.payloads.map((payload: any) => `${payload.destination.x.toFixed(4)},${payload.destination.y.toFixed(4)}`)).size).toBe(1);
    expect(hitsFor(state, 'attack.double_strafe')).toHaveLength(0);
    expect(action.impactCount).toBe(3);
  });

  it('lets each homing payload be intercepted without replacing the cast target identity', () => {
    const { state, arena } = lockonState('attack.seeker_strafe', 'staff');
    arena.focusId = 't';
    Object.assign(arena.mobs.other, { x: 1.5, y: 0 });
    for (let i = 0; i < 40; i++) stepCombat(state, { online: true, arena });

    const action = actionFor(arena, 'attack.seeker_strafe');
    const hits = hitsFor(state, 'attack.seeker_strafe');
    expect(action.impactCount).toBe(3);
    expect(hits.some((hit: any) => hit.mobId === 'other')).toBe(true);
    expect(action.targetId).toBe('t');
    expect(action.payloads.some((payload: any) => payload.targetId === 'other')).toBe(true);
  });

  it('records a wall stop per straight payload and leaves the volley action intact', () => {
    const { state, arena } = lockonState('attack.double_strafe', 'bow');
    arena.focusId = 't';
    const nav: NavLayout = {
      version: 1,
      bounds: { x: 0, y: 0, width: arena.bounds.width, height: arena.bounds.height },
      cellSize: 1,
      obstacles: [{ kind: 'box', id: 'volley-screen', x: 1, y: 0, width: 0.1, height: arena.bounds.height,
        flags: { movement: false, sight: false, projectiles: true } }],
    };
    arena.nav = nav;
    for (let i = 0; i < 60; i++) stepCombat(state, { online: true, arena });

    const action = actionFor(arena, 'attack.double_strafe');
    expect(arena.nav).toBe(nav);
    expect(action.cancelledAtUs).toBeUndefined();
    expect(action.impactCount).toBe(3);
    expect(action.payloads).toHaveLength(3);
    expect(action.payloads.every((payload: any) => payload.cancelReason === 'obstacle')).toBe(true);
    expect(hitsFor(state, 'attack.double_strafe')).toHaveLength(0);
    expect(state.fx.filter((e: any) => e.kind === 'cast' && e.skillId === 'attack.double_strafe')).toHaveLength(1);
  });
});

describe('C3 lock-on offline', () => {
  const strafe = () => {
    const state = newGame(82);
    const skills = newSkillState();
    skills.owned['attack.double_strafe'] = 0;
    skills.list[0] = 'attack.double_strafe';
    const c = { ...buildCharacter(30, emptyGear()), critChance: 50 };
    const bound = mobFixture({ id: 'bound', hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0, innate: [], skillIds: [] });
    return { state, skills, c, bound };
  };

  it('rolls each payload independently instead of sharing one silent crit', () => {
    const { state, skills, c, bound } = strafe();
    const prepared = prepareSkillCast(skills, c, 'attack.double_strafe', 1e9, [bound], state.playerStatuses)!;
    // crit, hit, dodge per payload: first payload crits, the later two do not.
    const seq = [0, 0, 100, 100, 0, 100, 100, 0, 100];
    let at = 0;
    const rng = () => seq[Math.min(at++, seq.length - 1)];
    const report = resolvePreparedCast(skills, c, prepared, state.playerStatuses, rng);
    expect(report.byMob).toHaveLength(3);
    expect(report.byMob.map((hit) => hit.crit)).toEqual([true, false, false]);
    expect(report.crit).toBe(true);
  });

  it('fizzles the rest on a dead bound body and never re-acquires the neighbour', () => {
    const { state, skills, c, bound } = strafe();
    const other = mobFixture({ id: 'other', hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0, innate: [], skillIds: [] });
    bound.hp = 1;
    const prepared = prepareSkillCast(skills, c, 'attack.double_strafe', 1e9, [bound, other], state.playerStatuses)!;
    const report = resolvePreparedCast(skills, c, prepared, state.playerStatuses, () => 0.5);
    expect(report.byMob).toHaveLength(1);
    expect(report.byMob[0].id).toBe(bound.id);
    expect(bound.hp).toBeLessThanOrEqual(0);
    expect(other.hp).toBe(other.hpMax);
  });
});
