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
| 1 | Eastgate | 2 | 1 · 2 · 1 | 1 | Husk · Eastgate Emberling | 9,435 | 360 | 6 |
| 2 | Millbrook | 3 | 2 · 3 · 2 | 2 | Goblin · Millbrook Tallyman | 19,575 | 724 | 10 |
| 3 | Ashfall | 5 | 4 · 5 · 2 | 2 | Rat · Ashfall Chieftain | 27,360 | 981 | 14 |
| 4 | Ironrow | 5 | 4 · 5 · 2 | 2 | Bandit · Ironrow Warden | 60,495 | 2,104 | 14 |
| 5 | Wolf Cross | 5 | 4 · 5 · 1 | 1 | Slime · The Bloated Shepherd | 69,480 | 2,346 | 12 |
| 6 | Highspire | 6 | 3 · 4 · 3 | 3 | Troll · Highspire Herald | 79,395 | 2,605 | 14 |
| 7 | Bonegate | 6 | 1 · 4 · 5 | 5 | Orc · Bonegate Tyrant | 128,805 | 4,110 | 16 |
| 8 | Frosthold | 7 | 0 · 4 · 7 | 7 | Knight · Frosthold Siege-Marshal | 144,075 | 4,475 | 19 |
| 9 | Vermolch | 5 | 0 · 4 · 5 | 5 | Seraph · Vermolch Ninefold Choir | 160,635 | 4,859 | 15 |
<!-- END GENERATED:zone-cast -->

# Every Entry

<!-- BEGIN GENERATED:mob-roster -->
| id | Zone | Levels | Body | Species | innate Elements | HP (zone start → end) | damage/sec | accuracy | evasion | armour | res | crit | dodge | status gate | XP/kill | group | line | drops | phys/elem |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| z1_rat_small | 1 | 1-10 | Small | Rat | fire | 86 → 452 | 16 | 39 | 19 | 50 | 1.1% | 2.0% | 10.5% | 1.7% | 10 - 100 | 1-2 | front | armour only | 100/0 |
| z1_rat_medium | 1 | 1-10 | Medium | Rat | fire | 123 → 645 | 23 | 39 | 17 | 50 | 1.1% | 2.0% | 10.5% | 1.7% | 10 - 100 | 1-2 | front | armour only | 100/0 |
| z1_husk_medium | 1 | 1-10 | Medium | Husk | fire | 123 → 645 | 23 | 2 | 12 | 70 | 2.4% | 1.4% | 5.3% | 1.2% | 10 - 100 | 1-2 | front | armour only | 100/0 |
| z1_husk_large | 1 | 1-10 | Large | Husk | fire | 209 → 1,097 | 31 | 2 | 11 | 70 | 2.4% | 1.4% | 5.3% | 1.2% | 10 - 100 | alone | front | armour only | 100/0 |
| z1_husk_elite | 1 | 1-10 | Elite | Husk | fire | 720 → 3,774 | 90 | 2 | 11 | 70 | 2.4% | 1.4% | 5.3% | 1.2% | 30 - 300 | alone | front | armour only | 100/0 |
| z1_boss | 1 | 1-10 | Boss · Eastgate Emberling | Husk | fire | 1,800 → 9,435 | 360 | 2 | 12 | 70 | 2.4% | 1.4% | 5.3% | 1.2% | 150 - 1,500 | alone | front | armour only | 100/0 |
| z2_rat_small | 2 | 11-20 | Small | Rat | poison | 526 → 940 | 33 | 65 | 32 | 84 | 1.8% | 3.4% | 10.5% | 2.9% | 110 - 200 | 1-2 | front | armour only | 100/0 |
| z2_rat_medium | 2 | 11-20 | Medium | Rat | poison | 751 → 1,343 | 47 | 65 | 29 | 84 | 1.8% | 3.4% | 10.5% | 2.9% | 110 - 200 | 1-2 | front | armour only | 100/0 |
| z2_husk_medium | 2 | 11-20 | Medium | Husk | poison | 751 → 1,343 | 47 | 3 | 21 | 117 | 4.1% | 2.3% | 5.3% | 2.1% | 110 - 200 | 1-2 | front | armour only | 100/0 |
| z2_husk_large | 2 | 11-20 | Large | Husk | poison | 1,278 → 2,284 | 63 | 3 | 18 | 117 | 4.1% | 2.3% | 5.3% | 2.1% | 110 - 200 | alone | front | armour only | 100/0 |
| z2_husk_elite | 2 | 11-20 | Elite | Husk | poison | 4,380 → 7,830 | 181 | 3 | 18 | 117 | 4.1% | 2.3% | 5.3% | 2.1% | 330 - 600 | alone | front | armour only | 100/0 |
| z2_goblin_small | 2 | 11-20 | Small | Goblin | poison | 526 → 940 | 33 | 55 | 27 | 129 | 2.4% | 2.7% | 8.6% | 2.4% | 110 - 200 | 1-2 | front | weapon | 100/0 |
| z2_goblin_medium | 2 | 11-20 | Medium | Goblin | poison | 751 → 1,343 | 47 | 55 | 24 | 129 | 2.4% | 2.7% | 8.6% | 2.4% | 110 - 200 | 1-2 | front | weapon | 100/0 |
| z2_goblin_large | 2 | 11-20 | Large | Goblin | poison | 1,278 → 2,284 | 63 | 55 | 22 | 129 | 2.4% | 2.7% | 8.6% | 2.4% | 110 - 200 | alone | front | weapon | 100/0 |
| z2_goblin_elite | 2 | 11-20 | Elite | Goblin | poison | 4,380 → 7,830 | 181 | 55 | 22 | 129 | 2.4% | 2.7% | 8.6% | 2.4% | 330 - 600 | alone | front | weapon | 100/0 |
| z2_boss | 2 | 11-20 | Boss · Millbrook Tallyman | Goblin | poison | 10,950 → 19,575 | 724 | 55 | 24 | 129 | 2.4% | 2.7% | 8.6% | 2.4% | 1,650 - 3,000 | alone | front | weapon | 100/0 |
| z3_rat_small | 3 | 21-30 | Small | Rat | fire | 1,107 → 1,406 | 47 | 91 | 44 | 118 | 2.6% | 4.8% | 10.5% | 4.0% | 210 - 300 | 1-2 | front | armour only | 100/0 |
| z3_rat_medium | 3 | 21-30 | Medium | Rat | fire | 1,581 → 2,008 | 67 | 91 | 40 | 118 | 2.6% | 4.8% | 10.5% | 4.0% | 210 - 300 | 1-2 | front | armour only | 100/0 |
| z3_husk_medium | 3 | 21-30 | Medium | Husk | fire | 1,581 → 2,008 | 67 | 4 | 29 | 164 | 5.7% | 3.3% | 5.3% | 2.9% | 210 - 300 | 1-2 | front | armour only | 100/0 |
| z3_husk_large | 3 | 21-30 | Large | Husk | fire | 2,688 → 3,414 | 91 | 4 | 26 | 164 | 5.7% | 3.3% | 5.3% | 2.9% | 210 - 300 | alone | front | armour only | 100/0 |
| z3_husk_elite | 3 | 21-30 | Elite | Husk | fire | 8,616 → 10,944 | 245 | 4 | 26 | 164 | 5.7% | 3.3% | 5.3% | 2.9% | 630 - 900 | alone | front | armour only | 100/0 |
| z3_goblin_small | 3 | 21-30 | Small | Goblin | fire | 1,107 → 1,406 | 47 | 76 | 37 | 181 | 3.4% | 3.8% | 8.6% | 3.4% | 210 - 300 | 1-2 | front | weapon | 100/0 |
| z3_goblin_medium | 3 | 21-30 | Medium | Goblin | fire | 1,581 → 2,008 | 67 | 76 | 34 | 181 | 3.4% | 3.8% | 8.6% | 3.4% | 210 - 300 | 1-2 | front | weapon | 100/0 |
| z3_goblin_large | 3 | 21-30 | Large | Goblin | fire | 2,688 → 3,414 | 91 | 76 | 31 | 181 | 3.4% | 3.8% | 8.6% | 3.4% | 210 - 300 | alone | front | weapon | 100/0 |
| z3_goblin_elite | 3 | 21-30 | Elite | Goblin | fire | 8,616 → 10,944 | 245 | 76 | 31 | 181 | 3.4% | 3.8% | 8.6% | 3.4% | 630 - 900 | alone | front | weapon | 100/0 |
| z3_slime_small | 3 | 21-30 | Small | Slime | fire | 1,107 → 1,406 | 47 | 4 | 28 | 102 | 5.1% | 3.6% | 4.8% | 2.6% | 210 - 300 | 1-2 | front | armour only | 0/100 |
| z3_slime_medium | 3 | 21-30 | Medium | Slime | fire | 1,581 → 2,008 | 67 | 4 | 26 | 102 | 5.1% | 3.6% | 4.8% | 2.6% | 210 - 300 | 1-2 | front | armour only | 0/100 |
| z3_bandit_small | 3 | 21-30 | Small | Bandit | fire | 1,107 → 1,406 | 47 | 89 | 44 | 158 | 3.3% | 3.6% | 7.6% | 4.0% | 210 - 300 | 1-2 | front | weapon | 100/0 |
| z3_bandit_medium | 3 | 21-30 | Medium | Bandit | fire | 1,581 → 2,008 | 67 | 89 | 40 | 158 | 3.3% | 3.6% | 7.6% | 4.0% | 210 - 300 | 1-2 | front | weapon | 100/0 |
| z3_boss | 3 | 21-30 | Boss · Ashfall Chieftain | Rat | fire | 21,540 → 27,360 | 981 | 91 | 40 | 118 | 2.6% | 4.8% | 10.5% | 4.0% | 3,150 - 4,500 | alone | front | armour only | 100/0 |
| z4_husk_medium | 4 | 31-40 | Medium | Husk | lightning | 3,904 → 4,440 | 145 | 6 | 37 | 211 | 7.3% | 4.2% | 5.3% | 3.7% | 310 - 400 | 2-3 | front | armour only | 100/0 |
| z4_husk_large | 4 | 31-40 | Large | Husk | lightning | 6,637 → 7,548 | 195 | 6 | 33 | 211 | 7.3% | 4.2% | 5.3% | 3.7% | 310 - 400 | alone | front | armour only | 100/0 |
| z4_husk_elite | 4 | 31-40 | Elite | Husk | lightning | 21,276 → 24,198 | 526 | 6 | 33 | 211 | 7.3% | 4.2% | 5.3% | 3.7% | 930 - 1,200 | alone | front | armour only | 100/0 |
| z4_goblin_small | 4 | 31-40 | Small | Goblin | lightning | 2,733 → 3,108 | 101 | 98 | 48 | 232 | 4.4% | 4.9% | 8.6% | 4.4% | 310 - 400 | 2-3 | front | weapon | 100/0 |
| z4_goblin_medium | 4 | 31-40 | Medium | Goblin | lightning | 3,904 → 4,440 | 145 | 98 | 44 | 232 | 4.4% | 4.9% | 8.6% | 4.4% | 310 - 400 | 2-3 | front | weapon | 100/0 |
| z4_goblin_large | 4 | 31-40 | Large | Goblin | lightning | 6,637 → 7,548 | 195 | 98 | 39 | 232 | 4.4% | 4.9% | 8.6% | 4.4% | 310 - 400 | alone | front | weapon | 100/0 |
| z4_goblin_elite | 4 | 31-40 | Elite | Goblin | lightning | 21,276 → 24,198 | 526 | 98 | 39 | 232 | 4.4% | 4.9% | 8.6% | 4.4% | 930 - 1,200 | alone | front | weapon | 100/0 |
| z4_slime_small | 4 | 31-40 | Small | Slime | lightning | 2,733 → 3,108 | 101 | 5 | 36 | 131 | 6.6% | 4.7% | 4.8% | 3.3% | 310 - 400 | 2-3 | front | armour only | 0/100 |
| z4_slime_medium | 4 | 31-40 | Medium | Slime | lightning | 3,904 → 4,440 | 145 | 5 | 33 | 131 | 6.6% | 4.7% | 4.8% | 3.3% | 310 - 400 | 2-3 | front | armour only | 0/100 |
| z4_bandit_small | 4 | 31-40 | Small | Bandit | lightning | 2,733 → 3,108 | 101 | 114 | 56 | 203 | 4.2% | 4.6% | 7.6% | 5.1% | 310 - 400 | 2-3 | front | weapon | 100/0 |
| z4_bandit_medium | 4 | 31-40 | Medium | Bandit | lightning | 3,904 → 4,440 | 145 | 114 | 51 | 203 | 4.2% | 4.6% | 7.6% | 5.1% | 310 - 400 | 2-3 | front | weapon | 100/0 |
| z4_spider_small | 4 | 31-40 | Small | Spider | lightning | 2,733 → 3,108 | 101 | 84 | 61 | 130 | 3.7% | 5.1% | 9.7% | 5.6% | 310 - 400 | 2-3 | front | armour only | 100/0 |
| z4_spider_medium | 4 | 31-40 | Medium | Spider | lightning | 3,904 → 4,440 | 145 | 84 | 56 | 130 | 3.7% | 5.1% | 9.7% | 5.6% | 310 - 400 | 2-3 | front | armour only | 100/0 |
| z4_boss | 4 | 31-40 | Boss · Ironrow Warden | Bandit | lightning | 53,190 → 60,495 | 2,104 | 114 | 51 | 203 | 4.2% | 4.6% | 7.6% | 5.1% | 4,650 - 6,000 | alone | front | weapon | 100/0 |
| z5_slime_small | 5 | 41-50 | Small | Slime | cold | 3,276 → 3,710 | 117 | 6 | 44 | 161 | 8.0% | 5.7% | 4.8% | 4.0% | 410 - 500 | 2-3 | front | armour only | 0/100 |
| z5_slime_medium | 5 | 41-50 | Medium | Slime | cold | 4,680 → 5,300 | 168 | 6 | 40 | 161 | 8.0% | 5.7% | 4.8% | 4.0% | 410 - 500 | 2-3 | front | armour only | 0/100 |
| z5_bandit_small | 5 | 41-50 | Small | Bandit | cold | 3,276 → 3,710 | 117 | 140 | 68 | 249 | 5.1% | 5.7% | 7.6% | 6.2% | 410 - 500 | 2-3 | front | weapon | 100/0 |
| z5_bandit_medium | 5 | 41-50 | Medium | Bandit | cold | 4,680 → 5,300 | 168 | 140 | 62 | 249 | 5.1% | 5.7% | 7.6% | 6.2% | 410 - 500 | 2-3 | front | weapon | 100/0 |
| z5_spider_small | 5 | 41-50 | Small | Spider | cold | 3,276 → 3,710 | 117 | 102 | 75 | 158 | 4.5% | 6.2% | 9.7% | 6.8% | 410 - 500 | 2-3 | front | armour only | 100/0 |
| z5_spider_medium | 5 | 41-50 | Medium | Spider | cold | 4,680 → 5,300 | 168 | 102 | 68 | 158 | 4.5% | 6.2% | 9.7% | 6.8% | 410 - 500 | 2-3 | front | armour only | 100/0 |
| z5_wolf_small | 5 | 41-50 | Small | Wolf | cold | 3,276 → 3,710 | 117 | 170 | 62 | 249 | 5.1% | 5.7% | 9.7% | 5.7% | 410 - 500 | 2-3 | front | weapon | 100/0 |
| z5_wolf_medium | 5 | 41-50 | Medium | Wolf | cold | 4,680 → 5,300 | 168 | 170 | 57 | 249 | 5.1% | 5.7% | 9.7% | 5.7% | 410 - 500 | 2-3 | front | weapon | 100/0 |
| z5_orc_medium | 5 | 41-50 | Medium | Orc | cold | 4,680 → 5,300 | 168 | 92 | 41 | 326 | 7.0% | 5.2% | 7.8% | 4.1% | 410 - 500 | 2-3 | front | weapon | 100/0 |
| z5_orc_large | 5 | 41-50 | Large | Orc | cold | 7,956 → 9,011 | 227 | 92 | 37 | 326 | 7.0% | 5.2% | 7.8% | 4.1% | 410 - 500 | alone | front | weapon | 100/0 |
| z5_orc_elite | 5 | 41-50 | Elite | Orc | cold | 24,540 → 27,792 | 587 | 92 | 37 | 326 | 7.0% | 5.2% | 7.8% | 4.1% | 1,230 - 1,500 | alone | front | weapon | 100/0 |
| z5_boss | 5 | 41-50 | Boss · The Bloated Shepherd | Slime | cold | 61,350 → 69,480 | 2,346 | 6 | 40 | 161 | 8.0% | 5.7% | 4.8% | 4.0% | 6,150 - 7,500 | alone | front | armour only | 0/100 |
| z6_bandit_small | 6 | 51-60 | Small | Bandit | lightning/cold | 3,389 → 3,820 | 118 | 165 | 81 | 294 | 6.0% | 6.7% | 7.6% | 7.3% | 510 - 600 | 2-3 | front | weapon | 100/0 |
| z6_bandit_medium | 6 | 51-60 | Medium | Bandit | lightning/cold | 4,841 → 5,457 | 168 | 165 | 73 | 294 | 6.0% | 6.7% | 7.6% | 7.3% | 510 - 600 | 2-3 | front | weapon | 100/0 |
| z6_spider_small | 6 | 51-60 | Small | Spider | lightning/cold | 3,389 → 3,820 | 118 | 121 | 89 | 187 | 5.3% | 7.3% | 9.7% | 8.1% | 510 - 600 | 2-3 | front | armour only | 100/0 |
| z6_spider_medium | 6 | 51-60 | Medium | Spider | lightning/cold | 4,841 → 5,457 | 168 | 121 | 81 | 187 | 5.3% | 7.3% | 9.7% | 8.1% | 510 - 600 | 2-3 | front | armour only | 100/0 |
| z6_wolf_small | 6 | 51-60 | Small | Wolf | cold/lightning | 3,389 → 3,820 | 118 | 201 | 74 | 294 | 6.0% | 6.7% | 9.7% | 6.7% | 510 - 600 | 2-3 | front | weapon | 100/0 |
| z6_wolf_medium | 6 | 51-60 | Medium | Wolf | cold/lightning | 4,841 → 5,457 | 168 | 201 | 67 | 294 | 6.0% | 6.7% | 9.7% | 6.7% | 510 - 600 | 2-3 | front | weapon | 100/0 |
| z6_orc_medium | 6 | 51-60 | Medium | Orc | cold | 4,841 → 5,457 | 168 | 108 | 48 | 385 | 8.3% | 6.2% | 7.8% | 4.8% | 510 - 600 | 2-3 | front | weapon | 100/0 |
| z6_orc_large | 6 | 51-60 | Large | Orc | cold | 8,230 → 9,276 | 227 | 108 | 43 | 385 | 8.3% | 6.2% | 7.8% | 4.8% | 510 - 600 | alone | front | weapon | 100/0 |
| z6_orc_elite | 6 | 51-60 | Elite | Orc | cold | 28,176 → 31,758 | 651 | 108 | 43 | 385 | 8.3% | 6.2% | 7.8% | 4.8% | 1,530 - 1,800 | alone | front | weapon | 100/0 |
| z6_troll_large | 6 | 51-60 | Large | Troll | cold | 8,230 → 9,276 | 227 | 72 | 43 | 359 | 9.6% | 6.2% | 6.4% | 4.8% | 510 - 600 | alone | front | weapon | 100/0 |
| z6_troll_elite | 6 | 51-60 | Elite | Troll | cold | 28,176 → 31,758 | 651 | 72 | 43 | 359 | 9.6% | 6.2% | 6.4% | 4.8% | 1,530 - 1,800 | alone | front | weapon | 100/0 |
| z6_golem_large | 6 | 51-60 | Large | Golem | lightning/cold | 8,230 → 9,276 | 227 | 37 | 44 | 442 | 10.1% | 4.2% | 4.6% | 4.9% | 510 - 600 | alone | front | weapon | 100/0 |
| z6_golem_elite | 6 | 51-60 | Elite | Golem | lightning/cold | 28,176 → 31,758 | 651 | 37 | 44 | 442 | 10.1% | 4.2% | 4.6% | 4.9% | 1,530 - 1,800 | alone | front | weapon | 100/0 |
| z6_boss | 6 | 51-60 | Boss · Highspire Herald | Troll | cold | 70,440 → 79,395 | 2,605 | 72 | 48 | 359 | 9.6% | 6.2% | 6.4% | 4.8% | 7,650 - 9,000 | alone | front | weapon | 100/0 |
| z7_wolf_small | 7 | 61-70 | Small | Wolf | chaos | 4,660 → 5,171 | 155 | 232 | 85 | 339 | 7.0% | 7.7% | 9.7% | 7.7% | 610 - 700 | 3-5 | front | weapon | 100/0 |
| z7_wolf_medium | 7 | 61-70 | Medium | Wolf | chaos | 6,657 → 7,387 | 221 | 232 | 77 | 339 | 7.0% | 7.7% | 9.7% | 7.7% | 610 - 700 | 3-5 | front | weapon | 100/0 |
| z7_orc_medium | 7 | 61-70 | Medium | Orc | chaos | 6,657 → 7,387 | 221 | 125 | 56 | 444 | 9.5% | 7.1% | 7.8% | 5.6% | 610 - 700 | 3-5 | front | weapon | 100/0 |
| z7_orc_large | 7 | 61-70 | Large | Orc | chaos | 11,317 → 12,557 | 298 | 125 | 50 | 444 | 9.5% | 7.1% | 7.8% | 5.6% | 610 - 700 | alone | front | weapon | 100/0 |
| z7_orc_elite | 7 | 61-70 | Elite | Orc | chaos | 46,434 → 51,522 | 1,028 | 125 | 50 | 444 | 9.5% | 7.1% | 7.8% | 5.6% | 1,830 - 2,100 | alone | front | weapon | 100/0 |
| z7_troll_large | 7 | 61-70 | Large | Troll | chaos | 11,317 → 12,557 | 298 | 83 | 50 | 414 | 11.1% | 7.1% | 6.4% | 5.6% | 610 - 700 | alone | front | weapon | 100/0 |
| z7_troll_elite | 7 | 61-70 | Elite | Troll | chaos | 46,434 → 51,522 | 1,028 | 83 | 50 | 414 | 11.1% | 7.1% | 6.4% | 5.6% | 1,830 - 2,100 | alone | front | weapon | 100/0 |
| z7_elf_medium | 7 | 61-70 | Medium | Elf | chaos | 6,657 → 7,387 | 221 | 281 | 94 | 258 | 5.8% | 7.2% | 8.4% | 9.4% | 610 - 700 | 3-5 | stand-off | weapon | 50/50 |
| z7_elf_large | 7 | 61-70 | Large | Elf | chaos | 11,317 → 12,557 | 298 | 281 | 84 | 258 | 5.8% | 7.2% | 8.4% | 9.4% | 610 - 700 | alone | stand-off | weapon | 50/50 |
| z7_elf_elite | 7 | 61-70 | Elite | Elf | chaos | 46,434 → 51,522 | 1,028 | 281 | 84 | 258 | 5.8% | 7.2% | 8.4% | 9.4% | 1,830 - 2,100 | alone | stand-off | weapon | 50/50 |
| z7_demonic_medium | 7 | 61-70 | Medium | Demon | chaos | 6,657 → 7,387 | 221 | 147 | 65 | 351 | 8.0% | 6.5% | 7.2% | 6.5% | 610 - 700 | 3-5 | stand-off | weapon | 50/50 |
| z7_demonic_large | 7 | 61-70 | Large | Demon | chaos | 11,317 → 12,557 | 298 | 147 | 59 | 351 | 8.0% | 6.5% | 7.2% | 6.5% | 610 - 700 | alone | stand-off | weapon | 50/50 |
| z7_demonic_elite | 7 | 61-70 | Elite | Demon | chaos | 46,434 → 51,522 | 1,028 | 147 | 59 | 351 | 8.0% | 6.5% | 7.2% | 6.5% | 1,830 - 2,100 | alone | stand-off | weapon | 50/50 |
| z7_golem_large | 7 | 61-70 | Large | Golem | chaos | 11,317 → 12,557 | 298 | 42 | 51 | 510 | 11.6% | 4.9% | 4.6% | 5.6% | 610 - 700 | alone | front | weapon | 100/0 |
| z7_golem_elite | 7 | 61-70 | Elite | Golem | chaos | 46,434 → 51,522 | 1,028 | 42 | 51 | 510 | 11.6% | 4.9% | 4.6% | 5.6% | 1,830 - 2,100 | alone | front | weapon | 100/0 |
| z7_boss | 7 | 61-70 | Boss · Bonegate Tyrant | Orc | chaos | 116,085 → 128,805 | 4,110 | 125 | 56 | 444 | 9.5% | 7.1% | 7.8% | 5.6% | 9,150 - 10,500 | alone | front | weapon | 100/0 |
| z8_orc_medium | 8 | 71-80 | Medium | Orc | cold | 6,546 → 7,240 | 211 | 142 | 63 | 503 | 10.8% | 8.1% | 7.8% | 6.3% | 710 - 800 | 3-5 | front | weapon | 100/0 |
| z8_orc_large | 8 | 71-80 | Large | Orc | cold | 11,129 → 12,308 | 285 | 142 | 57 | 503 | 10.8% | 8.1% | 7.8% | 6.3% | 710 - 800 | alone | front | weapon | 100/0 |
| z8_orc_elite | 8 | 71-80 | Elite | Orc | cold | 52,110 → 57,630 | 1,119 | 142 | 57 | 503 | 10.8% | 8.1% | 7.8% | 6.3% | 2,130 - 2,400 | alone | front | weapon | 100/0 |
| z8_troll_large | 8 | 71-80 | Large | Troll | cold | 11,129 → 12,308 | 285 | 94 | 57 | 469 | 12.6% | 8.1% | 6.4% | 6.3% | 710 - 800 | alone | front | weapon | 100/0 |
| z8_troll_elite | 8 | 71-80 | Elite | Troll | cold | 52,110 → 57,630 | 1,119 | 94 | 57 | 469 | 12.6% | 8.1% | 6.4% | 6.3% | 2,130 - 2,400 | alone | front | weapon | 100/0 |
| z8_elf_medium | 8 | 71-80 | Medium | Elf | cold | 6,546 → 7,240 | 211 | 319 | 106 | 292 | 6.5% | 8.2% | 8.4% | 10.6% | 710 - 800 | 3-5 | stand-off | weapon | 50/50 |
| z8_elf_large | 8 | 71-80 | Large | Elf | cold | 11,129 → 12,308 | 285 | 319 | 96 | 292 | 6.5% | 8.2% | 8.4% | 10.6% | 710 - 800 | alone | stand-off | weapon | 50/50 |
| z8_elf_elite | 8 | 71-80 | Elite | Elf | cold | 52,110 → 57,630 | 1,119 | 319 | 96 | 292 | 6.5% | 8.2% | 8.4% | 10.6% | 2,130 - 2,400 | alone | stand-off | weapon | 50/50 |
| z8_demonic_medium | 8 | 71-80 | Medium | Demon | cold | 6,546 → 7,240 | 211 | 166 | 74 | 398 | 9.1% | 7.4% | 7.2% | 7.4% | 710 - 800 | 3-5 | stand-off | weapon | 50/50 |
| z8_demonic_large | 8 | 71-80 | Large | Demon | cold | 11,129 → 12,308 | 285 | 166 | 67 | 398 | 9.1% | 7.4% | 7.2% | 7.4% | 710 - 800 | alone | stand-off | weapon | 50/50 |
| z8_demonic_elite | 8 | 71-80 | Elite | Demon | cold | 52,110 → 57,630 | 1,119 | 166 | 67 | 398 | 9.1% | 7.4% | 7.2% | 7.4% | 2,130 - 2,400 | alone | stand-off | weapon | 50/50 |
| z8_golem_large | 8 | 71-80 | Large | Golem | cold | 11,129 → 12,308 | 285 | 48 | 57 | 578 | 13.2% | 5.5% | 4.6% | 6.4% | 710 - 800 | alone | front | weapon | 100/0 |
| z8_golem_elite | 8 | 71-80 | Elite | Golem | cold | 52,110 → 57,630 | 1,119 | 48 | 57 | 578 | 13.2% | 5.5% | 4.6% | 6.4% | 2,130 - 2,400 | alone | front | weapon | 100/0 |
| z8_knight_large | 8 | 71-80 | Large | Knight | cold | 11,129 → 12,308 | 285 | 55 | 66 | 439 | 12.8% | 7.3% | 5.7% | 7.3% | 710 - 800 | alone | front | weapon | 100/0 |
| z8_knight_elite | 8 | 71-80 | Elite | Knight | cold | 52,110 → 57,630 | 1,119 | 55 | 66 | 439 | 12.8% | 7.3% | 5.7% | 7.3% | 2,130 - 2,400 | alone | front | weapon | 100/0 |
| z8_drake_medium | 8 | 71-80 | Medium | Drake | cold | 6,546 → 7,240 | 211 | 219 | 73 | 425 | 8.9% | 7.3% | 7.1% | 7.3% | 710 - 800 | 3-5 | front | weapon | 50/50 |
| z8_drake_large | 8 | 71-80 | Large | Drake | cold | 11,129 → 12,308 | 285 | 219 | 66 | 425 | 8.9% | 7.3% | 7.1% | 7.3% | 710 - 800 | alone | front | weapon | 50/50 |
| z8_drake_elite | 8 | 71-80 | Elite | Drake | cold | 52,110 → 57,630 | 1,119 | 219 | 66 | 425 | 8.9% | 7.3% | 7.1% | 7.3% | 2,130 - 2,400 | alone | front | weapon | 50/50 |
| z8_boss | 8 | 71-80 | Boss · Frosthold Siege-Marshal | Knight | cold | 130,275 → 144,075 | 4,475 | 55 | 73 | 439 | 12.8% | 7.3% | 5.7% | 7.3% | 10,650 - 12,000 | alone | front | weapon | 100/0 |
| z9_elf_medium | 9 | 81-90 | Medium | Elf | chaos/poison | 7,652 → 8,437 | 239 | 356 | 119 | 327 | 7.3% | 9.1% | 8.4% | 11.9% | 810 - 900 | 3-5 | stand-off | weapon | 50/50 |
| z9_elf_large | 9 | 81-90 | Large | Elf | chaos/poison | 13,008 → 14,344 | 323 | 356 | 107 | 327 | 7.3% | 9.1% | 8.4% | 11.9% | 810 - 900 | alone | stand-off | weapon | 50/50 |
| z9_elf_elite | 9 | 81-90 | Elite | Elf | chaos/poison | 58,272 → 64,254 | 1,215 | 356 | 107 | 327 | 7.3% | 9.1% | 8.4% | 11.9% | 2,430 - 2,700 | alone | stand-off | weapon | 50/50 |
| z9_demonic_medium | 9 | 81-90 | Medium | Demon | chaos/poison | 7,652 → 8,437 | 239 | 186 | 83 | 445 | 10.2% | 8.3% | 7.2% | 8.3% | 810 - 900 | 3-5 | stand-off | weapon | 50/50 |
| z9_demonic_large | 9 | 81-90 | Large | Demon | chaos/poison | 13,008 → 14,344 | 323 | 186 | 74 | 445 | 10.2% | 8.3% | 7.2% | 8.3% | 810 - 900 | alone | stand-off | weapon | 50/50 |
| z9_demonic_elite | 9 | 81-90 | Elite | Demon | chaos/poison | 58,272 → 64,254 | 1,215 | 186 | 74 | 445 | 10.2% | 8.3% | 7.2% | 8.3% | 2,430 - 2,700 | alone | stand-off | weapon | 50/50 |
| z9_knight_large | 9 | 81-90 | Large | Knight | poison/chaos | 13,008 → 14,344 | 323 | 61 | 74 | 490 | 14.3% | 8.2% | 5.7% | 8.2% | 810 - 900 | alone | front | weapon | 100/0 |
| z9_knight_elite | 9 | 81-90 | Elite | Knight | poison/chaos | 58,272 → 64,254 | 1,215 | 61 | 74 | 490 | 14.3% | 8.2% | 5.7% | 8.2% | 2,430 - 2,700 | alone | front | weapon | 100/0 |
| z9_drake_medium | 9 | 81-90 | Medium | Drake | poison | 7,652 → 8,437 | 239 | 245 | 82 | 475 | 10.0% | 8.2% | 7.1% | 8.2% | 810 - 900 | 3-5 | front | weapon | 50/50 |
| z9_drake_large | 9 | 81-90 | Large | Drake | poison | 13,008 → 14,344 | 323 | 245 | 74 | 475 | 10.0% | 8.2% | 7.1% | 8.2% | 810 - 900 | alone | front | weapon | 50/50 |
| z9_drake_elite | 9 | 81-90 | Elite | Drake | poison | 58,272 → 64,254 | 1,215 | 245 | 74 | 475 | 10.0% | 8.2% | 7.1% | 8.2% | 2,430 - 2,700 | alone | front | weapon | 50/50 |
| z9_seraph_medium | 9 | 81-90 | Medium | Seraph | poison/chaos | 7,652 → 8,437 | 239 | 154 | 103 | 224 | 9.4% | 9.4% | 5.9% | 10.3% | 810 - 900 | 3-5 | stand-off | weapon | 0/100 |
| z9_seraph_large | 9 | 81-90 | Large | Seraph | poison/chaos | 13,008 → 14,344 | 323 | 154 | 92 | 224 | 9.4% | 9.4% | 5.9% | 10.3% | 810 - 900 | alone | stand-off | weapon | 0/100 |
| z9_seraph_elite | 9 | 81-90 | Elite | Seraph | poison/chaos | 58,272 → 64,254 | 1,215 | 154 | 92 | 224 | 9.4% | 9.4% | 5.9% | 10.3% | 2,430 - 2,700 | alone | stand-off | weapon | 0/100 |
| z9_boss | 9 | 81-90 | Boss · Vermolch Ninefold Choir | Seraph | poison/chaos | 145,680 → 160,635 | 4,859 | 154 | 103 | 224 | 9.4% | 9.4% | 5.9% | 10.3% | 12,150 - 13,500 | alone | stand-off | weapon | 0/100 |

Every row is the mob's own stat block at the zone's **last** level (`stat_c = 12 + 2 × (L − 1)` = 190 at 90), multiplied by the species vector, then by the body class: accuracy = Dex line × 1.5 × accuracy tier · evasion = Dex × 0.5 × body · armour = Str × 2 · res = Vit × 0.05 · crit = Lck × 0.05 · dodge = own Agi rate ÷ (rate + a same-level attacker's accuracy) (D-024 · X24). HP is `mob_HP(L) × body` at both ends of the range, so a mob mid-range interpolates. XP is `10 × the mob's own level` with elite ×3 and boss ×15 (world.md XP), printed as a range because a mob spawns at the attacker's level, so it is read at both ends of the zone. `status gate` is the mob's own Elemental Alignment (`Dex × 0.05`, cut at 35), the number that decides how often its innate Element status actually lands (combat.md section 2 step 9). A mob spawns at the attacker's level clamped into its zone's range; its innate Element is rolled with the species bias at ×3 against any other Element the zone carries at ×1; and `drops: weapon` means the lineage is allowed to be the source of a weapon-slot piece; `armour only` species still drop every other slot, so the 8% base drop rate, the quality floors and the whole stone funnel are untouched (loot.md sections 1-2 · gear, herbs, stones and junk are the four streams).
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

(The items this file used to carry as open are all closed; kept here so the next session does not re-open them. The one non-blocking follow-up — modelling the mob-skill burst shape in `tools/survival.js` — is tracked as `harness/todo.md` B4 and moves no number here.)

- **Player-side Evasion closed** — the player's line runs the same opposed form (`formula-defense.md` section 4: `rating ÷ (rating + mob_accuracy)`, plus Agi ÷ 30 points) and its table is generated, so the flat `K_dodge` divisor is gone (D-112).
- **Mob skills** (`combat.md` §5b · D-067): skills follow the body tier — Small/Medium 0 (innate Element only), Large and Elite 1, Boss 1-2 — and each skill re-times the mob's priced `mob_PS` instead of adding power, so `mob_HP` and the timeline are untouched. The species table is the input: the physical lineages carry bleed, the casters lean on their innate status. Nothing here blocks shipping without it.
- **Gear Armour / Evasion / Energy Shield flat ranges** are set (`mod-pool.md`, from `tools/data/mods.json`: Armour 8-40 · Evasion 6-30 · Energy Shield 12-60) — each is a share of its own stat line.
- **`tools/survival.js`** generates combat.md section 6-7 and gates them; it is run by `tools/verify.js`.
