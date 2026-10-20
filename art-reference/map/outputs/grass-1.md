# Grassland terrain version 1

- Generator: built-in image generation with transparent background.
- Intended layer: complete projected hex terrain, `grass` catalogue entry.
- Actual output: 1605 × 980 PNG, RGBA; four transparent corners.
- Shape reference: `../geometry/hex-mask.png`.
- Style reference: original `game/public/map/terrain/grass.png` (palette and brushwork only).
- Scale/palette reference: user-approved `game/public/map/terrain/mountain-relief-1.png`.
- Measurement: [grass-1.measurement.json](grass-1.measurement.json), alpha ≥128 convex hull simplified to six vertices. Ground fill sampled just inside the perimeter.
- Integration: `game/public/map/terrain/grass-1.png`; original grass asset preserved, candidate copied without pixel edits.
- Status: visually approved by the user; integrated and inspected in the live Showcase at 1920 × 1080 with 26 grass instances. Typecheck and map gates passed.
- Evidence: [in-game view](grass-1.in-game.png). Geometry uses the same measured six-sector registration as forest and mountains.

## Exact generation prompt

Create ONE new production game asset: open grassland terrain for a painterly fantasy tabletop hex map. Image 1 is the EXACT projected ground silhouette and framing reference. Image 2 is ONLY the painterly meadow colours and material style; do not copy its giant rock/log scale or freeform composition. Image 3 is the accepted small detail scale and palette consistency of a neighbouring mountain tile, not a shape template. Complete projected hex tile, actual RGBA transparent background. Requested reference canvas 1024x625. Fill the entire polygon in image 1 with short green/olive meadow grass, tiny low wildflowers and occasional subtle bare-earth patches. Keep the central 50% mostly open short grass for readability and a character figure. Around the interior perimeter, add 2-3 low small grass/flower clumps, two SMALL grey stones and one tiny fallen branch. No bush or stone taller than 8% of canvas height. No large log, no boulders, no trees. Ground reaches every straight edge but scenery stays 8% inside the silhouette. Orthographic elevation 38 degrees above horizontal, board yaw -16 degrees in renderer convention; follow image 1 footprint exactly. Top-left lighting, muted natural greens and warm earth, consistent painterly fantasy diorama detail with the references. No road, trails, sky, backdrop, outer shadows, glow, borders, platforms, circular bases, buildings, figures, text or UI. One tile only, no transparent padding and no extra rotation. Exact polygon vertices clockwise from upper right on reference canvas: (878.5533,78.6473),(1024,391.1473),(657.4467,625),(145.4467,546.3527),(0,233.8527),(366.5533,0). Opaque ground inside, transparent outside.
