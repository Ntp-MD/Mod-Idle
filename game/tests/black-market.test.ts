import { afterEach, describe, expect, it, vi } from 'vitest';
import { E, TOWN, blackMarket, sm, trade } from '../src/engine/client';
import type { BlackMarketOffer } from '../../engine/black-market';
import { mulberry32 } from '../../engine/loot';
import { newGame, catchUp, catchUpAsync } from '../src/sim/game';
import { blackMarketState, buyBlackMarket, tickBlackMarket } from '../src/sim/black-market';
import { settlementCell, startWalk } from '../src/sim/road';
import { slotsAvailable } from '../src/sim/slots';
import { exportJson, importJson, migrate } from '../src/state/save';

const writer = { writer: true }, readonly = { writer: false };
const tuning = structuredClone(TOWN.black_market);
afterEach(() => { Object.assign(TOWN.black_market, structuredClone(tuning)); vi.restoreAllMocks(); });

function fresh() {
  const state = newGame(111);
  const town = state.town.visited[0];
  state.cell = settlementCell(town)!; state.hunting = false; state.group = [];
  return { state, town };
}
function fixture(kind: BlackMarketOffer['kind']) {
  const { state, town } = fresh();
  tickBlackMarket(state, mulberry32(444), writer, true);
  const candidate = blackMarket.candidates.find((row) => row.kind === kind)!;
  const count = candidate.countMin;
  const stock = state.town.blackMarket[town];
  const offer: BlackMarketOffer = {
    id: `black-market:${town}:${++stock.serial}`, kind, count, remaining: 1, price: blackMarket.price(candidate, count),
    ...(kind === 'material' ? { good: candidate.key } : kind === 'stone' ? { stone: candidate.key } : { skill: candidate.key, level: candidate.level }),
  };
  stock.offers = [offer];
  state.counters.gold = offer.price * 2 + 0.25;
  return { state, town, offer };
}
function unchanged<T>(state: ReturnType<typeof newGame>, action: () => T) {
  const before = JSON.stringify(state), result = action();
  expect(JSON.stringify(state)).toBe(before);
  return result;
}
function fillCharacterBag(state: ReturnType<typeof newGame>) {
  for (const bucket of [state.counters.stones, state.farm.herbs, state.farm.potions, state.farm.condensed,
    state.fieldwork.materials, state.fieldwork.foods, state.junk]) for (const key of Object.keys(bucket)) bucket[key] = 0;
  state.junk.fixture = slotsAvailable(state) * E.inventory.stack_size.stone;
}

describe('Black Market stock and purchases', () => {
  it('creates stock only on the normal writer online path and reads/reloads never reroll it', () => {
    const { state, town } = fresh(), rng = vi.fn(() => 0);
    expect(unchanged(state, () => blackMarketState(state, town))).toBeNull();
    unchanged(state, () => tickBlackMarket(state, rng, readonly, true));
    unchanged(state, () => tickBlackMarket(state, rng, writer, false));
    expect(rng).not.toHaveBeenCalled();
    tickBlackMarket(state, rng, writer, true);
    expect(state.town.blackMarket[town].offers.length).toBeGreaterThan(0);
    const stock = structuredClone(state.town.blackMarket[town]);
    const draws = rng.mock.calls.length;
    unchanged(state, () => { blackMarketState(state, town); blackMarketState(state, town); });
    const loaded = importJson(exportJson(state));
    expect(loaded.town.blackMarket[town]).toEqual(stock);
    expect(rng).toHaveBeenCalledTimes(draws);
  });

  it.each(['material', 'stone'] as const)('commits an exact %s entitlement, frozen Gold price and one unit of stock once', (kind) => {
    const { state, town, offer } = fixture(kind);
    const price = offer.price, beforeGold = state.counters.gold;
    const bucket = kind === 'material' ? state.fieldwork.materials : state.counters.stones;
    const key = kind === 'material' ? trade.byId[offer.good!].key : offer.stone!;
    const beforeCount = bucket[key] || 0;
    TOWN.black_market.resale_cover_multiplier *= 10;
    TOWN.black_market.stones[0].price_gold *= 10;
    expect(buyBlackMarket(state, town, offer.id, writer).ok).toBe(true);
    expect(state.counters.gold).toBe(trade.floorCurrency(beforeGold - price));
    expect(bucket[key] - beforeCount).toBe(offer.count);
    expect(offer.price).toBe(price);
    expect(offer.remaining).toBe(0);
    expect(unchanged(state, () => buyBlackMarket(state, town, offer.id, writer)).ok).toBe(false);
    const loaded = importJson(exportJson(state));
    expect(unchanged(loaded, () => buyBlackMarket(loaded, town, offer.id, writer)).ok).toBe(false);
  });

  it.each(['material', 'stone'] as const)('refuses full-bag %s output without spending Gold or stock', (kind) => {
    const { state, town, offer } = fixture(kind);
    fillCharacterBag(state);
    expect(unchanged(state, () => buyBlackMarket(state, town, offer.id, writer)).ok).toBe(false);
    state.junk.fixture -= E.inventory.stack_size.stone;
    expect(buyBlackMarket(state, town, offer.id, writer).ok).toBe(true);
  });

  it('refuses unaffordable, read-only, absent, wrong-town, walking and recovery purchases unchanged', () => {
    const { state, town, offer } = fixture('material');
    expect(unchanged(state, () => buyBlackMarket(state, town, offer.id, readonly)).ok).toBe(false);
    expect(unchanged(state, () => buyBlackMarket(state, town, 'missing-offer', writer)).ok).toBe(false);
    const sufficient = state.counters.gold; state.counters.gold = Math.max(0, offer.price - 0.01);
    expect(unchanged(state, () => buyBlackMarket(state, town, offer.id, writer)).ok).toBe(false);
    state.counters.gold = sufficient;
    const other = TOWN.settlements.find((row) => row.id !== town)!;
    state.cell = settlementCell(other.id)!;
    expect(unchanged(state, () => buyBlackMarket(state, town, offer.id, writer)).ok).toBe(false);
    state.cell = settlementCell(town)!; state.phase = 'camp';
    expect(unchanged(state, () => buyBlackMarket(state, town, offer.id, writer)).ok).toBe(false);
    state.phase = 'fighting'; startWalk(state, settlementCell(other.id)!);
    expect(unchanged(state, () => buyBlackMarket(state, town, offer.id, writer)).ok).toBe(false);
  });

  it('grants fresh skill ownership at the stored XP Level without ladder duplicates or auto toggles', () => {
    const { state, town, offer } = fixture('skill');
    const toggle = sm.all().find((row) => row.type === 'aura' || row.type === 'buff')!;
    offer.skill = toggle.id; offer.level = E.skill_xp.level_cap;
    delete state.skills.owned[toggle.id]; delete state.skills.xp[toggle.id];
    fillCharacterBag(state); // Skill entitlement needs no character-bag slot.
    expect(buyBlackMarket(state, town, offer.id, writer).ok).toBe(true);
    expect(Object.hasOwn(state.skills.owned, toggle.id)).toBe(true);
    expect(state.skills.owned[toggle.id]).toBe(0);
    expect(state.skills.xp[toggle.id]).toBe(sm.skillXpForLevel(E.skill_xp.level_cap));
    expect(state.skills.buffs[toggle.id]).not.toBe(true);
    expect(state.skills.auras[toggle.id]).not.toBe(true);
  });

  it('upgrades owned skill XP while preserving its Duplicate Ladder and refuses useless or lower offers', () => {
    const { state, town, offer } = fixture('skill'), id = offer.skill!;
    offer.level = E.skill_xp.level_cap;
    state.skills.owned[id] = 4;
    state.skills.xp[id] = sm.skillXpForLevel(offer.level - 1);
    const beforeGold = state.counters.gold;
    expect(buyBlackMarket(state, town, offer.id, writer).ok).toBe(true);
    expect(state.skills.owned[id]).toBe(4);
    expect(state.skills.xp[id]).toBe(sm.skillXpForLevel(offer.level));
    expect(state.counters.gold).toBe(trade.floorCurrency(beforeGold - offer.price));
    offer.remaining = 1;
    expect(unchanged(state, () => buyBlackMarket(state, town, offer.id, writer)).ok).toBe(false);
    offer.level--;
    expect(unchanged(state, () => buyBlackMarket(state, town, offer.id, writer)).ok).toBe(false);
  });

  it('makes authored material, rare stone and maximum XP-level skill routes actually generatable', () => {
    for (const kind of ['material', 'stone', 'skill'] as const) {
      const candidate = blackMarket.candidates.find((row) => row.kind === kind && (kind !== 'skill' || row.level === E.skill_xp.level_cap) && row.weight > 0)!;
      expect(candidate).toBeDefined();
      const pool = blackMarket.candidates.filter((row) => row.weight > 0);
      const total = pool.reduce((sum, row) => sum + row.weight, 0);
      const index = pool.indexOf(candidate);
      const previous = pool.slice(0, index).reduce((sum, row) => sum + row.weight, 0);
      const draws = [(previous + candidate.weight / 2) / total, 0];
      const offer = blackMarket.roll('fixture-town', 0, () => draws.shift() ?? 0)[0];
      expect(offer.kind).toBe(kind);
      if (kind === 'skill') expect(offer.level).toBe(E.skill_xp.level_cap);
      if (kind === 'material') expect(offer.good).toBe(candidate.key);
      if (kind === 'stone') expect(offer.stone).toBe(candidate.key);
    }
  });

  it('prices a material purchase above its maximum ordinary market resale proceeds', () => {
    for (const candidate of blackMarket.candidates.filter((row) => row.kind === 'material')) {
      const good = trade.byId[candidate.key];
      const price = blackMarket.price(candidate, candidate.countMin);
      for (const town of TOWN.settlements) {
        expect(price).toBeGreaterThanOrEqual(trade.quote(town.id, good, candidate.countMin, undefined, 0).gold);
      }
    }
  });
});

describe('Black Market refresh and migration', () => {
  it('refreshes once at the exact online boundary, pausing offline without queued refreshes', () => {
    const { state, town } = fixture('material');
    const initial = structuredClone(state.town.blackMarket[town]);
    const rng = vi.fn(() => 0);
    state.town.blackMarket[town].refreshRemainingSec = 2;
    unchanged(state, () => tickBlackMarket(state, rng, writer, false));
    expect(rng).not.toHaveBeenCalled();
    tickBlackMarket(state, rng, writer, true);
    expect(state.town.blackMarket[town].refreshRemainingSec).toBe(1);
    expect(state.town.blackMarket[town].offers).toEqual(initial.offers);
    expect(rng).not.toHaveBeenCalled();
    tickBlackMarket(state, rng, writer, true);
    const refreshed = state.town.blackMarket[town];
    expect(refreshed.refreshRemainingSec).toBe(blackMarket.C.refresh_interval_sec);
    expect(refreshed.serial).toBeGreaterThan(initial.serial);
    expect(refreshed.offers.every((offer) => !initial.offers.some((old) => old.id === offer.id))).toBe(true);
    const draws = rng.mock.calls.length;
    tickBlackMarket(state, rng, writer, true);
    expect(state.town.blackMarket[town].refreshRemainingSec).toBe(blackMarket.C.refresh_interval_sec - 1);
    expect(rng).toHaveBeenCalledTimes(draws);
  });

  it('keeps towns independent and excludes unvisited towns from refresh draws', () => {
    const { state, town } = fresh();
    const other = TOWN.settlements.find((row) => row.id !== town)!.id;
    const rng = vi.fn(() => 0);
    tickBlackMarket(state, rng, writer, true);
    expect(state.town.blackMarket[other]).toBeUndefined();
    const stock = structuredClone(state.town.blackMarket[town]);
    state.town.visited.push(other);
    tickBlackMarket(state, rng, writer, true);
    expect(state.town.blackMarket[other].refreshRemainingSec).toBe(blackMarket.C.refresh_interval_sec);
    expect(state.town.blackMarket[other].offers.every((offer) => offer.id.includes(other))).toBe(true);
    expect(state.town.blackMarket[town].offers).toEqual(stock.offers);
    expect(state.town.blackMarket[town].refreshRemainingSec).toBe(stock.refreshRemainingSec - 1);
  });

  it('preserves exact saved stock and refresh progress in synchronous and asynchronous catch-up', async () => {
    const { state, town } = fixture('stone');
    state.town.blackMarket[town].refreshRemainingSec = 1;
    const asyncState = structuredClone(state), before = structuredClone(state.town.blackMarket);
    const syncResult = catchUp(state, {}, 37), asyncResult = await catchUpAsync(asyncState, {}, 37);
    expect(syncResult).toEqual(asyncResult);
    expect(asyncState.town.blackMarket).toEqual(state.town.blackMarket);
    expect(state.town.blackMarket).toEqual(before);
    expect(asyncState.rngState).toBe(state.rngState);
    const rng = vi.fn(() => 0);
    tickBlackMarket(state, rng, writer, true);
    expect(state.town.blackMarket[town].refreshRemainingSec).toBe(blackMarket.C.refresh_interval_sec);
  });

  it('backfills old saves without generating stock and preserves existing offers during repeat migration', () => {
    const { state, town } = fresh();
    delete (state.town as any).blackMarket;
    const seed = state.rngState, gold = state.counters.gold;
    migrate(state, 14);
    expect(state.town.blackMarket).toEqual({});
    expect(state.rngState).toBe(seed); expect(state.counters.gold).toBe(gold);
    tickBlackMarket(state, () => 0, writer, true);
    state.town.blackMarket[town].refreshRemainingSec -= 23;
    const before = structuredClone(state.town.blackMarket);
    migrate(state, 14); migrate(state, 14);
    expect(state.town.blackMarket).toEqual(before);
    expect(importJson(exportJson(state)).town.blackMarket).toEqual(before);
  });

  it('refuses malformed remaining stock before charging or granting', () => {
    for (const remaining of [NaN, Infinity, -1, 0.5]) {
      const { state, town, offer } = fixture('material');
      offer.remaining = remaining;
      const before = structuredClone(state);
      expect(buyBlackMarket(state, town, offer.id, writer).ok).toBe(false);
      expect(state).toEqual(before);
    }
  });
});
