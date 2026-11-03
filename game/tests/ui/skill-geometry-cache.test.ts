import { describe, expect, it } from 'vitest';
import type { SkillAreaSnapshot } from '@engine/types';
import { clearGroundCircleCache, groundCirclePath, groundCircleCacheSize } from '../../src/ui/combat/arena-space';
import { clearGroundShapeCache, groundShapePath, groundShapePoints, groundShapeCacheSize } from '../../src/ui/combat/arena-vfx-space';

const circle = (x: number): SkillAreaSnapshot =>
  ({ origin: 'target', shape: 'circle', radiusM: 2, center: { x, y: 6 } }) as SkillAreaSnapshot;

describe('PF1 stable skill geometry cache', () => {
  it('reuses points and paths for a fixed deployed field', () => {
    clearGroundShapeCache();
    clearGroundCircleCache();
    const area = circle(10);
    const first = groundShapePoints(area);
    const second = groundShapePoints(area);
    expect(second).toBe(first);
    expect(groundShapePath(area)).toBe(groundShapePath(area));
    const sizeAfterRepeat = groundShapeCacheSize();
    groundShapePoints(circle(10));
    expect(groundShapeCacheSize()).toBe(sizeAfterRepeat);
    const rangeFirst = groundCirclePath({ x: 1, y: 2 }, 5, 48);
    expect(groundCirclePath({ x: 1, y: 2 }, 5, 48)).toBe(rangeFirst);
  });
  it('invalidates on aim movement and bounds retention', () => {
    clearGroundShapeCache();
    const fixed = groundShapePoints(circle(10));
    expect(groundShapePoints(circle(11))).not.toBe(fixed);
    for (let index = 0; index < 300; index++) {
      groundShapePoints(circle(100 + index));
      groundCirclePath({ x: 100 + index, y: 6 }, 5, 48);
    }
    expect(groundShapeCacheSize()).toBeLessThanOrEqual(256);
    expect(groundCircleCacheSize()).toBeLessThanOrEqual(256);
  });
});
