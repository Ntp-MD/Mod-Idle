import { eng, TOWN, trade, sm } from '../engine/client';
import { dayOf } from './game';
import type { GameState, Item, TaskSlot, TownState } from './types';
import { atSettlement, craft, type Where } from './craft';
import { addTo, fits, fitsTransaction, slotsFree } from './slots';
import { milestoneAvailable, payQuestBonus, recordQuestMilestone, resolveQuestBonus, taskBonuses } from './quest-rewards';
import { usefulSkillDuplicate } from './skills';
import { sellGoods, tradeInventory } from './trade';
import { standingProgressOf } from '../../../engine/standing.ts';

/** Ordinary town services use reference income and Haggling discounts. Allowed kinds come from
 *  town.json; the rare-goods exception belongs to the separate Black Market. */

const TS = TOWN.task_sizing;

export const ALL_ROWS: any[] = [...TOWN.one_time, ...TOWN.repeatable];
export const rowById = (id: string) => ALL_ROWS.find((r) => r.id === id);
export const settlementById = (id: string) => TOWN.settlements.find((s: any) => s.id === id);
export const settlementOfZone = (zone: number) => TOWN.settlements.find((s: any) => s.zone === zone);
export const npcOf = (id: string) => TOWN.npcs.find((n: any) => n.id === id);
/** A ladder row whose later rungs have no explicit stock entry is expanded one rung at a time. */
const EXPLICIT_STOCK = new Set((TOWN.settlements as any[]).flatMap((s) => s.stock || []));
function nextLadderRow(row: any, state?: GameState) {
  if (!row?.ladder || !state) return row;
  const ladder = ALL_ROWS.filter((r) => r.ladder === row.ladder);
  const start = ladder.findIndex((r) => r.id === row.id);
  if (start < 0) return row;
  for (let i = start; i < ladder.length; i++) {
    const candidate = ladder[i];
    const needed = Number(candidate.qty ?? 1);
    const owned = (state.town?.owned || []).filter((id) => id === candidate.id).length;
    if (owned >= needed) continue;
    // A rung placed by name in another settlement keeps its authored home; a settlement only
    // advances a ladder whose later rungs no stock array names.
    return i === start || !EXPLICIT_STOCK.has(candidate.id) ? candidate : row;
  }
  return row;
}

export const stockOf = (settlementId: string, state?: GameState) =>
  ((settlementById(settlementId)?.stock || []) as string[])
    .map((id) => rowById(id))
    .filter(Boolean)
    .map((row) => nextLadderRow(row, state));

export const startSettlement = () => (TOWN.settlements.find((s: any) => s.start) || TOWN.settlements[0]).id;

/** The `m` a row charges at this settlement, honouring the teaching discount where one exists. */
export function priceMinutes(row: any, settlementId: string, state?: GameState, blocks = 1): number {
  const s = settlementById(settlementId)!;
  if (row.discount && row.discount.settlement === s.id) return row.discount.m;
  // the pedlar's stock is a fresh roll of three slots each real day, priced inside its band
  if (row.id === 'pedlar_rotation' && state?.pedlar?.minutes?.length) {
    return state.pedlar.minutes[Math.min(state.pedlar.bought, state.pedlar.minutes.length - 1)];
  }
  // a per-block line (the Waypoint warp) is priced by the walk it replaces, not by a fixed `m`
  if (row.m_per_block != null) return row.m_per_block * blocks;
  return row.m != null ? row.m : row.m_min;
}

/** Gold = minutes of that band's full-sell junk income. */
export function priceGold(row: any, settlementId: string, state?: GameState, blocks = 1): number {
  const s = settlementById(settlementId)!;
  // a teaching discount is priced at the settlement's own band, the price its note and the wiki state;
  // every other line charges the band the row names
  const discounted = row.discount && row.discount.settlement === s.id;
  const band = discounted ? s.band : (row.charge_band || s.band);
  return Math.round(priceMinutes(row, settlementId, state, blocks) * eng.goldPerMinute(band)
    * trade.haggling(state?.town.hagglingXp ?? 0).serviceMult * 100) / 100;
}

export function newTown(): TownState {
  const start = startSettlement();
  return {
    questMilestones: {},
    deliveryClockSec: 0, contractTriggerRemainingSec: { [start]: TOWN.delivery.trigger_interval_sec },
    contractSerial: 0, contracts: {}, trackedContractIds: [], deliverySummaries: {},
    blackMarket: {},
    helpCredit: {},
    market: {},
    marketCredit: 0,
    hagglingXp: 0,
    visited: [start], owned: [], waypoint: start,
    tasks: new Array(TS.slots).fill(null), refillAt: new Array(TS.slots).fill(0),
    skipsToday: 0, freeSkipsToday: 0, skipDay: 0,
  };
}

export interface StandingProgress {
  tier: number;
  share: number;
  kills: number;
  helpCredit: number;
  progress: number;
  budget: number;
  next?: { name: string; kills: number; requiredProgress: number; remaining: number };
}

/** Standing progress combines zone kills with capped aid credit for the specific settlement. */
export function standingProgress(state: GameState, settlementId: string): StandingProgress {
  const s = settlementById(settlementId);
  if (!s) return { tier: 0, share: 0, kills: 0, helpCredit: 0, progress: 0, budget: 0 };
  const budget = eng.SETTLEMENT_BUDGET_KILLS[s.zone];
  const kills = state.counters.zoneKills[s.zone] || 0;
  return standingProgressOf(kills, state.town.helpCredit[settlementId] || 0, budget, TOWN.standing.tiers);
}

export const standingShare = (state: GameState, settlementId: string): number => standingProgress(state, settlementId).share;
export const standingTier = (state: GameState, settlementId: string): number => standingProgress(state, settlementId).tier;

/** A Waypoint exists for every settlement walked to on foot, once; warping to it costs gold (`waypoint_warp`). */
export function canTravel(state: GameState, settlementId: string): boolean {
  return state.town.visited.includes(settlementId);
}

export interface BuyResult { ok: boolean; why?: string; row?: any; gold?: number; repaired?: string }

export function canBuy(state: GameState, settlementId: string, rowId: string): BuyResult {
  const row = rowById(rowId);
  if (!row) return { ok: false, why: 'no such line' };
  if (!(stockOf(settlementId, state) as any[]).some((r) => r.id === rowId)) return { ok: false, why: 'not stocked here' };
  if (!TOWN.invariants.allowed_kinds.includes(row.kind)) return { ok: false, why: 'that kind is not for sale' };
  const banned = TOWN.invariants.banned_power_nouns.map((n: string) => String(n).toLowerCase());
  // a display_only line is the game saying out loud that it sells no power ("sells no stone, no
  // gear"), so its label mentioning those words is not a purchase of them
  if (!row.display_only && banned.some((n: string) => new RegExp(`\\b${n}\\b`).test(String(row.item).toLowerCase()))) {
    return { ok: false, why: 'gold never buys power' };
  }
  if (row.qty && state.town.owned.filter((id) => id === rowId).length >= row.qty) return { ok: false, why: 'sold out here' };
  if (row.per_day_cap && dailyUsed(state, rowId) >= row.per_day_cap) return { ok: false, why: `daily cap of ${row.per_day_cap} reached` };
  if (rowId === 'collector_hint') {
    const set = collectorSetAt(settlementId);
    if (!set) return { ok: false, why: 'no Collector set here', row };
    if (state.collector?.hints?.[set.id]) return { ok: false, why: 'hint already bought', row };
  }
  const requiredTier = row.required_standing_tier;
  const tiers = TOWN.standing.tiers;
  if (!Number.isSafeInteger(requiredTier) || requiredTier < 0 || requiredTier > tiers.length) {
    return { ok: false, why: `invalid Standing requirement for ${rowId}` };
  }
  if (standingTier(state, settlementId) < requiredTier) {
    const tierName = tiers[requiredTier - 1].name;
    return { ok: false, why: `requires Standing Tier ${tierName} in ${settlementById(settlementId)?.name || 'this settlement'}`, row };
  }
  const gold = priceGold(row, settlementId, state);
  if (state.counters.gold < gold) return { ok: false, why: `needs ${gold} gold`, row, gold };
  return { ok: true, row, gold };
}

/** How many of a capped line have been taken today — the skip token and the pedlar keep their own. */
export function dailyUsed(state: GameState, rowId: string): number {
  return rowId === 'pedlar_rotation' ? (state.pedlar?.bought || 0) : state.town.skipsToday;
}

function collectorSetAt(settlementId: string) {
  return (TOWN.collector_sets as any[]).find((set) => set.settlement === settlementId) || null;
}

function firstBroken(state: GameState): { where: Where; index: number; item: Item } | null {
  const worn = state.gear.findIndex((item) => item?.broken);
  if (worn >= 0) return { where: 'gear', index: worn, item: state.gear[worn]! };
  const bag = state.bag.findIndex((item) => item?.broken);
  if (bag >= 0) return { where: 'bag', index: bag, item: state.bag[bag]! };
  return null;
}

/** The Armourer's gold service revives one chosen Broken piece and refills its protection. */
export function repairGear(
  state: GameState,
  settlementId: string,
  where: Where,
  index: number,
  rowId?: string,
): BuyResult & { where?: Where; index?: number } {
  if (!atSettlement(state, settlementId)) return { ok: false, why: 'stand in this settlement to repair' };
  const row = rowId ? rowById(rowId) : (stockOf(settlementId, state) as any[]).find((entry) => entry.id === 'repair_ironrow' || entry.id === 'repair');
  if (!row || !(stockOf(settlementId, state) as any[]).some((entry) => entry.id === row.id)) {
    return { ok: false, why: 'no Armourer repair is stocked here' };
  }
  const check = canBuy(state, settlementId, row.id);
  if (!check.ok) return check;
  const item = where === 'gear' ? state.gear[index] : state.bag[index];
  if (!item) return { ok: false, why: 'nothing in that slot', row };
  if (!item.broken) return { ok: false, why: 'that piece is not Broken', row };
  const repaired = craft.repair(item);
  if (!repaired.ok) return { ok: false, why: repaired.why, row };
  if (where === 'gear') state.gear[index] = repaired.item;
  else state.bag[index] = repaired.item;
  state.counters.gold = Math.round((state.counters.gold - (check.gold || 0)) * 100) / 100;
  return { ok: true, row, gold: check.gold, where, index, repaired: item.base };
}

/** Spend gold on a stall line. Purchases that grant no state change are display-only by design. */
export function buy(state: GameState, settlementId: string, rowId: string): BuyResult {
  if (!atSettlement(state, settlementId)) return { ok: false, why: 'stand in this settlement to buy' };
  const check = canBuy(state, settlementId, rowId);
  if (!check.ok) return check;
  const row = check.row;
  // Repair and the Collector hint have chosen targets; they never become a generic `owned` line.
  if (rowId === 'repair' || rowId === 'repair_ironrow') {
    const target = firstBroken(state);
    if (!target) return { ok: false, why: 'no Broken piece to repair', row };
    return repairGear(state, settlementId, target.where, target.index, rowId);
  }
  const collectorSet = rowId === 'collector_hint' ? collectorSetAt(settlementId) : null;
  if (rowId === 'collector_hint') {
    if (!collectorSet) return { ok: false, why: 'no Collector set here', row };
    if (state.collector?.hints?.[collectorSet.id]) return { ok: false, why: 'hint already bought', row };
  }
  state.counters.gold = Math.round((state.counters.gold - (check.gold || 0)) * 100) / 100;
  if (collectorSet) {
    state.collector ||= { done: {}, hints: {} };
    state.collector.hints ||= {};
    state.collector.hints[collectorSet.id] = true;
  } else {
    state.town.owned.push(rowId);
  }
  if (rowId === 'skip_token') state.town.skipsToday++;
  if (rowId === 'pedlar_rotation' && state.pedlar) state.pedlar.bought++;
  return check;
}

/** The quick town action sells junk only; provisions and materials require an explicit Market sale. */
export function sellJunk(state: GameState): { pieces: number; gold: number } {
  if (!atSettlement(state)) return { pieces: 0, gold: 0 };
  let pieces = 0, gold = 0;
  for (const { good, count } of tradeInventory(state)) {
    if (good.bucket !== 'junk') continue;
    const result = sellGoods(state, good.id, count);
    pieces += result.pieces;
    gold += result.gold;
  }
  return { pieces, gold };
}

export function taskReward(kind: string, band: string): { stone: string; count: number } {
  const pay = eng.taskPayout(band, TS.reward_minutes_of_band_income);
  if (kind === 'elite' || kind === 'expedition') return { stone: 'tier', count: pay.tier };
  return { stone: 'remove', count: TS.boss_reward.remove };
}

/** The board offers tasks only from zones at or below where the player is fighting (`tasks.md`). */
export function rollTask(rng: () => number, state: GameState): TaskSlot {
  const maxZone = Math.max(1, Math.min(eng.ZONES.length, state.zone));
  const zone = 1 + Math.floor(rng() * maxZone);
  // Expedition offers take their share from the existing Elite/Tier offer budget; the Boss share stays put.
  const offer = rng();
  const eliteEdge = TS.offer_weight_elite;
  const expeditionEdge = eliteEdge + TS.offer_weight_expedition;
  let kind: TaskSlot['kind'] = offer < eliteEdge ? 'elite' : offer < expeditionEdge ? 'expedition' : 'boss';
  let targetSpecies: string | undefined;
  let subzone: number | undefined;
  if (kind === 'expedition') {
    const choices = (eng.zoneById(zone).subzones || []).flatMap((side: any, index: number) =>
      (side.species || []).map((speciesId: string) => ({ speciesId, subzone: index })));
    if (choices.length) {
      const target = choices[Math.min(choices.length - 1, Math.floor(rng() * choices.length))];
      targetSpecies = target.speciesId;
      subzone = target.subzone;
    } else kind = 'elite';
  }
  const band = eng.zoneById(zone).quality.startsWith('high') ? 'high' : eng.zoneById(zone).quality.startsWith('mid') ? 'mid' : 'low';
  const n = kind === 'boss' ? TS.boss_n : TS.elite_n;
  const reward = taskReward(kind, band);
   const task: TaskSlot = { kind, zone, n, progress: 0, stone: reward.stone as any, count: reward.count, claimed: false, offeredAt: state.clockSec };
   if (kind === 'expedition' && targetSpecies != null && subzone != null) {
     task.targetSpecies = targetSpecies;
     task.subzone = subzone;
   }
   // the Boss hunt's second payout rides on the slot so the claim can pay either (tasks.md)
   if (kind === 'boss') task.alt = { stone: 'tier', count: TS.boss_reward.reroll_tier } as any;
   // Reuse the former tree-bonus draw, preserving every later consumer's roll order.
   const rewardRoll = rng();
   if (kind === 'expedition') {
     const key = `expedition:${zone}`;
     if (milestoneAvailable(state, key)) {
       task.milestone = key;
       task.treePoints = TOWN.quest_rewards.milestone_tree_points;
     }
     const eligible = sm.all().filter((skill) => usefulSkillDuplicate(state.skills, skill.id));
     if (TOWN.quest_rewards.expedition_skill_choice && eligible.length) {
       const skill = eligible[Math.min(eligible.length - 1, Math.floor(rewardRoll * eligible.length))];
       task.alternative = { id: 'skill', label: 'Named skill', gold: 0, stones: [], skill: skill.id,
         fallback: { key: task.stone, count: task.count } };
     }
   }
   return task;
}

/** No Bag Cap exists, so stash tabs are organisation rather than space (`loot.md` §4 · towns.md). */
export const STASH_TAB_CAP = 6;

export function stashTabCount(state: GameState): number {
  const bought = state.town.owned.filter((id: string) => /^stash_tab_\d/.test(id)).length;
  const houses = state.town.owned.filter((id: string) => /^house_/.test(id)).length * 2;
  // the Reliquary set pays a tab directly, bypassing the one-time price ladder
  const granted = state.grants ? state.grants.stash_tabs : 0;
  return Math.min(STASH_TAB_CAP, bought + houses + granted);
}

/** Deposit and withdraw only happen at a settlement (`inventory.note`). */
export function deposit(state: GameState, bagIndex: number, tab: number): { ok: boolean; why?: string } {
  if (!atSettlement(state)) return { ok: false, why: 'stash transfers are a settlement service' };
  if (tab >= stashTabCount(state)) return { ok: false, why: 'that tab is not bought yet' };
  const item = state.bag[bagIndex];
  if (!item) return { ok: false, why: 'nothing in that slot' };
  while (state.stash.length <= tab) state.stash.push([]);
  state.stash[tab].unshift(item);
  state.bag.splice(bagIndex, 1);
  return { ok: true };
}

export function withdraw(state: GameState, tab: number, index: number): { ok: boolean; why?: string } {
  if (!atSettlement(state)) return { ok: false, why: 'stash transfers are a settlement service' };
  const item = state.stash[tab]?.[index];
  if (!item) return { ok: false, why: 'empty' };
  if (slotsFree(state) < 1) return { ok: false, why: 'the bag is full' };
  state.bag.unshift(item);
  state.stash[tab].splice(index, 1);
  return { ok: true };
}

/** Bulk deposit: high index first so the splice indices stay valid; a locked piece is left behind. */
export function depositMany(state: GameState, indices: number[], tab: number): number {
  if (!atSettlement(state)) return 0;
  if (tab >= stashTabCount(state)) return 0;
  let moved = 0;
  for (const i of [...indices].sort((a, b) => b - a)) {
    const item = state.bag[i];
    if (!item || item.locked) continue;
    while (state.stash.length <= tab) state.stash.push([]);
    state.stash[tab].unshift(item);
    state.bag.splice(i, 1);
    moved++;
  }
  return moved;
}

/** Bulk withdraw: stop at a full bag; a locked piece stays where it is. */
export function withdrawMany(state: GameState, tab: number, indices: number[]): number {
  if (!atSettlement(state)) return 0;
  let moved = 0;
  for (const i of [...indices].sort((a, b) => b - a)) {
    const item = state.stash[tab]?.[i];
    if (!item || item.locked) continue;
    if (slotsFree(state) < 1) break;
    state.bag.unshift(item);
    state.stash[tab].splice(i, 1);
    moved++;
  }
  return moved;
}

/** Kills feed the board when they match the task's rank, zone and, for Expeditions, exact hunting cell. */
export function progressTasks(state: GameState, mobKind: string, zone: number, speciesId?: string, subzone?: number | null) {
  for (const task of state.town.tasks) {
    if (!task || task.claimed || task.zone !== zone) continue;
    const isElite = mobKind === 'Elite';
    const isBoss = mobKind.startsWith('Boss') || mobKind.startsWith('Unique');
    if (task.kind === 'elite' && isElite) task.progress = Math.min(task.n, task.progress + 1);
    else if (task.kind === 'expedition' && isElite && task.targetSpecies === speciesId && task.subzone === subzone) {
      task.progress = Math.min(task.n, task.progress + 1);
    }
    else if (task.kind === 'boss' && isBoss) task.progress = Math.min(task.n, task.progress + 1);
  }
}

function clearTask(state: GameState, index: number) {
  state.town.refillAt[index] = state.clockSec + TS.refill_sec;
  state.town.tasks[index] = null;
}

export function claimTask(state: GameState, index: number, choice?: string, access = { writer: true }): boolean {
  if (!access.writer || !atSettlement(state)) return false;
  const task = state.town.tasks[index];
  if (!task || task.progress < task.n || task.claimed) return false;
  const options = taskBonuses(task);
  if (task.alternative && !choice) return false;
  const selected = options.find((option) => option.id === (choice ?? task.stone));
  if (!selected || task.milestone && state.town.questMilestones?.[task.milestone]) return false;
  const paid = resolveQuestBonus(state, selected);
  if (!fitsTransaction(state, [], paid.stones.map((stone) => ({ bucket: state.counters.stones, key: stone.key, capKind: 'stone', amount: stone.count })))) return false;
  payQuestBonus(state, paid);
   const bonus = task.treePoints ?? 0;
   if (bonus > 0) {
     state.player.questTreePointsEarned = (state.player.questTreePointsEarned ?? 0) + bonus;
     state.player.treePoints = (state.player.treePoints ?? 0) + bonus;
   }
   task.claimed = true;
   recordQuestMilestone(state, task.milestone);
   clearTask(state, index);
   return true;
}

export interface SkipVerdict { ok: boolean; why?: string; free?: boolean; token?: boolean }

/** One free skip a day, then one bought token per skip. */
export function skipVerdict(state: GameState, index: number): SkipVerdict {
  if (!atSettlement(state)) return { ok: false, why: 'stand in a settlement to skip a task' };
  const task = state.town.tasks[index];
  if (!task || task.claimed) return { ok: false, why: 'no task to skip' };
  const free = Math.max(0, Number(TS.free_skip_per_day) || 0);
  if ((state.town.freeSkipsToday || 0) < free) return { ok: true, free: true, token: false };
  if (state.town.owned.some((id) => id === 'skip_token')) return { ok: true, free: false, token: true };
  return { ok: false, why: 'free skip used today; buy a Task skip token' };
}

export function skipTask(
  state: GameState,
  index: number,
  access: { writer: boolean } = { writer: true },
): SkipVerdict {
  if (!access.writer) return { ok: false, why: 'this tab is read-only' };
  const verdict = skipVerdict(state, index);
  if (!verdict.ok) return verdict;
  if (verdict.free) state.town.freeSkipsToday = (state.town.freeSkipsToday || 0) + 1;
  else {
    const token = state.town.owned.lastIndexOf('skip_token');
    if (token < 0) return { ok: false, why: 'no skip token' };
    state.town.owned.splice(token, 1);
  }
  clearTask(state, index);
  return verdict;
}

/** task_sizing owns refill delay and daily skip allowances. */
export function tickTown(state: GameState, rng: () => number) {
  const day = dayOf(state.clockSec);
  if (day !== state.town.skipDay) {
    state.town.skipDay = day;
    state.town.skipsToday = 0;
    state.town.freeSkipsToday = 0;
  }
  state.town.tasks.forEach((task, i) => {
    if (!task && state.clockSec >= state.town.refillAt[i]) state.town.tasks[i] = rollTask(rng, state);
  });
}
