# Formulas — Utility

import core-stats.md
import mod-pool.md
import item-base.md
import equipment-weapon.md

Symbols: `x` = value from build · `x_c` = value from Core stat · `x_f` = value from Mod Flat · `x_p` = value from Mod %

# 7. Attack speed

```
aspd     = weapon_aspd × (100 + (agi − 12) × K_AGI_ASPD + aspd_pct)
aspd     = min(aspd, 500)
hits/sec = aspd / 100
dps      = dmg_per_hit × hits/sec
```

- `K_AGI_ASPD` = 0.25 per 1 Agi · `100` is the level 1 baseline · `− 12` is the level 1 Base stat, not double-counted.
- **The old formula `aspd = agi × 0.25 × weapon_aspd` did not work at level 1** — Agi 12 gives aspd = 3.6, meaning one hit every 28 seconds · an idle game that waits half a minute per punch dies in the first minute.
  In this new model at level 1 (no gear) sword attacks 1.2 times/sec and dagger 1.5 times/sec, matching what weapon_aspd always stated as the weapon "Base times/sec."
- **There is no `aspd_flat`** — aspd Mod is % only (see mod-pool.md). The old formula added a slot that does not exist.
- Old `interval` was written as `base_interval × 100 / aspd` without stating units · changed to `hits/sec = aspd/100` to match what players see.
- **Cap 500 = 5 times/sec** for all weapons · aspd is a percentage, not a hit count · 5 times/sec is the 0.2 sec floor between hits, a clock rule rather than a build target: no weapon reaches it at the Agi ceiling, because `K_AGI_ASPD` is set so the fastest weapon needs Agi 845 and the ceiling is 510.

<!-- BEGIN GENERATED:weapon-cap -->
| Weapon | weapon_aspd (Base times/sec) | weapon_mult | Agi to hit Cap 500 (with 25% Mod) |
|---|---|---|---|
| dagger | 1.5 | 0.80 | 845 · cannot hit |
| one-handed sword / axe | 1.2 | 1.00 | 1,179 · cannot hit |
| bow / crossbow | 1.1 | 1.09 | 1,330 · cannot hit |
| mace / wand | 1 | 1.20 | 1,512 · cannot hit |
| staff / spear | 0.85 | 1.41 | 1,865 · cannot hit |
| two-handed sword / axe | 0.7 | 1.71 | 2,369 · cannot hit |
<!-- END GENERATED:weapon-cap -->

- `weapon_aspd` multiplies the whole parenthesis (not only the Agi term) so level 1 can still attack and slow weapons stay slower.
- weapon_mult = `1.2 / weapon_aspd` equalizes DPS across weapon types while nobody hits Cap · `weapon_aspd` cancels out of `power × times/sec`, so every type lands on the same Expected DPS at equal stats (the Str 12 row of the section 0 table · **X14**).
- **Side effect to know**: Agi never reaches the Cap point, so no Agi is wasted on this axis (dagger would need Agi 845) · see build conclusions in section 0.

# 8. Accuracy

```
accuracy   = (dex * K_DEX_ACC) * (1 + accuracy_pct/100)
evasion    = mob.stat × species.dex × K_EVASION × body_class
hit_chance = accuracy / (accuracy + evasion)
```

- `K_DEX_ACC` = 1.5 · Dex 433 gives 650, multiplied by `Accuracy %` Mod max 25 on main hand = **813** at ceiling.
- `K_EVASION` = 0.5 · the same K the player's own Evasion rating uses, because the two sides meet on one opposed roll. The value is chosen so the mean species on a Medium body lands on the published reference mob, so this is a derivation, not a rebalance — **X21** fails if it stops being true.
- **There is no `accuracy_flat`** — Accuracy Mod is % only (see mod-pool.md), same missing-slot issue as aspd.
- **Removed `accuracy_cap` 2,000** — the ratio formula already limits itself (approaches 100% but never reaches it), and the calculable ceiling 956 never came near 2,000, so the old Cap guarded nothing except making numbers look reasoned.
- **Mob evasion left `level × 1`.** That curve was a stand-in for "evasion grows with the mob's own Dex", and once gave every species a Dex line the stand-in became wrong: it made a Slime and an Elf equally hard to hit at the same level. Body class already moved the number the other way (Small ×1.10 · Large and Elite ×0.90), so size now divides evasion, not just HP.
- The older value, `level 100 = 600`, was set on the assumption Dex = 890 — no build has ever reached that, and the real ceiling is now 510.

<!-- BEGIN GENERATED:hit-chance -->
| Dex from items | Dex | accuracy | hit vs easiest species | hit vs reference mob | hit vs hardest species |
|---|---|---|---|---|---|
| none (level only) | 108 | 203 | 83.7% | 80.5% | 75.0% |
| Dex 1 item | 133 | 250 | 86.3% | 83.6% | 78.7% |
| Dex 2 items | 158 | 297 | 88.2% | 85.8% | 81.4% |
| Full Dex 13 items | 433 | 813 | 95.4% | 94.3% | 92.3% |

Evasion is now the species Dex line (`stat_c × species.dex × K_EVASION 0.5 × body`), so hit chance answers *what* is being hit, not just the level. The reference mob is the **mean species vector on a Medium body** (49.1 evasion at level 190) — a real average of the 22 lineages, not an imaginary ×1.00 one. Easiest = Slime (Dex ×0.73 · 40) · hardest = Elf (Dex ×1.25 · 68).

The reference is set on the mean so the anchor does not move: `stat_c × 0.5` at the roster mean is 49.1 evasion, against the retired `level × 1` curve of 190. The published hit chances therefore hold as they were — 81% with no Dex, 94.3% at the accuracy ceiling — and everything derived from them (the DPS anchor row in formula.md section 0, mob_HP, the E1-E5 kill checkpoints) is untouched. What changed is only *who* sits above and below the reference: the species spread runs 40-68 evasion, and a body class multiplies it again (Small ×1.1 · Large and Elite ×0.9).

**Same line, pointed at the player** — mob accuracy against the player's own Evasion rating (`Dex × 0.5` + Gear Evasion flat 6-30):

| mob accuracy tier | species | mob accuracy | mob hits a Dex 0-item player | mob hits a Full-Dex player |
|---|---|---|---|---|
| ×0.05 | Slime | 6 | 9.9% | 2.7% |
| ×0.25 | Skeleton · Mummy · Golem · Treant · Giant | 31 | 36.7% | 12.7% |
| ×0.50 | Kobold · Ogre · Troll · Spider · Dryad | 81 | 59.8% | 27.1% |
| ×0.75 | Goblin · Orc · Minotaur · Vampire · Demon · Human · Lizardman | 112 | 67.3% | 34.0% |
| ×1.00 | Wolf · Dragon · Elf · Werewolf | 162 | 74.9% | 42.8% |

K_DEX_ACC 1.5 against K_EVASION 0.5 is a 3:1 ratio, so equal Dex on both sides lands the attacker at 75.0%. The defensive line is deliberately the weaker one per point, so one stat alone cannot approach untouchable, and this roll sits at step 2 of the incoming order — behind perfect dodge, ahead of every mitigation (combat.md section 2).
<!-- END GENERATED:hit-chance -->

- **Mobs dodge too** — the second avoidance layer on the same stat block: `own Agi rate ÷ (rate + the attacking player's accuracy)`, the opposed shape X20 already uses on the player side. It is *not* folded into `hit_chance` above, which is the evasion layer only, so a fast weapon with low per-hit damage loses both rolls more often than a slow one. The band is guarded by **X24** and the per-entry numbers are generated in `mob-roster.md`.
- Accuracy is Offensive and can only roll on main hand, while Dex from Core stat still counts toward accuracy normally.

# 10. Drop chance

```
drop_rate = (1 + lck * K_LCK_DROP) × (1 + mastery_collection/100)
```

- `K_LCK_DROP` = 0.01 · Lck 433 gives 5.3x.
- **`drop_rate` is a multiplier, not a probability** — Base drop chance is set at **8% per kill** (loot.md section 2) → no Lck at level 100 gives 24.8% · Lck 535 gives 50.8%.
  This number is tied to craft currency prices and boss skill chances (loot.md · crafting.md · economy.md all closed).
- `mastery_collection` = number of weapon types with Mastery ≥ 10 → **+1% per type, max +11%** (equipment-weapon.md) · does not touch DPS at all, so it moves only item income, not power.
- Lck affects drops, so Lck must not become the stat that is good at everything and outshines the rest — Lck gives crit, perfect dodge, and drops all three, so every K must stay low.
  From the DPS table in section 0: moving 2 items from Str to Lck at the same Agi (Str 8 / Agi 4 → Str 6 / Agi 4 / Lck 2) drops DPS from 6,877 to **6,231 (−9.4%)** in exchange for crit 10.5% → 13.0% — at the retired 816 ceiling the same move cost 22% DPS. The ceiling drop made Lck roughly half as expensive, so the guard this rule was written to set up is held by the G8 ×3.11 junk-line bound (**X7**) instead of by the DPS penalty alone.

# 11. Weight

```
weight_capacity = weight_base + str * K_STR_WEIGHT
weight_used     = sum of 12 items (weight table in mod-pool.md) + carried potions × 2 each (condensed × 12) · farm.md
encumbrance     = min( (weight_used − weight_capacity) / weight_capacity , 0.50 )
aspd            = aspd × (1 − encumbrance)
```

- `K_STR_WEIGHT` = 2 · `weight_base` = 1,000 · Str 433 carries 1,867 · no Str at all (Str = 108 from levels only) carries 1,217.
- **No slot lock** — overweight does not forbid equipping, but *slows attacks* up to -50% aspd.
  Rejected alternative: "cannot equip if overweight", which in an idle game becomes a closed gate on just-dropped loot and forces auto-unequip during AFK.
- The game uses the same unit shown on items (weight unit) and displays `used / capacity` per character-sheet.md rules.

<!-- BEGIN GENERATED:weight-tax -->
| Worn set at high quality (item-base.md) | High weight | No Str (1216) | Str 2 items (1316) | Str 6 items (1516) |
|---|---|---|---|---|
| cloth/glass (Circlet · Vestment · Legwraps · Silk Slippers · Silk Sash · Silk Wraps · Iron Band ×2 · Jade Amulet · Silver Hoop · Traveler's Cloak) | 346 | 0% | 0% | 0% |
| balanced (Hood · Ring Mail · Breeches · Strapped Boots · Chain Clasp · Nimble Mitts · Iron Band ×2 · Jade Amulet · Jade Stud · Traveler's Cloak) | 500 | 0% | 0% | 0% |
| armored (Sallet · Plate Vest · Cuisses · Plated Greaves · War Belt · Iron Gauntlets · Moonstone Signet ×2 · Onyx Talisman · Onyx Drop · Heavy Mantle) | 747 | 0% | 0% | 0% |

Capacity is `weight_base` plus Str × `K_STR_WEIGHT` at level 189 with no investment (108.14285714285714 → 1216), then `core_flat_max` flat per slot spent on Str: 2 items (1316) and 6 items (1516) — Core Stat has no % line any more. The tax is the engine’s own `encumbranceOf`, capped at 50%.
<!-- END GENERATED:weight-tax -->

- **The tax does not bind on the printed sets.** The `weight_base` line sits above the heaviest printed set in every Str column, so none of them is encumbered — the figures are printed above from `tools/data/bases.json`, and a heavier Base weight moves them without a doc edit.
- Weight is a natural cost of better gear because the Quality multiplier in `engine.json` applies to weight too, not only to stat values — once per Item quality band, the same rule `weightAtQuality` uses for a single item.
- **Effect on the build table in section 0**: all DPS numbers assume no encumbrance, and at `weight_base` 1,000 no printed set is encumbered, so the table reads directly.
