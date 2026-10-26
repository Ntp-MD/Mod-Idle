# Settlement variant batch — 10 landmark tiles

One batch brief for the existing per-tier hooks in `tools/map.ts` `LANDMARK_ART` and
`settlement_landmarks` in `tools/data/map.json`. Generate, measure and integrate one
asset first; only continue to the rest after it passes the checklist.

## Shared contract (apply to every prompt below)

- Asset contract: **complete projected hex landmark** (full-hex ground registration, same as terrain).
- Attach `../geometry/hex-mask.png` as image 1; style reference is the installed
  `game/public/map/landmark/town-1.png` (palette/painterly treatment only — do not copy its
  composition). `../references/index.json` lists its role; copy the real file as image 2.
- Camera: orthographic elevation 38°, board yaw −16° (values from `../geometry/hex-spec.json`).
- Reference canvas 1024 × 625; do not pad or reframe.
- Ground must reach all six edges, opaque inside, transparent RGBA outside.
- Buildings sit in the central area with ~8% clearance from the silhouette; all roofs, walls,
  smoke and shadows stay inside the footprint. (Roof spill past the footprint is possible via
  `map-sprite-bounds.json`, but keep batch 1 fully inside — simpler registration.)
- Muted natural colours, painterly fantasy, top-left lighting, medieval human settlements.
- No modern infrastructure, no border, platform thickness, circular base, outer shadow,
  text, markers, UI, backdrop or unrequested roads. One tile only.

## The 10 variants

Filenames are the next free numbers in `game/public/map/landmark/`; candidates first go to
`../outputs/` with the same name. Key = the `LANDMARK_ART` key the asset will use.

| # | Key | Filename | Pattern |
|---|-----|----------|---------|
| 1 | `village-small` | `village-riverside-1.png` | tiny riverside hamlet |
| 2 | `village-medium` | `village-hillside-1.png` | hillside crofts and terraces |
| 3 | `village-large` | `village-market-1.png` | village green with market stalls |
| 4 | `city-small` | `town-palisade-1.png` | small walled burgh |
| 5 | `city-medium` | `town-bridge-1.png` | market town on a river bridge |
| 6 | `town-abbey` | `town-abbey-1.png` | abbey town, great church |
| 7 | `city-large` | `town-keep-1.png` | fortified town with keep |
| 8 | `town-port` | `town-port-1.png` | lakeside trade city with docks |
| 9 | `city-capital` | `capital-cathedral-1.png` | grand capital, cathedral core |
| 10 | `capital-citadel` | `capital-citadel-1.png` | capital citadel on a rock |

Sizes must read as a progression: 1–3 few buildings, no walls; 4–6 dense low town; 7–8 large
walled town; 9–10 the largest, tallest structures in the set.

## Prompts

Replace nothing — these are fully resolved. Camera, framing and canvas values come from
`hex-spec.json` and the contract above.

### 1 — village-small / `village-riverside-1.png`

```text
Create ONE new production game asset: a small riverside hamlet for a painterly fantasy tabletop hex map.

Image 1 is the exact ground silhouette and framing reference. Image 2 is ONLY a style and palette reference; do not copy its framing, geometry or composition.

Use orthographic elevation 38 degrees above the ground, with the board orientation matching image 1. Parallel projection, no vanishing point. Preserve the supplied six-sided footprint instead of making a conventional symmetric isometric hex.

Fill the entire footprint with mossy grass and worn dirt paths. Place four or five thatched timber huts, a tiny wooden jetty and reed beds beside a narrow stream crossing one hex edge, in the central area, maintaining about 8% clearance for scenery from the outer silhouette. Ground itself must reach all six edges. All branches, roofs and shadows stay inside the silhouette. Keep the ground readable and avoid overcrowding.

Muted natural colours, painterly fantasy illustration, top-left lighting. No border, platform thickness, circular base, outer shadow, road, text, marker, UI or backdrop. One tile only. Transparent RGBA outside the silhouette; opaque ground inside. Reference canvas 1024 × 625 pixels. Do not add transparent padding or reframe the tile.
```

### 2 — village-medium / `village-hillside-1.png`

```text
Create ONE new production game asset: a hillside village for a painterly fantasy tabletop hex map.

Image 1 is the exact ground silhouette and framing reference. Image 2 is ONLY a style and palette reference; do not copy its framing, geometry or composition.

Use orthographic elevation 38 degrees above the ground, with the board orientation matching image 1. Parallel projection, no vanishing point. Preserve the supplied six-sided footprint instead of making a conventional symmetric isometric hex.

Fill the entire footprint with grass, earth and small terraced field strips. Place six or seven stone-and-thatch cottages stepped up a gentle rise with low drystone walls, a small well and a few sheep, in the central area, maintaining about 8% clearance for scenery from the outer silhouette. Ground itself must reach all six edges. All branches, roofs and shadows stay inside the silhouette. Keep the ground readable and avoid overcrowding.

Muted natural colours, painterly fantasy illustration, top-left lighting. No border, platform thickness, circular base, outer shadow, road, text, marker, UI or backdrop. One tile only. Transparent RGBA outside the silhouette; opaque ground inside. Reference canvas 1024 × 625 pixels. Do not add transparent padding or reframe the tile.
```

### 3 — village-large / `village-market-1.png`

```text
Create ONE new production game asset: a large market village for a painterly fantasy tabletop hex map.

Image 1 is the exact ground silhouette and framing reference. Image 2 is ONLY a style and palette reference; do not copy its framing, geometry or composition.

Use orthographic elevation 38 degrees above the ground, with the board orientation matching image 1. Parallel projection, no vanishing point. Preserve the supplied six-sided footprint instead of making a conventional symmetric isometric hex.

Fill the entire footprint with worn grass and packed earth. Place eight or nine thatched cottages and barns around a village green with striped market stalls, an open cart shed and a big old oak, in the central area, maintaining about 8% clearance for scenery from the outer silhouette. Ground itself must reach all six edges. All branches, roofs and shadows stay inside the silhouette. Keep the ground readable and avoid overcrowding.

Muted natural colours, painterly fantasy illustration, top-left lighting. No border, platform thickness, circular base, outer shadow, road, text, marker, UI or backdrop. One tile only. Transparent RGBA outside the silhouette; opaque ground inside. Reference canvas 1024 × 625 pixels. Do not add transparent padding or reframe the tile.
```

### 4 — city-small / `town-palisade-1.png`

```text
Create ONE new production game asset: a small walled burgh for a painterly fantasy tabletop hex map.

Image 1 is the exact ground silhouette and framing reference. Image 2 is ONLY a style and palette reference; do not copy its framing, geometry or composition.

Use orthographic elevation 38 degrees above the ground, with the board orientation matching image 1. Parallel projection, no vanishing point. Preserve the supplied six-sided footprint instead of making a conventional symmetric isometric hex.

Fill the entire footprint with trodden earth and sparse grass. Place a compact timber-and-stone town inside a low timber palisade with one gate tower — ten or so small houses with slate and thatch roofs and a single watchtower — in the central area, maintaining about 8% clearance for scenery from the outer silhouette. Ground itself must reach all six edges. All branches, roofs and shadows stay inside the silhouette. Keep the ground readable and avoid overcrowding.

Muted natural colours, painterly fantasy illustration, top-left lighting. No border, platform thickness, circular base, outer shadow, road, text, marker, UI or backdrop. One tile only. Transparent RGBA outside the silhouette; opaque ground inside. Reference canvas 1024 × 625 pixels. Do not add transparent padding or reframe the tile.
```

### 5 — city-medium / `town-bridge-1.png`

```text
Create ONE new production game asset: a market town on a river bridge for a painterly fantasy tabletop hex map.

Image 1 is the exact ground silhouette and framing reference. Image 2 is ONLY a style and palette reference; do not copy its framing, geometry or composition.

Use orthographic elevation 38 degrees above the ground, with the board orientation matching image 1. Parallel projection, no vanishing point. Preserve the supplied six-sided footprint instead of making a conventional symmetric isometric hex.

Fill the entire footprint with cobbled earth and grass banks, with a wide river band crossing two hex edges. Place a stone bridge over the river, a dozen tightly clustered timber-framed houses with tiled roofs, and a small market square with awnings, in the central area, maintaining about 8% clearance for scenery from the outer silhouette. Ground itself must reach all six edges. All branches, roofs and shadows stay inside the silhouette. Keep the ground readable and avoid overcrowding.

Muted natural colours, painterly fantasy illustration, top-left lighting. No border, platform thickness, circular base, outer shadow, road, text, marker, UI or backdrop. One tile only. Transparent RGBA outside the silhouette; opaque ground inside. Reference canvas 1024 × 625 pixels. Do not add transparent padding or reframe the tile.
```

### 6 — key `town-abbey` / `town-abbey-1.png`

```text
Create ONE new production game asset: an abbey town for a painterly fantasy tabletop hex map.

Image 1 is the exact ground silhouette and framing reference. Image 2 is ONLY a style and palette reference; do not copy its framing, geometry or composition.

Use orthographic elevation 38 degrees above the ground, with the board orientation matching image 1. Parallel projection, no vanishing point. Preserve the supplied six-sided footprint instead of making a conventional symmetric isometric hex.

Fill the entire footprint with mown grass and gravel walks. Place a great stone church with a modest tower, a walled cloister garden, a bell house and a dozen small huddled cottages of an abbey village, in the central area, maintaining about 8% clearance for scenery from the outer silhouette. Ground itself must reach all six edges. All branches, roofs and shadows stay inside the silhouette. Keep the ground readable and avoid overcrowding.

Muted natural colours, painterly fantasy illustration, top-left lighting. No border, platform thickness, circular base, outer shadow, road, text, marker, UI or backdrop. One tile only. Transparent RGBA outside the silhouette; opaque ground inside. Reference canvas 1024 × 625 pixels. Do not add transparent padding or reframe the tile.
```

### 7 — city-large / `town-keep-1.png`

```text
Create ONE new production game asset: a fortified town with a keep for a painterly fantasy tabletop hex map.

Image 1 is the exact ground silhouette and framing reference. Image 2 is ONLY a style and palette reference; do not copy its framing, geometry or composition.

Use orthographic elevation 38 degrees above the ground, with the board orientation matching image 1. Parallel projection, no vanishing point. Preserve the supplied six-sided footprint instead of making a conventional symmetric isometric hex.

Fill the entire footprint with cobbled ground and grassy margins outside the walls. Place a stone curtain wall with two gate towers surrounding a strong central keep and two dozen dense timber-and-stone houses with tiled roofs, in the central area, maintaining about 8% clearance for scenery from the outer silhouette. Ground itself must reach all six edges. All branches, roofs and shadows stay inside the silhouette. Keep the ground readable and avoid overcrowding.

Muted natural colours, painterly fantasy illustration, top-left lighting. No border, platform thickness, circular base, outer shadow, road, text, marker, UI or backdrop. One tile only. Transparent RGBA outside the silhouette; opaque ground inside. Reference canvas 1024 × 625 pixels. Do not add transparent padding or reframe the tile.
```

### 8 — key `town-port` / `town-port-1.png`

```text
Create ONE new production game asset: a lakeside trade city for a painterly fantasy tabletop hex map.

Image 1 is the exact ground silhouette and framing reference. Image 2 is ONLY a style and palette reference; do not copy its framing, geometry or composition.

Use orthographic elevation 38 degrees above the ground, with the board orientation matching image 1. Parallel projection, no vanishing point. Preserve the supplied six-sided footprint instead of making a conventional symmetric isometric hex.

Fill the entire footprint with water along two hex edges, stone quays and cobbled earth. Place wooden piers with moored sailing barges, a customs house, warehousing with hoisting beams and a tight block of tall gabled merchants' houses, in the central area, maintaining about 8% clearance for scenery from the outer silhouette. Ground itself must reach all six edges. All branches, roofs and shadows stay inside the silhouette. Keep the ground readable and avoid overcrowding.

Muted natural colours, painterly fantasy illustration, top-left lighting. No border, platform thickness, circular base, outer shadow, road, text, marker, UI or backdrop. One tile only. Transparent RGBA outside the silhouette; opaque ground inside. Reference canvas 1024 × 625 pixels. Do not add transparent padding or reframe the tile.
```

### 9 — city-capital / `capital-cathedral-1.png`

```text
Create ONE new production game asset: the grand capital city of a realm for a painterly fantasy tabletop hex map.

Image 1 is the exact ground silhouette and framing reference. Image 2 is ONLY a style and palette reference; do not copy its framing, geometry or composition.

Use orthographic elevation 38 degrees above the ground, with the board orientation matching image 1. Parallel projection, no vanishing point. Preserve the supplied six-sided footprint instead of making a conventional symmetric isometric hex.

Fill the entire footprint with pale cobbles and small green courts. Place a towering Gothic cathedral with two spires at the centre, surrounded by a dense mass of narrow stone townhouses, a walled palace compound and a column ringed by stalls, in the central area, maintaining about 8% clearance for scenery from the outer silhouette. Ground itself must reach all six edges. All branches, roofs and shadows stay inside the silhouette. Keep the ground readable and avoid overcrowding.

Muted natural colours, painterly fantasy illustration, top-left lighting. No border, platform thickness, circular base, outer shadow, road, text, marker, UI or backdrop. One tile only. Transparent RGBA outside the silhouette; opaque ground inside. Reference canvas 1024 × 625 pixels. Do not add transparent padding or reframe the tile.
```

### 10 — key `capital-citadel` / `capital-citadel-1.png`

```text
Create ONE new production game asset: a capital citadel on a rock for a painterly fantasy tabletop hex map.

Image 1 is the exact ground silhouette and framing reference. Image 2 is ONLY a style and palette reference; do not copy its framing, geometry or composition.

Use orthographic elevation 38 degrees above the ground, with the board orientation matching image 1. Parallel projection, no vanishing point. Preserve the supplied six-sided footprint instead of making a conventional symmetric isometric hex.

Fill the entire footprint with rocky grassland and a stony approach ramp. Place a raised rock outcrop crowned by a walled citadel with drum towers and a great hall banner, ringed at the rock's foot by tightly packed slate-roofed houses and a small barbican, in the central area, maintaining about 8% clearance for scenery from the outer silhouette. Ground itself must reach all six edges. All branches, roofs and shadows stay inside the silhouette. Keep the ground readable and avoid overcrowding.

Muted natural colours, painterly fantasy illustration, top-left lighting. No border, platform thickness, circular base, outer shadow, road, text, marker, UI or backdrop. One tile only. Transparent RGBA outside the silhouette; opaque ground inside. Reference canvas 1024 × 625 pixels. Do not add transparent padding or reframe the tile.
```

## Integration steps (after generation and measurement)

1. Inspect each PNG against `../review/checklist.md`; record real dimensions and alpha.
2. Measure silhouettes: `./art-reference/map/measure.ps1 -Image <outputs png> -Output <json>`.
3. Copy accepted assets to `game/public/map/landmark/` with the batch filenames.
4. Register footprints with `python tools/map-art.py /map/landmark/<file>.png` (writes
   `game/src/ui/map/data/map-terrain-footprints.json`).
5. In `tools/map.ts` `LANDMARK_ART`: point the tier keys at the new files and add the two
   extra keys `town-abbey` and `capital-citadel`. Suggested fallbacks stay sensible:
   `village-small → village-riverside-1`, `city-capital → capital-cathedral-1`.
6. In `tools/data/map.json` `settlement_landmarks`: reassign the 18 towns across the 10 keys
   so each tier is no longer uniform. Current tier counts: village-small ×3, village-medium ×2,
   village-large ×2, city-small ×2, city-medium ×3, city-large ×4, city-capital ×2.
7. Regenerate the map (`npm run map -- --write`), run
   `node art-reference/map/check-placement.mjs <keys...>`, and inspect the real map in the
   integrated browser at 1920 × 1080 with the **Hex alignment** checkbox.
8. Update `../source-assets.json` / `terrain-inventory.json` coverage per the working
   agreement, then get visual feedback before approving the rest of the batch.
