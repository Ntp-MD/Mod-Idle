# ModWorld map artwork — agent brief

## Read first

Use this kit to create a single reviewable asset. This is an art reference kit, not a trained model. Read `geometry/hex-spec.json`, `references/index.json` and the prompt for the requested asset type before generating. Resolve paths relative to this folder.

The authoritative geometry comes from `game/src/ui/map/map-projection.ts`; renderer integration is in `tools/map.ts`. Files in this kit are generated snapshots. If the projection changed, run `refresh.ps1` from PowerShell before using the kit. Read any `integrationWarnings` in `manifest.json`.

## Visual direction

Painterly fantasy otherworld tabletop diorama. Muted natural colours, readable small forms, top-left lighting, coherent scale. Human settlements are medieval fantasy human villages/towns/cities. No modern infrastructure, sci-fi, photorealistic landscape backgrounds, UI symbols, labels or unrequested roads. Do not add display plinths, circular figure bases or thick tile platforms unless explicitly requested.

## Choose exactly one asset contract

1. **Complete projected hex terrain:** ground and small scenery already composed inside the projected hex. Use `geometry/hex-mask.png` as the exact shape/framing reference. Ground reaches every edge; everything outside is transparent. Keep all vegetation, branches and shadows inside the silhouette with breathing room. Do not use a conventional symmetric isometric hex in place of the supplied shape.
2. **Surface texture for a mesh:** flat top-down material without baked perspective, hex shape, trees, rocks, shadows or platform edges. The renderer projects and bounds it. Never apply the complete-hex prompt to this texture.
3. **Separate object/figure:** transparent cutout depicting the shared elevated camera view; its ground-contact anchor is explicit. Do not include terrain, a tile, pedestal or circular base. A raster cutout has a baked view; arbitrary camera rotation requires additional views.

Camera terminology: orthographic/parallel, three-quarter overhead, isometric-like. Use the actual numeric values from `geometry/hex-spec.json`, not the word “isometric” alone. Board yaw is a renderer convention; the shape mask is the reliable framing instruction. Do not rotate a finished projected tile a second time.

## Reference roles

- The mask controls shape, framing and ground footprint.
- The original forest controls painterly treatment and colours only. Its tall freeform silhouette is unsuitable as a complete hex tile.
- Forest version 1 demonstrates smaller trees and composition. Its raw generated silhouette approximates the template and was registered by the renderer; it is not a perfect uncorrected geometry reference or a verified camera reference.
- A numbered guide is explanatory only. Never reproduce its labels, crosshair or outlines in artwork.

## Deliver and validate

- Generate one asset, inspect it, then place it in the actual map before generating a set.
- Keep originals. Use `<name>-1.png`, `<name>-2.png`, etc.; find the next unused number. Never silently overwrite or delete an earlier attempt.
- Save candidates in `outputs/`. State actual raster dimensions, format and whether alpha is genuinely transparent. Requested dimensions are not proof of delivered dimensions.
- For a complete hex, measure six ground vertices clockwise from the upper-right vertex in actual image pixels. Record source width/height and a sampled opaque ground fill; see `examples/footprint-format.json`. Never copy coordinates from a different asset.
- Assess ground fit and object perspective separately. Report measured errors and any missing checks; do not infer success from a prompt or metadata.
- A path in this folder does not activate an asset. Repository integration uses `game/src/ui/map/map-terrain.ts`, `game/src/ui/map/data/map-terrain-footprints.json` and the generated map. Follow workspace instructions for implementation and verification.
- Do not claim a full map conversion, correct shadows, arbitrary-angle support or successful browser verification unless those have actually been implemented and checked.

Use `review/checklist.md` for acceptance. If image generation is unavailable, say so; do not reuse an old image or provide a masked copy as if it were newly generated art.
