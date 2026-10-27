import spear from '../../../../../art-reference/monsters/humanoid/goblin/spear-goblin/meta.json';
import type { ArenaCharacterArt, ArenaDirection, ArenaSpriteSheet } from '../../combat/arena/arena-art';

const hrefs = {
  walk: new URL('../../../../../art-reference/monsters/humanoid/goblin/spear-goblin/clips/walk.png', import.meta.url).href,
  idle: new URL('../../../../../art-reference/monsters/humanoid/goblin/spear-goblin/clips/idle.png', import.meta.url).href,
  attack: new URL('../../../../../art-reference/monsters/humanoid/goblin/spear-goblin/clips/attack.png', import.meta.url).href,
  hurt: new URL('../../../../../art-reference/monsters/humanoid/goblin/spear-goblin/clips/hit.png', import.meta.url).href,
  death: new URL('../../../../../art-reference/monsters/humanoid/goblin/spear-goblin/clips/death.png', import.meta.url).href,
};

/** Each clip strip shares one ground line, so the pack's single lead direction serves both facings. */
function pair(name: keyof typeof hrefs): Partial<Record<ArenaDirection, ArenaSpriteSheet>> {
  const clip = spear.clips[name];
  const [frameWidth, frameHeight] = clip.cell;
  const frameMs = spear.review.frameMs[name];
  // Only the thrust has a readable contact beat; the other clips run to their last pose.
  const impactFrame = name === 'attack' ? spear.review.impactFrame.attack : undefined;
  const sheet: ArenaSpriteSheet = {
    href: hrefs[name], frameWidth, frameHeight,
    imageWidth: frameWidth * clip.frames, imageHeight: frameHeight,
    columns: clip.frames, rows: 1, frames: clip.frames,
    frameMs, loop: clip.loop, anchor: { x: .5, y: 1 },
    impactMs: impactFrame == null ? undefined : impactFrame * frameMs,
  };
  return { east: sheet, west: sheet };
}

/** Draft art loaded only by the development showcase; the approved goblin pilot stays the default. */
export const spearGoblinReviewArt: ArenaCharacterArt = {
  pixelArt: true,
  displayHeight: spear.review.displayHeight,
  anchor: { x: .5, y: 1 },
  clips: {
    idle: pair('idle'), walk: pair('walk'), attack: pair('attack'),
    hit: pair('hurt'), death: pair('death'),
  },
};
