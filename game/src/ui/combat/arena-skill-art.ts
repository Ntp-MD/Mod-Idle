/**
 * Generated skill art slots. These augment the code-drawn telegraph in `SkillGeometryLayer`;
 * the simulation's resolved footprint stays authoritative, so the images are decorative and
 * are clipped/projected by the renderer, never used as hitboxes.
 *
 * Versions and atlas files are owned by `../fx/catalog.ts`; this module only adapts the active
 * pool row to the arena layer's decal/burst shape, and owns the one ground-projection matrix.
 */
import { activeVfxArt, type SkillArt, type VfxAtlas } from '../fx/catalog';
import { ARENA_VIEW, projectArenaPoint, projectArenaVector } from '../../presentation/arena-camera';
import type { SkillGeometry } from './skill-geometry';

export type { SkillArt } from '../fx/catalog';

export const skillArtFor = (id: string): SkillArt | undefined => activeVfxArt(id);

/** One atlas frame placed in the arena: the frame's anchor lands on the live aim point. */
export type SkillArtPlacement = {
  cx: number;
  cy: number;
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
  rotateDeg: number;
  mirror: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const ratio = (value: number | undefined) => clamp(Number.isFinite(value) ? Number(value) : 1, 0.05, 1);
const screenLength = (x: number, y: number) => {
  const vector = projectArenaVector({ x, y });
  return Math.hypot(vector.x, vector.y);
};

/**
 * Projectile sheets separate growth, flight and collision; ground sheets peak in their middle
 * frames. Playing only their exit at contact would skip the explosion and show its residue.
 */
export function atlasFrameIndex(mark: SkillGeometry, atlas: VfxAtlas): number {
  const fps = atlas.frameMs && atlas.frameMs > 0 ? 1000 / atlas.frameMs : Math.max(1, atlas.fps);
  const index = (seconds: number) => Math.floor(Math.max(0, seconds) * fps);
  if (mark.phase === 'Aim' || mark.phase === 'Windup') {
    const opening = atlas.frames?.opening;
    if (opening) return clamp(opening[0] + index(mark.phaseElapsedSec), opening[0], opening[1]);
  }
  if (mark.phase === 'Travel') {
    const loop = atlas.authoring?.delivery === 'projectile' ? atlas.frames?.loop : undefined;
    if (loop) return loop[0] + (index(mark.phaseElapsedSec) % Math.max(1, loop[1] - loop[0] + 1));
    const opening = atlas.frames?.opening;
    if (opening) return clamp(opening[0] + index(mark.phaseElapsedSec), opening[0], opening[1]);
  }
  if (mark.phase === 'Impact') {
    const range = atlasImpactFrames(atlas);
    return clamp(range[0] + index(mark.phaseElapsedSec), range[0], range[1]);
  }
  if (mark.phase === 'Field' || mark.phase === 'Channel') {
    const loop = atlas.frames?.loop;
    if (loop) return loop[0] + (index(mark.phaseElapsedSec) % Math.max(1, loop[1] - loop[0] + 1));
  }
  return clamp(index(mark.elapsedSec ?? 0), 0, atlas.count - 1);
}

function atlasImpactFrames(atlas: VfxAtlas): [number, number] {
  return atlas.authoring?.delivery === 'projectile'
    ? atlas.frames?.exit ?? [0, atlas.count - 1]
    : [atlas.frames?.loop?.[0] ?? 0, atlas.frames?.exit?.[1] ?? atlas.count - 1];
}

/** A visual tail may outlast a short combat action without extending its gameplay lifetime. */
export function atlasImpactDuration(atlas: VfxAtlas): number {
  const range = atlasImpactFrames(atlas);
  const frameSec = atlas.frameMs && atlas.frameMs > 0 ? atlas.frameMs / 1000 : 1 / Math.max(1, atlas.fps);
  return Math.max((range[1] - range[0] + 1) * frameSec, atlas.rainDurationSec ?? 0);
}

/** Presentation ends with the authored fade, rather than holding the last painted frame. */
export function atlasOpacity(mark: SkillGeometry, atlas: VfxAtlas): number {
  if (mark.phase === 'Aim') return 0;
  if (mark.phase === 'Windup') return atlas.authoring?.delivery === 'projectile' ? .35 + mark.progress * .4 : 0;
  if (mark.phase !== 'Impact') return 1;
  const duration = atlasImpactDuration(atlas);
  return clamp((duration - mark.phaseElapsedSec) / Math.min(.18, duration / 3), 0, 1);
}

/**
 * A content-aware screen placement for one atlas frame. The authored `anchor` is put on the
 * live aim point; `contentWidth/HeightRatio` make the painted content fill the footprint rather
 * than the frame's padding. Lines and cones rotate to the committed aim; single-body projectile
 * art rotates along its release→impact line.
 */
export function skillArtPlacement(mark: SkillGeometry, atlas: VfxAtlas): SkillArtPlacement {
  const authoring = atlas.authoring ?? {};
  const areaShape = mark.area.shape ?? ((mark.area.radiusM ?? 0) > 0 ? 'circle' : 'single');
  const shape = areaShape === 'line' || areaShape === 'cone'
    ? areaShape
    : (authoring.shape === 'circle' ? 'circle' : areaShape);
  const projectile = authoring.delivery === 'projectile' && shape !== 'line' && shape !== 'cone';
  const direction = mark.vfxAim.directionRad;
  const worldAim = projectArenaVector({ x: Math.cos(direction), y: Math.sin(direction) });
  const aimDeg = Math.atan2(worldAim.y, worldAim.x) * 180 / Math.PI;
  const content = atlas.content;
  // The actor body is the size authority for directed and single art, so a 6 m line never
  // becomes a screen-sized stamp. Circles are the exception: they cover the committed footprint.
  const bodyH = Math.max(48, Number(mark.body?.height ?? 132));
  const bodyW = Math.max(24, Number(mark.body?.width ?? bodyH * 0.45));
  let contentW = 24;
  let contentH = 20;
  let circleFootprint = false;
  let cx = mark.vfxAim.impact.x;
  let cy = mark.vfxAim.impact.y;
  let rotateDeg = 0;

  if (projectile) {
    const from = mark.vfxAim.release;
    const to = mark.vfxAim.impact;
    const progress = mark.phase === 'Travel' ? clamp(mark.progress, 0, 1)
      : mark.phase === 'Aim' || mark.phase === 'Windup' ? 0 : 1;
    cx = from.x + (to.x - from.x) * progress;
    cy = from.y + (to.y - from.y) * progress;
    // A travelling body has a stable size even when its target is far away.
    contentW = bodyH * (mark.phase === 'Impact' ? 1.45 : .95);
    contentH = bodyH * (mark.phase === 'Impact' ? 1.1 : .52);
    rotateDeg = mark.phase === 'Impact' || atlas.orient === false ? 0
      : Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI;
  } else if (shape === 'line') {
    const length = Math.max(0.4, Number(authoring.lengthM ?? mark.area.lengthM ?? mark.area.radiusM ?? 1));
    const width = Math.max(0.25, Number(authoring.widthM ?? mark.area.widthM ?? 0.6));
    contentW = clamp(screenLength(Math.cos(direction) * length, Math.sin(direction) * length), bodyH * 1.4, bodyH * 4.0);
    contentH = clamp(screenLength(-Math.sin(direction) * width, Math.cos(direction) * width), bodyW * 1.0, bodyW * 2.8);
    const center = projectArenaPoint({
      x: mark.area.center.x + Math.cos(direction) * length / 2,
      y: mark.area.center.y + Math.sin(direction) * length / 2,
    });
    cx = center.x; cy = center.y;
    rotateDeg = aimDeg;
  } else if (shape === 'cone') {
    const radius = Math.max(0.4, Number(authoring.radiusM ?? mark.area.radiusM ?? 1));
    const depth = Math.max(0.4, Number(authoring.depthM ?? radius));
    const span = Math.max(0.4, Number(authoring.spanM ?? (2 * radius * Math.sin((mark.area.angleDeg ?? 90) * Math.PI / 360))));
    contentW = clamp(screenLength(-Math.sin(direction) * span, Math.cos(direction) * span), bodyH * 1.0, bodyH * 3.4);
    contentH = clamp(screenLength(Math.cos(direction) * depth, Math.sin(direction) * depth), bodyH * 0.8, bodyH * 3.2);
    const center = projectArenaPoint({
      x: mark.area.center.x + Math.cos(direction) * depth / 2,
      y: mark.area.center.y + Math.sin(direction) * depth / 2,
    });
    cx = center.x; cy = center.y;
    // Sector art is painted opening upward; rotate that axis onto the live aim.
    rotateDeg = aimDeg + 90;
  } else if (shape === 'circle') {
    const xs = mark.vertices.map((point) => point.x);
    const ys = mark.vertices.map((point) => point.y);
    // The painted content covers the committed footprint. Clamping to body multiples
    // shrank wide AoE art (e.g. Thunder Storm r=3) below its own telegraph.
    contentW = Math.max(24, Math.max(...xs) - Math.min(...xs));
    contentH = Math.max(20, Math.max(...ys) - Math.min(...ys));
    circleFootprint = true;
    cx = mark.center.x; cy = mark.center.y;
  } else {
    const diameter = Math.max(0.9, Number(authoring.diameterM ?? 1.7));
    contentW = clamp(screenLength(diameter, 0), bodyW * 1.0, bodyW * 2.8);
    contentH = clamp(screenLength(0, authoring.delivery === 'ground' ? diameter * 1.5 : diameter), bodyH * 0.5, bodyH * 1.3);
    cx = mark.vfxAim.impact.x; cy = mark.vfxAim.impact.y;
  }

  // Keep the padded source frame bounded too; otherwise a low content ratio can still draw a
  // texture several screens wide even when the painted content is body-sized. Circles carry
  // the committed footprint, so their bound is the viewport, not the body.
  const fullCap = circleFootprint ? Math.max(ARENA_VIEW.width, ARENA_VIEW.height) : bodyH * 7;
  const fullW = clamp(contentW / ratio(content?.widthRatio), 24, fullCap);
  const fullH = clamp(contentH / ratio(content?.heightRatio), 20, fullCap);
  const anchor = (projectile && mark.phase === 'Impact' ? (atlas.impactAnchor ?? atlas.anchor) : atlas.anchor) ?? [0.5, 0.5];
  return {
    cx, cy, width: fullW, height: fullH,
    anchorX: clamp(anchor[0], 0, 1), anchorY: clamp(anchor[1], 0, 1),
    rotateDeg,
    mirror: (shape === 'single' && !projectile) ? mark.vfxAim.mirror < 0 : false,
  };
}

/**
 * The affine matrix that maps a square ground texture to the arena's ground plane.
 *
 * The texture is authored straight-down (no baked camera). This is the single projection:
 * `a b c d e f` map texture pixels 0..canvas onto screen pixels, with the footprint centre at
 * `center`. Applying it twice, or baking an ellipse into the texture, would double-project.
 */
export function groundDecalMatrix(
  center: { x: number; y: number },
  radiusM: number,
  canvasPx = 2048,
  contentRadiusRatio = 1,
): { a: number; b: number; c: number; d: number; e: number; f: number } {
  radiusM /= Math.max(.05, contentRadiusRatio);
  const bx = projectArenaVector({ x: radiusM, y: 0 });
  const by = projectArenaVector({ x: 0, y: radiusM });
  return {
    a: 2 * bx.x / canvasPx,
    b: 2 * bx.y / canvasPx,
    c: 2 * by.x / canvasPx,
    d: 2 * by.y / canvasPx,
    e: center.x - bx.x - by.x,
    f: center.y - bx.y - by.y,
  };
}

export const matrixAttribute = (m: { a: number; b: number; c: number; d: number; e: number; f: number }): string =>
  `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`;
