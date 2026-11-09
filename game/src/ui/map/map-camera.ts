import type { Affine2 } from '../../presentation/view-transform.ts';
import {
  composeMapFrame,
  mapPlanPoint,
  mapPlanToScreen,
} from './map-view-transform.ts';

export type MapPoint = { x: number; y: number };
export type MapMatrix = Affine2;

/** Map anchor policy: one owner for both map-camera and WorldMap framing. */
export const MAP_ANCHOR_X = 0.5;
export const MAP_ANCHOR_Y = 0.46;

/** Plan -> screen; the arithmetic is owned by the shared affine contract. */
export function transformMapPoint(matrix: MapMatrix, point: MapPoint): MapPoint {
  const out = mapPlanToScreen(matrix, mapPlanPoint(point.x, point.y));
  return { x: out.x, y: out.y };
}

/** Frame composition; the arithmetic is owned by the shared affine contract. */
export function composeMapMatrix(outer: MapMatrix, inner: MapMatrix): MapMatrix {
  return composeMapFrame(outer, inner);
}

/**
 * Clamp a two-axis pan so the ground keeps covering the frame. When the paper is smaller than the
 * frame, centre it instead of pinning an edge: the sea beyond the field has to stay reachable, and a
 * world overview cannot be pushed into a corner.
 */
export function clampMapPan(pan: MapPoint, frame: { width: number; height: number },
  paper: { x: number; y: number; width: number; height: number }, projection: MapMatrix,
  zoom: number): MapPoint {
  const origin = { x: frame.width * MAP_ANCHOR_X, y: frame.height * MAP_ANCHOR_Y };
  const screen = (x: number, y: number): MapPoint => {
    const world = transformMapPoint(projection, { x, y });
    return { x: origin.x + pan.x + zoom * (world.x - origin.x), y: origin.y + pan.y + zoom * (world.y - origin.y) };
  };
  const corners = [
    screen(paper.x, paper.y), screen(paper.x + paper.width, paper.y),
    screen(paper.x, paper.y + paper.height), screen(paper.x + paper.width, paper.y + paper.height),
  ];
  const minX = Math.min(...corners.map((p) => p.x)), maxX = Math.max(...corners.map((p) => p.x));
  const minY = Math.min(...corners.map((p) => p.y)), maxY = Math.max(...corners.map((p) => p.y));
  let x = pan.x, y = pan.y;
  if (maxX - minX >= frame.width) {
    if (minX > 0) x -= minX;
    else if (maxX < frame.width) x += frame.width - maxX;
  } else x += (frame.width - (minX + maxX)) / 2;
  if (maxY - minY >= frame.height) {
    if (minY > 0) y -= minY;
    else if (maxY < frame.height) y += frame.height - maxY;
  } else y += (frame.height - (minY + maxY)) / 2;
  return { x, y };
}

/** WorldMap's camera lifetime: App owns the object, the facade only reads/writes these fields. */
export type MapCameraState = { panX: number; panY: number; zoom: number };
export const MAP_BASE_ZOOM = 2;
export const DEFAULT_MAP_CAMERA: MapCameraState = { panX: 0, panY: 0, zoom: 2.4 };
export const MAP_MIN_ZOOM = 0.5;
export const MAP_MAX_ZOOM = 6;
export const MAP_OPEN_ZOOM = 2.4;
export const mapDetail = (zoom: number): 'far' | 'mid' | 'near' =>
  zoom < 1.5 ? 'far' : zoom >= 2.4 ? 'near' : 'mid';

/** D2 legibility floors: unresolved CSS tokens owned by variables.css. */
export const MAP_MIN_ICON_CSS = 14;
export const MAP_MIN_TEXT_CSS = 12;

/**
 * Minimum zoom so the smallest plan-unit extent stays legible at zoom 1.
 * i1/t1 are plan-unit extents projected at zoom 1; hidden/invalid hosts
 * never reach this helper (caller must widen/finite-check first).
 */
export function mapMinReadableZoom(extent: { icon: number; text: number }, showText: boolean): number {
  const iconTerm = Number.isFinite(extent.icon) && extent.icon > 0 ? MAP_MIN_ICON_CSS / extent.icon : Number.POSITIVE_INFINITY;
  const textTerm = showText && Number.isFinite(extent.text) && extent.text > 0 ? MAP_MIN_TEXT_CSS / extent.text : 0;
  const zMin = Math.max(iconTerm, textTerm);
  if (!Number.isFinite(zMin) || zMin <= 0) return MAP_MIN_ZOOM;
  return Math.min(MAP_MAX_ZOOM, Math.max(MAP_MIN_ZOOM, zMin));
}
