import { E } from '../engine/client';
import { createFarm } from '../../../engine/farm.ts';
import type { GameState } from './types';
import type { Character } from './player';
import { addTo, fits } from './slots';

/** The client's farm runs on the shared module — no local copy of a rate or a cost. */
export const farm: any = createFarm(E);

export interface Plot {
  tier: string | null;
  plantedAt: number;
  readyAt: number;
}

export interface FarmState {
  plots: Plot[];
  xp: number;
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
  const deeds = (state.town?.owned || []).filter((id: string) => id === 'plot_deed_4' || id === 'plot_deed_5').length;
  return Math.min(farm.plotsMax, farm.F.plots.base + deeds);
}

export function farmLevel(state: GameState): number {
  return farm.farmLevel(state.farm.xp);
}

export function plant(state: GameState, index: number, tier: string): { ok: boolean; why?: string } {
  if (index >= plotCount(state)) return { ok: false, why: 'that plot is not yours yet — the Steward sells the deeds' };
  if (!farm.canGrow(farmLevel(state), tier)) {
    return { ok: false, why: `Farming ${farm.F.tier_unlock_level[tier]} unlocks ${tier} herbs` };
  }
  const plot = state.farm.plots[index];
  if (plot.tier && state.clockSec < plot.readyAt) return { ok: false, why: 'still growing' };
  // a seed is one herb of the tier being planted (`farm.md` "plant 1 seed → harvest 3"), which makes
  // the cycle 3-for-1 rather than 3-for-0 and closes harness/todo.md B11 without pricing anything new
  const seedCost = farm.seedCostHerbs;
  if (seedCost && (state.farm.herbs[tier] || 0) < seedCost) {
    return { ok: false, why: `planting ${tier} needs ${seedCost} ${tier} herb as the seed` };
  }
  if (seedCost) state.farm.herbs[tier] -= seedCost;
  plot.tier = tier;
  plot.plantedAt = state.clockSec;
  // no seed is priced or dropped anywhere in the design (harness/todo.md B11), so planting costs time only
  plot.readyAt = state.clockSec + farm.growthSec;
  return { ok: true };
}

export function harvest(state: GameState, index: number): { ok: boolean; why?: string; herbs?: number; xp?: number } {
  const plot = state.farm.plots[index];
  if (!plot?.tier) return { ok: false, why: 'nothing planted' };
  if (state.clockSec < plot.readyAt) return { ok: false, why: `ready in ${Math.ceil((plot.readyAt - state.clockSec) / 3600 * 10) / 10} h` };
  const tier = plot.tier;
  const herbs = farm.yieldPerHarvest;
  if (!fits(state, state.farm.herbs, tier, 'herb', herbs)) {
    return { ok: false, why: 'the character bag has no slot left for this crop — sell or brew first' };
  }
  addTo(state, state.farm.herbs, tier, 'herb', herbs);
  state.farm.xp += farm.xpPerHarvest;
  // the crop regrows on its own clock, which is why the track costs two taps a day, not twenty
  plot.plantedAt = plot.readyAt;
  plot.readyAt = plot.plantedAt + farm.growthSec;
  return { ok: true, herbs, xp: farm.xpPerHarvest };
}

export function craftPotion(state: GameState, name: string): { ok: boolean; why?: string } {
  const potion = farm.potionByName[name];
  if (!potion) return { ok: false, why: 'no such draught' };
  const cost = farm.craftCost(potion.tier);
  if ((state.farm.herbs[potion.tier] || 0) < cost.herbs) return { ok: false, why: `needs ${cost.herbs} ${potion.tier} herbs` };
  // never pay a cost for a bottle the bag cannot hold (`slots.ts` · stop_pickup)
  if (!fits(state, state.farm.potions, name, 'potion', 1)) return { ok: false, why: 'no free slot in the character bag' };
  if ((state.counters.stones.reroll_value || 0) < cost.reroll_value_stones) {
    return { ok: false, why: `needs ${cost.reroll_value_stones} Reroll value stones` };
  }
  state.farm.herbs[potion.tier] -= cost.herbs;
  state.counters.stones.reroll_value -= cost.reroll_value_stones;
  addTo(state, state.farm.potions, name, 'potion', 1);
  return { ok: true };
}

/** Condensing trades ten bottles for one ten-times dose, and the weight saving is the point. */
export function condense(state: GameState, name: string): { ok: boolean; why?: string } {
  const cost = farm.condensedCost();
  if ((state.farm.potions[name] || 0) < cost.bottles) return { ok: false, why: `needs ${cost.bottles} bottles` };
  if (!fits(state, state.farm.condensed, name, 'potion', 1)) return { ok: false, why: 'no free slot in the character bag' };
  if ((state.counters.stones.reroll_value || 0) < cost.reroll_value) return { ok: false, why: `needs ${cost.reroll_value} stones` };
  state.farm.potions[name] -= cost.bottles;
  state.counters.stones.reroll_value -= cost.reroll_value;
  addTo(state, state.farm.condensed, name, 'potion', 1);
  return { ok: true };
}

const bottleWorth = (state: GameState, name: string) =>
  (state.farm.condensed[name] || 0) * farm.P.condensed.effect_mult + (state.farm.potions[name] || 0);

/** Auto-use drinks the best available bottle of a pool, and a condensed one is ten of the same. */
export function maybeDrink(state: GameState, c: Character, mobIsBoss: boolean): { name: string; pool: string; amount: number } | null {
  const lim = farm.fightLimits();
  if (mobIsBoss && lim.bossSuppressed) return null;
  if (state.farm.usesThisFight >= lim.maxUsesPerFight) return null;
  if (state.clockSec - state.farm.lastDrinkAt < lim.sharedCooldownSec) return null;
  const hpPct = (state.player.hp / c.maxHp) * 100;
  const manaPct = (state.player.mana / c.maxMana) * 100;
  const pool = state.farm.autoUse.hp && hpPct < state.farm.threshold.hp ? 'hp'
    : state.farm.autoUse.mana && manaPct < state.farm.threshold.mana ? 'mana'
      : null;
  if (!pool) return null;
  const candidates = farm.P.list.filter((p: any) => p.pool === pool && bottleWorth(state, p.name) > 0);
  if (!candidates.length) return null;
  const potion = candidates.sort((a: any, b: any) => farm.potionEffect(b) - farm.potionEffect(a))[0];
  const condensed = (state.farm.condensed[potion.name] || 0) > 0;
  if (condensed) state.farm.condensed[potion.name] -= 1;
  else state.farm.potions[potion.name] -= 1;
  const mult = condensed ? farm.P.condensed.effect_mult : 1;
  const pct = farm.potionEffect(potion) * mult;
  const amount = pool === 'hp' ? (c.maxHp * pct) / 100 : (c.maxMana * pct) / 100;
  if (pool === 'hp') state.player.hp = Math.min(c.maxHp, state.player.hp + amount);
  else state.player.mana = Math.min(c.maxMana, state.player.mana + amount);
  state.farm.lastDrinkAt = state.clockSec;
  state.farm.usesThisFight++;
  return { name: potion.name, pool, amount };
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
export function rollHerbs(state: GameState, rng: () => number, band: string, zoneTier: string, chance?: number): number {
  if (rng() >= (chance ?? farm.herbChance(band))) return 0;
  const bundle = farm.H.bundle_min + Math.floor(rng() * (farm.H.bundle_max - farm.H.bundle_min + 1));
  // a bundle the bag cannot hold is left where it fell: herbs never dissolve into stones
  return addTo(state, state.farm.herbs, zoneTier, 'herb', bundle);
}
