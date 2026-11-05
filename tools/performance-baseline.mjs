/**
 * Repeatable combat-performance baseline.
 *
 * Runs the production simulation modules through the installed Vite (SSR, no browser, no listening
 * port), prints JSON lines only, and measures the exact workloads the performance plan names.
 * It is evidence, not a CI timing gate: no assertion in here depends on wall-clock thresholds.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { canonical, sha256 } from './lib/measurement-output.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const GAME = join(REPO, 'game');
const gameRequire = createRequire(pathToFileURL(join(GAME, 'package.json')));

const LIVE_REPEATS = 5;
const LIVE_WARM_STEPS = 600;
const LIVE_TIMED_STEPS = 600;
const OFFLINE_SECONDS = 1200;
const OFFLINE_REPEATS = 5;
const SEED = 7;

const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
const median = (values) => percentile([...values].sort((a, b) => a - b), 0.5);
const summary = (times) => {
  const sorted = [...times].sort((a, b) => a - b);
  return {
    meanMs: times.reduce((sum, value) => sum + value, 0) / times.length,
    p50Ms: percentile(sorted, 0.50),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
    maxMs: sorted[sorted.length - 1],
  };
};

function liveArena(arena) {
  if (!arena) return null;
  return {
    nowUs: arena.nowUs,
    queueOnly: arena.queueOnly,
    player: arena.player,
    mobs: Object.keys(arena.mobs).sort().map((id) => arena.mobs[id]),
    intent: arena.intent ?? null,
    actions: arena.actions,
    flights: arena.flights,
    channelTemplate: arena.channelTemplate ?? null,
    nav: arena.nav ?? null,
  };
}

/** Complete game state except the wall-clock save stamp; live runs add the arena's executable work. */
function fingerprint(state, arena) {
  const { lastSavedAt: _ignored, ...rest } = state;
  return sha256(arena ? { state: rest, arena: liveArena(arena) } : { state: rest });
}

function isNonEmptyLedger(value) {
  return !!value && typeof value === 'object'
    && Array.isArray(value.flights) && Array.isArray(value.actors) && Number.isFinite(value.clockUs)
    && (value.flights.length > 0 || value.actors.length > 0);
}

/**
 * Count the pending-work ledger copies the offline path makes. The wrappers exist only inside this
 * process and only around the offline measurement; they are restored in `finally`.
 */
function installLedgerCounters() {
  const originalStringify = JSON.stringify;
  const originalParse = JSON.parse;
  const stats = { copies: 0, codeUnits: 0, serializationMs: 0 };
  JSON.stringify = function countedStringify(value, ...args) {
    const started = performance.now();
    const text = originalStringify.call(this, value, ...args);
    if (isNonEmptyLedger(value)) {
      stats.copies += 1;
      stats.codeUnits += typeof text === 'string' ? text.length : 0;
      stats.serializationMs += performance.now() - started;
    }
    return text;
  };
  JSON.parse = function countedParse(text, ...args) {
    const looksLikeLedger = typeof text === 'string'
      && text.includes('"flights"') && text.includes('"actors"') && text.includes('"clockUs"');
    if (!looksLikeLedger) return originalParse.call(this, text, ...args);
    const started = performance.now();
    const value = originalParse.call(this, text, ...args);
    if (isNonEmptyLedger(value)) {
      stats.copies += 1;
      stats.codeUnits += text.length;
      stats.serializationMs += performance.now() - started;
    }
    return value;
  };
  let restored = false;
  return {
    stats,
    restore() {
      if (restored) return;
      restored = true;
      JSON.stringify = originalStringify;
      JSON.parse = originalParse;
    },
  };
}

function requiredCapability(rows, predicate, label) {
  const row = [...rows].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).find(predicate);
  if (!row) throw new Error(`performance baseline: missing required capability ${label}`);
  return row.id;
}

function selfTest() {
  assert.equal(percentile([1, 2, 3, 4], 0.50), 3);
  assert.equal(percentile([1, 2, 3, 4], 0.95), 4);
  assert.equal(percentile([9], 0.99), 9);
  assert.throws(() => requiredCapability([], () => true, 'test capability'),
    /missing required capability test capability/);

  const originalStringify = JSON.stringify;
  const originalParse = JSON.parse;
  const counters = installLedgerCounters();
  try {
    JSON.stringify({ flights: [1], actors: [], clockUs: 1 });
    JSON.parse('{"flights":[1],"actors":[],"clockUs":1}');
    throw new Error('fixture exception');
  } catch (error) {
    assert.match(String(error), /fixture exception/);
  } finally {
    counters.restore();
  }
  assert.equal(JSON.stringify, originalStringify);
  assert.equal(JSON.parse, originalParse);
  assert.equal(counters.stats.copies, 2);
  assert.ok(counters.stats.codeUnits > 0);
  console.log(JSON.stringify({ kind: 'self-test', ok: true, ledgerCopies: counters.stats.copies }));
}

async function loadVite() {
  // The contract anchors Vite at the game package, not this script's own resolution path.
  const { createServer } = gameRequire('vite');
  return createServer({
    root: GAME,
    configFile: join(GAME, 'vite.config.ts'),
    appType: 'custom',
    server: { middlewareMode: true, watch: null, hmr: false },
    optimizeDeps: { noDiscovery: true },
  });
}

function zoneByCap(engine, smallest) {
  const zones = engine.E.mob.zones.map((zone) => ({
    id: zone.id,
    name: zone.name,
    cap: engine.spawns.profileFor(zone.id, null, 'live').cap,
  }));
  const ordered = zones.sort((a, b) => smallest
    ? a.cap - b.cap || a.id - b.id
    : b.cap - a.cap || a.id - b.id);
  return ordered[0];
}

async function run() {
  const server = await loadVite();
  try {
    const fixture = await server.ssrLoadModule('/tests/fixtures/encounter.ts');
    const game = await server.ssrLoadModule('/src/sim/core/game.ts');
    const engine = await server.ssrLoadModule('/src/engine/client.ts');
    const combatArena = await server.ssrLoadModule('/src/sim/combat/combat-arena.ts');
    const skills = engine.sm.all();

    const smallestZone = zoneByCap(engine, true);
    const largestZone = zoneByCap(engine, false);
    const skillHeavyIds = [
      requiredCapability(skills, (row) => row.action?.kind === 'blizzard-field', 'blizzard-field'),
      requiredCapability(skills, (row) => row.action?.kind === 'meteor-field', 'meteor-field'),
      requiredCapability(skills, (row) => row.action?.kind === 'thunder-field', 'thunder-field'),
      requiredCapability(skills, (row) => row.action?.kind === 'ray-channel', 'ray-channel'),
      requiredCapability(skills, (row) => (row.effects || []).some((effect) =>
        effect.stat === 'spread_status' && effect.spread_scope === 'footprint'), 'footprint spread_status'),
    ];

    console.log(JSON.stringify({
      kind: 'run',
      schemaVersion: 1,
      tool: 'performance-baseline',
      workloadVersion: 1,
      commit: '',
      dirty: false,
      sourceHash: '',
      gameplayDataHash: '',
      workloadHash: sha256({ liveCases: ['smallest-basic', 'largest-basic', 'largest-skill-heavy'], repeats: LIVE_REPEATS, warmSteps: LIVE_WARM_STEPS, timedSteps: LIVE_TIMED_STEPS, offlineSeconds: OFFLINE_SECONDS, offlineRepeats: OFFLINE_REPEATS, seed: SEED }),
      environmentKey: sha256({ node: process.version, platform: process.platform, arch: process.arch, cpuModel: 'unknown', browser: null, buildMode: null, viewport: null, cpuThrottle: null, networkProfile: null }),
      environment: { node: process.version, platform: process.platform, arch: process.arch, cpuModel: 'unknown', browser: null, buildMode: null, viewport: null, cpuThrottle: null, networkProfile: null },
      selectedIds: { skills: skillHeavyIds },
      metrics: {},
      checks: [],
      status: 'PASS',
      firstFailure: null,
    }));
    console.log(JSON.stringify({
      kind: 'setup',
      seed: SEED,
      smallestZone,
      largestZone,
      skillHeavyIds,
    }));

    const liveCases = [
      { name: 'smallest-basic', zone: smallestZone, skillIds: [] },
      { name: 'largest-basic', zone: largestZone, skillIds: [] },
      { name: 'largest-skill-heavy', zone: largestZone, skillIds: skillHeavyIds },
    ];
    const summaries = [];
    for (const liveCase of liveCases) {
      const repeatMeans = [];
      const repeatP95 = [];
      for (let repeat = 0; repeat < LIVE_REPEATS; repeat++) {
        const encounter = fixture.seededEncounter({
          seed: SEED,
          zone: liveCase.zone.id,
          bodies: liveCase.zone.cap,
          skills: liveCase.skillIds,
        });
        for (const mob of encounter.state.group) mob.hp = mob.hpMax = 1e9;
        const maxMana = game.characterSheet(encounter.state).maxMana;
        combatArena.AIM_DIAGNOSTICS.hits = 0;
        combatArena.AIM_DIAGNOSTICS.misses = 0;
        combatArena.AIM_DIAGNOSTICS.coverageChecks = 0;
        const step = () => {
          encounter.state.player.hp = 1e9;
          encounter.state.player.mana = maxMana;
          game.stepCombat(encounter.state, { arena: encounter.arena });
        };
        for (let stepIndex = 0; stepIndex < LIVE_WARM_STEPS; stepIndex++) step();
        const times = [];
        for (let stepIndex = 0; stepIndex < LIVE_TIMED_STEPS; stepIndex++) {
          const started = performance.now();
          step();
          times.push(performance.now() - started);
        }
        const stats = summary(times);
        repeatMeans.push(stats.meanMs);
        repeatP95.push(stats.p95Ms);
        console.log(JSON.stringify({
          kind: 'live',
          case: liveCase.name,
          repeat,
          zone: liveCase.zone.name,
          zoneId: liveCase.zone.id,
          cap: liveCase.zone.cap,
          bodiesStart: encounter.state.group.length,
          bodiesEnd: encounter.state.group.filter((mob) => mob.hp > 0).length,
          meanMs: stats.meanMs,
          p50Ms: stats.p50Ms,
          p95Ms: stats.p95Ms,
          p99Ms: stats.p99Ms,
          maxMs: stats.maxMs,
          aimHits: combatArena.AIM_DIAGNOSTICS.hits,
          aimMisses: combatArena.AIM_DIAGNOSTICS.misses,
          coverageChecks: combatArena.AIM_DIAGNOSTICS.coverageChecks,
          digest: fingerprint(encounter.state, encounter.arena),
        }));
      }
      const line = {
        kind: 'live-summary',
        case: liveCase.name,
        zone: liveCase.zone.name,
        zoneId: liveCase.zone.id,
        cap: liveCase.zone.cap,
        repeats: LIVE_REPEATS,
        medianMeanMs: median(repeatMeans),
        medianP95Ms: median(repeatP95),
      };
      summaries.push(line);
      console.log(JSON.stringify(line));
    }

    const offlineSkillIds = [
      skillHeavyIds[1], // meteor-field
      skillHeavyIds[0], // blizzard-field
    ];
    for (let repeat = 0; repeat < OFFLINE_REPEATS; repeat++) {
      const encounter = fixture.seededEncounter({
        seed: SEED,
        zone: largestZone.id,
        bodies: largestZone.cap,
        skills: offlineSkillIds,
      });
      const counters = installLedgerCounters();
      const started = performance.now();
      let result;
      try {
        result = game.catchUp(encounter.state, OFFLINE_SECONDS);
      } finally {
        counters.restore();
      }
      const elapsedMs = performance.now() - started;
      console.log(JSON.stringify({
        kind: 'offline',
        repeat,
        zone: largestZone.name,
        zoneId: largestZone.id,
        cap: largestZone.cap,
        requestedSec: OFFLINE_SECONDS,
        simulatedSec: result.simulated,
        capped: result.capped,
        elapsedMs,
        ledgerCopies: counters.stats.copies,
        ledgerCodeUnits: counters.stats.codeUnits,
        serializationMs: counters.stats.serializationMs,
        digest: fingerprint(encounter.state),
      }));
    }
    console.log(JSON.stringify({ kind: 'summary', status: 'PASS', counts: { pass: 0, fail: 0, incomplete: 0, pendingWatches: 0 } }));
    console.log(JSON.stringify({ kind: 'done', liveCases: summaries.length, offlineRepeats: OFFLINE_REPEATS }));
  } finally {
    await server.close();
  }
}

if (process.argv.includes('--self-test')) {
  selfTest();
} else {
  await run();
}
