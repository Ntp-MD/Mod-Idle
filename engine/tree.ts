/**
 * The passive tree, shared. `tools/data/tree.json` holds the SPEC — the wings, their nodes, their
 * parents, their grants and the layout parameters — and this module derives the node list, the
 * geometry and the lines the bought ranks grant. The cage (`tools/tree.ts`) gates the same object the
 * client spends, so a node cannot exist in one place and not the other.
 *
 * A node grants ONE or MORE lines, each with values written out in the file (D5): the tree's numbers
 * are the tree's own and do not move when a loot line's maximum moves. A node's kind sets its rank
 * count, its cost and the currency it is paid in, and a node is bought when it is connected to a path
 * the character already owns — there is no attribute requirement on any node (D3).
 */

export interface TreeGrant {
  /** The `mods.json` line this grant feeds. */
  id: string;
  /** What each rank grants. Never zero, never falling. */
  values: number[];
}

export interface TreeRule {
  /** One verb from the bounded vocabulary: cap_unlock · convert · remove · conditional · reserve. */
  kind: string;
  /** The line, Cap, Element or condition the verb names. */
  target: string;
  /** How much the verb moves, for the verbs that move a number. */
  value?: number;
}

/**
 * The verbs the sheet can express. A rule outside this set is refused by name: a tree that asked for
 * an effect the sheet cannot hold would be a node that is bought and does nothing.
 */
export const RULE_KINDS = ['cap_unlock', 'convert', 'remove'] as const;

export interface TreeNodeKind {
  ranks: number;
  cost: number;
  currency: string;
}

export interface TreeCurrency {
  base: number;
  per_level?: number;
  sources?: { id: string; per: number }[];
}

export interface TreeLayoutCfg {
  algorithm: string;
  start: { x: number; y: number };
  /** The angle each wing's middle sits at, in degrees. */
  wing_anchor_deg: Record<string, number>;
  nodes_per_ring: number;
  /** The distance between two depths. */
  ring_gap: number;
  /** The widest an arc of lanes may spread, before the wing's own pitch narrows it. */
  arc_span_deg: number;
  /** The gap left between two neighbouring wings, so their arcs never meet. */
  wing_clearance_deg: number;
  /** The radius a node occupies; two nodes may not sit closer than twice it. */
  node_radius: number;
}

export interface TreeSpecNode {
  id: string;
  wing: string;
  kind: string;
  needs: string[];
  grants: TreeGrant[];
  name?: string;
  weapon?: string;
  rule?: TreeRule;
  group?: string;
}

export interface TreeSpec {
  version: number;
  meta: { note: string; node_columns?: string[] };
  points: { currencies: Record<string, TreeCurrency>; budget_pct?: number };
  node_kinds: Record<string, TreeNodeKind>;
  keystone_groups: { id: string; name: string; members: string[] }[];
  clusters: unknown[];
  /** The drafting aid for a line node whose values are not written out yet. */
  rank_tiers: { shallow: number[]; deep: number[] };
  /** How many of a wing's nodes are the shallow tier. */
  shallow_nodes: number;
  layout: TreeLayoutCfg;
  nodes: TreeSpecNode[];
}

export interface TreeNode {
  id: string;
  wing: string;
  kind: string;
  /** The node's place in its wing, one-based — the id's own number. */
  index: number;
  tier: 'shallow' | 'deep';
  name?: string;
  weapon?: string;
  grants: TreeGrant[];
  rule?: TreeRule;
  group?: string;
  /**
   * The first grant's line and values, and that line's own maximum. The single-line shape the board
   * reads today; a node with several grants lists them all in `grants`.
   */
  line: string;
  values: number[];
  max: number;
  /** Graph position in the shared tree viewBox. */
  x: number;
  y: number;
  /** Any connected owned node opens this node; the start marker is the only free root. */
  needs: string[];
  ranks: number;
  points: number;
  /** What one rank of this node costs, and the currency it is paid in. */
  cost: number;
  currency: string;
}

/**
 * The spec's own shape, read before a node is built: the drafting tables, the shallow boundary, the
 * node kinds and the layout come from the data, so a spec that lost a key would otherwise build a
 * tree nobody asked for. Each refusal names the key that is wrong.
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
  if (!Array.isArray(spec.nodes) || spec.nodes.length === 0)
    throw new Error('tree spec: nodes must be a nonempty array');
  if (!spec.node_kinds || !Object.keys(spec.node_kinds).length)
    throw new Error('tree spec: node_kinds must name at least one kind');
  if (!spec.layout || !spec.layout.wing_anchor_deg)
    throw new Error('tree spec: layout must carry wing_anchor_deg');
  if (!spec.points || !spec.points.currencies || !Object.keys(spec.points.currencies).length)
    throw new Error('tree spec: points.currencies must name at least one currency');
  return { shallowNodes, ranks: shallow.length };
}

export function createTree(spec: TreeSpec, mods: any) {
  const { shallowNodes, ranks } = readSpec(spec);
  const maxOf = (id: string) => Number((mods.mods.find((m: any) => m.id === id) || {}).max ?? 0);
  const layout = spec.layout;
  const cost = spec.node_kinds.line?.cost ?? 1;

  const specById = new Map<string, TreeSpecNode>();
  for (const node of spec.nodes) {
    if (specById.has(node.id)) throw new Error(`tree spec: node id ${node.id} is used twice`);
    specById.set(node.id, node);
  }
  for (const node of spec.nodes) {
    for (const parent of node.needs) {
      if (parent !== 'start' && !specById.has(parent))
        throw new Error(`tree spec: node ${node.id} needs ${parent}, which is not a node`);
    }
    if (!spec.node_kinds[node.kind]) throw new Error(`tree spec: node ${node.id} has the unknown kind ${node.kind}`);
    if (!node.grants || !node.grants.length) throw new Error(`tree spec: node ${node.id} grants no line`);
    if (node.rule && !RULE_KINDS.includes(node.rule.kind as (typeof RULE_KINDS)[number])) {
      throw new Error(`tree spec: node ${node.id} has the rule "${node.rule.kind}", which is not one of ${RULE_KINDS.join(' · ')}`);
    }
  }

  // ---- the keystone groups (D1): a group is a one-of family, and holding a member blocks its
  // siblings. The shape is the loot engine's Stat Mod family, and the rule is the same.
  const groups = spec.keystone_groups || [];
  for (const group of groups) {
    if (!group.members || group.members.length < 2)
      throw new Error(`tree spec: the keystone group ${group.id} needs at least two members`);
    for (const member of group.members) {
      if (!specById.has(member)) throw new Error(`tree spec: the keystone group ${group.id} names ${member}, which is not a node`);
    }
  }
  const groupOf = new Map<string, string>();
  for (const group of groups) for (const member of group.members) groupOf.set(member, group.id);

  // ---- the clusters: a threshold node counts the points spent in a scope and grants a line per step
  const clusters = (spec.clusters || []) as {
    id: string; wing?: string;
    condition: { kind: string; scope: string; target: string; per: number };
    grants: TreeGrant[];
  }[];

  // ---- the layout (D6): the topology in `needs` decides each node's depth and lane, and the layout
  // block decides the geometry. The same spec always gives the same coordinates.
  const wings = [...new Set(spec.nodes.map((n) => n.wing))];
  for (const wing of wings) {
    if (layout.wing_anchor_deg[wing] === undefined)
      throw new Error(`tree spec: the wing ${wing} has no anchor in layout.wing_anchor_deg`);
  }
  const pitch = 360 / wings.length;
  const arcSpan = Math.min(layout.arc_span_deg, pitch - layout.wing_clearance_deg);

  const depth = new Map<string, number>();
  const depthOf = (id: string): number => {
    const known = depth.get(id);
    if (known !== undefined) return known;
    const node = specById.get(id)!;
    let d = 1;
    for (const parent of node.needs) {
      if (parent === 'start') continue;
      const p = specById.get(parent);
      // a parent in another wing is a cross-link: it connects the wings but does not deepen this one
      if (!p || p.wing !== node.wing) continue;
      d = Math.max(d, depthOf(parent) + 1);
    }
    depth.set(id, d);
    return d;
  };

  // A lane is a chain inside a wing. A node inherits its first in-wing parent's lane; where two
  // nodes at the same depth would share one, the later takes the next free lane.
  const lane = new Map<string, number>();
  for (const wing of wings) {
    const list = spec.nodes.filter((n) => n.wing === wing);
    const byDepth = new Map<number, TreeSpecNode[]>();
    for (const node of list) {
      const d = depthOf(node.id);
      const at = byDepth.get(d);
      if (at) at.push(node); else byDepth.set(d, [node]);
    }
    for (const d of [...byDepth.keys()].sort((a, b) => a - b)) {
      const used = new Set<number>();
      for (const node of byDepth.get(d)!) {
        const first = node.needs.find((p) => p !== 'start' && specById.get(p)?.wing === wing);
        let l = first ? (lane.get(first) ?? 0) : 0;
        while (used.has(l)) l++;
        used.add(l);
        lane.set(node.id, l);
      }
    }
  }
  const laneCountOf = (wing: string) =>
    Math.max(0, ...spec.nodes.filter((n) => n.wing === wing).map((n) => (lane.get(n.id) ?? 0) + 1));

  /** The depths at which a wing is ringed to its neighbour — the cross-links, read off the topology. */
  const crosslinkDepths = (() => {
    const depths = new Set<number>();
    for (const node of spec.nodes) {
      const d = depthOf(node.id);
      for (const parent of node.needs) {
        if (parent === 'start') continue;
        const p = specById.get(parent);
        if (p && p.wing !== node.wing) depths.add(d);
      }
    }
    return [...depths].sort((a, b) => a - b);
  })();

  const nodes: TreeNode[] = [];
  for (const specNode of spec.nodes) {
    const kind = spec.node_kinds[specNode.kind];
    const wing = specNode.wing;
    const d = depthOf(specNode.id);
    const l = lane.get(specNode.id) ?? 0;
    const laneCount = laneCountOf(wing);
    const laneSpan = arcSpan / Math.max(1, laneCount - 1);
    const anchor = (layout.wing_anchor_deg[wing] + (l - (laneCount - 1) / 2) * laneSpan) * Math.PI / 180;
    const radius = layout.ring_gap * d;
    const wingIndex = spec.nodes.filter((n) => n.wing === wing).findIndex((n) => n.id === specNode.id) + 1;
    const first = specNode.grants[0];
    nodes.push({
      id: specNode.id,
      wing,
      kind: specNode.kind,
      index: wingIndex,
      tier: wingIndex <= shallowNodes ? 'shallow' : 'deep',
      ...(specNode.name ? { name: specNode.name } : {}),
      ...(specNode.weapon ? { weapon: specNode.weapon } : {}),
      grants: specNode.grants,
      ...(specNode.rule ? { rule: specNode.rule } : {}),
      ...(specNode.group ? { group: specNode.group } : {}),
      line: first.id,
      values: first.values,
      max: maxOf(first.id),
      x: layout.start.x + Math.cos(anchor) * radius,
      y: layout.start.y + Math.sin(anchor) * radius,
      needs: specNode.needs,
      ranks: kind.ranks,
      points: kind.ranks * kind.cost,
      cost: kind.cost,
      currency: kind.currency,
    });
  }
  const byId: Record<string, TreeNode> = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const branches = wings;

  /** The world the board pans over: every node's box. */
  const world = (() => {
    const r = layout.node_radius;
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const x = Math.min(...xs) - r;
    const y = Math.min(...ys) - r;
    return { x, y, width: Math.max(...xs) + r - x, height: Math.max(...ys) + r - y };
  })();

  /** The lines the bought ranks grant, in the shape `sumLines` accumulates — one entry per grant. */
  function linesOf(ranks: Record<string, number> | undefined, weaponName = ''): { id: string; value: number }[] {
    const out: { id: string; value: number }[] = [];
    for (const [id, rank] of Object.entries(ranks || {})) {
      const node = byId[id];
      if (!node) continue;
      if (node.weapon && node.weapon !== weaponName) continue;
      const r = Math.max(0, Math.min(node.ranks, Math.floor(rank)));
      if (r > 0) for (const grant of node.grants) out.push({ id: grant.id, value: grant.values[r - 1] ?? 0 });
    }
    return out;
  }

  /** Points a set of ranks has spent — the refund, and the number the UI shows. */
  const pointsSpent = (ranks: Record<string, number> | undefined) =>
    Object.entries(ranks || {}).reduce((s, [id, r]) => {
      const node = byId[id];
      return s + (node ? Math.min(node.ranks, Math.max(0, r)) * node.cost : 0);
    }, 0);

  /** The points a set of ranks has spent, per currency — a keystone is paid in its own. */
  const pointsSpentByCurrency = (ranks: Record<string, number> | undefined) => {
    const out: Record<string, number> = {};
    for (const [id, r] of Object.entries(ranks || {})) {
      const node = byId[id];
      if (!node) continue;
      const spent = Math.min(node.ranks, Math.max(0, r)) * node.cost;
      out[node.currency] = (out[node.currency] ?? 0) + spent;
    }
    return out;
  };

  /**
   * The nodes a point can open right now: the ones whose parents include an owned path and which are
   * not already at their kind's rank cap. `needs` is an OR, so one owned parent opens the node.
   */
  const reachableFrom = (ranks: Record<string, number> | undefined) => {
    const owned = new Set(Object.entries(ranks || {}).filter(([, r]) => r > 0).map(([id]) => id));
    const out = new Set<string>();
    for (const node of nodes) {
      const rank = Math.max(0, Math.min(node.ranks, Math.floor(ranks?.[node.id] ?? 0)));
      if (rank >= node.ranks) continue;
      if (node.needs.includes('start') || node.needs.some((p) => owned.has(p))) out.add(node.id);
    }
    return out;
  };

  /**
   * The nodes on the path from the owned frontier to a node: the node itself and every node it
   * needs that is not owned yet, deepest parent first, so the path can be bought in that order (D7).
   */
  const pathTo = (nodeId: string, ranks: Record<string, number> | undefined) => {
    const wanted: string[] = [];
    const seen = new Set<string>();
    const walk = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      const node = byId[id];
      if (!node) return;
      if ((ranks?.[id] ?? 0) > 0) return;   // an owned node is the frontier: its own path is spent
      wanted.push(id);
      for (const parent of node.needs) if (parent !== 'start') walk(parent);
    };
    walk(nodeId);
    return wanted;
  };

  /** The points the path to a node would cost. */
  const pathCost = (nodeId: string, ranks: Record<string, number> | undefined) =>
    pathTo(nodeId, ranks).reduce((sum, id) => sum + (byId[id] ? byId[id].cost : 0), 0);

  /** Is a node's keystone group free? Holding one member of a group blocks its siblings (D1). */
  const groupOk = (nodeId: string, ranks: Record<string, number> | undefined) => {
    const node = byId[nodeId];
    if (!node?.group) return true;
    const group = groups.find((g) => g.id === node.group);
    if (!group) return true;
    for (const member of group.members) {
      if (member === nodeId) continue;
      if ((ranks?.[member] ?? 0) > 0) return false;
    }
    return true;
  };

  /** The sibling that already holds a node's keystone group, if one does (D1). */
  const groupHolder = (nodeId: string, ranks: Record<string, number> | undefined) => {
    const node = byId[nodeId];
    if (!node?.group) return null;
    const group = groups.find((g) => g.id === node.group);
    if (!group) return null;
    for (const member of group.members) {
      if (member === nodeId) continue;
      if ((ranks?.[member] ?? 0) > 0) return member;
    }
    return null;
  };

  /** The rules the owned ranks carry — what the sheet applies on top of the folded lines. */
  const rulesOf = (ranks: Record<string, number> | undefined) => {
    const out: { kind: string; target: string; value?: number; node: string }[] = [];
    for (const [id, r] of Object.entries(ranks || {})) {
      if (r <= 0) continue;
      const node = byId[id];
      if (node?.rule) out.push({ ...node.rule, node: id });
    }
    return out;
  };

  /** The points a set of ranks has spent inside a scope — a wing, or the whole tree. */
  const pointsInScope = (scope: string, target: string, ranks: Record<string, number> | undefined) => {
    let total = 0;
    for (const [id, r] of Object.entries(ranks || {})) {
      const node = byId[id];
      if (!node) continue;
      if (scope === 'tree' || (scope === 'wing' && node.wing === target)) {
        total += Math.min(node.ranks, Math.max(0, r)) * node.cost;
      }
    }
    return total;
  };

  /** The steps every cluster has earned, and the lines those steps grant. */
  const clusterState = (ranks: Record<string, number> | undefined) => {
    const steps: Record<string, number> = {};
    const grants: { id: string; value: number }[] = [];
    for (const cluster of clusters) {
      const per = Math.max(1, cluster.condition?.per ?? 1);
      const earned = Math.floor(pointsInScope(cluster.condition?.scope ?? 'wing', cluster.condition?.target ?? '', ranks) / per);
      steps[cluster.id] = earned;
      for (let step = 0; step < earned; step++) {
        for (const grant of cluster.grants || []) {
          const values = grant.values || [];
          if (!values.length) continue;
          grants.push({ id: grant.id, value: values[Math.min(step, values.length - 1)] });
        }
      }
    }
    return { steps, grants };
  };

  /**
   * The tree points a level has paid out — the tree's own point economy, which the spec owns: the
   * base it starts with plus the rate a level grants, up to the level cap.
   */
  const currency = (id: string): TreeCurrency => spec.points.currencies[id] || { base: 0 };
  const pointsAt = (level: number, levelCap = Number.POSITIVE_INFINITY) => {
    const c = currency('tree');
    return (c.base ?? 0) + Math.max(0, Math.min(level, levelCap) - 1) * (c.per_level ?? 0);
  };

  return {
    nodes, byId, branches, cost,
    /** The rank count an ordinary line node holds — its kind's own. */
    ranks: spec.node_kinds.line?.ranks ?? ranks,
    /** The rank ladder in the drafting tables, which a written-out value need not follow. */
    tierRanks: ranks,
    shallowNodes,
    /** The start marker the board draws, and the layout it draws over. */
    graph: { start: layout.start },
    layout: { ...world, nodeRadius: layout.node_radius, ringGap: layout.ring_gap, arcSpan, pitch },
    currencies: spec.points.currencies,
    kinds: spec.node_kinds,
    crosslinkDepths,
    currency,
    pointsAt,
    pointsSpentByCurrency,
    reachableFrom,
    groupOk,
    groupHolder,
    pathTo,
    pathCost,
    rulesOf,
    clusterState,
    groups: spec.keystone_groups || [],
    clusters: spec.clusters || [],
    linesOf, pointsSpent,
  };
}
