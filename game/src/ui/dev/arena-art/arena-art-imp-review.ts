import demon from '../../../../../art-reference/monsters/demon/imp/little-demon/meta.json';
import { packReviewArt } from './arena-art-pack-review';

const hrefs = {
  walk: new URL('../../../../../art-reference/monsters/demon/imp/little-demon/clips/walk.png', import.meta.url).href,
  idle: new URL('../../../../../art-reference/monsters/demon/imp/little-demon/clips/idle.png', import.meta.url).href,
  attack: new URL('../../../../../art-reference/monsters/demon/imp/little-demon/clips/attack.png', import.meta.url).href,
  hurt: new URL('../../../../../art-reference/monsters/demon/imp/little-demon/clips/hit.png', import.meta.url).href,
  death: new URL('../../../../../art-reference/monsters/demon/imp/little-demon/clips/death.png', import.meta.url).href,
};

/** Draft art loaded only by the development showcase; the arena keeps its painted imp until this pack is approved. */
export const impReviewArt = packReviewArt(demon, hrefs);
