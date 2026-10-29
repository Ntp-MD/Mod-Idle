import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../../src/engine/client-helpers';
import { applyCurse } from '@sim/combat/curse';
import { placeStatus } from '@sim/combat/mobStatus';
import { createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, huntZone, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import { buildCharacter, emptyGear } from '@sim/core/player';
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
      // This fixture proves secondary geometry, not the F25 retreat decision: the bodies stand.
      retreatAtPct: undefined, retreating: false,
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
});
