import { eng, TOWN, trade } from '../../engine/client';
import type { GameState, Item } from '../core/types';
import type { Where } from '../gear/craft';

/**
 * The town's authored rows and their price lines. This is the leaf the rest of the sim reads
 * (`road.ts` prices a Waypoint warp, the HUD prints the same number), so it owns no flow: it
 * mutates nothing and imports no other sim module. Town flow stays in `town.ts`.
 */

export const ALL_ROWS: any[] = [...TOWN.one_time, ...TOWN.repeatable];
export const rowById = (id: string) => ALL_ROWS.find((r) => r.id === id);
export const settlementById = (id: string) => TOWN.settlements.find((s: any) => s.id === id);
export const settlementOfZone = (zone: number) => TOWN.settlements.find((s: any) => s.zone === zone);
export const npcOf = (id: string) => TOWN.npcs.find((n: any) => n.id === id);

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

export interface TownPurchaseTarget { where: Where; index: number }
export interface TownPurchaseQuote {
  normalGold: number; gold: number;
  promotion: ReturnType<typeof trade.townPromotion> | null; token: string;
}
export interface TownPurchaseExpectation { token: string; target?: TownPurchaseTarget }

const REPAIR_ROWS = new Set(['repair', 'repair_ironrow']);

/** The first Broken piece in the gear-then-bag order every repair path has always used. */
export function firstBroken(state: GameState): { where: Where; index: number; item: Item } | null {
  const worn = state.gear.findIndex((item) => item?.broken);
  if (worn >= 0) return { where: 'gear', index: worn, item: state.gear[worn]! };
  const bag = state.bag.findIndex((item) => item?.broken);
  if (bag >= 0) return { where: 'bag', index: bag, item: state.bag[bag]! };
  return null;
}

function hintPurchased(state: GameState, settlementId: string): number {
  const set = (TOWN.collector_sets as any[]).find((row) => row.settlement === settlementId);
  return set && state.collector?.hints?.[set.id] ? 1 : 0;
}

function purchaseToken(state: GameState, settlementId: string, rowId: string, promotionId: string | null, gold: number, target: TownPurchaseTarget | null): string {
  const item = target ? (target.where === 'gear' ? state.gear[target.index] : state.bag[target.index]) : null;
  const parts: unknown[] = [
    settlementId, rowId, promotionId, gold, state.counters.gold,
    (state.town?.owned || []).filter((id: string) => id === rowId).length,
    rowId === 'collector_hint' ? hintPurchased(state, settlementId) : 0,
    target ? [target.where, target.index, JSON.stringify(item ?? null)] : null,
  ];
  for (const part of parts) {
    if (typeof part === 'number' && !Number.isFinite(part)) throw new Error('purchase quote: non-finite value');
  }
  return JSON.stringify(parts);
}

/** One promoted-aware quote for a row; `token` is null only when no state is given. */
function quoteForRow(state: GameState | undefined, settlementId: string, row: any, blocks: number, target?: TownPurchaseTarget): {
  normalGold: number; gold: number; promotion: ReturnType<typeof trade.townPromotion> | null; token: string | null;
} {
  const s = settlementById(settlementId)!;
  // a teaching discount is priced at the settlement's own band, the price its note and the wiki state;
  // every other line charges the band the row names
  const discounted = row.discount && row.discount.settlement === s.id;
  const band = discounted ? s.band : (row.charge_band || s.band);
  const minutes = priceMinutes(row, settlementId, state, blocks);
  const income = eng.goldPerMinute(band);
  const xp = state?.town.hagglingXp ?? 0;
  const normalGold = trade.serviceGold(minutes, income, xp, 0);
  const promotion = state && TOWN.storyteller_promotions
    ? trade.townPromotion(state.seed, settlementId, state.clockSec, ((s.stock || []) as string[]), TOWN.storyteller_promotions)
    : null;
  const promoted = promotion && promotion.rowId === row.id ? promotion : null;
  const gold = promoted ? trade.serviceGold(minutes, income, xp, promoted.discountPct) : normalGold;
  let token: string | null = null;
  if (state) {
    const resolved = target ?? (REPAIR_ROWS.has(row.id) ? firstBroken(state) : null);
    token = purchaseToken(state, settlementId, row.id, promoted?.id ?? null, gold,
      resolved ? { where: resolved.where, index: resolved.index } : null);
  }
  return { normalGold, gold, promotion: promoted, token };
}

/** The current quote for a row, including the promotion-aware price, savings and stable token. */
export function quoteTownPurchase(state: GameState, settlementId: string, rowId: string, target?: TownPurchaseTarget): TownPurchaseQuote {
  const row = rowById(rowId);
  if (!row) throw new Error(`quoteTownPurchase: unknown row ${rowId}`);
  const quote = quoteForRow(state, settlementId, row, 1, target);
  return { ...quote, token: quote.token! };
}

/** Gold = the promoted service price for that row; without state there is no timed promotion. */
export function priceGold(row: any, settlementId: string, state?: GameState, blocks = 1): number {
  return quoteForRow(state, settlementId, row, blocks).gold;
}
