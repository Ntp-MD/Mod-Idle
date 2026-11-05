/**
 * Compare two measurement evidence files without rerunning a workload (plan P1).
 *
 *   node tools/compare-measurements.mjs --baseline <jsonl-path> --current <jsonl-path>
 *   node tools/compare-measurements.mjs --baseline <jsonl-path> --current -
 *
 * `-` reads the current side from stdin. Rejects duplicate/missing cases,
 * unsupported schema, missing summaries and nonfinite metrics.
 * Exit: 0 = completed without hard failure; 1 = validation failure;
 * 2 = incomplete/incompatible comparison.
 */

import { readFileSync } from 'node:fs';
import { canonical, printRecord } from './lib/measurement-output.mjs';

function usage() {
  console.log('usage: node tools/compare-measurements.mjs --baseline <jsonl-path> --current <jsonl-path|-> [--allow-data-change]');
}

function parseArgs(argv) {
  const args = { baseline: null, current: null, allowDataChange: false };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--baseline' || arg === '--current') {
      if (args[arg.slice(2)]) throw new Error(`duplicate option ${arg}`);
      const value = argv[++index];
      if (!value) throw new Error(`missing value for ${arg}`);
      args[arg.slice(2)] = value;
    } else if (arg === '--allow-data-change') {
      if (args.allowDataChange) throw new Error('duplicate option --allow-data-change');
      args.allowDataChange = true;
    } else if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    } else {
      throw new Error(`unknown option ${arg}`);
    }
  }
  if (!args.baseline || !args.current) throw new Error('both --baseline and --current are required');
  return args;
}

function readEvidence(path) {
  const text = path === '-' ? readFileSync(0, 'utf8') : readFileSync(path, 'utf8');
  const records = text.split(/\r?\n/).filter((line) => line.trim()).map((line) => JSON.parse(line));
  const runs = records.filter((record) => record.kind === 'run');
  const cases = records.filter((record) => record.kind === 'case');
  const summaries = records.filter((record) => record.kind === 'summary');
  if (runs.length !== 1) throw new Error(`evidence must contain exactly one run record, found ${runs.length}`);
  if (!cases.length) throw new Error('evidence must contain at least one case record');
  if (summaries.length !== 1) throw new Error(`evidence must contain exactly one summary record, found ${summaries.length}`);
  if (runs[0].schemaVersion !== 1) throw new Error(`unsupported schema version ${runs[0].schemaVersion}`);
  const seen = new Set();
  for (const caseResult of cases) {
    const key = `${caseResult.caseId}:${caseResult.seed ?? 'null'}`;
    if (seen.has(key)) throw new Error(`duplicate case ${key}`);
    seen.add(key);
    for (const [name, metric] of Object.entries(caseResult.metrics || {})) {
      if (metric.value !== null && !Number.isFinite(metric.value)) {
        throw new Error(`case ${caseResult.caseId}: metric ${name} is nonfinite`);
      }
    }
  }
  return { run: runs[0], cases };
}

function percent(baseline, current) {
  if (baseline === 0) return { absolute: current - baseline, percent: null };
  const absolute = current - baseline;
  return { absolute, percent: (100 * (current - baseline)) / Math.abs(baseline) };
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  let baseline;
  let current;
  try {
    baseline = readEvidence(args.baseline);
    current = readEvidence(args.current);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  const incompatible = [];
  if (baseline.run.environmentKey !== current.run.environmentKey) incompatible.push('environment');
  if (baseline.run.workloadHash !== current.run.workloadHash) incompatible.push('workload');

  const dataChanged = baseline.run.gameplayDataHash !== current.run.gameplayDataHash;
  if (dataChanged && !args.allowDataChange) incompatible.push('gameplay-data');

  const baselineByKey = new Map(baseline.cases.map((caseResult) => [`${caseResult.caseId}:${caseResult.seed ?? 'null'}`, caseResult]));
  const currentByKey = new Map(current.cases.map((caseResult) => [`${caseResult.caseId}:${caseResult.seed ?? 'null'}`, caseResult]));
  const keys = [...new Set([...baselineByKey.keys(), ...currentByKey.keys()])].sort();

  const comparisons = [];
  const missing = [];
  for (const key of keys) {
    const before = baselineByKey.get(key);
    const after = currentByKey.get(key);
    if (!before || !after) {
      missing.push(key);
      continue;
    }
    const metrics = {};
    for (const name of new Set([...Object.keys(before.metrics || {}), ...Object.keys(after.metrics || {})])) {
      const beforeMetric = before.metrics?.[name];
      const afterMetric = after.metrics?.[name];
      if (!beforeMetric || !afterMetric) {
        metrics[name] = { baseline: beforeMetric?.value ?? null, current: afterMetric?.value ?? null, absolute: null, percent: null };
        continue;
      }
      if (beforeMetric.value === null || afterMetric.value === null) {
        metrics[name] = { baseline: beforeMetric.value, current: afterMetric.value, absolute: null, percent: null };
        continue;
      }
      metrics[name] = { baseline: beforeMetric.value, current: afterMetric.value, ...percent(beforeMetric.value, afterMetric.value) };
    }
    comparisons.push({
      kind: 'comparison',
      caseId: before.caseId,
      seed: before.seed,
      baselineStatus: before.status,
      currentStatus: after.status,
      baselineStateDigest: before.stateDigest,
      currentStateDigest: after.stateDigest,
      metrics,
    });
  }

  if (missing.length) {
    for (const key of missing) console.error(`missing case on one side: ${key}`);
    process.exit(1);
  }

  const digestChanges = comparisons.filter((comparison) => comparison.baselineStateDigest !== comparison.currentStateDigest);
  const label = dataChanged ? 'balance-related' : 'equivalent';
  for (const comparison of comparisons) {
    printRecord(comparison);
    for (const [name, metric] of Object.entries(comparison.metrics)) {
      printRecord({ kind: 'metric', caseId: comparison.caseId, seed: comparison.seed, metric: name, verdict: 'PENDING', ...metric });
    }
  }
  const comparison = {
    kind: 'comparison-summary',
    label,
    stateDigestChanges: digestChanges.length,
    incompatible: incompatible.length > 0 ? incompatible : null,
  };
  printRecord(comparison);
  console.log(`comparison: ${incompatible.length ? 'INCOMPLETE' : label}`);
  process.exit(incompatible.length ? 2 : 0);
}

main();
