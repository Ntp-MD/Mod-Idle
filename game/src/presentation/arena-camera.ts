/** Pure arena camera math shared by captured presentation checkpoints and their consumers. */
export const ARENA_VIEW = { width: 1920, height: 1080 };
export const ARENA_ACTOR_WIDTH_M = .5;
// North stays up; elevation is measured above the horizontal ground plane.
// Single topdown source: change this projection and every skill circle follows
// through the painted frame (worldToViewport), never a second hardcoded angle.
export const ARENA_CAMERA_ELEVATION_DEG = 33;
const PIXELS_PER_METER = 70 / ARENA_ACTOR_WIDTH_M;
/** Reference density: the one divisor for legacy ref-px minima (was literal 140). */
export const ARENA_REF_PX_PER_M = PIXELS_PER_METER;
export const ARENA_CAMERA = {
  projection: { a: PIXELS_PER_METER, b: 0, c: 0,
    d: PIXELS_PER_METER * Math.sin(ARENA_CAMERA_ELEVATION_DEG * Math.PI / 180) },
  playerAnchor: { x: .5, y: .5 },
} as const;
/** Normalized topdown basis (projection / reference): the frame scales this by cssPixelsPerMeter. */
export const arenaTopdownBasis = (): { a: number; b: number; c: number; d: number } => {
  const { a, b, c, d } = ARENA_CAMERA.projection;
  return { a: a / ARENA_REF_PX_PER_M, b: b / ARENA_REF_PX_PER_M,
    c: c / ARENA_REF_PX_PER_M, d: d / ARENA_REF_PX_PER_M };
};
/** Field footprint mirrors engine.json combat_arena; presentation never imports engine here. */
export const ARENA_FIELD = { width: 50, height: 32.0513 } as const;
/** Default body footprint; mirrors sim MobSize radius_m 0.25 (engine/index.ts). */
export const ARENA_DEFAULT_BODY_RADIUS_M = 0.25;
/** Camera glide time constant for the displayed-scale easing. */
export const ARENA_GLIDE_MS = 140;
const CX = ARENA_VIEW.width * ARENA_CAMERA.playerAnchor.x + 80, CY = ARENA_VIEW.height * ARENA_CAMERA.playerAnchor.y - 10;
// Field centre from the single field source above.
const WORLD_CX = ARENA_FIELD.width / 2, WORLD_CY = ARENA_FIELD.height / 2;
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

/** One world-scale multiplier for actors, ground, distances and VFX. Presentation only. */
export const ARENA_DEFAULT_WORLD_SCALE = 0.5;
// 0.25 fits almost the whole 50 x 32 m field; 2 is the authored-frame zoom-in stop.
export const ARENA_ZOOM_MIN = 0.25, ARENA_ZOOM_MAX = 2, ARENA_ZOOM_STEP = 0.25;

/** Visible world size at a zoom level; the simulation never reads this value. */
export interface ArenaViewSize { width: number; height: number }
export function arenaZoomView(zoom = 1, viewport: ArenaViewSize = ARENA_VIEW): ArenaViewSize {
  const clamped = Math.max(ARENA_ZOOM_MIN, Math.min(ARENA_ZOOM_MAX, zoom));
  const aspect = viewport.width > 0 && viewport.height > 0
    ? viewport.width / viewport.height : ARENA_VIEW.width / ARENA_VIEW.height;
  const width = ARENA_VIEW.width / clamped;
  return { width, height: width / aspect };
}

/** Viewport-cull margins in world metres; px values derive below so zoom follows cssPerM. */
export const ARENA_CULL_MARGIN_M = { x: 220 / ARENA_REF_PX_PER_M, y: 320 / ARENA_REF_PX_PER_M };
/** Viewport-cull margins in ref px (legacy contract kept for tests/callers). */
export const ARENA_CULL_MARGIN_X = ARENA_CULL_MARGIN_M.x * ARENA_REF_PX_PER_M,
  ARENA_CULL_MARGIN_Y = ARENA_CULL_MARGIN_M.y * ARENA_REF_PX_PER_M;

/** Cheap pre-filter before the full actor view; pinned bodies always stay. Pure, so tests own it. */
export function arenaActorVisible(viewX: number, viewY: number, camX: number, camY: number,
  stageWidth: number, stageHeight: number, pinned = false,
  marginX = ARENA_CULL_MARGIN_X, marginY = ARENA_CULL_MARGIN_Y): boolean {
  if (pinned) return true;
  return viewX - camX > -marginX && viewX - camX < stageWidth + marginX
    && viewY - camY > -marginY && viewY - camY < stageHeight + marginY;
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
