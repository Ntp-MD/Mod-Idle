import { describe, expect, it } from 'vitest';
import { clampMapPan, composeMapMatrix, mapBearingDegrees, mapScreenLabelMatrix, mapTurnTo, orbitMapPan, type MapMatrix, type MapPoint } from '../../src/ui/map/map-camera';
import { createMapProjection, MAP_CAMERA } from '../../src/ui/map/map-projection';

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
    const zoom = 2.5, origin = { x: 960, y: 496.8 }, pan = { x: 120, y: -75 };
    const viewport = { a: 1.4, b: 0, c: 0, d: 1.4, e: 960, f: 540 };
    const previous = composeMapMatrix(viewport, { ...createMapProjection(31, 38), e: 0, f: 0 });
    for (const elevation of [25, 38, 70]) {
      const next = composeMapMatrix(viewport, { ...createMapProjection(31 + turn, elevation), e: 0, f: 0 });
      const moved = orbitMapPan(pan, origin, zoom, previous, next);
      const anchor = mapScreenLabelMatrix(previous, { x: origin.x - pan.x / zoom, y: origin.y - pan.y / zoom });
      const position = apply(next, { x: anchor.e, y: anchor.f });
      expect(moved.x + zoom * (position.x - origin.x)).toBeCloseTo(0, 8);
      expect(moved.y + zoom * (position.y - origin.y)).toBeCloseTo(0, 8);
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
  const origin = { x: frame.width / 2, y: frame.height * .46 };
  const paperScreen = (paper: { x: number; y: number; width: number; height: number },
    pan: MapPoint, zoom: number, projection: MapMatrix) => {
    const corners = [
      { x: paper.x, y: paper.y }, { x: paper.x + paper.width, y: paper.y },
      { x: paper.x, y: paper.y + paper.height }, { x: paper.x + paper.width, y: paper.y + paper.height },
    ].map((p) => {
      const world = apply(projection, p);
      return { x: origin.x + pan.x + zoom * (world.x - origin.x), y: origin.y + pan.y + zoom * (world.y - origin.y) };
    });
    return {
      minX: Math.min(...corners.map((p) => p.x)), maxX: Math.max(...corners.map((p) => p.x)),
      minY: Math.min(...corners.map((p) => p.y)), maxY: Math.max(...corners.map((p) => p.y)),
    };
  };

  it.each([0, 30, 90, 135, 180, 225, 270, 359])('clamps two-axis coverage at %s degrees', bearing => {
    const paper = { x: -3000, y: -2000, width: 6000, height: 4000 };
    for (const [zoom, elevation] of [[.5, 25], [1, 38], [3, 55], [6, 70]]) {
      const projection = { ...createMapProjection(bearing, elevation), e: 960, f: 540 };
      for (const pan of [{ x: 1e6, y: -1e6 }, { x: -1e6, y: 1e6 }]) {
        const clamped = clampMapPan(pan, frame, paper, projection, zoom);
        const area = paperScreen(paper, clamped, zoom, projection);
        expect(area.minX).toBeLessThanOrEqual(1e-6);
        expect(area.maxX).toBeGreaterThanOrEqual(frame.width - 1e-6);
        expect(area.minY).toBeLessThanOrEqual(1e-6);
        expect(area.maxY).toBeGreaterThanOrEqual(frame.height - 1e-6);
      }
    }
  });

  it('leaves a pan alone while the paper still covers the whole frame', () => {
    const paper = { x: -3000, y: -2000, width: 6000, height: 4000 };
    const projection = { ...MAP_CAMERA, e: 960, f: 540 };
    const pan = { x: 120, y: -75 };
    expect(clampMapPan(pan, frame, paper, projection, 3)).toEqual(pan);
  });

  it('centres a paper smaller than the frame on both axes', () => {
    const paper = { x: 0, y: 0, width: 200, height: 100 };
    const projection = { ...MAP_CAMERA, e: 0, f: 0 };
    const area = paperScreen(paper, clampMapPan({ x: 9000, y: -4000 }, frame, paper, projection, 1), 1, projection);
    expect((area.minX + area.maxX) / 2).toBeCloseTo(frame.width / 2, 6);
    expect((area.minY + area.maxY) / 2).toBeCloseTo(frame.height / 2, 6);
  });
});
