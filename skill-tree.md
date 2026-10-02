# Skill Tree

import glossary.md
import skill-pool.md
import world.md
import combat.md
import skill-tree-impact.md
import skill-tree-stream.md
import skill-tree-control.md
import skill-tree-keystone.md

Fully designed · This file is the constraints + numbers tied to the calculated Base (world.md / combat.md / formula.md). Every "tree not yet laid / pending" note in this file is answered, except the 6 keystones noted in section 8

Detail files:
- skill-tree-impact.md — Impact branch, 41 minor in 5 limbs
- skill-tree-stream.md — Stream branch, 41 minor in 5 limbs
- skill-tree-control.md — Control branch, 40 minor in 5 limbs
- skill-tree-keystone.md — 18 keystones + 9 exclusive pairs + pool accounting

# 1. Point budget — 100

| Original question | Answer |
|---|---|
| 30 points (1 per 3 levels) or 90 (1 per level)? | **100 points = 1 point per level 1-100** · The 90 figure was written before the player Cap was set at 100 |
| When granted | L10 = 10 points (0.5 hours) · L30 = 30 (3.1 hours) · L60 = 60 (12.6 hours) · L100 = 100 (40.2 hours) |
| Points from other sources | **None** · Bosses grant no points, but unlock some keystones (section 6) · If bosses also granted points, full-AFK players would be doubly penalized |

- 100 points in 40 hours = **a new point every 24 minutes** · This is the frequency at which the player has "something to decide" from the tree · Any slower and the tree becomes decoration

# 2. 3-branch frame — decided by numbers, not feeling

The original question was "branches by weapon group or by Element" → **neither**

| Rejected cause | |
|---|---|
| Branches by weapon group | All weapon types are already tuned to equal DPS (`weapon_mult = 1.2/weapon_aspd` · proven equal 9,847 across 12 types). If the tree split by weapon, some weapon would be "better", destroying the established rule |
| Branches by Element | Element is a damage *tag*, not a play axis · And Elements are still staged as a "+21% bonus" (elements.md). Placing them as tree axes would lock paths that are not yet fixed |

**True branches = axes where players measurably differ**

| Branch | What it changes | Example keystone |
|---|---|---|
| **Impact** | Per-hit value · crit · count-based procs | Sonic Blow · Counter · Brute |
| **Stream** | Per-second flow value · DoT · stack accumulation | Burning Focus · Elemental Attunement · Overkill |
| **Control** | Timing of all sides · chill/stun/shock · aura · Push defense | Rapid Fire · Flurry · Noble Phantasm |

- All 3 branches bind to neither weapon nor Element → dagger or staff players can enter the same branch (opposite of the old item 3 claiming the tree must not force weapons)
- **Branches do not block each other** · All branches connect at the central hub · Players can spread, but distance makes jumping branches expensive (see section 4)

# 3. Tree power budget — folded into mob HP so the Base does not shift

This is the most important point of this file: **a tree granting free power breaks the timeline in loot.md** (kills/hour set on 1-sec TTK)

``
keystone 1 unit                    ≈ +14% of build   (measured from 12 originals: 5% to 30%, mean 14%)
Typical path (6 keystones + 82 minor) ≈ +85%
mob_HP(L) = DPS_gear(L) × (1 + 0.0085 × L) × (1 + 0.0034 × L)   ← folds both tree and skill list into the same formula
``

| Level | 1 | 10 | 30 | 60 | 90 | 100 |
|---|---|---|---|---|---|---|
| Tree multiplier | ×1.01 | ×1.09 | ×1.26 | ×1.51 | ×1.77 | **×1.85** |
| mob HP (substituted) | 121 | 682 | 2,289 | 7,992 | 18,901 | 22,016 |
| mob damage/sec | 4 | 23 | 61 | 163 | 304 | 329 |

- **Tree power budget is reverse-calculable into nodes** — the +85% is not set loosely but equals **6 keystones × 14.2% = 85%**, matching the mean measured from the 12 original passives (+14%) · The perfect-build +110% = **6 keystones × 18.3%** still sits inside the measured range (5-30%), meaning +110% comes from *picking keystones that fit the build*, not from other nodes
- **Forced result: 122 minor nodes must have zero DPS budget** — removing 84% for keystones from 85% leaves 1% for 82 nodes = 0.012% each · This immediately becomes a content-writing rule: **minors must not grant pure numbers** (matching section 4 banning `+5% Str`), because the first minor granting +1% DPS would push the whole mob_HP line up and break the full budget locked in checks.md D1 · True minor value must be an *enabler* (e.g. "maximum burn stacks +1" · "chill expires 25% slower") that changes which keystone is usable, not direct DPS
- **Tree width band (mirroring the gear band)**: players with 4/5/6 keystones at level 100 get multipliers ×1.56 / ×1.70 / ×1.84 → TTK **1.19 / 1.09 / 1.01 sec** on the same mob HP · The mob_HP baseline is set at 6 keystones (= ×1.85 · 1-sec TTK), so narrow-path players are not punished, only ~19% slower · This is the same figure D3-D5 use for gear
- TTK remains 1 sec for "gear and tree on-level" players · Perfect builds (T1 gear + +110% tree) kill in **0.79 sec** · Empty-handed into a new zone: 2-8 sec
- **Measured power-source ranking**: gear ×5.6 (no gear → full-step gear) · tree ×1.85 · skill ×1.1-1.4 → gear is still core #1 as concept.md sells
- The mob-HP tables in world.md and combat.md are already updated accordingly · Changing the tree budget requires re-multiplying both files

# 4. Distance is price

- From the hub each branch is a limb · **minor node = 1 point · keystone = 3 points**
- Reaching an inner keystone requires passing 8-12 minors → the 6th keystone in another branch is naturally very expensive (no ban rule needed)
- One node references a *rule*, not a number: `+5% Str` / `+10 HP` **are banned** (original constraint 2 still holds) · Numeric-looking minors must tie to a rule, e.g. "maximum burn stacks +1" or "chill on target expires 25% slower", not "aspd +3%"

# 4b. Laid-out tree (122 minor + 18 keystone)

- **Central hub → 3 large limbs (Impact · Stream · Control) → 5 sub-branches each = 15 branches** · Every node sits in one of these 15 branches; there are no middle nodes
- **Tier = distance from hub** · Each branch starts at Tier 1 attached to its own branch root · Minor cost = 1 point · Keystone = 3 points
- **6 keystones per branch (18 total) sit at the ends of 2 sub-branches of that branch** → reaching them requires passing 8-12 minors as set (section 4), and all 9 exclusive pairs are always placed at opposite ends of a pair (never obtainable together without sacrifice)
- **Verified numbers**: typical path = 82 minor + 6 keystone = 82 + 18 = **exactly 100 points** at level 100 (1 point/level) · Average distance to an end-limb keystone = 10.4 points
- **Power budget**: all minors grant *no raw numbers* (no `+5% Str` · no `+10 HP`) — as D15 enforces · The `node tools/tree.js --checks` tool checks every node for this and verifies every node references a skill or keystone that truly exists in the current skill roster (43 units)
- **Nodes "empty" for some builds are acceptable** (e.g. nodes hitting the aspd Cap) · The goal is 15 branches × 8-10 choices, not every node good for every build · If a node is empty for all builds = a bug in that node; fix `tools/tree.js` and re-run

Branch details (moved, no data changed):
- Impact branch — 41 minor in 5 limbs → skill-tree-impact.md
- Stream branch — 41 minor in 5 limbs → skill-tree-stream.md
- Control branch — 40 minor in 5 limbs → skill-tree-control.md
- Keystones — 12 original + 6 new + 9 exclusive pairs → skill-tree-keystone.md

**Parsed shape** (generated by `node tools/tree.js` from the node tables + `tools/data/tree.json`):

<!-- BEGIN GENERATED:tree-summary -->
| Branch | File | Minor declared | Minor parsed | Limbs parsed | Keystones | Dangling refs |
|---|---|---|---|---|---|---|
| Impact | `skill-tree-impact.md` | 41 | 41 | 5 | 6 | 6 |
| Stream | `skill-tree-stream.md` | 41 | 41 | 5 | 6 | 3 |
| Control | `skill-tree-control.md` | 40 | 40 | 5 | 6 | 14 |
| **total** | 3 files | **122** | **122** | **15** | **18** | **23** |

> **23 dangling "Enables" references** — a node points at a skill that no longer exists in `skills.json` (mostly the cleared buff set). `checks.md` D19 stays FAIL until these nodes are rewritten. Full list: Impact · Second Sight → Focus · Impact · Margin Call → Reaver's Edge · Impact · Duelist Poise → Ancestral Pace · Impact · Locked In → Iron Will · Impact · Read and Reply → Guardian's Veil · Impact · Blood Price → Blood Pact · Stream · Slow Burn Debt → Bloodletting · Stream · Tick Counter → Bloodletting · Stream · Early Harvest → Bloodletting · Control · Turn Aside → Guardian's Veil · Control · Stalled → Focus · Control · Hourglass → Battle Orders · Control · Borrowed Second → War Cry · Control · Stagger Train → Focus · Control · Kept Warm → Stone Skin · Control · Stacked Orders → Battle Orders · Control · Slow Ticking Patience → War Cry · Control · One for the Road → Blood Pact · Control · Second Helpings → Stone Skin · Control · Lean Rotation → Deep Breath …
<!-- END GENERATED:tree-summary -->

# 6. Keystones and bosses (exit from "short content")

- End-limb keystones of every branch (3 units) **require beating the zone 3/6/9 boss first** before purchase unlocks
- Result: bosses grant no extra points (no double-penalty for AFK) but bosses gate maximum tree power · Matches concept.md stating bosses are where rewards unobtainable from grinding live
- Key point: **losing to a boss = that spawn ends** (on Push the boss retreats at full health, next one must wait 15 minutes · combat.md section 7) → a locked keystone becomes the question "does my build counter enough", not "have I farmed enough"

# 7. Respec

``
respec = free · but 3-minute cooldown per 1 point pulled back
``

- Whole tree = 5 hours · 25 points = 1.25 hours · 10 points = 30 minutes
- Why not instant-free: the currency of this game is time (combat.md) · If respec is instant-free, players experiment randomly and attach to nothing · If too expensive, an idle game dares try nothing — 3 minutes/point sits at the measurable middle
- Nodes referencing unowned skills: **show "not yet easy" but still purchasable**, and take effect immediately once that skill is owned (answers old question 5: players who do not yet know a skill need not buy blindly)

# 8. Still-open slots (with reasons)

- **6 new keystones written** (skill-tree-keystone.md 5b · 18 total = 9 exclusive pairs complete). Entry rulings closed: AoE uses the falloff table in skill-pool-system.md (mana 1.0x · 100/85/70/60/50% · Cap 5) and Elements deal full damage with Alignment gating status only (elements.md section 2). Remaining work is numeric rebalance, not rules.
- ~~122 minor~~ **Written** (section 4b · `tools/tree.js`) · Minor nodes must be small measurable rules · Before writing, a "minor value table" must be set (recommended 0.3-2% each), otherwise they become Mods on gear moved into the tree
- ~~Tree look / tiers per branch~~ **Laid out** (section 4b). Numbers already enforced: 3 branches · keystones at Tiers 8-12 of each limb · 122 minor + 18 keystone · 1 central hub start
