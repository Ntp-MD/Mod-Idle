import { eng } from '../engine/client';
import { E, fieldwork } from '../engine/client';
import { settlementById } from '../sim/town';
import { rankOf, currentCell, walkedCells, trailCells, cellsTo } from '../sim/road';
import { mapUprightAt, projectMapPoint } from './map-projection';
import { lowerLeftEdge, mapLevelBand, mapNameLines, mapSlantDeg, placeMapNames, type MapNameBox } from './map-labels';
import { nearbyMapEncounters, type MapEncounterSite } from './map-encounters';
import { mobIcon } from '../icon';
import { mapSpeciesArt } from './map-species-art';
import { paintMapAdventure } from './map-adventure';
import { trailSiteAt, trailSiteKind } from '../sim/map-exploration';

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

/**
 * The sheet is repainted after every `{@html}` rebuild: the fills follow the view, the walk graph
 * and the cell ids show or hide, and the plotted route lights up one cell per block — the cells
 * already crossed in a darker tone. It matches the engine's own cell keys against the labels the
 * generated sheet carries, so no position table is ever read (X33 · M7 · M10). The hex the feet are
 * on is marked where it lies, and a character mark is built once and then moved cell to cell, so a
 * walk reads as a walk rather than a jump.
 */
export function paintSheet(root: HTMLElement, opts: PaintOpts) {
  const { view: v, gateLevel: lv, showIds: ids, showWalk: hops, pickedCell, gameState } = opts;
  const walk = gameState.walk;
  const selectedTown = pickedCell && root.querySelector(`polygon.cell[data-ax="${pickedCell.q},${pickedCell.r}"]`)?.getAttribute('data-node');
  root.querySelectorAll('.node').forEach(node => node.classList.toggle('picked', node.getAttribute('data-node') === selectedTown));
  // The pin layer is retired: position reads off the hex edge itself (see `pin-here` / `pin-target`
  // on the cell polygon), so no circle ever covers the terrain, icon or mob art mid-cell.
  root.querySelectorAll('.pin').forEach(pin => {
    pin.classList.remove('here', 'target');
  });
  const cells = Array.from(root.querySelectorAll<SVGPolygonElement>('polygon.cell'));
  featherFieldEdge(cells);
  for (const p of cells) {
    p.classList.remove('locked');
    p.classList.remove('site-dungeon', 'site-mine', 'site-grove', 'field-camp');
    const wildIndex = p.getAttribute('data-wild');
    const site = wildIndex == null ? null : fieldwork.siteAt(Number(wildIndex));
    if (site) p.classList.add(`site-${site}`);
    const camp = gameState.fieldwork?.camp;
    if (camp && camp.cell.q === Number(p.getAttribute('data-ax')?.split(',')[0]) && camp.cell.r === Number(p.getAttribute('data-ax')?.split(',')[1])) p.classList.add('field-camp');
    if (v === 'terrain') p.setAttribute('fill', p.getAttribute('data-tone') || 'none');
    else if (!p.hasAttribute('data-lo')) p.setAttribute('fill', 'none');
    else {
      p.setAttribute('fill', ramp(Number(p.getAttribute('data-band'))));
      // the gate holds the fill as a state the stylesheet paints (`--ground`), not a second colour here
      if (v !== 'band' && lv < Number(p.getAttribute('data-lo'))) p.classList.add('locked');
    }
    const edgeOpacity = v === 'terrain' ? p.getAttribute('data-edge-opacity') || '1' : '1';
    p.setAttribute('fill-opacity', edgeOpacity);
    p.setAttribute('stroke-opacity', edgeOpacity);
    p.classList.remove('route', 'walked', 'picked', 'standing', 'pin-here', 'pin-target');
  }
  // Position reads off the hex edge, not a circle mid-cell: the settlement cell itself carries the
  // state, so terrain, icons and mob art stay uncovered. A settlement polygon carries `data-node`
  // with no `data-sub`/`data-wild`; sides carry one of those, so excluding them lands on the town.
  const hereTown = !walk ? opts.townId : null;
  const targetTown = walk && walk.kind === 'town' && walk.node !== opts.townId ? walk.node : null;
  if (hereTown || targetTown) {
    const townCell = (id: string | null) => {
      if (!id) return null;
      const cells = Array.from(root.querySelectorAll(`polygon.cell[data-node="${id}"]`));
      return cells.find(cell => !cell.hasAttribute('data-sub') && !cell.hasAttribute('data-wild')) || cells[0] || null;
    };
    const here = hereTown && townCell(hereTown);
    if (here) (here as Element).classList.add('pin-here');
    const target = targetTown && targetTown !== hereTown && townCell(targetTown);
    if (target) (target as Element).classList.add('pin-target');
  }
  const toggle = (id: string, on: boolean) => {
    const g = root.querySelector('#' + id) as HTMLElement | null;
    if (g) g.style.display = on ? '' : 'none';
  };
  toggle('ids', ids);
  toggle('walk', hops);
  const regions = root.querySelector('#regions') as HTMLElement | null;
  if (regions) regions.style.opacity = v === 'terrain' ? '1' : '0';
  if (pickedCell || walk) {
    const crossed = new Set(walkedCells(gameState));
    const keys = walk ? trailCells(gameState) : cellsTo(gameState, { q: pickedCell!.q, r: pickedCell!.r });
    keys.forEach((k: string) => {
      const cell = root.querySelector(`polygon.cell[data-ax="${k}"]`);
      if (cell) cell.classList.add(crossed.has(k) ? 'walked' : 'route');
    });
    if (pickedCell) root.querySelector(`polygon.cell[data-ax="${pickedCell.q},${pickedCell.r}"]`)?.classList.add('picked');
  }
  // the hex the feet are on is marked where it lies, so standing is read off the ground itself
  const feet = currentCell(gameState);
  const at = root.querySelector(`polygon.cell[data-ax="${feet.q},${feet.r}"]`);
  at?.classList.add('standing');
  root.querySelectorAll('.zonelabel').forEach(label => {
    const id = label.getAttribute('data-cell');
    label.classList.toggle('active', id === pickedCell?.key || id === at?.getAttribute('data-cell'));
  });
  // …and the character stands on it, one hex per block: the cell's own hexagon washed in the accent and
  // a mark at its centre, both read off the geometry the sheet already carries (X33 · M7). Every cell is
  // the same hexagon translated, so the mark is built once and then *moved* — the sheet slides it to the
  // next cell, and a walk reads as a walk rather than as a jump.
  const svg = root.querySelector('svg');
  svg?.setAttribute('data-view', v);
  if (svg && at) {
    let you = svg.querySelector('g.you');
    const pts = (at.getAttribute('points') || '').trim().split(/\s+/).map((p: string) => p.split(',').map(Number));
    const cx = pts.reduce((n: number, p: number[]) => n + p[0], 0) / pts.length;
    const cy = pts.reduce((n: number, p: number[]) => n + p[1], 0) / pts.length;
    if (!you) {
      const NS = 'http://www.w3.org/2000/svg';
      you = document.createElementNS(NS, 'g');
      you.setAttribute('class', 'you');
      const mark = document.createElementNS(NS, 'image');
      mark.setAttribute('class', 'mark');
      mark.setAttribute('href', '/map/traveler-piece.png');
      mark.setAttribute('x', '-30'); mark.setAttribute('y', '-26');
      mark.setAttribute('width', '30'); mark.setAttribute('height', '38');
      you.append(mark);
      (svg.querySelector('#projected-board') || svg).appendChild(you);
    }
    const position = `${feet.q},${feet.r}`;
    const previous = you.getAttribute('data-position');
    if (previous && previous !== position) {
      you.classList.remove('stepping');
      you.getBoundingClientRect();
      you.classList.add('stepping');
    }
    you.setAttribute('data-position', position);
    you.setAttribute('transform', mapUprightAt(cx, cy));
    you.classList.toggle('walking', !!walk);
  }
  const board = svg?.querySelector('#projected-board');
  if (!board) return;
  const sites: MapEncounterSite[] = cells.flatMap(cell => {
    const townId = cell.getAttribute('data-node'), sub = cell.getAttribute('data-sub');
    if (!townId || sub == null) return [];
    const town = settlementById(townId);
    const id = town && eng.zoneById(town.zone).subzones?.[Number(sub)]?.species?.[0];
    if (!id) return [];
    const [q, r] = (cell.getAttribute('data-ax') || '').split(',').map(Number);
    return [{ key: cell.getAttribute('data-cell')!, q, r, species: eng.speciesById(id)?.name || id }];
  });
  const activeSpecies = gameState.group[0]?.species || '';
  if (activeSpecies && rankOf(feet) > 0 && !sites.some(site => site.q === feet.q && site.r === feet.r)) {
    sites.push({ key: at!.getAttribute('data-cell')!, q: feet.q, r: feet.r, species: activeSpecies });
  }
  const campCell = gameState.fieldwork.camp?.cell;
  const nearby = v === 'terrain' ? nearbyMapEncounters(sites, feet, activeSpecies).filter(site =>
    !campCell || site.q !== campCell.q || site.r !== campCell.r || (activeSpecies && site.q === feet.q && site.r === feet.r)) : [];
  const visible = new Set(nearby.map(site => site.key));
  board.querySelectorAll<SVGGElement>('.map-mob').forEach(marker => {
    if (!visible.has(marker.getAttribute('data-cell') || '')) marker.remove();
  });
  const NS = 'http://www.w3.org/2000/svg';
  for (const site of nearby) {
    const cell = root.querySelector<SVGPolygonElement>(`polygon.cell[data-cell="${site.key}"]`)!;
    const box = cell.getBBox();
    const pocket = board.querySelector<SVGGElement>(`[data-figure-ax="${site.q},${site.r}"] .terrain-occupant`);
    const parent = pocket || board;
    let marker = board.querySelector<SVGGElement>(`.map-mob[data-cell="${site.key}"]`);
    if (!marker) {
      marker = document.createElementNS(NS, 'g');
      marker.setAttribute('class', 'map-mob'); marker.setAttribute('data-cell', site.key);
      marker.setAttribute('role', 'img');
      const shadow = document.createElementNS(NS, 'ellipse');
      shadow.setAttribute('class', 'map-mob-shadow');
      shadow.setAttribute('cx', '8'); shadow.setAttribute('cy', '2');
      shadow.setAttribute('rx', '7'); shadow.setAttribute('ry', '2');
      const species = document.createElementNS(NS, 'image');
      species.setAttribute('class', 'map-mob-species');
      species.setAttribute('x', '-5'); species.setAttribute('y', '-24');
      species.setAttribute('width', '26'); species.setAttribute('height', '29');
      species.setAttribute('preserveAspectRatio', 'xMidYMax meet');
      marker.append(shadow, species); parent.append(marker);
    }
    if (marker.parentNode !== parent) parent.append(marker);
    marker.setAttribute('aria-label', `${site.species} on block ${site.key}`);
    const art = mapSpeciesArt(site.species);
    const figure = marker.querySelector('image')!;
    figure.setAttribute('href', art || mobIcon(site.species));
    figure.setAttribute('x', art ? '-12' : '-5');
    figure.setAttribute('y', art ? '-35' : '-24');
    figure.setAttribute('width', art ? '40' : '26');
    figure.setAttribute('height', art ? '40' : '29');
    marker.setAttribute('transform', pocket ? 'translate(0 0)' : mapUprightAt(box.x + box.width / 2, box.y + box.height / 2));
  }
  paintMapAdventure(root, gameState, v === 'terrain');
}

/** Upright screen-sized labels are separate from the board's camera projection. */
export function paintMapNames(root: HTMLElement, opts: { show: boolean; hovered: string | null; picked: string | null }) {
  const svg = root.querySelector('svg');
  const matrix = svg?.getScreenCTM();
  if (!svg || !matrix) return;
  const scale = Math.hypot(matrix.a, matrix.b);
  if (!scale) return;
  const NS = 'http://www.w3.org/2000/svg';
  let layer = svg.querySelector<SVGGElement>('#map-names');
  if (!layer) { layer = document.createElementNS(NS, 'g'); layer.id = 'map-names'; svg.append(layer); }
  layer.replaceChildren();
  const cells = Array.from(svg.querySelectorAll<SVGPolygonElement>('polygon.cell'));
  const cellW = cells[0]?.getBoundingClientRect().width || 0;
  const overview = cellW < 115;
  // Mid zoom shows towns only; subs join once cells are large enough to breathe. Wild sides
  // (mine/grove/dungeon) stay hover/pick-only so they never carpet the board.
  const close = cellW >= 190;
  const frame = root.getBoundingClientRect();
  const candidates: MapNameBox[] = [];
  const groups = new Map<string, SVGGElement>();
  const slant = mapSlantDeg();
  const add = (key: string, name: string, x: number, y: number, cls: string, level: string, forced: boolean, priority: number, slanted: false | { angleDeg: number } = false) => {
    const anchor = new DOMPoint(x, y).matrixTransform(matrix);
    if (anchor.x < frame.left - 180 || anchor.x > frame.right + 180 || anchor.y < frame.top || anchor.y > frame.bottom) return;
    const group = document.createElementNS(NS, 'g');
    group.setAttribute('class', `map-name${cls ? ` ${cls}` : ''}${forced ? ' important-name' : ''}${slanted ? ' map-name-slanted' : ''}`);
    group.setAttribute('data-name-key', key);
    group.setAttribute('aria-hidden', 'true');
    layer!.append(group);
    // Every label sits along its own lower edge: single line, slanted to match, with the zone's
    // level band riding in the same line so nothing ever needs a second row.
    const title = slanted && level ? `${name} · ${level}` : name;
    const lines = slanted ? [title] : mapNameLines(name);
    const texts = lines.map((line, i) => {
      const text = document.createElementNS(NS, 'text');
      text.setAttribute('class', 'map-name-title'); text.setAttribute('y', String(13 + i * 18));
      text.textContent = line; group.append(text); return text;
    });
    if (level && !slanted) {
      const text = document.createElementNS(NS, 'text'); text.setAttribute('class', 'map-name-level');
      text.setAttribute('y', String(13 + lines.length * 18)); text.textContent = level; group.append(text); texts.push(text);
    }
    const width = Math.ceil(Math.max(...texts.map(t => t.getComputedTextLength()))) + 18;
    const height = 10 + lines.length * 18 + (level && !slanted ? 16 : 0);
    texts.forEach(text => text.setAttribute('x', String(width / 2)));
    if (forced || !cls.includes('map-name-bare')) {
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('width', String(width)); rect.setAttribute('height', String(height)); rect.setAttribute('rx', '4');
      group.prepend(rect);
    }
    candidates.push({ key, left: Math.max(frame.left + 6, Math.min(frame.right - width - 6, anchor.x - width / 2)),
      top: Math.max(frame.top + 6, Math.min(Math.min(frame.bottom, innerHeight) - height - 6, anchor.y)),
      width, height, priority, forced, slanted: !!slanted, angleDeg: slanted ? slanted.angleDeg : undefined });
    groups.set(key, group);
  };
  for (const cell of cells) {
    const key = cell.getAttribute('data-cell')!;
    const forced = key === opts.hovered || key === opts.picked;
    if (!forced && (!opts.show || overview || !cell.hasAttribute('data-node'))) continue;
    const label = cellLabel(cell), box = cell.getBBox();
    // Zoom tiers: towns always, subs only when close, wild sides only on hover/pick.
    if (!forced && label.kind === 'sub' && !close) continue;
    if (!forced && label.kind === 'wild') continue;
    // Every label rides one line: name + zone band together, so nothing ever needs a second row.
    // `data-lo/hi` sits on every zoned cell, so towns, subs and wild sides all carry their band.
    const level = mapLevelBand(cell.getAttribute('data-discovery'), cell.getAttribute('data-lo'), cell.getAttribute('data-hi'));
    const cls = label.kind === 'town' ? 'town-name' : label.kind === 'sub' ? 'map-name-bare sub-name' : 'map-name-bare wild-name';
    const priority = key === opts.hovered ? 4 : key === opts.picked ? 3
      : cell.classList.contains('standing') ? 2 : label.kind === 'town' ? 1 : 0;
    // Every label — idle, hovered or picked — hugs its own lower-left edge (edge 4), read off the
    // polygon itself in screen space, then lifted just above it along the inward normal.
    // Hovered/picked only gains the gold frame; the shape never changes.
    const pts = (cell.getAttribute('points') || '').trim().split(/\s+/).map(p => {
      const [px, py] = p.split(',').map(Number);
      return { x: px, y: py };
    });
    const toScreen = (px: number, py: number) => {
      const world = projectMapPoint(px, py);
      const s = new DOMPoint(world.x, world.y).matrixTransform(matrix);
      return { x: s.x, y: s.y };
    };
    const edge = pts.length >= 6 && pts.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))
      ? lowerLeftEdge(pts, toScreen)
      : (() => {
        const world = projectMapPoint(box.x + box.width / 2, box.y + box.height * .72);
        const s = new DOMPoint(world.x, world.y).matrixTransform(matrix);
        return { mx: s.x, my: s.y, angleDeg: slant, nx: 0, ny: -1 };
      })();
    const lift = 30; // text baseline sits this many screen px above the edge line (inward normal)
    // Nudge every place ribbon 10 screen px left so the plate clears the hex's right rim.
    const sx = edge.mx + edge.nx * lift - 10, sy = edge.my + edge.ny * lift;
    // `add` expects world coords and applies the screen matrix itself — convert back once.
    const inv = matrix.inverse();
    const worldAnchor = new DOMPoint(sx, sy).matrixTransform(inv);
    const trailSite = trailSiteAt(label);
    const name = label.kind !== 'town' && cell.getAttribute('data-discovery') === 'unknown' ? 'Unexplored ground'
      : trailSite ? trailSiteKind(trailSite).name : label.label;
    add(key, name, worldAnchor.x, worldAnchor.y, cls, level, forced,
      priority, { angleDeg: edge.angleDeg });
  }
  if (overview && opts.show) svg.querySelectorAll<SVGTextElement>('#regions .region').forEach((text, i) => {
    const point = projectMapPoint(Number(text.getAttribute('x')), Number(text.getAttribute('y')));
    add(`region-${i}`, text.textContent || '', point.x, point.y, 'town-name', '', false, 1);
  });
  const visible = new Set<string>();
  const placedByKey = new Map(placeMapNames(candidates).map(box => [box.key, box]));
  const inverse = matrix.inverse();
  for (const [key, group] of groups) {
    const box = placedByKey.get(key);
    if (!box) { group.remove(); continue; }
    visible.add(box.key);
    const point = new DOMPoint(box.left, box.top).matrixTransform(inverse);
    // A slanted ribbon pivots on its own text baseline, at its own edge angle — the anchor
    // already sits on that edge, so the plate hugs it instead of orbiting its box centre.
    const tilt = box.slanted
      ? ` translate(${box.width / 2} 13) rotate(${(box.angleDeg ?? slant).toFixed(2)}) translate(${-box.width / 2} -13)` : '';
    groups.get(box.key)!.setAttribute('transform', `translate(${point.x} ${point.y}) scale(${1 / scale})${tilt}`);
  }
}
