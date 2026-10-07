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
MAP
  ├─ Select any settlement or zone from the hex sheet or the place list
  ├─ TOWN detail (the selected settlement's services, stock, Standing, tasks, stash and bench)
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
  ├─ ZONE detail (levels · mob_HP · quality · Elements · sub-zones · choose where to hunt)
  ├─ GUILD BOARD (the task slots of `tasks.md`)
  └─ ROAD (opt-in) (walk a link · plot a route · set a Circuit · Road events)
```

Default path per session, which is the `concept.md` core loop with place names: open the Map at the current settlement → Counterhand (sell or dissolve) → one stall or the board → select the hunting zone. Warping to another settlement is available from the same Map. Nothing on this path is required, and nothing takes a click away from fighting.

# 2. Map Page

| Block | What is shown | Source |
|---|---|---|
| Node list | all nine settlements, fixed order by zone, never reordered | `towns.md` section 4 |
| Node badge | capital tier (low / mid / high) or town | `towns-stalls.md` section 5 |
| Node line | `Zone 6 · levels 51-60 · mid quality ceiling` | `world.md` zone table |
| Element line | the zone's one or two common innate Elements | `world.md` · `elements.md` |
| Waypoint state | `linked (free)` · `unlinked — carriage 138 g (196.3 k)` · `never visited` | `towns-stalls.md` sections 3-4 |
| Standing line | `Bonegate · Tier II · 6,750 / 12,600 kills` with a progress bar | `towns-stalls.md` section 6 |
| Current zone marker | where the character is fighting now | `save.md` progress row |
| Road links | each link with its terrain, its block count, and whether it pays a purse | the Road's own section in `towns.md` |
| Terrain tilt | the link's ambush / caravan / pedlar / chest weights, shown before the route is chosen | `road.terrain` |
| Blocks | the block a link is walked in, one per `road.walk.block_sec` of ground, counted in the HUD and the Road panel rather than drawn on the sheet | `engine.json` `road.walk` · **M15** |
| Route | the settlement a click walks to, with its link count, block count and encounter count | `road.walk.route_rule` |
| Circuit | the ordered links of the loop, editable **only** on this page while standing in a settlement | `save.md` Road state |
| Road preview | shown **before** stepping onto a Road, see section 9 | `towns.md` section 7 |
| Place detail | the selected settlement's town services or its attached zone, switched in place beside the map | `towns.md` · `world.md` |
| Town actions | stock, respec, Standing, tasks, stash, crafting, Collector and Road controls; actions are enabled at the settlement the character occupies | `towns.md` · `towns-stalls.md` |
| Zone actions | zone facts, named sub-zones, and the action to hunt an opened zone; an unopened zone can be walked to, opening it | `world.md` · `towns.md` |

**Two layers, both vector.** The backdrop is a hand-drawn file in `art/svg/map/map-terrain.svg` — the off-field grey and the paper the field is cut out of (a map is a different scale and a different style from the icon libraries, so it reuses neither). The field itself is a generated overlay written by `node tools/map.ts --write` from `tools/data/map.json`: a pointy-top hex lattice where **a settlement is a cluster of hexes — its own plus one per sub-zone**, so every place the player can fight in owns a block of its own and is named inside it, and **every other hex is tinted and registered to its nearest settlement**, so the whole lattice is the clickable travel map rather than a picture. Biome tones and the named regions come from the same writer.

**The sheet is drawn as names only — there is not one dot on it.** A settlement's name floats above its cluster and each sub-zone is named inside the hex it owns; nothing else is marked. No settlement pin, no landmark mark, no terrain wash, no river band, no framing grid and no route layer, so the ground walked between two places is never drawn and a block's progress is counted in the HUD and the Road panel instead. Both layers are inlined into the page as SVG markup, never loaded as an `<img>` and never given a raster filter, so the sheet stays sharp at every zoom level. The sheet spirals outward from its centre, so the starting capital sits in the middle and the level bands climb toward the rim. **Node coordinates are presentation only**: the simulation reads node, link and block ids and nothing else, which the map cage's **M7** and **M9** enforce — M9 counts the settlement names and sub-zone names the overlay carries and fails on any circle. Fog extends the same rule to art — terrain is always drawn, node detail is not.

- Unvisited nodes are shown **by name with no detail** — the map never hides that a place exists, it only hides what it sells.
- A capital node whose level range the player has not reached is drawn greyed with its real requirement (`Level 51-60`), never removed: zone unlock is by level only (`world.md`).

**One click, one journey.** The sheet is one delegated click handler that reads the `data-node` off the hexagon that was clicked — a settlement's own id, or the nearest one for open ground — so a click never needs a coordinate. A sub-zone hexagon selects that ground for its own zone: the zone the character stands in hunts it at once, and one elsewhere is walked to with the ground already chosen, so the walk arrives on the hexagon that was clicked. Every other hexagon is walked to: the shortest chain of links to its settlement is laid down as a route and walked link by link, and the HUD names the link and counts the block being crossed. Clicking the settlement the character already stands in opens its services instead of a journey, because there is nowhere to walk. The Circuit editor sits under both, because a Circuit is a route with the loop set.

# 3. Stall Page — one template for every NPC

```
Armourer · Ironrow                        gold 1,204 · 8,978 k of selling
Tier II reached · next: Tier III 4,266 kills
────────────────────────────────────────────────────────────────────────────
Repair one piece            83 g · 117.8 k [repeatable]        protection 2/5 → 5/5
Stash tab 1                414 g · 589 k   [owned ✓]
Road link (Wolf Cross)      84 g · 196.3 k [buy]
────────────────────────────────────────────────────────────────────────────
```

| Row state | Display | Rule |
|---|---|---|
| affordable, not owned | `gold · k` + `[buy]` | one-time lines confirm once, then go grey forever |
| owned (one-time) | greyed, `owned ✓` | never re-sellable, never refundable |
| locked by Standing | `Tier II · 1,323 kills to unlock` + lock icon | Standing gates stock, never stats |
| gold shortfall | price in red + `dissolving this instead costs 60 Reroll casts` | the honest alternative, `checks.md` T6 |
| repeatable cap reached | `3 / 3 today · resets in 41 min` | skip tokens · pedlar slots |
| no such line here | row absent | stock is per settlement (`towns-stalls.md` section 5) |

- **Every price is shown twice**: gold (what is charged) then `k` kills (what it really costs). The unit is the point — see `towns-stalls.md` section 1.
- Kind tag on every row: space · time · information · appearance. A row with no tag must not ship (T8).
- No stall anywhere shows a stone price (`checks.md` G1), a gear price, or a "power gained" line.

# 4. Counterhand — the sell / dissolve screen

The filter decides keep-or-reject per slot (`loot.md` section 4) and ships **off**, so this page also **arms** a slot; once armed it makes that decision legible and lets the player pick the **medium** per rule.

```
Slot: chest                          keep if: quality > equipped  OR  res I lack
reject →  [ dissolve · 1 Reroll value stone ]   ( sell · 1 gold )     ← one only
your rules convert ~360 pieces per 1,000 kills here → 360 stones  ·  or 360 gold  ·  never both
```

| Element | Rule |
|---|---|
| Default | **filter off** on every new slot — a fresh character keeps everything until the player arms a slot; an armed slot then **dissolves**, so the crafting engine keeps its designed 134.1 stones per 1,000 kills |
| Medium choice | per slot, stored per character (`save.md`) |
| Warning | switching a slot to sell shows the forgone Reroll capacity: 1 gold = 1 stone = 1/80 of a full-set polish (`checks.md` T6) |
| Preset slots | 3 by default, one extra per purchase (`towns-stalls.md` section 3) · preset switching is a reason-to-open (`concept.md`) |
| Herb line | herbs never dissolve (`loot.md` section 4), so the sell switch is absent for them |
| Map knowledge | the Counterhand also prints the settlement's filter tip at Tier III — information, never a stat |

# 5. Guild Board

| Block | Content |
|---|---|
| Slots | three · an empty slot offers a new task immediately · a finished or skipped slot refills after 1 hour (`tasks.md`) |
| Task card | type (Hunt · Elite hunt · Boss) · zone · progress `148 / 300 kills` · reward **in stones only** |
| AFK line | each card states whether progress runs while AFK (Boss never does) |
| Skip | free skip `1 / slot / day` · bought skip `55 g · 78.5 k` · cap `3 / day` shown as `0 / 3 bought today` |
| Pool gate | only zones at or below the player zone |
| Never shown | a gold payout — tasks pay stones, gold's mints are the filter and Road events (`checks.md` G6) |

# 6. Collector

```
Reliquary · heavy school · Bonegate        (Tier II ✓ required)
  Sallet   [✓ 1 held]   Plate Vest   [ 2 rejected pieces needed ]   Cuisses [✓ 1 held]
  reward: 1 stash tab (once per character) · pieces are consumed · no gold
```

- The panel lists **which school** the set wants and ticks pieces held; the hint line (147.25 k) prints the same list for players who want it before Tier II.
- Reliquary requires **filter-rejected** pieces, so the panel reads the reject flag, not just the inventory — otherwise the sink competes with keep decisions (`towns-stalls.md` section 7).
- Payment is the item itself. There is no "collect for gold" state anywhere (T14).
- Progress is per character, stored in the `save.md` town row.

# 7. Curio pedlar

| Element | Display |
|---|---|
| Slots | exactly 3, refreshing per **real day** (not the 12-hour offline clock) |
| Card | name · kind tag `appearance` · `207-828 g · 294.5-1178 k` · sold-out state |
| Refresh timer | `stock changes in 6 h 12 m` |
| Titles | the prestige line shows `2,070 g · 2,945 k` with no discount ever — the one place gold is allowed to be expensive |
| Never | a Mod, a frame, a stone, or a "chance at" mechanic |

# 8. Standing panel

Shown on the map node and in every stall header of that settlement.

```
Bonegate · Tier II
6,750 / 12,600 kills   ▓▓▓▓▓▓▓▓░░░░  54%
earned: 6,110 zone kills · 520 tasks · 40 boss kills
next unlocks: Collector set slots · nothing else
```

- The bar counts **kills**, matching how the thresholds are defined (`towns-stalls.md` section 6 · F1 589 kills a band at the high band).
- Sources are itemised so the player sees that tasks and bosses are extra progress on the same bar, never a separate currency.
- Standing is never spendable, never shared across the 3 character slots (`save.md`), and the panel states what the next tier unlocks in the words of section 6: stock, set slots, map knowledge, presets, titles.
- Tier III exceeding the zone's own budget is displayed as a **chase** (`12,600 / 9,000 budget`), never as a bug.

# 9. Road and Waypoint dialogs

| Action | Dialog must state |
|---|---|
| Link a Road (carriage) | `138 g · 196.3 k · one-time` · "after this, travel is free and instant" · this is the checkpoint's price and the only thing that skips ground |
| Walk the Road (mode C) | the link's own block count and `road.walk.block_sec` · `forfeits ≈ 49 kills of hunting` · `pays Standing + gold, no stones` · confirm required |
| Plot a route | the settlement, its link count, its block count and its encounter count, before the route is committed — plotting draws the path, it never jumps it |
| Set a Circuit | the ordered links, the terrain of each, and the same two units a stall price uses · editable only here, never mid-leg |
| Road event (mode D) | what it pays, in the same two units as a stall price · never a stone · a chest is capped once per link per day |
| Push mid-walk | `skips the rest of this leg · the walk carries on` — never "forfeit" while a route or Circuit still has a leg left |
| Re-anchor Waypoint | `41 g · 58.9 k` · cosmetic, no zone ever gates on it |
| Game closed mid-Road | a Circuit plays the rest of that lap out on the base table and the character is parked in a zone; a **plotted route is dropped**, because an away period may never be routed into ambush country (`towns.md`) — the UI never shows a character as "travelling" |

The forfeit line is mandatory text: the Road is a content choice, and the screen has to say so in numbers before the player commits (G9).

# 10. Should Not Show

| Value | Reason |
|---|---|
| drops per kill → junk per kill arithmetic | the player reads `k`; the derivation lives in the tool |
| any gold↔stone rate | none exists (`economy.md` single-medium rule) |
| lifetime supply / demand ratio | design-side accounting (`checks.md` T3-T5), not a screen |
| a projected power gain from any purchase | there is none to project (G7) |
| internal NPC ids, ladder ids, band keys | spec vocabulary, not UI text |
| another character's gold or Standing | per character slot (`save.md`) |

# 11. Display Rules to Follow

- Price text is always `gold · k`, gold first: `1,656 g · 2,356 k`.
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
3. Road event UI is a placeholder card — the **payout is already sized** (`road.purse_gold` per link per day = `road.purseCapPerDay` gold a day at most, `road.standing_per_trip_kills` kill-equivalents a trip, no stones · `checks.md` X36); only the card layout remains, no number is missing.
4. **The walk's card is the one screen that is still copy-light** — the map sheet states the block count and the encounter count without drawing the blocks, so a block carries no name on the sheet at all, and the Road event card is still the placeholder from the item above. Both are card-layout work now that `road.walk` owns the numbers.

(End of file)
