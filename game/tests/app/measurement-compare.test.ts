import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const CLI = new URL('../../../tools/compare-measurements.mjs', import.meta.url).pathname.replace(/^\//, '');

function evidence(options: {
  commit: string;
  environmentKey: string;
  workloadHash?: string;
  gameplayDataHash?: string;
  cases: any[];
}) {
  const { commit, environmentKey, workloadHash = 'w1', gameplayDataHash = 'g1', cases } = options;
  return [
    JSON.stringify({
      kind: 'run', schemaVersion: 1, tool: 'test', workloadVersion: 1, commit,
      dirty: false, sourceHash: commit, gameplayDataHash, workloadHash, environmentKey,
      environment: { node: 'v-test', platform: 'test', arch: 'x64', cpuModel: 'test', browser: null, buildMode: null, viewport: null, cpuThrottle: null, networkProfile: null },
    }),
    ...cases.map((entry) => JSON.stringify(entry)),
    JSON.stringify({ kind: 'summary', status: 'PASS', counts: { pass: cases.length, fail: 0, incomplete: 0, pendingWatches: 0 } }),
  ].join('\n') + '\n';
}

function caseRow(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'case', caseId: 'c1', mode: 'simulation-benchmark', seed: 7, status: 'PASS',
    completedSteps: 10, simulatedUs: 500000, selectedIds: {}, checks: [],
    metrics: { ticks: { value: 100, unit: 'ms' } }, stateDigest: 'd1', traceDigest: 't1', firstFailure: null,
    ...overrides,
  };
}

function compare(baselineText: string, currentText: string, extra: string[] = []) {
  const dir = mkdtempSync(join(tmpdir(), 'compare-'));
  writeFileSync(join(dir, 'baseline.jsonl'), baselineText);
  writeFileSync(join(dir, 'current.jsonl'), currentText);
  const result = spawnSync(process.execPath, [CLI, '--baseline', join(dir, 'baseline.jsonl'), '--current', join(dir, 'current.jsonl'), ...extra], { encoding: 'utf8' });
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  return { status: result.status, stderr: result.stderr, lines };
}

it('allows source changes but reports percent deltas as PENDING watches', () => {
  const base = evidence({ commit: 'a', environmentKey: 'e1', cases: [caseRow()] });
  const current = evidence({ commit: 'b', environmentKey: 'e1', cases: [caseRow({ metrics: { ticks: { value: 110, unit: 'ms' } } })] });
  const result = compare(base, current);
  expect(result.status).toBe(0);
  const requireLine = (lines: string[], marker: string): string => {
    const line = lines.find((entry) => entry.includes(marker));
    if (!line) throw new Error(`missing line containing ${marker}`);
    return line;
  };
  const metric = JSON.parse(requireLine(result.lines, '"kind":"metric"'));
  expect(metric.verdict).toBe('PENDING');
  expect(metric.baseline).toBe(100);
  expect(metric.current).toBe(110);
  expect(metric.absolute).toBe(10);
  expect(metric.percent).toBe(10);
});

it('reports absolute delta with null percent for a zero baseline', () => {
  const base = evidence({ commit: 'a', environmentKey: 'e1', cases: [caseRow({ metrics: { ticks: { value: 0, unit: 'ms' } } })] });
  const current = evidence({ commit: 'b', environmentKey: 'e1', cases: [caseRow({ metrics: { ticks: { value: 5, unit: 'ms' } } })] });
  const requireLine = (lines: string[], marker: string): string => {
    const line = lines.find((entry) => entry.includes(marker));
    if (!line) throw new Error(`missing line containing ${marker}`);
    return line;
  };
  const metric = JSON.parse(requireLine(compare(base, current).lines, '"kind":"metric"'));
  expect(metric.absolute).toBe(5);
  expect(metric.percent).toBeNull();
});

it('refuses environment and workload mismatches as INCOMPLETE (exit 2)', () => {
  const base = evidence({ commit: 'a', environmentKey: 'e1', cases: [caseRow()] });
  const env = evidence({ commit: 'b', environmentKey: 'e2', cases: [caseRow()] });
  expect(compare(base, env).status).toBe(2);
  const workload = evidence({ commit: 'b', environmentKey: 'e1', workloadHash: 'w2', cases: [caseRow()] });
  expect(compare(base, workload).status).toBe(2);
});

it('requires --allow-data-change and labels the comparison balance-related', () => {
  const base = evidence({ commit: 'a', environmentKey: 'e1', cases: [caseRow()] });
  const current = evidence({ commit: 'b', environmentKey: 'e1', gameplayDataHash: 'g2', cases: [caseRow({ stateDigest: 'd2' })] });
  expect(compare(base, current).status).toBe(2);
  const allowed = compare(base, current, ['--allow-data-change']);
  expect(allowed.status).toBe(0);
  const requireLine = (lines: string[], marker: string): string => {
    const line = lines.find((entry) => entry.includes(marker));
    if (!line) throw new Error(`missing line containing ${marker}`);
    return line;
  };
  const summary = JSON.parse(requireLine(allowed.lines, '"kind":"comparison-summary"'));
  expect(summary.label).toBe('balance-related');
  expect(summary.stateDigestChanges).toBe(1);
});

it('rejects missing rows and duplicate cases', () => {
  const base = evidence({ commit: 'a', environmentKey: 'e1', cases: [caseRow(), caseRow({ caseId: 'c2' })] });
  const current = evidence({ commit: 'b', environmentKey: 'e1', cases: [caseRow()] });
  const missing = compare(base, current);
  expect(missing.status).toBe(1);
  expect(missing.stderr).toMatch(/missing case/);

  const duplicate = evidence({ commit: 'b', environmentKey: 'e1', cases: [caseRow(), caseRow()] });
  const dupResult = compare(base, duplicate);
  expect(dupResult.status).toBe(1);
  expect(dupResult.stderr).toMatch(/duplicate case/);
});
