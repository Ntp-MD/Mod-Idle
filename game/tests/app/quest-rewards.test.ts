import { describe, expect, it } from 'vitest';
import { TOWN, sm } from '../../src/engine/client';
import { newGame } from '@sim/core/game';
import { deliver, deliveryConfig, offerDelivery, previewDelivery, pruneDeliveries, tickDeliveries } from '@sim/town/delivery';
import { tradeBucket } from '@sim/town/trade';
import { trade } from '../../src/engine/client';
import { slotsAvailable, slotsUsed } from '@sim/gear/slots';
import { exportJson, importJson } from '../../src/state/save';

const writer = { writer: true };
const unchanged = <T>(state: ReturnType<typeof newGame>, action: () => T) => {
  const before = JSON.stringify(state);
  const result = action();
  expect(JSON.stringify(state)).toBe(before);
  return result;
};
function shipment(choice = true) {
  const state = newGame(45);
  state.town.contractSerial = deliveryConfig.reward_modes.indexOf(choice ? 'choice' : 'fixed');
  const saved = [deliveryConfig.count_min, deliveryConfig.count_max];
  deliveryConfig.count_min = deliveryConfig.count_max = 3;
  try {
    const contract = offerDelivery(state, state.town.visited[0], () => 0, writer)!;
    expect(contract).toBeTruthy();
    const good = trade.byId[contract.good];
    tradeBucket(state, good)[good.key] = contract.target;
    return { state, contract, good };
  } finally { [deliveryConfig.count_min, deliveryConfig.count_max] = saved; }
}
describe('frozen fixed and choice Delivery bonuses', () => {
  it('keeps Fixed completion automatic and pays its displayed complete bundle', () => {
    const { state, contract } = shipment(false);
    expect(contract.reward.alternative).toBeUndefined();
    const point = state.player.treePoints;
    expect(deliver(state, contract.id, contract.target, writer)).toMatchObject({ ok: true, completed: true });
    expect(contract.paidBonus?.gold).toBe(contract.reward.gold);
    expect(contract.paidBonus?.stones).toContainEqual(contract.reward.stone);
    expect(state.player.treePoints).toBe(point + contract.reward.treePoints);
  });

  it('allows partial hand-ins without a choice and requires one for the final hand-in', () => {
    const { state, contract } = shipment();
    expect(contract.reward.alternative).toBeDefined();
    expect(deliver(state, contract.id, 1, writer).ok).toBe(true);
    expect(state.town.hagglingXp).toBe(0);
    expect(unchanged(state, () => deliver(state, contract.id, contract.target - 1, writer)).ok).toBe(false);
    expect(unchanged(state, () => deliver(state, contract.id, contract.target - 1, writer, 'unknown')).ok).toBe(false);
    expect(deliver(state, contract.id, contract.target - 1, writer, 'gold').completed).toBe(true);
  });

  it.each(['gold', 'supplies'])('pays only the selected %s branch and permanent points once', (choice) => {
    const { state, contract } = shipment();
    const stones = { ...state.counters.stones };
    const before = state.player.treePoints;
    expect(deliver(state, contract.id, contract.target, writer, choice).completed).toBe(true);
    expect(contract.paidBonus?.choice).toBe(choice);
    expect(state.player.treePoints).toBe(before + contract.reward.treePoints);
    expect(state.player.attainmentPoints).toBe(contract.reward.attainment);
    expect(state.town.questMilestones[contract.reward.milestone!]).toBe(true);
    if (choice === 'gold') {
      expect(contract.paidBonus?.gold).toBe(contract.reward.alternative!.gold);
      expect(state.counters.stones).toEqual(stones);
      expect(contract.paidBonus?.skill).toBeNull();
      expect(Object.hasOwn(state.skills.owned, contract.reward.skill!)).toBe(false);
    } else {
      expect(contract.paidBonus?.gold).toBe(0);
      expect(state.counters.stones[contract.reward.stone.key]).toBe((stones[contract.reward.stone.key] || 0) + contract.reward.stone.count);
      expect(Object.hasOwn(state.skills.owned, contract.reward.skill!)).toBe(true);
    }
    const loaded = importJson(exportJson(state));
    expect(loaded.town.contracts[contract.town][0].paidBonus).toEqual(contract.paidBonus);
    expect(unchanged(loaded, () => deliver(loaded, contract.id, contract.target, writer, choice)).ok).toBe(false);
  });

  it('retains every offered alternative across tuning and save/reload', () => {
    const { state, contract } = shipment();
    const promised = structuredClone(contract.reward);
    const original = deliveryConfig.choice_reward_mult;
    try {
      deliveryConfig.choice_reward_mult = original + 1;
      const loaded = importJson(exportJson(state));
      expect(loaded.town.contracts[contract.town][0].reward).toEqual(promised);
      expect(unchanged(loaded, () => previewDelivery(loaded, contract.id, contract.target, writer, 'gold')).ok).toBe(true);
    } finally { deliveryConfig.choice_reward_mult = original; }
  });

  it('checks only the chosen branch capacity before consuming any goods', () => {
    const { state, contract } = shipment();
    contract.reward.stone = { key: 'tier', count: 1 };
    contract.reward.fallback = { key: 'remove', count: 1 };
    state.skills.owned[contract.reward.skill!] = sm.LADDER_MAX_DUPLICATES;
    for (let i = 0; slotsUsed(state) < slotsAvailable(state); i++) state.junk[`fill-${i}`] = 1;
    expect(unchanged(state, () => deliver(state, contract.id, contract.target, writer, 'supplies')).ok).toBe(false);
    expect(deliver(state, contract.id, contract.target, writer, 'gold').completed).toBe(true);
  });

  it('keeps read-only reward selection and completion mutation-free', () => {
    const { state, contract } = shipment();
    expect(unchanged(state, () => deliver(state, contract.id, contract.target, { writer: false }, 'gold')).ok).toBe(false);
  });

  it('pays the town milestone once and leaves an expired milestone available again', () => {
    const { state, contract } = shipment();
    contract.dueAtDeliverySec = state.town.deliveryClockSec + 1;
    tickDeliveries(state, () => 1, false, false, writer);
    expect(state.town.questMilestones).toEqual({});
    const next = offerDelivery(state, contract.town, () => 0, writer)!;
    expect(next.reward.treePoints).toBe(TOWN.quest_rewards.milestone_tree_points);
    tradeBucket(state, trade.byId[next.good])[trade.byId[next.good].key] = next.target;
    expect(deliver(state, next.id, next.target, writer, next.reward.alternative ? 'supplies' : undefined).completed).toBe(true);
    const repeat = offerDelivery(state, next.town, () => 0, writer)!;
    expect(repeat.reward.treePoints).toBe(0);
    expect(repeat.reward.milestone).toBeUndefined();
  });

  it('aggregates expired alternatives as mutually exclusive promises, never paid rewards', () => {
    const { state, contract } = shipment();
    const count = deliveryConfig.history_limit;
    try {
      deliveryConfig.history_limit = 0;
      contract.status = 'expired'; contract.terminalAt = 1; contract.recapAcknowledged = false;
      pruneDeliveries(state);
      const summary = state.town.deliverySummaries[contract.town];
      expect(summary.paidGold).toBe(0);
      expect(summary.forfeitedGold).toBe(0);
      expect(summary.forfeitedChoices?.count).toBe(1);
      expect(summary.forfeitedChoices?.gold).toBe(contract.reward.alternative!.gold);
      expect(summary.forfeitedChoices?.stones[contract.reward.stone.key]).toBe(contract.reward.stone.count);
      expect(importJson(exportJson(state)).town.deliverySummaries).toEqual(state.town.deliverySummaries);
    } finally { deliveryConfig.history_limit = count; }
  });
});

