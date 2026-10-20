export interface StandingTierCfg {
  name: string;
  share: number;
}

/** Shared settlement Standing calculation. Camp aid advances progress without fabricating kills. */
export function standingProgressOf(kills: number, helpCredit: number, budget: number, tiers: StandingTierCfg[]) {
  const progress = kills + helpCredit;
  const tier = budget > 0 ? tiers.filter(row => progress >= Math.ceil(row.share * budget)).length : 0;
  const threshold = budget > 0 ? tiers[tier] : undefined;
  const requiredProgress = threshold && budget > 0 ? Math.ceil(threshold.share * budget) : undefined;
  return {
    tier, share: budget > 0 ? progress / budget : 0, kills, helpCredit, progress, budget,
    ...(threshold && requiredProgress != null ? {
      next: { name: threshold.name, kills: requiredProgress, requiredProgress,
        remaining: Math.max(0, requiredProgress - progress) },
    } : {}),
  };
}
