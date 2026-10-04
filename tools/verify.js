'use strict';

/**
 * One command for the whole cage.
 *
 *   node tools/verify.js            run every cage + the doc linter, exit 1 on any FAIL
 *   node tools/verify.js --report   also rebuild dashboard.html when everything passes
 *
 * This is what a pre-commit hook and CI should call: after any edit it tells you
 * whether a number, a count or a cross-file reference was left dangling.
 */

const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STEPS = [
  ['engine cage', 'tools/check.js', ['--checks']],
  ['town cage', 'tools/town.js', ['--checks']],
  ['skills cage', 'tools/skills.js', ['--checks']],
  ['tree cage', 'tools/tree.js', ['--checks']],
  ['ladder cage', 'tools/ladder.js', ['--checks']],
  ['loot cage', 'tools/loot.js', ['--checks']],
  ['bases cage', 'tools/bases.js', ['--checks']],
  ['timeline cage', 'tools/timeline.js', ['--checks']],
  ['survival cage', 'tools/survival.js', ['--checks']],
  ['inventory cage', 'tools/inventory.js', ['--checks']],
  ['anchor cage', 'tools/anchors.js', ['--checks']],
  ['doc lint', 'tools/lint.js', []],
];

let failed = 0;
for (const [label, script, args] of STEPS) {
  console.log(`\n=== ${label} · node ${script} ${args.join(' ')} ===`);
  try {
    process.stdout.write(execFileSync('node', [script, ...args], { cwd: ROOT, encoding: 'utf8' }));
  } catch (e) {
    process.stdout.write((e.stdout || '') + (e.stderr || ''));
    failed++;
  }
}

console.log(`\n${STEPS.length - failed}/${STEPS.length} cages PASS`);

if (process.argv.includes('--report') && !failed) {
  console.log('\n=== rebuilding dashboard ===');
  process.stdout.write(execFileSync('node', ['tools/report.js'], { cwd: ROOT, encoding: 'utf8' }));
}

if (failed) process.exitCode = 1;
