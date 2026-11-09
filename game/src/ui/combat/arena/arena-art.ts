import { pixelArenaArt } from './arena-art-pixel-v2';
import { arenaGroundMaterials, type ArenaGroundMaterial } from './arena-ground-materials';

export type ArenaDirection =
  | 'south' | 'east' | 'north' | 'west'
  | 'south-east' | 'north-east' | 'north-west' | 'south-west';

export type ArenaSourceFrame = { x: number; y: number; width: number; height: number; offsetX: number; offsetY: number };

/** A standalone transparent pose PNG with its own source rectangle and untrimmed-cell sockets. */
export type ArenaSpriteFrameImage = {
  href: string;
  imageWidth: number;
  imageHeight: number;
  sourceFrame: ArenaSourceFrame;
  mainGripCell?: { x: number; y: number };
  offGripCell?: { x: number; y: number };
  /** This source pose includes its weapon/offhand pixels; suppress separate equipment layers. */
  equipmentBaked?: boolean;
};

export type ArenaSpriteSheet = {
  href: string;
  frameWidth: number;
  frameHeight: number;
  imageWidth?: number;
  imageHeight?: number;
  sourceFrames?: readonly ArenaSourceFrame[];
  /** Optional one-PNG-per-frame source. Existing atlases continue to use `href` + `sourceFrames`. */
  frameImages?: readonly ArenaSpriteFrameImage[];
  columns: number;
  rows: number;
  frames: number;
  startFrame?: number;
  anchor?: { x: number; y: number };
  mainGripCell?: { x: number; y: number };
  offGripCell?: { x: number; y: number };
  frameMs: number;
  loop: boolean;
  impactMs?: number;
  /** Hand/muzzle in the untrimmed cell at the release marker, not atlas coordinates. */
  releaseSocket?: { x: number; y: number; provenance: 'measured' | 'authored-fallback' };
  /** A one-sided sheet may be mirrored by the renderer instead of duplicating its frames. */
  mirror?: boolean;
};

export type ArenaCharacterArt = {
  /** Importer schema version; BodyVisual normalization reports mismatches. */
  schemaVersion?: number;
  /** Canonical asset identity reported in validation problems and fallbacks. */
  assetId?: string;
  displayHeight: number;
  /** Uniform presentation correction aligning the species' south idle height to the roster median. */
  displayScale?: number;
  anchor: { x: number; y: number };
  pixelArt?: boolean;
  /** Target visible source-pixel height by clip, normalized around each frame's root anchor. */
  frameScaleReferenceHeights?: Partial<Record<'idle' | 'walk' | 'attack' | 'hit' | 'death', number>>;
  clips: Record<'idle' | 'walk' | 'attack', Partial<Record<ArenaDirection, ArenaSpriteSheet>>>
    & Partial<Record<'hit' | 'death', Partial<Record<ArenaDirection, ArenaSpriteSheet>>>>;
};

const artExtents = new WeakMap<ArenaCharacterArt, { left: number; top: number; right: number; bottom: number } | null>();

/** Immutable art is scanned once, shared by every body and render frame using the same asset. */
export function arenaArtExtent(art: ArenaCharacterArt | null) {
  if (!art) return null;
  const cached = artExtents.get(art);
  if (cached !== undefined) return cached;
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const clip of Object.values(art?.clips ?? {})) {
    for (const sheet of Object.values(clip ?? {})) {
      for (const frame of sheet?.sourceFrames ?? []) {
        left = Math.min(left, frame.offsetX);
        top = Math.min(top, frame.offsetY);
        right = Math.max(right, frame.offsetX + frame.width);
        bottom = Math.max(bottom, frame.offsetY + frame.height);
      }
    }
  }
  const extent = Number.isFinite(left) ? { left, top, right, bottom } : null;
  artExtents.set(art, extent);
  return extent;
}

export type ArenaPixelSpriteSet = {
  hero: ArenaCharacterArt;
  species: Readonly<Partial<Record<string, ArenaCharacterArt>>>;
  variants: Readonly<Partial<Record<string, Readonly<Record<string, ArenaCharacterArt>>>>>;
};

export type ArenaArt = ArenaPixelSpriteSet & {
  background: ArenaGroundMaterial;
};

/** Upright pixel sprites over a top-down ground material projected by the arena camera. */
export const arenaArt: ArenaArt = {
  background: arenaGroundMaterials.forest,
  hero: pixelArenaArt.hero,
  species: pixelArenaArt.species,
  variants: pixelArenaArt.variants,
};

/** Use authored variant art when present; unavailable variants fall back to their species pawn. */
export function arenaArtForSpecies(speciesId: string | undefined, variant?: string): ArenaCharacterArt | null {
  if (!speciesId) return null;
  return variant ? arenaArt.variants[speciesId]?.[variant] ?? arenaArt.species[speciesId] ?? null
    : arenaArt.species[speciesId] ?? null;
}
