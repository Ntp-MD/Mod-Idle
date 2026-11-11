import { describe, expect, it, vi } from 'vitest';
import { E } from '../../src/engine/client';
import { mulberry32 } from '../../src/engine/client-helpers';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import { arenaAction, captureCombatArena, createCombatArena, syncCombatArena, type CombatMobFlight } from '@sim/combat/combat-arena';
import { CombatClock } from '@sim/combat/combat-clock';
import { applyMobAuras, planMobSkills, readyMobSkill } from '@sim/combat/mobSkills';
import { createMobShots } from '@sim/core/tick/mob-shots';
import { liveMobSkill } from '../fixtures/liveMob';
import { mobFixture, pinFieldPopulation } from '../fixtures/mobFixture';

const strike = liveMobSkill(row => row.mode === 'strike' && row.cast?.delivery === 'melee' && !row.phase, 'disabled strike');
const aura = liveMobSkill(row => row.mode === 'aura', 'disabled aura');
const phase = liveMobSkill(row => row.mode === 'strike' && !!row.phase, 'disabled phase');
const ground = liveMobSkill(row => row.mode === 'strike' && row.cast?.delivery === 'ground', 'disabled ground shot');
const units = 1_000_000;

function encounter(line: 'front' | 'stand-off' = 'front') {
  const state = newGame(41);
  setLevel(state, 30);
  state.hunting = true;
  const mob = spawnMob(mulberry32(23), 1, 'normal', undefined, 2, { allowWildUnique: false });
  Object.assign(mob, {
    id: 'disabled-kit', hp: 1e9, hpMax: 4e9, ps: 1, acc: 1e9, evasion: 0, dodgeRate: 0,
    armour: 0, line, damage: 'physical', innate: [], hitsPerSec: 1, atkTimer: 0,
    skillIds: [strike.id, aura.id, phase.id], skillReadyAtUs: {},
  });
  state.group = [mob];
  state.skills.list.fill(null);
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, units, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 1, y: 6 });
  Object.assign(arena.mobs[mob.id], { x: line === 'front' ? 2 : 4, y: 6 });
  captureCombatArena(arena, state, 0);
  pinFieldPopulation(state);
  return { state, mob, arena };
}

describe('production mob skills disabled', () => {
  it('ships the switch off and spawns ordinary, elite and boss bodies without a kit', () => {
    expect(E.mob.skills_enabled).toBe(false);
    for (const kind of ['normal', 'elite', 'boss'] as const) {
      const mob = spawnMob(mulberry32(11), 1, kind, undefined, null, { allowWildUnique: false });
      expect(mob.skillIds, kind).toEqual([]);
      expect(mob.hitsPerSec, kind).toBeGreaterThan(0);
    }
  });

  it('ignores kits and cooldowns retained on existing bodies', () => {
    const mob = mobFixture({ skillIds: [strike.id], skillReadyAtUs: {} });
    expect(readyMobSkill(mob, 0)).toBeUndefined();
    expect(planMobSkills(mob, [0, units, 2 * units], units).size).toBe(0);
    expect(mob.skillReadyAtUs).toEqual({});
  });

  it('clears old aura bonuses back to the body baseline', () => {
    const mob = mobFixture({
      skillIds: [aura.id], armour: 100, res: 10, resByElement: { fire: 12 },
      effArmour: 200, effRes: 60, effResByElement: { fire: 60 },
      auraDamageMult: 2, auraSpeedMult: 2, auraSources: [{ id: aura.id, sourceId: 'old-source' }],
    });
    applyMobAuras([mob], [mob]);
    expect(mob).toMatchObject({
      effArmour: 100, effRes: 10, effResByElement: { fire: 12 },
      auraDamageMult: 1, auraSpeedMult: 1, auraSources: [],
    });
  });

  it.each([[true, 'front'], [false, 'front'], [true, 'stand-off'], [false, 'stand-off']] as const)(
    'keeps basic attacks working without skill casts or phases (online=%s, line=%s)', (online, line) => {
    const { state, mob, arena } = encounter(line);
    const incoming = [];
    for (let i = 0; i < 8; i++) {
      tick(state, { online, autoSkills: false, ...(online ? { arena } : {}) });
      expect(state.fx.some(event => event.kind === 'cast' && event.mobId === mob.id)).toBe(false);
      incoming.push(...state.fx.filter(event => event.kind === 'taken' && event.byId === mob.id));
    }
    expect(incoming.length).toBeGreaterThan(0);
    expect(incoming.every(event => !event.skillId)).toBe(true);
    expect(mob.skillReadyAtUs).toEqual({});
    expect(mob.phase).toBe(0);
    expect(mob.auraSources).toEqual([]);
    expect(state.group).toHaveLength(1);
  });

  it('cancels a retained preparation instead of releasing its strike', () => {
    const { state, mob, arena } = encounter();
    const action = arenaAction(arena, mob.id, 'cast', 0, 'player', strike.id, undefined, {
      delivery: 'melee', startedAtUs: 0, releaseAtUs: 5 * units,
      impactAtUs: 5 * units, recoveryUntilUs: 6 * units,
    })!;
    tick(state, { arena, autoSkills: false });
    expect(arena.actions.find(entry => entry.id === action.id)).toMatchObject({ cancelReason: 'skills-disabled' });
    expect(mob.skillReadyAtUs).toEqual({});
  });

  it.each(['projectile', 'ground'] as const)('cancels an existing %s skill flight while retaining ordinary shots', (kind) => {
    const { state, mob, arena } = encounter();
    Object.assign(arena.player, { x: 20, y: 20 });
    const flight = (actionId: number): CombatMobFlight => ({
      actionId, mobId: mob.id, mob, source: { x: 0, y: 0 }, destination: { x: 10, y: 0 },
      position: { x: 0, y: 0 }, releaseAtUs: 0, impactAtUs: units, speedMps: 10, radiusM: 0.1,
    });
    const skill = { ...flight(101), skillId: ground.id, kind };
    const basic = flight(102);
    arena.mobFlights.push(skill, basic);
    const hit = vi.fn();
    const shots = createMobShots({ arena, s: state, clock: new CombatClock(0, units), rng: mulberry32(1),
      tickStartUs: 0, tickEndUs: units, units, resolveIncomingHit: hit });
    shots.sweepMobShots(100_000);
    expect(arena.mobFlights).toEqual([basic]);
    expect(hit).not.toHaveBeenCalled();
    shots.resolveMobShot(skill, 200_000, true);
    expect(hit).not.toHaveBeenCalled();
  });
});
