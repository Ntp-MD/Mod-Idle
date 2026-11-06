# Mob pose size stability review

## 2026-11-05 check

### Runtime atlases

`python -B tools/monster-animation-qa.py --runtime --json` checked 37 runtime atlases, including the 36 mob atlases, with **0 QA errors**. The QA's report-only scale heuristic flagged 65 upright frames across 26 mob atlases. It flags frames whose silhouette width or height differs from the upright median by more than 30%, or whose area differs by more than 50%; death frames are exempt. I reviewed the flagged frames in contact sheets. The visible differences were mostly attack reach, weapon/limb extension, and facing; I found no clear whole-body scale jump in the active runtime atlases.

### Canonical source poses

All 4,896 expected source slots are present and now use **384 × 384** canvases. Each frame's visible height was compared with the matching action/phase in its species' active runtime atlas; the nearest East/West runtime phase was used for non-cardinal facings.

**1,059 frames** were uniformly normalized with nearest-neighbor scaling and the runtime anchor: 382 frames with non-384 canvases, 674 scale outliers, and 3 remaining outliers normalized with an alternate/adjusted East reference to preserve the 24 px gutter. Their sidecars record the input dimensions, runtime reference frame, uniform scale, anchor, and input/output hashes. The other **3,837 frames** were already within 0.77–1.30 of their phase-matched runtime reference. The final scan found **0 frames outside that range**, 0 broken runtime references, and 0 output hash mismatches.

The size normalization preserves `candidate-review` status and does not approve or promote any atlas. The runtime atlases were not changed.

The runtime atlas QA still reports 0 errors. The source composer preflight passes 954 of 4,896 PNGs; it rejects 3,898 for semi-transparent pixels and 44 for multiple disconnected components. These are separate composition-readiness issues, so the pose set remains in `candidate-review` pending that review.

The 447 coverage-only directional duplicates remain `candidate-review`; their exact-facing art still needs visual review before approval or atlas promotion.

No candidate was approved by this check.
