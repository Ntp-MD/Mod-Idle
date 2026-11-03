#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const game = resolve(root, 'game');
const dryRun = process.argv.includes('--dry-run');
// Compatibility alias: every path already runs the full related set, slow tests included.
const full = process.argv.includes('--full');
void full;
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

const isConfig = (path) => [
  'package.json', 'package-lock.json', 'tsconfig.json',
  'game/package.json', 'game/package-lock.json', 'game/tsconfig.json',
  'game/vite.config.ts', 'game/vitest.config.ts',
].includes(path);
const isData = (path) => path.startsWith('tools/data/');
const isTest = (path) => path.startsWith('game/tests/') && path.endsWith('.test.ts');
const isGraph = (path) => /^(game\/src\/.*\.(ts|svelte)|game\/tests\/.*\.ts|engine\/.*\.ts|tools\/.*\.(ts|mjs))$/.test(path);
const isIcon = (path) => path.startsWith('game/src/icon/') && path.endsWith('.png');
const isFx = (path) => path.startsWith('game/public/fx/');
const isArenaJson = (path) => path.startsWith('game/src/ui/combat/arena/') && path.endsWith('.json');
const isOpaque = (path) => isIcon(path) || isFx(path) || isArenaJson(path)
  || (path.startsWith('game/') && /\.(png|json)$/.test(path));
const isRelevant = (path) => isGraph(path) || isOpaque(path) || isData(path) || isConfig(path);

const relevant = paths.filter(isRelevant);
const deleted = relevant.filter((path) => !existsSync(resolve(root, path)));
const existing = relevant.filter((path) => existsSync(resolve(root, path)));
const tests = existing.filter(isTest);
const sources = existing.filter((path) => isGraph(path) && !isTest(path));
const opaqueExisting = existing.filter(isOpaque);
const toGame = (path) => relative(game, resolve(root, path)).replaceAll('\\', '/');
const changedTests = tests.map(toGame);

/**
 * Owner edges for dependencies the import graph cannot see: a tool change whose
 * generated output is not in the diff would otherwise select nothing. Only paths
 * with a named owner test belong here — never a repo-wide mapping.
 */
const OWNER_EDGES = [
  { match: (path) => path === 'tools/test-changed.mjs', tests: ['tests/app/test-changed.test.ts'] },
  { match: (path) => path === 'tools/skill-vfx-pool.ts' || /tools\/(vfx\/|.*(vfx|shader|atlas|gallery|compose|mix|render|bake).*)\.(ts|mjs)$/.test(path),
    tests: ['tests/ui/vfx-catalog.test.ts', 'tests/ui/arena-skill-vfx.test.ts'] },
  { match: (path) => path === 'tools/map.ts', tests: ['tests/ui/map-scene.test.ts'] },
  { match: (path) => path === 'tools/wiki.ts' || path === 'tools/gallery.ts', tests: ['tests/sim/audit-regressions.test.ts'] },
  { match: (path) => path === 'tools/skills.ts' || path === 'tools/lib/skillmodel.ts' || path === 'tools/lib/roster.ts' || path === 'tools/lib/engine.ts',
    tests: ['tests/sim/skills.test.ts'] },
  { match: (path) => isIcon(path), tests: ['tests/ui/icon-registry.test.ts', 'tests/sim/mob-terrain-drops.test.ts'] },
  { match: (path) => isFx(path), tests: ['tests/ui/vfx-catalog.test.ts', 'tests/ui/arena-skill-vfx.test.ts'] },
  { match: (path) => isArenaJson(path), tests: ['tests/ui/animation-manifest.test.ts'] },
];
const ownerTests = [...new Set(existing.flatMap((path) =>
  OWNER_EDGES.filter((edge) => edge.match(path)).flatMap((edge) => edge.tests)))];

const configChanged = paths.some(isConfig);

if (!existing.length && !deleted.length && !configChanged) {
  console.log('No changed source or test files; nothing to run.');
  process.exit(0);
}

const data = existing.filter(isData);
let args;
// Data, configuration and deletions can fall outside Vitest's import graph,
// so the fallback is the whole suite — slow tests included, never excluded.
if (data.length || deleted.length || configChanged) {
  console.log('data/configuration changes or deleted files; running the suite…');
  args = ['run', '--passWithNoTests'];
} else if (opaqueExisting.length && opaqueExisting.some((p) => !OWNER_EDGES.some((e) => e.match(p)))) {
  console.log('opaque runtime input without proven owner; running the suite…');
  args = ['run', '--passWithNoTests'];
} else {
  const graphFiles = existing.filter(isGraph).map(toGame);
  const files = [...new Set([...graphFiles, ...ownerTests])];
  if (sources.length || ownerTests.length) {
    const related = sources.length ? 'related tests' : opaqueExisting.length ? 'owner tests' : 'related tests';
    console.log(`${related} for ${sources.length} changed source and ${tests.length} test file(s)…`);
    args = ['related', '--run', '--passWithNoTests', ...files];
  } else {
    console.log(`changed test file(s) for ${tests.length} test file(s)…`);
    args = ['run', '--passWithNoTests', ...changedTests];
  }
}
process.exit(run(args));
