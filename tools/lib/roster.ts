/**
 * Skill-roster loader — the shared read of tools/data/skills.json.
 *
 * Everything that needs the roster (tools/skills.ts)
 * goes through here, so the count, the name→id map and the mechanic gate have one
 * definition. Counts are always derived from the data; nothing hand-types "43".
 */

import path from 'node:path';
import { readJson } from './json.ts';
import * as G from './gates.ts';
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

const ACTIVE = SKILLS.filter((s: any) => !s.retired);
const byType = (t: string): any[] => SKILLS.filter((s) => s.type === t);
const activeByType = (t: string): any[] => ACTIVE.filter((s) => s.type === t);
const count = (t: string): number => byType(t).length;
const activeCount = (t: string): number => activeByType(t).length;
const total = (): number => SKILLS.length;
const activeTotal = (): number => ACTIVE.length;
const retiredTotal = (): number => SKILLS.length - ACTIVE.length;
const nameMap = (): Map<string, any> => new Map(SKILLS.map((s) => [s.name, s]));
const idMap = (): Map<string, any> => new Map(SKILLS.map((s) => [s.id, s]));
const allNames = (): string[] => SKILLS.map((s) => s.name);
const fmt = (n: any): string => Number(n).toLocaleString('en-US');

/**
 * Mechanic gate: the roster must be internally consistent and
 * satisfy the promises the design makes about coverage.
 * Returns the gate rows, ready for `G.report()`.
 */
function gates(): G.GateRow[] {
  const g = G.gates();
  const { add, soft } = g;

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

  // An Element declared AHEAD of its content (engine.json `elements.pending`) is a real member of the
  // order without pretending its rows exist yet — declaring earth must not itself demand an earth attack.
  const PENDING_ELEMENTS: string[] = Object.keys(((EN.E.elements as any).pending || {}) as Record<string, string>);
  const missingElement = ELEMENTS.filter((el: string) => !PENDING_ELEMENTS.includes(el) && !activeByType('attack').some((s) => s.element === el));
  add('S5', missingElement.length === 0, `every Element has an attack skill (${ELEMENTS.join(' · ')})${PENDING_ELEMENTS.length ? ` · declared pending: ${PENDING_ELEMENTS.join(', ')}` : ''}${missingElement.length ? ' · MISSING: ' + missingElement.join(', ') : ''}`);

  const forbidden = SKILLS.filter((s) => /\b(mob|target|enemy)s?\s+armou?r\b|\b(mob|enemy)s?\s+mana\b/i.test(s.effect || '')).map((s) => s.id);
  add('S7', forbidden.length === 0, `no skill effect references mob armour or mob mana${forbidden.length ? ' · BAD: ' + forbidden.join(', ') : ''}`);

  const badReserve = activeByType('aura').filter((s) => s.reserve !== null && !(s.reserve in RESERVE)).map((s) => s.id);
  add('S8', badReserve.length === 0, `every aura reserve is a known tier or null (TBD)${badReserve.length ? ' · BAD: ' + badReserve.join(', ') : ''}`);

  const totalReserve = activeByType('aura').reduce((s, a) => s + (a.reserve ? RESERVE[a.reserve].pct : 0), 0);
  const block = (DATA.meta.reservation && DATA.meta.reservation.max_pct) || 100;
  soft('S9', totalReserve > block, `the full aura set reserves ${totalReserve}% of the pool against the ${block}% block — more than the pool holds, so the set can never all run at once and the player must choose`);

  const SX = EN.E.skill_xp;

  // The per-level table is the one home of the ramp, so its shape is a promise: one row per level,
  // continuous, never falling, and the first row the identity. `special_level_effects` must name real
  // effect stats — a typo there silently stops scaling the very effect it was meant to exempt.
  {
    const T = (DATA.meta.formula && (DATA.meta.formula as any).skill_levels) || null;
    const tp: string[] = [];
    const rows: any[] = (T && T.rows) || [];
    if (!rows.length) tp.push('no skill_levels table');
    else {
      if (rows.length !== SX.level_cap) tp.push(`${rows.length} row(s) against skill_xp.level_cap ${SX.level_cap}`);
      if (rows[0].level !== 1 || !(rows[0].damage_pct > 0) || !(rows[0].effect_pct > 0)) tp.push('the first row is not level 1 with a positive multiplier');
      if (!(rows[0].buff_effect_pct > 0)) tp.push('the first row carries no positive buff/aura effect multiplier');
      rows.forEach((r: any, i: number) => {
        if (r.level !== i + 1) tp.push(`row ${i + 1} is level ${r.level}`);
        if (i && r.damage_pct < rows[i - 1].damage_pct) tp.push(`damage_pct falls at level ${r.level}`);
        if (i && r.effect_pct < rows[i - 1].effect_pct) tp.push(`effect_pct falls at level ${r.level}`);
        if (i && r.buff_effect_pct < rows[i - 1].buff_effect_pct) tp.push(`buff_effect_pct falls at level ${r.level}`);
        if (!Number.isInteger(r.buff_effect_pct)) tp.push(`buff_effect_pct is a fraction at level ${r.level}`);
      });
    }
    const SM18 = createSkillModel(DATA, EN.E);
    const specials: string[] = ((T && T.special_level_effects) || []) as string[];
    const unknown = specials.filter((s) => !SM18.EFFECT_STATS.includes(s));
    if (unknown.length) tp.push(`special_level_effects names unknown stats: ${unknown.join(', ')}`);
    const last = rows[rows.length - 1];
    add('S18', tp.length === 0, tp.length ? tp.join(' \u00b7 ')
      : `the level table is the one ramp: ${rows.length} rows climbing from ${rows[0].damage_pct}% damage, ${rows[0].effect_pct}% effect and ${rows[0].buff_effect_pct}% buff/aura effect at level 1 to ${last.damage_pct}% / ${last.effect_pct}% / ${last.buff_effect_pct}% at level ${last.level}, never falling, the buff/aura column whole numbers throughout · ${specials.length} effect stat(s) opt out because each already spends skill level its own way`);
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
      // the payoff effects read one named mob status; the status is data, never inferred from the row's Element
      if (SM.STATUS_EFFECTS.includes(e.stat)) {
        if (!SM.EFFECT_STATUSES.includes(e.status)) badStat.push(`${s.id}:status ${e.status}`);
        if ((e.subject || 'self') !== 'target') badStat.push(`${s.id}:${e.stat} subject ${e.subject || 'self'}`);
        const wantOp = e.stat === 'spread_status' ? 'add_flat' : 'add_pct';
        if (e.op !== wantOp) badStat.push(`${s.id}:${e.stat} op ${e.op}`);
        if (e.cap != null && (!Number.isInteger(e.cap) || e.cap <= 0)) badStat.push(`${s.id}:${e.stat} cap ${e.cap}`);
      } else if (e.status) badStat.push(`${s.id}:status on ${e.stat}`);
      // a minus written as a real minus sign (−12%) is the same number as -12 in the data
      const text = String(s.effect || '').replace(/−/g, '-');
      if (!text.includes(String(e.value))) badValue.push(`${s.id}:${e.value}`);
    }
  }
  add('S11', badStat.length === 0 && badValue.length === 0,
    `${declared.length} of ${SKILLS.length} rows carry numeric effects (${declared.filter((s) => (s.effects || []).some((e: any) => e.subject === 'target')).length} of them target-side), and each value is printed in its own effect sentence` +
    `${badStat.length ? ' · UNKNOWN STAT: ' + badStat.join(', ') : ''}${badValue.length ? ' · NOT IN TEXT: ' + badValue.join(', ') : ''}`);
  // S19 · conversion's Cap is the whole hit (`draft/convert-damage.md` · `convertDamageOf`), and a Cap
  // that cannot be reached is a lie (D3). The `damage_conversion` rows are the only source, so they must
  // sum to the Cap or past it — overflow is wasted, never a multiplier.
  {
    const conv = SKILLS.flatMap((s: any) => (s.effects || [])
      .filter((e: any) => e.stat === 'damage_conversion')
      .map((e: any) => ({ id: s.id, pct: e.value, el: e.element })));
    const sum = conv.reduce((t: number, e: any) => t + e.pct, 0);
    soft('S19', conv.length > 0 && sum >= 100,
      `${conv.length} conversion rows (${conv.map((e: any) => `${e.el} ${e.pct}%`).join(' · ')}) sum to ${sum}% against the whole-hit Cap 100, so running them all reaches it — the Cap is not a number that misleads a build (D3)`);
  }

  // B5: a press is its own flat damage plus a stated share of the finished hit, so an attack row
  // without a named basis or without both damage numbers presses nothing. The two reference bases the
  // roster table prints are named here too, and a hand-typed press column is refused: the table is
  // generated from these numbers.
  const SM13 = createSkillModel(DATA, EN.E);
  const B13 = EN.eng.REF;
  const attackRows = SKILLS.filter((s) => s.type === 'attack');
  const badBasis = attackRows.filter((s) => s.basis !== 'phys' && s.basis !== 'magic');
  const badPct = attackRows.filter((s) => !(typeof s.base_flat === 'number' && s.base_flat > 0 && typeof s.eff === 'number' && s.eff >= 0));
  const handCopy = attackRows.filter((s) => s.damage);
  const num = (v: any): string => Math.round(v).toLocaleString('en-US');
  soft('S13', badBasis.length === 0 && badPct.length === 0 && handCopy.length === 0,
    `${attackRows.length} attack rows press off a basis, their own flat and their effectiveness` +
    ` · reference bases: glass phys ${num(B13.glass.phys)} · caster magic ${num(SM13.basisOf({ id: '', basis: 'magic' }, B13.caster))}` +
    ` (magic ${num(B13.caster.magic)} + elem ${num(B13.caster.elem)} × align ${B13.caster.align}%)` +
    `${badBasis.length ? ' · NO BASIS: ' + badBasis.map((s) => s.id).join(', ') : ''}` +
    `${badPct.length ? ' · NO base_flat/eff: ' + badPct.map((s) => s.id).join(', ') : ''}` +
    `${handCopy.length ? ' · HAND-TYPED PRESS COLUMN: ' + handCopy.map((s) => s.id).join(', ') : ''}`);

  //: every paid row has one typed, flat resource cost: Mana or current HP, never both. A cost written
  // as a share of either pool is the retired form; pool size controls affordability, not the price.
  const paidRows = SKILLS.filter((s) => s.type !== 'aura');
  const dualCost = paidRows.filter((s) => s.mana != null && s.hp_cost != null).map((s) => s.id);
  const unreadable = paidRows.filter((s) => s.mana != null && s.hp_cost != null
    ? false : s.hp_cost != null ? SM13.hpCostSpec(s) == null : SM13.manaSpec(s) == null).map((s) => s.id);
  const percentLeft = paidRows.filter((s) => /%/.test(String(s.mana || '')) || /%/.test(String(s.hp_cost || ''))).map((s) => s.id);
  const pricedRows = paidRows.filter((s) => !dualCost.includes(s.id) && (SM13.manaSpec(s) != null || SM13.hpCostSpec(s) != null));
  const freeAtCap = paidRows.filter((s) => {
    if (!pricedRows.includes(s)) return false;
    return !(SM13.costOf(s, { skillLevel: 1 }).amount > 0 && SM13.costOf(s, { skillLevel: SX.level_cap }).amount > 0);
  }).map((s) => s.id);
  // the typed number IS the level-1 price: no term of any kind — pool, gear or band — re-prices it
  const hiddenTerm = pricedRows.filter((s) => {
    const v = s.hp_cost != null ? SM13.hpCostSpec(s) : SM13.manaSpec(s);
    return v != null && Math.abs(SM13.costOf(s, { skillLevel: 1 }).amount - v) > 1e-9;
  }).map((s) => s.id);
  soft('S15', dualCost.length === 0 && unreadable.length === 0 && percentLeft.length === 0 && freeAtCap.length === 0 && hiddenTerm.length === 0,
    `${paidRows.length} paid rows each charge one typed flat resource (Mana or current HP); pool size changes affordability, not price` +
    `${unreadable.length ? ' · NO READABLE COST: ' + unreadable.join(', ') : ''}` +
    `${dualCost.length ? ' · BOTH RESOURCES: ' + dualCost.join(', ') : ''}` +
    `${percentLeft.length ? ' · STILL A SHARE OF A POOL: ' + percentLeft.join(', ') : ''}` +
    `${freeAtCap.length ? ' · FREE AT THE CAP: ' + freeAtCap.join(', ') : ''}` +
    `${hiddenTerm.length ? ' · A TERM OTHER THAN THE LEVEL: ' + hiddenTerm.join(', ') : ''}`);

  // S10 bands the damage ramp only. A cost has its own step and that step is the only term it answers
  // to, so the promise is measured on the rows rather than read off the constant: from level 1 to the
  // cap every paid row must come out at exactly `1 + (cap - 1) × step`. It no longer demands a steeper
  // cost than the damage ramp: a fresh skill presses a quarter of what it will (owner ruling), so a
  // level buys more damage than mana and the maxed rotation is the efficient one — that is the design.
  const costStep = SM13.COST_LEVEL_STEP, dmgStep = SM13.LEVEL_STEP;
  const atCap = (step: number) => 1 + (SX.level_cap - 1) * step / 100;
  const priced = pricedRows;
  const offLadder = priced.filter((s) => Math.abs(
    SM13.costOf(s, { skillLevel: SX.level_cap }).amount / SM13.costOf(s, { skillLevel: 1 }).amount - atCap(costStep)) > 1e-9).map((s) => s.id);
  soft('S16', costStep > 0 && offLadder.length === 0,
    `Mana and HP costs climb ${costStep}% a skill level and the level ladder is their only price term — all ${priced.length} paid rows reach ×${atCap(costStep).toFixed(2)} at cap while presses reach ×${atCap(dmgStep).toFixed(2)} — a level buys efficiency` +
    `${costStep <= 0 ? ' · A COST MUST RISE WITH SKILL LEVEL' : ''}${offLadder.length ? ' · OFF THE LADDER: ' + offLadder.join(', ') : ''}`);

  //: the `(AoE ×n)` suffix is decoration the client never reads — the sim derives AoE from the
  // target count — so a suffix that disagrees with the data is a second source for the multiplier.
  const badAoe = paidRows.filter((s) => {
    const m = String(s.mana || '').match(/AoE\s*[×x]\s*(\d+(?:\.\d+)?)/i);
    return m && Number(m[1]) !== EN.E.aoe.mana_mult;
  }).map((s) => `${s.id}:${(String(s.mana || '').match(/AoE\s*[×x]\s*(\d+(?:\.\d+)?)/i) || [])[1]}`);
  soft('S17', badAoe.length === 0,
    `every (AoE ×n) suffix in a mana cost states the data's own ${EN.E.aoe.mana_mult} mana multiplier` +
    `${badAoe.length ? ' · DISAGREES: ' + badAoe.join(', ') : ''}`);

  // A caster Max-HP basis is an additive percentage term inside the skill press formula.
  const badMaxHpBasis = SKILLS.filter((s) => s.max_hp_pct != null
    && (s.type !== 'attack' || !Number.isFinite(s.max_hp_pct) || s.max_hp_pct <= 0 || s.base_flat == null || s.eff == null))
    .map((s) => s.id);
  soft('S20', badMaxHpBasis.length === 0,
    `caster Max HP damage is a positive percentage on attack rows with a complete press formula` +
    `${badMaxHpBasis.length ? ' · INVALID: ' + badMaxHpBasis.join(', ') : ''}`);

  // Retiring is a live-roster operation, not a deletion: an old save still resolves the id, while
  // drops, named rewards and the owned/active lists read ACTIVE only. A retired row must hand its
  // role to a live row, and a live row must never point at itself or at another retired row.
  const activeIds = new Set(ACTIVE.map((s: any) => s.id));
  const badRetired = SKILLS.filter((s: any) => s.retired && (!s.retired_to || !activeIds.has(s.retired_to) || s.retired_to === s.id))
    .map((s: any) => `${s.id}→${s.retired_to || 'missing'}`);
  const badLive = ACTIVE.filter((s: any) => s.retired_to).map((s: any) => s.id);
  soft('S21', badRetired.length === 0 && badLive.length === 0,
    `${retiredTotal()} retired row(s) leave the live roster while keeping their ids resolvable; ${activeTotal()} active row(s) carry the live roles` +
    `${badRetired.length ? ' · BAD RETIRED TARGET: ' + badRetired.join(', ') : ''}` +
    `${badLive.length ? ' · ACTIVE ROW CARRIES retired_to: ' + badLive.join(', ') : ''}`);

  // A payoff row that reads a status no live row can write is a dead row. This is the data-level twin
  // of the runtime `appliedStatusOf`: stacks/counts, a direct stop or stun, and the row's own
  // guaranteed Element status are the only ways a player press writes a mob status.
  const statusOfElement = ((EN.E.elements as any).status_of || {}) as Record<string, string>;
  const appliedStatuses = new Set<string>();
  const exploitedStatuses = new Set<string>();
  for (const s of ACTIVE) {
    for (const e of (s.effects || [])) {
      if (e.stat === 'bonus_vs_status' || e.stat === 'consume_status' || e.stat === 'spread_status') {
        if (e.status) exploitedStatuses.add(e.status);
      }
      if (e.subject !== 'target') continue;
      if (e.stat === 'burn_stacks') appliedStatuses.add('burn');
      if (e.stat === 'poison_stacks') appliedStatuses.add('poison');
      if (e.stat === 'mark_stacks') appliedStatuses.add('mark');
      if (e.stat === 'bleed_chance') appliedStatuses.add('bleed');
      if (e.stat === 'stop_sec' || e.stat === 'stun_chance') appliedStatuses.add('shock');
    }
    if (((s.rules || []) as string[]).includes('guaranteed_status') && statusOfElement[s.element]) {
      appliedStatuses.add(statusOfElement[s.element]);
    }
  }
  const deadPayoffs = [...exploitedStatuses].filter((status) => !appliedStatuses.has(status));
  soft('S22', deadPayoffs.length === 0,
    `${exploitedStatuses.size} exploited status(es) each have a live writer: ${[...exploitedStatuses].sort().join(' · ')}` +
    `${deadPayoffs.length ? ' · NO LIVE WRITER: ' + deadPayoffs.join(', ') : ''}`);

  return g.rows();
}

export {
  DATA, SKILLS, ACTIVE, TYPES, TYPE_META, WEAPON_GROUPS, ELEMENTS, RESERVE, DEPRECATED, RENAMES,
  byType, activeByType, count, activeCount, total, activeTotal, retiredTotal, nameMap, idMap, allNames, fmt, gates,
};
