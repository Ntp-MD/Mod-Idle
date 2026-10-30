# Animation atlas base prompt — 3/4 top-down upright sprites

Base prompt for generated animation sprite atlases (character / monster / actor)
seen at the **agreed camera** (3/4 top-down, 45.92°). Unlike the skill VFX prompt,
an actor is an **upright sprite**, not a ground footprint: the camera sees the
head/shoulders from above, but the body stays vertical and only the base touches
the projected ground. Copy the template, fill the `__...__` slots, send to the
generator. Do not change the camera numbers; they are measured from
`game/src/presentation/arena-camera.ts`.

## Agreed camera

- **Target: 3/4 top-down, ~45–55° band.**
- **Selected / implemented value: 45.92°** — the measured arena camera. This is
  the angle we committed to; keep it unless the renderer changes.

## Camera contract (measured, do not edit)

- **Agreed camera: 45.92°** (3/4 top-down band ~45–55°; the committed value).
- Effective elevation: **45.92°** (3/4 top-down band ~45–55°).
- Projection matrix (screen = M · world, y down): **M = [[137.5274, 32.7446], [−26.1957, 98.2339]]**.
- The actor is an **upright 2D sprite** facing the camera-plane; the view shows the
  top of the head and shoulders foreshortened by the camera, not a ground plane.
- Ground foreshortening applies only to the **base/feet contact**: the foot ellipse
  is minor/major **0.7183** with major axis at **11.75°** from horizontal (tilted);
  world Y compresses to **0.718** of X.
- 8 facings on the ground plane: `S SE E NE N NW W SW` (clockwise, south first).
  Facing is a presentation sector; aim/range still read the sim's world facing.
- **Facing sectors are NOT uniform in world space.** The screen sectors are 45° wide
  (centred at screen angle 0°, 45°, 90°, …), but their world-space centres are
  **14.93°, 68.20°, 103.39°, 319.64°** (and their opposites) because the projection
  does not preserve angles. A facing labelled `east` is centred on the screen sector
  at 0°, not on world 90°.

## Base prompt

```text
Top-down 3/4 fantasy game character animation atlas (sprite sheet), transparent
background, no UI, no text, no frame, no watermark.

CAMERA / PROJECTION CONTRACT (must hold):
- The actor is an upright 2D sprite viewed by an oblique parallel (orthographic)
  camera at 45.92 degrees above the ground; NOT a true top-down and NOT perspective.
- The body stays vertical; only the feet/base contact the ground plane.
- Projection matrix: screen = [[137.5274, 32.7446], [-26.1957, 98.2339]] · world
  (y down).
- The foot ellipse on the ground is minor/major ratio 0.7183 with major axis at
  11.75 degrees from horizontal (tilted, not flat). Ground angles are world-space
  and projected, never drawn on screen.

ATLAS GRID:
- Grid: __[columns]__ columns x __[rows]__ rows, each cell __[cellW]__ x __[cellH]__ px
  (e.g. 8 columns x 5 rows of 128x128 cells on a 1024x640 canvas).
- Rows are pose strips, left to right in frame order. Fill every cell; no gaps.
- Feet/ground contact at the same y within every cell; the actor does not drift.

DIRECTIONS (row 0):
- 8 facings, clockwise, south first: S SE E NE N NW W SW.
- Facing changes the silhouette and shading, NOT a rotation or mirror of one view.
- The 8 screen sectors are 45 degrees wide (centred at screen angle 0, 45, 90, ...
  degrees); their world-space centres are non-uniform: 14.93, 68.20, 103.39,
  319.64 degrees (and opposites). Do not assume 45-degree world steps.

POSE STRIPS (remaining rows), fill the ones you need:
- __[walk / run]__: __[N]__ frames, east and west strips (a locomotion clip).
- __[attack / skill]__: __[N]__ frames, east and west strips (windup-release-recovery).
- __[hit]__: __[N]__ frames, east and west (recoil).
- __[death]__: __[N]__ frames, east and west (collapse to ground).
- Any other clip from the manifest phase set: idle, walk, turn, windup, release,
  recovery, channel, hit, death, despawn.

CHARACTER:
- __[Describe the actor: species/class, silhouette, weapons, key details]__.
- Consistent size and proportion across all cells and frames; single character.
- Style: __[pixel art | painted]__ matching the ModWorld arena palette:
  __[palette / accent colors]__.

QUALITY:
- Sharp clean edges, no noise, no grain, no motion blur, no lens flare.
- Keep the whole character inside every cell; no cropping or clipping.
- Identical ground-contact line across the whole atlas.
```

## Filling the slots

- **Grid and cell size** follow the atlas target from `tools/` / the meta contract
  (see `art-reference/monsters/beast/harpy/animation/meta.json` for an 8x5 example).
- **Rows** map to the pose strip order the manifest expects. `docs/animation.md` and
  `game/src/ui/combat/animation/manifest.ts` own the phase set: idle, walk, turn,
  windup, release, recovery, channel, hit, death, despawn.
- **Facing convention** matches the character turntable: south/front = 0, east = 90,
  north = 180, west = 270 (see `art-reference/players/.../manifest.json`).
- **Feet pivot** must sit at y = 0 in metres (root pivot) with ground contact fixed,
  per `docs/animation.md`.

## Verification

Generated atlases are candidates. Keep them under `art-reference/animation/outputs/`
until approved. Check: (1) every cell is filled and identically sized, (2) the
ground-contact line is constant across frames, (3) facings read as distinct
silhouettes (not mirrored), (4) pose strips line up with the sim beats (windup →
release → recovery), (5) no crop/clip. Report numeric fit separately from visible
quality. Do not copy into `game/public/` or reference in code until approved.
