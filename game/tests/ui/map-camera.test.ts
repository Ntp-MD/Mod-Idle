import { describe, expect, it } from 'vitest';
import { clampMapPan, composeMapMatrix, transformMapPoint, type MapMatrix, type MapPoint } from '../../src/ui/map/map-camera';
import { MAP_CAMERA } from '../../src/ui/map/map-projection';

const apply = (matrix: MapMatrix, p: MapPoint) => ({
  x: matrix.a * p.x + matrix.c * p.y + matrix.e,
  y: matrix.b * p.x + matrix.d * p.y + matrix.f,
});

describe('north-up map camera', () => {
  it('composes viewport scale and translation through the shared affine math', () => {
    const frame = composeMapMatrix({ a: 2, b: 0, c: 0, d: 2, e: 120, f: -75 }, { ...MAP_CAMERA, e: 0, f: 0 });
    expect(transformMapPoint(frame, { x: 10, y: 20 })).toEqual({ x: 140, y: -35 });
    expect(frame.a).toBe(frame.d);
    expect(frame.b).toBe(0);
    expect(frame.c).toBe(0);
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

  it.each([0.5, 1, 2.4, 6])('clamps north-up coverage at zoom %s', zoom => {
    const paper = { x: -3000, y: -2000, width: 6000, height: 4000 };
    {
      const projection = { ...MAP_CAMERA, e: 960, f: 540 };
      for (const pan of [{ x: 1e6, y: -1e6 }, { x: -1e6, y: 1e6 }]) {
        const clamped = clampMapPan(pan, frame, paper, projection, zoom);
        const area = paperScreen(paper, clamped, zoom, projection);
        if (area.maxX - area.minX >= frame.width) {
          expect(area.minX).toBeLessThanOrEqual(1e-6);
          expect(area.maxX).toBeGreaterThanOrEqual(frame.width - 1e-6);
        } else expect((area.minX + area.maxX) / 2).toBeCloseTo(frame.width / 2, 6);
        if (area.maxY - area.minY >= frame.height) {
          expect(area.minY).toBeLessThanOrEqual(1e-6);
          expect(area.maxY).toBeGreaterThanOrEqual(frame.height - 1e-6);
        } else expect((area.minY + area.maxY) / 2).toBeCloseTo(frame.height / 2, 6);
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
