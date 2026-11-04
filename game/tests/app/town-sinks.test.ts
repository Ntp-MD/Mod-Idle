import { describe, expect, it } from 'vitest';
import { TOWN, eng } from '../../src/engine/client';
import { newGame } from '@sim/core/game';
import { buy, canBuy, nextStashTab, priceGold, skipTask, skipVerdict, smithService, stockOf, stashTabCount } from '@sim/town/town';
import { salvageAtSmith } from '@sim/core/game';
import { plotCount } from '@sim/world/farm';
import { settlementCell } from '@sim/world/road';
import { openingGear } from '@sim/core/player';
import { craft } from '@sim/gear/craft';
import { exportJson, importJson } from '../../src/state/save';
import type { Item } from '@sim/core/types';

const inTown = (id: string) => {
  const state = newGame(404);
  state.cell = settlementCell(id)!;
  state.zone = TOWN.settlements.find((town: any) => town.id === id)!.zone;
  state.hunting = false;
  state.group = [];
  state.counters.gold = 100_000;
  return state;
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

  it('offers the next stash tab on the ladder, skipping owned rungs', () => {
    const state = inTown('eastgate');
    expect(nextStashTab(state, 'eastgate')).toBe('stash_tab_1');
    state.town.owned.push('stash_tab_1');
    expect(nextStashTab(state, 'eastgate')).toBe('stash_tab_2');
  });

  it('gates manual salvage on the Armourer smith service', () => {
    expect(smithService(inTown('highspire'))).toMatchObject({ ok: true, settlement: 'highspire' });
    const eastgate = inTown('eastgate');
    expect(smithService(eastgate)).toMatchObject({ ok: false });
    expect(eastgate.cell).toBeTruthy();
    const camp = inTown('highspire');
    camp.phase = 'camp';
    expect(smithService(camp)).toMatchObject({ ok: false, why: 'visit a smith at a settlement' });
  });

  it('dissolves one piece at the smith and refuses locked, held and unfitting bundles', () => {
    const piece = () => ({ slot: 'ring', base: 'Probe', ilvl: 1, quality: 'low', tier: 'T1', lines: [] }) as Item;
    const state = inTown('highspire');
    state.bag = [piece()] as never;
    const oreBefore = state.fieldwork.materials['iron-ore'] || 0;
    expect(salvageAtSmith(state, 0)).toMatchObject({ ok: true });
    expect(state.bag).toHaveLength(0);
    expect(state.fieldwork.materials['iron-ore']).toBe(oreBefore + 1);
    expect(state.fieldwork.materials['scrap']).toBe(1);
    expect(state.counters.salvaged).toBe(1);

    const guarded = inTown('highspire');
    guarded.bag = [piece(), piece()] as never;
    (guarded.bag[0] as Item).locked = true;
    (guarded.bag[1] as Item).heldFor = 'set-x';
    expect(salvageAtSmith(guarded, 0).ok).toBe(false);
    expect(salvageAtSmith(guarded, 1).ok).toBe(false);
    expect(guarded.bag).toHaveLength(2);

    const full = inTown('highspire');
    full.bag = Array.from({ length: 100 }, () => piece()) as never;
    full.fieldwork.materials['iron-ore'] = 100;
    full.fieldwork.materials['scrap'] = 100;
    const salvagedBefore = full.counters.salvaged || 0;
    const refused = salvageAtSmith(full, 0);
    expect(refused.ok).toBe(false);
    expect(full.bag).toHaveLength(100);
    expect(full.fieldwork.materials['iron-ore']).toBe(100);
    expect(full.fieldwork.materials['scrap']).toBe(100);
    expect(full.counters.salvaged || 0).toBe(salvagedBefore);
  });

  it('refuses salvage outside the smith without touching the bag', () => {
    const state = inTown('eastgate');
    state.bag = [{ slot: 'ring', base: 'Probe', ilvl: 1, quality: 'low', tier: 'T1', lines: [] }] as never;
    expect(salvageAtSmith(state, 0).ok).toBe(false);
    expect(state.bag).toHaveLength(1);
  });
});
