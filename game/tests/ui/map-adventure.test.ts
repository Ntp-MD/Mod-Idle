import { describe, expect, it } from 'vitest';
import { newGame } from '@sim/core/game';
import { currentCell, road } from '@sim/world/road';
import { hexKey, MAP_EXPLORATION } from '@sim/world/map-exploration';
import { adventureTitle, adventureView, stackAdventurePlacements, type AdventureCell } from '../../src/ui/map/map-adventure';
import type { GameState } from '@sim/core/types';
import { icon } from '../../src/icon';
import { mobFixture } from '../fixtures/mobFixture';

/**
 * The living board's rules, tested as rules: `adventureView` decides what stands on which block and
 * `paintMapAdventure` only carries that onto the sheet, so none of this needs a browser to prove.
 */
const cellOf = (h: { q: number; r: number }, over: Partial<AdventureCell> = {}): AdventureCell =>
  ({ ax: hexKey(h), q: h.q, r: h.r, town: null, sub: false, ...over });
const at = (view: ReturnType<typeof adventureView>, cls: string) => view.placements.filter(p => p.cls.startsWith(cls));
const stand = (s: GameState, h: { q: number; r: number }) => {
  s.cell = { ...h, sub: null, site: null }; s.walk = null; s.group = []; s.fieldwork.action = null;
};

describe('adventure board placements', () => {
  it('marks knowledge on every block and an activity only under the feet', () => {
    const s = newGame(), feet = currentCell(s), near = road.neighbours(feet)[0], far = { q: feet.q + 6, r: feet.r };
    s.fieldwork.action = { kind: 'mine', nextAt: 0 } as GameState['fieldwork']['action'];
    const view = adventureView(s, [cellOf(feet), cellOf(near), cellOf(far)]);
    expect(view.marks.map(mark => mark.discovery)).toEqual(['explored', 'scouted', 'unknown']);
    expect(view.marks.map(mark => mark.activity)).toEqual(['mine', 'idle', 'idle']);
    s.fieldwork.action = null; s.group = [mobFixture()];
    expect(adventureView(s, [cellOf(feet)]).marks[0].activity).toBe('combat');
    s.group = [];
    expect(adventureView(s, [cellOf(feet)]).marks[0].activity).toBe('idle');
    s.walk = { from: feet, to: near, fromZone: s.zone, journeyId: 1, origin: { ...feet },
      legs: [{ from: { ...feet }, to: near }], stepIndex: 0, secLeft: 1, lastEventStep: 0 };
    expect(adventureView(s, [cellOf(feet)]).marks[0].activity).toBe('travel');
    s.group = [mobFixture()];
    expect(adventureView(s, [cellOf(feet)]).marks[0].activity).toBe('combat');
  });
  it('leaves unknown distant ground unmarked after the tracks hint was removed', () => {
    const s = newGame(), feet = currentCell(s);
    const ring2 = { q: feet.q + 2, r: feet.r }, ring3 = { q: feet.q + 3, r: feet.r };
    const view = adventureView(s, [cellOf(ring2, { sub: true }), cellOf(ring3, { sub: true }), cellOf(ring2)]);
    expect(view.placements).toEqual([]);
    expect(view.marks.some(mark => mark.discovery === 'unknown')).toBe(true);
    s.mapJournal!.scouted.push(hexKey(ring2));
    expect(adventureView(s, [cellOf(ring2, { sub: true })]).placements).toEqual([]);
  });
  it('shares the territory figure for Unique clues without adding a second monster or revealing distant clues', () => {
    const s = newGame(), near = road.neighbours(currentCell(s))[0];
    const view = adventureView(s, [cellOf(near, { sub: true, uniqueSpecies: 'wolf' }),
      cellOf({ q: near.q + 6, r: near.r }, { sub: true, uniqueSpecies: 'wolf' })]);
    expect(view.marks[0].uniqueSpecies).toBe('wolf');
    expect(view.marks[1].uniqueSpecies).toBeUndefined();
    expect(at(view, 'map-unique-traces')).toHaveLength(0);
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
    expect(sites()[0].icon).toMatchObject({ kind: 'event', href: icon('rest-campfire') });
    s.mapJournal!.claimedSites.push(site.id);
    expect(sites()[0].cls).toContain('is-explored');
    expect(sites()[0].label).toContain('explored');
    s.mapJournal!.claimedSites = [];
    s.fieldwork.camp = { cell: { ...site, sub: null, site: null }, zone: s.zone } as GameState['fieldwork']['camp'];
    expect(sites()).toHaveLength(0);
  });
  it('shows the Camp occupied, working and cooking only when the state says so', () => {
    const s = newGame(), camp = { q: 3, r: 3 }, cells = [cellOf(camp)];
    expect(at(adventureView(s, cells), 'map-field-camp')).toHaveLength(0);
    s.fieldwork.camp = { cell: { ...camp, sub: null, site: null }, zone: s.zone } as GameState['fieldwork']['camp'];
    const away = at(adventureView(s, cells), 'map-field-camp')[0];
    expect(away.cls).toBe('map-field-camp');
    expect(away.icon.href).toBe(icon('rest-campfire'));
    stand(s, camp);
    const home = at(adventureView(s, cells), 'map-field-camp')[0];
    expect(home.cls).toBe('map-field-camp is-occupied');
    expect(home.icon.href).toBe(icon('rest-campfire'));
    s.fieldwork.action = { kind: 'mine', nextAt: 0 } as GameState['fieldwork']['action'];
    const mining = at(adventureView(s, cells), 'map-field-camp')[0];
    expect(mining.cls).toBe('map-field-camp is-occupied is-working');
    expect(mining.label).toBe('Field Camp · Mining');
    expect(mining.icon.href).toBe(icon('pickaxe'));
    s.fieldwork.action = null;
    s.mapJournal!.lastEvent = { q: camp.q, r: camp.r, text: 'Camp kitchen · Stew ×1', atSec: s.clockSec, activity: 'cook' };
    const cooked = at(adventureView(s, cells), 'map-field-camp')[0];
    expect(cooked.label).toBe('Field Camp · Cooking');
    expect(cooked.icon.href).toBe(icon('cooking-cauldron'));
    // The prop follows the event's own activity, never the wording of its log line.
    s.mapJournal!.lastEvent = { q: camp.q, r: camp.r, text: 'Camp kitchen · Stew ×1', atSec: s.clockSec };
    expect(at(adventureView(s, cells), 'map-field-camp')[0].label).toBe('Field Camp');
    s.mapJournal!.lastEvent = { q: camp.q, r: camp.r, text: 'Cooked', atSec: s.clockSec, activity: 'cook' };
    s.clockSec += MAP_EXPLORATION.event_display_sec + 1;
    expect(at(adventureView(s, cells), 'map-field-camp')[0].label).toBe('Field Camp');
  });
  it('draws a shelf marker and label for a Camp threat', () => {
    const s = newGame(), feet = currentCell(s);
    s.fieldwork.camp = { cell: { ...feet, sub: null, site: null }, zone: s.zone } as any;
    s.fieldwork.campEncounters.active = {
      id: 1, kind: 'prowler', stage: 'combat', origin: feet, warningSec: 0, choiceSec: 0,
      payload: {}, preparedGroup: [mobFixture()], participantIds: [],
    } as any;
    const threat = at(adventureView(s, [cellOf(feet)]), 'map-camp-encounter')[0];
    expect(threat.icon).toMatchObject({ kind: 'boss', href: icon('crossed-swords-1') });
  });
  it('keeps a warning unidentified even when a hostile group has already been prepared', () => {
    const s = newGame(), feet = currentCell(s), cells = [cellOf(feet)];
    s.fieldwork.campEncounters.active = {
      id: 1, kind: 'sounds', stage: 'warning', origin: feet, warningSec: 5, choiceSec: 0,
      payload: { species: 'fixture-secret-a' }, preparedGroup: [{ speciesId: 'fixture-secret-a' }], participantIds: [],
    } as any;
    const warning = at(adventureView(s, cells), 'map-camp-encounter');
    s.fieldwork.campEncounters.active!.payload.species = 'fixture-secret-b';
    s.fieldwork.campEncounters.active!.preparedGroup = [{ speciesId: 'fixture-secret-b' }] as any;
    expect(at(adventureView(s, cells), 'map-camp-encounter')).toEqual(warning);
    expect(JSON.stringify(warning)).not.toContain('fixture-secret');
  });
  it('gives an active encounter the main marker while retaining the Camp and every coincident label', () => {
    const s = newGame(), feet = currentCell(s);
    s.fieldwork.camp = { cell: { ...feet, sub: null, site: null }, zone: s.zone } as any;
    s.fieldwork.campEncounters.active = {
      id: 1, kind: 'prowler', stage: 'combat', origin: feet, warningSec: 0, choiceSec: 0,
      payload: {}, preparedGroup: [], participantIds: [],
    } as any;
    s.mapJournal!.lastEvent = { ...feet, text: 'Found wild berries along the trail', atSec: s.clockSec };
    const placements = adventureView(s, [cellOf(feet, { sub: true, zone: s.zone, subzone: 0 })]).placements;
    const before = structuredClone(placements), stacked = stackAdventurePlacements(placements);
    expect(stacked).toHaveLength(1);
    expect(stacked[0].cls).toContain('map-camp-encounter');
    for (const placement of placements) expect(stacked[0].label).toContain(placement.label);
    expect(stacked[0].icon).toMatchObject({ kind: 'boss', href: icon('crossed-swords-1') });
    expect(stackAdventurePlacements([...placements].reverse())).toEqual(stacked);
    expect(placements).toEqual(before);
  });
  it('leaves unknown identities undisclosed', () => {
    const s = newGame(), feet = currentCell(s), far = { q: feet.q + MAP_EXPLORATION.reveal_radius + 4, r: feet.r };
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
    expect(adventureTitle('Windmill Meadow · Eastgate · Lv 1–10', false, 'scouted'))
      .toBe('Windmill Meadow · Eastgate · Lv 1–10');
    expect(adventureTitle('Eastgate · Eastgate', true, 'explored')).toBe('Eastgate · Eastgate');
  });
  it('marks every wild-side activity with its own resource icon', () => {
    const s = newGame(), feet = currentCell(s), sides = road.neighbours(feet);
    const sites = ['mine', 'grove', 'fishing', 'dungeon'] as const;
    const view = adventureView(s, sites.map((site, i) => cellOf(i ? sides[i - 1] : feet, { site })));
    const resources = at(view, 'map-resource');
    expect(resources.map(p => p.label)).toEqual(['Mine', 'Grove', 'Fishing', 'Dungeon']);
    expect(resources.map(p => p.icon.href)).toEqual([icon('pickaxe'), icon('axe-in-stump'), icon('fishing-rod'), icon('dungeon-gate', 'dread-skull')]);
  });
});
