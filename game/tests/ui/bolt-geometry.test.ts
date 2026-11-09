import { describe, expect, it } from 'vitest';
import {
  BOLT_LIFE_SEC, boltCenterline, boltEnvelope, boltForks, ribbonPath, seedOf,
} from '../../src/ui/combat/bolt-geometry';

const CSS_PER_M = 140;
const from = { x: 40, y: 90 }, to = { x: 460, y: 210 };
const distance = (p: { x: number; y: number }) => Math.hypot(p.x - from.x, p.y - from.y);
const curveDistance = (p: { x: number; y: number }) => {
  const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy);
  return Math.abs((p.x - from.x) * dy - (p.y - from.y) * dx) / len;
};

describe('rimworld bolt geometry', () => {
  it('anchors both ends and spaces vertices by world metres', () => {
    const short = boltCenterline({ x: 0, y: 0 }, { x: 70, y: 0 }, { seed: 3, cssPerM: CSS_PER_M });
    const long = boltCenterline({ x: 0, y: 0 }, { x: 420, y: 0 }, { seed: 3, cssPerM: CSS_PER_M });
    expect(short[0]).toEqual({ x: 0, y: 0 });
    expect(short.at(-1)).toEqual({ x: 70, y: 0 });
    // 0.5 m at 0.2 m spacing = 3 segments, raised to the 4-segment floor; 3 m = 15.
    expect(short).toHaveLength(5);
    expect(long).toHaveLength(16);
    expect(long.length).toBeGreaterThan(short.length);
  });

  it('jitters inside the amplitude, tapered to zero at the anchors', () => {
    const amplitudeM = .3;
    const points = boltCenterline(from, to, { seed: 11, cssPerM: CSS_PER_M, amplitudeM });
    expect(points[0]).toEqual(from);
    expect(points.at(-1)).toEqual(to);
    for (const point of points) expect(curveDistance(point)).toBeLessThanOrEqual(amplitudeM * CSS_PER_M + 1e-9);
    expect(points.slice(1, -1).some((point) => curveDistance(point) > 2)).toBe(true);
  });

  it('replays identically for the same seed and differs for another seed', () => {
    const one = boltCenterline(from, to, { seed: 7, cssPerM: CSS_PER_M });
    expect(boltCenterline(from, to, { seed: 7, cssPerM: CSS_PER_M })).toEqual(one);
    expect(boltCenterline(from, to, { seed: 8, cssPerM: CSS_PER_M })).not.toEqual(one);
    expect(seedOf('action-1:payload-2')).toBe(seedOf('action-1:payload-2'));
    expect(seedOf('action-1')).not.toBe(seedOf('action-2'));
  });

  it('builds a closed tapered ribbon around the centreline', () => {
    const points = boltCenterline(from, to, { seed: 5, cssPerM: CSS_PER_M });
    const d = ribbonPath(points, 4);
    expect(d.startsWith('M')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect(d.match(/[ML]/g)!.length).toBe(points.length * 2);
  });

  it('branches at most twice, from the bolt, deterministically', () => {
    const points = boltCenterline(from, to, { seed: 9, cssPerM: CSS_PER_M });
    const forks = boltForks(points, 9, CSS_PER_M);
    expect(forks.length).toBeLessThanOrEqual(2);
    expect(boltForks(points, 9, CSS_PER_M)).toEqual(forks);
    for (const fork of forks) {
      expect(fork[0]).toEqual(points.find((point) => point.x === fork[0].x && point.y === fork[0].y));
      expect(fork.length).toBeGreaterThan(3);
    }
  });

  it('attacks fast, holds, then decays inside the authored life', () => {
    expect(boltEnvelope(0)).toBe(0);
    expect(boltEnvelope(.018)).toBe(1);
    expect(boltEnvelope(.05)).toBe(1);
    expect(boltEnvelope(.1)).toBeGreaterThan(0);
    expect(boltEnvelope(.1)).toBeLessThan(1);
    expect(boltEnvelope(BOLT_LIFE_SEC)).toBe(0);
    expect(boltEnvelope(-.2)).toBe(0);
    expect(boltEnvelope(BOLT_LIFE_SEC + 1)).toBe(0);
  });
});
