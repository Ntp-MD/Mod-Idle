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
  'tools/skill-vfx-pool.ts',
  'game/vitest.config.ts',
  'game/src/icon/currency/currency-strongbox.png',
  'game/public/fx/skill-pool/attack-fire/attack-fireball/v1/meta.json',
  'game/public/fx/skill-pool/attack-fire/attack-fireball/v1/atlas.png',
  'game/src/ui/combat/arena/arena-art-pixel-v2/human-animation-v1.json',
  'game/src/assets/unknown.png',
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
  expect(calls).toEqual([['run', '--passWithNoTests']]);
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

it('covers opaque tool dependencies through their owner tests', () => {
  const calls = run(['tools/skill-vfx-pool.ts']);
  expect(calls).toHaveLength(1);
  expect(calls[0].slice(0, 2)).toEqual(['related', '--run']);
  expect(calls[0].some((arg) => arg.endsWith('tools/skill-vfx-pool.ts'))).toBe(true);
  expect(calls[0]).toContain('tests/ui/vfx-catalog.test.ts');
  expect(calls[0]).toContain('tests/ui/arena-skill-vfx.test.ts');
});

it('covers the runner itself through its own regression test', () => {
  // Append: overwriting the runner under test would destroy the script being run.
  const calls = run(['tools/test-changed.mjs'], [], [], 0, true);
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain('tests/app/test-changed.test.ts');
});

it('runs only the changed tests when no source changed', () => {
  const calls = run(['game/tests/example.test.ts']);
  expect(calls).toEqual([['run', '--passWithNoTests', 'tests/example.test.ts']]);
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
  expect(run(['tools/data/example.json'], ['--full'])).toEqual([['run', '--passWithNoTests']]);
  expect(run(['tools/data/example.json'], ['--dry-run'])).toEqual([]);
  expect(run([])).toEqual([]);
  expect(run(['game/tests/example.test.ts'], [], [], 1)).toHaveLength(1);
});

it('selects owner for public FX metadata and PNG changes', () => {
  for (const file of [
    'game/public/fx/skill-pool/attack-fire/attack-fireball/v1/meta.json',
    'game/public/fx/skill-pool/attack-fire/attack-fireball/v1/atlas.png',
  ]) {
    const calls = run([file]);
    expect(calls, file).toHaveLength(1);
    expect(calls[0].slice(0, 2), file).toEqual(['related', '--run']);
    expect(calls[0], file).toContain('tests/ui/vfx-catalog.test.ts');
    expect(calls[0], file).toContain('tests/ui/arena-skill-vfx.test.ts');
    // binary/public files must not be sent to vitest related
    expect(calls[0].some((arg) => arg.includes('public/fx')), file).toBe(false);
    expect(calls[0].some((arg) => arg.endsWith('.png')), file).toBe(false);
  }
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
