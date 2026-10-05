/**
 * Skill cage — tools/data/skills.json → the roster tables in skill-pool*.md.
 *
 *   node tools/skills.ts            help
 *   node tools/skills.ts --emit     print the generated roster blocks
 *   node tools/skills.ts --write    rewrite every roster block in the md files
 *   node tools/skills.ts --checks   run the mechanic gate (D18) + fail on a stale block
 *
 * The roster is the single source of truth: counts, names, reserves and effects
 * are derived here, never hand-typed in prose. Edit skills.json, then --write.
 */

import * as R from './lib/roster.ts';
import * as G from './lib/generated.ts';
import * as M from './lib/skillmodel.ts';
import * as eng from './lib/engine.ts';
import type { Writer } from './lib/types.ts';

const { SKILLS, TYPES, TYPE_META, RESERVE, byType, count, total, fmt } = R;

// ---------------------------------------------------------------- renderers

const elementLabel = (e: any) => (e === 'physical' ? 'phys' : e);

// `final_pct` is stored at full precision and the engine reads it for cast damage, so this is a
// display cap only — the table shows at most 2 decimals without forcing trailing zeros.
const pct2 = (x: any) => Math.round(x * 100) / 100;

function countBlock() {
  const rows = TYPES.map((t: any) => `| **${t}** | ${count(t)} | ${TYPE_META[t]} |`);
  return [
    `# Skill count = ${total()}`,
    '',
    '| Type | Count | Controlled by |',
    '|---|---|---|',
    ...rows,
    `| **total** | **${total()}** | Roster mid-redesign · buff + aura set not final |`,
    '',
    `> **Counts are provisional.** The buff roster was cleared for a redesign and rebuilt, and the aura set was resized (\`skill-pool-aura-heal.md\` · Decision 1), which leaves tree nodes in \`skill-tree-*.md\` referencing skills that no longer exist (\`checks.md\` D19 will fail until those nodes are rewritten). If \`Retribution\` is also removed from the attack table, attack drops ${count('attack')} → ${count('attack') - 1} and the total lands at **${total() - 1}**.`,
  ].join('\n');
}

function attackRoster() {
  // the skill level the tables print is the Cap the XP rule reaches (`engine.json` skill_xp)
  const L = eng.E.skill_xp.level_cap;
  const rows = byType('attack').map((s: any) => {
    const r = M.row(s, { cdrPct: M.CAST_REF.cdr_pct, ladderPct: M.CAST_REF.ladder_pct });
    const glass = fmt(Math.round(M.pressOn(s, 'glass', L)));
    const caster = fmt(Math.round(M.pressOn(s, 'caster', L)));
    return `| ${s.name} | ${s.group} | ${elementLabel(s.element)} | ${s.cd} sec | ${r.effCd.toFixed(2)} sec | ${r.pressesPerSec!.toFixed(2)} | ${s.mana} | ${s.basis} · ${pct2(s.final_pct)}% | ${s.targets} | ${glass} / ${caster} | ${s.effect} |`;
  });
  const B = M.referenceBases();
  return [
    '| Skill | Group | Element | cd | eff cd | presses/sec | mana | Basis · final_pct (level 1) | Targets/Hits | Damage per press (glass / caster) | What it does |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows,
    '',
    `press = final_pct × basis × (1 + (skill_level − 1) × ${M.LEVEL_STEP}%) at skill level ${L} (D-070 · B5) — the two columns are the same press read on the two published reference builds:`,
    `glass = Str 12 · basis phys ${fmt(Math.round(B.glass.phys))} · caster = Int 12 · basis magic ${fmt(Math.round(B.caster.magic))} + elem ${fmt(B.caster.elem)} × Alignment ${B.caster.align}% (${fmt(Math.round(B.caster.elem * B.caster.align / 100))}) = ${fmt(Math.round(M.basisOf({ basis: 'magic' } as any, B.caster)))}.`,
    `A phys-basis press can crit and a magic-basis one cannot, so neither column includes crit (formula.md section 0's DPS row does).`,
  ].join('\n');
}

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
  const pool = flags.pool != null ? Number(flags.pool) : M.MANA_REF_POOL;
  console.log(`# press = final_pct × basis × (1 + (level−1)×${M.LEVEL_STEP}%) · mana = the row's own cost at pool ${Math.round(pool)}, and mana/s = presses/sec × that cost`);
  console.log('');
  const head = ['Skill', 'basis', 'cd', 'eff cd', 'press/s', 'mana', 'mana/s', 'dmg/press'];
  const rows = byType('attack').map((s: any) => {
    const r = M.row(s, { ...ref, cdrPct, ladderPct, level });
    const cost = M.manaCostOf(s, { skillLevel: level, maxMana: pool, usableMana: pool, aoe: (Number(String(s.targets || '1').split('/')[0]) || 1) > 1 });
    return [s.name, s.basis, `${s.cd}`, r.effCd.toFixed(2), r.pressesPerSec!.toFixed(2), `${s.mana} → ${fmt(Math.round(cost))}`, fmt(Math.round(r.pressesPerSec! * cost)), r.damage != null ? fmt(Math.round(r.damage)) : '—'];
  });
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r: any) => String(r[i]).length)));
  const line = (r: any) => r.map((c: any, i: any) => String(c).padEnd(widths[i])).join('  ');
  console.log(line(head));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of rows) console.log(line(r));
}

function curseRoster() {
  const rows = byType('curse').map((s: any) =>
    `| ${s.name} | ${s.cd} sec | ${s.mana} | ${s.duration} | ${s.effect} |`);
  return [
    '| Skill | cd | mana | Duration | What it does |',
    '|---|---|---|---|---|',
    ...rows,
  ].join('\n');
}

function healRoster() {
  const rows = byType('heal').map((s: any) =>
    `| ${s.name} | ${s.cd} sec | ${s.mana} | ${s.duration} | ${s.effect} |`);
  return [
    '| Skill | cd | mana | Duration | What it does |',
    '|---|---|---|---|---|',
    ...rows,
  ].join('\n');
}

function buffRoster() {
  return [
    '| Skill | cd | mana | Duration | What it does |',
    '|---|---|---|---|---|',
    ...byType('buff').map((s: any) =>
      `| ${s.name} | ${s.cd} sec | ${s.mana} | ${s.duration} | ${s.effect} |`),
  ].join('\n');
}

function auraRoster() {
  const rows = byType('aura').map((s: any) => {
    const tier = s.reserve ? RESERVE[s.reserve] : null;
    const reserve = tier ? `${s.reserve} ${tier.pct}%` : '**TBD**';
    const abs = tier ? tier.abs : '—';
    return `| ${s.name} | ${s.kind} | ${reserve} | ${abs} | ${s.effect} |`;
  });
  const pool = eng.DERIVED.mana;
  return [
    `| Aura | Kind | reserve | At pool ${pool.toLocaleString('en-US')} | Effect at skill level 20 |`,
    '|---|---|---|---|---|',
    ...rows,
  ].join('\n');
}

// per-type headings are generated too, so adding or removing a skill never needs a hand edit
const heading = (type: any, label: any) => `# ${count(type)} ${label}`;

// ---------------------------------------------------------------- writers

const WRITERS: Writer[] = [
  { file: 'skill-pool.md', key: 'skill-count', render: countBlock },
  { file: 'skill-pool-attack.md', key: 'attack-heading', render: () => heading('attack', 'attack skills') },
  { file: 'skill-pool-attack.md', key: 'attack-roster', render: attackRoster },
  { file: 'skill-pool-curse.md', key: 'curse-heading', render: () => heading('curse', 'curse skills') },
  { file: 'skill-pool-curse.md', key: 'curse-roster', render: curseRoster },
  { file: 'skill-pool-buff.md', key: 'buff-heading', render: () => heading('buff', 'buff skills') },
  { file: 'skill-pool-buff.md', key: 'buff-roster', render: buffRoster },
  { file: 'skill-pool-aura-heal.md', key: 'heal-heading', render: () => heading('heal', 'healing skills') },
  { file: 'skill-pool-aura-heal.md', key: 'heal-roster', render: healRoster },
  { file: 'skill-pool-aura-heal.md', key: 'aura-heading', render: () => heading('aura', 'aura skills') },
  { file: 'skill-pool-aura-heal.md', key: 'aura-roster', render: auraRoster },
];

// ---------------------------------------------------------------- cli

const arg = process.argv[2];

if (arg === '--calc') {
  calc();
} else if (arg === '--emit') {
  for (const w of WRITERS) console.log(`\n===== ${w.file} :: ${w.key} =====\n${w.render()}`);
} else if (arg === '--write') {
  const missing = G.writeAll(WRITERS);
  if (missing) process.exitCode = 1;
} else if (arg === '--checks') {
  const rows = R.gates();
  for (const r of rows) console.log(`${r.id.padEnd(3)}  ${r.ok ? 'PASS ' : 'FAIL '}  ${r.detail}`);

  const states = G.checkAll(WRITERS);
  const stale = states.filter((s) => s.state !== 'current');
  console.log('');
  for (const s of states) console.log(`${s.state === 'current' ? 'PASS ' : 'FAIL '}  block ${s.key} · ${s.file} (${s.state})`);

  const gateFails = rows.filter((r) => !r.ok).length;
  const fails = gateFails + stale.length;
  console.log(`\n${rows.length - gateFails}/${rows.length} gate PASS · ${stale.length} block(s) not current · ${fails} FAIL`);
  if (fails) process.exitCode = 1;
} else {
  console.log(`skill cage — data: tools/data/skills.json (roster source of truth)

  node tools/skills.ts --emit     print the generated roster blocks
  node tools/skills.ts --write    rewrite skill-pool*.md roster blocks
  node tools/skills.ts --checks   mechanic gate (checks.md D18) + stale-block check
  node tools/skills.ts --calc     live skill workshop: dmg/press · eff cd · press/s · mana/s
                                  flags: --build glass|caster --level N --cdr N --ladder N
`);
}
