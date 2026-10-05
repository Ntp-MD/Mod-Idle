# Mob Roster

import world.md
import combat.md
import formula-utility.md
import loot.md
import elements.md

The complete mob list, generated from `tools/data/engine.json` (`mob.zones` · `mob.species` · `mob.bosses` · `K`). Every entry a build can spawn is here: **15 species × 4 body classes across 9 zones**, plus Elite and the nine zone bosses. Nothing about mobs needs designing after this file — the only open mob questions are listed at the bottom.

**How to read a row** — one row is one spawnable mob type: an `id` a save can store, the zone and level range it lives in, and its numbers produced by the *player's own formulas* run over its own stat block (D-019). HP is given at both ends of the zone's range because `mob_HP(L)` is the curve, so a mob at a middle level interpolates between the two.

**The three axes stay independent** (world.md · `mob-sheet`): species is the lineage vector, body class is Small · Medium · Large (Boss is the fourth card size, Elite is a rarity flag forced onto a Large body), and innate Element is rolled per spawn inside the zone's own Elements. A body class **replaces** the multipliers, it never stacks with another body or with Elite.

# Cast Per Zone

<!-- BEGIN GENERATED:zone-cast -->
| Zone | Settlement | species on cast | Small · Medium · Large | Elite | Boss (species · name) | boss HP at zone edge | boss damage/sec | entries |
|---|---|---|---|---|---|---|---|---|
| 1 | Eastgate | 3 | 2 · 3 · 2 | 2 | Husk · Eastgate Emberling | 9,435 | 360 | 10 |
| 2 | Millbrook | 5 | 2 · 5 · 4 | 4 | Goblin · Millbrook Tallyman | 19,575 | 724 | 16 |
| 3 | Ashfall | 3 | 3 · 3 · 1 | 1 | Rat · Ashfall Chieftain | 27,360 | 981 | 9 |
| 4 | Ironrow | 4 | 3 · 3 · 2 | 2 | Bandit · Ironrow Warden | 60,495 | 2,104 | 11 |
| 5 | Wolf Cross | 6 | 3 · 5 · 3 | 3 | Slime · The Bloated Shepherd | 69,480 | 2,346 | 15 |
| 6 | Highspire | 6 | 2 · 5 · 4 | 4 | Troll · Highspire Herald | 79,395 | 2,605 | 16 |
| 7 | Bonegate | 6 | 1 · 5 · 5 | 5 | Orc · Bonegate Tyrant | 128,805 | 4,110 | 17 |
| 8 | Frosthold | 6 | 3 · 3 · 3 | 3 | Knight · Frosthold Siege-Marshal | 144,075 | 4,475 | 13 |
| 9 | Vermolch | 5 | 2 · 4 · 3 | 3 | Seraph · Vermolch Ninefold Choir | 160,635 | 4,859 | 13 |
| 10 | Thornwake | 6 | 1 · 5 · 5 | 5 | Drake · The Rootcoil | 182,166 | 5,371 | 17 |
| 11 | Greyfen | 6 | 1 · 5 · 5 | 5 | Demon · Greyfen Broodmother | 204,578 | 5,882 | 17 |
| 12 | Saltmarrow | 6 | 1 · 5 · 5 | 5 | Elf · The Salt Tyrant | 227,869 | 6,394 | 17 |
| 13 | Emberhold | 2 | 2 · 2 · 1 | 1 | Goblin · Emberhold Slagheart | 252,042 | 6,905 | 7 |
| 14 | Duskmoor | 5 | 4 · 4 · 1 | 1 | Wolf · Duskmoor Stalkers | 277,094 | 7,417 | 11 |
| 15 | Nettlecrag | 5 | 1 · 4 · 4 | 4 | Demon · The Nettle Hag | 303,027 | 7,928 | 14 |
| 16 | Blackwater Reach | 5 | 1 · 4 · 5 | 5 | Husk · The Drowned Choir | 329,841 | 8,440 | 16 |
| 17 | Wyrmback | 5 | 3 · 4 · 2 | 2 | Drake · Wyrmback Sovereign | 357,535 | 8,951 | 12 |
| 18 | The Pale Spire | 6 | 1 · 3 · 5 | 5 | Seraph · Pale Spire Silence | 386,109 | 9,463 | 15 |
<!-- END GENERATED:zone-cast -->

# Every Entry

<!-- BEGIN GENERATED:mob-roster -->
| id | Zone | Levels | Body | Species | innate Elements | HP (zone start → end) | damage/sec | accuracy | evasion | armour | res | crit | dodge | status gate | XP/kill | group | line | drops | phys/elem |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| z1_husk_medium | 1 | 1-10 | Medium | Husk | fire | 124 → 648 | 23 | 7 | 44 | 254 | 8.8% | 5.0% | 24.8% | 4.4% | 10 - 100 | 1-2 | front | armour only | 100/0 |
| z1_husk_large | 1 | 1-10 | Large | Husk | fire | 210 → 1,101 | 31 | 7 | 40 | 254 | 8.8% | 5.0% | 24.8% | 4.4% | 10 - 100 | alone | front | armour only | 100/0 |
| z1_husk_elite | 1 | 1-10 | Elite | Husk | fire | 720 → 3,774 | 90 | 7 | 40 | 254 | 8.8% | 5.0% | 24.8% | 4.4% | 30 - 300 | alone | front | armour only | 100/0 |
| z1_goblin_small | 1 | 1-10 | Small | Goblin | fire | 86 → 453 | 16 | 118 | 58 | 280 | 5.3% | 5.9% | 35.7% | 5.3% | 10 - 100 | 1-2 | front | weapon | 100/0 |
| z1_goblin_medium | 1 | 1-10 | Medium | Goblin | fire | 124 → 648 | 23 | 118 | 53 | 280 | 5.3% | 5.9% | 35.7% | 5.3% | 10 - 100 | 1-2 | front | weapon | 100/0 |
| z1_goblin_large | 1 | 1-10 | Large | Goblin | fire | 210 → 1,101 | 31 | 118 | 47 | 280 | 5.3% | 5.9% | 35.7% | 5.3% | 10 - 100 | alone | front | weapon | 100/0 |
| z1_goblin_elite | 1 | 1-10 | Elite | Goblin | fire | 720 → 3,774 | 90 | 118 | 47 | 280 | 5.3% | 5.9% | 35.7% | 5.3% | 30 - 300 | alone | front | weapon | 100/0 |
| z1_slime_small | 1 | 1-10 | Small | Slime | fire | 86 → 453 | 16 | 6 | 44 | 158 | 7.9% | 5.6% | 22.9% | 4.0% | 10 - 100 | 1-2 | front | armour only | 0/100 |
| z1_slime_medium | 1 | 1-10 | Medium | Slime | fire | 124 → 648 | 23 | 6 | 40 | 158 | 7.9% | 5.6% | 22.9% | 4.0% | 10 - 100 | 1-2 | front | armour only | 0/100 |
| z1_boss | 1 | 1-10 | Boss · Eastgate Emberling | Husk | fire | 1,800 → 9,435 | 360 | 7 | 44 | 254 | 8.8% | 5.0% | 24.8% | 4.4% | 150 - 1,500 | alone | front | armour only | 100/0 |
| z2_rat_small | 2 | 11-20 | Small | Rat | poison | 487 → 870 | 30 | 140 | 69 | 182 | 4.0% | 7.4% | 33.1% | 6.2% | 110 - 200 | 1-2 | front | armour only | 100/0 |
| z2_rat_medium | 2 | 11-20 | Medium | Rat | poison | 695 → 1,243 | 43 | 140 | 62 | 182 | 4.0% | 7.4% | 33.1% | 6.2% | 110 - 200 | 1-2 | front | armour only | 100/0 |
| z2_goblin_small | 2 | 11-20 | Small | Goblin | poison | 487 → 870 | 30 | 118 | 58 | 280 | 5.3% | 5.9% | 28.6% | 5.3% | 110 - 200 | 1-2 | front | weapon | 100/0 |
| z2_goblin_medium | 2 | 11-20 | Medium | Goblin | poison | 695 → 1,243 | 43 | 118 | 53 | 280 | 5.3% | 5.9% | 28.6% | 5.3% | 110 - 200 | 1-2 | front | weapon | 100/0 |
| z2_goblin_large | 2 | 11-20 | Large | Goblin | poison | 1,182 → 2,113 | 58 | 118 | 47 | 280 | 5.3% | 5.9% | 28.6% | 5.3% | 110 - 200 | alone | front | weapon | 100/0 |
| z2_goblin_elite | 2 | 11-20 | Elite | Goblin | poison | 4,380 → 7,830 | 181 | 118 | 47 | 280 | 5.3% | 5.9% | 28.6% | 5.3% | 330 - 600 | alone | front | weapon | 100/0 |
| z2_elf_medium | 2 | 11-20 | Medium | Elf | poison | 695 → 1,243 | 43 | 203 | 68 | 186 | 4.2% | 5.2% | 28.1% | 6.8% | 110 - 200 | 1-2 | stand-off | weapon | 50/50 |
| z2_elf_large | 2 | 11-20 | Large | Elf | poison | 1,182 → 2,113 | 58 | 203 | 61 | 186 | 4.2% | 5.2% | 28.1% | 6.8% | 110 - 200 | alone | stand-off | weapon | 50/50 |
| z2_elf_elite | 2 | 11-20 | Elite | Elf | poison | 4,380 → 7,830 | 181 | 203 | 61 | 186 | 4.2% | 5.2% | 28.1% | 6.8% | 330 - 600 | alone | stand-off | weapon | 50/50 |
| z2_demonic_medium | 2 | 11-20 | Medium | Demon | poison | 695 → 1,243 | 43 | 106 | 47 | 254 | 5.8% | 4.7% | 24.8% | 4.7% | 110 - 200 | 1-2 | stand-off | weapon | 50/50 |
| z2_demonic_large | 2 | 11-20 | Large | Demon | poison | 1,182 → 2,113 | 58 | 106 | 42 | 254 | 5.8% | 4.7% | 24.8% | 4.7% | 110 - 200 | alone | stand-off | weapon | 50/50 |
| z2_demonic_elite | 2 | 11-20 | Elite | Demon | poison | 4,380 → 7,830 | 181 | 106 | 42 | 254 | 5.8% | 4.7% | 24.8% | 4.7% | 330 - 600 | alone | stand-off | weapon | 50/50 |
| z2_drake_medium | 2 | 11-20 | Medium | Drake | poison | 695 → 1,243 | 43 | 140 | 47 | 271 | 5.7% | 4.7% | 24.6% | 4.7% | 110 - 200 | 1-2 | front | weapon | 50/50 |
| z2_drake_large | 2 | 11-20 | Large | Drake | poison | 1,182 → 2,113 | 58 | 140 | 42 | 271 | 5.7% | 4.7% | 24.6% | 4.7% | 110 - 200 | alone | front | weapon | 50/50 |
| z2_drake_elite | 2 | 11-20 | Elite | Drake | poison | 4,380 → 7,830 | 181 | 140 | 42 | 271 | 5.7% | 4.7% | 24.6% | 4.7% | 330 - 600 | alone | front | weapon | 50/50 |
| z2_boss | 2 | 11-20 | Boss · Millbrook Tallyman | Goblin | poison | 10,950 → 19,575 | 724 | 118 | 53 | 280 | 5.3% | 5.9% | 28.6% | 5.3% | 1,650 - 3,000 | alone | front | weapon | 100/0 |
| z3_rat_small | 3 | 21-30 | Small | Rat | fire | 1,149 → 1,459 | 49 | 140 | 69 | 182 | 4.0% | 7.4% | 27.9% | 6.2% | 210 - 300 | 1-2 | front | armour only | 100/0 |
| z3_rat_medium | 3 | 21-30 | Medium | Rat | fire | 1,641 → 2,085 | 70 | 140 | 62 | 182 | 4.0% | 7.4% | 27.9% | 6.2% | 210 - 300 | 1-2 | front | armour only | 100/0 |
| z3_goblin_small | 3 | 21-30 | Small | Goblin | fire | 1,149 → 1,459 | 49 | 118 | 58 | 280 | 5.3% | 5.9% | 23.8% | 5.3% | 210 - 300 | 1-2 | front | weapon | 100/0 |
| z3_goblin_medium | 3 | 21-30 | Medium | Goblin | fire | 1,641 → 2,085 | 70 | 118 | 53 | 280 | 5.3% | 5.9% | 23.8% | 5.3% | 210 - 300 | 1-2 | front | weapon | 100/0 |
| z3_goblin_large | 3 | 21-30 | Large | Goblin | fire | 2,790 → 3,544 | 95 | 118 | 47 | 280 | 5.3% | 5.9% | 23.8% | 5.3% | 210 - 300 | alone | front | weapon | 100/0 |
| z3_goblin_elite | 3 | 21-30 | Elite | Goblin | fire | 8,616 → 10,944 | 245 | 118 | 47 | 280 | 5.3% | 5.9% | 23.8% | 5.3% | 630 - 900 | alone | front | weapon | 100/0 |
| z3_bandit_small | 3 | 21-30 | Small | Bandit | fire | 1,149 → 1,459 | 49 | 138 | 67 | 245 | 5.0% | 5.6% | 21.5% | 6.1% | 210 - 300 | 1-2 | front | weapon | 100/0 |
| z3_bandit_medium | 3 | 21-30 | Medium | Bandit | fire | 1,641 → 2,085 | 70 | 138 | 61 | 245 | 5.0% | 5.6% | 21.5% | 6.1% | 210 - 300 | 1-2 | front | weapon | 100/0 |
| z3_boss | 3 | 21-30 | Boss · Ashfall Chieftain | Rat | fire | 21,540 → 27,360 | 981 | 140 | 62 | 182 | 4.0% | 7.4% | 27.9% | 6.2% | 3,150 - 4,500 | alone | front | armour only | 100/0 |
| z4_goblin_small | 4 | 31-40 | Small | Goblin | lightning | 2,688 → 3,057 | 100 | 118 | 58 | 280 | 5.3% | 5.9% | 20.4% | 5.3% | 310 - 400 | 2-3 | front | weapon | 100/0 |
| z4_goblin_medium | 4 | 31-40 | Medium | Goblin | lightning | 3,840 → 4,367 | 142 | 118 | 53 | 280 | 5.3% | 5.9% | 20.4% | 5.3% | 310 - 400 | 2-3 | front | weapon | 100/0 |
| z4_goblin_large | 4 | 31-40 | Large | Goblin | lightning | 6,527 → 7,424 | 192 | 118 | 47 | 280 | 5.3% | 5.9% | 20.4% | 5.3% | 310 - 400 | alone | front | weapon | 100/0 |
| z4_goblin_elite | 4 | 31-40 | Elite | Goblin | lightning | 21,276 → 24,198 | 526 | 118 | 47 | 280 | 5.3% | 5.9% | 20.4% | 5.3% | 930 - 1,200 | alone | front | weapon | 100/0 |
| z4_bandit_small | 4 | 31-40 | Small | Bandit | lightning | 2,688 → 3,057 | 100 | 138 | 67 | 245 | 5.0% | 5.6% | 18.3% | 6.1% | 310 - 400 | 2-3 | front | weapon | 100/0 |
| z4_bandit_medium | 4 | 31-40 | Medium | Bandit | lightning | 3,840 → 4,367 | 142 | 138 | 61 | 245 | 5.0% | 5.6% | 18.3% | 6.1% | 310 - 400 | 2-3 | front | weapon | 100/0 |
| z4_spider_small | 4 | 31-40 | Small | Spider | lightning | 2,688 → 3,057 | 100 | 101 | 74 | 156 | 4.4% | 6.1% | 22.6% | 6.7% | 310 - 400 | 2-3 | front | armour only | 100/0 |
| z4_spider_medium | 4 | 31-40 | Medium | Spider | lightning | 3,840 → 4,367 | 142 | 101 | 67 | 156 | 4.4% | 6.1% | 22.6% | 6.7% | 310 - 400 | 2-3 | front | armour only | 100/0 |
| z4_golem_large | 4 | 31-40 | Large | Golem | lightning | 6,527 → 7,424 | 192 | 30 | 37 | 369 | 8.4% | 3.5% | 11.6% | 4.1% | 310 - 400 | alone | front | weapon | 100/0 |
| z4_golem_elite | 4 | 31-40 | Elite | Golem | lightning | 21,276 → 24,198 | 526 | 30 | 37 | 369 | 8.4% | 3.5% | 11.6% | 4.1% | 930 - 1,200 | alone | front | weapon | 100/0 |
| z4_boss | 4 | 31-40 | Boss · Ironrow Warden | Bandit | lightning | 53,190 → 60,495 | 2,104 | 138 | 61 | 245 | 5.0% | 5.6% | 18.3% | 6.1% | 4,650 - 6,000 | alone | front | weapon | 100/0 |
| z5_slime_small | 5 | 41-50 | Small | Slime | cold | 2,943 → 3,333 | 106 | 6 | 44 | 158 | 7.9% | 5.6% | 10.4% | 4.0% | 410 - 500 | 2-3 | front | armour only | 0/100 |
| z5_slime_medium | 5 | 41-50 | Medium | Slime | cold | 4,205 → 4,762 | 151 | 6 | 40 | 158 | 7.9% | 5.6% | 10.4% | 4.0% | 410 - 500 | 2-3 | front | armour only | 0/100 |
| z5_bandit_small | 5 | 41-50 | Small | Bandit | cold | 2,943 → 3,333 | 106 | 138 | 67 | 245 | 5.0% | 5.6% | 16.0% | 6.1% | 410 - 500 | 2-3 | front | weapon | 100/0 |
| z5_bandit_medium | 5 | 41-50 | Medium | Bandit | cold | 4,205 → 4,762 | 151 | 138 | 61 | 245 | 5.0% | 5.6% | 16.0% | 6.1% | 410 - 500 | 2-3 | front | weapon | 100/0 |
| z5_spider_small | 5 | 41-50 | Small | Spider | cold | 2,943 → 3,333 | 106 | 101 | 74 | 156 | 4.4% | 6.1% | 19.8% | 6.7% | 410 - 500 | 2-3 | front | armour only | 100/0 |
| z5_spider_medium | 5 | 41-50 | Medium | Spider | cold | 4,205 → 4,762 | 151 | 101 | 67 | 156 | 4.4% | 6.1% | 19.8% | 6.7% | 410 - 500 | 2-3 | front | armour only | 100/0 |
| z5_demonic_medium | 5 | 41-50 | Medium | Demon | cold | 4,205 → 4,762 | 151 | 106 | 47 | 254 | 5.8% | 4.7% | 15.2% | 4.7% | 410 - 500 | 2-3 | stand-off | weapon | 50/50 |
| z5_demonic_large | 5 | 41-50 | Large | Demon | cold | 7,148 → 8,095 | 203 | 106 | 42 | 254 | 5.8% | 4.7% | 15.2% | 4.7% | 410 - 500 | alone | stand-off | weapon | 50/50 |
| z5_demonic_elite | 5 | 41-50 | Elite | Demon | cold | 24,540 → 27,792 | 587 | 106 | 42 | 254 | 5.8% | 4.7% | 15.2% | 4.7% | 1,230 - 1,500 | alone | stand-off | weapon | 50/50 |
| z5_golem_large | 5 | 41-50 | Large | Golem | cold | 7,148 → 8,095 | 203 | 30 | 37 | 369 | 8.4% | 3.5% | 10.0% | 4.1% | 410 - 500 | alone | front | weapon | 100/0 |
| z5_golem_elite | 5 | 41-50 | Elite | Golem | cold | 24,540 → 27,792 | 587 | 30 | 37 | 369 | 8.4% | 3.5% | 10.0% | 4.1% | 1,230 - 1,500 | alone | front | weapon | 100/0 |
| z5_drake_medium | 5 | 41-50 | Medium | Drake | cold | 4,205 → 4,762 | 151 | 140 | 47 | 271 | 5.7% | 4.7% | 15.1% | 4.7% | 410 - 500 | 2-3 | front | weapon | 50/50 |
| z5_drake_large | 5 | 41-50 | Large | Drake | cold | 7,148 → 8,095 | 203 | 140 | 42 | 271 | 5.7% | 4.7% | 15.1% | 4.7% | 410 - 500 | alone | front | weapon | 50/50 |
| z5_drake_elite | 5 | 41-50 | Elite | Drake | cold | 24,540 → 27,792 | 587 | 140 | 42 | 271 | 5.7% | 4.7% | 15.1% | 4.7% | 1,230 - 1,500 | alone | front | weapon | 50/50 |
| z5_boss | 5 | 41-50 | Boss · The Bloated Shepherd | Slime | cold | 61,350 → 69,480 | 2,346 | 6 | 40 | 158 | 7.9% | 5.6% | 10.4% | 4.0% | 6,150 - 7,500 | alone | front | armour only | 0/100 |
| z6_husk_medium | 6 | 51-60 | Medium | Husk | lightning | 4,472 → 5,041 | 155 | 7 | 44 | 254 | 8.8% | 5.0% | 10.1% | 4.4% | 510 - 600 | 2-3 | front | armour only | 100/0 |
| z6_husk_large | 6 | 51-60 | Large | Husk | lightning | 7,603 → 8,570 | 209 | 7 | 40 | 254 | 8.8% | 5.0% | 10.1% | 4.4% | 510 - 600 | alone | front | armour only | 100/0 |
| z6_husk_elite | 6 | 51-60 | Elite | Husk | lightning | 28,176 → 31,758 | 651 | 7 | 40 | 254 | 8.8% | 5.0% | 10.1% | 4.4% | 1,530 - 1,800 | alone | front | armour only | 100/0 |
| z6_slime_small | 6 | 51-60 | Small | Slime | lightning/cold | 3,131 → 3,529 | 109 | 6 | 44 | 158 | 7.9% | 5.6% | 9.2% | 4.0% | 510 - 600 | 2-3 | front | armour only | 0/100 |
| z6_slime_medium | 6 | 51-60 | Medium | Slime | lightning/cold | 4,472 → 5,041 | 155 | 6 | 40 | 158 | 7.9% | 5.6% | 9.2% | 4.0% | 510 - 600 | 2-3 | front | armour only | 0/100 |
| z6_spider_small | 6 | 51-60 | Small | Spider | lightning/cold | 3,131 → 3,529 | 109 | 101 | 74 | 156 | 4.4% | 6.1% | 17.7% | 6.7% | 510 - 600 | 2-3 | front | armour only | 100/0 |
| z6_spider_medium | 6 | 51-60 | Medium | Spider | lightning/cold | 4,472 → 5,041 | 155 | 101 | 67 | 156 | 4.4% | 6.1% | 17.7% | 6.7% | 510 - 600 | 2-3 | front | armour only | 100/0 |
| z6_orc_medium | 6 | 51-60 | Medium | Orc | cold | 4,472 → 5,041 | 155 | 90 | 40 | 321 | 6.9% | 5.2% | 14.5% | 4.0% | 510 - 600 | 2-3 | front | weapon | 100/0 |
| z6_orc_large | 6 | 51-60 | Large | Orc | cold | 7,603 → 8,570 | 209 | 90 | 36 | 321 | 6.9% | 5.2% | 14.5% | 4.0% | 510 - 600 | alone | front | weapon | 100/0 |
| z6_orc_elite | 6 | 51-60 | Elite | Orc | cold | 28,176 → 31,758 | 651 | 90 | 36 | 321 | 6.9% | 5.2% | 14.5% | 4.0% | 1,530 - 1,800 | alone | front | weapon | 100/0 |
| z6_troll_large | 6 | 51-60 | Large | Troll | cold | 7,603 → 8,570 | 209 | 60 | 36 | 299 | 8.0% | 5.2% | 12.0% | 4.0% | 510 - 600 | alone | front | weapon | 100/0 |
| z6_troll_elite | 6 | 51-60 | Elite | Troll | cold | 28,176 → 31,758 | 651 | 60 | 36 | 299 | 8.0% | 5.2% | 12.0% | 4.0% | 1,530 - 1,800 | alone | front | weapon | 100/0 |
| z6_drake_medium | 6 | 51-60 | Medium | Drake | cold | 4,472 → 5,041 | 155 | 140 | 47 | 271 | 5.7% | 4.7% | 13.3% | 4.7% | 510 - 600 | 2-3 | front | weapon | 50/50 |
| z6_drake_large | 6 | 51-60 | Large | Drake | cold | 7,603 → 8,570 | 209 | 140 | 42 | 271 | 5.7% | 4.7% | 13.3% | 4.7% | 510 - 600 | alone | front | weapon | 50/50 |
| z6_drake_elite | 6 | 51-60 | Elite | Drake | cold | 28,176 → 31,758 | 651 | 140 | 42 | 271 | 5.7% | 4.7% | 13.3% | 4.7% | 1,530 - 1,800 | alone | front | weapon | 50/50 |
| z6_boss | 6 | 51-60 | Boss · Highspire Herald | Troll | cold | 70,440 → 79,395 | 2,605 | 60 | 40 | 299 | 8.0% | 5.2% | 12.0% | 4.0% | 7,650 - 9,000 | alone | front | weapon | 100/0 |
| z7_wolf_small | 7 | 61-70 | Small | Wolf | chaos | 4,734 → 5,252 | 157 | 168 | 61 | 245 | 5.0% | 5.6% | 15.9% | 5.6% | 610 - 700 | 3-5 | front | weapon | 100/0 |
| z7_wolf_medium | 7 | 61-70 | Medium | Wolf | chaos | 6,762 → 7,503 | 224 | 168 | 56 | 245 | 5.0% | 5.6% | 15.9% | 5.6% | 610 - 700 | 3-5 | front | weapon | 100/0 |
| z7_orc_medium | 7 | 61-70 | Medium | Orc | chaos | 6,762 → 7,503 | 224 | 90 | 40 | 321 | 6.9% | 5.2% | 13.0% | 4.0% | 610 - 700 | 3-5 | front | weapon | 100/0 |
| z7_orc_large | 7 | 61-70 | Large | Orc | chaos | 11,496 → 12,755 | 303 | 90 | 36 | 321 | 6.9% | 5.2% | 13.0% | 4.0% | 610 - 700 | alone | front | weapon | 100/0 |
| z7_orc_elite | 7 | 61-70 | Elite | Orc | chaos | 46,434 → 51,522 | 1,028 | 90 | 36 | 321 | 6.9% | 5.2% | 13.0% | 4.0% | 1,830 - 2,100 | alone | front | weapon | 100/0 |
| z7_troll_large | 7 | 61-70 | Large | Troll | chaos | 11,496 → 12,755 | 303 | 60 | 36 | 299 | 8.0% | 5.2% | 10.7% | 4.0% | 610 - 700 | alone | front | weapon | 100/0 |
| z7_troll_elite | 7 | 61-70 | Elite | Troll | chaos | 46,434 → 51,522 | 1,028 | 60 | 36 | 299 | 8.0% | 5.2% | 10.7% | 4.0% | 1,830 - 2,100 | alone | front | weapon | 100/0 |
| z7_elf_medium | 7 | 61-70 | Medium | Elf | chaos | 6,762 → 7,503 | 224 | 203 | 68 | 186 | 4.2% | 5.2% | 14.0% | 6.8% | 610 - 700 | 3-5 | stand-off | weapon | 50/50 |
| z7_elf_large | 7 | 61-70 | Large | Elf | chaos | 11,496 → 12,755 | 303 | 203 | 61 | 186 | 4.2% | 5.2% | 14.0% | 6.8% | 610 - 700 | alone | stand-off | weapon | 50/50 |
| z7_elf_elite | 7 | 61-70 | Elite | Elf | chaos | 46,434 → 51,522 | 1,028 | 203 | 61 | 186 | 4.2% | 5.2% | 14.0% | 6.8% | 1,830 - 2,100 | alone | stand-off | weapon | 50/50 |
| z7_demonic_medium | 7 | 61-70 | Medium | Demon | chaos | 6,762 → 7,503 | 224 | 106 | 47 | 254 | 5.8% | 4.7% | 12.1% | 4.7% | 610 - 700 | 3-5 | stand-off | weapon | 50/50 |
| z7_demonic_large | 7 | 61-70 | Large | Demon | chaos | 11,496 → 12,755 | 303 | 106 | 42 | 254 | 5.8% | 4.7% | 12.1% | 4.7% | 610 - 700 | alone | stand-off | weapon | 50/50 |
| z7_demonic_elite | 7 | 61-70 | Elite | Demon | chaos | 46,434 → 51,522 | 1,028 | 106 | 42 | 254 | 5.8% | 4.7% | 12.1% | 4.7% | 1,830 - 2,100 | alone | stand-off | weapon | 50/50 |
| z7_seraph_medium | 7 | 61-70 | Medium | Seraph | chaos | 6,762 → 7,503 | 224 | 88 | 59 | 128 | 5.4% | 5.4% | 10.1% | 5.9% | 610 - 700 | 3-5 | stand-off | weapon | 0/100 |
| z7_seraph_large | 7 | 61-70 | Large | Seraph | chaos | 11,496 → 12,755 | 303 | 88 | 53 | 128 | 5.4% | 5.4% | 10.1% | 5.9% | 610 - 700 | alone | stand-off | weapon | 0/100 |
| z7_seraph_elite | 7 | 61-70 | Elite | Seraph | chaos | 46,434 → 51,522 | 1,028 | 88 | 53 | 128 | 5.4% | 5.4% | 10.1% | 5.9% | 1,830 - 2,100 | alone | stand-off | weapon | 0/100 |
| z7_boss | 7 | 61-70 | Boss · Bonegate Tyrant | Orc | chaos | 116,085 → 128,805 | 4,110 | 90 | 40 | 321 | 6.9% | 5.2% | 13.0% | 4.0% | 9,150 - 10,500 | alone | front | weapon | 100/0 |
| z8_slime_small | 8 | 71-80 | Small | Slime | cold | 6,289 → 6,955 | 203 | 6 | 44 | 158 | 7.9% | 5.6% | 7.4% | 4.0% | 710 - 800 | 3-5 | front | armour only | 0/100 |
| z8_slime_medium | 8 | 71-80 | Medium | Slime | cold | 8,984 → 9,936 | 289 | 6 | 40 | 158 | 7.9% | 5.6% | 7.4% | 4.0% | 710 - 800 | 3-5 | front | armour only | 0/100 |
| z8_bandit_small | 8 | 71-80 | Small | Bandit | cold | 6,289 → 6,955 | 203 | 138 | 67 | 245 | 5.0% | 5.6% | 11.5% | 6.1% | 710 - 800 | 3-5 | front | weapon | 100/0 |
| z8_bandit_medium | 8 | 71-80 | Medium | Bandit | cold | 8,984 → 9,936 | 289 | 138 | 61 | 245 | 5.0% | 5.6% | 11.5% | 6.1% | 710 - 800 | 3-5 | front | weapon | 100/0 |
| z8_spider_small | 8 | 71-80 | Small | Spider | cold | 6,289 → 6,955 | 203 | 101 | 74 | 156 | 4.4% | 6.1% | 14.5% | 6.7% | 710 - 800 | 3-5 | front | armour only | 100/0 |
| z8_spider_medium | 8 | 71-80 | Medium | Spider | cold | 8,984 → 9,936 | 289 | 101 | 67 | 156 | 4.4% | 6.1% | 14.5% | 6.7% | 710 - 800 | 3-5 | front | armour only | 100/0 |
| z8_troll_large | 8 | 71-80 | Large | Troll | cold | 15,274 → 16,892 | 391 | 60 | 36 | 299 | 8.0% | 5.2% | 9.7% | 4.0% | 710 - 800 | alone | front | weapon | 100/0 |
| z8_troll_elite | 8 | 71-80 | Elite | Troll | cold | 52,110 → 57,630 | 1,119 | 60 | 36 | 299 | 8.0% | 5.2% | 9.7% | 4.0% | 2,130 - 2,400 | alone | front | weapon | 100/0 |
| z8_golem_large | 8 | 71-80 | Large | Golem | cold | 15,274 → 16,892 | 391 | 30 | 37 | 369 | 8.4% | 3.5% | 7.1% | 4.1% | 710 - 800 | alone | front | weapon | 100/0 |
| z8_golem_elite | 8 | 71-80 | Elite | Golem | cold | 52,110 → 57,630 | 1,119 | 30 | 37 | 369 | 8.4% | 3.5% | 7.1% | 4.1% | 2,130 - 2,400 | alone | front | weapon | 100/0 |
| z8_knight_large | 8 | 71-80 | Large | Knight | cold | 15,274 → 16,892 | 391 | 35 | 42 | 280 | 8.2% | 4.7% | 8.7% | 4.7% | 710 - 800 | alone | front | weapon | 100/0 |
| z8_knight_elite | 8 | 71-80 | Elite | Knight | cold | 52,110 → 57,630 | 1,119 | 35 | 42 | 280 | 8.2% | 4.7% | 8.7% | 4.7% | 2,130 - 2,400 | alone | front | weapon | 100/0 |
| z8_boss | 8 | 71-80 | Boss · Frosthold Siege-Marshal | Knight | cold | 130,275 → 144,075 | 4,475 | 35 | 47 | 280 | 8.2% | 4.7% | 8.7% | 4.7% | 10,650 - 12,000 | alone | front | weapon | 100/0 |
| z9_rat_small | 9 | 81-90 | Small | Rat | poison | 6,681 → 7,366 | 209 | 140 | 69 | 182 | 4.0% | 7.4% | 14.4% | 6.2% | 810 - 900 | 3-5 | front | armour only | 100/0 |
| z9_rat_medium | 9 | 81-90 | Medium | Rat | poison | 9,544 → 10,523 | 298 | 140 | 62 | 182 | 4.0% | 7.4% | 14.4% | 6.2% | 810 - 900 | 3-5 | front | armour only | 100/0 |
| z9_husk_medium | 9 | 81-90 | Medium | Husk | poison | 9,544 → 10,523 | 298 | 7 | 44 | 254 | 8.8% | 5.0% | 7.4% | 4.4% | 810 - 900 | 3-5 | front | armour only | 100/0 |
| z9_husk_large | 9 | 81-90 | Large | Husk | poison | 16,224 → 17,890 | 403 | 7 | 40 | 254 | 8.8% | 5.0% | 7.4% | 4.4% | 810 - 900 | alone | front | armour only | 100/0 |
| z9_husk_elite | 9 | 81-90 | Elite | Husk | poison | 58,272 → 64,254 | 1,215 | 7 | 40 | 254 | 8.8% | 5.0% | 7.4% | 4.4% | 2,430 - 2,700 | alone | front | armour only | 100/0 |
| z9_wolf_small | 9 | 81-90 | Small | Wolf | chaos | 6,681 → 7,366 | 209 | 168 | 61 | 245 | 5.0% | 5.6% | 13.3% | 5.6% | 810 - 900 | 3-5 | front | weapon | 100/0 |
| z9_wolf_medium | 9 | 81-90 | Medium | Wolf | chaos | 9,544 → 10,523 | 298 | 168 | 56 | 245 | 5.0% | 5.6% | 13.3% | 5.6% | 810 - 900 | 3-5 | front | weapon | 100/0 |
| z9_golem_large | 9 | 81-90 | Large | Golem | chaos | 16,224 → 17,890 | 403 | 30 | 37 | 369 | 8.4% | 3.5% | 6.4% | 4.1% | 810 - 900 | alone | front | weapon | 100/0 |
| z9_golem_elite | 9 | 81-90 | Elite | Golem | chaos | 58,272 → 64,254 | 1,215 | 30 | 37 | 369 | 8.4% | 3.5% | 6.4% | 4.1% | 2,430 - 2,700 | alone | front | weapon | 100/0 |
| z9_seraph_medium | 9 | 81-90 | Medium | Seraph | poison/chaos | 9,544 → 10,523 | 298 | 88 | 59 | 128 | 5.4% | 5.4% | 8.3% | 5.9% | 810 - 900 | 3-5 | stand-off | weapon | 0/100 |
| z9_seraph_large | 9 | 81-90 | Large | Seraph | poison/chaos | 16,224 → 17,890 | 403 | 88 | 53 | 128 | 5.4% | 5.4% | 8.3% | 5.9% | 810 - 900 | alone | stand-off | weapon | 0/100 |
| z9_seraph_elite | 9 | 81-90 | Elite | Seraph | poison/chaos | 58,272 → 64,254 | 1,215 | 88 | 53 | 128 | 5.4% | 5.4% | 8.3% | 5.9% | 2,430 - 2,700 | alone | stand-off | weapon | 0/100 |
| z9_boss | 9 | 81-90 | Boss · Vermolch Ninefold Choir | Seraph | poison/chaos | 145,680 → 160,635 | 4,859 | 88 | 59 | 128 | 5.4% | 5.4% | 8.3% | 5.9% | 12,150 - 13,500 | alone | stand-off | weapon | 0/100 |
| z10_rat_small | 10 | 91-100 | Small | Rat | poison | 6,636 → 7,428 | 205 | 140 | 69 | 182 | 4.0% | 7.4% | 13.3% | 6.2% | 910 - 1,000 | 1-2 | front | armour only | 100/0 |
| z10_rat_medium | 10 | 91-100 | Medium | Rat | poison | 9,480 → 10,612 | 293 | 140 | 62 | 182 | 4.0% | 7.4% | 13.3% | 6.2% | 910 - 1,000 | 1-2 | front | armour only | 100/0 |
| z10_husk_medium | 10 | 91-100 | Medium | Husk | poison | 9,480 → 10,612 | 293 | 7 | 44 | 254 | 8.8% | 5.0% | 6.8% | 4.4% | 910 - 1,000 | 1-2 | front | armour only | 100/0 |
| z10_husk_large | 10 | 91-100 | Large | Husk | poison | 16,117 → 18,040 | 396 | 7 | 40 | 254 | 8.8% | 5.0% | 6.8% | 4.4% | 910 - 1,000 | alone | front | armour only | 100/0 |
| z10_husk_elite | 10 | 91-100 | Elite | Husk | poison | 65,099 → 72,866 | 1,343 | 7 | 40 | 254 | 8.8% | 5.0% | 6.8% | 4.4% | 2,730 - 3,000 | alone | front | armour only | 100/0 |
| z10_elf_medium | 10 | 91-100 | Medium | Elf | poison | 9,480 → 10,612 | 293 | 203 | 68 | 186 | 4.2% | 5.2% | 10.8% | 6.8% | 910 - 1,000 | 1-2 | stand-off | weapon | 50/50 |
| z10_elf_large | 10 | 91-100 | Large | Elf | poison | 16,117 → 18,040 | 396 | 203 | 61 | 186 | 4.2% | 5.2% | 10.8% | 6.8% | 910 - 1,000 | alone | stand-off | weapon | 50/50 |
| z10_elf_elite | 10 | 91-100 | Elite | Elf | poison | 65,099 → 72,866 | 1,343 | 203 | 61 | 186 | 4.2% | 5.2% | 10.8% | 6.8% | 2,730 - 3,000 | alone | stand-off | weapon | 50/50 |
| z10_knight_large | 10 | 91-100 | Large | Knight | poison | 16,117 → 18,040 | 396 | 35 | 42 | 280 | 8.2% | 4.7% | 7.3% | 4.7% | 910 - 1,000 | alone | front | weapon | 100/0 |
| z10_knight_elite | 10 | 91-100 | Elite | Knight | poison | 65,099 → 72,866 | 1,343 | 35 | 42 | 280 | 8.2% | 4.7% | 7.3% | 4.7% | 2,730 - 3,000 | alone | front | weapon | 100/0 |
| z10_drake_medium | 10 | 91-100 | Medium | Drake | poison | 9,480 → 10,612 | 293 | 140 | 47 | 271 | 5.7% | 4.7% | 9.1% | 4.7% | 910 - 1,000 | 1-2 | front | weapon | 50/50 |
| z10_drake_large | 10 | 91-100 | Large | Drake | poison | 16,117 → 18,040 | 396 | 140 | 42 | 271 | 5.7% | 4.7% | 9.1% | 4.7% | 910 - 1,000 | alone | front | weapon | 50/50 |
| z10_drake_elite | 10 | 91-100 | Elite | Drake | poison | 65,099 → 72,866 | 1,343 | 140 | 42 | 271 | 5.7% | 4.7% | 9.1% | 4.7% | 2,730 - 3,000 | alone | front | weapon | 50/50 |
| z10_seraph_medium | 10 | 91-100 | Medium | Seraph | poison | 9,480 → 10,612 | 293 | 88 | 59 | 128 | 5.4% | 5.4% | 7.7% | 5.9% | 910 - 1,000 | 1-2 | stand-off | weapon | 0/100 |
| z10_seraph_large | 10 | 91-100 | Large | Seraph | poison | 16,117 → 18,040 | 396 | 88 | 53 | 128 | 5.4% | 5.4% | 7.7% | 5.9% | 910 - 1,000 | alone | stand-off | weapon | 0/100 |
| z10_seraph_elite | 10 | 91-100 | Elite | Seraph | poison | 65,099 → 72,866 | 1,343 | 88 | 53 | 128 | 5.4% | 5.4% | 7.7% | 5.9% | 2,730 - 3,000 | alone | stand-off | weapon | 0/100 |
| z10_boss | 10 | 91-100 | Boss · The Rootcoil | Drake | poison | 162,748 → 182,166 | 5,371 | 140 | 47 | 271 | 5.7% | 4.7% | 9.1% | 4.7% | 13,650 - 15,000 | alone | front | weapon | 50/50 |
| z11_rat_small | 11 | 101-110 | Small | Rat | poison | 7,518 → 8,342 | 225 | 140 | 69 | 182 | 4.0% | 7.4% | 12.9% | 6.2% | 1,010 - 1,100 | 1-2 | front | armour only | 100/0 |
| z11_rat_medium | 11 | 101-110 | Medium | Rat | poison | 10,740 → 11,917 | 321 | 140 | 62 | 182 | 4.0% | 7.4% | 12.9% | 6.2% | 1,010 - 1,100 | 1-2 | front | armour only | 100/0 |
| z11_husk_medium | 11 | 101-110 | Medium | Husk | poison | 10,740 → 11,917 | 321 | 7 | 44 | 254 | 8.8% | 5.0% | 6.6% | 4.4% | 1,010 - 1,100 | 1-2 | front | armour only | 100/0 |
| z11_husk_large | 11 | 101-110 | Large | Husk | poison | 18,258 → 20,259 | 434 | 7 | 40 | 254 | 8.8% | 5.0% | 6.6% | 4.4% | 1,010 - 1,100 | alone | front | armour only | 100/0 |
| z11_husk_elite | 11 | 101-110 | Elite | Husk | poison | 73,747 → 81,831 | 1,471 | 7 | 40 | 254 | 8.8% | 5.0% | 6.6% | 4.4% | 3,030 - 3,300 | alone | front | armour only | 100/0 |
| z11_orc_medium | 11 | 101-110 | Medium | Orc | chaos | 10,740 → 11,917 | 321 | 90 | 40 | 321 | 6.9% | 5.2% | 9.7% | 4.0% | 1,010 - 1,100 | 1-2 | front | weapon | 100/0 |
| z11_orc_large | 11 | 101-110 | Large | Orc | chaos | 18,258 → 20,259 | 434 | 90 | 36 | 321 | 6.9% | 5.2% | 9.7% | 4.0% | 1,010 - 1,100 | alone | front | weapon | 100/0 |
| z11_orc_elite | 11 | 101-110 | Elite | Orc | chaos | 73,747 → 81,831 | 1,471 | 90 | 36 | 321 | 6.9% | 5.2% | 9.7% | 4.0% | 3,030 - 3,300 | alone | front | weapon | 100/0 |
| z11_demonic_medium | 11 | 101-110 | Medium | Demon | chaos/poison | 10,740 → 11,917 | 321 | 106 | 47 | 254 | 5.8% | 4.7% | 9.0% | 4.7% | 1,010 - 1,100 | 1-2 | stand-off | weapon | 50/50 |
| z11_demonic_large | 11 | 101-110 | Large | Demon | chaos/poison | 18,258 → 20,259 | 434 | 106 | 42 | 254 | 5.8% | 4.7% | 9.0% | 4.7% | 1,010 - 1,100 | alone | stand-off | weapon | 50/50 |
| z11_demonic_elite | 11 | 101-110 | Elite | Demon | chaos/poison | 73,747 → 81,831 | 1,471 | 106 | 42 | 254 | 5.8% | 4.7% | 9.0% | 4.7% | 3,030 - 3,300 | alone | stand-off | weapon | 50/50 |
| z11_golem_large | 11 | 101-110 | Large | Golem | chaos | 18,258 → 20,259 | 434 | 30 | 37 | 369 | 8.4% | 3.5% | 5.7% | 4.1% | 1,010 - 1,100 | alone | front | weapon | 100/0 |
| z11_golem_elite | 11 | 101-110 | Elite | Golem | chaos | 73,747 → 81,831 | 1,471 | 30 | 37 | 369 | 8.4% | 3.5% | 5.7% | 4.1% | 3,030 - 3,300 | alone | front | weapon | 100/0 |
| z11_seraph_medium | 11 | 101-110 | Medium | Seraph | poison/chaos | 10,740 → 11,917 | 321 | 88 | 59 | 128 | 5.4% | 5.4% | 7.4% | 5.9% | 1,010 - 1,100 | 1-2 | stand-off | weapon | 0/100 |
| z11_seraph_large | 11 | 101-110 | Large | Seraph | poison/chaos | 18,258 → 20,259 | 434 | 88 | 53 | 128 | 5.4% | 5.4% | 7.4% | 5.9% | 1,010 - 1,100 | alone | stand-off | weapon | 0/100 |
| z11_seraph_elite | 11 | 101-110 | Elite | Seraph | poison/chaos | 73,747 → 81,831 | 1,471 | 88 | 53 | 128 | 5.4% | 5.4% | 7.4% | 5.9% | 3,030 - 3,300 | alone | stand-off | weapon | 0/100 |
| z11_boss | 11 | 101-110 | Boss · Greyfen Broodmother | Demon | chaos/poison | 184,368 → 204,578 | 5,882 | 106 | 47 | 254 | 5.8% | 4.7% | 9.0% | 4.7% | 15,150 - 16,500 | alone | stand-off | weapon | 50/50 |
| z12_wolf_small | 12 | 111-120 | Small | Wolf | chaos | 8,435 → 9,292 | 244 | 168 | 61 | 245 | 5.0% | 5.6% | 11.6% | 5.6% | 1,110 - 1,200 | 1-2 | front | weapon | 100/0 |
| z12_wolf_medium | 12 | 111-120 | Medium | Wolf | chaos | 12,051 → 13,274 | 349 | 168 | 56 | 245 | 5.0% | 5.6% | 11.6% | 5.6% | 1,110 - 1,200 | 1-2 | front | weapon | 100/0 |
| z12_orc_medium | 12 | 111-120 | Medium | Orc | chaos | 12,051 → 13,274 | 349 | 90 | 40 | 321 | 6.9% | 5.2% | 9.4% | 4.0% | 1,110 - 1,200 | 1-2 | front | weapon | 100/0 |
| z12_orc_large | 12 | 111-120 | Large | Orc | chaos | 20,486 → 22,566 | 471 | 90 | 36 | 321 | 6.9% | 5.2% | 9.4% | 4.0% | 1,110 - 1,200 | alone | front | weapon | 100/0 |
| z12_orc_elite | 12 | 111-120 | Elite | Orc | chaos | 82,747 → 91,148 | 1,598 | 90 | 36 | 321 | 6.9% | 5.2% | 9.4% | 4.0% | 3,330 - 3,600 | alone | front | weapon | 100/0 |
| z12_troll_large | 12 | 111-120 | Large | Troll | chaos | 20,486 → 22,566 | 471 | 60 | 36 | 299 | 8.0% | 5.2% | 7.7% | 4.0% | 1,110 - 1,200 | alone | front | weapon | 100/0 |
| z12_troll_elite | 12 | 111-120 | Elite | Troll | chaos | 82,747 → 91,148 | 1,598 | 60 | 36 | 299 | 8.0% | 5.2% | 7.7% | 4.0% | 3,330 - 3,600 | alone | front | weapon | 100/0 |
| z12_elf_medium | 12 | 111-120 | Medium | Elf | chaos | 12,051 → 13,274 | 349 | 203 | 68 | 186 | 4.2% | 5.2% | 10.1% | 6.8% | 1,110 - 1,200 | 1-2 | stand-off | weapon | 50/50 |
| z12_elf_large | 12 | 111-120 | Large | Elf | chaos | 20,486 → 22,566 | 471 | 203 | 61 | 186 | 4.2% | 5.2% | 10.1% | 6.8% | 1,110 - 1,200 | alone | stand-off | weapon | 50/50 |
| z12_elf_elite | 12 | 111-120 | Elite | Elf | chaos | 82,747 → 91,148 | 1,598 | 203 | 61 | 186 | 4.2% | 5.2% | 10.1% | 6.8% | 3,330 - 3,600 | alone | stand-off | weapon | 50/50 |
| z12_demonic_medium | 12 | 111-120 | Medium | Demon | chaos | 12,051 → 13,274 | 349 | 106 | 47 | 254 | 5.8% | 4.7% | 8.7% | 4.7% | 1,110 - 1,200 | 1-2 | stand-off | weapon | 50/50 |
| z12_demonic_large | 12 | 111-120 | Large | Demon | chaos | 20,486 → 22,566 | 471 | 106 | 42 | 254 | 5.8% | 4.7% | 8.7% | 4.7% | 1,110 - 1,200 | alone | stand-off | weapon | 50/50 |
| z12_demonic_elite | 12 | 111-120 | Elite | Demon | chaos | 82,747 → 91,148 | 1,598 | 106 | 42 | 254 | 5.8% | 4.7% | 8.7% | 4.7% | 3,330 - 3,600 | alone | stand-off | weapon | 50/50 |
| z12_seraph_medium | 12 | 111-120 | Medium | Seraph | chaos | 12,051 → 13,274 | 349 | 88 | 59 | 128 | 5.4% | 5.4% | 7.2% | 5.9% | 1,110 - 1,200 | 1-2 | stand-off | weapon | 0/100 |
| z12_seraph_large | 12 | 111-120 | Large | Seraph | chaos | 20,486 → 22,566 | 471 | 88 | 53 | 128 | 5.4% | 5.4% | 7.2% | 5.9% | 1,110 - 1,200 | alone | stand-off | weapon | 0/100 |
| z12_seraph_elite | 12 | 111-120 | Elite | Seraph | chaos | 82,747 → 91,148 | 1,598 | 88 | 53 | 128 | 5.4% | 5.4% | 7.2% | 5.9% | 3,330 - 3,600 | alone | stand-off | weapon | 0/100 |
| z12_boss | 12 | 111-120 | Boss · The Salt Tyrant | Elf | chaos | 206,867 → 227,869 | 6,394 | 203 | 68 | 186 | 4.2% | 5.2% | 10.1% | 6.8% | 16,650 - 18,000 | alone | stand-off | weapon | 50/50 |
| z13_rat_small | 13 | 121-130 | Small | Rat | fire | 11,939 → 13,069 | 336 | 140 | 69 | 182 | 4.0% | 7.4% | 12.2% | 6.2% | 1,210 - 1,300 | 2-3 | front | armour only | 100/0 |
| z13_rat_medium | 13 | 121-130 | Medium | Rat | fire | 17,055 → 18,670 | 480 | 140 | 62 | 182 | 4.0% | 7.4% | 12.2% | 6.2% | 1,210 - 1,300 | 2-3 | front | armour only | 100/0 |
| z13_goblin_small | 13 | 121-130 | Small | Goblin | fire | 11,939 → 13,069 | 336 | 118 | 58 | 280 | 5.3% | 5.9% | 10.1% | 5.3% | 1,210 - 1,300 | 2-3 | front | weapon | 100/0 |
| z13_goblin_medium | 13 | 121-130 | Medium | Goblin | fire | 17,055 → 18,670 | 480 | 118 | 53 | 280 | 5.3% | 5.9% | 10.1% | 5.3% | 1,210 - 1,300 | 2-3 | front | weapon | 100/0 |
| z13_goblin_large | 13 | 121-130 | Large | Goblin | fire | 28,994 → 31,739 | 647 | 118 | 47 | 280 | 5.3% | 5.9% | 10.1% | 5.3% | 1,210 - 1,300 | alone | front | weapon | 100/0 |
| z13_goblin_elite | 13 | 121-130 | Elite | Goblin | fire | 92,099 → 100,817 | 1,726 | 118 | 47 | 280 | 5.3% | 5.9% | 10.1% | 5.3% | 3,630 - 3,900 | alone | front | weapon | 100/0 |
| z13_boss | 13 | 121-130 | Boss · Emberhold Slagheart | Goblin | fire | 230,247 → 252,042 | 6,905 | 118 | 53 | 280 | 5.3% | 5.9% | 10.1% | 5.3% | 18,150 - 19,500 | alone | front | weapon | 100/0 |
| z14_slime_small | 14 | 131-140 | Small | Slime | cold | 13,780 → 15,003 | 376 | 6 | 44 | 158 | 7.9% | 5.6% | 5.5% | 4.0% | 1,310 - 1,400 | 2-3 | front | armour only | 0/100 |
| z14_slime_medium | 14 | 131-140 | Medium | Slime | cold | 19,686 → 21,433 | 538 | 6 | 40 | 158 | 7.9% | 5.6% | 5.5% | 4.0% | 1,310 - 1,400 | 2-3 | front | armour only | 0/100 |
| z14_bandit_small | 14 | 131-140 | Small | Bandit | cold | 13,780 → 15,003 | 376 | 138 | 67 | 245 | 5.0% | 5.6% | 8.7% | 6.1% | 1,310 - 1,400 | 2-3 | front | weapon | 100/0 |
| z14_bandit_medium | 14 | 131-140 | Medium | Bandit | cold | 19,686 → 21,433 | 538 | 138 | 61 | 245 | 5.0% | 5.6% | 8.7% | 6.1% | 1,310 - 1,400 | 2-3 | front | weapon | 100/0 |
| z14_spider_small | 14 | 131-140 | Small | Spider | cold | 13,780 → 15,003 | 376 | 101 | 74 | 156 | 4.4% | 6.1% | 11.0% | 6.7% | 1,310 - 1,400 | 2-3 | front | armour only | 100/0 |
| z14_spider_medium | 14 | 131-140 | Medium | Spider | cold | 19,686 → 21,433 | 538 | 101 | 67 | 156 | 4.4% | 6.1% | 11.0% | 6.7% | 1,310 - 1,400 | 2-3 | front | armour only | 100/0 |
| z14_wolf_small | 14 | 131-140 | Small | Wolf | cold/chaos | 13,780 → 15,003 | 376 | 168 | 61 | 245 | 5.0% | 5.6% | 11.0% | 5.6% | 1,310 - 1,400 | 2-3 | front | weapon | 100/0 |
| z14_wolf_medium | 14 | 131-140 | Medium | Wolf | cold/chaos | 19,686 → 21,433 | 538 | 168 | 56 | 245 | 5.0% | 5.6% | 11.0% | 5.6% | 1,310 - 1,400 | 2-3 | front | weapon | 100/0 |
| z14_knight_large | 14 | 131-140 | Large | Knight | cold/chaos | 33,466 → 36,436 | 726 | 35 | 42 | 280 | 8.2% | 4.7% | 6.5% | 4.7% | 1,310 - 1,400 | alone | front | weapon | 100/0 |
| z14_knight_elite | 14 | 131-140 | Elite | Knight | cold/chaos | 101,803 → 110,838 | 1,854 | 35 | 42 | 280 | 8.2% | 4.7% | 6.5% | 4.7% | 3,930 - 4,200 | alone | front | weapon | 100/0 |
| z14_boss | 14 | 131-140 | Boss · Duskmoor Stalkers | Wolf | cold/chaos | 254,507 → 277,094 | 7,417 | 168 | 56 | 245 | 5.0% | 5.6% | 11.0% | 5.6% | 19,650 - 21,000 | alone | front | weapon | 100/0 |
| z15_wolf_small | 15 | 141-150 | Small | Wolf | chaos | 11,583 → 12,551 | 308 | 168 | 61 | 245 | 5.0% | 5.6% | 10.7% | 5.6% | 1,410 - 1,500 | 2-3 | front | weapon | 100/0 |
| z15_wolf_medium | 15 | 141-150 | Medium | Wolf | chaos | 16,547 → 17,931 | 440 | 168 | 56 | 245 | 5.0% | 5.6% | 10.7% | 5.6% | 1,410 - 1,500 | 2-3 | front | weapon | 100/0 |
| z15_orc_medium | 15 | 141-150 | Medium | Orc | chaos | 16,547 → 17,931 | 440 | 90 | 40 | 321 | 6.9% | 5.2% | 8.7% | 4.0% | 1,410 - 1,500 | 2-3 | front | weapon | 100/0 |
| z15_orc_large | 15 | 141-150 | Large | Orc | chaos | 28,130 → 30,482 | 594 | 90 | 36 | 321 | 6.9% | 5.2% | 8.7% | 4.0% | 1,410 - 1,500 | alone | front | weapon | 100/0 |
| z15_orc_elite | 15 | 141-150 | Elite | Orc | chaos | 111,859 → 121,211 | 1,982 | 90 | 36 | 321 | 6.9% | 5.2% | 8.7% | 4.0% | 4,230 - 4,500 | alone | front | weapon | 100/0 |
| z15_troll_large | 15 | 141-150 | Large | Troll | chaos | 28,130 → 30,482 | 594 | 60 | 36 | 299 | 8.0% | 5.2% | 7.1% | 4.0% | 1,410 - 1,500 | alone | front | weapon | 100/0 |
| z15_troll_elite | 15 | 141-150 | Elite | Troll | chaos | 111,859 → 121,211 | 1,982 | 60 | 36 | 299 | 8.0% | 5.2% | 7.1% | 4.0% | 4,230 - 4,500 | alone | front | weapon | 100/0 |
| z15_elf_medium | 15 | 141-150 | Medium | Elf | chaos/poison | 16,547 → 17,931 | 440 | 203 | 68 | 186 | 4.2% | 5.2% | 9.3% | 6.8% | 1,410 - 1,500 | 2-3 | stand-off | weapon | 50/50 |
| z15_elf_large | 15 | 141-150 | Large | Elf | chaos/poison | 28,130 → 30,482 | 594 | 203 | 61 | 186 | 4.2% | 5.2% | 9.3% | 6.8% | 1,410 - 1,500 | alone | stand-off | weapon | 50/50 |
| z15_elf_elite | 15 | 141-150 | Elite | Elf | chaos/poison | 111,859 → 121,211 | 1,982 | 203 | 61 | 186 | 4.2% | 5.2% | 9.3% | 6.8% | 4,230 - 4,500 | alone | stand-off | weapon | 50/50 |
| z15_demonic_medium | 15 | 141-150 | Medium | Demon | chaos/poison | 16,547 → 17,931 | 440 | 106 | 47 | 254 | 5.8% | 4.7% | 8.0% | 4.7% | 1,410 - 1,500 | 2-3 | stand-off | weapon | 50/50 |
| z15_demonic_large | 15 | 141-150 | Large | Demon | chaos/poison | 28,130 → 30,482 | 594 | 106 | 42 | 254 | 5.8% | 4.7% | 8.0% | 4.7% | 1,410 - 1,500 | alone | stand-off | weapon | 50/50 |
| z15_demonic_elite | 15 | 141-150 | Elite | Demon | chaos/poison | 111,859 → 121,211 | 1,982 | 106 | 42 | 254 | 5.8% | 4.7% | 8.0% | 4.7% | 4,230 - 4,500 | alone | stand-off | weapon | 50/50 |
| z15_boss | 15 | 141-150 | Boss · The Nettle Hag | Demon | chaos/poison | 279,648 → 303,027 | 7,928 | 106 | 47 | 254 | 5.8% | 4.7% | 8.0% | 4.7% | 21,150 - 22,500 | alone | stand-off | weapon | 50/50 |
| z16_husk_medium | 16 | 151-160 | Medium | Husk | poison | 17,529 → 18,916 | 454 | 7 | 44 | 254 | 8.8% | 5.0% | 5.7% | 4.4% | 1,510 - 1,600 | 3-5 | front | armour only | 100/0 |
| z16_husk_large | 16 | 151-160 | Large | Husk | poison | 29,800 → 32,157 | 613 | 7 | 40 | 254 | 8.8% | 5.0% | 5.7% | 4.4% | 1,510 - 1,600 | alone | front | armour only | 100/0 |
| z16_husk_elite | 16 | 151-160 | Elite | Husk | poison | 122,268 → 131,936 | 2,110 | 7 | 40 | 254 | 8.8% | 5.0% | 5.7% | 4.4% | 4,530 - 4,800 | alone | front | armour only | 100/0 |
| z16_goblin_small | 16 | 151-160 | Small | Goblin | poison | 12,271 → 13,241 | 318 | 118 | 58 | 280 | 5.3% | 5.9% | 9.3% | 5.3% | 1,510 - 1,600 | 3-5 | front | weapon | 100/0 |
| z16_goblin_medium | 16 | 151-160 | Medium | Goblin | poison | 17,529 → 18,916 | 454 | 118 | 53 | 280 | 5.3% | 5.9% | 9.3% | 5.3% | 1,510 - 1,600 | 3-5 | front | weapon | 100/0 |
| z16_goblin_large | 16 | 151-160 | Large | Goblin | poison | 29,800 → 32,157 | 613 | 118 | 47 | 280 | 5.3% | 5.9% | 9.3% | 5.3% | 1,510 - 1,600 | alone | front | weapon | 100/0 |
| z16_goblin_elite | 16 | 151-160 | Elite | Goblin | poison | 122,268 → 131,936 | 2,110 | 118 | 47 | 280 | 5.3% | 5.9% | 9.3% | 5.3% | 4,530 - 4,800 | alone | front | weapon | 100/0 |
| z16_elf_medium | 16 | 151-160 | Medium | Elf | poison | 17,529 → 18,916 | 454 | 203 | 68 | 186 | 4.2% | 5.2% | 9.1% | 6.8% | 1,510 - 1,600 | 3-5 | stand-off | weapon | 50/50 |
| z16_elf_large | 16 | 151-160 | Large | Elf | poison | 29,800 → 32,157 | 613 | 203 | 61 | 186 | 4.2% | 5.2% | 9.1% | 6.8% | 1,510 - 1,600 | alone | stand-off | weapon | 50/50 |
| z16_elf_elite | 16 | 151-160 | Elite | Elf | poison | 122,268 → 131,936 | 2,110 | 203 | 61 | 186 | 4.2% | 5.2% | 9.1% | 6.8% | 4,530 - 4,800 | alone | stand-off | weapon | 50/50 |
| z16_knight_large | 16 | 151-160 | Large | Knight | poison | 29,800 → 32,157 | 613 | 35 | 42 | 280 | 8.2% | 4.7% | 6.1% | 4.7% | 1,510 - 1,600 | alone | front | weapon | 100/0 |
| z16_knight_elite | 16 | 151-160 | Elite | Knight | poison | 122,268 → 131,936 | 2,110 | 35 | 42 | 280 | 8.2% | 4.7% | 6.1% | 4.7% | 4,530 - 4,800 | alone | front | weapon | 100/0 |
| z16_drake_medium | 16 | 151-160 | Medium | Drake | poison | 17,529 → 18,916 | 454 | 140 | 47 | 271 | 5.7% | 4.7% | 7.7% | 4.7% | 1,510 - 1,600 | 3-5 | front | weapon | 50/50 |
| z16_drake_large | 16 | 151-160 | Large | Drake | poison | 29,800 → 32,157 | 613 | 140 | 42 | 271 | 5.7% | 4.7% | 7.7% | 4.7% | 1,510 - 1,600 | alone | front | weapon | 50/50 |
| z16_drake_elite | 16 | 151-160 | Elite | Drake | poison | 122,268 → 131,936 | 2,110 | 140 | 42 | 271 | 5.7% | 4.7% | 7.7% | 4.7% | 4,530 - 4,800 | alone | front | weapon | 50/50 |
| z16_boss | 16 | 151-160 | Boss · The Drowned Choir | Husk | poison | 305,669 → 329,841 | 8,440 | 7 | 44 | 254 | 8.8% | 5.0% | 5.7% | 4.4% | 22,650 - 24,000 | alone | front | armour only | 100/0 |
| z17_slime_small | 17 | 161-170 | Small | Slime | fire/cold | 16,660 → 17,910 | 420 | 6 | 44 | 158 | 7.9% | 5.6% | 5.1% | 4.0% | 1,610 - 1,700 | 3-5 | front | armour only | 0/100 |
| z17_slime_medium | 17 | 161-170 | Medium | Slime | fire/cold | 23,800 → 25,586 | 601 | 6 | 40 | 158 | 7.9% | 5.6% | 5.1% | 4.0% | 1,610 - 1,700 | 3-5 | front | armour only | 0/100 |
| z17_bandit_small | 17 | 161-170 | Small | Bandit | fire/cold | 16,660 → 17,910 | 420 | 138 | 67 | 245 | 5.0% | 5.6% | 8.0% | 6.1% | 1,610 - 1,700 | 3-5 | front | weapon | 100/0 |
| z17_bandit_medium | 17 | 161-170 | Medium | Bandit | fire/cold | 23,800 → 25,586 | 601 | 138 | 61 | 245 | 5.0% | 5.6% | 8.0% | 6.1% | 1,610 - 1,700 | 3-5 | front | weapon | 100/0 |
| z17_spider_small | 17 | 161-170 | Small | Spider | cold | 16,660 → 17,910 | 420 | 101 | 74 | 156 | 4.4% | 6.1% | 10.2% | 6.7% | 1,610 - 1,700 | 3-5 | front | armour only | 100/0 |
| z17_spider_medium | 17 | 161-170 | Medium | Spider | cold | 23,800 → 25,586 | 601 | 101 | 67 | 156 | 4.4% | 6.1% | 10.2% | 6.7% | 1,610 - 1,700 | 3-5 | front | armour only | 100/0 |
| z17_knight_large | 17 | 161-170 | Large | Knight | cold | 40,460 → 43,497 | 811 | 35 | 42 | 280 | 8.2% | 4.7% | 6.0% | 4.7% | 1,610 - 1,700 | alone | front | weapon | 100/0 |
| z17_knight_elite | 17 | 161-170 | Elite | Knight | cold | 133,028 → 143,014 | 2,238 | 35 | 42 | 280 | 8.2% | 4.7% | 6.0% | 4.7% | 4,830 - 5,100 | alone | front | weapon | 100/0 |
| z17_drake_medium | 17 | 161-170 | Medium | Drake | cold | 23,800 → 25,586 | 601 | 140 | 47 | 271 | 5.7% | 4.7% | 7.5% | 4.7% | 1,610 - 1,700 | 3-5 | front | weapon | 50/50 |
| z17_drake_large | 17 | 161-170 | Large | Drake | cold | 40,460 → 43,497 | 811 | 140 | 42 | 271 | 5.7% | 4.7% | 7.5% | 4.7% | 1,610 - 1,700 | alone | front | weapon | 50/50 |
| z17_drake_elite | 17 | 161-170 | Elite | Drake | cold | 133,028 → 143,014 | 2,238 | 140 | 42 | 271 | 5.7% | 4.7% | 7.5% | 4.7% | 4,830 - 5,100 | alone | front | weapon | 50/50 |
| z17_boss | 17 | 161-170 | Boss · Wyrmback Sovereign | Drake | cold | 332,571 → 357,535 | 8,951 | 140 | 47 | 271 | 5.7% | 4.7% | 7.5% | 4.7% | 24,150 - 25,500 | alone | front | weapon | 50/50 |
| z18_wolf_small | 18 | 171-180 | Small | Wolf | chaos | 14,183 → 15,196 | 349 | 168 | 61 | 245 | 5.0% | 5.6% | 9.9% | 5.6% | 1,710 - 1,800 | 3-5 | front | weapon | 100/0 |
| z18_wolf_medium | 18 | 171-180 | Medium | Wolf | chaos | 20,261 → 21,709 | 499 | 168 | 56 | 245 | 5.0% | 5.6% | 9.9% | 5.6% | 1,710 - 1,800 | 3-5 | front | weapon | 100/0 |
| z18_orc_medium | 18 | 171-180 | Medium | Orc | chaos | 20,261 → 21,709 | 499 | 90 | 40 | 321 | 6.9% | 5.2% | 8.0% | 4.0% | 1,710 - 1,800 | 3-5 | front | weapon | 100/0 |
| z18_orc_large | 18 | 171-180 | Large | Orc | chaos | 34,443 → 36,905 | 673 | 90 | 36 | 321 | 6.9% | 5.2% | 8.0% | 4.0% | 1,710 - 1,800 | alone | front | weapon | 100/0 |
| z18_orc_elite | 18 | 171-180 | Elite | Orc | chaos | 144,141 → 154,444 | 2,366 | 90 | 36 | 321 | 6.9% | 5.2% | 8.0% | 4.0% | 5,130 - 5,400 | alone | front | weapon | 100/0 |
| z18_troll_large | 18 | 171-180 | Large | Troll | chaos | 34,443 → 36,905 | 673 | 60 | 36 | 299 | 8.0% | 5.2% | 6.5% | 4.0% | 1,710 - 1,800 | alone | front | weapon | 100/0 |
| z18_troll_elite | 18 | 171-180 | Elite | Troll | chaos | 144,141 → 154,444 | 2,366 | 60 | 36 | 299 | 8.0% | 5.2% | 6.5% | 4.0% | 5,130 - 5,400 | alone | front | weapon | 100/0 |
| z18_golem_large | 18 | 171-180 | Large | Golem | chaos | 34,443 → 36,905 | 673 | 30 | 37 | 369 | 8.4% | 3.5% | 4.7% | 4.1% | 1,710 - 1,800 | alone | front | weapon | 100/0 |
| z18_golem_elite | 18 | 171-180 | Elite | Golem | chaos | 144,141 → 154,444 | 2,366 | 30 | 37 | 369 | 8.4% | 3.5% | 4.7% | 4.1% | 5,130 - 5,400 | alone | front | weapon | 100/0 |
| z18_knight_large | 18 | 171-180 | Large | Knight | poison/chaos | 34,443 → 36,905 | 673 | 35 | 42 | 280 | 8.2% | 4.7% | 5.8% | 4.7% | 1,710 - 1,800 | alone | front | weapon | 100/0 |
| z18_knight_elite | 18 | 171-180 | Elite | Knight | poison/chaos | 144,141 → 154,444 | 2,366 | 35 | 42 | 280 | 8.2% | 4.7% | 5.8% | 4.7% | 5,130 - 5,400 | alone | front | weapon | 100/0 |
| z18_seraph_medium | 18 | 171-180 | Medium | Seraph | poison/chaos | 20,261 → 21,709 | 499 | 88 | 59 | 128 | 5.4% | 5.4% | 6.1% | 5.9% | 1,710 - 1,800 | 3-5 | stand-off | weapon | 0/100 |
| z18_seraph_large | 18 | 171-180 | Large | Seraph | poison/chaos | 34,443 → 36,905 | 673 | 88 | 53 | 128 | 5.4% | 5.4% | 6.1% | 5.9% | 1,710 - 1,800 | alone | stand-off | weapon | 0/100 |
| z18_seraph_elite | 18 | 171-180 | Elite | Seraph | poison/chaos | 144,141 → 154,444 | 2,366 | 88 | 53 | 128 | 5.4% | 5.4% | 6.1% | 5.9% | 5,130 - 5,400 | alone | stand-off | weapon | 0/100 |
| z18_boss | 18 | 171-180 | Boss · Pale Spire Silence | Seraph | poison/chaos | 360,353 → 386,109 | 9,463 | 88 | 59 | 128 | 5.4% | 5.4% | 6.1% | 5.9% | 25,650 - 27,000 | alone | stand-off | weapon | 0/100 |

Every row is the mob's own stat block at the zone's **last** level (`mob stat = 108` × the species vector, flat with no level term, D-141), then by the body class: accuracy = Dex line × 1.5 × accuracy tier · evasion = Dex × 0.5 × body · armour = Str × 2 · res = Vit × 0.05 · crit = Lck × 0.05 · dodge = own Agi rate ÷ (rate + a same-level attacker's accuracy) (D-024 · X24). HP is `mob_HP(L) × body` at both ends of the range, so a mob mid-range interpolates. XP is `10 × the mob's own level` with elite ×3 and boss ×15 (world.md XP), printed as a range because a mob spawns at the attacker's level, so it is read at both ends of the zone. `status gate` is the mob's own Elemental Alignment (`Dex × 0.05`, no Cap), the number that decides how often its innate Element status actually lands (combat.md section 2 step 9). A mob spawns at the attacker's level clamped into its zone's range; its innate Element is rolled with the species bias at ×3 against any other Element the zone carries at ×1; and `drops: weapon` means the lineage is allowed to be the source of a weapon-slot piece; `armour only` species still drop every other slot, so the 8% base drop rate, the quality floors and the whole stone funnel are untouched (loot.md sections 1-2 · gear, herbs, stones and junk are the four streams).
<!-- END GENERATED:mob-roster -->

# Rules the Roster Runs On

- **HP**: `mob_HP(L) x body.hp` - `mob_HP(L) = typical_gear_DPS(L) x (1 + 0.0034 x L)` (skill list only; the passive tree is empty) - `body.hp` and every per-entry number below are one home, this line only names the formula
- **Damage/sec**: `mob_PS(L) = typical_gear_DPS(L) ÷ 27` (**not** `mob_HP ÷ 27` · checks.md D2), then × body `ps`. Split 50% physical + 50% Element by the mob's innate (combat.md section 3).
- **Elite**: Large body, HP ×6 · damage ×4 · always single · 0.5% of kills · drops a Reroll tier stone 5% of the time (world.md · loot.md section 5 · D-041).
- **Boss**: HP ×15 · damage ×4 · always single · 1 spawn per 15 minutes · online only · potions suppressed (combat.md section 7 · farm.md).
- **Grouping**: Small and Medium form the zone's group; Large, Elite and Boss appear alone. At most 3 attackers swing per round (world.md · the rule that holds the AFK promise).
- **XP**: `10 × mob level`, elite ×3, boss ×15 (world.md XP line).
- **Mob level**: the attacking player's level clamped into the zone's range · a level-45 player in Wolf Cross (41-50) fights mobs at 45, and levels 91-100 keep fighting zone 9 at level 90.
- **Spawn weighting inside a zone**: normal bodies spawn evenly across the species on that zone's cast; a zone's Elite rate is the single 0.5% flag, not a species trait, and it always lands on a Large body.
- **Innate Element roll**: inside the zone's own Elements, a species-biased Element weighs ×3 and any other Element the zone carries weighs ×1 (`element_roll`). A one-Element zone is therefore always that Element; a two-Element zone lands on the species bias about three rolls in four. Res still has to be prepared from the zone, not from the species.
- **Drops**: `weapon` marks the lineages allowed to be the source of a weapon-slot piece; `armour only` species still drop every other slot. **No species drops nothing** — the 8% base drop rate, the quality floors and the stone funnel are the same for every entry (loot.md sections 1-2: gear, herbs, stones and junk are the four streams).
  Weaponless lineages are Rat · Husk · Slime · Spider, which is exactly why Goblin (zone 2) is written up as "where the weapon part of the drop table starts", and the weapon-carrying count rises with the zone (zone 1 none, zone 8 seven) so the loot ladder tracks the difficulty ladder.

# Settled on the Mob Side

(The items this file used to carry as open are all closed; kept here so the next session does not re-open them. The one non-blocking follow-up — modelling the mob-skill burst shape in `tools/survival.ts` — is tracked as `harness/todo.md` B4 and moves no number here.)

- **Player-side Evasion closed** — the player's line runs the same opposed form (`formula-defense.md` section 4: `rating ÷ (rating + mob_accuracy)`, plus Agi ÷ 30 points) and its table is generated, so the flat `K_dodge` divisor is gone (D-112).
- **Mob skills** (`combat.md` §5b · D-067): skills follow the body tier — Small/Medium 0 (innate Element only), Large and Elite 1, Boss 1-2 — and each skill re-times the mob's priced `mob_PS` instead of adding power, so `mob_HP` and the timeline are untouched. The species table is the input: the physical lineages carry bleed, the casters lean on their innate status. Nothing here blocks shipping without it.
- **Gear Armour / Evasion / Energy Shield flat ranges** are set (`mod-pool.md`, from `tools/data/mods.json`: Armour 8-40 · Evasion 6-30 · Energy Shield 12-60) — each is a share of its own stat line.
- **`tools/survival.ts`** generates combat.md section 6-7 and gates them; it is run by `tools/verify.ts`.
