'use strict';

/**
 * One command for the whole build.
 *
 *   node tools/build.js          run every writer, then verify, then rebuild the views
 *   node tools/build.js --check  skip the writers, only verify + rebuild
 *
 * This is the owner-facing shortcut: edit tools/data/*.json (or a doc), then run this.
 * It runs every block writer, then tools/verify.js (the nine cages), then the two view
 * builders. It stops at the first failure so a broken writer never gets papered over.
 */

const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

const WRITERS = [
  ['check.js', ['--write']],
  ['town.js', ['--write']],
  ['skills.js', ['--write']],
  ['tree.js', ['--write']],
  ['ladder.js', ['--write']],
  ['loot.js', ['--write']],
  ['timeline.js', ['--write']],
  ['survival.js', ['--write']],
];

const run = (label, script, args) => {
  console.log(`\n=== ${label} · node tools/${script} ${args.join(' ')} ===`);
  try {
    process.stdout.write(execFileSync('node', [path.join('tools', script), ...args], { cwd: ROOT, encoding: 'utf8' }));
    return true;
  } catch (e) {
    process.stdout.write((e.stdout || '') + (e.stderr || ''));
    return false;
  }
};

const skipWriters = process.argv.includes('--check');

if (!skipWriters) {
  for (const [script, args] of WRITERS) {
    if (!run('writer', script, args)) {
      console.error(`\nbuild STOPPED — writer ${script} failed`);
      process.exit(1);
    }
  }
}

if (!run('verify', 'verify.js', [])) {
  console.error('\nbuild STOPPED — verify failed');
  process.exit(1);
}

for (const [script, args] of [['report.js', []], ['wiki.js', ['build']]]) {
  if (!run('view', script, args)) {
    console.error(`\nbuild STOPPED — ${script} failed`);
    process.exit(1);
  }
}

console.log('\nbuild OK — writers + verify + dashboard + wiki');
