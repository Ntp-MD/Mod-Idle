# attack.poison_cloud VFX v1

Source: `vibe_images/attack-poison-cloud-sheet_1793033508619_553d417e.png` (first-party generated sheet).

Art direction: A churning toxic cloud covering the target ground. Orthographic 2.5D three-quarter arena camera; ground fields use the committed footprint.

Processing: magenta green-channel matte, magenta-fringe hue repair toward the skill hue, 5 px cell-edge feather, 4x4 repack with 64 px virtual padding. Raw sheet retained as `source-sheet.png`; runtime reads `atlas.png` only.
