import type { PhaseSpeeds, SkillAreaSnapshot, SkillCastProfile, SkillCastTiming } from './types.ts';

const phaseRate = (speeds: number | PhaseSpeeds | undefined, phase: 'cast' | 'recovery'): number => {
  const value = typeof speeds === 'number' ? speeds : speeds?.[phase] ?? 1;
  return Math.max(1e-7, value || 1);
};

type Point = { x: number; y: number };
/**
 * A body on the ground plane. `radiusM` is the body's own footprint when the caller knows it;
 * circle membership stays centre-in-centre (the documented AoE rule), while contact tests —
 * a single-target impact check and a projectile sweep — meet the body's edge.
 */
type Target = Point & { id: string; previous?: Point; radiusM?: number };

export function skillCastTiming(
  profile: SkillCastProfile, atUs: number, unitsPerSec: number,
  source: Point, destination: Point, speeds: number | PhaseSpeeds = 1, floorUs = 0,
): SkillCastTiming {
  const fixedWindupUs = Math.round(Math.max(0, profile.fixed_windup_sec ?? 0) * unitsPerSec);
  // Wis shortens variable windup only, then Global Speed divides what is left; fixed time and the
  // phase floor stay intact, and the share is a finite percentage rather than a cast-speed divisor.
  const reduction = Math.max(0, Math.min(100, Number(
    typeof speeds === 'number' ? 0 : speeds.castReductionPct ?? 0))) / 100;
  const variableWindupUs = Math.ceil(Math.max(0, profile.windup_sec - (profile.fixed_windup_sec ?? 0))
    * (1 - reduction) / phaseRate(speeds, 'cast') * unitsPerSec);
  const releaseAtUs = atUs + Math.max(floorUs, fixedWindupUs + variableWindupUs);
  return releasedSkillCastTiming(profile, atUs, releaseAtUs, unitsPerSec, source, destination, speeds, floorUs);
}

/**
 * Timing once the windup has finished: travel and recovery are measured from the actual release,
 * using the release-time source and aim, not the windup snapshot. Each phase keeps its fixed
 * commitment and never compresses below the combat-step floor (F44).
 */
export function releasedSkillCastTiming(
  profile: SkillCastProfile, startedAtUs: number, releaseAtUs: number, unitsPerSec: number,
  source: Point, destination: Point, speeds: number | PhaseSpeeds = 1, floorUs = 0,
): SkillCastTiming {
  const travelSec = profile.delivery === 'projectile'
    ? Math.hypot(destination.x - source.x, destination.y - source.y) / profile.projectile_speed_mps : 0;
  const fixedRecoveryUs = Math.round(Math.max(0, profile.fixed_recovery_sec ?? 0) * unitsPerSec);
  const variableRecoveryUs = Math.ceil(Math.max(0, profile.recovery_sec - (profile.fixed_recovery_sec ?? 0))
    / phaseRate(speeds, 'recovery') * unitsPerSec);
  return {
    delivery: profile.delivery, startedAtUs, releaseAtUs,
    impactAtUs: releaseAtUs + Math.ceil((profile.impact_delay_sec + travelSec) * unitsPerSec),
    recoveryUntilUs: releaseAtUs + Math.max(floorUs, fixedRecoveryUs + variableRecoveryUs),
  };
}

/** Impact tests a committed footprint against current positions, without reacquiring a cast target. */
export function targetsInSkillArea<T extends Target>(
  area: SkillAreaSnapshot, targets: readonly T[], preciseRadiusM = 0,
): T[] {
  const primary = targets.find((target) => target.id === area.targetId);
  const shape = area.shape ?? (area.radiusM === 0 ? 'single' : 'circle');
  if (shape === 'single') return primary && (preciseRadiusM === 0
    || Math.hypot(primary.x - area.center.x, primary.y - area.center.y)
      <= preciseRadiusM + (primary.radiusM ?? 0) + 1e-7)
    ? [primary] : [];
  if (shape === 'line') {
    if (area.directionRad == null || area.lengthM == null) return primary ? [primary] : [];
    const cos = Math.cos(area.directionRad), sin = Math.sin(area.directionRad);
    const halfWidth = (area.widthM ?? 0) / 2;
    const inside = targets.filter((target) => {
      const dx = target.x - area.center.x, dy = target.y - area.center.y;
      const along = dx * cos + dy * sin;
      const across = Math.abs(-dx * sin + dy * cos);
      return along >= -1e-7 && along <= area.lengthM! + 1e-7 && across <= halfWidth + 1e-7;
    });
    return primary && inside.includes(primary)
      ? [primary, ...inside.filter((target) => target !== primary)] : inside;
  }
  if (shape === 'cone') {
    if (area.directionRad == null) return primary ? [primary] : [];
    const reach = area.lengthM ?? area.radiusM;
    const halfAngle = Math.max(0, Math.min(90, (area.angleDeg ?? 90) / 2)) * Math.PI / 180;
    const minDot = Math.cos(halfAngle) - 1e-9;
    const cos = Math.cos(area.directionRad), sin = Math.sin(area.directionRad);
    const inside = targets.filter((target) => {
      const dx = target.x - area.center.x, dy = target.y - area.center.y;
      const gap = Math.hypot(dx, dy);
      if (gap > reach + 1e-7) return false;
      if (gap <= 1e-7) return true;
      return (dx * cos + dy * sin) / gap >= minDot;
    });
    return primary && inside.includes(primary)
      ? [primary, ...inside.filter((target) => target !== primary)] : inside;
  }
  // The AoE circle is centre-in-centre by contract: a body's edge never expands the committed
  // footprint. Only the single-target impact check and a projectile sweep meet the body edge.
  const inside = targets.filter((target) =>
    Math.hypot(target.x - area.center.x, target.y - area.center.y) <= area.radiusM + 1e-7);
  return primary && inside.includes(primary) ? [primary, ...inside.filter((target) => target !== primary)] : inside;
}

/** Swept projectile versus moving target centers; nearest contact wins, input order breaks ties. */
export function firstProjectileHit<T extends Target>(
  from: Point, to: Point, targets: readonly T[], radiusM: number,
): { target: T; fraction: number } | undefined {
  let first: { target: T; fraction: number } | undefined;
  for (const target of targets) {
    const previous = target.previous ?? target;
    const reach = radiusM + (target.radiusM ?? 0);
    const x = from.x - previous.x, y = from.y - previous.y;
    const dx = to.x - from.x - (target.x - previous.x);
    const dy = to.y - from.y - (target.y - previous.y);
    const a = dx * dx + dy * dy, b = 2 * (x * dx + y * dy);
    const c = x * x + y * y - reach * reach;
    let fraction = c <= 0 ? 0 : Infinity;
    const discriminant = b * b - 4 * a * c;
    if (a > 0 && discriminant >= 0 && c > 0) fraction = (-b - Math.sqrt(discriminant)) / (2 * a);
    if (fraction >= 0 && fraction <= 1 && (!first || fraction < first.fraction))
      first = { target, fraction };
  }
  return first;
}
