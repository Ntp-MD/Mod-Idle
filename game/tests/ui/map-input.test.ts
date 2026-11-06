import { describe, expect, it } from 'vitest';
import { neighborInDirection } from '../../src/ui/map/map-input';
import { createMapProjection, projectMapPoint } from '../../src/ui/map/map-projection';

const neighbours = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]] as const;
const planar = (q: number, r: number) => ({ x: 1.5 * q, y: Math.sqrt(3) * (r + q / 2) });
const candidates = (bearing: number) => neighbours.map(([q, r]) => {
  const point = planar(q, r);
  return { ax: `${q},${r}`, point: projectMapPoint(point.x, point.y, createMapProjection(bearing)) };
});

describe('map input neighbour', () => {
  it('picks the facing neighbour for each screen direction at bearing 0', () => {
    const all = candidates(0);
    expect(neighborInDirection({ x: 0, y: 0 }, all, [1, 0])).toBe('1,0');
    expect(neighborInDirection({ x: 0, y: 0 }, all, [-1, 0])).toBe('-1,0');
    expect(neighborInDirection({ x: 0, y: 0 }, all, [0, 1])).toBe('0,1');
    expect(neighborInDirection({ x: 0, y: 0 }, all, [0, -1])).toBe('0,-1');
  });

  it('keeps the screen direction after the camera rotates', () => {
    const all = candidates(90);
    const right = neighborInDirection({ x: 0, y: 0 }, all, [1, 0]);
    expect(right).not.toBeNull();
    const chosen = all.find((entry) => entry.ax === right)!;
    expect(chosen.point.x).toBeGreaterThan(0);
    for (const other of all) {
      if (other === chosen) continue;
      const forward = other.point.x;
      if (forward > 0) expect(other.point.y !== 0 || chosen.point.y === 0).toBe(true);
    }
  });

  it('returns null when every candidate sits behind or beside the arrow', () => {
    const all = candidates(0);
    expect(neighborInDirection({ x: 1000, y: 0 }, all, [1, 0])).toBeNull();
    expect(neighborInDirection({ x: 0, y: 0 }, [{ ax: '1,0', point: { x: 1, y: 0 } }], [0, 1])).toBeNull();
  });

  it('keeps the first candidate on a tie', () => {
    const tie = [
      { ax: '1,0', point: { x: 10, y: 2 } },
      { ax: '0,1', point: { x: 10, y: 2 } },
    ];
    expect(neighborInDirection({ x: 0, y: 0 }, tie, [1, 0])).toBe('1,0');
  });
});
