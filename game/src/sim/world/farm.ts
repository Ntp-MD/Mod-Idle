import { farm, fieldwork, tree, TOWN } from '../../engine/client';
import { bundleOf, surgeonStream } from '../../../../engine/keystones.ts';
import type { GameState } from '../core/types';
import type { Character } from '../core/player';
import { addTo, fits } from '../gear/slots';

/** The client's farm runs on the shared module — no local copy of a rate or a cost. */
export { farm };

export interface Plot {
  tier: string | null;
  plantedAt: number;
  readyAt: number;
}

export interface FarmState {
  plots: Plot[];
  xp: number;
  mastery: Record<string, number>;
  herbs: Record<string, number>;
  potions: Record<string, number>;
  condensed: Record<string, number>;
  autoUse: { hp: boolean; mana: boolean };
  /** The defaults are the ones farm.md states (HP < 30%, mana < 25%); the player can move them. */
  threshold: { hp: number; mana: number };
  lastDrinkAt: number;
  usesThisFight: number;
  /** Client-side automation: plant empty plots, harvest what is ready, brew at a slow cadence. */
  autoFarm: { plant: boolean; harvest: boolean; brew: boolean };
  /** The last time an auto-brew ran, so brewing cannot fire every tick. */
  lastAutoFarmAt: number;
}

export function newFarm(): FarmState {
  return {
    plots: farm.F.plots.base ? Array.from({ length: farm.F.plots.base }, () => ({ tier: null, plantedAt: 0, readyAt: 0 })) : [],
    xp: 0,
    mastery: { low: 0, mid: 0, high: 0 },
    herbs: Object.fromEntries(farm.TIERS.map((t: string) => [t, 0])),
    potions: Object.fromEntries(farm.P.list.map((p: any) => [p.name, 0])),
    condensed: Object.fromEntries(farm.P.list.map((p: any) => [p.name, 0])),
    autoUse: { hp: true, mana: true },
    threshold: { hp: farm.P.auto_use_default.hp_pct, mana: farm.P.auto_use_default.mana_pct },
    lastDrinkAt: -9999,
    usesThisFight: 0,
    autoFarm: { plant: false, harvest: false, brew: false },
    lastAutoFarmAt: -9999,
  };
}

/** Plots come from the Steward's deed lines, and the track is capped at 5 (`farm.plots`). */
export function plotCount(state: GameState): number {
  const owned = state.town?.owned || [];
  const deeds = owned.filter((id: string) => id === 'plot_deed_4' || id === 'plot_deed_5').length;
  const granted = owned.reduce((total: number, id: string) =>
    total + Number((TOWN.one_time as any[]).find((row: any) => row.id === id)?.plot_grant || 0), 0);
  return Math.min(farm.plotsMax, farm.F.plots.base + deeds + granted);
}

/**
 * The plot track grows with the Steward's deeds, but the array is only ever built at the base size
 * and nothing pushed the bought slots. Pad it up to the owned count on access, so plot 4/5 exist as
 * real slots instead of reading `undefined` (which crashed `plant` the moment a deed was bought).
 */
export function ensurePlots(state: GameState): Plot[] {
  const plots = state.farm.plots;
  const want = plotCount(state);
  while (plots.length < want) plots.push({ tier: null, plantedAt: 0, readyAt: 0 });
  return plots;
}

export function farmLevel(state: GameState): number {
  return farm.farmLevel(state.farm.xp);
}

export function plant(state: GameState, index: number, tier: string): { ok: boolean; why?: string } {
  if (index >= plotCount(state)) return { ok: false, why: 'that plot is not yours yet — the Steward sells the deeds' };
  if (!farm.canGrow(farmLevel(state), tier)) {
    return { ok: false, why: `Farming ${farm.F.tier_unlock_level[tier]} unlocks ${tier} herbs` };
  }
  const plot = ensurePlots(state)[index];
  if (plot.tier && state.clockSec < plot.readyAt) return { ok: false, why: 'still growing' };
  // a seed is one herb of the tier being planted (`farm.md` "plant 1 seed → harvest 3"), which makes
  // the cycle 3-for-1 rather than 3-for-0, without pricing anything new
  const seedCost = farm.seedCostHerbs;
  if (seedCost && (state.farm.herbs[tier] || 0) < seedCost) {
    return { ok: false, why: `planting ${tier} needs ${seedCost} ${tier} herb as the seed` };
  }
  if (seedCost) state.farm.herbs[tier] -= seedCost;
  plot.tier = tier;
  plot.plantedAt = state.clockSec;
  plot.readyAt = state.clockSec + farmGrowthSec(state, tier);
  return { ok: true };
}

export function harvest(state: GameState, index: number): { ok: boolean; why?: string; herbs?: number; xp?: number } {
  const plot = ensurePlots(state)[index];
  if (!plot?.tier) return { ok: false, why: 'nothing planted' };
  if (state.clockSec < plot.readyAt) return { ok: false, why: `ready in ${Math.ceil((plot.readyAt - state.clockSec) / 3600 * 10) / 10} h` };
  const tier = plot.tier;
  const herbs = farm.yieldPerHarvest;
  if (!fits(state, state.farm.herbs, tier, 'herb', herbs)) {
    return { ok: false, why: 'the bag has no slot left for this crop — sell or brew first' };
  }
  addTo(state, state.farm.herbs, tier, 'herb', herbs);
  state.farm.xp += farm.xpPerHarvest;
  state.farm.mastery[tier] = (state.farm.mastery[tier] || 0) + 1;
  // the crop regrows on its own clock, which is why the track costs two taps a day, not twenty
  plot.plantedAt = plot.readyAt;
  plot.readyAt = plot.plantedAt + farmGrowthSec(state, tier);
  return { ok: true, herbs, xp: farm.xpPerHarvest };
}

export function farmMasteryLevel(state: GameState, tier: string): number {
  return fieldwork.masteryLevel(state.farm.mastery?.[tier] || 0);
}

export function farmGrowthSec(state: GameState, tier: string): number {
  const level = farmMasteryLevel(state, tier);
  const progress = Math.max(0, Math.min(1, (level - 1) / (fieldwork.F.mastery_cap - 1)));
  return farm.growthSec * (1 - 0.1 * progress);
}

export function craftPotion(state: GameState, name: string): { ok: boolean; why?: string } {
  const potion = farm.potionByName[name];
  if (!potion) return { ok: false, why: 'no such draught' };
  const cost = farm.craftCost(potion.tier);
  if ((state.farm.herbs[potion.tier] || 0) < cost.herbs) return { ok: false, why: `needs ${cost.herbs} ${potion.tier} herbs` };
  if ((state.counters.stones.reroll_value || 0) < cost.reroll_value_stones) {
    return { ok: false, why: `needs ${cost.reroll_value_stones} Value stones` };
  }
  // never pay a cost for a bottle the bag cannot hold (`slots.ts` · stop_pickup)
  if (!fits(state, state.farm.potions, name, 'potion', 1, [
    { bucket: state.farm.herbs, key: potion.tier, capKind: 'herb', amount: cost.herbs },
    { bucket: state.counters.stones, key: 'reroll_value', capKind: 'stone', amount: cost.reroll_value_stones },
  ])) return { ok: false, why: 'no free slot in the bag' };
  state.farm.herbs[potion.tier] -= cost.herbs;
  state.counters.stones.reroll_value -= cost.reroll_value_stones;
  addTo(state, state.farm.potions, name, 'potion', 1);
  return { ok: true };
}

/** Condensing trades ten bottles for one ten-times dose, and the weight saving is the point. */
export function condense(state: GameState, name: string): { ok: boolean; why?: string } {
  const cost = farm.condensedCost();
  if ((state.farm.potions[name] || 0) < cost.bottles) return { ok: false, why: `needs ${cost.bottles} bottles` };
  if ((state.counters.stones.reroll_value || 0) < cost.reroll_value) return { ok: false, why: `needs ${cost.reroll_value} stones` };
  if (!fits(state, state.farm.condensed, name, 'potion', 1, [
    { bucket: state.farm.potions, key: name, capKind: 'potion', amount: cost.bottles },
    { bucket: state.counters.stones, key: 'reroll_value', capKind: 'stone', amount: cost.reroll_value },
  ])) return { ok: false, why: 'no free slot in the bag' };
  state.farm.potions[name] -= cost.bottles;
  state.counters.stones.reroll_value -= cost.reroll_value;
  addTo(state, state.farm.condensed, name, 'potion', 1);
  return { ok: true };
}

const bottleWorth = (state: GameState, name: string) =>
  (state.farm.condensed[name] || 0) * farm.P.condensed.effect_mult + (state.farm.potions[name] || 0);

/** Drink one bottle: a condensed dose counts as ten, and a `both` draught fills both pools. */
/** Is a `17` Master Surgeon stream still paying? A second HP draught cannot stack on it. */
export const potionStreamRunning = (state: GameState): boolean =>
  (state.keystoneRuntime?.queues?.potion?.length ?? 0) > 0;

function applyPotion(state: GameState, c: Character, potion: any): { hp: number; mana: number } {
  const condensed = (state.farm.condensed[potion.name] || 0) > 0;
  if (condensed) state.farm.condensed[potion.name] -= 1;
  else state.farm.potions[potion.name] -= 1;
  const mult = condensed ? farm.P.condensed.effect_mult : 1;
  const hp = (c.maxHp * farm.potionPct(potion, 'hp') * mult) / 100;
  const mana = (c.maxMana * farm.potionPct(potion, 'mana') * mult) / 100;
  // `17` Master Surgeon: the Health half of the draught stops being one number and becomes a stream —
  // 1.5× the nominal heal paid out a second for its own seconds. Overflow at a full pool is lost while
  // the remaining payments still run; Mana is never touched by it, and a hybrid pays its Mana at once.
  const surgeon = bundleOf(c.keystones, 'master-surgeon');
  if (surgeon && hp > 0) {
    const stream = surgeonStream(hp, surgeon.params as Record<string, number>);
    const units = tree.mechanics?.combat_time_units_per_sec ?? 1;
    for (let i = 1; i <= Number(surgeon.params.durationSec); i++)
      state.keystoneRuntime.queues.potion.push({
        dueAtUs: (state.clockSec + i) * units, amount: stream.perSec, sourceId: 'potion', targetId: 'player',
      });
  } else if (hp) state.player.hp = Math.min(c.maxHp, state.player.hp + hp);
  if (mana) state.player.mana = Math.min(c.maxMana, state.player.mana + mana);
  state.farm.lastDrinkAt = state.clockSec;
  state.farm.usesThisFight++;
  return { hp, mana };
}

/** Manual sip from the Farm board: the same fight limits bind it, but the player names the bottle. */
export function drink(state: GameState, c: Character, name: string, mobIsBoss: boolean): { ok: boolean; why?: string } {
  const potion = farm.potionByName[name];
  if (!potion) return { ok: false, why: 'no such draught' };
  if (bottleWorth(state, name) < 1) return { ok: false, why: 'none carried' };
  const lim = farm.fightLimits();
  if (mobIsBoss && lim.bossSuppressed) return { ok: false, why: 'suppressed on a boss' };
  if (state.farm.usesThisFight >= lim.maxUsesPerFight) return { ok: false, why: 'no uses left this fight' };
  if (state.clockSec - state.farm.lastDrinkAt < lim.sharedCooldownSec) return { ok: false, why: 'on cooldown' };
  // an already-running stream is a refusal raised BEFORE the bottle is spent or the cooldown taken
  if (bundleOf(c.keystones, 'master-surgeon') && farm.potionPct(potion, 'hp') > 0 && potionStreamRunning(state))
    return { ok: false, why: 'the last draught is still being absorbed' };
  applyPotion(state, c, potion);
  return { ok: true };
}

/** The bar above the casts: seven squares, each holding one draught's name. */
export const QUICKBAR_SLOTS = 7;

/** The draughts actually carried, in ladder order — what a quickbar square cycles through. */
export function ownedPotions(state: GameState): string[] {
  return farm.P.list.filter((p: any) => bottleWorth(state, p.name) > 0).map((p: any) => p.name);
}

/** Right-click on a quickbar square: step to the next carried draught, with empty as one of the stops. */
export function cycleQuickbar(state: GameState, slot: number): string | null {
  const owned = ownedPotions(state);
  const stops = [null, ...owned];
  const at = stops.indexOf(state.quickbar[slot] ?? null);
  state.quickbar[slot] = stops[(at + 1) % stops.length];
  return state.quickbar[slot];
}

/** Auto-use drinks the best available bottle of a pool, and a condensed one is ten of the same. */
export function maybeDrink(state: GameState, c: Character, mobIsBoss: boolean): { name: string; pool: string; amount: number } | null {
  const lim = farm.fightLimits();
  if (mobIsBoss && lim.bossSuppressed) return null;
  if (state.farm.usesThisFight >= lim.maxUsesPerFight) return null;
  if (state.clockSec - state.farm.lastDrinkAt < lim.sharedCooldownSec) return null;
  const hpPct = (state.player.hp / c.maxHp) * 100;
  const manaPct = (state.player.mana / c.maxMana) * 100;
  const hpStream = !!bundleOf(c.keystones, 'master-surgeon') && potionStreamRunning(state);
  for (const pool of ['hp', 'mana'] as const) {
    const pct = pool === 'hp' ? hpPct : manaPct;
    if (!state.farm.autoUse[pool] || !(pct < state.farm.threshold[pool])) continue;
    const candidates = farm.P.list.filter((p: any) => (p.pool === pool || p.pool === 'both')
      && bottleWorth(state, p.name) > 0 && !(hpStream && farm.potionPct(p, 'hp') > 0));
    const potion = candidates.sort((a: any, b: any) => farm.potionEffect(b) - farm.potionEffect(a))[0];
    if (!potion) continue;
    const { hp, mana } = applyPotion(state, c, potion);
    return { name: potion.name, pool, amount: pool === 'hp' ? hp : mana };
  }
  return null;
}

/** Client-side brew cadence: a potion at most once every this many seconds while auto-brew is on. */
const AUTO_BREW_COOLDOWN_SEC = 30;

/**
 * The twin of `maybeDrink` for the rest of the track: harvest every ready plot, plant empty plots with
 * the best tier the seed store can afford, and brew one affordable draught at a slow cadence. Driven
 * entirely by the existing plot / herb / stone state — it prices nothing new and touches no rate.
 */
export function maybeFarm(state: GameState): string[] {
  const f = state.farm;
  if (!f.autoFarm) return [];
  ensurePlots(state);
  const out: string[] = [];
  if (f.autoFarm.harvest) {
    for (let i = 0; i < plotCount(state); i++) {
      const plot = f.plots[i];
      if (plot?.tier && state.clockSec >= plot.readyAt) {
        const r = harvest(state, i);
        if (r.ok) out.push(`Auto-harvest · ${plot.tier} +${r.herbs} herbs`);
      }
    }
  }
  if (f.autoFarm.plant) {
    const level = farmLevel(state);
    const seed = farm.seedCostHerbs || 0;
    const best = [...farm.TIERS].reverse().find((t: string) => farm.canGrow(level, t) && (f.herbs[t] || 0) >= seed);
    if (best) {
      for (let i = 0; i < plotCount(state); i++) {
        if (!f.plots[i]?.tier) {
          const r = plant(state, i, best);
          if (r.ok) out.push(`Auto-plant · ${best} in plot ${i + 1}`);
        }
      }
    }
  }
  if (f.autoFarm.brew && state.clockSec - f.lastAutoFarmAt >= AUTO_BREW_COOLDOWN_SEC) {
    for (const p of farm.P.list) {
      const r = craftPotion(state, p.name);
      if (r.ok) { out.push(`Auto-brew · ${p.name}`); f.lastAutoFarmAt = state.clockSec; break; }
    }
  }
  return out;
}

/** Herb bundles ride their own roll, separate from gear and stones (`engine.json` `herbs`). A Hunt
 *  Order may hand in an already-reweighted chance so the three collectible streams stay balanced. */
/**
 * A potion drop rides its own roll, exactly as the herb stream does. Only explicit potion sources carry
 * it, the tier follows the zone's quality band, and the pool is an even coin between hp and mp. A
 * bottle the bag cannot hold is left where it fell, never converted — the same rule as an herb.
 */
export function rollPotion(state: GameState, rng: () => number, band: string, potionSource: boolean): string | null {
  if (!potionSource || rng() >= farm.potionDropChance(band)) return null;
  const pool = rng() < 0.5 ? 'hp' : 'mp';
  const potion = farm.P.list.find((p: any) => p.pool === pool && p.tier === band);
  if (!potion) return null;
  return addTo(state, state.farm.potions, potion.name, 'potion', 1) ? potion.name : null;
}

export function rollHerbs(state: GameState, rng: () => number, band: string, zoneTier: string, chance?: number): number {
  if (rng() >= (chance ?? farm.herbChance(band))) return 0;
  const bundle = farm.H.bundle_min + Math.floor(rng() * (farm.H.bundle_max - farm.H.bundle_min + 1));
  // a bundle the bag cannot hold is left where it fell: herbs never dissolve into stones
  return addTo(state, state.farm.herbs, zoneTier, 'herb', bundle);
}
