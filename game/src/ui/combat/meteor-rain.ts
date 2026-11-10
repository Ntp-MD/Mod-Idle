import { sm } from '../../engine/client';
import type { VfxAtlas } from '../fx/catalog';
import type { SkillGeometry } from './skill-geometry';
import type { FieldViewFrame } from '../../presentation/arena-view-frame';
import { ARENA_REF_PX_PER_M } from '../../presentation/arena-camera';

/** Model-space minimum body height for rain sizing through the single reference density. */
const RAIN_BODY_MIN_M = 48 / ARENA_REF_PX_PER_M;
/** Decorative rain size as a body-relative model factor (was 7.5× body px). */
const RAIN_SIZE_K = 7.5;

/**
 * Decorative drops in world metres, sampled from the committed world footprint.
 * Reads the world centre/radius and the sim clock only. Paint under the frame's
 * world→viewport ancestor transform: positions and sizes are zoom-stable model
 * values, the frame owns their screen mapping. Seeded by mark key + atlas
 * source, so the timeline and pattern are stable across Base/skin switches,
 * zoom and quality changes. Combat still owns damage; this never publishes hits.
 */
export function skillRainDrops(mark: SkillGeometry, frame: FieldViewFrame,
  atlas: VfxAtlas, reducedMotion = false) {
  if (!frame.renderable) return [];
  const skillDuration = sm.byId[mark.skillId]?.duration;
  const duration = skillDuration ? sm.skillDurationSec(skillDuration, atlas.rainDurationSec ?? 0)
    : atlas.rainDurationSec ?? 0;
  const time = mark.phaseElapsedSec;
  const fieldKind = sm.byId[mark.skillId]?.action?.kind;
  const phase = (fieldKind === 'meteor-field' || fieldKind === 'thunder-field') && mark.phase === 'Field' ? 'Impact' : mark.phase;
  if (phase !== (atlas.rainPhase ?? 'Impact') || duration <= 0 || time < 0 || time >= duration) return [];
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
    const groundM = { x: mark.area.center.x + Math.cos(angle) * radius,
      y: mark.area.center.y + Math.sin(angle) * radius };
    const size = Math.max(RAIN_BODY_MIN_M, mark.bodyM.height) * RAIN_SIZE_K * (atlas.rainSizeScale ?? 1);
    const progress = age / lifetime;
    // A lightning strike is a rooted flash: no fall, no splash, brightness decays.
    const strike = fieldKind === 'thunder-field';
    const flight = strike ? 0 : Math.max(0, 1 - progress / .5);
    const impactProgress = mark.phase === 'Field' && progress >= .5 ? (progress - .5) / .5 : null;
    const fragments = !strike && mark.phase === 'Field' && impactProgress != null && impactProgress > .12 && !reducedMotion
      ? Array.from({ length: 6 }, (_, shard) => {
        const direction = shard / 6 * Math.PI * 2 + random(id + shard + 300) * .4;
        const distance = size * (.04 + .28 * impactProgress);
        const shardSize = size * .18;
        return {
          x: groundM.x + Math.cos(direction) * distance,
          y: groundM.y + Math.sin(direction) * distance * .42 - Math.sin(impactProgress * Math.PI) * size * .08,
          size: shardSize * (1 - impactProgress * .2), index: Math.min(atlas.count - 1, 8 + shard % 4),
          rotationDeg: direction * 180 / Math.PI,
        };
      }) : [];
    return { id, start, ground: groundM, size,
      fragments,
      // Only the Field-phase shard stamp is authored tilted. Impact-phase rain
      // (Meteor) carries its diagonal fall in the atlas frames; strikes stay rooted.
      rotationDeg: atlas.rainPhase === 'Field' ? 45 : 0,
      impactProgress,
      x: groundM.x - (reducedMotion || mark.phase === 'Field' ? 0 : flight * size * .65),
      y: groundM.y - (reducedMotion ? 0 : flight * size * 1.6),
      index: reducedMotion ? Math.min(8, atlas.count - 1) : Math.min(atlas.count - 1, Math.floor(progress * atlas.count)),
      opacity: strike ? Math.min(1, age / .04) * (1 - progress) : Math.min(1, age / .05, (lifetime - age) / .14) };
  }).filter(drop => drop !== null).sort((a, b) => a.ground.y - b.ground.y);
}
