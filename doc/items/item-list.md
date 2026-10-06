# Item List

import glossary.md
import crafting.md
import item-base.md
import equipment-slot.md
import mod-pool.md
import loot.md

Registry of every item in the game, split into 3 categories. This file lists **what exists**; numbers live in the detail files it points to.

# 1. Consumable items — 7 stones + 2 potions

Stones are the only **power** media. No Dust, no cluster dust, no Core. Max stack 999 per stone. Potions are combat consumables, never media.

**Gold** (`economy.md`) is the second medium and is quality-of-life only: minted by selling a filter-rejected piece (1 gold) or by Road events, spent at settlement stalls on space/time/information/appearance. It buys nothing in this section and nothing in section 3 — no gear, no Mods, no potions, no stones, and there is no gold↔stone exchange.

| Stone | Effect | Rules | Price | Source |
|---|---|---|---|---|
| Add mod stone | Fill one empty slot up to the Rarity crafted max | Net counting (`mods_added 0-2`) · 1st fill 1 stone, 2nd fill 2 stones · Common to 3, Rare to 7 · slots 6-7 never Core if 2 Core slots present · new Mod rolls from the Base pool at the piece quality/tier | 1 (2nd fill 2) | Elite / boss only |
| Reroll value stone | Reroll value inside the same Tier | Never lower than before · Mod name, Tier, and Element unchanged | 8 per use (~10/hour) | Every junk dissolve = 1 |
| Reroll tier stone | Reroll Tier + value of one slot (T3 50 / T2 33 / T1 17) | May roll lower · Mod name and Element unchanged · 8 stones buy one deterministic Refine (+1 tier) | 1 per randomize · 8 per Refine (~3.75/hour) | High-level monsters, elites, bosses |
| Remove mod stone | Remove one random non-legacy Mod | Slots 1-2 are Legacy mod and immune · target pool is slots 3+ | 1 per use | Elite / boss |
| Quality Stone | Attempt +1 (to +15) | +1-4 100% · +5-10 90-20% fail drops 1 level · +11-15 50-20% fail breaks · protection 5 per piece · online only · raises Gear Mod only, never Mod values | N stones for +N | Steps 1-5 monsters · 6-10 elites · 11-15 bosses |
| Repair stone | Revive one Broken piece at its pre-break level | Refills protection to 5 | 1 per use | Elite / boss only |
| Corrupt stone | One Vaal-style gamble (25/20/15/15/10/10/5 outcomes, crafting.md) | Corrupted pieces accept no further stones | 1 per use, one use per piece | Boss only, rarest stone |
| Red / Yellow / White Draught | Instant 10 / 20 / 30% Max HP (auto-use configurable, farm.md) | 30 sec shared cooldown · max 3 per fight · suppressed on bosses · weight 2 each | Craft: 3/5/8 herbs + 1/2/4 Reroll value stones | Farm + herb drops |
| Sky / Blue / Deep Blue Draught | Instant 15 / 25 / 35% Max Mana (auto-use configurable, farm.md) | Same combat rules as HP line | Craft: 3/5/8 herbs + 1/2/4 Reroll value stones | Farm + herb drops |
| Condensed Draught (any) | 10x effect of one bottle | Weight 12 vs 20 loose | Craft: 10 bottles + 4 Reroll value stones | Potion crafting |

# 2. Misc items

- Herb (low / mid / high): mob drops in mid+ zones plus farm harvests. Potion material only. Stack 999 per tier.
- Town purchases, all convenience and all bought with gold at the stalls in `towns.md` section 5: plot deed (4-5) · house · stash tab · bag category slot · Herb pouch II/III · task skip token · repair service · waypoint link · titles, banners and Base tints.
- No other misc items. Skills live in the character list, never as items (skill-pool.md).

# 3. Gear items

Gear is generated, not listed. Every piece is defined by:

- Slot (12 worn: helmet, chest, pant, boots, belt, gloves, ring ×2, amulet, cape, main hand, off hand) — equipment-slot.md
- Base frame (weight + Primary/Secondary emphasis + Gear Mod school) — item-base.md
- Rarity: Common (dropped 2-3, crafted max 3) / Rare (dropped 3-5, crafted max 7) — item-rarity.md
- Item quality: low / mid / high (single value per piece) — mod-pool.md
- Tier: T3 / T2 / T1 sub-range inside that quality — mod-pool.md
- Element: exactly one of 5, never changed by crafting — elements.md
- Legacy mod: slots 1-2, immune to Remove — glossary.md
- Gear Mod: Armour / Evasion / Energy Shield on helmet, chest, pant, boots, gloves only — glossary.md
- Per-piece state: `mods_added 0-2` · `refine_lv +0-15` · `broken` flag · `protection_left 0-5` — save.md

(End of file)
