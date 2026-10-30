import { describe, expect, it } from 'vitest';
import type { NavLayout } from '@engine/navigation.ts';
import { E } from '../../src/engine/client';
import { advanceCombatArena, arenaDistance, captureCombatArena, createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { characterSheet, newGame, setLevel, tick } from '@sim/core/game';
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

const BOUNDS = { x: 0, y: 0, width: E.combat_arena.width, height: E.combat_arena.height };
const sightScreen = (x: number): NavLayout => ({
  version: 1, bounds: BOUNDS, cellSize: 1,
  obstacles: [{ kind: 'box', id: 'screen', x, y: 0, width: 0.2, height: BOUNDS.height,
    flags: { movement: false, sight: true, projectiles: false } }],
});
const fullWall = (x: number): NavLayout => ({
  version: 1, bounds: BOUNDS, cellSize: 1,
  obstacles: [{ kind: 'box', id: 'wall', x, y: 0, width: 1, height: BOUNDS.height,
    flags: { movement: true, sight: true, projectiles: true } }],
});
const openNav = (): NavLayout => ({ version: 1, bounds: BOUNDS, cellSize: 1, obstacles: [] });
const takenBy = (state: { fx: { kind: string; byId?: string }[] }, mobId: string) =>
  state.fx.some((event) => event.kind === 'taken' && event.byId === mobId);

describe('mob movement and casts', () => {
  it('holds a stand-off body at its cast range instead of kiting', () => {
    const fight = arenaFight({ line: 'stand-off', hitsPerSec: 0 }, 5, 6.4);
    const before = arenaDistance(fight.arena.player, fight.arena.mobs[fight.mob.id]);
    advanceCombatArena(fight.arena, fight.state, 100_000, sample([fight.mob.id]));
    expect(arenaDistance(fight.arena.player, fight.arena.mobs[fight.mob.id])).toBeCloseTo(before, 6);
  });

  it('makes an aura carrier chase like every other body', () => {
    const fight = arenaFight({ skillIds: ['mob.earth.rooted-stance'], hitsPerSec: 0 }, 20, 21);
    if (fight.state.field) fight.state.field.slots[0].home = { x: 5, y: 6 };
    Object.assign(fight.arena.mobs[fight.mob.id], { x: 12, y: 6 });
    const before = arenaDistance(fight.arena.player, fight.arena.mobs[fight.mob.id]);
    advanceCombatArena(fight.arena, fight.state, 100_000, sample([fight.mob.id]));
    expect(arenaDistance(fight.arena.player, fight.arena.mobs[fight.mob.id])).toBeLessThan(before);
  });

  it('summons boss adds only when a phase gate is crossed', () => {
    const fight = arenaFight({
      kind: 'Boss · Test', hp: 60, hpMax: 100,
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
    const fight = arenaFight({ skillIds: ['mob.physical.shield-bash'], skillReadyAtUs: {},
      hitsPerSec: 2, atkTimer: 0.5, line: 'front' }, 5, 5.6);
    fight.state.player.blockCharges = 2;
    tick(fight.state, { arena: fight.arena, autoSkills: false });
    expect(fight.state.player.blockCharges).toBe(0);
    expect(fight.state.fx.some((event) => event.kind === 'proc' && event.text === 'shield broken')).toBe(true);
  });

  it('charges to the windup point and misses a player who stepped out of it', () => {
    const hit = arenaFight({ skillIds: ['mob.physical.gore'], skillReadyAtUs: {},
      hitsPerSec: 2, atkTimer: 0.5 }, 5, 9.5);
    tick(hit.state, { arena: hit.arena, autoSkills: false });
    const charged = hit.arena.mobs[hit.mob.id];
    // A walk alone covers under two metres in this second; the lunge is the extra travel.
    expect(9.5 - charged.x).toBeGreaterThan(3.5);

    const miss = arenaFight({ skillIds: ['mob.physical.gore'], skillReadyAtUs: {},
      hitsPerSec: 2, atkTimer: 0.5 }, 5, 9.5);
    tick(miss.state, { arena: miss.arena, autoSkills: false, manual: { moveTo: { x: 5, y: 15 } } });
    expect(miss.state.fx.some((event) => event.kind === 'taken' && event.byId === miss.mob.id)).toBe(false);
  });

  it('misses a melee basic when a sight screen hides the player', () => {
    const clear = arenaFight({ skillIds: [], hitsPerSec: 2, atkTimer: 0.5, line: 'front' }, 5, 5.6);
    tick(clear.state, { arena: clear.arena, autoSkills: false });
    const clearSwing = clear.arena.actions.find((action) =>
      action.actorId === clear.mob.id && action.kind === 'swing');
    expect(clearSwing?.releasedAtUs).toBeDefined();
    expect(takenBy(clear.state, clear.mob.id)).toBe(true);

    const blocked = arenaFight({ skillIds: [], hitsPerSec: 2, atkTimer: 0.5, line: 'front' }, 5, 5.6);
    blocked.arena.nav = sightScreen(5.3);
    tick(blocked.state, { arena: blocked.arena, autoSkills: false });
    const blockedSwing = blocked.arena.actions.find((action) =>
      action.actorId === blocked.mob.id && action.kind === 'swing');
    expect(blockedSwing?.cancelReason).toBe('sight-blocked');
    expect(blockedSwing?.releasedAtUs).toBeUndefined();
    expect(takenBy(blocked.state, blocked.mob.id)).toBe(false);
  });

  it('misses a melee strike when a sight screen hides the player', () => {
    const blocked = arenaFight({ skillIds: ['mob.physical.shield-bash'], skillReadyAtUs: {},
      hitsPerSec: 2, atkTimer: 0.5, line: 'front' }, 5, 5.6);
    blocked.arena.nav = sightScreen(5.3);
    tick(blocked.state, { arena: blocked.arena, autoSkills: false });
    const cast = blocked.arena.actions.find((action) =>
      action.actorId === blocked.mob.id && action.kind === 'cast');
    expect(cast?.cancelReason).toBe('sight-blocked');
    expect(takenBy(blocked.state, blocked.mob.id)).toBe(false);
  });

  it('closes to a ready strike reach instead of holding at its basic range', () => {
    const fight = arenaFight({ line: 'stand-off', skillIds: ['mob.cold.frost-bite'],
      skillReadyAtUs: {}, hitsPerSec: 2, atkTimer: 0.5, acc: 0 }, 5, 9.5);
    fight.arena.nav = openNav();
    const before = arenaDistance(fight.arena.player, fight.arena.mobs[fight.mob.id]);
    const manual = { moveTo: { x: 5, y: 6 } };
    for (let index = 0; index < 4; index++) {
      manual.moveTo = { x: 5, y: 6 };
      tick(fight.state, { arena: fight.arena, autoSkills: false, manual });
    }
    expect(fight.state.fx.some((event) =>
      event.kind === 'cast' && event.skillId === 'mob.cold.frost-bite')).toBe(true);
    expect(arenaDistance(fight.arena.player, fight.arena.mobs[fight.mob.id])).toBeLessThan(before);
  });

  it('keeps a no-nav stand-off body at its radius-only basic range', () => {
    const fight = arenaFight({ line: 'stand-off', skillIds: ['mob.cold.frost-bite'],
      skillReadyAtUs: {}, hitsPerSec: 2, atkTimer: 0.5, acc: 0 }, 5, 9.5);
    const manual = { moveTo: { x: 5, y: 6 } };
    for (let index = 0; index < 4; index++) {
      manual.moveTo = { x: 5, y: 6 };
      tick(fight.state, { arena: fight.arena, autoSkills: false, manual });
    }
    expect(fight.state.fx.some((event) =>
      event.kind === 'cast' && event.skillId === 'mob.cold.frost-bite')).toBe(false);
    expect(arenaDistance(fight.arena.player, fight.arena.mobs[fight.mob.id])).toBeGreaterThan(3.5);
  });

  it('stops retrying a strike route it cannot walk', () => {
    const fight = arenaFight({ line: 'stand-off', skillIds: ['mob.cold.frost-bite'],
      skillReadyAtUs: {}, hitsPerSec: 1, atkTimer: 0, acc: 0 }, 1, 8);
    fight.arena.nav = fullWall(4);
    const manual = { moveTo: { x: 1, y: 6 } };
    for (let index = 0; index < 5; index++) {
      manual.moveTo = { x: 1, y: 6 };
      tick(fight.state, { arena: fight.arena, autoSkills: false, manual });
    }
    const actor = fight.arena.mobs[fight.mob.id];
    expect(actor.routeFailCount ?? 0).toBeGreaterThanOrEqual(3);
    expect(actor.routeFailed).toBe(true);
    expect(actor.strikeRangeM).toBeUndefined();
    expect(fight.state.fx.some((event) =>
      event.kind === 'cast' && event.skillId === 'mob.cold.frost-bite')).toBe(false);
  });
});
