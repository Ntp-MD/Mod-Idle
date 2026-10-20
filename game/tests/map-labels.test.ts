import { describe, expect, it } from 'vitest';
import { lowerLeftEdge, mapLevelBand, mapNameLines, mapSlantDeg, placeMapNames, type MapNameBox } from '../src/ui/map-labels';
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
  it('reads the lower-left edge off real hex points, leaning gently with an inward normal', () => {
    // Real sheet order (hexPts): upper-right → right → lower-right → lower-left → upper-left → top.
    const pts = [-30, 30, 90, 150, 210, 270].map(deg => {
      const a = deg * Math.PI / 180;
      return { x: 10 * Math.cos(a), y: 10 * Math.sin(a) };
    });
    const edge = lowerLeftEdge(pts, (x, y) => ({ x, y }));
    // Bottom → lower-left runs up-right on screen: folds to a gentle +30° reading lean.
    expect(edge.angleDeg).toBeCloseTo(30, 0);
    expect(edge.mx).toBeCloseTo(-4.33, 0);
    expect(edge.my).toBeCloseTo(7.5, 0); // below centre: the lower edge
    // Inward normal points back toward the hex centre from the edge midpoint.
    expect(edge.mx + edge.nx * 5).toBeCloseTo(edge.mx * 0.5, 0);
    expect(edge.my + edge.ny * 5).toBeLessThan(edge.my);
    expect(mapSlantDeg()).toBeGreaterThan(0); // same edge family through the camera
    expect(mapSlantDeg()).toBeLessThan(30);
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
