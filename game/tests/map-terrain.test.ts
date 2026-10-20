import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TERRAIN_ART } from '../src/ui/map-terrain';

const publicDir = fileURLToPath(new URL('../public', import.meta.url));

describe('modular terrain art', () => {
  it('gives every terrain exactly one piece of art', () => {
    for (const [terrain, art] of Object.entries(TERRAIN_ART)) {
      // a terrain's art lives in one of the two diorama folders: `terrain/` holds the sliced sheets and
      // `terrain-hex/` the full-hex pieces a type is replaced with, one file at a time
      expect(art, terrain).toMatch(/^\/map\/diorama\/terrain(-hex)?\/.+\.png$/);
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
});
