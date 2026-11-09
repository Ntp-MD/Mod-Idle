import { E, MODS, TOWN, eng, sm, trade, delivery, fieldwork } from '../../engine/client';
import type { AcquisitionContext, Acquisition } from '../../../../engine/delivery';
import type { DeliveryContract, DeliverySummary, StoneReward } from './delivery-types';
import { newDeliverySummary } from './delivery-types';
import type { GameState } from '../core/types';
import type { QuestBonus } from './quest-rewards';
import { mulberry32 } from '../../engine/client-helpers';
import { storyHash32 } from '../../../../engine/storyteller.ts';
import { atSettlement, craft } from '../gear/craft';
import { quoteSale, sellGoods, tradeBucket, tradeInventory } from './trade';
import { fitsTransaction } from '../gear/slots';
import { usefulSkillDuplicate } from '../combat/skills';
import { deliveryBonuses, milestoneAvailable, payQuestBonus, recordQuestMilestone, resolveQuestBonus, validQuestBonus } from './quest-rewards';
import { fieldSkillLevel, fieldSite } from '../world/fieldwork';
import { farmLevel, plotCount } from '../world/farm';
import { cellSec, settlementCell } from '../world/road';
import { road } from '../../engine/client';

export type { DeliveryContract, DeliverySummary };
export const deliveryConfig = delivery.C;
export interface WriterAccess { writer: boolean }
const townById = (id: string) => TOWN.settlements.find((town) => town.id === id);
export const contractById = (state: GameState, id: string) => Object.values(state.town.contracts).flat().find((contract) => contract.id === id);
export const deliveryTimeLeft = (state: GameState, contract: DeliveryContract) => Math.max(0, contract.dueAtDeliverySec - state.town.deliveryClockSec);
export const deliveryPauseReason = (state: GameState) => deliveryConfig.pause_states.includes('camp') && state.phase === 'camp' ? 'Camp recovery'
  : deliveryConfig.pause_states.includes('dungeon') && state.dungeon ? 'Dungeon run' : null;
const choose = <T>(rows: T[], weight: (row: T) => number, rng: () => number): T | null => {
  const total = rows.reduce((sum, row) => sum + Math.max(0, weight(row)), 0);
  if (!(total > 0)) return null;
  let roll = rng() * total;
  return rows.find((row) => (roll -= Math.max(0, weight(row))) < 0) || rows.at(-1)!;
};

export function acquisitionContext(state: GameState): AcquisitionContext {
  const townForZone = (zone: number) => TOWN.settlements.find((town) => town.zone === zone)!;
  const canMoveCamp = !state.fieldwork.camp || state.fieldwork.freeRelocationsRemaining > 0
    || (state.fieldwork.materials.ore || 0) >= E.fieldwork.camp.relocate_ore && (state.fieldwork.materials.timber || 0) >= E.fieldwork.camp.relocate_timber;
  const stationLeg = (zone: number, kind: string) => {
    if (!['mine', 'grove', 'cook', 'fish'].includes(kind)) return 0;
    if (kind === 'cook' && state.fieldwork.camp?.zone === zone) return road.secFromHex(state.fieldwork.camp.cell, settlementCell(townForZone(zone).id)!);
    return E.road.block_sec;
  };
  return {
    owned: Object.fromEntries(tradeInventory(state).map(({ good, count }) => [good.id, count])),
    levels: { ...Object.fromEntries(Object.keys(state.fieldwork.skills).map((id) => [id, fieldSkillLevel(state, id as keyof typeof state.fieldwork.skills)])), farming: farmLevel(state) },
    zones: E.mob.zones.map((zone) => zone.id),
    canCamp: (zone, kind) => !!state.fieldwork.camp && state.fieldwork.camp.zone === zone
      && (kind === 'cook' || kind === 'fish' && fieldwork.F.fishing.foods.includes(fieldwork.F.regional_sources[String(zone)]?.food) || fieldSite(state.fieldwork.camp.cell) === kind) || canMoveCamp,
    camp: state.fieldwork.camp ? { zone: state.fieldwork.camp.zone, kind: fieldSite(state.fieldwork.camp.cell) || 'camp' } : null,
    freeRelocations: state.fieldwork.freeRelocationsRemaining,
    campCosts: { 'material:ore': E.fieldwork.camp.relocate_ore, 'material:timber': E.fieldwork.camp.relocate_timber },
    canHunt: (zone) => eng.zoneById(zone).levels[0] <= Math.max(state.player.level, eng.zoneById(state.zone).levels[0]),
    plots: state.farm.plots.map((plot) => ({ tier: plot.tier, readyAt: plot.readyAt })), plotCapacity: plotCount(state), now: state.clockSec,
    // Every authored Mine/Grove sits on a bare block beside its town. Route via its town gives a reachable,
    // conservative station leg without importing presentation map coordinates.
    travelFromCurrent: (zone, kind) => cellSec(state, settlementCell(townForZone(zone).id)!) + stationLeg(zone, kind),
    travelBetween: (from, to, fromKind, toKind) => road.secBetween(townForZone(from).id, townForZone(to).id)
      + stationLeg(from, fromKind) + stationLeg(to, toKind),
  };
}

/** The NPC a request is attributed to, by the requested good's bucket (`storyteller` §8.1). */
const ISSUER_BY_BUCKET: Record<string, string> = { material: 'armourer', food: 'counterhand', herb: 'herbalist', junk: 'steward' };
export const issuerOf = (good: { bucket: string } | undefined | null): string => ISSUER_BY_BUCKET[good?.bucket || ''] || 'steward';

const courierCfg = () => (TOWN.delivery as any).courier as {
  enabled: boolean; active_slots: number; trigger_interval_mult: number; trigger_chance_mult: number;
} | undefined;

const hasActiveActivity = (state: GameState) =>
  !!state.walk || state.hunting || state.group.some((mob) => mob.hp > 0) || !!state.dungeon || state.phase === 'camp' || !!state.fieldwork.action;

/** Deterministic candidate discovery; UI reads never consume RNG or create a contract. */
export function deliveryCandidates(state: GameState, town: string) {
  const issuing = townById(town);
  if (!issuing) return [];
  const context = acquisitionContext(state);
  return trade.goods.flatMap((good) => {
    const maximum = Math.min(deliveryConfig.count_max, Math.floor(delivery.capFor(good) * deliveryConfig.stack_share));
    if (maximum < deliveryConfig.count_min || !(delivery.targetWeight(good) > 0)) return [];
    const route = delivery.acquisition(good.id, deliveryConfig.count_min, issuing.zone, context);
    return route && delivery.deadline(route) <= deliveryConfig.deadline_max_sec ? [{ good, maximum, route }] : [];
  });
}

/** Frozen reward shared by local requests and couriers. Draw order (stone → skill chance →
 *  optional skill → attainment → the retained tree-bonus draw) is fixed; a courier consumes the
 *  same draws but discards the permanent points, so both paths stay seeded identically. */
function buildReward(
  state: GameState, paymentTown: string, good: { id: string; group: string }, count: number,
  route: Acquisition, rng: () => number, choice: boolean, permanent: boolean,
): DeliveryContract['reward'] | null {
  const stone = choose(deliveryConfig.stones, (entry) => entry.weight, rng);
  if (!stone) return null;
  const eligible = sm.all().filter((skill) => usefulSkillDuplicate(state.skills, skill.id));
  const skillChance = deliveryConfig.skill_chance * (deliveryConfig.skill_band_weights[route.band as keyof typeof deliveryConfig.skill_band_weights] || 0);
  const skill = rng() < skillChance ? choose(eligible, (entry) => (deliveryConfig.skill_weights as Record<string, number>)[entry.id] ?? deliveryConfig.default_skill_weight, rng)?.id || null : null;
  const attainmentChance = deliveryConfig.attainment_chance
    * (deliveryConfig.attainment_band_weights[route.band as keyof typeof deliveryConfig.attainment_band_weights] || 0);
  const attainmentDrawn = rng() < attainmentChance ? 1 : 0;
  rng(); // Retain the former tree-bonus draw; milestones do not consume extra gameplay draws.
  const milestone = `delivery:${paymentTown}`;
  const treePointsDrawn = permanent && milestoneAvailable(state, milestone) ? TOWN.quest_rewards.milestone_tree_points : 0;
  const rawQuote = trade.quote(paymentTown, trade.byId[good.id], count, state.town.market[paymentTown]?.[good.group], state.clockSec);
  const premium = delivery.premium(route.difficulty, state.town.hagglingXp);
  const mult = choice ? deliveryConfig.choice_reward_mult : 1;
  return {
    gold: choice ? 0 : delivery.bonusGold(rawQuote.gold, route.difficulty, state.town.hagglingXp),
    stone: delivery.stoneBundle(route.band, route.difficulty * mult, stone.key, stone.income), skill,
    fallback: delivery.stoneBundle(route.band, route.difficulty * mult, deliveryConfig.fallback_stone, deliveryConfig.fallback_stone, true),
    quoteGold: rawQuote.gold, premium,
    attainment: permanent ? attainmentDrawn : 0, treePoints: treePointsDrawn,
    ...(treePointsDrawn ? { milestone } : {}),
    ...(choice ? { alternative: { id: 'gold', label: 'Gold bounty', gold: delivery.bonusGold(rawQuote.gold, route.difficulty, state.town.hagglingXp, mult), stones: [], skill: null, fallback: null } } : {}),
  };
}

/** RNG order: target → count → stone → optional skill chance → optional named skill. */
/** The attainment roll is last on purpose: no earlier roll changes its value, so a contract's
 *  reward never moves after the player has seen it. */
export function offerDelivery(state: GameState, town: string, rng: () => number, access: WriterAccess): DeliveryContract | null {
  if (!access.writer || !state.town.visited.includes(town) || !townById(town)) return null;
  if ((state.town.contracts[town] || []).filter((contract) => contract.status === 'open' && contract.kind === 'request').length >= deliveryConfig.active_slots) return null;
  const target = choose(deliveryCandidates(state, town), (row) => delivery.targetWeight(row.good), rng);
  if (!target) return null;
  const issuing = townById(town)!;
  const picked = pickTarget(state, target.good, target.maximum, issuing.zone, rng);
  if (!picked) return null;
  const serial = state.town.contractSerial + 1;
  if (!Number.isSafeInteger(serial)) return null;
  const choice = delivery.rewardMode(serial) === 'choice';
  const reward = buildReward(state, town, target.good, picked.count, picked.route, rng, choice, true);
  if (!reward) return null;
  const contract: DeliveryContract = {
    id: `delivery:${town}:${serial}`, serial, town, good: target.good.id, target: picked.count, delivered: 0,
    acquisition: picked.route, derivationVersion: deliveryConfig.derivation_version, reward,
    triggeredAtClockSec: state.clockSec, dueAtDeliverySec: state.town.deliveryClockSec + delivery.deadline(picked.route), status: 'open', terminalAt: null,
    baseGold: 0, lastQuantity: 0, lastGold: 0, paidBonus: null, recapAcknowledged: true, announced: false,
    kind: 'request', destinationTown: town, issuerNpcId: issuerOf(target.good), acceptedAtDeliverySec: null, offeredAtDeliverySec: 0, endReason: null,
  };
  state.town.contractSerial = serial;
  (state.town.contracts[town] ||= []).push(contract);
  return contract;
}

/** Count plus the acquisition route shrunk until its deadline fits, as every offer path does. */
function pickTarget(state: GameState, good: { id: string }, maximum: number, zone: number, rng: () => number): { count: number; route: Acquisition } | null {
  let count = deliveryConfig.count_min + Math.floor(rng() * (maximum - deliveryConfig.count_min + 1));
  const context = acquisitionContext(state);
  let route = delivery.acquisition(good.id, count, zone, context);
  while (count > deliveryConfig.count_min && (!route || delivery.deadline(route) > deliveryConfig.deadline_max_sec)) route = delivery.acquisition(good.id, --count, zone, context);
  if (!route || delivery.deadline(route) > deliveryConfig.deadline_max_sec) return null;
  return { count, route };
}

/** One courier attempt on its own stream: chance → destination → target → count → reward draws. */
function offerCourier(state: GameState, source: string, rng: () => number): DeliveryContract | null {
  const cfg = courierCfg();
  if (!cfg) return null;
  const destinations = TOWN.settlements
    .map((town) => town.id)
    .filter((id) => id !== source && state.town.visited.includes(id))
    .sort()
    .filter((id) => deliveryCandidates(state, id).length > 0);
  if (!destinations.length) return null;
  if (!(rng() < Math.min(1, deliveryConfig.trigger_chance * cfg.trigger_chance_mult))) return null;
  const destination = destinations[Math.floor(rng() * destinations.length)];
  const target = choose(deliveryCandidates(state, destination), (row) => delivery.targetWeight(row.good), rng);
  if (!target) return null;
  const destinationTown = townById(destination)!;
  const picked = pickTarget(state, target.good, target.maximum, destinationTown.zone, rng);
  if (!picked) return null;
  if (delivery.deadline(picked.route) > deliveryConfig.deadline_max_sec) return null;
  const serial = (state.town.courierSerial || 0) + 1;
  if (!Number.isSafeInteger(serial)) return null;
  const reward = buildReward(state, destination, target.good, picked.count, picked.route, rng, false, false);
  if (!reward) return null;
  const contract: DeliveryContract = {
    id: `courier:${source}:${serial}`, serial, town: source, good: target.good.id, target: picked.count, delivered: 0,
    acquisition: picked.route, derivationVersion: deliveryConfig.derivation_version, reward,
    triggeredAtClockSec: state.clockSec, dueAtDeliverySec: state.town.deliveryClockSec + delivery.deadline(picked.route), status: 'open', terminalAt: null,
    baseGold: 0, lastQuantity: 0, lastGold: 0, paidBonus: null, recapAcknowledged: true, announced: false,
    kind: 'courier', destinationTown: destination, issuerNpcId: issuerOf(target.good), acceptedAtDeliverySec: null,
    offeredAtDeliverySec: state.town.deliveryClockSec, endReason: null,
  };
  state.town.courierSerial = serial;
  (state.town.contracts[source] ||= []).push(contract);
  return contract;
}

/** The character-wide courier cadence: a single saved countdown fed by its own RNG stream, never
 *  the shared world stream. Runs after Camp in `closeSecond`. */
export function tickCourierOffers(state: GameState, online: boolean, pausedAtStart: boolean, access: WriterAccess) {
  if (!access.writer) return;
  const cfg = courierCfg();
  if (!cfg?.enabled) return;
  if (!online || pausedAtStart) return;
  const all = Object.values(state.town.contracts).flat();
  const openCouriers = all.filter((contract) => contract.kind === 'courier' && contract.status === 'open').length;
  if (openCouriers >= (cfg.active_slots ?? 1)) return;
  const remaining = state.town.courierTriggerRemainingSec ?? deliveryConfig.trigger_interval_sec * cfg.trigger_interval_mult;
  if (remaining > 0) { state.town.courierTriggerRemainingSec = remaining - 1; return; }
  const source = TOWN.settlements.map((town) => town.id).find((id) => atSettlement(state, id));
  if (!source || hasActiveActivity(state)) return;
  state.town.courierTriggerRemainingSec = deliveryConfig.trigger_interval_sec * cfg.trigger_interval_mult;
  if (!TOWN.settlements.some((town) => town.id !== source && state.town.visited.includes(town.id)
    && deliveryCandidates(state, town.id).length > 0)) return;
  const streamState = (state.town.courierStreamState ?? 0) >>> 0;
  const courierRng = mulberry32(streamState);
  state.town.courierStreamState = (streamState + 0x6d2b79f5) >>> 0;
  offerCourier(state, source, courierRng);
}

export function acceptCourier(state: GameState, id: string, access: WriterAccess): { ok: boolean; why?: string } {
  if (!access.writer) return { ok: false, why: 'this tab is read-only' };
  const contract = contractById(state, id);
  if (!contract || contract.kind !== 'courier' || contract.status !== 'open') return { ok: false, why: 'this request is no longer open' };
  if (contract.acceptedAtDeliverySec != null) return { ok: false, why: 'This request is already accepted.' };
  if (state.town.deliveryClockSec >= contract.dueAtDeliverySec) return { ok: false, why: 'this request is no longer open' };
  if (!atSettlement(state, contract.town)) return { ok: false, why: 'stand in the issuing settlement to accept' };
  if (hasActiveActivity(state)) return { ok: false, why: 'finish the active field activity before accepting' };
  contract.acceptedAtDeliverySec = state.town.deliveryClockSec;
  return { ok: true };
}

export function declineCourier(state: GameState, id: string, access: WriterAccess): { ok: boolean; why?: string } {
  if (!access.writer) return { ok: false, why: 'this tab is read-only' };
  const contract = contractById(state, id);
  if (!contract || contract.kind !== 'courier' || contract.status !== 'open'
    || contract.acceptedAtDeliverySec != null) return { ok: false, why: 'this request is no longer open' };
  if (state.town.deliveryClockSec >= contract.dueAtDeliverySec) return { ok: false, why: 'this request is no longer open' };
  if (!atSettlement(state, contract.town)) return { ok: false, why: 'stand in the issuing settlement to decline' };
  contract.status = 'expired';
  contract.endReason = 'declined';
  contract.terminalAt = state.town.deliveryClockSec;
  contract.recapAcknowledged = false;
  return { ok: true };
}

function fold(summary: DeliverySummary, contract: DeliveryContract) {
  summary.unread++;
  if (contract.endReason === 'declined') { summary.declined = (summary.declined ?? 0) + 1; return; }
  summary[contract.status === 'completed' ? 'completed' : 'expired']++;
  const total = summary.goods[contract.good] ||= { quantity: 0, gold: 0 };
  total.quantity += contract.delivered; total.gold += contract.baseGold;
  const add = (bucket: Record<string, number>, item: StoneReward) => { bucket[item.key] = (bucket[item.key] || 0) + item.count; };
  if (contract.paidBonus) {
    summary.paidGold += contract.paidBonus.gold;
    for (const stone of contract.paidBonus.stones) add(summary.paidStones, stone);
    if (contract.paidBonus.skill) summary.paidSkills[contract.paidBonus.skill] = (summary.paidSkills[contract.paidBonus.skill] || 0) + 1;
    summary.paidTreePoints = (summary.paidTreePoints ?? 0) + (contract.paidBonus.treePoints ?? 0);
    summary.paidAttainment = (summary.paidAttainment ?? 0) + (contract.paidBonus.attainment ?? 0);
  } else {
    summary.forfeitedTreePoints = (summary.forfeitedTreePoints ?? 0) + contract.reward.treePoints;
    summary.forfeitedAttainment = (summary.forfeitedAttainment ?? 0) + contract.reward.attainment;
    if (contract.reward.alternative) {
      const choices = summary.forfeitedChoices ||= { count: 0, gold: 0, stones: {}, skills: {}, fallback: {} };
      choices.count++;
      for (const option of deliveryBonuses(contract.reward)) {
        choices.gold += option.gold;
        for (const stone of option.stones) add(choices.stones, stone);
        if (option.skill) choices.skills[option.skill] = (choices.skills[option.skill] || 0) + 1;
        if (option.skill && option.fallback) add(choices.fallback, option.fallback);
      }
    } else {
      summary.forfeitedGold += contract.reward.gold; add(summary.forfeitedStones, contract.reward.stone);
      if (contract.reward.skill) {
        summary.forfeitedSkills[contract.reward.skill] = (summary.forfeitedSkills[contract.reward.skill] || 0) + 1;
        add(summary.forfeitedFallback, contract.reward.fallback);
      }
    }
  }
}

export function pruneDeliveries(state: GameState) {
  for (const [town, contracts] of Object.entries(state.town.contracts)) {
    // Local requests and couriers keep separate terminal histories, so new couriers
    // cannot evict unread local recaps earlier.
    for (const kind of ['request', 'courier'] as const) {
      let terminal = contracts.filter((contract) => contract.status !== 'open' && contract.kind === kind)
        .sort((a, b) => a.terminalAt! - b.terminalAt! || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0) || a.serial - b.serial);
      while (terminal.length > deliveryConfig.history_limit) {
        const oldest = terminal.find((contract) => contract.recapAcknowledged) || terminal[0];
        if (!oldest.recapAcknowledged) fold(state.town.deliverySummaries[town] ||= newDeliverySummary(), oldest);
        contracts.splice(contracts.indexOf(oldest), 1);
        terminal = terminal.filter((contract) => contract !== oldest);
      }
    }
  }
  const open = new Set(Object.values(state.town.contracts).flat().filter((contract) => contract.status === 'open').map((contract) => contract.id));
  state.town.trackedContractIds = state.town.trackedContractIds.filter((id) => open.has(id));
}

/** Called once after a successful world tick, using the pause snapshot taken before that tick. */
export function tickDeliveries(state: GameState, rng: () => number, online: boolean, pausedAtStart: boolean, access: WriterAccess) {
  if (!access.writer) return;
  if (!pausedAtStart) state.town.deliveryClockSec++;
  for (const contract of Object.values(state.town.contracts).flat()) if (contract.status === 'open' && state.town.deliveryClockSec >= contract.dueAtDeliverySec) {
    contract.status = 'expired'; contract.endReason = 'expired'; contract.terminalAt = state.town.deliveryClockSec; contract.recapAcknowledged = false;
  }
  if (online) for (const town of TOWN.settlements) {
    if (!state.town.visited.includes(town.id)) continue;
    if (state.town.contractTriggerRemainingSec[town.id] == null) { state.town.contractTriggerRemainingSec[town.id] = deliveryConfig.trigger_interval_sec; continue; }
    state.town.contractTriggerRemainingSec[town.id]--;
    if (state.town.contractTriggerRemainingSec[town.id] > 0) continue;
    state.town.contractTriggerRemainingSec[town.id] = deliveryConfig.trigger_interval_sec;
    if ((state.town.contracts[town.id] || []).filter((contract) => contract.status === 'open' && contract.kind === 'request').length >= deliveryConfig.active_slots) continue;
    // Chance comes after all pre-existing consumers; full slots consume no offer draw.
    if (rng() < deliveryConfig.trigger_chance) offerDelivery(state, town.id, rng, access);
  }
  pruneDeliveries(state);
}

export interface DeliveryExpected { delivered: number; status: 'open'; gold: number; acceptedAtDeliverySec: number | null }

export function previewDelivery(state: GameState, id: string, count: number, access: WriterAccess, choice?: string, expected?: DeliveryExpected) {
  const refuse = (why: string) => ({ ok: false as const, why });
  if (!access.writer) return refuse('this tab is read-only');
  const contract = contractById(state, id);
  if (!contract || contract.status !== 'open') return refuse('this delivery is no longer open');
  if (expected && (expected.delivered !== contract.delivered || expected.status !== contract.status
    || expected.acceptedAtDeliverySec !== contract.acceptedAtDeliverySec)) {
    return refuse('this delivery changed; review the current hand-in');
  }
  if (state.town.deliveryClockSec >= contract.dueAtDeliverySec) return refuse('the delivery deadline has passed');
  const destination = contract.destinationTown || contract.town;
  if (contract.kind === 'courier' && contract.acceptedAtDeliverySec == null) return refuse('accept this request in its source town before delivering');
  if (!atSettlement(state, destination)) return refuse(contract.kind === 'courier' ? 'stand in the destination settlement to deliver' : 'stand in the issuing settlement to deliver');
  if (!Number.isSafeInteger(count) || count <= 0 || count > contract.target - contract.delivered) return refuse('choose a whole quantity within the remaining want');
  const good = trade.byId[contract.good];
  if (!good) return refuse('this good needs a content migration');
  const bucket = tradeBucket(state, good);
  if ((bucket[good.key] || 0) < count) return refuse('not enough carried; withdraw stored goods first');
  const quote = quoteSale(state, destination, good.id, count);
  if (!quote) return refuse('this buyer is unavailable');
  if (expected && expected.gold !== quote.gold) return refuse('the delivery price changed; review the current hand-in');
  const complete = count === contract.target - contract.delivered;
  const options = deliveryBonuses(contract.reward);
  if (choice !== undefined && !options.some((option) => option.id === choice)) return refuse('choose one of the displayed rewards');
  if (complete && contract.reward.alternative && !choice) return refuse('choose one completion reward');
  if (contract.reward.milestone && state.town.questMilestones?.[contract.reward.milestone]) return refuse('this milestone was already paid');
  const selected = options.find((option) => option.id === (choice ?? 'supplies'))!;
  const bonus = complete ? resolveQuestBonus(state, selected) : { gold: 0, stones: [], skill: null, fallback: false, choice: selected?.id };
  const { skill, fallback, stones } = bonus;
   const attainment = complete ? (contract.reward.attainment ?? 0) : 0;
   const treePoints = complete ? (contract.reward.treePoints ?? 0) : 0;
  const capKind = good.bucket === 'junk' ? 'stone' : good.bucket;
  if (!fitsTransaction(state, [{ bucket, key: good.key, capKind, amount: count }], stones.map((stone) => ({ bucket: state.counters.stones, key: stone.key, capKind: 'stone', amount: stone.count })))) return refuse('make bag room for the complete reward bundle');
   return { ok: true as const, contract, good, count, quote, complete, skill, fallback, stones, attainment, treePoints, bonus };
}

export function deliver(state: GameState, id: string, count: number, access: WriterAccess, choice?: string, expected?: DeliveryExpected): { ok: boolean; why?: string; gold?: number; completed?: boolean } {
  const preview = previewDelivery(state, id, count, access, choice, expected);
  if (!preview.ok) return preview;
  const result = sellGoods(state, preview.good.id, count, {
    carried: tradeBucket(state, preview.good)[preview.good.key] || 0,
    gold: preview.quote.gold,
  });
  if (!result.ok) return result;
  const contract = preview.contract;
  contract.delivered += count; contract.baseGold += result.gold; contract.lastQuantity = count; contract.lastGold = result.gold; contract.recapAcknowledged = false;
  if (preview.complete) {
    payQuestBonus(state, preview.bonus);
    // the attainment point is paid on completion, next to the skill (D2): it is the rare half of the
    // contract's reward, and it was frozen into the offer before the player saw it
     state.player.attainmentPoints = (state.player.attainmentPoints ?? 0) + (preview.attainment ?? 0);
     const bonusTree = preview.treePoints ?? 0;
     if (bonusTree > 0) {
       state.player.questTreePointsEarned = (state.player.questTreePointsEarned ?? 0) + bonusTree;
       state.player.treePoints = (state.player.treePoints ?? 0) + bonusTree;
     }
     contract.paidBonus = { ...preview.bonus, stones: preview.stones.map((stone) => ({ ...stone })), treePoints: bonusTree, attainment: preview.attainment };
     recordQuestMilestone(state, contract.reward.milestone);
    contract.status = 'completed'; contract.terminalAt = state.town.deliveryClockSec;
    state.town.hagglingXp += trade.hagglingXp(contract.acquisition.difficulty);
  }
  pruneDeliveries(state);
  return { ok: true, gold: result.gold + preview.bonus.gold, completed: preview.complete };
}

export function trackDelivery(state: GameState, id: string, tracked: boolean, access: WriterAccess): boolean {
  if (!access.writer) return false;
  const contract = contractById(state, id);
  if (!contract || contract.status !== 'open' || !deliveryTimeLeft(state, contract)) return false;
  state.town.trackedContractIds = state.town.trackedContractIds.filter((key) => key !== id);
  if (tracked) state.town.trackedContractIds.push(id);
  contract.announced = true;
  return true;
}
export function announceDelivery(state: GameState, id: string, access: WriterAccess): boolean {
  const contract = contractById(state, id);
  if (!access.writer || !contract) return false;
  contract.announced = true; return true;
}
export function acknowledgeDelivery(state: GameState, id: string, access: WriterAccess): boolean {
  if (!access.writer) return false;
  if (id.startsWith('summary:')) {
    const town = id.slice('summary:'.length);
    if (!state.town.deliverySummaries[town]?.unread) return false;
    state.town.deliverySummaries[town] = newDeliverySummary(); return true;
  }
  const contract = contractById(state, id);
  if (!contract) return false;
  contract.recapAcknowledged = true; contract.announced = true; return true;
}

/** Backfill only absent state; malformed or removed content is rejected rather than rerolled. */
export function normalizeDeliveries(state: GameState) {
  const town = state.town;
  town.deliveryClockSec ??= 0; town.contractTriggerRemainingSec ||= {}; town.contractSerial ??= 0;
  town.courierSerial ??= 0;
  town.courierStreamState ??= (state.seed ^ storyHash32('courier')) >>> 0;
  town.courierTriggerRemainingSec ??= deliveryConfig.trigger_interval_sec * (courierCfg()?.trigger_interval_mult ?? 1);
  town.contracts ||= {}; town.trackedContractIds ||= []; town.deliverySummaries ||= {};
  const fail = (message: string): never => { throw new Error(`delivery save: ${message}`); };
  const safe = (value: number) => Number.isSafeInteger(value) && value >= 0;
  const amount = (value: number) => Number.isFinite(value) && value >= 0;
  if (!safe(town.deliveryClockSec) || !safe(town.contractSerial)) fail('invalid clock or serial');
  if (!safe(town.courierSerial)) fail('invalid courier serial');
  if (!safe(town.courierStreamState) || town.courierStreamState > 4294967295) fail('invalid courier stream state');
  if (!safe(town.courierTriggerRemainingSec)) fail('invalid courier trigger');
  const ids = new Set<string>(), serials = new Set<string>();
  const stoneValid = (stone: StoneReward) => stone && typeof stone.key === 'string' && (craft.STONE_NAME[stone.key] || stone.key.startsWith('imprint_') && MODS.mods.some((mod) => mod.id === stone.key.slice('imprint_'.length))) && safe(stone.count) && stone.count > 0;
  for (const [townId, rows] of Object.entries(town.contracts)) {
    if (!townById(townId) || !Array.isArray(rows)) fail('unknown town or malformed contract list');
    for (const contract of rows) {
      // Earlier schemas did not promise these points; backfill absence without adding a reward.
      if (contract.reward) {
        if (contract.reward.attainment === undefined) contract.reward.attainment = 0;
        if (contract.reward.treePoints === undefined) contract.reward.treePoints = 0;
      }
      // Legacy local requests predate the courier fields: backfill kind, destination, issuer,
      // acceptance and end reason from their status before any courier check.
      contract.kind ??= 'request';
      if (!['request', 'courier'].includes(contract.kind)) fail('invalid contract kind');
      contract.destinationTown ??= contract.town;
      contract.issuerNpcId ??= issuerOf(trade.byId[contract.good]);
      contract.acceptedAtDeliverySec ??= null;
      contract.offeredAtDeliverySec ??= 0;
      contract.endReason ??= contract.status === 'expired' ? 'expired' : null;
      const expectedId = contract.kind === 'courier' ? `courier:${townId}:${contract.serial}` : `delivery:${townId}:${contract.serial}`;
      const serialBound = contract.kind === 'courier' ? town.courierSerial : town.contractSerial;
      const serialKey = `${contract.kind}:${contract.serial}`;
      if (contract.town !== townId || contract.id !== expectedId || ids.has(contract.id) || serials.has(serialKey) || !safe(contract.serial) || contract.serial < 1 || contract.serial > serialBound) fail('invalid or repeated contract identity');
      ids.add(contract.id); serials.add(serialKey);
      if (!townById(contract.destinationTown)) fail('unknown contract destination');
      if (contract.kind === 'request' && contract.destinationTown !== townId) fail('request destination must equal its source town');
      if (contract.kind === 'courier' && contract.destinationTown === townId) fail('courier destination must differ from its source town');
      if (!TOWN.npcs.some((npc: any) => npc.id === contract.issuerNpcId)) fail('unknown contract issuer');
      if (!safe(contract.offeredAtDeliverySec)) fail('invalid offer stamp');
      if (contract.kind === 'request' && contract.acceptedAtDeliverySec !== null) fail('request acceptance must be null');
      if (contract.acceptedAtDeliverySec != null && (!safe(contract.acceptedAtDeliverySec)
        || contract.acceptedAtDeliverySec < contract.offeredAtDeliverySec || contract.acceptedAtDeliverySec > contract.dueAtDeliverySec
        || contract.acceptedAtDeliverySec > town.deliveryClockSec)) fail('invalid acceptance stamp');
      if (contract.kind === 'courier' && contract.status === 'completed' && contract.acceptedAtDeliverySec == null) fail('completed courier must be accepted');
      if (!trade.byId[contract.good] || !safe(contract.target) || contract.target < 1 || !safe(contract.delivered) || contract.delivered > contract.target) fail('unknown target or invalid progress');
      if (!safe(contract.triggeredAtClockSec) || !safe(contract.dueAtDeliverySec) || !amount(contract.baseGold) || !safe(contract.lastQuantity) || !amount(contract.lastGold)) fail('invalid time or proceeds');
      const route = contract.acquisition;
      if (!route || !amount(route.productionSec) || !amount(route.travelSec) || !amount(route.difficulty) || !safe(route.processing)
        || !Object.hasOwn(deliveryConfig.band_weights, route.band) || !Object.hasOwn(deliveryConfig.rarity_weights, route.rarity)
        || !safe(contract.derivationVersion) || contract.derivationVersion < 1 || contract.derivationVersion > deliveryConfig.derivation_version || !Array.isArray(route.steps)) fail('invalid acquisition snapshot');
      for (const step of route.steps) if (!trade.byId[step.good] || !E.mob.zones.some((zone) => zone.id === step.zone)
        || !safe(step.quantity) || !step.quantity || !amount(step.seconds) || !['mine', 'grove', 'hunt', 'farm', 'cook', 'workshop', 'trail', 'fish', 'salvage'].includes(step.kind)) fail('acquisition references need a migration');
       if (!contract.reward || !amount(contract.reward.gold) || !amount(contract.reward.quoteGold) || !amount(contract.reward.premium) || !stoneValid(contract.reward.stone) || !stoneValid(contract.reward.fallback) || contract.reward.skill && !sm.byId[contract.reward.skill]) fail('reward references need a migration');
       if (contract.reward.alternative && (!validQuestBonus(contract.reward.alternative) || contract.reward.alternative.id === 'supplies')) fail('invalid reward alternative');
       if (!safe(contract.reward.attainment) || contract.reward.attainment < 0 || contract.reward.attainment > 1) fail('invalid attainment reward');
       if (!safe(contract.reward.treePoints)) fail('invalid tree point reward');
       if (contract.kind === 'courier' && (contract.reward.alternative || contract.reward.milestone || contract.reward.attainment !== 0 || contract.reward.treePoints !== 0)) fail('courier carries a permanent or alternative reward');
      if (!['open', 'completed', 'expired'].includes(contract.status) || contract.status === 'open' && (contract.terminalAt !== null || contract.paidBonus || contract.delivered === contract.target)
        || contract.status !== 'open' && !safe(contract.terminalAt!) || contract.status === 'completed' && (contract.delivered !== contract.target || !contract.paidBonus)
        || contract.status === 'expired' && (contract.paidBonus || contract.delivered === contract.target)) fail('illegal terminal state');
       if (!['expired', 'declined', null].includes(contract.endReason)) fail('invalid end reason');
       if ((contract.status === 'open' || contract.status === 'completed') && contract.endReason !== null) fail('non-terminal contract has an end reason');
       if (contract.status === 'expired' && contract.endReason === null) contract.endReason = 'expired';
       if (contract.endReason === 'declined' && (contract.kind !== 'courier' || contract.status !== 'expired' || contract.acceptedAtDeliverySec != null
         || contract.delivered !== 0 || contract.baseGold !== 0 || contract.paidBonus)) fail('illegal declined state');
       if (contract.paidBonus && (!amount(contract.paidBonus.gold) || !contract.paidBonus.stones.every(stoneValid) || contract.paidBonus.skill && !sm.byId[contract.paidBonus.skill])) fail('invalid recorded reward');
       if (contract.paidBonus?.treePoints != null && !safe(contract.paidBonus.treePoints)) fail('invalid recorded tree point reward');
       if (contract.paidBonus?.attainment != null && (!safe(contract.paidBonus.attainment) || contract.paidBonus.attainment > 1)) fail('invalid recorded attainment reward');
       if (contract.paidBonus?.choice != null && !deliveryBonuses(contract.reward).some((option) => option.id === contract.paidBonus!.choice)) fail('unknown recorded reward choice');
      contract.announced ??= false; contract.recapAcknowledged ??= false;
    }
  }
  for (const [id, remaining] of Object.entries(town.contractTriggerRemainingSec)) if (!townById(id) || !safe(remaining)) fail('invalid trigger');
  for (const [id, summary] of Object.entries(town.deliverySummaries)) {
    summary.declined ??= 0;
    if (!townById(id) || !safe(summary.unread) || !safe(summary.completed) || !safe(summary.expired) || !safe(summary.declined) || !amount(summary.paidGold) || !amount(summary.forfeitedGold)) fail('invalid recap summary');
    if (summary.paidTreePoints !== undefined && !safe(summary.paidTreePoints)) fail('invalid summarized tree point reward');
    for (const key of ['paidAttainment', 'forfeitedTreePoints', 'forfeitedAttainment'] as const)
      if (summary[key] !== undefined && !safe(summary[key]!)) fail('invalid summarized permanent points');
    if (summary.forfeitedChoices) {
      const row = summary.forfeitedChoices;
      if (!safe(row.count) || !amount(row.gold) || !row.stones || !row.skills || !row.fallback) fail('invalid unchosen reward summary');
      for (const bucket of [row.stones, row.fallback]) for (const [key, count] of Object.entries(bucket)) if (!stoneValid({ key, count })) fail('invalid summarized reward alternative');
      for (const [key, count] of Object.entries(row.skills)) if (!sm.byId[key] || !safe(count) || !count) fail('invalid summarized skill alternative');
    }
    for (const [good, row] of Object.entries(summary.goods)) if (!trade.byId[good] || !safe(row.quantity) || !amount(row.gold)) fail('invalid summarized proceeds');
    for (const bucket of [summary.paidStones, summary.forfeitedStones, summary.forfeitedFallback]) {
      if (!bucket || typeof bucket !== 'object') fail('invalid summarized stones');
      for (const [key, count] of Object.entries(bucket)) if (!stoneValid({ key, count })) fail('summarized stone references need a migration');
    }
    for (const bucket of [summary.paidSkills, summary.forfeitedSkills]) {
      if (!bucket || typeof bucket !== 'object') fail('invalid summarized skills');
      for (const [key, count] of Object.entries(bucket)) if (!sm.byId[key] || !safe(count) || !count) fail('summarized skill references need a migration');
    }
  }
  if (!Array.isArray(town.trackedContractIds) || town.trackedContractIds.some((id) => !ids.has(id))) fail('unknown tracked delivery');
  town.trackedContractIds = [...new Set(town.trackedContractIds)].filter((id) => contractById(state, id)?.status === 'open');
}
