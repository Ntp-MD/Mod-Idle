'use strict';

/**
 * Timeline cage — the XP / level-pacing table.
 *
 *   node tools/timeline.js            help
 *   node tools/timeline.js --emit     print the generated XP table
 *   node tools/timeline.js --write    rewrite the XP table in world.md
 *   node tools/timeline.js --checks   reconcile against the E1-E5 checkpoints
 *
 * Inputs: tools/data/engine.json `xp` (kills anchors · per-kill rate · step) and
 * `loot` (band kill rates · timeline checkpoints). The table is derived, never typed.
 */

const G = require('./lib/generated');
const E = JSON.parse(G.read('tools/data/engine.json'));
const X = E.xp;
const L = E.loot;

const ANCHORS = Object.keys(X.kills_anchors).map(Number).sort((a, b) => a - b);
const CAP = E.stat.mob_level_cap;
const BAND_KILLS = { low: L.bands.low.kills_per_hr_published, mid: L.bands.mid.kills_per_hr_published, high: L.bands.high.kills_per_hr_published };
const killsHr = (level) => (level <= 30 ? BAND_KILLS.low : level <= 60 ? BAND_KILLS.mid : BAND_KILLS.high);

function kills(level) {
  if (X.kills_anchors[level] != null) return X.kills_anchors[level];
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const a = ANCHORS[i], b = ANCHORS[i + 1];
    if (level > a && level < b) return X.kills_anchors[a] + (X.kills_anchors[b] - X.kills_anchors[a]) * (level - a) / (b - a);
  }
  return X.kills_anchors[ANCHORS[ANCHORS.length - 1]];
}

const xpToNext = (level) => kills(level) * X.per_kill_mob_level * Math.min(level, CAP);
const hoursIn = (level) => kills(level) / killsHr(level);

function model() {
  const levels = [];
  let cumXp = 0, cumHr = 0;
  for (let lv = 1; lv <= E.stat.level_cap; lv++) {
    const xp = xpToNext(lv), hr = hoursIn(lv);
    cumXp += xp; cumHr += hr;
    levels.push({ lv, xp, hr, cumXp, cumHr });
  }
  const steps = [];
  for (let start = 1; start <= E.stat.level_cap; start += X.step) {
    const block = levels.slice(start - 1, start - 1 + X.step);
    steps.push({
      from: start, to: block[block.length - 1].lv,
      xp: block.reduce((s, b) => s + b.xp, 0),
      cumXp: block[block.length - 1].cumXp,
      cumHr: block[block.length - 1].cumHr,
    });
  }
  return { levels, steps, totalHr: cumHr, totalXp: cumXp };
}

function checkpoints(m) {
  const out = [];
  for (const [key, want] of Object.entries(L.timeline_checkpoints_hr)) {
    const lv = Number(key.replace('level_', ''));
    const got = m.levels[lv - 1].cumHr;
    out.push({ lv, want, got, ok: Math.abs(got - want) <= X.hours_tolerance });
  }
  return out;
}

function gates(m) {
  const out = [];
  const add = (id, ok, detail) => out.push({ id, ok, detail });
  const cps = checkpoints(m);
  const bad = cps.filter((c) => !c.ok);
  add('TL1', bad.length === 0, `cumulative hours match every E1-E5 checkpoint within ±${X.hours_tolerance} hr (${cps.map((c) => `L${c.lv} ${c.got.toFixed(2)}/${c.want}`).join(' · ')})`);
  add('TL2', m.totalHr > 0 && Math.abs(m.totalHr - L.timeline_checkpoints_hr.level_100) <= X.hours_tolerance,
    `derived game length ${m.totalHr.toFixed(1)} hr vs the ${L.timeline_checkpoints_hr.level_100} hr checkpoint`);
  const mono = m.steps.every((s, i) => i === 0 || s.xp > m.steps[i - 1].xp);
  add('TL3', mono, `xp to clear each ${X.step}-level step is strictly increasing (${Math.round(m.steps[0].xp).toLocaleString('en-US')} → ${Math.round(m.steps[m.steps.length - 1].xp).toLocaleString('en-US')})`);
  return out;
}

function block() {
  const m = model();
  const rows = m.steps.map((s) =>
    `| ${s.from}-${s.to} | ${Math.round(s.xp).toLocaleString('en-US')} | ${Math.round(s.cumXp).toLocaleString('en-US')} | ${s.cumHr.toFixed(1)} |`);
  return [
    `Derived from \`xp_to_next(L) = kills(L) × ${X.per_kill_mob_level} × min(L, ${CAP})\` with the kills anchors and band rates in \`engine.json\`.`,
    '',
    '| Levels | XP to clear the step | Cumulative XP | Cumulative hr |',
    '|---|---|---|---|',
    ...rows,
  ].join('\n');
}

const WRITERS = [{ file: 'world.md', key: 'xp-table', render: block }];
const arg = process.argv[2];
const m = model();

if (arg === '--emit') {
  console.log(block());
} else if (arg === '--write') {
  const missing = G.writeAll(WRITERS);
  if (missing) process.exitCode = 1;
} else if (arg === '--checks') {
  const rows = gates(m);
  for (const r of rows) console.log(`${r.id.padEnd(4)}  ${r.ok ? 'PASS ' : 'FAIL '}  ${r.detail}`);
  const states = G.checkAll(WRITERS);
  const stale = states.filter((s) => s.state !== 'current');
  console.log('');
  for (const s of states) console.log(`${s.state === 'current' ? 'PASS ' : 'FAIL '}  block ${s.key} · ${s.file} (${s.state})`);
  const fails = rows.filter((r) => !r.ok).length + stale.length;
  console.log(`\n${rows.length - rows.filter((r) => !r.ok).length}/${rows.length} gate PASS · ${stale.length} block(s) not current · ${fails} FAIL`);
  if (fails) process.exitCode = 1;
} else {
  console.log(`timeline cage — engine.json xp → the 5-level-step table in world.md

  node tools/timeline.js --emit     print the generated XP table
  node tools/timeline.js --write    rewrite the XP table in world.md
  node tools/timeline.js --checks   reconcile against E1-E5 checkpoints
`);
}
