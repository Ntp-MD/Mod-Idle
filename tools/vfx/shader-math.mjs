/** Shared, deterministic raster primitives for offline shader adaptations. */
export const TAU = Math.PI * 2;
export const DURATION_SEC = 1.44;
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const fract = x => x - Math.floor(x);
export const hash = (x, y = 0) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
export function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y) {
  return noise(x, y) * .57 + noise(x * 2.07 + 9, y * 2.07) * .28 + noise(x * 4.13, y * 4.13 + 17) * .15;
}
export function over(dst, color, alpha) {
  alpha = clamp(alpha);
  const outA = alpha + dst[3] * (1 - alpha);
  if (!outA) return;
  const k = dst[3] * (1 - alpha);
  for (let c = 0; c < 3; c++) dst[c] = (color[c] * alpha + dst[c] * k) / outA;
  dst[3] = outA;
}
export function renderPixels(size, draw) {
  const rgba = new Uint8ClampedArray(size * size * 4);
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    const out = [0, 0, 0, 0];
    const result = draw((px + .5) / size * 2 - 1, (py + .5) / size * 2 - 1, out, px, py) ?? out;
    if (result.some(x => !Number.isFinite(x))) throw new Error(`Non-finite shader pixel at ${px},${py}`);
    const at = (py * size + px) * 4;
    for (let c = 0; c < 4; c++) rgba[at + c] = clamp(result[c]) * 255;
  }
  return rgba;
}
