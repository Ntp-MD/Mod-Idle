/**
 * Ladder cage — the skill-duplicate economy.
 *
 *   node tools/ladder.ts            help
 *   node tools/ladder.ts --emit     print the generated ladder block
 *   node tools/ladder.ts --write    rewrite the ladder block in skill-pool-system.md
 *   node tools/ladder.ts --checks   invariants + stale-block check (checks.md D20 / E11)
 *
 * All inputs are decided elsewhere: roster size from tools/data/skills.json, drop
 * rate from loot.md F12, game length from checks.md E5, ladder from skill-pool.md.
 * This tool only does the arithmetic, so D20/E11 can never be stale again.
 */

import * as R from './lib/roster.ts';
import * as G from './lib/generated.ts';
import * as eng from './lib/engine.ts';
import { CONVERSION, LADDER } from './lib/skillmodel.ts';
import type { Writer } from './lib/types.ts';

const ZONES = eng.E.mob.zones.length;  // the data owns the world size, never a typed 9
// the F12 rate and the E5 game length are DERIVED, never copied: the skill-drop rate is the same sum
// `skill-drop` prints, and the funnel's length is the published level-100 checkpoint
const L = eng.E.loot as any, SD = eng.E.skill_drop as any;
const KPH = L.bands.high.kills_per_hr_published;
const ELITES = KPH * L.elite_spawn_chance;
const DROP_PER_HR = ELITES * SD.elite + L.boss_per_hour * SD.boss + KPH * (1 - L.elite_spawn_chance) * SD.normal;
// the completion checkpoint (E5) — the levels past it are the post-completion loop, so the funnel is
// the supply the ladder is measured against up to completion, not to the level cap
const GAME_HOURS = eng.E.loot.timeline_checkpoints_hr.level_100;
const TARGETS = 4;            // checks.md D20 · four full targets

function model() {
  const total = R.total();
  const poolPerZone = total / ZONES;
  const funnel = DROP_PER_HR * GAME_HOURS;
  const dupToMax = LADDER.reduce((s: any, l: any) => s + l.cost, 0);
  const piecesPerMax = dupToMax * CONVERSION;
  const fourMaxed = TARGETS * piecesPerMax;
  const offTargets = total - TARGETS;
  const offPieces = funnel - fourMaxed;
  const offAvg = offPieces / offTargets;
  return {
    total, poolPerZone, funnel, dupToMax, piecesPerMax, fourMaxed,
    pctOfFunnel: (fourMaxed / funnel) * 100,
    hours: fourMaxed / DROP_PER_HR,
    offTargets, offPieces, offAvg,
  };
}

function gates(m: any) {
  const out: any[] = [];
  const add = (id: any, ok: any, detail: any) => out.push({ id, ok, detail });

  const cumulative = LADDER.reduce((s: any, l: any) => s + l.cost, 0);
  add('LD1', cumulative === 12 && LADDER[LADDER.length - 1].cdr === 30,
    `ladder reaches −30% at step 6 for ${cumulative} duplicates total`);

  const monotonic = LADDER.every((l: any, i: any) => i === 0 || l.cdr > LADDER[i - 1].cdr);
  add('LD2', monotonic, 'cooldown reduction is strictly increasing per step');

  add('LD3', m.poolPerZone > 0 && m.poolPerZone < 6,
    `roster ${m.total} ÷ ${ZONES} zones = ${m.poolPerZone.toFixed(1)} skills per zone pool`);

  add('LD4', m.fourMaxed <= m.funnel,
    `4 maxed targets = ${m.fourMaxed} pieces = ${m.pctOfFunnel.toFixed(0)}% of the ${m.funnel}-piece funnel = ${m.hours.toFixed(1)} hr`);

  add('LD5', m.offAvg >= 1,
    `the other ${m.offTargets} skills split ${m.offPieces} pieces → ${m.offAvg.toFixed(2)} each (≥1 required by D20)`);

  return out;
}

function block() {
  const m = model();
  return [
    '| Quantity | Value |',
    '|---|---|',
    `| roster | ${m.total} skills |`,
    `| pool per zone | ${m.total} ÷ ${ZONES} = **${m.poolPerZone.toFixed(1)}** |`,
    `| funnel | ${DROP_PER_HR.toFixed(2)}/hr × ${GAME_HOURS} hr = **${Math.round(m.funnel)} pieces** |`,
    `| ladder to max one skill | ${m.dupToMax} duplicates = **${m.piecesPerMax} pieces** via the ${CONVERSION}:1 conversion |`,
    `| ${TARGETS} maxed targets | **${m.fourMaxed} pieces = ${m.pctOfFunnel.toFixed(0)}% of funnel = ${m.hours.toFixed(1)} hr** |`,
    `| remaining ${m.offTargets} skills | ${Math.round(m.offPieces)} pieces → **${m.offAvg.toFixed(2)} each** |`,
  ].join('\n');
}

const WRITERS: Writer[] = [{ file: 'skill-pool-system.md', key: 'ladder-math', render: block }];

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
  console.log(`ladder cage — roster × drop rate × ladder rules → checks.md D20 / E11

  node tools/ladder.ts --emit     print the generated ladder block
  node tools/ladder.ts --write    rewrite the ladder block in skill-pool-system.md
  node tools/ladder.ts --checks   invariants + stale-block check
`);
}
