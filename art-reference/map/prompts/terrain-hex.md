# Complete projected hex terrain

Attach `../geometry/hex-mask.png` as image 1. Attach a style reference listed in `../references/index.json` as image 2. Replace bracketed fields; do not send unresolved placeholders to the generator.

```text
Create ONE new production game asset: [TERRAIN TYPE] for a painterly fantasy tabletop hex map.

Image 1 is the exact ground silhouette and framing reference. Image 2 is ONLY a style and palette reference; do not copy its framing, geometry or composition.

Use orthographic elevation [camera.elevationDegrees from hex-spec.json] degrees above the ground, with the board orientation matching image 1. Parallel projection, no vanishing point. Preserve the supplied six-sided footprint instead of making a conventional symmetric isometric hex.

Fill the entire footprint with [GROUND MATERIAL]. Place [SMALL SCENERY AND COUNT] in the central area, maintaining about 8% clearance for scenery from the outer silhouette. Ground itself must reach all six edges. All branches, rocks and shadows stay inside the silhouette. Keep the ground readable and avoid overcrowding.

Muted natural colours, painterly fantasy illustration, top-left lighting. No border, platform thickness, circular base, outer shadow, road, text, marker, UI or backdrop. One tile only. Transparent RGBA outside the silhouette; opaque ground inside. Reference canvas [canvas.width] × [canvas.height] pixels. Do not add transparent padding or reframe the tile.
```

Forest starting values: ground = moss, grass and earth; scenery = three small pine trees with a few small stones. Match the original forest's painterly treatment. Do not copy its oversized tree composition.

Prompt precision does not guarantee geometric precision. Measure the output and follow the review checklist before activation.
