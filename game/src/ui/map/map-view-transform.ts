/**
 * Map adapter over the shared affine contract (WP5).
 *
 * Map-plan units are SVG user units of the generated sheet; they are never
 * field metres and never CSS pixels per metre. Map zoom and the field
 * worldScale are separate instances sharing only the affine math owned by
 * `presentation/view-transform.ts` — every conversion formula below
 * delegates there, this module only brands the map boundary.
 * Pure math only: no Svelte, DOM or sim imports, so Node tools can use it.
 */
import {
  applyViewportToWorld,
  applyWorldToViewport,
  composeAffine,
  invertAffine,
  isUniformScale,
  type Affine2,
  type FieldPointM,
  type ViewportPointPx,
} from '../../presentation/view-transform.ts';

declare const mapPlanBrand: unique symbol;
declare const mapScreenBrand: unique symbol;

/** A point in map-plan units (sheet user units). Never field metres. */
export interface MapPlanPoint {
  readonly x: number;
  readonly y: number;
  readonly __mapPlan: typeof mapPlanBrand;
}

/** A point in map screen CSS pixels after pan/zoom. Never field viewport px. */
export interface MapScreenPx {
  readonly x: number;
  readonly y: number;
  readonly __mapScreen: typeof mapScreenBrand;
}

export const mapPlanPoint = (x: number, y: number): MapPlanPoint =>
  ({ x, y }) as MapPlanPoint;
export const mapScreenPx = (x: number, y: number): MapScreenPx =>
  ({ x, y }) as MapScreenPx;

/** Plan -> plan through the sheet projection (no pan/zoom; e/f stay zero). */
export function mapPlanTransform(m: Affine2, p: MapPlanPoint): MapPlanPoint {
  const out = applyWorldToViewport(m, p as unknown as FieldPointM);
  return mapPlanPoint(out.x, out.y);
}

/** Plan -> screen through a uniform north-up frame (zoom + pan only). */
export function mapPlanToScreen(m: Affine2, p: MapPlanPoint): MapScreenPx {
  const out = applyWorldToViewport(m, p as unknown as FieldPointM);
  return mapScreenPx(out.x, out.y);
}

/** Screen -> plan through the inverse of the painted frame. */
export function mapScreenToPlan(inv: Affine2, p: MapScreenPx): MapPlanPoint {
  const out = applyViewportToWorld(inv, p as unknown as ViewportPointPx);
  return mapPlanPoint(out.x, out.y);
}

/** Frame composition; the single formula owner is the shared module. */
export function composeMapFrame(outer: Affine2, inner: Affine2): Affine2 {
  return composeAffine(outer, inner);
}

/** Null for singular or non-finite frames: no NaN enters the sheet. */
export function invertMapTransform(m: Affine2): Affine2 | null {
  return invertAffine(m);
}

/** Painted map frames are uniform north-up: a === d > 0 with no shear. */
export function isMapFrameNorthUp(m: Affine2): boolean {
  return isUniformScale(m);
}
