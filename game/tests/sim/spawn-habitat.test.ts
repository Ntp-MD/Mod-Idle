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
