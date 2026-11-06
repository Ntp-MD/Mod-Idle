import { describe, expect, it } from 'vitest';
import { E, eng, TOWN, fieldwork } from '../../src/engine/client';
import { catchUp, catchUpAsync, newGame, setLevel, spawnMob, tick } from '@sim/core/game';
import { mulberry32 } from '../../src/engine/client-helpers';
import { exportJson, importJson } from '../../src/state/save';
import { settlementCell, startWalk } from '@sim/world/road';
import { resolveTravelEvent } from '@sim/world/fieldwork';

describe('fixed zone rosters', () => {
  it('resolves every placement id and reference', () => {
    const ids = new Set<string>();
    for (const row of E.mob.variants as any[]) {
      expect(ids.has(row.id), row.id).toBe(false);
      ids.add(row.id);
      expect(eng.placementById(row.id)).toBe(row);
      expect(E.mob.species.some((sp: any) => sp.id === row.species), row.id).toBe(true);
    }
  });

  it('keeps at least two levels of gap inside every Subzone and no more than two rows on a level', () => {
    for (const zone of E.mob.zones as any[]) {
      for (const [index, sub] of zone.subzones.entries()) {
        const rows = eng.placementsIn(zone.id, index + 1);
        expect(rows.length, `${zone.id}/${sub.name}`).toBeGreaterThan(0);
        const levels = [...new Set(rows.map((row: any) => row.level))].sort((a, b) => a - b);
        for (let i = 1; i < levels.length; i++) expect(levels[i] - levels[i - 1], `${zone.id}/${sub.name}`).toBeGreaterThanOrEqual(2);
        for (const level of levels) expect(rows.filter((row: any) => row.level === level).length).toBeLessThanOrEqual(2);
      }
    }
  });

  it('gives normal and Elite spawns the authored placement level, never the zone guide', () => {
    for (const zone of E.mob.zones as any[]) {
      for (const side of [null, ...zone.subzones.map((_: unknown, index: number) => index)]) {
        for (const kind of ['normal', 'elite'] as const) {
          const mob = spawnMob(mulberry32(77), zone.id, kind, undefined, side, { allowWildUnique: false });
          const row = eng.placementById(mob.placementId!);
          expect(mob.level).toBe(row.level);
          expect(row.zone).toBe(zone.id);
        }
      }
    }
  });

  it('keeps every visitor row on the five approved seams at weight 1–3', () => {
    const seams = new Set([3, 4, 6, 7, 9, 10, 12, 13, 15, 16]);
    for (const row of E.mob.variants as any[]) {
      if (row.role !== 'visitor') continue;
      expect(seams.has(row.zone), row.id).toBe(true);
      expect(row.weight).toBeLessThanOrEqual(3);
    }
  });

  it('keeps the analysis roster Elite HP and PS equal to the live spawn formula', () => {
    for (const row of eng.mobRoster().filter((entry: any) => entry.kind === E.mob.elite.name) as any[]) {
      const flat = eng.LG.hp_per_level * (row.level - 1) + row.vit * eng.K.K_VIT_HP;
      const expectedHp = (eng.mobHpAt(row.level) + flat) * E.mob.elite.hp;
      const placement = eng.placementById(row.placementId);
      const expectedPs = eng.mobPsAt(row.level) * E.mob.elite.ps / eng.zoneBodyFactor(row.zone)
        * eng.speciesPsMult(row.zone, row.speciesId, placement.core, placement.damage);
      expect(row.hpFrom).toBeCloseTo(expectedHp, 8);
      expect(row.ps).toBeCloseTo(expectedPs, 8);
    }
  });
});

describe('regional trail events', () => {
  it('forages the fixed regional food and names the zone', () => {
    const state = newGame(82);
    const localFood = fieldwork.F.regional_sources[state.zone].food;
    const event = resolveTravelEvent(state, () => 0);
    expect(event).toContain(eng.zoneById(state.zone).name);
    expect(state.fieldwork.foods[localFood]).toBeGreaterThan(0);
  });
});

describe('staying put without Forward travel', () => {
  it.each(['sync', 'async'] as const)('holds the current hunt during %s catch-up and starts no walk on return', async (mode) => {
    const state = newGame(87);
    const next = TOWN.settlements.find((entry: any) => entry.zone === 2)!;
    state.town.visited.push(next.id);
    setLevel(state, 11);
    const cell = structuredClone(state.cell);
    if (mode === 'sync') catchUp(state, 10);
    else await catchUpAsync(state, 10);
    expect(state.walk).toBeNull();
    expect(state.cell).toEqual(cell);
    expect(state.zone).toBe(1);

    const restored = importJson(exportJson(state));
    tick(restored, { online: true, autoSkills: false });
    expect(restored.walk).toBeNull();
  });

  it.each(['sync', 'async'] as const)('preserves an in-flight block timer through %s catch-up and reload', async (mode) => {
    const state = newGame(88);
    const next = TOWN.settlements.find((entry: any) => entry.zone === 2)!;
    expect(startWalk(state, settlementCell(next.id)!).ok).toBe(true);
    const walk = structuredClone(state.walk);
    if (mode === 'sync') catchUp(state, 10);
    else await catchUpAsync(state, 10);
    expect(state.walk).toEqual(walk);
    const restored = importJson(exportJson(state));
    expect(restored.walk).toEqual(walk);
    tick(restored, { online: true, autoSkills: false });
    expect(restored.walk?.blocksWalked).toBe(1);
  });

});

