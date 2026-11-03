import { describe, expect, it } from 'vitest';
import { E, eng, TOWN, fieldwork } from '../../src/engine/client';
import { catchUp, catchUpAsync, newGame, setLevel, tick } from '@sim/core/game';
import { exportJson, importJson } from '../../src/state/save';
import { settlementCell, startWalk } from '@sim/world/road';
import { resolveTravelEvent } from '@sim/world/fieldwork';

describe('fixed zone rosters', () => {
  it('spawns every normal and Elite at its Species-authored level inside the displayed zone band', () => {
    const rows = eng.mobRoster();
    for (const zone of E.mob.zones as any[]) {
      for (const species of (E.mob.species as any[]).filter((entry) => entry.zones.includes(zone.id))) {
        const level = species.zone_levels[zone.id];
        expect(level).toBeGreaterThanOrEqual(zone.levels[0]);
        expect(level).toBeLessThanOrEqual(zone.levels[1]);
        const normal = rows.find((row: any) => row.zone === zone.id && row.speciesId === species.id && !/Elite|Unique|Boss/.test(row.kind));
        const elite = rows.find((row: any) => row.zone === zone.id && row.speciesId === species.id && row.kind === E.mob.elite.name);
        expect(normal?.level).toBe(level);
        if (species.sizes.includes('large')) expect(elite?.level).toBe(level);
        const variant = eng.variantsInZone(species.id, zone.id)[0];
        const body = species.sizes.includes('medium') ? 'medium' : species.sizes[0];
        expect(eng.spawnAt(zone.id, body, species.id, undefined, variant?.core).level).toBe(level);
      }
    }
  });

  it('keeps the analysis roster Elite HP and PS equal to the live spawn formula', () => {
    for (const row of eng.mobRoster().filter((entry: any) => entry.kind === E.mob.elite.name) as any[]) {
      const flat = eng.LG.hp_per_level * (row.level - 1) + row.vit * eng.K.K_VIT_HP;
      const expectedHp = (eng.mobHpAt(row.level) + flat) * E.mob.elite.hp;
      const variant = eng.variantsInZone(row.speciesId, row.zone)[0]!;
      const expectedPs = eng.mobPsAt(row.level) * E.mob.elite.ps / eng.zoneBodyFactor(row.zone)
        * eng.speciesPsMult(row.zone, row.speciesId, variant.core, variant.damage);
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

