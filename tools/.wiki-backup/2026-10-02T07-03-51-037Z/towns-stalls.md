# Town Stalls — prices, stock, Standing, Collector

import towns.md
import towns-ui.md
import glossary.md
import economy.md
import loot.md
import crafting.md
import farm.md
import tasks.md
import world.md
import item-base.md
import checks.md

Detail file for `towns.md`. Every table in this file is **generated** from `tools/data/town.json` by `node tools/town.js --write` — do not hand-type a price, a stock line, a roster tick or a kill threshold here. Edit the data, then run `node tools/town.js --checks` (section 10).

Every price is anchored to a number in `checks.md` groups E/F, and nothing here grants a stat, so no `mob_HP` term changes (`checks.md` H1).

# 1. Price unit (derived, not invented)

<!-- BEGIN GENERATED:price-unit -->
```
gold per sold junk piece        = 1                       (economy.md · loot.md section 4)
drops/hour per band             = 133 low · 255 mid · 418 high · 1,319 high+full Lck   (loot.md section 2 · F3)
upgrades/hour from drops        = 2 low · 3 mid · 2 high · 4 high+full Lck   (F4)
junk/hour = drops - upgrades    = 131 low · 252 mid · 416 high · 1,315 high+full Lck
1 m  = 1 minute of full-sell income in that band
gold per 1 m                    = 2.2 low · 4.2 mid · 6.9 high · 21.9 high+full Lck
kills/hour per band (F1)        = 980 low · 1,385 mid · 1,800 high
opportunity cost of 1 gold      = 1 Reroll value stone forgone = 1/52 hour of Reroll capacity ≈ 1.15 min of craft progress (F6 · E8)

band hours (low z1-3 = 3.1 hr · mid z4-6 = 9.5 · high z7-9 = 18.6 · z9 push (91-100) = 9.0)  (checks.md E1-E5)
```
<!-- END GENERATED:price-unit -->

- Prices are **fixed in gold**; `m` is the readable anchor, gold is the charge. A price is set in the band where the purchase actually matters, which is why each row states its charge band.
- Default for every piece stays **dissolve**, so the crafting engine keeps its designed 416 stones/hour unless the player deliberately redirects a piece to gold (`loot.md` section 4 · `checks.md` G2).
- The opportunity cost of one gold is a *Reroll value stone*, not a fraction of a second of progress: `economy.md` single-medium rule.

# 2. Lifetime gold supply and the demand check

<!-- BEGIN GENERATED:supply -->
```
band hours                      = low z1-3 = 3.1 hr · mid z4-6 = 9.5 · high z7-9 = 18.6 · z9 push (91-100) = 9.0
lifetime junk pieces            = 3.1×131 + 9.5×252 + 18.6×416 + 9.0×416 = 14,282
max lifetime gold (sell everything, no Lck)              = 14,282
one-time stall demand (section 3, all 9 places)          = 18,664 gold = 1.31x the max
essentials only (road link · stash tab 1 · stash tab 2 · herb pouch ii · plot deed 4) = 1,951 = 13.7% of the max
full-Lck ceiling over the 27.6 high-band hours               = 36,294 gold (= ×3.16 of the 11,482 a no-Lck run earns there · ceiling ×3.16)
stones forgone by selling everything                     = 14,282 ÷ 8 = 1,785 Reroll casts ≈ 17.9 full-set polishes (E8)
repeatable demand (section 4)                            = absorbs whatever the one-time list does not, no ceiling
```
<!-- END GENERATED:supply -->

- The list is **a funnel, not a wall**: the essentials are affordable while still dissolving ~85% of junk, and the full one-time list is only closable by a build that sells most of its loot and gives up Reroll polish.
- A full-Lck player raises the junk line ×3.15 (`loot.md` section 3 conclusion 2), so the tail is reachable *for that build* — exactly Lck's designed identity as the loot/craft stat. Guard: `checks.md` G8 + T7.
- Repeatables (section 4) absorb whatever the one-time list does not, which is the problem `economy.md` states: one-time purchases alone would leave the medium dead by hour 20.

# 3. One-time purchases

<!-- BEGIN GENERATED:one-time -->
| Item | Sold by | Kind | m | gold @low | gold @mid | gold @high | Charged at | Qty | Gold in the demand total | Note |
|---|---|---|---|---|---|---|---|---|---|---|
| Road link (first visit to a settlement) | Waypoint keeper | time | 20 | 44 | 84 | 138 | the band of each destination | 2 low + 3 mid + 3 high | 754 | 8 links · travel mode B · Eastgate is free |
| Stash tab 1 | Porter | space | 60 | 132 | 252 | 414 | high band | 1 | 414 | no Bag Cap exists, so tabs organise · at Eastgate the first tab is sold at the 30 m teaching price |
| Stash tab 2 | Porter | space | 90 | 198 | 378 | 621 | high band | 1 | 621 |  |
| Stash tab 3 | Porter | space | 130 | 286 | 546 | 897 | high band | 1 | 897 |  |
| Stash tab 4 | Porter | space | 180 | 396 | 756 | 1,242 | high band | 1 | 1,242 |  |
| Stash tab 5 | Porter | space | 240 | 528 | 1,008 | 1,656 | high band | 1 | 1,656 |  |
| Stash tab 6 | Porter | space | 300 | 660 | 1,260 | 2,070 | high band | 1 | 2,070 | Cap 6 tabs |
| Herb pouch II | Porter | space | 60 | 132 | 252 | 414 | mid band | 1 | 252 | raises the herb stack ceiling (farm.md) |
| Herb pouch III | Porter | space | 240 | 528 | 1,008 | 1,656 | high band | 1 | 1,656 |  |
| Bag category slot (herbs / stones / gear display) | Porter | space | 45 | 99 | 189 | 311 | low band | 3 | 297 | display and sorting only · sells no stone, no gear |
| Plot deed 4 | Steward | space | 180 | 396 | 756 | 1,242 | mid band | 1 | 756 | 4th farm plot (farm.md) |
| Plot deed 5 | Steward | space | 540 | 1,188 | 2,268 | 3,726 | high band | 1 | 3,726 | 5th plot · the most expensive non-cosmetic line |
| House · Ashfall | Steward | space | 120 | 264 | 504 | 828 | low band | 1 | 264 | 2 stash tabs + 1 farm plot + Waypoint anchor, no combat effect |
| House · Highspire | Steward | space | 240 | 528 | 1,008 | 1,656 | mid band | 1 | 1,008 |  |
| House · Vermolch | Steward | space | 360 | 792 | 1,512 | 2,484 | high band | 1 | 2,484 |  |
| Saved filter preset slot (extra) | Counterhand | information | 30 | 66 | 126 | 207 | one per band | 3 | 399 | preset switching is a concept.md reason-to-open |
| Potion carrier slot (belt display) | Armourer | space | 40 | 88 | 168 | 276 | mid band | 1 | 168 | display only · the carrier pays the weight tax in formula.md section 11 · sells no potion |

Total one-time demand = **18,664 gold** (see section 2).

<!-- END GENERATED:one-time -->

- A house grants **no combat effect of any kind**: it does not touch Push downtime (`combat.md` section 4 · D9), gives no buff, no slot, no regen. It is storage + a Waypoint anchor, which is the whole BDO house argument.
- Nothing in this table is required to reach level 100 or to kill the zone 9 boss. That is the test that keeps gold off the power path (`checks.md` G7).
- The Eastgate teaching price for the first stash tab is the only discount in the game; it exists so the first Porter visit teaches the storage ladder instead of taxing it.
- Line count and the demand total are checked as T4; the essentials subset as T5.

# 4. Repeatable purchases

<!-- BEGIN GENERATED:repeatable -->
| Item | Sold by | Kind | m | Gold | Bound | Note |
|---|---|---|---|---|---|---|
| Task skip token | Guild clerk | time | 8 | 55 (high) | 3 per real day | 1 per task slot per day on top of the free skip in tasks.md · 3/day = 24 m/day |
| Armourer repair (clears Broken, refills protection to 5) | Armourer | time | 14 | 97 (high) | repeatable | must stay above the elite time that earns 1 Reroll tier stone · re-check at F9 |
| Armourer repair at Ironrow | Armourer | time | 12 | 83 (high) | repeatable | the armourer town discount, and only there · still above the tier-stone floor |
| Curio pedlar stock: banner · Base tint · title | Curio pedlar | appearance | 30-120 | 207-828 (high) | 3 per real day | 3 slots per real day · appearance only |
| Prestige title line (per quality band) | Curio pedlar | appearance | 300 | 2,070 (high) | repeatable | the only intentionally expensive line |
| Waypoint re-anchor (move the free return point) | Waypoint keeper | time | 6 | 41 (high) | repeatable | cosmetic convenience · never gates a zone |
| Coldres banner (settlement cosmetic) | Furrier | appearance | 90 | 378 (mid) | repeatable | one per settlement · Wolf Cross only |
| Heavy-school Base tint | Armourer | appearance | 45 | 311 (high) | repeatable | stocked only by the Siege Armourer at Frosthold · appearance only |
| Collector set hint (prints which school the set wants) | Collector | information | 15 | 104 (high) | repeatable | information only · pays no item and sells no piece |

Skip-token ceiling = 8 m × 3/day = **24 m/day** = 166 gold/day in the high band.

<!-- END GENERATED:repeatable -->

- Repair is the only **D2 service class** line: it converts a rare-stone dependency into gold, so it must never be cheaper than hunting the stone. The floor in `checks.md` T10 is proven against F7 (18 Reroll tier stones/hour → 3.33 min of elite hunting per stone); it re-opens when F9 lands.
- Ironrow's 12 m repair is the cheapest service in the game and the only settlement-specific price, which is what "the armourer town" is allowed to mean.
- Pedlar rotation refreshes **per real day**, not on the 12-hour offline clock (`save.md`): a refresh the player can sleep into would not be a reason to return.

# 5. Per-settlement detail — 9 settlements

## 5.1 NPC roster

<!-- BEGIN GENERATED:npc-matrix -->
| Settlement | Zone | Band | Capital | Counterhand | Steward | Porter | Guild clerk | Armourer | Waypoint keeper | Collector | Curio pedlar | Herbalist | Furrier |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Eastgate** | 1 | low | — | ✓ | · | ✓ | · | · | ✓ | · | · | · | · |
| **Millbrook** | 2 | low | — | ✓ | · | ✓ | · | · | ✓ | · | · | ✓ | · |
| **Ashfall** | 3 | low | low | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | ✓ | · |
| **Ironrow** | 4 | mid | — | ✓ | · | ✓ | · | ✓ | ✓ | · | · | · | · |
| **Wolf Cross** | 5 | mid | — | ✓ | · | ✓ | · | · | ✓ | · | · | · | ✓ |
| **Highspire** | 6 | mid | mid | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | ✓ | ✓ | · |
| **Bonegate** | 7 | high | — | ✓ | · | ✓ | · | ✓ | ✓ | ✓ | · | · | · |
| **Frosthold** | 8 | high | — | ✓ | · | ✓ | · | ✓ | ✓ | · | · | · | · |
| **Vermolch** | 9 | high | high | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · |
| **Present in** |  |  |  | 9/9 | 3/9 | 9/9 | 3/9 | 6/9 | 9/9 | 3/9 | 2/9 | 4/9 | 1/9 |

Presence rules:
- **Counterhand** — every settlement · sells information
- **Steward** — capitals only · sells space
- **Porter** — every settlement · sells space
- **Guild clerk** — capitals only · sells time
- **Armourer** — capitals + Ironrow · Bonegate · Frosthold (Siege Armourer) · sells time
- **Waypoint keeper** — every settlement · sells time
- **Collector** — the three set towns: Ashfall · Bonegate · Vermolch · sells space/appearance
- **Curio pedlar** — Highspire + Vermolch only · sells appearance
- **Herbalist** — Millbrook + capitals · sells space
- **Furrier** — Wolf Cross only · sells space/appearance

<!-- END GENERATED:npc-matrix -->

## 5.2 Stock, Standing and Base flavour per settlement

<!-- BEGIN GENERATED:stock -->
| Settlement | Zone · band | Capital | NPCs | Stock lines (prices in sections 3-4) | Base bias (flavour) | Standing tiers (kills) |
|---|---|---|---|---|---|---|
| **Eastgate** | 1 · low | — | Counterhand · Porter · Waypoint keeper | Bag category slot · Stash tab 1 · Waypoint re-anchor · Saved filter preset slot | cloth | 147 / 368 / 686 |
| **Millbrook** | 2 · low | — | Counterhand · Porter · Waypoint keeper · Herbalist | Herb pouch II · Bag category slot · Road link · Saved filter preset slot | cloth / light | 235 / 588 / 1,098 |
| **Ashfall** | 3 · low | low | Counterhand · Steward · Porter · Guild clerk · Armourer · Waypoint keeper · Collector · Herbalist | House · Ashfall · Plot deed 4 · Collector set **Militia** (light school) · Collector set hint · Stash tab 1 · Road link · Armourer repair · Saved filter preset slot | light (Evasion) | 529 / 1,323 / 2,470 |
| **Ironrow** | 4 · mid | — | Counterhand · Porter · Waypoint keeper · Armourer | Armourer repair at Ironrow · Stash tab 1 · Road link · Potion carrier slot | light / mail | 914 / 2,285 / 4,266 |
| **Wolf Cross** | 5 · mid | — | Counterhand · Porter · Waypoint keeper · Furrier | Bag category slot · Coldres banner · Stash tab 1 · Road link · Waypoint re-anchor | light | 1,247 / 3,116 / 5,817 |
| **Highspire** | 6 · mid | mid | Counterhand · Steward · Porter · Guild clerk · Armourer · Waypoint keeper · Curio pedlar · Herbalist | House · Highspire · Plot deed 5 · Curio pedlar stock: banner · Base tint · title · Stash tab 1 · Road link · Armourer repair · Saved filter preset slot | mail | 1,787 / 4,467 / 8,338 |
| **Bonegate** | 7 · high | — | Counterhand · Porter · Waypoint keeper · Collector · Armourer | Collector set **Reliquary** (heavy school) · Collector set hint · Stash tab 1 · Road link · Armourer repair · Saved filter preset slot | heavy (Armour) | 2,700 / 6,750 / 12,600 |
| **Frosthold** | 8 · high | — | Counterhand · Porter · Waypoint keeper · Armourer (=Siege Armourer) | Armourer repair · Heavy-school Base tint · Stash tab 1 · Road link · Waypoint re-anchor | heavy | 3,240 / 8,100 / 15,120 |
| **Vermolch** | 9 · high | high | Counterhand · Steward · Porter · Guild clerk · Armourer · Waypoint keeper · Collector · Curio pedlar · Herbalist | House · Vermolch · Collector set **Garden of Ash** (cloth school) · Collector set hint · Prestige title line · Curio pedlar stock: banner · Base tint · title · Stash tab 1 · Road link · Armourer repair · Saved filter preset slot | heavy · cloth (glass endgame) | 8,964 / 22,410 / 41,832 |

<!-- END GENERATED:stock -->

- **Specialisation rule:** any line sold in exactly one place must be convenience or cosmetic, never the only source of something a build needs. That would re-gate progression by geography, which `world.md` refuses (unlock by level only).
- The Base-bias column is **flavour** until section 8 closes; it says which school a zone reads like, not which frame drops more often.
- Standing kill counts in the last column are the same numbers as section 6, repeated here so one row per settlement is enough to run the town.

# 6. Standing tiers

Standing accrues from kills in that settlement's own zone (`towns.md` section 6), so its thresholds are a share of that zone's designed time budget, converted through F1 kills/hour.

<!-- BEGIN GENERATED:standing -->
| Settlement | Band | Zone budget (hr) | Tier I 30% | Tier II 75% | Tier III 140% |
|---|---|---|---|---|---|
| **Eastgate** | low (980 kills/hr) | 0.5 | 0.15 hr · **147 kills** | 0.38 hr · **368 kills** | 0.70 hr · **686 kills** |
| **Millbrook** | low (980 kills/hr) | 0.8 | 0.24 hr · **235 kills** | 0.60 hr · **588 kills** | 1.12 hr · **1,098 kills** |
| **Ashfall** | low (980 kills/hr) | 1.8 | 0.54 hr · **529 kills** | 1.35 hr · **1,323 kills** | 2.52 hr · **2,470 kills** |
| **Ironrow** | mid (1,385 kills/hr) | 2.2 | 0.66 hr · **914 kills** | 1.65 hr · **2,285 kills** | 3.08 hr · **4,266 kills** |
| **Wolf Cross** | mid (1,385 kills/hr) | 3.0 | 0.90 hr · **1,247 kills** | 2.25 hr · **3,116 kills** | 4.20 hr · **5,817 kills** |
| **Highspire** | mid (1,385 kills/hr) | 4.3 | 1.29 hr · **1,787 kills** | 3.22 hr · **4,467 kills** | 6.02 hr · **8,338 kills** |
| **Bonegate** | high (1,800 kills/hr) | 5.0 | 1.50 hr · **2,700 kills** | 3.75 hr · **6,750 kills** | 7.00 hr · **12,600 kills** |
| **Frosthold** | high (1,800 kills/hr) | 6.0 | 1.80 hr · **3,240 kills** | 4.50 hr · **8,100 kills** | 8.40 hr · **15,120 kills** |
| **Vermolch** | high (1,800 kills/hr) | 16.6 | 4.98 hr · **8,964 kills** | 12.45 hr · **22,410 kills** | 23.24 hr · **41,832 kills** |

Kill counts = `zone budget hr × tier share × F1 kills/hour of that band` (980 low · 1,385 mid · 1,800 high), rounded.
- **Tier I** = 30% of that settlement's zone budget → that stall's second stock line.
- **Tier II** = 75% of that settlement's zone budget → the Collector set slots of that settlement.
- **Tier III** = 140% of that settlement's zone budget → the cosmetic / tip line (banner · title · preset slot).

<!-- END GENERATED:standing -->

- Zone budgets come from `checks.md` E1-E5 (3.1 hr through zone 3 · 12.6 through 6 · 31.2 through 9 · 40.2 at level 100). The **split inside each band is interpolated** in `tools/data/town.json` and is replaced by the per-level XP table when that table is written (section 9).
- Tier III sits above 100% of the designed budget, i.e. a **chase, not a formality**: it asks for stay-behind farming in that zone. It is never a fake threshold because a zone never closes — levels 91-100 already farm zone 9, and Vermolch's budget is its 7.6 hr band share plus the 9.0 hr push (`concept.md` keeps the post-completion loop open · `checks.md` H3).
- Tasks and boss kills in that zone add Standing on top, so these kill counts are the floor for a pure-farming path, never a substitute requirement.
- **No tier unlocks a stat or a stone** (`checks.md` T12b).

# 7. Collector sets

Turn in named pieces at the Collector; the payment is the item itself (cosmetic, stash tab, or preset slot), never gold and never a Mod (`economy.md` · `checks.md` G6 · T14).

<!-- BEGIN GENERATED:collector -->
| Set | Where | School | Turn in | Quality | Reward | Gold paid | Rule |
|---|---|---|---|---|---|---|---|
| **Militia** | Ashfall | light | coif (helmet) · mail (chest) · striders (boots) | any | banner + 1 saved filter preset slot | no | pieces are consumed, so the sink runs before the filter ever dissolves them |
| **Reliquary** | Bonegate | heavy | barbute (helmet) · plate (chest) · cuisses (pant) | any | stash tab (bypasses the one-time price ladder, once per character) | no | must be filter-rejected pieces, or the sink competes with keep decisions |
| **Garden of Ash** | Vermolch | cloth | circlet (helmet) · vestments (chest) · wrap (pant) | high | prestige title | no | the high-quality requirement makes it an endgame demand, not a side quest |

<!-- END GENERATED:collector -->

- The three sets map onto the three Base schools in `item-base.md` (light / heavy / cloth → Evasion / Armour / Energy Shield), so a set is a *school* test, not a new item family.
- Set progress is stored (`save.md` town row) and is per character.
- Whether a set can be finished without opening the filter is an open design question (`towns.md` section 10), not a number, so it is not priced here.

# 8. Base bias per settlement — check list, not numbers

<!-- BEGIN GENERATED:base-bias -->
Status: **pending** — the column above is which Base school a zone's mobs flavour, not a weight anyone can yet buy, and it stays that way until every line below is closed.

1. Add a Base weight column to loot.md section 1 step 2 (currently "equal roll among all frames of that slot").
2. Re-run the loot.md section 3 keep-rate simulation — the 2.2% / 1.2% / 0.7% numbers and the "1 in ~30-60 drops" line in item-base.md both move.
3. Confirm F3 drops/hour is unmoved: bias is a redistribution between frames of the same slot, never a change in drop count.
4. Confirm the three item-base.md paths (cloth 248 / balanced 390 / armored 657 weight) are all still reachable — no settlement may make one school unobtainable.
5. Only then decide whether a build must travel for a frame — if yes, that is a progression gate by geography and must be argued against world.md "unlock by level" first.

Not written while the status is pending:
- numeric per-settlement Base weights
- any stock line that is the only source of a frame
- any gold price that buys frame odds

<!-- END GENERATED:base-bias -->

# 9. What must be re-checked when other numbers land

<!-- BEGIN GENERATED:pending -->
| Pending number | Line it moves | Status |
|---|---|---|
| F9 (Add mod stone rate) | Armourer repair floor (repeatable table) | open |
| F13 (herb bundle rate) | Herbalist + pouch ladder demand | open |
| Per-level XP table | Standing budgets — the kill counts here sit on interpolated band splits | open |
| Task reward sizing (tasks.md rebalance) | skip-token m price vs the ≤10% bound | open |
| Reroll/Refine price rebalance | the opportunity-cost line in the price unit block | open |
| loot.md section 3 keep-rate re-simulation | Base bias column (flavour only until done) | open |

<!-- END GENERATED:pending -->

# 10. How this file is generated (data-driven development)

| Step | Command | Result |
|---|---|---|
| Change a price, a roster, a stock line, a budget or a tier share | edit `tools/data/town.json` | the only hand-written town numbers live there |
| Change a band number (kills · drops · upgrades · junk · stone prices · timeline hours) | edit `tools/data/engine.json` | **not stored here** — `tools/lib/engine.js` feeds both cages, so a gold price and an F3 drop rate cannot drift apart |
| Rebuild every table in this file + `checks.md` groups A · B · C · F · T | `node tools/check.js --write` then `node tools/town.js --write` | generated blocks replaced between their markers |
| Run the cage | `node tools/check.js --checks` · `node tools/town.js --checks` | 60 engine rows + 22 town rows, exit 1 on FAIL **or** on a doc block that no longer matches the data |
| Print the blocks without touching files | `node tools/town.js --emit` · `node tools/check.js --emit` | for review |

What the cage refuses (`--checks` rows, mirrored in `checks.md` group T):

- a stall line whose kind is not space · time · information · appearance, or whose name contains a power noun (gear · Mod · potion · stone · Reroll · Refine · Ascend · weapon) without an explicit `display_only` flag → **T8** (`checks.md` G7)
- a Collector set paying gold → **T14** · Standing granting a stat or stone → **T12b**
- a one-time demand above 1.50× the lifetime supply, or an essentials basket above 20% → **T4 · T5**
- a Road link above 20 m, or a link count that does not equal the number of non-start settlements → **T9** (G9)
- a repair price at or below the elite time of one Reroll tier stone → **T10**
- a skip-token cap above 3/day or 24 m/day → **T11**
- a price ladder that is not monotonic → **T16**
- a numeric Base weight while the re-simulation is pending → **T15**
- band hours that no longer sum to the E1-E5 timeline, or settlement budgets that no longer sum to 40.2 hr → **T3a · T3b**
- a kill rate that differs from loot.md section 2 → **T17** (H1)
- an engine number in the data file that no longer matches what `loot.md` section 2 and the prose formula files publish → **T18** + `tools/check.js` read-back. This row already earned its keep twice: the high-band drop rate was written as 421 in `loot.md` · `combat.md` · `formula.md` while F3 derives 1,800 × 23.2% = **418**, and the low band read 135 with `Lck 72 → ×1.72` while `stat_c(30) = 70` gives **133** with ×1.70 (`stat_c(90) = 190` → ×2.90 → 418 ✓). All three docs were corrected, the Refine rate went from "~3.8" to the exact **3.75** the price pair gives, and no gold price moved: 133 − 2 = 131 junk/hour still prices a minute at 2.2 gold
- a generated table containing `undefined` or `NaN` → the template-leak scan in both cages
- a stock line naming an NPC that is not present in that settlement, or an NPC placement that breaks the presence rules → **T-S · T-R**

(End of file)
