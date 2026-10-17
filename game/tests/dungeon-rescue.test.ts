import { describe, expect, it, vi } from 'vitest';
import { selectDungeonRescue, type DungeonRescueEntry } from '../../engine/dungeon-rescue';
import { mulberry32 } from '../../engine/loot';

const quantity = (key: string, count: number, stackSize = 4): DungeonRescueEntry => ({ bucket: 'stones', key, count, stackSize });

describe('pure dungeon rescue selection', () => {
  it('rescues nothing from empty or zero-quantity escrow without RNG', () => {
    const rng = vi.fn(() => 0);
    expect(selectDungeonRescue([], { min: 1, max: 3 }, rng)).toEqual([]);
    expect(selectDungeonRescue([quantity('tier', 0)], { min: 1, max: 3 }, rng)).toEqual([]);
    expect(rng).not.toHaveBeenCalled();
  });

  it('clamps keep-count to a single available stack and preserves gear identity', () => {
    const item = { id: 'exact-gear', rolledValue: 12.5, locked: false };
    const entry: DungeonRescueEntry<typeof item> = { bucket: 'items', key: item.id, count: 1, stackSize: 1, item };
    const input = Object.freeze([Object.freeze(entry)]);
    const rng = vi.fn(() => 0.75);
    const rescued = selectDungeonRescue(input, { min: 2, max: 5 }, rng);
    expect(rescued).toEqual([entry]);
    expect(rescued[0].item).toBe(item);
    expect(rescued[0]).not.toBe(entry);
    expect(rng).toHaveBeenCalledTimes(2);
  });

  it('splits quantities into legal full and remainder stacks without changing inputs', () => {
    const entries = Object.freeze([Object.freeze(quantity('tier', 10))]);
    const before = JSON.stringify(entries);
    const rescued = selectDungeonRescue(entries, { min: 3, max: 3 }, () => 0);
    expect(rescued.map((entry) => entry.count)).toEqual([4, 4, 2]);
    expect(rescued.reduce((sum, entry) => sum + entry.count, 0)).toBe(10);
    expect(JSON.stringify(entries)).toBe(before);
  });

  it('selects a subset without replacement even when repeated draws collide', () => {
    const entries = ['a', 'b', 'c', 'd'].map((key) => quantity(key, 1));
    const rescued = selectDungeonRescue(entries, { min: 3, max: 3 }, () => 0);
    expect(new Set(rescued.map((entry) => entry.key)).size).toBe(3);
    expect(rescued.every((entry) => entries.some((source) => source.key === entry.key && source.count === entry.count))).toBe(true);
    expect(entries).toHaveLength(4);
  });

  it('normalizes bucket and key order before seeded selection', () => {
    const entries: DungeonRescueEntry[] = [quantity('z', 9), quantity('a', 3), { bucket: 'junk', key: 'z', count: 9, stackSize: 2 }];
    const first = selectDungeonRescue(entries, { min: 2, max: 4 }, mulberry32(1234));
    expect(selectDungeonRescue([...entries].reverse(), { min: 2, max: 4 }, mulberry32(1234))).toEqual(first);
    expect(selectDungeonRescue(entries, { min: 2, max: 4 }, mulberry32(1234))).toEqual(first);
    expect(first.every((entry) => entry.count > 0 && entry.count <= entry.stackSize)).toBe(true);
  });

  it('maps uniform keep-count endpoints and gives every virtual stack a selection interval', () => {
    const entries = ['a', 'b', 'c'].map((key) => quantity(key, 1));
    for (const [draw, expected] of [[0, 1], [0.4, 2], [0.99, 3]]) {
      let countDraw = true;
      const selected = selectDungeonRescue(entries, { min: 1, max: 3 }, () => {
        if (countDraw) { countDraw = false; return draw; }
        return 0;
      });
      expect(selected).toHaveLength(expected);
    }
    for (let index = 0; index < entries.length; index++) {
      const draws = [0, (index + 0.5) / entries.length];
      expect(selectDungeonRescue(entries, { min: 1, max: 1 }, () => draws.shift()!)[0].key).toBe(entries[index].key);
    }
  });

  it('handles huge safe quantities with work proportional to selected stacks', () => {
    const count = Number.MAX_SAFE_INTEGER;
    const rng = vi.fn(() => 0.5);
    const result = selectDungeonRescue([quantity('huge', count, 1)], { min: 2, max: 2 }, rng);
    expect(result).toHaveLength(2);
    expect(result.map((entry) => entry.count)).toEqual([1, 1]);
    expect(rng).toHaveBeenCalledTimes(3);
  });

  it('refuses malformed entries, duplicate identities, unsafe totals and ranges before RNG', () => {
    const valid = quantity('tier', 2);
    const invalidEntries: DungeonRescueEntry[][] = [
      [{ ...valid, count: -1 }], [{ ...valid, count: 0.5 }], [{ ...valid, count: NaN }],
      [{ ...valid, count: Infinity }], [{ ...valid, count: Number.MAX_SAFE_INTEGER + 1 }],
      [{ ...valid, stackSize: 0 }], [{ ...valid, stackSize: 0.5 }], [{ ...valid, stackSize: Infinity }],
      [{ ...valid, bucket: 'unknown' as DungeonRescueEntry['bucket'] }], [{ ...valid, key: '' }],
      [{ ...valid, item: {} }], [{ ...valid, bucket: 'items' }],
      [{ ...valid, bucket: 'items', count: 2, stackSize: 1, item: {} }], [valid, { ...valid }],
      [quantity('a', Number.MAX_SAFE_INTEGER, 1), quantity('b', 1, 1)],
    ];
    const rng = vi.fn(() => 0);
    for (const entries of invalidEntries) expect(() => selectDungeonRescue(entries, { min: 1, max: 2 }, rng)).toThrow(/input/);
    for (const range of [{ min: -1, max: 2 }, { min: 2, max: 1 }, { min: 0.5, max: 2 }, { min: 0, max: Infinity }]) {
      expect(() => selectDungeonRescue([valid], range, rng)).toThrow(/input/);
    }
    expect(rng).not.toHaveBeenCalled();
  });

  it('permits an authored zero rescue range and rejects invalid RNG values', () => {
    const rng = vi.fn(() => 0);
    expect(selectDungeonRescue([quantity('tier', 1)], { min: 0, max: 0 }, rng)).toEqual([]);
    expect(rng).toHaveBeenCalledTimes(1);
    for (const value of [-0.1, 1, NaN, Infinity]) {
      expect(() => selectDungeonRescue([quantity('tier', 1)], { min: 1, max: 1 }, () => value)).toThrow(/RNG/);
    }
  });
});
