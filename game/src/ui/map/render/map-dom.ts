/** One validated DOM index over the generated map sheet: the caller owns it, nothing is cached here. */
import { resolveMapCell, world } from '../map-world';
import type { AxialKey, MapStaticCell } from '../map-types';
import type { MapPoint } from '../map-camera';

export interface MapDomCell {
  ax: AxialKey;
  displayKey: string;
  nodeId: string | null;
  zone: number | null;
  sub: number | null;
  site: string | null;
  polygon: SVGPolygonElement;
  actor: SVGGElement;
  scenery: SVGGElement;
  figure: SVGGElement | null;
  holder: SVGGElement;
  center: MapPoint;
  radius: number;
  planar: boolean;
  static: MapStaticCell;
}

export interface MapDomIndex {
  svg: SVGSVGElement;
  board: SVGGElement;
  actors: SVGGElement;
  ids: SVGGElement | null;
  walk: SVGGElement | null;
  regions: SVGGElement | null;
  cells: readonly MapDomCell[];
  polygons: readonly SVGPolygonElement[];
  byAx: ReadonlyMap<string, MapDomCell>;
  byDisplayKey: ReadonlyMap<string, MapDomCell>;
  byTown: ReadonlyMap<string, MapDomCell[]>;
  titles: readonly SVGTitleElement[];
}

const NS = 'http://www.w3.org/2000/svg';
const AXIAL = /^-?\d+,-?\d+$/;

function numberOrNull(value: string | null): number | null {
  if (value == null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function edgeOpacityOf(polygon: SVGPolygonElement): number {
  const parsed = numberOrNull(polygon.getAttribute('data-edge-opacity'));
  return parsed == null ? 1 : parsed;
}

function parsePoints(ax: string, polygon: SVGPolygonElement): readonly MapPoint[] {
  const raw = (polygon.getAttribute('points') || '').trim();
  const values = raw ? raw.split(/[\s,]+/).map(Number) : [];
  if (values.length !== 12 || values.some((value) => !Number.isFinite(value)))
    throw new Error(`map: cell ${ax} has malformed points`);
  const points = Array.from({ length: 6 }, (_, i) => ({ x: values[i * 2], y: values[i * 2 + 1] }));
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i], b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  if (!Number.isFinite(area) || area === 0) throw new Error(`map: cell ${ax} has degenerate geometry`);
  return points;
}

function directTitle(polygon: SVGPolygonElement): SVGTitleElement | null {
  const title = Array.from(polygon.children).find((child) => child.localName === 'title');
  return (title as SVGTitleElement | undefined) ?? null;
}

type ParsedCell = {
  polygon: SVGPolygonElement;
  ax: string;
  displayKey: string;
  nodeId: string | null;
  zone: number | null;
  sub: number | null;
  site: string | null;
  center: MapPoint;
  radius: number;
  staticCell: MapStaticCell;
};

export function createMapDomIndex(svg: SVGSVGElement): MapDomIndex {
  const board = svg.querySelector<SVGGElement>('#projected-board');
  if (!board) throw new Error('map: missing #projected-board group');
  const actors = svg.querySelector<SVGGElement>('#actors');
  if (!actors) throw new Error('map: missing #actors group');
  const polygons = Array.from(svg.querySelectorAll<SVGPolygonElement>('polygon.cell'));
  if (!polygons.length) throw new Error('map: no polygon.cell cells');

  const parsed: ParsedCell[] = [];
  const titles: SVGTitleElement[] = [];
  const axialKeys = new Set<string>();
  const displayKeys = new Set<string>();
  for (const polygon of polygons) {
    const ax = polygon.getAttribute('data-ax');
    if (!ax || !AXIAL.test(ax)) throw new Error(`map: cell has invalid data-ax ${ax ?? '(missing)'}`);
    const displayKey = polygon.getAttribute('data-cell');
    if (!displayKey) throw new Error(`map: cell ${ax} has no data-cell`);
    if (axialKeys.has(ax)) throw new Error(`map: duplicate axial key ${ax}`);
    if (displayKeys.has(displayKey)) throw new Error(`map: duplicate display key ${displayKey}`);
    axialKeys.add(ax);
    displayKeys.add(displayKey);
    const [q, r] = ax.split(',').map(Number);
    if (!world.isLand({ q, r })) throw new Error(`map: cell ${ax} is not standable land`);
    const points = parsePoints(ax, polygon);
    const box = polygon.getBBox();
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const radius = box.height / 2;
    const title = directTitle(polygon);
    if (title) titles.push(title);
    // World facts resolve from the coordinates; the sheet's data-* marks stay presentation only.
    const cell = world.cellAt({ q, r });
    if (!cell) throw new Error(`map: cell ${ax} is not standable land`);
    const loc = cell.locationId ? world.locationById(cell.locationId) : null;
    const nodeId = loc ? world.ownerOf({ q, r }).id : null;
    const zone = cell.zoneId;
    const staticCell: MapStaticCell = {
      ax: ax as AxialKey,
      picked: resolveMapCell({ q, r }, displayKey),
      nodeId,
      zone,
      originalTitle: title?.textContent ?? '',
      tone: polygon.getAttribute('data-tone') ?? '',
      edgeOpacity: edgeOpacityOf(polygon),
      band: cell.zoneId - 1,
      center,
      radius,
      points,
    };
    parsed.push({
      polygon, ax, displayKey, nodeId, zone,
      sub: loc?.kind === 'sub' ? loc.index : null,
      site: loc?.kind === 'site' ? (loc.site ?? null) : null,
      center, radius, staticCell,
    });
  }

  const figures = new Map<string, SVGGElement>();
  for (const node of Array.from(svg.querySelectorAll<SVGGElement>('[data-figure-ax]'))) {
    const ax = node.getAttribute('data-figure-ax');
    if (ax) figures.set(ax, node);
  }
  const actorsByAx = new Map<string, SVGGElement>();
  for (const node of Array.from(svg.querySelectorAll<SVGGElement>('[data-actor-ax]'))) {
    const ax = node.getAttribute('data-actor-ax');
    if (ax) actorsByAx.set(ax, node);
  }

  // Existing sheets may still carry hosts from the retired overlay renderer.
  svg.querySelectorAll('g.you, .actor-signals').forEach(node => node.remove());
  const doc = svg.ownerDocument;
  const cells: MapDomCell[] = [];
  const byAx = new Map<string, MapDomCell>();
  const byDisplayKey = new Map<string, MapDomCell>();
  const byTown = new Map<string, MapDomCell[]>();
  for (const entry of parsed) {
    const figure = figures.get(entry.ax) ?? null;
    const actor = actorsByAx.get(entry.ax);
    const scenery = actor?.querySelector<SVGGElement>('.actor-scenery');
    if (!actor || !scenery) throw new Error(`map: cell ${entry.ax} has no content host`);
    const parent = actor?.parentElement ?? figure?.parentElement ?? null;
    const holder = parent && parent.classList.contains('map-scene-cell')
      ? parent as unknown as SVGGElement
      : doc.createElementNS(NS, 'g') as SVGGElement;
    holder.setAttribute('class', 'map-scene-cell');
    holder.setAttribute('data-scene-ax', entry.ax);
    if (figure) holder.prepend(figure);
    if (actor) holder.append(actor);
    if (holder.parentNode !== actors) actors.append(holder);
    const cell: MapDomCell = {
      ax: entry.staticCell.ax,
      displayKey: entry.displayKey,
      nodeId: entry.nodeId,
      zone: entry.zone,
      sub: entry.sub,
      site: entry.site,
      polygon: entry.polygon,
      actor,
      scenery,
      figure,
      holder,
      center: entry.center,
      radius: entry.radius,
      planar: !!figure?.querySelector('.terrain-ground'),
      static: entry.staticCell,
    };
    cells.push(cell);
    byAx.set(cell.ax, cell);
    byDisplayKey.set(cell.displayKey, cell);
    if (cell.nodeId) {
      const owned = byTown.get(cell.nodeId) ?? [];
      owned.push(cell);
      byTown.set(cell.nodeId, owned);
    }
  }

  const regions = svg.querySelector<SVGGElement>('#regions');

  return {
    svg,
    board,
    actors,
    ids: svg.querySelector<SVGGElement>('#ids'),
    walk: svg.querySelector<SVGGElement>('#walk'),
    regions,
    cells,
    polygons,
    byAx,
    byDisplayKey,
    byTown,
    titles,
  };
}
