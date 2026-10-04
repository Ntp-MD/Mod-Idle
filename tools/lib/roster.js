'use strict';

/**
 * Skill-roster loader — the shared read of tools/data/skills.json.
 *
 * Everything that needs the roster (tools/skills.js, tools/tree.js, tools/lint.js)
 * goes through here, so the count, the name→id map and the mechanic gate have one
 * definition. Counts are always derived from the data; nothing hand-types "43".
 */

const fs = require('fs');
const path = require('path');

const DATA = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'skills.json'), 'utf8'));
const SKILLS = DATA.skills;
const TYPES = DATA.meta.types;
const TYPE_META = DATA.meta.type_meta;
const WEAPON_GROUPS = DATA.meta.weapon_groups;
const ELEMENTS = DATA.meta.elements;
const RESERVE = DATA.reserve_tiers;
const DEPRECATED = DATA.deprecated || {};
const RENAMES = DATA.renames || {};

const byType = (t) => SKILLS.filter((s) => s.type === t);
const count = (t) => byType(t).length;
const total = () => SKILLS.length;
const nameMap = () => new Map(SKILLS.map((s) => [s.name, s]));
const idMap = () => new Map(SKILLS.map((s) => [s.id, s]));
const allNames = () => SKILLS.map((s) => s.name);
const fmt = (n) => Number(n).toLocaleString('en-US');

/**
 * Mechanic gate (checks.md D18): the roster must be internally consistent and
 * satisfy the promises the design makes about coverage.
 * Returns [{ id, ok, detail }].
 */
function gates() {
  const out = [];
  const add = (id, ok, detail) => out.push({ id, ok, detail });

  const ids = SKILLS.map((s) => s.id);
  const dupIds = ids.filter((x, i) => ids.indexOf(x) !== i);
  add('S1', dupIds.length === 0, `unique skill ids (${ids.length} records)${dupIds.length ? ' · DUPLICATES: ' + [...new Set(dupIds)].join(', ') : ''}`);

  const names = SKILLS.map((s) => s.name);
  const dupNames = names.filter((x, i) => names.indexOf(x) !== i);
  add('S2', dupNames.length === 0, `unique skill names${dupNames.length ? ' · DUPLICATES: ' + [...new Set(dupNames)].join(', ') : ''}`);

  const badType = SKILLS.filter((s) => !TYPES.includes(s.type)).map((s) => s.id);
  add('S3', badType.length === 0, `every skill has a known type (${TYPES.join(' · ')})${badType.length ? ' · BAD: ' + badType.join(', ') : ''}`);

  const badAttack = byType('attack').filter((s) => !WEAPON_GROUPS.includes(s.group) && s.group !== 'all').map((s) => s.id);
  add('S4', badAttack.length === 0, `every attack skill names a weapon group or "all"${badAttack.length ? ' · BAD: ' + badAttack.join(', ') : ''}`);

  const missingElement = ELEMENTS.filter((el) => !byType('attack').some((s) => s.element === el));
  add('S5', missingElement.length === 0, `every Element has an attack skill (${ELEMENTS.join(' · ')})${missingElement.length ? ' · MISSING: ' + missingElement.join(', ') : ''}`);

  const groupCounts = WEAPON_GROUPS.map((g) => [g, byType('attack').filter((s) => s.group === g).length]);
  const thin = groupCounts.filter(([, n]) => n < 4);
  add('S6', thin.length === 0, `every weapon group has at least 4 attack skills (${groupCounts.map(([g, n]) => `${g} ${n}`).join(' · ')})${thin.length ? ' · THIN: ' + thin.map(([g]) => g).join(', ') : ''}`);

  const forbidden = SKILLS.filter((s) => /\b(mob|target|enemy)s?\s+armou?r\b|\b(mob|enemy)s?\s+mana\b/i.test(s.effect || '')).map((s) => s.id);
  add('S7', forbidden.length === 0, `no skill effect references mob armour or mob mana${forbidden.length ? ' · BAD: ' + forbidden.join(', ') : ''}`);

  const badReserve = byType('aura').filter((s) => s.reserve !== null && !(s.reserve in RESERVE)).map((s) => s.id);
  add('S8', badReserve.length === 0, `every aura reserve is a known tier or null (TBD)${badReserve.length ? ' · BAD: ' + badReserve.join(', ') : ''}`);

  const totalReserve = byType('aura').reduce((s, a) => s + (a.reserve ? RESERVE[a.reserve].pct : 0), 0);
  const block = (DATA.meta.reservation && DATA.meta.reservation.max_pct) || 100;
  add('S9', true, `the full aura set reserves ${totalReserve}% of the pool against the ${block}% block — the set can never all run at once, so the player must choose (informational)`);

  // Skill level: the XP rule must be reachable in hours, not in lifetimes (D-039).
  const EN = require('./engine');
  const SX = EN.E.skill_xp;
  const sp = [];
  if (!SX || !(SX.xp_per_step > 0) || !(SX.level_cap > 1)) sp.push('skill_xp is missing or has no step cost');
  else {
    const killsToMax = (SX.level_cap - 1) * SX.xp_per_step / SX.xp_per_kill;
    // the Cap multiplier is read out of the calculator itself, never recomputed here (D-070 ramp:
    // final_pct × basis × (1 + (level − 1) × step)). What this gate protects is the band the design
    // promises — checks.md E12: gear ×5.6, skill ×1.1-1.4, nothing in between.
    const SM0 = require('../../engine/skills.js').createSkillModel(DATA, EN.E);
    const mult = SM0.perPress({ basis: 'phys', final_pct: 100 }, { phys: 1, level: SX.level_cap });
    if (!(mult > 1.1 && mult < 1.4)) sp.push(`a maxed skill multiplies its basis by ×${mult && mult.toFixed(3)}, outside the ×1.1-1.4 skill band (checks.md E12)`);
    const hrs = ['low', 'mid', 'high'].map((b) => killsToMax / EN.BAND[b].kills_per_hr);
    if (Math.min(...hrs) < 2 || Math.max(...hrs) > 10) sp.push(`one skill maxes in ${hrs.map((h) => h.toFixed(1)).join(' / ')} hr by band — outside the 2-10 hr "catch up inside about one zone" band`);
    const nullReserve = byType('aura').filter((a) => a.reserve === null).length;
    if (nullReserve) sp.push(`${nullReserve} aura(s) still have no reserve tier`);
    add('S10', sp.length === 0, sp.length ? sp.join(' \u00b7 ')
      : `skill level is earned per kill (${SX.xp_per_kill} XP) at ${SX.xp_per_step} XP a step to Cap ${SX.level_cap} = **${mult.toFixed(2)}** \u00b7 ${killsToMax.toLocaleString('en-US')} kills to max = ${hrs.map((h, i) => `${['low', 'mid', 'high'][i]} ${h.toFixed(1)} hr`).join(' \u00b7 ')} \u00b7 every aura carries a reserve tier`);
  }

  // Skill effects as data: a row may carry an `effects` list, and every number in it must be the
  // number the row's own `effect` sentence already prints (D-085, the rest closed by D-102).
  const { createSkillModel } = require('../../engine/skills.js');
  const SM = createSkillModel(DATA, require('./engine').E);
  const declared = SKILLS.filter((s) => (s.effects || []).length);
  const badStat = [];
  const badValue = [];
  for (const s of SKILLS) {
    for (const e of s.effects || []) {
      if (!SM.EFFECT_STATS.includes(e.stat) || !SM.EFFECT_OPS.includes(e.op)) badStat.push(`${s.id}:${e.stat}/${e.op}`);
      if (!SM.EFFECT_SUBJECTS.includes(e.subject || 'self')) badStat.push(`${s.id}:subject ${e.subject}`);
      if (e.condition && !SM.EFFECT_CONDITIONS.includes(e.condition)) badStat.push(`${s.id}:condition ${e.condition}`);
      if (e.element && !EN.E.elements.order.includes(e.element)) badStat.push(`${s.id}:element ${e.element}`);
      // a minus written as a real minus sign (−12%) is the same number as -12 in the data
      const text = String(s.effect || '').replace(/−/g, '-');
      if (!text.includes(String(e.value))) badValue.push(`${s.id}:${e.value}`);
    }
  }
  add('S11', badStat.length === 0 && badValue.length === 0,
    `${declared.length} of ${SKILLS.length} rows carry numeric effects (${declared.filter((s) => (s.effects || []).some((e) => e.subject === 'target')).length} of them target-side), and each value is printed in its own effect sentence` +
    `${badStat.length ? ' · UNKNOWN STAT: ' + badStat.join(', ') : ''}${badValue.length ? ' · NOT IN TEXT: ' + badValue.join(', ') : ''}`);
  const proseOnly = SKILLS.filter((s) => !(s.effects || []).length).map((s) => s.id);
  add('S12', SKILLS.every((s) => (s.effects || []).length || (s.rules || []).length || s.modelled_by), `${proseOnly.length} rows state a mechanic rather than a magnitude (${SKILLS.filter((s) => (s.rules || []).length).length} carry a rule word, ${SKILLS.filter((s) => s.modelled_by && !(s.effects || []).length).length} more are carried whole by another column) — every one of them is spent in the client, so no row is left as prose (informational)`);

  // B5 · D-070: a press is a fraction of a finished hit, so an attack row without a named basis or
  // without its percentage presses nothing. The two reference bases the roster table prints are named
  // here too, and a hand-typed press column is refused: the table is generated from these numbers.
  const SM13 = require('../../engine/skills.js').createSkillModel(DATA, require('./engine').E);
  const B13 = require('./engine').REF;
  const attackRows = SKILLS.filter((s) => s.type === 'attack');
  const badBasis = attackRows.filter((s) => s.basis !== 'phys' && s.basis !== 'magic');
  const badPct = attackRows.filter((s) => !(typeof s.final_pct === 'number' && s.final_pct > 0));
  const handCopy = attackRows.filter((s) => s.damage);
  const num = (v) => Math.round(v).toLocaleString('en-US');
  add('S13', badBasis.length === 0 && badPct.length === 0 && handCopy.length === 0,
    `${attackRows.length} attack rows press off a basis and a stated percentage` +
    ` · reference bases: glass phys ${num(B13.glass.phys)} · caster magic ${num(SM13.basisOf({ basis: 'magic' }, B13.caster))}` +
    ` (magic ${num(B13.caster.magic)} + elem ${num(B13.caster.elem)} × align ${B13.caster.align}%)` +
    `${badBasis.length ? ' · NO BASIS: ' + badBasis.map((s) => s.id).join(', ') : ''}` +
    `${badPct.length ? ' · NO final_pct: ' + badPct.map((s) => s.id).join(', ') : ''}` +
    `${handCopy.length ? ' · HAND-TYPED PRESS COLUMN: ' + handCopy.map((s) => s.id).join(', ') : ''}`);

  // B9 close-out (D-102): a row that states a mechanic instead of a magnitude names it from a
  // closed set, and nothing may be left as prose. `modelled_by` covers the rows whose mechanic is
  // already carried by another column — the AoE `targets` cell or `element: follow`.
  const badRule = [];
  for (const s of SKILLS) {
    for (const r of s.rules || []) if (!SM13.EFFECT_RULES.includes(r)) badRule.push(`${s.id}:${r}`);
    for (const b of [].concat(s.modelled_by || [])) if (!SM13.MODELLED_BY.includes(b)) badRule.push(`${s.id}:modelled_by ${b}`);
  }
  const onlyProse = SKILLS.filter((s) => !(s.effects || []).length && !(s.rules || []).length && !s.modelled_by).map((s) => s.id);
  add('S14', badRule.length === 0 && onlyProse.length === 0,
    `${SKILLS.length} rows all state their strength as effects, a mechanic word from the closed set` +
    ` (${SKILLS.filter((s) => (s.rules || []).length).length} with a rule, ${SKILLS.filter((s) => s.modelled_by).length} carried by another column)` +
    `${badRule.length ? ' · UNKNOWN: ' + badRule.join(', ') : ''}${onlyProse.length ? ' · PROSE ONLY: ' + onlyProse.join(', ') : ''}`);

  return out;
}

module.exports = {
  DATA, SKILLS, TYPES, TYPE_META, WEAPON_GROUPS, ELEMENTS, RESERVE, DEPRECATED, RENAMES,
  byType, count, total, nameMap, idMap, allNames, fmt, gates,
};
