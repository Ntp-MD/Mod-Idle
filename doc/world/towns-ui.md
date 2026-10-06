# Towns UI

import towns.md
import towns-stalls.md
import character-sheet.md
import glossary.md
import tasks.md
import combat.md
import save.md
import checks.md

What the settlement screens show, in the same form as `character-sheet.md`: every value on screen is read from a generated table, never computed by the UI. Prices, stock, rosters and Standing kill thresholds come from `towns-stalls.md`, sections one through nine (`node tools/town.ts --write`), so a screen and a spec table cannot disagree.

**One line** — a settlement screen sells space · time · information · appearance. Any row that would read like power is a spec bug (`checks.md` G7 · T8), not a UI case.

# 1. Screen Map

```
Zone screen
  └─ Push → Camp (= the settlement that owns the zone)
       └─ SETTLEMENT
            ├─ MAP page            (Waypoint network · Road travel · Standing summary)
            ├─ STALL page          (one template, one NPC per visit)
            │    ├─ Counterhand    (sell / dissolve filter rules)
            │    ├─ Porter         (stash tabs · pouches · bag slots)
            │    ├─ Steward        (houses · plot deeds)          [capitals]
            │    ├─ Guild clerk    (task skip tokens)             [capitals]
            │    ├─ Armourer       (repair service)
            │    ├─ Waypoint keeper(link a Road · re-anchor)
            │    ├─ Collector      (set turn-in)                  [Ashfall · Bonegate · Vermolch]
            │    ├─ Curio pedlar   (rotating cosmetics)           [Highspire · Vermolch]
            │    ├─ Herbalist      (plot upgrades · pouch tiers)  [Millbrook · capitals]
            │    └─ Furrier        (bag slots · settlement banner)[Wolf Cross]
            ├─ GUILD BOARD         (the three task slots of `tasks.md`)
            └─ ROAD (opt-in)       (walk a link · set a Circuit · Road events)
```

Default path per session, which is the `concept.md` core loop with place names: arrive by Waypoint (no click of cost) → Counterhand (sell or dissolve) → one stall or the board → Waypoint to the zone. Nothing on this path is required, and nothing takes a click away from fighting.

# 2. Map Page

| Block | What is shown | Source |
|---|---|---|
| Node list | all nine settlements, fixed order by zone, never reordered | `towns.md` section 4 |
| Node badge | capital tier (low / mid / high) or town | `towns-stalls.md` section 5 |
| Node line | `Zone 6 · levels 51-60 · mid quality ceiling` | `world.md` zone table |
| Element line | the zone's one or two common innate Elements | `world.md` · `elements.md` |
| Waypoint state | `linked (free)` · `unlinked — carriage 138 g (20 m)` · `never visited` | `towns-stalls.md` sections 3-4 |
| Standing line | `Bonegate · Tier II · 6,750 / 12,600 kills` with a progress bar | `towns-stalls.md` section 6 |
| Current zone marker | where the character is fighting now | `save.md` progress row |
| Road links | each link with its terrain, trip length, and whether it pays a purse | `towns.md` section 7 |
| Terrain tilt | the link's ambush / caravan / pedlar / chest weights, shown before the route is chosen | `towns.md` section 7 |
| Circuit | the ordered links of the loop, editable **only** on this page while standing in a settlement | `save.md` Road state |
| Road preview | shown **before** stepping onto a Road, see section 9 | `towns.md` section 7 |

**Two layers.** The terrain background is a hand-drawn file in `art/svg/ui-map-terrain.svg` (a map is a different scale and a different style from the icon libraries, so it reuses neither). Nodes, link paths, terrain glyphs and the travel marker are a generated overlay written by `node tools/map.ts --write` from `tools/data/map.json`. **Node coordinates are presentation only**: the simulation reads node and link ids and nothing else, which the map cage's **M7** enforces. Fog extends the same rule to art — terrain is always drawn, node detail is not.

- Unvisited nodes are shown **by name with no detail** — the map never hides that a place exists, it only hides what it sells.
- A capital node whose level range the player has not reached is drawn greyed with its real requirement (`Level 51-60`), never removed: zone unlock is by level only (`world.md`).

# 3. Stall Page — one template for every NPC

```
Armourer · Ironrow                        gold 1,204 · 6 h 12 m of selling
Tier II reached · next: Tier III 4,266 kills
────────────────────────────────────────────────────────────────────────────
Repair one piece            83 g · 12 m   [repeatable]        protection 2/5 → 5/5
Stash tab 1                414 g · 60 m   [owned ✓]
Road link (Wolf Cross)      84 g · 20 m   [buy]
────────────────────────────────────────────────────────────────────────────
```

| Row state | Display | Rule |
|---|---|---|
| affordable, not owned | `gold · m` + `[buy]` | one-time lines confirm once, then go grey forever |
| owned (one-time) | greyed, `owned ✓` | never re-sellable, never refundable |
| locked by Standing | `Tier II · 1,323 kills to unlock` + lock icon | Standing gates stock, never stats |
| gold shortfall | price in red + `dissolving this instead costs 60 Reroll casts` | the honest alternative, `checks.md` T6 |
| repeatable cap reached | `3 / 3 today · resets in 41 min` | skip tokens · pedlar slots |
| no such line here | row absent | stock is per settlement (`towns-stalls.md` section 5) |

- **Every price is shown twice**: gold (what is charged) then `m` (what it really costs). The unit is the point — see `towns-stalls.md` section 1.
- Kind tag on every row: space · time · information · appearance. A row with no tag must not ship (T8).
- No stall anywhere shows a stone price (`checks.md` G1), a gear price, or a "power gained" line.

# 4. Counterhand — the sell / dissolve screen

The filter decides keep-or-reject per slot (`loot.md` section 4) and ships **off**, so this page also **arms** a slot; once armed it makes that decision legible and lets the player pick the **medium** per rule.

```
Slot: chest                          keep if: quality > equipped  OR  res I lack
reject →  [ dissolve · 1 Reroll value stone ]   ( sell · 1 gold )     ← one only
your rules convert ~212 pieces/hour here → 212 stones  ·  or 212 gold  ·  never both
```

| Element | Rule |
|---|---|
| Default | **filter off** on every new slot — a fresh character keeps everything until the player arms a slot; an armed slot then **dissolves**, so the crafting engine keeps its designed 416 stones/hour |
| Medium choice | per slot, stored per character (`save.md`) |
| Warning | switching a slot to sell shows the forgone Reroll capacity: 1 gold = 1 stone = 1/52 hour of Reroll (`checks.md` T6) |
| Preset slots | 3 by default, one extra per purchase (`towns-stalls.md` section 3) · preset switching is a reason-to-open (`concept.md`) |
| Herb line | herbs never dissolve (`loot.md` section 4), so the sell switch is absent for them |
| Map knowledge | the Counterhand also prints the settlement's filter tip at Tier III — information, never a stat |

# 5. Guild Board

| Block | Content |
|---|---|
| Slots | three · an empty slot offers a new task immediately · a finished or skipped slot refills after 1 hour (`tasks.md`) |
| Task card | type (Hunt · Elite hunt · Boss) · zone · progress `148 / 300 kills` · reward **in stones only** |
| AFK line | each card states whether progress runs while AFK (Boss never does) |
| Skip | free skip `1 / slot / day` · bought skip `55 g · 8 m` · cap `3 / day` shown as `0 / 3 bought today` |
| Pool gate | only zones at or below the player zone |
| Never shown | a gold payout — tasks pay stones, gold's mints are the filter and Road events (`checks.md` G6) |

# 6. Collector

```
Reliquary · heavy school · Bonegate        (Tier II ✓ required)
  Sallet   [✓ 1 held]   Plate Vest   [ 2 rejected pieces needed ]   Cuisses [✓ 1 held]
  reward: 1 stash tab (once per character) · pieces are consumed · no gold
```

- The panel lists **which school** the set wants and ticks pieces held; the hint line (15 m) prints the same list for players who want it before Tier II.
- Reliquary requires **filter-rejected** pieces, so the panel reads the reject flag, not just the inventory — otherwise the sink competes with keep decisions (`towns-stalls.md` section 7).
- Payment is the item itself. There is no "collect for gold" state anywhere (T14).
- Progress is per character, stored in the `save.md` town row.

# 7. Curio pedlar

| Element | Display |
|---|---|
| Slots | exactly 3, refreshing per **real day** (not the 12-hour offline clock) |
| Card | name · kind tag `appearance` · `207-828 g · 30-120 m` · sold-out state |
| Refresh timer | `stock changes in 6 h 12 m` |
| Titles | the prestige line shows `2,070 g · 300 m` with no discount ever — the one place gold is allowed to be expensive |
| Never | a Mod, a frame, a stone, or a "chance at" mechanic |

# 8. Standing panel

Shown on the map node and in every stall header of that settlement.

```
Bonegate · Tier II
6,750 / 12,600 kills   ▓▓▓▓▓▓▓▓░░░░  54%
earned: 6,110 zone kills · 520 tasks · 40 boss kills
next unlocks: Collector set slots · nothing else
```

- The bar counts **kills**, matching how the thresholds are defined (`towns-stalls.md` section 6 · F1 1,800 kills/hr high band).
- Sources are itemised so the player sees that tasks and bosses are extra progress on the same bar, never a separate currency.
- Standing is never spendable, never shared across the 3 character slots (`save.md`), and the panel states what the next tier unlocks in the words of section 6: stock, set slots, map knowledge, presets, titles.
- Tier III exceeding the zone's own budget is displayed as a **chase** (`12,600 / 9,000 budget`), never as a bug.

# 9. Road and Waypoint dialogs

| Action | Dialog must state |
|---|---|
| Link a Road (carriage) | `138 g · 20 m · one-time` · "after this, travel is free and instant" |
| Walk the Road (mode C) | `5 min (ladder) / 8–12 min (branch)` · `forfeits ≈ 120 kills at 1,800/hr` · `pays Standing + gold, no stones` · confirm required |
| Set a Circuit | the ordered links, the terrain of each, and the same two units a stall price uses · editable only here, never mid-leg |
| Road event (mode D) | what it pays, in the same two units as a stall price · never a stone · a chest is capped once per link per day |
| Push mid-Circuit | `skips the rest of this leg · the Circuit carries on` — never "forfeit" while a Circuit runs |
| Re-anchor Waypoint | `41 g · 6 m` · cosmetic, no zone ever gates on it |
| Game closed mid-Road | the rest of the lap plays out on the base table, then the character is parked in a zone (`towns.md` section 7) — the UI never shows a character as "travelling" |

The forfeit line is mandatory text: the Road is a content choice, and the screen has to say so in numbers before the player commits (G9).

# 10. Should Not Show

| Value | Reason |
|---|---|
| drops/hour → junk/hour arithmetic | the player reads `m`; the derivation lives in the tool |
| any gold↔stone rate | none exists (`economy.md` single-medium rule) |
| lifetime supply / demand ratio | design-side accounting (`checks.md` T3-T5), not a screen |
| a projected power gain from any purchase | there is none to project (G7) |
| internal NPC ids, ladder ids, band keys | spec vocabulary, not UI text |
| another character's gold or Standing | per character slot (`save.md`) |

# 11. Display Rules to Follow

- Price text is always `gold · m`, gold first: `1,656 g · 240 m`.
- At most 1 decimal place, rounded down (same rule as `character-sheet.md`).
- Thousands separators everywhere, including kill thresholds (`12,600 kills`).
- Kind tag on every purchasable row, from the fixed four: space · time · information · appearance.
- Capped lines show `value / cap` (`protection 2/5` · `skips bought 3/3 today` · `pedlar 1/3` · `stash tabs 6/6`).
- Locked content is shown locked, with its real threshold; nothing is hidden to avoid tempting the player.
- Greyed ≠ absent: an owned one-time purchase stays visible as `owned ✓` so the ladder reads as a ladder.
- Colour never carries meaning alone — a lock, a tick and a tag always accompany it.

# 12. Still Missing

The three below are UI-layout or copy tasks, not design gaps.

1. Whether capitals are teased on the map before their level requirement (`towns.md` section 10) — **owner decision, a UI preference**: no mechanic number depends on it, so it can be settled when the map screen is built.
2. Pedlar refresh wording when the player returns after 20 days — one copy line, not a mechanism (the refresh rule itself is set: per real day, `checks.md` group T).
3. Road event UI is a placeholder card — the **payout is already sized** (purse 3 gold/link/day = a 24 gold/day ceiling, Standing 15/trip, no stones · `checks.md` X36); only the card layout remains, no number is missing.

(End of file)
