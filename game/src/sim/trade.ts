import { TOWN, trade, fieldwork } from '../engine/client';
import type { TradeGood } from '../../../engine/trade';
import type { GameState } from './types';
import { atSettlement } from './craft';
import { currentCell, ownerOf, cellBlocks, settlementCell, warpCost } from './road';
import { addTo, fits } from './slots';
import { fieldSkillLevel } from './fieldwork';

export { trade };
export type { TradeGood };
export function tradeBucket(state: GameState, good: TradeGood): Record<string, number> {
  return good.bucket === 'junk' ? state.junk : good.bucket === 'material' ? state.fieldwork.materials
    : good.bucket === 'food' ? state.fieldwork.foods : state.farm.herbs;
}
export const tradeInventory = (state: GameState) => trade.goods
  .map((good) => ({ good, count: tradeBucket(state, good)[good.key] || 0 })).filter((row) => row.count > 0);

export function quoteSale(state: GameState, town: string, id: string, count: number) {
  const good = trade.byId[id];
  if (!good || !TOWN.trade.towns[town as keyof typeof TOWN.trade.towns]) return null;
  const quote = trade.quote(town, good, count, state.town.market?.[town]?.[good.group], state.clockSec);
  const total = quote.gold + (state.town.marketCredit || 0);
  const scale = 10 ** trade.C.currency_decimals;
  const precision = Number.EPSILON * Math.max(1, total) * scale;
  const gold = Math.floor((total + precision) * scale) / scale;
  return { ...quote, gold, credit: Math.max(0, total - gold) };
}

/** Supply is shared by category at a town. Quotes are reads; only a successful sale spends demand. */
export function sellGoods(state: GameState, id: string, count: number): { ok: boolean; why?: string; pieces: number; gold: number } {
  const refused = (why: string) => ({ ok: false, why, pieces: 0, gold: 0 });
  if (!atSettlement(state)) return refused('stand in a settlement to sell');
  const good = trade.byId[id];
  if (!good) return refused('this item has no buyer');
  if (!Number.isSafeInteger(count) || count <= 0) return refused('choose a whole quantity above zero');
  const bucket = tradeBucket(state, good);
  if ((bucket[good.key] || 0) < count) return refused('not enough carried');
  const town = ownerOf(currentCell(state)).id;
  const quote = quoteSale(state, town, id, count);
  if (!quote) return refused('this settlement has no market');
  bucket[good.key] -= count;
  state.town.market ||= {};
  state.town.market[town] ||= {};
  state.town.market[town][good.group] = { used: quote.used, atSec: quote.atSec };
  state.town.marketCredit = quote.credit;
  state.counters.gold += quote.gold;
  return { ok: true, pieces: count, gold: quote.gold };
}

export function marketDestinations(state: GameState, id: string, count: number) {
  return TOWN.settlements.map((town) => {
    const blocks = cellBlocks(state, settlementCell(town.id)!);
    return { town, quote: quoteSale(state, town.id, id, count)!, blocks,
      fare: blocks === 0 ? 0 : state.town.visited.includes(town.id) ? warpCost(state, town.id) : null };
  }).sort((a, b) => b.quote.gold - a.quote.gold || a.blocks - b.blocks);
}

export function canProcess(state: GameState, id: string): { ok: boolean; why?: string } {
  const recipe = fieldwork.workshopById[id];
  if (!recipe) return { ok: false, why: 'unknown workshop recipe' };
  if (!atSettlement(state)) return { ok: false, why: 'visit a settlement workshop' };
  if (fieldSkillLevel(state, recipe.skill) < recipe.level) return { ok: false, why: `${recipe.skill} level ${recipe.level} required` };
  const costs = Object.entries(recipe.materials as Record<string, number>).map(([key, amount]) => ({ bucket: state.fieldwork.materials, key, amount, capKind: 'material' }));
  for (const cost of costs) if ((cost.bucket[cost.key] || 0) < cost.amount) return { ok: false, why: `needs ${cost.amount} ${fieldwork.materialById[cost.key]?.name || cost.key}` };
  if (!fits(state, state.fieldwork.materials, id, 'material', recipe.yield, costs)) return { ok: false, why: 'make room in the character bag' };
  return { ok: true };
}

export function processMaterials(state: GameState, id: string): { ok: boolean; why?: string } {
  const verdict = canProcess(state, id);
  if (!verdict.ok) return verdict;
  const recipe = fieldwork.workshopById[id];
  for (const [key, amount] of Object.entries(recipe.materials as Record<string, number>)) state.fieldwork.materials[key] -= amount;
  addTo(state, state.fieldwork.materials, id, 'material', recipe.yield);
  state.fieldwork.skills[recipe.skill as 'mining' | 'woodcutting'].xp += recipe.xp;
  return { ok: true };
}
