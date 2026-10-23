/**
 * The live wiki: the same `pages.ts` the static build writes, rendered when the page opens.
 *
 *   http://localhost:5173/wiki.html        (dev)      ·      /wiki.html in a built `dist/`
 *
 * Nothing here computes a figure — `pages.ts` does, against `engine/` and `tools/data/*.json`, which
 * this entry imports through the same seam the game does (`game/src/engine/client.ts`). That is the
 * whole point of this file: a page cannot show a number the engine has since moved on from, because
 * there is no stored page to go stale. The palette arrives the same way, as the client's own
 * `styles/variables.css` text, so a colour keeps its one home.
 */

import { PAGES, pageBody, extractTokens } from './pages.ts';
import { WIKI_RUNTIME } from './runtime.ts';
import { ICONS, renderIconsGallery } from './icons-live.ts';
import tokensCss from '../styles/variables.css?inline';

const tokens = extractTokens(tokensCss);
const BY_KEY = new Map(PAGES.map((p) => [p.file.replace(/\.html$/, ''), p]));
const ICON_URL = new Map(ICONS.map((entry) => [entry.path, entry.url]));

/** One URL, one page per hash; the nav and every cross-page link are rewritten to it. */
const paint = (): void => {
  const key = (window.location.hash || '#index').slice(1);
  const p = BY_KEY.get(key) || PAGES[0];
  document.title = `${p.title} A� ModWorld Field Manual`;
  const body = pageBody(p, p.file, tokens).replace(/href="([\w-]+)\.html"/g, 'href="#$1"');
  document.body.innerHTML = body.replace(/\.\.\/\.\.\/game\/src\/icon\/([^"')]+)/g,
    (_match: string, rel: string) => ICON_URL.get(decodeURI(rel)) || `../../game/src/icon/${rel}`);
  if (key === 'icons') {
    const el = document.getElementById('icons-gallery');
    if (el) renderIconsGallery(ICONS);
  }
  // The shell's chrome binds after every paint: search, chapter menu and section tracker.
  new Function(WIKI_RUNTIME)();
  window.scrollTo(0, 0);
};

window.addEventListener('hashchange', paint);
paint();
