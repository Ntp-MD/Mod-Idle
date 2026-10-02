# Formulas — Utility

import core-stats.md
import mod-pool.md
import item-base.md
import equipment-weapon.md

Symbols: `x` = value from build · `x_c` = value from Core stat · `x_f` = value from Mod Flat · `x_p` = value from Mod %

# 7. Attack speed

```
aspd     = weapon_aspd × (100 + (agi − 12) × K_AGI_ASPD + aspd_pct)
aspd     = min(aspd, 300)
hits/sec = aspd / 100
dps      = dmg_per_hit × hits/sec
```

- `K_AGI_ASPD` = 0.25 per 1 Agi · `100` is the level 1 baseline · `− 12` is the level 1 Base stat, not double-counted.
- **The old formula `aspd = agi × 0.25 × weapon_aspd` did not work at level 1** — Agi 12 gives aspd = 3.6, meaning one hit every 28 seconds · an idle game that waits half a minute per punch dies in the first minute.
  In this new model at level 1 (no gear) sword attacks 1.2 times/sec and dagger 1.5 times/sec, matching what weapon_aspd always stated as the weapon "Base times/sec."
- **There is no `aspd_flat`** — aspd Mod is % only (see mod-pool.md). The old formula added a slot that does not exist.
- Old `interval` was written as `base_interval × 100 / aspd` without stating units · changed to `hits/sec = aspd/100` to match what players see.
- **Cap 300 = 3 times/sec** for all weapons · aspd is a percentage, not a hit count.

| Weapon | weapon_aspd (Base times/sec) | weapon_mult | Agi to hit Cap 300 (with 25% Mod) |
|---|---|---|---|
| dagger | 1.5 | 0.80 | 312 |
| one-handed sword / axe | 1.2 | 1.00 | 512 |
| bow / crossbow | 1.1 | 1.09 | 603 |
| mace / wand / rod | 1.0 | 1.20 | 712 |
| staff / spear | 0.85 | 1.41 | 924 · cannot hit |
| two-handed sword / axe | 0.7 | 1.71 | 1,226 · cannot hit |

- `weapon_aspd` multiplies the whole parenthesis (not only the Agi term) so level 1 can still attack and slow weapons stay slower.
- weapon_mult = `1.2 / weapon_aspd` equalizes DPS across weapon types while nobody hits Cap · verified at Str 12 build: all weapons give exactly 9,847 DPS (dagger 2.62 times/sec × power 3,860 = twoh 1.22 times/sec × power 8,270).
- **Side effect to know**: Agi beyond the Cap point is wasted (sword beyond 512 is zero) · see build conclusions in section 0.

# 8. Accuracy

```
accuracy   = (dex * K_DEX_ACC) * (1 + accuracy_pct/100)
hit_chance = accuracy / (accuracy + evasion_target)
```

- `K_DEX_ACC` = 1.5 · Dex 816 gives 1,224, multiplied by `Accuracy %` Mod max 25 on main hand = **1,530** at ceiling.
- **There is no `accuracy_flat`** — Accuracy Mod is % only (see mod-pool.md), same missing-slot issue as aspd.
- **Removed `accuracy_cap` 2,000** — the ratio formula already limits itself (approaches 100% but never reaches it), and the calculable ceiling 1,530 never hit 2,000, so the old Cap guarded nothing except making numbers look reasoned.
- **Mob evasion changed to `evasion = mob_level × 1`** (level 100 = 100, not 600).
  At 600, players with no Dex would have only 40% hit chance in a game that attacks all day · and 600 was set on the assumption Dex = 890, which no real build can reach.
  Because the single-stat ceiling is 816 and items must also be split to Str/Agi · at `level × 1` both sides grow linearly, so hit rate stays constant at all levels:

| build | Dex | accuracy | level 100 mob evasion | hit chance |
|---|---|---|---|---|
| No Dex | 210 | 394 | 100 | 80% |
| Dex 1 item | 247 | 463 | 100 | 82% |
| Dex 2 items | 286 | 536 | 100 | 84% |
| Full Dex 12 items | 816 | 1,530 | 100 | 94% |

- **Mobs have no dodge** (no dodge value for mobs yet) · `hit_chance` applies to the player side only. To let mobs dodge, mob evasion/dodge must be defined first (see combat.md · not yet present).
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

| Worn set (item-base.md) | High weight | No Str (420) | Str 2 items (520) | Str 6 items (936) |
|---|---|---|---|---|
| cloth/glass (circlet · vestments · wrap · soft · sash · wraps · band · pendant · cloak + dagger + buckler) | 322 | 0% | 0% | 0% |
| balanced (coif · mail · greaves · striders · clasp · gloves + sword + tome) | 507 | **−21%** | 0% | 0% |
| armored (barbute · plate · cuisses · sabatons · girdle · gauntlets · signet · talisman · mantle + 2h axe) | 657 | **−50% (hits ceiling)** | −26% | 0% |

- At mid Item quality the sets range 248-505, which a no-Str character (420) clears for the first two paths · **the tax only bites at high Quality and on heavy armor choices**, when players already know what they picked.
- Weight is a natural cost of better gear because the Quality multiplier ×1.3 applies to weight too, not only to stat values.
- **Effect on the build table in section 0**: all DPS numbers assume no encumbrance · cloth/glass builds take none so the table reads directly · armored builds without enough Str run 21-50% below that table.
