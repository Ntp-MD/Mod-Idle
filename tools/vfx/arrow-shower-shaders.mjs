import { clamp, smooth, fbm, over, renderPixels, TAU } from './shader-math.mjs';

const HIT = 'art-reference/VFX-Godot/HitFXFree/assets/BinbunVFX_Vol2/StylizedHitFX/';
const PROJECTILE = 'art-reference/VFX-Godot/MagicProjectilesVFX/assets/BinbunVFX/shared/shader/';
const gold = [1, .65, .17], pale = [1, .96, .74], steel = [.72, .86, .98];
const band = (value, width) => 1 - smooth(width * .65, width, Math.abs(value));

/** One authored +X arrow per real payload; Godot mask materials adapted to CPU raster. */
function render(size, seconds, frame) {
  const impact = frame >= 12, age = (frame - 12) / 3;
  const phase = Math.max(0, frame - 4) / 8 * TAU;
  return renderPixels(size, (x, y, out) => {
    if (Math.max(Math.abs(x), Math.abs(y)) > .94) return;
    if (impact) {
      const fade = (1 - age) ** 1.4;
      if (fade <= 0) return;
      const r = Math.hypot(x, y), a = Math.atan2(x, y);
      // impact_core.fragment: polar radius offset, moving factor and edge threshold.
      const warped = r + Math.abs(Math.sin(a * 3.5 + age)) * r * .5
        + Math.sin(a * 10) * r * .1;
      const factor = (.3 + age * .63) * 4 - 1;
      const core = (1 - Math.abs(warped * 2 - factor)) * Math.max(1 - warped, 0) ** .1;
      const grain = fbm(x * 14 + age * 2, y * 14 - age);
      over(out, gold, Math.exp(-r * r / .07) * fade * .42);
      over(out, [1, .46 + grain * .36, .12 + grain * .3],
        smooth(.24, .5, core) * (.28 + grain * .65) * fade);
      // four_point_star.fragment: powered Lp cross, with explicit alpha decay.
      const scale = .24 * (1 - age * .55);
      const star = 1 - smooth(.7, 1, Math.abs(x / scale) ** .5 + Math.abs(y / scale) ** .5);
      over(out, pale, star * fade);
      for (let i = 0; i < 9; i++) {
        const theta = i / 9 * TAU + .23, radius = .15 + age * .56;
        const dx = x - Math.cos(theta) * radius, dy = y - Math.sin(theta) * radius;
        const along = dx * Math.cos(theta) + dy * Math.sin(theta);
        const across = -dx * Math.sin(theta) + dy * Math.cos(theta);
        over(out, i % 2 ? pale : gold,
          band(along, .055 * (1 - age * .4)) * band(across, .013) * fade);
      }
      return;
    }
    const charge = frame < 4 ? .3 + frame * .22 : 1;
    // transparent.gdshader: scrolling mask multiplied by a tapered strip mask.
    // Authored analytic UVs replace the pack's arrow mesh and sampled mask textures.
    const length = smooth(-.93, -.72, x) * (1 - smooth(.32, .52, x));
    const taper = .025 + clamp((x + .93) / 1.4) * .055;
    const noise = fbm(x * 11 + Math.cos(phase) * .18, y * 10 + Math.sin(phase) * .18);
    const mask = band(y, taper) * length * (.4 + noise * .6);
    over(out, gold, Math.exp(-y * y / .009) * length * charge * .19);
    over(out, gold, mask ** 2 * charge * .64);
    over(out, pale, band(y, .012) * length * charge * .75);
    const shaft = smooth(-.52, -.49, x) * (1 - smooth(.47, .5, x)) * band(y, .018);
    over(out, [.24, .34, .43], shaft * charge);
    over(out, pale, shaft * band(y + .006, .007) * charge);
    const head = smooth(.38, .4, x) * (1 - smooth(.71, .73, x))
      * (1 - smooth(Math.max(0, (.73 - x) * .42) - .008, Math.max(0, (.73 - x) * .42), Math.abs(y)));
    over(out, y < 0 ? steel : [.31, .48, .63], head * charge);
    over(out, pale, head * band(y + (.73 - x) * .32, .012) * charge * .8);
    over(out, pale, head * band(y, .012) * charge);
    over(out, pale, Math.exp(-((x - .68) ** 2 + y * y) / .002) * charge * .8);
    for (const side of [-1, 1]) {
      const feather = smooth(-.68, -.65, x) * (1 - smooth(-.43, -.4, x));
      const centre = side * (.025 + (-x - .4) * .32);
      over(out, pale, feather * band(y - centre, .026) * charge);
      over(out, gold, feather * band(y - centre, .009) * charge);
    }
    for (let i = 0; i < 6; i++) {
      const px = -.8 + i * .19, py = Math.sin(phase + i * 2.4) * .095;
      const grain = Math.exp(-((x - px) ** 2 / .0007 + (y - py) ** 2 / .00008));
      over(out, i % 2 ? pale : gold, grain * charge * .7);
    }
  });
}

export const licenseFiles = [HIT + 'license.txt'];
export const recipes = [{
  id: 'attack.arrow_shower', version: 'v3', kind: 'projectile', render,
  sources: [PROJECTILE + 'transparent.gdshader', HIT + 'shader/impact_core.gdshader', HIT + 'shader/four_point_star.gdshader'],
  adaptation: 'One steel arrow, feathered nock and gold scrolling-mask wake per committed shot; polar impact core and Lp star adapted from supplied Godot shaders. CPU value noise/analytic geometry; no Godot scene render.',
  meta: { delivery: 'projectile', origin: 'target', orient: true,
    opening: [0, 3], loop: [4, 11], exit: [12, 15], frameMs: 70,
    anchorX: .5, anchorY: .5, impactAnchorX: .5, impactAnchorY: .5,
    contentWidthRatio: .9, contentHeightRatio: .82 },
}];
