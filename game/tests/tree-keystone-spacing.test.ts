import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildTreeNetwork } from '../../engine/tree-network.ts';

const spec = JSON.parse(readFileSync(new URL('../../tools/data/tree.json', import.meta.url), 'utf8'));
const network = buildTreeNetwork(spec.nodes, spec.layout);
const start = spec.layout.start;
const retired = new Set<string>(spec.nodes.filter((node: any) => node.retired).map((node: any) => node.id));
const live = spec.nodes.filter((node: any) => !retired.has(node.id));

const adjacency = new Map<string, Set<string>>([['start', new Set()], ...live.map((node: any) => [node.id, new Set<string>()])]);
const link = (a: string, b: string) => {
  if (!adjacency.has(a) || !adjacency.has(b)) return;
  adjacency.get(a)!.add(b);
  adjacency.get(b)!.add(a);
};
for (const node of live) for (const parent of node.needs) link(node.id, parent);
for (const edge of network.links) link(edge.a, edge.b);

const hops = (from: string) => {
  const distance = new Map([[from, 0]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++) {
    for (const next of adjacency.get(queue[i])!) {
      if (distance.has(next)) continue;
      distance.set(next, distance.get(queue[i])! + 1);
      queue.push(next);
    }
  }
  return distance;
};
const depth = hops('start');
type KeystoneRow = {
  id: string;
  name: string;
  wing: string;
  weight: number;
  depth: number;
  radius: number;
  x: number;
  y: number;
  cluster: number;
};
const keystones: KeystoneRow[] = live.filter((node: any) => node.kind === 'keystone').map((node: any) => {
  const point = network.positions.get(node.id)!;
  return {
    id: node.id,
    name: node.name ?? node.id,
    wing: node.wing,
    weight: node.weight,
    depth: depth.get(node.id)!,
    radius: Math.hypot(point.x - start.x, point.y - start.y),
    x: point.x,
    y: point.y,
    cluster: node.placement.cluster,
  };
});
const apart = (a: KeystoneRow, b: KeystoneRow) => Math.hypot(a.x - b.x, a.y - b.y);

describe('keystone pockets preserve their anchors and readable spacing', () => {
  it('writes an integer tier from 1 to 5 on every keystone', () => {
    for (const node of keystones) expect(Number.isInteger(node.weight) && node.weight >= 1 && node.weight <= 5, node.name).toBe(true);
  });

  it('gives every Keystone its own immediate Notable gate', () => {
    const used = new Set<string>();
    for (const node of keystones) {
      const specNode = live.find((entry: any) => entry.id === node.id);
      const expected = `notable.${node.wing}.${String(node.cluster).padStart(2, '0')}`
        + (specNode.placement.slot === 2 ? '.02' : '');
      expect(specNode.needs, node.name).toEqual([expected]);
      expect(adjacency.get(node.id), node.name).toEqual(new Set([expected]));
      expect(used.has(expected), `${node.name} shares its last node`).toBe(false);
      used.add(expected);
      expect(Number.isFinite(node.depth), node.name).toBe(true);
    }
  });

  it('never lets neighbouring Keystone pockets overlap', () => {
    for (let i = 0; i < keystones.length; i++) {
      for (let j = i + 1; j < keystones.length; j++) {
        const a = keystones[i], b = keystones[j];
        // Shared and neighbouring pockets both clear the actual board's focus halos.
        expect(apart(a, b), `${a.name} / ${b.name}`)
          .toBeGreaterThanOrEqual(2 * (Number(spec.layout.radii.keystone) * 1.55 + 4));
        if (a.wing === b.wing && a.cluster === b.cluster) {
          expect(apart(a, b), `${a.name} / ${b.name} independent pockets`)
            .toBeGreaterThanOrEqual(spec.layout.web.leaf_cluster_separation);
        }
      }
    }
  });

  it('leaves every keystone as a terminal leaf', () => {
    const parents = new Set(spec.nodes.flatMap((node: any) => node.needs));
    for (const node of keystones) expect(parents.has(node.id), node.name).toBe(false);
  });
});
