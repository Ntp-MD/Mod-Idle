# Final Stat Calculation

The character sheet is assembled by `game/src/sim/player.ts`; shared formulas live in `engine/index.ts`. Read values from `tools/data/engine.json`, `mods.json`, `bases.json` and `tree.json`. Do not duplicate configured values here.

## Inputs and order

1. Read the character's level and allocated points for each Core stat: `str`, `agi`, `vit`, `dex`, `int`, `wis`, `lck`.
2. Sum eligible lines from equipped, unbroken gear and purchased passive-tree ranks. Weapon-specific tree lines apply only while their weapon is held. Keep flat, percent, and per-Element pools separate.
3. Keep active effects separate; they modify only the derived stats they name, not Core.
4. Calculate Core, derive each stat, apply its configured effects and weight tax, then apply its cap last.

For level `L`:

```text
pointsAt(L) = points_per_level × (min(L, paragon_from - 1) - 1)
           + paragon_points_per_level × max(0, min(L, level_cap) - (paragon_from - 1))
statOf(points) = stat.base + points × stat.point_value
Core[k] = (statOf(allocatedPoints[k]) + flat[k]) × (1 + percent[k] / 100)
```

The published reference line uses an even split: `statOf(pointsAt(L) / 7)`. A player's sheet uses the points actually allocated. Gear and tree stat lines enter as flat and percent inputs before derived stats are calculated.

## Derived stats

Let `C` be final Core, `F` the summed flat lines, `P` the summed percent lines, and `K_*` the matching coefficient in `engine.json`.

| Final stat | Calculation |
|---|---|
| Max HP | `(hp_base + C.vit × K_VIT_HP + hp_per_level × (L - 1) + F.hp) × (1 + P.hp / 100)` |
| HP regen | `C.vit × K_VIT_REGEN × (1 + P.hp_regen / 100) + F.hp_regen` |
| Max Mana | `(mana_base + C.int × K_INT_MP + mp_per_level × (L - 1) + F.mana) × (1 + P.mana / 100)` |
| Mana regen | `C.int × K_INT_MREGEN × (1 + P.mana_regen / 100) + F.mana_regen` |
| Max Energy Shield | `(C.wis × K_WIS_ES + F.energy_shield) × (1 + P.energy_shield / 100)`; player only |
| Energy Shield regen | `maxES × energy_shield.regen_pct / 100 × (1 + P.es_regen / 100)` |
| Physical power | `(C.str × K_STR + F.physical) × (1 + P.physical / 100) × weapon_mult × physical_power_effect` |
| Magic power | `(C.int × K_INT + F.magic) × (1 + P.magic / 100) × weapon_mult` |
| Elemental power | Per Element: its flat pool plus `C.int × K_ELEM` for the weapon's own Element, scaled by shared and Element-specific percent lines. Add named Element effects to their own pool. |
| Accuracy | `C.dex × K_DEX_ACC × (1 + P.accuracy / 100)` |
| Evasion rating | `(C.agi × K_EVASION + F.evasion) × (1 + P.evasion / 100) + evasion_effect` |
| Evasion chance | `r = max(0, rating)`; `effective = min(r, opening_rating) × opening_share + max(0, r - opening_rating) × earned_mult`; if `effective = 0`, chance is 0, otherwise `min(caps.evasion, effective / (effective + attackerAccuracy) × 100)` |
| Armour | `(C.str × K_ARMOUR + F.armour + armour_effect_add) × armour_effect_mult × (1 + P.armour / 100)` |
| Attack speed | `weapon_aspd × (100 + (C.agi - stat.base) × K_AGI_ASPD + P.aspd + effect_add) × effect_mult × (1 - encumbrance)`; cap at `100 / caps.attack_interval_sec` |
| Crit chance | `min(C.lck × K_LCK_CRIT + P.crit, K_CRIT_CAP)` |
| Crit damage | `100 + P.crit_damage + (crit_pool - crit_chance) × K_CRIT_OVERFLOW` |
| Perfect dodge | `r / (r + K_PDOGE) × 100`, where `r = C.lck × K_LCK_PDOGE × (1 + P.perfect_dodge / 100)` |
| Block | `max(0, P.block)`; read directly from the Shield Frame Mod and passive tree |
| Elemental resistance | `min(caps.elem_res_max, caps.elem_res + P.resistance_cap, (P.resistance + P.all_resistance) × resistance_effect_mult)` |
| Elemental alignment | `(C.dex × K_DEX_ALIGN + P.alignment + effect_add) × effect_mult` |
| Stun chance | `max(0, alignment × K_STUN_PER_ALIGN + P.stun_chance)` |
| Stun recovery | `min(100, max(0, C.vit × K_VIT_STUNREC))`; remaining stop is `stop_sec × (1 - recovery / 100)` |
| Cooldown reduction | `min(caps.cdr, C.wis × K_WIS_CDR × (1 + P.cdr / 100))` |
| Weight capacity | `weight_base + C.str × K_STR_WEIGHT` |
| Encumbrance | `min(caps.weight_overload, max(0, (weight_used - weight_capacity) / weight_capacity))`; multiply attack speed by `1 - encumbrance` |

Armour penetration, status resistance, attack/spell damage, bleed chance, leech, damage taken, global speed, and damage conversion are carried as their summed line/effect values; apply any cap or multiplier defined for that stat by the shared engine.

## Mob Core

`mob.form_catalog` contains 220 named race forms: all 22 races across the ten real level bands from 1–10 through 91–100. Each form owns a fixed integer Core block; Str/Agi/Vit/Int/Wis/Lck inherit the race profile, while Dex is authored per variant for its accuracy and Evasion identity. Runtime never scales Core by level. `mob.forms` assigns these forms to the first ten zone bands, and each subzone partitions all 22 races into spawn pools. Every form inherits its race's five-rung drop profile. Levels 101–180 remain playable without new catalog variants; they reuse the latest available form and Core for that lineage. Mobs have no equipment or passive tree. Elite is a rank over the selected form, and each Boss may declare its own fixed profile. `map.json` remains presentation-only:

```text
mobCore[k, form] = form.core[k]
```

The species' zone level is fixed by `mob.species[].zone_levels`. Mob HP and combat lines use the same shared engine and their configured species, zone, size, and boss inputs.

```text
mobHP(level) = mobHpAt(level) + hp_per_level × (level - 1) + mobVit × K_VIT_HP
mobMana(level) = mana_base + mana_per_level × (level - 1) + mobInt × K_INT_MP
mobAccuracy = mobDex × K_DEX_ACC × accuracy_mult
```

Elite HP multiplies `mobHP` by `mob.elite.hp`; Boss HP uses its profile's Vit in the same formula.
