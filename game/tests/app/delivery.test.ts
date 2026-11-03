import { afterEach, describe, expect, it, vi } from 'vitest';
import { E, TOWN, sm, trade } from '../../src/engine/client';
import { newGame, tick } from '@sim/core/game';
import {
  acknowledgeDelivery, contractById, deliver, deliveryConfig, deliveryPauseReason, normalizeDeliveries,
  offerDelivery, previewDelivery, pruneDeliveries, tickDeliveries, trackDelivery,
} from '@sim/town/delivery';
import type { DeliveryContract } from '@sim/town/delivery-types';
import { newDeliverySummary } from '@sim/town/delivery-types';
import { quoteSale, tradeBucket } from '@sim/town/trade';
import { settlementCell, startWalk } from '@sim/world/road';
import { slotsAvailable } from '@sim/gear/slots';
import { exportJson, importJson, migrate } from '../../src/state/save';

const writer = { writer: true }, readonly = { writer: false };
const configSnapshot = structuredClone(deliveryConfig);
afterEach(() => { Object.assign(deliveryConfig, structuredClone(configSnapshot)); vi.restoreAllMocks(); });

function fresh() {
  const state = newGame(902);
  state.cell = settlementCell(state.town.visited[0])!;
  state.hunting = false; state.group = [];
  return state;
}

// A genuine generated snapshot is cloned into transaction fixtures; tests need not reroll the pool.
const templateState = fresh();
const template = (() => {
  const originalMin = deliveryConfig.count_min, originalMax = deliveryConfig.count_max;
  deliveryConfig.count_min = deliveryConfig.count_max = 3;
  try {
    // the draws follow the offer's roll order: target, count, stone, the skill chance, and the
    // attainment roll last — the last two miss, so the fixture carries no skill and no point
    const draws = [0, 0, 0, 0.99, 0.99];
    const offer = offerDelivery(templateState, templateState.town.visited[0], () => draws.shift() ?? 0, writer);
    if (!offer) throw new Error('delivery fixture could not generate a valid offer');
    return structuredClone(offer);
  } finally { deliveryConfig.count_min = originalMin; deliveryConfig.count_max = originalMax; }
})();

function fixture() {
  const state = fresh();
  const contract = structuredClone(template);
  state.town.contractSerial = contract.serial;
  state.town.contracts[contract.town] = [contract];
  const good = trade.byId[contract.good];
  tradeBucket(state, good)[good.key] = contract.target;
  return { state, contract, good };
}

function unchanged<T>(state: ReturnType<typeof fresh>, action: () => T) {
  const before = JSON.stringify(state);
  const result = action();
  expect(JSON.stringify(state)).toBe(before);
  return result;
}

function terminal(state: ReturnType<typeof fresh>, original: DeliveryContract, status: 'completed' | 'expired', acknowledged = false) {
  const contract = structuredClone(original);
  contract.serial = ++state.town.contractSerial;
  contract.id = `delivery:${contract.town}:${contract.serial}`;
  contract.status = status; contract.terminalAt = state.town.deliveryClockSec;
  contract.recapAcknowledged = acknowledged;
  if (status === 'completed') {
    contract.delivered = contract.target;
    contract.baseGold = 7.25;
    contract.paidBonus = { gold: contract.reward.gold, stones: [structuredClone(contract.reward.stone)], skill: null, fallback: false };
  } else { contract.delivered = 1; contract.baseGold = 2.5; }
  (state.town.contracts[contract.town] ||= []).push(contract);
  return contract;
}

describe('delivery offers and transactions', () => {
  it('freezes the raw quote and rewards independently of carry, later demand and tuning', () => {
    const state = fresh(), town = state.town.visited[0];
    state.town.marketCredit = 0.007;
    const offer = offerDelivery(state, town, () => 0, writer)!;
    const good = trade.byId[offer.good];
    const raw = trade.quote(town, good, offer.target, undefined, state.clockSec);
    expect(offer.reward.quoteGold).toBe(raw.gold);
    expect(offer.reward.gold).toBe(trade.floorCurrency(raw.gold * (offer.reward.premium - 1)));
    const promise = structuredClone(offer.reward);
    state.town.market[town] = { [good.group]: { used: TOWN.trade.capacity_gold, atSec: state.clockSec } };
    deliveryConfig.reward_minutes *= 2; deliveryConfig.premium_base += 2;
    unchanged(state, () => previewDelivery(state, offer.id, 1, writer));
    expect(offer.reward).toEqual(promise);
    const loaded = importJson(exportJson(state));
    expect(contractById(loaded, offer.id)?.reward).toEqual(promise);
  });

  it('pays an attainment point on completion when the roll hit, and none when it missed', () => {
    // the point is frozen into the offer: the player sees the contract before the delivery is paid
    const { state, contract, good } = fixture();
    const hit = structuredClone(contract);
    hit.reward.attainment = 1;
    state.town.contracts[contract.town] = [hit];
    expect(previewDelivery(state, hit.id, hit.target, writer)).toMatchObject({ ok: true, attainment: 1 });
    expect(state.player.attainmentPoints ?? 0).toBe(0);
    expect(deliver(state, hit.id, hit.target, writer).completed).toBe(true);
    expect(state.player.attainmentPoints).toBe(1);

    // and a contract whose roll missed pays nothing
    const other = fresh();
    const missed = structuredClone(contract);
    missed.reward.attainment = 0;
    other.town.contractSerial = missed.serial;
    other.town.contracts[missed.town] = [missed];
    tradeBucket(other, good)[good.key] = missed.target;
    expect(deliver(other, missed.id, missed.target, writer).completed).toBe(true);
    expect(other.player.attainmentPoints ?? 0).toBe(0);
  });

  it('uses distinct monotonic identities for identical wants and releases terminal slots', () => {
    const { state, contract } = fixture();
    expect(offerDelivery(state, contract.town, () => 0, writer)).toBeNull();
    expect(state.town.contractSerial).toBe(contract.serial);
    expect(deliver(state, contract.id, contract.target, writer).ok).toBe(true);
    const second = offerDelivery(state, contract.town, () => 0, writer)!;
    expect(second.good).toBe(contract.good);
    expect(second.id).not.toBe(contract.id);
    expect(second.serial).toBeGreaterThan(contract.serial);
    expect(trackDelivery(state, second.id, true, writer)).toBe(true);
    expect(state.town.trackedContractIds).toEqual([second.id]);
  });

  it('pays each partial delivery at the live market quote and adds the frozen bonus only at completion', () => {
    const { state, contract, good } = fixture();
    const stones = structuredClone(state.counters.stones), startGold = state.counters.gold;
    const first = quoteSale(state, contract.town, good.id, 1)!;
    expect(deliver(state, contract.id, 1, writer)).toMatchObject({ ok: true, completed: false, gold: first.gold });
    expect(state.counters.gold).toBeCloseTo(startGold + first.gold, 10);
    expect(state.counters.stones).toEqual(stones);
    expect(contract.paidBonus).toBeNull();
    state.town.market[contract.town][good.group] = { used: TOWN.trade.capacity_gold, atSec: state.clockSec };
    const remaining = contract.target - 1;
    const second = quoteSale(state, contract.town, good.id, remaining)!;
    expect(deliver(state, contract.id, remaining, writer)).toMatchObject({ ok: true, completed: true, gold: second.gold + contract.reward.gold });
    expect(contract.baseGold).toBeCloseTo(first.gold + second.gold, 10);
    expect(contract.paidBonus?.gold).toBe(contract.reward.gold);
    expect(state.counters.stones[contract.reward.stone.key] - (stones[contract.reward.stone.key] || 0)).toBe(contract.reward.stone.count);
  });

  it('preserves bulk/split proceeds, category demand and currency carry', () => {
    const { state: bulk, contract } = fixture();
    bulk.town.marketCredit = 0.003;
    bulk.town.hagglingXp = trade.hagglingXpForLevel(2) - 1;
    const initialXp = bulk.town.hagglingXp;
    const split = structuredClone(bulk);
    expect(deliver(bulk, contract.id, contract.target, writer).ok).toBe(true);
    for (let i = 0; i < contract.target; i++) expect(deliver(split, contract.id, 1, writer).ok).toBe(true);
    expect(split.counters.gold).toBeCloseTo(bulk.counters.gold, 9);
    expect(split.town.marketCredit).toBeCloseTo(bulk.town.marketCredit, 9);
    const group = trade.byId[contract.good].group;
    expect(split.town.market[contract.town][group].used).toBeCloseTo(bulk.town.market[contract.town][group].used, 12);
    expect(split.town.market[contract.town][group].atSec).toBe(bulk.town.market[contract.town][group].atSec);
    expect(split.counters.stones).toEqual(bulk.counters.stones);
    expect(contractById(split, contract.id)?.baseGold).toBeCloseTo(contract.baseGold, 9);
    expect(bulk.town.hagglingXp).toBe(initialXp + trade.hagglingXp(contract.acquisition.difficulty));
    expect(split.town.hagglingXp).toBe(bulk.town.hagglingXp);
    expect(trade.haggling(split.town.hagglingXp).level).toBeGreaterThan(1);
    unchanged(split, () => deliver(split, contract.id, 1, writer));
  });

  it('applies Haggling to new bonuses while preserving existing promises', () => {
    const state = fresh(), town = state.town.visited[0];
    const old = offerDelivery(state, town, () => 0, writer)!;
    const promised = structuredClone(old.reward);
    state.town.hagglingXp = trade.hagglingXpForLevel(TOWN.trade.haggling.level_cap);
    expect(contractById(state, old.id)?.reward).toEqual(promised);
    const experienced = fresh();
    experienced.town.hagglingXp = state.town.hagglingXp;
    const offer = offerDelivery(experienced, town, () => 0, writer)!;
    expect(offer.good).toBe(old.good);
    expect(offer.reward.premium - 1).toBeCloseTo((old.reward.premium - 1) * trade.haggling(experienced.town.hagglingXp).deliveryMult);
    expect(offer.reward.gold).toBeGreaterThan(old.reward.gold);
    expect(importJson(exportJson(state)).town.contracts[town][0].reward).toEqual(promised);
  });

  it('grants the stored fresh skill without toggling it, then useful duplicates without resetting XP', () => {
    const toggle = sm.all().find((skill) => skill.type === 'buff' || skill.type === 'aura')!;
    const first = fixture(); first.contract.reward.skill = toggle.id;
    delete first.state.skills.owned[toggle.id];
    expect(deliver(first.state, first.contract.id, first.contract.target, writer).ok).toBe(true);
    expect(Object.hasOwn(first.state.skills.owned, toggle.id)).toBe(true);
    expect(first.state.skills.owned[toggle.id]).toBe(0);
    expect(first.state.skills.buffs[toggle.id]).not.toBe(true);
    expect(first.state.skills.auras[toggle.id]).not.toBe(true);
    expect(first.contract.paidBonus).toMatchObject({ skill: toggle.id, fallback: false });
    const timed = sm.all().find((skill) => (skill.cd ?? 0) > 0)!;
    const second = fixture(); second.contract.reward.skill = timed.id;
    second.state.skills.owned[timed.id] = 0; second.state.skills.xp[timed.id] = 123;
    expect(deliver(second.state, second.contract.id, second.contract.target, writer).ok).toBe(true);
    expect(second.state.skills.owned[timed.id]).toBe(1);
    expect(second.state.skills.xp[timed.id]).toBe(123);
  });

  it('pays the exact saved fallback when the promised skill caps during the offer', () => {
    const { state, contract } = fixture();
    const skill = sm.all().find((row) => (row.cd ?? 0) > 0)!;
    contract.reward.skill = skill.id;
    const promise = structuredClone(contract.reward);
    state.skills.owned[skill.id] = sm.LADDER_MAX_DUPLICATES;
    deliveryConfig.fallback_minutes *= 7;
    const before = structuredClone(state.counters.stones);
    const random = vi.spyOn(Math, 'random');
    expect(deliver(state, contract.id, contract.target, writer).ok).toBe(true);
    expect(random).not.toHaveBeenCalled();
    expect(contract.reward).toEqual(promise);
    expect(contract.paidBonus).toMatchObject({ skill: null, fallback: true });
    const expected = structuredClone(before);
    for (const grant of [promise.stone, promise.fallback]) expected[grant.key] = (expected[grant.key] || 0) + grant.count;
    expect(state.counters.stones).toEqual(expected);
    expect(state.skills.owned[skill.id]).toBe(sm.LADDER_MAX_DUPLICATES);
  });

  it('can grant a fresh zero-CD skill but falls back for an already-owned zero-CD skill', () => {
    const zero = sm.all().find((skill) => skill.type === 'attack')!;
    const originalCd = zero.cd;
    zero.cd = 0;
    try {
      const freshSkill = fixture(); freshSkill.contract.reward.skill = zero.id;
      delete freshSkill.state.skills.owned[zero.id];
      expect(deliver(freshSkill.state, freshSkill.contract.id, freshSkill.contract.target, writer).ok).toBe(true);
      expect(freshSkill.state.skills.list).not.toContain(zero.id);
      expect(freshSkill.contract.paidBonus?.skill).toBe(zero.id);
      const owned = fixture(); owned.contract.reward.skill = zero.id; owned.state.skills.owned[zero.id] = 0;
      expect(deliver(owned.state, owned.contract.id, owned.contract.target, writer).ok).toBe(true);
      expect(owned.contract.paidBonus).toMatchObject({ skill: null, fallback: true });
      expect(owned.state.skills.owned[zero.id]).toBe(0);
    } finally { zero.cd = originalCd; }
  });

  it('refuses wrong town, walking, recovery, read-only access, invalid quantities and missing goods unchanged', () => {
    const cases = [
      ({ state, contract }: ReturnType<typeof fixture>) => { state.cell = settlementCell(TOWN.settlements.find((town) => town.id !== contract.town)!.id)!; },
      ({ state }: ReturnType<typeof fixture>) => { startWalk(state, settlementCell(TOWN.settlements.find((town) => town.id !== state.town.visited[0])!.id)!); },
      ({ state }: ReturnType<typeof fixture>) => { state.phase = 'camp'; },
      ({ state, good }: ReturnType<typeof fixture>) => { tradeBucket(state, good)[good.key] = 0; },
    ];
    for (const setup of cases) {
      const row = fixture(); setup(row);
      expect(unchanged(row.state, () => deliver(row.state, row.contract.id, 1, writer)).ok).toBe(false);
    }
    const { state, contract } = fixture();
    expect(unchanged(state, () => deliver(state, contract.id, 1, readonly)).ok).toBe(false);
    for (const count of [0, -1, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, contract.target + 1]) {
      expect(unchanged(state, () => deliver(state, contract.id, count, writer)).ok).toBe(false);
    }
    expect(unchanged(state, () => deliver(state, 'missing-id', 1, writer)).ok).toBe(false);
  });

  it('preflights primary and fallback stones together after consumed cargo frees its slot', () => {
    const { state, contract, good } = fixture();
    for (const bucket of [state.counters.stones, state.farm.herbs, state.farm.potions, state.farm.condensed,
      state.fieldwork.materials, state.fieldwork.foods, state.junk]) for (const key of Object.keys(bucket)) delete bucket[key];
    tradeBucket(state, good)[good.key] = contract.target;
    contract.reward.stone = { key: 'tier', count: 1 };
    contract.reward.fallback = { key: 'remove', count: 1 };
    contract.reward.skill = sm.all().find((row) => (row.cd ?? 0) > 0)!.id;
    state.skills.owned[contract.reward.skill] = sm.LADDER_MAX_DUPLICATES;
    state.junk['capacity fixture'] = (slotsAvailable(state) - 1) * E.inventory.stack_size.stone;
    expect(unchanged(state, () => deliver(state, contract.id, contract.target, writer)).ok).toBe(false);
    state.junk['capacity fixture'] -= E.inventory.stack_size.stone;
    expect(deliver(state, contract.id, contract.target, writer).ok).toBe(true);
    expect(state.counters.stones).toMatchObject({ tier: 1, remove: 1 });
  });

  it('never repays completed contracts after repeat calls and save round trips', () => {
    const { state, contract } = fixture();
    expect(trackDelivery(state, contract.id, true, writer)).toBe(true);
    expect(deliver(state, contract.id, contract.target, writer).ok).toBe(true);
    expect(state.town.trackedContractIds).not.toContain(contract.id);
    const loaded = importJson(exportJson(state));
    expect(contractById(loaded, contract.id)).toEqual(contract);
    expect(unchanged(loaded, () => deliver(loaded, contract.id, 1, writer)).ok).toBe(false);
    expect(unchanged(loaded, () => trackDelivery(loaded, contract.id, true, writer))).toBe(false);
  });
});

describe('delivery clocks, retention and saves', () => {
  it('expires exactly at the deadline, preserving partial proceeds and forfeiting only the bonus', () => {
    const { state, contract } = fixture();
    expect(deliver(state, contract.id, 1, writer).ok).toBe(true);
    const gold = state.counters.gold, stones = structuredClone(state.counters.stones);
    state.town.deliveryClockSec = contract.dueAtDeliverySec - 2;
    tickDeliveries(state, () => 0.99, false, false, writer);
    expect(contract.status).toBe('open');
    tickDeliveries(state, () => 0.99, false, false, writer);
    expect(contract.status).toBe('expired');
    expect(contract.terminalAt).toBe(contract.dueAtDeliverySec);
    expect(contract.recapAcknowledged).toBe(false);
    expect(contract.baseGold).toBe(gold);
    expect(contract.paidBonus).toBeNull();
    expect(state.counters.gold).toBe(gold);
    expect(state.counters.stones).toEqual(stones);
    expect(unchanged(state, () => deliver(state, contract.id, 1, writer)).ok).toBe(false);
    expect(contractById(importJson(exportJson(state)), contract.id)).toEqual(contract);
  });

  it('uses the tick-start Camp/dungeon pause snapshot and keeps writer refusals immutable', () => {
    const { state } = fixture();
    state.phase = 'camp';
    expect(deliveryPauseReason(state)).toBe('Camp recovery');
    tickDeliveries(state, () => 0.99, false, true, writer);
    expect(state.town.deliveryClockSec).toBe(0);
    state.phase = 'fighting';
    state.dungeon = { } as NonNullable<typeof state.dungeon>;
    expect(deliveryPauseReason(state)).toBe('Dungeon run');
    tickDeliveries(state, () => 0.99, false, true, writer);
    expect(state.town.deliveryClockSec).toBe(0);
    state.dungeon = null;
    tickDeliveries(state, () => 0.99, false, false, writer);
    expect(state.town.deliveryClockSec).toBe(1);
    const rng = vi.fn(() => 0);
    unchanged(state, () => tickDeliveries(state, rng, true, false, readonly));
    unchanged(state, () => tick(state, { writer: false }));
    expect(rng).not.toHaveBeenCalled();
  });

  it('pauses offer time offline, consumes full-slot opportunities without draws and creates no backlog', () => {
    const { state, contract } = fixture();
    const rng = vi.fn(() => 0);
    state.town.contractTriggerRemainingSec[contract.town] = 1;
    tickDeliveries(state, rng, false, false, writer);
    expect(state.town.contractTriggerRemainingSec[contract.town]).toBe(1);
    expect(rng).not.toHaveBeenCalled();
    tickDeliveries(state, rng, true, false, writer);
    expect(state.town.contractTriggerRemainingSec[contract.town]).toBe(deliveryConfig.trigger_interval_sec);
    expect(rng).not.toHaveBeenCalled();
    expect(deliver(state, contract.id, contract.target, writer).ok).toBe(true);
    tickDeliveries(state, rng, true, false, writer);
    expect(state.town.contracts[contract.town].filter((row) => row.status === 'open')).toHaveLength(0);
    expect(rng).not.toHaveBeenCalled();
  });

  it('initializes newly visited town timers once and consumes failed or empty-pool opportunities', () => {
    const state = fresh(), town = state.town.visited[0];
    delete state.town.contractTriggerRemainingSec[town];
    const rng = vi.fn(() => 0.99);
    tickDeliveries(state, rng, true, false, writer);
    expect(state.town.contractTriggerRemainingSec[town]).toBe(deliveryConfig.trigger_interval_sec);
    expect(rng).not.toHaveBeenCalled();
    state.town.contractTriggerRemainingSec[town] = 1;
    tickDeliveries(state, rng, true, false, writer);
    expect(rng).toHaveBeenCalledTimes(1);
    expect(state.town.contractSerial).toBe(0);
    deliveryConfig.trigger_chance = 1;
    deliveryConfig.target_weights = { junk: 0, food: 0, material: 0, herb: 0 };
    state.town.contractTriggerRemainingSec[town] = 1;
    tickDeliveries(state, rng, true, false, writer);
    expect(state.town.contractSerial).toBe(0);
    expect(state.town.contractTriggerRemainingSec[town]).toBe(deliveryConfig.trigger_interval_sec);
  });

  it('folds excess unread history into exact actual and forfeited totals and evicts acknowledged first', () => {
    deliveryConfig.history_limit = 1;
    const { state, contract } = fixture();
    state.town.contracts[contract.town] = [];
    const acknowledged = terminal(state, contract, 'completed', true);
    const paid = terminal(state, contract, 'completed');
    const expired = terminal(state, contract, 'expired');
    expired.reward.skill = sm.all()[0].id;
    const retained = terminal(state, contract, 'expired');
    pruneDeliveries(state);
    expect(state.town.contracts[contract.town].map((row) => row.id)).toEqual([retained.id]);
    expect(contractById(state, acknowledged.id)).toBeUndefined();
    const summary = state.town.deliverySummaries[contract.town];
    expect(summary).toMatchObject({ unread: 2, completed: 1, expired: 1,
      paidGold: paid.reward.gold, forfeitedGold: expired.reward.gold,
      goods: { [contract.good]: { quantity: paid.delivered + expired.delivered, gold: paid.baseGold + expired.baseGold } },
      paidStones: { [paid.reward.stone.key]: paid.reward.stone.count },
      forfeitedStones: { [expired.reward.stone.key]: expired.reward.stone.count },
      forfeitedSkills: { [expired.reward.skill!]: 1 },
      forfeitedFallback: { [expired.reward.fallback.key]: expired.reward.fallback.count },
    });
    expect(summary.paidSkills).toEqual({});
    expect(importJson(exportJson(state)).town.deliverySummaries).toEqual(state.town.deliverySummaries);
    expect(unchanged(state, () => acknowledgeDelivery(state, `summary:${contract.town}`, readonly))).toBe(false);
    expect(acknowledgeDelivery(state, `summary:${contract.town}`, writer)).toBe(true);
    expect(state.town.deliverySummaries[contract.town].unread).toBe(0);
    expect(acknowledgeDelivery(state, retained.id, writer)).toBe(true);
    expect(retained.recapAcknowledged).toBe(true);
  });

  it('backfills old saves without payment or RNG and repeats normalization safely', () => {
    const state = fresh();
    const old = state.town as unknown as Record<string, unknown>;
    for (const key of ['deliveryClockSec', 'contractTriggerRemainingSec', 'contractSerial', 'contracts', 'trackedContractIds', 'deliverySummaries']) delete old[key];
    const gold = state.counters.gold, seed = state.rngState;
    migrate(state, 14);
    const normalized = JSON.stringify(state.town);
    normalizeDeliveries(state); migrate(state, 14);
    expect(JSON.stringify(state.town)).toBe(normalized);
    expect(state.counters.gold).toBe(gold);
    expect(state.rngState).toBe(seed);
    expect(state.town.deliveryClockSec).toBe(0);
    expect(state.town.contractSerial).toBe(0);
    expect(state.town.contracts).toEqual({});
    expect(importJson(exportJson(state)).town).toEqual(state.town);
  });

  it('rejects removed reward/target references, duplicate identities and illegal terminal state on load', () => {
    const changes: ((contract: DeliveryContract) => void)[] = [
      (contract) => { contract.good = 'food:removed-content'; },
      (contract) => { contract.reward.stone.key = 'removed-stone'; },
      (contract) => { contract.reward.skill = 'removed-skill'; },
      (contract) => { contract.reward.fallback.key = 'removed-fallback'; },
      (contract) => { contract.status = 'completed'; },
    ];
    for (const change of changes) {
      const { state, contract } = fixture(); change(contract);
      expect(() => normalizeDeliveries(state)).toThrow(/delivery save:/);
    }
    const { state, contract } = fixture();
    state.town.contracts[contract.town].push(structuredClone(contract));
    expect(() => normalizeDeliveries(state)).toThrow(/identity/);
  });

  it('rejects removed references in saved acquisition routes and recap rewards', () => {
    const route = fixture();
    route.contract.acquisition.steps[0].good = 'material:removed-content';
    expect(() => normalizeDeliveries(route.state)).toThrow(/delivery save:/);
    for (const track of ['paidStones', 'forfeitedStones', 'forfeitedFallback', 'paidSkills', 'forfeitedSkills'] as const) {
      const { state, contract } = fixture();
      const summary = newDeliverySummary();
      summary[track]['removed-content'] = 1;
      state.town.deliverySummaries[contract.town] = summary;
      expect(() => normalizeDeliveries(state)).toThrow(/delivery save:/);
    }
  });
});
