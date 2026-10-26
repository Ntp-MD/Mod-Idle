import { describe, expect, it } from 'vitest';
import { E, eng } from '../src/engine/client';
import { mobIcon } from '../src/icon';
import { nearbyMapEncounters, type MapEncounterSite } from '../src/ui/map/map-encounters';
import { mapSpeciesArt } from '../src/ui/map/map-species-art';

const site = (key: string, q: number, r: number, species = 'Kobold'): MapEncounterSite => ({ key, q, r, species });
describe('nearby map encounters', () => {
  it('shows the current hex and all six immediate neighbours, excluding hexes two blocks away', () => {
    const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
    const sites = [site('here', 0, 0), ...neighbours.map(([q, r], i) => site(`near-${i}`, q, r)),
      site('far-diagonal', 1, 1), site('far-east', 2, 0)];
    expect(nearbyMapEncounters(sites, { q: 0, r: 0 }).map(s => s.key)).toEqual(sites.slice(0, 7).map(s => s.key));
  });
  it('updates from the feet when moving away, without needing a selected cell', () => {
    const sites = [site('old', 0, 0), site('new', 3, 0)];
    expect(nearbyMapEncounters(sites, { q: 1, r: 0 }).map(s => s.key)).toEqual(['old']);
    expect(nearbyMapEncounters(sites, { q: 2, r: 0 }).map(s => s.key)).toEqual(['new']);
  });
  it('uses the live species only on the occupied hex, preserving nearby rosters', () => {
    const sites = [site('here', 0, 0), site('next', 1, 0)];
    expect(nearbyMapEncounters(sites, { q: 0, r: 0 }, 'Orc').map(s => s.species)).toEqual(['Orc', 'Kobold']);
    expect(sites.map(s => s.species)).toEqual(['Kobold', 'Kobold']);
  });
  it('uses the combat icon for every map species', () => {
    const species = new Set(E.mob.zones.flatMap((zone: any) => eng.speciesInZone(zone.id)));
    for (const id of species) {
      expect(mapSpeciesArt(id), `${id} should use the combat icon`).toBe(mobIcon(id));
    }
  });
});
