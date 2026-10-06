/**
 * The passive tree, shared. `tools/data/tree.json` holds the SPEC — three branches, each a list of
 * lines plus the rank-tier multipliers — and this module derives the nodes from it and the line
 * maxima in `mods.json`. The cage (`tools/tree.ts`) gates the same object the client spends, so a node
 * cannot exist in one place and not the other.
 *
 * A node grants ONE line at a number per rank. That is the whole point of the redesign: the removed
 * tree spent 82 of its 100 points on rules that granted nothing. There are no keystones.
 */

export interface TreeNode {
  id: string;
  branch: string;
  index: number;
  tier: 'shallow' | 'deep';
  /** The `mods.json` line this node grants. */
  line: string;
  /** What rank 1, 2 and 3 grant. Never zero, never falling. */
  values: number[];
  /** The line's own maximum, kept so a reader can see the fraction a node buys. */
  max: number;
  /** The node that must be owned first — `null` for the head of a chain. */
  needs: string | null;
  ranks: number;
  points: number;
}

export interface TreeSpec {
  point_cost_per_rank: number;
  rank_tiers: { shallow: number[]; deep: number[] };
  branches: Record<string, { line: string; values?: number[] }[]>;
}

/** How many of a branch's nodes are the shallow tier; the rest are deep. */
const SHALLOW_NODES = 14;
const RANKS = 3;

export function createTree(spec: TreeSpec, mods: any) {
  const maxOf = (id: string) => Number((mods.mods.find((m: any) => m.id === id) || {}).max ?? 0);
  const cost = spec.point_cost_per_rank;

  const nodes: TreeNode[] = [];
  for (const [branch, list] of Object.entries(spec.branches)) {
    list.forEach((entry, i) => {
      const tier: TreeNode['tier'] = i < SHALLOW_NODES ? 'shallow' : 'deep';
      const mult = spec.rank_tiers[tier];
      let prev = 0;
      // a node never grants zero and a rank never grants less than the one below it: a 3%-max line
      // (perfect dodge) would otherwise round its first rank to nothing
      const values = mult.map((m) => { const v = Math.max(1, Math.round(maxOf(entry.line) * m), prev); prev = v; return v; });
      nodes.push({
        id: `${branch}.${i + 1}`, branch, index: i + 1, tier, line: entry.line,
        values, max: maxOf(entry.line), needs: i === 0 ? null : `${branch}.${i}`,
        ranks: RANKS, points: RANKS * cost,
      });
    });
  }
  const byId: Record<string, TreeNode> = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const branches = Object.keys(spec.branches);

  /** The lines the bought ranks actually grant, in the shape `sumLines` accumulates. */
  function linesOf(ranks: Record<string, number> | undefined): { id: string; value: number }[] {
    const out: { id: string; value: number }[] = [];
    for (const [id, rank] of Object.entries(ranks || {})) {
      const node = byId[id];
      if (!node) continue;
      const r = Math.max(0, Math.min(node.ranks, Math.floor(rank)));
      if (r > 0) out.push({ id: node.line, value: node.values[r - 1] });
    }
    return out;
  }

  /** Points a set of ranks has spent — the refund, and the number the UI shows. */
  const pointsSpent = (ranks: Record<string, number> | undefined) =>
    Object.entries(ranks || {}).reduce((s, [id, r]) => s + (byId[id] ? Math.min(byId[id].ranks, Math.max(0, r)) * cost : 0), 0);

  return { nodes, byId, branches, cost, ranks: RANKS, shallowNodes: SHALLOW_NODES, linesOf, pointsSpent };
}
