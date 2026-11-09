import { describe, expect, it } from 'vitest';
import { spawnMob } from '@sim/core/game';
import { E, eng } from '../../src/engine/client';
import { mulberry32 } from '../../src/engine/client-helpers';

function batch(seed: number, zone: number, n: number, standTerrain?: string | null, standSub?: number | null) {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, () =>
    spawnMob(rng, zone, 'normal', undefined, standSub ?? null,
      standTerrain === undefined ? {} : { standTerrain }).speciesId as string);
}

describe('habitat-weighted spawns', () => {
  it('keeps Eastgate fields to meadow wildlife, orchard pests and camp raiders', () => {
    const fields = [
      ['beetle', 'hornet', 'wolf'],
      ['slime', 'spider', 'human'],
      ['goblin', 'kobold', 'orc'],
    ];
    const zone = E.mob.zones.find(row => row.id === 1)!;
    for (const [index, expected] of fields.entries()) {
      expect(new Set(zone.subzones[index].species)).toEqual(new Set(expected));
      expect(new Set(eng.placementsIn(1, index + 1).map(row => row.species))).toEqual(new Set(expected));
      for (const kind of ['normal', 'elite'] as const) {
        const rng = mulberry32(5173);
        for (let i = 0; i < 64; i++) {
          const mob = spawnMob(rng, 1, kind, undefined, index);
          expect(expected, `${zone.subzones[index].name}: ${mob.speciesId}`).toContain(mob.speciesId);
        }
      }
    }
    expect(E.mob.uniques.filter(row => row.zone === 1).every(row => ['beetle', 'goblin'].includes(row.species))).toBe(true);
  });

  it('weights each named environment against its actual map terrain', () => {
    for (const location of E.road.locations.filter(row => row.kind === 'sub')) {
      const sub = eng.zoneById(location.zone).subzones![location.index];
      expect(eng.terrainOfEnvironment(sub.environment), sub.name).toBe(location.terrain);
      expect(eng.spawnSubzoneWeight(sub, location.terrain), sub.name).toBe(3);
    }
  });

  it('keeps the stood sub-zone winning when present', () => {
    for (const zone of E.mob.zones) for (const [index, side] of (zone.subzones ?? []).entries()) {
      const mobs = batch(11, zone.id, 10, 'fixture-nonmatching-terrain', index);
      const pool = new Set(side.species);
      expect(mobs.every(id => pool.has(id)), side.name).toBe(true);
    }
  });

  it('weighs matching ground up without making anything unspawnable', () => {
    const match = eng.spawnSpeciesWeight(['fixture-ground'], 'fixture-ground');
    const other = eng.spawnSpeciesWeight(['fixture-ground'], 'fixture-other-ground');
    expect(match).toBeGreaterThan(other);
    expect(other).toBeGreaterThan(0);
    expect(eng.spawnSpeciesWeight(undefined, 'fixture-ground')).toBeGreaterThan(0);
    expect(eng.spawnSpeciesWeight(['fixture-ground'], null)).toBe(1);
    for (const [environment, terrain] of Object.entries(E.mob.environment_terrain)) {
      const matching = eng.spawnSubzoneWeight({ environment }, terrain);
      const outside = eng.spawnSubzoneWeight({ environment }, 'fixture-other-ground');
      expect(matching, environment).toBeGreaterThan(outside);
      expect(outside, environment).toBeGreaterThan(0);
    }
  });

  it('rolls even without standing terrain, exactly as before', () => {
    for (const zone of E.mob.zones) {
      const a = batch(99, zone.id, 10);
      const b = batch(99, zone.id, 10);
      expect(a).toEqual(b);
      expect(a.every(id => E.mob.species.some(row => row.id === id && row.zones.includes(zone.id)))).toBe(true);
    }
  });
});
