/**
 * One command for the whole cage.
 *
 *   node tools/verify.ts            run every cage + the doc linter, exit 1 on any FAIL
 *   node tools/verify.ts --report   also rebuild dashboard.html when everything passes
 *
 * This is what a pre-commit hook and CI should call: after any edit it tells you
 * whether a number, a count or a cross-file reference was left dangling.
 *
 * The cages are independent and read-only under `--checks`, so they run
 * concurrently (a small pool); each child's output is buffered and printed in
 * step order once the pool drains, so the report reads exactly as before.
 */

import { execFileSync, spawn } from 'node:child_process';
import path from 'node:path';
import { CAGES } from './lib/writers.ts';
import { withNodeFlags } from './lib/node.ts';

// Children load engine/*.ts, so every spawned node needs the native type-stripping flag.
process.env.NODE_OPTIONS = withNodeFlags(process.env.NODE_OPTIONS);

if (!process.features.typescript) {
  console.error('verify: node is not stripping TypeScript — re-run with --experimental-strip-types');
  process.exit(1);
}

const ROOT = path.resolve(import.meta.dirname, '..');
const CONCURRENCY = Math.max(1, Math.min(6, CAGES.length));

function run(step: { script: string; args: string[] }): Promise<{ out: string; code: number }> {
  return new Promise((resolve) => {
    const child = spawn('node', [step.script, ...step.args], { cwd: ROOT, env: process.env });
    let out = '';
    child.stdout.on('data', (d) => { out += d; });
    child.stderr.on('data', (d) => { out += d; });
    child.on('error', (e) => resolve({ out: out + String(e), code: 1 }));
    child.on('close', (code) => resolve({ out, code: code ?? 1 }));
  });
}

const results: { out: string; code: number }[] = new Array(CAGES.length);
let next = 0;
async function worker(): Promise<void> {
  for (;;) {
    const i = next++;
    if (i >= CAGES.length) return;
    results[i] = await run(CAGES[i]);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

let failed = 0;
for (let i = 0; i < CAGES.length; i++) {
  const { label, script, args } = CAGES[i];
  console.log(`\n=== ${label} · node ${script} ${args.join(' ')} ===`);
  process.stdout.write(results[i].out);
  if (results[i].code) failed++;
}

console.log(`\n${CAGES.length - failed}/${CAGES.length} cages PASS`);

if (process.argv.includes('--report') && !failed) {
  console.log('\n=== rebuilding dashboard ===');
  process.stdout.write(execFileSync('node', ['tools/report.ts'], { cwd: ROOT, encoding: 'utf8' }));
}

if (failed) process.exitCode = 1;
