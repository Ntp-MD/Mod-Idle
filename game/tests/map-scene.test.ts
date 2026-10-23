import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { TERRAIN_ART, TERRAIN_VARIANTS } from '../src/ui/map-terrain';

const bounds = JSON.parse(readFileSync(new URL('../src/ui/map-sprite-bounds.json', import.meta.url), 'utf8')) as Record<string, number[]>;
const footprints = JSON.parse(readFileSync(new URL('../src/ui/map-terrain-footprints.json', import.meta.url), 'utf8')) as Record<string, unknown>;

describe('upright map scenery', () => {
  it('uses existing separate scenery with measured painted bounds', () => {
    for (const [biome, art] of Object.entries(TERRAIN_ART)) {
      expect(existsSync(fileURLToPath(new URL('../public' + art, import.meta.url))), biome).toBe(true);
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

  it('keeps registered full-hex ground paintings out of the upright scenery shelf', () => {
    for (const [biome, art] of Object.entries(TERRAIN_ART)) expect(footprints[art], biome).toBeUndefined();
  });

  it('generates exactly one catalogue diorama for each ground cell without duplicate runtime overlays', () => {
    const svg = readFileSync(new URL('../src/icon/map/map-overlay.svg', import.meta.url), 'utf8');
    const cells = [...svg.matchAll(/class="cell [^"]+"/g)];
    const figures = [...svg.matchAll(/data-figure-ax="[^"]+"/g)];
    const images = [...svg.matchAll(/<image\b[^>]*href="([^"]+)"/g)];
    expect(figures.length).toBe(cells.length);
    expect(images.length).toBe(figures.length);
    const active = new Set([...Object.values(TERRAIN_ART), ...Object.values(TERRAIN_VARIANTS).flat()]);
    for (const image of images) expect(active.has(image[1]), image[1]).toBe(true);
    expect(svg).not.toContain('terrain-registration');
  });
});
