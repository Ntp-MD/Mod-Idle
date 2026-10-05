/**
 * Skill model — a thin bridge over engine/skills.ts.
 *
 * The calculator itself lives in the shared module so the client presses the same numbers the
 * workshop prints (Techstack.md "The one rule"). Nothing is computed on this side.
 */

import path from 'node:path';
import * as R from './roster.ts';
import * as eng from './engine.ts';
import { readJson } from './json.ts';
import { createSkillModel, LADDER, CONVERSION, WEAPON_GROUPS } from '../../engine/skills.ts';

const E = readJson(path.join(import.meta.dirname, '..', 'data', 'engine.json'));
const M = createSkillModel(R.DATA, E);

/**
 * The two reference builds a press is printed against live in `engine/index.ts` (`REF`), because the
 * roster table and the client must read the same bases (Techstack.md "The one rule").
 */
const referenceBases = (): any => eng.REF;

/** The press a row deals on one reference build, at the skill level the tables print. */
function pressOn(skill: any, which: string, level: any): any {
  return M.perPress(skill, { ...referenceBases()[which], level });
}

const LEVEL_STEP = M.LEVEL_STEP;
const CAST_REF = M.CAST_REF;
const LADDER_MAX_DUPLICATES = M.LADDER_MAX_DUPLICATES;
const manaSpec = M.manaSpec;
const manaCostOf = M.manaCostOf;
const MANA_LEVEL_STEP = M.MANA_LEVEL_STEP;
const MANA_POOL_EXPONENT = M.MANA_POOL_EXPONENT;
const MANA_REF_POOL = M.MANA_REF_POOL;
const basisOf = M.basisOf;
const perPress = M.perPress;
const critsOnBasis = M.critsOnBasis;
const effCd = M.effCd;
const row = M.row;
const ladderPct = M.ladderPct;
const ladderCostToStep = M.ladderCostToStep;
const skillLevel = M.skillLevel;
const skillXpForLevel = M.skillXpForLevel;
const weaponGroupOf = M.weaponGroupOf;
const groupBonus = M.groupBonus;
const masteryBonus = M.masteryBonus;
const reservePct = M.reservePct;
const model = (): any => M;

export {
  LEVEL_STEP, CAST_REF,
  manaSpec, manaCostOf, MANA_LEVEL_STEP, MANA_POOL_EXPONENT, MANA_REF_POOL,
  basisOf, perPress, critsOnBasis,
  effCd, row,
  ladderPct, ladderCostToStep, skillLevel,
  skillXpForLevel, weaponGroupOf,
  groupBonus, masteryBonus, reservePct,
  referenceBases, pressOn,
  LADDER, CONVERSION, WEAPON_GROUPS, LADDER_MAX_DUPLICATES,
  model,
};
