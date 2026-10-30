import { describe, expect, it } from 'vitest';
import type { NavLayout } from '@engine/navigation.ts';
import { captureCombatArena, createCombatArena, syncCombatArena } from '@sim/combat/combat-arena';
import { advanceEngagement, createEngagementState } from '@sim/core/tick/engagement';
import { characterSheet, newGame } from '@sim/core/game';
import { pinFieldPopulation, mobFixture } from '../fixtures/mobFixture';
import { spawns } from '../../src/engine/client';

function scene(species: string[], points: [number, number][]) {
  const state = newGame(77);
  state.hunting = true;
  state.group = species.map((speciesId, index) => mobFixture({
    id: `m${index}`, speciesId, species: speciesId, hp: 1e8, hpMax: 1e8,
  }));
  const arena = createCombatArena();
  syncCombatArena(arena, state, 0, 1_000_000, characterSheet(state).maxHp);
  Object.assign(arena.player, { x: 1, y: 10 });
  points.forEach(([x, y], index) => Object.assign(arena.mobs[`m${index}`], { x, y }));
  captureCombatArena(arena, state, 0);
  pinFieldPopulation(state, state.group.length,
    new Map(state.group.map((mob) => [mob.id, arena.mobs[mob.id]])));
  const sync = (atUs = 0) => advanceEngagement(state, {
    arena, online: true,
    fieldProfile: () => spawns.profileFor(state.zone, state.cell?.sub ?? null),
    cancelMobPreparation: () => {}, tickStartUs: atUs, state: createEngagementState(), prime: false,
  });
  return { state, arena, sync };
}

const sightScreen = (): NavLayout => ({
  version: 1, bounds: { x: 0, y: 0, width: 50, height: 32 }, cellSize: 1,
  obstacles: [{ kind: 'box', id: 'screen', x: 6.5, y: 0, width: 1, height: 20,
    flags: { movement: false, sight: true, projectiles: false } }],
});

describe('P2 engagement — authored awareness', () => {
  it('leaves a focused, approached body unaware until a real cause occurs', () => {
    const { state, arena, sync } = scene(['wolf'], [[30, 10]]);
    state.field!.engagementIds = [];
    arena.focusId = 'm0';
    arena.intent = { skillId: 'attack.firestorm', targetId: 'm0',
      targetPoint: { x: 30, y: 10 }, phase: 'approach', manual: true };
    expect(sync().syncEngagement(0).added).toEqual([]);
    expect(state.field!.engagementIds).toEqual([]);
    expect(state.field!.engagementCauses).toEqual({});
  });

  it('wakes a proximity Species inside aggro and leaves a retaliating one asleep', () => {
    const { state, sync } = scene(['wolf', 'slime'], [[4.9, 10], [4.9, 12]]);
    state.field!.engagementIds = [];
    sync().syncEngagement(0);
    expect(state.field!.engagementIds).toEqual(['m0']);
    expect(state.field!.engagementCauses).toEqual({ m0: 'proximity' });
  });

  it('respects the authored aggro radius', () => {
    const { state, sync } = scene(['wolf'], [[5.1, 10]]);
    state.field!.engagementIds = [];
    sync().syncEngagement(0);
    expect(state.field!.engagementIds).toEqual([]);
  });

  it('alerts a retaliating body only through a resolved contact', () => {
    const { state, sync } = scene(['slime'], [[9, 10]]);
    state.field!.engagementIds = [];
    const engagement = sync();
    expect(engagement.syncEngagement(0).added).toEqual([]);
    const delta = engagement.alertContact('m0', 0);
    expect(delta.added).toEqual(['m0']);
    expect(state.field!.engagementCauses).toEqual({ m0: 'contact' });
    // A second contact does not duplicate the membership or its reason.
    expect(engagement.alertContact('m0', 0).added).toEqual([]);
    expect(state.field!.engagementIds).toEqual(['m0']);
  });

  it('wakes one same-Species assist link and never cascades on later samples', () => {
    const { state, sync } = scene(['wolf', 'wolf', 'wolf', 'wolf'],
      [[4.9, 10], [7.8, 10], [10.7, 10], [13.6, 10]]);
    state.field!.engagementIds = [];
    const engagement = sync();
    engagement.syncEngagement(0);
    expect(state.field!.engagementIds).toEqual(['m0', 'm1']);
    expect(state.field!.engagementCauses).toEqual({ m0: 'proximity', m1: 'assist' });
    // Later samples re-derive membership: the assisted body is not a new source.
    engagement.syncEngagement(250_000);
    expect(state.field!.engagementIds).toEqual(['m0', 'm1']);
    // A new direct cause on m2 legitimately wakes its own neighbour once.
    engagement.alertContact('m2', 500_000);
    expect(state.field!.engagementIds).toEqual(['m0', 'm1', 'm2', 'm3']);
    expect(state.field!.engagementCauses).toEqual({
      m0: 'proximity', m1: 'assist', m2: 'contact', m3: 'assist',
    });
  });

  it('keeps assist inside the Species: a neighbour of another Species is not eligible', () => {
    const { state, sync } = scene(['wolf', 'goblin', 'wolf'], [[4.9, 10], [6.5, 10], [7.4, 10]]);
    state.field!.engagementIds = [];
    sync().syncEngagement(0);
    expect(state.field!.engagementIds).toEqual(['m0', 'm2']);
    expect(state.field!.engagementCauses).toEqual({ m0: 'proximity', m2: 'assist' });
  });

  it('applies the authored sight mask to proximity acquisition', () => {
    const { state, arena, sync } = scene(['wolf', 'wolf'], [[8, 10], [3, 10]]);
    state.field!.engagementIds = [];
    arena.nav = sightScreen();
    sync().syncEngagement(0);
    expect(state.field!.engagementIds).toEqual(['m1']);
  });
});
