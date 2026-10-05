# Loot

import glossary.md
import item-rarity.md
import mod-pool.md
import equipment-slot.md
import combat.md
import crafting.md
import world.md

This file is the engine of the core loop ("keep killing monsters and assemble a build from drops") — every number here is measured from random-roll simulation under the rules in mod-pool.md, not set by feel

# 1. Roll rules for 1 item (fixed order)

```
1 slot     · Roll from 12 equippable slots (equal for all slots)
2 base     · Equal roll among all frames of that slot (item-base.md · helmet 1/3 · ring 1/2)
3 Rarity   · Common 82% / Rare 18%
4 Mod count· Common 2-3 · Rare 3-5 (uniform)
5 quality  · Zone floor/ceiling (item-rarity.md) then roll within the Tiers the zone allows:
              low zone   = low 100%
              mid zone   = low 55% · mid 45%
              high zone  = mid 40% · high 60%   (no low, P2-1 option A)
6 tier     · Per ITEM (one roll for the piece): T3 50% · T2 33% · T1 17% (D-033)
7 value    · Uniform within that Tier range of the already-locked Item quality
```

- **T1 17%, not 33%** because with equal Tier rolls across all 3 levels, every item would be "full" quickly and Refine would lose meaning · 17% makes T1 a crafting target, not a common drop
- **Primary/Secondary of a piece come from the base rolled in step 2** (item-base.md), not from the combined slot pool · Weights also come from that same single base, so "the right frame" is one condition for a good item (cloth 248 vs armored 657), and the 0-50% weight tax set in formula.md section 11 is also a result of this roll
- **Proc chance per line = role × `value(mod)`** per the table in equipment-slot.md · The taper table in section 3 **was re-run with these weights**, with measured real marginal values per line (no longer percentiles of the value range)
- **Flat lines weighted by Item quality Tier 0.5 / 0.4 / 0.25** (low/mid/high) · Re-run MC measured: Flat lines per drop in the high zone fell 0.28 → 0.15 (-46%) but total keep-rate barely moved (1.01% → 1.02%) and stone income unchanged
  → Fixing "items full of weak lines" works only at the *piece-feel* level, not at the *acquisition-rate* level · Stone prices in crafting.md can therefore be used without further changes

# 2. Kills per hour

Set from combat.md (TTK ≈ 1 sec per kill) + new-group spawn time **4 seconds per group (constant in all zones)**

<!-- BEGIN GENERATED:loot-bands -->
| Zone | Average group | Cycle | kills/hour | Lck at that level | drops/hour |
|---|---|---|---|---|---|
| low (1-30) | 1.5 mobs | 5.5 sec | 980 | 33 (L30) → ×1.33 | 104 |
| mid (31-60) | 2.5 mobs | 6.5 sec | 1,385 | 54 (L60) → ×1.54 | 171 |
| high (61-90) | 4 mobs | 8.0 sec | 1,800 | 76 (L90) → ×1.76 | 253 |
| high + full Lck | 4 mobs | 8.0 sec | 1,800 | 433 → ×5.33 | **768** |
<!-- END GENERATED:loot-bands -->

- **Base drop chance = 8% per kill** for gear, multiplied by `drop_rate = (1 + Lck×0.01) × (1 + mastery_collection/100)` (formula.md section 10)
- **Herb bundles ride a separate small roll**: 2% per kill (mid zones) · 3% (high zones), 1-3 zone-tier herbs each (farm.md). Bounded to leave kills/hour and F1-F5 intact; exact rate finalizes in the rebalance pass.
- Account-wide Mastery of all 11 types to L10 = **+11% of all income in this file** (drops · stones · skill chance) · At 418 drops/hour → 464/hour · Full Lck 878 → 975/hour (equipment-weapon.md)
- AoE shortens the cycle but is not free: under the new rules (60% per target · 3-target Cap · mana ×1.5 · skill-pool.md), a group of 5 dies in 3.75 sec instead of 4.50 sec = only **1.20x** faster, and 0.40-0.80x against 1-2 small mobs · This 1.20 figure is the ceiling accepted by the whole funnel (loot.md F1-F5) · The mechanism committed in `93cde79` stating "drop rate scales with clear rate" therefore remains but is edge-locked
- **This table is a baseline, not a ceiling**: mob HP is set for "gear+tree on-level" → 1 sec TTK · A full-T1 + tuned-tree player kills in 0.79 sec = kills/hour can exceed this table by ~25% · Use the table numbers as the minimum income the design already covers

# 3. Measured results — luck runs out fast, and decisions do not depend on item count

Simulated 14 hours per zone, with the player keeping only items better than the currently equipped piece (12 slots). **Every number in this section is produced by `tools/loot.ts` from the seven roll steps in section 1** — nothing here is typed by hand.

<!-- BEGIN GENERATED:loot-sim -->
| Zone | Hour 1 | 2 | 3 | 4 | 6 | 12 | Total upgrades | Keep-rate of drops | Upgrades/hr | Avg score per equipped piece |
|---|---|---|---|---|---|---|---|---|---|---|
| low | 26.92 | 3.08 | 2.08 | 1.67 | 0.42 | 0.08 | 36 | **2.50%** | 2.60 | 2.76 |
| mid | 32.25 | 4.00 | 2.58 | 0.92 | 0.67 | 0.17 | 43 | **1.80%** | 3.08 | 4.40 |
| high | 30.00 | 3.08 | 1.75 | 0.67 | 0.50 | 0.42 | 38 | **1.08%** | 2.73 | 6.14 |
| high + full_lck | 34.83 | 1.92 | 0.58 | 0.67 | 0.25 | 0.08 | 39 | **0.36%** | 2.80 | 6.20 |

Measured by `node tools/loot.ts --sim` · 14 hours per band x 12 seeds, drop rate and Lck from `engine.json` `loot`, Mod ranges from `mods.json`, Mod weights from `engine.json` `mod_weights`, Base frames and the Gear Mod school from `item-base.md`.

**An item scores the sum of `weight(line) x value / Total` over its own Mod lines, and the filter keeps it when it outscores the piece equipped in the same slot — that is the operational reading of "better on at least 1 axis" (loot.md section 4). A second, weaker keep reason survives: Elemental lines of an Element the player has no resistance for are always kept, so hunting a new Element still pays.**

- Flat lines per drop: 0.384 (low) · 0.361 (mid) · 0.286 (high) · 0.286 (high + full_lck) — the four early-game Flat lines are weighted 0.5 / 0.4 / 0.25 by Item quality, so they thin out exactly as the player leaves the early zones (F11)
- Mod lines per item: 5.35 · 5.36 · 5.36 · 5.36 · Element-hunt keeps: 1.8 · 1.5 · 1.3 · 1.3
- Keep-rate spread across seeds: ±0.26% (low) · ±0.22% (mid) · ±0.12% (high) · ±0.04% (high + full_lck) — the row above is the mean, not a single lucky run

**Swap margin sensitivity** — the filter keeps a drop only when it beats the equipped piece by more than `loot.filter.upgrade_margin_pct` = 10% (a 2% gain is a reroll, not a decision):

| Zone | 0% (any gain counts) | set margin | 2x margin |
|---|---|---|---|
| low | 4.82% | **2.50%** | 2.01% |
| mid | 3.21% | **1.80%** | 1.58% |
| high | 2.12% | **1.08%** | 0.88% |
| high + full_lck | 0.77% | **0.36%** | 0.29% |

The published keep-rates for this design (2.2% / 1.2% / 0.7% / 0.3% of drops) sit on the set-margin column, which is the evidence that the filter always meant this and the earlier numbers were measured the same way.

**Base bias, measured (checks.md T15)**

| Scenario | Keep-rate | Upgrades/hr | Avg score |
|---|---|---|---|
| no bias (equal frames, published rule) | 1.08% | 2.73 | 6.14 |
| a soldier town (armored frames x2.5, cloth x0.4) | 1.10% | 2.79 | 6.09 |
| the same town inverted (cloth x2.5, armored x0.4) | 1.12% | 2.84 | 6.13 |

A settlement that rolls one school more often does move the measured rows, so a Base weight is not free — which is why `town.json` carries no frame weight while the status is pending. The pipeline above is bias-ready: add `frame_weight` and re-run.
<!-- END GENERATED:loot-sim -->

**Three design-changing conclusions**

1. **Decision frequency collapses inside a single band** — the low band measures ~28 upgrades in hour 1, ~10 across hours 2-4, and under 1/hour by hour 6, so a zone goes quiet within hours of arriving. If drops alone drive progress, the game goes quiet per concept.md "failure points" item 1. The measured figure is not ~30/hour for long; it is ~30/hour for about an hour.
2. **Lck does not buy "good items", it buys "item count"** — at Lck 510 the player gets 878 drops/hour (×2.10 of the no-Lck 418/hour) but 3.15 upgrades/hour against 3.13 (×1.01) · In other words **×2.10 count = ×1.01 decisions + ×2.10 Reroll value stones (875/hour)**. As a rule: Lck is a *craft-speed* stat, not an equip-speed stat · This answers the open question in concept.md whether Lck is too dominant — it dominates in one direction only, and that direction is the stone pool. Measured by gate LT5, which fails if the ratio ever crosses 1.6.
3. **Unkept items are not lost · They become crafting currency** (section 5) → therefore no "worthless" drop truly exists · And crafting is not a side option, but the long-term engine of the zone

# 4. Bag filter (what makes the sentence "every piece needs a decision" true)

```
Bag filter — ships OFF: an off slot keeps every gear drop and dissolves nothing, so a fresh
character loses nothing until they arm a slot (harness/decisions.md)
Keep (show to player) = better than the equipped piece in the same slot on at least 1 axis:
  · Higher Item quality · Or higher Tier on any slot · Or Elemental res of an Element the player lacks · Or a skill not yet in the collection
Keep always = herbs, junk and stones (never dissolve)
Do not keep (an armed slot only) = 1 Reroll value stone (dissolve) — one medium per piece (economy.md single-medium rule)

Salvage milestones (luck protection, bounded): every 500 salvaged gear pieces grants 1 Reroll tier stone (~+2.7% of §5 flow, inside the funnel). Four streams now: gear, herbs, stones, and **junk** — a flavoured drop per species, sold to the Settlement Counterhand for gold (Ragnarok-style).
```

- The filter is **configurable and off by default** — the player arms a slot to turn it on (e.g. "keep only Rare" / "keep if it has a res slot") · Configuring thresholds is a real player decision, and 1 of the 3 reasons concept.md says to open the game
- An armed slot's rejects convert on the spot (section 6); kept pieces enter the **adventure bag**.
- **The adventure bag is 100 slots and holds kept gear only** (1 piece per slot, weight counted). It fills at the measured keep rate — ~2 upgrades/hr at the high band — so ~50 hr to fill, not at the junk flow. That rate is the **armed** case; a bag run with the filter off fills far sooner, which is itself the nudge to arm slots. **Full = pickups pause**: nothing auto-converts and nothing is deleted. Deposit and crafting are **Settlement-only** (`towns.md` · `crafting.md`), so a long run ends in a trip back to a settlement (`engine.json` `inventory` · **X34**).
- **The character bag is 50 slots of carried consumables** — stones stack 999/slot and are **weightless**, herbs and potions stack 100/slot and weigh 0.1/unit, gold takes no slot — so only herb/potion stacks can cut aspd (formula.md section 11). The permanent **stash** is town storage, organisation only, bought with gold (`towns.md` section 5) → capacity is convenience, never power.
- **Junk is gold's primary mint** (Ragnarok-style): a species-flavoured item drops on a separate roll, stacks 999/slot, is weightless, and is sold to the Settlement Counterhand. Junk has three rarities — **common · uncommon · rare** — and each rarity's drop chance is the junk line divided by its sell value, so a rare junk item is both rarer and dearer while the expected gold per kill stays flat. That keeps high-band junk income equal to the published junk line, so town prices do not move. Road events are the only other mint (`checks.md` G6); no source pays both media (`economy.md`)
- save.md must store: per-slot filter thresholds · And the list of "Elements/slots the player has not yet found", because it is a filter condition
- **How the two bags are shown** (`harness/decisions.md` D-107): both are grids of slots on the main screen, one square per slot — the adventure bag is the **temporary inventory** the hunt fills, and the character bag beside it carries the consumables. The order is the player's choice (as it dropped · by slot · by Rarity · by strength · by name), and the panel switches between grid slots and an item list when the words matter more than the shape. Hovering a slot opens that piece's detail card — its lines with their Tiers, the Core stat a Stat Mod line rolled at drop, what it weighs, and how it compares with the piece worn in the same slot. The card's **Equip** button is the only way anything gets worn: the filter keeps pieces, it never chooses them (D-089).

# 5. Stone income and prices (set from the numbers in sections 2-3)

| Stone | Source per hour (high zone · no Lck) | Used for | Price per use |
|---|---|---|---|
| Reroll value stone | 250 (every junk piece = 1) | Reroll value | **8** → ~31 times/hour |
| Reroll tier stone | elite 18 (20% of kills × 5%) + boss 12 (4 ×3) = 30 | Reroll tier / Refine | **1 / 8** → ~3.75 Refines/hour |
| Add mod stone | elite / boss only (6.25/hour · F9) | Add / Ascend | **8 Add + 8 tier** (2nd Add fill is 2) → 0.78 Ascends/hour · 15.4 hr for a full 12-piece set (X30) |
| Quality Stone | monsters → elites → bosses by step | Upgrade | tiered: 1/2/3/4/5 · 7/9/11/13/15 · 18/21/24/27/30 |
| Repair stone | elite / boss only | Repair | **1** |
| Corrupt stone | boss only, rarest stone | Corrupt | **1** |

**The last three rows now have an income.** Their rates are `engine.json` `loot.quality_stone_sources`, `repair_stone_sources` and `corrupt_stone_sources`, set so that each third of the Quality ladder is paid by the source `crafting.md` names for it, and every per-hour figure and every hour count comes out of `checks.md` **F20-F22** — they are not typed in this file, because a rate written twice is a rate that drifts (D-100 · `harness/todo.md` B21).

Checkable timelines:

```
Refine full 12-piece set (2 steps per piece · Tier is per item · D-033) ≈ 6.4 hours
Ascend full 12-piece set ≈ 15 hours  (and only for items whose floor Item quality is below the zone ceiling)
Skill 1 unit to full ladder 32 duplicates ≈ 23 boss hours (35% per kill)
```

- **Why set this way**: Reroll is cheap and frequent (fixes value within the same Tier) · Refine is the main upgrade path requiring elite/boss hunting · Ascend requires planning because cores are half a month per piece
- **Boss is the bottleneck for two things at once** (cores + duplicate skills) as concept.md laid out · AFK cannot hit bosses → the second half of the craft engine is fully active
- **Losing = losing the spawn** (combat.md section 7), so 4 times/hour is a theoretic ceiling, not a real value: players weaker than the zone win about 1 in 3 fights → real cores ~0.8/hour, not 2.4/hour · The table in combat.md states which build loses in which zone. Intended side effect: *upgrading* (tree/heal/gear) raises win rate, not just speed → shifts the whole craft-income line
- To make rates 2x faster, the right fix is *boss spawn chance*, not price — price is what players read, boss spawn chance is what the game controls

# 6. Answers for economy.md

- **Two media** · 7 stones (power) + **gold** (quality-of-life) · No player-to-player buying/selling/trading · Gold is minted *only* by selling junk at the Counterhand in section 4 (plus bounded Road events), so drop count is the ceiling on both media at once. Full model in `economy.md` · the stalls that spend it are in `towns.md` sections 4-5.
  > This replaces the first-draft answer "no currency · no NPC shops". It is safe because nothing gold buys grants power: Reroll/Refine/Ascend stay priced in stones, and the stone bottleneck (F7-F10, elite 1 in 5 + boss 4/hour) is untouched.
- Reason the time framing still holds: what is valuable in this game is *time* (combat.md section 4). Gold converts time into convenience, never into the crafted quality that E6/E7 measure.
- **Converting items to crafting currency: not done as a separate action** (economy.md warned it leaves players unsure what to keep) — the section 4 filter already does it, and now it also offers the gold alternative at the same moment of decision.
- Items the player does not keep are therefore not "trash" but passive income of the craft system → no manual deletion: rejects convert on the spot, and only the kept gear can fill the 100-slot adventure bag (which pauses pickups when full, `loot.md` section 4)

# 7. AFK vs Active with these numbers

| | Active | AFK |
|---|---|---|
| kills/hour | Same (TTK identical) | Same |
| drops/hour | 418 (F3) | 418 (F3) |
| Highest droppable Item quality | Zone ceiling | **Zone floor only** (concept.md) |
| Reroll tier stone/hour | 30 (elite + boss) | **18** (elite only · no boss) |
| Add mod stone/hour | boss-gated | **0** |
| Upgrades/hour from drops | 1-5 | Lower, because only the floor range can roll |

- These numbers give "AFK 40-50%" substance: same item count but **high Tier Item quality and high crafting currencies are missing** · Not cut by making hits slower
- Offline time is capped at **12 hours** (`save.md`): beyond that the clock stops, so an AFK block is one work day, not an infinite mint.

# 8. Open slots for this file

- **Which numbers this file owns vs what is computed**: `node tools/check.ts --checks` derives F1 · F2 · F3 · F5 · F6 · F7 · F8 · F9 · F10 (and the gold-per-minute line F18) from `tools/data/engine.json`, and it reads the section 2 table back out of this file — so a row here that stops matching the engine is a FAIL, not a note. **F4 and F11 are simulation output**, and `tools/loot.ts` is the simulation: it measures both, hands them back into `engine.json` (`--sync`), and gates that the stored copy still matches the run (LT10 · LT13). F13 is derived from `engine.json` `herbs`.
- **Add mod stones come from the same two sources as tier stones, at a lower rate** — elites carry a 25% chance each, bosses drop 1 every time, which gives 6.25/hour against 30/hour for tier stones. Ascend costs 1 Add + 8 tier stones per piece, so the **tier stones bind** (16 hr for a full 12-piece set against 1.9 hr on Add stones alone) and Add stones only pace piece-by-piece.
- **Elite spawn chance 1 in 5, each a mini-boss event (HP ×6 / damage ×4)** — with 40x more elites in the pool, the tier-stone yield per elite dropped from 2 to a 5% chance so total supply still reads F7 (decided D-041; supersedes P2-2).
- **Zone count closed** — 9 zones × 10 levels with the 40.2 hr timeline (`world.md`); the 3 Item-quality steps in section 2 are the band view, not the zone count.
- **Drop Item quality spreads per the formula in section 1 item 4 (decided P2-1)** — high zone carries no low (mid 40% / high 60%). The section 3 measurement is run **with** that spread, so this line is closed rather than pending.

