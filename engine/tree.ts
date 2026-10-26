/**
 * The passive tree, shared. `tools/data/tree.json` is the SPEC — wings, nodes, parents, grants,
 * layout — and this module derives the node list, geometry and the lines bought ranks grant. The cage
 * (`tools/tree.ts`) gates the same object the client spends, so a node cannot exist in one place and
 * not the other.
 *
 * A node grants ONE or MORE lines, values written in the file (D5): the tree's numbers are its own
 * and do not move when a loot line's maximum moves. A node's kind sets rank count, cost and currency;
 * a node is bought when connected to a path the character already owns. No node has an attribute
 * requirement (D3).
 */

export interface TreeGrant {
  /** The `mods.json` line this grant feeds. */
  id: string;
  /** What each rank grants. Never zero, never falling. */
  values: number[];
  /**
   * The one Core attribute a `stat_mod_flat` grant feeds — the targeted grant a normal node's profile
   * carries. Absent, the line feeds every Core attribute as before.
   */
  stat?: StatKey;
  /**
   * The Element a per-Element grant names (`elemental_power_flat`, `elemental_power`,
   * `elemental_resistance`, `elemental_resistance_cap_pct`) — a named Element joins its own pool, and
   * never rides the weapon's Element or the shared bucket instead.
   */
  element?: string;
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

export interface TreeCurrencyLevelRange {
  from: number;
  to: number;
  per: number;
}

export interface TreeCurrency {
  base: number;
  per_level?: number;
  level_ranges?: TreeCurrencyLevelRange[];
  sources?: { id: string; per: number }[];
}

export interface TreeLayoutCfg {
  algorithm: string;
  /** Irregular shared road field: its broad outer radius and nearest regular-cell spacing. */
  field_radius?: number;
  cell_spacing?: number;
  /** Empty space around the free Start before the road field begins. */
  root_clearance?: number;
  /** Number of short Normal-to-Normal alternatives to add over the spanning road network. */
  extra_routes?: number;
  /** Stable seed for positions, region patches and route selection. */
  seed?: number;
  start: { x: number; y: number };
  /** The angle each wing's middle sits at, in degrees — the v2 radial layout. */
  wing_anchor_deg?: Record<string, number>;
  nodes_per_ring?: number;
  /** The distance between road rows, or legacy depths. */
  ring_gap?: number;
  /** The widest an arc of lanes may spread, before the wing's own pitch narrows it. */
  arc_span_deg?: number;
  /** The gap left between two neighbouring wings, so their arcs never meet. */
  wing_clearance_deg?: number;
  /** The radius a node occupies; two nodes may not sit closer than twice it (v2). */
  node_radius?: number;
  /** v3: attribute regions in clockwise order. */
  regions?: string[];
  /** v3: distance between two neighbouring spine nodes. */
  spine_step?: number;
  /** v3: distance between two neighbouring branch steps. */
  branch_step?: number;
  /** v3: a cluster's Notable sits this far off its branch line. */
  notable_offset?: number;
  /** v3: a cluster's Keystone sits this far off its branch line. */
  keystone_offset?: number;
  /** v3: how far a junction Notable sits from the centre. */
  junction_radius?: number;
  /** v3: each node kind's own drawn radius. */
  radii?: Record<string, number>;
  /** v3: empty world margin around the outermost node. */
  padding?: number;
  /** Shared road anchors, local group silhouettes and leaf-pocket clearance. */
  web?: {
    sites: Record<string, { x: number; y: number; motif: number; turn: number }>;
    gateways?: Record<string, { anchor: string; offset: number[] }>;
    leaf_cluster_separation?: number;
    roads: { a: string; b: string; via: string[] }[];
    root_radius: number;
    motifs: { road: number[][]; notable: number[]; anchor: number; notable_next?: number; loop: boolean; turn: number }[];
    junction_offset: number;
    start_clearance: number;
    leaf_distances: number[];
    leaf_directions: number;
    leaf_clearance_preference: number;
    leaf_length_penalty: number;
  };
  /** poe-radial-v5: the medallion lattice, tiers and rim highway. */
  poe?: {
    cluster_lanes: number;
    cluster_bands: number[];
    cluster_ring_radius: number;
    keystone_lanes: number;
    keystone_bands: number[];
    spine_inner_count: number;
    spine_inner_radius: number;
    spine_outer_count: number;
    spine_outer_radius: number;
    junction_radius: number;
  };
}

/** A purchase connection outside the authoring `needs` spanning graph. */
export interface TreeLink {
  a: string;
  b: string;
  shape: 'line' | 'arc';
}

/** v3: two keystones that may not be held together. The pair is unordered. */
export interface TreeIncompatibility {
  a: string;
  b: string;
}

/** Stable v3 placement identities. The selected layout derives coordinates from these identities. */
export type TreePlacement =
  | { role: 'spine'; index: number }
  | { role: 'branch'; cluster: number; step: number }
  | { role: 'notable'; cluster: number; slot?: number }
  | { role: 'keystone'; cluster: number; slot?: number }
  | { role: 'junction'; a: string; b: string };

export interface TreeSpecNode {
  id: string;
  wing: string;
  kind: string;
  needs: string[];
  /** v2: the lines a node grants. v3 normal/notable nodes name a profile instead; a keystone's is empty. */
  grants?: TreeGrant[];
  /** v3: the profile whose grants this node resolves to. */
  profile?: string;
  /** v3: the recipe placement the engine turns into x/y. */
  placement?: TreePlacement;
  /** v3: the catalogue number this keystone was drafted from, for traceability only. */
  draft_ref?: number;
  weight?: number;
  name?: string;
  retired?: boolean;
  /** What a keystone does, in the words the board and the wiki show the player. */
  description?: string;
  weapon?: string;
  rule?: TreeRule;
  group?: string;
  /** The v3 keystone bundle: `{ kind: 'keystone', key, params }`, resolved through the registry. */
  effects?: { kind: string; key: string; params?: Record<string, number | string> }[];
}

/**
 * The global mechanics line of the keystone plan (§6): the cross-system constants that belong to the
 * tree's data and must not be re-typed in the sim. Optional on an older spec; a present section is
 * complete or the build refuses by key.
 */
export interface TreeMechanics {
  low_life_pct: number;
  hp_cost_floor: number;
  combat_time_units_per_sec: number;
  periodic_payment_sec: number;
  control_bucket_capacity_sec: number;
  camp_min_hp_per_sec: number;
}

/** The mechanics keys and what each one means when it is checked. */
const MECHANIC_KEYS: Record<keyof TreeMechanics, 'pct' | 'positive-int' | 'positive'> = {
  low_life_pct: 'pct',
  hp_cost_floor: 'positive',
  combat_time_units_per_sec: 'positive-int',
  periodic_payment_sec: 'positive',
  control_bucket_capacity_sec: 'positive',
  camp_min_hp_per_sec: 'positive',
};

function readMechanics(raw: unknown): TreeMechanics | null {
  if (raw === undefined) return null;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    throw new Error('tree spec: mechanics must be an object');
  const m = raw as Record<string, unknown>;
  for (const key of Object.keys(m))
    if (!Object.hasOwn(MECHANIC_KEYS, key)) throw new Error(`tree spec: mechanics carries the unknown key "${key}"`);
  const check = (key: string, kind: 'pct' | 'positive-int' | 'positive') => {
    const v = m[key];
    if (typeof v !== 'number' || !Number.isFinite(v))
      throw new Error(`tree spec: mechanics.${key} must be a finite number`);
    if (kind === 'pct' && !(v >= 0 && v <= 100))
      throw new Error(`tree spec: mechanics.${key} = ${v} is outside 0..100`);
    if (kind === 'positive' && !(v > 0))
      throw new Error(`tree spec: mechanics.${key} = ${v} must be above zero`);
    if (kind === 'positive-int' && !(Number.isSafeInteger(v) && v > 0))
      throw new Error(`tree spec: mechanics.${key} = ${v} must be a positive safe integer`);
  };
  for (const [key, kind] of Object.entries(MECHANIC_KEYS)) {
    if (!Object.hasOwn(m, key)) throw new Error(`tree spec: mechanics is missing "${key}"`);
    check(key, kind);
  }
  return m as unknown as TreeMechanics;
}

export interface TreeSpec {
  version: number;
  meta: { note: string; node_columns?: string[] };
  points: { currencies: Record<string, TreeCurrency>; budget_pct?: number };
  node_kinds: Record<string, TreeNodeKind>;
  /** v2 one-of families. v3 uses `incompatibilities` pairs instead and writes this empty. */
  keystone_groups: { id: string; name: string; members: string[] }[];
  clusters: unknown[];
  /** The v3 grant profiles: a core profile per region, and one per Notable. */
  profiles?: Record<string, TreeGrant[]>;
  /** v3 drawn connections that are not authoring parents. */
  links?: TreeLink[];
  /** v3 unordered pairs of keystones that may not be held together. */
  incompatibilities?: TreeIncompatibility[];
  /** The drafting aid for a line node whose values are not written out yet (v2). */
  rank_tiers?: { shallow: number[]; deep: number[] };
  /** How many of a wing's nodes are the shallow tier (v2). */
  shallow_nodes?: number;
  layout: TreeLayoutCfg;
  nodes: TreeSpecNode[];
  /** The §6 global mechanics line; absent on a spec older than the keystone plan. */
  mechanics?: TreeMechanics;
}

export interface TreeNode {
  id: string;
  wing: string;
  kind: string;
  /** The node's place in its wing, one-based — the id's own number. */
  index: number;
  /** v2's shallow/deep band; v3 has no tiers and leaves it absent. */
  tier?: 'shallow' | 'deep';
  name?: string;
  /** A keystone's effect, written for the player rather than the runtime. */
  description?: string;
  weapon?: string;
  grants: TreeGrant[];
  rule?: TreeRule;
  group?: string;
  /** The v3 profile a normal/notable node resolved its grants from. */
  profile?: string;
  /** The v3 recipe placement, kept for the cage and the board. */
  placement?: TreePlacement;
  /** The v3 catalogue number, for traceability only. */
  draft_ref?: number;
  weight?: number;
  /** The v3 bundle a keystone node carries; grantless nodes are legal in v3 (Packet M). */
  effects?: { kind: string; key: string; params?: Record<string, number | string> }[];
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
 *
 * A v3 spec has no drafting tables: every node is one rank with its grants or bundle written out, and
 * the schema is checked against the selected v3 layout recipe instead.
 */
function readSpec(spec: TreeSpec): { shallowNodes: number; ranks: number; v3: boolean } {
  if (!Array.isArray(spec.nodes) || spec.nodes.length === 0)
    throw new Error('tree spec: nodes must be a nonempty array');
  if (!spec.node_kinds || !Object.keys(spec.node_kinds).length)
    throw new Error('tree spec: node_kinds must name at least one kind');
  if (!spec.layout) throw new Error('tree spec: layout must be present');
  if (!spec.points || !spec.points.currencies || !Object.keys(spec.points.currencies).length)
    throw new Error('tree spec: points.currencies must name at least one currency');

  const v3 = spec.version >= 3;
  if (v3) {
    const kinds = Object.keys(spec.node_kinds);
    const unknown = kinds.filter((k) => !['normal', 'notable', 'keystone'].includes(k));
    if (unknown.length)
      throw new Error(`tree spec: v3 node_kinds carries ${unknown.join(', ')} — only normal, notable and keystone exist`);
    for (const [id, ranks, cost, currency] of [
      ['normal', 1, 1, 'tree'], ['notable', 1, 3, 'tree'], ['keystone', 1, 1, 'attainment'],
    ] as const) {
      const kind = spec.node_kinds[id];
      if (!kind) throw new Error(`tree spec: v3 node_kinds is missing "${id}"`);
      if (kind.ranks !== ranks || kind.cost !== cost || kind.currency !== currency)
        throw new Error(`tree spec: v3 kind ${id} must be ranks ${ranks}, cost ${cost}, ${currency}`);
    }
    if (!spec.profiles || typeof spec.profiles !== 'object')
      throw new Error('tree spec: v3 requires profiles');
    if (!spec.layout.regions?.length)
      throw new Error('tree spec: v3 layout requires regions');
    if (!['seven-spoke-v3', 'branch-weave-v4', 'poe-radial-v5', 'cluster-web-v6'].includes(spec.layout.algorithm))
      throw new Error(`tree spec: unsupported v3 layout algorithm ${spec.layout.algorithm}`);
    return { shallowNodes: 0, ranks: 1, v3: true };
  }

  const shallow = spec.rank_tiers?.shallow;
  const deep = spec.rank_tiers?.deep;
  if (!Array.isArray(shallow) || !Array.isArray(deep) || shallow.length === 0 || deep.length === 0)
    throw new Error('tree spec: rank_tiers.shallow and rank_tiers.deep must both be nonempty arrays');
  if (shallow.length !== deep.length)
    throw new Error(`tree spec: rank_tiers.shallow (${shallow.length}) and rank_tiers.deep (${deep.length}) must have the same length`);
  const shallowNodes = spec.shallow_nodes;
  if (!Number.isInteger(shallowNodes) || (shallowNodes as number) < 0)
    throw new Error('tree spec: shallow_nodes must be a whole number of nodes, zero or more');
  if (!spec.layout.wing_anchor_deg)
    throw new Error('tree spec: layout must carry wing_anchor_deg');
  return { shallowNodes: shallowNodes as number, ranks: shallow.length, v3: false };
}

import { STAT_KEYS, type StatKey } from './core-attributes.ts';
import { buildTreeNetwork } from './tree-network.ts';
import { validateKeystoneParams } from './keystones.ts';

/** What the builder of the tree must supply beyond the data: the canonical Elements, and the real
 *  handler table that decides whether a keystone bundle is purchasable (§6). */
export interface TreeBuildContext {
  elements?: readonly string[];
  keystoneSupported?: (key: string) => boolean;
}

/** The lines the sheet can express — the buckets `sumLines` holds before the per-Element ones. */
export interface TreeLine {
  id: string;
  value: number;
  /** The Core attribute a targeted stat grant feeds. */
  stat?: StatKey;
  /** The Element a per-Element grant names. */
  element?: string;
}

/** What a path costs, split by the wallet each step draws from — never added together. */
export interface TreePrice {
  tree: number;
  attainment: number;
}

export function createTree(
  spec: TreeSpec,
  mods: any,
  elements: readonly string[] = [],
  context: TreeBuildContext = {},
) {
  const { shallowNodes, ranks, v3 } = readSpec(spec);
  const mechanics = readMechanics(spec.mechanics);
  if (v3 && typeof context.keystoneSupported !== 'function')
    throw new Error('tree spec: v3 needs the real keystone handler table to validate its bundles');

  /** The one line whose grant may name a stat, and the lines whose grants may name an Element. */
  const STAT_GRANT_LINES = new Set(['stat_mod_flat']);
  const ELEMENT_GRANT_LINES = new Set([
    'elemental_power_flat', 'elemental_power', 'elemental_resistance', 'elemental_resistance_cap_pct',
  ]);
  /**
   * A grant's metadata is checked against what the sheet can hold, at build time: a stat on a line
   * that does not take one, an Element on a shared line, or a target nothing names would be a bought
   * rank that quietly does the wrong thing — or nothing. Each refusal names the node that carries it.
   */
  const checkGrant = (nodeId: string, grant: TreeGrant) => {
    if (grant.stat !== undefined) {
      if (!STAT_GRANT_LINES.has(grant.id))
        throw new Error(`tree spec: node ${nodeId} grants ${grant.id} with a stat — only stat_mod_flat takes one`);
      if (!STAT_KEYS.includes(grant.stat))
        throw new Error(`tree spec: node ${nodeId} grants the unknown stat "${grant.stat}"`);
    }
    if (grant.element !== undefined) {
      if (!ELEMENT_GRANT_LINES.has(grant.id))
        throw new Error(`tree spec: node ${nodeId} grants ${grant.id} with an element — only the per-Element lines take one`);
      if (!elements.includes(grant.element))
        throw new Error(`tree spec: node ${nodeId} grants the unknown element "${grant.element}"`);
    }
  };
  const maxOf = (id: string) => Number((mods.mods.find((m: any) => m.id === id) || {}).max ?? 0);
  const layout = spec.layout;
  const cost = (v3 ? spec.node_kinds.normal : spec.node_kinds.line)?.cost ?? 1;
  const allNodes = spec.nodes;
  const liveNodes = allNodes.filter((node) => !node.retired);
  const retired = new Set(allNodes.filter((node) => node.retired).map((node) => node.id));

  const specById = new Map<string, TreeSpecNode>();
  for (const node of liveNodes) {
    if (specById.has(node.id)) throw new Error(`tree spec: node id ${node.id} is used twice`);
    specById.set(node.id, node);
  }

  /** v3: a node's written grants come from its profile; a normal's profile is its region's Core. */
  const profiles = spec.profiles || {};
  const profileGrants = new Map<string, TreeGrant[]>();
  const profilesUsed = new Set<string>();
  const keystoneKeys = new Set<string>();
  const resolveProfile = (node: TreeSpecNode): TreeGrant[] => {
    const key = node.profile;
    if (!key) throw new Error(`tree spec: node ${node.id} names no profile`);
    const grants = profiles[key];
    if (!Array.isArray(grants) || !grants.length)
      throw new Error(`tree spec: node ${node.id} names the profile ${key}, which grants nothing`);
    profilesUsed.add(key);
    for (const grant of grants) checkGrant(node.id, grant);
    if (node.kind === 'normal') {
      if (key !== `core.${node.wing}`)
        throw new Error(`tree spec: the normal node ${node.id} must use core.${node.wing}, not ${key}`);
      const grant = grants[0];
      if (grants.length !== 1 || grant.id !== 'stat_mod_flat' || grant.stat !== node.wing || grant.values.length !== 1 || grant.values[0] !== 1)
        throw new Error(`tree spec: the normal node ${node.id} must grant exactly +1 ${node.wing} through stat_mod_flat`);
    }
    return grants;
  };

  for (const node of liveNodes) {
    for (const parent of node.needs) {
      if (parent === node.id) throw new Error(`tree spec: node ${node.id} needs itself`);
      if (parent !== 'start' && !specById.has(parent))
        throw new Error(`tree spec: node ${node.id} needs ${parent}, which is not a node`);
    }
    if (!spec.node_kinds[node.kind]) throw new Error(`tree spec: node ${node.id} has the unknown kind ${node.kind}`);
    if (node.weight !== undefined && (!Number.isSafeInteger(node.weight) || node.weight < 1 || node.weight > 5))
      throw new Error(`tree spec: node ${node.id} has the weight ${node.weight}, outside 1..5`);
    if (v3) {
      if (node.rule)
        throw new Error(`tree spec: node ${node.id} carries a rule — v3 keystones use bundles only`);
      const placement = node.placement;
      if (!placement) throw new Error(`tree spec: the v3 node ${node.id} has no placement`);
      const expected = placement.role === 'spine' || placement.role === 'branch' ? 'normal'
        : placement.role === 'notable' || placement.role === 'junction' ? 'notable'
        : placement.role === 'keystone' ? 'keystone'
        : null;
      if (!expected) throw new Error(`tree spec: node ${node.id} has the unknown placement role "${(placement as { role: string }).role}"`);
      if (node.kind !== expected)
        throw new Error(`tree spec: the ${node.kind} node ${node.id} sits at a ${placement.role} placement`);
      if (node.kind === 'keystone') {
        if (node.profile) throw new Error(`tree spec: the keystone ${node.id} carries a profile — it carries a bundle`);
        if (node.grants && node.grants.length)
          throw new Error(`tree spec: the keystone ${node.id} grants a stat line — v3 keystones are grantless`);
        if (!node.effects || node.effects.length !== 1)
          throw new Error(`tree spec: the keystone ${node.id} must carry exactly one bundle`);
        const effect = node.effects[0];
        if (effect.kind !== 'keystone')
          throw new Error(`tree spec: the keystone ${node.id} carries the effect kind "${effect.kind}"`);
        if (effect.key !== node.id.replace(/^keystone\./, ''))
          throw new Error(`tree spec: the keystone ${node.id} names the bundle "${effect.key}"`);
        if (keystoneKeys.has(effect.key)) throw new Error(`tree spec: the keystone bundle "${effect.key}" is used twice`);
        keystoneKeys.add(effect.key);
        validateKeystoneParams(effect.key, effect.params ?? {}, elements);
        if (!context.keystoneSupported!(effect.key))
          throw new Error(`tree spec: the keystone "${effect.key}" has no complete handler in the runtime table`);
      } else {
        if (node.effects && node.effects.length)
          throw new Error(`tree spec: the ${node.kind} node ${node.id} carries a keystone bundle`);
        if (node.grants && node.grants.length)
          throw new Error(`tree spec: the ${node.kind} node ${node.id} writes grants — v3 uses a profile`);
        profileGrants.set(node.id, resolveProfile(node));
      }
      continue;
    }
    if (!node.grants || !node.grants.length) throw new Error(`tree spec: node ${node.id} grants no line`);
    for (const grant of node.grants) checkGrant(node.id, grant);
    if (node.rule && !RULE_KINDS.includes(node.rule.kind as (typeof RULE_KINDS)[number])) {
      throw new Error(`tree spec: node ${node.id} has the rule "${node.rule.kind}", which is not one of ${RULE_KINDS.join(' · ')}`);
    }
  }

  // ---- the authoring parents are a DAG: a cycle would make a node need itself, directly or through
  // the chain, and no purchase path could ever enter it.
  {
    const state = new Map<string, 1 | 2>();
    const visit = (id: string) => {
      if (state.get(id) === 1) throw new Error(`tree spec: the needs chain through ${id} forms a cycle`);
      if (state.get(id) === 2) return;
      state.set(id, 1);
      for (const parent of specById.get(id)!.needs) if (parent !== 'start') visit(parent);
      state.set(id, 2);
    };
    for (const node of liveNodes) visit(node.id);
  }

  // ---- v3 graph edges: the authoring `needs` plus the drawn `links` form one undirected graph. The
  // links are what rings two regions together, so they are edges a purchase may cross as well (§3).
  const keyOf = (a: string, b: string) => (a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`);
  const links = v3 ? (spec.links || []) : [];
  const edgeKeys = new Set<string>();
  for (const node of liveNodes) for (const parent of node.needs) {
    if (parent === 'start') continue;
    const key = keyOf(node.id, parent);
    if (edgeKeys.has(key)) throw new Error(`tree spec: node ${node.id} needs ${parent} twice`);
    edgeKeys.add(key);
  }
  const linkKeys = new Set<string>();
  for (const link of links) {
    if (!specById.has(link.a) || !specById.has(link.b))
      throw new Error(`tree spec: the link ${link.a} – ${link.b} names a node that does not exist`);
    if (link.a === link.b) throw new Error(`tree spec: the link ${link.a} joins a node to itself`);
    if (link.shape !== 'line' && link.shape !== 'arc')
      throw new Error(`tree spec: the link ${link.a} – ${link.b} has the unknown shape "${link.shape}"`);
    const key = keyOf(link.a, link.b);
    if (linkKeys.has(key)) throw new Error(`tree spec: the link ${link.a} – ${link.b} is written twice`);
    if (edgeKeys.has(key)) throw new Error(`tree spec: the link ${link.a} – ${link.b} repeats a needs edge`);
    linkKeys.add(key);
  }

  // ---- v3 pairwise incompatibilities: an unordered pair of keystones. Only the listed pairs are
  // banned — there is no transitive closure, and a pair not in the file may be held together (§3).
  const incompatibilities = v3 ? (spec.incompatibilities || []) : [];
  const pairKeys = new Set<string>();
  const pairMap = new Map<string, Set<string>>();
  for (const pair of incompatibilities) {
    const a = specById.get(pair.a);
    const b = specById.get(pair.b);
    if (!a || !b) throw new Error(`tree spec: the incompatibility ${pair.a} – ${pair.b} names a node that does not exist`);
    if (pair.a === pair.b) throw new Error(`tree spec: the keystone ${pair.a} is incompatible with itself`);
    if (a.kind !== 'keystone' || b.kind !== 'keystone')
      throw new Error(`tree spec: the incompatibility ${pair.a} – ${pair.b} must join two keystones`);
    const key = keyOf(pair.a, pair.b);
    if (pairKeys.has(key)) throw new Error(`tree spec: the incompatibility ${pair.a} – ${pair.b} is written twice`);
    pairKeys.add(key);
    if (!pairMap.has(pair.a)) pairMap.set(pair.a, new Set());
    if (!pairMap.has(pair.b)) pairMap.set(pair.b, new Set());
    pairMap.get(pair.a)!.add(pair.b);
    pairMap.get(pair.b)!.add(pair.a);
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
  for (const cluster of clusters) {
    for (const grant of cluster.grants || []) checkGrant(`cluster ${cluster.id}`, grant);
  }

  // ---- canonical geometry: legacy spokes or the distributed branch-and-loop road field.
  // The same spec always gives the same coordinates and the board uses them directly.
  const wings = v3 ? (layout.regions as string[]) : [...new Set(liveNodes.map((n) => n.wing))];
  const pitch = 360 / wings.length;
  const arcSpan = v3 ? 0 : Math.min(layout.arc_span_deg!, pitch - layout.wing_clearance_deg!);
  const coord = new Map<string, { x: number; y: number }>();
  let crosslinkDepths: number[] = [];

  if (v3 && ['branch-weave-v4', 'poe-radial-v5', 'cluster-web-v6'].includes(layout.algorithm)) {
    for (const [id, point] of buildTreeNetwork(allNodes, layout).positions) coord.set(id, point);
  } else if (v3) {
    const start = layout.start;
    const spineStep = layout.spine_step ?? 25;
    const branchStep = layout.branch_step ?? 12;
    const notableOffset = layout.notable_offset ?? 72;
    const keystoneOffset = layout.keystone_offset ?? 90;
    const junctionRadius = layout.junction_radius ?? 125 * Math.cos(Math.PI / 7);
    const regionIndex = new Map(wings.map((r, i) => [r, i]));
    const axesOf = (region: string) => {
      const i = regionIndex.get(region);
      if (i === undefined) throw new Error(`tree spec: the region ${region} is not in layout.regions`);
      const a = (-90 + i * 360 / wings.length) * Math.PI / 180;
      return { ux: Math.cos(a), uy: Math.sin(a), vx: -Math.sin(a), vy: Math.cos(a) };
    };
    /** A cluster's base point and the perpendicular its branch line runs along. */
    const clusterAxes = (region: string, cluster: number) => {
      if (!Number.isInteger(cluster) || cluster < 1 || cluster > 12)
        throw new Error(`tree spec: a cluster index must run 1..12, got ${cluster}`);
      const { ux, uy, vx, vy } = axesOf(region);
      const distance = spineStep * (cluster + 7);
      const sign = cluster % 2 === 1 ? 1 : -1;
      return { bx: distance * ux, by: distance * uy, sx: sign * vx, sy: sign * vy };
    };
    for (const node of liveNodes) {
      const p = node.placement;
      if (!p) throw new Error(`tree spec: the v3 node ${node.id} has no placement`);
      let x = 0;
      let y = 0;
      if (p.role === 'spine') {
        if (!Number.isInteger(p.index) || p.index < 1 || p.index > 20)
          throw new Error(`tree spec: the spine node ${node.id} has index ${p.index}`);
        const { ux, uy } = axesOf(node.wing);
        x = spineStep * p.index * ux;
        y = spineStep * p.index * uy;
      } else if (p.role === 'branch') {
        if (!Number.isInteger(p.step) || p.step < 1 || p.step > 5)
          throw new Error(`tree spec: the branch node ${node.id} has step ${p.step}`);
        const { bx, by, sx, sy } = clusterAxes(node.wing, p.cluster);
        x = bx + sx * branchStep * p.step;
        y = by + sy * branchStep * p.step;
      } else if (p.role === 'notable' || p.role === 'keystone') {
        const { bx, by, sx, sy } = clusterAxes(node.wing, p.cluster);
        // Secondary gates retain a separate coordinate in the legacy spoke view as well.
        const offset = (p.role === 'notable' ? notableOffset : keystoneOffset) * (p.slot === 2 ? 1.45 : 1);
        x = bx + sx * offset;
        y = by + sy * offset;
      } else {
        const ia = regionIndex.get(p.a);
        const ib = regionIndex.get(p.b);
        if (ia === undefined || ib === undefined || ia === ib)
          throw new Error(`tree spec: the junction ${node.id} must name two different regions`);
        // the short way round: the last-to-first pair passes through the top, never the long arc
        let span = ib - ia;
        if (span < 0) span += wings.length;
        const mid = (-90 + (ia + span / 2) * 360 / wings.length) * Math.PI / 180;
        x = junctionRadius * Math.cos(mid);
        y = junctionRadius * Math.sin(mid);
      }
      coord.set(node.id, { x: start.x + x, y: start.y + y });
    }
  } else {
    for (const wing of wings) {
      if (layout.wing_anchor_deg![wing] === undefined)
        throw new Error(`tree spec: the wing ${wing} has no anchor in layout.wing_anchor_deg`);
    }
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
      const list = liveNodes.filter((n) => n.wing === wing);
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
      Math.max(0, ...liveNodes.filter((n) => n.wing === wing).map((n) => (lane.get(n.id) ?? 0) + 1));

    /** The depths at which a wing is ringed to its neighbour — the cross-links, read off the topology. */
    crosslinkDepths = (() => {
      const depths = new Set<number>();
      for (const node of liveNodes) {
        const d = depthOf(node.id);
        for (const parent of node.needs) {
          if (parent === 'start') continue;
          const p = specById.get(parent);
          if (p && p.wing !== node.wing) depths.add(d);
        }
      }
      return [...depths].sort((a, b) => a - b);
    })();

    for (const specNode of liveNodes) {
      const wing = specNode.wing;
      const d = depthOf(specNode.id);
      const l = lane.get(specNode.id) ?? 0;
      const laneCount = laneCountOf(wing);
      const laneSpan = arcSpan / Math.max(1, laneCount - 1);
      const anchor = (layout.wing_anchor_deg![wing] + (l - (laneCount - 1) / 2) * laneSpan) * Math.PI / 180;
      const radius = layout.ring_gap! * d;
      coord.set(specNode.id, {
        x: layout.start.x + Math.cos(anchor) * radius,
        y: layout.start.y + Math.sin(anchor) * radius,
      });
    }
  }

  const radiusOf = (kind: string): number =>
    v3 ? Number(layout.radii?.[kind] ?? (kind === 'keystone' ? 9 : kind === 'notable' ? 7 : 3.5))
      : Number(layout.node_radius ?? 0);

  const nodes: TreeNode[] = [];
  for (const specNode of liveNodes) {
    const kind = spec.node_kinds[specNode.kind];
    const wing = specNode.wing;
    const wingIndex = liveNodes.filter((n) => n.wing === wing).findIndex((n) => n.id === specNode.id) + 1;
    const grants = v3 ? (profileGrants.get(specNode.id) ?? []) : specNode.grants!;
    const first = grants[0];
    const at = coord.get(specNode.id)!;
    nodes.push({
      id: specNode.id,
      wing,
      kind: specNode.kind,
      index: wingIndex,
      ...(v3 ? {} : { tier: wingIndex <= shallowNodes ? 'shallow' as const : 'deep' as const }),
      ...(specNode.name ? { name: specNode.name } : {}),
      ...(specNode.description ? { description: specNode.description } : {}),
      ...(specNode.weapon ? { weapon: specNode.weapon } : {}),
      grants,
      ...(specNode.rule ? { rule: specNode.rule } : {}),
      ...(specNode.group ? { group: specNode.group } : {}),
      ...(specNode.profile ? { profile: specNode.profile } : {}),
      ...(specNode.placement ? { placement: specNode.placement } : {}),
      ...(specNode.draft_ref !== undefined ? { draft_ref: specNode.draft_ref } : {}),
      ...(specNode.weight !== undefined ? { weight: specNode.weight } : {}),
      ...(specNode.effects ? { effects: specNode.effects } : {}),
      line: first?.id ?? '',
      values: first?.values ?? [],
      max: first ? maxOf(first.id) : 0,
      x: at.x,
      y: at.y,
      needs: specNode.needs,
      ranks: kind.ranks,
      points: kind.ranks * kind.cost,
      cost: kind.cost,
      currency: kind.currency,
    });
  }
  const byId: Record<string, TreeNode> = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const branches = wings;

  // ---- the runtime graph: `needs` and `links` are one undirected adjacency. Start is not a node, so
  // a root is any node whose needs name it. Both the region rings (links) and the authoring parents
  // are edges a purchase may cross (§3).
  const adjacency = new Map<string, Set<string>>(nodes.map((n) => [n.id, new Set<string>()]));
  const connect = (a: string, b: string) => {
    adjacency.get(a)!.add(b);
    adjacency.get(b)!.add(a);
  };
  for (const node of nodes)
    for (const parent of node.needs) if (parent !== 'start') connect(node.id, parent);
  for (const link of links) connect(link.a, link.b);

  const rankOf = (id: string, ranks: Record<string, number> | undefined) => {
    const node = byId[id];
    if (!node) return 0;
    return Math.max(0, Math.min(node.ranks, Math.floor(ranks?.[id] ?? 0)));
  };
  const ownedSet = (ranks: Record<string, number> | undefined) => {
    const out = new Set<string>();
    for (const id of Object.keys(ranks ?? {})) if (rankOf(id, ranks) > 0) out.add(id);
    return out;
  };
  const adjacentTo = (id: string): string[] => [...(adjacency.get(id) ?? [])];

  /** The world the board pans over: every node's box, plus the v3 margin. */
  const world = (() => {
    const padding = v3 ? (layout.padding ?? 16) : 0;
    const x = Math.min(...nodes.map((n) => n.x - radiusOf(n.kind))) - padding;
    const y = Math.min(...nodes.map((n) => n.y - radiusOf(n.kind))) - padding;
    return {
      x, y,
      width: Math.max(...nodes.map((n) => n.x + radiusOf(n.kind))) + padding - x,
      height: Math.max(...nodes.map((n) => n.y + radiusOf(n.kind))) + padding - y,
    };
  })();

  /** The lines the bought ranks grant, in the shape `sumLines` accumulates — one entry per grant,
   *  carrying the grant's own stat/Element so a targeted rank feeds its target alone. */
  function linesOf(ranks: Record<string, number> | undefined, weaponName = ''): TreeLine[] {
    const out: TreeLine[] = [];
    for (const [id, rank] of Object.entries(ranks || {})) {
      const node = byId[id];
      if (!node) continue;
      if (node.weapon && node.weapon !== weaponName) continue;
      const r = Math.max(0, Math.min(node.ranks, Math.floor(rank)));
      if (r > 0) for (const grant of node.grants) out.push({
        id: grant.id, value: grant.values[r - 1] ?? 0,
        ...(grant.stat !== undefined ? { stat: grant.stat } : {}),
        ...(grant.element !== undefined ? { element: grant.element } : {}),
      });
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
   * The nodes a point can open right now: the ones with an owned node across any graph edge and not
   * already at their kind's rank cap. `needs` is an OR, and a `link` counts as an edge too, so a
   * region ring opens a node from the neighbouring region just like a parent does.
   */
  const reachableFrom = (ranks: Record<string, number> | undefined) => {
    const owned = ownedSet(ranks);
    const out = new Set<string>();
    for (const node of nodes) {
      if (rankOf(node.id, ranks) >= node.ranks) continue;
      if (node.needs.includes('start') || adjacentTo(node.id).some((id) => owned.has(id))) out.add(node.id);
    }
    return out;
  };

  /** Is a node adjacent to an owned node (or the free start)? Ownership is the only unlock (D3). */
  const connected = (nodeId: string, ranks: Record<string, number> | undefined) => {
    const node = byId[nodeId];
    if (!node) return false;
    if (node.needs.includes('start')) return true;
    const owned = ownedSet(ranks);
    return adjacentTo(nodeId).some((id) => owned.has(id));
  };

  /** The owned keystone that bans this one, if any. Only the file's pairs count — no transitive
   *  closure, so a keystone outside every listed pair stays free (§3). */
  const pairHolder = (nodeId: string, ranks: Record<string, number> | undefined) => {
    for (const other of pairMap.get(nodeId) ?? []) if (rankOf(other, ranks) > 0) return other;
    return null;
  };

  /** Is a keystone free of every listed pair? v2 has no pairs, so it is always free. */
  const pairOk = (nodeId: string, ranks: Record<string, number> | undefined) =>
    pairHolder(nodeId, ranks) === null;

  /** The first listed pair an allocation holds together — what an import validator refuses. */
  const conflictsIn = (ranks: Record<string, number> | undefined) => {
    for (const pair of incompatibilities)
      if (rankOf(pair.a, ranks) > 0 && rankOf(pair.b, ranks) > 0) return pair;
    return null;
  };

  /** Can the node be bought on connectivity, cap and pairs alone? The wallet is the sim's call. */
  const canOpen = (nodeId: string, ranks: Record<string, number> | undefined) => {
    const node = byId[nodeId];
    if (!node || rankOf(nodeId, ranks) >= node.ranks) return false;
    if (v3 && !pairOk(nodeId, ranks)) return false;
    return connected(nodeId, ranks);
  };

  /** What a purchase sequence costs, split by wallet — the two currencies are never added together. */
  const priceOf = (ids: readonly string[]): TreePrice => {
    let tree = 0;
    let attainment = 0;
    for (const id of ids) {
      const node = byId[id];
      if (!node) continue;
      if (node.currency === 'tree') tree += node.cost;
      else attainment += node.cost;
    }
    return { tree, attainment };
  };

  /**
   * v2's path: the node itself and every node it needs that is not owned yet, deepest parent first,
   * so the caller can buy it in reverse (D7).
   */
  const legacyPathTo = (nodeId: string, ranks: Record<string, number> | undefined) => {
    const wanted: string[] = [];
    const seen = new Set<string>();
    const walk = (id: string) => {
      if (seen.has(id)) return;
      seen.add(id);
      const node = byId[id];
      if (!node) return;
      if (rankOf(id, ranks) > 0) return;   // an owned node is the frontier: its own path is spent
      wanted.push(id);
      for (const parent of node.needs) if (parent !== 'start') walk(parent);
    };
    walk(nodeId);
    return wanted;
  };

  const cmpSequence = (a: string[], b: string[]) => {
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
    return a.length - b.length;
  };

  /**
   * v3's path (D7): the cheapest purchase sequence from the owned frontier to a node over the
   * undirected graph. Every owned node is a zero-cost root, a normal costs 1, a Notable costs 3, and a
   * Keystone target costs 1 attainment instead of Tree Points and may not be walked through before it
   * is owned. Ties go to the lexically smallest purchase-ID sequence; the returned order is the order
   * in which the path is bought (frontier first, target last).
   */
  const graphPathTo = (nodeId: string, ranks: Record<string, number> | undefined) => {
    const target = byId[nodeId];
    if (!target || rankOf(nodeId, ranks) > 0) return [];
    const weightOf = (node: TreeNode) => (node.currency === 'tree' ? node.cost : 0);

    // Dijkstra, seeded with every owned node and every root. A linear scan is plenty for ~700 nodes.
    const dist = new Map<string, number>();
    const settled = new Set<string>();
    for (const node of nodes) {
      if (rankOf(node.id, ranks) > 0) dist.set(node.id, 0);
      else if (node.needs.includes('start')) dist.set(node.id, weightOf(node));
    }
    for (;;) {
      let u: string | null = null;
      let best = Number.POSITIVE_INFINITY;
      for (const [id, d] of dist) {
        if (settled.has(id) || d >= best) continue;
        best = d;
        u = id;
      }
      if (u === null) break;
      settled.add(u);
      // an unpurchased Keystone is a target, never a corridor
      if (rankOf(u, ranks) === 0 && byId[u].kind === 'keystone') continue;
      for (const v of adjacentTo(u)) {
        if (rankOf(v, ranks) > 0 || settled.has(v)) continue;
        const node = byId[v];
        if (node.kind === 'keystone' && v !== nodeId) continue;
        const next = best + weightOf(node);
        if (next < (dist.get(v) ?? Number.POSITIVE_INFINITY)) dist.set(v, next);
      }
    }
    if (!dist.has(nodeId)) return [];

    // Among the shortest paths, pick the lexically smallest purchase sequence. Distances rise along
    // every entered normal/notable, so the shortest-path graph can be walked in distance order.
    const sequence = new Map<string, string[]>();
    const ordered = [...dist.keys()]
      .filter((id) => byId[id] && rankOf(id, ranks) === 0 && byId[id].kind !== 'keystone')
      .sort((a, b) => (dist.get(a)! - dist.get(b)!) || (a < b ? -1 : a > b ? 1 : 0));
    for (const id of ordered) {
      const node = byId[id];
      const entry = weightOf(node);
      let bestSeq: string[] | null = null;
      const offer = (prefix: readonly string[]) => {
        const candidate = [...prefix, id];
        if (bestSeq === null || cmpSequence(candidate, bestSeq) < 0) bestSeq = candidate;
      };
      if (node.needs.includes('start') && dist.get(id) === entry) offer([]);
      for (const u of adjacentTo(id)) {
        if (rankOf(u, ranks) > 0) {
          if (dist.get(id) === entry) offer([]);
          continue;
        }
        const prefix = sequence.get(u);
        if (prefix && dist.get(u)! + entry === dist.get(id)) offer(prefix);
      }
      if (bestSeq) sequence.set(id, bestSeq);
    }

    if (target.kind !== 'keystone') return sequence.get(nodeId) ?? [];
    let bestSeq: string[] | null = null;
    for (const u of adjacentTo(nodeId)) {
      let candidate: string[] | null = null;
      if (rankOf(u, ranks) > 0) candidate = [nodeId];
      else {
        const prefix = sequence.get(u);
        if (prefix && dist.get(u)! === dist.get(nodeId)) candidate = [...prefix, nodeId];
      }
      if (candidate && (bestSeq === null || cmpSequence(candidate, bestSeq) < 0)) bestSeq = candidate;
    }
    return bestSeq ?? [];
  };

  /** The nodes to buy, in purchase order. v2 keeps its authoring-parent walk; v3 uses the graph. */
  const pathTo = (nodeId: string, ranks: Record<string, number> | undefined) =>
    v3 ? graphPathTo(nodeId, ranks) : legacyPathTo(nodeId, ranks);

  /** The path's price, split by wallet. An owned or unknown target costs nothing. */
  const pathCost = (nodeId: string, ranks: Record<string, number> | undefined): TreePrice =>
    priceOf(pathTo(nodeId, ranks));

  /** Is a node's keystone group free? Holding one member of a group blocks its siblings (D1, v2). */
  const groupOk = (nodeId: string, ranks: Record<string, number> | undefined) => {
    const node = byId[nodeId];
    if (!node?.group) return true;
    const group = groups.find((g) => g.id === node.group);
    if (!group) return true;
    for (const member of group.members) {
      if (member === nodeId) continue;
      if (rankOf(member, ranks) > 0) return false;
    }
    return true;
  };

  /** The sibling that already holds a node's keystone group, if one does (D1, v2). */
  const groupHolder = (nodeId: string, ranks: Record<string, number> | undefined) => {
    const node = byId[nodeId];
    if (!node?.group) return null;
    const group = groups.find((g) => g.id === node.group);
    if (!group) return null;
    for (const member of group.members) {
      if (member === nodeId) continue;
      if (rankOf(member, ranks) > 0) return member;
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
    const grants: TreeLine[] = [];
    for (const cluster of clusters) {
      const per = Math.max(1, cluster.condition?.per ?? 1);
      const earned = Math.floor(pointsInScope(cluster.condition?.scope ?? 'wing', cluster.condition?.target ?? '', ranks) / per);
      steps[cluster.id] = earned;
      for (let step = 0; step < earned; step++) {
        for (const grant of cluster.grants || []) {
          const values = grant.values || [];
          if (!values.length) continue;
          grants.push({
            id: grant.id, value: values[Math.min(step, values.length - 1)],
            ...(grant.stat !== undefined ? { stat: grant.stat } : {}),
            ...(grant.element !== undefined ? { element: grant.element } : {}),
          });
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
    const L = Math.max(1, Math.min(level, levelCap));
    if (Array.isArray(c.level_ranges) && c.level_ranges.length) {
      let total = c.base ?? 0;
      for (const r of c.level_ranges) {
        const from = Math.max(2, r.from);
        const to = Math.min(r.to, levelCap);
        const hi = Math.min(L, to);
        const count = Math.max(0, hi - from + 1);
        total += count * (r.per ?? 0);
      }
      return total;
    }
    return (c.base ?? 0) + Math.max(0, Math.min(level, levelCap) - 1) * (c.per_level ?? 0);
  };

  /**
   * The bought keystone bundles, in allocation order — the route from ranks to runtime effects.
   * A grantless keystone is still a node with a bundle (v3), so this never reads `grants`.
   */
  function keystoneBundles(ranks: Record<string, number> | undefined): { key: string; params: Record<string, number | string> }[] {
    const out: { key: string; params: Record<string, number | string> }[] = [];
    for (const [id, rank] of Object.entries(ranks || {})) {
      if (Math.floor(rank) <= 0) continue;
      const node = byId[id];
      if (!node || node.kind !== 'keystone') continue;
      for (const e of node.effects || [])
        if (e.kind === 'keystone' && e.key) out.push({ key: e.key, params: e.params || {} });
    }
    return out;
  }

   return {
    version: spec.version,
    /** The §6 global mechanics line, validated and read once — the sim never copies these numbers. */
    mechanics,
    nodes, byId, branches, cost, retired,
    /** The rank count an ordinary line node holds — its kind's own. */
    ranks: spec.node_kinds.line?.ranks ?? ranks,
    /** The rank ladder in the drafting tables, which a written-out value need not follow. */
    tierRanks: ranks,
    shallowNodes,
    /** The start marker the board draws, and the layout it draws over. */
    graph: { start: layout.start },
    layout: {
      ...world,
      nodeRadius: layout.node_radius ?? layout.radii?.normal ?? 3.5,
      ringGap: layout.ring_gap,
      arcSpan,
      pitch,
      ...(v3 ? { regions: wings, radii: layout.radii ?? {} } : {}),
    },
    currencies: spec.points.currencies,
    kinds: spec.node_kinds,
    crosslinkDepths,
    currency,
    pointsAt,
    pointsSpentByCurrency,
    reachableFrom,
    /** The undirected graph `needs` + `links` builds, and the reads that walk it. */
    adjacentTo,
    connected,
    canOpen,
    /** v3 pairwise bans; v2's one-of families stay in the group helpers. */
    pairOk,
    pairHolder,
    conflictsIn,
    groupOk,
    groupHolder,
    pathTo,
    pathCost,
    rulesOf,
    clusterState,
    groups: spec.keystone_groups || [],
    clusters: spec.clusters || [],
    /** v3 data the cage and the board read: drawn edges, banned pairs, and the resolved profiles. */
    links,
    incompatibilities,
    profiles,
    profilesUsed: [...profilesUsed],
    linesOf, pointsSpent,
    keystoneBundles,
  };
}
