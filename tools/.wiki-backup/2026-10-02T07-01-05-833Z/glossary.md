# Glossary

Terms used across all spec files must match exactly, otherwise systems will interpret each other incorrectly.

# The 3 Layers of an Item

One item answers 3 separate questions, clearly separated.

| Layer | Answers | Determined by |
|---|---|---|
| **Rarity** | how many Mods | item type (Common / Rare) |
| **Item quality** | value range for each Mod | drop source (low / mid / high quality) |
| **Tier** | sub-range inside that Mod | Item quality + that Mod |

```
Common · mid quality
  ├── T3  Physical power flat  44-50
  ├── T2  Str flat             15-16
  └── T1  Dodge %              7
```

- Rarity has no effect on rolled values at all. It affects only Mod count.
- Item quality of one item is a single value for the whole item. Every mod uses the same quality range set.
- Tier belongs to **one item**, not to a Mod — every mod on this item is constrained to the same sub-range set.

# Common Terms

| Term | Meaning |
|---|---|
| **Rarity** | Item Rarity. Only Common and Rare for now. Determines Mod count only. |
| **Item quality** | low / mid / high. Determines the value range of every Mod on that item. Comparable to Path of Exile ilvl. |
| **Tier** | Sub-range inside a quality. T1 is best. Lower number is better. Not an item level number. |
| **Mod** | One random Mod, e.g. `Physical power flat 45 (T2)` |
| **Flat** | Direct additive value, no multiplier. `+45` |
| **%** | Percentage multiplier. `+12%` |
| **Core stat** | str / vit / dex / agi / wis / int / lck. Flat and % can roll on every item. |
| **Offensive** | Attack-side Mod. Rolls only on weapon items. |
| **Defensive** | Defense-side Mod. Rolls only on non-weapon items. |
| **Element** | fire / cold / lightning / poison / chaos. One item holds only one Element. |
| **Counter element** | Multiplier one Element deals to another. 0.60 is resisted. 1.50 is Weak. |
| **Weak** | A monster Innate element takes x1.5 damage from that Element. |
| **Cap** | Maximum value ceiling. Always required for crit / dodge / cdr / aspd / res **and must be proven reachable from the real Mod tables** (an unreachable Cap is a fake number. See the reachability table in formula.md). |
| **Alignment** | Chance to confirm a status or Element. Comes from Dex. |
| **Physical power / Magic power** | Character damage values calculated from formula.md sections 1-2. **There is no "weapon Base power".** That term was removed from the system. All weapons draw power from the character only. |
| **K value** | Hidden game constant set by design, e.g. K_STR = phys per 1 Str. Invisible to players. |
| **Mastery** | Per *weapon type* XP, 20 levels. Bonus while equipped (weight -1%/level. skill damage +0.5%/level from L5) and account-wide (drop_rate +1% per type at >= L10). **Adds no damage to any weapon type**, keeping `weapon_mult` equal for all types (equipment-weapon.md). |
| **Innate element** | Monster home Element, one per monster. Takes x1.5 damage from that Element **and** attacks us with that Element (combat.md section 2). |
| **Quality floor / ceiling** | Lowest and highest quality range one drop source can emit. |
| **Reroll** | Craft tier that re-rolls values in the same Mod without changing Tier. |
| **Legacy mod** | Slot 1-2 of an item, fixed at drop. Never targeted by Remove mod stone. Added mods (slot 6-7) are never legacy. |
| **Gear Mod** | The single inherent defense value of a piece (Armour, Evasion, or Energy Shield by Base school). Raised only by Quality Stone (+1 to +15). Never touched by Reroll, Refine, Flux, Remove, or Add. Always shown as its own top line, never inside the Mod list. |
| **Refine** | Craft tier that raises Tier by 1 step. |
| **Ascend** | Craft tier that raises quality by 1 step for the whole item. |
| **DoT** | Lingering damage over time after a hit. All DoTs combined must not exceed the global DoT Cap. |
| **Leech** | HP recovered as % of damage just dealt. |
| **Push** | HP reaching zero is not death. The fighter is only pushed out of combat to rest for `Max HP / (hp_regen x 8)` seconds, then returns alone. This is the only thing this game "loses" (combat.md section 4). |
| **No death** | Standing rule since commit `908cbf7`. Defensive value comes from time not lost, not from survival. Returning to death requires rewriting half the defensive side from scratch. |
| **Base** | Frame of one slot (mail / plate / vestments ...). Determines **weight** and **which Mod is Primary**. Does not determine Mod count (that is Rarity) and does not determine rolled values (that is quality + Tier). See item-base.md. |

# Town terms

| Term | Meaning |
|---|---|
| **Settlement** | One named place holding services and NPCs. Never holds combat. |
| **Capital** | A settlement serving one quality band (low / mid / high) with the full service set. 3 total. |
| **Zone** | The combat area attached to a settlement. Always the `world.md` zone (1-9) — a settlement never replaces a zone. |
| **Road** | The link between two settlements. Travel only; content on it exists only in opt-in mode. |
| **Waypoint** | A Road made instant by having visited its settlement once. |
| **Camp** | The Push rest location only (`combat.md` section 4) = the settlement owning the current zone. Do not use it as a general word for a base. |
| **Standing** | Per-settlement unlock counter earned from existing kill/task/boss flows. **Never spendable, never a currency, never grants a stat.** |
| **Gold** | The quality-of-life medium. Minted only by selling a filter-rejected piece. Buys space/time/information/appearance only. |
| **Sell / Dissolve** | The filter's third choice on a rejected piece: 1 gold or 1 Reroll value stone, never both. |

# Terms That Must Not Be Interchanged

| Do not write | Write instead |
|---|---|
| item Tier | Item quality |
| quality | Rarity |
| status resistance | elemental resistance |
| status alignment | elemental alignment |
| Attack speed (times/sec) | Attack speed (%) — aspd is a percentage, Cap 300 |
| flat res | none. res is % only |

# Rules That Must Not Be Broken

1. **Never say Tier means Item quality** — Tier is the sub-range, quality is the large range.
2. **Never tie value ranges to Rarity** — a high-quality Common must be able to beat a low-quality Rare.
3. **Never allow Tier spread across Mods on the same item beyond what quality permits** — every mod rolls from the same range set.
4. **Do not use `quality` for `Rarity`** and do not use `Rarity` for `quality`.
5. **Tier is not required on every Mod** — if a range is too narrow to split readably, drop Tier and use only the 3 quality levels (see mod-pool.md).
6. **One source pays one medium** — a piece yields a Reroll value stone *or* gold, never both, and no gold↔stone exchange exists anywhere (`economy.md` single-medium rule · checks.md G6).
7. **Gold never buys power** — space, time, information and appearance only. Gear, Mods, potions and stones are not for sale at any NPC (`towns.md` section 5).

# Value Reading Examples

| Mod | Reads as |
|---|---|
| `Physical power flat 45 (T2)` | Mid quality, middle sub-range of the mid range — decent, not rare. |
| `Physical power flat 78 (T1)` | High quality, and the best sub-range — an item to push immediately. |
| `Str flat 8 (T3)` | Low quality, lowest sub-range of low quality — temporary unlock use. |

(End of file - total 83 lines)
