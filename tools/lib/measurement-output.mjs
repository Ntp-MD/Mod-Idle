/**
 * Shared measurement evidence serialization (plan P1).
 *
 * Canonicalization, SHA-256 fingerprints and JSON-lines output for all
 * measurement runners. The simulation benchmark (`performance-baseline.mjs`)
 * reuses `canonical`/`sha256` from here so there is exactly one canonical
 * serializer. This module has no gameplay imports.
 */

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/** Stable JSON for hashing: object keys sorted; array order stays. */
export function canonical(value) {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error(`nonfinite numeric value cannot be serialized: ${value}`);
    }
    return value;
  }
  if (Array.isArray(value)) return value.map(canonical);
  const out = {};
  for (const key of Object.keys(value).sort()) {
    const next = canonical(value[key]);
    if (next !== undefined) out[key] = next;
  }
  return out;
}

export const sha256 = (value) => createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');

/** Hash of path + NUL + exact bytes for each file, in sorted order. */
export function hashFiles(paths, root = ROOT) {
  const normalized = [...new Set(paths.map((path) => path.replaceAll('\\', '/')))].sort();
  const hash = createHash('sha256');
  for (const path of normalized) {
    const absolute = join(root, path);
    hash.update(path);
    hash.update('\0');
    hash.update(readFileSync(absolute));
  }
  return hash.digest('hex');
}

/** Expand a directory prefix like `engine/` to every file beneath it (no glob dependency). */
export function expandPattern(pattern, root = ROOT) {
  if (!pattern.includes('*')) return [pattern];
  const slash = pattern.indexOf('/');
  const head = pattern.slice(0, slash);
  return walk(join(root, head), head);
}

function walk(directory, prefix) {
  const out = [];
  for (const entry of readdirSync(directory).sort()) {
    const child = join(directory, entry);
    const rel = `${prefix}/${entry}`;
    if (statSync(child).isDirectory()) out.push(...walk(child, rel));
    else out.push(rel.replaceAll('\\', '/'));
  }
  return out;
}

export function environmentKey(environment) {
  return sha256(environment);
}

export function printRecord(record) {
  console.log(JSON.stringify(record));
}

export function printRun(run) {
  printRecord({ kind: 'run', ...run });
}

export function printCase(caseResult) {
  assertFiniteMetrics(caseResult);
  printRecord(caseResult);
}

export function printSummary(summary) {
  printRecord(summary);
}

export function assertFiniteMetrics(caseResult) {
  for (const [name, metric] of Object.entries(caseResult.metrics || {})) {
    if (metric.value !== null && !Number.isFinite(metric.value)) {
      throw new Error(`case ${caseResult.caseId}: metric ${name} is nonfinite`);
    }
  }
}

export function summaryStatus(cases) {
  let pass = 0;
  let fail = 0;
  let incomplete = 0;
  let pendingWatches = 0;
  for (const caseResult of cases) {
    if (caseResult.status === 'PASS') pass++;
    else if (caseResult.status === 'FAIL') fail++;
    else incomplete++;
    for (const check of caseResult.checks || []) {
      if (check.verdict === 'PENDING') pendingWatches++;
    }
  }
  const status = fail > 0 ? 'FAIL' : incomplete > 0 ? 'INCOMPLETE' : 'PASS';
  return { status, counts: { pass, fail, incomplete, pendingWatches } };
}
