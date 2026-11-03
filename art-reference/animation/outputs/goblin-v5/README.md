# Goblin v5 16-direction candidate

This directory is review-only. Nothing here is promoted to runtime.

`atlas/animation-v5-candidate.png` is a 16-column × 17-row RGBA atlas at 6144 × 6528 px. It contains 272 cells of 384 × 384 px: one idle row and four rows each for walk, attack, hit, and death. Directions run left to right in the order recorded in the JSON manifest.

The atlas preserves 40 384x384 poses from the approved Goblin 8-direction atlas and supplies 232 new candidate poses from the 17 active 4x4 source sheets. Four rejected death 03-settle attempts remain in `source/rejected/`; they are excluded. The source-tree inventory still reports 107/272 PNG paths. Of those, 67 files marked `candidate-review` are actually 1254x1254 contact sheets, not frame crops, so they were excluded from this atlas. The inventory tool counts paths, not dimensions or visual approval.

Generated sheets and extracted frames are in `source/v5-contact-sheets/` and `frames/`. Each has JSON provenance with its source image ID, action/phase, contact-sheet cell order, reference inputs, prompt contract, and processing measurements. `assemble_candidate.py` rebuilds the candidate artifacts without changing the species source tree.

The generated frames were trimmed using alpha confidence threshold 128 with a 3 px soft-edge recovery, scaled to the median alpha-bound height measured from approved Goblin source poses of the same action/phase, and aligned provisionally to anchor (192, 288). These are structural processing choices, not visual approval.

`atlas/animation-v5-death-rows-review.png` places death 02-ground and 03-settle side by side across all 16 directions. `atlas/animation-v5-color-preview-neutral.png` composites the color preview over a neutral background so alpha remnants are easier to spot.

All atlas QA flags are false. Identity, exact facing, spear hand, action continuity, alpha edges, 16-direction root placement, and the actual atlas still need visual review. The built-in 8 × 5 production QA does not validate this 16 × 17 layout. Use the color and silhouette previews for review, then verify the final candidate at native cell scale before any promotion.
