# Mod Pool by Slot

import glossary.md
import mod-pool.md
import formula.md

> **The tables below are the "union" of all Bases in that slot** · an actual dropped item has only one Primary/Secondary set, from the Base it rolled (Ring Mail ≠ Plate Vest ≠ Vestment) · see item-base.md
> The Offensive/Defensive rule and the Stat Mod pool below apply identically to every Base

Pool assignment criteria

- **Primary** — rolls often (normal weight)
- **Secondary** — rolls less often (low weight)
- **Blocked** — never rolls on this item
- **Offensive** — rolls only on weapon items
- **Defensive** — all other items, defense-side only
- **Stat Mod** — every slot always accepts it (see next section)
- Every slot rolls values from its Item quality range set, and Tiers inside that set (see glossary.md)

## Stat Mod (every item)

**Stat Mod flat rolls on every item with no exceptions. No slot blocks it.**

| | |
|---|---|
| Stat Mod flat | Rolls on every item · picks from str / vit / dex / agi / wis / int / lck · range 5-25 by quality |
| All stats flat | Rolls on every item · adds its one value to all seven Core stats at once · range in mod-pool.md |

**Additional rules**

- One item rolls **at most 1 Stat Mod line**, drawn from the family `mods.json` marks `group: Stat Mod`: either a single Core stat, whose stat is baked at drop the way a PoE implicit carries its own, or the all-stats sibling that lifts all seven at once (D-127 · D-129 · X44 · X45). D-114 retired the `Stat Mod %` sibling, so both the flat + % pairing and the same-stat pairing are gone
- Weights: Primary 1.0 · Secondary 0.5 · Stat Mod 1.0 (equal to Primary on every item) — then multiplied by `value(mod)` from the per-Mod weight section
- If an item already has that stat in Primary/Secondary, e.g. main hand has Str Flat, that counts as its Stat Mod slot. Never roll the same slot twice
- Per-item ceiling is one Flat slot at the T1 top of its range; the twelve worn items together are the single-stat ceiling printed in formula.md section 0
- **Slots 6-7 (Add mod stone) never roll Stat Mod flat while the item already holds its Stat Mod slot.** Added mods roll from the Base Primary/Secondary pool at the item quality/tier of the piece.
- **Stat Mod is the only path for all 7 stats from every item** because the Offensive/Defensive rule closes direct Str/Int/Dex/Agi/Wis Mods on main hand
- Defensive items have no Vit % / Vit Flat in-pool. Vit must come through Stat Mod only

# Defensive Pool

Defense-side Mods covering every item outside main hand. Only Primary vs Secondary differs per item.

<!-- BEGIN GENERATED:defensive-ranges -->
| Mod | Range |
|---|---|
| Armour flat | 8-40 |
| Armour % | 3-16% |
| Cooldown reduction % | 5-25% |
| Energy Shield flat | 12-60 |
| Evasion flat | 6-30 |
| Evasion % | 3-16% |
| Life Regeneration flat | 2-31 |
| Life Regeneration % | 5-15% |
| Mana Regeneration flat | 2-31 |
| Mana Regeneration % | 10-25% |
| Max Energy Shield % | 3-16% |
| Max HP % | 3-16% |
| Max HP flat | 40-200 |
| Max Mana % | 3-16% |
| Max Mana flat | 20-140 |
| Perfect dodge % | 1-3% |
| Status Alignment resistance % | 5-25% |
| Block chance % | 10-50% |

Every range here is the same row `mod-pool.md` prints, read from `tools/data/mods.json` — the two tables cannot disagree.
<!-- END GENERATED:defensive-ranges -->

# Offensive Pool

Attack-side Mods. Roll only on main hand (and off hand while dual-wielding).

| Mod | Range |
|---|---|
| Physical power flat / % | 15-80 / 3-16% |
| Magic power flat / % | 15-80 / 3-16% |
| Elemental power flat / % | 12-64 / 3-14% |
| Critical chance % | 1-8% |
| Critical damage % | 12-120% |
| Attack speed % | 5-25% |
| Accuracy % | 5-25% |
| Str flat / % · Int flat / % | 5-25 / 1-5% (by weapon type) |

# Mod Availability by Slot

Which Mod can appear on which slot, read out of every Base row in `item-base.md` plus the main-hand weapon pool in `equipment-slot-weapon.md`. **This table is generated** — edit those files, not this one.

<!-- BEGIN GENERATED:mod-matrix -->
| Mod | main hand | off hand | helmet | chest | pant | boots | belt | gloves | ring | amulet | earring | cape |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| All stats flat | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| Stat Mod flat | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| Accuracy % | yes | - | - | - | - | - | - | - | - | - | - | - |
| All Resistance % | - | - | - | - | - | - | - | - | yes | yes | yes | yes |
| Armour % | yes | - | yes | yes | yes | yes | - | yes | - | - | - | yes |
| Armour penetration % | yes | - | - | - | - | - | - | - | - | - | - | - |
| Attack speed % | yes | - | - | - | - | - | - | - | - | - | - | - |
| Block chance % | - | yes | - | - | - | - | - | - | - | - | - | - |
| Chance to bleed % | yes | - | - | - | - | - | - | - | - | - | - | - |
| Chance to stun % | yes | - | - | - | - | - | - | - | - | - | - | - |
| Cooldown reduction % | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes |
| Critical chance % | yes | - | - | - | - | - | - | - | - | - | - | - |
| Critical damage % | yes | - | - | - | - | - | - | - | - | - | - | - |
| Elemental alignment % | - | yes | yes | - | - | - | - | yes | yes | yes | yes | - |
| Elemental power % | yes | - | - | - | - | - | - | - | - | - | - | - |
| Elemental power flat | yes | - | - | - | - | - | - | - | - | - | - | - |
| Elemental resistance % | - | - | yes | yes | yes | yes | yes | - | - | - | yes | yes |
| Evasion % | - | yes | yes | yes | yes | yes | - | yes | - | - | - | yes |
| Life Regeneration % | - | - | yes | yes | yes | yes | yes | yes | - | - | - | - |
| Magic power % | yes | - | - | - | - | - | - | - | - | - | - | - |
| Magic power flat | yes | yes | - | - | - | - | - | - | - | - | - | - |
| Mana Regeneration % | - | - | yes | yes | yes | - | yes | - | - | - | - | yes |
| Mana Regeneration flat | - | yes | - | - | - | - | - | - | - | - | - | - |
| Max Energy Shield % | - | - | yes | yes | yes | yes | - | yes | yes | yes | - | yes |
| Max HP % | - | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | - |
| Max HP flat | - | yes | yes | yes | yes | yes | yes | yes | - | - | - | yes |
| Max Mana % | - | yes | yes | yes | - | - | yes | - | yes | - | yes | yes |
| Max Mana flat | yes | yes | - | yes | yes | yes | - | yes | - | yes | - | yes |
| Physical power % | yes | - | - | - | - | - | - | - | - | - | - | - |
| Physical power flat | yes | - | - | - | - | - | - | - | - | - | - | - |
| Armour flat | yes | - | yes | yes | yes | yes | - | yes | - | - | - | yes |
| Energy Shield flat | - | - | yes | yes | yes | yes | - | yes | - | - | - | yes |
| Evasion flat | - | - | yes | yes | yes | yes | yes | yes | - | - | - | - |
<!-- END GENERATED:mod-matrix -->

- `yes` = the Mod can roll on that slot · `-` = it never rolls there
- **The Stat Mod lines are the only Mods with no `-`** — they roll on all 12 slots, which is the point of the pool
- **There are no per-stat Mods.** `Str flat`, `Int %` and their partners are not separate lines: every stat on every item arrives through Stat Mod. A weapon type changes *which* stat its Stat Mod favours, not which Mod can roll (equipment-slot-pools.md)
- **Armour flat / Evasion flat / Energy Shield flat never leave the five armour slots** (helmet · chest · pant · boots · gloves) — belt · rings · amulet · cape · off hand roll none of the three (item-base.md)
- **Off hand has two faces**: its own Bases (Buckler / Kite Shield / Grimoire) are Defensive, but a dual-wield off hand uses the main-hand weapon pool at half Primary weight
- Primary vs Secondary is per Base, not per slot — the table shows the union across a slot's Bases

# Weight per Mod (closes open point 4)

Effective weight = **role weight x Mod weight**

```
P(select Mod X from this Base) = role(X) x value(X) / Σ(role x value)
role: Primary = 1.0 · Secondary = 0.5 · Stat Mod = 1.0 (per remaining slot)
```

`value(X)` is set from **one measured marginal-value line** (calculated from formula.md formulas at a 12-item maxed-stat build), not from feeling.

<!-- BEGIN GENERATED:mod-weights -->
| Mod | Value at level 100 | Early-game value (level 10 - low quality) | weight | Reason |
|---|---|---|---|---|
| Max HP % | +16% EHP | +7% | **0.8** | Strongest defense line → slightly rarer by design |
| Physical/Magic power % | +16% DPS | +7% | **0.8** | Same on the attack side |
| Critical damage % | +22% DPS (at 18.5% crit) | +5% | **0.7** | Strongest line in the table · must be a target, not an accident · **rises once the crit pool passes 100, because overflow crit chance also lands here (formula-offense.md section 3) — the 0.7 is the no-overflow value |
| Attack speed % | +16.5% DPS | +12% | **1.0** |  |
| Elemental resistance % | +8.3% EHP | +1.6% | **1.0** | Element builds hunt repeats, so no reduction |
| Critical chance % | +7.9% DPS | +9% | **1.0** |  |
| Accuracy % | +4.2% DPS | +3% | **1.2** | Cheap but lifts the 80% hit floor · frequent filler |
| Stat Mod flat | +3.1% (on a maxed stat) · **+11.9%** (on an uninvested stat) | +5.5% | **1.0** | Stat Mod flat rolls on every item, so an uninvested stat is always reachable — the single-stat half of the Stat Mod slot |
| All stats flat | +96% of a fresh build's uninvested stat line, and it thins toward the flat ceiling as the stats fill | +11% | **0.5** | A PoE-style all-attributes line: one roll lifts all seven Core stats at once (D-129), so it is weighted rarer than the single-stat Stat Mod flat it shares the slot with |
| Elemental alignment % | +5 points of Cap 50 (= +10% Element damage) | +5% | **1.0** | Element builds only |
| Cooldown reduction % | +6.1 CDR points ≈ +1.9% DPS | +4% | **0.6** | Whole skill list is worth only +7.7% DPS (skill-pool.md) → CDR is truly a secondary line |
| Max HP flat | +1.0% EHP | +2.1% | **.50 / .40 / .25** | Dies off late-game · weight differs by quality tier (low 0.5 · mid 0.4 · high 0.25) |
| Max Mana flat | +2.9% of pool · no EHP | +8% | **.50 / .40 / .25** | Matters only while the pool is still small |
| Max Mana % | +16% of pool · auras **reserve a fixed %**, so a bigger pool leaves a bigger usable pool after reserving | +8% | **0.8** | Cast builds channel longer · aura builds like this line |
| Physical/Magic power flat | +2.0% DPS | +2.9% | **.50 / .40 / .25** | Same as Max HP Flat — an early-game line |
| Elemental power flat / % | ~21% of a hit after the Alignment gate | — | **1.0** | Element builds required |
| Armour / Evasion / Energy Shield flat | per Base school | — | **1.0** | The Gear Mod is the Base's own school line (item-base.md), so it rolls at Primary weight on the five armour slots; the three Gear Mod weights were missing before the loot sim and are set here |
| Max Energy Shield % | +16% of the shield pool | +7% | **0.8** | The Int build’s scaling defensive line, same shape as the Max HP % and Max Mana % it sits beside |
| Life Regeneration % | +15% of the Vit-derived regen line · Vit 510 × 0.25 = 127.5/sec, so +19.1/sec and 13% off Push downtime | +5% | **1.0** | Recovery, not a pool — it cannot raise the ceiling, so it is the defensive line that never breaks an HP Cap, and the only one that shortens the walk back to camp (checks.md D9) |
| Mana Regeneration % | +25% of the Int-derived regen line · Int 510 × 0.18 = 91.8/sec, so +23.0/sec of cast sustain | +10% | **1.0** | Mana is the real casting bottleneck as designed (skill-pool-system.md), so this buys uptime with the bar full rather than more damage per press |
| All Resistance % | +11.1% EHP across all five Elements at once · 20% off the Elemental half of a 50/50 hit | +2% | **0.7** | Weaker per Element than Elemental resistance % (top 20 vs 30) precisely because it covers all five, and it lands on the ring, amulet and cape slots that carry no resistance today — rarer by design |
| Armour % | +3.7 points of cut on a zone-9 physical half (41.7% -> 45.4% at full Str, no flat) | +2.2 points | **0.8** | A PoE ratio cuts less of a bigger number, so a % on Armour is a modest line by construction (D-022 · X22 holds the cut inside 10-40%) — same rarity as Max HP % |
| Evasion % | +2.2% evasion on the Dex line (105 -> 122 at Dex 210) | +1.3% | **0.8** | Evasion is a rating fed straight into the entropy roll, so it scales cleanly where Armour does not |
| Life Regeneration flat | +31/sec on top of 128/sec (Vit 510 x 0.25) = +24% | a level-1 build has 3/sec, so +31 more than doubles it | **.50 / .40 / .25** | Dies off late-game exactly like Max HP Flat — weight differs by quality tier (low 0.5 · mid 0.4 · high 0.25) |
| Mana Regeneration flat | +31/sec on top of 92/sec (Int 510 x 0.18) = +34% | a level-1 build has 1.8/sec | **.50 / .40 / .25** | Same early-game shape as Life Regeneration flat; the flat form carries the first zones where the % form has nothing to multiply |
| Perfect dodge % | scales the Lck line, so it is worth most on a build that has not finished the line | a level-1 Lck sits at under 1%, where +3% is a large multiplier on the chance | **0.7** | The Cap binds near the top of the maxed Lck ratio, so this line is worth least on a maxed-Lck piece and decisive on a low one — the same shape as an % line on any other low rate. It is also defined but not offered: no Base pool in bases.json rolls it, so today it is a drop-weight row and nothing more (harness/todo.md). |
| Status Alignment resistance % | cuts the 20% status proc to 15% and cuts crowd control (stun/stop) too — the gap between status applications goes 2.3 sec -> 3.3 sec | same ratio, fewer absolute hits to proc on | **0.7** | The status proc is 20% per landed hit and there is no other gear answer to it — or to the crowd control statuses carry — (Holy veil is a timed buff, not a line), so it carries a defensive line of its own; 0.7 matches the other "answers something niche" defensive rows |
| Chance to bleed % | a second bleed source beside Lacerate's own 40% while the curse is up (formula-offense.md section 4) | bleed is a fixed fraction of one physical hit, so the line is worth the same at every level - only the hit behind it grows | **0.7** | A weapon-only line (one-handed and two-handed axes, D-123). It is the always-on answer to the bleed slot Lacerate already owns, so it prices like the other "answers something niche" rows; bleed is physical DoT with no Element tag and cannot crit, so the line adds reliability rather than a new multiplier |
| Chance to stun % | runs beside the lightning-Alignment stun path, which is the one that carries the Cap (elements.md section 6) | stun is a fixed 1 sec stop, so the line is worth the same at every level | **0.7** | A weapon-only line (mace, D-123). Stun stops the target clock for 1 sec - attacks and regen - and the Alignment path already prices that window, so the gear source is priced against it and the alignment Cap still binds on the lightning side |
| Block chance % | the second avoidance layer (D-123): a blocked hit is deleted outright, the same shape as perfect dodge | the Cap binds near the top of the shield's own ladder, so the line is worth most while the shield is still low | **0.7** | Shield offhand only, and line 1 rather than a random roll, so the layer cannot spread onto every slot. Weighted like the other defensive answers; formula-defense.md prints the roll order and X43 proves the Cap is reachable from the shield alone |
| Armour penetration % | cuts the mob's armour ratio, which only matters where the roster's armour is high enough to bite | the first zones' armour is small, so the line reads as near-zero there and grows into its value | **0.7** | Crossbow only, line 1 (D-123). It is a cut on the mob-side armour ratio, not a new damage multiplier, so it prices against the armour it removes; the mob roster's armour column is what decides where it pays |

Role weight multiplies in front of `weight`: Primary **1** · Secondary **0.5** · Stat Mod **1** · Gear Mod **1**
(`item-base.md` Gear Mod school). Every row is one entry in `tools/data/engine.json` `mod_weights` —
`tools/loot.ts` is the only consumer, so a weight cannot be typed twice.
<!-- END GENERATED:mod-weights -->

- **The 0.5 group is the "early-game line"** — at level 10 it is 1/3 of power, at level 100 it is 1%. In other words, *drops full of Flat lines naturally stop being upgrades just as the player moves to higher zones*. That is the mechanism making crafting (Refine/Ascend) the answer, not luck. These lines are kept intentionally because they are the early ladder.
- **Max Mana % was two-faced under the old aura drain model, and is no longer**: drain scaled with pool, so a bigger pool meant a proportionally bigger bill. Auras now **reserve a % of pool**, which locks the same percentage and leaves a bigger absolute usable pool — so Max Mana % is a **good** line for both cast and aura builds.
- Usable sum: every Base in item-base.md lists its own Primary/Secondary, then this table multiplies in. No slot pool needs edits.

- **Effect on Reroll**: a T1 range spans only 1-2 points (e.g. Max HP % T1 = 15-16) · rerolling inside the same Tier moves ~6% of that line = **~0.1-1% of item power** → Reroll is a tool to *fix bad rolls*, not a power-climbing tool (see crafting.md)
- **Every Mod line is offered at most once per item** (mod-pool.md), so `P(select Mod X)` never competes against a second copy of itself and Add mod stone always has an unused line in the Base pool.
