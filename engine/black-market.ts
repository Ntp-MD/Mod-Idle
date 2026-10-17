import type { EngineData } from './types.ts';
import type { createTrade } from './trade.ts';
import type { createSkillModel } from './skills.ts';

export interface BlackMarketCfg {
  refresh_interval_sec: number; offers_per_refresh: number; item_count_min: number; item_count_max: number;
  resale_cover_multiplier: number; rarity_price_multiplier: Record<string, number>;
  materials: { good: string; weight: number; rarity: string }[];
  stones: { key: string; weight: number; count_min: number; count_max: number; price_gold: number }[];
  skill_weights: Record<string, number>;
  skill_level_offers: { level: number; weight: number; price_gold: number }[];
}
export interface BlackMarketOffer {
  id: string; kind: 'material' | 'stone' | 'skill'; good?: string; stone?: string; skill?: string;
  level?: number; count: number; price: number; remaining: number;
}

/** Catalogue and prices are pure snapshots; the town simulator owns stock, refresh timing and purchases. */
export function createBlackMarket(
  E: EngineData, C: BlackMarketCfg, trade: ReturnType<typeof createTrade>, skills: ReturnType<typeof createSkillModel>,
) {
  const skillById = skills.byId;
  type Candidate = { kind: BlackMarketOffer['kind']; key: string; level?: number; weight: number; countMin: number; countMax: number; priceEach: number };
  const candidates: Candidate[] = [];
  for (const row of C.materials) {
    const good = trade.byId[row.good];
    if (!good) continue;
    const peak = Math.max(trade.C.floor_mult, trade.C.neutral_peak, trade.C.import_peak, trade.C.export_peak);
    candidates.push({ kind: 'material', key: row.good, weight: row.weight, countMin: C.item_count_min, countMax: C.item_count_max,
      priceEach: good.value * peak * C.resale_cover_multiplier * (C.rarity_price_multiplier[row.rarity] || 1) });
  }
  for (const row of C.stones) candidates.push({ kind: 'stone', key: row.key, weight: row.weight, countMin: row.count_min, countMax: row.count_max, priceEach: row.price_gold });
  for (const id of Object.keys(C.skill_weights).sort()) for (const level of C.skill_level_offers) {
    if (skillById[id] && level.level <= E.skill_xp.level_cap) candidates.push({ kind: 'skill', key: id, level: level.level,
      weight: C.skill_weights[id] * level.weight, countMin: 1, countMax: 1, priceEach: level.price_gold });
  }
  const price = (candidate: Candidate, count: number) => {
    const decimals = trade.C.currency_decimals, unit = 10 ** -decimals;
    return trade.floorCurrency(candidate.priceEach * count + unit);
  };
  const roll = (town: string, serial: number, rng: () => number): BlackMarketOffer[] => {
    const pool = candidates.filter((candidate) => candidate.weight > 0).map((candidate) => ({ ...candidate }));
    const out: BlackMarketOffer[] = [];
    for (let slot = 0; slot < C.offers_per_refresh && pool.length; slot++) {
      const total = pool.reduce((sum, row) => sum + row.weight, 0);
      let roll = rng() * total;
      let index = pool.findIndex((row) => (roll -= row.weight) < 0);
      if (index < 0) index = pool.length - 1;
      const candidate = pool.splice(index, 1)[0];
      const count = candidate.countMin + Math.floor(rng() * (candidate.countMax - candidate.countMin + 1));
      const id = `black-market:${town}:${serial + slot + 1}`;
      out.push({ id, kind: candidate.kind, ...(candidate.kind === 'material' ? { good: candidate.key } : {}),
        ...(candidate.kind === 'stone' ? { stone: candidate.key } : {}), ...(candidate.kind === 'skill' ? { skill: candidate.key, level: candidate.level } : {}),
        count, price: price(candidate, count), remaining: 1 });
    }
    return out;
  };
  return { C, candidates, roll, price };
}
