import { describe, expect, it } from 'vitest';
import {
  ARENA_UNITS_PER_METER, aoePulseMs,
  groundDistance, metersToUnits, unitsToMeters, withinRadius,
} from '../../src/ui/combat/arena-space';

describe('arena meters and ground areas', () => {
  it('keeps one meter contract for distance, radius and conversion', () => {
    expect(ARENA_UNITS_PER_METER).toBe(1);
    expect(metersToUnits(3)).toBe(3);
    expect(unitsToMeters(3)).toBe(3);
    expect(groundDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBeCloseTo(5);
    expect(withinRadius({ x: 9, y: 6 }, { x: 11, y: 6 }, 2)).toBe(true);
    expect(withinRadius({ x: 9, y: 6 }, { x: 11, y: 6 }, 1.9)).toBe(false);
  });

  it('compresses the pulse at combat speed without changing the radius', () => {
    expect(aoePulseMs(1)).toBe(1600);
    expect(aoePulseMs(4)).toBe(400);
    expect(aoePulseMs(0)).toBe(1600);
  });
});
