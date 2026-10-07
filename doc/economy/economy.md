# Economy

import item-rarity.md
import crafting.md
import loot.md
import towns.md
import checks.md

**Revised** — door D1 was opened: **real gold exists**. Everything below is the replacement for the first draft's "no gold · no NPC shops · no player trading" answer. Trading and selling-between-players stay closed; the crafting-stone engine stays untouched.

# Two media, strictly separated

| Medium | What it is | Mints from | Buys | Must never buy |
|---|---|---|---|---|
| **7 stones** | the power medium | junk that dissolves · elites · bosses (loot.md section 5) | Reroll · Refine · Ascend · Add · Remove · Upgrade · Repair · Corrupt | convenience, storage, cosmetics |
| **Gold** | the quality-of-life medium | **mob junk sold at the Counterhand** (the only mint, Ragnarok-style · `loot.md` section 4) | space · time · information · appearance | gear · Mods · potions · stones · anything that drops for free |

**Gold has one mint.** Mob junk sold at the Counterhand. Task payouts stay in stones (`tasks.md`), Collector turn-ins pay the item itself, and walking pays a kill's ordinary drop roll and nothing else (`towns.md` section 7) — a second mint would be a second faucet on the same medium.

**Single-medium rule** — every source pays **exactly one** medium, and the player picks which one at the moment the piece would be converted. No source pays both. **No gold↔stone conversion exists anywhere** (no exchange rate = no arbitrage = no path from gold into power).

# The 3 original questions, now answered

1. **Where does gold come from** — from a *clock*, but one the same drops already set: **mob junk** (Ragnarok-style, `loot.md` section 4) drops on a separate roll and is sold at the Counterhand. Gear the filter rejects dissolves for 1 Reroll value stone, not gold, so the two media mint from different items and never compete for one piece.
   Why this is not the "gold is a DPS multiplier" trap the first draft warned about: junk drops scale with kills exactly as gear drops do, so killing faster raises both media together — it does not create a gold-only faucet. And because gold buys no power, DPS cannot be laundered into power through gold; it can only be converted into convenience. The power bottleneck stays where it was (Reroll tier / Add mod stones, elite 1-in-5 and boss 0.0068 per kill — F7-F10).
2. **Is there a shop** — yes, and it now obeys the condition this file set back then: it sells what never drops. Nine settlements × differentiated NPC stalls, inventory in `towns.md` sections 4-5.
3. **Is there player-to-player selling** — still **no**. Reasons unchanged: no server (save.md), no time to stay listed, and with gold in the game a player-to-player market would be the one leak that turns gold into power.

# Gold supply (derived, no new income invented)

```
gold per junk piece sold             = 1
mob junk per kill (high zone, no Lck) = 0.136    (a flat expected gold per kill; rarity sets the price, not the income)
max gold per kill                    = 0.136    (the junk line, per kill — never a rate)
opportunity cost of 1 gold           = 1 Reroll value stone forgone ≈ 59 kills of Reroll capacity
full-Lck ceiling (F2 0.428 drops per kill) = ~0.423 gold per kill
```

- These four lines are **computed, not typed**: `tools/data/engine.json` → `tools/lib/engine.ts` → `node tools/check.ts --checks` (rows X5-X8) and `node tools/town.ts --checks` (T2-T7). Changing a drop rate therefore moves the gold prices in `towns-stalls.md` automatically.

- Every price in this project is therefore written in **gold**, charged at the band of the place that sells it — never in minutes (`DECISIONS.md` D12). A 210 gold item is that many kills' worth of junk at that band, and the Reroll progress it forgoes is the same count.
- Junk is kept by the filter automatically and sold manually at the Counterhand, so the crafting engine (E6/E7/E8, the counts those rows state) keeps its designed stone income while gold tracks the same kill count.
- Accepted imbalance: an Lck build mints up to ×3.11 more gold per kill. Legal **only while** gold has no power sink. Guard row: checks.md G8.

# Why gold must have repeatable sinks

Most town purchases are one-time (stash tab, house, deed, pouch tier), so gold demand would die inside the level-100 run's last stretch. The sink list must therefore contain *repeatable* lines, and only these kinds:

| Repeatable sink | What it costs | Why it is safe |
|---|---|---|
| Armourer repair service | gold per Broken piece | replaces a Repair stone the player would otherwise earn from elites/bosses → time-for-gold, never new power |
| Guild clerk task skip | gold, ≤ 1 per slot per day | bounded by the tasks.md income rule |
| Curio pedlar rotation | gold, 3 slots per real day | appearance and convenience only |
| Titles, banners, Base tints | gold, large | pure cosmetic — the only place gold is allowed to be *expensive* |

# Closed

- **Is there money** — yes, gold, minted by mob junk sold at the Counterhand and nothing else (checks.md G6).
- **Is there a shop** — yes, NPC stalls per settlement, convenience/services/cosmetics only (`towns.md`).
- **Is there player selling/trading** — no.
- **Do stones still price the shop** — no. Convenience moved to gold so the two media never compete for the same purchase; crafting keeps all seven stones.

# Open

- **Exact price per line — closed**: every stall line is priced in **gold** at the band of the place that sells it, in `towns-stalls.md` sections 3-4, generated from `tools/data/town.json` and caged as `checks.md` group T. F9/F13 still move two of those rows (`towns-stalls.md` section 9).
- **Whether Collector turn-ins pay gold or the item directly — closed**: the item only, never gold, so gold keeps its single mint (`checks.md` G6 · T14).
- **Whether walking pays gold — closed**: no. An ambush on a block is an ordinary mob group that rolls the ordinary drop, so a walk mints nothing at all: no gold, no Standing, no stone (`towns.md` section 7 · `checks.md` X36).
- **Whether gold carries over across the 3 character slots — closed**: no, per character. `save.md` lists gold among the per-character fields (level · stats · bag · currencies · zone progress), while only Mastery · dex · drop_rate · filter presets · play time are account-wide — so Standing, settlements and gold all read per character.

All four questions this file raised are now answered; nothing here is left open.

(End of file)
