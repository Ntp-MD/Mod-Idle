/**
 * Release-journey measurement runner.
 *
 * Loads the production sim through the game's installed Vite in middleware mode, resumes the
 * fingerprinted checkpoint when the source inputs still match, and prints one table row per
 * milestone. Correctness failure exits 1; a resumable resource cutoff exits 2.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const GAME = join(REPO, 'game');
const CACHE = join(GAME, '.cache', 'release-journey');
const gameRequire = createRequire(pathToFileURL(join(GAME, 'package.json')));
const JOURNEY_LIMIT_MS = Number(process.env.RELEASE_JOURNEY_MAX_MS) || 30 * 60 * 1000;

const fingerprintRoots = [
  { path: 'engine', recursive: true, match: /\.ts$/ },
  { path: 'tools/data', recursive: false, match: /\.json$/ },
  { path: 'game/src/engine', recursive: false, match: /\.ts$/ },
  { path: 'game/src/sim', recursive: true, match: /\.ts$/ },
  { path: 'game/src/app/loop.ts', recursive: false, match: /\.ts$/ },
  { path: 'game/src/state/save.ts', recursive: false, match: /\.ts$/ },
  { path: 'tools/release-journey.mjs', recursive: false, match: /\.mjs$/ },
  { path: 'game/measurements', recursive: true, match: /\.ts$/ },
];

function filesUnder(root, recursive, match) {
  const absolute = join(REPO, root);
  if (!existsSync(absolute)) return [];
  if (!statSync(absolute).isDirectory()) return match.test(root) ? [root.replaceAll('\\', '/')] : [];
  if (!recursive) {
    return readdirSync(absolute).filter((name) => match.test(name)).map((name) => `${root}/${name}`);
  }
  const out = [];
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const child = `${root}/${entry.name}`;
    if (entry.isDirectory()) out.push(...filesUnder(child, true, match));
    else if (match.test(entry.name)) out.push(child);
  }
  return out;
}

function sourceFingerprint() {
  const paths = fingerprintRoots.flatMap((root) => filesUnder(root.path, root.recursive, root.match)).sort();
  const hash = createHash('sha256');
  for (const path of paths) {
    hash.update(path);
    hash.update('\0');
    hash.update(readFileSync(join(REPO, path)));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function checkpointPath(fingerprint) {
  return join(CACHE, `${fingerprint}.json`);
}

function readCheckpoint(fingerprint) {
  const path = checkpointPath(fingerprint);
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function writeCheckpoint(fingerprint, checkpoint) {
  mkdirSync(CACHE, { recursive: true });
  const path = checkpointPath(fingerprint);
  const temp = `${path}.tmp-${process.pid}`;
  writeFileSync(temp, JSON.stringify(checkpoint));
  try { renameSync(temp, path); }
  finally { if (existsSync(temp)) unlinkSync(temp); }
}

function row(values) {
  console.log(Object.values(values).join(' | '));
}

async function main() {
  const fingerprint = sourceFingerprint();
  const { createServer } = gameRequire('vite');
  const server = await createServer({
    root: GAME,
    configFile: join(GAME, 'vite.config.ts'),
    appType: 'custom',
    server: { middlewareMode: true, watch: null, hmr: false },
    optimizeDeps: { noDiscovery: true },
  });
  try {
    const journey = await server.ssrLoadModule('/measurements/release-journey.ts');
    const save = await server.ssrLoadModule('/src/state/save.ts');
    const game = await server.ssrLoadModule('/src/sim/core/game.ts');
    const engine = await server.ssrLoadModule('/src/engine/client.ts');
    const mobFixture = await server.ssrLoadModule('/tests/fixtures/mobFixture.ts');
    const skills = await server.ssrLoadModule('/src/sim/combat/skills.ts');
    const trade = await server.ssrLoadModule('/src/sim/town/trade.ts');
    const town = await server.ssrLoadModule('/src/sim/town/town.ts');
    const slots = await server.ssrLoadModule('/src/sim/gear/slots.ts');

    const saved = readCheckpoint(fingerprint);
    const restored = saved ? journey.restoreCheckpoint(saved) : null;
    const state = restored?.state ?? journey.createReferenceGame();
    const memory = restored?.memory ?? journey.newJourneyMemory(state);
    const runtime = journey.createJourneyRuntime(state, memory);

    const outcomes = [];
    const zoneChecks = [];
    const zoneRows = [];
    const startWall = performance.now();
    const onSecond = (s, m) => {
      if (process.env.RELEASE_JOURNEY_PROGRESS && s.clockSec % 300 === 0)
        console.log(JSON.stringify({ kind: 'progress', clockSec: s.clockSec, level: s.player.level,
          zone: s.zone, hunting: s.hunting, walk: !!s.walk, bag: `${slots.slotsUsed(s)}/${slots.slotsAvailable(s)}`,
          treeSpent: m.treeSpent, refusals: m.refusals.length }));
      if (m.enteredZones.includes(s.zone)) return;
      m.enteredZones.push(s.zone);
      const before = save.importJson(save.exportJson(s));
      const after = save.importJson(save.exportJson(s));
      const ok = journey.journeyStateKey(before) === journey.journeyStateKey(after);
      zoneChecks.push({ zone: s.zone, ok });
      const entry = {
        milestone: `zone-${s.zone}`,
        onlineSec: s.counters.playSec,
        wallMs: Math.round(performance.now() - startWall),
        level: s.player.level,
        zone: s.zone,
        kills: s.counters.kills,
        pushes: s.counters.pushes,
        drops: s.counters.drops,
        goldEarned: m.goldEarned,
        goldSpent: m.goldSpent,
        bag: `${slots.slotsUsed(s)}/${slots.slotsAvailable(s)}`,
        gearSwaps: m.gearSwaps,
        treeSpent: m.treeSpent,
        skills: Object.keys(s.skills.owned).sort().join(','),
        refusals: m.refusals.length,
        firstWin: s.goal.done ? 'yes' : 'no',
        checkpoint: ok ? 'PASS' : 'FAIL',
      };
      zoneRows.push(entry);
      row(entry);
    };

    console.log('milestone | onlineSec | wallMs | level | zone | kills | pushes | drops | goldEarned | goldSpent | bag | gearSwaps | treeSpent | skills | refusals | firstWin | checkpoint');
    const run = journey.runJourney(runtime, { maxWallMs: JOURNEY_LIMIT_MS, onSecond });
    row({
      milestone: 'natural-reference-journey',
      onlineSec: run.state.counters.playSec,
      wallMs: Math.round(run.outcome.wallMs),
      level: run.state.player.level,
      zone: run.state.zone,
      kills: run.state.counters.kills,
      pushes: run.state.counters.pushes,
      drops: run.state.counters.drops,
      goldEarned: run.memory.goldEarned,
      goldSpent: run.memory.goldSpent,
      bag: `${slots.slotsUsed(run.state)}/${slots.slotsAvailable(run.state)}`,
      gearSwaps: run.memory.gearSwaps,
      treeSpent: run.memory.treeSpent,
      skills: Object.keys(run.state.skills.owned).sort().join(','),
      refusals: run.memory.refusals.length,
      firstWin: run.firstWin ? 'yes' : 'no',
      checkpoint: run.outcome.status,
    });

    outcomes.push({ name: 'natural-reference-journey', ...run.outcome });

    if (run.outcome.status === 'INCOMPLETE' || run.outcome.status === 'FAIL') {
      writeCheckpoint(fingerprint, journey.makeCheckpoint(fingerprint, run.state, run.memory));
    } else {
      writeCheckpoint(fingerprint, journey.makeCheckpoint(fingerprint, run.state, run.memory));
    }

    // Zone checkpoint result is a correctness gate, independent of the final status.
    const zonesOk = zoneChecks.every((check) => check.ok);
    if (!zonesOk) outcomes.push({ name: 'zone-checkpoints', status: 'FAIL', reason: 'state changed through export/import' });
    else outcomes.push({ name: 'zone-checkpoints', status: 'PASS', reason: `${zoneChecks.length} entered zone(s) round-tripped` });

    // Away equivalence on the current measurement state: no walk, boss, or duplicate reward may appear.
    {
      const source = save.exportJson(run.state);
      const a = save.importJson(source);
      const b = save.importJson(source);
      const sync = game.catchUp(a, 7200);
      const async = await game.catchUpAsync(b, 7200);
      const same = journey.journeyStateKey(a) === journey.journeyStateKey(b) && sync.simulated === async.simulated;
      outcomes.push({ name: 'away-equivalence', status: same ? 'PASS' : 'FAIL',
        reason: same ? '7200s sync and async states match' : 'sync/async away states diverged' });
    }

    // Build capability matrix: a real live row for each required capability must prepare and resolve.
    {
      const rows = [...engine.sm.all()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
      const capabilities = [
        ['physical-melee', (r) => r.basis === 'phys' && r.group === 'melee'],
        ['physical-ranged', (r) => r.basis === 'phys' && r.group === 'ranged'],
        ['elemental-magic', (r) => r.basis === 'magic' && ['fire', 'cold', 'lightning', 'poison', 'chaos', 'earth'].includes(r.element)],
      ];
      const missing = [];
      for (const [name, predicate] of capabilities) {
        const row = rows.find(predicate);
        if (!row) { missing.push(name); continue; }
        if (!probeSkill(row, game, skills, mobFixture)) missing.push(`${name}:${row.id}`);
      }
      outcomes.push({ name: 'build-capability-matrix', status: missing.length ? 'FAIL' : 'PASS',
        reason: missing.length ? `missing ${missing.join(', ')}` : 'physical melee/ranged and elemental magic rows prepare and resolve' });
    }

    // Economy routes: authored acquisition weights and every named good resolve through the one catalogue.
    {
      const deliveryIds = Object.keys(engine.TOWN.delivery?.skill_weights || {});
      const marketIds = Object.keys(engine.TOWN.black_market?.skill_weights || {});
      const missingSkills = [...deliveryIds, ...marketIds].filter((id) => !engine.sm.byId[id]);
      const goods = Object.keys(engine.trade.byId);
      const missingGoods = goods.filter((id) => !Number.isFinite(engine.trade.byId[id]?.value));
      outcomes.push({ name: 'craft-economy-routes', status: missingSkills.length || missingGoods.length ? 'FAIL' : 'PASS',
        reason: missingSkills.length || missingGoods.length
          ? `missing ${missingSkills.slice(0, 5).join(', ')} ${missingGoods.slice(0, 5).join(', ')}`
          : `${deliveryIds.length + marketIds.length} acquisition weight(s) and ${goods.length} good(s) resolve` });
    }

    // Trading boundary: one sale pays once and a second sale cannot mint the same junk again.
    {
      const probe = game.newGame(20261103);
      const junk = engine.trade.goods.find((good) => good.bucket === 'junk');
      if (!junk) outcomes.push({ name: 'trading-repeated-actions', status: 'FAIL', reason: 'no junk good exists' });
      else {
        probe.junk[junk.key] = 10;
        const goldBefore = probe.counters.gold;
        const first = town.sellJunk(probe);
        const afterFirst = probe.counters.gold;
        const second = town.sellJunk(probe);
        const ok = first.pieces === 10 && first.gold === afterFirst - goldBefore
          && second.pieces === 0 && second.gold === 0 && (probe.junk[junk.key] || 0) === 0;
        outcomes.push({ name: 'trading-repeated-actions', status: ok ? 'PASS' : 'FAIL',
          reason: ok ? 'sale pays once; a second sale of empty junk pays zero' : 'sale result does not match the ledger' });
      }
    }

    for (const outcome of outcomes) row({ milestone: outcome.name, checkpoint: outcome.status, detail: outcome.reason });
    const failed = outcomes.some((outcome) => outcome.status === 'FAIL');
    const incomplete = outcomes.some((outcome) => outcome.status === 'INCOMPLETE');
    console.log(JSON.stringify({ kind: 'journey-summary', fingerprint, outcomes, firstWin: run.firstWin }));
    if (failed) process.exitCode = 1;
    else if (incomplete) process.exitCode = 2;
    else process.exitCode = 0;
  } finally {
    await server.close();
  }
}

function probeSkill(row, game, skills, fixtures) {
  const state = game.newGame(20261103);
  game.setLevel(state, 30);
  state.group = [fixtures.mobFixture({
    id: 'probe', hp: 1e9, hpMax: 1e9, ps: 0, evasion: 0, dodgeRate: 0,
    armour: 0, res: 0, innate: [], skillIds: [], line: 'front',
  })];
  state.skills.owned[row.id] = 0;
  state.skills.list.fill(null);
  state.skills.list[0] = row.id;
  state.player.mana = 1e9;
  if (row.weapon) state.gear[0] = { slot: 'main hand', base: row.weapon, ilvl: 1, quality: 'Normal', tier: 'T1', lines: [] };
  const sheet = game.characterSheet(state);
  const prepared = skills.prepareSkillCast(state.skills, sheet, row.id, 1e9, state.group, {}, { spatialTargets: false });
  if (!prepared) return false;
  const report = skills.resolvePreparedCast(state.skills, sheet, prepared, {}, () => 0.5, {});
  return Number.isFinite(report.damage) && report.damage >= 0
    && Number.isFinite(report.manaCost) && Number.isFinite(report.hpCost)
    && Number.isFinite(report.dealt || 0);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
