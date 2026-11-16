/** Earth-only CPU adaptations of Binbun's CC0 ExplosionFX and BattleFX shaders.
 * UV/noise/decay/shard masks below retain the source equations. Analytic particle
 * surfaces replace Godot meshes, deterministic value noise replaces noise textures,
 * and stepped facet lighting replaces the source scene's lights. No ImageGen.
 */
import { clamp, smooth, hash, fbm, over, renderPixels, TAU, DURATION_SEC } from './shader-math.mjs';

const EXPLOSION = 'archive/art-reference/VFX-Godot/ExplosionFXFree/assets/BinbunVFX_Vol2/ExplosionFX/shader/';
const BATTLE = 'archive/art-reference/VFX-Godot/BattleFXFree/assets/BinbunVFX_Vol2/BattleFX/shader/';
export const licenseFiles = [EXPLOSION.replace('shader/', 'license.txt'), BATTLE.replace('shader/', 'license.txt')];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const SAND = [.69, .49, .25], DARK = [.15, .115, .075], STONE = [.49, .40, .28];

// explosion_smoke.fragment: noise_value, noise_decay and alpha_decay, with
// sin(UV.y*PI) displacement from vertex() moved to the particle silhouette.
function dust(out, x, y, p, time, decay, opacity = 1) {
  let dx = (x - p.x) / p.r, dy = (y - p.y) / p.r;
  const d = Math.hypot(dx, dy);
  if (d > 1.3) return;
  const n = fbm(dx * 2.1 + p.seed, dy * 2.1 + time * .2);
  const uvY = clamp((dy + 1) * .5);
  const displacedRadius = 1 + n * .2 * Math.sin(uvY * Math.PI);
  const edge = 1 - smooth(displacedRadius * (.4 + n * .35), displacedRadius * (.68 + n * .32), d);
  const value = smooth(0, .5, Math.max(1 - n - clamp(decay * 2), 0));
  const alpha = clamp(1 + n - Math.min(decay, 1) * 2) * (.38 + n * .62);
  const normalZ = Math.sqrt(Math.max(0, 1 - d * d));
  const light = .48 + Math.floor(clamp(-dx * .3 - dy * .4 + normalZ * .75) * 3) / 3 * .52;
  over(out, mix(DARK, SAND, .37 + value * .63).map(v => v * light), edge * alpha * opacity);
}

// explosion_rings.fragment, sampled on a world-space circular radial mesh.
function ring(r, radius, width, n, decay) {
  const uvY = .25 + (r - radius) / width * .25;
  return Math.max(1 - Math.abs(uvY * 4 - 1) - (1 - n) - decay, 0);
}

// BattleFX shards.fragment: twisted noise, sin(UV.y*PI), squared value,
// COLOR.a and effect_decay dissolution. Vertex taper becomes the 2D shard mesh.
function shard(out, x, y, p, decay, time, opacity = 1) {
  const v = (p.base - y) / p.height;
  if (v < 0 || v > 1) return;
  const uvy = 1 - v;
  const wave = Math.sin(uvy * TAU * 5) + Math.sin((x - p.x) * TAU * 5);
  // The Godot mesh has discrete vertices: interpolate its square-root taper
  // over three height bands rather than drawing a smooth cone silhouette.
  const band = Math.min(2, Math.floor(uvy * 3)), f = uvy * 3 - band;
  const taper = Math.sqrt(band / 3) * (1 - f) + Math.sqrt((band + 1) / 3) * f;
  const halfWidth = p.width * taper * (1 + wave * .05 * .5);
  const center = p.x + p.lean * v;
  const uvx = (x - center) / Math.max(halfWidth, .001) * .5 + .5;
  if (uvx < 0 || uvx > 1) return;
  const n = fbm((uvx + uvy) * 4 + p.seed, uvy * 5 + p.seed);
  const mask = Math.sin(uvy * Math.PI);
  const value = (1 - (1 - n) * smooth(.4, 1, mask)) ** 2;
  const alpha = clamp(n - decay * 2 + 1);
  const scissor = smooth(.47, .53, alpha);
  const ridge = .46 + .08 * Math.sin(uvy * 5 + p.seed);
  const facet = uvx < ridge ? .57 : 1;
  const edge = smooth(0, .035, uvx) * (1 - smooth(.965, 1, uvx));
  const color = mix(DARK, STONE, .4 + .6 * value).map(c => c * facet);
  // Thin warm fracture face, not an emissive flame core.
  if (Math.abs(uvx - ridge) < .025) over(out, [.73, .61, .39], edge * scissor * opacity);
  else over(out, color, edge * scissor * opacity);
}

function chips(out, x, y, t, vertical = false, spread = .7) {
  for (let i = 0; i < 15; i++) {
    const a = i * 2.39996323;
    const travel = spread * smooth(.01, .55, t);
    const px = Math.cos(a) * travel * (.4 + hash(i, 3) * .6);
    const py = vertical ? .43 - Math.sin(Math.PI * Math.min(t / .8, 1)) * (.2 + hash(i, 4) * .75) : Math.sin(a) * travel;
    const rr = .018 + hash(i, 8) * .025;
    const d = Math.abs((x - px) / rr) + Math.abs((y - py) / (rr * 1.2));
    if (d > 1) continue;
    // explosion_bits.fragment: mix(secondary_color,primary_color,COLOR.a).
    const colorAlpha = 1 - smooth(.2, .9, t);
    over(out, mix(DARK, SAND, colorAlpha), (1 - smooth(.65, 1, d)) * (1 - smooth(.57, 1, t)) * smooth(0, .08, t));
  }
}

function renderSand(size, timeSec) {
  const t = clamp(timeSec / DURATION_SEC), entry = smooth(0, .18, t), tail = 1 - smooth(.76, 1, t);
  // Stable loop: one full rotation over the eight loop frames, with no outward
  // expansion during the 10-second persistent field (skills.json dot_sec).
  const turn = (t - 4 / 15) / (8 / 15) * TAU;
  const puffs = Array.from({ length: 15 }, (_, i) => {
    const a = i * 2.39996323 + turn, r = (.2 + hash(i, 5) * .39) * entry;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r, r: .11 + hash(i, 7) * .12, seed: i * 3.17 };
  });
  return renderPixels(size, (x, y, out) => {
    const r = Math.hypot(x, y);
    if (r > .82) return;
    const edge = 1 - smooth(.71, .8, r), n = fbm(x * 11 + Math.cos(turn) * .4, y * 11 + Math.sin(turn) * .4);
    over(out, SAND, (1 - smooth(.4, .8, r)) * (.12 + n * .14) * entry * tail);
    for (const p of puffs) dust(out, x, y, p, timeSec, .08 + smooth(.75, 1, t), .72 * entry * tail * edge);
    // Sand flow is a broken spiral cloud, not a luminous perimeter ring.
    const angle = Math.atan2(y, x), curl = Math.sin(angle * 4 - r * 16 - turn);
    const flow = smooth(.72, .97, curl) * smooth(.15, .3, r) * edge * n;
    over(out, [.8, .65, .41], flow * .4 * entry * tail);
    for (let i = 0; i < 22; i++) {
      const a = i * 2.39996323 + turn, rr = .22 + hash(i, 12) * .48;
      const d = Math.hypot(x - Math.cos(a) * rr, y - Math.sin(a) * rr) / (.008 + hash(i, 2) * .008);
      over(out, [.87, .73, .47], (1 - smooth(.4, 1, d)) * .8 * entry * tail);
    }
  });
}

function renderShock(size, timeSec) {
  const t = clamp(timeSec / DURATION_SEC), entry = smooth(0, .055, t), tail = 1 - smooth(.68, 1, t);
  const radius = .75 * smooth(0, .4, t);
  const puffs = Array.from({ length: 14 }, (_, i) => {
    const a = i * TAU / 14, rr = .12 + .49 * smooth(0, .4, t);
    return { x: Math.cos(a) * rr, y: Math.sin(a) * rr, r: .08 + hash(i, 4) * .065, seed: i * 2.31 };
  });
  return renderPixels(size, (x, y, out) => {
    const r = Math.hypot(x, y);
    if (r > .8) return;
    const u = Math.atan2(y, x) / TAU + .5, n = fbm(x * 9, y * 9 + timeSec * .22);
    over(out, DARK, (1 - smooth(.45, .69, r)) * .3 * entry * tail);
    // Displaced dust ring plus dark branching cracks, all top-down.
    const rim = ring(r, radius, .085, fbm(u * 37, t * .7), smooth(.54, 1, t));
    over(out, [.72, .57, .34], smooth(.1, .27, rim) * entry * tail * .8);
    const a = Math.atan2(y, x), branches = Math.abs(Math.sin(a * 6 + Math.sin(r * 21) * .23));
    const crack = (1 - smooth(.02, .065, branches)) * smooth(.07, .16, r) * (1 - smooth(radius * .8, radius, r));
    over(out, [.085, .061, .033], crack * entry * tail);
    over(out, [.56, .41, .22], crack * smooth(.05, .1, branches) * entry * tail);
    for (const p of puffs) dust(out, x, y, p, timeSec, smooth(.44, 1, t), .86 * entry);
    chips(out, x, y, t, false, .73);
    over(out, [.78, .65, .42], (1 - smooth(.05, .15, r)) * n * (1 - smooth(.11, .27, t)) * entry * .75);
    out[3] *= 1 - smooth(.78, .8, r);
  });
}

function renderStone(size, timeSec, splitter = false) {
  const t = clamp(timeSec / DURATION_SEC), entry = smooth(0, .055, t), tail = 1 - smooth(.8, 1, t);
  const growth = smooth(.02, .28, t) * (1 - smooth(.64, .94, t) * .4);
  const slabs = splitter ? [
    { x: -.25 - .1 * smooth(.1, .4, t), width: .21, height: .91 * growth, lean: -.13, base: .52, seed: 7 },
    { x: .22 + .1 * smooth(.1, .4, t), width: .23, height: 1.14 * growth, lean: .16, base: .52, seed: 2 },
  ] : [
    { x: -.32, width: .19, height: .81 * growth, lean: -.12, base: .56, seed: 13 },
    { x: .3, width: .2, height: .99 * growth, lean: .12, base: .56, seed: 23 },
    { x: 0, width: .27, height: 1.39 * growth, lean: -.04, base: .58, seed: 4 },
  ];
  const puffs = Array.from({ length: 9 }, (_, i) => {
    const a = i * 2.39996323, travel = .16 + .3 * smooth(.03, .58, t);
    return { x: Math.cos(a) * travel, y: .46 + Math.sin(a) * .13, r: .12 + hash(i, 8) * .055, seed: i * 5.3 };
  });
  return renderPixels(size, (x, y, out) => {
    if (Math.abs(x) > .88 || y < -.91 || y > .81) return;
    const crackY = y - .51 - Math.sin(x * 21) * .025;
    const crack = (1 - smooth(.01, .027, Math.abs(crackY))) * (1 - smooth(.55, .77, Math.abs(x)));
    over(out, [.09, .063, .032], crack * entry * tail);
    if (splitter) {
      const opening = .07 + .05 * smooth(.08, .3, t);
      over(out, [.43, .29, .12], (1 - smooth(opening * .5, opening, Math.abs(x))) * (1 - smooth(.1, .47, Math.abs(y - .35))) * entry * tail * .7);
    }
    for (const p of slabs) shard(out, x, y, p, smooth(.61, 1, t), timeSec, entry * tail);
    for (const p of puffs) dust(out, x, y, p, timeSec, smooth(.51, 1, t), .8 * entry * tail);
    chips(out, x, y, t, true, splitter ? .69 : .63);
  });
}

function renderFissure(size, timeSec) {
  const t = clamp(timeSec / DURATION_SEC), front = -.78 + 1.56 * smooth(0, .43, t);
  const tail = 1 - smooth(.72, 1, t);
  const chunks = Array.from({ length: 10 }, (_, i) => {
    const x = -.66 + i * .145, arrival = .025 + i * .026;
    const growth = smooth(arrival, arrival + .13, t);
    return { x, width: .055 + hash(i, 9) * .022, height: (.12 + hash(i, 7) * .18) * growth,
      base: .07, lean: (hash(i, 3) - .5) * .1, seed: i * 2.3, arrival };
  });
  return renderPixels(size, (x, y, out) => {
    if (x < -.85 || x > .85 || Math.abs(y) > .58) return;
    const local = smooth(x, x + .11, front) * smooth(0, .06, t), edge = smooth(-.81, -.68, x) * (1 - smooth(.71, .81, x));
    const jagged = Math.sin(x * 32) * .025 + Math.sin(x * 71) * .012;
    const d = Math.abs(y - jagged), width = .022 + fbm(x * 17, 2) * .028;
    over(out, [.45, .34, .17], (1 - smooth(width * 1.3, width * 2.9, d)) * local * tail * edge * .77);
    over(out, [.065, .047, .025], (1 - smooth(width * .6, width, d)) * local * tail * edge);
    // Broken amber mineral seam, not a beam: dark centre and angular stone banks.
    over(out, [.75, .56, .25], (1 - smooth(.003, .009, Math.abs(d - width))) * local * tail * edge * .85);
    for (const p of chunks) {
      if (t < p.arrival || p.height < .001) continue;
      shard(out, x, y, p, smooth(.61, 1, t), timeSec, tail * local);
      dust(out, x, y, { x: p.x, y: .065, r: .085 + .03 * smooth(.08, .5, t), seed: p.seed }, timeSec, smooth(.53, 1, t), .56 * local * tail);
    }
    const leading = Math.hypot((x - front) / .1, (y + .02) / .14);
    over(out, [.64, .49, .28], (1 - smooth(.3, 1, leading)) * (1 - smooth(.35, .56, t)) * smooth(0, .04, t) * .45);
  });
}

const base = { opening: [0, 3], loop: [0, 11], exit: [12, 15], frameMs: 90, anchorX: .5, anchorY: .5, orient: false };
const ground = { ...base, projection: 'ground', contentWidthRatio: .8, contentHeightRatio: .8 };
const rockSources = [BATTLE + 'shards.gdshader', EXPLOSION + 'explosion_smoke.gdshader', EXPLOSION + 'explosion_bits.gdshader'];
export const recipes = [
  { id: 'attack.sand_storm', kind: 'ground', sources: [EXPLOSION + 'explosion_smoke.gdshader'], render: renderSand,
    meta: { ...ground, delivery: 'ground', origin: 'target', loop: [4, 11], fieldDurationSec: 10 } },
  { id: 'attack.earth_splitter', kind: 'strike', sources: rockSources, render: (size, time) => renderStone(size, time, true),
    meta: { ...base, delivery: 'ground', origin: 'target', anchorY: .76, impactAnchorX: .5, impactAnchorY: .76 } },
  { id: 'attack.earth_shock', kind: 'ground', sources: [EXPLOSION + 'explosion_rings.gdshader', EXPLOSION + 'explosion_smoke.gdshader', EXPLOSION + 'explosion_bits.gdshader'], render: renderShock,
    meta: { ...ground, delivery: 'ground', origin: 'target' } },
  { id: 'attack.stone_spike', kind: 'strike', sources: rockSources, render: (size, time) => renderStone(size, time),
    meta: { ...base, delivery: 'ground', origin: 'target', anchorY: .79, impactAnchorX: .5, impactAnchorY: .79 } },
  { id: 'attack.fissure', kind: 'line', sources: [BATTLE + 'shards.gdshader', EXPLOSION + 'explosion_smoke.gdshader'], render: renderFissure,
    meta: { ...base, delivery: 'ground', origin: 'caster', orient: true, anchorX: .1, anchorY: .53, contentWidthRatio: .8, contentHeightRatio: .25 } },
];
