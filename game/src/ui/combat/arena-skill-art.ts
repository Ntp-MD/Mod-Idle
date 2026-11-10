/**
 * Generated skill art slots. These augment the code-drawn telegraph in `SkillGeometryLayer`;
 * the simulation's resolved footprint stays authoritative, so the images are decorative and
 * are clipped/projected by the renderer, never used as hitboxes.
 *
 * Versions and atlas files are owned by `../fx/catalog.ts`; this module only adapts the active
 * pool row to the arena layer's decal/burst shape, and owns the one ground-projection matrix.
 */
import { activeVfxArt, activeVfxVersion, vfxArtCandidates, type SkillArt, type VfxAtlas } from '../fx/catalog';
import { getVfxAssetStatus } from '../fx/vfx-assets.svelte';
import type { FieldViewFrame } from '../../presentation/arena-view-frame';
import { ARENA_REF_PX_PER_M } from '../../presentation/arena-camera';
import { applyWorldToViewport, applyWorldVector, fieldPointM, fieldVectorM, type Affine2 } from '../../presentation/view-transform';
import type { SkillGeometry, SkillGeometryScreen } from './skill-geometry';
import { VFX_BODY_LIFT_SHARE, VFX_HAND_LIFT_M, VFX_HAND_LIFT_SHARE, SKILL_SHAPE_MIN_M, groundShapeWorldPoints } from './arena-vfx-space';

/** Authored reference density: the single topdown source, not runtime zoom. */
const REF_PX_PER_M = ARENA_REF_PX_PER_M;

export type { SkillArt } from '../fx/catalog';

export type SkillVfxMode = 'auto' | 'base';
export type VfxPresentation =
  | { kind: 'base'; reason: 'forced' | 'unavailable' | 'loading' | 'failed' }
  | { kind: 'procedural'; versionId: string }
  | { kind: 'skin'; versionId: string; art: SkillArt };

/**
 * Pure presentation resolution: Base mode forces Base; a selected renderer-only version draws
 * procedurally; auto picks first fully-ready raster candidate. Never starts I/O.
 */
export function resolveVfxPresentation(skillId: string, mode: SkillVfxMode): VfxPresentation {
  if (mode === 'base') return { kind: 'base', reason: 'forced' };
  const active = activeVfxVersion(skillId);
  if (active?.renderer === 'procedural') return { kind: 'procedural', versionId: active.id };
  const candidates = vfxArtCandidates(skillId);
  if (candidates.length === 0) return { kind: 'base', reason: 'unavailable' };
  const anyPending = candidates.some((c) => c.sources.some((s) => {
    const st = getVfxAssetStatus(s);
    return st === 'idle' || st === 'loading';
  }));
  for (const c of candidates) {
    if (c.sources.length === 0) continue;
    if (c.sources.every((s) => getVfxAssetStatus(s) === 'ready')) {
      return { kind: 'skin', versionId: c.versionId, art: c.art };
    }
  }
  if (anyPending) return { kind: 'base', reason: 'loading' };
  // all settled: if any failed → failed, else unavailable (no candidates ready but not failed?)
  const anyFailed = candidates.some((c) => c.sources.some((s) => getVfxAssetStatus(s) === 'failed'));
  if (anyFailed) return { kind: 'base', reason: 'failed' };
  return { kind: 'base', reason: 'unavailable' };
}

/** Metadata-only stable envelope: max(0.6s Base tail, atlasImpactDuration across all valid versions). */
export function vfxPresentationTailSec(skillId: string): number {
  const candidates = vfxArtCandidates(skillId);
  let max = 0.6;
  for (const c of candidates) {
    const atlases = c.art.atlases ?? (c.art.atlas ? [c.art.atlas] : []);
    for (const a of atlases) {
      const d = atlasImpactDuration(a);
      if (Number.isFinite(d) && d > max) max = d;
    }
    if (c.art.atlas) {
      const d = atlasImpactDuration(c.art.atlas);
      if (Number.isFinite(d) && d > max) max = d;
    }
  }
  return max;
}

export const skillArtFor = (id: string, mode: SkillVfxMode = 'auto'): SkillArt | undefined => {
  if (mode === 'base') return undefined;
  // SSR / Node tests: no browser loader — return metadata art so geometry tests can read frames.
  // In browser, resolver is authority (Base while loading/failed).
  if (typeof window === 'undefined') return activeVfxArt(id);
  const pres = resolveVfxPresentation(id, mode);
  if (pres.kind === 'skin') return pres.art;
  return undefined;
};

/**
 * One atlas frame placed in the arena: the frame's anchor lands on the live aim point.
 *
 * Model-space placement (world metres). Paint the result under the frame's
 * world→viewport ancestor transform (`matrixAttribute(frame.worldToViewport)`),
 * never by baking CSS px into content: the native box then stays zoom-independent
 * while the visible art scales with the frame. All inputs derive from the committed
 * mark and its world aim; `screen` is accepted for call-site compatibility and ignored.
 */
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
/** Model-space minima from legacy ref-px minima through the single reference density. */
const BODY_MIN_H_M = 48 / REF_PX_PER_M;
const BODY_MIN_W_M = 24 / REF_PX_PER_M;
const LINE_MIN_M = SKILL_SHAPE_MIN_M.line;
const WIDTH_MIN_M = SKILL_SHAPE_MIN_M.width;
const DIAMETER_MIN_M = SKILL_SHAPE_MIN_M.diameter;
/** Ground texture canvas side; single source for the decal matrix default and callers. */
export const GROUND_CANVAS_PX = 2048;

/** Screen angle of a world aim through the painted frame: topdown changes flow here. */
const screenAimDeg = (worldToViewport: Affine2, directionRad: number): number => {
  const v = applyWorldVector(worldToViewport,
    fieldVectorM(Math.cos(directionRad), Math.sin(directionRad)));
  return Math.atan2(v.y, v.x) * 180 / Math.PI;
};

/**
 * Declared size policy per VFX layer. `footprint` covers the resolved area,
 * `body` scales with the shared body model, `world` uses declared decorative
 * metres, `ui` keeps CSS-pixel reads (labels). No skin input changes the policy.
 */
export type SkillArtSizePolicy = 'footprint' | 'body' | 'world' | 'ui';

/** Policy for one mark/atlas pair, derived from shape+delivery only — never a skill id. */
export function artSizePolicyFor(mark: SkillGeometry, atlas: VfxAtlas): SkillArtSizePolicy {
  if (atlas.sizePolicy) return atlas.sizePolicy;
  const authoring = atlas.authoring ?? {};
  const areaShape = mark.area.shape ?? ((mark.area.radiusM ?? 0) > 0 ? 'circle' : 'single');
  const shape = areaShape === 'line' || areaShape === 'cone'
    ? areaShape : (authoring.shape === 'circle' ? 'circle' : areaShape);
  const projectile = authoring.delivery === 'projectile' && shape !== 'line' && shape !== 'cone';
  if (projectile) return 'body';
  if (shape === 'circle') return 'footprint';
  if (shape === 'line' || shape === 'cone') return 'world';
  return 'body';
}

/**
 * Projectile sheets separate growth, flight and collision; ground sheets peak in their middle
 * frames. Playing only their exit at contact would skip the explosion and show its residue.
 */
export function atlasFrameIndex(mark: SkillGeometry, atlas: VfxAtlas): number {
  const fps = atlas.frameMs && atlas.frameMs > 0 ? 1000 / atlas.frameMs : Math.max(1, atlas.fps);
  const index = (seconds: number) => Math.floor(Math.max(0, seconds) * fps);
  const elapsed = Math.max(0, mark.phaseElapsedSec - (atlas.delaySec ?? 0));
  if (mark.phase === 'Aim' || mark.phase === 'Windup') {
    const opening = atlas.frames?.opening;
    if (opening) return clamp(opening[0] + index(elapsed), opening[0], opening[1]);
  }
  if (mark.phase === 'Travel') {
    const loop = atlas.authoring?.delivery === 'projectile' ? atlas.frames?.loop : undefined;
    if (loop) return loop[0] + (index(elapsed) % Math.max(1, loop[1] - loop[0] + 1));
    const opening = atlas.frames?.opening;
    if (opening) return clamp(opening[0] + index(elapsed), opening[0], opening[1]);
  }
  if (mark.phase === 'Impact') {
    const range = atlasImpactFrames(atlas);
    return clamp(range[0] + index(elapsed), range[0], range[1]);
  }
  if (mark.phase === 'Field' || mark.phase === 'Channel') {
    const loop = atlas.frames?.loop;
    if (loop) return loop[0] + (index(elapsed) % Math.max(1, loop[1] - loop[0] + 1));
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
  return Math.max((range[1] - range[0] + 1) * frameSec, atlas.rainDurationSec ?? 0, atlas.durationSec ?? 0) + (atlas.delaySec ?? 0);
}

/** Presentation ends with the authored fade, rather than holding the last painted frame. */
export function atlasOpacity(mark: SkillGeometry, atlas: VfxAtlas): number {
  if (atlas.phases && !atlas.phases.includes(mark.phase)) return 0;
  const elapsed = mark.phaseElapsedSec - (atlas.delaySec ?? 0);
  if (elapsed < 0) return 0;
  if (atlas.durationSec != null && elapsed >= atlas.durationSec) return 0;
  if (mark.phase === 'Aim') return 0;
  if (mark.phase === 'Windup') return atlas.authoring?.delivery === 'projectile' ? .35 + mark.progress * .4 : 0;
  if (mark.phase !== 'Impact') return 1;
  const duration = atlasImpactDuration(atlas);
  return clamp((duration - mark.phaseElapsedSec) / Math.min(.18, duration / 3), 0, 1);
}

/**
 * A content-aware placement in world metres for one atlas frame. The authored
 * `anchor` lands on the live aim point; `contentWidth/HeightRatio` fit the
 * painted content to the model (footprint/body/world per `artSizePolicyFor`)
 * instead of the frame padding. Aim rotation is opt-in per atlas: only art with
 * `orient: true` turns to the committed world aim or its release→impact line;
 * everything else stays exactly as painted in the pool. Skin art is a pure fit:
 * it never changes the hitbox, duration or timeline.
 *
 * Paint the result under the frame's world→viewport ancestor transform.
 * Model metres keep the native box zoom-independent while the visible art
 * scales with the frame; no CSS px is baked into content here.
 */
export function skillArtPlacement(mark: SkillGeometry, atlas: VfxAtlas,
  frame: FieldViewFrame, screen?: SkillGeometryScreen): SkillArtPlacement | undefined {
  void screen;
  if (!frame.renderable) return undefined;
  const authoring = atlas.authoring ?? {};
  const areaShape = mark.area.shape ?? ((mark.area.radiusM ?? 0) > 0 ? 'circle' : 'single');
  const shape = areaShape === 'line' || areaShape === 'cone'
    ? areaShape
    : (authoring.shape === 'circle' ? 'circle' : areaShape);
  const projectile = authoring.delivery === 'projectile' && shape !== 'line' && shape !== 'cone';
  const orient = atlas.orient === true;
  const direction = mark.directionRad;
  // World aim stays the footprint authority; the painted rotation follows the
  // frame basis so a topdown change turns art and telegraph together.
  const aimDeg = screenAimDeg(frame.worldToViewport, direction);
  const screenAngleOf = (from: { x: number; y: number }, to: { x: number; y: number }): number => {
    const v = applyWorldVector(frame.worldToViewport,
      fieldVectorM(to.x - from.x, to.y - from.y));
    return Math.atan2(v.y, v.x) * 180 / Math.PI;
  };
  const content = atlas.content;
  // The actor body is the size authority for directed and single art, so a 6 m line never
  // becomes a screen-sized stamp. Circles are the exception: they cover the committed footprint.
  const bodyH = Math.max(BODY_MIN_H_M, Number(mark.bodyM?.height ?? BODY_MIN_H_M));
  const bodyW = Math.max(BODY_MIN_W_M, Number(mark.bodyM?.width ?? BODY_MIN_W_M));
  const aim = mark.vfxAim;
  // Model-space release/impact: the same hand/body lift the viewport adapter applies,
  // expressed in metres so the numbers never move with zoom.
  const liftM = aim.fromSocket ? (aim.releaseLiftM ?? 0)
    : Math.max(VFX_HAND_LIFT_M, bodyH * VFX_HAND_LIFT_SHARE);
  const releaseM = { x: aim.releaseM.x, y: aim.releaseM.y - liftM };
  const groundM = { ...aim.groundImpactM };
  const impactM = aim.bodyImpact
    ? { x: groundM.x, y: groundM.y - bodyH * VFX_BODY_LIFT_SHARE } : groundM;
  let contentW = 24 / REF_PX_PER_M;
  let contentH = 20 / REF_PX_PER_M;
  let cx = impactM.x;
  let cy = impactM.y;
  let rotateDeg = 0;
  // The declared layer role is the single size authority: footprint reads the
  // committed area, world decorations read authored metres, body effects read the
  // shared body model. UI readability floors never change a world size.
  const policy = artSizePolicyFor(mark, atlas);

  if (atlas.sizePolicy === 'body' && !projectile) {
    contentW = bodyW * 2.8;
    contentH = bodyH * 1.3;
  } else if (atlas.sizePolicy === 'world' && shape !== 'line' && shape !== 'cone') {
    contentW = Number(authoring.spanM ?? authoring.diameterM ?? 1.7);
    contentH = Number(authoring.depthM ?? authoring.diameterM ?? 1.7);
  } else if (projectile) {
    const from = releaseM;
    const to = impactM;
    const progress = mark.phase === 'Travel' ? clamp(mark.progress, 0, 1)
      : mark.phase === 'Aim' || mark.phase === 'Windup' ? 0 : 1;
    cx = from.x + (to.x - from.x) * progress;
    cy = from.y + (to.y - from.y) * progress;
    // A travelling body has a stable size even when its target is far away.
    contentW = bodyH * (mark.phase === 'Impact' ? 1.45 : .95);
    contentH = bodyH * (mark.phase === 'Impact' ? 1.1 : .52);
    rotateDeg = mark.phase === 'Impact' || !orient ? 0
      : screenAngleOf(from, to);
  } else if (shape === 'line') {
    // World decoration: authored/resolved metres, never a body multiple. The
    // resolved footprint still owns the hit area; the art only fits its span.
    const length = Math.max(LINE_MIN_M, Number(authoring.lengthM ?? mark.area.lengthM ?? mark.area.radiusM ?? 1));
    const width = Math.max(WIDTH_MIN_M, Number(authoring.widthM ?? mark.area.widthM ?? 0.6));
    contentW = length;
    contentH = width;
    cx = mark.area.center.x + Math.cos(direction) * length / 2;
    cy = mark.area.center.y + Math.sin(direction) * length / 2;
    rotateDeg = orient ? aimDeg : 0;
  } else if (shape === 'cone') {
    const radius = Math.max(LINE_MIN_M, Number(authoring.radiusM ?? mark.area.radiusM ?? 1));
    const depth = Math.max(LINE_MIN_M, Number(authoring.depthM ?? radius));
    const span = Math.max(LINE_MIN_M, Number(authoring.spanM ?? (2 * radius * Math.sin((mark.area.angleDeg ?? 90) * Math.PI / 360))));
    contentW = span;
    contentH = depth;
    cx = mark.area.center.x + Math.cos(direction) * depth / 2;
    cy = mark.area.center.y + Math.sin(direction) * depth / 2;
    // Sector art is painted opening upward; rotate that axis onto the live aim,
    // but only when the atlas opts in. Otherwise the atlas stays exactly as painted.
    rotateDeg = orient ? aimDeg + 90 : 0;
  } else if (shape === 'circle') {
    const spans = groundShapeWorldPoints(mark.area);
    const xs = spans.map((point) => point.x);
    const ys = spans.map((point) => point.y);
    // The painted content covers the committed footprint. Clamping to body multiples
    // shrank wide AoE art (e.g. Thunder Storm r=3) below its own telegraph.
    contentW = Math.max(24 / REF_PX_PER_M, Math.max(...xs) - Math.min(...xs));
    contentH = Math.max(20 / REF_PX_PER_M, Math.max(...ys) - Math.min(...ys));
    cx = mark.area.center.x;
    cy = mark.area.center.y;
  } else {
    const diameter = Math.max(DIAMETER_MIN_M, Number(authoring.diameterM ?? 1.7));
    contentW = clamp(diameter, bodyW * 1.0, bodyW * 2.8);
    contentH = clamp(diameter * (authoring.delivery === 'ground' ? 1.5 : 1), bodyH * 0.5, bodyH * 1.3);
    cx = impactM.x;
    cy = impactM.y;
  }

  if (atlas.binding) {
    const point = atlas.binding === 'area' ? mark.area.center
      : atlas.binding === 'caster' ? { x: mark.source.x, y: mark.source.y - bodyH * VFX_BODY_LIFT_SHARE }
      : atlas.binding === 'target' ? { x: mark.target.x, y: mark.target.y - bodyH * VFX_BODY_LIFT_SHARE }
      : atlas.binding === 'release' ? releaseM : impactM;
    cx = point.x; cy = point.y;
  }

  // Only body-relative layers keep the body-multiple safety cap; footprint and
  // authored world layers carry their own metres. Visible clipping happens at
  // the renderer boundary (SVG overflow/frame), never by editing world size.
  const fullCapM = policy === 'body' ? bodyH * 7 : Number.POSITIVE_INFINITY;
  const fullW = clamp(contentW / ratio(content?.widthRatio), 24 / REF_PX_PER_M, fullCapM);
  const fullH = clamp(contentH / ratio(content?.heightRatio), 20 / REF_PX_PER_M, fullCapM);
  const scale = atlas.scale ?? 1;
  const anchor = (projectile && mark.phase === 'Impact' ? (atlas.impactAnchor ?? atlas.anchor) : atlas.anchor) ?? [0.5, 0.5];
  return {
    cx, cy, width: fullW * scale, height: fullH * scale,
    anchorX: clamp(anchor[0], 0, 1), anchorY: clamp(anchor[1], 0, 1),
    rotateDeg,
    mirror: (shape === 'single' && !projectile)
      ? applyWorldVector(frame.worldToViewport,
        fieldVectorM(Math.cos(mark.directionRad), Math.sin(mark.directionRad))).x < 0 : false,
  };
}

/** Project a raster sprite's root, then keep its painted axes at uniform world zoom. */
export function billboardMatrixForFrame(centerM: { x: number; y: number }, frame: FieldViewFrame): Affine2 | undefined {
  if (!frame.renderable) return undefined;
  const center = applyWorldToViewport(frame.worldToViewport, fieldPointM(centerM.x, centerM.y));
  return { a: frame.cssPixelsPerMeter, b: 0, c: 0, d: frame.cssPixelsPerMeter, e: center.x, f: center.y };
}

/** Fit source material to the actual committed boundary; the screen footprint clips its outline. */
export function groundAtlasMatrixForFrame(mark: SkillGeometry, atlas: VfxAtlas, frame: FieldViewFrame): Affine2 | undefined {
  if (!frame.renderable) return undefined;
  const points = groundShapeWorldPoints(mark.area);
  const xs = points.map(point => point.x), ys = points.map(point => point.y);
  const left = Math.min(...xs), top = Math.min(...ys);
  const widthM = Math.max(SKILL_SHAPE_MIN_M.width, Math.max(...xs) - left);
  const heightM = Math.max(SKILL_SHAPE_MIN_M.width, Math.max(...ys) - top);
  const canvasW = atlas.virtualWidth ?? atlas.width, canvasH = atlas.virtualHeight ?? atlas.height;
  const xScale = widthM / ratio(atlas.content?.widthRatio) / canvasW;
  const yScale = heightM / ratio(atlas.content?.heightRatio) / canvasH;
  const center = applyWorldToViewport(frame.worldToViewport, fieldPointM(left + widthM / 2, top + heightM / 2));
  const basis = frame.worldToViewport;
  const a = basis.a * xScale, b = basis.b * xScale, c = basis.c * yScale, d = basis.d * yScale;
  return { a, b, c, d, e: center.x - (a * canvasW + c * canvasH) / 2, f: center.y - (b * canvasW + d * canvasH) / 2 };
}

/**
 * Frame-driven ground decal matrix: scales the single topdown basis by the
 * world radius, so ground circles follow the camera elevation through the
 * frame. No second projection lives here.
 */
export function groundDecalMatrixForFrame(
  centerPx: { x: number; y: number },
  radiusM: number,
  frame: FieldViewFrame,
  canvasPx = GROUND_CANVAS_PX,
  contentRadiusRatio = 1,
): { a: number; b: number; c: number; d: number; e: number; f: number } | undefined {
  if (!frame.renderable) return undefined;
  const scaled = radiusM / Math.max(.05, contentRadiusRatio);
  const unit = 2 * scaled / canvasPx;
  const basis = frame.worldToViewport;
  const a = basis.a * unit, b = basis.b * unit, c = basis.c * unit, d = basis.d * unit;
  return { a, b, c, d,
    e: centerPx.x - (a + c) * canvasPx / 2,
    f: centerPx.y - (b + d) * canvasPx / 2 };
}
