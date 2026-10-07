/**
 * Skill-roster loader — the shared read of tools/data/skills.json.
 *
 * Everything that needs the roster (tools/skills.ts, tools/tree.ts, tools/lint.ts)
 * goes through here, so the count, the name→id map and the mechanic gate have one
 * definition. Counts are always derived from the data; nothing hand-types "43".
 */

import path from 'node:path';
import { readJson } from './json.ts';
import * as EN from './engine.ts';
import { createSkillModel } from '../../engine/skills.ts';
import type { SkillsData } from './types.ts';

const DATA = readJson<SkillsData>(path.join(import.meta.dirname, '..', 'data', 'skills.json'));
const SKILLS = DATA.skills;
const TYPES = DATA.meta.types;
const TYPE_META = DATA.meta.type_meta;
const WEAPON_GROUPS = DATA.meta.weapon_groups;
const ELEMENTS = DATA.meta.elements;
const RESERVE = DATA.reserve_tiers;
const DEPRECATED = DATA.deprecated || {};
const RENAMES = DATA.renames || {};

const byType = (t: string): any[] => SKILLS.filter((s) => s.type === t);
const count = (t: string): number => byType(t).length;
const total = (): number => SKILLS.length;
const nameMap = (): Map<string, any> => new Map(SKILLS.map((s) => [s.name, s]));
const idMap = (): Map<string, any> => new Map(SKILLS.map((s) => [s.id, s]));
const allNames = (): string[] => SKILLS.map((s) => s.name);
const fmt = (n: any): string => Number(n).toLocaleString('en-US');

/**
 * Mechanic gate (checks.md D18): the roster must be internally consistent and
 * satisfy the promises the design makes about coverage.
 * Returns [{ id, ok, detail }].
 */
function gates(): { id: string; ok: boolean; detail: string }[] {
  const out: { id: string; ok: boolean; detail: string }[] = [];
  const add = (id: string, ok: boolean, detail: string) => out.push({ id, ok, detail });

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

  const missingElement = ELEMENTS.filter((el: string) => !byType('attack').some((s) => s.element === el));
  add('S5', missingElement.length === 0, `every Element has an attack skill (${ELEMENTS.join(' · ')})${missingElement.length ? ' · MISSING: ' + missingElement.join(', ') : ''}`);

  const groupCounts: [string, number][] = WEAPON_GROUPS.map((g: string) => [g, byType('attack').filter((s) => s.group === g).length]);
  const thin = groupCounts.filter(([, n]) => n < 4);
  add('S6', thin.length === 0, `every weapon group has at least 4 attack skills (${groupCounts.map(([g, n]) => `${g} ${n}`).join(' · ')})${thin.length ? ' · THIN: ' + thin.map(([g]) => g).join(', ') : ''}`);

  const forbidden = SKILLS.filter((s) => /\b(mob|target|enemy)s?\s+armou?r\b|\b(mob|enemy)s?\s+mana\b/i.test(s.effect || '')).map((s) => s.id);
  add('S7', forbidden.length === 0, `no skill effect references mob armour or mob mana${forbidden.length ? ' · BAD: ' + forbidden.join(', ') : ''}`);

  const badReserve = byType('aura').filter((s) => s.reserve !== null && !(s.reserve in RESERVE)).map((s) => s.id);
  add('S8', badReserve.length === 0, `every aura reserve is a known tier or null (TBD)${badReserve.length ? ' · BAD: ' + badReserve.join(', ') : ''}`);

  const totalReserve = byType('aura').reduce((s, a) => s + (a.reserve ? RESERVE[a.reserve].pct : 0), 0);
  const block = (DATA.meta.reservation && DATA.meta.reservation.max_pct) || 100;
  add('S9', true, `the full aura set reserves ${totalReserve}% of the pool against the ${block}% block — the set can never all run at once, so the player must choose (informational)`);

  // Skill level: the XP rule must be reachable inside about one zone — a count of kills, never a
  // stretch of the clock (`AGENT.md` — no time limit, no play-length target).
  const SX = EN.E.skill_xp;
  const sp: string[] = [];
  let mult = 0;
  let killsToMax = 0;
  let zoneRatio = 0;
  if (!SX || !(SX.xp_per_step > 0) || !(SX.level_cap > 1)) sp.push('skill_xp is missing or has no step cost');
  else {
    killsToMax = (SX.level_cap - 1) * SX.xp_per_step / SX.xp_per_kill;
    // the Cap multiplier is read out of the calculator itself, never recomputed here (ramp:
    // final_pct × basis × (1 + (level − 1) × step)). What this gate protects is the band the design
    // promises — checks.md E12: gear ×5.6, skill ×1.1-1.4, nothing in between.
    const SM0 = createSkillModel(DATA, EN.E);
    mult = SM0.perPress({ id: '', basis: 'phys', final_pct: 100 }, { phys: 1, level: SX.level_cap }) ?? 0;
    if (!(mult > 1.1 && mult < 1.4)) sp.push(`a maxed skill multiplies its basis by ×${mult && mult.toFixed(3)}, outside the ×1.1-1.4 skill band (checks.md E12)`);
    // The band is "catch up inside about one zone", and a zone is its own kill budget — so a skill's
    // whole ladder is measured against what a settlement's zone pays, never against an hour.
    const budgets: number[] = Object.values(EN.SETTLEMENT_BUDGET_KILLS);
    const avgBudget = budgets.reduce((a: number, b: number) => a + b, 0) / budgets.length;
    zoneRatio = killsToMax / avgBudget;
    if (zoneRatio < 0.5 || zoneRatio > 2) sp.push(`one skill maxes in ${killsToMax.toLocaleString('en-US')} kills = ×${zoneRatio.toFixed(2)} an average zone's budget — outside the 0.5-2× "catch up inside about one zone" band`);
    const nullReserve = byType('aura').filter((a) => a.reserve === null).length;
    if (nullReserve) sp.push(`${nullReserve} aura(s) still have no reserve tier`);
    add('S10', sp.length === 0, sp.length ? sp.join(' \u00b7 ')
      : `skill level is earned per kill (${SX.xp_per_kill} XP) at ${SX.xp_per_step} XP a step to Cap ${SX.level_cap} = **${mult.toFixed(2)}** \u00b7 ${killsToMax.toLocaleString('en-US')} kills to max = ×${zoneRatio.toFixed(2)} an average zone's budget \u00b7 every aura carries a reserve tier`);
  }

  // Skill effects as data: a row may carry an `effects` list, and every number in it must be the
  // number the row's own `effect` sentence already prints (the rest closed).
  const SM = createSkillModel(DATA, EN.E);
  const declared = SKILLS.filter((s) => (s.effects || []).length);
  const badStat: string[] = [];
  const badValue: string[] = [];
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
    `${declared.length} of ${SKILLS.length} rows carry numeric effects (${declared.filter((s) => (s.effects || []).some((e: any) => e.subject === 'target')).length} of them target-side), and each value is printed in its own effect sentence` +
    `${badStat.length ? ' · UNKNOWN STAT: ' + badStat.join(', ') : ''}${badValue.length ? ' · NOT IN TEXT: ' + badValue.join(', ') : ''}`);
  const proseOnly = SKILLS.filter((s) => !(s.effects || []).length).map((s) => s.id);
  add('S12', SKILLS.every((s) => (s.effects || []).length || (s.rules || []).length || s.modelled_by), `${proseOnly.length} rows state a mechanic rather than a magnitude (${SKILLS.filter((s) => (s.rules || []).length).length} carry a rule word, ${SKILLS.filter((s) => s.modelled_by && !(s.effects || []).length).length} more are carried whole by another column) — every one of them is spent in the client, so no row is left as prose (informational)`);

  // B5: a press is a fraction of a finished hit, so an attack row without a named basis or
  // without its percentage presses nothing. The two reference bases the roster table prints are named
  // here too, and a hand-typed press column is refused: the table is generated from these numbers.
  const SM13 = createSkillModel(DATA, EN.E);
  const B13 = EN.REF;
  const attackRows = SKILLS.filter((s) => s.type === 'attack');
  const badBasis = attackRows.filter((s) => s.basis !== 'phys' && s.basis !== 'magic');
  const badPct = attackRows.filter((s) => !(typeof s.final_pct === 'number' && s.final_pct > 0));
  const handCopy = attackRows.filter((s) => s.damage);
  const num = (v: any): string => Math.round(v).toLocaleString('en-US');
  add('S13', badBasis.length === 0 && badPct.length === 0 && handCopy.length === 0,
    `${attackRows.length} attack rows press off a basis and a stated percentage` +
    ` · reference bases: glass phys ${num(B13.glass.phys)} · caster magic ${num(SM13.basisOf({ id: '', basis: 'magic' }, B13.caster))}` +
    ` (magic ${num(B13.caster.magic)} + elem ${num(B13.caster.elem)} × align ${B13.caster.align}%)` +
    `${badBasis.length ? ' · NO BASIS: ' + badBasis.map((s) => s.id).join(', ') : ''}` +
    `${badPct.length ? ' · NO final_pct: ' + badPct.map((s) => s.id).join(', ') : ''}` +
    `${handCopy.length ? ' · HAND-TYPED PRESS COLUMN: ' + handCopy.map((s) => s.id).join(', ') : ''}`);

  // B9 close-out: a row that states a mechanic instead of a magnitude names it from a
  // closed set, and nothing may be left as prose. `modelled_by` covers the rows whose mechanic is
  // already carried by another column — the AoE `targets` cell or `element: follow`.
  const badRule: string[] = [];
  for (const s of SKILLS) {
    for (const r of s.rules || []) if (!SM13.EFFECT_RULES.includes(r)) badRule.push(`${s.id}:${r}`);
    for (const b of [].concat(s.modelled_by || [])) if (!SM13.MODELLED_BY.includes(b)) badRule.push(`${s.id}:modelled_by ${b}`);
  }
  const onlyProse = SKILLS.filter((s) => !(s.effects || []).length && !(s.rules || []).length && !s.modelled_by).map((s) => s.id);
  add('S14', badRule.length === 0 && onlyProse.length === 0,
    `${SKILLS.length} rows all state their strength as effects, a mechanic word from the closed set` +
    ` (${SKILLS.filter((s) => (s.rules || []).length).length} with a rule, ${SKILLS.filter((s) => s.modelled_by).length} carried by another column)` +
    `${badRule.length ? ' · UNKNOWN: ' + badRule.join(', ') : ''}${onlyProse.length ? ' · PROSE ONLY: ' + onlyProse.join(', ') : ''}`);

  //: a mana cost is one string carrying its own unit — `N%` of the usable pool or `N flat`
  // units — and the unit is mandatory, because a cost that reads as 0 would make the skill free.
  const paidRows = SKILLS.filter((s) => s.type !== 'aura');
  const unreadable = paidRows.filter((s) => !SM13.manaSpec(s)).map((s) => s.id);
  const bothUnits = paidRows.filter((s) => /%/.test(String(s.mana || '')) && /flat/.test(String(s.mana || ''))).map((s) => s.id);
  const freeAtCap = paidRows.filter((s) => {
    const ms = SM13.manaSpec(s);
    if (!ms || ms.kind !== 'flat') return false;
    return !(SM13.manaCostOf(s, { skillLevel: 1, maxMana: SM13.MANA_REF_POOL, usableMana: SM13.MANA_REF_POOL }) > 0
      && SM13.manaCostOf(s, { skillLevel: SX.level_cap, maxMana: SM13.MANA_REF_POOL, usableMana: SM13.MANA_REF_POOL }) > 0);
  }).map((s) => s.id);
  const flatRows = paidRows.filter((s) => (SM13.manaSpec(s) || { kind: '' }).kind === 'flat');
  // the two branches must answer for their own unit: a % row priced through the flat branch (or the
  // reverse) is the silent way this model goes wrong, so the resolver is checked against its own form
  const swapped = paidRows.filter((s) => {
    const ms = SM13.manaSpec(s);
    if (!ms) return false;
    const got = SM13.manaCostOf(s, { maxMana: 1000, usableMana: 1000 });
    return ms.kind === 'pct' ? Math.abs(got - 1000 * ms.value / 100) > 1e-9 : got <= ms.value;
  }).map((s) => s.id);
  add('S15', unreadable.length === 0 && bothUnits.length === 0 && freeAtCap.length === 0 && swapped.length === 0,
    `${paidRows.length} paid rows carry a readable cost — ${paidRows.length - flatRows.length} % of the usable pool, ${flatRows.length} flat units` +
    (flatRows.length ? ` · every flat row is quoted against the level-${(DATA.meta.formula || {}).mana_reference_level ?? 1} pool of ${fmt(SM13.MANA_REF_POOL)}` : '') +
    `${unreadable.length ? ' · NO READABLE COST: ' + unreadable.join(', ') : ''}` +
    `${bothUnits.length ? ' · BOTH UNITS: ' + bothUnits.join(', ') : ''}` +
    `${freeAtCap.length ? ' · FREE AT THE CAP: ' + freeAtCap.join(', ') : ''}` +
    `${swapped.length ? ' · PRICED THROUGH THE WRONG FORM: ' + swapped.join(', ') : ''}`);

  //: S10 bands the damage ramp only. A flat cost has its own, steeper step and a pool-growth
  // term, and the ratio the two make at the cap is the number the design stands on.
  const F = DATA.meta.formula || {};
  const costStep = SM13.MANA_LEVEL_STEP, dmgStep = SM13.LEVEL_STEP, poolExp = SM13.MANA_POOL_EXPONENT;
  const atCap = (step: number) => 1 + (SX.level_cap - 1) * step / 100;
  const ratio = atCap(costStep) / atCap(dmgStep);
  add('S16', costStep > dmgStep && poolExp > 0 && poolExp <= 1,
    `a flat cost climbs ${costStep}% a skill level against the damage ramp's ${dmgStep}%, so a maxed rotation is ×${ratio.toFixed(2)} the mana-hungry of a fresh one` +
    ` · the pool term is (pool / ${fmt(SM13.MANA_REF_POOL)})^${poolExp}` +
    `${costStep <= dmgStep ? ' · NOT STEEPER THAN THE DAMAGE RAMP' : ''}${poolExp <= 0 || poolExp > 1 ? ' · EXPONENT OUTSIDE (0, 1]' : ''}`);

  //: the `(AoE ×n)` suffix is decoration the client never reads — the sim derives AoE from the
  // target count — so a suffix that disagrees with the data is a second source for the multiplier.
  const badAoe = paidRows.filter((s) => {
    const m = String(s.mana || '').match(/AoE\s*[×x]\s*(\d+(?:\.\d+)?)/i);
    return m && Number(m[1]) !== EN.E.aoe.mana_mult;
  }).map((s) => `${s.id}:${(String(s.mana || '').match(/AoE\s*[×x]\s*(\d+(?:\.\d+)?)/i) || [])[1]}`);
  add('S17', badAoe.length === 0,
    `every (AoE ×n) suffix in a mana cost states the data's own ${EN.E.aoe.mana_mult} mana multiplier` +
    `${badAoe.length ? ' · DISAGREES: ' + badAoe.join(', ') : ''}`);

  return out;
}

export {
  DATA, SKILLS, TYPES, TYPE_META, WEAPON_GROUPS, ELEMENTS, RESERVE, DEPRECATED, RENAMES,
  byType, count, total, nameMap, idMap, allNames, fmt, gates,
};
