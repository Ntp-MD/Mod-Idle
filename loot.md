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
6 tier     · Per slot: T3 50% · T2 33% · T1 17%
7 value    · Uniform within that Tier range of the already-locked Item quality
```

- **T1 17%, not 33%** because with equal Tier rolls across all 3 levels, every item would be "full" quickly and Refine would lose meaning · 17% makes T1 a crafting target, not a common drop
- **Primary/Secondary of a piece come from the base rolled in step 2** (item-base.md), not from the combined slot pool · Weights also come from that same single base, so "the right frame" is one condition for a good item (cloth 248 vs armored 657), and the 0-50% weight tax set in formula.md section 11 is also a result of this roll
- **Proc chance per line = role × `value(mod)`** per the table in equipment-slot.md · The taper table in section 3 **was re-run with these weights**, with measured real marginal values per line (no longer percentiles of the value range)
- **Flat lines weighted by Item quality Tier 0.5 / 0.4 / 0.25** (low/mid/high) · Re-run MC measured: Flat lines per drop in the high zone fell 0.28 → 0.15 (-46%) but total keep-rate barely moved (1.01% → 1.02%) and stone income unchanged
  → Fixing "items full of weak lines" works only at the *piece-feel* level, not at the *acquisition-rate* level · Stone prices in crafting.md can therefore be used without further changes

# 2. Kills per hour

Set from combat.md (TTK ≈ 1 sec per kill) + new-group spawn time **4 seconds per group (constant in all zones)**

| Zone | Average group | Cycle | kills/hour | Lck at that level | drops/hour |
|---|---|---|---|---|---|
| low (1-30) | 1.5 mobs | 5.5 sec | 980 | 70 (L30) → ×1.70 | 133 |
| mid (31-60) | 2.5 mobs | 6.5 sec | 1,385 | 130 (L60) → ×2.30 | 255 |
| high (61-90) | 4 mobs | 8.0 sec | 1,800 | 190 (L90) → ×2.90 | 418 |
| high + full Lck | 4 mobs | 8.0 sec | 1,800 | 816 → ×9.16 | **1,319** |

- **Base drop chance = 8% per kill** for gear, multiplied by `drop_rate = (1 + Lck×0.01) × (1 + mastery_collection/100)` (formula.md section 10)
- **Herb bundles ride a separate small roll**: 2% per kill (mid zones) · 3% (high zones), 1-3 zone-tier herbs each (farm.md). Bounded to leave kills/hour and F1-F5 intact; exact rate finalizes in the rebalance pass.
- Account-wide Mastery of all 12 types to L10 = **+12% of all income in this file** (drops · stones · skill chance) · At 418 drops/hour → 468/hour · Full Lck 1,319 → 1,477/hour (equipment-weapon.md)
- AoE shortens the cycle but is not free: under the new rules (60% per target · 3-target Cap · mana ×1.5 · skill-pool.md), a group of 5 dies in 3.75 sec instead of 4.50 sec = only **1.20x** faster, and 0.40-0.80x against 1-2 small mobs · This 1.20 figure is the ceiling accepted by the whole funnel (loot.md F1-F5) · The mechanism committed in `93cde79` stating "drop rate scales with clear rate" therefore remains but is edge-locked
- **This table is a baseline, not a ceiling**: mob HP is set for "gear+tree on-level" → 1 sec TTK · A full-T1 + tuned-tree player kills in 0.79 sec = kills/hour can exceed this table by ~25% · Use the table numbers as the minimum income the design already covers

# 3. Measured results — luck runs out fast, and decisions do not depend on item count

Simulated 14 hours per zone, with the player keeping only items better than the currently equipped piece (12 slots)

| Zone | Hour 1 | 2 | 3 | 4 | 6 | 12 | Total upgrades from drops |
|---|---|---|---|---|---|---|---|
| low | 18 | 5 | 7 | 2 | 1 | 1 | 2.2% of drops |
| mid | 12 | 3 | 9 | 2 | 3 | 0 | 1.2% of drops |
| high | 15 | 7 | 3 | 3 | 2 | 1 | 0.7% of drops |
| high + full Lck | 23 | 5 | 6 | 5 | 4 | 2 | 0.3% of drops |

- This revision uses the true value of each line (measured marginal % in equipment-slot.md · per-Mod weight table), not percentiles of the value range · And Base is included in the roll · Worthless late-game Flat lines are weighted down to 0.5, so total keep-rate *falls* slightly but is fairer, because items "full of weak lines" no longer count as upgrades
- Average gear score per piece after 14 hours per zone: 10.7 (low) · 19.1 (mid) · 27.6 (high) → **high-zone items are ~2.6x stronger than low-zone items**, which is the power slope loot buys the player

**Three design-changing conclusions**

1. **Decision frequency falls from ~30/hour to ~1-5/hour within 2-3 hours of that zone** · If drops alone drive progress, the game goes quiet per concept.md "failure points" item 1
2. **Lck does not buy "good items", it buys "item count"** — at Lck 816 the player gets 1,319 drops/hour (×3.15 of the no-Lck 418/hour) but only ~4 upgrades/hour vs ~3/hour (×1.3) · In other words **×3.15 count = ×1.3 decisions + ×3.15 Reroll value stones (1,315/hour)**. As a rule: Lck is a *craft-speed* stat, not an equip-speed stat · This answers the open question in concept.md whether Lck is too dominant — it dominates in one direction only, and that direction is the stone pool
3. **Unkept items are not lost · They become crafting currency** (section 5) → therefore no "worthless" drop truly exists · And crafting is not a side option, but the long-term engine of the zone

# 4. Bag filter (what makes the sentence "every piece needs a decision" true)

```
Keep (show to player) = better than the equipped piece in the same slot on at least 1 axis:
  · Higher Item quality · Or higher Tier on any slot · Or Elemental res of an Element the player lacks · Or a skill not yet in the collection
Keep always = herbs (never dissolve)
Do not keep = 1 Reroll value stone (dissolve) OR 1 gold (sell) — the filter picks one medium per piece, default dissolve, never both (economy.md single-medium rule)

Salvage milestones (luck protection, bounded): every 500 salvaged gear pieces grants 1 Reroll tier stone (~+2.7% of §5 flow, inside the funnel). No new junk types exist: gear, herbs, and stones are the only three streams.
```

- The filter is **configurable** (e.g. "keep only Rare" / "keep if it has a res slot") · Configuring thresholds is a real player decision, and 1 of the 3 reasons concept.md says to open the game
- No bag backlog either way: both media convert on the spot (section 6) → the stash still needs no Cap
- **The sell/dissolve switch is a real decision, and it is gold's primary mint** (Road events are the only other one · checks.md G6). Any source that paid both media would inflate one of them silently (`economy.md`)
- save.md must store: per-slot filter thresholds · And the list of "Elements/slots the player has not yet found", because it is a filter condition

# 5. Stone income and prices (set from the numbers in sections 2-3)

| Stone | Source per hour (high zone · no Lck) | Used for | Price per use |
|---|---|---|---|
| Reroll value stone | 416 (every junk piece = 1) | Reroll value | **8** → ~52 times/hour |
| Reroll tier stone | elite 18 (0.5% of kills ×2) + boss 12 (4 ×3) = 30 | Reroll tier / Refine | **1 / 8** → ~3.75 Refines/hour |
| Add mod stone | elite / boss only (rate pending) | Add / Ascend | **1** (2nd fill 2 · Ascend 1 + 8 tier stones) → ~0.8 Ascends/hour |
| Quality Stone | monsters → elites → bosses by step | Upgrade | tiered: 1/2/3/4/5 · 7/9/11/13/15 · 18/21/24/27/30 |
| Repair stone | elite / boss only | Repair | **1** |
| Corrupt stone | boss only, rarest stone | Corrupt | **1** |

Checkable timelines:

```
Refine full 12-piece set (average 2.5 slots/piece × 2 steps = 60 uses) ≈ 16 hours
Ascend full 12-piece set ≈ 15 hours  (and only for items whose floor Item quality is below the zone ceiling)
Skill 1 unit to full ladder 32 duplicates ≈ 23 boss hours (35% per kill)
```

- **Why set this way**: Reroll is cheap and frequent (fixes value within the same Tier) · Refine is the main upgrade path requiring elite/boss hunting · Ascend requires planning because cores are half a month per piece
- **Boss is the bottleneck for two things at once** (cores + duplicate skills) as concept.md laid out · AFK cannot hit bosses → the second half of the craft engine is fully active
- **Losing = losing the spawn** (combat.md section 7), so 4 times/hour is a theoretic ceiling, not a real value: players weaker than the zone win about 1 in 3 fights → real cores ~0.8/hour, not 2.4/hour · The table in combat.md states which build loses in which zone. Intended side effect: *upgrading* (tree/heal/gear) raises win rate, not just speed → shifts the whole craft-income line
- To make rates 2x faster, the right fix is *boss spawn chance*, not price — price is what players read, boss spawn chance is what the game controls

# 6. Answers for economy.md

- **Two media** · 7 stones (power) + **gold** (quality-of-life) · No player-to-player buying/selling/trading · Gold is minted *only* by the sell/dissolve choice in section 4, so drop count is the ceiling on both media at once. Full model in `economy.md` · the stalls that spend it are in `towns.md` sections 4-5.
  > This replaces the first-draft answer "no currency · no NPC shops". It is safe because nothing gold buys grants power: Reroll/Refine/Ascend stay priced in stones, and the stone bottleneck (F7-F10, elite 0.5% + boss 4/hour) is untouched.
- Reason the time framing still holds: what is valuable in this game is *time* (combat.md section 4). Gold converts time into convenience, never into the crafted quality that E6/E7 measure.
- **Converting items to crafting currency: not done as a separate action** (economy.md warned it leaves players unsure what to keep) — the section 4 filter already does it, and now it also offers the gold alternative at the same moment of decision.
- Items the player does not keep are therefore not "trash" but Passive income of the craft system → no full bag, never needing to sit and delete items

# 7. AFK vs Active with these numbers

| | Active | AFK |
|---|---|---|
| kills/hour | Same (TTK identical) | Same |
| drops/hour | 446 | 446 |
| Highest droppable Item quality | Zone ceiling | **Zone floor only** (concept.md) |
| Reroll tier stone/hour | 30 (elite + boss) | **18** (elite only · no boss) |
| Add mod stone/hour | boss-gated | **0** |
| Upgrades/hour from drops | 1-5 | Lower, because only the floor range can roll |

- These numbers give "AFK 40-50%" substance: same item count but **high Tier Item quality and high crafting currencies are missing** · Not cut by making hits slower
- This does not yet answer the "offline Cap" question pending in concept.md — a maximum storage time must be chosen (recommended 12 hours = 1 real work day = 1.5 zones of the craft engine)

# 8. Open slots for this file

- **Which numbers this file owns vs what is computed**: `node tools/check.js --checks` derives F1 · F2 · F3 · F5 · F6 · F7 · F8 (and the gold-per-minute line F18) from `tools/data/engine.json`, and it reads the section 2 table back out of this file — so a row here that stops matching the engine is a FAIL, not a note. **F4 and F11 are simulation output** (section 3), and F9 · F10 · F13 are unset; the cage carries those rows instead of inventing them, and `tools/loot.js` (not written yet) is what would replace them.
- **Elite spawn chance 0.5% with 2 tier stones each (decided P2-2)** — supply stays 30/hour, elites are rarer but each is a mini-boss event (HP ×6 / damage ×4).
- **Zone count** still missing · Section 2 thinks in 3 large Item-quality steps · If 90 levels split into 9 zones, total game time = ~9 × (2-3 hours luck + 16 hours craft), which is far too much · Must choose between "few zones but deep craft" vs "many zones but shallow craft"
- **Drop Item quality spreads per the formula in section 1 item 4 (decided P2-1)** — high zone carries no low (mid 40% / high 60%). Simulation keep-rates in section 3 predate this change; rerun pending.
- **Per-settlement Base bias** (towns.md section 4) — if Bases roll unequally by town, step 2 of section 1 needs a weight column and section 3 must be re-simulated. `item-base.md` already states this condition. The 5-step check list is `towns-stalls.md` section 8, caged as `checks.md` T15 by `node tools/town.js --checks`; no weight may be written into the data file while the status is `pending`.

(End of file - total 130 lines)
