/**
 * Timeline cage — the XP / level-pacing table.
 *
 *   node tools/timeline.ts            help
 *   node tools/timeline.ts --emit     print the generated XP table
 *   node tools/timeline.ts --write    rewrite the XP table in world.md
 *   node tools/timeline.ts --checks   reconcile against the E1-E5 checkpoints
 *
 * Inputs: tools/data/engine.json `xp` (kills anchors · per-kill rate · step) and
 * `loot` (band kill rates · timeline checkpoints). The table is derived, never typed.
 */

import * as G from './lib/generated.ts';
import type { Writer } from './lib/types.ts';

const E = JSON.parse(G.read('tools/data/engine.json'));
const X = E.xp;
const L = E.loot;

const ANCHORS = Object.keys(X.kills_anchors).map(Number).sort((a: number, b: number) => a - b);
const CAP = E.stat.mob_level_cap;
const BAND_KILLS = { low: L.bands.low.kills_per_hr_published, mid: L.bands.mid.kills_per_hr_published, high: L.bands.high.kills_per_hr_published };
const killsHr = (level: number) => (level <= 30 ? BAND_KILLS.low : level <= 60 ? BAND_KILLS.mid : BAND_KILLS.high);

function kills(level: number): number {
  if (X.kills_anchors[level] != null) return X.kills_anchors[level];
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const a = ANCHORS[i], b = ANCHORS[i + 1];
    if (level > a && level < b) return X.kills_anchors[a] + (X.kills_anchors[b] - X.kills_anchors[a]) * (level - a) / (b - a);
  }
  return X.kills_anchors[ANCHORS[ANCHORS.length - 1]];
}

// Every kill is not a plain mob: one in five rolls elite (×3 XP) and the boss clock adds
// ×15 kills at 4/hr. Ignoring those made the timeline wrong the moment the elite rate moved
// from 0.5% to 20% — the game would finish a third early. `xp_per_kill` is the tuning knob
// that holds the published hours while the multipliers are paid honestly.
const xpMult = (kph: number) => {
  const elite = L.elite_spawn_chance;
  const bossShare = L.boss_per_hour / kph;
  return (1 - elite - bossShare) + elite * X.elite_mult + bossShare * X.boss_mult;
};
const xpToNext = (level: number) => kills(level) * X.per_kill_mob_level * Math.min(level, CAP);
const hoursIn = (level: number) => kills(level) / xpMult(killsHr(level)) / killsHr(level);

function model(): any {
  const levels: any[] = [];
  let cumXp = 0, cumHr = 0;
  for (let lv = 1; lv <= E.stat.level_cap; lv++) {
    const xp = xpToNext(lv), hr = hoursIn(lv);
    cumXp += xp; cumHr += hr;
    levels.push({ lv, xp, hr, cumXp, cumHr });
  }
  const steps: any[] = [];
  for (let start = 1; start <= E.stat.level_cap; start += X.step) {
    const block = levels.slice(start - 1, start - 1 + X.step);
    steps.push({
      from: start, to: block[block.length - 1].lv,
      xp: block.reduce((s: number, b: any) => s + b.xp, 0),
      cumXp: block[block.length - 1].cumXp,
      cumHr: block[block.length - 1].cumHr,
    });
  }
  return { levels, steps, totalHr: cumHr, totalXp: cumXp };
}

function checkpoints(m: any): any[] {
  const out: any[] = [];
  for (const [key, want] of Object.entries(L.timeline_checkpoints_hr) as [string, any][]) {
    const lv = Number(key.replace('level_', ''));
    const got = m.levels[lv - 1].cumHr;
    out.push({ lv, want, got, ok: Math.abs(got - want) <= X.hours_tolerance });
  }
  return out;
}

function gates(m: any): any[] {
  const out: any[] = [];
  const add = (id: string, ok: boolean, detail: string) => out.push({ id, ok, detail });
  const cps = checkpoints(m);
  const bad = cps.filter((c: any) => !c.ok);
  add('TL1', bad.length === 0, `cumulative hours match every E1-E5 checkpoint within ±${X.hours_tolerance} hr (${cps.map((c: any) => `L${c.lv} ${c.got.toFixed(2)}/${c.want}`).join(' · ')})`);
  add('TL2', m.totalHr > 0 && Math.abs(m.totalHr - L.timeline_checkpoints_hr.level_100) <= X.hours_tolerance,
    `derived game length ${m.totalHr.toFixed(1)} hr vs the ${L.timeline_checkpoints_hr.level_100} hr checkpoint`);
  const mono = m.steps.every((s: any, i: number) => i === 0 || s.xp > m.steps[i - 1].xp);
  add('TL3', mono, `xp to clear each ${X.step}-level step is strictly increasing (${Math.round(m.steps[0].xp).toLocaleString('en-US')} → ${Math.round(m.steps[m.steps.length - 1].xp).toLocaleString('en-US')})`);
  return out;
}

function block(): string {
  const m = model();
  const rows = m.steps.map((s: any) =>
    `| ${s.from}-${s.to} | ${Math.round(s.xp).toLocaleString('en-US')} | ${Math.round(s.cumXp).toLocaleString('en-US')} | ${s.cumHr.toFixed(1)} |`);
  return [
    `Derived from \`xp_to_next(L) = kills(L) × ${X.per_kill_mob_level} × min(L, ${CAP})\` with the kills anchors and band rates in \`engine.json\`.`,
    '',
    '| Levels | XP to clear the step | Cumulative XP | Cumulative hr |',
    '|---|---|---|---|',
    ...rows,
  ].join('\n');
}

function formulaBlock(): string {
  const parts = ANCHORS.map((lv: number) => `${Math.round(kills(lv)).toLocaleString('en-US')} (L${lv})`);
  return [
    '```',
    `xp per kill   = ${X.per_kill_mob_level} × mob level (normal) · ×${X.elite_mult} elite · ×${X.boss_mult} boss`,
    `xp to next level     = ${X.step}-level-step table (generated below from the kills anchors)`,
    `kills per level       = ${parts.join(' · ')}`,
    '```',
  ].join('\n');
}

const WRITERS: Writer[] = [
  { file: 'world.md', key: 'xp-formula', render: formulaBlock },
  { file: 'world.md', key: 'xp-table', render: block },
];
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

  node tools/timeline.ts --emit     print the generated XP table
  node tools/timeline.ts --write    rewrite the XP table in world.md
  node tools/timeline.ts --checks   reconcile against E1-E5 checkpoints
`);
}
