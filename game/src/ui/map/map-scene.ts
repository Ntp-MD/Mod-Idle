import { createMapProjection, MAP_CAMERA, mapProjectionTransform, mapUprightAt, mapUprightAround, projectMapPoint, type MapProjection } from './map-projection';

type SceneCell = {
  ax: string; x: number; y: number; radius: number; holder: SVGGElement;
  actor: SVGGElement; figure: SVGGElement | undefined; planar: boolean;
};
type SceneIndex = { svg: SVGSVGElement; board: SVGGElement; actors: SVGGElement; cells: SceneCell[]; projection: MapProjection };
const scenes = new WeakMap<SVGSVGElement, SceneIndex>();
const NS = 'http://www.w3.org/2000/svg';
const set = (node: Element, name: string, value: string) => { if (node.getAttribute(name) !== value) node.setAttribute(name, value); };

function sceneIndex(root: HTMLElement): SceneIndex | null {
  const svg = root.querySelector('svg');
  if (!svg) return null;
  const cached = scenes.get(svg);
  if (cached) return cached;
  const board = svg.querySelector<SVGGElement>('#projected-board');
  const actors = svg.querySelector<SVGGElement>('#actors');
  if (!board || !actors) return null;
  const byAx = (selector: string, attr: string) => new Map(Array.from(svg.querySelectorAll<SVGGElement>(selector))
    .map(node => [node.getAttribute(attr)!, node]));
  const figures = byAx('[data-figure-ax]', 'data-figure-ax');
  const actorByAx = byAx('[data-actor-ax]', 'data-actor-ax');
  const cells: SceneCell[] = [];
  for (const cell of Array.from(svg.querySelectorAll<SVGPolygonElement>('polygon.cell'))) {
    const ax = cell.getAttribute('data-ax');
    const actor = ax ? actorByAx.get(ax) : null;
    if (!ax || !actor) continue;
    const box = cell.getBBox(), x = box.x + box.width / 2, y = box.y + box.height / 2, radius = box.height / 2;
    const figure = figures.get(ax), planar = !!figure?.querySelector('.terrain-registration, .diorama-art > use[href^="#terrain-"]');
    const holder = actor.parentElement?.classList.contains('map-scene-cell')
      ? actor.parentNode as SVGGElement : document.createElementNS(NS, 'g');
    holder.setAttribute('class', 'map-scene-cell');
    holder.setAttribute('data-scene-ax', ax);
    if (figure && figure.parentNode !== holder) holder.prepend(figure);
    if (actor.parentNode !== holder) holder.append(actor);
    if (holder.parentNode !== actors) actors.append(holder);
    cells.push({ ax, x, y, radius, holder, actor, figure, planar });
  }
  const index = { svg, board, actors, cells, projection: MAP_CAMERA };
  scenes.set(svg, index);
  return index;
}

export function mapSceneProjection(root: HTMLElement): MapProjection {
  const svg = root.querySelector('svg');
  return (svg && scenes.get(svg)?.projection) || MAP_CAMERA;
}

/** Orbit an orthographic ground plane; upright artwork is depth sorted and faces the screen. */
export function paintMapScene(root: HTMLElement, camera?: { bearing: number }) {
  const scene = sceneIndex(root);
  if (!scene) return;
  const projection = camera ? createMapProjection(camera.bearing) : scene.projection;
  scene.projection = projection;
  set(scene.board, 'transform', mapProjectionTransform(projection));
  const matrix = scene.svg.getScreenCTM(), frame = root.getBoundingClientRect();
  const scale = matrix ? Math.hypot(matrix.a, matrix.b) : 1;
  const ordered = scene.cells.map(cell => ({ cell, point: projectMapPoint(cell.x, cell.y, projection) }))
    .sort((a, b) => a.point.y - b.point.y || a.point.x - b.point.x);
  const nextCell = (node: Element | null) => {
    while (node && !node.classList.contains('map-scene-cell')) node = node.nextElementSibling;
    return node;
  };
  let cursor = nextCell(scene.actors.firstElementChild);
  for (const { cell, point } of ordered) {
    if (cell.holder !== cursor) scene.actors.insertBefore(cell.holder, cursor);
    cursor = nextCell(cell.holder.nextElementSibling);
    const screen = matrix ? new DOMPoint(point.x, point.y).matrixTransform(matrix) : null;
    const margin = cell.radius * scale * 4;
    const visible = !screen || screen.x >= frame.left - margin && screen.x <= frame.right + margin
      && screen.y >= frame.top - margin && screen.y <= frame.bottom + margin;
    set(cell.holder, 'display', visible ? '' : 'none');
    if (!visible) continue;
    set(cell.actor, 'transform', mapUprightAt(cell.x, cell.y, projection));
    if (cell.figure && !cell.planar) {
      set(cell.figure, 'transform', mapUprightAt(cell.x, cell.y, projection));
      const calibration = cell.figure.querySelector('.hex-calibration');
      if (calibration) set(calibration, 'transform', mapProjectionTransform(projection) + ' ' + mapUprightAt(0, 0));
    }
  }
  const you = scene.actors.querySelector<SVGGElement>('g.you');
  const feet = you && ordered.find(({ cell }) => cell.ax === you.getAttribute('data-position'));
  if (you && feet) {
    set(you, 'transform', mapUprightAt(feet.cell.x, feet.cell.y, projection));
    const ahead = ordered.find(({ point }) => point.y > feet.point.y)?.cell.holder || null;
    if (you.nextElementSibling !== ahead) scene.actors.insertBefore(you, ahead);
  }
  for (const piece of Array.from(scene.svg.querySelectorAll('[data-map-ground]'))) set(piece, 'transform', mapProjectionTransform(projection));
  for (const id of ['ids', 'walk']) {
    const labels = scene.svg.querySelector<SVGGElement>('#' + id);
    if (!labels || labels.style.display === 'none') continue;
    for (const label of Array.from(labels.querySelectorAll<SVGGraphicsElement>('text'))) {
      set(label, 'transform', mapUprightAround(Number(label.getAttribute('x')), Number(label.getAttribute('y')), projection));
    }
  }
  const depth = scene.svg.querySelector('#tile-depth');
  if (depth) {
    const det = projection.a * projection.d - projection.b * projection.c;
    set(depth, 'transform', 'translate(' + (-projection.c * 3 / det) + ' ' + (projection.a * 3 / det - 3) + ')');
  }
}
