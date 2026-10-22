import path from 'node:path';
import { readJson } from './lib/json.ts';
import { gates, report } from './lib/gates.ts';
import { createEngine } from '../engine/index.ts';
import { createTrade, type TradeCfg } from '../engine/trade.ts';
import { createDelivery, type DeliveryCfg } from '../engine/delivery.ts';
import { STONE_NAME } from '../engine/craft.ts';
import type { EngineData, ModsData, SkillsData } from '../engine/types.ts';

const root = path.resolve(import.meta.dirname, '..');
const E = readJson<EngineData>(path.join(root, 'tools/data/engine.json'));
const T = readJson<{ delivery: DeliveryCfg; trade: TradeCfg; settlements: { id: string; zone: number }[];
  quest_rewards: { milestone_tree_points: number; expedition_skill_choice: boolean } }>(path.join(root, 'tools/data/town.json'));
const M = readJson<ModsData>(path.join(root, 'tools/data/mods.json'));
const S = readJson<SkillsData>(path.join(root, 'tools/data/skills.json'));
const C = T.delivery;
const G = gates();
const positive = (value: number) => Number.isFinite(value) && value > 0;
const nonnegative = (value: number) => Number.isFinite(value) && value >= 0;
const whole = (value: number, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;
const probability = (value: number) => nonnegative(value) && value <= 1;

const ranges: string[] = [];
for (const key of ['derivation_version', 'trigger_interval_sec', 'active_slots', 'count_min', 'count_max', 'minimum_stones'] as const) {
  if (!whole(C[key], 1)) ranges.push(`${key}: expected a positive safe integer`);
}
for (const key of ['history_limit', 'deadline_min_sec', 'deadline_max_sec', 'deadline_allowance_sec'] as const) {
  if (!whole(C[key])) ranges.push(`${key}: expected a nonnegative safe integer`);
}
if (!(C.count_min <= C.count_max)) ranges.push('count_min exceeds count_max');
if (!(C.deadline_min_sec <= C.deadline_max_sec)) ranges.push('deadline_min_sec exceeds deadline_max_sec');
if (!positive(C.stack_share) || C.stack_share > 1) ranges.push('stack_share must lie in (0, 1]');
if (!Number.isFinite(C.production_allowance) || C.production_allowance < 1) ranges.push('production_allowance must cover production time');
for (const key of ['reward_minutes', 'fallback_minutes', 'default_target_weight', 'default_skill_weight'] as const) {
  if (!positive(C[key])) ranges.push(`${key}: expected a finite positive value`);
}
if (!Number.isFinite(C.premium_base) || C.premium_base < 1) ranges.push('premium_base cannot promise a negative bonus');
for (const key of ['premium_per_difficulty', 'processing_weight', 'count_exponent'] as const) {
  if (!nonnegative(C[key])) ranges.push(`${key}: expected a finite nonnegative value`);
}
if (!probability(C.trigger_chance) || !probability(C.skill_chance)) ranges.push('trigger and skill chances must lie in [0, 1]');
if (!Array.isArray(C.pause_states) || C.pause_states.some((state) => !['camp', 'dungeon'].includes(state))
  || new Set(C.pause_states).size !== C.pause_states.length) ranges.push('pause_states contains an unknown or repeated state');
G.add('DC1', !ranges.length, ranges.join(' · ') || 'delivery intervals, quantities, probabilities and deadline/reward coefficients have valid ranges');

const eng = createEngine(E);
const trade = createTrade(E, T.trade);
const delivery = createDelivery(E, C, trade, eng);
const bands = new Set(E.mob.zones.map((zone) => zone.quality.split(' ')[0]));
const rarities = new Set(['common', ...Object.keys(E.junk.rarities)]);
const weights: string[] = [];
for (const [key, value] of Object.entries(C.band_weights)) if (!bands.has(key) || !positive(value)) weights.push(`invalid band weight ${key}`);
for (const band of bands) {
  if (!positive(C.band_weights[band])) weights.push(`missing band weight ${band}`);
  if (!nonnegative(C.skill_band_weights[band]) || !probability(C.skill_chance * C.skill_band_weights[band])) weights.push(`invalid effective skill chance for ${band}`);
}
for (const key of Object.keys(C.skill_band_weights)) if (!bands.has(key)) weights.push(`unknown skill band ${key}`);
for (const [key, value] of Object.entries(C.rarity_weights)) if (!rarities.has(key) || !positive(value)) weights.push(`invalid rarity weight ${key}`);
for (const rarity of rarities) if (!positive(C.rarity_weights[rarity])) weights.push(`missing rarity weight ${rarity}`);
const targetKeys = new Set([...trade.goods.map((good) => good.id), ...trade.goods.map((good) => good.bucket)]);
for (const [key, value] of Object.entries(C.target_weights)) if (!targetKeys.has(key) || !nonnegative(value)) weights.push(`invalid target override ${key}`);
const skillIds = new Set(S.skills.map((skill) => skill.id));
for (const [key, value] of Object.entries(C.skill_weights)) if (!skillIds.has(key) || !nonnegative(value)) weights.push(`invalid skill override ${key}`);
G.add('DC2', !weights.length, weights.join(' · ') || 'band, rarity, target and named-skill weights reference canonical content and valid probabilities');

const graph: string[] = [];
const zones = new Set(E.mob.zones.map((zone) => zone.id));
for (const town of T.settlements) if (!zones.has(town.zone)) graph.push(`${town.id}: unknown issuing zone`);
for (const [key, sources] of Object.entries(delivery.sources)) {
  if (!Object.hasOwn(trade.byId, key)) graph.push(`unknown source output ${key}`);
  for (const source of sources) {
    if (!zones.has(source.zone) || !nonnegative(source.seconds) || !positive(source.yield) || !Number.isSafeInteger(source.yield)) graph.push(`${key}: invalid source zone, duration or yield`);
    if (source.level !== undefined && !whole(source.level, 1)) graph.push(`${key}: invalid source unlock level`);
    if (source.seed !== undefined && !whole(source.seed)) graph.push(`${key}: invalid seed quantity`);
    if (source.rarity && !rarities.has(source.rarity)) graph.push(`${key}: unknown source rarity ${source.rarity}`);
    for (const [input, quantity] of Object.entries(source.inputs || {})) {
      if (!Object.hasOwn(trade.byId, input) || !whole(quantity, 1)) graph.push(`${key}: invalid recipe input ${input}`);
      else if (!delivery.sources[input]?.length) graph.push(`${key}: input ${input} has no acquisition source`);
    }
  }
}
const visited = new Set<string>(), visiting = new Set<string>();
function visit(key: string): void {
  if (visiting.has(key)) { graph.push(`cyclic acquisition input ${key}`); return; }
  if (visited.has(key)) return;
  visiting.add(key);
  for (const source of delivery.sources[key] || []) for (const input of Object.keys(source.inputs || {})) visit(input);
  visiting.delete(key); visited.add(key);
}
for (const key of Object.keys(delivery.sources)) visit(key);
G.add('DC3', !graph.length, graph.join(' · ') || 'acquisition outputs, recipe inputs, source durations, zones and dependency graphs resolve');

const caps: string[] = [];
for (const good of trade.goods) {
  const capKind = good.bucket === 'junk' ? 'stone' : good.bucket;
  const cap = E.inventory.stack_size[capKind];
  if (!whole(cap, 1) || delivery.capFor(good) !== cap) caps.push(`${good.id}: incorrect ${capKind} stack cap`);
  const maximum = Math.min(C.count_max, Math.floor(cap * C.stack_share));
  if (!whole(maximum) || maximum > cap) caps.push(`${good.id}: delivery sizing exceeds its stack cap`);
}
G.add('DC4', !caps.length, caps.join(' · ') || 'target stack caps use their canonical inventory kind; junk uses the stone cap');

const rewards: string[] = [];
const incomeKeys = new Set(['tier', 'reroll_value', 'add']);
const stoneExists = (key: string) => typeof key === 'string' && (key !== 'imprint' && Object.hasOwn(STONE_NAME, key)
  || key.startsWith('imprint_') && M.mods.some((mod) => mod.id === key.slice('imprint_'.length)));
if (!incomeKeys.has(C.fallback_stone) || !stoneExists(C.fallback_stone)) rewards.push('invalid fallback stone or income source');
if (!Array.isArray(C.reward_modes) || !C.reward_modes.length || C.reward_modes.some((mode) => !['fixed', 'choice'].includes(mode))) rewards.push('reward_modes must contain supported offer modes');
if (!positive(C.choice_reward_mult)) rewards.push('choice_reward_mult must be finite and positive');
if (!whole(T.quest_rewards?.milestone_tree_points, 1) || typeof T.quest_rewards?.expedition_skill_choice !== 'boolean') rewards.push('quest milestone and skill-choice configuration is invalid');
if (!C.stones.some((stone) => positive(stone.weight))) rewards.push('stone selection has no positive weight');
for (const stone of C.stones) {
  if (!stoneExists(stone.key) || !incomeKeys.has(stone.income) || !nonnegative(stone.weight)) rewards.push(`invalid stone reward ${stone.key}`);
  if (incomeKeys.has(stone.income)) for (const band of bands) {
    const reward = delivery.stoneBundle(band, 1, stone.key, stone.income);
    if (!whole(reward.count, 1)) rewards.push(`${band}/${stone.key}: invalid shared task payout`);
  }
}
G.add('DC5', !rewards.length, rewards.join(' · ') || 'stone and imprint rewards resolve; named-skill overrides and shared task payouts retain valid identities and units');
report(G.rows());
