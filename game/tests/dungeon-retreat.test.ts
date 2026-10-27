import { describe, expect, it } from 'vitest';
import { E } from '../src/engine/client';
import { mulberry32 } from '../src/engine/client-helpers';
import { selectDungeonRescue } from '../../engine/dungeon-rescue';
import { catchUp, catchUpAsync, newGame, retreatDungeon, tick } from '../src/sim/core/game';
import { cooldownLeft, enterDungeon } from '../src/sim/world/dungeon';
import { slotsAvailable, slotsUsed } from '../src/sim/gear/slots';
import type { Item } from '../src/sim/core/types';

function entered(seed = 47) {
  const state = newGame(seed);
  expect(enterDungeon(state)).toEqual({ ok: true });
  return state;
}

const piece = (): Item => ({ slot: 'helmet', base: 'coif', ilvl: 1, quality: 'low', tier: 'T3', lines: [], q: 0, locked: true });

function unchanged<T>(state: ReturnType<typeof newGame>, action: () => T): T {
  const before = structuredClone(state);
  const result = action();
  expect(state).toEqual(before);
  return result;
}

describe('Dungeon Retreat state and payouts', () => {
  it('exits an empty run without consuming RNG and starts the full cooldown', () => {
    const state = entered();
    const rng = state.rngState;
    expect(retreatDungeon(state)).toEqual({ ok: true, selected: 0, received: 0, rejected: 0 });
    expect(state.rngState).toBe(rng);
    expect(state.dungeon).toBeNull();
    expect(state.group).toEqual([]);
    expect(state.hunting).toBe(false);
    expect(state.dungeonClearedAt).toBe(state.clockSec);
    expect(cooldownLeft(state)).toBe(E.dungeon.cooldown_sec);
    expect(enterDungeon(state).why).toMatch(/cooling/);
  });

  it('refuses read-only access and absent runs without any mutation', () => {
    const state = entered();
    state.dungeon!.escrow.stones.tier = 1;
    expect(unchanged(state, () => retreatDungeon(state, { writer: false })).ok).toBe(false);
    const idle = newGame(49);
    expect(unchanged(idle, () => retreatDungeon(idle)).ok).toBe(false);
  });

  it.each([-1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('refuses invalid escrow count %s before RNG or detachment', (count) => {
    const state = entered();
    state.dungeon!.escrow.stones.tier = count;
    expect(unchanged(state, () => retreatDungeon(state)).ok).toBe(false);
  });

  it('keeps the rescued gear object through ordinary filter adjudication', () => {
    const state = entered(), item = piece();
    state.dungeon!.escrow.items.push(item);
    const result = retreatDungeon(state);
    expect(result).toEqual({ ok: true, selected: 1, received: 1, rejected: 0 });
    expect(state.bag.find((held) => held === item)).toBe(item);
    expect(item.locked).toBe(true);
  });

  it('applies the existing automatic salvage floor to selected unlocked gear', () => {
    const state = entered(), item = { ...piece(), locked: false };
    state.autoDissolveLevel = item.ilvl + 1;
    state.dungeon!.escrow.items = [item];
    const salvaged = state.counters.salvaged || 0;
    expect(retreatDungeon(state)).toEqual({ ok: true, selected: 1, received: 1, rejected: 0 });
    expect(state.bag).not.toContain(item);
    expect(state.counters.salvaged).toBe(salvaged + 1);
  });

  it('rescues a materials escrow entry into the character materials, or reports the capacity refusal', () => {
    const state = entered();
    state.dungeon!.escrow.materials.scrap = 4;
    const before = state.fieldwork.materials.scrap || 0;
    expect(retreatDungeon(state)).toEqual({ ok: true, selected: 4, received: 4, rejected: 0 });
    expect(state.fieldwork.materials.scrap).toBe(before + 4);

    // a stack at the material cap with no free character slot is capacity-rejected, not repaired
    const full = entered(48);
    full.fieldwork.materials.scrap = E.inventory.stack_size.material;
    for (let i = 0; slotsUsed(full) < slotsAvailable(full); i++) full.junk[`filler-${i}`] = 1;
    full.dungeon!.escrow.materials.scrap = 1;
    expect(retreatDungeon(full)).toEqual({ ok: true, selected: 1, received: 0, rejected: 1 });
    expect(full.fieldwork.materials.scrap).toBe(E.inventory.stack_size.material);
    expect(full.dungeon).toBeNull();
  });

  it('pays a selected legal stack once and does not rescue the detached escrow twice', () => {
    const state = entered();
    state.dungeon!.escrow.stones.tier = 7;
    const before = state.counters.stones.tier || 0;
    const result = retreatDungeon(state);
    expect(result).toEqual({ ok: true, selected: 7, received: 7, rejected: 0 });
    expect(state.counters.stones.tier).toBe(before + 7);
    expect(unchanged(state, () => retreatDungeon(state)).ok).toBe(false);
  });

  it('uses persisted RNG for a subset of saved entries without rerolling the loot', () => {
    const state = entered(109), item = piece();
    state.dungeon!.escrow.items = [item];
    state.dungeon!.escrow.stones = { tier: 2, reroll_value: 3 };
    state.dungeon!.escrow.herbs = { low: 4 };
    const entries = [
      { bucket: 'items' as const, key: '0'.padStart(16, '0'), count: 1, stackSize: 1, item },
      { bucket: 'stones' as const, key: 'tier', count: 2, stackSize: E.inventory.stack_size.stone },
      { bucket: 'stones' as const, key: 'reroll_value', count: 3, stackSize: E.inventory.stack_size.stone },
      { bucket: 'herbs' as const, key: 'low', count: 4, stackSize: E.inventory.stack_size.herb },
    ];
    const seed = state.rngState;
    const selected = selectDungeonRescue(entries, { min: E.dungeon.retreat_keep_min, max: E.dungeon.retreat_keep_max }, mulberry32(seed));
    const beforeStones = { ...state.counters.stones }, beforeHerbs = { ...state.farm.herbs };
    const result = retreatDungeon(state);
    expect(result.selected).toBe(selected.reduce((sum, entry) => sum + entry.count, 0));
    expect(state.rngState).toBe(seed + 1);
    for (const entry of entries) {
      const rescued = selected.some((row) => row.bucket === entry.bucket && row.key === entry.key);
      if (entry.bucket === 'items') expect(state.bag.includes(item)).toBe(rescued);
      else if (entry.bucket === 'stones') expect(state.counters.stones[entry.key] || 0).toBe((beforeStones[entry.key] || 0) + (rescued ? entry.count : 0));
      else expect(state.farm.herbs[entry.key] || 0).toBe((beforeHerbs[entry.key] || 0) + (rescued ? entry.count : 0));
    }
  });

  it('rejects a rescued stack whole when the bag is full', () => {
    const state = entered();
    state.counters.stones = { tier: E.inventory.stack_size.stone * slotsAvailable(state) };
    state.farm.herbs = {}; state.farm.potions = {}; state.farm.condensed = {};
    state.fieldwork.materials = {}; state.fieldwork.foods = {}; state.junk = {};
    state.dungeon!.escrow.stones = { reroll_value: 5 };
    const before = structuredClone(state.counters.stones), stopped = state.counters.stopped || 0;
    expect(retreatDungeon(state)).toEqual({ ok: true, selected: 5, received: 0, rejected: 5 });
    expect(state.counters.stones).toEqual(before);
    expect(state.counters.stopped).toBe(stopped + 1);
    expect(state.dungeon).toBeNull();
  });

  it('rejects selected gear through the existing bag capacity rule', () => {
    const state = entered(), item = piece();
    state.bag = Array.from({ length: E.inventory.character_slots }, piece);
    state.dungeon!.escrow.items = [item];
    const before = [...state.bag];
    expect(retreatDungeon(state)).toEqual({ ok: true, selected: 1, received: 0, rejected: 1 });
    expect(state.bag).toEqual(before);
    expect(state.bag).not.toContain(item);
  });

  it('clears stale active combat and target-side stores on Retreat', () => {
    const state = entered();
    tick(state, {});
    expect(state.group.length).toBeGreaterThan(0);
    state.curses = { stale: {} };
    state.mobStatus = { stale: { statuses: {}, alignedPerSec: 0, stoppedSec: 0, elapsedSec: 0 } };
    retreatDungeon(state);
    expect(state.group).toEqual([]);
    expect(state.curses).toEqual(newGame().curses);
    expect(state.mobStatus).toEqual(newGame().mobStatus);
    expect(state.hunting).toBe(false);
  });
});

describe('Dungeon Retreat cooldown and Push regression', () => {
  it('refuses re-entry just before the exact cooldown boundary and permits it at equality', () => {
    const state = entered();
    retreatDungeon(state);
    state.clockSec += E.dungeon.cooldown_sec - 1;
    expect(cooldownLeft(state)).toBe(1);
    expect(unchanged(state, () => enterDungeon(state)).ok).toBe(false);
    state.clockSec++;
    expect(cooldownLeft(state)).toBe(0);
    expect(enterDungeon(state)).toEqual({ ok: true });
  });

  it('keeps remaining cooldown unchanged through matching sync/async offline catch-up', async () => {
    const state = entered();
    retreatDungeon(state);
    for (let i = 0; i < 3; i++) tick(state, {});
    const remaining = cooldownLeft(state);
    const sync = structuredClone(state), asyncState = structuredClone(state);
    const syncResult = catchUp(sync, 2001);
    const asyncResult = await catchUpAsync(asyncState, 2001);
    expect(asyncResult).toEqual(syncResult);
    expect(asyncState).toEqual(sync);
    expect(cooldownLeft(sync)).toBe(remaining);
    expect(enterDungeon(sync).ok).toBe(false);
  });

  it('still forfeits all escrow without a Retreat cooldown when a dungeon Push occurs', () => {
    const state = entered();
    state.dungeon!.escrow.stones = { tier: 7 };
    const before = { ...state.counters.stones };
    state.player.hp = -1e9;
    tick(state, {});
    expect(state.phase).toBe('camp');
    expect(state.dungeon).toBeNull();
    expect(state.counters.stones).toEqual(before);
    expect(state.dungeonClearedAt).toBeUndefined();
    expect(cooldownLeft(state)).toBe(0);
    expect(state.log.some((entry) => /forfeited/.test(entry.text))).toBe(true);
  });
});
