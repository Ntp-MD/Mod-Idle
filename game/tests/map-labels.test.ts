import { describe, expect, it } from 'vitest';
import { mapLevelBand, mapNameLines, mapNamePointer, mapNamePosition, placeMapNames, type MapNameBox } from '../src/ui/map-labels';
import { mapTravelPhase } from '../src/ui/map-travel';

const box = (key: string, priority = 0, forced = false): MapNameBox =>
  ({ key, left: 10, top: 10, width: 120, height: 40, priority, forced });
describe('map names', () => {
  it('preserves complete long names over two balanced lines', () => {
    const name = 'Blackwater Reach Rare Grove';
    const lines = mapNameLines(name);
    expect(lines).toHaveLength(2);
    expect(lines.join(' ')).toBe(name);
    expect(mapNameLines('Eastgate')).toEqual(['Eastgate']);
  });
  it('hides level bands until a block has been scouted', () => {
    expect(mapLevelBand('unknown', '51', '60')).toBe('');
    expect(mapLevelBand('scouted', '51', '60')).toBe('Lv 51–60');
    expect(mapLevelBand('explored', null, null)).toBe('');
  });
  it('keeps the important name when ordinary labels collide', () => {
    expect(placeMapNames([box('ordinary'), box('selected', 3, true)]).map(b => b.key)).toEqual(['selected']);
  });
  it('keeps both hovered and selected names readable without overlap', () => {
    const source = [box('selected', 3, true), box('hovered', 4, true)];
    const result = placeMapNames(source);
    expect(result.map(b => b.key)).toEqual(['hovered', 'selected']);
    expect(result[1].top).toBeGreaterThan(result[0].top + result[0].height);
    expect(source[0].top).toBe(10);
  });
  it('keeps labels that already have independent space', () => {
    expect(placeMapNames([box('left'), { ...box('right'), left: 180 }])).toHaveLength(2);
  });
  it('flips a pin label below the anchor near the top edge and clamps it horizontally', () => {
    const frame = { left: 0, top: 0, right: 400, bottom: 300 };
    expect(mapNamePosition({ x: 12, y: 20 }, 120, 44, frame)).toEqual({ left: 8, top: 48 });
    expect(mapNamePosition({ x: 388, y: 220 }, 120, 44, frame)).toEqual({ left: 272, top: 148 });
  });
  it('keeps the stem on the actual hex after its nameplate moves to avoid a collision', () => {
    const anchor = { x: 200, y: 220 };
    for (const plate of [{ left: 140, top: 140, width: 120, height: 44 }, { left: 180, top: 248, width: 120, height: 44 }]) {
      const pin = mapNamePointer(plate, anchor);
      expect(plate.left + pin.x).toBe(anchor.x);
      expect(plate.top + pin.y).toBe(anchor.y);
      expect(pin.stem.endsWith('L' + pin.x + ' ' + pin.y)).toBe(true);
      expect(pin.triangle).not.toContain('NaN');
    }
  });
  it('places important names on a free row inside the viewport', () => {
    const source = [{ ...box('selected', 3, true), top: 60, height: 30 },
      { ...box('hovered', 4, true), top: 60, height: 30 }];
    const result = placeMapNames(source, { top: 0, bottom: 140 });
    expect(result).toHaveLength(2);
    expect(result[0].top).toBe(60);
    expect(result[1].top + result[1].height).toBeLessThan(result[0].top);
    expect(result[1].top).toBeGreaterThanOrEqual(8);
  });
});
describe('board travel presentation', () => {
  it('stays on the board while walking and requests combat even for an en-route ambush', () => {
    expect(mapTravelPhase(true, true, false)).toBe('travel');
    expect(mapTravelPhase(true, true, true)).toBe('combat');
    expect(mapTravelPhase(true, false, true)).toBe('combat');
  });
  it('finishes safe arrivals and leaves manual map browsing alone', () => {
    expect(mapTravelPhase(true, false, false)).toBe('arrived');
    expect(mapTravelPhase(false, false, true)).toBe('idle');
  });
});
