import { describe, expect, it } from 'vitest';
import { clampMapPan, composeMapMatrix, mapBearingDegrees, mapScreenLabelMatrix, mapTurnTo, orbitMapPan, type MapMatrix, type MapPoint } from '../src/ui/map/map-camera';
import { createMapProjection, MAP_CAMERA } from '../src/ui/map/map-projection';

const apply = (matrix: MapMatrix, p: MapPoint) => ({
  x: matrix.a * p.x + matrix.c * p.y + matrix.e,
  y: matrix.b * p.x + matrix.d * p.y + matrix.f,
});

describe('rotatable map camera', () => {
  it('crosses north continuously and resets along the shorter turn', () => {
    expect(mapBearingDegrees(-15)).toBe(345);
    expect(mapBearingDegrees(735)).toBe(15);
    expect(mapTurnTo(359, 1)).toBe(2);
    expect(mapTurnTo(1, 359)).toBe(-2);
    expect(mapTurnTo(735, 0)).toBe(-15);
    expect(mapTurnTo(-735, 0)).toBe(15);
  });

  it.each([15, 90, 180, 270, 360, -450])('keeps the point under the camera origin fixed through a %s degree turn', turn => {
    const zoom = 2.5, origin = { x: 960, y: 496.8 }, pan = { x: 120, y: 0 };
    const viewport = { a: 1.4, b: 0, c: 0, d: 1.4, e: 960, f: 540 };
    const previous = composeMapMatrix(viewport, { ...createMapProjection(31, 38), e: 0, f: 0 });
    for (const elevation of [25, 38, 70]) {
      const next = composeMapMatrix(viewport, { ...createMapProjection(31 + turn, elevation), e: 0, f: 0 });
      const moved = orbitMapPan(pan, origin, zoom, previous, next);
      const anchor = mapScreenLabelMatrix(previous, { x: origin.x - pan.x / zoom, y: origin.y });
      const position = apply(next, { x: anchor.e, y: anchor.f });
      expect(moved.x + zoom * (position.x - origin.x)).toBeCloseTo(0, 8);
      expect(moved.y).toBe(0);
    }
  });

  it.each([0, 45, 90, 180, 270, 359])('keeps label text in screen pixels at bearing %s', bearing => {
    const angle = bearing * Math.PI / 180, scale = 3.2;
    const matrix = { a: scale * Math.cos(angle), b: scale * Math.sin(angle),
      c: -scale * Math.sin(angle), d: scale * Math.cos(angle), e: -418, f: 239 };
    const label = mapScreenLabelMatrix(matrix, { x: 700, y: 320 });
    for (const point of [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 0, y: 18 }]) {
      const screen = apply(matrix, apply(label, point));
      expect(screen.x).toBeCloseTo(700 + point.x, 8);
      expect(screen.y).toBeCloseTo(320 + point.y, 8);
    }
  });

  const frame = { width: 1920, height: 1080 };
  const paper = { x: -10000, y: -10000, width: 20000, height: 20000 };
  const projection = { ...MAP_CAMERA, e: 960, f: 540 };
  const paperPoint = (screen: MapPoint, pan: MapPoint, zoom: number, projection: MapMatrix) => {
    const x = (screen.x - frame.width / 2 - pan.x) / zoom + frame.width / 2 - projection.e;
    const y = (screen.y - frame.height * .46 - pan.y) / zoom + frame.height * .46 - projection.f;
    const det = projection.a * projection.d - projection.b * projection.c;
    return { x: (projection.d * x - projection.c * y) / det, y: (-projection.b * x + projection.a * y) / det };
  };

  it.each([0, 30, 90, 135, 180, 225, 270, 359])('clamps horizontal coverage at %s degrees without vertical pan', bearing => {
    for (const [zoom, elevation] of [[.5, 25], [1, 38], [3, 55], [6, 70]]) {
      const projection = { ...createMapProjection(bearing, elevation), e: 960, f: 540 };
      for (const pan of [{ x: 1e6, y: -1e6 }, { x: -1e6, y: 1e6 }]) {
        const clamped = clampMapPan(pan, frame, paper, projection, zoom);
        for (const screen of [{ x: -960, y: -540 }, { x: 2880, y: -540 }, { x: 2880, y: 1620 }, { x: -960, y: 1620 }]) {
          const point = paperPoint(screen, clamped, zoom, projection);
          expect(point.x).toBeGreaterThanOrEqual(paper.x - 1e-6);
          expect(point.x).toBeLessThanOrEqual(paper.x + paper.width + 1e-6);
        }
        expect(clamped.y).toBe(0);
      }
    }
  });

  it('leaves a pan alone while the entire viewport fits inside the paper', () => {
    const pan = { x: 120, y: -75 };
    expect(clampMapPan(pan, frame, paper, projection, 3)).toEqual({ x: pan.x, y: 0 });
  });

  it('always locks vertical pan even when asked to clamp a vertically displaced view', () => {
    expect(clampMapPan({ x: 120, y: -900 }, frame, paper, projection, 3).y).toBe(0);
  });
});
