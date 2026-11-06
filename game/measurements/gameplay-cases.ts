/**
 * P9 controlled gameplay workload: one real execution per authored field side, Boss/Unique special
 * and resource site. Cases are keyed by stable Zone/Subzone/Species/rank/site identities so the
 * pre-migration baseline adapter and the post-migration engine seam run the same list.
 */
import { createHash } from 'node:crypto';
import type { GameState } from '@sim/core/types';
import type { Mob } from '@sim/core/types';
import { createCombatArena } from '@sim/combat/combat-arena';
import { COMBAT_STEP_US, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import { startFieldAction, tickFieldwork } from '@sim/world/fieldwork';
import { E, eng } from '../src/engine/client';
import { mulberry32 } from '../src/engine/client-helpers';
import { DEFAULT_SETTINGS } from '../src/state/save';

export const GAMEPLAY_WORKLOAD_VERSION = 1;

export const PILOT_ZONES = [1, 4, 7, 13, 18] as const;

export type CaseKind = 'field' | 'special' | 'gather';

export interface GameplayCase {
  caseId: string;
  kind: CaseKind;
  zone: number;
  subzone?: number;
  rank?: 'boss' | 'unique';
  species?: string;
  site?: 'mine' | 'grove' | 'fishing';
  siteId?: string;
  /** `world` runs the normal tick (encounters on); `isolated` runs the fieldwork owner only. */
  gatherMode?: 'isolated' | 'world';
  /** Expected authored source; a mismatch is a correctness failure, not a measured outcome. */
  expectedSource: string;
}

export interface GameplayMetric {
  value: number | null;
  unit: string;
  censored?: boolean;
  observedSeconds?: number;
}

export interface GameplayCaseResult {
  kind: 'case';
  caseId: string;
  mode: 'controlled-build' | 'mechanic-probe' | 'natural-journey';
  seed: number;
  status: 'PASS' | 'FAIL' | 'INCOMPLETE';
  completedSteps: number;
  simulatedUs: number;
  selectedIds: Record<string, string[]>;
  checks: { id: string; verdict: 'PASS' | 'FAIL' | 'PENDING'; detail: string }[];
  metrics: Record<string, GameplayMetric>;
  stateDigest: string | null;
  traceDigest: string | null;
  firstFailure: { step: number; atUs: number; assertion: string; expected: unknown; actual: unknown } | null;
}

interface SiteRow {
  id: string;
  zone: number;
  kind: string;
  site?: string;
  index?: number;
  q: number;
  r: number;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function roadSites(): SiteRow[] {
  return (E.road.locations as unknown as SiteRow[]).filter((row) => row.kind === 'site');
}

function zoneRow(zoneId: number): any {
  const row = (E.mob.zones as any[]).find((z) => z.id === zoneId);
  if (!row) throw new Error(`unknown zone ${zoneId}`);
  return row;
}

function sortedSites(mode: 'isolated' | 'world', filter?: (row: SiteRow) => boolean): GameplayCase[] {
  const rows = roadSites()
    .filter((row) => row.site === 'mine' || row.site === 'grove' || row.site === 'fishing')
    .filter((row) => (filter ? filter(row) : true))
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
  return rows.map((row) => ({
    caseId: `gather:${row.id}:${mode}`,
    kind: 'gather',
    zone: row.zone,
    site: row.site as GameplayCase['site'],
    siteId: row.id,
    gatherMode: mode,
    expectedSource: `${row.site} site ${row.id}`,
  }));
}

/** Case order: numeric Zone/Subzone, then special rank/Species, then site id; repeated per seed. */
export function buildGameplayCases(preset: 'smoke' | 'full'): GameplayCase[] {
  const zones = (E.mob.zones as any[])
    .map((z) => z.id as number)
    .filter((id) => preset === 'full' || PILOT_ZONES.includes(id as never))
    .sort((a, b) => a - b);
  const out: GameplayCase[] = [];
  for (const zoneId of zones) {
    const zone = zoneRow(zoneId);
    zone.subzones.forEach((_sub: unknown, index: number) => {
      out.push({
        caseId: `field:z${pad(zoneId)}:s${pad(index + 1)}`,
        kind: 'field',
        zone: zoneId,
        subzone: index + 1,
        expectedSource: `zone ${zoneId} subzone ${index + 1} ${zone.subzones[index].name}`,
      });
    });
  }
  const speciesZoneEligible = (speciesId: string, zoneId: number) =>
    ((E.mob.species as any[]).find((sp) => sp.id === speciesId)?.zones ?? []).includes(zoneId);
  const bosses = (E.mob.bosses as any[])
    .filter((row) => preset === 'full' || PILOT_ZONES.includes(row.zone))
    .sort((a, b) => a.zone - b.zone || a.species.localeCompare(b.species));
  for (const boss of bosses) {
    out.push({
      caseId: `special:z${pad(boss.zone)}:boss:${boss.species}`,
      kind: 'special',
      zone: boss.zone,
      species: boss.species,
      rank: 'boss',
      expectedSource: boss.name,
    });
  }
  const uniques = (E.mob.uniques as any[])
    .map((row) => ({ row, zone: (E.mob.species as any[]).find((sp) => sp.id === row.species)?.zones?.[0] ?? 1 }))
    .filter(({ row, zone }) => (preset === 'full' || PILOT_ZONES.includes(zone)) && speciesZoneEligible(row.species, zone))
    .sort((a, b) => a.zone - b.zone || a.row.species.localeCompare(b.row.species));
  for (const { row, zone } of uniques) {
    out.push({
      caseId: `special:z${pad(zone)}:unique:${row.species}`,
      kind: 'special',
      zone,
      species: row.species,
      rank: 'unique',
      expectedSource: row.name,
    });
  }
  const smokeSites = (row: SiteRow) =>
    preset === 'full'
      || (row.zone === 1 && row.site !== 'fishing')
      || (row.zone === 7 && row.site === 'fishing');
  out.push(...sortedSites('isolated', smokeSites));
  out.push(...sortedSites('world', smokeSites));
  return out;
}

function stable(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(',')}}`;
}

function digest(value: unknown): string {
  return createHash('sha256').update(stable(value)).digest('hex');
}

function finiteAll(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(finiteAll);
  if (value && typeof value === 'object') return Object.values(value as Record<string, unknown>).every(finiteAll);
  return true;
}

/** The workflow adapter: one authored placement in the named side supplies the source identity. */
function fieldSource(c: GameplayCase): { variant: string; level: number } {
  const rows = eng.placementsIn(c.zone, c.subzone!);
  if (!rows.length) throw new Error(`no authored placement for z${c.zone} s${c.subzone}`);
  const row = rows[0] as any;
  return { variant: row.name, level: row.level };
}

function baseState(seed: number, zoneId: number): GameState {
  const state = newGame(seed);
  const zone = zoneRow(zoneId);
  setLevel(state, zone.levels[1]);
  state.autoAvoidOff = DEFAULT_SETTINGS.autoAvoid === false;
  state.hunting = false;
  state.group = [];
  return state;
}

function standOnSub(state: GameState, zoneId: number, subzone: number): void {
  const row = (E.road.locations as unknown as SiteRow[]).find(
    (loc) => loc.kind === 'sub' && loc.zone === zoneId && loc.index === subzone - 1,
  );
  if (!row) throw new Error(`no canonical subzone cell for zone ${zoneId} sub ${subzone}`);
  state.cell = { q: row.q, r: row.r, sub: subzone - 1, site: null };
  state.zone = zoneId;
}

function collectVariants(state: GameState, seen: Set<string>): void {
  for (const mob of state.group as Mob[]) {
    if (mob.placementId) seen.add(mob.placementId);
    else if (mob.variant) seen.add(mob.variant);
  }
}

interface RunLog {
  trace: unknown[];
}

function emptyChecks(): GameplayCaseResult['checks'] {
  return [];
}

function resultOf(
  c: GameplayCase,
  mode: GameplayCaseResult['mode'],
  seed: number,
  startedAtUs: number,
  state: GameState,
  seen: Set<string>,
  checks: GameplayCaseResult['checks'],
  metrics: Record<string, GameplayMetric>,
  log: RunLog,
  terminal: boolean,
): GameplayCaseResult {
  const failed = checks.find((check) => check.verdict === 'FAIL');
  return {
    kind: 'case',
    caseId: c.caseId,
    mode,
    seed,
    status: failed ? 'FAIL' : terminal ? 'PASS' : 'INCOMPLETE',
    completedSteps: Math.max(0, Math.round((state.clockSec * 1e6 - startedAtUs) / COMBAT_STEP_US())),
    simulatedUs: Math.max(0, Math.round(state.clockSec * 1e6 - startedAtUs)),
    selectedIds: { placements: [...seen].sort() },
    checks,
    metrics,
    stateDigest: digest({ counters: state.counters, player: state.player, clockSec: state.clockSec, fieldwork: state.fieldwork }),
    traceDigest: digest(log.trace),
    firstFailure: failed
      ? { step: 0, atUs: state.clockSec * 1e6, assertion: failed.id, expected: c.expectedSource, actual: failed.detail }
      : null,
  };
}

function finiteCheck(state: GameState, checks: GameplayCaseResult['checks']): void {
  checks.push({
    id: 'execution:finite-counters',
    verdict: finiteAll({ counters: state.counters, player: state.player }) ? 'PASS' : 'FAIL',
    detail: 'counters and player pools are finite',
  });
}

function timeCheck(state: GameState, startedAtUs: number, checks: GameplayCaseResult['checks']): void {
  const us = Math.round(state.clockSec * 1e6 - startedAtUs);
  checks.push({
    id: 'execution:positive-time',
    verdict: us > 0 ? 'PASS' : 'FAIL',
    detail: `${us} simulated microseconds`,
  });
}

function runField(c: GameplayCase, seed: number, simSeconds: number): GameplayCaseResult {
  const checks = emptyChecks();
  const log: RunLog = { trace: [] };
  const state = baseState(seed, c.zone);
  let source = '';
  try {
    const resolved = fieldSource(c);
    source = resolved.variant;
  } catch (error) {
    checks.push({ id: 'source:legacy-resolver', verdict: 'FAIL', detail: (error as Error).message });
  }
  standOnSub(state, c.zone, c.subzone!);
  state.hunting = true;
  const startedAtUs = Math.round(state.clockSec * 1e6);
  const before = {
    kills: state.counters.kills,
    damage: state.counters.damage ?? 0,
    xp: state.player.xp,
    pushes: state.counters.pushes ?? 0,
  };
  const seen = new Set<string>();
  const arena = createCombatArena();
  for (let second = 0; second < simSeconds; second++) {
    tick(state, { online: true, arena, autoSkills: true });
    collectVariants(state, seen);
    log.trace.push({ sec: state.clockSec, kills: state.counters.kills, hp: state.player.hp, group: state.group.map((m) => m.id).sort() });
  }
  timeCheck(state, startedAtUs, checks);
  finiteCheck(state, checks);
  const elapsed = Math.max(1, state.clockSec - startedAtUs / 1e6);
  const kills = state.counters.kills - before.kills;
  const damage = (state.counters.damage ?? 0) - before.damage;
  checks.push({
    id: 'state:transition',
    verdict: kills > 0 || damage > 0 || seen.size > 0 ? 'PASS' : 'FAIL',
    detail: `${kills} kills, ${damage.toFixed(1)} damage, ${seen.size} sources observed`,
  });
  if (source) checks.push({ id: 'source:legacy-resolver', verdict: 'PASS', detail: `frozen source ${source}` });
  return resultOf(c, 'controlled-build', seed, startedAtUs, state, seen, checks, {
    kills: { value: kills, unit: 'kills' },
    dps: { value: damage / elapsed, unit: 'damage-per-second' },
    xp: { value: state.player.xp - before.xp, unit: 'xp' },
    deaths: { value: (state.counters.pushes ?? 0) - before.pushes, unit: 'count' },
    ttk: kills > 0
      ? { value: elapsed / kills, unit: 'seconds-per-kill' }
      : { value: null, unit: 'seconds-per-kill', censored: true, observedSeconds: elapsed },
  }, log, true);
}

function runSpecial(c: GameplayCase, seed: number, simSeconds: number): GameplayCaseResult {
  const checks = emptyChecks();
  const log: RunLog = { trace: [] };
  // The case key keeps the frozen probe zone; the exact special is invoked in its authored Zone.
  const row = c.rank === 'boss'
    ? (E.mob.bosses as any[]).find((entry) => entry.zone === c.zone)
    : (E.mob.uniques as any[]).find((entry) => entry.name === c.expectedSource);
  const zoneId = row?.zone ?? c.zone;
  const state = baseState(seed, zoneId);
  const startedAtUs = Math.round(state.clockSec * 1e6);
  let mob: Mob;
  try {
    mob = spawnMob(mulberry32(seed ^ 0x9e3779b9), zoneId, c.rank === 'boss' ? 'boss' : 'normal', undefined, null, {
      allowWildUnique: false,
      forceSpecial: { rank: c.rank!, name: c.expectedSource },
    });
    checks.push({ id: 'source:special', verdict: 'PASS', detail: `${c.rank} ${c.expectedSource} lv${mob.level}` });
  } catch (error) {
    checks.push({ id: 'source:special', verdict: 'FAIL', detail: (error as Error).message });
    return resultOf(c, 'mechanic-probe', seed, startedAtUs, state, new Set(), checks, {}, log, true);
  }
  state.group = [mob];
  const arena = createCombatArena();
  const seen = new Set<string>([mob.variant ?? c.expectedSource]);
  let terminalSec: number | null = null;
  for (let second = 0; second < simSeconds; second++) {
    tick(state, { online: true, arena, autoSkills: true });
    log.trace.push({ sec: state.clockSec, mobHp: mob.hp, playerHp: state.player.hp, group: state.group.length });
    if (mob.hp <= 0 || !state.group.some((m) => m.id === mob.id) || state.player.hp <= 0) {
      terminalSec = state.clockSec;
      break;
    }
  }
  timeCheck(state, startedAtUs, checks);
  finiteCheck(state, checks);
  const elapsed = Math.max(1, state.clockSec - startedAtUs / 1e6);
  checks.push({
    id: 'state:transition',
    verdict: mob.hp < mob.hpMax || state.player.hp <= 0 ? 'PASS' : 'FAIL',
    detail: `mob hp ${mob.hp.toFixed(1)}/${mob.hpMax} player hp ${state.player.hp.toFixed(1)}`,
  });
  return resultOf(c, 'mechanic-probe', seed, startedAtUs, state, seen, checks, {
    duration: { value: elapsed, unit: 'seconds' },
    mobHp: { value: mob.hp, unit: 'hp' },
    playerHp: { value: state.player.hp, unit: 'hp' },
    cleared: terminalSec != null && mob.hp <= 0
      ? { value: 1, unit: 'count' }
      : { value: null, unit: 'count', censored: true, observedSeconds: elapsed },
  }, log, true);
}

function fieldworkSignature(state: GameState): Record<string, unknown> {
  return {
    materials: state.fieldwork.materials,
    foods: state.fieldwork.foods,
    skills: Object.fromEntries(Object.entries(state.fieldwork.skills).map(([id, skill]) => [id, { xp: skill.xp, mastery: skill.mastery }])),
  };
}

function runGather(c: GameplayCase, seed: number, simSeconds: number): GameplayCaseResult {
  const checks = emptyChecks();
  const log: RunLog = { trace: [] };
  const site = roadSites().find((row) => row.id === c.siteId);
  if (!site || site.site !== c.site) {
    checks.push({ id: 'source:site', verdict: 'FAIL', detail: `unknown authored site ${c.siteId}` });
    return resultOf(c, 'controlled-build', seed, 0, baseState(seed, c.zone), new Set(), checks, {}, log, true);
  }
  const state = baseState(seed, site.zone);
  state.cell = { q: site.q, r: site.r, sub: null, site: c.site! };
  state.zone = site.zone;
  const actionKind = c.site === 'fishing' ? 'fish' : c.site!;
  const action = startFieldAction(state, actionKind);
  checks.push({
    id: 'source:site',
    verdict: action.ok ? 'PASS' : 'FAIL',
    detail: action.ok ? `${c.site} accepted on ${site.id}` : `refused: ${action.why}`,
  });
  const startedAtUs = Math.round(state.clockSec * 1e6);
  const before = structuredClone(fieldworkSignature(state));
  const beforeNextAt = state.fieldwork.action?.nextAt ?? null;
  const rng = mulberry32(seed ^ 0x5bf03635);
  const arena = createCombatArena();
  let interruptedAt: number | null = null;
  for (let second = 0; second < simSeconds; second++) {
    if (c.gatherMode === 'world') {
      tick(state, { online: true, arena, autoSkills: true });
    } else {
      state.clockSec += 1;
      tickFieldwork(state, rng);
    }
    const active = state.fieldwork.action;
    log.trace.push({ sec: state.clockSec, action: active?.kind ?? null, nextAt: active?.nextAt ?? null });
    if (action.ok && !active && interruptedAt == null) interruptedAt = state.clockSec;
  }
  timeCheck(state, startedAtUs, checks);
  finiteCheck(state, checks);
  const after = fieldworkSignature(state);
  const delta = (key: 'materials' | 'foods') => {
    const a = before[key] as Record<string, number>;
    const b = after[key] as Record<string, number>;
    return Object.keys({ ...a, ...b }).reduce((sum, id) => sum + (Number(b[id] ?? 0) - Number(a[id] ?? 0)), 0);
  };
  const skillXp = Object.keys(after.skills as Record<string, { xp: number }>).reduce((sum, id) => {
    const a = (before.skills as any)[id]?.xp ?? 0;
    const b = (after.skills as any)[id]?.xp ?? 0;
    return sum + (b - a);
  }, 0);
  const paidUnits = delta('materials') + delta('foods');
  const interval = c.site === 'fishing'
    ? (E.fieldwork as any).fishing.interval_sec
    : (E.fieldwork as any).actions[c.site!].interval_sec;
  const finalNextAt = state.fieldwork.action?.nextAt ?? null;
  const cycles = beforeNextAt != null && finalNextAt != null ? Math.max(0, Math.round((finalNextAt - beforeNextAt) / interval)) : 0;
  checks.push({
    id: 'state:transition',
    verdict: paidUnits > 0 || cycles > 0 || interruptedAt != null ? 'PASS' : 'FAIL',
    detail: `${cycles} completed cycles, ${paidUnits} paid units, ${interruptedAt != null ? 'interrupted' : 'uninterrupted'}`,
  });
  return resultOf(c, 'controlled-build', seed, startedAtUs, state, new Set(), checks, {
    completedCycles: { value: cycles, unit: 'cycles' },
    paidUnits: { value: paidUnits, unit: 'units' },
    interruptionSeconds: { value: interruptedAt == null ? 0 : Math.max(0, state.clockSec - interruptedAt), unit: 'seconds' },
    skillXp: { value: skillXp, unit: 'xp' },
  }, log, true);
}

export function runGameplayCase(c: GameplayCase, seed: number, simSeconds: number): GameplayCaseResult {
  if (c.kind === 'field') return runField(c, seed, simSeconds);
  if (c.kind === 'special') return runSpecial(c, seed, simSeconds);
  return runGather(c, seed, simSeconds);
}

export interface GameplayRunOptions {
  preset: 'smoke' | 'full';
  mode: 'controlled' | 'natural';
  seeds: number[];
  simSeconds: number;
  maxWallMs: number;
  /** A short window proves the cutoff path reports INCOMPLETE rather than PASS. */
  truncateAfterMs?: number | null;
}

export function runGameplayWorkload(options: GameplayRunOptions): { cases: GameplayCaseResult[]; missing: string[]; cutoff: boolean } {
  const cases = buildGameplayCases(options.preset);
  const results: GameplayCaseResult[] = [];
  const started = Date.now();
  const budget = options.truncateAfterMs ?? options.maxWallMs;
  for (const seed of options.seeds) {
    for (const c of cases) {
      if (Date.now() - started > budget) {
        const missing = options.seeds
          .slice(options.seeds.indexOf(seed))
          .flatMap((s) => cases.slice(cases.indexOf(c)).map((entry) => `${entry.caseId}@${s}`));
        return { cases: results, missing, cutoff: true };
      }
      const result = runGameplayCase(c, seed, options.simSeconds);
      results.push(options.mode === 'natural' ? { ...result, mode: 'natural-journey' } : result);
    }
  }
  return { cases: results, missing: [], cutoff: false };
}

export { digest as gameplayDigest };
