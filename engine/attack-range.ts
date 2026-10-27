import type { AttackRangeDefinition, AttackRangeProfile } from './types.ts';

/** Floating-point tolerance only; it never grants a visible extra metre of reach. */
export const ATTACK_RANGE_EPSILON = 1e-7;

export interface AttackRangeGeometry {
  /** Actual centre-to-centre distance supplied by the caller. */
  centerDistance: number;
  /** Gap between the two body edges, clamped at zero when bodies overlap. */
  edgeGap: number;
  /** Largest edge gap this profile permits. */
  maxEdgeGap: number;
  /** Largest centre distance this profile permits. */
  maxCenterDistance: number;
  /** Centre distance the approach aims for, inside the maximum. */
  stopCenterDistance: number;
  /** Outer edge of the tolerated stop band; a settled body may drift this far and keep its claim. */
  stopBandCenterDistance: number;
  /** Edge gap at the stop point. */
  stopEdgeGap: number;
  /** True only when the bodies' reach, not their sprites, permits the attack. */
  inRange: boolean;
}

export interface AttackRangeBodies {
  selfRadius: number;
  targetRadius: number;
}

const finitePositive = (value: number): number => Number.isFinite(value) && value > 0 ? value : 0;
const nonnegative = (value: number): number => Number.isFinite(value) && value > 0 ? value : 0;

/**
 * One authority for attack distance. `center` keeps an authored centre-to-centre range
 * (skills, projectiles); `body-edge` measures the gap between the two footprints. The stop point
 * is always inside the maximum, so an attacker cannot hold the far edge without closing in.
 */
export function attackRangeGeometry(
  range: AttackRangeDefinition,
  bodies: AttackRangeBodies,
  centerDistance: number,
  stopAtRangePct: number,
  clearanceM: number,
  stopBandM = 0,
): AttackRangeGeometry {
  const selfRadius = nonnegative(bodies.selfRadius);
  const targetRadius = nonnegative(bodies.targetRadius);
  const radii = selfRadius + targetRadius;
  const meters = finitePositive(range.meters);
  const clearance = Math.max(0, Number.isFinite(clearanceM) ? clearanceM : 0);
  const pct = Math.max(0, Math.min(1, Number.isFinite(stopAtRangePct) ? stopAtRangePct / 100 : 1));
  const distance = Math.max(0, Number.isFinite(centerDistance) ? centerDistance : 0);
  let maxCenterDistance: number;
  let maxEdgeGap: number;
  let stopCenterDistance: number;
  let stopEdgeGap: number;
  if (range.basis === 'center') {
    maxCenterDistance = meters;
    maxEdgeGap = Math.max(0, meters - radii);
    stopCenterDistance = Math.min(maxCenterDistance, Math.max(radii + clearance, meters * pct));
    stopEdgeGap = Math.max(0, stopCenterDistance - radii);
  } else {
    maxEdgeGap = meters;
    maxCenterDistance = radii + meters;
    stopEdgeGap = Math.min(maxEdgeGap, Math.max(clearance, maxEdgeGap * pct));
    stopCenterDistance = radii + stopEdgeGap;
  }
  const edgeGap = Math.max(0, distance - radii);
  const band = Number.isFinite(stopBandM) ? Math.max(0, stopBandM) : 0;
  return {
    centerDistance: distance,
    edgeGap,
    maxEdgeGap,
    maxCenterDistance,
    stopCenterDistance,
    stopBandCenterDistance: Math.min(maxCenterDistance, stopCenterDistance + band),
    stopEdgeGap,
    inRange: distance <= maxCenterDistance + ATTACK_RANGE_EPSILON,
  };
}

/** Whether a body already stands in the intended stop band rather than merely at maximum reach. */
export function withinAttackStopBand(geometry: AttackRangeGeometry): boolean {
  return geometry.centerDistance <= geometry.stopBandCenterDistance + ATTACK_RANGE_EPSILON;
}

/** Basic-action phases as a share of the resolved attack interval, never a fixed animation cap. */
export function basicPhaseBudget(profile: AttackRangeProfile, intervalUs: number): {
  windupUs: number; recoveryUs: number;
} {
  const interval = Math.max(1, Number.isFinite(intervalUs) ? intervalUs : 1);
  return {
    windupUs: Math.max(1, Math.round(interval * profile.windup_interval_pct / 100)),
    recoveryUs: Math.max(0, Math.round(interval * profile.recovery_interval_pct / 100)),
  };
}

/** Resolve the geometry of one ordinary profile for the bodies that actually hold it. */
export function attackProfileGeometry(
  profile: AttackRangeProfile,
  bodies: AttackRangeBodies,
  centerDistance: number,
  clearanceM: number,
  stopBandM = 0,
): AttackRangeGeometry {
  return attackRangeGeometry(profile.range, bodies, centerDistance, profile.stop_at_range_pct, clearanceM, stopBandM);
}
