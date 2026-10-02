'use strict';

/**
 * Skill model — one place that turns a skill's data into the numbers a player
 * would feel: per-press damage, effective cooldown, presses/sec, mana/sec.
 *
 * Read by tools/skills.js (the attack-table rate columns + `--calc`) and by
 * tools/report.js (the interactive Skill workshop). Change a skill's `cd`,
 * `scale` or `mana` in tools/data/skills.json, or a constant in
 * `meta.formula`, and every view moves together.
 *
 * The damage numbers published in the attack table stay hand-carried (D-004
 * scope); this model is the live calculator that lets you see the formula.
 */

const R = require('./roster');

const F = (R.DATA.meta && R.DATA.meta.formula) || {};
const K_STAT = F.K_STAT != null ? F.K_STAT : 5;
const K_SKILL = F.K_SKILL != null ? F.K_SKILL : 1.5;
const LEVEL_STEP = F.level_step_pct != null ? F.level_step_pct : 1.5;
const CAST_REF = F.cast_reference || { cdr_pct: 50, ladder_pct: 30 };

/** "Str 40% + weapon power 60%" → { statPct: 40, powerPct: 60 }. */
function parseScale(scale) {
  const m = String(scale || '').match(/(\d+(?:\.\d+)?)\s*%\s*\+\s*.*?(\d+(?:\.\d+)?)\s*%/);
  if (!m) return null;
  return { statPct: Number(m[1]), powerPct: Number(m[2]) };
}

/** "10% (AoE ×1.5)" → 10. */
function manaPct(skill) {
  const m = String(skill.mana || '').match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? Number(m[1]) : null;
}

/** skill_damage = (stat × K_STAT × stat% + power × power%) × K_SKILL × level mult. */
function perPress(skill, { stat, power, level }) {
  const s = parseScale(skill.scale);
  if (!s) return null;
  const base = stat * K_STAT * (s.statPct / 100) + power * (s.powerPct / 100);
  return base * K_SKILL * (1 + level * LEVEL_STEP / 100);
}

/** cooldown = base_cd × (1 − ladder/100) × (1 − cdr/100). */
function effCd(cd, cdrPct, ladderPct) {
  return cd * (1 - (cdrPct || 0) / 100) * (1 - (ladderPct || 0) / 100);
}

/** Everything a view needs for one skill at a given build. */
function row(skill, opts) {
  const cdr = opts.cdrPct != null ? opts.cdrPct : CAST_REF.cdr_pct;
  const ladder = opts.ladderPct != null ? opts.ladderPct : CAST_REF.ladder_pct;
  const ec = effCd(skill.cd, cdr, ladder);
  const pps = ec > 0 ? 1 / ec : null;
  const mp = manaPct(skill);
  return {
    skill,
    cd: skill.cd,
    effCd: ec,
    pressesPerSec: pps,
    manaPct: mp,
    manaPerSecPct: pps != null && mp != null ? pps * mp : null,
    damage: opts.stat != null && opts.power != null ? perPress(skill, opts) : null,
  };
}

module.exports = { K_STAT, K_SKILL, LEVEL_STEP, CAST_REF, parseScale, manaPct, perPress, effCd, row };
