/**
 * Write the field's placement layer (`draft/map-zones.json`) for one of the town layouts
 * `draft/map-field-20x15.html` offers.
 *
 * The town coordinates are read straight out of the page's LAYOUTS block, so the file and the
 * sheet cannot disagree. Cells are derived the same way the page derives them: each town takes
 * the first three free sides in its spun order as sub-zones, and the sides left over become wild
 * zones, numbered by cell order (Wolf Cross 1 … Wolf Cross 3).
 *
 *   node draft/build-map-zones.mjs organic-d
 */

import { readFile, writeFile } from 'node:fs/promises';

const root = new URL('..', import.meta.url).pathname.replace(/^\//, '');
const page = await readFile(root + 'draft/map-field-20x15.html', 'utf8');
const out = JSON.parse(await readFile(root + 'draft/map-zones.json', 'utf8'));

const LAYOUT = process.argv[2] || 'organic-d';
const block = page.slice(page.indexOf('const LAYOUTS'), page.indexOf('const wanted'));
const found = [...block.matchAll(/"([a-z-]+)": \{ towns:\[([\s\S]*?)\]\s*\}/g)]
  .map((m) => ({ key: m[1], towns: [...m[2].matchAll(/n:"([^"]+)", q:(-?\d+), r:(-?\d+)/g)]
    .map((x) => ({ n: x[1], q: +x[2], r: +x[3] })) }))
  .find((l) => l.key === LAYOUT);
if (!found) throw new Error('no layout named ' + LAYOUT + ' in the page — have: ' +
  [...block.matchAll(/"([a-z-]+)": \{ towns:\[/g)].map((m) => m[1]).join(', '));
const T = found.towns;
if (T.length !== 18) throw new Error(LAYOUT + ' carries ' + T.length + ' towns');

const SQ3 = Math.sqrt(3), R = 34;
const PX = ([q, r]) => [SQ3 * (q + r / 2) * R, 1.5 * r * R];
const key = (q, r) => q + ',' + r;
const hd = (a, b) => {
  const dq = a[0] - b[0], dr = a[1] - b[1];
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};
const COLS = 20, ROWS = 15, raw = [];
for (let row = 0; row < ROWS; row++)
  for (let col = 0; col < COLS; col++)
    raw.push({ q: col - ((row - (row & 1)) >> 1), r: row, row, col });
let sx = 0, sy = 0;
for (const c of raw) { const [x, y] = PX([c.q, c.r]); sx += x; sy += y; }
sx /= raw.length; sy /= raw.length;
let centre = raw[0], bd = Infinity;
for (const c of raw) {
  const [x, y] = PX([c.q, c.r]);
  const d = (x - sx) ** 2 + (y - sy) ** 2;
  if (d < bd) { bd = d; centre = c; }
}
const q0 = centre.q, r0 = centre.r;
const CELLID = new Map(), ORDER = new Map();
raw.forEach(c => {
  const k = key(c.q - q0, c.r - r0);
  CELLID.set(k, String.fromCharCode(65 + c.row) + (c.col + 1));
  ORDER.set(k, c.row * 100 + c.col);
});
const inField = new Set(raw.map(c => key(c.q - q0, c.r - r0)));
const DIRS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];

const TOWNSET = new Set(T.map(t => key(t.q, t.r)));
const owner = new Map();
T.forEach((t, i) => owner.set(key(t.q, t.r), { kind: 'town', i }));
const subs = [];
T.forEach((t, i) => {
  const order = DIRS.map(d => ({ d, out: hd([t.q + d[0], t.r + d[1]], [0, 0]) }))
    .sort((a, b) => b.out - a.out).map(s => s.d);
  const start = i % 6;                       // the page spins each pod the same way
  const cand = order.slice(start).concat(order.slice(0, start))
    .filter(d => inField.has(key(t.q + d[0], t.r + d[1]))
      && !TOWNSET.has(key(t.q + d[0], t.r + d[1]))
      && !owner.has(key(t.q + d[0], t.r + d[1])));
  const picks = cand.slice(0, 3);
  if (picks.length < 3) throw new Error(t.n + ' has only ' + picks.length + ' free sides');
  subs.push(picks.map(d => key(t.q + d[0], t.r + d[1])));
  picks.forEach((d, j) => owner.set(key(t.q + d[0], t.r + d[1]), { kind: 'sub', i, j }));
});
const wild = new Map();
T.forEach((t, i) => DIRS.forEach(d => {
  const k = key(t.q + d[0], t.r + d[1]);
  if (!inField.has(k) || TOWNSET.has(k) || owner.has(k)) return;
  if (!wild.has(k)) wild.set(k, i);
}));

const terrain = new Map(out.zones.map(z => [z.name, z.subs.map(s => s.terrain)]));
out.zones = T.map((t, i) => ({
  name: t.n,
  cell: CELLID.get(key(t.q, t.r)),
  subs: subs[i].map((k, j) => ({ cell: CELLID.get(k), terrain: terrain.get(t.n)[j] })),
  wild: [...wild.keys()].filter(k => wild.get(k) === i)
    .sort((a, b) => ORDER.get(a) - ORDER.get(b))
    .map((k, n) => ({ name: t.n + ' ' + (n + 1), cell: CELLID.get(k) })),
}));
out.note = "Placement layer for the 20x15 hex field: one entry per town, holding its own cell, its three sub-zone cells and its three wild-zone cells. A cell, a terrain key and nothing else - no level band, no sub-zone name, no races, because the revamp rewrites all of those and engine.json's zone ids are reassigned with it. Entries are keyed by town name for that reason: nothing here may be keyed on an id. Cells come from the `" + LAYOUT + "` layout in draft/map-field-20x15.html (node draft/build-map-zones.mjs " + LAYOUT + "), so the sheet and this file agree.";
out.rules.join = 'sub-zone name and level band come from the content file; this file supplies the cells and the terrain only';
out.rules.layout = LAYOUT;

await writeFile(root + 'draft/map-zones.json', JSON.stringify(out, null, 2) + '\n');

const cells = out.zones.flatMap(z => [z.cell, ...z.subs.map(s => s.cell), ...z.wild.map(w => w.cell)]);
const dup = cells.filter((c, i) => cells.indexOf(c) !== i);
const bad = out.zones.filter(z => z.subs.length !== 3 || z.wild.length !== 3).map(z => z.name);
console.log('layout', LAYOUT, '· zones', out.zones.length, '· cells', cells.length, '· dup', dup.length);
console.log('zones without 3 sub + 3 wild:', bad.join(', ') || 'none');
console.log('sample:', out.zones.find(z => z.name === 'Wolf Cross'),
  '\n        ', out.zones.find(z => z.name === 'Eastgate'));
