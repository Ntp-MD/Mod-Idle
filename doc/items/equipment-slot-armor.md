# Armor Slots

import glossary.md
import item-base.md
import equipment-slot.md
import equipment-slot-pools.md

> **Union pools per armor slot.** `item-base.md` is the only source: each Base lists its own Primary/Secondary lines, and a slot's pool below is the union of that slot's Bases. **This table is generated** — edit the Bases, run `node tools/check.ts --write`, never type a pool here (D-034). A dropped piece still rolls one Base, so it carries only that Base's lines, not the whole union.

The Stat Mod line (`Stat Mod flat`) rolls on every item, and the Gear Mod line (`Armour flat` on heavy · `Evasion flat` on light · `Energy Shield flat` on cloth) is set by the Base's school — both are spelled out in `equipment-slot-pools.md` and guarded by **X18**, so no line below can name a Mod that does not exist in `mod-pool.md`.

<!-- BEGIN GENERATED:slot-pools -->
## helmet
| Role | Mods (union of every helmet Base in item-base.md) |
|---|---|
| Primary | Evasion % · Max HP flat · Max HP % · Max Mana % · Cooldown reduction % |
| Secondary | Elemental resistance % · Life Regeneration % · Mana Regeneration % |
| Stat Mod | Stat Mod flat · All stats flat (every item) |
| Gear Mod | Armour flat · Evasion flat · Energy Shield flat (the school is set by the Base) |
## chest
| Role | Mods (union of every chest Base in item-base.md) |
|---|---|
| Primary | Evasion % · Max HP % · Max HP flat · Max Mana % · Max Mana flat |
| Secondary | Elemental resistance % · Max HP flat · Life Regeneration % · Cooldown reduction % · Mana Regeneration % |
| Stat Mod | Stat Mod flat · All stats flat (every item) |
| Gear Mod | Armour flat · Evasion flat · Energy Shield flat (the school is set by the Base) |
## pant
| Role | Mods (union of every pant Base in item-base.md) |
|---|---|
| Primary | Evasion flat · Evasion % · Max HP flat · Max HP % · Cooldown reduction % · Max Mana flat |
| Secondary | Max HP flat · Elemental resistance % · Life Regeneration % · Mana Regeneration % |
| Stat Mod | Stat Mod flat · All stats flat (every item) |
| Gear Mod | Armour flat · Evasion flat · Energy Shield flat (the school is set by the Base) |
## boots
| Role | Mods (union of every boots Base in item-base.md) |
|---|---|
| Primary | Evasion flat · Evasion % · Max HP flat · Max HP % · Max Mana flat · Cooldown reduction % |
| Secondary | Cooldown reduction % · Elemental resistance % · Life Regeneration % · Evasion % · Max Energy Shield % |
| Stat Mod | Stat Mod flat · All stats flat (every item) |
| Gear Mod | Armour flat · Evasion flat · Energy Shield flat (the school is set by the Base) |
## belt
| Role | Mods (union of every belt Base in item-base.md) |
|---|---|
| Primary | Max HP flat · Max HP % · Max Mana % · Cooldown reduction % · Elemental resistance % |
| Secondary | Elemental resistance % · Life Regeneration % · Mana Regeneration % · Evasion flat |
| Stat Mod | Stat Mod flat · All stats flat (every item) |
## gloves
| Role | Mods (union of every gloves Base in item-base.md) |
|---|---|
| Primary | Max HP % · Evasion flat · Elemental alignment % · Cooldown reduction % · Evasion % |
| Secondary | Elemental alignment % · Life Regeneration % · Max Mana flat |
| Stat Mod | Stat Mod flat · All stats flat (every item) |
| Gear Mod | Armour flat · Evasion flat · Energy Shield flat (the school is set by the Base) |
## ring
| Role | Mods (union of every ring Base in item-base.md) |
|---|---|
| Primary | Elemental alignment % · Cooldown reduction % · Max Mana % |
| Secondary | Max HP % · All Resistance % · Max Energy Shield % |
| Stat Mod | Stat Mod flat · All stats flat (every item) |
## amulet
| Role | Mods (union of every amulet Base in item-base.md) |
|---|---|
| Primary | Elemental alignment % · Cooldown reduction % · Max Mana flat |
| Secondary | Max HP % · All Resistance % · Cooldown reduction % · Max Energy Shield % |
| Stat Mod | Stat Mod flat · All stats flat (every item) |
## earring
| Role | Mods (union of every earring Base in item-base.md) |
|---|---|
| Primary | Elemental alignment % · Max Mana % · Cooldown reduction % · Max HP % · Elemental resistance % |
| Secondary | Cooldown reduction % · All Resistance % · Max HP % |
| Stat Mod | Stat Mod flat · All stats flat (every item) |
## cape
| Role | Mods (union of every cape Base in item-base.md) |
|---|---|
| Primary | Evasion % · Elemental resistance % · Max HP flat · Max Mana % |
| Secondary | Cooldown reduction % · All Resistance % · Max Mana flat · Mana Regeneration % |
| Stat Mod | Stat Mod flat · All stats flat (every item) |
<!-- END GENERATED:slot-pools -->

# What each slot is for

- **helmet** — the piece equipped first, so it is where an immediate effect is felt.
- **chest** — defines survivability; Max HP % weighs most here because it multiplies both raw HP and HP from Core stat.
- **pant** — the second body of a set, carrying Evasion without the boot's premium.
- **boots** — the densest avoidance piece: `Evasion flat` and `Evasion %` both roll here, and the Agi that the Core stat supplies is the other half of the same line (D-112).
- **belt** — a secondary chest: same shape, but CDR instead of mana as the second line.
- **gloves** — grip. Attack speed must come from Core stat Agi instead, which is why gloves never carry `Attack speed %`.
- **ring ×2** — shifted from crit to res and CDR, so an Element player hunts the same Element twice and pushes res piece by piece.
- **amulet** — the piece that confirms Elements the most, paired with a main hand that deals Element damage.
- **cape** — the escape slot: res plus Evasion, with CDR and mana behind them.

Nothing is blocked per slot: every line in `mod-pool.md` that a slot can carry is listed above by its Base union, and the three Offensive lines stay on weapons only (**X18**).
