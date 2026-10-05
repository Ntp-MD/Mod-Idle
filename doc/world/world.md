# World

import glossary.md
import formula.md
import item-rarity.md
import elements.md
import combat.md
import mob-roster.md

**Spec complete** — the zone table, mob curve, XP table and mob sheet are generated from `tools/data/engine.json`; edit the data, not the tables.

# Level

| Level range | Dropped Item quality |
|---|---|
| 1-30 | low |
| 31-60 | mid |
| 61-90 | high |

- Item level = level of dropping mob.
- Level ranges currently match Item quality 1:1 because there is still no drop source outside levels.
  If kept this way, the Item quality axis duplicates levels. Be careful (see item-rarity.md).

# Zones and Levels (Decided)

**9 zones · 10 levels per zone · 1 boss per zone.**

<!-- BEGIN GENERATED:zone-table -->
| Zone | Settlement · Levels | Dropped Quality ceiling | mob HP (zone edge) | innate Elements | Mobs per group | Boss | roster entries |
|---|---|---|---|---|---|---|---|
| 1 | Eastgate · 1-10 | low | 120 → 629 | fire | 1-2 | Eastgate Emberling (Husk) | 10 |
| 2 | Millbrook · 11-20 | low | 730 → 1,305 | poison | 1-2 | Millbrook Tallyman (Goblin) | 16 |
| 3 | Ashfall · 21-30 | low | 1,436 → 1,824 | fire | 1-2 | Ashfall Chieftain (Rat) | 9 |
| 4 | Ironrow · 31-40 | mid (floor = low) | 3,546 → 4,033 | lightning | 2-3 | Ironrow Warden (Bandit) | 11 |
| 5 | Wolf Cross · 41-50 | mid | 4,090 → 4,632 | cold | 2-3 | The Bloated Shepherd (Slime) | 15 |
| 6 | Highspire · 51-60 | mid | 4,696 → 5,293 | cold · lightning | 2-3 | Highspire Herald (Troll) | 16 |
| 7 | Bonegate · 61-70 | high (floor = mid) | 7,739 → 8,587 | chaos | 3-5 | Bonegate Tyrant (Orc) | 17 |
| 8 | Frosthold · 71-80 | high | 8,685 → 9,605 | cold | 3-5 | Frosthold Siege-Marshal (Knight) | 13 |
| 9 | Vermolch · 81-90 | high | 9,712 → 10,709 | poison · chaos | 3-5 | Vermolch Ninefold Choir (Seraph) | 13 |
| 10 | Thornwake · 91-100 | low | 10,850 → 12,144 | poison | 1-2 | The Rootcoil (Drake) | 17 |
| 11 | Greyfen · 101-110 | low | 12,291 → 13,639 | poison · chaos | 1-2 | Greyfen Broodmother (Demon) | 17 |
| 12 | Saltmarrow · 111-120 | low | 13,791 → 15,191 | chaos | 1-2 | The Salt Tyrant (Elf) | 17 |
| 13 | Emberhold · 121-130 | mid (floor = low) | 15,350 → 16,803 | fire | 2-3 | Emberhold Slagheart (Goblin) | 7 |
| 14 | Duskmoor · 131-140 | mid (floor = low) | 16,967 → 18,473 | cold · chaos | 2-3 | Duskmoor Stalkers (Wolf) | 11 |
| 15 | Nettlecrag · 141-150 | mid (floor = low) | 18,643 → 20,202 | chaos · poison | 2-3 | The Nettle Hag (Demon) | 14 |
| 16 | Blackwater Reach · 151-160 | high (floor = mid) | 20,378 → 21,989 | poison | 3-5 | The Drowned Choir (Husk) | 16 |
| 17 | Wyrmback · 161-170 | high (floor = mid) | 22,171 → 23,836 | fire · cold | 3-5 | Wyrmback Sovereign (Drake) | 12 |
| 18 | The Pale Spire · 171-180 | high (floor = mid) | 24,024 → 25,741 | chaos · poison | 3-5 | Pale Spire Silence (Seraph) | 15 |

HP columns are `mob_HP(L)` at the zone's first and last level (checks.md D1) · the boss row is the zone's own `mob_HP × 15 / damage × 4` carrier species (combat.md section 7). `mob-roster.md` expands every one of these into the per-species, per-body entries a build reads from.
<!-- END GENERATED:zone-table -->

## Properties Per Zone

| Property | Value |
|---|---|
| Zone level · group size · Quality ceiling · innate Elements · boss | the generated table above — one row per zone, no second home |
| Elite spawn chance | **1 in 5 kills** (`engine.json` `loot.elite_spawn_chance`) · always single · each drops a Reroll tier stone **5%** of the time · the main tier-stone source (loot.md section 5) |
| Boss spawn chance | **1 per 15 min per character** (4/hour) · only attackable while online |
| New group spawn time | 4 sec after clearing the previous group · constant across zones |
| Species per zone | every legal zone × species × body entry is listed with its numbers in `mob-roster.md` · **X23** fails a zone with fewer than 5 entries or a boss that does not live there |

- **Zone unlock by level, not by boss** · zone i boss spawns when player level ≥ that zone, and grants *Quality ceiling* + craft currency + skill (concept.md).
- **Dropped Quality ceiling in zone i unlocks after beating zone i−1 boss** (zone 1 unlocked immediately) · reason: granting full ceiling on zone entry removes the need to fight bosses · and making bosses a hard progress gate would permanently wall builds that lose to bosses.
- **Losing to a boss = losing that spawn** (boss retreats, full HP, must wait for next 15 min cycle) · full rules + which build wins at which zone in combat.md section 7.
- **Levels 91-100 have no new zone and nothing new to unlock** · they are more of the same zone-9 band (as stated in concept.md and formula.md section 0).

# Full Game Timeline (All Numbers Calculated From loot.md Kill Rates + crafting.md Crafting + Mastery)

| Point | Cumulative time |
|---|---|
| Level 10 | 0.5 hr |
| Level 30 | 3.1 hr |
| Level 60 | 12.6 hr |
| **Level 90 (zone end)** | **31.2 hr** |
| Level 100 | 40.2 hr |
| Finished crafted set (24 Refine + 12 Ascend pieces) | ~22 hr of crafting, overlapping the last zones (Refine 6.4 hr + Ascend 15.4 hr · E6 · E7) |
| Mastery 11 types to L10 (+11% drop) | 12.4 hr |
| Mastery 11 types to L20 | 55 hr |

<!-- BEGIN GENERATED:xp-formula -->
```
xp per kill   = 10 × mob level (normal) · ×3 elite · ×15 boss
xp to next level     = 5-level-step table (generated below from the kills anchors)
kills per level       = 20 (L1) · 101 (L10) · 251 (L30) · 713 (L50) · 2,121 (L90) · 2,498 (L100) · 2,896 (L110) · 3,315 (L120) · 4,212 (L140) · 5,183 (L160) · 6,223 (L180) · 6,768 (L190)
```
<!-- END GENERATED:xp-formula -->
- **The elite and boss multipliers are paid in the model.** One kill in five rolls elite (×3 XP) and the boss clock adds ×15 at 4/hr, so the average kill is worth ~1.44× a plain mob; the kills-per-level anchors are scaled to hold the published E1-E5 hours. Ignoring them would have finished the game about a third early the moment the elite rate moved from 0.5% to 20%.

**XP per 5-level step** — generated by `node tools/timeline.ts` from `engine.json` `xp` (anchors + band rates); do not hand-type:

<!-- BEGIN GENERATED:xp-table -->
Derived from `xp_to_next(L) = kills(L) × 10 × min(L, 180)` with the kills anchors and band rates in `engine.json`.

| Levels | XP to clear the step | Cumulative XP | Cumulative hr |
|---|---|---|---|
| 1-5 | 6,600 | 6,600 | 0.1 |
| 6-10 | 34,100 | 40,700 | 0.4 |
| 11-15 | 81,025 | 121,725 | 0.9 |
| 16-20 | 145,650 | 267,375 | 1.4 |
| 21-25 | 229,025 | 496,400 | 2.1 |
| 26-30 | 331,150 | 827,550 | 2.9 |
| 31-35 | 530,805 | 1,358,355 | 3.7 |
| 36-40 | 830,330 | 2,188,685 | 4.8 |
| 41-45 | 1,187,605 | 3,376,290 | 6.2 |
| 46-50 | 1,602,630 | 4,978,920 | 7.9 |
| 51-55 | 2,172,810 | 7,151,730 | 9.9 |
| 56-60 | 2,887,860 | 10,039,590 | 12.4 |
| 61-65 | 3,690,910 | 13,730,500 | 14.7 |
| 66-70 | 4,581,960 | 18,312,460 | 17.3 |
| 71-75 | 5,561,010 | 23,873,470 | 20.3 |
| 76-80 | 6,628,060 | 30,501,530 | 23.6 |
| 81-85 | 7,783,110 | 38,284,640 | 27.2 |
| 86-90 | 9,026,160 | 47,310,800 | 31.2 |
| 91-95 | 10,392,335 | 57,703,135 | 35.5 |
| 96-100 | 11,874,510 | 69,577,645 | 40.2 |
| 101-105 | 13,483,590 | 83,061,235 | 45.3 |
| 106-110 | 15,212,540 | 98,273,775 | 50.8 |
| 111-115 | 17,076,795 | 115,350,570 | 56.6 |
| 116-120 | 19,068,270 | 134,418,840 | 62.9 |
| 121-125 | 21,219,218 | 155,638,058 | 69.6 |
| 126-130 | 23,516,805 | 179,154,863 | 76.7 |
| 131-135 | 25,926,518 | 205,081,380 | 84.3 |
| 136-140 | 28,448,355 | 233,529,735 | 92.3 |
| 141-145 | 31,162,053 | 264,691,788 | 100.8 |
| 146-150 | 34,047,815 | 298,739,603 | 109.7 |
| 151-155 | 37,054,953 | 335,794,555 | 119.1 |
| 156-160 | 40,183,465 | 375,978,020 | 129.0 |
| 161-165 | 43,518,050 | 419,496,070 | 139.3 |
| 166-170 | 47,036,800 | 466,532,870 | 150.2 |
| 171-175 | 50,685,550 | 517,218,420 | 161.6 |
| 176-180 | 54,464,300 | 571,682,720 | 173.4 |
| 181-185 | 57,478,500 | 629,161,220 | 185.8 |
| 186-190 | 59,931,000 | 689,092,220 | 198.8 |
<!-- END GENERATED:xp-table -->

- This game **ends at about 40 hours of real play** (AFK counts as half a Quality tier) · at 1 hr/day = about 6 weeks; at 3 hr/day = 2 weeks.
- This number decides the "many zones or deep zones" question: at 40 hr and 9 zones → average 4.5 hr/zone, matching the luck stream measured in loot.md (dry in the first 2-3 hr, rest is crafting) · to add zones, *reduce* craft time per zone, not increase level time.
- **Conflict to decide (from the 40 hr number)**: the 32-duplicate random skill ladder = ~300 hr, 7x longer than the whole game · this 40 hr number is the evidence that it must be fixed (see skill-pool.md open items).

# Mob HP Formula Per Level (Replaces Placeholder Line)

```
mob_HP(L)     = typical_gear_DPS(L) × (1 + 0.0034 × L)   ·   anchored at every zone edge, linear in between
                typical_gear_DPS(L) = mob_HP(L) ÷ (1 + 0.0034 × L)   (read back out, never typed)
item count = min(12, ceil(L/2))   → L1 = 1 item · L24+ full 12   (the gear the curve was priced against)
no tree multiplier      (the passive tree is empty - see skill-tree.md)
skill multiplier   = 1 + 0.0034 × L      → ×1.30 at L90 · ×1.34 at L100 (skill-pool-system.md section "Press per skill")
mob_damage(L)  = typical_gear_DPS(L) / 27 per second  (split by the species damage tag · D-030 · combat.md)

> **Why the damage line is not set from mob_HP** - mob_PS is `typical_gear_DPS / 27`, a fraction of the player's own output, not a share of the mob's HP. `mob_HP` carries only the skill multiplier.
```

<!-- BEGIN GENERATED:mob-curve -->
| Level | 1 | 11 | 21 | 31 | 41 | 51 | 61 | 71 | 81 | 91 | 101 | 111 | 121 | 131 | 141 | 151 | 161 | 171 | 180 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mob HP | 120 | 730 | 1,436 | 3,546 | 4,090 | 4,696 | 7,739 | 8,685 | 9,712 | 10,850 | 12,291 | 13,791 | 15,350 | 16,967 | 18,643 | 20,378 | 22,171 | 24,024 | 25,741 |
| mob damage/sec | 4 | 26 | 50 | 119 | 133 | 148 | 237 | 259 | 282 | 307 | 339 | 371 | 403 | 435 | 467 | 499 | 531 | 563 | 591 |

mob_HP(L) is defined at every level: the curve is anchored at each zone edge in `tools/data/engine.json` `mob.zones` and interpolated linearly inside the zone a mob spawns in. The spawn cap is 180, so the last column is the highest level a mob can spawn at; above it the gear factor is held flat and the theoretical player cap anchor `mob.curve.hp_at_player_level_cap` sits at level 190. mob damage/sec is `typical_gear_DPS(L) ÷ 27`, derived from the same curve rather than typed beside it (**X37**).
<!-- END GENERATED:mob-curve -->

- **TTK = 1 sec for on-level gear players** · full T1 gear kills in 0.9 sec · fresh zone entrants with no gear take 2-6 sec (level 1 = ~2 sec, not 16 sec).
- This line replaces the old text stating "HP is set by level" with no formula · and gives combat.md usable per-level numbers.
- Elite and boss multipliers live in `engine.json` `mob.sizes` + `mob.elite`; combat.md section 6-7 is generated from them by `node tools/survival.ts`.



- One zone should have 1-2 common innate Elements so players have reason to hunt matching res items.
- If one zone has all Elements equally, players must guard all 5 Elements, which is too expensive for a single zone.

# Monsters

## Species and body class

A mob is three independent things: a **species**, a **body class**, and an **innate Element** rolled on spawn. Species and body class come from `tools/data/engine.json` `mob`; innate Element stays a spawn roll, so the three axes never collapse into one. **This table is generated** — edit the data, not this file.

**15 species**, each legal on 1-3 of the three farming bodies (Small · Medium · Large): Goblin is the only lineage legal on all three, and Golem · Troll · Knight are the only Large-only ones. Multiplied over the zones each species is placed in, plus Elite and the nine named bosses, that gives the full spawnable list — every entry with its numbers resolved in **`mob-roster.md`**, which is what a build reads. The entry count and the per-zone spread are printed by **X23**, so no number here needs restating.

<!-- BEGIN GENERATED:mob-sheet -->
| Species | Zones | Damage | accuracy | Body classes | str · agi · vit · dex · int · wis · lck |
|---|---|---|---|---|---|
| Rat | 2 · 3 · 9 · 10 · 11 · 13 | physical | ×0.75 | Small · Medium | 0.84 · 1.46 · 0.73 · 1.15 · 0.63 · 0.84 · 1.36 |
| Husk | 1 · 6 · 9 · 10 · 11 · 16 | physical | ×0.05 | Medium · Large | 1.17 · 0.70 · 1.63 · 0.82 · 0.70 · 1.05 · 0.93 |
| Goblin | 1 · 2 · 3 · 4 · 13 · 16 | physical | ×0.75 | Small · Medium · Large | 1.29 · 1.18 · 0.97 · 0.97 · 0.65 · 0.86 · 1.08 |
| Slime | 1 · 5 · 6 · 8 · 14 · 17 | magic | ×0.05 | Small · Medium | 0.73 · 0.63 · 1.46 · 0.73 · 1.15 · 1.25 · 1.04 |
| Bandit | 3 · 4 · 5 · 8 · 14 · 17 | physical | ×0.75 | Small · Medium | 1.13 · 1.03 · 0.93 · 1.13 · 0.72 · 1.03 · 1.03 |
| Spider | 4 · 5 · 6 · 8 · 14 · 17 | physical | ×0.50 | Small · Medium | 0.72 · 1.34 · 0.82 · 1.24 · 0.82 · 0.93 · 1.13 |
| Wolf | 7 · 9 · 12 · 14 · 15 · 18 | physical | ×1.00 | Small · Medium | 1.13 · 1.34 · 0.93 · 1.03 · 0.62 · 0.93 · 1.03 |
| Orc | 6 · 7 · 11 · 12 · 15 · 18 | physical | ×0.75 | Medium · Large | 1.48 · 1.06 · 1.27 · 0.74 · 0.53 · 0.95 · 0.95 |
| Troll | 6 · 7 · 8 · 12 · 15 · 18 | physical | ×0.50 | Large | 1.38 · 0.85 · 1.48 · 0.74 · 0.64 · 0.95 · 0.95 |
| Elf | 2 · 7 · 10 · 12 · 15 · 16 | mixed | ×1.00 | Medium · Large | 0.86 · 1.15 · 0.77 · 1.25 · 1.05 · 0.96 · 0.96 |
| Demon | 2 · 5 · 7 · 11 · 12 · 15 | mixed | ×0.75 | Medium · Large | 1.17 · 0.97 · 1.07 · 0.87 · 1.17 · 0.87 · 0.87 |
| Golem | 4 · 5 · 8 · 9 · 11 · 18 | physical | ×0.25 | Large | 1.70 · 0.60 · 1.55 · 0.75 · 0.65 · 1.10 · 0.65 |
| Knight | 8 · 10 · 14 · 16 · 17 · 18 | physical | ×0.25 | Large | 1.29 · 0.75 · 1.51 · 0.86 · 0.65 · 1.08 · 0.86 |
| Drake | 2 · 5 · 6 · 10 · 16 · 17 | mixed | ×1.00 | Medium · Large | 1.25 · 0.96 · 1.05 · 0.86 · 1.15 · 0.86 · 0.86 |
| Seraph | 7 · 9 · 10 · 11 · 12 · 18 | magic | ×0.50 | Medium · Large | 0.59 · 0.79 · 0.99 · 1.08 · 1.38 · 1.18 · 0.99 |

| Body class | HP | PS | evasion | Grouping |
|---|---|---|---|---|
| Small | ×0.70 | ×0.70 | ×1.10 | up to 5 |
| Medium | ×1.00 | ×1.00 | ×1.00 | up to 5 |
| Large | ×1.70 | ×1.35 | ×0.90 | alone |
| Boss | ×15.00 | ×16.00 | ×1.00 | alone |
| Elite | ×6.00 | ×4.00 | ×0.90 | alone |
<!-- END GENERATED:mob-sheet -->

- **The player has no class.** Species is a creature lineage (Rat · Husk · Drake), not a job, and nothing about it is available to the player.
- **A species is a multiply vector on the player's own stat block.** Every mob starts from `stat_c` per stat, then the species multiplies it. Check **X19** fails any species whose seven multipliers do not average 1.00, so no species can quietly be stronger overall than `mob_HP` was derived against.
- **`accuracy` is the load-bearing column.** Mob accuracy is the shared `stat_c × K_DEX_ACC` scaled by the species multiplier. Against a ×0.25 species (Husk · Slime · Knight) the Evasion **Cap 80 is reachable**; against a ×1.00 species (Wolf · Elf · Drake) full Dex only reaches the low thirties. That is why no single mob accuracy number could ever close `checks.md` C1 — the species mix does, and Evasion becomes a build that works *against some things*.
- **`element_bias` only tilts the roll** inside the zone's own 1-2 Elements. It never adds an Element, so res still has to be prepared in advance.
- **Four card sizes, copied from Ragnarok** (Small · Medium · Large · Boss). **Elite is a rarity flag, not a fifth size**: an Elite is always a Large body and carries its own numbers, so two multipliers never stack.
- Size raises HP faster than PS, so a Large body is a longer fight rather than a harder hit — which is what makes Small the farming body and Large the roadblock.
- **Mob crit is now possible.** Lck flows into crit through the same K values as a player, so the incoming order in `combat.md` §2 needs a crit step it did not have before this sheet existed.

## What the species actually produce

Mobs are not a separate math. A species multiplies the same stat block a player has, and then the **player's own K values** run over it unchanged.

<!-- BEGIN GENERATED:mob-stats -->
| Species | HP × (Vit) | PS × (Str) | accuracy | evasion | armour | res | crit | dodge |
|---|---|---|---|---|---|---|---|---|
| Rat | ×0.73 | ×0.84 | NaN | NaN | NaN | NaN% | NaN% | NaN% |
| Husk | ×1.63 | ×1.17 | NaN | NaN | NaN | NaN% | NaN% | NaN% |
| Goblin | ×0.97 | ×1.29 | NaN | NaN | NaN | NaN% | NaN% | NaN% |
| Slime | ×1.46 | ×0.73 | NaN | NaN | NaN | NaN% | NaN% | NaN% |
| Bandit | ×0.93 | ×1.13 | NaN | NaN | NaN | NaN% | NaN% | NaN% |
| Spider | ×0.82 | ×0.72 | NaN | NaN | NaN | NaN% | NaN% | NaN% |
| Wolf | ×0.93 | ×1.13 | NaN | NaN | NaN | NaN% | NaN% | NaN% |
| Orc | ×1.27 | ×1.48 | NaN | NaN | NaN | NaN% | NaN% | NaN% |
| Troll | ×1.48 | ×1.38 | NaN | NaN | NaN | NaN% | NaN% | NaN% |
| Elf | ×0.77 | ×0.86 | NaN | NaN | NaN | NaN% | NaN% | NaN% |
| Demon | ×1.07 | ×1.17 | NaN | NaN | NaN | NaN% | NaN% | NaN% |
| Golem | ×1.55 | ×1.70 | NaN | NaN | NaN | NaN% | NaN% | NaN% |
| Knight | ×1.51 | ×1.29 | NaN | NaN | NaN | NaN% | NaN% | NaN% |
| Drake | ×1.05 | ×1.25 | NaN | NaN | NaN | NaN% | NaN% | NaN% |
| Seraph | ×0.99 | ×0.59 | NaN | NaN | NaN | NaN% | NaN% | NaN% |

Every column is the player's own formula at level 100 (stat block NaN per stat): accuracy = Dex × 1.5 × accuracy tier · **evasion = Dex × 0.5** (the Medium-body line · a Small body multiplies it ×1.1, Large and Elite ×0.9) · **armour = Str × 2** (the same line the player uses · D-022 · it is what chill's 25% cut acts on) · res = Vit × 0.05 · crit = Lck × 0.05 · dodge = `own Agi rate ÷ (rate + a same-level attacker's accuracy)` (D-024). Mobs are not a separate math — they are the same math with a multiply vector on the stat block. Energy Shield is the one player line a mob does not have (player-only · D-026).
<!-- END GENERATED:mob-stats -->

- **Mob crit is real** — 8% to 14% from the mob's own Lck line, and the incoming order now has the step it needed (`combat.md` §2 step 4b · ×2.0, the no-Mod base).
- **Mob res is low, 8% to 17%.** That answers the open question of what the player's res is for: not for mob res, which nobody can out-race, but for the Element counter table and the Element half of every hit.
- **Mob dodge is the mirror of ours** — the mob's own Agi rate contested by *the accuracy of the player hitting it*, the same opposed shape X20 uses on the player side (D-024). It is a thin layer: every roster entry lands in the single-digit band, so a mob's Agi never becomes the answer to a build (**X24** keeps it there). The per-entry number is the `dodge` column of `mob-roster.md` and of the table above.
- **Mob evasion is the species Dex line** (`stat_c × species.dex × K_EVASION × body class`), which is why the sheet above carries an `evasion` column. The reference mob — mean species on a Medium body — is where every published hit chance is measured, and it lands on the same number the retired `level × 1` curve gave, so no DPS or mob_HP anchor had to be re-tuned (`formula-utility.md` section 8 · guard **X21**).
- **Armour is in this table** (`K_ARMOUR` 2 on the mob's Str line · D-022), so a Golem or Knight genuinely blunts a fast weapon and a Rat blunts nothing. **Energy Shield is deliberately not here** — the shield is a player-only line (D-026), because a mob's survivability is already the `mob_HP` anchor and a second pool would count it twice.

| Property | Value |
|---|---|
| Level | 1-90 (player ceiling is 100 · levels 91-100 are more of the same zone-9 band) |
| HP | `DPS of on-level gear player x 1 sec x skill multiplier` |
| innate Element | 1 Element, rolled on spawn · takes ×1.5 damage from that Element |
| Core stats | Same 7-stat block as players (`stat_c = 12 + 2 × (L − 1)`, no Flat/% from equipment) · feeds accuracy, res, crit, aspd via the same K values · Full mob sheet with per-level table follows in the rebalance pass (P1-1) |
| evasion | `stat_c(level) × species.dex × K_EVASION × body class` · the reference mob is the mean species on a Medium body, and its number is generated in `formula-utility.md` section 8 · per-species numbers in the sheet above and `mob-roster.md` |
| Return damage | `typical DPS ÷ 27` per second (L100 = 329) · the species tag divides it: physical mobs are the whole armour half, magic mobs the whole res half, mixed mobs 50/50 by their innate Element (D-030 · combat.md section 3 · the `phys/elem` column of mob-roster.md) |
| drop table | item table that mob drops |
| Weapon used | affects weight and drops |

- Old evasion was written as level 100 = 600, calculated on the assumption players have Dex 890 · true ceiling is 510 and no build stacks all 12 items on Dex.
  At 600, no-Dex players get 40% hit chance in a game that attacks all day · so it changed to `level × 1`, which keeps hit chance constant across levels because both sides grow linearly (80% with no Dex, 94% with full Dex).
  `level × 1` was always a stand-in for "evasion grows with the mob's own Dex". Once every species carried a Dex line (D-019) the stand-in became wrong twice over: it made a Slime and an Elf equally hard to hit, and it ignored the body class that already carried its own evasion multiplier. Both are now derived from the same K the player uses.
- Mob HP derives from DPS in formula.md section 0 · at level 100 it is set from *on-level* gear players (8,881 DPS), not from a full-gear player, so a fully geared character clears faster than the anchor · the inter-level line uses `item count = min(12, ceil(L/2))` (combat.md section 3).

- HP is the single value setting game speed. It must be set from expected player DPS, not set-then-tuned.
- Mob innate Element is rolled on spawn, not fixed, so players cannot fully predict and must prepare res in advance.

# Mob Groups

**Mobs come in groups, not one by one** — this is why AoE skills have value, and why single-target attacks alone are not enough.

| Level range | Mobs per group |
|---|---|
| 1-30 | 1-2 |
| 31-60 | 2-3 |
| 61-90 | 3-5 |
| boss | always 1 |

- Numbers are ranges, rolled on every zone entry. Players always meet different groups.
- **Max 3 engage at once** — in larger groups, mobs 4-5 queue · this rule is part of the AFK promise: with 3 engaging, the generated `survival-group` table in combat.md section 6 costs no build more than 3.3% of pool, so nobody is pushed while idle; with 5 engaging the cost scales by roughly 5/3 and every build is pushed. The numbers in sections 6 and 7 depend on this rule alone. **This is also the definition of "nearby" for auras and debuffs: 3 mobs** (D-009 7a · skill-pool-system.md).
- Elite and boss have no companions, always single.
- Higher level ranges mean larger groups, requiring group answers from early game.

## Attack Order

**Always hit the lowest-HP target first.**

- This clears groups faster because it fastest reduces the number of targets still hitting back.
- This gives Execute and Overkill much more value because the lowest-HP target is the one to finish.
- Players choose nothing; the game assigns it · no fiddly focus-target rules.

## Mobs Attack Together

**All units in the group attack in the same round**, not taking turns one by one.

- **Max 3 engage at once** (section "Mob Groups"), so a group of 5 fields 3 attackers per round, not 5. A 5-mob group therefore deals 3 hits per round to the player — the cost of killing slowly.
- **Evasion rolls separately per unit** · 25% Evasion against 3 attackers ≈ 2.25 hits taken per round.
- This is why Evasion, Max HP, and Vit matter even for heavy-attack players.
- AoE is therefore not free: if kills are not fast enough, the remaining targets keep firing back. Under the decided AoE rule (60% per target · Cap 3 · mana ×1.5 · `skill-pool-system.md`), a group of 5 dies in 3.75 sec instead of 4.50 — 1.20× faster — while it costs 0.40-0.80× damage per mana against 1-2 small mobs, so the trade is real.
- The measured pool cost per group is the generated `survival-group` table in combat.md section 6, not a hand number.

## AoE Range

| Value | Example |
|---|---|
| Attack skill AoE range | hits up to 3 units of the group queue, chosen by reach (melee fans from the front slot, stand-off picks any 3) · there is no tile distance · combat.md section 2b |
| Aura range | always while aura is on, no time range limit |

- Same range everywhere for simplicity · multiple ranges require clear player notice first.

# Drops

| Type | Item quality | Gained when |
|---|---|---|
| Normal mobs | per level ceiling | every unit |
| Elite mobs | floor while AFK · floor +1 tier only while online | rare |
| Boss | floor equals ceiling | very rare |
| Bag | per level ceiling | rare |
| **skill** | no Quality level | high bosses · very low normal mobs · mid elite |

- **Normal mobs can still drop low Quality in mid-Quality zones** under floor/ceiling rules.
- Boss forces Quality to ceiling, i.e. pays the highest Quality that zone can drop.
- Craft currency drops per mob drop table (see crafting.md).
- Skills have no Item quality · drops are new skills or duplicates to upgrade tiers (see skill-pool.md).
