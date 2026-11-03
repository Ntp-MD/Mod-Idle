/** Cold/water CPU adaptations of local Godot shader equations; no Godot scene render.
 * ElementalMagicFX is CC0 (Binbun3D). Glacier shaders are MIT, Copyright (c) 2026;
 * retain art-reference/VFX-Godot/energy_beams_fx/LICENSE.md with redistributed assets.
 * Mesh normals become analytic sphere/crystal facets; seeded value noise replaces
 * sampled textures. The added silhouettes and phase envelopes are authored here.
 */
import { clamp, smooth, fract, hash, fbm, over, renderPixels, TAU } from './shader-math.mjs';

const elemental = 'art-reference/VFX-Godot/ElementalMagicFXFree/assets/BinbunVFX_Vol2/ElementalMagicFX';
const glacier = 'art-reference/VFX-Godot/energy_beams_fx/effects/06_glacier_shard/shaders';
const coreSource = `${elemental}/shader/projectile_core.gdshader`;
const tailSource = `${elemental}/shader/projectile_tail.gdshader`;
const groundSource = `${elemental}/shader/area_ground.gdshader`;
const crystalSource = `${glacier}/energy_beam.gdshader`;
const shockSource = `${glacier}/impact_shock.gdshader`;
export const licenseFiles = [`${elemental}/license.txt`, 'art-reference/VFX-Godot/energy_beams_fx/LICENSE.md'];
const blue = [.16, .51, .8], ice = [.58, .88, 1], white = [.94, 1, 1];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * clamp(t));
const stroke = (distance, width) => 1 - smooth(width * .45, width, Math.abs(distance));
const loopPhase = frame => (frame < 4 ? 0 : frame > 11 ? 0 : (frame - 4) / 8) * TAU;
const envelope = frame => frame < 4 ? .3 + .7 * smooth(-1, 3, frame) : frame < 12 ? 1 : 1 - smooth(11, 16, frame);

// projectile_core.wave: triangle pulse, wave_twist and scrolling spiral in UV space.
function fluidWave(u, v, phase) {
  const xwave = Math.sin(u * TAU * 3 + v * TAU * 2) * .2;
  const tiled = fract(v * 4 - phase / TAU + .6 * fbm(u * 5, v * 5) + xwave);
  return Math.min(tiled / .6, (1 - tiled) / .4);
}
// energy_beam style 5's hard angular facets, including its third-power glint.
function crystalFacet(along, phase, seed = 0) {
  const f = fract(along * .9), id = Math.floor(along * .9);
  const facet = (.5 + .5 * Math.cos(f * 6.2831 + hash(id, seed) * 6.2831 + phase)) ** 3;
  return .3 + 1.55 * facet;
}
// impact_shock: irregular expanding rim and exponential halo, scaled inside padding.
function shock(out, x, y, progress, strength = 1) {
  const r = Math.hypot(x, y), a = Math.atan2(y, x);
  const radius = .06 + .72 * progress;
  const wobble = .012 * Math.sin(a * 7) + .006 * Math.sin(a * 13);
  const d = Math.abs(r - radius - wobble);
  const rim = stroke(d, .036), halo = Math.exp(-d * 14) * .12;
  over(out, mix(ice, white, rim * .8), (rim + halo) * strength * (1 - smooth(.65, 1.1, progress)));
}
function crystal(out, x, y, cx, cy, length, width, angle, opacity, phase, seed) {
  const dx = x - cx, dy = y - cy, c = Math.cos(angle), s = Math.sin(angle);
  const u = (dx * c + dy * s) / length, v = (-dx * s + dy * c) / width;
  // A six-sided spear: broad rear facet and sharp tip, rather than an ellipse.
  const profile = u < -.45 ? (u + 1) / .55 : (1 - u) / 1.45;
  const edge = Math.min(profile - Math.abs(v), 1 - Math.abs(u));
  if (edge <= -.04) return;
  const mask = smooth(-.035, .035, edge);
  const facet = crystalFacet((u + 1) * 3.8 + (v > 0 ? .7 : 0), phase, seed);
  const lit = clamp(.17 + .42 * facet + (v < 0 ? .18 : 0));
  over(out, mix(blue, white, lit), mask * opacity * .92);
  const seam = stroke(v - .16 * u, .035) * mask;
  over(out, white, seam * opacity * .8);
}
function snowflake(out, x, y, radius, alpha, phase = 0) {
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6 + phase, c = Math.cos(a), s = Math.sin(a);
    const u = x * c + y * s, v = -x * s + y * c;
    if (u < 0 || u > radius) continue;
    let branch = stroke(v, .014) * (1 - smooth(radius * .8, radius, u));
    for (const fraction of [.42, .7]) {
      const arm = u - radius * fraction;
      if (arm >= 0 && arm < radius * .19) branch = Math.max(branch, stroke(Math.abs(v) - arm * .9, .012));
    }
    over(out, ice, branch * alpha);
  }
}

function water(size, time, frame) {
  const phase = loopPhase(frame), env = envelope(frame);
  return renderPixels(size, (x, y, out) => {
    if (Math.abs(x) > .93 || Math.abs(y) > .9) return;
    if (frame < 12) {
      const cx = .25, radius = .275 + .012 * Math.sin(phase);
      const dx = x - cx, d = Math.hypot(dx, y), theta = Math.atan2(y, dx);
      const ripple = .014 * Math.sin(theta * 5 + phase) + .007 * Math.sin(theta * 9 - phase);
      const wave = fluidWave(theta / TAU + .5, d / radius, phase);
      const mask = 1 - smooth(radius + ripple - .018, radius + ripple + .012, d);
      const normal = Math.sqrt(Math.max(0, 1 - (d / radius) ** 2));
      over(out, mix([.025, .22, .48], [.17, .65, .88], normal), mask * env * .86);
      over(out, [.54, .95, 1], stroke(d - radius * .85 - ripple, .023) * mask * env * .88);
      over(out, white, stroke(d - radius * (.48 + wave * .26), .011) * mask * env * .75);
      const hx = (dx + .09) / .075, hy = (y + .11) / .04;
      over(out, white, (1 - smooth(.3, 1, Math.hypot(hx, hy))) * env * .9);
      if (x < .07 && x > -.83) {
        const u = clamp((x + .83) / .9), cy = Math.sin(u * TAU * 1.3 - phase) * .06 * (1 - u);
        const n = fbm(u * 8, Math.cos(phase) + Math.sin(phase) * 2);
        // projectile_tail: subtract the axial tail fade from sampled noise.
        const value = smooth(0, .5, Math.max(n - (1 - u) * .65, 0));
        const w = .035 + u * .09;
        over(out, [.15, .66, .9], (1 - smooth(w * .3, w, Math.abs(y - cy))) * value * env * .8);
        over(out, ice, stroke(y - cy - Math.sin(u * TAU * 2 - phase) * .025, .009) * value * env);
      }
      for (let j = 0; j < 5; j++) {
        const px = -.18 - j * .13, py = Math.sin(j * 2.3 + phase) * (.08 + j * .013);
        const r = .018 + .009 * (1 + Math.sin(j + phase));
        over(out, ice, (1 - smooth(r * .5, r, Math.hypot(x - px, y - py))) * env * .8);
      }
    } else {
      const p = (frame - 11) / 5;
      shock(out, x, y, p, env * .7);
      for (let j = 0; j < 13; j++) {
        const a = j * 2.399963, r = .12 + p * (.42 + hash(j, 2) * .17);
        const dx = x - Math.cos(a) * r, dy = y - Math.sin(a) * r;
        const along = dx * Math.cos(a) + dy * Math.sin(a), across = -dx * Math.sin(a) + dy * Math.cos(a);
        const d = Math.hypot(along / (.035 + p * .045), across / .025);
        over(out, mix([.08, .5, .8], white, .55), (1 - smooth(.45, 1, d)) * env);
      }
    }
  });
}

function iceProjectile(broad) {
  return (size, time, frame) => {
    const phase = loopPhase(frame), env = envelope(frame);
    return renderPixels(size, (x, y, out) => {
      if (Math.abs(x) > .94 || Math.abs(y) > .92) return;
      if (frame < 12) {
        const tail = (1 - smooth(.05, .19, Math.abs(y))) * smooth(-.84, -.15, x) * (1 - smooth(-.15, .45, x));
        over(out, blue, tail * env * .22);
        crystal(out, x, y, broad ? .07 : .15, 0, broad ? .72 : .63, broad ? .22 : .085, 0, env, phase, 1);
        if (broad) {
          crystal(out, x, y, -.11, -.19, .4, .08, -.15, env * .8, phase, 3);
          crystal(out, x, y, -.14, .18, .39, .08, .19, env * .8, phase, 5);
        } else {
          for (let j = 0; j < 5; j++) {
            const xx = -.66 + j * .12, yy = Math.sin(phase + j * 2.4) * .11;
            crystal(out, x, y, xx, yy, .04, .017, .2, env * .6, phase, j);
          }
        }
      } else {
        const p = (frame - 11) / 5;
        shock(out, x, y, p, env * .52);
        for (let j = 0; j < (broad ? 13 : 9); j++) {
          const a = j * 2.399963, r = .08 + p * (.4 + hash(j, 3) * .22);
          crystal(out, x, y, Math.cos(a) * r, Math.sin(a) * r, (.07 + hash(j, 5) * .08) * (1 - p * .2), .028, a, env, p, j);
        }
      }
    });
  };
}

function ground(mode) {
  return (size, time, frame) => {
    const sustained = mode === 'blizzard', phase = loopPhase(frame);
    const t = frame / 15, env = sustained ? envelope(frame) : smooth(-.05, .12, t) * (1 - smooth(.62, 1.1, t));
    const reach = sustained ? .78 : .15 + .57 * smooth(0, .68, t);
    const snow = Array.from({ length: sustained ? 26 : 15 }, (_, j) => {
      const a = j * 2.399963 + (sustained ? phase : 0), r = sustained ? .13 + Math.sqrt(hash(j, 7)) * .55 : reach * (.35 + hash(j, 7) * .6);
      return { x: Math.cos(a) * r, y: Math.sin(a) * r, a: a + .5, length: sustained ? .025 + hash(j, 8) * .055 : .05 + hash(j, 8) * .075, seed: j };
    });
    return renderPixels(size, (x, y, out) => {
      const r = Math.hypot(x, y), a = Math.atan2(y, x);
      if (r > .8) return;
      const n = fbm(x * 7 + Math.cos(phase) * .5, y * 7 + Math.sin(phase) * .5);
      // area_ground: polar UV + radial gradient^8 + overlay noise.
      const gradient = Math.max(0, 1 - r / .85) ** 8;
      const overlay = gradient < .5 ? 2 * gradient * n : 1 - 2 * (1 - gradient) * (1 - n);
      const bed = (overlay + gradient) * .5;
      over(out, [.12, .37, .63], (bed * .8 + (1 - smooth(.45, .8, r)) * .09 * n) * env);
      if (mode === 'nova') {
        const rim = stroke(r - reach - .008 * Math.cos(a * 12), .035);
        over(out, white, rim * env);
        snowflake(out, x, y, reach, env * (1 - smooth(.1, .8, t)), Math.PI / 6);
        for (const p of snow) crystal(out, x, y, p.x, p.y, p.length, .024, p.a, env * .7, t * 2, p.seed);
      } else if (mode === 'shatter') {
        const local = fract((a / TAU + 1) * 11), crack = stroke((local - .5) * r, .011);
        const zig = .012 * Math.sin(r * 54 + Math.floor(a * 11 / TAU) * 5);
        over(out, ice, crack * smooth(.09, .17, r) * (1 - smooth(reach - .1, reach, r)) * env * .9);
        over(out, white, stroke(r - reach + zig, .018) * env * .6);
        for (const p of snow) crystal(out, x, y, p.x, p.y, p.length * (1 + t), .03, p.a + t, env, t, p.seed);
      } else {
        const spiral = (.5 + .5 * Math.sin(a * 3 + r * 20 - phase)) ** 6;
        over(out, ice, spiral * (1 - smooth(.62, .8, r)) * smooth(.08, .24, r) * env * .21);
        for (const p of snow) crystal(out, x, y, p.x, p.y, p.length, .014, p.a, env * (.55 + .4 * Math.sin(p.seed + phase) ** 2), phase, p.seed);
        snowflake(out, x, y, .34, env * .34, -phase / 6);
      }
      out[3] *= 1 - smooth(.78, .8, r);
    });
  };
}
function frostbite(size, time, frame) {
  const t = frame / 15, env = smooth(-.05, .18, t) * (1 - smooth(.65, 1.1, t));
  const reach = .18 + .5 * smooth(0, .5, t);
  return renderPixels(size, (x, y, out) => {
    const r = Math.hypot(x, y);
    if (r > .88) return;
    over(out, blue, (1 - smooth(.08, .58, r)) * env * .13);
    snowflake(out, x, y, reach, env, 0);
    for (let j = 0; j < 6; j++) {
      const a = j * TAU / 6, rj = .33 + .1 * smooth(.1, .6, t);
      crystal(out, x, y, Math.cos(a) * rj, Math.sin(a) * rj, .17, .049, a, env, t * 3, j);
    }
  });
}
const projectileMeta = { delivery: 'projectile', origin: 'target', orient: true, opening: [0, 3], loop: [4, 11], exit: [12, 15], frameMs: 90, anchorX: .5, anchorY: .5, impactAnchorX: .5, impactAnchorY: .5, contentWidthRatio: .88, contentHeightRatio: .8 };
const groundMeta = { delivery: 'ground', origin: 'target', projection: 'ground', orient: false, opening: [0, 3], loop: [0, 11], exit: [12, 15], frameMs: 90, anchorX: .5, anchorY: .5, contentWidthRatio: .8, contentHeightRatio: .8 };
export const recipes = [
  { id: 'attack.water_ball', kind: 'projectile', sources: [coreSource, tailSource, shockSource], render: water, meta: { ...projectileMeta }, adaptation: 'Fluid triangle-wave sphere with scrolling noise tail; analytic sphere normals replace Godot mesh, authored water droplets/splash.' },
  { id: 'attack.ice_lance', kind: 'projectile', sources: [crystalSource, shockSource], render: iceProjectile(false), meta: { ...projectileMeta }, adaptation: 'Glacier style-5 third-power facet glint on an authored narrow crystalline spear and splinter impact.' },
  { id: 'attack.glacial_spike', kind: 'projectile', sources: [crystalSource, shockSource], render: iceProjectile(true), meta: { ...projectileMeta }, adaptation: 'Glacier facet equation on an authored broad three-pronged ice spike; impact becomes angular crystal fragments.' },
  { id: 'attack.frostbite', kind: 'single', sources: [crystalSource], render: frostbite, meta: { delivery: 'instant', origin: 'target', orient: false, opening: [0, 3], loop: [0, 11], exit: [12, 15], frameMs: 90, anchorX: .5, anchorY: .5, contentWidthRatio: .8, contentHeightRatio: .8 }, adaptation: 'Glacier crystal facet material on authored sixfold branching target frost and radial crystals; upright, symmetric.' },
  { id: 'attack.blizzard', kind: 'ground', sources: [groundSource, crystalSource], render: ground('blizzard'), meta: { ...groundMeta, loop: [4, 11] }, adaptation: 'Whole-field topdown polar-gradient overlay and orbiting glacier shards. Cyclic field loop; canonical engine owns eight-second duration and damage.' },
  { id: 'attack.shatter', kind: 'ground', sources: [groundSource, crystalSource], render: ground('shatter'), meta: { ...groundMeta }, adaptation: 'Polar-gradient ground frost with authored radial cracks and outward angular glacier fragments; no baked projection.' },
  { id: 'attack.frost_nova', kind: 'ground', sources: [groundSource, crystalSource], render: ground('nova'), meta: { ...groundMeta, delivery: 'instant', origin: 'caster' }, adaptation: 'Expanding authored sixfold frost-front with glacier crystal facets and source polar-gradient ground frost; topdown source.' },
];
