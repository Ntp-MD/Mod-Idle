import borer from './arena-art-pixel-v2/borer-beetle-animation-v1.json';
import carapace from './arena-art-pixel-v2/carapace-beetle-animation-v1.json';
import dust from './arena-art-pixel-v2/dust-beetle-animation-v1.json';
import hollow from './arena-art-pixel-v2/hollow-beetle-animation-v1.json';
import ironshell from './arena-art-pixel-v2/ironshell-beetle-animation-v1.json';
import { pilotArt, type SpriteAtlasMetadata } from './arena-art-pixel-v2';
import type { ArenaCharacterArt } from './arena-art';

type DirectionalMetadata = SpriteAtlasMetadata & {
  frames: readonly { index: number; action: string; direction: string }[];
};

/** Variant atlases contain one pose per direction in each action row. */
function variantArt(slug: string, metadata: DirectionalMetadata): ArenaCharacterArt {
  const art = pilotArt(`/combat/arpg/pixel-v2/${slug}-animation-v1.png`, metadata, 224);
  const sheet = art.clips.idle.south!;
  for (const action of ['idle', 'walk', 'attack', 'hit', 'death'] as const) {
    art.clips[action] = Object.fromEntries(metadata.frames.filter(frame => frame.action === action).map(frame => [frame.direction, {
      ...sheet, startFrame: frame.index, frames: 1,
      loop: action === 'idle' || action === 'walk',
      frameMs: action === 'attack' ? 400 : action === 'death' ? 560 : 160,
      ...(action === 'attack' ? {impactMs: 200} : {}),
    }]));
  }
  return art;
}

export const beetleVariants: Readonly<Record<string, ArenaCharacterArt>> = {
  'Dust Beetle': variantArt('dust-beetle', dust),
  'Carapace Beetle': variantArt('carapace-beetle', carapace),
  'Borer Beetle': variantArt('borer-beetle', borer),
  'Ironshell Beetle': variantArt('ironshell-beetle', ironshell),
  'Hollow Beetle': variantArt('hollow-beetle', hollow),
};
