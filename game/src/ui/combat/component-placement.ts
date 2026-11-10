import type { VfxAtlas } from '../fx/catalog';
import type { SkillGeometry } from './skill-geometry';

/** Expansion is visual only; reduced motion keeps the final committed coverage. */
export function componentScale(mark: SkillGeometry, atlas: VfxAtlas, reducedMotion = false) {
  if (atlas.placement?.kind !== 'expand' || reducedMotion) return 1;
  const progress = Math.max(0, Math.min(1,
    (mark.phaseElapsedSec - (atlas.delaySec ?? 0)) / (atlas.durationSec ?? 1)));
  return atlas.placement.fromScale + (1 - atlas.placement.fromScale) * progress;
}

/** Decorative offsets in world metres. The committed cast owns bounds and the phase clock. */
export function componentInstances(mark: SkillGeometry, atlas: VfxAtlas, reducedMotion = false) {
  const elapsed = Math.max(0, mark.phaseElapsedSec - (atlas.delaySec ?? 0));
  const placement = atlas.placement;
  const instance = (dx = 0, dy = 0, rotationDeg = 0, stagger = 0) =>
    ({ dx, dy, rotationDeg, elapsedSec: mark.phaseElapsedSec - stagger });
  if (!placement || placement.kind === 'expand' || placement.kind === 'tether') return [instance()];
  if (placement.kind === 'spin') {
    return [instance(0, 0, reducedMotion ? 0 : elapsed / placement.cycleSec * 360)];
  }
  if (placement.kind === 'orbit') {
    const angle = reducedMotion ? 0 : elapsed / placement.cycleSec * Math.PI * 2;
    return [instance(Math.cos(angle) * placement.radiusM, Math.sin(angle) * placement.radiusM)];
  }
  if (mark.area.shape !== 'line' || !(mark.area.lengthM! > 0)) return [];
  const length = mark.area.lengthM!;
  const direction = mark.area.directionRad ?? mark.directionRad;
  const along = (distance: number, stagger = 0) =>
    instance(Math.cos(direction) * distance, Math.sin(direction) * distance, 0, stagger);
  if (placement.kind === 'line-front') {
    const progress = reducedMotion ? 1 : Math.min(1, elapsed / Math.max(.001, atlas.durationSec ?? 1));
    return [along(length * progress)];
  }
  const count = Math.min(64, Math.ceil(length / placement.spacingM) + 1);
  return Array.from({ length: count }, (_, index) => ({
    distance: length * index / (count - 1),
    stagger: reducedMotion ? 0 : index * placement.staggerSec,
  })).filter(item => item.stagger <= elapsed).map(item => along(item.distance, item.stagger));
}
