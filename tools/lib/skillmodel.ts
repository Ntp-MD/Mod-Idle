/**
 * Skill model — a thin bridge over engine/skills.ts.
 *
 * The calculator itself lives in the shared module so the client presses the same numbers the
 * workshop prints. Nothing is computed on this side: the bridge hands the
 * whole suite over as one object, so every figure the shared model publishes is readable by every
 * cage without this file naming it first.
 */

import path from 'node:path';
import * as R from './roster.ts';
import { eng } from './engine.ts';
import { readJson } from './json.ts';
import { createSkillModel } from '../../engine/skills.ts';

const E = readJson(path.join(import.meta.dirname, '..', 'data', 'engine.json'));
const M: any = createSkillModel(R.DATA, E);
const REF: any = eng.REF;

/**
 * The two reference builds a press is printed against live in `engine/index.ts` (`REF`), because the
 * roster table and the client must read the same bases.
 */
const model: any = Object.assign({}, M, {
  referenceBases: () => REF,
  /** The press a row deals on one reference build, at the skill level the tables print. */
  pressOn: (skill: any, which: string, level: any) => M.perPress(skill, { ...REF[which], level }),
});

export { model };
