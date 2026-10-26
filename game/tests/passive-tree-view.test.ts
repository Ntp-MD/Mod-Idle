import { describe, expect, it } from 'vitest';
import type { TreeSpec } from '../../engine/tree';
import { buildTreeNetwork } from '../../engine/tree-network';
import { TREE_SPEC, tree } from '../src/engine/client';
import { buildPassiveTreeView, initialTreeCamera, treeOrbitPath, treeViewNodeRadius, treeRouteEdges } from '../src/ui/passive-tree/passive-tree-view';

const spec = TREE_SPEC as TreeSpec;
const routeDegree = (id: string) => tree.adjacentTo(id).length + (tree.byId[id].needs.includes('start') ? 1 : 0);

describe('branching passive-tree roads', () => {
  it('renders canonical positions, identities, costs and grants without moving or mutating them', () => {
    const before = JSON.stringify(tree.nodes);
    const view = buildPassiveTreeView(tree.nodes, tree.graph.start);
    for (const node of tree.nodes) expect(view.byId[node.id]).toEqual(node);
    expect(JSON.stringify(tree.nodes)).toBe(before);
    for (const node of view.nodes) {
      expect(node.x).toBeGreaterThan(view.bounds.x);
      expect(node.x).toBeLessThan(view.bounds.x + view.bounds.width);
      expect(node.y).toBeGreaterThan(view.bounds.y);
      expect(node.y).toBeLessThan(view.bounds.y + view.bounds.height);
    }
  });

  it('anchors region labels and focus bounds to their real members, independent of catalogue order', () => {
    const nodes = [
      { ...tree.nodes[0], id: 'east-a', wing: 'east', x: 200, y: 0 },
      { ...tree.nodes[0], id: 'east-b', wing: 'east', x: 300, y: 100 },
      { ...tree.nodes[0], id: 'west', wing: 'west', x: -500, y: -200 },
    ];
    const start = { x: 0, y: 0 };
    const view = buildPassiveTreeView(nodes, start);
    const east = view.regions.find((region) => region.id === 'east')!;
    expect(east.centroid).toEqual({ x: 250, y: 50 });
    expect(east.bounds).toEqual({ x: 155, y: -45, width: 190, height: 190 });
    expect(east.x).toBeGreaterThan(east.centroid.x);
    expect(east.y).toBeGreaterThan(east.centroid.y);
    expect(buildPassiveTreeView([...nodes].reverse(), start).regions.find((region) => region.id === 'east')).toEqual(east);
    expect(view.bounds).toEqual({ x: -590, y: -275, width: 980, height: 450 });
    for (const region of view.regions) {
      expect(region.x).toBeGreaterThan(view.bounds.x);
      expect(region.x).toBeLessThan(view.bounds.x + view.bounds.width);
      expect(region.y).toBeGreaterThan(view.bounds.y);
      expect(region.y).toBeLessThan(view.bounds.y + view.bounds.height);
    }
  });

  it('opens a fresh tree around Origin and frames owned roads with both kinds of frontier edge', () => {
    const start = { x: 10, y: 20 };
    const nodes = [
      { ...tree.nodes[0], id: 'owned', needs: ['start'], x: 100, y: 20 },
      { ...tree.nodes[0], id: 'next', needs: ['owned'], x: 200, y: 50 },
      { ...tree.nodes[0], id: 'cross-link', needs: [], x: 100, y: 250 },
      { ...tree.nodes[0], id: 'distant', needs: [], x: 1000, y: 20 },
    ];
    const view = buildPassiveTreeView(nodes, start), viewport = { width: 1000, height: 600 };
    expect(initialTreeCamera(view, start, {}, viewport)).toEqual({ x: 10, y: 20, zoom: 2.6 });
    const ranks = { owned: 1 };
    const camera = initialTreeCamera(view, start, ranks, viewport, [{ a: 'cross-link', b: 'owned' }]);
    expect(camera.x).toBe(105);
    expect(camera.y).toBe(135);
    const scale = Math.min(viewport.width / view.bounds.width, viewport.height / view.bounds.height) * camera.zoom;
    for (const point of [start, ...nodes.filter((node) => node.id !== 'distant')]) {
      expect(Math.abs(point.x - camera.x) * scale).toBeLessThan(viewport.width / 2);
      expect(Math.abs(point.y - camera.y) * scale).toBeLessThan(viewport.height / 2);
    }
    expect(ranks).toEqual({ owned: 1 });
    for (const pendingLayout of [{ width: 0, height: 600 }, { width: 1000, height: 0 }]) {
      const pending = initialTreeCamera(view, start, ranks, pendingLayout);
      expect([pending.x, pending.y, pending.zoom].every(Number.isFinite)).toBe(true);
    }
  });

  it('fills the field evenly while keeping the origin clear', () => {
    const network = buildTreeNetwork(spec.nodes, spec.layout);
    const normals = tree.nodes.filter((node) => node.kind === 'normal');
    const angular = Array(12).fill(0) as number[];
    const radial = Array(4).fill(0) as number[];
    const maxRadius = Math.max(...normals.map((node) => Math.hypot(node.x - tree.graph.start.x, node.y - tree.graph.start.y)));
    for (const node of normals) {
      const dx = node.x - tree.graph.start.x, dy = node.y - tree.graph.start.y;
      const angle = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
      angular[Math.floor(angle / (Math.PI * 2) * angular.length)]++;
      const r2 = dx * dx + dy * dy, inner2 = spec.layout.root_clearance! ** 2, outer2 = maxRadius ** 2;
      radial[Math.min(radial.length - 1, Math.floor((r2 - inner2) / (outer2 - inner2) * radial.length))]++;
      expect(Math.hypot(dx, dy)).toBeGreaterThan(spec.layout.root_clearance!);
    }
    expect(Math.max(...angular) / Math.min(...angular)).toBeLessThan(1.6);
    expect(Math.max(...radial) / Math.min(...radial)).toBeLessThan(1.6);
    expect(new Set(network.normalRows.flat().filter((n) => !n.retired).map((n) => n.id)).size)
      .toBe(tree.nodes.filter((n) => n.kind === 'normal').length);
  });

  it('spaces the root spokes evenly and gives Keystone routes a straight Normal approach', () => {
    const roots = tree.nodes.filter((node) => node.needs.includes('start'))
      .map((node) => Math.atan2(node.y - tree.graph.start.y, node.x - tree.graph.start.x))
      .sort((a, b) => a - b);
    const expectedGap = 2 * Math.PI / roots.length;
    for (let i = 0; i < roots.length; i++) {
      const gap = (roots[(i + 1) % roots.length] - roots[i] + 2 * Math.PI) % (2 * Math.PI);
      expect(gap).toBeCloseTo(expectedGap, 5);
    }

    const leaves = tree.nodes.filter((node) => node.kind === 'keystone');
    const straightLeaves = leaves.filter((leaf) => {
      const parent = tree.byId[leaf.needs[0]];
      const outgoing = Math.atan2(leaf.y - parent.y, leaf.x - parent.x);
      const approaches = tree.adjacentTo(parent.id).map((id) => tree.byId[id]).filter((node) => node.kind === 'normal');
      const smallestTurn = Math.min(...approaches.map((node) => {
        const incoming = Math.atan2(parent.y - node.y, parent.x - node.x);
        return Math.abs(Math.atan2(Math.sin(outgoing - incoming), Math.cos(outgoing - incoming)));
      }));
      return smallestTurn <= Math.PI / 4;
    });
    expect(straightLeaves.length).toBe(leaves.length);
  });

  it('separates all drawn circles, including Notables and their Keystone leaves', () => {
    let smallest = Infinity, pair = '';
    for (let i = 0; i < tree.nodes.length; i++) {
      const a = tree.nodes[i];
      for (let j = i + 1; j < tree.nodes.length; j++) {
        const b = tree.nodes[j];
        const clearance = Math.hypot(a.x - b.x, a.y - b.y) - treeViewNodeRadius(a, tree.layout) - treeViewNodeRadius(b, tree.layout);
        if (clearance < smallest) { smallest = clearance; pair = `${a.id} / ${b.id}`; }
      }
    }
    expect(smallest, pair).toBeGreaterThan(1);
  });

  it('offers forks while keeping every Normal road connected', () => {
    const normals = tree.nodes.filter((n) => n.kind === 'normal');
    const degrees: number[] = [];
    for (const a of normals) {
      const neighbours = tree.adjacentTo(a.id).map((id) => tree.byId[id]).filter((n) => n.kind === 'normal');
      expect(neighbours.length, a.id).toBeGreaterThanOrEqual(1);
      expect(routeDegree(a.id), a.id).toBeGreaterThanOrEqual(2);
      degrees.push(neighbours.length);
    }
    expect(degrees.some((degree) => degree >= 3)).toBe(true);
    const seen = new Set([normals[0].id]), queue = [normals[0].id];
    for (let i = 0; i < queue.length; i++) for (const id of tree.adjacentTo(queue[i])) {
      if (tree.byId[id].kind === 'normal' && !seen.has(id)) { seen.add(id); queue.push(id); }
    }
    expect(seen.size).toBe(normals.length);
  });

  it('ends every route on a Notable or Keystone', () => {
    const ordinaryEnds = tree.nodes.filter((node) => node.kind === 'normal' && routeDegree(node.id) === 1);
    expect(ordinaryEnds.map((node) => node.id)).toEqual([]);
  });

  it('refuses missing route anchors, reused route steps and unreadable leaf pockets', () => {
    const missing = structuredClone(spec.layout);
    delete missing.web!.sites[Object.keys(missing.web!.sites)[0]];
    expect(() => buildTreeNetwork(spec.nodes, missing)).toThrow(/no group site/);
    const reused = structuredClone(spec.layout);
    reused.web!.roads.push(structuredClone(reused.web!.roads.find(road => road.via.length)!));
    expect(() => buildTreeNetwork(spec.nodes, reused)).toThrow(/two jobs/);
    expect(() => buildTreeNetwork(spec.nodes, { ...spec.layout, web: { ...spec.layout.web!, root_radius: 0 } })).toThrow(/positive/);
    expect(() => buildTreeNetwork(spec.nodes, { ...spec.layout, radii: { ...spec.layout.radii, keystone: 1000 } })).toThrow(/leaf pocket/);
  });

  it('joins Normal-road alternatives at nodes rather than crossed diagonals', () => {
    const edges = new Map<string, { a: typeof tree.nodes[number]; b: typeof tree.nodes[number] }>();
    for (const a of tree.nodes.filter((n) => n.kind === 'normal')) for (const id of tree.adjacentTo(a.id)) {
      const b = tree.byId[id];
      if (b.kind === 'normal') edges.set([a.id, b.id].sort().join('|'), { a, b });
    }
    const list = [...edges.values()];
    const side = (a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }) =>
      (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    let crossing = '';
    for (let i = 0; i < list.length && !crossing; i++) for (let j = i + 1; j < list.length; j++) {
      const { a, b } = list[i], { a: c, b: d } = list[j];
      if (a.id === c.id || a.id === d.id || b.id === c.id || b.id === d.id) continue;
      if (Math.max(a.x, b.x) < Math.min(c.x, d.x) || Math.max(c.x, d.x) < Math.min(a.x, b.x)
          || Math.max(a.y, b.y) < Math.min(c.y, d.y) || Math.max(c.y, d.y) < Math.min(a.y, b.y)) continue;
      if (side(a, b, c) * side(a, b, d) < -0.001 && side(c, d, a) * side(c, d, b) < -0.001) {
        crossing = `${a.id} / ${b.id} crosses ${c.id} / ${d.id}`; break;
      }
    }
    expect(crossing).toBe('');
  });

  it('keeps the Normal roads clear of unrelated Notable and Keystone icons', () => {
    const special = tree.nodes.filter((n) => n.kind !== 'normal');
    let clearance = Infinity, pair = '';
    for (const a of tree.nodes.filter((n) => n.kind === 'normal')) for (const id of tree.adjacentTo(a.id)) {
      const b = tree.byId[id];
      if (b.kind !== 'normal' || a.id > b.id) continue;
      const dx = b.x - a.x, dy = b.y - a.y, length2 = dx * dx + dy * dy;
      for (const n of special) {
        const t = Math.max(0, Math.min(1, ((n.x - a.x) * dx + (n.y - a.y) * dy) / length2));
        const distance = Math.hypot(n.x - a.x - t * dx, n.y - a.y - t * dy) - treeViewNodeRadius(n, tree.layout);
        if (distance < clearance) { clearance = distance; pair = `${a.id} / ${b.id} crosses ${n.id}`; }
      }
    }
    expect(clearance, pair).toBeGreaterThan(1);
  });

  it('previews consecutive purchase edges without lighting other chords', () => {
    const links = [{ a: 'owned', b: 'a' }, { a: 'a', b: 'b' }, { a: 'b', b: 'c' }, { a: 'a', b: 'c' }];
    expect(treeRouteEdges(['a', 'b', 'c'], links, (id) => id === 'owned')).toEqual(new Set(['a|owned', 'a|b', 'b|c']));
    expect(treeRouteEdges([], links, () => true).size).toBe(0);
  });

  it('draws circular road segments between their real endpoints', () => {
    expect(treeOrbitPath({ x: 0, y: -2 }, { x: 2, y: 0 }, { x: 0, y: 0 })).toBe('M0 -2A2 2 0 0 1 2 0');
    expect(treeOrbitPath({ x: 2, y: 0 }, { x: 0, y: -2 }, { x: 0, y: 0 })).toBe('M2 0A2 2 0 0 0 0 -2');
  });
});
