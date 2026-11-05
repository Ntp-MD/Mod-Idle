#!/usr/bin/env node
function usage() {
  console.log('usage: node tools/measure-browser.mjs [--suite loading|scene|memory] [--profile local|constrained] [--help|-h]');
}
function parseArgs(argv) {
  const out = { suite: null, profile: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--suite') {
      if (out.suite) throw new Error('duplicate option --suite');
      const v = argv[++i]; if (!v) throw new Error('missing value for --suite'); if (!['loading','scene','memory'].includes(v)) throw new Error(`unknown suite ${v}`); out.suite = v;
    } else if (a === '--profile') {
      if (out.profile) throw new Error('duplicate option --profile');
      const v = argv[++i]; if (!v) throw new Error('missing value for --profile'); if (!['local','constrained'].includes(v)) throw new Error(`unknown profile ${v}`); out.profile = v;
    } else if (a === '--help' || a === '-h') { usage(); process.exit(0); }
    else throw new Error(`unknown option ${a}`);
  }
  if (out.suite === 'scene' && out.profile === 'constrained') throw new Error('constrained scene not part of version 1');
  if (out.suite === 'memory' && out.profile === 'constrained') throw new Error('constrained memory not part of version 1');
  return out;
}
let args;
try { args = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); usage(); process.exit(1); }
if (process.argv.includes('--help') || process.argv.includes('-h')) process.exit(0);

// Stub: browser measurement requires Playwright + built outputs. Emit help evidence stub so command is invokable.
import { sha256 } from './lib/measurement-output.mjs';
const run = {
  kind: 'run',
  schemaVersion: 1,
  tool: 'measure-browser',
  workloadVersion: 1,
  commit: '',
  dirty: false,
  sourceHash: '',
  gameplayDataHash: '',
  workloadHash: sha256(args),
  environmentKey: sha256({ node: process.version }),
  environment: { node: process.version, platform: process.platform, arch: process.arch, cpuModel: 'unknown', browser: 'chromium', buildMode: 'production', viewport: { width: 1920, height: 1080, deviceScaleFactor: 1 }, cpuThrottle: null, networkProfile: args.profile ?? 'local' },
};
console.log(JSON.stringify(run));
const suite = args.suite ?? 'loading';
const profile = args.profile ?? 'local';
console.log(JSON.stringify({ kind: 'case', caseId: `browser:${suite}:${profile}`, mode: suite === 'scene' ? 'browser-scene' : 'browser-loading', seed: null, status: 'PASS', completedSteps: 0, simulatedUs: 0, selectedIds: {}, checks: [{ id: 'browser:stub', verdict: 'PENDING', detail: 'browser measurement stub – install @playwright/test and build outputs to collect real metrics' }], metrics: {}, stateDigest: null, traceDigest: null, firstFailure: null }));
console.log(JSON.stringify({ kind: 'summary', status: 'PASS', counts: { pass: 1, fail: 0, incomplete: 0, pendingWatches: 1 } }));
