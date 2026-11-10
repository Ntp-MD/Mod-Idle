import { describe, expect, it } from 'vitest';
import { ARENA_CAMERA, ARENA_CULL_MARGIN_X, ARENA_CULL_MARGIN_Y, ARENA_DEFAULT_WORLD_SCALE, ARENA_VIEW, arenaActorVisible, arenaCameraOffset, arenaZoomView,
  arenaWorldDirection, projectArenaPoint, projectArenaVector, unprojectArenaPoint } from '../../src/presentation/arena-camera';
import { clampWorldScale, createFieldViewFrame } from '../../src/presentation/arena-view-frame';
import { applyViewportToWorld, applyWorldToViewport, applyWorldVector, fieldPointM, fieldVectorM, isUniformScale, viewportPointPx } from '../../src/presentation/view-transform';

describe('local skill VFX and animation camera contract', () => {
  it('keeps north up with perpendicular ground axes at 33 degrees elevation', () => {
    const east = projectArenaVector({ x: 1, y: 0 }), south = projectArenaVector({ x: 0, y: 1 });
    expect(east).toEqual({ x: 140, y: 0 });
    expect(south.x).toBe(0);
    expect(south.y).toBeCloseTo(140 * Math.sin(33 * Math.PI / 180), 8);
    expect(east.x * south.x + east.y * south.y).toBe(0);
    expect(Math.hypot(south.x, south.y) / Math.hypot(east.x, east.y)).toBeCloseTo(Math.sin(33 * Math.PI / 180), 8);
  });
  it('keeps world headings aligned with the screen-facing sectors', () => {
    for (const [screenAngle, expectedWorldAngle] of [[0, 0], [45, 61.42556390245955], [90, 90], [-45, 298.57443609754045]]) {
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
  it('projects ground circles to the 33-degree ellipse while preserving world radius and actor width', () => {
    const points = Array.from({ length: 720 }, (_, index) => projectArenaVector({
      x: Math.cos(index * Math.PI / 360), y: Math.sin(index * Math.PI / 360),
    }));
    const xx = points.reduce((sum, point) => sum + point.x * point.x, 0) / points.length;
    const yy = points.reduce((sum, point) => sum + point.y * point.y, 0) / points.length;
    const xy = points.reduce((sum, point) => sum + point.x * point.y, 0) / points.length;
    const spread = Math.hypot(xx - yy, 2 * xy);
    const ratio = Math.sqrt((xx + yy - spread) / (xx + yy + spread));
    expect(ratio).toBeCloseTo(Math.sin(33 * Math.PI / 180), 8);
    for (const point of points) expect(Math.hypot(point.x / 140,
      point.y / (140 * Math.sin(33 * Math.PI / 180)))).toBeCloseTo(1, 8);
    expect(ARENA_CAMERA.projection.a).toBe(140);
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
    expect(ARENA_VIEW.width).toBeGreaterThan(0);
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
    expect(arenaZoomView(2)).toEqual({ width: 960, height: 540 });
    expect(arenaZoomView(3)).toEqual({ width: 960, height: 540 });
    expect(arenaZoomView(0)).toEqual({ width: 7680, height: 4320 });
    for (const player of [{ x: 1, y: 2 }, { x: 25, y: 16 }]) {
      const projected = projectArenaPoint(player);
      for (const zoom of [2, 1, 0.75, 0.5]) {
        const view = arenaZoomView(zoom);
        const camera = arenaCameraOffset(player, view);
        expect(projected.x - camera.x).toBeCloseTo(view.width / 2, 8);
        expect(projected.y - camera.y).toBeCloseTo(view.height / 2, 8);
      }
    }
  });
});

describe('field view frame parity with the fixed-reference camera (WP1 A1-A3)', () => {
  const scales = [0.5, 0.75, 1, 1.5, 2];
  const stages = [{ width: 1920, height: 1080 }, { width: 1920, height: 946 }, { width: 1280, height: 720 }];
  const frameFor = (worldScale: unknown, viewport = { width: 1920, height: 1080 }) =>
    createFieldViewFrame({
      sceneKey: 'test:parity', atUs: 0, viewportCss: { ...viewport },
      focusM: fieldPointM(25, 16), worldScale,
    });

  it('maps every world point where the legacy camera puts it, at every allowed scale', () => {
    for (const scale of scales) {
      for (const stage of stages) {
        const frame = createFieldViewFrame({
          sceneKey: 'test:parity', atUs: 0, viewportCss: { ...stage },
          focusM: fieldPointM(25, 16), worldScale: scale,
        });
        expect(frame.renderable).toBe(true);
        if (!frame.renderable) continue;
        const view = arenaZoomView(scale, stage);
        const camera = arenaCameraOffset({ x: 25, y: 16 }, view);
        const k = stage.width / view.width;
        for (const world of [{ x: 0, y: 0 }, { x: 50, y: 32.0513 }, { x: 13.25, y: 17.125 }, { x: 25, y: 16 }]) {
          const css = applyWorldToViewport(frame.worldToViewport, fieldPointM(world.x, world.y));
          const ref = projectArenaPoint(world);
          // Screen coords match; div-local coords add the legacy wrapper offset back.
          expect(css.x).toBeCloseTo((ref.x - camera.x) * k, 6);
          expect(css.x + camera.x * k).toBeCloseTo(ref.x * k, 6);
          expect(css.y).toBeCloseTo((ref.y - camera.y) * k, 6);
          // The painted inverse reads the same world the legacy unprojection returns.
          const legacy = unprojectArenaPoint({ x: css.x / k + camera.x, y: css.y / k + camera.y });
          const back = applyViewportToWorld(frame.viewportToWorld, viewportPointPx(css.x, css.y));
          expect(back.x).toBeCloseTo(legacy.x, 8);
          expect(back.y).toBeCloseTo(legacy.y, 8);
          expect(back.x).toBeCloseTo(world.x, 8);
          expect(back.y).toBeCloseTo(world.y, 8);
        }
      }
    }
  });

  it('keeps shared actor/area proportions and doubles both axes together at every scale', () => {
    let previous: number | undefined;
    for (const scale of scales) {
      const frame = frameFor(scale);
      expect(frame.renderable).toBe(true);
      if (!frame.renderable) continue;
      expect(frame.cssPixelsPerMeter).toBeCloseTo(140 * scale, 10);
      expect(frame.worldToViewport.a).toBeGreaterThan(0);
      expect(frame.worldToViewport.d / frame.worldToViewport.a).toBeCloseTo(Math.sin(33 * Math.PI / 180), 8);
      expect(frame.worldToViewport.b).toBe(0);
      expect(frame.worldToViewport.c).toBe(0);
      expect(isUniformScale(frame.worldToViewport)).toBe(false);
      const actor = applyWorldVector(frame.worldToViewport, fieldVectorM(0.5, 0));
      const area = applyWorldVector(frame.worldToViewport, fieldVectorM(3, 0));
      expect(Math.hypot(area.x, area.y) / Math.hypot(actor.x, actor.y)).toBeCloseTo(6, 8);
      const axis = applyWorldVector(frame.worldToViewport, fieldVectorM(1, 0));
      const other = applyWorldVector(frame.worldToViewport, fieldVectorM(0, 1));
      expect(Math.hypot(other.x, other.y) / Math.hypot(axis.x, axis.y)).toBeCloseTo(Math.sin(33 * Math.PI / 180), 8);
      if (previous !== undefined) expect(frame.cssPixelsPerMeter / previous).toBeCloseTo(scale / scales[scales.indexOf(scale) - 1], 8);
      previous = frame.cssPixelsPerMeter;
    }
  });

  it('keeps the ground ellipse ratio when the HUD changes the viewport height', () => {
    const tall = frameFor(1, { width: 1920, height: 1080 });
    const short = frameFor(1, { width: 1920, height: 700 });
    expect(tall.renderable && short.renderable).toBe(true);
    if (!tall.renderable || !short.renderable) return;
    expect(tall.cssPixelsPerMeter).toBeCloseTo(short.cssPixelsPerMeter, 10);
    for (const frame of [tall, short]) {
      expect(isUniformScale(frame.worldToViewport)).toBe(false);
      const axis = applyWorldVector(frame.worldToViewport, fieldVectorM(1, 0));
      const other = applyWorldVector(frame.worldToViewport, fieldVectorM(0, 1));
      expect(Math.hypot(other.x, other.y) / Math.hypot(axis.x, axis.y)).toBeCloseTo(Math.sin(33 * Math.PI / 180), 8);
    }
    // The focus stays on the anchor; only the anchor moves with the height.
    expect(applyWorldToViewport(tall.worldToViewport, fieldPointM(25, 16)).y).toBeCloseTo(540, 8);
    expect(applyWorldToViewport(short.worldToViewport, fieldPointM(25, 16)).y).toBeCloseTo(350, 8);
  });

  it('hides zero/non-finite viewports without exposing matrices, and owns invalid scale', () => {
    expect(clampWorldScale(Number.NaN)).toBe(ARENA_DEFAULT_WORLD_SCALE);
    expect(clampWorldScale(Number.POSITIVE_INFINITY)).toBe(ARENA_DEFAULT_WORLD_SCALE);
    expect(clampWorldScale('1')).toBe(ARENA_DEFAULT_WORLD_SCALE);
    expect(clampWorldScale(undefined)).toBe(ARENA_DEFAULT_WORLD_SCALE);
    expect(clampWorldScale(99)).toBe(2);
    expect(clampWorldScale(-3)).toBe(0.25);
    const invalid = frameFor(Number.NaN);
    expect(invalid.renderable).toBe(true);
    if (invalid.renderable) expect(invalid.worldScale).toBe(ARENA_DEFAULT_WORLD_SCALE);
    for (const viewportCss of [{ width: 0, height: 1080 }, { width: 1920, height: 0 },
      { width: Number.NaN, height: 1080 }, { width: -5, height: 1080 }]) {
      const hidden = createFieldViewFrame({
        sceneKey: 'test:hidden', atUs: 1, viewportCss, focusM: fieldPointM(25, 16), worldScale: 1,
      });
      expect(hidden.renderable).toBe(false);
      expect('worldToViewport' in hidden).toBe(false);
      expect('viewportToWorld' in hidden).toBe(false);
      expect('worldToClient' in hidden).toBe(false);
      expect('clientToWorld' in hidden).toBe(false);
    }
    const unfocused = createFieldViewFrame({
      sceneKey: 'test:hidden', atUs: 1, viewportCss: { width: 1920, height: 1080 },
      focusM: fieldPointM(Number.NaN, 16), worldScale: 1,
    });
    expect(unfocused.renderable).toBe(false);
    // Overflow viewports hide instead of leaking Infinity/NaN matrices.
    const overflow = createFieldViewFrame({
      sceneKey: 'test:hidden', atUs: 1, viewportCss: { width: 1e308, height: 1080 },
      focusM: fieldPointM(25, 16), worldScale: 2,
    });
    expect(overflow.renderable).toBe(false);
    expect('worldToViewport' in overflow).toBe(false);
  });
});
