'use strict';

/**
 * Skill cage — tools/data/skills.json → the roster tables in skill-pool*.md.
 *
 *   node tools/skills.js            help
 *   node tools/skills.js --emit     print the generated roster blocks
 *   node tools/skills.js --write    rewrite every roster block in the md files
 *   node tools/skills.js --checks   run the mechanic gate (D18) + fail on a stale block
 *
 * The roster is the single source of truth: counts, names, reserves and effects
 * are derived here, never hand-typed in prose. Edit skills.json, then --write.
 */

const R = require('./lib/roster');
const G = require('./lib/generated');
const M = require('./lib/skillmodel');

const { SKILLS, TYPES, TYPE_META, RESERVE, byType, count, total, fmt } = R;

// ---------------------------------------------------------------- renderers

const elementLabel = (e) => (e === 'physical' ? 'phys' : e);

function countBlock() {
  const rows = TYPES.map((t) => `| **${t}** | ${count(t)} | ${TYPE_META[t]} |`);
  return [
    `# Skill count = ${total()}`,
    '',
    '| Type | Count | Controlled by |',
    '|---|---|---|',
    ...rows,
    `| **total** | **${total()}** | Roster mid-redesign · buff + aura set not final |`,
    '',
    `> **Counts are provisional.** The buff roster was cleared for a redesign and the aura set moved from 6 to ${count('aura')} (\`skill-pool-aura-heal.md\` · Decision 1), which drops the total from 51 to ${total()} and leaves tree nodes in \`skill-tree-*.md\` referencing skills that no longer exist (\`checks.md\` D19 will fail until those nodes are rewritten). If \`Retribution\` is also removed from the attack table, attack drops ${count('attack')} → ${count('attack') - 1} and the total lands at **${total() - 1}**.`,
  ].join('\n');
}

function attackRoster() {
  const rows = byType('attack').map((s) => {
    const r = M.row(s, { cdrPct: M.CAST_REF.cdr_pct, ladderPct: M.CAST_REF.ladder_pct });
    return `| ${s.name} | ${s.group} | ${elementLabel(s.element)} | ${s.cd} sec | ${r.effCd.toFixed(2)} sec | ${r.pressesPerSec.toFixed(2)} | ${s.mana} | ${s.scale} | ${s.targets} | ${fmt(s.damage.glass)} / ${fmt(s.damage.caster)} | ${s.effect} |`;
  });
  return [
    '| Skill | Group | Element | cd | eff cd | presses/sec | mana | Scale | Targets/Hits | Damage per press (glass / caster) | What it does |',
    '|---|---|---|---|---|---|---|---|---|---|---|',
    ...rows,
  ].join('\n');
}

function calc() {
  const flags = {};
  for (let i = 3; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (!a.startsWith('--')) continue;
    const v = process.argv[i + 1];
    if (v && !v.startsWith('--')) { flags[a.slice(2)] = Number(v); i++; } else flags[a.slice(2)] = true;
  }
  const cdrPct = flags.cdr != null ? flags.cdr : M.CAST_REF.cdr_pct;
  const ladderPct = flags.ladder != null ? flags.ladder : M.CAST_REF.ladder_pct;
  const level = flags.level != null ? flags.level : 20;
  const stat = flags.stat != null ? flags.stat : 816;
  const power = flags.power != null ? flags.power : 4826;
  console.log(`# Skill workshop — stat ${stat} · power ${power} · skill level ${level} · CDR ${cdrPct}% · ladder ${ladderPct}%`);
  console.log(`# per-press = (stat×${M.K_STAT}×stat% + power×power%) × ${M.K_SKILL} × (1 + level×${M.LEVEL_STEP}%) · mana%/s = presses/sec × mana%`);
  console.log('');
  const head = ['Skill', 'cd', 'eff cd', 'press/s', 'mana%', 'mana%/s', 'dmg/press'];
  const rows = byType('attack').map((s) => {
    const r = M.row(s, { cdrPct, ladderPct, level, stat, power });
    return [s.name, `${s.cd}`, r.effCd.toFixed(2), r.pressesPerSec.toFixed(2), r.manaPct != null ? `${r.manaPct}%` : '—', r.manaPerSecPct != null ? `${r.manaPerSecPct.toFixed(2)}%` : '—', r.damage != null ? fmt(Math.round(r.damage)) : '—'];
  });
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => String(r[i]).length)));
  const line = (r) => r.map((c, i) => String(c).padEnd(widths[i])).join('  ');
  console.log(line(head));
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));
  for (const r of rows) console.log(line(r));
}

function curseRoster() {
  const rows = byType('curse').map((s) =>
    `| ${s.name} | ${s.scale} | ${s.cd} sec | ${s.mana} | ${s.duration} | ${s.effect} |`);
  return [
    '| Skill | Scale | cd | mana | Duration | What it does |',
    '|---|---|---|---|---|---|',
    ...rows,
  ].join('\n');
}

function healRoster() {
  const rows = byType('heal').map((s) =>
    `| ${s.name} | ${s.scale} | ${s.cd} sec | ${s.mana} | ${s.duration} | ${s.effect} |`);
  return [
    '| Skill | Scale | cd | mana | Duration | What it does |',
    '|---|---|---|---|---|---|',
    ...rows,
  ].join('\n');
}

function buffRoster() {
  return [
    '| Skill | Scale | cd | mana | Duration | What it does |',
    '|---|---|---|---|---|---|',
    ...byType('buff').map((s) =>
      `| ${s.name} | ${s.scale} | ${s.cd} sec | ${s.mana} | ${s.duration} | ${s.effect} |`),
  ].join('\n');
}

function auraRoster() {
  const rows = byType('aura').map((s) => {
    const tier = s.reserve ? RESERVE[s.reserve] : null;
    const reserve = tier ? `${s.reserve} ${tier.pct}%` : '**TBD**';
    const abs = tier ? tier.abs : '—';
    return `| ${s.name} | ${s.kind} | ${reserve} | ${abs} | ${s.effect} |`;
  });
  return [
    '| Aura | Kind | reserve | At pool 4,848 | Effect at skill level 20 |',
    '|---|---|---|---|---|',
    ...rows,
  ].join('\n');
}

// ---------------------------------------------------------------- writers

const WRITERS = [
  { file: 'skill-pool.md', key: 'skill-count', render: countBlock },
  { file: 'skill-pool-attack.md', key: 'attack-roster', render: attackRoster },
  { file: 'skill-pool-curse.md', key: 'curse-roster', render: curseRoster },
  { file: 'skill-pool-buff.md', key: 'buff-roster', render: buffRoster },
  { file: 'skill-pool-aura-heal.md', key: 'heal-roster', render: healRoster },
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

  node tools/skills.js --emit     print the generated roster blocks
  node tools/skills.js --write    rewrite skill-pool*.md roster blocks
  node tools/skills.js --checks   mechanic gate (checks.md D18) + stale-block check
  node tools/skills.js --calc     live skill workshop: dmg/press · eff cd · press/s · mana/s
                                  flags: --stat N --power N --level N --cdr N --ladder N
`);
}
