# Mountain terrain version 1

- Generator: built-in image generation with transparent background.
- Intended layer: complete projected hex terrain; replaces the `rock` catalogue entry only.
- Actual output: 1606 × 979 PNG, RGBA; all four canvas corners transparent.
- Shape reference: `../geometry/hex-mask.png`.
- Style reference: original `game/public/map/terrain/mountain-relief.png` (style only).
- Composition/scale reference: `game/public/map/terrain/forest-relief-1.png`.
- Measurement: [mountain-relief-1.measurement.json](mountain-relief-1.measurement.json), alpha ≥128 convex hull simplified to six vertices, ordered against the template. Ground fill sampled from opaque pixels just inside the perimeter.
- Integration: `game/public/map/terrain/mountain-relief-1.png`; source image preserved unmodified in this folder and original mountain asset preserved.
- Status: integrated and visually approved by the user. Six-vertex/centre/shared-edge numeric checks passed; live Showcase inspected at 1920 × 1080 with 50 mountain instances.
- Evidence: [alignment](mountain-relief-1.alignment.png), [normal map](mountain-relief-1.in-game.png), [registration](mountain-relief-1.registration.json).
- Typecheck and map gates passed after the subsequent terrain integrations. This asset task did not edit wiki behavior.

## Exact generation prompt

Create ONE new production game asset: rocky mountain terrain for a painterly fantasy tabletop hex map. Image 1 is the EXACT projected ground silhouette and framing mask. Image 2 is ONLY the painterly mountain style, grey/tan stone palette and moss treatment; do not copy its tall freeform silhouette. Image 3 is the approved SMALL SCALE of scenery and ground coverage, not a geometry template. Render a complete hex tile on transparent RGBA background. Reference canvas 1024x625. Ground must fill the entire shape of image 1 right to its six straight edges. Build 3 compact jagged grey stone crag groups on rocky gravel/moss ground, central 65% of the tile; highest crag is 25-30% of canvas height, others smaller. A few small boulders, moss and 1-2 tiny pines for scale. All peaks, rocks, vegetation and shadows entirely inside the silhouette with 8% clearance. Keep ground visible around the crags; no huge mountain backdrop. Orthographic elevation 38 degrees above horizontal; board yaw -16 degrees in renderer convention, match the image 1 footprint. Top-left soft lighting. Muted natural colours matching the original mountain art. No outer shadow, glow, sky, fog, text, border, platform thickness, round base, road, buildings, characters or extra tiles. Keep transparent corners; opaque ground inside. Exact reference vertices clockwise from upper right: (878.5533,78.6473),(1024,391.1473),(657.4467,625),(145.4467,546.3527),(0,233.8527),(366.5533,0). Do not recenter, rotate, round or symmetrize the provided polygon.
