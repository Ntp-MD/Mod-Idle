import { describe, expect, it } from 'vitest';
import { createMapProjection, MAP_CAMERA, mapUprightAt, projectedHex, projectMapBounds, projectMapPoint } from '../src/ui/map/map-projection';

describe('tabletop projection', () => {
  it.each([0, 45, 90, 180, 270, 360])('keeps artwork vertical while the ground orbits to %s degrees', bearing => {
    for (const elevation of [25, 38, 70]) {
      const camera = createMapProjection(bearing, elevation), x = 57, y = -84;
      const [a, b, c, d] = mapUprightAt(x, y, camera).match(/matrix\(([^)]+)\)/)![1].split(/\s+/).map(Number);
      const anchor = projectMapPoint(x, y, camera);
      const right = projectMapPoint(x + a, y + b, camera);
      const top = projectMapPoint(x - c * 30, y - d * 30, camera);
      expect(right.x - anchor.x).toBeCloseTo(1);
      expect(right.y - anchor.y).toBeCloseTo(0);
      expect(top.x - anchor.x).toBeCloseTo(0);
      expect(top.y - anchor.y).toBeCloseTo(-30);
    }
  });

  it('foreshortens the ground with elevation and reverses front/back depth on the opposite side', () => {
    const low = projectedHex(30, createMapProjection(0, 25));
    const high = projectedHex(30, createMapProjection(0, 70));
    expect(low.width).toBeCloseTo(high.width);
    expect(low.height).toBeLessThan(high.height);
    const front = { x: 0, y: 100 }, back = { x: 0, y: -100 };
    for (const bearing of [0, 180]) {
      const camera = createMapProjection(bearing);
      const delta = projectMapPoint(front.x, front.y, camera).y - projectMapPoint(back.x, back.y, camera).y;
      expect(Math.sign(delta)).toBe(bearing === 0 ? 1 : -1);
    }
  });

  it('places an upright landmark at its projected hex center without distorting its artwork', () => {
    const x = 57, y = -84;
    const values = mapUprightAt(x, y).match(/matrix\(([^)]+)\)/)![1].split(/\s+/).map(Number);
    const [a, b, c, d] = values;
    const anchor = projectMapPoint(x, y);
    const world = (dx: number, dy: number) => projectMapPoint(x + a * dx + c * dy, y + b * dx + d * dy);
    expect(world(0, 0)).toEqual(anchor);
    expect(world(1, 0).x - anchor.x).toBeCloseTo(1);
    expect(world(1, 0).y - anchor.y).toBeCloseTo(0);
    expect(world(0, -30).x - anchor.x).toBeCloseTo(0);
    expect(world(0, -30).y - anchor.y).toBeCloseTo(-30);
  });

  it('keeps every projected corner inside the generated SVG frame', () => {
    const input = { vx: -300, vy: -200, vw: 600, vh: 400 };
    const output = projectMapBounds(input);
    for (const [x, y] of [[-300, -200], [300, -200], [-300, 200], [300, 200]]) {
      const p = projectMapPoint(x, y);
      expect(p.x).toBeGreaterThanOrEqual(output.vx);
      expect(p.x).toBeLessThanOrEqual(output.vx + output.vw);
      expect(p.y).toBeGreaterThanOrEqual(output.vy);
      expect(p.y).toBeLessThanOrEqual(output.vy + output.vh);
    }
    expect(MAP_CAMERA.a * MAP_CAMERA.d - MAP_CAMERA.b * MAP_CAMERA.c).toBeGreaterThan(0);
  });
});
