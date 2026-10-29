/** Pure arena camera math shared by captured presentation checkpoints and their consumers. */
export const ARENA_VIEW = { width: 1920, height: 1080 };
export const ARENA_ACTOR_WIDTH_M = .5;
const CX = 1040, CY = 530;
// Field centre for the 50 x 32.0513 m arena (engine.json combat_arena).
const WORLD_CX = 25, WORLD_CY = 16.0256;
const U = 42, V = 10, W = -8, Z = 30;
const SCALE = 70 / (ARENA_ACTOR_WIDTH_M * Math.hypot(U, W));
export const ARENA_FACING_HYSTERESIS = .14;
export const ARENA_DIRECTIONS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'] as const;

export function projectArenaPoint(point: { x: number; y: number }) {
  return { x: CX + ((point.x - WORLD_CX) * U + (point.y - WORLD_CY) * V) * SCALE,
    y: CY + ((point.y - WORLD_CY) * Z + (point.x - WORLD_CX) * W) * SCALE };
}
export function projectArenaVector(vector: { x: number; y: number }) {
  return { x: (vector.x * U + vector.y * V) * SCALE, y: (vector.y * Z + vector.x * W) * SCALE };
}
export function arenaScreenAngleFor(vector: { x: number; y: number }) {
  const projected = projectArenaVector(vector);
  return Math.atan2(projected.y, projected.x);
}
export function arenaScreenAngle(from: { x: number; y: number }, to: { x: number; y: number }) {
  return arenaScreenAngleFor({ x: to.x - from.x, y: to.y - from.y }) * 180 / Math.PI;
}
// Accept the old target argument for existing callers; a target change never moves the camera.
// `focus` is the screen point the player should land on: the stage centre by default, or the
// centre of the HUD's actual free area, so a threat is never framed under a panel.
export function arenaCameraOffset(player: { x: number; y: number }, _target?: { x: number; y: number },
  focus: { x: number; y: number } = { x: CX, y: CY }) {
  const point = projectArenaPoint(player);
  return { x: point.x - focus.x, y: point.y - focus.y };
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
/**
 * The screen point the camera keeps the player on. Inside the dead zone the frame stays still;
 * past it the camera moves only by the excess, so a step never yanks the whole world. This is a
 * presentation focus, not a world position: hit tests and ranges keep reading `projectArenaPoint`.
 */
export function arenaCameraFocus(player: { x: number; y: number }, safeCentre: { x: number; y: number },
  deadZonePx = 90) {
  const point = projectArenaPoint(player);
  const dead = Math.max(0, deadZonePx);
  const axis = (value: number, centre: number) => {
    const delta = value - centre;
    return Math.abs(delta) <= dead ? centre : value - Math.sign(delta) * dead;
  };
  return { x: axis(point.x, safeCentre.x), y: axis(point.y, safeCentre.y) };
}

/**
 * Camera priority: keep the player in the safe box, then pull the committed target into the same
 * box when it is only a little outside. If the two cannot both fit, the player wins; the HUD's
 * target bar carries the bearing. The target's screen point is `focus + (target - player)` because
 * the focus is, by definition, where the player is drawn.
 */
export function arenaCameraFocusWithTarget(
  player: { x: number; y: number },
  target: { x: number; y: number } | undefined,
  safeCentre: { x: number; y: number },
  safeRect: { left: number; top: number; right: number; bottom: number },
  deadZonePx = 90,
  marginPx = 56,
) {
  let focus = arenaCameraFocus(player, safeCentre, deadZonePx);
  if (!target) return focus;
  const p = projectArenaPoint(player);
  const t = projectArenaPoint(target);
  const left = safeRect.left + marginPx;
  const right = safeRect.right - marginPx;
  const top = safeRect.top + marginPx;
  const bottom = safeRect.bottom - marginPx;
  const targetScreen = { x: focus.x + (t.x - p.x), y: focus.y + (t.y - p.y) };
  if (targetScreen.x < left) focus.x += left - targetScreen.x;
  else if (targetScreen.x > right) focus.x -= targetScreen.x - right;
  if (targetScreen.y < top) focus.y += top - targetScreen.y;
  else if (targetScreen.y > bottom) focus.y -= targetScreen.y - bottom;
  // The player is drawn at the focus; never trade the player out of the safe box for a target.
  focus = {
    x: Math.max(left, Math.min(right, focus.x)),
    y: Math.max(top, Math.min(bottom, focus.y)),
  };
  return focus;
}

export function arenaActorPixelScale(idleWidth: number, viewportScale: number) {
  // Horizontal extent of the projected circular footprint, not one projected world axis.
  const width = ARENA_ACTOR_WIDTH_M * SCALE * Math.hypot(U, V);
  return width / Math.max(1, idleWidth) * viewportScale;
}
export function unprojectArenaPoint(point: { x: number; y: number }) {
  const a = (point.x - CX) / SCALE, b = (point.y - CY) / SCALE, det = U * Z - V * W;
  return { x: (Z * a - V * b) / det + WORLD_CX, y: (U * b - W * a) / det + WORLD_CY };
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
