import { pixelArenaArt } from './arena-art-pixel-v2';
import { beetleVariants } from './arena-art-beetle';

export type ArenaDirection =
  | 'south' | 'east' | 'north' | 'west'
  | 'south-east' | 'north-east' | 'north-west' | 'south-west';

export type ArenaSpriteSheet = {
  href: string;
  frameWidth: number;
  frameHeight: number;
  imageWidth?: number;
  imageHeight?: number;
  sourceFrames?: readonly { x: number; y: number; width: number; height: number; offsetX: number; offsetY: number }[];
  columns: number;
  rows: number;
  frames: number;
  startFrame?: number;
  anchor?: { x: number; y: number };
  frameMs: number;
  loop: boolean;
  impactMs?: number;
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
