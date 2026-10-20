import { describe, expect, it } from 'vitest';
import { newGame } from '../src/sim/game';
import { currentCell, road } from '../src/sim/road';
import { E, eng, TOWN } from '../src/engine/client';
import { hexKey, MAP_EXPLORATION, trailSites } from '../src/sim/map-exploration';
import { adventureTitle, adventureView, campActivityArt, type AdventureCell } from '../src/ui/map-adventure';
import type { GameState } from '../src/sim/types';

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
    s.fieldwork.action = null; s.group = [{ species: 'wolf' } as never];
    expect(adventureView(s, [cellOf(feet)]).marks[0].activity).toBe('combat');
    s.group = [];
    expect(adventureView(s, [cellOf(feet)]).marks[0].activity).toBe('idle');
  });
  it('suggests tracks only on unknown named sides within a block of approaching', () => {
    const s = newGame(), feet = currentCell(s);
    const ring2 = { q: feet.q + 2, r: feet.r }, ring3 = { q: feet.q + 3, r: feet.r };
    const view = adventureView(s, [cellOf(ring2, { sub: true }), cellOf(ring3, { sub: true }), cellOf(ring2)]);
    expect(at(view, 'map-wild-hint')).toHaveLength(1);
    expect(at(view, 'map-wild-hint')[0].ax).toBe(hexKey(ring2));
    s.mapJournal!.scouted.push(hexKey(ring2));
    expect(at(adventureView(s, [cellOf(ring2, { sub: true })]), 'map-wild-hint')).toHaveLength(0);
  });
  it('grows a settlement from a flag to a lamp to a guild sign as Standing rises', () => {
    const s = newGame(), town = road.nodeById(s.town.visited[0]) ?? currentCell(s);
    const id = s.town.visited[0], cells = [cellOf(town, { town: id })];
    killToTier(s, 0);
    expect(at(adventureView(s, cells), 'map-town-life')).toHaveLength(0);
    killToTier(s, 1);
    const one = at(adventureView(s, cells), 'map-town-life');
    expect(one).toHaveLength(1);
    expect(one[0].label).toBe('Standing I');
    expect(one[0].art).toContain('map-town-banner');
    expect(one[0].art).not.toContain('map-town-lamp');
    killToTier(s, 2);
    expect(at(adventureView(s, cells), 'map-town-life')[0].art).toContain('map-town-lamp');
    killToTier(s, 3);
    const three = at(adventureView(s, cells), 'map-town-life')[0];
    expect(three.art).toContain('map-town-guild');
    expect(three.label).toBe('Standing III');
    expect(at(adventureView(s, cells.map(c => ({ ...c, town: 'never-visited' }))), 'map-town-life')).toHaveLength(0);
  });
  it('hides a trail site until it is known, dims it once claimed, and yields to a Camp', () => {
    const s = newGame(), site = trailSites.find(row => row.kind === 'abandoned-camp')!;
    const key = hexKey(site), cells = [cellOf(site)];
    const sites = () => at(adventureView(s, cells), 'map-trail-site');
    expect(sites()).toHaveLength(0);
    s.mapJournal!.scouted.push(key);
    expect(sites()[0].label).toContain('walk here to investigate');
    expect(sites()[0].cls).not.toContain('is-explored');
    expect(sites()[0].art).toContain('camp.png');
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
    expect(away.art).not.toContain('map-camp-fire');
    stand(s, camp);
    const home = at(adventureView(s, cells), 'map-field-camp')[0];
    expect(home.cls).toBe('map-field-camp is-occupied');
    expect(home.art).toContain('map-camp-fire');
    s.fieldwork.action = { kind: 'mine', nextAt: 0 } as GameState['fieldwork']['action'];
    const mining = at(adventureView(s, cells), 'map-field-camp')[0];
    expect(mining.cls).toBe('map-field-camp is-occupied is-working');
    expect(mining.label).toBe('Field Camp · Mining');
    expect(at(adventureView(s, cells), 'map-mine-glow')).toHaveLength(1);
    s.fieldwork.action = null;
    s.mapJournal!.lastEvent = { q: camp.q, r: camp.r, text: 'Camp kitchen · Stew ×1', atSec: s.clockSec, activity: 'cook' };
    const cooked = at(adventureView(s, cells), 'map-field-camp')[0];
    expect(cooked.label).toBe('Field Camp · Cooking');
    expect(cooked.art).toContain('map-pot-steam');
    // The prop follows the event's own activity, never the wording of its log line.
    s.mapJournal!.lastEvent = { q: camp.q, r: camp.r, text: 'Camp kitchen · Stew ×1', atSec: s.clockSec };
    expect(at(adventureView(s, cells), 'map-field-camp')[0].label).toBe('Field Camp');
    s.mapJournal!.lastEvent = { q: camp.q, r: camp.r, text: 'Cooked', atSec: s.clockSec, activity: 'cook' };
    s.clockSec += MAP_EXPLORATION.event_display_sec + 1;
    expect(at(adventureView(s, cells), 'map-field-camp')[0].label).toBe('Field Camp');
  });
  it('numbers the Patrol route and lights only the stop being worked', () => {
    const s = newGame(), feet = currentCell(s);
    const stops = road.neighbours(feet).slice(0, 3).map((cell: { q: number; r: number }, subzone: number) =>
      ({ zone: s.zone, subzone, cell: { ...cell, sub: subzone, wild: null } }));
    s.patrol.stops = stops;
    const idle = at(adventureView(s, stops.map((stop: { cell: { q: number; r: number } }) => cellOf(stop.cell))), 'map-patrol-stop');
    expect(idle.map(p => p.cls)).toEqual(['map-patrol-stop', 'map-patrol-stop', 'map-patrol-stop']);
    expect(idle.map(p => p.label)).toEqual(['Patrol stop 1', 'Patrol stop 2', 'Patrol stop 3']);
    s.patrol.active = true; s.patrol.index = 1; s.patrol.groupsCleared = 2;
    const run = at(adventureView(s, stops.map((stop: { cell: { q: number; r: number } }) => cellOf(stop.cell))), 'map-patrol-stop');
    expect(run[1].cls).toBe('map-patrol-stop is-active');
    expect(run[1].label).toBe(`Patrol stop 2 · 2/${E.road.patrol.groups_per_stop} groups`);
    expect(run[1].art).toContain(`width="${12 * 2 / 3}"`);
    expect(run[0].cls).toBe('map-patrol-stop');
  });
  it('floats a marker over a recent event and lets it expire', () => {
    const s = newGame(), feet = currentCell(s), cells = [cellOf(feet)];
    s.mapJournal!.lastEvent = { q: feet.q, r: feet.r, text: 'Provision Caravan · Wild Grain ×2', atSec: s.clockSec };
    expect(at(adventureView(s, cells), 'map-recent-event')[0].label).toBe('Provision Caravan · Wild Grain ×2');
    s.clockSec += MAP_EXPLORATION.event_display_sec + 1;
    expect(at(adventureView(s, cells), 'map-recent-event')).toHaveLength(0);
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
    expect(campActivityArt('grove')).toContain('map-axe');
    expect(campActivityArt('fish')).toContain('map-fishing-rod');
    expect(campActivityArt(null)).toBe('');
  });
});
