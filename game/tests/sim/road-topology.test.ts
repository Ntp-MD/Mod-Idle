import { describe, expect, it } from 'vitest';
import { createRoad, hexDistance, hexPath, locationId, parseLocationRef } from '../../../engine/road.ts';

const base = { nodes: [{ id: 'a', q: 0, r: 0 }, { id: 'b', q: 4, r: 0 }], block_sec: 1 } as any;
const open = createRoad({ road: base } as any);

describe('canonical topology prototype', () => {
  it('routes the open lattice exactly as before (no mask = no behavior change)', () => {
    const a = { q: 0, r: 0 }, b = { q: 4, r: -2 };
    expect(open.hasLandMask).toBe(false);
    expect(open.routeLand(a, b)).toEqual(hexPath(a, b));
    expect(open.blocksLand(a, b)).toBe(hexDistance(a, b));
    expect(open.isLand({ q: 999, r: -999 })).toBe(true);
  });

  it('walks around void on a mask, keeps every step adjacent, and refuses the unreachable', () => {
    // corridor with one gap: only column q=2, r=0 is land
    const land: [number, number][] = [];
    for (let q = -3; q <= 5; q++) for (let r = -3; r <= 3; r++) {
      if (q === 2 && r !== 0) continue;
      land.push([q, r]);
    }
    const road = createRoad({ road: { ...base, land } } as any);
    expect(road.hasLandMask).toBe(true);
    const path = road.routeLand({ q: 0, r: 0 }, { q: 4, r: 0 })!;
    expect(path).not.toBeNull();
    expect(path[0]).toEqual({ q: 0, r: 0 });
    expect(path[path.length - 1]).toEqual({ q: 4, r: 0 });
    for (let i = 1; i < path.length; i++) {
      expect(hexDistance(path[i - 1], path[i])).toBe(1);
      expect(road.isLand(path[i])).toBe(true);
    }
    expect(road.blocksLand({ q: 0, r: 0 }, { q: 4, r: 0 })).toBe(path.length - 1);
    expect(road.routeLand({ q: 0, r: 0 }, { q: 2, r: 1 })).toBeNull();
    expect(road.blocksLand({ q: 0, r: 0 }, { q: 2, r: 1 })).toBeNull();
    expect(road.routeLand({ q: 0, r: 0 }, { q: 0, r: 0 })).toEqual([{ q: 0, r: 0 }]);
    // fixed neighbour order: same endpoints always plot the same steps
    expect(road.routeLand({ q: 0, r: 0 }, { q: 4, r: 0 })).toEqual(path);
  });

  it('names locations with stable ids and reads them back', () => {
    expect(locationId(7, 'sub', 2)).toBe('zone:7:sub:2');
    expect(locationId(7, 'site', 0, 'mine')).toBe('zone:7:site:0:mine');
    expect(parseLocationRef('zone:7:sub:2')).toEqual({ id: 'zone:7:sub:2', zoneId: 7, kind: 'sub', index: 2 });
    expect(parseLocationRef('zone:7:site:0:mine')).toMatchObject({ zoneId: 7, kind: 'site', site: 'mine' });
    expect(parseLocationRef('eastgate')).toBeNull();
    expect(parseLocationRef('zone:x:sub:2')).toBeNull();
  });
});
