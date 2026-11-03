# Minotaur v5 16-direction candidate

This directory is review-only. Nothing here is promoted to runtime.

`atlas/animation-v5-candidate.png` is a 16-column × 17-row RGBA atlas at 6144 × 6528 px. It contains 272 cells of 384 × 384 px: one idle row and four rows each for walk, attack, hit, and death. Directions run left to right in the order recorded in the candidate manifest.

The current source tree has 73 PNG paths, but those are unapproved candidates: 36 are 384 × 384 pose images and 37 are 1254 × 1254 contact sheets. No source frame has `approved-source-pose` status, so the candidate atlas uses all 272 cells from the 17 contact sheets. The source tree remains unchanged.

Contact-sheet cells are trimmed at alpha confidence 128 with a 3 px soft-edge recovery and aligned provisionally to anchor (192,288). The atlas and each generated frame retain false visual/alpha/anchor/runtime QA flags pending review.
