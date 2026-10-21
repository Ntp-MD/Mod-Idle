# Map terrain artwork contract

The ground projection is owned by `game/src/ui/map-projection.ts`. Run `npm run map -- --write` to regenerate the map and the matching templates in `game/public/map/terrain/templates/`.

The portable [map art reference kit](../art-reference/map/README.md) contains shape references, role-labelled style references, agent briefs and prompts. Its refresh script derives geometry directly from the projection without rebuilding or modifying the live map.

## Full-hex artwork

Public map assets have three top-level folders: `terrain/` for natural ground/scenery and its `templates/`, `landmark/` for settlements, ruins, camps and event scenery, and `characters/` for the player and species. Keep originals alongside numbered versions in their category. Registration is selected by footprint metadata, not by a special directory name. The original-image coverage list is owned by `art-reference/map/source-assets.json`.

Use `terrain-hex.png` or `terrain-hex.svg` as the shape reference. Exact canvas-space vertices and projection matrix are in `terrain-hex.json`; do not transcribe rounded coordinates into renderer code. The reference canvas is 1024 × 625, with its centre at (512, 312.5). It maps to the projected ground bounding rectangle, without alpha cropping or a second camera rotation. Artwork can have a different raster resolution when the same normalized footprint is retained.

The descriptive camera is orthographic, elevation 38° above ground and board yaw −16° in renderer coordinates. Upright vegetation must already depict that view. Keep it inside the footprint for terrain tiles; separate objects can extend above their ground footprint.

The terrain catalogue is `game/src/ui/map-terrain.ts`. Preserve originals and use numbered sibling assets (`forest-relief-1.png`, `forest-relief-2.png`, etc.). Selecting a replacement is an explicit catalogue change; filename numbering does not automatically activate it.

`TERRAIN_ART` holds the tile a biome shows by default. `TERRAIN_VARIANTS` holds the other tiles that same biome may show; the map generator picks one of them per hex, stably, so a stretch of one biome reads as ground instead of one repeated picture. A variant needs its own measured footprint before it may be listed, and the biome's own art is never repeated in its variant list.

Settlements select their art through `LANDMARK_ART` in `tools/map.ts`, whose default town image comes from `TERRAIN_ART.town`. The selected image then uses the same full-hex registration as other terrain. A future landmark variant must be selected there as well as having its asset/footprint available. M15 checks art placement on settlement cells too.

Generated images may approximate the requested polygon. Measure the six ground vertices before activation with the measurement tool, which reads the tile's own silhouette and stores measured pixel coordinates, source dimensions and an opaque ground fill in `game/src/ui/map-terrain-footprints.json`:

```powershell
python tools/map-art.py /map/terrain/forest-relief-1.png
```

It takes the alpha ≥128 silhouette, reduces its convex hull to six corners and matches them against the template hex, so the stored order is the template's own. A recorded ground fill is kept, because the fill is a judgement about the picture; a new tile gets the median colour of the ground inside its own footprint. Re-measuring rewrites only the entries named on the command line.

The generator registers six triangular sectors sharing the measured footprint centre, mapping all six vertices exactly onto the projected hex. An outer ground clip and the ground fill prevent painted edge irregularities and antialias seams from leaving gaps. Because each sector maps its own pair of corners exactly, that fit cannot see a footprint recorded in the wrong rotational order: the generator therefore also measures the footprint against the template hex and refuses a footprint that sits more than 12% of the canvas away, which is the margin between an approximate tile and a mis-ordered one. Keep trees inside the footprint: this registration is for complete terrain tiles, not tall objects that intentionally extend beyond the ground.

Use the development-only **Hex alignment** checkbox under Map tools → Controls to compare the actual artwork with the projected ground outline and centre cross. M15 verifies placement metadata and generated markup, not painted-edge accuracy. Legacy scenery without footprint metadata is not certified by this contract.

## Forest version 1 generation brief

Built-in image generation; shape reference: `game/public/map/terrain/templates/terrain-hex.png`; style reference: the original `game/public/map/terrain/forest-relief.png`.

> One painterly fantasy tabletop forest tile. Match the shape reference's complete projected hex footprint and framing. Orthographic elevation 38°, board yaw −16°. Opaque moss/grass/earth to all six edges, transparent outside. Three small pine trees inside the central area with 8% clearance from the silhouette. Muted greens, top-left lighting. No platform thickness, outer shadow, border, path, buildings, characters or text. Preserve transparent alpha. Requested reference canvas: 1024 × 625; measure the actual output dimensions and footprint before placement.
