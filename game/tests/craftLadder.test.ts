import { describe, it, expect } from 'vitest';
import { E, loot } from '../src/engine/client';
import { craft } from '../src/sim/craft';

const C = E.craft;
const bench: any = craft;

const piece = (over: any = {}) => ({
  slot: 'helmet', base: 'coif', ilvl: 1, quality: 'low', tier: 'T3', q: 0,
  lines: [{ id: 'armour_flat', value: 20, slice: 2 }], ...over,
});
/** A rng pinned to a fixed sequence so every branch of the ladder is reachable. */
const seq = (values: number[]) => { let i = 0; return () => values[i++ % values.length]; };

describe('the +1..+15 ladder', () => {
  it('reads its chance off the published endpoints, interpolated between', () => {
    const EP = C.upgrade_success_endpoints as any;
    const midFrom = EP.safe_to + 1, midTo = EP.safe_to + 6;
    const highFrom = midTo + 1, highTo = C.upgrade_cap;
    expect(bench.successPct(1)).toBe(100);
    expect(bench.successPct(EP.safe_to)).toBe(100);
    expect(bench.successPct(midFrom)).toBe(EP.mid[0]);
    expect(bench.successPct(midTo)).toBe(EP.mid[1]);
    expect(bench.successPct(highFrom)).toBe(EP.high[0]);
    expect(bench.successPct(highTo)).toBe(EP.high[1]);
    expect(bench.successPct(7)).toBeGreaterThan(bench.successPct(8)); // it only ever falls
  });

  it('charges Quality Stones by the step, read off the published cost ladder', () => {
    const COSTS = C.upgrade_costs as any;
    expect(bench.costOf('upgrade', piece())).toEqual({ quality: COSTS[0] });
    expect(bench.costOf('upgrade', piece({ upgrade_lv: 5 }))).toEqual({ quality: COSTS[5] });
    expect(bench.costOf('upgrade', piece({ upgrade_lv: 10 }))).toEqual({ quality: COSTS[10] });
    expect(bench.costOf('upgrade', piece({ upgrade_lv: 14 }))).toEqual({ quality: COSTS[14] });
  });

  it('stops at +15 and refuses a Broken or corrupted piece', () => {
    expect(bench.upgrade(piece({ upgrade_lv: 15 }), seq([0.99])).why).toMatch(/\+15/);
    expect(bench.upgrade(piece({ broken: true }), seq([0])).why).toMatch(/Broken/);
    expect(bench.upgrade(piece({ corrupted: true }), seq([0])).why).toMatch(/corrupted/i);
    expect(bench.reroll(piece({ corrupted: true }), 0, seq([0])).why).toMatch(/corrupted/i);
    expect(bench.refine(piece({ broken: true }), 0, seq([0])).why).toMatch(/Broken/);
  });

  it('a fail below +11 drops one level and never breaks', () => {
    const r = bench.upgrade(piece({ upgrade_lv: 6 }), seq([0.99])); // a certain miss
    expect(r.changed.outcome).toBe('dropped');
    expect(r.item.upgrade_lv).toBe(5);
    expect(r.item.broken).toBeFalsy();
  });

  it('a fail at +11 spends protection first, then breaks the piece', () => {
    const held = bench.upgrade(piece({ upgrade_lv: 10, protection_left: 2 }), seq([0.99]));
    expect(held.changed.outcome).toBe('protected');
    expect(held.item.protection_left).toBe(1);
    expect(held.item.broken).toBeFalsy();
    const gone = bench.upgrade(piece({ upgrade_lv: 10, protection_left: 0 }), seq([0.99]));
    expect(gone.changed.outcome).toBe('broken');
    expect(gone.item.broken).toBe(true);
    expect(gone.item.protection_left).toBe(0);
  });

  it('a piece born with no counter still has its five charges', () => {
    const r = bench.upgrade(piece({ upgrade_lv: 10 }), seq([0.99]));
    expect(r.changed.outcome).toBe('protected');
    expect(r.item.protection_left).toBe(C.protection_start - 1);
  });

  it('Repair revives at the level it broke at and refills protection', () => {
    const broken = bench.upgrade(piece({ upgrade_lv: 12, protection_left: 0 }), seq([0.99])).item;
    expect(broken.broken).toBe(true);
    const level = broken.upgrade_lv;
    const back = bench.repair(broken);
    expect(back.changed.outcome).toBe('repaired');
    expect(back.item.broken).toBe(false);
    expect(back.item.upgrade_lv).toBe(level); // kept at its level, exactly as the doc states
    expect(back.item.protection_left).toBe(C.protection_start);
    expect(bench.repair(piece()).why).toMatch(/not Broken/);
    expect(bench.costOf('repair')).toEqual({ repair: 1 });
  });
});

describe('the one Corrupt gamble', () => {
  const pool = ['max_hp_flat', 'stat_mod_flat', 'elemental_resistance'];
  const outcomes = C.corrupt_outcomes.map((o: any) => o.kind);

  it('spends one roll per weight and closes the piece to every other stone', () => {
    const seen: string[] = [];
    for (let i = 0; i < 40; i++) {
      const r = bench.corrupt(piece(), pool, seq([i / 40, 0.5, 0.5, 0.5]));
      expect(r.ok).toBe(true);
      expect(r.item.corrupted).toBe(true);
      seen.push(r.changed.outcome);
      expect(outcomes).toContain(r.changed.outcome);
    }
    expect(new Set(seen).size).toBeGreaterThan(2); // more than one outcome is reachable
    const closed = bench.reroll(piece({ corrupted: true }), 0, seq([0.5]));
    expect(closed.ok).toBe(false);
  });

  it('never destroys the piece, and its worst outcome is one quality step down', () => {
    const worst = bench.corrupt(piece({ q: 2, quality: 'high' }), pool, seq([1])); // last row = 5%
    expect(worst.changed.outcome).toBe('quality_down');
    expect(worst.item.quality).toBe('mid');
    expect(worst.item.lines.length).toBe(1); // the piece survives, only its step moves
    const none = bench.corrupt(piece(), pool, seq([0.001]));
    expect(none.changed.outcome).toBe('nothing');
  });

  it('is the only stone allowed to move an Element', () => {
    const withElement = piece({ lines: [{ id: 'elemental_resistance', value: 20, slice: 1, element: 'fire' }] });
    const weights = C.corrupt_outcomes.map((o: any) => o.weight);
    const idx = C.corrupt_outcomes.findIndex((o: any) => o.kind === 'reroll_element');
    // land the roll exactly on that row
    const before = weights.slice(0, idx).reduce((a: number, b: number) => a + b, 0);
    const u = (before + 1) / weights.reduce((a: number, b: number) => a + b, 0);
    const r = bench.corrupt(withElement, pool, seq([u, 0.99]));
    expect(r.changed.outcome).toBe('reroll_element');
    expect(E.elements.order).toContain(r.item.lines[0].element);
    expect(r.item.lines[0].element).not.toBe('fire');
  });
});
