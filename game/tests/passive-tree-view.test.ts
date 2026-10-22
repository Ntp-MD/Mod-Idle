import { describe, expect, it } from 'vitest';
import { tree } from '../src/engine/client';
import { buildPassiveTreeView, treeOrbitPath } from '../src/ui/passive-tree-view';

describe('passive tree presentation', () => {
  it('preserves canonical identities, connections, costs and bonuses without mutating engine coordinates', () => {
    const before = JSON.stringify(tree.nodes);
    const view = buildPassiveTreeView(tree.nodes, tree.graph.start);
    expect(view.nodes.map((node) => node.id)).toEqual(tree.nodes.map((node) => node.id));
    for (const node of tree.nodes) {
      const { x: _x, y: _y, ...canonical } = node;
      const { x, y, ...presented } = view.byId[node.id];
      expect(presented).toEqual(canonical);
      expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
    }
    expect(JSON.stringify(tree.nodes)).toBe(before);
  });

  it('puts every orbital member on its own group and inside the complete overview', () => {
    const view = buildPassiveTreeView(tree.nodes, tree.graph.start);
    expect(view.clusters.length).toBeGreaterThan(0);
    for (const [id, cluster] of view.clusterOf) {
      const node = view.byId[id];
      expect(Math.hypot(node.x - cluster.x, node.y - cluster.y)).toBeCloseTo(cluster.radius, 8);
      expect(node.wing).toBe(cluster.wing);
    }
    for (const node of view.nodes) {
      expect(node.x).toBeGreaterThan(view.bounds.x);
      expect(node.x).toBeLessThan(view.bounds.x + view.bounds.width);
      expect(node.y).toBeGreaterThan(view.bounds.y);
      expect(node.y).toBeLessThan(view.bounds.y + view.bounds.height);
    }
  });

  it('keeps backbone nodes and junctions in the canonical positions', () => {
    const view = buildPassiveTreeView(tree.nodes, tree.graph.start);
    for (const node of tree.nodes.filter((item) => item.placement?.role === 'spine' || item.placement?.role === 'junction')) {
      expect(view.byId[node.id].x).toBe(node.x);
      expect(view.byId[node.id].y).toBe(node.y);
    }
  });

  it('draws a short circular arc between real graph endpoints', () => {
    expect(treeOrbitPath({ x: 0, y: -2 }, { x: 2, y: 0 }, { x: 0, y: 0 })).toBe('M0 -2A2 2 0 0 1 2 0');
    expect(treeOrbitPath({ x: 2, y: 0 }, { x: 0, y: -2 }, { x: 0, y: 0 })).toBe('M2 0A2 2 0 0 0 0 -2');
  });
});
