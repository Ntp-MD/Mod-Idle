# Skill Tree - Keystones — dropped

import glossary.md
import skill-pool.md

**There are no keystones.** They were the only DPS in the removed tree — 18 of them, one pick per exclusive pair, values from +5% to +30% — and that is precisely the shape that failed: every point of power in a handful of picks, with 82 of the 100 points spent on rules that granted nothing. The redesigned tree (`skill-tree.md`) has no keystones and no exclusive pairs: **every one of its 63 nodes grants a line at a number**, and the only choice a node makes is *how deep in its own chain the player wants to go*.

`tools/tree.ts` gates that directly — **T7** fails if any node arrives without a line and its three values.
