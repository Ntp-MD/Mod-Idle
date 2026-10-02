# Character Sheet

import core-stats.md
import formula.md

Values shown on the character screen, calculated from formula.md.

# Main Panel: 4 Slots

| Slot | What is shown |
|---|---|
| HP | Current value / Maximum value (Energy Shield shown above HP while present) |
| Mana | Current value / Maximum value |
| Attack speed | Hits per second |
| Weight | Carried / Max capacity · If over, show lost `% aspd` after it, e.g. `566 / 420 (aspd −35%)` |

# Core Stats

Shows all 7 stats with a breakdown of their sources.

| Stat | What it gives | Show calculated values too? |
|---|---|---|
| Str | Physical power, Weight, Armour | Physical power, Weight capacity, Armour |
| Vit | HP, HP regen, all 5 Elemental resistances | Max HP, HP regen, all 5 Elemental res |
| Dex | Accuracy, Elemental Alignment, Evasion | Accuracy, Elemental Alignment %, Evasion |
| Agi | Attack speed, Dodge | Attack speed, Dodge % |
| Wis | Cooldown reduction | CDR % |
| Int | Magic power, Mana regen, Elemental power, Energy Shield | Magic power, Mana regen, Elemental power, Energy Shield |
| Lck | Critical chance, Drop chance, Perfect dodge | All 3 values |

**Show in 3 separate parts** so players see where each number comes from.

```
Str              125        ( base 12 + level 60 + gear 45 ) × 1.07
Physical power   715        ( 125 × 5 + 37 ) × 1.08
```

- This example is calculated at level 31: `stat_c = 12 + 2×30 = 72` · Str Flat 15 on three pieces = 45 · Str % 3% + 4% = 7% → `(72 + 45) × 1.07 = 125`
- Physical power = `(125 × 5 + 37 power Flat from main hand) × 1.08 (single-slot power %) = 715`
- Shown as `( base + level + gear Flat ) × %` in the order the formula actually calculates.
  The old numbers `(base 40 · level +60 · gear +20)` are invalid because no 40 exists in the formula — Base is always 12 at level 1, and 125 × 5 = 625, not 1,450.

# Combat Stats

| Value | Unit | Note |
|---|---|---|
| Physical power | number | |
| Magic power | number | |
| Elemental power | number | Must pass Alignment before dealing damage |
| Critical chance | % | Show Cap 100 too (Cap from stats alone 48.8%) |
| Critical damage | % | Show physical / magic separately |
| Dodge | % | Show Cap **90** too (opposed by mob accuracy) |
| Attack speed | hits/sec | Show Cap 300% = 3 hits/sec too |
| Cooldown reduction | % | Show Cap 50 too |
| Accuracy | number | **No Cap shown** — the 2,000 Cap was removed; the ratio formula never reaches 100% by itself |
| Elemental Alignment | % | Show Cap **50** too · Shared with all statuses (no separate status Alignment remains) |
| Perfect dodge | % | Show Cap 5 too |
| Drop chance | multiplier | Shown as `×9.2`, not % — `drop_rate` is a multiplier of base drop chance |
| HP regen | /sec | |
| Mana regen | /sec | |

**Every capped value is shown as `value / Cap`** e.g. `Crit chance 42% / 100%` so players do not invest further with no effect.

# Elemental

Always shows all 5 Elemental res, no matter which Element is used, because players must see where they are exposed.

```
Elemental res
  Fire       45% / 75%
  Cold       32% / 75%
  Lightning  18% / 75%
  Poison     45% / 75%
  Chaos       0% / 75%
Elemental alignment    44% / 50%
```

- Zero values are still shown, never hidden.
- Always ordered by fixed Element order, never reordered by player setup, so comparisons with old gear stay valid.
- Target counter-Element multipliers are not shown.

# Offensive / Defensive Split

The example below is a **level 31 character wearing all mid-Item quality Rare gear**, calculated from formula.md (not hypothetical numbers).

## Offense

```
Attack speed      1.5 /sec      (aspd 154 = 1.2 × (100 + (125−12)×0.25))
Physical power    715          ( (125 × 5 + 37) × 1.08 )
Magic power       0            (Int not yet invested — show 0, do not hide)
Critical chance   10% / 100%   (Lck 125 × 0.05 + Mod 4)
Critical damage   152% / 100%  (physical / magic)
```

## Defense

```
Max HP            3,910        HP regen   31/sec
Max Mana          816          Mana regen 13/sec
Dodge             24% / 60%    (rate 125×0.15 + 12 = 31 → 31/131)
Accuracy          135
Elem alignment    8% / 50%
Perfect dodge     1% / 5%
```

- Verify each number: `stat_c(31) = 12 + 2×30 = 72` · Vit 125 → `HP = (125×20 + 40×30) × 1.06 = 3,914` · Int 84 → `mana = 84×4 + 16×30 = 816` · regen `= 84×0.15 = 12.6`
- Old numbers in this file (`2.4 /sec · power 1,450 · HP 4,200 · Dodge 28% / 75% · Accuracy 340 / 2,000`) were tied to the old formula and Cap set already fixed in formula.md, so both were rewritten.

# How to Show Caps

3 options.

| Method | Advantage | Disadvantage |
|---|---|---|
| Text `42% / 100%` | Clearest and compact | Clutters tables |
| Progress bar | Visual | Takes space |
| Color + lock icon | Pretty | Harder to understand |

Recommendation: use `/` text as default, and progress bars only on the summary screen (large Tab) with room to spare.

# Should Not Show

| Value | Reason |
|---|---|
| All K values | Internal numbers; players need not know them |
| Sub-formulas | Not useful for play |
| Weapon Base power | This value no longer exists — all weapons draw power from the character (equipment-weapon.md) |
| Mana regen / HP regen if no regen status exists | Showing them makes players wonder whether they have any effect |

# Slots Previously Missing But Now Have Formulas

All 4 original items now have values in formula.md.

1. **Status resistance** — Merged into Vit Elemental res. No separate status res remains.
2. **Weight capacity** — `K_STR_WEIGHT` = 2 per 1 Str.
3. **Drop chance / Perfect dodge** — Drop is a multiplier `1 + Lck × 0.01` (9.2× at Lck 816) · Perfect dodge = `Lck × 0.01` with Cap 5% (old K of 0.005 could never reach Cap).
4. **Base stat per level** — Base 12 at level 1 and +2 per level, allowing `(Base · level · gear)` display.

# Still Missing

1. ~~**Item weight source**~~ **Closed** — Per-slot table + weapon types in mod-pool.md · Item quality multipliers 0.8/1.0/1.3 · Limit = Str × 2 and excess cuts aspd (formula.md section 11).
2. ~~**Damage taken by player**~~ **Closed** — combat.md section 3 sets `mob damage/sec = DPS_typical ÷ 27` and section 6 has a "survive/not-survive" table per build · The Defense panel thus has a real baseline for "how many seconds can be taken".
3. ~~**Weight slot must have units**~~ **Closed** — Shown as `used / capacity` with trailing `% aspd lost` (see main 4-slot table above).
4. ~~**Effective level of each displayed stat**~~ **Closed** — Single-stat ceiling at level 100 is 816 (= 12 pieces × Flat 25 then × 12 pieces × 5%). Fully back-calculated in the formula.md section 0 table.

# One Slot Left

- ~~**Item Base**~~ **Closed in item-base.md** — Every slot has 2-3 frames (mail / plate / vestments etc.) defining weight + which Mod is emphasized · Item tooltips should therefore show a "frame · weight" line above the Mod list, because it explains why two pieces in the same slot look different.

# Display Rules to Follow

- Always show maximum (max) numbers, not uncalculated values, e.g. Max HP rather than current HP.
- Zero values are still shown, never hidden — players must see their Int is 0 because magic power has no investment yet.
- At most 1 decimal place, and round down, never up.
- Always show Caps for crit / dodge / perfect dodge / cdr / aspd / Alignment / elem res · **Accuracy has no Cap anymore**, so show it as a bare number.
- No separate status Alignment or status resistance remain. Use Elemental Alignment instead.

(End of file - total 157 lines)
