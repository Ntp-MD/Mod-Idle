import { MAP_CAMERA, mapProjectionTransform, mapUprightAt, mapUprightAround, projectMapPoint } from '../map-projection';
import type { MapDomIndex } from './map-dom';

const set = (node: Element, name: string, value: string) => { if (node.getAttribute(name) !== value) node.setAttribute(name, value); };
const orders = new WeakMap<MapDomIndex, number[]>();

/** North-up ground; separate objects share a stable back-to-front order. */
export function paintMapScene(index: MapDomIndex): boolean {
  const projection = MAP_CAMERA;
  set(index.board, 'transform', mapProjectionTransform(projection));
  const matrix = index.svg.getScreenCTM(), frame = index.svg.getBoundingClientRect();
  const scale = matrix ? Math.hypot(matrix.a, matrix.b) : 1;
  const points = index.cells.map((cell) => projectMapPoint(cell.center.x, cell.center.y, projection));
  const cached = orders.get(index);
  let order: number[];
  if (!cached) {
    order = index.cells.map((_, i) => i)
      .sort((a, b) => points[a].y - points[b].y || points[a].x - points[b].x);
    orders.set(index, order);
  } else order = cached;
  const nextCell = (node: Element | null) => {
    while (node && !node.classList.contains('map-scene-cell')) node = node.nextElementSibling;
    return node;
  };
  let cursor = nextCell(index.actors.firstElementChild);
  for (const at of order) {
    const cell = index.cells[at], point = points[at];
    if (cell.holder !== cursor) index.actors.insertBefore(cell.holder, cursor);
    cursor = nextCell(cell.holder.nextElementSibling);
    const screen = matrix ? new DOMPoint(point.x, point.y).matrixTransform(matrix) : null;
    const margin = cell.radius * scale * 4;
    const visible = !screen || screen.x >= frame.left - margin && screen.x <= frame.right + margin
      && screen.y >= frame.top - margin && screen.y <= frame.bottom + margin;
    set(cell.holder, 'display', visible ? '' : 'none');
    if (!visible) continue;
    set(cell.actor, 'transform', mapUprightAt(cell.center.x, cell.center.y, projection));
    if (cell.figure && !cell.planar) {
      set(cell.figure, 'transform', mapUprightAt(cell.center.x, cell.center.y, projection));
      const calibration = cell.figure.querySelector('.hex-calibration');
      if (calibration) set(calibration, 'transform', mapProjectionTransform(projection) + ' ' + mapUprightAt(0, 0));
    }
  }
  for (const id of ['ids', 'walk']) {
    const labels = index.svg.querySelector<SVGGElement>('#' + id);
    if (!labels || labels.style.display === 'none') continue;
    for (const label of Array.from(labels.querySelectorAll<SVGGraphicsElement>('text'))) {
      set(label, 'transform', mapUprightAround(Number(label.getAttribute('x')), Number(label.getAttribute('y')), projection));
    }
  }
  return !cached;
}
