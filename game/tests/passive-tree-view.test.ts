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

  it('lays every spine out along a gently curved region ray, ordered outward from the origin', () => {
    const view = buildPassiveTreeView(tree.nodes, tree.graph.start);
    const rays = new Map<string, { first: number; radii: { index: number; radius: number }[] }>();
    for (const node of tree.nodes.filter((item) => item.placement?.role === 'spine')) {
      const point = view.byId[node.id];
      const dx = point.x - tree.graph.start.x, dy = point.y - tree.graph.start.y;
      const angle = Math.atan2(dy, dx);
      const ray = rays.get(node.wing) ?? { first: angle, radii: [] };
      expect(Math.abs(angle - ray.first)).toBeLessThan(0.08);
      ray.radii.push({ index: (node.placement as { index: number }).index, radius: Math.hypot(dx, dy) });
      rays.set(node.wing, ray);
    }
    expect(rays.size).toBe(7);
    for (const ray of rays.values()) {
      const ordered = [...ray.radii].sort((a, b) => a.index - b.index);
      for (let i = 1; i < ordered.length; i++) expect(ordered[i].radius).toBeGreaterThan(ordered[i - 1].radius);
    }
  });

  it('draws a short circular arc between real graph endpoints', () => {
    expect(treeOrbitPath({ x: 0, y: -2 }, { x: 2, y: 0 }, { x: 0, y: 0 })).toBe('M0 -2A2 2 0 0 1 2 0');
    expect(treeOrbitPath({ x: 2, y: 0 }, { x: 0, y: -2 }, { x: 0, y: 0 })).toBe('M2 0A2 2 0 0 0 0 -2');
  });
});
