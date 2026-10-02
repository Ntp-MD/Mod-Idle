# Provision (Herb · Farm · Potion · Shop)

import glossary.md
import world.md
import loot.md
import crafting.md
import item-list.md
import combat.md
import save.md
import checks.md

Melvor-flavored provisioning without reopening the locked doors: no farm levels (timers only), no potion healing on bosses (boss aura suppresses), and no gold↔stone exchange — the shop takes gold, crafting keeps the 7 stones (`economy.md`). All flows are bounded and fold into the loot funnel (checks.md H1).

# Herb

- Drop: 2% per kill in mid zones, 3% in high zones, as a bundle of 1-3 zone-tier herbs (low / mid / high). Separate roll, small enough to leave F1-F3 intact; exact rate finalizes in the rebalance pass.
- Filter keeps herbs by default; herbs never dissolve into stones.
- Misc category, stack 999 per tier (Herb pouch upgrades raise this, economy.md).

# Farm

- 3 plots (deeds 4-5 in the shop). Timer only: no levels, no XP, no skill.
- Plant 1 herb → 4 hours → harvest 3 of the same tier. Grows offline inside the 12-hour cap.
- Cost of play: 2 taps per day. Outputs potion herbs only, never gear or power.

# Potion (Ragnarok style: color ladder, weight, condensed)

| Potion | Herb tier | Effect | Craft | Weight |
|---|---|---|---|---|
| Red Draught | low | Instant 10% Max HP | 3 herbs + 1 Reroll value stone | 2 |
| Yellow Draught | mid | Instant 20% Max HP | 5 herbs + 2 Reroll value stones | 2 |
| White Draught | high | Instant 30% Max HP | 8 herbs + 4 Reroll value stones | 2 |
| Sky Draught | low | Instant 15% Max Mana | 3 herbs + 1 Reroll value stone | 2 |
| Blue Draught | mid | Instant 25% Max Mana | 5 herbs + 2 Reroll value stones | 2 |
| Deep Blue Draught | high | Instant 35% Max Mana | 8 herbs + 4 Reroll value stones | 2 |
| Condensed (any) | same | 10x effect of one bottle | 10 bottles + 4 Reroll value stones | 12 (vs 20 loose) |

- Effects are % and pending the survival rerun; tiers follow herb tiers so high zones grow stronger medicine, not cheaper medicine.
- Weight counts toward `weight_used` (formula.md section 11): potion carriers pay the same Str tax as heavy armor. This replaces RO's zeny spam limit alongside the rules below.
- Auto-use is configurable per line (HP line / Mana line): on/off toggle plus threshold slider (defaults HP < 30%, mana < 25%). Auto-use always drinks the best available tier first.
- Shared cooldown 30 sec. Max 3 uses per fight, drawn from inventory. No cleanse potion exists: cleansing stays on Cleanse (skill-pool).
- Threshold plus short normal-fight durations bound AFK abuse: potions almost never trigger in 1-sec farm kills.
- **Boss aura suppresses all potions.** Bosses are won with casted heals only (combat.md section 7).

# Shop (gold-priced)

- Inventory is convenience only, never power: Plot deed 4, Plot deed 5 (Steward), Herb pouch II/III and stash tabs (Porter).
- Prices in **gold** (`economy.md`): no convenience is priced in stones anymore, so the shop never competes with Reroll/Refine/Ascend for the same medium.
- The shop never sells gear, Mods, potions, stones-for-stones at a profit, or anything that drops for free.
- **Who owns it and where** — `towns.md` sections 4-5 split this single shop into NPC stalls across 3 capitals and 6 towns. Same rules, more owners.

(End of file)
