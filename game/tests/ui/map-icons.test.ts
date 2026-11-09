import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { icon, mobSpeciesArt, characterIcon } from '../../src/icon';
import { newGame } from '@sim/core/game';
import { currentCell } from '@sim/world/road';
import { E } from '../../src/engine/client';
import { adventureView, type AdventureCell } from '../../src/ui/map/map-adventure';
import { hexContentMarkup } from '../../src/ui/map/render/map-content';
import type { MapCellIcon } from '../../src/ui/map/map-types';
import { layoutHexContent } from '../../src/ui/map/map-content-layout';

const markupFor = (name: string, level: string, icons: readonly MapCellIcon[]) =>
  hexContentMarkup(name, level, icons, layoutHexContent(15, icons.length));

const cell = (q: number, over: Partial<AdventureCell> = {}): AdventureCell =>
  ({ ax: `${q},0`, q, r: 0, town: null, sub: true, zone: 1, subzone: 0, ...over });

describe('in-hex game icons', () => {
  it('places only images in the shared rows, with no circular frames or separate tokens', () => {
    const icons: MapCellIcon[] = ['wolf', 'kobold', 'slime', 'human', 'skeleton'].map(id =>
      ({ href: mobSpeciesArt(id), label: id, role: 'mob', unique: id === 'wolf' }));
    const markup = markupFor('Windmill Meadow', 'Lv 2–8', icons);
    expect(markup.match(/<image /g)).toHaveLength(5);
    expect(markup).toContain('is-unique');
    expect(markup).toContain('hex-icon-unique');
    expect(markup).not.toContain('+1');
    expect(markup).not.toMatch(/<circle|<path|map-marker|glyph/);
    for (const match of markup.matchAll(/<image[^>]*x="([\d.-]+)"[^>]*y="([\d.-]+)"[^>]*width="([\d.]+)"[^>]*height="([\d.]+)"/g)) {
      const [, x, y, width, height] = match.map(Number);
      expect(x).toBeGreaterThanOrEqual(-13);
      expect(x + width).toBeLessThanOrEqual(13);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y + height).toBeLessThanOrEqual(10);
    }
    expect(markupFor('', '', [])).toBe('');
  });

  it('uses the same size rule for town, resource, player and creature icons', () => {
    for (const role of ['player', 'town', 'site', 'mob', 'signal'] as const) {
      const item = { href: icon('pickaxe'), label: role, role };
      const single = markupFor('', '', [item]);
      const crowded = markupFor('', '', [item, item]);
      const widths = [...(single + crowded).matchAll(/width="([\d.]+)"/g)].map(match => match[1]);
      expect(widths).toHaveLength(3);
      expect(new Set(widths).size).toBe(1);
    }
  });

  it('escapes resolved text and image attributes', () => {
    const markup = markupFor('<name>', '<level>', [{ href: '/icon.png?x="', label: '<label>', role: 'site' }]);
    expect(markup).toContain('&lt;name&gt;');
    expect(markup).toContain('&lt;label&gt;');
    expect(markup).toContain('&quot;');
  });

  it('keeps species undisclosed on unknown hexes and resolves known resources to game icons', () => {
    const state = newGame();
    const far = cell(99, { sub: false, site: 'mine' });
    expect(adventureView(state, [far]).placements).toEqual([]);
    state.mapJournal!.scouted.push(far.ax);
    expect(adventureView(state, [far]).placements[0].icon.href).toBe(icon('pickaxe'));
    const feet = currentCell(state);
    expect(adventureView(state, [{ ...cell(feet.q), ax: `${feet.q},${feet.r}`, r: feet.r }]).marks[0].roster.length).toBeGreaterThan(0);
  });

  it('resolves the actual species, player and site images from the existing PNG shelf', () => {
    const hrefs = [characterIcon(), '/map/landmark/town.png',
      ...E.mob.species.map(row => mobSpeciesArt(row.id)),
      ...['pickaxe', 'axe-in-stump', 'fishing-rod', 'dungeon-gate', 'rest-campfire'].map(name => icon(name, 'dread-skull'))];
    for (const href of hrefs) {
      expect(href).toMatch(/\.png$/);
      const file = href.startsWith('/map/') ? path.join('public', href.slice(1)) : href.replace(/^\//, '');
      expect(fs.existsSync(file), href).toBe(true);
      expect(fs.readFileSync(file).subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
    }
  });
});
