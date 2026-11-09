/**
 * Body visual model in metres, normalized at the import/resolve boundary.
 *
 * Source pixels (atlas rectangles, trim offsets, roots, sockets) enter here
 * once and leave as root-relative metres. Runtime draw must not guess units
 * or rects: it reads `BodyVisual` + the per-sheet resolvers below.
 *
 * - Footprint comes from the sim (`radiusM`); pixel bounds never create it.
 * - `referenceWidthM = 2 * radiusM * visualWidthRatio` (presentation metadata).
 * - `metresPerPixel = referenceWidthM / referenceWidthPx` from the trimmed
 *   idle reference frame, never the canvas size or a per-frame re-measure.
 * - Legacy multipliers (`displayScale`, `frameScaleReferenceHeights`,
 *   `AnimationManifest.scale`) are compatibility inputs read ONCE here and
 *   never re-applied at draw time.
 */
import {
  fieldVectorM,
  lengthM,
  sourcePointPx,
  type FieldVectorM,
  type LengthM,
  type SourcePointPx,
} from '../../../presentation/view-transform';
import type {
  ArenaCharacterArt,
  ArenaSourceFrame,
  ArenaSpriteSheet,
} from './arena-art';

export const BODY_SCHEMA_VERSION = 1;

export type BodySizeName = 'player' | 'small' | 'medium' | 'large' | 'boss';

/**
 * Single owner for the body visual width ratio.
 * Do not add a second ratio table in components.
 */
export const VISUAL_WIDTH_RATIO: Readonly<Record<BodySizeName, number>> = {
  player: 1,
  small: 1,
  medium: 1.25,
  large: 1.5,
  boss: 1.8,
};

export function visualWidthRatioForSize(size: string | undefined): number {
  return (VISUAL_WIDTH_RATIO as Record<string, number>)[size ?? ''] ?? 1;
}

export type BodyVisual = Readonly<{
  assetId: string;
  schemaVersion: number;
  /** True when source metadata was missing/invalid and the icon is used. */
  fallback: boolean;
  /** Asset IDs are always reported here; never a silent component multiplier. */
  problems: readonly string[];
  radiusM: number;
  visualWidthRatio: number;
  /** Uniform source-pixel -> model-metre factor from the idle reference. */
  metresPerPixel: number;
  /** Canonical root (idle reference pose) in untrimmed source pixels. */
  rootPx: SourcePointPx;
  /** Trimmed idle reference size in source pixels. */
  referenceBoundsPx: { width: number; height: number };
  referenceWidthM: LengthM;
  referenceHeightM: LengthM;
  /** Union of every authored frame, root-relative metres. For culling/labels. */
  drawBoundsM: { left: number; top: number; right: number; bottom: number };
  visualBoundsM: { width: number; height: number };
  /** Per-sheet release sockets, sheet-root-relative metres, mirror applied. */
  releaseSocketsM: Readonly<Record<string, FieldVectorM>>;
}>;

const finitePositive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0;

function sheetList(art: ArenaCharacterArt): { key: string; sheet: ArenaSpriteSheet }[] {
  const out: { key: string; sheet: ArenaSpriteSheet }[] = [];
  for (const [clip, directions] of Object.entries(art?.clips ?? {})) {
    for (const [direction, sheet] of Object.entries(directions ?? {})) {
      if (sheet) out.push({ key: `${clip}:${direction}`, sheet: sheet as ArenaSpriteSheet });
    }
  }
  return out;
}

function referenceSheetFor(art: ArenaCharacterArt): ArenaSpriteSheet | undefined {
  const idle = (art?.clips as Record<string, Record<string, ArenaSpriteSheet> | undefined> | undefined)?.idle;
  if (idle) return idle.south ?? Object.values(idle)[0];
  for (const { sheet } of sheetList(art)) return sheet;
  return undefined;
}

function frameListOf(sheet: ArenaSpriteSheet): ArenaSourceFrame[] {
  const frames = [...(sheet?.sourceFrames ?? [])];
  for (const image of sheet?.frameImages ?? []) {
    if (image?.sourceFrame && !frames.includes(image.sourceFrame)) frames.push(image.sourceFrame);
  }
  return frames;
}

/** Trimmed idle reference frame; never the canvas size or a raised-attack frame. */
export function referenceFramePx(art: ArenaCharacterArt): ArenaSourceFrame | undefined {
  const sheet = referenceSheetFor(art);
  if (!sheet) return undefined;
  const frames = frameListOf(sheet);
  const index = sheet.startFrame ?? 0;
  return frames[index] ?? frames[0];
}

/** Root in untrimmed source pixels for one sheet (sheet anchor wins). */
export function rootPxForSheet(
  art: ArenaCharacterArt,
  sheet: ArenaSpriteSheet | undefined,
): SourcePointPx {
  const anchor = sheet?.anchor ?? art?.anchor ?? { x: 0.5, y: 1 };
  const width = sheet?.frameWidth ?? 1;
  const height = sheet?.frameHeight ?? 1;
  const x = Number.isFinite(anchor.x) ? anchor.x * width : 0.5 * width;
  const y = Number.isFinite(anchor.y) ? anchor.y * height : height;
  return sourcePointPx(x, y);
}

/** Canonical root: the idle reference pose root. */
export function canonicalRootPx(art: ArenaCharacterArt): SourcePointPx {
  return rootPxForSheet(art, referenceSheetFor(art));
}

/**
 * Validate legacy metadata at the boundary. Returns asset-ID problems;
 * unknown metadata stays fallback, never a guessed pivot or angle.
 */
export function validateArenaBodySource(art: ArenaCharacterArt | null | undefined, assetId: string): string[] {
  const problems: string[] = [];
  if (!art) {
    problems.push(`${assetId}: missing art, icon fallback`);
    return problems;
  }
  if (art.schemaVersion != null && art.schemaVersion !== BODY_SCHEMA_VERSION) {
    problems.push(`${assetId}: schemaVersion ${String(art.schemaVersion)} is not ${BODY_SCHEMA_VERSION}`);
  }
  if (art.assetId != null && art.assetId !== assetId) {
    problems.push(`${assetId}: assetId mismatch (art says ${art.assetId})`);
  }
  if (!finitePositive(art.displayHeight)) problems.push(`${assetId}: displayHeight must be finite positive`);
  const anchor = art.anchor;
  if (!anchor || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
    problems.push(`${assetId}: art anchor must be finite`);
  }
  if (art.displayScale != null && (!Number.isFinite(art.displayScale) || !(art.displayScale > 0))) {
    problems.push(`${assetId}: displayScale must be finite positive`);
  }
  if (art.frameScaleReferenceHeights) {
    for (const [clip, value] of Object.entries(art.frameScaleReferenceHeights)) {
      if (value != null && !finitePositive(value)) problems.push(`${assetId}: frameScaleReferenceHeights.${clip} must be finite positive`);
    }
  }
  const sheets = sheetList(art);
  if (!sheets.length) problems.push(`${assetId}: no sheets, icon fallback`);
  for (const { key, sheet } of sheets) {
    if (!finitePositive(sheet.frameWidth) || !finitePositive(sheet.frameHeight)) {
      problems.push(`${assetId}: sheet ${key} frame canvas must be finite positive`);
    }
    const frames = frameListOf(sheet);
    if (!frames.length) problems.push(`${assetId}: sheet ${key} has no source frames`);
    const imageWidth = sheet.imageWidth ?? sheet.frameWidth * sheet.columns;
    const imageHeight = sheet.imageHeight ?? sheet.frameHeight * sheet.rows;
    for (const [index, frame] of frames.entries()) {
      if (!frame || ![frame.x, frame.y, frame.width, frame.height].every(Number.isFinite)
        || !(frame.width > 0) || !(frame.height > 0) || frame.x < 0 || frame.y < 0) {
        problems.push(`${assetId}: sheet ${key} frame ${index} rect must be finite positive inside the image`);
        continue;
      }
      if (frame.x + frame.width > imageWidth + 1e-9 || frame.y + frame.height > imageHeight + 1e-9) {
        problems.push(`${assetId}: sheet ${key} frame ${index} exceeds its image bounds`);
      }
      if (!Number.isFinite(frame.offsetX) || !Number.isFinite(frame.offsetY)) {
        problems.push(`${assetId}: sheet ${key} frame ${index} trim offset must be finite`);
      }
    }
    const socket = sheet.releaseSocket;
    if (socket !== undefined) {
      if (!Number.isFinite(socket.x) || !Number.isFinite(socket.y)
        || socket.x < 0 || socket.y < 0
        || socket.x > sheet.frameWidth || socket.y > sheet.frameHeight
        || (socket.provenance !== 'measured' && socket.provenance !== 'authored-fallback')) {
        problems.push(`${assetId}: sheet ${key} releaseSocket is outside the untrimmed cell or has unknown provenance`);
      }
    }
  }
  return problems;
}

/**
 * Legacy `displayScale` compatibility: the approved per-species correction
 * applied ONCE inside `normalizeArenaBody`. Runtime must not multiply again.
 */
export function legacyDisplayScale(art: ArenaCharacterArt | null | undefined): number {
  return art?.displayScale ?? 1;
}

/**
 * Legacy per-clip reference heights (player upright vs fallen pose).
 * Read ONCE for frame-scale compatibility; runtime must not re-measure frames.
 */
export function legacyFrameReferenceHeights(
  art: ArenaCharacterArt | null | undefined,
): Partial<Record<'idle' | 'walk' | 'attack' | 'hit' | 'death', number>> {
  return art?.frameScaleReferenceHeights ?? {};
}

/**
 * Legacy `AnimationManifest.scale` compatibility: production manifests use
 * units 'metres' with scale 1. A non-1 scale is reported and ignored, never
 * multiplied onto an already-normalized model.
 */
export function legacyAnimationScale(manifest: { units?: unknown; scale?: unknown } | null | undefined, assetId: string): number {
  const problems: string[] = [];
  if (manifest?.units !== undefined && manifest.units !== 'metres') problems.push(`${assetId}: AnimationManifest.units must be metres`);
  if (manifest?.scale !== undefined && manifest.scale !== 1) problems.push(`${assetId}: AnimationManifest.scale must be 1, ignoring legacy multiplier`);
  void problems;
  return 1;
}

/**
 * Per-frame pose correction from the importer, before the model is built.
 * Upright clips share the idle reference; death keeps its fallen baseline.
 * Returns 1 when no legacy reference exists (mobs) — never 0/NaN.
 */
export function resolveFrameScale(
  art: ArenaCharacterArt | null | undefined,
  clip: string,
  frameHeightPx: number | undefined,
): number {
  const references = legacyFrameReferenceHeights(art);
  if (art == null) return 1;
  const upright = references.idle ?? references.walk ?? references.attack ?? references.hit;
  const reference = clip === 'death' ? (references.death ?? upright) : (references[clip as keyof typeof references] ?? upright);
  if (reference == null || frameHeightPx == null) return 1;
  if (!Number.isFinite(reference) || !Number.isFinite(frameHeightPx) || !(reference > 0) || !(frameHeightPx > 0)) return 1;
  return reference / frameHeightPx;
}

/** Mirror-aware socket in sheet-root-relative metres. Undefined stays fallback. */
export function resolveReleaseSocketM(
  sheet: ArenaSpriteSheet | undefined,
  rootPx: SourcePointPx,
  metresPerPixel: number,
): FieldVectorM | undefined {
  const socket = sheet?.releaseSocket;
  if (!socket || !rootPx || !(metresPerPixel > 0)) return undefined;
  if (!Number.isFinite(socket.x) || !Number.isFinite(socket.y)) return undefined;
  if (socket.provenance !== 'measured' && socket.provenance !== 'authored-fallback') return undefined;
  const sign = sheet?.mirror ? -1 : 1;
  return fieldVectorM((socket.x - rootPx.x) * metresPerPixel * sign, (socket.y - rootPx.y) * metresPerPixel);
}

/** Equipment/grip mount in sheet-root-relative metres, mirror-aware. */
export function resolveMountM(
  cell: { x: number; y: number } | undefined,
  rootPx: SourcePointPx,
  metresPerPixel: number,
  mirror: boolean,
): FieldVectorM | undefined {
  if (!cell || !Number.isFinite(cell.x) || !Number.isFinite(cell.y)) return undefined;
  if (!(metresPerPixel > 0)) return undefined;
  return fieldVectorM((cell.x - rootPx.x) * metresPerPixel * (mirror ? -1 : 1), (cell.y - rootPx.y) * metresPerPixel);
}

/** One import/resolve boundary: source pixels -> root-relative metres. */
export function normalizeArenaBody(
  art: ArenaCharacterArt | null | undefined,
  opts: { assetId: string; radiusM: number; bodySize?: string },
): BodyVisual {
  const { assetId } = opts;
  const problems = [...validateArenaBodySource(art, assetId)];
  const radiusM = finitePositive(opts.radiusM) ? opts.radiusM : 0.25;
  if (!finitePositive(opts.radiusM)) problems.push(`${assetId}: radiusM must be finite positive from the sim, using 0.25 fallback`);
  if (!art) {
    return fallbackBodyVisual(assetId, radiusM, opts.bodySize, problems);
  }
  // displayScale is a legacy approved correction consumed ONCE here.
  const visualWidthRatio = visualWidthRatioForSize(opts.bodySize) * (legacyDisplayScale(art) || 1);
  const refFrame = referenceFramePx(art);
  const refSheet = referenceSheetFor(art);
  const referenceWidthPx = refFrame?.width ?? refSheet?.frameWidth ?? 1;
  const referenceHeightPx = refFrame?.height ?? refSheet?.frameHeight ?? 1;
  const safeRefWidthPx = referenceWidthPx > 0 ? referenceWidthPx : 1;
  const referenceWidthM = 2 * radiusM * visualWidthRatio;
  const metresPerPixel = referenceWidthM / safeRefWidthPx;
  const referenceHeightM = (referenceHeightPx > 0 ? referenceHeightPx : safeRefWidthPx) * metresPerPixel;
  const rootPx = canonicalRootPx(art);

  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const { sheet } of sheetList(art)) {
    for (const frame of frameListOf(sheet)) {
      left = Math.min(left, (frame.offsetX - rootPx.x) * metresPerPixel);
      top = Math.min(top, (frame.offsetY - rootPx.y) * metresPerPixel);
      right = Math.max(right, (frame.offsetX + frame.width - rootPx.x) * metresPerPixel);
      bottom = Math.max(bottom, (frame.offsetY + frame.height - rootPx.y) * metresPerPixel);
    }
  }
  if (![left, top, right, bottom].every(Number.isFinite)) {
    left = -referenceWidthM / 2;
    top = -referenceHeightM;
    right = referenceWidthM / 2;
    bottom = 0;
    problems.push(`${assetId}: no measurable frames, icon envelope fallback`);
  }

  const releaseSocketsM: Record<string, FieldVectorM> = {};
  for (const { key, sheet } of sheetList(art)) {
    const socket = resolveReleaseSocketM(sheet, rootPxForSheet(art, sheet), metresPerPixel);
    if (socket) releaseSocketsM[key] = socket;
  }

  return {
    assetId,
    schemaVersion: BODY_SCHEMA_VERSION,
    fallback: false,
    problems,
    radiusM,
    visualWidthRatio,
    metresPerPixel,
    rootPx,
    referenceBoundsPx: { width: safeRefWidthPx, height: referenceHeightPx > 0 ? referenceHeightPx : safeRefWidthPx },
    referenceWidthM: lengthM(referenceWidthM),
    referenceHeightM: lengthM(referenceHeightM),
    drawBoundsM: { left, top, right, bottom },
    visualBoundsM: { width: right - left, height: bottom - top },
    releaseSocketsM,
  };
}

/** Fallback icon contract: same shape, identity reported, never pixel-sized. */
export function fallbackBodyVisual(
  assetId: string,
  radiusM: number,
  bodySize?: string,
  priorProblems: readonly string[] = [],
): BodyVisual {
  const radius = finitePositive(radiusM) ? radiusM : 0.25;
  const visualWidthRatio = visualWidthRatioForSize(bodySize);
  const referenceWidthM = 2 * radius * visualWidthRatio;
  const metresPerPixel = referenceWidthM / 256;
  const rootPx = sourcePointPx(128, 256);
  return {
    assetId,
    schemaVersion: BODY_SCHEMA_VERSION,
    fallback: true,
    problems: [...priorProblems, `${assetId}: fallback icon visual`],
    radiusM: radius,
    visualWidthRatio,
    metresPerPixel,
    rootPx,
    referenceBoundsPx: { width: 256, height: 256 },
    referenceWidthM: lengthM(referenceWidthM),
    referenceHeightM: lengthM(referenceWidthM),
    drawBoundsM: {
      left: -referenceWidthM / 2,
      top: -referenceWidthM,
      right: referenceWidthM / 2,
      bottom: 0,
    },
    visualBoundsM: { width: referenceWidthM, height: referenceWidthM },
    releaseSocketsM: {},
  };
}
