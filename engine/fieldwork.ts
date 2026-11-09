import type { CampPoolFacts, CampPoolRow, CampPoolSeen, FieldworkCfg, Rng } from './types.ts';
import { storyHash32 } from './storyteller.ts';

export type CacheOffer = { revision: 1; foodId: string; materialId: string; unitYield: number; carefulSec: number; quickOutcome: 'gain' | 'mixed' | 'loss' };
export type CachePreviewOutcome = { id: 'careful' | 'gain' | 'mixed' | 'loss'; chance: number; materialCount: number; foodLoss: number };
export type CachePreview = { choice: 'careful' | 'quick'; timeSec: number; maxFoodLoss: number; outcomes: readonly CachePreviewOutcome[] };
export type CacheResult = { outcome: 'careful' | 'gain' | 'mixed' | 'loss'; materialCount: number; foodLoss: number; sceneId: string };

const KINDS = new Set(['sounds', 'prowler', 'traveler', 'nest', 'discovered', 'supply-cache']);
const REQS = new Set(['local-mobs', 'traveler-offer', 'worksite', 'exposure-threshold', 'idle-cache']);
const MIN_REQS: Record<string, readonly string[]> = {
  sounds: ['local-mobs'], prowler: ['local-mobs'], traveler: ['traveler-offer'],
  nest: ['local-mobs', 'worksite'], discovered: ['local-mobs', 'exposure-threshold'], 'supply-cache': ['idle-cache'],
};
const FACT_KEY: Record<string, keyof CampPoolFacts> = {
  'local-mobs': 'localMobs', 'traveler-offer': 'travelerOffer', 'worksite': 'worksite',
  'exposure-threshold': 'exposureThreshold', 'idle-cache': 'idleCache',
};

function validateCampPoolRows(pool: unknown, campSceneIds: ReadonlySet<string>, recentLimit: number): readonly CampPoolRow[] {
  const fail = (msg: string): never => { throw new Error(`camp.event_pool: ${msg}`); };
  if (!Array.isArray(pool) || !pool.length) fail('must be a nonempty array');
  const ids = new Set<string>();
  const list = pool as CampPoolRow[];
  let cumulative = 0;
  for (let i = 0; i < list.length; i++) {
    const row = list[i] as CampPoolRow;
    const path = `[${i}]`;
    if (!row || typeof row !== 'object') fail(`${path} must be an object`);
    const keys = Object.keys(row).sort().join(',');
    if (keys !== 'id,kind,repeat_gap_events,requires,scene_id,weight') fail(`${path} has unknown or missing fields: ${keys}`);
    if (typeof row.id !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(row.id)) fail(`${path}.id malformed`);
    if (ids.has(row.id)) fail(`${path}.id duplicate ${row.id}`);
    ids.add(row.id);
    if (!KINDS.has(row.kind)) fail(`${path}.kind unknown ${row.kind}`);
    if (typeof row.scene_id !== 'string' || !campSceneIds.has(row.scene_id)) fail(`${path}.scene_id unknown ${row.scene_id}`);
    if (!Number.isFinite(row.weight) || row.weight <= 0) fail(`${path}.weight must be positive finite`);
    cumulative += row.weight;
    if (!Number.isFinite(cumulative)) fail(`${path}.weight cumulative overflow`);
    if (!Array.isArray(row.requires) || new Set(row.requires).size !== row.requires.length) fail(`${path}.requires duplicates`);
    for (const req of row.requires) if (!REQS.has(req)) fail(`${path}.requires unknown ${req}`);
    const min = MIN_REQS[row.kind] ?? [];
    // No extra executable conditions: requires must equal the minimum set for the kind.
    if (row.requires.length !== min.length || row.requires.some((r) => !min.includes(r))) fail(`${path}.requires must be exactly [${min.join(', ')}] for kind ${row.kind}`);
    if (!Number.isSafeInteger(row.repeat_gap_events) || row.repeat_gap_events < 0 || row.repeat_gap_events > recentLimit) fail(`${path}.repeat_gap_events must be safe integer 0..${recentLimit}`);
  }
  return pool as readonly CampPoolRow[];
}

function eligibleCampPoolRows(
  pool: readonly CampPoolRow[],
  enabledKinds: readonly string[],
  facts: CampPoolFacts,
  history: readonly CampPoolSeen[],
  nextSerial: number,
  avoidConsecutive: boolean,
): readonly CampPoolRow[] {
  if (!Number.isSafeInteger(nextSerial) || nextSerial < 1) throw new Error('eligibleCampPool: nextSerial must be a positive safe integer');
  for (const entry of history) {
    if (!entry || typeof entry.eventId !== 'string' || !KINDS.has(entry.kind) || !Number.isSafeInteger(entry.encounterId) || entry.encounterId >= nextSerial) {
      throw new Error(`eligibleCampPool: invalid history entry ${JSON.stringify(entry)}`);
    }
  }
  const base = pool.filter((row) => enabledKinds.includes(row.kind) && row.requires.every((req) => facts[FACT_KEY[req]]));
  if (!base.length) return [];
  const latest = new Map<string, number>();
  for (const entry of history) latest.set(entry.eventId, Math.max(latest.get(entry.eventId) ?? -1, entry.encounterId));
  const preferred = base.filter((row) => {
    const last = latest.get(row.id);
    return last === undefined || nextSerial - last > row.repeat_gap_events;
  });
  let retained: CampPoolRow[];
  if (preferred.length) retained = preferred;
  else {
    let oldest = Infinity;
    for (const row of base) {
      const last = latest.get(row.id);
      if (last !== undefined && last < oldest) oldest = last;
    }
    retained = base.filter((row) => latest.get(row.id) === oldest);
  }
  if (avoidConsecutive && history.length) {
    const newest = history[history.length - 1];
    if (retained.some((row) => row.kind !== newest.kind)) retained = retained.filter((row) => row.kind !== newest.kind);
  }
  return retained;
}

export function selectCampPool(rows: readonly CampPoolRow[], draw: number): CampPoolRow | null {
  if (!rows.length) return null;
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error(`selectCampPool: draw ${draw} outside [0,1)`);
  let total = 0;
  for (const row of rows) {
    if (!Number.isFinite(row.weight) || row.weight <= 0) throw new Error(`selectCampPool: row ${row.id} weight must be positive finite`);
    total += row.weight;
  }
  if (!Number.isFinite(total)) throw new Error('selectCampPool: total weight overflow');
  const point = draw * total;
  let cumulative = 0;
  for (const row of rows) {
    cumulative += row.weight;
    if (point < cumulative) return row;
  }
  return rows[rows.length - 1];
}

export function selectCampVariant(input: { seed: number; serial: number; eventId: string; variantIds: readonly string[]; recentIds: readonly string[] }): string {
  if (!input.variantIds.length) throw new Error('selectCampVariant: no variants');
  let available = input.variantIds.filter((id) => !input.recentIds.includes(id));
  if (!available.length) available = [...input.variantIds];
  return available[storyHash32(`${input.seed}|${input.serial}|${input.eventId}`) % available.length];
}

export function createCacheHelpers(F: FieldworkCfg) {
  const cacheCfg = () => {
    const c = (F.camp_encounters as any).cache;
    if (!c) throw new Error('cacheOffer: camp cache config missing');
    return c;
  };
  const outcomes = () => {
    const c = cacheCfg();
    const rows = c.outcomes as { id: string; weight: number; yield_mult: number; food_loss: number }[];
    if (!Array.isArray(rows) || !rows.length) throw new Error('cacheOffer: outcomes missing');
    return rows;
  };
  const unitYield = () => {
    const y = F.actions.mine.yield;
    if (!Number.isSafeInteger(y) || y <= 0) throw new Error('cacheOffer: mine yield must be a positive integer');
    return y;
  };
  const carefulSec = () => Math.ceil(cacheCfg().careful_intervals * F.actions.mine.interval_sec);
  const sum = () => outcomes().reduce((t, o) => t + o.weight, 0);

  function cacheOffer(zone: number, regionalFoodId: string, draw: number): CacheOffer {
    if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error(`cacheOffer: draw ${draw} outside [0,1)`);
    if (!regionalFoodId) throw new Error('cacheOffer: regional food required');
    const c = cacheCfg();
    const rows = outcomes();
    const total = sum();
    const point = draw * total;
    let cumulative = 0;
    let quickOutcome: 'gain' | 'mixed' | 'loss' = rows[rows.length - 1].id as 'gain' | 'mixed' | 'loss';
    for (const row of rows) {
      cumulative += row.weight;
      if (point < cumulative) { quickOutcome = row.id as typeof quickOutcome; break; }
    }
    return { revision: 1, foodId: regionalFoodId, materialId: c.material_id, unitYield: unitYield(), carefulSec: carefulSec(), quickOutcome };
  }
  function cachePreview(offer: CacheOffer, choice: 'careful' | 'quick'): CachePreview {
    const c = cacheCfg();
    const rows = outcomes();
    const total = sum();
    const carefulOutcomes: CachePreviewOutcome[] = [{ id: 'careful', chance: 1, materialCount: offer.unitYield * c.careful_yield_mult, foodLoss: 0 }];
    if (choice === 'careful') return { choice, timeSec: offer.carefulSec, maxFoodLoss: 0, outcomes: carefulOutcomes };
    const outcomesList: CachePreviewOutcome[] = rows.map((row) => ({
      id: row.id as CachePreviewOutcome['id'],
      chance: row.weight / total,
      materialCount: offer.unitYield * row.yield_mult,
      foodLoss: row.food_loss,
    }));
    const maxFoodLoss = Math.max(0, ...rows.map((row) => row.food_loss));
    return { choice, timeSec: 0, maxFoodLoss, outcomes: outcomesList };
  }
  function cacheResult(offer: CacheOffer, choice: 'careful' | 'quick'): CacheResult {
    const c = cacheCfg();
    const rows = outcomes();
    if (choice === 'careful') return { outcome: 'careful', materialCount: offer.unitYield * c.careful_yield_mult, foodLoss: 0, sceneId: 'cache-careful-result' };
    const row = rows.find((r) => r.id === offer.quickOutcome) ?? rows[rows.length - 1];
    return { outcome: row.id as CacheResult['outcome'], materialCount: offer.unitYield * row.yield_mult, foodLoss: row.food_loss, sceneId: `cache-${row.id}-result` };
  }
  return { cacheOffer, cachePreview, cacheResult };
}

/** Shared field-skill reads. Runtime resource counts stay in the game state; the formulas and unlocks
 *  are derived from engine.json so the client and any data cage use the same progression. */
export function createFieldwork(F: FieldworkCfg) {
  const skillLevel = (xp: number) => Math.min(F.level_cap, Math.floor(Math.sqrt(Math.max(0, xp) / F.level_divisor)) + 1);
  const masteryLevel = (xp: number) => Math.min(F.mastery_cap, Math.floor(Math.sqrt(Math.max(0, xp) / F.mastery_divisor)) + 1);
  const harvestBonus = (level: number) => F.progression.harvest_bonus_levels
    .filter((milestone) => level >= milestone).length * F.progression.harvest_bonus_per_level;
  const dropChanceAt = (baseChance: number, level: number, mastery: number) => {
    const levelBonus = Math.max(0, level - 1) * F.progression.drop_rate_bonus_per_skill_level_pct;
    const masteryBonus = Math.max(0, mastery - 1) * F.progression.drop_rate_bonus_per_mastery_level_pct;
    const bonusPct = Math.min(F.progression.drop_rate_bonus_cap_pct, levelBonus + masteryBonus);
    return Math.min(1, Math.max(0, baseChance) * (1 + bonusPct / 100));
  };
  const recipeById = Object.fromEntries(F.recipes.map((recipe) => [recipe.id, recipe]));
  // A cooking recipe owns its cooked provision too. Newly authored dishes must be edible and
  // available to Auto Eat without a second manually maintained food row.
  const foods = [...F.foods.filter((food) => !recipeById[food.id]), ...F.recipes.map((recipe) => ({
    id: recipe.id, name: recipe.name, kind: 'cooked' as const, hunger_restore: recipe.hunger_restore,
    edible: true, auto_eat: true, source: F.foods.find((food) => food.id === recipe.id)?.source || 'cooking',
  }))];
  const foodById = Object.fromEntries(foods.map((food) => [food.id, food]));
  const materialById = Object.fromEntries(F.materials.map((material) => [material.id, material]));
  const workshopRecipes = [...F.workshop_recipes, ...F.smithing_recipes.map((recipe) => ({ ...recipe, skill: 'smithing' as const }))];
  const workshopById = Object.fromEntries(workshopRecipes.map((recipe) => [recipe.id, recipe]));
  const rollTrailSite = (cells: { q: number; r: number }[], rng: Rng) => {
    if (!cells.length || rng() >= F.map_exploration.spawn.chance_per_check) return null;
    const kinds = Object.entries(F.map_exploration.kinds);
    let draw = rng() * kinds.reduce((sum, [, kind]) => sum + kind.weight, 0);
    const kind = kinds.find(([, entry]) => (draw -= entry.weight) < 0)?.[0];
    return kind ? { ...cells[Math.floor(rng() * cells.length)], kind } : null;
  };
  const cache = createCacheHelpers(F);
  // The public pool API owns its catalog/config, so callers cannot pass a second candidate
  // list or a different limit at runtime (plan §4.5.4).
  const validateCampPool = (campSceneIds: ReadonlySet<string>): void => {
    validateCampPoolRows(F.camp_encounters.event_pool, campSceneIds, F.camp_encounters.story.recent_limit);
  };
  const eligibleCampPool = (facts: CampPoolFacts, history: readonly CampPoolSeen[], nextSerial: number) =>
    eligibleCampPoolRows(F.camp_encounters.event_pool, F.camp_encounters.kinds, facts, history, nextSerial, F.camp_encounters.story.avoid_consecutive_kind);
  return { F, foods, skillLevel, masteryLevel, harvestBonus, dropChanceAt, recipeById, foodById, materialById, workshopById, workshopRecipes, rollTrailSite, validateCampPool, eligibleCampPool, selectCampPool, selectCampVariant, ...cache };
}
