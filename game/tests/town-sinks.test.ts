import { describe, expect, it } from 'vitest';
import { TOWN, eng } from '../src/engine/client';
import { newGame } from '../src/sim/core/game';
import { buy, canBuy, priceGold, skipTask, skipVerdict, stockOf, stashTabCount } from '../src/sim/town/town';
import { plotCount } from '../src/sim/world/farm';
import { settlementCell } from '../src/sim/world/road';
import { openingGear } from '../src/sim/core/player';
import { craft } from '../src/sim/gear/craft';
import { exportJson, importJson } from '../src/state/save';
import type { Item } from '../src/sim/core/types';

const inTown = (id: string) => {
  const state = newGame(404);
  state.cell = settlementCell(id)!;
  state.zone = TOWN.settlements.find((town: any) => town.id === id)!.zone;
  state.hunting = false;
  state.group = [];
  state.counters.gold = 100_000;
  return state;
};

const tier = (state: ReturnType<typeof inTown>, settlementId: string, index: number) => {
  const town = TOWN.settlements.find((row: any) => row.id === settlementId)!;
  state.counters.zoneKills[town.zone] = Math.ceil(TOWN.standing.tiers[index].share * eng.SETTLEMENT_BUDGET_KILLS[town.zone]);
};

describe('town sinks', () => {
  it('opens the authored stash and herb-pouch ladders one rung at a time', () => {
    const state = inTown('eastgate');
    expect(stockOf('eastgate', state).map((row: any) => row.id)).toContain('stash_tab_1');
    state.town.owned.push('stash_tab_1');
    expect(stockOf('eastgate', state).map((row: any) => row.id)).toContain('stash_tab_2');
    for (const id of ['stash_tab_2', 'stash_tab_3', 'stash_tab_4', 'stash_tab_5']) state.town.owned.push(id);
    expect(stockOf('eastgate', state).map((row: any) => row.id)).toContain('stash_tab_6');

    const millbrook = inTown('millbrook');
    expect(stockOf('millbrook', millbrook).map((row: any) => row.id)).toContain('herb_pouch_ii');
    millbrook.town.owned.push('herb_pouch_ii');
    expect(stockOf('millbrook', millbrook).map((row: any) => row.id)).toContain('herb_pouch_iii');
  });

  it('charges the Eastgate stash tab at its authored 24-gold teaching price', () => {
    // the row's note and the wiki promise 30 discounted minutes at Eastgate's own low band
    const row = (TOWN.one_time as any[]).find((l) => l.id === 'stash_tab_1');
    expect(priceGold(row, 'eastgate', inTown('eastgate'))).toBe(24);
  });

  it('prices a Waypoint warp at the destination band, as its note and the wiki state', () => {
    const row = (TOWN.repeatable as any[]).find((l) => l.id === 'waypoint_warp');
    const dest = (TOWN.settlements as any[]).find((s) => s.id !== 'eastgate' && s.band !== 'mid');
    const blocks = 7;
    const expected = Math.round(row.m_per_block * blocks * eng.goldPerMinute(dest.band) * 100) / 100;
    expect(priceGold(row, dest.id, inTown('eastgate'), blocks)).toBe(expected);
  });

  it('skips a task once free, then spends a bought token', () => {
    const state = inTown('highspire');
    const template = structuredClone(state.town.tasks[0]!);
    expect(skipVerdict(state, 0)).toMatchObject({ ok: true, free: true });
    expect(skipTask(state, 0).ok).toBe(true);
    expect(state.town.tasks[0]).toBeNull();
    expect(state.town.freeSkipsToday).toBe(1);

    state.town.tasks[1] = structuredClone(template);
    expect(skipVerdict(state, 1).ok).toBe(false);
    expect(buy(state, 'highspire', 'skip_token').ok).toBe(true);
    expect(skipVerdict(state, 1)).toMatchObject({ ok: true, free: false, token: true });
    expect(skipTask(state, 1).ok).toBe(true);
    expect(state.town.tasks[1]).toBeNull();
    expect(state.town.owned).not.toContain('skip_token');
  });

  it('repairs one broken piece for gold without adding a purchased line', () => {
    const state = inTown('highspire');
    const piece = openingGear().find(Boolean) as Item;
    piece.broken = true;
    piece.protection_left = 0;
    state.gear[0] = piece;
    const gold = state.counters.gold;

    const result = buy(state, 'highspire', 'repair');
    expect(result.ok).toBe(true);
    expect(state.gear[0]!.broken).toBe(false);
    expect(state.gear[0]!.protection_left).toBe(craft.C.protection_start);
    expect(state.counters.gold).toBeLessThan(gold);
    expect(state.town.owned).not.toContain('repair');
    expect(buy(state, 'highspire', 'repair').ok).toBe(false);
  });

  it('grants House Ashfall the farm plot its data promises', () => {
    const state = inTown('ashfall');
    tier(state, 'ashfall', 0);
    const before = plotCount(state);
    expect(buy(state, 'ashfall', 'house_ashfall').ok).toBe(true);
    expect(plotCount(state)).toBe(before + 1);
    expect(stashTabCount(state)).toBeGreaterThanOrEqual(2);
  });

  it('records the Collector hint once and refuses a second purchase', () => {
    const state = inTown('bonegate');
    const set = TOWN.collector_sets.find((row: any) => row.settlement === 'bonegate')!;
    expect(state.collector.hints[set.id]).toBeUndefined();
    expect(buy(state, 'bonegate', 'collector_hint').ok).toBe(true);
    expect(state.collector.hints[set.id]).toBe(true);
    expect(canBuy(state, 'bonegate', 'collector_hint').ok).toBe(false);
  });

  it('round-trips the new task-skip and hint state', () => {
    const state = inTown('bonegate');
    const set = TOWN.collector_sets.find((row: any) => row.settlement === 'bonegate')!;
    state.town.freeSkipsToday = 1;
    state.collector.hints[set.id] = true;
    const loaded = importJson(exportJson(state));
    expect(loaded.town.freeSkipsToday).toBe(1);
    expect(loaded.collector.hints[set.id]).toBe(true);
  });
});
