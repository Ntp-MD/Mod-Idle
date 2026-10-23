import type { TreeLayoutCfg, TreeLink, TreeSpecNode } from './tree.ts';

import { buildClusterWeb } from './tree-cluster-web.ts';

const TAU = Math.PI * 2;
const edgeKey = (a: string, b: string) => [a, b].sort().join('|');
type Point = { x: number; y: number };
type Cell = Point & { key: number };
type Road = TreeLink & { distance: number; key: string };

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

function hashUnit(value: string) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return (hash >>> 0) / 0x1_0000_0000;
}

function cross(a: Point, b: Point, c: Point, d: Point) {
  const side = (p: Point, q: Point, r: Point) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
  return side(a, b, c) * side(a, b, d) < -0.001 && side(c, d, a) * side(c, d, b) < -0.001;
}

function pointToSegment(point: Point, a: Point, b: Point) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy);
}

function roleOrder(node: TreeSpecNode) {
  const placement = node.placement;
  if (placement?.role === 'spine') return placement.index;
  if (placement?.role === 'branch') return 1000 + placement.cluster * 10 + placement.step;
  return Infinity;
}

/**
 * PoE-grained radial layout (`poe-radial-v5`).
 *
 * The grammar is the one the current Path of Exile tree reads by: a small medallion of ordinary
 * nodes around every Notable, those medallions sitting on a polar lattice, Keystones as separate
 * outer medallions at the end of a branch, and a continuous highway of ordinary nodes around the
 * rim. It deliberately does not use the older draft layouts; the lattice, the medallion ring and
 * the outer highway are the whole pattern.
 */
function buildPoeRadial(nodes: TreeSpecNode[], layout: TreeLayoutCfg) {
  const cfg = layout.poe;
  if (!cfg) throw new Error('tree network: poe-radial-v5 needs layout.poe');
  // The radial layout still has to refuse the same impossible fields the irregular one does.
  if (!(Number(layout.cell_spacing) > 0))
    throw new Error('tree network: cell_spacing must be positive');
  if (!(Number(layout.root_clearance) < Number(layout.field_radius)))
    throw new Error('tree network: root_clearance must be less than field_radius');
  const keystoneRadius = Number(layout.radii?.keystone ?? 9) * 1.55;
  const outerKeystone = Math.max(...cfg.keystone_bands);
  if (!(Number(layout.field_radius) >= outerKeystone + keystoneRadius + 8))
    throw new Error(`tree network: field_radius ${layout.field_radius} does not fit the outer Keystone tier`);
  const tierGap = Math.min(...cfg.keystone_bands.slice(1).map((band, index) => band - cfg.keystone_bands[index]));
  if (2 * keystoneRadius >= tierGap)
    throw new Error('tree network: the Keystone radius cannot fit a side pocket or junction');
  const regions = layout.regions ?? [];
  const start = layout.start;
  if (!regions.length) throw new Error('tree network: poe-radial-v5 needs regions');
  const sector = TAU / regions.length;
  const wingOf = new Map(regions.map((region, index) => [region, index]));
  const centerOf = (index: number) => -Math.PI / 2 + index * sector;
  const laneOffset = (count: number, index: number) => {
    if (count === 4) return [-0.36, -0.12, 0.12, 0.36][index];
    // Keystone lanes sit off the four cluster lanes, so a radial medallion connector never runs
    // through a Keystone icon.
    if (count === 5) return [-0.42, -0.24, 0, 0.24, 0.42][index];
    return (index / Math.max(1, count - 1) * 2 - 1) * 0.4;
  };
  const at = (angle: number, radius: number): Point => ({
    x: start.x + Math.cos(angle) * radius,
    y: start.y + Math.sin(angle) * radius,
  });

  const positions = new Map<string, Point>();
  const parents = new Map<string, string[]>();
  const links = new Map<string, TreeLink>();
  const link = (a: string, b: string, shape: TreeLink['shape'] = 'line') => {
    if (a === b) return;
    const key = edgeKey(a, b);
    if (!links.has(key)) links.set(key, { a, b, shape });
  };
  const parent = (id: string, ...ids: string[]) => parents.set(id, ids);

  const wingNormals = regions.map((region) => nodes.filter((node) => node.wing === region && node.kind === 'normal'));
  const wingNotables = regions.map((region) => nodes.filter((node) => node.wing === region
    && node.kind === 'notable' && node.placement?.role === 'notable')
    .sort((a, b) => (a.placement as { cluster: number }).cluster - (b.placement as { cluster: number }).cluster));
  const wingKeystones = regions.map((region) => nodes.filter((node) => node.wing === region && node.kind === 'keystone'));
  const junctions = nodes.filter((node) => node.placement?.role === 'junction');

  const clusterLanes = cfg.cluster_lanes;
  const keystoneLanes = cfg.keystone_lanes;
  const clusterBands = cfg.cluster_bands;
  const keystoneBands = cfg.keystone_bands;
  if (clusterBands.length * clusterLanes !== 12)
    throw new Error('tree network: poe-radial-v5 expects twelve clusters per wing');
  if (keystoneBands.length * keystoneLanes !== 15)
    throw new Error('tree network: poe-radial-v5 expects fifteen Keystone slots per wing');

  const ring0 = new Map<string, string>(); // `${wing}:${cluster}` → the ring's anchor node

  for (let w = 0; w < regions.length; w++) {
    const center = centerOf(w);
    const normals = wingNormals[w];
    const notables = wingNotables[w];
    if (notables.length !== 12) throw new Error(`tree network: ${regions[w]} needs twelve cluster Notables`);
    if (normals.filter((n) => n.placement?.role === 'spine').length !== 20)
      throw new Error(`tree network: ${regions[w]} needs twenty spine Normals`);
    for (let cluster = 1; cluster <= 12; cluster++) {
      const band = Math.floor((cluster - 1) / clusterLanes);
      const lane = (cluster - 1) % clusterLanes;
      const angle = center + laneOffset(clusterLanes, lane) * sector;
      const notable = notables[cluster - 1];
      const notablePoint = at(angle, clusterBands[band]);
      positions.set(notable.id, notablePoint);
      const ringNodes = normals
        .filter((n) => n.placement?.role === 'branch' && (n.placement as { cluster: number }).cluster === cluster)
        .sort((a, b) => (a.placement as { step: number }).step - (b.placement as { step: number }).step);
      if (ringNodes.length !== 5)
        throw new Error(`tree network: ${regions[w]} cluster ${cluster} needs five ring Normals`);
      for (let k = 0; k < 5; k++) {
        const ringAngle = angle + Math.PI / 2 + k * TAU / 5;
        const point = {
          x: notablePoint.x + Math.cos(ringAngle) * cfg.cluster_ring_radius,
          y: notablePoint.y + Math.sin(ringAngle) * cfg.cluster_ring_radius,
        };
        positions.set(ringNodes[k].id, point);
        if (k > 0) parent(ringNodes[k].id, ringNodes[0].id);
        if (k < 4) link(ringNodes[k].id, ringNodes[k + 1].id);
        if (k === 0) {
          ring0.set(`${w}:${cluster}`, ringNodes[k].id);
          if (band > 0) {
            const below = ring0.get(`${w}:${cluster - clusterLanes}`);
            if (!below) throw new Error(`tree network: ${regions[w]} cluster ${cluster} has no lower band`);
            parent(ringNodes[k].id, below);
          }
        }
      }
      link(ringNodes[4].id, ringNodes[0].id);
      parent(notable.id, ringNodes[0].id);
      link(notable.id, ringNodes[2].id);
    }
  }

  // Inner spokes: four ordinary nodes on the cluster lanes. They are the wing's first highway
  // steps and its Start connection; each spoke anchors the band-0 medallion on its lane.
  for (let w = 0; w < regions.length; w++) {
    const center = centerOf(w);
    const spokes = wingNormals[w].filter((n) => n.placement?.role === 'spine')
      .sort((a, b) => (a.placement as { index: number }).index - (b.placement as { index: number }).index)
      .slice(0, cfg.spine_inner_count);
    if (spokes.length !== cfg.spine_inner_count)
      throw new Error(`tree network: ${regions[w]} needs ${cfg.spine_inner_count} inner spokes`);
    for (let lane = 0; lane < cfg.spine_inner_count; lane++) {
      const angle = center + laneOffset(cfg.spine_inner_count, lane) * sector;
      positions.set(spokes[lane].id, at(angle, cfg.spine_inner_radius));
      if (lane > 0) link(spokes[lane - 1].id, spokes[lane].id);
      const band0 = ring0.get(`${w}:${lane + 1}`);
      if (band0) parent(band0, spokes[lane].id);
    }
    // The second spoke is the Start root; the other three hang off the same four-node arc.
    parent(spokes[1].id, 'start');
    parent(spokes[0].id, spokes[1].id);
    parent(spokes[2].id, spokes[1].id);
    if (spokes[3]) parent(spokes[3].id, spokes[2].id);
  }

  // Outer highway: sixteen ordinary nodes on the rim. The first node of each wing hangs off its
  // band-2 medallion; the chain runs around the wing and joins the next wing, so the rim is a
  // continuous highway instead of a set of decorative arcs.
  const outer = new Map<string, string[]>();
  for (let w = 0; w < regions.length; w++) {
    const center = centerOf(w);
    const spine = wingNormals[w].filter((n) => n.placement?.role === 'spine')
      .sort((a, b) => (a.placement as { index: number }).index - (b.placement as { index: number }).index)
      .slice(cfg.spine_inner_count);
    if (spine.length !== cfg.spine_outer_count)
      throw new Error(`tree network: ${regions[w]} needs ${cfg.spine_outer_count} outer highway Normal nodes`);
    const ids: string[] = [];
    for (let k = 0; k < spine.length; k++) {
      const angle = center - sector / 2 + sector * ((k + 0.5) / spine.length);
      positions.set(spine[k].id, at(angle, cfg.spine_outer_radius));
      ids.push(spine[k].id);
      if (k > 0) link(spine[k - 1].id, spine[k].id);
    }
    outer.set(regions[w], ids);
    const lane0 = ring0.get(`${w}:${clusterLanes * 2 + 1}`); // band 2, lane 0
    const lane2 = ring0.get(`${w}:${clusterLanes * 2 + 3}`);
    if (lane0) parent(ids[0], lane0);
    if (lane2 && ids.length > 8) link(ids[8], lane2);
    for (let k = 1; k < ids.length; k++) if (k !== 8) parent(ids[k], ids[k - 1]);
    if (ids[8]) parent(ids[8], lane2 ?? ids[7]);
  }
  // Close the rim across every wing boundary.
  for (let w = 0; w < regions.length; w++) {
    const here = outer.get(regions[w])!;
    const next = outer.get(regions[(w + 1) % regions.length])!;
    link(here[here.length - 1], next[0], 'arc');
  }

  // Bridges sit on the rim between their two regions; they connect both wings' highway ends.
  for (const junction of junctions) {
    const placement = junction.placement as { a: string; b: string };
    const ia = wingOf.get(placement.a), ib = wingOf.get(placement.b);
    if (ia === undefined || ib === undefined) throw new Error(`tree network: unknown junction wing ${junction.id}`);
    const forward = (ib - ia + regions.length) % regions.length;
    const boundary = centerOf(ia) + (forward === 1 ? sector / 2 : -sector / 2);
    const point = at(boundary, cfg.junction_radius);
    positions.set(junction.id, point);
    const a = outer.get(placement.a)!;
    const b = outer.get(placement.b)!;
    const fromA = a[a.length - 1], fromB = b[0];
    parent(junction.id, fromA, fromB);
    link(junction.id, fromA);
    link(junction.id, fromB);
  }

  // Keystone slots: a regular five-lane, three-tier lattice. Heavy Keystones take the outer tier
  // first (the PoE habit of important stones on the rim); the rest match to the nearest free slot.
  for (let w = 0; w < regions.length; w++) {
    const center = centerOf(w);
    const keystones = wingKeystones[w];
    if (keystones.length !== 15) throw new Error(`tree network: ${regions[w]} needs fifteen Keystones`);
    const notables = wingNotables[w];
    const slots: { id: string; point: Point; tier: number; lane: number }[] = [];
    for (let tier = 0; tier < keystoneBands.length; tier++) {
      for (let lane = 0; lane < keystoneLanes; lane++) {
        const angle = center + laneOffset(keystoneLanes, lane) * sector;
        slots.push({ id: `${w}:${tier}:${lane}`, point: at(angle, keystoneBands[tier]), tier, lane });
      }
    }
    // Keystones sit outside the ordinary field, so their branch starts from the outer (band-2)
    // Notable nearest the stone's catalogue cluster. This keeps every normal road inside the rim
    // and every Keystone a leaf on the rim rather than a road endpoint among the medallions.
    const outerNotables = notables.slice(clusterLanes * 2);
    const parentOf = new Map<string, TreeSpecNode>();
    for (const key of keystones) {
      const cluster = (key.placement as { cluster: number }).cluster;
      const original = positions.get(notables[cluster - 1].id)!;
      let nearest = outerNotables[0];
      let nearestD = Infinity;
      for (const candidate of outerNotables) {
        const d = distance(original, positions.get(candidate.id)!);
        if (d < nearestD) { nearestD = d; nearest = candidate; }
      }
      parentOf.set(key.id, nearest);
    }
    const distanceTo = (key: TreeSpecNode, slot: typeof slots[number]) => {
      const p = positions.get(parentOf.get(key.id)!.id)!;
      return distance(p, slot.point);
    };
    const used = new Set<string>();
    const assign = (list: TreeSpecNode[], allowed: (slot: typeof slots[number]) => boolean) => {
      for (const key of list) {
        let best: typeof slots[number] | null = null;
        let bestD = Infinity;
        for (const slot of slots) {
          if (used.has(slot.id) || !allowed(slot)) continue;
          const d = distanceTo(key, slot);
          if (d < bestD) { bestD = d; best = slot; }
        }
        if (!best) throw new Error(`tree network: no Keystone slot left for ${key.id}`);
        used.add(best.id);
        positions.set(key.id, best.point);
        parent(key.id, parentOf.get(key.id)!.id);
      }
    };
    const heavy = keystones.filter((key) => Number(key.weight ?? 0) >= 4);
    const light = keystones.filter((key) => Number(key.weight ?? 0) < 4);
    assign(heavy, (slot) => slot.tier === keystoneBands.length - 1);
    assign(light, () => true);
  }

  for (const node of nodes) {
    if (!positions.has(node.id)) throw new Error(`tree network: ${node.id} is not placed by poe-radial-v5`);
    if (!parents.has(node.id)) throw new Error(`tree network: ${node.id} is not connected by poe-radial-v5`);
  }
  const parentEdges = new Set([...parents].flatMap(([id, list]) =>
    list.filter((pid) => pid !== 'start').map((pid) => edgeKey(id, pid))));
  return {
    positions,
    parents,
    normalRows: regions.map((_, index) => wingNormals[index]),
    links: [...links.values()].filter((edge) => !parentEdges.has(edgeKey(edge.a, edge.b))),
  };
}

/**
 * Build an irregular, evenly filled field of ordinary roads, then join it with a sparse set of
 * short alternate routes. A spanning tree supplies forks and local chords add loops. Special
 * nodes occupy side pockets beside the roads and retain their stable v3 identities. The build
 * recipe trims ordinary road ends before writing the spec, so this function may leave leaves in
 * the graph it returns.
 */
export function buildTreeNetwork(nodes: TreeSpecNode[], layout: TreeLayoutCfg) {
  if (layout.algorithm === 'cluster-web-v6') return buildClusterWeb(nodes, layout);
  if (layout.algorithm === 'poe-radial-v5') return buildPoeRadial(nodes, layout);
  const regions = layout.regions ?? [];
  const start = layout.start;
  const fieldRadius = layout.field_radius ?? 0;
  const spacing = layout.cell_spacing ?? 0;
  const rootClearance = layout.root_clearance ?? 0;
  const loopCount = layout.extra_routes ?? 0;
  const seed = layout.seed ?? 0;
  if (!Array.isArray(regions) || !regions.length || new Set(regions).size !== regions.length)
    throw new Error('tree network: regions must be unique and nonempty');
  if (!start || !Number.isFinite(start.x) || !Number.isFinite(start.y))
    throw new Error('tree network: start must have finite coordinates');
  if (![fieldRadius, spacing, rootClearance].every((n) => Number.isFinite(n) && n > 0))
    throw new Error('tree network: field_radius, cell_spacing and root_clearance must be positive');
  if (rootClearance >= fieldRadius) throw new Error('tree network: root_clearance must be less than field_radius');
  if (!Number.isSafeInteger(loopCount) || loopCount < 0 || !Number.isSafeInteger(seed))
    throw new Error('tree network: extra_routes and seed must be whole numbers');
  for (const node of nodes) {
    if (!regions.includes(node.wing)) throw new Error(`tree network: ${node.id} names the unknown region ${node.wing}`);
    const p = node.placement;
    if (!p) throw new Error(`tree network: ${node.id} has no placement identity`);
    if (!['spine', 'branch', 'notable', 'keystone', 'junction'].includes(p.role)) throw new Error(`tree network: ${node.id} has an unknown placement identity`);
    if (p.role === 'spine' && (!Number.isSafeInteger(p.index) || p.index < 1)) throw new Error(`tree network: ${node.id} has an invalid spine identity`);
    if (p.role === 'branch' && (!Number.isSafeInteger(p.step) || p.step < 1)) throw new Error(`tree network: ${node.id} has an invalid branch identity`);
    if ((p.role === 'branch' || p.role === 'notable' || p.role === 'keystone') && (!Number.isSafeInteger(p.cluster) || p.cluster < 1))
      throw new Error(`tree network: ${node.id} has an invalid cluster identity`);
    if (p.role === 'keystone' && p.slot !== undefined && (!Number.isSafeInteger(p.slot) || p.slot < 1 || p.slot > 2))
      throw new Error(`tree network: ${node.id} has an invalid keystone slot`);
    if (p.role === 'junction' && (!regions.includes(p.a) || !regions.includes(p.b) || p.a === p.b))
      throw new Error(`tree network: ${node.id} must join two known, different regions`);
  }

  const normals = regions.map((wing) => nodes.filter((n) => n.wing === wing && n.kind === 'normal').sort((a, b) => roleOrder(a) - roleOrder(b)));
  if (normals.some((list) => !list.length))
    throw new Error('tree network: each region must contain at least one Normal node');
  const allNormals = normals.flat();

  // Sample the annulus with a minimum spacing. This keeps the overall density even without repeating
  // rows, while the deterministic seed makes every node's saved identity land in the same place.
  const candidates: Cell[] = [];
  const minSeparation = spacing * 0.67, bucketSize = minSeparation / Math.sqrt(2);
  const buckets = new Map<string, Cell[]>();
  let randomState = (seed >>> 0) || 1;
  const random = () => {
    randomState ^= randomState << 13;
    randomState ^= randomState >>> 17;
    randomState ^= randomState << 5;
    return (randomState >>> 0) / 0x1_0000_0000;
  };
  const maxAttempts = allNormals.length * 200;
  for (let attempt = 0; attempt < maxAttempts && candidates.length < allNormals.length; attempt++) {
    const angle = random() * TAU;
    const radius = Math.sqrt(rootClearance ** 2 + random() * (fieldRadius ** 2 - rootClearance ** 2));
    const point: Cell = { key: candidates.length, x: start.x + Math.cos(angle) * radius, y: start.y + Math.sin(angle) * radius };
    const gx = Math.floor(point.x / bucketSize), gy = Math.floor(point.y / bucketSize);
    let clear = true;
    for (let dx = -2; dx <= 2 && clear; dx++) for (let dy = -2; dy <= 2 && clear; dy++) {
      for (const other of buckets.get(`${gx + dx}:${gy + dy}`) ?? []) {
        if (distance(point, other) < minSeparation) { clear = false; break; }
      }
    }
    if (!clear) continue;
    candidates.push(point);
    const key = `${gx}:${gy}`;
    const bucket = buckets.get(key);
    if (bucket) bucket.push(point); else buckets.set(key, [point]);
  }
  if (candidates.length < allNormals.length)
    throw new Error(`tree network: the field fits ${candidates.length} road positions for ${allNormals.length} Normal nodes`);
  const cells = candidates;

  const assigned = new Array<number>(cells.length).fill(-1);
  const regionEnds: number[] = [];
  for (const list of normals) regionEnds.push((regionEnds.at(-1) ?? 0) + list.length);
  const regionPhase = -Math.PI / 2 - Math.PI / regions.length + (hashUnit(`${seed}:region-phase`) - 0.5) * 0.08;
  const angularOrder = cells.map((cell, index) => {
    const dx = cell.x - start.x, dy = cell.y - start.y;
    const angle = Math.atan2(dy, dx), radial = Math.hypot(dx, dy) / fieldRadius;
    const bent = angle + Math.sin(angle * 2.5 + radial * 4.3 + seed * 0.001) * 0.12 + Math.sin(angle * 4.1 - radial * 2.7) * 0.04;
    return { index, order: ((bent - regionPhase + TAU) % TAU) + (hashUnit(`${seed}:${cell.key}:zone-order`) - 0.5) * 0.006 };
  }).sort((a, b) => a.order - b.order || a.index - b.index);
  for (let i = 0; i < angularOrder.length; i++) {
    const region = regionEnds.findIndex((end) => i < end);
    assigned[angularOrder[i].index] = region;
  }
  if (assigned.some((regionIndex) => regionIndex < 0))
    throw new Error('tree network: could not distribute road positions across regions');

  const positions = new Map<string, Point>();
  const regionCells = regions.map((_, i) => cells.filter((_, cellIndex) => assigned[cellIndex] === i));
  for (let i = 0; i < regions.length; i++) {
    const available = [...regionCells[i]];
    const ordered: Cell[] = [];
    let cursor = available.reduce((best, cell) => distance(cell, start) < distance(best, start) ? cell : best);
    while (available.length) {
      let closest = 0;
      for (let j = 1; j < available.length; j++) {
        const d = distance(cursor, available[j]), best = distance(cursor, available[closest]);
        if (d < best || (d === best && available[j].key < available[closest].key)) closest = j;
      }
      cursor = available.splice(closest, 1)[0];
      ordered.push(cursor);
    }
    for (let j = 0; j < normals[i].length; j++) {
      positions.set(normals[i][j].id, ordered[j]);
    }
  }

  const edges = new Map<string, Road>();
  const degrees = new Map(allNormals.map((node) => [node.id, 0]));
  const addRoad = (a: TreeSpecNode, b: TreeSpecNode) => {
    if (a.id === b.id) return false;
    const key = edgeKey(a.id, b.id);
    if (edges.has(key)) return false;
    edges.set(key, { a: a.id, b: b.id, shape: 'line', key, distance: distance(positions.get(a.id)!, positions.get(b.id)!) });
    degrees.set(a.id, degrees.get(a.id)! + 1); degrees.set(b.id, degrees.get(b.id)! + 1);
    return true;
  };
  const roadList = () => [...edges.values()];

  // A local Euclidean tree supplies each region's spine while the irregular positions keep its
  // forks from following the same six compass directions across the whole field.
  for (let region = 0; region < regions.length; region++) {
    const members = normals[region];
    const used = new Array<boolean>(members.length).fill(false);
    const best = new Array<number>(members.length).fill(Infinity);
    const parent = new Array<number>(members.length).fill(-1);
    const root = members.reduce((bestIndex, node, index) => distance(positions.get(node.id)!, start) < distance(positions.get(members[bestIndex].id)!, start) ? index : bestIndex, 0);
    best[root] = 0;
    for (let step = 0; step < members.length; step++) {
      let current = -1;
      for (let i = 0; i < members.length; i++) if (!used[i] && (current < 0 || best[i] < best[current])) current = i;
      if (current < 0 || !Number.isFinite(best[current])) throw new Error(`tree network: ${regions[region]} road cannot be connected`);
      used[current] = true;
      if (parent[current] >= 0) addRoad(members[current], members[parent[current]]);
      for (let next = 0; next < members.length; next++) {
        if (used[next] || next === current) continue;
        const d = distance(positions.get(members[current].id)!, positions.get(members[next].id)!);
        const tieBreak = hashUnit(`${seed}:${edgeKey(members[current].id, members[next].id)}:road`);
        const oldTieBreak = parent[next] < 0 ? Infinity : hashUnit(`${seed}:${edgeKey(members[parent[next]].id, members[next].id)}:road`);
        if (d < best[next] - 1e-8 || (Math.abs(d - best[next]) <= 1e-8 && tieBreak < oldTieBreak)) {
          best[next] = d;
          parent[next] = current;
        }
      }
    }
  }
  for (let i = 0; i < regions.length; i++) {
    const aWing = normals[i], bWing = normals[(i + 1) % regions.length];
    const pairs = aWing.flatMap((a) => bWing.map((b) => ({ a, b, d: distance(positions.get(a.id)!, positions.get(b.id)!) })))
      .sort((a, b) => a.d - b.d || edgeKey(a.a.id, a.b.id).localeCompare(edgeKey(b.a.id, b.b.id)));
    const pair = pairs.find(({ a, b, d }) => d <= spacing * 2.2 && !roadList().some((edge) =>
      edge.a !== a.id && edge.a !== b.id && edge.b !== a.id && edge.b !== b.id
        && cross(positions.get(a.id)!, positions.get(b.id)!, positions.get(edge.a)!, positions.get(edge.b)!)));
    if (!pair || !addRoad(pair.a, pair.b)) throw new Error(`tree network: ${regions[i]} cannot bridge into ${regions[(i + 1) % regions.length]}`);
  }
  const spanningEdges = new Set(edges.keys());

  const roadConflicts = (spots: { point: Point; radius: number }[], segments: [Point, Point, Set<string>][]) => {
    const blocked = new Set<string>();
    for (const edge of roadList()) {
      const a = positions.get(edge.a)!, b = positions.get(edge.b)!;
      const closeToIcon = spots.some(({ point, radius }) =>
        pointToSegment(point, a, b) < radius + radiusOfNormal() + 2);
      const crossesConnector = segments.some(([from, to, skip]) => !skip.has(edge.a) && !skip.has(edge.b) && cross(from, to, a, b));
      if (closeToIcon || crossesConnector) blocked.add(edge.key);
    }
    return blocked;
  };
  const removeLocalRoutes = (blocked: Set<string>) => {
    for (const key of blocked) {
      if (spanningEdges.has(key)) return false;
    }
    for (const key of blocked) {
      const edge = edges.get(key);
      if (!edge) continue;
      edges.delete(key);
      degrees.set(edge.a, degrees.get(edge.a)! - 1);
      degrees.set(edge.b, degrees.get(edge.b)! - 1);
    }
    return true;
  };
  const radiusOfNormal = () => Number(layout.radii?.normal ?? 3.5) * 1.45;

  const routeCandidates = new Map<string, Road>();
  for (let i = 0; i < allNormals.length; i++) {
    const nearest = allNormals.map((node, j) => ({ node, j, d: distance(positions.get(allNormals[i].id)!, positions.get(node.id)!) }))
      .filter((item) => item.j !== i).sort((a, b) => a.d - b.d || a.node.id.localeCompare(b.node.id)).slice(0, 12);
    for (const item of nearest) {
      const a = allNormals[i], b = item.node, key = edgeKey(a.id, b.id);
      if (edges.has(key) || item.d > spacing * 1.55) continue;
      if (!routeCandidates.has(key)) routeCandidates.set(key, { a: a.id, b: b.id, shape: 'line', key, distance: item.d });
    }
  }
  const localRoutes = [...routeCandidates.values()].sort((a, b) => a.distance - b.distance
    + (hashUnit(`${seed}:${a.key}:route`) - hashUnit(`${seed}:${b.key}:route`)) * spacing * 0.08);
  let addedRoutes = 0;
  for (const route of localRoutes) {
    if (addedRoutes >= loopCount) break;
    if (degrees.get(route.a)! >= 5 || degrees.get(route.b)! >= 5) continue;
    const a = positions.get(route.a)!, b = positions.get(route.b)!;
    if (roadList().some((edge) => edge.a !== route.a && edge.a !== route.b && edge.b !== route.a && edge.b !== route.b
      && cross(a, b, positions.get(edge.a)!, positions.get(edge.b)!))) continue;
    const left = allNormals.find((node) => node.id === route.a)!, right = allNormals.find((node) => node.id === route.b)!;
    if (addRoad(left, right)) addedRoutes++;
  }
  if (addedRoutes < Math.min(loopCount, routeCandidates.size / 3))
    throw new Error(`tree network: only ${addedRoutes} of ${loopCount} requested alternate roads fit without crossings`);

  const parents = new Map<string, string[]>();
  const starts = normals.map((list) => list.reduce((bestNode, node) => distance(positions.get(node.id)!, start) < distance(positions.get(bestNode.id)!, start) ? node : bestNode));

  const radiusOf = (kind: string) => Number(layout.radii?.[kind] ?? (kind === 'keystone' ? 9 : kind === 'notable' ? 7 : 3.5))
    * (kind === 'keystone' ? 1.55 : kind === 'notable' ? 1.25 : 1.45);
  const placedSpecial: { node: TreeSpecNode; point: Point }[] = [];
  const normalById = new Map(allNormals.map((node) => [node.id, node]));
  const specialNodes = nodes.filter((node) => node.kind !== 'normal');
  const leafByCluster = new Map<string, TreeSpecNode[]>();
  for (const node of specialNodes.filter((item) => item.placement?.role === 'keystone')) {
    const key = `${node.wing}:${(node.placement as { cluster: number }).cluster}`;
    const list = leafByCluster.get(key) ?? [];
    if (list.length >= 2) throw new Error(`tree network: ${key} already holds two Keystones`);
    list.push(node);
    leafByCluster.set(key, list);
  }
  for (const list of leafByCluster.values())
    list.sort((a, b) => ((a.placement as { slot?: number }).slot ?? 1) - ((b.placement as { slot?: number }).slot ?? 1));
  const pointIsClear = (node: TreeSpecNode, point: Point, allow: Set<string> = new Set()) => {
    for (const other of allNormals) {
      if (allow.has(other.id)) continue;
      if (distance(point, positions.get(other.id)!) < radiusOf(node.kind) + radiusOf(other.kind) + 2) return false;
    }
    for (const other of placedSpecial) {
      if (allow.has(other.node.id)) continue;
      if (distance(point, other.point) < radiusOf(node.kind) + radiusOf(other.node.kind) + 2) return false;
    }
    return true;
  };
  /** A pocket may not clear a local road that is the only thing keeping an ordinary node on a
   *  route; the node would survive placement and be retired later as filler. */
  const degreeOf = (skip: Set<string>) => {
    const deg = new Map<string, number>();
    for (const edge of roadList()) {
      if (skip.has(edge.key)) continue;
      if (normalById.has(edge.a)) deg.set(edge.a, (deg.get(edge.a) || 0) + 1);
      if (normalById.has(edge.b)) deg.set(edge.b, (deg.get(edge.b) || 0) + 1);
    }
    for (const [id, ps] of parents) {
      if (!normalById.has(id)) continue;
      for (const parent of ps) if (parent === 'start' || normalById.has(parent)) deg.set(id, (deg.get(id) || 0) + 1);
    }
    return deg;
  };
  const strandsAfter = (skip: Set<string>) => {
    const before = degreeOf(new Set());
    const after = degreeOf(skip);
    for (const [id, d] of after) if (d < 2 && (before.get(id) || 0) >= 2) return true;
    return false;
  };

  const pocket = (node: TreeSpecNode, anchor: TreeSpecNode, leaves: TreeSpecNode[]) => {
    const origin = positions.get(anchor.id)!;
    const keyOffset = spacing * 0.84;
    const angleStart = hashUnit(`${seed}:${node.id}:pocket`) * TAU;
    const failures = { node: 0, leaf: 0, connector: 0 };
    for (let attempt = 0; attempt < 360; attempt++) {
      const angle = angleStart + attempt * TAU / 36;
      const radius = spacing * (0.48 + Math.floor(attempt / 36) * 0.18);
      const ux = Math.cos(angle), uy = Math.sin(angle);
      const point = { x: origin.x + ux * radius, y: origin.y + uy * radius };
      if (!pointIsClear(node, point, new Set([anchor.id]))) { failures.node++; continue; }
      // The Notable and its first Keystone keep the historical single-leaf search, so adding a
      // second leaf never moves an existing Notable, Keystone or route.
      const first = leaves[0];
      const firstPoint = first ? { x: point.x + ux * keyOffset, y: point.y + uy * keyOffset } : null;
      if (first && firstPoint) {
        if (!pointIsClear(first, firstPoint, new Set([anchor.id]))) { failures.leaf++; continue; }
        if (pointToSegment(firstPoint, origin, point) < radiusOf(first.kind) + radiusOf(node.kind) + 2) {
          failures.leaf++;
          continue;
        }
      }
      const segments: [Point, Point, Set<string>][] = [[origin, point, new Set([anchor.id])]];
      if (firstPoint) segments.push([point, firstPoint, new Set()]);
      const blocked = roadConflicts([
        { point, radius: radiusOf(node.kind) },
        ...(firstPoint ? [{ point: firstPoint, radius: radiusOf(first!.kind) }] : []),
      ], segments);
      if ([...blocked].some((key) => spanningEdges.has(key))) { failures.connector++; continue; }
      if (strandsAfter(blocked)) { failures.connector++; continue; }
      if (!removeLocalRoutes(blocked)) { failures.connector++; continue; }
      positions.set(node.id, point);
      parents.set(node.id, [anchor.id]);
      placedSpecial.push({ node, point });
      if (first && firstPoint) {
        positions.set(first.id, firstPoint);
        parents.set(first.id, [node.id]);
        placedSpecial.push({ node: first, point: firstPoint });
      }
      // A second Keystone shares the Notable's pocket. It searches wider rings and must clear the
      // first leaf's halo, but it never re-runs the Notable search.
      let extraFailed = false;
      for (const leaf of leaves.slice(1)) {
        const start = hashUnit(`${seed}:${leaf.id}:pocket`) * TAU;
        let placed = false;
        for (const radiusOut of [keyOffset, keyOffset * 1.15, keyOffset * 1.3, keyOffset * 1.5,
          keyOffset * 1.75, keyOffset * 2, keyOffset * 2.5]) {
          for (let i = 0; i < 36; i++) {
            const a = start + i * TAU / 36;
            const candidate = { x: point.x + Math.cos(a) * radiusOut, y: point.y + Math.sin(a) * radiusOut };
            if (!pointIsClear(leaf, candidate, new Set([anchor.id]))) continue;
            if (distance(candidate, point) < radiusOf(leaf.kind) + radiusOf(node.kind) + 2) continue;
            if (firstPoint && distance(candidate, firstPoint)
              < radiusOf(leaf.kind) + radiusOf(first!.kind) + 10) continue;
            if (pointToSegment(candidate, origin, point) < radiusOf(leaf.kind) + radiusOf(node.kind) + 2) continue;
            const extraBlocked = roadConflicts(
              [{ point: candidate, radius: radiusOf(leaf.kind) }],
              [[point, candidate, new Set()]],
            );
            if ([...extraBlocked].some((key) => spanningEdges.has(key))) continue;
            if (strandsAfter(extraBlocked)) continue;
            if (!removeLocalRoutes(extraBlocked)) continue;
            positions.set(leaf.id, candidate);
            parents.set(leaf.id, [node.id]);
            placedSpecial.push({ node: leaf, point: candidate });
            placed = true;
            break;
          }
          if (placed) break;
        }
        if (!placed) { extraFailed = true; break; }
      }
      if (extraFailed) throw new Error(`tree network: cannot place the second Keystone beside ${node.id}`);
      return;
    }
    throw new Error(`tree network: cannot place a clear side pocket for ${node.id} (${JSON.stringify(failures)})`);
  };

  /**
   * Place the extra Keystone of a shared pocket after every Notable and first leaf exists, choosing
   * the candidate that is farthest from the wing's other Keystones. This is what keeps a 15-per-wing
   * field from reading as a handful of paired medallions: the second leaf still hangs off its own
   * Notable, but it settles into the widest gap around it rather than beside its sibling.
   */
  const spreadExtra = (node: TreeSpecNode, anchor: TreeSpecNode, leaves: TreeSpecNode[]) => {
    const notable = positions.get(node.id)!;
    const origin = positions.get(anchor.id)!;
    const keyOffset = spacing * 0.84;
    for (const leaf of leaves) {
      const first = placedSpecial.find((other) => other.node.kind === 'keystone'
        && other.node.id !== leaf.id && (parents.get(other.node.id) ?? []).includes(node.id));
      const firstPoint = first?.point;
      let best: { point: Point; blocked: Set<string>; score: number } | null = null;
      const startAngle = hashUnit(`${seed}:${leaf.id}:spread`) * TAU;
      for (const radiusOut of [keyOffset * 1.2, keyOffset * 1.5, keyOffset * 1.9,
        keyOffset * 2.3, keyOffset * 2.8, keyOffset * 3.4]) {
        for (let i = 0; i < 72; i++) {
          const a = startAngle + i * TAU / 72;
          const candidate = { x: notable.x + Math.cos(a) * radiusOut, y: notable.y + Math.sin(a) * radiusOut };
          if (!pointIsClear(leaf, candidate)) continue;
          if (distance(candidate, notable) < radiusOf(leaf.kind) + radiusOf(node.kind) + 2) continue;
          if (firstPoint && first && distance(candidate, firstPoint)
            < radiusOf(leaf.kind) + radiusOf(first.node.kind) + 10) continue;
          if (pointToSegment(candidate, origin, notable) < radiusOf(leaf.kind) + radiusOf(node.kind) + 2) continue;
          const blocked = roadConflicts(
            [{ point: candidate, radius: radiusOf(leaf.kind) }],
            [[notable, candidate, new Set()]],
          );
          if ([...blocked].some((key) => spanningEdges.has(key))) continue;
          if (strandsAfter(blocked)) continue;
          const others = placedSpecial.filter((other) => other.node.kind === 'keystone' && other.node.id !== leaf.id);
          const sameWing = others.filter((other) => other.node.wing === leaf.wing);
          const nearest = (list: typeof others) => list.length
            ? Math.min(...list.map((other) => distance(candidate, other.point))) : 0;
          // The whole field matters: a second leaf on a wing boundary must not crowd a neighbour's
          // medallion either. Same-wing distance still carries extra weight.
          const score = nearest(others) * 3 + nearest(sameWing) * 2
            + (firstPoint ? distance(candidate, firstPoint) * 0.5 : 0)
            + Math.hypot(candidate.x - start.x, candidate.y - start.y) * 0.05;
          if (!best || score > best.score) best = { point: candidate, blocked, score };
        }
      }
      if (!best) throw new Error(`tree network: cannot spread the second Keystone beside ${node.id}`);
      if (!removeLocalRoutes(best.blocked)) throw new Error(`tree network: cannot clear the spread pocket beside ${node.id}`);
      positions.set(leaf.id, best.point);
      parents.set(leaf.id, [node.id]);
      placedSpecial.push({ node: leaf, point: best.point });
    }
  };

  for (const wing of regions) {
    const notables = specialNodes.filter((node) => node.wing === wing && node.placement?.role === 'notable')
      .sort((a, b) => (a.placement as { cluster: number }).cluster - (b.placement as { cluster: number }).cluster);
    for (const node of notables) {
      const cluster = (node.placement as { cluster: number }).cluster;
      const anchor = normalById.get(`normal.${wing}.c${String(cluster).padStart(2, '0')}.05`);
      if (!anchor) throw new Error(`tree network: ${node.id} has no fifth-step road anchor`);
      // Phase one: the Notable and its historical first leaf, exactly as a single-Keystone cluster.
      pocket(node, anchor, (leafByCluster.get(`${wing}:${cluster}`) ?? []).slice(0, 1));
    }
  }
  // Phase two: the shared-pocket siblings, now scored against the whole field.
  for (const wing of regions) {
    const notables = specialNodes.filter((node) => node.wing === wing && node.placement?.role === 'notable')
      .sort((a, b) => (a.placement as { cluster: number }).cluster - (b.placement as { cluster: number }).cluster);
    for (const node of notables) {
      const cluster = (node.placement as { cluster: number }).cluster;
      const leaves = leafByCluster.get(`${wing}:${cluster}`) ?? [];
      if (leaves.length < 2) continue;
      const anchor = normalById.get(`normal.${wing}.c${String(cluster).padStart(2, '0')}.05`);
      if (!anchor) throw new Error(`tree network: ${node.id} has no fifth-step road anchor`);
      spreadExtra(node, anchor, leaves.slice(1));
    }
  }

  const junctions = specialNodes.filter((node) => node.placement?.role === 'junction');
  for (const node of junctions) {
    const placement = node.placement as { a: string; b: string };
    const aNodes = normals[regions.indexOf(placement.a)], bNodes = normals[regions.indexOf(placement.b)];
    const pairs = aNodes.flatMap((a) => bNodes.map((b) => ({ a, b, d: distance(positions.get(a.id)!, positions.get(b.id)!) })))
      .sort((a, b) => a.d - b.d || edgeKey(a.a.id, a.b.id).localeCompare(edgeKey(b.a.id, b.b.id))).slice(0, 12);
    let placed = false;
    for (const pair of pairs) {
      const a = positions.get(pair.a.id)!, b = positions.get(pair.b.id)!;
      const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
      if (length < 1) continue;
      for (const side of [-1, 1]) {
        if (placed) break;
        for (const offset of [spacing * 0.38, spacing * 0.52, spacing * 0.68]) {
          const point = { x: (a.x + b.x) / 2 - dy / length * offset * side, y: (a.y + b.y) / 2 + dx / length * offset * side };
          if (!pointIsClear(node, point, new Set([pair.a.id, pair.b.id]))) continue;
          const segments: [Point, Point, Set<string>][] = [[a, point, new Set([pair.a.id])], [b, point, new Set([pair.b.id])]];
          const blocked = roadConflicts([{ point, radius: radiusOf(node.kind) }], segments);
          if ([...blocked].some((key) => spanningEdges.has(key)) || !removeLocalRoutes(blocked)) continue;
          positions.set(node.id, point);
          parents.set(node.id, [pair.a.id, pair.b.id]);
          placedSpecial.push({ node, point });
          placed = true;
          break;
        }
      }
      if (placed) break;
    }
    if (!placed) throw new Error(`tree network: cannot place a clear cross-region junction for ${node.id}`);
  }

  const roadNeighbours = new Map(allNormals.map((node) => [node.id, [] as string[]]));
  for (const edge of roadList()) { roadNeighbours.get(edge.a)!.push(edge.b); roadNeighbours.get(edge.b)!.push(edge.a); }
  const queue: string[] = [];
  for (const node of starts) { parents.set(node.id, ['start']); queue.push(node.id); }
  for (let i = 0; i < queue.length; i++) for (const id of roadNeighbours.get(queue[i])!) {
    if (!parents.has(id)) { parents.set(id, [queue[i]]); queue.push(id); }
  }
  if (allNormals.some((node) => !parents.has(node.id))) throw new Error('tree network: a Normal road is outside the Start-connected field');

  for (const node of nodes) if (!positions.has(node.id) || !parents.has(node.id))
    throw new Error(`tree network: ${node.id} is not placed and connected`);


  const parentEdges = new Set([...parents].flatMap(([id, list]) => list.filter((parent) => parent !== 'start').map((parent) => edgeKey(id, parent))));
  const normalRows = regions.map((_, index) => regionCells[index].map((cell) => allNormals.find((node) => {
    const point = positions.get(node.id)!;
    return point.x === cell.x && point.y === cell.y;
  })!).filter(Boolean));
  return {
    positions,
    parents,
    normalRows,
    links: [...edges.values()].filter((edge) => !parentEdges.has(edge.key)).map(({ a, b, shape }) => ({ a, b, shape })),
  };
}

