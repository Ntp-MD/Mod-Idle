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
- **Cap 500 = 5 times/sec** for all weapons · aspd is a percentage, not a hit count · 5 times/sec is the 0.2 sec floor between hits, a clock rule rather than a build target: no weapon reaches it at the Agi ceiling, because `K_AGI_ASPD` is set so the fastest weapon needs Agi 845 and the ceiling is 816.

<!-- BEGIN GENERATED:weapon-cap -->
| Weapon | weapon_aspd (Base times/sec) | weapon_mult | Agi to hit Cap 500 (with 25% Mod) |
|---|---|---|---|
| dagger | 1.5 | 0.80 | 845 · cannot hit |
| one-handed sword / axe | 1.2 | 1.00 | 1,179 · cannot hit |
| bow / crossbow | 1.1 | 1.09 | 1,330 · cannot hit |
| mace / wand / rod | 1 | 1.20 | 1,512 · cannot hit |
| staff / spear | 0.85 | 1.41 | 1,865 · cannot hit |
| two-handed sword / axe | 0.7 | 1.71 | 2,369 · cannot hit |
<!-- END GENERATED:weapon-cap -->

- `weapon_aspd` multiplies the whole parenthesis (not only the Agi term) so level 1 can still attack and slow weapons stay slower.
- weapon_mult = `1.2 / weapon_aspd` equalizes DPS across weapon types while nobody hits Cap · verified at Str 12 build: all weapons give exactly 9,847 DPS (dagger 2.62 times/sec × power 3,860 = twoh 1.22 times/sec × power 8,270).
- **Side effect to know**: Agi never reaches the Cap point, so no Agi is wasted on this axis (dagger would need Agi 845) · see build conclusions in section 0.

# 8. Accuracy

```
accuracy   = (dex * K_DEX_ACC) * (1 + accuracy_pct/100)
evasion    = stat_c(mob_level) × species.dex × K_EVASION × body_class
hit_chance = accuracy / (accuracy + evasion)
```

- `K_DEX_ACC` = 1.5 · Dex 816 gives 1,224, multiplied by `Accuracy %` Mod max 25 on main hand = **1,530** at ceiling.
- `K_EVASION` = 0.5 · the same K the player's own Evasion rating uses, because a mob runs the player's stat block (D-019). The value is chosen so the average species on a Medium body lands back on the retired `level × 1` curve, so this is a derivation, not a rebalance — **X21** fails if it stops being true.
- **There is no `accuracy_flat`** — Accuracy Mod is % only (see mod-pool.md), same missing-slot issue as aspd.
- **Removed `accuracy_cap` 2,000** — the ratio formula already limits itself (approaches 100% but never reaches it), and the calculable ceiling 1,530 never hit 2,000, so the old Cap guarded nothing except making numbers look reasoned.
- **Mob evasion left `level × 1`.** That curve was a stand-in for "evasion grows with the mob's own Dex", and once D-019 gave every species a Dex line the stand-in became wrong: it made a Slime and an Elf equally hard to hit at the same level. Body class already moved the number the other way (Small ×1.10 · Large and Elite ×0.90), so size now divides evasion, not just HP.
- The older value, `level 100 = 600`, was set on the assumption Dex = 890 · no real build reaches that (ceiling 816), and at 600 a player with no Dex sat at 40% hit chance in a game that attacks all day.

<!-- BEGIN GENERATED:hit-chance -->
| Dex from items | Dex | accuracy | hit vs easiest species | hit vs reference mob | hit vs hardest species |
|---|---|---|---|---|---|
| none (level only) | 210 | 394 | 83.7% | 79.8% | 75.0% |
| Dex 1 item | 235 | 441 | 85.2% | 81.6% | 77.0% |
| Dex 2 items | 260 | 488 | 86.4% | 83.0% | 78.8% |
| Full Dex 12 items | 510 | 956 | 92.6% | 90.6% | 87.9% |

Evasion is now the species Dex line (`stat_c × species.dex × K_EVASION 0.5 × body`), so hit chance answers *what* is being hit, not just the level. The reference mob is the **mean species vector on a Medium body** (99.5 evasion at level 100) — a real average of the 15 lineages, not an imaginary ×1.00 one. Easiest = Slime (Dex ×0.73 · 77) · hardest = Elf (Dex ×1.25 · 131).

The reference is set on the mean so the anchor does not move: `stat_c × 0.5` at the roster mean is 99.5 evasion, against the retired `level × 1` curve of 100. The published hit chances therefore hold as they were — 80% with no Dex, 90.6% at the accuracy ceiling — and everything derived from them (the DPS anchor row in formula.md section 0, mob_HP, the E1-E5 hour checkpoints) is untouched. What changed is only *who* sits above and below the reference: the species spread runs 77-131 evasion, and a body class multiplies it again (Small ×1.1 · Large and Elite ×0.9).

**Same line, pointed at the player** — mob accuracy against the player's own Evasion rating (`Dex × 0.5` + Gear Evasion flat 6-30):

| mob accuracy tier | species | mob accuracy | mob hits a Dex 0-item player | mob hits a Full-Dex player |
|---|---|---|---|---|
| ×0.05 | Husk · Slime | 12 | 10.4% | 4.6% |
| ×0.25 | Golem · Knight | 63 | 37.6% | 19.9% |
| ×0.50 | Spider · Troll · Seraph | 161 | 60.5% | 38.7% |
| ×0.75 | Rat · Goblin · Bandit · Orc · Demon | 230 | 68.6% | 47.4% |
| ×1.00 | Wolf · Elf · Drake | 330 | 75.8% | 56.4% |

K_DEX_ACC 1.5 against K_EVASION 0.5 is a 3:1 ratio, so equal Dex on both sides lands the attacker at 75.0%. The defensive line is deliberately the weaker one per point, so one stat alone cannot approach untouchable, and this roll runs *before* Dodge and Perfect dodge (combat.md section 2).
<!-- END GENERATED:hit-chance -->

- **Mobs dodge too** — the second avoidance layer on the same stat block: `own Agi rate ÷ (rate + the attacking player's accuracy)`, the opposed shape X20 already uses on the player side (D-024). It is *not* folded into `hit_chance` above, which is the evasion layer only, so a fast weapon with low per-hit damage loses both rolls more often than a slow one. The band is guarded by **X24** and the per-entry numbers are generated in `mob-roster.md`.
- Accuracy is Offensive and can only roll on main hand, while Dex from Core stat still counts toward accuracy normally.

# 10. Drop chance

```
drop_rate = (1 + lck * K_LCK_DROP) × (1 + mastery_collection/100)
```

- `K_LCK_DROP` = 0.01 · Lck 816 gives 9.2x.
- **`drop_rate` is a multiplier, not a probability** — Base drop chance is set at **8% per kill** (loot.md section 2) → no Lck at level 100 gives 24.8% · Lck 816 gives 73.3%.
  This number is tied to craft currency prices and boss skill chances (loot.md · crafting.md · economy.md all closed).
- `mastery_collection` = number of weapon types with Mastery ≥ 10 → **+1% per type, max +12%** (equipment-weapon.md) · does not touch DPS at all, so it moves only item income, not power.
- Lck affects drops, so Lck must not become the stat that is good at everything and outshines the rest — Lck gives crit, perfect dodge, and drops all three, so every K must stay low.
  From the DPS table in section 0: moving 2 items from Str to Lck (Str 8 / Agi 2 / Lck 2) drops DPS from 9,847 to **7,670 (−22%)** in exchange for crit 18.5% to 21% · Lck value is therefore in crit comfort, not in headline numbers · and Mastery value is in stone farming speed, not power.

# 11. Weight

```
weight_capacity = str * K_STR_WEIGHT
weight_used     = sum of 12 items (weight table in mod-pool.md) + carried potions × 2 each (condensed × 12) · farm.md
encumbrance     = min( (weight_used − weight_capacity) / weight_capacity , 0.50 )
aspd            = aspd × (1 − encumbrance)
```

- `K_STR_WEIGHT` = 2 · Str 816 carries 1,632 · no Str at all (Str = 210 from levels only) carries 420.
- **No slot lock** — overweight does not forbid equipping, but *slows attacks* up to -50% aspd.
  Rejected alternative: "cannot equip if overweight", which in an idle game becomes a closed gate on just-dropped loot and forces auto-unequip during AFK.
- The game uses the same unit shown on items (weight unit) and displays `used / capacity` per character-sheet.md rules.

<!-- BEGIN GENERATED:weight-tax -->
| Worn set at high quality (item-base.md) | High weight | No Str (416) | Str 2 items (568) | Str 6 items (931) |
|---|---|---|---|---|
| cloth/glass (circlet · vestments · wrap · soft boots · sash · wraps · band ×2 · pendant · cloak) | 326 | 0% | 0% | 0% |
| balanced (coif · mail · greaves · striders · clasp · gloves · band ×2 · pendant · cloak) | 473 | −14% | 0% | 0% |
| armored (barbute · plate · cuisses · sabatons · girdle · gauntlets · signet ×2 · talisman · mantle) | 710 | −50% | −25% | 0% |

Capacity is Str × `K_STR_WEIGHT` at level 99 with no investment (208 → 416), then `core_flat_max` and `core_pct_max` per slot spent on Str: 2 items (568) and 6 items (931). The tax is the engine’s own `encumbranceOf`, capped at 50%.
<!-- END GENERATED:weight-tax -->

- A no-Str character clears the light path at every quality and the heavy ones only after spending slots on Str, so **the tax bites at high Quality and on heavy armour choices** — when the player already chose them. The figures above are printed from `tools/data/bases.json`.
- Weight is a natural cost of better gear because the Quality multiplier in `engine.json` applies to weight too, not only to stat values — once per Item quality band, the same rule `weightAtQuality` uses for a single item.
- **Effect on the build table in section 0**: all DPS numbers assume no encumbrance · cloth/glass builds take none so the table reads directly · armored builds without enough Str run below that table by the tax printed above, up to the Cap.
