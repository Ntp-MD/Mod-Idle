# Moor terrain version 1

- Generator: built-in image generation with transparent background.
- Intended layer: complete projected hex terrain, `moor` catalogue entry.
- Actual output: 1605 × 980 PNG, RGBA, four transparent corners.
- Shape reference: `../geometry/hex-mask.png`.
- Style reference: original `game/public/map/terrain/moor.png` (palette/materials/brushwork only).
- Measurement: [moor-1.measurement.json](moor-1.measurement.json); alpha ≥128 convex hull simplified to six vertices, sampled ground fill.
- Integration: `game/public/map/terrain/moor-1.png`; original and unmodified generated candidate preserved.
- Status: visually approved by the user; installed and inspected in the actual Showcase at 1920 × 1080 with 14 moor instances. Control-point/shared-edge checks, typecheck and map gates passed.
- Evidence: [in-game view](moor-1.in-game.png), [registration](moor-1.registration.json).

## Exact generation prompt

Create ONE new production asset: moor / heather upland terrain for a painterly fantasy tabletop hex map. Image 1 defines the EXACT six-sided projected ground footprint and framing. Image 2 is ONLY a palette and brushwork reference: muted purple heather, straw/olive grass, grey weathered rocks and lichen. Do not copy its giant vertical rock tower or freeform silhouette. One complete hex tile; reference canvas 1024x625; genuine RGBA transparency outside. Fill the whole footprint to all six edges with low wind-swept straw/olive grasses and muted earthy patches. Place 3-4 SMALL low purple heather patches, two squat grey lichen rocks and one tiny wind-bent woody shrub within the central 70%; keep plenty of low ground visible. Rocks maximum 15% canvas height, heather/shrub under 10%. No standing stone tower, tall tree, huge boulder or rock pile. All scenery and shadows stay fully inside the hex with 8% clearance. Orthographic elevation 38 degrees above horizontal, board yaw -16 degrees in renderer convention. Match the supplied mask, not a standard symmetric isometric hex. Natural subdued colours, painterly fantasy otherworld tabletop style, soft top-left lighting. No pools, swamp reeds, road, path, houses, figures, symbols, text, UI, backdrop, outer shadow, border, platform thickness or circular base. Single tile only; no transparent padding or extra rotation. Footprint vertices clockwise from upper right on the reference canvas: (878.5533,78.6473),(1024,391.1473),(657.4467,625),(145.4467,546.3527),(0,233.8527),(366.5533,0). Ground opaque inside, transparent outside.
