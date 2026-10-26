import pack from '../../../../../art-reference/monsters/skeleton/sword-shield/meta.json';
import { packReviewArt } from './arena-art-pack-review';

const hrefs = {
  walk: new URL('../../../../../art-reference/monsters/skeleton/sword-shield/clips/walk.png', import.meta.url).href,
  idle: new URL('../../../../../art-reference/monsters/skeleton/sword-shield/clips/idle.png', import.meta.url).href,
  attack: new URL('../../../../../art-reference/monsters/skeleton/sword-shield/clips/attack.png', import.meta.url).href,
  hurt: new URL('../../../../../art-reference/monsters/skeleton/sword-shield/clips/hit.png', import.meta.url).href,
  death: new URL('../../../../../art-reference/monsters/skeleton/sword-shield/clips/death.png', import.meta.url).href,
};

/** Draft art loaded only by the development showcase; the production 80px skeleton keeps its own sheets. */
export const skeletonSwordReviewArt = packReviewArt(pack, hrefs);
