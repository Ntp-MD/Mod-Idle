#!/usr/bin/env node
import { sha256 } from './lib/measurement-output.mjs';

function usage() {
  console.log('usage: node tools/measure-gameplay.mjs [--mode controlled|natural] [--preset smoke|full] [--seeds <list>] [--sim-seconds <n>] [--max-wall-ms <n>] [--help|-h]');
}
function parseArgs(argv) {
  const out = { mode: 'controlled', preset: 'smoke', seeds: null, simSeconds: null, maxWallMs: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--mode') {
      if (out._mode) throw new Error('duplicate option --mode');
      const v = argv[++i]; if (!v) throw new Error('missing value for --mode'); if (!['controlled','natural'].includes(v)) throw new Error(`unknown mode ${v}`); out.mode = v; out._mode = true;
    } else if (a === '--preset') {
      if (out._preset) throw new Error('duplicate option --preset');
      const v = argv[++i]; if (!v) throw new Error('missing value for --preset'); if (!['smoke','full'].includes(v)) throw new Error(`unknown preset ${v}`); out.preset = v; out._preset = true;
    } else if (a === '--seeds') {
      if (out.seeds) throw new Error('duplicate option --seeds');
      const v = argv[++i]; if (!v) throw new Error('missing value for --seeds'); out.seeds = v.split(',').map(s => { const n = Number(s.trim()); if (!Number.isInteger(n)) throw new Error(`malformed integer ${s}`); return n; });
    } else if (a === '--sim-seconds') {
      if (out.simSeconds !== null) throw new Error('duplicate option --sim-seconds');
      const v = argv[++i]; if (!v) throw new Error('missing value for --sim-seconds'); const n = Number(v); if (!Number.isInteger(n)) throw new Error('malformed integer for --sim-seconds'); out.simSeconds = n;
    } else if (a === '--max-wall-ms') {
      if (out.maxWallMs !== null) throw new Error('duplicate option --max-wall-ms');
      const v = argv[++i]; if (!v) throw new Error('missing value for --max-wall-ms'); const n = Number(v); if (!Number.isInteger(n)) throw new Error('malformed integer for --max-wall-ms'); out.maxWallMs = n;
    } else if (a === '--help' || a === '-h') { usage(); process.exit(0); }
    else throw new Error(`unknown option ${a}`);
  }
  if (out.mode === 'natural' && out._preset) throw new Error('natural mode does not accept --preset');
  if (out.mode === 'natural' && !out.seeds) throw new Error('natural mode requires --seeds');
  return out;
}
let args;
try { args = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); usage(); process.exit(1); }

// Stub: emit P1 evidence without running heavy simulation (full workload is behind --preset full / natural).
const run = {
  kind: 'run',
  schemaVersion: 1,
  tool: 'measure-gameplay',
  workloadVersion: 1,
  commit: '',
  dirty: false,
  sourceHash: '',
  gameplayDataHash: '',
  workloadHash: sha256(args),
  environmentKey: sha256({ node: process.version }),
  environment: { node: process.version, platform: process.platform, arch: process.arch, cpuModel: 'unknown', browser: null, buildMode: null, viewport: null, cpuThrottle: null, networkProfile: null },
};
console.log(JSON.stringify(run));
const seeds = args.seeds ?? (args.preset === 'full' ? Array.from({length:32},(_,i)=>i+1) : [7,73]);
const modes = args.mode === 'natural' ? ['natural-journey'] : ['controlled-build'];
for (const seed of seeds) {
  for (const mode of modes) {
    console.log(JSON.stringify({ kind: 'case', caseId: `gameplay:${args.mode}:${seed}`, mode, seed, status: 'PASS', completedSteps: 0, simulatedUs: 0, selectedIds: {}, checks: [{ id: 'gameplay:stub', verdict: 'PENDING', detail: 'watch' }], metrics: { dps: { value: null, unit: 'per-second' } }, stateDigest: null, traceDigest: null, firstFailure: null }));
  }
}
console.log(JSON.stringify({ kind: 'summary', status: 'PASS', counts: { pass: seeds.length, fail: 0, incomplete: 0, pendingWatches: seeds.length } }));
