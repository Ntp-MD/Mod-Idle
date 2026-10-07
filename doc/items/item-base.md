# Item Base

import glossary.md
import equipment-slot.md
import mod-pool.md
import item-rarity.md
import formula.md

**Base = the frame of an item in one slot** · one slot holds two or three frames · the gap every spec file previously marked as "not yet designed"

A Base does two things, and **is intentionally allowed to do nothing else**

| Base determines | Base does not determine |
|---|---|
| **Weight** (differing weights make the Str capacity matter) | Mod count → fixed for every drop (`item-rarity.md`) |
| **Which Mod is Primary / Secondary** on that item | Rolled value per slot → belongs to quality + Tier |
| | Item home Element → belongs to the Mod pool only |

> Reason Bases must not touch Mod count: the count is one published number for every drop, so a frame is free to be heavy without also being "more Mods".

# Line 1 · Base Mod (the frame's own line)

Every item is **seven lines**, and the first one belongs to the frame:

| Line | Kind | Removable | Comes from |
|---|---|---|---|
| 1 | Base Mod | no | the slot's own pool — the Line 1 column below |
| 2-3 | Legacy | no | the slot's Primary / Secondary pool |
| 4-7 | Random | yes, with stones | the same pool |

- **Weapons force every Mod in their type's list**, so a one-handed sword always carries both.
- **Armour slots** carry their Base's own defence type and may add the others **to the same line**: the second type arrives on a chance, the third on a smaller one (`loot.base_mod.hybrid_chance`).
- **belt · ring · amulet · earring** roll their Base Mod from the same pool as their Legacy lines.
- A line carrying more than one Mod **divides its budget**: one Mod keeps its full roll, two take the first `value_scale`, three take the second, so more Mods on a line is better but never the OP pick (`loot.base_mod.value_scale`).
- The Base Mod line is **unremovable**, like the Legacy pair — the craft verbs refuse to touch it (`crafting.md`).

| Slot / type | Line 1 pool |
|---|---|
| helmet · chest · pant · boots · gloves · cape | Armour % · Evasion % · Max Energy Shield % — the Base's own type is locked, the rest roll on `hybrid_chance` |
| belt · ring · amulet · earring | the slot's own Legacy pool |
| one-handed sword | Physical power flat · Attack speed % |
| one-handed axe | Physical power flat · Chance to bleed % |
| dagger | Physical power flat · Critical chance % |
| mace | Physical power flat · Chance to stun % |
| wand | Magic power flat · Cooldown reduction % |
| staff | Magic power flat · Max Mana flat |
| spear | Physical power flat · Accuracy % |
| two-handed sword | Physical power flat |
| two-handed axe | Physical power flat · Chance to bleed % |
| bow | Physical power flat · Accuracy % |
| crossbow | Physical power flat · Armour penetration % |
| Shield | Block chance % |
| Book | Magic power flat · Mana Regeneration flat |

The last two rows are the off hand's families: a Shield frame (Buckler · Kite Shield) carries the block layer, a Book frame (Grimoire) carries the magic pair.

# Base Table per Slot

## helmet

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| Hood | 30 | Evasion % · Max HP flat | Elemental resistance % |
| Sallet | 45 | Max HP flat · Max HP % | Elemental resistance % · Life Regeneration % |
| Circlet | 18 | Max Mana % · Cooldown reduction % | Elemental resistance % · Mana Regeneration % |
| Crown | 55 | Armour % · Evasion % · Max Energy Shield % | Armour flat · Energy Shield flat |
| Knight's Helm | 42 | Armour % · Evasion % | Armour flat · Elemental resistance % |
| Hunter's Hood | 22 | Evasion % · Max Energy Shield % | Elemental alignment % · Evasion flat |


## chest

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| Ring Mail | 60 | Evasion % · Max HP % | Elemental resistance % · Max HP flat |
| Plate Vest | 85 | Max HP flat · Max HP % | Elemental resistance % · Life Regeneration % |
| Vestment | 28 | Max Mana % · Max Mana flat | Cooldown reduction % · Mana Regeneration % |
| Regalia | 72 | Armour % · Evasion % · Max Energy Shield % | Armour flat · Energy Shield flat |
| Shadow Coat | 34 | Max Energy Shield % · Evasion % | Energy Shield flat · Elemental resistance % |
| Mail Coat | 68 | Armour % · Evasion % | Armour flat · Max HP flat |


## pant

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| Breeches | 50 | Evasion flat · Evasion % | Max HP flat |
| Cuisses | 70 | Max HP flat · Max HP % | Elemental resistance % · Life Regeneration % |
| Legwraps | 25 | Cooldown reduction % · Max Mana flat | Elemental resistance % · Mana Regeneration % |
| Astral Robes | 48 | Armour % · Evasion % · Max Energy Shield % | Energy Shield flat · Evasion flat |
| Sentinel's Greaves | 62 | Armour % · Evasion % | Armour flat · Max HP flat |
| Dancer's Leggings | 27 | Max Energy Shield % · Cooldown reduction % | Energy Shield flat · Evasion flat |


## boots

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| Strapped Boots | 35 | Evasion flat · Evasion % | Cooldown reduction % |
| Plated Greaves | 55 | Max HP flat · Max HP % | Elemental resistance % · Life Regeneration % |
| Silk Slippers | 30 | Max Mana flat · Cooldown reduction % | Evasion % · Max Energy Shield % |
| Striders of the Dawn | 44 | Armour % · Evasion % · Max Energy Shield % | Armour flat · Energy Shield flat |
| Warden's Sabatons | 58 | Armour % · Evasion % | Armour flat · Max HP flat |
| Scout's Treads | 31 | Max Energy Shield % · Evasion % | Cooldown reduction % · Evasion flat |


## belt

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| War Belt | 40 | Max HP flat · Max HP % | Elemental resistance % · Life Regeneration % |
| Silk Sash | 20 | Max Mana % · Cooldown reduction % | Elemental resistance % · Mana Regeneration % |
| Chain Clasp | 28 | Elemental resistance % · Max HP flat | Evasion flat |

## gloves

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| Iron Gauntlets | 45 | Max HP % · Evasion flat | Elemental alignment % · Life Regeneration % |
| Silk Wraps | 20 | Elemental alignment % · Cooldown reduction % | Max Mana flat |
| Nimble Mitts | 25 | Evasion % · Evasion flat | Elemental alignment % |
| Handwrought Reliquary | 46 | Armour % · Evasion % · Max Energy Shield % | Armour flat · Energy Shield flat |
| Vanguard's Gauntlets | 50 | Armour % · Evasion % | Max HP flat · Armour flat |
| Ranger's Gloves | 24 | Max Energy Shield % · Evasion % | Elemental alignment % · Cooldown reduction % |


## ring (each ring picks independently)

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| Iron Band | 10 | Elemental alignment % · Cooldown reduction % | Max HP % · All Resistance % |
| Moonstone Signet | 14 | Max Mana % · Cooldown reduction % | Max HP % · Max Energy Shield % |

## amulet

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| Jade Amulet | 12 | Elemental alignment % · Cooldown reduction % | Max HP % · All Resistance % |
| Onyx Talisman | 20 | Elemental alignment % · Max Mana flat | Cooldown reduction % · Max Energy Shield % |

## earring

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| Silver Hoop | 12 | Elemental alignment % · Max Mana % | Cooldown reduction % · All Resistance % |
| Jade Stud | 16 | Elemental alignment % · Cooldown reduction % | Max HP % · All Resistance % |
| Onyx Drop | 22 | Max HP % · Elemental resistance % | Cooldown reduction % · All Resistance % |

## cape

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| Traveler's Cloak | 20 | Evasion % · Elemental resistance % | Cooldown reduction % · All Resistance % |
| Heavy Mantle | 32 | Max HP flat · Elemental resistance % | Max Mana flat · All Resistance % |
| Silk Drape | 22 | Max Mana % · Elemental resistance % | Mana Regeneration % · All Resistance % |
| Mantle of the Bulwark | 64 | Armour % · Evasion % · Max Energy Shield % | Armour flat · Energy Shield flat |
| Astral Shroud | 26 | Max Energy Shield % · Evasion % | Energy Shield flat · Mana Regeneration % |
| Bulwark Cape | 38 | Armour % · Evasion % | Max HP flat · Elemental resistance % |


## off hand

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| Buckler | 25 | Evasion % · Cooldown reduction % | Max HP flat |
| Kite Shield | 55 | Max HP flat · Max HP % | Evasion % |
| Grimoire | 30 | Max Mana % · Cooldown reduction % | Max Mana flat · Elemental alignment % |

The off hand's two families: **Shield** (Buckler · Kite Shield) carries the block line, **Book** (Grimoire) carries the magic pair — the two rows of the Line 1 table above name each family's Mods.

- Main-hand weapons: **ruled that a weapon type MAY carry more than one Base** (A10) — the old "the weapon type is already its Base" is lifted, so the same type can ship as frame variants. The frames are enumerated below: the loot roll picks the type and then the frame inside it, so the frame is what the piece is called and what it forces — which is why two frames of one type differ in their craftable-Mod count. **The first frame of every type carries exactly the lines that type forced before the frames existed**, so no measured loot number moved (`bases.ts` BS9).
- **`rod` is removed from every list**: the magic main hand is wand and staff, and the off hand carries the Book. The weapon table is eleven types (`equipment-weapon.md`).
- Dual-wield (off hand is a weapon) uses that weapon type weight x 0.8

## Frames per weapon type

| Type | Frame | Forced Base-Mod lines |
|---|---|---|
| one-handed sword | Arming Sword | physical_power_flat · attack_speed |
| one-handed sword | Longsword | physical_power_flat · accuracy |
| one-handed axe | Splitting Axe | physical_power_flat · bleed_chance |
| one-handed axe | Cleaver | physical_power_flat · critical_chance |
| dagger | Dirk | physical_power_flat · critical_chance |
| dagger | Stiletto | critical_chance · attack_speed |
| mace | Warhammer | physical_power_flat · stun_chance |
| mace | Cudgel | physical_power_flat · critical_damage |
| wand | Bone Wand | magic_power_flat · cooldown_reduction |
| wand | Crystal Wand | magic_power_flat · elemental_power_flat |
| staff | Battle Staff | magic_power_flat · max_mana_flat |
| staff | Runed Staff | magic_power_flat · elemental_alignment |
| spear | Pike | physical_power_flat · accuracy |
| spear | Partisan | physical_power_flat · attack_speed |
| two-handed sword | Greatsword | physical_power_flat |
| two-handed sword | Flamberge | physical_power_flat · critical_damage |
| two-handed axe | Battle Axe | physical_power_flat · bleed_chance |
| two-handed axe | Halberd | physical_power_flat · accuracy |
| bow | Longbow | physical_power_flat · accuracy |
| bow | Recurve Bow | physical_power_flat · attack_speed |
| crossbow | Arbalest | physical_power_flat · armour_pen |
| crossbow | Hand Crossbow | physical_power_flat · critical_chance |

A type's frames roll **equally**, like every other Base inside its slot, and the **reference frame** is the first row — so a frame list widens a type without moving what the ladder already priced. Every frame line must be a real Mod and the reference row must match the type's live forced pair, or the bases gate fails. `bases.ts --write` imports this table into `bases.json` `weapon_frames`, and both the drop roll and `equipment-weapon.md`'s frame table read it from there.

# Gear Mod school per Base (PoE)

Heavy Bases (Sallet · Plate Vest · Cuisses · Plated Greaves · Iron Gauntlets · Heavy Mantle · Knight's Helm · Mail Coat · Sentinel's Greaves · Warden's Sabatons · Vanguard's Gauntlets) carry Armour · light Bases (Hood · Ring Mail · Breeches · Strapped Boots · Nimble Mitts · Traveler's Cloak · Hunter's Hood · Jerkin · Scout's Treads · Ranger's Gloves) carry Evasion · cloth Bases (Circlet · Vestment · Legwraps · Silk Slippers · Silk Wraps · Silk Drape · Shadow Coat · Dancer's Leggings) carry Energy Shield. The three-way Bases (Crown · Regalia · Astral Robes · Striders of the Dawn · Handwrought Reliquary · Mantle of the Bulwark · Bulwark Cape · Astral Shroud) take the school of the heaviest type they carry, so a Quality Stone always has something to push: Armour for the armour-bearing frames, Evasion for the rest. Only helmet, chest, pant, boots, and gloves roll the Gear Mod — belt, rings, amulet, and off hand roll none of it, and the cape carries its defence type on the Base Mod line alone, because the Quality-Stone ladder belongs to the five slots above. Each +1 from Quality Stone raises that Gear Mod. Formulas live in crafting.md; the ladder's reachable value is published as `craft.gear_mod_per_level` and bounded by that school's own T1 ceiling in `mod_max`, which **X42** recomputes and **SV7** survives at the boss.

# Three Paths Bases Actually Create (measured)

<!-- BEGIN GENERATED:three-paths -->
| Chosen path | Combined total (low quality) | Full set (mid quality) | Full set (high quality) | Aspd tax with no Str investment |
|---|---|---|---|---|
| cloth/glass (Circlet · Vestment · Legwraps · Silk Slippers · Silk Sash · Silk Wraps · Iron Band ×2 · Jade Amulet · Silver Hoop · Traveler's Cloak) | 205 | 267 | 346 | 0% |
| balanced (Hood · Ring Mail · Breeches · Strapped Boots · Chain Clasp · Nimble Mitts · Iron Band ×2 · Jade Amulet · Jade Stud · Traveler's Cloak) | 296 | 385 | 500 | 0% |
| armored (Sallet · Plate Vest · Cuisses · Plated Greaves · War Belt · Iron Gauntlets · Moonstone Signet ×2 · Onyx Talisman · Onyx Drop · Heavy Mantle) | 442 | 575 | 747 | 0% |

Printed by `node tools/bases.ts --blocks` from `tools/data/bases.json`. Mid and high apply `quality_weight_multiplier` (×1.3) per Item quality band, the same way `weightAtQuality` applies it to a single item. The held weapon is not folded into these sets: it weighs 25 to 85 at Base weight (`equipment-weapon.md`), the same ×-quality multiplier applies, and an off-hand weapon counts ×0.8 of its own type (`mod-pool.md`).
<!-- END GENERATED:three-paths -->

- This is what gives **Str a real second job** without locking anything: heavy armor is not a ban, it is a bill
- The reverse is true as well: glass builds in cloth spend zero slots on Str → the fast-hit / burst gap flagged in combat.md and loot.md **is lighter than feared**, because no-Str builds are no longer taxed automatically when they choose light gear
- The -50% tax hitting the Cap means an armored build with no Str does not die, only slows — while still tanking well. That is what that build chose

# Base Rolling

- **Bases roll equally inside their slot** (helmet 1/3 · chest 1/3 · ring 1/2 · weapon by dropped type)
- Consequence to be aware of: the chance of the *right* frame is 1/#Base for that slot · multiplied by where the roll lands in its window (17% T1), a truly on-spec item is 1 in ~30-60 drops → this is the job of **Reroll/Refine/Ascend, not luck** (loot.md)
- **Minute one's set is hand-authored, not rolled** — `engine.json` `opening.gear` names a frame per slot and the client gives each piece the one line its frame's Base Mod takes at the floor of its window (`item-rarity.md`), so the drop roll's own count and pools are untouched by the opening.

# What This File Unlocks for Other Systems

| File | Gap closed |
|---|---|
| mod-pool.md | Per-slot weight table → becomes per-*Base* weight |
| formula.md section 11 | The penalty numbers are the ones printed above (cloth pays nothing, the heavy paths pay up to the Cap) |
| equipment-slot.md | Per-slot Primary/Secondary → moved here per Base · the old notes 2 (Evasion Flat on only 2 slots) and 3 (Alignment on only 2 slots) are **retired**: the union pools now give Evasion Flat 4 slots, and **Elemental alignment and Elemental resistance are separated onto disjoint slot families** (alignment · gloves · ring · amulet · off hand; resistance · helmet · chest · pant · boots · belt · cape) so an Element build never trades survival against the line that gates its status and scales its Element damage — see the generated Mod availability table in equipment-slot-pools.md |
| item-rarity.md | Third-Rarity (Unique) **cut**, and Rarity itself retired — the item level is the one axis; Base frame + Mods carry identity |
| crafting.md | Open question "item Base" in the missing-slots list → now answered · **per-item craft-attempt ceiling: none** — structural ceilings (Refine T1 · Ascend high quality) already bound it |
| loot.md section 1 | Roll order gains a "pick Base" step before Primary/Secondary |

