import { describe, expect, it } from 'vitest';
import { TOWN, sm } from '../../src/engine/client';
import { newGame } from '@sim/core/game';
import { claimTask, rollTask, skipTask } from '@sim/town/town';
import { deliver, deliveryConfig, offerDelivery, previewDelivery, pruneDeliveries, tickDeliveries } from '@sim/town/delivery';
import { taskBonuses } from '@sim/town/quest-rewards';
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
function expedition() {
  const state = newGame(46);
  const draws = [0, 0.6, 0, 0];
  const task = rollTask(() => draws.shift() ?? 0, state);
  expect(task.kind).toBe('expedition');
  state.town.tasks[1] = task;
  task.progress = task.n;
  return { state, task };
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

describe('hunt reward choices and one-time Expedition milestones', () => {
  it('offers a fixed reward when no named skill would provide useful progress', () => {
    const state = newGame(46);
    for (const skill of sm.all()) state.skills.owned[skill.id] = sm.LADDER_MAX_DUPLICATES;
    const draws = [0, 0.6, 0, 0];
    const task = rollTask(() => draws.shift() ?? 0, state);
    expect(task.alternative).toBeUndefined();
    state.town.tasks[1] = task;
    task.progress = task.n;
    expect(claimTask(state, 1)).toBe(true);
    expect(state.player.questTreePointsEarned).toBe(TOWN.quest_rewards.milestone_tree_points);
  });

  it('leaves a full-bag stone claim untouched while an unowned skill still fits', () => {
    const { state, task } = expedition();
    for (let i = 0; slotsUsed(state) < slotsAvailable(state); i++) state.junk[`fill-${i}`] = 1;
    expect(unchanged(state, () => claimTask(state, 1, task.stone))).toBe(false);
    expect(claimTask(state, 1, 'skill')).toBe(true);
    expect(state.town.questMilestones[task.milestone!]).toBe(true);
  });

  it.each(['tier', 'skill'])('grants only %s while the Tree Point remains outside the choice', (choice) => {
    const { state, task } = expedition();
    const before = state.player.treePoints;
    const stones = state.counters.stones[task.stone] || 0;
    expect(claimTask(state, 1, choice)).toBe(true);
    expect(state.player.treePoints).toBe(before + TOWN.quest_rewards.milestone_tree_points);
    expect(state.town.questMilestones[task.milestone!]).toBe(true);
    expect(state.counters.stones[task.stone] || 0).toBe(stones + (choice === 'tier' ? task.count : 0));
    expect(Object.hasOwn(state.skills.owned, task.alternative!.skill!)).toBe(choice === 'skill');
    expect(unchanged(state, () => claimTask(state, 1, choice))).toBe(false);
    const draws = [0, 0.6, 0, 0];
    expect(rollTask(() => draws.shift() ?? 0, state).treePoints).toBeUndefined();
  });

  it('requires a displayed reward choice and writer access before claiming', () => {
    const { state } = expedition();
    expect(unchanged(state, () => claimTask(state, 1))).toBe(false);
    expect(unchanged(state, () => claimTask(state, 1, 'wrong'))).toBe(false);
    expect(unchanged(state, () => claimTask(state, 1, 'skill', { writer: false }))).toBe(false);
  });

  it('uses the frozen stone fallback if the named skill becomes unhelpful', () => {
    const { state, task } = expedition();
    state.skills.owned[task.alternative!.skill!] = sm.LADDER_MAX_DUPLICATES;
    const before = state.counters.stones[task.stone] || 0;
    expect(claimTask(state, 1, 'skill')).toBe(true);
    expect(state.counters.stones[task.stone]).toBe(before + task.count);
    expect(state.skills.owned[task.alternative!.skill!]).toBe(sm.LADDER_MAX_DUPLICATES);
  });

  it('does not promise a milestone to two concurrent hunts or burn it when skipped', () => {
    const { state, task } = expedition();
    const draw = () => { const rows = [0, 0.6, 0, 0]; return () => rows.shift() ?? 0; };
    expect(rollTask(draw(), state).milestone).toBeUndefined();
    expect(skipTask(state, 1).ok).toBe(true);
    expect(rollTask(draw(), state).milestone).toBe(task.milestone);
  });

  it('preserves a named alternative through migration and rejects malformed choices', () => {
    const { state, task } = expedition();
    expect(taskBonuses(importJson(exportJson(state)).town.tasks[1]!)).toEqual(taskBonuses(task));
    task.alternative!.stones = [{ key: 'tier', count: -1 }];
    expect(() => importJson(exportJson(state))).toThrow(/hunt reward choice/);
  });

  it('backfills v18 without changing promised old bonuses or inventing a choice', () => {
    const { state, contract } = shipment(false);
    delete contract.reward.milestone;
    contract.reward.treePoints = 1;
    const old = JSON.parse(exportJson(state));
    old.version = 18;
    delete old.state.town.questMilestones;
    const loaded = importJson(JSON.stringify(old));
    expect(loaded.town.questMilestones).toEqual({});
    expect(loaded.town.contracts[contract.town][0].reward).toEqual(contract.reward);
    expect(deliver(loaded, contract.id, contract.target, writer).completed).toBe(true);
    expect(loaded.player.questTreePointsEarned).toBe(1);
  });

  it('backfills older missing point fields as zero without inventing permanent rewards', () => {
    const { state, contract } = shipment(false);
    const old = JSON.parse(exportJson(state));
    old.version = 17;
    const reward = old.state.town.contracts[contract.town][0].reward;
    delete reward.milestone; delete reward.treePoints; delete reward.attainment;
    delete old.state.town.questMilestones;
    const loaded = importJson(JSON.stringify(old));
    const before = loaded.player.treePoints;
    expect(deliver(loaded, contract.id, contract.target, writer).completed).toBe(true);
    expect(loaded.player.treePoints).toBe(before);
    expect(loaded.player.attainmentPoints).toBe(0);
  });

  it.each([false, [], { unknown: true }])('rejects malformed milestone records %j without rewriting the source', (record) => {
    const { state } = expedition();
    const raw = JSON.parse(exportJson(state));
    raw.state.town.questMilestones = record;
    const text = JSON.stringify(raw);
    expect(() => importJson(text)).toThrow(/milestone record/);
    expect(JSON.stringify(raw)).toBe(text);
  });

  it('rejects duplicate milestone promises rather than paying the same objective twice', () => {
    const { state, task } = expedition();
    state.town.tasks[2] = structuredClone(task);
    expect(() => importJson(exportJson(state))).toThrow(/repeated milestone/);
  });
});
