import { describe, expect, it } from 'vitest';
import { E } from '../../src/engine/client';
import { mulberry32 } from '../../src/engine/client-helpers';
import { advanceCombatArena, arenaDistance, captureCombatArena, createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import { resolveMobBehavior } from '@sim/combat/mobSkills';
import { mobFixture, pinFieldPopulation, type MobOverride } from '../fixtures/mobFixture';

function arenaFight(over: MobOverride = {}, playerX = 5, mobX = 9, speedMult = 1) {
  const state = newGame(501);
  setLevel(state, 30);
  state.hunting = true;
  const mob = mobFixture({ id: 'behavior-target', ...over });
  state.group = [mob];
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: playerX, y: 6 });
  Object.assign(arena.mobs[mob.id], { x: mobX, y: 6 });
  captureCombatArena(arena, state, 0);
  pinFieldPopulation(state, 1, new Map([[mob.id, arena.mobs[mob.id]]]));
  if (state.field) {
    state.field.engagementIds = [mob.id];
    const slot = state.field.slots[0];
    slot.home = { x: mobX, y: 6 };
  }
  return { state, mob, arena, speedMult };
}

const sample = (engaged: string[], speedMult = () => 1) => ({
  playerRange: 0, playerSpeedMult: 0, mobSpeedMult: speedMult,
  engagedIds: new Set(engaged), homeBandM: 0.35, returnSpeedMult: 0.65,
});

describe('P5 — behavior identities are data-driven and distinct', () => {
  it('resolves each authored counterplay role from the species kit', () => {
    const kit = (id: string) => (E.mob.species as any[]).find((s) => s.id === id)?.line;
    expect(resolveMobBehavior('goblin', kit('goblin'), ['mob.physical.backstab'])).toBe('skirmisher');
    expect(resolveMobBehavior('orc', kit('orc'), ['mob.physical.rend'])).toBe('charger');
    expect(resolveMobBehavior('mummy', kit('mummy'), ['mob.earth.dust-blind'])).toBe('ranged');
    expect(resolveMobBehavior('golem', kit('golem'), ['mob.earth.boulder-toss'])).toBe('artillery');
    expect(resolveMobBehavior('treant', kit('treant'), ['mob.earth.rooted-stance'])).toBe('support');
    expect(resolveMobBehavior('skeleton', kit('skeleton'), ['mob.physical.skull-crack'])).toBe('contact');
    expect(resolveMobBehavior('unknown', 'stand-off', [])).toBe('ranged');
  });

  it('kites a stand-off body out of its panic band but never an artillery body', () => {
    const ranged = arenaFight({ behavior: 'ranged', line: 'stand-off', hitsPerSec: 0 }, 5, 6.4);
    const before = arenaDistance(ranged.arena.player, ranged.arena.mobs[ranged.mob.id]);
    advanceCombatArena(ranged.arena, ranged.state, 100_000, sample([ranged.mob.id]));
    const after = arenaDistance(ranged.arena.player, ranged.arena.mobs[ranged.mob.id]);
    expect(after).toBeGreaterThan(before);

    const artillery = arenaFight({ behavior: 'artillery', line: 'stand-off', hitsPerSec: 0 }, 5, 6.4);
    const artilleryBefore = arenaDistance(artillery.arena.player, artillery.arena.mobs[artillery.mob.id]);
    advanceCombatArena(artillery.arena, artillery.state, 100_000, sample([artillery.mob.id]));
    expect(arenaDistance(artillery.arena.player, artillery.arena.mobs[artillery.mob.id]))
      .toBeCloseTo(artilleryBefore, 6);
  });

  it('holds a support body near its own ground instead of chasing across the clearing', () => {
    const fight = arenaFight({ behavior: 'support', line: 'front', hitsPerSec: 0 }, 20, 21);
    if (fight.state.field) {
      fight.state.field.slots[0].home = { x: 5, y: 6 };
    }
    Object.assign(fight.arena.mobs[fight.mob.id], { x: 12, y: 6 });
    const before = arenaDistance(fight.arena.player, fight.arena.mobs[fight.mob.id]);
    advanceCombatArena(fight.arena, fight.state, 100_000, sample([fight.mob.id]));
    const after = arenaDistance(fight.arena.player, fight.arena.mobs[fight.mob.id]);
    // It walked toward home, away from the player standing at the far edge.
    expect(after).toBeGreaterThan(before);
  });

  it('retreats a wounded ordinary body and never a boss', () => {
    const ordinary = arenaFight({ behavior: 'contact', retreatAtPct: 15, hp: 10, hpMax: 100 }, 5, 8);
    advanceCombatArena(ordinary.arena, ordinary.state, 100_000, sample([ordinary.mob.id]));
    expect(ordinary.mob.retreating).toBe(true);
    expect(ordinary.arena.mobs[ordinary.mob.id].returning).toBe(true);

    const boss = arenaFight({ behavior: 'contact', retreatAtPct: 15, hp: 10, hpMax: 100, kind: 'Boss · Test' }, 5, 8);
    advanceCombatArena(boss.arena, boss.state, 100_000, sample([boss.mob.id]));
    expect(boss.mob.retreating).toBeUndefined();
  });

  it('summons boss adds only when a phase gate is crossed', () => {
    const fight = arenaFight({
      behavior: 'contact', kind: 'Boss · Test', hp: 60, hpMax: 100,
      skillIds: ['mob.earth.seismic-slam'], skillReadyAtUs: {}, hitsPerSec: 1,
    }, 5, 7);
    const before = fight.state.group.length;
    tick(fight.state, { arena: fight.arena, autoSkills: false });
    // The slam's gate is 50%; at 60% no add has been called.
    expect(fight.state.group.length).toBe(before);
    fight.mob.hp = 40;
    tick(fight.state, { arena: fight.arena, autoSkills: false });
    const adds = fight.state.group.filter((mob) => mob.addedBy === fight.mob.id);
    expect(adds.length).toBeGreaterThan(0);
    expect(fight.state.group.length).toBeGreaterThan(before);
  });

  it('breaks an Earth Wall guard before the blow is rolled', () => {
    const fight = arenaFight({ behavior: 'contact', skillIds: ['mob.physical.shield-bash'], skillReadyAtUs: {},
      hitsPerSec: 2, atkTimer: 0.5, line: 'front' }, 5, 5.6);
    fight.state.player.blockCharges = 2;
    tick(fight.state, { arena: fight.arena, autoSkills: false });
    expect(fight.state.player.blockCharges).toBe(0);
    expect(fight.state.fx.some((event) => event.kind === 'proc' && event.text === 'shield broken')).toBe(true);
  });

  it('charges to the windup point and misses a player who stepped out of it', () => {
    const hit = arenaFight({ behavior: 'charger', skillIds: ['mob.physical.gore'], skillReadyAtUs: {},
      hitsPerSec: 2, atkTimer: 0.5 }, 5, 9.5);
    tick(hit.state, { arena: hit.arena, autoSkills: false });
    const charged = hit.arena.mobs[hit.mob.id];
    // A walk alone covers under two metres in this second; the lunge is the extra travel.
    expect(9.5 - charged.x).toBeGreaterThan(3.5);

    const miss = arenaFight({ behavior: 'charger', skillIds: ['mob.physical.gore'], skillReadyAtUs: {},
      hitsPerSec: 2, atkTimer: 0.5 }, 5, 9.5);
    tick(miss.state, { arena: miss.arena, autoSkills: false, manual: { moveTo: { x: 5, y: 15 } } });
    expect(miss.state.fx.some((event) => event.kind === 'taken' && event.byId === miss.mob.id)).toBe(false);
  });
});
