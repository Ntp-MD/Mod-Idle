# Vampire v5 16-direction candidate

Status: review required. Nothing in this folder is approved for runtime.

`atlas/animation-v5-candidate.png` is a 16-column × 17-row RGBA atlas (6144×6528), with 272 cells of 384×384 pixels. It preserves 40 approved cells from the existing 8×5 source atlas and fills the other 232 cells from 17 generated 4×4 direction sheets.

The inventory scanner reports 0/272 individual `poses/` PNGs. The existing animation atlas is separately marked visual-approved and has 40 exact 384×384 cells; those are preserved unchanged. Draft sheets were excluded.

All generated art remains under this output folder. Identity, facing, pose timing, alpha edges, anchor, atlas, visual review, and runtime promotion flags are false. See `atlas/animation-v5-candidate.json`, `source-audit.json`, and the color/silhouette/death previews for provenance and review.
