/**
 * Skill cage — `tools/data/skills.json` is the roster source of truth.
 *
 *   node tools/skills.ts --checks   the mechanic gate (roster · effects · basis)
 *   node tools/skills.ts --calc     the live workshop: dmg/press · eff cd · press/s · cost/s
 *                                   flags: --build glass|caster --level N --cdr N --ladder N
 *
 * Counts, names, reserves, effects and the press itself are computed from the data — never
 * hand-typed anywhere. `engine/skills.ts` is the one calculator; the client calls the same function.
 */

import * as R from './lib/roster.ts';
import { model as M } from './lib/skillmodel.ts';
import { eng } from './lib/engine.ts';
import * as G from './lib/gates.ts';

const { byType, fmt, TYPES } = R;

function calc() {
  const flags: Record<string, any> = {};
  for (let i = 3; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const v = process.argv[i + 1];
    if (v && !v.startsWith('--')) { flags[a.slice(2)] = Number(v); i++; } else flags[a.slice(2)] = true;
  }
  const cdrPct = flags.cdr != null ? flags.cdr : M.CAST_REF.cdr_pct;
  const ladderPct = flags.ladder != null ? flags.ladder : M.CAST_REF.ladder_pct;
  const level = flags.level != null ? flags.level : eng.E.skill_xp.level_cap;
  const build = flags.build != null ? String(flags.build) : 'glass';
  const ref = M.referenceBases()[build] || M.referenceBases().glass;
  console.log(`# Skill workshop — ${build} reference (basis phys ${Math.round(ref.phys)} · basis magic ${Math.round(M.basisOf({ basis: 'magic' } as any, ref))}) · skill level ${level} · CDR ${cdrPct}% · ladder ${ladderPct}%`);
  console.log(`# press = (base_flat + eff% × power + max_hp_pct% × caster Max HP) × damage_pct(level)/100 · cost/s = presses/sec × typed Mana or current-HP cost`);
  // A row with no cooldown of its own fires on the attack clock, so its rate is the reference line's
  // hits/sec rather than a cooldown-derived figure — read from the engine, never typed here.
  const beatRate = eng.hitsPerSec(eng.REFERENCE.line.aspd);
  console.log(`# the beat = the attack clock at the reference line (${beatRate.toFixed(2)}/sec) — a row with no timer of its own fires on it`);
  console.log('');
  const head = ['Skill', 'basis', 'cd', 'eff cd', 'press/s', 'cost', 'cost/s', 'dmg/press'];
  const rows = byType('attack').map((s: any) => {
    const r = M.row(s, { ...ref, cdrPct, ladderPct, level });
    const cost = M.costOf(s, { skillLevel: level, aoe: (Number(String(s.targets || '1').split('/')[0]) || 1) > 1 });
    // a row with no timer of its own has no cooldown-derived rate: its beat is the attack clock
    const rateN = r.pressesPerSec == null ? beatRate : r.pressesPerSec;
    const rate = r.pressesPerSec == null ? `${beatRate.toFixed(2)} beat` : r.pressesPerSec.toFixed(2);
    const perSec = fmt(Math.round(rateN * cost.amount));
    const spec = cost.resource === 'hp' ? s.hp_cost : s.mana;
    return [s.name, s.max_hp_pct ? `${s.basis} + ${s.max_hp_pct}% Max HP` : s.basis, `${s.cd}`, r.effCd.toFixed(2), rate, `${spec} ${cost.resource} → ${fmt(Math.round(cost.amount))}`, perSec, r.damage != null ? fmt(Math.round(r.damage)) : '—'];
  });
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r: any) => String(r[i]).length)));
  const line = (r: any) => r.map((c: any, i: any) => String(c).padEnd(widths[i])).join('  ');
  console.log(line(head));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of rows) console.log(line(r));
}

/**
 * The whole roster, one aligned block per type. This is what the retired `skill-pool*.md` roster tables
 * used to carry: every row with its own numbers, printed from `skills.json` rather than restated in
 * prose. `--list <attack|buff|curse|heal|aura|all>` picks the types; a row's `effect` sentence goes on
 * its own line, because that is prose and a column would wrap it.
 */
function list(which: string) {
  const types = which === 'all' ? TYPES : TYPES.filter((t: string) => t === which);
  if (!types.length) { console.log(`no type "${which}" - try ${TYPES.join(' | ')} | all`); return; }
  for (const t of types) {
    const rows = byType(t);
    console.log('');
    console.log(`# ${t} - ${rows.length} row(s)`);
    const head = ['id', 'name', 'cd', 'cost', 'duration', 'group', 'targets', 'reserve', 'basis (flat / eff%)'];
    const body = rows.map((s: any) => [s.id, s.name, s.cd ?? '-', s.hp_cost ? `${s.hp_cost} current HP` : s.mana ? `${s.mana} Mana` : '-', s.duration ?? '-', s.group ?? '-',
      s.targets ?? '-', s.reserve ?? '-', s.base_flat != null ? `${s.basis} ${s.base_flat} / ${s.eff}${s.max_hp_pct ? ` + ${s.max_hp_pct}% Max HP` : ''}` : '-']);
    const widths = head.map((h: string, i: number) => Math.max(String(h).length, ...body.map((r: any[]) => String(r[i]).length)));
    const draw = (r: any[]) => r.map((c: any, i: number) => String(c).padEnd(widths[i])).join('  ').trimEnd();
    console.log(draw(head));
    console.log(widths.map((w: number) => '-'.repeat(w)).join('  '));
    rows.forEach((s: any, n: number) => {
      console.log(draw(body[n]));
      if (s.effect) console.log('    ' + String(s.effect).replace(/\s+/g, ' ').trim());
    });
  }
}

// ---------------------------------------------------------------- cli

/**
 * The per-level table for a row: what the skill deals and what its effects are worth at every skill
 * level. Damage climbs on `damage_pct` and each effect on `effect_pct`, both read from
 * `skills.json` `meta.formula.skill_levels` — the one home of the ramp — so this print is a read of
 * the data, never a second formula.
 */
function levels(which: string) {
  const L = eng.E.skill_xp.level_cap;
  const rows = which === 'all' ? byType('attack') : byType('attack').filter((s: any) => s.id === which || s.name.toLowerCase() === which.toLowerCase());
  if (!rows.length) { console.log(`no attack row matches "${which}" — try a skill id, a name, or all`); return; }
  for (const s of rows) {
    console.log(`
# ${s.name} (${s.id}) — ${s.basis} basis · cd ${s.cd}s · base_flat ${s.base_flat} · eff ${s.eff}%`);
    const head = ['level', 'damage%', 'effect%', 'press (glass)', 'press (caster)', 'cost', ...(s.effects || []).map((e: any) => `${e.stat}${e.op === 'mult' ? ' x' : e.op === 'add_flat' ? ' +' : ' +%'}`)];
    const body: any[][] = [];
    for (let lv = 1; lv <= L; lv++) {
      const cost = M.costOf(s, { skillLevel: lv, aoe: (Number(String(s.targets || '1').split('/')[0]) || 1) > 1 });
      body.push([`${lv}`, `${M.damagePct(lv)}`, `${M.effectPct(lv)}`, fmt(Math.round(M.pressOn(s, 'glass', lv))), fmt(Math.round(M.pressOn(s, 'caster', lv))), `${fmt(Math.round(cost.amount))} ${cost.resource}`,
        ...M.effectsAt(s, lv).map((e: any) => (e.op === 'mult' ? e.value.toFixed(2) : e.value.toFixed(1)))]);
    }
    const widths = head.map((h: string, i: number) => Math.max(String(h).length, ...body.map((r: any) => String(r[i]).length)));
    const line = (r: any) => r.map((c: any, i: number) => String(c).padEnd(widths[i])).join('  ');
    console.log(line(head));
    console.log(widths.map((w: number) => '-'.repeat(w)).join('  '));
    for (const r of body) console.log(line(r));
  }
}

const arg = process.argv[2];

if (arg === '--calc') {
  calc();
} else if (arg === '--list') {
  list(String(process.argv[3] || 'all'));
} else if (arg === '--levels') {
  levels(String(process.argv[3] || 'all'));
} else if (arg === '--checks') {
  G.report(R.gates());
} else {
  console.log(`skill cage — data: tools/data/skills.json (roster source of truth)

  node tools/skills.ts --checks   mechanic gate (checks.md D18)
  node tools/skills.ts --list [attack|buff|curse|heal|aura|all]  the whole roster, every row
  node tools/skills.ts --levels <skill-id|name|all>  the per-level table: damage · effect · cost
  node tools/skills.ts --calc     live skill workshop: dmg/press · eff cd · press/s · cost/s
                                  flags: --build glass|caster --level N --cdr N --ladder N
`);
}
