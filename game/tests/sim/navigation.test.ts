import { describe, expect, it } from 'vitest';
import {
  isClear, route, sweepDisc, traceSight,
  type NavBounds, type NavFlags, type NavGoal, type NavLayout, type NavObstacle,
} from '@engine/navigation.ts';

const ALL: NavFlags = { movement: true, sight: true, projectiles: true };
const SIGHT_ONLY: NavFlags = { movement: false, sight: true, projectiles: false };
const MOVE_ONLY: NavFlags = { movement: true, sight: false, projectiles: false };

const circle = (id: string, x: number, y: number, radius: number, flags: NavFlags = ALL): NavObstacle =>
  ({ kind: 'circle', id, x, y, radius, flags });
const box = (id: string, x: number, y: number, width: number, height: number, flags: NavFlags = ALL): NavObstacle =>
  ({ kind: 'box', id, x, y, width, height, flags });
const layout = (bounds: NavBounds, cellSize: number, obstacles: NavObstacle[] = []): NavLayout =>
  ({ version: 1, bounds, cellSize, obstacles });
const square = (z: number, obstacles: NavObstacle[] = [], cellSize = 2): NavLayout =>
  layout({ x: 0, y: 0, width: z, height: z }, cellSize, obstacles);
const goal = (id: string, x: number, y: number): NavGoal => ({ id, x, y });

/** Hand-written adjacency Dijkstra: the oracle never calls the production edge enumerator. */
function dijkstra(count: number, edges: [number, number, number][], source: number, target: number): number {
  const distance = Array.from({ length: count }, () => Infinity);
  distance[source] = 0;
  const done = new Set<number>();
  for (;;) {
    let next = -1;
    for (let index = 0; index < count; index++) {
      if (done.has(index) || distance[index] === Infinity) continue;
      if (next === -1 || distance[index] < distance[next]) next = index;
    }
    if (next === -1 || next === target) break;
    done.add(next);
    for (const [a, b, cost] of edges) {
      const other = a === next ? b : b === next ? a : -1;
      if (other === -1) continue;
      distance[other] = Math.min(distance[other], distance[next] + cost);
    }
  }
  return distance[target];
}

describe('static navigation geometry', () => {
  it('keeps a disc inside the world and treats tangency as clearance', () => {
    const open = square(6);
    expect(isClear(open, { x: 0.1, y: 3 }, 0.1)).toBe(true);
    expect(isClear(open, { x: 0.09, y: 3 }, 0.1)).toBe(false);
    expect(isClear(open, { x: 1, y: 5.9 }, 0.1)).toBe(true);
    expect(isClear(open, { x: 1, y: 5.91 }, 0.1)).toBe(false);
    const rock = square(6, [circle('rock', 3, 3, 1)]);
    expect(isClear(rock, { x: 3, y: 4.1 }, 0.1)).toBe(true);
    expect(isClear(rock, { x: 3, y: 4.09 }, 0.1)).toBe(false);
  });

  it('reports the first circle entry, ignoring a tangent pass and an outward start', () => {
    const rock = square(6, [circle('rock', 3, 3, 1)]);
    const hit = sweepDisc(rock, { x: 1, y: 3 }, { x: 5, y: 3 }, 0.2);
    expect(hit?.obstacleId).toBe('rock');
    expect(hit?.fraction).toBeCloseTo((3 - 1.2 - 1) / 4, 6);
    expect(sweepDisc(rock, { x: 1, y: 4.2 }, { x: 5, y: 4.2 }, 0.2)).toBeNull();
    expect(sweepDisc(rock, { x: 3, y: 4.2 }, { x: 3, y: 6 }, 0.2)).toBeNull();
    expect(sweepDisc(rock, { x: 3, y: 3 }, { x: 3, y: 3 }, 0.2)?.fraction).toBe(0);
    expect(sweepDisc(rock, { x: 1, y: 1 }, { x: 1, y: 1 }, 0.2)).toBeNull();
  });

  it('keeps an AABB corner rounded instead of inflating it into a square', () => {
    const crate = square(6, [box('crate', 1, 1, 1, 1)]);
    expect(isClear(crate, { x: 0.85, y: 0.85 }, 0.2)).toBe(true);
    expect(isClear(crate, { x: 0.87, y: 0.87 }, 0.2)).toBe(false);
    expect(isClear(crate, { x: 1.5, y: 1.5 }, 0.2)).toBe(false);
    const face = sweepDisc(crate, { x: 0.5, y: 1.5 }, { x: 2.5, y: 1.5 }, 0.2);
    expect(face?.fraction).toBeCloseTo(0.15, 6);
  });

  it('keeps movement and sight masks independent', () => {
    const sight = square(6, [circle('haze', 3, 3, 0.5, SIGHT_ONLY)]);
    expect(isClear(sight, { x: 3, y: 3 }, 0.2)).toBe(true);
    expect(traceSight(sight, { x: 1, y: 3 }, { x: 5, y: 3 })?.obstacleId).toBe('haze');
    const solid = square(6, [circle('rock', 3, 3, 0.5, MOVE_ONLY)]);
    expect(isClear(solid, { x: 3, y: 3 }, 0.2)).toBe(false);
    expect(traceSight(solid, { x: 1, y: 3 }, { x: 5, y: 3 })).toBeNull();
  });
});

describe('routes over injected ground', () => {
  it('draws the open diagonal at metric length, matching an independent Dijkstra', () => {
    const open = square(2, [], 1);
    const result = route(open, { x: 0.5, y: 0.5 }, [goal('far-corner', 1.5, 1.5)], 0.1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const oracle = dijkstra(4, [
      [0, 1, 1], [0, 2, 1], [1, 3, 1], [2, 3, 1],
      [0, 3, Math.SQRT2], [1, 2, Math.SQRT2],
    ], 0, 3);
    expect(result.goalId).toBe('far-corner');
    expect(result.length).toBeCloseTo(Math.SQRT2, 6);
    expect(result.length).toBeCloseTo(oracle, 6);
  });

  it('detours a wall and every returned segment stays clear', () => {
    const wall = square(6, [box('wall', 1.9, 0, 0.8, 4.6)]);
    const result = route(wall, { x: 1, y: 1 }, [goal('across', 5, 3)], 0.1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Straights through the wall are refused; the far diagonal after the wall's top edge is legal.
    expect(result.length).toBeCloseTo(6 + 2 * Math.SQRT2, 6);
    for (let index = 1; index < result.waypoints.length; index++) {
      expect(sweepDisc(wall, result.waypoints[index - 1], result.waypoints[index], 0.1)).toBeNull();
      expect(isClear(wall, result.waypoints[index], 0.1)).toBe(true);
    }
  });

  it('refuses a diagonal when both orthogonal side nodes are blocked', () => {
    const pocket = square(2, [circle('a', 1.5, 0.5, 0.3), circle('b', 0.5, 1.5, 0.3)], 1);
    const start = { x: 0.5, y: 0.5 };
    const target = { x: 1.5, y: 1.5 };
    expect(traceSight(pocket, start, target)).toBeNull();
    expect(route(pocket, start, [goal('diagonal', target.x, target.y)], 0.1)).toEqual({ ok: false, reason: 'unreachable' });
  });

  it.each([
    { blocked: circle('a', 1.5, 0.5, 0.3), detour: { x: 0.5, y: 1.5 } },
    { blocked: circle('b', 0.5, 1.5, 0.3), detour: { x: 1.5, y: 0.5 } },
  ])('refuses the diagonal when one side only is blocked and goes around ($blocked.id)', ({ blocked, detour }) => {
    const pocket = square(2, [blocked], 1);
    const start = { x: 0.5, y: 0.5 };
    const target = { x: 1.5, y: 1.5 };
    expect(traceSight(pocket, start, target)).toBeNull();
    const result = route(pocket, start, [goal('diagonal', target.x, target.y)], 0.1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The straight diagonal is √2; a cardinal detour through the open side measures 2.
    expect(result.length).toBeCloseTo(2, 6);
    expect(result.waypoints).toContainEqual(detour);
  });

  it('refuses a diagonal its own straight sweep flags, even when both doglegs are clear', () => {
    // A sliver on the y = x line clips the direct (1.5,1.5)→(2.5,2.5) leg while every
    // half-leg of both doglegs passes at least 0.2 away, outside the 0.05 body.
    const clip = square(4, [box('sliver', 2.05, 1.9, 0.1, 0.4)], 1);
    const result = route(clip, { x: 1.5, y: 1.5 }, [goal('across', 2.5, 2.5)], 0.05);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // the direct leg would measure √2; the legal answer walks around the sliver
    expect(result.length).toBeGreaterThan(1.5);
    for (let index = 1; index < result.waypoints.length; index++) {
      expect(sweepDisc(clip, result.waypoints[index - 1], result.waypoints[index], 0.05)).toBeNull();
    }
  });

  it('attaches through a cardinal path when the containing cell centre is blocked', () => {
    const blockedCentre = square(6, [circle('rock', 3, 3, 0.5)]);
    const result = route(blockedCentre, { x: 1, y: 1 }, [goal('behind', 2.2, 2.2)], 0.1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.length).toBeGreaterThan(0);
    expect(result.waypoints.every((point) => isClear(blockedCentre, point, 0.1))).toBe(true);
    expect(result.waypoints.some((point) => Math.abs(point.x - 3) < 1e-9 && Math.abs(point.y - 3) < 1e-9)).toBe(false);
  });

  it('does not let an endpoint connector cut a blocked corner', () => {
    const pocket = square(2, [circle('a', 1.5, 0.5, 0.3)], 1);
    const start = { x: 0.4, y: 0.4 };
    const target = { x: 1.5, y: 1.5 };
    expect(traceSight(pocket, start, target)).toBeNull();
    const result = route(pocket, start, [goal('diagonal', target.x, target.y)], 0.1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // A diagonal attachment would measure 1.556; the refused corner forces the side node first.
    expect(result.length).toBeCloseTo(Math.hypot(0.1, 1.1) + 1, 6);
  });

  it('picks the cheaper complete route, not the nearer goal, and ignores candidate order', () => {
    const field = square(6, [box('wall', 1.9, 0, 0.8, 4.6)]);
    const start = { x: 1, y: 1 };
    const nearer = goal('a-nearer', 2.9, 1.2);
    const farther = goal('b-farther', 1, 3.4);
    const forward = route(field, start, [nearer, farther], 0.1);
    const reversed = route(field, start, [farther, nearer], 0.1);
    expect(forward).toEqual(reversed);
    expect(forward.ok).toBe(true);
    if (!forward.ok) return;
    expect(forward.goalId).toBe('b-farther');
    expect(forward.length).toBeCloseTo(2.4, 6);
  });

  it('breaks an exact cost tie on the lexically smaller goal id', () => {
    const field = square(6);
    const result = route(field, { x: 1, y: 1 }, [goal('z-goal', 1, 3), goal('a-goal', 3, 1)], 0.1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.goalId).toBe('a-goal');
    expect(result.length).toBeCloseTo(2, 6);
  });

  it('returns a zero-length route when the start is a valid goal', () => {
    const result = route(square(6), { x: 1, y: 1 }, [goal('here', 1, 1)], 0.1);
    expect(result).toEqual({ ok: true, goalId: 'here', waypoints: [{ x: 1, y: 1 }], length: 0 });
  });

  it('clips the final row and column to the world bounds', () => {
    const field = layout({ x: 0, y: 0, width: 5, height: 2 }, 2);
    const result = route(field, { x: 1, y: 1 }, [goal('edge', 4.6, 1)], 0.1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.length).toBeCloseTo(3.6, 6);
    expect(Math.max(...result.waypoints.map((point) => point.x))).toBeLessThanOrEqual(5);
  });

  it('rejects an invalid start and filters goals that cannot be stood on', () => {
    const rock = square(6, [circle('rock', 3, 3, 0.5)]);
    expect(route(rock, { x: 3, y: 3 }, [goal('x', 1, 1)], 0.1)).toEqual({ ok: false, reason: 'invalid-start' });
    expect(route(rock, { x: 1, y: 1 }, [], 0.1)).toEqual({ ok: false, reason: 'no-goal' });
    expect(route(rock, { x: 1, y: 1 }, [goal('inside', 3, 3)], 0.1)).toEqual({ ok: false, reason: 'no-goal' });
    expect(route(rock, { x: 1, y: 1 }, [goal('outside', 9, 1)], 0.1)).toEqual({ ok: false, reason: 'no-goal' });
  });

  it('draws the same route twice for the same inputs', () => {
    const field = square(6, [box('wall', 1.9, 0, 0.8, 4.6)]);
    const goals = [goal('across', 5, 3), goal('back', 1, 5)];
    expect(route(field, { x: 1, y: 1 }, goals, 0.1)).toEqual(route(field, { x: 1, y: 1 }, goals, 0.1));
  });
});
