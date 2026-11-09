import { describe, expect, it } from 'vitest';
import { E, fieldwork } from '../../src/engine/client';
import { mulberry32 } from '../../src/engine/client-helpers';
import { cancelCampEncounter, chooseCampEncounter, tickCampEncounters } from '@sim/world/camp-encounters';
import { newGame, tick } from '@sim/core/game';
import { fieldActionProblem, normalizeCampEncounterState } from '@sim/world/fieldwork';

import { hexKey } from '@sim/world/map-exploration';
import type { CampEncounterActive, CampEncounterKind } from '@sim/world/fieldwork';
import type { Mob } from '@sim/core/types';
import { liveSocialSpecies } from '../fixtures/liveMob';

const SOCIAL = liveSocialSpecies();

const atCamp = () => {
  const state = newGame(91);
  const cell = { q: 4, r: 3, sub: null, site: null };
  state.cell = cell;
  state.fieldwork.camp = { cell, zone: state.zone };
  state.fieldwork.campEncounters.graceSec = 0;
  state.fieldwork.campEncounters.checkSec = E.fieldwork.camp_encounters.check_interval_sec - 1;
  return state;
};

function seedFor(index: number): number {
  for (let seed = 1; seed < 10000; seed++) {
    const rng = mulberry32(seed);
    if (rng() < E.fieldwork.camp_encounters.chance_per_check && Math.floor(rng() * 2) === index) return seed;
  }
  throw new Error('could not find a deterministic Camp event seed');
}

const spawn = (_zone: number, _subzone: number | null, rng: () => number): Mob[] => [{
  id: `camp-${Math.floor(rng() * 1e9)}`, species: SOCIAL.name, speciesId: SOCIAL.id, kind: 'Small',
  zone: 1, level: 1, hp: 5, hpMax: 5, ps: 1, acc: 1, evasion: 0, dodgeRate: 0, armour: 0,
  res: 0, damage: 'physical', innate: [], xp: 1, line: 'front', hitsPerSec: 0, atkTimer: 0, engageSec: 0,
}];

function offer(state: ReturnType<typeof newGame>, kind: CampEncounterKind, payload: Record<string, unknown>,
  stage: 'warning' | 'choice' = 'choice', preparedGroup: Mob[] = []) {
  const active: CampEncounterActive = {
    id: state.fieldwork.campEncounters.serial + 1, kind, stage, origin: state.fieldwork.camp!.cell,
    warningSec: stage === 'warning' ? E.fieldwork.camp_encounters.warning_sec : 0,
    choiceSec: stage === 'choice' ? E.fieldwork.camp_encounters.choice_sec : 0,
    payload, preparedGroup, participantIds: [], story: null,
  };
  state.fieldwork.campEncounters.serial = active.id;
  state.fieldwork.campEncounters.active = active;
  return active;
}


describe('Camp encounter lifecycle', () => {
  it('does not create or advance events offline or away from Camp', () => {
    const state = atCamp();
    state.fieldwork.campEncounters.streamState = seedFor(1);
    state.fieldwork.campEncounters.exposureSec = 100;
    const before = structuredClone(state.fieldwork.campEncounters);
    tickCampEncounters(state, false, spawn);
    expect(state.fieldwork.campEncounters).toEqual(before);
    state.cell = { q: 0, r: 0, sub: null, site: null };
    tickCampEncounters(state, true, spawn);
    expect(state.fieldwork.campEncounters.active).toBeNull();
  });

  it('does not open an event on the tick a Push recovery ends', () => {
    const state = atCamp();
    state.fieldwork.campEncounters.streamState = seedFor(1);
    state.phase = 'camp';
    state.campSec = 1;
    tick(state, { online: true });
    expect(state.phase).not.toBe('camp');
    expect(state.fieldwork.campEncounters.active).toBeNull();
    tick(state, { online: true });
    expect(state.fieldwork.campEncounters.active?.kind).toBe('prowler');
  });

  it('uses its own reproducible stream to prepare one prowler without touching world RNG', () => {
    const seed = seedFor(1), a = atCamp(), b = atCamp();
    a.fieldwork.campEncounters.streamState = seed;
    b.fieldwork.campEncounters.streamState = seed;
    const worldA = a.rngState, worldB = b.rngState;
    tickCampEncounters(a, true, spawn);
    tickCampEncounters(b, true, spawn);
    expect(a.fieldwork.campEncounters.active).toEqual(b.fieldwork.campEncounters.active);
    expect(a.fieldwork.campEncounters.active?.kind).toBe('prowler');
    expect(a.fieldwork.campEncounters.active?.preparedGroup).toHaveLength(1);
    expect(a.rngState).toBe(worldA);
    expect(b.rngState).toBe(worldB);
  });

  it('runs encounter generation after the ordinary world tick', () => {
    const state = atCamp();
    state.fieldwork.campEncounters.streamState = seedFor(1);
    tick(state, { online: true });
    expect(state.fieldwork.campEncounters.active?.kind).toBe('prowler');
    expect(state.fieldwork.campEncounters.active?.stage).toBe('warning');
  });

  it('manual retreat cancels the opportunity, while manual fight uses the frozen group', () => {
    const state = atCamp();
    state.fieldwork.campEncounters.streamState = seedFor(1);
    tickCampEncounters(state, true, spawn);
    const active = state.fieldwork.campEncounters.active!;
    expect(chooseCampEncounter(state, active.id, 'fight', false).ok).toBe(false);
    expect(chooseCampEncounter(state, active.id, 'fight', true).ok).toBe(true);
    expect(state.group.map(m => m.id)).toEqual(active.participantIds);
    expect(state.hunting).toBe(false);
    expect(state.fieldwork.action).toBeNull();
    cancelCampEncounter(state, 'Player retreated');
    expect(state.fieldwork.campEncounters.active).toBeNull();
    expect(state.fieldwork.campEncounters.recap).toBe('Player retreated');
    expect(state.group).toHaveLength(1);
  });

  it('timeout policy shelters safely or starts the prepared group, once', () => {
    const avoided = atCamp();
    avoided.fieldwork.campEncounters.streamState = seedFor(1);
    tickCampEncounters(avoided, true, spawn);
    const warned = avoided.fieldwork.campEncounters.active!;
    for (let i = 0; i < E.fieldwork.camp_encounters.warning_sec + E.fieldwork.camp_encounters.choice_sec; i++)
      tickCampEncounters(avoided, true, spawn);
    expect(avoided.group).toHaveLength(0);
    expect(avoided.fieldwork.campEncounters.active).toBeNull();
    expect(avoided.fieldwork.campEncounters.recap).toBe('Encounter passed');
    expect(warned.preparedGroup).toHaveLength(1);

    const defended = atCamp();
    defended.fieldwork.campEncounters.policy = 'defend';
    defended.fieldwork.campEncounters.streamState = seedFor(1);
    tickCampEncounters(defended, true, spawn);
    for (let i = 0; i < E.fieldwork.camp_encounters.warning_sec + E.fieldwork.camp_encounters.choice_sec; i++)
      tickCampEncounters(defended, true, spawn);
    expect(defended.group).toHaveLength(1);
    expect(defended.fieldwork.campEncounters.active?.stage).toBe('combat');
    expect(defended.fieldwork.campEncounters.active?.participantIds).toEqual(defended.group.map(m => m.id));
  });

  it('resolves a finished fight once and resumes ordinary field hunting', () => {
    const state = atCamp();
    state.fieldwork.campEncounters.streamState = seedFor(1);
    tickCampEncounters(state, true, spawn);
    const id = state.fieldwork.campEncounters.active!.id;
    expect(chooseCampEncounter(state, id, 'fight', true).ok).toBe(true);
    state.group = [];
    tickCampEncounters(state, true, spawn);
    expect(state.fieldwork.campEncounters.active).toBeNull();
    expect(state.fieldwork.campEncounters.recap).toBe('Camp threat defeated');
    expect(state.hunting).toBe(false);
    const cursor = state.fieldwork.campEncounters.streamState;
    tickCampEncounters(state, true, spawn);
    expect(state.fieldwork.campEncounters.streamState).toBe(cursor);
  });

  it('commits traveler barter atomically and refuses stale inventory without changes', () => {
    const state = atCamp(), foodId = (E.fieldwork.regional_sources as Record<string, { food: string }>)[String(state.zone)].food;
    state.fieldwork.foods[foodId] = E.fieldwork.camp_encounters.barter_food;
    const active = offer(state, 'traveler', { foodId, foodAmount: E.fieldwork.camp_encounters.barter_food, materials: ['ore'] });
    const result = chooseCampEncounter(state, active.id, 'trade-ore', true);
    expect(result.ok).toBe(true);
    expect(state.fieldwork.foods[foodId]).toBe(0);
    expect(state.fieldwork.materials.ore).toBe(1);

    const refused = atCamp();
    const key = (E.fieldwork.regional_sources as Record<string, { food: string }>)[String(refused.zone)].food;
    const stale = offer(refused, 'traveler', { foodId: key, foodAmount: 2, materials: ['ore'] });
    const before = structuredClone(refused);
    expect(chooseCampEncounter(refused, stale.id, 'trade-ore', true).ok).toBe(false);
    expect(refused).toEqual(before);
  });

  it('starts the prepared fight at the end of the warning under the engage policy', () => {
    const state = atCamp();
    state.fieldwork.campEncounters.policy = 'engage';
    state.fieldwork.campEncounters.streamState = seedFor(1);
    tickCampEncounters(state, true, spawn);
    expect(state.fieldwork.campEncounters.active?.kind).toBe('prowler');
    for (let i = 0; i < E.fieldwork.camp_encounters.warning_sec; i++) tickCampEncounters(state, true, spawn);
    expect(state.group).toHaveLength(1);
    expect(state.fieldwork.campEncounters.active?.stage).toBe('combat');
    expect(state.fieldwork.campEncounters.active?.participantIds).toEqual(state.group.map(m => m.id));
  });

  it('keeps the offer frozen through a refusal and a repeated check', () => {
    const state = atCamp();
    state.fieldwork.campEncounters.streamState = seedFor(1);
    tickCampEncounters(state, true, spawn);
    const active = state.fieldwork.campEncounters.active!;
    const frozen = { id: active.id, payload: structuredClone(active.payload), group: active.preparedGroup.map(m => m.id) };
    expect(chooseCampEncounter(state, active.id, 'listen', true).ok).toBe(false);
    expect(state.fieldwork.campEncounters.active?.id).toBe(frozen.id);
    expect(state.fieldwork.campEncounters.active?.payload).toEqual(frozen.payload);
    tickCampEncounters(state, true, spawn);
    expect(state.fieldwork.campEncounters.active?.id).toBe(frozen.id);
    expect(state.fieldwork.campEncounters.active?.payload).toEqual(frozen.payload);
    expect(state.fieldwork.campEncounters.active?.preparedGroup.map(m => m.id)).toEqual(frozen.group);
  });

  it('surveys the Camp and its neighbours once when sounds are investigated, then fights the frozen group', () => {
    const state = atCamp();
    const group = spawn(state.zone, null, mulberry32(7));
    const active = offer(state, 'sounds', { species: SOCIAL.id }, 'warning', group);
    const visited = state.mapJournal!.visited.length;
    expect(chooseCampEncounter(state, active.id, 'investigate', true).ok).toBe(true);
    expect(active.stage).toBe('choice');
    expect(state.mapJournal!.scouted).toContain(hexKey(active.origin));
    expect(state.mapJournal!.visited.length).toBe(visited);
    expect(chooseCampEncounter(state, active.id, 'fight', true).ok).toBe(true);
    expect(state.group.map(m => m.id)).toEqual(active.participantIds);
    expect(state.hunting).toBe(false);
    expect(state.fieldwork.action).toBeNull();
  });

  it('stops the work for a nest and releases the guard when it passes', () => {
    const state = atCamp();
    state.cell = { ...state.cell!, site: 'mine' };
    const active = offer(state, 'nest', { species: SOCIAL.id });
    expect(fieldActionProblem(state, 'mine')).toBe('clear the nearby nest before gathering');
    expect(chooseCampEncounter(state, active.id, 'pause', true).ok).toBe(true);
    expect(fieldActionProblem(state, 'mine')).not.toBe('clear the nearby nest before gathering');
  });


  it('lets a traveler share news and resolves the offer once', () => {
    const state = atCamp();
    const active = offer(state, 'traveler', { foodId: 'river-fish', foodAmount: 2, materials: ['ore'] });
    expect(chooseCampEncounter(state, active.id, 'listen', true).ok).toBe(true);
    expect(state.mapJournal!.scouted).toContain(hexKey(active.origin));
    expect(state.fieldwork.campEncounters.active).toBeNull();
    expect(state.fieldwork.campEncounters.recap).toBe('Traveler shared news from nearby');
    const before = structuredClone(state);
    expect(chooseCampEncounter(state, active.id, 'trade-ore', true).ok).toBe(false);
    expect(state).toEqual(before);
  });

  it('resets the exposure when a discovered threat is sheltered', () => {
    const state = atCamp();
    state.fieldwork.campEncounters.exposureSec = 400;
    const active = offer(state, 'discovered', { species: SOCIAL.id });
    expect(chooseCampEncounter(state, active.id, 'shelter', true).ok).toBe(true);
    expect(state.fieldwork.campEncounters.exposureSec).toBe(0);
  });

  it('secures the supplies against a prowler without spending anything', () => {
    const state = atCamp();
    const foodId = (E.fieldwork.regional_sources as Record<string, { food: string }>)[String(state.zone)].food;
    state.fieldwork.foods[foodId] = 3;
    state.fieldwork.materials.ore = 2;
    const active = offer(state, 'prowler', { species: SOCIAL.id });
    expect(chooseCampEncounter(state, active.id, 'secure', true).ok).toBe(true);
    expect(state.fieldwork.foods[foodId]).toBe(3);
    expect(state.fieldwork.materials.ore).toBe(2);
    expect(state.group).toHaveLength(0);
    expect(state.fieldwork.campEncounters.active).toBeNull();
  });

  it('keeps a Camp fight from becoming a second group', () => {
    const state = atCamp();
    state.fieldwork.campEncounters.streamState = seedFor(1);
    tickCampEncounters(state, true, spawn);
    const id = state.fieldwork.campEncounters.active!.id;
    expect(chooseCampEncounter(state, id, 'fight', true).ok).toBe(true);
    tickCampEncounters(state, true, spawn);
    expect(state.group).toHaveLength(1);
    expect(state.hunting).toBe(false);
  });
});

function cacheState(draw: number) {
  const state = atCamp();
  const foodId = (E.fieldwork.regional_sources as Record<string, { food: string }>)[String(state.zone)].food;
  const offer = fieldwork.cacheOffer(state.zone, foodId, draw);
  const active: CampEncounterActive = {
    id: state.fieldwork.campEncounters.serial + 1, kind: 'supply-cache', stage: 'choice',
    origin: state.fieldwork.camp!.cell, warningSec: 0, choiceSec: E.fieldwork.camp_encounters.choice_sec,
    payload: { foodId }, preparedGroup: [], participantIds: [],
    story: { revision: 1, eventId: 'camp-supply-cache', sceneId: 'cache-ledge', lineIndex: 0, beat: 0, cache: offer, remainingSec: 0 },
  };
  state.fieldwork.campEncounters.serial = active.id;
  state.fieldwork.campEncounters.active = active;
  state.fieldwork.campEncounters.storyHistory.push({ encounterId: active.id, eventId: 'camp-supply-cache', kind: 'supply-cache', variantId: 'cache-ledge-0', terminalAction: null, followupUsed: false });
  return { state, active, foodId, offer };
}

describe('supply cache', () => {
  it('T-03 quick resolves the frozen gain/mixed/loss outcomes atomically with receipts', () => {
    for (const [draw, material, loss, scene] of [[0.1, 2, 0, 'cache-gain-result'], [0.6, 1, 1, 'cache-mixed-result'], [0.9, 0, 1, 'cache-loss-result']] as const) {
      const { state, active, foodId } = cacheState(draw);
      state.fieldwork.foods[foodId] = 3;
      const result = chooseCampEncounter(state, active.id, 'cache-quick', true);
      expect(result.ok).toBe(true);
      expect(state.fieldwork.materials.ore).toBe(material);
      expect(state.fieldwork.foods[foodId]).toBe(3 - loss);
      const receipt = state.fieldwork.campEncounters.lastReceipt!;
      expect(receipt.action).toBe('cache-quick');
      expect(receipt.sceneId).toBe(scene);
      expect(receipt.earned).toEqual(material > 0 ? [{ bucket: 'material', id: 'ore', count: material }] : []);
      expect(receipt.lost).toEqual(loss > 0 ? [{ bucket: 'food', id: foodId, count: loss }] : []);
      expect(receipt.paid).toEqual([]);
      expect(state.fieldwork.campEncounters.active).toBeNull();
      // stale repeat is refused
      expect(chooseCampEncounter(state, active.id, 'cache-quick', true).ok).toBe(false);
    }
  });

  it('T-04 quick is refused without food while frozen gain stays hidden; careful and leave remain usable', () => {
    const { state, active, foodId } = cacheState(0.1); // frozen gain
    state.fieldwork.foods[foodId] = 0;
    const before = structuredClone(state);
    expect(chooseCampEncounter(state, active.id, 'cache-quick', true).ok).toBe(false);
    expect(state).toEqual(before);
    expect(state.fieldwork.campEncounters.active!.story!.cache!.quickOutcome).toBe('gain');
    expect(chooseCampEncounter(state, active.id, 'cache-leave', true).ok).toBe(true);
    expect(state.fieldwork.campEncounters.lastReceipt!.sceneId).toBe('cache-left-result');
  });

  it('T-05 a quick outcome that cannot fit anywhere is refused whole, then the same frozen outcome succeeds', () => {
    const { state, active, foodId } = cacheState(0.1);
    state.fieldwork.foods[foodId] = 3;
    state.fieldwork.materials.ore = 10000; // no slot fits the potential gain
    const before = structuredClone(state);
    expect(chooseCampEncounter(state, active.id, 'cache-quick', true).ok).toBe(false);
    expect(state).toEqual(before);
    state.fieldwork.materials.ore = 0;
    expect(chooseCampEncounter(state, active.id, 'cache-quick', true).ok).toBe(true);
    expect(state.fieldwork.materials.ore).toBe(2);
  });

  it('T-06 careful grants exactly once at the end of its duration, ignoring unanswered timers', () => {
    const { state, active } = cacheState(0.4);
    expect(chooseCampEncounter(state, active.id, 'cache-careful', true).ok).toBe(true);
    expect(active.stage).toBe('resolving');
    const duration = active.story!.cache!.carefulSec;
    for (let i = 0; i < duration - 1; i++) tickCampEncounters(state, true, spawn);
    expect(state.fieldwork.materials.ore).toBe(0);
    expect(state.fieldwork.campEncounters.active!.stage).toBe('resolving');
    tickCampEncounters(state, true, spawn);
    expect(state.fieldwork.materials.ore).toBe(1);
    expect(state.fieldwork.campEncounters.active).toBeNull();
    expect(state.fieldwork.campEncounters.lastReceipt!.action).toBe('cache-careful');
    expect(state.fieldwork.campEncounters.lastReceipt!.elapsedSec).toBe(duration);
  });

  it('T-07 a full bag at completion defers to collect, which grants once after space frees', () => {
    const { state, active } = cacheState(0.4);
    expect(chooseCampEncounter(state, active.id, 'cache-careful', true, { beat: 0, stage: 'choice' }).ok).toBe(true);
    state.fieldwork.materials.ore = 10000;
    for (let i = 0; i < active.story!.cache!.carefulSec; i++) tickCampEncounters(state, true, spawn);
    expect(state.fieldwork.campEncounters.active!.stage).toBe('collect');
    expect(state.fieldwork.campEncounters.active!.story!.remainingSec).toBe(0);
    state.fieldwork.materials.ore = 0;
    const collect = state.fieldwork.campEncounters.active!;
    expect(chooseCampEncounter(state, collect.id, 'cache-collect', true, { beat: collect.story!.beat, stage: 'collect' }).ok).toBe(true);
    expect(state.fieldwork.materials.ore).toBe(1);
    expect(state.fieldwork.campEncounters.active).toBeNull();
  });

  it('T-08 leaving during recovery cancels the prospective reward and keeps only elapsed time; stale collect is refused', () => {
    const { state, active } = cacheState(0.4);
    expect(chooseCampEncounter(state, active.id, 'cache-careful', true).ok).toBe(true);
    for (let i = 0; i < 5; i++) tickCampEncounters(state, true, spawn);
    const elapsed = active.story!.cache!.carefulSec - active.story!.remainingSec;
    state.cell = { q: 99, r: 99, sub: null, site: null };
    tickCampEncounters(state, true, spawn);
    expect(state.fieldwork.campEncounters.active).toBeNull();
    expect(state.fieldwork.materials.ore).toBe(0);
    expect(state.fieldwork.campEncounters.lastReceipt!.action).toBe('cancelled');
    expect(state.fieldwork.campEncounters.lastReceipt!.sceneId).toBe('cache-cancel-result');
    expect(state.fieldwork.campEncounters.lastReceipt!.elapsedSec).toBe(elapsed);
    const before = structuredClone(state);
    expect(chooseCampEncounter(state, active.id, 'cache-collect', true).ok).toBe(false);
    expect(state).toEqual(before);
  });

  it('T-08 explicit cancel during recovery keeps elapsed time; expected beat/stage gates stale intents', () => {
    const { state, active } = cacheState(0.4);
    expect(chooseCampEncounter(state, active.id, 'cache-careful', true).ok).toBe(true);
    tickCampEncounters(state, true, spawn);
    const frozen = structuredClone(state);
    expect(chooseCampEncounter(state, active.id, 'cache-cancel', true, { beat: 99, stage: 'resolving' }).ok).toBe(false);
    expect(state).toEqual(frozen);
    expect(chooseCampEncounter(state, active.id, 'cache-cancel', true, { beat: active.story!.beat, stage: 'resolving' }).ok).toBe(true);
    expect(state.fieldwork.campEncounters.lastReceipt!.action).toBe('cache-cancel');
    expect(state.fieldwork.materials.ore).toBe(0);
  });

  it('T-08 starting fieldwork during timed recovery cancels the prospective reward', () => {
    const { state, active } = cacheState(0.4);
    expect(chooseCampEncounter(state, active.id, 'cache-careful', true).ok).toBe(true);
    state.fieldwork.action = { kind: 'mine', nextAt: state.clockSec + 10 };
    tickCampEncounters(state, true, spawn);
    expect(state.fieldwork.campEncounters.active).toBeNull();
    expect(state.fieldwork.campEncounters.lastReceipt!.sceneId).toBe('cache-cancel-result');
    expect(state.fieldwork.materials.ore).toBe(0);
  });

  it('T-09 offline ticks freeze resolving and collect work', () => {
    const { state, active } = cacheState(0.4);
    expect(chooseCampEncounter(state, active.id, 'cache-careful', true).ok).toBe(true);
    const before = structuredClone(state.fieldwork.campEncounters);
    tickCampEncounters(state, false, spawn);
    tickCampEncounters(state, false, spawn);
    expect(state.fieldwork.campEncounters).toEqual(before);
    state.fieldwork.materials.ore = 10000;
    for (let i = 0; i < active.story!.cache!.carefulSec; i++) tickCampEncounters(state, true, spawn);
    expect(state.fieldwork.campEncounters.active!.stage).toBe('collect');
    const collecting = structuredClone(state.fieldwork.campEncounters);
    tickCampEncounters(state, false, spawn);
    expect(state.fieldwork.campEncounters).toEqual(collecting);
  });

  it('T-10 cache never auto-fights under the engage policy and closes neutrally on timeout', () => {
    const { state, active } = cacheState(0.4);
    state.fieldwork.campEncounters.policy = 'engage';
    const choiceDuration = state.fieldwork.campEncounters.active!.choiceSec;
    for (let i = 0; i < choiceDuration; i++) tickCampEncounters(state, true, spawn);
    expect(state.group).toHaveLength(0);
    expect(state.fieldwork.campEncounters.active).toBeNull();
    expect(state.fieldwork.campEncounters.lastReceipt!.action).toBe('timeout');
  });

  it('normalizes a resolving cache intact and cancels one with a corrupt frozen offer', () => {
    const { state, active } = cacheState(0.4);
    expect(chooseCampEncounter(state, active.id, 'cache-careful', true).ok).toBe(true);
    normalizeCampEncounterState(state);
    expect(state.fieldwork.campEncounters.active!.story!.cache!.carefulSec).toBe(20);
    expect(state.fieldwork.campEncounters.active!.stage).toBe('resolving');
    state.fieldwork.campEncounters.active!.story!.cache!.unitYield = 999;
    normalizeCampEncounterState(state);
    expect(state.fieldwork.campEncounters.active).toBeNull();
    expect(state.fieldwork.campEncounters.cooldownSec).toBeGreaterThan(0);
  });
});
