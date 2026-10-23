import { E, eng, fieldwork } from '../engine/client';
import { settlementById } from '../sim/town';
import { rankOf, currentCell, walkedCells, trailCells, cellsTo } from '../sim/road';
import { mapUprightAt, projectedHex, projectMapPoint } from './map-projection';
import { mapScreenLabelMatrix } from './map-camera';
import { mapSceneProjection, paintMapScene } from './map-scene';
import { mapLevelBand, mapNameLines, mapNamePointer, mapNamePosition, placeMapNames, type MapNameBox } from './map-labels';
import { paintMapAdventure } from './map-adventure';
import { mapMarker } from './map-markers';
import { MAP_EXPLORATION, type TrailSite } from '../sim/map-exploration';

const figureArt = new WeakMap<Element, string>();
type SheetIndex = {
  svg: SVGSVGElement;
  cells: SVGPolygonElement[];
  cellByAx: Map<string, SVGPolygonElement>;
  cellByDataCell: Map<string, SVGPolygonElement>;
  towns: Map<string, SVGPolygonElement[]>;
  initialized: boolean;
  lastPaintKey: string | null;
};
const sheetIndexes = new WeakMap<HTMLElement, SheetIndex>();

function sheetIndex(root: HTMLElement): SheetIndex | null {
  const svg = root.querySelector('svg');
  if (!svg) return null;
  const previous = sheetIndexes.get(root);
  if (previous?.svg === svg) return previous;
  const cells = Array.from(svg.querySelectorAll<SVGPolygonElement>('polygon.cell'));
  const cellByAx = new Map<string, SVGPolygonElement>();
  const cellByDataCell = new Map<string, SVGPolygonElement>();
  const towns = new Map<string, SVGPolygonElement[]>();
  for (const cell of cells) {
    const ax = cell.getAttribute('data-ax');
    const dataCell = cell.getAttribute('data-cell');
    const townId = cell.getAttribute('data-node');
    if (ax) cellByAx.set(ax, cell);
    if (dataCell) cellByDataCell.set(dataCell, cell);
    if (townId) {
      const owned = towns.get(townId) || [];
      owned.push(cell);
      towns.set(townId, owned);
    }
  }
  const index: SheetIndex = { svg, cells, cellByAx, cellByDataCell, towns, initialized: false, lastPaintKey: null };
  sheetIndexes.set(root, index);
  return index;
}

function mapPaintKey(opts: PaintOpts): string {
  const state = opts.gameState;
  const feet = currentCell(state);
  const walk = state.walk;
  const camp = state.fieldwork?.camp;
  const encounter = state.fieldwork?.campEncounters?.active;
  const journal = state.mapJournal;
  const event = journal?.lastEvent;
  const patrol = state.patrol;
  const expeditionTasks = (state.town?.tasks || []).filter((task: any) => task?.kind === 'expedition')
    .map((task: any) => [task.zone, task.subzone, task.progress, task.n, task.claimed]);
  return JSON.stringify([
    opts.view, opts.gateLevel, opts.showIds, opts.showWalk, opts.pickedCell?.key || null, opts.townId,
    [feet.q, feet.r], walk ? [walk.from.q, walk.from.r, walk.to.q, walk.to.r, walk.node, walk.kind, walk.sub, walk.wild, walk.blocksWalked] : null,
    state.group.map((mob: { species: string; kind: string }) => [mob.species, mob.kind]), state.autoReturn.phase,
    camp ? [camp.cell.q, camp.cell.r] : null, state.fieldwork?.action?.kind || '',
    encounter ? [encounter.id, encounter.kind, encounter.stage, encounter.origin.q, encounter.origin.r,
      encounter.payload?.species || '', encounter.preparedGroup?.[0]?.speciesId || ''] : null,
    [journal?.visited || [], journal?.scouted || [], journal?.claimedSites || [], journal?.trail?.sites.map((site: TrailSite) => [site.id, site.q, site.r, site.kind]) || [], event || null,
      !!event && state.clockSec - event.atSec <= MAP_EXPLORATION.event_display_sec],
    state.town.visited, state.counters.zoneKills, state.town.helpCredit, expeditionTasks,
    [patrol.active, patrol.index, patrol.groupsCleared,
      patrol.stops.map((stop: any) => [stop.cell.q, stop.cell.r, stop.zone, stop.subzone])],
  ]);
}

function setAttributeIfChanged(element: Element, name: string, value: string) {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

function paintFigureArt(element: Element, markup: string) {
  if (figureArt.get(element) === markup) return;
  element.innerHTML = markup; figureArt.set(element, markup);
}

/**
 * The map cluster's own reader — the geometry and the sheet repaint that `App.svelte` used to hold
 * inline. These are pure over the data and the generated sheet: they read the engine's cell keys and
 * paint the DOM the `{@html}` rebuild left behind, and they write no reactive state of their own, so
 * `App` keeps the `$state` and calls these from its effect and its pick handler.
 */

/** The clicked cell, read off the sheet's own marks: town · sub-zone · wild side · bare ground. */
export type Picked = { key: string; q: number; r: number; kind: 'town' | 'sub' | 'wild' | 'bare'; label: string; sub: number | null; wild: number | null };

/** The band ramp: dark green at the first band of levels, deep red at the last. */
export const ramp = (band: number) => {
  const t = band / (E.mob.zones.length - 1);
  return `hsl(${Math.round(94 - 82 * t)} 36% ${Math.round(20 + 20 * t)}%)`;
};

/** What a cell is called, read off the sheet's own marks. */
export function cellLabel(node: Element): Picked {
  const ax = (node.getAttribute('data-ax') || '0,0').split(',').map(Number);
  const key = node.getAttribute('data-cell') || '';
  const sub = node.getAttribute('data-sub');
  const wild = node.getAttribute('data-wild');
  const id = node.getAttribute('data-node');
  const h = { q: ax[0], r: ax[1] };
  if (id && rankOf(h) === 0) return { key, q: h.q, r: h.r, kind: 'town', label: settlementById(id)!.name, sub: null, wild: null };
  if (id && sub != null) {
    const s = settlementById(id)!;
    return { key, q: h.q, r: h.r, kind: 'sub', label: (eng.zoneById(s.zone).subzones || [])[Number(sub)]?.name || '', sub: Number(sub), wild: null };
  }
  if (id && wild != null) {
    const s = settlementById(id)!, w = Number(wild);
    const site = fieldwork.siteAt(w);
    const label = site === 'dungeon' ? `${s.name} Dungeon`
      : site === 'mine' ? `${s.name} Mine`
        : site === 'grove' ? `${s.name} Rare Grove` : `${s.name} Wild Side`;
    return { key, q: h.q, r: h.r, kind: 'wild', wild: w, label, sub: null };
  }
  return { key, q: h.q, r: h.r, kind: 'bare', label: `Hunting Ground · ${key}`, sub: null, wild: null };
}

/** The view, gate floor and the two overlays, plus the pick and the walk the state carries. */
export type PaintOpts = {
  view: 'terrain' | 'band' | 'gate';
  gateLevel: number;
  showIds: boolean;
  showWalk: boolean;
  pickedCell: Picked | null;
  gameState: any;
  townId: string;
};

/** Feather the finite field cells into the endless patterned ground beneath them. */
function featherFieldEdge(cells: SVGPolygonElement[]) {
  if (!cells.length || cells.every((cell) => cell.hasAttribute('data-edge-opacity'))) return;
  const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
  const byAx = new Map(cells.map((cell) => [cell.getAttribute('data-ax') || '', cell]));
  const depth = new Map<string, number>();
  const edge = [...byAx.keys()].filter((key) => {
    const [q, r] = key.split(',').map(Number);
    return neighbours.some(([dq, dr]) => !byAx.has(`${q + dq},${r + dr}`));
  });
  edge.forEach((key) => depth.set(key, 0));

  // Walk inward by actual hex neighbours; a rectangular pixel mask would clip the skewed axial edge.
  for (let cursor = 0; cursor < edge.length; cursor++) {
    const key = edge[cursor];
    const [q, r] = key.split(',').map(Number);
    for (const [dq, dr] of neighbours) {
      const next = `${q + dq},${r + dr}`;
      if (!byAx.has(next) || depth.has(next)) continue;
      depth.set(next, depth.get(key)! + 1);
      edge.push(next);
    }
  }

  const fadeRings = 3;
  cells.forEach((cell) => {
    const rings = depth.get(cell.getAttribute('data-ax') || '') ?? fadeRings;
    const ramp = Math.min(1, rings / fadeRings);
    cell.setAttribute('data-edge-opacity', (ramp * ramp * (3 - 2 * ramp)).toFixed(3));
  });
}

/** Hover light: each cell gets a twin hexagon slightly grown around it, directly behind the art. The
 * art hides the twin's face; the grown rim sits in the grout between tiles, so hovering a hex reads
 * as light rising out of the gap. */
function plantCellGlow(cells: SVGPolygonElement[]) {
  for (const cell of cells) {
    if (cell.nextElementSibling instanceof Element && cell.nextElementSibling.classList.contains('cell-glow')) continue;
    const glow = cell.cloneNode(false) as SVGPolygonElement;
    for (const attr of Array.from(glow.attributes)) {
      if (attr.name !== 'points' && attr.name !== 'class') glow.removeAttribute(attr.name);
    }
    const pts = (glow.getAttribute('points') || '').trim().split(/\s+/).map((p) => p.split(',').map(Number));
    if (pts.length >= 6) {
      const cx = pts.reduce((n, p) => n + p[0], 0) / pts.length;
      const cy = pts.reduce((n, p) => n + p[1], 0) / pts.length;
      glow.setAttribute('transform', `translate(${cx.toFixed(3)} ${cy.toFixed(3)}) scale(1.08) translate(${(-cx).toFixed(3)} ${(-cy).toFixed(3)})`);
    }
    glow.setAttribute('class', 'cell-glow');
    glow.setAttribute('aria-hidden', 'true');
    cell.after(glow);
  }
}

/**
 * The SVG index is built once and the sheet only repaints for map-relevant state changes. Cached cell
 * keys keep route, terrain and marker updates on the generated board without repeated DOM searches.
 */
export function paintSheet(root: HTMLElement, opts: PaintOpts) {
  const index = sheetIndex(root);
  if (!index) return;
  const paintKey = mapPaintKey(opts);
  if (index.lastPaintKey === paintKey) return;
  const { view: v, gateLevel: lv, showIds: ids, showWalk: hops, pickedCell, gameState } = opts;
  const walk = gameState.walk;
  const { svg, cells } = index;
  const feet = currentCell(gameState);
  const feetKey = feet.q + ',' + feet.r;
  const pickedKey = pickedCell ? pickedCell.q + ',' + pickedCell.r : null;
  const selectedTown = pickedKey ? index.cellByAx.get(pickedKey)?.getAttribute('data-node') : null;
  root.querySelectorAll('.node').forEach(node => node.classList.toggle('picked', node.getAttribute('data-node') === selectedTown));
  // The pin layer is retired: position reads off the hex edge itself (see `pin-here` / `pin-target`
  // on the cell polygon), so no circle ever covers the terrain, icon or mob art mid-cell.
  root.querySelectorAll('.pin').forEach(pin => {
    pin.classList.remove('here', 'target');
  });
  if (!index.initialized) {
    featherFieldEdge(cells);
    plantCellGlow(cells);
    index.initialized = true;
  }
  const campCell = gameState.fieldwork?.camp?.cell || null;
  const routeKeys = new Set<string>(walk ? trailCells(gameState)
    : pickedCell ? cellsTo(gameState, { q: pickedCell.q, r: pickedCell.r }) : []);
  const walked = new Set(walk ? walkedCells(gameState) : []);
  const hereTown = !walk && rankOf(feet) === 0 ? opts.townId : null;
  const targetTown = walk && walk.kind === 'town' ? walk.node : null;
  const townCell = (id: string | null) => {
    if (!id) return null;
    const owned = index.towns.get(id) || [];
    return owned.find(cell => !cell.hasAttribute('data-sub') && !cell.hasAttribute('data-wild')) || owned[0] || null;
  };
  const pinHereAx = townCell(hereTown)?.getAttribute('data-ax') || null;
  const pinTargetAx = townCell(targetTown)?.getAttribute('data-ax') || null;
  for (const p of cells) {
    const ax = p.getAttribute('data-ax') || '';
    const wildIndex = p.getAttribute('data-wild');
    const site = wildIndex == null ? null : fieldwork.siteAt(Number(wildIndex));
    p.classList.toggle('site-dungeon', site === 'dungeon');
    p.classList.toggle('site-mine', site === 'mine');
    p.classList.toggle('site-grove', site === 'grove');
    p.classList.toggle('field-camp', !!campCell && ax === campCell.q + ',' + campCell.r);
    const hasLevel = p.hasAttribute('data-lo');
    p.classList.toggle('locked', v !== 'terrain' && v !== 'band' && hasLevel && lv < Number(p.getAttribute('data-lo')));
    const fill = v === 'terrain' ? p.getAttribute('data-tone') || 'none'
      : !hasLevel ? 'none' : ramp(Number(p.getAttribute('data-band')));
    setAttributeIfChanged(p, 'fill', fill);
    p.style.setProperty('--map-cell-fill', fill);
    const edgeOpacity = v === 'terrain' ? p.getAttribute('data-edge-opacity') || '1' : '1';
    setAttributeIfChanged(p, 'fill-opacity', edgeOpacity);
    setAttributeIfChanged(p, 'stroke-opacity', edgeOpacity);
    const isRoute = routeKeys.has(ax);
    const isWalked = isRoute && walked.has(ax);
    p.classList.toggle('route', isRoute && !isWalked);
    p.classList.toggle('walked', isWalked);
    p.classList.toggle('picked', ax === pickedKey);
    p.classList.toggle('standing', ax === feetKey);
    p.classList.toggle('pin-here', ax === pinHereAx);
    p.classList.toggle('pin-target', ax === pinTargetAx);
  }
  const toggle = (id: string, on: boolean) => {
    const g = svg.querySelector('#' + id) as HTMLElement | null;
    const display = on ? '' : 'none';
    if (g && g.style.display !== display) g.style.display = display;
  };
  toggle('ids', ids);
  toggle('walk', hops);
  const regions = svg.querySelector('#regions') as HTMLElement | null;
  const regionOpacity = v === 'terrain' ? '1' : '0';
  if (regions && regions.style.opacity !== regionOpacity) regions.style.opacity = regionOpacity;
  // the hex the feet are on is marked where it lies, so standing is read off the ground itself
  const at = index.cellByAx.get(feetKey) || null;
  svg.querySelectorAll('.zonelabel').forEach(label => {
    const id = label.getAttribute('data-cell');
    label.classList.toggle('active', id === pickedCell?.key || id === at?.getAttribute('data-cell'));
  });
  // …and the character stands on it, one hex per block: the cell's own hexagon washed in the accent and
  // a mark at its centre, both read off the geometry the sheet already carries (X33 · M7). Every cell is
  // the same hexagon translated, so the mark is built once and then *moved* — the sheet slides it to the
  // next cell, and a walk reads as a walk rather than as a jump.
  setAttributeIfChanged(svg, 'data-view', v);
  if (at) {
    let you = svg.querySelector('g.you');
    const pts = (at.getAttribute('points') || '').trim().split(/\s+/).map((p: string) => p.split(',').map(Number));
    const cx = pts.reduce((n: number, p: number[]) => n + p[0], 0) / pts.length;
    const cy = pts.reduce((n: number, p: number[]) => n + p[1], 0) / pts.length;
    if (!you) {
      const NS = 'http://www.w3.org/2000/svg';
      you = document.createElementNS(NS, 'g');
      you.setAttribute('class', 'you');
    }
    const actors = svg.querySelector<SVGGElement>('#actors') || svg.querySelector<SVGGElement>('#projected-board') || svg;
    if (you.parentNode !== actors) actors.append(you);
    paintFigureArt(you, '<title>Your position</title><g class="mark" transform="translate(-12 3)">' + mapMarker('player', 'compass', { scale: .55 }) + '</g>');
    setAttributeIfChanged(you, 'role', 'img');
    setAttributeIfChanged(you, 'aria-label', 'Your position · block ' + (at.getAttribute('data-cell') || feetKey));
    const position = `${feet.q},${feet.r}`;
    const previous = you.getAttribute('data-position');
    if (previous && previous !== position) {
      you.classList.remove('stepping');
      you.getBoundingClientRect();
      you.classList.add('stepping');
    }
    setAttributeIfChanged(you, 'data-position', position);
    setAttributeIfChanged(you, 'transform', mapUprightAt(cx, cy, mapSceneProjection(root)));
    you.classList.toggle('walking', !!walk);
    you.classList.toggle('returning', gameState.autoReturn.phase !== 'idle');
  }
  const board = svg.querySelector('#projected-board');
  if (!board) return;
  paintMapAdventure(root, gameState, v === 'terrain');
  paintMapScene(root);
  index.lastPaintKey = paintKey;
}

type MapNamePlate = {
  group: SVGGElement; rect: SVGRectElement; text: SVGGElement;
  pointer: SVGPathElement; stem: SVGPathElement; anchor: SVGCircleElement;
  signature: string; width: number; height: number;
};
const mapNameLayers = new WeakMap<SVGSVGElement, { layer: SVGGElement; plates: Map<string, MapNamePlate> }>();
const mapNameGeometry = new WeakMap<SVGPolygonElement, { x: number; y: number; radius: number }>();
function nameGeometry(cell: SVGPolygonElement) {
  let geometry = mapNameGeometry.get(cell);
  if (!geometry) {
    const box = cell.getBBox();
    geometry = { x: box.x + box.width / 2, y: box.y + box.height / 2, radius: box.height / 2 };
    mapNameGeometry.set(cell, geometry);
  }
  return geometry;
}

/** Retained screen-facing nameplates with a pin back to the projected hex centre. */
export function paintMapNames(root: HTMLElement, opts: { show: boolean; hovered: string | null; picked: string | null; measure?: number }) {
  const index = sheetIndex(root), svg = index?.svg, matrix = svg?.getScreenCTM();
  if (!index || !svg || !matrix) return;
  const scale = Math.hypot(matrix.a, matrix.b);
  if (!scale) return;
  const camera = mapSceneProjection(root), NS = 'http://www.w3.org/2000/svg';
  let retained = mapNameLayers.get(svg);
  if (!retained) {
    let layer = svg.querySelector<SVGGElement>('#map-names');
    if (!layer) { layer = document.createElementNS(NS, 'g'); layer.id = 'map-names'; svg.append(layer); }
    layer.replaceChildren();
    retained = { layer, plates: new Map() };
    mapNameLayers.set(svg, retained);
  }
  const { layer, plates } = retained;
  const first = index.cells[0];
  const cellW = first ? projectedHex(nameGeometry(first).radius, camera).width * scale : 0;
  const overview = cellW < 115, close = cellW >= 190;
  const bounds = root.getBoundingClientRect();
  const frame = { left: bounds.left, right: bounds.right, top: bounds.top, bottom: Math.min(bounds.bottom, innerHeight) };
  const candidates: MapNameBox[] = [], anchors = new Map<string, { x: number; y: number }>();
  const add = (key: string, name: string, x: number, y: number, cls: string, level: string, forced: boolean, priority: number) => {
    const anchor = new DOMPoint(x, y).matrixTransform(matrix);
    if (anchor.x < frame.left || anchor.x > frame.right || anchor.y < frame.top || anchor.y > frame.bottom) return;
    let plate = plates.get(key);
    if (!plate) {
      const group = document.createElementNS(NS, 'g');
      group.setAttribute('data-name-key', key); group.setAttribute('aria-hidden', 'true');
      const stem = document.createElementNS(NS, 'path'); stem.setAttribute('class', 'map-name-stem');
      const pointer = document.createElementNS(NS, 'path'); pointer.setAttribute('class', 'map-name-pointer');
      const dot = document.createElementNS(NS, 'circle'); dot.setAttribute('class', 'map-name-anchor'); dot.setAttribute('r', '2.5');
      const rect = document.createElementNS(NS, 'rect'); rect.setAttribute('rx', '4');
      const text = document.createElementNS(NS, 'g');
      group.append(stem, pointer, dot, rect, text); layer.append(group);
      plate = { group, rect, text, pointer, stem, anchor: dot, signature: '', width: 0, height: 0 };
      plates.set(key, plate);
    }
    setAttributeIfChanged(plate.group, 'class', 'map-name ' + cls + (forced ? ' important-name' : ''));
    const signature = JSON.stringify([name, level, cls, opts.measure || 0]);
    if (plate.signature !== signature) {
      plate.group.removeAttribute('display');
      plate.text.replaceChildren();
      const lines = mapNameLines(name), texts: SVGTextElement[] = [];
      lines.forEach((line, i) => {
        const text = document.createElementNS(NS, 'text');
        text.setAttribute('class', 'map-name-title'); text.setAttribute('y', String(14 + i * 17));
        text.textContent = line; plate!.text.append(text); texts.push(text);
      });
      if (level) {
        const text = document.createElementNS(NS, 'text');
        text.setAttribute('class', 'map-name-level'); text.setAttribute('y', String(14 + lines.length * 17));
        text.textContent = level; plate.text.append(text); texts.push(text);
      }
      plate.width = Math.ceil(Math.max(...texts.map(text => text.getComputedTextLength()))) + 22;
      plate.height = 11 + lines.length * 17 + (level ? 16 : 0);
      texts.forEach(text => text.setAttribute('x', String(plate!.width / 2)));
      plate.rect.setAttribute('width', String(plate.width)); plate.rect.setAttribute('height', String(plate.height));
      plate.signature = signature;
    }
    const position = mapNamePosition(anchor, plate.width, plate.height, frame);
    candidates.push({ key, ...position, width: plate.width, height: plate.height, priority, forced, anchor });
    anchors.set(key, anchor);
  };
  for (const cell of index.cells) {
    const key = cell.getAttribute('data-cell')!, forced = key === opts.hovered || key === opts.picked;
    if (!forced && (!opts.show || overview || !cell.hasAttribute('data-node'))) continue;
    const label = cellLabel(cell);
    if (!forced && label.kind !== 'town' && cell.getAttribute('data-discovery') === 'unknown') continue;
    if (!forced && (label.kind === 'wild' || label.kind === 'sub' && !close)) continue;
    const centre = nameGeometry(cell), point = projectMapPoint(centre.x, centre.y, camera);
    const level = mapLevelBand(cell.getAttribute('data-discovery'), cell.getAttribute('data-lo'), cell.getAttribute('data-hi'));
    const cls = label.kind === 'town' ? 'town-name' : label.kind === 'sub' ? 'sub-name' : 'wild-name';
    const priority = key === opts.hovered ? 4 : key === opts.picked ? 3 : cell.classList.contains('standing') ? 2 : label.kind === 'town' ? 1 : 0;
    const siteName = cell.getAttribute('data-trail-name');
    const name = label.kind !== 'town' && cell.getAttribute('data-discovery') === 'unknown' ? 'Unexplored ground'
      : siteName ? siteName + (cell.getAttribute('data-trail-claimed') === 'true' ? ' ? explored' : '') : label.label;
    add(key, name, point.x, point.y, cls, level, forced, priority);
  }
  if (overview && opts.show) svg.querySelectorAll<SVGTextElement>('#regions .region').forEach((text, i) => {
    const point = projectMapPoint(Number(text.getAttribute('x')), Number(text.getAttribute('y')), camera);
    add('region-' + i, text.textContent || '', point.x, point.y, 'town-name', '', false, 1);
  });
  const placed = new Map(placeMapNames(candidates, frame).map(box => [box.key, box]));
  for (const [key, plate] of plates) {
    const box = placed.get(key), anchor = anchors.get(key);
    setAttributeIfChanged(plate.group, 'display', box ? '' : 'none');
    if (!box || !anchor) continue;
    const facing = mapScreenLabelMatrix(matrix, { x: box.left, y: box.top }), pin = mapNamePointer(box, anchor);
    setAttributeIfChanged(plate.group, 'transform', 'matrix(' + [facing.a, facing.b, facing.c, facing.d, facing.e, facing.f].join(' ') + ')');
    setAttributeIfChanged(plate.pointer, 'd', pin.triangle); setAttributeIfChanged(plate.stem, 'd', pin.stem);
    setAttributeIfChanged(plate.anchor, 'cx', String(pin.x)); setAttributeIfChanged(plate.anchor, 'cy', String(pin.y));
  }
}

type HoverBarrier = {
  layer: SVGGElement;
  faces: { group: SVGGElement; wall: SVGPathElement; flows: SVGPathElement[] }[];
  rims: SVGPathElement[];
  signature: string;
};
const hoverBarriers = new WeakMap<SVGSVGElement, HoverBarrier>();

/** A single upright curtain follows the hovered hex's exact projected ground edges. */
export function paintMapHover(root: HTMLElement, key: string | null) {
  const index = sheetIndex(root);
  if (!index) return;
  const { svg } = index, cell = key ? index.cellByDataCell.get(key) : null;
  let barrier = hoverBarriers.get(svg);
  if (!cell) {
    if (barrier) setAttributeIfChanged(barrier.layer, 'data-active', 'false');
    return;
  }
  if (!barrier) {
    const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    layer.setAttribute('class', 'map-aurora');
    layer.setAttribute('aria-hidden', 'true');
    layer.setAttribute('pointer-events', 'none');
    layer.innerHTML = `<defs><linearGradient id="map-aurora-gradient" x1="0" y1="1" x2="0" y2="0">
      <stop class="map-aurora-stop-base" offset="0"/>
      <stop class="map-aurora-stop-middle" offset=".42"/>
      <stop class="map-aurora-stop-top" offset="1"/>
    </linearGradient></defs>`
      + Array.from({ length: 6 }, () => '<g class="map-aurora-face"><path class="map-aurora-wall" fill="url(#map-aurora-gradient)"/>'
        + '<path class="map-aurora-flow" stroke="url(#map-aurora-gradient)" vector-effect="non-scaling-stroke"/>'.repeat(6) + '</g>').join('')
      + '<path class="map-aurora-rim-haze" vector-effect="non-scaling-stroke"/><path class="map-aurora-rim" vector-effect="non-scaling-stroke"/>';
    svg.insertBefore(layer, svg.querySelector('#map-names'));
    barrier = {
      layer, signature: '',
      faces: Array.from(layer.querySelectorAll<SVGGElement>('.map-aurora-face')).map(group => ({
        group, wall: group.querySelector<SVGPathElement>('.map-aurora-wall')!,
        flows: Array.from(group.querySelectorAll<SVGPathElement>('.map-aurora-flow')),
      })),
      rims: Array.from(layer.querySelectorAll<SVGPathElement>('.map-aurora-rim, .map-aurora-rim-haze')),
    };
    hoverBarriers.set(svg, barrier);
  }
  setAttributeIfChanged(barrier.layer, 'data-active', 'true');
  setAttributeIfChanged(barrier.layer, 'data-cell', key!);
  const camera = mapSceneProjection(root), signature = [key, camera.a, camera.b, camera.c, camera.d].join(':');
  if (barrier.signature === signature) return;
  const ground = (cell.getAttribute('points') || '').trim().split(/\s+/).map(point => {
    const [x, y] = point.split(',').map(Number);
    return projectMapPoint(x, y, camera);
  });
  const height = nameGeometry(cell).radius * 1.05;
  const centreY = ground.reduce((sum, point) => sum + point.y, 0) / ground.length;
  const tops = ground.map((point, i) => ({ x: point.x, y: point.y - height * (.9 + .1 * Math.sin(i * 1.9)) }));
  const between = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  barrier.faces.forEach((face, i) => {
    const a = ground[i], b = ground[(i + 1) % ground.length], ta = tops[i], tb = tops[(i + 1) % ground.length];
    const c1 = between(tb, ta, 1 / 3), c2 = between(tb, ta, 2 / 3);
    face.group.classList.toggle('is-rear', (a.y + b.y) / 2 < centreY);
    setAttributeIfChanged(face.wall, 'd', `M${a.x} ${a.y} L${b.x} ${b.y} L${tb.x} ${tb.y} C${c1.x} ${c1.y - height * .16} ${c2.x} ${c2.y + height * .12} ${ta.x} ${ta.y} Z`);
    face.flows.forEach((flow, j) => {
      const base = between(a, b, (j + 1) / (face.flows.length + 1));
      const rise = height * (.65 + .25 * Math.sin(j * 1.7 + i) ** 2), drift = height * .08 * Math.sin(j * 1.3 + i);
      setAttributeIfChanged(flow, 'd', `M${base.x} ${base.y} Q${base.x - drift * .5} ${base.y - rise * .5} ${base.x + drift} ${base.y - rise}`);
    });
  });
  const outline = ground.map((point, i) => `${i ? 'L' : 'M'}${point.x} ${point.y}`).join(' ') + ' Z';
  barrier.rims.forEach(rim => setAttributeIfChanged(rim, 'd', outline));
  barrier.signature = signature;
}
