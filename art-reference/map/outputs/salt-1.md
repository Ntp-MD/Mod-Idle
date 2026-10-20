# Salt terrain version 1

- Generator: built-in image generation with transparent background.
- Intended layer: complete projected hex terrain, `salt` catalogue entry.
- Actual output: 1605 × 980 PNG, RGBA, four transparent corners.
- Shape reference: `../geometry/hex-mask.png`.
- Style reference: original `game/public/map/terrain/salt.png` (materials/palette/brushwork only).
- Measurement: [salt-1.measurement.json](salt-1.measurement.json); alpha ≥128 convex hull simplified to six vertices, sampled ground fill.
- Integration: `game/public/map/terrain/salt-1.png`; original and unmodified generated candidate preserved.
- Status: installed and inspected in the actual Showcase at 1920 × 1080 with 6 salt instances. Control-point/shared-edge checks, typecheck and map gates passed. User visual approval pending.
- Evidence: [in-game view](salt-1.in-game.png), [registration](salt-1.registration.json).

## Exact generation prompt

Create ONE new production asset: salt flat / pale limestone terrain for a painterly fantasy tabletop hex map. Image 1 is the EXACT projected six-sided footprint and framing mask. Image 2 is ONLY a reference for warm ivory limestone, pale sandy soil, natural salt crystals and painterly fantasy treatment; do not copy its huge stone arch, pillars or freeform silhouette. Reference canvas 1024x625, one complete RGBA hex tile. Ground fills the entire supplied footprint to all six straight edges: warm pale beige dry earth with irregular thin white salt-crust plates and subtle cracks. Keep the middle half low and readable. Add two squat low weathered limestone outcrops and 2-3 SMALL translucent ivory salt-crystal clusters inside the central 70%. Largest rock/crystal under 15% canvas height. One tiny dry scrub tuft optional. All scenery and shadows fully inside with 8% clearance. No tall towers, arch, cliffs, dunes or mountain backdrop. No snow, blue ice or pine trees; maintain warm cream/sand colours so this clearly differs from the snow tile. Orthographic elevation 38 degrees above ground; board yaw -16 in renderer coordinates; match image 1 rather than a symmetric standard isometric hex. Top-left soft lighting, muted painterly fantasy tabletop style. No roads, paths, buildings, figures, symbols, text, UI, outer shadow, border, platform thickness, circular base or background scene. No extra padding or rotation. Vertices clockwise from upper right at reference size: (878.5533,78.6473),(1024,391.1473),(657.4467,625),(145.4467,546.3527),(0,233.8527),(366.5533,0). Opaque ground inside, genuinely transparent outside.
