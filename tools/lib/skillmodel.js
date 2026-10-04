'use strict';

/**
 * Skill model — a thin CommonJS bridge over engine/skills.js.
 *
 * The calculator itself lives in the shared module so the client presses the same numbers the
 * workshop prints (Techstack.md "The one rule"). Nothing is computed on this side.
 */

const R = require('./roster');
const E = require('../data/engine.json');
const eng = require('./engine');
const { createSkillModel, LADDER, CONVERSION, WEAPON_GROUPS } = require('../../engine/skills.js');

const M = createSkillModel(R.DATA, E);

/**
 * The two reference builds a press is printed against live in `engine/index.js` (`REF`), because the
 * roster table and the client must read the same bases (Techstack.md "The one rule").
 */
const referenceBases = () => eng.REF;

/** The press a row deals on one reference build, at the skill level the tables print. */
function pressOn(skill, which, level) {
  return M.perPress(skill, { ...referenceBases()[which], level });
}

module.exports = {
  LEVEL_STEP: M.LEVEL_STEP, CAST_REF: M.CAST_REF,
  manaPct: M.manaPct, basisOf: M.basisOf, perPress: M.perPress, critsOnBasis: M.critsOnBasis,
  effCd: M.effCd, row: M.row,
  ladderPct: M.ladderPct, ladderCostToStep: M.ladderCostToStep, skillLevel: M.skillLevel,
  skillXpForLevel: M.skillXpForLevel, weaponGroupOf: M.weaponGroupOf,
  groupBonus: M.groupBonus, masteryBonus: M.masteryBonus, reservePct: M.reservePct,
  referenceBases, pressOn,
  LADDER, CONVERSION, WEAPON_GROUPS, LADDER_MAX_DUPLICATES: M.LADDER_MAX_DUPLICATES,
  model: () => M,
};
