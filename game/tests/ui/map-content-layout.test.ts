import { describe, expect, it } from 'vitest';
import { HEX_CONTENT_SIZING, layoutHexContent } from '../../src/ui/map/map-content-layout';
import { projectedHex } from '../../src/ui/map/map-projection';

function insideHex(radius: number, box: { x: number; y: number; width: number; height: number }) {
  const points = projectedHex(radius).points;
  for (const [x, y] of [[box.x, box.y], [box.x + box.width, box.y],
    [box.x, box.y + box.height], [box.x + box.width, box.y + box.height]]) {
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      expect((b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x)).toBeGreaterThanOrEqual(-1e-8);
    }
  }
}

describe('hex content sizing standard', () => {
  it.each([5, 7.5, 15, 22.5, 30, 60])('keeps all boxes inside the safe hex at radius %s', radius => {
    for (const count of [0, 1, 2, 4, 5, 7, 10, 13, 16]) {
      const layout = layoutHexContent(radius, count);
      for (const slot of layout.icons) insideHex(layout.safeRadius, { ...slot, width: slot.size, height: slot.size });
      for (const row of [layout.name, layout.level, layout.overflow]) {
        const width = row.maxWidth + layout.textOutline;
        insideHex(layout.safeRadius, { x: -width / 2, y: row.y - row.height / 2, width, height: row.height });
      }
      expect(layout.icons.length).toBe(count);
      expect(layout.extra).toBe(0);
      expect(layout.name.y + layout.name.height / 2).toBeLessThan(layout.level.y - layout.level.height / 2);
      if (layout.icons.length) {
        expect(layout.level.y + layout.level.height / 2).toBeLessThan(layout.icons[0].y);
        expect(Math.max(...layout.icons.map(slot => slot.y + slot.size))).toBeLessThanOrEqual(14.25 * radius / 15);
      }
    }
  });

  it('scales icons, text, spacing and outlines together from the radius', () => {
    const small = layoutHexContent(15, 5), large = layoutHexContent(30, 5);
    expect(large.safeRadius).toBeCloseTo(small.safeRadius * 2);
    expect(large.textOutline).toBeCloseTo(small.textOutline * 2);
    expect(large.uniqueGlow).toBeCloseTo(small.uniqueGlow * 2);
    for (const role of ['name', 'level', 'overflow'] as const) {
      for (const key of ['y', 'fontSize', 'height', 'maxWidth'] as const) expect(large[role][key]).toBeCloseTo(small[role][key] * 2);
    }
    large.icons.forEach((slot, i) => {
      for (const key of ['x', 'y', 'size'] as const) expect(slot[key]).toBeCloseTo(small.icons[i][key] * 2);
    });
  });

  it('keeps lone and crowded icons the same size and centres every row', () => {
    expect(Object.isFrozen(HEX_CONTENT_SIZING)).toBe(true);
    const size = layoutHexContent(15, 1).icons[0].size;
    for (const count of [1, 2, 3, 4, 5, 7, 10, 13, 16]) {
      const { icons } = layoutHexContent(15, count);
      expect(icons.every(slot => slot.size === size)).toBe(true);
      const byY = new Map<number, number[]>();
      for (const slot of icons) {
        const row = byY.get(slot.y) ?? [];
        row.push(slot.x);
        byY.set(slot.y, row);
      }
      for (const xs of byY.values()) {
        expect(xs[0] + xs.at(-1)! + size).toBeCloseTo(0, 6);
        for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThan(xs[i - 1] + size);
      }
    }
  });

  it('fits the R0 maximum (16) in three rows and rejects beyond capacity', () => {
    const layout = layoutHexContent(15, 16);
    const ys = new Set(layout.icons.map(slot => slot.y));
    expect(ys.size).toBe(3);
    expect(layout.icons.length).toBe(16);
    expect(() => layoutHexContent(15, 17)).toThrow(RangeError);
  });

  it('rejects invalid geometry instead of producing SVG with NaN or negative sizes', () => {
    for (const radius of [0, -1, NaN, Infinity, Number.MAX_VALUE]) expect(() => layoutHexContent(radius, 1)).toThrow(RangeError);
    for (const count of [-1, 1.5, NaN, Infinity]) expect(() => layoutHexContent(15, count)).toThrow(RangeError);
  });
});
