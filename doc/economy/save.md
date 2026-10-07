# Save

import item-rarity.md
import crafting.md

**Spec complete** — must store the list below and resolve the 5 decisions at the end of the file · Referenced numbers (12 hours · 8 stones · 17.0 uses per 1,000 kills · the E7 kill counts · boss 15 minutes) come from checks.md groups E/F/G, so these numbers in this file must not differ from the source

# What to store

| Category | Items |
|---|---|
| Character | Level · the points allocated per Core stat, the unspent stat points, and the banked tree points (a Core stat is spent, not derived from level — · `formula.md` section 0) · equipped items · weight (defers per-skill stat assignment to after release) |
| Progress | Unlocked zones · current target · wave |
| Town *(towns.md · doors chosen)* | Visited settlements · open Road/Waypoint links · Standing per settlement (kill counter, not a spendable pool) · owned house, plot deeds, pouch tier, stash tabs, **bag category slots and the potion carrier slot** · **bought filter preset slots** · Curio pedlar stock + refresh day · Collector set progress + which pieces were turned in · Collector hint line bought or not · per-slot **filter thresholds** |
| Road *(towns.md · engine.json road)* | The leg being walked: its link, kind, terrain, **the block it is on out of the link's block count**, seconds left on that block and encounters left · the **route** it belongs to — the ordered link list, whether it loops (a Circuit) or ends where it was aimed (a plotted route), the settlement it was aimed at, its leg index and completed laps · the once-per-link-per-day ledgers for the purse and the chest |
| Walk *(engine.json road.walk)* | The block is the unit the character moves through, so it is stored or the character reappears at a settlement it never left. A save written before the walk arrives with a leg and no block; the client fills the missing keys rather than refusing the restore, and that path is covered by a test (`game/tests/road.test.ts`) |
| Bag | All items with Item quality, Tier, Element, every Mod slot, Legacy mod flags (slots 1-2), `mods_added 0-2`, `refine_lv +0-15`, `broken` flag, `protection_left 0-5`, `corrupted` flag |
| Craft | All 7 stones (Add mod / Reroll value / Reroll tier / Remove mod / Quality / Repair / Corrupt) · **gold count** (single-medium mint, economy.md) · history of most recently crafted items |
| Provision | Herb counts by tier · potion counts by type and tier · farm plots (planted tier + ready time each) · potion auto config (per-type toggle + threshold) · owned plot deeds and pouch tier |
| Skills | The six loadout presets and the order they are cycled in (`skill-pool-system.md`) · each set's per-slot **mode** (Always / Conditional / Never) rides the set, so six sets are six rotations · the shared **condition list** is one list for the whole character and is saved with it, not per set · per-skill XP so a swap does not reset progress |
| Tasks | Guild board state (which task is active per slot) · the daily-skip timers (`tasks.md`) |
| Salvage | The dissolve counter, since a tier stone is owed every 500 salvages (`checks.md` F15) |
| Mode | Whether the character is in **Adventure** or **Settlement** (`glossary.md`), whether they are on AFK or active, and the offline-start timestamp, so a session resumes mid-cycle instead of restarting |
| Boss clock | The per-character boss spawn clock. It does **not** accrue while away — bosses are an online gate (`combat.md` section 7) |
| Time | Total play time · real-time recovery cycle |
| Settings | Bag filter · automation rules |

# Special considerations

- **Store the Tier of each Mod** — not just the final value. If only the value is stored, it is impossible to tell whether the Mod is T2 or T1 for further crafting. Must store value, Mod name, and Tier separately
- **Store the Element of the item** — must store it as a separate value, not converted into a res value, because crafting must not change Element
- **Store target and attack queue** — if the player leaves the game and returns, the game must know where to resume, not restart
- **Offline time** — if present, must guard against cheating by not allowing time to advance beyond reality · Cap at **12 hours** (concept.md) · Offline results are calculated as AFK: same drops but Item quality limited to the zone floor, and no boss income (loot.md section 7) · A Circuit left running plays out the rest of its current lap on the untilted base table, then parks the character in a zone before ordinary offline idling resumes · A **plotted route** is the strict case and is never resolved while away: it is dropped and the character stays where the walk stopped, because an away period may not be routed into ambush country (`towns.md` section 7)
- **Bag filter thresholds** — must store per slot, because they determine what becomes a Reroll value stone (loot.md section 4); junk is always kept and sold at the Counterhand. Includes the list of "missing Element res" that the filter uses to keep items
- **Junk by item, and the hunting ground** — unsold junk is stored per **variant item**, because that is what the Counterhand prices and what tells the player which variants they farmed; a pre-variant save's per-rarity stack moves onto one item of its own rarity and loses no gold, since every rarity is worth the same per kill. The per-zone **hunting ground** (`zoneFocus`) is stored too: it is the sub-zone a spawn rolls inside, so a resumed run farms the same race pair and Element the player chose
- **Reroll baseline** — must store "highest value that slot ever had" separately from the current value, because the new rule is Reroll must never roll lower than before (crafting.md)
- **Craft count per item** — store `mods_added 0-2`, `refine_lv +0-15`, `protection_left 0-5`, and `broken` per piece. Add is capped at 2 fills (net counting); refine stops at +15; protection never refills except via Repair stone.

# 5 decisions (closed · referencing numbers declared in other files)

- **Where to store** — **local only**, no cloud · Reason: **no player trading** (checks.md G1) — the town stalls are NPC-only and gold never converts into stones, so there is nothing that *must* be checked against a server, and the 12-hour offline Cap cannot be verified at all without one · Gold makes this decision slightly weaker (a medium that could be duplicated), so the guard is that gold buys no power: a copied save file cannot shorten E6/E7 or beat a boss · The cross-machine solution is export/import as a player-held JSON file (item 4)
- **How many characters** — **3 slots** · Data *shared account-wide*: Mastery of all 11 weapon types · collection/dex · drop_rate gained from Mastery (equipment-weapon.md already defines it as "account-wide") · filter presets · total play time · Data *per character*: level · stats · equipped items · bag · crafting currencies · zone progress · **Reroll baselines and per-item craft counts** (if shared, it would open Refine reuse across characters, breaking the loot.md ladder). Cost paid: alt 2 does not create new Mastery (Mastery counts per weapon, not per character), so it does **not inflate drop_rate** — the funnel in loot.md F1-F5 stays fixed
- **Can it be undone** — **no in-game undo** · The reason is numeric: the Reroll rule is "never roll lower than before" (crafting.md · G4) and Reroll value stones cost 8 per attempt (E8's full-set polish is 100 casts) · If undo were allowed, players would Reroll to keep only the best value while discarding the craft cost = the stone price and the grind behind it become zero · Backups (item 5) are *only for file corruption*, and restore must count as "rewinding the whole account", not discarding the latest craft result · Per-item craft counts are already recorded (previous section), so repeated Ascend beyond the published ladder is impossible even with restore
- **Can it be moved across machines** — yes, via export/import · The file must contain *all of*: Reroll baselines · per-item craft counts · per-slot Tier · item Element · per-slot filter thresholds · gold count · visited settlements, Road links and Standing · monotonic accumulated time (item 6) · Import with a different schema version = reject, not attempt conversion → **the town layer is a schema version bump** (`towns.md` adds a medium and a progress category)
- **Automatic backup** — 3 walking snapshots · Triggers = level up / successful Ascend or Refine / every 10 minutes of play · Goal is protection against "file corruption", not against "wrong decisions" (see item 3)

- **How time is counted against cheating** — store `accumulated elapsed` per session as monotonic (device boot clock), then add real-clock deltas only for periods *greater than zero*, capped at 12 hours (concept.md) · If real-clock is detected moving backward = count as 0 hours offline, no compensation income · Offline results are calculated as AFK: same drops, but Item quality limited to the zone floor, and no boss income (loot.md section 7) → no incentive to fake time, because 12 hours of gains are only zone-floor items
- **Must store both bags** — the adventure bag's contents (gear; arrival order is display only now) and the character bag's stack counts (stones 999/slot, herbs and potions 100/slot, gold separate). There is no overflow conversion any more, so nothing is auto-lost; the filter's default medium (stone or gold) still decides what a rejected piece becomes (`loot.md` section 4 · **X34**).
- **Must store boss spawn timestamps** — bosses spawn every 15 minutes **per character**, not per zone (G5 · the per-1,000-kill rate in loot.md and checks.md F7). If the next-due spawn time is not stored, on return the player could trigger bosses too frequently until core income (8.05 per 1,000 kills · F9) overflows → full-set Ascend becomes cheaper than the designed E7 kill count

# Unresolved items

- None left under save · Remaining project questions are consolidated in checks.md group I

