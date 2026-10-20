# Ash terrain version 1

- Generator: built-in image generation with transparent background.
- Intended layer: complete projected hex terrain, `ash` catalogue entry.
- Actual output: 1605 × 980 PNG, RGBA, four transparent corners.
- Shape reference: `../geometry/hex-mask.png`.
- Style reference: original `game/public/map/terrain/ash.png` (materials/palette/brushwork only).
- Measurement: [ash-1.measurement.json](ash-1.measurement.json); alpha ≥128 convex hull simplified to six vertices, sampled ground fill.
- Integration: `game/public/map/terrain/ash-1.png`; original and unmodified generated candidate preserved.
- Status: installed; control-point/shared-edge checks passed. Browser review and user visual approval pending.

## Exact generation prompt

Create ONE NEW production game asset: volcanic ASH terrain for a painterly fantasy tabletop hex map. Image 1 defines the EXACT projected ground silhouette and canvas framing. Image 2 is ONLY the material/style reference: charcoal basalt, dusty grey ash, restrained glowing orange cracks, sparse burnt scrub. Do not copy its tall pillars, giant burnt tree or freeform base. Reference canvas 1024x625. One complete hex tile filled edge-to-edge with opaque cracked charcoal-grey volcanic crust and patches of powdery ash. Thin irregular orange ember/lava fissures should be clearly readable but occupy only a small part of the ground, not a lava lake. Place 2-3 compact squat groups of broken basalt columns (tallest under 22% canvas height), one small low charred stump under 10%, and a few tiny pale dry scrub tufts, all in the central 65%. Keep visible low ground around them. All rocks, branches and shadows fully inside with 8% clearance. Orthographic elevation 38 degrees above horizontal, board yaw -16 in renderer convention; match the supplied mask rather than a standard symmetric isometric hex. Painterly fantasy tabletop style, muted dark stone tones, soft top-left lighting and local subtle orange fissure light. No huge mountain wall, tall dead tree, eruption, smoke plume, background, road, path, building, creature, text, UI, border, outer shadow, thick platform or circular base. No transparent padding, extra rotation or additional tiles. Ground opaque inside, genuinely transparent RGBA outside. Vertices clockwise from upper right at reference size: (878.5533,78.6473),(1024,391.1473),(657.4467,625),(145.4467,546.3527),(0,233.8527),(366.5533,0).
