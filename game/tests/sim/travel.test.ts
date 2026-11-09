import { describe, expect, it } from 'vitest';
import { createRoad, hexAdjacent } from '../../../engine/road.ts';
import {
  planCells,
  planKeys,
  planTravel,
  projectProgress,
  replanSuffix,
  travelCacheKey,
  validatePlanForContext,
  validateTravelEdge,
  walkEdgeId,
  type Hex,
  type MovementEdge,
  type TravelContext,
} from '../../../engine/travel.ts';

const base = { nodes: [{ id: 'a', q: 0, r: 0 }, { id: 'b', q: 4, r: 0 }], block_sec: 1 } as any;

const ctxFor = (isLand: (h: Hex) => boolean, extra: Partial<TravelContext> = {}): TravelContext => ({
  worldRevision: 'w1',
  movementRevision: 'm1',
  isLand,
  walkDurationUs: 1,
  ...extra,
});

const walkEdge = (from: Hex, to: Hex, durationUs: number, id = walkEdgeId(from, to)): MovementEdge => ({
  id, from: { ...from }, to: { ...to }, kind: 'walk', durationUs,
});

describe('travel planning', () => {
  it('matches the existing BFS routes step for step on uniform costs', () => {
    // Open lattice (no mask): the old route is the straight hexPath line, so parity is the
    // same step count, adjacent steps, endpoints and determinism.
    const open = createRoad({ road: base } as any);
    const openCtx = ctxFor(open.isLand);
    const pairs: [Hex, Hex][] = [
      [{ q: 0, r: 0 }, { q: 4, r: -2 }],
      [{ q: 0, r: 0 }, { q: 3, r: 2 }],
      [{ q: -2, r: 1 }, { q: 2, r: -3 }],
      [{ q: 1, r: 1 }, { q: 1, r: 1 }],
    ];
    for (const [from, to] of pairs) {
      const planned = planTravel(from, to, openCtx);
      expect(planned, `${JSON.stringify(from)}->${JSON.stringify(to)}`).not.toBeNull();
      const cells = planCells(planned!);
      expect(cells[0]).toEqual(from);
      expect(cells[cells.length - 1]).toEqual(to);
      expect(planned!.totalDurationUs).toBe(open.blocksLand(from, to));
      expect(cells).toHaveLength((open.blocksLand(from, to) ?? 0) + 1);
      for (let i = 1; i < cells.length; i++) {
        expect(hexAdjacent(cells[i - 1], cells[i]), `step ${i} must share an edge`).toBe(true);
      }
      // Deterministic: re-planning the same context yields the same plan.
      expect(planKeys(planTravel(from, to, openCtx)!)).toEqual(planKeys(planned!));
    }
    // Masked ground: the old route is the BFS route, so parity is exact, cell for cell.
    // (hexPath can sign a coordinate -0; compare zero-normalized cells and keys.)
    const land: [number, number][] = [];
    for (let q = -6; q <= 6; q++) for (let r = -6; r <= 6; r++) land.push([q, r]);
    const masked = createRoad({ road: { ...base, land } } as any);
    const maskedCtx = ctxFor(masked.isLand);
    for (const [from, to] of pairs) {
      const planned = planTravel(from, to, maskedCtx);
      expect(planned, `${JSON.stringify(from)}->${JSON.stringify(to)}`).not.toBeNull();
      const expected = masked.routeLand(from, to)!.map((c) => ({ q: c.q + 0, r: c.r + 0 }));
      expect(planCells(planned!)).toEqual(expected);
      expect(planKeys(planned!)).toEqual(expected.map((c) => `${c.q},${c.r}`));
      expect(planned!.totalDurationUs).toBe(masked.blocksLand(from, to));
      expect(planned!.worldRevision).toBe('w1');
      expect(planned!.movementRevision).toBe('m1');
    }
  });

  it('matches BFS around a mask gap and reports unreachable explicitly', () => {
    const land: [number, number][] = [];
    for (let q = -3; q <= 5; q++) for (let r = -3; r <= 3; r++) {
      if (q === 2 && r !== 0) continue;
      land.push([q, r]);
    }
    const road = createRoad({ road: { ...base, land } } as any);
    const ctx = ctxFor(road.isLand);
    const from = { q: 0, r: 0 }, to = { q: 4, r: 0 };
    const planned = planTravel(from, to, ctx)!;
    expect(planCells(planned)).toEqual(road.routeLand(from, to));
    expect(planTravel(from, { q: 2, r: 1 }, ctx)).toBeNull();
    expect(planTravel(from, { q: 999, r: -999 }, ctx)).toBeNull();
  });

  it('lets a cheaper longer fixture road win over the short expensive walk', () => {
    const landSet = new Set(['0,0', '1,0', '2,0', '0,-1', '1,-1', '2,-1']);
    const ctx = ctxFor((h) => landSet.has(`${h.q},${h.r}`), {
      edgeOverrides: [walkEdge({ q: 0, r: 0 }, { q: 1, r: 0 }, 100), walkEdge({ q: 1, r: 0 }, { q: 2, r: 0 }, 100)],
    });
    const planned = planTravel({ q: 0, r: 0 }, { q: 2, r: 0 }, ctx)!;
    // 3 cheap steps via the top row beat 2 expensive ones; geography is untouched.
    expect(planKeys(planned)).toEqual(['0,0', '1,-1', '2,-1', '2,0']);
    expect(planned.totalDurationUs).toBe(3);
    expect(planTravel({ q: 0, r: 0 }, { q: 2, r: 0 }, ctxFor((h) => landSet.has(`${h.q},${h.r}`)))!.totalDurationUs).toBe(2);
  });

  it('traverses a declared connection in its declared direction only', () => {
    const landSet = new Set(['0,0', '1,0', '2,0']);
    const isLand = (h: Hex) => landSet.has(`${h.q},${h.r}`);
    const connection: MovementEdge = {
      id: 'ferry:0,0>2,0', from: { q: 0, r: 0 }, to: { q: 2, r: 0 },
      kind: 'connection', durationUs: 1, sourceFeatureId: 'fixture-ferry',
    };
    const ctx = ctxFor(isLand, { connections: [connection], allowedConnectionIds: [connection.id] });
    // Forward: the one-step connection is the whole plan.
    expect(planKeys(planTravel({ q: 0, r: 0 }, { q: 2, r: 0 }, ctx)!)).toEqual(['0,0', '2,0']);
    // Reverse: no reverse edge is implied, so the planner walks back over land.
    expect(planKeys(planTravel({ q: 2, r: 0 }, { q: 0, r: 0 }, ctx)!)).toEqual(['2,0', '1,0', '0,0']);
    // Registered but not allowed is not open.
    const unallowed = ctxFor(isLand, { connections: [connection] });
    expect(planKeys(planTravel({ q: 0, r: 0 }, { q: 2, r: 0 }, unallowed)!)).toEqual(['0,0', '1,0', '2,0']);
  });

  it('never crosses a blocked edge: reroutes, or reports unreachable', () => {
    const landSet = new Set(['0,0', '1,0', '2,0', '0,-1', '1,-1', '2,-1']);
    const isLand = (h: Hex) => landSet.has(`${h.q},${h.r}`);
    const blocked = walkEdgeId({ q: 0, r: 0 }, { q: 1, r: 0 });
    const planned = planTravel({ q: 0, r: 0 }, { q: 2, r: 0 }, ctxFor(isLand, { blockedEdgeIds: [blocked] }))!;
    expect(planKeys(planned)).toEqual(['0,0', '1,-1', '2,-1', '2,0']);
    expect(planned.legs.some((leg) => leg.edge.id === blocked)).toBe(false);
    // Closing the only chain leaves an explicit null, not a detour through void.
    const corridor = new Set(['0,0', '1,0', '2,0']);
    const cut = ctxFor((h) => corridor.has(`${h.q},${h.r}`), { blockedEdgeIds: [walkEdgeId({ q: 0, r: 0 }, { q: 1, r: 0 })] });
    expect(planTravel({ q: 0, r: 0 }, { q: 2, r: 0 }, cut)).toBeNull();
    // The directed nature of a closure: the reverse step stays open.
    expect(planKeys(planTravel({ q: 1, r: 0 }, { q: 0, r: 0 }, cut)!)).toEqual(['1,0', '0,0']);
  });

  it('rejects zero, negative and non-finite movement costs', () => {
    const landSet = new Set(['0,0', '1,0']);
    const isLand = (h: Hex) => landSet.has(`${h.q},${h.r}`);
    for (const bad of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => planTravel({ q: 0, r: 0 }, { q: 1, r: 0 }, ctxFor(isLand, {
        edgeOverrides: [walkEdge({ q: 0, r: 0 }, { q: 1, r: 0 }, bad)],
      }))).toThrow(/finite positive/);
      expect(() => validateTravelEdge(walkEdge({ q: 0, r: 0 }, { q: 1, r: 0 }, bad))).toThrow(/finite positive/);
    }
    expect(() => planTravel({ q: 0, r: 0 }, { q: 1, r: 0 }, ctxFor(isLand, { walkDurationUs: 0 }))).toThrow(/finite positive/);
  });

  it('refuses an undeclared jump: no adjacency, no route', () => {
    // A walk-kind edge spanning two cells is invalid on its face.
    expect(() => validateTravelEdge({
      id: 'jump', from: { q: 0, r: 0 }, to: { q: 3, r: 0 }, kind: 'walk', durationUs: 1,
    })).toThrow(/adjacent/);
    // An undeclared non-adjacent edge never becomes a route, even when handed to the planner.
    const landSet = new Set(['0,0', '1,0', '2,0', '3,0']);
    const isLand = (h: Hex) => landSet.has(`${h.q},${h.r}`);
    const sneaky: MovementEdge = {
      id: 'sneaky', from: { q: 0, r: 0 }, to: { q: 3, r: 0 }, kind: 'connection', durationUs: 1,
    };
    const planned = planTravel({ q: 0, r: 0 }, { q: 3, r: 0 }, ctxFor(isLand, { connections: [sneaky] }))!;
    expect(planKeys(planned)).toEqual(['0,0', '1,0', '2,0', '3,0']);
    expect(planned.legs.some((leg) => leg.edge.id === 'sneaky')).toBe(false);
  });

  it('freezes durations, projects ETA/progress, and replans only the suffix', () => {
    const landSet = new Set(['0,0', '1,0', '2,0', '0,-1', '1,-1', '2,-1']);
    const isLand = (h: Hex) => landSet.has(`${h.q},${h.r}`);
    const ctx = ctxFor(isLand);
    const planned = planTravel({ q: 0, r: 0 }, { q: 2, r: 0 }, ctx)!;
    const progress = projectProgress(planned, 1, 1);
    expect(progress.position).toEqual({ q: 1, r: 0 });
    expect(progress.completedDurationUs).toBe(1);
    expect(progress.remainingDurationUs).toBe(0);
    expect(progress.done).toBe(false);
    expect(validatePlanForContext(planned, ctx)).toEqual({ ok: true });
    // A closure on the last leg moves the movement revision; the saved plan is stale but the
    // committed prefix survives and the suffix re-plans around it.
    const afterClosure = ctxFor(isLand, {
      movementRevision: 'm2',
      blockedEdgeIds: [walkEdgeId({ q: 1, r: 0 }, { q: 2, r: 0 })],
    });
    expect(validatePlanForContext(planned, afterClosure)).toMatchObject({ ok: false });
    const suffix = replanSuffix(planned, 1, afterClosure)!;
    expect(suffix.origin).toEqual({ q: 1, r: 0 });
    expect(planKeys(suffix)).toEqual(['1,0', '2,-1', '2,0']);
    const key = travelCacheKey({ q: 0, r: 0 }, { q: 2, r: 0 }, ctx);
    expect(key).toContain('|ww1|mm1|');
    expect(travelCacheKey({ q: 0, r: 0 }, { q: 2, r: 0 }, afterClosure)).not.toBe(key);
  });
});
