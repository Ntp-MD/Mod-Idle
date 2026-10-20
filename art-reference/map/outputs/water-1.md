# Water terrain version 1

- Generator: built-in image generation with transparent background.
- Intended layer: complete projected hex terrain, `water` catalogue entry.
- Actual output: 1605 × 980 PNG, RGBA; all four corners transparent.
- Shape reference: `../geometry/hex-mask.png`.
- Style reference: original `game/public/map/terrain/water.png`, water/rock palette and brushwork only. Its dock, cliffs and freeform silhouette are not copied.
- Measurement: [water-1.measurement.json](water-1.measurement.json); alpha ≥128 convex hull simplified to six vertices, sampled ground fill.
- Integration: `game/public/map/terrain/water-1.png`; original and untouched generated candidate preserved.
- Status: visually approved by the user; installed and inspected in the live Showcase at 1920 × 1080 with 11 water instances. Control-point/shared-edge checks, typecheck and map gates passed.
- Evidence: [normal map](water-1.in-game.png), [alignment](water-1.alignment.png), [registration](water-1.registration.json).

## Exact generation prompt

Create ONE new production game asset: water terrain for a painterly fantasy tabletop hex map. Image 1 is the EXACT projected ground footprint and canvas framing. Image 2 is ONLY a reference for painterly turquoise water, submerged stones, wave brushwork and natural rock colours. DO NOT copy its tall cliffs, beach, pier, driftwood or freeform silhouette. Produce ONE complete hex filled with calm blue-teal water, with subtle ripples, a few gentle white highlights and faint underwater stones in a small shallow patch. Open water should occupy at least 80% of the tile and the central half should be clear water. Add only 2-3 compact low rock clusters partly emerging near the interior sides, each under 8% of canvas height and fully 8% inside the silhouette. No continuous shoreline or land ring. Water itself reaches all six straight footprint edges and is fully opaque inside; alpha transparency only outside. Reference canvas 1024x625. Orthographic elevation 38 degrees above horizontal, board yaw -16 in renderer convention; match the supplied mask shape rather than a standard symmetric isometric hex. Painterly fantasy tabletop style, subdued natural turquoise and blue-greens, soft top-left lighting. No large cliff, beach, dock, posts, bridge, ship, road, buildings, figures, fish silhouettes, border, platform thickness, circular base, outer shadow, glow, sky, text or UI. No transparent padding or extra rotation. Clockwise vertices from upper right on the reference canvas: (878.5533,78.6473),(1024,391.1473),(657.4467,625),(145.4467,546.3527),(0,233.8527),(366.5533,0). Transparent RGBA background outside the hex, crisp complete footprint.
