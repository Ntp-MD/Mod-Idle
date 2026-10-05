/**
 * One command for the whole build.
 *
 *   node tools/build.ts          run every writer, then verify, then rebuild the views
 *   node tools/build.ts --check  skip the writers, only verify + rebuild
 *
 * This is the owner-facing shortcut: edit tools/data/*.json (or a doc), then run this.
 * It runs every block writer, then tools/verify.ts (the cages), then the two view
 * builders. It stops at the first failure so a broken writer never gets papered over.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';

// Children load engine/*.ts; execFileSync inherits process.env, so the flag set here
// reaches every spawned writer / cage / view builder.
process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, '--experimental-strip-types', '--disable-warning=ExperimentalWarning'].filter(Boolean).join(' ');

const ROOT = path.resolve(import.meta.dirname, '..');

const WRITERS: [string, string[]][] = [
  ['check.ts', ['--write']],
  ['town.ts', ['--write']],
  ['skills.ts', ['--write']],
  ['tree.ts', ['--write']],
  ['ladder.ts', ['--write']],
  ['loot.ts', ['--write']],
  ['timeline.ts', ['--write']],
  ['survival.ts', ['--write']],
];

const run = (label: string, script: string, args: string[]): boolean => {
  console.log(`\n=== ${label} · node tools/${script} ${args.join(' ')} ===`);
  try {
    process.stdout.write(execFileSync('node', [path.join('tools', script), ...args], { cwd: ROOT, encoding: 'utf8' }));
    return true;
  } catch (e) {
    process.stdout.write(((e as any).stdout || '') + ((e as any).stderr || ''));
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

if (!run('verify', 'verify.ts', [])) {
  console.error('\nbuild STOPPED — verify failed');
  process.exit(1);
}

for (const [script, args] of [['report.ts', []], ['wiki.ts', ['build']]] as [string, string[]][]) {
  if (!run('view', script, args)) {
    console.error(`\nbuild STOPPED — ${script} failed`);
    process.exit(1);
  }
}

console.log('\nbuild OK — writers + verify + dashboard + wiki');
