# Mod Pool

import glossary.md
import elements.md

## Available Mods

<!-- BEGIN GENERATED:mod-pool -->
## Combat

| Mod | Total | Low quality | Mid quality | High quality |
|---|---|---|---|---|
| Accuracy % | 5-25% | 5-8 / 9-12 | 13-17 / 18-21 | 22-23 / 24-25 |
| Attack speed % | 5-25% | 5-8 / 9-12 | 13-17 / 18-21 | 22-23 / 24-25 |
| Critical chance % | 1-8% | 1-2 / 3 | 4 / 5 | 6-7 / 8 |
| Critical damage % | 12-120% | 12-23 / 24-35 / 36-47 | 48-59 / 60-71 / 72-83 | 84-96 / 97-108 / 109-120 |
| Magic power % | 3-16% | 3-5 / 6-7 | 8-9 / 10-11 | 12-14 / 15-16 |
| Magic power flat | 15-80 | 15-21 / 22-28 / 29-36 | 37-43 / 44-50 / 51-58 | 59-65 / 66-72 / 73-80 |
| Physical power % | 3-16% | 3-5 / 6-7 | 8-9 / 10-11 | 12-14 / 15-16 |
| Physical power flat | 15-80 | 15-21 / 22-28 / 29-36 | 37-43 / 44-50 / 51-58 | 59-65 / 66-72 / 73-80 |

## Defensive

| Mod | Total | Low quality | Mid quality | High quality |
|---|---|---|---|---|
| Armour flat | 8-40 | 8-11 / 12-14 / 15-18 | 19-22 / 23-25 / 26-29 | 30-33 / 34-36 / 37-40 |
| Armour % | 3-16% | 3-5 / 6-7 | 8-9 / 10-11 | 12-14 / 15-16 |
| Cooldown reduction % | 5-25% | 5-8 / 9-12 | 13-17 / 18-21 | 22-23 / 24-25 |
| Energy Shield flat | 12-60 | 12-16 / 17-22 / 23-27 | 28-33 / 34-38 / 39-44 | 45-49 / 50-55 / 56-60 |
| Evasion flat | 6-30 | 6-8 / 9-10 / 11-13 | 14-16 / 17-19 / 20-22 | 23-25 / 26-27 / 28-30 |
| Evasion % | 3-16% | 3-5 / 6-7 | 8-9 / 10-11 | 12-14 / 15-16 |
| Life Regeneration flat | 2-31 | 2-5 / 6-9 | 10-14 / 15-19 | 20-25 / 26-31 |
| Life Regeneration % | 5-15% | 5-6 / 7-8 | 9-10 / 11-12 | 13-14 / 15 |
| Mana Regeneration flat | 2-31 | 2-5 / 6-9 | 10-14 / 15-19 | 20-25 / 26-31 |
| Mana Regeneration % | 10-25% | 10-11 / 12-14 | 15-16 / 17-19 | 20-22 / 23-25 |
| Max Energy Shield % | 3-16% | 3-5 / 6-7 | 8-9 / 10-11 | 12-14 / 15-16 |
| Max HP % | 3-16% | 3-5 / 6-7 | 8-9 / 10-11 | 12-14 / 15-16 |
| Max HP flat | 40-200 | 40-55 / 56-72 / 73-90 | 91-108 / 109-126 / 127-145 | 146-163 / 164-181 / 182-200 |
| Max Mana % | 3-16% | 3-5 / 6-7 | 8-9 / 10-11 | 12-14 / 15-16 |
| Max Mana flat | 20-140 | 20-27 / 28-36 / 37-45 | 46-60 / 61-75 / 76-90 | 91-105 / 106-120 / 121-140 |
| Perfect dodge % | 1-3% | 1 | 2 | 3 |
| Status Alignment resistance % | 5-25% | 5-8 / 9-11 | 12-15 / 16-18 | 19-22 / 23-25 |

## Stat Mod

| Mod | Total | Low quality | Mid quality | High quality |
|---|---|---|---|---|
| Stat Mod flat | 5-25 | 5-7 / 8-9 / 10-11 | 12-14 / 15-16 / 17-18 | 19-21 / 22-23 / 24-25 |

## Elemental

| Mod | Total | Low quality | Mid quality | High quality |
|---|---|---|---|---|
| All Resistance % | 10-20% | 10-11 / 12-13 | 14-15 / 16-17 | 18-19 / 20 |
| Elemental alignment % | 1-5% | 1-2 | 3-4 | 5 |
| Elemental power % | 3-14% | 3-4 / 5-6 | 7-8 / 9-10 | 11-12 / 13-14 |
| Elemental power flat | 12-64 | 12-17 / 18-23 / 24-29 | 30-35 / 36-41 / 42-46 | 47-52 / 53-58 / 59-64 |
| Elemental resistance % | 15-30% | 15-17 / 18-19 | 20-22 / 23-24 | 25-27 / 28-30 |
<!-- END GENERATED:mod-pool -->

- All 5 Elements use the same ranges, no split table needed
- **Elemental power ranges slightly below phys/magic** because Elemental damage must pass through an Alignment check first
- Res is Defensive, so it never rolls on main hand (see equipment-slot.md)
- Res has no Flat — raw res comes from Vit only, Mods add percentage multipliers
- Res ranges much higher than Evasion % because it must also race monster Counter elements and Weak
- Alignment is % only, no Flat · one shared stat confirms both Elements and statuses

# Item Weight

**Weight is not a rolled value** · Every item carries weight from its *Base* (the frame of its slot), multiplied by quality

- Quality multipliers: **low x0.8 · mid x1.0 · high x1.3** — better items are heavier · a cost players read directly from the item number, with no hidden rule
- **Per-Base weight table is in item-base.md** · one slot has several frames (chest = mail 60 / plate 85 / vestments 28). This is why weight becomes a *choice*, not a forced slot number
- Main-hand weapons use weight by type (wand/rod 25 → two-handed axe 85) · dual-wield counts x0.8
- Full 12-item set: cloth ≈ **248 / 322** · balanced ≈ **390 / 507** · armored ≈ **505 / 657** (first pair mid quality · second pair high quality)
- Carry capacity = Str x 2 (420 with no Str investment · 1,020 at the full-Str ceiling) · exceeding it cuts Attack speed up to -50% → full rule is in formula.md section 11

# Roll Examples


Table values are the **T3 range start** of that quality: the worst roll that still counts as that quality.

| Quality | Stat Mod flat | Power flat | Power % | Crit chance % | Elem res % |
|---|---|---|---|---|---|
| Low | 5 | 15 | 3% | 1% | 15% |
| Mid | 12 | 37 | 8% | 4% | 20% |
| High | 19 | 59 | 12% | 6% | 25% |

Example of one item

```
Rare · mid quality
   Physical power flat 44   (T2 of mid quality)
   Str flat            16   (T1 of mid quality)
   Evasion % 9         (T2 of mid quality)
   Elemental res %    24   (T1 of mid quality · Cold Element)
```

- This item has 4 mods because it is Rare · all mods are in the mid-quality set · Tiers may differ only inside that set
- If this item were Common it would have only 2-3 mods, but at high quality it would still roll stronger values than this

(End of file - total 162 lines)
