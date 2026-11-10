# Giant v5 16-direction animation candidate

Status: **candidate review required**. Nothing in this folder is approved for runtime.

The active source set has 17 contact sheets with 16 directions each. Two earlier death-03 sheets are retained as rejected history; the active v3 pass has a lateral side-lying pose. The atlas has 16 direction columns and 17 pose rows at 384x384 pixels per frame (6144x6528 total): 272 cells, with 232 generated missing-direction frames and 40 preserved legacy frames.

Required coverage: idle has one frame per direction; walk, attack, hit and death each have four frames per direction.

All generated sheets and processed candidate frames remain under this outputs folder. The source-tree inventory remains 40/272 until reviewed frames are imported into the species source tree.

Review caveats: generated art has smooth/anti-aliased shading and soft halos; contact-sheet alpha backgrounds vary; identity, facing, pose timing, alpha edges, anchors and runtime presentation remain unapproved. The white-matte hit-01 sheet and two near-duplicate death-03 attempts were rejected and replaced. The reviewer confirmed the v3 death-03 pose reads distinctly side-lying; visual and alpha-edge approval remain pending.

Review aids: `review/color-contact.png` and `review/silhouette-contact.png`.
