# ModWorld — passive tree: the content design

Status: DESIGN DRAFT. This is the node-by-node content for the expanded tree described in [passive-tree-plan.md](passive-tree-plan.md). The plan owns the architecture, the schema and the decisions; this file owns **what the nodes are, where they sit and what they grant**. Nothing here is implemented, and no value here is in the game yet.

Approved decisions applied: D1 keystone groups are one-of · D2 two currencies · D3 **no unlock conditions — connectivity only** · D4 drawbacks are bounded `remove` rules · D5 values are authored · D6 topology is authored, geometry is derived · D7 shift-allocate the whole path · D8 two tree points a level · D9 one balance rule for the whole tree (section 2).

## 1. The shape of the answer

The existing tree is three wings, one chain each, 75 nodes, 225 ranks, every node granting a single line at a fraction of that line's `mods.json` max. The expanded tree is **twelve wings**, each a spoke radiating from a shared centre, each spoke carrying three lanes.

```
                        fleet            aim
                   \         |         /
          vital -- might -- [START] -- ward
                   /         |         \
             fortune         lore        hex
                   \         |         /
                    edge   impact  control  stream
```

| | |
|---|---|
| Wings | 12 — the three existing (`impact`, `control`, `stream`) plus nine new |
| Nodes | 306 — 75 existing + 15 upgrades to the existing wings + 216 new |
| Points to buy everything | 564 |
| Points a character has at the level cap | 381 (2 a level, D8) — **68% of the tree** |
| Keystone groups | 6 pairs, one-of each |
| Notable nodes | 36 (3 per wing) |
| Capstones | 12 (1 per wing) |

A build touches roughly two thirds of the tree. The tree is wider than the budget, so two characters at the same level are visibly different — but a character can max the three existing wings (240 points) and still have 141 left for the new ones, about four of them.

Keystones are bought with a second currency, the **attainment point**, which is a very rare reward from a completed Delivery contract (plan section 12, D2). There are twelve keystones and six groups, so a long game buys two or three of them, and the choice between them is the point.

### 1.1 How the twelve wings differ, with no unlock conditions

There is no attribute gate on any node (D3). A node is bought when it is **connected to a path the character already owns** — that is the only rule. So the wing a player walks into cannot be decided by a stat requirement, and it has to be decided by the content itself.

That is what the balance rule in section 2 does. Each of the nine new wings **concentrates** a small set of lines, and the amount a line can give is a fixed budget, so:

- the three existing wings are the **broad** answer — they touch all forty lines a little, and they are where a spread build lives;
- the nine new wings are the **deep** answer — each one takes three or four lines and pushes them much further than the broad wings do.

Choosing `might` over `control` is not "I committed my Str". It is "I want armour, and I want a lot of it, and I am willing to give up everything else for it". The tree is a set of doors, and each wing is a door with a different room behind it.

### 1.2 The existing three wings

`impact`, `control` and `stream` keep their 75 nodes, their ids, their lines and their values exactly as they are, and they gain five nodes each (three notables, a keystone and a capstone) hung on their own tails so the old topology is untouched.

## 2. The balance rule (D9)

There is exactly one rule for the whole tree, and it replaces the value ladder this document used to carry.

> **Every line has a tree budget: 130% of its `mods.json` max. A node's value is a slice of the budget of the line it grants, divided by the points spent on that line. The tree never hands out more of a line than its budget.**

Why this and not a ladder. The old ladder (3% near, 20% far) made the *far* nodes six times more point-efficient than the near ones, so the optimal play was "walk to the far nodes and ignore the rest" and the near half of the tree was dead weight. A budget has no such preference: the value of a point depends on the line, not on where the node sits.

Why 130%. It is the smallest cap that leaves every one of the nine new wings a workable budget and that keeps the new wings' value per point equal to the existing tree's. The existing tree hands out **3.67 units per point**; the nine new wings at 130% hand out **3.62** — the same economy, so a player walking into a new wing gets the same power per point as one walking into an old wing.

### 2.1 What the existing tree already spends

This is the measurement the rule is built on, and it is the reason the rule is needed at all. The existing 75 nodes do not spread their value evenly:

| Line | max | the tree gives it now | share of max |
|---|---|---|---|
| all_stat_flat | 15 | 32 | **213%** |
| critical_chance | 8 | 11 | **138%** |
| armour_pen | 15 | 16 | **107%** |
| accuracy | 25 | 26 | **104%** |
| critical_damage | 120 | 120 | 100% |
| bleed_chance | 20 | 20 | 100% |
| perfect_dodge_pct | 3 | 3 | 100% |
| max_hp_flat | 200 | 120 | 60% |
| armour_flat | 40 | 24 | 60% |
| energy_shield_flat | 60 | 36 | 60% |
| block_chance | 50 | 10 | 20% |
| magic_power_flat | 80 | 16 | 20% |
| elemental_resistance | 30 | 6 | 20% |
| life_regen_flat | 31 | 6 | 19% |
| armour_pct | 16 | 4 | 25% |
| evasion_pct | 16 | 4 | 25% |
| max_energy_shield_pct | 16 | 4 | 25% |
| status_resistance_pct | 25 | 6 | 24% |
| stat_mod_flat | 25 | 0 | 0% |
| attack_damage_pct | 16 | 0 | 0% |
| spell_damage_pct | 16 | 0 | 0% |

Six lines are already at or over their whole maximum, and three lines are never touched at all. The new wings are built into the leftovers, and the four lines whose leftovers are almost nil — `accuracy`, `armour_pen`, `bleed_chance` and `perfect_dodge_pct` — produce nodes worth **1** each, because there is nothing left to divide. That is not a bug in the new content; it is the existing tree having spent those lines already.

### 2.2 The three ways out, and the one that is still open

**Option A — rebalance the existing 75 nodes to 78% of their max, once, by hand.** Every line then sits at 78% of its maximum, the new wings fill the remaining 52%, and no line is starved. The cost is that this **changes what an existing character's tree is worth**: a crit-damage build loses about 22% of its crit damage, an accuracy build about 23%, while a block, mana or armour-percent build gains a great deal. It is a deliberate, one-time re-authoring of seventy-five numbers, and it is a balance change to a game that already has characters. **The existing tree's value goes from 826 units to 1117** — up 35% in total, but very differently distributed.

**Option B — raise the cap to 200%.** The existing tree is untouched, every line has room, and the nine new wings come out at 6.47 units per point against the existing tree's 3.67. The tree then has two economies, and the new wings are 76% richer per point than the old ones — a player would walk into a new wing and never come back. It also hands out 400 max HP from the tree alone, against a vit-driven pool of about 2180.

**Option C — leave the existing tree alone and size each new wing by the budget its lines have left.** No balance change at all, and the tree's shape tells the truth: `edge` (armour pen, bleed) and `aim` (accuracy) have almost nothing left to give, so those wings stay small, while `lore` (mana, magic) and `hex` (elemental) have a lot and grow large. The cost is a lopsided board, and four of the nine wings become thin.

**The recommendation is Option A.** It is the only one that fixes the actual defect — a tree whose mix is lopsided — and it is the only one where the whole tree shares one economy. It is also the only one that changes what live characters are worth, which is why it is still an open question and not a decision.

## 3. The wing template

Every new wing has exactly 24 nodes in the same shape. A wing's three lanes are its theme's three answers; the notable at the end of each lane is that lane's payoff.

| Depth | Nodes | Kind | Ranks | Grants | Value |
|---|---|---|---|---|---|
| 1 | 1 (`w.1`) | line (root) | 1 | 1 | from the line's budget |
| 2 | 3 (`w.2`-`w.4`) | line | 1 | 1 | from the line's budget |
| 3 | 3 (`w.5`-`w.7`) | line | 1 | 1 | from the line's budget |
| 4 | 3 (`w.8`-`w.10`) | line | 3 | 1 | three rising slices |
| 5 | 3 (`w.11`-`w.13`) | line | 3 | 1 | three rising slices |
| 6 | 3 (`w.14`-`w.16`) | line | 1 | 1 | from the line's budget |
| 7 | 3 (`w.17`-`w.19`) | line | 1 | 1 | from the line's budget |
| 8 | 3 (`w.20`-`w.22`) | notable | 1 | 3 | one slice of each |
| 9 | 1 (`w.23`) | keystone | 1 | 1 + a rule | one slice |
| 10 | 1 (`w.24`) | capstone | 1 | 3 | one slice of each |

### 3.1 There is no unlock condition (D3)

**A node is bought when it is connected to a path the character already owns. That is the only rule.** There is no attribute requirement, no stat threshold, no "you must have this much Str" on any node, and no second attribute on any wing. The `requires` key is gone from the schema.

This was decided, and it is worth recording why it is defensible: the engine's own reference build splits its stat points evenly over the seven attributes (`engine/index.ts:48`), so at the level cap a spread character already holds about **109 in every attribute**. Any absolute gate below 110 is passed by everybody and any gate above it is unreachable by a spread build; a percentage gate fixes that, but it puts a number on the node that the player cannot read without knowing the reference line. Connectivity is a rule the player already understands, and it is the rule Path of Exile uses.

What replaces the gate as the thing that makes a wing worth choosing is the **content**: each new wing concentrates a few lines and pushes them much further than the broad existing wings do (section 1.1).

### 3.2 Lane parents

`.2`/`.3`/`.4` all need `.1`. Lane A runs `.2 -> .5 -> .8 -> .11 -> .14 -> .17 -> .20`; lane B runs `.3 -> .6 -> .9 -> .12 -> .15 -> .18 -> .21`; lane C runs `.4 -> .7 -> .10 -> .13 -> .16 -> .19 -> .22`. The keystone `.23` needs `.20`; the capstone `.24` needs `.23`.

### 3.3 Cross-links

At depth 7 the twelve wings are ringed: `w.17` also needs the neighbour wing's `.17`, and so on around the ring — the same shape the existing tree already uses at ranks 7, 14 and 21 (`engine/tree.ts:101-108`). A path bought in one wing can therefore be continued in the next. The ring closes, so the `needs` graph has cycles by design; **reachability from the start is what the cage checks, not acyclicity** (the existing tree's three wings already form mutual pairs).

### 3.4 Cost per new wing

1 + 6 + 18 + 6 + 3 + 1 + 1 = **36 points** for 24 nodes.

## 4. The keystone groups (D1)

Six pairs, one-of each. A keystone group is the only exclusivity in the tree: every other node can be taken alongside anything.

| Group | Members | What the pair is |
|---|---|---|
| `group.ember.a` | `might.23` Ironwall · `hex.23` Ember | armour or elemental, two ways to pay for the same identity |
| `group.ember.b` | `edge.23` Reaver · `impact.keystone` Berserk | execution or raw physical |
| `group.frost.a` | `fleet.23` Ghost · `aim.23` Deadeye | evasion or precision |
| `group.frost.b` | `fortune.23` Loaded · `control.keystone` Bulwark | crit or defence |
| `group.ward.a` | `ward.23` Prism · `vital.23` Anchor | energy shield or life |
| `group.spell.a` | `lore.23` Archmage · `stream.keystone` Cascade | mana or sustain |

## 5. The nine new wings

Each wing concentrates a few lines and pushes them further than the broad existing wings do. The values below are **derived**, not typed: each line's budget (section 2) is divided across the nodes that carry it, so the numbers cannot drift away from the rule.

### might

Heavy armour, physical power and life. The wing for a character that wants to stand in front and not move.

| id | kind | needs | grants |
|---|---|---|---|
| `might.1` | line | start | armour_flat 3 |
| `might.2` | line | might.1 | armour_flat 3 |
| `might.3` | line | might.1 | physical_power_flat 7 |
| `might.4` | line | might.1 | block_chance 8 |
| `might.5` | line | might.2 | armour_pct 6 |
| `might.6` | line | might.3 | physical_power 1 |
| `might.7` | line | might.4 | max_hp_flat 6 |
| `might.8` | line (3) | might.5 | max_hp_flat 6/9/13 |
| `might.9` | line (3) | might.6 | attack_damage_pct 1/1/2 |
| `might.10` | line (3) | might.7 | physical_power 1/2/2 |
| `might.11` | line (3) | might.8 | armour_flat 3/5/6 |
| `might.12` | line (3) | might.9 | physical_power_flat 7/11/16 |
| `might.13` | line (3) | might.10 | block_chance 8/13/18 |
| `might.14` | line | might.11 | armour_pct 6 |
| `might.15` | line | might.12 | physical_power 1 |
| `might.16` | line | might.13 | max_hp_flat 6 |
| `might.17` | line | might.14 | max_hp_flat 6 |
| `might.18` | line | might.15 | attack_damage_pct 1 |
| `might.19` | line | might.16 | physical_power 1 |
| `might.20` | notable | might.17 | **armour_flat** — armour_flat 3, armour_pct 6, max_hp_flat 6 |
| `might.21` | notable | might.18 | **physical_power_flat** — physical_power_flat 7, physical_power 1, attack_damage_pct 1 |
| `might.22` | notable | might.19 | **block_chance** — block_chance 8, max_hp_flat 6, physical_power 1 |
| `might.23` | keystone | might.20 | **Ironwall** — armour_flat 3 · rule: `remove block_chance` |
| `might.24` | capstone | might.23 | **armour_flat** — armour_flat 3, max_hp_flat 6, physical_power_flat 7 |

### fleet

Evasion, attack speed and perfect dodge. The wing for a character that wants to be somewhere else.

| id | kind | needs | grants |
|---|---|---|---|
| `fleet.1` | line | start | evasion_flat 2 |
| `fleet.2` | line | fleet.1 | evasion_flat 2 |
| `fleet.3` | line | fleet.1 | attack_speed 1 |
| `fleet.4` | line | fleet.1 | perfect_dodge_pct 1 |
| `fleet.5` | line | fleet.2 | evasion_pct 2 |
| `fleet.6` | line | fleet.3 | evasion_flat 2 |
| `fleet.7` | line | fleet.4 | attack_speed 1 |
| `fleet.8` | line (3) | fleet.5 | attack_speed 1/2/2 |
| `fleet.9` | line (3) | fleet.6 | perfect_dodge_pct 1/1/1 |
| `fleet.10` | line (3) | fleet.7 | evasion_pct 2/3/3 |
| `fleet.11` | line (3) | fleet.8 | evasion_flat 2/3/4 |
| `fleet.12` | line (3) | fleet.9 | attack_speed 1/2/2 |
| `fleet.13` | line (3) | fleet.10 | perfect_dodge_pct 1/1/1 |
| `fleet.14` | line | fleet.11 | evasion_pct 2 |
| `fleet.15` | line | fleet.12 | evasion_flat 2 |
| `fleet.16` | line | fleet.13 | attack_speed 1 |
| `fleet.17` | line | fleet.14 | attack_speed 1 |
| `fleet.18` | line | fleet.15 | perfect_dodge_pct 1 |
| `fleet.19` | line | fleet.16 | evasion_pct 2 |
| `fleet.20` | notable | fleet.17 | **evasion_flat** — evasion_flat 2, evasion_pct 2, attack_speed 1 |
| `fleet.21` | notable | fleet.18 | **attack_speed** — attack_speed 1, evasion_flat 2, perfect_dodge_pct 1 |
| `fleet.22` | notable | fleet.19 | **perfect_dodge_pct** — perfect_dodge_pct 1, attack_speed 1, evasion_pct 2 |
| `fleet.23` | keystone | fleet.20 | **Ghost** — evasion_flat 2 · rule: `remove armour_flat` |
| `fleet.24` | capstone | fleet.23 | **evasion_flat** — evasion_flat 2, attack_speed 1, evasion_pct 2 |

### ward

Energy shield, its regen and cooldown reduction. The wing for a character that trades hits for spells.

| id | kind | needs | grants |
|---|---|---|---|
| `ward.1` | line | start | energy_shield_flat 3 |
| `ward.2` | line | ward.1 | energy_shield_flat 3 |
| `ward.3` | line | ward.1 | energy_shield_regen 2 |
| `ward.4` | line | ward.1 | cooldown_reduction 1 |
| `ward.5` | line | ward.2 | max_energy_shield_pct 2 |
| `ward.6` | line | ward.3 | energy_shield_flat 3 |
| `ward.7` | line | ward.4 | energy_shield_regen 2 |
| `ward.8` | line (3) | ward.5 | energy_shield_regen 2/2/3 |
| `ward.9` | line (3) | ward.6 | cooldown_reduction 1/2/3 |
| `ward.10` | line (3) | ward.7 | max_energy_shield_pct 2/3/4 |
| `ward.11` | line (3) | ward.8 | energy_shield_flat 3/5/7 |
| `ward.12` | line (3) | ward.9 | energy_shield_regen 2/2/3 |
| `ward.13` | line (3) | ward.10 | cooldown_reduction 1/2/3 |
| `ward.14` | line | ward.11 | max_energy_shield_pct 2 |
| `ward.15` | line | ward.12 | energy_shield_flat 3 |
| `ward.16` | line | ward.13 | energy_shield_regen 2 |
| `ward.17` | line | ward.14 | energy_shield_regen 2 |
| `ward.18` | line | ward.15 | cooldown_reduction 1 |
| `ward.19` | line | ward.16 | max_energy_shield_pct 2 |
| `ward.20` | notable | ward.17 | **energy_shield_flat** — energy_shield_flat 3, max_energy_shield_pct 2, energy_shield_regen 2 |
| `ward.21` | notable | ward.18 | **energy_shield_regen** — energy_shield_regen 2, energy_shield_flat 3, cooldown_reduction 1 |
| `ward.22` | notable | ward.19 | **cooldown_reduction** — cooldown_reduction 1, energy_shield_regen 2, max_energy_shield_pct 2 |
| `ward.23` | keystone | ward.20 | **Prism** — energy_shield_flat 3 · rule: `remove life_regen_flat` |
| `ward.24` | capstone | ward.23 | **energy_shield_flat** — energy_shield_flat 3, cooldown_reduction 1, energy_shield_regen 2 |

### aim

Accuracy, status chance and the resistances that fight status. The wing for a character that decides where a fight goes.

| id | kind | needs | grants |
|---|---|---|---|
| `aim.1` | line | start | accuracy 1 |
| `aim.2` | line | aim.1 | accuracy 1 |
| `aim.3` | line | aim.1 | elemental_alignment 1 |
| `aim.4` | line | aim.1 | status_resistance_pct 3 |
| `aim.5` | line | aim.2 | stun_chance 1 |
| `aim.6` | line | aim.3 | accuracy 1 |
| `aim.7` | line | aim.4 | stun_chance 1 |
| `aim.8` | line (3) | aim.5 | bleed_chance 1/1/1 |
| `aim.9` | line (3) | aim.6 | stun_chance 1/2/2 |
| `aim.10` | line (3) | aim.7 | accuracy 1/1/1 |
| `aim.11` | line (3) | aim.8 | accuracy 1/1/1 |
| `aim.12` | line (3) | aim.9 | elemental_alignment 1/1/1 |
| `aim.13` | line (3) | aim.10 | status_resistance_pct 3/6/8 |
| `aim.14` | line | aim.11 | stun_chance 1 |
| `aim.15` | line | aim.12 | accuracy 1 |
| `aim.16` | line | aim.13 | stun_chance 1 |
| `aim.17` | line | aim.14 | bleed_chance 1 |
| `aim.18` | line | aim.15 | stun_chance 1 |
| `aim.19` | line | aim.16 | accuracy 1 |
| `aim.20` | notable | aim.17 | **accuracy** — accuracy 1, stun_chance 1, bleed_chance 1 |
| `aim.21` | notable | aim.18 | **elemental_alignment** — elemental_alignment 1, accuracy 1, stun_chance 1 |
| `aim.22` | notable | aim.19 | **status_resistance_pct** — status_resistance_pct 3, stun_chance 1, accuracy 1 |
| `aim.23` | keystone | aim.20 | **Deadeye** — accuracy 1 · rule: `remove armour_pen` |
| `aim.24` | capstone | aim.23 | **accuracy** — accuracy 1, status_resistance_pct 3, stun_chance 1 |

### lore

Mana, magic power and spell damage. The wing for a character whose damage is not physical.

| id | kind | needs | grants |
|---|---|---|---|
| `lore.1` | line | start | magic_power_flat 9 |
| `lore.2` | line | lore.1 | magic_power_flat 9 |
| `lore.3` | line | lore.1 | max_mana_flat 12 |
| `lore.4` | line | lore.1 | spell_damage_pct 1 |
| `lore.5` | line | lore.2 | magic_power 1 |
| `lore.6` | line | lore.3 | mana_regen_flat 9 |
| `lore.7` | line | lore.4 | max_mana_flat 12 |
| `lore.8` | line (3) | lore.5 | spell_damage_pct 1/2/2 |
| `lore.9` | line (3) | lore.6 | mana_regen_pct 2/3/4 |
| `lore.10` | line (3) | lore.7 | magic_power 1/2/2 |
| `lore.11` | line (3) | lore.8 | magic_power_flat 9/14/20 |
| `lore.12` | line (3) | lore.9 | max_mana_flat 12/19/26 |
| `lore.13` | line (3) | lore.10 | spell_damage_pct 1/2/2 |
| `lore.14` | line | lore.11 | magic_power 1 |
| `lore.15` | line | lore.12 | mana_regen_flat 9 |
| `lore.16` | line | lore.13 | max_mana_flat 12 |
| `lore.17` | line | lore.14 | spell_damage_pct 1 |
| `lore.18` | line | lore.15 | mana_regen_pct 2 |
| `lore.19` | line | lore.16 | magic_power 1 |
| `lore.20` | notable | lore.17 | **magic_power_flat** — magic_power_flat 9, magic_power 1, spell_damage_pct 1 |
| `lore.21` | notable | lore.18 | **max_mana_flat** — max_mana_flat 12, mana_regen_flat 9, mana_regen_pct 2 |
| `lore.22` | notable | lore.19 | **spell_damage_pct** — spell_damage_pct 1, max_mana_flat 12, magic_power 1 |
| `lore.23` | keystone | lore.20 | **Archmage** — magic_power_flat 9 · rule: `remove max_mana_flat` |
| `lore.24` | capstone | lore.23 | **magic_power_flat** — magic_power_flat 9, spell_damage_pct 1, max_mana_flat 12 |

### vital

Life, regen and status resistance. The wing for a character that plans to be hit.

| id | kind | needs | grants |
|---|---|---|---|
| `vital.1` | line | start | max_hp_flat 6 |
| `vital.2` | line | vital.1 | max_hp_flat 6 |
| `vital.3` | line | vital.1 | life_regen_flat 2 |
| `vital.4` | line | vital.1 | max_hp 1 |
| `vital.5` | line | vital.2 | max_hp 1 |
| `vital.6` | line | vital.3 | life_regen_pct 1 |
| `vital.7` | line | vital.4 | max_hp_flat 6 |
| `vital.8` | line (3) | vital.5 | life_regen_flat 2/4/5 |
| `vital.9` | line (3) | vital.6 | max_hp 1/1/1 |
| `vital.10` | line (3) | vital.7 | life_regen_pct 1/1/1 |
| `vital.11` | line (3) | vital.8 | max_hp_flat 6/9/13 |
| `vital.12` | line (3) | vital.9 | life_regen_flat 2/4/5 |
| `vital.13` | line (3) | vital.10 | max_hp 1/1/1 |
| `vital.14` | line | vital.11 | max_hp 1 |
| `vital.15` | line | vital.12 | life_regen_pct 1 |
| `vital.16` | line | vital.13 | max_hp_flat 6 |
| `vital.17` | line | vital.14 | life_regen_flat 2 |
| `vital.18` | line | vital.15 | max_hp 1 |
| `vital.19` | line | vital.16 | life_regen_pct 1 |
| `vital.20` | notable | vital.17 | **max_hp_flat** — max_hp_flat 6, max_hp 1, life_regen_flat 2 |
| `vital.21` | notable | vital.18 | **life_regen_flat** — life_regen_flat 2, life_regen_pct 1, max_hp 1 |
| `vital.22` | notable | vital.19 | **max_hp** — max_hp 1, max_hp_flat 6, life_regen_pct 1 |
| `vital.23` | keystone | vital.20 | **Anchor** — max_hp_flat 6 · rule: `remove life_regen_flat` |
| `vital.24` | capstone | vital.23 | **max_hp_flat** — max_hp_flat 6, max_hp 1, life_regen_flat 2 |

### fortune

Crit damage and the luck line. The wing for a character that wins a small number of large rolls.

| id | kind | needs | grants |
|---|---|---|---|
| `fortune.1` | line | start | critical_damage 1 |
| `fortune.2` | line | fortune.1 | critical_damage 1 |
| `fortune.3` | line | fortune.1 | stat_mod_flat 2 |
| `fortune.4` | line | fortune.1 | critical_damage 1 |
| `fortune.5` | line | fortune.2 | critical_damage 1 |
| `fortune.6` | line | fortune.3 | critical_damage 1 |
| `fortune.7` | line | fortune.4 | stat_mod_flat 2 |
| `fortune.8` | line (3) | fortune.5 | stat_mod_flat 2/3/4 |
| `fortune.9` | line (3) | fortune.6 | critical_damage 1/2/2 |
| `fortune.10` | line (3) | fortune.7 | critical_damage 1/2/2 |
| `fortune.11` | line (3) | fortune.8 | critical_damage 1/2/2 |
| `fortune.12` | line (3) | fortune.9 | stat_mod_flat 2/3/4 |
| `fortune.13` | line (3) | fortune.10 | critical_damage 1/2/2 |
| `fortune.14` | line | fortune.11 | critical_damage 1 |
| `fortune.15` | line | fortune.12 | critical_damage 1 |
| `fortune.16` | line | fortune.13 | stat_mod_flat 2 |
| `fortune.17` | line | fortune.14 | stat_mod_flat 2 |
| `fortune.18` | line | fortune.15 | critical_damage 1 |
| `fortune.19` | line | fortune.16 | critical_damage 1 |
| `fortune.20` | notable | fortune.17 | **critical_damage** — critical_damage 1, stat_mod_flat 2 |
| `fortune.21` | notable | fortune.18 | **stat_mod_flat** — stat_mod_flat 2, critical_damage 1 |
| `fortune.22` | notable | fortune.19 | **critical_damage** — critical_damage 1, stat_mod_flat 2 |
| `fortune.23` | keystone | fortune.20 | **Loaded** — critical_damage 1 · rule: `remove block_chance` |
| `fortune.24` | capstone | fortune.23 | **critical_damage** — critical_damage 1, stat_mod_flat 2 |

### hex

Elemental power, elemental resistance and the resistance Cap. The wing for a character who picks one element and commits.

| id | kind | needs | grants |
|---|---|---|---|
| `hex.1` | line | start | elemental_power_flat 5 |
| `hex.2` | line | hex.1 | elemental_power_flat 5 |
| `hex.3` | line | hex.1 | elemental_resistance 3 |
| `hex.4` | line | hex.1 | elemental_resistance_cap_pct 5 |
| `hex.5` | line | hex.2 | elemental_power 3 |
| `hex.6` | line | hex.3 | all_resistance_pct 1 |
| `hex.7` | line | hex.4 | elemental_resistance 3 |
| `hex.8` | line (3) | hex.5 | elemental_alignment 1/1/1 |
| `hex.9` | line (3) | hex.6 | elemental_resistance_cap_pct 5/7/10 |
| `hex.10` | line (3) | hex.7 | all_resistance_pct 1/2/3 |
| `hex.11` | line (3) | hex.8 | elemental_power_flat 5/7/10 |
| `hex.12` | line (3) | hex.9 | elemental_resistance 3/5/7 |
| `hex.13` | line (3) | hex.10 | elemental_resistance_cap_pct 5/7/10 |
| `hex.14` | line | hex.11 | elemental_power 3 |
| `hex.15` | line | hex.12 | all_resistance_pct 1 |
| `hex.16` | line | hex.13 | elemental_resistance 3 |
| `hex.17` | line | hex.14 | elemental_alignment 1 |
| `hex.18` | line | hex.15 | elemental_resistance_cap_pct 5 |
| `hex.19` | line | hex.16 | all_resistance_pct 1 |
| `hex.20` | notable | hex.17 | **elemental_power_flat** — elemental_power_flat 5, elemental_power 3, elemental_alignment 1 |
| `hex.21` | notable | hex.18 | **elemental_resistance** — elemental_resistance 3, all_resistance_pct 1, elemental_resistance_cap_pct 5 |
| `hex.22` | notable | hex.19 | **elemental_resistance_cap_pct** — elemental_resistance_cap_pct 5, elemental_resistance 3, all_resistance_pct 1 |
| `hex.23` | keystone | hex.20 | **Ember** — elemental_power_flat 5 · rule: `remove all_resistance_pct` |
| `hex.24` | capstone | hex.23 | **elemental_power_flat** — elemental_power_flat 5, elemental_resistance_cap_pct 5, elemental_resistance 3 |

### edge

Armour penetration, bleed and raw damage percent. The wing for a character who wants the hit to land harder, not more often.

| id | kind | needs | grants |
|---|---|---|---|
| `edge.1` | line | start | armour_pen 1 |
| `edge.2` | line | edge.1 | armour_pen 1 |
| `edge.3` | line | edge.1 | attack_damage_pct 1 |
| `edge.4` | line | edge.1 | bleed_chance 1 |
| `edge.5` | line | edge.2 | bleed_chance 1 |
| `edge.6` | line | edge.3 | armour_pen 1 |
| `edge.7` | line | edge.4 | attack_damage_pct 1 |
| `edge.8` | line (3) | edge.5 | attack_damage_pct 1/1/2 |
| `edge.9` | line (3) | edge.6 | spell_damage_pct 1/2/2 |
| `edge.10` | line (3) | edge.7 | armour_pen 1/1/1 |
| `edge.11` | line (3) | edge.8 | armour_pen 1/1/1 |
| `edge.12` | line (3) | edge.9 | attack_damage_pct 1/1/2 |
| `edge.13` | line (3) | edge.10 | bleed_chance 1/1/1 |
| `edge.14` | line | edge.11 | bleed_chance 1 |
| `edge.15` | line | edge.12 | armour_pen 1 |
| `edge.16` | line | edge.13 | attack_damage_pct 1 |
| `edge.17` | line | edge.14 | attack_damage_pct 1 |
| `edge.18` | line | edge.15 | spell_damage_pct 1 |
| `edge.19` | line | edge.16 | armour_pen 1 |
| `edge.20` | notable | edge.17 | **armour_pen** — armour_pen 1, bleed_chance 1, attack_damage_pct 1 |
| `edge.21` | notable | edge.18 | **attack_damage_pct** — attack_damage_pct 1, armour_pen 1, spell_damage_pct 1 |
| `edge.22` | notable | edge.19 | **bleed_chance** — bleed_chance 1, attack_damage_pct 1, armour_pen 1 |
| `edge.23` | keystone | edge.20 | **Reaver** — armour_pen 1 · rule: `remove armour_flat` |
| `edge.24` | capstone | edge.23 | **armour_pen** — armour_pen 1, attack_damage_pct 1, bleed_chance 1 |
## 6. The three existing wings, upgraded

The 75 existing nodes stay exactly as they are — same ids, same lines, same values, same cross-links at ranks 7, 14 and 21. Each existing wing gains five nodes, hung on its own tail so the old topology is untouched. The existing wings are ungated, so their upgrades are ungated too — they are the free route to the same payoffs.

| Wing | id | kind | needs | grants | rule / group |
|---|---|---|---|---|---|
| `impact` | `impact.notable.1` | notable | `impact.21` | **Flurry** — attack_speed 5, physical_power_flat 16, critical_chance 2 | — |
| `impact` | `impact.notable.2` | notable | `impact.14` | **Execute** — armour_pen 3, bleed_chance 4, attack_damage_pct 3 | — |
| `impact` | `impact.notable.3` | notable | `impact.7` | **Gale** — attack_speed 3, physical_power 3, crit_damage 24 | — |
| `impact` | `impact.keystone` | keystone | `impact.notable.1` | **Berserk** — attack_speed 5, attack_damage_pct 3 | rule: `remove armour_pct` · group `group.ember.b` |
| `impact` | `impact.capstone` | capstone | `impact.keystone` | **Warbringer** — attack_speed 5, physical_power_flat 16, attack_damage_pct 3 | — |
| `control` | `control.notable.1` | notable | `control.22` | **Bastion** — block_chance 10, armour_flat 8, elemental_resistance 6 | — |
| `control` | `control.notable.2` | notable | `control.14` | **Skin** — armour_flat 8, armour_pct 3, max_hp_flat 40 | — |
| `control` | `control.notable.3` | notable | `control.7` | **Mirror** — perfect_dodge_pct 1, evasion_flat 6, block_chance 10 | — |
| `control` | `control.keystone` | keystone | `control.notable.1` | **Bulwark** — block_chance 10, armour_flat 8 | rule: `remove perfect_dodge_pct` · group `group.frost.b` |
| `control` | `control.capstone` | capstone | `control.keystone` | **Aegis** — armour_flat 8, block_chance 10, max_hp_flat 40 | — |
| `stream` | `stream.notable.1` | notable | `stream.21` | **Deep Well** — max_mana_flat 28, mana_regen_pct 5 | — |
| `stream` | `stream.notable.2` | notable | `stream.14` | **Temper** — all_stat_flat 3, life_regen_pct 3, stat_mod_flat 5 | — |
| `stream` | `stream.notable.3` | notable | `stream.7` | **Flow** — mana_regen_flat 6, mana_regen_pct 5, cooldown_reduction 5 | — |
| `stream` | `stream.keystone` | keystone | `stream.notable.1` | **Cascade** — max_mana_flat 28, mana_regen_pct 5 | rule: `remove max_hp_flat` · group `group.spell.a` |
| `stream` | `stream.capstone` | capstone | `stream.keystone` | **Spring** — max_mana_flat 28, mana_regen_pct 5, all_stat_flat 3 | — |

The existing `control.22` — the node that raises the Elemental resistance Cap — is left alone. `hex.22` adds a second route to the same line, which is the point of a second route: the free wing and the committed wing both reach it.

## 7. Totals

| | existing 3 wings | nine new wings | total |
|---|---|---|---|
| Line nodes | 75 | 9 x 19 = 171 | 246 |
| Notables | 9 (3 per wing) | 9 x 3 = 27 | 36 |
| Keystones | 3 | 9 | 12 |
| Capstones | 3 | 9 | 12 |
| **Nodes** | **90** | **216** | **306** |
| **Points** | 240 | 9 x 36 = 324 | **564** |
| Level-cap points | | | **381 (68%)** |

## 8. Layout

The layout is derived (D6), so these are the parameters the generator reads, not hand-placed coordinates.

The wheel is split in half: **one side is damage, the other side is survival and resources.** A player sees where a build leans before reading a single node.

| Anchor | Wing | Half |
|---|---|---|
| 180 | `aim` — precision | damage |
| 210 | `fortune` — crit | damage |
| 240 | `might` — heavy armour | damage |
| 270 | `impact` — offence (existing) | damage |
| 300 | `edge` — execution | damage |
| 330 | `hex` — elemental | damage |
| 0 | `lore` — mana | survival and resources |
| 30 | `control` — defence (existing) | survival and resources |
| 60 | `ward` — energy shield | survival and resources |
| 90 | `vital` — life | survival and resources |
| 120 | `fleet` — evasion | survival and resources |
| 150 | `stream` — sustain (existing) | survival and resources |

| Parameter | Value |
|---|---|
| Wings | 12, on a 30-degree pitch |
| Lanes per wing | 3, spread across 24 degrees of the wing's 30 |
| Ring gap | 14 units per depth |
| Cross-link depth | 7 |
| Start | centre, `(0, 0)` |

The existing three wings are chains of 26, 25 and 24 nodes; the generator lays a chain as a single lane down the wing's middle, so the two shapes sit together without either being re-authored.

## 9. The knobs still open

1. ~~The fill ratio.~~ **Closed by D8:** the level curve now grants two tree points a level, so a level-cap character holds 381 and the tree is 68% buyable — close to Path of Exile's own 72%.
2. ~~Where the attainment point comes from.~~ **Closed by D2:** a completed Delivery contract pays one, on a chance of 0.08 scaled by band (4% low, 8% mid, 16% high).
3. ~~The unlock conditions.~~ **Closed by D3:** there are none. A node is bought when it is connected to an owned path.
4. ~~The three lines that cannot carry a fraction.~~ **Closed by the owner — they stay.** `perfect_dodge_pct`, `elemental_alignment` and `critical_chance` keep giving one point wherever they appear. They are the tree's weakest nodes, and the balance rule makes that visible rather than hiding it: a line with nothing left in its budget says so by giving 1.
5. ~~The wing anchors.~~ **Closed:** the half-wheel in section 8 — damage on one side, survival on the other.
6. **The balance fork (section 2.2).** Option A, B or C. This is the one decision left, and Option A is the recommendation.

