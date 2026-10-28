import { describe, expect, it } from 'vitest';
import {
  GROUND_SLAM_VFX_DURATION, SLAM_CHIPS, SLAM_CRACKS, SLAM_RING_OUTER, SLAM_SHARDS,
  groundSlamMatrix, groundSlamPoint, groundSlamSpace, slamChipState, slamShardState, slamTimeline,
} from '../../src/ui/combat/arena-ground-slam-vfx';

const area = {
  center: { x: 100, y: 80 },
  basisX: { x: 60, y: -12 },
  basisY: { x: 14, y: 42 },
  diameter: 120,
};

describe('ground slam VFX', () => {
  it('builds finite, deterministic fracture art inside the footprint', () => {
    expect(SLAM_CRACKS).toHaveLength(11);
    for (const path of SLAM_CRACKS) {
      expect(path.startsWith('M')).toBe(true);
      expect(path).toContain('L');
      const numbers = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
      expect(numbers.length).toBeGreaterThan(6);
      expect(numbers.every(Number.isFinite)).toBe(true);
      expect(Math.max(...numbers.map(Math.abs))).toBeLessThanOrEqual(1.03);
    }
    expect(SLAM_RING_OUTER.startsWith('M')).toBe(true);
    expect(SLAM_RING_OUTER.endsWith('Z')).toBe(true);
    expect(SLAM_SHARDS.length + SLAM_CHIPS.length).toBeGreaterThan(20);
  });

  it('maps the area onto the floor and keeps hit pops compact', () => {
    const full = groundSlamSpace({ x: 9, y: 9 }, area);
    expect(full).toEqual({ center: area.center, basisX: area.basisX, basisY: area.basisY });
    const compact = groundSlamSpace({ x: 5, y: 6 }, area, true);
    expect(compact.center).toEqual({ x: 5, y: 6 });
    expect(Math.hypot(compact.basisX.x, compact.basisX.y))
      .toBeLessThan(Math.hypot(full.basisX.x, full.basisX.y));
    const fallback = groundSlamSpace({ x: 5, y: 6 });
    expect(Math.hypot(fallback.basisX.x, fallback.basisX.y)).toBeGreaterThan(100);
    expect(groundSlamMatrix({ center: { x: 5, y: 6 }, basisX: { x: 1, y: 0 }, basisY: { x: 0, y: 1 } }))
      .toBe('matrix(1 0 0 1 5 6)');
  });

  it('orients points along both ground axes', () => {
    const space = groundSlamSpace({ x: 0, y: 0 }, { ...area, center: { x: 0, y: 0 } });
    expect(groundSlamPoint(space, 0, .5)).toEqual({ x: 30, y: -6 });
    const quarter = groundSlamPoint(space, Math.PI / 2, .5);
    expect(quarter.x).toBeCloseTo(7);
    expect(quarter.y).toBeCloseTo(21);
  });

  it('holds the windup, then releases the ring, cracks and dust', () => {
    const building = slamTimeline(.09, .18);
    expect(building.charge).toBeCloseTo(.5);
    expect(building.started).toBe(false);
    expect(building.wave).toBe(0);
    expect(building.fade).toBe(1);

    const impact = slamTimeline(.18, .18);
    expect(impact.started).toBe(true);
    expect(impact.flash).toBe(1);
    expect(impact.wave).toBe(0);

    const spreading = slamTimeline(.35, .18);
    expect(spreading.wave).toBeGreaterThan(.85);
    expect(spreading.cracks).toBe(1);
    expect(spreading.flash).toBe(0);

    expect(slamTimeline(GROUND_SLAM_VFX_DURATION, .18).fade).toBe(0);
    expect(slamTimeline(2, .18).fade).toBe(0);
  });

  it('keeps a stable readable pose for reduced motion', () => {
    const calm = slamTimeline(.3, .18, true);
    expect(calm.started).toBe(true);
    expect(calm.wave).toBe(.84);
    expect(calm.cracks).toBe(1);
    expect(calm.flash).toBe(.55);
  });

  it('throws shards outward, then settles them', () => {
    const space = groundSlamSpace({ x: 0, y: 0 }, { ...area, center: { x: 0, y: 0 } });
    const shard = SLAM_SHARDS[0];
    expect(slamShardState(shard, -1, space)).toBeUndefined();
    const flying = slamShardState(shard, .3, space)!;
    const settled = slamShardState(shard, .7, space)!;
    expect(Number.isFinite(flying.x) && Number.isFinite(flying.y)).toBe(true);
    expect(flying.scale).toBeGreaterThanOrEqual(2.2);
    expect(flying.opacity).toBeGreaterThan(settled.opacity);
    expect(settled.opacity).toBe(0);
    expect(slamShardState(shard, .3, space, true)).toBeDefined();
  });

  it('flies chips on a shorter arc than shards', () => {
    const space = groundSlamSpace({ x: 0, y: 0 }, { ...area, center: { x: 0, y: 0 } });
    const chip = SLAM_CHIPS[0];
    expect(slamChipState(chip, -1, space)).toBeUndefined();
    const flying = slamChipState(chip, .3, space)!;
    expect(flying.size).toBeGreaterThanOrEqual(1.1);
    expect(flying.opacity).toBeGreaterThan(0);
    expect(slamChipState(chip, .7, space)!.opacity).toBeLessThan(flying.opacity);
  });
});
