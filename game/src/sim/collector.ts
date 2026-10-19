import { TOWN, TD, BD } from '../engine/client';
import { createCollector } from '../../../engine/collector.ts';
import { standingTier } from './town';
import type { GameState } from './types';
import type { Item } from './types';
import { atSettlement } from './craft';

/** The set rules live in the shared module, next to the Bases they name. */
export const col: any = createCollector(TD, BD);

export interface Grants {
  filter_presets: number;
  stash_tabs: number;
  titles: string[];
  banners: string[];
}

export function newGrants(): Grants {
  return { filter_presets: 0, stash_tabs: 0, titles: [], banners: [] };
}

export function newCollector(): { done: Record<string, boolean>; hints: Record<string, boolean> } {
  return { done: {}, hints: {} };
}

/** The configured Standing tier opens the set slots (`town.json` standing.collector_required_tier). */
export function setUnlocked(state: GameState, set: any): boolean {
  return standingTier(state, set.settlement) >= TOWN.standing.collector_required_tier;
}

/** Held pieces may sit in the bag or in the stash; the Collector reads both. */
export function heldFor(state: GameState, setId: string): { item: Item; where: 'bag' | 'stash'; at: number; sub?: number }[] {
  const out: { item: Item; where: 'bag' | 'stash'; at: number; sub?: number }[] = [];
  state.bag.forEach((item, i) => { if (item.heldFor === setId) out.push({ item, where: 'bag', at: i }); });
  state.stash.forEach((tab, t) => tab.forEach((item, i) => {
    if (item.heldFor === setId) out.push({ item, where: 'stash', at: t, sub: i });
  }));
  return out;
}

export function heldCount(state: GameState, setId: string, baseName: string): number {
  return heldFor(state, setId).filter((h) => h.item.base === baseName).length;
}

/** The set a fresh drop belongs to, if the player has not finished it yet. */
export function wants(state: GameState, item: Item): any {
  return col.wanter(item, state.collector.done);
}

/**
 * Turn a set in: consume one held piece per line, pay the item itself, and mark the set finished so
 * the filter stops holding pieces for it. There is no gold in any Collector payout (T14).
 */
export function turnIn(state: GameState, settlementId: string): { ok: boolean; why?: string; reward?: string } {
  if (!atSettlement(state, settlementId)) return { ok: false, why: 'stand in this settlement to turn in the set' };
  const set = col.setAt(settlementId);
  if (!set) return { ok: false, why: 'no Collector set here' };
  if (!setUnlocked(state, set)) {
    const tier = TOWN.standing.collector_required_tier;
    const name = TOWN.standing.tiers[tier - 1]?.name ?? String(tier);
    return { ok: false, why: `Tier ${name} Standing in this settlement opens the set slots` };
  }
  if (state.collector.done[set.id]) return { ok: false, why: 'this set is already turned in' };
  // nothing the player pinned moves (`gear.ts`'s own rule, the same one salvage and the bulk verbs
  // keep): a locked held piece is invisible to the turn-in, so the set reports what is missing
  const held = heldFor(state, set.id).filter((h) => !h.item.locked);
  const used: typeof held = [];
  for (const p of set.parsed) {
    const found = held.find((h) => h.item.base === p.name && !used.includes(h));
    if (!found) {
      const pinned = heldFor(state, set.id).find((h) => h.item.base === p.name && h.item.locked);
      return { ok: false, why: pinned ? `missing ${p.name} — the piece you hold is locked` : `missing ${p.name}` };
    }
    used.push(found);
  }
  // remove by descending index so earlier removals cannot shift the ones still to come
  used.filter((u) => u.where === 'bag').map((u) => u.at).sort((a, b) => b - a)
    .forEach((i) => state.bag.splice(i, 1));
  used.filter((u) => u.where === 'stash').map((u) => ({ tab: u.at, sub: u.sub! }))
    .sort((a, b) => (a.tab === b.tab ? b.sub - a.sub : b.tab - a.tab))
    .forEach((p) => state.stash[p.tab].splice(p.sub, 1));
  state.collector.done[set.id] = true;
  applyReward(state, set);
  return { ok: true, reward: set.reward };
}

function applyReward(state: GameState, set: any) {
  const reward = String(set.reward);
  if (/stash tab/i.test(reward)) state.grants.stash_tabs += 1;
  if (/preset slot/i.test(reward)) state.grants.filter_presets += 1;
  if (/banner/i.test(reward)) state.grants.banners.push(`${set.name} banner`);
  if (/title/i.test(reward)) state.grants.titles.push(`${set.name} title`);
}
