import { describe, it, expect } from 'vitest';
import { E, loot } from '../src/engine/client';
import { createCraft } from '../../engine/craft.ts';
import { rollDrop } from '../src/sim/drop';
import { doCraft, stoneNames, craft as clientCraft } from '../src/sim/craft';
import { newGame, tick } from '../src/sim/game';
import { mulberry32 } from '../src/engine/client-helpers';
import type { Item } from '../src/sim/types';

const craft = createCraft(E, loot);

// `rollDrop` always stamps the quality band (`sim/drop.ts`), so a rolled piece carries a `q` even
// though `Item.q` is optional for hand-built fixtures elsewhere.
function piece(seed = 1, band = 'low'): Item & { q: number } {
  return rollDrop(mulberry32(seed), band, 1.2) as Item & { q: number };
}

type CraftResult = { ok: boolean; why?: string; item?: any; changed?: any };

/** The success branch, typed — throws the refusal's own reason so a failed craft names itself. */
function made(r: CraftResult): { ok: true; item: any; changed: any } {
  if (!r.ok || !r.item) throw new Error(`craft refused: ${r.why ?? 'unknown reason'}`);
  return r as { ok: true; item: any; changed: any };
}

/** The refusal branch, typed — asserts the craft did not succeed. */
function refused(r: CraftResult): { ok: false; why: string } {
  if (r.ok) throw new Error('expected the craft to be refused');
  return { ok: false, why: r.why ?? '' };
}

/** Narrows a craft result to its success branch without throwing, for loops that tolerate a refusal. */
function isMade(r: CraftResult): r is { ok: true; item: any; changed: any } {
  return !!r.ok && r.item !== undefined;
}


describe('Reroll', () => {
  it('never rolls below the value it already holds, and stays inside the same Tier', () => {
    const item = piece(3);
    const line = item.lines[craft.UNTOUCHABLE];
    const [lo, hi] = loot.rangeOf(line.id, item.q, line.slice);
    let current = item;
    for (let s = 0; s < 200; s++) {
      const r = made(craft.reroll(current, craft.UNTOUCHABLE, mulberry32(s)));
      expect(r.ok).toBe(true);
      const next = r.item.lines[craft.UNTOUCHABLE];
      expect(next.value).toBeGreaterThanOrEqual(current.lines[craft.UNTOUCHABLE].value);
      expect(next.value).toBeGreaterThanOrEqual(lo);
      expect(next.value).toBeLessThanOrEqual(hi);
      expect(next.slice).toBe(line.slice);
      current = r.item;
    }
    // climbing is bounded: after enough casts the line sits at the top of its slice
    expect(current.lines[craft.UNTOUCHABLE].value).toBe(hi);
  });

  it('refuses to touch the Base Mod or the Legacy pair', () => {
    const item = piece(3);
    for (let i = 0; i < craft.UNTOUCHABLE; i++) {
      const r = refused(craft.reroll(item, i, mulberry32(1)));
      expect(r.why).toMatch(/cannot be changed/);
    }
  });
});

describe('Refine and Randomize', () => {
  it('Refine pushes one Tier up and stops dead at T1', () => {
    // Not every Mod publishes Tiers — `mods.json` gives `elemental_alignment` and
    // `perfect_dodge_pct` one slice per Item quality band, so no roll can put them above slice 0.
    // Refine reads the slot's own slice count, so the fixture must stand a line that publishes them.
    const rolled = piece(4);
    const slot = rolled.lines.findIndex((l, i) => i >= craft.UNTOUCHABLE && loot.sliceCount(l.id, rolled.q) >= 2);
    expect(slot).toBeGreaterThanOrEqual(craft.UNTOUCHABLE);
    const atWorst = (lines: Item['lines']) => lines.map((l) => ({ ...l, slice: Math.max(0, loot.sliceCount(l.id, rolled.q) - 1) }));
    const item = { ...rolled, lines: atWorst(rolled.lines) };
    const r = made(craft.refine(item, slot, mulberry32(1)));
    expect(r.ok).toBe(true);
    expect(r.item.lines[slot].slice).toBe(item.lines[slot].slice - 1);
    const again = refused(craft.refine({ ...item, lines: item.lines.map((l) => ({ ...l, slice: 0 })) }, slot, mulberry32(1)));
    expect(again.ok).toBe(false);
    expect(again.why).toMatch(/already T1/);
  });

  it('the 1-stone roll may land anywhere in the published Tier weights, including lower', () => {
    const item = { ...piece(5), lines: piece(5).lines.map((l) => ({ ...l, slice: 0 })) };
    const seen = new Set<number>();
    for (let s = 0; s < 60; s++) seen.add(made(craft.randomize(item, craft.UNTOUCHABLE, mulberry32(s))).item.lines[craft.UNTOUCHABLE].slice);
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('Ascend', () => {
  it('moves the whole piece one quality step and carries every line into the next band', () => {
    const item = piece(6);
    const r = made(craft.ascend(item, mulberry32(2)));
    expect(r.ok).toBe(true);
    expect(r.item.q).toBe(item.q + 1);
    for (const line of r.item.lines) {
      const [lo, hi] = loot.rangeOf(line.id, r.item.q, line.slice);
      expect(line.value).toBeGreaterThanOrEqual(lo);
      expect(line.value).toBeLessThanOrEqual(hi);
    }
  });

  it('cannot skip a step and cannot pass high', () => {
    const item = piece(7);
    const one = made(craft.ascend(item, mulberry32(1)));
    const two = made(craft.ascend(one.item, mulberry32(1)));
    const three = refused(craft.ascend(two.item, mulberry32(1)));
    expect(two.item.q).toBe(one.item.q + 1);
    expect(three.ok).toBe(false);
    expect(three.why).toMatch(/already high/);
  });
});

describe('Remove', () => {
  it('never touches the Base Mod or the Legacy pair', () => {
    for (let s = 0; s < 40; s++) {
      const item = { ...piece(8), lines: [
        { id: 'physical_power_flat', value: 70, slice: 2 }, // Base Mod
        { id: 'attack_speed', value: 20, slice: 2 },        // Legacy 1
        { id: 'max_hp_flat', value: 40, slice: 2 },         // Legacy 2
        { id: 'stat_mod_flat', value: 20, slice: 2 },       // Random
        { id: 'armour_flat', value: 12, slice: 2 },         // Random
      ] };
      const r = made(craft.remove(item, mulberry32(s)));
      expect(r.ok).toBe(true);
      expect(r.changed.index).toBeGreaterThanOrEqual(craft.UNTOUCHABLE);
      expect(r.item.lines[0].value).toBe(70);
      expect(r.item.lines[1].value).toBe(20);
      expect(r.item.lines[2].value).toBe(40);
    }
  });

  it('refuses a piece that has only the Base Mod and Legacy pair left', () => {
    const item = { ...piece(9), lines: [
      { id: 'physical_power_flat', value: 70, slice: 2 },
      { id: 'attack_speed', value: 20, slice: 2 },
      { id: 'max_hp_flat', value: 40, slice: 2 },
    ] };
    expect(craft.remove(item, mulberry32(1)).ok).toBe(false);
  });
});

describe('Add mod stone', () => {
  const poolFor = (item: any) => {
    const frame = require('../../tools/data/bases.json').bases.find((b: any) => b.name === item.base && b.slot === item.slot);
    return frame ? [...frame.primary, ...frame.secondary, 'stat_mod_flat'] : ['physical_power_flat', 'attack_speed', 'stat_mod_flat'];
  };

  it('costs 1 stone then 2, and stops at the Rarity crafted max', () => {
    let item = { ...piece(21), rarity: 'Rare', lines: piece(21).lines.slice(0, 3) };
    expect(craft.costOf('add', item)).toEqual({ add: 1 });
    const one = made(craft.add(item, poolFor(item), mulberry32(1)));
    expect(one.ok).toBe(true);
    item = one.item;
    expect(item.mods_added).toBe(1);
    expect(craft.costOf('add', item)).toEqual({ add: 2 });
    const two = made(craft.add(item, poolFor(item), mulberry32(2)));
    expect(two.ok).toBe(true);
    expect(two.item.lines.length).toBe(item.lines.length + 1);
    const three = refused(craft.add(two.item, poolFor(two.item), mulberry32(3)));
    expect(three.ok).toBe(false);
    expect(String(three.why)).toMatch(/2 Add stones/);
  });

  it('never repeats a line the piece already carries', () => {
    const item = { ...piece(22), rarity: 'Rare', lines: [{ id: 'stat_mod_flat', value: 10, slice: 2 }] };
    const seen = new Set<string>();
    for (let s = 0; s < 40; s++) {
      const r = craft.add(item, ['stat_mod_flat', 'max_hp_flat', 'armour_flat'], mulberry32(s));
      if (!isMade(r)) continue;
      seen.add(r.changed.id);
      expect(r.changed.id).not.toBe('stat_mod_flat');
    }
    expect(seen.size).toBeGreaterThan(0);
  });

  it('a Common stops at the same crafted ceiling and takes at most two Add stones', () => {
    const atCeiling = refused(craft.add({ ...piece(23), rarity: 'Common', lines: [
      { id: 'physical_power_flat', value: 70, slice: 2 }, { id: 'attack_speed', value: 20, slice: 2 },
      { id: 'max_hp_flat', value: 40, slice: 2 }, { id: 'armour_flat', value: 12, slice: 2 },
      { id: 'evasion_flat', value: 10, slice: 2 }, { id: 'stat_mod_flat', value: 9, slice: 2 },
      { id: 'cooldown_reduction', value: 8, slice: 2 },
    ] }, ['elemental_power_flat'], mulberry32(1)));
    expect(atCeiling.ok).toBe(false);
    expect(String(atCeiling.why)).toMatch(/stops at 7 Mods/);
    const base = { ...piece(23), rarity: 'Common', lines: [{ id: 'stat_mod_flat', value: 9, slice: 2 }] };
    const first = made(craft.add(base, ['max_hp_flat', 'armour_flat'], mulberry32(1)));
    expect(first.ok).toBe(true);
    const second = made(craft.add(first.item, ['max_hp_flat', 'armour_flat'], mulberry32(2)));
    expect(second.ok).toBe(true);
    const third = refused(craft.add(second.item, ['max_hp_flat', 'armour_flat'], mulberry32(3)));
    expect(third.ok).toBe(false);
    expect(String(third.why)).toMatch(/2 Add stones/);
    // the stone count is the cap, not the line count — the piece still has room to the ceiling
    expect(second.item.lines.length).toBeLessThan(E.rarity.Common.crafted_max);
  });

  // Stat Mod % was retired with Core Stat %, so `stat_mod_flat` is the only Stat Mod line a
  // piece can hold — and once it holds that one, the stone must never offer it again.
  it('a piece stops offering a Stat Mod once it holds the one', () => {
    const lines = [
      { id: 'stat_mod_flat', value: 9, slice: 2 },
      { id: 'max_hp_flat', value: 50, slice: 2 }, { id: 'armour_flat', value: 20, slice: 2 },
      { id: 'evasion_flat', value: 10, slice: 2 },
    ];
    const item = { ...piece(24), rarity: 'Rare', q: 0, lines, mods_added: 0 };
    let offered = 0;
    for (let s = 0; s < 25; s++) {
      const r = craft.add(item, ['stat_mod_flat', 'cooldown_reduction'], mulberry32(s));
      if (!isMade(r)) continue;
      offered++;
      expect(r.changed.id).not.toBe('stat_mod_flat');
    }
    expect(offered).toBeGreaterThan(0); // the loop is not green because nothing ever landed
  });

  it('the bench pays the stone and the client refuses without one', () => {
    const s = newGame(25);
    s.counters.stones.add = 0;
    s.bag.unshift({ ...piece(26), rarity: 'Rare' });
    expect(doCraft(s, 'bag', 0, 'add', 0, mulberry32(1)).ok).toBe(false);
    s.counters.stones.add = 1;
    const before = s.bag[0].lines.length;
    const r = doCraft(s, 'bag', 0, 'add', 0, mulberry32(1));
    expect(r.ok).toBe(true);
    expect(s.bag[0].lines.length).toBe(before + 1);
    expect(s.counters.stones.add).toBe(0);
  });
});

describe('the bench in the game', () => {
  it('pays the stones it charges and refuses when it cannot', () => {
    const s = newGame(21);
    s.counters.stones.reroll_value = 0;
    s.bag.unshift(piece(11));
    const denied = refused(doCraft(s, 'bag', 0, 'reroll', craft.UNTOUCHABLE, mulberry32(1)));
    expect(denied.ok).toBe(false);
    expect(String(denied.why)).toMatch(/needs/);
    s.counters.stones.reroll_value = 8;
    const before = s.bag[0].lines[craft.UNTOUCHABLE].value;
    const ok = doCraft(s, 'bag', 0, 'reroll', craft.UNTOUCHABLE, mulberry32(1));
    expect(ok.ok).toBe(true);
    expect(s.counters.stones.reroll_value).toBe(0);
    expect(s.bag[0].lines[craft.UNTOUCHABLE].value).toBeGreaterThanOrEqual(before);
  });

  it('has nothing locked and nothing left owing — the ladder is bounded by the line it raises', () => {
    // the ceilings the ladder must not out-print are X42's job; this file owns the client's own
    // statement that nothing is locked and nothing is still owed
    expect(Object.keys(craft.LOCKED)).toEqual([]);
    expect(craft.PENDING_POWER).toEqual({});
  });
});
