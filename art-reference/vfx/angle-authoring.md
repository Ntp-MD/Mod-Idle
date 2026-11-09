# VFX angle authoring and measurement

The arena has one camera. Every number here comes from
`game/src/presentation/arena-camera.ts` (reference projection) and
`game/src/presentation/arena-view-frame.ts` (painted frame); art must not bake
a second projection on top of it.

## The projection

Top-down north-up orthographic, uniform scale only (`a = d > 0`, `b = c = 0`).
Reference pixels per metre: `140` (`ARENA_CAMERA.projection.a`); the painted
frame scales it by `worldScale × viewportCssWidth / 1920`.

| World axis | Screen pixels per metre at reference (zoom 1, 1920 wide) |
|---|---|
| `+x` | `(140, 0)` |
| `+y` | `(0, 140)` |

Screen `y` grows downward; the view is 1920 × 1080.

- A ground circle of radius `r` draws as a circle of radius `140 r` px at
  zoom 1 (diameter `280 r`), axis-aligned, ratio `1`, tilt `0°`.
- A 2048² ground canvas covers `2 r` metres, so it holds `1024 / r` px per metre.
- An upright height of `h` metres is `92 h` px (`VFX_LIFT_PX_PER_M`); a 0.52 m body lift is 48 px.
- A 0.5 m actor footprint is 70 px wide.

## How to draw each kind

| Kind | Canvas | Draw it | Renderer applies |
|---|---|---|---|
| Ground decal / field | square 2048² | top-down, world `+x` right and world `+y` down the canvas, footprint centre at canvas centre, content scaled to the canvas | one `matrix()` from `groundDecalMatrixForFrame`: diagonal `a = d = 2·(r/ratio)·cssPerM/2048`, `b = c = 0`, centred on the projected footprint |
| Animated ground atlas | square cells, `projection: "ground"` | top-down; centre the circle; equal content width/height ratios describe its radius within the padded cell | the same ground matrix, with padding removed before projection |
| Upright burst / sigil / column | upright | screen-facing; vertical stays vertical, base on the anchor, rises up the canvas | anchor projected, lifted at 92 px/m |
| Line wave | upright | along canvas `+x`, length in metres | rotated to the screen angle of the committed aim |
| Cone / sector | upright | opening up the canvas (`-y`), span from `area.angleDeg` | rotated to aim + 90° |
| Projectile | upright | along canvas `+x`, impact frame upright | rotated along release → impact; `0°` at Impact |
| Single target | upright | symmetric | mirrored when `vfxAim.mirror < 0` |

Never bake an ellipse, tilt, foreshortening or an oblique horizon into a PNG. A baked camera is the
usual reason art matches the reference image but not the arena.

## Screen angle for a world direction

The frame is uniform, so the screen angle equals the world angle:

```
θ = atan2(dy, dx)
```

| World direction | 0° (+x) | 45° | 90° (+y) | 135° | 180° (−x) | 225° | 270° (−y) | 315° |
|---|---|---|---|---|---|---|---|
| Screen angle | 0° | 45° | 90° | 135° | 180° | −135° | −90° | −45° |

Use `arenaScreenAngleFor` / the painted frame rather than a redrawn formula. A uniform
scale preserves angles; lifts offset release/impact vertically on screen only.

## How to measure

1. Open `?sample=combat-field&skill=<id>` at 1920 × 1080, zoom 1, and keep the same viewport for every
   comparison.
2. Ground: read the `.skill-art-decal` transform. `matrix(a b c d …)` must be diagonal
   (`b = c = 0`, `a = d`) with `a = 2·(r/ratio)·cssPerM/2048` for the skill's
   `radiusM`; the drawn shape must measure a `280 r`-px-diameter circle, not an
   ellipse. The footprint telegraph must share its centre and radius — if the art ellipse differs, the art has a baked camera.
3. Direction: cast the eight compass headings. Rotation must match the world aim exactly;
   vertical art must keep vertical edges.
4. Height: a 1 m rise measures 92 px upright; a 0.52 m lift measures 48 px.
5. Anchor: click a ground point; aim marker, decal centre and telegraph centre agree within 1 px, and
   `unprojectArenaPoint(projectArenaPoint(p))` returns `p`.
6. Zoom 0.5 / 0.75 / 1 changes lengths only; rotation and circularity must not change. Reduced motion changes
   amplitude only.

Measure on the page, never from the PNG: a source sheet has no camera, so only the drawn result proves
the projection.

## Image-generation prompt

Use the single source prompt in
[`base-prompt.md`](base-prompt.md). This document owns camera
math and runtime measurement; the prompt file owns generation instructions.
