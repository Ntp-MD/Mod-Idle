import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TERRAIN_ART, TERRAIN_VARIANTS } from '../src/ui/map-terrain';

const publicDir = fileURLToPath(new URL('../public', import.meta.url));
const footprints = JSON.parse(readFileSync(fileURLToPath(new URL('../src/ui/map-terrain-footprints.json', import.meta.url)), 'utf8'));

describe('modular terrain art', () => {
  it('gives every terrain exactly one piece of art', () => {
    for (const [terrain, art] of Object.entries(TERRAIN_ART)) {
      // a terrain's art lives in one of the two public folders: `terrain/` holds the ground a hex
      // stands on and `landmark/` the settlements, ruins and camps, one file at a time
      expect(art, terrain).toMatch(/^\/map\/(terrain|landmark)\/.+\.png$/);
      expect(existsSync(resolve(publicDir, art.slice(1))), `${terrain} should have art`).toBe(true);
    }
  });
  it('gives different biomes their own artwork', () => {
    expect(TERRAIN_ART.snow).not.toBe(TERRAIN_ART.rock);
    expect(TERRAIN_ART.marsh).not.toBe(TERRAIN_ART.forest);
    expect(TERRAIN_ART.salt).not.toBe(TERRAIN_ART.waste);
  });
  it('shares forest relief with wild cells while dungeons keep their own ruin', () => {
    expect(TERRAIN_ART.wild).toBe(TERRAIN_ART.forest);
    expect(TERRAIN_ART.dungeon).not.toBe(TERRAIN_ART.ash);
  });
  it('registers every variant tile before the map may place it', () => {
    for (const [terrain, variants] of Object.entries(TERRAIN_VARIANTS)) {
      expect(variants.length, terrain).toBeGreaterThan(0);
      for (const variant of variants) {
        expect(variant, terrain).toMatch(/^\/map\/(terrain|landmark)\/.+\.png$/);
        expect(existsSync(resolve(publicDir, variant.slice(1))), `${variant} should exist`).toBe(true);
        expect(variant in footprints, `${variant} needs a measured footprint`).toBe(true);
      }
    }
  });
  it('keeps a biome own art out of its variant list', () => {
    for (const [terrain, variants] of Object.entries(TERRAIN_VARIANTS)) {
      expect(variants, terrain).not.toContain(TERRAIN_ART[terrain]);
    }
  });
});
