import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/engine/client-helpers';
import { applyCurse } from '@sim/combat/curse';
import { placeStatus } from '@sim/combat/mobStatus';
import { createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, huntZone, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import { buildCharacter, emptyGear } from '@sim/core/player';
import { newSkillState, prepareSkillCast, resolvePreparedCast } from '@sim/combat/skills';
import { pinFieldPopulation } from '../fixtures/mobFixture';

/** Secondary damage and status spread answer to ground distance, not group order. */
function trio(seed: number, keystones: string[]) {
  const state = newGame(seed);
  setLevel(state, 60);
  state.hunting = true;
  state.player.hp = 1e9;
  state.player.treeRanks ||= {};
  for (const id of keystones) state.player.treeRanks[id] = 1;
  expect(huntZone(state, state.zone).ok).toBe(true);
  const rng = mulberry32(seed);
  const mk = (id: string) => {
    const mob = spawnMob(rng, 1, 'normal');
    Object.assign(mob, {
      id, hp: 1e9, hpMax: 1e9, ps: 0, accuracy: 0, evasion: 0, dodgeRate: 0,
      armour: 0, line: 'stand-off', damage: 'physical', innate: [], skillIds: [],
    });
    return mob;
  };
  // Adversarial group order: array-first is the farthest body, so array order would pick the wrong one.
  const far = mk('far-id');
  const mid = mk('mid-id');
  const near = mk('near-id');
  state.group = [far, mid, near];
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 9.5, y: 6 });
  Object.assign(arena.mobs[mid.id], { x: 10, y: 6 });
  Object.assign(arena.mobs[near.id], { x: 11, y: 6 });
  Object.assign(arena.mobs[far.id], { x: 30, y: 6 });
  arena.focusId = mid.id;
  pinFieldPopulation(state);
  return { state, arena, far, mid, near };
}

describe('F39 conductive — shock jumps to the nearest body', () => {
  it('shocks the 1 m neighbour, never the 20 m array-first body', () => {
    const { state, arena, far, mid, near } = trio(501, ['keystone.conductive']);
    placeStatus(state.mobStatus, mid.id, 'shock', buildCharacter(60, emptyGear()), 100);
    state.mobStatus[mid.id].statuses.shock!.secLeft = 30;
    const shocked = () => (state.mobStatus[near.id]?.statuses.shock?.secLeft ?? 0) > 0;
    for (let i = 0; i < 5 && !shocked(); i++)
      tick(state, { arena, autoSkills: false });
    expect(state.mobStatus[near.id]?.statuses.shock?.secLeft ?? 0).toBeGreaterThan(0);
    expect(state.mobStatus[far.id]?.statuses.shock?.secLeft ?? 0).toBe(0);
  });
});

describe('T5 chain lightning — spatial hops answer to ground distance', () => {
  it('hops mid → near (1 m), never the array-first far body (20 m)', () => {
    const { state, arena, far, mid, near } = trio(501, []);
    for (const mob of [far, mid, near]) {
      Object.assign(mob, { ps: 0, evasion: 0, dodgeRate: 0, armour: 0, res: 0 });
    }
    state.skills.owned['attack.chain_lightning'] = 0;
    state.skills.list.fill(null);
    state.skills.list[0] = 'attack.chain_lightning';
    state.player.mana = characterSheet(state).maxMana;
    tick(state, { arena });
    const cast = arena.actions.find((action) => action.skillId === 'attack.chain_lightning');
    expect(cast).toBeDefined();
    const hits = state.fx.filter((event) => event.kind === 'hit' && event.actionId === cast!.id)
      .sort((a, b) => (a.atUs ?? 0) - (b.atUs ?? 0));
    expect(hits.map((hit) => hit.mobId)).toEqual([mid.id, near.id]);
    expect(hits[1].atUs! - hits[0].atUs!).toBe(80_000);
    expect(far.hp).toBe(1e9);
  });
});

describe('T5 chain lightning — offline hops use the same nearest-unused rule', () => {
  const chainMob = (id: string) => ({
    id, species: 'Rat', kind: 'Normal', zone: 1, level: 60,
    hp: 1e9, hpMax: 1e9, ps: 0, acc: 0, evasion: 0, dodgeRate: 0, armour: 0, res: 0,
    damage: 'physical' as const, innate: [], xp: 1, line: 'front', hitsPerSec: 1, atkTimer: 0, engageSec: 0,
  });

  function chainReport(order: string[], positions?: Record<string, { x: number; y: number }>) {
    const skills = newSkillState();
    skills.owned['attack.chain_lightning'] = 0;
    skills.list[0] = 'attack.chain_lightning';
    const c = buildCharacter(60, emptyGear());
    const mobs = order.map((id) => chainMob(id));
    const prepared = prepareSkillCast(skills, c, 'attack.chain_lightning', 1e9, mobs, {})!;
    const report = resolvePreparedCast(skills, c, prepared, {}, mulberry32(9), {
      ...(positions ? { positionOf: (id: string) => positions[id] } : {}),
    });
    return { report, mobs };
  }

  it('hops to the nearest unused body inside the reach, never a flat AoE split', () => {
    // Array-first is the far body; the near and mid bodies are the real hop path.
    const positions = {
      primary: { x: 0, y: 0 }, far: { x: 10, y: 0 }, near: { x: 2, y: 0 }, mid: { x: 4, y: 0 },
    };
    const { report } = chainReport(['primary', 'far', 'near', 'mid'], positions);
    expect(report.byMob.map((hit) => hit.id)).toEqual(['primary', 'near', 'mid']);
    expect(report.byMob[1].amount / report.byMob[0].amount).toBeCloseTo(0.6, 9);
    expect(report.byMob[2].amount / report.byMob[0].amount).toBeCloseTo(0.6, 9);
    expect(report.targets).toBe(3);
  });

  it('labels the targets cap as queue-only when no ground positions are available', () => {
    const { report } = chainReport(['primary', 'far', 'near', 'mid']);
    // No positions: the prepared queue order stands in for the hop query, capped by `targets`.
    expect(report.byMob.map((hit) => hit.id)).toEqual(['primary', 'far', 'near']);
    expect(report.byMob[1].amount / report.byMob[0].amount).toBeCloseTo(0.6, 9);
    const again = chainReport(['primary', 'far', 'near', 'mid']);
    expect(again.report.byMob.map((hit) => hit.id)).toEqual(report.byMob.map((hit) => hit.id));
    expect(again.report.byMob.map((hit) => hit.amount)).toEqual(report.byMob.map((hit) => hit.amount));
  });
});

describe('F40 profane bloom — a 4 m blast whose secondary kills pay nothing', () => {
  it('hits bodies inside 4 m, spares the field beyond, and buries secondaries unrewarded', () => {
    const { state, arena, far, mid: victim, near: doomed } = trio(502, ['keystone.profane-bloom']);
    victim.hp = 1;
    doomed.hp = 1;
    applyCurse(state.curses, victim.id, {
      id: 'curse.expose', duration: '20 sec',
      effects: [{ subject: 'target', stat: 'damage_taken', op: 'add_pct', value: 20 }],
    } as never);
    const killsBefore = state.counters.kills;
    const xpBefore = state.player.xp;
    const victimXp = victim.xp;
    for (let i = 0; i < 8 && state.group.includes(victim); i++)
      tick(state, { arena, autoSkills: false });
    expect(state.log.some((line) => line.text.startsWith('Profane Bloom'))).toBe(true);
    // The 1 m bystander dies in the blast; the 20 m body is untouched.
    expect(state.group.includes(doomed)).toBe(false);
    expect(far.hp).toBe(1e9);
    // Exactly one rewarded kill — the primary. The secondary leaves the field owing nothing.
    expect(state.counters.kills - killsBefore).toBe(1);
    expect(state.player.xp - xpBefore).toBe(victimXp);
  });

  it('stays nonrecursive when the blast itself fells a cursed body (T5 baseline)', () => {
    const { state, arena, far, mid: victim, near: doomed } = trio(503, ['keystone.profane-bloom']);
    victim.hp = 1;
    doomed.hp = 1;
    const curseRow = {
      id: 'curse.expose', duration: '20 sec',
      effects: [{ subject: 'target', stat: 'damage_taken', op: 'add_pct', value: 20 }],
    } as never;
    applyCurse(state.curses, victim.id, curseRow);
    applyCurse(state.curses, doomed.id, curseRow);
    const killsBefore = state.counters.kills;
    const xpBefore = state.player.xp;
    const victimXp = victim.xp;
    for (let i = 0; i < 8 && state.group.includes(victim); i++)
      tick(state, { arena, autoSkills: false });
    // One burst only: the cursed secondary's death bursts nothing further and pays nothing.
    expect(state.log.filter((line) => line.text.startsWith('Profane Bloom'))).toHaveLength(1);
    expect(state.group.includes(doomed)).toBe(false);
    expect(far.hp).toBe(1e9);
    expect(state.counters.kills - killsBefore).toBe(1);
    expect(state.player.xp - xpBefore).toBe(victimXp);
  });
});
