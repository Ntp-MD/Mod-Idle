import { E, MODS, TOWN, eng, sm, trade, delivery, fieldwork } from '../engine/client';
import type { AcquisitionContext } from '../../../engine/delivery';
import type { DeliveryContract, DeliverySummary, StoneReward } from './delivery-types';
import { newDeliverySummary } from './delivery-types';
import type { GameState } from './types';
import { atSettlement, craft } from './craft';
import { quoteSale, sellGoods, tradeBucket, tradeInventory } from './trade';
import { fitsTransaction, addTo } from './slots';
import { grantNamedSkill, usefulSkillDuplicate } from './skills';
import { fieldSkillLevel, fieldSite } from './fieldwork';
import { farmLevel, plotCount } from './farm';
import { cellSec, settlementCell } from './road';
import { road } from '../engine/client';

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
    // Every authored Mine/Grove is a wild-side neighbour. Route via its town gives a reachable,
    // conservative station leg without importing presentation map coordinates.
    travelFromCurrent: (zone, kind) => cellSec(state, settlementCell(townForZone(zone).id)!) + stationLeg(zone, kind),
    travelBetween: (from, to, fromKind, toKind) => road.secBetween(townForZone(from).id, townForZone(to).id)
      + stationLeg(from, fromKind) + stationLeg(to, toKind),
  };
}

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

/** RNG order: target → count → stone → optional skill chance → optional named skill. */
export function offerDelivery(state: GameState, town: string, rng: () => number, access: WriterAccess): DeliveryContract | null {
  if (!access.writer || !state.town.visited.includes(town) || !townById(town)) return null;
  if ((state.town.contracts[town] || []).filter((contract) => contract.status === 'open').length >= deliveryConfig.active_slots) return null;
  const target = choose(deliveryCandidates(state, town), (row) => delivery.targetWeight(row.good), rng);
  if (!target) return null;
  const issuing = townById(town)!;
  let count = deliveryConfig.count_min + Math.floor(rng() * (target.maximum - deliveryConfig.count_min + 1));
  const context = acquisitionContext(state);
  let route = delivery.acquisition(target.good.id, count, issuing.zone, context);
  while (count > deliveryConfig.count_min && (!route || delivery.deadline(route) > deliveryConfig.deadline_max_sec)) route = delivery.acquisition(target.good.id, --count, issuing.zone, context);
  if (!route || delivery.deadline(route) > deliveryConfig.deadline_max_sec) return null;
  const stone = choose(deliveryConfig.stones, (entry) => entry.weight, rng);
  if (!stone) return null;
  const eligible = sm.all().filter((skill) => usefulSkillDuplicate(state.skills, skill.id));
  const skillChance = deliveryConfig.skill_chance * (deliveryConfig.skill_band_weights[route.band as keyof typeof deliveryConfig.skill_band_weights] || 0);
  const skill = rng() < skillChance ? choose(eligible, (entry) => (deliveryConfig.skill_weights as Record<string, number>)[entry.id] ?? deliveryConfig.default_skill_weight, rng)?.id || null : null;
  const rawQuote = trade.quote(town, target.good, count, state.town.market[town]?.[target.good.group], state.clockSec);
  const premium = deliveryConfig.premium_base + route.difficulty * deliveryConfig.premium_per_difficulty;
  const serial = state.town.contractSerial + 1;
  if (!Number.isSafeInteger(serial)) return null;
  const contract: DeliveryContract = {
    id: `delivery:${town}:${serial}`, serial, town, good: target.good.id, target: count, delivered: 0,
    acquisition: route, derivationVersion: deliveryConfig.derivation_version,
    reward: { gold: trade.floorCurrency(rawQuote.gold * (premium - 1)), stone: delivery.stoneBundle(route.band, route.difficulty, stone.key, stone.income), skill,
      fallback: delivery.stoneBundle(route.band, route.difficulty, deliveryConfig.fallback_stone, deliveryConfig.fallback_stone, true), quoteGold: rawQuote.gold, premium },
    triggeredAtClockSec: state.clockSec, dueAtDeliverySec: state.town.deliveryClockSec + delivery.deadline(route), status: 'open', terminalAt: null,
    baseGold: 0, lastQuantity: 0, lastGold: 0, paidBonus: null, recapAcknowledged: true, announced: false,
  };
  state.town.contractSerial = serial;
  (state.town.contracts[town] ||= []).push(contract);
  return contract;
}

function fold(summary: DeliverySummary, contract: DeliveryContract) {
  summary.unread++;
  summary[contract.status === 'completed' ? 'completed' : 'expired']++;
  const total = summary.goods[contract.good] ||= { quantity: 0, gold: 0 };
  total.quantity += contract.delivered; total.gold += contract.baseGold;
  const add = (bucket: Record<string, number>, item: StoneReward) => { bucket[item.key] = (bucket[item.key] || 0) + item.count; };
  if (contract.paidBonus) {
    summary.paidGold += contract.paidBonus.gold;
    for (const stone of contract.paidBonus.stones) add(summary.paidStones, stone);
    if (contract.paidBonus.skill) summary.paidSkills[contract.paidBonus.skill] = (summary.paidSkills[contract.paidBonus.skill] || 0) + 1;
  } else {
    summary.forfeitedGold += contract.reward.gold; add(summary.forfeitedStones, contract.reward.stone);
    if (contract.reward.skill) {
      summary.forfeitedSkills[contract.reward.skill] = (summary.forfeitedSkills[contract.reward.skill] || 0) + 1;
      add(summary.forfeitedFallback, contract.reward.fallback);
    }
  }
}

export function pruneDeliveries(state: GameState) {
  for (const [town, contracts] of Object.entries(state.town.contracts)) {
    let terminal = contracts.filter((contract) => contract.status !== 'open').sort((a, b) => a.terminalAt! - b.terminalAt! || a.serial - b.serial);
    while (terminal.length > deliveryConfig.history_limit) {
      const oldest = terminal.find((contract) => contract.recapAcknowledged) || terminal[0];
      if (!oldest.recapAcknowledged) fold(state.town.deliverySummaries[town] ||= newDeliverySummary(), oldest);
      contracts.splice(contracts.indexOf(oldest), 1);
      terminal = terminal.filter((contract) => contract !== oldest);
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
    contract.status = 'expired'; contract.terminalAt = state.town.deliveryClockSec; contract.recapAcknowledged = false;
  }
  if (online) for (const town of TOWN.settlements) {
    if (!state.town.visited.includes(town.id)) continue;
    if (state.town.contractTriggerRemainingSec[town.id] == null) { state.town.contractTriggerRemainingSec[town.id] = deliveryConfig.trigger_interval_sec; continue; }
    state.town.contractTriggerRemainingSec[town.id]--;
    if (state.town.contractTriggerRemainingSec[town.id] > 0) continue;
    state.town.contractTriggerRemainingSec[town.id] = deliveryConfig.trigger_interval_sec;
    if ((state.town.contracts[town.id] || []).filter((contract) => contract.status === 'open').length >= deliveryConfig.active_slots) continue;
    // Chance comes after all pre-existing consumers; full slots consume no offer draw.
    if (rng() < deliveryConfig.trigger_chance) offerDelivery(state, town.id, rng, access);
  }
  pruneDeliveries(state);
}

export function previewDelivery(state: GameState, id: string, count: number, access: WriterAccess) {
  const refuse = (why: string) => ({ ok: false as const, why });
  if (!access.writer) return refuse('this tab is read-only');
  const contract = contractById(state, id);
  if (!contract || contract.status !== 'open') return refuse('this delivery is no longer open');
  if (state.town.deliveryClockSec >= contract.dueAtDeliverySec) return refuse('the delivery deadline has passed');
  if (!atSettlement(state, contract.town)) return refuse('stand in the issuing settlement to deliver');
  if (!Number.isSafeInteger(count) || count <= 0 || count > contract.target - contract.delivered) return refuse('choose a whole quantity within the remaining want');
  const good = trade.byId[contract.good];
  if (!good) return refuse('this good needs a content migration');
  const bucket = tradeBucket(state, good);
  if ((bucket[good.key] || 0) < count) return refuse('not enough carried; withdraw stored goods first');
  const quote = quoteSale(state, contract.town, good.id, count);
  if (!quote) return refuse('this buyer is unavailable');
  const complete = count === contract.target - contract.delivered;
  const skill = complete && contract.reward.skill && usefulSkillDuplicate(state.skills, contract.reward.skill) ? contract.reward.skill : null;
  const fallback = complete && !!contract.reward.skill && !skill;
  const stones = complete ? [contract.reward.stone, ...(fallback ? [contract.reward.fallback] : [])] : [];
  const capKind = good.bucket === 'junk' ? 'stone' : good.bucket;
  if (!fitsTransaction(state, [{ bucket, key: good.key, capKind, amount: count }], stones.map((stone) => ({ bucket: state.counters.stones, key: stone.key, capKind: 'stone', amount: stone.count })))) return refuse('make bag room for the complete reward bundle');
  return { ok: true as const, contract, good, count, quote, complete, skill, fallback, stones };
}

export function deliver(state: GameState, id: string, count: number, access: WriterAccess): { ok: boolean; why?: string; gold?: number; completed?: boolean } {
  const preview = previewDelivery(state, id, count, access);
  if (!preview.ok) return preview;
  const result = sellGoods(state, preview.good.id, count);
  if (!result.ok) return result;
  const contract = preview.contract;
  contract.delivered += count; contract.baseGold += result.gold; contract.lastQuantity = count; contract.lastGold = result.gold; contract.recapAcknowledged = false;
  if (preview.complete) {
    for (const stone of preview.stones) addTo(state, state.counters.stones, stone.key, 'stone', stone.count);
    if (preview.skill) grantNamedSkill(state.skills, preview.skill);
    state.counters.gold += contract.reward.gold;
    contract.paidBonus = { gold: contract.reward.gold, stones: preview.stones.map((stone) => ({ ...stone })), skill: preview.skill, fallback: preview.fallback };
    contract.status = 'completed'; contract.terminalAt = state.town.deliveryClockSec;
  }
  pruneDeliveries(state);
  return { ok: true, gold: result.gold + (preview.complete ? contract.reward.gold : 0), completed: preview.complete };
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
  town.contracts ||= {}; town.trackedContractIds ||= []; town.deliverySummaries ||= {};
  const fail = (message: string): never => { throw new Error(`delivery save: ${message}`); };
  const safe = (value: number) => Number.isSafeInteger(value) && value >= 0;
  const amount = (value: number) => Number.isFinite(value) && value >= 0;
  if (!safe(town.deliveryClockSec) || !safe(town.contractSerial)) fail('invalid clock or serial');
  const ids = new Set<string>(), serials = new Set<number>();
  const stoneValid = (stone: StoneReward) => stone && typeof stone.key === 'string' && (craft.STONE_NAME[stone.key] || stone.key.startsWith('imprint_') && MODS.mods.some((mod) => mod.id === stone.key.slice('imprint_'.length))) && safe(stone.count) && stone.count > 0;
  for (const [townId, rows] of Object.entries(town.contracts)) {
    if (!townById(townId) || !Array.isArray(rows)) fail('unknown town or malformed contract list');
    for (const contract of rows) {
      if (contract.town !== townId || contract.id !== `delivery:${townId}:${contract.serial}` || ids.has(contract.id) || serials.has(contract.serial) || !safe(contract.serial) || contract.serial < 1 || contract.serial > town.contractSerial) fail('invalid or repeated contract identity');
      ids.add(contract.id); serials.add(contract.serial);
      if (!trade.byId[contract.good] || !safe(contract.target) || contract.target < 1 || !safe(contract.delivered) || contract.delivered > contract.target) fail('unknown target or invalid progress');
      if (!safe(contract.triggeredAtClockSec) || !safe(contract.dueAtDeliverySec) || !amount(contract.baseGold) || !safe(contract.lastQuantity) || !amount(contract.lastGold)) fail('invalid time or proceeds');
      const route = contract.acquisition;
      if (!route || !amount(route.productionSec) || !amount(route.travelSec) || !amount(route.difficulty) || !safe(route.processing)
        || !Object.hasOwn(deliveryConfig.band_weights, route.band) || !Object.hasOwn(deliveryConfig.rarity_weights, route.rarity)
        || !safe(contract.derivationVersion) || contract.derivationVersion < 1 || contract.derivationVersion > deliveryConfig.derivation_version || !Array.isArray(route.steps)) fail('invalid acquisition snapshot');
      for (const step of route.steps) if (!trade.byId[step.good] || !E.mob.zones.some((zone) => zone.id === step.zone)
        || !safe(step.quantity) || !step.quantity || !amount(step.seconds) || !['mine', 'grove', 'hunt', 'farm', 'cook', 'workshop', 'trail', 'fish', 'salvage'].includes(step.kind)) fail('acquisition references need a migration');
      if (!contract.reward || !amount(contract.reward.gold) || !amount(contract.reward.quoteGold) || !amount(contract.reward.premium) || !stoneValid(contract.reward.stone) || !stoneValid(contract.reward.fallback) || contract.reward.skill && !sm.byId[contract.reward.skill]) fail('reward references need a migration');
      if (!['open', 'completed', 'expired'].includes(contract.status) || contract.status === 'open' && (contract.terminalAt !== null || contract.paidBonus || contract.delivered === contract.target)
        || contract.status !== 'open' && !safe(contract.terminalAt!) || contract.status === 'completed' && (contract.delivered !== contract.target || !contract.paidBonus)
        || contract.status === 'expired' && (contract.paidBonus || contract.delivered === contract.target)) fail('illegal terminal state');
      if (contract.paidBonus && (!amount(contract.paidBonus.gold) || !contract.paidBonus.stones.every(stoneValid) || contract.paidBonus.skill && !sm.byId[contract.paidBonus.skill])) fail('invalid recorded reward');
      contract.announced ??= false; contract.recapAcknowledged ??= false;
    }
  }
  for (const [id, remaining] of Object.entries(town.contractTriggerRemainingSec)) if (!townById(id) || !safe(remaining)) fail('invalid trigger');
  for (const [id, summary] of Object.entries(town.deliverySummaries)) {
    if (!townById(id) || !safe(summary.unread) || !safe(summary.completed) || !safe(summary.expired) || !amount(summary.paidGold) || !amount(summary.forfeitedGold)) fail('invalid recap summary');
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
