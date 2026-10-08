import { describe, it, expect } from 'vitest';
import { E, eng, loot } from '../src/engine/client';
import { rollDrop } from '../src/sim/drop';
import { mulberry32 } from '../src/engine/client-helpers';

/**
 * The item level is the one axis a piece's values ride (`item-level.md`): the window climbs with the
 * level, its floor comes from the band below, and the third a roll lands in decides the value — the top
 * third rarest, so a good roll is never a formality. These tests pin the shape the client and the loot
 * cage both read, and the property the old Rarity axis used to carry: a high-level piece can still come
 * out at the bottom of its own window.
 */

const MOD = 'physical_power_flat'; // a flat with a full 3-band ladder in mods.json
const span = (band: string) => (E.item_level.spans as any[]).find((s) => s.band === band);

describe('the value window climbs with the item level', () => {
  it('never falls as the level rises, inside a band and across a hop', () => {
    for (const [q, band] of [[0, 'low'], [1, 'mid'], [2, 'high']] as [number, string][]) {
      const s = span(band);
      let lastLo = -Infinity;
      let lastHi = -Infinity;
      for (let ilvl = s.from; ilvl <= s.to; ilvl++) {
        const [lo, hi] = loot.windowAt(MOD, ilvl, q);
        expect(lo).toBeLessThanOrEqual(hi);
        expect(lo).toBeGreaterThanOrEqual(lastLo);
        expect(hi).toBeGreaterThanOrEqual(lastHi);
        lastLo = lo;
        lastHi = hi;
      }
    }
  });

  it('starts at the band below, and a level past the span clamps to the band\u2019s own window', () => {
    const mid = span('mid');
    const [loAtStart] = loot.windowAt(MOD, mid.from, 1);
    const [loBelow] = loot.windowAt(MOD, span('low').to, 0);
    expect(loAtStart).toBe(loBelow); // the mid band's first level can roll the low band's floor
    expect(loot.windowAt(MOD, mid.to + 50, 1)).toEqual(loot.windowAt(MOD, mid.to, 1));
  });

  it('never passes the Mod\u2019s own ceiling, and each band tops out at its own', () => {
    const max = loot.MAX_OF[MOD];
    for (const [q, band] of [[0, 'low'], [1, 'mid'], [2, 'high']] as [number, string][]) {
      const ladder = loot.BANDS_OF[MOD][q];
      const [lo, hi] = loot.windowAt(MOD, span(band).to, q);
      expect(hi).toBe(ladder[ladder.length - 1][1]); // the band's own top
      expect(hi).toBeLessThanOrEqual(max);
      expect(lo).toBeGreaterThanOrEqual(0);
    }
    expect(loot.windowAt(MOD, span('high').to, 2)[1]).toBe(max);
  });
});

describe('the roll inside the window', () => {
  it('puts the common outcome at the bottom and the top third at the rarest', () => {
    const s = span('high');
    const [lo, hi] = loot.windowAt(MOD, s.to, 2);
    const bottom = loot.rangeOf(MOD, s.to, 2, 2);
    expect(bottom[0]).toBe(lo); // the bottom third starts at the window's floor
    expect(bottom[1]).toBeLessThan(hi);
    expect(loot.tierSlice(0.1)).toBe(2); // 50%: the bottom
    expect(loot.tierSlice(0.6)).toBe(1); // 33%: the middle
    expect(loot.tierSlice(0.95)).toBe(0); // 17%: the top — best is never free
  });

  it('keeps every Random line inside its own window at the level it dropped at', () => {
    const rng = mulberry32(9);
    for (let i = 0; i < 400; i++) {
      const item = rollDrop(rng, 'high', span('high').to);
      // line 1 is the frame's own set (the flat lines its name declares) and is scaled by `value_scale` when it carries a second Mod, so
      // it is deliberately below the window; the Random lines are the window's own
      for (const l of item.lines.slice(1)) {
        const [lo, hi] = loot.rangeOf(l.id, item.ilvl, item.q!, l.slice!);
        expect(l.value).toBeGreaterThanOrEqual(lo);
        expect(l.value).toBeLessThanOrEqual(hi);
      }
    }
  });

  it('is stamped with the level it dropped at, on every piece', () => {
    const L = E.item_level;
    const lo = L.base_mod_slots + L.sub_slots + L.stat_mod_slots.min;
    const hi = L.base_mod_slots + L.sub_slots + L.stat_mod_slots.max;
    const rng = mulberry32(11);
    for (let i = 0; i < 200; i++) {
      const item = rollDrop(rng, 'mid', 45);
      expect(item.ilvl).toBe(45);
      expect(item.lines.length).toBeGreaterThanOrEqual(lo);
      expect(item.lines.length).toBeLessThanOrEqual(hi);
      expect(eng.qualityIndexOf(item.quality)).toBe(1);
    }
  });
});
