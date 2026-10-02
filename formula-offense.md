# Formulas — Offense

import core-stats.md
import mod-pool.md
import equipment-slot.md
import elements.md

Symbols: `x` = value from build · `x_c` = value from Core stat · `x_f` = value from Mod Flat · `x_p` = value from Mod %

# 1. Physical power

```
phys = (str * K_STR + phys_flat) * (1 + phys_pct/100) * weapon_mult
```

- `K_STR` = 5 · Str 816 (level 100 ceiling) gives 4,080
- `phys_flat` = total Physical power Flat from all items (main hand only under the Offensive/Defensive rule) · max 80
- `phys_pct` = total Physical power % from all items · max 16 because it can only roll on main hand
- `weapon_mult` = multiplier by weapon type · decided below

```
phys = (816 × 5 + 80) × 1.16 × weapon_mult = 4,826 × weapon_mult
```

## weapon_mult — No Weapon Base Power

**All weapons draw power from the character only.** There is no Base power per weapon type. Weapons differ in attack rate (`weapon_aspd`) and whether the Mod pool is phys or magic.

`weapon_mult` is set so **DPS is equal for all weapon types at equal stats** = `1.2 / weapon_aspd`, leaving weapon difference in attack rhythm, not in aggregate numbers.

| Weapon | weapon_aspd | weapon_mult |
|---|---|---|
| dagger | 1.5 | 0.80 |
| one-handed sword / axe | 1.2 | 1.00 (baseline) |
| bow / crossbow | 1.1 | 1.09 |
| mace / wand / rod | 1.0 | 1.20 |
| staff / spear | 0.85 | 1.41 |
| two-handed sword / axe | 0.7 | 1.71 |

- Intended side effect: fast weapons are cut by the aspd Cap · at Agi 816 dagger reaches 383 raw aspd but only 300 is usable = 22% loss, while 2h stays at 178 with no cut.
  Late game heavy weapons therefore hit slightly harder in exchange for fewer procs per second (Sonic Blow · Flurry · chill · burn trigger per hit count).
- **glossary.md previously stated Base power "is used as the crit damage base"** — that value no longer exists. Crit damage is set from a 100% Base + Mod only.

> Flat power is only ~2% of phys because only main hand can roll power.
> The main path of Str is Core stat multiplied by `K_STR`, not Flat power.
> To make Flat matter more, add a power Flat slot on off hand (dual wield) instead of changing K_STR.

# 2. Magic power

```
magic = (int * K_INT + magic_flat) * (1 + magic_pct/100) * weapon_mult
```

- `K_INT` = 5 · Int 816 gives 4,080 · same structure as physical but does not touch Str.
- Magic builds use the same numbers as the table in section 0, replacing Str→Int and phys→magic · every row in that table applies directly to magic.

# 3. Critical

```
crit_chance = lck * K_LCK_CRIT + crit_chance_pct
crit_chance = min(crit_chance, 100)

crit_dmg_phys = 100 + crit_dmg_phys_pct
crit_dmg_magic = 100 + crit_dmg_magic_pct
```

- `K_LCK_CRIT` = 0.05 · Lck 816 gives 40.8% + 8% Mod from main hand = 48.8% at the extreme ceiling.
- Crit chance must always have a Cap, otherwise dodge/miss breaks.
- Crit damage may exceed 100. No Cap needed.
- **Crit does not apply to Element damage** (see elements.md)
- `Critical damage %` is split into physical / magic because cloud weapons need their own scaling.

```
dmg_per_hit = phys + magic + elem * elem_align/100
dmg_per_hit = dmg_per_hit * (crit ? crit_dmg : 1)

dps_expected = dmg_per_hit × times/sec × hit_chance × (1 + crit_chance × (crit_dmg/100 − 1))
```

- One weapon rolls one path only, phys **or** magic, by weapon type · `elem` is a third path layered over every weapon.
  (Elemental power slot is secondary on every main hand type, see equipment-slot.md)
- **The reference DPS is expected value, not every-hit crit** — at 18.5% crit + 120% crit damage the average multiplier = 1.22, not 2.2.
  The old numbers in section 0 used 1.62, which matches no component of this formula (crit chance never reaches 100%), so it is treated as wrong and replaced by the new table.
