import { E, spawns } from '../../engine/client';
import { isClear, navCells, route, type NavLayout, type NavPoint, type NavRouteResult } from '@engine/navigation.ts';
import { checkSpawnNavigation, type SpawnNavigationIssue } from '@engine/spawns.ts';
import { arenaGroundBounds, unprojectArenaPoint } from '../../presentation/arena-camera';
import { arenaArt } from '../combat/arena/arena-art';

/** Dev-only overlay data. Authored geometry when it exists, never a guessed substitute. */
export function proofNavLayout(layoutId = 'forest-clearing'): { layout: NavLayout; authored: boolean } {
  const authored = spawns.navigation(layoutId);
  if (authored) return { layout: authored, authored: true };
  return {
    authored: false,
    layout: {
      version: 0,
      bounds: { x: 0, y: 0, width: E.combat_arena.width, height: E.combat_arena.height },
      cellSize: 1,
      obstacles: [],
    },
  };
}

export interface GroundReferenceReport {
  /** Screen extent the arena corners project to, in arena-view pixels. */
  worldPx: { width: number; height: number };
  /** The painted ground's declared source size. */
  artPx: { width: number; height: number };
  /** True while the arena draws the ground inside the camera layer over the whole world footprint. */
  worldLocked: boolean;
  /** View pixels per world meter along x (camera-space scale of the ground rectangle). */
  viewPxPerMeter: number;
  /** Painted-image pixels per world meter along each image axis; unequal means world anisotropy. */
  artPxPerMeter: { x: number; y: number };
}

/** Map a painted-ground pixel to world meters through the camera-locked ground rectangle. */
export function groundPixelToWorld(u: number, v: number): { x: number; y: number } {
  const bounds = arenaGroundBounds({ width: E.combat_arena.width, height: E.combat_arena.height });
  const art = arenaArt.background;
  return unprojectArenaPoint({
    x: bounds.left + u * (bounds.width / art.width),
    y: bounds.top + v * (bounds.height / art.height),
  });
}

/**
 * Calibration prerequisite: the painted ground is a fixed `object-fit: cover` image while actors
 * are placed by `projectArenaPoint`, so a painted rock only has a world coordinate if the art
 * spans the world's projected extent. Report the mismatch instead of guessing colliders.
 */
export function groundReferenceReport(): GroundReferenceReport {
  const bounds = arenaGroundBounds({ width: E.combat_arena.width, height: E.combat_arena.height });
  const artPx = { width: arenaArt.background.width, height: arenaArt.background.height };
  const topLeft = groundPixelToWorld(0, 0);
  const topRight = groundPixelToWorld(artPx.width, 0);
  const bottomLeft = groundPixelToWorld(0, artPx.height);
  return {
    worldPx: { width: bounds.width, height: bounds.height },
    artPx,
    worldLocked: true,
    viewPxPerMeter: bounds.width / E.combat_arena.width,
    artPxPerMeter: {
      x: artPx.width / Math.hypot(topRight.x - topLeft.x, topRight.y - topLeft.y),
      y: artPx.height / Math.hypot(bottomLeft.x - topLeft.x, bottomLeft.y - topLeft.y),
    },
  };
}

export interface ProofCell {
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  centre: NavPoint;
  walkable: boolean;
}

export function proofCells(layout: NavLayout, radius: number): ProofCell[] {
  return navCells(layout).map((cell) => ({ ...cell, walkable: isClear(layout, cell.centre, radius) }));
}

export function proofIssues(layoutId: string, start: NavPoint, radius: number): SpawnNavigationIssue[] | null {
  return checkSpawnNavigation(spawns, layoutId, start, radius);
}

export function proofRoute(
  layout: NavLayout, start: NavPoint, goal: NavPoint, radius: number,
): NavRouteResult {
  return route(layout, start, [{ id: 'goal', x: goal.x, y: goal.y }], radius);
}
