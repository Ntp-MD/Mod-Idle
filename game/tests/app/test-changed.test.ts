import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';

let workspace: string;
const files = [
  'game/src/example.ts',
  'game/tests/example.test.ts',
  'game/tests/sim/clock.test.ts',
  'game/tests/fixtures/example.ts',
  'tools/data/example.json',
  'game/vitest.config.ts',
  'game/src/icon/currency/currency-strongbox.png',
  'game/src/ui/combat/arena/arena-art-pixel-v2/human-animation-v1.json',
  'game/src/assets/unknown.png',
  'game/tests/app/boot-recovery.test.ts',
  'game/index.html',
  'game/wiki.html',
  'game/src/main.ts',
  'game/src/AppShell.svelte',
  'game/src/App.svelte',
  'game/src/styles/base.css',
  'game/measurements/example.ts',
  'game/browser-tests/example.spec.ts',
  'docs/README.md',
];

beforeAll(() => {
  workspace = mkdtempSync(join(tmpdir(), 'modworld-test-changed-'));
  for (const file of [...files, 'tools/test-changed.mjs', 'game/node_modules/vitest/vitest.mjs']) {
    mkdirSync(dirname(join(workspace, file)), { recursive: true });
    writeFileSync(join(workspace, file), '');
  }
  copyFileSync(new URL('../../../tools/test-changed.mjs', import.meta.url), join(workspace, 'tools/test-changed.mjs'));
  writeFileSync(join(workspace, 'game/node_modules/vitest/vitest.mjs'),
    'console.log(JSON.stringify(process.argv.slice(2))); process.exit(Number(process.env.TEST_RUNNER_EXIT ?? 0));');
  for (const args of [
    ['init', '--quiet'], ['add', '.'],
    ['-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'baseline'],
  ]) {
    const result = spawnSync('git', args, { cwd: workspace, encoding: 'utf8' });
    expect(result.status, result.stderr).toBe(0);
  }
});

afterAll(() => {
  expect(dirname(resolve(workspace))).toBe(resolve(tmpdir()));
  rmSync(workspace, { recursive: true, force: true });
});

function run(changed: string[], flags: string[] = [], deleted: string[] = [], exit = 0, append = false) {
  try {
    for (const file of changed) {
      mkdirSync(dirname(join(workspace, file)), { recursive: true });
      if (append) writeFileSync(join(workspace, file), readFileSync(join(workspace, file), 'utf8') + '\n// self-change probe');
      else writeFileSync(join(workspace, file), '// changed');
    }
    for (const file of deleted) rmSync(join(workspace, file), { force: true });
    const result = spawnSync(process.execPath, ['tools/test-changed.mjs', ...flags], {
      cwd: workspace, encoding: 'utf8', env: { ...process.env, TEST_RUNNER_EXIT: String(exit) },
    });
    expect(result.status, result.stderr).toBe(exit);
    return result.stdout.split(/\r?\n/).filter(line => line.startsWith('['))
      .map(line => JSON.parse(line) as string[]);
  } finally {
    for (const file of files) {
      mkdirSync(dirname(join(workspace, file)), { recursive: true });
      writeFileSync(join(workspace, file), '');
    }
    for (const file of changed) if (!files.includes(file)) rmSync(join(workspace, file), { force: true });
    for (const file of deleted) if (files.includes(file)) {
      mkdirSync(dirname(join(workspace, file)), { recursive: true });
      writeFileSync(join(workspace, file), '');
    }
    copyFileSync(new URL('../../../tools/test-changed.mjs', import.meta.url), join(workspace, 'tools/test-changed.mjs'));
  }
}

it('runs the suite once for data changes, slow tests included', () => {
  const calls = run(['tools/data/example.json', 'game/tests/example.test.ts', 'game/tests/sim/clock.test.ts']);
  expect(calls).toEqual([['run']]);
});

it('selects changed sources and tests together without excluding a changed slow test', () => {
  const calls = run(['game/src/example.ts', 'game/tests/example.test.ts', 'game/tests/sim/clock.test.ts']);
  expect(calls).toHaveLength(1);
  expect(calls[0].slice(0, 2)).toEqual(['related', '--run']);
  expect(calls[0]).not.toContain('--exclude');
  expect(calls[0]).toContain('src/example.ts');
  expect(calls[0]).toContain('tests/example.test.ts');
  expect(calls[0].filter(arg => arg === 'tests/sim/clock.test.ts')).toHaveLength(1);
});

it('covers the runner itself through its own regression test', () => {
  // Append: overwriting the runner under test would destroy the script being run.
  const calls = run(['tools/test-changed.mjs'], [], [], 0, true);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain('tests/app/test-changed.test.ts');
});

it('runs only the changed tests when no source changed', () => {
  const calls = run(['game/tests/example.test.ts']);
  expect(calls).toEqual([['run', 'tests/example.test.ts']]);
});

it('finds related tests when a shared fixture changes', () => {
  const calls = run(['game/tests/fixtures/example.ts']);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain('related');
  expect(calls[0]).toContain('tests/fixtures/example.ts');
});

it('falls back to the suite for deleted sources and test config changes', () => {
  for (const calls of [run([], [], ['game/src/example.ts']), run(['game/vitest.config.ts'])]) {
    expect(calls).toHaveLength(1);
    expect(calls[0][0]).toBe('run');
  }
});

it('supports full runs, dry runs, no changes and failing test exits', () => {
  expect(run(['tools/data/example.json'], ['--full'])).toEqual([['run']]);
  expect(run(['tools/data/example.json'], ['--dry-run'])).toEqual([]);
  expect(run([])).toEqual([]);
  expect(run(['game/tests/example.test.ts'], [], [], 1)).toHaveLength(1);
});

it('selects animation manifest for runtime arena JSON and falls back on deletion', () => {
  const json = 'game/src/ui/combat/arena/arena-art-pixel-v2/human-animation-v1.json';
  const metaCalls = run([json]);
  expect(metaCalls).toHaveLength(1);
  expect(metaCalls[0].slice(0, 2)).toEqual(['related', '--run']);
  expect(metaCalls[0]).toContain('tests/ui/animation-manifest.test.ts');
  expect(metaCalls[0].some((arg) => arg.includes('human-animation'))).toBe(false);

  const delCalls = run([], [], [json]);
  expect(delCalls).toHaveLength(1);
  expect(delCalls[0][0]).toBe('run');
});

it('dedupes source, asset and owner test changed together', () => {
  const calls = run([
    'game/src/example.ts',
    'game/src/icon/currency/currency-strongbox.png',
    'game/tests/ui/icon-registry.test.ts',
  ]);
  expect(calls).toHaveLength(1);
  expect(calls[0].slice(0, 2)).toEqual(['related', '--run']);
  expect(calls[0].filter((arg) => arg === 'tests/ui/icon-registry.test.ts')).toHaveLength(1);
  expect(calls[0]).toContain('src/example.ts');
});

it('falls back to suite for opaque without proven owner', () => {
  const calls = run(['game/src/assets/unknown.png']);
  expect(calls).toHaveLength(1);
  expect(calls[0][0]).toBe('run');
  expect(calls[0]).not.toContain('tests/ui/icon-registry.test.ts');
});

it('treats docs-only as no gameplay and keeps exit codes', () => {
  expect(run(['docs/README.md'])).toEqual([]);
  expect(run(['game/tests/example.test.ts'], [], [], 1)).toHaveLength(1);
});

it('selects boot-recovery for the shell and entry inputs', () => {
  for (const file of [
    'game/index.html',
    'game/wiki.html',
    'game/src/main.ts',
    'game/src/AppShell.svelte',
    'game/src/App.svelte',
  ]) {
    const calls = run([file]);
    expect(calls, file).toHaveLength(1);
    expect(calls[0].slice(0, 2), file).toEqual(['related', '--run']);
    expect(calls[0], file).toContain('tests/app/boot-recovery.test.ts');
    // main.ts/App.svelte are graph sources: vitest relies on their import graph
    // to find related tests; html/wiki are not fed to the graph.
    if (file.endsWith('.html')) expect(calls[0].some((arg) => arg === file.replace(/^game\//, '')), file).toBe(false);
  }
});

it('treats CSS and measurement sources as graph inputs', () => {
  const cssCalls = run(['game/src/styles/base.css']);
  expect(cssCalls).toHaveLength(1);
  expect(cssCalls[0][0]).toBe('run');
  const measurementCalls = run(['game/measurements/example.ts']);
  expect(measurementCalls).toHaveLength(1);
  expect(measurementCalls[0].slice(0, 2)).toEqual(['related', '--run']);
  expect(measurementCalls[0]).toContain('measurements/example.ts');
});

it('treats a browser spec change as no unit selection (browser runner lands in P5)', () => {
  expect(run(['game/browser-tests/example.spec.ts'])).toEqual([]);
});

it('handles mixed CSS + TS changes without passing CSS to vitest related', () => {
  const calls = run(['game/src/example.ts', 'game/src/styles/base.css']);
  expect(calls).toHaveLength(1);
  expect(calls[0].slice(0, 2)).toEqual(['related', '--run']);
  expect(calls[0]).toContain('src/example.ts');
  expect(calls[0].some((arg) => arg.endsWith('.css'))).toBe(false);
});
