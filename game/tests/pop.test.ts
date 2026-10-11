import { describe, it, expect } from 'vitest';
import { popPlace } from '../src/ui/pop';

/** one square, wherever the caller says it is */
const at = (left: number, top: number, w = 40, h = 40) => ({
  top, left, right: left + w, bottom: top + h,
});

describe('a floating card is placed by the room that actually exists', () => {
  it('stands beside its square while there is room there', () => {
    const p = popPlace(at(100, 100), { w: 240, h: 170 }, 1440, 900);
    expect(p.left).toBe(146); // the square's right edge, plus the gap
    expect(p.top).toBe(90); // the square's own line, nudged up
  });

  it('turns to the other side at the edge of the screen', () => {
    const p = popPlace(at(1300, 100), { w: 240, h: 170 }, 1440, 900);
    expect(p.left).toBe(1300 - 246); // left of the square, not off the frame
  });

  it('lifts above its square when the foot of the screen is too short', () => {
    const p = popPlace(at(100, 620, 40, 40), { w: 240, h: 300 }, 1024, 700);
    expect(p.top + 300).toBeLessThanOrEqual(700 - 8);
    expect(p.top).toBe(660 - 300 + 10); // standing on the square's bottom line
  });

  it('holds a card taller than the frame inside the frame, where it scrolls', () => {
    const p = popPlace(at(100, 620, 40, 40), { w: 240, h: 900 }, 1024, 700);
    expect(p.top).toBe(8);
  });

  it('never leaves a square on any edge, at any size that fits the screen', () => {
    for (const vw of [1024, 1440, 1920]) {
      for (const vh of [700, 900]) {
        for (const size of [{ w: 218, h: 150 }, { w: 247, h: 170 }, { w: 336, h: 420 }]) {
          for (const [left, top] of [[8, 8], [vw - 48, 8], [8, vh - 48], [vw - 48, vh - 48], [vw / 2, vh / 2]]) {
            const p = popPlace(at(left, top), size, vw, vh);
            expect(p.left).toBeGreaterThanOrEqual(8);
            expect(p.top).toBeGreaterThanOrEqual(8);
            expect(p.left + size.w).toBeLessThanOrEqual(vw - 8);
            expect(p.top + size.h).toBeLessThanOrEqual(vh - 8);
          }
        }
      }
    }
  });

  it('is not moved when it does not have to be', () => {
    // the clamp is the last resort: a card with room keeps the place the anchor asked for
    const p = popPlace(at(400, 300), { w: 240, h: 170 }, 1440, 900);
    expect(p).toEqual({ left: 446, top: 290 });
  });
});
