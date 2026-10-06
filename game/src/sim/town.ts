import { eng, E, TOWN } from '../engine/client';
import type { GameState, TaskSlot, TownState } from './types';

/**
 * The settlement layer. Every price here is "minutes of full-sell income" converted through the
 * shared engine's `goldPerMinute`, so a drop-rate change moves the stall prices in the client the
 * same moment it moves them in `towns-stalls.md` (`economy.md` · checks.md T2-T7).
 *
 * Gold buys space, time, information and appearance only — never gear, Mods, potions or stones
 * (`AGENT.md` §5), and the purchase list is filtered to the kinds `town.json` `invariants` allows.
 */

const TS = TOWN.task_sizing;
export const ALL_ROWS: any[] = [...TOWN.one_time, ...TOWN.repeatable];
export const rowById = (id: string) => ALL_ROWS.find((r) => r.id === id);
export const settlementById = (id: string) => TOWN.settlements.find((s: any) => s.id === id);
export const settlementOfZone = (zone: number) => TOWN.settlements.find((s: any) => s.zone === zone);
export const npcOf = (id: string) => TOWN.npcs.find((n: any) => n.id === id);
export const stockOf = (settlementId: string) =>
  ((settlementById(settlementId)?.stock || []) as string[]).map(rowById).filter(Boolean);

export const startSettlement = () => (TOWN.settlements.find((s: any) => s.start) || TOWN.settlements[0]).id;

/** The `m` a row charges at this settlement, honouring the teaching discount where one exists. */
export function priceMinutes(row: any, settlementId: string, state?: GameState): number {
  const s = settlementById(settlementId);
  if (row.discount && row.discount.settlement === s.id) return row.discount.m;
  // the pedlar's stock is a fresh roll of three slots each real day, priced inside its band
  if (row.id === 'pedlar_rotation' && state?.pedlar?.minutes?.length) {
    return state.pedlar.minutes[Math.min(state.pedlar.bought, state.pedlar.minutes.length - 1)];
  }
  return row.m != null ? row.m : row.m_min;
}

/** Gold = minutes of that band's full-sell junk income. */
export function priceGold(row: any, settlementId: string, state?: GameState): number {
  const s = settlementById(settlementId);
  const band = row.charge_band || s.band;
  return Math.round(priceMinutes(row, settlementId, state) * eng.goldPerMinute(band) * 100) / 100;
}

export function newTown(): TownState {
  const start = startSettlement();
  return {
    visited: [start], owned: [], waypoint: start, linksBought: 0,
    tasks: new Array(TS.slots).fill(null), refillAt: new Array(TS.slots).fill(0),
    skipsToday: 0, skipDay: 0,
  };
}

/** Standing is earned by kills in that settlement's own zone (`town.json` standing.earnt_from). */
export function standingShare(state: GameState, settlementId: string): number {
  const s = settlementById(settlementId);
  const budget = eng.BAND[s.band].kills_per_hr * s.budget_hr;
  return budget > 0 ? (state.counters.zoneKills[s.zone] || 0) / budget : 0;
}

export function standingTier(state: GameState, settlementId: string): number {
  const share = standingShare(state, settlementId);
  let tier = 0;
  TOWN.standing.tiers.forEach((t: any, i: number) => { if (share >= t.share) tier = i + 1; });
  return tier;
}

export function canTravel(state: GameState, settlementId: string): boolean {
  if (state.town.visited.includes(settlementId)) return true;
  if (settlementId === state.town.waypoint) return true;
  return state.town.owned.includes('road_link');
}

/** The road is bounded: 8 links exist, one per settlement beyond the free start (`one_time.road_link`). */
export const ROAD_LINKS = TOWN.settlements.length - 1;

export interface BuyResult { ok: boolean; why?: string; row?: any; gold?: number }

export function canBuy(state: GameState, settlementId: string, rowId: string): BuyResult {
  const row = rowById(rowId);
  if (!row) return { ok: false, why: 'no such line' };
  if (!(stockOf(settlementId) as any[]).some((r) => r.id === rowId)) return { ok: false, why: 'not stocked here' };
  if (!TOWN.invariants.allowed_kinds.includes(row.kind)) return { ok: false, why: 'that kind is not for sale' };
  const banned = TOWN.invariants.banned_power_nouns.map((n: string) => String(n).toLowerCase());
  // a display_only line is the game saying out loud that it sells no power ("sells no stone, no
  // gear"), so its label mentioning those words is not a purchase of them
  if (!row.display_only && banned.some((n: string) => new RegExp(`\\b${n}\\b`).test(String(row.item).toLowerCase()))) {
    return { ok: false, why: 'gold never buys power' };
  }
  if (row.qty && state.town.owned.filter((id) => id === rowId).length >= row.qty) return { ok: false, why: 'sold out here' };
  if (row.per_day_cap && dailyUsed(state, rowId) >= row.per_day_cap) return { ok: false, why: `daily cap of ${row.per_day_cap} reached` };
  const gold = priceGold(row, settlementId, state);
  if (state.counters.gold < gold) return { ok: false, why: `needs ${gold} gold`, row, gold };
  return { ok: true, row, gold };
}

/** How many of a capped line have been taken today — the skip token and the pedlar keep their own. */
export function dailyUsed(state: GameState, rowId: string): number {
  return rowId === 'pedlar_rotation' ? (state.pedlar?.bought || 0) : state.town.skipsToday;
}

/** Spend gold on a stall line. Purchases that grant no state change are display-only by design. */
export function buy(state: GameState, settlementId: string, rowId: string): BuyResult {
  const check = canBuy(state, settlementId, rowId);
  if (!check.ok) return check;
  const row = check.row;
  state.counters.gold = Math.round((state.counters.gold - (check.gold || 0)) * 100) / 100;
  state.town.owned.push(rowId);
  if (rowId === 'road_link') state.town.linksBought++;
  if (rowId === 'skip_token') state.town.skipsToday++;
  if (rowId === 'pedlar_rotation' && state.pedlar) state.pedlar.bought++;
  if (row.kind === 'time' && rowId.startsWith('waypoint_reanchor')) state.town.waypoint = settlementId;
  return check;
}

/** Junk is sold by hand at the Counterhand — the only gold mint besides the Road (`economy.md`). */
export function sellJunk(state: GameState): { pieces: number; gold: number } {
  let pieces = 0, gold = 0;
  for (const [rarity, count] of Object.entries(state.junkByRarity)) {
    if (!count) continue;
    pieces += count;
    gold += count * (E.junk.rarities[rarity] as any).sell_gold;
    state.junkByRarity[rarity] = 0;
  }
  state.counters.gold += gold;
  return { pieces, gold };
}

const groupUpper = (zone: number) => Number(String(eng.zoneById(zone).group).split('-')[1]) || 1;

/** N for a Hunt: the opening task's 5, scaled by the zone's own group size (`task_sizing`). */
export function huntN(zone: number): number {
  return Math.max(1, Math.round(TS.hunt_n_anchor * groupUpper(zone) / 2));
}

export function taskReward(kind: string, band: string): { stone: string; count: number } {
  const pay = eng.taskPayout(band, TS.reward_minutes_of_band_income);
  if (kind === 'elite') return { stone: 'tier', count: pay.tier };
  if (kind === 'boss') return { stone: 'remove', count: TS.boss_reward.remove };
  return { stone: 'reroll_value', count: pay.reroll_value };
}

/** The board offers tasks only from zones at or below where the player is fighting (`tasks.md`). */
export function rollTask(rng: () => number, state: GameState): TaskSlot {
  const maxZone = Math.max(1, Math.min(eng.ZONES.length, state.zone));
  const zone = 1 + Math.floor(rng() * maxZone);
  const roll = rng();
  const kind = roll < 0.6 ? 'hunt' : roll < 0.9 ? 'elite' : 'boss';
  const band = eng.zoneById(zone).quality.startsWith('high') ? 'high' : eng.zoneById(zone).quality.startsWith('mid') ? 'mid' : 'low';
  const n = kind === 'hunt' ? huntN(zone) : kind === 'elite' ? TS.elite_n : 1;
  const reward = taskReward(kind, band);
  return { kind, zone, n, progress: 0, stone: reward.stone as any, count: reward.count, claimed: false, offeredAt: state.clockSec };
}

/** No Bag Cap exists, so stash tabs are organisation rather than space (`loot.md` §4 · towns.md). */
export function stashTabCount(state: GameState): number {
  const bought = state.town.owned.filter((id: string) => /^stash_tab_\d/.test(id)).length;
  const houses = state.town.owned.filter((id: string) => /^house_/.test(id)).length * 2;
  // the Reliquary set pays a tab directly, bypassing the one-time price ladder
  const granted = state.grants ? state.grants.stash_tabs : 0;
  return Math.min(6, bought + houses + granted);
}

/** Deposit and withdraw only happen at a settlement (`inventory.note`). */
export function deposit(state: GameState, bagIndex: number, tab: number): { ok: boolean; why?: string } {
  if (tab >= stashTabCount(state)) return { ok: false, why: 'that tab is not bought yet' };
  const item = state.bag[bagIndex];
  if (!item) return { ok: false, why: 'nothing in that slot' };
  while (state.stash.length <= tab) state.stash.push([]);
  state.stash[tab].unshift(item);
  state.bag.splice(bagIndex, 1);
  return { ok: true };
}

export function withdraw(state: GameState, tab: number, index: number): { ok: boolean; why?: string } {
  const item = state.stash[tab]?.[index];
  if (!item) return { ok: false, why: 'empty' };
  if (state.bag.length >= E.inventory.adventure_slots) return { ok: false, why: 'the bag is full' };
  state.bag.unshift(item);
  state.stash[tab].splice(index, 1);
  return { ok: true };
}

/** Bulk deposit: high index first so the splice indices stay valid; a locked piece is left behind. */
export function depositMany(state: GameState, indices: number[], tab: number): number {
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

/** Bulk withdraw: stop at a full adventure bag; a locked piece stays where it is. */
export function withdrawMany(state: GameState, tab: number, indices: number[]): number {
  let moved = 0;
  for (const i of [...indices].sort((a, b) => b - a)) {
    const item = state.stash[tab]?.[i];
    if (!item || item.locked) continue;
    if (state.bag.length >= E.inventory.adventure_slots) break;
    state.bag.unshift(item);
    state.stash[tab].splice(i, 1);
    moved++;
  }
  return moved;
}

/** Kills feed the board the moment they match the slot's kind and zone. */
export function progressTasks(state: GameState, mobKind: string, zone: number) {
  for (const task of state.town.tasks) {
    if (!task || task.claimed || task.zone !== zone) continue;
    const isElite = mobKind === 'Elite';
    const isBoss = mobKind.startsWith('Boss');
    if (task.kind === 'hunt' && !isElite && !isBoss) task.progress = Math.min(task.n, task.progress + 1);
    else if (task.kind === 'elite' && isElite) task.progress = Math.min(task.n, task.progress + 1);
    else if (task.kind === 'boss' && isBoss) task.progress = Math.min(task.n, task.progress + 1);
  }
}

export function claimTask(state: GameState, index: number): boolean {
  const task = state.town.tasks[index];
  if (!task || task.progress < task.n || task.claimed) return false;
  task.claimed = true;
  state.counters.stones[task.stone] = (state.counters.stones[task.stone] || 0) + task.count;
  state.town.refillAt[index] = state.clockSec + TS.refill_sec;
  state.town.tasks[index] = null;
  return true;
}

/** Slots refill an hour after a claim; the free skip is once per slot per day (`tasks.md`). */
export function tickTown(state: GameState, rng: () => number) {
  const day = Math.floor(state.clockSec / 86400);
  if (day !== state.town.skipDay) { state.town.skipDay = day; state.town.skipsToday = 0; }
  state.town.tasks.forEach((task, i) => {
    if (!task && state.clockSec >= state.town.refillAt[i]) state.town.tasks[i] = rollTask(rng, state);
  });
}
