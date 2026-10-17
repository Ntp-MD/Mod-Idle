import path from 'node:path';
import { readJson } from './lib/json.ts';
import { gates, report } from './lib/gates.ts';
import { createTrade, type TradeCfg } from '../engine/trade.ts';
import { createFieldwork } from '../engine/fieldwork.ts';
import { createLifeSkills, type LifeSkillId } from '../engine/life-skills.ts';
import { ALCHEMY_LEDGER_VERSION, ALCHEMY_LEGACY_INTERVAL_V1, migrateAlchemyLedger, newAlchemyLedger, normalizeAlchemyLedger, previewAlchemyAdvance } from '../engine/alchemy.ts';
import { createBlackMarket, type BlackMarketCfg } from '../engine/black-market.ts';
import { createSkillModel } from '../engine/skills.ts';
import { STONE_NAME } from '../engine/craft.ts';
import type { EngineData, ModsData, SkillsData } from '../engine/types.ts';

const root = path.resolve(import.meta.dirname, '..');
const E = readJson<EngineData>(path.join(root, 'tools/data/engine.json'));
const T = readJson<{ trade: TradeCfg; black_market: BlackMarketCfg; settlements: { id: string; zone: number }[] }>(path.join(root, 'tools/data/town.json'));
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
for (const list of [E.fieldwork.materials, E.fieldwork.recipes, E.fieldwork.workshop_recipes, E.fieldwork.smithing_recipes]) {
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
for (const recipe of E.fieldwork.smithing_recipes) {
  checkCosts(recipe.name, 'material', recipe.materials);
  if (!Number.isSafeInteger(recipe.yield) || recipe.yield <= 0 || !Number.isSafeInteger(recipe.xp) || recipe.xp <= 0
    || !Number.isSafeInteger(recipe.mastery_xp) || recipe.mastery_xp <= 0) recipes.push(`${recipe.name}: invalid Smithing output or progression`);
}
G.add('TC4', !recipes.length, recipes.join(' · ') || 'cooking and workshop inputs name carried goods with positive whole costs; outputs have real values');

const whole = (value: number, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;
const nonnegative = (value: number) => Number.isFinite(value) && value >= 0;
const salvage: string[] = [];
for (const [key, amount] of Object.entries(E.salvage.outputs)) {
  if (!Object.hasOwn(trade.byId, `material:${key}`) || !whole(amount, 1) || amount > E.inventory.stack_size.material) {
    salvage.push(`${key}: salvage must produce a canonical material in a positive legal stack`);
  }
}
const A = E.salvage.alchemy;
if (!whole(A.scrap_cost, 1) || !whole(A.value_yield, 1) || !whole(A.outputs_per_tier_stone, 1)) salvage.push('Alchemy cost, Value output and Tier interval need positive safe integers');
if (!Object.hasOwn(trade.byId, 'material:scrap') || !whole(E.salvage.outputs.scrap, 1)) salvage.push('the Alchemy Scrap input must be obtainable from salvage');
if (!whole(E.inventory.stack_size.material, 1) || !whole(E.inventory.stack_size.stone, 1)) salvage.push('salvage/Alchemy inventory caps are invalid');
G.add('TC5', !salvage.length, salvage.join(' · ') || 'salvage produces canonical material bundles; Alchemy costs, outputs, intervals and inventory caps are safe');

const ledger: string[] = [];
try {
  // This is immutable migration history, deliberately independent of the live Tier interval.
  if (ALCHEMY_LEDGER_VERSION !== 1 || ALCHEMY_LEGACY_INTERVAL_V1 !== 500) ledger.push('unsupported pre-Alchemy milestone migration definition');
  for (const history of [0, ALCHEMY_LEGACY_INTERVAL_V1 - 1, ALCHEMY_LEGACY_INTERVAL_V1, ALCHEMY_LEGACY_INTERVAL_V1 + 1, Number.MAX_SAFE_INTEGER]) {
    const migrated = migrateAlchemyLedger(history, A.outputs_per_tier_stone);
    const remainder = Number(BigInt(history) % BigInt(ALCHEMY_LEGACY_INTERVAL_V1));
    if (migrated.legacyRemainder !== remainder || migrated.eligibleOutputs !== 0 || migrated.paidMilestones !== 0) ledger.push('legacy history repays milestones or loses fractional progress');
    const before = JSON.stringify(migrated);
    const future = previewAlchemyAdvance(migrated, A.value_yield);
    const expected = (BigInt(A.value_yield) * BigInt(ALCHEMY_LEGACY_INTERVAL_V1) + BigInt(remainder) * BigInt(A.outputs_per_tier_stone))
      / (BigInt(A.outputs_per_tier_stone) * BigInt(ALCHEMY_LEGACY_INTERVAL_V1));
    if (BigInt(future.tierDue) !== expected || JSON.stringify(migrated) !== before) ledger.push('Alchemy preview changes saved progress or rounds away legacy credit');
    if (JSON.stringify(normalizeAlchemyLedger(migrated, A.outputs_per_tier_stone, history)) !== before) ledger.push('repeat migration changes the saved ledger');
  }
  const snapshot = migrateAlchemyLedger(ALCHEMY_LEGACY_INTERVAL_V1 - 1, A.outputs_per_tier_stone);
  const alternativeInterval = A.outputs_per_tier_stone === Number.MAX_SAFE_INTEGER ? 1 : A.outputs_per_tier_stone + 1;
  if (normalizeAlchemyLedger(snapshot, alternativeInterval).interval !== snapshot.interval) ledger.push('live tuning overwrites an earned interval snapshot');
  const unsafe = newAlchemyLedger(A.outputs_per_tier_stone);
  unsafe.eligibleOutputs = Number.MAX_SAFE_INTEGER;
  let refused = false;
  try { previewAlchemyAdvance(unsafe, 1); } catch { refused = true; }
  if (!refused) ledger.push('unsafe eligible-output history can overflow');
} catch (error) { ledger.push(String(error)); }
G.add('TC6', !ledger.length, ledger.join(' · ') || 'versioned legacy credit, BigInt milestone arithmetic, repeat migration and saved interval snapshots preserve progress without overflow');

const F = E.fieldwork, L = F.life_skill_combat;
const progression: string[] = [];
for (const [name, cap, divisor] of [['field', F.level_cap, F.level_divisor], ['Farming', E.farm.level_cap, E.farm.level_divisor]] as const) {
  if (!whole(cap, 1) || cap > 100 || !Number.isFinite(divisor) || divisor <= 0) progression.push(`${name}: invalid level cap or XP divisor`);
}
if (!whole(F.mastery_cap, 1) || !Number.isFinite(F.mastery_divisor) || F.mastery_divisor <= 0) progression.push('invalid field Mastery cap or XP divisor');
if (!nonnegative(L.budget) || !nonnegative(L.track_cap)) progression.push('combat budget and per-track ceiling must be finite and nonnegative');
if (!L.rungs.length || L.rungs.some((rung, index) => !whole(rung, 1) || rung > Math.min(F.level_cap, E.farm.level_cap, 100) || index > 0 && rung <= L.rungs[index - 1])) progression.push('combat level rungs must be sorted, unique and within the level caps');
const tracks = new Set<LifeSkillId>(['mining', 'woodcutting', 'hunting', 'cooking', 'farming', 'fishing', 'smithing']);
const channels: Record<string, 'pct' | 'percentage_points'> = {
  armour_pct: 'pct', evasion_pct: 'pct', accuracy_pct: 'pct', hp_regen_pct: 'pct', mana_regen_pct: 'pct', armour_pen: 'percentage_points',
};
let totalWeight = 0;
for (const [id, weight] of Object.entries(L.weights)) {
  if (!tracks.has(id as LifeSkillId) || !nonnegative(weight)) progression.push(`${id}: invalid fixed combat weight`);
  totalWeight += weight;
  const effect = L.effects[id];
  if (!effect || !Object.hasOwn(channels, effect.stat) || channels[effect.stat] !== effect.unit) progression.push(`${id}: unknown combat effect channel or unit`);
}
if (!Number.isFinite(totalWeight) || totalWeight > 1 + Number.EPSILON * Object.keys(L.weights).length) progression.push('fixed combat weights exceed the aggregate budget');
for (const id of Object.keys(L.effects)) if (!Object.hasOwn(L.weights, id)) progression.push(`${id}: effect has no authored allocation`);
try {
  const math = createLifeSkills(F);
  const maximum = math.bonuses(Object.fromEntries([...tracks].map((id) => [id, Math.max(F.level_cap, E.farm.level_cap)])));
  const total = Object.values(maximum).reduce((sum, amount) => sum + amount, 0);
  if (!nonnegative(total) || total > L.budget + Number.EPSILON * Math.max(1, L.budget) * tracks.size) progression.push('shared combat math exceeds the configured normalized budget');
  if (Object.values(math.bonuses({})).some((amount) => amount !== 0)) progression.push('unearned life skills create combat power');
} catch (error) { progression.push(String(error)); }
G.add('TC7', !progression.length, progression.join(' · ') || 'level rungs, fixed track weights, known effect units and shared combat allocation respect the configured budget');

const activities: string[] = [];
const fw = createFieldwork(F);
for (const [key, amount] of Object.entries(F.fishing)) {
  if (key !== 'foods' && (!whole(amount as number, 1))) activities.push(`Fishing ${key}: expected a positive safe integer`);
}
for (const id of F.fishing.foods) {
  if (!Object.hasOwn(fw.foodById, id) || !Object.hasOwn(trade.byId, `food:${id}`)) activities.push(`unknown Fishing food ${id}`);
  if (!Object.values(F.regional_sources).some((source) => source.food === id)) activities.push(`${id}: Fishing source has no authored regional location`);
}
if (new Set(F.fishing.foods).size !== F.fishing.foods.length) activities.push('Fishing food sources are duplicated');
for (const recipe of F.smithing_recipes) {
  if (!Object.hasOwn(fw.materialById, recipe.id) || !Object.hasOwn(trade.byId, `material:${recipe.id}`)) activities.push(`${recipe.id}: unknown Smithing output material`);
  if (fw.workshopById[recipe.id]?.skill !== 'smithing') activities.push(`${recipe.id}: Smithing recipe has the wrong progression owner`);
  if (!whole(recipe.level, 1) || recipe.level > F.level_cap || !whole(recipe.xp, 1) || !whole(recipe.mastery_xp, 1) || !whole(recipe.yield, 1)) activities.push(`${recipe.id}: invalid unlock, output or XP/Mastery reward`);
  for (const [input, count] of Object.entries(recipe.materials)) if (!Object.hasOwn(fw.materialById, input) || !whole(count, 1)) activities.push(`${recipe.id}: invalid Smithing input ${input}`);
  if (F.workshop_recipes.some((existing) => existing.id === recipe.id)) activities.push(`${recipe.id}: Smithing replaces an existing workshop recipe`);
}
G.add('TC8', !activities.length, activities.join(' · ') || 'Fishing uses authored regional foods and safe action rewards; Smithing inputs, outputs, unlocks and track ownership resolve');

const blackMarket: string[] = [];
const B = T.black_market;
const M = readJson<ModsData>(path.join(root, 'tools/data/mods.json'));
const S = readJson<SkillsData>(path.join(root, 'tools/data/skills.json'));
const sm = createSkillModel(S, E);
const positive = (value: number) => Number.isFinite(value) && value > 0;
const bands = new Set(E.mob.zones.map((zone) => zone.quality.split(' ')[0]));
for (const key of ['refresh_interval_sec', 'offers_per_refresh', 'item_count_min', 'item_count_max'] as const) {
  if (!whole(B[key], 1)) blackMarket.push(`Black Market ${key}: expected a positive safe integer`);
}
if (B.item_count_min > B.item_count_max) blackMarket.push('Black Market material quantity range is inverted');
if (!positive(B.resale_cover_multiplier)) blackMarket.push('Black Market resale cover must be finite and positive');
for (const [rarity, multiplier] of Object.entries(B.rarity_price_multiplier)) {
  if (!bands.has(rarity) || !positive(multiplier)) blackMarket.push(`invalid Black Market rarity multiplier ${rarity}`);
}
for (const row of B.materials) {
  if (!row.good.startsWith('material:') || !Object.hasOwn(trade.byId, row.good) || trade.byId[row.good]?.bucket !== 'material') blackMarket.push(`unknown Black Market material ${row.good}`);
  if (!nonnegative(row.weight) || !Object.hasOwn(B.rarity_price_multiplier, row.rarity)) blackMarket.push(`invalid Black Market material weight or rarity ${row.good}`);
}
const stoneExists = (key: string) => key !== 'imprint' && Object.hasOwn(STONE_NAME, key)
  || key.startsWith('imprint_') && M.mods.some((mod) => mod.id === key.slice('imprint_'.length));
for (const row of B.stones) {
  if (!stoneExists(row.key) || !nonnegative(row.weight) || !whole(row.count_min, 1) || !whole(row.count_max, 1)
    || row.count_min > row.count_max || !positive(row.price_gold)) blackMarket.push(`invalid Black Market stone ${row.key}`);
}
for (const [id, weight] of Object.entries(B.skill_weights)) {
  if (!Object.hasOwn(sm.byId, id) || !nonnegative(weight)) blackMarket.push(`invalid Black Market named-skill weight ${id}`);
}
for (const row of B.skill_level_offers) {
  if (!whole(row.level, 1) || row.level > E.skill_xp.level_cap || !nonnegative(row.weight) || !positive(row.price_gold)) blackMarket.push(`invalid Black Market XP-level offer ${row.level}`);
}
if (!B.skill_level_offers.some((row) => row.level === E.skill_xp.level_cap && positive(row.weight))
  || !Object.values(B.skill_weights).some(positive)) blackMarket.push('Black Market maximum XP-level skills need an explicit positive generation weight');
try {
  const market = createBlackMarket(E, B, trade, sm);
  const peak = Math.max(C.floor_mult, C.neutral_peak, C.import_peak, C.export_peak);
  for (const candidate of market.candidates) for (const count of new Set([candidate.countMin, candidate.countMax])) {
    const price = market.price(candidate, count);
    // Fresh demand can never pay more than this linear bound, even when split across towns.
    const resale = candidate.kind === 'material' ? trade.byId[candidate.key].value * peak * count : 0;
    if (!positive(price) || price > Number.MAX_SAFE_INTEGER || !(price > resale)) blackMarket.push(`${candidate.key}/${count}: purchase price fails the conservative market resale bound`);
  }
} catch (error) { blackMarket.push(String(error)); }
G.add('TC9', !blackMarket.length, blackMarket.join(' · ') || 'Black Market material/stone/skill identities and ranges resolve; explicit max XP-level stock is generatable and prices exceed the market resale ceiling');
report(G.rows());
