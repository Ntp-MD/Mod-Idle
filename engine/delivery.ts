import type { EngineData } from './types.ts';
import type { createEngine } from './index.ts';
import type { createTrade, TradeGood } from './trade.ts';
import { leanReweightMany } from './loot.ts';

export interface DeliveryCfg {
  derivation_version: number; trigger_interval_sec: number; trigger_chance: number; active_slots: number;
  history_limit: number; count_min: number; count_max: number; stack_share: number;
  deadline_min_sec: number; deadline_max_sec: number; production_allowance: number; deadline_allowance_sec: number;
  reward_minutes: number; fallback_minutes: number; minimum_stones: number;
  premium_base: number; premium_per_difficulty: number; processing_weight: number; count_exponent: number;
  band_weights: Record<string, number>; rarity_weights: Record<string, number>; target_weights: Record<string, number>;
  default_target_weight: number; skill_chance: number; default_skill_weight: number;
  skill_weights: Record<string, number>; skill_band_weights: Record<string, number>;
  stones: { key: string; income: 'tier' | 'reroll_value' | 'add'; weight: number }[];
  fallback_stone: 'tier' | 'reroll_value' | 'add'; pause_states: ('camp' | 'dungeon')[];
}
export interface AcquisitionContext {
  owned: Record<string, number>; levels: Record<string, number>; zones: number[];
  canCamp: (zone: number, kind: string) => boolean; canHunt: (zone: number) => boolean;
  camp: { zone: number; kind: string } | null; freeRelocations: number; campCosts: Record<string, number>;
  plots: { tier: string | null; readyAt: number }[]; plotCapacity: number; now: number;
  travelFromCurrent: (zone: number, kind: string) => number;
  travelBetween: (from: number, to: number, fromKind: string, toKind: string) => number;
}
export interface AcquisitionStep { good: string; kind: string; zone: number; quantity: number; seconds: number }
export interface Acquisition {
  steps: AcquisitionStep[]; productionSec: number; travelSec: number; band: string;
  rarity: string; processing: number; difficulty: number; sourceBand?: string;
}
interface Source {
  kind: string; zone: number; skill?: string; level?: number; seconds: number; yield: number;
  inputs?: Record<string, number>; rarity?: string; camp?: boolean; firstWait?: number; seed?: number;
}

export function createDelivery(E: EngineData, C: DeliveryCfg, trade: ReturnType<typeof createTrade>, eng: ReturnType<typeof createEngine>) {
  const F = E.fieldwork;
  const sources: Record<string, Source[]> = {};
  const add = (id: string, source: Source) => {
    const list = sources[id] ||= [];
    const same = ['mine', 'grove'].includes(source.kind) && list.find((row) => row.kind === source.kind && row.zone === source.zone);
    if (same) same.seconds = 1 / (1 / same.seconds + 1 / source.seconds);
    else list.push(source);
  };
  const band = (zone: number) => E.mob.zones.find((z) => z.id === zone)!.quality.split(' ')[0];
  const herbChance = (b: string) => b === 'high' ? E.herbs.high_chance : b === 'mid' ? E.herbs.mid_chance : 0;
  const junkTotal = Object.values(E.junk.rarities as Record<string, { drop_chance_per_kill: number }>).reduce((sum, row) => sum + row.drop_chance_per_kill, 0);
  const tickPerKill = E.loot.ttk_per_mob_sec;
  const positive = (n: number) => Number.isFinite(n) && n > 0;
  for (const zone of E.mob.zones) {
    const eligibleDrops = Math.max(0, eng.BAND[band(zone.id)].drops_per_hr - eng.BAND[band(zone.id)].upgrades_per_hr);
    if (eligibleDrops > 0) add('material:scrap', { kind: 'salvage', zone: zone.id, seconds: 3600 / eligibleDrops, yield: 1 });
    for (const [action, cfg] of Object.entries(F.actions)) {
      if (action === 'fish') continue;
      const skill = action === 'mine' ? 'mining' : 'woodcutting';
      add(`material:${cfg.resource}`, { kind: action, zone: zone.id, skill, seconds: cfg.interval_sec / cfg.yield, yield: 1, camp: true });
      if (positive(cfg.rare_drop_chance)) add(`material:${cfg.rare_resource}`, { kind: action, zone: zone.id, skill, seconds: cfg.interval_sec / cfg.rare_drop_chance, yield: 1, camp: true });
      if (cfg.food_id && positive(cfg.food_drop_chance || 0)) add(`food:${cfg.food_id}`, { kind: action, zone: zone.id, skill, seconds: cfg.interval_sec / cfg.food_drop_chance!, yield: 1, camp: true });
      const regional = F.regional_sources[String(zone.id)];
    if (regional && F.fishing.foods.includes(regional.food)) {
      add(`food:${regional.food}`, { kind: 'fish', zone: zone.id, skill: 'fishing', camp: true, seconds: F.fishing.interval_sec / F.fishing.yield, yield: F.fishing.yield });
    }
      if (regional) {
        add(`material:${regional[action as 'mine' | 'grove']}`, { kind: action, zone: zone.id, skill, seconds: cfg.interval_sec / (F.regional_drop_chance * cfg.yield), yield: 1, camp: true });
        if (action === 'grove') add(`food:${regional.food}`, { kind: action, zone: zone.id, skill, seconds: cfg.interval_sec / (F.regional_food_chance * F.regional_food_yield), yield: 1, camp: true });
      }
    }
    const cast = E.mob.species.filter((sp) => sp.zones.includes(zone.id));
    for (const sp of cast) {
      const sides = (zone.subzones || []).filter((side) => side.species.includes(sp.id));
      if (!sides.length) continue;
      const density = 1 / Math.min(...sides.map((side) => side.species.length));
      const huntRate = (chance: number, amount: number) => tickPerKill / (density * chance * amount);
      if (F.hunt.edible_species.includes(sp.id)) add('food:raw_game_meat', { kind: 'hunt', zone: zone.id, skill: 'hunting', seconds: huntRate(F.hunt.meat_drop_chance, (F.hunt.meat_min + F.hunt.meat_max) / 2), yield: 1 });
      for (const row of F.hunt.food_drops) if (row.species.includes(sp.id)) add(`food:${row.food_id}`, { kind: 'hunt', zone: zone.id, skill: 'hunting', seconds: huntRate(row.chance, (row.min + row.max) / 2), yield: 1 });
      for (const row of F.hunt.material_drops || []) if (row.species.includes(sp.id)) add(`material:${row.resource}`, { kind: 'hunt', zone: zone.id, skill: 'hunting', seconds: huntRate(row.chance, (row.min + row.max) / 2), yield: 1 });
      const normal = eng.variantsInZone(sp.id, zone.id);
      const unique = (E.mob.uniques || []).filter((u) => u.species === sp.id);
      const rows = [...normal.map((v) => ({ name: v.name, share: 1 - E.loot.unique_chance })), ...unique.map((u) => ({ name: u.name, share: E.loot.unique_chance / unique.length }))];
      for (const entry of rows) {
        const drop = E.mob.variant_drops?.[entry.name];
        if (!drop || !positive(entry.share)) continue;
        const bestRate = Math.max(...sides.map((side) => {
          const weights = leanReweightMany({ gear: eng.dropChance(band(zone.id)), herb: herbChance(band(zone.id)), junk: junkTotal }, [drop.lean, E.mob.environment_lean?.[side.environment] || 'none'], E.loot.variant_lean.shift_pct);
          return weights.junk / junkTotal / side.species.length;
        }));
        const alternative = (sp.junk_items as Record<string, string> | undefined)?.[drop.rarity];
        const choices = [...new Set([drop.item, alternative].filter((id): id is string => !!id))];
        const chance = E.junk.rarities[drop.rarity]?.drop_chance_per_kill * bestRate * entry.share / choices.length;
        if (positive(chance)) for (const item of choices) add(`junk:${item}`, { kind: 'hunt', zone: zone.id, seconds: tickPerKill / chance, yield: 1, rarity: drop.rarity });
      }
    }
    const b = band(zone.id);
    if (positive(herbChance(b))) add(`herb:${b}`, { kind: 'hunt', zone: zone.id, seconds: tickPerKill / (herbChance(b) * (E.herbs.bundle_min + E.herbs.bundle_max) / 2), yield: 1 });
    const totalWeight = F.travel_events.events.reduce((sum, row) => sum + row.weight, 0);
    for (const event of F.travel_events.events) if (event.kind === 'food' && event.food_id) {
      const chance = F.travel_events.chance_per_block * event.weight / totalWeight;
      add(`food:${event.food_id}`, { kind: 'trail', zone: zone.id, seconds: E.road.block_sec / (chance * (event.amount_min! + event.amount_max!) / 2), yield: 1 });
    }
    for (const tier of Object.keys(E.farm.tier_unlock_level)) add(`herb:${tier}`, { kind: 'farm', zone: zone.id, skill: 'farming', level: E.farm.tier_unlock_level[tier], seconds: E.farm.growth_hours * 3600, yield: E.farm.yield_per_harvest, seed: E.farm.seed_cost_herbs });
    for (const recipe of F.recipes) add(`food:${recipe.id}`, { kind: 'cook', zone: zone.id, skill: 'cooking', level: recipe.level, camp: true, seconds: 0, yield: 1,
      inputs: Object.fromEntries([...Object.entries(recipe.foods).map(([id, n]) => [`food:${id}`, n]), ...Object.entries(recipe.materials).map(([id, n]) => [`material:${id}`, n]), ...Object.entries(recipe.herbs).map(([id, n]) => [`herb:${id}`, n])]) });
    for (const recipe of [...F.workshop_recipes, ...F.smithing_recipes.map((row) => ({ ...row, skill: 'smithing' }))]) add(`material:${recipe.id}`, { kind: 'workshop', zone: zone.id, skill: recipe.skill, level: recipe.level, seconds: 0, yield: recipe.yield, inputs: Object.fromEntries(Object.entries(recipe.materials).map(([id, n]) => [`material:${id}`, n])) });
  }

  function acquisition(id: string, count: number, townZone: number, context: AcquisitionContext): Acquisition | null {
    interface CampBudget { camp: AcquisitionContext['camp']; free: number }
    type Resolved = Omit<Acquisition, 'difficulty'> & { owned: Record<string, number>; station: CampBudget };
    const journey = (steps: AcquisitionStep[]) => {
      let seconds = 0, previous: { zone: number; kind: string } | null = null;
      for (const stop of [...steps, { zone: townZone, kind: 'town' }]) {
        seconds += previous == null ? context.travelFromCurrent(stop.zone, stop.kind)
          : context.travelBetween(previous.zone, stop.zone, previous.kind, stop.kind);
        previous = stop;
      }
      return seconds;
    };
    const metadata = (key: string, seen = new Set<string>()): { band: string; rarity: string; processing: number } => {
      const paths = sources[key] || [];
      if (seen.has(key) || !paths.length) return { band: 'low', rarity: 'common', processing: 0 };
      const next = new Set(seen).add(key);
      const values = paths.map((source) => {
        let b = band(source.zone), rarity = source.rarity || 'common', processing = source.inputs ? 1 : 0;
        for (const input of Object.keys(source.inputs || {})) {
          const child = metadata(input, next);
          if (C.band_weights[child.band] > C.band_weights[b]) b = child.band;
          if (C.rarity_weights[child.rarity] > C.rarity_weights[rarity]) rarity = child.rarity;
          processing = Math.max(processing, child.processing + 1);
        }
        return { band: b, rarity, processing };
      });
      return values.sort((a, b) => C.band_weights[a.band] * C.rarity_weights[a.rarity] * (1 + a.processing * C.processing_weight)
        - C.band_weights[b.band] * C.rarity_weights[b.rarity] * (1 + b.processing * C.processing_weight))[0];
    };
    const metaCache = new Map<string, ReturnType<typeof metadata>>();
    const meta = (key: string) => { if (!metaCache.has(key)) metaCache.set(key, metadata(key)); return metaCache.get(key)!; };
    const solve = (key: string, quantity: number, seen: Set<string>, inventory: Record<string, number>, station: CampBudget, excludeFarm = false): Resolved | null => {
      if (!trade.byId[key]) return null;
      const held = inventory[key] || 0;
      const used = Math.min(quantity, held);
      const remaining = quantity - used;
      const left = { ...inventory, [key]: held - used };
      if (remaining === 0) return { ...meta(key), steps: [], productionSec: 0, travelSec: journey([]), owned: left, station };
      if (seen.has(key)) return null;
      const next = new Set(seen).add(key);
      const candidates: Resolved[] = [];
      for (const source of sources[key] || []) {
        if (excludeFarm && source.kind === 'farm' || !context.zones.includes(source.zone)
          || source.camp && !context.canCamp(source.zone, source.kind) || source.kind === 'hunt' && !context.canHunt(source.zone)
          || source.skill && (context.levels[source.skill] || 1) < (source.level || 1) || !Number.isFinite(source.seconds)) continue;
        let budget = { ...left }, campState: CampBudget = { camp: station.camp && { ...station.camp }, free: station.free };
        let needed = remaining, productionSec = remaining * source.seconds, processing = source.inputs ? 1 : 0;
        let selectedBand = band(source.zone), rarity = source.rarity || 'common', invalid = false;
        const steps: AcquisitionStep[] = [];
        const crop = source.kind === 'farm' ? context.plots.find((plot) => plot.tier === key.slice('herb:'.length)) : undefined;
        if (source.kind === 'farm' && !crop) {
          // Reserve a held seed rather than promising it for delivery and then spending it twice.
          const reserve = Math.min(used, source.seed!);
          budget[key] += reserve; needed += reserve;
          const seed = solve(key, source.seed!, seen, budget, campState, true);
          if (!seed) continue;
          budget = seed.owned; campState = seed.station; productionSec = seed.productionSec;
          steps.push(...seed.steps);
        }
        if (source.inputs) {
          productionSec = 0;
          for (const [input, units] of Object.entries(source.inputs)) {
            const child = solve(input, Math.ceil(needed / source.yield) * units, next, budget, campState);
            if (!child) { invalid = true; break; }
            budget = child.owned; campState = child.station; productionSec += child.productionSec;
            processing = Math.max(processing, child.processing + 1);
            if (C.band_weights[child.band] > C.band_weights[selectedBand]) selectedBand = child.band;
            if (C.rarity_weights[child.rarity] > C.rarity_weights[rarity]) rarity = child.rarity;
            steps.push(...child.steps);
          }
        } else if (source.kind === 'farm') {
          const empty = context.plots.length < context.plotCapacity || context.plots.some((plot) => !plot.tier);
          const plotWait = empty ? 0 : Math.min(...context.plots.map((plot) => Math.max(0, plot.readyAt - context.now)));
          const first = crop ? Math.max(0, crop.readyAt - context.now) : plotWait + source.seconds;
          productionSec = (crop ? 0 : productionSec) + first + Math.max(0, Math.ceil(needed / source.yield) - 1) * source.seconds;
        }
        if (invalid) continue;
        if (source.camp) {
          const same = campState.camp?.zone === source.zone && (source.kind === 'cook' || campState.camp.kind === source.kind);
          if (!same) {
            if (campState.camp && campState.free <= 0) {
              for (const [cost, units] of Object.entries(context.campCosts)) {
                if ((budget[cost] || 0) < units) { invalid = true; break; }
                budget[cost] -= units;
              }
              if (invalid) continue;
            } else if (campState.camp) campState.free--;
            campState.camp = { zone: source.zone, kind: source.kind === 'cook' ? 'camp' : source.kind };
          }
        }
        steps.push({ good: key, kind: source.kind, zone: source.zone, quantity: needed, seconds: source.inputs ? 0 : productionSec });
        candidates.push({ steps, productionSec, travelSec: journey(steps), band: selectedBand, rarity, processing, owned: budget, station: campState });
      }
      candidates.sort((a, b) => a.productionSec + a.travelSec - b.productionSec - b.travelSec || JSON.stringify(a.steps).localeCompare(JSON.stringify(b.steps)));
      return candidates[0] || null;
    };
    const route = solve(id, count, new Set(), { ...context.owned }, { camp: context.camp, free: context.freeRelocations });
    if (!route) return null;
    const { owned: _, station: __, ...snapshot } = route;
    // The canonical least-difficulty production basis does not change when a nearer source wins
    // route planning. Distance changes the deadline and travel, never the offered reward.
    const intrinsic = meta(id);
    const difficulty = C.band_weights[intrinsic.band] * C.rarity_weights[intrinsic.rarity] * (1 + intrinsic.processing * C.processing_weight) * count ** C.count_exponent;
    return { ...snapshot, sourceBand: route.band, ...intrinsic, difficulty };
  }
  const capFor = (good: TradeGood) => E.inventory.stack_size[good.bucket === 'junk' ? 'stone' : good.bucket];
  const deadline = (route: Acquisition) => Math.max(C.deadline_min_sec, Math.ceil(route.productionSec * C.production_allowance + route.travelSec + C.deadline_allowance_sec));
  const targetWeight = (good: TradeGood) => C.target_weights[good.id] ?? C.target_weights[good.bucket] ?? C.default_target_weight;
  const premium = (difficulty: number, hagglingXp = 0) => 1 + (C.premium_base + difficulty * C.premium_per_difficulty - 1)
    * trade.haggling(hagglingXp).deliveryMult;
  const stoneBundle = (band: string, difficulty: number, key: string, income: 'tier' | 'reroll_value' | 'add', fallback = false) => ({
    key, count: Math.max(C.minimum_stones, eng.taskPayout(band, (fallback ? C.fallback_minutes : C.reward_minutes) * difficulty)[income]),
  });
  return { C, sources, acquisition, capFor, deadline, targetWeight, premium, stoneBundle, band };
}
