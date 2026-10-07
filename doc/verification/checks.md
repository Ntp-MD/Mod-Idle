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

> **Groups A · B · C · F are generated.** `node tools/check.ts --write` rebuilds each of those four tables from `tools/data/engine.json` (stat line · K values · Mod maxima · loot model · craft prices), and `node tools/check.ts --checks` runs 17 invariants plus 43 read-back comparisons against the prose files that publish the same numbers (mod-pool.md · formula.md · formula-utility.md · formula-defense.md · core-stats.md · crafting.md · loot.md). A FAIL means propagation is unfinished; a stale block also fails, so a hand-edit inside a generated table is caught.
> **Groups D1-D2 are cross-checked, D3-D5 still by eye** — the damage line is no longer a second typed fact: **X27** inverts every D1 HP anchor through the skill multiplier `÷ 27` and requires it to equal D2, and **X37** defines `mob_HP(L)` at every level by anchoring the curve at each zone edge and interpolating linearly inside the zone, so `typical_gear_DPS(L)` exists *between* the anchors instead of only at them. D3-D5 (the TTK band) still read by eye.
> **Groups D6-D14 come from `tools/survival.ts`** — the survival cage (`node tools/survival.ts --checks`, run by `tools/verify.ts`). `combat.md` §6/§7 are its generated blocks, so after changing any field rule (ATK_CAP · elite/boss multipliers · heal) rerun `node tools/survival.ts --write` then `--checks` — never hand-edit those tables. The D6-D14 rows below are hand-typed from that output and must be re-derived whenever it moves.
> **D18 · D19 · D20 now run from real cages**: `node tools/skills.ts --checks` (roster from `tools/data/skills.json`), `node tools/tree.ts --checks` (node tables + `tools/data/tree.json`) and `node tools/ladder.ts --checks` (duplicate economy → D20/E11). Run every cage and the cross-file linter with `node tools/verify.ts`.
> **Group T** (town economy: prices · stock · Standing · demand) comes from `node tools/town.ts --checks`, which reads band numbers through `tools/lib/engine.ts` — the two files cannot disagree — and refuses to pass while its generated blocks in `towns-stalls.md` and here no longer match that data. `--write` rebuilds them.

# Reference codes

Every id in this project is a **row label**, not jargon — this is the decoder. A design doc cites one to point at the guard that owns a number; the guard itself lives in the cage named here.

| Code | Lives in | Means |
|---|---|---|
| `A# B# C# D# E# F# G# H# I# T#` | this file | rows of this registry — the promise rows |
| `X#` | `tools/check.ts` | an engine-cage invariant |
| `RB` | `tools/check.ts` | a read-back of a doc value against the engine |
| `OP#` | `tools/check.ts` | an opening (minute-one) gate |
| `S#` | `tools/skills.ts` | a skills-cage gate |
| `T#` | `tools/tree.ts` | a tree-cage gate — **note the clash: `T#` is also the town group in this file** |
| `T#` | `tools/town.ts` | a town-cage gate |
| `SV#` | `tools/survival.ts` | a survival-cage gate |
| `IV#` | `tools/inventory.ts` | an inventory-cage gate |
| `TL#` | `tools/timeline.ts` | a timeline-cage gate |
| `LD#` | `tools/ladder.ts` | a ladder-cage gate |
| `L#` | `tools/lint.ts` | a doc-lint rule |
| `A#` | `tools/anchors.ts` | an anchor-cage gate |
| `§N` | the same file | a section number |

# How To Use

| When changing | Must run checks |
|---|---|
| Ranges in mod-pool.md | A · B · C · F |
| Any K in formula.md | B · C · D · E |
| mob HP / tree / gear curve | D · E · G · boss in combat.md |
| Craft price or flow | F · G |
| Weight/Base | B13 · E-weight in item-base.md · formula.md section 11 |
| Town price · stock · roster · Standing · demand | T (`node tools/town.ts --checks`) |
| New power-granting system | D (must fold into `mob_HP` in the same step — the passive tree is the standing exception, and stays outside the curve) |

# A · Stat Model

<!-- BEGIN GENERATED:group-A -->
| id | Must hold | Expression | Value |
|---|---|---|---|
| A1 | stat at level 1 | `12 + 1 × (0 ÷ 7)` | 12 |
| A2 | stat at the level cap, no gear | `12 + 1 × (675 ÷ 7)` | 108 |
| A3 | single-stat ceiling | `108 + 25×13` | **433** |
| A4 | two-stat split ceiling | `6 items + 6 items` = `108 + 25×6` | 271 / 271 |
| A5 | no % term reinstated | `(108 + 25×13) × 1.0` | 433 → **never revert to this** because all K values are set on 433 |
| A6 | item count origin | 13 worn slots (12 + main hand) · from equipment-slot.md | 13 |

Source: `node tools/check.ts` · stat line = `stat_c = 12 + 1 × (points ÷ 7)` (formula.md) · the Flat maximum from mod-pool.md (Stat Mod flat 25 · Stat Mod % is retired, so A3 is a flat-only sum) · slot count from equipment-slot.md.

<!-- END GENERATED:group-A -->

# B · Derived Stat Ceilings (At 510 + One Slot From Main Hand)

<!-- BEGIN GENERATED:group-B -->
| id | Value | Expression | Result |
|---|---|---|---|
| B1 | Physical / Magic power | `(433×5 + 80) × 1.16` | **2,607** |
| B2 | Max HP (Vit build) | `(433×20 + 7,560) × 1.16` | 19,173 |
| B3 | Max Mana | `433×4 + 3,024` | 4,858 |
| B4 | Mana regen | `433×0.28` | 121/sec |
| B5 | **pool ÷ regen** | `4,858 ÷ 121.4` | **40.0 sec** (intent = 40) |
| B6 | Crit chance (no Flat) | `433×0.05 + 8% Mod` | 29.7% |
| B6b | Crit chance Cap → overflow | `min(29.7, 100)` | 29.7% chance · overflow 0.0% → crit damage 220% |
| B7 | Elem res · no Core stat | `gear only (owner ruling) — no K row feeds it` | 0.0% raw |
| B8 | Elem res from 3 Mod items | `30×3 (all gear)` | 90.0 (Cap 75) |
| B9 | Alignment raw | `433×0.05` | 21.7% |
| B10 | CDR raw | `433×0.03` | 13.0% |
| B11 | CDR + 4 Mod + BO | `13.0 × (1 + 25×11 + 0)%` | 48.8 (hard ceiling 80) |
| B12 | Accuracy | `433×1.5×1.25` | 813 |
| B13 | Weight capacity | `1,000 + 433×2` | 1,867 |
| B14 | Drop multiplier | `1 + 433×0.01` | 5.33x |
| B15 | Energy Shield pool (gear) | `60 × (1 + 16/100)` | **70** · 0.7% of a caster build's 10,029 HP |
| B16 | ES regen · full recovery | `3% of the pool per sec · after 3 sec without a hit` | 2.1/sec → **33.3 sec** for the whole pool from the base rate · an `es_regen` skill, Mod or passive amplifies the rate (X25) |

Every row is the single-stat ceiling (433) plus the one Mod slot that can roll that line (mod-pool.md maxima · equipment-slot.md slot rules).
B5 is the row K_INT_MREGEN was retuned for: 40.0 sec against the 40 sec intent (tolerance ±1 sec).

<!-- END GENERATED:group-B -->

# C · Every Cap Must Be Reachable

<!-- BEGIN GENERATED:group-C -->
| id | Cap | Reachable path | Value at that point |
|---|---|---|---|
| C1 | Evasion 80% | Dex rating ÷ (rating + that mob's accuracy), then + Agi ÷ 30 points, capped together · the same opposed shape the mob side dodges with (X20) | **reachable** ✓ |
| C2 | (compare) Dex 271 + 1 Flat item vs the floor lineage | rating = 271×0.5 + 30 = 165, + Agi 271 ÷ 30 | 80.0% vs Slime · does not hit Cap ✓ |
| C3 | aspd 500 | sword 1.2 + 25% Mod → Agi = 1,179 | **1,179** (ceiling 433) ✓ |
| C4 | aspd 500 | dagger 1.5 + 25% Mod | 845 ✓ · staff/2h unreachable by intent |
| C5 | Perfect dodge 21 | ratio: Lck 433 × 0.03 = rate 13.0 ÷ (rate + 57) = 18.6% · the Cap binds first · reached at Lck 506 | **21%** at the Cap · reachable at Lck 506 (under the 433 ceiling) ✓ |
| C6 | Alignment null · hard ceiling | Dex 433 (21.7) + amulet + gloves (+5 +5) | 31.7 — the build tops out under the Cap  |
| C7 | Elem res 75 · binding Cap | 3 res items at the max roll · gear only, no Core stat | 90.0 — the build reaches past the Cap, so it **binds**  |
| C8 | CDR 80 · hard ceiling | Wis 433 + 11 CDR items + BO | 48.8 — the build tops out under the Cap  |
| C9 | Crit (no Cap) | Lck 433 + 8% Mod + buff | 29.7% from stats alone · anything over 100 becomes crit damage (B6b) ✓ |
| C10 | stun null | Alignment reach 31.7 × 0.3 = 9.5 + the mace's Chance to stun % line | null ✓ via the mace Base Mod, the only source past the Alignment reach  |
| C11 | Accuracy | no Cap · `acc/(acc+E)` forbids 100% itself | 813 → 94.3% ✓ |

H3 rule: every Cap states whether it is a build target or a hard ceiling. A build-target Cap must bind (the build reaches it); a hard-ceiling Cap must not (the build tops out under it) — `alignment`, `elem_res` and `cdr` are hard ceilings, and evasion was closed by putting it on the opposed form the mob side already uses, so X20 can prove it both ways.
Agi-per-Cap rows are the same line as formula-utility.md section 7: `${E.caps.aspd} ÷ weapon_aspd` minus the 100 baseline and the 25% Mod, divided by ${K.K_AGI_ASPD} per Agi, plus the level-1 Base of 12.

<!-- END GENERATED:group-C -->

# D · Combat Promises

| id | Must hold | Value |
|---|---|---|
| D1 | `mob_HP(L) = typical_gear_DPS(L) x (1 + 0.0034 L)` - the skill list is the only power multiplier that folds into this line (H1) · the passive tree **exists and has no effect on this line** (owner ruling: it is never folded in), so nothing else multiplies here · the curve is anchored at every zone edge and interpolated inside the zone, so every level 1-180 has an HP (**X37**) | L1 120 · L10 629 · L30 1,824 · L60 5,293 · L90 10,709 · L180 **25,741 (highest level a mob can spawn)** · L190 27,704 *(theoretical - the spawn cap is 180)* · zone edges in `world.md` · per-entry numbers in `mob-roster.md` |
| D2 | `mob_PS = typical_gear_DPS ÷ 27` (**not** `mob_HP ÷ 27`) | L30 61 · L60 163 · L90 304 · L180 **591 (highest a mob can spawn)** · L190 623 *(theoretical)* · elite ×4 · boss ×18 (re-derived by SV6) |
| D3 | TTK of on-level players | **5.11 sec** at the level-100 anchor — the reference build's own clear time; the retired 1.00 sec was the all-stats-390 character the curve was first priced against |
| D4 | TTK on-level gear + skill list | `12,144 ÷ (1,775 × 1.34)` = **5.11 sec** — the reference build is the even split (points ÷ 7, the 13 items following the allocation, sword, no tree) · the **focused** build (every point and every item in one stat, `FOCUSED_CEIL`) clears the same mob in **0.22 sec**, so the split is the published row and the focus is what lands on the old pacing |
| D5 | TTK T1 gear *without* skill (fresh zone entrant) | `12,144 ÷ 1,775` = **6.84 sec** — the reference build's raw clear time; mob_HP is priced for a player who already holds the list |
| D6 | groups of 5 Push no build at matching level | the generated `survival-group` block in `combat.md` §6 (no build is Pushed at L100) · **single condition is the "max 3 engage at once" rule (world.md · D13)** · `node tools/survival.ts` |
| D7 | on-level boss (×15 HP / **×18 damage**) at the level cap without heal | printed live in the `survival-boss` block of `combat.md` §6 — every build is Pushed, no theme clears it standing still · `SV6` |
| D8 | heal = Greater Heal 60% + Heal 10%/sec × 8 sec (80%) → pool **×2.40** (`engine.json` `build.heal_pool_mult`) | one round turns the §6 boss Pushes into passes for the two themes that spend their items on surviving (`mix` · `tank`), while the glass and Evasion themes stay Pushed even with heal · the boss is a press-to-play gate, not a damage gate · `SV6` names the pair |
| D12 | elite (×6 HP / ×4 damage) is a mini-boss, not a group · generated by `tools/survival.ts` (block `survival-elite`), no longer hand-typed |
| D13 | "max 3 mobs engage" rule props the AFK promise | if removed, 5 attackers replace 3 and the group cost scales by roughly 5/3; the measured cost under the rule is the generated `survival-group` block |
| D14 | boss must gate active play as G5 promises — **run from `tools/survival.ts`, gated by SV6** | the boss damage multiplier is forced by the promise, not freely chosen: it must Push all four builds without heal and let exactly the two surviving themes pass with one heal round — SV6/SV7 assert *which* themes pass, not just how many. The value that does both is **×18** (`engine.json` `mob.sizes` boss `ps`); it was ×16 before the re-base moved the build lines |
| D18 | roster passes mechanic gate — **PASSES via `node tools/skills.ts --checks`** | every Element has an attack skill · every weapon group has at least 4 · buff is a timed self-buff (10 sec on / 15 sec cd) · no skill references mob armour or mob mana · the live per-type counts are the generated block in `skill-pool.md`, never typed here · **skill share columns are stale under reservation and need a rerun** |
| D22 | **armour is one Str line on both sides** — every number in this row is printed by `node tools/check.ts --checks` (**X22**) | `K_ARMOUR` · reduction `armour ÷ (armour + K_armour_divisor × raw physical)` · no Cap. Guard: **X22** holds the full-Str cut of a zone-9 boss's *physical half* inside its design band, requires armour to keep answering trash mobs, and forbids any mob's own armour walling a max physical hit. The band's trash floor has moved three times for a stated reason: down when boss damage was raised for the G5 gate — a PoE ratio cuts less of a bigger hit — again when Core Stat % retired, because the armour line is Str-driven and the boss's physical half is anchored on mob DPS, which did not move, and again with the re-base (ceiling 535 → 433) |
| D23 | **the mob roster is complete** — generated by `mobRoster()` and checked by **X23** · `mob-roster.md` is the output | 22 species × 4 body classes (Small · Medium · Large · Boss) over the 18 zones, three sub-zones each, plus Elite and one named boss per zone. Guard: at least 5 entries per zone, the boss species must actually live in its zone, and a species may not bias an Element none of its zones carry |
| D26 | **Energy Shield is a timed second pool, player-only** — printed by **X25** | `energy_shield_flat` · `max_energy_shield_pct` · `energy_shield.delay_sec` (3) · full pool in `energy_shield.recover_sec` (40) · guard: **X25** holds a real pool, the exact clock, and player-only (H1); the share (0.7% of the level-only caster HP from one max item, higher summed across items) is reported, not gated, until a rebalance re-prices the gear range |
| D24 | **a mob dodges the way we do** — generated and checked by **X24** | `dodge = own Agi rate ÷ (own rate + attacker accuracy)` · guard: every roster entry between 2% and 40%, so mob Agi stays flavour and never a second wall. The old 25% ceiling was set on the level-scaled mob line; the flat mob stat makes a low-level attacker's accuracy the small number, so the band was re-based with the rule unchanged |
| D30 | **Ascend is priced by the engine at the hour the design sells** — **X30** | 8 Add mod stones + 8 Reroll tier stones per Ascend, so Add stones bind and a full 12-piece set costs the 96 Add + 96 Reroll tier stones the ladder promises (F10 · E7) |
| D31 | **body class may not move the funnel** — **X32** | `mob_HP(L)` is the zone average; group entries divide by the zone's weighted body factor (spawn weights Small 3 · Medium 2 · Large 1), so kills/hour, drops/hour and the timeline hold by construction |
| D32 | **the species damage tag is a rule** — **X31** | physical = the whole armour-able half, magic = the whole res-able half, mixed = 50/50 by innate Element |
| D33 | **near and far is a queue, not a map** — **X33** | reach bands (melee 1 · reach 2 · stand-off 3) over a front-line-first queue; the cost to a reach-1 build is measured and must stay under 12% of the cycle |
| D34 | **the seven buffs and the Haste aura are folded by measurement, not by a new multiplier** — closed | Warcry / Berserker / Iron Will / Holy veil / Ghost Dance / Magia Drive / Energy Absorb are timed self-buffs the player spends a slot on; `Haste` is an aura that reserves 25% and multiplies cooldowns (post-Cap) and final aspd by ×1.15. The uplift to price is the expected value across each uptime: physical x1.15 + align/res x1.20 (Warcry), aspd x1.20 + leech + damage taken x1.15 (Berserker), Armour x1.20 + damage taken x0.90 (Iron Will), debuff immunity (Holy veil), N deleted hits (Ghost Dance), continuous ES refill (Magia Drive), a share of every hit negated and banked as Energy Shield (Energy Absorb), and the clock itself (Haste). `checks.md` H1 forbids landing them unfolded — and they no longer are: `game/tests/gearedB1.test.ts` runs the whole bar, these rows included, against the same geared character with nothing slotted, so their share is inside the measured list multiplier rather than added to it by hand. ** extends this debt to four more sources**: the block layer, armour penetration, chance to bleed and chance to stun arrive with the item skeleton's Base Mod line, and they are folded the same way — by measurement on the gear the loop actually produced, never by moving `mob_HP`. ** extends it once more**: the three caps raised to 75 / 50 / 80 as hard ceilings and the Energy Shield delay cut 5→3 sec are player power the build now keeps (res 48.45 / align 35.5 / cdr 57.375, a sooner refill), priced the same way — never by moving `mob_HP`. ** extends it again**: `All stats flat` is a second Stat Mod line that lifts all seven Core stats at once, so the flat-only 510 ceiling must absorb it — booked here and folded by the same geared measurement, never by moving `mob_HP` |
| D35 | **a mob skill re-times damage and never adds it — bounded by the pool, gated by SV8** | `combat.md` §5b prices a mob skill as a re-timing of that mob's own `mob_PS`. No skill list exists yet to name a window, so the cage bounds the window instead of guessing one: every AFK-reachable shape must absorb at least two seconds of its own priced damage before the pool empties, which is what stops "burst then gap" from becoming a one-hit kill. SV8 prints the measured margin per build and kind |
| D36 | **the Upgrade ladder's value is published and bounded — X42 and SV7** | one +1 adds `craft.gear_mod_per_level`, and the full ladder lands exactly on the smallest of the three school ceilings in `mod_max` (`item-base.md` says which school a Base raises), so no upgraded piece out-prints a T1 rolled line. The uplift is paid for at the encounter — SV7 re-runs the level-cap boss against a full set and the G5 promise still holds — so `mob_HP` does not move (H1) |
| D20 | skill income must feed the ladder — **generated by `node tools/ladder.ts --checks`** | the generated `ladder-math` block in `skill-pool-system.md` prints the funnel, the per-target split and the zone pool; never typed here |
| D9 | Push downtime `MaxHP ÷ (regen×8)` — generated by `node tools/survival.ts` (block `push-table`) | glass 44 sec · tank 32 sec |
| D10 | all weapons equal DPS **against the Medium reference body** | `weapon_mult = 1.2 ÷ weapon_aspd` · `weapon_aspd` cancels out of `power × times/sec`, so all 11 types land on the same Expected DPS at equal stats ✓ (**X14**) · adds the weapon × body-class ladder on top, which is flat on Medium for every type except the dagger (0.90), and the sword is flat on all three |
| D11 | AoE is a real choice, not free (**closed** · skill-pool.md AoE section) | new rule 60% per target · Cap 3 targets · mana ×1.5 → damage per mana = 0.40x (1 target) / 0.80x (2) / **1.20x (3+)** · groups of 5 faster by 1.20x (3.75 sec instead of 4.50) but bosses 2.5x longer = 312% of pool = Push · the AoE table is generated (`skill-pool-system.md`, block `aoe-rules`) |

# E · Progression (All From D1 + Kill Rates)

Every row is a **state**, never a duration: this is an open-world idle RPG with no time limit and no play-length target (owner ruling · `AGENT.md`), so a checkpoint is a level, a kill count, or a count of craft actions. How long any of it takes is the player's own pace, so nothing here — and nothing that reads it — may state a time to finish.

| id | Checkpoint | Reached at |
|---|---|---|
| E1 | Level 10 | 242 kills |
| E2 | Level 30 (end zone 3) | 1,777 kills |
| E3 | Level 60 (end zone 6) | 9,843 kills |
| E4 | Level 90 (end zone 9) | 36,356 kills |
| E5 | Level 100 (the completion checkpoint) | **60,031 kills** |
| E6 | Full-set Refine (2 steps per piece · Tier is per item) | 24 casts · 192 Reroll tier stones |
| E7 | Full-set Ascend (12 items) | 96 Add + 96 Reroll tier stones |
| E8 | Full-set polish with Reroll | 100 casts · 800 Reroll value stones |
| E9 | Mastery 1 type to L10 / to L20 | kill-based, tied to the XP curve (equipment-weapon.md) |
| E10 | Mastery 11 types to L10 | kill-based = +11% permanent drop |
| E11 | skill ladder — **generated by `node tools/ladder.ts --checks`** (block `ladder-math` in `skill-pool-system.md`) | the generated block prints the funnel, the 4-target share, the per-skill average and the zone pool; never typed here |
| E12 | Power magnitude order | gear x5.6 - skill x1.1-1.4 - there is no third multiplier between them |

# F · Loot Engine (High Zone = L90)

<!-- BEGIN GENERATED:group-F -->
| id | Value | Expression |
|---|---|---|
| F1 | kills per clear cycle | `the group a cycle spawns` = 1.5 low · 2.5 mid · 4 high |
| F2 | drops per kill | `8% × (1 + Lck×0.01)` = 10.6% (L30) · 12.3% (L60) · 14.0% (L90) · 42.7% (full Lck 433) |
| F3 | drops per clear cycle | `F1 × F2` = 0.16 low · 0.31 mid · 0.56 high |
| F4 | upgrades per drop | `measured — tools/loot.ts, the seven roll steps in loot.md section 1` = first 1/14 of drops 21.8 → 2/14-4/14 9.6 → after that 6.0 (low band) · keep-rate 5.44% low · 3.88% mid · 2.95% high · 1.03% high + full_lck |
| F5 | junk per kill (gold) | `(drops − upgrades) per kill × 1` = **0.1358** |
| F6 | Reroll value uses per kill | `F5 ÷ 8` = **0.0170** |
| F7 | Reroll tier stone per kill | `elite 0.0100 (20% of kills ×0.05) + boss 0.0204 (0.0068 ×3)` = 0.0306 |
| F8 | Refines per kill | `F7 ÷ 8` = **0.0038** |
| F9 | Add mod stone per kill | `elite 0.0013 (20% of kills × 0.625% chance) + boss 0.0068 (0.0068 ×1)` = **0.0080** |
| F10 | Ascend per kill | `min(F9 ÷ 8 Add, F7 ÷ 8 tier) — the scarcer stone sets the pace` = **0.0010** · full 12-piece set **11,957 kills** (Add alone 1,473 kills · tier stones alone 6,302 kills → tier stones bind) |
| F13 | herb bundles per kill | `separate roll · a bundle of 1-3 zone-tier herbs` = mid band **0.02** · high band **0.03** |
| F16 | Refine full set | `12 pieces × 1 slots × 2 steps = 24 casts` = **24 casts** · 192 Reroll tier stones (checks.md E6) |
| F17 | Full-set polish | `100 casts at 8 stones` = **100 casts** · 800 Reroll value stones (checks.md E8) |
| F18 | gold per kill, the price unit | `F5, the junk line` = 0.0994 low · 0.1173 mid · 0.1358 high · 0.4228 full Lck (towns-stalls.md §1) |
| F19 | full-Lck income ceiling over the no-Lck line | `0.4228 ÷ 0.1358` = **×3.11** — the only place Lck may multiply income (G8) |
| F20 | Quality Stone per kill | `monster 0.0100 (1% of kills) + elite 0.0500 (1 in 5 × 25%) + boss 0.1630 (0.0068 ×24)` = **0.2230** |
| F21 | Upgrade full set | `1 + 2 + 3 + 4 + 5 + 7 + 9 + 11 + 13 + 15 + 18 + 21 + 24 + 27 + 30 = 190 per piece × 12 pieces = 2280 stones ÷ F20` = **10,225 kills** for a full +15 set · the steps 11-15 third alone, hunted only from bosses, is **8,835 kills** (crafting.md "sources shift monsters → elites → bosses by step") |
| F22 | Repair and Corrupt stone per kill | `Repair: elite 0.0100 (1 in 5 × 5%) + boss 0.0068 · Corrupt: boss 0.0068 × 25% chance` = Repair **0.0168** · Corrupt **0.0017** — the rarest stone, so one gamble per piece costs about 589 kills and a full 12-piece set of gambles is 7,068 kills (crafting.md §Corrupt) |
| F11 | 0.22 Flat lines per high-zone drop (5.00 lines per item) · the four early-game Flats thin out as Item quality rises | Flat line per drop (high zone, after the 0.25 early-game weighting) · status **measured** |
| F12 | boss 2.4 + elite 16.0 + normal 0.8 = 19.2 per 1,000 kills | skill per 1,000 kills · skill-pool.md drop chances · status **carried** |
| F14 | max 3 uses per fight · 30 sec shared cooldown · suppressed on bosses | potion sustain bound · status **rule** |
| F15 | 1 Reroll tier stone per 500 salvages (~+2.7% of F7) | salvage milestone bound · status **rule** |

Derived from: group spawn 4 sec · 5.107 sec TTK per mob (checks.md D1-D3) · Lck read at the band's top level (stat_c = 12 + 1×(points ÷ 7)) · Base drop 8% (formula-utility.md section 10) · prices 8/8 stones (crafting.md).
F4 · F11 are **simulation output** (loot.md section 3) and F13 is unset — this cage does not invent it, it only refuses to let a derived row drift.

<!-- END GENERATED:group-F -->

# G · Economy Rules That Must Hold

| id | Rule |
|---|---|
| G1 | No gold↔stone exchange · gold-priced convenience stalls in settlements only (towns.md section 5) · no buying/selling/trading between players · all crafting media are the 7 stones |
| G2 | Filter-rejected gear = 1 Reroll value stone (dissolve) — but only while a slot is armed, since the filter ships off and an off slot keeps every drop; gold is minted separately by mob junk, so no piece pays both media |
| G3 | Ascend is not capped by zone ceiling · cost is boss cores only |
| G4 | Reroll must never roll lower than before |
| G5 | boss 15 min each · AFK cannot kill bosses → second half of crafting is active |
| G6 | Gold has exactly two mints: **mob junk sold at the Counterhand** (loot.md section 4) · Road events, bounded by G9. Task payouts stay stones, Collector pays the item · no source pays both media |
| G7 | Gold never buys power: no gear, no Mods, no potions, no stones, no `mob_HP`-relevant service (towns.md section 0 · H1) |
| G8 | Gold income ceiling = the junk line (mob junk sold): ~79/hour high zone (F3-F5), ~249/hour at full Lck · legal only while G7 holds · an Lck build's gold advantage must never convert into craft advantage |
| G9 | Every Road/travel purchase pays no stones · road event income ≤ the value of an equal hour spent farming (F1/F5) · AFK never runs on a Road (towns.md section 7) |

# T · Town Economy (gold prices · stock · Standing · demand)

Every row is computed by `node tools/town.ts` from `tools/data/town.json`; the tables it writes are in `towns-stalls.md` sections 1-9. The unit is **m = one minute of full-sell income in that band**, so no price here is a feeling about gold. `--checks` exits 1 if a row fails *or* if the doc blocks drifted from the data.

<!-- BEGIN GENERATED:group-T -->
| id | Must hold | Expression | Value |
|---|---|---|---|
| T1 | gold is minted by the sell choice and by nothing else (G2 · G6 · X36) | `1 gold per sold junk piece · walking pays a drop roll, never gold, never Standing, never stones` | 1 |
| T2 | the price unit is gold, and the junk line alone mints it (D12) | `the junk line per kill, per band` | 0.0994 low · 0.1173 mid · 0.1358 high · 0.4228 high+full Lck gold per kill |
| T3 | lifetime gold supply is the junk line, not a new faucet | `1,777×0.0994 + 8,066×0.1173 + 50,188×0.1358` | 7,940 gold |
| T4 | one-time stall demand ≤ 1.50× the supply — a funnel, not a wall | `Σ 16 one-time lines at their charge band` | 3,654 = 0.46× ✓ |
| T5 | essentials ≤ 20% of the supply while ~80%+ still dissolves | `tab 1 at Eastgate · tab 2 · pouch II · deed 4` | 405 = 5.1% ✓ |
| T6 | selling everything is a craft decision, priced in craft | `7,940 ÷ 8 stones · ÷ 100 casts per full polish` | 993 Reroll casts ≈ 9.9 full-set polishes forgone |
| T7 | the full-Lck advantage stops at the junk line (G8) | `50,188 high-band kills × 0 vs × 0` | 21,217 vs 6,817 gold = ×3.11 against the ×3.11 ceiling ✓ |
| T8 | every stall line is space · time · information · appearance only (G7) | `kind tag on all 24 lines · power nouns need an explicit display_only flag` | 24 lines, 0 power lines ✓ |
| T9 | travel never gates content and never beats farming (G9) | `10s a block · 16.6667% an encounter per block · a Waypoint unlocks on foot and warps free` | 0 gold to travel ✓ |
| T10 | Armourer repair costs more than the elite income it replaces (D2 service class) | `6 tier stones per kill → 13.00 gold floor · F9 re-checked in T10b` | 21 gold · 18 gold at Ironrow ✓ |
| T11 | skip tokens stay inside the tasks.md bound | `3/day at the high band` | 31 gold/day ✓ (payouts untouched) |
| T12 | Standing has 3 tiers per settlement and is counted from the band's kill stream | `budget kills × tier share` | see table T-S below, 27 thresholds ✓ |
| T13 | Tier III is a chase, never a formality | `tier III share ≥ 1 × the zone budget` | 1.4 on all 9 ✓ |
| T14 | Collector sets pay items, never gold (G6) | `pays_gold flag on 3 sets` | 0 gold ✓ |
| T15 | Base bias is permanent flavour — ruled even-weighted, so it may never carry a number | `loot.md section 1 step 2 + section 3` | status = decided · 3 guards · 0 numeric weights |
| T16 | price ladders are monotonic, so no later tier is cheaper | `stash_tab 78-390 gold · herb_pouch 66-312 gold · plot_deed 198-702 gold · house 96-468 gold` | ✓ |
| T17 | this file owns no income rate: the junk line is loot.md unchanged | `no rate is retyped here — the band junk line is read from loot.md` | mob_HP and the published loot line unmoved ✓ (H1) |
| T18 | no band number is retyped here — town prices scale the engine junk line | `tools/lib/engine.ts (engine.json) → the band junk line, then loot.md section 2 read back` | 17 loot.md numbers read back equal ✓ |

## T-S · Standing thresholds in kills (the numbers T12 reads)

| id | Settlement | Band | Budget kills | Tier I kills | Tier II kills | Tier III kills |
|---|---|---|---|---|---|---|
| eastgate | Eastgate | low | 242 | 73 | 182 | 339 |
| highspire | Highspire | low | 584 | 175 | 438 | 818 |
| wolf_cross | Wolf Cross | low | 951 | 285 | 713 | 1,331 |
| greyfen | Greyfen | mid | 1,644 | 493 | 1,233 | 2,302 |
| saltmarrow | Saltmarrow | mid | 2,570 | 771 | 1,928 | 3,598 |
| the_pale_spire | The Pale Spire | mid | 3,852 | 1,156 | 2,889 | 5,393 |
| blackwater_reach | Blackwater Reach | high | 5,778 | 1,733 | 4,334 | 8,089 |
| bonegate | Bonegate | high | 8,797 | 2,639 | 6,598 | 12,316 |
| frosthold | Frosthold | high | 11,939 | 3,582 | 8,954 | 16,715 |
| vermolch | Vermolch | low | 23,674 | 7,102 | 17,756 | 33,144 |
| duskmoor | Duskmoor | low | 11,373 | 3,412 | 8,530 | 15,922 |
| nettlecrag | Nettlecrag | low | 10,379 | 3,114 | 7,784 | 14,531 |
| emberhold | Emberhold | mid | 9,544 | 2,863 | 7,158 | 13,362 |
| millbrook | Millbrook | mid | 8,834 | 2,650 | 6,626 | 12,368 |
| wyrmback | Wyrmback | mid | 8,222 | 2,467 | 6,167 | 11,511 |
| ashfall | Ashfall | high | 7,689 | 2,307 | 5,767 | 10,765 |
| ironrow | Ironrow | high | 7,222 | 2,167 | 5,417 | 10,111 |
| thornwake | Thornwake | high | 13,405 | 4,022 | 10,054 | 18,767 |

Source: `node tools/town.ts --checks` · data in `tools/data/town.json` · prices, stock and ladders in `towns-stalls.md`.

<!-- END GENERATED:group-T -->

# H · Permanent Invariants

1. **Power-granting systems must fold into `mob_HP` immediately** (D1) · otherwise F1-F3 and craft prices drift silently · the retired tree did this (+85% → ×1.85). **The current passive tree is the standing exception** (owner ruling): it stays outside the curve, so its ranks are never booked into `mob_HP` and the published rates are the empty-tree baseline, permanently.
2. **Mastery must not grant per-weapon-type DPS** (D10) · bonus = weight + skill damage for held weapon only + account-wide drop_rate.
3. **New Caps must show "reachable?"** (group C) · unreachable Caps are fake numbers.
4. **Never give two axes the same meaning**: Rarity = Mod count · Base = weight+emphasis · Item quality/Tier = value · never swap terms (glossary).
5. **Flat and % of the same stat may sit on the same item** (A3) · reverting this requires rebuilding all K values and anchor tables.
6. **Numbers in docs are outputs of Mod tables**, not inputs · after changing tables, rerun A-G · the real cage is `node tools/check.ts`.
7. **Mob HP and damage lines are different lines** - `mob_HP = typical DPS x skill multiplier x 1 sec` sets how long a mob lives; `mob_PS = typical DPS / 27` sets how hard it hits. The skill factor cancels out of the damage line, so mobs lose HP when the skill list grows but keep the same damage.
8. **Field multipliers must check against "promises" in other files, not float free** — rules announced in one place (G5 "AFK cannot kill bosses" · H2 "Mastery must not grant DPS" · item 1 "1 sec TTK") frame what numbers may sit inside · boss ×3 once violated G5 unnoticed until the §6-§7 model ran · every time a multiplier is set/changed, write it as a row in group D and let `tools/check.ts` + `tools/survival.ts` judge.
9. **Retired - the tree power budget is gone** - the 85% passive ceiling left with `skill-tree.md`, and nothing may reintroduce a hidden multiplier |

# I · Not Yet Checked (Not Numbers · Blocked On Decisions)

| Topic | Numbers forcing the decision |
|---|---|
| Pure-Evasion beats no boss | the `survival-boss` block keeps the evasion build Pushed even with heal, alongside the glass build (SV6) · the fix is splitting items to Vit · the question left is what a "full evasion" build must pay · links to fast hit |
| skill ladder | E11 |
| Towns · travel · NPC stalls | **doors chosen** (towns.md section 9) · **prices chosen**: every gold line, both ladders, the 9 rosters, stock and the 27 Standing kill thresholds are generated in group T + `towns-stalls.md` · Base bias is **ruled even-weighted** (T15 permanent flavour, A9) and Collector sets are **finishable without the filter** (a rule, not a number) · the F9/F13 lines the repair floor and the pouch ladder depend on are **measured, not owed** (`towns-stalls.md` section 9 prints them and T10/T10b prove the floors against them) |
