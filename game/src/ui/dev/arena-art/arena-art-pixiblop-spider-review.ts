import pack from '../../../../../art-reference/monsters/spider/pixiblop-spider/meta.json';
import { packReviewArt } from './arena-art-pack-review';

const hrefs = {
  walk: new URL('../../../../../art-reference/monsters/spider/pixiblop-spider/clips/walk.png', import.meta.url).href,
  idle: new URL('../../../../../art-reference/monsters/spider/pixiblop-spider/clips/idle.png', import.meta.url).href,
  attack: new URL('../../../../../art-reference/monsters/spider/pixiblop-spider/clips/attack.png', import.meta.url).href,
  death: new URL('../../../../../art-reference/monsters/spider/pixiblop-spider/clips/death.png', import.meta.url).href,
};

/** Draft art reviewed beside the spider pilot; the arena keeps that pilot. Loaded only by the development showcase. */
export const pixiblopSpiderReviewArt = packReviewArt(pack, hrefs);
