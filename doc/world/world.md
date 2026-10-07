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

**18 zones · 10 levels per zone · 1 boss per zone.**

<!-- BEGIN GENERATED:zone-table -->
| Zone | Settlement · Levels | Region | Dropped Quality ceiling | mob HP (zone edge) | innate Elements | Mobs per group | Boss | roster entries |
|---|---|---|---|---|---|---|---|---|
| 1 | Eastgate · 1-10 | pinewood road | low | 120 → 629 | fire | 1-2 | Goblin King (Goblin) | 14 |
| 2 | Millbrook · 11-20 | slow water | low | 730 → 1,305 | poison | 1-2 | Broodmother (Spider) | 12 |
| 3 | Ashfall · 21-30 | ash fields | low | 1,436 → 1,824 | fire | 1-2 | Treant Elder (Treant) | 12 |
| 4 | Ironrow · 31-40 | storm terrace | mid (floor = low) | 3,546 → 4,033 | lightning | 2-3 | Elven Archmage (Elf) | 12 |
| 5 | Wolf Cross · 41-50 | wolf country | mid | 4,090 → 4,632 | cold | 2-3 | Elder Troll (Troll) | 11 |
| 6 | Highspire · 51-60 | high crags | mid | 4,696 → 5,293 | cold · lightning | 2-3 | Warlord Orc (Orc) | 12 |
| 7 | Bonegate · 61-70 | the bone gate | high (floor = mid) | 7,739 → 8,587 | chaos | 3-5 | Hoarder Kobold (Kobold) | 12 |
| 8 | Frosthold · 71-80 | frost hold | high | 8,685 → 9,605 | cold | 3-5 | Ogre King (Ogre) | 12 |
| 9 | Vermolch · 81-90 | the vermolch mire | high | 9,712 → 10,709 | poison · chaos | 3-5 | Wolf King (Wolf) | 10 |
| 10 | Thornwake · 91-100 | wet lowland | low | 10,850 → 12,144 | poison | 1-2 | Ancient Dragon (Dragon) | 10 |
| 11 | Greyfen · 101-110 | wet lowland | low | 12,291 → 13,639 | poison · chaos | 1-2 | Mummy Lord (Mummy) | 14 |
| 12 | Saltmarrow · 111-120 | salt flats | low | 13,791 → 15,191 | chaos | 1-2 | Bone Colossus (Skeleton) | 11 |
| 13 | Emberhold · 121-130 | slag and foundry heat | mid (floor = low) | 15,350 → 16,803 | fire | 2-3 | Ancient Vampire (Vampire) | 15 |
| 14 | Duskmoor · 131-140 | open moor | mid (floor = low) | 16,967 → 18,473 | cold · chaos | 2-3 | Archdemon (Demon) | 14 |
| 15 | Nettlecrag · 141-150 | thorn country | mid (floor = low) | 18,643 → 20,202 | chaos · poison | 2-3 | Slime King (Slime) | 8 |
| 16 | Blackwater Reach · 151-160 | drowned river mouth | high (floor = mid) | 20,378 → 21,989 | poison | 3-5 | Colossus (Golem) | 8 |
| 17 | Wyrmback · 161-170 | wyrm breeding ground | high (floor = mid) | 22,171 → 23,836 | fire · cold | 3-5 | Lizardman Chief (Lizardman) | 12 |
| 18 | The Pale Spire · 171-180 | the pale bloom | high (floor = mid) | 24,024 → 25,741 | chaos · poison | 3-5 | Paladin (Human) | 13 |

HP columns are `mob_HP(L)` at the zone's first and last level (checks.md D1) · the boss row is the zone's own `mob_HP × 15 / damage × 4` carrier species (combat.md section 7). `mob-roster.md` expands every one of these into the per-species, per-body entries a build reads from.
<!-- END GENERATED:zone-table -->

## Properties Per Zone

| Property | Value |
|---|---|
| Zone level · group size · Quality ceiling · innate Elements · boss | the generated table above — one row per zone, no second home |
| Elite spawn chance | **1 in 5 kills** (`engine.json` `loot.elite_spawn_chance`) · always single · each drops a Reroll tier stone **5%** of the time · the main tier-stone source (loot.md section 5) |
| Boss spawn chance | **1 per 15 min per character** · only attackable while online |
| New group spawn time | 4 sec after clearing the previous group · constant across zones |
| Species per zone | every legal zone × species × body entry is listed with its numbers in `mob-roster.md` · **X23** fails a zone with fewer than 5 entries or a boss that does not live there |

- **Zone unlock by level, not by boss** · zone i boss spawns when player level ≥ that zone, and grants *Quality ceiling* + craft currency + skill (concept.md).
- **Dropped Quality ceiling in zone i unlocks after beating zone i−1 boss** (zone 1 unlocked immediately) · reason: granting full ceiling on zone entry removes the need to fight bosses · and making bosses a hard progress gate would permanently wall builds that lose to bosses.
- **Losing to a boss = losing that spawn** (boss retreats, full HP, must wait for next 15 min cycle) · full rules + which build wins at which zone in combat.md section 7.
- **A player past a zone's last level still fights that zone at its edge** · the spawn clamp is the zone's own range, so the world's last zones stay the farm for a character at the level cap (as stated in `concept.md` and `formula.md` section 0a).

# Hunting Mode

How the walk chooses its zone, switched by the player (`game/` control). The design's default is **Stay**:

- **Stay** — the character farms the zone it is in however high it gets · only the player moves it, so nothing travels without being told.
- **Forward** — the chapter climb. The walk moves on to the next settlement already opened once the current zone's own level band is behind it (`mob.zones.levels`, no separate travel number), and a **Push** sends it back to the last zone it held. The walk then refuses to re-enter the zone it was chased out of until one more level is gained against that zone, so the ladder settles where the build is survivable instead of looping into a wall.

Forward uses settlements already opened and adds no Road number: Road travel stays its own opt-in, online-only system (`towns.md`).

# Full Game Timeline

Generated, never typed: the 5-level-step table below is written by `tools/timeline.ts` from `engine.json` `xp`, and the
checkpoints it reconciles against are `checks.md` E1-E5. A hand-typed copy of the same hours used to sit here, and it
went stale the moment the re-base moved the funnel, so it is deliberately gone — read the generated table below, or the
E-rows in `checks.md`.

<!-- BEGIN GENERATED:xp-formula -->
```
xp per kill   = 10 × mob level (normal) · ×3 elite · ×15 boss
xp to next level     = 5-level-step table (generated below from the kills anchors)
kills per level       = 20 (L1) · 41 (L5) · 67 (L10) · 71 (L11) · 92 (L15) · 115 (L20) · 121 (L21) · 141 (L25) · 197 (L30) · 207 (L31) · 248 (L35) · 322 (L40) · 334 (L41) · 386 (L45) · 486 (L50) · 504 (L51) · 581 (L55) · 717 (L60) · 741 (L61) · 840 (L65) · 1,147 (L70) · 1,178 (L71) · 1,319 (L75) · 1,562 (L80) · 1,610 (L81) · 1,818 (L85) · 1,863 (L86) · 1,907 (L87) · 1,952 (L88) · 1,995 (L89) · 2,169 (L90) · 2,304 (L91) · 2,430 (L92) · 2,685 (L93) · 2,933 (L94) · 3,360 (L95) · 3,732 (L96) · 3,962 (L97) · 4,757 (L98) · 7,063 (L99)
```
<!-- END GENERATED:xp-formula -->
- **The elite and boss multipliers are paid in the model.** One kill in five rolls elite (×3 XP) and the boss clock adds ×15, so the average kill is worth ~1.44× a plain mob; the kills-per-level anchors are scaled to hold the published E1-E5 kill counts. Ignoring them would have finished the game about a third early the moment the elite rate moved from 0.5% to 20%.

**XP per 5-level step** — generated by `node tools/timeline.ts` from `engine.json` `xp` (anchors + band rates); do not hand-type:

<!-- BEGIN GENERATED:xp-table -->
Derived from `xp_to_next(L) = kills(L) × 10 × min(L, 180)` with the kills anchors in `engine.json`. The unit is kills, not hours: how long a step takes is the player's own pace (`AGENT.md`).

| Levels | XP to clear the step | Cumulative XP | Kills to clear the step | Cumulative kills |
|---|---|---|---|---|
| 1-5 | 5,100 | 5,100 | 153 | 153 |
| 6-10 | 23,160 | 28,260 | 283 | 436 |
| 11-15 | 53,500 | 81,760 | 408 | 843 |
| 16-20 | 95,680 | 177,440 | 529 | 1,372 |
| 21-25 | 151,150 | 328,590 | 655 | 2,027 |
| 26-30 | 245,560 | 574,150 | 873 | 2,900 |
| 31-35 | 376,400 | 950,550 | 1,138 | 4,038 |
| 36-40 | 557,040 | 1,507,590 | 1,462 | 5,500 |
| 41-45 | 775,300 | 2,282,890 | 1,800 | 7,300 |
| 46-50 | 1,072,400 | 3,355,290 | 2,230 | 9,530 |
| 51-55 | 1,439,550 | 4,794,840 | 2,713 | 12,242 |
| 56-60 | 1,924,260 | 6,719,100 | 3,313 | 15,555 |
| 61-65 | 2,492,550 | 9,211,650 | 3,953 | 19,508 |
| 66-70 | 3,488,420 | 12,700,070 | 5,121 | 24,629 |
| 71-75 | 4,560,550 | 17,260,620 | 6,243 | 30,871 |
| 76-80 | 5,717,580 | 22,978,200 | 7,324 | 38,195 |
| 81-85 | 7,118,300 | 30,096,500 | 8,570 | 46,765 |
| 86-90 | 8,706,680 | 38,803,180 | 9,886 | 56,651 |
| 91-95 | 12,778,310 | 51,581,490 | 13,712 | 70,363 |
| 96-100 | 20,855,640 | 72,437,130 | 21,290 | 91,653 |
| 101-105 | 8,877,750 | 81,314,880 | 8,621 | 100,273 |
| 106-110 | 8,877,750 | 90,192,630 | 8,222 | 108,495 |
| 111-115 | 8,877,750 | 99,070,380 | 7,858 | 116,353 |
| 116-120 | 8,877,750 | 107,948,130 | 7,525 | 123,877 |
| 121-125 | 8,877,750 | 116,825,880 | 7,219 | 131,096 |
| 126-130 | 8,877,750 | 125,703,630 | 6,937 | 138,032 |
| 131-135 | 8,877,750 | 134,581,380 | 6,676 | 144,708 |
| 136-140 | 8,877,750 | 143,459,130 | 6,434 | 151,142 |
| 141-145 | 8,877,750 | 152,336,880 | 6,209 | 157,351 |
| 146-150 | 8,877,750 | 161,214,630 | 5,999 | 163,350 |
| 151-155 | 8,877,750 | 170,092,380 | 5,803 | 169,153 |
| 156-160 | 8,877,750 | 178,970,130 | 5,619 | 174,772 |
| 161-165 | 8,877,750 | 187,847,880 | 5,447 | 180,219 |
| 166-170 | 8,877,750 | 196,725,630 | 5,285 | 185,504 |
| 171-175 | 8,877,750 | 205,603,380 | 5,132 | 190,636 |
| 176-180 | 8,877,750 | 214,481,130 | 4,988 | 195,623 |
| 181-185 | 8,877,750 | 223,358,880 | 4,932 | 200,556 |
| 186-190 | 8,877,750 | 232,236,630 | 4,932 | 205,488 |
<!-- END GENERATED:xp-table -->

- The run's published checkpoints are the **E-series** (level 100 at 110.7 hr, on to the level cap at 574.5 hr), and they are **informational**: play-length is not a design constraint, so nothing here is tuned to a target number of hours.
- That settles the "many zones or deep zones" question: 18 zones of 10 levels each, with each zone's share of the timeline read off the `checks.md` E-series · to add another zone later, *reduce* the craft time per zone, never the level time.
- **Closed with the ladder re-cut**: the old 32-duplicate random ladder asked ~300 hr against the line of the day, and the live ladder (12 duplicates + the 2:1 conversion, generated by `ladder.ts`) is the fix, so no open conflict is left here.

# Mob HP Formula Per Level (Replaces Placeholder Line)

```
mob_HP(L)     = typical_gear_DPS(L) × (1 + 0.0034 × L)   ·   anchored at every zone edge, linear in between
                typical_gear_DPS(L) = mob_HP(L) ÷ (1 + 0.0034 × L)   (read back out, never typed)
item count = min(12, ceil(L/2))   → L1 = 1 item · L24+ full 12   (the gear the curve was priced against)
no tree multiplier      (the passive tree is empty - see skill-tree.md)
skill multiplier   = 1 + 0.0034 × L      → ×1.30 at L90 · ×1.34 at L100 (skill-pool-system.md section "Press per skill")
mob_damage(L) = typical_gear_DPS(L) / 27 per second (split by the species damage tag · combat.md)

> **Why the damage line is not set from mob_HP** - mob_PS is `typical_gear_DPS / 27`, a fraction of the player's own output, not a share of the mob's HP. `mob_HP` carries only the skill multiplier.
```

<!-- BEGIN GENERATED:mob-curve -->
| Level | 1 | 11 | 21 | 31 | 41 | 51 | 61 | 71 | 81 | 91 | 101 | 111 | 121 | 131 | 141 | 151 | 161 | 171 | 180 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| mob HP | 120 | 730 | 1,436 | 3,546 | 4,090 | 4,696 | 7,739 | 8,685 | 9,712 | 10,850 | 12,291 | 13,791 | 15,350 | 16,967 | 18,643 | 20,378 | 22,171 | 24,024 | 25,741 |
| mob damage/sec | 4 | 26 | 50 | 119 | 133 | 148 | 237 | 259 | 282 | 307 | 339 | 371 | 403 | 435 | 467 | 499 | 531 | 563 | 591 |

mob_HP(L) is defined at every level: the curve is anchored at each zone edge in `tools/data/engine.json` `mob.zones` and interpolated linearly inside the zone a mob spawns in. The spawn cap is 180, so the last column is the highest level a mob can spawn at; above it the gear factor is held flat and the theoretical player cap anchor `mob.curve.hp_at_player_level_cap` sits at level 190. Mob damage/sec is `typical_gear_DPS(L) ÷ 27`, derived from the same curve rather than typed beside it (**X37**).
<!-- END GENERATED:mob-curve -->

- **TTK = 1 sec for on-level gear players** · full T1 gear kills in 0.9 sec · fresh zone entrants with no gear take 2-6 sec (level 1 = ~2 sec, not 16 sec).
- This line replaces the old text stating "HP is set by level" with no formula · and gives combat.md usable per-level numbers.
- Elite and boss multipliers live in `engine.json` `mob.sizes` + `mob.elite`; combat.md section 6-7 is generated from them by `node tools/survival.ts`.



- One zone should have 1-2 common innate Elements so players have reason to hunt matching res items.
- If one zone has all Elements equally, players must guard all 5 Elements, which is too expensive for a single zone.

# Monsters

## Species and body class

A mob is three independent things: a **species**, a **body class**, and an **innate Element** rolled on spawn. Species and body class come from `tools/data/engine.json` `mob`; innate Element stays a spawn roll, so the three axes never collapse into one. **This table is generated** — edit the data, not this file.

**22 species**, each legal on 1-3 of the three farming bodies (Small · Medium · Large): Goblin · Skeleton · Human · Lizardman are legal on all three, and Troll · Golem · Treant · Giant are the only Large-only ones. Multiplied over the zones each species is placed in, plus Elite and the eighteen named bosses, that gives the full spawnable list — every entry with its numbers resolved in **`mob-roster.md`**, which is what a build reads. The entry count and the per-zone spread are printed by **X23**, so no number here needs restating.

<!-- BEGIN GENERATED:mob-sheet -->
| Species | Zones | Habitat (regions it may live in) | Variants (ladder) | Damage | accuracy | Body classes | str · agi · vit · dex · int · wis · lck |
|---|---|---|---|---|---|---|---|
| Goblin | 1 · 2 | pinewood road · slow water | Sneak Goblin → Raider Goblin → Tinker Goblin → Shaman Goblin → Goblin King | physical | ×0.75 | Small · Medium · Large | 1.29 · 1.18 · 0.97 · 0.97 · 0.65 · 0.86 · 1.08 |
| Orc | 1 · 6 · 11 | pinewood road · high crags · wet lowland | Raider Orc → Shaman Orc → Berserker Orc → Juggernaut Orc → Warlord Orc | physical | ×0.75 | Medium · Large | 1.48 · 1.06 · 1.27 · 0.74 · 0.53 · 0.95 · 0.95 |
| Kobold | 7 | the bone gate | Miner Kobold → Trapper Kobold → Tinker Kobold → Drake Kobold → Hoarder Kobold | physical | ×0.50 | Small · Medium | 1.07 · 1.32 · 0.85 · 1.06 · 0.64 · 0.85 · 1.22 |
| Ogre | 6 · 8 · 17 | high crags · frost hold · wyrm breeding ground | Brute Ogre → Butcher Ogre → Swamp Ogre → Mage Ogre → Ogre King | physical | ×0.50 | Medium · Large | 1.43 · 0.96 · 1.38 · 0.74 · 0.59 · 0.95 · 0.95 |
| Troll | 5 · 7 · 9 · 10 | wolf country · the bone gate · the vermolch mire · wet lowland | Cave Troll → Forest Troll → Swamp Troll → Stone Troll → Elder Troll | physical | ×0.50 | Large | 1.38 · 0.85 · 1.48 · 0.74 · 0.64 · 0.95 · 0.95 |
| Minotaur | 7 | the bone gate | Warrior Minotaur → Berserker Minotaur → Guardian Minotaur → Blood Minotaur → Minotaur King | physical | ×0.75 | Medium · Large | 1.37 · 1.01 · 1.16 · 0.80 · 0.84 · 0.91 · 0.91 |
| Skeleton | 12 · 13 · 14 | salt flats · slag and foundry heat · open moor | Warrior Skeleton → Archer Skeleton → Knight Skeleton → Mage Skeleton → Bone Colossus | physical | ×0.25 | Small · Medium · Large | 1.23 · 0.73 · 1.57 · 0.84 · 0.68 · 1.07 · 0.90 |
| Mummy | 11 · 12 | wet lowland · salt flats | Warrior Mummy → Priest Mummy → Cursed Mummy → Royal Mummy → Mummy Lord | physical | ×0.25 | Medium · Large | 1.28 · 0.78 · 1.56 · 0.78 · 0.67 · 1.00 · 0.94 |
| Vampire | 12 · 13 · 14 | salt flats · slag and foundry heat · open moor | Blood Vampire → Noble Vampire → Vampire Knight → Vampire Lord → Ancient Vampire | mixed | ×0.75 | Medium · Large | 1.15 · 1.16 · 1.00 · 0.95 · 0.90 · 0.90 · 0.95 |
| Demon | 8 · 11 · 13 · 14 · 15 · 16 | frost hold · wet lowland · slag and foundry heat · open moor · thorn country · drowned river mouth | Imp → Demon Mage → Demon Brute → Demon Knight → Archdemon | mixed | ×0.75 | Medium · Large | 1.17 · 0.97 · 1.07 · 0.87 · 1.17 · 0.87 · 0.87 |
| Slime | 5 · 15 · 16 · 17 | wolf country · thorn country · drowned river mouth · wyrm breeding ground | Splitter Slime → Acid Slime → Devourer Slime → Mimic Slime → Slime King | magic | ×0.05 | Small · Medium | 0.73 · 0.63 · 1.46 · 0.73 · 1.15 · 1.25 · 1.04 |
| Spider | 2 · 5 · 7 · 17 | slow water · wolf country · the bone gate · wyrm breeding ground | Cave Spider → Hunter Spider → Web Spider → Venom Spider → Broodmother | physical | ×0.50 | Small · Medium | 0.72 · 1.34 · 0.82 · 1.24 · 0.82 · 0.93 · 1.13 |
| Wolf | 1 · 2 · 9 · 10 | pinewood road · slow water · the vermolch mire · wet lowland | Hunting Wolf → Dire Wolf → Shadow Wolf → Alpha Wolf → Wolf King | physical | ×1.00 | Small · Medium | 1.13 · 1.34 · 0.93 · 1.03 · 0.62 · 0.93 · 1.03 |
| Golem | 7 · 8 · 15 · 16 · 18 | the bone gate · frost hold · thorn country · drowned river mouth · the pale bloom | Stone Golem → Iron Golem → Guardian Golem → Crystal Golem → Colossus | physical | ×0.25 | Large | 1.70 · 0.60 · 1.55 · 0.75 · 0.65 · 1.10 · 0.65 |
| Dragon | 6 · 8 · 9 · 10 · 18 | high crags · frost hold · the vermolch mire · wet lowland · the pale bloom | Wyrmling → Drake → Wyvern → Elder Dragon → Ancient Dragon | mixed | ×1.00 | Medium · Large | 1.48 · 0.78 · 1.30 · 0.81 · 0.90 · 0.98 · 0.76 |
| Treant | 3 · 4 | ash fields · storm terrace | Young Treant → Thorn Treant → Rotting Treant → Ancient Treant → Treant Elder | physical | ×0.25 | Large | 1.54 · 0.73 · 1.52 · 0.75 · 0.65 · 1.03 · 0.80 |
| Human | 1 · 13 · 18 | pinewood road · slag and foundry heat · the pale bloom | Ranger → Warrior → Knight → Mage → Paladin | physical | ×0.75 | Small · Medium · Large | 1.13 · 1.03 · 0.93 · 1.13 · 0.72 · 1.03 · 1.03 |
| Lizardman | 5 · 11 · 17 | wolf country · wet lowland · wyrm breeding ground | Hunter Lizardman → Warrior Lizardman → Scale Knight → Shaman Lizardman → Lizardman Chief | physical | ×0.75 | Small · Medium · Large | 1.16 · 1.26 · 1.00 · 0.95 · 0.58 · 0.90 · 1.16 |
| Elf | 3 · 4 · 18 | ash fields · storm terrace · the pale bloom | Wood Elf → High Elf → Moon Elf → Dark Elf → Elven Archmage | mixed | ×1.00 | Medium · Large | 0.86 · 1.15 · 0.77 · 1.25 · 1.05 · 0.96 · 0.96 |
| Giant | 6 · 9 · 10 | high crags · the vermolch mire · wet lowland | Hill Giant → Stone Giant → Frost Giant → Fire Giant → Storm Giant | physical | ×0.25 | Large | 1.59 · 0.83 · 1.41 · 0.75 · 0.59 · 1.03 · 0.80 |
| Werewolf | 2 · 3 · 4 · 14 | slow water · ash fields · storm terrace · open moor | Wolfman → Dire Werewolf → Blood Werewolf → Alpha Werewolf → Werewolf Lord | physical | ×1.00 | Medium · Large | 1.31 · 1.20 · 1.10 · 0.89 · 0.58 · 0.94 · 0.99 |
| Dryad | 3 · 4 | ash fields · storm terrace | Forest Dryad → Flower Dryad → Thorn Dryad → Corrupted Dryad → Ancient Dryad | magic | ×0.50 | Medium · Large | 0.73 · 0.97 · 0.88 · 1.17 · 1.22 · 1.07 · 0.98 |

| Body class | HP | PS | evasion | Grouping |
|---|---|---|---|---|
| Small | ×0.70 | ×0.70 | ×1.10 | up to 5 |
| Medium | ×1.00 | ×1.00 | ×1.00 | up to 5 |
| Large | ×1.70 | ×1.35 | ×0.90 | alone |
| Boss | ×15.00 | ×18.00 | ×1.00 | alone |
| Elite | ×6.00 | ×4.00 | ×0.90 | alone |
<!-- END GENERATED:mob-sheet -->

- **The player has no class.** Species is a creature lineage (Goblin · Golem · Elf), not a job, and nothing about it is available to the player.
- **Mobs carry no skills in the current build.** A species trait and its damage tag are the whole of a mob's behaviour until the skill/mechanics system lands; no species entry carries a skill field, and **X55** fails if one appears while `mob.skills_enabled` is false.
- **A species is a multiply vector on the mob's own flat stat block**. A mob's block is one base per stat with no level term; the species vector rides on it and the body class carries its own multipliers on top. Check **X19** fails any species whose seven multipliers do not average 1.00, so no species can quietly be stronger overall than `mob_HP` was derived against.
- **`accuracy` is the load-bearing column.** Mob accuracy is `K_DEX_ACC` run over the flat stat block, scaled by the species Dex multiplier and the accuracy tier. Against a low-accuracy species the Evasion **Cap is reachable**; against the top tier full Dex only reaches the low thirties. That is why no single mob accuracy number could ever close `checks.md` C1 — the species mix does, and Evasion becomes a build that works *against some things*.
- **`element_bias` only tilts the roll** inside the zone's own 1-2 Elements. It never adds an Element, so res still has to be prepared in advance.
- **Four card sizes, copied from Ragnarok** (Small · Medium · Large · Boss). **Elite is a rarity flag, not a fifth size**: an Elite is always a Large body and carries its own numbers, so two multipliers never stack.
- Size raises HP faster than PS, so a Large body is a longer fight rather than a harder hit — which is what makes Small the farming body and Large the roadblock.
- **Mob crit is now possible.** Lck flows into crit through the same K values as a player, so the incoming order in `combat.md` §2 needs a crit step it did not have before this sheet existed.
- **A variant is its own drop table, not decoration.** Each ladder rung is a **named variant**, and the name is what the drop roll reads: `mob.variant_drops` gives every name its own junk item (a Goblin pays an Ear at Sneak, Bile at Raider, a Cog at Tinker, a Charm at Shaman and a Crown at the King) and the collectible stream that variant **leans** — the three normal rungs of every ladder cycle gear · herb · junk, and Elite and Boss carry `none` because they already pay their own stone lines. So a species is one stat vector but five drop identities, and a Counterhand visit names the variants farmed, not only the races (loot.md · `mob-roster.md`).
- **The ladder name is its own roll, not a body class.** The three normal rungs roll independently of the body a spawn takes, because a species with two bodies (Orc is Medium · Large) could otherwise never field one of its three names. Body class stays the toughness axis, the name is the drop axis, and innate Element stays a separate spawn roll — the three axes never collapse into one.
- **The player picks the hunting ground.** Every zone is three **sub-zones**, each with its own race pair and one Element from the zone's set, and the client lets the player choose which one a spawn rolls inside (`zoneFocus`); with none chosen the zone's own cast rolls as before. A chosen sub-zone is therefore the two races and the Element actually fought, and with them the junk their variants pay. Elite and Boss stay zone-level. It is a choice of *what* to farm, never of *how much*: a sub-zone moves no rate, and the upgrade rates the loot bands publish are unchanged.
- **The walk does not stand on a sub-zone.** The blocks the Road is walked in are the ground *between* settlements (`towns.md`), and the map's hex per sub-zone is still the place you fight in rather than a place you occupy — so `zoneFocus` stays a choice and never becomes a position. Nothing in the walk can change which cast a spawn rolls, and the map cage's **M11** (a settlement's hex plus one hex per sub-zone) is unchanged by either.
- **A variant leans a stream; the player may override it.** The lean shifts probability between gear, herbs and junk by redistributing mass — never raising the total — so the drop rate the timeline is priced on cannot move. The Hunt Order control is the player's override: cleared, each mob leans what its own rung leans.

## What the species actually produce

Mobs are not a separate math. The species vector and body class multiply the mob's own flat stat block, and then the **same K values the player obeys** run over it unchanged.

<!-- BEGIN GENERATED:mob-stats -->
| Species | HP × (Vit) | PS × (Str) | accuracy | evasion | armour | res | crit | dodge |
|---|---|---|---|---|---|---|---|---|
| Goblin | ×0.97 | ×1.29 | 118 | 53 | 280 | 5.3% | 5.9% | 8.6% |
| Orc | ×1.27 | ×1.48 | 90 | 40 | 321 | 6.9% | 5.2% | 7.8% |
| Kobold | ×0.85 | ×1.07 | 86 | 57 | 232 | 4.6% | 6.6% | 9.6% |
| Ogre | ×1.38 | ×1.43 | 60 | 40 | 310 | 7.5% | 5.2% | 7.1% |
| Troll | ×1.48 | ×1.38 | 60 | 40 | 299 | 8.0% | 5.2% | 6.4% |
| Minotaur | ×1.16 | ×1.37 | 98 | 43 | 297 | 6.3% | 4.9% | 7.5% |
| Skeleton | ×1.57 | ×1.23 | 34 | 46 | 267 | 8.5% | 4.9% | 5.5% |
| Mummy | ×1.56 | ×1.28 | 32 | 42 | 278 | 8.5% | 5.1% | 5.9% |
| Vampire | ×1.00 | ×1.15 | 116 | 52 | 249 | 5.4% | 5.2% | 8.5% |
| Demon | ×1.07 | ×1.17 | 106 | 47 | 254 | 5.8% | 4.7% | 7.2% |
| Slime | ×1.46 | ×0.73 | 6 | 40 | 158 | 7.9% | 5.6% | 4.8% |
| Spider | ×0.82 | ×0.72 | 101 | 67 | 156 | 4.4% | 6.1% | 9.7% |
| Wolf | ×0.93 | ×1.13 | 168 | 56 | 245 | 5.0% | 5.6% | 9.7% |
| Golem | ×1.55 | ×1.70 | 30 | 41 | 369 | 8.4% | 3.5% | 4.6% |
| Dragon | ×1.30 | ×1.48 | 132 | 44 | 321 | 7.0% | 4.1% | 5.9% |
| Treant | ×1.52 | ×1.54 | 30 | 41 | 334 | 8.2% | 4.3% | 5.5% |
| Human | ×0.93 | ×1.13 | 138 | 61 | 245 | 5.0% | 5.6% | 7.6% |
| Lizardman | ×1.00 | ×1.16 | 116 | 52 | 252 | 5.4% | 6.3% | 9.2% |
| Elf | ×0.77 | ×0.86 | 203 | 68 | 186 | 4.2% | 5.2% | 8.4% |
| Giant | ×1.41 | ×1.59 | 30 | 41 | 345 | 7.6% | 4.3% | 6.2% |
| Werewolf | ×1.10 | ×1.31 | 145 | 48 | 284 | 6.0% | 5.4% | 8.8% |
| Dryad | ×0.88 | ×0.73 | 95 | 63 | 158 | 4.8% | 5.3% | 7.2% |

Every column is the player's own formula run over the mob's FLAT stat block (`mob.stat.base` 108 per stat, no level term): accuracy = Dex × 1.5 × accuracy tier · **evasion = Dex × 0.5** (the Medium-body line · a Small body multiplies it ×1.1, Large and Elite ×0.9) · **armour = Str × 2** (the same line the player uses · it is what chill's 25% cut acts on) · res = Vit × 0.05 · crit = Lck × 0.05 · dodge = `own Agi rate ÷ (rate + a same-level attacker's accuracy)`. Mobs are not a separate math — they are the same math with a multiply vector on one flat block, so two mobs of a level can be nothing alike. Energy Shield is the one player line a mob does not have (player-only).
<!-- END GENERATED:mob-stats -->

- **Mob crit is real** — 8% to 14% from the mob's own Lck line, and the incoming order now has the step it needed (`combat.md` §2 step 4b · ×2.0, the no-Mod base).
- **Mob res is low, 8% to 17%.** That answers the open question of what the player's res is for: not for mob res, which nobody can out-race, but for the Element counter table and the Element half of every hit.
- **Mob dodge is the mirror of ours** — the mob's own Agi rate contested by *the accuracy of the player hitting it*, the same opposed shape X20 uses on the player side. It is a thin layer: every roster entry lands in the single-digit band, so a mob's Agi never becomes the answer to a build (**X24** keeps it there). The per-entry number is the `dodge` column of `mob-roster.md` and of the table above.
- **Mob evasion is the species Dex line** (`flat stat block × species.dex × K_EVASION × body class`), which is why the sheet above carries an `evasion` column. The reference mob — mean species on a Medium body — is where every published hit chance is measured (`formula-utility.md` section 8 · guard **X21**).
- **Armour is in this table** (the same `K_ARMOUR` on the mob's Str line), so a Golem or Knight genuinely blunts a fast weapon and a Rat blunts nothing. **Energy Shield is deliberately not here** — the shield is a player-only line, because a mob's survivability is already the `mob_HP` anchor and a second pool would count it twice.

| Property | Value |
|---|---|
| Level | a readout only — it drives `mob_HP` · `mob_PS` · XP and the spawn clamp, and never the stat block |
| HP | `DPS of on-level gear player x 1 sec x skill multiplier` |
| innate Element | 1 Element, rolled on spawn · takes ×1.5 damage from that Element |
| Core stats | one flat block (`mob.stat`), no level term and no equipment, multiplied by the species vector and body class · feeds accuracy · res · crit · aspd via the same K values |
| evasion | the species Dex multiplier over the flat stat block × `K_EVASION` × body class · the reference mob is the mean species on a Medium body, generated in `formula-utility.md` section 8 · per-species numbers in the sheet above and `mob-roster.md` |
| Return damage | `typical DPS ÷ 27` per second (L100 = 329) · the species tag divides it: physical mobs are the whole armour half, magic mobs the whole res half, mixed mobs 50/50 by their innate Element (combat.md section 3 · the `phys/elem` column of mob-roster.md) |
| drop table | item table that mob drops |
| Weapon used | affects weight and drops |

- Old evasion was a level number; once every species carried a Dex line and the mob stat block went flat it became the species Dex line the player's own `K_EVASION` runs over.
- Mob HP derives from DPS in `formula.md` section 0 · it is set from *on-level* gear players, not from a full-gear player, so a fully geared character clears faster than the anchor · the inter-level line interpolates between the zone anchors.

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
- **Max 3 engage at once** — in larger groups, mobs 4-5 queue · this rule is part of the AFK promise: with 3 engaging, the generated `survival-group` table in combat.md section 6 costs no build more than 3.3% of pool, so nobody is pushed while idle; with 5 engaging the cost scales by roughly 5/3 and every build is pushed. The numbers in sections 6 and 7 depend on this rule alone. **This is also the definition of "nearby" for auras and debuffs: 3 mobs** (skill-pool-system.md).
- Elite and boss have no companions, always single.
- Higher level ranges mean larger groups, requiring group answers from early game.

## Attack Order

**Always hit the lowest-HP target first.**

- This clears groups faster because it fastest reduces the number of targets still hitting back.
- This gives the execute curse and Overkill much more value because the lowest-HP target is the one to finish.
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
