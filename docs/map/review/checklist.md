# One-asset acceptance checklist

## Before generation

- [ ] Read the asset contract and each input image's reference role.
- [ ] Refresh the kit if projection changed; inspect `manifest.json` for warnings.
- [ ] Choose full hex, flat surface texture, or separate object/figure explicitly.
- [ ] Select a new numbered filename. Keep every original.

## Inspect the delivered file

- [ ] Record actual width, height, file format and alpha support.
- [ ] Transparency is real, not black/white/checkerboard painted into the image.
- [ ] Subject, lighting, palette and scale match the brief.
- [ ] No unrequested text, bases, borders, roads, shadows outside the tile or extra tiles.
- [ ] Full hex only: identify all six ground vertices in actual image pixels, upper-right first, clockwise.
- [ ] Full hex only: opaque ground reaches the footprint edges; vegetation stays clear of the silhouette.
- [ ] Check object perspective separately; a matching base does not prove a matching camera.

## Repository integration

- [ ] Copy the selected asset into the appropriate `game/public/map/` directory with a numbered filename.
- [ ] Full hex only: record measured dimensions/vertices and sampled `groundFill` required by the current renderer. Do not reuse another image's measurements.
- [ ] Select the asset through the terrain catalogue. Merely storing a PNG does not activate it.
- [ ] Run the relevant generator and required checks under the repository's working agreement.
- [ ] Inspect the actual map in the integrated browser at 1920 × 1080; use Hex alignment to compare all six corners, all edges and the centre.
- [ ] Check internal seams, clipping of trees, front/back ordering and figure ground contact.
- [ ] Report numeric vertex fit separately from visible pixel-edge quality and object perspective. Renderer registration can align control points without proving either of the latter.
- [ ] Obtain visual feedback on this one type before producing the next batch.

Keep review evidence with the candidate. Do not label it accepted solely because a generator, typecheck or M15 passes.
