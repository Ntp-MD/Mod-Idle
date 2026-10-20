import { describe, expect, it } from 'vitest';
import { newGame, tick } from '../src/sim/game';
import { currentCell, ownerOf, rankOf, road, startWalk, zoneOf } from '../src/sim/road';
import { exportJson, importJson, migrate } from '../src/state/save';
import { slotsAvailable } from '../src/sim/slots';
import { movePatrolStop } from '../src/sim/exploration';
import { establishCamp } from '../src/sim/fieldwork';
import { destinationIntel } from '../src/ui/map-intel';
import { destinationPrimary } from '../src/ui/destination';
import { campActivityArt, hasUniqueTrace, mapEventArt } from '../src/ui/map-adventure';
import { E, eng, TOWN } from '../src/engine/client';
import {
  hexKey, hexDistance, investigateTrailSite, mapKnowledge, normalizeMapJournal,
  recordMapDiscovery, trailSiteKind, trailSites, MAP_EXPLORATION,
} from '../src/sim/map-exploration';

const place = (s: ReturnType<typeof newGame>, h: { q: number; r: number }) => {
  s.cell = { ...h, sub: null, wild: null }; s.walk = null; s.zone = zoneOf(h)!;
  s.hunting = false; s.group = []; recordMapDiscovery(s);
};

describe('map journal and trail sites', () => {
  it('remembers explored blocks and nearby scouting without consuming RNG', () => {
    const s = newGame(), seed = s.rngState, feet = currentCell(s);
    const neighbour = road.neighbours(feet)[0];
    expect(mapKnowledge(s, feet)).toBe('explored');
    expect(mapKnowledge(s, neighbour)).toBe('scouted');
    const old = hexKey(feet);
    place(s, { q: feet.q + 5, r: feet.r });
    expect(s.mapJournal!.visited).toContain(old);
    expect(s.rngState).toBe(seed);
  });
  it('surveys crossed blocks online but does not explore a route while offline', () => {
    const s = newGame(), feet = currentCell(s), dest = { q: feet.q + 2, r: feet.r, sub: null, wild: null };
    expect(startWalk(s, dest).ok).toBe(true);
    const before = structuredClone(s.mapJournal);
    tick(s, {}, { online: false });
    expect(s.mapJournal).toEqual(before);
    tick(s, {}, { online: true });
    expect(s.mapJournal!.visited).toContain(hexKey(currentCell(s)));
    expect(s.mapJournal!.visited.length).toBeGreaterThan(before!.visited.length);
  });
  it('migrates a legacy save additively and preserves exploration and claims on round trip', () => {
    const s = newGame();
    delete s.mapJournal;
    const gold = s.counters.gold, foods = structuredClone(s.fieldwork.foods), rng = s.rngState;
    const loaded = migrate(s, 17);
    expect(loaded.counters.gold).toBe(gold);
    expect(loaded.fieldwork.foods).toEqual(foods);
    expect(loaded.rngState).toBe(rng);
    const site = trailSites.find(row => row.kind === 'provision-caravan')!;
    place(loaded, site);
    expect(investigateTrailSite(loaded, site.id).ok).toBe(true);
    const restored = importJson(exportJson(loaded));
    expect(restored.mapJournal!.visited).toEqual(loaded.mapJournal!.visited);
    expect(restored.mapJournal!.claimedSites).toContain(site.id);
    expect(investigateTrailSite(restored, site.id).ok).toBe(false);
    expect(restored.fieldwork.foods).toEqual(loaded.fieldwork.foods);
  });
  it('keeps a caravan available when the bundle does not fit, and pays only once', () => {
    const s = newGame(), site = trailSites.find(row => row.kind === 'provision-caravan')!;
    place(s, site);
    s.bag = Array(slotsAvailable(s)).fill({}) as typeof s.bag;
    expect(investigateTrailSite(s, site.id).ok).toBe(false);
    expect(s.mapJournal!.claimedSites).not.toContain(site.id);
    s.bag = [];
    const seed = s.rngState;
    expect(investigateTrailSite(s, site.id).ok).toBe(true);
    const foods = structuredClone(s.fieldwork.foods);
    expect(investigateTrailSite(s, site.id).ok).toBe(false);
    expect(s.fieldwork.foods).toEqual(foods);
    expect(s.rngState).toBe(seed);
  });
  it('rest restores the configured Hunger and tracking reveals its configured area', () => {
    const s = newGame(), camp = trailSites.find(row => row.kind === 'abandoned-camp')!;
    place(s, camp); s.fieldwork.hunger = 0;
    expect(investigateTrailSite(s, camp.id).ok).toBe(true);
    const kind = trailSiteKind(camp);
    expect(s.fieldwork.hunger).toBe('hunger_restore' in kind ? kind.hunger_restore : -1);
    const tracks = trailSites.find(row => row.kind === 'hunting-tracks')!;
    place(s, tracks);
    expect(investigateTrailSite(s, tracks.id).ok).toBe(true);
    expect(mapKnowledge(s, { q: tracks.q + MAP_EXPLORATION.tracks_radius, r: tracks.r })).toBe('scouted');
  });
  it('refuses remote, busy and duplicate claims and normalizes malformed journal records', () => {
    const s = newGame(), site = trailSites[0];
    expect(investigateTrailSite(s, site.id).ok).toBe(false);
    place(s, site); s.phase = 'camp';
    expect(investigateTrailSite(s, site.id).ok).toBe(false);
    s.mapJournal = { visited: ['bad', '0,0', '0,0'], scouted: [], claimedSites: ['made-up'] };
    normalizeMapJournal(s);
    expect(s.mapJournal.visited.filter(key => key === '0,0')).toHaveLength(1);
    expect(s.mapJournal.visited).not.toContain('bad');
    expect(s.mapJournal.claimedSites).toEqual([]);
  });
  it('places each authored site on its own accessible field block', () => {
    const seen = new Set<string>();
    for (const site of trailSites) {
      expect(rankOf(site)).toBeGreaterThan(1);
      expect(zoneOf(site)).toBeTruthy();
      expect(trailSiteKind(site)).toBeTruthy();
      expect(seen.has(hexKey(site))).toBe(false);
      seen.add(hexKey(site));
      // The name carries the region a site belongs to, so a data edit cannot quietly move one
      // into a neighbour's field and keep the label that tells the player where they are.
      const slug = ownerOf(site).id.replace(/^the_/, '').replace(/_/g, '-');
      expect(site.id.startsWith(`${slug}-trail`)).toBe(true);
    }
  });
  it('reorders an idle itinerary but cannot reorder an active Patrol', () => {
    const s = newGame(), home = currentCell(s);
    const neighbours = road.neighbours(home);
    s.patrol.stops = neighbours.slice(0, 2).map((cell: { q: number; r: number }, subzone: number) => ({ zone: s.zone, subzone, cell: { ...cell, sub: subzone, wild: null } }));
    const first = hexKey(s.patrol.stops[0].cell);
    expect(movePatrolStop(s, 1, -1)).toBe(true);
    expect(hexKey(s.patrol.stops[1].cell)).toBe(first);
    s.patrol.active = true;
    expect(movePatrolStop(s, 0, 1)).toBe(false);
  });
  it('pauses automation when establishing a safe Camp or investigating a site', () => {
    const s = newGame(), site = trailSites.find(row => row.kind === 'provision-caravan')!;
    place(s, site);
    s.patrol.active = true; s.autoReturn.phase = 'waiting';
    expect(establishCamp(s).ok).toBe(true);
    expect(s.patrol.active).toBe(false);
    expect(s.autoReturn.phase).toBe('idle');
    s.patrol.active = true; s.autoReturn.phase = 'waiting';
    expect(investigateTrailSite(s, site.id).ok).toBe(true);
    expect(s.patrol.active).toBe(false);
    expect(s.hunting).toBe(false);
    expect(s.autoReturn.phase).toBe('idle');
  });
  it('does not change combat, reward draws or food behavior when journal history changes', () => {
    const a = newGame(734), b = structuredClone(a);
    b.mapJournal!.visited.push('50,50'); b.mapJournal!.scouted.push('49,50');
    a.hunting = b.hunting = true;
    for (let i = 0; i < 8; i++) { tick(a); tick(b); }
    expect(a.rngState).toBe(b.rngState);
    expect(a.group).toEqual(b.group);
    expect(a.counters).toEqual(b.counters);
    expect(a.fieldwork).toEqual(b.fieldwork);
  });
  it('shows Expedition credit only at the matching named subzone and hides unknown intel', () => {
    const s = newGame(), h = road.neighbours(currentCell(s)).find((point: { q: number; r: number }) => zoneOf(point) === s.zone)!;
    const town = TOWN.settlements.find(row => row.zone === s.zone)!;
    const subzone = E.mob.zones.find(zone => zone.id === s.zone)!.subzones![0];
    s.town.tasks[0] = { kind: 'expedition', zone: s.zone, subzone: 0, targetSpecies: subzone.species![0], n: 3, progress: 0, stone: 'tier', count: 1, claimed: false, offeredAt: 0 };
    const mine = { ...h, key: 'mine', kind: 'wild' as const, label: 'Mine', wild: E.fieldwork.wild_site_index.mine, sub: null };
    expect(destinationIntel(s, mine, town.id, 1).objectives).toEqual([]);
    const hunt = { ...h, key: 'hunt', kind: 'sub' as const, label: subzone.name, wild: null, sub: 0 };
    expect(destinationIntel(s, hunt, town.id, 1).objectives).toHaveLength(1);
    const unknown = destinationIntel(s, { ...hunt, q: h.q + 20 }, town.id, 20);
    expect(unknown.known).toBe(false);
    expect(unknown.encounters).toEqual([]);
    expect(unknown.objectives).toEqual([]);
    expect(unknown.levelNote).toBe('Levels unknown until scouted');
  });
  it('shows tools that match the active Camp activity', () => {
    expect(campActivityArt('mine')).toContain('map-pickaxe');
    expect(campActivityArt('grove')).toContain('map-axe');
    expect(campActivityArt('fish')).toContain('map-fishing-rod');
    expect(campActivityArt('cook')).toContain('map-pot-steam');
    expect(campActivityArt(null)).toBe('');
  });
  it('marks actual Unique rosters and gives recent road events their own board art', () => {
    const ids = new Set(E.mob.zones.flatMap((zone: any) => eng.speciesInZone(zone.id)));
    const uniqueSpecies = [...ids].find(id => eng.uniquesOf(id).length > 0)!;
    expect(hasUniqueTrace([uniqueSpecies])).toBe(true);
    expect(hasUniqueTrace([])).toBe(false);
    expect(mapEventArt('Found wild berries along the trail')).toContain('map-event-food');
    expect(mapEventArt('A clear spring restores your strength · Hunger 20%')).toContain('map-event-spring');
    expect(mapEventArt('Abandoned Camp · Hunger 30%')).toContain('map-event-fire');
    expect(mapEventArt('Provision Caravan · Raw Game Meat ×2')).toContain('provision-caravan.png');
    expect(mapEventArt('Hunting Tracks · surveyed nearby')).toContain('map-tracks');
    expect(mapEventArt('Camp kitchen · Trail Stew ×1')).toContain('map-pot-steam');
  });
  it('refuses a trail-site reward during combat without erasing the current group', () => {
    const s = newGame(), site = trailSites.find(row => row.kind === 'provision-caravan')!;
    place(s, site);
    s.hunting = true;
    s.group = [{ species: 'wolf' } as any];
    const before = structuredClone(s.group);
    expect(investigateTrailSite(s, site.id)).toMatchObject({ ok: false, why: 'Finish the fight first.' });
    expect(s.group).toEqual(before);
    expect(s.mapJournal!.claimedSites).not.toContain(site.id);
  });
  it('uses the same primary action for investigating a reached site and keyboard Enter', () => {
    const s = newGame(), site = trailSites.find(row => row.kind === 'provision-caravan')!;
    place(s, site);
    const dest = { key: 'site', kind: 'bare' as const, label: 'Trail site', node: null, sub: null, wild: null, self: true, walking: false, here: true, blocks: 0, sec: 0 };
    expect(destinationPrimary(s, dest).kind).toBe('investigate');
    expect(destinationPrimary(s, dest, false).disabled).toBe(true);
    s.group = [{ species: 'wolf' } as any];
    expect(destinationPrimary(s, dest)).toMatchObject({ kind: 'investigate', disabled: true, reason: 'Finish the fight first.' });
    s.group = [];
    expect(investigateTrailSite(s, site.id).ok).toBe(true);
    expect(destinationPrimary(s, dest).kind).toBe('hunt');
  });
  it('states what an Investigate pauses, and keeps the Camp activity on the journal event', () => {
    const s = newGame(), site = trailSites.find(row => row.kind === 'hunting-tracks')!;
    place(s, site);
    const dest = { key: 'site', kind: 'bare' as const, label: 'Trail site', node: null, sub: null, wild: null, self: true, walking: false, here: true, blocks: 0, sec: 0 };
    s.patrol.active = true; s.hunting = true;
    expect(destinationPrimary(s, dest)).toMatchObject({ kind: 'investigate', disabled: false, warn: 'Claiming this site pauses Patrol and hunting.' });
    s.patrol.active = false; s.hunting = false;
    expect(destinationPrimary(s, dest).warn).toBe('');
    s.mapJournal!.lastEvent = { q: site.q, r: site.r, text: 'Camp kitchen · Stew ×1', atSec: s.clockSec, activity: 'cook' };
    const restored = importJson(exportJson(s));
    expect(restored.mapJournal!.lastEvent).toMatchObject({ activity: 'cook' });
    restored.mapJournal!.lastEvent = { ...restored.mapJournal!.lastEvent!, activity: 5 as unknown as string };
    normalizeMapJournal(restored);
    expect(restored.mapJournal!.lastEvent!.activity).toBeUndefined();
  });
});
