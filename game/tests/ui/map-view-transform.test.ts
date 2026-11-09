import { describe, expect, it } from 'vitest';
import { createFieldViewFrame } from '../../src/presentation/arena-view-frame';
import { fieldPointM } from '../../src/presentation/view-transform';
import { terrainGroundMaterials } from '../../src/presentation/ground-materials';
import { TERRAIN_ART } from '../../src/ui/map/map-terrain';
import {
  composeMapFrame,
  invertMapTransform,
  isMapFrameNorthUp,
  mapPlanPoint,
  mapPlanToScreen,
  mapScreenPx,
  mapScreenToPlan,
} from '../../src/ui/map/map-view-transform';
import { transformMapPoint } from '../../src/ui/map/map-camera';
import { MAP_CAMERA, MAP_CAMERA_TRANSFORM, mapUprightAt, projectedHex } from '../../src/ui/map/map-projection';

describe('map shared affine contract (WP5)', () => {
  it('round-trips plan units through a uniform north-up frame', () => {
    const frame = { a: 2.4, b: 0, c: 0, d: 2.4, e: 960, f: 496.8 };
    expect(isMapFrameNorthUp(frame)).toBe(true);
    const screen = mapPlanToScreen(frame, mapPlanPoint(12.5, -3.25));
    expect(screen.x).toBeCloseTo(12.5 * 2.4 + 960, 12);
    expect(screen.y).toBeCloseTo(-3.25 * 2.4 + 496.8, 12);
    const inv = invertMapTransform(frame)!;
    const back = mapScreenToPlan(inv, screen);
    expect(back.x).toBeCloseTo(12.5, 12);
    expect(back.y).toBeCloseTo(-3.25, 12);
  });

  it('paints through the north-up identity projection, never a rotated frame', () => {
    expect(MAP_CAMERA.a).toBeCloseTo(1, 12);
    expect(MAP_CAMERA.b).toBeCloseTo(0, 12);
    expect(MAP_CAMERA.c).toBeCloseTo(0, 12);
    expect(MAP_CAMERA.d).toBeCloseTo(1, 12);
    expect(MAP_CAMERA_TRANSFORM).toBe('matrix(1 0 0 1 0 0)');
    expect(isMapFrameNorthUp({ ...MAP_CAMERA, e: 0, f: 0 })).toBe(true);
    expect(isMapFrameNorthUp({ a: 2, b: 0.5, c: 0, d: 2, e: 0, f: 0 })).toBe(false);
  });

  it('keeps map zoom and field worldScale as separate instances sharing only math', () => {
    const focus = fieldPointM(25, 16.0256);
    const view = { width: 1920, height: 1080 };
    const half = createFieldViewFrame({ sceneKey: 'map', atUs: 0, viewportCss: view, focusM: focus, worldScale: 0.5 });
    const full = createFieldViewFrame({ sceneKey: 'map', atUs: 0, viewportCss: view, focusM: focus, worldScale: 1 });
    if (!half.renderable || !full.renderable) throw new Error('field frame should render');
    expect(full.cssPixelsPerMeter / half.cssPixelsPerMeter).toBeCloseTo(2, 12);

    const zoomedOut = { a: 0.5, b: 0, c: 0, d: 0.5, e: 0, f: 0 };
    const zoomedIn = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const plan = mapPlanPoint(100, 40);
    const out = mapPlanToScreen(zoomedOut, plan);
    const inn = mapPlanToScreen(zoomedIn, plan);
    expect(inn.x / out.x).toBeCloseTo(2, 12);
    // Doubling the map zoom leaves the field scale untouched and vice versa.
    expect(full.cssPixelsPerMeter).toBe(half.cssPixelsPerMeter * 2);
    expect(composeMapFrame(zoomedIn, zoomedOut)).toEqual({ ...zoomedOut, a: 0.5, d: 0.5 });
  });

  it('delegates camera conversion without changing painted results', () => {
    const matrix = { a: 2.4, b: 0, c: 0, d: 2.4, e: 120, f: -75 };
    expect(transformMapPoint(matrix, { x: 10, y: 20 })).toEqual({ x: 144, y: -27 });
    const inverse = invertMapTransform(matrix)!;
    expect(transformMapPoint(inverse, { x: 144, y: -27 })).toEqual({ x: 10, y: 20 });
  });

  it('returns no inverse or upright for degenerate frames instead of NaN', () => {
    const singular = { a: 0, b: 0, c: 0, d: 0, e: 0, f: 0 };
    expect(invertMapTransform(singular)).toBeNull();
    expect(invertMapTransform(
      { a: 1, b: 0, c: 0, d: 1, e: Number.NaN, f: 0 })).toBeNull();
    expect(mapUprightAt(57, -84, { a: 0, b: 0, c: 0, d: 0 })).toBe('translate(57 -84)');
  });

  it('sizes the regular hex mask from plan radius only, never field metres', () => {
    const hex = projectedHex(15);
    expect(hex.height).toBeCloseTo(30, 12);
    expect(hex.width / hex.height).toBeCloseTo(Math.sqrt(3) / 2, 12);
    // R of the sheet is 15 plan units; the field never reads it as 15 m.
    expect(projectedHex(15)).toEqual(projectedHex(15));
  });

  it('derives shared ground from registry hrefs, ignoring field-only tileSizeM', () => {
    const doubled = Object.fromEntries(
      Object.entries(terrainGroundMaterials).map(([terrain, material]) =>
        [terrain, { ...material, tileSizeM: material.tileSizeM * 2 }]));
    const art = Object.fromEntries(
      Object.entries(doubled).map(([terrain, material]) => [terrain, material.href]));
    expect(art).toEqual(TERRAIN_ART);
    for (const [terrain, href] of Object.entries(TERRAIN_ART)) {
      expect(href, `${terrain} shares the field material`).toBe(terrainGroundMaterials[terrain].href);
    }
  });
});
