import path from 'node:path';
import { readJson } from './lib/json.ts';
import { gates, report } from './lib/gates.ts';
import { createTrade, type TradeCfg } from '../engine/trade.ts';
import type { EngineData } from '../engine/types.ts';

const root = path.resolve(import.meta.dirname, '..');
const E = readJson<EngineData>(path.join(root, 'tools/data/engine.json'));
const T = readJson<{ trade: TradeCfg; settlements: { id: string; zone: number }[] }>(path.join(root, 'tools/data/town.json'));
const trade = createTrade(E, T.trade);
const G = gates();
const C = T.trade;
G.add('TC1', [C.floor_mult, C.neutral_peak, C.import_peak, C.export_peak, C.capacity_gold, C.recovery_sec, C.recipe_value_mult, C.workshop_value_mult].every((n) => Number.isFinite(n) && n > 0)
  && [C.neutral_peak, C.import_peak, C.export_peak].every((n) => n >= C.floor_mult)
  && Number.isInteger(C.currency_decimals) && C.currency_decimals >= 0 && C.currency_decimals <= 100,
  'market coefficients are finite and positive; peaks cannot invert the supply price curve; currency precision is valid');

const problems: string[] = [];
if (![E.fieldwork.regional_drop_chance, E.fieldwork.regional_food_chance].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)
  || !Number.isInteger(E.fieldwork.regional_food_yield) || E.fieldwork.regional_food_yield <= 0) problems.push('regional gathering needs valid probabilities and a positive whole forage yield');
for (const good of trade.goods) if (!Number.isFinite(good.value) || good.value <= 0) problems.push(`${good.id}: invalid base value`);
for (const zone of E.mob.zones) {
  const source = E.fieldwork.regional_sources[String(zone.id)];
  if (!source) { problems.push(`zone ${zone.id}: no regional source`); continue; }
  if (trade.byId[`material:${source.mine}`]?.group !== 'ore') problems.push(`zone ${zone.id}: unknown Mine mineral`);
  if (trade.byId[`material:${source.grove}`]?.group !== 'wood') problems.push(`zone ${zone.id}: unknown Grove wood`);
  if (!trade.byId[`food:${source.food}`]) problems.push(`zone ${zone.id}: unknown forage`);
}
const members = Object.values(C.junk_groups).flat();
for (const id of members) if (!E.mob.species.some((species) => species.id === id)) problems.push(`unknown commercial junk Species ${id}`);
for (const sp of E.mob.species) if (members.filter((id) => id === sp.id).length !== 1) problems.push(`${sp.id}: needs one explicit commercial junk group`);
G.add('TC2', !problems.length, problems.join(' · ') || `${trade.goods.length} valued goods and every zone's regional supplies resolve; commercial junk groups are explicit and independent of Race`);

const markets: string[] = [];
const keys = new Set([...trade.goods.map((good) => good.id), ...trade.goods.map((good) => good.group)]);
for (const town of T.settlements) {
  const profile = C.towns[town.id];
  if (!profile) { markets.push(`${town.id}: no market profile`); continue; }
  for (const id of [...profile.imports, ...profile.exports]) if (!keys.has(id)) markets.push(`${town.id}: unknown market good or category ${id}`);
}
for (const id of Object.keys(C.towns)) if (!T.settlements.some((town) => town.id === id)) markets.push(`orphan market ${id}`);
G.add('TC3', !markets.length, markets.join(' · ') || 'every settlement buyer references real goods and categories; no orphan markets');

const recipes: string[] = [];
for (const list of [E.fieldwork.materials, E.fieldwork.recipes, E.fieldwork.workshop_recipes]) {
  if (new Set(list.map((row) => row.id)).size !== list.length) recipes.push('catalogue or recipe IDs are duplicated');
}
const checkCosts = (name: string, bucket: string, costs: Record<string, number>) => {
  for (const [id, count] of Object.entries(costs)) if (!trade.byId[`${bucket}:${id}`] || !Number.isInteger(count) || count <= 0) recipes.push(`${name}: invalid ${bucket} input ${id}`);
};
for (const recipe of E.fieldwork.recipes) {
  checkCosts(recipe.name, 'material', recipe.materials); checkCosts(recipe.name, 'food', recipe.foods); checkCosts(recipe.name, 'herb', recipe.herbs);
}
for (const recipe of E.fieldwork.workshop_recipes) {
  checkCosts(recipe.name, 'material', recipe.materials);
  if (!Number.isInteger(recipe.yield) || recipe.yield <= 0) recipes.push(`${recipe.name}: invalid yield`);
}
G.add('TC4', !recipes.length, recipes.join(' · ') || 'cooking and workshop inputs name carried goods with positive whole costs; outputs have real values');
report(G.rows());
