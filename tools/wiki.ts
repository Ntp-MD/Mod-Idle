/**
 * The static half of the wiki: it calls the page source and writes the result to `wiki/**`.
 *
 *   node tools/wiki.ts build     write `wiki/**` (git-ignored, rebuildable)
 *
 * The pages themselves are NOT here — they live in `game/src/wiki/pages.ts`, the same module the live
 * wiki (`game/wiki.html`) renders in the browser. This file owns only the filesystem: read the
 * client's `app.css` for its `:root` block, render each page, write each file. A figure is therefore
 * identical in both hosts, and neither can be stale against the engine for longer than one reload.
 */

import fs from 'node:fs';
import path from 'node:path';
import { PAGES, renderDoc, extractTokens } from '../game/src/wiki/pages.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'wiki');

/** The client's palette, read from the file that owns it — never a copy typed into a page. */
const tokens = (): string =>
  extractTokens(fs.readFileSync(path.join(ROOT, 'game', 'src', 'app.css'), 'utf8'));

if (process.argv[2] === 'build') {
  const css = tokens();
  fs.mkdirSync(OUT, { recursive: true });
  for (const p of PAGES) fs.writeFileSync(path.join(OUT, p.file), renderDoc(p, p.file, css), 'utf8');
  console.log(`wrote wiki/ (${PAGES.length} pages) · ${PAGES.map((p) => path.basename(p.file, '.html')).join(' · ')}`);
  console.log(`live: the same pages render in the browser at http://localhost:5173/wiki.html`);
  console.log(`open: file://${path.join(OUT, 'index.html').replace(/\\/g, '/')}`);
} else {
  console.log(`player wiki — the pages live in game/src/wiki/pages.ts and two hosts render them

  node tools/wiki.ts build           write wiki/** as a static site (git-ignored)
  http://localhost:5173/wiki.html    the live wiki: the same module, no rebuild, no stale figure
`);
}
