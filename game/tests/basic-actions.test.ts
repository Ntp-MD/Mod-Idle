import { describe, expect, it } from 'vitest';
import { E } from '../src/engine/client';
import type { AttackRangeProfile } from '../../engine/types.ts';
import {
  arenaDistance, captureCombatArena, createCombatArena, syncCombatArena,
} from '../src/sim/combat/combat-arena';
import { arenaActionPose } from '../src/ui/combat/combat-arena-view';
import { basicPhaseBudget } from '../../engine/attack-range.ts';
import { characterSheet, newGame, setLevel, tick } from '../src/sim/core/game';
import { mobFixture, pinFieldPopulation } from './mobFixture';

const melee = E.combat_arena.normal_attack.profiles.melee as unknown as AttackRangeProfile;

function fight(distance = 0.65, over: Record<string, unknown> = {}) {
  const state = newGame(73);
  setLevel(state, 30);
  state.hunting = true;
  state.spawnIn = 999;
  const mob = mobFixture({
    id: 'basic-target', hp: 1e9, hpMax: 1e9, ps: 1, acc: 1e9, evasion: 0, dodgeRate: 0,
    armour: 0, line: 'front', damage: 'physical', innate: [], skillIds: [], hitsPerSec: 1,
    atkTimer: 0, ...over,
  });
  state.group = [mob];
  state.skills.list.fill(null);
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 1, y: 6 });
  Object.assign(arena.mobs[mob.id], { x: 1 + distance, y: 6 });
  captureCombatArena(arena, state, 0);
  pinFieldPopulation(state);
  return { state, mob, arena };
}

describe('executable basic actions', () => {
  it('does not deal mob damage before the committed release beat', () => {
    const { state, mob, arena } = fight();
    tick(state, { arena, autoSkills: false });
    const action = arena.actions.find(entry => entry.actorId === mob.id && entry.kind === 'swing')!;
    expect(action.timing).toBeDefined();
    expect(action.timing!.releaseAtUs).toBeGreaterThan(action.timing!.startedAtUs);
    expect(action.releasedAtUs).toBeUndefined();
    expect(state.fx.filter(event => event.kind === 'taken' && event.byId === mob.id)).toHaveLength(0);
    expect(arenaActionPose(action, action.timing!.startedAtUs + 100_000, arena.unitsPerSec)?.phase).toBe('windup');

    tick(state, { arena, autoSkills: false });
    const taken = state.fx.filter(event => event.kind === 'taken' && event.byId === mob.id);
    expect(taken).toHaveLength(1);
    expect(taken[0].atUs).toBe(1_350_000);
    const resolved = arena.actions.find(entry => entry.id === action.id)!;
    expect(resolved.releasedAtUs).toBe(1_350_000);
    expect(arenaActionPose(resolved, resolved.timing!.releaseAtUs, arena.unitsPerSec)?.phase).toBe('contact');
  });

  it('scales the basic windup with the resolved attack interval instead of a fixed clip', () => {
    const fast = basicPhaseBudget(melee, 250_000);
    const slow = basicPhaseBudget(melee, 1_000_000);
    expect(fast.windupUs).toBe(87_500);
    expect(fast.recoveryUs).toBe(50_000);
    expect(slow.windupUs).toBe(350_000);
    expect(slow.recoveryUs).toBe(200_000);
  });

  it('starts the player basic as a windup and applies damage only at release', () => {
    const { state, arena } = fight();
    tick(state, { arena, autoSkills: false });
    const action = arena.actions.find(entry => entry.actorId === 'player' && entry.kind === 'swing')!;
    const startedAtUs = action.timing!.startedAtUs;
    const releaseAtUs = action.timing!.releaseAtUs;
    const intervalUs = Math.round(1_000_000 / characterSheet(state).hitsPerSec);
    expect(releaseAtUs - startedAtUs).toBe(basicPhaseBudget(melee, intervalUs).windupUs);
    expect(action.releasedAtUs).toBeUndefined();
    expect(state.fx.filter(event => event.kind === 'hit' && event.via === 'swing')).toHaveLength(0);
    const start = arenaActionPose(action, startedAtUs + 100_000, arena.unitsPerSec)!;
    expect(start.phase).toBe('windup');

    tick(state, { arena, autoSkills: false });
    const hits = state.fx.filter(event => event.kind === 'hit' && event.via === 'swing');
    expect(hits.length).toBeGreaterThanOrEqual(1);
    expect(hits.some((hit) => hit.atUs === releaseAtUs)).toBe(true);
    expect(hits.every((hit) => hit.atUs! >= releaseAtUs)).toBe(true);
    const resolved = arena.actions.find(entry => entry.id === action.id)!;
    expect(resolved.releasedAtUs).toBe(releaseAtUs);
    expect(arenaActionPose(resolved, releaseAtUs, arena.unitsPerSec)?.phase).toBe('contact');
    expect(arenaDistance(arena.player, arena.mobs['basic-target'])).toBeLessThanOrEqual(
      E.combat_arena.normal_attack.profiles.melee.range.meters + E.combat_arena.player_radius_m * 2 + 1e-7);
  });

  it('cancels an unpaid mob basic under hard control without dealing damage', () => {
    const { state, mob, arena } = fight();
    tick(state, { arena, autoSkills: false });
    const action = arena.actions.find(entry => entry.actorId === mob.id && entry.kind === 'swing')!;
    expect(action.releasedAtUs).toBeUndefined();
    state.mobStatus[mob.id] = {
      statuses: { shock: { stacks: 1, secLeft: 2, perSec: 0 } },
      alignedPerSec: 0, elapsedSec: 0, stoppedSec: 0, stoppedUntil: 1.5,
    };
    tick(state, { arena, autoSkills: false });
    const resolved = arena.actions.find(entry => entry.id === action.id)!;
    expect(resolved.releasedAtUs).toBeUndefined();
    expect(resolved.cancelReason).toBe('release-invalid');
    expect(state.fx.filter(event => event.kind === 'taken' && event.byId === mob.id)).toHaveLength(0);
  });

  it('cancels an unpaid player windup on a manual move without dealing damage', () => {
    const { state, arena } = fight();
    tick(state, { arena, autoSkills: false });
    const action = arena.actions.find(entry => entry.actorId === 'player' && entry.kind === 'swing')!;
    expect(action.releasedAtUs).toBeUndefined();
    tick(state, { arena, autoSkills: false, manual: { moveTo: { x: 8, y: 6 } } });
    const resolved = arena.actions.find(entry => entry.id === action.id)!;
    expect(resolved.cancelledAtUs).toBeDefined();
    expect(resolved.cancelReason).toBe('manual move');
    expect(state.fx.filter(event => event.kind === 'hit' && event.via === 'swing')).toHaveLength(0);
  });
});
