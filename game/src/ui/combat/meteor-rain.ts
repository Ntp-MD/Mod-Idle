import { projectArenaPoint } from '../../presentation/arena-camera';
import { sm } from '../../engine/client';
import type { VfxAtlas } from '../fx/catalog';
import type { SkillGeometry } from './skill-geometry';

/** Decorative drops share one texture and a bounded live window; combat still owns damage. */
export function skillRainDrops(mark: SkillGeometry, atlas: VfxAtlas, reducedMotion = false) {
  const skillDuration = sm.byId[mark.skillId]?.duration;
  const duration = skillDuration ? sm.skillDurationSec(skillDuration, atlas.rainDurationSec ?? 0)
    : atlas.rainDurationSec ?? 0;
  const time = mark.phaseElapsedSec;
  if (mark.phase !== (atlas.rainPhase ?? 'Impact') || duration <= 0 || time < 0 || time >= duration) return [];
  const lifetime = Math.min(.9, duration);
  const interval = atlas.rainIntervalSec ?? .18;
  let seed = 0;
  for (const char of `${mark.key}:${atlas.src ?? ''}`) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  const random = (index: number) => {
    const value = Math.sin(seed + index * 127.1) * 43758.5453;
    return value - Math.floor(value);
  };
  // Rain starts with a populated window; only currently alive drops are evaluated.
  const first = Math.floor((time - lifetime) / interval) + 1;
  const last = Math.floor(time / interval);
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => {
    const id = first + index;
    const start = id * interval;
    const age = time - start;
    if (age < 0 || age >= lifetime) return null;
    const angle = id * 2.3999632297 + random(99) * Math.PI * 2;
    // Independent low-discrepancy radial samples cover centre and edge in every rain window.
    const radial = (id + .5) * .7548776662466927 + random(101);
    const spread = mark.area.radiusM > 0 ? mark.area.radiusM : atlas.rainSpreadM ?? 0;
    const radius = Math.sqrt(radial - Math.floor(radial)) * spread * Math.min(1, atlas.rainRadiusRatio ?? .83);
    const ground = { x: mark.area.center.x + Math.cos(angle) * radius,
      y: mark.area.center.y + Math.sin(angle) * radius };
    const point = projectArenaPoint(ground);
    const size = Math.max(48, mark.body.height) * 7.5 * (atlas.rainSizeScale ?? 1);
    const progress = age / lifetime;
    const flight = Math.max(0, 1 - progress / .5);
    const impactProgress = mark.phase === 'Field' && progress >= .5 ? (progress - .5) / .5 : null;
    const fragments = mark.phase === 'Field' && impactProgress != null && impactProgress > .12 && !reducedMotion
      ? Array.from({ length: 6 }, (_, shard) => {
        const direction = shard / 6 * Math.PI * 2 + random(id + shard + 300) * .4;
        const distance = size * (.04 + .28 * impactProgress);
        const shardSize = size * .18;
        return {
          x: point.x + Math.cos(direction) * distance,
          y: point.y + Math.sin(direction) * distance * .42 - Math.sin(impactProgress * Math.PI) * size * .08,
          size: shardSize * (1 - impactProgress * .2), index: 8 + shard % 4,
          rotationDeg: direction * 180 / Math.PI,
        };
      }) : [];
    return { id, start, ground, size,
      fragments,
      rotationDeg: mark.phase === 'Field' ? 45 : 0,
      impactProgress,
      x: point.x - (reducedMotion || mark.phase === 'Field' ? 0 : flight * size * .65),
      y: point.y - (reducedMotion ? 0 : flight * size * 1.6),
      index: reducedMotion ? Math.min(8, atlas.count - 1) : Math.min(atlas.count - 1, Math.floor(progress * atlas.count)),
      opacity: Math.min(1, age / .05, (lifetime - age) / .14) };
  }).filter(drop => drop !== null).sort((a, b) => a.ground.y - b.ground.y);
}
