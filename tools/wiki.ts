/**
 * The static half of the wiki: it calls the page source and writes the result to `docs/wiki/*.html`.
 *
 *   node tools/wiki.ts build     write `docs/wiki/*.html` (rebuildable)
 *
 * The pages themselves are NOT here — they live in `game/src/wiki/pages.ts`, the same module the live
 * wiki (`game/wiki.html`) renders in the browser. This file owns the filesystem: read the client's
 * `styles/variables.css` for its `:root` block, render each page, write each file, and — for the icon
 * gallery, which a browser fills from Vite's glob — scan `game/src/icon/` and bake the same entries the
 * live wiki builds, so the page works off the disk too. A figure is therefore identical in both hosts,
 * and neither can be stale against the engine for longer than one reload.
 */

import fs from 'node:fs';
import path from 'node:path';
import { PAGES, renderDoc, extractTokens } from '../game/src/wiki/pages.ts';
import { iconEntry, GALLERY_RUNTIME } from '../game/src/wiki/icons-gallery.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'docs', 'wiki');
const ICONS = path.join(ROOT, 'game', 'src', 'icon');

/** The client's palette, read from the file that owns it — never a copy typed into a page. */
const tokens = (): string =>
  extractTokens(fs.readFileSync(path.join(ROOT, 'game', 'src', 'styles', 'variables.css'), 'utf8'));

/**
 * The icon gallery, from the shelf rather than a browser: the folder is the truth, so a sheet dropped on
 * `game/src/icon/` lands on the page at the next build. The entries are named by the same `iconEntry` the
 * live wiki calls, and the paths stay relative to `docs/wiki/`, so the page opens straight from the disk.
 */
const gallery = (page: string): string => {
  const mount = '<div id="icons-gallery"></div>';
  if (!page.includes(mount)) throw new Error('wiki: the icons page carries no #icons-gallery mount');
  const rels: string[] = [];
  const walk = (dir: string, base: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full, `${base}${entry.name}/`);
      else if (/\.(svg|png)$/i.test(entry.name)) rels.push(base + entry.name);
    }
  };
  walk(ICONS, '');
  const entries = rels
    .sort()
    .map((rel) => iconEntry(rel, `../../game/src/icon/${encodeURI(rel)}`));
  const data = `<script type="application/json" id="icons-data">${JSON.stringify(entries)}</script>`;
  return page.replace(mount, `${mount}\n${data}\n<script>${GALLERY_RUNTIME}</script>`);
};

if (process.argv[2] === 'build') {
  const css = tokens();
  fs.mkdirSync(OUT, { recursive: true });
  for (const p of PAGES) {
    const html = renderDoc(p, p.file, css);
    fs.writeFileSync(path.join(OUT, p.file), p.file === 'icons.html' ? gallery(html) : html, 'utf8');
  }
  console.log(`wrote docs/wiki/ (${PAGES.length} pages) · ${PAGES.map((p) => path.basename(p.file, '.html')).join(' · ')}`);
  console.log(`live: the same pages render in the browser at http://localhost:5173/wiki.html`);
  console.log(`open: file://${path.join(OUT, 'index.html').replace(/\\/g, '/')}`);
} else {
  console.log(`player wiki — the pages live in game/src/wiki/pages.ts and two hosts render them

  node tools/wiki.ts build           write docs/wiki/*.html as a static site
  http://localhost:5173/wiki.html    the live wiki: the same module, no rebuild, no stale figure
`);
}
