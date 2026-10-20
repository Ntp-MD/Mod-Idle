# Snow terrain version 1

- Generator: built-in image generation with transparent background.
- Intended layer: complete projected hex terrain, `snow` catalogue entry.
- Actual output: 1605 × 980 PNG, RGBA; all four corners transparent.
- Shape reference: `../geometry/hex-mask.png`.
- Style reference: original `game/public/map/terrain/snow.png` (colour and brushwork only).
- Composition/scale reference: user-approved `game/public/map/terrain/mountain-relief-1.png`.
- Measurement: [snow-1.measurement.json](snow-1.measurement.json); alpha ≥128 convex hull simplified to six vertices, with sampled ground fill.
- Integration: `game/public/map/terrain/snow-1.png`. Both the original snow image and the untouched generated candidate are preserved.
- Status: visually approved by the user; installed and inspected in the live Showcase at 1920 × 1080 with 22 snow instances. Control-point and shared-edge checks passed.
- Evidence: [in-game view](snow-1.in-game.png), [registration](snow-1.registration.json).

## Exact generation prompt

Create ONE new production game asset: snowy terrain for a painterly fantasy tabletop hex map. Reference 1 is the EXACT projected ground silhouette and framing mask. Reference 2 supplies ONLY snowy rock colours, pine style and brushwork; do not copy its oversized vertical mountain or freeform base. Reference 3 supplies accepted SMALL scenery scale and composition, not a shape template. One complete hex tile, RGBA with transparent background. Reference canvas 1024x625. Fill the entire six-sided footprint with opaque soft ivory snow and subtle cool blue-grey snow shadows. In central 65% arrange two compact blue-grey rock outcrops with snow caps, maximum 25% of canvas height, and two SMALL snow-dusted pine trees, 18-22% of canvas height. A few low snow-covered stones, gentle small drifts; open snow visible between objects. Keep all peaks, branches, stones and shadows fully inside the silhouette with 8% clearance. Ground itself reaches every straight edge. Orthographic elevation 38 degrees above ground; board yaw -16 degrees in renderer convention. Follow the mask rather than a symmetric stock isometric hex. Top-left soft lighting, painterly fantasy tabletop treatment consistent with the accepted mountain. No sky, fog, outer shadow, border, tile thickness, platform, circular base, roads, tracks, buildings, figures, labels, text or UI. Do not add transparent padding or rotate the tile again. Exact footprint vertices clockwise from upper right on the reference canvas: (878.5533,78.6473),(1024,391.1473),(657.4467,625),(145.4467,546.3527),(0,233.8527),(366.5533,0). Fully transparent outside, opaque snow inside, single tile only.
