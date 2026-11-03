import type { ArenaCharacterArt, ArenaDirection, ArenaSpriteSheet } from '../../combat/arena/arena-art';

type ClipName = 'idle' | 'walk' | 'attack' | 'hurt' | 'death';
type PackClip = { file: string; frames: number; cell: number[]; frameMs: number; loop: boolean };

/** One style-reference pack: a transparent strip per clip, uniform cells, one shared ground line.
 *  Packs that ship no recoil frame simply omit `hurt`. */
export type ArenaPack = {
  clips: { idle: PackClip; walk: PackClip; attack: PackClip; death: PackClip; hurt?: PackClip };
  review: {
    frameMs: Partial<Record<ClipName, number>>;
    impactFrame: { attack: number };
    displayHeight: number;
  };
};

export type ArenaPackHrefs = { idle: string; walk: string; attack: string; death: string; hurt?: string };

/** The pack's single lead direction serves both facings, so the same sheet is used east and west. */
export function packReviewArt(pack: ArenaPack, hrefs: ArenaPackHrefs): ArenaCharacterArt {
  const sheet = (name: ClipName): Partial<Record<ArenaDirection, ArenaSpriteSheet>> | undefined => {
    const clip = pack.clips[name];
    const href = hrefs[name as keyof ArenaPackHrefs];
    if (!clip || !href) return undefined;
    const [frameWidth, frameHeight] = clip.cell;
    const frameMs = pack.review.frameMs[name] ?? clip.frameMs;
    // Only the swing has a readable contact beat; the other clips run to their last pose.
    const impactFrame = name === 'attack' ? pack.review.impactFrame.attack : undefined;
    const art: ArenaSpriteSheet = {
      href, frameWidth, frameHeight,
      imageWidth: frameWidth * clip.frames, imageHeight: frameHeight,
      columns: clip.frames, rows: 1, frames: clip.frames,
      frameMs, loop: clip.loop, anchor: { x: .5, y: 1 },
      impactMs: impactFrame == null ? undefined : impactFrame * frameMs,
    };
    return { east: art, west: art };
  };
  const hit = sheet('hurt');
  const idle = sheet('idle'), walk = sheet('walk'), attack = sheet('attack'), death = sheet('death');
  if (!idle || !walk || !attack || !death) throw new Error(`pack ${pack.clips.idle.file} is missing a required clip`);
  return {
    pixelArt: true,
    displayHeight: pack.review.displayHeight,
    anchor: { x: .5, y: 1 },
    clips: { idle, walk, attack, death, ...(hit ? { hit } : {}) },
  };
}
