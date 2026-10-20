# Wasteland terrain version 1

- Generator: built-in image generation with transparent background.
- Intended layer: complete projected hex terrain, `waste` catalogue entry.
- Actual output: 1605 × 980 PNG, RGBA. Raw corner alpha values are 0,0,1,0; the faint 1/255 residue outside the ground is excluded by the renderer's exact footprint clip.
- Shape reference: `../geometry/hex-mask.png`.
- Style reference: original `game/public/map/terrain/waste.png` (materials/palette/brushwork only).
- Measurement: [waste-1.measurement.json](waste-1.measurement.json); alpha ≥128 convex hull simplified to six vertices, sampled ground fill.
- Integration: `game/public/map/terrain/waste-1.png`; original and unmodified generated candidate preserved.
- Status: installed and inspected in the actual Showcase at 1920 × 1080 with 11 wasteland instances. Control-point/shared-edge checks, typecheck and map gates passed. User visual approval pending.
- Evidence: [in-game view](waste-1.in-game.png), [registration](waste-1.registration.json).

## Exact generation prompt

Create ONE new production asset: dry red badlands / wasteland terrain for a painterly fantasy tabletop hex map. Reference 1 defines the EXACT projected six-sided ground footprint and canvas framing. Reference 2 is ONLY a style/material reference: warm rust-red sandstone, layered weathering, cracked ochre earth and sparse dry scrub. Do not copy its towering hoodoos, oversized dead tree or freeform base. Reference canvas 1024x625; one complete hex tile with genuine RGBA transparency outside. Fill the entire footprint to all six edges with cracked muted terracotta/ochre earth and scattered small stone chips. Within the central 65% arrange 2-3 compact squat red sandstone formations (small flat-topped mesas/eroded rocks), tallest under 25% of canvas height. Add 2-3 tiny straw-coloured scrub tufts and one short low dead branch or stump under 10% height. Keep low ground visible between groups; no giant rock wall or backdrop. All objects and shadows stay 8% inside the footprint. Orthographic elevation 38 degrees above horizontal; board yaw -16 in renderer convention. Match the supplied mask rather than a standard symmetric isometric hex. Muted natural rust/clay tones, painterly fantasy tabletop treatment, soft top-left lighting. No salt crust, snow, pools, roads, paths, houses, figures, symbols, text, UI, border, platform thickness, circular base, outer shadow or sky. No padding, no extra rotation and no extra tiles. Opaque ground inside. Reference vertices clockwise from upper right: (878.5533,78.6473),(1024,391.1473),(657.4467,625),(145.4467,546.3527),(0,233.8527),(366.5533,0).
