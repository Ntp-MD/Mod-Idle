import { describe, expect, it } from 'vitest';
import { ARENA_CAMERA, ARENA_CULL_MARGIN_X, ARENA_CULL_MARGIN_Y, ARENA_VIEW, arenaActorPixelScale, arenaActorVisible, arenaCameraOffset, arenaGroundBounds, arenaZoomView,
  arenaWorldDirection, projectArenaPoint, projectArenaVector, unprojectArenaPoint } from '../../src/presentation/arena-camera';

describe('local skill VFX and animation camera contract', () => {
  it('matches the agreed art projection rather than substituting a flat camera with the same elevation', () => {
    const east = projectArenaVector({ x: 1, y: 0 }), north = projectArenaVector({ x: 0, y: 1 });
    expect(east.x).toBeCloseTo(137.5274, 4);
    expect(east.y).toBeCloseTo(-26.1957, 4);
    expect(north.x).toBeCloseTo(32.7446, 4);
    expect(north.y).toBeCloseTo(98.2339, 4);
    expect(Math.hypot(north.x, north.y) / Math.hypot(east.x, east.y)).toBeCloseTo(.7396, 4);
    expect(Math.atan2(east.y, east.x) * 180 / Math.PI).toBeCloseTo(-10.78, 2);
    expect(Math.atan2(north.y, north.x) * 180 / Math.PI).toBeCloseTo(71.57, 2);
  });
  it('keeps the nonuniform world headings of the agreed screen-facing sectors', () => {
    for (const [screenAngle, expectedWorldAngle] of [[0, 14.93], [45, 68.20], [90, 103.39], [-45, 319.64]]) {
      const radians = screenAngle * Math.PI / 180;
      const world = arenaWorldDirection({ x: Math.cos(radians), y: Math.sin(radians) });
      const angle = (Math.atan2(world.y, world.x) * 180 / Math.PI + 360) % 360;
      expect(angle).toBeCloseTo(expectedWorldAngle, 2);
    }
  });
  it('keeps screen-relative walk and aim directions normalized on the ground', () => {
    for (const screen of [{ x: 1, y: 0 }, { x: 0, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 }]) {
      const world = arenaWorldDirection(screen), projected = projectArenaVector(world);
      expect(Math.hypot(world.x, world.y)).toBeCloseTo(1, 8);
      expect(projected.x * screen.y - projected.y * screen.x).toBeCloseTo(0, 8);
      expect(projected.x * screen.x + projected.y * screen.y).toBeGreaterThan(0);
    }
    expect(arenaWorldDirection({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });
  it('matches the art foot ellipse and distinguishes its world and screen principal axes', () => {
    const points = Array.from({ length: 720 }, (_, index) => projectArenaVector({
      x: Math.cos(index * Math.PI / 360), y: Math.sin(index * Math.PI / 360),
    }));
    const xx = points.reduce((sum, point) => sum + point.x * point.x, 0) / points.length;
    const yy = points.reduce((sum, point) => sum + point.y * point.y, 0) / points.length;
    const xy = points.reduce((sum, point) => sum + point.x * point.y, 0) / points.length;
    const spread = Math.hypot(xx - yy, 2 * xy);
    const ratio = Math.sqrt((xx + yy - spread) / (xx + yy + spread));
    expect(ratio).toBeCloseTo(.7183, 4);
    expect(Math.asin(ratio) * 180 / Math.PI).toBeCloseTo(45.92, 2);
    expect(Math.atan2(2 * xy, xx - yy) * 90 / Math.PI).toBeCloseTo(-2.29, 2);
    const { a, b, c, d } = ARENA_CAMERA.projection;
    expect(Math.atan2(2 * (a * c + b * d), a * a + b * b - c * c - d * d) * 90 / Math.PI)
      .toBeCloseTo(11.75, 2);
    expect(arenaActorPixelScale(120, 1) * 120).toBeCloseTo(.5 * Math.hypot(137.5274, 32.7446), 4);
    const small = arenaActorPixelScale(120, 1, 'small');
    expect(arenaActorPixelScale(120, 1, 'medium')).toBeCloseTo(small * 1.25);
    expect(arenaActorPixelScale(120, 1, 'large')).toBeCloseTo(small * 1.5);
    expect(arenaActorPixelScale(120, 1, 'boss')).toBeCloseTo(small * 1.8);
    expect(arenaActorPixelScale(120, 1, 'player')).toBe(small);
  });

  it('keeps ground clicks and the follow anchor consistent across the entire field', () => {
    for (const player of [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 0, y: 32.0513 }, { x: 50, y: 32.0513 }, { x: 23.4, y: 16.2256 }]) {
      const camera = arenaCameraOffset(player);
      const projected = projectArenaPoint(player);
      expect(projected.x - camera.x).toBeCloseTo(ARENA_VIEW.width * ARENA_CAMERA.playerAnchor.x, 8);
      expect(projected.y - camera.y).toBeCloseTo(ARENA_VIEW.height * ARENA_CAMERA.playerAnchor.y, 8);
      for (const screen of [{ x: 0, y: 0 }, { x: 1920, y: 1080 }, { x: 960, y: 540 }, { x: 450, y: 700 }]) {
        const world = unprojectArenaPoint({ x: screen.x + camera.x, y: screen.y + camera.y });
        const roundTrip = projectArenaPoint(world);
        expect(roundTrip.x - camera.x).toBeCloseTo(screen.x, 8);
        expect(roundTrip.y - camera.y).toBeCloseTo(screen.y, 8);
      }
    }
    const ground = arenaGroundBounds({ width: 50, height: 32.0513 });
    expect(ground.width).toBeGreaterThan(ARENA_VIEW.width);
    expect(ground.height).toBeGreaterThan(ARENA_VIEW.height);
  });

  it('culls offscreen actors before their full view but keeps pinned bodies', () => {
    const stage = { width: ARENA_VIEW.width, height: ARENA_VIEW.height };
    const camX = 1000, camY = 500;
    expect(arenaActorVisible(camX + 960, camY + 540, camX, camY, stage.width, stage.height)).toBe(true);
    expect(arenaActorVisible(camX - 5000, camY - 5000, camX, camY, stage.width, stage.height)).toBe(false);
    expect(arenaActorVisible(camX - 5000, camY - 5000, camX, camY, stage.width, stage.height, true)).toBe(true);
    expect(arenaActorVisible(camX - ARENA_CULL_MARGIN_X + 1, camY, camX, camY, stage.width, stage.height)).toBe(true);
    expect(arenaActorVisible(camX - ARENA_CULL_MARGIN_X - 1, camY, camX, camY, stage.width, stage.height)).toBe(false);
    expect(arenaActorVisible(camX + stage.width + ARENA_CULL_MARGIN_X + 1, camY, camX, camY, stage.width, stage.height)).toBe(false);
    expect(arenaActorVisible(camX, camY - ARENA_CULL_MARGIN_Y - 1, camX, camY, stage.width, stage.height)).toBe(false);
    expect(ARENA_CULL_MARGIN_X).toBe(220);
    expect(ARENA_CULL_MARGIN_Y).toBe(320);
  });

  it('widens the visible world when zooming out but keeps the player anchored', () => {
    expect(arenaZoomView(1)).toEqual({ width: 1920, height: 1080 });
    expect(arenaZoomView(0.5)).toEqual({ width: 3840, height: 2160 });
    expect(arenaZoomView(2)).toEqual({ width: 1920, height: 1080 });
    expect(arenaZoomView(0)).toEqual({ width: 3840, height: 2160 });
    for (const player of [{ x: 1, y: 2 }, { x: 25, y: 16 }]) {
      const projected = projectArenaPoint(player);
      for (const zoom of [1, 0.75, 0.5]) {
        const view = arenaZoomView(zoom);
        const camera = arenaCameraOffset(player, view);
        expect(projected.x - camera.x).toBeCloseTo(view.width / 2, 8);
        expect(projected.y - camera.y).toBeCloseTo(view.height / 2, 8);
      }
    }
  });
});
