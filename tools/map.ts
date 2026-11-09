/**
 * Map layer — the generated field sheet (`tools/data/map.json`).
 *
 *   node tools/map.ts            help
 *   node tools/map.ts --write    write the sheet (game/src/icon/map/map-overlay.svg)
 *   node tools/map.ts --checks   run M2-M15, exit 1 on FAIL
 *
 * The sheet is the land mask the walk graph lives on: one polygon per land cell, tinted by the
 * terrain that cell stands on, with a settlement mark on its own cell, a named sub-zone cell near
 * it, mine/grove/dungeon cells (plus fishing where the zone has a fishing source) beside it, and
 * bare ground rolling the local side's terrain. Sea cells carry no polygon. Every land cell carries
 * its id (`q,r`) and its axial key, so the client can light up a plotted route by matching the keys
 * the road module hands back — it never reads a coordinate table, which M7 enforces (X33 · M7 · M10).
 * What the cells hold — sub-zone names, level bands, Species — is the engine's, printed here and
 * never typed.
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
import { createWorld } from '../engine/world.ts';
import { MAP_CAMERA_TRANSFORM, projectMapPoint, mapUprightAt, mapUprightAround, projectMapBounds, projectedHex } from '../game/src/ui/map/map-projection.ts';
import { TERRAIN_ART, TERRAIN_RELIEF } from '../game/src/ui/map/map-terrain.ts';
import { mapSpriteWidth, mapSpriteWidthScale } from '../game/src/ui/map/map-sprites.ts';
import type { EngineData, MobZone } from '../engine/types.ts';

/**
 * The map data's own shape (`tools/data/map.json`) — the presentation the sheet draws. The tool
 * reads it through these declarations, so a key that moves is a type error here rather than a
 * silent `undefined` three hundred lines down.
 */
interface MapField {
  hexes: number;
  radius: number;
  gap: number;
  sheet: string;
  stroke: string;
  bare_tone: string;
  ground_ramp: string[];
  deep_close: number;
}
interface MapPlate {
  id: string;
  name: string;
  zones: number[];
}
interface MapData {
  field: MapField;
  terrain_colors: Record<string, string>;
  settlement_landmarks: Record<string, string>;
  watermarks: { id: string; anchor: string; kind: string; label?: string }[];
  plates: MapPlate[];
  regions: { name: string; zones: number[] }[];
  plate_anchors?: Record<string, string>;
  terrain_art_zones?: number[];
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
/** The complete projected ground footprint, centred on the cell origin. */
const PROJ_HEX = projectedHex(HEX_R);
/** Separate scenery keeps its measured painted bottom inside the cell. */
const TERRAIN_PIECE = { width: PROJ_HEX.width * .98, bottom: -PROJ_HEX.y * .98 };

const registeredArtwork = new Map<string, string>();
const registeredDefinitions = new Map<string, string>();
/** Square, unprojected textures fill the hex directly, without warping their pixels. */
function hexArtwork(href: string): string {
  const cached = registeredArtwork.get(href);
  if (cached) return cached;
  const id = 'terrain-' + href.replace(/[^a-z0-9-]/gi, '-');
  const outline = PROJ_HEX.points.map(p=>`${p.x},${p.y}`).join(' ');
  const size = HEX_R * 2;
  registeredDefinitions.set(href, `<pattern id="${id}" patternUnits="userSpaceOnUse" x="${-size / 2}" y="${-size / 2}" width="${size}" height="${size}"><image href="${href}" width="${size}" height="${size}"/></pattern>`);
  const markup = `<g class="terrain-ground" data-art-href="${href}"><polygon points="${outline}" fill="url(#${id})"/></g>`;
  registeredArtwork.set(href, markup);
  return markup;
}
const TOWN_ART = TERRAIN_RELIEF.town;
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

const settlementIds: string[] = TOWN.settlements.map((s) => s.id);
const settlementById = (id: string): TownRow | undefined => TOWN.settlements.find((s) => s.id === id);
const zoneById = (id: number) => E.mob.zones.find((z) => z.id === id);
const roadNodes = E.road.nodes;
/** The walk graph itself, so M13 can ask the engine who owns a cell rather than assume it. */
const ROAD = createRoad(E);
/** The canonical world queries: the same bare-terrain resolver the runtime reads, so the sheet and the game cannot disagree. */
const WORLD = createWorld(E, TOWN.settlements);
/** The order a tied cell is resolved in: `road.standing_rule` gives it to the lowest zone. */
const STANDING: string[] = TOWN.settlements.slice().sort((a, b) => a.zone - b.zone).map((s) => s.id);

// ------------------------------------------------------------------ the lattice

/** One land cell of the sheet, in the engine's own axial frame. */
interface CellRow {
  q: number;
  r: number;
  x: number;
  y: number;
  id: string;
}

/**
 * The sheet is built from the canonical land mask, so the field is the shape the walk graph can
 * actually reach and the sea between the plates is simply absent. A cell id is its axial key: the
 * same address a walk, a route and a click already speak, with no second coordinate table.
 */
const CELLS = new Map<string, CellRow>();
for (const [q, r] of E.road.land ?? []) {
  const id = key(q, r);
  const [x, y] = PX([q, r]);
  CELLS.set(id, { q, r, x, y, id });
}
if (!CELLS.size) throw new Error('engine.json road.land is empty — the land mask is what the sheet draws');
/** The sheet cell a settlement's walk node lands on. */
const cellOfTown = (id: string): CellRow | undefined => {
  const n = ROAD.nodeById(id);
  return n ? CELLS.get(key(n.q, n.r)) : undefined;
};

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

/**
 * The claims, read off the canonical location registry: a town's own cell, its named sub-zone
 * cells, and the wild-side blocks that carry a mine, grove, fishing spot or dungeon entrance. Level
 * bands and sub-zone names come from the engine, read through the settlement's zone, so a cell never
 * carries a number this file typed.
 */
type SiteKind = 'dungeon' | 'mine' | 'grove' | 'fishing';
const SITE_KINDS: SiteKind[] = ['dungeon', 'mine', 'grove', 'fishing'];
/** Fishing belongs to a zone that authors a fishing food; every other zone still owns the other three. */
const FISHING_ZONES = new Set(TOWN.settlements
  .filter((s) => {
    const food = E.fieldwork.regional_sources[String(s.zone)]?.food;
    return !!food && E.fieldwork.fishing.foods.includes(food);
  })
  .map((s) => s.id));
const siteKindsFor = (town: string): SiteKind[] =>
  FISHING_ZONES.has(town) ? SITE_KINDS : SITE_KINDS.filter((kind) => kind !== 'fishing');
const siteName = (s: TownRow, site: SiteKind) =>
  site === 'dungeon' ? s.name + ' Wild Side · Dungeon' : site === 'grove' ? s.name + ' Wild Side · Grove'
    : site === 'fishing' ? s.name + ' Wild Side · Fishing' : s.name + ' Wild Side · Mine';
/** What stands on a cell: a settlement, a named side of one, or a wild-side site. */
interface Claim {
  kind: 'town' | 'sub' | 'site';
  /** Which side of the settlement the cell is — the sub-zone index. */
  j?: number;
  /** Which site stands on this bare block. */
  site?: SiteKind;
  town: string;
  cell: string;
  terrain: string;
  zone: MobZone;
  s: TownRow;
  name?: string;
  q: number;
  r: number;
}

const townByZone = new Map(TOWN.settlements.map((s) => [s.zone, s]));
const claims = new Map<string, Claim>();
for (const loc of ROAD.locations) {
  const s = townByZone.get(loc.zone);
  if (!s) throw new Error(`road location ${loc.id} names zone ${loc.zone}, which town.json has no settlement for`);
  const zone = zoneById(s.zone);
  if (!zone) throw new Error(`settlement ${s.id} holds zone ${s.zone}, which engine.json does not carry`);
  const cell = CELLS.get(key(loc.q, loc.r));
  if (!cell) throw new Error(`road location ${loc.id} sits on ${loc.q},${loc.r}, which is not land`);
  if (claims.has(key(loc.q, loc.r))) throw new Error(`two road locations claim ${loc.q},${loc.r}`);
  if (!COL[loc.terrain]) throw new Error(`road location ${loc.id} prints unknown terrain ${loc.terrain}`);
  let claim: Claim;
  if (loc.kind === 'town') {
    claim = { kind: 'town', town: s.id, cell: cell.id, terrain: 'town', zone, s, q: loc.q, r: loc.r };
  } else if (loc.kind === 'sub') {
    const subzone = (zone.subzones || [])[loc.index];
    if (!subzone) throw new Error(`road location ${loc.id} names sub-zone ${loc.index}, which zone ${zone.id} does not carry`);
    claim = { kind: 'sub', j: loc.index, town: s.id, cell: cell.id, terrain: loc.terrain, zone, s, name: subzone.name, q: loc.q, r: loc.r };
  } else {
    const site = loc.site as SiteKind | undefined;
    if (!site || !SITE_KINDS.includes(site)) throw new Error(`road location ${loc.id} names unknown site ${String(loc.site)}`);
    claim = { kind: 'site', site, town: s.id, cell: cell.id, terrain: loc.terrain, zone, s, name: siteName(s, site), q: loc.q, r: loc.r };
  }
  claims.set(key(loc.q, loc.r), claim);
}

/** The terrain bare ground takes: its owner's nearest named side, with a little deterministic drift. */
function bareTerrain(town: string, h: { q: number; r: number }): string {
  return WORLD.bareTerrain(town, h);
}
/**
 * Bare ground: owned by the nearest settlement on foot, and printed with the terrain of that
 * settlement's nearest named side. Sea cells are absent from `CELLS`, so they get no entry.
 */
interface BareCell {
  terrain: string;
  owner: string;
  zone: MobZone;
  fill: string;
}
const BARE = new Map<string, BareCell>();
for (const c of CELLS.values()) {
  const k = key(c.q, c.r);
  if (claims.has(k)) continue;
  const owner = ROAD.owningNode({ q: c.q, r: c.r }, STANDING);
  const s = settlementById(owner.id);
  const zone = s ? zoneById(s.zone) : undefined;
  if (!s || !zone) continue;
  const terrain = bareTerrain(s.id, c);
  BARE.set(k, { terrain, owner: s.id, zone, fill: COL[terrain] ?? F.bare_tone });
}

// ------------------------------------------------------------------ the walk graph the sheet draws

/**
 * The hops a walker would take: the shortest set of walkable stretches that connects every
 * settlement, built by always adding the closest town still outside. It is a drawing of the graph
 * the simulator already derives — every pair on the mask is walkable — and each stretch is labelled
 * in blocks, which is the engine's walkable distance and nothing else.
 */
function walkGraph() {
  const T = roadNodes.map((node) => ({ id: node.id, q: node.q, r: node.r }));
  const inTree = new Set<number>([0]);
  const edges: { a: string; b: string; blocks: number }[] = [];
  while (inTree.size < T.length) {
    let best: { a: number; b: number; d: number } | null = null;
    for (const a of inTree) {
      for (let b = 0; b < T.length; b++) {
        if (inTree.has(b)) continue;
        const d = ROAD.blocksBetween(T[a].id, T[b].id);
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

function terrainFor(c: CellRow): string {
  const o = claims.get(key(c.q, c.r));
  if (o) return o.kind === 'town' ? 'town' : o.terrain;
  return BARE.get(key(c.q, c.r))?.terrain ?? 'grass';
}
const ART_ZONES = new Set<number>(MAP.terrain_art_zones ?? []);
const zoneOfCell = (c: CellRow): number | null =>
  claims.get(key(c.q, c.r))?.zone.id ?? BARE.get(key(c.q, c.r))?.zone?.id ?? null;
const anchorCells = new Set<string>();
for (const locationId of Object.values(MAP.plate_anchors ?? {})) {
  const loc = ROAD.locations.find((row) => row.id === locationId);
  if (loc) anchorCells.add(key(loc.q, loc.r));
}
const hexNeighbours: readonly (readonly [number, number])[] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
/** Deterministic relief cells: town/site landmarks plus forest edges/interior and one rock peak. */
function reliefCells(): Set<string> {
  const selected = new Set<string>();
  for (const [at, cell] of CELLS) {
    const claim = claims.get(at), terrain = terrainFor(cell);
    if (claim?.kind === 'site') continue;
    // Only an authored location hosts a building; a terrain label alone must not repeat one per hex.
    if (claim?.kind === 'town') selected.add(at);
    else if (claim?.kind === 'sub' && (claim.terrain === 'village' || claim.terrain === 'camp')) selected.add(at);
  }
  const visited = new Set<string>();
  for (const [at, start] of CELLS) {
    const terrain = terrainFor(start);
    if ((terrain !== 'forest' && terrain !== 'rock') || visited.has(at)) continue;
    const component: CellRow[] = [], stack = [start];
    while (stack.length) {
      const cell = stack.pop()!;
      const here = key(cell.q, cell.r);
      if (visited.has(here) || terrainFor(cell) !== terrain) continue;
      visited.add(here); component.push(cell);
      for (const [dq, dr] of hexNeighbours) {
        const next = CELLS.get(key(cell.q + dq, cell.r + dr));
        if (next && !visited.has(key(next.q, next.r))) stack.push(next);
      }
    }
    const boundary = component.filter((cell) => hexNeighbours.some(([dq, dr]) => {
      const next = CELLS.get(key(cell.q + dq, cell.r + dr));
      return !next || terrainFor(next) !== terrain;
    }));
    const distanceToBoundary = (cell: CellRow) => Math.min(...boundary.map((edge) =>
      (Math.abs(cell.q - edge.q) + Math.abs(cell.r - edge.r) + Math.abs(cell.q + cell.r - edge.q - edge.r)) / 2));
    const far = (cells: CellRow[]) => [...cells].sort((a, b) => distanceToBoundary(b) - distanceToBoundary(a)
      || a.q - b.q || a.r - b.r)[0];
    if (terrain === 'forest') {
      for (const cell of boundary) {
        const here = key(cell.q, cell.r);
        if (claims.get(here)?.kind !== 'site') selected.add(here);
      }
      const interior = far(component);
      if (interior && claims.get(key(interior.q, interior.r))?.kind !== 'site') selected.add(key(interior.q, interior.r));
    } else {
      const anchorCell = component.find((cell) => anchorCells.has(key(cell.q, cell.r)));
      const peak = anchorCell ?? far(component);
      if (peak && claims.get(key(peak.q, peak.r))?.kind !== 'site') selected.add(key(peak.q, peak.r));
    }
  }
  return selected;
}
const RELIEF_CELLS = reliefCells();

function fieldGroup(): string[] {
  const lines = ['  <g id="field">'];
  for (const [id, c] of CELLS) {
    const k = key(c.q, c.r);
    const o = claims.get(k);
    const bare = o ? null : BARE.get(k);
    const terrain = o ? (o.kind === 'town' ? 'town' : o.terrain) : bare?.terrain ?? 'grass';
    const cls = o ? (o.kind === 'site' ? 'bare' : o.kind) : 'bare';
    const fill = COL[terrain] ?? F.bare_tone;
    const zone = o ? o.zone : bare?.zone;
    const attrs = [
      `points="${hexPts(c.x, c.y)}"`,
      `class="cell ${cls}"`,
      `data-cell="${id}"`,
      `data-ax="${c.q},${c.r}"`,
      o ? `data-node="${o.town}"` : '',
      zone ? `data-zone="${zone.id}"` : '',
      o && o.kind === 'sub' ? `data-sub="${o.j}"` : '',
      o && o.kind === 'site' ? `data-site="${o.site}"` : '',
      o && o.kind === 'town' ? `data-landmark="${settlementLandmark(o.town)}"` : '',
      `data-terrain="${terrain}"`,
      `data-biome="${terrain}"`,
      zone ? `data-band="${zone.id - 1}"` : '',
      `fill="${fill}"`,
      `data-tone="${fill}"`,
      `stroke="${F.stroke}"`,
    ].filter(Boolean).join(' ');
    const title = o
      ? `<title>${esc(o.kind === 'town' ? o.s.name : o.name)} · ${esc(o.s.name)} · ${levelText(o.zone)}</title>`
      : `<title>${esc(settlementById(bare?.owner ?? '')?.name ?? '')} hunting ground · ${esc(terrain)}${zone ? ' · ' + levelText(zone) : ''}</title>`;
    lines.push(`    <polygon ${attrs}>${title}</polygon>`);
  }
  lines.push('  </g>');
  return lines;
}

/** Upright art is drawn back-to-front; only the ground receives the camera's foreshortening. */
function cellsBackToFront(): [string, CellRow][] {
  return [...CELLS.entries()].sort(([, a], [, b]) => projectMapPoint(a.x, a.y).y - projectMapPoint(b.x, b.y).y);
}

/** Layer 2: flat ground fills each hex; object art lives separately in the actor layer. */
function dioramaGroup(): string[] {
  const lines = ['  <g id="layer-diorama" pointer-events="none">'];
  for (const [, c] of cellsBackToFront()) {
    const terrain = terrainFor(c);
    const claim = claims.get(key(c.q, c.r));
    const zone = zoneOfCell(c);
    const allowed = zone != null && ART_ZONES.has(zone);
    const body = hexArtwork(TERRAIN_ART[terrain] || TERRAIN_ART.grass);
    const outline = PROJ_HEX.points.map(p => `${p.x},${p.y}`).join(' ');
    const node = terrain === 'town' && claim ? ` data-node="${claim.town}"` : '';
    const anchor = anchorCells.has(key(c.q, c.r)) ? ' data-anchor="true"' : '';
    lines.push(`    <g class="diorama-figure ${allowed ? 'terrain-on' : 'terrain-off'}" data-figure-ax="${c.q},${c.r}" data-terrain-zone="${allowed ? zone : ''}"${node}${anchor} transform="${mapUprightAt(c.x, c.y)}"><g class="diorama-art">${body}</g><g class="hex-calibration" fill="none" stroke="#ff47c8" stroke-width=".5" pointer-events="none"><polygon points="${outline}"/><path d="M-2 0H2M0-2V2"/></g></g>`);
  }
  lines.push('  </g>');
  return lines;
}

/** Layer 3: one actor group per cell, so mobs and events keep the board's back-to-front order. */
function actorGroup(): string[] {
  const lines = ['  <g id="actors" pointer-events="none">'];
  for (const [, c] of cellsBackToFront()) {
    const at = key(c.q, c.r), terrain = terrainFor(c), claim = claims.get(at);
    const zone = zoneOfCell(c);
    const allowed = zone != null && ART_ZONES.has(zone);
    const reliefHref = terrain === 'town'
      ? LANDMARK_ART[settlementLandmark(claim?.town ?? '')] || TERRAIN_RELIEF.town
      : TERRAIN_RELIEF[terrain];
    const relief = allowed && reliefHref && RELIEF_CELLS.has(at)
      ? `<g class="terrain-relief terrain-on">${mapSpriteWidth(reliefHref, 0, TERRAIN_PIECE.bottom, TERRAIN_PIECE.width)}</g>`
      : '';
    lines.push(`    <g class="actor-figure" data-actor-ax="${c.q},${c.r}">${relief}<g class="actor-scenery"></g><g class="actor-slot"></g><g class="actor-signals"></g></g>`);
  }
  lines.push('  </g>');
  return lines;
}

function walkGroup(): string[] {
  const lines = ['  <g id="walk">'];
  for (const e of WALK) {
    const a = cellOfTown(e.a);
    const b = cellOfTown(e.b);
    if (!a || !b) continue;
    const route = ROAD.routeBetween(e.a, e.b);
    const points = (route.length ? route : [{ q: a.q, r: a.r }, { q: b.q, r: b.r }])
      .map((h) => { const [x, y] = PX([h.q, h.r]); return `${x.toFixed(1)},${y.toFixed(1)}`; }).join(' ');
    lines.push(`    <polyline class="walk" data-from="${e.a}" data-to="${e.b}" points="${points}"/>`);
    lines.push(`    <text class="walk-blk" x="${((a.x + b.x) / 2).toFixed(1)}" y="${((a.y + b.y) / 2 - 4).toFixed(1)}">${e.blocks} blk</text>`);
  }
  lines.push('  </g>');
  return lines;
}


function labelGroups(): string[] {
  const towns: string[] = [], zones: string[] = [], ids: string[] = [];
  for (const s of TOWN.settlements) {
    const zone = zoneById(s.zone);
    if (!zone) throw new Error(`settlement ${s.id} holds zone ${s.zone}, which engine.json does not carry`);
    const c = cellOfTown(s.id);
    if (!c) throw new Error(`the walk graph has no land cell for settlement ${s.id}`);
    towns.push(`    <g class="node${s.capital ? ' capital' : ''}" data-node="${s.id}" data-zone="${zone.id}" transform="${mapUprightAround(c.x, c.y)}">`
      + `<use href="#icon-town" transform="translate(${(c.x - 6.8).toFixed(1)},${(c.y - 18).toFixed(1)}) scale(0.42)"/>`
      + `<text class="place" x="${c.x.toFixed(1)}" y="${(c.y + 18).toFixed(1)}">${esc(s.name)}</text>`
      + `</g>`);
    ids.push(`    <text class="cellid" data-cell="${c.id}" x="${c.x.toFixed(1)}" y="${(c.y + 14).toFixed(1)}">${c.id}</text>`);
    const put = (cell: CellRow, name: string, band: MobZone) => {
      const lines = wrap(name, 12);
      const lh = 8.4, top = cell.y - ((lines.length - 1) * lh) / 2 - 9;
      zones.push(`    <g class="zonelabel" data-cell="${cell.id}" transform="${mapUprightAround(cell.x, cell.y)}">`
        + lines.map((l, i) => `<text class="zonename" x="${cell.x.toFixed(1)}" y="${(top + i * lh).toFixed(1)}">${esc(l)}</text>`).join('')
        + `<text class="zoneband" x="${cell.x.toFixed(1)}" y="${(cell.y + 13).toFixed(1)}">${levelText(band)}</text>`
        + `</g>`);
      ids.push(`    <text class="cellid" data-cell="${cell.id}" x="${cell.x.toFixed(1)}" y="${(cell.y + 22).toFixed(1)}">${cell.id}</text>`);
    };
    for (const claim of claims.values()) {
      if (claim.town !== s.id) continue;
      if (claim.kind === 'sub') put(CELLS.get(claim.cell)!, claim.name || claim.cell, zone);
      else if (claim.kind === 'site') put(CELLS.get(claim.cell)!, claim.name || claim.cell, zone);
    }
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
  const centroid = (zones: number[]) => {
    const pts = zones.map((z) => TOWN.settlements.find((s) => s.zone === z))
      .map((s) => (s ? cellOfTown(s.id) : undefined))
      .filter((p): p is CellRow => Boolean(p));
    if (!pts.length) return null;
    return { x: pts.reduce((n, p) => n + p.x, 0) / pts.length, y: pts.reduce((n, p) => n + p.y, 0) / pts.length };
  };
  for (const plate of MAP.plates) {
    const at = centroid(plate.zones);
    if (!at) continue;
    lines.push(`    <text class="region plate" data-plate="${plate.id}" data-zone="${plate.zones.join(' ')}" x="${at.x.toFixed(1)}" y="${at.y.toFixed(1)}">${esc(plate.name)}</text>`);
  }
  for (const r of MAP.regions) {
    const at = centroid(r.zones);
    if (!at) continue;
    lines.push(`    <text class="region" data-zone="${r.zones.join(' ')}" x="${at.x.toFixed(1)}" y="${at.y.toFixed(1)}">${esc(r.name)}</text>`);
  }
  lines.push('  </g>');
  return lines;
}

/** A landmark mark on its settlement's own cell: not architecture, so it never reads as a town. */
function watermarkGroup(): string[] {
  const lines = ['  <g id="watermarks">'];
  for (const w of MAP.watermarks) {
    const c = cellOfTown(w.anchor);
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
  for (const entry of TOWN.settlements) {
    const c = cellOfTown(entry.id);
    if (!c) continue;
    lines.push(`    <g class="pin" data-node="${entry.id}"><circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="16"/><circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="7"/></g>`);
  }
  lines.push('  </g>');
  return lines;
}

function viewBox(): { vx: number; vy: number; vw: number; vh: number } {
  const xs = [...CELLS.values()].map((c) => c.x), ys = [...CELLS.values()].map((c) => c.y);
  const padX = (SQ3 * R) / 2 + 1, padY = R + 1;
  const vx = Math.min(...xs) - padX, vy = Math.min(...ys) - padY;
  const vw = Math.max(...xs) + padX - vx, vh = Math.max(...ys) + padY - vy;
  return { vx, vy, vw, vh };
}

/** Compress the field around its center to project it from a 46-degree camera elevation. */
const projectedViewBox = projectMapBounds;

/**
 * The ground the field lies on: a flat `var(--panel)` sheet laid on past the field so zooming
 * out never reaches an edge, with the same hex lattice drawn over it as a blue glowing gutter
 * grid (stroke only, no terrain fill). The 300 field cells keep their own terrain tones; the
 * endless past them is panel with blue hex gutters.
 */
function hexGridDefs(): string[] {
  const N = 32;
  const w = N * SQ3 * R, h = N * 1.5 * R;
  // the grid closes half the seam the cells keep, so gutters read as lines and not as a mesh
  const gr = R - F.gap / (2 * SQ3);
  const hexes: string[] = [];
  for (let j = -1; j <= N; j++) {
    for (let i = -1; i <= N; i++) {
      const cx = SQ3 * R * (i + (j & 1) / 2), cy = 1.5 * R * j;
      // a path, not a polygon: M10 counts the sheet's polygons as its cells, and the ground is not one
      hexes.push(`      <path d="M${hexPts(cx, cy, gr).split(' ').join('L')}Z" fill="none" stroke="var(--es)" stroke-opacity="0.32" stroke-width="1"/>`);
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
  // Flat-panel endless with a blue glowing gutter grid over it; the field cells sit above both.
  return [
    `  <rect class="paper" ${box} fill="var(--panel)"/>`,
    `  <rect class="ground-grid" ${box} fill="url(#hexgrid)"/>`,
  ];
}

function render(): string {
  const v = viewBox();
  const projected = projectedViewBox(v);
  const dioramas = dioramaGroup();
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<!-- GENERATED by tools/map.ts from tools/data/engine.json road.land + tools/data/map.json — do not hand-edit. One polygon per land cell; the content in the cells is the engine's. -->`,
    `<svg xmlns="http://www.w3.org/2000/svg" data-plan-view-box="${v.vx} ${v.vy} ${v.vw} ${v.vh}" viewBox="${projected.vx.toFixed(1)} ${projected.vy.toFixed(1)} ${projected.vw.toFixed(1)} ${projected.vh.toFixed(1)}" width="${Math.round(projected.vw)}" height="${Math.round(projected.vh)}" font-family="Inter, 'Segoe UI', system-ui, sans-serif">`,
    '  <defs>',
    ...registeredDefinitions.values(),
    '    <g id="icon-town" fill="none" stroke="#e6d2a8" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">',
    ...['M3 15 16 4l13 11M6 13v15h20V13M12 28v-9h8v9', 'M9 15h3M20 15h3', 'M16 4V2'].map((d) => `      <path d="${d}"/>`),
    '    </g>',
    ...hexGridDefs(),
    '  </defs>',
    `  <g id="projected-board" transform="${MAP_CAMERA_TRANSFORM}">`,
    '  <g id="layer-surface">',
    ...groundRects(v),
    ...fieldGroup(),
    ...walkGroup(),
    '  </g>',
    ...dioramas,
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
  const templateDir = path.join(ROOT, 'art-reference/map/geometry');
  fs.mkdirSync(templateDir, { recursive: true });
  const width = 1024, height = Math.round(width * PROJ_HEX.height / PROJ_HEX.width);
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
    placement: 'Square surface textures fill regular hex masks without perspective warping. Vertex 1 is upper-right; subsequent vertices follow clockwise in screen coordinates.',
  }, null, 2) + '\n');
  const subs = [...claims.values()].filter((c) => c.kind === 'sub').length;
  const sites = [...claims.values()].filter((c) => c.kind === 'site').length;
  console.log(`wrote ${path.relative(ROOT, OUT)} · ${CELLS.size} land cells · ${TOWN.settlements.length} settlements · ${subs} sub-zone cells · ${sites} site cells · ${WALK.length} walk stretches / ${WALK.reduce((n, e) => n + e.blocks, 0)} blocks · ${Math.round(projected.vw)}x${Math.round(projected.vh)} (ratio ${(projected.vw / projected.vh).toFixed(4)})`);
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
  const problems: string[] = [];
  const settlementNames = TOWN.settlements.map((s) => s.id);
  const landmarkAssignments = MAP.settlement_landmarks || {};
  if (Object.keys(landmarkAssignments).length !== settlementNames.length || settlementNames.some((town) => !LANDMARK_ART[landmarkAssignments[town]])) {
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
  M13NOTE = '';
  // M2 · every authored location is a land cell, and no cell is claimed twice.
  const seen = new Map<string, string>();
  for (const loc of ROAD.locations) {
    const c = CELLS.get(key(loc.q, loc.r));
    if (!c) { problems.push(`road location ${loc.id} sits on ${loc.q},${loc.r}, which is outside the land mask`); continue; }
    if (seen.has(c.id)) problems.push(`land cell ${c.id} is claimed by ${seen.get(c.id)} and ${loc.id}`);
    seen.set(c.id, loc.id);
    if (!COL[loc.terrain]) problems.push(`road location ${loc.id} prints unknown terrain ${loc.terrain}`);
    if (!claims.has(key(loc.q, loc.r))) problems.push(`road location ${loc.id} carries no sheet claim`);
  }
  if (F.hexes !== CELLS.size) problems.push(`map.json declares ${F.hexes} land cells but the mask carries ${CELLS.size}`);
  // M3 · the sheet and the walk graph are the same lattice: each settlement's cell is where its
  //        axial coordinates land, and no two settlements share a cell.
  for (const s of TOWN.settlements) {
    const node = ROAD.nodeById(s.id);
    if (!node) { problems.push(`the walk graph has no node for settlement ${s.id}`); continue; }
    if (!ROAD.isLand(node)) problems.push(`walk node ${s.id} sits on a sea cell`);
    const c = CELLS.get(key(node.q, node.r));
    if (!c) { problems.push(`settlement ${s.id}: the walk graph's ${node.q},${node.r} is off the land`); continue; }
    const claim = claims.get(key(c.q, c.r));
    if (!claim || claim.kind !== 'town' || claim.town !== s.id) problems.push(`settlement ${s.id} does not own its walk node cell ${c.id}`);
  }
  if (roadNodes.length !== settlementIds.length) problems.push(`${roadNodes.length} walk nodes for ${settlementIds.length} settlements`);
  const nodeCells = new Set<string>();
  for (const n of roadNodes) {
    if (nodeCells.has(key(n.q, n.r))) problems.push(`two settlements share walk cell ${n.q},${n.r}`);
    nodeCells.add(key(n.q, n.r));
  }
  // M6 · every named side and wild-side site sits within two walkable blocks of its own town.
  for (const claim of claims.values()) {
    if (claim.kind === 'town') continue;
    const town = cellOfTown(claim.town);
    if (!town) { problems.push(`${claim.town} has no town cell for ${claim.cell}`); continue; }
    const d = ROAD.blocksBetweenHex({ q: claim.q, r: claim.r }, { q: town.q, r: town.r });
    if (d > 2) problems.push(`${claim.town} cell ${claim.cell} is ${d} blocks from ${town.id} — not beside its own town`);
  }
  // M7 · presentation only: no coordinate table is read by the simulation
  const readers = [...sources(path.join(ROOT, 'engine')), ...sources(path.join(ROOT, 'game/src'))]
    .filter((f) => /map\.json/.test(fs.readFileSync(f, 'utf8')));
  if (readers.length) problems.push(`map.json is read by ${readers.map((f) => path.relative(ROOT, f)).join(', ')} — the simulation may not read a coordinate (X33)`);
  // M10 · the written sheet carries a polygon per land cell, a pin per settlement and a stretch per
  //        hop, so the client toggles by id and matches a route by cell key alone
  try {
    const svg = fs.readFileSync(OUT, 'utf8');
    const polys = (svg.match(/class="cell /g) || []).length;
    const pins = (svg.match(/class="pin"/g) || []).length;
    const hops = (svg.match(/class="walk"/g) || []).length;
    const axes = (svg.match(/data-ax="/g) || []).length;
    const cellTags = [...svg.matchAll(/<polygon ([^>]*class="cell [^>]*)>/g)].map((m) => m[1]);
    const hexes = cellTags.filter((tag) => (tag.match(/points="([^"]*)"/)?.[1].trim().split(/\s+/).length ?? 0) === 6).length;
    const ids = cellTags.filter((tag) => / data-cell="/.test(tag)).length;
    if (polys !== CELLS.size) problems.push(`sheet has ${polys} cell polygons for ${CELLS.size} land cells`);
    // a polygon with no points is invisible, and an invisible field still passes a count of tags
    if (hexes !== CELLS.size) problems.push(`sheet has ${hexes} drawn hexes for ${CELLS.size} land cells — a cell with no points is not on the sheet`);
    if (axes !== CELLS.size) problems.push(`sheet has ${axes} cell keys for ${CELLS.size} land cells — a plotted route could not be matched`);
    if (ids !== CELLS.size) problems.push(`sheet has ${ids} cell ids for ${CELLS.size} land cells`);
    if (pins !== TOWN.settlements.length) problems.push(`sheet has ${pins} travel pins for ${TOWN.settlements.length} settlements`);
    if (hops !== WALK.length) problems.push(`sheet has ${hops} walk stretches for ${WALK.length} hops`);
  } catch { problems.push('sheet not written — run node tools/map.ts --write'); }
  // M11 · one named sub-zone cell per sub-zone, in the engine's order, and the name printed on it
  for (const s of TOWN.settlements) {
    const zone = zoneById(s.zone);
    if (!zone) { problems.push(`settlement ${s.id} holds zone ${s.zone}, which engine.json does not carry`); continue; }
    const own = [...claims.values()].filter((c) => c.town === s.id);
    const subs = own.filter((c) => c.kind === 'sub').sort((a, b) => (a.j ?? 0) - (b.j ?? 0));
    const sites = own.filter((c) => c.kind === 'site');
    const wanted = (zone.subzones || []);
    if (subs.length !== wanted.length) problems.push(`settlement ${s.id} owns ${subs.length} sub-zone cells for ${wanted.length} sub-zones`);
    subs.forEach((claim, i) => {
      const sub = wanted[i];
      if (!sub) { problems.push(`settlement ${s.id} owns an extra sub-zone cell ${claim.cell}`); return; }
      if (claim.j !== i) problems.push(`sub-zone ${i} of ${s.id} is printed in slot ${claim.j}`);
      if (claim.name !== sub.name) problems.push(`sub-zone "${sub.name}" of ${s.id} is not the name printed on its cell ${claim.cell}`);
    });
    // A town carries one cell for each wild-side activity its zone supports: mine, grove and
    // dungeon everywhere, and fishing where the zone authors a fishing food; the cells are safe
    // ground and the kind is presentation only.
    const kinds = siteKindsFor(s.id);
    for (const kind of kinds) {
      if (!sites.some((w) => w.site === kind)) problems.push(`settlement ${s.id} owns no ${kind} site cell`);
    }
    for (const claim of sites) {
      if (!claim.site || !kinds.includes(claim.site)) problems.push(`settlement ${s.id} owns a ${claim.site} site its zone does not support`);
    }
  }
  // M13 · the standing rule is honest on the written sheet: every land cell a click can land on
  //        resolves to the settlement that owns it on foot, a claimed cell is owned by the settlement
  //        printed on it, nothing within a side of two towns ties, and bare terrain is the local
  //        side's own. A cell that resolved to no owner would be the hex that does nothing.
  try {
    const svg = fs.readFileSync(OUT, 'utf8');
    const attr = (tag: string, name: string): string | null => { const m = new RegExp(`${name}="([^"]*)"`).exec(tag); return m ? m[1] : null; };
    let rankMax = 0;
    let read = 0;
    const readKeys = new Set<string>();
    for (const m of svg.matchAll(/<polygon ([^>]*class="cell [^>]*)>/g)) {
      const tag = m[1];
      read++;
      const ax = attr(tag, 'data-ax');
      if (!ax || !/,/.test(ax)) { problems.push('a cell polygon carries no axial key to walk from'); continue; }
      if (attr(tag, 'data-cell') !== ax) problems.push(`cell ${ax} carries a different data-cell id`);
      if (readKeys.has(ax)) problems.push(`cell ${ax} is drawn twice`);
      readKeys.add(ax);
      const [q, r] = ax.split(',').map(Number);
      const h = { q, r };
      if (!ROAD.isLand(h)) problems.push(`cell ${ax} is not on the land mask`);
      const rank = ROAD.cellRank(h);
      rankMax = Math.max(rankMax, rank);
      const tied = ROAD.owners(h);
      if (rank <= 1 && tied.length > 1) problems.push(`cell ${ax} ranks ${rank} and ties between ${tied.map((n) => n.id).join(', ')} — a side cannot have two owners`);
      const owner = ROAD.owningNode(h, STANDING);
      const node = attr(tag, 'data-node');
      const claim = claims.get(ax);
      const terrain = attr(tag, 'data-terrain');
      if (node) {
        if (!claim) problems.push(`cell ${ax} is marked as ${node} but carries no location`);
        else if (claim.town !== node) problems.push(`cell ${ax} is printed as ${node}'s but the location belongs to ${claim.town}`);
        else if (owner.id !== node) problems.push(`cell ${ax} is printed as ${node}'s but the nearest settlement on foot is ${owner.id}`);
        const expected = claim ? (claim.kind === 'town' ? 'town' : claim.terrain) : null;
        if (claim && terrain !== expected) problems.push(`cell ${ax} prints terrain ${terrain}, not its location's ${expected}`);
      } else {
        if (claim) problems.push(`cell ${ax} is a ${claim.kind} but carries no node`);
        const bare = BARE.get(ax);
        if (!bare) problems.push(`bare cell ${ax} has no terrain`);
        else if (terrain !== bare.terrain) problems.push(`bare cell ${ax} prints ${terrain}, not the local ${bare.terrain}`);
        if (bare && owner.id !== bare.owner) problems.push(`bare cell ${ax} is locally ${bare.owner}'s but the nearest settlement on foot is ${owner.id}`);
      }
      const zone = attr(tag, 'data-zone');
      const ownerZone = settlementById(owner.id)?.zone;
      if (String(ownerZone) !== zone) problems.push(`cell ${ax} prints zone ${zone} but ${owner.id} holds ${ownerZone}`);
      const sub = attr(tag, 'data-sub'), site = attr(tag, 'data-site');
      if (claim?.kind !== 'sub' && sub != null) problems.push(`cell ${ax} carries a sub-zone index but is not a named side`);
      if (claim?.kind !== 'site' && site != null) problems.push(`cell ${ax} carries a site index but is not a wild-side site`);
      if (claim?.kind === 'sub' && sub !== String(claim.j)) problems.push(`cell ${ax} carries sub-zone ${sub}, not ${claim.j}`);
      if (claim?.kind === 'site' && site !== claim.site) problems.push(`cell ${ax} carries site ${site}, not ${claim.site}`);
      if (terrain && COL[terrain] !== attr(tag, 'data-tone')) problems.push(`cell ${ax} prints a tone that is not terrain ${terrain}'s colour`);
    }
    if (read !== CELLS.size) problems.push(`the standing rule read ${read} cell polygons, not the ${CELLS.size} land cells`);
    if (readKeys.size !== CELLS.size) problems.push(`the standing rule read ${readKeys.size} distinct cells, not the ${CELLS.size} land cells`);
    M13NOTE = `${read} land cells resolve, and ${rankMax} blocks is the farthest any of them sits from a settlement`;
  } catch { problems.push('sheet not written — run node tools/map.ts --write'); }
  // M15 · every cell, including settlements, has one correctly placed art group.
  // Ground is a flat hex mask; separate scenery retains its measured painted bounds.
  try {
    const svg = fs.readFileSync(OUT, 'utf8').replace(/\r\n?/g, '\n');
    const figures = svg.split(/<g class="diorama-figure[^"]*"/).slice(1);
    let pieces = 0;
    for (const rawFigure of figures) {
      const figureEnd = rawFigure.indexOf('</g></g>');
      const figure = figureEnd >= 0 ? rawFigure.slice(0, figureEnd + 8) : rawFigure;
      const hrefs = [...figure.matchAll(/data-art-href="([^"]+)"|<image\b[^>]*\bhref="([^"]+)"/g)]
        .map((m) => m[1] ?? m[2]).filter((href): href is string => !!href && href.startsWith('/map/'));
      if (!hrefs.length) { problems.push('terrain piece has no art reference'); continue; }
      pieces++;
      if (!figure.includes('<g class="diorama-art">')) problems.push(`terrain piece ${hrefs[0]} is not wrapped as one diorama art group`);
      if (figure.includes('clip-path=')) problems.push(`terrain piece ${hrefs[0]} is still clipped`);
      const header = rawFigure.slice(0, rawFigure.indexOf('>'));
      const cell = CELLS.get(/data-figure-ax="([^"]+)"/.exec(header)?.[1] ?? '');
      if (!cell || /transform="([^"]+)"/.exec(header)?.[1] !== mapUprightAt(cell.x, cell.y)) {
        problems.push(`terrain piece ${hrefs[0]} is not centred on its north-up hex`);
      }
      for (const href of hrefs) {
        if (!fs.existsSync(path.join(ROOT, 'game/public', href.slice(1)))) problems.push(`terrain piece ${href} is missing`);
        if (!figure.includes(hexArtwork(href)) || !svg.includes(registeredDefinitions.get(href)!)) problems.push(`terrain piece ${href} does not match its flat hex mask`);
      }
    }
    if (pieces !== CELLS.size) problems.push(`sheet carries ${pieces} terrain pieces for ${CELLS.size} land cells`);
    for (const match of svg.matchAll(/<g class="terrain-relief terrain-on">(.*?)<\/g>/g)) {
      const href = /<image href="([^"]+)"/.exec(match[1])?.[1];
      if (!href || !Object.values(TERRAIN_RELIEF).includes(href) || !fs.existsSync(path.join(ROOT, 'game/public', href.slice(1)))) {
        problems.push('terrain piece has missing or unknown relief art');
        continue;
      }
      if (match[1] !== mapSpriteWidth(href, 0, TERRAIN_PIECE.bottom, TERRAIN_PIECE.width)) problems.push(`terrain piece ${href} does not match its measured scenery anchor`);
      if (mapSpriteWidthScale(href) < 1 || mapSpriteWidthScale(href) > 1.1) problems.push(`terrain piece ${href} has an unsupported spill scale`);
    }
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
  const subs = [...claims.values()].filter((c) => c.kind === 'sub').length;
  const sites = [...claims.values()].filter((c) => c.kind === 'site').length;
  claim('M2', /outside the land mask|claimed by|unknown terrain|declares .* land cells|carries no sheet claim/, `all ${subs + sites + TOWN.settlements.length} authored locations are land cells, none claimed twice`);
  claim('M3', /walk graph|walk node|does not own its walk node|share walk cell|off the land/, `the sheet's land cells and the walk graph's ${roadNodes.length} axial nodes are the same lattice`);
  claim('M6', /not beside/, 'every named side and wild-side site sits within two walkable blocks of its own town');
  claim('M7', /may not read a coordinate/, 'no file under engine/ or game/src/ reads map.json — cells stay presentation (X33)');
  claim('M10', /cell polygons|drawn hexes|cell keys|cell ids|travel pins|walk stretches|sheet not written/, `the sheet carries ${CELLS.size} keyed land cells, a pin per settlement and ${WALK.length} walk stretches`);
  claim('M11', /sub-zone cells for|site cell|site its zone|printed in slot|not the name printed/, `one named sub-zone cell per sub-zone (${subs}) and the wild-side cells each town's zone supports — mine, grove and dungeon for all ${TOWN.settlements.length}, fishing for ${FISHING_ZONES.size} (${sites})`);
  claim('M13', /land mask|two owners|marked as|carries no location|nearest settlement|carries no node|no terrain|prints terrain|prints a tone|carries a sub-zone|carries a site|carries sub-zone|carries site|drawn twice|different data-cell|standing rule read|distinct cells/, `every land cell a click can land on resolves to the settlement that owns it on foot (${M13NOTE})`);
  claim('M14', /settlement landmark assignment|landmark art file/, `all ${TOWN.settlements.length} settlements use known, present landmark art files`);
  claim('M15', /terrain piece|sheet not written/, `flat ground matches every hex; separate scenery stays measured, centred and bottom-anchored`);
  G.report(g.rows());
} else if (args.includes('--write')) {
  write();
} else {
  console.log('map.ts — the generated field sheet');
  console.log('  --write    write game/src/icon/map/map-overlay.svg from tools/data/map.json');
  console.log('  --checks   run M2, M3, M6, M7, M10, M11, M13, M14, M15 (field, landmark and terrain placement consistency)');
}
