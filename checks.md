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
> **Groups D1-D2 are cross-checked, D3-D5 still by eye** — the damage line is no longer a second typed fact: **X27** inverts every D1 HP anchor through the skill multiplier `÷ 27` and requires it to equal D2, and **X37** defines `mob_HP(L)` at every level by anchoring the curve at each zone edge and interpolating linearly inside the zone, so `typical_gear_DPS(L)` exists *between* the anchors instead of only at them. D3-D5 (the TTK band) still read by eye.
> **Groups D6-D14 come from `tools/survival.js`** — the survival cage (`node tools/survival.js --checks`, run by `tools/verify.js`). `combat.md` §6/§7 are its generated blocks, so after changing any field rule (ATK_CAP · elite/boss multipliers · heal) rerun `node tools/survival.js --write` then `--checks` — never hand-edit those tables. The D6-D14 rows below are hand-typed from that output and must be re-derived whenever it moves.
> **D18 · D19 · D20 now run from real cages**: `node tools/skills.js --checks` (roster from `tools/data/skills.json`), `node tools/tree.js --checks` (node tables + `tools/data/tree.json`) and `node tools/ladder.js --checks` (duplicate economy → D20/E11). Run every cage and the cross-file linter with `node tools/verify.js`.
> **Group T** (town economy: prices · stock · Standing · demand) comes from `node tools/town.js --checks`, which reads band numbers through `tools/lib/engine.js` — the two files cannot disagree — and refuses to pass while its generated blocks in `towns-stalls.md` and here no longer match that data. `--write` rebuilds them.

# Reference codes

Every id in this project is a **row label**, not jargon — this is the decoder. A design doc cites one to point at the guard that owns a number; the guard itself lives in the cage named here.

| Code | Lives in | Means |
|---|---|---|
| `A# B# C# D# E# F# G# H# I# T#` | this file | rows of this registry — the promise rows |
| `X#` | `tools/check.js` | an engine-cage invariant |
| `RB` | `tools/check.js` | a read-back of a doc value against the engine |
| `OP#` | `tools/check.js` | an opening (minute-one) gate |
| `S#` | `tools/skills.js` | a skills-cage gate |
| `T#` | `tools/tree.js` | a tree-cage gate — **note the clash: `T#` is also the town group in this file** |
| `T#` | `tools/town.js` | a town-cage gate |
| `SV#` | `tools/survival.js` | a survival-cage gate |
| `IV#` | `tools/inventory.js` | an inventory-cage gate |
| `TL#` | `tools/timeline.js` | a timeline-cage gate |
| `LD#` | `tools/ladder.js` | a ladder-cage gate |
| `L#` | `tools/lint.js` | a doc-lint rule |
| `A#` | `tools/anchors.js` | an anchor-cage gate |
| `D-0NN` | `harness/decisions.md` | a decision-log entry |
| `§N` | the same file | a section number |

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
| A3 | single-stat ceiling | `210 + 25×12` | **510** |
| A4 | two-stat split ceiling | `6 items + 6 items` = `210 + 25×6` | 360 / 360 |
| A5 | no % term reinstated | `(210 + 25×12) × 1.0` | 510 → **never revert to this** because all K values are set on 510 |
| A6 | item count origin | 12 worn slots (11 + main hand) · from equipment-slot.md | 12 |

Source: `node tools/check.js` · stat line = `stat_c = 12 + 2 × (level − 1)` (formula.md) · the Flat maximum from mod-pool.md (Stat Mod flat 25 · Stat Mod % is retired, D-114, so A3 is a flat-only sum) · slot count from equipment-slot.md.

<!-- END GENERATED:group-A -->

# B · Derived Stat Ceilings (At 510 + One Slot From Main Hand)

<!-- BEGIN GENERATED:group-B -->
| id | Value | Expression | Result |
|---|---|---|---|
| B1 | Physical / Magic power | `(510×5 + 80) × 1.16` | **3,051** |
| B2 | Max HP (Vit build) | `(510×20 + 3,960) × 1.16` | 16,774 |
| B3 | Max Mana | `510×4 + 1,584` | 3,724 |
| B4 | Mana regen | `510×0.18` | 92/sec |
| B5 | **pool ÷ regen** | `3,724 ÷ 91.8` | **40.6 sec** (intent = 40) |
| B6 | Crit chance (no Flat) | `510×0.05 + 8% Mod` | 33.5% |
| B6b | Crit chance Cap → overflow | `min(33.5, 100)` | 33.5% chance · overflow 0.0% → crit damage 220% |
| B7 | Elem res raw | `510×0.05` | 25.5% |
| B8 | Elem res + 3 Mod items | `25.5 × (1 + 30×3)%` | 48.4 → cut 45 |
| B9 | Alignment raw | `510×0.05` | 25.5% |
| B10 | CDR raw | `510×0.03` | 15.3% |
| B11 | CDR + 4 Mod + BO | `15.3 × (1 + 25×11 + 0)%` | 57.4 → cut 55 |
| B12 | Accuracy | `510×1.5×1.25` | 956 |
| B13 | Weight capacity | `510×2` | 2,020 |
| B14 | Drop multiplier | `1 + 510×0.01` | 6.10x |
| B15 | Energy Shield pool (Int build) | `510×4` | **2,040** · 24.1% of the same build's 8,460 HP |
| B16 | ES recharge · full recovery | `510×0.1/sec · after 5 sec without a hit` | 51.0/sec → **40.0 sec** for the whole pool · pool ÷ regen held by **X25** |

Every row is the single-stat ceiling (510) plus the one Mod slot that can roll that line (mod-pool.md maxima · equipment-slot.md slot rules).
B5 is the row K_INT_MREGEN was retuned for: 40.6 sec against the 40 sec intent (tolerance ±1 sec).

<!-- END GENERATED:group-B -->

# C · Every Cap Must Be Reachable

<!-- BEGIN GENERATED:group-C -->
| id | Cap | Reachable path | Value at that point |
|---|---|---|---|
| C1 | Evasion 80% | Dex rating ÷ (rating + that mob's accuracy), then + Agi ÷ 30 points, capped together · the same opposed shape the mob side dodges with (X20) | **reachable** ✓ |
| C2 | (compare) Dex 360 + 1 Flat item vs the floor lineage | rating = 360×0.5 + 30 = 210, + Agi 360 ÷ 30 | 80.0% vs Husk · does not hit Cap ✓ |
| C3 | aspd 500 | sword 1.2 + 25% Mod → Agi = 1,179 | **1,179** (ceiling 510) ✓ |
| C4 | aspd 500 | dagger 1.5 + 25% Mod | 845 ✓ · staff/2h unreachable by intent |
| C5 | Perfect dodge 21 | ratio: Lck 510 × 0.03 = rate 15.3 ÷ (rate + 57) = 21.2% · the Cap binds first · reached at Lck 506 | **21%** at the Cap · reachable at Lck 506 (under the 510 ceiling) ✓ |
| C6 | Alignment 35 | Dex 510 (25.5) + amulet + gloves (+5 +5) | 35.5 ✓ |
| C7 | Elem res 45 | Vit 510 + 3 res items | 48.4 → 45 ✓ |
| C8 | CDR 55 | Wis 510 + 11 CDR items + BO | 57.4 → 55 ✓ |
| C9 | Crit (no Cap) | Lck 510 + 8% Mod + buff | 33.5% from stats alone · anything over 100 becomes crit damage (B6b) ✓ |
| C10 | stun 11% | Alignment 35 × 0.3 | 11 ✓ (old K 0.15 unreachable) |
| C11 | Accuracy | no Cap · `acc/(acc+E)` forbids 100% itself | 956 → 90.6% ✓ |

H3 rule: every Cap states whether it is reachable, and no row reads `pending` any more — the last one, evasion, was closed by putting it on the opposed form the mob side already uses, so X20 can prove it both ways.
Agi-per-Cap rows are the same line as formula-utility.md section 7: `${E.caps.aspd} ÷ weapon_aspd` minus the 100 baseline and the 25% Mod, divided by ${K.K_AGI_ASPD} per Agi, plus the level-1 Base of 12.

<!-- END GENERATED:group-C -->

# D · Combat Promises

| id | Must hold | Value |
|---|---|---|
| D1 | `mob_HP(L) = typical_gear_DPS(L) x (1 + 0.0034 L)` - the skill list is the only power multiplier that folds into this line (H1) · **there is no passive tree**, so nothing else multiplies here · the curve is anchored at every zone edge and interpolated inside the zone, so every level 1-90 has an HP (**X37**) | L1 120 · L10 629 · L30 1,824 · L60 5,293 · L90 **10,709 (highest level a mob can spawn)** · L100 11,901 *(theoretical - the spawn cap is 90)* · zone edges in `world.md` · per-entry numbers in `mob-roster.md` |
| D2 | `mob_PS = typical_gear_DPS ÷ 27` (**not** `mob_HP ÷ 27`) | L30 61 · L60 163 · L90 **304 (highest a mob can spawn)** · L100 329 *(theoretical)* · elite ×4 · boss ×16 (D-048) |
| D3 | TTK of on-level players | 1.0 sec ✓ (by D1 definition) |
| D4 | TTK on-level gear + skill list | `11,901 ÷ (8,881 × 1.34)` = **1.00 sec** (T1 gear + full skill list; there is no passive tree, so this is the only build ceiling) |
| D5 | TTK T1 gear *without* skill (fresh zone entrant) | `11,901 ÷ 8,881` = **the skill multiplier, read as seconds** — mob_HP is priced for a player who already holds the list · at the spawn cap 90 it is `10,709 ÷ 8,881` = 1.21 sec |
| D6 | groups of 5 Push no build at matching level | the generated `survival-group` block in `combat.md` §6 (no build is Pushed at L100) · **single condition is the "max 3 engage at once" rule (world.md · D13)** · `node tools/survival.js` |
| D7 | on-level boss (×15 HP / **×16 damage**) at L100 without heal | printed live in the `survival-boss` block of `combat.md` §6 — every build is Pushed, no theme clears it standing still · `SV6` |
| D8 | heal = Greater Heal 45% + Heal 64% → pool **×2.09** (`engine.json` `build.heal_pool_mult`) | one round turns the §6 boss Pushes into passes for the two themes that spend their items on surviving (`mix` · `tank`), while the glass and Evasion themes stay Pushed even with heal · the boss is a press-to-play gate, not a damage gate · `SV6` names the pair |
| D12 | elite (×6 HP / ×4 damage) is a mini-boss, not a group · generated by `tools/survival.js` (block `survival-elite`), no longer hand-typed |
| D13 | "max 3 mobs engage" rule props the AFK promise | if removed, 5 attackers replace 3 and the group cost scales by roughly 5/3; the measured cost under the rule is the generated `survival-group` block |
| D14 | boss must gate active play as G5 promises — **run from `tools/survival.js`, gated by SV6** | the boss damage multiplier is forced by the promise, not freely chosen: it must Push at least three of the four builds without heal and let the two surviving themes pass with one heal round — SV6/SV7 assert *which* themes pass, not just how many. The value that does both is **×16** (`engine.json` `mob.sizes` boss `ps`) |
| D18 | roster passes mechanic gate — **PASSES via `node tools/skills.js --checks`** | every Element has an attack skill · every weapon group has at least 4 · buff is a timed self-buff (10 sec on / 15 sec cd) · no skill references mob armour or mob mana · the live per-type counts are the generated block in `skill-pool.md`, never typed here · **skill share columns are stale under reservation and need a rerun** |
| D22 | **armour is one Str line on both sides** — every number in this row is printed by `node tools/check.js --checks` (**X22**) | `K_ARMOUR` · reduction `armour ÷ (armour + K_armour_divisor × raw physical)` · no Cap. Guard: **X22** holds the full-Str cut of a zone-9 boss's *physical half* inside its design band, requires armour to keep answering trash mobs, and forbids any mob's own armour walling a max physical hit. The band's floor has moved twice for a stated reason: down when boss damage was raised for the G5 gate — a PoE ratio cuts less of a bigger hit (D-048) — and down again when Core Stat % retired, because the armour line is Str-driven and the boss's physical half is anchored on mob DPS, which did not move (D-114) |
| D23 | **the mob roster is complete** — generated by `mobRoster()` and checked by **X23** · `mob-roster.md` is the output | 15 species × 4 body classes (Small · Medium · Large · Boss) over the 9 zones, plus Elite and one named boss per zone. Guard: at least 5 entries per zone, the boss species must actually live in its zone, and a species may not bias an Element none of its zones carry |
| D26 | **Energy Shield is a timed second pool, player-only** — printed by **X25** | `K_INT_ES` · `K_INT_ESREGEN` · `energy_shield.delay_sec` · full pool in `energy_shield.recover_sec` · guard: **X25** holds the shield inside its share band of the same Int build's HP, so it supplements HP instead of doubling it, and forbids any leak to the mob side (H1). The share fell when Core Stat % retired, because the pool is Int-driven and follows the stat ceiling while the level-only HP it is compared against does not (D-114) |
| D24 | **a mob dodges the way we do** — generated and checked by **X24** | `dodge = own Agi rate ÷ (own rate + attacker accuracy)` (D-024) · guard: every roster entry between 2% and 25%, so mob Agi stays flavour and never a second wall |
| D30 | **Ascend is priced by the engine at the hour the design sells** — **X30** | 8 Add mod stones + 8 Reroll tier stones per Ascend, so Add stones bind and a full 12-piece set lands near the promised ~15 hr (F10 · E7) |
| D31 | **body class may not move the funnel** — **X32** | `mob_HP(L)` is the zone average; group entries divide by the zone's weighted body factor (spawn weights Small 3 · Medium 2 · Large 1), so kills/hour, drops/hour and the timeline hold by construction |
| D32 | **the species damage tag is a rule** — **X31** | physical = the whole armour-able half, magic = the whole res-able half, mixed = 50/50 by innate Element |
| D33 | **near and far is a queue, not a map** — **X33** | reach bands (melee 1 · reach 2 · stand-off 3) over a front-line-first queue; the cost to a reach-1 build is measured and must stay under 12% of the cycle |
| D34 | **the six buffs and the Haste aura are folded by measurement, not by a new multiplier** — closed by D-103 | Warcry / Berserker / Iron Will / Holy veil / Ghost Dance / Magia Drive are timed self-buffs the player spends a slot on; `Haste` is an aura that reserves 25% and multiplies cooldowns (post-Cap) and final aspd by ×1.15. The uplift to price is the expected value across each uptime: physical x1.15 + align/res x1.20 (Warcry), aspd x1.20 + leech + damage taken x1.15 (Berserker), Armour x1.20 + damage taken x0.90 (Iron Will), debuff immunity (Holy veil), N deleted hits (Ghost Dance), continuous ES refill (Magia Drive), and the clock itself (Haste). `checks.md` H1 forbids landing them unfolded — and they no longer are: `game/tests/gearedB1.test.ts` runs the whole bar, these rows included, against the same geared character with nothing slotted, so their share is inside the measured list multiplier rather than added to it by hand |
| D35 | **a mob skill re-times damage and never adds it — bounded by the pool, gated by SV8** | `combat.md` §5b prices a mob skill as a re-timing of that mob's own `mob_PS` (D-067). No skill list exists yet to name a window, so the cage bounds the window instead of guessing one: every AFK-reachable shape must absorb at least two seconds of its own priced damage before the pool empties, which is what stops "burst then gap" from becoming a one-hit kill. SV8 prints the measured margin per build and kind |
| D36 | **the Upgrade ladder's value is published and bounded — X42 and SV7** | one +1 adds `craft.gear_mod_per_level`, and the full ladder lands exactly on the smallest of the three school ceilings in `mod_max` (`item-base.md` says which school a Base raises), so no upgraded piece out-prints a T1 rolled line. The uplift is paid for at the encounter — SV7 re-runs the level-cap boss against a full set and the G5 promise still holds — so `mob_HP` does not move (H1 · D-103) |
| D20 | skill income must feed the ladder — **generated by `node tools/ladder.js --checks`** | the generated `ladder-math` block in `skill-pool-system.md` prints the funnel, the per-target split and the zone pool; never typed here |
| D9 | Push downtime `MaxHP ÷ (regen×8)` — generated by `node tools/survival.js` (block `push-table`) | glass 44 sec · tank 32 sec |
| D10 | all weapons equal DPS | `weapon_mult = 1.2 ÷ weapon_aspd` · `weapon_aspd` cancels out of `power × times/sec`, so all 12 types land on the same Expected DPS at equal stats ✓ (**X14**) |
| D11 | AoE is a real choice, not free (**closed** · skill-pool.md AoE section) | new rule 60% per target · Cap 3 targets · mana ×1.5 → damage per mana = 0.40x (1 target) / 0.80x (2) / **1.20x (3+)** · groups of 5 faster by 1.20x (3.75 sec instead of 4.50) but bosses 2.5x longer = 312% of pool = Push · the AoE table is hand-typed and no cage generates it yet (`harness/todo.md` section B) |

# E · Timeline (All From D1 + Kill Rates)

| id | Checkpoint | Cumulative hr |
|---|---|---|
| E1 | Level 10 | 0.5 |
| E2 | Level 30 (end zone 3) | 3.1 |
| E3 | Level 60 (end zone 6) | 12.6 |
| E4 | Level 90 (end zone 9) | **31.2** |
| E5 | Level 100 | **40.2** |
| E6 | Full-set Refine (24 times @ 3.75/hr · Tier is per item · D-033) | 6.4 hr |
| E7 | Full-set Ascend (12 items @ 0.8/hr) | 15.0 hr |
| E8 | Full-set polish with Reroll (~100 times @ 52/hr) | ~2 hr |
| E9 | Mastery 1 type to L10 / to L20 | 1.13 hr / 5.0 hr (at L90) · kill-based, tied to the XP curve (equipment-weapon.md · D-065) |
| E10 | Mastery 12 types to L10 | 13.5 hr = +12% permanent drop |
| E11 | skill ladder — **generated by `node tools/ladder.js --checks`** (block `ladder-math` in `skill-pool-system.md`) | the generated block prints the funnel, the 4-target share, the per-skill average and the zone pool; never typed here |
| E12 | Power magnitude order | gear x5.6 - skill x1.1-1.4 - there is no third multiplier between them |

# F · Loot Engine (High Zone = L90)

<!-- BEGIN GENERATED:group-F -->
| id | Value | Expression |
|---|---|---|
| F1 | kills/hr | `3600 ÷ (group × 1 sec clear + 4 sec spawn) × group` = 1,800 high · 1,385 mid · 980 low |
| F2 | drops per kill | `8% × (1 + Lck×0.01)` = 13.6% (L30) · 18.4% (L60) · 23.2% (L90) · 48.8% (full Lck 510) |
| F3 | drops/hr | `kills/hr × F2` = **418** (L90) · 255 (L60) · 133 (L30) · 878 (full Lck) |
| F4 | upgrades/hr | `measured — tools/loot.js, the seven roll steps in loot.md section 1` = hr1 28.7 → hr2-4 9.4 → after that 5.7 (low band) · keep-rate 2.35% low · 1.40% mid · 0.75% high · 0.36% high + full_lck |
| F5 | Reroll value stone/hr | `junk × 1 = drops − upgrades` = **415** |
| F6 | Reroll value uses/hr | `415 ÷ 8` = **52** |
| F7 | Reroll tier stone/hr | `elite 18 (20% of kills ×0.05) + boss 12 (4 ×3)` = 30 |
| F8 | Refine/hr | `30 ÷ 8` = **3.75** |
| F9 | Add mod stone/hr | `elite 2.25 (20% of kills × 0.625% chance) + boss 4 (4 ×1)` = **6.25** |
| F10 | Ascend/hr | `min(F9 ÷ 8 Add, F7 ÷ 8 tier) — the scarcer stone sets the pace` = **0.78** · full 12-piece set **15.4 hr** (Add alone 1.9 hr · tier stones alone 6.4 hr → tier stones bind) |
| F13 | herb bundles/hr | `separate roll · 2.00% per kill mid · 3.00% high · bundle of 1-3 zone-tier herbs` = mid band **27.70/hr** · high band **54.00/hr** |
| F16 | Refine full set | `12 pieces × 1 slots × 2 steps = 24 casts ÷ 3.75` = **6.4 hr** (checks.md E6) |
| F17 | Full-set polish | `100 casts ÷ 52` = **1.92 hr** (checks.md E8) |
| F18 | gold per minute of full-sell income | `junk/hr ÷ 60` = 2.2 low · 4.2 mid · 6.9 high · 14.6 full Lck (towns-stalls.md §1) |
| F19 | full-Lck income ceiling over the no-Lck line | `875 ÷ 415` = **×2.11** — the only place Lck may multiply income (G8) |
| F20 | Quality Stone/hr | `monster 18 (1% of kills) + elite 90 (1 in 5 × 25%) + boss 96 (4 ×24)` = **204** |
| F21 | Upgrade full set | `1 + 2 + 3 + 4 + 5 + 7 + 9 + 11 + 13 + 15 + 18 + 21 + 24 + 27 + 30 = 190 per piece × 12 pieces = 2280 stones ÷ F20` = **11.2 hr** for a full +15 set · the steps 11-15 third alone, hunted only from bosses, is **15.0 hr** (crafting.md "sources shift monsters → elites → bosses by step") |
| F22 | Repair and Corrupt stone/hr | `Repair: elite 18 (1 in 5 × 5%) + boss 4 · Corrupt: boss 4 × 25% chance` = Repair **22/hr** · Corrupt **1.0/hr** — the rarest stone, so one gamble per piece costs about an hour and a full 12-piece set of gambles is 12 hr (crafting.md §Corrupt) |
| F11 | 0.31 Flat lines per high-zone drop (2.75 lines per item) · the four early-game Flats thin out as Item quality rises | Flat line per drop (high zone, after the 0.25 early-game weighting) · status **measured** |
| F12 | boss 1.4 + elite 1.4 + normal 1.8 = 4.6 | skill/hr · skill-pool.md drop chances · status **carried** |
| F14 | max 3 uses per fight · 30 sec shared cooldown · suppressed on bosses | potion sustain bound · status **rule** |
| F15 | 1 Reroll tier stone per 500 salvages (~+2.7% of F7) | salvage milestone bound · status **rule** |

Derived from: group spawn 4 sec · 1 sec TTK per mob (checks.md D1-D3) · Lck read at the band's top level (stat_c = 12 + 2×(L−1)) · Base drop 8% (formula-utility.md section 10) · prices 8/8 stones (crafting.md).
F4 · F11 are **simulation output** (loot.md section 3) and F13 is unset — this cage does not invent it, it only refuses to let a derived row drift.

<!-- END GENERATED:group-F -->

# G · Economy Rules That Must Hold

| id | Rule |
|---|---|
| G1 | No gold↔stone exchange · gold-priced convenience stalls in settlements only (towns.md section 5) · no buying/selling/trading between players · all crafting media are the 7 stones |
| G2 | Filter-rejected gear = 1 Reroll value stone (dissolve); gold is minted separately by mob junk, so no piece pays both media |
| G3 | Ascend is not capped by zone ceiling · cost is boss cores only |
| G4 | Reroll must never roll lower than before |
| G5 | boss 15 min each · AFK cannot kill bosses → second half of crafting is active |
| G6 | Gold has exactly two mints: **mob junk sold at the Counterhand** (loot.md section 4) · Road events, bounded by G9. Task payouts stay stones, Collector pays the item · no source pays both media |
| G7 | Gold never buys power: no gear, no Mods, no potions, no stones, no `mob_HP`-relevant service (towns.md section 0 · H1) |
| G8 | Gold income ceiling = the junk line (mob junk sold): ~415/hour high zone (F3-F5), ~1,316/hour at full Lck · legal only while G7 holds · an Lck build's gold advantage must never convert into craft advantage |
| G9 | Every Road/travel purchase pays no stones · road event income ≤ the value of an equal hour spent farming (F1/F5) · AFK never runs on a Road (towns.md section 7) |

# T · Town Economy (gold prices · stock · Standing · demand)

Every row is computed by `node tools/town.js` from `tools/data/town.json`; the tables it writes are in `towns-stalls.md` sections 1-9. The unit is **m = one minute of full-sell income in that band**, so no price here is a feeling about gold. `--checks` exits 1 if a row fails *or* if the doc blocks drifted from the data.

<!-- BEGIN GENERATED:group-T -->
| id | Must hold | Expression | Value |
|---|---|---|---|
| T1 | gold is minted by the sell choice, plus one bounded exception: the Road purse (G2 · G6 · X36) | `1 gold per sold junk piece · Road ceiling 24 gold/day, never stones, never AFK` | 1 |
| T2 | the price unit is real income, not a feeling | `junk/hr ÷ 60, per band` | 2.2 low · 4.2 mid · 6.9 high · 14.6 high+full Lck gold per 1 m |
| T3 | lifetime gold supply is the junk line, not a new faucet | `3.1×130 + 9.5×251 + 18.6×415 + 9.0×415` | 14,242 gold |
| T4 | one-time stall demand ≤ 1.50× the supply — a funnel, not a wall | `Σ 17 one-time lines at their charge band` | 18,664 = 1.31× ✓ |
| T5 | essentials ≤ 20% of the supply while ~80%+ still dissolves | `4 Road links · tab 1 at Eastgate · tab 2 · pouch II · deed 4` | 1,951 = 13.7% ✓ |
| T6 | selling everything is a craft decision, priced in craft | `14,242 ÷ 8 stones · ÷ 100 casts per full polish` | 1,780 Reroll casts ≈ 17.8 full-set polishes forgone |
| T7 | the full-Lck advantage stops at the junk line (G8) | `27.6 high-band hr × 875 vs × 415` | 24,150 vs 11,454 gold = ×2.11 against the ×2.11 ceiling ✓ |
| T8 | every stall line is space · time · information · appearance only (G7) | `kind tag on all 26 lines · power nouns need an explicit display_only flag` | 26 lines, 0 power lines ✓ |
| T9 | travel never gates content and never beats farming (G9) | `8 links × 20 m one-time · Road trip ≤ 5 real min` | 754 gold = 5.3% of supply ✓ |
| T10 | Armourer repair costs more than the elite time it replaces (D2 service class) | `60 ÷ 18 tier stones/hr = 3.33 m floor · F9 re-checked in T10b` | 14 m · 12 m at Ironrow ✓ |
| T11 | skip tokens stay inside the tasks.md bound | `8 m × 3/day` | 24 m/day ✓ (payouts untouched) |
| T12 | Standing has 3 tiers per settlement and is counted from F1 kills | `budget hr × tier share × band kills/hr` | see table T-S below, 27 thresholds ✓ |
| T13 | Tier III is a chase, never a formality | `tier III share ≥ 1 × the zone budget` | 1.4 on all 9 ✓ |
| T14 | Collector sets pay items, never gold (G6) | `pays_gold flag on 3 sets` | 0 gold ✓ |
| T15 | Base bias is permanent flavour — ruled even-weighted, so it may never carry a number | `loot.md section 1 step 2 + section 3` | status = decided · 3 guards · 0 numeric weights |
| T16 | price ladders are monotonic, so no later tier is cheaper | `stash_tab 60-300 m · herb_pouch 60-240 m · plot_deed 180-540 m · house 120-360 m` | ✓ |
| T17 | this file owns no kill rate: income is loot.md unchanged | `F1 = 980 / 1,385 / 1,800 kills/hr` | mob_HP and the 40.2 hr timeline unmoved ✓ (H1) |
| T18 | no band number is retyped here — town prices divide the engine junk line by 60 | `tools/lib/engine.js (engine.json) → junk/hr per band, then loot.md section 2 read back` | F1 1800 · F3 418 · F5 415 · 17 loot.md numbers read back equal ✓ |

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
7. **Mob HP and damage lines are different lines** - `mob_HP = typical DPS x skill multiplier x 1 sec` sets how long a mob lives; `mob_PS = typical DPS / 27` sets how hard it hits. The skill factor cancels out of the damage line, so mobs lose HP when the skill list grows but keep the same damage.
8. **Field multipliers must check against "promises" in other files, not float free** — rules announced in one place (G5 "AFK cannot kill bosses" · H2 "Mastery must not grant DPS" · item 1 "1 sec TTK") frame what numbers may sit inside · boss ×3 once violated G5 unnoticed until the §6-§7 model ran · every time a multiplier is set/changed, write it as a row in group D and let `tools/check.js` + `tools/survival.js` judge.
9. **Retired - the tree power budget is gone** - the 85% passive ceiling left with `skill-tree.md`, and nothing may reintroduce a hidden multiplier |

# I · Not Yet Checked (Not Numbers · Blocked On Decisions)

| Topic | Numbers forcing the decision |
|---|---|
| Pure-Evasion beats no boss | the `survival-boss` block keeps the evasion build Pushed even with heal, alongside the glass build (SV6) · the fix is splitting items to Vit · the question left is what a "full evasion" build must pay · links to fast hit |
| skill ladder | E11 |
| Towns · travel · NPC stalls | **doors chosen** (towns.md section 9) · **prices chosen**: every gold line, both ladders, the 9 rosters, stock and the 27 Standing kill thresholds are generated in group T + `towns-stalls.md` · Base bias is **ruled even-weighted** (T15 permanent flavour, A9) and Collector sets are **finishable without the filter** (a rule, not a number) · still open: the F9/F13 lines the repair floor and the pouch ladder depend on (T10), which are measurements for `harness/todo.md` section B |
