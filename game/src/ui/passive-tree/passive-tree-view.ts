import type { TreeNode } from '../../../../engine/tree.ts';

export interface TreeViewBounds { x: number; y: number; width: number; height: number }
export interface PassiveTreeSession {
  camera: { x: number; y: number; zoom: number } | null;
  query: string;
  viewMode: 'build' | 'overview' | 'region' | 'free';
  focusedRegion: string | null;
  guideOpen: boolean;
}
export const newPassiveTreeSession = (): PassiveTreeSession => ({ camera: null, query: '', viewMode: 'build', focusedRegion: null, guideOpen: false });

function pointBounds(points: { x: number; y: number }[], paddingX: number, paddingY = paddingX): TreeViewBounds {
  const xs = points.map((point) => point.x), ys = points.map((point) => point.y);
  const x = Math.min(...xs) - paddingX, y = Math.min(...ys) - paddingY;
  return { x, y, width: Math.max(...xs) + paddingX - x, height: Math.max(...ys) + paddingY - y };
}

/** The board uses the canonical road positions, so every drawn step is a real purchase step. */
export function buildPassiveTreeView(nodes: TreeNode[], start: { x: number; y: number }) {
  const placed = nodes.map((node) => ({ ...node }));
  const byId = Object.fromEntries(placed.map((node) => [node.id, node]));
  const wings = [...new Set(nodes.map((node) => node.wing))];
  // Labels share this fixed margin instead of making the whole field smaller to fit a second ring.
  const bounds = pointBounds([start, ...placed], 90, 75);
  const regions = wings.map((id) => {
    const members = placed.filter((node) => node.wing === id);
    const centroid = {
      x: members.reduce((sum, node) => sum + node.x, 0) / members.length,
      y: members.reduce((sum, node) => sum + node.y, 0) / members.length,
    };
    const distance = Math.hypot(centroid.x - start.x, centroid.y - start.y);
    const direction = distance ? { x: (centroid.x - start.x) / distance, y: (centroid.y - start.y) / distance } : { x: 0, y: -1 };
    const edge = Math.max(...members.map((node) => (node.x - centroid.x) * direction.x + (node.y - centroid.y) * direction.y));
    return {
      id,
      x: Math.max(bounds.x + 62, Math.min(bounds.x + bounds.width - 62, centroid.x + direction.x * (edge + 46))),
      y: Math.max(bounds.y + 24, Math.min(bounds.y + bounds.height - 32, centroid.y + direction.y * (edge + 46))),
      centroid,
      bounds: pointBounds(members, 45),
    };
  });
  return { nodes: placed, byId, regions, bounds };
}

/** Open on the player's purchased roads and their next steps; a fresh tree opens around Origin. */
export function initialTreeCamera(
  view: ReturnType<typeof buildPassiveTreeView>,
  start: { x: number; y: number },
  ranks: Record<string, number>,
  viewport: { width: number; height: number },
  links: { a: string; b: string }[] = [],
) {
  if (viewport.width <= 0 || viewport.height <= 0) return { ...start, zoom: 2.6 };
  const owned = new Set(view.nodes.filter((node) => (ranks[node.id] || 0) > 0).map((node) => node.id));
  if (!owned.size) return { ...start, zoom: 2.6 };
  const visible = new Set(owned);
  const includeFrontier = (a: string, b: string) => {
    if (owned.has(a)) visible.add(b);
    if (owned.has(b)) visible.add(a);
  };
  for (const node of view.nodes) for (const parent of node.needs) includeFrontier(parent, node.id);
  for (const link of links) includeFrontier(link.a, link.b);
  const points: { x: number; y: number }[] = view.nodes.filter((node) => visible.has(node.id));
  if (visible.has('start')) points.push(start);
  const bounds = pointBounds(points, 80);
  const baseScale = Math.min(viewport.width / view.bounds.width, viewport.height / view.bounds.height);
  const zoom = Math.min(viewport.width / bounds.width, viewport.height / bounds.height) / baseScale;
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2, zoom: Math.max(.65, Math.min(4, zoom)) };
}

/** SVG's circular arc takes the short route between the actual graph endpoints. */
export function treeOrbitPath(a: { x: number; y: number }, b: { x: number; y: number }, center: { x: number; y: number }) {
  const radius = Math.hypot(a.x - center.x, a.y - center.y);
  const cross = (a.x - center.x) * (b.y - center.y) - (a.y - center.y) * (b.x - center.x);
  return 'M' + a.x + ' ' + a.y + 'A' + radius + ' ' + radius + ' 0 0 ' + (cross > 0 ? 1 : 0) + ' ' + b.x + ' ' + b.y;
}

/** Match the board's drawn circles when checking spacing or rendering a node. */
export function treeViewNodeRadius(node: Pick<TreeNode, 'kind'>, layout: { nodeRadius: number; radii?: Record<string, number> }) {
  return (layout.radii?.[node.kind] ?? layout.nodeRadius) * (node.kind === 'keystone' ? 1.55 : node.kind === 'notable' ? 1.25 : 1.45);
}

/** Highlight the purchased route, not extra chords between nodes that happen to lie on it. */
export function treeRouteEdges(path: string[], links: { a: string; b: string }[], owned: (id: string) => boolean) {
  const key = (a: string, b: string) => [a, b].sort().join('|');
  const edges = new Set(path.slice(1).map((id, i) => key(path[i], id)));
  const first = path[0];
  const entry = first && links.filter((link) => (link.a === first && owned(link.b)) || (link.b === first && owned(link.a)))
    .map((link) => key(link.a, link.b)).sort()[0];
  if (entry) edges.add(entry);
  return edges;
}

