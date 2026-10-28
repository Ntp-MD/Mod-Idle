import { describe, it, expect } from 'vitest';
import { createTree, type TreeSpec } from '@engine/tree.ts';
import { MODS, tree } from '../../src/engine/client';
import { buildCharacter, emptyGear, sumLines } from '@sim/core/player';
import { newGame } from '@sim/core/game';
import { canSpendTree, spendTreePoint, treeLines } from '@sim/core/tree';

/**
 * The node kinds: a node's kind sets its rank count, its cost and the currency it is paid in, and a
 * node may grant SEVERAL lines. A notable is what proves the multi-grant path end to end — the sheet
 * has to fold every grant into the same buckets a piece's line would.
 */

const SPEC: TreeSpec = {
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
  nodes: [
    { id: 'test.1', wing: 'test', kind: 'line', needs: ['start'], grants: [{ id: 'attack_speed', values: [1, 2, 3] }] },
    {
      id: 'test.2', wing: 'test', kind: 'notable', needs: ['test.1'], name: 'Flurry',
      grants: [{ id: 'attack_speed', values: [5] }, { id: 'physical_power_flat', values: [16] }],
    },
    { id: 'test.3', wing: 'test', kind: 'keystone', needs: ['test.2'], grants: [{ id: 'attack_damage_pct', values: [3] }] },
  ],
};

describe('a node kind sets its ranks, its cost and its currency', () => {
  const model = createTree(SPEC, MODS);

  it('reads them from the spec, not from the code', () => {
    expect(model.byId['test.1'].ranks).toBe(3);
    expect(model.byId['test.1'].cost).toBe(1);
    expect(model.byId['test.1'].currency).toBe('tree');
    expect(model.byId['test.2'].ranks).toBe(1);
    expect(model.byId['test.3'].currency).toBe('attainment');
  });

  it('spends a rank against the kind\'s own cap', () => {
    const s = newGame(11);
    s.player.treePoints = 100;
    expect(spendTreePoint(s, 'test.1', model).ok).toBe(true);
    expect(spendTreePoint(s, 'test.1', model).ok).toBe(true);
    expect(spendTreePoint(s, 'test.1', model).ok).toBe(true);
    // a line node holds three ranks and no more
    expect(canSpendTree(s, 'test.1', model).why).toMatch(/already at rank 3/);
  });

  it('charges the currency its kind is paid in', () => {
    const s = newGame(12);
    s.player.treePoints = 100;
    s.player.attainmentPoints = 0;
    // a keystone is paid in attainment points, so tree points alone cannot buy it
    expect(canSpendTree(s, 'test.3', model).ok).toBe(false);
    expect(canSpendTree(s, 'test.3', model).why).toMatch(/attainment point/);
    // it is still connected first: a node opens from an owned path
    s.player.treeRanks = { 'test.1': 1, 'test.2': 1 };
    s.player.attainmentPoints = 1;
    expect(canSpendTree(s, 'test.3', model).ok).toBe(true);
    expect(spendTreePoint(s, 'test.3', model).ok).toBe(true);
    // the tree points are untouched: the keystone was paid in its own currency
    expect(s.player.treePoints).toBe(100);
    expect(s.player.attainmentPoints).toBe(0);
  });
});

describe('a node may grant several lines', () => {
  const model = createTree(SPEC, MODS);

  it('emits one entry per grant', () => {
    const lines = model.linesOf({ 'test.2': 1 }, '');
    expect(lines).toEqual([
      { id: 'attack_speed', value: 5 },
      { id: 'physical_power_flat', value: 16 },
    ]);
  });

  it('folds every grant into the sheet\'s own buckets', () => {
    const lines = model.linesOf({ 'test.2': 1 }, '');
    const folded = sumLines(emptyGear(), lines);
    expect(folded.aspdPct).toBe(5);
    expect(folded.physFlat).toBe(16);
  });

  it('puts a bought notable\'s lines on the character sheet', () => {
    const notable = Object.values(tree.byId).find((n: any) => n.kind === 'notable' && n.grants.some((g: any) => g.id === 'attack_speed'))!;
    const s = newGame(13);
    s.player.treeRanks = { [notable.id]: 1 };
    // every line the notable grants reaches the sheet's own buckets
    const folded = sumLines(emptyGear(), treeLines(s));
    const aspd = notable.grants.find((g: any) => g.id === 'attack_speed')!;
    expect(folded.aspdPct).toBe(aspd.values[0]);
    const withTree = buildCharacter(s.player.level, emptyGear(), {}, 0, { add: {}, mult: {} }, undefined, s.player.treeRanks);
    const without = buildCharacter(s.player.level, emptyGear(), {}, 0, { add: {}, mult: {} });
    expect(withTree.aspd).toBeGreaterThan(without.aspd);
  });
});

describe('the tree the game ships', () => {
  it('holds a notable that resolves its profile to several lines', () => {
    const notable = Object.values(tree.byId).find((n: any) => n.kind === 'notable' && n.grants.length > 1);
    expect(notable).toBeTruthy();
    expect(notable!.profile).toBe(notable!.id);
  });

  it('spends a notable in tree points, at three points for its one rank', () => {
    const notable = Object.values(tree.byId).find((n: any) => n.kind === 'notable')!;
    const s = newGame(14);
    s.player.treePoints = 100;
    s.player.treeRanks = { [notable.needs[0]]: 1 };
    expect(notable.cost).toBe(3);
    expect(canSpendTree(s, notable.id).ok).toBe(true);
    expect(spendTreePoint(s, notable.id).ok).toBe(true);
    expect(s.player.treePoints).toBe(97);
    // the notable's own grants are all granted, and it holds a single rank
    const granted = treeLines(s).map((l) => l.id);
    for (const g of notable.grants) expect(granted).toContain(g.id);
    expect(s.player.treeRanks![notable.id]).toBe(1);
    expect(canSpendTree(s, notable.id).ok).toBe(false);
  });

  it('folds a tree stat line into every Core attribute, because the tree cannot roll one', () => {
    const folded = sumLines(emptyGear(), [{ id: 'stat_mod_flat', value: 5 }]);
    for (const key of Object.keys(folded.statBy)) expect(folded.statBy[key as keyof typeof folded.statBy].flat).toBe(5);
  });
});

describe('the tree the game ships', () => {
  it('holds the seven regions and the catalogue\u2019s keystones', () => {
    const wings = new Set(Object.values(tree.byId).map((n: any) => n.wing));
    expect(wings.size).toBe(7);
    const keystones = Object.values(tree.byId).filter((n: any) => n.kind === 'keystone');
    expect(keystones.length).toBe(105);
    for (const k of keystones) {
      expect(k.currency).toBe('attainment');
      expect(k.grants).toEqual([]);
      expect(k.effects).toHaveLength(1);
    }
  });

  it('bans the listed keystone pairs, in either order', () => {
    expect((tree as any).groups).toEqual([]);
    const pairs = (tree as any).incompatibilities as { a: string; b: string }[];
    expect(pairs.length).toBeGreaterThan(0);
    for (const pair of pairs) {
      expect((tree as any).byId[pair.a].kind).toBe('keystone');
      expect((tree as any).byId[pair.b].kind).toBe('keystone');
      expect(tree.pairHolder(pair.a, { [pair.b]: 1 })).toBe(pair.b);
      expect(tree.pairHolder(pair.b, { [pair.a]: 1 })).toBe(pair.a);
    }
  });
});
