/**
 * The passive tree, shared. `tools/data/tree.json` holds the SPEC — the three wings, their graph layout,
 * rank cross-links and rank-tier multipliers — and this module derives the nodes and line
 * maxima in `mods.json`. The cage (`tools/tree.ts`) gates the same object the client spends, so a node
 * cannot exist in one place and not the other.
 *
 * A node grants ONE line at a number per rank. The network has a free centre start and no keystones.
 */

export interface TreeNode {
  id: string;
  branch: string;
  index: number;
  tier: 'shallow' | 'deep';
  /** The `mods.json` line this node grants. */
  line: string;
  name?: string;
  weapon?: string;
  /** What rank 1, 2 and 3 grant. Never zero, never falling. */
  values: number[];
  /** The line's own maximum, kept so a reader can see the fraction a node buys. */
  max: number;
  /** Graph position in the shared tree viewBox. */
  x: number;
  y: number;
  /** Any connected owned node opens this node; the start marker is the only free root. */
  needs: string[];
  ranks: number;
  points: number;
}

export interface TreeSpec {
  point_cost_per_rank: number;
  /** How many of a branch's nodes are the shallow tier; the rest are deep. */
  shallow_nodes: number;
  rank_tiers: { shallow: number[]; deep: number[] };
  branches: Record<string, { line: string; values?: number[]; name?: string; weapon?: string }[]>;
  graph: {
    start: { x: number; y: number };
    nodes_per_ring: number;
    ring_radii: number[];
    extra_radius: number;
    arc_span_deg: number;
    branch_angle_deg: Record<string, number>;
    crosslink_ranks: number[];
  };
}

/**
 * The spec's own shape, read before a node is built: the shallow boundary and the rank ladder come
 * from the data, so a spec that lost a key would otherwise build a tree nobody asked for. Each
 * refusal names the key that is wrong.
 */
function readSpec(spec: TreeSpec): { shallowNodes: number; ranks: number } {
  const shallow = spec?.rank_tiers?.shallow;
  const deep = spec?.rank_tiers?.deep;
  if (!Array.isArray(shallow) || !Array.isArray(deep) || shallow.length === 0 || deep.length === 0)
    throw new Error('tree spec: rank_tiers.shallow and rank_tiers.deep must both be nonempty arrays');
  if (shallow.length !== deep.length)
    throw new Error(`tree spec: rank_tiers.shallow (${shallow.length}) and rank_tiers.deep (${deep.length}) must have the same length`);
  const shallowNodes = spec.shallow_nodes;
  if (!Number.isInteger(shallowNodes) || shallowNodes < 0)
    throw new Error('tree spec: shallow_nodes must be a whole number of nodes, zero or more');
  return { shallowNodes, ranks: shallow.length };
}

export function createTree(spec: TreeSpec, mods: any) {
  const { shallowNodes, ranks } = readSpec(spec);
  const maxOf = (id: string) => Number((mods.mods.find((m: any) => m.id === id) || {}).max ?? 0);
  const cost = spec.point_cost_per_rank;

  const nodes: TreeNode[] = [];
  for (const [branch, list] of Object.entries(spec.branches)) {
    list.forEach((entry, i) => {
      const tier: TreeNode['tier'] = i < shallowNodes ? 'shallow' : 'deep';
      const mult = spec.rank_tiers[tier];
      let prev = 0;
      // a node never grants zero and a rank never grants less than the one below it: a 3%-max line
      // (perfect dodge) would otherwise round its first rank to nothing
      const values = mult.map((m) => { const v = Math.max(1, Math.round(maxOf(entry.line) * m), prev); prev = v; return v; });
      const ring = Math.floor(i / spec.graph.nodes_per_ring);
      const position = i % spec.graph.nodes_per_ring;
      const half = (spec.graph.nodes_per_ring - 1) / 2;
      const angle = (spec.graph.branch_angle_deg[branch]
        + (position - half) * spec.graph.arc_span_deg / Math.max(1, spec.graph.nodes_per_ring - 1)) * Math.PI / 180;
      const radius = spec.graph.ring_radii[ring] ?? spec.graph.extra_radius;
      nodes.push({
        id: `${branch}.${i + 1}`, branch, index: i + 1, tier, line: entry.line,
        ...(entry.name ? { name: entry.name } : {}),
        ...(entry.weapon ? { weapon: entry.weapon } : {}),
        values, max: maxOf(entry.line),
        x: spec.graph.start.x + Math.cos(angle) * radius,
        y: spec.graph.start.y + Math.sin(angle) * radius,
        needs: i === 0 ? ['start'] : [`${branch}.${i}`],
        ranks, points: ranks * cost,
      });
    });
  }
  const byId: Record<string, TreeNode> = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const branches = Object.keys(spec.branches);
  for (const rank of spec.graph.crosslink_ranks) {
    const ring = branches.map((branch) => byId[`${branch}.${rank}`]).filter(Boolean);
    ring.forEach((node, i) => {
      const neighbour = ring[(i + 1) % ring.length];
      if (!node.needs.includes(neighbour.id)) node.needs.push(neighbour.id);
      if (!neighbour.needs.includes(node.id)) neighbour.needs.push(node.id);
    });
  }

  /** The lines the bought ranks actually grant, in the shape `sumLines` accumulates. */
  function linesOf(ranks: Record<string, number> | undefined, weaponName = ''): { id: string; value: number }[] {
    const out: { id: string; value: number }[] = [];
    for (const [id, rank] of Object.entries(ranks || {})) {
      const node = byId[id];
      if (!node) continue;
      if (node.weapon && node.weapon !== weaponName) continue;
      const r = Math.max(0, Math.min(node.ranks, Math.floor(rank)));
      if (r > 0) out.push({ id: node.line, value: node.values[r - 1] });
    }
    return out;
  }

  /** Points a set of ranks has spent — the refund, and the number the UI shows. */
  const pointsSpent = (ranks: Record<string, number> | undefined) =>
    Object.entries(ranks || {}).reduce((s, [id, r]) => s + (byId[id] ? Math.min(byId[id].ranks, Math.max(0, r)) * cost : 0), 0);

  return { nodes, byId, branches, graph: spec.graph, cost, ranks, shallowNodes, linesOf, pointsSpent };
}
