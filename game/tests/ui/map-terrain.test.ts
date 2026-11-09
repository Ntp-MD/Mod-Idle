import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TERRAIN_ART, TERRAIN_RELIEF, TERRAIN_VARIANTS } from '../../src/ui/map/map-terrain';
import { terrainGroundMaterials } from '../../src/presentation/ground-materials';

const publicDir = fileURLToPath(new URL('../../public', import.meta.url));
const footprints = JSON.parse(readFileSync(fileURLToPath(new URL('../../src/ui/map/data/map-terrain-footprints.json', import.meta.url)), 'utf8'));
const bounds = JSON.parse(readFileSync(fileURLToPath(new URL('../../src/ui/map/data/map-sprite-bounds.json', import.meta.url)), 'utf8'));

describe('modular terrain art', () => {
  it('gives every terrain a ground texture and a real file', () => {
    for (const [terrain, art] of Object.entries(TERRAIN_ART)) {
      expect(art, terrain).toMatch(/^\/map\/ground\/.+-floor\.webp$/);
      expect(existsSync(resolve(publicDir, art.slice(1))), `${terrain} should have ground art`).toBe(true);
      expect(art in footprints, `${terrain} ground must not have baked hex perspective`).toBe(false);
      expect(art, `${terrain} should share the field material`).toBe(terrainGroundMaterials[terrain].href);
    }
  });

  it('gives different biomes their own ground', () => {
    expect(TERRAIN_ART.forest).not.toBe(TERRAIN_ART.grass);
    expect(TERRAIN_ART.snow).not.toBe(TERRAIN_ART.rock);
    expect(TERRAIN_ART.marsh).not.toBe(TERRAIN_ART.forest);
    expect(TERRAIN_ART.salt).not.toBe(TERRAIN_ART.waste);
    expect(TERRAIN_ART.dungeon).not.toBe(TERRAIN_ART.ash);
    expect(TERRAIN_ART.dungeon).not.toBe(TERRAIN_ART.rock);
  });

  it('keeps upright relief as separate measured objects, never full-hex ground', () => {
    for (const [terrain, art] of Object.entries(TERRAIN_RELIEF)) {
      expect(art, terrain).toMatch(/^\/map\/landmark\/.+\.png$/);
      expect(existsSync(resolve(publicDir, art.slice(1))), `${terrain} relief should exist`).toBe(true);
      expect(art in bounds, `${terrain} relief needs measured painted bounds`).toBe(true);
      expect(art in footprints, `${terrain} relief must not be a full-hex ground`).toBe(false);
    }
    expect(TERRAIN_RELIEF.town).toBe('/map/landmark/town-relief-1.png');
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

  it('keeps terrain biomes flat: relief is landmarks only, never paint', () => {
    expect(TERRAIN_RELIEF.forest).toBeUndefined();
    expect(TERRAIN_RELIEF.rock).toBeUndefined();
    expect(Object.values(TERRAIN_RELIEF).every((href) => href.startsWith('/map/landmark/'))).toBe(true);
  });

  it('keeps a biome own art out of its variant list', () => {
    for (const [terrain, variants] of Object.entries(TERRAIN_VARIANTS)) {
      expect(variants, terrain).not.toContain(TERRAIN_ART[terrain]);
    }
  });
});
