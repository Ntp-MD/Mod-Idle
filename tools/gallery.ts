/**
 * The art browser: scans the icon shelves and writes `art/gallery.html` — every sheet in one grid, one
 * click to blow it up, and a star to queue a library sheet for the client.
 *
 *   node tools/gallery.ts             rebuild the page (the default)
 *   node tools/gallery.ts --quiet     …and say nothing but the path
 *   node tools/gallery.ts --serve     rebuild, then serve the repo on :5269 so the star can land on disk
 *   node tools/gallery.ts --favs      print the queue `art/favs.json` holds
 *
 * Two tabs, one per shelf: `art/svg-lib/` is the library the owner picks from, and `game/src/icon/` is
 * what the client carries. The page lives in `art/` and reaches each shelf by a relative path, so it
 * opens straight from the disk with no server.
 *
 * `art/gallery.html` is a generated view: never hand-edited, always rebuildable, and the folders are the
 * truth — a sheet dropped on either shelf lands on the grid at the next build. The palette is read out of
 * `game/src/styles/variables.css` through the wiki's own token extractor, so the review page wears the
 * client's colours rather than keeping a second set.
 *
 * Each sheet is stamped with the ink it actually paints: a shelf that is mostly white silhouette carries
 * a few `currentColor` sheets, and an SVG loaded as an image resolves that to black — invisible on a dark
 * plate. The page can therefore show a sheet as the file has it or as the client paints it (a mask, which
 * reads only alpha), and filter to the sheets that are not white.
 *
 * A browser cannot move a file, so the star does not pretend to: it POSTs the queue to the `--serve`
 * endpoint, which writes `art/favs.json`, and the agent moves those sheets into `game/src/icon/` and sorts
 * them into its categories. Without the server the same button copies the list instead, so nothing is
 * trapped in the page.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { extractTokens } from '../game/src/wiki/pages.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(ROOT, 'art', 'gallery.html');
const FAVS = path.join(ROOT, 'art', 'favs.json');
const PORT = 5269;

/** The two tabs. `pick: true` is the shelf a star is offered on; `base` reaches it from `art/`. */
const SHELVES = [
  { label: 'art/svg-lib', note: 'the library to pick from', dir: path.join(ROOT, 'art/svg-lib'), base: '../art/svg-lib', pick: true },
  { label: 'game/src/icon', note: 'what the client carries', dir: path.join(ROOT, 'game/src/icon'), base: '../game/src/icon', pick: false },
];

/**
 * The ink a sheet paints when the browser loads it as an image: `c` = it asks for `currentColor` (which
 * an image cannot inherit, so it lands black), `o` = a declared paint that is not near-white, `w` = the
 * white silhouette the shelf is made of.
 */
function inkOf(file: string): string {
  const text = fs.readFileSync(file, 'utf8');
  const paints = [...text.matchAll(/(?:\bfill|\bstroke)="([^"]+)"/g)]
    .map((m) => m[1].trim().toLowerCase())
    .filter((v) => v && v !== 'none' && v !== 'transparent');
  if (paints.some((v) => v === 'currentcolor')) return 'c';
  if (!paints.length) return 'o'; // no paint declared at all is black by spec, not white
  const bright = (v: string) => {
    const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
    if (hex) {
      let s = hex[1];
      if (s.length === 3) s = s.split('').map((c) => c + c).join('');
      const n = parseInt(s, 16);
      return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255 > 0.85;
    }
    return v === 'white';
  };
  return paints.every(bright) ? 'w' : 'o';
}

type Shelf = { f: string[]; t?: string };

/** Every .svg below a directory, as `dir → { f: [file], t: ink }`; `''` is the shelf's own root. */
function scan(root: string, dir: string, into: Record<string, Shelf>): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scan(root, full, into);
    } else if (entry.name.toLowerCase().endsWith('.svg')) {
      const rel = path.relative(root, full).replace(/\\/g, '/');
      const cut = rel.lastIndexOf('/');
      const key = cut < 0 ? '' : rel.slice(0, cut);
      const group = (into[key] ||= { f: [], t: '' });
      group.f.push(cut < 0 ? rel : rel.slice(cut + 1));
      group.t += inkOf(full);
    }
  }
}

/* the game's own sheets lead each shelf: a shorter top folder sorts first, so a bare `svg` never lands
   behind `svg-lib` just because a hyphen is a lower code point than a slash */
const rank = (k: string): [number, string, string] => [k.split('/')[0].length, k.split('/')[0], k];
const shelves = SHELVES.map((s) => {
  const dirs: Record<string, Shelf> = {};
  scan(s.dir, s.dir, dirs);
  for (const g of Object.values(dirs)) {
    const pairs = g.f.map((name, i) => [name, g.t![i]]).sort((a, b) => a[0].localeCompare(b[0]));
    g.f = pairs.map((p) => p[0]);
    g.t = pairs.map((p) => p[1]).join('');
    if (/^w+$/.test(g.t)) delete g.t; // the shelf's own default needs no per-sheet mark
  }
  const keys = Object.keys(dirs).sort((a, b) => {
    const x = rank(a), y = rank(b);
    return x[0] - y[0] || x[1].localeCompare(y[1]) || x[2].localeCompare(y[2]);
  });
  return { label: s.label, note: s.note, base: s.base, pick: s.pick, dirs: Object.fromEntries(keys.map((k) => [k, dirs[k]])) };
});
const total = shelves.reduce((n, s) => n + Object.values(s.dirs).reduce((m, g) => m + g.f.length, 0), 0);
const odd = shelves.reduce((n, s) => n + Object.values(s.dirs).reduce((m, g) => m + [...(g.t || '')].filter((c) => c !== 'w').length, 0), 0);

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ModWorld · art</title>
<style>
__TOKENS__
* { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0; background: var(--bg); color: var(--text); font: 14px/1.45 var(--ui);
  display: flex; flex-direction: column; --tile: 104px; --sheet: var(--panel);
}
.bar {
  display: flex; align-items: center; gap: var(--spacing-md); flex-wrap: wrap;
  padding: .5rem .8rem; background: var(--panel); border-bottom: 1px solid var(--line);
}
.bar h1 { font-size: .95rem; margin: 0; letter-spacing: .02em; }
/* one tab per shelf: the library you pick from, and the shelf the client actually carries */
.tabs { display: flex; gap: var(--spacing-sm); }
.tabs button {
  display: flex; gap: var(--spacing-sm); align-items: baseline; padding: .28rem .65rem;
  background: none; border-color: transparent; color: var(--dim); border-radius: var(--radius-card);
}
.tabs button:hover { color: var(--text); border-color: var(--line); }
.tabs button[now] { color: var(--gold); background: var(--bg); border-color: var(--line); border-bottom-color: var(--bg); }
.tabs .n { font-family: var(--num); font-variant-numeric: tabular-nums; font-size: .74rem; color: var(--dim); }
input, select, button { font: inherit; color: var(--text); background: var(--bg); border: 1px solid var(--line); border-radius: var(--radius-card); }
input[type="search"] { padding: .3rem .6rem; width: 12rem; }
select, button { padding: .26rem .55rem; cursor: pointer; }
button:hover, select:hover { border-color: var(--gold); }
:focus-visible { outline: 2px solid var(--focus); outline-offset: 1px; }
label.k { color: var(--dim); font-size: .74rem; }
.read { color: var(--dim); font-family: var(--num); font-variant-numeric: tabular-nums; }
.favbar { display: flex; gap: var(--spacing-sm); align-items: center; }
button#favOnly[on] { color: var(--gold); border-color: var(--gold); }
button#send { color: var(--text); border-color: var(--gold); }
button#send[busy] { opacity: .6; cursor: progress; }
.sent { color: var(--good); font-size: .74rem; }
.bar-tools { display: flex; flex: 1; align-items: center; gap: var(--spacing-md); flex-wrap: wrap; min-width: 0; }
.hint { flex: none; color: var(--dim); font-size: .72rem; }
.split { flex: 1; display: flex; min-height: 0; }
.folders {
  width: 15rem; flex: none; overflow: auto; padding: .3rem 0 .8rem;
  background: var(--panel); border-right: 1px solid var(--line);
}
.folders .shelf { padding: .7rem .8rem .15rem; font-size: .78rem; color: var(--text); }
.folders .shelf em { display: block; font-style: normal; font-size: .68rem; color: var(--dim); }
.folders .grp {
  padding: .4rem .8rem .15rem .95rem; font-size: .68rem; letter-spacing: .09em;
  text-transform: uppercase; color: var(--dim);
}
.folders button {
  display: flex; justify-content: space-between; gap: var(--spacing-sm); width: 100%;
  border: 0; border-radius: var(--radius-card); background: none; color: var(--dim);
  padding: .18rem .8rem .18rem 1.35rem; text-align: left;
}
.folders button:hover { color: var(--text); background: rgba(255,255,255,.05); }
.folders button[now] { color: var(--gold); background: rgba(232,193,105,.12); }
.folders .n { font-family: var(--num); font-variant-numeric: tabular-nums; }
.stage { flex: 1; overflow: auto; padding: .8rem; }
.stage.dark { --sheet: var(--panel); }
.stage.lit { --sheet: #e7ecf3; }
.stage.check { --sheet: #d8dee8; }
.stage.check {
  --checker: linear-gradient(45deg, #9aa4b2 25%, transparent 25%, transparent 75%, #9aa4b2 75%),
    linear-gradient(45deg, #9aa4b2 25%, transparent 25%, transparent 75%, #9aa4b2 75%);
}
.grid {
  display: grid; gap: var(--spacing-sm); align-content: start;
  grid-template-columns: repeat(auto-fill, minmax(var(--tile), 1fr));
}
.tile {
  position: relative; display: flex; flex-direction: column; align-items: center; gap: var(--spacing-xs);
  padding: .3rem; border: 1px solid var(--line); border-radius: var(--radius-card); cursor: pointer;
  background: var(--sheet);
  background-image: var(--checker, none); background-size: 12px 12px; background-position: 0 0, 6px 6px;
}
.tile:hover { border-color: var(--gold); }
.tile .glyph { width: 100%; aspect-ratio: 1; }
.tile .cap {
  width: 100%; text-align: center; font-size: .66rem; color: var(--dim);
  overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
}
.stage.lit .tile .cap, .stage.check .tile .cap { color: #384152; }
/* a sheet that does not paint white gets a dot, so the odd ones are findable at a glance */
.tile.odd::after {
  content: ''; position: absolute; top: .3rem; right: .3rem; width: .42rem; height: .42rem;
  border-radius: var(--radius-round); background: var(--xp); box-shadow: 0 0 0 1px rgba(0,0,0,.4);
}
/* the star is the pick queue: it marks a library sheet for the client shelf, and moves nothing itself */
.tile .star {
  position: absolute; top: .05rem; left: .1rem; padding: 0 .18rem; border: 0; background: none;
  color: var(--dim); font-size: .85rem; line-height: 1.3; opacity: .35;
}
.tile:hover .star, .tile[faved] .star { opacity: 1; }
.tile[faved] { border-color: var(--gold); }
.tile[faved] .star { color: var(--gold); }
/* the two ways a sheet can be read: the file's own colour, or the client's mask (alpha only) */
.glyph.raw { background: var(--g) center / contain no-repeat; }
.glyph.ink { background: var(--text); -webkit-mask: var(--g) center / contain no-repeat; mask: var(--g) center / contain no-repeat; }
.stage.lit .glyph.ink, .stage.check .glyph.ink { background: #1b202a; }
.none { display: grid; justify-items: center; gap: var(--spacing-sm); padding: 2rem; color: var(--dim); text-align: center; grid-column: 1 / -1; }
.box {
  position: fixed; inset: 0; z-index: 30; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: var(--spacing-md); background: rgba(9,12,17,.94);
}
.box[hidden] { display: none; }
.box .art {
  display: flex; padding: 1.2rem; border: 1px solid var(--line); border-radius: var(--radius-card);
  background: var(--sheet); background-image: var(--checker, none); background-size: 22px 22px;
}
.box .art .glyph { width: min(58vh, 70vw); height: min(58vh, 70vw); }
.box .meta { color: var(--dim); font-family: var(--num); font-size: .8rem; text-align: center; }
.box .row { display: flex; gap: var(--spacing-md); }
.box .close { position: absolute; top: .8rem; right: .9rem; }
.box .side { position: absolute; top: 50%; transform: translateY(-50%); padding: .5rem .7rem; }
.box .prev { left: .9rem; }
.box .next { right: .9rem; }
</style>
</head>
<body>
<div class="bar">
  <h1>ModWorld · art</h1>
  <div class="bar-tools">
    <div class="tabs" id="tabs"></div>
    <input id="q" type="search" placeholder="Search a sheet…" autocomplete="off" spellcheck="false">
    <select id="ink" title="which sheets to show">
    <option value="">all ink</option>
    <option value="w">white only</option>
    <option value="n">not white</option>
    </select>
    <select id="mode" title="how to paint a sheet">
    <option value="raw">as the file</option>
    <option value="ink">ink — as the client paints</option>
    </select>
    <select id="surface" title="what to lay the sheet on">
    <option value="dark">dark sheet</option>
    <option value="lit">light sheet</option>
    <option value="check">checker</option>
    </select>
    <label class="k" for="size">tile</label>
    <input id="size" type="range" min="56" max="200" step="4" style="width:5.5rem">
    <span class="favbar">
      <button id="favOnly" title="show only the sheets you starred">★ <span id="favN">0</span></button>
      <button id="send" title="hand the starred sheets to the agent to move into game/src/icon">Move the favs</button>
      <span class="read" id="sent"></span>
    </span>
    <span class="read" id="count"></span>
  </div>
  <span class="hint">/ search · click to open · f star · ← → walk · Esc close · m ink · c sheet</span>
</div>
<div class="split">
  <nav class="folders" id="folders"></nav>
  <section class="stage dark" id="stage"><div class="grid" id="grid"></div><div id="sentinel"></div></section>
</div>
<div class="box" id="box" hidden>
  <button class="close" id="close">Close (Esc)</button>
  <button class="side prev" id="prev">←</button>
  <button class="side next" id="next">→</button>
  <div class="art" id="art"><div class="glyph raw" id="big"></div></div>
  <div class="meta" id="meta"></div>
  <div class="row"><button id="copy">Copy the path</button><button id="open">Open the file</button></div>
</div>
<script type="application/json" id="data">__DATA__</script>
<script>
const SHELVES = JSON.parse(document.getElementById('data').textContent);
const PICK = SHELVES.filter((s) => s.pick).map((s) => s.label);
const INK_NAME = { w: 'white', c: 'currentColor — paints black in an image', o: 'not a white silhouette' };
const ITEMS = SHELVES.flatMap((s) => Object.keys(s.dirs).flatMap((d) => s.dirs[d].f.map((name, i) => ({
  shelf: s.label, base: s.base, dir: d, name, ink: (s.dirs[d].t || '')[i] || 'w',
}))));
const state = { shelf: SHELVES[0].label, dir: '', q: '', ink: '', favOnly: false, mode: 'raw', surface: 'dark', tile: 104, list: [], at: -1, page: 0 };
const shelfTotal = (label) => ITEMS.filter((it) => it.shelf === label).length;
const pathOf = (it) => (it.dir ? it.dir + '/' : '') + it.name;
const dirKey = (it) => it.shelf + '/' + it.dir;
const favKey = (it) => it.shelf + '/' + pathOf(it);
const inShelf = (it) => it.shelf === state.shelf;
const canPick = (it) => PICK.includes(it.shelf);
const PAGE_SIZE = 180;

const $ = (id) => document.getElementById(id);
const grid = $('grid'), stage = $('stage'), folders = $('folders'), tabs = $('tabs');
const src = (it) => encodeURI(it.base + '/' + pathOf(it));
const byInk = (it) => !state.ink || (state.ink === 'w' ? it.ink === 'w' : it.ink !== 'w');
const byWord = (it) => !state.q || it.name.toLowerCase().includes(state.q) || it.dir.toLowerCase().includes(state.q);
const byFav = (it) => !state.favOnly || FAVS.has(favKey(it));
const byFilter = (it) => byInk(it) && byWord(it) && byFav(it);
const matches = () => ITEMS.filter((it) => inShelf(it) && (!state.dir || dirKey(it) === state.dir) && byFilter(it));

/* the pick queue lives in this browser; the button hands it to the disk, because a page cannot move a
   file and the agent is the one that sorts a sheet into a category */
let FAVS = new Set();
try { FAVS = new Set(JSON.parse(localStorage.getItem('modworld:fav') || '[]')); } catch { /* no queue yet */ }
const saveFavs = () => { try { localStorage.setItem('modworld:fav', JSON.stringify([...FAVS])); } catch { /* private mode */ } };
/* the queue tracks the shelf, not the browser: a starred sheet the agent has already moved out of the
   library is spent, so drop it on load instead of counting a pick that no longer exists */
const inLibrary = new Set(ITEMS.filter(canPick).map(favKey));
for (const k of [...FAVS]) if (!inLibrary.has(k)) FAVS.delete(k);
saveFavs();
function paintFav() {
  $('favN').textContent = String(FAVS.size);
  $('favOnly').toggleAttribute('on', state.favOnly);
}
function toggleFav(it, on) {
  const k = favKey(it);
  if (FAVS.has(k)) FAVS.delete(k); else FAVS.add(k);
  saveFavs();
  paintFav();
  if (on) on.toggleAttribute('faved', FAVS.has(k));
  if (state.favOnly) draw();
}
async function sendFavs() {
  const list = [...FAVS].sort();
  const btn = $('send');
  if (!list.length) { $('sent').textContent = 'Nothing starred yet.'; return; }
  btn.setAttribute('busy', '');
  $('sent').textContent = 'Sending…';
  try {
    const r = await fetch('http://localhost:__PORT__/favs', { method: 'POST', body: JSON.stringify({ favs: list }) });
    const j = await r.json();
    if (!j.ok) throw new Error('refused');
    $('sent').textContent = 'Queued ' + j.wrote + (j.wrote < j.sent ? ' of ' + j.sent : '') + ' — tell the agent.';
  } catch {
    const text = list.join('\\n');
    try { await navigator.clipboard.writeText(text); $('sent').textContent = 'No server — copied ' + list.length + ' instead.'; }
    catch { $('sent').textContent = 'No server running: node tools/gallery.ts --serve'; }
  }
  btn.removeAttribute('busy');
}
$('send').onclick = sendFavs;
$('favOnly').onclick = () => { state.favOnly = !state.favOnly; draw(); };

function paintTabs() {
  tabs.textContent = '';
  for (const s of SHELVES) {
    const b = document.createElement('button');
    b.textContent = s.label;
    const n = document.createElement('span'); n.className = 'n'; n.textContent = shelfTotal(s.label).toLocaleString();
    b.append(n);
    b.title = s.note;
    if (state.shelf === s.label) b.setAttribute('now', '');
    b.onclick = () => { state.shelf = s.label; state.dir = ''; draw(); };
    tabs.append(b);
  }
}

function paintFolders() {
  folders.textContent = '';
  const row = (label, key, n, title) => {
    const b = document.createElement('button');
    b.textContent = label;
    if (title) b.title = title;
    const s = document.createElement('span'); s.className = 'n'; s.textContent = n.toLocaleString();
    b.append(s);
    if (state.dir === key) b.setAttribute('now', '');
    b.onclick = () => { state.dir = key; draw(); };
    folders.append(b);
  };
  row('Everything', '', shelfTotal(state.shelf));
  const shelf = SHELVES.find((s) => s.label === state.shelf);
  const h = document.createElement('div');
  h.className = 'shelf';
  h.textContent = shelf.label;
  const em = document.createElement('em'); em.textContent = shelf.note;
  h.append(em);
  folders.append(h);
  let top = null;
  for (const d of Object.keys(shelf.dirs)) {
    const t = d.split('/')[0] || '(its own root)';
    if (t !== top) {
      top = t;
      const g = document.createElement('div'); g.className = 'grp'; g.textContent = t;
      folders.append(g);
    }
    const label = d.includes('/') ? d.slice(d.lastIndexOf('/') + 1) : (d || '· root ·');
    row(label, shelf.label + '/' + d, shelf.dirs[d].f.length, shelf.label + '/' + d);
  }
}

function tile(it) {
  const t = document.createElement('div');
  t.className = 'tile' + (it.ink === 'w' ? '' : ' odd');
  t.tabIndex = 0;
  t.setAttribute('role', 'button');
  t.title = it.shelf + '/' + pathOf(it) + ' · ' + INK_NAME[it.ink];
  if (FAVS.has(favKey(it))) t.setAttribute('faved', '');
  const g = document.createElement('div');
  g.className = 'glyph ' + state.mode;
  g.style.setProperty('--g', 'url("' + src(it) + '")');
  const cap = document.createElement('span');
  cap.className = 'cap';
  cap.textContent = it.name.replace(/\\.svg$/i, '');
  t.append(g, cap);
  if (canPick(it)) {
    const s = document.createElement('button');
    s.className = 'star';
    s.textContent = '★';
    s.title = 'Star it for the client shelf';
    s.onclick = (e) => { e.stopPropagation(); toggleFav(it, t); };
    t.prepend(s);
  }
  t.onclick = () => open(it);
  t.onkeydown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(it); }
    if (e.key === 'f' && canPick(it)) { e.preventDefault(); toggleFav(it, t); }
  };
  return t;
}

function paintGrid(reset) {
  if (reset) { grid.textContent = ''; state.page = 0; }
  const from = state.page * PAGE_SIZE;
  for (const it of state.list.slice(from, from + PAGE_SIZE)) grid.append(tile(it));
  state.page += 1;
  if (state.list.length) return;
  const why = document.createElement('div');
  why.className = 'none';
  const here = ITEMS.filter((it) => inShelf(it) && byFilter(it)).length;
  const there = ITEMS.filter((it) => !inShelf(it) && byFilter(it)).length;
  const bits = [];
  if (here) bits.push(here + ' in another folder on this tab');
  if (there) bits.push(there + ' on the other tab');
  const head = document.createElement('div');
  const inkWord = state.ink === 'w' ? 'white' : 'not white';
  head.textContent = state.favOnly && !FAVS.size
    ? 'Nothing starred yet — press f on a sheet, or click its star.'
    : state.q
      ? 'No sheet named “' + state.q + '”' + (state.dir ? ' in ' + state.dir : ' on this tab') + (bits.length ? ' — ' + bits.join(', ') + '.' : '.')
      : state.ink
        ? (state.dir ? 'No sheet in ' + state.dir : 'No sheet on this tab') + ' is ' + inkWord + (bits.length ? ' — ' + bits.join(', ') + '.' : '.')
        : 'This folder holds no sheet.';
  why.append(head);
  if (there) {
    const jump = document.createElement('button');
    jump.textContent = 'Search the other tab';
    jump.onclick = () => { state.shelf = SHELVES.find((s) => s.label !== state.shelf).label; state.dir = ''; draw(); };
    why.append(jump);
  }
  if (state.q || state.ink || state.dir || state.favOnly) {
    const clear = document.createElement('button');
    clear.textContent = 'Show everything';
    clear.onclick = () => { state.q = ''; state.ink = ''; state.dir = ''; state.favOnly = false; $('q').value = ''; $('ink').value = ''; draw(); };
    why.append(clear);
  }
  grid.append(why);
}

function draw() {
  state.list = matches();
  $('count').textContent = state.list.length.toLocaleString() + ' of ' + shelfTotal(state.shelf).toLocaleString();
  paintTabs();
  paintFolders();
  paintGrid(true);
  paintFav();
  stage.scrollTop = 0;
  writeHash();
  store();
}

/* one window at a time: both shelves in the DOM at once is a page that scrolls like syrup */
new IntersectionObserver((io) => { if (io[0].isIntersecting && state.page * PAGE_SIZE < state.list.length) paintGrid(false); }, { root: stage, rootMargin: '600px' })
  .observe($('sentinel'));

const ART = $('art'), BIG = $('big'), BOX = $('box');
let current = null;
function open(it) {
  current = it;
  state.at = state.list.indexOf(it);
  BIG.className = 'glyph ' + state.mode;
  BIG.style.setProperty('--g', 'url("' + src(it) + '")');
  $('meta').textContent = it.shelf + '/' + pathOf(it) + '  ·  ' + INK_NAME[it.ink] + (canPick(it) ? (FAVS.has(favKey(it)) ? '  ·  ★ queued' : '  ·  f to star') : '');
  BOX.hidden = false;
  $('close').focus();
}
function walk(step) {
  if (!state.list.length) return;
  open(state.list[(state.at + step + state.list.length) % state.list.length]);
}
function close() { BOX.hidden = true; current = null; }
function cycle(id, order) {
  const el = $(id);
  el.value = order[(order.indexOf(el.value) + 1) % order.length];
  el.dispatchEvent(new Event('change'));
}
function applyView() {
  stage.className = 'stage ' + state.surface;
  for (const g of grid.querySelectorAll('.glyph')) g.className = 'glyph ' + state.mode;
  if (current) BIG.className = 'glyph ' + state.mode;
  store();
}

$('close').onclick = close;
$('prev').onclick = () => walk(-1);
$('next').onclick = () => walk(1);
$('open').onclick = () => { if (current) window.open(src(current), '_blank'); };
$('copy').onclick = async () => {
  if (!current) return;
  const text = new URL(src(current), location.href).href;
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.append(ta); ta.select();
    document.execCommand('copy'); ta.remove();
  }
  $('copy').textContent = 'Copied';
  setTimeout(() => { $('copy').textContent = 'Copy the path'; }, 1200);
};
$('q').oninput = (e) => { state.q = e.target.value.trim().toLowerCase(); draw(); };
$('ink').onchange = (e) => { state.ink = e.target.value; draw(); };
$('mode').onchange = (e) => { state.mode = e.target.value; applyView(); };
$('surface').onchange = (e) => { state.surface = e.target.value; applyView(); };
$('size').oninput = (e) => { state.tile = Number(e.target.value); document.body.style.setProperty('--tile', state.tile + 'px'); store(); };
document.addEventListener('keydown', (e) => {
  const typing = document.activeElement === $('q');
  if (e.key === '/' && !typing) { e.preventDefault(); $('q').focus(); return; }
  if (e.key === 'Escape') { close(); return; }
  if (!BOX.hidden) {
    if (e.key === 'ArrowLeft') walk(-1);
    if (e.key === 'ArrowRight') walk(1);
  }
  if (!typing && e.key === 'c') cycle('surface', ['dark', 'lit', 'check']);
  if (!typing && e.key === 'm') cycle('mode', ['raw', 'ink']);
});

function store() {
  try {
    localStorage.setItem('modworld:gallery', JSON.stringify({ shelf: state.shelf, tile: state.tile, surface: state.surface, mode: state.mode }));
  } catch { /* private mode */ }
}
function writeHash() {
  const h = '#tab=' + encodeURIComponent(state.shelf) + '&dir=' + encodeURIComponent(state.dir)
    + '&q=' + encodeURIComponent(state.q) + '&ink=' + encodeURIComponent(state.ink) + (state.favOnly ? '&fav=1' : '');
  if (location.hash !== h) history.replaceState(null, '', h);
}
try {
  const saved = JSON.parse(localStorage.getItem('modworld:gallery') || '{}');
  if (saved.shelf && SHELVES.some((s) => s.label === saved.shelf)) state.shelf = saved.shelf;
  if (saved.tile) { state.tile = saved.tile; $('size').value = String(saved.tile); document.body.style.setProperty('--tile', saved.tile + 'px'); }
  if (saved.surface) { state.surface = saved.surface; $('surface').value = saved.surface; }
  if (saved.mode) { state.mode = saved.mode; $('mode').value = saved.mode; }
} catch { /* no stored view yet */ }
const hash = new URLSearchParams(location.hash.slice(1));
if (hash.get('tab') && SHELVES.some((s) => s.label === hash.get('tab'))) state.shelf = hash.get('tab');
if (hash.get('dir') && hash.get('dir').startsWith(state.shelf + '/')) state.dir = hash.get('dir');
if (hash.get('ink')) { state.ink = hash.get('ink'); $('ink').value = state.ink; }
if (hash.get('q')) { state.q = hash.get('q').toLowerCase(); $('q').value = hash.get('q'); }
if (hash.get('fav')) state.favOnly = true;
draw();
</script>
</body>
</html>
`;

const html = PAGE.replace('__TOKENS__', () => extractTokens(fs.readFileSync(path.join(ROOT, 'game', 'src', 'styles', 'variables.css'), 'utf8')))
  .replace('__DATA__', () => JSON.stringify(shelves))
  .replaceAll('__PORT__', String(PORT));

fs.writeFileSync(OUT, html, 'utf8');

/** A Windows path needs the third slash before the drive letter, or the browser reads it as a host. */
const urlOf = (p: string) => 'file://' + (/^[A-Za-z]:/.test(p) ? '/' : '') + p.replace(/\\/g, '/');

const args = process.argv.slice(2);
const report = () => {
  console.log(`art/gallery.html — ${total} sheets on ${shelves.length} tabs`);
  for (const s of shelves) {
    const n = Object.values(s.dirs).reduce((m, g) => m + g.f.length, 0);
    console.log(`  ${s.label}: ${n} in ${Object.keys(s.dirs).length} folders`);
  }
  console.log(`ink: ${total - odd} white · ${odd} not white (a dot on the tile)`);
};

/** The one thing the page cannot do itself: put the starred list on disk for the agent to move. */
function serve(): void {
  const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.css': 'text/css', '.js': 'text/javascript' };
  const server = http.createServer((req, res) => {
    const head = { 'access-control-allow-origin': '*', 'cache-control': 'no-store' };
    if (req.method === 'POST' && req.url === '/favs') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 2_000_000) req.destroy(); });
      req.on('end', () => {
        try {
          const list = JSON.parse(body).favs;
          if (!Array.isArray(list)) throw new Error('favs is not a list');
          // only library sheets, and nothing that escapes the folder — the page is not trusted input
          const sheet = /^art\/svg-lib\/[\w+~!@(),-]+(\/[\w+~!@(),-]+)*\.svg$/;
          const kept = list.filter((x: unknown) => typeof x === 'string' && sheet.test(x as string) && !(x as string).includes('..'));
          const clean = [...new Set(kept)].sort();
          fs.writeFileSync(FAVS, JSON.stringify({ sentAt: new Date().toISOString(), favs: clean }, null, 2) + '\n');
          res.writeHead(200, { ...head, 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: true, wrote: clean.length, sent: list.length }));
          console.log(`favs: ${clean.length} queued → ${path.relative(ROOT, FAVS)}${clean.length < list.length ? ` · refused ${list.length - clean.length}` : ''}`);
        } catch (e) {
          res.writeHead(400, { ...head, 'content-type': 'application/json' });
          res.end('{"ok":false}');
          console.log(`favs refused: ${(e as Error).message}`);
        }
      });
      return;
    }
    const rel = path.normalize(decodeURIComponent((req.url || '/').split('?')[0])).replace(/^([/\\])+/, '');
    const file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT + path.sep)) { res.writeHead(403); res.end('outside the repo'); return; }
    fs.readFile(file, (err, buf) => {
      if (err) { res.writeHead(404, head); res.end('not found'); return; }
      res.writeHead(200, { ...head, 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  server.listen(PORT, () => {
    report();
    console.log(`serving: http://localhost:${PORT}/art/gallery.html  (the star can now reach the disk)`);
    console.log(`file://  ${urlOf(OUT)}  still works — without the server the star copies the list`);
  });
}

if (args.includes('--favs')) {
  if (!fs.existsSync(FAVS)) { console.log('art/favs.json — nothing queued yet (star sheets, then press "Move the favs")'); }
  else {
    const q = JSON.parse(fs.readFileSync(FAVS, 'utf8')) as { sentAt: string; favs: string[] };
    console.log(`art/favs.json — ${q.favs.length} queued at ${q.sentAt}`);
    for (const f of q.favs) console.log(`  ${f}${fs.existsSync(path.join(ROOT, f)) ? '' : '  MISSING'}`);
  }
} else if (args.includes('--serve')) {
  serve();
} else {
  if (!args.includes('--quiet')) report();
  console.log(`open: ${urlOf(OUT)}`);
  if (args.includes('--quiet')) console.log(OUT);
}
