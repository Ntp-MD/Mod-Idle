/**
 * Timeline cage — the XP / level-pacing table.
 *
 *   node tools/timeline.ts --checks   progression sanity
 *
 * Inputs: tools/data/engine.json `xp` (kills anchors · per-kill rate · step). The table is derived,
 * never typed, and it is measured in **kills** — a state the player holds, never in hours: this game
 * has no time limit and no play-length target (owner ruling), so no table here may print how long a
 * milestone "takes".
 */

import path from 'node:path';
import { readJson } from './lib/json.ts';

const E = readJson<any>(path.join(import.meta.dirname, 'data', 'engine.json'));
const X = E.xp;
const L = E.loot;

const ANCHORS = Object.keys(X.kills_anchors).map(Number).sort((a: number, b: number) => a - b);
const CAP = E.stat.mob_level_cap;

function kills(level: number): number {
  if (X.kills_anchors[level] != null) return X.kills_anchors[level];
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    const a = ANCHORS[i], b = ANCHORS[i + 1];
    if (level > a && level < b) return X.kills_anchors[a] + (X.kills_anchors[b] - X.kills_anchors[a]) * (level - a) / (b - a);
  }
  return X.kills_anchors[ANCHORS[ANCHORS.length - 1]];
}

// XP is read per kill, and a kill is not always a plain mob: one in five rolls elite (×3 XP) and the
// boss clock pays ×15. The anchors in `xp.kills_anchors` are the plain-mob count to clear a level, so
// the table below prints that count and the XP it is worth — never the hours it would take to earn it.
const onPlateau = (level: number) => X.plateau_from != null && level >= X.plateau_from;
const plateauXp = () => kills(X.plateau_step_at) * X.per_kill_mob_level * Math.min(X.plateau_step_at, CAP);
const xpToNext = (level: number) => (onPlateau(level) ? plateauXp() : kills(level) * X.per_kill_mob_level * Math.min(level, CAP));

function model(): any {
  const levels: any[] = [];
  let cumXp = 0, cumKills = 0;
  for (let lv = 1; lv <= E.stat.level_cap; lv++) {
    const xp = xpToNext(lv), k = xp / (X.per_kill_mob_level * Math.min(lv, CAP));
    cumXp += xp; cumKills += k;
    levels.push({ lv, xp, k, cumXp, cumKills });
  }
  const steps: any[] = [];
  for (let start = 1; start <= E.stat.level_cap; start += X.step) {
    const block = levels.slice(start - 1, start - 1 + X.step);
    steps.push({
      from: start, to: block[block.length - 1].lv,
      xp: block.reduce((s: number, b: any) => s + b.xp, 0),
      kills: block.reduce((s: number, b: any) => s + b.k, 0),
      cumXp: block[block.length - 1].cumXp,
      cumKills: block[block.length - 1].cumKills,
    });
  }
  return { levels, steps, totalKills: cumKills, totalXp: cumXp };
}

function gates(m: any): any[] {
  const out: any[] = [];
  const add = (id: string, ok: boolean, detail: string) => out.push({ id, ok, detail });
  // No wall-clock gate and no clock column: this is an open-world idle RPG with no time limit (owner
  // ruling), so progression is read in kills — a state the player holds. The sanity rule is the shape
  // the owner set: the bar climbs to the completion checkpoint and then holds FLAT.
  const COMPLETION = 100;
  const up = m.steps.filter((s: any) => s.to <= COMPLETION);
  const tail = m.steps.filter((s: any) => s.from > COMPLETION);
  const rising = up.every((s: any, i: number) => i === 0 || s.xp > up[i - 1].xp);
  const flatTail = tail.every((s: any) => Math.abs(s.xp - tail[0].xp) < 1e-6);
  const plateau = X.plateau_from != null && X.plateau_step_at != null && X.plateau_from > X.plateau_step_at;
  add('TL1', rising && flatTail && plateau,
    `the bar climbs to the completion checkpoint (xp per ${X.step}-level step ${Math.round(up[0].xp).toLocaleString('en-US')} → ${Math.round(up[up.length - 1].xp).toLocaleString('en-US')} through level ${COMPLETION}) and then holds FLAT: every step past ${COMPLETION} costs the same ${Math.round(tail[0].xp).toLocaleString('en-US')} XP, the 89 → 90 size, so the post-completion loop is a plateau and not a wall${rising ? '' : ' · THE CLIMB IS NOT RISING'}${flatTail ? '' : ' · THE TAIL IS NOT FLAT'}${plateau ? '' : ' · NO PLATEAU IS DECLARED'}`);
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
  console.log(`timeline cage — engine.json xp → the 5-level-step table

  node tools/timeline.ts --checks   progression sanity
`);
}
