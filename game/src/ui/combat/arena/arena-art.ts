import { pixelArenaArt } from './arena-art-pixel-v2';
import { beetleVariants } from './arena-art-beetle';

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
  frameMs: number;
  loop: boolean;
  impactMs?: number;
  /** Hand/muzzle in the untrimmed cell at the release marker, not atlas coordinates. */
  releaseSocket?: { x: number; y: number; provenance: 'measured' | 'authored-fallback' };
  /** A one-sided sheet may be mirrored by the renderer instead of duplicating its frames. */
  mirror?: boolean;
};

export type ArenaCharacterArt = {
  displayHeight: number;
  anchor: { x: number; y: number };
  pixelArt?: boolean;
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
};

export type ArenaArt = ArenaPixelSpriteSet & {
  background: { href: string; width: number; height: number };
};

/** Pixel-v2 atlas set approved for the arena runtime; the painted ground remains until its later refresh. */
export const arenaArt: ArenaArt = {
  background: { href: '/combat/arpg/forest-clearing.png', width: 1672, height: 941 },
  hero: pixelArenaArt.hero,
  species: pixelArenaArt.species,
};

/** Sprite art is selected by canonical species id; other actors retain their current art until converted. */
export function arenaArtForSpecies(speciesId: string | undefined, variant?: string): ArenaCharacterArt | null {
  if (speciesId === 'beetle' && variant && beetleVariants[variant]) return beetleVariants[variant];
  return speciesId ? arenaArt.species[speciesId] ?? null : null;
}
