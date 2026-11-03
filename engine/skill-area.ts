import { targetsInSkillArea } from './skill-actions.ts';
import type { SkillAreaDefinition, SkillAreaSnapshot } from './types.ts';

type Point = { x: number; y: number };
type Target = Point & { id: string };
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/** Stable acquisition order makes seeded selection independent of the encounter's array order. */
export function distinctSkillTargets<T extends { id: string }>(targets: readonly T[], count: number, rng: () => number): T[] {
  const remaining = [...targets].sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const selected: T[] = [];
  while (selected.length < count && remaining.length) {
    selected.push(remaining.splice(Math.floor(rng() * remaining.length), 1)[0]);
  }
  return selected;
}

/**
 * The one builder for a committed footprint; every aim path shares it. A multi-target footprint
 * holds every body inside: `max_targets` stays authored for the roster gate and the offline queue
 * and is never copied onto the snapshot.
 */
export function skillAreaSnapshot(
  definition: SkillAreaDefinition, caster: Point, aimPoint: Point, primaryId: string, facing = 0,
): SkillAreaSnapshot {
  const shape = definition.shape ?? (definition.radius_m > 0 ? 'circle' : 'single');
  const center = definition.origin === 'caster'
    ? { x: caster.x, y: caster.y } : { x: aimPoint.x, y: aimPoint.y };
  let directionRad = Math.atan2(aimPoint.y - caster.y, aimPoint.x - caster.x);
  if (!Number.isFinite(directionRad) || (Math.abs(aimPoint.x - caster.x) < 1e-9
    && Math.abs(aimPoint.y - caster.y) < 1e-9)) directionRad = facing;
  const snapshot: SkillAreaSnapshot = {
    origin: definition.origin, radiusM: definition.radius_m, center, targetId: primaryId,
  };
  if (shape === 'line') {
    snapshot.shape = 'line';
    snapshot.lengthM = definition.length_m ?? distance(caster, aimPoint);
    snapshot.widthM = definition.width_m ?? 0.75;
    snapshot.directionRad = directionRad;
  }
  if (shape === 'cone') {
    snapshot.shape = 'cone';
    snapshot.lengthM = definition.radius_m;
    snapshot.angleDeg = Math.max(1, Math.min(180, definition.angle_deg ?? 90));
    snapshot.directionRad = directionRad;
  }
  return snapshot;
}

/** Ground-space selection; input order breaks equal-distance ties without consuming RNG. */
export function resolveSkillArea<T extends Target>(
  caster: Point, targets: readonly T[], castRangeM: number, definition: SkillAreaDefinition,
): { targets: T[]; area?: SkillAreaSnapshot } {
  const shape = definition.shape ?? (definition.radius_m > 0 ? 'circle' : 'single');
  const acquireRange = shape === 'line'
    ? (definition.length_m ?? castRangeM)
    : definition.origin === 'caster' ? definition.radius_m : castRangeM;
  let primary: T | undefined;
  let nearest = Infinity;
  for (const target of targets) {
    const gap = distance(caster, target);
    if (gap <= acquireRange + 1e-7 && gap < nearest) {
      primary = target;
      nearest = gap;
    }
  }
  if (!primary) return { targets: [] };
  const area = skillAreaSnapshot(definition, caster, primary, primary.id);
  return { targets: targetsInSkillArea(area, targets), area };
}
