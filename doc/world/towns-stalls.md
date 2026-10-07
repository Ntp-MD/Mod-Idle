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

Detail file for `towns.md`. Every table in this file is **generated** from `tools/data/town.json` by `node tools/town.ts --write` — do not hand-type a price, a stock line, a roster tick or a kill threshold here. Edit the data, then run `node tools/town.ts --checks` (section 10).

Every price is anchored to a number in `checks.md` groups E/F, and nothing here grants a stat, so no `mob_HP` term changes (`checks.md` H1).

# 1. Price unit (derived, not invented)

<!-- BEGIN GENERATED:price-unit -->
```
gold per sold junk piece        = 1                       (economy.md · loot.md section 4)
the price unit                  = gold — minted by the Counterhand, spent at the stalls
a price is charged at the band of the place that sells it:
  drops per kill by band        = 0.1058 low · 0.1229 mid · 0.1392 high · 0.4278 high+full Lck   (loot.md section 2 · F2)
  upgrades per kill by band     = 0.0065 low · 0.0056 mid · 0.0034 high · 0.0051 high+full Lck
  junk = drops - upgrades       = 0.0994 low · 0.1173 mid · 0.1358 high · 0.4228 high+full Lck   gold per kill
opportunity cost of 1 gold      = 1 Reroll value stone forgone = 1/10 of Reroll capacity (F6 · E8)

band kills (low z1-3 = 1,777 kills · mid z4-6 = 8,066 · high z7-9 = 26,513 · z9 push (91-100) = 23,675)  (checks.md E1-E5)
```
<!-- END GENERATED:price-unit -->

- Prices are **fixed in gold**; `m` is the readable anchor, gold is the charge. A price is set in the band where the purchase actually matters, which is why each row states its charge band.
- Default for every piece stays **dissolve** *once a slot is armed*, so the crafting engine keeps its designed 0.136 junk per kill; the filter ships off, so a fresh character keeps everything until the player turns slots on, and an armed reject then dissolves for a stone unless the player redirects it to gold (`loot.md` section 4 · `checks.md` G2).
- The opportunity cost of one gold is a *Reroll value stone*, not a fraction of a second of progress: `economy.md` single-medium rule.

# 2. Lifetime gold supply and the demand check

<!-- BEGIN GENERATED:supply -->
```
band kills                      = low z1-3 = 1,777 kills · mid z4-6 = 8,066 · high z7-9 = 26,513 · z9 push (91-100) = 23,675
lifetime junk pieces            = 1,777×0.0994 + 8,066×0.1173 + 50,188×0.1358 = 7,940
max lifetime gold (sell everything, no Lck)              = 7,940
one-time stall demand (section 3, all 9 places)          = 3,654 gold = 0.46x the max
essentials only (stash tab 1 · stash tab 2 · herb pouch ii · plot deed 4) = 405 = 5.1% of the max
full-Lck ceiling over the 50,188 high-band kills               = 21,217 gold (= ×3.11 of the 6,817 a no-Lck run earns there · ceiling ×3.11)
stones forgone by selling everything                     = 7,940 ÷ 8 = 993 Reroll casts ≈ 9.9 full-set polishes (E8)
repeatable demand (section 4)                            = absorbs whatever the one-time list does not, no ceiling
```
<!-- END GENERATED:supply -->

- The list is **a funnel, not a wall**: the essentials are affordable while still dissolving ~85% of junk, and the full one-time list is only closable by a build that sells most of its loot and gives up Reroll polish.
- A full-Lck player raises the junk line ×3.11 (`loot.md` section 3 conclusion 2), so the tail is reachable *for that build* — exactly Lck's designed identity as the loot/craft stat. Guard: `checks.md` G8 + T7.
- Repeatables (section 4) absorb whatever the one-time list does not, which is the problem `economy.md` states: one-time purchases alone would leave the medium dead by the end of the run.

# 3. One-time purchases

<!-- BEGIN GENERATED:one-time -->
| Item | Sold by | Kind | Gold @low | Gold @mid | Gold @high | Charged at | Qty | Gold in the demand total | Note |
|---|---|---|---|---|---|---|---|---|---|
| Stash tab 1 | Porter | space | 48 | 66 | 78 | high band | 1 | 78 | no Bag Cap exists, so tabs organise · at Eastgate the first tab is sold at the 24 gold teaching price |
| Stash tab 2 | Porter | space | 72 | 99 | 117 | high band | 1 | 117 |  |
| Stash tab 3 | Porter | space | 104 | 143 | 169 | high band | 1 | 169 |  |
| Stash tab 4 | Porter | space | 144 | 198 | 234 | high band | 1 | 234 |  |
| Stash tab 5 | Porter | space | 192 | 264 | 312 | high band | 1 | 312 |  |
| Stash tab 6 | Porter | space | 240 | 330 | 390 | high band | 1 | 390 | Cap 6 tabs |
| Herb pouch II | Porter | space | 48 | 66 | 78 | mid band | 1 | 66 | one more slot in the character bag (`inventory.character_slots` is the base) |
| Herb pouch III | Porter | space | 192 | 264 | 312 | high band | 1 | 312 | one more slot in the character bag (`inventory.character_slots` is the base) |
| Bag category slot (herbs / stones / gear display) | Porter | space | 36 | 50 | 59 | low band | 3 | 108 | display and sorting only · sells no stone, no gear |
| Plot deed 4 | Steward | space | 144 | 198 | 234 | mid band | 1 | 198 | 4th farm plot (farm.md) |
| Plot deed 5 | Steward | space | 432 | 594 | 702 | high band | 1 | 702 | 5th plot · the most expensive non-cosmetic line |
| House · Ashfall | Steward | space | 96 | 132 | 156 | low band | 1 | 96 | 2 stash tabs + 1 farm plot, no combat effect |
| House · Highspire | Steward | space | 192 | 264 | 312 | mid band | 1 | 264 |  |
| House · Vermolch | Steward | space | 288 | 396 | 468 | high band | 1 | 468 |  |
| Saved filter preset slot (extra) | Counterhand | information | 24 | 33 | 39 | one per band | 3 | 96 | preset switching is a concept.md reason-to-open |
| Potion carrier slot (belt display) | Armourer | space | 32 | 44 | 52 | mid band | 1 | 44 | display only · the carrier pays the weight tax in formula.md section 11 · sells no potion |

Total one-time demand = **3,654 gold** (see section 2).

<!-- END GENERATED:one-time -->

- A house grants **no combat effect of any kind**: it does not touch Push downtime (`combat.md` section 4 · D9), gives no buff, no slot, no regen. It is storage and a place to sleep off a Push, which is the whole BDO house argument.
- Nothing in this table is required to reach level 100 or to kill the zone 9 boss. That is the test that keeps gold off the power path (`checks.md` G7).
- The Eastgate teaching price for the first stash tab is the only discount in the game; it exists so the first Porter visit teaches the storage ladder instead of taxing it.
- Line count and the demand total are checked as T4; the essentials subset as T5.

# 4. Repeatable purchases

<!-- BEGIN GENERATED:repeatable -->
| Item | Sold by | Kind | Gold | Bound | Note |
|---|---|---|---|---|---|
| Task skip token | Guild clerk | time | 10 (high) | 3 per real day | 1 per task slot per day on top of the free skip in tasks.md · 3/day = 31 gold/day |
| Armourer repair (clears Broken, refills protection to 5) | Armourer | time | 21 (high) | repeatable | must stay above the elite time that earns 1 Reroll tier stone · re-check at F9 |
| Armourer repair at Ironrow | Armourer | time | 18 (high) | repeatable | the armourer town discount, and only there · still above the tier-stone floor |
| Curio pedlar stock: banner · Base tint · title | Curio pedlar | appearance | 39-156 (high) | 3 per real day | 3 slots per real day · appearance only |
| Prestige title line (per quality band) | Curio pedlar | appearance | 390 (high) | repeatable | the only intentionally expensive line |
| Coldres banner (settlement cosmetic) | Furrier | appearance | 99 (mid) | repeatable | one per settlement · Wolf Cross only |
| Heavy-school Base tint | Armourer | appearance | 59 (high) | repeatable | stocked only by the Siege Armourer at Frosthold · appearance only |
| Collector set hint (prints which school the set wants) | Collector | information | 20 (high) | repeatable | information only · pays no item and sells no piece |

Skip-token ceiling = 3/day = **31 gold/day** in the high band.

<!-- END GENERATED:repeatable -->

- Repair is the only **D2 service class** line: it converts a rare-stone dependency into gold, so it must never be cheaper than hunting the stone. The floor in `checks.md` T10 is proven against F7 (the elite Reroll tier-stone line) and re-proven in T10b against F9 (the Add mod stone line) — the price is a **gold** price at the band, never a stretch of minutes (D12).
- Ironrow's 18 gold repair is the cheapest service in the game and the only settlement-specific price, which is what "the armourer town" is allowed to mean.
- Pedlar rotation refreshes **per real day**, not on the 12-hour offline clock (`save.md`): a refresh the player can sleep into would not be a reason to return.

# 5. Per-settlement detail — 9 settlements

## 5.1 NPC roster

<!-- BEGIN GENERATED:npc-matrix -->
| Settlement | Zone | Band | Capital | Counterhand | Steward | Porter | Guild clerk | Armourer | Waypoint keeper | Collector | Curio pedlar | Herbalist | Furrier |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Eastgate** | 1 | low | — | ✓ | · | ✓ | · | · | ✓ | · | · | · | · |
| **Highspire** | 2 | low | low | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | ✓ | ✓ | · |
| **Wolf Cross** | 3 | low | — | ✓ | · | ✓ | · | · | ✓ | · | · | · | ✓ |
| **Greyfen** | 4 | mid | — | ✓ | · | ✓ | · | · | ✓ | · | · | · | · |
| **Saltmarrow** | 5 | mid | mid | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | ✓ | · |
| **The Pale Spire** | 6 | mid | mid | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | ✓ | · |
| **Blackwater Reach** | 7 | high | — | ✓ | · | ✓ | · | · | ✓ | · | · | · | · |
| **Bonegate** | 8 | high | — | ✓ | · | ✓ | · | ✓ | ✓ | ✓ | · | · | · |
| **Frosthold** | 9 | high | — | ✓ | · | ✓ | · | ✓ | ✓ | · | · | · | · |
| **Vermolch** | 10 | low | low | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · |
| **Duskmoor** | 11 | low | — | ✓ | · | ✓ | · | · | ✓ | · | · | · | · |
| **Nettlecrag** | 12 | low | low | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | · | ✓ | · |
| **Emberhold** | 13 | mid | — | ✓ | · | ✓ | · | · | ✓ | · | · | · | · |
| **Millbrook** | 14 | mid | — | ✓ | · | ✓ | · | · | ✓ | · | · | ✓ | · |
| **Wyrmback** | 15 | mid | — | ✓ | · | ✓ | · | · | ✓ | · | · | · | · |
| **Ashfall** | 16 | high | high | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | · | ✓ | · |
| **Ironrow** | 17 | high | — | ✓ | · | ✓ | · | ✓ | ✓ | · | · | · | · |
| **Thornwake** | 18 | high | — | ✓ | · | ✓ | · | · | ✓ | · | · | · | · |
| **Present in** |  |  |  | 18/9 | 6/9 | 18/9 | 6/9 | 9/9 | 18/9 | 3/9 | 2/9 | 7/9 | 1/9 |

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
| **Eastgate** | 1 · low | — | Counterhand · Porter · Waypoint keeper | Bag category slot · Stash tab 1 · Saved filter preset slot | cloth | 73 / 182 / 339 |
| **Highspire** | 2 · low | low | Counterhand · Steward · Porter · Guild clerk · Armourer · Waypoint keeper · Herbalist · Curio pedlar | House · Highspire · Plot deed 5 · Curio pedlar stock: banner · Base tint · title · Stash tab 1 · Armourer repair · Saved filter preset slot | Ring Mail | 175 / 438 / 818 |
| **Wolf Cross** | 3 · low | — | Counterhand · Porter · Waypoint keeper · Furrier | Bag category slot · Coldres banner · Stash tab 1 | light | 285 / 713 / 1,331 |
| **Greyfen** | 4 · mid | — | Counterhand · Porter · Waypoint keeper | Bag category slot · Stash tab 1 · Saved filter preset slot | wet lowland | 493 / 1,233 / 2,302 |
| **Saltmarrow** | 5 · mid | mid | Counterhand · Steward · Porter · Guild clerk · Armourer · Waypoint keeper · Herbalist | Bag category slot · Stash tab 1 · Saved filter preset slot | salt flats | 771 / 1,928 / 3,598 |
| **The Pale Spire** | 6 · mid | mid | Counterhand · Steward · Porter · Guild clerk · Armourer · Waypoint keeper · Herbalist | Bag category slot · Stash tab 1 · Saved filter preset slot | the pale spire | 1,156 / 2,889 / 5,393 |
| **Blackwater Reach** | 7 · high | — | Counterhand · Porter · Waypoint keeper | Bag category slot · Stash tab 1 · Saved filter preset slot | drowned river mouth | 1,733 / 4,334 / 8,089 |
| **Bonegate** | 8 · high | — | Counterhand · Porter · Waypoint keeper · Collector · Armourer | Collector set **Reliquary** (heavy school) · Collector set hint · Stash tab 1 · Armourer repair · Saved filter preset slot | heavy (Armour) | 2,639 / 6,598 / 12,316 |
| **Frosthold** | 9 · high | — | Counterhand · Porter · Waypoint keeper · Armourer (=Siege Armourer) | Armourer repair · Heavy-school Base tint · Stash tab 1 | heavy | 3,582 / 8,954 / 16,715 |
| **Vermolch** | 10 · low | low | Counterhand · Steward · Porter · Guild clerk · Armourer · Waypoint keeper · Collector · Curio pedlar · Herbalist | House · Vermolch · Collector set **Garden of Ash** (cloth school) · Collector set hint · Prestige title line · Curio pedlar stock: banner · Base tint · title · Stash tab 1 · Armourer repair · Saved filter preset slot | heavy · cloth (glass endgame) | 7,102 / 17,756 / 33,144 |
| **Duskmoor** | 11 · low | — | Counterhand · Porter · Waypoint keeper | Bag category slot · Stash tab 1 · Saved filter preset slot | open moor | 3,412 / 8,530 / 15,922 |
| **Nettlecrag** | 12 · low | low | Counterhand · Steward · Porter · Guild clerk · Armourer · Waypoint keeper · Herbalist | Bag category slot · Stash tab 1 · Saved filter preset slot | thorn country | 3,114 / 7,784 / 14,531 |
| **Emberhold** | 13 · mid | — | Counterhand · Porter · Waypoint keeper | Bag category slot · Stash tab 1 · Saved filter preset slot | slag and foundry heat | 2,863 / 7,158 / 13,362 |
| **Millbrook** | 14 · mid | — | Counterhand · Porter · Waypoint keeper · Herbalist | Herb pouch II · Bag category slot · Saved filter preset slot | cloth / light | 2,650 / 6,626 / 12,368 |
| **Wyrmback** | 15 · mid | — | Counterhand · Porter · Waypoint keeper | Bag category slot · Stash tab 1 · Saved filter preset slot | wyrm breeding ground | 2,467 / 6,167 / 11,511 |
| **Ashfall** | 16 · high | high | Counterhand · Steward · Porter · Guild clerk · Armourer · Waypoint keeper · Collector · Herbalist | House · Ashfall · Plot deed 4 · Collector set **Militia** (light school) · Collector set hint · Stash tab 1 · Armourer repair · Saved filter preset slot | light (Evasion) | 2,307 / 5,767 / 10,765 |
| **Ironrow** | 17 · high | — | Counterhand · Porter · Waypoint keeper · Armourer | Armourer repair at Ironrow · Stash tab 1 · Potion carrier slot | light / Ring Mail | 2,167 / 5,417 / 10,111 |
| **Thornwake** | 18 · high | — | Counterhand · Porter · Waypoint keeper | Bag category slot · Stash tab 1 · Saved filter preset slot | wet lowland | 4,022 / 10,054 / 18,767 |

<!-- END GENERATED:stock -->

- **Specialisation rule:** any line sold in exactly one place must be convenience or cosmetic, never the only source of something a build needs. That would re-gate progression by geography, which `world.md` refuses (unlock by level only).
- The Base-bias column is **permanent flavour** (A9 · ruled even-weighted): it says which school a zone reads like, never which frame drops more often, and no numeric weight may be added.
- Standing kill counts in the last column are the same numbers as section 6, repeated here so one row per settlement is enough to run the town.

# 6. Standing tiers

Standing accrues from kills in that settlement's own zone (`towns.md` section 6), so its thresholds are a share of that zone's kill budget — a count the player banks, never a stretch of time (`AGENT.md`).

<!-- BEGIN GENERATED:standing -->
| Settlement | Band | Zone budget (kills) | Tier I 30% | Tier II 75% | Tier III 140% |
|---|---|---|---|---|---|
| **Eastgate** | low | 242 | **73 kills** | **182 kills** | **339 kills** |
| **Highspire** | low | 584 | **175 kills** | **438 kills** | **818 kills** |
| **Wolf Cross** | low | 951 | **285 kills** | **713 kills** | **1,331 kills** |
| **Greyfen** | mid | 1,644 | **493 kills** | **1,233 kills** | **2,302 kills** |
| **Saltmarrow** | mid | 2,570 | **771 kills** | **1,928 kills** | **3,598 kills** |
| **The Pale Spire** | mid | 3,852 | **1,156 kills** | **2,889 kills** | **5,393 kills** |
| **Blackwater Reach** | high | 5,778 | **1,733 kills** | **4,334 kills** | **8,089 kills** |
| **Bonegate** | high | 8,797 | **2,639 kills** | **6,598 kills** | **12,316 kills** |
| **Frosthold** | high | 11,939 | **3,582 kills** | **8,954 kills** | **16,715 kills** |
| **Vermolch** | low | 23,674 | **7,102 kills** | **17,756 kills** | **33,144 kills** |
| **Duskmoor** | low | 11,373 | **3,412 kills** | **8,530 kills** | **15,922 kills** |
| **Nettlecrag** | low | 10,379 | **3,114 kills** | **7,784 kills** | **14,531 kills** |
| **Emberhold** | mid | 9,544 | **2,863 kills** | **7,158 kills** | **13,362 kills** |
| **Millbrook** | mid | 8,834 | **2,650 kills** | **6,626 kills** | **12,368 kills** |
| **Wyrmback** | mid | 8,222 | **2,467 kills** | **6,167 kills** | **11,511 kills** |
| **Ashfall** | high | 7,689 | **2,307 kills** | **5,767 kills** | **10,765 kills** |
| **Ironrow** | high | 7,222 | **2,167 kills** | **5,417 kills** | **10,111 kills** |
| **Thornwake** | high | 13,405 | **4,022 kills** | **10,054 kills** | **18,767 kills** |

Kill counts = `zone budget kills × tier share`, rounded. A budget is a count of kills its band pays, so a threshold is a state the player banks — never a stretch of hours (`AGENT.md`).
- **Tier I** = 30% of that settlement's zone budget → that stall's second stock line.
- **Tier II** = 75% of that settlement's zone budget → the Collector set slots of that settlement.
- **Tier III** = 140% of that settlement's zone budget → the cosmetic / tip line (banner · title · preset slot).

<!-- END GENERATED:standing -->

- Zone budgets come from `checks.md` E1-E5, as counts of kills (242 at level 10 · 1,777 at 30 · 9,843 at 60 · 36,356 at 90 · 60,031 at 100). The **split inside each band is interpolated** in `tools/data/town.json` and is replaced by the per-level XP table when that table is written (section 9).
- Tier III sits above 100% of the designed budget, i.e. a **chase, not a formality**: it asks for stay-behind farming in that zone. It is never a fake threshold because a zone never closes — levels 91-100 already farm zone 9, and Vermolch's budget is its band slice plus the 91-100 push (`concept.md` keeps the post-completion loop open · `checks.md` H3).
- Tasks and boss kills in that zone add Standing on top, so these kill counts are the floor for a pure-farming path, never a substitute requirement.
- **No tier unlocks a stat or a stone** (`checks.md` T12b).

# 7. Collector sets

Turn in named pieces at the Collector; the payment is the item itself (cosmetic, stash tab, or preset slot), never gold and never a Mod (`economy.md` · `checks.md` G6 · T14).

<!-- BEGIN GENERATED:collector -->
| Set | Where | School | Turn in | Quality | Reward | Gold paid | Rule |
|---|---|---|---|---|---|---|---|
| **Militia** | Ashfall | light | Hood (helmet) · Ring Mail (chest) · Strapped Boots (boots) | any | banner + 1 saved filter preset slot | no | pieces are consumed, so the sink runs before the filter ever dissolves them |
| **Reliquary** | Bonegate | heavy | Sallet (helmet) · Plate Vest (chest) · Cuisses (pant) | any | stash tab (bypasses the one-time price ladder, once per character) | no | must be filter-rejected pieces, or the sink competes with keep decisions |
| **Garden of Ash** | Vermolch | cloth | Circlet (helmet) · Vestment (chest) · Legwraps (pant) | high | prestige title | no | the high-quality requirement makes it an endgame demand, not a side quest |

<!-- END GENERATED:collector -->

- The three sets map onto the three Base schools in `item-base.md` (light / heavy / cloth → Evasion / Armour / Energy Shield), so a set is a *school* test, not a new item family.
- Set progress is stored (`save.md` town row) and is per character.
- Whether a set can be finished without opening the filter is **decided — yes, from drops alone**, so the filter is a convenience and not priced or required here.

# 8. Base bias per settlement — check list, not numbers

<!-- BEGIN GENERATED:base-bias -->
Status: **decided** (ship even-weighted (checks.md T15)) — the column above is which Base school a zone's mobs flavour. This is permanent flavour: the owner ruled to SHIP EVEN-WEIGHTED, so no per-settlement frame weight is ever added and there is no keep-rate re-sim to wait for. The column may never carry a number a player can buy.

1. Ruled even-weighted: loot.md section 1 step 2 stays "equal roll among all frames of that slot" — no Base weight column is added, and the tools/loot.ts frame_weight path stays a what-if only.
2. The three item-base.md paths (cloth 248 / balanced 390 / armored 657 weight) remain all reachable — even weighting means no settlement can make a school unobtainable, so the geographic-unlock worry never arises.
3. No build must travel for a frame: frames roll equally everywhere, so Base bias is never a progression gate and world.md "unlock by level" is untouched.

Never written (the ruling forbids it, not merely a pending gate):
- numeric per-settlement Base weights (ruled out, not merely pending)
- any stock line that is the only source of a frame
- any gold price that buys frame odds

<!-- END GENERATED:base-bias -->

# 9. What must be re-checked when other numbers land

<!-- BEGIN GENERATED:pending -->
| Pending number | Line it moves | Status |
|---|---|---|
| Task reward sizing (tasks.md rebalance) | skip-token gold price vs the ≤10% bound | open |
| Reroll/Refine price rebalance | the opportunity-cost line in the price unit block | open |

<!-- END GENERATED:pending -->

# 10. How this file is generated (data-driven development)

| Step | Command | Result |
|---|---|---|
| Change a price, a roster, a stock line, a budget or a tier share | edit `tools/data/town.json` | the only hand-written town numbers live there |
| Change a band number (kills · drops · upgrades · junk · stone prices · timeline counts) | edit `tools/data/engine.json` | **not stored here** — `tools/lib/engine.ts` feeds both cages, so a gold price and an F3 drop rate cannot drift apart |
| Rebuild every table in this file + `checks.md` groups A · B · C · F · T | `node tools/check.ts --write` then `node tools/town.ts --write` | generated blocks replaced between their markers |
| Run the cage | `node tools/check.ts --checks` · `node tools/town.ts --checks` | 60 engine rows + 22 town rows, exit 1 on FAIL **or** on a doc block that no longer matches the data |
| Print the blocks without touching files | `node tools/town.ts --emit` · `node tools/check.ts --emit` | for review |

What the cage refuses (`--checks` rows, mirrored in `checks.md` group T):

- a stall line whose kind is not space · time · information · appearance, or whose name contains a power noun (gear · Mod · potion · stone · Reroll · Refine · Ascend · weapon) without an explicit `display_only` flag → **T8** (`checks.md` G7)
- a Collector set paying gold → **T14** · Standing granting a stat or stone → **T12b**
- a one-time demand above 1.50× the lifetime supply, or an essentials basket above 20% → **T4 · T5**
- a travel line of any kind (road · carriage · waypoint) reappearing in the catalogue, or a block time or encounter chance that is not a real number → **T9** (G9)
- a repair price at or below the elite income of one Reroll tier stone → **T10**
- a skip-token cap above 3/day or 31 gold/day → **T11**
- a price ladder that is not monotonic → **T16**
- a numeric Base weight in the data (ruled even-weighted, so any weight violates A9) → **T15**
- band kills that no longer match the E1-E5 deltas, or zone slices that no longer cover the whole run → **T3a · T3b**
- an income line that differs from loot.md section 2 → **T17** (H1)
- an engine number in the data file that no longer matches what `loot.md` section 2 and the prose formula files publish → **T18** + `tools/check.ts` read-back. This row already earned its keep twice: the high-band drop rate was written as 421 in `loot.md` · `combat.md` · `formula.md` while F3 derives it from the band's own group, and the low band's Lck line read ×1.72 while the low band's own Lck 33 gives ×1.33. All three docs were corrected, the Refine rate went from "~3.8" to the exact **3.75** the price pair gives, and no gold price moved — the junk line is unchanged, so every price stands
- a generated table containing `undefined` or `NaN` → the template-leak scan in both cages
- a stock line naming an NPC that is not present in that settlement, or an NPC placement that breaks the presence rules → **T-S · T-R**

(End of file)
