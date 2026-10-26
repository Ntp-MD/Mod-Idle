import { describe, expect, it } from 'vitest';
import { E } from '../src/engine/client';
import { newGame } from '../src/sim/core/game';
import { adventureView, stackAdventurePlacements, type AdventureCell } from '../src/ui/map/map-adventure';
import { mapMarker, mapSpeciesGlyph, type MapMarkerGlyph, type MapMarkerKind } from '../src/ui/map/map-markers';
import { mobFixture } from './mobFixture';

const cell = (q: number, over: Partial<AdventureCell> = {}): AdventureCell =>
  ({ ax: q + ',0', q, r: 0, town: null, sub: true, zone: 1, subzone: 0, ...over });
const state = () => {
  const s = newGame();
  s.cell = { q: 0, r: 0, sub: null, wild: null };
  s.walk = null; s.group = [];
  return s;
};

describe('shelf map signals', () => {
  it('draws every signal family from shelf art with no external references', () => {
    const kinds: MapMarkerKind[] = ['mob', 'boss', 'event', 'unknown', 'camp', 'resource', 'player', 'patrol', 'objective', 'standing'];
    for (const kind of kinds) {
      const art = mapMarker(kind);
      expect(art).toContain('data-marker-kind="' + kind + '"');
      expect(art).toContain('map-marker-stem');
      expect(art).toContain('<image');
      expect(art).toMatch(/href="[^"]+"/);
      expect(art).not.toMatch(/https?:\/\//);
    }
    expect(mapMarker('mob', mapSpeciesGlyph('wolf', 'beast'))).toContain('<image');
  });

  it('maps every glyph to a shelf image', () => {
    const glyphs: MapMarkerGlyph[] = ['claw', 'fang', 'skull', 'tracks', 'flag', 'fire', 'mine', 'grove', 'fish',
      'food', 'cook', 'rest', 'caravan', 'heal', 'patrol', 'compass', 'expedition', 'sword', 'horns', 'wings',
      'insect', 'droplet', 'spark', 'sun'];
    for (const glyph of glyphs) {
      const art = mapMarker('mob', glyph);
      expect(art).toContain(`data-marker-glyph="${glyph}"`);
      expect(art).toContain('<image');
    }
  });

  it('escapes the text in optional count badges', () => {
    const art = mapMarker('event', 'flag', { badge: '<script>&"' });
    expect(art).toContain('&lt;script&gt;&amp;&quot;');
    expect(art).not.toContain('<script>');
  });

  it('hides peaceful territory and distant rosters from the marker layer', () => {
    const s = state();
    const view = adventureView(s, [cell(1), cell(5)]);
    expect(view.placements.filter(p => p.cls.startsWith('map-mob'))).toEqual([]);
    expect(view.placements.filter(p => p.ax === '5,0')).toEqual([]);
    s.mapJournal!.scouted.push('5,0');
    expect(adventureView(s, [cell(5)]).placements).toEqual([]);
  });

  it('marks a resource only when its hex is known', () => {
    const s = state(), mine = cell(5, { sub: false, wild: E.fieldwork.wild_site_index.mine });
    expect(adventureView(s, [mine]).placements).toEqual([]);
    s.mapJournal!.scouted.push(mine.ax);
    const resource = adventureView(s, [mine]).placements[0];
    expect(resource.marker).toMatchObject({ kind: 'resource', glyph: 'mine' });
    expect(resource.label).toBe('Mine');
  });

  it('uses the actual combat rank and retains other signals in one primary crest', () => {
    const s = state();
    s.group = [mobFixture({ species: 'Goblin', speciesId: 'goblin', kind: 'Boss', readsAs: 'large' })];
    s.fieldwork.camp = { cell: { q: 0, r: 0, sub: null, wild: null }, zone: 1 } as typeof s.fieldwork.camp;
    const view = adventureView(s, [cell(0)]), stack = stackAdventurePlacements(view.placements);
    expect(view.marks[0].threat).toBe('boss');
    expect(stack).toHaveLength(1);
    expect(stack[0].marker?.kind).toBe('boss');
    expect(stack[0].label).toContain('Goblin · in combat');
    expect(stack[0].label).toContain('Field Camp');
    expect(stack[0].art.match(/class="map-marker\s/g)).toHaveLength(1);
    expect(stack[0].art).not.toContain('map-marker-secondary');
    expect((stack[0].art.match(/<image/g) || [])).toHaveLength(1);
    expect(stack[0].marker?.badge).toBeUndefined();
  });
});
