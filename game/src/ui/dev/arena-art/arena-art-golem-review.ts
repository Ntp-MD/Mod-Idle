import golem from '../../../../../art-reference/monsters/golem/stone-golem/meta.json';
import type { ArenaCharacterArt, ArenaDirection, ArenaSpriteSheet } from '../../combat/arena/arena-art';

const hrefs = {
  walk: new URL('../../../../../art-reference/monsters/golem/stone-golem/clips/walk.png', import.meta.url).href,
  idle: new URL('../../../../../art-reference/monsters/golem/stone-golem/clips/idle.png', import.meta.url).href,
  attack: new URL('../../../../../art-reference/monsters/golem/stone-golem/clips/attack.png', import.meta.url).href,
  hurt: new URL('../../../../../art-reference/monsters/golem/stone-golem/clips/hit.png', import.meta.url).href,
  death: new URL('../../../../../art-reference/monsters/golem/stone-golem/clips/death.png', import.meta.url).href,
};

/** Each clip strip shares one ground line, so the pack's single lead direction serves both facings. */
function pair(name: keyof typeof hrefs): Partial<Record<ArenaDirection, ArenaSpriteSheet>> {
  const clip = golem.clips[name];
  const [frameWidth, frameHeight] = clip.cell;
  const frameMs = golem.review.frameMs[name];
  // Only the swing has a readable contact beat; the other clips simply run to their last pose.
  const impactFrame = name === 'attack' ? golem.review.impactFrame.attack : undefined;
  const sheet: ArenaSpriteSheet = {
    href: hrefs[name], frameWidth, frameHeight,
    imageWidth: frameWidth * clip.frames, imageHeight: frameHeight,
    columns: clip.frames, rows: 1, frames: clip.frames,
    frameMs, loop: clip.loop, anchor: { x: .5, y: 1 },
    impactMs: impactFrame == null ? undefined : impactFrame * frameMs,
  };
  return { east: sheet, west: sheet };
}

/** Draft art loaded only by the development showcase; the ordinary arena keeps the painted golem. */
export const golemReviewArt: ArenaCharacterArt = {
  pixelArt: true,
  displayHeight: golem.review.displayHeight,
  anchor: { x: .5, y: 1 },
  clips: {
    idle: pair('idle'), walk: pair('walk'), attack: pair('attack'),
    hit: pair('hurt'), death: pair('death'),
  },
};
