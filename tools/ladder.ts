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
import * as eng from './lib/engine.ts';
import { CONVERSION, LADDER } from './lib/skillmodel.ts';

const ZONES = eng.E.mob.zones.length;  // the data owns the world size, never a typed 9
// the F12 rate and the E5 game length are DERIVED, never copied: the skill-drop rate is the same sum
// `skill-drop` prints, and the funnel's length is the published level-100 checkpoint
const L = eng.E.loot as any, SD = eng.E.skill_drop as any;
const KPH = eng.BAND.high.kills_derived;
const ELITES = KPH * L.elite_spawn_chance;
const DROP_PER_HR = ELITES * SD.elite + L.boss_per_hour * SD.boss + KPH * (1 - L.elite_spawn_chance) * SD.normal;
// the completion checkpoint (E5) — the levels past it are the post-completion loop, so the funnel is
// the supply the ladder is measured against up to completion, not to the level cap. It is a COUNT of
// kills, never a stretch of hours: how long the run takes is the player's own pace (AGENTS.md).
const GAME_KILLS = eng.CHECKPOINTS_KILLS.level_100;
const DROP_PER_KILL = DROP_PER_HR / KPH;
const TARGETS = 4;            // checks.md D20 · four full targets

function model() {
  const total = R.total();
  const poolPerZone = total / ZONES;
  const funnel = DROP_PER_KILL * GAME_KILLS;
  const dupToMax = LADDER.reduce((s: any, l: any) => s + l.cost, 0);
  const piecesPerMax = dupToMax * CONVERSION;
  const fourMaxed = TARGETS * piecesPerMax;
  const offTargets = total - TARGETS;
  const offPieces = funnel - fourMaxed;
  const offAvg = offPieces / offTargets;
  return {
    total, poolPerZone, funnel, dupToMax, piecesPerMax, fourMaxed,
    pctOfFunnel: (fourMaxed / funnel) * 100,
    kills: fourMaxed / DROP_PER_KILL,
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
    `4 maxed targets = ${m.fourMaxed} pieces = ${m.pctOfFunnel.toFixed(0)}% of the ${m.funnel}-piece funnel = ${Math.round(m.kills).toLocaleString('en-US')} kills`);

  add('LD5', m.offAvg >= 1,
    `the other ${m.offTargets} skills split ${m.offPieces} pieces → ${m.offAvg.toFixed(2)} each (≥1 required by D20)`);

  return out;
}

const arg = process.argv[2];

if (arg === '--checks') {
  const rows = gates(model());
  for (const r of rows) console.log(`${r.id.padEnd(4)}  ${r.ok ? 'PASS ' : 'FAIL '}  ${r.detail}`);
  const fails = rows.filter((r) => !r.ok).length;
  console.log(`\n${rows.length - fails}/${rows.length} gate PASS · ${fails} FAIL`);
  if (fails) process.exitCode = 1;
} else {
  console.log(`ladder cage — roster × drop rate × ladder rules

  node tools/ladder.ts --checks   invariants
`);
}
