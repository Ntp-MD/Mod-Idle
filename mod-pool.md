# Mod Pool

import glossary.md
import elements.md

## Available Mods

### Combat

- Physical power flat
- Physical power %
- Magic power flat
- Magic power %
- Critical chance %
- Critical damage % (physical)
- Critical damage % (magic)
- Attack speed %
- Accuracy %

### Defensive

- Dodge flat
- Dodge %
- Max HP flat
- Max HP %
- Cooldown reduction %
- Max Mana flat
- Max Mana %

### Elemental

One item can roll only one of 5 Elements.

- Fire
- Cold
- Lightning
- Poison
- Chaos

Element mods

- Elemental power flat
- Elemental power %
- Elemental resistance % — % only, no Flat
- Elemental alignment %

### Core stat

- str / vit / dex / agi / wis / int / lck — Flat and %

# Rolled Values

Every mod value is constrained by **2 axes**, not one.

1. **Item quality** — selects the large range (low / mid / high) by drop source
2. **Tier** — selects the sub-range inside the large range · T1 is best

**Reading tables** — each mod is written as `T3 / T2 / T1` ordered worst to best

- Mods with 3 ranges have all 3 Tiers
- Mods with 2 ranges have only T2 / T1
- Mods with a single value have no Tier split and use quality only, because the range is too narrow to split readably

All mods on one item roll from the same Item quality range set. No mod borrows from another quality.

## Combat

| Mod | Total | Low quality | Mid quality | High quality |
|---|---|---|---|---|
| Physical power flat | 15-80 | 15-21 / 22-28 / 29-36 | 37-43 / 44-50 / 51-58 | 59-65 / 66-72 / 73-80 |
| Magic power flat | 15-80 | 15-21 / 22-28 / 29-36 | 37-43 / 44-50 / 51-58 | 59-65 / 66-72 / 73-80 |
| Physical power % | 3-16% | 3-5 / 6-7 | 8-9 / 10-11 | 12-14 / 15-16 |
| Magic power % | 3-16% | 3-5 / 6-7 | 8-9 / 10-11 | 12-14 / 15-16 |
| Critical chance % | 1-8% | 1-2 / 3 | 4 / 5 | 6-7 / 8 |
| Critical damage % (physical) | 12-120% | 12-23 / 24-35 / 36-47 | 48-59 / 60-71 / 72-83 | 84-96 / 97-108 / 109-120 |
| Critical damage % (magic) | 12-120% | 12-23 / 24-35 / 36-47 | 48-59 / 60-71 / 72-83 | 84-96 / 97-108 / 109-120 |
| Attack speed % | 5-25% | 5-8 / 9-12 | 13-17 / 18-21 | 22-23 / 24-25 |
| Accuracy % | 5-25% | 5-8 / 9-12 | 13-17 / 18-21 | 22-23 / 24-25 |

- Crit chance has no Flat, % only
- Attack speed % is % only, no Flat · multiplies with aspd from Agi (see formula.md)
- Accuracy % multiplies accuracy from Dex · no Flat

## Defensive

| Mod | Total | Low quality | Mid quality | High quality |
|---|---|---|---|---|
| Dodge flat | 3-15 | 3-7 | 8-12 | 13-15 |
| Dodge % | 2-10% | 2-3 / 4 | 5-6 / 7 | 8-9 / 10 |
| Max HP flat | 40-200 | 40-55 / 56-72 / 73-90 | 91-108 / 109-126 / 127-145 | 146-163 / 164-181 / 182-200 |
| Max HP % | 3-16% | 3-5 / 6-7 | 8-9 / 10-11 | 12-14 / 15-16 |
| Cooldown reduction % | 5-25% | 5-8 / 9-12 | 13-17 / 18-21 | 22-23 / 24-25 |
| Max Mana flat | 20-140 | 20-27 / 28-36 / 37-45 | 46-60 / 61-75 / 76-90 | 91-105 / 106-120 / 121-140 |
| Max Mana % | 3-16% | 3-5 / 6-7 | 8-9 / 10-11 | 12-14 / 15-16 |
| Armour flat | TBD | TBD | TBD | TBD |
| Evasion flat | TBD | TBD | TBD | TBD |
| Energy Shield flat | TBD | TBD | TBD | TBD |

- Max HP Flat is 2.5x Power Flat because HP must race damage that scales with level
- Armour flat / Evasion flat / Energy Shield flat roll only on helmet, chest, pant, boots, gloves as main Mods. Ranges are TBD pending K_ARMOUR / K_EVASION / K_ENERGY_SHIELD in the mob sheet rebalance pass — no numbers are set by feel here.
- CDR % has no Flat because CDR is already a multiplier. A direct add would over-favor high-quality items
- **Dodge Flat was 8-40 · now 3-15** with Tier removed (one range per quality, per glossary.md rule 5, because the range is too narrow to split readably)
  Reason for the reduction: the dodge formula is `rate / (rate + 100)` · previously two Dodge Flat items (40+40) = 80 reached the Cap alone with no Agi
  That turned dodge into an on/off switch instead of a stat that hardens gradually. Now it takes 816 Agi + two T1 items to reach the 60% chance Cap (see formula.md section 4)

## Core stat

| Mod | Total | Low quality | Mid quality | High quality |
|---|---|---|---|---|
| Core stat flat | 5-25 | 5-7 / 8-9 / 10-11 | 12-14 / 15-16 / 17-18 | 19-21 / 22-23 / 24-25 |
| Core stat % | 1-5% | 1-2 | 3-4 | 5 |

All Core stats (str, vit, dex, agi, wis, int, lck) use the same Flat and % ranges

- One item holds at most 1 Flat mod + 1 % mod **and both can be the same stat** (str Flat 25 + str %)
  This is the source of the stat ceiling in formula.md: 12 items x 25 Flat = 300 and 12 items x 5% = 60 → `(210 + 300) x 1.60 = 816` at level 100

## Elemental

| Mod | Total | Low quality | Mid quality | High quality |
|---|---|---|---|---|
| Elemental power flat | 12-64 | 12-17 / 18-23 / 24-29 | 30-35 / 36-41 / 42-46 | 47-52 / 53-58 / 59-64 |
| Elemental power % | 3-14% | 3-4 / 5-6 | 7-8 / 9-10 | 11-12 / 13-14 |
| Elemental resistance % | 15-30% | 15-17 / 18-19 | 20-22 / 23-24 | 25-27 / 28-30 |
| Elemental alignment % | 1-5% | 1-2 | 3-4 | 5 |

- All 5 Elements use the same ranges, no split table needed
- **Elemental power ranges slightly below phys/magic** because Elemental damage must pass through an Alignment check first
- Res is Defensive, so it never rolls on main hand (see equipment-slot.md)
- Res has no Flat — raw res comes from Vit only, Mods add percentage multipliers
- Res ranges much higher than Dodge % because it must also race monster Counter elements and Weak
- Alignment is % only, no Flat · one shared stat confirms both Elements and statuses

# Item Weight

**Weight is not a rolled value** · Every item carries weight from its *Base* (the frame of its slot), multiplied by quality

- Quality multipliers: **low x0.8 · mid x1.0 · high x1.3** — better items are heavier · a cost players read directly from the item number, with no hidden rule
- **Per-Base weight table is in item-base.md** · one slot has several frames (chest = mail 60 / plate 85 / vestments 28). This is why weight becomes a *choice*, not a forced slot number
- Main-hand weapons use weight by type (wand/rod 25 → two-handed axe 85) · dual-wield counts x0.8
- Full 12-item set: cloth ≈ **248 / 322** · balanced ≈ **390 / 507** · armored ≈ **505 / 657** (first pair mid quality · second pair high quality)
- Carry capacity = Str x 2 (420 with no Str investment · 1,632 at full Str) · exceeding it cuts Attack speed up to -50% → full rule is in formula.md section 11

# Roll Examples


Table values are the **T3 range start** of that quality: the worst roll that still counts as that quality.

| Quality | Core stat % | Core stat flat | Power flat | Power % | Crit chance % | Elem res % |
|---|---|---|---|---|---|---|
| Low | 1% | 5 | 15 | 3% | 1% | 15% |
| Mid | 3% | 12 | 37 | 8% | 4% | 20% |
| High | 5% | 19 | 59 | 12% | 6% | 25% |

Example of one item

```
Rare · mid quality
   Physical power flat 44   (T2 of mid quality)
   Str flat            16   (T1 of mid quality)
   Dodge %6            (T2 of mid quality)
   Elemental res %    24   (T1 of mid quality · Cold Element)
```

- This item has 4 mods because it is Rare · all mods are in the mid-quality set · Tiers may differ only inside that set
- If this item were Common it would have only 2-3 mods, but at high quality it would still roll stronger values than this

(End of file - total 162 lines)
