# Animation art base prompt — project-owned frame contract

This template is for sprite-frame artwork. It is not a runtime, rig, timing or gameplay
specification. Fill the target contract from the destination metadata before generation;
do not leave a generator to guess the canvas, frame order, facing labels, anchor or equipment
mode. Prefer one pose per image and let project tools pack the cells. Use one atlas image
only when the target pipeline explicitly requires it.

## Source of truth

- Identity, phase names, feet pivot and presentation-only markers: `docs/animation.md` and
  `game/src/ui/combat/animation/manifest.ts`.
- Standard 8×5 `pilotArt` cell map: `game/src/ui/combat/arena/arena-art-pixel-v2.ts`.
- Live equipped-player body frames, feet lines and separate equipment layers:
  `game/src/ui/combat/arena/arena-equipped-player.ts` and
  `game/src/ui/combat/arena/player-equipment-v1.json`.
- Runtime ground projection: `game/src/presentation/arena-camera.ts`.

If the destination uses another format, use that destination's exact frame map and metadata.
The standard 8×5 map below is not universal, and an unused clip must not be added to its grid.

## Ground-camera reference

The arena renderer stores an affine ground projection, not a 3D camera angle. Its full matrix
is authoritative; **45.92° is an effective elevation** derived from the ground ellipse.

- Ground-vector projection at canonical 1920×1080:
  **M = [[137.5274, 32.7446], [−26.1957, 98.2339]]** (screen Y points down).
- M maps world-plane displacement vectors to canonical screen pixels per world metre.
  World points also receive the arena origin and camera-follow translation.
- A ground circle's principal minor/major ratio is **0.7183**; its screen major axis is
  **−2.29°** and world-space principal direction is **11.75°**. Projected world-axis length
  ratio `|M·Y| / |M·X|` is **0.7396**.
- The matrix is for ground positions and footprints. **Do not skew, rotate or scale the whole
  upright actor by this matrix or by the 0.7183 ground-ellipse ratio.** The character image
  stays upright; only its root/feet are placed at the projected ground point.
- Runtime facing is a world-space radian angle with `0 = +X`; the camera maps it to one of
  eight equal screen-facing sectors. Direction names in the frame map are presentation labels,
  not numeric bearings from a turntable.
- Runtime sector-index order is `E, SE, S, SW, W, NW, N, NE`; the standard `pilotArt` source
  atlas idle-cell order below is `S, SE, E, NE, N, NW, W, SW`. These orders intentionally
  differ. Use the target frame map, not one order as a substitute for the other.
- World +X appears at screen angle **−10.78°** and +Y at **+71.57°**. Runtime facing-sector
  world centres in screen-label order `E, SE, S, SW, W, NW, N, NE` are approximately
  **14.93°, 68.20°, 103.39°, 139.64°, 194.93°, 248.20°, 283.39°, 319.64°**. These values
  are for runtime mapping only; do not use them as sprite-generation bearings.

The player turntable manifest records requested bearings and explicitly says its exact rendered
azimuths are unverified. Use its images for pose/style review only, not as runtime angle data.

## Required target contract — fill before generation

```text
ACTOR AND DESTINATION
- Actor/species id: __[canonical id]__.
- Destination pipeline: __[standard pilotArt atlas | equipped-player body frames | other]__.
- Runtime art metadata / output owner: __[exact file or metadata path]__.
- Delivery mode: __[one transparent PNG per pose | one atlas PNG]__.
- Source canvas and cell/frame dimensions: __[exact width × height from destination metadata]__.
- Frame map: __[every output index → clip, direction label, pose name; row-major if atlas]__.
- Root/anchor: __[exact cell/source-pixel coordinates per required clip/direction, and meaning:
  feet | floating core]__.
- Equipment mode: __[baked into the pose | separate runtime layers]__.
- If equipment is separate: __[measured main-grip and offhand-grip coordinates per required
  pose/direction]__. If the target uses a projectile/release socket, include its measured
  coordinate and provenance. Sockets are attachment points, never hitboxes.
- Style and palette reference: __[approved project image/path and concise traits]__.

POSES
- Clip and direction: __[exact clip + named screen-facing label]__.
- This frame's action/beat: __[one concrete pose; state whether it loops]__.
- Neighboring frames: __[previous → this → next pose, to keep continuity]__.
- Allowed root/scale exception, if any: __[exact frame and reason, or “none”]__.
```

Do not use an example cell size as a default. Source image cells and runtime `frameCanvas`
sizes can differ; copy both from the target metadata. If the requested dimensions, frame map,
anchor or equipment mode are unknown, resolve them before generating.

## Standard `pilotArt` atlas map

Use this map only when the selected destination is a standard `pilotArt` 8-column × 5-row,
40-frame atlas. The cell size and source canvas still come from that actor's metadata.
Indices start at the top-left and increase left-to-right, then top-to-bottom:

| Row | Cell mapping, left to right |
|---|---|
| 0 | Idle: south, south-east, east, north-east, north, north-west, west, south-west |
| 1 | East walk 4 frames, then west walk 4 frames |
| 2 | East attack 4 frames, then west attack 4 frames |
| 3 | East hit 4 frames, then west hit 4 frames |
| 4 | East death 4 frames, then west death 4 frames |

Do not assume the composer's default map matches this map. For a different frame order, provide
the exact custom frame map to the packing tool. The composer's default is five action rows ×
eight directions, which is a different cell order; use its `--map` option for this `pilotArt`
map. For a target that is not `pilotArt`, replace this table with its actual metadata map; do
not squeeze extra clips into these cells.

## Copy, fill, and send

```text
Create the specified original ModWorld character sprite frame. Follow the supplied target
contract exactly. Return only the requested transparent image(s). Do not draw grid lines,
cell dividers, captions, labels, UI, a floor, platform, cast shadow or watermark.

TARGET CONTRACT — paste the completed contract here, including the exact frame map:
__[actor id, destination pipeline, delivery mode, dimensions, frame index/action/direction/pose
map, root/anchor, equipment mode and any measured sockets]__.

CAMERA AND ROOT
- Draw an upright 2D character in the project's readable 3/4 fantasy view. The body faces
  the named screen-facing direction; do not interpret that label as a world-angle number.
- Ground projection describes root placement only. Keep the whole character upright and
  undistorted. Do not apply ground ellipse compression to its body.
- Grounded pose: place the specified foot/root anchor exactly on the supplied baseline.
  Keep that per-clip/per-direction anchor fixed across its frames unless the pose map lists
  deliberate movement. Do not impose one shared source-pixel Y if the destination metadata
  specifies different foot lines. Floating pose: keep the supplied core/root at the same point.
  Apply only explicitly listed jump, fall, death or squash/stretch exceptions.
- Show a distinct 3/4 silhouette for each named facing. Do not rotate, mirror or recolor one
  view to fabricate another direction.

FRAME AND POSE
- Draw only the actor and the clip/frame listed in the target contract.
- Keep the same torso/head/core proportions and source-pixel scale across frames. Change the
  pose by moving joints, limbs, expression, cape, tail or wings; do not resize the whole actor.
- Weapons, shields, claws, tails, wings and attack reach may change the outer silhouette.
  They must not change the scale of the stable body. Keep the full pose inside the supplied
  frame bounds with transparent clearance for the packing tool.
- Pose phases and order come from the supplied frame map and `docs/animation.md`. Do not add
  frames, directions, attacks or equipment that are absent from the target contract.
- Clip images are presentation only. The simulation owns start, release, impact, recovery,
  damage and rewards. Never invent timing or gameplay facts in the artwork.

EQUIPMENT
- If equipment is baked into this sprite, draw only the exact equipment listed for this actor.
- If equipment is a separate runtime layer, draw the body pose without that weapon/shield.
  Preserve the specified main-hand/offhand grip positions so runtime equipment can attach.
  Do not paint a duplicate item into the body image. Do not invent grip or release sockets;
  their coordinates must be measured or supplied by the destination metadata.

STYLE / ALPHA
- Style: __[pixel art | painted]__, matching the approved reference and palette in the contract.
- Pixel art: hard pixel clusters, crisp alpha, no antialiasing, blur, resampling or soft halo.
- Painted art: preserve the reference's edge treatment; no unintended glow, color spill or crop.
- Keep one actor only. Keep all anatomy/equipment inside its frame; no pose may spill into a
  neighboring frame. Death/floating effects may change shape only as explicitly described.
```

## Verification

Keep candidates under `art-reference/animation/outputs/` until review. Run only the structural
checker supported by the selected target pipeline, then review a color contact sheet and a
same-anchor silhouette sheet. Check the body/core scale separately from weapons, wings, tails
and pose reach; alpha-box height alone is not a body-scale measurement. Finally preview the real
clip in the arena at 1920×1080 and verify feet/root placement, facing, equipment sockets and
phase readability.

`tools/monster-animation-qa.py` checks the monster-atlas pipeline's geometry, crop/alpha, padding,
duplicate poses and root drift. Its runtime discovery does not include the equipped-player body
pipeline, and it does not certify body-scale consistency. A prompt or QA `PASS` alone does not
approve an image. Promote only after the target metadata and in-game visual review agree.
