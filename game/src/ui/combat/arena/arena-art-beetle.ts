import pool from './mob-pool.generated.json';
import { pilotArt, type SpriteAtlasMetadata } from './arena-art-pixel-v2';
import type { ArenaCharacterArt } from './arena-art';

export type DirectionalMetadata = SpriteAtlasMetadata & {
  frames?: readonly { index: number; action: string; direction: string }[];
  animationKind?: string;
};

/** Variant atlases contain one pose per direction in each action row. */
export function directionalVariantArt(href: string, metadata: DirectionalMetadata): ArenaCharacterArt {
  const art = pilotArt(href, metadata, 224);
  if (metadata.animationKind === 'side-four-frame') return art;
  const sheet = art.clips.idle.south!;
  const actions = ['idle', 'walk', 'attack', 'hit', 'death'] as const;
  const directions = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
  for (const [row, action] of actions.entries()) {
    const frames = metadata.frames?.filter(frame => frame.action === action)
      ?? directions.map((direction, column) => ({ index: row * 8 + column, direction }));
    art.clips[action] = Object.fromEntries(frames.map(frame => [frame.direction, {
      ...sheet, startFrame: frame.index, frames: 1,
      loop: action === 'idle' || action === 'walk',
      frameMs: action === 'attack' ? 400 : action === 'death' ? 560 : 160,
      ...(action === 'attack' ? {impactMs: 200} : {}),
    }]));
  }
  return art;
}

export const beetleVariants: Readonly<Record<string, ArenaCharacterArt>> = Object.fromEntries(
  Object.entries(pool.variants.beetle).map(([name, { href, metadata }]) => [name, directionalVariantArt(href, metadata)]),
);
