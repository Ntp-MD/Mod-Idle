# Map calibration references

This folder belongs to the single map art template at `art-reference/map/`.
Use the generated geometry as the camera and footprint authority; use these
files to understand how measurement and in-game alignment review were done.

## Camera and angle

The camera pose, projection matrix, canvas ratio, center, and six ordered ground
vertices live in [`../geometry/hex-spec.json`](../geometry/hex-spec.json). That
file is regenerated from `game/src/ui/map-projection.ts` by
[`../refresh.ps1`](../refresh.ps1). The descriptive default view is orthographic,
38 degrees above ground, with board yaw -16 degrees in renderer coordinates.
When the renderer changes, refresh the kit and use the new geometry. Do not
derive or adjust these values by eye from the screenshot in this folder.

## What the calibration files show

- `registration.json` records the measured six ground vertices, source image
  dimensions, and fill for `/map/terrain/forest-relief-1.png`. It verifies the
  triangular-sector mapping for that specific image; it does not measure camera
  perspective or certify the perspective of painted trees and objects.
- `alignment-corrected-1920x1080.png` is an in-game alignment review with the
  Hex alignment overlay enabled. It shows the projected ground outlines over
  installed artwork at 1920 x 1080. Use it to compare placement and seams, not
  as a style reference or a source for camera angles.

## Generation and review

1. Choose the matching prompt from `../prompts/` and attach
   `../geometry/hex-mask.png` for full-hex ground artwork. For dioramas or
   isolated figures, follow the object prompt and do not force a hex silhouette.
2. Keep generated candidates and measurements under `../outputs/` until
   approved. Measure each new full-hex image; never reuse the example vertices
   from `registration.json` for another image.
3. Check the painted view of trees, buildings, and other objects separately.
   A correct ground footprint does not establish that objects follow the
   calibrated camera angle.
4. Compare placement in the game with Hex alignment enabled and use
   `../review/checklist.md` before approving an asset.

Refresh geometry and its generated snapshots from the repository root with:

```powershell
./art-reference/map/refresh.ps1
```
