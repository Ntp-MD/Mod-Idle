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

- Mod pools, Core stat rules, and per-Mod weights → see equipment-slot-pools.md
- Armor pools (helmet, chest, pant, boots, belt, gloves, ring x2, amulet, cape) → see equipment-slot-armor.md
- Weapon pools (main hand, off hand) + Offensive/Defensive rules + Coverage → see equipment-slot-weapon.md

> Union rule: each slot table is the **union of all Bases in that slot** · a drop rolls one Primary/Secondary set from its Base (see item-base.md)

# Mod Pool summary

Pool roles: **Primary** rolls often (1.0) · **Secondary** rolls less often (0.5) · **Blocked** never rolls · **Offensive** only on weapons · **Defensive** only off-weapon · **Core stat** rolls everywhere (1.0).

- **Core stat (every item):** Core stat flat (5-25 by quality, str / vit / dex / agi / wis / int / lck) + Core stat % (1-5%) · max 2 slots per item (1 Flat + 1 %) · weight 1.0 · full rules see equipment-slot-pools.md
- **Defensive Pool (all except main hand):** Max HP flat 40-200 · Max HP % 3-16% · Max Mana flat 20-140 · Max Mana % 3-16% · Dodge flat 3-15 · Dodge % 2-10% · Cooldown reduction % 5-25% · Elemental resistance % 15-30% · Elemental alignment % 1-5% · Armour flat (TBD) · Evasion flat (TBD) · Energy Shield flat (TBD, helmet/chest/pant/boots/gloves only)
- **Offensive Pool (main hand + dual-wield off hand):** Physical power 15-80 / 3-16% · Magic power 15-80 / 3-16% · Elemental power 12-64 / 3-14% · Critical chance 1-8% · Critical damage 12-120% · Attack speed 5-25% · Accuracy 5-25% · Str / Int 5-25 / 1-5%
- **Weights:** Effective weight = role weight x Mod value · Primary 1.0 · Secondary 0.5 · Core stat 1.0 · per-Mod values (0.25-1.2, e.g. Max HP % 0.8, crit damage 0.7, CDR 0.6) see equipment-slot-pools.md
- **Early-game Flat lines:** Max HP flat · Max Mana flat · Power flat weigh 0.5 (low) · 0.4 (mid) · 0.25 (high) — drops full of Flats stop upgrading naturally, crafting takes over · see equipment-slot-pools.md
- **Reroll:** T1 spans 1-2 points only (e.g. Max HP % T1 = 15-16) → reroll moves ~0.1-1% item power · fixes bad rolls, not climbing · see crafting.md

# Slot index

| Slot | Pool | Detail |
|---|---|---|
| helmet | Max HP flat · Max HP % · Dodge % / CDR · res · Armour · Evasion · Energy Shield | see equipment-slot-armor.md |
| chest | Max HP % · Max HP flat / res · Max Mana % · Armour · Evasion · Energy Shield | see equipment-slot-armor.md |
| pant | Max HP flat · Dodge % / Max HP % · res · Armour · Evasion · Energy Shield | see equipment-slot-armor.md |
| boots | Dodge flat · Dodge % / Max Mana flat · CDR · Armour · Evasion · Energy Shield | see equipment-slot-armor.md |
| belt | Max HP flat · Max HP % / CDR · res | see equipment-slot-armor.md |
| gloves | Dodge % · Dodge flat / Max HP % · Alignment · Armour · Evasion · Energy Shield | see equipment-slot-armor.md |
| ring x2 | res · CDR / Max HP % · Max Mana % | see equipment-slot-armor.md |
| amulet | res · Alignment / Max Mana flat · CDR | see equipment-slot-armor.md |
| cape | res · Dodge % / CDR · Max Mana % | see equipment-slot-armor.md |
| main hand | Offensive only, Blocked: Max HP · Dodge · CDR · res | see equipment-slot-weapon.md |
| off hand | Shield (HP · Dodge) / Book (Mana · CDR) / Dual-wield (main-hand pool, half Primary weight) | see equipment-slot-weapon.md |

**Rules:** Weapon items roll only Offensive · other 10 slots roll only Defensive · Core stat rolls everywhere · Elemental resistance is always Defensive · full rules + coverage see equipment-slot-weapon.md

Coverage: Str/physical + Int/magic → main hand + Core stat everywhere · Vit/tank → chest · pant · belt · Agi/dodge → boots · gloves · cape · helmet · Crit → main hand + Lck everywhere · Wis/CDR → amulet · cape · ring · belt · boots · Dex/accuracy → main hand + Dex everywhere · Element → main hand damage + Defensive res · Mana → amulet · boots · cape.

# Notes / Remaining Gaps

1. **Defensive items have no Vit % / Vit Flat in-pool** — tank players rely on Core stat Vit alone. If tank feels too heavy, add it back to the pool
2. ~~**Dodge has no Flat left on some items**~~ **Closed by item-base.md** — Dodge Flat is now found on 6 paths: greaves · striders · gauntlets · gloves · clasp · buckler · up to 15 per item (high quality T1)
   Cap reach point is rate 150, with **two paths**: 816 Agi + 2 Dodge Flat slots (122+30 = 152) or 468 Agi + 6 Dodge Flat slots (70+90 = 160) · both must commit half a set to dodge, so the Cap still means something
3. ~~**Alignment only on amulet and gloves**~~ **Closed by item-base.md** — Elemental alignment now sits on circlet · wrap · wraps · sash · pendant · tome (6 slots x max 5%) · extreme Element builds reach Cap 50 without relying on specific slots
4. ~~**Secondary weights not yet tuned**~~ **Closed** — see the per-Mod weight section above · secondaries are no longer flat 0.5, but 0.5 x value(mod) measured from real marginal value (early-game lines like Max HP Flat weigh down to 0.5 · strongest lines like crit damage weigh down to 0.7
- **Flat-line weight shifts by quality tier**: 0.5 (low) · 0.4 (mid) · 0.25 (high) — because their marginal value falls from +2.1% to +1.0% (Max HP) while % lines stay flat · measured: Flat lines per high-zone drop fall from 0.28 to 0.15 (-46%) and total keep-rate barely moves (1.01% → 1.02%) → crafting currency prices in crafting.md stay valid without edits
