# Weapon Slots

import glossary.md
import equipment-weapon.md
import equipment-slot.md

> **Union pools for weapon slots** · weapon-type variants see equipment-weapon.md · Stat Mod + weight rules see equipment-slot-pools.md

## main hand

| Role | Mod |
|---|---|
| Primary | Physical power flat · Physical power % · Critical chance % · Critical damage % |
| Secondary | Attack speed % · Accuracy % |
| Stat Mod | Stat Mod flat · Stat Mod % (every item) |
| Blocked | Max HP · Dodge · Cooldown reduction · Elemental resistance |

- **`Critical damage %` is physical only** — a magic weapon can roll it, but magic damage never uses it, so a caster buys physical crit gear that does nothing for it. That is the intended shape: crit is the physical payoff (formula-offense.md section 3 · D-017).

**By weapon type (see equipment-weapon.md)**

| Weapon | Changes to |
|---|---|
| sword / axe / dagger / spear / bow / crossbow | Physical power Flat as main primary · Stat Mod favours Str |
| rod / wand / staff | Magic power Flat · Magic power % instead of Physical · Stat Mod favours Int |
| all types | Elemental power Flat always secondary, because every weapon has a home Element |

- **There are no per-stat Mods.** `Str flat` / `Int flat` and their % partners are not separate Mods: every stat on every item arrives through Stat Mod (equipment-slot-pools.md). What a weapon type changes is *which* stat its Stat Mod favours, not which Mod can roll.

## off hand

| Role | Mod |
|---|---|
| Shield | Max HP flat · Max HP % · Dodge % |
| Book | Max Mana flat · Max Mana % · Cooldown reduction % |
| Dual-wield weapon | Same pool as main hand but Primary weight halved |
| Stat Mod | Stat Mod flat · Stat Mod % (every item) |

- Shield and book are Defensive items by rule
- **Dual-wield is the sole exception to the rule** because it is a second weapon, so it gets Element damage and power at half weight
- Dual-wield works only with one-handed weapons flagged dual-wieldable

# Offensive / Defensive Rules

**Weapon items roll only Offensive Mods · all other 10 slots roll only Defensive Mods**

| Group | Members |
|---|---|
| Offensive | Power Flat/% of every type · Critical chance % · Critical damage % · Attack speed % · Accuracy % · Str %/Flat · Int %/Flat |
| Defensive | Max HP Flat/% · Max Mana Flat/% · Dodge Flat/% · Cooldown reduction % · Elemental resistance % · Elemental alignment % |
| Stat Mod | Assigned to neither group, accepted equally by every item per the Stat Mod section |

- Main hand is the only Offensive slot, except off hand while dual-wielding
- **Elemental resistance always counts as Defensive, for every Element.** It never becomes Offensive even if the player matches the weapon Element
- Cooldown reduction counts as Defensive because it controls pacing, not damage · traded against no slot gaining extra crit
- Stat Mod counts as neither group because it already rolls on every item

# Slot Coverage Check

| Build that needs an outlet | Outlet |
|---|---|
| Str / physical | main hand (power + Str) + Core stat on every item |
| Int / magic | main hand (magic power + Int) + Core stat on every item |
| Vit / tank | chest · pant · belt + Core stat Vit on every item |
| Agi / dodge | boots · gloves · cape · helmet + Core stat Agi on every item |
| Crit | main hand only — uses **Core stat Lck rolling on every item** as the main crit support instead of crit Mods |
| Wis / CDR | amulet · cape · ring · belt · boots |
| Dex / accuracy | main hand (Accuracy %) + Core stat Dex on every item |
| Element | main hand / dual-wield = damage · every Defensive item = res of its own Element |
| Mana | amulet · boots · cape + Core stat Int on every item |

> **Accepted trade-off**: crit chance / crit damage live on main hand alone, traded for rule simplicity
> The compensation makes Lck a stat every build invests in, not only for that one main-hand item
