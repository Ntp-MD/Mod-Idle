import pack from '../../../../../art-reference/monsters/skeleton/original-bone/meta.json';
import { packReviewArt } from './arena-art-pack-review';

const hrefs = {
  walk: new URL('../../../../../art-reference/monsters/skeleton/original-bone/clips/walk.png', import.meta.url).href,
  idle: new URL('../../../../../art-reference/monsters/skeleton/original-bone/clips/idle.png', import.meta.url).href,
  attack: new URL('../../../../../art-reference/monsters/skeleton/original-bone/clips/attack.png', import.meta.url).href,
  hurt: new URL('../../../../../art-reference/monsters/skeleton/original-bone/clips/hit.png', import.meta.url).href,
  death: new URL('../../../../../art-reference/monsters/skeleton/original-bone/clips/death.png', import.meta.url).href,
};

/** Draft art loaded only by the development showcase; the production skeleton keeps its own sheets. */
export const skeletonBoneReviewArt = packReviewArt(pack, hrefs);
