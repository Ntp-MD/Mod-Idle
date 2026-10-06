# Mob Stat Sheet — 22 races × 5 variants × 15 zones × 3 sub-zones

Status: **proposal, parked. Not in the game.** Source idea: `owner/zone-mob.md` (races + variants +
zone table). The numbers below are proposals until they land in `tools/data/engine.json` (`mob.species`
· `mob.zones` · `mob.bosses`); nothing here is read by the engine, the cages, or the client.

For the full swap (scrap the live 15 species + 18 zones, insert these), §7 is the checklist: owner
decisions, sheet gaps, and the data/cage steps.

The sheet is built on the **existing mob model** (`doc/world/mob-roster.md`), so every row can
be lifted onto `mob.species[]` and reproduce the published roster columns without a new formula.

# How a mob stat block is built (the model this sheet obeys)

```
mob stat block = mob.stat.base (108.43, flat, no level term) × species vector × body class
```

| Column | Formula (engine) | Notes |
|---|---|---|
| accuracy | `base × Dex × K_DEX_ACC (1.5) × accuracy tier` | tier = the species' `accuracy_mult` |
| evasion | `base × Dex × K_EVASION (0.5) × body.evasion` | Cap 80; printed at Medium here |
| armour | `base × Str × K_ARMOUR (2)` | feeds the PoE armour ratio vs the physical half |
| res % | `base × Vit × K_VIT_RES (0.05)` | per-Element, Cap 75 |
| status gate % | `base × Dex × K_DEX_ALIGN (0.05)` | mob's Elemental Alignment — how often its innate status lands |
| crit % | `base × Lck × K_LCK_CRIT (0.05)` | |
| dodge % | `own Agi rate ÷ (own rate + a same-level player's accuracy)` | level-dependent; printed at **Lv 90** |
| damage tag | `physical` / `magic` / `mixed` | decides which half Armour vs res answers |
| line | `front` (swings) / `stand-off` (fires, still in the 3-attacker cap) | `combat.md` reach queue |
| weapon | yes/no | yes = lineage may be the source of a weapon-slot drop |

**Derived columns are at Lv 90 on a Medium body** (the spawn cap, `stat.mob_level_cap`), so they are
directly comparable to `mob-roster.md`'s zone-9 (`Vermolch`) numbers. Two rows in this sheet already
match that roster: Goblin accuracy 118 and Golem armour 369 are the published values.

# 1. Race vector (the design input)

`Str · Vit · Dex · Agi · Wis · Int · Lck` are the seven multipliers against the flat base. The 10
races that already exist in `mob.species` reuse their published vector **unchanged**; the 12 new races
are derived (see §5).

| Race | Str | Vit | Dex | Agi | Wis | Int | Lck | Damage | Line | Weapon | Acc tier | Source |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Goblin | 1.29 | 0.97 | 0.97 | 1.18 | 0.86 | 0.65 | 1.08 | physical | front | yes | 0.75 | existing |
| Orc | 1.48 | 1.27 | 0.74 | 1.06 | 0.95 | 0.53 | 0.95 | physical | front | yes | 0.75 | existing |
| Kobold | 1.07 | 0.85 | 1.06 | 1.32 | 0.85 | 0.64 | 1.22 | physical | front | yes | 0.50 | Rat × Goblin |
| Ogre | 1.43 | 1.38 | 0.74 | 0.96 | 0.95 | 0.59 | 0.95 | physical | front | yes | 0.50 | Orc × Troll |
| Troll | 1.38 | 1.48 | 0.74 | 0.85 | 0.95 | 0.64 | 0.95 | physical | front | yes | 0.50 | existing |
| Minotaur | 1.37 | 1.16 | 0.80 | 1.01 | 0.91 | 0.84 | 0.91 | physical | front | yes | 0.75 | Orc × Drake |
| Skeleton | 1.23 | 1.57 | 0.84 | 0.73 | 1.07 | 0.68 | 0.90 | physical | front | yes | 0.25 | Husk × Knight |
| Mummy | 1.28 | 1.56 | 0.78 | 0.78 | 1.00 | 0.67 | 0.94 | physical | stand-off | yes | 0.25 | Husk × Troll |
| Vampire | 1.15 | 1.00 | 0.95 | 1.16 | 0.90 | 0.90 | 0.95 | mixed | stand-off | yes | 0.75 | Demon × Wolf |
| Demon | 1.17 | 1.07 | 0.87 | 0.97 | 0.87 | 1.17 | 0.87 | mixed | stand-off | yes | 0.75 | existing |
| Slime | 0.73 | 1.46 | 0.73 | 0.63 | 1.25 | 1.15 | 1.04 | magic | front | no | 0.05 | existing |
| Spider | 0.72 | 0.82 | 1.24 | 1.34 | 0.93 | 0.82 | 1.13 | physical | front | no | 0.50 | existing |
| Wolf | 1.13 | 0.93 | 1.03 | 1.34 | 0.93 | 0.62 | 1.03 | physical | front | yes | 1.00 | existing |
| Golem | 1.70 | 1.55 | 0.75 | 0.60 | 1.10 | 0.65 | 0.65 | physical | front | yes | 0.25 | existing |
| Dragon | 1.48 | 1.30 | 0.81 | 0.78 | 0.98 | 0.90 | 0.76 | mixed | stand-off | yes | 1.00 | Drake × Golem |
| Treant | 1.54 | 1.52 | 0.75 | 0.73 | 1.03 | 0.65 | 0.80 | physical | front | yes | 0.25 | Troll × Golem |
| Human | 1.13 | 0.93 | 1.13 | 1.03 | 1.03 | 0.72 | 1.03 | physical | front | yes | 0.75 | existing (Bandit) |
| Lizardman | 1.16 | 1.00 | 0.95 | 1.26 | 0.90 | 0.58 | 1.16 | physical | front | yes | 0.75 | Orc × Rat |
| Elf | 0.86 | 0.77 | 1.25 | 1.15 | 0.96 | 1.05 | 0.96 | mixed | stand-off | yes | 1.00 | existing |
| Giant | 1.59 | 1.41 | 0.75 | 0.83 | 1.03 | 0.59 | 0.80 | physical | front | yes | 0.25 | Golem × Orc |
| Werewolf | 1.31 | 1.10 | 0.89 | 1.20 | 0.94 | 0.58 | 0.99 | physical | front | yes | 1.00 | Wolf × Orc |
| Dryad | 0.73 | 0.88 | 1.17 | 0.97 | 1.07 | 1.22 | 0.98 | magic | stand-off | no | 0.50 | Elf × Seraph |

# 2. Derived combat profile (Lv 90 · Medium body)

| Race | Accuracy | Evasion | Armour | res % | Status gate % | crit % | dodge % |
|---|---|---|---|---|---|---|---|
| Goblin | 118 | 52.6 | 280 | 5.3 | 5.3 | 5.9 | 11.9 |
| Orc | 90 | 40.1 | 321 | 6.9 | 4.0 | 5.2 | 10.8 |
| Kobold | 86 | 57.5 | 232 | 4.6 | 5.7 | 6.6 | 13.2 |
| Ogre | 60 | 40.1 | 310 | 7.5 | 4.0 | 5.2 | 9.9 |
| Troll | 60 | 40.1 | 299 | 8.0 | 4.0 | 5.2 | 8.9 |
| Minotaur | 98 | 43.4 | 297 | 6.3 | 4.3 | 4.9 | 10.4 |
| Skeleton | 34 | 45.5 | 267 | 8.5 | 4.6 | 4.9 | 7.7 |
| Mummy | 32 | 42.3 | 278 | 8.5 | 4.2 | 5.1 | 8.2 |
| Vampire | 116 | 51.5 | 249 | 5.4 | 5.2 | 5.2 | 11.8 |
| Demon | 106 | 47.2 | 254 | 5.8 | 4.7 | 4.7 | 10.0 |
| Slime | 6 | 39.6 | 158 | 7.9 | 4.0 | 5.6 | 6.7 |
| Spider | 101 | 67.2 | 156 | 4.4 | 6.7 | 6.1 | 13.3 |
| Wolf | 168 | 55.8 | 245 | 5.0 | 5.6 | 5.6 | 13.3 |
| Golem | 30 | 40.7 | 369 | 8.4 | 4.1 | 3.5 | 6.4 |
| Dragon | 132 | 43.9 | 321 | 7.0 | 4.4 | 4.1 | 8.2 |
| Treant | 30 | 40.7 | 334 | 8.2 | 4.1 | 4.3 | 7.7 |
| Human | 138 | 61.3 | 245 | 5.0 | 6.1 | 5.6 | 10.6 |
| Lizardman | 116 | 51.5 | 252 | 5.4 | 5.2 | 6.3 | 12.6 |
| Elf | 203 | 67.8 | 186 | 4.2 | 6.8 | 5.2 | 11.7 |
| Giant | 30 | 40.7 | 345 | 7.6 | 4.1 | 4.3 | 8.7 |
| Werewolf | 145 | 48.3 | 284 | 6.0 | 4.8 | 5.4 | 12.1 |
| Dryad | 95 | 63.4 | 158 | 4.8 | 6.3 | 5.3 | 10.0 |

What the columns buy, Ragnarok-style (one species is one stat block, not a point on a curve):

- **Armour wall:** Golem · Giant · Treant · Orc — real armour and 7.5-8.5% res, low accuracy.
- **Accurate striker:** Elf · Wolf · Werewolf · Human · Dragon — 132-203 accuracy, evasion is worthless.
- **Evasive vermin:** Spider · Elf · Kobold · Dryad — 57-68 evasion, killed by Element damage.
- **Status pressure:** Elf · Spider · Dryad · Human — 6.1-6.8% gate, their innate Element lands most often.
- **Slow caster floor:** Slime · Dryad · Skeleton · Mummy — 6-34 accuracy, dodged outright.

# 3. Variant ladder (5 per race)

Mapping rule: the five variants fill the five tier slots **Small · Medium · Large · Elite · Boss**, in
that order. A race that fields fewer farming bodies still names five variants; the extra ones spawn on
its smallest legal body (marked `L` = reads as Large). The map is a proposal — the names and their
tier are the owner's to re-slot.

| Race | V1 Small | V2 Medium | V3 Large | V4 Elite | V5 Boss | bodies fielded |
|---|---|---|---|---|---|---|
| Goblin | Sneak Goblin | Raider Goblin | Tinker Goblin | Shaman Goblin | Goblin King | S · M · L |
| Orc | Raider Orc | Shaman Orc | Berserker Orc | Juggernaut Orc | Warlord Orc | M · L |
| Kobold | Miner Kobold | Trapper Kobold | Tinker Kobold | Drake Kobold | Hoarder Kobold | S · M |
| Ogre | Brute Ogre | Butcher Ogre | Swamp Ogre | Mage Ogre | Ogre King | M · L |
| Troll | Cave Troll | Forest Troll | Swamp Troll | Stone Troll | Elder Troll | L |
| Minotaur | Warrior Minotaur | Berserker Minotaur | Guardian Minotaur | Blood Minotaur | Minotaur King | M · L |
| Skeleton | Warrior Skeleton | Archer Skeleton | Knight Skeleton | Mage Skeleton | Bone Colossus | S · M · L |
| Mummy | Warrior Mummy | Priest Mummy | Cursed Mummy | Royal Mummy | Mummy Lord | M · L |
| Vampire | Blood Vampire | Noble Vampire | Vampire Knight | Vampire Lord | Ancient Vampire | M · L |
| Demon | Imp | Demon Mage | Demon Brute | Demon Knight | Archdemon | M · L |
| Slime | Splitter Slime | Acid Slime | Devourer Slime | Mimic Slime | Slime King | S · M |
| Spider | Cave Spider | Hunter Spider | Web Spider | Venom Spider | Broodmother | S · M |
| Wolf | Hunting Wolf | Dire Wolf | Shadow Wolf | Alpha Wolf | Wolf King | S · M |
| Golem | Stone Golem `L` | Iron Golem `L` | Guardian Golem | Crystal Golem | Colossus | L |
| Dragon | Wyrmling | Drake | Wyvern | Elder Dragon | Ancient Dragon | M · L |
| Treant | Young Treant `L` | Thorn Treant `L` | Rotting Treant | Ancient Treant | Treant Elder | L |
| Human | Ranger | Warrior | Knight | Mage | Paladin | S · M · L |
| Lizardman | Hunter Lizardman | Warrior Lizardman | Scale Knight | Shaman Lizardman | Lizardman Chief | S · M · L |
| Elf | Wood Elf | High Elf | Moon Elf | Dark Elf | Elven Archmage | M · L |
| Giant | Hill Giant `L` | Stone Giant `L` | Frost Giant | Fire Giant | Storm Giant | L |
| Werewolf | Wolfman | Dire Werewolf | Blood Werewolf | Alpha Werewolf | Werewolf Lord | M · L |
| Dryad | Forest Dryad | Flower Dryad | Thorn Dryad | Corrupted Dryad | Ancient Dryad | M · L |

Body-class numbers are unchanged from the live model (`mob.sizes`): Small HP ×0.7 · PS ×0.7 · ev ×1.10;
Medium ×1/×1/×1; Large HP ×1.7 · PS ×1.35 · ev ×0.90; Elite HP ×6 · PS ×4 (forced Large); Boss HP ×15 ·
PS ×18. A variant never stacks two bodies, and an Elite is a flag on the race, not a sixth size.

# 3.1 Variant stat block — all 110 entries

Every row is one spawnable variant: the species block (§1 · §2) resolved through its body class (§3).

- **HP and dmg/s** are the raw `mob_HP(L)` / `mob_PS(L)` curve at **Lv 90** × the body multiplier. In a
  live zone each entry is divided by that zone's body factor (`zoneBodyFactor`), exactly as
  `mob-roster.md` does, so these are the undivided curve values.
- **accuracy · armour · res% · crit% · gate% · dodge%** are **body-independent** — they are the race's
  own numbers, so a variant's identity is its body, not its flat stat line.
- **evasion** = race evasion × `body.evasion` (Small 1.10 · Medium 1.00 · Large 0.90 · Elite 0.90 ·
  Boss 1.00), capped 80.
- **XP@90** = `10 × mob level` (900 here) · Elite ×3 (2700) · Boss ×15 (13500).
- Where the same body repeats inside one race (e.g. Orc Shaman/Berserker both Large) the pad rule from
  §3 is showing: a race that fields fewer than three farming bodies fills the third slot with its
  largest body.

| Race | Variant | Tier | Body | HP@90 | dmg/s@90 | accuracy | evasion | armour | res% | crit% | gate% | dodge% | group | XP@90 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Goblin | Sneak Goblin | Small | small | 7496 | 213 | 118 | 57.8 | 280 | 5.3 | 5.9 | 5.3 | 11.9 | group | 900 |
| Goblin | Raider Goblin | Medium | medium | 10709 | 304 | 118 | 52.6 | 280 | 5.3 | 5.9 | 5.3 | 11.9 | group | 900 |
| Goblin | Tinker Goblin | Large | large | 18205 | 410 | 118 | 47.3 | 280 | 5.3 | 5.9 | 5.3 | 11.9 | alone | 900 |
| Goblin | Shaman Goblin | Elite | elite | 64254 | 1215 | 118 | 47.3 | 280 | 5.3 | 5.9 | 5.3 | 11.9 | alone | 2700 |
| Goblin | Goblin King | Boss | boss | 160635 | 5467 | 118 | 52.6 | 280 | 5.3 | 5.9 | 5.3 | 11.9 | alone | 13500 |
| Orc | Raider Orc | Medium | medium | 10709 | 304 | 90 | 40.1 | 321 | 6.9 | 5.2 | 4.0 | 10.8 | group | 900 |
| Orc | Shaman Orc | Large | large | 18205 | 410 | 90 | 36.1 | 321 | 6.9 | 5.2 | 4.0 | 10.8 | alone | 900 |
| Orc | Berserker Orc | Large | large | 18205 | 410 | 90 | 36.1 | 321 | 6.9 | 5.2 | 4.0 | 10.8 | alone | 900 |
| Orc | Juggernaut Orc | Elite | elite | 64254 | 1215 | 90 | 36.1 | 321 | 6.9 | 5.2 | 4.0 | 10.8 | alone | 2700 |
| Orc | Warlord Orc | Boss | boss | 160635 | 5467 | 90 | 40.1 | 321 | 6.9 | 5.2 | 4.0 | 10.8 | alone | 13500 |
| Kobold | Miner Kobold | Small | small | 7496 | 213 | 86 | 63.2 | 232 | 4.6 | 6.6 | 5.7 | 13.2 | group | 900 |
| Kobold | Trapper Kobold | Medium | medium | 10709 | 304 | 86 | 57.5 | 232 | 4.6 | 6.6 | 5.7 | 13.2 | group | 900 |
| Kobold | Tinker Kobold | Medium | medium | 10709 | 304 | 86 | 57.5 | 232 | 4.6 | 6.6 | 5.7 | 13.2 | group | 900 |
| Kobold | Drake Kobold | Elite | elite | 64254 | 1215 | 86 | 51.7 | 232 | 4.6 | 6.6 | 5.7 | 13.2 | alone | 2700 |
| Kobold | Hoarder Kobold | Boss | boss | 160635 | 5467 | 86 | 57.5 | 232 | 4.6 | 6.6 | 5.7 | 13.2 | alone | 13500 |
| Ogre | Brute Ogre | Medium | medium | 10709 | 304 | 60 | 40.1 | 310 | 7.5 | 5.2 | 4.0 | 9.9 | group | 900 |
| Ogre | Butcher Ogre | Large | large | 18205 | 410 | 60 | 36.1 | 310 | 7.5 | 5.2 | 4.0 | 9.9 | alone | 900 |
| Ogre | Swamp Ogre | Large | large | 18205 | 410 | 60 | 36.1 | 310 | 7.5 | 5.2 | 4.0 | 9.9 | alone | 900 |
| Ogre | Mage Ogre | Elite | elite | 64254 | 1215 | 60 | 36.1 | 310 | 7.5 | 5.2 | 4.0 | 9.9 | alone | 2700 |
| Ogre | Ogre King | Boss | boss | 160635 | 5467 | 60 | 40.1 | 310 | 7.5 | 5.2 | 4.0 | 9.9 | alone | 13500 |
| Troll | Cave Troll | Large | large | 18205 | 410 | 60 | 36.1 | 299 | 8.0 | 5.2 | 4.0 | 8.9 | alone | 900 |
| Troll | Forest Troll | Large | large | 18205 | 410 | 60 | 36.1 | 299 | 8.0 | 5.2 | 4.0 | 8.9 | alone | 900 |
| Troll | Swamp Troll | Large | large | 18205 | 410 | 60 | 36.1 | 299 | 8.0 | 5.2 | 4.0 | 8.9 | alone | 900 |
| Troll | Stone Troll | Elite | elite | 64254 | 1215 | 60 | 36.1 | 299 | 8.0 | 5.2 | 4.0 | 8.9 | alone | 2700 |
| Troll | Elder Troll | Boss | boss | 160635 | 5467 | 60 | 40.1 | 299 | 8.0 | 5.2 | 4.0 | 8.9 | alone | 13500 |
| Minotaur | Warrior Minotaur | Medium | medium | 10709 | 304 | 98 | 43.4 | 297 | 6.3 | 4.9 | 4.3 | 10.4 | group | 900 |
| Minotaur | Berserker Minotaur | Large | large | 18205 | 410 | 98 | 39.0 | 297 | 6.3 | 4.9 | 4.3 | 10.4 | alone | 900 |
| Minotaur | Guardian Minotaur | Large | large | 18205 | 410 | 98 | 39.0 | 297 | 6.3 | 4.9 | 4.3 | 10.4 | alone | 900 |
| Minotaur | Blood Minotaur | Elite | elite | 64254 | 1215 | 98 | 39.0 | 297 | 6.3 | 4.9 | 4.3 | 10.4 | alone | 2700 |
| Minotaur | Minotaur King | Boss | boss | 160635 | 5467 | 98 | 43.4 | 297 | 6.3 | 4.9 | 4.3 | 10.4 | alone | 13500 |
| Skeleton | Warrior Skeleton | Small | small | 7496 | 213 | 34 | 50.1 | 267 | 8.5 | 4.9 | 4.6 | 7.7 | group | 900 |
| Skeleton | Archer Skeleton | Medium | medium | 10709 | 304 | 34 | 45.5 | 267 | 8.5 | 4.9 | 4.6 | 7.7 | group | 900 |
| Skeleton | Knight Skeleton | Large | large | 18205 | 410 | 34 | 41.0 | 267 | 8.5 | 4.9 | 4.6 | 7.7 | alone | 900 |
| Skeleton | Mage Skeleton | Elite | elite | 64254 | 1215 | 34 | 41.0 | 267 | 8.5 | 4.9 | 4.6 | 7.7 | alone | 2700 |
| Skeleton | Bone Colossus | Boss | boss | 160635 | 5467 | 34 | 45.5 | 267 | 8.5 | 4.9 | 4.6 | 7.7 | alone | 13500 |
| Mummy | Warrior Mummy | Medium | medium | 10709 | 304 | 32 | 42.3 | 278 | 8.5 | 5.1 | 4.2 | 8.2 | group | 900 |
| Mummy | Priest Mummy | Large | large | 18205 | 410 | 32 | 38.1 | 278 | 8.5 | 5.1 | 4.2 | 8.2 | alone | 900 |
| Mummy | Cursed Mummy | Large | large | 18205 | 410 | 32 | 38.1 | 278 | 8.5 | 5.1 | 4.2 | 8.2 | alone | 900 |
| Mummy | Royal Mummy | Elite | elite | 64254 | 1215 | 32 | 38.1 | 278 | 8.5 | 5.1 | 4.2 | 8.2 | alone | 2700 |
| Mummy | Mummy Lord | Boss | boss | 160635 | 5467 | 32 | 42.3 | 278 | 8.5 | 5.1 | 4.2 | 8.2 | alone | 13500 |
| Vampire | Blood Vampire | Medium | medium | 10709 | 304 | 116 | 51.5 | 249 | 5.4 | 5.2 | 5.2 | 11.8 | group | 900 |
| Vampire | Noble Vampire | Large | large | 18205 | 410 | 116 | 46.4 | 249 | 5.4 | 5.2 | 5.2 | 11.8 | alone | 900 |
| Vampire | Vampire Knight | Large | large | 18205 | 410 | 116 | 46.4 | 249 | 5.4 | 5.2 | 5.2 | 11.8 | alone | 900 |
| Vampire | Vampire Lord | Elite | elite | 64254 | 1215 | 116 | 46.4 | 249 | 5.4 | 5.2 | 5.2 | 11.8 | alone | 2700 |
| Vampire | Ancient Vampire | Boss | boss | 160635 | 5467 | 116 | 51.5 | 249 | 5.4 | 5.2 | 5.2 | 11.8 | alone | 13500 |
| Demon | Imp | Medium | medium | 10709 | 304 | 106 | 47.2 | 254 | 5.8 | 4.7 | 4.7 | 10.0 | group | 900 |
| Demon | Demon Mage | Large | large | 18205 | 410 | 106 | 42.5 | 254 | 5.8 | 4.7 | 4.7 | 10.0 | alone | 900 |
| Demon | Demon Brute | Large | large | 18205 | 410 | 106 | 42.5 | 254 | 5.8 | 4.7 | 4.7 | 10.0 | alone | 900 |
| Demon | Demon Knight | Elite | elite | 64254 | 1215 | 106 | 42.5 | 254 | 5.8 | 4.7 | 4.7 | 10.0 | alone | 2700 |
| Demon | Archdemon | Boss | boss | 160635 | 5467 | 106 | 47.2 | 254 | 5.8 | 4.7 | 4.7 | 10.0 | alone | 13500 |
| Slime | Splitter Slime | Small | small | 7496 | 213 | 6 | 43.5 | 158 | 7.9 | 5.6 | 4.0 | 6.7 | group | 900 |
| Slime | Acid Slime | Medium | medium | 10709 | 304 | 6 | 39.6 | 158 | 7.9 | 5.6 | 4.0 | 6.7 | group | 900 |
| Slime | Devourer Slime | Medium | medium | 10709 | 304 | 6 | 39.6 | 158 | 7.9 | 5.6 | 4.0 | 6.7 | group | 900 |
| Slime | Mimic Slime | Elite | elite | 64254 | 1215 | 6 | 35.6 | 158 | 7.9 | 5.6 | 4.0 | 6.7 | alone | 2700 |
| Slime | Slime King | Boss | boss | 160635 | 5467 | 6 | 39.6 | 158 | 7.9 | 5.6 | 4.0 | 6.7 | alone | 13500 |
| Spider | Cave Spider | Small | small | 7496 | 213 | 101 | 73.9 | 156 | 4.4 | 6.1 | 6.7 | 13.3 | group | 900 |
| Spider | Hunter Spider | Medium | medium | 10709 | 304 | 101 | 67.2 | 156 | 4.4 | 6.1 | 6.7 | 13.3 | group | 900 |
| Spider | Web Spider | Medium | medium | 10709 | 304 | 101 | 67.2 | 156 | 4.4 | 6.1 | 6.7 | 13.3 | group | 900 |
| Spider | Venom Spider | Elite | elite | 64254 | 1215 | 101 | 60.5 | 156 | 4.4 | 6.1 | 6.7 | 13.3 | alone | 2700 |
| Spider | Broodmother | Boss | boss | 160635 | 5467 | 101 | 67.2 | 156 | 4.4 | 6.1 | 6.7 | 13.3 | alone | 13500 |
| Wolf | Hunting Wolf | Small | small | 7496 | 213 | 168 | 61.4 | 245 | 5.0 | 5.6 | 5.6 | 13.3 | group | 900 |
| Wolf | Dire Wolf | Medium | medium | 10709 | 304 | 168 | 55.8 | 245 | 5.0 | 5.6 | 5.6 | 13.3 | group | 900 |
| Wolf | Shadow Wolf | Medium | medium | 10709 | 304 | 168 | 55.8 | 245 | 5.0 | 5.6 | 5.6 | 13.3 | group | 900 |
| Wolf | Alpha Wolf | Elite | elite | 64254 | 1215 | 168 | 50.3 | 245 | 5.0 | 5.6 | 5.6 | 13.3 | alone | 2700 |
| Wolf | Wolf King | Boss | boss | 160635 | 5467 | 168 | 55.8 | 245 | 5.0 | 5.6 | 5.6 | 13.3 | alone | 13500 |
| Golem | Stone Golem | Large | large | 18205 | 410 | 30 | 36.6 | 369 | 8.4 | 3.5 | 4.1 | 6.4 | alone | 900 |
| Golem | Iron Golem | Large | large | 18205 | 410 | 30 | 36.6 | 369 | 8.4 | 3.5 | 4.1 | 6.4 | alone | 900 |
| Golem | Guardian Golem | Large | large | 18205 | 410 | 30 | 36.6 | 369 | 8.4 | 3.5 | 4.1 | 6.4 | alone | 900 |
| Golem | Crystal Golem | Elite | elite | 64254 | 1215 | 30 | 36.6 | 369 | 8.4 | 3.5 | 4.1 | 6.4 | alone | 2700 |
| Golem | Colossus | Boss | boss | 160635 | 5467 | 30 | 40.7 | 369 | 8.4 | 3.5 | 4.1 | 6.4 | alone | 13500 |
| Dragon | Wyrmling | Medium | medium | 10709 | 304 | 132 | 43.9 | 321 | 7.0 | 4.1 | 4.4 | 8.2 | group | 900 |
| Dragon | Drake | Large | large | 18205 | 410 | 132 | 39.5 | 321 | 7.0 | 4.1 | 4.4 | 8.2 | alone | 900 |
| Dragon | Wyvern | Large | large | 18205 | 410 | 132 | 39.5 | 321 | 7.0 | 4.1 | 4.4 | 8.2 | alone | 900 |
| Dragon | Elder Dragon | Elite | elite | 64254 | 1215 | 132 | 39.5 | 321 | 7.0 | 4.1 | 4.4 | 8.2 | alone | 2700 |
| Dragon | Ancient Dragon | Boss | boss | 160635 | 5467 | 132 | 43.9 | 321 | 7.0 | 4.1 | 4.4 | 8.2 | alone | 13500 |
| Treant | Young Treant | Large | large | 18205 | 410 | 30 | 36.6 | 334 | 8.2 | 4.3 | 4.1 | 7.7 | alone | 900 |
| Treant | Thorn Treant | Large | large | 18205 | 410 | 30 | 36.6 | 334 | 8.2 | 4.3 | 4.1 | 7.7 | alone | 900 |
| Treant | Rotting Treant | Large | large | 18205 | 410 | 30 | 36.6 | 334 | 8.2 | 4.3 | 4.1 | 7.7 | alone | 900 |
| Treant | Ancient Treant | Elite | elite | 64254 | 1215 | 30 | 36.6 | 334 | 8.2 | 4.3 | 4.1 | 7.7 | alone | 2700 |
| Treant | Treant Elder | Boss | boss | 160635 | 5467 | 30 | 40.7 | 334 | 8.2 | 4.3 | 4.1 | 7.7 | alone | 13500 |
| Human | Ranger | Small | small | 7496 | 213 | 138 | 67.4 | 245 | 5.0 | 5.6 | 6.1 | 10.6 | group | 900 |
| Human | Warrior | Medium | medium | 10709 | 304 | 138 | 61.3 | 245 | 5.0 | 5.6 | 6.1 | 10.6 | group | 900 |
| Human | Knight | Large | large | 18205 | 410 | 138 | 55.1 | 245 | 5.0 | 5.6 | 6.1 | 10.6 | alone | 900 |
| Human | Mage | Elite | elite | 64254 | 1215 | 138 | 55.1 | 245 | 5.0 | 5.6 | 6.1 | 10.6 | alone | 2700 |
| Human | Paladin | Boss | boss | 160635 | 5467 | 138 | 61.3 | 245 | 5.0 | 5.6 | 6.1 | 10.6 | alone | 13500 |
| Lizardman | Hunter Lizardman | Small | small | 7496 | 213 | 116 | 56.7 | 252 | 5.4 | 6.3 | 5.2 | 12.6 | group | 900 |
| Lizardman | Warrior Lizardman | Medium | medium | 10709 | 304 | 116 | 51.5 | 252 | 5.4 | 6.3 | 5.2 | 12.6 | group | 900 |
| Lizardman | Scale Knight | Large | large | 18205 | 410 | 116 | 46.4 | 252 | 5.4 | 6.3 | 5.2 | 12.6 | alone | 900 |
| Lizardman | Shaman Lizardman | Elite | elite | 64254 | 1215 | 116 | 46.4 | 252 | 5.4 | 6.3 | 5.2 | 12.6 | alone | 2700 |
| Lizardman | Lizardman Chief | Boss | boss | 160635 | 5467 | 116 | 51.5 | 252 | 5.4 | 6.3 | 5.2 | 12.6 | alone | 13500 |
| Elf | Wood Elf | Medium | medium | 10709 | 304 | 203 | 67.8 | 186 | 4.2 | 5.2 | 6.8 | 11.7 | group | 900 |
| Elf | High Elf | Large | large | 18205 | 410 | 203 | 61.0 | 186 | 4.2 | 5.2 | 6.8 | 11.7 | alone | 900 |
| Elf | Moon Elf | Large | large | 18205 | 410 | 203 | 61.0 | 186 | 4.2 | 5.2 | 6.8 | 11.7 | alone | 900 |
| Elf | Dark Elf | Elite | elite | 64254 | 1215 | 203 | 61.0 | 186 | 4.2 | 5.2 | 6.8 | 11.7 | alone | 2700 |
| Elf | Elven Archmage | Boss | boss | 160635 | 5467 | 203 | 67.8 | 186 | 4.2 | 5.2 | 6.8 | 11.7 | alone | 13500 |
| Giant | Hill Giant | Large | large | 18205 | 410 | 30 | 36.6 | 345 | 7.6 | 4.3 | 4.1 | 8.7 | alone | 900 |
| Giant | Stone Giant | Large | large | 18205 | 410 | 30 | 36.6 | 345 | 7.6 | 4.3 | 4.1 | 8.7 | alone | 900 |
| Giant | Frost Giant | Large | large | 18205 | 410 | 30 | 36.6 | 345 | 7.6 | 4.3 | 4.1 | 8.7 | alone | 900 |
| Giant | Fire Giant | Elite | elite | 64254 | 1215 | 30 | 36.6 | 345 | 7.6 | 4.3 | 4.1 | 8.7 | alone | 2700 |
| Giant | Storm Giant | Boss | boss | 160635 | 5467 | 30 | 40.7 | 345 | 7.6 | 4.3 | 4.1 | 8.7 | alone | 13500 |
| Werewolf | Wolfman | Medium | medium | 10709 | 304 | 145 | 48.3 | 284 | 6.0 | 5.4 | 4.8 | 12.1 | group | 900 |
| Werewolf | Dire Werewolf | Large | large | 18205 | 410 | 145 | 43.4 | 284 | 6.0 | 5.4 | 4.8 | 12.1 | alone | 900 |
| Werewolf | Blood Werewolf | Large | large | 18205 | 410 | 145 | 43.4 | 284 | 6.0 | 5.4 | 4.8 | 12.1 | alone | 900 |
| Werewolf | Alpha Werewolf | Elite | elite | 64254 | 1215 | 145 | 43.4 | 284 | 6.0 | 5.4 | 4.8 | 12.1 | alone | 2700 |
| Werewolf | Werewolf Lord | Boss | boss | 160635 | 5467 | 145 | 48.3 | 284 | 6.0 | 5.4 | 4.8 | 12.1 | alone | 13500 |
| Dryad | Forest Dryad | Medium | medium | 10709 | 304 | 95 | 63.4 | 158 | 4.8 | 5.3 | 6.3 | 10.0 | group | 900 |
| Dryad | Flower Dryad | Large | large | 18205 | 410 | 95 | 57.1 | 158 | 4.8 | 5.3 | 6.3 | 10.0 | alone | 900 |
| Dryad | Thorn Dryad | Large | large | 18205 | 410 | 95 | 57.1 | 158 | 4.8 | 5.3 | 6.3 | 10.0 | alone | 900 |
| Dryad | Corrupted Dryad | Elite | elite | 64254 | 1215 | 95 | 57.1 | 158 | 4.8 | 5.3 | 6.3 | 10.0 | alone | 2700 |
| Dryad | Ancient Dryad | Boss | boss | 160635 | 5467 | 95 | 63.4 | 158 | 4.8 | 5.3 | 6.3 | 10.0 | alone | 13500 |

What the variant table shows:

- **Race defines the block, body defines the fight.** Goblin and Goblin King share every stat except HP
  (7,496 → 160,635) and dmg/s (213 → 5,467); a player's answer is the same, the length of the fight is
  not.
- **All-alone races:** Golem · Troll · Treant · Giant field **no group body** — every farming variant is
  Large, so there is never a soft version to farm.
- **Never-Large races:** Slime · Spider · Wolf · Kobold are killed in groups; the solo roadblock of their
  zone always comes from another race on that zone's cast.
- **Cheapest farming body:** any Small (HP 7,496 / dmg 213 at Lv 90) — the Small/Medium group entries are
  where kills/hr is bought.
- **Boss = Large ×15 HP and ×18 dmg/s**, and keeps the race's own evasion line (Boss reads as Large for
  the weapon size matchup only).

# 4. Zone → region → sub-zone

**Three layers: region → zone → sub-zone.** A **region** groups 5 zones and a level band; a **zone** is
the priced unit (`mob_HP` / `mob_PS` / group size / spawn clamp); a **sub-zone** is what a spawn table
rolls against, and it carries its **own race pair and its own Element**. A zone's cast is the union of
its sub-zones, and the zone keeps **one named boss**.

| Region | Theme | Zones | Levels |
|---|---|---|---|
| I | The Verdant Reach | Z1-Z5 | 1-60 |
| II | The Deep Dominion | Z6-Z10 | 61-120 |
| III | The Blighted Shore | Z11-Z15 | 121-180 |

Rules this shelf assumes:
- **15 zones × 12 levels = 180**, the spawn cap (`stat.mob_level_cap`); a region is 5 zones = 60 levels.
  The live game is 18 zones × 10 = 180, so the cap is matched but the split is not (§6 q1).
- A **sub-zone fields 2 races**; a zone fields **3 sub-zones**. Sub-zone names are the environments
  `owner/zone-mob.md` lists where it lists them (Swamp = swamp / mud / poison → 3 sub-zones), and the
  zone's suitable-race list is the union across its sub-zones.
- A sub-zone's **Element is one of the zone's own**; the innate roll stays inside it
  (`mob.element_roll`, species bias ×3), so `res` is prepared from the zone.
- **Group size, level band and the `mob_HP` curve stay zone-level** — a sub-zone changes the cast and the
  Element, never the price.
- **Variants:** each sub-zone spawns **V1-V3** (normal bodies) of its two races and may roll the **Elite
  V4** of one of them (the existing 0.5% flag, forced to Large). The **V5 boss is zone-level**, one per
  zone.
- **Minotaur** is the one race `owner/zone-mob.md` does not place; this sheet seats it in the Cave
  labyrinth (Z6 Sunken Vault) — owner to confirm (§6).

| Region | Zone | Levels | Sub-zone | Environment | Element | Races | Normal variants (V1-V3) | Elite (V4) |
|---|---|---|---|---|---|---|---|---|
| I | Z1 Grassland | 1-12 | Open Grassland | grassland | lightning | Human · Wolf | Ranger, Warrior, Knight · Hunting/Dire/Shadow Wolf | Mage |
| I | Z1 Grassland | 1-12 | Village Outskirts | village | lightning | Human · Goblin | Ranger, Warrior, Knight · Sneak/Raider/Tinker Goblin | Mage |
| I | Z1 Grassland | 1-12 | Raider Camp | camp | lightning | Orc · Goblin | Raider/Shaman/Berserker Orc · Sneak/Raider/Tinker Goblin | Juggernaut Orc |
| I | Z2 Dark Forest | 13-24 | Fog Thicket | fog | poison | Wolf · Spider | Hunting/Dire/Shadow Wolf · Cave/Hunter/Web Spider | Alpha Wolf |
| I | Z2 Dark Forest | 13-24 | Dark Grove | dark forest | poison | Goblin · Werewolf | Sneak/Raider/Tinker Goblin · Wolfman, Dire/Blood Werewolf | Shaman Goblin |
| I | Z2 Dark Forest | 13-24 | Spider Hollow | hollow | poison | Spider · Goblin | Cave/Hunter/Web Spider · Sneak/Raider/Tinker Goblin | Venom Spider |
| I | Z3 Enchanted Forest | 25-36 | Glimmer Grove | grove | chaos | Dryad · Elf | Forest/Flower/Thorn Dryad · Wood/High/Moon Elf | Corrupted Dryad |
| I | Z3 Enchanted Forest | 25-36 | Elder Rootway | rootway | chaos | Treant · Dryad | Young/Thorn/Rotting Treant · Forest/Flower/Thorn Dryad | Ancient Treant |
| I | Z3 Enchanted Forest | 25-36 | Moonlit Glade | glade | chaos | Elf · Dryad | Wood/High/Moon Elf · Forest/Flower/Thorn Dryad | Dark Elf |
| I | Z4 Swamp | 37-48 | Murky Swamp | swamp | poison | Lizardman · Slime | Hunter/Warrior Lizardman, Scale Knight · Splitter/Acid/Devourer Slime | Shaman Lizardman |
| I | Z4 Swamp | 37-48 | Mud Flats | mud | poison | Troll · Lizardman | Cave/Forest/Swamp Troll · Hunter/Warrior Lizardman, Scale Knight | Stone Troll |
| I | Z4 Swamp | 37-48 | Poison Fen | poison fen | poison | Spider · Slime | Cave/Hunter/Web Spider · Splitter/Acid/Devourer Slime | Venom Spider |
| I | Z5 Mountain | 49-60 | Mountain Slopes | mountain | cold | Orc · Ogre | Raider/Shaman/Berserker Orc · Brute/Butcher/Swamp Ogre | Juggernaut Orc |
| I | Z5 Mountain | 49-60 | Cliff Holds | cliff | cold | Ogre · Giant | Brute/Butcher/Swamp Ogre · Hill/Stone/Frost Giant | Mage Ogre |
| I | Z5 Mountain | 49-60 | Dragon Peak | peak | cold | Dragon · Giant | Wyrmling, Drake/Wyvern · Hill/Stone/Frost Giant | Elder Dragon |
| II | Z6 Cave | 61-72 | Tunnels | tunnels | lightning | Kobold · Spider | Miner/Trapper/Tinker Kobold · Cave/Hunter/Web Spider | Drake Kobold |
| II | Z6 Cave | 61-72 | Deep Warrens | warrens | lightning | Troll · Kobold | Cave/Forest/Swamp Troll · Miner/Trapper/Tinker Kobold | Stone Troll |
| II | Z6 Cave | 61-72 | Sunken Vault | vault | lightning | Golem · Minotaur | Stone/Iron/Guardian Golem · Warrior/Berserker/Guardian Minotaur | Crystal Golem |
| II | Z7 Volcanic Lands | 73-84 | Ash Fields | volcano | fire | Demon · Ogre | Imp, Demon Mage/Brute · Brute/Butcher/Swamp Ogre | Demon Knight |
| II | Z7 Volcanic Lands | 73-84 | Slag Pit | lava | fire | Golem · Ogre | Stone/Iron/Guardian Golem · Brute/Butcher/Swamp Ogre | Crystal Golem |
| II | Z7 Volcanic Lands | 73-84 | Caldera | caldera | fire | Dragon · Demon | Wyrmling, Drake/Wyvern · Imp, Demon Mage/Brute | Elder Dragon |
| II | Z8 Frozen Lands | 85-96 | Snowfield | snow | cold | Wolf · Troll | Hunting/Dire/Shadow Wolf · Cave/Forest/Swamp Troll | Alpha Wolf |
| II | Z8 Frozen Lands | 85-96 | Glacier Shelf | ice | cold | Giant · Troll | Hill/Stone/Frost Giant · Cave/Forest/Swamp Troll | Fire Giant |
| II | Z8 Frozen Lands | 85-96 | Rime Hollow | rime | cold | Dragon · Wolf | Wyrmling, Drake/Wyvern · Hunting/Dire/Shadow Wolf | Elder Dragon |
| II | Z9 Desert | 97-108 | Dune Sea | dunes | fire | Lizardman · Orc | Hunter/Warrior Lizardman, Scale Knight · Raider/Shaman/Berserker Orc | Shaman Lizardman |
| II | Z9 Desert | 97-108 | Sunken Tombs | tombs | fire | Mummy · Lizardman | Warrior/Priest/Cursed Mummy · Hunter/Warrior Lizardman, Scale Knight | Royal Mummy |
| II | Z9 Desert | 97-108 | Scorch Mesa | mesa | fire | Demon · Orc | Imp, Demon Mage/Brute · Raider/Shaman/Berserker Orc | Demon Knight |
| II | Z10 Pyramid | 109-120 | Outer Court | court | poison | Skeleton · Mummy | Warrior/Archer/Knight Skeleton · Warrior/Priest/Cursed Mummy | Mage Skeleton |
| II | Z10 Pyramid | 109-120 | Burial Gallery | gallery | poison | Mummy · Vampire | Warrior/Priest/Cursed Mummy · Blood/Noble Vampire, Vampire Knight | Royal Mummy |
| II | Z10 Pyramid | 109-120 | Inner Sanctum | sanctum | poison | Vampire · Skeleton | Blood/Noble Vampire, Vampire Knight · Warrior/Archer/Knight Skeleton | Vampire Lord |
| III | Z11 Ruined City | 121-132 | Fallen Gate | gate | chaos | Human · Skeleton | Ranger, Warrior, Knight · Warrior/Archer/Knight Skeleton | Mage |
| III | Z11 Ruined City | 121-132 | Market Ruins | market | chaos | Skeleton · Demon | Warrior/Archer/Knight Skeleton · Imp, Demon Mage/Brute | Mage Skeleton |
| III | Z11 Ruined City | 121-132 | Noble Quarter | quarter | chaos | Vampire · Human | Blood/Noble Vampire, Vampire Knight · Ranger, Warrior, Knight | Vampire Lord |
| III | Z12 Cursed Lands | 133-144 | Blight Field | blight | chaos | Skeleton · Werewolf | Warrior/Archer/Knight Skeleton · Wolfman, Dire/Blood Werewolf | Mage Skeleton |
| III | Z12 Cursed Lands | 133-144 | Howling Waste | waste | chaos | Werewolf · Vampire | Wolfman, Dire/Blood Werewolf · Blood/Noble Vampire, Vampire Knight | Alpha Werewolf |
| III | Z12 Cursed Lands | 133-144 | Rift Scar | rift | chaos | Demon · Skeleton | Imp, Demon Mage/Brute · Warrior/Archer/Knight Skeleton | Demon Knight |
| III | Z13 Underworld | 145-156 | Bone Stair | stair | chaos | Slime · Demon | Splitter/Acid/Devourer Slime · Imp, Demon Mage/Brute | Mimic Slime |
| III | Z13 Underworld | 145-156 | Molten Deeps | deeps | chaos | Golem · Slime | Stone/Iron/Guardian Golem · Splitter/Acid/Devourer Slime | Crystal Golem |
| III | Z13 Underworld | 145-156 | Throne Abyss | abyss | chaos | Demon · Golem | Imp, Demon Mage/Brute · Stone/Iron/Guardian Golem | Demon Knight |
| III | Z14 Coast / Sea | 157-168 | Tideflats | coast | cold | Slime · Spider | Splitter/Acid/Devourer Slime · Cave/Hunter/Web Spider | Mimic Slime |
| III | Z14 Coast / Sea | 157-168 | Salt Cliffs | cliffs | cold | Ogre · Lizardman | Brute/Butcher/Swamp Ogre · Hunter/Warrior Lizardman, Scale Knight | Mage Ogre |
| III | Z14 Coast / Sea | 157-168 | Sunken Reef | sea | cold | Lizardman · Slime | Hunter/Warrior Lizardman, Scale Knight · Splitter/Acid/Devourer Slime | Shaman Lizardman |
| III | Z15 Ancient Ruins | 169-180 | Outer Colonnade | ruins | lightning | Human · Golem | Ranger, Warrior, Knight · Stone/Iron/Guardian Golem | Mage |
| III | Z15 Ancient Ruins | 169-180 | Hall of Wardens | temple | lightning | Golem · Elf | Stone/Iron/Guardian Golem · Wood/High/Moon Elf | Crystal Golem |
| III | Z15 Ancient Ruins | 169-180 | Sanctum Depths | depths | lightning | Dragon · Elf | Wyrmling, Drake/Wyvern · Wood/High/Moon Elf | Elder Dragon |

| Zone | Boss (V5) | anchor race |
|---|---|---|
| Z1 Grassland | Warlord Orc | Orc |
| Z2 Dark Forest | Werewolf Lord | Werewolf |
| Z3 Enchanted Forest | Treant Elder | Treant |
| Z4 Swamp | Elder Troll | Troll |
| Z5 Mountain | Storm Giant | Giant |
| Z6 Cave | Colossus | Golem |
| Z7 Volcanic Lands | Ancient Dragon | Dragon |
| Z8 Frozen Lands | Wolf King | Wolf |
| Z9 Desert | Mummy Lord | Mummy |
| Z10 Pyramid | Bone Colossus | Skeleton |
| Z11 Ruined City | Ancient Vampire | Vampire |
| Z12 Cursed Lands | Archdemon | Demon |
| Z13 Underworld | Slime King | Slime |
| Z14 Coast / Sea | Lizardman Chief | Lizardman |
| Z15 Ancient Ruins | Elven Archmage | Elf |

| Race | Zones |
|---|---|
| Goblin | Z1 · Z2 |
| Orc | Z1 · Z5 · Z9 |
| Kobold | Z6 |
| Ogre | Z5 · Z7 · Z14 |
| Troll | Z4 · Z6 · Z8 |
| Minotaur | Z6 |
| Skeleton | Z10 · Z11 · Z12 |
| Mummy | Z9 · Z10 |
| Vampire | Z10 · Z11 · Z12 |
| Demon | Z7 · Z9 · Z11 · Z12 · Z13 |
| Slime | Z4 · Z13 · Z14 |
| Spider | Z2 · Z4 · Z6 · Z14 |
| Wolf | Z1 · Z2 · Z8 |
| Golem | Z6 · Z7 · Z13 · Z15 |
| Dragon | Z5 · Z7 · Z8 · Z15 |
| Treant | Z3 |
| Human | Z1 · Z11 · Z15 |
| Lizardman | Z4 · Z9 · Z14 |
| Elf | Z3 · Z15 |
| Giant | Z5 · Z8 |
| Werewolf | Z2 · Z12 |
| Dryad | Z3 |

**Every race is placed** — each of the 22 appears in at least one zone, and every zone fields 4-6 races
across its 3 sub-zones, so an expanded per-entry roster still clears `X23`'s ≥5 entries/zone.

**Data shape this needs:** the live `mob.zones[]` carries one flat species cast per zone and has no
sub-zone or region field; **X23** counts entries per zone. A region and a sub-zone are **new layers**
(`mob.zones[].subzones[]` plus a region grouping) under AGENT.md §0 — parked here until the owner rules
(§6 q1 · q8).

# 5. How the 12 new vectors were derived

No new number was invented from feeling. Each new race's vector is the **component-wise mean of its two
closest existing species**, rounded to 2 decimals — a published-value interpolation, not a guess:

| New race | Parent A | Parent B |
|---|---|---|
| Kobold | Rat | Goblin |
| Ogre | Orc | Troll |
| Minotaur | Orc | Drake |
| Skeleton | Husk | Knight |
| Mummy | Husk | Troll |
| Vampire | Demon | Wolf |
| Dragon | Drake | Golem |
| Treant | Troll | Golem |
| Lizardman | Orc | Rat |
| Giant | Golem | Orc |
| Werewolf | Wolf | Orc |
| Dryad | Elf | Seraph |

Validation: the 10 reused vectors reproduce the published `mob-roster.md` columns exactly at the same
level and body. To re-derive this table:

```
node --experimental-strip-types engine/index.ts   # createEngine(E) · mobAcc / mobEvasion / armourOf /
                                                  # mobDodge / refAttackerAcc are the live functions
```

# 6. Open questions for the owner

1. **18 vs 15 zones** — keep the live 18 (`mob.zones`) and fold the environment list onto them, or
   replace the zone set with this 15? This decides the boss roster and the level bands.
2. **22 bosses vs 18** — with 22 race-V5 bosses and 15-18 zones, some V5 variants stay unused as
   zone bosses. Unused is fine (future zones), but it should be a decision, not an accident.
3. **Rat / Husk / Drake / Knight / Seraph** are live species not in `zone-mob.md`. Retire them, keep
   them as the "trash / wall" tier beside the new 22, or merge (Drake→Dragon, Knight→Skeleton)?
4. **Bandit vs Human** — `zone-mob.md` says Human; the live species is Bandit. Rename, or keep both as
   separate lineages (`bandit` = outlaw, `human` = militia)?
5. **Spider element bias** — live Spider is `lightning/cold`; this sheet reads it `lightning/poison`
   (`owner/idea-gameplay.md` wants the poison species). Confirm which is intended.
6. **Accuracy tier and `line`** for the 12 new races are proposed by analogue, not published. They are
   the flags most likely to need a veto.
7. **Balance lever** stays per-species (Ragnarok-style): a race that feels weak is fixed by
   raising its own vector, never a global curve. Confirm that rule carries into these 22.
8. **Sub-zone granularity** — 3 sub-zones per zone × 2 races is this sheet's assumption. Is 3 the
   right depth, does a sub-zone ever field 3 races, and does each sub-zone pick its own Element from
   the zone's set (this sheet) or share the zone's whole Element mix? Sub-zones are a **new data
   layer** (`mob.zones[].subzones[]`) under AGENT.md §0, so they land only on an explicit owner ask.
9. **Minotaur has no zone** — `zone-mob.md`'s zoning table never places it. This sheet seats it at the
   Cave labyrinth (Z6 Sunken Vault, next to Golem). Keep that, move it, or give it its own labyrinth
   zone?
10. **Region layer** — §4 adds a region tier (I · II · III, 5 zones each, 60 levels each) above the
    zones. Name the three regions (this sheet: The Verdant Reach · The Deep Dominion · The Blighted
    Shore), keep 5/5/5, or drop the layer and stay flat at 15 zones?
11. **Level bands** — §4 proposes **12 levels/zone** (15 × 12 = 180 = `stat.mob_level_cap`), against the
    live **10 levels/zone**. Confirm 12, keep 10, or derive the bands from the region split.

# 7. Replacing the live roster — the swap checklist

Answer to "what must be added before the old mobs are scrapped" — split into owner decisions, sheet
gaps, and the data/cage steps that run when it lands.

## 7.1 Owner decisions that block the swap

| # | Decision | Where |
|---|---|---|
| 1 | Zone set: these **15** zones vs the live **18** (Eastgate → The Pale Spire) | §6 q1 |
| 2 | Retire map for **Rat · Husk · Drake · Knight · Seraph** (merge Drake→Dragon, Knight→Skeleton?) | §6 q3 |
| 3 | **Bandit vs Human** — rename, or keep both lineages | §6 q4 |
| 4 | **Spider** element bias (lightning/poison vs live lightning/cold) | §6 q5 |
| 5 | **Minotaur** has no zone in `zone-mob.md`; this sheet seats it at Cave | §6 q9 |
| 6 | Sub-zone depth + per-sub-zone Element rule | §6 q8 |
| 7 | Region layer (I · II · III) and its names | §6 q10 |
| 8 | Level bands (12/zone proposed) | §6 q11 |

## 7.2 Still missing from the sheet

- **Per-race drop profile** — junk tied to the race (`idea-gameplay.md`: a wolf drops chews), the HP/MP
  potion drop flag for Human-type races, and the weapon-carrier flag (done in §1).
- **Mob skill profile** per body tier (`combat.md` §5b) — priced per body, not yet per race here.
- **Named boss roster** — 15 zones use 15 of the 22 V5 bosses; 7 stay spare (or seed future zones).
- **Per-zone group size / spawn weight** — reused unchanged from the live model, not re-stated here.

## 7.3 Data + cage steps when it lands (outside `owner/`)

- `tools/data/engine.json`: rewrite `mob.species` → the 22 races (§1), `mob.zones` → 15 zones
  (+ `subzones` · region), `mob.bosses` → 15. `mob.sizes` · `elite` · `element_roll` · `mob.stat.base`
  (108.43) stay.
- Regenerate `doc/world/mob-roster.md` from its writers, then run `node tools/verify.ts` — **X23**
  (≥5 entries/zone), **H1** (`mob_HP` fold), the spawn clamp, and the mob-anchored bands X20/X22/X24/X25.
- Rebuild views: `node tools/build.ts` (dashboard + wiki). No client change is needed for the roster swap
  itself; sub-zones would need a `game/src` spawn picker when they ship.
