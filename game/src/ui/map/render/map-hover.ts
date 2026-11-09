import type { MapDomIndex } from './map-dom';
import { MAP_CAMERA, projectMapPoint } from '../map-projection';
const setIf = (el: Element, name: string, value: string) => { if (el.getAttribute(name) !== value) el.setAttribute(name, value); };

type HoverBarrier = {
  layer: SVGGElement;
  faces: { group: SVGGElement; wall: SVGPathElement; flows: SVGPathElement[] }[];
  rims: SVGPathElement[];
  signature: string;
};
const hoverBarriers = new WeakMap<SVGSVGElement, HoverBarrier>();

export function paintHover(index: MapDomIndex, key: string | null) {
  const svg = index.svg, cell = key ? index.byDisplayKey.get(key) : null;
  let barrier = hoverBarriers.get(svg);
  if (!cell) {
    if (barrier) setIf(barrier.layer, 'data-active', 'false');
    return;
  }
  if (!barrier) {
    const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement;
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
    svg.append(layer);
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
  const projection = MAP_CAMERA;
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
