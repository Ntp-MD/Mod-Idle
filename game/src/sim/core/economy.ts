import { createEconomy, type EconomyCfg, type EconomyPlayerCfg, type SaleQuote } from '../../../../engine/economy.ts';
import type { TradeGood } from '../../../../engine/trade.ts';
import { TOWN, trade } from '../../engine/client';
import type { GameEconomy, GameState } from './types';

/**
 * The live seam for the city ledger. The config is `town.json → economy`; the state is plain JSON so
 * it travels in the save; one world second advances one economy second, and a step is only taken once
 * `step_sec` whole seconds have gathered — so the ledger clock never drifts from the world clock and
 * the offline catch-up lands on the same state as online ticks. Player sales route through
 * `economyOffer` in ledger cities; every other settlement keeps the plain market path.
 */
const cfg = (): EconomyCfg => (TOWN as any).economy as EconomyCfg;
const EMPTY_PLAYER: EconomyPlayerCfg = { stock: {}, gold: 0, credit: 0 };
const CITY_IDS: ReadonlySet<string> = new Set(
  ((TOWN as any).economy?.cities ?? []).map((city: { id: string }) => city.id),
);

/** Does this settlement carry a ledger city? Other towns stay on the plain market path. */
export const economyCity = (town: string): boolean => CITY_IDS.has(town);

/** The purse the engine sees: one `bucket:key` pair per carried trade good. */
const wallet = (s: GameState): EconomyPlayerCfg => {
  const stock: Record<string, number> = {};
  const pools: Array<[TradeGood['bucket'], Record<string, number>]> = [
    ['material', s.fieldwork.materials],
    ['food', s.fieldwork.foods],
    ['herb', s.farm.herbs],
    ['junk', s.junk],
  ];
  for (const [bucket, pool] of pools) for (const [key, count] of Object.entries(pool)) {
    const id = `${bucket}:${key}`;
    if (count > 0 && trade.byId[id]) stock[id] = count;
  }
  return { stock, gold: 0, credit: s.town.marketCredit || 0 };
};

export interface EconomySplit { cityUnits: number; eventUnits: number; basicUnits: number; cityGold: number; basicGold: number }
export interface EconomyOffer { ok: boolean; why?: string; preview?: SaleQuote; sell?: () => EconomySplit }

/**
 * What one of the ledger cities would pay for `count` of one trade good, split into the city channel
 * (demand/capacity/budget capped) and the basic floor channel. `sell` commits the city side and
 * mirrors the refreshed supply row into the plain market view; gold and haggling stay sim-side.
 * With `assumeCarried` the quote ignores what the bag holds — remote-market rows quote a phantom
 * load, the same way plain towns quote without stock.
 */
export function economyOffer(state: GameState, town: string, goodId: string, count: number, assumeCarried = false): EconomyOffer {
  const refused = (why: string): EconomyOffer => ({ ok: false, why });
  if (!state.economy || !economyCity(town)) return refused('this settlement has no city ledger');
  const purse = wallet(state);
  if (assumeCarried) purse.stock[goodId] = Math.max(purse.stock[goodId] || 0, count);
  const economy = createEconomy(cfg(), trade, purse, state.economy);
  const preview = economy.quote(town, goodId, count);
  if (!preview.ok) return refused(preview.why || 'the city ledger refuses this sale');
  return {
    ok: true,
    preview,
    sell: () => {
      economy.sell(town, goodId, count);
      const snap = economy.snapshot();
      state.economy.cities = snap.cities;
      state.economy.events = snap.events;
      state.economy.ledger = snap.ledger;
      const group = trade.byId[goodId]!.group;
      const row = snap.cities[town].supply[group];
      if (row) {
        state.town.market ||= {};
        state.town.market[town] ||= {};
        state.town.market[town][group] = { used: row.used, atSec: row.atSec };
      }
      return { cityUnits: preview.cityUnits, eventUnits: preview.eventUnits, basicUnits: preview.basicUnits, cityGold: preview.cityGold, basicGold: preview.basicGold };
    },
  };
}

/** A fresh ledger, or one replayed up to `clockSec` in whole steps, with the remainder carried. */
export function newEconomyState(clockSec = 0): GameEconomy {
  const step = cfg().step_sec;
  const clock = Number.isSafeInteger(clockSec) && clockSec > 0 ? clockSec : 0;
  const nowSec = clock - (clock % step);
  const economy = createEconomy(cfg(), trade, EMPTY_PLAYER);
  economy.advance(nowSec);
  const snapshot = economy.snapshot();
  return {
    nowSec: snapshot.nowSec,
    accumSec: clock - nowSec,
    cities: snapshot.cities,
    events: snapshot.events,
    ledger: snapshot.ledger,
  };
}

/** Refuse a saved ledger the engine cannot hold, naming the field it refused. */
export function validateEconomy(raw: unknown): GameEconomy {
  const row = raw as GameEconomy;
  const step = cfg().step_sec;
  if (!row || typeof row !== 'object') throw new Error('economy: saved ledger is missing');
  if (!Number.isSafeInteger(row.accumSec) || row.accumSec < 0 || row.accumSec >= step) {
    throw new Error(`economy: saved ledger carries ${String(row.accumSec)} of ${step} seconds toward its next step`);
  }
  const economy = createEconomy(cfg(), trade, EMPTY_PLAYER, row);
  const snapshot = economy.snapshot();
  return {
    nowSec: snapshot.nowSec,
    accumSec: row.accumSec,
    cities: snapshot.cities,
    events: snapshot.events,
    ledger: snapshot.ledger,
  };
}

/** One world second. The step itself is the engine's, so the order is the one it already locks. */
export function advanceEconomy(s: GameState): void {
  const eco = s.economy;
  if (!eco) return;
  const step = cfg().step_sec;
  eco.accumSec++;
  if (eco.accumSec < step) return;
  eco.accumSec -= step;
  const economy = createEconomy(cfg(), trade, EMPTY_PLAYER, eco);
  economy.advance(step);
  const snapshot = economy.snapshot();
  eco.nowSec = snapshot.nowSec;
  eco.cities = snapshot.cities;
  eco.events = snapshot.events;
  eco.ledger = snapshot.ledger;
}
