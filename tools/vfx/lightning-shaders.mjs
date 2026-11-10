/** CPU raster adaptations of the named Godot shaders, not captures of their 3D scenes.
 * Binbun electric shaders are CC0; energy_beams_fx is MIT, Copyright (c) 2026.
 * Preserve the exported license files with redistributed derivative assets.
 * Mesh UVs become analytic bolt/radial UVs; seeded value noise replaces noise textures.
 * Every ground sprite is a circular plan view. The arena owns its projection.
 */
import { clamp, smooth, fract, noise, fbm, over, renderPixels, TAU, DURATION_SEC } from './shader-math.mjs';

const ELECTRIC = 'archive/art-reference/VFX-Godot/ElectricFXFree/assets/BinbunVFX_Vol2/ElectricFX/shader/';
const BEAM = 'archive/art-reference/VFX-Godot/GodotBeamVFXFree/assets/BinbunVFX/beam_vfx/src/shader/';
const ENERGY = 'archive/art-reference/VFX-Godot/energy_beams_fx/effects/03_violet_storm/shaders/';
export const licenseFiles = [ELECTRIC.replace('shader/', 'license.txt'), 'archive/art-reference/VFX-Godot/energy_beams_fx/LICENSE.md'];
const blue = [.12, .42, 1], cyan = [.24, .83, 1], white = [.88, .98, 1], violet = [.46, .3, 1];

// zap.gdshader: its triangular wave and four vertex displacement samples.
function wave(y, frequency, offset) {
  return Math.abs(fract(y * frequency + offset) * 2 - 1) - .5;
}
function zapOffset(u, sec, seed) {
  const y = u * 15, motion = sec * .1;
  const a = wave(y, .4, motion + seed);
  const b = wave(y, .6, Math.PI - motion - seed);
  const c = wave(y, .4, -Math.PI + motion + seed);
  const d = wave(y, .6, -TAU - motion - seed);
  return (a + b + (c + d) * .35) * Math.sqrt(clamp(1 - u * .75));
}
function bolt(out, distance, u, sec, seed, life, width = .013) {
  if (u < 0 || u > 1 || life <= 0 || Math.abs(distance) > width * 7) return;
  const n = noise(u * 39 + seed * 19, sec * 8 + seed);
  // zap fragment's noise >= 1-COLOR.a erosion and clamped UV.y*4 endpoint mask.
  const erosion = smooth(1 - life - .08, 1 - life + .08, n);
  const end = smooth(0, .06, u) * (1 - smooth(.91, 1, u));
  const d = Math.abs(distance) / width;
  over(out, blue, Math.exp(-d * .6) * end * life * .27);
  over(out, cyan, (1 - smooth(.8, 2.8, d)) * erosion * end * life);
  over(out, white, (1 - smooth(.15, .85, d)) * erosion * end * life);
}

// ground_impact.gdshader: angular waves, COLOR.a growth and edge remap.
function impactValue(r, angle, age, seed = .3) {
  const w1 = (Math.sin(angle * 4 + r + seed * Math.PI) * .5 + .5) * 2;
  const w2 = (Math.sin(angle * 7.04 - r - seed * .5) * .5 + .5) * 1.5;
  const w3 = Math.sin(angle * 4 * Math.PI + r + seed * Math.PI) * .5 + .5;
  const w4 = (Math.sin(angle * 41 + r - seed * .5) * .5 + .5) * .2;
  const factor = .045 + age * .32;
  const value = Math.max(1 - Math.abs((r + (w1 + w2 + w3 + w4) * .055 - .81 + factor) / factor), 0);
  return smooth(.05, .55, clamp((value - .3) / .7));
}

// energy_beams impact_shock: hot leading rim, exponential halo, decaying interior.
function shock(out, x, y, progress, strength, scale = .8) {
  const r = Math.hypot(x, y) / scale, a = Math.atan2(y, x);
  const radius = .06 + .88 * progress;
  const wobble = .012 * Math.sin(a * 7 + 3.6) + .006 * Math.sin(a * 13 - 1.5);
  const d = Math.abs(r - radius - wobble);
  const rim = 1 - smooth(0, .045, d);
  const halo = Math.exp(-d * 25) * .16;
  const inner = Math.exp(-Math.abs(r - radius * .55) * 16) * .1;
  const edge = (1 - smooth(.75, 1, progress)) * strength;
  over(out, cyan, (rim + halo + inner) * edge);
  over(out, white, rim * .7 * edge);
}
function glow(out, x, y, radius, strength, color = cyan) {
  const d = Math.hypot(x, y) / radius;
  if (d > 2.5) return;
  over(out, color, Math.exp(-d * d * 2) * strength * .45);
  over(out, white, (1 - smooth(.05, .55, d)) * strength);
}
function ageOf(sec) { return clamp(sec / DURATION_SEC); }
function lifeOf(age) { return (.3 + .7 * smooth(0, .06, age)) * (1 - smooth(.63, 1, age)); }
const phase = { frameMs: 90, opening: [0, 3], loop: [0, 11], exit: [12, 15], anchorX: .5, anchorY: .5 };
const ground = { ...phase, projection: 'ground', contentWidthRatio: .8, contentHeightRatio: .8,
  contentCenterX: .5, contentCenterY: .5, orient: false };

function chainFrame(size, sec) {
  const age = ageOf(sec), life = lifeOf(age);
  return renderPixels(size, (x, y, out) => {
    const r = Math.hypot(x, y);
    if (r > .86) return;
    glow(out, x, y, .18 + age * .04, life);
    // A local contact crackle, not a drawing of hypothetical chain targets.
    for (let i = 0; i < 7; i++) {
      const a = i * TAU / 7 + .18, c = Math.cos(a), s = Math.sin(a);
      const u = (x * c + y * s - .02) / (.5 + (i % 3) * .09);
      if (u <= 0 || u >= 1) continue;
      const displacement = zapOffset(u, sec, i * .37) * .11 * Math.sin(Math.PI * u);
      bolt(out, -x * s + y * c - displacement, u, sec, i * .37, life, .012);
    }
    shock(out, x, y, clamp(age * 1.6), life * .35, .57);
  });
}

function strikeFrame(size, sec) {
  const age = ageOf(sec), life = lifeOf(age), flash = 1 - smooth(.14, .5, age);
  return renderPixels(size, (x, y, out) => {
    if (Math.abs(x) > .78 || y < -.93 || y > .91) return;
    const u = (y + .88) / 1.45;
    if (u > 0 && u < 1) {
      const offset = zapOffset(u, sec, .41) * .19 * (1 - smooth(.82, 1, u));
      bolt(out, x - offset, u, sec, .41, life, .026 * (.6 + flash));
      const side = x - offset - .11 * Math.sin(u * 17) * Math.sin(u * Math.PI);
      bolt(out, side, u, sec, .92, life * .62, .01);
    }
    // The contact burst is screen facing; no ground ellipse is baked into this cell.
    shock(out, x, y - .54, clamp(age * 1.55), life * .8, .36);
    glow(out, x, y - .54, .17, life * (.4 + flash));
  });
}

function projectileFrame(size, sec, frame, seeker) {
  const age = ageOf(sec), impact = frame >= 12;
  const strength = impact ? 1 - smooth(12, 16, frame) : .55 + .45 * smooth(0, 3, frame);
  return renderPixels(size, (x, y, out) => {
    if (Math.hypot(x, y) > .91) return;
    if (impact) {
      const p = (frame - 12) / 4;
      shock(out, x, y, .12 + p * .8, strength, seeker ? .58 : .72);
      glow(out, x, y, .23 * (1 - p * .5), strength);
      for (let i = 0; i < 5; i++) {
        const a = i * TAU / 5, c = Math.cos(a), s = Math.sin(a);
        const u = (x * c + y * s) / (.3 + p * .35);
        bolt(out, -x * s + y * c - zapOffset(u, sec, i * .3) * .065,
          u, sec, i, strength, .012);
      }
      return;
    }
    const headX = .23, u = (x + .76) / .99;
    if (u > 0 && u < 1) {
      // energy_beam electric style: noisy filaments inside a view-facing tube.
      const axis = seeker ? Math.sin(u * TAU * 1.6 - sec * 4) * .09 * Math.sin(u * Math.PI)
        : zapOffset(u, sec, .2) * .085;
      const radius = seeker ? .035 + .035 * u : .025 + .09 * u * u;
      const d = Math.abs(y - axis) / radius;
      const facing = Math.sqrt(clamp(1 - d * d));
      if (d < 1) {
        const n = fbm(u * 12.5 - sec * 3.2, (1 - facing) * 3 + .6);
        const arc = Math.pow(Math.max(n - .4, 0) * 2.6, 2);
        const mask = .26 + 2.7 * arc;
        // beam_outer UV twist/scroll and open_amount clipping.
        const outerNoise = fbm(u * 4 - sec, d + u * 3);
        const outer = smooth(.35, .85, outerNoise) * smooth(0, .12, u);
        over(out, seeker ? violet : blue, Math.pow(facing, 2.2) * mask * strength);
        over(out, cyan, outer * facing * strength);
        over(out, white, Math.pow(facing, 18) * (.65 + .35 * mask) * strength);
      }
      bolt(out, y - axis - zapOffset(u, sec, .53) * .06, u, sec, .53, strength * .6, .008);
    }
    if (seeker) {
      // Single homing payload: runtime emits the three real projectiles separately.
      const dx = (x - headX) / .15, dy = y / .09;
      const diamond = Math.abs(dx) + Math.abs(dy);
      over(out, cyan, (1 - smooth(.65, 1.2, diamond)) * strength);
      over(out, white, (1 - smooth(.15, .65, diamond)) * strength);
    } else {
      // beam_ball's flash mix on a round mesh, with electric_particle noise erosion.
      const r = Math.hypot(x - headX, y) / .16;
      const n = fbm((x - headX) * 18 + sec, y * 18 - sec);
      const erosion = smooth(.05, .32, n - (1 - strength));
      over(out, cyan, (1 - smooth(.65, 1.1, r)) * erosion * strength);
      glow(out, x - headX, y, .15, strength);
    }
  });
}

function overloadFrame(size, sec) {
  const age = ageOf(sec), life = lifeOf(age);
  return renderPixels(size, (x, y, out) => {
    const r = Math.hypot(x, y), a = Math.atan2(y, x);
    if (r > .8) return;
    const p = .1 + .9 * smooth(0, .7, age);
    shock(out, x, y, p, life, .8);
    const impact = impactValue(r / .8, a, smooth(0, .7, age));
    over(out, violet, impact * life * .85);
    over(out, cyan, impact * impact * life);
    // Radial jagged discharge fills the burst, rather than a sustained storm net.
    const sector = Math.round(a / TAU * 11);
    const axis = sector / 11 * TAU + zapOffset(r / .8, sec, sector * .19) * .12;
    const delta = Math.atan2(Math.sin(a - axis), Math.cos(a - axis));
    bolt(out, delta * r, r / .8, sec, sector * .19, life * (1 - smooth(.25, .8, age)), .011);
    glow(out, x, y, .22, (1 - smooth(.15, .53, age)) * life);
    out[3] *= 1 - smooth(.78, .8, r);
  });
}

function thunderStormFrame(size, sec) {
  const age = ageOf(sec), life = lifeOf(age);
  return renderPixels(size, (x, y, out) => {
    const r = Math.hypot(x, y), a = Math.atan2(y, x);
    if (r > .8) return;
    const radius = .15 + .59 * smooth(0, .52, age);
    const u = r / radius;
    // ground_streaks.gdshader's three angular frequencies on polar mesh UVs.
    const w1 = (Math.sin(a * 8 + sec) * .5 + .5) * 2;
    const w2 = (Math.sin(a * 9 - sec) * .5 + .5) * 2;
    const w3 = Math.sin(a * 64 + sec) * .5 + .5;
    const streak = clamp((clamp(1 - u - (w1 + w2 + w3) * .1) - .125) / .875);
    over(out, blue, smooth(.03, .58, streak) * smooth(.06, .28, r) * life * .5);
    const ringAxis = radius + zapOffset(fract(a / TAU + .5), sec, .27) * .055;
    const d = Math.abs(r - ringAxis);
    over(out, cyan, (1 - smooth(.01, .04, d)) * life);
    over(out, white, (1 - smooth(.002, .012, d)) * life);
    const sector = Math.round(a / TAU * 9);
    const direction = sector * TAU / 9 + zapOffset(u, sec, sector * .4) * .1;
    const delta = Math.atan2(Math.sin(a - direction), Math.cos(a - direction));
    bolt(out, delta * r, u, sec, sector * .4, life, .012);
    glow(out, x, y, .19, life * .7);
    out[3] *= 1 - smooth(.78, .8, r);
  });
}

function stormFieldFrame(size, sec, frame) {
  const life = frame < 4 ? .3 + .7 * smooth(0, 3, frame) : frame <= 11 ? 1 : 1 - smooth(11, 16, frame);
  const loopTime = frame >= 4 && frame <= 11 ? (frame - 4) / 8 * TAU : sec * 4;
  return renderPixels(size, (x, y, out) => {
    const r = Math.hypot(x, y), a = Math.atan2(y, x);
    if (r > .8) return;
    const n = fbm(x * 10 + Math.sin(loopTime) * .3, y * 10 + Math.cos(loopTime) * .3);
    const erosion = smooth(.46, .77, n) * (1 - smooth(.59, .81, r));
    over(out, blue, erosion * life * .5);
    // impact_sphere: noise threshold follows particle alpha; flattened into a plan-view bed.
    const shell = smooth(1 - life, 1, n) * (1 - smooth(.73, .8, r));
    over(out, violet, shell * .3 * smooth(.08, .3, r));
    for (let j = 0; j < 3; j++) {
      const radius = .26 + j * .24;
      const wobble = .025 * Math.sin(a * (7 + j * 2) + loopTime) + .015 * Math.sin(a * 17 - loopTime);
      const d = Math.abs(r - radius - wobble);
      const arc = .3 + .7 * smooth(.34, .6, noise(a * 9 + j * 4, Math.sin(loopTime) + j));
      over(out, cyan, (1 - smooth(.006, .025, d)) * arc * life);
      over(out, white, (1 - smooth(.002, .009, d)) * arc * life * .6);
    }
    for (let i = 0; i < 6; i++) {
      const direction = i * TAU / 6 + .13, c = Math.cos(direction), s = Math.sin(direction);
      const u = (x * c + y * s - .14) / .59;
      const cross = -x * s + y * c - zapOffset(u, Math.sin(loopTime), i * .21) * .11 * Math.sin(u * Math.PI);
      bolt(out, cross, u, Math.sin(loopTime), i * .21, life * .8, .01);
    }
    out[3] *= 1 - smooth(.78, .8, r);
  });
}

export const recipes = [
  { id: 'attack.chain_lightning', kind: 'chain-contact',
    sources: [ELECTRIC + 'zap.gdshader', ENERGY + 'impact_shock.gdshader'], render: chainFrame,
    adaptation: 'Zap triangle-wave displacement and noise erosion on a local contact crackle; source shock rim. No hypothetical target positions or hop links.',
    meta: { ...phase, delivery: 'instant', origin: 'target', orient: false,
      composition: 'single-target-contact; runtime paths must compose actual hop bridges',
      authoringGeometry: { shape: 'single', radiusM: 0 },
      actionKind: 'chain-strike' } },
  { id: 'attack.spark', kind: 'projectile-ball',
    sources: [ELECTRIC + 'zap.gdshader', ELECTRIC + 'electric_particle.gdshader', BEAM + 'beam_ball.gdshader',
      BEAM + 'beam_outer.gdshader', ENERGY + 'energy_beam.gdshader', ENERGY + 'impact_shock.gdshader'],
    render: (size, sec, frame) => projectileFrame(size, sec, frame, false),
    adaptation: 'Beam-ball flash on a round projectile; electric particle erosion, beam-outer scrolling mask and electric beam-style filaments; authored radial contact burst.',
    meta: { ...phase, delivery: 'projectile', origin: 'target', loop: [4, 11], orient: true } },
  { id: 'attack.thunder_strike', kind: 'upright-skybolt',
    sources: [ELECTRIC + 'zap.gdshader', ENERGY + 'impact_shock.gdshader'], render: strikeFrame,
    adaptation: 'Four sampled zap triangle waves displace an upright skybolt; source noise erosion and impact shock ring. Analytic tube replaces the 3D mesh.',
    meta: { ...phase, delivery: 'ground', origin: 'target', anchorY: .77, orient: false } },
  { id: 'attack.overload', kind: 'ground-discharge',
    sources: [ELECTRIC + 'ground_impact.gdshader', ELECTRIC + 'zap.gdshader', ENERGY + 'impact_shock.gdshader'],
    render: overloadFrame,
    adaptation: 'Ground-impact angular waves and alpha-driven growth plus source shock ring and radial zap discharge; topdown single pulse, runtime owns repeated impacts.',
    meta: { ...ground, delivery: 'ground', origin: 'target', actionKind: 'ground-pulse-burst' } },
  { id: 'attack.seeker_strafe', kind: 'homing-dart',
    sources: [ELECTRIC + 'zap.gdshader', BEAM + 'beam_outer.gdshader', ENERGY + 'energy_beam.gdshader',
      ENERGY + 'impact_shock.gdshader'], render: (size, sec, frame) => projectileFrame(size, sec, frame, true),
    adaptation: 'Electric beam-style high-contrast filaments and wave-axis deformation on a narrow diamond homing dart, followed by source impact shock; one real payload per sprite.',
    meta: { ...phase, delivery: 'projectile', origin: 'target', loop: [4, 11], orient: true,
      composition: 'one homing payload; runtime owns three independently emitted hits' } },
  { id: 'attack.thunder_storm', kind: 'ground-electric-nova',
    sources: [ELECTRIC + 'ground_streaks.gdshader', ELECTRIC + 'zap.gdshader'], render: thunderStormFrame,
    adaptation: 'Ground-streaks three-frequency polar mask inside an expanding jagged zap corona; whole caster-origin circle in topdown plan view.',
    meta: { ...ground, delivery: 'instant', origin: 'caster' } },
  { id: 'attack.storm_field', kind: 'ground-storm-net',
    sources: [ELECTRIC + 'zap.gdshader', ELECTRIC + 'impact_sphere.gdshader'], render: stormFieldFrame,
    adaptation: 'Impact-sphere alpha/noise threshold under a cyclic charged net, with source zap displacement on radial conductors. Canonical dot_sec owns field duration.',
    meta: { ...ground, delivery: 'ground', origin: 'target', loop: [4, 11],
      composition: 'sustain loop only while canonical lingering action remains active' } },
];
