/**
 * The city ledger prototype for `docs/economy-world-life-ideas.md` §4–§5.
 *
 * This is a pure engine: real per-good stock, a real gold budget, production, consumption,
 * simultaneous inter-city transfers, timed events and one player sale transaction. It is not
 * wired into the live game yet. The test fixture owns the experimental numbers; this file owns
 * only the order and the accounting.
 *
 * Locked step order: activate events → produce → consume → transfer → replenish budgets → advance
 * the clock. A transfer uses the state at the start of the transfer phase, so a unit moved into a
 * city this step cannot leave it again in the same step. Prices come from the existing trade quote.
 */

import type { MarketSupply, TradeGood } from './trade.ts';

export type Units = Record<string, number>;

/** The slice of the shared trade engine this ledger reads; no price formula is copied here. */
export interface EconomyMarket {
  readonly C: { readonly towns: Record<string, unknown>; readonly floor_mult: number };
  readonly byId: Record<string, TradeGood>;
  quote(town: string, good: TradeGood, count: number, supply: MarketSupply | undefined, now: number): { gold: number; used: number; atSec: number };
  floorCurrency(value: number): number;
  settleCurrency(value: number, credit?: number): { gold: number; credit: number };
}

export interface EconomyCityCfg {
  id: string;
  stock: Units;
  capacity: Units;
  target: Units;
  production: Units;
  consumption: Units;
  budget: number;
  budget_cap: number;
  budget_refill: number;
}
export interface EconomyRouteCfg {
  id: string;
  from: string;
  to: string;
  good: string;
  per_step: number;
}
export interface EconomyEventCfg {
  id: string;
  city: string;
  good: string;
  extra_demand: number;
  budget: number;
  startsAtSec: number;
  endsAtSec: number;
}
export interface EconomyCfg {
  step_sec: number;
  cities: EconomyCityCfg[];
  routes: EconomyRouteCfg[];
  events: EconomyEventCfg[];
}
export interface EconomyPlayerCfg {
  stock: Units;
  gold: number;
  credit: number;
}
export interface EconomyLedger {
  produced: Units;
  consumed: Units;
  transferred: Units;
  soldToCity: Units;
  soldBasic: Units;
  wastedProduction: Units;
  unmetConsumption: Units;
  mintedBasic: number;
  mintedBudget: number;
  mintedEvent: number;
}
export interface EconomySnapshot {
  nowSec: number;
  player: EconomyPlayerCfg;
  cities: Record<string, { stock: Units; budget: number; supply: Record<string, MarketSupply> }>;
  events: { id: string; activated: boolean; filled: number }[];
  ledger: EconomyLedger;
}
/** What a save keeps so a ledger can resume where it stopped; `player` is read from the live game. */
export type EconomyRestore = Omit<EconomySnapshot, 'player'>;

export interface SaleQuote {
  ok: boolean;
  why?: string;
  city: string;
  good: string;
  count: number;
  normalDemand: number;
  eventDemand: number;
  capacityFree: number;
  cityUnits: number;
  eventUnits: number;
  basicUnits: number;
  cityGold: number;
  basicGold: number;
  gold: number;
  credit: number;
}

interface EventState {
  cfg: EconomyEventCfg;
  activated: boolean;
  filled: number;
}
interface CityState {
  cfg: EconomyCityCfg;
  stock: Units;
  budget: number;
  supply: Record<string, MarketSupply>;
}

const isUnit = (value: number) => Number.isSafeInteger(value) && value >= 0;
const isMoney = (value: number) => Number.isFinite(value) && value >= 0;
const cloneUnits = (units: Units) => Object.fromEntries(Object.entries(units).map(([key, value]) => [key, value]));
const emptyUnits = (): Units => ({});

function validate(cfg: EconomyCfg, trade: EconomyMarket) {
  if (!Number.isSafeInteger(cfg.step_sec) || cfg.step_sec <= 0) throw new Error('economy: step_sec must be a positive safe integer');
  const cityIds = new Set<string>();
  for (const city of cfg.cities) {
    if (cityIds.has(city.id)) throw new Error(`economy: duplicate city ${city.id}`);
    cityIds.add(city.id);
    if (!Object.hasOwn(trade.C.towns, city.id)) throw new Error(`economy: ${city.id} has no market profile`);
    if (!isMoney(city.budget) || !isMoney(city.budget_cap) || !isMoney(city.budget_refill) || city.budget > city.budget_cap) {
      throw new Error(`economy: ${city.id} has an invalid budget`);
    }
    for (const field of ['stock', 'capacity', 'target', 'production', 'consumption'] as const) {
      for (const [good, value] of Object.entries(city[field])) {
        if (!Object.hasOwn(trade.byId, good)) throw new Error(`economy: ${city.id} names unknown good ${good}`);
        if (!isUnit(value)) throw new Error(`economy: ${city.id}.${field}.${good} must be a nonnegative whole unit`);
      }
    }
    for (const [good, value] of Object.entries(city.stock)) {
      if (value > (city.capacity[good] || 0)) throw new Error(`economy: ${city.id} starts with ${good} above capacity`);
    }
  }
  const routeIds = new Set<string>();
  for (const route of cfg.routes) {
    if (routeIds.has(route.id)) throw new Error(`economy: duplicate route ${route.id}`);
    routeIds.add(route.id);
    if (!cityIds.has(route.from) || !cityIds.has(route.to) || route.from === route.to) throw new Error(`economy: route ${route.id} needs two different cities`);
    if (!Object.hasOwn(trade.byId, route.good)) throw new Error(`economy: route ${route.id} names unknown good ${route.good}`);
    if (!isUnit(route.per_step) || route.per_step === 0) throw new Error(`economy: route ${route.id} needs a positive whole rate`);
  }
  const eventIds = new Set<string>();
  for (const event of cfg.events) {
    if (eventIds.has(event.id)) throw new Error(`economy: duplicate event ${event.id}`);
    eventIds.add(event.id);
    if (!cityIds.has(event.city)) throw new Error(`economy: event ${event.id} names unknown city ${event.city}`);
    if (!Object.hasOwn(trade.byId, event.good)) throw new Error(`economy: event ${event.id} names unknown good ${event.good}`);
    if (!isUnit(event.extra_demand) || !isMoney(event.budget)) throw new Error(`economy: event ${event.id} has invalid demand or budget`);
    if (!Number.isSafeInteger(event.startsAtSec) || !Number.isSafeInteger(event.endsAtSec) || event.startsAtSec < 0 || event.endsAtSec <= event.startsAtSec) {
      throw new Error(`economy: event ${event.id} needs a positive window`);
    }
  }
}

export function createEconomy(
  cfg: EconomyCfg,
  trade: EconomyMarket,
  player: EconomyPlayerCfg = { stock: {}, gold: 0, credit: 0 },
  saved?: EconomyRestore,
) {
  validate(cfg, trade);
  for (const [good, value] of Object.entries(player.stock)) {
    if (!Object.hasOwn(trade.byId, good) || !isUnit(value)) throw new Error(`economy: player stock has invalid good ${good}`);
  }
  if (!isMoney(player.gold) || !isMoney(player.credit)) throw new Error('economy: player gold and credit must be finite and nonnegative');

  const cities = new Map<string, CityState>();
  for (const city of cfg.cities) {
    cities.set(city.id, {
      cfg: city,
      stock: cloneUnits(city.stock),
      budget: city.budget,
      supply: {},
    });
  }
  const events: EventState[] = cfg.events
    .map((event) => ({ cfg: event, activated: false, filled: 0 }))
    .sort((a, b) => a.cfg.startsAtSec - b.cfg.startsAtSec || a.cfg.id.localeCompare(b.cfg.id));
  const ledger: EconomyLedger = {
    produced: emptyUnits(), consumed: emptyUnits(), transferred: emptyUnits(),
    soldToCity: emptyUnits(), soldBasic: emptyUnits(),
    wastedProduction: emptyUnits(), unmetConsumption: emptyUnits(),
    mintedBasic: 0, mintedBudget: 0, mintedEvent: 0,
  };
  const state = {
    nowSec: 0,
    player: { stock: cloneUnits(player.stock), gold: player.gold, credit: player.credit },
  };
  const sortedKeys = (record: Units) => Object.keys(record).sort();

  function cityOf(id: string) {
    const city = cities.get(id);
    if (!city) throw new Error(`economy: unknown city ${id}`);
    return city;
  }
  function hydrate(snapshot: EconomyRestore) {
    if (!Number.isSafeInteger(snapshot.nowSec) || snapshot.nowSec < 0) {
      throw new Error('economy: restored time must be a whole nonnegative second');
    }
    const ids = [...cities.keys()].sort();
    const savedIds = Object.keys(snapshot.cities).sort();
    if (ids.length !== savedIds.length || ids.some((id, index) => id !== savedIds[index])) {
      throw new Error('economy: restored cities do not match the configuration');
    }
    for (const id of ids) {
      const city = cityOf(id);
      const row = snapshot.cities[id]!;
      const stock: Units = {};
      for (const [good, units] of Object.entries(row.stock)) {
        if (!Object.hasOwn(trade.byId, good)) throw new Error(`economy: restored stock names unknown good ${good}`);
        if (!isUnit(units)) throw new Error(`economy: restored stock in ${id} is not a whole unit count`);
        stock[good] = Math.min(units, city.cfg.capacity[good] || 0);
      }
      if (!isMoney(row.budget)) throw new Error(`economy: restored budget in ${id} is not money`);
      const supply: Record<string, MarketSupply> = {};
      for (const [group, entry] of Object.entries(row.supply)) {
        if (!isMoney(entry.used) || !isMoney(entry.atSec)) throw new Error(`economy: restored supply for ${group} in ${id} is invalid`);
        supply[group] = { used: entry.used, atSec: entry.atSec };
      }
      city.stock = stock;
      city.budget = Math.min(city.cfg.budget_cap, row.budget);
      city.supply = supply;
    }
    const known = new Map(events.map((event) => [event.cfg.id, event]));
    const savedEvents = new Set<string>();
    for (const row of snapshot.events) {
      const event = known.get(row.id);
      if (!event) throw new Error(`economy: restored event ${row.id} is not in the configuration`);
      if (savedEvents.has(row.id)) throw new Error(`economy: restored event ${row.id} appears twice`);
      savedEvents.add(row.id);
      if (typeof row.activated !== 'boolean') throw new Error(`economy: restored event ${row.id} has an invalid flag`);
      if (!isUnit(row.filled)) throw new Error(`economy: restored event ${row.id} has an invalid fill`);
      event.activated = row.activated;
      event.filled = Math.min(row.filled, event.cfg.extra_demand);
    }
    const units = (source: Units, label: string) => {
      const copy: Units = {};
      for (const [good, value] of Object.entries(source)) {
        if (!Object.hasOwn(trade.byId, good)) throw new Error(`economy: restored ledger ${label} names unknown good ${good}`);
        if (!isUnit(value)) throw new Error(`economy: restored ledger ${label} is not a whole unit count`);
        copy[good] = value;
      }
      return copy;
    };
    const { ledger: savedLedger } = snapshot;
    ledger.produced = units(savedLedger.produced, 'produced');
    ledger.consumed = units(savedLedger.consumed, 'consumed');
    ledger.transferred = units(savedLedger.transferred, 'transferred');
    ledger.soldToCity = units(savedLedger.soldToCity, 'soldToCity');
    ledger.soldBasic = units(savedLedger.soldBasic, 'soldBasic');
    ledger.wastedProduction = units(savedLedger.wastedProduction, 'wastedProduction');
    ledger.unmetConsumption = units(savedLedger.unmetConsumption, 'unmetConsumption');
    for (const key of ['mintedBasic', 'mintedBudget', 'mintedEvent'] as const) {
      if (!isMoney(savedLedger[key])) throw new Error(`economy: restored ledger ${key} is not money`);
      ledger[key] = savedLedger[key];
    }
    state.nowSec = snapshot.nowSec;
  }

  function activeEvents(cityId: string, good: string, now: number) {
    return events.filter((event) => event.cfg.city === cityId && event.cfg.good === good
      && event.cfg.startsAtSec <= now && now < event.cfg.endsAtSec
      && event.filled < event.cfg.extra_demand);
  }
  function projectedBudget(city: CityState, now: number) {
    let budget = city.budget;
    for (const event of events) {
      if (event.activated || event.cfg.city !== city.cfg.id || event.cfg.startsAtSec > now) continue;
      budget = Math.min(city.cfg.budget_cap, budget + event.cfg.budget);
    }
    return budget;
  }
  function activateEvents(now: number) {
    for (const event of events) {
      if (event.activated || event.cfg.startsAtSec > now) continue;
      const city = cityOf(event.cfg.city);
      const grant = Math.min(event.cfg.budget, city.cfg.budget_cap - city.budget);
      city.budget += grant;
      ledger.mintedEvent += grant;
      event.activated = true;
    }
  }
  function refusal(cityId: string, goodId: string, count: number, why: string): SaleQuote {
    return { ok: false, why, city: cityId, good: goodId, count, normalDemand: 0, eventDemand: 0,
      capacityFree: 0, cityUnits: 0, eventUnits: 0, basicUnits: 0, cityGold: 0, basicGold: 0, gold: 0, credit: state.player.credit };
  }
  function saleCheck(cityId: string, goodId: string, count: number): SaleQuote | null {
    if (!cities.has(cityId)) return refusal(cityId, goodId, count, 'unknown city');
    if (!Object.hasOwn(trade.byId, goodId)) return refusal(cityId, goodId, count, 'unknown good');
    if (!Number.isSafeInteger(count) || count <= 0) return refusal(cityId, goodId, count, 'choose a whole quantity above zero');
    if ((state.player.stock[goodId] || 0) < count) return refusal(cityId, goodId, count, 'not enough carried');
    return null;
  }
  function quote(cityId: string, goodId: string, count: number, now = state.nowSec): SaleQuote {
    const refused = saleCheck(cityId, goodId, count);
    if (refused) return refused;
    const city = cityOf(cityId);
    const good: TradeGood = trade.byId[goodId]!;
    const normalDemand = Math.max(0, (city.cfg.target[goodId] || 0) - (city.stock[goodId] || 0));
    const eventDemand = activeEvents(cityId, goodId, now).reduce((sum, event) => sum + event.cfg.extra_demand - event.filled, 0);
    const capacityFree = Math.max(0, (city.cfg.capacity[goodId] || 0) - (city.stock[goodId] || 0));
    const demandCap = Math.min(count, normalDemand + eventDemand, capacityFree);
    const budget = projectedBudget(city, now);
    const supply = city.supply[good.group];
    const price = (units: number) => units > 0 ? trade.quote(cityId, good, units, supply, now).gold : 0;
    let low = 0, high = demandCap;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (price(middle) <= budget + 1e-9) low = middle;
      else high = middle - 1;
    }
    const cityUnits = low;
    const basicUnits = count - cityUnits;
    const cityGold = price(cityUnits);
    const basicGold = trade.floorCurrency(basicUnits * good.value * trade.C.floor_mult);
    const settled = trade.settleCurrency(cityGold + basicGold, state.player.credit);
    return { ok: true, city: cityId, good: goodId, count, normalDemand, eventDemand, capacityFree,
      cityUnits, eventUnits: Math.max(0, cityUnits - normalDemand), basicUnits, cityGold, basicGold,
      gold: settled.gold, credit: settled.credit };
  }
  function sell(cityId: string, goodId: string, count: number, now = state.nowSec) {
    const refused = saleCheck(cityId, goodId, count);
    if (refused) return refused;
    activateEvents(now);
    const preview = quote(cityId, goodId, count, now);
    if (!preview.ok) return preview;
    const city = cityOf(cityId);
    const good = trade.byId[goodId]!;
    const supply = city.supply[good.group];
    const cityQuote = preview.cityUnits > 0 ? trade.quote(cityId, good, preview.cityUnits, supply, now) : null;
    state.player.stock[goodId] -= count;
    if (state.player.stock[goodId] === 0) delete state.player.stock[goodId];
    if (cityQuote) {
      city.stock[goodId] = (city.stock[goodId] || 0) + preview.cityUnits;
      city.supply[good.group] = { used: cityQuote.used, atSec: cityQuote.atSec };
    }
    city.budget = Math.max(0, city.budget - preview.cityGold);
    ledger.soldToCity[goodId] = (ledger.soldToCity[goodId] || 0) + preview.cityUnits;
    ledger.soldBasic[goodId] = (ledger.soldBasic[goodId] || 0) + preview.basicUnits;
    ledger.mintedBasic += preview.basicGold;
    state.player.gold += preview.gold;
    state.player.credit = preview.credit;
    let eventUnits = preview.eventUnits;
    for (const event of activeEvents(cityId, goodId, now)) {
      if (eventUnits <= 0) break;
      const take = Math.min(eventUnits, event.cfg.extra_demand - event.filled);
      event.filled += take;
      eventUnits -= take;
    }
    return preview;
  }
  function step() {
    activateEvents(state.nowSec);
    const keys = new Map<string, string[]>();
    for (const city of cities.values()) keys.set(city.cfg.id, [...new Set([
      ...sortedKeys(city.cfg.production), ...sortedKeys(city.cfg.consumption),
    ])].sort());
    for (const city of cities.values()) {
      for (const good of keys.get(city.cfg.id)!) {
        const produced = Math.min(city.cfg.production[good] || 0, Math.max(0, (city.cfg.capacity[good] || 0) - city.stock[good]));
        city.stock[good] = (city.stock[good] || 0) + produced;
        ledger.produced[good] = (ledger.produced[good] || 0) + produced;
        ledger.wastedProduction[good] = (ledger.wastedProduction[good] || 0) + (city.cfg.production[good] || 0) - produced;
        const consumed = Math.min(city.cfg.consumption[good] || 0, city.stock[good]);
        city.stock[good] -= consumed;
        ledger.consumed[good] = (ledger.consumed[good] || 0) + consumed;
        ledger.unmetConsumption[good] = (ledger.unmetConsumption[good] || 0) + (city.cfg.consumption[good] || 0) - consumed;
      }
    }
    // Transfer allocation is read from a snapshot: goods received this step cannot move on.
    const snapshot = new Map<string, Units>();
    for (const city of cities.values()) snapshot.set(city.cfg.id, cloneUnits(city.stock));
    const outgoing = new Map<string, Units>();
    const incoming = new Map<string, Units>();
    const add = (map: Map<string, Units>, id: string, good: string, units: number) => {
      map.set(id, { ...(map.get(id) || {}), [good]: ((map.get(id)?.[good]) || 0) + units });
    };
    // NPC deliveries use the same demand as a player sale: the target gap first, then event demand.
    const wanted = new Map<string, Units>();
    const routeGoods = new Set(cfg.routes.map((route) => route.good));
    for (const city of cities.values()) {
      const row: Units = {};
      for (const good of routeGoods) {
        const deficit = Math.max(0, (city.cfg.target[good] || 0) - (snapshot.get(city.cfg.id)![good] || 0));
        row[good] = deficit + activeEvents(city.cfg.id, good, state.nowSec)
          .reduce((sum, event) => sum + event.cfg.extra_demand - event.filled, 0);
      }
      wanted.set(city.cfg.id, row);
    }
    for (const route of [...cfg.routes].sort((a, b) => a.id.localeCompare(b.id))) {
      const from = cityOf(route.from), to = cityOf(route.to);
      const available = (snapshot.get(from.cfg.id)![route.good] || 0) - (outgoing.get(from.cfg.id)?.[route.good] || 0);
      const free = (to.cfg.capacity[route.good] || 0) - (snapshot.get(to.cfg.id)![route.good] || 0) - (incoming.get(to.cfg.id)?.[route.good] || 0);
      const demanded = (wanted.get(to.cfg.id)?.[route.good] || 0) - (incoming.get(to.cfg.id)?.[route.good] || 0);
      const moved = Math.max(0, Math.min(route.per_step, available, free, demanded));
      if (!moved) continue;
      add(outgoing, from.cfg.id, route.good, moved);
      add(incoming, to.cfg.id, route.good, moved);
      ledger.transferred[route.good] = (ledger.transferred[route.good] || 0) + moved;
    }
    for (const [id, goods] of outgoing) for (const [good, units] of Object.entries(goods)) {
      const city = cityOf(id);
      city.stock[good] = (city.stock[good] || 0) - units;
    }
    for (const [id, goods] of incoming) for (const [good, units] of Object.entries(goods)) {
      const city = cityOf(id);
      city.stock[good] = (city.stock[good] || 0) + units;
    }
    for (const [cityId, goods] of incoming) {
      const city = cityOf(cityId);
      for (const [good, received] of Object.entries(goods)) {
        const deficit = Math.max(0, (city.cfg.target[good] || 0) - (snapshot.get(cityId)![good] || 0));
        let extra = Math.max(0, received - deficit);
        for (const event of activeEvents(cityId, good, state.nowSec)) {
          if (extra <= 0) break;
          const take = Math.min(extra, event.cfg.extra_demand - event.filled);
          event.filled += take;
          extra -= take;
        }
      }
    }
    for (const city of cities.values()) {
      const grant = Math.min(city.cfg.budget_refill, city.cfg.budget_cap - city.budget);
      city.budget += grant;
      ledger.mintedBudget += grant;
    }
    state.nowSec += cfg.step_sec;
  }
  function advance(seconds: number) {
    if (!Number.isSafeInteger(seconds) || seconds < 0 || seconds % cfg.step_sec !== 0) {
      throw new Error(`economy: advance must be a whole number of ${cfg.step_sec}s steps`);
    }
    if (seconds === 0) { activateEvents(state.nowSec); return; }
    for (let remaining = seconds; remaining > 0; remaining -= cfg.step_sec) step();
  }
  function snapshot(): EconomySnapshot {
    return {
      nowSec: state.nowSec,
      player: { stock: cloneUnits(state.player.stock), gold: state.player.gold, credit: state.player.credit },
      cities: Object.fromEntries([...cities.entries()].map(([id, city]) => [id, {
        stock: cloneUnits(city.stock), budget: city.budget,
        supply: Object.fromEntries(Object.entries(city.supply).map(([group, row]) => [group, { ...row }])),
      }])),
      events: events.map((event) => ({ id: event.cfg.id, activated: event.activated, filled: event.filled })),
      ledger: {
        produced: cloneUnits(ledger.produced), consumed: cloneUnits(ledger.consumed),
        transferred: cloneUnits(ledger.transferred), soldToCity: cloneUnits(ledger.soldToCity),
        soldBasic: cloneUnits(ledger.soldBasic), wastedProduction: cloneUnits(ledger.wastedProduction),
        unmetConsumption: cloneUnits(ledger.unmetConsumption),
        mintedBasic: ledger.mintedBasic, mintedBudget: ledger.mintedBudget, mintedEvent: ledger.mintedEvent,
      },
    };
  }
  if (saved) hydrate(saved);

  return {
    get nowSec() { return state.nowSec; },
    cities: () => [...cities.keys()],
    stock: (cityId: string, good: string) => cityOf(cityId).stock[good] || 0,
    budget: (cityId: string) => cityOf(cityId).budget,
    player: () => ({ stock: cloneUnits(state.player.stock), gold: state.player.gold, credit: state.player.credit }),
    quote, sell, advance, snapshot,
  };
}

export type Economy = ReturnType<typeof createEconomy>;
