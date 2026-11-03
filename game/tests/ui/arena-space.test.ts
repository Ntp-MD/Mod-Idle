import { describe, expect, it } from 'vitest';
import {
  ARENA_UNITS_PER_METER, aoePulseMs, groundCirclePath, groundCirclePoints,
  groundDistance, metersToUnits, unitsToMeters, withinRadius,
} from '../../src/ui/combat/arena-space';
import { projectArenaPoint } from '../../src/ui/combat/combat-arena-view';

describe('arena meters and ground areas', () => {
  it('keeps one meter contract for distance, radius and conversion', () => {
    expect(ARENA_UNITS_PER_METER).toBe(1);
    expect(metersToUnits(3)).toBe(3);
    expect(unitsToMeters(3)).toBe(3);
    expect(groundDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5);
    expect(withinRadius({ x: 9, y: 6 }, { x: 11, y: 6 }, 2)).toBe(true);
    expect(withinRadius({ x: 9, y: 6 }, { x: 11, y: 6 }, 1.9)).toBe(false);
  });

  it('projects a world circle through the same ground plane as the actors', () => {
    const center = { x: 9, y: 6 };
    const points = groundCirclePoints(center, 2, 16);
    expect(points).toHaveLength(16);
    expect(points[0]).toEqual(projectArenaPoint({ x: 11, y: 6 }));
    const path = groundCirclePath(center, 2, 16);
    expect(path.startsWith('M')).toBe(true);
    expect(path.endsWith('Z')).toBe(true);
    expect(new Set(points.map((point) => `${point.x},${point.y}`)).size).toBe(16);
  });

  it('grows the ground footprint with the meter radius', () => {
    const center = { x: 9, y: 6 };
    const small = groundCirclePoints(center, 2, 32);
    const large = groundCirclePoints(center, 4, 32);
    const span = (points: { x: number; y: number }[]) =>
      Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x));
    expect(span(large)).toBeGreaterThan(span(small));
    expect(groundCirclePath(center, 2)).not.toBe(groundCirclePath(center, 4));
  });

  it('compresses the pulse at combat speed without changing the radius', () => {
    expect(aoePulseMs(1)).toBe(1600);
    expect(aoePulseMs(4)).toBe(400);
    expect(aoePulseMs(0)).toBe(1600);
  });
});
