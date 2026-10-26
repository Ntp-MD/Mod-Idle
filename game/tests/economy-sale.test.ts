import { describe, expect, it } from 'vitest';
import { TOWN } from '../src/engine/client';
import { newGame } from '../src/sim/core/game';
import { settlementCell } from '../src/sim/world/road';
import { trade, sellGoods, quoteSale, tradeBucket } from '../src/sim/town/trade';
import { economyCity } from '../src/sim/core/economy';

const STAND = (id: string) => settlementCell(id)!;
const gold = (value: number) => value.toFixed(TOWN.trade.currency_decimals);
const settle = (s: any, cityGold: number, basicGold: number) => trade.settleCurrency(
  (cityGold + basicGold) * trade.haggling(s.town.hagglingXp).saleMult, s.town.marketCredit || 0,
);
const plain = () => TOWN.settlements.map(t => t.id).find(id => !economyCity(id) && TOWN.trade.towns[id as keyof typeof TOWN.trade.towns])!;

describe('selling into a ledger city', () => {
  it('splits the sale: demand units enter city stock and pay the budget, the rest sells at floor', () => {
    const s = newGame(21);
    s.cell = STAND('highspire');
    s.fieldwork.materials['copper-ore'] = 20;
    const result = sellGoods(s, 'material:copper-ore', 20);
    expect(result.ok).toBe(true);
    expect(result.cityUnits).toBe(12);
    expect(result.basicUnits).toBe(8);
    const city = s.economy.cities.highspire;
    expect(city.stock['material:copper-ore']).toBe(30);
    // The first sale also activates the 0 s road event, which grants its 60 gold from the data.
    expect(city.budget).toBeCloseTo(90 + 60 - result.cityGold!, 9);
    expect(result.basicGold).toBeCloseTo(Number(gold(8 * trade.byId['material:copper-ore'].value * TOWN.trade.floor_mult)), 9);
    expect(settle(s, result.cityGold!, result.basicGold!).gold).toBeCloseTo(result.gold, 9);
    expect(s.fieldwork.materials['copper-ore']).toBe(0);
    expect(s.counters.gold).toBeGreaterThan(0);
    expect(s.economy.ledger.soldToCity['material:copper-ore']).toBe(12);
    expect(s.economy.ledger.soldBasic['material:copper-ore']).toBe(8);
  });

  it('keeps the market supply row in step with the ledger', () => {
    const s = newGame(22);
    s.cell = STAND('highspire');
    s.fieldwork.materials['copper-ore'] = 4;
    sellGoods(s, 'material:copper-ore', 4);
    const row = s.town.market.highspire[trade.byId['material:copper-ore'].group];
    expect(row).toEqual(s.economy.cities.highspire.supply[trade.byId['material:copper-ore'].group]);
    expect(row.used).toBeGreaterThan(0);
  });

  it('drains an event window when normal demand is spent first', () => {
    const s = newGame(23);
    s.cell = STAND('highspire');
    s.fieldwork.materials.timber = 20;
    const event = () => s.economy.events.find(row => row.id === 'mine-road-repair')!;
    sellGoods(s, 'material:timber', 10);
    expect(event().filled).toBe(0);
    const pile = sellGoods(s, 'material:timber', 5);
    expect(pile.cityUnits).toBe(5);
    expect(pile.eventUnits).toBe(5);
    expect(event().filled).toBe(5);
    expect(quoteSale(s, 'highspire', 'material:timber', 3)).toMatchObject({
      ok: true, normalDemand: 0, eventDemand: 3, cityUnits: 3,
    });
  });

  it('a drained budget caps what the city takes and the excess shifts to the floor', () => {
    const s = newGame(24);
    s.cell = STAND('millbrook');
    s.economy.cities.millbrook.budget = 2;
    s.fieldwork.materials['pine-wood'] = 8;
    const result = sellGoods(s, 'material:pine-wood', 8);
    expect(result.ok).toBe(true);
    expect(result.cityUnits).toBeGreaterThan(0);
    expect(result.cityUnits).toBeLessThan(8);
    expect(result.basicUnits).toBe(8 - result.cityUnits!);
    expect(result.cityGold!).toBeLessThanOrEqual(2 + 1e-9);
    expect(s.economy.cities.millbrook.budget).toBeCloseTo(Math.max(0, 2 - result.cityGold!), 9);
  });

  it('quotes what the sale later realizes', () => {
    const s = newGame(25);
    s.cell = STAND('highspire');
    s.fieldwork.materials['iron-ore'] = 7;
    const preview = quoteSale(s, 'highspire', 'material:iron-ore', 7);
    const result = sellGoods(s, 'material:iron-ore', 7);
    expect(preview).toMatchObject({ ok: true, cityUnits: 7, basicUnits: 0, cityGold: result.cityGold });
    expect(preview!.gold).toBeCloseTo(result.gold, 9);
  });

  it('keeps ordinary settlements on the plain market path', () => {
    const s = newGame(26);
    const spot = plain();
    s.cell = STAND(spot);
    s.fieldwork.materials.ore = 5;
    const before = JSON.parse(JSON.stringify(s.economy.cities));
    const result = sellGoods(s, 'material:ore', 5);
    expect(result.ok).toBe(true);
    expect(result.cityUnits).toBeUndefined();
    expect(s.fieldwork.materials.ore).toBe(0);
    expect(s.economy.cities).toEqual(before);
    expect(s.town.market[spot]).toBeTruthy();
  });

  it('refuses the plain ways of selling wrong quantities', () => {
    const s = newGame(27);
    s.cell = STAND('highspire');
    expect(sellGoods(s, 'material:copper-ore', 1).why).toBe('not enough carried');
    expect(sellGoods(s, 'material:copper-ore', 0).why).toBe('choose a whole quantity above zero');
    expect(tradeBucket(s, trade.byId['material:copper-ore'])['copper-ore']).toBe(0);
  });
});
