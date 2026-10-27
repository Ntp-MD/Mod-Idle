# attack.split_shot VFX v1

Source: `vibe_images/split-shot-sheet_1793027904887_81f5001f.png` (user-supplied generated sheet, first-party).

Art direction: One arrow splits into three, volleys, then bursts on impact. Orthographic 2.5D three-quarter arena camera; the effect sits on the ground plane where the action commits one.

Processing: magenta green-channel matte, hue repair of the magenta fringe toward the effect hue, 5 px cell-edge feather, 4x4 repack with 64 px virtual padding. Raw sheet retained as `source-sheet.png`; runtime reads `atlas.png` only.
