import { describe, expect, it } from 'vitest';
import { TERRAIN_ART, TERRAIN_COMPOSITIONS, terrainComposition, terrainVariant } from '../src/ui/map-terrain';

describe('modular terrain art', () => {
  it('selects stable variants for positive and negative map coordinates', () => {
    for (const terrain of Object.keys(TERRAIN_ART)) for (const [q, r] of [[0, 0], [-8, 3], [7, -10]]) {
      const variant = terrainVariant(terrain, q, r);
      expect(terrainVariant(terrain, q, r)).toBe(variant);
      expect(TERRAIN_COMPOSITIONS[variant]).toBeDefined();
    }
  });
  it('uses distinct compositions rather than rotating the same scene', () => {
    expect(terrainComposition(0)).not.toEqual(terrainComposition(1));
    expect(terrainComposition(1)).not.toEqual(terrainComposition(3));
    expect(terrainComposition(3)).not.toEqual(terrainComposition(4));
  });
  it('leaves a clear center and small foreground props in encounter dioramas', () => {
    for (const [variant] of TERRAIN_COMPOSITIONS.entries()) {
      for (const prop of terrainComposition(variant, true)) {
        if (prop.front) { expect(prop.width).toBeLessThanOrEqual(13); expect(prop.y).toBe(13); }
        else { expect(Math.abs(prop.x)).toBeGreaterThanOrEqual(14); expect(prop.y).toBeLessThanOrEqual(0); }
      }
    }
  });
  it('returns independent layout objects so a scene cannot mutate later scenes', () => {
    const copy = terrainComposition(0);
    copy[0].x = 100;
    expect(terrainComposition(0)[0].x).not.toBe(100);
  });
  it('gives different biomes their own artwork', () => {
    expect(TERRAIN_ART.snow.prop).not.toBe(TERRAIN_ART.rock.prop);
    expect(TERRAIN_ART.marsh.prop).not.toBe(TERRAIN_ART.forest.prop);
    expect(TERRAIN_ART.salt.prop).not.toBe(TERRAIN_ART.waste.prop);
  });
});
