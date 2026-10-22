import { describe, expect, it } from 'vitest';
import { trade, TOWN } from '../src/engine/client';
import { createEconomy, type EconomyCfg, type EconomyPlayerCfg, type Units } from '../../engine/economy';
import { economyFixture, economyPlayer } from '../src/lab/economy';

const STEP = 3600;
const sum = (units: Units) => Object.values(units).reduce((total, value) => total + value, 0);
const totalStock = (snapshot: ReturnType<ReturnType<typeof createEconomy>['snapshot']>) =>
  Object.values(snapshot.cities).reduce((total, city) => total + sum(city.stock), 0) + sum(snapshot.player.stock);
const totalGold = (snapshot: ReturnType<ReturnType<typeof createEconomy>['snapshot']>) =>
  Object.values(snapshot.cities).reduce((total, city) => total + city.budget, 0)
    + snapshot.player.gold + snapshot.player.credit;
const make = (cfg: EconomyCfg = economyFixture(), player: EconomyPlayerCfg = economyPlayer()) =>
  createEconomy(cfg, trade, player);

/** Isolate one city and one good so a sale assertion cannot be moved by another city's phase. */
function single(city: string, good: string) {
  const cfg = economyFixture();
  cfg.events = [];
  cfg.routes = [];
  for (const row of cfg.cities) {
    row.stock = { [good]: 0 };
    row.capacity = { [good]: 100 };
    row.target = { [good]: 0 };
    row.production = {};
    row.consumption = {};
    row.budget = 0;
    row.budget_cap = 1000;
    row.budget_refill = 0;
  }
  const target = cfg.cities.find((row) => row.id === city)!;
  return { cfg, target };
}

describe('city ledger', () => {
  it('draws the playtest economy from town data and hands each reader a fresh copy', () => {
    const cfg = economyFixture();
    const settlements = new Set(TOWN.settlements.map((row) => row.id));
    expect(cfg.cities.length).toBeGreaterThan(0);
    for (const city of cfg.cities) {
      expect(settlements.has(city.id)).toBe(true);
      expect(city.budget).toBeLessThanOrEqual(city.budget_cap);
    }
    expect(() => createEconomy(cfg, trade, economyPlayer())).not.toThrow();
    cfg.cities[0]!.budget = -1;
    cfg.cities[0]!.stock['material:timber'] = 999;
    expect(economyFixture().cities[0]!.budget).toBeGreaterThanOrEqual(0);
    expect(() => make()).not.toThrow();
  });

  it('closes the goods and gold books while every city stays inside its bounds', () => {
    const economy = make();
    const before = economy.snapshot();
    economy.advance(24 * STEP);
    const after = economy.snapshot();
    const config = economyFixture();

    for (const city of config.cities) {
      const row = after.cities[city.id];
      expect(row.budget).toBeGreaterThanOrEqual(0);
      expect(row.budget).toBeLessThanOrEqual(city.budget_cap);
      for (const good of Object.keys(city.capacity)) {
        expect(row.stock[good] || 0).toBeGreaterThanOrEqual(0);
        expect(row.stock[good] || 0).toBeLessThanOrEqual(city.capacity[good]);
      }
    }
    expect(totalStock(after) + sum(after.ledger.consumed) + sum(after.ledger.soldBasic)).toBe(totalStock(before) + sum(after.ledger.produced));
    expect(Object.values(after.ledger.unmetConsumption).every((units) => units === 0)).toBe(true);
    const minted = after.ledger.mintedBasic + after.ledger.mintedBudget + after.ledger.mintedEvent;
    expect(totalGold(after)).toBeCloseTo(totalGold(before) + minted, 8);
    expect(after.nowSec).toBe(24 * STEP);
  });

  it('uses a start-of-phase snapshot so goods cannot cross two cities in one step', () => {
    const { cfg } = single('highspire', 'material:timber');
    cfg.cities.find((city) => city.id === 'highspire')!.stock = { 'material:timber': 10 };
    cfg.cities.find((city) => city.id === 'millbrook')!.capacity = { 'material:timber': 100 };
    cfg.cities.find((city) => city.id === 'emberhold')!.capacity = { 'material:timber': 100 };
    cfg.cities.find((city) => city.id === 'millbrook')!.target = { 'material:timber': 100 };
    cfg.cities.find((city) => city.id === 'emberhold')!.target = { 'material:timber': 100 };
    cfg.routes = [
      { id: 'a-b', from: 'highspire', to: 'millbrook', good: 'material:timber', per_step: 5 },
      { id: 'b-c', from: 'millbrook', to: 'emberhold', good: 'material:timber', per_step: 5 },
    ];
    const economy = createEconomy(cfg, trade, { stock: {}, gold: 0, credit: 0 });
    economy.advance(STEP);
    expect(economy.stock('highspire', 'material:timber')).toBe(5);
    expect(economy.stock('millbrook', 'material:timber')).toBe(5);
    expect(economy.stock('emberhold', 'material:timber')).toBe(0);
    economy.advance(STEP);
    expect(economy.stock('highspire', 'material:timber')).toBe(0);
    expect(economy.stock('millbrook', 'material:timber')).toBe(5);
    expect(economy.stock('emberhold', 'material:timber')).toBe(5);
  });

  it('fills event demand with NPC deliveries, not only with player sales', () => {
    const { cfg } = single('highspire', 'material:timber');
    cfg.cities.find((city) => city.id === 'millbrook')!.stock = { 'material:timber': 10 };
    cfg.cities.find((city) => city.id === 'millbrook')!.capacity = { 'material:timber': 100 };
    cfg.events = [{ id: 'delivery-event', city: 'highspire', good: 'material:timber', extra_demand: 5, budget: 0, startsAtSec: 0, endsAtSec: 10 * STEP }];
    cfg.routes = [{ id: 'forest-mine', from: 'millbrook', to: 'highspire', good: 'material:timber', per_step: 3 }];
    const economy = createEconomy(cfg, trade, { stock: {}, gold: 0, credit: 0 });
    economy.advance(STEP);
    expect(economy.stock('highspire', 'material:timber')).toBe(3);
    expect(economy.snapshot().events[0].filled).toBe(3);
    economy.advance(STEP);
    expect(economy.stock('highspire', 'material:timber')).toBe(5);
    expect(economy.snapshot().events[0].filled).toBe(5);
    economy.advance(STEP);
    expect(economy.stock('highspire', 'material:timber')).toBe(5);
    expect(economy.stock('millbrook', 'material:timber')).toBe(5);
  });

  it('splits one sale into the city channel and the basic channel, and only pays each unit once', () => {
    const { cfg, target } = single('highspire', 'material:timber');
    target.stock = { 'material:timber': 10 };
    target.target = { 'material:timber': 12 };
    target.budget = 1000;
    const economy = createEconomy(cfg, trade, { stock: { 'material:timber': 10 }, gold: 0, credit: 0 });
    const before = economy.snapshot();
    const quote = economy.quote('highspire', 'material:timber', 10);
    expect(quote).toMatchObject({ ok: true, normalDemand: 2, eventDemand: 0, cityUnits: 2, eventUnits: 0, basicUnits: 8 });
    expect(economy.snapshot()).toEqual(before);
    const paid = economy.sell('highspire', 'material:timber', 10);
    expect(paid).toEqual(quote);
    expect(economy.stock('highspire', 'material:timber')).toBe(12);
    expect(economy.player().stock['material:timber']).toBeUndefined();
    expect(economy.snapshot().ledger.soldToCity['material:timber']).toBe(2);
    expect(economy.snapshot().ledger.soldBasic['material:timber']).toBe(8);
    expect(quote.cityUnits + quote.basicUnits).toBe(10);
    expect(economy.budget('highspire')).toBeCloseTo(1000 - quote.cityGold, 8);
    expect(economy.player().gold + economy.player().credit).toBeCloseTo(quote.gold + quote.credit, 8);
  });

  it('reads a good with capacity and target but no starting stock as an empty shelf', () => {
    const economy = make();
    const quote = economy.quote('highspire', 'material:iron-tools', 1);
    expect(quote).toMatchObject({ ok: true, normalDemand: 2, eventDemand: 0, capacityFree: 10, cityUnits: 1, basicUnits: 0 });
    expect(Number.isFinite(quote.gold)).toBe(true);
  });

  it('settles one bulk sale and split sales to the identical ledger', () => {
    const setup = () => {
      const { cfg, target } = single('highspire', 'material:timber');
      target.stock = { 'material:timber': 0 };
      target.target = { 'material:timber': 100 };
      target.budget = 1000;
      return createEconomy(cfg, trade, { stock: { 'material:timber': 10 }, gold: 0, credit: 0 });
    };
    const bulk = setup(), split = setup();
    expect(bulk.sell('highspire', 'material:timber', 10).ok).toBe(true);
    expect(split.sell('highspire', 'material:timber', 5).ok).toBe(true);
    expect(split.sell('highspire', 'material:timber', 5).ok).toBe(true);
    expect(split.stock('highspire', 'material:timber')).toBe(bulk.stock('highspire', 'material:timber'));
    expect(split.budget('highspire')).toBeCloseTo(bulk.budget('highspire'), 8);
    expect(split.snapshot().ledger).toEqual(bulk.snapshot().ledger);
    expect(split.player().gold).toBe(bulk.player().gold);
    expect(split.player().credit).toBeCloseTo(bulk.player().credit, 9);
  });

  it('stops the city at its real budget and sends the rest through the basic channel', () => {
    const { cfg, target } = single('highspire', 'material:timber');
    target.stock = { 'material:timber': 0 };
    target.target = { 'material:timber': 100 };
    const one = trade.quote('highspire', trade.byId['material:timber'], 1, undefined, 0).gold;
    target.budget = one;
    target.budget_cap = one;
    const economy = createEconomy(cfg, trade, { stock: { 'material:timber': 5 }, gold: 0, credit: 0 });
    const paid = economy.sell('highspire', 'material:timber', 5);
    expect(paid).toMatchObject({ ok: true, cityUnits: 1, basicUnits: 4 });
    expect(economy.stock('highspire', 'material:timber')).toBe(1);
    expect(economy.budget('highspire')).toBeCloseTo(0, 8);
    expect(economy.snapshot().ledger.mintedBasic).toBeCloseTo(paid.basicGold, 8);
    expect(economy.player().gold + economy.player().credit).toBeCloseTo(paid.gold + paid.credit, 8);
  });

  it('runs an event window, fills its extra demand, keeps its budget and drops the demand at the boundary', () => {
    const { cfg, target } = single('highspire', 'material:timber');
    target.stock = { 'material:timber': 12 };
    target.target = { 'material:timber': 12 };
    cfg.events = [{ id: 'repair', city: 'highspire', good: 'material:timber', extra_demand: 3, budget: 20, startsAtSec: 0, endsAtSec: 2 * STEP }];
    const economy = createEconomy(cfg, trade, { stock: { 'material:timber': 6 }, gold: 0, credit: 0 });
    const first = economy.quote('highspire', 'material:timber', 3);
    expect(first).toMatchObject({ ok: true, normalDemand: 0, eventDemand: 3, cityUnits: 3, eventUnits: 3, basicUnits: 0 });
    expect(economy.snapshot().events[0].activated).toBe(false);
    economy.sell('highspire', 'material:timber', 3);
    expect(economy.snapshot().events[0]).toMatchObject({ activated: true, filled: 3 });
    const second = economy.sell('highspire', 'material:timber', 2);
    expect(second).toMatchObject({ eventDemand: 0, cityUnits: 0, basicUnits: 2 });
    const beforeExpiry = economy.snapshot();
    economy.advance(2 * STEP);
    const afterExpiry = economy.snapshot();
    expect(afterExpiry.events[0]).toMatchObject({ filled: 3 });
    expect(afterExpiry.cities.highspire.stock).toEqual(beforeExpiry.cities.highspire.stock);
    expect(afterExpiry.cities.highspire.budget).toBe(beforeExpiry.cities.highspire.budget);
    const late = economy.quote('highspire', 'material:timber', 1);
    expect(late).toMatchObject({ eventDemand: 0, cityUnits: 0, basicUnits: 1 });
  });

  it('caps an event grant at the city budget ceiling and counts only what was minted', () => {
    const { cfg, target } = single('highspire', 'material:timber');
    target.budget_cap = 10;
    cfg.events = [{ id: 'cap', city: 'highspire', good: 'material:timber', extra_demand: 1, budget: 500, startsAtSec: 0, endsAtSec: STEP }];
    const economy = createEconomy(cfg, trade, { stock: {}, gold: 0, credit: 0 });
    economy.advance(0);
    expect(economy.budget('highspire')).toBe(10);
    expect(economy.snapshot().ledger.mintedEvent).toBe(10);
  });

  it('reaches the same state in one jump and in single steps', () => {
    const jumped = make();
    const stepped = make();
    jumped.advance(12 * STEP);
    for (let step = 0; step < 12; step++) stepped.advance(STEP);
    expect(jumped.snapshot()).toEqual(stepped.snapshot());
  });

  it('rejects a refused sale without changing the clock, stock, budget or event state', () => {
    const economy = make();
    const before = economy.snapshot();
    for (const [city, good, count] of [
      ['no-city', 'material:timber', 1], ['highspire', 'material:nope', 1], ['highspire', 'material:timber', 0],
      ['highspire', 'material:timber', -1], ['highspire', 'material:timber', 1.5], ['highspire', 'material:timber', Number.NaN],
      ['highspire', 'material:timber', 999],
    ] as const) {
      expect(economy.sell(city, good, count).ok).toBe(false);
      expect(economy.snapshot()).toEqual(before);
    }
  });

  it('resumes a saved ledger on the same state and steps it identically', () => {
    const cfg = economyFixture();
    const live = make(cfg);
    live.advance(7 * STEP);
    expect(live.sell('highspire', 'material:timber', 2).ok).toBe(true);
    const saved = live.snapshot();
    const resumed = createEconomy(cfg, trade, live.player(), saved);
    expect(resumed.snapshot()).toEqual(saved);
    live.advance(3 * STEP);
    resumed.advance(3 * STEP);
    expect(resumed.snapshot()).toEqual(live.snapshot());
    expect(resumed.quote('highspire', 'material:timber', 2)).toEqual(live.quote('highspire', 'material:timber', 2));
  });

  it('rejects a restored ledger whose shape does not match the configuration', () => {
    const cfg = economyFixture();
    const live = make(cfg);
    live.advance(STEP);
    const saved = live.snapshot();
    const restore = (mutate: (state: typeof saved) => void) => {
      const copy = structuredClone(saved);
      mutate(copy);
      return () => createEconomy(cfg, trade, economyPlayer(), copy);
    };
    expect(restore((state) => { delete state.cities.millbrook; })).toThrow('cities do not match');
    expect(restore((state) => { state.cities.highspire.budget = -1; })).toThrow('budget');
    expect(restore((state) => { state.cities.highspire.stock['material:timber'] = 1.5; })).toThrow('whole unit');
    expect(restore((state) => { state.events[0]!.id = 'not-an-event'; })).toThrow('not in the configuration');
    expect(restore((state) => { state.nowSec = -1; })).toThrow('restored time');
  });

  it('refuses a partial step instead of silently discarding time', () => {
    const economy = make();
    const before = economy.snapshot();
    expect(() => economy.advance(STEP - 1)).toThrow('whole number');
    expect(economy.snapshot()).toEqual(before);
  });
});
