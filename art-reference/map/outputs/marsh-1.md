# Marsh terrain version 1

- Generator: built-in image generation with transparent background.
- Intended layer: complete projected hex terrain, `marsh` catalogue entry.
- Actual output: 1605 × 980 PNG, RGBA, four transparent corners.
- Shape reference: `../geometry/hex-mask.png`.
- Style reference: original `game/public/map/terrain/marsh.png`, material/palette/brushwork only.
- Measurement: [marsh-1.measurement.json](marsh-1.measurement.json); alpha ≥128 convex hull simplified to six vertices, sampled ground fill.
- Integration: `game/public/map/terrain/marsh-1.png`; original and unmodified generated candidate preserved.
- Status: visually approved by the user; installed and inspected in the live Showcase at 1920 × 1080 with 27 marsh instances. Control-point/shared-edge checks, typecheck and map gates passed.
- Evidence: [in-game view](marsh-1.in-game.png), [registration](marsh-1.registration.json).

## Exact generation prompt

Create ONE new production game asset: marsh / wetland terrain for a painterly fantasy tabletop hex map. Reference 1 controls the EXACT six-sided projected footprint and canvas framing. Reference 2 is ONLY a marsh material/style reference: muted olive moss, brown reeds/cattails, dark green shallow pools, decaying wood, painterly brushwork. Do not copy its oversized rocks, tall stump or freeform silhouette. One complete hex terrain tile, RGBA transparent outside. Reference canvas 1024x625. Cover the entire footprint with low olive-brown wet mud and moss, interspersed with 2-3 small shallow green-blue pools and a few tiny lily pads. Keep the central area low and readable. Add 3 compact reed/cattail clumps (maximum 10% canvas height), 2-3 SMALL mossy stones and one low small decaying stump or short fallen branch. No trees or large boulders. All objects and shadows 8% inside the footprint; ground reaches all six edges. Opaque wet ground and water inside, transparency only outside. Orthographic elevation 38 degrees above ground, board yaw -16 degrees in renderer convention; match the supplied mask, not a symmetric stock isometric hex. Soft top-left lighting, subdued natural swamp greens and brown earth, painterly fantasy tabletop style. No paths, road, bridge, buildings, figures, text, UI, fog backdrop, outer shadow, glow, border, platform thickness, circular base or extra tiles. No padding or additional rotation. Clockwise mask vertices from upper right at reference resolution: (878.5533,78.6473),(1024,391.1473),(657.4467,625),(145.4467,546.3527),(0,233.8527),(366.5533,0).
