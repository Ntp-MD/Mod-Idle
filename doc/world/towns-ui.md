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

# 0. HUD — what each part is called

The field is one frame of always-on reads. These are the names for the parts of that frame; use them when a change is asked for, so a part is never described twice and two parts never share a word. The right column is the hook to open.

| Part | Where it sits | What it is | In the code |
|---|---|---|---|
| **frame** | the whole screen, right of the rail | the dark ground the reads are pinned to, with its vignette | `.stage` |
| **map sheet** | behind the frame | the one generated sheet — the ground a place is picked and walked on | `.map-back` · `art/svg/map/map-overlay.svg` |
| **zone nameplate** | top-centre of the frame, behind every read | the zone's own name, set as a quiet banner | `.arena` |
| **dock** | top-left column | the character's own reads, and the overlays that hang from them | `.dock` |
| **vitals** | inside the dock | the level chip and the gauges | `.vitals` |
| **level chip** | the round face left of the gauges | the level, and the way into the allocate panel | `.face` |
| **gauges** | beside the chip | shield · HP · mana · XP, then the status line and the attack-speed read | `.gauge` |
| **sheet knob** | end of the cast order | the round button that opens the character sheet | `.knob` |
| **pop panel** | under the vitals | the overlay a dock read opens in — the map focus, the allocate panel, the character sheet | `.pop` |
| **pockets** | top-right | what the hunt is worth: gold · stones · clock, and a note when one is due | `.pockets` |
| **pocket pill** | inside the pockets | one of those reads | `.pill` |
| **tracker** | right edge, under the pockets | where the character stands and what it aims at | `.tracker` |
| **phase line** | top of the tracker | fighting or pushed, and the weapon read | `.phase` |
| **travel switch** | inside the tracker | stay here / climb forward | `.travel` |
| **alarm line** | inside the tracker | the one thing that must be answered now | `.alarm-line` |
| **objective line** | bottom of the tracker | what the gate figure is measured against | `.objective` |
| **mob field** | middle of the frame | one plate per mob in the group | `.field` |
| **mob plate** | inside the mob field | portrait · name · body · HP bar · chips · element list · curses | `.mob` |
| **destination card** | above the cast order | the picked cell's card: route · walk · warp · hunt · desk | `.mapcard` · `ui/TravelCard.svelte` |
| **cast order** | bottom-centre | what the game presses next, one slot per skill, and the round screens at its end | `.actionbar` · `.knob` |
| **chronicle** | bottom-left | the log, growing upward from the edge | `.chronicle` |
| **corner controls** | bottom-right | pause · one tick · new character | `.controls` |
| **welcome-back toast** | top-centre, under the nameplate | the away report, once, after an idle stretch | `.toast` |
| **rail** | right edge column | the menu: one tab per screen, field first | `.rail` |
| **rail tab** | inside the rail | the way to one screen, or back to the field | `.tab` |
| **sub-screen** | over the frame | a screen the rail or a round screen opens (bag · skills · tree · map · desk · stash · bench · farm · save) | `ui/Panel.svelte` |

- **The field is the whole screen; the mob field is the middle of it.** A mob stands on a plate inside the mob field. The zone's own word, **nameplate**, is the banner on the top edge, so the frame's middle stays the group's.
- **"The sheet" is always the map.** It is the generated sheet behind the frame. The character sheet is spelled in full — it is the pop panel the sheet knob opens, and `character-sheet.md` owns it.
- **The round screens sit at the end of the cast order** — skills, bag and sheet, the three a hunt reaches for without leaving the field. They carry no slot number, the bag's own count rides on its button, and the rail no longer holds a bag or a skills tab: a screen reached from the field is not also a tab.
- **Map focus is not a modal.** It is the map sheet brought out from under the HUD, with the mob field taken off the screen and the chronicle stepped back; the fight runs on behind it. The sheet is panned by dragging it and zoomed by scrolling, both in map focus only, and the map focus panel's tools carry **zoom out**, **zoom in**, **centre** (the settlement you stand in) and **reset**.
- **The frame never moves; the ground slides inside it.** The ground is the field's own lattice, drawn on far past the field, so panning runs on well beyond the field and reads as endless — and it is only pretending: past the ground's own edge there is nothing, so the pan stops there, kept half a frame short of it so the edge is never on screen. The zoom runs from a quarter to three times, and **reset** puts it back on the frame's own footing.
- **The sheet's own marks keep their generated names** — a **cell**, a **settlement mark**, a **zone label**, a **region name**, a **landmark mark**, the **walk graph** labelled in blocks, the **travel pin** and the **cell ids**. Its **views** are terrain, level band and level gate, with **the key** printed under them.

# 1. Screen Map

```
The field (the one screen that is always up)
  ├─ THE MAP                     (the ground the HUD stands on · dimmed until the pointer reaches)
  │    ├─ MAP FOCUS              (the MAP tab · the sheet sharp under the HUD · its three views, the walk graph, the cell ids and the key, floating under the vitals · the mob field off the screen · drag to pan, scroll to zoom)
  │    ├─ PICK                   (a cell, a settlement's mark, the arrows over the settlement list)
  │    └─ DESTINATION CARD       (the plotted route · walk · Waypoint · hunt this zone · the desk)
  └─ Push → Camp (= the settlement that owns the zone)
       └─ SETTLEMENT — the DESK sub-screen, opened from the rail or from a place's card
            ├─ SETTLEMENT BLOCK    (the desk of whichever settlement the pick rests on)
            │    ├─ Counterhand    (sell junk · the gold mint)
            │    ├─ Respec         (stat points · tree points, free)
            │    ├─ Standing       (tier · share of the zone kill budget)
            │    ├─ Stall stock    (one template, one NPC per line — sections 3 and 4 below)
            │    │    ├─ Porter     (stash tabs · pouches · bag slots)
            │    │    ├─ Steward    (houses · plot deeds)          [capitals]
            │    │    ├─ Guild clerk (task skip tokens)            [capitals]
            │    │    ├─ Armourer   (repair service)
            │    │    ├─ Waypoint keeper (opens this settlement's Waypoint)
            │    │    ├─ Collector  (set turn-in)                  [Ashfall · Bonegate · Vermolch]
            │    │    ├─ Curio pedlar (rotating cosmetics)         [Highspire · Vermolch]
            │    │    ├─ Herbalist  (plot upgrades · pouch tiers)  [Millbrook · capitals]
            │    │    └─ Furrier    (bag slots · settlement banner)[Wolf Cross]
            │    └─ Guild board    (the three task slots of `tasks.md`)
            ├─ HUNT TABLE          (every zone: levels · mob_HP · quality · Elements · group · sub-zones)
            └─ WALK TABLE          (pick a settlement · cross its blocks · a Waypoint opens on arrival)
```

The field's own background is the map — one generated sheet, painted once, and the only map in the game. It lies behind the HUD dimmed and out of focus, sharpens to the pointer, and the MAP tab brings it fully out from under the HUD: the sheet at full colour, its views and its key floating on the edge the vitals use, the mob field off the screen and the log stepped back, the fight still running behind it. A click picks the cell, the destination card rises above the cast order, and the walk or the warp is taken from there. **No part of travelling a place needs a modal.** The DESK sub-screen is what the map never was: the counter, the stall, the board and the two tables for whichever settlement the pick rests on — opened from the rail, or from the card's own verb.

There is no separate Zones page and no separate Town page: the field is how a place is found, the hunt table is how a zone is named, and the desk is how a settlement is used. A panel that repeats the same list of places is a second place for the same truth.

Default path per session, which is the `concept.md` core loop with place names: arrive by Waypoint (no click of cost) → Counterhand (sell or dissolve) → one stall or the board → Waypoint to the zone. Nothing on this path is required, and nothing takes a click away from fighting.

# 2. Map Page

| Block | What is shown | Source |
|---|---|---|
| Field | every cell of the hex field — one click target per settlement, per named sub-zone and per wild side | `towns.md` section 4 |
| Cell label | the zone's own name and its level band, printed inside the cell that owns it | `world.md` zone table |
| Destination card | the picked cell, what kind of place it is, its zone, band and capital tier | `towns.md` section 7 |
| Route line | `3 blocks, plotted cell by cell · 30s at 10s a block · an ambush chance per block` | `towns.md` section 7 |
| Settlement block | the desk of the picked settlement: Counterhand · Respec · Standing · stall · Guild board · Collector | sections 3 to 8 |
| Hunt row | `Zone 6 · levels 51-60 · mob_HP · mid quality ceiling · the sub-zones named` | `world.md` zone table |
| Element line | the zone's one or two common innate Elements | `world.md` · `elements.md` |
| Waypoint state | `open — warps free` · `not walked to yet` | `towns.md` section 7 |
| Standing line | `Bonegate · Tier II · 6,750 / 12,600 kills` with a progress bar | `towns-stalls.md` section 6 |
| Current zone marker | where the character is fighting now | `save.md` progress row |
| Walk row | each settlement with its **blocks** from here and the time those blocks cost | `towns.md` section 7 |
| Walk progress | while walking: `block 3 of 4 · 6s on this block`, with the encounter chance stated once | `towns.md` section 7 |
| Walk preview | shown **before** stepping onto a block, see section 9 | `towns.md` section 7 |

**One generated sheet.** `node tools/map.ts --write` writes `art/svg/map/map-overlay.svg` from `tools/data/map.json`: **every cell of the pointy-top hex field the simulation already walks on** — one cell per settlement, one per named sub-zone and one per wild side it rings, then the terrain a cell stands on, the walk graph labelled in blocks, the region names, the landmark marks, the level bands and the travel pin. The field is 20 columns by 15 rows and the starting settlement sits on its centre cell, so the bands climb outward by construction: a settlement's band is its distance rank from the start. A cell with no zone on it is not blank paper — it takes the nearest settlement's terrain, laid on thinner the further out it sits, and the ground past the field is the same lattice again, its tones a shade of the same seven countries laid darker than any cell stands, drifting by a smoothed noise rather than scattering per hex, so the field reads as the lit region of a larger world rather than a sheet laid on nothing. The sheet has three views of its own: terrain, the band ramp by distance rank, and a level gate that greys every band the preview level has not reached; the walk graph and the cell ids are overlays toggled over any view. **A cell key is presentation only**: the simulation reads settlement ids and the axial lattice in `engine.json` `road`, never a table in `map.json`, which the map cage's **M3** (the sheet's cells and the walk graph's nodes are the one lattice) and **M7** (no file under `engine/` or `game/src/` reads `map.json`) enforce together. Fog extends the same rule to art — terrain is always drawn, cell detail is not.

- An unvisited settlement is shown **by name with no detail** — the map never hides that a place exists, it only hides what it sells.
- A settlement whose level range the player has not reached is drawn greyed with its real requirement (`Level 51-60`), never removed: zone unlock is by level only (`world.md`).
- A far destination is **plotted before it is crossed**: the pick lights the chain of adjacent cells the walk will take, one cell per block, the cells already crossed darker. There is no route to buy and no edge list — every pair of settlements is walkable (`towns.md` section 7).
- A settlement that is not where the character stands is **read only**: its stock lines, Standing and set are printed, and every verb says to walk or warp there first — the field never sells a far purchase.

# 3. Stall Page — one template for every NPC

```
Armourer · Ironrow                        gold 1,204 · 6 h 12 m of selling
Tier II reached · next: Tier III 4,266 kills
────────────────────────────────────────────────────────────────────────────
Repair one piece            83 g · 12 m   [repeatable]        protection 2/5 → 5/5
Stash tab 1                414 g · 60 m   [owned ✓]
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
your rules convert each rejected piece → 1 stone  ·  or 1 gold  ·  never both
```

| Element | Rule |
|---|---|
| Default | **filter off** on every new slot — a fresh character keeps everything until the player arms a slot; an armed slot then **dissolves**, so the crafting engine keeps its designed 0.136 junk per kill |
| Medium choice | per slot, stored per character (`save.md`) |
| Warning | switching a slot to sell shows the forgone Reroll capacity: 1 gold = 1 stone = 1/80 of a full-set polish (`checks.md` T6) |
| Preset slots | 3 by default, one extra per purchase (`towns-stalls.md` section 3) · preset switching is a reason-to-open (`concept.md`) |
| Herb line | herbs never dissolve (`loot.md` section 4), so the sell switch is absent for them |
| Map knowledge | the Counterhand also prints the settlement's filter tip at Tier III — information, never a stat |

# 5. Guild Board

| Block | Content |
|---|---|
| Slots | three · an empty slot offers a new task immediately · a finished or skipped slot refills after 1 hour (`tasks.md`) |
| Task card | type (Elite hunt · Boss) · zone · progress `2 / 3 elites` · reward **in stones only** |
| AFK line | each card states whether progress runs while AFK (Boss never does) |
| Skip | free skip `1 / slot / day` · bought skip `55 g · 8 m` · cap `3 / day` shown as `0 / 3 bought today` |
| Pool gate | only zones at or below the player zone |
| Never shown | a gold payout — tasks pay stones, and selling junk is the only gold mint (`checks.md` G6) |

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

- The bar counts **kills**, matching how the thresholds are defined (`towns-stalls.md` section 6 · the high band's kill stream).
- Sources are itemised so the player sees that tasks and bosses are extra progress on the same bar, never a separate currency.
- Standing is never spendable, never shared across the 3 character slots (`save.md`), and the panel states what the next tier unlocks in the words of section 6: stock, set slots, map knowledge, presets, titles.
- Tier III exceeding the zone's own budget is displayed as a **chase** (`12,600 / 9,000 budget`), never as a bug.

# 9. Walk and Waypoint

| Action | Dialog must state |
|---|---|
| Walk to a settlement | the **blocks** and the time they cost · `4 blocks · 40s` · "every block is a chance of an ambush" · no price, because there is none |
| Arriving on foot (first time) | `Waypoint open — warps here free from now on` · never a purchase, never a prompt to buy |
| Waypoint warp | `free · instant` and nothing else · never a confirm, never a price |
| Ambush on a block | what it pays, in one line: `an ordinary fight — the usual drops` · never a stone, never Standing, never gold |
| Push on a walk | `resting at camp · the walk keeps its blocks` — never "forfeit", never a loss |
| Game closed mid-walk | the walk is online only: on return the character is on the block it stood on and the walk is unchanged (`towns.md` section 7) |

Nothing here quotes a price, and nothing here may imply that reaching a settlement faster costs money: the block count is the only travel cost and it is time (G9).

# 10. Should Not Show

| Value | Reason |
|---|---|
| drops → junk arithmetic | the player reads gold; the derivation lives in the tool |
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
3. The **Waystone** is a planned second destination kind for a Waypoint (`towns.md` section 7). It has no data behind it yet, so there is no screen to specify — it stays post-release until the owner asks for it.

(End of file)
