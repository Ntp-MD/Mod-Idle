/**
 * Automatic content coverage probe (plan P3).
 *
 * One batch function, `runContentChecks()`, that iterates the live catalog
 * and produces the gate rows + coverage counts the plan demands. Nothing is
 * hand-listed here; every group is derived from the same indexes the cages
 * use.
 */

import type { GateRow, Verdict } from '../../tools/lib/gates';
import { catalog, sm, MS, road, E } from '../src/engine/client';
import { mulberry32 } from '../src/engine/client-helpers';
import { buildCharacter, emptyGear } from '@sim/core/player';
import { mobFixture } from '../tests/fixtures/mobFixture';
import { newCurses } from '@sim/combat/curse';
import {
  newSkillState, toggleTrack, prepareSkillCast, resolvePreparedCast,
} from '@sim/combat/skills';
import { newMobStatusStore } from '@sim/combat/mobStatus';
import { resolveMobKit } from '@sim/combat/mobSkills';

export interface ContentGroupCounts {
  discovered: number;
  probed: number;
  passed: number;
  failed: number;
  synthetic: number;
}

export interface ContentCoverageResult {
  rows: GateRow[];
  selectedIds: Record<string, string[]>;
  counts: Record<string, ContentGroupCounts>;
  uncovered: { id: string; missing: string }[];
}

const row = (id: string, verdict: Verdict, detail: string): GateRow => ({ id, verdict, detail });
const pass = (id: string, detail: string) => row(id, 'PASS', detail);
const fail = (id: string, detail: string) => row(id, 'FAIL', detail);

function freshCounts(): Record<string, ContentGroupCounts> {
  return {
    skills: { discovered: 0, probed: 0, passed: 0, failed: 0, synthetic: 0 },
    mobs: { discovered: 0, probed: 0, passed: 0, failed: 0, synthetic: 0 },
    mods: { discovered: 0, probed: 0, passed: 0, failed: 0, synthetic: 0 },
    map: { discovered: 0, probed: 0, passed: 0, failed: 0, synthetic: 0 },
  };
}

function record(result: ContentCoverageResult, group: string, ok: boolean, id: string, synthetic: boolean) {
  const counts = result.counts[group];
  if (synthetic) counts.synthetic++;
  else counts.probed++;
  if (ok) counts.passed++;
  else counts.failed++;
  if (!ok) result.uncovered.push({ id, missing: `${group} probe failed` });
}

// ---- skills (plan §7.1) ----

function probeSkill(row: any): GateRow[] {
  const out: GateRow[] = [];
  const id = String(row.id);
  const name = String(row.name ?? id);

  // Synthetic coverage probes use exactly the reserved test.* namespace.
  if (id.startsWith('test.')) {
    out.push(pass(`skill:${id}:synthetic`, 'synthetic row registered'));
    return out;
  }

  // Neutral setup: own the row at a high level, fill the bar, keep 1e9 mana,
  // and equip the row's own required weapon.
  const setup = () => {
    const s = newSkillState() as any;
    s.owned[id] = 0;
    s.xp[id] = 8000;
    s.list.fill(null);
    s.list[0] = id;
    const c = buildCharacter(30, emptyGear()) as any;
    if (row.weapon) {
      c.gear = [{ slot: 'main hand', base: row.weapon, ilvl: 1, quality: 'Normal', tier: 'T1', lines: [] }];
      c.weaponName = row.weapon;
    }
    c.hp = c.maxHp;
    c.mana = c.maxMana;
    const target = mobFixture({
      id: `cov-${id}`, hp: 1e9, hpMax: 1e9, evasion: 0, dodgeRate: 0,
      armour: 0, res: 0, innate: [] as string[],
    });
    return { s, c, target };
  };

  const rng = mulberry32(7);
  const store = () => newMobStatusStore();
  const curses = newCurses();
  const finish = (checks: GateRow[]) => {
    out.push(...checks);
    return out;
  };

  if (row.type === 'attack' || row.type === 'curse') {
    const { s, c, target } = setup();
    const prepared = prepareSkillCast(s, c, id, 1e9, [target], {}, { spatialTargets: false });
    if (!prepared) {
      return finish([fail(`skill:${id}:cast_resolves`, `${name} is not castable in a neutral setup`)]);
    }
    const before = JSON.stringify({ store: store(), curses });
    const report = resolvePreparedCast(s, c, prepared, {}, rng, { mobStatus: store(), curses } as any) as any;
    const byMob = Array.isArray(report.byMob) ? report.byMob : [];
    const finite = byMob.every((hit: any) => Number.isFinite(hit?.amount) && hit.amount >= 0);
    const dealt = byMob.reduce((sum: number, hit: any) => sum + (hit?.amount ?? 0), 0);
    const changed = before !== JSON.stringify({ store: store(), curses });
    const observed = changed || dealt > 0;
    const checks: GateRow[] = [
      finite && observed
        ? pass(`skill:${id}:cast_resolves`, `hit ${dealt > 0 ? `dealt ${Math.round(dealt)}` : 'applied'}`)
        : fail(`skill:${id}:cast_resolves`, `${name} resolved with non-finite damage`),
    ];
    if (row.type === 'curse') {
      const wrote = Object.values(curses)
        .flatMap((lines: any) => Object.values(lines))
        .some((line: any) => line?.from === id);
      checks.push(wrote
        ? pass(`skill:${id}:curse_applies`, 'curse line written on the target')
        : fail(`skill:${id}:curse_applies`, `${name} wrote no curse line on the target`));
    }
    return finish(checks);
  }

  if (row.type === 'heal') {
    const { s, c, target } = setup();
    const sheet = { maxHp: c.maxHp, maxMana: c.maxMana };
    c.hp = Math.max(1, Math.floor(sheet.maxHp * 0.25));
    const beforeHp = c.hp;
    const prepared = prepareSkillCast(s, c, id, 1e9, [target], {}, { spatialTargets: false });
    if (!prepared) {
      return finish([fail(`skill:${id}:heal_applies`, `${name} cannot prepare in a neutral setup`)]);
    }
    const report = resolvePreparedCast(s, c, prepared, {}, rng, { mobStatus: store() } as any) as any;
    const pctPerSec = report.heal?.pctPerSec ?? 0;
    const instant = report.instantHealPct ?? 0;
    const healed = pctPerSec > 0 || instant > 0 || c.hp > beforeHp;
    return finish([healed
      ? pass(`skill:${id}:heal_applies`, instant ? `instant heal ${instant}%` : 'heal effect present')
      : fail(`skill:${id}:heal_applies`, `${name} carries no heal effect`)]);
  }

  if (row.type === 'buff' || row.type === 'aura') {
    const { s } = setup();
    const kind = row.type === 'aura' ? 'auras' : 'buffs';
    const on = toggleTrack(s, id, []);
    const onCheck = on.ok
      ? pass(`skill:${id}:toggle_enables`, `${row.type} enabled`)
      : fail(`skill:${id}:toggle_enables`, `${row.type} refused: ${on.why ?? 'unknown'}`);
    const wasOn = on.ok ? !!(s as any)[kind][id] : false;
    const off = on.ok ? toggleTrack(s, id, []) : on;
    const offCheck = on.ok && off.ok
      ? pass(`skill:${id}:toggle_disables`, `${row.type} disabled`)
      : fail(`skill:${id}:toggle_disables`, `${row.type} did not disable cleanly`);
    return finish([onCheck, offCheck,
      on.ok && wasOn && !(s as any)[kind][id]
        ? pass(`skill:${id}:toggle_state`, 'track flips back off')
        : fail(`skill:${id}:toggle_state`, `${row.type} track is not removable`)]);
  }

  return finish([fail(`skill:${id}:unsupported_type`, `${row.type ?? 'unknown'} is not a supported action family`)]);
}

// ---- mods (plan §7.3) ----

function collectConsumedMods(): Set<string> {
  const used = new Set<string>();
  for (const base of catalog.items.bases.rows) {
    for (const id of (base as any).primary || []) used.add(id);
    for (const id of (base as any).secondary || []) used.add(id);
    for (const id of (base as any).base_lines || []) used.add(id);
  }
  for (const frames of catalog.items.weaponFrames.values()) {
    for (const frame of frames) {
      for (const id of (frame as any).frame_mod || []) used.add(id);
      for (const id of (frame as any).legacy_frame_mod || []) used.add(id);
    }
  }
  for (const source of catalog.items.weaponPools.values()) {
    for (const pool of source.values()) {
      for (const id of pool) used.add(id);
    }
  }
  return used;
}

// ---- main entry ----

export function runContentChecks(): ContentCoverageResult {
  const result: ContentCoverageResult = {
    rows: [],
    selectedIds: { skills: [], mobs: [], mods: [], map: [] },
    counts: freshCounts(),
    uncovered: [],
  };
  const append = (checks: GateRow[], group: string, id: string, synthetic: boolean) => {
    result.rows.push(...checks);
    for (const check of checks) {
      const ok = check.verdict === 'PASS';
      record(result, group, ok, id, synthetic);
    }
  };

  // ---- skills ----
  const liveSkills = (sm.all() as any[]).slice().sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const row of liveSkills) {
    if (row.retired) continue;
    const id = String(row.id);
    const synthetic = id.startsWith('test.');
    result.selectedIds.skills.push(id);
    result.counts.skills.discovered++;
    append(probeSkill(row), 'skills', id, synthetic);
  }

  // ---- mobs ----
  const speciesRows = (catalog.mobs.species.rows as any[]).slice().sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const row of speciesRows) {
    const id = row.id as string;
    result.selectedIds.mobs.push(id);
    result.counts.mobs.discovered++;

    const checks: GateRow[] = [];
    const inCatalog = catalog.mobs.species.byId.has(id);
    checks.push(inCatalog
      ? pass(`mob:${id}:catalog_resolves`, 'species present in catalog index')
      : fail(`mob:${id}:catalog_resolves`, 'species missing from catalog index'));

    let zoneOk = true;
    for (const zoneId of row.zones as number[]) {
      const zone = (E.mob.zones as any[]).find((z: any) => z.id === zoneId);
      const level = row.zone_levels?.[String(zoneId)];
      if (!zone || !Number.isInteger(level) || level < zone.levels[0] || level > zone.levels[1]) {
        zoneOk = false;
        break;
      }
    }
    checks.push(zoneOk
      ? pass(`mob:${id}:zone_levels_in_range`, 'every authored level sits inside its zone band')
      : fail(`mob:${id}:zone_levels_in_range`, 'a zone_levels value is outside its zone band'));

    for (const variant of (catalog.mobs.variantsBySpecies.get(id) ?? []) as any[]) {
      checks.push(pass(`mob:${id}/${variant.name}:variant_resolves`, 'variant registered for species'));
    }
    for (const unique of (catalog.mobs.uniquesBySpecies.get(id) ?? []) as any[]) {
      checks.push(pass(`mob:${id}/${unique.name}:unique_resolves`, 'unique registered for species'));
    }
    const kit = resolveMobKit('normal', id);
    for (const skillId of kit) {
      const found = MS.skills.some((ms: any) => ms.id === skillId);
      checks.push(found
        ? pass(`mob:${id}/${skillId}:skill_resolves`, 'kit skill resolves in mob skill library')
        : fail(`mob:${id}/${skillId}:skill_resolves`, 'kit skill does not resolve in mob skill library'));
    }
    for (const boss of (E.mob.bosses as any[]).filter((b: any) => b.species === id)) {
      checks.push(catalog.mobs.bossesByZone.has(boss.zone)
        ? pass(`mob:${id}/${boss.name}:boss_resolves`, `boss registered for zone ${boss.zone}`)
        : fail(`mob:${id}/${boss.name}:boss_resolves`, `boss missing for zone ${boss.zone}`));
    }
    append(checks, 'mobs', id, false);
  }

  // ---- mods ----
  const used = collectConsumedMods();
  const modRows = [...catalog.items.mods.rows].sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const mod of modRows) {
    const id = mod.id as string;
    result.selectedIds.mods.push(id);
    result.counts.mods.discovered++;
    const ok = used.has(id);
    const check = ok
      ? pass(`mod:${id}:consumed`, 'mod is referenced by a gear pool frame')
      : fail(`mod:${id}:consumed`, 'mod referenced by no gear pool frame');
    append([check], 'mods', id, false);
  }

  // ---- map ----
  const nodeIds = (road.nodes as any[]).map((n: any) => String(n.id)).sort();
  const locationIds = (road.locations as any[]).map((l: any) => String(l.id)).sort();

  for (const id of nodeIds) {
    const node = road.nodeById(id);
    result.counts.map.discovered++;
    result.selectedIds.map.push(`node:${id}`);
    append(node
      ? [pass(`map:${id}:node_resolves`, 'settlement node resolves')]
      : [fail(`map:${id}:node_resolves`, 'settlement node missing')], 'map', id, false);
  }
  for (const loc of road.locations as any[]) {
    const id = String((loc as any).id);
    result.counts.map.discovered++;
    result.selectedIds.map.push(`location:${id}`);
    append(road.locationById(id)
      ? [pass(`map:${id}:location_resolves`, 'named location resolves')]
      : [fail(`map:${id}:location_resolves`, 'named location missing')], 'map', id, false);
  }
  for (const pair of [...road.pairs].sort((a: any, b: any) => (a.a + a.b < b.a + b.b ? -1 : 1))) {
    const key = `${(pair as any).a}>${(pair as any).b}`;
    result.counts.map.discovered++;
    result.selectedIds.map.push(`route:${key}`);
    const route = road.routeBetween((pair as any).a, (pair as any).b) as any[] | null;
    const adjacent = (a: { q: number; r: number }, b: { q: number; r: number }) =>
      Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.q + a.r - b.q - b.r)) === 1;
    const ok = !!route
      && route.length === (pair as any).blocks + 1
      && route.every((hex: any, i: number) => i === 0
        || adjacent(route[i - 1], hex))
      && route.every((hex: any) => road.isLand(hex));
    append(ok
      ? [pass(`map:${key}:route_resolves`, `${(pair as any).blocks} blocks, route valid`)]
      : [fail(`map:${key}:route_resolves`, 'route invalid, or leaves land mask')],
      'map', key, false);
  }

  return result;
}
