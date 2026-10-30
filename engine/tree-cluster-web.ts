import type { TreeLayoutCfg, TreeLink, TreeSpecNode } from './tree.ts';

type Point = { x: number; y: number };
const TAU = Math.PI * 2;
const keyOf = (a: string, b: string) => [a, b].sort().join('|');
const apart = (a: Point, b: Point) => Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
const segmentDistance = (p: Point, a: Point, b: Point) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.sqrt((p.x - a.x - t * dx) ** 2 + (p.y - a.y - t * dy) ** 2);
};

/**
 * The route plan lives in layout.web.roads, with two named Notable anchors per road.
 * cNN.01 through .05 form a two-anchor local loop serving their catalogue Notable.
 * Each sNN is a route step between the anchors written in that road's `via` list; s01 and s02
 * join Start to the nearest group. Junction Notables join their named region borders.
 * Each slot-2 Notable branches from its own Normal anchor to its Keystone leaf.
 * Every Keystone has an independent Notable entrance from the Normal road network.
 * Sites supply varied silhouettes across one shared field, without radial lanes or rim slots.
 */
export function buildClusterWeb(nodes: TreeSpecNode[], layout: TreeLayoutCfg) {
  const cfg = layout.web, regions = layout.regions ?? [], start = layout.start;
  if (!cfg || !regions.length) throw new Error('tree network: cluster-web-v6 needs web settings and regions');
  if (!Number.isFinite(cfg.root_radius) || cfg.root_radius <= 0 || cfg.root_radius < (layout.root_clearance ?? 0))
    throw new Error('tree network: root_radius must be positive and clear the origin');
  if (!cfg.leaf_distances.length || cfg.leaf_distances.some(n => !Number.isFinite(n) || n <= 0)
    || !Number.isSafeInteger(cfg.leaf_directions) || cfg.leaf_directions < 1)
    throw new Error('tree network: leaf pocket search needs positive distances and directions');
  const positions = new Map<string, Point>(), parents = new Map<string, string[]>();
  const edges = new Map<string, TreeLink>(), nodeOf = new Map(nodes.map(node => [node.id, node]));
  const join = (a: string, b: string) => {
    if (a === b) return;
    if (a !== 'start' && !nodeOf.has(a) || b !== 'start' && !nodeOf.has(b))
      throw new Error(`tree network: missing route anchor ${a} / ${b}`);
    edges.set(keyOf(a, b), { a, b, shape: 'line' });
  };
  const radii = new Map(nodes.map(node => [node.id, Number(layout.radii?.[node.kind] ?? 3.5)
    * (node.kind === 'keystone' ? 1.55 : node.kind === 'notable' ? 1.25 : 1.45) + 4.5]));
  const radiusOf = (id: string) => radii.get(id)!;
  type Group = { center: Point; road: string[]; notable: string; entrances: string[] };
  const groups: Group[][] = regions.map(() => []), groupOf = new Map<string, Group>();
  const pad = (n: number) => String(n).padStart(2, '0');
  const keystones = nodes.filter(node => node.kind === 'keystone');
  const leafParents = new Map<string, string>();
  for (const node of keystones) {
    const p = node.placement as { cluster: number; slot?: number };
    const parent = `notable.${node.wing}.${pad(p.cluster)}${p.slot === 2 ? '.02' : ''}`;
    const sibling = leafParents.get(parent);
    if (sibling) throw new Error(`tree network: ${sibling} and ${node.id} share ${parent}; each Keystone needs an independent Notable entrance`);
    leafParents.set(parent, node.id);
  }
  for (const node of nodes.filter(node => node.placement?.role === 'notable' && node.placement.slot !== 2)) {
    const site = cfg.sites[node.id], motif = site && cfg.motifs[site.motif];
    if (!site || !motif) throw new Error(`tree network: no group site for ${node.id}`);
    if (![site.x, site.y, site.turn, motif.turn, ...motif.notable, ...motif.road.flat()].every(Number.isFinite)
      || motif.road.length !== 5 || !motif.road[motif.anchor] || motif.notable_next !== undefined && !motif.road[motif.notable_next])
      throw new Error(`tree network: invalid group site or motif for ${node.id}`);
    const p = node.placement as { cluster: number };
    const turn = site.turn + motif.turn;
    const transform = ([x, y]: number[]): Point => ({x: start.x + site.x + x * Math.cos(turn) - y * Math.sin(turn),
      y: start.y + site.y + x * Math.sin(turn) + y * Math.cos(turn)});
    const road = motif.road.map((point, i) => {
      const id = `normal.${node.wing}.c${pad(p.cluster)}.${pad(i + 1)}`;
      positions.set(id, transform(point)); return id;
    });
    positions.set(node.id, transform(motif.notable));
    for (let i = 1; i < road.length; i++) {
      if (motif.anchor === i - 1 && motif.notable_next === i) continue;
      join(road[i - 1], road[i]);
    }
    if (motif.loop) join(road[0], road[road.length - 1]);
    join(road[motif.anchor], node.id);
    if (motif.notable_next !== undefined) join(node.id, road[motif.notable_next]);
    const entrances = [road[motif.anchor]];
    if (motif.notable_next !== undefined) entrances.push(road[motif.notable_next]);
    const group = {center: {x: start.x + site.x, y: start.y + site.y}, road, notable: node.id, entrances};
    groups[regions.indexOf(node.wing)][p.cluster - 1] = group; groupOf.set(node.id, group);
  }
  const facing = (group: Group, target: Point) => {
    const dx = target.x - group.center.x, dy = target.y - group.center.y;
    const clear = group.road.filter(id => segmentDistance(positions.get(group.notable)!, positions.get(id)!, target) > radiusOf(group.notable) + 3);
    if (!clear.length) throw new Error(`tree network: no clear road exit from ${group.notable}`);
    return clear.reduce((best, id) => {
      const p = positions.get(id)!, q = positions.get(best)!;
      return p.x * dx + p.y * dy > q.x * dx + q.y * dy ? id : best;
    });
  };
  const bridgeEndpoints = new Map<string, [string, string]>();
  // Give the Start-to-region entries equal angles, then keep the outer road straight toward its group.
  const startRoads = cfg.roads.filter(road => road.a === 'start');
  const rootAngles = startRoads.map((road, index) => {
    const group = groupOf.get(road.b);
    if (!group) throw new Error(`tree network: unknown root route ${road.a} / ${road.b}`);
    const endpoint = positions.get(facing(group, start))!;
    return Math.atan2(endpoint.y - start.y, endpoint.x - start.x) - index * TAU / startRoads.length;
  });
  const rootPhase = rootAngles.length
    ? Math.atan2(rootAngles.reduce((sum, angle) => sum + Math.sin(angle), 0),
      rootAngles.reduce((sum, angle) => sum + Math.cos(angle), 0))
    : -Math.PI / 2;
  let startRoadIndex = 0;
  for (const road of cfg.roads) {
    const a = groupOf.get(road.a), b = groupOf.get(road.b);
    if (!b || road.a !== 'start' && !a) throw new Error(`tree network: unknown road anchors ${road.a} / ${road.b}`);
    const from = a ? facing(a, b.center) : 'start', to = facing(b, a?.center ?? start);
    const p = from === 'start' ? start : positions.get(from)!, q = positions.get(to)!;
    const spoke = from === 'start' ? {
      x: start.x + Math.cos(rootPhase + startRoadIndex * TAU / startRoads.length) * cfg.root_radius,
      y: start.y + Math.sin(rootPhase + startRoadIndex * TAU / startRoads.length) * cfg.root_radius,
    } : null;
    if (spoke) startRoadIndex++;
    let previous = from;
    for (let i = 0; i < road.via.length; i++) {
      const t = from === 'start'
        ? i === 0 ? 0 : i / road.via.length
        : (i + 1) / (road.via.length + 1);
      const id = road.via[i];
      if (positions.has(id)) throw new Error(`tree network: route step ${id} has two jobs`);
      positions.set(id, spoke
        ? {x: spoke.x + (q.x - spoke.x) * t, y: spoke.y + (q.y - spoke.y) * t}
        : {x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t});
      join(previous, id); previous = id;
    }
    join(previous, to);
    if (a && nodeOf.get(a.notable)!.wing !== nodeOf.get(b.notable)!.wing) {
      const key = `${nodeOf.get(a.notable)!.wing}-${nodeOf.get(b.notable)!.wing}`;
      if (!bridgeEndpoints.has(key)) bridgeEndpoints.set(key, [from, to]);
    }
  }
  for (const node of nodes.filter(node => node.placement?.role === 'junction')) {
    const p = node.placement as { a: string; b: string };
    let ends = bridgeEndpoints.get(`${p.a}-${p.b}`);
    if (!ends) { const reverse = bridgeEndpoints.get(`${p.b}-${p.a}`); if (reverse) ends = [reverse[1], reverse[0]]; }
    if (!ends) throw new Error(`tree network: no border for ${node.id}`);
    bridgeEndpoints.set(`${p.a}-${p.b}`, ends);
    const a = positions.get(ends[0])!, b = positions.get(ends[1])!, dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
    positions.set(node.id, {x: (a.x + b.x) / 2 - dy / length * cfg.junction_offset,
      y: (a.y + b.y) / 2 + dx / length * cfg.junction_offset});
    join(node.id, ends[0]); join(node.id, ends[1]);
  }

  // Each secondary gate serves its authored Normal -> Notable -> Keystone route. Connecting it
  // through another Notable would force the player to buy the other branch before choosing this one.
  for (const node of nodes.filter(node => node.placement?.role === 'notable' && node.placement.slot === 2)) {
    const branch = cfg.gateways?.[node.id], anchor = branch && positions.get(branch.anchor);
    if (!branch || !anchor || nodeOf.get(branch.anchor)?.kind !== 'normal'
      || branch.offset.length !== 2 || !branch.offset.every(Number.isFinite))
      throw new Error(`tree network: no Normal entrance for ${node.id}`);
    positions.set(node.id, { x: anchor.x + branch.offset[0], y: anchor.y + branch.offset[1] });
    join(branch.anchor, node.id);
  }

  // Choose clear local pockets after the routes and their exclusive Notable gates exist.
  const pointOf = (id: string) => id === 'start' ? start : positions.get(id)!;
  const crosses = (a: Point, b: Point, c: Point, d: Point) => {
    const side = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    return side(a, b, c) * side(a, b, d) < -.001 && side(c, d, a) * side(c, d, b) < -.001;
  };
  type Leaf = { id: string; parent: string; group: string; anchor: Point; body: number; choices: {point: Point; score: number; deviation: number}[] };
  const fixed = [...positions].map(([id, point]) => ({id, point, radius: radiusOf(id)}));
  const segments = [...edges.values()].map(edge => ({...edge, p: pointOf(edge.a), q: pointOf(edge.b)}));
  const leaves: Leaf[] = [];
  for (const node of keystones) {
    const p = node.placement as { cluster: number; slot?: number };
    const group = groups[regions.indexOf(node.wing)][p.cluster - 1];
    const parent = group.notable + (p.slot === 2 ? '.02' : '');
    const anchor = positions.get(parent)!, body = radiusOf(node.id);
    // A Notable may have two Normal entrances; continue from whichever one has a clear straight pocket.
    const approachIds = p.slot === 2 ? [cfg.gateways?.[parent]?.anchor] : group.entrances;
    const idealAngles = approachIds.filter((id): id is string => !!id).map(id => {
      const approach = positions.get(id);
      if (!approach) throw new Error(`tree network: no Normal approach for ${node.id}`);
      return Math.atan2(anchor.y - approach.y, anchor.x - approach.x);
    });
    if (!idealAngles.length) throw new Error(`tree network: no Normal approach for ${node.id}`);
    const choicesByPoint = new Map<string, Leaf['choices'][number]>();
    for (const distance of cfg.leaf_distances) {
      for (const idealAngle of idealAngles) {
        for (let step = 0; step < cfg.leaf_directions; step++) {
          const angle = idealAngle + step * TAU / cfg.leaf_directions;
          const point = {x: anchor.x + Math.cos(angle) * distance, y: anchor.y + Math.sin(angle) * distance};
          if (apart(point, start) < cfg.start_clearance) continue;
          let clearance = Infinity, blocked = false;
          for (const other of fixed) {
            const gap = apart(point, other.point) - body - other.radius;
            if (gap < 0 || other.id !== parent && segmentDistance(other.point, anchor, point) < other.radius + 2) {
              blocked = true; break;
            }
            if (other.id !== parent) clearance = Math.min(clearance, gap);
          }
          if (blocked) continue;
          for (const edge of segments) {
            if (segmentDistance(point, edge.p, edge.q) < body + 3
              || edge.a !== parent && edge.b !== parent && crosses(anchor, point, edge.p, edge.q)) {
              blocked = true; break;
            }
          }
          if (blocked) continue;
          const deviation = Math.min(...idealAngles.map(ideal => Math.abs(Math.atan2(Math.sin(angle - ideal), Math.cos(angle - ideal)))));
          const choice = {point, deviation, score: Math.min(clearance, cfg.leaf_clearance_preference) - distance * cfg.leaf_length_penalty};
          const key = point.x.toFixed(6) + '|' + point.y.toFixed(6);
          const previous = choicesByPoint.get(key);
          if (!previous || choice.deviation < previous.deviation) choicesByPoint.set(key, choice);
        }
      }
      // Prefer nearby pockets, but keep searching for a straighter exit when every short one turns sharply.
      const bestDeviation = Math.min(...[...choicesByPoint.values()].map(choice => choice.deviation));
      if (choicesByPoint.size >= cfg.leaf_directions / 2 && bestDeviation <= Math.PI / 12) break;
    }
    const choices = [...choicesByPoint.values()]
      .sort((a,b) => a.deviation-b.deviation || b.score-a.score)
      .slice(0, cfg.leaf_directions / 2);
    if (!choices.length) throw new Error(`tree network: no clear leaf pocket for ${node.id}`);
    leaves.push({id: node.id, parent, group: group.notable, anchor, body, choices});
  }
  // Place the most constrained pockets first. Backtracking only moves leaves; roads and anchors
  // stay fixed, so a crowded neighbour cannot force a Keystone onto another group's Notable.
  leaves.sort((a,b) => a.choices.length-b.choices.length || a.id.localeCompare(b.id));
  const placed: {leaf: Leaf; point: Point}[] = [];
  const fits = (leaf: Leaf, point: Point) => !placed.some(other => apart(point, other.point) < leaf.body + other.leaf.body
    || leaf.group === other.leaf.group && apart(point, other.point) < (cfg.leaf_cluster_separation ?? 0)
    || segmentDistance(point, other.leaf.anchor, other.point) < leaf.body + 3
    || segmentDistance(other.point, leaf.anchor, point) < other.leaf.body + 3
    || leaf.parent !== other.leaf.parent && crosses(leaf.anchor, point, other.leaf.anchor, other.point));
  const place = (remaining: Leaf[]): boolean => {
    if (!remaining.length) return true;
    let next = remaining[0], choices = next.choices.filter(choice => fits(next, choice.point));
    for (const leaf of remaining.slice(1)) {
      const available = leaf.choices.filter(choice => fits(leaf, choice.point));
      if (!available.length) return false;
      if (available.length < choices.length) {next = leaf; choices = available;}
    }
    for (const {point} of choices) {
      placed.push({leaf: next, point});
      if (place(remaining.filter(leaf => leaf !== next))) return true;
      placed.pop();
    }
    return false;
  };
  if (!place(leaves)) throw new Error('tree network: leaf pockets cannot fit without overlapping');
  for (const {leaf, point} of placed) { positions.set(leaf.id, point); join(leaf.parent, leaf.id); }

  // Store a spanning parent tree and all remaining edges, matching the engine's undirected graph.
  const adjacency = new Map<string, string[]>();
  for (const { a, b } of edges.values()) {
    adjacency.set(a, [...(adjacency.get(a) ?? []), b]);
    adjacency.set(b, [...(adjacency.get(b) ?? []), a]);
  }
  const seen = new Set(['start']), queue = ['start'];
  const spanning = new Set<string>();
  for (let i = 0; i < queue.length; i++) for (const id of adjacency.get(queue[i]) ?? []) {
    if (seen.has(id)) continue;
    seen.add(id); queue.push(id); parents.set(id, [queue[i]]); spanning.add(keyOf(id, queue[i]));
  }
  for (const node of nodes) if (!positions.has(node.id) || !parents.has(node.id))
    throw new Error(`tree network: ${node.id} has no placed route to Start`);
  for (const node of nodes.filter(node => node.placement?.role === 'junction')) {
    const p = node.placement as { a: string; b: string };
    const ends = bridgeEndpoints.get(`${p.a}-${p.b}`)!;
    parents.set(node.id, [...ends]);
    for (const id of ends) spanning.add(keyOf(node.id, id));
  }
  return { positions, parents, links: [...edges.values()].filter(edge => !spanning.has(keyOf(edge.a, edge.b))),
    normalRows: regions.map(wing => nodes.filter(node => node.wing === wing && node.kind === 'normal')) };
}
