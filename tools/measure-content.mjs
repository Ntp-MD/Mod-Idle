#!/usr/bin/env node
import { sha256 } from './lib/measurement-output.mjs';

function usage() {
  console.log('usage: node tools/measure-content.mjs [--correctness-only] [--case <caseId>] [--help|-h]');
}
function parseArgs(argv) {
  const out = { correctnessOnly: false, caseId: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--correctness-only') {
      if (out.correctnessOnly) throw new Error('duplicate option --correctness-only');
      out.correctnessOnly = true;
    } else if (a === '--case') {
      if (out.caseId) throw new Error('duplicate option --case');
      const v = argv[++i];
      if (!v) throw new Error('missing value for --case');
      out.caseId = v;
    } else if (a === '--help' || a === '-h') { usage(); process.exit(0); }
    else throw new Error(`unknown option ${a}`);
  }
  return out;
}

let args;
try { args = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); usage(); process.exit(1); }

const { createServer } = await import('vite');
const server = await createServer({ configFile: 'game/vite.config.ts', mode: 'development', server: { middlewareMode: true } });
await server.pluginContainer.buildStart({});
const mod = await server.ssrLoadModule('/measurements/content-coverage.ts');
await server.close();

const result = mod.runContentChecks();
const filtered = args.caseId ? { ...result, rows: result.rows.filter(r => r.id.includes(args.caseId)) } : result;
const run = {
  kind: 'run',
  schemaVersion: 1,
  tool: 'measure-content',
  workloadVersion: 1,
  commit: '',
  dirty: false,
  sourceHash: '',
  gameplayDataHash: '',
  workloadHash: sha256({ cases: filtered.selectedIds }),
  environmentKey: sha256({ node: process.version, platform: process.platform, arch: process.arch }),
  environment: { node: process.version, platform: process.platform, arch: process.arch, cpuModel: 'unknown', browser: null, buildMode: null, viewport: null, cpuThrottle: null, networkProfile: null },
};
console.log(JSON.stringify(run));
const cases = [];
for (const row of filtered.rows) {
  const c = { kind: 'case', caseId: row.id, mode: 'mechanic-probe', seed: null, status: row.verdict === 'FAIL' ? 'FAIL' : 'PASS', completedSteps: 1, simulatedUs: 0, selectedIds: filtered.selectedIds, checks: [{ id: row.id, verdict: row.verdict, detail: row.detail }], metrics: {}, stateDigest: null, traceDigest: null, firstFailure: null };
  cases.push(c);
  console.log(JSON.stringify(c));
}
let fail = cases.filter(c => c.status === 'FAIL').length;
let incomplete = 0;
let pending = filtered.rows.filter(r => r.verdict === 'PENDING').length;
console.log(JSON.stringify({ kind: 'summary', status: fail ? 'FAIL' : incomplete ? 'INCOMPLETE' : 'PASS', counts: { pass: cases.length - fail, fail, incomplete, pendingWatches: pending } }));
process.exit(fail ? 1 : 0);
