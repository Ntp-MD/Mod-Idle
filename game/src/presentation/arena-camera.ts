/** Pure arena camera math shared by captured presentation checkpoints and their consumers. */
export const ARENA_VIEW = { width: 1920, height: 1080 };
export const ARENA_ACTOR_WIDTH_M = .5;
const CX = 1040, CY = 530;
const U = 42, V = 10, W = -8, Z = 30;
const SCALE = 70 / (ARENA_ACTOR_WIDTH_M * Math.hypot(U, W));
export const ARENA_FACING_HYSTERESIS = .14;
export const ARENA_DIRECTIONS = ['east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north-east'] as const;

export function projectArenaPoint(point: { x: number; y: number }) {
  return { x: CX + ((point.x - 9) * U + (point.y - 6) * V) * SCALE,
    y: CY + ((point.y - 6) * Z + (point.x - 9) * W) * SCALE };
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
export function arenaCameraOffset(player: { x: number; y: number }, target?: { x: number; y: number }) {
  const point = projectArenaPoint(target ? { x: (player.x + target.x) / 2, y: (player.y + target.y) / 2 } : player);
  return { x: point.x - CX, y: point.y - CY };
}
export function arenaActorPixelScale(idleWidth: number, viewportScale: number) {
  // Horizontal extent of the projected circular footprint, not one projected world axis.
  const width = ARENA_ACTOR_WIDTH_M * SCALE * Math.hypot(U, V);
  return width / Math.max(1, idleWidth) * viewportScale;
}
export function unprojectArenaPoint(point: { x: number; y: number }) {
  const a = (point.x - CX) / SCALE, b = (point.y - CY) / SCALE, det = U * Z - V * W;
  return { x: (Z * a - V * b) / det + 9, y: (U * b - W * a) / det + 6 };
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
