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
| 2 | Highspire | 4 | 0 · 3 · 4 | 4 | Orc · Warlord Orc | 19,575 | 815 | 12 |
| 3 | Wolf Cross | 4 | 3 · 3 · 2 | 2 | Troll · Elder Troll | 27,360 | 1,103 | 11 |
| 4 | Greyfen | 4 | 1 · 4 · 4 | 4 | Mummy · Mummy Lord | 60,495 | 2,367 | 14 |
| 5 | Saltmarrow | 3 | 1 · 3 · 3 | 3 | Skeleton · Bone Colossus | 69,480 | 2,639 | 11 |
| 6 | The Pale Spire | 4 | 1 · 3 · 4 | 4 | Human · Paladin | 79,395 | 2,931 | 13 |
| 7 | Blackwater Reach | 3 | 1 · 2 · 2 | 2 | Golem · Colossus | 128,805 | 4,624 | 8 |
| 8 | Bonegate | 5 | 2 · 3 · 3 | 3 | Kobold · Hoarder Kobold | 144,075 | 5,034 | 12 |
| 9 | Frosthold | 4 | 0 · 3 · 4 | 4 | Ogre · Ogre King | 160,635 | 5,467 | 12 |
| 10 | Vermolch | 4 | 1 · 2 · 3 | 3 | Wolf · Wolf King | 182,166 | 6,042 | 10 |
| 11 | Duskmoor | 4 | 1 · 4 · 4 | 4 | Demon · Archdemon | 204,578 | 6,617 | 14 |
| 12 | Nettlecrag | 3 | 1 · 2 · 2 | 2 | Slime · Slime King | 227,869 | 7,193 | 8 |
| 13 | Emberhold | 4 | 2 · 4 · 4 | 4 | Vampire · Ancient Vampire | 252,042 | 7,768 | 15 |
| 14 | Millbrook | 4 | 3 · 4 · 2 | 2 | Spider · Broodmother | 277,094 | 8,344 | 12 |
| 15 | Wyrmback | 4 | 3 · 4 · 2 | 2 | Lizardman · Lizardman Chief | 303,027 | 8,919 | 12 |
| 16 | Ashfall | 4 | 0 · 3 · 4 | 4 | Treant · Treant Elder | 329,841 | 9,495 | 12 |
| 17 | Ironrow | 4 | 0 · 3 · 4 | 4 | Elf · Elven Archmage | 357,535 | 10,070 | 12 |
| 18 | Thornwake | 4 | 1 · 2 · 3 | 3 | Dragon · Ancient Dragon | 386,109 | 10,645 | 10 |

| Zone | Sub-zone | Environment | Element | Races | Elite |
|---|---|---|---|---|---|
| 1 | Open Grassland | grassland | fire | Goblin · Wolf | Shaman Goblin |
| 1 | Village Outskirts | village | fire | Orc · Human | Juggernaut Orc |
| 1 | Raider Camp | camp | fire | Wolf · Goblin | Shaman Goblin |
| 2 | Mountain Slopes | mountain | cold | Orc · Dragon | Juggernaut Orc |
| 2 | Cliff Holds | cliff | lightning | Ogre · Giant | Mage Ogre |
| 2 | Dragon Peak | peak | cold | Dragon · Orc | Elder Dragon |
| 3 | Murky Swamp | swamp | cold | Troll · Spider | Stone Troll |
| 3 | Mud Flats | mud | cold | Slime · Lizardman | Shaman Lizardman |
| 3 | Poison Fen | poison fen | cold | Spider · Troll | Stone Troll |
| 4 | Dune Sea | dunes | poison | Orc · Demon | Juggernaut Orc |
| 4 | Sunken Tombs | tombs | chaos | Mummy · Lizardman | Royal Mummy |
| 4 | Scorch Mesa | mesa | poison | Demon · Orc | Demon Knight |
| 5 | Outer Court | court | chaos | Skeleton · Vampire | Mage Skeleton |
| 5 | Burial Gallery | gallery | chaos | Mummy · Skeleton | Royal Mummy |
| 5 | Inner Sanctum | sanctum | chaos | Vampire · Mummy | Vampire Lord |
| 6 | Outer Colonnade | ruins | chaos | Golem · Human | Crystal Golem |
| 6 | Hall of Wardens | temple | poison | Dragon · Elf | Elder Dragon |
| 6 | Sanctum Depths | depths | chaos | Human · Golem | Mage |
| 7 | Drowned Stair | stair | poison | Demon · Golem | Demon Knight |
| 7 | Silt Deeps | deeps | poison | Slime · Demon | Demon Knight |
| 7 | Flooded Abyss | abyss | poison | Golem · Slime | Crystal Golem |
| 8 | Tunnels | tunnels | chaos | Kobold · Minotaur | Blood Minotaur |
| 8 | Deep Warrens | warrens | chaos | Troll · Spider | Stone Troll |
| 8 | Sunken Vault | vault | chaos | Minotaur · Golem | Blood Minotaur |
| 9 | Ash Fields | volcano | cold | Ogre · Golem | Mage Ogre |
| 9 | Slag Pit | lava | cold | Demon · Dragon | Demon Knight |
| 9 | Caldera | caldera | cold | Golem · Ogre | Crystal Golem |
| 10 | Snowfield | snow | poison | Troll · Dragon | Stone Troll |
| 10 | Glacier Shelf | ice | chaos | Wolf · Giant | Fire Giant |
| 10 | Rime Hollow | rime | poison | Dragon · Troll | Elder Dragon |
| 11 | Blight Field | blight | cold | Skeleton · Demon | Mage Skeleton |
| 11 | Howling Waste | waste | chaos | Vampire · Werewolf | Vampire Lord |
| 11 | Rift Scar | rift | cold | Demon · Skeleton | Demon Knight |
| 12 | Bone Stair | stair | chaos | Demon · Golem | Demon Knight |
| 12 | Molten Deeps | deeps | poison | Slime · Demon | Demon Knight |
| 12 | Throne Abyss | abyss | chaos | Golem · Slime | Crystal Golem |
| 13 | Fallen Gate | gate | fire | Skeleton · Demon | Mage Skeleton |
| 13 | Market Ruins | market | fire | Vampire · Human | Vampire Lord |
| 13 | Noble Quarter | quarter | fire | Demon · Skeleton | Demon Knight |
| 14 | Fog Thicket | fog | poison | Goblin · Wolf | Shaman Goblin |
| 14 | Dark Grove | dark forest | poison | Spider · Werewolf | Alpha Werewolf |
| 14 | Spider Hollow | hollow | poison | Wolf · Goblin | Shaman Goblin |
| 15 | Tideflats | coast | fire | Ogre · Spider | Mage Ogre |
| 15 | Salt Cliffs | cliffs | cold | Slime · Lizardman | Shaman Lizardman |
| 15 | Sunken Reef | sea | fire | Spider · Ogre | Mage Ogre |
| 16 | Glimmer Grove | grove | fire | Treant · Werewolf | Ancient Treant |
| 16 | Elder Rootway | rootway | fire | Elf · Dryad | Dark Elf |
| 16 | Moonlit Glade | glade | fire | Werewolf · Treant | Alpha Werewolf |
| 17 | Stormbreak Grove | grove | lightning | Treant · Werewolf | Ancient Treant |
| 17 | Charged Rootway | rootway | lightning | Elf · Dryad | Dark Elf |
| 17 | Thunder Glade | glade | lightning | Werewolf · Treant | Alpha Werewolf |
| 18 | Frozen Fen | snow | poison | Troll · Dragon | Stone Troll |
| 18 | Icebreak Shelf | ice | poison | Wolf · Giant | Fire Giant |
| 18 | Rime Bog | rime | poison | Dragon · Troll | Elder Dragon |
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
| z2_orc_medium | 2 | 11-20 | Medium | Orc | cold | 570 → 1,020 | 35 | 90 | 40 | 321 | 6.9% | 5.2% | 26.4% | 4.0% | 110 - 200 | 1-2 | front | weapon | 100/0 |
| z2_orc_large | 2 | 11-20 | Large | Orc | cold | 970 → 1,733 | 48 | 90 | 36 | 321 | 6.9% | 5.2% | 26.4% | 4.0% | 110 - 200 | alone | front | weapon | 100/0 |
| z2_orc_elite | 2 | 11-20 | Elite | Orc | cold | 4,380 → 7,830 | 181 | 90 | 36 | 321 | 6.9% | 5.2% | 26.4% | 4.0% | 330 - 600 | alone | front | weapon | 100/0 |
| z2_ogre_medium | 2 | 11-20 | Medium | Ogre | cold | 570 → 1,020 | 35 | 60 | 40 | 310 | 7.5% | 5.2% | 24.6% | 4.0% | 110 - 200 | 1-2 | front | weapon | 100/0 |
| z2_ogre_large | 2 | 11-20 | Large | Ogre | cold | 970 → 1,733 | 48 | 60 | 36 | 310 | 7.5% | 5.2% | 24.6% | 4.0% | 110 - 200 | alone | front | weapon | 100/0 |
| z2_ogre_elite | 2 | 11-20 | Elite | Ogre | cold | 4,380 → 7,830 | 181 | 60 | 36 | 310 | 7.5% | 5.2% | 24.6% | 4.0% | 330 - 600 | alone | front | weapon | 100/0 |
| z2_dragon_medium | 2 | 11-20 | Medium | Dragon | cold | 570 → 1,020 | 35 | 132 | 44 | 321 | 7.0% | 4.1% | 20.9% | 4.4% | 110 - 200 | 1-2 | stand-off | weapon | 50/50 |
| z2_dragon_large | 2 | 11-20 | Large | Dragon | cold | 970 → 1,733 | 48 | 132 | 40 | 321 | 7.0% | 4.1% | 20.9% | 4.4% | 110 - 200 | alone | stand-off | weapon | 50/50 |
| z2_dragon_elite | 2 | 11-20 | Elite | Dragon | cold | 4,380 → 7,830 | 181 | 132 | 40 | 321 | 7.0% | 4.1% | 20.9% | 4.4% | 330 - 600 | alone | stand-off | weapon | 50/50 |
| z2_giant_large | 2 | 11-20 | Large | Giant | cold | 970 → 1,733 | 48 | 30 | 37 | 345 | 7.6% | 4.3% | 22.0% | 4.1% | 110 - 200 | alone | front | weapon | 100/0 |
| z2_giant_elite | 2 | 11-20 | Elite | Giant | cold | 4,380 → 7,830 | 181 | 30 | 37 | 345 | 7.6% | 4.3% | 22.0% | 4.1% | 330 - 600 | alone | front | weapon | 100/0 |
| z2_boss | 2 | 11-20 | Boss · Warlord Orc | Orc | cold | 10,950 → 19,575 | 815 | 90 | 40 | 321 | 6.9% | 5.2% | 26.4% | 4.0% | 1,650 - 3,000 | alone | front | weapon | 100/0 |
| z3_troll_large | 3 | 21-30 | Large | Troll | cold | 2,643 → 3,358 | 90 | 60 | 36 | 299 | 8.0% | 5.2% | 18.4% | 4.0% | 210 - 300 | alone | front | weapon | 100/0 |
| z3_troll_elite | 3 | 21-30 | Elite | Troll | cold | 8,616 → 10,944 | 245 | 60 | 36 | 299 | 8.0% | 5.2% | 18.4% | 4.0% | 630 - 900 | alone | front | weapon | 100/0 |
| z3_slime_small | 3 | 21-30 | Small | Slime | cold | 1,088 → 1,383 | 46 | 6 | 44 | 158 | 7.9% | 5.6% | 14.3% | 4.0% | 210 - 300 | 1-2 | front | armour only | 0/100 |
| z3_slime_medium | 3 | 21-30 | Medium | Slime | cold | 1,555 → 1,975 | 66 | 6 | 40 | 158 | 7.9% | 5.6% | 14.3% | 4.0% | 210 - 300 | 1-2 | front | armour only | 0/100 |
| z3_spider_small | 3 | 21-30 | Small | Spider | cold | 1,088 → 1,383 | 46 | 101 | 74 | 156 | 4.4% | 6.1% | 26.2% | 6.7% | 210 - 300 | 1-2 | front | armour only | 100/0 |
| z3_spider_medium | 3 | 21-30 | Medium | Spider | cold | 1,555 → 1,975 | 66 | 101 | 67 | 156 | 4.4% | 6.1% | 26.2% | 6.7% | 210 - 300 | 1-2 | front | armour only | 100/0 |
| z3_lizardman_small | 3 | 21-30 | Small | Lizardman | cold | 1,088 → 1,383 | 46 | 116 | 57 | 252 | 5.4% | 6.3% | 25.0% | 5.2% | 210 - 300 | 1-2 | front | weapon | 100/0 |
| z3_lizardman_medium | 3 | 21-30 | Medium | Lizardman | cold | 1,555 → 1,975 | 66 | 116 | 52 | 252 | 5.4% | 6.3% | 25.0% | 5.2% | 210 - 300 | 1-2 | front | weapon | 100/0 |
| z3_lizardman_large | 3 | 21-30 | Large | Lizardman | cold | 2,643 → 3,358 | 90 | 116 | 46 | 252 | 5.4% | 6.3% | 25.0% | 5.2% | 210 - 300 | alone | front | weapon | 100/0 |
| z3_lizardman_elite | 3 | 21-30 | Elite | Lizardman | cold | 8,616 → 10,944 | 245 | 116 | 46 | 252 | 5.4% | 6.3% | 25.0% | 5.2% | 630 - 900 | alone | front | weapon | 100/0 |
| z3_boss | 3 | 21-30 | Boss · Elder Troll | Troll | cold | 21,540 → 27,360 | 1,103 | 60 | 40 | 299 | 8.0% | 5.2% | 18.4% | 4.0% | 3,150 - 4,500 | alone | front | weapon | 100/0 |
| z4_orc_medium | 4 | 31-40 | Medium | Orc | chaos | 3,147 → 3,580 | 117 | 90 | 40 | 321 | 6.9% | 5.2% | 18.7% | 4.0% | 310 - 400 | 2-3 | front | weapon | 100/0 |
| z4_orc_large | 4 | 31-40 | Large | Orc | chaos | 5,350 → 6,085 | 158 | 90 | 36 | 321 | 6.9% | 5.2% | 18.7% | 4.0% | 310 - 400 | alone | front | weapon | 100/0 |
| z4_orc_elite | 4 | 31-40 | Elite | Orc | chaos | 21,276 → 24,198 | 526 | 90 | 36 | 321 | 6.9% | 5.2% | 18.7% | 4.0% | 930 - 1,200 | alone | front | weapon | 100/0 |
| z4_mummy_medium | 4 | 31-40 | Medium | Mummy | poison/chaos | 3,147 → 3,580 | 117 | 32 | 42 | 278 | 8.5% | 5.1% | 14.5% | 4.2% | 310 - 400 | 2-3 | stand-off | weapon | 100/0 |
| z4_mummy_large | 4 | 31-40 | Large | Mummy | poison/chaos | 5,350 → 6,085 | 158 | 32 | 38 | 278 | 8.5% | 5.1% | 14.5% | 4.2% | 310 - 400 | alone | stand-off | weapon | 100/0 |
| z4_mummy_elite | 4 | 31-40 | Elite | Mummy | poison/chaos | 21,276 → 24,198 | 526 | 32 | 38 | 278 | 8.5% | 5.1% | 14.5% | 4.2% | 930 - 1,200 | alone | stand-off | weapon | 100/0 |
| z4_demon_medium | 4 | 31-40 | Medium | Demon | chaos/poison | 3,147 → 3,580 | 117 | 106 | 47 | 254 | 5.8% | 4.7% | 17.4% | 4.7% | 310 - 400 | 2-3 | stand-off | weapon | 50/50 |
| z4_demon_large | 4 | 31-40 | Large | Demon | chaos/poison | 5,350 → 6,085 | 158 | 106 | 42 | 254 | 5.8% | 4.7% | 17.4% | 4.7% | 310 - 400 | alone | stand-off | weapon | 50/50 |
| z4_demon_elite | 4 | 31-40 | Elite | Demon | chaos/poison | 21,276 → 24,198 | 526 | 106 | 42 | 254 | 5.8% | 4.7% | 17.4% | 4.7% | 930 - 1,200 | alone | stand-off | weapon | 50/50 |
| z4_lizardman_small | 4 | 31-40 | Small | Lizardman | poison | 2,203 → 2,506 | 82 | 116 | 57 | 252 | 5.4% | 6.3% | 21.5% | 5.2% | 310 - 400 | 2-3 | front | weapon | 100/0 |
| z4_lizardman_medium | 4 | 31-40 | Medium | Lizardman | poison | 3,147 → 3,580 | 117 | 116 | 52 | 252 | 5.4% | 6.3% | 21.5% | 5.2% | 310 - 400 | 2-3 | front | weapon | 100/0 |
| z4_lizardman_large | 4 | 31-40 | Large | Lizardman | poison | 5,350 → 6,085 | 158 | 116 | 46 | 252 | 5.4% | 6.3% | 21.5% | 5.2% | 310 - 400 | alone | front | weapon | 100/0 |
| z4_lizardman_elite | 4 | 31-40 | Elite | Lizardman | poison | 21,276 → 24,198 | 526 | 116 | 46 | 252 | 5.4% | 6.3% | 21.5% | 5.2% | 930 - 1,200 | alone | front | weapon | 100/0 |
| z4_boss | 4 | 31-40 | Boss · Mummy Lord | Mummy | poison/chaos | 53,190 → 60,495 | 2,367 | 32 | 42 | 278 | 8.5% | 5.1% | 14.5% | 4.2% | 4,650 - 6,000 | alone | stand-off | weapon | 100/0 |
| z5_skeleton_small | 5 | 41-50 | Small | Skeleton | chaos | 2,603 → 2,948 | 93 | 34 | 50 | 267 | 8.5% | 4.9% | 11.9% | 4.6% | 410 - 500 | 2-3 | front | weapon | 100/0 |
| z5_skeleton_medium | 5 | 41-50 | Medium | Skeleton | chaos | 3,718 → 4,211 | 133 | 34 | 46 | 267 | 8.5% | 4.9% | 11.9% | 4.6% | 410 - 500 | 2-3 | front | weapon | 100/0 |
| z5_skeleton_large | 5 | 41-50 | Large | Skeleton | chaos | 6,321 → 7,159 | 180 | 34 | 41 | 267 | 8.5% | 4.9% | 11.9% | 4.6% | 410 - 500 | alone | front | weapon | 100/0 |
| z5_skeleton_elite | 5 | 41-50 | Elite | Skeleton | chaos | 24,540 → 27,792 | 587 | 34 | 41 | 267 | 8.5% | 4.9% | 11.9% | 4.6% | 1,230 - 1,500 | alone | front | weapon | 100/0 |
| z5_mummy_medium | 5 | 41-50 | Medium | Mummy | chaos | 3,718 → 4,211 | 133 | 32 | 42 | 278 | 8.5% | 5.1% | 12.6% | 4.2% | 410 - 500 | 2-3 | stand-off | weapon | 100/0 |
| z5_mummy_large | 5 | 41-50 | Large | Mummy | chaos | 6,321 → 7,159 | 180 | 32 | 38 | 278 | 8.5% | 5.1% | 12.6% | 4.2% | 410 - 500 | alone | stand-off | weapon | 100/0 |
| z5_mummy_elite | 5 | 41-50 | Elite | Mummy | chaos | 24,540 → 27,792 | 587 | 32 | 38 | 278 | 8.5% | 5.1% | 12.6% | 4.2% | 1,230 - 1,500 | alone | stand-off | weapon | 100/0 |
| z5_vampire_medium | 5 | 41-50 | Medium | Vampire | chaos | 3,718 → 4,211 | 133 | 116 | 52 | 249 | 5.4% | 5.2% | 17.6% | 5.2% | 410 - 500 | 2-3 | stand-off | weapon | 50/50 |
| z5_vampire_large | 5 | 41-50 | Large | Vampire | chaos | 6,321 → 7,159 | 180 | 116 | 46 | 249 | 5.4% | 5.2% | 17.6% | 5.2% | 410 - 500 | alone | stand-off | weapon | 50/50 |
| z5_vampire_elite | 5 | 41-50 | Elite | Vampire | chaos | 24,540 → 27,792 | 587 | 116 | 46 | 249 | 5.4% | 5.2% | 17.6% | 5.2% | 1,230 - 1,500 | alone | stand-off | weapon | 50/50 |
| z5_boss | 5 | 41-50 | Boss · Bone Colossus | Skeleton | chaos | 61,350 → 69,480 | 2,639 | 34 | 46 | 267 | 8.5% | 4.9% | 11.9% | 4.6% | 6,150 - 7,500 | alone | front | weapon | 100/0 |
| z6_golem_large | 6 | 51-60 | Large | Golem | chaos/poison | 6,965 → 7,851 | 192 | 30 | 37 | 369 | 8.4% | 3.5% | 8.8% | 4.1% | 510 - 600 | alone | front | weapon | 100/0 |
| z6_golem_elite | 6 | 51-60 | Elite | Golem | chaos/poison | 28,176 → 31,758 | 651 | 30 | 37 | 369 | 8.4% | 3.5% | 8.8% | 4.1% | 1,530 - 1,800 | alone | front | weapon | 100/0 |
| z6_dragon_medium | 6 | 51-60 | Medium | Dragon | poison | 4,097 → 4,618 | 142 | 132 | 44 | 321 | 7.0% | 4.1% | 11.1% | 4.4% | 510 - 600 | 2-3 | stand-off | weapon | 50/50 |
| z6_dragon_large | 6 | 51-60 | Large | Dragon | poison | 6,965 → 7,851 | 192 | 132 | 40 | 321 | 7.0% | 4.1% | 11.1% | 4.4% | 510 - 600 | alone | stand-off | weapon | 50/50 |
| z6_dragon_elite | 6 | 51-60 | Elite | Dragon | poison | 28,176 → 31,758 | 651 | 132 | 40 | 321 | 7.0% | 4.1% | 11.1% | 4.4% | 1,530 - 1,800 | alone | stand-off | weapon | 50/50 |
| z6_human_small | 6 | 51-60 | Small | Human | chaos | 2,868 → 3,233 | 99 | 138 | 67 | 245 | 5.0% | 5.6% | 14.2% | 6.1% | 510 - 600 | 2-3 | front | weapon | 100/0 |
| z6_human_medium | 6 | 51-60 | Medium | Human | chaos | 4,097 → 4,618 | 142 | 138 | 61 | 245 | 5.0% | 5.6% | 14.2% | 6.1% | 510 - 600 | 2-3 | front | weapon | 100/0 |
| z6_human_large | 6 | 51-60 | Large | Human | chaos | 6,965 → 7,851 | 192 | 138 | 55 | 245 | 5.0% | 5.6% | 14.2% | 6.1% | 510 - 600 | alone | front | weapon | 100/0 |
| z6_human_elite | 6 | 51-60 | Elite | Human | chaos | 28,176 → 31,758 | 651 | 138 | 55 | 245 | 5.0% | 5.6% | 14.2% | 6.1% | 1,530 - 1,800 | alone | front | weapon | 100/0 |
| z6_elf_medium | 6 | 51-60 | Medium | Elf | chaos/poison | 4,097 → 4,618 | 142 | 203 | 68 | 186 | 4.2% | 5.2% | 15.6% | 6.8% | 510 - 600 | 2-3 | stand-off | weapon | 50/50 |
| z6_elf_large | 6 | 51-60 | Large | Elf | chaos/poison | 6,965 → 7,851 | 192 | 203 | 61 | 186 | 4.2% | 5.2% | 15.6% | 6.8% | 510 - 600 | alone | stand-off | weapon | 50/50 |
| z6_elf_elite | 6 | 51-60 | Elite | Elf | chaos/poison | 28,176 → 31,758 | 651 | 203 | 61 | 186 | 4.2% | 5.2% | 15.6% | 6.8% | 1,530 - 1,800 | alone | stand-off | weapon | 50/50 |
| z6_boss | 6 | 51-60 | Boss · Paladin | Human | chaos | 70,440 → 79,395 | 2,931 | 138 | 61 | 245 | 5.0% | 5.6% | 14.2% | 6.1% | 7,650 - 9,000 | alone | front | weapon | 100/0 |
| z7_demon_medium | 7 | 61-70 | Medium | Demon | poison | 7,332 → 8,135 | 243 | 106 | 47 | 254 | 5.8% | 4.7% | 12.1% | 4.7% | 610 - 700 | 3-5 | stand-off | weapon | 50/50 |
| z7_demon_large | 7 | 61-70 | Large | Demon | poison | 12,464 → 13,830 | 329 | 106 | 42 | 254 | 5.8% | 4.7% | 12.1% | 4.7% | 610 - 700 | alone | stand-off | weapon | 50/50 |
| z7_demon_elite | 7 | 61-70 | Elite | Demon | poison | 46,434 → 51,522 | 1,028 | 106 | 42 | 254 | 5.8% | 4.7% | 12.1% | 4.7% | 1,830 - 2,100 | alone | stand-off | weapon | 50/50 |
| z7_slime_small | 7 | 61-70 | Small | Slime | poison | 5,132 → 5,695 | 170 | 6 | 44 | 158 | 7.9% | 5.6% | 8.2% | 4.0% | 610 - 700 | 3-5 | front | armour only | 0/100 |
| z7_slime_medium | 7 | 61-70 | Medium | Slime | poison | 7,332 → 8,135 | 243 | 6 | 40 | 158 | 7.9% | 5.6% | 8.2% | 4.0% | 610 - 700 | 3-5 | front | armour only | 0/100 |
| z7_golem_large | 7 | 61-70 | Large | Golem | poison | 12,464 → 13,830 | 329 | 30 | 37 | 369 | 8.4% | 3.5% | 7.8% | 4.1% | 610 - 700 | alone | front | weapon | 100/0 |
| z7_golem_elite | 7 | 61-70 | Elite | Golem | poison | 46,434 → 51,522 | 1,028 | 30 | 37 | 369 | 8.4% | 3.5% | 7.8% | 4.1% | 1,830 - 2,100 | alone | front | weapon | 100/0 |
| z7_boss | 7 | 61-70 | Boss · Colossus | Golem | poison | 116,085 → 128,805 | 4,624 | 30 | 41 | 369 | 8.4% | 3.5% | 7.8% | 4.1% | 9,150 - 10,500 | alone | front | weapon | 100/0 |
| z8_kobold_small | 8 | 71-80 | Small | Kobold | chaos | 5,960 → 6,592 | 192 | 86 | 63 | 232 | 4.6% | 6.6% | 14.3% | 5.7% | 710 - 800 | 3-5 | front | weapon | 100/0 |
| z8_kobold_medium | 8 | 71-80 | Medium | Kobold | chaos | 8,515 → 9,417 | 274 | 86 | 57 | 232 | 4.6% | 6.6% | 14.3% | 5.7% | 710 - 800 | 3-5 | front | weapon | 100/0 |
| z8_troll_large | 8 | 71-80 | Large | Troll | chaos | 14,475 → 16,008 | 370 | 60 | 36 | 299 | 8.0% | 5.2% | 9.7% | 4.0% | 710 - 800 | alone | front | weapon | 100/0 |
| z8_troll_elite | 8 | 71-80 | Elite | Troll | chaos | 52,110 → 57,630 | 1,119 | 60 | 36 | 299 | 8.0% | 5.2% | 9.7% | 4.0% | 2,130 - 2,400 | alone | front | weapon | 100/0 |
| z8_minotaur_medium | 8 | 71-80 | Medium | Minotaur | chaos | 8,515 → 9,417 | 274 | 98 | 43 | 297 | 6.3% | 4.9% | 11.4% | 4.3% | 710 - 800 | 3-5 | front | weapon | 100/0 |
| z8_minotaur_large | 8 | 71-80 | Large | Minotaur | chaos | 14,475 → 16,008 | 370 | 98 | 39 | 297 | 6.3% | 4.9% | 11.4% | 4.3% | 710 - 800 | alone | front | weapon | 100/0 |
| z8_minotaur_elite | 8 | 71-80 | Elite | Minotaur | chaos | 52,110 → 57,630 | 1,119 | 98 | 39 | 297 | 6.3% | 4.9% | 11.4% | 4.3% | 2,130 - 2,400 | alone | front | weapon | 100/0 |
| z8_spider_small | 8 | 71-80 | Small | Spider | chaos | 5,960 → 6,592 | 192 | 101 | 74 | 156 | 4.4% | 6.1% | 14.5% | 6.7% | 710 - 800 | 3-5 | front | armour only | 100/0 |
| z8_spider_medium | 8 | 71-80 | Medium | Spider | chaos | 8,515 → 9,417 | 274 | 101 | 67 | 156 | 4.4% | 6.1% | 14.5% | 6.7% | 710 - 800 | 3-5 | front | armour only | 100/0 |
| z8_golem_large | 8 | 71-80 | Large | Golem | chaos | 14,475 → 16,008 | 370 | 30 | 37 | 369 | 8.4% | 3.5% | 7.1% | 4.1% | 710 - 800 | alone | front | weapon | 100/0 |
| z8_golem_elite | 8 | 71-80 | Elite | Golem | chaos | 52,110 → 57,630 | 1,119 | 30 | 37 | 369 | 8.4% | 3.5% | 7.1% | 4.1% | 2,130 - 2,400 | alone | front | weapon | 100/0 |
| z8_boss | 8 | 71-80 | Boss · Hoarder Kobold | Kobold | chaos | 130,275 → 144,075 | 5,034 | 86 | 57 | 232 | 4.6% | 6.6% | 14.3% | 5.7% | 10,650 - 12,000 | alone | front | weapon | 100/0 |
| z9_ogre_medium | 9 | 81-90 | Medium | Ogre | cold | 7,588 → 8,366 | 237 | 60 | 40 | 310 | 7.5% | 5.2% | 9.9% | 4.0% | 810 - 900 | 3-5 | front | weapon | 100/0 |
| z9_ogre_large | 9 | 81-90 | Large | Ogre | cold | 12,899 → 14,223 | 320 | 60 | 36 | 310 | 7.5% | 5.2% | 9.9% | 4.0% | 810 - 900 | alone | front | weapon | 100/0 |
| z9_ogre_elite | 9 | 81-90 | Elite | Ogre | cold | 58,272 → 64,254 | 1,215 | 60 | 36 | 310 | 7.5% | 5.2% | 9.9% | 4.0% | 2,430 - 2,700 | alone | front | weapon | 100/0 |
| z9_demon_medium | 9 | 81-90 | Medium | Demon | cold | 7,588 → 8,366 | 237 | 106 | 47 | 254 | 5.8% | 4.7% | 10.0% | 4.7% | 810 - 900 | 3-5 | stand-off | weapon | 50/50 |
| z9_demon_large | 9 | 81-90 | Large | Demon | cold | 12,899 → 14,223 | 320 | 106 | 42 | 254 | 5.8% | 4.7% | 10.0% | 4.7% | 810 - 900 | alone | stand-off | weapon | 50/50 |
| z9_demon_elite | 9 | 81-90 | Elite | Demon | cold | 58,272 → 64,254 | 1,215 | 106 | 42 | 254 | 5.8% | 4.7% | 10.0% | 4.7% | 2,430 - 2,700 | alone | stand-off | weapon | 50/50 |
| z9_golem_large | 9 | 81-90 | Large | Golem | cold | 12,899 → 14,223 | 320 | 30 | 37 | 369 | 8.4% | 3.5% | 6.4% | 4.1% | 810 - 900 | alone | front | weapon | 100/0 |
| z9_golem_elite | 9 | 81-90 | Elite | Golem | cold | 58,272 → 64,254 | 1,215 | 30 | 37 | 369 | 8.4% | 3.5% | 6.4% | 4.1% | 2,430 - 2,700 | alone | front | weapon | 100/0 |
| z9_dragon_medium | 9 | 81-90 | Medium | Dragon | cold | 7,588 → 8,366 | 237 | 132 | 44 | 321 | 7.0% | 4.1% | 8.2% | 4.4% | 810 - 900 | 3-5 | stand-off | weapon | 50/50 |
| z9_dragon_large | 9 | 81-90 | Large | Dragon | cold | 12,899 → 14,223 | 320 | 132 | 40 | 321 | 7.0% | 4.1% | 8.2% | 4.4% | 810 - 900 | alone | stand-off | weapon | 50/50 |
| z9_dragon_elite | 9 | 81-90 | Elite | Dragon | cold | 58,272 → 64,254 | 1,215 | 132 | 40 | 321 | 7.0% | 4.1% | 8.2% | 4.4% | 2,430 - 2,700 | alone | stand-off | weapon | 50/50 |
| z9_boss | 9 | 81-90 | Boss · Ogre King | Ogre | cold | 145,680 → 160,635 | 5,467 | 60 | 40 | 310 | 7.5% | 5.2% | 9.9% | 4.0% | 12,150 - 13,500 | alone | front | weapon | 100/0 |
| z10_troll_large | 10 | 91-100 | Large | Troll | chaos/poison | 16,469 → 18,433 | 405 | 60 | 36 | 299 | 8.0% | 5.2% | 8.2% | 4.0% | 910 - 1,000 | alone | front | weapon | 100/0 |
| z10_troll_elite | 10 | 91-100 | Elite | Troll | chaos/poison | 65,099 → 72,866 | 1,343 | 60 | 36 | 299 | 8.0% | 5.2% | 8.2% | 4.0% | 2,730 - 3,000 | alone | front | weapon | 100/0 |
| z10_wolf_small | 10 | 91-100 | Small | Wolf | chaos/poison | 6,781 → 7,590 | 210 | 168 | 61 | 245 | 5.0% | 5.6% | 12.3% | 5.6% | 910 - 1,000 | 1-2 | front | weapon | 100/0 |
| z10_wolf_medium | 10 | 91-100 | Medium | Wolf | chaos/poison | 9,687 → 10,843 | 300 | 168 | 56 | 245 | 5.0% | 5.6% | 12.3% | 5.6% | 910 - 1,000 | 1-2 | front | weapon | 100/0 |
| z10_dragon_medium | 10 | 91-100 | Medium | Dragon | poison | 9,687 → 10,843 | 300 | 132 | 44 | 321 | 7.0% | 4.1% | 7.6% | 4.4% | 910 - 1,000 | 1-2 | stand-off | weapon | 50/50 |
| z10_dragon_large | 10 | 91-100 | Large | Dragon | poison | 16,469 → 18,433 | 405 | 132 | 40 | 321 | 7.0% | 4.1% | 7.6% | 4.4% | 910 - 1,000 | alone | stand-off | weapon | 50/50 |
| z10_dragon_elite | 10 | 91-100 | Elite | Dragon | poison | 65,099 → 72,866 | 1,343 | 132 | 40 | 321 | 7.0% | 4.1% | 7.6% | 4.4% | 2,730 - 3,000 | alone | stand-off | weapon | 50/50 |
| z10_giant_large | 10 | 91-100 | Large | Giant | poison | 16,469 → 18,433 | 405 | 30 | 37 | 345 | 7.6% | 4.3% | 8.0% | 4.1% | 910 - 1,000 | alone | front | weapon | 100/0 |
| z10_giant_elite | 10 | 91-100 | Elite | Giant | poison | 65,099 → 72,866 | 1,343 | 30 | 37 | 345 | 7.6% | 4.3% | 8.0% | 4.1% | 2,730 - 3,000 | alone | front | weapon | 100/0 |
| z10_boss | 10 | 91-100 | Boss · Wolf King | Wolf | chaos/poison | 162,748 → 182,166 | 6,042 | 168 | 56 | 245 | 5.0% | 5.6% | 12.3% | 5.6% | 13,650 - 15,000 | alone | front | weapon | 100/0 |
| z11_skeleton_small | 11 | 101-110 | Small | Skeleton | chaos | 7,637 → 8,474 | 228 | 34 | 50 | 267 | 8.5% | 4.9% | 6.9% | 4.6% | 1,010 - 1,100 | 1-2 | front | weapon | 100/0 |
| z11_skeleton_medium | 11 | 101-110 | Medium | Skeleton | chaos | 10,909 → 12,105 | 326 | 34 | 46 | 267 | 8.5% | 4.9% | 6.9% | 4.6% | 1,010 - 1,100 | 1-2 | front | weapon | 100/0 |
| z11_skeleton_large | 11 | 101-110 | Large | Skeleton | chaos | 18,546 → 20,579 | 441 | 34 | 41 | 267 | 8.5% | 4.9% | 6.9% | 4.6% | 1,010 - 1,100 | alone | front | weapon | 100/0 |
| z11_skeleton_elite | 11 | 101-110 | Elite | Skeleton | chaos | 73,747 → 81,831 | 1,471 | 34 | 41 | 267 | 8.5% | 4.9% | 6.9% | 4.6% | 3,030 - 3,300 | alone | front | weapon | 100/0 |
| z11_vampire_medium | 11 | 101-110 | Medium | Vampire | chaos | 10,909 → 12,105 | 326 | 116 | 52 | 249 | 5.4% | 5.2% | 10.5% | 5.2% | 1,010 - 1,100 | 1-2 | stand-off | weapon | 50/50 |
| z11_vampire_large | 11 | 101-110 | Large | Vampire | chaos | 18,546 → 20,579 | 441 | 116 | 46 | 249 | 5.4% | 5.2% | 10.5% | 5.2% | 1,010 - 1,100 | alone | stand-off | weapon | 50/50 |
| z11_vampire_elite | 11 | 101-110 | Elite | Vampire | chaos | 73,747 → 81,831 | 1,471 | 116 | 46 | 249 | 5.4% | 5.2% | 10.5% | 5.2% | 3,030 - 3,300 | alone | stand-off | weapon | 50/50 |
| z11_demon_medium | 11 | 101-110 | Medium | Demon | chaos/cold | 10,909 → 12,105 | 326 | 106 | 47 | 254 | 5.8% | 4.7% | 9.0% | 4.7% | 1,010 - 1,100 | 1-2 | stand-off | weapon | 50/50 |
| z11_demon_large | 11 | 101-110 | Large | Demon | chaos/cold | 18,546 → 20,579 | 441 | 106 | 42 | 254 | 5.8% | 4.7% | 9.0% | 4.7% | 1,010 - 1,100 | alone | stand-off | weapon | 50/50 |
| z11_demon_elite | 11 | 101-110 | Elite | Demon | chaos/cold | 73,747 → 81,831 | 1,471 | 106 | 42 | 254 | 5.8% | 4.7% | 9.0% | 4.7% | 3,030 - 3,300 | alone | stand-off | weapon | 50/50 |
| z11_werewolf_medium | 11 | 101-110 | Medium | Werewolf | cold | 10,909 → 12,105 | 326 | 145 | 48 | 284 | 6.0% | 5.4% | 10.8% | 4.8% | 1,010 - 1,100 | 1-2 | front | weapon | 100/0 |
| z11_werewolf_large | 11 | 101-110 | Large | Werewolf | cold | 18,546 → 20,579 | 441 | 145 | 43 | 284 | 6.0% | 5.4% | 10.8% | 4.8% | 1,010 - 1,100 | alone | front | weapon | 100/0 |
| z11_werewolf_elite | 11 | 101-110 | Elite | Werewolf | cold | 73,747 → 81,831 | 1,471 | 145 | 43 | 284 | 6.0% | 5.4% | 10.8% | 4.8% | 3,030 - 3,300 | alone | front | weapon | 100/0 |
| z11_boss | 11 | 101-110 | Boss · Archdemon | Demon | chaos/cold | 184,368 → 204,578 | 6,617 | 106 | 47 | 254 | 5.8% | 4.7% | 9.0% | 4.7% | 15,150 - 16,500 | alone | stand-off | weapon | 50/50 |
| z12_demon_medium | 12 | 111-120 | Medium | Demon | chaos/poison | 13,065 → 14,392 | 379 | 106 | 47 | 254 | 5.8% | 4.7% | 8.7% | 4.7% | 1,110 - 1,200 | 1-2 | stand-off | weapon | 50/50 |
| z12_demon_large | 12 | 111-120 | Large | Demon | chaos/poison | 22,211 → 24,466 | 511 | 106 | 42 | 254 | 5.8% | 4.7% | 8.7% | 4.7% | 1,110 - 1,200 | alone | stand-off | weapon | 50/50 |
| z12_demon_elite | 12 | 111-120 | Elite | Demon | chaos/poison | 82,747 → 91,148 | 1,598 | 106 | 42 | 254 | 5.8% | 4.7% | 8.7% | 4.7% | 3,330 - 3,600 | alone | stand-off | weapon | 50/50 |
| z12_slime_small | 12 | 111-120 | Small | Slime | chaos/poison | 9,146 → 10,074 | 265 | 6 | 44 | 158 | 7.9% | 5.6% | 5.8% | 4.0% | 1,110 - 1,200 | 1-2 | front | armour only | 0/100 |
| z12_slime_medium | 12 | 111-120 | Medium | Slime | chaos/poison | 13,065 → 14,392 | 379 | 6 | 40 | 158 | 7.9% | 5.6% | 5.8% | 4.0% | 1,110 - 1,200 | 1-2 | front | armour only | 0/100 |
| z12_golem_large | 12 | 111-120 | Large | Golem | chaos/poison | 22,211 → 24,466 | 511 | 30 | 37 | 369 | 8.4% | 3.5% | 5.6% | 4.1% | 1,110 - 1,200 | alone | front | weapon | 100/0 |
| z12_golem_elite | 12 | 111-120 | Elite | Golem | chaos/poison | 82,747 → 91,148 | 1,598 | 30 | 37 | 369 | 8.4% | 3.5% | 5.6% | 4.1% | 3,330 - 3,600 | alone | front | weapon | 100/0 |
| z12_boss | 12 | 111-120 | Boss · Slime King | Slime | chaos/poison | 206,867 → 227,869 | 7,193 | 6 | 40 | 158 | 7.9% | 5.6% | 5.8% | 4.0% | 16,650 - 18,000 | alone | front | armour only | 0/100 |
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
| z14_goblin_small | 14 | 131-140 | Small | Goblin | poison | 12,749 → 13,881 | 348 | 118 | 58 | 280 | 5.3% | 5.9% | 9.8% | 5.3% | 1,310 - 1,400 | 2-3 | front | weapon | 100/0 |
| z14_goblin_medium | 14 | 131-140 | Medium | Goblin | poison | 18,213 → 19,830 | 498 | 118 | 53 | 280 | 5.3% | 5.9% | 9.8% | 5.3% | 1,310 - 1,400 | 2-3 | front | weapon | 100/0 |
| z14_goblin_large | 14 | 131-140 | Large | Goblin | poison | 30,963 → 33,711 | 672 | 118 | 47 | 280 | 5.3% | 5.9% | 9.8% | 5.3% | 1,310 - 1,400 | alone | front | weapon | 100/0 |
| z14_goblin_elite | 14 | 131-140 | Elite | Goblin | poison | 101,803 → 110,838 | 1,854 | 118 | 47 | 280 | 5.3% | 5.9% | 9.8% | 5.3% | 3,930 - 4,200 | alone | front | weapon | 100/0 |
| z14_spider_small | 14 | 131-140 | Small | Spider | poison | 12,749 → 13,881 | 348 | 101 | 74 | 156 | 4.4% | 6.1% | 11.0% | 6.7% | 1,310 - 1,400 | 2-3 | front | armour only | 100/0 |
| z14_spider_medium | 14 | 131-140 | Medium | Spider | poison | 18,213 → 19,830 | 498 | 101 | 67 | 156 | 4.4% | 6.1% | 11.0% | 6.7% | 1,310 - 1,400 | 2-3 | front | armour only | 100/0 |
| z14_wolf_small | 14 | 131-140 | Small | Wolf | poison | 12,749 → 13,881 | 348 | 168 | 61 | 245 | 5.0% | 5.6% | 11.0% | 5.6% | 1,310 - 1,400 | 2-3 | front | weapon | 100/0 |
| z14_wolf_medium | 14 | 131-140 | Medium | Wolf | poison | 18,213 → 19,830 | 498 | 168 | 56 | 245 | 5.0% | 5.6% | 11.0% | 5.6% | 1,310 - 1,400 | 2-3 | front | weapon | 100/0 |
| z14_werewolf_medium | 14 | 131-140 | Medium | Werewolf | poison | 18,213 → 19,830 | 498 | 145 | 48 | 284 | 6.0% | 5.4% | 10.0% | 4.8% | 1,310 - 1,400 | 2-3 | front | weapon | 100/0 |
| z14_werewolf_large | 14 | 131-140 | Large | Werewolf | poison | 30,963 → 33,711 | 672 | 145 | 43 | 284 | 6.0% | 5.4% | 10.0% | 4.8% | 1,310 - 1,400 | alone | front | weapon | 100/0 |
| z14_werewolf_elite | 14 | 131-140 | Elite | Werewolf | poison | 101,803 → 110,838 | 1,854 | 145 | 43 | 284 | 6.0% | 5.4% | 10.0% | 4.8% | 3,930 - 4,200 | alone | front | weapon | 100/0 |
| z14_boss | 14 | 131-140 | Boss · Broodmother | Spider | poison | 254,507 → 277,094 | 8,344 | 101 | 67 | 156 | 4.4% | 6.1% | 11.0% | 6.7% | 19,650 - 21,000 | alone | front | armour only | 100/0 |
| z15_ogre_medium | 15 | 141-150 | Medium | Ogre | cold | 20,012 → 21,686 | 532 | 60 | 40 | 310 | 7.5% | 5.2% | 7.9% | 4.0% | 1,410 - 1,500 | 2-3 | front | weapon | 100/0 |
| z15_ogre_large | 15 | 141-150 | Large | Ogre | cold | 34,021 → 36,865 | 718 | 60 | 36 | 310 | 7.5% | 5.2% | 7.9% | 4.0% | 1,410 - 1,500 | alone | front | weapon | 100/0 |
| z15_ogre_elite | 15 | 141-150 | Elite | Ogre | cold | 111,859 → 121,211 | 1,982 | 60 | 36 | 310 | 7.5% | 5.2% | 7.9% | 4.0% | 4,230 - 4,500 | alone | front | weapon | 100/0 |
| z15_slime_small | 15 | 141-150 | Small | Slime | fire/cold | 14,009 → 15,180 | 372 | 6 | 44 | 158 | 7.9% | 5.6% | 5.3% | 4.0% | 1,410 - 1,500 | 2-3 | front | armour only | 0/100 |
| z15_slime_medium | 15 | 141-150 | Medium | Slime | fire/cold | 20,012 → 21,686 | 532 | 6 | 40 | 158 | 7.9% | 5.6% | 5.3% | 4.0% | 1,410 - 1,500 | 2-3 | front | armour only | 0/100 |
| z15_spider_small | 15 | 141-150 | Small | Spider | cold | 14,009 → 15,180 | 372 | 101 | 74 | 156 | 4.4% | 6.1% | 10.7% | 6.7% | 1,410 - 1,500 | 2-3 | front | armour only | 100/0 |
| z15_spider_medium | 15 | 141-150 | Medium | Spider | cold | 20,012 → 21,686 | 532 | 101 | 67 | 156 | 4.4% | 6.1% | 10.7% | 6.7% | 1,410 - 1,500 | 2-3 | front | armour only | 100/0 |
| z15_lizardman_small | 15 | 141-150 | Small | Lizardman | cold | 14,009 → 15,180 | 372 | 116 | 57 | 252 | 5.4% | 6.3% | 10.1% | 5.2% | 1,410 - 1,500 | 2-3 | front | weapon | 100/0 |
| z15_lizardman_medium | 15 | 141-150 | Medium | Lizardman | cold | 20,012 → 21,686 | 532 | 116 | 52 | 252 | 5.4% | 6.3% | 10.1% | 5.2% | 1,410 - 1,500 | 2-3 | front | weapon | 100/0 |
| z15_lizardman_large | 15 | 141-150 | Large | Lizardman | cold | 34,021 → 36,865 | 718 | 116 | 46 | 252 | 5.4% | 6.3% | 10.1% | 5.2% | 1,410 - 1,500 | alone | front | weapon | 100/0 |
| z15_lizardman_elite | 15 | 141-150 | Elite | Lizardman | cold | 111,859 → 121,211 | 1,982 | 116 | 46 | 252 | 5.4% | 6.3% | 10.1% | 5.2% | 4,230 - 4,500 | alone | front | weapon | 100/0 |
| z15_boss | 15 | 141-150 | Boss · Lizardman Chief | Lizardman | cold | 279,648 → 303,027 | 8,919 | 116 | 52 | 252 | 5.4% | 6.3% | 10.1% | 5.2% | 21,150 - 22,500 | alone | front | weapon | 100/0 |
| z16_treant_large | 16 | 151-160 | Large | Treant | fire | 27,064 → 29,205 | 556 | 30 | 37 | 334 | 8.2% | 4.3% | 6.0% | 4.1% | 1,510 - 1,600 | alone | front | weapon | 100/0 |
| z16_treant_elite | 16 | 151-160 | Elite | Treant | fire | 122,268 → 131,936 | 2,110 | 30 | 37 | 334 | 8.2% | 4.3% | 6.0% | 4.1% | 4,530 - 4,800 | alone | front | weapon | 100/0 |
| z16_elf_medium | 16 | 151-160 | Medium | Elf | fire | 15,920 → 17,179 | 412 | 203 | 68 | 186 | 4.2% | 5.2% | 9.1% | 6.8% | 1,510 - 1,600 | 3-5 | stand-off | weapon | 50/50 |
| z16_elf_large | 16 | 151-160 | Large | Elf | fire | 27,064 → 29,205 | 556 | 203 | 61 | 186 | 4.2% | 5.2% | 9.1% | 6.8% | 1,510 - 1,600 | alone | stand-off | weapon | 50/50 |
| z16_elf_elite | 16 | 151-160 | Elite | Elf | fire | 122,268 → 131,936 | 2,110 | 203 | 61 | 186 | 4.2% | 5.2% | 9.1% | 6.8% | 4,530 - 4,800 | alone | stand-off | weapon | 50/50 |
| z16_werewolf_medium | 16 | 151-160 | Medium | Werewolf | fire | 15,920 → 17,179 | 412 | 145 | 48 | 284 | 6.0% | 5.4% | 9.4% | 4.8% | 1,510 - 1,600 | 3-5 | front | weapon | 100/0 |
| z16_werewolf_large | 16 | 151-160 | Large | Werewolf | fire | 27,064 → 29,205 | 556 | 145 | 43 | 284 | 6.0% | 5.4% | 9.4% | 4.8% | 1,510 - 1,600 | alone | front | weapon | 100/0 |
| z16_werewolf_elite | 16 | 151-160 | Elite | Werewolf | fire | 122,268 → 131,936 | 2,110 | 145 | 43 | 284 | 6.0% | 5.4% | 9.4% | 4.8% | 4,530 - 4,800 | alone | front | weapon | 100/0 |
| z16_dryad_medium | 16 | 151-160 | Medium | Dryad | fire | 15,920 → 17,179 | 412 | 95 | 63 | 158 | 4.8% | 5.3% | 7.8% | 6.3% | 1,510 - 1,600 | 3-5 | stand-off | armour only | 0/100 |
| z16_dryad_large | 16 | 151-160 | Large | Dryad | fire | 27,064 → 29,205 | 556 | 95 | 57 | 158 | 4.8% | 5.3% | 7.8% | 6.3% | 1,510 - 1,600 | alone | stand-off | armour only | 0/100 |
| z16_dryad_elite | 16 | 151-160 | Elite | Dryad | fire | 122,268 → 131,936 | 2,110 | 95 | 57 | 158 | 4.8% | 5.3% | 7.8% | 6.3% | 4,530 - 4,800 | alone | stand-off | armour only | 0/100 |
| z16_boss | 16 | 151-160 | Boss · Treant Elder | Treant | fire | 305,669 → 329,841 | 9,495 | 30 | 41 | 334 | 8.2% | 4.3% | 6.0% | 4.1% | 22,650 - 24,000 | alone | front | weapon | 100/0 |
| z17_treant_large | 17 | 161-170 | Large | Treant | lightning | 29,446 → 31,657 | 590 | 30 | 37 | 334 | 8.2% | 4.3% | 5.8% | 4.1% | 1,610 - 1,700 | alone | front | weapon | 100/0 |
| z17_treant_elite | 17 | 161-170 | Elite | Treant | lightning | 133,028 → 143,014 | 2,238 | 30 | 37 | 334 | 8.2% | 4.3% | 5.8% | 4.1% | 4,830 - 5,100 | alone | front | weapon | 100/0 |
| z17_elf_medium | 17 | 161-170 | Medium | Elf | lightning | 17,321 → 18,622 | 437 | 203 | 68 | 186 | 4.2% | 5.2% | 8.9% | 6.8% | 1,610 - 1,700 | 3-5 | stand-off | weapon | 50/50 |
| z17_elf_large | 17 | 161-170 | Large | Elf | lightning | 29,446 → 31,657 | 590 | 203 | 61 | 186 | 4.2% | 5.2% | 8.9% | 6.8% | 1,610 - 1,700 | alone | stand-off | weapon | 50/50 |
| z17_elf_elite | 17 | 161-170 | Elite | Elf | lightning | 133,028 → 143,014 | 2,238 | 203 | 61 | 186 | 4.2% | 5.2% | 8.9% | 6.8% | 4,830 - 5,100 | alone | stand-off | weapon | 50/50 |
| z17_werewolf_medium | 17 | 161-170 | Medium | Werewolf | lightning | 17,321 → 18,622 | 437 | 145 | 48 | 284 | 6.0% | 5.4% | 9.2% | 4.8% | 1,610 - 1,700 | 3-5 | front | weapon | 100/0 |
| z17_werewolf_large | 17 | 161-170 | Large | Werewolf | lightning | 29,446 → 31,657 | 590 | 145 | 43 | 284 | 6.0% | 5.4% | 9.2% | 4.8% | 1,610 - 1,700 | alone | front | weapon | 100/0 |
| z17_werewolf_elite | 17 | 161-170 | Elite | Werewolf | lightning | 133,028 → 143,014 | 2,238 | 145 | 43 | 284 | 6.0% | 5.4% | 9.2% | 4.8% | 4,830 - 5,100 | alone | front | weapon | 100/0 |
| z17_dryad_medium | 17 | 161-170 | Medium | Dryad | lightning | 17,321 → 18,622 | 437 | 95 | 63 | 158 | 4.8% | 5.3% | 7.6% | 6.3% | 1,610 - 1,700 | 3-5 | stand-off | armour only | 0/100 |
| z17_dryad_large | 17 | 161-170 | Large | Dryad | lightning | 29,446 → 31,657 | 590 | 95 | 57 | 158 | 4.8% | 5.3% | 7.6% | 6.3% | 1,610 - 1,700 | alone | stand-off | armour only | 0/100 |
| z17_dryad_elite | 17 | 161-170 | Elite | Dryad | lightning | 133,028 → 143,014 | 2,238 | 95 | 57 | 158 | 4.8% | 5.3% | 7.6% | 6.3% | 4,830 - 5,100 | alone | stand-off | armour only | 0/100 |
| z17_boss | 17 | 161-170 | Boss · Elven Archmage | Elf | lightning | 332,571 → 357,535 | 10,070 | 203 | 68 | 186 | 4.2% | 5.2% | 8.9% | 6.8% | 24,150 - 25,500 | alone | stand-off | weapon | 50/50 |
| z18_troll_large | 18 | 171-180 | Large | Troll | poison | 36,464 → 39,071 | 713 | 60 | 36 | 299 | 8.0% | 5.2% | 6.5% | 4.0% | 1,710 - 1,800 | alone | front | weapon | 100/0 |
| z18_troll_elite | 18 | 171-180 | Elite | Troll | poison | 144,141 → 154,444 | 2,366 | 60 | 36 | 299 | 8.0% | 5.2% | 6.5% | 4.0% | 5,130 - 5,400 | alone | front | weapon | 100/0 |
| z18_wolf_small | 18 | 171-180 | Small | Wolf | poison | 15,015 → 16,088 | 370 | 168 | 61 | 245 | 5.0% | 5.6% | 9.9% | 5.6% | 1,710 - 1,800 | 3-5 | front | weapon | 100/0 |
| z18_wolf_medium | 18 | 171-180 | Medium | Wolf | poison | 21,450 → 22,983 | 528 | 168 | 56 | 245 | 5.0% | 5.6% | 9.9% | 5.6% | 1,710 - 1,800 | 3-5 | front | weapon | 100/0 |
| z18_dragon_medium | 18 | 171-180 | Medium | Dragon | poison | 21,450 → 22,983 | 528 | 132 | 44 | 321 | 7.0% | 4.1% | 6.0% | 4.4% | 1,710 - 1,800 | 3-5 | stand-off | weapon | 50/50 |
| z18_dragon_large | 18 | 171-180 | Large | Dragon | poison | 36,464 → 39,071 | 713 | 132 | 40 | 321 | 7.0% | 4.1% | 6.0% | 4.4% | 1,710 - 1,800 | alone | stand-off | weapon | 50/50 |
| z18_dragon_elite | 18 | 171-180 | Elite | Dragon | poison | 144,141 → 154,444 | 2,366 | 132 | 40 | 321 | 7.0% | 4.1% | 6.0% | 4.4% | 5,130 - 5,400 | alone | stand-off | weapon | 50/50 |
| z18_giant_large | 18 | 171-180 | Large | Giant | poison | 36,464 → 39,071 | 713 | 30 | 37 | 345 | 7.6% | 4.3% | 6.4% | 4.1% | 1,710 - 1,800 | alone | front | weapon | 100/0 |
| z18_giant_elite | 18 | 171-180 | Elite | Giant | poison | 144,141 → 154,444 | 2,366 | 30 | 37 | 345 | 7.6% | 4.3% | 6.4% | 4.1% | 5,130 - 5,400 | alone | front | weapon | 100/0 |
| z18_boss | 18 | 171-180 | Boss · Ancient Dragon | Dragon | poison | 360,353 → 386,109 | 10,645 | 132 | 44 | 321 | 7.0% | 4.1% | 6.0% | 4.4% | 25,650 - 27,000 | alone | stand-off | weapon | 50/50 |

Every row is the mob's own stat block at the zone's **last** level (`mob stat = 108` × the species vector, flat with no level term), then by the body class: accuracy = Dex line × 1.5 × accuracy tier · evasion = Dex × 0.5 × body · armour = Str × 2 · res = Vit × 0.05 · crit = Lck × 0.05 · dodge = own Agi rate ÷ (rate + a same-level attacker's accuracy) (X24). HP is `mob_HP(L) × body` at both ends of the range, so a mob mid-range interpolates. XP is `10 × the mob's own level` with elite ×3 and boss ×15 (world.md XP), printed as a range because a mob spawns at the attacker's level, so it is read at both ends of the zone. `status gate` is the mob's own Elemental Alignment (`Dex × 0.05`, no Cap), the number that decides how often its innate Element status actually lands (combat.md section 2 step 9). A mob spawns at the attacker's level clamped into its zone's range; its innate Element is rolled with the species bias at ×3 against any other Element the zone carries at ×1; and `drops: weapon` means the lineage is allowed to be the source of a weapon-slot piece; `armour only` species still drop every other slot, so the 8% base drop rate, the quality floors and the whole stone funnel are untouched (loot.md sections 1-2 · gear, herbs, stones and junk are the four streams, and the **humanoid** lineages add a fifth, potions, on the derived chance **X49** prints).
<!-- END GENERATED:mob-roster -->

# Variant Drop Sheets

The junk stream is **variant**-bound: each rung of a ladder drops its own item, and the rung's rarity sets both the sell price and the per-kill chance — so rarity moves how often the junk falls, never how much gold a kill is worth. Only a rung the cast can actually field appears here: a normal rung is cast in some sub-zone, an Elite rung is the elite some sub-zone declares, and a Boss rung belongs to a species that owns a boss — a name nothing can spawn would be an item the Counterhand advertises and nothing ever pays. Every variant also carries a **lean**, the collectible stream it tilts toward, and the three normal rungs of a ladder cycle gear · herb · junk so the mix averages back to the balanced case. Gear, herbs and stones are the shared streams every variant pays, and a humanoid lineage adds the potion stream (loot.md).

<!-- BEGIN GENERATED:race-drop -->
| Variant | Species | junk drop | rarity | sell gold | junk per kill | lean | potion (humanoid) | gear stream | damage tag |
|---|---|---|---|---|---|---|---|---|---|
| Sneak Goblin | Goblin | Goblin Ear | common | 1 | 13.6% | gear | yes | weapon | physical |
| Raider Goblin | Goblin | Goblin Bile | uncommon | 5 | 2.7% | herb | yes | weapon | physical |
| Tinker Goblin | Goblin | Goblin Cog | rare | 25 | 0.5% | junk | yes | weapon | physical |
| Shaman Goblin | Goblin | Goblin Charm | rare | 25 | 0.5% | none | yes | weapon | physical |
| Goblin King | Goblin | Goblin Crown | rare | 25 | 0.5% | none | yes | weapon | physical |
| Raider Orc | Orc | Orc Warpaint | common | 1 | 13.6% | gear | yes | weapon | physical |
| Shaman Orc | Orc | Orc Tusk | uncommon | 5 | 2.7% | herb | yes | weapon | physical |
| Berserker Orc | Orc | Orc Skull | rare | 25 | 0.5% | junk | yes | weapon | physical |
| Juggernaut Orc | Orc | Orc Charm | rare | 25 | 0.5% | none | yes | weapon | physical |
| Warlord Orc | Orc | Orc Crown | rare | 25 | 0.5% | none | yes | weapon | physical |
| Miner Kobold | Kobold | Kobold Candle | common | 1 | 13.6% | gear | — | weapon | physical |
| Trapper Kobold | Kobold | Kobold Wire | uncommon | 5 | 2.7% | herb | — | weapon | physical |
| Tinker Kobold | Kobold | Kobold Vault Key | rare | 25 | 0.5% | junk | — | weapon | physical |
| Hoarder Kobold | Kobold | Kobold Crown | rare | 25 | 0.5% | none | — | weapon | physical |
| Brute Ogre | Ogre | Ogre Nail | common | 1 | 13.6% | gear | — | weapon | physical |
| Butcher Ogre | Ogre | Ogre Tooth | uncommon | 5 | 2.7% | herb | — | weapon | physical |
| Swamp Ogre | Ogre | Ogre Heartstone | rare | 25 | 0.5% | junk | — | weapon | physical |
| Mage Ogre | Ogre | Ogre Charm | rare | 25 | 0.5% | none | — | weapon | physical |
| Ogre King | Ogre | Ogre Crown | rare | 25 | 0.5% | none | — | weapon | physical |
| Cave Troll | Troll | Troll Nail | common | 1 | 13.6% | gear | — | weapon | physical |
| Forest Troll | Troll | Troll Hide | uncommon | 5 | 2.7% | herb | — | weapon | physical |
| Swamp Troll | Troll | Troll Heartstone | rare | 25 | 0.5% | junk | — | weapon | physical |
| Stone Troll | Troll | Troll Charm | rare | 25 | 0.5% | none | — | weapon | physical |
| Elder Troll | Troll | Troll Crown | rare | 25 | 0.5% | none | — | weapon | physical |
| Warrior Minotaur | Minotaur | Minotaur Hoof | common | 1 | 13.6% | gear | — | weapon | physical |
| Berserker Minotaur | Minotaur | Minotaur Chain | uncommon | 5 | 2.7% | herb | — | weapon | physical |
| Guardian Minotaur | Minotaur | Minotaur Horn | rare | 25 | 0.5% | junk | — | weapon | physical |
| Blood Minotaur | Minotaur | Minotaur Charm | rare | 25 | 0.5% | none | — | weapon | physical |
| Warrior Skeleton | Skeleton | Skeleton Bone | common | 1 | 13.6% | gear | — | weapon | physical |
| Archer Skeleton | Skeleton | Skeleton Marrow | uncommon | 5 | 2.7% | herb | — | weapon | physical |
| Knight Skeleton | Skeleton | Skeleton Sigil | rare | 25 | 0.5% | junk | — | weapon | physical |
| Mage Skeleton | Skeleton | Skeleton Charm | rare | 25 | 0.5% | none | — | weapon | physical |
| Bone Colossus | Skeleton | Skeleton Crown | rare | 25 | 0.5% | none | — | weapon | physical |
| Warrior Mummy | Mummy | Mummy Dust | common | 1 | 13.6% | gear | — | weapon | physical |
| Priest Mummy | Mummy | Mummy Bandage | uncommon | 5 | 2.7% | herb | — | weapon | physical |
| Cursed Mummy | Mummy | Mummy Glyph | rare | 25 | 0.5% | junk | — | weapon | physical |
| Royal Mummy | Mummy | Mummy Charm | rare | 25 | 0.5% | none | — | weapon | physical |
| Mummy Lord | Mummy | Mummy Crown | rare | 25 | 0.5% | none | — | weapon | physical |
| Blood Vampire | Vampire | Vampire Ash | common | 1 | 13.6% | gear | — | weapon | mixed |
| Noble Vampire | Vampire | Vampire Signet | uncommon | 5 | 2.7% | herb | — | weapon | mixed |
| Vampire Knight | Vampire | Vampire Fang | rare | 25 | 0.5% | junk | — | weapon | mixed |
| Vampire Lord | Vampire | Vampire Charm | rare | 25 | 0.5% | none | — | weapon | mixed |
| Ancient Vampire | Vampire | Vampire Crown | rare | 25 | 0.5% | none | — | weapon | mixed |
| Imp | Demon | Demon Ash | common | 1 | 13.6% | gear | — | weapon | mixed |
| Demon Mage | Demon | Demon Horn | uncommon | 5 | 2.7% | herb | — | weapon | mixed |
| Demon Brute | Demon | Demon Sigil | rare | 25 | 0.5% | junk | — | weapon | mixed |
| Demon Knight | Demon | Demon Charm | rare | 25 | 0.5% | none | — | weapon | mixed |
| Archdemon | Demon | Demon Crown | rare | 25 | 0.5% | none | — | weapon | mixed |
| Splitter Slime | Slime | Slime Jelly | common | 1 | 13.6% | gear | — | armour only | magic |
| Acid Slime | Slime | Slime Gland | uncommon | 5 | 2.7% | herb | — | armour only | magic |
| Devourer Slime | Slime | Slime Core | rare | 25 | 0.5% | junk | — | armour only | magic |
| Slime King | Slime | Slime Crown | rare | 25 | 0.5% | none | — | armour only | magic |
| Cave Spider | Spider | Spider Silk | common | 1 | 13.6% | gear | — | armour only | physical |
| Hunter Spider | Spider | Spider Fang | uncommon | 5 | 2.7% | herb | — | armour only | physical |
| Web Spider | Spider | Spider Spinneret | rare | 25 | 0.5% | junk | — | armour only | physical |
| Broodmother | Spider | Spider Crown | rare | 25 | 0.5% | none | — | armour only | physical |
| Hunting Wolf | Wolf | Wolf Pelt | common | 1 | 13.6% | gear | — | weapon | physical |
| Dire Wolf | Wolf | Wolf Fang | uncommon | 5 | 2.7% | herb | — | weapon | physical |
| Shadow Wolf | Wolf | Wolf Alpha Claw | rare | 25 | 0.5% | junk | — | weapon | physical |
| Wolf King | Wolf | Wolf Crown | rare | 25 | 0.5% | none | — | weapon | physical |
| Stone Golem | Golem | Golem Grit | common | 1 | 13.6% | gear | — | weapon | physical |
| Iron Golem | Golem | Golem Wire | uncommon | 5 | 2.7% | herb | — | weapon | physical |
| Guardian Golem | Golem | Golem Shard | rare | 25 | 0.5% | junk | — | weapon | physical |
| Crystal Golem | Golem | Golem Charm | rare | 25 | 0.5% | none | — | weapon | physical |
| Colossus | Golem | Golem Crown | rare | 25 | 0.5% | none | — | weapon | physical |
| Wyrmling | Dragon | Dragon Claw | common | 1 | 13.6% | gear | — | weapon | mixed |
| Drake | Dragon | Dragon Ichor | uncommon | 5 | 2.7% | herb | — | weapon | mixed |
| Wyvern | Dragon | Dragon Scale | rare | 25 | 0.5% | junk | — | weapon | mixed |
| Elder Dragon | Dragon | Dragon Charm | rare | 25 | 0.5% | none | — | weapon | mixed |
| Ancient Dragon | Dragon | Dragon Crown | rare | 25 | 0.5% | none | — | weapon | mixed |
| Young Treant | Treant | Treant Twig | common | 1 | 13.6% | gear | — | weapon | physical |
| Thorn Treant | Treant | Treant Bark | uncommon | 5 | 2.7% | herb | — | weapon | physical |
| Rotting Treant | Treant | Treant Heartwood | rare | 25 | 0.5% | junk | — | weapon | physical |
| Ancient Treant | Treant | Treant Charm | rare | 25 | 0.5% | none | — | weapon | physical |
| Treant Elder | Treant | Treant Crown | rare | 25 | 0.5% | none | — | weapon | physical |
| Ranger | Human | Militia Badge | common | 1 | 13.6% | gear | yes | weapon | physical |
| Warrior | Human | Veteran Seal | uncommon | 5 | 2.7% | herb | yes | weapon | physical |
| Knight | Human | Knight Crest | rare | 25 | 0.5% | junk | yes | weapon | physical |
| Mage | Human | Temple Charm | rare | 25 | 0.5% | none | yes | weapon | physical |
| Paladin | Human | Paladin Crown | rare | 25 | 0.5% | none | yes | weapon | physical |
| Hunter Lizardman | Lizardman | Lizardman Scale | common | 1 | 13.6% | gear | — | weapon | physical |
| Warrior Lizardman | Lizardman | Lizardman Talon | uncommon | 5 | 2.7% | herb | — | weapon | physical |
| Scale Knight | Lizardman | Lizardman Crest | rare | 25 | 0.5% | junk | — | weapon | physical |
| Shaman Lizardman | Lizardman | Lizardman Charm | rare | 25 | 0.5% | none | — | weapon | physical |
| Lizardman Chief | Lizardman | Lizardman Crown | rare | 25 | 0.5% | none | — | weapon | physical |
| Wood Elf | Elf | Elf Quill | common | 1 | 13.6% | gear | yes | weapon | mixed |
| High Elf | Elf | Elf Dust | uncommon | 5 | 2.7% | herb | yes | weapon | mixed |
| Moon Elf | Elf | Elf Runestone | rare | 25 | 0.5% | junk | yes | weapon | mixed |
| Dark Elf | Elf | Elf Charm | rare | 25 | 0.5% | none | yes | weapon | mixed |
| Elven Archmage | Elf | Elf Crown | rare | 25 | 0.5% | none | yes | weapon | mixed |
| Hill Giant | Giant | Giant Sinew | common | 1 | 13.6% | gear | — | weapon | physical |
| Stone Giant | Giant | Giant Knuckle | uncommon | 5 | 2.7% | herb | — | weapon | physical |
| Frost Giant | Giant | Giant Runestone | rare | 25 | 0.5% | junk | — | weapon | physical |
| Fire Giant | Giant | Giant Charm | rare | 25 | 0.5% | none | — | weapon | physical |
| Wolfman | Werewolf | Werewolf Pelt | common | 1 | 13.6% | gear | — | weapon | physical |
| Dire Werewolf | Werewolf | Werewolf Fang | uncommon | 5 | 2.7% | herb | — | weapon | physical |
| Blood Werewolf | Werewolf | Werewolf Claw | rare | 25 | 0.5% | junk | — | weapon | physical |
| Alpha Werewolf | Werewolf | Werewolf Charm | rare | 25 | 0.5% | none | — | weapon | physical |
| Forest Dryad | Dryad | Dryad Sap | common | 1 | 13.6% | gear | — | armour only | magic |
| Flower Dryad | Dryad | Dryad Blossom | uncommon | 5 | 2.7% | herb | — | armour only | magic |
| Thorn Dryad | Dryad | Dryad Heartwood | rare | 25 | 0.5% | junk | — | armour only | magic |

Every variant drops its own junk, and the five rungs of a ladder read as one family — a Goblin pays an Ear at Sneak, Bile at Raider, a Cog at Tinker, a Charm at Shaman and a Crown at the King — so a Counterhand visit tells the player which **variants** they farmed, not only which races. **Rarity buys frequency, never income**: each rarity's per-kill chance is the junk line divided by its own sell price (`junk.rarities`), so a variant's expected gold per kill is the same whatever rung it sits on, and a rarer rung simply drops less often for more gold — which is a bag-pressure trade, since junk stacks 999/slot. Rarity is bound to the variant, not to the level, so the same mob never changes what it pays as the player levels. The **lean** column is the collectible stream that variant tilts toward, applied through `leanReweight` (**X56**): the three normal rungs of every ladder cycle gear · herb · junk, so a zone's aggregate mix stays the identity and only the per-kill mix moves, while **Elite** and **Boss** carry `none` because they already pay their own stone lines. Only a rung the cast can field carries a row at all — a rung nothing spawns is an item nothing pays (**X39**). A **humanoid** lineage adds the potion stream (X49) and a **weapon-carrier** lineage is the only source of weapon-slot gear; gear, herbs and stones are the shared streams every variant pays (loot.md sections 1-2).
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
