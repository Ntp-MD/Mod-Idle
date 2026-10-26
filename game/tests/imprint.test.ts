import { describe, it, expect } from 'vitest';
import { E, loot, MODS } from '../src/engine/client';
import { newGame, setLevel, tick, huntZone } from '../src/sim/game';
import { craft, doCraft, imprintStonesOf, poolOf } from '../src/sim/craft';
import { mulberry32 } from '../src/engine/client-helpers';
import { exportJson, importJson } from '../src/state/save';

/**
 * IM4 · the imprint stone in the live loop. One stone per Mod line: it names one Unbound line
 * and rewrites it as its own Mod, rolling Tier and value fresh. The drop-count stamp keeps the
 * +2 Add cap net, so Remove refunds room; every press charges one stone.
 */
const seed = (n: number) => mulberry32(n);

function piece() {
  const s = newGame();
  huntZone(s, s.zone);
  setLevel(s, 60);
  let guard = 0;
  while (s.bag.length === 0 && guard++ < 40000) tick(s, { online: true });
  return { s, item: s.bag[0] };
}

describe('imprint stone', () => {
  it('excludes the tree-only cap from new stones and refuses a legacy stone without spending it', () => {
    const { s } = piece();
    const mod = 'elemental_resistance_cap_pct';
    const key = 'imprint_' + mod;
    s.counters.stones[key] = 2;
    const before = structuredClone(s.bag[0]);
    let draws = 0;
    const result = doCraft(s, 'bag', 0, 'imprint', craft.UNTOUCHABLE, () => { draws++; return 0; }, mod);
    expect(result.ok).toBe(false);
    expect(result.why).toMatch(/cannot be imprinted/i);
    expect(s.counters.stones[key]).toBe(2);
    expect(s.bag[0]).toEqual(before);
    expect(draws).toBe(0);
    expect(imprintStonesOf(s.counters.stones)).toContainEqual({ key, mod });
    expect(loot.IMPRINT_IDS).not.toContain(mod);
    // Imprint still offers gear Mods beyond ordinary Base pools.
    expect(loot.IMPRINT_IDS).toContain('perfect_dodge_pct');
    s.bag[0].lines[craft.UNTOUCHABLE] = { id: mod, value: 15, slice: 2 };
    const loaded = importJson(exportJson(s));
    expect(loaded.counters.stones[key]).toBe(2);
    expect(loaded.bag[0].lines[craft.UNTOUCHABLE]).toEqual({ id: mod, value: 15, slice: 2 });
  });

  it('still applies a legitimate Mod outside the item Base pool', () => {
    const { s } = piece();
    const mod = 'perfect_dodge_pct';
    expect(poolOf(s.bag[0])).not.toContain(mod);
    s.counters.stones['imprint_' + mod] = 1;
    expect(doCraft(s, 'bag', 0, 'imprint', craft.UNTOUCHABLE, seed(7), mod).ok).toBe(true);
    expect(s.bag[0].lines[craft.UNTOUCHABLE].value).toBeGreaterThanOrEqual(1);
    expect(s.counters.stones['imprint_' + mod]).toBe(0);
  });

  it('keeps every effective roll inside declared bounds with nondecreasing level floors', () => {
    for (const mod of MODS.mods) {
      for (const [q, span] of E.item_level.spans.entries()) {
        let previous = -Infinity;
        for (let ilvl = span.from; ilvl <= span.to; ilvl++) {
          const [lo, hi] = loot.windowAt(mod.id, ilvl, q);
          expect(lo, `${mod.id} q${q} ilvl${ilvl}`).toBeGreaterThanOrEqual(mod.min);
          expect(hi).toBeLessThanOrEqual(mod.max);
          expect(lo).toBeGreaterThanOrEqual(previous);
          previous = lo;
          for (let slice = 0; slice < loot.sliceCount(); slice++) {
            const [a, b] = loot.rangeOf(mod.id, ilvl, q, slice);
            expect(a).toBeGreaterThanOrEqual(lo);
            expect(b).toBeLessThanOrEqual(hi);
            expect(a).toBeLessThanOrEqual(b);
          }
        }
      }
    }
  });

  it('an elite or boss kill can pay a per-Mod stone', () => {
    const { s } = piece();
    let guard = 0;
    while (guard++ < 60000 && !Object.keys(s.counters.stones).some((k) => k.startsWith('imprint_'))) {
      tick(s, { online: true });
    }
    const keys = Object.keys(s.counters.stones).filter((k) => k.startsWith('imprint_'));
    expect(keys.length).toBeGreaterThan(0);
    expect(keys.every((key) => loot.IMPRINT_IDS.includes(key.slice('imprint_'.length)))).toBe(true);
    expect(imprintStonesOf(s.counters.stones).length).toBe(keys.length);
  });

  it('one stone rewrites one Unbound line with a fresh roll, clearing the baseline', () => {
    const s = newGame();
    huntZone(s, s.zone);
    setLevel(s, 60);
    // hunt for a drop the bench can actually imprint: a piece rolled full to its own Base pool, or one
    // holding the Stat Mod line that blocks every sibling in that family, names no target at all
    let bag = -1, line = -1, target = '';
    let guard = 0;
    while (guard++ < 200000 && !target) {
      tick(s, { online: true });
      for (let i = 0; i < s.bag.length && !target; i++) {
        const item: any = s.bag[i];
        const untouchable = item.lines.findIndex((_: any, j: number) => j >= craft.UNTOUCHABLE);
        if (untouchable < 0) continue;
        const carried = new Set<string>(item.lines.flatMap((l: any) => [l.id, ...((l.extra || []).map((x: any) => x.id))]));
        const blocked = loot.blockedBy(carried);
        const found = poolOf(item).find((id) => !carried.has(id) && !blocked.has(id));
        if (found) { bag = i; line = untouchable; target = found; }
      }
    }
    expect(target).toBeTruthy();
    s.counters.stones = { ...s.counters.stones, ['imprint_' + target]: 1 };
    const before = s.bag[bag].lines[line].id;
    const r = doCraft(s, 'bag', bag, 'imprint', line, seed(7), target);
    expect(r.ok).toBe(true);
    expect(s.bag[bag].lines[line].id).toBe(target);
    expect(target).not.toBe(before);
    expect(s.counters.stones['imprint_' + target] || 0).toBe(0);
  });

  it('refuses the Frame Mod, the Bound pair and a carried Mod', () => {
    const { s } = piece();
    s.counters.stones = { ...s.counters.stones, imprint_critical_chance: 5 };
    expect(doCraft(s, 'bag', 0, 'imprint', 0, seed(7), 'critical_chance').ok).toBe(false);
    expect(doCraft(s, 'bag', 0, 'imprint', 1, seed(7), 'critical_chance').ok).toBe(false);
    const carried = s.bag[0].lines[craft.UNTOUCHABLE].id;
    s.counters.stones = { ...s.counters.stones, ['imprint_' + carried]: 1 };
    expect(doCraft(s, 'bag', 0, 'imprint', craft.UNTOUCHABLE, seed(7), carried).ok).toBe(false);
  });

  it('the +2 cap is net: Remove refunds room, and every press charges one stone', () => {
    const s = newGame();
    setLevel(s, 60);
    huntZone(s, s.zone);
    s.counters.stones = { ...s.counters.stones, add: 99, remove: 99 };
    // find a dropped piece the Add bench itself still has room on (count and pool)
    let idx = -1, guard = 0;
    while (guard++ < 200000) {
      tick(s, { online: true });
      for (let i = 0; i < s.bag.length; i++) {
        if (craft.add(s.bag[i], poolOf(s.bag[i]), seed(21)).ok) { idx = i; break; }
      }
      if (idx >= 0) break;
    }
    expect(idx).toBeGreaterThanOrEqual(0);
    const item = s.bag[idx];
    const dropUnbound = item.unbound_at_drop;
    expect(dropUnbound).toBeGreaterThanOrEqual(0);
    const r1 = doCraft(s, 'bag', idx, 'add', 0, seed(11));
    expect(r1.ok).toBe(true);
    expect(s.bag[idx].mods_added).toBe((item.mods_added || 0) + 1);
    const r2 = doCraft(s, 'bag', idx, 'remove', 0, seed(12));
    expect(r2.ok).toBe(true);
    // net is back at the drop count, so one more Add fits — but the purse paid full price
    const paidAdd = 99 - (s.counters.stones.add || 0);
    const r3 = doCraft(s, 'bag', idx, 'add', 0, seed(13));
    expect(r3.ok).toBe(true);
    expect(paidAdd).toBeGreaterThanOrEqual(1);
    expect(s.bag[idx].lines.length - craft.UNTOUCHABLE - (s.bag[idx].unbound_at_drop || 0)).toBeLessThanOrEqual(E.item_level.mods_added_cap);
  });
});
