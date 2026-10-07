# Skill Tree

import glossary.md
import skill-pool.md

**The tree is back, redesigned from scratch** (owner ask). Three branches — **impact** (offence), **stream** (sustain and Core stats), **control** (defence) — **twenty-one nodes each, three ranks per node, one point per rank**: the tree holds sixty-three nodes and a hundred and eighty-nine ranks, and `treePointsAt(level_cap)` spends them exactly — a level grants a point and a point buys a rank.

**Every node pays a number.** A node grants one **real line** from `mods.json` at a fraction of that line's own maximum — a shallow node's rank 3 is a tenth of its line's own maximum and a deep node's is a fifth (the ranks below step down from there), so a fully bought tree is worth about two thirds of a gear set and a deep node is always the stronger buy of its line — so nothing here is a rule with no number in it, which is exactly what the removed tree was: 82 of its 100 points bought rules and **all** the power sat in 18 keystones. **There are no keystones** in this tree.

**Pathing is one chain per branch.** Node *k* needs node *k−1* owned; node 1 is free. No hub, no limbs, no tiers beyond a node's position in its own chain.

**Respec is free**, at the town Counterhand, exactly like the Core stat points: the tree is the player's build to express (`AGENT.md` D11), so taking it back costs nothing.

## Shape

<!-- BEGIN GENERATED:tree-summary -->
| Branch | What it buys | Nodes | Ranks | Points | Chain |
|---|---|---|---|---|---|
| **impact** | offence lines — power, crit, penetration, accuracy, attack speed, stun, bleed | 21 | 63 | 63 | node k needs node k-1 |
| **control** | defence lines — armour, evasion, block, resistance, HP, Energy Shield, cooldown | 21 | 63 | 63 | node k needs node k-1 |
| **stream** | sustain and Core stats — mana, regeneration, Energy Shield regen, Stat Mod | 21 | 63 | 63 | node k needs node k-1 |
| **total** | every node pays a number | **63** | **189** | **189** | 3 chains |
<!-- END GENERATED:tree-summary -->

The three chains are the three branch files: `skill-tree-impact.md`, `skill-tree-stream.md`, `skill-tree-control.md` — each prints its own 21-node table, derived by `node tools/tree.ts --write` from the spec in `tools/data/tree.json` and the line maxima in `mods.json`. Nothing in those tables is typed by hand.

## Why the old tree went

The removed design was not a node graph. Its own budget said so: 100 points, of which **82 bought rules that granted no numbers at all** — hit-counting tweaks, duration clauses, stack-cap changes — and **all** the power sat in 18 keystones costing 3 points each. That is a keystone picker with connective tissue, and it duplicated the question the skill list already asks: *what do I press?* It was also load-bearing in the one place that must not wobble — its multiplier was folded into `mob_HP`, so the price of every mob was set against a system whose shape was about to change again.

## Still open

- **The `mob_HP` fold — closed, by ruling.** The tree's power is not booked into the mob price: the published rates are the empty-tree baseline, so a rank bought is a strength no published number pays for and no price moves. `tools/tree.ts` stays the one place the scale is declared, and there is no pass waiting to measure it.
- **Balance against the mob price** — the scale is a stated rule, not a measured one, and it stays that way (owner ruling): a tenth / a fifth of a line at rank 3, about two thirds of a gear set for the whole tree. The published rates are the empty-tree baseline, so nothing here is priced against `mob_HP`.
