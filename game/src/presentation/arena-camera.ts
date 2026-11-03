/** Pure arena camera math shared by captured presentation checkpoints and their consumers. */
export const ARENA_VIEW = { width: 1920, height: 1080 };
export const ARENA_ACTOR_WIDTH_M = .5;
// Agreed oblique basis from art-reference/skill-vfx and art-reference/animation.
// Preserve the full matrix: elevation alone cannot express its skew and tilted foot ellipse.
const ART_BASIS = { xx: 42, xy: 10, yx: -8, yy: 30 };
const ART_SCALE = 70 / (ARENA_ACTOR_WIDTH_M * Math.hypot(ART_BASIS.xx, ART_BASIS.yx));
export const ARENA_CAMERA = {
  projection: { a: ART_BASIS.xx * ART_SCALE, b: ART_BASIS.yx * ART_SCALE,
    c: ART_BASIS.xy * ART_SCALE, d: ART_BASIS.yy * ART_SCALE },
  playerAnchor: { x: .5, y: .5 },
} as const;
const CX = 1040, CY = 530;
// Field centre for the 50 x 32.0513 m arena (engine.json combat_arena).
const WORLD_CX = 25, WORLD_CY = 16.0256;
const { a: U, c: V, b: W, d: Z } = ARENA_CAMERA.projection;
export const ARENA_FACING_HYSTERESIS = .14;
export const ARENA_DIRECTIONS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'] as const;

export function projectArenaPoint(point: { x: number; y: number }) {
  return { x: CX + (point.x - WORLD_CX) * U + (point.y - WORLD_CY) * V,
    y: CY + (point.y - WORLD_CY) * Z + (point.x - WORLD_CX) * W };
}
export function projectArenaVector(vector: { x: number; y: number }) {
  return { x: vector.x * U + vector.y * V, y: vector.y * Z + vector.x * W };
}
export function arenaScreenAngleFor(vector: { x: number; y: number }) {
  const projected = projectArenaVector(vector);
  return Math.atan2(projected.y, projected.x);
}
export function arenaScreenAngle(from: { x: number; y: number }, to: { x: number; y: number }) {
  return arenaScreenAngleFor({ x: to.x - from.x, y: to.y - from.y }) * 180 / Math.PI;
}
/** Follow the player at the combat framing anchor, including at field edges. */
export function arenaCameraOffset(player: { x: number; y: number }, view = ARENA_VIEW) {
  const point = projectArenaPoint(player);
  return { x: point.x - view.width * ARENA_CAMERA.playerAnchor.x,
    y: point.y - view.height * ARENA_CAMERA.playerAnchor.y };
}

/** Combat zoom stops: 1 shows the authored frame, 0.5 sees twice as far. Presentation only. */
export const ARENA_ZOOM_MIN = 0.5, ARENA_ZOOM_MAX = 1, ARENA_ZOOM_STEP = 0.25;

/** Visible world size at a zoom level; the simulation never reads this value. */
export interface ArenaViewSize { width: number; height: number }
export function arenaZoomView(zoom = 1): ArenaViewSize {
  const clamped = Math.max(ARENA_ZOOM_MIN, Math.min(ARENA_ZOOM_MAX, zoom));
  return { width: ARENA_VIEW.width / clamped, height: ARENA_VIEW.height / clamped };
}

/** Viewport-cull margins: tall sprites, labels, corpses and effects at the edge stay drawable. */
export const ARENA_CULL_MARGIN_X = 220, ARENA_CULL_MARGIN_Y = 320;

/** Cheap pre-filter before the full actor view; pinned bodies always stay. Pure, so tests own it. */
export function arenaActorVisible(viewX: number, viewY: number, camX: number, camY: number,
  stageWidth: number, stageHeight: number, pinned = false,
  marginX = ARENA_CULL_MARGIN_X, marginY = ARENA_CULL_MARGIN_Y): boolean {
  if (pinned) return true;
  return viewX - camX > -marginX && viewX - camX < stageWidth + marginX
    && viewY - camY > -marginY && viewY - camY < stageHeight + marginY;
}

/** Fixed world-space ground coverage, including the viewport at every reachable field edge. */
export function arenaGroundBounds(bounds: { width: number; height: number }) {
  const cameras = [
    { x: 0, y: 0 }, { x: bounds.width, y: 0 },
    { x: 0, y: bounds.height }, { x: bounds.width, y: bounds.height },
  ].map(point => arenaCameraOffset(point));
  const left = Math.min(...cameras.map(point => point.x));
  const top = Math.min(...cameras.map(point => point.y));
  return {
    left, top,
    width: Math.max(...cameras.map(point => point.x)) - left + ARENA_VIEW.width,
    height: Math.max(...cameras.map(point => point.y)) - top + ARENA_VIEW.height,
  };
}
export function arenaActorPixelScale(idleWidth: number, viewportScale: number) {
  // Horizontal extent of the projected circular footprint, not one projected world axis.
  const width = ARENA_ACTOR_WIDTH_M * Math.hypot(U, V);
  return width / Math.max(1, idleWidth) * viewportScale;
}
export function unprojectArenaPoint(point: { x: number; y: number }) {
  const vector = unprojectArenaVector({ x: point.x - CX, y: point.y - CY });
  return { x: vector.x + WORLD_CX, y: vector.y + WORLD_CY };
}
export function unprojectArenaVector(vector: { x: number; y: number }) {
  const a = vector.x, b = vector.y, det = U * Z - V * W;
  return { x: (Z * a - V * b) / det, y: (U * b - W * a) / det };
}
/** Screen-relative input with unit ground length, so camera pitch cannot change walking speed. */
export function arenaWorldDirection(screen: { x: number; y: number }) {
  const vector = unprojectArenaVector(screen), length = Math.hypot(vector.x, vector.y);
  return length > 0 ? { x: vector.x / length, y: vector.y / length } : { x: 0, y: 0 };
}

/** Ingest at authoritative samples; captured actors retain this latch across history trimming. */
export function arenaFacingIndex(facing: number, current?: number, hysteresis = ARENA_FACING_HYSTERESIS) {
  const angle = arenaScreenAngleFor({ x: Math.cos(facing), y: Math.sin(facing) });
  const step = Math.PI / 4;
  if (current != null && current >= 0 && current < 8) {
    const delta = Math.atan2(Math.sin(angle - current * step), Math.cos(angle - current * step));
    if (Math.abs(delta) <= step / 2 + Math.max(0, hysteresis)) return current;
  }
  return (Math.round(angle / step) + 8) % 8;
}
