/**
 * Map layer — the generated field sheet (`tools/data/map.json`).
 *
 *   node tools/map.ts            help
 *   node tools/map.ts --write    write the sheet (game/src/icon/map/map-overlay.svg)
 *   node tools/map.ts --checks   run M2-M15, exit 1 on FAIL
 *
 * The sheet is the 20 x 15 hex field the walk graph lives on: one polygon per cell of the field,
 * tinted by the terrain that cell stands on, with a settlement mark on its own cell, one named
 * sub-zone cell and one named wild cell on each of its sides, and bare ground beyond them faded to
 * the paper. Every cell carries its id (`A1` … `O20`) and its axial key, so the client can light up
 * a plotted route by matching the keys the road module hands back — it never reads a coordinate
 * table, which M7 enforces (X33 · M7 · M10). What the cells hold — sub-zone names, level bands,
 * Species — is the engine's, printed here and never typed. The river band, the terrain washes and the
 * hand-drawn backdrop of the old free-hand sheet are gone with that sheet: the field IS the terrain.
 *
 * The board carries three explicit layers, painted bottom-up:
 *   `#layer-surface`  ground, cell polygons and walk routes
 *   `#layer-diorama`  biome and settlement art, one upright figure per cell
 *   `#layer-objects`  per-cell actor slots (mobs, events), the player mark and label groups
 * Asset folders separate terrain, landmarks and characters under `game/public/map/`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { readJson } from './lib/json.ts';
import * as G from './lib/gates.ts';
import { createRoad } from '../engine/road.ts';
import { MAP_CAMERA_TRANSFORM, projectMapPoint, mapUprightAt, mapUprightAround, projectMapBounds, projectedHex, footprintShapeError } from '../game/src/ui/map-projection.ts';
import { TERRAIN_ART } from '../game/src/ui/map-terrain.ts';
import { mapSpriteWidth } from '../game/src/ui/map-sprites.ts';
import footprints from '../game/src/ui/map-terrain-footprints.json' with { type: 'json' };
import type { EngineData, MobZone } from '../engine/types.ts';

/**
 * The map data's own shape (`tools/data/map.json`) — the field sheet the client draws. The tool reads
 * it through these declarations, so a key that moves is a type error here rather than a silent
 * `undefined` three hundred lines down.
 */
interface MapSide {
  cell: string;
  terrain?: string;
  kind?: string;
}
interface MapCellEntry {
  town: string;
  cell: string;
  subs: MapSide[];
  wild: MapSide[];
}
interface MapField {
  cols: number;
  rows: number;
  hexes: number;
  radius: number;
  gap: number;
  sheet: string;
  stroke: string;
  bare_tone: string;
  ground_ramp: string[];
  deep_close: number;
}
interface MapData {
  field: MapField;
  terrain_colors: Record<string, string>;
  settlement_landmarks: Record<string, string>;
  cells: MapCellEntry[];
  watermarks: { id: string; anchor: string; kind: string; label?: string }[];
  regions: { name: string; zones: number[] }[];
}

/** The town data's slice this tool reads: the settlements and the zone each one holds. */
interface TownRow {
  id: string;
  name: string;
  zone: number;
  capital?: boolean;
}
interface TownSlice {
  settlements: TownRow[];
}

const ROOT = path.resolve(import.meta.dirname, '..');
const MAP = readJson<MapData>(path.join(ROOT, 'tools/data/map.json'));
const E = readJson<EngineData>(path.join(ROOT, 'tools/data/engine.json'));
const TOWN = readJson<TownSlice>(path.join(ROOT, 'tools/data/town.json'));
const OUT = path.join(ROOT, 'game/src/icon/map/map-overlay.svg');

const F = MAP.field;
const COL = MAP.terrain_colors;
/** The order the country's ramp walks, one way round the wheel: the endless ground is printed from
 *  `terrain_colors` itself, closed toward the paper by `field.deep_close`, so one terrain has one colour
 *  and the field's edge cannot drift away from the country outside it. */
const RAMP = F.ground_ramp;
const R = F.radius;
const SQ3 = Math.sqrt(3);
/** Two pointy-top neighbours sit SQ3*R apart and each reaches SQ3*r/2 past its centre, so r = R - GAP/SQ3. */
const HEX_R = R - F.gap / SQ3;
const TILE_DEPTH = 3;
/** The complete projected ground footprint, centred on the cell origin. */
const PROJ_HEX = projectedHex(HEX_R);
/** Legacy scenery has no measurable hex footprint; keep its painted bottom inside the cell.
 *  Full-hex replacements instead use the exact projected bounding rectangle below. */
const TERRAIN_PIECE = { width: PROJ_HEX.width * .98, bottom: -PROJ_HEX.y * .98 };

const registeredArtwork = new Map<string, string>();
const registeredDefinitions = new Map<string, string>();
/** How far a measured footprint may sit from the template hex, as a fraction of the canvas.
 *  A footprint measured in the wrong rotational order lands every corner on the wrong edge,
 *  and the per-sector fit below cannot see it: each sector maps its own pair exactly. */
const FOOTPRINT_SHAPE_TOLERANCE = 0.12;
/** Register each ground sector exactly; adjacent sectors share their centre and edge endpoints. */
function hexArtwork(href: string): string {
  const cached = registeredArtwork.get(href);
  if (cached) return cached;
  const measured = (footprints as Record<string, { width: number; height: number; vertices: number[][]; groundFill: string }>)[href];
  if (!measured) return `<image class="terrain-hex" href="${href}" x="${PROJ_HEX.x}" y="${PROJ_HEX.y}" width="${PROJ_HEX.width}" height="${PROJ_HEX.height}" preserveAspectRatio="none"/>`;
  if (measured.vertices.length !== 6 || measured.width <= 0 || measured.height <= 0 || !/^#[0-9a-f]{6}$/i.test(measured.groundFill)) throw new Error(`Invalid terrain footprint: ${href}`);
  const source = measured.vertices.map(([x,y]) => ({ x: x / measured.width, y: y / measured.height }));
  const shapeError = footprintShapeError(source, HEX_R);
  if (shapeError > FOOTPRINT_SHAPE_TOLERANCE) throw new Error(`Terrain footprint does not match the template hex: ${href} (${(shapeError * 100).toFixed(1)}% of the canvas away; re-measure it with tools/map-art.py)`);
  const center = { x: source.reduce((sum,p)=>sum+p.x,0)/6, y: source.reduce((sum,p)=>sum+p.y,0)/6 };
  const id = 'terrain-' + href.replace(/[^a-z0-9-]/gi, '-');
  const outline = PROJ_HEX.points.map(p=>`${p.x},${p.y}`).join(' ');
  const defs = [`<clipPath id="${id}-boundary" clipPathUnits="userSpaceOnUse"><polygon points="${outline}"/></clipPath>`, `<image id="${id}-texture" href="${href}" width="1" height="1" preserveAspectRatio="none"/>`];
  const patches: string[] = [], errors: number[] = [];
  for (let i=0;i<6;i++) {
    const next = (i+1)%6, p=source[i], q=source[next];
    const target=PROJ_HEX.points[i], other=PROJ_HEX.points[next];
    const px=p.x-center.x, py=p.y-center.y, qx=q.x-center.x, qy=q.y-center.y;
    const det=px*qy-qx*py;
    if (Math.abs(det)<1e-10) throw new Error(`Degenerate terrain footprint: ${href}`);
    const a=(target.x*qy-other.x*py)/det, c=(px*other.x-qx*target.x)/det;
    const b=(target.y*qy-other.y*py)/det, d=(px*other.y-qx*target.y)/det;
    const e=-a*center.x-c*center.y, f=-b*center.x-d*center.y;
    errors.push(Math.hypot(a*p.x+c*p.y+e-target.x,b*p.x+d*p.y+f-target.y));
    // A subpixel overlap hides antialias seams; the outer clip keeps the ground boundary exact.
    const triangle=[{x:0,y:0},target,other];
    const centroid={x:(target.x+other.x)/3,y:(target.y+other.y)/3};
    const overlap=PROJ_HEX.width/1024/4;
    const points=triangle.map(v=>{
      const dx=v.x-centroid.x,dy=v.y-centroid.y,length=Math.hypot(dx,dy);
      return `${v.x+dx/length*overlap},${v.y+dy/length*overlap}`;
    }).join(' ');
    defs.push(`<clipPath id="${id}-sector-${i}" clipPathUnits="userSpaceOnUse"><polygon points="${points}"/></clipPath>`);
    patches.push(`<g clip-path="url(#${id}-sector-${i})"><use data-sector="${i}" href="#${id}-texture" transform="matrix(${a} ${b} ${c} ${d} ${e} ${f})"/></g>`);
  }
  const error=Math.max(...errors);
  if (!Number.isFinite(error) || error>1e-9) throw new Error(`Terrain footprint registration failed: ${href}`);
  defs.push(`<g id="${id}" clip-path="url(#${id}-boundary)"><polygon points="${outline}" fill="${measured.groundFill}"/>${patches.join('')}</g>`);
  registeredDefinitions.set(href,defs.join('\n'));
  const markup = `<g class="terrain-registration" data-art-href="${href}" data-vertex-error="${error}" data-vertex-errors="${errors.join(',')}"><use href="#${id}"/></g>`;
  registeredArtwork.set(href, markup);
  return markup;
}
const TOWN_ART = TERRAIN_ART.town;
const LANDMARK_ART: Record<string, string> = {
  'village-small': TOWN_ART,
  'village-medium': TOWN_ART,
  'village-large': TOWN_ART,
  'city-small': TOWN_ART,
  'city-medium': TOWN_ART,
  'city-large': TOWN_ART,
  'city-capital': TOWN_ART,
};
/** An axial cell in the sheet's own frame. */
type Axial = [number, number];

const settlementLandmark = (town: string): string => MAP.settlement_landmarks[town] || 'city-medium';
const PX = ([q, r]: Axial): [number, number] => [SQ3 * (q + r / 2) * R, 1.5 * r * R];
const key = (q: number, r: number): string => q + ',' + r;
const hd = (a: Axial, b: Axial): number => {
  const dq = a[0] - b[0], dr = a[1] - b[1];
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
};

const settlementIds: string[] = TOWN.settlements.map((s) => s.id);
const settlementById = (id: string): TownRow | undefined => TOWN.settlements.find((s) => s.id === id);
const zoneById = (id: number) => E.mob.zones.find((z) => z.id === id);
const roadNodes = E.road.nodes;
/** The walk graph itself, so M13 can ask the engine who owns a cell rather than assume it. */
const ROAD = createRoad(E);
/** The order a tied cell is resolved in: `road.standing_rule` gives it to the lowest zone. */
const STANDING: string[] = TOWN.settlements.slice().sort((a, b) => a.zone - b.zone).map((s) => s.id);

// ------------------------------------------------------------------ the lattice

/**
 * The field, generated the way the sheet is read: rows of columns, each row offset half a hex.
 * Axial coordinates are measured from the centre cell, which is where the starting settlement
 * stands, so they are the same numbers `engine.json` `road` holds.
 */
/** One cell of the field, in the engine's own axial frame. */
interface CellRow {
  q: number;
  r: number;
  x: number;
  y: number;
  row: number;
  col: number;
}

const raw: { q: number; r: number; row: number; col: number }[] = [];
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
const CELLS = new Map<string, CellRow>();
const CELLID = new Map<string, string>();
for (const c of raw) {
  const q = c.q - Q0, r = c.r - R0;
  const id = String.fromCharCode(65 + c.row) + (c.col + 1);
  const [x, y] = PX([q, r]);
  CELLS.set(id, { q, r, x, y, row: c.row, col: c.col });
  CELLID.set(key(q, r), id);
}

// ------------------------------------------------------------------ who owns what

/** terrain key -> colour, plus the blend a bare cell takes from the nearest settlement. */
const hexToRgb = (h: string): [number, number, number] => { const v = parseInt(h.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; };
const rgbToHex = ([r, g, b]: [number, number, number]): string => '#' + [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, '0')).join('');
/** a colour as HSL — the ground ramp is walked by hue, so hue is what gets measured and guarded. */
const hslOf = (hex: string): [number, number, number] => {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
};
const hslToHex = ([h, s, l]: [number, number, number]): string => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const seg = ([[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor((((h % 360) + 360) % 360) / 60) % 6] ?? [0, 0, 0]) as [number, number, number];
  return rgbToHex(seg.map((v) => (v + m) * 255) as [number, number, number]);
};
const SHEET_HSL = hslOf(F.sheet);
/**
 * The one travel a tone takes toward the paper, held on the colour's own hue: saturation and lightness
 * close on the sheet's, hue does not move. Both the field's bare cells and the ground past it are printed
 * with this, so a colour at the field's border is the same colour just outside it. A plain rgb lerp steps
 * onto the sheet's hue (213) instead, which drags ash's mauve onto a violet no terrain stands on and turns
 * the ramp into a second palette.
 */
const towardHeld = (hex: string, t: number): string => {
  const [h, s, l] = hslOf(hex);
  return hslToHex([h, SHEET_HSL[1] + (s - SHEET_HSL[1]) * (1 - t), SHEET_HSL[2] + (l - SHEET_HSL[2]) * (1 - t)]);
};
/** the ramp's hues with the wheel's wrap taken out, so a step past red reads as the turn it is. */
const hueWalk = (hexes: string[]): number[] => {
  const out: number[] = [];
  for (const hex of hexes) {
    let h = hslOf(hex)[0];
    while (out.length && h - out[out.length - 1] > 180) h -= 360;
    while (out.length && out[out.length - 1] - h > 180) h += 360;
    out.push(h);
  }
  return out;
};

/**
 * The claims, in the order the file lists them: a town's own cell, its three sub-zone cells in
 * sub-zone order, and the sides left over as wild cells. Level bands and sub-zone names come from
 * the engine, read through the settlement's zone, so a cell never carries a number this file typed.
 */
/** What stands on a cell: a settlement, a named side of one, or a wild side. */
interface Claim {
  kind: 'town' | 'sub' | 'wild';
  /** Which side of the settlement the cell is — the sub-zone index or the wild index. */
  j?: number;
  town: string;
  cell: string;
  terrain?: string;
  zone: MobZone;
  s: TownRow;
  name?: string;
}

const claims = new Map<string, Claim>();
for (const entry of MAP.cells) {
  const s = settlementById(entry.town);
  if (!s) throw new Error(`map.json names settlement ${entry.town}, which town.json does not carry`);
  const zone = zoneById(s.zone);
  if (!zone) throw new Error(`settlement ${entry.town} holds zone ${s.zone}, which engine.json does not carry`);
  const at = (id: string): Axial => {
    const c = CELLS.get(id);
    if (!c) throw new Error(`${entry.town} names cell ${id}, which is not on the ${F.cols} x ${F.rows} field`);
    return [c.q, c.r];
  };
  const townCell = at(entry.cell);
  claims.set(key(townCell[0], townCell[1]), { kind: 'town', town: entry.town, cell: entry.cell, zone, s });
  entry.subs.forEach((sub, j) => {
    const c = at(sub.cell);
    const subzone = (zone.subzones || [])[j];
    claims.set(key(c[0], c[1]), {
      kind: 'sub', j, town: entry.town, cell: sub.cell, terrain: sub.terrain, zone, s,
      name: subzone ? subzone.name : '',
    });
  });
  entry.wild.forEach((w, j) => {
    const c = at(w.cell);
    claims.set(key(c[0], c[1]), {
      kind: 'wild', j, town: entry.town, cell: w.cell, zone, s,
      name: j === 0 ? s.name + ' Dungeon' : s.name + ' ' + (j + 1),
    });
  });
}
/** The tone a settlement spreads: the terrain most of its sub-zone cells stand on, ties to the first. */
const spreadTone = new Map<string, string>();
for (const entry of MAP.cells) {
  const count: Record<string, number> = {};
  for (const sub of entry.subs) if (sub.terrain) count[sub.terrain] = (count[sub.terrain] || 0) + 1;
  const first = entry.subs[0]?.terrain;
  if (!first) continue;
  spreadTone.set(entry.town, entry.subs.reduce((best, sub) =>
    (sub.terrain && count[sub.terrain] > count[best] ? sub.terrain : best), first));
}
const townPoints = MAP.cells.map((entry) => {
  const node = roadNodes.find((n) => n.id === entry.town);
  if (!node) throw new Error(`the walk graph has no node for settlement ${entry.town}`);
  const k = spreadTone.get(entry.town) ?? '';
  return { town: entry.town, q: node.q, r: node.r, k, tone: COL[k] };
});
/** The country each settlement holds: its cell and the terrain key it spreads over its bare ground. */
const SPREAD = MAP.cells.map((entry) => {
  const node = roadNodes.find((n) => n.id === entry.town);
  if (!node) throw new Error(`the walk graph has no node for settlement ${entry.town}`);
  return { town: entry.town, q: node.q, r: node.r, k: spreadTone.get(entry.town) ?? '' };
});
/**
 * The bare cells: each printed with the terrain of the settlement it is nearest, at that terrain's own
 * colour. There is no distance fade, so the field's outer ring is the same colour as the country past it.
 */
const BARE = (() => {
  const list: { id: string; d: number; tone: string; terrain: string }[] = [];
  for (const [id, c] of CELLS) {
    if (claims.has(key(c.q, c.r))) continue;
    const near = townPoints.reduce<{ d: number; t: (typeof townPoints)[number] } | null>((best, t) => {
      const d = hd([c.q, c.r], [t.q, t.r]);
      return !best || d < best.d ? { d, t } : best;
    }, null);
    if (!near) continue;
    list.push({ id, d: near.d, tone: near.t.tone, terrain: near.t.k });
  }
  return { byId: new Map(list.map((b) => [b.id, { ...b, fill: b.tone }])) };
})();

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
    if (!node) throw new Error(`the walk graph has no node for settlement ${entry.town}`);
    return { id: entry.town, q: node.q, r: node.r };
  });
  const dist = (a: { q: number; r: number }, b: { q: number; r: number }): number => hd([a.q, a.r], [b.q, b.r]);
  const inTree = new Set<number>([0]);
  const edges: { a: string; b: string; blocks: number }[] = [];
  while (inTree.size < T.length) {
    let best: { a: number; b: number; d: number } | null = null;
    for (const a of inTree) {
      for (let b = 0; b < T.length; b++) {
        if (inTree.has(b)) continue;
        const d = dist(T[a], T[b]);
        if (!best || d < best.d) best = { a, b, d };
      }
    }
    if (!best) break;
    edges.push({ a: T[best.a].id, b: T[best.b].id, blocks: best.d });
    inTree.add(best.b);
  }
  return edges;
}
const WALK = walkGraph();

// ------------------------------------------------------------------ drawing

function hexPts(cx: number, cy: number, r = HEX_R): string {
  const p: string[] = [];
  for (let k = 0; k < 6; k++) {
    const a = (Math.PI / 180) * (60 * k - 30);
    p.push((cx + r * Math.cos(a)).toFixed(6) + ',' + (cy + r * Math.sin(a)).toFixed(6));
  }
  return p.join(' ');
}

/** A name inside a hex: wrapped to the hex's width, at most three lines. */
function wrap(text: string, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const w of text.split(' ')) {
    if (line && (line + ' ' + w).length > max) { lines.push(line); line = w; }
    else line = line ? line + ' ' + w : w;
  }
  if (line) lines.push(line);
  return lines;
}

const levelText = (zone: MobZone | undefined): string => 'Lv ' + (zone?.levels || []).join('-');
const esc = (s: unknown): string => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function terrainFor(id: string, c: CellRow): string {
  const o = claims.get(key(c.q, c.r));
  if (o?.kind === 'wild') {
    const site = Object.entries(E.fieldwork.wild_site_index).find(([, index]) => index === o.j)?.[0];
    return site === 'mine' ? 'rock' : site === 'dungeon' ? 'dungeon' : 'forest';
  }
  return !o ? (BARE.byId.get(id)?.terrain ?? '')
    : o.kind === 'sub' ? (o.terrain ?? '')
      : o.kind === 'town' ? 'town' : 'wild';
}

function depthGroup(): string[] {
  const lines = ['  <g id="tile-depth" pointer-events="none">'];
  for (const [, c] of CELLS) {
    lines.push(`    <polygon class="tile-depth-cell" points="${hexPts(c.x, c.y + TILE_DEPTH)}"/>`);
  }
  lines.push('  </g>');
  return lines;
}

function fieldGroup(): string[] {
  const lines = ['  <g id="field">'];
  for (const [id, c] of CELLS) {
    const k = key(c.q, c.r);
    const o = claims.get(k);
    let fill: string, cls: string;
    if (o) {
      cls = o.kind;
      fill = o.kind === 'town' ? COL.town : o.kind === 'wild' ? COL.wild : (COL[o.terrain ?? ''] ?? F.bare_tone);
    } else {
      cls = 'bare';
      fill = BARE.byId.get(id)?.fill ?? F.bare_tone;
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
      o && o.kind === 'town' ? `data-landmark="${settlementLandmark(o.town)}"` : '',
      `data-terrain="${o ? (o.kind === 'sub' ? o.terrain : o.kind) : 'bare'}"`,
      `data-biome="${terrainFor(id, c)}"`,
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

/** Upright art is drawn back-to-front; only the ground receives the camera's foreshortening. */
function cellsBackToFront(): [string, CellRow][] {
  return [...CELLS.entries()].sort(([, a], [, b]) => projectMapPoint(a.x, a.y).y - projectMapPoint(b.x, b.y).y);
}

/** Layer 2 relief: one terrain piece per hex, its ground footprint sized to the projected hex. */
function dioramaGroup(): string[] {
  const lines = ['  <g id="layer-diorama" pointer-events="none">'];
  for (const [id, c] of cellsBackToFront()) {
    const terrain = terrainFor(id, c);
    const claim = claims.get(key(c.q, c.r));
    const art = terrain === 'town'
      ? LANDMARK_ART[settlementLandmark(claim?.town ?? '')] || TERRAIN_ART.town
      : TERRAIN_ART[terrain] || TERRAIN_ART.grass;
    const href = art;
    // Settlement and terrain canvases share the same footprint registration.
    const body = href in footprints
      ? hexArtwork(href)
      : mapSpriteWidth(href, 0, TERRAIN_PIECE.bottom, TERRAIN_PIECE.width);
    const outline = PROJ_HEX.points.map(p => `${p.x},${p.y}`).join(' ');
    lines.push(`    <g class="diorama-figure" data-figure-ax="${c.q},${c.r}" transform="${mapUprightAt(c.x, c.y)}"><g class="diorama-art">${body}</g><g class="hex-calibration" fill="none" stroke="#ff47c8" stroke-width=".5" pointer-events="none"><polygon points="${outline}"/><path d="M-2 0H2M0-2V2"/></g></g>`);
  }
  lines.push('  </g>');
  return lines;
}

/** Layer 3: one actor group per cell, so mobs and events keep the board's back-to-front order. */
function actorGroup(): string[] {
  const lines = ['  <g id="actors" pointer-events="none">'];
  for (const [, c] of cellsBackToFront()) {
    lines.push(`    <g class="actor-figure" data-actor-ax="${c.q},${c.r}"><g class="actor-scenery"></g><g class="actor-slot"></g><g class="actor-signals"></g></g>`);
  }
  lines.push('  </g>');
  return lines;
}

function walkGroup(): string[] {
  const lines = ['  <g id="walk">'];
  for (const e of WALK) {
    const a = CELLS.get(MAP.cells.find((c) => c.town === e.a)?.cell ?? '');
    const b = CELLS.get(MAP.cells.find((c) => c.town === e.b)?.cell ?? '');
    if (!a || !b) continue;
    lines.push(`    <line class="walk" data-from="${e.a}" data-to="${e.b}" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}"/>`);
    lines.push(`    <text class="walk-blk" x="${((a.x + b.x) / 2).toFixed(1)}" y="${((a.y + b.y) / 2 - 4).toFixed(1)}">${e.blocks} blk</text>`);
  }
  lines.push('  </g>');
  return lines;
}


function labelGroups(): string[] {
  const towns: string[] = [], zones: string[] = [], ids: string[] = [];
  for (const entry of MAP.cells) {
    const s = settlementById(entry.town);
    if (!s) throw new Error(`map.json names settlement ${entry.town}, which town.json does not carry`);
    const zone = zoneById(s.zone);
    if (!zone) throw new Error(`settlement ${entry.town} holds zone ${s.zone}, which engine.json does not carry`);
    const c = CELLS.get(entry.cell);
    if (!c) throw new Error(`${entry.town} names cell ${entry.cell}, which is not on the field`);
    towns.push(`    <g class="node${s.capital ? ' capital' : ''}" data-node="${entry.town}" data-zone="${zone.id}" transform="${mapUprightAround(c.x, c.y)}">`
      + `<use href="#icon-town" transform="translate(${(c.x - 6.8).toFixed(1)},${(c.y - 18).toFixed(1)}) scale(0.42)"/>`
      + `<text class="place" x="${c.x.toFixed(1)}" y="${(c.y + 18).toFixed(1)}">${esc(s.name)}</text>`
      + `</g>`);
    ids.push(`    <text class="cellid" data-cell="${entry.cell}" x="${c.x.toFixed(1)}" y="${(c.y + 14).toFixed(1)}">${entry.cell}</text>`);
    const put = (cell: string, name: string, band: MobZone) => {
      const h = CELLS.get(cell);
      if (!h) return;
      const lines = wrap(name, 12);
      const lh = 8.4, top = h.y - ((lines.length - 1) * lh) / 2 - 9;
      zones.push(`    <g class="zonelabel" data-cell="${cell}" transform="${mapUprightAround(h.x, h.y)}">`
        + lines.map((l, i) => `<text class="zonename" x="${h.x.toFixed(1)}" y="${(top + i * lh).toFixed(1)}">${esc(l)}</text>`).join('')
        + `<text class="zoneband" x="${h.x.toFixed(1)}" y="${(h.y + 13).toFixed(1)}">${levelText(band)}</text>`
        + `</g>`);
      ids.push(`    <text class="cellid" data-cell="${cell}" x="${h.x.toFixed(1)}" y="${(h.y + 22).toFixed(1)}">${cell}</text>`);
    };
    entry.subs.forEach((sub, j) => put(sub.cell, ((zone.subzones || [])[j] || {}).name || sub.cell, zone));
    entry.wild.forEach((w, j) => put(w.cell, j === 0 ? s.name + ' Dungeon' : s.name + ' ' + (j + 1), zone));
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
function regionGroup(): string[] {
  const lines = ['  <g id="regions">'];
  for (const r of MAP.regions) {
    const pts = r.zones.map((z) => {
      const s = TOWN.settlements.find((x) => x.zone === z);
      return s && CELLS.get(MAP.cells.find((c) => c.town === s.id)?.cell ?? '');
    }).filter((p): p is CellRow => Boolean(p));
    if (!pts.length) continue;
    const x = pts.reduce((n, p) => n + p.x, 0) / pts.length;
    const y = pts.reduce((n, p) => n + p.y, 0) / pts.length;
    lines.push(`    <text class="region" data-zone="${r.zones.join(' ')}" x="${x.toFixed(1)}" y="${y.toFixed(1)}">${esc(r.name)}</text>`);
  }
  lines.push('  </g>');
  return lines;
}

/** A landmark mark on its settlement's own cell: not architecture, so it never reads as a town. */
function watermarkGroup(): string[] {
  const lines = ['  <g id="watermarks">'];
  for (const w of MAP.watermarks) {
    const entry = MAP.cells.find((c) => c.town === w.anchor);
    if (!entry) continue;
    const c = CELLS.get(entry.cell);
    if (!c) continue;
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

function markersGroup(): string[] {
  const lines = [
    '  <!-- the client toggles these by id: the pin of the settlement you stand in, the pin of the one you walk to -->',
    '  <g id="markers">',
  ];
  for (const entry of MAP.cells) {
    const c = CELLS.get(entry.cell);
    if (!c) continue;
    lines.push(`    <g class="pin" data-node="${entry.town}"><circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="16"/><circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="7"/></g>`);
  }
  lines.push('  </g>');
  return lines;
}

function viewBox(): { vx: number; vy: number; vw: number; vh: number } {
  const xs = [...CELLS.values()].map((c) => c.x), ys = [...CELLS.values()].map((c) => c.y);
  const padX = (SQ3 * R) / 2 + 1, padY = R + TILE_DEPTH + 1;
  const vx = Math.min(...xs) - padX, vy = Math.min(...ys) - padY;
  const vw = Math.max(...xs) + padX - vx, vh = Math.max(...ys) + padY - vy;
  return { vx, vy, vw, vh };
}

/** Compress the field around its center to project it from a 46-degree camera elevation. */
const projectedViewBox = projectMapBounds;

/**
 * The ground the field lies on: the same hex lattice, drawn on past the field so zooming out never
 * reaches an edge — pretending to be terrain, not a flat paper, so the field reads as one region of a
 * larger world. Its tone is the field's own rule carried outward, not a second pattern: a ground hex
 * lies in the country of the settlement it is nearest, and wears that settlement's spread terrain closed
 * on the paper by `field.deep_close` — the same terrain the bare cells around that town are printed in —
 * so the colours meet the map's regions at the field's border and go on with them, not afresh outside it. The settlement layout is read on the tile's own repeats, which is what lets one tile stand
 * for an endless ground; the two lattice translations that carry a tile edge are (N,0) and (N/2,N). A
 * value noise, periodic with the tile, then drifts a hex one step either way on the ramp, so a country's
 * edge is a fringe of its neighbour's tone and not a cut, and the ground reads as country rather than as
 * a chessboard. The tile and the field share the one lattice, so the ground lines up with the cells,
 * not behind them.
 */
function hexGridDefs(): string[] {
  const keys = RAMP;
  const N = 32, G = 8;                 // hexes per tile edge, and the fringing noise's control points
  const w = N * SQ3 * R, h = N * 1.5 * R;
  // the ground closes half the seam the cells keep, so it reads as country and not as a mesh
  const gr = R - F.gap / (2 * SQ3);
  const wrap = (v: number, m: number) => ((v % m) + m) % m;
  const rnd = (cx: number, cy: number) => {
    let k = Math.imul(wrap(cx, G), 374761393) + Math.imul(wrap(cy, G), 668265263) + 2654435761;
    k = Math.imul(k ^ (k >>> 13), 1274126177);
    return ((k >>> 8) & 0xffff) / 0xffff;
  };
  // the smoother curve, so a control cell holds its drift across the middle of itself and turns over only
  // near its edge: fringes where they belong, not a gradient smeared over the whole tile
  const smooth = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  /** the drift field, periodic with the tile so the ground cannot seam. */
  const noise = (i: number, j: number) => {
    const u = (wrap(i, N) / N) * G, v = (wrap(j, N) / N) * G;
    const c = Math.floor(u), r = Math.floor(v);
    const fu = smooth(u - c), fv = smooth(v - r);
    const top = rnd(c, r) + (rnd(c + 1, r) - rnd(c, r)) * fu;
    const bot = rnd(c, r + 1) + (rnd(c + 1, r + 1) - rnd(c, r + 1)) * fu;
    return top + (bot - top) * fv;
  };
  /** the country a hex lies in: the nearest settlement, its repeats counted as the tile repeats. */
  const country = (q: number, r: number): number => {
    let best: { d: number; k: string } | null = null;
    for (const t of SPREAD) {
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
        const d = hd([q, r], [t.q + a * N - b * (N >> 1), t.r + b * N]);
        if (!best || d < best.d) best = { d, k: t.k };
      }
    }
    return keys.indexOf(best?.k ?? '');
  };
  const hexes: string[] = [];
  for (let j = -1; j <= N; j++) {
    for (let i = -1; i <= N; i++) {
      const drift = Math.round(noise(i, j) * 2 - 1);
      const k = Math.min(keys.length - 1, Math.max(0, country(i - ((j - (j & 1)) >> 1), j) + drift));
      const cx = SQ3 * R * (i + (j & 1) / 2), cy = 1.5 * R * j;
      // a path, not a polygon: M10 counts the sheet's polygons as its cells, and the ground is not one
      hexes.push(`      <path d="M${hexPts(cx, cy, gr).split(' ').join('L')}Z" fill="${towardHeld(COL[keys[k]], F.deep_close)}"/>`);
    }
  }
  return [
    `    <pattern id="hexgrid" width="${w.toFixed(1)}" height="${h.toFixed(1)}" patternUnits="userSpaceOnUse">`,
    ...hexes,
    '    </pattern>',
  ];
}
/** How many fields of ground are laid past each edge — enough that the frame is hexes at the lowest zoom. */
const GROUND_SPAN = 3;
/** The ground's own box: the field laid `GROUND_SPAN` fields past each edge. */
function groundBox(v: { vx: number; vy: number; vw: number; vh: number }) {
  const x = v.vx - GROUND_SPAN * v.vw, y = v.vy - GROUND_SPAN * v.vh;
  return { x, y, w: v.vw * (2 * GROUND_SPAN + 1), h: v.vh * (2 * GROUND_SPAN + 1) };
}
function groundRects(v: { vx: number; vy: number; vw: number; vh: number }): string[] {
  const b = groundBox(v);
  const box = `x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${b.w.toFixed(1)}" height="${b.h.toFixed(1)}"`;
  return [
    `  <rect class="paper" ${box} fill="${F.sheet}"/>`,
    `  <rect ${box} fill="url(#hexgrid)"/>`,
  ];
}

function render(): string {
  const v = viewBox();
  const projected = projectedViewBox(v);
  for (const href of Object.keys(footprints)) hexArtwork(href);
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<!-- GENERATED by tools/map.ts from tools/data/map.json — do not hand-edit. One polygon per cell of the ${F.cols} x ${F.rows} field; the content in the cells is the engine's. -->`,
    `<svg xmlns="http://www.w3.org/2000/svg" data-plan-view-box="${v.vx} ${v.vy} ${v.vw} ${v.vh}" viewBox="${projected.vx.toFixed(1)} ${projected.vy.toFixed(1)} ${projected.vw.toFixed(1)} ${projected.vh.toFixed(1)}" width="${Math.round(projected.vw)}" height="${Math.round(projected.vh)}" font-family="Inter, 'Segoe UI', system-ui, sans-serif">`,
    '  <defs>',
    ...registeredDefinitions.values(),
    '    <g id="icon-town" fill="none" stroke="#6f5732" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">',
    ...['M3 15 16 4l13 11M6 13v15h20V13M12 28v-9h8v9', 'M9 15h3M20 15h3', 'M16 4V2'].map((d) => `      <path d="${d}"/>`),
    '    </g>',
    ...hexGridDefs(),
    '  </defs>',
    `  <g id="projected-board" transform="${MAP_CAMERA_TRANSFORM}">`,
    '  <g id="layer-surface">',
    ...groundRects(v),
    ...depthGroup(),
    ...fieldGroup(),
    ...walkGroup(),
    '  </g>',
    ...dioramaGroup(),
    '  <g id="layer-objects">',
    ...actorGroup(),
    ...watermarkGroup(),
    ...regionGroup(),
    ...labelGroups(),
    ...markersGroup(),
    '  </g>',
    '  </g>',
    '</svg>',
    '',
  ];
  return lines.join('\n');
}

function write() {
  const v = viewBox();
  const projected = projectedViewBox(v);
  const svg = render();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  // Replace atomically so Vite never reads a partially written sheet on Windows.
  const draft = OUT + '.tmp';
  fs.writeFileSync(draft, svg);
  fs.renameSync(draft, OUT);
  const templateDir = path.join(ROOT, 'game/public/map/terrain/templates');
  fs.mkdirSync(templateDir, { recursive: true });
  const width = 1024, height = 625;
  const vertices = PROJ_HEX.points.map(p => [
    (p.x - PROJ_HEX.x) / PROJ_HEX.width * width,
    (p.y - PROJ_HEX.y) / PROJ_HEX.height * height,
  ]);
  const points = vertices.map(p => p.join(',')).join(' ');
  fs.writeFileSync(path.join(templateDir, 'terrain-hex.svg'), `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><polygon points="${points}" fill="#6e8749"/></svg>\n`);
  fs.writeFileSync(path.join(templateDir, 'terrain-hex.json'), JSON.stringify({
    width, height, vertices, center: [width / 2, height / 2],
    projectedAspect: PROJ_HEX.width / PROJ_HEX.height,
    projection: MAP_CAMERA_TRANSFORM,
    placement: 'Full canvas maps to projected hex bounds; no alpha crop, no extra rotation. Vertex 1 is upper-right; subsequent vertices follow clockwise in screen coordinates.',
  }, null, 2) + '\n');
  const subs = MAP.cells.reduce((n, c) => n + c.subs.length, 0);
  const wild = MAP.cells.reduce((n, c) => n + c.wild.length, 0);
  console.log(`wrote ${path.relative(ROOT, OUT)} · ${CELLS.size} cells of a ${F.cols} x ${F.rows} field · ${MAP.cells.length} settlements · ${subs} sub-zone cells · ${wild} wild cells · ${WALK.length} walk stretches / ${WALK.reduce((n, e) => n + e.blocks, 0)} blocks · ${Math.round(projected.vw)}x${Math.round(projected.vh)} (ratio ${(projected.vw / projected.vh).toFixed(4)})`);
}

// ------------------------------------------------------------------ the gate

/** Nothing under engine/ or game/src/ may read a coordinate table (X33). */
function sources(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) sources(p, out);
    else if (/\.(ts|js|svelte)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** What M13 measured, so its PASS line reports the field rather than a typed figure. */
let M13NOTE = '';

function checks() {
  const problems = [];
  const landmarkAssignments = MAP.settlement_landmarks || {};
  const settlementNames = MAP.cells.map(c => c.town);
  if (Object.keys(landmarkAssignments).length !== settlementNames.length || settlementNames.some(town => !LANDMARK_ART[landmarkAssignments[town]])) {
    problems.push('settlement landmark assignments must cover every town with a known art type');
  }
  for (const [town, landmark] of Object.entries(landmarkAssignments)) {
    if (!settlementNames.includes(town)) problems.push(`settlement landmark assignment names unknown town ${town}`);
    if (!LANDMARK_ART[landmark]) problems.push(`settlement ${town} references unknown landmark art ${landmark}`);
    else if (!fs.existsSync(path.join(ROOT, 'game/public', LANDMARK_ART[landmark].slice(1)))) problems.push(`landmark art file is missing for ${town}: ${LANDMARK_ART[landmark]}`);
  }
  for (const [name, asset] of Object.entries(LANDMARK_ART)) {
    if (!fs.existsSync(path.join(ROOT, 'game/public', asset.slice(1)))) problems.push(`landmark art file is missing for type ${name}: ${asset}`);
  }
  // the five-block reach of the standing rule is a design window, not a wiring fact (owner ruling ·
  // AGENTS §3): a far cell is only ever reported, never a failure.
  M13NOTE = '';
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
  // M6 · every sub-zone and wild cell is a side of its own town
  for (const c of MAP.cells) {
    const t = CELLS.get(c.cell);
    if (!t) continue;
    for (const cell of [...c.subs.map((s) => s.cell), ...c.wild.map((w) => w.cell)]) {
      const h = CELLS.get(cell);
      if (h && hd([h.q, h.r], [t.q, t.r]) !== 1) problems.push(`${c.town} cell ${cell} is not a side of ${c.cell}`);
    }
  }
  // M7 · presentation only: no coordinate table is read by the simulation
  const readers = [...sources(path.join(ROOT, 'engine')), ...sources(path.join(ROOT, 'game/src'))]
    .filter((f) => /map\.json/.test(fs.readFileSync(f, 'utf8')));
  if (readers.length) problems.push(`map.json is read by ${readers.map((f) => path.relative(ROOT, f)).join(', ')} — the simulation may not read a coordinate (X33)`);
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
    if (!s) { problems.push(`settlement ${c.town} is not in town.json`); continue; }
    const zone = zoneById(s.zone);
    if (!zone) { problems.push(`settlement ${c.town} holds zone ${s.zone}, which engine.json does not carry`); continue; }
    const subs = (zone.subzones || []);
    if (c.subs.length !== subs.length) problems.push(`settlement ${c.town} owns ${c.subs.length} sub-zone cells for ${subs.length} sub-zones`);
    // wild sides are the ground a town has left over; the count follows the field, so only a town with
    // no wild side at all is a defect here — three was never the rule, it was today's shape
    if (!c.wild.length) problems.push(`settlement ${c.town} owns no wild cell — every side is claimed`);
    subs.forEach((sub, j) => {
      const h = CELLS.get(c.subs[j]?.cell ?? '');
      if (!h) return;
      const k = key(h.q, h.r);
      const claim = claims.get(k);
      if (!claim?.name || claim.name !== sub.name) {
        problems.push(`sub-zone "${sub.name}" of ${c.town} is not the name printed on its cell ${c.subs[j]?.cell ?? ''}`);
      }
    });
  }
  // M13 · the standing rule is honest on the written sheet: every cell a click can land on resolves to
  //        the settlement that owns it by distance alone, a claimed cell is owned by the settlement
  //        printed on it, nothing within a side of two towns ties, and bare ground is never closer than
  //        two blocks. This is the gate that makes "every hex is a place to stand" a derivation rather
  //        than an assumption — a cell that resolved to no owner would be the hex that does nothing.
  try {
    const svg = fs.readFileSync(OUT, 'utf8');
    const attr = (tag: string, name: string): string | null => { const m = new RegExp(`${name}="([^"]*)"`).exec(tag); return m ? m[1] : null; };
    let rankMax = 0;
    let read = 0;
    for (const m of svg.matchAll(/<polygon ([^>]*class="cell [^>]*)>/g)) {
      const tag = m[1];
      read++;
      const ax = attr(tag, 'data-ax');
      if (!ax || !/,/.test(ax)) { problems.push('a cell polygon carries no axial key to walk from'); continue; }
      const [q, r] = ax.split(',').map(Number);
      const h = { q, r };
      const rank = ROAD.cellRank(h);
      rankMax = Math.max(rankMax, rank);
      const tied = ROAD.owners(h);
      if (rank <= 1 && tied.length > 1) problems.push(`cell ${ax} ranks ${rank} and ties between ${tied.map((n) => n.id).join(', ')} — a side cannot have two owners`);
      const node = attr(tag, 'data-node');
      const owner = ROAD.owningNode(h, STANDING);
      if (node && owner.id !== node) problems.push(`cell ${ax} is printed as ${node}'s but the nearest settlement is ${owner.id}`);
      if (!node && rank < 2) problems.push(`cell ${ax} is bare ground yet ranks ${rank} — it belongs to ${owner.id}`);
      const zone = attr(tag, 'data-zone');
      const ownerZone = settlementById(owner.id)?.zone;
      if (zone && String(ownerZone) !== zone) problems.push(`cell ${ax} prints zone ${zone} but ${owner.id} holds ${ownerZone}`);
      const sub = attr(tag, 'data-sub'), wild = attr(tag, 'data-wild');
      if (rank === 0 && (sub != null || wild != null)) problems.push(`cell ${ax} is a settlement and carries a sub/wild index`);
    }
    if (read !== F.hexes) problems.push(`the standing rule read ${read} cell polygons, not the ${F.hexes} the field declares`);
    M13NOTE = `${read} cells resolve, and ${rankMax} blocks is the farthest any of them sits from a settlement`;
  } catch { problems.push('sheet not written — run node tools/map.ts --write'); }
  // M15 · every cell, including settlements, has one correctly placed art group.
  // Registered hex art checks the six-sector definitions; legacy scenery checks its anchor.
  try {
    const svg = fs.readFileSync(OUT, 'utf8');
    const figures = svg.split('<g class="diorama-figure"').slice(1);
    let pieces = 0;
    for (const figure of figures) {
      const href = /data-art-href="([^"]+)"/.exec(figure)?.[1] ?? /href="([^"]+)"/.exec(figure)?.[1] ?? '';
      if (!href) { problems.push('terrain piece has no art reference'); continue; }
      pieces++;
      if (!fs.existsSync(path.join(ROOT, 'game/public', href.slice(1)))) problems.push(`terrain piece ${href} is missing`);
      if (!figure.includes('<g class="diorama-art">')) problems.push(`terrain piece ${href} is not wrapped as one diorama art group`);
      if (figure.includes('clip-path=')) problems.push(`terrain piece ${href} is still clipped`);
      if (href in footprints) {
        if (!figure.includes(hexArtwork(href)) || !svg.includes(registeredDefinitions.get(href)!)) problems.push(`terrain piece ${href} does not match its measured footprint registration`);
        continue;
      }
      // Unregistered legacy scenery retains its painted-bounds anchor.
      const m = /<svg class="" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/.exec(figure)
        || /<image class="[^"]*" href="[^"]+" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/.exec(figure);
      if (!m) { problems.push(`terrain piece ${href} is not one measured sprite`); continue; }
      const [x, y, w, h] = m.slice(1).map(Number);
      if (Math.abs(w - TERRAIN_PIECE.width) > .01) problems.push(`terrain piece ${href} is ${w} wide, not the projected hex width`);
      if (Math.abs(x + w / 2) > .01) problems.push(`terrain piece ${href} is not centred on its cell`);
      if (Math.abs(y + h - TERRAIN_PIECE.bottom) > .01) problems.push(`terrain piece ${href} does not stand on the projected lower edge`);
    }
    const expected = F.hexes;
    if (pieces !== expected) problems.push(`sheet carries ${pieces} terrain pieces for ${expected} cells`);
  } catch { problems.push('sheet not written — run node tools/map.ts --write'); }
  return { problems };
}

const args = process.argv.slice(2);
if (args.includes('--checks')) {
  const { problems } = checks();
  const g = G.gates();
  // Each gate claims the problems its own check raised, so a problem is printed by the gate that
  // owns it and an UNCLAIMED problem cannot hide behind a row that still reads PASS.
  const claim = (id: string, re: RegExp, detail: string) => {
    const mine = problems.filter((p: string) => re.test(p));
    g.add(id, mine.length === 0, mine.length ? mine.join(' · ') : detail);
  };
  const subs = MAP.cells.reduce((n, c) => n + c.subs.length, 0);
  const wild = MAP.cells.reduce((n, c) => n + c.wild.length, 0);
  claim('M2', /outside the|claimed by/, `all ${subs + wild + MAP.cells.length} claimed cells are on the field, none claimed twice`);
  claim('M3', /walk graph|walk node|the sheet says/, `the sheet's cells and the walk graph's ${roadNodes.length} axial nodes are the same lattice`);
  claim('M6', /not a side of/, 'every sub-zone and wild cell is a side of its own town');
  claim('M7', /may not read a coordinate/, 'no file under engine/ or game/src/ reads map.json — cells stay presentation (X33)');
  claim('M10', /cell polygons|cell keys|travel pins|walk stretches|sheet not written/, `the sheet carries ${F.hexes} keyed cells, a pin per settlement and ${WALK.length} walk stretches`);
  claim('M11', /sub-zone cells for|no wild cell|not the name printed/, `one named sub-zone cell per sub-zone (${subs}) and a wild side left for every town (${wild})`);
  claim('M13', /no click there|two owners|printed as|bare ground yet|carries no axial key|carries a sub\/wild index|prints zone|standing rule read/, `every cell a click can land on resolves to the settlement that owns it, by distance alone (${M13NOTE})`);
  claim('M14', /settlement landmark assignment|landmark art file/, `all ${MAP.cells.length} settlements use known, present landmark art files`);
  claim('M15', /terrain piece|sheet not written/, `full-hex canvases match projected bounds; legacy scenery is centred and bottom-anchored (artwork silhouettes are not certified)`);
  G.report(g.rows());
} else if (args.includes('--write')) {
  write();
} else {
  console.log('map.ts — the generated field sheet');
  console.log('  --write    write game/src/icon/map/map-overlay.svg from tools/data/map.json');
  console.log('  --checks   run M2, M3, M6, M7, M10, M11, M13, M14, M15 (field, landmark and terrain placement consistency)');
}
