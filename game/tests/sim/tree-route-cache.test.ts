import { describe, expect, it } from 'vitest';
import { createTree, type TreeSpec } from '@engine/tree';
import { E, MODS, TREE_SPEC } from '../../src/engine/client';
import { keystoneBuildContext } from '@sim/core/keystone-runtime';

const model = () => createTree(structuredClone(TREE_SPEC) as TreeSpec, MODS, E.elements.order,
  keystoneBuildContext(E.elements.order));

describe('retained passive tree routes', () => {
  it('keeps routes and prices correct through in-place allocation, refund and a replacement save object', () => {
    const retained = model(), reference = model();
    const target = retained.nodes.find(node => node.kind === 'notable')!;
    const ranks: Record<string, number> = {};
    const initial = retained.pathTo(target.id, ranks);
    expect(initial.length).toBeGreaterThan(1);
    for (const id of initial.slice(0, 2)) {
      ranks[id] = 1;
      expect(retained.pathTo(target.id, ranks)).toEqual(reference.pathTo(target.id, { ...ranks }));
      expect(retained.pathCost(target.id, ranks)).toEqual(reference.pathCost(target.id, { ...ranks }));
    }
    delete ranks[initial[0]];
    expect(retained.pathTo(target.id, ranks)).toEqual(reference.pathTo(target.id, { ...ranks }));
    for (const id of Object.keys(ranks)) delete ranks[id];
    expect(retained.pathTo(target.id, ranks)).toEqual(initial);
    expect(retained.pathTo(target.id, {})).toEqual(initial);
  });

  it('keeps cached paths private and does not leak between different model instances', () => {
    const retained = model(), other = model();
    const target = retained.nodes.find(node => node.kind === 'keystone')!;
    const initial = retained.pathTo(target.id, {});
    const caller = retained.pathTo(target.id, {});
    caller.reverse(); caller.push('caller-only');
    expect(retained.pathTo(target.id, {})).toEqual(initial);
    const owned = Object.fromEntries(initial.map(id => [id, 1]));
    expect(retained.pathTo(target.id, owned)).toEqual([]);
    expect(other.pathTo(target.id, {})).toEqual(initial);
    expect(retained.pathTo('missing-node', owned)).toEqual([]);
    expect(retained.pathTo(target.id, {})).toEqual(initial);
  });
});
