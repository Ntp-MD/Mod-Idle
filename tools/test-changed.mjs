#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const game = resolve(root, 'game');
const dryRun = process.argv.includes('--dry-run');
const full = process.argv.includes('--full');
const git = (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });
const run = (args) => {
  if (dryRun) { console.log('would run:', 'vitest', args.join(' ')); return 0; }
  const vitest = resolve(game, 'node_modules/vitest/vitest.mjs');
  const result = spawnSync(process.execPath, [vitest, ...args], { cwd: game, stdio: 'inherit' });
  return result.status ?? 1;
};

/** Local working-tree diff only: never fetches, never reads the upstream branch. */
const diff = git(['diff', '--name-only', 'HEAD']);
const untracked = git(['ls-files', '--others', '--exclude-standard']);
if (diff.status !== 0 || untracked.status !== 0) {
  console.error('git diff unavailable; run test:changed inside the repository.');
  process.exit(1);
}

const paths = [...diff.stdout.split(/\r?\n/), ...untracked.stdout.split(/\r?\n/)]
  .map((line) => line.trim())
  .filter(Boolean);
const relevant = paths.filter((path) => /^(game\/src\/.*\.(ts|svelte)|game\/tests\/.*\.test\.ts|engine\/.*\.ts|tools\/data\/.*\.json)$/.test(path));
const deleted = relevant.filter((path) => !existsSync(resolve(root, path)));
const existing = relevant.filter((path) => existsSync(resolve(root, path)));
const tests = existing.filter((path) => path.startsWith('game/tests/'));
const sources = existing.filter((path) => !path.startsWith('game/tests/'));
const toGame = (path) => relative(game, resolve(root, path)).replaceAll('\\', '/');

if (deleted.length) {
  console.log(`skipped deleted files (${deleted.length}); run the full suite if an exported interface changed.`);
}
if (!tests.length && !sources.length) {
  console.log('No changed source or test files; nothing to run.');
  process.exit(0);
}

let status = 0;
const slow = ['tests/sim/tree-gate.test.ts', 'tests/sim/clock.test.ts', 'tests/app/save-storage.test.ts',
  'tests/ui/workbench-continuity.test.ts', 'tests/app/save-fidelity.test.ts',
  'tests/sim/engine-agreement.test.ts', 'tests/app/economy-live.test.ts'];
const skipSlow = full ? [] : slow.flatMap((path) => ['--exclude', path]);
// data tables feed every formula through the client bridge, and the related-test map cannot
// see through them — so a data change runs the suite instead of a related subset. The slow
// exclusions still apply unless --full is passed, exactly like the related path below.
const data = existing.filter((path) => path.startsWith('tools/data/'));
if (data.length) {
  console.log(`data tables changed (${data.length} file(s)); running the full suite…`);
  if (!full) console.log('skipping slow tests; rerun with --full to include them.');
  status ||= run(['run', '--passWithNoTests', ...skipSlow]);
} else if (sources.length) {
  console.log(`related tests for ${sources.length} changed source file(s)…`);
  if (!full) console.log('skipping slow related tests; rerun with --full to include them.');
  status ||= run(['related', '--run', '--passWithNoTests', ...skipSlow, ...sources.map(toGame)]);
}
if (tests.length) {
  console.log(`direct tests for ${tests.length} changed test file(s)…`);
  status ||= run(['run', '--passWithNoTests', ...tests.map(toGame)]);
}
process.exit(status);
