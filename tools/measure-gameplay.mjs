#!/usr/bin/env node
/**
 * P9 controlled gameplay measurements: field sides, Boss/Unique probes and resource sites run
 * through the installed Vite SSR loader, printing only JSON lines. Exit 0 = complete PASS evidence,
 * 1 = correctness failure, 2 = missing execution/coverage (cutoff or incomplete cases).
 */
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { environmentKey, expandPattern, hashFiles, printCase, printRecord, printRun, printSummary, sha256, summaryStatus } from './lib/measurement-output.mjs';

function usage() {
  console.log('usage: node tools/measure-gameplay.mjs [--mode controlled|natural] [--preset smoke|full] [--seeds <list>] [--sim-seconds <n>] [--max-wall-ms <n>] [--truncate-after-ms <n>] [--help|-h]');
}
function parseArgs(argv) {
  const out = { mode: 'controlled', preset: 'smoke', seeds: null, simSeconds: null, maxWallMs: null, truncateAfterMs: null };
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
    } else if (a === '--truncate-after-ms') {
      if (out.truncateAfterMs !== null) throw new Error('duplicate option --truncate-after-ms');
      const v = argv[++i]; if (!v) throw new Error('missing value for --truncate-after-ms'); const n = Number(v); if (!Number.isInteger(n)) throw new Error('malformed integer for --truncate-after-ms'); out.truncateAfterMs = n;
    } else if (a === '--help' || a === '-h') { usage(); process.exit(0); }
    else throw new Error(`unknown option ${a}`);
  }
  if (out.mode === 'natural' && out._preset) throw new Error('natural mode does not accept --preset');
  if (out.mode === 'natural' && !out.seeds) throw new Error('natural mode requires --seeds');
  return out;
}
let args;
try { args = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); usage(); process.exit(1); }

const seeds = args.seeds ?? [7, 73];
const simSeconds = args.simSeconds ?? 120;
const preset = args.mode === 'natural' ? 'full' : args.preset;
const maxWallMs = args.maxWallMs ?? (preset === 'full' ? 600000 : 60000);

const commit = (() => { try { return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim(); } catch { return ''; } })();
const dirty = (() => { try { return execSync('git status --porcelain', { encoding: 'utf8' }).trim().length > 0; } catch { return false; } })();
const environment = { node: process.version, platform: process.platform, arch: process.arch, cpuModel: 'unknown', browser: null, buildMode: null, viewport: null, cpuThrottle: null, networkProfile: null };

const GAME = join(dirname(fileURLToPath(import.meta.url)), '..', 'game');
const gameRequire = createRequire(pathToFileURL(join(GAME, 'package.json')));
const vite = await import(pathToFileURL(gameRequire.resolve('vite')).href);
const { createServer } = vite;
const server = await createServer({ configFile: 'game/vite.config.ts', root: GAME, logLevel: 'silent', mode: 'development', server: { middlewareMode: true } });
await server.pluginContainer.buildStart({});
const mod = await server.ssrLoadModule('/measurements/gameplay-cases.ts');
const cases = mod.buildGameplayCases(preset);

const workload = {
  workloadVersion: mod.GAMEPLAY_WORKLOAD_VERSION,
  mode: args.mode,
  preset,
  seeds,
  simSeconds,
  caseIds: cases.map((c) => c.caseId),
};
printRun({
  schemaVersion: 1,
  tool: 'measure-gameplay',
  workloadVersion: mod.GAMEPLAY_WORKLOAD_VERSION,
  commit,
  dirty,
  sourceHash: hashFiles([...expandPattern('engine/*'), 'game/measurements/gameplay-cases.ts']),
  gameplayDataHash: hashFiles(['tools/data/engine.json', 'tools/data/spawns.json', 'tools/data/mob-skills.json']),
  workloadHash: sha256(workload),
  environmentKey: environmentKey(environment),
  environment,
  workload,
});

function runOnce(budget, truncateAfterMs = null) {
  const options = { preset, mode: args.mode, seeds, simSeconds, maxWallMs: budget, truncateAfterMs };
  return mod.runGameplayWorkload(options);
}

let outcome = runOnce(maxWallMs, args.truncateAfterMs);
if (outcome.cutoff && args.truncateAfterMs == null) {
  // Exactly one retry with twice the wall allowance and the unchanged case list/time/seeds.
  outcome = runOnce(maxWallMs * 2);
}
const collected = [...outcome.cases];
const missing = outcome.missing;
for (const caseResult of collected) printCase(caseResult);
for (const caseId of missing) {
  printRecord({
    kind: 'case', caseId: caseId.split('@')[0], mode: args.mode === 'natural' ? 'natural-journey' : 'controlled-build',
    seed: Number(caseId.split('@')[1]) || null, status: 'INCOMPLETE', completedSteps: 0, simulatedUs: 0,
    selectedIds: {}, checks: [{ id: 'execution:wall-cutoff', verdict: 'FAIL', detail: 'wall allowance exhausted before this case' }],
    metrics: {}, stateDigest: null, traceDigest: null, firstFailure: null,
  });
}
const summary = summaryStatus(collected);
if (missing.length) summary.status = 'INCOMPLETE';
printSummary({ kind: 'summary', ...summary, missingCaseIds: missing });
await server.close();
process.exit(summary.status === 'PASS' ? 0 : summary.status === 'FAIL' ? 1 : 2);
