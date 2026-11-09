import type { MapDomIndex } from './map-dom';
import type { MapPaintModel } from '../map-types';

const painted = new WeakSet<MapDomIndex>();
const setIf = (el: Element, name: string, value: string) => { if (el.getAttribute(name) !== value) el.setAttribute(name, value); };

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
export function paintSurface(index: MapDomIndex, model: MapPaintModel) {
  const surface = model.surface, view = surface.options.view;
  const route = new Set<string>(surface.route), walked = new Set<string>(surface.walked);
  const selectedCell = surface.selectedAx ? index.byAx.get(surface.selectedAx) : null;
  index.svg.querySelectorAll('.node').forEach((node) => node.classList.toggle('picked', node.getAttribute('data-node') === surface.selectedTown));
  index.svg.querySelectorAll('.pin').forEach((pin) => pin.classList.remove('here', 'target'));
  plantGlows(index);
  for (const [i, cell] of index.cells.entries()) {
    const paint = surface.cells[i];
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
    if (cell.ax === surface.playerAx) setIf(p, 'aria-current', 'location');
    else p.removeAttribute('aria-current');
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
}
