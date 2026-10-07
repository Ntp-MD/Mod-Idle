# Weapon types

Weapons have **11 types** · concept.md originally stated 10 types because it counted two-handed as one type and had no mace · **`rod` is removed**, so the magic main hand is wand and staff and the off hand carries the Book. The `weapon_aspd` / `weapon_mult` numbers are the same set calculated in formula.md sections 1 and 7

| Weapon | Hands | Skill group | Damage type | weapon_aspd (Base hits/sec) | weapon_mult | dual-wield | weight |
|---|---|---|---|---|---|---|---|
| one-handed sword | Single | melee | physical | 1.2 | 1.00 | Yes | 35 |
| one-handed axe | Single | melee | physical | 1.2 | 1.00 | Yes | 40 |
| dagger | Single | melee | physical | 1.5 | 0.80 | Yes | 25 |
| mace | Single | melee | physical | 1.0 | 1.20 | No | 45 |
| wand | Single | magic | magic | 1.0 | 1.20 | No | 25 |
| staff | Two | magic | magic | 0.85 | 1.41 | — | 60 |
| spear | Two | melee | physical | 0.85 | 1.41 | — | 70 |
| two-handed sword | Two | melee | physical | 0.7 | 1.71 | — | 75 |
| two-handed axe | Two | melee | physical | 0.7 | 1.71 | — | 85 |
| bow | Two (range) | ranged | physical | 1.1 | 1.09 | — | 50 |
| crossbow | Two (range) | ranged | physical | 1.1 | 1.09 | — | 60 |

**Weapon weight (B13).** The two endpoints are the ones `mod-pool.md` already stated — **wand 25** at the light end and **two-handed axe 85** at the heavy end — and the rest of the set steps by *physical bulk*: one hand before two hands, then the heft of the type inside that tier. It is deliberately not a function of `weapon_mult`: a wand and a mace share a multiplier but not a mass, and DPS is already equal across the eleven types (`weapon_mult = 1.2 / weapon_aspd`), so weight is the dimension that can differ without moving any number in `formula.md` section 0. `tools/bases.ts --write` imports this column into `tools/data/bases.json`, and the encumbrance tax reads it from there (a dual-wield off hand still carries ×0.8 of its own type weight · `roll_rule`). No weapon carries weight from its Base frame: the frame table in `item-base.md` covers armour and the off hand only.

# Off-hand only

- **shield** — Defensive (Max HP · Evasion)
- **book** — Defensive (Max Mana · Cooldown reduction) · Counts as magic group for skill bonus (see skill-pool.md)

# Rules resulting from this decision set

- **Dagger is melee, not ranged** — this file originally had a heading "Ranged (one-handed)" even though the list was sword/axe/knife, which caused the weapon-group table in skill-pool.md to drag dagger into ranged. Now split correctly: melee 7 types · ranged = bow/crossbow · magic = wand/staff (+ book in off hand)
- **All types have equal DPS at equal stats against the Medium reference body** because `weapon_mult = 1.2 / weapon_aspd` · `weapon_aspd` cancels out of `power × times/sec`, so every type lands on the same Expected DPS at equal stats (the section 0 table · **X14**). What differs is hit count (which affects per-hit procs · Sonic Blow · Flurry · chill · DoT ticking), who hits the aspd Cap first, and — which body class the type favours
- **No Base power per weapon type**. All types draw power from the character (formula.md section 1)
- **Dual-wield allowed only for sword / axe / dagger** · The second piece uses the same pool as the main hand but grants half Primary weight (equipment-slot.md)
- Two-handed weapons and bow/crossbow occupy the off hand → **lose the chance to equip shield/book**, which is the real cost of high weapon_aspd

## Weapon × body class

<!-- BEGIN GENERATED:size-ladder -->
| Weapon | Small | Medium | Large | Favours |
|---|---|---|---|---|
| one-handed sword | 1.00 | 1.00 | 1.00 | — |
| one-handed axe | 1.00 | 1.00 | 1.00 | — |
| dagger | 1.25 | 0.90 | 0.75 | Small |
| mace | 0.75 | 0.90 | 1.25 | Large |
| wand | 0.75 | 0.90 | 1.25 | Large |
| staff | 0.75 | 0.90 | 1.25 | Large |
| spear | 1.25 | 0.90 | 0.75 | Small |
| two-handed sword | 0.75 | 0.90 | 1.25 | Large |
| two-handed axe | 0.75 | 0.90 | 1.25 | Large |
| bow | 1.25 | 0.90 | 0.75 | Small |
| crossbow | 0.75 | 0.90 | 1.25 | Large |

One multiplier on the **physical share** of an outgoing hit, applied **after** mitigation so it never scales the armour ratio: the weapon's own swing always carries its row (a staff's swing included), a physical attack skill carries it too, and a **magic-damage skill is exempt**. A boss is not a size — it declares which column it reads (`mob.sizes` `reads_as`, Large by default). The one-handed sword is flat at 1.00, so the reference row moves no zone price. **How the rows are derived, with no magnitude typed by hand:** the *direction* comes from each weapon's own line and the rules the design already states — heavy single-target press and armour penetration answer a Large body, accuracy and long reach answer a Small one, and magic answers Large through the Element half that already bypasses armour — and the *magnitude* is the owner's own dagger ladder (`1.25 / 0.90 / 0.75`), reused as-is for a Small-favouring row and pointed the other way for a Large-favouring one. A row the weapon has no opinion about (the one-handed axe, whose line is bleed and answers no body) stays flat. **A magic weapon is the related case `weapon.basic_attack` names:** it has no swing, it flicks a **bolt** — a press on the attack clock with no mana and no cooldown, worth the attack ladder's floor instead of a swing's full hit — read off the weapon's own `damage` line, so a wand cannot be a bolt in one file and a swing in another (**X50** · `wand` · `staff`). `engine.json` `weapon_size_mult` is the home, and this is the weapon type's own rule — not a Mastery bonus, so `AGENT.md` §5's per-weapon DPS ban is untouched.
<!-- END GENERATED:size-ladder -->

## Frames — what a weapon type drops as

<!-- BEGIN GENERATED:weapon-frames -->
| Weapon type | Frame | Base-Mod lines it forces | |
|---|---|---|---|
| one-handed sword | Arming Sword | physical_power_flat · attack_speed | **reference** |
| one-handed sword | Longsword | physical_power_flat · accuracy | |
| one-handed axe | Splitting Axe | physical_power_flat · bleed_chance | **reference** |
| one-handed axe | Cleaver | physical_power_flat · critical_chance | |
| dagger | Dirk | physical_power_flat · critical_chance | **reference** |
| dagger | Stiletto | critical_chance · attack_speed | |
| mace | Warhammer | physical_power_flat · stun_chance | **reference** |
| mace | Cudgel | physical_power_flat · critical_damage | |
| wand | Bone Wand | magic_power_flat · cooldown_reduction | **reference** |
| wand | Crystal Wand | magic_power_flat · elemental_power_flat | |
| staff | Battle Staff | magic_power_flat · max_mana_flat | **reference** |
| staff | Runed Staff | magic_power_flat · elemental_alignment | |
| spear | Pike | physical_power_flat · accuracy | **reference** |
| spear | Partisan | physical_power_flat · attack_speed | |
| two-handed sword | Greatsword | physical_power_flat | **reference** |
| two-handed sword | Flamberge | physical_power_flat · critical_damage | |
| two-handed axe | Battle Axe | physical_power_flat · bleed_chance | **reference** |
| two-handed axe | Halberd | physical_power_flat · accuracy | |
| bow | Longbow | physical_power_flat · accuracy | **reference** |
| bow | Recurve Bow | physical_power_flat · attack_speed | |
| crossbow | Arbalest | physical_power_flat · armour_pen | **reference** |
| crossbow | Hand Crossbow | physical_power_flat · critical_chance | |

Step 2 of the loot roll picks the **type** and then the **frame** inside it, so a type ships as frame variants: the frame is what the piece is called and what it forces, which is why two frames of one type differ in their craftable-Mod count. A type's frames roll **equally**, like a Base inside its slot. The **reference frame** of every type carries exactly the lines its type forced before the frame list existed, so the published behaviour has a named home and no measured loot number moved (A10 · `item-base.md` · `bases.ts` BS9).
<!-- END GENERATED:weapon-frames -->

# Weapon mastery

**Mastery = per-weapon-type XP** · This is the slot that concept.md described as the reason for players to "try swapping weapons without leaving combat", but it had no formula yet

```
mastery_xp   = 4 per 1 kill (counts only the held weapon)
mastery_level = floor(sqrt(mastery_xp / 100)) + 1     · cap 20
```

**Tied to the character XP formula ** · the *same kill* that pays character XP pays Mastery XP, so the two tracks read one kill stream and the whole table below divides by the band's own kill count that `xp` already uses (loot.md section 2 · checks.md F1) · the old "1 per hit" half is retired: the character XP formula has no hit term, and no file ever set a hits/hour anchor for it, so keeping it would leave Mastery paced off an un-owned number instead of the kill curve · Mastery stays a *fixed per-kill* value and deliberately does **not** scale with mob level — that would make it a second copy of the level curve and break its role as the level-independent parallel side-track H2 requires

| Level | Cumulative xp | Kills to reach | Hours at level 90 (high-band kill rate) |
|---|---|---|---|
| 5 | 1,600 | 400 | 0.22 |
| 10 | 8,100 | 2,025 | 1.13 |
| 15 | 19,600 | 4,900 | 2.72 |
| 20 | 36,100 | 9,025 | 5.01 |

## Two-layer bonus — and the layer intentionally *not touching DPS*

| Layer | Effect | Maximum |
|---|---|---|
| **While held** (that weapon type) | Held weapon weight **-1% per level** · And skills used with this weapon deal **+0.5% per level from L5** | -20% weight · +8% skill damage |
| **Account-wide** | Every weapon type with Mastery ≥ 10 → **+1% of drop_rate**, summed across types | +11% (11 types) |

**Why Mastery grants no +damage**: all weapon types are already tuned to equal DPS (`weapon_mult = 1.2 / weapon_aspd` · proven equal at equal stats by **X14**). If Mastery granted damage, a single weapon type would be "better" permanently, and the reason Mastery exists (to encourage weapon swapping) would die immediately · Both bonus layers are therefore in the dimensions of *weight* and *drop rate*, which do not shift any number in formula.md section 0

## Timeline for the whole account (measured at level 90 · using one weapon continuously)

```
11 types to L10  = 124,000 Mastery XP  → at this point +11% drop_rate permanently
11 types to L20  = 550,000 Mastery XP → this is the long tail, and nothing rushes it
```

- The XP comes straight from the kill table above ×11, so a lower band simply pays it slower because the band fields fewer kills — the track is now read entirely off the kill rate, not attack speed · Therefore Mastery is a "parallel track" that walks early game then accelerates as the kill rate climbs
- **AFK earns full Mastery** because it counts purely from kills, unrelated to boss or Item quality · It is the only system in the game that progresses fully while closed — intentionally, so low-playtime players have their own progress track

## Measured side effects (Mastery L20 on weight tax)

No table here: the set weights and their taxes are printed once, from `tools/data/bases.json`, in the generated block in `formula-utility.md` section 11 (`node tools/bases.ts --blocks`). Mastery acts on the **held weapon** only — it discounts that weapon's weight by up to 20% — and the weight it discounts is the **weight** column above, per type (B13), so the size of the saving scales with the type you are holding and this file states the number exactly once.

- Mastery **is not a shortcut past Str** — an armored build without Str still hits the tax Cap; the discount applies to one weapon line out of eleven
- Drop effect: no-Lck players get 139 → 154 drops per 1,000 kills (+11%) · Full Lck 428 → 475 — Mastery adds *quantity* the same way as Lck but only 1/8 as strong as full Lck, so it does not steal the role set in loot.md

# Display

- **Mastery on the character sheet — settled**: it shows on the **weapon panel**, not the main panel, as `Mastery <lvl>/20 · weight −<pct>` (e.g. `Mastery 14/20 · weight -14%`), because Mastery is a per-weapon side track and is not a stat used in build calculation. The main panel stays the thirteen-item build read; weapon Mastery is a panel-local line. (Landed in `character-sheet.md` Display Rules.)

> **Closes the original question in concept.md**: "Mastery has no formula yet — what is the per-level bonus, and will all 11 weapon types be equally worthwhile?" → Answered: bonus = weight + drop_rate and skill damage only for the held weapon · All types are equally worthwhile because DPS is never touched

