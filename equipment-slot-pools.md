# Mod Pool by Slot

import glossary.md
import mod-pool.md
import formula.md

> **The tables below are the "union" of all Bases in that slot** · an actual dropped item has only one Primary/Secondary set, from the Base it rolled (mail ≠ plate ≠ vestments) · see item-base.md
> The Offensive/Defensive rule and the Core stat pool below apply identically to every Base

Pool assignment criteria

- **Primary** — rolls often (normal weight)
- **Secondary** — rolls less often (low weight)
- **Blocked** — never rolls on this item
- **Offensive** — rolls only on weapon items
- **Defensive** — all other items, defense-side only
- **Core stat** — every slot always accepts it, both Flat and % (see next section)
- Every slot rolls values from its Item quality range set, and Tiers inside that set (see glossary.md)

## Core stat (every item)

**Core stat Flat and Core stat % can roll on every item with no exceptions. No slot blocks them.**

| | |
|---|---|
| Core stat flat | Rolls on every item · picks from str / vit / dex / agi / wis / int / lck · range 5-25 by quality |
| Core stat % | Rolls on every item · picks from str / vit / dex / agi / wis / int / lck · range 1-5% by quality |

**Additional rules**

- One item rolls at most 2 Core stat slots (1 Flat + 1 %) **and both slots can be the same stat**, e.g. str Flat + str %
  The old rule forcing different stats capped a single stat at 510 instead of 816, so the reference numbers across formula.md could not compute (see formula.md section 0)
- Weights: Primary 1.0 · Secondary 0.5 · Core stat 1.0 (equal to Primary on every item) — then multiplied by `value(mod)` from the per-Mod weight section
- If an item already has that stat in Primary/Secondary, e.g. main hand has Str Flat, that counts as its Core stat slot. Never roll the same slot twice
- Per-item ceiling is 1 Flat slot (max 25 at high quality T1) + 1 % slot (max 5%) · all 12 items total 300 Flat and 60%, the source of 816 in formula.md
- **Slots 6-7 (Add mod stone) never roll Core stat Flat/% if the item already holds 2 Core slots.** Added mods roll from the Base Primary/Secondary pool at the item quality/tier of the piece.
- **Core stat is the only path for all 7 stats from every item** because the Offensive/Defensive rule closes direct Str/Int/Dex/Agi/Wis Mods on main hand
- Defensive items have no Vit % / Vit Flat in-pool. Vit must come through Core stat only

# Defensive Pool

Defense-side Mods covering every item outside main hand. Only Primary vs Secondary differs per item.

| Mod | Range |
|---|---|
| Max HP flat | 40-200 |
| Max HP % | 3-16% |
| Max Mana flat | 20-140 |
| Max Mana % | 3-16% |
| Dodge flat | 3-15 |
| Dodge % | 2-10% |
| Cooldown reduction % | 5-25% |
| Elemental resistance % | 15-30% |
| Elemental alignment % | 1-5% |
| Armour flat | TBD (pending K_ARMOUR · rebalance pass) |
| Evasion flat | TBD (pending K_EVASION · rebalance pass) |
| Energy Shield flat | TBD (pending K_ENERGY_SHIELD · rebalance pass) |

# Offensive Pool

Attack-side Mods. Roll only on main hand (and off hand while dual-wielding).

| Mod | Range |
|---|---|
| Physical power flat / % | 15-80 / 3-16% |
| Magic power flat / % | 15-80 / 3-16% |
| Elemental power flat / % | 12-64 / 3-14% |
| Critical chance % | 1-8% |
| Critical damage % (physical / magic) | 12-120% |
| Attack speed % | 5-25% |
| Accuracy % | 5-25% |
| Str flat / % · Int flat / % | 5-25 / 1-5% (by weapon type) |

# Weight per Mod (closes open point 4)

Effective weight = **role weight x Mod weight**

```
P(select Mod X from this Base) = role(X) x value(X) / Σ(role x value)
role: Primary = 1.0 · Secondary = 0.5 · Core stat = 1.0 (per remaining slot)
```

`value(X)` is set from **one measured marginal-value line** (calculated from formula.md formulas at a 12-item maxed-stat build), not from feeling.

| Mod | Value at level 100 | Early-game value (level 10 · low quality) | value | Reason |
|---|---|---|---|---|
| Max HP % | +16% EHP | +7% | **0.8** | Strongest defense line → slightly rarer by design |
| Physical/Magic power % | +16% DPS | +7% | **0.8** | Same on the attack side |
| Critical damage % | +22% DPS (at 18.5% crit) | +5% | **0.7** | Strongest line in the table · must be a target, not an accident |
| Attack speed % | +16.5% DPS | +12% | 1.0 | |
| Elemental resistance % | +8.3% EHP | +1.6% | 1.0 | Element builds hunt repeats, so no reduction |
| Dodge flat | +11.4% EHP | +6.7% | 1.0 | Adds rate directly, useful for anyone |
| Critical chance % | +7.9% DPS | +9% | 1.0 | |
| Accuracy % | +4.2% DPS | +3% | 1.2 | Cheap but lifts the 80% hit floor · frequent filler |
| Core stat flat | +3.1% (on a maxed stat) · **+11.9%** (on an uninvested stat) | +5.5% | 1.0 | This is why Core stat still rolls on every item |
| Core stat % | +5% of that stat | +2% | 1.0 | |
| Elemental alignment % | +5 points of Cap 50 (= +10% Element damage) | +5% | 1.0 | Element builds only |
| Cooldown reduction % | +6.1 CDR points ≈ +1.9% DPS | +4% | **0.6** | Whole skill list is worth only +7.7% DPS (skill-pool.md) → CDR is truly a secondary line |
| Dodge % | +3.3% EHP | +0.2% | **0.7** | Multiplier on a low rate without Agi |
| Max HP flat | +1.0% EHP | +2.1% | **0.5 / 0.4 / 0.25** | Dies off late-game · weight differs by quality tier (low 0.5 · mid 0.4 · high 0.25) |
| Max Mana flat | +2.9% of pool · no EHP | +8% | **0.5 / 0.4 / 0.25** | Matters only while the pool is still small |
| Max Mana % | +16% of pool · auras **reserve a fixed %**, so a bigger pool leaves a bigger usable pool after reserving | +8% | 0.8 | Cast builds channel longer · aura builds like this line |
| Physical/Magic power flat | +2.0% DPS | +2.9% | **0.5 / 0.4 / 0.25** | Same as Max HP Flat — an early-game line |
| Elemental power flat / % | ~21% of a hit after the Alignment gate | — | 1.0 | Element builds required |

- **The 0.5 group is the "early-game line"** — at level 10 it is 1/3 of power, at level 100 it is 1%. In other words, *drops full of Flat lines naturally stop being upgrades just as the player moves to higher zones*. That is the mechanism making crafting (Refine/Ascend) the answer, not luck. These lines are kept intentionally because they are the early ladder.
- **Max Mana % was two-faced under the old aura drain model, and is no longer**: drain scaled with pool, so a bigger pool meant a proportionally bigger bill. Auras now **reserve a % of pool**, which locks the same percentage and leaves a bigger absolute usable pool — so Max Mana % is a **good** line for both cast and aura builds.
- Usable sum: every Base in item-base.md lists its own Primary/Secondary, then this table multiplies in. No slot pool needs edits.

- **Effect on Reroll**: a T1 range spans only 1-2 points (e.g. Max HP % T1 = 15-16) · rerolling inside the same Tier moves ~6% of that line = **~0.1-1% of item power** → Reroll is a tool to *fix bad rolls*, not a power-climbing tool (see crafting.md)
