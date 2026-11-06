import { createMapDomIndex, type MapDomIndex } from './map-dom';
import { cellLabel, ramp, type MapPaintModel, type MapStaticCell, type Picked } from './map-view-model';
import { mapScreenLabelMatrix, type MapCameraState, DEFAULT_MAP_CAMERA } from './map-camera';
import { createMapProjection, projectMapPoint, projectedHex } from './map-projection';
import { paintMapScene } from './map-scene';
import { paintMapAdventure } from './map-adventure';
import { mapLevelBand, mapNameLines, mapNamePointer, mapNamePosition, placeMapNames, type MapNameBox } from './map-labels';
import { mapMarker } from './map-markers';

export { cellLabel, ramp } from './map-view-model';
export type { Picked, MapViewOptions, MapPaintModel, MapStaticCell } from './map-view-model';

const NS = 'http://www.w3.org/2000/svg';
const painted = new WeakSet<MapDomIndex>();
const figureArt = new WeakMap<Element, string>();
const setIf = (el: Element, name: string, value: string) => { if (el.getAttribute(name) !== value) el.setAttribute(name, value); };
const art = (element: Element, markup: string) => {
  if (figureArt.get(element) === markup) return;
  element.innerHTML = markup;
  figureArt.set(element, markup);
};

/** Hover light: a twin hexagon slightly grown around each cell, planted once per index. */
function plantGlows(index: MapDomIndex) {
  if (painted.has(index)) return;
  painted.add(index);
  for (const cell of index.polygons) {
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

/** Surface layer: terrain/ramp paint, route and pin classes, the standing mark's content. */
function paintSurface(index: MapDomIndex, model: MapPaintModel) {
  const surface = model.surface, view = surface.options.view;
  const route = new Set<string>(surface.route), walked = new Set<string>(surface.walked);
  const selectedCell = surface.selectedAx ? index.byAx.get(surface.selectedAx) : null;
  index.svg.querySelectorAll('.node').forEach((node) => node.classList.toggle('picked', node.getAttribute('data-node') === surface.selectedTown));
  index.svg.querySelectorAll('.pin').forEach((pin) => pin.classList.remove('here', 'target'));
  plantGlows(index);
  for (const [i, cell] of index.cells.entries()) {
    const paint = surface.cells[i] as { ax: string; fill: string; opacity: number; locked: boolean } | undefined;
    const site = cell.site, p = cell.polygon;
    p.classList.toggle('site-dungeon', site === 'dungeon');
    p.classList.toggle('site-mine', site === 'mine');
    p.classList.toggle('site-grove', site === 'grove');
    p.classList.toggle('site-fishing', site === 'fishing');
    p.classList.toggle('field-camp', surface.campAx === cell.ax);
    p.classList.toggle('locked', !!paint?.locked);
    if (paint) {
      setIf(p, 'fill', paint.fill);
      p.style.setProperty('--map-cell-fill', paint.fill);
      setIf(p, 'fill-opacity', String(paint.opacity));
      setIf(p, 'stroke-opacity', String(paint.opacity));
    }
    const isRoute = route.has(cell.ax), isWalked = isRoute && walked.has(cell.ax);
    p.classList.toggle('route', isRoute && !isWalked);
    p.classList.toggle('walked', isWalked);
    p.classList.toggle('picked', cell.ax === surface.selectedAx);
    p.classList.toggle('standing', cell.ax === surface.playerAx);
    p.classList.toggle('pin-here', cell.ax === surface.pinHereAx);
    p.classList.toggle('pin-target', cell.ax === surface.pinTargetAx);
  }
  for (const [id, on] of [['ids', surface.options.showIds], ['walk', surface.options.showWalk]] as const) {
    const group = index.svg.querySelector<HTMLElement>('#' + id);
    if (group) group.style.display = on ? '' : 'none';
  }
  if (index.regions) index.regions.style.opacity = view === 'terrain' ? '1' : '0';
  setIf(index.svg, 'data-view', view);
  const selectedKey = selectedCell?.displayKey ?? null;
  const playerKey = index.byAx.get(surface.playerAx)?.displayKey;
  index.svg.querySelectorAll('.zonelabel').forEach((label) => {
    const id = label.getAttribute('data-cell');
    label.classList.toggle('active', id === selectedKey || id === playerKey);
  });
  const at = index.byAx.get(surface.playerAx);
  if (!at) return;
  let you = index.svg.querySelector('g.you');
  if (!you) {
    you = document.createElementNS(NS, 'g') as SVGGElement;
    you.setAttribute('class', 'you');
  }
  const actors = index.svg.querySelector<SVGGElement>('#actors') || index.board || index.svg;
  if (you.parentNode !== actors) actors.append(you);
  art(you, '<title>Your position</title><g class="mark" transform="translate(-12 3)">' + mapMarker('player', 'compass', { scale: .55 }) + '</g>');
  setIf(you, 'role', 'img');
  setIf(you, 'aria-label', 'Your position · block ' + at.displayKey);
  const previous = you.getAttribute('data-position');
  if (previous && previous !== surface.playerAx) {
    you.classList.remove('stepping');
    you.getBoundingClientRect();
    you.classList.add('stepping');
  }
  setIf(you, 'data-position', surface.playerAx);
  you.classList.toggle('walking', surface.walking);
}

type MapNamePlate = {
  group: SVGGElement; rect: SVGRectElement; text: SVGGElement;
  pointer: SVGPathElement; stem: SVGPathElement; anchor: SVGCircleElement;
  signature: string; width: number; height: number;
};
const nameLayers = new WeakMap<SVGSVGElement, { layer: SVGGElement; plates: Map<string, MapNamePlate> }>();

/** Retained screen-facing nameplates; text comes from the snapshot, not from a state read. */
function paintNames(index: MapDomIndex, model: MapPaintModel, hovered: string | null, measure: number, camera: MapCameraState) {
  const svg = index.svg, matrix = svg.getScreenCTM();
  if (!matrix) return;
  const scale = Math.hypot(matrix.a, matrix.b);
  if (!scale) return;
  const projection = createMapProjection(camera.bearing);
  const options = model.surface.options;
  let retained = nameLayers.get(svg);
  if (!retained) {
    let layer = svg.querySelector<SVGGElement>('#map-names');
    if (!layer) { layer = document.createElementNS(NS, 'g') as SVGGElement; layer.id = 'map-names'; svg.append(layer); }
    layer.replaceChildren();
    retained = { layer, plates: new Map() };
    nameLayers.set(svg, retained);
  }
  const { layer, plates } = retained;
  const first = index.cells[0];
  const cellW = first ? projectedHex(first.radius, projection).width * scale : 0;
  const overview = cellW < 115, close = cellW >= 190;
  const frame = { left: 0, right: innerWidth, top: 0, bottom: innerHeight };
  const candidates: MapNameBox[] = [], anchors = new Map<string, { x: number; y: number }>();
  const add = (key: string, name: string, x: number, y: number, cls: string, level: string, forced: boolean, priority: number) => {
    const anchor = new DOMPoint(x, y).matrixTransform(matrix);
    if (anchor.x < frame.left || anchor.x > frame.right || anchor.y < frame.top || anchor.y > frame.bottom) return;
    let plate = plates.get(key);
    if (!plate) {
      const group = document.createElementNS(NS, 'g') as SVGGElement;
      group.setAttribute('data-name-key', key); group.setAttribute('aria-hidden', 'true');
      const stem = document.createElementNS(NS, 'path') as SVGPathElement; stem.setAttribute('class', 'map-name-stem');
      const pointer = document.createElementNS(NS, 'path') as SVGPathElement; pointer.setAttribute('class', 'map-name-pointer');
      const dot = document.createElementNS(NS, 'circle') as SVGCircleElement; dot.setAttribute('class', 'map-name-anchor'); dot.setAttribute('r', '2.5');
      const rect = document.createElementNS(NS, 'rect') as SVGRectElement; rect.setAttribute('rx', '4');
      const text = document.createElementNS(NS, 'g') as SVGGElement;
      group.append(stem, pointer, dot, rect, text); layer.append(group);
      plate = { group, rect, text, pointer, stem, anchor: dot, signature: '', width: 0, height: 0 };
      plates.set(key, plate);
    }
    setIf(plate.group, 'class', 'map-name ' + cls + (forced ? ' important-name' : ''));
    const signature = JSON.stringify([name, level, cls, measure]);
    if (plate.signature !== signature) {
      plate.group.removeAttribute('display');
      plate.text.replaceChildren();
      const lines = mapNameLines(name), texts: SVGTextElement[] = [];
      lines.forEach((line, i) => {
        const text = document.createElementNS(NS, 'text') as SVGTextElement;
        text.setAttribute('class', 'map-name-title'); text.setAttribute('y', String(14 + i * 17));
        text.textContent = line; plate!.text.append(text); texts.push(text);
      });
      if (level) {
        const text = document.createElementNS(NS, 'text') as SVGTextElement;
        text.setAttribute('class', 'map-name-level'); text.setAttribute('y', String(14 + lines.length * 17));
        text.textContent = level; plate.text.append(text); texts.push(text);
      }
      plate.width = Math.ceil(Math.max(...texts.map((text) => text.getComputedTextLength()))) + 22;
      plate.height = 11 + lines.length * 17 + (level ? 16 : 0);
      texts.forEach((text) => text.setAttribute('x', String(plate!.width / 2)));
      plate.rect.setAttribute('width', String(plate.width)); plate.rect.setAttribute('height', String(plate.height));
      plate.signature = signature;
    }
    const position = mapNamePosition(anchor, plate.width, plate.height, frame);
    candidates.push({ key, ...position, width: plate.width, height: plate.height, priority, forced, anchor });
    anchors.set(key, anchor);
  };
  for (const label of model.labels) {
    const cell = index.byAx.get(label.ax);
    if (!cell) continue;
    const forced = cell.displayKey === hovered || label.ax === model.surface.selectedAx;
    if (!forced && (!options.showNames || overview || cell.nodeId == null)) continue;
    if (!forced && label.kind !== 'town' && label.discovery === 'unknown') continue;
    if (!forced && label.kind === 'sub' && !close) continue;
    // Resource/ordinary site names are near-only; mid keeps towns and the selected/hovered cell.
    if (!forced && label.kind === 'bare' && !close) continue;
    const point = projectMapPoint(cell.center.x, cell.center.y, projection);
    const cls = label.kind === 'town' ? 'town-name' : label.kind === 'sub' ? 'sub-name' : 'site-name';
    const priority = cell.displayKey === hovered ? 4 : label.ax === model.surface.selectedAx ? 3 : label.standing ? 2 : label.kind === 'town' ? 1 : 0;
    add(cell.displayKey, label.name, point.x, point.y, cls, label.levelText, forced, priority);
  }
  if (overview && options.showNames) {
    for (const label of model.labels) {
      const cell = index.byAx.get(label.ax);
      if (!cell?.static.anchor) continue;
      const point = projectMapPoint(cell.center.x, cell.center.y, projection);
      add(`${cell.displayKey}-anchor`, label.name, point.x, point.y, 'town-name', label.levelText, true, 1);
    }
  }
  if (overview && options.showNames) index.captions.filter((caption) => caption.plate).forEach((caption, i) => {
    const point = projectMapPoint(Number(caption.el.getAttribute('x')), Number(caption.el.getAttribute('y')), projection);
    add('region-' + i, caption.title, point.x, point.y, 'town-name', '', false, 1);
  });
  const placed = new Map(placeMapNames(candidates, frame).map((box) => [box.key, box]));
  for (const [key, plate] of plates) {
    const box = placed.get(key), anchor = anchors.get(key);
    setIf(plate.group, 'display', box ? '' : 'none');
    if (!box || !anchor) continue;
    const facing = mapScreenLabelMatrix(matrix, { x: box.left, y: box.top }), pin = mapNamePointer(box, anchor);
    setIf(plate.group, 'transform', 'matrix(' + [facing.a, facing.b, facing.c, facing.d, facing.e, facing.f].join(' ') + ')');
    setIf(plate.pointer, 'd', pin.triangle); setIf(plate.stem, 'd', pin.stem);
    setIf(plate.anchor, 'cx', String(pin.x)); setIf(plate.anchor, 'cy', String(pin.y));
  }
}

type HoverBarrier = {
  layer: SVGGElement;
  faces: { group: SVGGElement; wall: SVGPathElement; flows: SVGPathElement[] }[];
  rims: SVGPathElement[];
  signature: string;
};
const hoverBarriers = new WeakMap<SVGSVGElement, HoverBarrier>();

function paintHover(index: MapDomIndex, key: string | null, camera: MapCameraState) {
  const svg = index.svg, cell = key ? index.byDisplayKey.get(key) : null;
  let barrier = hoverBarriers.get(svg);
  if (!cell) {
    if (barrier) setIf(barrier.layer, 'data-active', 'false');
    return;
  }
  if (!barrier) {
    const layer = document.createElementNS(NS, 'g') as SVGGElement;
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
      faces: Array.from(layer.querySelectorAll<SVGGElement>('.map-aurora-face')).map((group) => ({
        group, wall: group.querySelector<SVGPathElement>('.map-aurora-wall')!,
        flows: Array.from(group.querySelectorAll<SVGPathElement>('.map-aurora-flow')),
      })),
      rims: Array.from(layer.querySelectorAll<SVGPathElement>('.map-aurora-rim, .map-aurora-rim-haze')),
    };
    hoverBarriers.set(svg, barrier);
  }
  setIf(barrier.layer, 'data-active', 'true');
  setIf(barrier.layer, 'data-cell', key!);
  const projection = createMapProjection(camera.bearing);
  const signature = [key, projection.a, projection.b, projection.c, projection.d].join(':');
  if (barrier.signature === signature) return;
  const ground = cell.static.points.map((point) => projectMapPoint(point.x, point.y, projection));
  const height = cell.radius * 1.05;
  const centreY = ground.reduce((sum, point) => sum + point.y, 0) / ground.length;
  const tops = ground.map((point, i) => ({ x: point.x, y: point.y - height * (.9 + .1 * Math.sin(i * 1.9)) }));
  const between = (a: { x: number; y: number }, b: { x: number; y: number }, t: number) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  barrier.faces.forEach((face, i) => {
    const a = ground[i], b = ground[(i + 1) % ground.length], ta = tops[i], tb = tops[(i + 1) % ground.length];
    const c1 = between(tb, ta, 1 / 3), c2 = between(tb, ta, 2 / 3);
    face.group.classList.toggle('is-rear', (a.y + b.y) / 2 < centreY);
    setIf(face.wall, 'd', `M${a.x} ${a.y} L${b.x} ${b.y} L${tb.x} ${tb.y} C${c1.x} ${c1.y - height * .16} ${c2.x} ${c2.y + height * .12} ${ta.x} ${ta.y} Z`);
    face.flows.forEach((flow, j) => {
      const base = between(a, b, (j + 1) / (face.flows.length + 1));
      const rise = height * (.65 + .25 * Math.sin(j * 1.7 + i) ** 2), drift = height * .08 * Math.sin(j * 1.3 + i);
      setIf(flow, 'd', `M${base.x} ${base.y} Q${base.x - drift * .5} ${base.y - rise * .5} ${base.x + drift} ${base.y - rise}`);
    });
  });
  const outline = ground.map((point, i) => `${i ? 'L' : 'M'}${point.x} ${point.y}`).join(' ') + ' Z';
  barrier.rims.forEach((rim) => setIf(rim, 'd', outline));
  barrier.signature = signature;
}

export interface MapRenderer {
  readonly cells: readonly MapStaticCell[];
  updateModel(model: MapPaintModel): void;
  updateCamera(camera: MapCameraState): void;
  setHover(axialKey: string | null): void;
  setVisible(visible: boolean): void;
  pick(target: EventTarget | null): Picked | null;
  resize(): void;
  destroy(): void;
}

type Dirty = { Surface: boolean; Adventure: boolean; Projection: boolean; Viewport: boolean; Player: boolean; Hover: boolean; Names: boolean; Measure: boolean };
const clean = (): Dirty => ({ Surface: false, Adventure: false, Projection: false, Viewport: false, Player: false, Hover: false, Names: false, Measure: false });

/** One facade owns the index, the pending frame, the latest snapshot and its dirty flags. */
export function createMapRenderer(root: HTMLElement, observeWork?: (event: 'index' | 'depth-sort' | 'flush') => void): MapRenderer {
  const svg = root.querySelector('svg');
  if (!svg) throw new Error('map: no SVG');
  const index = createMapDomIndex(svg);
  observeWork?.('index');
  let model: MapPaintModel | null = null;
  let camera: MapCameraState = { ...DEFAULT_MAP_CAMERA };
  let hovered: string | null = null;
  let visible = true;
  let destroyed = false;
  let raf = 0;
  let measure = 0;
  let surfaceKey = '', adventureKey = '', namesKey = '';
  const dirty: Dirty = clean();

  const flush = () => {
    raf = 0;
    if (!model || destroyed || !visible) return;
    const work = { ...dirty };
    for (const key of Object.keys(dirty) as (keyof Dirty)[]) dirty[key] = false;
    if (work.Surface) paintSurface(index, model);
    if (work.Adventure) paintMapAdventure(index, model.adventure, model.surface.options.view === 'terrain');
    if (work.Projection || work.Player || work.Viewport || work.Surface) {
      paintMapScene(index, camera, work.Projection);
      if (work.Projection) observeWork?.('depth-sort');
    }
    if (work.Hover) paintHover(index, hovered, camera);
    if (work.Names) paintNames(index, model, hovered, measure, camera);
    observeWork?.('flush');
  };
  const schedule = () => {
    if (destroyed || !visible || !model || raf) return;
    raf = requestAnimationFrame(flush);
  };

  return {
    get cells() { return index.cells.map((cell) => cell.static); },
    updateModel(next) {
      const nextSurface = JSON.stringify(next.surface);
      const nextAdventure = JSON.stringify(next.adventure);
      const nextNames = JSON.stringify([next.surface.options.showNames, next.surface.options.cleanMap, next.labels]);
      if (nextSurface !== surfaceKey) {
        const previous = model?.surface;
        surfaceKey = nextSurface;
        dirty.Surface = true;
        if (previous && previous.playerAx !== next.surface.playerAx) dirty.Player = true;
      }
      if (nextAdventure !== adventureKey) { adventureKey = nextAdventure; dirty.Adventure = true; dirty.Names = true; }
      if (nextNames !== namesKey) { namesKey = nextNames; dirty.Names = true; }
      model = next;
      schedule();
    },
    updateCamera(next) {
      const previous = camera;
      camera = { ...next };
      if (previous.bearing !== next.bearing) { dirty.Projection = true; dirty.Viewport = true; dirty.Player = true; dirty.Hover = true; dirty.Names = true; }
      else if (previous.panX !== next.panX || previous.panY !== next.panY || previous.zoom !== next.zoom) {
        dirty.Viewport = true; dirty.Hover = true; dirty.Names = true;
      }
      schedule();
    },
    setHover(key) {
      if (key === hovered) return;
      hovered = key;
      dirty.Hover = true; dirty.Names = true;
      schedule();
    },
    setVisible(next) {
      visible = next;
      if (!next) { if (raf) cancelAnimationFrame(raf); raf = 0; return; }
      dirty.Surface = true; dirty.Adventure = true; dirty.Projection = true; dirty.Names = true;
      schedule();
    },
    pick(target) {
      const node = (target as Element | null)?.closest?.('polygon.cell') as SVGPolygonElement | null;
      if (!node) return null;
      const cell = index.byAx.get(node.getAttribute('data-ax') || '');
      return cell ? { ...cell.static.picked } : null;
    },
    resize() {
      measure += 1;
      dirty.Viewport = true; dirty.Measure = true; dirty.Names = true;
      schedule();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      model = null;
    },
  };
}

export { mapLevelBand };
