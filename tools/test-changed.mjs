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
  'game/playwright.config.ts', 'game/playwright.config.js',
].includes(path);
const isData = (path) => path.startsWith('tools/data/');
const isTest = (path) => path.startsWith('game/tests/') && path.endsWith('.test.ts');
const isMeasurement = (path) => path.startsWith('game/measurements/') && path.endsWith('.ts');
const isBrowserSpec = (path) => path.startsWith('game/browser-tests/') && path.endsWith('.spec.ts');
const isHtml = (path) => /^game\/.*\.html$/.test(path);
const isCss = (path) => path.startsWith('game/src/styles/') && path.endsWith('.css');
const isGraph = (path) => /^(game\/src\/.*\.(ts|svelte)|game\/tests\/.*\.ts|game\/measurements\/.*\.ts|engine\/.*\.ts|tools\/.*\.(ts|mjs))$/.test(path);
const isIcon = (path) => path.startsWith('game/src/icon/') && path.endsWith('.png');
const isArenaJson = (path) => path.startsWith('game/src/ui/combat/arena/') && path.endsWith('.json');
const isOpaque = (path) => isIcon(path) || isArenaJson(path)
  || (path.startsWith('game/') && /\.(png|json)$/.test(path));
const isRelevant = (path) => isGraph(path) || isOpaque(path) || isData(path) || isConfig(path)
  || isHtml(path) || isCss(path) || isBrowserSpec(path) || isMeasurement(path);

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
  { match: (path) => path === 'game/index.html', tests: ['tests/app/boot-recovery.test.ts'] },
  { match: (path) => path === 'game/wiki.html', tests: ['tests/app/boot-recovery.test.ts'] },
  { match: (path) => path === 'game/src/main.ts' || path === 'game/src/AppShell.svelte',
    tests: ['tests/app/boot-recovery.test.ts'] },
  { match: (path) => path === 'game/src/App.svelte', tests: ['tests/app/boot-recovery.test.ts'] },
  { match: (path) => isCss(path), tests: [] },
  { match: (path) => isMeasurement(path), tests: ['tests/app/measurement-format.test.ts', 'tests/app/measurement-compare.test.ts'] },
  { match: (path) => path === 'tools/measure-content.mjs' || path === 'tools/compare-measurements.mjs' || path.startsWith('tools/lib/measurement-'),
    tests: ['tests/sim/content-coverage.test.ts', 'tests/app/content-runner.test.ts'] },
  { match: (path) => path === 'tools/measure-gameplay.mjs' || path.startsWith('game/measurements/gameplay-'),
    tests: ['tests/app/gameplay-measurements.test.ts'] },
  { match: (path) => path.startsWith('game/browser-tests/') || path === 'game/playwright.config.ts' || path === 'game/playwright.config.js',
    tests: [] },
  { match: (path) => /map/.test(path), tests: ['tests/ui/map-scene.test.ts'] },
  { match: (path) => /combat.*scene|combat-actor|public\/combat/.test(path),
    tests: ['tests/ui/combat-actor.test.ts', 'tests/ui/mob-sprite-pool.test.ts'] },
  { match: (path) => path === 'tools/map.ts', tests: ['tests/ui/map-scene.test.ts'] },
  { match: (path) => path === 'tools/wiki.ts' || path === 'tools/gallery.ts', tests: ['tests/sim/audit-regressions.test.ts'] },
  { match: (path) => path === 'tools/skills.ts' || path === 'tools/lib/skillmodel.ts' || path === 'tools/lib/roster.ts' || path === 'tools/lib/engine.ts',
    tests: ['tests/sim/skills.test.ts'] },
  { match: (path) => isIcon(path), tests: ['tests/ui/icon-registry.test.ts', 'tests/sim/mob-terrain-drops.test.ts'] },
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
const browserSpecs = existing.filter(isBrowserSpec);
// Browser specs are not consumed by the unit runner; before P5 wires the browser
// runner, a change limited to a spec selects no unit command — never fall back
// to the full suite for it (plan P0/P5).
if (browserSpecs.length && !existing.some((p) => !isBrowserSpec(p)) && !deleted.length && !configChanged) {
  console.log(`browser spec change(s) for ${browserSpecs.length} spec(s)… (browser runner lands in P5)`);
  process.exit(0);
}
let args;
// Data, configuration and deletions can fall outside Vitest's import graph,
// so the fallback is the whole suite — slow tests included, never excluded.
if (data.length || deleted.length || configChanged) {
  console.log('data/configuration changes or deleted files; running the suite…');
  args = ['run'];
} else if (opaqueExisting.length && opaqueExisting.some((p) => !OWNER_EDGES.some((e) => e.match(p)))) {
  console.log('opaque runtime input without proven owner; running the suite…');
  args = ['run'];
} else {
  const graphFiles = existing.filter((path) => isGraph(path) && !isBrowserSpec(path)).map(toGame);
  const files = [...new Set([...graphFiles, ...ownerTests])];
  if (sources.length || ownerTests.length) {
    const related = sources.length ? 'related tests' : opaqueExisting.length ? 'owner tests' : 'related tests';
    console.log(`${related} for ${sources.length} changed source and ${tests.length} test file(s)…`);
    args = ['related', '--run', ...files];
  } else if (tests.length) {
    console.log(`changed test file(s) for ${tests.length} test file(s)…`);
    args = ['run', ...changedTests];
  } else {
    // Relevant non-graph input with no proven unit owner yet (e.g. CSS alone).
    // Before P5, selecting nothing would hide the change, so run the full suite.
    console.log('relevant input without proven unit owner; running the suite…');
    args = ['run'];
  }
}
process.exit(run(args));
