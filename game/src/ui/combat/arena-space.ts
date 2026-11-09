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

/** The pulse lasts longer at normal speed and compresses at 4× without changing the radius. */
export function aoePulseMs(speed = 1): number {
  return Math.round(1600 / Math.max(1, speed));
}
