import { describe, expect, it } from 'vitest';
import type { NavLayout } from '@engine/navigation.ts';
import { E } from '../../src/engine/client';
import { groundPixelToWorld, groundReferenceReport, proofCells, proofIssues, proofNavLayout, proofRoute } from '../../src/ui/dev/field-nav-proof';

const open: NavLayout = { version: 1, bounds: { x: 0, y: 0, width: 6, height: 6 }, cellSize: 2, obstacles: [] };
const wall: NavLayout = {
  ...open,
  obstacles: [{ kind: 'box', id: 'wall', x: 2, y: 0, width: 2, height: 6, flags: { movement: true, sight: true, projectiles: true } }],
};

describe('field navigation proof overlay data', () => {
  it('falls back to an unauthored proof grid at the arena size', () => {
    const model = proofNavLayout('forest-clearing');
    expect(model.authored).toBe(false);
    expect(model.layout.cellSize).toBe(1);
    expect(model.layout.bounds).toMatchObject({ x: 0, y: 0, width: E.combat_arena.width, height: E.combat_arena.height });
    expect(model.layout.obstacles).toEqual([]);
  });

  it('counts clipped cells and refuses a body that cannot fit the thin final row', () => {
    const cells = proofCells(proofNavLayout().layout, 0.3);
    expect(cells).toHaveLength(Math.ceil(E.combat_arena.width) * Math.ceil(E.combat_arena.height));
    const thin = cells.filter((cell) => cell.height < 0.6);
    expect(thin.length).toBeGreaterThan(0);
    expect(thin.every((cell) => !cell.walkable)).toBe(true);
    expect(cells.some((cell) => cell.walkable)).toBe(true);
  });

  it('marks an authored obstacle on the cells it covers', () => {
    const cells = proofCells(wall, 0.3);
    expect(cells.filter((cell) => !cell.walkable).length).toBeGreaterThan(0);
    expect(cells.every((cell) => cell.width > 0 && cell.height > 0)).toBe(true);
  });

  it('previews a route and reports instead of throwing when none exists', () => {
    const ok = proofRoute(open, { x: 1, y: 1 }, { x: 5, y: 5 }, 0.3);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.length).toBeGreaterThan(0);
    expect(proofRoute(wall, { x: 1, y: 1 }, { x: 5, y: 5 }, 0.3)).toEqual({ ok: false, reason: 'unreachable' });
  });

  it('leaves validation idle until geometry is authored', () => {
    expect(proofIssues('forest-clearing', E.combat_arena.player_start, 0.3)).toBeNull();
  });

  it('reports the camera-locked ground rectangle and its world mapping', () => {
    const report = groundReferenceReport();
    expect(report.artPx).toEqual({ width: 1672, height: 941 });
    expect(report.worldPx.width).toBeGreaterThan(9000);
    expect(report.worldPx.height).toBeGreaterThan(5000);
    expect(report.worldLocked).toBe(true);
    expect(report.viewPxPerMeter).toBeGreaterThan(190);
    const center = groundPixelToWorld(report.artPx.width / 2, report.artPx.height / 2);
    expect(center.x).toBeCloseTo(24.43, 1);
    expect(center.y).toBeCloseTo(15.98, 1);
    expect(report.artPxPerMeter.x).toBeCloseTo(24.0, 1);
    expect(report.artPxPerMeter.y).toBeCloseTo(17.27, 1);
  });
});
