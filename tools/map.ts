// @ts-nocheck
/**
 * Map layer — the generated overlay of the settlement map (`tools/data/map.json`).
 *
 *   node tools/map.ts            help
 *   node tools/map.ts --write    write the overlay SVG (art/svg/map/map-overlay.svg)
 *   node tools/map.ts --checks   run M1-M7, exit 1 on FAIL
 *
 * The hand-drawn terrain background lives in `art/svg/map/map-terrain.svg` and is not written here. This tool writes
 * only what is derived: link paths from node positions, terrain glyphs at their anchor, node marks
 * and an empty travel-marker group the client fills in. Node coordinates are **presentation only** —
 * the simulation reads node and link ids and nothing else, which M7 enforces (X33 · X47).
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
const engineLinks = E.road.links.map((l) => ({ id: `${l.zoneA}-${l.zoneB}`, a: l.a, b: l.b, terrain: l.terrain }));
const terrainKinds = Object.keys(E.road.terrain);
const nodeById = (id) => MAP.nodes.find((n) => n.id === id);
const linkById = (id) => MAP.links.find((l) => l.id === id);

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
  // M3 · the overlay's links are exactly the Road's links, one for one
  for (const el of engineLinks) {
    const ml = linkById(el.id);
    if (!ml) { problems.push(`no map link for Road link ${el.id}`); continue; }
    const pair = [nodeById(ml.a), nodeById(ml.b)].filter(Boolean).map((n) => TOWN.settlements.find((s) => s.id === n.id).name).sort();
    if (pair.join('|') !== [el.a, el.b].sort().join('|')) problems.push(`map link ${el.id} joins ${ml.a}/${ml.b}, not ${el.a}/${el.b}`);
    if (ml.terrain !== el.terrain) problems.push(`map link ${el.id} says ${ml.terrain}, the Road says ${el.terrain}`);
  }
  for (const ml of MAP.links) if (!engineLinks.some((l) => l.id === ml.id)) problems.push(`map link ${ml.id} is not a Road link`);
  // M4 · every drawn terrain kind is a real tilt row
  for (const t of MAP.terrain) if (!terrainKinds.includes(t.kind)) problems.push(`terrain feature ${t.id} uses kind "${t.kind}", which is not in engine.json road.terrain`);
  // M5 · every tilt row is actually drawn somewhere, or it is a mechanic with no map
  for (const kind of terrainKinds) if (!MAP.terrain.some((t) => t.kind === kind)) problems.push(`terrain row "${kind}" has no feature on the map`);
  // M6 · every feature names a node or a link that exists
  for (const t of MAP.terrain) {
    const anchor = t.anchor.startsWith('link:') ? linkById(t.anchor.slice(5)) : nodeById(t.anchor);
    if (!anchor) problems.push(`terrain feature ${t.id} anchors to "${t.anchor}", which is neither a node nor a link`);
  }
  // M7 · presentation only: no coordinate table is read by the simulation
  const readers = [...sources(path.join(ROOT, 'engine')), ...sources(path.join(ROOT, 'game/src'))]
    .filter((f) => /map\.json/.test(fs.readFileSync(f, 'utf8')));
  if (readers.length) problems.push(`map.json is read by ${readers.map((f) => path.relative(ROOT, f)).join(', ')} — the simulation may not read a coordinate (X33)`);
  return problems;
}

function glyph(t) {
  const link = t.anchor.startsWith('link:') ? linkById(t.anchor.slice(5)) : null;
  const node = link ? null : nodeById(t.anchor);
  const p = link
    ? (() => { const a = nodeById(link.a), b = nodeById(link.b); return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; })()
    : { x: node.x, y: node.y };
  return `    <g class="terrain terrain-${t.kind}" data-feature="${t.id}" data-anchor="${t.anchor}"><circle cx="${p.x}" cy="${p.y}" r="26"/><title>${t.kind}</title></g>`;
}

function write() {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<!-- GENERATED by tools/map.ts from tools/data/map.json — do not hand-edit. The terrain background is a separate hand-drawn file. -->`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MAP.view.w} ${MAP.view.h}" width="${MAP.view.w}" height="${MAP.view.h}">`,
    '  <g id="terrain">',
    ...MAP.terrain.map(glyph),
    '  </g>',
    '  <g id="links">',
    ...MAP.links.map((l) => {
      const a = nodeById(l.a), b = nodeById(l.b);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 24;
      return `    <path class="link link-${l.id} terrain-${l.terrain}" data-link="${l.id}" d="M ${a.x} ${a.y} Q ${mx} ${my} ${b.x} ${b.y}"/>`;
    }),
    '  </g>',
    '  <g id="nodes">',
    ...MAP.nodes.map((n) => `    <g class="node" data-node="${n.id}"><circle cx="${n.x}" cy="${n.y}" r="7"/><text x="${n.x}" y="${n.y - 14}">${TOWN.settlements.find((s) => s.id === n.id).name}</text></g>`),
    '  </g>',
    '  <!-- the client draws the travel marker here; the overlay never bakes a position into the sim -->',
    '  <g id="marker"/>',
    '</svg>',
    '',
  ];
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`wrote ${path.relative(ROOT, OUT)} · ${MAP.nodes.length} nodes · ${MAP.links.length} links · ${MAP.terrain.length} terrain features`);
}

const args = process.argv.slice(2);
if (args.includes('--checks')) {
  const problems = checks();
  const say = (ok, text) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`);
  say(MAP.nodes.length === settlementIds.length, `M1  every settlement has exactly one node (${MAP.nodes.length})`);
  say(!problems.some((p) => /outside the|share one point|map nodes for/.test(p)), `M2  every node sits inside the ${MAP.view.w}x${MAP.view.h} view, none shares a point`);
  say(!problems.some((p) => /map link|Road link/.test(p)), `M3  the overlay's ${MAP.links.length} links are the Road's links one for one, terrain included`);
  say(!problems.some((p) => /uses kind/.test(p)), `M4  every drawn terrain kind is a real tilt row`);
  say(!problems.some((p) => /has no feature on the map/.test(p)), `M5  every tilt row (${terrainKinds.join(' · ')}) is drawn somewhere`);
  say(!problems.some((p) => /anchors to/.test(p)), `M6  every terrain feature anchors to a real node or link`);
  say(!problems.some((p) => /may not read a coordinate/.test(p)), `M7  no file under engine/ or game/src/ reads map.json — coordinates stay presentation (X33)`);
  if (problems.length) {
    console.log(`\n${problems.length} problem(s):`);
    for (const p of problems) console.log(`  · ${p}`);
    process.exit(1);
  }
  console.log('\n7/7 gate PASS · 0 FAIL');
} else if (args.includes('--write')) {
  write();
} else {
  console.log('map.ts — the generated settlement-map overlay');
  console.log('  --write    write art/svg/map/map-overlay.svg from tools/data/map.json');
  console.log('  --checks   run M1-M7 (nodes, links, terrain, anchors, the presentation-only rule)');
}
