# Skill VFX image-generation prompt

This is the single source for prompts that generate skill VFX artwork. Keep camera, projection,
atlas, and scale rules here. Add each skill's visual identity in the marked slot; do not copy these
rules into a second prompt document.

This prompt controls source artwork. The game owns the final camera projection. See
[`angle-authoring.md`](angle-authoring.md) for projection math and runtime checks.
Paste a skill-specific visual description into the marked slot.

## Fill these fields before generation

- Skill id and name: `[id, name]`
- Render mode: `[GROUND or UPRIGHT; choose one]`
- Effect form: `[circle, field, burst, sigil, column, line, cone, projectile, or single-target]`
- Canonical geometry: `[radiusM, lengthM, widthM, angleDeg, heightM as relevant]`
- Painted content bounds: `[content.widthRatio, content.heightRatio from atlas metadata]`
- Canvas and delivery: `[exact cell size, frame count, grid or one image per frame]`
- Frame order and beat: `[index and one visible change per frame]`
- Skill visual identity: `[element, shape language, material, palette, motion]`

Use canonical geometry to preserve the skill's shape and direction. Do not ask the image model to
convert metres to pixels. Metadata content ratios define how much of each cell the painted effect
occupies. Ground circles use equal width and height ratios.

## Camera clauses

Insert exactly one clause below into the prompt. Never send both.

### GROUND

> Create unprojected artwork for a flat ground-plane effect, viewed in a true orthographic plan view.
> The camera looks straight down, perpendicular to the ground plane at 90 degrees. Canvas +X points
> right and canvas +Y points down. This is source texture, not a screenshot of the game. The runtime
> applies the oblique arena projection once. Do not bake camera tilt, ellipse compression,
> foreshortening, isometric perspective, horizon, visible side faces, or a second projection.

### UPRIGHT

> Create screen-facing upright effect artwork. Vertical features stay vertical on screen. Keep the
> effect upright and separate from the ground plane. Do not bake the arena projection, ground-plane
> ellipse, horizon, or cast-shadow perspective. The runtime projects the anchor and applies height.

## Copy-ready prompt

```text
Create the specified original ModWorld skill VFX artwork. Return only the requested transparent
image or atlas. Follow the target contract exactly.

TARGET
- Skill: [id and name]
- Render mode: [GROUND or UPRIGHT]
- Effect form and canonical geometry: [shape and relevant geometry fields]
- Painted content bounds: [widthRatio and heightRatio from metadata]
- Canvas and frame layout: [exact dimensions and frame count/order]
- Anchor: [exact normalized point, usually cell center for ground effects]
- Frame beats: [one short visual state per frame]

CAMERA
[Insert exactly one camera clause: GROUND or UPRIGHT.]

SKILL VISUAL IDENTITY
[Describe only this skill's element, silhouette, material, palette, and motion.]

CONSISTENCY
- Keep camera, cell framing, anchor, and source scale fixed across frames.
- Change the effect only as specified by the frame beats; do not move the root.
- Keep every frame inside its own cell. No frame may cross into another cell.
- Keep the visible painted bounds consistent with the supplied metadata ratios.
- Do not add actors, scenery, text, UI, labels, grid lines, borders, or unrelated effects.
- Do not add gameplay range, targets, impacts, or status cues absent from the skill description.
```

## Use

Choose the render mode from the destination renderer before generating. Ground art must be straight
down because the game adds its oblique projection. Upright art uses a separate screen-facing clause.
Do not try to make one image both ground-projected and screen-facing.

For a ground circle, author a circle in the source image; the game turns it into the arena ellipse.
For a 3 m gameplay radius, the footprint diameter is 6 m. Use metadata content ratios to set source
cell occupancy; pixel dimensions alone do not set gameplay size.

The atlas is decorative. The simulation and telegraph remain authoritative for hit area and timing.
Review the rendered result in the combat-field showcase at 1920 × 1080, zoom 1; never approve camera
fit from the source PNG alone.
