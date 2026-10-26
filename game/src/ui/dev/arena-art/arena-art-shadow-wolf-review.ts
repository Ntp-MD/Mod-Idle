import pack from '../../../../../art-reference/monsters/wolf/shadow-wolf/meta.json';
import { packReviewArt } from './arena-art-pack-review';

const hrefs = {
  walk: new URL('../../../../../art-reference/monsters/wolf/shadow-wolf/clips/walk.png', import.meta.url).href,
  idle: new URL('../../../../../art-reference/monsters/wolf/shadow-wolf/clips/idle.png', import.meta.url).href,
  attack: new URL('../../../../../art-reference/monsters/wolf/shadow-wolf/clips/attack.png', import.meta.url).href,
  death: new URL('../../../../../art-reference/monsters/wolf/shadow-wolf/clips/death.png', import.meta.url).href,
};

/** Draft art reviewed beside the approved wolf pilot; the arena keeps that pilot. Loaded only by the development showcase. */
export const shadowWolfReviewArt = packReviewArt(pack, hrefs);
