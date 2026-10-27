# attack.ignite VFX v1

Source: `vibe_images/attack-ignite-sheet-v2_1793033920121_86759e2b.png` (first-party generated sheet).

Art direction: A flame pillar igniting on the target, settling to embers. Orthographic 2.5D three-quarter arena camera; ground fields use the committed footprint.

Processing: magenta green-channel matte, magenta-fringe hue repair toward the skill hue, 5 px cell-edge feather, 4x4 repack with 64 px virtual padding. Raw sheet retained as `source-sheet.png`; runtime reads `atlas.png` only.
