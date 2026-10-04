import { describe, it, expect } from 'vitest';
import { E, loot } from '../src/engine/client';
import { createCraft } from '../../engine/craft.js';
import { rollDrop } from '../src/sim/drop';
import { doCraft, stoneNames, craft as clientCraft } from '../src/sim/craft';
import { newGame, tick } from '../src/sim/game';
import { mulberry32 } from '../src/engine/client-helpers';

const craft = createCraft(E, loot);

function piece(seed = 1, band = 'low') {
  return rollDrop(mulberry32(seed), band, 1.2);
}

describe('bench prices are the ones crafting.md prints', () => {
  it('each craft costs what engine.json craft says', () => {
    expect(stoneNames('reroll')).toEqual({ reroll_value: E.craft.reroll_value_stones_per_use });
    expect(stoneNames('refine')).toEqual({ tier: E.craft.refine_stones_per_use });
    expect(stoneNames('ascend')).toEqual({ add: E.craft.ascend_add_stones, tier: E.craft.ascend_tier_stones });
    expect(stoneNames('remove')).toEqual({ remove: E.craft.remove_stones_per_use });
    expect(stoneNames('randomize')).toEqual({ tier: 1 });
  });
});

describe('Reroll', () => {
  it('never rolls below the value it already holds, and stays inside the same Tier', () => {
    const item = piece(3);
    const line = item.lines[0];
    const [lo, hi] = loot.rangeOf(line.id, item.q, line.slice);
    let current = item;
    for (let s = 0; s < 200; s++) {
      const r = craft.reroll(current, 0, mulberry32(s));
      expect(r.ok).toBe(true);
      const next = r.item.lines[0];
      expect(next.value).toBeGreaterThanOrEqual(current.lines[0].value);
      expect(next.value).toBeGreaterThanOrEqual(lo);
      expect(next.value).toBeLessThanOrEqual(hi);
      expect(next.slice).toBe(line.slice);
      current = r.item;
    }
    // climbing is bounded: after enough casts the line sits at the top of its slice
    expect(current.lines[0].value).toBe(hi);
  });
});

describe('Refine and Randomize', () => {
  it('Refine pushes one Tier up and stops dead at T1', () => {
    let item = piece(4);
    item = { ...item, lines: item.lines.map((l) => ({ ...l, slice: 2 })) };
    const r = craft.refine(item, 0, mulberry32(1));
    expect(r.ok).toBe(true);
    expect(r.item.lines[0].slice).toBe(1);
    const again = craft.refine({ ...item, lines: item.lines.map((l) => ({ ...l, slice: 0 })) }, 0, mulberry32(1));
    expect(again.ok).toBe(false);
    expect(again.why).toMatch(/already T1/);
  });

  it('the 1-stone roll may land anywhere in the published Tier weights, including lower', () => {
    const item = { ...piece(5), lines: piece(5).lines.map((l) => ({ ...l, slice: 0 })) };
    const seen = new Set<number>();
    for (let s = 0; s < 60; s++) seen.add(craft.randomize(item, 0, mulberry32(s)).item.lines[0].slice);
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('Ascend', () => {
  it('moves the whole piece one quality step and carries every line into the next band', () => {
    const item = piece(6);
    const r = craft.ascend(item, mulberry32(2));
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
    const one = craft.ascend(item, mulberry32(1));
    const two = craft.ascend(one.item, mulberry32(1));
    const three = craft.ascend(two.item, mulberry32(1));
    expect(two.item.q).toBe(one.item.q + 1);
    expect(three.ok).toBe(false);
    expect(three.why).toMatch(/already high/);
  });
});

describe('Remove', () => {
  it('never touches the two Legacy slots', () => {
    for (let s = 0; s < 40; s++) {
      const item = { ...piece(8), lines: [{ id: 'stat_mod_flat', value: 20, slice: 2 }, { id: 'physical_power_flat', value: 70, slice: 2 }, { id: 'attack_speed', value: 20, slice: 2 }] };
      const r = craft.remove(item, mulberry32(s));
      expect(r.ok).toBe(true);
      expect(r.changed.index).toBeGreaterThanOrEqual(craft.LEGACY_SLOTS);
      expect(r.item.lines[0].value).toBe(20);
      expect(r.item.lines[1].value).toBe(70);
    }
  });

  it('refuses a piece that only has Legacy mods left', () => {
    const item = { ...piece(9), lines: [{ id: 'stat_mod_flat', value: 10, slice: 2 }, { id: 'physical_power_flat', value: 20, slice: 2 }] };
    expect(craft.remove(item, mulberry32(1)).ok).toBe(false);
  });
});

describe('Add mod stone', () => {
  const poolFor = (item: any) => {
    const frame = require('../../tools/data/bases.json').bases.find((b: any) => b.name === item.base && b.slot === item.slot);
    return frame ? [...frame.primary, ...frame.secondary, 'stat_mod_flat', 'stat_mod'] : ['physical_power_flat', 'attack_speed', 'stat_mod_flat'];
  };

  it('costs 1 stone then 2, and stops at the Rarity crafted max', () => {
    let item = { ...piece(21), rarity: 'Rare', lines: piece(21).lines.slice(0, 3) };
    expect(craft.costOf('add', item)).toEqual({ add: 1 });
    const one = craft.add(item, poolFor(item), mulberry32(1));
    expect(one.ok).toBe(true);
    item = one.item;
    expect(item.mods_added).toBe(1);
    expect(craft.costOf('add', item)).toEqual({ add: 2 });
    const two = craft.add(item, poolFor(item), mulberry32(2));
    expect(two.ok).toBe(true);
    expect(two.item.lines.length).toBe(item.lines.length + 1);
    const three = craft.add(two.item, poolFor(two.item), mulberry32(3));
    expect(three.ok).toBe(false);
    expect(String(three.why)).toMatch(/2 Add stones/);
  });

  it('never repeats a line the piece already carries', () => {
    const item = { ...piece(22), rarity: 'Rare', lines: [{ id: 'stat_mod_flat', value: 10, slice: 2 }] };
    const seen = new Set<string>();
    for (let s = 0; s < 40; s++) {
      const r = craft.add(item, ['stat_mod_flat', 'max_hp_flat', 'armour_flat'], mulberry32(s));
      if (!r.ok) continue;
      seen.add(r.changed.id);
      expect(r.changed.id).not.toBe('stat_mod_flat');
    }
    expect(seen.size).toBeGreaterThan(0);
  });

  it('a Common stops at 3 Mods and takes at most two Add stones', () => {
    const full = { ...piece(23), rarity: 'Common', lines: [
      { id: 'stat_mod_flat', value: 9, slice: 2 }, { id: 'max_hp_flat', value: 40, slice: 2 }, { id: 'armour_flat', value: 12, slice: 2 },
    ] };
    const atMax = craft.add(full, ['evasion_flat'], mulberry32(1));
    expect(atMax.ok).toBe(false);
    expect(String(atMax.why)).toMatch(/stops at 3 Mods/);
    const base = { ...piece(23), rarity: 'Common', lines: [{ id: 'stat_mod_flat', value: 9, slice: 2 }] };
    const first = craft.add(base, ['max_hp_flat', 'stat_mod'], mulberry32(1));
    expect(first.ok).toBe(true);
    const second = craft.add(first.item, ['max_hp_flat', 'stat_mod'], mulberry32(2));
    expect(second.ok).toBe(true);
    const third = craft.add(second.item, ['max_hp_flat', 'stat_mod'], mulberry32(3));
    expect(third.ok).toBe(false);
    expect(String(third.why)).toMatch(/2 Add stones/);
  });

  it('slots 6-7 stop offering a Stat Mod once the piece holds its two', () => {
    const lines = [
      { id: 'stat_mod_flat', value: 9, slice: 2 }, { id: 'stat_mod', value: 3, slice: 2 },
      { id: 'max_hp_flat', value: 50, slice: 2 }, { id: 'armour_flat', value: 20, slice: 2 },
      { id: 'evasion_flat', value: 10, slice: 2 },
    ];
    const item = { ...piece(24), rarity: 'Rare', q: 0, lines, mods_added: 0 };
    for (let s = 0; s < 25; s++) {
      const r = craft.add(item, ['stat_mod_flat', 'stat_mod', 'cooldown_reduction'], mulberry32(s));
      if (r.ok) expect(['stat_mod_flat', 'stat_mod']).not.toContain(r.changed.id);
    }
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
    const denied = doCraft(s, 'bag', 0, 'reroll', 0, mulberry32(1));
    expect(denied.ok).toBe(false);
    expect(String(denied.why)).toMatch(/needs/);
    s.counters.stones.reroll_value = 8;
    const before = s.bag[0].lines[0].value;
    const ok = doCraft(s, 'bag', 0, 'reroll', 0, mulberry32(1));
    expect(ok.ok).toBe(true);
    expect(s.counters.stones.reroll_value).toBe(0);
    expect(s.bag[0].lines[0].value).toBeGreaterThanOrEqual(before);
  });

  it('has nothing locked and nothing left owing — the ladder is bounded by the line it raises', () => {
    expect(Object.keys(craft.LOCKED)).toEqual([]);
    expect(craft.PENDING_POWER).toEqual({});
    const ceilings = [E.mod_max.armour_flat_t1, E.mod_max.evasion_flat_t1, E.mod_max.energy_shield_flat_t1];
    const full = craft.C.gear_mod_per_level * craft.C.upgrade_cap;
    expect(full).toBe(Math.min(...ceilings)); // D-104 · gate X42 says the same thing from the data side
  });
});
