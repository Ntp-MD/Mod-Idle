import { describe, expect, it } from 'vitest';
import { newGame } from '../src/sim/game';
import { currentCell, road } from '../src/sim/road';
import { E, eng, TOWN } from '../src/engine/client';
import { hexKey, MAP_EXPLORATION } from '../src/sim/map-exploration';
import { adventureTitle, adventureView, campActivityArt, stackAdventurePlacements, type AdventureCell } from '../src/ui/map-adventure';
import type { GameState } from '../src/sim/types';
import { mobFixture } from './mobFixture';

/**
 * The living board's rules, tested as rules: `adventureView` decides what stands on which block and
 * `paintMapAdventure` only carries that onto the sheet, so none of this needs a browser to prove.
 */
const cellOf = (h: { q: number; r: number }, over: Partial<AdventureCell> = {}): AdventureCell =>
  ({ ax: hexKey(h), q: h.q, r: h.r, town: null, sub: false, ...over });
const at = (view: ReturnType<typeof adventureView>, cls: string) => view.placements.filter(p => p.cls.startsWith(cls));
const stand = (s: GameState, h: { q: number; r: number }) => {
  s.cell = { ...h, sub: null, wild: null }; s.walk = null; s.group = []; s.fieldwork.action = null;
};
const killToTier = (s: GameState, tier: number) => {
  const budget = eng.SETTLEMENT_BUDGET_KILLS[s.zone];
  s.counters.zoneKills[s.zone] = tier > 0 ? Math.ceil(TOWN.standing.tiers[tier - 1].share * budget) : 0;
};

describe('adventure board placements', () => {
  it('marks knowledge on every block and an activity only under the feet', () => {
    const s = newGame(), feet = currentCell(s), near = road.neighbours(feet)[0], far = { q: feet.q + 6, r: feet.r };
    s.fieldwork.action = { kind: 'mine', nextAt: 0 } as GameState['fieldwork']['action'];
    const view = adventureView(s, [cellOf(feet), cellOf(near), cellOf(far)]);
    expect(view.marks.map(mark => mark.discovery)).toEqual(['explored', 'scouted', 'unknown']);
    expect(view.marks.map(mark => mark.activity)).toEqual(['mine', 'idle', 'idle']);
    s.fieldwork.action = null; s.group = [mobFixture({ species: 'Wolf', speciesId: 'wolf' })];
    expect(adventureView(s, [cellOf(feet)]).marks[0].activity).toBe('combat');
    s.group = [];
    expect(adventureView(s, [cellOf(feet)]).marks[0].activity).toBe('idle');
    s.walk = { from: feet, to: near, node: null, kind: 'bare', sub: null, wild: null,
      blocksTotal: 1, blocksLeft: 1, secLeft: 1, blocksWalked: 0 };
    expect(adventureView(s, [cellOf(feet)]).marks[0].activity).toBe('travel');
    s.group = [mobFixture({ species: 'Wolf', speciesId: 'wolf' })];
    expect(adventureView(s, [cellOf(feet)]).marks[0].activity).toBe('combat');
  });
  it('leaves unknown named sides unmarked after the tracks hint was removed', () => {
    const s = newGame(), feet = currentCell(s);
    const ring2 = { q: feet.q + 2, r: feet.r }, ring3 = { q: feet.q + 3, r: feet.r };
    const view = adventureView(s, [cellOf(ring2, { sub: true }), cellOf(ring3, { sub: true }), cellOf(ring2)]);
    expect(at(view, 'map-wild-hint')).toHaveLength(0);
    expect(view.marks.some(mark => mark.discovery === 'unknown')).toBe(true);
    s.mapJournal!.scouted.push(hexKey(ring2));
    expect(at(adventureView(s, [cellOf(ring2, { sub: true })]), 'map-wild-hint')).toHaveLength(0);
  });
  it('shares the territory figure for Unique clues without adding a second monster or revealing distant clues', () => {
    const s = newGame(), near = road.neighbours(currentCell(s))[0];
    const view = adventureView(s, [cellOf(near, { sub: true, uniqueSpecies: 'wolf' }),
      cellOf({ q: near.q + 6, r: near.r }, { sub: true, uniqueSpecies: 'wolf' })]);
    expect(view.marks[0].uniqueSpecies).toBe('wolf');
    expect(view.marks[1].uniqueSpecies).toBeUndefined();
    expect(at(view, 'map-unique-traces')).toHaveLength(0);
  });
  it('keeps earned Standing out of the map marker layer', () => {
    const s = newGame(), town = road.nodeById(s.town.visited[0]) ?? currentCell(s);
    const id = s.town.visited[0], cells = [cellOf(town, { town: id })];
    killToTier(s, 1);
    const view = adventureView(s, cells);
    expect(at(view, 'map-town-life')).toHaveLength(0);
    expect(view.marks[0].standing).toBe('1');
  });
  it('marks only known, matching and unclaimed Expedition destinations', () => {
    const s = newGame(), near = road.neighbours(currentCell(s))[0];
    s.town.tasks[0] = { ...s.town.tasks[0]!, kind: 'expedition', zone: s.zone, subzone: 0, progress: 1, n: 3, claimed: false };
    const matching = cellOf(near, { sub: true, zone: s.zone, subzone: 0 });
    const view = adventureView(s, [matching, cellOf(near, { sub: true, zone: s.zone, subzone: 1 }),
      cellOf({ q: near.q + 6, r: near.r }, { sub: true, zone: s.zone, subzone: 0 })]);
    expect(at(view, 'map-expedition')).toHaveLength(1);
    expect(at(view, 'map-expedition')[0].label).toBe('Expedition · 1/3');
    expect(at(view, 'map-expedition')[0].art).toContain('map-marker');
    expect(at(view, 'map-expedition')[0].art).toContain('<image');
    s.town.tasks[0]!.claimed = true;
    expect(at(adventureView(s, [matching]), 'map-expedition')).toHaveLength(0);
  });
  it('hides a trail site until it is known, dims it once claimed, and yields to a Camp', () => {
    const s = newGame();
    const site = { id: 'trail-1', q: 2, r: -2, kind: 'abandoned-camp' as const, remainingSec: MAP_EXPLORATION.spawn.lifetime_sec };
    s.mapJournal!.trail!.serial = 1; s.mapJournal!.trail!.sites.push(site);
    const key = hexKey(site), cells = [cellOf(site)];
    const sites = () => at(adventureView(s, cells), 'map-trail-site');
    expect(sites()).toHaveLength(0);
    s.mapJournal!.scouted.push(key);
    expect(sites()[0].label).toContain('walk here to investigate');
    expect(sites()[0].cls).not.toContain('is-explored');
    expect(sites()[0].art).toContain('map-marker');
    expect(sites()[0].art).toContain('<image');
    s.mapJournal!.claimedSites.push(site.id);
    expect(sites()[0].cls).toContain('is-explored');
    expect(sites()[0].label).toContain('explored');
    s.mapJournal!.claimedSites = [];
    s.fieldwork.camp = { cell: { ...site, sub: null, wild: null }, zone: s.zone } as GameState['fieldwork']['camp'];
    expect(sites()).toHaveLength(0);
  });
  it('shows the Camp occupied, working and cooking only when the state says so', () => {
    const s = newGame(), camp = { q: 3, r: 3 }, cells = [cellOf(camp)];
    expect(at(adventureView(s, cells), 'map-field-camp')).toHaveLength(0);
    s.fieldwork.camp = { cell: { ...camp, sub: null, wild: null }, zone: s.zone } as GameState['fieldwork']['camp'];
    const away = at(adventureView(s, cells), 'map-field-camp')[0];
    expect(away.cls).toBe('map-field-camp');
    expect(away.art).not.toContain('data-marker-glyph="fire"');
    stand(s, camp);
    const home = at(adventureView(s, cells), 'map-field-camp')[0];
    expect(home.cls).toBe('map-field-camp is-occupied');
    expect(home.art).toContain('data-marker-glyph="fire"');
    s.fieldwork.action = { kind: 'mine', nextAt: 0 } as GameState['fieldwork']['action'];
    const mining = at(adventureView(s, cells), 'map-field-camp')[0];
    expect(mining.cls).toBe('map-field-camp is-occupied is-working');
    expect(mining.label).toBe('Field Camp · Mining');
    expect(mining.art).toContain('data-marker-glyph="mine"');
    s.fieldwork.action = null;
    s.mapJournal!.lastEvent = { q: camp.q, r: camp.r, text: 'Camp kitchen · Stew ×1', atSec: s.clockSec, activity: 'cook' };
    const cooked = at(adventureView(s, cells), 'map-field-camp')[0];
    expect(cooked.label).toBe('Field Camp · Cooking');
    expect(cooked.art).toContain('data-marker-glyph="cook"');
    // The prop follows the event's own activity, never the wording of its log line.
    s.mapJournal!.lastEvent = { q: camp.q, r: camp.r, text: 'Camp kitchen · Stew ×1', atSec: s.clockSec };
    expect(at(adventureView(s, cells), 'map-field-camp')[0].label).toBe('Field Camp');
    s.mapJournal!.lastEvent = { q: camp.q, r: camp.r, text: 'Cooked', atSec: s.clockSec, activity: 'cook' };
    s.clockSec += MAP_EXPLORATION.event_display_sec + 1;
    expect(at(adventureView(s, cells), 'map-field-camp')[0].label).toBe('Field Camp');
  });
  it('keeps Patrol out of the map marker layer', () => {
    const s = newGame(), feet = currentCell(s);
    const stops = road.neighbours(feet).slice(0, 3).map((cell: { q: number; r: number }, subzone: number) =>
      ({ zone: s.zone, subzone, cell: { ...cell, sub: subzone, wild: null } }));
    s.patrol.stops = stops;
    const view = adventureView(s, stops.map((stop: { cell: { q: number; r: number } }) => cellOf(stop.cell)));
    expect(at(view, 'map-patrol-stop')).toHaveLength(0);
    expect(s.patrol.stops).toHaveLength(3);
  });
  it('draws a shelf marker and label for a Camp threat', () => {
    const s = newGame(), feet = currentCell(s);
    s.fieldwork.camp = { cell: { ...feet, sub: null, wild: null }, zone: s.zone } as any;
    s.fieldwork.campEncounters.active = {
      id: 1, kind: 'prowler', stage: 'combat', origin: feet, warningSec: 0, choiceSec: 0,
      payload: {}, preparedGroup: [{ speciesId: 'kobold' }], participantIds: [],
    } as any;
    const threat = at(adventureView(s, [cellOf(feet)]), 'map-camp-encounter')[0];
    expect(threat.art).toContain('map-marker');
    expect(threat.art).toContain('<image');
  });
  it('keeps a warning unidentified even when a hostile group has already been prepared', () => {
    const s = newGame(), feet = currentCell(s), cells = [cellOf(feet)];
    s.fieldwork.campEncounters.active = {
      id: 1, kind: 'sounds', stage: 'warning', origin: feet, warningSec: 5, choiceSec: 0,
      payload: { species: 'wolf' }, preparedGroup: [{ speciesId: 'wolf' }], participantIds: [],
    } as any;
    const warning = at(adventureView(s, cells), 'map-camp-encounter');
    s.fieldwork.campEncounters.active!.payload.species = 'kobold';
    s.fieldwork.campEncounters.active!.preparedGroup = [{ speciesId: 'kobold' }] as any;
    expect(at(adventureView(s, cells), 'map-camp-encounter')).toEqual(warning);
    expect(JSON.stringify(warning)).not.toMatch(/wolf|kobold/);
  });
  it('gives an active encounter the main marker while retaining the Camp and every coincident label', () => {
    const s = newGame(), feet = currentCell(s);
    s.fieldwork.camp = { cell: { ...feet, sub: null, wild: null }, zone: s.zone } as any;
    s.fieldwork.campEncounters.active = {
      id: 1, kind: 'prowler', stage: 'combat', origin: feet, warningSec: 0, choiceSec: 0,
      payload: {}, preparedGroup: [], participantIds: [],
    } as any;
    s.patrol.stops = [{ zone: s.zone, subzone: 0, cell: { ...feet, sub: 0, wild: null } }];
    s.town.tasks[0] = { ...s.town.tasks[0]!, kind: 'expedition', zone: s.zone, subzone: 0, progress: 1, n: 3, claimed: false };
    s.mapJournal!.lastEvent = { ...feet, text: 'Found wild berries along the trail', atSec: s.clockSec };
    const placements = adventureView(s, [cellOf(feet, { sub: true, zone: s.zone, subzone: 0 })]).placements;
    const before = structuredClone(placements), stacked = stackAdventurePlacements(placements);
    expect(stacked).toHaveLength(1);
    expect(stacked[0].cls).toContain('map-camp-encounter');
    for (const placement of placements) expect(stacked[0].label).toContain(placement.label);
    expect(stacked[0].art).not.toContain('map-marker-secondary');
    expect((stacked[0].art.match(/<image/g) || [])).toHaveLength(1);
    expect(stacked[0].art.match(/class="map-marker(?:\s|")/g)).toHaveLength(1);
    expect(stackAdventurePlacements([...placements].reverse())).toEqual(stacked);
    expect(placements).toEqual(before);
  });
  it('leaves unknown identities undisclosed', () => {
    const s = newGame(), feet = currentCell(s), far = { q: feet.q + MAP_EXPLORATION.reveal_radius + 4, r: feet.r };
    s.town.tasks[0] = { ...s.town.tasks[0]!, kind: 'expedition', zone: s.zone, subzone: 0, progress: 1, n: 3, claimed: false };
    const unknown = adventureView(s, [cellOf(far, { sub: true, zone: s.zone, subzone: 0, uniqueSpecies: 'wolf' })]);
    expect(unknown.marks[0].discovery).toBe('unknown');
    expect(unknown.marks[0].uniqueSpecies).toBeUndefined();
    expect(unknown.placements).toEqual([]);
  });
  it('keeps recent events in the journal without a map marker', () => {
    const s = newGame(), feet = currentCell(s), cells = [cellOf(feet)];
    s.mapJournal!.lastEvent = { q: feet.q, r: feet.r, text: 'Provision Caravan · Wild Grain ×2', atSec: s.clockSec };
    expect(at(adventureView(s, cells), 'map-recent-event')).toHaveLength(0);
    expect(s.mapJournal!.lastEvent.text).toBe('Provision Caravan · Wild Grain ×2');
  });
  it('decides the board from state alone, so a repaint cannot drift or spend randomness', () => {
    const s = newGame(), feet = currentCell(s);
    s.mapJournal!.lastEvent = { q: feet.q, r: feet.r, text: 'Arrived', atSec: s.clockSec };
    const cells = [cellOf(feet), ...road.neighbours(feet).map((n: { q: number; r: number }) => cellOf(n, { sub: true }))];
    const rng = s.rngState;
    expect(adventureView(s, cells)).toEqual(adventureView(s, cells));
    expect(s.rngState).toBe(rng);
  });
  it('keeps an unscouted block nameless in its own hover text', () => {
    expect(adventureTitle('Inner Sanctum · Saltmarrow · Lv 41–50', false, 'unknown')).toBe('Unexplored ground');
    expect(adventureTitle('Saltmarrow · Saltmarrow · Lv 41-50', true, 'unknown')).toBe('Saltmarrow · Saltmarrow');
    expect(adventureTitle('Open Grassland · Eastgate · Lv 1–10', false, 'scouted'))
      .toBe('Open Grassland · Eastgate · Lv 1–10');
    expect(adventureTitle('Eastgate · Eastgate', true, 'explored')).toBe('Eastgate · Eastgate');
  });
  it('matches each Camp activity to its own gear', () => {
    expect(campActivityArt('grove')).toContain('data-marker-glyph="grove"');
    expect(campActivityArt('fish')).toContain('data-marker-glyph="fish"');
    expect(campActivityArt(null)).toBe('');
  });
});
