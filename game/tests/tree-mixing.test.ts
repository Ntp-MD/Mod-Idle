import { describe, expect, it } from 'vitest';
import { createTree, type TreeSpec } from '../../engine/tree';
import { E, MODS, TREE_SPEC, tree } from '../src/engine/client';
import { newGame, setLevel } from '../src/sim/core/game';
import { keystoneBuildContext } from '../src/sim/core/keystone-runtime';
import { allocateTreePath, canSpendTree, spendTreePoint, treePath } from '../src/sim/core/tree';
import { exportJson, importJson } from '../src/state/save';

const spec = TREE_SPEC as TreeSpec;
const pad = (n: number) => String(n).padStart(2, '0');

/** Reach a road junction using only its starting region, so a mixing test cannot buy the destination root first. */
function ownRoad(wing: string, target: string) {
  const root = tree.nodes.find((n) => n.wing === wing && n.needs.includes('start'))!;
  const previous = new Map<string, string | null>([[root.id, null]]), queue = [root.id];
  for (let i = 0; i < queue.length; i++) for (const id of tree.adjacentTo(queue[i])) {
    if (tree.byId[id].kind === 'normal' && tree.byId[id].wing === wing && !previous.has(id)) {
      previous.set(id, queue[i]); queue.push(id);
    }
  }
  expect(previous.has(target)).toBe(true);
  const path: string[] = [];
  for (let id: string | null = target; id; id = previous.get(id) ?? null) path.unshift(id);
  const state = newGame(42); setLevel(state, 100);
  for (const id of path) expect(spendTreePoint(state, id).ok, id).toBe(true);
  return state;
}

function regionFrontier(wing: string) {
  const root = tree.nodes.find((node) => node.wing === wing && node.kind === 'normal' && node.needs.includes('start'))!;
  const reached = new Set([root.id]), queue = [root.id];
  for (let i = 0; i < queue.length; i++) for (const id of tree.adjacentTo(queue[i])) {
    if (tree.byId[id].kind === 'normal' && tree.byId[id].wing === wing && !reached.has(id)) { reached.add(id); queue.push(id); }
  }
  return reached;
}

function boundary(aWing: string, bWing: string) {
  const aReachable = regionFrontier(aWing), bReachable = regionFrontier(bWing);
  for (const a of tree.nodes) {
    if (a.kind !== 'normal' || a.wing !== aWing || a.needs.includes('start') || !aReachable.has(a.id)) continue;
    const b = tree.adjacentTo(a.id).find((id) => tree.byId[id].kind === 'normal' && tree.byId[id].wing === bWing
      && !tree.byId[id].needs.includes('start') && bReachable.has(id));
    if (b) return { a: a.id, b };
  }
  throw new Error(`no direct Normal-road connection between ${aWing} and ${bWing}`);
}

describe('branching passive-tree road routes', () => {
  it('keeps every region traversable and opens each border to its neighbour', () => {
    const regions = spec.layout.regions!;
    for (let i = 0; i < regions.length; i++) {
      const wing = regions[i], next = regions[(i + 1) % regions.length];
      const reached = regionFrontier(wing);
      expect(reached.size).toBe(tree.nodes.filter((node) => node.kind === 'normal' && node.wing === wing).length);
      expect([...reached].some((id) => tree.adjacentTo(id).some((other) => tree.byId[other].kind === 'normal' && tree.byId[other].wing === next))).toBe(true);
    }
  });

  it.each([['str', 'agi'], ['dex', 'int'], ['wis', 'vit']] as const)('turns from %s into %s along a Normal road', (aWing, bWing) => {
    const { a, b } = boundary(aWing, bWing);
    const forward = ownRoad(aWing, a);
    expect(spendTreePoint(forward, b).ok).toBe(true);
    const reverse = ownRoad(bWing, b);
    expect(spendTreePoint(reverse, a).ok).toBe(true);
  });

  it('opens more than one local route from an owned frontier', () => {
    const outer = tree.nodes.find((node) => node.kind === 'normal' && node.wing === 'str' && tree.adjacentTo(node.id).filter((id) => tree.byId[id].kind === 'normal').length >= 3)!;
    const neighbours = tree.adjacentTo(outer.id).filter((id) => tree.byId[id].kind === 'normal');
    expect(neighbours.length).toBeGreaterThanOrEqual(3);
    for (const next of neighbours) expect(tree.connected(next, { [outer.id]: 1 })).toBe(true);
  });

  it('pays the previewed hybrid route atomically and round-trips the mixed build', () => {
    const { a, b: target } = boundary('str', 'agi');
    const state = ownRoad('str', a);
    const route = treePath(state, target);
    expect(route.nodes).toEqual([target]);
    const before = state.player.treePoints;
    expect(allocateTreePath(state, target).ok).toBe(true);
    expect(state.player.treePoints).toBe(before - route.cost.tree);
    const restored = importJson(exportJson(state));
    expect(restored.player.treeRanks).toEqual(state.player.treeRanks);
    expect(restored.player.treePoints).toBe(state.player.treePoints);
    const poor = ownRoad('str', a); poor.player.treePoints = route.cost.tree - 1;
    const snapshot = JSON.stringify(poor);
    expect(allocateTreePath(poor, target).ok).toBe(false);
    expect(JSON.stringify(poor)).toBe(snapshot);
  });

  it('keeps every Keystone as a leaf off its Notable', () => {
    for (const node of tree.nodes.filter((n) => n.kind === 'keystone')) expect(tree.adjacentTo(node.id)).toEqual(node.needs);
  });

  it('buys each Keystone from Normal roads without buying another branch Notable', () => {
    for (const node of tree.nodes.filter((n) => n.kind === 'keystone')) {
      const gate = tree.byId[node.needs[0]];
      const entrances = tree.adjacentTo(gate.id).filter(id => tree.byId[id].kind === 'normal');
      expect(entrances.length, gate.id).toBeGreaterThan(0);
      expect(tree.adjacentTo(gate.id).some(id => tree.byId[id].kind === 'notable'), gate.id).toBe(false);
      const state = newGame(42);
      state.player.treeRanks = { [entrances[0]]: 1 };
      state.player.treePoints = gate.cost;
      state.player.attainmentPoints = node.cost;
      expect(treePath(state, node.id).nodes, node.id).toEqual([gate.id, node.id]);
      expect(allocateTreePath(state, node.id).ok, node.id).toBe(true);
      expect(Object.keys(state.player.treeRanks!).filter(id => tree.byId[id].kind === 'notable'), node.id).toEqual([gate.id]);
      expect(state.player.treePoints, node.id).toBe(0);
      expect(state.player.attainmentPoints, node.id).toBe(0);
    }
  });

  it('retains the ranks, bonuses, wallets and usable frontier of an original v3 spoke build', () => {
    const source = structuredClone(spec), regions = source.layout.regions!;
    source.layout = { algorithm: 'seven-spoke-v3', start: source.layout.start, regions, spine_step: 25, branch_step: 12,
      notable_offset: 72, keystone_offset: 90, radii: source.layout.radii, padding: 16 };
    for (const node of source.nodes) {
      delete node.retired;
      const p = node.placement!;
      if (p.role === 'spine') node.needs = [p.index === 1 ? 'start' : `normal.${node.wing}.s${pad(p.index - 1)}`];
      else if (p.role === 'branch') node.needs = [p.step === 1 ? `normal.${node.wing}.s${pad(p.cluster + 6)}` : `normal.${node.wing}.c${pad(p.cluster)}.${pad(p.step - 1)}`];
      else if (p.role === 'notable') node.needs = [`normal.${node.wing}.c${pad(p.cluster)}.05`];
      else if (p.role === 'junction') node.needs = [`normal.${p.a}.s04`, `normal.${p.b}.s04`];
    }
    source.links = regions.flatMap((wing, i) => [6, 20].map((n) => ({ a: `normal.${wing}.s${pad(n)}`, b: `normal.${regions[(i + 1) % regions.length]}.s${pad(n)}`, shape: 'arc' as const })));
    const oldTree = createTree(source, MODS, E.elements.order, keystoneBuildContext(E.elements.order));
    const state = newGame(43); setLevel(state, 100);
    expect(allocateTreePath(state, 'notable.str.12', oldTree).ok).toBe(true);
    expect(tree.linesOf(state.player.treeRanks)).toEqual(oldTree.linesOf(state.player.treeRanks));
    const restored = importJson(exportJson(state));
    expect(restored.player.treeRanks).toEqual(state.player.treeRanks);
    expect(restored.player.treePoints).toBe(state.player.treePoints);
    expect(restored.player.attainmentPoints).toBe(state.player.attainmentPoints);
    const exit = Object.keys(restored.player.treeRanks!).flatMap((id) => tree.adjacentTo(id))
      .find((id) => !restored.player.treeRanks?.[id] && tree.byId[id].kind === 'normal')!;
    expect(canSpendTree(restored, exit).ok).toBe(true);
  });
});
