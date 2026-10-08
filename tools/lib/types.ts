/**
 * Shared shapes for the tooling layer. Payload interfaces stay permissive on
 * purpose: the cages read `tools/data/*.json` and every field is exercised by
 * the cages themselves, so the type here documents the seam, not the schema.
 */

export interface SkillsData {
  skills: any[];
  meta: any;
  reserve_tiers: Record<string, any>;
  deprecated?: Record<string, any>;
  renames?: Record<string, any>;
  [k: string]: any;
}

export interface TownData {
  npcs?: any[];
  settlements?: any[];
  one_time?: any[];
  repeatable?: any[];
  essentials?: any[];
  collector_sets?: any[];
  standing?: any;
  invariants?: any;
  [k: string]: any;
}

export interface BasesData {
  bases: any[];
  [k: string]: any;
}
