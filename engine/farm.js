/**
 * The provisioning track — Farm and Potion, both read out of `engine.json`.
 *
 * Farming is the game's one life skill and it grants no power: its whole output is the herb a
 * potion is crafted from, which is why it sits outside the `mob_HP` fold (`AGENT.md` §5 · D-068).
 * Potions are a bounded convenience: shared cooldown, a per-fight cap, and nothing works on a boss.
 */

export function createFarm(E) {
  const F = E.farm;
  const P = E.potions;
  const H = E.herbs;
  const TIERS = ['low', 'mid', 'high'];

  /** level = floor(sqrt(xp ÷ divisor)) + 1, the same curve as weapon Mastery, Cap 20. */
  const farmLevel = (xp) => Math.min(F.level_cap, Math.floor(Math.sqrt(xp / F.level_divisor)) + 1);
  const farmXpForLevel = (level) => Math.pow(level - 1, 2) * F.level_divisor;

  /** Which herb tiers a given Farming level may grow (`farm.tier_unlock_level`). */
  const canGrow = (level, tier) => level >= (F.tier_unlock_level[tier] ?? 1);

  const growthSec = F.growth_hours * 3600;
  const plotsMax = F.plots.base + F.plots.shop_deeds;

  /** Herb bundles roll on their own line: mid zones 2%, high zones 3%, 1-3 of the zone's tier. */
  const herbChance = (band) => (band === 'high' ? H.high_chance : band === 'mid' ? H.mid_chance : 0);

  /** A draught's effect is `base + step × (index − 1)` percent of its pool. */
  function potionEffect(potion) {
    const base = potion.pool === 'hp' ? P.hp_base_pct : P.mana_base_pct;
    const step = potion.pool === 'hp' ? P.hp_step_pct : P.mana_step_pct;
    return base + step * (potion.index - 1);
  }

  const potionByName = {};
  for (const p of P.list) potionByName[p.name] = p;

  /** The best bottle of a pool the player holds: highest effect first (auto-use drinks that). */
  function bestPotion(inventory, pool) {
    const owned = P.list.filter((p) => p.pool === pool && (inventory[p.name] || 0) > 0);
    if (!owned.length) return null;
    return owned.sort((a, b) => potionEffect(b) - potionEffect(a))[0];
  }

  const craftCost = (tier) => P.craft[tier];
  const condensedCost = () => ({ bottles: P.condensed.cost_bottles, reroll_value: P.condensed.cost_reroll_value_stones });

  /** A fight is one group engagement; the per-fight cap and the cooldown reset with it. */
  const fightLimits = () => ({
    sharedCooldownSec: P.shared_cooldown_sec,
    maxUsesPerFight: P.max_uses_per_fight,
    bossSuppressed: P.boss_suppressed,
  });

  return {
    F, P, H, TIERS, farmLevel, farmXpForLevel, canGrow, growthSec, plotsMax,
    herbChance, potionEffect, potionByName, bestPotion, craftCost, condensedCost, fightLimits,
    yieldPerHarvest: F.yield_per_harvest,
    /** A seed is one herb of the tier being planted (farm.md's own cycle). */
    seedCostHerbs: F.seed_cost_herbs,
    xpPerHarvest: F.xp_per_harvest,
    offlineCapSec: F.offline_cap_hours * 3600,
  };
}
