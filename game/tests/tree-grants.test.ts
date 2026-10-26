import { describe, it, expect } from 'vitest';
import { createTree, type TreeSpec, type TreeGrant } from '../../engine/tree.ts';
import { MODS, eng, E } from '../src/engine/client';
import { emptyGear, sumLines } from '../src/sim/core/player';

/**
 * The targeted Core/Element grants: a grant that names a stat feeds that stat alone, a grant that
 * names an Element joins that Element's pool and never the weapon's own bucket, and any illegal
 * metadata is refused by name when the spec builds ( Packet A ).
 */

const base = (nodes: TreeSpec['nodes'], extra: Partial<TreeSpec> = {}): TreeSpec => ({
  version: 2,
  meta: { note: 'a test tree' },
  points: { currencies: { tree: { base: 3, per_level: 2 }, attainment: { base: 0, sources: [] } } },
  node_kinds: {
    line: { ranks: 3, cost: 1, currency: 'tree' },
    notable: { ranks: 1, cost: 1, currency: 'tree' },
    keystone: { ranks: 1, cost: 1, currency: 'attainment' },
    capstone: { ranks: 1, cost: 1, currency: 'tree' },
  },
  keystone_groups: [],
  clusters: [],
  rank_tiers: { shallow: [0.033, 0.067, 0.1], deep: [0.067, 0.133, 0.2] },
  shallow_nodes: 1,
  layout: {
    algorithm: 'radial-topology', start: { x: 0, y: 0 }, wing_anchor_deg: { test: 0 },
    nodes_per_ring: 7, ring_gap: 14, arc_span_deg: 60, wing_clearance_deg: 6, node_radius: 4,
  },
  nodes,
  ...extra,
});

const line = (id: string, grants: TreeGrant[] = [{ id: 'attack_speed', values: [1, 2, 3] }], needs: string[] = ['start']): TreeSpec['nodes'][number] =>
  ({ id, wing: 'test', kind: 'line', needs, grants });

describe('a grant that names a stat feeds that stat alone', () => {
  it('carries the stat through linesOf and leaves every other Core flat at zero', () => {
    const spec = base([line('test.1', [{ id: 'stat_mod_flat', stat: 'str', values: [1, 2, 3] }])]);
    const model = createTree(spec, MODS);
    const lines = model.linesOf({ 'test.1': 1 });
    expect(lines).toEqual([{ id: 'stat_mod_flat', value: 1, stat: 'str' }]);
    const sheet = sumLines(emptyGear(), lines);
    expect(sheet.statBy.str.flat).toBe(1);
    for (const k of ['int', 'vit', 'agi', 'dex', 'wis', 'lck'] as const) expect(sheet.statBy[k].flat).toBe(0);
  });

  it('climbs the rank ladder at its own values', () => {
    const spec = base([line('test.1', [{ id: 'stat_mod_flat', stat: 'int', values: [1, 2, 3] }])]);
    const model = createTree(spec, MODS);
    expect(sumLines(emptyGear(), model.linesOf({ 'test.1': 3 })).statBy.int.flat).toBe(3);
    expect(model.byId['test.1'].max).toBe(Number(MODS.mods.find((m: any) => m.id === 'stat_mod_flat')?.max ?? -1)); // the real mods.json line maximum, unchanged by metadata
  });

  it('leaves the legacy reading alone: a stat_mod_flat that names no stat feeds every Core', () => {
    const spec = base([line('test.1', [{ id: 'stat_mod_flat', values: [1, 2, 3] }])]);
    const model = createTree(spec, MODS);
    const sheet = sumLines(emptyGear(), model.linesOf({ 'test.1': 1 }));
    for (const k of ['str', 'int', 'vit', 'agi', 'dex', 'wis', 'lck'] as const) expect(sheet.statBy[k].flat).toBe(1);
  });
});

describe('a grant that names an Element joins that Element only', () => {
  it('carries the element through linesOf and keeps the shared flat pool at zero', () => {
    const spec = base([line('test.1', [{ id: 'elemental_power_flat', element: 'fire', values: [8] }])]);
    const model = createTree(spec, MODS, E.elements.order);
    const lines = model.linesOf({ 'test.1': 1 });
    expect(lines).toEqual([{ id: 'elemental_power_flat', value: 8, element: 'fire' }]);
    const sheet = sumLines(emptyGear(), lines);
    expect(sheet.elemBy.fire.flat).toBe(8);
    expect(sheet.elemFlat).toBe(0);
  });

  it('raises Fire and never Cold, even when the held weapon is Cold', () => {
    const spec = base([line('test.1', [{ id: 'elemental_power_flat', element: 'fire', values: [8] }])]);
    const model = createTree(spec, MODS, E.elements.order);
    const sheet = sumLines(emptyGear(), model.linesOf({ 'test.1': 1 }));
    const power = eng.elementalPowerOf({
      intCore: 10, weaponElement: 'cold', flat: sheet.elemFlat, pct: sheet.elemPct,
      byElement: sheet.elemBy as Record<string, { flat: number; pct: number }>, herald: {},
    });
    expect(power.byElement.fire).toBe(8);
    expect(power.byElement.cold).toBeUndefined();
  });

  it('per-Element resistance lines harden that Element alone', () => {
    const spec = base([line('test.1', [{ id: 'elemental_resistance', element: 'fire', values: [16] }])]);
    const model = createTree(spec, MODS, E.elements.order);
    const sheet = sumLines(emptyGear(), model.linesOf({ 'test.1': 1 }));
    expect(sheet.resBy.fire).toBe(16);
    expect(sheet.resPct).toBe(0);
  });

  it('a threshold cluster grant carries its metadata the same way', () => {
    const spec = base([line('test.1')], {
      clusters: [{
        id: 'c1',
        condition: { kind: 'threshold', scope: 'tree', target: 'tree', per: 1 },
        grants: [{ id: 'elemental_resistance', element: 'fire', values: [10] }],
      }],
    });
    const model = createTree(spec, MODS, E.elements.order);
    expect(model.clusterState({ 'test.1': 1 }).grants).toEqual([{ id: 'elemental_resistance', value: 10, element: 'fire' }]);
  });
});

describe('illegal grant metadata is refused by node id when the spec builds', () => {
  it('a stat on a line that takes none', () => {
    const spec = base([line('test.1', [{ id: 'physical_power_flat', stat: 'str', values: [5] }])]);
    expect(() => createTree(spec, MODS)).toThrow(/test\.1/);
    expect(() => createTree(spec, MODS)).toThrow(/only stat_mod_flat takes one/);
  });

  it('a stat that is not one of the seven', () => {
    const spec = base([line('test.1', [{ id: 'stat_mod_flat', stat: 'spb' as any, values: [1] }])]);
    expect(() => createTree(spec, MODS)).toThrow(/unknown stat "spb"/);
  });

  it('an element on a line that takes none', () => {
    const spec = base([line('test.1', [{ id: 'armour_flat', element: 'fire', values: [5] }])]);
    expect(() => createTree(spec, MODS, E.elements.order)).toThrow(/test\.1/);
    expect(() => createTree(spec, MODS, E.elements.order)).toThrow(/only the per-Element lines take one/);
  });

  it('an element the data does not name', () => {
    const spec = base([line('test.1', [{ id: 'elemental_power_flat', element: 'song', values: [8] }])]);
    expect(() => createTree(spec, MODS, E.elements.order)).toThrow(/unknown element "song"/);
  });

  it('a cluster grant is held to the same vocabulary', () => {
    const spec = base([line('test.1')], {
      clusters: [{
        id: 'c1',
        condition: { kind: 'threshold', scope: 'tree', target: 'tree', per: 1 },
        grants: [{ id: 'armour_flat', element: 'fire', values: [10] }],
      }],
    });
    expect(() => createTree(spec, MODS, E.elements.order)).toThrow(/cluster c1/);
  });
});
