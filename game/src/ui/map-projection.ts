/** World plane projection. Artwork stays upright while its foot follows this plane. */
const yaw = -16 * Math.PI / 180;
const elevation = 38 * Math.PI / 180;
export const MAP_CAMERA = {
  a: Math.cos(yaw), b: Math.sin(yaw) * Math.sin(elevation),
  c: -Math.sin(yaw), d: Math.cos(yaw) * Math.sin(elevation),
};
const { a, b, c, d } = MAP_CAMERA;
const determinant = a * d - b * c;
const inverse = [d / determinant, -b / determinant, -c / determinant, a / determinant];
export const MAP_CAMERA_TRANSFORM = `matrix(${a} ${b} ${c} ${d} 0 0)`;
export const projectMapPoint = (x: number, y: number) => ({ x: a * x + c * y, y: b * x + d * y });
/** Screen-space ground footprint, before adding any upright vegetation or buildings. */
export function projectedHex(radius: number) {
  const points = Array.from({ length: 6 }, (_, k) => {
    const angle = (60 * k - 30) * Math.PI / 180;
    return projectMapPoint(radius * Math.cos(angle), radius * Math.sin(angle));
  });
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { points, x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}
export const mapUprightAt = (x: number, y: number) => `translate(${x} ${y}) matrix(${inverse.join(' ')} 0 0)`;
export const mapUprightAround = (x: number, y: number) => `${mapUprightAt(x, y)} translate(${-x} ${-y})`;
/**
 * How far a measured artwork footprint sits from the projected hex it is drawn to, as a
 * fraction of the artwork canvas. Both are compared in their own normalised frame, so the
 * measure survives a different raster resolution but not a different rotational order:
 * the hex is asymmetric on the board, so a corner measured against the wrong edge shows.
 */
export function footprintShapeError(measured: { x: number; y: number }[], radius: number) {
  const hex = projectedHex(radius);
  const template = hex.points.map(p => ({ x: (p.x - hex.x) / hex.width, y: (p.y - hex.y) / hex.height }));
  let worst = 0;
  for (let i = 0; i < template.length; i++) {
    const p = measured[i];
    if (!p) return Infinity;
    worst = Math.max(worst, Math.hypot(p.x - template[i].x, p.y - template[i].y));
  }
  return worst;
}
export function projectMapBounds(box: { vx: number; vy: number; vw: number; vh: number }) {
  const points = [[box.vx, box.vy], [box.vx + box.vw, box.vy],
    [box.vx, box.vy + box.vh], [box.vx + box.vw, box.vy + box.vh]]
    .map(([x, y]) => projectMapPoint(x, y));
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const vx = Math.min(...xs), vy = Math.min(...ys);
  return { vx, vy, vw: Math.max(...xs) - vx, vh: Math.max(...ys) - vy };
}
