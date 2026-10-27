import pack from '../../../../../art-reference/monsters/elemental/wisp/eclipse-wisp/meta.json';
import { packReviewArt } from './arena-art-pack-review';

const hrefs = {
  walk: new URL('../../../../../art-reference/monsters/elemental/wisp/eclipse-wisp/clips/walk.png', import.meta.url).href,
  idle: new URL('../../../../../art-reference/monsters/elemental/wisp/eclipse-wisp/clips/idle.png', import.meta.url).href,
  attack: new URL('../../../../../art-reference/monsters/elemental/wisp/eclipse-wisp/clips/attack.png', import.meta.url).href,
  death: new URL('../../../../../art-reference/monsters/elemental/wisp/eclipse-wisp/clips/death.png', import.meta.url).href,
};

/** Draft art reviewed beside the wisp pilot; the arena keeps that pilot. Loaded only by the development showcase. */
export const eclipseWispReviewArt = packReviewArt(pack, hrefs);
