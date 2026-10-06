# Skill Tree — empty

import glossary.md
import skill-pool.md

**This game has no passive skill tree.** The tree was cleared because the fundamentals were still moving, and it is kept here as an empty shell so the decision, the fold point and the cage all survive. A level now grants a **tree point that is banked** — but the tree still holds no content, so a banked point grants nothing until it lands. This amends "no passive tree" ruling: the points exist, the tree does not.

## Why it went

The design that was removed was not a node graph. Its own budget said so: 100 points per level, of which **82 bought rules that granted no numbers at all** — hit-counting tweaks, duration clauses, stack-cap changes — and **all** of the power sat in 18 keystones costing 3 points each. That is a keystone picker with connective tissue, and it duplicated the question the skill list already asks: *what do I press?*

Worse, it was load-bearing in the one place that must not wobble: the tree multiplier was folded into `mob_HP`, so the price of every mob in the game was set against power the player could only get from a system whose shape was about to change again.

## What is left, and what it is for

| Kept | Why |
|---|---|
| `tools/data/tree.json` (empty) | the fold point: any future power source must be multiplied into `mob_HP`, and this is where that factor is declared |
| `tools/tree.ts` + its slot in `verify.js` | the cage that will validate whatever replaces this |
| these four files | one home for the decision, so the next session does not re-invent a tree and re-derive its numbers from scratch |

## What must be true before anything is added back

1. **The core loop is stable** — gear, crafting, Push and the mob curve are no longer being re-tuned.
2. **The replacement is not a node graph** — if the answer is "which skills and which aura set", that belongs to the skill list and skill level, not to a second grid (`skill-pool.md` · `skill-pool-system.md`).
3. **Its power is folded into `mob_HP` in the same commit that adds it.** A power source that is not inside the mob price moves the game speed, and the 574.5 hr timeline stops being true.
4. **No document quotes a tree multiplier while this file is empty.** `tools/anchors.ts` and the cages treat any such number as a copy.

## Shape (empty)

<!-- BEGIN GENERATED:tree-summary -->
| Branch | File | Minor declared | Minor parsed | Limbs parsed | Keystones | Dangling refs |
|---|---|---|---|---|---|---|
| **total** | 3 files | **0** | **0** | **0** | **0** | **0** |

> Every node "Enables" cell resolves to a real skill or keystone. `checks.md` D19 reference check passes.
<!-- END GENERATED:tree-summary -->

<!-- BEGIN GENERATED:tree-layout -->
| Branch | Limb (order from the hub) | Nodes | Tiers it can hold | Spoke keystone |
|---|---|---|---|---|

Pathing, so a client guesses nothing: **hub → branch gateway → limb gateway → nodes in table order**. A node is purchasable once the node before it in the same limb is owned; tier is distance from the hub, exactly as this file already describes it. The keystone column is the paired-spoke assignment, cycled per branch — a keystone is reachable through two limbs, never one (T2).
<!-- END GENERATED:tree-layout -->

Detail files, all empty and kept for the same reason:
- `skill-tree-impact.md`
- `skill-tree-stream.md`
- `skill-tree-control.md`
- `skill-tree-keystone.md`
