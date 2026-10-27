import { describe, expect, it } from 'vitest';
import { E } from '../src/engine/client';
import type { AttackRangeProfile } from '../../engine/types.ts';
import { attackRangeGeometry, withinAttackStopBand } from '../../engine/attack-range.ts';
import {
  arenaDistance, arenaMobAttackGeometry, arenaMobInReach, arenaPlayerInReach, arenaWeaponRange,
  captureCombatArena, createCombatArena, mobAttackProfile, sampleCombatArena, syncCombatArena,
} from '../src/sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, tick } from '../src/sim/core/game';
import { mobFixture, pinFieldPopulation } from './mobFixture';

const melee = E.combat_arena.normal_attack.profiles.melee as unknown as AttackRangeProfile;
const ranged = E.combat_arena.normal_attack.profiles.ranged as unknown as AttackRangeProfile;
const clearance = E.combat_arena.normal_attack.contact_clearance_m;
const band = E.combat_arena.normal_attack.contact_band_m;

function fight(distance: number, over: Record<string, unknown> = {}) {
  const state = newGame(71);
  setLevel(state, 30);
  state.hunting = true;
  const mob = mobFixture({
    id: 'range-target', hp: 1e9, hpMax: 1e9, ps: 1, acc: 1e9, evasion: 0, dodgeRate: 0,
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

describe('attack range authority', () => {
  it('measures melee from body edges and keeps the stop inside the reach', () => {
    const geometry = attackRangeGeometry(melee.range, { selfRadius: 0.25, targetRadius: 0.25 },
      10, melee.stop_at_range_pct, clearance, band);
    expect(geometry.maxCenterDistance).toBeCloseTo(0.25 + 0.25 + melee.range.meters, 10);
    expect(geometry.stopCenterDistance).toBeLessThan(geometry.maxCenterDistance);
    expect(geometry.stopCenterDistance).toBeCloseTo(0.65, 10);
    expect(geometry.inRange).toBe(false);

    const atContact = attackRangeGeometry(melee.range, { selfRadius: 0.25, targetRadius: 0.25 },
      geometry.maxCenterDistance, melee.stop_at_range_pct, clearance, band);
    expect(atContact.inRange).toBe(true);
    const justOutside = attackRangeGeometry(melee.range, { selfRadius: 0.25, targetRadius: 0.25 },
      geometry.maxCenterDistance + 1e-4, melee.stop_at_range_pct, clearance, band);
    expect(justOutside.inRange).toBe(false);
  });

  it('keeps a centre profile in centre metres and stops before its edge', () => {
    const geometry = attackRangeGeometry(ranged.range, { selfRadius: 0.25, targetRadius: 0.25 },
      ranged.range.meters, ranged.stop_at_range_pct, clearance, band);
    expect(geometry.maxCenterDistance).toBe(ranged.range.meters);
    expect(geometry.stopCenterDistance).toBeCloseTo(ranged.range.meters * ranged.stop_at_range_pct / 100, 10);
    expect(withinAttackStopBand(geometry)).toBe(false);
    const stopped = attackRangeGeometry(ranged.range, { selfRadius: 0.25, targetRadius: 0.25 },
      geometry.stopCenterDistance, ranged.stop_at_range_pct, clearance, band);
    expect(withinAttackStopBand(stopped)).toBe(true);
  });

  it('resolves profiles by the authored adapters, not by the spawn line or sprite', () => {
    const { mob } = fight(3);
    expect(mobAttackProfile(mob)).toEqual(melee);
    expect(mobAttackProfile({ ...mob, line: 'stand-off' })).toEqual(ranged);
    expect(arenaWeaponRange('one-handed sword')).toBeCloseTo(0.7, 10);
    expect(arenaWeaponRange('bow')).toBeCloseTo(5.2, 10);
  });

  it('makes a melee body cross the old 2.1 m reach before it can land a hit', () => {
    const { state, mob, arena } = fight(3.9);
    // Hold the player in place so the mob's own approach is what closes the distance.
    arena.intent = { skillId: 'attack.firestorm', targetId: mob.id, targetPoint: { x: 1, y: 6 },
      phase: 'windup', releaseAtUs: 10_000_000 };
    tick(state, { arena, autoSkills: true });
    const firstSecond = arenaDistance(arena.player, arena.mobs[mob.id]);
    expect(firstSecond).toBeGreaterThan(melee.range.meters + 0.5 + 1e-7);
    expect(state.fx.filter((event) => event.kind === 'taken' && event.byId === mob.id)).toHaveLength(0);
    expect(arena.actions.filter((action) => action.actorId === mob.id)).toHaveLength(0);

    for (let index = 0; index < 2 && !state.fx.some((event) => event.kind === 'taken' && event.byId === mob.id); index++)
      tick(state, { arena, autoSkills: true });
    const taken = state.fx.filter((event) => event.kind === 'taken' && event.byId === mob.id);
    expect(taken).toHaveLength(1);
    const frame = sampleCombatArena(arena, taken[0].atUs!);
    const geometry = attackRangeGeometry(melee.range, { selfRadius: 0.25, targetRadius: 0.25 },
      arenaDistance(frame.player, frame.mobs[mob.id]), melee.stop_at_range_pct, clearance, band);
    expect(geometry.inRange).toBe(true);
    expect(withinAttackStopBand(geometry)).toBe(true);
    expect(arenaMobInReach(arena, mob.id)).toBe(true);
    expect(arenaMobAttackGeometry(arena, mob.id)?.inRange).toBe(true);
  });

  it('withholds the player melee basic until the body-edge reach holds', () => {
    const { state, mob, arena } = fight(2.05);
    expect(arenaPlayerInReach(arena, characterSheet(state).weaponName, mob.id)).toBe(false);
    tick(state, { arena, autoSkills: false });
    const first = arena.actions.find((action) => action.actorId === 'player' && action.kind === 'swing');
    // At the 1 s beat the pair has closed from 2.05 m to roughly 0.65 m, so the swing is allowed.
    expect(first).toBeDefined();
    const swingDistance = arenaDistance({ x: first!.x, y: first!.y },
      { x: first!.targetX!, y: first!.targetY! });
    expect(swingDistance).toBeLessThanOrEqual(0.7 + 1e-7);
  });
});
