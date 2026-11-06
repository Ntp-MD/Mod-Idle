import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TERRAIN_ART, TERRAIN_RELIEF } from '../../src/ui/map/map-terrain';

const bounds = JSON.parse(readFileSync(new URL('../../src/ui/map/data/map-sprite-bounds.json', import.meta.url), 'utf8')) as Record<string, number[]>;
const footprints = JSON.parse(readFileSync(new URL('../../src/ui/map/data/map-terrain-footprints.json', import.meta.url), 'utf8')) as Record<string, unknown>;

describe('upright map scenery', () => {
  it('uses existing separate relief with measured painted bounds', () => {
    for (const [biome, art] of Object.entries(TERRAIN_RELIEF)) {
      expect(existsSync(fileURLToPath(new URL('../../public' + art, import.meta.url))), biome).toBe(true);
      const box = bounds[art];
      expect(box, biome).toBeDefined();
      const [width, height, left, top, paintedWidth, paintedHeight] = box;
      expect(left).toBeGreaterThanOrEqual(0);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(paintedWidth).toBeGreaterThan(0);
      expect(paintedHeight).toBeGreaterThan(0);
      expect(left + paintedWidth).toBeLessThanOrEqual(width);
      expect(top + paintedHeight).toBeLessThanOrEqual(height);
    }
  });

  it('keeps registered full-hex ground out of the upright relief shelf', () => {
    for (const [biome, art] of Object.entries(TERRAIN_RELIEF)) expect(footprints[art], biome).toBeUndefined();
  });

  it('generates one ground figure per cell and relief only for authored locations', () => {
    const svg = readFileSync(new URL('../../src/icon/map/map-overlay.svg', import.meta.url), 'utf8');
    const cells = [...svg.matchAll(/class="cell [^"]+"/g)];
    const figures = [...svg.matchAll(/class="diorama-figure [^"]*" data-figure-ax="[^"]+"/g)];
    expect(figures.length).toBe(cells.length);
    const ground = new Set(Object.values(TERRAIN_ART));
    for (const m of svg.matchAll(/data-art-href="([^"]+)"/g)) expect(ground.has(m[1]), m[1]).toBe(true);
    expect(svg).toContain('terrain-registration');
    const relief = new Set(Object.values(TERRAIN_RELIEF));
    const reliefImages = [...svg.matchAll(/<g class="terrain-relief terrain-on">(.*?)<\/g>/g)];
    expect(reliefImages.length).toBeGreaterThan(0);
    for (const m of reliefImages) {
      const href = /href="([^"]+)"/.exec(m[1])?.[1];
      expect(href, 'relief carries an image').toBeTruthy();
      expect(relief.has(href!), href!).toBe(true);
    }
    expect(svg).not.toContain('data-figure-ax=""');
  });
});
