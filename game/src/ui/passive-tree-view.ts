import type { TreeNode } from '../../../engine/tree';

export interface TreeViewCluster {
  id: string;
  wing: string;
  x: number;
  y: number;
  radius: number;
}

const TAU = Math.PI * 2;
const SPINE_BASE = 100;
const SPINE_STEP = 19;
const CLUSTER_BASE = 240;
const CLUSTER_STEP = 116;
const CLUSTER_RADIUS = 21;
const CLUSTER_SLOTS = [-0.36, -0.18, 0.18, 0.36];
const KEYSTONE_REACH = 2;
const JUNCTION_RADIUS = 165;
const RIM_RADIUS = 532;
const hash = (value: number) => { const x = Math.sin(value * 127.1) * 43758.5453; return x - Math.floor(x); };

/** Presentation only: lay the seven regions out as one PoE-style disc — a spine ray per region and
 * twelve small cluster rings beside it, with junctions bridging neighbouring regions.
 * IDs, grants, costs and connections remain the canonical engine nodes. */
export function buildPassiveTreeView(nodes: TreeNode[], start: { x: number; y: number }) {
  const byId = Object.fromEntries(nodes.map((node) => [node.id, { ...node }]));
  const wings = [...new Set(nodes.map((node) => node.wing))];
  const angleOf = (index: number) => -Math.PI / 2 + index * TAU / wings.length;
  const bendOf = (index: number) => (index % 2 ? 0.055 : -0.055);
  const spineAngle = (wing: number, step: number) => angleOf(wing) + bendOf(wing) * Math.min(1, Math.max(0, (step - 1) / 19));
  const at = (angle: number, radius: number) => ({ x: start.x + Math.cos(angle) * radius, y: start.y + Math.sin(angle) * radius });

  for (const node of nodes) {
    const placement = node.placement;
    if (placement?.role !== 'spine') continue;
    const point = at(spineAngle(wings.indexOf(node.wing), placement.index), SPINE_BASE + (placement.index - 1) * SPINE_STEP);
    byId[node.id].x = point.x;
    byId[node.id].y = point.y;
  }

  const groups = new Map<string, TreeNode[]>();
  for (const node of nodes) {
    const placement = node.placement;
    if (!placement || placement.role === 'spine' || placement.role === 'junction') continue;
    const id = node.wing + ':' + placement.cluster;
    const members = groups.get(id) ?? [];
    members.push(node);
    groups.set(id, members);
  }

  const clusterOf = new Map<string, TreeViewCluster>();
  const clusters: TreeViewCluster[] = [];
  for (const [id, members] of groups) {
    const branch = members.filter((node) => node.placement?.role === 'branch')
      .sort((a, b) => (a.placement as { step: number }).step - (b.placement as { step: number }).step);
    const notable = members.find((node) => node.placement?.role === 'notable');
    if (!branch.length || !notable) continue;
    const wing = branch[0].wing;
    const wingIndex = wings.indexOf(wing);
    const clusterIndex = (branch[0].placement as { cluster: number }).cluster;
    const band = Math.floor((clusterIndex - 1) / CLUSTER_SLOTS.length);
    const slot = (clusterIndex - 1) % CLUSTER_SLOTS.length;
    const seed = wingIndex * 97 + clusterIndex * 31;
    const angle = spineAngle(wingIndex, 6 + band * 5) + CLUSTER_SLOTS[slot] + (hash(seed) - 0.5) * 0.04;
    const center = at(angle, CLUSTER_BASE + band * CLUSTER_STEP + (hash(seed + 1) - 0.5) * 20);
    const facing = angle + CLUSTER_SLOTS[slot] * 0.5;
    const cluster = { id, wing, x: center.x, y: center.y, radius: CLUSTER_RADIUS };
    clusters.push(cluster);
    const ringMembers = [...branch, notable];
    ringMembers.forEach((node, index) => {
      const memberAngle = facing + (index / ringMembers.length) * TAU;
      byId[node.id].x = center.x + Math.cos(memberAngle) * cluster.radius;
      byId[node.id].y = center.y + Math.sin(memberAngle) * cluster.radius;
      clusterOf.set(node.id, cluster);
    });
    const keystones = members.filter((node) => node.placement?.role === 'keystone');
    keystones.forEach((node, index) => {
      const keystoneAngle = facing + (index - (keystones.length - 1) / 2) * 0.35;
      const point = { x: center.x + Math.cos(keystoneAngle) * cluster.radius * KEYSTONE_REACH, y: center.y + Math.sin(keystoneAngle) * cluster.radius * KEYSTONE_REACH };
      byId[node.id].x = point.x;
      byId[node.id].y = point.y;
    });
  }

  for (const node of nodes) {
    const placement = node.placement;
    if (placement?.role !== 'junction') continue;
    const from = wings.indexOf(placement.a);
    const to = wings.indexOf(placement.b);
    let span = to - from;
    if (span < 0) span += wings.length;
    const point = at(angleOf(from) + (span / 2) * TAU / wings.length, JUNCTION_RADIUS);
    byId[node.id].x = point.x;
    byId[node.id].y = point.y;
  }

  const placed = nodes.map((node) => byId[node.id]);
  const regions = wings.map((id, index) => ({ id, ...at(angleOf(index), RIM_RADIUS) }));
  const xs = [...placed.map((node) => node.x), ...regions.map((region) => region.x)];
  const ys = [...placed.map((node) => node.y), ...regions.map((region) => region.y)];
  const x = Math.min(start.x, ...xs) - 70, y = Math.min(start.y, ...ys) - 60;
  return {
    nodes: placed, byId, clusters, clusterOf, regions,
    bounds: { x, y, width: Math.max(start.x, ...xs) + 70 - x, height: Math.max(start.y, ...ys) + 60 - y },
  };
}

/** SVG's circular arc takes the short route between the actual graph endpoints. */
export function treeOrbitPath(a: { x: number; y: number }, b: { x: number; y: number }, center: { x: number; y: number }) {
  const radius = Math.hypot(a.x - center.x, a.y - center.y);
  const cross = (a.x - center.x) * (b.y - center.y) - (a.y - center.y) * (b.x - center.x);
  return 'M' + a.x + ' ' + a.y + 'A' + radius + ' ' + radius + ' 0 0 ' + (cross > 0 ? 1 : 0) + ' ' + b.x + ' ' + b.y;
}
