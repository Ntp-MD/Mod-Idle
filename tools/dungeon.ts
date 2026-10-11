// @ts-nocheck
/**
 * Dungeon cage — the run's own numbers.
 *
 *   node tools/dungeon.ts            help
 *   node tools/dungeon.ts --checks   run DG1-DG3, exit 1 on FAIL
 *
 * A run fields `mob_cap` normal mobs of its zone and pays the ordinary per-kill roll, so the
 * escrow only delays payment and `mob_HP`, the drop line and the timeline never move (D1). The
 * gate holds the data's own shape and the engine's agreement with it — the sim behaviour
 * (escrow, forfeit, cooldown) is covered by `game/tests/dungeon.test.ts`.
 */

import path from 'node:path';
import { readJson } from './lib/json.ts';
import * as G from './lib/gates.ts';
import { createDungeon } from '../engine/dungeon.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const E = readJson(path.join(ROOT, 'tools/data/engine.json'));
const DG = createDungeon(E);

function checks() {
  const problems = [];
  // the run size (40-60 a run, 1-5 an encounter) is a design window, not a wiring fact (owner
  // ruling · AGENTS §3): it reads PENDING on DG2 and never fails the run
  const runProblems = [];
  const d = E.dungeon || {};
  // DG1 · the run's own shape: a whole mob count, a whole group cap inside it, a real cooldown
  for (const k of ['mob_cap', 'group_cap', 'cooldown_sec']) {
    if (!Number.isInteger(d[k]) || d[k] <= 0) problems.push(`dungeon.${k} is ${d[k]}, not a positive whole number`);
  }
  if (d.group_cap > d.mob_cap) problems.push(`dungeon.group_cap ${d.group_cap} exceeds mob_cap ${d.mob_cap}`);
  // DG2 · the owner's run size: 40-60 mobs a run, at most 5 an encounter (the survival table's group)
  if (d.mob_cap < 40 || d.mob_cap > 60) runProblems.push(`dungeon.mob_cap ${d.mob_cap} is outside the 40-60 run`);
  if (d.group_cap < 1 || d.group_cap > 5) runProblems.push(`dungeon.group_cap ${d.group_cap} is outside the 1-5 encounter`);
  // DG3 · the engine reads the data and nothing else: the module agrees with the data's own numbers
  if (DG.mobCap !== d.mob_cap) problems.push(`engine mobCap ${DG.mobCap} ≠ data mob_cap ${d.mob_cap}`);
  if (DG.groupCap !== d.group_cap) problems.push(`engine groupCap ${DG.groupCap} ≠ data group_cap ${d.group_cap}`);
  if (DG.cooldownSec !== d.cooldown_sec) problems.push(`engine cooldownSec ${DG.cooldownSec} ≠ data cooldown_sec ${d.cooldown_sec}`);
  if (DG.clampGroup(99, 99) !== d.group_cap) problems.push(`clampGroup does not hold the encounter cap`);
  if (DG.cooldownLeft(1000, 1000 - d.cooldown_sec) !== 0) problems.push(`cooldownLeft does not expire on time`);
  if (!DG.canEnter(1000, null, false)) problems.push(`a cold dungeon refuses entry`);
  if (DG.canEnter(1000, 1000 - d.cooldown_sec + 1, false)) problems.push(`a cooling dungeon allows entry`);
  return { problems, runProblems };
}

const args = process.argv.slice(2);
if (args.includes('--checks')) {
  const { problems, runProblems } = checks();
  const g = G.gates();
  // Each gate claims the problems its own check raised, so an unclaimed problem fails the run
  // instead of hiding behind a row that still reads PASS.
  const claimed: string[] = [];
  const claim = (id: string, re: RegExp, detail: string) => {
    const mine = problems.filter((p: string) => re.test(p));
    claimed.push(...mine);
    g.add(id, mine.length === 0, mine.length ? mine.join(' · ') : detail);
  };
  claim('DG1', /positive whole number|exceeds mob_cap/, `mob_cap ${E.dungeon?.mob_cap} · group_cap ${E.dungeon?.group_cap} · cooldown_sec ${E.dungeon?.cooldown_sec}`);
  claim('DG3', /engine|clampGroup|cooldownLeft|refuses|allows/, 'the engine agrees with the data\'s own numbers');
  // the run size (40-60 a run, 1-5 an encounter) is a design window, not a wiring fact (owner
  // ruling · AGENTS §3): DG2 is a watch — it prints PENDING and never fails the run
  g.watch('DG2', runProblems.length === 0, runProblems.join(' · '), `mob_cap ${E.dungeon?.mob_cap} sits in the 40-60 run · group_cap ${E.dungeon?.group_cap} in the 1-5 encounter`);
  const unclaimed = problems.filter((p: string) => !claimed.includes(p));
  g.add('DG4', unclaimed.length === 0, unclaimed.length ? `no gate claims: ${unclaimed.join(' · ')}` : 'every problem the dungeon checks raised is claimed by a named gate');
  G.report(g.rows());
} else {
  console.log('dungeon.ts — the run cage');
  console.log('  --checks   run DG1-DG4 (shape, run size, engine agreement, an unclaimed problem)');
}
