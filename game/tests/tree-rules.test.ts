import { describe, it, expect } from 'vitest';
import { createTree, type TreeSpec } from '../../engine/tree.ts';
import { MODS, tree } from '../src/engine/client';
import { emptyGear, sumLines, applyTreeRules, conversionOf } from '../src/sim/player';
import { canSpendTree, spendTreePoint } from '../src/sim/tree';
import { newGame } from '../src/sim/game';

/**
 * The bounded rule vocabulary (a keystone may carry a drawback), the threshold clusters, and the
 * one-of keystone groups. A rule the sheet cannot hold is refused by name, so a node is never bought
 * and quietly does nothing.
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

const line = (id: string, needs: string[] = ['start']): TreeSpec['nodes'][number] =>
  ({ id, wing: 'test', kind: 'line', needs, grants: [{ id: 'attack_speed', values: [1, 2, 3] }] });

describe('a keystone may carry a drawback (D4)', () => {
  it('takes the named line away from the whole sheet, gear included', () => {
    const spec = base([
      line('test.1'),
      { id: 'test.2', wing: 'test', kind: 'keystone', needs: ['test.1'], grants: [{ id: 'attack_damage_pct', values: [3] }], rule: { kind: 'remove', target: 'armour_pct' } },
    ]);
    const model = createTree(spec, MODS);
    const rules = model.rulesOf({ 'test.2': 1 });
    const folded = applyTreeRules(sumLines(emptyGear(), [{ id: 'armour_pct', value: 20 }]), rules);
    expect(folded.armourPct).toBe(0);
    expect(model.byId['test.2'].rule).toEqual({ kind: 'remove', target: 'armour_pct' });
  });

  it('is refused by name when the verb is one the sheet cannot hold', () => {
    const spec = base([
      line('test.1'),
      { id: 'test.2', wing: 'test', kind: 'keystone', needs: ['test.1'], grants: [{ id: 'attack_damage_pct', values: [3] }], rule: { kind: 'conditional', target: 'boss' } },
    ]);
    expect(() => createTree(spec, MODS)).toThrow(/conditional/);
  });
});

describe('a keystone may route or raise', () => {
  it('routes a percent of the physical share into a named Element', () => {
    const spec = base([
      line('test.1'),
      { id: 'test.2', wing: 'test', kind: 'keystone', needs: ['test.1'], grants: [{ id: 'attack_damage_pct', values: [3] }], rule: { kind: 'convert', target: 'fire', value: 25 } },
    ]);
    const model = createTree(spec, MODS);
    const rules = model.rulesOf({ 'test.2': 1 });
    expect(rules).toEqual([{ kind: 'convert', target: 'fire', value: 25, node: 'test.2' }]);
    expect(conversionOf({ add: {}, mult: {} }, rules).fire).toBe(25);
  });

  it('raises a named Cap through the same line the sheet reads', () => {
    const spec = base([
      line('test.1'),
      { id: 'test.2', wing: 'test', kind: 'keystone', needs: ['test.1'], grants: [{ id: 'attack_damage_pct', values: [3] }], rule: { kind: 'cap_unlock', target: 'elemental_resistance_cap_pct', value: 15 } },
    ]);
    const model = createTree(spec, MODS);
    const rules = model.rulesOf({ 'test.2': 1 });
    const without = sumLines(emptyGear(), []);
    const with_ = applyTreeRules(sumLines(emptyGear(), []), rules);
    expect(with_.resCapPct).toBe(without.resCapPct + 15);
  });
});

describe('a cluster grants a line per step', () => {
  const spec = base([line('test.1'), line('test.2', ['test.1'])], {
    clusters: [{
      id: 'cluster.test', wing: 'test',
      condition: { kind: 'per_points', scope: 'wing', target: 'test', per: 3 },
      grants: [{ id: 'physical_power', values: [2] }],
    } as any],
  });
  const model = createTree(spec, MODS);

  it('counts the points spent in its scope', () => {
    expect(model.clusterState({ 'test.1': 1 }).steps['cluster.test']).toBe(0);
    expect(model.clusterState({ 'test.1': 3 }).steps['cluster.test']).toBe(1);
    expect(model.clusterState({ 'test.1': 3, 'test.2': 3 }).steps['cluster.test']).toBe(2);
  });

  it('grants its line on the sheet once the steps are earned', () => {
    const folded = sumLines(emptyGear(), model.clusterState({ 'test.1': 3 }).grants);
    expect(folded.physPct).toBe(2);
    const none = sumLines(emptyGear(), model.clusterState({ 'test.1': 1 }).grants);
    expect(none.physPct).toBe(0);
  });
});

describe('a keystone group is a one-of family (D1)', () => {
  const spec = base([
    line('test.1'),
    { id: 'test.a', wing: 'test', kind: 'keystone', needs: ['test.1'], group: 'group.test', grants: [{ id: 'attack_damage_pct', values: [3] }] },
    { id: 'test.b', wing: 'test', kind: 'keystone', needs: ['test.1'], group: 'group.test', grants: [{ id: 'attack_damage_pct', values: [3] }] },
  ], { keystone_groups: [{ id: 'group.test', name: 'Test', members: ['test.a', 'test.b'] }] });
  const model = createTree(spec, MODS);

  it('lets one member be held', () => {
    const s = newGame(21);
    s.player.treePoints = 100;
    s.player.attainmentPoints = 10;
    s.player.treeRanks = { 'test.1': 1 };
    expect(canSpendTree(s, 'test.a', model).ok).toBe(true);
    expect(spendTreePoint(s, 'test.a', model).ok).toBe(true);
  });

  it('blocks its sibling while one is held', () => {
    const s = newGame(22);
    s.player.treePoints = 100;
    s.player.attainmentPoints = 10;
    s.player.treeRanks = { 'test.1': 1, 'test.a': 1 };
    const verdict = canSpendTree(s, 'test.b', model);
    expect(verdict.ok).toBe(false);
    expect(verdict.why).toMatch(/test\.a/);
  });
});

describe('the tree the game ships', () => {
  it('carries grantless keystones whose bundle is a real runtime key', () => {
    const keystone = Object.values(tree.byId).find((n: any) => n.kind === 'keystone')!;
    expect(keystone.grants).toEqual([]);
    expect(keystone.currency).toBe('attainment');
    expect(keystone.effects).toHaveLength(1);
    const effect = keystone.effects![0];
    expect(effect.kind).toBe('keystone');
    expect(effect.key).toBe(keystone.id.replace(/^keystone\./, ''));
    expect(tree.keystoneBundles({ [keystone.id]: 1 })).toEqual([{ key: effect.key, params: effect.params ?? {} }]);
  });

  it('refuses the second keystone of a listed pair, in either order', () => {
    const pair = (tree as any).incompatibilities[0] as { a: string; b: string };
    const s = newGame(23);
    s.player.attainmentPoints = 10;
    s.player.treeRanks = { [pair.a]: 1 };
    expect(canSpendTree(s, pair.b).why).toMatch(/incompatible/);
    s.player.treeRanks = { [pair.b]: 1 };
    expect(canSpendTree(s, pair.a).why).toMatch(/incompatible/);
  });

  it('names the keystone it refuses, not its internal id', () => {
    const pair = (tree as any).incompatibilities[0] as { a: string; b: string };
    const s = newGame(24);
    s.player.attainmentPoints = 10;
    s.player.treeRanks = { [pair.a]: 1 };
    const why = canSpendTree(s, pair.b).why!;
    expect(why).not.toContain(pair.a);
    expect(why).toContain(tree.byId[pair.a].name);
  });
});
