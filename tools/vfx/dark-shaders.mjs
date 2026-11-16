/** CPU atlas adaptations of the locally supplied Binbun Godot shaders.
 * Shader functions below retain the source mask/wave/overlay equations. Geometry,
 * explicit age and deterministic value noise replace Godot meshes, TIME and sampled
 * FastNoiseLite textures; these are adaptations, not captures of the Godot scenes.
 * ElementalMagicFXFree's local license is CC0. DarkMagicFXFree's local license
 * says CC0 but calls the pack "Stylized Flame FX". MagicProjectilesVFX contains
 * no local license file; its official itch.io page states CC0 (verified by root).
 */
import { clamp, smooth, fract, fbm, over, renderPixels, TAU, DURATION_SEC } from './shader-math.mjs';

const dark = name => `archive/art-reference/VFX-Godot/DarkMagicFXFree/assets/BinbunVFX_Vol2/DarkMagicFX/shader/${name}.gdshader`;
const elemental = name => `archive/art-reference/VFX-Godot/ElementalMagicFXFree/assets/BinbunVFX_Vol2/ElementalMagicFX/shader/${name}.gdshader`;
const transparent = 'archive/art-reference/VFX-Godot/MagicProjectilesVFX/assets/BinbunVFX/shared/shader/transparent.gdshader';
const uvTools = 'archive/art-reference/VFX-Godot/MagicProjectilesVFX/assets/BinbunVFX/shared/shader/util/uvtools.gdshaderinc';
export const licenseFiles = [
  'archive/art-reference/VFX-Godot/DarkMagicFXFree/assets/BinbunVFX_Vol2/DarkMagicFX/license.txt',
  'archive/art-reference/VFX-Godot/ElementalMagicFXFree/assets/BinbunVFX_Vol2/ElementalMagicFX/license.txt',
];
const GREEN = [109, 229, 36].map(v => v / 255), ACID = [217, 255, 100].map(v => v / 255), MOSS = [31, 91, 34].map(v => v / 255);
const VIOLET = [158, 70, 236].map(v => v / 255), PINK = [248, 124, 255].map(v => v / 255), INK = [24, 9, 39].map(v => v / 255);
const overlay = (a, b) => a < .5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b);
const mixColor = (a, b, n) => a.map((v, i) => v + (b[i] - v) * clamp(n));
const line = (x, y, ax, ay, bx, by, width) => {
  const dx = bx - ax, dy = by - ay;
  const p = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy));
  return 1 - smooth(width * .45, width, Math.hypot(x - ax - p * dx, y - ay - p * dy));
};
const ring = (r, radius, width) => 1 - smooth(width * .35, width, Math.abs(r - radius));
const envelope = f => smooth(-1, 3, f) * (1 - smooth(11, 16, f));
const edge = (x, y) => 1 - smooth(.83, .94, Math.max(Math.abs(x), Math.abs(y)));

// area_dark / dark_vortex: polar texture scroll, two radial waves and five streaks.
function areaValue(x, y, time, vortex = false) {
  const r = Math.hypot(x, y), a = Math.atan2(x, y);
  if (r >= 1) return 0;
  const wave = Math.sin(r * 5 - time * 2) + Math.sin(r * 9 - time * 2);
  const n = vortex
    ? fbm(r * 5 - time * .2, a / TAU * 7 + wave * .05)
    : fbm(a / TAU * 7, r * 5 - time * .2 + wave * .05);
  let value = (n + Math.pow(1 - r, 4) * (vortex ? 1.5 : 2)) * Math.sqrt(1 - r);
  value -= (Math.sin(a * 5 + time) * .5 + .5) * .2;
  value = smooth(0, 1, value);
  return clamp((vortex ? overlay(value, value * value) : value) - .05);
}

// dark_ring: eighth-power annulus, overlay with polar scrolling noise.
function ringValue(x, y, time, radius = .6) {
  const r = Math.hypot(x, y) * .5 / radius;
  const a = Math.atan2(x, y);
  const mask = Math.pow(1 - Math.min(Math.abs(r * 2 - 1), 1), 8);
  return clamp(overlay(mask, fbm(a / TAU * 9, r * 5 - time * .2)) - .05);
}

// dark_lift: y-weighted scrolling noise and fourth-power root, squared output.
function liftValue(u, v, time) {
  const y = clamp(v) * 2;
  const wave = Math.sin(y * TAU * 2.5 - time) * (1 - y);
  const n = fbm(u * 5 + wave * .05, v * 5 + time * .2);
  return Math.pow(clamp((n * y + Math.pow(y, 4)) / 1.5), 2);
}

// projectile_core: triangular fract wave, twisted UV, fade-tail smoothstep.
function coreValue(u, v, time) {
  const n = 1 - fbm(u + time * .5, v);
  const xwave = Math.sin(u * TAU * 3 + v * TAU * 2) * .2;
  const tiled = fract((v * 2 - time) * 2 + n * .6 + xwave);
  const wave = Math.min(tiled / .6, (1 - tiled) / .4);
  return smooth(0, .5, Math.max(1 - v + wave * .1 - .4, 0));
}

// transparent.gdshader: radial mask UVs, multiply blend, cubic color/alpha.
// Its alpha clamp arguments are retained literally, including their unusual order.
function magicMask(x, y, time, shape) {
  const theta = Math.atan2(x, y) / TAU, radius = Math.hypot(x, y) * .5;
  const sampled = fbm(theta * 13 + time * .2, radius * 11 - time * .5);
  const mask = clamp(shape) * (.55 + sampled * .45);
  return { alpha: clamp(Math.pow(Math.min(.977, mask), 3) * .954), color: Math.pow(smooth(.25, .75, mask), 3) };
}

function cloud(x, y, time, f, out) {
  const env = envelope(f), r = Math.hypot(x, y) / .8;
  if (r > 1) return;
  const v = areaValue(x / .8, y / .8, time);
  const curl = fbm(x * 5 + time * .45, y * 5 - time * .3);
  over(out, mixColor(MOSS, GREEN, v), v * .7 * env);
  // Separate drifting lobes make a cloud, with bubbles above a toxic floor.
  for (let i = 0; i < 7; i++) {
    const a = i * 2.39996, travel = .18 + .15 * Math.sin(time * 2 + i);
    const cx = Math.cos(a) * travel, cy = Math.sin(a) * travel;
    const d = Math.hypot(x - cx, y - cy);
    over(out, GREEN, (1 - smooth(.06, .22 + curl * .06, d)) * .22 * env);
    over(out, ACID, ring(d, .055 + .018 * Math.sin(time * 3 + i), .012) * .65 * env);
  }
}

function projectile(mode, x, y, time, f, out) {
  const acid = mode === 'acid', chaos = mode === 'chaos';
  const base = chaos ? VIOLET : GREEN, bright = chaos ? PINK : ACID;
  if (f >= 12) {
    const age = (f - 11) / 4, r = Math.hypot(x, y);
    const spoke = Math.pow(Math.max(0, Math.cos(Math.atan2(y, x) * (acid ? 5 : 7) + time)), 10);
    const v = ringValue(x, y, time, .18 + age * .42);
    over(out, base, v * (1 - age * .8));
    over(out, bright, spoke * (1 - smooth(.12, .65, r)) * (1 - age));
    return;
  }
  const env = smooth(-1, 3, f), headX = .34;
  const hx = x - headX, r = Math.hypot(hx / (acid ? .19 : .24), y / .20);
  const tailU = clamp((headX - x) / 1.1), width = (acid ? .035 : .1) * (1 - tailU) + .025;
  const lateral = Math.abs(y + Math.sin(x * 14 - time * 8) * .018);
  const tailShape = (1 - smooth(width, width * 2, lateral)) * smooth(-.8, -.55, x) * (1 - smooth(.30, .43, x));
  const v = coreValue(clamp(y + .5), tailU * .55, time);
  const magic = magicMask(x, y, time, tailShape * v);
  over(out, mixColor(base, bright, magic.color), magic.alpha * env);
  if (r < 1) {
    // void_ball's fresnel plus eighth-power moving noise; sphere proxy in 2D.
    const fresnel = Math.sqrt(1 - r * r);
    const n = fbm(hx * 8 + Math.sin(time) * .2, y * 8 + Math.cos(time) * .2);
    const value = fresnel + Math.pow(n, 8) * 4 * Math.sin(clamp((y + .2) / .4) * Math.PI);
    over(out, mixColor(base, bright, value), fresnel * env);
    if (chaos) over(out, INK, smooth(.65, .88, fresnel) * .96 * env);
  }
  if (acid) {
    const shaft = line(x, y, -.28, 0, .42, 0, .025);
    const barb = Math.max(line(x, y, .25, -.13, .45, 0, .035), line(x, y, .25, .13, .45, 0, .035));
    over(out, bright, Math.max(shaft, barb) * env);
  }
}

function spray(x, y, time, f, out) {
  const rootY = .75, length = rootY - y;
  if (length < 0 || length > 1.5 || Math.abs(x) > length) return;
  const r = Math.hypot(x, length), env = envelope(f);
  const cone = (1 - smooth(.83, 1, Math.abs(x) / Math.max(length, .01))) * (1 - smooth(1.1, 1.48, r));
  const n = fbm(x * 9, length * 8 - time * 3);
  const jet = coreValue(clamp(x / (length * 2) + .5), clamp(length / 1.7), time * 1.8);
  over(out, MOSS, cone * n * .42 * env);
  over(out, GREEN, cone * Math.pow(n, 2) * jet * .9 * env);
  for (let i = 0; i < 9; i++) {
    const a = -.66 + i * .165, travel = .2 + fract(time * .9 + i * .127) * 1.1;
    const dx = Math.sin(a) * travel, dy = rootY - Math.cos(a) * travel;
    over(out, ACID, (1 - smooth(.012, .035, Math.hypot(x - dx, y - dy))) * env);
  }
}

function catalyst(x, y, time, f, out) {
  const env = envelope(f), r = Math.hypot(x, y), a = Math.atan2(y, x);
  const convergence = .64 - smooth(0, 10, f) * .43;
  const v = ringValue(x, y, time, convergence);
  over(out, GREEN, v * env);
  for (let i = 0; i < 5; i++) {
    const angle = TAU * i / 5 + time * .4;
    const px = Math.cos(angle) * convergence, py = Math.sin(angle) * convergence;
    over(out, ACID, (1 - smooth(.035, .085, Math.hypot(x - px, y - py))) * env);
  }
  const burst = Math.pow(Math.max(0, Math.cos(a * 5 + time)), 12) * (1 - smooth(.1, .7, r));
  over(out, ACID, burst * smooth(7, 11, f) * env);
}

function venomStrike(x, y, time, f, out) {
  const env = envelope(f), r = Math.hypot(x, y);
  const twist = Math.sin(y * 13 - time * 6) * .10;
  const body = Math.max(line(x, y, -.16, -.67, .12, .02, .065), line(x, y, .12, .02, -.13, .43, .065));
  const flare = liftValue(x + .5, clamp((y + .7) / 1.3), time);
  over(out, GREEN, body * (.5 + flare) * env);
  over(out, ACID, (1 - smooth(.018, .05, Math.abs(x - twist))) * (1 - smooth(.42, .7, Math.abs(y))) * env);
  over(out, GREEN, ringValue(x, y, time, .24 + smooth(2, 12, f) * .32) * .6 * env);
  over(out, ACID, (1 - smooth(.03, .13, r)) * env);
}

function voidEffect(mode, x, y, time, f, out) {
  const r = Math.hypot(x, y), a = Math.atan2(y, x), env = envelope(f);
  if (r > .82) return;
  if (mode === 'wave') {
    const radius = .14 + .64 * smooth(0, 13, f);
    over(out, VIOLET, ringValue(x, y, time, radius) * env);
    over(out, PINK, ring(r, radius, .035) * (.4 + .6 * Math.pow(Math.sin(a * 6 - time * 3), 2)) * env);
    over(out, INK, areaValue(x / radius, y / radius, time) * .55 * env);
  } else if (mode === 'blast') {
    const size = .3 + .5 * smooth(0, 9, f);
    const v = areaValue(x / size, y / size, time, true);
    over(out, INK, areaValue(x / .8, y / .8, time) * env);
    over(out, mixColor(VIOLET, PINK, v), v * env);
    over(out, PINK, ringValue(x, y, time, size * .85) * .8 * env);
  } else if (mode === 'ruin') {
    const spiral = Math.pow(Math.max(0, Math.cos(a * 5 + r * 13 - time * 5)), 10);
    const v = areaValue(x / .8, y / .8, time, true);
    over(out, VIOLET, v * spiral * env);
    const collapse = .56 - smooth(0, 11, f) * .38;
    over(out, PINK, ringValue(x, y, time, collapse) * env);
    over(out, INK, (1 - smooth(.08, collapse, r)) * .95 * env);
    over(out, PINK, Math.max(line(x, y, -.43, -.56, .43, .56, .035), line(x, y, -.43, .56, .43, -.56, .035)) * smooth(7, 11, f) * env);
  } else {
    const wobble = Math.sin(a * 2 - time * 4) * Math.sin(r * 4 + time * 4);
    const radius = .40 + wobble * .045;
    over(out, INK, (1 - smooth(radius - .04, radius, r)) * .98 * env);
    over(out, VIOLET, ringValue(x, y, time, radius) * env);
    for (let i = 0; i < 3; i++) {
      const rot = time * (i % 2 ? -1 : 1) + i * TAU / 3;
      const u = x * Math.cos(rot) + y * Math.sin(rot), v = -x * Math.sin(rot) + y * Math.cos(rot);
      over(out, PINK, ring(Math.hypot(u, v * 2.5), .56, .025) * env * .75);
    }
  }
}

function curse(mode, x, y, time, f, out) {
  const env = envelope(f), r = Math.hypot(x, y), a = Math.atan2(y, x);
  if (r > .84) return;
  const poison = mode === 'bind', base = poison ? GREEN : VIOLET, bright = poison ? ACID : PINK;
  const haze = areaValue(x / .83, y / .83, time, true);
  over(out, poison ? MOSS : INK, haze * .45 * env);
  const tendrils = Math.pow(Math.max(0, Math.sin(a * 5 + r * 14 - time * 2)), 6);
  over(out, base, haze * tendrils * .35 * env);
  let shape = 0;
  if (mode === 'weaken') {
    // Downward tooth and broken bands visually pull the mark down.
    shape = Math.max(line(x, y, 0, -.57, 0, .36, .04), line(x, y, -.23, .13, 0, .42, .045), line(x, y, .23, .13, 0, .42, .045));
    shape = Math.max(shape, ring(r, .59, .025) * smooth(.13, .3, Math.abs(x)));
  } else if (mode === 'blind') {
    const eye = Math.abs(y) + x * x * .8;
    shape = ring(eye, .25, .025) * (1 - smooth(.51, .61, Math.abs(x)));
    shape = Math.max(shape, line(x, y, -.48, .42, .48, -.42, .045));
    over(out, INK, (1 - smooth(.12, .22, r)) * .95 * env);
  } else if (mode === 'expose') {
    const diamond = Math.abs(x) + Math.abs(y);
    shape = ring(diamond, .65, .035);
    shape = Math.max(shape, ring(r, .22, .024), line(x, y, -.78, 0, -.35, 0, .03), line(x, y, .35, 0, .78, 0, .03));
    shape = Math.max(shape, line(x, y, 0, -.78, 0, -.35, .03), line(x, y, 0, .35, 0, .78, .03));
  } else if (mode === 'cripple') {
    const pinch = .35 - .10 * Math.sin(time * 3);
    const left = Math.hypot((x + pinch) * 1.7, y * 1.3), right = Math.hypot((x - pinch) * 1.7, y * 1.3);
    shape = Math.max(ring(left, .40, .04), ring(right, .40, .04), line(x, y, -pinch, 0, pinch, 0, .035));
    shape = Math.max(shape, line(x, y, -.18, -.50, .18, .50, .03));
  } else if (mode === 'jinx') {
    for (let i = 0; i < 3; i++) {
      const angle = i * TAU / 3 + time * .4, cx = Math.cos(angle) * .46, cy = Math.sin(angle) * .46;
      const diamond = Math.abs(x - cx) + Math.abs(y - cy);
      shape = Math.max(shape, ring(diamond, .14, .028), line(x, y, 0, 0, cx, cy, .022));
    }
    shape = Math.max(shape, ring(r, .18, .025));
  } else {
    const helix = Math.sin(y * 9 - time * 3) * .29;
    const taper = 1 - smooth(.53, .70, Math.abs(y));
    shape = Math.max(1 - smooth(.022, .05, Math.abs(x - helix)), 1 - smooth(.022, .05, Math.abs(x + helix))) * taper;
    for (let i = -2; i <= 2; i++) {
      const h = i * .22, spread = Math.sin(h * 9 - time * 3) * .29;
      shape = Math.max(shape, line(x, y, -spread, h, spread, h, .022));
    }
    over(out, GREEN, ringValue(x, y, time, .65) * .6 * env);
  }
  // The sigil is an authored mesh-equivalent mask shaded by dark_lift noise.
  const value = liftValue((a / TAU + .5), (y + .85) / 1.7, time);
  over(out, mixColor(base, bright, value), shape * (.65 + value * .35) * env);
  over(out, bright, shape * Math.pow(haze, 2) * env);
}

const common = { opening: [0, 3], loop: [4, 11], exit: [12, 15], frameMs: 90, anchorX: .5, anchorY: .5, orient: false, contentWidthRatio: .8, contentHeightRatio: .8 };
function recipe(id, kind, sources, draw, meta = {}) {
  const provenance = { author: 'Binbun3D', license: 'CC0', noise: 'deterministic value noise replaces source FastNoiseLite textures', mesh: 'authored 2D masks and sphere-normal proxies replace Godot meshes', darkLicenseCaveat: 'Local DarkMagicFXFree license labels itself Stylized Flame FX', ...(sources.includes(transparent) ? { magicLicenseSource: 'https://binbun3d.itch.io/magic-projectiles-vfx', magicLocalLicense: 'absent' } : {}) };
  return { id, kind, sources, meta: { ...common, ...meta, provenance }, render(size, time, frame) {
    const f = frame ?? Math.min(15, Math.floor(time / DURATION_SEC * 16));
    // A cyclic TIME sample closes held-flight/field/status loops without a reset.
    const held = (kind === 'projectile' || meta.durationOwner === 'engine') && f >= 4 && f <= 11;
    const shaderTime = held ? .8 + .28 * Math.sin((f - 4) / 7 * TAU) : time;
    return renderPixels(size, (x, y, out) => {
      draw(x, y, shaderTime, f, out);
      out[3] *= kind === 'ground' ? 1 - smooth(.77, .8, Math.hypot(x, y)) : edge(x, y);
    });
  } };
}
const groundMeta = { projection: 'ground', footprintWidthRatio: .8, footprintHeightRatio: .8, contentWidthRatio: .8, contentHeightRatio: .8, contentCenterX: .5, contentCenterY: .5 };
const areaSources = [dark('area_dark'), dark('dark_vortex'), dark('dark_ring')];
const projectileSources = [elemental('projectile_core'), dark('dark_ring'), transparent, uvTools, dark('void_ball')];
export const recipes = [
  recipe('attack.poison_bolt', 'projectile', projectileSources, (x,y,t,f,o) => projectile('poison',x,y,t,f,o), { delivery: 'projectile', origin: 'target', orient: true, impactAnchorX: .5, impactAnchorY: .5 }),
  recipe('attack.acid_arrow', 'projectile', projectileSources, (x,y,t,f,o) => projectile('acid',x,y,t,f,o), { delivery: 'projectile', origin: 'target', orient: true, impactAnchorX: .5, impactAnchorY: .5 }),
  recipe('attack.venom_spray', 'cone', [elemental('projectile_core')], spray, { delivery: 'melee', origin: 'caster', anchorY: .875, orient: true, angleDeg: 90, loop: [0,11] }),
  recipe('attack.poison_cloud', 'ground', [dark('area_dark')], cloud, { ...groundMeta, delivery: 'ground', origin: 'target', durationOwner: 'engine' }),
  recipe('attack.catalyst', 'single', [dark('dark_ring')], catalyst, { delivery: 'instant', origin: 'target', loop: [0,11] }),
  recipe('attack.venom_bolt', 'single', [dark('dark_lift'), dark('dark_ring')], venomStrike, { delivery: 'instant', origin: 'target', loop: [0,11] }),
  recipe('attack.chaos_bolt', 'projectile', projectileSources, (x,y,t,f,o) => projectile('chaos',x,y,t,f,o), { delivery: 'projectile', origin: 'target', orient: true, impactAnchorX: .5, impactAnchorY: .5 }),
  recipe('attack.void_blast', 'ground', areaSources, (x,y,t,f,o) => voidEffect('blast',x,y,t,f,o), { ...groundMeta, delivery: 'ground', origin: 'target', loop: [0,11] }),
  recipe('attack.chaos_wave', 'ground', areaSources, (x,y,t,f,o) => voidEffect('wave',x,y,t,f,o), { ...groundMeta, delivery: 'instant', origin: 'caster', loop: [0,11] }),
  recipe('attack.ruin', 'single', areaSources, (x,y,t,f,o) => voidEffect('ruin',x,y,t,f,o), { delivery: 'instant', origin: 'target', loop: [0,11] }),
  recipe('attack.entropy', 'single', [dark('void_core'), dark('dark_ring')], (x,y,t,f,o) => voidEffect('entropy',x,y,t,f,o), { delivery: 'instant', origin: 'target', loop: [0,11] }),
  ...[['weaken','weaken'],['blinding_mark','blind'],['expose','expose'],['cripple','cripple'],['jinx','jinx'],['venom_bind','bind']].map(([id,mode]) =>
    recipe(`curse.${id}`, 'single', [dark('dark_lift'), dark('dark_vortex'), ...(mode === 'bind' ? [dark('dark_ring')] : [])], (x,y,t,f,o) => curse(mode,x,y,t,f,o), { delivery: 'instant', origin: 'target', durationOwner: 'engine' })),
];
