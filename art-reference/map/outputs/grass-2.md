# Grassland terrain version 2

- Generator: Codex image generator (`image_gen.imagegen`), transparent background, one tile per call.
- Intended layer: complete projected hex terrain; the second tile of the `grass` biome.
- Actual output: 1605 × 980 PNG, RGBA; the four canvas corners are transparent.
- Shape reference: `../geometry/hex-mask.png`.
- Style reference: `game/public/map/terrain/grass-1.png` — the same biome's own tile, for palette, lighting and detail scale only; its composition is not copied.
- Measurement: [grass-2.measurement.json](grass-2.measurement.json), alpha ≥128 convex hull simplified to six vertices.
- Registration: `tools/map-art.py` measured the six ground vertices of this tile and stored them, with its source size and the sampled ground fill `#938518`, in `game/src/ui/map-terrain-footprints.json`.
- Integration: `game/public/map/terrain/grass-2.png`; the biome's original tile is preserved, and this candidate was copied without pixel edits. It is listed under the `grass` biome in `TERRAIN_VARIANTS` (`game/src/ui/map-terrain.ts`), so the generator may place it on any hex of that biome.
- Status: generated, registered and in the map. `node art-reference/map/check-placement.mjs grass-2` reports 16 instances and a maximum vertex error of 1.718e-13 px at width 1024. Typecheck, the game test suite and the map gates pass. The tile was inspected on its own and in the composed map sheet; the integrated-browser pass could not be run, because no browser could be attached from this session.
- Evidence: [grass-2.on-map.png](grass-2.on-map.png) — this tile in place on the generated map sheet; [grass-2.registration.json](grass-2.registration.json) — the measured registration.

## Exact generation prompt

Create ONE new production game asset: a second open grassland terrain tile for a painterly fantasy tabletop hex map. It is a VARIANT of the same biome as the style reference: it must read as the same biome, at the same small scale and in the same palette, but with a clearly different composition.

Image 1 is the EXACT projected ground silhouette and framing reference: the painted ground must fill that hexagon completely and reach all six of its edges, with transparent alpha everywhere outside it. Image 2 is the biome reference only: keep its palette, lighting, brushwork and small detail scale, but do not copy its composition or prop placement.

Use orthographic elevation 38 degrees above the ground, board orientation matching image 1, parallel projection with no vanishing point. Preserve the supplied six-sided footprint instead of making a conventional symmetric isometric hex.

Fill the entire footprint with short green and olive meadow grass, tiny low wildflowers and a few subtle bare-earth patches. Place the scenery in the central area with about 8% clearance from the outer silhouette: three SMALL grey stones, two low grass-and-flower clumps and one short fallen branch, each small enough to read at map scale. Ground reaches all six edges; every stone, clump, branch and its shadow stays inside the silhouette. Keep the central 50% mostly open short grass so the tile stays readable.

Muted natural colours, painterly fantasy illustration, soft top-left lighting. No border, platform thickness, circular base, outer shadow, road, trail, text, marker, UI or backdrop. One tile only, no transparent padding, no reframing, no second rotation.

Transparent RGBA outside the silhouette, opaque ground inside. Render the tile at 1024 x 625 pixels, which is wider than tall, with the hexagon filling the whole canvas edge to edge. Exact polygon vertices clockwise from the upper-right corner on that canvas: (878.5533,78.6473),(1024,391.1473),(657.4467,625),(145.4467,546.3527),(0,233.8527),(366.5533,0).

After the tool returns the image, copy the generated file to this exact path, unmodified, as a PNG:

C:\Users\disda\Desktop\Mod-Idle\art-reference\map\outputs\grass-2.png

Do not create, edit or delete any other file in the repository. When you are done, report only: the final pixel width and height of the copied file, whether the corners outside the hexagon are genuinely transparent, and the absolute path you wrote.

