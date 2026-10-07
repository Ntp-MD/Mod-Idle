// @ts-nocheck
/**
 * Map layer — the generated field sheet (`tools/data/map.json`).
 *
 *   node tools/map.ts            help
 *   node tools/map.ts --write    write the sheet (art/svg/map/map-overlay.svg)
 *   node tools/map.ts --checks   run M1-M12, exit 1 on FAIL
 *
 * The sheet is the 20 x 15 hex field the walk graph lives on: one polygon per cell of the field,
 * tinted by the terrain that cell stands on, with a settlement mark on its own cell, one named
 * sub-zone cell and one named wild cell on each of its sides, and bare ground beyond them faded to
 * the paper. Every cell carries its id (`A1` … `O20`) and its axial key, so the client can light up
 * a plotted route by matching the keys the road module hands back — it never reads a coordinate
 * table, which M7 enforces (X33 · M7 · M10). What the cells hold — sub-zone names, level bands,
 * races — is the engine's, printed here and never typed. The river band, the terrain washes and the
 * hand-drawn backdrop of the old free-hand sheet are gone with that sheet: the field IS the terrain.
 */

import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './lib/json.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const MAP = readJson(path.join(ROOT, 'tools/data/map.json'));
const E = readJson(path.join(ROOT, 'tools/data/engine.json'));
const TOWN = readJson(path.join(ROOT, 'tools/data/town.json'));
const OUT = path.join(ROOT, 'art/svg/map/map-overlay.svg');

const F = MAP.field;
const COL = MAP.terrain_colors;
const GCOL = MAP.ground_colors;
const R = F.radius;
const SQ3 = Math.sqrt(3);
/** Two pointy-top neighbours sit SQ3*R apart and each reaches SQ3*r/2 past its centre, so r = R - GAP/SQ3. */
const HEX_R = R - F.gap / SQ3;
const PX = ([q, r]) => [SQ3 * (q + r / 2) * R, 1.5 * r * R];
const key = (q, r) => q + ',' + r;
const hd = (a, b) => {
  const dq = a[0] - b[0], dr = a[1] - b[1];
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};

const settlementIds = TOWN.settlements.map((s) => s.id);
const settlementById = (id) => TOWN.settlements.find((s) => s.id === id);
const zoneById = (id) => E.mob.zones.find((z) => z.id === id);
const roadNodes = E.road.nodes;

// ------------------------------------------------------------------ the lattice

/**
 * The field, generated the way the sheet is read: rows of columns, each row offset half a hex.
 * Axial coordinates are measured from the centre cell, which is where the starting settlement
 * stands, so they are the same numbers `engine.json` `road` holds.
 */
const raw = [];
for (let row = 0; row < F.rows; row++) {
  for (let col = 0; col < F.cols; col++) {
    raw.push({ q: col - ((row - (row & 1)) >> 1), r: row, row, col });
  }
}
let sx = 0, sy = 0;
for (const c of raw) { const [x, y] = PX([c.q, c.r]); sx += x; sy += y; }
sx /= raw.length; sy /= raw.length;
let centre = raw[0], bd = Infinity;
for (const c of raw) {
  const [x, y] = PX([c.q, c.r]);
  const d = (x - sx) ** 2 + (y - sy) ** 2;
  if (d < bd) { bd = d; centre = c; }
}
const Q0 = centre.q, R0 = centre.r;
/** cell id -> { q, r, x, y } in the engine's own axial frame, and the id a pair of coords lands on. */
const CELLS = new Map();
const CELLID = new Map();
for (const c of raw) {
  const q = c.q - Q0, r = c.r - R0;
  const id = String.fromCharCode(65 + c.row) + (c.col + 1);
  const [x, y] = PX([q, r]);
  CELLS.set(id, { q, r, x, y, row: c.row, col: c.col });
  CELLID.set(key(q, r), id);
}
const inField = (q, r) => CELLS.has(CELLID.get(key(q, r)) || '');

// ------------------------------------------------------------------ who owns what

/** terrain key -> colour, plus the blend a bare cell takes from the nearest settlement. */
const hexToRgb = (h) => { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const rgbToHex = ([r, g, b]) => '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
const SHEET_RGB = hexToRgb(F.sheet);
const toward = (hex, t) => rgbToHex(hexToRgb(hex).map((v, i) => v + (SHEET_RGB[i] - v) * t));

/**
 * The claims, in the order the file lists them: a town's own cell, its three sub-zone cells in
 * sub-zone order, and the sides left over as wild cells. Level bands and sub-zone names come from
 * the engine, read through the settlement's zone, so a cell never carries a number this file typed.
 */
const claims = new Map();
const owned = [];
for (const entry of MAP.cells) {
  const s = settlementById(entry.town);
  const zone = zoneById(s.zone);
  const at = (id) => {
    const c = CELLS.get(id);
    if (!c) throw new Error(`${entry.town} names cell ${id}, which is not on the ${F.cols} x ${F.rows} field`);
    return [c.q, c.r];
  };
  const townCell = at(entry.cell);
  claims.set(key(townCell[0], townCell[1]), { kind: 'town', town: entry.town, cell: entry.cell, zone, s });
  entry.subs.forEach((sub, j) => {
    const c = at(sub.cell);
    claims.set(key(c[0], c[1]), {
      kind: 'sub', j, town: entry.town, cell: sub.cell, terrain: sub.terrain, zone, s,
      name: (zone.subzones || [])[j] ? zone.subzones[j].name : '',
    });
  });
  entry.wild.forEach((w, j) => {
    const c = at(w.cell);
    claims.set(key(c[0], c[1]), {
      kind: 'wild', j, town: entry.town, cell: w.cell, zone, s,
      name: s.name + ' ' + (j + 1),
    });
  });
  owned.push(entry.town);
}
/** The tone a settlement spreads: the terrain most of its sub-zone cells stand on, ties to the first. */
const spreadTone = new Map();
for (const entry of MAP.cells) {
  const count = {};
  for (const sub of entry.subs) count[sub.terrain] = (count[sub.terrain] || 0) + 1;
  spreadTone.set(entry.town, entry.subs.reduce((best, sub) =>
    (count[sub.terrain] > count[best] ? sub.terrain : best), entry.subs[0].terrain));
}
const townPoints = MAP.cells.map((entry) => {
  const node = roadNodes.find((n) => n.id === entry.town);
  return { town: entry.town, q: node.q, r: node.r, tone: COL[spreadTone.get(entry.town)] };
});

// ------------------------------------------------------------------ the walk graph the sheet draws

/**
 * The hops a walker would take: the shortest set of stretches that connects every settlement, built
 * by always adding the closest town still outside. It is a drawing of the graph the simulator
 * already derives — every pair is walkable, so nothing here is a route table — and each stretch is
 * labelled in blocks, which is the engine's hex distance and nothing else.
 */
function walkGraph() {
  const T = MAP.cells.map((entry) => {
    const node = roadNodes.find((n) => n.id === entry.town);
    return { id: entry.town, q: node.q, r: node.r };
  });
  const dist = (a, b) => hd([a.q, a.r], [b.q, b.r]);
  const inTree = new Set([0]);
  const edges = [];
  while (inTree.size < T.length) {
    let best = null;
    for (const a of inTree) {
      for (let b = 0; b < T.length; b++) {
        if (inTree.has(b)) continue;
        const d = dist(T[a], T[b]);
        if (!best || d < best.d) best = { a, b, d };
      }
    }
    edges.push({ a: T[best.a].id, b: T[best.b].id, blocks: best.d });
    inTree.add(best.b);
  }
  return edges;
}
const WALK = walkGraph();

// ------------------------------------------------------------------ drawing

function hexPts(cx, cy, r = HEX_R) {
  const p = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (60 * k - 30);
    p.push((cx + r * Math.cos(a)).toFixed(1) + ',' + (cy + r * Math.sin(a)).toFixed(1));
  }
  return p.join(' ');
}

/** A name inside a hex: wrapped to the hex's width, at most three lines. */
function wrap(text, max) {
  const lines = [];
  let line = '';
  for (const w of text.split(' ')) {
    if (line && (line + ' ' + w).length > max) { lines.push(line); line = w; }
    else line = line ? line + ' ' + w : w;
  }
  if (line) lines.push(line);
  return lines;
}

const levelText = (zone) => 'Lv ' + (zone.levels || []).join('-');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function fieldGroup() {
  const bare = [];
  for (const [id, c] of CELLS) {
    if (claims.has(key(c.q, c.r))) continue;
    const near = townPoints.reduce((best, t) => {
      const d = hd([c.q, c.r], [t.q, t.r]);
      return !best || d < best.d ? { d, t } : best;
    }, null);
    bare.push({ id, d: near.d, tone: near.t.tone });
  }
  const bMin = Math.min(...bare.map((b) => b.d));
  const bMax = Math.max(...bare.map((b) => b.d));
  const bareById = new Map(bare.map((b) => [b.id, b]));
  const fade = (d) => (bMax === bMin ? 0.4
    : F.fade_near + (F.fade_far - F.fade_near) * (d - bMin) / (bMax - bMin));
  const lines = ['  <g id="field">'];
  for (const [id, c] of CELLS) {
    const k = key(c.q, c.r);
    const o = claims.get(k);
    let fill, cls;
    if (o) {
      cls = o.kind;
      fill = o.kind === 'town' ? COL.town : o.kind === 'wild' ? COL.wild : COL[o.terrain];
    } else {
      cls = 'bare';
      const b = bare.find((x) => x.id === id);
      fill = toward(b.tone, fade(b.d));
    }
    const band = o ? zoneById(o.s.zone) : null;
    const attrs = [
      `points="${hexPts(c.x, c.y)}"`,
      `class="cell ${cls}"`,
      `data-cell="${id}"`,
      `data-ax="${c.q},${c.r}"`,
      o ? `data-node="${o.town}"` : '',
      o ? `data-zone="${o.s.zone}"` : '',
      o && o.kind === 'sub' ? `data-sub="${o.j}"` : '',
      o && o.kind === 'wild' ? `data-wild="${o.j}"` : '',
      `data-terrain="${o ? (o.kind === 'sub' ? o.terrain : o.kind) : 'bare'}"`,
      band ? `data-band="${band.id - 1}" data-lo="${band.levels[0]}" data-hi="${band.levels[1]}"` : '',
      `fill="${fill}"`,
      `data-tone="${fill}"`,
      `stroke="${F.stroke}"`,
    ].filter(Boolean).join(' ');
    const title = o
      ? `<title>${esc(o.kind === 'town' ? o.s.name : o.name)} · ${esc(o.s.name)} · ${levelText(o.s && zoneById(o.s.zone))}</title>`
      : `<title>${id} · no zone yet</title>`;
    lines.push(`    <polygon ${attrs}>${title}</polygon>`);
  }
  lines.push('  </g>');
  return lines;
}

function walkGroup() {
  const lines = ['  <g id="walk">'];
  for (const e of WALK) {
    const a = CELLS.get(MAP.cells.find((c) => c.town === e.a).cell);
    const b = CELLS.get(MAP.cells.find((c) => c.town === e.b).cell);
    lines.push(`    <line class="walk" data-from="${e.a}" data-to="${e.b}" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"/>`);
    lines.push(`    <text class="walk-blk" x="${((a.x + b.x) / 2).toFixed(1)}" y="${((a.y + b.y) / 2 - 4).toFixed(1)}">${e.blocks} blk</text>`);
  }
  lines.push('  </g>');
  return lines;
}

function labelGroups() {
  const towns = [], zones = [], ids = [];
  for (const entry of MAP.cells) {
    const s = settlementById(entry.town);
    const zone = zoneById(s.zone);
    const c = CELLS.get(entry.cell);
    towns.push(`    <g class="node${s.capital ? ' capital' : ''}" data-node="${entry.town}" data-zone="${zone.id}">`
      + `<use href="#icon-town" transform="translate(${(c.x - 6.8).toFixed(1)},${(c.y - 18).toFixed(1)}) scale(0.42)"/>`
      + `<text class="place" x="${c.x.toFixed(1)}" y="${(c.y + 4).toFixed(1)}">${esc(s.name)}</text>`
      + `</g>`);
    ids.push(`    <text class="cellid" data-cell="${entry.cell}" x="${c.x.toFixed(1)}" y="${(c.y + 14).toFixed(1)}">${entry.cell}</text>`);
    const put = (cell, name, band) => {
      const h = CELLS.get(cell);
      const lines = wrap(name, 12);
      const lh = 8.4, top = h.y - ((lines.length - 1) * lh) / 2 - 9;
      zones.push(`    <g class="zonelabel" data-cell="${cell}">`
        + lines.map((l, i) => `<text class="zonename" x="${h.x.toFixed(1)}" y="${(top + i * lh).toFixed(1)}">${esc(l)}</text>`).join('')
        + `<text class="zoneband" x="${h.x.toFixed(1)}" y="${(h.y + 13).toFixed(1)}">${levelText(band)}</text>`
        + `</g>`);
      ids.push(`    <text class="cellid" data-cell="${cell}" x="${h.x.toFixed(1)}" y="${(h.y + 22).toFixed(1)}">${cell}</text>`);
    };
    entry.subs.forEach((sub, j) => put(sub.cell, ((zone.subzones || [])[j] || {}).name || sub.cell, zone));
    entry.wild.forEach((w, j) => put(w.cell, s.name + ' ' + (j + 1), zone));
  }
  for (const [id, c] of CELLS) {
    if (claims.has(key(c.q, c.r))) continue;
    ids.push(`    <text class="cellid" data-cell="${id}" x="${c.x.toFixed(1)}" y="${c.y.toFixed(1)}">${id}</text>`);
  }
  return [
    '  <g id="labels">',
    ...towns,
    ...zones,
    '  </g>',
    '  <g id="ids">',
    ...ids,
    '  </g>',
  ];
}

/** A named span of the field, printed across the middle of the cells its zones own. */
function regionGroup() {
  const lines = ['  <g id="regions">'];
  for (const r of MAP.regions) {
    const pts = r.zones.map((z) => {
      const s = TOWN.settlements.find((x) => x.zone === z);
      return s && CELLS.get((MAP.cells.find((c) => c.town === s.id) || {}).cell);
    }).filter(Boolean);
    if (!pts.length) continue;
    const x = pts.reduce((n, p) => n + p.x, 0) / pts.length;
    const y = pts.reduce((n, p) => n + p.y, 0) / pts.length;
    lines.push(`    <text class="region" data-zone="${r.zones.join(' ')}" x="${x.toFixed(1)}" y="${y.toFixed(1)}">${esc(r.name)}</text>`);
  }
  lines.push('  </g>');
  return lines;
}

/** A landmark mark on its settlement's own cell: not architecture, so it never reads as a town. */
function watermarkGroup() {
  const lines = ['  <g id="watermarks">'];
  for (const w of MAP.watermarks) {
    const entry = MAP.cells.find((c) => c.town === w.anchor);
    if (!entry) continue;
    const c = CELLS.get(entry.cell);
    // parked on the cell's upper-left rim, where it reads as ground beside the settlement mark
    const mx = (c.x - 17).toFixed(1), my = (c.y - 12).toFixed(1);
    lines.push(`    <g class="watermark watermark-${w.kind}" data-feature="${w.id}" data-anchor="${w.anchor}">`
      + `<circle cx="${mx}" cy="${my}" r="4"/>`
      + `<circle class="halo" cx="${mx}" cy="${my}" r="7"/>`
      + `<title>${esc(w.label || w.kind)}</title></g>`);
  }
  lines.push('  </g>');
  return lines;
}

function markersGroup() {
  const lines = [
    '  <!-- the client toggles these by id: the pin of the settlement you stand in, the pin of the one you walk to -->',
    '  <g id="markers">',
  ];
  for (const entry of MAP.cells) {
    const c = CELLS.get(entry.cell);
    lines.push(`    <g class="pin" data-node="${entry.town}"><circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="16"/><circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="7"/></g>`);
  }
  lines.push('  </g>');
  return lines;
}

function viewBox() {
  const xs = [...CELLS.values()].map((c) => c.x), ys = [...CELLS.values()].map((c) => c.y);
  const padX = (SQ3 * R) / 2 + 1, padY = R + 1;
  const vx = Math.min(...xs) - padX, vy = Math.min(...ys) - padY;
  const vw = Math.max(...xs) + padX - vx, vh = Math.max(...ys) + padY - vy;
  return { vx, vy, vw, vh };
}

/**
 * The ground the field lies on: the same hex lattice, drawn on past the field so zooming out never
 * reaches an edge — pretending to be terrain, not a flat paper, so the field reads as one region of a
 * larger world. The tone is not picked per hex: a value noise, smoothed and periodic over the tile,
 * gives every hex a height, and the height walks the `ground_colors` ramp — so neighbours share a tone,
 * the hues drift instead of scattering, and the ground reads as country rather than confetti. The tile
 * and the field share the one lattice, so the ground lines up with the cells, not behind them.
 */
function hexGridDefs() {
  const keys = Object.keys(GCOL);
  const N = 8, G = 4;                        // hexes per tile edge, control points per edge
  const w = N * SQ3 * R, h = N * 1.5 * R;
  // the ground closes half the seam the cells keep, so it reads as country and not as a mesh
  const gr = R - F.gap / (2 * SQ3);
  const wrap = (v: number, m: number) => ((v % m) + m) % m;
  const rnd = (cx: number, cy: number) => {
    let k = Math.imul(wrap(cx, G), 374761393) + Math.imul(wrap(cy, G), 668265263) + 2654435761;
    k = Math.imul(k ^ (k >>> 13), 1274126177);
    return ((k >>> 8) & 0xffff) / 0xffff;
  };
  const smooth = (t: number) => t * t * (3 - 2 * t);
  /** the height at a lattice point, periodic with the tile so the ground cannot seam */
  const field = (i: number, j: number) => {
    const u = (wrap(i, N) / N) * G, v = (wrap(j, N) / N) * G;
    const c = Math.floor(u), r = Math.floor(v);
    const fu = smooth(u - c), fv = smooth(v - r);
    const top = rnd(c, r) + (rnd(c + 1, r) - rnd(c, r)) * fu;
    const bot = rnd(c, r + 1) + (rnd(c + 1, r + 1) - rnd(c, r + 1)) * fu;
    return top + (bot - top) * fv;
  };
  const hexes = [];
  for (let j = -1; j <= N; j++) {
    for (let i = -1; i <= N; i++) {
      const k = Math.min(keys.length - 1, Math.floor(field(i, j) * keys.length));
      const cx = SQ3 * R * (i + (j & 1) / 2), cy = 1.5 * R * j;
      // a path, not a polygon: M10 counts the sheet's polygons as its cells, and the ground is not one
      hexes.push(`      <path d="M${hexPts(cx, cy, gr).split(' ').join('L')}Z" fill="${GCOL[keys[k]]}"/>`);
    }
  }
  return [
    `    <pattern id="hexgrid" width="${w.toFixed(1)}" height="${h.toFixed(1)}" patternUnits="userSpaceOnUse">`,
    ...hexes,
    '    </pattern>',
  ];
}
/** How many fields of ground are laid past each edge — enough that the frame is hexes at the lowest zoom. */
const GROUND_SPAN = 5;
function groundRects(v) {
  const x = v.vx - GROUND_SPAN * v.vw, y = v.vy - GROUND_SPAN * v.vh;
  const box = `x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(v.vw * (2 * GROUND_SPAN + 1)).toFixed(1)}" height="${(v.vh * (2 * GROUND_SPAN + 1)).toFixed(1)}"`;
  return [
    `  <rect class="paper" ${box} fill="${F.sheet}"/>`,
    `  <rect ${box} fill="url(#hexgrid)"/>`,
  ];
}

function write() {
  const v = viewBox();
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<!-- GENERATED by tools/map.ts from tools/data/map.json — do not hand-edit. One polygon per cell of the ${F.cols} x ${F.rows} field; the content in the cells is the engine's. -->`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${v.vx.toFixed(1)} ${v.vy.toFixed(1)} ${v.vw.toFixed(1)} ${v.vh.toFixed(1)}" width="${Math.round(v.vw)}" height="${Math.round(v.vh)}" font-family="Inter, 'Segoe UI', system-ui, sans-serif">`,
    '  <defs>',
    '    <g id="icon-town" fill="none" stroke="#f0e5cb" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">',
    ...['M3 15 16 4l13 11M6 13v15h20V13M12 28v-9h8v9', 'M9 15h3M20 15h3', 'M16 4V2'].map((d) => `      <path d="${d}"/>`),
    '    </g>',
    ...hexGridDefs(),
    '  </defs>',
    ...groundRects(v),
    ...fieldGroup(),
    ...walkGroup(),
    ...watermarkGroup(),
    ...regionGroup(),
    ...labelGroups(),
    ...markersGroup(),
    '</svg>',
    '',
  ];
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, lines.join('\n'));
  const subs = MAP.cells.reduce((n, c) => n + c.subs.length, 0);
  const wild = MAP.cells.reduce((n, c) => n + c.wild.length, 0);
  console.log(`wrote ${path.relative(ROOT, OUT)} · ${CELLS.size} cells of a ${F.cols} x ${F.rows} field · ${MAP.cells.length} settlements · ${subs} sub-zone cells · ${wild} wild cells · ${WALK.length} walk stretches / ${WALK.reduce((n, e) => n + e.blocks, 0)} blocks · ${Math.round(v.vw)}x${Math.round(v.vh)} (ratio ${(v.vw / v.vh).toFixed(4)})`);
}

// ------------------------------------------------------------------ the gate

/** Nothing under engine/ or game/src/ may read a coordinate table (X33). */
function sources(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sources(p, out);
    else if (/\.(ts|js|svelte)$/.test(e.name)) out.push(p);
  }
  return out;
}

function checks() {
  const problems = [];
  const cellOf = (id) => { const e = MAP.cells.find((c) => c.town === id); return e && e.cell; };
  // M1 · every settlement owns exactly one cell entry, and no entry is a stranger
  for (const id of settlementIds) if (!cellOf(id)) problems.push(`no field cell for settlement ${id}`);
  for (const c of MAP.cells) if (!settlementIds.includes(c.town)) problems.push(`field cell entry ${c.town} is not a settlement`);
  if (MAP.cells.length !== settlementIds.length) problems.push(`${MAP.cells.length} cell entries for ${settlementIds.length} settlements`);
  // M2 · every claimed cell is in the field, and no cell is claimed twice
  const seen = new Map();
  for (const c of MAP.cells) {
    for (const [cell, kind] of [[c.cell, 'town'], ...c.subs.map((s) => [s.cell, 'sub']), ...c.wild.map((w) => [w.cell, 'wild'])]) {
      if (!CELLS.has(cell)) { problems.push(`${c.town} ${kind} cell ${cell} is outside the ${F.cols} x ${F.rows} field`); continue; }
      if (seen.has(cell)) problems.push(`cell ${cell} claimed by ${seen.get(cell)} and ${c.town} ${kind}`);
      seen.set(cell, `${c.town} ${kind}`);
    }
  }
  // M3 · the sheet and the walk graph are the same lattice: each settlement's cell is where its
  //        axial coordinates land, and no two settlements share a cell.
  for (const c of MAP.cells) {
    const node = roadNodes.find((n) => n.id === c.town);
    if (!node) { problems.push(`the walk graph has no node for settlement ${c.town}`); continue; }
    if (!Number.isInteger(node.q) || !Number.isInteger(node.r)) problems.push(`walk node ${c.town} is not on the hex lattice`);
    const at = CELLID.get(key(node.q, node.r));
    if (at !== c.cell) problems.push(`settlement ${c.town}: the sheet says ${c.cell}, the walk graph's ${node.q},${node.r} is ${at || 'off the field'}`);
  }
  if (roadNodes.length !== settlementIds.length) problems.push(`${roadNodes.length} walk nodes for ${settlementIds.length} settlements`);
  // M4 · every terrain key a cell names is a declared colour
  for (const c of MAP.cells) for (const s of c.subs) {
    if (!COL[s.terrain]) problems.push(`${c.town} sub cell ${s.cell} says terrain "${s.terrain}", which has no colour`);
  }
  // M5 · every declared colour is drawn somewhere: a terrain on a cell, a ground colour on the ground
  for (const kind of Object.keys(COL)) {
    const used = MAP.cells.some((c) => c.subs.some((s) => s.terrain === kind)) || ['town', 'wild'].includes(kind);
    if (!used) problems.push(`terrain colour "${kind}" is declared but no cell stands on it`);
  }
  let groundSvg = '';
  try { groundSvg = fs.readFileSync(OUT, 'utf8'); } catch { /* M10 reports the sheet that is not written */ }
  for (const [name, hex] of Object.entries(GCOL)) {
    if (!groundSvg.includes(`fill="${hex}"`)) problems.push(`ground colour "${name}" is declared but not drawn on the ground`);
  }
  // M6 · every sub-zone and wild cell is a side of its own town
  for (const c of MAP.cells) {
    const t = CELLS.get(c.cell);
    for (const cell of [...c.subs.map((s) => s.cell), ...c.wild.map((w) => w.cell)]) {
      const h = CELLS.get(cell);
      if (h && hd([h.q, h.r], [t.q, t.r]) !== 1) problems.push(`${c.town} cell ${cell} is not a side of ${c.cell}`);
    }
  }
  // M7 · presentation only: no coordinate table is read by the simulation
  const readers = [...sources(path.join(ROOT, 'engine')), ...sources(path.join(ROOT, 'game/src'))]
    .filter((f) => /map\.json/.test(fs.readFileSync(f, 'utf8')));
  if (readers.length) problems.push(`map.json is read by ${readers.map((f) => path.relative(ROOT, f)).join(', ')} — the simulation may not read a coordinate (X33)`);
  // M8 · the field is the declared one
  if (CELLS.size !== F.hexes) problems.push(`the lattice holds ${CELLS.size} cells, not the declared ${F.hexes}`);
  if (!inField(0, 0)) problems.push('the starting settlement does not sit on a cell of the field');
  // M9 · every landmark anchors to a settlement that owns a cell
  for (const w of (MAP.watermarks || [])) {
    if (!cellOf(w.anchor)) problems.push(`watermark ${w.id} anchors to "${w.anchor}", which owns no cell`);
  }
  // M10 · the written sheet carries a polygon per cell, a pin per settlement and a stretch per hop,
  //        so the client toggles by id and matches a route by cell key alone
  try {
    const svg = fs.readFileSync(OUT, 'utf8');
    const polys = (svg.match(/class="cell /g) || []).length;
    const pins = (svg.match(/class="pin"/g) || []).length;
    const hops = (svg.match(/class="walk"/g) || []).length;
    const axes = (svg.match(/data-ax="/g) || []).length;
    const shapes = [...svg.matchAll(/<polygon points="([^"]*)"/g)];
    const hexes = shapes.filter((m) => m[1].trim().split(/\s+/).length === 6).length;
    if (polys !== F.hexes) problems.push(`sheet has ${polys} cell polygons for ${F.hexes} cells`);
    // a polygon with no points is invisible, and an invisible field still passes a count of tags
    if (hexes !== F.hexes) problems.push(`sheet has ${hexes} drawn hexes for ${F.hexes} cells — a cell with no points is not on the sheet`);
    if (axes !== F.hexes) problems.push(`sheet has ${axes} cell keys for ${F.hexes} cells — a plotted route could not be matched`);
    if (pins !== MAP.cells.length) problems.push(`sheet has ${pins} travel pins for ${MAP.cells.length} settlements`);
    if (hops !== WALK.length) problems.push(`sheet has ${hops} walk stretches for ${WALK.length} hops`);
  } catch { problems.push('sheet not written — run node tools/map.ts --write'); }
  // M11 · one named sub-zone cell per sub-zone, in the engine's order, and the name printed on it
  for (const c of MAP.cells) {
    const s = settlementById(c.town);
    const zone = zoneById(s.zone);
    const subs = (zone.subzones || []);
    if (c.subs.length !== subs.length) problems.push(`settlement ${c.town} owns ${c.subs.length} sub-zone cells for ${subs.length} sub-zones`);
    if (c.wild.length !== 3) problems.push(`settlement ${c.town} owns ${c.wild.length} wild cells, not three`);
    subs.forEach((sub, j) => {
      const h = CELLS.get((c.subs[j] || {}).cell);
      if (!h) return;
      const k = key(h.q, h.r);
      if (!(claims.get(k) || {}).name || claims.get(k).name !== sub.name) {
        problems.push(`sub-zone "${sub.name}" of ${c.town} is not the name printed on its cell ${(c.subs[j] || {}).cell}`);
      }
    });
  }
  // M12 · every zone belongs to exactly one named region, and every region names a real zone
  const covered = [];
  for (const r of (MAP.regions || [])) {
    for (const z of r.zones) {
      if (!E.mob.zones.some((zz) => zz.id === z)) problems.push(`region "${r.name}" names zone ${z}, which does not exist`);
      if (covered.includes(z)) problems.push(`zone ${z} is in two regions`);
      covered.push(z);
    }
  }
  for (const z of E.mob.zones) if (!covered.includes(z.id)) problems.push(`zone ${z.id} belongs to no region`);
  return problems;
}

const args = process.argv.slice(2);
if (args.includes('--checks')) {
  const problems = checks();
  const say = (ok, text) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`);
  const subs = MAP.cells.reduce((n, c) => n + c.subs.length, 0);
  const wild = MAP.cells.reduce((n, c) => n + c.wild.length, 0);
  say(MAP.cells.length === settlementIds.length, `M1  every settlement owns exactly one cell of the field (${MAP.cells.length})`);
  say(!problems.some((p) => /outside the|claimed by/.test(p)), `M2  all ${subs + wild + MAP.cells.length} claimed cells are on the field, none claimed twice`);
  say(!problems.some((p) => /walk graph|walk node|the sheet says/.test(p)), `M3  the sheet's cells and the walk graph's ${roadNodes.length} axial nodes are the same lattice`);
  say(!problems.some((p) => /has no colour/.test(p)), `M4  every terrain a cell stands on has a colour`);
  say(!problems.some((p) => /declared but/.test(p)), `M5  every declared colour is drawn somewhere (${Object.keys(COL).length} terrain keys · ${Object.keys(GCOL).length} ground keys)`);
  say(!problems.some((p) => /not a side of/.test(p)), `M6  every sub-zone and wild cell is a side of its own town`);
  say(!problems.some((p) => /may not read a coordinate/.test(p)), `M7  no file under engine/ or game/src/ reads map.json — cells stay presentation (X33)`);
  say(!problems.some((p) => /lattice holds|starting settlement/.test(p)), `M8  the field is the declared ${F.cols} x ${F.rows} (${F.hexes} cells) with the start on its centre cell`);
  say(!problems.some((p) => /anchors to/.test(p)), `M9  every landmark anchors to a settlement that owns a cell`);
  say(!problems.some((p) => /cell polygons|cell keys|travel pins|walk stretches|sheet not written/.test(p)), `M10 the sheet carries ${F.hexes} keyed cells, a pin per settlement and ${WALK.length} walk stretches`);
  say(!problems.some((p) => /sub-zone cells for|wild cells, not|not the name printed/.test(p)), `M11 one named sub-zone cell per sub-zone (${subs}) and three wild cells per town (${wild})`);
  say(!problems.some((p) => /two regions|belongs to no region|names zone/.test(p)), `M12 every zone belongs to exactly one named region (${(MAP.regions || []).length} regions)`);
  if (problems.length) {
    console.log(`\n${problems.length} problem(s):`);
    for (const p of problems) console.log(`  · ${p}`);
    process.exit(1);
  }
  console.log('\n12/12 gate PASS · 0 FAIL');
} else if (args.includes('--write')) {
  write();
} else {
  console.log('map.ts — the generated field sheet');
  console.log('  --write    write art/svg/map/map-overlay.svg from tools/data/map.json');
  console.log('  --checks   run M1-M12 (cells, the walk graph lattice, terrain, labels, the presentation-only rule)');
}
