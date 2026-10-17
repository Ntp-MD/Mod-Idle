import type { EngineData } from './types.ts';
import { createFieldwork } from './fieldwork.ts';

export interface TradeCfg {
  currency_decimals: number;
  floor_mult: number; neutral_peak: number; import_peak: number; export_peak: number;
  capacity_gold: number; recovery_sec: number; recipe_value_mult: number; workshop_value_mult: number;
  food_values: Record<string, number>; herb_values: Record<string, number>; material_values: Record<string, number>;
  junk_groups: Record<string, string[]>;
  towns: Record<string, { imports: string[]; exports: string[]; needs: string }>;
}
export interface MarketSupply { used: number; atSec: number }
export interface TradeGood {
  id: string; key: string; name: string; bucket: 'junk' | 'material' | 'food' | 'herb';
  group: string; value: number; sourceZones: number[]; uses: string[];
}

/** One catalogue and one price curve for both the client and reports. No gameplay RNG is spent. */
export function createTrade(E: EngineData, C: TradeCfg) {
  const floorCurrency = (value: number) => {
    const scale = 10 ** C.currency_decimals;
    return Math.floor((value + Number.EPSILON * Math.max(1, value) * scale) * scale) / scale;
  };
  const settleCurrency = (value: number, credit = 0) => {
    const total = value + credit;
    const gold = floorCurrency(total);
    return { gold, credit: Math.max(0, total - gold) };
  };
  const fw = createFieldwork(E.fieldwork);
  const byId: Record<string, TradeGood> = {};
  const add = (bucket: TradeGood['bucket'], key: string, name: string, group: string, value: number, sourceZones: number[] = []) => {
    const id = `${bucket}:${key}`;
    byId[id] = { id, key, name, bucket, group, value, sourceZones, uses: [] };
  };
  const zonesFor = (key: string) => Object.entries(E.fieldwork.regional_sources)
    .filter(([, sources]) => Object.values(sources).includes(key)).map(([zone]) => Number(zone));
  for (const material of E.fieldwork.materials) add('material', material.id, material.name, material.group, C.material_values[material.id] || 0, zonesFor(material.id));
  for (const food of fw.foods) add('food', food.id, food.name, food.kind, C.food_values[food.kind], zonesFor(food.id));
  for (const [tier, value] of Object.entries(C.herb_values)) add('herb', tier, `${tier[0].toUpperCase()}${tier.slice(1)} Herb`, 'herb', value);
  const speciesById = Object.fromEntries(E.mob.species.map((species) => [species.id, species]));
  const addJunk = (item: string, rarity: string, speciesId: string) => {
    const species = speciesById[speciesId];
    const group = Object.entries(C.junk_groups).find(([, ids]) => ids.includes(speciesId))?.[0];
    if (species) add('junk', item, item, group ? `junk:${group}` : 'junk', E.junk.rarities[rarity]?.sell_gold || 0, species.zones);
  };
  for (const [speciesId, variants] of Object.entries(E.mob.variants || {})) for (const variant of variants) {
    const drop = E.mob.variant_drops?.[variant.name];
    if (drop) addJunk(drop.item, drop.rarity, speciesId);
  }
  for (const unique of E.mob.uniques || []) {
    const drop = E.mob.variant_drops?.[unique.name];
    if (drop) addJunk(drop.item, drop.rarity, unique.species);
  }
  for (const species of E.mob.species) for (const [rarity, item] of Object.entries(species.junk_items || {})) addJunk(item, rarity, species.id);
  const inputValue = (bucket: TradeGood['bucket'], costs: Record<string, number>, recipeName: string) => Object.entries(costs).reduce((sum, [key, count]) => {
    const good = byId[`${bucket}:${key}`];
    if (good) good.uses.push(recipeName);
    return sum + (good?.value || 0) * count;
  }, 0);
  for (const recipe of E.fieldwork.workshop_recipes) {
    byId[`material:${recipe.id}`].value = inputValue('material', recipe.materials, recipe.name) * C.workshop_value_mult / recipe.yield;
  }
  for (const recipe of E.fieldwork.smithing_recipes) {
    byId[`material:${recipe.id}`].value = inputValue('material', recipe.materials, recipe.name) * C.workshop_value_mult / recipe.yield;
  }
  for (const recipe of E.fieldwork.recipes) {
    byId[`food:${recipe.id}`].value = (inputValue('food', recipe.foods, recipe.name) + inputValue('material', recipe.materials, recipe.name)
      + inputValue('herb', recipe.herbs, recipe.name)) * C.recipe_value_mult;
  }
  for (const id of ['ore', 'timber']) byId[`material:${id}`].uses.push('Camp relocation');
  for (const tier of Object.keys(C.herb_values)) byId[`herb:${tier}`].uses.push('Potion brewing');
  const matches = (list: string[], good: TradeGood) => list.includes(good.id) || list.includes(good.group);
  const peak = (town: string, good: TradeGood) => {
    const profile = C.towns[town];
    return profile && matches(profile.imports, good) ? C.import_peak
      : profile && matches(profile.exports, good) ? C.export_peak : C.neutral_peak;
  };
  const usedAt = (supply: MarketSupply | undefined, now: number) => supply
    ? Math.min(C.capacity_gold, Math.max(0, supply.used - Math.max(0, now - supply.atSec) * C.capacity_gold / C.recovery_sec)) : 0;
  const quote = (town: string, good: TradeGood, count: number, supply: MarketSupply | undefined, now: number) => {
    const units = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
    const volume = units * good.value;
    const used = usedAt(supply, now);
    const remaining = C.capacity_gold - used;
    // Integral of the declining premium. Bulk and individual sales earn the same total.
    const area = (remaining ** 2 - Math.max(0, remaining - volume) ** 2) / (2 * C.capacity_gold);
    const gold = volume * C.floor_mult + area * (peak(town, good) - C.floor_mult);
    return { count: units, gold, demand: remaining / C.capacity_gold, used: Math.min(C.capacity_gold, used + volume), atSec: now };
  };
  return { C, byId, goods: Object.values(byId), peak, usedAt, quote, floorCurrency, settleCurrency };
}
