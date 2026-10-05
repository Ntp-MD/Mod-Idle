# Item Rarity & Quality

import glossary.md
import mod-pool.md

The item system splits into 2 axes, per terms in glossary.md.

- **Rarity** answers "how many Mods"
- **Item quality** answers "what value range each Mod rolls"
- **Tier** is a sub-range inside Item quality, not a third axis.

> Rarity has no effect on rolled values at all. It affects only Mod count.
> A high-Item quality Common must be stronger than a low-Item quality Rare.

# Rarity — Mod Count

| Rarity | Dropped lines | Crafted max | Drop chance |
|---|---|---|---|
| Common | 5 (Base + 2 Legacy + 2 Random) | 7 (Add mod stone ×2) | 82% |
| Rare | 7 (Base + 2 Legacy + 4 Random) | 7 | 18% |

- The seven-line skeleton is fixed (item-base.md · D-123): the first line is the Base Mod and the next two the Legacy pair, both unremovable, so Rarity fills only the Random lines. Crafted max is the full seven for both, so a Common's `mods_added_cap` is exactly the gap to a full item. Net counting: removing a Random line frees the slot again. Per-item `mods_added` range stored in save.md.
- Random lines never roll Stat Mod Flat once the item already holds its one Stat Mod line; the stat it feeds is rolled at drop (equipment-slot-pools.md).

- Chance numbers are set in loot.md section 1 · Mod count does **not** change the strength of each Mod value (see next section).
- Tiers inside Item quality roll with weights **T3 50% · T2 33% · T1 17%** — T1 touches 17% so dropped items feel "almost good" often but "best" is never free. Otherwise Refine would have nothing to do.

- **No third Rarity level.** The old "Unique" idea (a craft-only special Base with a fixed Mod count) is **cut** (D-009 5c): Rarity stays two levels, and item identity is carried by Base frame + Mods + quality + Tier instead.

# Item Quality — Value Range

| Item quality | Applies to which value range |
|---|---|
| Low | Lowest range of every mod |
| Mid | Middle range of every mod |
| High | Highest range of every mod |

- Item quality is a single value for the whole item. Every slot rolls from the same Item quality range set.
- Per-mod range tables live in mod-pool.md.
- Item quality comes from the **level of the drop source**, where level acts as a ceiling, not a fixed value.

# Item Quality vs Drop Level

Each drop source defines 2 things — **ceiling** and **floor**.

| Drop source level | Floor | Ceiling |
|---|---|---|
| Low | Low | Low |
| Mid | Low | Mid |
| High | Mid | High |

- **Ceiling** — Items from this source can request at most this Item quality · Can roll T1, but can also roll T3. Best roll is never forced.
- **Floor** — Items from this source never fall below this · Prevents long play sessions still dropping repeated junk.
- Compare to Path of Exile ilvl — high-level items can roll T1 but it is not guaranteed.

Actual level numbers do not exist yet. Waiting for the zone and monster system. For now use the 3 levels above.

> **Closed**: boss forces Item quality = **zone ceiling** (floor = ceiling) and is fightable only while online.
> Result as intended: gives players reason to hunt bosses · And normal monsters still matter because they flow *quantity* (Reroll value stones), not *quality level* — the measured keep-rate in `loot.md` section 3 leaves 99.2% of high-zone drops as crafting currency rather than upgrades, so normal monsters serve as crafting sources, not boss competitors.

> **Closed**: high Item quality can occur without tying to level — via **Ascend**, which raises Item quality above the drop-source ceiling (crafting.md fixed).
> Reason this must be allowed: if Ascend stayed capped by zone, the Item quality axis would become a renamed monster level, as feared · The shifted cost is the Core from bosses (active only) instead.

# Comparison Example

```
Rare · High quality · 4 Random lines     Common · Low quality · 2 Random lines
  power Flat 78 (T1)              power Flat 15 (T3)
  crit %     8  (T1)              Evasion %  4 (T2)
  str Flat   24 (T1)              str Flat    5 (T3)
  elem res % 30 (T1) Element Fire
```

Both carry their frame's Base Mod and the Legacy pair underneath the Random lines shown, so a Rare prints seven lines and a Common five. From the old table tying Tier to Rarity, these 2 pieces could swap places · Now they order directly by stronger level.

# Waiting Items

The only genuinely open item here is now the A10 consequence (weapon Base frame enumeration → `harness/todo.md` B6); the crafting and third-Rarity waits were both resolved.

- **Crafting and res** — Decided that **Element cannot be locked**. See crafting.md.

