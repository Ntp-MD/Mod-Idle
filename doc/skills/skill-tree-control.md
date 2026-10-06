# Skill Tree - Control branch

import glossary.md
import skill-pool.md

**Control branch** — one of the tree's three chains (`skill-tree.md`). defence: armour, evasion, block, resistance, HP, Energy Shield, cooldown.

<!-- BEGIN GENERATED:tree-control -->
| Node | Line | Rank 1 | Rank 2 | Rank 3 | Line max | Needs |
|---|---|---|---|---|---|---|
| control.1 | armour_flat | 1 | 3 | 4 | 40 | — |
| control.2 | armour_pct | 1 | 1 | 2 | 16 | control.1 |
| control.3 | evasion_flat | 1 | 2 | 3 | 30 | control.2 |
| control.4 | evasion_pct | 1 | 1 | 2 | 16 | control.3 |
| control.5 | block_chance | 2 | 3 | 5 | 50 | control.4 |
| control.6 | elemental_resistance | 1 | 2 | 3 | 30 | control.5 |
| control.7 | all_resistance_pct | 1 | 1 | 2 | 20 | control.6 |
| control.8 | status_resistance_pct | 1 | 2 | 3 | 25 | control.7 |
| control.9 | max_hp_flat | 7 | 13 | 20 | 200 | control.8 |
| control.10 | max_hp | 1 | 1 | 2 | 16 | control.9 |
| control.11 | energy_shield_flat | 2 | 4 | 6 | 60 | control.10 |
| control.12 | max_energy_shield_pct | 1 | 1 | 2 | 16 | control.11 |
| control.13 | life_regen_flat | 1 | 2 | 3 | 31 | control.12 |
| control.14 | cooldown_reduction | 1 | 2 | 3 | 25 | control.13 |
| control.15 | armour_flat | 3 | 5 | 8 | 40 | control.14 |
| control.16 | evasion_flat | 2 | 4 | 6 | 30 | control.15 |
| control.17 | max_hp_flat | 13 | 27 | 40 | 200 | control.16 |
| control.18 | energy_shield_flat | 4 | 8 | 12 | 60 | control.17 |
| control.19 | perfect_dodge_pct | 1 | 1 | 1 | 3 | control.18 |
| control.20 | all_resistance_pct | 1 | 3 | 4 | 20 | control.19 |
| control.21 | max_hp | 1 | 2 | 3 | 16 | control.20 |

21 nodes, 63 ranks, 63 points. The first 14 nodes are shallow (0.03333333333333333/0.06666666666666667/0.1% of the line's own maximum per rank), the last 7 are deep (0.06666666666666667/0.13333333333333333/0.2%) — so a deeper node of the same line is always the stronger buy.
<!-- END GENERATED:tree-control -->
