# Mob Roster

import world.md
import combat.md
import formula-utility.md
import loot.md
import elements.md

The complete mob list, generated from `tools/data/engine.json` (`mob.zones` · `mob.species` · `mob.bosses` · `K`). Every entry a build can spawn is here: the species × body roster across the zones, plus Elite and the zone bosses. Nothing about mobs needs designing after this file — the only open mob questions are listed at the bottom.

**How to read a row** — one row is one spawnable mob type: an `id` a save can store, the zone and level range it lives in, and its numbers produced by the *player's own formulas* run over its own stat block. HP is given at both ends of the zone's range because `mob_HP(L)` is the curve, so a mob at a middle level interpolates between the two.

**The three axes stay independent** (world.md · `mob-sheet`): species is the lineage vector, body class is Small · Medium · Large (Boss is the fourth card size, Elite is a rarity flag forced onto a Large body), and innate Element is rolled per spawn inside the zone's own Elements. A body class **replaces** the multipliers, it never stacks with another body or with Elite.

# Cast Per Zone

<!-- BEGIN GENERATED:zone-cast -->
| Zone | Settlement | species on cast | Small · Medium · Large | Elite | Boss (species · name) | boss HP at zone edge | boss damage/sec | entries |
|---|---|---|---|---|---|---|---|---|
| 1 | Eastgate | 4 | 3 · 4 · 3 | 3 | Goblin · Goblin King | 9,435 | 406 | 14 |
| 2 | Millbrook | 4 | 3 · 4 · 2 | 2 | Spider · Broodmother | 19,575 | 815 | 12 |
| 3 | Ashfall | 4 | 0 · 3 · 4 | 4 | Treant · Treant Elder | 27,360 | 1,103 | 12 |
| 4 | Ironrow | 4 | 0 · 3 · 4 | 4 | Elf · Elven Archmage | 60,495 | 2,367 | 12 |
| 5 | Wolf Cross | 4 | 3 · 3 · 2 | 2 | Troll · Elder Troll | 69,480 | 2,639 | 11 |
| 6 | Highspire | 4 | 0 · 3 · 4 | 4 | Orc · Warlord Orc | 79,395 | 2,931 | 12 |
| 7 | Bonegate | 5 | 2 · 3 · 3 | 3 | Kobold · Hoarder Kobold | 128,805 | 4,624 | 12 |
| 8 | Frosthold | 4 | 0 · 3 · 4 | 4 | Ogre · Ogre King | 144,075 | 5,034 | 12 |
| 9 | Vermolch | 4 | 1 · 2 · 3 | 3 | Wolf · Wolf King | 160,635 | 5,467 | 10 |
| 10 | Thornwake | 4 | 1 · 2 · 3 | 3 | Dragon · Ancient Dragon | 182,166 | 6,042 | 10 |
| 11 | Greyfen | 4 | 1 · 4 · 4 | 4 | Mummy · Mummy Lord | 204,578 | 6,617 | 14 |
| 12 | Saltmarrow | 3 | 1 · 3 · 3 | 3 | Skeleton · Bone Colossus | 227,869 | 7,193 | 11 |
| 13 | Emberhold | 4 | 2 · 4 · 4 | 4 | Vampire · Ancient Vampire | 252,042 | 7,768 | 15 |
| 14 | Duskmoor | 4 | 1 · 4 · 4 | 4 | Demon · Archdemon | 277,094 | 8,344 | 14 |
| 15 | Nettlecrag | 3 | 1 · 2 · 2 | 2 | Slime · Slime King | 303,027 | 8,919 | 8 |
| 16 | Blackwater Reach | 3 | 1 · 2 · 2 | 2 | Golem · Colossus | 329,841 | 9,495 | 8 |
| 17 | Wyrmback | 4 | 3 · 4 · 2 | 2 | Lizardman · Lizardman Chief | 357,535 | 10,070 | 12 |
| 18 | The Pale Spire | 4 | 1 · 3 · 4 | 4 | Human · Paladin | 386,109 | 10,645 | 13 |

| Zone | Sub-zone | Environment | Element | Races | Elite |
|---|---|---|---|---|---|
| 1 | Open Grassland | grassland | fire | Goblin · Wolf | Shaman Goblin |
| 1 | Village Outskirts | village | fire | Orc · Human | Juggernaut Orc |
| 1 | Raider Camp | camp | fire | Wolf · Goblin | Shaman Goblin |
| 2 | Fog Thicket | fog | poison | Goblin · Wolf | Shaman Goblin |
| 2 | Dark Grove | dark forest | poison | Spider · Werewolf | Alpha Werewolf |
| 2 | Spider Hollow | hollow | poison | Wolf · Goblin | Shaman Goblin |
| 3 | Glimmer Grove | grove | fire | Treant · Werewolf | Ancient Treant |
| 3 | Elder Rootway | rootway | fire | Elf · Dryad | Dark Elf |
| 3 | Moonlit Glade | glade | fire | Werewolf · Treant | Alpha Werewolf |
| 4 | Glimmer Grove | grove | lightning | Treant · Werewolf | Ancient Treant |
| 4 | Elder Rootway | rootway | lightning | Elf · Dryad | Dark Elf |
| 4 | Moonlit Glade | glade | lightning | Werewolf · Treant | Alpha Werewolf |
| 5 | Murky Swamp | swamp | cold | Troll · Spider | Stone Troll |
| 5 | Mud Flats | mud | cold | Slime · Lizardman | Shaman Lizardman |
| 5 | Poison Fen | poison fen | cold | Spider · Troll | Stone Troll |
| 6 | Mountain Slopes | mountain | cold | Orc · Dragon | Juggernaut Orc |
| 6 | Cliff Holds | cliff | lightning | Ogre · Giant | Mage Ogre |
| 6 | Dragon Peak | peak | cold | Dragon · Orc | Elder Dragon |
| 7 | Tunnels | tunnels | chaos | Kobold · Minotaur | Blood Minotaur |
| 7 | Deep Warrens | warrens | chaos | Troll · Spider | Stone Troll |
| 7 | Sunken Vault | vault | chaos | Minotaur · Golem | Blood Minotaur |
| 8 | Ash Fields | volcano | cold | Ogre · Golem | Mage Ogre |
| 8 | Slag Pit | lava | cold | Demon · Dragon | Demon Knight |
| 8 | Caldera | caldera | cold | Golem · Ogre | Crystal Golem |
| 9 | Snowfield | snow | poison | Troll · Dragon | Stone Troll |
| 9 | Glacier Shelf | ice | chaos | Wolf · Giant | Fire Giant |
| 9 | Rime Hollow | rime | poison | Dragon · Troll | Elder Dragon |
| 10 | Snowfield | snow | poison | Troll · Dragon | Stone Troll |
| 10 | Glacier Shelf | ice | poison | Wolf · Giant | Fire Giant |
| 10 | Rime Hollow | rime | poison | Dragon · Troll | Elder Dragon |
| 11 | Dune Sea | dunes | poison | Orc · Demon | Juggernaut Orc |
| 11 | Sunken Tombs | tombs | chaos | Mummy · Lizardman | Royal Mummy |
| 11 | Scorch Mesa | mesa | poison | Demon · Orc | Demon Knight |
| 12 | Outer Court | court | chaos | Skeleton · Vampire | Mage Skeleton |
| 12 | Burial Gallery | gallery | chaos | Mummy · Skeleton | Royal Mummy |
| 12 | Inner Sanctum | sanctum | chaos | Vampire · Mummy | Vampire Lord |
| 13 | Fallen Gate | gate | fire | Skeleton · Demon | Mage Skeleton |
| 13 | Market Ruins | market | fire | Vampire · Human | Vampire Lord |
| 13 | Noble Quarter | quarter | fire | Demon · Skeleton | Demon Knight |
| 14 | Blight Field | blight | cold | Skeleton · Demon | Mage Skeleton |
| 14 | Howling Waste | waste | chaos | Vampire · Werewolf | Vampire Lord |
| 14 | Rift Scar | rift | cold | Demon · Skeleton | Demon Knight |
| 15 | Bone Stair | stair | chaos | Demon · Golem | Demon Knight |
| 15 | Molten Deeps | deeps | poison | Slime · Demon | Demon Knight |
| 15 | Throne Abyss | abyss | chaos | Golem · Slime | Crystal Golem |
| 16 | Bone Stair | stair | poison | Demon · Golem | Demon Knight |
| 16 | Molten Deeps | deeps | poison | Slime · Demon | Demon Knight |
| 16 | Throne Abyss | abyss | poison | Golem · Slime | Crystal Golem |
| 17 | Tideflats | coast | fire | Ogre · Spider | Mage Ogre |
| 17 | Salt Cliffs | cliffs | cold | Slime · Lizardman | Shaman Lizardman |
| 17 | Sunken Reef | sea | fire | Spider · Ogre | Mage Ogre |
| 18 | Outer Colonnade | ruins | chaos | Golem · Human | Crystal Golem |
| 18 | Hall of Wardens | temple | poison | Dragon · Elf | Elder Dragon |
| 18 | Sanctum Depths | depths | chaos | Human · Golem | Mage |
<!-- END GENERATED:zone-cast -->

# Every Entry

<!-- BEGIN GENERATED:mob-roster -->
| id | Zone | Levels | Body | Species | innate Elements | HP (zone start → end) | damage/sec | accuracy | evasion | armour | res | crit | dodge | status gate | XP/kill | group | line | drops | phys/elem |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| z1_goblin_small | 1 | 1-10 | Small | Goblin | fire | 87 → 454 | 16 | 118 | 58 | 280 | 5.3% | 5.9% | 35.7% | 5.3% | 10 - 100 | 1-2 | front | weapon | 100/0 |
| z1_goblin_medium | 1 | 1-10 | Medium | Goblin | fire | 124 → 648 | 23 | 118 | 53 | 280 | 5.3% | 5.9% | 35.7% | 5.3% | 10 - 100 | 1-2 | front | weapon | 100/0 |
| z1_goblin_large | 1 | 1-10 | Large | Goblin | fire | 210 → 1,102 | 31 | 118 | 47 | 280 | 5.3% | 5.9% | 35.7% | 5.3% | 10 - 100 | alone | front | weapon | 100/0 |
| z1_goblin_elite | 1 | 1-10 | Elite | Goblin | fire | 720 → 3,774 | 90 | 118 | 47 | 280 | 5.3% | 5.9% | 35.7% | 5.3% | 30 - 300 | alone | front | weapon | 100/0 |
| z1_orc_medium | 1 | 1-10 | Medium | Orc | fire | 124 → 648 | 23 | 90 | 40 | 321 | 6.9% | 5.2% | 33.3% | 4.0% | 10 - 100 | 1-2 | front | weapon | 100/0 |
| z1_orc_large | 1 | 1-10 | Large | Orc | fire | 210 → 1,102 | 31 | 90 | 36 | 321 | 6.9% | 5.2% | 33.3% | 4.0% | 10 - 100 | alone | front | weapon | 100/0 |
| z1_orc_elite | 1 | 1-10 | Elite | Orc | fire | 720 → 3,774 | 90 | 90 | 36 | 321 | 6.9% | 5.2% | 33.3% | 4.0% | 30 - 300 | alone | front | weapon | 100/0 |
| z1_wolf_small | 1 | 1-10 | Small | Wolf | fire | 87 → 454 | 16 | 168 | 61 | 245 | 5.0% | 5.6% | 38.7% | 5.6% | 10 - 100 | 1-2 | front | weapon | 100/0 |
| z1_wolf_medium | 1 | 1-10 | Medium | Wolf | fire | 124 → 648 | 23 | 168 | 56 | 245 | 5.0% | 5.6% | 38.7% | 5.6% | 10 - 100 | 1-2 | front | weapon | 100/0 |
| z1_human_small | 1 | 1-10 | Small | Human | fire | 87 → 454 | 16 | 138 | 67 | 245 | 5.0% | 5.6% | 32.7% | 6.1% | 10 - 100 | 1-2 | front | weapon | 100/0 |
| z1_human_medium | 1 | 1-10 | Medium | Human | fire | 124 → 648 | 23 | 138 | 61 | 245 | 5.0% | 5.6% | 32.7% | 6.1% | 10 - 100 | 1-2 | front | weapon | 100/0 |
| z1_human_large | 1 | 1-10 | Large | Human | fire | 210 → 1,102 | 31 | 138 | 55 | 245 | 5.0% | 5.6% | 32.7% | 6.1% | 10 - 100 | alone | front | weapon | 100/0 |
| z1_human_elite | 1 | 1-10 | Elite | Human | fire | 720 → 3,774 | 90 | 138 | 55 | 245 | 5.0% | 5.6% | 32.7% | 6.1% | 30 - 300 | alone | front | weapon | 100/0 |
| z1_boss | 1 | 1-10 | Boss · Goblin King | Goblin | fire | 1,800 → 9,435 | 406 | 118 | 53 | 280 | 5.3% | 5.9% | 35.7% | 5.3% | 150 - 1,500 | alone | front | weapon | 100/0 |
| z2_goblin_small | 2 | 11-20 | Small | Goblin | poison | 549 → 981 | 34 | 118 | 58 | 280 | 5.3% | 5.9% | 28.6% | 5.3% | 110 - 200 | 1-2 | front | weapon | 100/0 |
| z2_goblin_medium | 2 | 11-20 | Medium | Goblin | poison | 784 → 1,401 | 49 | 118 | 53 | 280 | 5.3% | 5.9% | 28.6% | 5.3% | 110 - 200 | 1-2 | front | weapon | 100/0 |
| z2_goblin_large | 2 | 11-20 | Large | Goblin | poison | 1,332 → 2,381 | 66 | 118 | 47 | 280 | 5.3% | 5.9% | 28.6% | 5.3% | 110 - 200 | alone | front | weapon | 100/0 |
| z2_goblin_elite | 2 | 11-20 | Elite | Goblin | poison | 4,380 → 7,830 | 181 | 118 | 47 | 280 | 5.3% | 5.9% | 28.6% | 5.3% | 330 - 600 | alone | front | weapon | 100/0 |
| z2_spider_small | 2 | 11-20 | Small | Spider | poison | 549 → 981 | 34 | 101 | 74 | 156 | 4.4% | 6.1% | 31.3% | 6.7% | 110 - 200 | 1-2 | front | armour only | 100/0 |
| z2_spider_medium | 2 | 11-20 | Medium | Spider | poison | 784 → 1,401 | 49 | 101 | 67 | 156 | 4.4% | 6.1% | 31.3% | 6.7% | 110 - 200 | 1-2 | front | armour only | 100/0 |
| z2_wolf_small | 2 | 11-20 | Small | Wolf | poison | 549 → 981 | 34 | 168 | 61 | 245 | 5.0% | 5.6% | 31.3% | 5.6% | 110 - 200 | 1-2 | front | weapon | 100/0 |
| z2_wolf_medium | 2 | 11-20 | Medium | Wolf | poison | 784 → 1,401 | 49 | 168 | 56 | 245 | 5.0% | 5.6% | 31.3% | 5.6% | 110 - 200 | 1-2 | front | weapon | 100/0 |
| z2_werewolf_medium | 2 | 11-20 | Medium | Werewolf | poison | 784 → 1,401 | 49 | 145 | 48 | 284 | 6.0% | 5.4% | 28.9% | 4.8% | 110 - 200 | 1-2 | front | weapon | 100/0 |
| z2_werewolf_large | 2 | 11-20 | Large | Werewolf | poison | 1,332 → 2,381 | 66 | 145 | 43 | 284 | 6.0% | 5.4% | 28.9% | 4.8% | 110 - 200 | alone | front | weapon | 100/0 |
| z2_werewolf_elite | 2 | 11-20 | Elite | Werewolf | poison | 4,380 → 7,830 | 181 | 145 | 43 | 284 | 6.0% | 5.4% | 28.9% | 4.8% | 330 - 600 | alone | front | weapon | 100/0 |
| z2_boss | 2 | 11-20 | Boss · Broodmother | Spider | poison | 10,950 → 19,575 | 815 | 101 | 67 | 156 | 4.4% | 6.1% | 31.3% | 6.7% | 1,650 - 3,000 | alone | front | armour only | 100/0 |
| z3_treant_large | 3 | 21-30 | Large | Treant | fire | 1,907 → 2,423 | 65 | 30 | 37 | 334 | 8.2% | 4.3% | 16.2% | 4.1% | 210 - 300 | alone | front | weapon | 100/0 |
| z3_treant_elite | 3 | 21-30 | Elite | Treant | fire | 8,616 → 10,944 | 245 | 30 | 37 | 334 | 8.2% | 4.3% | 16.2% | 4.1% | 630 - 900 | alone | front | weapon | 100/0 |
| z3_elf_medium | 3 | 21-30 | Medium | Elf | fire | 1,122 → 1,425 | 48 | 203 | 68 | 186 | 4.2% | 5.2% | 23.4% | 6.8% | 210 - 300 | 1-2 | stand-off | weapon | 50/50 |
| z3_elf_large | 3 | 21-30 | Large | Elf | fire | 1,907 → 2,423 | 65 | 203 | 61 | 186 | 4.2% | 5.2% | 23.4% | 6.8% | 210 - 300 | alone | stand-off | weapon | 50/50 |
| z3_elf_elite | 3 | 21-30 | Elite | Elf | fire | 8,616 → 10,944 | 245 | 203 | 61 | 186 | 4.2% | 5.2% | 23.4% | 6.8% | 630 - 900 | alone | stand-off | weapon | 50/50 |
| z3_werewolf_medium | 3 | 21-30 | Medium | Werewolf | fire | 1,122 → 1,425 | 48 | 145 | 48 | 284 | 6.0% | 5.4% | 24.1% | 4.8% | 210 - 300 | 1-2 | front | weapon | 100/0 |
| z3_werewolf_large | 3 | 21-30 | Large | Werewolf | fire | 1,907 → 2,423 | 65 | 145 | 43 | 284 | 6.0% | 5.4% | 24.1% | 4.8% | 210 - 300 | alone | front | weapon | 100/0 |
| z3_werewolf_elite | 3 | 21-30 | Elite | Werewolf | fire | 8,616 → 10,944 | 245 | 145 | 43 | 284 | 6.0% | 5.4% | 24.1% | 4.8% | 630 - 900 | alone | front | weapon | 100/0 |
| z3_dryad_medium | 3 | 21-30 | Medium | Dryad | fire | 1,122 → 1,425 | 48 | 95 | 63 | 158 | 4.8% | 5.3% | 20.5% | 6.3% | 210 - 300 | 1-2 | stand-off | armour only | 0/100 |
| z3_dryad_large | 3 | 21-30 | Large | Dryad | fire | 1,907 → 2,423 | 65 | 95 | 57 | 158 | 4.8% | 5.3% | 20.5% | 6.3% | 210 - 300 | alone | stand-off | armour only | 0/100 |
| z3_dryad_elite | 3 | 21-30 | Elite | Dryad | fire | 8,616 → 10,944 | 245 | 95 | 57 | 158 | 4.8% | 5.3% | 20.5% | 6.3% | 630 - 900 | alone | stand-off | armour only | 0/100 |
| z3_boss | 3 | 21-30 | Boss · Treant Elder | Treant | fire | 21,540 → 27,360 | 1,103 | 30 | 41 | 334 | 8.2% | 4.3% | 16.2% | 4.1% | 3,150 - 4,500 | alone | front | weapon | 100/0 |
| z4_treant_large | 4 | 31-40 | Large | Treant | lightning | 4,710 → 5,356 | 139 | 30 | 37 | 334 | 8.2% | 4.3% | 13.7% | 4.1% | 310 - 400 | alone | front | weapon | 100/0 |
| z4_treant_elite | 4 | 31-40 | Elite | Treant | lightning | 21,276 → 24,198 | 526 | 30 | 37 | 334 | 8.2% | 4.3% | 13.7% | 4.1% | 930 - 1,200 | alone | front | weapon | 100/0 |
| z4_elf_medium | 4 | 31-40 | Medium | Elf | lightning | 2,770 → 3,151 | 103 | 203 | 68 | 186 | 4.2% | 5.2% | 20.0% | 6.8% | 310 - 400 | 2-3 | stand-off | weapon | 50/50 |
| z4_elf_large | 4 | 31-40 | Large | Elf | lightning | 4,710 → 5,356 | 139 | 203 | 61 | 186 | 4.2% | 5.2% | 20.0% | 6.8% | 310 - 400 | alone | stand-off | weapon | 50/50 |
| z4_elf_elite | 4 | 31-40 | Elite | Elf | lightning | 21,276 → 24,198 | 526 | 203 | 61 | 186 | 4.2% | 5.2% | 20.0% | 6.8% | 930 - 1,200 | alone | stand-off | weapon | 50/50 |
| z4_werewolf_medium | 4 | 31-40 | Medium | Werewolf | lightning | 2,770 → 3,151 | 103 | 145 | 48 | 284 | 6.0% | 5.4% | 20.7% | 4.8% | 310 - 400 | 2-3 | front | weapon | 100/0 |
| z4_werewolf_large | 4 | 31-40 | Large | Werewolf | lightning | 4,710 → 5,356 | 139 | 145 | 43 | 284 | 6.0% | 5.4% | 20.7% | 4.8% | 310 - 400 | alone | front | weapon | 100/0 |
| z4_werewolf_elite | 4 | 31-40 | Elite | Werewolf | lightning | 21,276 → 24,198 | 526 | 145 | 43 | 284 | 6.0% | 5.4% | 20.7% | 4.8% | 930 - 1,200 | alone | front | weapon | 100/0 |
| z4_dryad_medium | 4 | 31-40 | Medium | Dryad | lightning | 2,770 → 3,151 | 103 | 95 | 63 | 158 | 4.8% | 5.3% | 17.4% | 6.3% | 310 - 400 | 2-3 | stand-off | armour only | 0/100 |
| z4_dryad_large | 4 | 31-40 | Large | Dryad | lightning | 4,710 → 5,356 | 139 | 95 | 57 | 158 | 4.8% | 5.3% | 17.4% | 6.3% | 310 - 400 | alone | stand-off | armour only | 0/100 |
| z4_dryad_elite | 4 | 31-40 | Elite | Dryad | lightning | 21,276 → 24,198 | 526 | 95 | 57 | 158 | 4.8% | 5.3% | 17.4% | 6.3% | 930 - 1,200 | alone | stand-off | armour only | 0/100 |
| z4_boss | 4 | 31-40 | Boss · Elven Archmage | Elf | lightning | 53,190 → 60,495 | 2,367 | 203 | 68 | 186 | 4.2% | 5.2% | 20.0% | 6.8% | 4,650 - 6,000 | alone | stand-off | weapon | 50/50 |
| z5_troll_large | 5 | 41-50 | Large | Troll | cold | 7,529 → 8,526 | 214 | 60 | 36 | 299 | 8.0% | 5.2% | 13.6% | 4.0% | 410 - 500 | alone | front | weapon | 100/0 |
| z5_troll_elite | 5 | 41-50 | Elite | Troll | cold | 24,540 → 27,792 | 587 | 60 | 36 | 299 | 8.0% | 5.2% | 13.6% | 4.0% | 1,230 - 1,500 | alone | front | weapon | 100/0 |
| z5_slime_small | 5 | 41-50 | Small | Slime | cold | 3,100 → 3,511 | 111 | 6 | 44 | 158 | 7.9% | 5.6% | 10.4% | 4.0% | 410 - 500 | 2-3 | front | armour only | 0/100 |
| z5_slime_medium | 5 | 41-50 | Medium | Slime | cold | 4,429 → 5,016 | 159 | 6 | 40 | 158 | 7.9% | 5.6% | 10.4% | 4.0% | 410 - 500 | 2-3 | front | armour only | 0/100 |
| z5_spider_small | 5 | 41-50 | Small | Spider | cold | 3,100 → 3,511 | 111 | 101 | 74 | 156 | 4.4% | 6.1% | 19.8% | 6.7% | 410 - 500 | 2-3 | front | armour only | 100/0 |
| z5_spider_medium | 5 | 41-50 | Medium | Spider | cold | 4,429 → 5,016 | 159 | 101 | 67 | 156 | 4.4% | 6.1% | 19.8% | 6.7% | 410 - 500 | 2-3 | front | armour only | 100/0 |
| z5_lizardman_small | 5 | 41-50 | Small | Lizardman | cold | 3,100 → 3,511 | 111 | 116 | 57 | 252 | 5.4% | 6.3% | 18.9% | 5.2% | 410 - 500 | 2-3 | front | weapon | 100/0 |
| z5_lizardman_medium | 5 | 41-50 | Medium | Lizardman | cold | 4,429 → 5,016 | 159 | 116 | 52 | 252 | 5.4% | 6.3% | 18.9% | 5.2% | 410 - 500 | 2-3 | front | weapon | 100/0 |
| z5_lizardman_large | 5 | 41-50 | Large | Lizardman | cold | 7,529 → 8,526 | 214 | 116 | 46 | 252 | 5.4% | 6.3% | 18.9% | 5.2% | 410 - 500 | alone | front | weapon | 100/0 |
| z5_lizardman_elite | 5 | 41-50 | Elite | Lizardman | cold | 24,540 → 27,792 | 587 | 116 | 46 | 252 | 5.4% | 6.3% | 18.9% | 5.2% | 1,230 - 1,500 | alone | front | weapon | 100/0 |
| z5_boss | 5 | 41-50 | Boss · Elder Troll | Troll | cold | 61,350 → 69,480 | 2,639 | 60 | 40 | 299 | 8.0% | 5.2% | 13.6% | 4.0% | 6,150 - 7,500 | alone | front | weapon | 100/0 |
| z6_orc_medium | 6 | 51-60 | Medium | Orc | cold | 3,669 → 4,135 | 127 | 90 | 40 | 321 | 6.9% | 5.2% | 14.5% | 4.0% | 510 - 600 | 2-3 | front | weapon | 100/0 |
| z6_orc_large | 6 | 51-60 | Large | Orc | cold | 6,237 → 7,030 | 172 | 90 | 36 | 321 | 6.9% | 5.2% | 14.5% | 4.0% | 510 - 600 | alone | front | weapon | 100/0 |
| z6_orc_elite | 6 | 51-60 | Elite | Orc | cold | 28,176 → 31,758 | 651 | 90 | 36 | 321 | 6.9% | 5.2% | 14.5% | 4.0% | 1,530 - 1,800 | alone | front | weapon | 100/0 |
| z6_ogre_medium | 6 | 51-60 | Medium | Ogre | cold | 3,669 → 4,135 | 127 | 60 | 40 | 310 | 7.5% | 5.2% | 13.3% | 4.0% | 510 - 600 | 2-3 | front | weapon | 100/0 |
| z6_ogre_large | 6 | 51-60 | Large | Ogre | cold | 6,237 → 7,030 | 172 | 60 | 36 | 310 | 7.5% | 5.2% | 13.3% | 4.0% | 510 - 600 | alone | front | weapon | 100/0 |
| z6_ogre_elite | 6 | 51-60 | Elite | Ogre | cold | 28,176 → 31,758 | 651 | 60 | 36 | 310 | 7.5% | 5.2% | 13.3% | 4.0% | 1,530 - 1,800 | alone | front | weapon | 100/0 |
| z6_dragon_medium | 6 | 51-60 | Medium | Dragon | cold | 3,669 → 4,135 | 127 | 132 | 44 | 321 | 7.0% | 4.1% | 11.1% | 4.4% | 510 - 600 | 2-3 | stand-off | weapon | 50/50 |
| z6_dragon_large | 6 | 51-60 | Large | Dragon | cold | 6,237 → 7,030 | 172 | 132 | 40 | 321 | 7.0% | 4.1% | 11.1% | 4.4% | 510 - 600 | alone | stand-off | weapon | 50/50 |
| z6_dragon_elite | 6 | 51-60 | Elite | Dragon | cold | 28,176 → 31,758 | 651 | 132 | 40 | 321 | 7.0% | 4.1% | 11.1% | 4.4% | 1,530 - 1,800 | alone | stand-off | weapon | 50/50 |
| z6_giant_large | 6 | 51-60 | Large | Giant | cold | 6,237 → 7,030 | 172 | 30 | 37 | 345 | 7.6% | 4.3% | 11.7% | 4.1% | 510 - 600 | alone | front | weapon | 100/0 |
| z6_giant_elite | 6 | 51-60 | Elite | Giant | cold | 28,176 → 31,758 | 651 | 30 | 37 | 345 | 7.6% | 4.3% | 11.7% | 4.1% | 1,530 - 1,800 | alone | front | weapon | 100/0 |
| z6_boss | 6 | 51-60 | Boss · Warlord Orc | Orc | cold | 70,440 → 79,395 | 2,931 | 90 | 40 | 321 | 6.9% | 5.2% | 14.5% | 4.0% | 7,650 - 9,000 | alone | front | weapon | 100/0 |
| z7_kobold_small | 7 | 61-70 | Small | Kobold | chaos | 5,311 → 5,893 | 176 | 86 | 63 | 232 | 4.6% | 6.6% | 15.7% | 5.7% | 610 - 700 | 3-5 | front | weapon | 100/0 |
| z7_kobold_medium | 7 | 61-70 | Medium | Kobold | chaos | 7,587 → 8,419 | 252 | 86 | 57 | 232 | 4.6% | 6.6% | 15.7% | 5.7% | 610 - 700 | 3-5 | front | weapon | 100/0 |
| z7_troll_large | 7 | 61-70 | Large | Troll | chaos | 12,898 → 14,312 | 340 | 60 | 36 | 299 | 8.0% | 5.2% | 10.7% | 4.0% | 610 - 700 | alone | front | weapon | 100/0 |
| z7_troll_elite | 7 | 61-70 | Elite | Troll | chaos | 46,434 → 51,522 | 1,028 | 60 | 36 | 299 | 8.0% | 5.2% | 10.7% | 4.0% | 1,830 - 2,100 | alone | front | weapon | 100/0 |
| z7_minotaur_medium | 7 | 61-70 | Medium | Minotaur | chaos | 7,587 → 8,419 | 252 | 98 | 43 | 297 | 6.3% | 4.9% | 12.5% | 4.3% | 610 - 700 | 3-5 | front | weapon | 100/0 |
| z7_minotaur_large | 7 | 61-70 | Large | Minotaur | chaos | 12,898 → 14,312 | 340 | 98 | 39 | 297 | 6.3% | 4.9% | 12.5% | 4.3% | 610 - 700 | alone | front | weapon | 100/0 |
| z7_minotaur_elite | 7 | 61-70 | Elite | Minotaur | chaos | 46,434 → 51,522 | 1,028 | 98 | 39 | 297 | 6.3% | 4.9% | 12.5% | 4.3% | 1,830 - 2,100 | alone | front | weapon | 100/0 |
| z7_spider_small | 7 | 61-70 | Small | Spider | chaos | 5,311 → 5,893 | 176 | 101 | 74 | 156 | 4.4% | 6.1% | 15.9% | 6.7% | 610 - 700 | 3-5 | front | armour only | 100/0 |
| z7_spider_medium | 7 | 61-70 | Medium | Spider | chaos | 7,587 → 8,419 | 252 | 101 | 67 | 156 | 4.4% | 6.1% | 15.9% | 6.7% | 610 - 700 | 3-5 | front | armour only | 100/0 |
| z7_golem_large | 7 | 61-70 | Large | Golem | chaos | 12,898 → 14,312 | 340 | 30 | 37 | 369 | 8.4% | 3.5% | 7.8% | 4.1% | 610 - 700 | alone | front | weapon | 100/0 |
| z7_golem_elite | 7 | 61-70 | Elite | Golem | chaos | 46,434 → 51,522 | 1,028 | 30 | 37 | 369 | 8.4% | 3.5% | 7.8% | 4.1% | 1,830 - 2,100 | alone | front | weapon | 100/0 |
| z7_boss | 7 | 61-70 | Boss · Hoarder Kobold | Kobold | chaos | 116,085 → 128,805 | 4,624 | 86 | 57 | 232 | 4.6% | 6.6% | 15.7% | 5.7% | 9,150 - 10,500 | alone | front | weapon | 100/0 |
| z8_ogre_medium | 8 | 71-80 | Medium | Ogre | cold | 6,785 → 7,504 | 218 | 60 | 40 | 310 | 7.5% | 5.2% | 10.8% | 4.0% | 710 - 800 | 3-5 | front | weapon | 100/0 |
| z8_ogre_large | 8 | 71-80 | Large | Ogre | cold | 11,535 → 12,757 | 295 | 60 | 36 | 310 | 7.5% | 5.2% | 10.8% | 4.0% | 710 - 800 | alone | front | weapon | 100/0 |
| z8_ogre_elite | 8 | 71-80 | Elite | Ogre | cold | 52,110 → 57,630 | 1,119 | 60 | 36 | 310 | 7.5% | 5.2% | 10.8% | 4.0% | 2,130 - 2,400 | alone | front | weapon | 100/0 |
| z8_demon_medium | 8 | 71-80 | Medium | Demon | cold | 6,785 → 7,504 | 218 | 106 | 47 | 254 | 5.8% | 4.7% | 10.9% | 4.7% | 710 - 800 | 3-5 | stand-off | weapon | 50/50 |
| z8_demon_large | 8 | 71-80 | Large | Demon | cold | 11,535 → 12,757 | 295 | 106 | 42 | 254 | 5.8% | 4.7% | 10.9% | 4.7% | 710 - 800 | alone | stand-off | weapon | 50/50 |
| z8_demon_elite | 8 | 71-80 | Elite | Demon | cold | 52,110 → 57,630 | 1,119 | 106 | 42 | 254 | 5.8% | 4.7% | 10.9% | 4.7% | 2,130 - 2,400 | alone | stand-off | weapon | 50/50 |
| z8_golem_large | 8 | 71-80 | Large | Golem | cold | 11,535 → 12,757 | 295 | 30 | 37 | 369 | 8.4% | 3.5% | 7.1% | 4.1% | 710 - 800 | alone | front | weapon | 100/0 |
| z8_golem_elite | 8 | 71-80 | Elite | Golem | cold | 52,110 → 57,630 | 1,119 | 30 | 37 | 369 | 8.4% | 3.5% | 7.1% | 4.1% | 2,130 - 2,400 | alone | front | weapon | 100/0 |
| z8_dragon_medium | 8 | 71-80 | Medium | Dragon | cold | 6,785 → 7,504 | 218 | 132 | 44 | 321 | 7.0% | 4.1% | 9.0% | 4.4% | 710 - 800 | 3-5 | stand-off | weapon | 50/50 |
| z8_dragon_large | 8 | 71-80 | Large | Dragon | cold | 11,535 → 12,757 | 295 | 132 | 40 | 321 | 7.0% | 4.1% | 9.0% | 4.4% | 710 - 800 | alone | stand-off | weapon | 50/50 |
| z8_dragon_elite | 8 | 71-80 | Elite | Dragon | cold | 52,110 → 57,630 | 1,119 | 132 | 40 | 321 | 7.0% | 4.1% | 9.0% | 4.4% | 2,130 - 2,400 | alone | stand-off | weapon | 50/50 |
| z8_boss | 8 | 71-80 | Boss · Ogre King | Ogre | cold | 130,275 → 144,075 | 5,034 | 60 | 40 | 310 | 7.5% | 5.2% | 10.8% | 4.0% | 10,650 - 12,000 | alone | front | weapon | 100/0 |
| z9_troll_large | 9 | 81-90 | Large | Troll | chaos/poison | 14,741 → 16,255 | 366 | 60 | 36 | 299 | 8.0% | 5.2% | 8.9% | 4.0% | 810 - 900 | alone | front | weapon | 100/0 |
| z9_troll_elite | 9 | 81-90 | Elite | Troll | chaos/poison | 58,272 → 64,254 | 1,215 | 60 | 36 | 299 | 8.0% | 5.2% | 8.9% | 4.0% | 2,430 - 2,700 | alone | front | weapon | 100/0 |
| z9_wolf_small | 9 | 81-90 | Small | Wolf | chaos/poison | 6,070 → 6,693 | 190 | 168 | 61 | 245 | 5.0% | 5.6% | 13.3% | 5.6% | 810 - 900 | 3-5 | front | weapon | 100/0 |
| z9_wolf_medium | 9 | 81-90 | Medium | Wolf | chaos/poison | 8,671 → 9,562 | 271 | 168 | 56 | 245 | 5.0% | 5.6% | 13.3% | 5.6% | 810 - 900 | 3-5 | front | weapon | 100/0 |
| z9_dragon_medium | 9 | 81-90 | Medium | Dragon | poison | 8,671 → 9,562 | 271 | 132 | 44 | 321 | 7.0% | 4.1% | 8.2% | 4.4% | 810 - 900 | 3-5 | stand-off | weapon | 50/50 |
| z9_dragon_large | 9 | 81-90 | Large | Dragon | poison | 14,741 → 16,255 | 366 | 132 | 40 | 321 | 7.0% | 4.1% | 8.2% | 4.4% | 810 - 900 | alone | stand-off | weapon | 50/50 |
| z9_dragon_elite | 9 | 81-90 | Elite | Dragon | poison | 58,272 → 64,254 | 1,215 | 132 | 40 | 321 | 7.0% | 4.1% | 8.2% | 4.4% | 2,430 - 2,700 | alone | stand-off | weapon | 50/50 |
| z9_giant_large | 9 | 81-90 | Large | Giant | poison | 14,741 → 16,255 | 366 | 30 | 37 | 345 | 7.6% | 4.3% | 8.7% | 4.1% | 810 - 900 | alone | front | weapon | 100/0 |
| z9_giant_elite | 9 | 81-90 | Elite | Giant | poison | 58,272 → 64,254 | 1,215 | 30 | 37 | 345 | 7.6% | 4.3% | 8.7% | 4.1% | 2,430 - 2,700 | alone | front | weapon | 100/0 |
| z9_boss | 9 | 81-90 | Boss · Wolf King | Wolf | chaos/poison | 145,680 → 160,635 | 5,467 | 168 | 56 | 245 | 5.0% | 5.6% | 13.3% | 5.6% | 12,150 - 13,500 | alone | front | weapon | 100/0 |
| z10_troll_large | 10 | 91-100 | Large | Troll | poison | 16,469 → 18,433 | 405 | 60 | 36 | 299 | 8.0% | 5.2% | 8.2% | 4.0% | 910 - 1,000 | alone | front | weapon | 100/0 |
| z10_troll_elite | 10 | 91-100 | Elite | Troll | poison | 65,099 → 72,866 | 1,343 | 60 | 36 | 299 | 8.0% | 5.2% | 8.2% | 4.0% | 2,730 - 3,000 | alone | front | weapon | 100/0 |
| z10_wolf_small | 10 | 91-100 | Small | Wolf | poison | 6,781 → 7,590 | 210 | 168 | 61 | 245 | 5.0% | 5.6% | 12.3% | 5.6% | 910 - 1,000 | 1-2 | front | weapon | 100/0 |
| z10_wolf_medium | 10 | 91-100 | Medium | Wolf | poison | 9,687 → 10,843 | 300 | 168 | 56 | 245 | 5.0% | 5.6% | 12.3% | 5.6% | 910 - 1,000 | 1-2 | front | weapon | 100/0 |
| z10_dragon_medium | 10 | 91-100 | Medium | Dragon | poison | 9,687 → 10,843 | 300 | 132 | 44 | 321 | 7.0% | 4.1% | 7.6% | 4.4% | 910 - 1,000 | 1-2 | stand-off | weapon | 50/50 |
| z10_dragon_large | 10 | 91-100 | Large | Dragon | poison | 16,469 → 18,433 | 405 | 132 | 40 | 321 | 7.0% | 4.1% | 7.6% | 4.4% | 910 - 1,000 | alone | stand-off | weapon | 50/50 |
| z10_dragon_elite | 10 | 91-100 | Elite | Dragon | poison | 65,099 → 72,866 | 1,343 | 132 | 40 | 321 | 7.0% | 4.1% | 7.6% | 4.4% | 2,730 - 3,000 | alone | stand-off | weapon | 50/50 |
| z10_giant_large | 10 | 91-100 | Large | Giant | poison | 16,469 → 18,433 | 405 | 30 | 37 | 345 | 7.6% | 4.3% | 8.0% | 4.1% | 910 - 1,000 | alone | front | weapon | 100/0 |
| z10_giant_elite | 10 | 91-100 | Elite | Giant | poison | 65,099 → 72,866 | 1,343 | 30 | 37 | 345 | 7.6% | 4.3% | 8.0% | 4.1% | 2,730 - 3,000 | alone | front | weapon | 100/0 |
| z10_boss | 10 | 91-100 | Boss · Ancient Dragon | Dragon | poison | 162,748 → 182,166 | 6,042 | 132 | 44 | 321 | 7.0% | 4.1% | 7.6% | 4.4% | 13,650 - 15,000 | alone | stand-off | weapon | 50/50 |
| z11_orc_medium | 11 | 101-110 | Medium | Orc | chaos | 10,909 → 12,105 | 326 | 90 | 40 | 321 | 6.9% | 5.2% | 9.7% | 4.0% | 1,010 - 1,100 | 1-2 | front | weapon | 100/0 |
| z11_orc_large | 11 | 101-110 | Large | Orc | chaos | 18,546 → 20,579 | 441 | 90 | 36 | 321 | 6.9% | 5.2% | 9.7% | 4.0% | 1,010 - 1,100 | alone | front | weapon | 100/0 |
| z11_orc_elite | 11 | 101-110 | Elite | Orc | chaos | 73,747 → 81,831 | 1,471 | 90 | 36 | 321 | 6.9% | 5.2% | 9.7% | 4.0% | 3,030 - 3,300 | alone | front | weapon | 100/0 |
| z11_mummy_medium | 11 | 101-110 | Medium | Mummy | poison/chaos | 10,909 → 12,105 | 326 | 32 | 42 | 278 | 8.5% | 5.1% | 7.3% | 4.2% | 1,010 - 1,100 | 1-2 | stand-off | weapon | 100/0 |
| z11_mummy_large | 11 | 101-110 | Large | Mummy | poison/chaos | 18,546 → 20,579 | 441 | 32 | 38 | 278 | 8.5% | 5.1% | 7.3% | 4.2% | 1,010 - 1,100 | alone | stand-off | weapon | 100/0 |
| z11_mummy_elite | 11 | 101-110 | Elite | Mummy | poison/chaos | 73,747 → 81,831 | 1,471 | 32 | 38 | 278 | 8.5% | 5.1% | 7.3% | 4.2% | 3,030 - 3,300 | alone | stand-off | weapon | 100/0 |
| z11_demon_medium | 11 | 101-110 | Medium | Demon | chaos/poison | 10,909 → 12,105 | 326 | 106 | 47 | 254 | 5.8% | 4.7% | 9.0% | 4.7% | 1,010 - 1,100 | 1-2 | stand-off | weapon | 50/50 |
| z11_demon_large | 11 | 101-110 | Large | Demon | chaos/poison | 18,546 → 20,579 | 441 | 106 | 42 | 254 | 5.8% | 4.7% | 9.0% | 4.7% | 1,010 - 1,100 | alone | stand-off | weapon | 50/50 |
| z11_demon_elite | 11 | 101-110 | Elite | Demon | chaos/poison | 73,747 → 81,831 | 1,471 | 106 | 42 | 254 | 5.8% | 4.7% | 9.0% | 4.7% | 3,030 - 3,300 | alone | stand-off | weapon | 50/50 |
| z11_lizardman_small | 11 | 101-110 | Small | Lizardman | poison | 7,637 → 8,474 | 228 | 116 | 57 | 252 | 5.4% | 6.3% | 11.3% | 5.2% | 1,010 - 1,100 | 1-2 | front | weapon | 100/0 |
| z11_lizardman_medium | 11 | 101-110 | Medium | Lizardman | poison | 10,909 → 12,105 | 326 | 116 | 52 | 252 | 5.4% | 6.3% | 11.3% | 5.2% | 1,010 - 1,100 | 1-2 | front | weapon | 100/0 |
| z11_lizardman_large | 11 | 101-110 | Large | Lizardman | poison | 18,546 → 20,579 | 441 | 116 | 46 | 252 | 5.4% | 6.3% | 11.3% | 5.2% | 1,010 - 1,100 | alone | front | weapon | 100/0 |
| z11_lizardman_elite | 11 | 101-110 | Elite | Lizardman | poison | 73,747 → 81,831 | 1,471 | 116 | 46 | 252 | 5.4% | 6.3% | 11.3% | 5.2% | 3,030 - 3,300 | alone | front | weapon | 100/0 |
| z11_boss | 11 | 101-110 | Boss · Mummy Lord | Mummy | poison/chaos | 184,368 → 204,578 | 6,617 | 32 | 42 | 278 | 8.5% | 5.1% | 7.3% | 4.2% | 15,150 - 16,500 | alone | stand-off | weapon | 100/0 |
| z12_skeleton_small | 12 | 111-120 | Small | Skeleton | chaos | 8,776 → 9,667 | 254 | 34 | 50 | 267 | 8.5% | 4.9% | 6.7% | 4.6% | 1,110 - 1,200 | 1-2 | front | weapon | 100/0 |
| z12_skeleton_medium | 12 | 111-120 | Medium | Skeleton | chaos | 12,537 → 13,810 | 363 | 34 | 46 | 267 | 8.5% | 4.9% | 6.7% | 4.6% | 1,110 - 1,200 | 1-2 | front | weapon | 100/0 |
| z12_skeleton_large | 12 | 111-120 | Large | Skeleton | chaos | 21,314 → 23,477 | 490 | 34 | 41 | 267 | 8.5% | 4.9% | 6.7% | 4.6% | 1,110 - 1,200 | alone | front | weapon | 100/0 |
| z12_skeleton_elite | 12 | 111-120 | Elite | Skeleton | chaos | 82,747 → 91,148 | 1,598 | 34 | 41 | 267 | 8.5% | 4.9% | 6.7% | 4.6% | 3,330 - 3,600 | alone | front | weapon | 100/0 |
| z12_mummy_medium | 12 | 111-120 | Medium | Mummy | chaos | 12,537 → 13,810 | 363 | 32 | 42 | 278 | 8.5% | 5.1% | 7.1% | 4.2% | 1,110 - 1,200 | 1-2 | stand-off | weapon | 100/0 |
| z12_mummy_large | 12 | 111-120 | Large | Mummy | chaos | 21,314 → 23,477 | 490 | 32 | 38 | 278 | 8.5% | 5.1% | 7.1% | 4.2% | 1,110 - 1,200 | alone | stand-off | weapon | 100/0 |
| z12_mummy_elite | 12 | 111-120 | Elite | Mummy | chaos | 82,747 → 91,148 | 1,598 | 32 | 38 | 278 | 8.5% | 5.1% | 7.1% | 4.2% | 3,330 - 3,600 | alone | stand-off | weapon | 100/0 |
| z12_vampire_medium | 12 | 111-120 | Medium | Vampire | chaos | 12,537 → 13,810 | 363 | 116 | 52 | 249 | 5.4% | 5.2% | 10.2% | 5.2% | 1,110 - 1,200 | 1-2 | stand-off | weapon | 50/50 |
| z12_vampire_large | 12 | 111-120 | Large | Vampire | chaos | 21,314 → 23,477 | 490 | 116 | 46 | 249 | 5.4% | 5.2% | 10.2% | 5.2% | 1,110 - 1,200 | alone | stand-off | weapon | 50/50 |
| z12_vampire_elite | 12 | 111-120 | Elite | Vampire | chaos | 82,747 → 91,148 | 1,598 | 116 | 46 | 249 | 5.4% | 5.2% | 10.2% | 5.2% | 3,330 - 3,600 | alone | stand-off | weapon | 50/50 |
| z12_boss | 12 | 111-120 | Boss · Bone Colossus | Skeleton | chaos | 206,867 → 227,869 | 7,193 | 34 | 46 | 267 | 8.5% | 4.9% | 6.7% | 4.6% | 16,650 - 18,000 | alone | front | weapon | 100/0 |
| z13_skeleton_small | 13 | 121-130 | Small | Skeleton | fire | 10,179 → 11,143 | 286 | 34 | 50 | 267 | 8.5% | 4.9% | 6.5% | 4.6% | 1,210 - 1,300 | 2-3 | front | weapon | 100/0 |
| z13_skeleton_medium | 13 | 121-130 | Medium | Skeleton | fire | 14,542 → 15,918 | 409 | 34 | 46 | 267 | 8.5% | 4.9% | 6.5% | 4.6% | 1,210 - 1,300 | 2-3 | front | weapon | 100/0 |
| z13_skeleton_large | 13 | 121-130 | Large | Skeleton | fire | 24,721 → 27,061 | 552 | 34 | 41 | 267 | 8.5% | 4.9% | 6.5% | 4.6% | 1,210 - 1,300 | alone | front | weapon | 100/0 |
| z13_skeleton_elite | 13 | 121-130 | Elite | Skeleton | fire | 92,099 → 100,817 | 1,726 | 34 | 41 | 267 | 8.5% | 4.9% | 6.5% | 4.6% | 3,630 - 3,900 | alone | front | weapon | 100/0 |
| z13_vampire_medium | 13 | 121-130 | Medium | Vampire | fire | 14,542 → 15,918 | 409 | 116 | 52 | 249 | 5.4% | 5.2% | 9.9% | 5.2% | 1,210 - 1,300 | 2-3 | stand-off | weapon | 50/50 |
| z13_vampire_large | 13 | 121-130 | Large | Vampire | fire | 24,721 → 27,061 | 552 | 116 | 46 | 249 | 5.4% | 5.2% | 9.9% | 5.2% | 1,210 - 1,300 | alone | stand-off | weapon | 50/50 |
| z13_vampire_elite | 13 | 121-130 | Elite | Vampire | fire | 92,099 → 100,817 | 1,726 | 116 | 46 | 249 | 5.4% | 5.2% | 9.9% | 5.2% | 3,630 - 3,900 | alone | stand-off | weapon | 50/50 |
| z13_demon_medium | 13 | 121-130 | Medium | Demon | fire | 14,542 → 15,918 | 409 | 106 | 47 | 254 | 5.8% | 4.7% | 8.4% | 4.7% | 1,210 - 1,300 | 2-3 | stand-off | weapon | 50/50 |
| z13_demon_large | 13 | 121-130 | Large | Demon | fire | 24,721 → 27,061 | 552 | 106 | 42 | 254 | 5.8% | 4.7% | 8.4% | 4.7% | 1,210 - 1,300 | alone | stand-off | weapon | 50/50 |
| z13_demon_elite | 13 | 121-130 | Elite | Demon | fire | 92,099 → 100,817 | 1,726 | 106 | 42 | 254 | 5.8% | 4.7% | 8.4% | 4.7% | 3,630 - 3,900 | alone | stand-off | weapon | 50/50 |
| z13_human_small | 13 | 121-130 | Small | Human | fire | 10,179 → 11,143 | 286 | 138 | 67 | 245 | 5.0% | 5.6% | 8.9% | 6.1% | 1,210 - 1,300 | 2-3 | front | weapon | 100/0 |
| z13_human_medium | 13 | 121-130 | Medium | Human | fire | 14,542 → 15,918 | 409 | 138 | 61 | 245 | 5.0% | 5.6% | 8.9% | 6.1% | 1,210 - 1,300 | 2-3 | front | weapon | 100/0 |
| z13_human_large | 13 | 121-130 | Large | Human | fire | 24,721 → 27,061 | 552 | 138 | 55 | 245 | 5.0% | 5.6% | 8.9% | 6.1% | 1,210 - 1,300 | alone | front | weapon | 100/0 |
| z13_human_elite | 13 | 121-130 | Elite | Human | fire | 92,099 → 100,817 | 1,726 | 138 | 55 | 245 | 5.0% | 5.6% | 8.9% | 6.1% | 3,630 - 3,900 | alone | front | weapon | 100/0 |
| z13_boss | 13 | 121-130 | Boss · Ancient Vampire | Vampire | fire | 230,247 → 252,042 | 7,768 | 116 | 52 | 249 | 5.4% | 5.2% | 9.9% | 5.2% | 18,150 - 19,500 | alone | stand-off | weapon | 50/50 |
| z14_skeleton_small | 14 | 131-140 | Small | Skeleton | chaos | 10,542 → 11,477 | 288 | 34 | 50 | 267 | 8.5% | 4.9% | 6.3% | 4.6% | 1,310 - 1,400 | 2-3 | front | weapon | 100/0 |
| z14_skeleton_medium | 14 | 131-140 | Medium | Skeleton | chaos | 15,060 → 16,396 | 411 | 34 | 46 | 267 | 8.5% | 4.9% | 6.3% | 4.6% | 1,310 - 1,400 | 2-3 | front | weapon | 100/0 |
| z14_skeleton_large | 14 | 131-140 | Large | Skeleton | chaos | 25,601 → 27,873 | 555 | 34 | 41 | 267 | 8.5% | 4.9% | 6.3% | 4.6% | 1,310 - 1,400 | alone | front | weapon | 100/0 |
| z14_skeleton_elite | 14 | 131-140 | Elite | Skeleton | chaos | 101,803 → 110,838 | 1,854 | 34 | 41 | 267 | 8.5% | 4.9% | 6.3% | 4.6% | 3,930 - 4,200 | alone | front | weapon | 100/0 |
| z14_vampire_medium | 14 | 131-140 | Medium | Vampire | chaos | 15,060 → 16,396 | 411 | 116 | 52 | 249 | 5.4% | 5.2% | 9.7% | 5.2% | 1,310 - 1,400 | 2-3 | stand-off | weapon | 50/50 |
| z14_vampire_large | 14 | 131-140 | Large | Vampire | chaos | 25,601 → 27,873 | 555 | 116 | 46 | 249 | 5.4% | 5.2% | 9.7% | 5.2% | 1,310 - 1,400 | alone | stand-off | weapon | 50/50 |
| z14_vampire_elite | 14 | 131-140 | Elite | Vampire | chaos | 101,803 → 110,838 | 1,854 | 116 | 46 | 249 | 5.4% | 5.2% | 9.7% | 5.2% | 3,930 - 4,200 | alone | stand-off | weapon | 50/50 |
| z14_demon_medium | 14 | 131-140 | Medium | Demon | chaos/cold | 15,060 → 16,396 | 411 | 106 | 47 | 254 | 5.8% | 4.7% | 8.2% | 4.7% | 1,310 - 1,400 | 2-3 | stand-off | weapon | 50/50 |
| z14_demon_large | 14 | 131-140 | Large | Demon | chaos/cold | 25,601 → 27,873 | 555 | 106 | 42 | 254 | 5.8% | 4.7% | 8.2% | 4.7% | 1,310 - 1,400 | alone | stand-off | weapon | 50/50 |
| z14_demon_elite | 14 | 131-140 | Elite | Demon | chaos/cold | 101,803 → 110,838 | 1,854 | 106 | 42 | 254 | 5.8% | 4.7% | 8.2% | 4.7% | 3,930 - 4,200 | alone | stand-off | weapon | 50/50 |
| z14_werewolf_medium | 14 | 131-140 | Medium | Werewolf | cold | 15,060 → 16,396 | 411 | 145 | 48 | 284 | 6.0% | 5.4% | 10.0% | 4.8% | 1,310 - 1,400 | 2-3 | front | weapon | 100/0 |
| z14_werewolf_large | 14 | 131-140 | Large | Werewolf | cold | 25,601 → 27,873 | 555 | 145 | 43 | 284 | 6.0% | 5.4% | 10.0% | 4.8% | 1,310 - 1,400 | alone | front | weapon | 100/0 |
| z14_werewolf_elite | 14 | 131-140 | Elite | Werewolf | cold | 101,803 → 110,838 | 1,854 | 145 | 43 | 284 | 6.0% | 5.4% | 10.0% | 4.8% | 3,930 - 4,200 | alone | front | weapon | 100/0 |
| z14_boss | 14 | 131-140 | Boss · Archdemon | Demon | chaos/cold | 254,507 → 277,094 | 8,344 | 106 | 47 | 254 | 5.8% | 4.7% | 8.2% | 4.7% | 19,650 - 21,000 | alone | stand-off | weapon | 50/50 |
| z15_demon_medium | 15 | 141-150 | Medium | Demon | chaos/poison | 17,662 → 19,139 | 469 | 106 | 47 | 254 | 5.8% | 4.7% | 8.0% | 4.7% | 1,410 - 1,500 | 2-3 | stand-off | weapon | 50/50 |
| z15_demon_large | 15 | 141-150 | Large | Demon | chaos/poison | 30,025 → 32,536 | 634 | 106 | 42 | 254 | 5.8% | 4.7% | 8.0% | 4.7% | 1,410 - 1,500 | alone | stand-off | weapon | 50/50 |
| z15_demon_elite | 15 | 141-150 | Elite | Demon | chaos/poison | 111,859 → 121,211 | 1,982 | 106 | 42 | 254 | 5.8% | 4.7% | 8.0% | 4.7% | 4,230 - 4,500 | alone | stand-off | weapon | 50/50 |
| z15_slime_small | 15 | 141-150 | Small | Slime | chaos/poison | 12,363 → 13,397 | 329 | 6 | 44 | 158 | 7.9% | 5.6% | 5.3% | 4.0% | 1,410 - 1,500 | 2-3 | front | armour only | 0/100 |
| z15_slime_medium | 15 | 141-150 | Medium | Slime | chaos/poison | 17,662 → 19,139 | 469 | 6 | 40 | 158 | 7.9% | 5.6% | 5.3% | 4.0% | 1,410 - 1,500 | 2-3 | front | armour only | 0/100 |
| z15_golem_large | 15 | 141-150 | Large | Golem | chaos/poison | 30,025 → 32,536 | 634 | 30 | 37 | 369 | 8.4% | 3.5% | 5.1% | 4.1% | 1,410 - 1,500 | alone | front | weapon | 100/0 |
| z15_golem_elite | 15 | 141-150 | Elite | Golem | chaos/poison | 111,859 → 121,211 | 1,982 | 30 | 37 | 369 | 8.4% | 3.5% | 5.1% | 4.1% | 4,230 - 4,500 | alone | front | weapon | 100/0 |
| z15_boss | 15 | 141-150 | Boss · Slime King | Slime | chaos/poison | 279,648 → 303,027 | 8,919 | 6 | 40 | 158 | 7.9% | 5.6% | 5.3% | 4.0% | 21,150 - 22,500 | alone | front | armour only | 0/100 |
| z16_demon_medium | 16 | 151-160 | Medium | Demon | poison | 19,305 → 20,832 | 500 | 106 | 47 | 254 | 5.8% | 4.7% | 7.8% | 4.7% | 1,510 - 1,600 | 3-5 | stand-off | weapon | 50/50 |
| z16_demon_large | 16 | 151-160 | Large | Demon | poison | 32,819 → 35,415 | 675 | 106 | 42 | 254 | 5.8% | 4.7% | 7.8% | 4.7% | 1,510 - 1,600 | alone | stand-off | weapon | 50/50 |
| z16_demon_elite | 16 | 151-160 | Elite | Demon | poison | 122,268 → 131,936 | 2,110 | 106 | 42 | 254 | 5.8% | 4.7% | 7.8% | 4.7% | 4,530 - 4,800 | alone | stand-off | weapon | 50/50 |
| z16_slime_small | 16 | 151-160 | Small | Slime | poison | 13,514 → 14,582 | 350 | 6 | 44 | 158 | 7.9% | 5.6% | 5.2% | 4.0% | 1,510 - 1,600 | 3-5 | front | armour only | 0/100 |
| z16_slime_medium | 16 | 151-160 | Medium | Slime | poison | 19,305 → 20,832 | 500 | 6 | 40 | 158 | 7.9% | 5.6% | 5.2% | 4.0% | 1,510 - 1,600 | 3-5 | front | armour only | 0/100 |
| z16_golem_large | 16 | 151-160 | Large | Golem | poison | 32,819 → 35,415 | 675 | 30 | 37 | 369 | 8.4% | 3.5% | 5.0% | 4.1% | 1,510 - 1,600 | alone | front | weapon | 100/0 |
| z16_golem_elite | 16 | 151-160 | Elite | Golem | poison | 122,268 → 131,936 | 2,110 | 30 | 37 | 369 | 8.4% | 3.5% | 5.0% | 4.1% | 4,530 - 4,800 | alone | front | weapon | 100/0 |
| z16_boss | 16 | 151-160 | Boss · Colossus | Golem | poison | 305,669 → 329,841 | 9,495 | 30 | 41 | 369 | 8.4% | 3.5% | 5.0% | 4.1% | 22,650 - 24,000 | alone | front | weapon | 100/0 |
| z17_ogre_medium | 17 | 161-170 | Medium | Ogre | cold | 23,800 → 25,586 | 601 | 60 | 40 | 310 | 7.5% | 5.2% | 7.5% | 4.0% | 1,610 - 1,700 | 3-5 | front | weapon | 100/0 |
| z17_ogre_large | 17 | 161-170 | Large | Ogre | cold | 40,460 → 43,497 | 811 | 60 | 36 | 310 | 7.5% | 5.2% | 7.5% | 4.0% | 1,610 - 1,700 | alone | front | weapon | 100/0 |
| z17_ogre_elite | 17 | 161-170 | Elite | Ogre | cold | 133,028 → 143,014 | 2,238 | 60 | 36 | 310 | 7.5% | 5.2% | 7.5% | 4.0% | 4,830 - 5,100 | alone | front | weapon | 100/0 |
| z17_slime_small | 17 | 161-170 | Small | Slime | fire/cold | 16,660 → 17,910 | 420 | 6 | 44 | 158 | 7.9% | 5.6% | 5.1% | 4.0% | 1,610 - 1,700 | 3-5 | front | armour only | 0/100 |
| z17_slime_medium | 17 | 161-170 | Medium | Slime | fire/cold | 23,800 → 25,586 | 601 | 6 | 40 | 158 | 7.9% | 5.6% | 5.1% | 4.0% | 1,610 - 1,700 | 3-5 | front | armour only | 0/100 |
| z17_spider_small | 17 | 161-170 | Small | Spider | cold | 16,660 → 17,910 | 420 | 101 | 74 | 156 | 4.4% | 6.1% | 10.2% | 6.7% | 1,610 - 1,700 | 3-5 | front | armour only | 100/0 |
| z17_spider_medium | 17 | 161-170 | Medium | Spider | cold | 23,800 → 25,586 | 601 | 101 | 67 | 156 | 4.4% | 6.1% | 10.2% | 6.7% | 1,610 - 1,700 | 3-5 | front | armour only | 100/0 |
| z17_lizardman_small | 17 | 161-170 | Small | Lizardman | cold | 16,660 → 17,910 | 420 | 116 | 57 | 252 | 5.4% | 6.3% | 9.6% | 5.2% | 1,610 - 1,700 | 3-5 | front | weapon | 100/0 |
| z17_lizardman_medium | 17 | 161-170 | Medium | Lizardman | cold | 23,800 → 25,586 | 601 | 116 | 52 | 252 | 5.4% | 6.3% | 9.6% | 5.2% | 1,610 - 1,700 | 3-5 | front | weapon | 100/0 |
| z17_lizardman_large | 17 | 161-170 | Large | Lizardman | cold | 40,460 → 43,497 | 811 | 116 | 46 | 252 | 5.4% | 6.3% | 9.6% | 5.2% | 1,610 - 1,700 | alone | front | weapon | 100/0 |
| z17_lizardman_elite | 17 | 161-170 | Elite | Lizardman | cold | 133,028 → 143,014 | 2,238 | 116 | 46 | 252 | 5.4% | 6.3% | 9.6% | 5.2% | 4,830 - 5,100 | alone | front | weapon | 100/0 |
| z17_boss | 17 | 161-170 | Boss · Lizardman Chief | Lizardman | cold | 332,571 → 357,535 | 10,070 | 116 | 52 | 252 | 5.4% | 6.3% | 9.6% | 5.2% | 24,150 - 25,500 | alone | front | weapon | 100/0 |
| z18_golem_large | 18 | 171-180 | Large | Golem | chaos/poison | 35,632 → 38,179 | 697 | 30 | 37 | 369 | 8.4% | 3.5% | 4.7% | 4.1% | 1,710 - 1,800 | alone | front | weapon | 100/0 |
| z18_golem_elite | 18 | 171-180 | Elite | Golem | chaos/poison | 144,141 → 154,444 | 2,366 | 30 | 37 | 369 | 8.4% | 3.5% | 4.7% | 4.1% | 5,130 - 5,400 | alone | front | weapon | 100/0 |
| z18_dragon_medium | 18 | 171-180 | Medium | Dragon | poison | 20,960 → 22,458 | 516 | 132 | 44 | 321 | 7.0% | 4.1% | 6.0% | 4.4% | 1,710 - 1,800 | 3-5 | stand-off | weapon | 50/50 |
| z18_dragon_large | 18 | 171-180 | Large | Dragon | poison | 35,632 → 38,179 | 697 | 132 | 40 | 321 | 7.0% | 4.1% | 6.0% | 4.4% | 1,710 - 1,800 | alone | stand-off | weapon | 50/50 |
| z18_dragon_elite | 18 | 171-180 | Elite | Dragon | poison | 144,141 → 154,444 | 2,366 | 132 | 40 | 321 | 7.0% | 4.1% | 6.0% | 4.4% | 5,130 - 5,400 | alone | stand-off | weapon | 50/50 |
| z18_human_small | 18 | 171-180 | Small | Human | chaos | 14,672 → 15,721 | 361 | 138 | 67 | 245 | 5.0% | 5.6% | 7.8% | 6.1% | 1,710 - 1,800 | 3-5 | front | weapon | 100/0 |
| z18_human_medium | 18 | 171-180 | Medium | Human | chaos | 20,960 → 22,458 | 516 | 138 | 61 | 245 | 5.0% | 5.6% | 7.8% | 6.1% | 1,710 - 1,800 | 3-5 | front | weapon | 100/0 |
| z18_human_large | 18 | 171-180 | Large | Human | chaos | 35,632 → 38,179 | 697 | 138 | 55 | 245 | 5.0% | 5.6% | 7.8% | 6.1% | 1,710 - 1,800 | alone | front | weapon | 100/0 |
| z18_human_elite | 18 | 171-180 | Elite | Human | chaos | 144,141 → 154,444 | 2,366 | 138 | 55 | 245 | 5.0% | 5.6% | 7.8% | 6.1% | 5,130 - 5,400 | alone | front | weapon | 100/0 |
| z18_elf_medium | 18 | 171-180 | Medium | Elf | chaos/poison | 20,960 → 22,458 | 516 | 203 | 68 | 186 | 4.2% | 5.2% | 8.6% | 6.8% | 1,710 - 1,800 | 3-5 | stand-off | weapon | 50/50 |
| z18_elf_large | 18 | 171-180 | Large | Elf | chaos/poison | 35,632 → 38,179 | 697 | 203 | 61 | 186 | 4.2% | 5.2% | 8.6% | 6.8% | 1,710 - 1,800 | alone | stand-off | weapon | 50/50 |
| z18_elf_elite | 18 | 171-180 | Elite | Elf | chaos/poison | 144,141 → 154,444 | 2,366 | 203 | 61 | 186 | 4.2% | 5.2% | 8.6% | 6.8% | 5,130 - 5,400 | alone | stand-off | weapon | 50/50 |
| z18_boss | 18 | 171-180 | Boss · Paladin | Human | chaos | 360,353 → 386,109 | 10,645 | 138 | 61 | 245 | 5.0% | 5.6% | 7.8% | 6.1% | 25,650 - 27,000 | alone | front | weapon | 100/0 |

Every row is the mob's own stat block at the zone's **last** level (`mob stat = 108` × the species vector, flat with no level term), then by the body class: accuracy = Dex line × 1.5 × accuracy tier · evasion = Dex × 0.5 × body · armour = Str × 2 · res = Vit × 0.05 · crit = Lck × 0.05 · dodge = own Agi rate ÷ (rate + a same-level attacker's accuracy) (X24). HP is `mob_HP(L) × body` at both ends of the range, so a mob mid-range interpolates. XP is `10 × the mob's own level` with elite ×3 and boss ×15 (world.md XP), printed as a range because a mob spawns at the attacker's level, so it is read at both ends of the zone. `status gate` is the mob's own Elemental Alignment (`Dex × 0.05`, no Cap), the number that decides how often its innate Element status actually lands (combat.md section 2 step 9). A mob spawns at the attacker's level clamped into its zone's range; its innate Element is rolled with the species bias at ×3 against any other Element the zone carries at ×1; and `drops: weapon` means the lineage is allowed to be the source of a weapon-slot piece; `armour only` species still drop every other slot, so the 8% base drop rate, the quality floors and the whole stone funnel are untouched (loot.md sections 1-2 · gear, herbs, stones and junk are the four streams, and the **humanoid** lineages add a fifth, potions, on the derived chance **X49** prints).
<!-- END GENERATED:mob-roster -->

# Variant Drop Sheets

The junk stream is **variant**-bound: each rung of a ladder drops its own item, and the rung's rarity sets both the sell price and the per-kill chance — so rarity moves how often the junk falls, never how much gold a kill is worth. Only a rung the cast can actually field appears here: a normal rung is cast in some sub-zone, an Elite rung is the elite some sub-zone declares, and a Boss rung belongs to a species that owns a boss — a name nothing can spawn would be an item the Counterhand advertises and nothing ever pays. Every variant also carries a **lean**, the collectible stream it tilts toward, and the three normal rungs of a ladder cycle gear · herb · junk so the mix averages back to the balanced case. Gear, herbs and stones are the shared streams every variant pays, and a humanoid lineage adds the potion stream (loot.md).

<!-- BEGIN GENERATED:race-drop -->
| Variant | Species | junk drop | rarity | sell gold | junk per kill | lean | potion (humanoid) | gear stream | damage tag |
|---|---|---|---|---|---|---|---|---|---|
| Sneak Goblin | Goblin | Goblin Ear | common | 1 | 13.4% | gear | yes | weapon | physical |
| Raider Goblin | Goblin | Goblin Bile | uncommon | 5 | 2.7% | herb | yes | weapon | physical |
| Tinker Goblin | Goblin | Goblin Cog | rare | 25 | 0.5% | junk | yes | weapon | physical |
| Shaman Goblin | Goblin | Goblin Charm | rare | 25 | 0.5% | none | yes | weapon | physical |
| Goblin King | Goblin | Goblin Crown | rare | 25 | 0.5% | none | yes | weapon | physical |
| Raider Orc | Orc | Orc Warpaint | common | 1 | 13.4% | gear | yes | weapon | physical |
| Shaman Orc | Orc | Orc Tusk | uncommon | 5 | 2.7% | herb | yes | weapon | physical |
| Berserker Orc | Orc | Orc Skull | rare | 25 | 0.5% | junk | yes | weapon | physical |
| Juggernaut Orc | Orc | Orc Charm | rare | 25 | 0.5% | none | yes | weapon | physical |
| Warlord Orc | Orc | Orc Crown | rare | 25 | 0.5% | none | yes | weapon | physical |
| Miner Kobold | Kobold | Kobold Candle | common | 1 | 13.4% | gear | — | weapon | physical |
| Trapper Kobold | Kobold | Kobold Wire | uncommon | 5 | 2.7% | herb | — | weapon | physical |
| Tinker Kobold | Kobold | Kobold Vault Key | rare | 25 | 0.5% | junk | — | weapon | physical |
| Hoarder Kobold | Kobold | Kobold Crown | rare | 25 | 0.5% | none | — | weapon | physical |
| Brute Ogre | Ogre | Ogre Nail | common | 1 | 13.4% | gear | — | weapon | physical |
| Butcher Ogre | Ogre | Ogre Tooth | uncommon | 5 | 2.7% | herb | — | weapon | physical |
| Swamp Ogre | Ogre | Ogre Heartstone | rare | 25 | 0.5% | junk | — | weapon | physical |
| Mage Ogre | Ogre | Ogre Charm | rare | 25 | 0.5% | none | — | weapon | physical |
| Ogre King | Ogre | Ogre Crown | rare | 25 | 0.5% | none | — | weapon | physical |
| Cave Troll | Troll | Troll Nail | common | 1 | 13.4% | gear | — | weapon | physical |
| Forest Troll | Troll | Troll Hide | uncommon | 5 | 2.7% | herb | — | weapon | physical |
| Swamp Troll | Troll | Troll Heartstone | rare | 25 | 0.5% | junk | — | weapon | physical |
| Stone Troll | Troll | Troll Charm | rare | 25 | 0.5% | none | — | weapon | physical |
| Elder Troll | Troll | Troll Crown | rare | 25 | 0.5% | none | — | weapon | physical |
| Warrior Minotaur | Minotaur | Minotaur Hoof | common | 1 | 13.4% | gear | — | weapon | physical |
| Berserker Minotaur | Minotaur | Minotaur Chain | uncommon | 5 | 2.7% | herb | — | weapon | physical |
| Guardian Minotaur | Minotaur | Minotaur Horn | rare | 25 | 0.5% | junk | — | weapon | physical |
| Blood Minotaur | Minotaur | Minotaur Charm | rare | 25 | 0.5% | none | — | weapon | physical |
| Warrior Skeleton | Skeleton | Skeleton Bone | common | 1 | 13.4% | gear | — | weapon | physical |
| Archer Skeleton | Skeleton | Skeleton Marrow | uncommon | 5 | 2.7% | herb | — | weapon | physical |
| Knight Skeleton | Skeleton | Skeleton Sigil | rare | 25 | 0.5% | junk | — | weapon | physical |
| Mage Skeleton | Skeleton | Skeleton Charm | rare | 25 | 0.5% | none | — | weapon | physical |
| Bone Colossus | Skeleton | Skeleton Crown | rare | 25 | 0.5% | none | — | weapon | physical |
| Warrior Mummy | Mummy | Mummy Dust | common | 1 | 13.4% | gear | — | weapon | physical |
| Priest Mummy | Mummy | Mummy Bandage | uncommon | 5 | 2.7% | herb | — | weapon | physical |
| Cursed Mummy | Mummy | Mummy Glyph | rare | 25 | 0.5% | junk | — | weapon | physical |
| Royal Mummy | Mummy | Mummy Charm | rare | 25 | 0.5% | none | — | weapon | physical |
| Mummy Lord | Mummy | Mummy Crown | rare | 25 | 0.5% | none | — | weapon | physical |
| Blood Vampire | Vampire | Vampire Ash | common | 1 | 13.4% | gear | — | weapon | mixed |
| Noble Vampire | Vampire | Vampire Signet | uncommon | 5 | 2.7% | herb | — | weapon | mixed |
| Vampire Knight | Vampire | Vampire Fang | rare | 25 | 0.5% | junk | — | weapon | mixed |
| Vampire Lord | Vampire | Vampire Charm | rare | 25 | 0.5% | none | — | weapon | mixed |
| Ancient Vampire | Vampire | Vampire Crown | rare | 25 | 0.5% | none | — | weapon | mixed |
| Imp | Demon | Demon Ash | common | 1 | 13.4% | gear | — | weapon | mixed |
| Demon Mage | Demon | Demon Horn | uncommon | 5 | 2.7% | herb | — | weapon | mixed |
| Demon Brute | Demon | Demon Sigil | rare | 25 | 0.5% | junk | — | weapon | mixed |
| Demon Knight | Demon | Demon Charm | rare | 25 | 0.5% | none | — | weapon | mixed |
| Archdemon | Demon | Demon Crown | rare | 25 | 0.5% | none | — | weapon | mixed |
| Splitter Slime | Slime | Slime Jelly | common | 1 | 13.4% | gear | — | armour only | magic |
| Acid Slime | Slime | Slime Gland | uncommon | 5 | 2.7% | herb | — | armour only | magic |
| Devourer Slime | Slime | Slime Core | rare | 25 | 0.5% | junk | — | armour only | magic |
| Slime King | Slime | Slime Crown | rare | 25 | 0.5% | none | — | armour only | magic |
| Cave Spider | Spider | Spider Silk | common | 1 | 13.4% | gear | — | armour only | physical |
| Hunter Spider | Spider | Spider Fang | uncommon | 5 | 2.7% | herb | — | armour only | physical |
| Web Spider | Spider | Spider Spinneret | rare | 25 | 0.5% | junk | — | armour only | physical |
| Broodmother | Spider | Spider Crown | rare | 25 | 0.5% | none | — | armour only | physical |
| Hunting Wolf | Wolf | Wolf Pelt | common | 1 | 13.4% | gear | — | weapon | physical |
| Dire Wolf | Wolf | Wolf Fang | uncommon | 5 | 2.7% | herb | — | weapon | physical |
| Shadow Wolf | Wolf | Wolf Alpha Claw | rare | 25 | 0.5% | junk | — | weapon | physical |
| Wolf King | Wolf | Wolf Crown | rare | 25 | 0.5% | none | — | weapon | physical |
| Stone Golem | Golem | Golem Grit | common | 1 | 13.4% | gear | — | weapon | physical |
| Iron Golem | Golem | Golem Wire | uncommon | 5 | 2.7% | herb | — | weapon | physical |
| Guardian Golem | Golem | Golem Shard | rare | 25 | 0.5% | junk | — | weapon | physical |
| Crystal Golem | Golem | Golem Charm | rare | 25 | 0.5% | none | — | weapon | physical |
| Colossus | Golem | Golem Crown | rare | 25 | 0.5% | none | — | weapon | physical |
| Wyrmling | Dragon | Dragon Claw | common | 1 | 13.4% | gear | — | weapon | mixed |
| Drake | Dragon | Dragon Ichor | uncommon | 5 | 2.7% | herb | — | weapon | mixed |
| Wyvern | Dragon | Dragon Scale | rare | 25 | 0.5% | junk | — | weapon | mixed |
| Elder Dragon | Dragon | Dragon Charm | rare | 25 | 0.5% | none | — | weapon | mixed |
| Ancient Dragon | Dragon | Dragon Crown | rare | 25 | 0.5% | none | — | weapon | mixed |
| Young Treant | Treant | Treant Twig | common | 1 | 13.4% | gear | — | weapon | physical |
| Thorn Treant | Treant | Treant Bark | uncommon | 5 | 2.7% | herb | — | weapon | physical |
| Rotting Treant | Treant | Treant Heartwood | rare | 25 | 0.5% | junk | — | weapon | physical |
| Ancient Treant | Treant | Treant Charm | rare | 25 | 0.5% | none | — | weapon | physical |
| Treant Elder | Treant | Treant Crown | rare | 25 | 0.5% | none | — | weapon | physical |
| Ranger | Human | Militia Badge | common | 1 | 13.4% | gear | yes | weapon | physical |
| Warrior | Human | Veteran Seal | uncommon | 5 | 2.7% | herb | yes | weapon | physical |
| Knight | Human | Knight Crest | rare | 25 | 0.5% | junk | yes | weapon | physical |
| Mage | Human | Temple Charm | rare | 25 | 0.5% | none | yes | weapon | physical |
| Paladin | Human | Paladin Crown | rare | 25 | 0.5% | none | yes | weapon | physical |
| Hunter Lizardman | Lizardman | Lizardman Scale | common | 1 | 13.4% | gear | — | weapon | physical |
| Warrior Lizardman | Lizardman | Lizardman Talon | uncommon | 5 | 2.7% | herb | — | weapon | physical |
| Scale Knight | Lizardman | Lizardman Crest | rare | 25 | 0.5% | junk | — | weapon | physical |
| Shaman Lizardman | Lizardman | Lizardman Charm | rare | 25 | 0.5% | none | — | weapon | physical |
| Lizardman Chief | Lizardman | Lizardman Crown | rare | 25 | 0.5% | none | — | weapon | physical |
| Wood Elf | Elf | Elf Quill | common | 1 | 13.4% | gear | yes | weapon | mixed |
| High Elf | Elf | Elf Dust | uncommon | 5 | 2.7% | herb | yes | weapon | mixed |
| Moon Elf | Elf | Elf Runestone | rare | 25 | 0.5% | junk | yes | weapon | mixed |
| Dark Elf | Elf | Elf Charm | rare | 25 | 0.5% | none | yes | weapon | mixed |
| Elven Archmage | Elf | Elf Crown | rare | 25 | 0.5% | none | yes | weapon | mixed |
| Hill Giant | Giant | Giant Sinew | common | 1 | 13.4% | gear | — | weapon | physical |
| Stone Giant | Giant | Giant Knuckle | uncommon | 5 | 2.7% | herb | — | weapon | physical |
| Frost Giant | Giant | Giant Runestone | rare | 25 | 0.5% | junk | — | weapon | physical |
| Fire Giant | Giant | Giant Charm | rare | 25 | 0.5% | none | — | weapon | physical |
| Wolfman | Werewolf | Werewolf Pelt | common | 1 | 13.4% | gear | — | weapon | physical |
| Dire Werewolf | Werewolf | Werewolf Fang | uncommon | 5 | 2.7% | herb | — | weapon | physical |
| Blood Werewolf | Werewolf | Werewolf Claw | rare | 25 | 0.5% | junk | — | weapon | physical |
| Alpha Werewolf | Werewolf | Werewolf Charm | rare | 25 | 0.5% | none | — | weapon | physical |
| Forest Dryad | Dryad | Dryad Sap | common | 1 | 13.4% | gear | — | armour only | magic |
| Flower Dryad | Dryad | Dryad Blossom | uncommon | 5 | 2.7% | herb | — | armour only | magic |
| Thorn Dryad | Dryad | Dryad Heartwood | rare | 25 | 0.5% | junk | — | armour only | magic |

Every variant drops its own junk, and the five rungs of a ladder read as one family — a Goblin pays an Ear at Sneak, Bile at Raider, a Cog at Tinker, a Charm at Shaman and a Crown at the King — so a Counterhand visit tells the player which **variants** they farmed, not only which races. **Rarity buys frequency, never income**: each rarity's per-kill chance is the junk line divided by its own sell price (`junk.rarities`), so a variant's expected gold per kill is the same whatever rung it sits on, and a rarer rung simply drops less often for more gold — which is a bag-pressure trade, since junk stacks 999/slot. Rarity is bound to the variant, not to the level, so the same mob never changes what it pays as the player levels. The **lean** column is the collectible stream that variant tilts toward, applied through `huntReweight` (**X56**): the three normal rungs of every ladder cycle gear · herb · junk, so a zone's aggregate mix stays the identity and only the per-kill mix moves, while **Elite** and **Boss** carry `none` because they already pay their own stone lines. Only a rung the cast can field carries a row at all — a rung nothing spawns is an item nothing pays (**X39**). A **humanoid** lineage adds the potion stream (X49) and a **weapon-carrier** lineage is the only source of weapon-slot gear; gear, herbs and stones are the shared streams every variant pays (loot.md sections 1-2).
<!-- END GENERATED:race-drop -->

# Race Resistance

Every race's res is its own Vit line tilted by Element — it resists what it is made of and is weak to what answers it. The five multipliers average x1.00, so the headline res is unchanged and the profile only decides which Element a build should bring to a zone.

<!-- BEGIN GENERATED:race-resist -->
| Race | fire | cold | lightning | poison | chaos | headline res |
|---|---|---|---|---|---|---|
| Goblin | 0.60 ↓ | 1.00 | 1.00 | 1.40 ↑ | 1.00 | 5.3% |
| Orc | 1.40 ↑ | 0.60 ↓ | 1.00 | 1.00 | 1.00 | 6.9% |
| Kobold | 1.40 ↑ | 0.60 ↓ | 1.00 | 1.00 | 1.00 | 4.6% |
| Ogre | 1.00 | 1.00 | 0.60 ↓ | 1.00 | 1.40 ↑ | 7.5% |
| Troll | 0.60 ↓ | 1.00 | 1.00 | 1.40 ↑ | 1.00 | 8.0% |
| Minotaur | 1.00 | 1.00 | 1.40 ↑ | 0.60 ↓ | 1.00 | 6.3% |
| Skeleton | 1.00 | 1.00 | 0.50 ↓ | 1.00 | 1.50 ↑ | 8.5% |
| Mummy | 0.50 ↓ | 1.00 | 1.00 | 1.00 | 1.50 ↑ | 8.5% |
| Vampire | 0.60 ↓ | 1.00 | 1.00 | 1.00 | 1.40 ↑ | 5.4% |
| Demon | 1.50 ↑ | 0.50 ↓ | 1.00 | 1.00 | 1.00 | 5.8% |
| Slime | 1.00 | 1.00 | 0.50 ↓ | 1.50 ↑ | 1.00 | 7.9% |
| Spider | 0.60 ↓ | 1.00 | 1.00 | 1.40 ↑ | 1.00 | 4.4% |
| Wolf | 0.60 ↓ | 1.40 ↑ | 1.00 | 1.00 | 1.00 | 5.0% |
| Golem | 1.00 | 1.00 | 1.50 ↑ | 1.00 | 0.50 ↓ | 8.4% |
| Dragon | 1.50 ↑ | 0.50 ↓ | 1.00 | 1.00 | 1.00 | 7.0% |
| Treant | 0.60 ↓ | 1.00 | 1.00 | 1.40 ↑ | 1.00 | 8.2% |
| Human | 1.00 | 1.00 | 0.70 ↓ | 1.00 | 1.30 ↑ | 5.0% |
| Lizardman | 1.40 ↑ | 0.60 ↓ | 1.00 | 1.00 | 1.00 | 5.4% |
| Elf | 1.00 | 1.00 | 1.40 ↑ | 1.00 | 0.60 ↓ | 4.2% |
| Giant | 0.60 ↓ | 1.40 ↑ | 1.00 | 1.00 | 1.00 | 7.6% |
| Werewolf | 0.60 ↓ | 1.40 ↑ | 1.00 | 1.00 | 1.00 | 6.0% |
| Dryad | 0.60 ↓ | 1.00 | 1.00 | 1.40 ↑ | 1.00 | 4.8% |

Each race's res is its own Vit line (the **headline res** column) tilted by Element: ↑ resists that Element at x1.3-1.5, ↓ is weak to it at x0.5-0.7, and the other three sit at x1.00. The five multipliers always average x1.00 (**X54**), so the headline is the mean and the profile only decides which Element a build should bring to a zone — a Dragon shrugs fire and fears cold, a Skeleton shrugs chaos and fears lightning. The profile multiplies before the same Elemental resistance Cap the player obeys, and the mob's **innate Element** roll (its own bias) is a separate axis.
<!-- END GENERATED:race-resist -->

# Rules the Roster Runs On

- **HP**: `mob_HP(L) x body.hp` - `mob_HP(L) = typical_gear_DPS(L) x (1 + 0.0034 x L)` (skill list only; the passive tree is empty) - `body.hp` and every per-entry number below are one home, this line only names the formula
- **Damage/sec**: `mob_PS(L) = typical_gear_DPS(L) ÷ 27` (**not** `mob_HP ÷ 27` · checks.md D2), then × body `ps`. Split 50% physical + 50% Element by the mob's innate (combat.md section 3).
- **Elite**: Large body, HP ×6 · damage ×4 · always single · 0.5% of kills · drops a Reroll tier stone 5% of the time (world.md · loot.md section 5).
- **Boss**: HP ×15 · damage ×4 · always single · 1 spawn per 15 minutes · online only · potions suppressed (combat.md section 7 · farm.md).
- **Grouping**: Small and Medium form the zone's group; Large, Elite and Boss appear alone. At most 3 attackers swing per round (world.md · the rule that holds the AFK promise).
- **XP**: `10 × mob level`, elite ×3, boss ×15 (world.md XP line).
- **Mob level**: the attacking player's level clamped into the zone's range · a level-45 player in Wolf Cross (41-50) fights mobs at 45, and levels 91-100 keep fighting zone 9 at level 90.
- **Spawn weighting inside a zone**: a spawn rolls one of the zone's sub-zones first, and its normal bodies then spawn evenly across that sub-zone's two races; a zone's Elite rate is the single 0.5% flag, not a species trait, and it always lands on a Large body.
- **Innate Element roll**: inside the Element the sub-zone rolled, the species-biased Element weighs ×3 and any other Element that sub-zone carries weighs ×1 (`element_roll`). A sub-zone carrying one Element is therefore always that Element; where it carries two, the species bias lands about three rolls in four. Res still has to be prepared from the zone, not from the species.
- **Drops**: `weapon` marks the lineages allowed to be the source of a weapon-slot piece; `armour only` species still drop every other slot. **No species drops nothing** — the 8% base drop rate, the quality floors and the stone funnel are the same for every entry (loot.md sections 1-2: gear, herbs, stones and junk are the four streams).
  Weaponless lineages are Slime · Spider · Dryad, which is why Goblin (zone 1) is written up as "where the weapon part of the drop table starts", and every live zone fields at least one weapon-carrier, so the weapon part of the ladder is live from the first zone to the last.

# Settled on the Mob Side

(The items this file used to carry as open are all closed; kept here so the next session does not re-open them. The one non-blocking follow-up — modelling the mob-skill burst shape in `tools/survival.ts` — is now closed by the SV8 gate and moves no number here.)

- **Player-side Evasion closed** — the player's line runs the same opposed form (`formula-defense.md` section 4: `rating ÷ (rating + mob_accuracy)`, plus Agi ÷ 30 points) and its table is generated, so the flat `K_dodge` divisor is gone.
- **Mob skills** (`combat.md` §5b): skills follow the body tier — Small/Medium 0 (innate Element only), Large and Elite 1, Boss 1-2 — and each skill re-times the mob's priced `mob_PS` instead of adding power, so `mob_HP` and the timeline are untouched. The species table is the input: the physical lineages carry bleed, the casters lean on their innate status. Nothing here blocks shipping without it.
- **Gear Armour / Evasion / Energy Shield flat ranges** are set in `mod-pool.md` from `tools/data/mods.json` — each is a share of its own stat line.
- **`tools/survival.ts`** generates combat.md section 6-7 and gates them; it is run by `tools/verify.ts`.
