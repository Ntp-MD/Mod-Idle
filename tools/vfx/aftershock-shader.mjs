/** CPU/Canvas port of Binbun's CC0 ExplosionFXFree shader equations.
 * Sources: explosion_rings.gdshader, explosion_impact.gdshader, explosion_smoke.gdshader.
 * Godot mesh UVs/COLOR.a become polar UVs and explicit age. Value noise replaces
 * Godot FastNoiseLite textures; this is a ground-only adaptation, not a Godot scene render.
 */
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const fract = x => x - Math.floor(x);
const hash = (x, y) => fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453123);
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y) {
  return noise(x, y) * .57 + noise(x * 2.07 + 9, y * 2.07) * .28 + noise(x * 4.13, y * 4.13 + 17) * .15;
}
// Direct scalar translation of explosion_rings.gdshader's mask/noise/decay.
export function ringValue(uvY, n, decay) {
  const mask = 1 - Math.abs(uvY * 4 - 1);
  return Math.max(mask - (1 - n) - decay, 0);
}
// Direct scalar translation of explosion_impact.gdshader's seven-lobed streak mask.
export function impactValue(uvX, uvY, n, decay) {
  const wave = Math.sin(uvX * Math.PI * 2 * 7);
  const y = uvY * 4 - 1;
  const shape = (1 - Math.abs(y - ((1 - decay) - .25) + wave * .25 * decay) - .75) / .25;
  return Math.max(shape - (2 - n) * (.2 + decay * decay * .8), 0);
}
function over(dst, color, alpha) {
  alpha = clamp(alpha);
  const outA = alpha + dst[3] * (1 - alpha);
  if (!outA) return;
  const k = dst[3] * (1 - alpha);
  dst[0] = (color[0] * alpha + dst[0] * k) / outA;
  dst[1] = (color[1] * alpha + dst[1] * k) / outA;
  dst[2] = (color[2] * alpha + dst[2] * k) / outA;
  dst[3] = outA;
}
export const FOOTPRINT_RATIO = .8;
export const DURATION_SEC = 1.44;
export function renderAftershockFrame(size, timeSec) {
  const pixels = new Uint8ClampedArray(size * size * 4);
  const t = clamp(timeSec / DURATION_SEC);
  const tail = 1 - smooth(.66, 1, t);
  const ringRadius = FOOTPRINT_RATIO * smooth(0, .52, t);
  const puffs = Array.from({ length: 10 }, (_, i) => {
    const a = i * 2.39996323, travel = .1 + .39 * smooth(0, .62, t);
    return { x: Math.cos(a) * travel, y: Math.sin(a) * travel,
      radius: (.12 + hash(i, 7) * .08) * (.45 + smooth(0, .4, t)), seed: i * 3.1 };
  });
  const bits = Array.from({ length: 13 }, (_, i) => {
    const a = i * 2.39996323 + .2, travel = .1 + .67 * smooth(.03, .65, t);
    return { x: Math.cos(a) * travel, y: Math.sin(a) * travel, radius: .014 + hash(i, 9) * .021 };
  });
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    const x = (px + .5) / size * 2 - 1, y = (py + .5) / size * 2 - 1;
    const r = Math.hypot(x, y);
    if (r > .99 || t >= 1) continue;
    const out = [0, 0, 0, 0];
    const n = fbm(x * 8 + timeSec * .23, y * 8 - timeSec * .31);
    const theta = Math.atan2(y, x), u = theta / (Math.PI * 2) + .5;
    // Ground dust bed: a thin footprint, with no baked camera or opaque floor.
    const bed = (1 - smooth(.3, .7, r)) * smooth(0, .13, t) * tail * .3;
    over(out, [.22, .17, .105], bed * (.4 + n * .6));
    for (const p of puffs) {
      const dx = (x - p.x) / p.radius, dy = (y - p.y) / p.radius;
      const d = Math.hypot(dx, dy);
      if (d > 1.15) continue;
      const sn = fbm(dx * 2 + p.seed, dy * 2 + timeSec * .2);
      const edge = 1 - smooth(.56 + sn * .22, .81 + sn * .25, d);
      const decay = smooth(.39, 1, t);
      // explosion_smoke: noise_value and alpha_decay, with stepped N.L lighting.
      const nv = smooth(0, .5, Math.max(1 - sn - clamp(decay * 2), 0));
      const alpha = clamp(1 + sn - decay * 2) * edge * smooth(.015, .14, t) * .82;
      const nz = Math.sqrt(Math.max(0, 1 - d * d));
      const lighting = .34 + Math.floor(clamp(-dx * .35 - dy * .45 + nz * .72) * 3) / 3 * .66;
      over(out, [(.23 + nv * .51) * lighting, (.18 + nv * .31) * lighting, (.12 + nv * .1) * lighting], alpha);
    }
    const coreLife = 1 - smooth(.15, .57, t);
    const coreRadius = .09 + .23 * smooth(0, .25, t);
    const core = (1 - smooth(coreRadius * .35, coreRadius + n * .07, r)) * coreLife * smooth(0, .025, t);
    over(out, [1, .79 + n * .18, .35 + n * .32], core);
    const decay = smooth(.08, .68, t);
    const streak = impactValue(u, r / .94, n, decay) * smooth(0, .035, t) * tail;
    over(out, [1, .67, .18], streak * .9);
    for (let j = 0; j < 2; j++) {
      const radius = ringRadius * (j ? .76 : 1);
      if (radius < .02) continue;
      const uvY = .25 + (r - radius) / (.026 + j * .004) * .25;
      const rn = fbm(u * 35 + j * 13, timeSec * .9 + j);
      const value = ringValue(uvY, rn, smooth(.56, 1, t));
      // The source shader scissor is 0.2; use a narrow smooth transition to retain AA.
      const a = smooth(.16, .25, value) * tail * (j ? .5 : .88);
      over(out, [1, .57 + value * .31, .13 + value * .2], a);
    }
    for (const bit of bits) {
      const d = Math.hypot((x - bit.x) / bit.radius, (y - bit.y) / bit.radius);
      if (d >= 1) continue;
      const light = .35 + clamp(-(x - bit.x) / bit.radius - (y - bit.y) / bit.radius) * .5;
      over(out, [.48 * light, .35 * light, .20 * light], (1 - smooth(.65, 1, d)) * tail * smooth(.015, .08, t));
    }
    const index = (py * size + px) * 4;
    pixels[index] = clamp(out[0]) * 255; pixels[index + 1] = clamp(out[1]) * 255;
    pixels[index + 2] = clamp(out[2]) * 255; pixels[index + 3] = clamp(out[3]) * 255;
  }
  return pixels;
}
