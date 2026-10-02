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
| barbute | 45 | Max HP flat · Max HP % | Elemental resistance % |
| circlet | 18 | Max Mana % · Cooldown reduction % | Elemental alignment % |

## chest

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| mail | 60 | Dodge % · Max HP % | Elemental resistance % · Max HP flat |
| plate | 85 | Max HP flat · Max HP % | Elemental resistance % |
| vestments | 28 | Max Mana % · Max Mana flat | Cooldown reduction % |

## pant

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| greaves | 50 | Dodge flat · Dodge % | Max HP flat |
| cuisses | 70 | Max HP flat · Max HP % | Elemental resistance % |
| wrap | 25 | Cooldown reduction % · Max Mana flat | Elemental alignment % |

## boots

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| striders | 35 | Dodge flat · Dodge % | Cooldown reduction % |
| sabatons | 55 | Max HP flat · Max HP % | Elemental resistance % |
| soft boots | 30 | Max Mana flat · Cooldown reduction % | Dodge % |

## belt

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| girdle | 40 | Max HP flat · Max HP % | Elemental resistance % |
| sash | 20 | Max Mana % · Cooldown reduction % | Elemental alignment % |
| clasp | 28 | Elemental resistance % · Max HP flat | Dodge flat |

## gloves

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| gauntlets | 45 | Max HP % · Dodge flat | Elemental alignment % |
| wraps | 20 | Elemental alignment % · Cooldown reduction % | Max Mana flat |
| gloves | 25 | Dodge % · Dodge flat | Max HP % |

## ring (each ring picks independently)

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| band | 10 | Elemental resistance % · Cooldown reduction % | Max HP % |
| signet | 14 | Max Mana % · Cooldown reduction % | Max HP % |

## amulet

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| pendant | 12 | Elemental alignment % · Elemental resistance % | Cooldown reduction % |
| talisman | 20 | Elemental resistance % · Max Mana flat | Elemental alignment % |

## cape

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| cloak | 20 | Dodge % · Elemental resistance % | Cooldown reduction % |
| mantle | 32 | Max HP flat · Elemental resistance % | Max Mana flat |

## off hand

| Base | Weight | Primary | Secondary |
|---|---|---|---|
| buckler | 25 | Dodge % · Cooldown reduction % | Max HP flat |
| kite shield | 55 | Max HP flat · Max HP % | Dodge % |
| tome | 30 | Max Mana % · Cooldown reduction % | Max Mana flat · Elemental alignment % |

- Main-hand weapons have no separate Base · **the weapon type is already its Base** (12 types in equipment-weapon.md carry their own weight + weapon_aspd + pool)
- Dual-wield (off hand is a weapon) uses that weapon type weight x 0.8

# Gear Mod school per Base (PoE)

Heavy Bases (barbute · plate · cuisses · sabatons · gauntlets) carry Armour · light Bases (coif · mail · greaves · striders · gloves) carry Evasion · cloth Bases (circlet · vestments · wrap · soft boots) carry Energy Shield. Only helmet, chest, pant, boots, and gloves roll Armour / Evasion / Energy Shield as main Mods — belt, rings, amulet, cape, and off hand roll none of the three. Each +1 from Quality Stone raises that Gear Mod. Formulas live in crafting.md; value ranges and reachable caps follow in the rebalance pass.

# Three Paths Bases Actually Create (measured)

| Chosen path | Combined total | Full set + weapon (mid quality) | Full set (high quality) | Aspd tax without Str investment |
|---|---|---|---|---|
| cloth/glass (circlet · vestments · wrap · soft · sash · wraps · band · pendant · cloak + dagger + buckler) | 193 | 248 | 322 | **0%** |
| balanced (coif · mail · greaves · striders · clasp · gloves · band · pendant · cloak + sword + tome) | 300 | 390 | 507 | **-21%** |
| armored (barbute · plate · cuisses · sabatons · girdle · gauntlets · signet · talisman · mantle + 2h axe) | 420 | 505 | 657 | **-50% (hits tax Cap)** · 2 Str items left -26% · 6 Str items clear it |

- This is what gives **Str a real second job** without locking anything: heavy armor is not a ban, it is a bill
- The reverse is true as well: glass builds in cloth spend zero slots on Str → the fast-hit / burst gap flagged in combat.md and loot.md **is lighter than feared**, because no-Str builds are no longer taxed automatically when they choose light gear
- The -50% tax hitting the Cap means an armored build with no Str does not die, only slows — while still tanking well. That is what that build chose

# Base Rolling

- **Bases roll equally inside their slot** (helmet 1/3 · chest 1/3 · ring 1/2 · weapon by dropped type)
- Consequence to be aware of: the chance of the *right* frame is 1/#Base for that slot · multiplied by Rarity (18% Rare) and Tier (17% T1), a truly on-spec item is 1 in ~30-60 drops → this is the job of **Reroll/Refine/Ascend, not luck** (loot.md)
- If Bases should roll unequally in the future (e.g. plate spawns more in soldier zones), add a column to the zone table in world.md and recalculate drops/hour in loot.md

# What This File Unlocks for Other Systems

| File | Gap closed |
|---|---|
| mod-pool.md | Per-slot weight table → becomes per-*Base* weight |
| formula.md section 11 | New penalty numbers from the three paths above (cloth 0% · balanced -21% · armored -50%) |
| equipment-slot.md | Per-slot Primary/Secondary → moved here per Base · notes 2 (Dodge Flat on only 2 slots) and 3 (Alignment on only 2 slots) **are now less true** |
| item-rarity.md | Third-Rarity (Unique) **cut** (D-009 5c) — Rarity stays two levels; Base frame + Mods carry identity |
| crafting.md | Open question "item Base" in the missing-slots list → now answered · **per-item craft-attempt ceiling: none** (D-009 5b) — structural ceilings (Refine T1 · Ascend high quality) already bound it |
| loot.md section 1 | Roll order gains a "pick Base" step before Primary/Secondary |

(End of file - total 130 lines)
