import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createWorld } from '../../../engine/world.ts';
import { HEX_DIRECTIONS as HEX_FROM_ROAD, hexDistance as DIST_FROM_ROAD, hexPath as PATH_FROM_ROAD } from '../../../engine/road.ts';
import { HEX_DIRECTIONS, hexDistance, hexPath } from '../../../engine/hex.ts';
import { ED, E, TOWN } from '../../src/engine/client';

const world = createWorld(ED, TOWN.settlements);

describe('hex geometry extraction', () => {
  it('re-exports the same geometry from engine/road.ts', () => {
    expect(HEX_FROM_ROAD).toBe(HEX_DIRECTIONS);
    expect(DIST_FROM_ROAD).toBe(hexDistance);
    expect(PATH_FROM_ROAD).toBe(hexPath);
    expect(hexDistance({ q: 0, r: 0 }, { q: 4, r: -2 })).toBe(4);
    expect(hexPath({ q: 0, r: 0 }, { q: 0, r: 0 })).toEqual([{ q: 0, r: 0 }]);
  });
});

describe('canonical world resolution', () => {
  it('indexes all 676 land cells with stable location ids', () => {
    expect(world.cells()).toHaveLength(676);
    expect(world.locations).toHaveLength(129);
    for (const loc of E.road.locations) {
      const cell = world.cellAt({ q: loc.q, r: loc.r })!;
      expect(cell.locationId, loc.id).toBe(loc.id);
      expect(world.locationById(loc.id)?.id).toBe(loc.id);
      expect(cell.zoneId).toBe(loc.zone);
      expect(cell.terrainId).toBe(loc.kind === 'town' ? 'town' : loc.terrain);
      expect(cell.features).toHaveLength(1);
      expect(cell.features[0].id).toBe(loc.id);
    }
    expect(world.locationById('no-such-place')).toBeNull();
  });

  it('resolves named sub-zones with their own habitat', () => {
    const cell = world.cellAt({ q: 0, r: -1 })!;
    expect(cell.locationId).toBe('zone:1:sub:0');
    expect(cell.terrainId).toBe('grass');
    expect(cell.zoneId).toBe(1);
    expect(cell.habitat).toEqual({ zoneId: 1, subzoneIndex: 0 });
    expect(world.habitatOf({ q: 0, r: -1 })).toEqual({ zoneId: 1, subzoneIndex: 0 });
    // A town cell is safe ground: no spawn habitat.
    expect(world.cellAt({ q: 0, r: 0 })!.terrainId).toBe('town');
    expect(world.cellAt({ q: 0, r: 0 })!.habitat).toBeNull();
  });

  it('resolves bare ground from its owner with an inherited habitat', () => {
    const cell = world.cellAt({ q: -1, r: -1 })!;
    expect(cell.locationId).toBeNull();
    expect(cell.features).toEqual([]);
    expect(world.ownerOf({ q: -1, r: -1 }).id).toBe('eastgate');
    expect(cell.zoneId).toBe(1);
    expect(cell.terrainId).toBe('grass');
    expect(cell.habitat?.zoneId).toBe(1);
    // The habitat's named side carries the printed bare terrain.
    const side = world.locationAt({ q: 0, r: -1 })!;
    expect(side.id).toBe('zone:1:sub:0');
    expect(world.bareTerrain('eastgate', { q: -1, r: -1 })).toBe(cell.terrainId);
    expect(world.bareTerrain('eastgate', { q: 99, r: -99 })).toBe(world.bareTerrain('eastgate', { q: 99, r: -99 }));
  });

  it('fails explicitly on sea and invalid coordinates', () => {
    for (const sea of [{ q: 999, r: -999 }, { q: -100, r: 100 }]) {
      expect(world.cellAt(sea)).toBeNull();
      expect(world.locationAt(sea)).toBeNull();
      expect(world.terrainOf(sea)).toBeNull();
      expect(world.habitatOf(sea)).toBeNull();
      expect(world.isLand(sea)).toBe(false);
    }
    expect(() => world.cellAt({ q: 0.5, r: 0 })).toThrow(TypeError);
    expect(() => world.cellAt({ q: Number.NaN, r: 0 })).toThrow(TypeError);
    expect(() => world.ownerOf({ q: 0, r: Number.POSITIVE_INFINITY })).toThrow(TypeError);
  });

  it('breaks ownership ties by the lowest zone, not list order', () => {
    const fixture = {
      road: {
        nodes: [{ id: 'a', q: 0, r: 0 }, { id: 'b', q: 2, r: 0 }],
        block_sec: 1,
        land: [[0, 0], [1, 0], [2, 0], [0, -1], [2, -1]] as [number, number][],
        locations: [
          { id: 'zone:1:town', zone: 1, kind: 'town', index: 0, q: 0, r: 0, terrain: 'town' },
          { id: 'zone:2:town', zone: 2, kind: 'town', index: 0, q: 2, r: 0, terrain: 'town' },
          { id: 'zone:1:sub:0', zone: 1, kind: 'sub', index: 0, q: 0, r: -1, terrain: 'grass' },
          { id: 'zone:2:sub:0', zone: 2, kind: 'sub', index: 0, q: 2, r: -1, terrain: 'rock' },
        ],
      },
      mob: {
        zones: [
          { id: 1, subzones: [{ name: 'A' }] },
          { id: 2, subzones: [{ name: 'B' }] },
        ],
      },
    } as any;
    // Settlements listed high-zone first: the standing rule still gives the tie to zone 1.
    const w = createWorld(fixture, [{ id: 'b', zone: 2 }, { id: 'a', zone: 1 }]);
    expect(w.standingOrder).toEqual(['a', 'b']);
    expect(w.ownerOf({ q: 1, r: 0 }).id).toBe('a');
    expect(w.cellAt({ q: 1, r: 0 })!.zoneId).toBe(1);
    expect(w.cellAt({ q: 1, r: 0 })!.locationId).toBeNull();
    expect(w.bareTerrain('a', { q: 1, r: 0 })).toBe('grass');
    expect(w.bareTerrain('b', { q: 1, r: 0 })).toBe('rock');
  });

  it('keeps the 676-cell terrain/ownership baseline unchanged', () => {
    const rows = world.cells().map((cell) => [
      `${cell.coord.q},${cell.coord.r}`,
      cell.terrainId,
      world.ownerOf(cell.coord).id,
      cell.zoneId,
      cell.habitat?.subzoneIndex ?? -1,
    ].join(':')).sort();
    expect(rows).toHaveLength(676);
    expect(rows[0]).toBe('-1,-1:grass:eastgate:1:0');
    expect(rows[rows.length - 1]).toBe('9,2:marsh:wolf_cross:3:0');
    expect(createHash('sha256').update(rows.join('|')).digest('hex'))
      .toBe('51156092aaddf61a8c5c155af0ef6980d55ec4fe7afedefe5cccab5b72d67769');
  });
});
