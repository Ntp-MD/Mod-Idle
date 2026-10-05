/**
 * One command for the whole cage.
 *
 *   node tools/verify.ts            run every cage + the doc linter, exit 1 on any FAIL
 *   node tools/verify.ts --report   also rebuild dashboard.html when everything passes
 *
 * This is what a pre-commit hook and CI should call: after any edit it tells you
 * whether a number, a count or a cross-file reference was left dangling.
 */

import { execFileSync } from 'node:child_process';
import path from 'node:path';

// The cages are .ts now but load engine/*.ts, so every child node needs the native
// type-stripping flag. execFileSync inherits process.env, so setting it here reaches
// all spawned cages without touching each call site.
process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, '--experimental-strip-types', '--disable-warning=ExperimentalWarning'].filter(Boolean).join(' ');

if (!process.features.typescript) {
  console.error('verify: node is not stripping TypeScript — re-run with --experimental-strip-types');
  process.exit(1);
}

const ROOT = path.resolve(import.meta.dirname, '..');
const STEPS: [string, string, string[]][] = [
  ['engine cage', 'tools/check.ts', ['--checks']],
  ['town cage', 'tools/town.ts', ['--checks']],
  ['skills cage', 'tools/skills.ts', ['--checks']],
  ['tree cage', 'tools/tree.ts', ['--checks']],
  ['ladder cage', 'tools/ladder.ts', ['--checks']],
  ['loot cage', 'tools/loot.ts', ['--checks']],
  ['bases cage', 'tools/bases.ts', ['--checks']],
  ['timeline cage', 'tools/timeline.ts', ['--checks']],
  ['survival cage', 'tools/survival.ts', ['--checks']],
  ['inventory cage', 'tools/inventory.ts', ['--checks']],
  ['anchor cage', 'tools/anchors.ts', ['--checks']],
  ['map cage', 'tools/map.ts', ['--checks']],
  ['doc lint', 'tools/lint.ts', []],
];

let failed = 0;
for (const [label, script, args] of STEPS) {
  console.log(`\n=== ${label} · node ${script} ${args.join(' ')} ===`);
  try {
    process.stdout.write(execFileSync('node', [script, ...args], { cwd: ROOT, encoding: 'utf8' }));
  } catch (e) {
    process.stdout.write(((e as any).stdout || '') + ((e as any).stderr || ''));
    failed++;
  }
}

console.log(`\n${STEPS.length - failed}/${STEPS.length} cages PASS`);

if (process.argv.includes('--report') && !failed) {
  console.log('\n=== rebuilding dashboard ===');
  process.stdout.write(execFileSync('node', ['tools/report.ts'], { cwd: ROOT, encoding: 'utf8' }));
}

if (failed) process.exitCode = 1;
