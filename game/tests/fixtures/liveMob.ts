import { E, ED, MS } from '../../src/engine/client';
import type { MobSkillRow, MobSpecies } from '@engine/types.ts';
import { afterEach, beforeEach } from 'vitest';

/** Skill-mechanic scenarios opt in explicitly while production keeps its configured switch. */
export function enableMobSkillsForTests(): void {
  let configured: boolean;
  beforeEach(() => {
    configured = E.mob.skills_enabled;
    E.mob.skills_enabled = true;
  });
  afterEach(() => { E.mob.skills_enabled = configured; });
}

export function liveSpecies(predicate: (row: MobSpecies) => boolean, capability: string): MobSpecies {
  const row = ED.mob.species.find(predicate);
  if (!row) throw new Error(`no live mob species for ${capability}`);
  return row;
}

export function liveMobSkill(predicate: (row: MobSkillRow) => boolean, capability: string): MobSkillRow {
  const row = MS.skills.find(predicate);
  if (!row) throw new Error(`no live mob skill for ${capability}`);
  return row;
}

export function liveSocialSpecies(): MobSpecies {
  return liveSpecies(row => E.mob.engagement.proximity.includes(row.id)
    && E.mob.engagement.assist.includes(row.id), 'proximity and same-species assist');
}

/** An ordinary hostile field species: wakes on proximity, so scenarios that need a live fight engage. */
export function liveProximitySpecies(): MobSpecies {
  return liveSpecies(row => E.mob.engagement.proximity.includes(row.id)
    && !row.carries_weapon && !row.potion_source && !Object.keys(row.mechanics ?? {}).length,
    'ordinary proximity aggression');
}
