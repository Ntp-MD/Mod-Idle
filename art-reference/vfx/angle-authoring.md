# VFX angle authoring and measurement

The arena has one camera. Every number here comes from
`game/src/presentation/arena-camera.ts` (reference projection) and
`game/src/presentation/arena-view-frame.ts` (painted frame); art must not bake
a second projection on top of it.

## The projection

North-up orthographic at **33 degrees above the horizontal ground plane**.
The camera's vertical ground scale is `sin(33°) ≈ 0.544639` of its horizontal scale;
`b = c = 0`. `ARENA_CAMERA_ELEVATION_DEG` owns the angle.
Reference pixels per metre: `140` (`ARENA_CAMERA.projection.a`); the painted
frame scales it by `worldScale × viewportCssWidth / 1920`.

| World axis | Screen pixels per metre at reference (zoom 1, 1920 wide) |
|---|---|
| `+x` | `(140, 0)` |
| `+y` | `(0, 76.249465)` |

Screen `y` grows downward; the view is 1920 × 1080.

- A ground circle of radius `r` draws as an axis-aligned ellipse at zoom 1:
  width `280 r` px, height `280 r × sin(33°)` px, height/width ratio `0.544639`.
- A 2048² ground canvas covers `2 r` metres, so it holds `1024 / r` px per metre.
- An upright height of `h` metres is `92 h` px (`VFX_LIFT_PX_PER_M`); a 0.52 m body lift is 48 px.
- A 0.5 m actor footprint is 70 px wide.

## How to draw each kind

| Kind | Canvas | Draw it | Renderer applies |
|---|---|---|---|
| Ground decal / field | square 2048² | top-down, world `+x` right and world `+y` down the canvas, footprint centre at canvas centre, content scaled to the canvas | one `matrix()` from `groundDecalMatrixForFrame`: diagonal `a = 2·(r/ratio)·cssPerM/2048`, `d = a·sin(33°)`, `b = c = 0`, centred on the projected footprint |
| Animated ground atlas | square cells, `projection: "ground"` | top-down; centre the circle; equal content width/height ratios describe its radius within the padded cell | the same ground matrix, with padding removed before projection |
| Upright burst / sigil / column | upright | screen-facing; vertical stays vertical, base on the anchor, rises up the canvas | anchor projected, lifted at 92 px/m |
| Line wave | upright | along canvas `+x`, length in metres | rotated to the screen angle of the committed aim |
| Cone / sector | upright | opening up the canvas (`-y`), span from `area.angleDeg` | rotated to aim + 90° |
| Projectile | upright | along canvas `+x`, impact frame upright | rotated along release → impact; `0°` at Impact |
| Single target | upright | symmetric | mirrored when `vfxAim.mirror < 0` |

Never bake an ellipse, tilt, foreshortening or an oblique horizon into a PNG. A baked camera is the
usual reason art matches the reference image but not the arena.

Ground textures use the camera matrix for both placement and shape. Screen-facing
atlas artwork projects its root through that matrix, then uses uniform world zoom
for its painted axes. Camera elevation must not squash the sprite or require edits
to its metadata. Falling rain sprites and fragments use the same billboard rule;
their impact rings remain on the projected ground plane.

## Screen angle for a world direction

The camera compresses the ground Y axis, so the screen angle is:

```
θ = atan2(dy × sin(33°), dx)
```

| World direction | 0° (+x) | 45° | 90° (+y) | 135° | 180° (−x) | 225° | 270° (−y) | 315° |
|---|---|---|---|---|---|---|---|
| Screen angle | 0° | ≈28.574° | 90° | ≈151.426° | 180° | ≈−151.426° | −90° | ≈−28.574° |

Use `arenaScreenAngleFor` / the painted frame rather than a redrawn formula.
Lifts offset release/impact vertically on screen only.

## How to measure

1. Open `?sample=combat-field&skill=<id>` at 1920 × 1080, zoom 1, and keep the same viewport for every
   comparison.
2. Ground: read the `.skill-art-decal` transform. `matrix(a b c d …)` must be diagonal
   (`b = c = 0`, `d/a = sin(33°)`) with `a = 2·(r/ratio)·cssPerM/2048` for the skill's
   `radiusM`; the drawn ellipse must measure `280 r` px wide and `280 r × sin(33°)` px high.
   The footprint telegraph must share its centre and bounds; a different ratio indicates a baked camera.
3. Direction: cast the eight compass headings. Rotation must match the world aim exactly;
   vertical art must keep vertical edges.
4. Height: a 1 m rise measures 92 px upright; a 0.52 m lift measures 48 px.
5. Anchor: click a ground point; aim marker, decal centre and telegraph centre agree within 1 px, and
   `unprojectArenaPoint(projectArenaPoint(p))` returns `p`.
6. Zoom 0.5 / 0.75 / 1 changes lengths only; rotation and ellipse ratio must not change. Reduced motion changes
   amplitude only.

Measure on the page, never from the PNG: a source sheet has no camera, so only the drawn result proves
the projection.

## Per-skill artwork

Agree the visual direction with the user for each skill before generating artwork.
Ask about unresolved art choices and reuse answers already given. Use the camera
math and runtime measurements in this document to check the artwork in the arena.

The [VFX component library scope](../../docs/vfx-component-library.md) records the
14-family, seven-palette inventory, composition method and agent handoff.
