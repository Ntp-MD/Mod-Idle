# Todo

import AGENT.md
import checks.md

The **single work file**: only what is _not built yet_, split by who can close it — **A** waiting on the
owner · **B** mine to build · **C** housekeeping that must not rot. **When work is done the line is
deleted, not ticked.** `node tools/verify.ts` green is the state of everything already built, so never
copy a cage result in here.

# Open work

**B — mine to build**

- **Map sheet · six zones repeat their sub-zone names.** Zones 3/4, 9/10 and 15/16 carry the same three sub-zone names and differ only by Element, so on the map `Blackwater Reach` and `Nettlecrag` sit close enough that their identical captions read as one cluster. Closing it is two edits: give those six zones distinct sub-zone names in `engine.json` (its writer repaints `mob-roster.md`; the names are the owner's to veto) and spread the six settlements apart in `map.json`. The map cage **M11** already holds the one rule this must not break — a settlement's hex plus one hex per sub-zone.
- **Map sheet · the biome tone snaps to the nearest settlement.** A hex with no settlement on it takes the tone of whichever settlement is closest, so the ground between clusters and the outer field drift into one neighbour's biome instead of reading as terrain of its own. Closing it: blend the tone by distance rather than snapping, and keep the settlement's own hex at full strength so the clusters still read.
- **Prices are still quoted in minutes** (`DECISIONS.md` D12 forbids it). `kills/hr` is already derived from the clear cycle and no longer published, but the town's price unit is still `m` = minutes of full-sell income, and the published surface still states per-hour figures. Closing it: re-denominate the unit to a kill-denominated one with every gold value held identical, then restate the rows that quote a rate — F1, F3, F4, F5, F7, F9, F13, F18, F20, F22 and the `loot-bands` table, the town `price-unit` block, the dashboard band cell (`tools/lib/pages.ts`), Mastery's hours row (`tools/lib/roster.ts`) and `tools/loot.ts`'s fourteen-hour measurement window (measure per drop instead) — and sweep the prose in the thirteen docs that still say per hour or per minute (`loot.md` · `checks.md` · `towns-stalls.md` · `economy.md` · `equipment-weapon.md` · `combat.md` · `crafting.md` · `save.md` · `concept.md` · `world.md` · `towns.md` · `towns-ui.md` · `skill-pool-system.md`).
- **Passive tree · the `mob_HP` fold.** The tree grants real lines, but nothing is booked into the curve: `mob.curve` still says it assumes an empty tree, so a character with ranks is stronger than every published number assumes. Owner ruling: the published rates are the **empty-tree baseline, permanently**, so this is not a correctness gate — it is a re-pricing pass, and it belongs with the balance work.
- **Passive tree · the node scale is stated, not measured.** `rank_tiers` (a tenth and a fifth of a line at rank three, about two thirds of a gear set for the whole tree) was set by rule, never measured. It moves with the line above — do not tune it before the fold lands.

**C — housekeeping**

- **Passive tree · the panel is compile-verified only.** `npm --prefix game run build` passes and the page serves, but no one has clicked a rank, watched the sheet move, or taken a respec in a browser yet. Verify that before calling the tree shipped.
