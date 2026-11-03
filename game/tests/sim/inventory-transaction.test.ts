import { describe, expect, it } from 'vitest';
import { E } from '../../src/engine/client';
import { newGame } from '@sim/core/game';
import { fitsTransaction, slotsAvailable, type BagCost } from '@sim/gear/slots';

function emptyBag() {
  const state = newGame(19);
  for (const bucket of [state.counters.stones, state.farm.herbs, state.farm.potions,
    state.farm.condensed, state.fieldwork.materials, state.fieldwork.foods, state.junk]) {
    for (const key of Object.keys(bucket)) delete bucket[key];
  }
  return state;
}

function preview(state: ReturnType<typeof newGame>, costs: BagCost[], grants: BagCost[]) {
  const before = JSON.stringify(state);
  const result = fitsTransaction(state, costs, grants);
  expect(JSON.stringify(state)).toBe(before);
  return result;
}

describe('complete bag transaction preview', () => {
  it('refuses two rewards that overflow together even when either fits alone', () => {
    const state = emptyBag();
    state.junk.filler = (slotsAvailable(state) - 1) * E.inventory.stack_size.stone;
    const rewards: BagCost[] = ['tier', 'remove'].map((key) => ({ bucket: state.counters.stones, key, capKind: 'stone', amount: 1 }));
    for (const reward of rewards) expect(preview(state, [], [reward])).toBe(true);
    expect(preview(state, [], rewards)).toBe(false);
  });

  it('uses all slots released by consumed goods for the combined rewards', () => {
    const state = emptyBag();
    state.junk.filler = (slotsAvailable(state) - 2) * E.inventory.stack_size.stone;
    state.fieldwork.materials.ore = 1;
    state.fieldwork.foods.raw_game_meat = 1;
    const costs: BagCost[] = [
      { bucket: state.fieldwork.materials, key: 'ore', capKind: 'material', amount: 1 },
      { bucket: state.fieldwork.foods, key: 'raw_game_meat', capKind: 'food', amount: 1 },
    ];
    const rewards: BagCost[] = ['tier', 'remove'].map((key) => ({ bucket: state.counters.stones, key, capKind: 'stone', amount: 1 }));
    expect(preview(state, [], rewards)).toBe(false);
    expect(preview(state, costs, rewards)).toBe(true);
  });

  it('aggregates same-key costs and grants into their final stack count', () => {
    const state = emptyBag();
    state.junk.filler = (slotsAvailable(state) - 1) * E.inventory.stack_size.stone;
    state.counters.stones.tier = E.inventory.stack_size.stone;
    const change = (amount: number): BagCost => ({ bucket: state.counters.stones, key: 'tier', capKind: 'stone', amount });
    expect(preview(state, [change(2)], [change(1), change(1)])).toBe(true);
    expect(preview(state, [change(1)], [change(1), change(1)])).toBe(false);
    expect(preview(state, [change(E.inventory.stack_size.stone + 1)], [change(1)])).toBe(false);
  });

  it('never funds duplicate costs with grants from the same transaction', () => {
    const state = emptyBag();
    state.fieldwork.materials.ore = 3;
    const change = (amount: number): BagCost => ({ bucket: state.fieldwork.materials, key: 'ore', capKind: 'material', amount });
    expect(preview(state, [change(2), change(2)], [change(10)])).toBe(false);
    expect(preview(state, [change(1), change(2)], [change(1)])).toBe(true);
  });

  it('refuses invalid quantities, cap kinds, foreign buckets and unsafe sums', () => {
    const state = emptyBag();
    const valid: BagCost = { bucket: state.counters.stones, key: 'tier', capKind: 'stone', amount: 1 };
    for (const amount of [-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(preview(state, [], [{ ...valid, amount }])).toBe(false);
      expect(preview(state, [{ ...valid, amount }], [])).toBe(false);
    }
    expect(preview(state, [], [{ ...valid, capKind: 'missing' }])).toBe(false);
    expect(preview(state, [], [{ ...valid, capKind: 'material' }])).toBe(false);
    expect(preview(state, [], [{ ...valid, bucket: {} }])).toBe(false);
    expect(preview(state, [], [{ ...valid, amount: Number.MAX_SAFE_INTEGER }, valid])).toBe(false);
    state.counters.stones.tier = Number.MAX_SAFE_INTEGER;
    expect(preview(state, [], [valid])).toBe(false);
  });

  it('counts kept gear and carried stacks against the same slot pool', () => {
    const state = emptyBag();
    const reward: BagCost = { bucket: state.counters.stones, key: 'tier', capKind: 'stone', amount: 1 };
    expect(preview(state, [], [reward])).toBe(true);
    state.bag = new Array(slotsAvailable(state)).fill(state.gear[0]);
    expect(preview(state, [], [reward])).toBe(false);
    state.bag = [];
    state.junk.filler = slotsAvailable(state) * E.inventory.stack_size.stone;
    expect(preview(state, [], [reward])).toBe(false);
  });
});
