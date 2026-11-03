# VFX angle authoring and measurement

The arena has one camera. Every number here comes from
`game/src/presentation/arena-camera.ts`; art must not bake a second projection on top of it.

## The projection

World basis `{ xx: 42, xy: 10, yx: -8, yy: 30 }`, scaled by
`70 / (0.5 × hypot(42, -8)) = 3.2745`:

| World axis | Screen pixels per metre |
|---|---|
| `+x` | `(137.53, -26.20)` |
| `+y` | `(32.75, 98.23)` |

Screen `y` grows downward; the view is 1920 × 1080.

- A ground circle of radius `r` draws as an ellipse with semi-axes `141.43 r` and `101.59 r` px at
  zoom 1: full axes `282.9 r × 203.2 r`, major axis tilted `−2.29°` (up to the right), ratio `0.718`.
- A 2048² ground canvas covers `2 r` metres, so it holds `1024 / r` px per metre.
- An upright height of `h` metres is `92 h` px (`VFX_LIFT_PX_PER_M`); a 0.52 m body lift is 48 px.
- A 0.5 m actor footprint is 70.7 px wide.

## How to draw each kind

| Kind | Canvas | Draw it | Renderer applies |
|---|---|---|---|
| Ground decal / field | square 2048² | top-down, world `+x` right and world `+y` down the canvas, footprint centre at canvas centre, content scaled to the canvas | one `matrix()`; for reach `r` (`area.radiusM`, or `area.lengthM` on a line): `a 0.134304 r`, `b -0.025582 r`, `c 0.031977 r`, `d 0.095932 r` |
| Animated ground atlas | square cells, `projection: "ground"` | top-down; centre the circle; equal content width/height ratios describe its radius within the padded cell | the same ground matrix, with padding removed before projection |
| Upright burst / sigil / column | upright | screen-facing; vertical stays vertical, base on the anchor, rises up the canvas | anchor projected, lifted at 92 px/m |
| Line wave | upright | along canvas `+x`, length in metres | rotated to the screen angle of the committed aim |
| Cone / sector | upright | opening up the canvas (`-y`), span from `area.angleDeg` | rotated to aim + 90° |
| Projectile | upright | along canvas `+x`, impact frame upright | rotated along release → impact; `0°` at Impact |
| Single target | upright | symmetric | mirrored when `vfxAim.mirror < 0` |

Never bake the ellipse, tilt, foreshortening or an oblique horizon into a PNG. A baked camera is the
usual reason art matches the reference image but not the arena.

## Screen angle for a world direction

For a world direction `(x, y)` the screen angle in degrees is

```
θ = atan2(-26.20 x + 98.23 y, 137.53 x + 32.75 y)
```

| World direction | 0° (+x) | 45° | 90° (+y) | 135° | 180° (−x) | 225° | 270° (−y) | 315° |
|---|---|---|---|---|---|---|---|---|
| Screen angle | −10.78° | 22.93° | 71.57° | 130.10° | 169.22° | −157.07° | −108.43° | −49.90° |

The inverse is `unprojectArenaVector({ x: cos θ, y: sin θ })` with `det = U·Z − V·W = 14367.6 px²`.
Use the function rather than a redrawn formula. A world heading is not a screen angle: `0°` east draws
at −10.78°.

## How to measure

1. Open `?sample=combat-field&skill=<id>` at 1920 × 1080, zoom 1, and keep the same viewport for every
   comparison.
2. Ground: read the `.skill-art-decal` transform. `matrix(a b c d …)` must match the table above for the
   skill's `radiusM`; the drawn ellipse must measure `282.9 r × 203.2 r` px, tilted −2.29°. The
   footprint telegraph must share its centre and axes — if the art ellipse differs, the art has a baked
   camera.
3. Direction: cast the eight compass headings. Rotation must match the table within 1°; vertical art
   must keep vertical edges.
4. Height: a 1 m rise measures 92 px; a 0.52 m lift measures 48 px.
5. Anchor: click a ground point; aim marker, decal centre and telegraph centre agree within 1 px, and
   `unprojectArenaPoint(projectArenaPoint(p))` returns `p`.
6. Zoom 0.5 / 0.75 / 1 changes lengths only; angle and tilt must not change. Reduced motion changes
   amplitude only.

Measure on the page, never from the PNG: a source sheet has no camera, so only the drawn result proves
the projection.

## Image-generation prompt

Use the single source prompt in
[`base-prompt.md`](base-prompt.md). This document owns camera
math and runtime measurement; the prompt file owns generation instructions.
