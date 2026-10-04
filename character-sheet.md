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

> Energy Shield sits **above** HP while the character has a pool. Attack speed is read as hits per second, and Weight shows `carried / capacity` with the aspd it costs when over, exactly as the row says. On the playable screen these four are the bar row above the fight (`harness/decisions.md` D-107).

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
| Critical chance | % | **No Cap shown** — chance is held at 100 and the excess is added to crit damage, so show `chance` and `overflow` separately |
| Critical damage | % | Physical only — magic and Elements never crit |
| Dodge | % | Show Cap **90** too (opposed by mob accuracy) |
| Attack speed | hits/sec | Show Cap 500% = 5 hits/sec too (the 0.2 sec floor between hits) |
| Cooldown reduction | % | Show Cap 80 too |
| Accuracy | number | **No Cap shown** — the 2,000 Cap was removed; the ratio formula never reaches 100% by itself |
| Elemental Alignment | % | Show Cap **50** too · Shared with all statuses (no separate status Alignment remains) |
| Perfect dodge | % | **No Cap shown** — show the bare chance (the ratio limits it at 30%) |
| Drop chance | multiplier | Shown as `×9.2`, not % — `drop_rate` is a multiplier of base drop chance |
| HP regen | /sec | |
| Mana regen | /sec | |

**Every capped value is shown as `value / Cap`** e.g. `Dodge chance 42% / 90%` so players do not invest further with no effect. Critical chance is not one of them — it has no Cap, so show it as a bare number plus the crit damage it spills into.

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
Critical chance   10%           (Lck 125 × 0.05 + Mod 4% · no Cap · no overflow yet)
Critical damage   152%          (physical only)
```

## Defense

```
Max HP            3,914        HP regen   31/sec
Max Mana          816          Mana regen 13/sec
Dodge             24% / 90%    (rate 125×0.15 + 12 = 31 → 31/131)
Accuracy          135
Elem alignment    8% / 50%
Perfect dodge     1% (no Cap · the ratio limits it at 30%)
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
3. **Drop chance / Perfect dodge** — Drop is a multiplier `1 + Lck × 0.01` (9.2× at Lck 816) · Perfect dodge is a ratio on the same Lck line (rate `Lck × 0.03`, `K_PDOGE` 57 → 30% at Lck 816) clamped by **Cap 25**, which binds at Lck 633.
4. **Base stat per level** — Base 12 at level 1 and +2 per level, allowing `(Base · level · gear)` display.

# Where the Sheet Sits on the Main Screen

The screen holds four regions, all visible at once: the combat scene with the four-row bar above it, the character sheet, the carried inventory and the temporary inventory the hunt fills (`harness/decisions.md` D-107).

- **Worn gear is a grid of twelve slots, and the positions are fixed** — an empty slot is drawn as an empty slot, because a player reads the shape of what is missing. Hovering a worn slot opens its detail card, which says it is the piece being worn.
- **Every other line is text, with the Cap shown as `value / Cap`** — the recommendation in "How to Show Caps" above, since this column is narrow.
- **The gate figure lives under the sheet**, read off the mob curve the same way the fight rolls it, never typed here.
- Nothing on the sheet is a number the client owns: every value is the shared engine's, and the twelve-slot grid equips only through the detail card's button (D-089).

# Display Rules to Follow

- Always show maximum (max) numbers, not uncalculated values, e.g. Max HP rather than current HP.
- Zero values are still shown, never hidden — players must see their Int is 0 because magic power has no investment yet.
- At most 1 decimal place, and round down, never up.
- Always show Caps for dodge / perfect dodge / cdr / aspd / Alignment / elem res · **Accuracy and Critical chance have no Cap**, so show them as bare numbers — for crit, show the overflow going into crit damage instead of a Cap.
- No separate status Alignment or status resistance remain. Use Elemental Alignment instead.
- **Mastery shows on the weapon panel, not the main panel** — `Mastery <lvl>/20 · weight −<lvl>%` (weight is −1% per level, Cap −20% at L20 · `equipment-weapon.md`), e.g. `Mastery 14/20 · weight -14%`. It is a per-weapon side track, not a build-calculation stat, so it never clutters the twelve-item main read.

(End of file - total 157 lines)
