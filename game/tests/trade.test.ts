import { describe, expect, it } from 'vitest';
import { E, TOWN, fieldwork, trade } from '../src/engine/client';
import { newGame, tick } from '../src/sim/game';
import { sellGoods, quoteSale, processMaterials, canProcess, marketDestinations } from '../src/sim/trade';
import { sellJunk } from '../src/sim/town';
import { settlementCell, startWalk, arrive } from '../src/sim/road';
import { cookMeal, eatMeal, tickFieldwork } from '../src/sim/fieldwork';
import { exportJson, importJson, migrate } from '../src/state/save';

const inTown = (id = 'eastgate') => {
  const state = newGame(91);
  state.cell = settlementCell(id)!;
  state.zone = TOWN.settlements.find((town) => town.id === id)!.zone;
  state.hunting = false; state.group = [];
  return state;
};

describe('town demand and cargo', () => {
  it('keeps cargo on the route and sells only after arrival at the better buyer', () => {
    const state = inTown(); state.fieldwork.materials.timber = 8;
    const local = quoteSale(state, 'eastgate', 'material:timber', 8)!.gold;
    const offered = quoteSale(state, 'highspire', 'material:timber', 8)!.gold;
    expect(offered).toBeGreaterThan(local);
    expect(startWalk(state, settlementCell('highspire')!).ok).toBe(true);
    expect(state.walk!.blocksTotal).toBeGreaterThan(0);
    expect(sellGoods(state, 'material:timber', 8).ok).toBe(false);
    expect(state.fieldwork.materials.timber).toBe(8);
    arrive(state, state.walk!);
    expect(state.town.visited).toContain('highspire');
    expect(state.zone).toBe(TOWN.settlements.find((town) => town.id === 'highspire')!.zone);
    expect(sellGoods(state, 'material:timber', 8)).toMatchObject({ ok: true, gold: offered, pieces: 8 });
    expect(state.fieldwork.materials.timber).toBe(0);
  });
  it('uses the actual buyer, shared category supply, and independent town demand', () => {
    const state = inTown(); state.fieldwork.materials['copper-ore'] = 100;
    const initial = quoteSale(state, 'eastgate', 'material:copper-ore', 1)!.gold;
    const remote = quoteSale(state, 'highspire', 'material:copper-ore', 1)!.gold;
    expect(initial).toBeGreaterThan(remote);
    expect(sellGoods(state, 'material:copper-ore', 100).ok).toBe(true);
    expect(quoteSale(state, 'eastgate', 'material:copper-ore', 1)!.gold).toBeLessThan(initial);
    expect(quoteSale(state, 'eastgate', 'material:iron-ore', 1)!.demand).toBeLessThan(1);
    expect(quoteSale(state, 'highspire', 'material:copper-ore', 1)!.demand).toBe(1);
    expect(state.town.market.highspire).toBeUndefined();
    state.cell = settlementCell('highspire')!;
    state.fieldwork.materials['iron-ore'] = 1;
    sellGoods(state, 'material:iron-ore', 1);
    expect(state.town.waypoint).toBe('eastgate');
    expect(state.town.market.highspire.ore.used).toBeGreaterThan(0);
  });

  it('pays the same total for one sale or split sales even beyond demand capacity', () => {
    const bulk = inTown(), split = inTown();
    bulk.fieldwork.materials['copper-ore'] = split.fieldwork.materials['copper-ore'] = 500;
    const pay = sellGoods(bulk, 'material:copper-ore', 500);
    for (let i = 0; i < 50; i++) expect(sellGoods(split, 'material:copper-ore', 10).ok).toBe(true);
    expect(split.counters.gold).toBeCloseTo(pay.gold, 9);
    expect(split.town.marketCredit).toBeCloseTo(bulk.town.marketCredit, 9);
    expect(split.town.market).toEqual(bulk.town.market);
    expect(split.fieldwork.materials['copper-ore']).toBe(0);
  });

  it('quotes without mutation and preserves demand and stock through a save round trip', () => {
    const state = inTown(); state.fieldwork.materials['copper-ore'] = 70;
    sellGoods(state, 'material:copper-ore', 10);
    const before = JSON.stringify(state);
    const q = quoteSale(state, 'eastgate', 'material:copper-ore', 60);
    expect(marketDestinations(state, 'material:copper-ore', 60)[0].quote.gold).toBeGreaterThan(0);
    expect(marketDestinations(state, 'material:copper-ore', 60).find((row) => row.town.id === 'eastgate')?.fare).toBe(0);
    expect(JSON.stringify(state)).toBe(before);
    const loaded = importJson(exportJson(state));
    expect(loaded.town.market).toEqual(state.town.market);
    expect(loaded.fieldwork.materials).toEqual(state.fieldwork.materials);
    expect(loaded.counters.gold).toBe(state.counters.gold);
    expect(loaded.town.marketCredit).toBe(state.town.marketCredit);
    expect(quoteSale(loaded, 'eastgate', 'material:copper-ore', 60)).toEqual(q);
  });

  it('recovers only with simulation time and agrees for online and offline ticks', () => {
    const live = inTown(); live.fieldwork.materials['copper-ore'] = 100;
    sellGoods(live, 'material:copper-ore', 100);
    const away = structuredClone(live);
    const before = quoteSale(live, 'eastgate', 'material:copper-ore', 1)!.gold;
    for (let i = 0; i < 60; i++) { tick(live, {}, { online: true }); tick(away, {}, { online: false }); }
    expect(quoteSale(live, 'eastgate', 'material:copper-ore', 1)).toEqual(quoteSale(away, 'eastgate', 'material:copper-ore', 1));
    expect(quoteSale(live, 'eastgate', 'material:copper-ore', 1)!.gold).toBeGreaterThan(before);
    live.clockSec += TOWN.trade.recovery_sec;
    expect(quoteSale(live, 'eastgate', 'material:copper-ore', 1)!.demand).toBe(1);
  });

  it('refuses bad quantities, absent stock and field sales without spending anything', () => {
    const state = inTown(); state.fieldwork.materials['copper-ore'] = 5;
    for (const amount of [-1, 0, 0.5, NaN, Infinity, 6]) {
      const before = JSON.stringify(state);
      expect(sellGoods(state, 'material:copper-ore', amount).ok).toBe(false);
      expect(JSON.stringify(state)).toBe(before);
    }
    state.cell = { q: 1, r: 0, sub: null, wild: null };
    const before = JSON.stringify(state);
    expect(sellGoods(state, 'material:copper-ore', 1).ok).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('quick selling leaves provisions, materials, herbs and unknown legacy junk intact', () => {
    const state = inTown();
    const junk = trade.goods.find((good) => good.bucket === 'junk')!;
    state.junk[junk.key] = 4; state.junk['Unknown legacy keepsake'] = 3;
    state.fieldwork.materials.ore = 5; state.fieldwork.foods.raw_game_meat = 6; state.farm.herbs.low = 7;
    const expected = quoteSale(state, 'eastgate', junk.id, 4)!.gold;
    expect(sellJunk(state)).toEqual({ pieces: 4, gold: expected });
    expect(state.counters.gold).toBe(expected);
    expect(state.junk['Unknown legacy keepsake']).toBe(3);
    expect(state.fieldwork.materials.ore).toBe(5);
    expect(state.fieldwork.foods.raw_game_meat).toBe(6);
    expect(state.farm.herbs.low).toBe(7);
  });

  it('adds current catalogue and market defaults to old saves without losing any counts or XP', () => {
    const old = inTown() as any; delete old.town.market; delete old.town.marketCredit;
    old.fieldwork.materials = { ore: 9, timber: 7, rarewood: 2, keepsake: 1 };
    old.fieldwork.foods.raw_game_meat = 11; old.fieldwork.skills.mining.xp = 123;
    old.counters.gold = 42.25;
    const upgraded = migrate(old, 14);
    expect(upgraded.town.market).toEqual({});
    expect(upgraded.town.marketCredit).toBe(0);
    expect(upgraded.fieldwork.materials).toMatchObject({ ore: 9, timber: 7, rarewood: 2, keepsake: 1, 'copper-ore': 0 });
    expect(upgraded.fieldwork.foods.raw_game_meat).toBe(11);
    expect(upgraded.fieldwork.skills.mining.xp).toBe(123);
    expect(upgraded.counters.gold).toBe(42.25);
    expect(migrate(structuredClone(upgraded), 14)).toEqual(upgraded);
  });
});

describe('regional ingredients and processing', () => {
  it('gathers each zone’s configured bonus while preserving the common resource loop', () => {
    for (const zone of E.mob.zones) {
      for (const kind of ['mine', 'grove'] as const) {
        const state = inTown(); state.zone = zone.id;
        const home = settlementCell(TOWN.settlements.find((town) => town.zone === zone.id)!.id)!;
        state.cell = { q: home.q + 1, r: home.r, sub: null, wild: fieldwork.F.wild_site_index[kind] };
        state.fieldwork.camp = { cell: { ...state.cell }, zone: zone.id };
        state.fieldwork.action = { kind, nextAt: state.clockSec };
        tickFieldwork(state, () => 0);
        const local = fieldwork.F.regional_sources[zone.id];
        expect(state.fieldwork.materials[fieldwork.F.actions[kind].resource]).toBeGreaterThan(0);
        expect(state.fieldwork.materials[local[kind]]).toBeGreaterThan(0);
        if (kind === 'grove') expect(state.fieldwork.foods[local.food]).toBeGreaterThan(0);
      }
    }
  });

  it('processes materials atomically, including bag space freed by consumed ingredients', () => {
    const recipe = fieldwork.F.workshop_recipes[0];
    const state = inTown();
    for (const [id, count] of Object.entries(recipe.materials) as [string, number][]) state.fieldwork.materials[id] = count + 1;
    const inputSlots = Object.keys(recipe.materials).length;
    state.counters.stones.reroll_value = (E.inventory.character_slots - inputSlots) * E.inventory.stack_size.stone;
    const before = JSON.stringify(state);
    expect(canProcess(state, recipe.id).ok).toBe(false);
    expect(processMaterials(state, recipe.id).ok).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
    for (const [id, count] of Object.entries(recipe.materials) as [string, number][]) state.fieldwork.materials[id] = count;
    expect(processMaterials(state, recipe.id).ok).toBe(true);
    expect(state.fieldwork.materials[recipe.id]).toBe(recipe.yield);
    expect(state.fieldwork.skills[recipe.skill as 'mining'].xp).toBe(recipe.xp);
  });

  it('makes every cooking recipe an edible provision with its own active effect', () => {
    for (const recipe of fieldwork.F.recipes) {
      const state = inTown(); state.cell = { q: 1, r: 0, sub: null, wild: 1 };
      state.fieldwork.camp = { cell: { ...state.cell }, zone: state.zone };
      state.fieldwork.skills.cooking.xp = (fieldwork.F.level_cap - 1) ** 2 * fieldwork.F.level_divisor;
      Object.assign(state.fieldwork.foods, recipe.foods);
      Object.assign(state.fieldwork.materials, recipe.materials);
      Object.assign(state.farm.herbs, recipe.herbs);
      expect(cookMeal(state, recipe.id), recipe.name).toEqual({ ok: true });
      expect(eatMeal(state, recipe.id), recipe.name).toEqual({ ok: true });
      expect(state.fieldwork.activeMeal?.id).toBe(recipe.id);
      expect(state.fieldwork.foods[recipe.id]).toBe(0);
      expect(trade.byId[`food:${recipe.id}`].value).toBeGreaterThan(0);
    }
  });
});
