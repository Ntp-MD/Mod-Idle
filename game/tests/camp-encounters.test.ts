import { describe, expect, it } from 'vitest';
import { E, eng, farm, TOWN } from '../src/engine/client';
import { mulberry32 } from '../src/engine/client-helpers';
import { cancelCampEncounter, chooseCampEncounter, tickCampEncounters } from '../src/sim/camp-encounters';
import { newGame, tick } from '../src/sim/game';
import { standingProgress, settlementOfZone } from '../src/sim/town';
import { fieldActionProblem } from '../src/sim/fieldwork';
import { settlementCell, zoneOf } from '../src/sim/road';
import { hexKey } from '../src/sim/map-exploration';
import type { CampEncounterActive, CampEncounterKind } from '../src/sim/fieldwork';
import type { Mob } from '../src/sim/types';

const atCamp = () => {
  const state = newGame(91);
  const cell = { q: 4, r: 3, sub: null, wild: E.fieldwork.wild_site_index.mine };
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
  id: `camp-${Math.floor(rng() * 1e9)}`, species: 'Kobold', speciesId: 'kobold', kind: 'Small',
  zone: 1, level: 1, hp: 5, hpMax: 5, ps: 1, acc: 1, evasion: 0, dodgeRate: 0, armour: 0,
  res: 0, damage: 'physical', innate: [], xp: 1, line: 'front', hitsPerSec: 0, atkTimer: 0, engageSec: 0,
}];

function offer(state: ReturnType<typeof newGame>, kind: CampEncounterKind, payload: Record<string, unknown>,
  stage: 'warning' | 'choice' = 'choice', preparedGroup: Mob[] = []) {
  const active: CampEncounterActive = {
    id: state.fieldwork.campEncounters.serial + 1, kind, stage, origin: state.fieldwork.camp!.cell,
    warningSec: stage === 'warning' ? E.fieldwork.camp_encounters.warning_sec : 0,
    choiceSec: stage === 'choice' ? E.fieldwork.camp_encounters.choice_sec : 0,
    payload, preparedGroup, participantIds: [],
  };
  state.fieldwork.campEncounters.serial = active.id;
  state.fieldwork.campEncounters.active = active;
  return active;
}

/** A neighbouring hex that belongs to the same zone as the Camp, so a herd can point at it. */
function neighbourInZone(state: ReturnType<typeof newGame>) {
  const camp = state.fieldwork.camp!.cell;
  const ring = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]]
    .map(([dq, dr]) => ({ q: camp.q + dq, r: camp.r + dr }));
  const hit = ring.find(cell => zoneOf(cell) === state.zone);
  return hit || settlementCell(settlementOfZone(state.zone)!.id)!;
}

/** An Expedition slot the herd clue can point at: one named Species from one subzone. */
function expeditionTask(zone: number, subzone: number, species: string, progress: number) {
  return { kind: 'expedition' as const, zone, subzone, targetSpecies: species, n: 1, progress,
    stone: 'tier' as const, count: 1, claimed: false, offeredAt: 0 };
}

describe('Camp encounter lifecycle', () => {
  it('does not create or advance events offline or away from Camp', () => {
    const state = atCamp();
    state.fieldwork.campEncounters.streamState = seedFor(1);
    state.fieldwork.campEncounters.exposureSec = 100;
    const before = structuredClone(state.fieldwork.campEncounters);
    tickCampEncounters(state, false, spawn);
    expect(state.fieldwork.campEncounters).toEqual(before);
    state.hunting = true;
    tickCampEncounters(state, true, spawn);
    expect(state.fieldwork.campEncounters.active).toBeNull();
  });

  it('does not open an event on the tick a Push recovery ends', () => {
    const state = atCamp();
    state.fieldwork.campEncounters.streamState = seedFor(1);
    state.phase = 'camp';
    state.campSec = 1;
    tick(state, {}, { online: true });
    expect(state.phase).not.toBe('camp');
    expect(state.fieldwork.campEncounters.active).toBeNull();
    tick(state, {}, { online: true });
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
    tick(state, {}, { online: true });
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

  it('resolves a finished fight once without starting a hunting loop', () => {
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

  it('grants capped help credit without inventing kills and uses shared Standing progress', () => {
    const state = atCamp(), home = settlementOfZone(state.zone)!;
    const budget = eng.SETTLEMENT_BUDGET_KILLS[state.zone];
    const credit = Math.floor(budget * 0.01);
    const foodId = (E.fieldwork.regional_sources as Record<string, { food: string }>)[String(state.zone)].food;
    state.fieldwork.foods[foodId] = E.fieldwork.camp_encounters.aid_food;
    const active = offer(state, 'injured', {
      settlementId: home.id, foodId, foodAmount: E.fieldwork.camp_encounters.aid_food,
      potionName: null, potionAmount: 1, credit,
    });
    const kills = state.counters.zoneKills[state.zone] || 0;
    expect(chooseCampEncounter(state, active.id, 'help-food', true).ok).toBe(true);
    expect(state.town.helpCredit[home.id]).toBe(credit);
    expect(state.counters.zoneKills[state.zone] || 0).toBe(kills);
    expect(standingProgress(state, home.id)).toMatchObject({ kills, helpCredit: credit, progress: kills + credit });
  });

  it('adds aid only to progress and retains the legacy kill threshold field', () => {
    const state = atCamp(), home = settlementOfZone(state.zone)!;
    const budget = eng.SETTLEMENT_BUDGET_KILLS[state.zone];
    const required = Math.ceil(TOWN.standing.tiers[0].share * budget);
    state.counters.zoneKills[state.zone] = required - 1;
    state.town.helpCredit[home.id] = 1;
    expect(standingProgress(state, home.id)).toMatchObject({
      tier: 1, kills: required - 1, helpCredit: 1, progress: required,
      next: { kills: Math.ceil(TOWN.standing.tiers[1].share * budget), requiredProgress: Math.ceil(TOWN.standing.tiers[1].share * budget) },
    });
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
    const active = offer(state, 'sounds', { species: 'kobold' }, 'warning', group);
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
    const active = offer(state, 'nest', { species: 'kobold' });
    expect(fieldActionProblem(state, 'mine')).toBe('clear the nearby nest before gathering');
    expect(chooseCampEncounter(state, active.id, 'pause', true).ok).toBe(true);
    expect(fieldActionProblem(state, 'mine')).not.toBe('clear the nearby nest before gathering');
  });

  it('follows herd tracks with an ordinary walk and refuses a task that no longer qualifies', () => {
    const state = atCamp();
    const target = neighbourInZone(state);
    state.mapJournal!.scouted = [hexKey(target)];
    state.town.tasks = [expeditionTask(state.zone, 0, 'kobold', 0)];
    const active = offer(state, 'herd', { species: 'kobold', zone: state.zone, subzone: 0, cell: target });
    expect(chooseCampEncounter(state, active.id, 'follow', true).ok).toBe(true);
    expect(state.walk).not.toBeNull();
    expect(state.fieldwork.campEncounters.active).toBeNull();
    expect(state.fieldwork.campEncounters.recap).toBe('Followed the herd tracks');

    const stale = atCamp();
    stale.mapJournal!.scouted = [hexKey(target)];
    stale.town.tasks = [expeditionTask(stale.zone, 0, 'kobold', 1)];
    const refused = offer(stale, 'herd', { species: 'kobold', zone: stale.zone, subzone: 0, cell: target });
    const before = structuredClone(stale);
    expect(chooseCampEncounter(stale, refused.id, 'follow', true).ok).toBe(false);
    expect(stale).toEqual(before);
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
    const active = offer(state, 'discovered', { species: 'kobold' });
    expect(chooseCampEncounter(state, active.id, 'shelter', true).ok).toBe(true);
    expect(state.fieldwork.campEncounters.exposureSec).toBe(0);
  });

  it('secures the supplies against a prowler without spending anything', () => {
    const state = atCamp();
    const foodId = (E.fieldwork.regional_sources as Record<string, { food: string }>)[String(state.zone)].food;
    state.fieldwork.foods[foodId] = 3;
    state.fieldwork.materials.ore = 2;
    const active = offer(state, 'prowler', { species: 'kobold' });
    expect(chooseCampEncounter(state, active.id, 'secure', true).ok).toBe(true);
    expect(state.fieldwork.foods[foodId]).toBe(3);
    expect(state.fieldwork.materials.ore).toBe(2);
    expect(state.group).toHaveLength(0);
    expect(state.fieldwork.campEncounters.active).toBeNull();
  });

  it('refuses a help grant that would pass the settlement cap', () => {
    const state = atCamp(), home = settlementOfZone(state.zone)!;
    const cap = Math.floor(eng.SETTLEMENT_BUDGET_KILLS[state.zone] * TOWN.standing.camp_aid_credit_cap_share);
    state.town.helpCredit[home.id] = cap;
    const foodId = (E.fieldwork.regional_sources as Record<string, { food: string }>)[String(state.zone)].food;
    state.fieldwork.foods[foodId] = E.fieldwork.camp_encounters.aid_food;
    const active = offer(state, 'injured', {
      settlementId: home.id, foodId, foodAmount: E.fieldwork.camp_encounters.aid_food,
      potionName: null, potionAmount: 1, credit: 1,
    });
    const before = structuredClone(state);
    expect(chooseCampEncounter(state, active.id, 'help-food', true).ok).toBe(false);
    expect(state).toEqual(before);
  });

  it('pays the potion alternative from the bottle bucket and never heals the player', () => {
    const state = atCamp(), home = settlementOfZone(state.zone)!;
    const bottle = farm.P.list.find((p: any) => farm.potionPct(p, 'hp') > 0)!;
    state.farm.potions[bottle.name] = 1;
    state.player.hp = 100;
    const credit = Math.floor(eng.SETTLEMENT_BUDGET_KILLS[state.zone] * TOWN.standing.camp_aid_credit_share);
    const active = offer(state, 'injured', {
      settlementId: home.id, foodId: null, foodAmount: 0, potionName: bottle.name, potionAmount: 1, credit,
    });
    expect(chooseCampEncounter(state, active.id, 'help-potion', true).ok).toBe(true);
    expect(state.farm.potions[bottle.name]).toBe(0);
    expect(state.player.hp).toBe(100);
    expect(state.town.helpCredit[home.id]).toBe(credit);
  });

  it('keeps a Camp fight from becoming a hunting loop or a second group', () => {
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
