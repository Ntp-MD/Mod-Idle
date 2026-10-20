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
export const mapUprightAt = (x: number, y: number) => `translate(${x} ${y}) matrix(${inverse.join(' ')} 0 0)`;
export const mapUprightAround = (x: number, y: number) => `${mapUprightAt(x, y)} translate(${-x} ${-y})`;
export function projectMapBounds(box: { vx: number; vy: number; vw: number; vh: number }) {
  const points = [[box.vx, box.vy], [box.vx + box.vw, box.vy],
    [box.vx, box.vy + box.vh], [box.vx + box.vw, box.vy + box.vh]]
    .map(([x, y]) => projectMapPoint(x, y));
  const xs = points.map(p => p.x), ys = points.map(p => p.y);
  const vx = Math.min(...xs), vy = Math.min(...ys);
  return { vx, vy, vw: Math.max(...xs) - vx, vh: Math.max(...ys) - vy };
}
