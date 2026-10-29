/**
 * Static field navigation geometry, pure and data-driven.
 *
 * `spawns.json` owns where bodies live; this module answers only what the ground allows: a disc
 * clearance test, a swept-disc contact, a sight trace and an eight-neighbour route over an
 * injected layout. World positions stay continuous metres — the grid only chooses waypoints, so a
 * caller follows the returned points instead of snapping between cells. Runtime actors are never
 * baked in as walls; avoidance stays soft and belongs to the arena.
 *
 * Pure: no file, no clock, no DOM, no game imports, no RNG. The same kernel runs in the browser
 * client and the cages.
 */

const EPS = 1e-9;
const MIN_DEFECT = -1e-9;

export interface NavPoint { x: number; y: number }
export interface NavBounds { x: number; y: number; width: number; height: number }
export interface NavFlags { movement: boolean; sight: boolean; projectiles: boolean }
export interface NavCircle {
  kind: 'circle'; id: string; x: number; y: number; radius: number; flags: NavFlags;
}
export interface NavBox {
  kind: 'box'; id: string; x: number; y: number; width: number; height: number; flags: NavFlags;
}
export type NavObstacle = NavCircle | NavBox;
export interface NavLayout {
  version: number;
  bounds: NavBounds;
  cellSize: number;
  obstacles: NavObstacle[];
}
export type NavMask = keyof NavFlags;
export interface NavGoal extends NavPoint { id: string }
/** The first point where a swept body would enter an obstacle interior. `fraction` is in [0, 1]. */
export interface NavContact { fraction: number; x: number; y: number; obstacleId: string }
export type NavRouteResult =
  | { ok: true; goalId: string; waypoints: NavPoint[]; length: number }
  | { ok: false; reason: 'invalid-start' | 'no-goal' | 'unreachable' };

const distance = (a: NavPoint, b: NavPoint): number => Math.hypot(a.x - b.x, a.y - b.y);

/** Signed clearance to the obstacle's own edge; negative means the disc is inside the interior. */
function defectAt(obstacle: NavObstacle, point: NavPoint, radius: number): number {
  if (obstacle.kind === 'circle') {
    return distance(obstacle, point) - obstacle.radius - radius;
  }
  const dx = Math.max(obstacle.x - point.x, 0, point.x - (obstacle.x + obstacle.width));
  const dy = Math.max(obstacle.y - point.y, 0, point.y - (obstacle.y + obstacle.height));
  if (dx === 0 && dy === 0) {
    // A point inside the box is a penetration, not a tangent: a zero-radius ray must still stop,
    // so the depth is the nearest edge (positive inside, zero on the face).
    const depth = Math.min(
      point.x - obstacle.x, obstacle.x + obstacle.width - point.x,
      point.y - obstacle.y, obstacle.y + obstacle.height - point.y,
    );
    return -Math.max(depth, 0) - radius;
  }
  return Math.hypot(dx, dy) - radius;
}

function insideBounds(bounds: NavBounds, point: NavPoint, radius: number): boolean {
  return point.x - radius >= bounds.x - EPS
    && point.x + radius <= bounds.x + bounds.width + EPS
    && point.y - radius >= bounds.y - EPS
    && point.y + radius <= bounds.y + bounds.height + EPS;
}

/** The first obstacle the disc already overlaps, or `null`. Tangency is clearance, not a hit. */
export function blockingObstacle(
  layout: NavLayout, point: NavPoint, radius: number, mask: NavMask = 'movement',
): NavObstacle | null {
  for (const obstacle of layout.obstacles) {
    if (!obstacle.flags[mask]) continue;
    if (defectAt(obstacle, point, radius) < MIN_DEFECT) return obstacle;
  }
  return null;
}

export function isClear(
  layout: NavLayout, point: NavPoint, radius: number, mask: NavMask = 'movement',
): boolean {
  if (!insideBounds(layout.bounds, point, radius)) return false;
  return blockingObstacle(layout, point, radius, mask) === null;
}

/**
 * The earliest entry fraction of a body sweeping from `from` to `to`, or null when the whole
 * segment stays clear. A body that starts touching and moves away is not blocked; a zero-length
 * sweep is an occupancy check. Distance to a convex obstacle along a line is convex, so the closest
 * approach is found by ternary search and the entry by bisection on that monotone side.
 */
export function sweepDisc(
  layout: NavLayout, from: NavPoint, to: NavPoint, radius: number, mask: NavMask = 'movement',
): NavContact | null {
  if (!insideBounds(layout.bounds, from, radius)) {
    return { fraction: 0, x: from.x, y: from.y, obstacleId: 'bounds' };
  }
  let blocked = blockingObstacle(layout, from, radius, mask);
  if (blocked) return { fraction: 0, x: from.x, y: from.y, obstacleId: blocked.id };
  if (from.x === to.x && from.y === to.y) return null;
  let best: NavContact | null = null;
  for (const obstacle of layout.obstacles) {
    if (!obstacle.flags[mask]) continue;
    const at = (t: number): NavPoint => ({
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    });
    const value = (t: number): number => defectAt(obstacle, at(t), radius);
    let lo = 0;
    let hi = 1;
    for (let index = 0; index < 100; index++) {
      const third = (hi - lo) / 3;
      if (value(lo + third) < value(hi - third)) hi -= third;
      else lo += third;
    }
    const closest = (lo + hi) / 2;
    if (value(closest) >= MIN_DEFECT) continue;
    let low = 0;
    let high = closest;
    for (let index = 0; index < 60; index++) {
      const middle = (low + high) / 2;
      if (value(middle) < 0) high = middle;
      else low = middle;
    }
    const fraction = high;
    if (!best || fraction < best.fraction - EPS) {
      const point = at(fraction);
      best = { fraction, x: point.x, y: point.y, obstacleId: obstacle.id };
    }
  }
  return best;
}

/** Line of sight over the sight mask: the first interior crossing of a zero-width ray. */
export function traceSight(layout: NavLayout, from: NavPoint, to: NavPoint): NavContact | null {
  return sweepDisc(layout, from, to, 0, 'sight');
}

interface GridShape { cols: number; rows: number }

function gridShape(layout: NavLayout): GridShape {
  if (!(layout.cellSize > 0)) throw new Error('navigation: cellSize must be positive');
  const { width, height } = layout.bounds;
  if (!(width > 0) || !(height > 0)) throw new Error('navigation: bounds must be positive');
  return { cols: Math.ceil(width / layout.cellSize), rows: Math.ceil(height / layout.cellSize) };
}

/** Cell boundaries, with the last column/row clipped to the world bounds. */
function cellSpan(origin: number, size: number, index: number, count: number, extent: number): [number, number] {
  const start = origin + index * size;
  const end = index === count - 1 ? origin + extent : start + size;
  return [start, end];
}

function cellCentre(layout: NavLayout, row: number, col: number): NavPoint {
  const { cols, rows } = gridShape(layout);
  const [x0, x1] = cellSpan(layout.bounds.x, layout.cellSize, col, cols, layout.bounds.width);
  const [y0, y1] = cellSpan(layout.bounds.y, layout.cellSize, row, rows, layout.bounds.height);
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}

export interface NavCell {
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  centre: NavPoint;
}

/** The clipped grid in row-major order, for a dev overlay or a layout report. */
export function navCells(layout: NavLayout): NavCell[] {
  const { cols, rows } = gridShape(layout);
  const cells: NavCell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const [x0, x1] = cellSpan(layout.bounds.x, layout.cellSize, col, cols, layout.bounds.width);
      const [y0, y1] = cellSpan(layout.bounds.y, layout.cellSize, row, rows, layout.bounds.height);
      cells.push({ row, col, x: x0, y: y0, width: x1 - x0, height: y1 - y0, centre: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 } });
    }
  }
  return cells;
}

/** The cell a point falls in; the outer maximum belongs to the final cell. */
function cellOf(layout: NavLayout, point: NavPoint): { row: number; col: number } {
  const { cols, rows } = gridShape(layout);
  const clamp = (value: number, count: number): number => Math.min(count - 1, Math.max(0, Math.floor(value)));
  return {
    row: clamp((point.y - layout.bounds.y) / layout.cellSize, rows),
    col: clamp((point.x - layout.bounds.x) / layout.cellSize, cols),
  };
}

interface EndpointGraph {
  /** Node index to connector length; a node may appear once with its shortest connector. */
  nodes: Map<number, number>;
}

/** One endpoint attaches to the legal centres of its owning cell and the eight neighbours. */
function attachments(layout: NavLayout, point: NavPoint, radius: number): EndpointGraph {
  const { cols } = gridShape(layout);
  const legal = (row: number, col: number): boolean =>
    row >= 0 && col >= 0 && row < gridShape(layout).rows && col < cols
    && isClear(layout, cellCentre(layout, row, col), radius);
  const segmentClear = (a: NavPoint, b: NavPoint): boolean => sweepDisc(layout, a, b, radius) === null;
  const cell = cellOf(layout, point);
  const nodes = new Map<number, number>();
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const row = cell.row + dr;
      const col = cell.col + dc;
      if (!legal(row, col)) continue;
      const centre = cellCentre(layout, row, col);
      if (dr !== 0 && dc !== 0) {
        const sideA = cellCentre(layout, cell.row, col);
        const sideB = cellCentre(layout, row, cell.col);
        if (!legal(cell.row, col) || !legal(row, cell.col)) continue;
        if (!segmentClear(point, sideA) || !segmentClear(sideA, centre)) continue;
        if (!segmentClear(point, sideB) || !segmentClear(sideB, centre)) continue;
        // the emitted leg is the direct diagonal, not the dogleg that was just
        // probed: a corner the halves slip past can still clip the straight line
        if (!segmentClear(point, centre)) continue;
      } else if (!segmentClear(point, centre)) continue;
      nodes.set(row * cols + col, distance(point, centre));
    }
  }
  return { nodes };
}

interface SearchResult { nodes: number[]; cost: number }

/** Binary heap ordered by (f, node index): cost first, then the fixed row-major node order. */
class MinHeap {
  private readonly keys: number[] = [];
  private readonly items: number[] = [];

  get size(): number { return this.items.length; }

  private less(a: number, b: number): boolean {
    const delta = this.keys[a] - this.keys[b];
    return delta < -EPS || (Math.abs(delta) <= EPS && this.items[a] < this.items[b]);
  }

  push(item: number, key: number): void {
    this.items.push(item);
    this.keys.push(key);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!this.less(index, parent)) break;
      this.swap(index, parent);
      index = parent;
    }
  }

  pop(): number {
    const top = this.items[0];
    const lastItem = this.items.pop() as number;
    const lastKey = this.keys.pop() as number;
    if (this.items.length) {
      this.items[0] = lastItem;
      this.keys[0] = lastKey;
      let index = 0;
      for (;;) {
        const left = index * 2 + 1;
        const right = left + 1;
        let best = index;
        if (left < this.items.length && this.less(left, best)) best = left;
        if (right < this.items.length && this.less(right, best)) best = right;
        if (best === index) break;
        this.swap(index, best);
        index = best;
      }
    }
    return top;
  }

  private swap(a: number, b: number): void {
    [this.keys[a], this.keys[b]] = [this.keys[b], this.keys[a]];
    [this.items[a], this.items[b]] = [this.items[b], this.items[a]];
  }
}

/**
 * One A* to any goal attachment. The heuristic is the straight-line distance to the goal point,
 * which never exceeds the remaining connectors, so the first completion is optimal once the queue
 * bound proves no cheaper path remains.
 */
function astar(
  layout: NavLayout,
  radius: number,
  sources: Map<number, number>,
  goals: Map<number, number>,
  goalPoint: NavPoint,
): SearchResult | null {
  const { cols, rows } = gridShape(layout);
  const centre = (index: number): NavPoint => cellCentre(layout, Math.floor(index / cols), index % cols);
  const legalCache = new Map<number, boolean>();
  const legal = (index: number): boolean => {
    let value = legalCache.get(index);
    if (value === undefined) {
      value = isClear(layout, centre(index), radius);
      legalCache.set(index, value);
    }
    return value;
  };
  const edgeCache = new Map<string, number | null>();
  const edge = (from: number, to: number): number | null => {
    const key = from < to ? `${from}:${to}` : `${to}:${from}`;
    const cached = edgeCache.get(key);
    if (cached !== undefined) return cached;
    let cost: number | null = null;
    const fromRow = Math.floor(from / cols), fromCol = from % cols;
    const toRow = Math.floor(to / cols), toCol = to % cols;
    const dr = toRow - fromRow, dc = toCol - fromCol;
    if (Math.abs(dr) > 1 || Math.abs(dc) > 1 || (dr === 0 && dc === 0)) {
      cost = null;
    } else if (legal(from) && legal(to)) {
      const a = centre(from);
      const b = centre(to);
      if (dr !== 0 && dc !== 0) {
        const sideA = fromRow * cols + toCol;
        const sideB = toRow * cols + fromCol;
        const corners: [number, number][] = [
          [from, sideA], [sideA, to], [from, sideB], [sideB, to],
        ];
        const ok = legal(sideA) && legal(sideB)
          && corners.every(([x, y]) => sweepDisc(layout, centre(x), centre(y), radius) === null)
          // the emitted leg is the direct centre-to-centre diagonal, so a corner that
          // clears both doglegs can still refuse the straight line it actually draws
          && sweepDisc(layout, a, b, radius) === null;
        cost = ok ? distance(a, b) : null;
      } else {
        cost = sweepDisc(layout, a, b, radius) === null ? distance(a, b) : null;
      }
    }
    edgeCache.set(key, cost);
    return cost;
  };

  const gScore = new Map<number, number>();
  const parent = new Map<number, number>();
  const heuristic = (index: number): number => distance(centre(index), goalPoint);
  const heap = new MinHeap();
  const push = (index: number): void => {
    heap.push(index, (gScore.get(index) as number) + heuristic(index));
  };
  for (const [index, cost] of sources) {
    if (!legal(index)) continue;
    const previous = gScore.get(index);
    if (previous !== undefined && previous <= cost) continue;
    gScore.set(index, cost);
    push(index);
  }

  let best: { index: number; cost: number } | null = null;
  while (heap.size) {
    const index = heap.pop();
    if (goals.has(index)) {
      const total = (gScore.get(index) as number) + (goals.get(index) as number);
      if (!best || total < best.cost - EPS) best = { index, cost: total };
    }
    const bound = best ? best.cost : Infinity;
    const g = gScore.get(index) as number;
    if (g + heuristic(index) >= bound - EPS) continue;
    const row = Math.floor(index / cols), col = index % cols;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const nextRow = row + dr, nextCol = col + dc;
        if (nextRow < 0 || nextCol < 0 || nextRow >= rows || nextCol >= cols) continue;
        const next = nextRow * cols + nextCol;
        const cost = edge(index, next);
        if (cost === null) continue;
        const nextG = g + cost;
        const known = gScore.get(next);
        if (known !== undefined && known <= nextG + EPS) continue;
        gScore.set(next, nextG);
        parent.set(next, index);
        push(next);
      }
    }
  }
  if (!best) return null;
  const nodes: number[] = [];
  let cursor = best.index;
  for (let guard = 0; guard <= gScore.size + 1; guard++) {
    nodes.push(cursor);
    const previous = parent.get(cursor);
    if (previous === undefined) break;
    cursor = previous;
  }
  nodes.reverse();
  return { nodes, cost: best.cost };
}

/**
 * The shortest complete route (connectors included) to the cheapest reachable goal. Input order
 * never decides: cost ties choose the lexically smaller goal id, and the graph's own ordering is
 * fixed by the fixture, so a reordered candidate list draws the same route.
 */
export function route(
  layout: NavLayout, start: NavPoint, goals: readonly NavGoal[], radius: number,
): NavRouteResult {
  if (!isClear(layout, start, radius)) return { ok: false, reason: 'invalid-start' };
  const usable: NavGoal[] = [];
  for (const goal of goals) {
    if (typeof goal.id !== 'string' || !goal.id) continue;
    if (!insideBounds(layout.bounds, goal, 0)) continue;
    if (!isClear(layout, goal, radius)) continue;
    if (usable.some((entry) => entry.id === goal.id)) continue;
    usable.push(goal);
  }
  if (!usable.length) return { ok: false, reason: 'no-goal' };

  const exact = usable
    .filter((goal) => distance(goal, start) <= EPS)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))[0];
  if (exact) return { ok: true, goalId: exact.id, waypoints: [{ ...start }], length: 0 };

  const sources = attachments(layout, start, radius);
  if (!sources.nodes.size) return { ok: false, reason: 'unreachable' };
  let best: { goalId: string; result: SearchResult; goal: NavPoint } | null = null;
  for (const goal of usable) {
    const goalsGraph = attachments(layout, goal, radius);
    if (!goalsGraph.nodes.size) continue;
    const found = astar(layout, radius, sources.nodes, goalsGraph.nodes, goal);
    if (!found) continue;
    if (!best || found.cost < best.result.cost - EPS
      || (Math.abs(found.cost - best.result.cost) <= EPS && goal.id < best.goalId)) {
      best = { goalId: goal.id, result: found, goal: { x: goal.x, y: goal.y } };
    }
  }
  if (!best) return { ok: false, reason: 'unreachable' };

  const { cols } = gridShape(layout);
  const points: NavPoint[] = [{ ...start }];
  for (const index of best.result.nodes) {
    points.push(cellCentre(layout, Math.floor(index / cols), index % cols));
  }
  points.push({ x: best.goal.x, y: best.goal.y });
  const waypoints = points.filter((point, index) =>
    index === 0 || distance(point, points[index - 1]) > EPS);
  return { ok: true, goalId: best.goalId, waypoints, length: best.result.cost };
}
