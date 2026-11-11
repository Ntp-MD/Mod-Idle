/**
 * One registry for skill VFX atlases and their runtime art slots.
 *
 * Assets live directly under `game/public/fx/skill-pool/<group>/<slug>/`; this file is the only place a
 * version is registered. The arena reader (`arena-skill-art.ts`) and the combat-field showcase
 * version selector both read this pool; switching a version changes the next preview/cast read.
 *
 * A version may be a single still (ground decal / upright burst) or an animated sprite sheet.
 * `frame` describes the sheet grid; the arena's atlas reader walks it at `fps`.
 */
import { isVfxPalette, type VfxPaletteId } from './palettes';
import { ARENA_DIRECTIONS } from '../../presentation/arena-camera';

export type VfxDirection = typeof ARENA_DIRECTIONS[number];
export interface VfxCameraAtlas {
  id: string;
  elevationDeg: number;
  azimuthDeg: number;
  orthographicSpanM: number;
  anchor: [number, number];
  sources: Record<VfxDirection, string>;
}

export type VfxLayerRole = 'ground' | 'upright';
export type VfxSizePolicy = 'footprint' | 'body' | 'world';
export type VfxBinding = 'area' | 'caster' | 'target' | 'contact' | 'release';
export type VfxPhase = 'Aim' | 'Windup' | 'Travel' | 'Impact' | 'Field' | 'Channel';
export type VfxPlacement =
  | { kind: 'line-series'; spacingM: number; staggerSec: number }
  | { kind: 'line-front' }
  | { kind: 'tether' }
  | { kind: 'expand'; fromScale: number }
  | { kind: 'spin'; cycleSec: number }
  | { kind: 'orbit'; cycleSec: number; radiusM: number };

/** Source pixels placed on the shared virtual canvas without resizing the painted frame. */
export interface VfxSourceFrame {
  rect: [number, number, number, number];
  offsetX: number;
  offsetY: number;
}

export interface VfxAtlasSource {
  textureWidth?: number;
  textureHeight?: number;
  virtualWidth?: number;
  virtualHeight?: number;
  sourceFrames?: VfxSourceFrame[];
}

export interface VfxFrameGrid extends VfxAtlasSource {
  /** Size of one frame in the atlas, in pixels. */
  width: number;
  height: number;
  /** Number of animation frames to play. */
  count: number;
  /** Columns in the sheet; rows are derived from count and columns when omitted. */
  columns: number;
  rows?: number;
}

export interface VfxLayer extends VfxAimMeta {
  id?: string;
  role: VfxLayerRole;
  src: string;
  frame: VfxFrameGrid;
  fps?: number;
  loop?: boolean;
  opacity?: number;
}

/** The authoring geometry a version was painted against (`meta.json` `authoringGeometry`). */
export interface VfxAuthoring {
  shape?: string;
  origin?: string;
  delivery?: string;
  radiusM?: number;
  lengthM?: number;
  widthM?: number;
  angleDeg?: number;
  spanM?: number;
  depthM?: number;
  diameterM?: number;
}

/** Authored aim metadata: where the art points, where its content sits, and its phase frames. */
export interface VfxAimMeta {
  /** Offline world-space render; select a heading, never rotate/foreshorten it again. */
  directional?: { presets: VfxCameraAtlas[] };
  posterFrame?: number;
  palette?: VfxPaletteId;
  sizePolicy?: VfxSizePolicy;
  binding?: VfxBinding;
  phases?: VfxPhase[];
  delaySec?: number;
  durationSec?: number;
  placement?: VfxPlacement;
  /** Straight-down animated ground art; apply the shared arena matrix once. */
  projection?: 'ground';
  /** Decorative staggered field playback; does not schedule damage. */
  rainDurationSec?: number;
  rainPhase?: 'Impact' | 'Field';
  rainIntervalSec?: number;
  rainSizeScale?: number;
  rainRadiusRatio?: number;
  /** Decorative spread for single-target rain; never changes the committed hit area. */
  rainSpreadM?: number;
  /** Rotate the art to the cast aim (projectile/sector art); only true opts in, false/absent leaves it screen-fixed. */
  orient?: boolean;
  /** Normalized content anchor inside the frame (0..1). The anchor lands on the live aim point. */
  anchor?: [number, number];
  /** Normalized impact point inside the frame; defaults to `anchor`. */
  impactAnchor?: [number, number];
  /** Authored frame ranges: opening, sustained loop, exit/impact. */
  frames?: { opening?: [number, number]; loop?: [number, number]; exit?: [number, number] };
  frameMs?: number;
  /** Screen-facing atlas size multiplier around its anchor; does not change gameplay geometry. */
  scale?: number;
  /** Share of the frame the painted content occupies; the rest is padding. */
  content?: { widthRatio: number; heightRatio: number };
  authoring?: VfxAuthoring;
}

export interface VfxAtlas extends VfxAimMeta, VfxAtlasSource {
  id?: string;
  opacity?: number;
  src: string;
  width: number;
  height: number;
  count: number;
  columns: number;
  rows: number;
  fps: number;
  loop: boolean;
}

/** The shape `SkillGeometryLayer` consumes for its raster pass. */
export interface SkillArt {
  /** Ground texture projected through the arena basis (straight-down authoring). */
  decal?: string;
  /** Animated atlas: ground projection is opt-in; other art uses a screen-space stamp. */
  atlas?: VfxAtlas;
  /** Simultaneous atlas layers, each retaining its own projection and playback metadata. */
  atlases?: VfxAtlas[];
  burst?: string;
  burstWidth?: number;
  decalOpacity?: number;
}

export interface VfxVersion extends VfxAimMeta {
  id: string;
  label: string;
  /** The generated pool marks the single current recipe; DEV fixtures may add explicit alternatives. */
  default?: boolean;
  /** False keeps a lab-only atlas out of the arena's still-decal renderer. */
  arena?: boolean;
  decal?: string;
  burst?: string;
  burstWidth?: number;
  decalOpacity?: number;
  layers: VfxLayer[];
}

import { SvelteMap } from 'svelte/reactivity';
import { POOL_VERSIONS } from './pool.generated';

/**
 * Skill VFX has one home: `game/public/fx/skill-pool/<group>/<skill-slug>/`.
 * The catalog only merges the generated registry; no hand-written path rows live here.
 */
export const SKILL_VFX_POOL: Record<string, VfxVersion[]> = { ...POOL_VERSIONS };

const STORAGE_KEY = 'modworld:vfx-version';
const chosen = new SvelteMap<string, string>();

function hydrateChosen() {
  chosen.clear();
  const initial = readChosen();
  for (const [k, v] of Object.entries(initial)) chosen.set(k, v);
}

function readChosen(): Record<string, string> {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    return Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, string] =>
      typeof entry[0] === 'string' && typeof entry[1] === 'string'));
  } catch {
    return {};
  }
}

function saveChosen(): void {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(chosen.entries()))); } catch { /* private mode */ }
}

hydrateChosen();
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) hydrateChosen();
  });
}

export const vfxVersionsFor = (skillId: string): readonly VfxVersion[] => SKILL_VFX_POOL[skillId] ?? [];

export function activeVfxVersionId(skillId: string): string | null {
  const versions = vfxVersionsFor(skillId);
  const wanted = chosen.get(skillId);
  return versions.some((version) => version.id === wanted) ? wanted! : versions[0]?.id ?? null;
}

export function activeVfxVersion(skillId: string): VfxVersion | null {
  const id = activeVfxVersionId(skillId);
  return id ? vfxVersionsFor(skillId).find((version) => version.id === id) ?? null : null;
}

export function setActiveVfxVersion(skillId: string, versionId: string): boolean {
  if (!vfxVersionsFor(skillId).some((version) => version.id === versionId)) return false;
  chosen.set(skillId, versionId);
  saveChosen();
  return true;
}

export interface VfxArtCandidate {
  versionId: string;
  art: SkillArt;
  sources: readonly string[];
}

function candidateSources(version: VfxVersion): string[] {
  const art = artOf(version);
  if (!art) return [];
  const srcs = new Set<string>();
  if (art.decal) srcs.add(art.decal);
  if (art.burst) srcs.add(art.burst);
  for (const a of art.atlases ?? (art.atlas ? [art.atlas] : [])) {
    srcs.add(a.src);
    for (const camera of a.directional?.presets ?? []) {
      for (const source of Object.values(camera.sources)) srcs.add(source);
    }
  }
  return [...srcs];
}

function isValidCandidate(version: VfxVersion, art?: SkillArt): boolean {
  const a = art ?? artOf(version);
  if (!a) return false;
  const sources = candidateSources(version);
  if (sources.length === 0) return false;
  const ids = new Set<string>();
  for (const meta of [version, ...version.layers]) {
    if (meta.directional) {
      const presets = meta.directional.presets;
      if (!presets.length || new Set(presets.map(p => p.id)).size !== presets.length
        || meta.projection || meta.orient || meta.placement?.kind === 'spin') return false;
      for (const p of presets) {
        if (!p.id || !Number.isFinite(p.elevationDeg) || p.elevationDeg <= 0 || p.elevationDeg > 90
          || !Number.isFinite(p.azimuthDeg) || !Number.isFinite(p.orthographicSpanM) || p.orthographicSpanM <= 0
          || p.anchor.length !== 2 || !p.anchor.every(n => Number.isFinite(n) && n >= 0 && n <= 1)
          || !ARENA_DIRECTIONS.every(d => typeof p.sources[d] === 'string' && p.sources[d].length > 0)) return false;
      }
    }
    if (meta.palette != null && !isVfxPalette(meta.palette)) return false;
    if (meta.sizePolicy != null && !['footprint', 'body', 'world'].includes(meta.sizePolicy)) return false;
    if (meta.binding != null && !['area', 'caster', 'target', 'contact', 'release'].includes(meta.binding)) return false;
    if (meta.delaySec != null && (!Number.isFinite(meta.delaySec) || meta.delaySec < 0)) return false;
    if (meta.durationSec != null && (!Number.isFinite(meta.durationSec) || meta.durationSec <= 0)) return false;
    if (meta.placement) {
      const p = meta.placement;
      if (!['line-series', 'line-front', 'spin', 'orbit', 'tether', 'expand'].includes(p.kind)) return false;
      if (p.kind === 'line-series' && (!(p.spacingM > 0) || !Number.isFinite(p.spacingM)
        || !(p.staggerSec >= 0) || !Number.isFinite(p.staggerSec))) return false;
      if (p.kind === 'line-front' && !(meta.durationSec! > 0)) return false;
      if (p.kind === 'expand' && (!(meta.durationSec! > 0) || !Number.isFinite(p.fromScale)
        || !(p.fromScale > 0 && p.fromScale <= 1))) return false;
      if ((p.kind === 'spin' || p.kind === 'orbit') && (!(p.cycleSec > 0) || !Number.isFinite(p.cycleSec))) return false;
      if (p.kind === 'orbit' && (!(p.radiusM > 0) || !Number.isFinite(p.radiusM))) return false;
    }
    if (meta.phases && (!meta.phases.length || !meta.phases.every(phase => ['Aim', 'Windup', 'Travel', 'Impact', 'Field', 'Channel'].includes(phase)))) return false;
  }
  // validate every layer frame grid / fps / rects against texture bounds
  for (const layer of version.layers) {
    if (layer.id && ids.has(layer.id)) return false;
    if (layer.id) ids.add(layer.id);
    const f = layer.frame;
    const poster = layer.posterFrame ?? version.posterFrame;
    if (poster != null && (!Number.isInteger(poster) || poster < 0 || poster >= f.count)) return false;
    if (!Number.isFinite(f.width) || !Number.isFinite(f.height) || !(f.width > 0) || !(f.height > 0)) return false;
    if (!Number.isFinite(f.count) || !(f.count >= 1) || !Number.isFinite(f.columns) || !(f.columns >= 1)) return false;
    const fps = layer.fps ?? (version as any).fps ?? 12;
    if (fps != null && (!Number.isFinite(fps) || !(fps > 0))) return false;
    if (f.rows != null && (!Number.isFinite(f.rows) || !(f.rows >= 1))) return false;
    const tw = f.textureWidth;
    const th = f.textureHeight;
    if (tw != null && (!(tw > 0) || !Number.isFinite(tw))) return false;
    if (th != null && (!(th > 0) || !Number.isFinite(th))) return false;
    // sourceFrames rects inside texture bounds when known
    if (f.sourceFrames) {
      for (const sf of f.sourceFrames) {
        const [x, y, w, h] = sf.rect;
        if (![x, y, w, h].every((n) => Number.isFinite(n)) || w <= 0 || h <= 0 || x < 0 || y < 0) return false;
        if (tw != null && x + w > tw) return false;
        if (th != null && y + h > th) return false;
        if (f.virtualWidth != null && sf.offsetX + w > f.virtualWidth) return false;
        if (f.virtualHeight != null && sf.offsetY + h > f.virtualHeight) return false;
      }
    }
    if (layer.frames) {
      for (const range of [layer.frames.opening, layer.frames.loop, layer.frames.exit]) {
        if (range) {
          if (!Array.isArray(range) || range.length !== 2 || !range.every((n) => Number.isFinite(n)) || range[0] < 0 || range[1] < range[0] || range[1] >= f.count) return false;
        }
      }
    }
  }
  // non-empty URLs
  for (const s of sources) if (!s || typeof s !== 'string') return false;
  return true;
}

/**
 * Pure metadata candidates: selected renderable first, then promoted default (default===true, else versions[0]).
 * Excludes arena:false and invalid metadata; deduplicates by versionId. No I/O, no scanning of other versions.
 */
export function vfxArtCandidates(skillId: string): readonly VfxArtCandidate[] {
  const versions = vfxVersionsFor(skillId);
  if (versions.length === 0) return [];
  const selectedId = (() => {
    const wanted = chosen.get(skillId);
    return wanted && versions.some((v) => v.id === wanted) ? wanted : null;
  })();
  const defaultVersion = versions.find((v) => v.default === true) ?? versions[0];
  const ordered: VfxVersion[] = [];
  if (selectedId) {
    const sel = versions.find((v) => v.id === selectedId);
    if (sel) ordered.push(sel);
  }
  if (defaultVersion && !ordered.some((v) => v.id === defaultVersion.id)) ordered.push(defaultVersion);

  const seen = new Set<string>();
  const out: VfxArtCandidate[] = [];
  for (const v of ordered) {
    if (seen.has(v.id)) continue;
    seen.add(v.id);
    if (v.arena === false) continue;
    const art = artOf(v);
    if (!art) continue;
    if (!isValidCandidate(v, art)) continue;
    const sources = candidateSources(v);
    if (sources.length === 0) continue;
    out.push({ versionId: v.id, art, sources });
  }
  return out;
}

/** The active raster slot for the arena renderer; undefined falls back to Base art. */
export function activeVfxArt(skillId: string): SkillArt | undefined {
  const versions = vfxVersionsFor(skillId);
  // The chosen version wins when it can render: a multi-frame atlas plays, a decal still
  // projects exactly on the footprint. Otherwise the promoted default atlas wins outright.
  const active = activeVfxVersion(skillId);
  if (active && active.arena !== false) {
    const chosen = artOf(active);
    if (chosen) return chosen;
  }
  const atlasVersion = versions.find((version) =>
    version?.arena !== false && version?.layers.some((layer) => layer.frame.count >= 1));
  if (atlasVersion) {
    const art = artOf(atlasVersion);
    if (art?.atlas) return art;
  }
  const still = versions.find((version) => version?.arena !== false && version?.decal);
  return still ? artOf(still) : undefined;
}

function artOf(version: VfxVersion): SkillArt | undefined {
  if (version.layers.filter(layer => layer.frame.count >= 1).length > 1) {
    const atlases = version.layers.filter(layer => layer.frame.count >= 1).flatMap((layer, index) => {
      const atlas = artOf({ ...version, projection: index === 0 ? version.projection : layer.projection,
        rainDurationSec: index === 0 ? version.rainDurationSec : layer.rainDurationSec,
        placement: index === 0 ? version.placement : layer.placement,
        ...layer, layers: [layer] })?.atlas;
      return atlas ? [atlas] : [];
    });
    return { atlas: atlases[0], atlases };
  }
  const layer = version.layers.find((entry) => entry.frame.count >= 1);
  if (layer) {
    const meta = { ...version, ...layer };
    return {
      atlas: {
        ...(layer.id ? { id: layer.id } : {}),
        ...(meta.palette ? { palette: meta.palette } : {}),
        ...(meta.sizePolicy ? { sizePolicy: meta.sizePolicy } : {}),
        ...(meta.binding ? { binding: meta.binding } : {}),
        ...(meta.phases ? { phases: meta.phases } : {}),
        ...(meta.delaySec != null ? { delaySec: meta.delaySec } : {}),
        ...(meta.durationSec != null ? { durationSec: meta.durationSec } : {}),
        ...(meta.placement ? { placement: meta.placement } : {}),
        ...(meta.directional ? { directional: meta.directional } : {}),
        ...(meta.posterFrame != null ? { posterFrame: meta.posterFrame } : {}),
        ...(layer.opacity != null ? { opacity: layer.opacity } : {}),
        src: layer.src,
        width: layer.frame.width,
        height: layer.frame.height,
        count: layer.frame.count,
        columns: layer.frame.columns,
        rows: layer.frame.rows ?? Math.max(1, Math.ceil(layer.frame.count / layer.frame.columns)),
        ...(layer.frame.textureWidth != null ? { textureWidth: layer.frame.textureWidth } : {}),
        ...(layer.frame.textureHeight != null ? { textureHeight: layer.frame.textureHeight } : {}),
        ...(layer.frame.virtualWidth != null ? { virtualWidth: layer.frame.virtualWidth } : {}),
        ...(layer.frame.virtualHeight != null ? { virtualHeight: layer.frame.virtualHeight } : {}),
        ...(layer.frame.sourceFrames ? { sourceFrames: layer.frame.sourceFrames } : {}),
        fps: layer.fps ?? 12,
        loop: layer.loop ?? false,
        ...(meta.projection ? { projection: meta.projection } : {}),
        ...(meta.orient != null ? { orient: meta.orient } : {}),
        ...(meta.anchor ? { anchor: meta.anchor } : {}),
        ...(meta.impactAnchor ? { impactAnchor: meta.impactAnchor } : {}),
        ...(meta.frames ? { frames: meta.frames } : {}),
        ...(meta.frameMs != null ? { frameMs: meta.frameMs } : {}),
        ...(meta.scale != null ? { scale: meta.scale } : {}),
        ...(version.rainDurationSec != null ? { rainDurationSec: version.rainDurationSec } : {}),
        ...(version.rainPhase ? { rainPhase: version.rainPhase } : {}),
        ...(version.rainIntervalSec != null ? { rainIntervalSec: version.rainIntervalSec } : {}),
        ...(version.rainSizeScale != null ? { rainSizeScale: version.rainSizeScale } : {}),
        ...(version.rainRadiusRatio != null ? { rainRadiusRatio: version.rainRadiusRatio } : {}),
        ...(version.rainSpreadM != null ? { rainSpreadM: version.rainSpreadM } : {}),
        ...(version.content ? { content: version.content } : {}),
        ...(version.authoring ? { authoring: version.authoring } : {}),
      },
    };
  }
  if (!version.decal) return undefined;
  return {
    decal: version.decal,
    ...(version.burst ? { burst: version.burst } : {}),
    ...(version.burstWidth != null ? { burstWidth: version.burstWidth } : {}),
    ...(version.decalOpacity != null ? { decalOpacity: version.decalOpacity } : {}),
  };
}
