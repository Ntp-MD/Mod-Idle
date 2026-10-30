# Skill VFX base prompt — 3/4 top-down arena camera

This is the single base prompt for generated skill VFX artwork in the combat
arena. It bakes in the **agreed camera** (3/4 top-down, 45.92°) so generated
effects match the ground plane the game actually projects. Copy it, fill the
slots marked `__...__`, and send it to the image generator. Do not change the
numbers in the CAMERA / PROJECTION section; they are measured from
`game/src/presentation/arena-camera.ts`.

## Agreed camera

- **Target: 3/4 top-down, ~45–55° band.**
- **Selected / implemented value: 45.92°** — the measured arena camera. This is
  the angle we committed to; keep it unless the renderer changes.

## Camera contract (measured, do not edit)

- **Agreed camera: 45.92°** (3/4 top-down band ~45–55°; the committed value).
- Effective elevation: **45.92°** above the ground plane.
- Projection matrix (screen = M · world, y down): **M = [[137.5274, 32.7446], [−26.1957, 98.2339]]**.
- Ground foreshortening: world **Y is compressed to 0.718** of world X.
- A circle on the ground renders as an ellipse, **minor/major axis ratio 0.7183**,
  with its **major axis at 11.75°** from horizontal (the ellipse is tilted, not flat).
- World axis directions on screen: **East = −10.78°, North = +71.57°**.
- The ground projection is **not conformal**: the East→North screen angle is **82.35°**, not 90°.
- A 90° world cone shows as **72.8°** when facing East and **107.2°** when facing North.
  Angles must be defined in world space and projected; never draw the angle as seen on screen.
- World→screen angle (for verification): world 0°→−10.78°, 45°→22.93°, 90°→71.57°,
  135°→130.10°, 180°→169.22°, 225°→−157.07°, 270°→−108.43°, 315°→−49.90°.

## Base prompt

```text
Top-down 3/4 fantasy game skill VFX asset, single centered effect,
transparent background, no UI, no text, no frame, no watermark.

CAMERA / PROJECTION CONTRACT (must hold):
- The ground is a flat horizontal plane viewed by an oblique parallel
  (orthographic) camera at 45.92 degrees above the ground; it is NOT a true
  top-down and NOT a perspective camera.
- Projection matrix: screen = [[137.5274, 32.7446], [-26.1957, 98.2339]] · world
  (y down).
- Ground is foreshortened: the world Y axis is compressed to 0.718 of world X.
- A circle on the ground must render as an ellipse with minor/major axis ratio
  0.7183 and major axis at 11.75 degrees from horizontal (tilted, not flat).
- World axis directions on screen: East = -10.78 degrees, North = +71.57 degrees.
- Angles are defined in WORLD SPACE on the ground plane, then projected.
  A 90-degree ground wedge is NOT 90 degrees on screen (it reads ~73 degrees
  facing East, ~107 degrees facing North). Never draw the angle as seen on screen.
- Objects (flames, shards, glyphs, particles) stand upright and their base
  follows the ground plane; only the footprint deforms with the projection.

SHAPE / FOOTPRINT:
- Skill area on the ground: __[circle | cone | line]__.
- Full ground angle: __[e.g. 90 | 120]__ degrees (world space, clamped 1-180).
- Direction on the ground plane: __[0 = south/front, 90 = east, 180 = north,
  270 = west]__ degrees (world space).
- Footprint size: __[radius or length]__ meters, __[width]__ meters (line only).

EFFECT:
- __[Describe the skill: element, color, motion, e.g. "arcane frost cone",
  "120-degree flame cleave sweep", "poison spray fan", "earth fissure line"]__.
- Single readable silhouette; clean edges; moderate detail; readable at small size.
- Style: __[pixel art | painted]__ consistent with the ModWorld arena palette:
  __[palette / accent colors]__.

QUALITY:
- Sharp clean edges, no noise, no grain, no lens flare, no motion blur.
- Keep the whole effect inside the canvas; do not crop or clip it.
```

## Filling the slots

- **Shape / angle / direction** come from the skill row in `tools/data/skills.json`
  (`area.shape`, `area.angle_deg`, `area.length_m` / `area.width_m`). The
  direction is the world-space aim (see `engine/skill-area.ts`), not a screen angle.
- **Direction convention** matches the character turntable
  (`art-reference/players/concepts/one-handed-sword-direction-proof/manifest.json`):
  south/front = 0, east = 90, north = 180, west = 270.
- **Style** should follow the game's existing arena/player art. When unsure,
  generate two small variants and compare before producing a batch.

## Verification

Generated files are candidates only. Keep them under `art-reference/skill-vfx/outputs/`
until approved. Measure the delivered footprint (circle ellipse ratio, cone
spread) against the numbers above and report numeric fit separately from
visible quality — a convincing render does not prove a matching projection.
Do not copy into `game/public/` or reference it in code until approved.
