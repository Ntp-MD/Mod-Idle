import type { SkillAreaSnapshot, SkillDelivery, SkillShape } from '@engine/types';
import { sm } from '../../engine/client';
import { ARENA_DEFAULT_BODY_RADIUS_M, ARENA_REF_PX_PER_M } from '../../presentation/arena-camera';
import { applyWorldToViewport, fieldPointM } from '../../presentation/view-transform';
import type { FieldViewFrame } from '../../presentation/arena-view-frame';

/** Single world-metre minima source for skill footprints (presentation floors, not sim). */
export const SKILL_SHAPE_MIN_M = {
  line: 0.4, width: 0.25, diameter: 0.9,
  sampleLine: 0.45, sampleCone: 0.45, sampleCircle: 0.55,
} as const;
/** Tessellation from radius so large circles stay smooth at any zoom; single source. */
export const worldCircleSegments = (radiusM: number): number =>
  Math.max(16, Math.min(64, Math.ceil(Math.max(0, radiusM) * 24)));
export const coneSegments = 20;

/** World-metre forward offset from the feet to the hand/weapon release point. */
export const VFX_HAND_FORWARD_M = 0.28;
/**
 * Model-space minimum for the hand-height lift through the single reference density.
 * The adapter converts to CSS via the painted frame; no pixel math lives here.
 */
export const VFX_HAND_LIFT_M = 30 / ARENA_REF_PX_PER_M;
/** Share of the body height used for the hand lift and the body-centre lift. */
export const VFX_HAND_LIFT_SHARE = 0.46;
export const VFX_BODY_LIFT_SHARE = 0.5;

/**
 * Release/impact anchor in world metres. Ground points only — the screen-vertical
 * hand lift and body-centre lift are applied once by `projectSkillVfxAim` through
 * the painted frame, so zoom/scale can never change the committed footprint.
 */
export type SkillVfxAimWorld = {
  /** Hand/weapon-height release ground point. Projectiles leave here, never the feet. */
  releaseM: { x: number; y: number };
  /** Committed ground point under the effect (area centre, or target for directed shapes). */
  groundImpactM: { x: number; y: number };
  /** True when the row lands on one body rather than a footprint (screen lifts to body centre). */
  bodyImpact: boolean;
  /** World aim angle the simulation committed. */
  directionRad: number;
  /** True when the release came from an authored socket/callers point (no hand lift). */
  fromSocket: boolean;
  /**
   * Explicit screen-vertical lift for the release in model metres (chain-hop origins
   * and homing samples ride body centres). Undefined means the default hand lift.
   */
  releaseLiftM?: number;
};

/** Screen projection of one world aim: viewport CSS pixels via the painted frame. */
export type SkillVfxAimPx = {
  release: { x: number; y: number };
  /** Body-centre hit point for a single body; ground point for an area. */
  impact: { x: number; y: number };
  /** Ground point under the impact anchor (shock rings, debris, columns). */
  groundImpact: { x: number; y: number };
  /** World aim angle the simulation committed. */
  directionRad: number;
  /** Screen-space angle from release to impact (atlas orientation). Uniform frame scale keeps it equal to directionRad only before lifts. */
  screenAngleRad: number;
  /** Screen-facing sign: -1 when the effect points left. */
  mirror: -1 | 1;
  bodyImpact: boolean;
};

/**
 * The one aim contract in world metres. Reads the committed footprint and caster
 * position, never a skill name: every live attack gets the same release side
 * and ground impact. Pixel lifts live in `projectSkillVfxAim`, never here.
 */
export function buildSkillVfxAimWorld(
  area: SkillAreaSnapshot,
  source: { x: number; y: number },
  target: { x: number; y: number },
  releaseOverrideM?: { x: number; y: number },
  releaseLiftM?: number,
): SkillVfxAimWorld {
  const directed = area.shape === 'line' || area.shape === 'cone';
  const bodyImpact = !directed && !(area.radiusM > 0);
  const fallback = Math.atan2(target.y - source.y, target.x - source.x);
  const directionRad = Number.isFinite(area.directionRad) ? area.directionRad! : fallback;
  return {
    releaseM: releaseOverrideM ? { ...releaseOverrideM } : {
      x: source.x + Math.cos(directionRad) * VFX_HAND_FORWARD_M,
      y: source.y + Math.sin(directionRad) * VFX_HAND_FORWARD_M,
    },
    groundImpactM: directed ? { ...target } : { ...area.center },
    bodyImpact,
    directionRad,
    fromSocket: !!releaseOverrideM,
    ...(releaseLiftM != null ? { releaseLiftM } : {}),
  };
}

/**
 * Frame-driven adapter: world aim to viewport CSS. Hand lift defaults to
 * max(VFX_HAND_LIFT_M, bodyHeightM * VFX_HAND_LIFT_SHARE); socket releases use
 * their explicit lift (0 for authored sockets, body-centre for chain/homing).
 * Body impacts lift to body centre; areas stay on the ground.
 */
export function projectSkillVfxAim(
  world: SkillVfxAimWorld,
  frame: FieldViewFrame,
  bodyHeightM: number,
): SkillVfxAimPx | undefined {
  if (!frame.renderable) return undefined;
  const cssPerM = frame.cssPixelsPerMeter;
  const project = (point: { x: number; y: number }) =>
    applyWorldToViewport(frame.worldToViewport, fieldPointM(point.x, point.y));
  const bodyM = Number.isFinite(bodyHeightM) && bodyHeightM > 0 ? bodyHeightM : 0;
  const releaseLiftM = world.releaseLiftM
    ?? (world.fromSocket ? 0 : Math.max(VFX_HAND_LIFT_M, bodyM * VFX_HAND_LIFT_SHARE));
  const releaseGround = project(world.releaseM);
  const release = { x: releaseGround.x, y: releaseGround.y - releaseLiftM * cssPerM };
  const groundImpact = project(world.groundImpactM);
  const impact = bodyImpactLift(groundImpact, world.bodyImpact, bodyM, cssPerM);
  const screenAngleRad = Math.atan2(impact.y - release.y, impact.x - release.x);
  return { release, impact, groundImpact, directionRad: world.directionRad, screenAngleRad,
    mirror: Math.cos(screenAngleRad) < 0 ? -1 : 1, bodyImpact: world.bodyImpact };
}

function bodyImpactLift(ground: { x: number; y: number }, bodyImpact: boolean,
  bodyHeightM: number, cssPerM: number): { x: number; y: number } {
  if (!bodyImpact) return { ...ground };
  return { x: ground.x, y: ground.y - bodyHeightM * VFX_BODY_LIFT_SHARE * cssPerM };
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
    const length = Math.max(SKILL_SHAPE_MIN_M.sampleLine, area.lengthM ?? area.radiusM);
    const width = Math.max(SKILL_SHAPE_MIN_M.width, area.widthM ?? 0.6);
    const along = 0.12 + rng() * 0.88;
    const lateral = (rng() - 0.5) * width;
    return {
      x: Math.cos(direction) * length * along - Math.sin(direction) * lateral,
      y: Math.sin(direction) * length * along + Math.cos(direction) * lateral,
    };
  }
  if (shape === 'cone') {
    const reach = Math.max(SKILL_SHAPE_MIN_M.sampleCone, area.radiusM);
    const half = Math.max(1, Math.min(90, (area.angleDeg ?? 90) / 2)) * Math.PI / 180;
    const angle = direction + (rng() * 2 - 1) * half;
    const distance = (0.16 + Math.sqrt(rng()) * 0.84) * reach;
    return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
  }
  const reach = Math.max(SKILL_SHAPE_MIN_M.sampleCircle, area.radiusM);
  const angle = rng() * Math.PI * 2;
  const distance = Math.sqrt(rng()) * reach;
  return { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
}

/** UI clock input from one combat action; all values are seconds on the same clock. */
export type VfxTiming = {
  startedAtSec:number;
  releasedAtSec:number;
  impactAtSec:number;
  nowSec:number;
};

/**
 * World-metre boundary cache: keyed by the resolved snapshot only, so a scale or
 * viewport change reuses the same world geometry (A12) and never rebuilds it.
 * Projected strings are rebuilt per painted frame and never retained here.
 */
const worldShapeCache = new Map<string, { x: number; y: number }[]>();
const SHAPE_CACHE_BOUND = 128;

export function clearGroundShapeCache() {
  worldShapeCache.clear();
}
export function groundShapeCacheSize() {
  return worldShapeCache.size;
}
/** World-cache entries only (frame-independent geometry). */
export function groundWorldShapeCacheSize() { return worldShapeCache.size; }

function shapeKey(area: SkillAreaSnapshot): string {
  return `${area.shape ?? ''}|${area.radiusM}|${area.lengthM ?? ''}|${area.widthM ?? ''}|${area.angleDeg ?? ''}|${area.directionRad ?? ''}|${area.center.x}|${area.center.y}`;
}

/**
 * Committed shape boundary in world metres (no projection). Circles sample the
 * ground plane, lines return their four corners, cones fan from the apex, and a
 * single holds a body-sized ring. Cached by snapshot; the frame adapter projects.
 */
export function groundShapeWorldPoints(area: SkillAreaSnapshot): { x: number; y: number }[] {
  const key = shapeKey(area);
  const hit = worldShapeCache.get(key);
  if (hit) return hit;
  const points = buildGroundShapeWorldPoints(area);
  worldShapeCache.set(key, points);
  if (worldShapeCache.size > SHAPE_CACHE_BOUND) {
    const oldest = worldShapeCache.keys().next().value;
    if (oldest !== undefined) worldShapeCache.delete(oldest);
  }
  return points;
}

function buildGroundShapeWorldPoints(area: SkillAreaSnapshot): { x: number; y: number }[] {
  const shape = area.shape ?? (area.radiusM === 0 ? 'single' : 'circle');
  if (shape === 'line') {
    const length = area.lengthM ?? area.radiusM;
    const half = (area.widthM ?? 0) / 2;
    const direction = area.directionRad ?? 0;
    const cos = Math.cos(direction), sin = Math.sin(direction);
    return [
      { x: -half, y: 0 }, { x: -half, y: length },
      { x: half, y: length }, { x: half, y: 0 },
    ].map((corner) => ({
      x: area.center.x + corner.x * -sin + corner.y * cos,
      y: area.center.y + corner.x * cos + corner.y * sin,
    }));
  }
  if (shape === 'cone') {
    const reach = area.lengthM ?? area.radiusM;
    const half = Math.max(0, Math.min(90, (area.angleDeg ?? 90) / 2)) * Math.PI / 180;
    const direction = area.directionRad ?? 0;
    const segments = coneSegments;
    const points = [{ x: area.center.x, y: area.center.y }];
    for (let index = 0; index <= segments; index++) {
      const angle = direction - half + index / segments * half * 2;
      points.push({ x: area.center.x + Math.cos(angle) * reach, y: area.center.y + Math.sin(angle) * reach });
    }
    return points;
  }
  const radius = shape === 'single' ? Math.max(ARENA_DEFAULT_BODY_RADIUS_M, area.radiusM) : area.radiusM;
  return worldCirclePoints(area.center, radius, worldCircleSegments(radius));
}

/** World-metre circle samples; the frame adapter projects them for paint. */
export function worldCirclePoints(center: { x: number; y: number }, radiusM: number,
  segments?: number): { x: number; y: number }[] {
  const count = Math.max(8, Math.round(segments ?? worldCircleSegments(radiusM)));
  const radius = Math.max(0, radiusM);
  return Array.from({ length: count }, (_, index) => {
    const angle = index / count * Math.PI * 2;
    return { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
  });
}

/**
 * Model-space path string from world-metre points. Painted under the frame's
 * world→viewport ancestor transform, so the native box stays zoom-independent
 * while the visible footprint scales with the frame. Same segment encoding as
 * the projected screens; only the coordinate space differs.
 */
export function worldPathD(points: readonly { x: number; y: number }[], close = true): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x} ${point.y}`).join(' ') + (close ? ' Z' : '');
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
