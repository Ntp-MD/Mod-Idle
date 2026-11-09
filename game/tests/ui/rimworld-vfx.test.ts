import { describe, expect, it } from 'vitest';
import {
  RIMWORLD_FORMS, arcPath, burstOffsets, channelBlades, linePath, parabolaPoint, streakDrops, supportMotes,
} from '../../src/ui/combat/rimworld-vfx';

describe('rimworld shape helpers', () => {
  it('lists every form the renderer must cover', () => {
    expect(RIMWORLD_FORMS).toHaveLength(13);
    expect(new Set(RIMWORLD_FORMS).size).toBe(13);
  });

  it('scatters a deterministic burst inside the radius', () => {
    const burst = burstOffsets(21, 12, 3);
    expect(burst).toHaveLength(12);
    expect(burstOffsets(21, 12, 3)).toEqual(burst);
    expect(burstOffsets(22, 12, 3)).not.toEqual(burst);
    for (const piece of burst) {
      expect(Math.hypot(piece.x, piece.y)).toBeLessThanOrEqual(3);
      expect(piece.sizeM).toBeGreaterThan(0);
      expect(piece.delay).toBeLessThanOrEqual(.06);
    }
    const quadrants = new Set(burst.map((p) => `${p.x >= 0}:${p.y >= 0}`));
    expect(quadrants.size).toBe(4);
  });

  it('spawns field streaks inside the footprint with a landing height', () => {
    const drops = streakDrops(5, 8, 3);
    expect(drops).toHaveLength(8);
    expect(streakDrops(5, 8, 3)).toEqual(drops);
    for (const drop of drops) {
      expect(Math.hypot(drop.x, drop.y)).toBeLessThanOrEqual(3);
      expect(drop.fallM).toBeGreaterThanOrEqual(.9);
      expect(drop.delay).toBeGreaterThanOrEqual(0);
      expect(drop.delay).toBeLessThan(1);
    }
  });

  it('rises support motes around the body', () => {
    const motes = supportMotes(9, 6, 1.6);
    expect(motes).toHaveLength(6);
    expect(supportMotes(9, 6, 1.6)).toEqual(motes);
    for (const mote of motes) expect(mote.riseM).toBeGreaterThan(.9);
  });

  it('closes arc and line shapes in metre space', () => {
    const arc = arcPath(3, Math.PI / 4);
    expect(arc.startsWith('M0 0')).toBe(true);
    expect(arc.endsWith('Z')).toBe(true);
    const line = linePath(5, .6);
    expect(line.endsWith('Z')).toBe(true);
    expect(line).toContain('L5 ');
  });

  it('arcs a lob through its apex and lands exactly on target', () => {
    const from = { x: 0, y: 0 }, to = { x: 4, y: 2 };
    expect(parabolaPoint(from, to, 2.2, 0)).toEqual(from);
    expect(parabolaPoint(from, to, 2.2, 1)).toEqual(to);
    const mid = parabolaPoint(from, to, 2.2, .5);
    expect(mid.x).toBeCloseTo(2, 6);
    expect(mid.y).toBeCloseTo(1 - 2.2, 6);
  });

  it('rotates channel blades deterministically with the spin', () => {
    const still = channelBlades(4, 4, 1.2, 0);
    expect(channelBlades(4, 4, 1.2, 0)).toEqual(still);
    expect(channelBlades(4, 4, 1.2, 1)).not.toEqual(still);
    for (const blade of still) expect(Math.hypot(blade.to.x, blade.to.y)).toBeLessThanOrEqual(1.2);
  });
});
