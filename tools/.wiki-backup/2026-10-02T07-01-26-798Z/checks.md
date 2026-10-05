# Checks

import formula.md
import world.md
import combat.md
import loot.md
import crafting.md
import equipment-slot.md
import skill-tree.md
import item-base.md
import towns.md
import towns-stalls.md

**Registry of all project numbers** · every row is an *expression* traceable back to Mod tables, not a value trusted by repetition.
Use this file as the cage: after changing numbers in any file, run that group check first. Any mismatched row means propagation is unfinished.

> **Groups A · B · C · F are generated.** `node tools/check.js --write` rebuilds each of those four tables from `tools/data/engine.json` (stat line · K values · Mod maxima · loot model · craft prices), and `node tools/check.js --checks` runs 17 invariants plus 43 read-back comparisons against the prose files that publish the same numbers (mod-pool.md · formula.md · formula-utility.md · formula-defense.md · core-stats.md · crafting.md · loot.md). A FAIL means propagation is unfinished; a stale block also fails, so a hand-edit inside a generated table is caught.
> **Groups D1-D5 are not generated yet** — they need `typical_gear_DPS(L)` from a gear model, which no tool holds today, so those rows stay hand-carried and are checked by eye against combat.md · world.md.
> **Groups D6-D14 come from `tools/survival.js`**, which is **not in this repo yet**: the tables below are the recorded output of the model, and after changing field rules (ATK_CAP · elite/boss multipliers · heal) they must be rerun and replaced whole. Never hand-type percentages into them.
> **Group T** (town economy: prices · stock · Standing · demand) comes from `node tools/town.js --checks`, which reads band numbers through `tools/lib/engine.js` — the two files cannot disagree — and refuses to pass while its generated blocks in `towns-stalls.md` and here no longer match that data. `--write` rebuilds them.

# How To Use

| When changing | Must run checks |
|---|---|
| Ranges in mod-pool.md | A · B · C · F |
| Any K in formula.md | B · C · D · E |
| mob HP / tree / gear curve | D · E · G · boss in combat.md |
| Craft price or flow | F · G |
| Weight/Base | B13 · E-weight in item-base.md · formula.md section 11 |
| Town price · stock · roster · Standing · demand | T (`node tools/town.js --checks`) |
| New power-granting system | D (must fold into `mob_HP` in the same step) |

# A · Stat Model

<!-- BEGIN GENERATED:group-A -->
| id | Must hold | Expression | Value |
|---|---|---|---|
| A1 | stat at level 1 | `12 + 2×0` | 12 |
| A2 | stat at level 100 no gear | `12 + 2×99` | 210 |
| A3 | single-stat ceiling | `(210 + 25×12) × (1 + 5%×12)` | **816** |
| A4 | two-stat split ceiling | `6 items + 6 items` = `(210 + 25×6) × (1 + 5×6%) ` | 468 / 468 |
| A5 | if Flat and % forced to different stats | `(210 + 25×12) × 1.0` | 510 → **never revert to this** because all K values are set on 816 |
| A6 | item count origin | 12 worn slots (11 + main hand) · from equipment-slot.md | 12 |

Source: `node tools/check.js` · stat line = `stat_c = 12 + 2 × (level − 1)` (formula.md) · Flat and % maxima from mod-pool.md (Core stat flat 25 · Core stat % 5) · slot count from equipment-slot.md.

<!-- END GENERATED:group-A -->

# B · Derived Stat Ceilings (At 816 + One Slot From Main Hand)

<!-- BEGIN GENERATED:group-B -->
| id | Value | Expression | Result |
|---|---|---|---|
| B1 | Physical / Magic power | `(816×5 + 80) × 1.16` | **4,826** |
| B2 | Max HP (Vit build) | `(816×20 + 3,960) × 1.16` | 23,525 |
| B3 | Max Mana | `816×4 + 1,584` | 4,848 |
| B4 | Mana regen | `816×0.15` | 122/sec |
| B5 | **pool ÷ regen** | `4,848 ÷ 122.4` | **39.6 sec** (intent = 40) |
| B6 | Crit chance | `816×0.05 + 8` | 48.8% |
| B7 | Elem res raw | `816×0.05` | 40.8% |
| B8 | Elem res + 3 Mod items | `40.8 × (1 + 30×3)%` | 77.5 → cut 75 |
| B9 | Alignment raw | `816×0.05` | 40.8% |
| B10 | CDR raw | `816×0.03` | 24.5% |
| B11 | CDR + 4 Mod + BO | `24.5 × (1 + 25×4 + 15)%` | 52.6 → cut 50 |
| B12 | Accuracy | `816×1.5×1.25` | 1,530 |
| B13 | Weight capacity | `816×2` | 1,632 |
| B14 | Drop multiplier | `1 + 816×0.01` | 9.16x |

Every row is the single-stat ceiling (816) plus the one Mod slot that can roll that line (mod-pool.md maxima · equipment-slot.md slot rules).
B5 is the row K_INT_MREGEN was retuned for: 39.6 sec against the 40 sec intent (tolerance ±1 sec).

<!-- END GENERATED:group-B -->

# C · Every Cap Must Be Reachable

<!-- BEGIN GENERATED:group-C -->
| id | Cap | Reachable path | Value at that point |
|---|---|---|---|
| C1 | Dodge 90% chance | opposed by mob accuracy (P1-1 option A2) · reachable path **pending the mob sheet rebalance** · the only Cap in this file without a proven path | pending |
| C2 | (compare) Agi 468 + 1 Flat item | rate = 468×0.15 + 15 = 85 | 46.0% · does not hit Cap ✓ |
| C3 | aspd 300 | sword 1.2 + 25% Mod → Agi = 512 | **512** (ceiling 816) ✓ |
| C4 | aspd 300 | dagger 1.5 + 25% Mod | 312 ✓ · staff/2h unreachable by intent |
| C5 | Perfect dodge 5 | 5 ÷ 0.01 | Lck 500 ✓ |
| C6 | Alignment 50 | Dex 816 (40.8) + amulet + gloves (+5 +5) | 50.8 ✓ |
| C7 | Elem res 75 | Vit 816 + 3 res items | 77.5 → 75 ✓ |
| C8 | CDR 50 | Wis 816 + 4 CDR items + BO | 52.6 → 50 ✓ |
| C9 | Crit 100 | Lck 816 + 8 + buff | 48.8 from stats alone → needs buff ✓ |
| C10 | stun 15% | Alignment 50 × 0.3 | 15 ✓ (old K 0.15 unreachable) |
| C11 | Accuracy | no Cap · `acc/(acc+E)` forbids 100% itself | 1,530 → 93.9% ✓ |

H3 rule: every Cap states whether it is reachable. One row is allowed to read `pending` and it is named — C1 dodge waits on the mob sheet (P1-1), and until then the Cap is not sold to players as reachable.
Agi-per-Cap rows are the same line as formula-utility.md section 7: `300 ÷ weapon_aspd` minus the 100 baseline and the 25% Mod, divided by 0.25 per Agi, plus the level-1 Base of 12.

<!-- END GENERATED:group-C -->

# D · Combat Promises

| id | Must hold | Value |
|---|---|---|
| D1 | `mob_HP(L) = typical_gear_DPS(L) × (1 + 0.0085 L) × (1 + 0.0034 L)` — tree **and** skill list must fold into this line (H1) | L1 121 · L10 682 · L30 2,289 · L60 7,992 · L90 18,901 · L100 **22,016** |
| D2 | `mob_PS = typical_gear_DPS ÷ 27` (**not** `mob_HP ÷ 27`) | L30 61 · L60 163 · L90 304 · L100 **329** · elite ×2 · boss ×4 |
| D3 | TTK of on-level players | 1.0 sec ✓ (by D1 definition) |
| D4 | TTK T1 gear + tree + skill list | `22,016 ÷ (9,847 × 1.85 × 1.34)` = **0.90 sec** (old number remains because the same multipliers sit on both sides) |
| D4b | TTK perfect build (T1 gear + tree ×2.10 + skill) | `22,016 ÷ (9,847 × 2.10 × 1.34)` = **0.79 sec** · this is a ceiling, not a typical value · skill-tree.md section 3 |
| D5 | TTK T1 gear *without* tree and without skill (fresh zone entrant) | `22,016 ÷ 9,847` = **2.24 sec** |
| D6 | groups of 5 Push no build at matching level | 23-46% of pool at L100 · 0-10% in low zones · **single condition is the "max 3 engage at once" rule (world.md · D13)** · `node tools/survival.js` |
| D7 | on-level boss (×15 HP / **×4 damage**) at L100 without heal | glass 119% · mix 112% · tank 109% · dodge 190% → **Push all builds** · at L90 = 125/117/114/203% |
| D8 | heal = Second Wind 20% + Lesser Mend 32% → pool ×1.52 | at L90: glass 82% · mix 77% · tank 75% pass · **dodge 133% still fails** (must split 4 items to Vit → ~97%) · boss = press-to-play gate, not damage gate |
| D12 | elite (×6 HP / ×4 damage) is a mini-boss at ~40-50% of pool (P1-2 option A) · numbers pending `tools/survival.js` rerun |
| D13 | "max 3 mobs engage" rule props the AFK promise | if removed, group-of-5 numbers jump from 23-46% → **109-180%** of pool = all builds pushed while idle |
| D14 | boss must gate active play as G5 promises (run from `tools/survival.js`) | at ×3 damage: AFK kills bosses in 3 of 4 builds (87/80/69%) → promise breaks · at **×4**: all builds pushed at zone 9 without heal, and with heal 3 of 4 pass (82/77/75%) · this multiplier is therefore *forced by other rules*, not freely chosen |
| D15 | tree budget traces back · and forms a TTK band | `6 keystone × 14.2% = 85%` (matches measured +14%) · perfect `6 × 18.3% = 110%` (within 5-30% range) · **minor must have ≈0 DPS budget** (1% left for 82 more) · keystone 4/5/6 → ×1.56/×1.70/×1.84 → TTK **1.19 / 1.09 / 1.01 sec** on mob HP 22,016 (tree side only · skill has no effect because it sits on both sides) |
| D16 | all 18 keystone budget traceable (skill-tree.md 5b) | pool mean **12.7%** (old 14.4% + new 9.4%) · typical path 14.2% = ×1.85 = mob_HP line · best pick 23.3% = **×2.40** which mob_HP intentionally does not cover (= TTK ~0.77 sec = D4b) · worst legal pick 8.6% = ×1.52 · full band 1.52-2.40 with Base line 1.85 mid-band (skill-tree.md 5c) · guard rule: new nodes pushing the typical path past 14.2% must fix mob_HP, not the node |
| D17 | **skill already folded into mob_HP** | `skillF(L) = 1 + 0.0034 × L` → ×1.30 (L90) · ×1.34 (L100) · measured from 3-attack-skill rotation of Base build (uplift 1.339) · result is loot.md kills/hour unmoved because HP and DPS grow together · mob *damage* line excludes skillF (D2) |
| D18 | 51-skill roster passes mechanic gate | `node tools/skills.js --checks` · attack 18 / buff 14 / curse 10 / heal 3 / aura 6 · every Element has an attack skill · every weapon group has at least 4 · AoE Cap 3 targets · no skill references mob armor or mana · glass gains +25% from skills while caster gains 47% but still below gear ceiling |
| D20 | skill income must feed the 51-skill ladder | `node tools/ladder.js --checks` · 184-piece funnel for the whole game · ladder 12 · 2:1 conversion · 4 full targets = 96 pieces (52%) · off-target skills must get ≥1 piece each |
| D19 | 122 tree minors follow D15 budget | `node tools/tree.js --checks` · Impact 41 / Stream 41 / Control 40 · no node grants raw numbers · every node references a real skill/keystone · points: 82 minor + 6 keystone×3 = 100 |
| D9 | Push downtime `MaxHP ÷ (regen×8)` | glass 23 sec · tank 15 sec |
| D10 | all weapons equal DPS | `weapon_mult = 1.2 ÷ weapon_aspd` · 9,847 for all 12 types ✓ |
| D11 | AoE is a real choice, not free (**closed** · skill-pool.md AoE section) | new rule 60% per target · Cap 3 targets · mana ×1.5 → damage per mana = 0.40x (1 target) / 0.80x (2) / **1.20x (3+)** · groups of 5 faster by 1.20x (3.75 sec instead of 4.50) but bosses 2.5x longer = 312% of pool = Push · table run from `tools/survival.js` (aoeTable mode) |

# E · Timeline (All From D1 + Kill Rates)

| id | Checkpoint | Cumulative hr |
|---|---|---|
| E1 | Level 10 | 0.5 |
| E2 | Level 30 (end zone 3) | 3.1 |
| E3 | Level 60 (end zone 6) | 12.6 |
| E4 | Level 90 (end zone 9) | **31.2** |
| E5 | Level 100 | **40.2** |
| E6 | Full-set Refine (60 times @ 3.75/hr) | 16.0 hr |
| E7 | Full-set Ascend (12 items @ 0.8/hr) | 15.0 hr |
| E8 | Full-set polish with Reroll (~100 times @ 52/hr) | ~2 hr |
| E9 | Mastery 1 type to L10 / to L20 | 0.73 hr / 3.3 hr (at L90) |
| E10 | Mastery 12 types to L10 | 8.8 hr = +12% permanent drop |
| E11 | skill ladder (6 pool per zone · 12 pieces/target · 2:1 conversion) | 4 full targets = **20.9 hr (52% of 184-piece funnel)** · 47 other targets average 1.9 pieces · checked with `node tools/ladder.js --checks` |
| E12 | Power magnitude order | gear ×5.6 · tree ×1.85 · skill ×1.1-1.4 |

# F · Loot Engine (High Zone = L90)

<!-- BEGIN GENERATED:group-F -->
| id | Value | Expression |
|---|---|---|
| F1 | kills/hr | `3600 ÷ (group × 1 sec clear + 4 sec spawn) × group` = 1,800 high · 1,385 mid · 980 low |
| F2 | drops per kill | `8% × (1 + Lck×0.01)` = 13.6% (L30) · 18.4% (L60) · 23.2% (L90) · 73.3% (full Lck 816) |
| F3 | drops/hr | `kills/hr × F2` = **418** (L90) · 255 (L60) · 133 (L30) · 1,319 (full Lck) |
| F4 | upgrades/hr | `measured — loot.md section 3 · owned by the keep-rate sim, not by this engine` = hr1 ~30 → hr2-4 2-7 → after that 0-5 · total 0.7-2.2% of drops |
| F5 | Reroll value stone/hr | `junk × 1 = drops − upgrades` = **416** |
| F6 | Reroll value uses/hr | `416 ÷ 8` = **52** |
| F7 | Reroll tier stone/hr | `elite 18 (0.5% of kills ×2) + boss 12 (4 ×3)` = 30 |
| F8 | Refine/hr | `30 ÷ 8` = **3.75** |
| F16 | Refine full set | `12 pieces × 2.5 slots × 2 steps = 60 casts ÷ 3.75` = **16.0 hr** (checks.md E6) |
| F17 | Full-set polish | `100 casts ÷ 52` = **1.92 hr** (checks.md E8) |
| F18 | gold per minute of full-sell income | `junk/hr ÷ 60` = 2.2 low · 4.2 mid · 6.9 high · 21.9 full Lck (towns-stalls.md §1) |
| F19 | full-Lck income ceiling over the no-Lck line | `1,315 ÷ 416` = **×3.16** — the only place Lck may multiply income (G8) |
| F9 | elite / boss only · rate pending rebalance | Add mod stone/hr · status **pending** |
| F10 | ~0.8 (pending) | 1 Add + 8 tier stones = Ascend/hr · status **pending** |
| F11 | 0.15 (was 0.28) · keep-rate unchanged (1.01→1.02%) | Flat line per item (high zone after 0.25 weighting) · status **measured** |
| F12 | boss 1.4 + elite 1.4 + normal 1.8 = 4.6 | skill/hr · skill-pool.md drop chances · status **carried** |
| F13 | 2% per kill mid zones · 3% high zones (farm.md) · exact rate pending rebalance | herb bundles/hr · status **pending** |
| F14 | max 3 uses per fight · 30 sec shared cooldown · suppressed on bosses | potion sustain bound · status **rule** |
| F15 | 1 Reroll tier stone per 500 salvages (~+2.7% of F7) | salvage milestone bound · status **rule** |

Derived from: group spawn 4 sec · 1 sec TTK per mob (checks.md D1-D3) · Lck read at the band's top level (stat_c = 12 + 2×(L−1)) · Base drop 8% (formula-utility.md section 10) · prices 8/8 stones (crafting.md).
F4 · F11 are **simulation output** (loot.md section 3) and F9 · F10 · F13 are unset — this cage does not invent them, it only refuses to let a derived row drift.

<!-- END GENERATED:group-F -->

# G · Economy Rules That Must Hold

| id | Rule |
|---|---|
| G1 | No gold↔stone exchange · gold-priced convenience stalls in settlements only (towns.md section 5) · no buying/selling/trading between players · all crafting media are the 7 stones |
| G2 | Filter-rejected items = 1 Reroll value stone (dissolve) **or** 1 gold (sell), chosen per piece, never both (no full bag) |
| G3 | Ascend is not capped by zone ceiling · cost is boss cores only |
| G4 | Reroll must never roll lower than before |
| G5 | boss 15 min each · AFK cannot kill bosses → second half of crafting is active |
| G6 | Gold has exactly two mints: a filter-rejected piece sold instead of dissolved = 1 gold (loot.md section 4) · Road events, bounded by G9. Task payouts stay stones, Collector pays the item · no source pays both media |
| G7 | Gold never buys power: no gear, no Mods, no potions, no stones, no `mob_HP`-relevant service (towns.md section 0 · H1) |
| G8 | Gold income ceiling = the junk line: ~416/hour high zone (F3-F5), ~1,315/hour at full Lck · legal only while G7 holds · an Lck build's gold advantage must never convert into craft advantage |
| G9 | Every Road/travel purchase pays no stones · road event income ≤ the value of an equal hour spent farming (F1/F5) · AFK never runs on a Road (towns.md section 7) |

# T · Town Economy (gold prices · stock · Standing · demand)

Every row is computed by `node tools/town.js` from `tools/data/town.json`; the tables it writes are in `towns-stalls.md` sections 1-9. The unit is **m = one minute of full-sell income in that band**, so no price here is a feeling about gold. `--checks` exits 1 if a row fails *or* if the doc blocks drifted from the data.

<!-- BEGIN GENERATED:group-T -->
| id | Must hold | Expression | Value |
|---|---|---|---|
| T1 | gold is minted one piece at a time by the sell choice and nothing else (G2 · G6) | `1 gold per sold junk piece` | 1 |
| T2 | the price unit is real income, not a feeling | `junk/hr ÷ 60, per band` | 2.2 low · 4.2 mid · 6.9 high · 21.9 high+full Lck gold per 1 m |
| T3 | lifetime gold supply is the junk line, not a new faucet | `3.1×131 + 9.5×252 + 18.6×416 + 9.0×416` | 14,282 gold |
| T4 | one-time stall demand ≤ 1.50× the supply — a funnel, not a wall | `Σ 17 one-time lines at their charge band` | 18,664 = 1.31× ✓ |
| T5 | essentials ≤ 20% of the supply while ~80%+ still dissolves | `4 Road links · tab 1 at Eastgate · tab 2 · pouch II · deed 4` | 1,951 = 13.7% ✓ |
| T6 | selling everything is a craft decision, priced in craft | `14,282 ÷ 8 stones · ÷ 100 casts per full polish` | 1,785 Reroll casts ≈ 17.9 full-set polishes forgone |
| T7 | the full-Lck advantage stops at the junk line (G8) | `27.6 high-band hr × 1,315 vs × 416` | 36,294 vs 11,482 gold = ×3.16 against the ×3.16 ceiling ✓ |
| T8 | every stall line is space · time · information · appearance only (G7) | `kind tag on all 26 lines · power nouns need an explicit display_only flag` | 26 lines, 0 power lines ✓ |
| T9 | travel never gates content and never beats farming (G9) | `8 links × 20 m one-time · Road trip ≤ 5 real min` | 754 gold = 5.3% of supply ✓ |
| T10 | Armourer repair costs more than the elite time it replaces (D2 service class) | `60 ÷ 18 tier stones/hr = 3.33 m floor` | 14 m · 12 m at Ironrow ✓ · final floor waits on F9 |
| T11 | skip tokens stay inside the tasks.md bound | `8 m × 3/day` | 24 m/day ✓ (payouts untouched) |
| T12 | Standing has 3 tiers per settlement and is counted from F1 kills | `budget hr × tier share × band kills/hr` | see table T-S below, 27 thresholds ✓ |
| T13 | Tier III is a chase, never a formality | `tier III share ≥ 1 × the zone budget` | 1.4 on all 9 ✓ |
| T14 | Collector sets pay items, never gold (G6) | `pays_gold flag on 3 sets` | 0 gold ✓ |
| T15 | Base bias carries no numbers until the keep-rate re-sim | `loot.md section 1 step 2 + section 3` | status = pending · 5 checks open |
| T16 | price ladders are monotonic, so no later tier is cheaper | `stash_tab 60-300 m · herb_pouch 60-240 m · plot_deed 180-540 m · house 120-360 m` | ✓ |
| T17 | this file owns no kill rate: income is loot.md unchanged | `F1 = 980 / 1,385 / 1,800 kills/hr` | mob_HP and the 40.2 hr timeline unmoved ✓ (H1) |
| T18 | no band number is retyped here — town prices divide the engine junk line by 60 | `tools/lib/engine.js (engine.json) → junk/hr per band, then loot.md section 2 read back` | F1 1800 · F3 418 · F5 416 · 17 loot.md numbers read back equal ✓ |

## T-S · Standing thresholds in kills (the numbers T12 reads)

| id | Settlement | Band | Budget hr | Tier I kills | Tier II kills | Tier III kills |
|---|---|---|---|---|---|---|
| eastgate | Eastgate | low | 0.5 | 147 | 368 | 686 |
| millbrook | Millbrook | low | 0.8 | 235 | 588 | 1,098 |
| ashfall | Ashfall | low | 1.8 | 529 | 1,323 | 2,470 |
| ironrow | Ironrow | mid | 2.2 | 914 | 2,285 | 4,266 |
| wolf_cross | Wolf Cross | mid | 3.0 | 1,247 | 3,116 | 5,817 |
| highspire | Highspire | mid | 4.3 | 1,787 | 4,467 | 8,338 |
| bonegate | Bonegate | high | 5.0 | 2,700 | 6,750 | 12,600 |
| frosthold | Frosthold | high | 6.0 | 3,240 | 8,100 | 15,120 |
| vermolch | Vermolch | high | 16.6 | 8,964 | 22,410 | 41,832 |

Source: `node tools/town.js --checks` · data in `tools/data/town.json` · prices, stock and ladders in `towns-stalls.md`.

<!-- END GENERATED:group-T -->

# H · Permanent Invariants

1. **Power-granting systems must fold into `mob_HP` immediately** (D1) · otherwise F1-F3 and craft prices drift silently · tree did this (+85% → ×1.85).
2. **Mastery must not grant per-weapon-type DPS** (D10) · bonus = weight + skill damage for held weapon only + account-wide drop_rate.
3. **New Caps must show "reachable?"** (group C) · unreachable Caps are fake numbers.
4. **Never give two axes the same meaning**: Rarity = Mod count · Base = weight+emphasis · Item quality/Tier = value · never swap terms (glossary).
5. **Flat and % of the same stat may sit on the same item** (A3) · reverting this requires rebuilding all K values and anchor tables.
6. **Numbers in docs are outputs of Mod tables**, not inputs · after changing tables, rerun A-G · the real cage is `node tools/check.js`.
7. **Mob HP and damage lines are different lines** — `mob_HP = typical DPS × tree multiplier` but `mob_damage = gear-side typical DPS only ÷ 27` · tree multiplies only player *speed*, not pool · moving the damage line to divide mob_HP makes on-level players die in 14.6 sec instead of 27 sec, and groups of 5 Push all builds, destroying the AFK promise in concept.md · if an endurance tree is ever added, move this line back to divide the pool (see D2).
8. **Field multipliers must check against "promises" in other files, not float free** — rules announced in one place (G5 "AFK cannot kill bosses" · H2 "Mastery must not grant DPS" · item 1 "1 sec TTK") frame what numbers may sit inside · boss ×3 once violated G5 unnoticed until the §6-§7 model ran · every time a multiplier is set/changed, write it as a row in group D and let `tools/check.js` + `tools/survival.js` judge.
9. **Tree power budget is a hard ceiling · minor nodes must not grant raw DPS numbers** — +85% tree = 6 keystone × 14.2% exactly (D15) · ~1% DPS left for 82 minors · nodes granting direct `+X%` are therefore forbidden (duplicates skill-tree.md rule 5), and nodes wanting more power must work through *rules* (status layers · durations · crit conditions) that make other keystones work, not add numbers straight into DPS · otherwise the whole mob_HP line (D1) plus §6-§7 tables drift silently.

# I · Not Yet Checked (Not Numbers · Blocked On Decisions)

| Topic | Numbers forcing the decision |
|---|---|
| ~~Win condition / post-game loop~~ **Closed** | End = kill zone 9 boss in one spawn without Push (HP 283,516 · heal required · concept.md) · post-game has no prestige, only measured craft/collection timelines (E6/E7/E9-E11) |
| ~~save~~ **Closed** | local only · 3 slots (Mastery+collection+drop_rate shared account-wide) · no undo because Reroll "never lower" + 8 stones/roll · export/import is JSON with schema version · 3 snapshots · offline clock guarded by monotonic + 12 hr Cap (save.md) |
| ~~combat.md §6/§7 tables~~ **Closed** | both sections run from `tools/survival.js` (boss damage raised to ×4 · see D14) · changing field rules (ATK_CAP · elite/boss multipliers · heal) requires rerunning the script and replacing tables. Never hand-type. |
| Pure-dodge beats no boss | 203% at zone 9 even with heal (133%) · must split 4 items to Vit → ~97% · still the question what a "full dodge" build must pay · links to fast hit |
| 122 minor nodes + 6 more keystone | **6 keystone written** (skill-tree.md 5b · budget checked in D16) · 122 minors remain as rule nodes (0 DPS per D15) + 9 exclusive pairs complete (skill-tree.md 5c · tree band 1.52-2.40 · Base ×1.85 mid-band) · still blocked on Elements (Attunement ↔ Crossfeed must be designed together) |
| Is fast hit a build or cut | Agi 12 = 3,830 DPS vs Str 12 = 9,847 (2.6x gap) |
| Are Elements a real build | gated +21% per hit · DoT = 8% of that build DPS |
| ~~AoE loses to single-target~~ **Closed** | 60%/target + Cap 3 + mana ×1.5 rules set (D11) · unlocks minor node and keystone design choosing "strong single-target" vs "groups" |
| Does elite mean anything | 6-17% of pool lower than groups of 5 (23-46%) in all builds · see D12 |
| skill ladder | E11 |
| Towns · travel · NPC stalls | **doors chosen** (towns.md section 9) · **prices chosen**: every gold line, both ladders, the 9 rosters, stock and the 27 Standing kill thresholds are generated in group T + `towns-stalls.md` · still open: the Base bias re-simulation (T15), the F9/F13 lines repair and the pouch ladder depend on (T10), and whether a Collector set can be finished without opening the filter (a rule question, not a number) |
