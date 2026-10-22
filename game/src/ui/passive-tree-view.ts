import type { TreeNode } from '../../../engine/tree';

export interface TreeViewCluster {
  id: string;
  wing: string;
  x: number;
  y: number;
  radius: number;
}

/** Presentation only: arrange each existing branch chain around an open orbit.
 * IDs, grants, costs and connections remain the canonical engine nodes. */
export function buildPassiveTreeView(nodes: TreeNode[], start: { x: number; y: number }) {
  const byId = Object.fromEntries(nodes.map((node) => [node.id, { ...node }]));
  const groups = new Map<string, TreeNode[]>();
  const clusterOf = new Map<string, TreeViewCluster>();
  const clusters: TreeViewCluster[] = [];
  for (const node of nodes) {
    const p = node.placement;
    if (!p || !('cluster' in p)) continue;
    const id = node.wing + ':' + p.cluster;
    const members = groups.get(id) ?? [];
    members.push(node);
    groups.set(id, members);
  }
  for (const [id, members] of groups) {
    const branch = members.filter((node) => node.placement?.role === 'branch')
      .sort((a, b) => (a.placement as { step: number }).step - (b.placement as { step: number }).step);
    const first = branch[0];
    const spine = first && nodes.find((node) => node.wing === first.wing && node.placement?.role === 'spine');
    if (!first || !spine) continue;
    const distance = Math.hypot(spine.x - start.x, spine.y - start.y);
    if (!distance) continue;
    const ux = (spine.x - start.x) / distance, uy = (spine.y - start.y) / distance;
    const along = (first.x - start.x) * ux + (first.y - start.y) * uy;
    const root = { x: start.x + ux * along, y: start.y + uy * along };
    const step = Math.hypot(first.x - root.x, first.y - root.y);
    if (!step) continue;
    const ox = (first.x - root.x) / step, oy = (first.y - root.y) / step;
    const cluster = { id, wing: first.wing, x: root.x + ox * step * 3.35, y: root.y + oy * step * 3.35, radius: step * 1.75 };
    clusters.push(cluster);
    const notable = members.find((node) => node.placement?.role === 'notable');
    const chain = notable ? [...branch, notable] : branch;
    chain.forEach((node, index) => {
      const angle = Math.PI + (index / Math.max(1, chain.length - 1)) * Math.PI * 7 / 6;
      byId[node.id].x = cluster.x + cluster.radius * (ox * Math.cos(angle) + ux * Math.sin(angle));
      byId[node.id].y = cluster.y + cluster.radius * (oy * Math.cos(angle) + uy * Math.sin(angle));
      clusterOf.set(node.id, cluster);
    });
    for (const node of members.filter((item) => item.placement?.role === 'keystone')) {
      const anchor = notable ? byId[notable.id] : byId[branch[branch.length - 1].id];
      byId[node.id].x = anchor.x + ox * step * 2.75;
      byId[node.id].y = anchor.y + oy * step * 2.75;
    }
  }
  const placed = nodes.map((node) => byId[node.id]);
  const regions = [...new Set(nodes.map((node) => node.wing))].map((id) => {
    const spine = nodes.filter((node) => node.wing === id && node.placement?.role === 'spine');
    const last = spine.reduce<TreeNode | undefined>((best, node) =>
      !best || Math.hypot(node.x - start.x, node.y - start.y) > Math.hypot(best.x - start.x, best.y - start.y) ? node : best, undefined);
    return { id, x: start.x + ((last?.x ?? start.x) - start.x) * 1.09, y: start.y + ((last?.y ?? start.y) - start.y) * 1.09 };
  });
  const xs = [...placed.map((node) => node.x), ...regions.map((region) => region.x)];
  const ys = [...placed.map((node) => node.y), ...regions.map((region) => region.y)];
  const x = Math.min(start.x, ...xs) - 70, y = Math.min(start.y, ...ys) - 50;
  return { nodes: placed, byId, clusters, clusterOf, regions,
    bounds: { x, y, width: Math.max(start.x, ...xs) + 70 - x, height: Math.max(start.y, ...ys) + 50 - y } };
}

/** SVG's circular arc takes the short route between the actual graph endpoints. */
export function treeOrbitPath(a: { x: number; y: number }, b: { x: number; y: number }, center: { x: number; y: number }) {
  const radius = Math.hypot(a.x - center.x, a.y - center.y);
  const cross = (a.x - center.x) * (b.y - center.y) - (a.y - center.y) * (b.x - center.x);
  return 'M' + a.x + ' ' + a.y + 'A' + radius + ' ' + radius + ' 0 0 ' + (cross > 0 ? 1 : 0) + ' ' + b.x + ' ' + b.y;
}
