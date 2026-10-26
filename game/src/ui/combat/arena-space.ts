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
export function groundCirclePoints(center: ArenaPoint, radiusM: number, segments = 32): ArenaPoint[] {
  const radius = metersToUnits(Math.max(0, radiusM));
  const count = Math.max(8, Math.round(segments));
  return Array.from({ length: count }, (_, index) => {
    const angle = index / count * Math.PI * 2;
    return projectArenaPoint({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  });
}

export function groundCirclePath(center: ArenaPoint, radiusM: number, segments = 32): string {
  return groundCirclePoints(center, radiusM, segments)
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ') + ' Z';
}

/** The pulse lasts longer at normal speed and compresses at 4× without changing the radius. */
export function aoePulseMs(speed = 1): number {
  return Math.round(1600 / Math.max(1, speed));
}
