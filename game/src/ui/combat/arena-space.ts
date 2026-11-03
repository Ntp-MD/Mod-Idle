import { projectArenaPoint } from './combat-arena-view';

export type ArenaPoint = { x: number; y: number };

/**
 * Arena coordinates are the spatial contract for meter-radius effects. One arena unit is one meter;
 * keep this as the only conversion so the simulation and the ground layer cannot drift apart.
 */
export const ARENA_UNITS_PER_METER = 1;

export const metersToUnits = (meters: number): number => meters * ARENA_UNITS_PER_METER;
export const unitsToMeters = (units: number): number => units / ARENA_UNITS_PER_METER;

export function groundDistance(a: ArenaPoint, b: ArenaPoint): number {
  return unitsToMeters(Math.hypot(a.x - b.x, a.y - b.y));
}

export function withinRadius(a: ArenaPoint, b: ArenaPoint, radiusM: number): boolean {
  return groundDistance(a, b) <= radiusM;
}

/** A world circle sampled through the arena projection, so it lands on the ground plane. */
const circleCache = new Map<string, { x: number; y: number }[]>();
const circlePathCache = new Map<string, string>();
const CIRCLE_CACHE_BOUND = 128;

export function clearGroundCircleCache() { circleCache.clear(); circlePathCache.clear(); }
export function groundCircleCacheSize() { return circleCache.size + circlePathCache.size; }

export function groundCirclePoints(center: ArenaPoint, radiusM: number, segments = 32): ArenaPoint[] {
  const count = Math.max(8, Math.round(segments));
  const key = `${center.x}|${center.y}|${radiusM}|${count}`;
  const hit = circleCache.get(key);
  if (hit) return hit;
  const radius = metersToUnits(Math.max(0, radiusM));
  const points = Array.from({ length: count }, (_, index) => {
    const angle = index / count * Math.PI * 2;
    return projectArenaPoint({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  });
  circleCache.set(key, points);
  if (circleCache.size > CIRCLE_CACHE_BOUND) {
    const oldest = circleCache.keys().next().value;
    if (oldest !== undefined) circleCache.delete(oldest);
  }
  return points;
}

export function groundCirclePath(center: ArenaPoint, radiusM: number, segments = 32): string {
  const count = Math.max(8, Math.round(segments));
  const key = `${center.x}|${center.y}|${radiusM}|${count}`;
  const hit = circlePathCache.get(key);
  if (hit !== undefined) return hit;
  const path = groundCirclePoints(center, radiusM, count)
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ') + ' Z';
  circlePathCache.set(key, path);
  if (circlePathCache.size > CIRCLE_CACHE_BOUND) {
    const oldest = circlePathCache.keys().next().value;
    if (oldest !== undefined) circlePathCache.delete(oldest);
  }
  return path;
}

/** The pulse lasts longer at normal speed and compresses at 4× without changing the radius. */
export function aoePulseMs(speed = 1): number {
  return Math.round(1600 / Math.max(1, speed));
}
