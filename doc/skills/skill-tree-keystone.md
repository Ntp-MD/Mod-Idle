# Skill Tree - Keystones

import glossary.md
import skill-pool.md

**Empty.** Keystones were the only DPS in the removed tree: 18 of them, one pick per exclusive pair, values from +5% to +30% with one keyst worth 0% because it granted EHP instead. All of it is gone with the tree; see skill-tree.md for why and for what has to be true before anything is added back.

The tables the cage parsed are gone; 	ools/tree.js reports zero nodes and 	ools/data/tree.json holds no branches.
<!-- BEGIN GENERATED:keystone-original -->
| Original | Branch | Measured value (%) | Notes |
|---|---|---|---|
<!-- END GENERATED:keystone-original -->

<!-- BEGIN GENERATED:keystone-new -->
| Keystone | Branch | Rule | Calculated value | Conflicting pair |
|---|---|---|---|---|

**Pool accounting check** — 0 units = 0 original (mean 0.0%) + 0 new (mean 0.0%) → **whole-pool mean 0.0%**
- The multiplier **sums** the picks, so a typical path of 6 at 14.2% is ×1.85 — that is the `mob_HP` baseline
- Best *legal* picks =  → sum **0.0%** → tree **×1.00** (the ceiling `mob_HP` does not cover)
- Worst *legal* picks =  → sum **0.0%** → tree **×1.00**
- **0 exclusive pairs**, one pick each (T2) — this is what controls the band width
<!-- END GENERATED:keystone-new -->

<!-- BEGIN GENERATED:keystone-pairs -->
| Pair | Why they truly cut each other (not paired by branch) |
|---|---|
<!-- END GENERATED:keystone-pairs -->
