import { describe, expect, it } from 'vitest';
import { clampWorldScale, createFieldViewFrame, followFieldViewFrame } from '../../src/presentation/arena-view-frame';
import {
  applyClientToWorld,
  applyViewportToWorld,
  applyWorldToClient,
  applyWorldVector,
  applyWorldToViewport,
  fieldPointM,
  fieldVectorM,
  isUniformScale,
} from '../../src/presentation/view-transform';
import { ARENA_CAMERA, ARENA_DEFAULT_WORLD_SCALE } from '../../src/presentation/arena-camera';

const focus = fieldPointM(25, 16);

function frame(scale: unknown, width = 1920, height = 1080) {
  return createFieldViewFrame({
    sceneKey: 'field:test',
    atUs: 1000,
    viewportCss: { width, height },
    focusM: focus,
    worldScale: scale,
  });
}

describe('arena-view-frame A1-A3', () => {
  it('follows sampled feet continuously even when the host focus advances in ticks', () => {
    for (const worldScale of [.5, .75, 1, 2]) {
      let previousX: number | undefined;
      for (let step = 0; step <= 16; step++) {
        const host = createFieldViewFrame({
          sceneKey: 'moving', atUs: 2_000_000, viewportCss: { width: 1280, height: 720 },
          focusM: fieldPointM(step < 8 ? 25 : 27, 16), worldScale,
          viewportToClient: { a: 1.5, b: 0, c: 0, d: 1.5, e: 80, f: 120 },
        });
        const feet = fieldPointM(25 + step / 8, 16);
        const painted = followFieldViewFrame(host, step * 125_000, feet);
        expect(painted.renderable).toBe(true);
        if (!painted.renderable) continue;
        const screen = applyWorldToViewport(painted.worldToViewport, feet);
        expect(screen.x).toBeCloseTo(painted.anchorCss.x, 8);
        expect(screen.y).toBeCloseTo(painted.anchorCss.y, 8);
        const client = applyWorldToClient(painted.worldToClient, feet);
        const picked = applyClientToWorld(painted.clientToWorld, client);
        expect(picked.x).toBeCloseTo(feet.x, 8);
        expect(picked.y).toBeCloseTo(feet.y, 8);
        const landmark = applyWorldToViewport(painted.worldToViewport, fieldPointM(30, 16));
        if (previousX != null) expect(previousX - landmark.x).toBeCloseTo(painted.cssPixelsPerMeter / 8, 8);
        previousX = landmark.x;
        expect(painted.atUs).toBe(step * 125_000);
        expect(painted.sceneKey).toBe('moving');
      }
    }
  });

  it('keeps a hidden host hidden while sampling the follow camera', () => {
    expect(followFieldViewFrame({ renderable: false, sceneKey: 'hidden', atUs: 0 }, 100, focus))
      .toEqual({ renderable: false, sceneKey: 'hidden', atUs: 100 });
  });

  it('validates scale at one boundary: fallback and clamp', () => {
    expect(clampWorldScale(Number.NaN)).toBe(ARENA_DEFAULT_WORLD_SCALE);
    expect(clampWorldScale(Number.POSITIVE_INFINITY)).toBe(ARENA_DEFAULT_WORLD_SCALE);
    expect(clampWorldScale('1')).toBe(ARENA_DEFAULT_WORLD_SCALE);
    expect(clampWorldScale(undefined)).toBe(ARENA_DEFAULT_WORLD_SCALE);
    expect(clampWorldScale(0)).toBe(0.25);
    expect(clampWorldScale(99)).toBe(2);
    expect(clampWorldScale(0.75)).toBe(0.75);
  });

  it('round-trips world<->viewport through the oblique camera at every allowed scale', () => {
    for (const scale of [0.5, 0.75, 1, 1.5, 2]) {
      const f = frame(scale);
      expect(f.renderable).toBe(true);
      if (!f.renderable) continue;
      expect(f.cssPixelsPerMeter).toBeCloseTo(140 * scale, 10);
      expect(f.worldToViewport.a).toBeGreaterThan(0);
      expect(f.worldToViewport.d / f.worldToViewport.a).toBeCloseTo(ARENA_CAMERA.projection.d / ARENA_CAMERA.projection.a, 8);
      expect(f.worldToViewport.b).toBe(0);
      expect(f.worldToViewport.c).toBe(0);
      expect(isUniformScale(f.worldToViewport)).toBe(false);
      const p = fieldPointM(30.5, 10.25);
      const roundTrip = applyViewportToWorld(f.viewportToWorld, applyWorldToViewport(f.worldToViewport, p));
      expect(roundTrip.x).toBeCloseTo(p.x, 8);
      expect(roundTrip.y).toBeCloseTo(p.y, 8);
      // Focus lands on the anchor; ground axes retain the camera's foreshortening.
      expect(applyWorldToViewport(f.worldToViewport, focus).x).toBeCloseTo(f.anchorCss.x, 8);
      expect(applyWorldToViewport(f.worldToViewport, focus).y).toBeCloseTo(f.anchorCss.y, 8);
      const east = applyWorldVector(f.worldToViewport, fieldVectorM(1, 0));
      const south = applyWorldVector(f.worldToViewport, fieldVectorM(0, 1));
      expect(Math.hypot(south.x, south.y) / Math.hypot(east.x, east.y))
        .toBeCloseTo(ARENA_CAMERA.projection.d / ARENA_CAMERA.projection.a, 8);
      // 0.5 m actor vs 3 m radius keeps ratio 6 at every scale.
      const actor = applyWorldVector(f.worldToViewport, fieldVectorM(0.5, 0));
      const area = applyWorldVector(f.worldToViewport, fieldVectorM(3, 0));
      expect(Math.hypot(actor.x, actor.y) / Math.hypot(area.x, area.y)).toBeCloseTo(1 / 6, 8);
    }
  });

  it('is hidden for zero/non-finite viewport without exposing matrices', () => {
    for (const vp of [{ width: 0, height: 1080 }, { width: 1920, height: 0 }, { width: Number.NaN, height: 1080 }]) {
      const f = createFieldViewFrame({
        sceneKey: 'field:zero', atUs: 1,
        viewportCss: vp, focusM: focus, worldScale: 1,
      });
      expect(f.renderable).toBe(false);
      expect('worldToViewport' in f).toBe(false);
      expect('clientToWorld' in f).toBe(false);
    }
  });

  it('defaults invalid scale to the authored world scale instead of NaN', () => {
    const f = frame(Number.NaN);
    expect(f.renderable).toBe(true);
    if (f.renderable) expect(f.cssPixelsPerMeter).toBeCloseTo(140 * ARENA_DEFAULT_WORLD_SCALE, 10);
  });

  it('hides the frame when the container transform has no usable inverse', () => {
    const singular = { a: 0, b: 0, c: 0, d: 0, e: 5, f: 5 };
    const nonFinite = { a: 1, b: 0, c: 0, d: 1, e: Number.NaN, f: 0 };
    for (const viewportToClient of [singular, nonFinite]) {
      const f = createFieldViewFrame({
        sceneKey: 'field:container', atUs: 1,
        viewportCss: { width: 1920, height: 1080 }, focusM: focus, worldScale: 1,
        viewportToClient,
      });
      expect(f.renderable).toBe(false);
      expect('clientToWorld' in f).toBe(false);
    }
    const explicitBad = createFieldViewFrame({
      sceneKey: 'field:container', atUs: 1,
      viewportCss: { width: 1920, height: 1080 }, focusM: focus, worldScale: 1,
      viewportToClient: { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 },
      clientToViewport: { a: 0.5, b: 0, c: 0, d: 0.5, e: Number.POSITIVE_INFINITY, f: 0 },
    });
    expect(explicitBad.renderable).toBe(false);
  });

  it('round-trips world->viewport->client->world through an explicit container transform', () => {
    const viewportToClient = { a: 2, b: 0, c: 0, d: 2, e: 100, f: 50 };
    const f = createFieldViewFrame({
      sceneKey: 'field:container', atUs: 1,
      viewportCss: { width: 1920, height: 1080 }, focusM: focus, worldScale: 1,
      viewportToClient,
    });
    expect(f.renderable).toBe(true);
    if (!f.renderable) return;
    const p = fieldPointM(30.5, 10.25);
    const client = applyWorldToClient(f.worldToClient, p);
    const back = applyClientToWorld(f.clientToWorld, client);
    expect(back.x).toBeCloseTo(p.x, 8);
    expect(back.y).toBeCloseTo(p.y, 8);
    // The explicit inverse wins over the derived one when both are valid.
    const custom = createFieldViewFrame({
      sceneKey: 'field:container', atUs: 1,
      viewportCss: { width: 1920, height: 1080 }, focusM: focus, worldScale: 1,
      viewportToClient: { a: 0, b: 0, c: 0, d: 0, e: 7, f: 9 },
      clientToViewport: { a: 1, b: 0, c: 0, d: 1, e: -7, f: -9 },
    });
    expect(custom.renderable).toBe(true);
  });
});
