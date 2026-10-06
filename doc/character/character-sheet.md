# Character Sheet

import core-stats.md
import formula.md

Values shown on the character screen, calculated from formula.md.

# Main Panel: 3 Slots

| Slot | What is shown |
|---|---|
| HP | Current value / Maximum value (Energy Shield shown above HP while present) |
| Mana | Current value / Maximum value |
| Attack speed | Hits per second |

> Energy Shield sits **above** HP while the character has a pool, and Attack speed is read as hits per second. On the playable screen these three are the bar row above the fight. **Weight moved to the character bag panel**, where `carried / capacity` with the aspd it costs when over sits beside the stacks that actually carry it: `1,400 / 1,217 (aspd −15%)`.

# Core Stats

Shows all 7 stats with a breakdown of their sources. A Core stat is **spent, not granted**, so the panel carries an allocation row per stat — a `+` / `−` / `Max` control, the unspent stat-point counter and the banked tree-point counter — plus a toggle that auto-allocates the level's points evenly (the idle default). Spending is instant and works mid-combat. `core-stats.md` names the line; `formula.md` section 0 carries the reference and focused values.

| Stat | What it gives | Show calculated values too? |
|---|---|---|
| Str | Physical power, Weight, Armour | Physical power, Weight capacity, Armour |
| Vit | HP, HP regen, Stun Recovery | Max HP, HP regen, Stun Recovery |
| Dex | Accuracy, Elemental Alignment, Evasion | Accuracy, Elemental Alignment %, Evasion |
| Agi | Attack speed, Evasion points | Attack speed, Evasion |
| Wis | Cooldown reduction | CDR % |
| Int | Magic power, Mana regen, Elemental power, Mana | Magic power, Mana regen, Elemental power, Max Mana |
| Lck | Critical chance, Drop chance, Perfect dodge | All 3 values |

Elemental resistance and Energy Shield come off gear, not off a Core stat, so they appear on this sheet from the Mod rows rather than from the allocation panel (owner ruling · `core-stats.md`).

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
| Evasion | % | Show the Cap too — one Cap binds the Dex rating and the Agi points together, and the chance is opposed by that mob accuracy |
| Attack speed | hits/sec | Show Cap 500% = 5 hits/sec too (the 0.2 sec floor between hits) |
| Cooldown reduction | % | Show the Cap too |
| Accuracy | number | **No Cap shown** — the 2,000 Cap was removed; the ratio formula never reaches 100% by itself |
| Elemental Alignment | % | **No Cap** (owner ruling) · Shared with all statuses (no separate status Alignment remains) |
| Perfect dodge | % | Show the Cap too — it caps the Lck ratio, and the generated Cap table in formula.md prints whether a build reaches it |
| Drop chance | multiplier | Shown as `×9.2`, not % — `drop_rate` is a multiplier of base drop chance |
| HP regen | /sec | |
| Mana regen | /sec | |

**Every capped value is shown as `value / Cap`** e.g. `Evasion 42% / 80%` so players do not invest further with no effect. Critical chance is not one of them — it has no Cap, so show it as a bare number plus the crit damage it spills into.

# Elemental

Always shows all 5 Elemental res, no matter which Element is used, because players must see where they are exposed.

```
Elemental res
  Fire       45% / 45%
  Cold       32% / 45%
  Lightning  18% / 45%
  Poison     45% / 45%
  Chaos       0% / 45%
Elemental alignment    44% / 35%
```

- Zero values are still shown, never hidden.
- Always ordered by fixed Element order, never reordered by player setup, so comparisons with old gear stay valid.
- Target counter-Element multipliers are not shown.

# Offensive / Defensive Split

The example below is a **level 31 character wearing all mid-Item quality Rare gear**, calculated from formula.md (not hypothetical numbers).

## Offense

```
Attack speed      1.26 /sec     (aspd 126 = 1.2 × (100 + (33−12)×0.25))
Physical power    220          ( (33 × 5 + 37) × 1.08 )
Magic power       0            (Int not yet invested — show 0, do not hide)
Critical chance   5.7%          (Lck 33 × 0.05 + Mod 4% · no Cap · no overflow yet)
Critical damage   152%          (physical only)
```

## Defense

```
Max HP            2,299        HP regen   8/sec
Max Mana          714          Mana regen 9.4/sec
Evasion           19% / 80%    (Dex 33 × 0.5 + gear 12 = rating 29 → 29 ÷ (29 + mob accuracy 135) = 18% + Agi 33 ÷ 30 = 1 point)
Accuracy          135
Elem alignment    1.7% / 35%
Perfect dodge     1.7% / 21%   (ratio on the Lck line · the Cap binds at Lck 506)
```

- Verify each number: the level-31 reference line `stat = 12 + points ÷ 7 = 12 + 150 ÷ 7 = 33` · Vit 33 → `HP = (hp_base 300 + 33×20 + 40×30) × 1.06 = 2,299` · Int 33 → `mana = mana_base 100 + 33×4 + 16×30 = 714` · mana regen `= 33×0.28 = 9.4`
- The worked example above is tied to the current formula and Cap set; superseded example numbers are not kept here.

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
3. **Drop chance / Perfect dodge** — Drop is a multiplier `1 + Lck × 0.01` (6.1× at Lck 510) · Perfect dodge is a ratio on the same Lck line (rate `Lck × 0.03`, `K_PDOGE` 57 → 21.2% at Lck 510) clamped by **Cap 21**, which binds at Lck 506.
4. **Base stat per level** — Base 12 at level 1 and a banked **stat point** per level (5, or 2 in Paragon) the player spends 1:1 into any Core stat, so the sheet shows `(Base · points · gear)` and an unspent counter.

# Where the Sheet Sits on the Main Screen

The screen holds four regions, all visible at once: the combat scene with the three-row bar above it, the character sheet, the carried inventory and the temporary inventory the hunt fills.

- **Worn gear is a fixed five-row slot grid, in the shape the owner drew it** — cape · helmet · amulet across the top, main hand · chest · off hand below, then gloves · belt, then ring · pant · ring, and boots alone at the bottom with a blank either side. No body is drawn: the blanks are simply gaps. Each slot keeps its fixed position and an empty one is drawn as an empty slot labelled with its name, because a player reads the shape of what is missing. Hovering a worn slot opens its detail card, which says it is the piece being worn.
- **Every other line is text, with the Cap shown as `value / Cap`** — the recommendation in "How to Show Caps" above, since this column is narrow.
- **Weight shows on the character bag panel, not the fight bar** — `carried / capacity`, with the aspd it costs when over, sits beside the stacks that carry it, since only carried consumables (and gear) weigh.
- **The gate figure lives under the sheet**, read off the mob curve the same way the fight rolls it, never typed here.
- Nothing on the sheet is a number the client owns: every value is the shared engine's, and the equipment grid equips only through the detail card's button.
- **The skill bar shows on the fight panel too, read-only** — the ordered fifteen-slot strip hangs under the HP / Mana row so a cooldown is readable while hunting; arranging the order stays on the Skills tab.
- **The level's points are allocated on the sheet, and re-spent at the town desk** — the `+` / `−` / `Max` row with the unspent and tree-point counters sits with the Core Stats table so it is reachable mid-fight; Respec is a settlement service on the town panel, never on the sheet, because a field refund would let a build switch inside a fight.

# Display Rules to Follow

- Always show maximum (max) numbers, not uncalculated values, e.g. Max HP rather than current HP.
- Zero values are still shown, never hidden — players must see their Int is 0 because magic power has no investment yet.
- At most 1 decimal place, and round down, never up.
- Always show Caps for Evasion / perfect dodge / cdr / aspd / elem res · **Accuracy, Critical chance and Elemental Alignment have no Cap**, so show them as bare numbers — for crit, show the overflow going into crit damage instead of a Cap.
- No separate status Alignment or status resistance remain. Use Elemental Alignment instead.
- **Mastery shows on the weapon panel, not the main panel** — `Mastery <lvl>/20 · weight −<lvl>%` (weight is −1% per level, Cap −20% at L20 · `equipment-weapon.md`), e.g. `Mastery 14/20 · weight -14%`. It is a per-weapon side track, not a build-calculation stat, so it never clutters the thirteen-item main read.

