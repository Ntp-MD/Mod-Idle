# attack.water_ball VFX v1

Source: `vibe_images/attack-water-ball-sheet_1793033617052_3f34f659.png` (first-party generated sheet).

Art direction: Five water spheres in a fan, then repeated splash impacts. Orthographic 2.5D three-quarter arena camera; ground fields use the committed footprint.

Processing: magenta green-channel matte, magenta-fringe hue repair toward the skill hue, 5 px cell-edge feather, 4x4 repack with 64 px virtual padding. Raw sheet retained as `source-sheet.png`; runtime reads `atlas.png` only.
