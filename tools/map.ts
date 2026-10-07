// @ts-nocheck
/**
 * Map layer — the generated overlay of the settlement map (`tools/data/map.json`).
 *
 *   node tools/map.ts            help
 *   node tools/map.ts --write    write the overlay SVG (art/svg/map/map-overlay.svg)
 *   node tools/map.ts --checks   run M1-M12, exit 1 on FAIL
 *
 * The hand-drawn terrain background lives in `art/svg/map/map-terrain.svg` and is not written here. This tool writes
 * only what is derived: the hex field (one hex per sub-zone, laid out from each node's pod centroid), the biome
 * tones, the river band, the drawn stretches between node positions, terrain washes, region names, node marks and an empty
 * travel-marker group the client fills in. Node coordinates are **presentation only** — the simulation reads node
 * and settlement ids and nothing else, which M7 enforces (X33 · X47). The walk graph itself is the
 * simulator's, in axial hex coordinates (`engine.json` road); this sheet only draws it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './lib/json.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const MAP = readJson(path.join(ROOT, 'tools/data/map.json'));
const E = readJson(path.join(ROOT, 'tools/data/engine.json'));
const TOWN = readJson(path.join(ROOT, 'tools/data/town.json'));
const OUT = path.join(ROOT, 'art/svg/map/map-overlay.svg');

const settlementIds = TOWN.settlements.map((s) => s.id);
const terrainKinds = MAP.terrain_kinds || [];
/** The walk graph the simulator reads, in axial hex coordinates (`engine.json` road). */
const roadNodes = E.road.nodes;
const blocksBetween = (a, b) => {
  const na = roadNodes.find((n) => n.id === a), nb = roadNodes.find((n) => n.id === b);
  if (!na || !nb) return 0;
  const dq = na.q - nb.q, dr = na.r - nb.r;
  return (Math.abs(dq) + Math.abs(dq + dr) + Math.abs(dr)) / 2;
};
const nodeById = (id) => MAP.nodes.find((n) => n.id === id);
const linkById = (id) => MAP.links.find((l) => l.id === id);
const settlementById = (id) => TOWN.settlements.find((s) => s.id === id);
const speciesName = (id) => (E.mob.species.find((sp) => sp.id === id) || { name: id }).name;
const zoneById = (id) => E.mob.zones.find((z) => z.id === id);
const toneOf = (zone) => (MAP.tones.find((t) => t.zone === zone) || {}).tone || MAP.field.tone;
const hexToRgb = (hex) => { const v = parseInt(hex.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const rgbToHex = ([r, g, b]) => '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
const FIELD_RGB = hexToRgb(MAP.field.tone);
const zoneRgb = new Map();
function rgbOfZone(zone) {
  if (!zoneRgb.has(zone)) zoneRgb.set(zone, hexToRgb(toneOf(zone)));
  return zoneRgb.get(zone);
}
/** The races that live at a settlement's zone — read from engine zones, never typed on the map. */
function racesAt(nodeId) {
  const s = settlementById(nodeId);
  const z = s && zoneById(s.zone);
  if (!z) return [];
  const ids = new Set();
  for (const sub of (z.subzones || [])) for (const r of sub.races) ids.add(r);
  return [...ids].map(speciesName);
}
/** A link or node anchor resolved to a point (the midpoint for a link). */
function anchorPoint(anchor) {
  const link = anchor.startsWith('link:') ? linkById(anchor.slice(5)) : null;
  if (link) { const a = nodeById(link.a), b = nodeById(link.b); return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
  const node = nodeById(anchor);
  return node ? { x: node.x, y: node.y } : null;
}

// ------------------------------------------------------------------ the hex field

/** Pointy-top hex geometry: width sqrt(3)s across the flats, height 2s, columns offset every other row. */
const HS = MAP.hex.size;
const HW = Math.sqrt(3) * HS;
const HH = 2 * HS;
const HEX_R = HS * 0.94;
/** The blend scale: inside BLEND_NEAR a hex carries its settlement's own ground; past BLEND_FAR it is neutral field. */
const BLEND_NEAR = HW * 1.6;
const BLEND_FAR = HW * 6;
const smoothstep = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
function hexPoints(cx, cy) {
  const p = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 90);
    p.push(`${(cx + HEX_R * Math.cos(a)).toFixed(1)},${(cy + HEX_R * Math.sin(a)).toFixed(1)}`);
  }
  return p.join(' ');
}
/** A settlement's own hex plus one hex per sub-zone, fanned outward so the cluster points the way the map reads. */
function podHexes(n) {
  const out = [{ x: n.x, y: n.y }];
  const cx = MAP.view.w / 2, cy = MAP.view.h / 2;
  const theta = Math.atan2(n.y - cy, n.x - cx) || -Math.PI / 2;
  const spread = Math.PI / 3; // exact hex neighbours, so the cluster tiles instead of overlapping
  for (let i = 0; i < 3; i++) {
    const a = theta + (i - 1) * spread;
    out.push({ x: n.x + Math.cos(a) * HW, y: n.y + Math.sin(a) * HW });
  }
  return out;
}
/** Every hex of the sheet, as a flat list, so the off-pod cells can be tinted by their nearest settlement. */
function allHexes() {
  const out = [];
  for (let row = -1; row * (HS * 1.5) < MAP.view.h + HS; row++) {
    const cy = row * HS * 1.5;
    const shift = (row & 1) ? HW / 2 : 0;
    for (let col = -1; col * HW < MAP.view.w + HW; col++) {
      const cx = col * HW + shift;
      if (cx < -HW || cx > MAP.view.w + HW) continue;
      out.push({ x: cx, y: cy });
    }
  }
  return out;
}
const nearest = (hex) => MAP.nodes.reduce((best, n) => {
  const d = Math.abs(hex.x - n.x) + Math.abs(hex.y - n.y);
  return !best || d < best.d ? { n, d } : best;
}, null).n;
/**
 * The tone of a hex with no settlement on it: the three nearest settlement tones blended by inverse-square
 * distance, then faded toward the neutral field tone as the hex leaves the clusters — so the ground between
 * clusters and the outer field read as terrain of their own instead of one neighbour's biome. A settlement's
 * own hex and its sub-zone hexes keep their full tone, so the clusters still read.
 */
function groundTone(hex) {
  const ds = MAP.nodes
    .map((n) => ({ zone: settlementById(n.id).zone, d: Math.hypot(hex.x - n.x, hex.y - n.y) }))
    .sort((a, b) => a.d - b.d);
  const k = Math.min(3, ds.length);
  let r = 0, g = 0, b = 0, sum = 0;
  for (let i = 0; i < k; i++) {
    const w = 1 / (ds[i].d * ds[i].d + 1e-6);
    const c = rgbOfZone(ds[i].zone);
    r += c[0] * w; g += c[1] * w; b += c[2] * w; sum += w;
  }
  const s = smoothstep((ds[0].d - BLEND_NEAR) / (BLEND_FAR - BLEND_NEAR));
  return rgbToHex([
    (r / sum) * (1 - s) + FIELD_RGB[0] * s,
    (g / sum) * (1 - s) + FIELD_RGB[1] * s,
    (b / sum) * (1 - s) + FIELD_RGB[2] * s,
  ]);
}

function hexField() {
  const owned = new Set();
  const cells = [];
  for (const n of MAP.nodes) {
    const zone = settlementById(n.id).zone;
    const subzones = (zoneById(zone).subzones || []);
    podHexes(n).forEach((h, i) => {
      owned.add(`${Math.round(h.x)},${Math.round(h.y)}`);
      cells.push({ hex: h, tone: toneOf(zone), node: n, sub: i === 0 ? null : subzones[i - 1], pod: true });
    });
  }
  for (const h of allHexes()) {
    const key = `${Math.round(h.x)},${Math.round(h.y)}`;
    if (owned.has(key)) continue;
    const n = nearest(h);
    cells.push({ hex: h, tone: groundTone(h), node: n, sub: null, pod: false });
  }
  const lines = ['  <g id="hexes">'];
  for (const c of cells) {
    const cls = c.pod ? 'hex pod' : 'hex';
    const label = c.sub ? `<title>${c.sub.name}</title>` : `<title>${settlementById(c.node.id).name}</title>`;
    lines.push(`    <polygon class="${cls}" points="${hexPoints(c.hex.x, c.hex.y)}" fill="${c.tone}"${c.pod ? ` data-node="${c.node.id}"${c.sub ? ` data-sub="${c.sub.name}"` : ''}` : ''}>${label}</polygon>`);
  }
  lines.push('  </g>');
  return lines;
}

/** A sub-zone name is wrapped to at most two lines so it sits inside its own hex (M11 is the count; this is the fit). */
function wrapLabel(name, maxChars = 8) {
  if (name.length <= maxChars) return [name];
  const words = name.split(' ');
  if (words.length < 2) return [name];
  // split at the space nearest the middle, so neither line is the long one
  let cut = 1, best = Infinity;
  for (let i = 1; i < words.length; i++) {
    const d = Math.abs(words.slice(0, i).join(' ').length - words.slice(i).join(' ').length);
    if (d < best) { best = d; cut = i; }
  }
  return [words.slice(0, cut).join(' '), words.slice(cut).join(' ')];
}

/** Where a location's name sits: outside its whole cluster, pushed away from the sheet's centre. */
function labelBlock(n) {
  const cx = MAP.view.w / 2, cy = MAP.view.h / 2;
  const len = Math.hypot(n.x - cx, n.y - cy) || 1;
  const ux = (n.x - cx) / len, uy = (n.y - cy) / len;
  const reach = HW + HEX_R + 12;
  if (Math.abs(ux) >= Math.abs(uy)) {
    const side = ux > 0 ? 1 : -1;
    const half = 62;
    const x = n.x + side * reach;
    if (side > 0 && x + half > MAP.view.w - 6) return { x: n.x, y: n.y + reach + 16, anchor: 'middle' };
    if (side < 0 && x - half < 6) return { x: n.x, y: n.y + reach + 16, anchor: 'middle' };
    return { x, y: n.y, anchor: side > 0 ? 'start' : 'end' };
  }
  const down = uy > 0;
  return { x: n.x, y: n.y + (down ? reach + 18 : -(reach + 6)), anchor: 'middle' };
}

/** A settlement's own hex carries its name; its sub-zones are named inside the hex they own. */
function nodeMark(n) {
  const s = settlementById(n.id);
  const capital = s.band === 'high';
  const zone = zoneById(s.zone);
  const b = labelBlock(n);
  const base = b.anchor === 'middle' ? b.y : b.y;
  const out = [];
  // one label per sub-zone hex, centred inside that hex, wrapped so it stays in the frame
  podHexes(n).forEach((h, i) => {
    if (i === 0) return;
    const sub = (zone.subzones || [])[i - 1];
    if (!sub) return;
    const parts = wrapLabel(sub.name, 8);
    const top = h.y - ((parts.length - 1) * 13) / 2 + 4;
    out.push(`    <text class="subzone" x="${h.x.toFixed(1)}" y="${top.toFixed(1)}" text-anchor="middle">`
      + parts.map((l, k) => `<tspan x="${h.x.toFixed(1)}" dy="${k * 13}">${l}</tspan>`).join('') + '</text>');
  });
  return `    <g class="node${capital ? ' capital' : ''}" data-node="${n.id}">`
    + `<circle cx="${n.x}" cy="${n.y}" r="7"/>`
    + `<text class="place" x="${b.x.toFixed(1)}" y="${base.toFixed(1)}" text-anchor="${b.anchor}"`
    + `${b.anchor === 'middle' ? '' : ' dominant-baseline="middle"'}>${s.name}</text>`
    + out.join('')
    + '</g>';
}

function riverPath() {
  const p = MAP.river.points;
  let d = `M ${p[0][0]} ${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const [x0, y0] = p[i], [x1, y1] = p[i + 1];
    const my = (y0 + y1) / 2;
    d += ` Q ${x0} ${my} ${x1} ${y1}`;
  }
  return d;
}

function regionNames() {
  return [
    '  <g id="regions">',
    ...(MAP.regions || []).map((r) => `    <text class="region" x="${r.at[0]}" y="${r.at[1]}">${r.name}</text>`),
    '  </g>',
  ];
}

/** Nothing under engine/ or game/src/ may read a coordinate (X33). */
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
  // M1 · every settlement has exactly one node, and no node is a stranger
  for (const id of settlementIds) if (!nodeById(id)) problems.push(`no map node for settlement ${id}`);
  for (const n of MAP.nodes) if (!settlementIds.includes(n.id)) problems.push(`map node ${n.id} is not a settlement`);
  if (MAP.nodes.length !== settlementIds.length) problems.push(`${MAP.nodes.length} map nodes for ${settlementIds.length} settlements`);
  // M2 · coordinates are inside the view and two places never share a point
  for (const n of MAP.nodes) {
    if (!(n.x >= 0 && n.x <= MAP.view.w && n.y >= 0 && n.y <= MAP.view.h)) problems.push(`node ${n.id} at ${n.x},${n.y} is outside the ${MAP.view.w}x${MAP.view.h} view`);
    const twin = MAP.nodes.find((m) => m !== n && m.x === n.x && m.y === n.y);
    if (twin) problems.push(`nodes ${n.id} and ${twin.id} share one point`);
  }
  // M3 · the walk graph carries one node per settlement, and every drawn stretch joins two of them
  for (const id of settlementIds) if (!roadNodes.some((n) => n.id === id)) problems.push(`the walk graph has no node for settlement ${id}`);
  for (const n of roadNodes) if (!settlementIds.includes(n.id)) problems.push(`walk node ${n.id} is not a settlement`);
  if (roadNodes.length !== settlementIds.length) problems.push(`${roadNodes.length} walk nodes for ${settlementIds.length} settlements`);
  for (const n of roadNodes) if (!Number.isInteger(n.q) || !Number.isInteger(n.r)) problems.push(`walk node ${n.id} is not on the hex lattice`);
  for (const ml of MAP.links) {
    if (!nodeById(ml.a) || !nodeById(ml.b)) problems.push(`map link ${ml.id} joins a node that is not on the sheet`);
    if (!terrainKinds.includes(ml.terrain)) problems.push(`map link ${ml.id} says terrain "${ml.terrain}", which is not a declared kind`);
    if (blocksBetween(ml.a, ml.b) <= 0) problems.push(`map link ${ml.id} joins two settlements that share no blocks`);
  }
  // M4 · every drawn terrain kind is a declared kind
  for (const t of MAP.terrain) if (!terrainKinds.includes(t.kind)) problems.push(`terrain feature ${t.id} uses kind "${t.kind}", which is not in map.json terrain_kinds`);
  // M5 · every declared kind is actually drawn somewhere
  for (const kind of terrainKinds) if (!MAP.terrain.some((t) => t.kind === kind)) problems.push(`terrain kind "${kind}" has no feature on the map`);
  // M6 · every feature names a node or a link that exists
  for (const t of MAP.terrain) {
    const anchor = t.anchor.startsWith('link:') ? linkById(t.anchor.slice(5)) : nodeById(t.anchor);
    if (!anchor) problems.push(`terrain feature ${t.id} anchors to "${t.anchor}", which is neither a node nor a link`);
  }
  // M7 · presentation only: no coordinate table is read by the simulation
  const readers = [...sources(path.join(ROOT, 'engine')), ...sources(path.join(ROOT, 'game/src'))]
    .filter((f) => /map\.json/.test(fs.readFileSync(f, 'utf8')));
  if (readers.length) problems.push(`map.json is read by ${readers.map((f) => path.relative(ROOT, f)).join(', ')} — the simulation may not read a coordinate (X33)`);
  // M8 · the presentation grid is the declared 5x5
  if (!MAP.grid || MAP.grid.cols !== 5 || MAP.grid.rows !== 5) problems.push(`map grid is ${MAP.grid ? `${MAP.grid.cols}x${MAP.grid.rows}` : 'absent'}, not the declared 5x5`);
  // M9 · every watermark anchors to a real node or link
  for (const t of (MAP.watermarks || [])) {
    const anchor = t.anchor.startsWith('link:') ? linkById(t.anchor.slice(5)) : nodeById(t.anchor);
    if (!anchor) problems.push(`watermark ${t.id} anchors to "${t.anchor}", which is neither a node nor a link`);
  }
  // M10 · the written overlay carries a pin per node and a dash per link, so the client toggles by id alone
  try {
    const svg = fs.readFileSync(OUT, 'utf8');
    const pins = (svg.match(/class="pin"/g) || []).length;
    const dashes = (svg.match(/class="dash"/g) || []).length;
    if (pins !== MAP.nodes.length) problems.push(`overlay has ${pins} travel pins for ${MAP.nodes.length} nodes`);
    if (dashes !== MAP.links.length) problems.push(`overlay has ${dashes} dash paths for ${MAP.links.length} links`);
  } catch { problems.push('overlay not written — run node tools/map.ts --write'); }
  // M11 · a settlement's hex plus one hex per sub-zone, so every place the player fights in has a block of its own
  const subCount = E.mob.zones.reduce((n, z) => n + (z.subzones || []).length, 0);
  for (const n of MAP.nodes) {
    const hexes = podHexes(n).length;
    const subs = (zoneById(settlementById(n.id).zone).subzones || []).length;
    if (hexes !== subs + 1) problems.push(`settlement ${n.id} owns ${hexes} hexes for ${subs} sub-zones — it needs one hex each`);
  }
  if (MAP.nodes.length + subCount !== MAP.nodes.length * 4) problems.push(`expected ${MAP.nodes.length} settlement hexes + ${subCount} sub-zone hexes`);
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

function wash(t) {
  const p = anchorPoint(t.anchor);
  return `    <circle class="terrain terrain-${t.kind}" data-feature="${t.id}" data-anchor="${t.anchor}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="${HEX_R * 0.92}"/>`;
}

function watermarkGlyph(t) {
  const p = anchorPoint(t.anchor);
  // a landmark mark, not architecture: a small dark disc with a light ring, so it never reads as a settlement
  return `    <g class="watermark watermark-${t.kind}" data-feature="${t.id}" data-anchor="${t.anchor}"><circle cx="${p.x}" cy="${p.y}" r="6"/><circle class="halo" cx="${p.x}" cy="${p.y}" r="9"/><title>${t.label || t.kind}</title></g>`;
}
function write() {
  const g = MAP.grid || { cols: 5, rows: 5 };
  const grid = [];
  for (let i = 0; i <= g.cols; i++) { const x = (MAP.view.w / g.cols) * i; grid.push(`    <line class="grid-line" x1="${x}" y1="0" x2="${x}" y2="${MAP.view.h}"/>`); }
  for (let j = 0; j <= g.rows; j++) { const y = (MAP.view.h / g.rows) * j; grid.push(`    <line class="grid-line" x1="0" y1="${y}" x2="${MAP.view.w}" y2="${y}"/>`); }
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<!-- GENERATED by tools/map.ts from tools/data/map.json — do not hand-edit. The terrain background is a separate hand-drawn file. -->`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MAP.view.w} ${MAP.view.h}" width="${MAP.view.w}" height="${MAP.view.h}" font-family="Georgia, 'Palatino Linotype', 'Book Antiqua', serif">`,
    ...hexField(),
    '  <g id="river">',
    `    <path class="river-band" d="${riverPath()}" stroke-width="${MAP.river.width}" fill="none"/>`,
    '  </g>',
    '  <g id="terrain">',
    ...MAP.terrain.map(wash),
    '  </g>',
    ...regionNames(),
    '  <g id="watermarks">',
    ...(MAP.watermarks || []).map(watermarkGlyph),
    '  </g>',
    '  <g id="nodes">',
    ...MAP.nodes.map(nodeMark),
    '  </g>',
    '  <!-- the client toggles these by id: the pin of the settlement you stand in, the pin of the one you walk to -->',
    '  <g id="markers">',
    ...MAP.nodes.map((n) => `    <g class="pin" data-node="${n.id}"><circle cx="${n.x}" cy="${n.y}" r="16"/><circle cx="${n.x}" cy="${n.y}" r="7"/></g>`),
    ...MAP.links.map((l) => {
      const a = nodeById(l.a), b = nodeById(l.b);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 26;
      return `    <path class="dash" data-link="${l.id}" d="M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}"/>`;
    }),
    '  </g>',
    '  <g id="grid">',
    ...grid,
    '  </g>',
    '</svg>',
    '',
  ];
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`wrote ${path.relative(ROOT, OUT)} · ${MAP.nodes.length} clusters / ${MAP.nodes.length * 4} owned hexes (1 settlement + 3 sub-zones each) · ${MAP.links.length} drawn stretches · ${MAP.terrain.length} washes · ${(MAP.watermarks || []).length} landmarks · ${(MAP.regions || []).length} regions · ${MAP.view.w}x${MAP.view.h}`);
}

const args = process.argv.slice(2);
if (args.includes('--checks')) {
  const problems = checks();
  const say = (ok, text) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`);
  const subCount = E.mob.zones.reduce((n, z) => n + (z.subzones || []).length, 0);
  say(MAP.nodes.length === settlementIds.length, `M1  every settlement has exactly one node (${MAP.nodes.length})`);
  say(!problems.some((p) => /outside the|share one point|map nodes for/.test(p)), `M2  every node sits inside the ${MAP.view.w}x${MAP.view.h} view, none shares a point`);
  say(!problems.some((p) => /walk graph|walk node|map link/.test(p)), `M3  the walk graph carries ${roadNodes.length} nodes one per settlement, and all ${MAP.links.length} drawn stretches join two of them`);
  say(!problems.some((p) => /uses kind/.test(p)), `M4  every drawn terrain kind is a declared kind`);
  say(!problems.some((p) => /has no feature on the map/.test(p)), `M5  every terrain kind (${terrainKinds.join(' · ')}) is drawn somewhere`);
  say(!problems.some((p) => /anchors to/.test(p)), `M6  every terrain feature anchors to a real node or link`);
  say(!problems.some((p) => /may not read a coordinate/.test(p)), `M7  no file under engine/ or game/src/ reads map.json — coordinates stay presentation (X33)`);
  say(!problems.some((p) => /map grid is/.test(p)), `M8  the presentation grid is the declared ${MAP.grid ? `${MAP.grid.cols}x${MAP.grid.rows}` : '5x5'} (framing only)`);
  say(!problems.some((p) => /watermark .* anchors to/.test(p)), `M9  every watermark anchors to a real node or link`);
  say(!problems.some((p) => /travel pins|dash paths|overlay not written/.test(p)), `M10 the overlay carries a pin per node and a dash per link (client toggles by id, no coordinate)`);
  say(!problems.some((p) => /hexes for|settlement hexes/.test(p)), `M11 a settlement hex plus one hex per sub-zone — ${MAP.nodes.length * 4} owned hexes for ${subCount} sub-zones`);
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
  console.log('map.ts — the generated settlement-map overlay');
  console.log('  --write    write art/svg/map/map-overlay.svg from tools/data/map.json');
  console.log('  --checks   run M1-M12 (pods, hexes, links, terrain, regions, the presentation-only rule)');
}
