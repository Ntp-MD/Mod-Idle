// @ts-nocheck
/**
 * Map layer — the generated overlay of the settlement map (`tools/data/map.json`).
 *
 *   node tools/map.ts            help
 *   node tools/map.ts --write    write the overlay SVG (art/svg/map/map-overlay.svg)
 *   node tools/map.ts --checks   run the sheet's gates, exit 1 on FAIL
 *
 * The hand-drawn terrain background lives in `art/svg/map/map-terrain.svg` and is not written here. This tool writes
 * only what is derived: the hex field (a settlement's own hex plus one per sub-zone, laid out from each node's pod
 * centroid, and every other hex in the lattice tinted and registered to its nearest settlement), the biome tones, the
 * region names and the place names — a settlement's name floating above its cluster, each sub-zone named inside the
 * hex it owns. **Every hex carries its place's id**, so the whole lattice is the clickable travel map and a click
 * walks there. **The sheet is names only: it draws no dots at all** — no settlement pin, no landmark mark, no
 * terrain wash, no river, no framing grid and no route layer. The places are read; the ground between them is not.
 * Node coordinates are **presentation only** — the simulation reads node, link and block ids and nothing else,
 * which M7 enforces (X33 · X47).
 */

import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './lib/json.ts';
import { ROAD } from './lib/engine.ts';

const ROOT = path.resolve(import.meta.dirname, '..');
const MAP = readJson(path.join(ROOT, 'tools/data/map.json'));
const E = readJson(path.join(ROOT, 'tools/data/engine.json'));
const TOWN = readJson(path.join(ROOT, 'tools/data/town.json'));
const OUT = path.join(ROOT, 'art/svg/map/map-overlay.svg');

const settlementIds = TOWN.settlements.map((s) => s.id);
const engineLinks = E.road.links.map((l, i) => ({ i, id: `${l.zoneA}-${l.zoneB}`, a: l.a, b: l.b, terrain: l.terrain }));

const nodeById = (id) => MAP.nodes.find((n) => n.id === id);
const linkById = (id) => MAP.links.find((l) => l.id === id);
const settlementById = (id) => TOWN.settlements.find((s) => s.id === id);
const zoneById = (id) => E.mob.zones.find((z) => z.id === id);
const toneOf = (zone) => (MAP.tones.find((t) => t.zone === zone) || {}).tone || MAP.field.tone;

// ------------------------------------------------------------------ the hex field

/** Pointy-top hex geometry: width sqrt(3)s across the flats, height 2s, columns offset every other row. */
const HS = MAP.hex.size;
const HW = Math.sqrt(3) * HS;
const HEX_R = HS * 0.94;
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



const rgbOf = (tone) => { const h = tone.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
const hexOf = (rgb) => '#' + rgb.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, '0')).join('');
const mixTone = (a, b, t) => a.map((c, i) => c + (b[i] - c) * t);

/**
 * Off-pod ground takes a **distance-weighted blend** of the settlements near it, not the nearest one:
 * a hex between two clusters reads as a mixture, and past `HEX_FADE` it settles to the neutral field
 * tone instead of inheriting a neighbour's biome. Every tone is a light pastel, so a blend of them
 * stays light and the sheet's names keep their contrast (M16).
 */
const HEX_FADE = 340;
/** How far off-pod ground is drawn, in hex pitches from the nearest settlement. */
const HALO_RINGS = 1.9;
const FIELD_RGB = rgbOf(MAP.field.tone);
const nodeTones = MAP.nodes.map((n) => ({ n, tone: rgbOf(toneOf(settlementById(n.id).zone)) }));
function blendedTone(h) {
  const near = nodeTones
    .map((e) => ({ tone: e.tone, d: Math.hypot(h.x - e.n.x, h.y - e.n.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 3);
  let wsum = 0, acc = [0, 0, 0];
  for (const e of near) { const w = 1 / (e.d * e.d + 1); wsum += w; acc = acc.map((c, i) => c + e.tone[i] * w); }
  const fade = Math.max(0, Math.min(1, (near[0].d - HEX_FADE * 0.3) / (HEX_FADE * 0.7)));
  return hexOf(mixTone(acc.map((c) => c / wsum), FIELD_RGB, fade));
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
  // Off-pod ground is a **halo around the clusters, not a field across the whole sheet**. A hex is
  // drawn only if it sits within `HALO_RINGS` pitches of some settlement, so the map reads as a set of
  // places on an empty plate instead of graph paper. Every drawn hex still registers its place, so
  // the whole field remains clickable ground (M11) — there is simply less of it.
  for (const h of allHexes()) {
    const key = `${Math.round(h.x)},${Math.round(h.y)}`;
    if (owned.has(key)) continue;
    if (Math.min(...MAP.nodes.map((n) => Math.hypot(h.x - n.x, h.y - n.y))) > HALO_RINGS * HW) continue;
    const n = nearest(h);
    cells.push({ hex: h, tone: blendedTone(h), node: n, sub: null, pod: false });
  }
  const lines = ['  <g id="hexes">'];
  for (const c of cells) {
    const cls = c.pod ? 'hex pod' : 'hex';
    const label = c.sub ? `<title>${c.sub.name}</title>` : `<title>${settlementById(c.node.id).name}</title>`;
    // Every hex registers the place it belongs to — a pod cell its own settlement (and, for a sub-zone
    // cell, the ground itself), an off-pod cell the nearest one — so the whole lattice is the clickable
    // travel map: a click reads only the id, never a coordinate (X33 · M7). `data-pod` marks a cell that
    // is the settlement's own block, which is what opens its services rather than starting a journey.
    const attrs = ` data-node="${c.node.id}"${c.pod ? ' data-pod="1"' : ''}${c.sub ? ` data-sub="${c.sub.name}"` : ''}`;
    lines.push(`    <polygon class="${cls}" points="${hexPoints(c.hex.x, c.hex.y)}" fill="${c.tone}"${attrs}>${label}</polygon>`);
  }
  lines.push('  </g>');
  return lines;
}

/** A sub-zone name is wrapped to at most two lines so it sits inside its own hex (M11 is the count; this is the fit). */
function wrapLabel(name, maxChars = 9) {
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

/** Where a location's name floats: always above its whole cluster, centred on it. */
function labelBlock(n) {
  const above = n.y - (HW + HEX_R + 30);
  const y = above < 40 ? n.y + (HW + HEX_R + 40) : above; // a settlement on the top rim flips below
  return { x: n.x, y, anchor: 'middle' };
}

/** A settlement's name floats above its cluster; each sub-zone is named inside the hex it owns. */
function nodeMark(n) {
  const s = settlementById(n.id);
  const zone = zoneById(s.zone);
  const b = labelBlock(n);
  const out = [];
  // one label per sub-zone hex, centred inside that hex, wrapped so it stays in the frame
  podHexes(n).forEach((h, i) => {
    if (i === 0) return;
    const sub = (zone.subzones || [])[i - 1];
    if (!sub) return;
    const parts = wrapLabel(sub.name, 9);
    const top = h.y - ((parts.length - 1) * 22) / 2 + 7;
    out.push(`    <text class="subzone" x="${h.x.toFixed(1)}" y="${top.toFixed(1)}" text-anchor="middle">`
      + parts.map((l, k) => `<tspan x="${h.x.toFixed(1)}" dy="${k * 22}">${l}</tspan>`).join('') + '</text>');
  });
  return `    <g class="node" data-node="${n.id}" data-pod="1">`
    + `<text class="place" x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" text-anchor="middle">${s.name}</text>`
    + out.join('')
    + '</g>';
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
  // M3 · the overlay's links are exactly the Road's links, one for one
  for (const el of engineLinks) {
    const ml = linkById(el.id);
    if (!ml) { problems.push(`no map link for Road link ${el.id}`); continue; }
    const pair = [nodeById(ml.a), nodeById(ml.b)].filter(Boolean).map((n) => TOWN.settlements.find((s) => s.id === n.id).name).sort();
    if (pair.join('|') !== [el.a, el.b].sort().join('|')) problems.push(`map link ${el.id} joins ${ml.a}/${ml.b}, not ${el.a}/${el.b}`);
    if (ml.terrain !== el.terrain) problems.push(`map link ${ml.id} says ${ml.terrain}, the Road says ${el.terrain}`);
  }
  for (const ml of MAP.links) if (!engineLinks.some((l) => l.id === ml.id)) problems.push(`map link ${ml.id} is not a Road link`);
  // M7 · presentation only: no coordinate table is read by the simulation
  const readers = [...sources(path.join(ROOT, 'engine')), ...sources(path.join(ROOT, 'game/src'))]
    .filter((f) => /map\.json/.test(fs.readFileSync(f, 'utf8')));
  if (readers.length) problems.push(`map.json is read by ${readers.map((f) => path.relative(ROOT, f)).join(', ')} — the simulation may not read a coordinate (X33)`);
  const subCount = E.mob.zones.reduce((n, z) => n + (z.subzones || []).length, 0);
  // M9 · the written overlay names every place by id, so the client toggles and reads by id alone.
  // There are no dots on the sheet: a settlement and each of its sub-zones is a name, nothing else.
  try {
    const svg = fs.readFileSync(OUT, 'utf8');
    const names = (svg.match(/class="node"/g) || []).length;
    const subNames = (svg.match(/class="subzone"/g) || []).length;
    const dots = (svg.match(/<circle/g) || []).length;
    if (names !== MAP.nodes.length) problems.push(`overlay has ${names} settlement names for ${MAP.nodes.length} nodes`);
    if (subNames !== subCount) problems.push(`overlay has ${subNames} sub-zone names for ${subCount} sub-zones`);
    if (dots) problems.push(`overlay draws ${dots} circles — the sheet is names only, no dots`);
  } catch { problems.push('overlay not written — run node tools/map.ts --write'); }
  // M11 · a settlement's hex plus one hex per sub-zone, so every place the player fights in has a block of its
  // own — and every hex on the sheet registers the place it belongs to, so the lattice is the clickable map
  for (const n of MAP.nodes) {
    const hexes = podHexes(n).length;
    const subs = (zoneById(settlementById(n.id).zone).subzones || []).length;
    if (hexes !== subs + 1) problems.push(`settlement ${n.id} owns ${hexes} hexes for ${subs} sub-zones — it needs one hex each`);
  }
  if (MAP.nodes.length + subCount !== MAP.nodes.length * 4) problems.push(`expected ${MAP.nodes.length} settlement hexes + ${subCount} sub-zone hexes`);
  try {
    const svg = fs.readFileSync(OUT, 'utf8');
    const hexPolys = svg.match(/<polygon class="hex[^"]*"[^>]*>/g) || [];
    const unplaced = hexPolys.filter((p) => !/ data-node="/.test(p)).length;
    const pods = hexPolys.filter((p) => / data-pod="/.test(p)).length;
    if (unplaced) problems.push(`${unplaced} hexes register no place — the lattice is not fully clickable`);
    if (pods !== MAP.nodes.length * 4) problems.push(`overlay draws ${pods} settlement hexes for ${MAP.nodes.length * 4} owned cells`);
  } catch { /* M10 already reports the missing file */ }
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
  // M13 · one clock, not two. The walk re-expresses a leg in blocks, and the only thing that may
  // differ afterwards is the ruler: block_sec x encounter_gap_blocks x encounters_per_min must be 60,
  // so the encounter cadence a leg carries is the one it always had (X36).
  const W = E.road.walk;
  if (!(W.block_sec > 0)) problems.push(`walk.block_sec is ${W.block_sec}, not a positive length of walk`);
  if (W.block_sec * W.encounter_gap_blocks * E.road.encounters_per_min !== 60) {
    problems.push(`walk: ${W.block_sec}s x ${W.encounter_gap_blocks} blocks x ${E.road.encounters_per_min}/min is not a minute — the walk would move the Road's cadence`);
  }
  // M14 · a leg is a whole number of blocks. A half block would end a walk between two blocks.
  for (const l of E.road.links) {
    const sec = l.trip_min * 60;
    if (sec % W.block_sec) problems.push(`link ${l.zoneA}-${l.zoneB} is ${sec}s, which is not a whole number of ${W.block_sec}s blocks`);
  }
  // M15 · the walkable world is exactly the links' block chains, and nothing else. Every block is
  // named once, every one of them is reachable from its own link's first block by walking, and no
  // block touches anything but its own neighbours — so no route can hop ground.
  const seenBlocks = new Set();
  for (const b of ROAD.blocks) {
    if (seenBlocks.has(b.id)) problems.push(`block ${b.id} is declared twice`);
    seenBlocks.add(b.id);
  }
  if (seenBlocks.size !== ROAD.blocks.length) problems.push(`block ids collide: ${seenBlocks.size} distinct for ${ROAD.blocks.length} blocks`);
  if (!ROAD.chainIsWalkable) problems.push('a link\'s blocks are not a chain — a block cannot reach the next one');
  for (const l of ROAD.links) {
    for (const n of [0, l.blocks - 1]) {
      const b = ROAD.blockById.get(ROAD.blockId(l.index, n));
      if (!b) { problems.push(`link ${l.id} names block ${n}, which the walk does not own`); continue; }
      if (n === 0 ? b.from !== l.a : b.to !== l.b) problems.push(`block ${b.id} does not touch the settlement at that end of ${l.id}`);
    }
    // the degree of every block is fixed by its own position, so nothing else is an edge
    for (let n = 0; n < l.blocks; n++) {
      const ns = ROAD.neighboursOf(l.index, n);
      const want = (n > 0 ? 1 : 0) + (n < l.blocks - 1 ? 1 : 0);
      if (ns.length !== want) { problems.push(`block ${ROAD.blockId(l.index, n)} touches ${ns.length} blocks, not the ${want} it may`); break; }
      if (ns.some((id) => ROAD.blockById.get(id)?.linkIndex !== l.index)) {
        problems.push(`block ${ROAD.blockId(l.index, n)} touches a block on another link`);
        break;
      }
    }
  }
  return problems;
}

function write() {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<!-- GENERATED by tools/map.ts from tools/data/map.json — do not hand-edit. The terrain background is a separate hand-drawn file. -->`,
    // no width/height on the root: it would hand the browser a fixed pixel size to scale from, and
    // the sheet is sized by the CSS frame instead — so it stays sharp however far the player zooms
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${MAP.view.w} ${MAP.view.h}" font-family="'Segoe UI', 'Inter', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif">`,
    ...hexField(),
    ...regionNames(),
    '  <g id="nodes">',
    ...MAP.nodes.map(nodeMark),
    '  </g>',
    '</svg>',
    '',
  ];
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`wrote ${path.relative(ROOT, OUT)} · ${MAP.nodes.length} clusters / ${MAP.nodes.length * 4} owned hexes (1 settlement + 3 sub-zones each) · names only, no dots · ${(MAP.regions || []).length} regions · ${MAP.view.w}x${MAP.view.h}`);
}

const args = process.argv.slice(2);
if (args.includes('--checks')) {
  const problems = checks();
  const say = (ok, text) => console.log(`${ok ? 'PASS' : 'FAIL'}  ${text}`);
  const subCount = E.mob.zones.reduce((n, z) => n + (z.subzones || []).length, 0);
  say(MAP.nodes.length === settlementIds.length, `M1  every settlement has exactly one node (${MAP.nodes.length})`);
  say(!problems.some((p) => /outside the|share one point|map nodes for/.test(p)), `M2  every node sits inside the ${MAP.view.w}x${MAP.view.h} view, none shares a point`);
  say(!problems.some((p) => /map link|Road link/.test(p)), `M3  the overlay's ${MAP.links.length} links are the Road's links one for one, terrain included`);
  say(!problems.some((p) => /may not read a coordinate/.test(p)), `M7  no file under engine/ or game/src/ reads map.json — coordinates stay presentation (X33)`);
  say(!problems.some((p) => /settlement names|sub-zone names|circles|overlay not written/.test(p)), `M9  the overlay is names only — ${MAP.nodes.length} settlement names, ${subCount} sub-zone names, zero dots (client reads by id, no coordinate)`);
  say(!problems.some((p) => /hexes for|settlement hexes|register no place/.test(p)), `M11 a settlement hex plus one hex per sub-zone, each registered to its place — ${MAP.nodes.length * 4} owned hexes for ${subCount} sub-zones`);
  say(!problems.some((p) => /two regions|belongs to no region|names zone/.test(p)), `M12 every zone belongs to exactly one named region (${(MAP.regions || []).length} regions)`);
  say(!problems.some((p) => /block_sec|walk would move/.test(p)), `M13 one clock — ${E.road.walk.block_sec}s a block x ${E.road.walk.encounter_gap_blocks} blocks x ${E.road.encounters_per_min}/min = 60s, so the walk moved the ruler and nothing else`);
  say(!problems.some((p) => /whole number of/.test(p)), `M14 every leg is a whole number of ${E.road.walk.block_sec}s blocks (${ROAD.blocksFor(0)} a ladder leg, ${ROAD.blocksFor(ROAD.links.findIndex((l) => l.kind === 'branch'))} a branch)`);
  say(!problems.some((p) => /declared twice|collide|not a chain|does not touch|touches \d+ blocks|another link/.test(p)), `M15 the walk is ${ROAD.blocks.length} blocks and nothing else — each chain reaches the next block and touches no other`);
  if (problems.length) {
    console.log(`\n${problems.length} problem(s):`);
    for (const p of problems) console.log(`  · ${p}`);
    process.exit(1);
  }
  console.log('\n10/10 gate PASS · 0 FAIL');
} else if (args.includes('--write')) {
  write();
} else {
  console.log('map.ts — the generated settlement-map overlay');
  console.log('  --write    write art/svg/map/map-overlay.svg from tools/data/map.json');
  console.log('  --checks   run the sheet gates (pods, hexes, links, terrain, regions, the walk, the presentation-only rule)');
}
