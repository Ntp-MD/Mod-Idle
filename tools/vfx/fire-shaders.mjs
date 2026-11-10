/** Binbun CC0 Godot shader ports for the six live fire attacks.
 * CPU value noise replaces noise_texture; analytic particle UVs replace Godot meshes.
 * Emission is tone-mapped into PNG RGB. Depth fade, lighting and 3D displacement are
 * omitted; these are transparent 2D prototypes, not captures from a Godot runtime.
 */
import { clamp, smooth, fract, hash, fbm, over, renderPixels, TAU, DURATION_SEC } from './shader-math.mjs';

const FLAME = 'archive/art-reference/VFX-Godot/FlameFXFree/assets/BinbunVFX_Vol2/FlameFX/shader/';
const ELEMENT = 'archive/art-reference/VFX-Godot/ElementalMagicFXFree/assets/BinbunVFX_Vol2/ElementalMagicFX/shader/';
const EXPLOSION = 'archive/art-reference/VFX-Godot/ExplosionFXFree/assets/BinbunVFX_Vol2/ExplosionFX/shader/';
const overlay = (base, blend) => base < .5 ? 2 * base * blend : 1 - 2 * (1 - base) * (1 - blend);
const amber = value => [1, .19 + clamp(value) * .64, .018 + clamp(value) * .24];

// fire_core.fragment: radial UV mask, subtractive noise, effect_amount, edge hardness.
function fireCore(x, y, n, amount = 1) {
  const mask = Math.max(1 - Math.hypot(x, y), 0);
  const value = clamp((mask * 4 - (1 - n)) / 4 - (1 - amount));
  return smooth(.13, .28, value);
}

// fire_particle.fragment: COLOR.a contracts the UV mask; flame_density adds the core.
function fireParticle(x, y, n, age, density = .5) {
  const colorAlpha = 1 - age;
  const mask = Math.max(1 - Math.hypot(x, y) - (1 - colorAlpha), 0);
  const value = n * mask + Math.pow(mask, (1 - density) * 8) * Math.pow(colorAlpha, 8);
  return smooth(.065, .2, clamp(value));
}

// explosion_rings / explosion_impact: original mask, noise subtraction and decay.
function ring(r, radius, width, n, decay) {
  const uvY = .25 + (r - radius) / width * .25;
  return smooth(.16, .24, Math.max(1 - Math.abs(uvY * 4 - 1) - (1 - n) - decay, 0));
}
function streak(u, radiusUV, n, decay, lobes = 7) {
  const y = radiusUV * 4 - 1;
  const shape = (1 - Math.abs(y - ((1 - decay) - .25) + Math.sin(u * TAU * lobes) * .25 * decay) - .75) / .25;
  return smooth(.16, .25, Math.max(shape - (2 - n) * (.2 + decay * decay * .8), 0));
}

// explosion_core.fragment, with the source vertex noise expressed as a rough UV edge.
function explosion(out, x, y, age, scale = .75, lobes = 7) {
  if (age < 0 || age >= 1) return;
  const n = fbm(x * 9 + age * .4, y * 9 - age * 1.1);
  const radius = scale * (.17 + .83 * smooth(0, .55, age));
  const r = Math.hypot(x, y), u = Math.atan2(y, x) / TAU + .5;
  const edge = 1 - smooth(radius * (.60 + n * .22), radius, r);
  // explosion_smoke.fragment: independently decaying particles retain the late tail.
  const smokeDecay = age * .82;
  const smokeValue = smooth(0, .5, Math.max(1 - n - clamp(smokeDecay * 2), 0));
  const smokeAlpha = clamp(1 + n - smokeDecay * 2) * edge * smooth(.14, .36, age) * (1 - smooth(.84, 1, age));
  over(out, [.23 + smokeValue * .35, .095 + smokeValue * .18, .04], smokeAlpha * .7);
  const coreDecay = smooth(.03, .62, age);
  const alpha = clamp(n + 1 - coreDecay * 2) * edge;
  over(out, amber(.32 + (1 - coreDecay) * .6), alpha);
  over(out, [1, .93, .62], fireCore(x / (radius * .55), y / (radius * .55), n, 1 - coreDecay));
  const impact = streak(u, r / Math.max(radius, .01), n, smooth(.02, .77, age), lobes);
  over(out, [1, .67, .14], impact * (1 - smooth(.68, 1, age)));
  const rim = ring(r, scale * smooth(0, .65, age), .028 + .025 * (1 - age), fbm(u * 23, age * .9), smooth(.35, 1, age));
  over(out, [1, .45, .035], rim * (1 - smooth(.66, 1, age)));
}

// An upright flame particle uses the source world-pos wobble and scrolling noise.
function tongue(out, x, y, cx, bottom, width, height, clock, amount, seed = 0) {
  const h = (bottom - y) / height;
  if (h < 0 || h > 1 || amount <= 0) return;
  const wobble = Math.sin(h * 12 - clock * 4 + seed) * .1;
  const dx = (x - cx) / width + wobble * h * 2;
  const dy = (h - .38) / .66;
  const noiseOffset = fbm(dx * .5 + seed, h * .5) * .1;
  const n = fbm(dx * 2.4 + seed + wobble, h * 3 + noiseOffset - clock * 2.4);
  const taperedX = dx / Math.max(.12, 1 - h * .85);
  const value = fireParticle(taperedX, dy, n, (1 - amount) * .55, .67);
  over(out, amber((1 - h) * .78 + n * .18), value * amount);
  const inner = fireCore(taperedX * 1.7, dy * 1.7 + .32, n, amount);
  over(out, [1, .88, .38], inner * .72);
}

function renderFireball(size, timeSec, frameIndex) {
  // Wrap the advected noise and wave phase across the eight travel frames.
  const phase = frameIndex >= 4 && frameIndex <= 11 ? (frameIndex - 4) / 8 : timeSec / DURATION_SEC;
  if (frameIndex >= 12) return renderPixels(size, (x, y, out) => explosion(out, x, y, (frameIndex - 12 + .2) / 4, .81));
  const grow = frameIndex < 4 ? .35 + frameIndex * .2 : 1;
  return renderPixels(size, (x, y, out) => {
    const dx = (x - .3) / .36, dy = y / .36;
    const r = Math.hypot(dx, dy);
    const n = fbm(dx * 2 + Math.cos(phase * TAU) * .7, dy * 3 + Math.sin(phase * TAU) * .7);
    // projectile_core.wave: tiled triangular wave plus UV twist and noise offset.
    const uvX = Math.atan2(dy, dx) / TAU + .5, uvY = clamp((.34 - x) / 1.18);
    const xWave = Math.sin(uvX * TAU * 3 + uvY * TAU * 2) * .2;
    const tiledY = fract(uvY * 4 - phase + n * .6 + xWave);
    const wave = Math.min(tiledY / .6, (1 - tiledY) / .4);
    const fadeTail = smooth(1 - grow, .5 + (1 - grow) * .5, Math.max(1 - uvY + wave * .1 - .4, 0));
    // projectile_tail.fragment: noise minus the longitudinal tail gradient.
    const tailWidth = .045 + clamp((x + .88) / 1.15) * .22;
    const tailEdge = 1 - smooth(tailWidth * .35, tailWidth, Math.abs(y + Math.sin(x * 13 + phase * TAU) * .035));
    const tn = fbm(x * 6 + Math.cos(phase * TAU), y * 8 + Math.sin(phase * TAU));
    const tail = smooth(0, .5, Math.max(tn - (1 - clamp((x + .9) / 1.15)) * 1.3, 0));
    if (x < .32 && x > -.91) over(out, amber(.28 + fadeTail * .35), tailEdge * Math.max(tail, fadeTail * .55) * grow);
    const core = fireCore(dx, dy, n, grow);
    over(out, amber(.55 + n * .4), core);
    over(out, [1, .96, .64], fireCore(dx * 1.55 + .15, dy * 1.55, n, grow) * .9);
    if (r > 1) return;
  });
}

function renderFirestorm(size, timeSec) {
  const t = clamp(timeSec / DURATION_SEC), grow = .2 + .8 * smooth(0, .26, t), fade = 1 - smooth(.69, 1, t);
  return renderPixels(size, (x, y, out) => {
    const r = Math.hypot(x, y) / .8;
    if (r > 1) return;
    const a = Math.atan2(y, x), u = a / TAU + .5;
    // area_ground: polar noise, gradient^8 and overlay blend. The source gradient
    // texture is replaced with an analytic radial gradient; no camera is baked.
    const n = fbm(r * 4 - timeSec * .9, u * 10 + r * 2);
    const gradient = Math.pow(clamp(1 - r / grow), 8);
    const ground = (overlay(gradient, n) + gradient) * .5;
    over(out, [1, .21, .014], smooth(.01, .65, ground) * fade * .7);
    // area_glow's wave_x + overlay threshold creates separate rotating flame arms.
    const waveX = Math.sin((u + timeSec * .1) * Math.PI * 12 + r * 13) * .5 + .5;
    const mask = clamp((1 - r) * 1.9 - waveX * .45);
    const noiseWave = Math.sin(mask * 8 + timeSec * 20) * .5 + .5;
    const flame = smooth(.2, 1, overlay(mask, Math.max(n - noiseWave * waveX * .5, 0)));
    over(out, amber(.25 + flame * .55), flame * fade * smooth(0, .09, t) * smooth(grow, grow - .12, r));
    const spiral = Math.pow(Math.max(0, Math.sin(a * 5 + r * 15 - timeSec * 7)), 8);
    over(out, [1, .7, .14], spiral * flame * .8 * fade);
    over(out, [1, .4, .025], ring(r, grow * .97, .07, n, smooth(.25, .95, t)) * fade);
  });
}

function renderMeteor(size, timeSec, frameIndex) {
  const t = timeSec / DURATION_SEC;
  if (frameIndex >= 12) return renderPixels(size, (x, y, out) => explosion(out, x, y, (frameIndex - 12 + .1) / 4, .83, 11));
  return renderPixels(size, (x, y, out) => {
    // Each rain drop gets a vertical burning stone; translation is the renderer's job.
    const cx = .08, cy = .29;
    const phase = frameIndex >= 4 ? (frameIndex - 4) / 8 : t;
    const clock = phase * TAU;
    const n = fbm(x * 11 + Math.cos(clock) * .5, y * 10 + Math.sin(clock) * .5);
    for (let i = 0; i < 5; i++) tongue(out, x, y, cx + (i - 2) * .09, .34, .18, 1.03 - Math.abs(i - 2) * .08, phase * 1.5, .9, i * 3);
    const r = Math.hypot((x - cx) / .3, (y - cy) / .29);
    const edge = 1 - smooth(.77 + n * .17, 1, r);
    over(out, [.26 + n * .18, .035 + n * .06, .012], edge);
    const fissure = Math.pow(clamp(1 - Math.abs(Math.sin(x * 25 + y * 11 + fbm(x * 12, y * 12) * 7)) * 4), 2);
    over(out, [1, .38 + n * .32, .04], fissure * edge * .9);
    over(out, [1, .56, .055], ring(r, .94, .18, n, .03) * .85);
  });
}

function renderDetonate(size, timeSec) {
  const t = timeSec / DURATION_SEC;
  return renderPixels(size, (x, y, out) => {
    if (t < .23) {
      const r = Math.hypot(x, y), n = fbm(x * 9, y * 9 - t * 4);
      const radius = .68 * (1 - t / .27);
      over(out, [1, .24, .025], ring(r, radius, .025, n, 0));
      for (let i = 0; i < 5; i++) {
        const a = i * TAU / 5 + t * 2;
        const d = Math.hypot(x - Math.cos(a) * radius, y - Math.sin(a) * radius) / .095;
        over(out, [1, .6, .08], fireCore(d, 0, n));
      }
    } else explosion(out, x, y + .13, (t - .23) / .77, .8, 5);
  });
}

function renderIgnite(size, timeSec) {
  const t = timeSec / DURATION_SEC, amount = (.58 + .42 * smooth(0, .12, t)) * (1 - smooth(.62, 1, t));
  return renderPixels(size, (x, y, out) => {
    // Five independent source flame particles, rather than a field or explosion.
    for (let i = 0; i < 5; i++) {
      const cx = (i - 2) * .14, height = 1.25 - Math.abs(i - 2) * .22;
      tongue(out, x, y, cx, .54, .23, height, timeSec * 1.8, amount, i * 5.31);
    }
    for (let i = 0; i < 8; i++) {
      const age = fract(t * 1.2 + hash(i, 7));
      const ex = (hash(i, 2) - .5) * .8 + Math.sin(age * 7 + i) * .045;
      const ey = .45 - age * 1.2;
      const spark = fireParticle((x - ex) / .028, (y - ey) / .055, .9, age * .5, .8);
      over(out, [1, .7, .14], spark * amount);
    }
  });
}

function renderNova(size, timeSec) {
  const t = timeSec / DURATION_SEC;
  return renderPixels(size, (x, y, out) => {
    const r = Math.hypot(x, y), u = Math.atan2(y, x) / TAU + .5;
    const radius = .8 * smooth(0, .62, t), decay = smooth(.32, 1, t);
    const n = fbm(u * 31, t * 1.6 + r * 4);
    for (let i = 0; i < 2; i++) {
      const rim = ring(r, radius * (i ? .78 : 1), i ? .04 : .075, n, decay);
      over(out, amber(i ? .3 : .66), rim * (1 - smooth(.8, 1, t)));
    }
    const flare = fireParticle((r - radius) / .095, Math.sin(u * TAU * 18 + t * 7) * .45, n, decay * .78, .6);
    over(out, [1, .28 + n * .35, .025], flare * (1 - smooth(.5, 1, t)));
    const spokes = streak(u, r / Math.max(radius, .01), n, smooth(0, .72, t), 13);
    over(out, [1, .62, .09], spokes * (1 - smooth(.5, .91, t)));
    // Embers travel radially, never vertically: this atlas is a top-down ground nova.
    for (let i = 0; i < 18; i++) {
      const a = i * 2.39996323, rr = radius * (.5 + hash(i, 4) * .47);
      const d = Math.hypot(x - Math.cos(a) * rr, y - Math.sin(a) * rr) / (.012 + hash(i, 8) * .014);
      over(out, [1, .39 + hash(i, 1) * .4, .035], fireParticle(d, 0, .9, decay * .7, .7) * (1 - smooth(.8, 1, t)));
    }
  });
}

const base = { opening: [0, 3], loop: [0, 11], exit: [12, 15], frameMs: 90, anchorX: .5, anchorY: .5, orient: false };
const ground = { ...base, projection: 'ground', contentWidthRatio: .8, contentHeightRatio: .8 };
export const recipes = [
  { id: 'attack.fireball', kind: 'projectile', sources: [FLAME + 'fire_core.gdshader', ELEMENT + 'projectile_core.gdshader', ELEMENT + 'projectile_tail.gdshader', EXPLOSION + 'explosion_core.gdshader', EXPLOSION + 'explosion_impact.gdshader', EXPLOSION + 'explosion_rings.gdshader', EXPLOSION + 'explosion_smoke.gdshader'], render: renderFireball, meta: { ...base, delivery: 'projectile', origin: 'target', loop: [4, 11], orient: true, impactAnchorX: .5, impactAnchorY: .5 } },
  { id: 'attack.firestorm', kind: 'ground', sources: [ELEMENT + 'area_ground.gdshader', ELEMENT + 'area_glow.gdshader', EXPLOSION + 'explosion_rings.gdshader'], render: renderFirestorm, meta: { ...ground, delivery: 'ground', origin: 'target' } },
  { id: 'attack.meteor', kind: 'rain', sources: [FLAME + 'fire_core.gdshader', FLAME + 'fire_particle.gdshader', EXPLOSION + 'explosion_core.gdshader', EXPLOSION + 'explosion_impact.gdshader', EXPLOSION + 'explosion_rings.gdshader', EXPLOSION + 'explosion_smoke.gdshader'], render: renderMeteor, meta: { ...base, delivery: 'ground', origin: 'target', loop: [4, 11], rainDurationSec: 4, rainPhase: 'Impact', impactAnchorX: .5, impactAnchorY: .5 } },
  { id: 'attack.detonate', kind: 'strike', sources: [FLAME + 'fire_core.gdshader', EXPLOSION + 'explosion_core.gdshader', EXPLOSION + 'explosion_impact.gdshader', EXPLOSION + 'explosion_rings.gdshader', EXPLOSION + 'explosion_smoke.gdshader'], render: renderDetonate, meta: { ...base, delivery: 'ground', origin: 'target' } },
  { id: 'attack.ignite', kind: 'strike', sources: [FLAME + 'fire_core.gdshader', FLAME + 'fire_particle.gdshader'], render: renderIgnite, meta: { ...base, delivery: 'instant', origin: 'target', anchorY: .77 } },
  { id: 'attack.cinder_nova', kind: 'ground', sources: [FLAME + 'fire_particle.gdshader', EXPLOSION + 'explosion_rings.gdshader', EXPLOSION + 'explosion_impact.gdshader'], render: renderNova, meta: { ...ground, delivery: 'instant', origin: 'caster' } },
];
