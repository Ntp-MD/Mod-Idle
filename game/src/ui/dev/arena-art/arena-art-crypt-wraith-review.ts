import pack from '../../../../../art-reference/monsters/wraith/crypt-wraith/meta.json';
import { packReviewArt } from './arena-art-pack-review';

const hrefs = {
  walk: new URL('../../../../../art-reference/monsters/wraith/crypt-wraith/clips/walk.png', import.meta.url).href,
  idle: new URL('../../../../../art-reference/monsters/wraith/crypt-wraith/clips/idle.png', import.meta.url).href,
  attack: new URL('../../../../../art-reference/monsters/wraith/crypt-wraith/clips/attack.png', import.meta.url).href,
  death: new URL('../../../../../art-reference/monsters/wraith/crypt-wraith/clips/death.png', import.meta.url).href,
};

/** Draft art for the canonical wraith, which has no animation shelf yet. Loaded only by the development showcase. */
export const cryptWraithReviewArt = packReviewArt(pack, hrefs);
