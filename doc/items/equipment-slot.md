# Equipment Slots

import equipment-slot-pools.md
import equipment-slot-armor.md
import equipment-slot-weapon.md

## Slot List

- helmet
- chest
- pant
- boots
- belt
- gloves
- ring * 2
- amulet
- cape
- main hand
- off hand

> **No skill slot** — skills are not on equipped items, they live in the character list (see skill-pool.md)

## Detail files

- Mod pools, Stat Mod rules, and per-Mod weights → see equipment-slot-pools.md
- Armor pools (helmet, chest, pant, boots, belt, gloves, ring x2, amulet, cape) → see equipment-slot-armor.md
- Weapon pools (main hand, off hand) + Offensive/Defensive rules + Coverage → see equipment-slot-weapon.md

> Union rule: each slot table is the **union of all Bases in that slot** · a drop rolls one Primary/Secondary set from its Base (see item-base.md)

# Mod Pool summary

Pool roles: **Primary** rolls often (1.0) · **Secondary** rolls less often (0.5) · **Blocked** never rolls · **Offensive** only on weapons · **Defensive** only off-weapon · **Stat Mod** rolls everywhere (1.0).

- **Stat Mod (every item):** Stat Mod flat (5-25 by quality, str / vit / dex / agi / wis / int / lck) · max 1 slot per item — the `Stat Mod %` sibling is retired · weight 1.0 · full rules see equipment-slot-pools.md
- **Defensive Pool (all except main hand):** Max HP flat · Max HP % · Max Mana flat · Max Mana % · Evasion flat · Evasion % · Cooldown reduction % · Elemental resistance % · Elemental alignment % · Armour flat · Energy Shield flat · Life / Mana Regeneration · Max Energy Shield % · Status Alignment resistance % (ranges in mod-pool.md's generated table · the three Gear Mod schools are helmet/chest/pant/boots/gloves only)
- **Offensive Pool (main hand + dual-wield off hand):** Physical power 15-80 / 3-16% · Magic power 15-80 / 3-16% · Elemental power 12-64 / 3-14% · Critical chance 1-8% · Critical damage 12-120% (physical only) · Attack speed 5-25% · Accuracy 5-25% · Str / Int 5-25 / 1-5%
- **Weights:** Effective weight = role weight x Mod value · Primary 1.0 · Secondary 0.5 · Stat Mod 1.0 · per-Mod values (0.25-1.2, e.g. Max HP % 0.8, crit damage 0.7, CDR 0.6) see equipment-slot-pools.md
- **Early-game Flat lines:** Max HP flat · Max Mana flat · Power flat weigh 0.5 (low) · 0.4 (mid) · 0.25 (high) — drops full of Flats stop upgrading naturally, crafting takes over · see equipment-slot-pools.md
- **Reroll:** T1 spans 1-2 points only (e.g. Max HP % T1 = 15-16) → reroll moves ~0.1-1% item power · fixes bad rolls, not climbing · see crafting.md

# Slot index

| Slot | Pool | Detail |
|---|---|---|
| helmet | Max HP flat · Max HP % / Evasion % · Max Mana % · CDR · res · Life / Mana Regen | see equipment-slot-armor.md |
| chest | Max HP % · Max HP flat / res · Max Mana % · Life / Mana Regen · CDR · Evasion % | see equipment-slot-armor.md |
| pant | Evasion flat · Max HP flat · Max HP % / res · Max Mana flat · Life / Mana Regen · CDR | see equipment-slot-armor.md |
| boots | Evasion flat · Evasion % · Max HP flat · Max Mana flat / CDR · res · Max Energy Shield % | see equipment-slot-armor.md |
| belt | Max HP flat · Max HP % / CDR · res · Life / Mana Regen · Evasion flat | see equipment-slot-armor.md |
| gloves | Evasion flat · Max HP % · Alignment / Alignment · Life Regen · Max Mana flat · CDR · Evasion % | see equipment-slot-armor.md |
| ring x2 | res · CDR / Max HP % · Max Mana % · Alignment | see equipment-slot-armor.md |
| amulet | res · Alignment / Max Mana flat · CDR · Max HP % | see equipment-slot-armor.md |
| cape | res · Evasion % / CDR · Max Mana % · Max HP flat | see equipment-slot-armor.md |
| main hand | Offensive only, Blocked: Max HP · Evasion · CDR · res | see equipment-slot-weapon.md |
| off hand | Shield (HP · Evasion) / Book (Mana · CDR) / Dual-wield (main-hand pool, half Primary weight) | see equipment-slot-weapon.md |

The per-slot lines above are a summary; **item-base.md is the source** for which Base rolls which pool (`node tools/bases.ts --write` imports it and the **BS** gates read it back), so a slot disagreement is fixed in that doc, never here.

**Rules:** Weapon items roll only Offensive · other 10 slots roll only Defensive · Stat Mod rolls everywhere · Elemental resistance is always Defensive · full rules + coverage see equipment-slot-weapon.md

Coverage: Str/physical + Int/magic → main hand + Core stat everywhere · Vit/tank → chest · pant · belt · Agi/Evasion → boots · gloves · cape · helmet · Crit → main hand + Lck everywhere · Wis/CDR → amulet · cape · ring · belt · boots · Dex/accuracy → main hand + Dex everywhere · Element → main hand damage + Defensive res · Mana → amulet · boots · cape.

# Notes / Remaining Gaps

- **Defensive items have no Vit % / Vit Flat in-pool** — tank players rely on Core stat Vit alone. If tank feels too heavy, add it back to the pool
- **The Evasion Cap is proven, not asserted** — X20 checks it against the accuracy floor and ceiling lineages and **X11** refuses a Cap that no build can reach; the reach path is the Dex rating plus Agi points, so half a set is never enough on its own
- **Flat-line weight shifts by quality tier**: 0.5 (low) · 0.4 (mid) · 0.25 (high) — because their marginal value falls from +2.1% to +1.0% (Max HP) while % lines stay flat · measured: Flat lines per high-zone drop fall from 0.28 to 0.15 (-46%) and total keep-rate barely moves (1.01% → 1.02%) → crafting currency prices in crafting.md stay valid without edits
