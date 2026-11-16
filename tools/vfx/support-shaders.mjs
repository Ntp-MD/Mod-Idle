/** CPU adaptations of Binbun's CC0 support-compatible Godot shaders.
 * Shader masks, Fresnel rims, overlay noise, polar waves and scrolling streaks are
 * evaluated into transparent RGBA. Analytic UV surfaces replace Godot meshes;
 * value noise replaces sampled textures. No 3D depth fade or mesh lighting.
 * Aura assets are presentation prototypes: reserve toggles do not emit arena marks.
 */
import { clamp, smooth, fract, hash, fbm, over, renderPixels, TAU, DURATION_SEC } from './shader-math.mjs';

const BATTLE = 'archive/art-reference/VFX-Godot/BattleFXFree/assets/BinbunVFX_Vol2/BattleFX/shader/';
const DARK = 'archive/art-reference/VFX-Godot/DarkMagicFXFree/assets/BinbunVFX_Vol2/DarkMagicFX/shader/';
const ELEMENT = 'archive/art-reference/VFX-Godot/ElementalMagicFXFree/assets/BinbunVFX_Vol2/ElementalMagicFX/shader/';
const LOOT = 'archive/art-reference/VFX-Godot/GodotLootVFX/assets/BinbunVFX/loot_effects/src/shader/';
const FIRE = 'archive/art-reference/VFX-Godot/FlameFXFree/assets/BinbunVFX_Vol2/FlameFX/shader/';
const ELECTRIC = 'archive/art-reference/VFX-Godot/ElectricFXFree/assets/BinbunVFX_Vol2/ElectricFX/shader/';
export const licenseFiles = [BATTLE, DARK, ELEMENT, FIRE, ELECTRIC].map(p => p.replace(/shader\/$/, 'license.txt'));
const overlay = (a, b) => a < .5 ? 2 * a * b : 1 - 2 * (1 - a) * (1 - b);
const line = (v, width = .025) => 1 - smooth(width * .45, width, Math.abs(v));
const ring = (r, radius, width = .025) => line(r - radius, width);
const fade = (t) => (.12 + .88 * smooth(0, .16, t)) * (1 - smooth(.68, 1, t));
const tint = (c, v) => c.map(n => clamp(n + v * .35));
const colors = {
  gold: [1, .66, .12], red: [1, .11, .035], iron: [.52, .69, .78], holy: [1, .89, .46],
  ghost: [.27, .91, .85], earth: [.69, .43, .15], arcane: [.47, .39, 1], energy: [.15, .72, 1],
  heal: [.29, 1, .57], fire: [1, .27, .035], cold: [.3, .83, 1], lightning: [.75, .58, 1],
};

// shield_shell.fragment: smooth Fresnel rim minus effect_decay; a sphere UV is
// reconstructed from its screen-facing circle so the interior stays transparent.
function shell(out, x, y, radius, c, life, clock, faceted = false) {
  const dx = x / radius, dy = y / (radius * 1.08), r = Math.hypot(dx, dy);
  if (r >= 1) return;
  const fresnel = 1 - Math.sqrt(Math.max(0, 1 - r * r));
  const rim = smooth(0, 1, fresnel);
  const n = fbm(dx * 4 + clock * .15, dy * 4 - clock * .25);
  // shield_surface.fragment: double overlay noise, two threshold passes, wave + Fresnel.
  const sn = overlay(n, fbm(dx * 8 + 3, dy * 8 - clock * .5));
  const value = .5 * smooth(.5, 1, sn) + .5 * Math.pow(smooth(0, .5, sn), 1.5);
  const wave = Math.sin((Math.atan2(dy, dx) / TAU + dy) * TAU * 4 + clock * 4) * .4 + .6;
  over(out, tint(c, rim), (rim * .72 + value * wave * .13) * life);
  if (faceted) {
    const cellX = dx * 7, cellY = dy * 7;
    const grid = Math.min(Math.abs(fract(cellX + cellY * .5) - .5), Math.abs(fract(cellY * .866) - .5));
    over(out, tint(c, .5), (1 - smooth(.018, .05, grid)) * (.14 + rim * .65) * life);
  }
}

// shield_aura.fragment: polar triangular mask raised to power 12 and overlay noise.
function halo(out, x, y, radius, c, clock, life, width = .12) {
  const r = Math.hypot(x, y), a = Math.atan2(y, x);
  const mask = Math.pow(Math.max(1 - Math.abs((r - radius) / width), 0), 3);
  const n = fbm(Math.cos(a) * 5 + clock * .2, Math.sin(a) * 5 + clock * .4);
  const value = smooth(.2, .4, overlay(mask, n));
  over(out, tint(c, value * .5), value * life);
}

// shield_orbit.fragment: noise minus edge mask. The source's rotating ribbon
// geometry becomes a circular UV ribbon, never a baked ground-plane ellipse.
function orbit(out, x, y, radius, c, clock, life, count = 3, reverse = false) {
  const r = Math.hypot(x, y), a = Math.atan2(y, x);
  const u = a / TAU + (reverse ? -clock : clock) / TAU;
  const edgeMask = smooth(0, .6, Math.abs((r - radius) / .055));
  const n = fbm(Math.cos(a) * 7 + clock * .3, Math.sin(a) * 7 - clock * .2);
  const v = smooth(0, .8, n - edgeMask);
  const arc = smooth(-.1, .45, Math.sin(u * TAU * count));
  over(out, tint(c, .5), v * arc * life);
}

// glow_tube.fragment: squared triangular scroll gradient, cubic facing factor
// and repeated detail streaks. The billboard remains vertical.
function streams(out, x, y, c, clock, life, count = 5, width = .44, height = 1.5, spiral = false) {
  const h = (.75 - y) / height;
  if (h <= 0 || h >= 1) return;
  const gradient = 1 - Math.abs(fract(h * 1.8 - clock / TAU) * 2 - 1);
  for (let i = 0; i < count; i++) {
    const u = count === 1 ? 0 : i / (count - 1) * 2 - 1;
    const cx = u * width + (spiral ? Math.sin(h * TAU * 1.2 + clock + i) * .11 : 0);
    const dx = (x - cx) / (.018 + .006 * (i % 2));
    const fresnel = Math.pow(Math.max(1 - dx * dx, 0), 1.5);
    const detail = Math.sqrt(Math.abs(fract(h * (4 + i % 3) - clock / TAU) * 2 - 1)) * 2 - 1.4;
    const glow = smooth(.01, .3, gradient * gradient * fresnel * Math.max(detail, .06));
    over(out, tint(c, .7), glow * Math.sin(h * Math.PI) * life);
  }
}

function star(out, x, y, cx, cy, size, c, life, rotate = 0) {
  const dx = x - cx, dy = y - cy;
  const u = (dx * Math.cos(rotate) - dy * Math.sin(rotate)) / size;
  const v = (dx * Math.sin(rotate) + dy * Math.cos(rotate)) / size;
  // particle_star.fragment's repeated UV corner-distance produces a four-point star.
  const a = Math.pow(clamp(1 - Math.sqrt(Math.abs(u * v)) * 2 - Math.hypot(u, v) * .3), 2);
  over(out, tint(c, .8), a * life);
}

function particles(out, x, y, c, clock, life, count = 8, upward = true) {
  for (let i = 0; i < count; i++) {
    const phase = fract(i * .618 + clock / TAU);
    const cx = (hash(i, 4) * 2 - 1) * .66;
    const cy = upward ? .7 - phase * 1.42 : Math.sin(i * 2.4 + clock) * .6;
    if (Math.abs(x - cx) > .1 || Math.abs(y - cy) > .1) continue;
    star(out, x, y, cx, cy, .055 + hash(i, 8) * .025, c, Math.sin(phase * Math.PI) * life);
  }
}

// cast_flare.fragment: sin(grow) fade-gradient, four lobes and terminal glow.
function flare(out, x, y, c, clock, life, lobes = 4) {
  const r = Math.hypot(x, y), a = Math.atan2(y, x);
  const fg = clamp(1 - r / .8);
  const wave = Math.max(Math.sin((fg + .06) * Math.PI) * fg, 0);
  const n = fbm(Math.cos(a) * 5 + clock * .1, Math.sin(a) * 5 + r * 4 - clock * .3);
  const value = smooth(.2, .8, n * wave) * (Math.cos(a * lobes + clock * .3) * .5 + .5);
  const core = Math.pow(clamp(1 - r / .16), 2);
  over(out, tint(c, .6), (value + core * .8) * life);
}

// area_dark/void_aura.fragment: radial two-frequency waves disturb polar noise,
// with central power falloff and five-fold subtractive streaks.
function voidField(out, x, y, c, clock, life, hollow = false, lobes = 5) {
  const r = Math.hypot(x, y) / .82;
  if (r >= 1) return;
  const a = Math.atan2(y, x);
  const wave = Math.sin(r * 5 - clock * 2) + Math.sin(r * 9 - clock * 2);
  const n = fbm(Math.cos(a) * 3 + wave * .05, Math.sin(a) * 3 + r * 2 + clock * .2);
  let value = n + Math.pow(1 - r, 4) * 1.5;
  value *= Math.sqrt(1 - r);
  value -= (Math.sin(a * lobes + clock) * .5 + .5) * .2;
  value = smooth(0, 1, value);
  value = overlay(value, value * value);
  over(out, tint(c, value * .4), value * (hollow ? smooth(.15, .6, r) : 1) * life);
}

function rune(out, x, y, c, clock, life, sides = 6, radius = .59) {
  const r = Math.hypot(x, y), a = Math.atan2(y, x) - clock * .12;
  const polygon = r * Math.cos(fract(a / TAU * sides + .5) * TAU / sides - Math.PI / sides);
  over(out, c, line(polygon - radius * Math.cos(Math.PI / sides), .017) * life);
  over(out, tint(c, .4), ring(r, radius * 1.14, .014) * life * .65);
  const ticks = Math.abs(Math.sin(a * sides * 2));
  const band = smooth(radius * .82, radius * .84, r) * (1 - smooth(radius * .98, radius, r));
  over(out, tint(c, .5), (1 - smooth(.08, .19, ticks)) * band * life);
}

function flame(out, x, y, c, clock, life, count = 5) {
  for (let i = 0; i < count; i++) {
    const cx = (i - (count - 1) / 2) * .2;
    const height = 1.05 + .22 * Math.sin(i * 2 + clock);
    const h = (.71 - y) / height;
    if (h < 0 || h > 1) continue;
    const dx = (x - cx) / (.12 * (1 - h) + .025) + Math.sin(h * 10 - clock * 2 + i) * .35;
    const mask = Math.max(1 - Math.hypot(dx, (h - .35) / .7), 0);
    const n = fbm(dx * 2 + i, h * 4 - clock * .6);
    const value = clamp((mask * 4 - (1 - n)) / 4);
    over(out, tint(c, value), smooth(.16, .3, value) * life);
  }
}

// zap.vertex's multi-frequency triangular waves reconstruct an upright lightning path.
function zap(out, x, y, cx, c, clock, life, length = 1.35) {
  const h = (.68 - y) / length;
  if (h <= 0 || h >= 1) return;
  const tri = (v) => Math.abs(fract(v) * 2 - 1) - .5;
  const wave = (tri(h * 6 + clock / TAU) + tri(h * 9 - clock / TAU + .3)) * .13;
  const edge = Math.abs(x - cx - wave);
  over(out, c, (1 - smooth(.014, .04, edge)) * Math.sin(h * Math.PI) * life * .6);
  over(out, tint(c, 1), (1 - smooth(.006, .015, edge)) * life);
}

function shieldShape(out, x, y, c, life, radius = .58) {
  const ax = Math.abs(x), top = -.54;
  if (y < top || y > .67) return;
  const w = y < -.12 ? radius : radius * (1 - (y + .12) / .83);
  const d = Math.abs(ax - w);
  const edge = Math.max(line(d, .029), y < top + .025 && ax < radius ? 1 : 0);
  if (ax < w) {
    const n = overlay(fbm(x * 6, y * 6), fbm(x * 12, y * 12));
    const surface = .5 * smooth(.5, 1, n) + .5 * Math.pow(smooth(0, .5, n), 1.5);
    over(out, c, surface * life * .14);
  }
  over(out, c, edge * life);
  over(out, tint(c, .3), (1 - smooth(0, .025, ax)) * smooth(top, top + .1, y) * (1 - smooth(.5, .63, y)) * life * .65);
}

const descriptors = [
  ['buff.warcry', 'buff', 'warcry', 'gold', [BATTLE + 'shield_aura.gdshader', ELEMENT + 'cast_flare.gdshader']],
  ['buff.berserker', 'buff', 'rage', 'red', [FIRE + 'fire_core.gdshader']],
  ['buff.iron_will', 'buff', 'iron', 'iron', [BATTLE + 'shield_shell.gdshader', BATTLE + 'shield_surface.gdshader']],
  ['buff.holy_veil', 'buff', 'veil', 'holy', [BATTLE + 'shield_shell.gdshader', LOOT + 'particle_star.gdshader']],
  ['buff.ghost_dance', 'buff', 'ghost', 'ghost', [BATTLE + 'shield_orbit.gdshader']],
  ['buff.earth_wall', 'buff', 'wall', 'earth', [BATTLE + 'shield_surface.gdshader', BATTLE + 'shield_shell.gdshader']],
  ['buff.magia_drive', 'buff', 'drive', 'arcane', [LOOT + 'glow_tube.gdshader', ELEMENT + 'cast_flare.gdshader']],
  ['buff.energy_absorb', 'buff', 'absorb', 'energy', [BATTLE + 'shield_orbit.gdshader', BATTLE + 'shield_shell.gdshader']],
  ['buff.flame_guard', 'buff', 'flameguard', 'fire', [FIRE + 'fire_core.gdshader', BATTLE + 'shield_shell.gdshader']],
  ['heal.heal', 'heal', 'heal', 'heal', [LOOT + 'glow_tube.gdshader', LOOT + 'particle_star.gdshader']],
  ['heal.greater_heal', 'heal', 'greater', 'holy', [ELEMENT + 'cast_flare.gdshader', LOOT + 'glow_tube.gdshader']],
  ['heal.cleanse', 'heal', 'cleanse', 'ghost', [BATTLE + 'shield_aura.gdshader', LOOT + 'particle_star.gdshader']],
  ['aura.wraith_of_fury', 'aura', 'fury', 'red', [DARK + 'void_aura.gdshader', BATTLE + 'shield_orbit.gdshader']],
  ['aura.clarity', 'aura', 'clarity', 'energy', [LOOT + 'glow_tube.gdshader', ELEMENT + 'cast_flare.gdshader']],
  ['aura.haste', 'aura', 'haste', 'gold', [BATTLE + 'shield_orbit.gdshader']],
  ['aura.vitality', 'aura', 'vitality', 'heal', [LOOT + 'glow_tube.gdshader', LOOT + 'particle_star.gdshader']],
  ['aura.herald_of_ash', 'aura', 'ash', 'fire', [FIRE + 'fire_core.gdshader', BATTLE + 'shield_orbit.gdshader']],
  ['aura.herald_of_frost', 'aura', 'frost', 'cold', [BATTLE + 'shield_shell.gdshader', LOOT + 'particle_star.gdshader']],
  ['aura.herald_of_lightning', 'aura', 'thunder', 'lightning', [ELECTRIC + 'zap.gdshader', BATTLE + 'shield_orbit.gdshader']],
  ['aura.ember_conversion', 'aura', 'ember', 'fire', [FIRE + 'fire_core.gdshader', LOOT + 'particle_star.gdshader']],
  ['aura.rime_conversion', 'aura', 'rime', 'cold', [BATTLE + 'shield_aura.gdshader', LOOT + 'particle_star.gdshader']],
  ['aura.storm_conversion', 'aura', 'storm', 'lightning', [ELECTRIC + 'zap.gdshader', ELEMENT + 'cast_flare.gdshader']],
  ['aura.cast_on_crit', 'aura', 'crit', 'gold', [LOOT + 'particle_star.gdshader', BATTLE + 'shield_aura.gdshader']],
  ['aura.cast_on_damage_taken', 'aura', 'taken', 'arcane', [ELEMENT + 'cast_flare.gdshader', BATTLE + 'shield_surface.gdshader']],
  ['aura.rimbo_form', 'aura', 'rimbo', 'ghost', [DARK + 'area_dark.gdshader', DARK + 'void_aura.gdshader']],
  ['aura.elemental_fury', 'aura', 'elemental', 'lightning', [DARK + 'void_aura.gdshader', ELEMENT + 'cast_flare.gdshader']],
  ['aura.trinity_form', 'aura', 'trinity', 'holy', [BATTLE + 'shield_shell.gdshader']],
  ['aura.grace', 'aura', 'grace', 'ghost', [LOOT + 'particle_star.gdshader']],
  ['aura.iron_guard', 'aura', 'ironguard', 'iron', [BATTLE + 'shield_surface.gdshader', BATTLE + 'shield_shell.gdshader']],
  ['aura.energy_guard', 'aura', 'energyguard', 'energy', [BATTLE + 'shield_shell.gdshader', BATTLE + 'shield_aura.gdshader']],
];

function paint(mode, c, out, x, y, t, clock, life) {
  const r = Math.hypot(x, y);
  switch (mode) {
    case 'warcry': {
      for (let i = 0; i < 3; i++) halo(out, x, y, .2 + .55 * fract(t * 1.2 + i / 3), c, clock, life * (.8 - i * .12), .055);
      // A three-pronged rising shout crown, separate from shield anatomy.
      const crownY = -.28 - .3 * smooth(0, .35, t);
      for (const dx of [-.32, 0, .32]) {
        const h = (.32 - y) / (.32 - crownY);
        if (h > 0 && h < 1) over(out, tint(c, .5), line(x - dx * h, .025) * Math.sin(h * Math.PI) * life);
      }
      break;
    }
    case 'rage':
      flame(out, x, y, c, clock * 1.5, life, 3);
      for (const s of [-1, 1]) over(out, [1, .53, .06], line(x - s * (.18 + Math.abs(y) * .32), .023) * (1 - smooth(.35, .75, Math.abs(y))) * life);
      break;
    case 'iron': shell(out, x, y, .68, c, life, clock, true); shieldShape(out, x, y, tint(c, .4), life); break;
    case 'veil':
      shell(out, x, y, .69, c, life * .55, clock);
      particles(out, x, y, c, clock, life, 9);
      over(out, [1, 1, .83], Math.max(line(x, .028) * (1 - smooth(.2, .44, Math.abs(y + .2))), line(y + .2, .028) * (1 - smooth(.1, .24, Math.abs(x)))) * life);
      break;
    case 'ghost':
      for (let i = 0; i < 3; i++) {
        const a = clock + i * TAU / 3;
        const cx = Math.cos(a) * .39, cy = Math.sin(a) * .45;
        const d = Math.hypot((x - cx) / .17, (y - cy) / .3);
        over(out, c, (ring(d, .8, .16) + Math.max(1 - d, 0) * .15) * life * .75);
      }
      orbit(out, x, y, .66, c, clock, life, 3); break;
    case 'wall': {
      for (let i = -2; i <= 2; i++) {
        const cx = i * .25, top = -.24 - (.21 - Math.abs(i) * .055) * smooth(0, .35, t);
        const width = .108, d = Math.max(Math.abs(x - cx) - width, Math.max(top - y, y - .65));
        if (d < .018) {
          const noise = overlay(fbm(x * 16 + i * 3, y * 9), fbm(x * 32 + i * 3, y * 18));
          const n = .5 * smooth(.5, 1, noise) + .5 * Math.pow(smooth(0, .5, noise), 1.5);
          const edge = Math.min(Math.abs(Math.abs(x - cx) - width), Math.abs(y - top));
          over(out, tint(c, n * .35), (1 - smooth(-.005, .018, d)) * life * (.45 + n * .35));
          over(out, [1, .74, .35], (1 - smooth(.008, .023, edge)) * life * .8);
        }
      }
      break;
    }
    case 'drive': streams(out, x, y, c, clock * 1.4, life, 7, .4, 1.5, true); rune(out, x, y, tint(c, .4), clock * 2, life, 8); flare(out, x, y, c, clock, life * .4, 8); break;
    case 'absorb':
      shell(out, x, y, .61, c, life * .65, clock);
      for (let i = 0; i < 5; i++) { const a = i * TAU / 5 + clock * .2, rad = .72 - .47 * fract(t * 2 + i * .2); star(out, x, y, Math.cos(a) * rad, Math.sin(a) * rad, .09, c, life); }
      orbit(out, x, y, .44, c, -clock, life, 5); break;
    case 'flameguard': shell(out, x, y, .67, c, life * .7, clock); flame(out, x, y, c, clock, life * .8, 5); break;
    case 'heal': streams(out, x, y, c, clock, life, 5, .34); particles(out, x, y, c, clock, life, 8); break;
    case 'greater':
      streams(out, x, y, c, clock, life, 9, .53, 1.6, true); halo(out, x, y, .63, c, clock, life * .7, .055); flare(out, x, y + .08, c, clock, life, 8);
      over(out, [1, 1, .8], Math.max(line(x, .04) * (1 - smooth(.22, .48, Math.abs(y))), line(y + .1, .04) * (1 - smooth(.15, .32, Math.abs(x)))) * life); break;
    case 'cleanse': {
      const radius = .13 + .65 * smooth(0, .65, t);
      halo(out, x, y, radius, c, clock, life, .055);
      particles(out, x, y, [1, 1, .9], clock, life, 11);
      // Departing dark motes make the purge read as removal rather than another heal.
      for (let i = 0; i < 7; i++) { const a = i * 2.399; star(out, x, y, Math.cos(a) * radius, Math.sin(a) * radius, .045, [.47, .31, .66], life * .7); }
      break;
    }
    case 'fury': voidField(out, x, y, c, clock, life * .6, true, 3); orbit(out, x, y, .63, c, clock, life, 3); flare(out, x, y, c, clock, life, 3); break;
    case 'clarity':
      streams(out, x, y, c, clock, life * .7, 3, .2, 1.42);
      for (let i = 0; i < 3; i++) halo(out, x, y + .32 - i * .3, .12 + i * .05, c, clock + i, life * .8, .025);
      star(out, x, y, 0, -.52, .15, c, life); break;
    case 'haste':
      orbit(out, x, y, .63, c, clock * 2, life, 6); orbit(out, x, y, .49, c, -clock * 2, life, 4);
      for (let i = 0; i < 3; i++) { const cy = .45 - i * .35; over(out, tint(c, .6), line(y - cy - Math.abs(x) * .65, .023) * (1 - smooth(.32, .46, Math.abs(x))) * life); }
      break;
    case 'vitality':
      streams(out, x, y, c, clock, life, 4, .44, 1.4, true); particles(out, x, y, c, clock, life * .7, 5);
      for (const s of [-1, 1]) { const a = s * (clock * .2 + .6); const dx = (x - s * .29) * Math.cos(a) - y * Math.sin(a), dy = (x - s * .29) * Math.sin(a) + y * Math.cos(a); over(out, c, ring(Math.hypot(dx / .16, dy / .39), .8, .08) * life); }
      break;
    case 'ash': flame(out, x, y, c, clock, life * .8, 5); orbit(out, x, y, .69, c, clock, life, 4); particles(out, x, y, colors.gold, clock, life, 6); break;
    case 'frost':
      shell(out, x, y, .66, c, life * .4, clock);
      for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + clock * .13, cx = Math.cos(a) * .54, cy = Math.sin(a) * .54; star(out, x, y, cx, cy, .15, c, life, a); }
      rune(out, x, y, c, clock, life * .7, 6, .42); break;
    case 'thunder': zap(out, x, y, -.36, c, clock, life); zap(out, x, y, .36, c, -clock, life); orbit(out, x, y, .66, c, clock, life, 4); break;
    case 'ember':
      rune(out, x, y, c, clock, life, 3, .52); flame(out, x, y, c, clock, life * .65, 1);
      for (let i = 0; i < 3; i++) { const a = i * TAU / 3 - clock * .3; star(out, x, y, Math.cos(a) * .53, Math.sin(a) * .53, .07, colors.iron, life); }
      break;
    case 'rime':
      rune(out, x, y, c, -clock, life, 4, .52);
      for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + clock * .2; star(out, x, y, Math.cos(a) * .37, Math.sin(a) * .37, .13, c, life, Math.PI / 4); }
      halo(out, x, y, .22, colors.iron, clock, life, .04); break;
    case 'storm': rune(out, x, y, c, clock, life, 5, .55); zap(out, x, y, 0, c, clock, life, 1.2); flare(out, x, y, c, clock, life * .5, 5); break;
    case 'crit': rune(out, x, y, c, clock, life, 8, .57); star(out, x, y, 0, 0, .34, c, life, Math.PI / 4); halo(out, x, y, .72, c, clock, life * .5, .035); break;
    case 'taken': shieldShape(out, x, y, c, life); rune(out, x, y, c, -clock, life * .7, 4, .63); flare(out, x, y + .12, c, clock, life, 4); break;
    case 'rimbo': voidField(out, x, y, c, clock, life * .8, false, 7); orbit(out, x, y, .69, [.4, .2, .75], -clock, life, 7); rune(out, x, y, c, clock, life * .6, 7); break;
    case 'elemental':
      voidField(out, x, y, c, clock, life * .4, true, 3);
      for (let i = 0; i < 3; i++) { const a = i * TAU / 3 + clock; const cc = [colors.fire, colors.cold, colors.lightning][i]; star(out, x, y, Math.cos(a) * .57, Math.sin(a) * .57, .17, cc, life, a); }
      flare(out, x, y, c, clock, life * .55, 3); break;
    case 'trinity':
      shell(out, x, y, .7, c, life * .35, clock);
      for (let i = 0; i < 3; i++) { const a = Math.atan2(y, x); const cc = [colors.fire, colors.cold, colors.lightning][i]; const segment = smooth(.15, .4, Math.cos(a - i * TAU / 3 - clock * .2)); over(out, cc, ring(r, .61, .04) * segment * life); }
      rune(out, x, y, c, clock, life, 3, .43); break;
    case 'grace':
      for (const side of [-1, 1]) { const dx = (x - side * .24) / .36, dy = (y + .05) / .65; const a = Math.atan2(dy, dx); over(out, c, ring(Math.hypot(dx, dy), .8, .08) * smooth(-.7, .2, side * dx) * life); over(out, tint(c, .3), line(dy - Math.sin(dx * 4 + clock) * .12, .04) * (1 - smooth(.5, .8, Math.abs(dx))) * life * .6); }
      particles(out, x, y, c, clock, life * .6, 5); break;
    case 'ironguard':
      shieldShape(out, x, y, c, life, .5); shell(out, x, y, .7, c, life * .4, clock, true);
      for (let i = -1; i <= 1; i++) over(out, tint(c, .5), line(y - .15 - Math.abs(x) * .38 - i * .2, .02) * (1 - smooth(.33, .48, Math.abs(x))) * life * .7);
      break;
    case 'energyguard': shell(out, x, y, .7, c, life * .8, clock, true); halo(out, x, y, .52, c, clock, life * .65, .04); rune(out, x, y, c, clock, life * .45, 6, .37); break;
  }
}

export const recipes = descriptors.map(([id, kind, mode, colorKey, sources]) => ({
  id, kind, sources,
  adaptation: 'Godot Fresnel/overlay-noise/polar-wave/streak masks on authored personal-support billboard geometry; CPU value noise replaces textures, with no Godot depth fade or mesh render. Aura loop texture coordinates oscillate periodically.',
  render(size, timeSec, frameIndex = Math.round(timeSec / DURATION_SEC * 15)) {
    const t = clamp(timeSec / DURATION_SEC);
    const aura = kind === 'aura';
    // Exactly eight periodic samples form frames 4..11. A sinusoidal clock makes
    // noise coordinates periodic too; scrolling textures gently reverse direction.
    const phase = fract((frameIndex - 4) / 8);
    const clock = aura ? Math.sin(phase * TAU) * 2 : t * TAU;
    const life = aura ? (frameIndex < 4 ? .15 + .85 * smooth(-1, 4, frameIndex) : frameIndex > 11 ? 1 - smooth(11, 15, frameIndex) : 1) : fade(t);
    return renderPixels(size, (x, y, out) => {
      if (Math.abs(x) > .94 || Math.abs(y) > .94) return;
      paint(mode, colors[colorKey], out, x, y, aura ? .5 : t, clock, life);
      // All upright art uses a soft safe border, never a hard crop at the cell edge.
      out[3] *= 1 - smooth(.87, .94, Math.max(Math.abs(x), Math.abs(y)));
    });
  },
  meta: {
    delivery: 'instant', origin: 'target', orient: false, anchorX: .5, anchorY: .5,
    frameMs: 96, opening: [0, 3], loop: kind === 'aura' ? [4, 11] : undefined, exit: [12, 15],
    // Upright personal effects retain screen-space verticals; circles are sigils,
    // shield shells or billboards, never ground decals or baked camera ellipses.
    adaptation: 'CPU Godot shader equations; analytic billboard UVs and value noise; no mesh/depth render',
    presentationEvent: kind === 'aura' ? 'active reservation follows sampled player in Field loop' : 'existing self support cast/buff event',
  },
}));

export default recipes;
