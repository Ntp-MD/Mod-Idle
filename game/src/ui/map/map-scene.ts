import { createMapProjection, mapProjectionTransform, mapUprightAt, mapUprightAround, projectMapPoint } from './map-projection';
import type { MapCameraState } from './map-camera';
import type { MapDomIndex } from './map-dom';

const NS = 'http://www.w3.org/2000/svg';
const set = (node: Element, name: string, value: string) => { if (node.getAttribute(name) !== value) node.setAttribute(name, value); };
const orders = new WeakMap<MapDomIndex, { bearing: number; order: number[] }>();

/** Orbit an orthographic ground plane; upright artwork is depth sorted and faces the screen. */
export function paintMapScene(index: MapDomIndex, camera: MapCameraState, resort = false) {
  const projection = createMapProjection(camera.bearing);
  set(index.board, 'transform', mapProjectionTransform(projection));
  const matrix = index.svg.getScreenCTM(), frame = index.svg.getBoundingClientRect();
  const scale = matrix ? Math.hypot(matrix.a, matrix.b) : 1;
  const points = index.cells.map((cell) => projectMapPoint(cell.center.x, cell.center.y, projection));
  const cached = orders.get(index);
  let order: number[];
  if (!cached || resort || cached.bearing !== camera.bearing) {
    order = index.cells.map((_, i) => i)
      .sort((a, b) => points[a].y - points[b].y || points[a].x - points[b].x);
    orders.set(index, { bearing: camera.bearing, order });
  } else order = cached.order;
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
    set(cell.actor!, 'transform', mapUprightAt(cell.center.x, cell.center.y, projection));
    if (cell.figure && !cell.planar) {
      set(cell.figure, 'transform', mapUprightAt(cell.center.x, cell.center.y, projection));
      const calibration = cell.figure.querySelector('.hex-calibration');
      if (calibration) set(calibration, 'transform', mapProjectionTransform(projection) + ' ' + mapUprightAt(0, 0));
    }
  }
  const you = index.actors.querySelector<SVGGElement>('g.you');
  const feet = you && index.cells.find((cell) => cell.ax === you.getAttribute('data-position'));
  if (you && feet) {
    const feetPoint = projectMapPoint(feet.center.x, feet.center.y, projection);
    set(you, 'transform', mapUprightAt(feet.center.x, feet.center.y, projection));
    const ahead = index.cells.map((cell, i) => ({ cell, point: points[i] }))
      .sort((a, b) => a.point.y - b.point.y)
      .find(({ point }) => point.y > feetPoint.y)?.cell.holder || null;
    if (you.nextElementSibling !== ahead) index.actors.insertBefore(you, ahead);
  }
  for (const piece of Array.from(index.svg.querySelectorAll('[data-map-ground]'))) set(piece, 'transform', mapProjectionTransform(projection));
  for (const id of ['ids', 'walk']) {
    const labels = index.svg.querySelector<SVGGElement>('#' + id);
    if (!labels || labels.style.display === 'none') continue;
    for (const label of Array.from(labels.querySelectorAll<SVGGraphicsElement>('text'))) {
      set(label, 'transform', mapUprightAround(Number(label.getAttribute('x')), Number(label.getAttribute('y')), projection));
    }
  }
  const depth = index.svg.querySelector('#tile-depth');
  if (depth) {
    const det = projection.a * projection.d - projection.b * projection.c;
    set(depth, 'transform', 'translate(' + (-projection.c * 3 / det) + ' ' + (projection.a * 3 / det - 3) + ')');
  }
  void NS;
}
