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
    const delivery = await server.ssrLoadModule('/src/sim/town/delivery.ts');
    const forge = await server.ssrLoadModule('/src/sim/gear/forge.ts');
    const road = await server.ssrLoadModule('/src/sim/world/road.ts');

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
      const originalKey = journey.journeyStateKey(s);
      const roundTrip = save.importJson(save.exportJson(s));
      const ok = originalKey === journey.journeyStateKey(roundTrip);
      zoneChecks.push({ zone: s.zone, ok });
      const entry = {
        milestone: `zone-${s.zone}`,
        onlineSec: s.counters.playSec,
        awaySec: 0,
        wallMs: Math.round(performance.now() - startWall),
        level: s.player.level,
        zone: s.zone,
        kills: s.counters.kills,
        pushes: s.counters.pushes,
        drops: s.counters.drops,
        goldEarned: m.goldEarned,
        goldSpent: m.goldSpent,
        bag: `${slots.slotsUsed(s)}/${slots.slotsAvailable(s)}`,
        stash: s.stash.reduce((sum, tab) => sum + tab.length, 0),
        gearSwaps: m.gearSwaps,
        treeSpent: m.treeSpent,
        skills: Object.keys(s.skills.owned).sort().join(','),
        refusals: m.refusals.length,
        refusalLog: m.refusals.map((refusal) => `${refusal.action}@${refusal.atSec}s:${refusal.why}`).join(';'),
        firstWin: s.goal.done ? 'yes' : 'no',
        winRecord: s.goal.done ? `clock=${s.goal.done.clockSec}s level=${s.goal.done.level} hp=${Math.round(s.goal.done.hp)}` : '',
        checkpoint: ok ? 'PASS' : 'FAIL',
      };
      zoneRows.push(entry);
      row(entry);
    };

    console.log('milestone | onlineSec | awaySec | wallMs | level | zone | kills | pushes | drops | goldEarned | goldSpent | bag | stash | gearSwaps | treeSpent | skills | refusals | refusalLog | firstWin | winRecord | checkpoint');
    // A harness crash still checkpoints the state it died on, so the failure is debuggable and
    // resumable instead of losing the whole run; the outcome stays FAIL with the crash reason.
    let run = null;
    try {
      run = journey.runJourney(runtime, { maxWallMs: JOURNEY_LIMIT_MS, onSecond });
    } catch (error) {
      run = {
        outcome: { status: 'FAIL', reason: `harness crashed: ${error?.message || error}`,
          simulatedSec: runtime.state.clockSec, wallMs: performance.now() - startWall },
        state: runtime.state, memory: runtime.memory, firstWin: runtime.state.goal.done,
      };
    }
    row({
      milestone: 'natural-reference-journey',
      onlineSec: run.state.counters.playSec,
      awaySec: 0,
      wallMs: Math.round(run.outcome.wallMs),
      level: run.state.player.level,
      zone: run.state.zone,
      kills: run.state.counters.kills,
      pushes: run.state.counters.pushes,
      drops: run.state.counters.drops,
      goldEarned: run.memory.goldEarned,
      goldSpent: run.memory.goldSpent,
      bag: `${slots.slotsUsed(run.state)}/${slots.slotsAvailable(run.state)}`,
      stash: run.state.stash.reduce((sum, tab) => sum + tab.length, 0),
      gearSwaps: run.memory.gearSwaps,
      treeSpent: run.memory.treeSpent,
      skills: Object.keys(run.state.skills.owned).sort().join(','),
      refusals: run.memory.refusals.length,
      refusalLog: run.memory.refusals.map((refusal) => `${refusal.action}@${refusal.atSec}s:${refusal.why}`).join(';'),
      firstWin: run.firstWin ? 'yes' : 'no',
      winRecord: run.state.goal.done
        ? `clock=${run.state.goal.done.clockSec}s level=${run.state.goal.done.level} hp=${Math.round(run.state.goal.done.hp)}`
        : '',
      checkpoint: run.outcome.status,
    });

    outcomes.push({ name: 'natural-reference-journey', ...run.outcome });

    writeCheckpoint(fingerprint, journey.makeCheckpoint(fingerprint, run.state, run.memory));

    // Zone checkpoint result is a correctness gate, independent of the final status.
    const zonesOk = zoneChecks.every((check) => check.ok);
    if (!zonesOk) outcomes.push({ name: 'zone-checkpoints', status: 'FAIL', reason: 'state changed through export/import' });
    else outcomes.push({ name: 'zone-checkpoints', status: 'PASS', reason: `${zoneChecks.length} entered zone(s) round-tripped` });

    // Away equivalence on an earned hunting checkpoint: single 2h vs sliced, cancel/resume at
    // the ledger boundary, with no travel, new boss, or duplicate reward.
    {
      const earned = (() => {
        const probe = journey.createReferenceGame();
        const mem = journey.newJourneyMemory(probe);
        const rt = journey.createJourneyRuntime(probe, mem);
        for (let i = 0; i < 600 && !probe.hunting; i++) rt.advanceSecond();
        return probe.hunting ? probe : run.state;
      })();
      const source = save.exportJson(earned);
      const startCell = earned.cell ? `${earned.cell.q},${earned.cell.r}` : '';
      const startZone = earned.zone;
      const startClock = earned.clockSec;
      const startBossDue = earned.bossDueAt;
      const a = save.importJson(source);
      const b = save.importJson(source);
      const sync = game.catchUp(a, 7200);
      const asyncRes = await game.catchUpAsync(b, 7200);
      const d = save.importJson(source);
      let sliced = 0;
      for (let i = 0; i < 4; i++) sliced += game.catchUp(d, 1800).simulated;
      // Cancel mid-flight, then resume the remainder on the same state.
      const e = save.importJson(source);
      const controller = new AbortController();
      let seen = 0;
      const cancelled = await game.catchUpAsync(e, 7200, { signal: controller.signal,
        onProgress: (done) => { seen = done; if (done > 0) controller.abort(); } });
      const resumed = game.catchUp(e, 7200 - cancelled.simulated);
      const resumeTotal = cancelled.simulated + resumed.simulated;
      const keysMatch = journey.journeyStateKey(a) === journey.journeyStateKey(b)
        && journey.journeyStateKey(d) === journey.journeyStateKey(a)
        && journey.journeyStateKey(e) === journey.journeyStateKey(a);
      const simMatch = sync.simulated === asyncRes.simulated && sliced === sync.simulated && resumeTotal === sync.simulated;
      const noTravel = [b, d, e].every((s) => (s.cell ? `${s.cell.q},${s.cell.r}` : '') === startCell && s.zone === startZone && !s.walk);
      // The boss clock is an online gate: away shifts bossDueAt with clockSec, so the
      // remaining online time must be unchanged, never satisfied early.
      const bossRemaining = (s) => s.bossDueAt == null || startBossDue == null
        ? (s.bossDueAt ?? null) : s.bossDueAt - s.clockSec;
      const startRemaining = startBossDue == null ? null : startBossDue - startClock;
      const noNewBoss = [b, d, e].every((s) => bossRemaining(s) === startRemaining);
      const cancelWorks = seen > 0 && cancelled.simulated < 7200;
      const parts = [];
      if (!keysMatch) parts.push('state keys diverged');
      if (!simMatch) parts.push(`simulated single=${sync.simulated} async=${asyncRes.simulated} sliced=${sliced} resumed=${resumeTotal}`);
      if (!noTravel) parts.push('travel during away');
      if (!noNewBoss) parts.push('boss clock drift');
      if (!cancelWorks) parts.push(`cancel ineffective (seen=${seen} cancelled=${cancelled.simulated})`);
      outcomes.push({ name: 'away-equivalence', status: parts.length ? 'FAIL' : 'PASS',
        reason: parts.length ? parts.join('; ') : `7200s single/sliced/cancel-resume match${probeHunting(earned)}` });
      function probeHunting(s) { return s === run.state ? ' (final state)' : ' (earned hunting state)'; }
    }

    // Build capability matrix: a real live row for each required capability must prepare and resolve.
    {
      const rows = [...engine.sm.all()].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
      const capabilities = [
        ['physical-melee', (r) => r.type === 'attack' && r.basis === 'phys' && r.group === 'melee'],
        ['physical-ranged', (r) => r.type === 'attack' && r.basis === 'phys' && r.group === 'ranged'],
        ['elemental-magic', (r) => r.type === 'attack' && r.basis === 'magic' && ['fire', 'cold', 'lightning', 'poison', 'chaos', 'earth'].includes(r.element)],
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

    // Economy routes: acquisition IDs resolve, and the dependency graph has no cycle or
    // required source that no reader can reach.
    {
      const deliveryIds = Object.keys(engine.TOWN.delivery?.skill_weights || {});
      const marketIds = Object.keys(engine.TOWN.black_market?.skill_weights || {});
      const missingSkills = [...deliveryIds, ...marketIds].filter((id) => !engine.sm.byId[id]);
      const goods = Object.keys(engine.trade.byId);
      const missingGoods = goods.filter((id) => !Number.isFinite(engine.trade.byId[id]?.value));
      const sources = engine.delivery?.sources || {};
      const unreachable = [];
      const cyclic = [];
      const visit = (key, stack) => {
        if (stack.includes(key)) { cyclic.push(key); return; }
        for (const source of sources[key] || []) {
          for (const input of Object.keys(source.inputs || {})) {
            if (!engine.trade.byId[input]) unreachable.push(`${key}<-${input}`);
            else visit(input, [...stack, key]);
          }
        }
      };
      for (const key of Object.keys(sources)) visit(key, []);
      const bad = [...missingSkills, ...missingGoods, ...unreachable.slice(0, 5), ...cyclic.slice(0, 5)];
      outcomes.push({ name: 'craft-economy-routes', status: bad.length ? 'FAIL' : 'PASS',
        reason: bad.length ? `missing/unreachable/cyclic ${bad.slice(0, 5).join(', ')}`
          : `${deliveryIds.length + marketIds.length} acquisition weight(s), ${goods.length} good(s), ${Object.keys(sources).length} source(s) resolve` });
    }

    // Trading boundary on cloned earned checkpoints: preview matches payment, caps/locks hold,
    // and repeats mint nothing.
    {
      const failures = [];
      const clone = () => {
        const probe = save.importJson(save.exportJson(run.state));
        // Market, delivery and forge verbs are settlement services: stand the clone in its own
        // zone's settlement the way the unit fixtures do, so a mid-field crash state does not read
        // as a preview/payment mismatch.
        const home = town.settlementOfZone(probe.zone);
        const cell = home && road.settlementCell(home.id);
        if (cell) {
          probe.cell = { q: cell.q, r: cell.r, sub: null, site: null };
          probe.walk = null;
          if (probe.phase === 'camp') probe.phase = 'fighting';
        }
        return probe;
      };
      // Market: a single-good quote matches its sale ledger; repeats and empty sales pay zero.
      {
        const probe = clone();
        let carried = trade.tradeInventory(probe).filter((row) => row.good.bucket === 'junk');
        if (!carried.length) {
          const junk = engine.trade.goods.find((good) => good.bucket === 'junk');
          if (!junk) failures.push('no junk good');
          else {
            probe.junk[junk.key] = (probe.junk[junk.key] || 0) + 10;
            carried = trade.tradeInventory(probe).filter((row) => row.good.bucket === 'junk');
          }
        }
        if (!carried.length) failures.push('no junk carried');
        else {
          const { good, count } = carried[0];
          const townId = road.ownerOf(road.currentCell(probe)).id;
          const quote = trade.quoteSale(probe, townId, good.id, count);
          const quotedGold = quote && quote.ok !== false && Number.isFinite(quote.gold) ? quote.gold : null;
          const goldBefore = probe.counters.gold;
          const sale = trade.sellGoods(probe, good.id, count);
          const paid = probe.counters.gold - goldBefore;
          if (sale.ok && quotedGold != null
            && !(Math.abs(quotedGold - sale.gold) <= 0.005 && Math.abs(sale.gold - paid) <= 0.005)) failures.push('market preview != payment');
          else if (!sale.ok && (quotedGold != null || paid !== 0)) failures.push('market refusal moved gold or mismatched preview');
          const goldAfter = probe.counters.gold;
          const repeat = trade.sellGoods(probe, good.id, count);
          if (repeat.ok || probe.counters.gold !== goldAfter) failures.push('market repeat minted');
          town.sellJunk(probe);
          const goldAfterEmpty = probe.counters.gold;
          const emptyAgain = town.sellJunk(probe);
          if (!(emptyAgain.pieces === 0 && emptyAgain.gold === 0 && probe.counters.gold === goldAfterEmpty)) failures.push('empty sale minted');
        }
      }
      // Delivery: preview refusal matches deliver refusal; no gold moves on refusal.
      {
        const probe = clone();
        const preview = delivery.previewDelivery(probe, 'missing-contract', 1, { writer: true });
        const goldBefore = probe.counters.gold;
        const done = delivery.deliver(probe, 'missing-contract', 1, { writer: true });
        if (!!preview?.ok !== !!done?.ok) failures.push('delivery preview != verdict');
        if (probe.counters.gold !== goldBefore) failures.push('delivery refusal moved gold');
      }
      // Forge: canForge refusal matches forgeGear refusal; no material consumed.
      {
        const probe = clone();
        const verdict = forge.canForge(probe, 'weapon', 'missing-forge-id', 'missing-material');
        const matsBefore = JSON.stringify(probe.fieldwork.materials);
        const done = forge.forgeGear(probe, 'weapon', 'missing-forge-id', 'missing-material', () => 0.5);
        if (!!verdict?.ok !== !!done?.ok) failures.push('forge preview != verdict');
        if (JSON.stringify(probe.fieldwork.materials) !== matsBefore) failures.push('forge refusal consumed materials');
      }
      // Caps/locks: unbought tab moves nothing; a locked piece stays in the bag.
      {
        const probe = clone();
        const tabs = town.stashTabCount(probe);
        const movedUnbought = town.depositMany(probe, probe.bag.map((_, i) => i), tabs);
        if (movedUnbought !== 0) failures.push('stash cap bypassed');
        probe.bag = [{ slot: 'ring', base: 'Locked Fixture', ilvl: 1, quality: 'low', tier: 'T1', lines: [], locked: true }];
        const movedLocked = tabs > 0 ? town.depositMany(probe, [0], 0) : 0;
        if (movedLocked !== 0 || probe.bag.length !== 1) failures.push('locked piece moved');
      }
      outcomes.push({ name: 'trading-repeated-actions', status: failures.length ? 'FAIL' : 'PASS',
        reason: failures.length ? failures.slice(0, 3).join('; ') : 'market/delivery/forge preview match payment; caps/locks hold; repeats mint nothing' });
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
  const hpBefore = state.group[0].hp;
  const prepared = skills.prepareSkillCast(state.skills, sheet, row.id, 1e9, state.group, {}, { spatialTargets: false });
  if (!prepared) return false;
  if (!Number.isFinite(prepared.cooldownSec) || !Number.isFinite(prepared.manaCost) || !Number.isFinite(prepared.hpCost)) return false;
  const report = skills.resolvePreparedCast(state.skills, sheet, prepared, {}, () => 0.5, {});
  if (!(report.damage > 0) || !((report.dealt || 0) > 0)) return false;
  if (!Number.isFinite(report.manaCost) || !Number.isFinite(report.hpCost)) return false;
  if ((report.targets || 0) < 1 || !(report.byMob || []).length) return false;
  // Real damage: the mob lost exactly what the report dealt.
  if (!(state.group[0].hp < hpBefore)) return false;
  if (Math.abs((hpBefore - state.group[0].hp) - (report.dealt || 0)) > 1e-6) return false;
  return true;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
