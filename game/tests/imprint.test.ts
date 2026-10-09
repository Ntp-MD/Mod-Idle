import { describe, it, expect } from 'vitest';
import { E } from '../src/engine/client';
import { newGame, setLevel, tick, huntZone } from '../src/sim/game';
import { craft, doCraft, imprintStonesOf, poolOf } from '../src/sim/craft';
import { mulberry32 } from '../src/engine/client-helpers';

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
  while (s.bag.length === 0 && guard++ < 40000) tick(s, {}, { online: true });
  return { s, item: s.bag[0] };
}

describe('imprint stone', () => {
  it('an elite or boss kill can pay a per-Mod stone', () => {
    const { s } = piece();
    let guard = 0;
    while (guard++ < 60000 && !Object.keys(s.counters.stones).some((k) => k.startsWith('imprint_'))) {
      tick(s, {}, { online: true });
    }
    const keys = Object.keys(s.counters.stones).filter((k) => k.startsWith('imprint_'));
    expect(keys.length).toBeGreaterThan(0);
    expect(imprintStonesOf(s.counters.stones).length).toBe(keys.length);
  });

  it('one stone rewrites one Unbound line with a fresh roll, clearing the baseline', () => {
    const { s, item } = piece();
    const idx = item.lines.findIndex((_, i) => i >= craft.UNTOUCHABLE);
    expect(idx).toBeGreaterThanOrEqual(craft.UNTOUCHABLE);
    const carried = new Set(item.lines.map((l) => l.id));
    const target = ['critical_chance', 'attack_speed', 'accuracy'].find((id) => !carried.has(id))!;
    expect(target).toBeTruthy();
    s.counters.stones = { ...s.counters.stones, ['imprint_' + target]: 1 };
    const before = s.bag[0].lines[idx].id;
    const r = doCraft(s, 'bag', 0, 'imprint', idx, seed(7), target);
    expect(r.ok).toBe(true);
    expect(s.bag[0].lines[idx].id).toBe(target);
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
      tick(s, {}, { online: true });
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
