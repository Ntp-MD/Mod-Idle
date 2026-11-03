import { describe, expect, it } from 'vitest';
import type { NavLayout } from '@engine/navigation.ts';
import { arenaAction, captureCombatArena, createCombatArena, syncCombatArena,
  type CombatArenaAction, type CombatMobFlight } from '@sim/combat/combat-arena';
import { advanceEngagement, createEngagementState } from '@sim/core/tick/engagement';
import { characterSheet, newGame } from '@sim/core/game';
import { pinFieldPopulation, mobFixture } from '../fixtures/mobFixture';
import { spawns } from '../../src/engine/client';

type Cancel = (action: CombatArenaAction, atUs: number, reason: string) => void;

function scene(species: string[], points: [number, number][],
  extra: { cancel?: Cancel } = {}) {
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
  const sync = (atUs = 0, opts: { pinned?: ReadonlySet<string> } = {}) => advanceEngagement(state, {
    arena, online: true,
    fieldProfile: () => spawns.profileFor(state.zone, state.cell?.sub ?? null),
    cancelMobPreparation: extra.cancel ?? (() => {}), tickStartUs: atUs,
    state: createEngagementState(), prime: false, pinnedIds: opts.pinned,
  });
  return { state, arena, sync };
}

const truncatedOf = (field: unknown): number | undefined =>
  (field as { engagementTruncated?: number }).engagementTruncated;

const flight = (over: Pick<CombatMobFlight, 'mobId' | 'actionId'> & Partial<CombatMobFlight>): CombatMobFlight => ({
  mob: mobFixture({ id: over.mobId }), source: { x: 0, y: 0 }, destination: { x: 1, y: 0 },
  position: { x: 0, y: 0 }, releaseAtUs: 0, impactAtUs: 1_000_000, speedMps: 12, radiusM: 0.2,
  ...over,
});

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

describe('P1 engagement — cap and released work', () => {
  it('reserves a pinned impact-owed body before the cap and receipts the drop', () => {
    const { state, sync } = scene(['wolf', 'wolf', 'wolf'], [[3, 8], [3, 10], [3, 12]]);
    state.field!.engagementIds = [];
    state.field!.slots = state.field!.slots.slice(0, 1);
    sync(0, { pinned: new Set(['m2']) }).syncEngagement(0);
    // A whole-cap field keeps the pinned body; the ordinary candidates are what the cap drops.
    expect(state.field!.engagementIds).toEqual(['m2']);
    expect(truncatedOf(state.field)).toBe(2);
    // Without the pin the same field truncates to its first candidate, still with a receipt.
    state.field!.engagementIds = [];
    state.field!.engagementCauses = {};
    sync().syncEngagement(0);
    expect(state.field!.engagementIds).toEqual(['m0']);
    expect(truncatedOf(state.field)).toBe(2);
  });

  it('never drops a pinned body to the cap, even when the pins alone exceed it', () => {
    const { state, sync } = scene(['wolf', 'wolf', 'wolf'], [[3, 8], [3, 10], [3, 12]]);
    state.field!.engagementIds = [];
    state.field!.slots = state.field!.slots.slice(0, 1);
    sync(0, { pinned: new Set(['m1', 'm2']) }).syncEngagement(0);
    expect(state.field!.engagementIds).toEqual(['m1', 'm2']);
    expect(truncatedOf(state.field)).toBe(1);
  });

  it('cancels an unresolved departing projectile and keeps a committed ground shot', () => {
    const cancelled: { id: number; atUs: number; reason: string }[] = [];
    const { state, arena, sync } = scene(['wolf', 'wolf'], [[3, 10], [3, 12]], {
      cancel: (action, atUs, reason) => {
        cancelled.push({ id: action.id, atUs, reason });
        action.cancelledAtUs = atUs;
        action.cancelReason = reason;
      },
    });
    state.field!.engagementIds = ['m0', 'm1'];
    const engagedShot = arenaAction(arena, 'm0', 'swing', 0, 'player')!;
    const departingShot = arenaAction(arena, 'm1', 'swing', 0, 'player')!;
    departingShot.releasedAtUs = 0;
    const groundShot = arenaAction(arena, 'm1', 'cast', 0, 'player')!;
    groundShot.releasedAtUs = 0;
    arena.mobFlights.push(
      flight({ mobId: 'm0', actionId: engagedShot.id }),
      flight({ mobId: 'm1', actionId: departingShot.id, skillId: 'mob.shot' }),
      flight({ mobId: 'm1', actionId: groundShot.id, skillId: 'mob.ground', kind: 'ground', impactRadiusM: 2 }),
    );
    // m1 dies: it leaves the engagement, so its owed projectile may not land; its committed ground
    // point is the cast's own physics and stays (mob-shots reads the player at impact).
    state.group[1].hp = 0;
    const { removed } = sync(250_000).syncEngagement(250_000);
    expect(removed).toEqual(['m1']);
    expect(arena.mobFlights.map((shot) => shot.mobId)).toEqual(['m0', 'm1']);
    expect(arena.mobFlights[1].kind).toBe('ground');
    expect(cancelled).toEqual([{ id: departingShot.id, atUs: 250_000, reason: 'disengaged' }]);
    const receipt = arena.actions.find((action) => action.id === departingShot.id);
    expect(receipt?.cancelReason).toBe('disengaged');
  });
});
