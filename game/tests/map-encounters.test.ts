import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { E, eng } from '../src/engine/client';
import { nearbyMapEncounters, type MapEncounterSite } from '../src/ui/map-encounters';
import { mapSpeciesArt } from '../src/ui/map-species-art';

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
  it('resolves map diorama art for every species present in a zone', () => {
    const publicDir = fileURLToPath(new URL('../public/', import.meta.url));
    expect(existsSync(resolve(publicDir, 'map/landmark/mob-stage.png'))).toBe(true);
    const species = new Set(E.mob.zones.flatMap((zone: any) => eng.speciesInZone(zone.id)));
    for (const id of species) {
      const art = mapSpeciesArt(id);
      expect(art, `${id} should have tabletop art`).toBeDefined();
      expect(existsSync(resolve(publicDir, art!.replace(/^\//, ''))), `${id} art file should exist`).toBe(true);
    }
  });
});
