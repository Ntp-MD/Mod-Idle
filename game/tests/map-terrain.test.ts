import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TERRAIN_ART, TERRAIN_VARIANTS } from '../src/ui/map/map-terrain';

const publicDir = fileURLToPath(new URL('../public', import.meta.url));
const footprints = JSON.parse(readFileSync(fileURLToPath(new URL('../src/ui/map/data/map-terrain-footprints.json', import.meta.url)), 'utf8'));
const bounds = JSON.parse(readFileSync(fileURLToPath(new URL('../src/ui/map/data/map-sprite-bounds.json', import.meta.url)), 'utf8'));

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
  it('anchors every alternate diorama by its painted bounds', () => {
    for (const [terrain, variants] of Object.entries(TERRAIN_VARIANTS)) {
      expect(variants.length, terrain).toBeGreaterThan(0);
      for (const variant of variants) {
        expect(variant, terrain).toMatch(/^\/map\/(terrain|landmark)\/.+\.png$/);
        expect(existsSync(resolve(publicDir, variant.slice(1))), `${variant} should exist`).toBe(true);
        expect(variant in bounds, `${variant} needs painted bounds`).toBe(true);
        expect(variant in footprints, `${variant} must be a separate diorama`).toBe(false);
      }
    }
  });
  it('selects upright dioramas rather than registered full-hex paintings for the active terrain', () => {
    for (const [terrain, art] of Object.entries(TERRAIN_ART)) {
      expect(art in bounds, terrain).toBe(true);
      expect(art in footprints, terrain).toBe(false);
    }
  });
  it('keeps a biome own art out of its variant list', () => {
    for (const [terrain, variants] of Object.entries(TERRAIN_VARIANTS)) {
      expect(variants, terrain).not.toContain(TERRAIN_ART[terrain]);
    }
  });
});
