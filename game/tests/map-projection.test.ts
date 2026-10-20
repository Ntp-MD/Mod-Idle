import { describe, expect, it } from 'vitest';
import { MAP_CAMERA, mapUprightAt, projectMapBounds, projectMapPoint } from '../src/ui/map-projection';

describe('tabletop projection', () => {
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
