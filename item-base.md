# Item Base

import glossary.md
import equipment-slot.md
import mod-pool.md
import item-rarity.md
import formula.md

**Base = the frame of an item in one slot** · one slot holds 2-3 frames · the gap every spec file previously marked as "not yet designed"

A Base does two things, and **is intentionally allowed to do nothing else**

| Base determines | Base does not determine |
|---|---|
| **Weight** (differing weights make the Str capacity matter) | Mod count → belongs to Rarity (glossary rule 2) |
| **Which Mod is Primary / Secondary** on that item | Rolled value per slot → belongs to quality + Tier |
| | Item home Element → belongs to the Mod pool only |

> Reason Bases must not touch Mod count: if both Rarity and Base set Mod count, two axes collapse into one, and players cannot tell whether an item is "rare" or "a heavy frame".

# Base Table per Slot

## helmet

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| coif | 30 | Dodge % · Max HP flat | Elemental resistance % |
| barbute | 45 | Max HP flat · Max HP % | Elemental resistance % · Life Regeneration % |
| circlet | 18 | Max Mana % · Cooldown reduction % | Elemental resistance % · Mana Regeneration % |

## chest

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| mail | 60 | Dodge % · Max HP % | Elemental resistance % · Max HP flat |
| plate | 85 | Max HP flat · Max HP % | Elemental resistance % · Life Regeneration % |
| vestments | 28 | Max Mana % · Max Mana flat | Cooldown reduction % · Mana Regeneration % |

## pant

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| greaves | 50 | Dodge flat · Dodge % | Max HP flat |
| cuisses | 70 | Max HP flat · Max HP % | Elemental resistance % · Life Regeneration % |
| wrap | 25 | Cooldown reduction % · Max Mana flat | Elemental resistance % · Mana Regeneration % |

## boots

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| striders | 35 | Dodge flat · Dodge % | Cooldown reduction % |
| sabatons | 55 | Max HP flat · Max HP % | Elemental resistance % · Life Regeneration % |
| soft boots | 30 | Max Mana flat · Cooldown reduction % | Dodge % · Max Energy Shield % |

## belt

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| girdle | 40 | Max HP flat · Max HP % | Elemental resistance % · Life Regeneration % |
| sash | 20 | Max Mana % · Cooldown reduction % | Elemental resistance % · Mana Regeneration % |
| clasp | 28 | Elemental resistance % · Max HP flat | Dodge flat |

## gloves

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| gauntlets | 45 | Max HP % · Dodge flat | Elemental alignment % · Life Regeneration % |
| wraps | 20 | Elemental alignment % · Cooldown reduction % | Max Mana flat |
| gloves | 25 | Dodge % · Dodge flat | Elemental alignment % |

## ring (each ring picks independently)

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| band | 10 | Elemental alignment % · Cooldown reduction % | Max HP % · All Resistance % |
| signet | 14 | Max Mana % · Cooldown reduction % | Max HP % · Max Energy Shield % |

## amulet

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| pendant | 12 | Elemental alignment % · Cooldown reduction % | Max HP % · All Resistance % |
| talisman | 20 | Elemental alignment % · Max Mana flat | Cooldown reduction % · Max Energy Shield % |

## cape

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| cloak | 20 | Dodge % · Elemental resistance % | Cooldown reduction % · All Resistance % |
| mantle | 32 | Max HP flat · Elemental resistance % | Max Mana flat · All Resistance % |

## off hand

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| buckler | 25 | Dodge % · Cooldown reduction % | Max HP flat |
| kite shield | 55 | Max HP flat · Max HP % | Dodge % |
| tome | 30 | Max Mana % · Cooldown reduction % | Max Mana flat · Elemental alignment % |

- Main-hand weapons: **ruled that a weapon type MAY carry more than one Base** (A10 · D-072) — the old "the weapon type is already its Base" (12 types in equipment-weapon.md, each with its own weight + weapon_aspd + pool) is lifted, so the same type can ship as frame variants. The concrete Base frames per type and their effect on the craftable-Mod count are enumerate-and-cage work now tracked in `harness/todo.md` section B, not invented here.
- Dual-wield (off hand is a weapon) uses that weapon type weight x 0.8

# Gear Mod school per Base (PoE)

Heavy Bases (barbute · plate · cuisses · sabatons · gauntlets) carry Armour · light Bases (coif · mail · greaves · striders · gloves) carry Evasion · cloth Bases (circlet · vestments · wrap · soft boots) carry Energy Shield. Only helmet, chest, pant, boots, and gloves roll Armour / Evasion / Energy Shield as main Mods — belt, rings, amulet, cape, and off hand roll none of the three. Each +1 from Quality Stone raises that Gear Mod. Formulas live in crafting.md; the ladder's reachable value is published as `craft.gear_mod_per_level` and bounded by that school's own T1 ceiling in `mod_max`, which **X42** recomputes and **SV7** survives at the boss.

# Three Paths Bases Actually Create (measured)

<!-- BEGIN GENERATED:three-paths -->
| Chosen path | Combined total (low quality) | Full set (mid quality) | Full set (high quality) | Aspd tax with no Str investment |
|---|---|---|---|---|
| cloth/glass (circlet · vestments · wrap · soft boots · sash · wraps · band ×2 · pendant · cloak) | 193 | 251 | 326 | 0% |
| balanced (coif · mail · greaves · striders · clasp · gloves · band ×2 · pendant · cloak) | 280 | 364 | 473 | −14% |
| armored (barbute · plate · cuisses · sabatons · girdle · gauntlets · signet ×2 · talisman · mantle) | 420 | 546 | 710 | −50% |

Printed by `node tools/bases.js --blocks` from `tools/data/bases.json`. Mid and high apply `quality_weight_multiplier` (×1.3) per Item quality band, the same way `weightAtQuality` applies it to a single item. The held weapon is not folded into these sets: it weighs 25 to 85 at Base weight (`equipment-weapon.md` · D-101), the same ×-quality multiplier applies, and an off-hand weapon counts ×0.8 of its own type (`mod-pool.md`).
<!-- END GENERATED:three-paths -->

- This is what gives **Str a real second job** without locking anything: heavy armor is not a ban, it is a bill
- The reverse is true as well: glass builds in cloth spend zero slots on Str → the fast-hit / burst gap flagged in combat.md and loot.md **is lighter than feared**, because no-Str builds are no longer taxed automatically when they choose light gear
- The -50% tax hitting the Cap means an armored build with no Str does not die, only slows — while still tanking well. That is what that build chose

# Base Rolling

- **Bases roll equally inside their slot** (helmet 1/3 · chest 1/3 · ring 1/2 · weapon by dropped type)
- Consequence to be aware of: the chance of the *right* frame is 1/#Base for that slot · multiplied by Rarity (18% Rare) and Tier (17% T1), a truly on-spec item is 1 in ~30-60 drops → this is the job of **Reroll/Refine/Ascend, not luck** (loot.md)

# What This File Unlocks for Other Systems

| File | Gap closed |
|---|---|
| mod-pool.md | Per-slot weight table → becomes per-*Base* weight |
| formula.md section 11 | The penalty numbers are the ones printed above (cloth pays nothing, the heavy paths pay up to the Cap) |
| equipment-slot.md | Per-slot Primary/Secondary → moved here per Base · the old notes 2 (Dodge Flat on only 2 slots) and 3 (Alignment on only 2 slots) are **retired**: the union pools now give Dodge Flat 4 slots, and **Elemental alignment and Elemental resistance are separated onto disjoint slot families** (alignment · gloves · ring · amulet · off hand; resistance · helmet · chest · pant · boots · belt · cape) so an Element build never trades survival against the line that gates its status and scales its Element damage — see the generated Mod availability table in equipment-slot-pools.md |
| item-rarity.md | Third-Rarity (Unique) **cut** (D-009 5c) — Rarity stays two levels; Base frame + Mods carry identity |
| crafting.md | Open question "item Base" in the missing-slots list → now answered · **per-item craft-attempt ceiling: none** (D-009 5b) — structural ceilings (Refine T1 · Ascend high quality) already bound it |
| loot.md section 1 | Roll order gains a "pick Base" step before Primary/Secondary |

(End of file - total 130 lines)
