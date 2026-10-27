# attack.frost_nova VFX v1

Source: `vibe_images/frost-nova-sheet_1793027879716_6a498591.png` (user-supplied generated sheet, first-party).

Art direction: Ground nova: shard burst grows into a spinning frost ring, then fades. Orthographic 2.5D three-quarter arena camera; the effect sits on the ground plane where the action commits one.

Processing: magenta green-channel matte, hue repair of the magenta fringe toward the effect hue, 5 px cell-edge feather, 4x4 repack with 64 px virtual padding. Raw sheet retained as `source-sheet.png`; runtime reads `atlas.png` only.
