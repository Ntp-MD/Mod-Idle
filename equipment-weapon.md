# Weapon types

Weapons have **12 types** · concept.md originally stated 10 types because it counted two-handed as one type and had no mace. The `weapon_aspd` / `weapon_mult` numbers are the same set calculated in formula.md sections 1 and 7

| Weapon | Hands | Skill group | Damage type | weapon_aspd (Base hits/sec) | weapon_mult | dual-wield |
|---|---|---|---|---|---|---|
| one-handed sword | Single | melee | physical | 1.2 | 1.00 | Yes |
| one-handed axe | Single | melee | physical | 1.2 | 1.00 | Yes |
| dagger | Single | melee | physical | 1.5 | 0.80 | Yes |
| mace | Single | melee | physical | 1.0 | 1.20 | No |
| rod | Single | magic | magic | 1.0 | 1.20 | No |
| wand | Single | magic | magic | 1.0 | 1.20 | No |
| staff | Two | magic | magic | 0.85 | 1.41 | — |
| spear | Two | melee | physical | 0.85 | 1.41 | — |
| two-handed sword | Two | melee | physical | 0.7 | 1.71 | — |
| two-handed axe | Two | melee | physical | 0.7 | 1.71 | — |
| bow | Two (range) | ranged | physical | 1.1 | 1.09 | — |
| crossbow | Two (range) | ranged | physical | 1.1 | 1.09 | — |

# Off-hand only

- **shield** — Defensive (Max HP · Dodge)
- **book** — Defensive (Max Mana · Cooldown reduction) · Counts as magic group for skill bonus (see skill-pool.md)

# Rules resulting from this decision set

- **Dagger is melee, not ranged** — this file originally had a heading "Ranged (one-handed)" even though the list was sword/axe/knife, which caused the weapon-group table in skill-pool.md to drag dagger into ranged. Now split correctly: melee 7 types · ranged = bow/crossbow · magic = rod/wand/staff (+ book in off hand)
- **All types have equal DPS at equal stats** because `weapon_mult = 1.2 / weapon_aspd` · Verified on a 12-piece Str build: every type yields 9,847 DPS. What differs is hit count (which affects per-hit procs · Sonic Blow · Flurry · chill · DoT ticking) and who hits the aspd Cap first
- **No Base power per weapon type**. All types draw power from the character (formula.md section 1)
- **Dual-wield allowed only for sword / axe / dagger** · The second piece uses the same pool as the main hand but grants half Primary weight (equipment-slot.md)
- Two-handed weapons and bow/crossbow occupy the off hand → **lose the chance to equip shield/book**, which is the real cost of high weapon_aspd

# Weapon mastery

**Mastery = per-weapon-type XP** · This is the slot that concept.md described as the reason for players to "try swapping weapons without leaving combat", but it had no formula yet

```
mastery_xp   = 1 per 1 hit + 4 per 1 kill (counts only the held weapon)
mastery_level = floor(sqrt(mastery_xp / 100)) + 1     · cap 20
```

| Level | Cumulative xp | At level 90 (11,054 xp/hour) |
|---|---|---|
| 5 | 1,600 | 0.14 hours |
| 10 | 8,100 | 0.73 hours |
| 15 | 19,600 | 1.77 hours |
| 20 | 36,100 | 3.27 hours |

## Two-layer bonus — and the layer intentionally *not touching DPS*

| Layer | Effect | Maximum |
|---|---|---|
| **While held** (that weapon type) | Held weapon weight **-1% per level** · And skills used with this weapon deal **+0.5% per level from L5** | -20% weight · +8% skill damage |
| **Account-wide** | Every weapon type with Mastery ≥ 10 → **+1% of drop_rate**, summed across types | +12% (12 types) |

**Why Mastery grants no +damage**: all weapon types are already tuned to equal DPS (`weapon_mult = 1.2 / weapon_aspd` · proven equal at 9,847 at equal stats). If Mastery granted damage, a single weapon type would be "better" permanently, and the reason Mastery exists (to encourage weapon swapping) would die immediately · Both bonus layers are therefore in the dimensions of *weight* and *drop rate*, which do not shift any number in formula.md section 0

## Timeline for the whole account (measured at level 90 · using one weapon continuously)

```
12 types to L10  = 8.8 hours   → at this point +12% drop_rate permanently
12 types to L20  = 39 hours    → this is true endgame, not reached in the first week
```

- At levels 10-30 it is almost 2x slower (5,500 xp/hour) because of fewer kills and slower hits · Therefore Mastery is a "parallel track" that walks early game then accelerates late
- **AFK earns full Mastery** because it counts purely from hits, unrelated to boss or Item quality · It is the only system in the game that progresses fully while closed — intentionally, so low-playtime players have their own progress track

## Measured side effects (Mastery L20 on weight tax)

| Set | Original weight | After -20% weapon | Tax without Str | Tax with 2 Str pieces |
|---|---|---|---|---|
| armored (2h axe) | 657 | 635 | 50% → **50% (still capped)** | 26% → **22%** |
| balanced (1h sword) | 507 | 491 | 21% → **17%** | 0% |
| cloth/glass (dagger) | 322 | 314 | 0% | 0% |

- Mastery **is not a shortcut past Str** — armored without Str still hits the tax Cap; it only buys back ~4 aspd points
- Drop effect: no-Lck players get 418 → 468 pieces/hour (+12%) · Full Lck 1,319 → 1,477/hour — Mastery adds *quantity* the same way as Lck but only 1/8 as strong as full Lck, so it does not steal the role set in loot.md

# Pending

- Mastery uses XP from hits/kills, which is **not yet tied to the character XP formula** (no file sets it yet) · Once the XP curve is set, re-check the 8.8-hour / 39-hour tracks
- Not yet defined how Mastery displays on the character sheet → recommendation (character-sheet.md): show `Mastery 14/20 · weight -14%` on the weapon panel, not the main panel, because it is not a stat used in build calculation

> **Closes the original question in concept.md**: "Mastery has no formula yet — what is the per-level bonus, and will all 12 weapon types be equally worthwhile?" → Answered: bonus = weight + drop_rate and skill damage only for the held weapon · All types are equally worthwhile because DPS is never touched

(End of file - total 88 lines)
