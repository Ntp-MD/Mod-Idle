import { E } from '../engine/client';
import { previewAlchemyAdvance } from '../../../engine/alchemy.ts';
import { fitsTransaction } from './slots';
import { atSettlement } from './craft';
import type { GameState } from './types';

export { alchemyTierProgress } from '../../../engine/alchemy.ts';

export function previewScrapAlchemy(s: GameState, access: { writer: boolean } = { writer: true }) {
  const refuse = (why: string) => ({ ok: false as const, why });
  if (!access.writer) return refuse('this tab is read-only');
  if (!atSettlement(s) || s.dungeon || s.walk || s.phase === 'camp' || s.hunting || s.group.length || s.fieldwork.action) return refuse('stand idle at a settlement to use Alchemy');
  const recipe = E.salvage.alchemy;
  if (!Number.isSafeInteger(recipe.scrap_cost) || recipe.scrap_cost <= 0 || !Number.isSafeInteger(recipe.value_yield) || recipe.value_yield <= 0) return refuse('invalid Alchemy recipe');
  let future: ReturnType<typeof previewAlchemyAdvance>;
  try { future = previewAlchemyAdvance(s.alchemy, recipe.value_yield); } catch { return refuse('invalid Alchemy progress'); }
  const costs = [{ bucket: s.fieldwork.materials, key: 'scrap', capKind: 'material', amount: recipe.scrap_cost }];
  const grants = [{ bucket: s.counters.stones, key: 'reroll_value', capKind: 'stone', amount: recipe.value_yield },
    { bucket: s.counters.stones, key: 'tier', capKind: 'stone', amount: future.tierDue }];
  if ((s.fieldwork.materials.scrap || 0) < recipe.scrap_cost) return refuse(`needs ${recipe.scrap_cost} Scrap`);
  if (!fitsTransaction(s, costs, grants)) return refuse('make bag room for all Value and Tier stones');
  return { ok: true as const, future, costs, grants };
}

/** A batch is a sequence of independently preflighted single recipes; stop at the first refusal. */
export function transmuteScrap(s: GameState, count = 1, access: { writer: boolean } = { writer: true }) {
  if (!Number.isSafeInteger(count) || count < 1) return { ok: false, made: 0, tier: 0, why: 'choose a positive whole batch' };
  let made = 0, tier = 0;
  for (let index = 0; index < count; index++) {
    const preview = previewScrapAlchemy(s, access);
    if (!preview.ok) return { ok: made > 0, made, tier, why: preview.why };
    for (const cost of preview.costs) cost.bucket[cost.key] -= cost.amount;
    for (const grant of preview.grants) grant.bucket[grant.key] = (grant.bucket[grant.key] || 0) + grant.amount;
    s.alchemy = preview.future.ledger;
    made += E.salvage.alchemy.value_yield;
    tier += preview.future.tierDue;
  }
  return { ok: true, made, tier };
}
