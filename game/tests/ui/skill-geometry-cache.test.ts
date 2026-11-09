import { describe, expect, it } from 'vitest';
import type { SkillAreaSnapshot } from '@engine/types';
import { clearGroundShapeCache, groundShapeCacheSize, groundShapeWorldPoints, groundWorldShapeCacheSize } from '../../src/ui/combat/arena-vfx-space';

const circle = (x: number): SkillAreaSnapshot =>
  ({ origin: 'target', shape: 'circle', radiusM: 2, center: { x, y: 6 } }) as SkillAreaSnapshot;

describe('PF1 stable skill geometry cache', () => {
  it('reuses world points for a fixed deployed field and projects per frame', () => {
    clearGroundShapeCache();
    const area = circle(10);
    const first = groundShapeWorldPoints(area);
    const second = groundShapeWorldPoints(area);
    expect(second).toBe(first);
    const sizeAfterRepeat = groundShapeCacheSize();
    groundShapeWorldPoints(circle(10));
    expect(groundShapeCacheSize()).toBe(sizeAfterRepeat);
  });
  it('invalidates on aim movement and bounds retention', () => {
    clearGroundShapeCache();
    const fixed = groundShapeWorldPoints(circle(10));
    expect(groundShapeWorldPoints(circle(11))).not.toBe(fixed);
    for (let index = 0; index < 300; index++) {
      groundShapeWorldPoints(circle(100 + index));
    }
    expect(groundWorldShapeCacheSize()).toBeLessThanOrEqual(128);
    expect(groundShapeCacheSize()).toBeLessThanOrEqual(128);
  });
});
