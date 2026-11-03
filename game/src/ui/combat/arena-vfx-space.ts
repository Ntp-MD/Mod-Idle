import type { SkillAreaSnapshot, SkillDelivery, SkillShape } from '@engine/types';
import { sm } from '../../engine/client';
import { projectArenaPoint } from './combat-arena-view';
import { groundCirclePoints } from './arena-space';

/** Where a cast leaves the body and where its effect lands, in the arena's screen space. */
export const VFX_HAND_FORWARD_M = 0.28;
export const VFX_HAND_LIFT_PX = 30;
export const VFX_BODY_CENTER_LIFT_PX = 30;

export type SkillVfxAim = {
  /** Hand/weapon-height release point. Projectiles leave here, never the feet. */
  release: { x: number; y: number };
  /** Body-centre hit point for a single body; ground point for an area. */
  impact: { x: number; y: number };
  /** Ground point under the impact anchor (shock rings, debris, columns). */
  groundImpact: { x: number; y: number };
  /** World aim angle the simulation committed. */
  directionRad: number;
  /** Screen-space angle from release to impact (sprite/atlas orientation). */
  screenAngleRad: number;
  /** Screen-facing sign: -1 when the effect points left. */
  mirror: -1 | 1;
  /** True when the row lands on one body rather than a footprint. */
  bodyImpact: boolean;
};

/**
 * The one aim contract shared by the atlas, the procedural stage and the lab. It reads the
 * committed footprint and caster position, never a skill name, so every live attack gets the
 * same hand release, body/ground impact and screen angle.
 */
export function buildSkillVfxAim(
  area: SkillAreaSnapshot,
  source: { x: number; y: number },
  target: { x: number; y: number },
  releaseOverride?: { x: number; y: number },
  bodyHeightPx?: number,
): SkillVfxAim {
  const directed = area.shape === 'line' || area.shape === 'cone';
  const bodyImpact = !directed && !(area.radiusM > 0);
  const bodyHeight = Math.max(40, bodyHeightPx ?? 132);
  const fallback = Math.atan2(target.y - source.y, target.x - source.x);
  const directionRad = Number.isFinite(area.directionRad) ? area.directionRad! : fallback;
  const release = releaseOverride ? { ...releaseOverride } : projectArenaPoint({
    x: source.x + Math.cos(directionRad) * VFX_HAND_FORWARD_M,
    y: source.y + Math.sin(directionRad) * VFX_HAND_FORWARD_M,
  });
  if (!releaseOverride) release.y -= Math.max(VFX_HAND_LIFT_PX, bodyHeight * 0.46);
  const groundImpact = projectArenaPoint(directed ? target : area.center);
  const impact = { x: groundImpact.x, y: groundImpact.y - (bodyImpact ? bodyHeight * 0.5 : 0) };
  const screenAngleRad = Math.atan2(impact.y - release.y, impact.x - release.x);
  return { release, impact, groundImpact, directionRad, screenAngleRad,
    mirror: Math.cos(screenAngleRad) < 0 ? -1 : 1, bodyImpact };
}

/**
 * A seeded point inside the committed footprint, in world metres from its centre. Directed
 * shapes use the row's aim angle and angle/length, so a cone sprays forward and a line runs
 * along its own axis instead of exploding in a circle.
 */
export function sampleVfxOffset(area: SkillAreaSnapshot, rng: () => number): { x: number; y: number } {
  const shape = area.shape ?? (area.radiusM > 0 ? 'circle' : 'single');
  const direction = area.directionRad ?? 0;
  if (shape === 'line') {
    const length = Math.max(0.45, area.lengthM ?? area.radiusM);
    const width = Math.max(0.25, area.widthM ?? 0.6);
    const along = 0.12 + rng() * 0.88;
    const lateral = (rng() - 0.5) * width;
    return {
      x: Math.cos(direction) * length * along - Math.sin(direction) * lateral,
      y: Math.sin(direction) * length * along + Math.cos(direction) * lateral,
    };
  }
  if (shape === 'cone') {
    const reach = Math.max(0.45, area.radiusM);
    const half = Math.max(1, Math.min(90, (area.angleDeg ?? 90) / 2)) * Math.PI / 180;
    const angle = direction + (rng() * 2 - 1) * half;
    const distance = (0.16 + Math.sqrt(rng()) * 0.84) * reach;
    return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
  }
  const reach = Math.max(0.55, area.radiusM);
  const angle = rng() * Math.PI * 2;
  const distance = Math.sqrt(rng()) * reach;
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
}

export type VfxFootprint = {
  center: {x:number; y:number};
  basisX: {x:number; y:number};
  basisY: {x:number; y:number};
  diameter: number;
  /** Directional footprints keep their world geometry; the shape component projects it. */
  shape?: 'line' | 'cone';
  worldCenter?: {x:number; y:number};
  lengthM?: number;
  widthM?: number;
  angleDeg?: number;
  directionRad?: number;
};

/** Presentation-only foot ring: a level ellipse matching the painted arena camera. */
export function groundAuraFootprint(center: {x:number; y:number}, radius = 72): VfxFootprint {
  return {center, basisX:{x:radius,y:0}, basisY:{x:0,y:radius*.34}, diameter:radius*2};
}

/** UI clock input from one combat action; all values are seconds on the same clock. */
export type VfxTiming = {
  startedAtSec:number;
  releasedAtSec:number;
  impactAtSec:number;
  nowSec:number;
};

/** Project the combat action's frozen footprint; this never selects targets. */
export function projectVfxFootprint(area: SkillAreaSnapshot): VfxFootprint | undefined {
  const directed = area.shape === 'line' || area.shape === 'cone';
  if (!directed && area.radiusM <= 0) return undefined;
  const center = projectArenaPoint(area.center);
  const reach = area.shape === 'line' ? (area.lengthM ?? area.radiusM) : area.radiusM;
  const x = projectArenaPoint({x:area.center.x+reach,y:area.center.y});
  const y = projectArenaPoint({x:area.center.x,y:area.center.y+reach});
  const basisX = {x:x.x-center.x,y:x.y-center.y};
  const basisY = {x:y.x-center.x,y:y.y-center.y};
  const diameter = 2*Math.max(Math.hypot(basisX.x,basisX.y),Math.hypot(basisY.x,basisY.y));
  if (!directed) return {center,basisX,basisY,diameter};
  return {
    center, basisX, basisY, diameter,
    shape: area.shape as 'line' | 'cone',
    worldCenter: { x: area.center.x, y: area.center.y },
    lengthM: area.shape === 'line' ? (area.lengthM ?? area.radiusM) : area.radiusM,
    widthM: area.widthM,
    angleDeg: area.angleDeg,
    directionRad: area.directionRad ?? 0,
  };
}

/** One projected boundary for outlines, dimension reads and presentation-only volumes. */
const shapeCache = new Map<string, { x: number; y: number }[]>();
const shapePathCache = new Map<string, string>();
const SHAPE_CACHE_BOUND = 128;

export function clearGroundShapeCache() { shapeCache.clear(); shapePathCache.clear(); }
export function groundShapeCacheSize() { return shapeCache.size + shapePathCache.size; }

function shapeKey(area: SkillAreaSnapshot): string {
  return `${area.shape ?? ''}|${area.radiusM}|${area.lengthM ?? ''}|${area.widthM ?? ''}|${area.angleDeg ?? ''}|${area.directionRad ?? ''}|${area.center.x}|${area.center.y}`;
}

export function groundShapePoints(area: SkillAreaSnapshot): { x: number; y: number }[] {
  const key = shapeKey(area);
  const hit = shapeCache.get(key);
  if (hit) return hit;
  const points = buildGroundShapePoints(area);
  shapeCache.set(key, points);
  if (shapeCache.size > SHAPE_CACHE_BOUND) {
    const oldest = shapeCache.keys().next().value;
    if (oldest !== undefined) shapeCache.delete(oldest);
  }
  return points;
}

function buildGroundShapePoints(area: SkillAreaSnapshot): { x: number; y: number }[] {
  const shape = area.shape ?? (area.radiusM === 0 ? 'single' : 'circle');
  if (shape === 'line') {
    const length = area.lengthM ?? area.radiusM;
    const half = (area.widthM ?? 0) / 2;
    const direction = area.directionRad ?? 0;
    const cos = Math.cos(direction), sin = Math.sin(direction);
    const corners = [
      { x: -half, y: 0 }, { x: -half, y: length },
      { x: half, y: length }, { x: half, y: 0 },
    ].map((corner) => projectArenaPoint({
      x: area.center.x + corner.x * -sin + corner.y * cos,
      y: area.center.y + corner.x * cos + corner.y * sin,
    }));
    return corners;
  }
  if (shape === 'cone') {
    const reach = area.lengthM ?? area.radiusM;
    const half = Math.max(0, Math.min(90, (area.angleDeg ?? 90) / 2)) * Math.PI / 180;
    const direction = area.directionRad ?? 0;
    const segments = 20;
    const points = [{ x: area.center.x, y: area.center.y }];
    for (let index = 0; index <= segments; index++) {
      const angle = direction - half + index / segments * half * 2;
      points.push({ x: area.center.x + Math.cos(angle) * reach, y: area.center.y + Math.sin(angle) * reach });
    }
    return points.map(projectArenaPoint);
  }
  return groundCirclePoints(area.center, shape === 'single' ? Math.max(.25, area.radiusM) : area.radiusM, 48);
}

/** The committed shape as a ground-projected SVG path; single holds a body-sized ring. */
export function groundShapePath(area: SkillAreaSnapshot): string {
  const key = shapeKey(area);
  const hit = shapePathCache.get(key);
  if (hit !== undefined) return hit;
  const path = groundShapePoints(area).map((point, index) =>
    `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ') + ' Z';
  shapePathCache.set(key, path);
  if (shapePathCache.size > SHAPE_CACHE_BOUND) {
    const oldest = shapePathCache.keys().next().value;
    if (oldest !== undefined) shapePathCache.delete(oldest);
  }
  return path;
}

/**
 * Normalized spatial classification for one skill: the single owner VFX readers consult
 * instead of inferring shape/binding/follow from names, groups or Elements. Shape resolution
 * mirrors `skillAreaSnapshot` legacy normalization (`engine/skill-area.ts` owns the rule);
 * lifecycle mirrors the execution kinds the tick actually schedules (`SkillAction` + skill type).
 */
export type SkillHandoffLifecycle = 'impact' | 'burst' | 'channel' | 'field' | 'chain' | 'state';
export type SkillHandoffFollow = 'caster-feet' | 'fixed';
export interface SkillHandoff {
  id: string;
  shape: SkillShape;
  origin: 'caster' | 'target';
  delivery: SkillDelivery;
  lifecycle: SkillHandoffLifecycle;
  /** `self-area`: a caster-origin circle (fixed snapshot and following channel alike). */
  selfArea: boolean;
  /** `ground-area`: a committed footprint that stays on its world point after release. */
  groundArea: boolean;
  /** Where the presentation anchor lives; instance facts confirm, never widen. */
  follow: SkillHandoffFollow;
}

type HandoffRow = {
  id: string;
  type?: string;
  area?: { origin?: string; radius_m?: number; shape?: SkillShape } | null;
  cast?: { delivery?: SkillDelivery } | null;
  action?: { kind?: string } | null;
};

export function skillHandoffFor(skill: HandoffRow, instance?: { channel?: boolean; follow?: boolean }): SkillHandoff {
  const area = skill.area ?? undefined;
  const radius = Number(area?.radius_m ?? 0);
  const shape: SkillShape = area?.shape ?? (radius > 0 ? 'circle' : 'single');
  const origin = area?.origin === 'caster' ? 'caster' : 'target';
  const delivery = skill.cast?.delivery ?? 'instant';
  const kind = skill.action?.kind;
  let lifecycle: SkillHandoffLifecycle = 'impact';
  if (skill.type === 'buff' || skill.type === 'heal' || skill.type === 'aura') lifecycle = 'state';
  else if (kind === 'chain-strike') lifecycle = 'chain';
  else if (kind === 'whirlwind-channel') lifecycle = 'channel';
  else if (kind === 'blizzard-field' || kind === 'sand-field') lifecycle = 'field';
  else if (kind === 'projectile-burst' || kind === 'ground-pulse-burst') lifecycle = 'burst';
  const channel = (instance?.channel ?? instance?.follow ?? lifecycle === 'channel') && lifecycle === 'channel';
  const follow: SkillHandoffFollow = channel && origin === 'caster' ? 'caster-feet' : 'fixed';
  return {
    id: skill.id, shape, origin, delivery, lifecycle,
    selfArea: shape === 'circle' && origin === 'caster',
    groundArea: follow === 'fixed',
    follow,
  };
}

/** Canonical-row convenience read; instance facts come from the committed action/flight. */
export function skillHandoffById(id: string, instance?: { channel?: boolean; follow?: boolean }): SkillHandoff | undefined {
  const skill = sm.byId[id];
  return skill ? skillHandoffFor(skill, instance) : undefined;
}
