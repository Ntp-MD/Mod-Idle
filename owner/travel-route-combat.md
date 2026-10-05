# Travel · Route · Combat Idle

**Owner parking. Not system truth.** Nothing here is imported by any cage, and the linter never scans
this folder. Every number below that is marked *owner* has no home yet and must land in
`tools/data/` before it can be built. Prose in this file may not become a second source.

## 1. The original idea

The world should read as a **world map**: several zones, several settlements, connected by routes.
Travel puts the character into a **traveling** state in which it may **encounter** a monster group in
whichever zone the route crosses, or meet a **treasure** or a **merchant**. Travel between two
settlements — or between zones — takes real time, and the character can be left **idle** on the road
in real-world time.

## 2. What already exists — do not build it twice

Most of section 1 is already built as **The Road** (`engine/road.ts` · `engine.json` `road` ·
`towns.md` section 7 · `towns-ui.md` section 2 · `game/src/sim/road.ts`).

| Piece of the idea | Existing home | Status |
|---|---|---|
| map of settlements connected by routes | `engine.json` `road.links` — a chain of links, one per consecutive settlement pair | built, chain only |
| traveling state | `GameState.road` (`RoadTrip`: `linkIndex` · `settlementFrom/To` · `secLeft` · `nextEncounterSec` · `encountersLeft` · `pursePaid`) | built |
| real travel time | `road.trip_min` · `road.encounters_per_min` | built |
| monster encounter on the road | `spawnEncounter` in `game.ts`, drawing from the link's two zone casts (`mob-roster.md`) | built |
| merchant on the road | the **pedlar** encounter kind | built |
| idle in real time | `tick` (`game.ts`) + `catchUp` with `E.farm.offline_cap_hours` | built, and it currently refuses the road |
| treasure / chest | **nothing exists** — no loot-container concept anywhere | gap |

So the work is four deltas, not a new system: route shape, terrain, the Circuit idle unit, and a
chest. Everything else is already the shape the idea wanted.

## 3. Decisions taken in this session

| Question | Decision |
|---|---|
| Road shape | **chain + branch links** — keep the 8 ladder links, add branch links (a shortcut across a zone, a longer detour) |
| Road while offline | **the Circuit runs offline** — the "AFK never runs on a Road" ruling is replaced |
| Terrain (mountain · river · forest) | **changes the encounter table** — terrain tilts the encounter weights; it is not decoration |
| Where node positions live | **`tools/data/map.json` + a `tools/` writer** — not hand-placed in the SVG |
| World size | **18 zones · 18 settlements** (double) |
| Level span | **18 zones × 10 levels = 180 levels**, level cap raised |
| Game length | **not a design target** — the game is played for the gear and the build search, not to be finished in a number of hours |

## 4. Route shape — chain + branch

`engine.json` `road.links` changes from a string `"A ↔ B"` to an object per link:
`{ a, b, kind: 'ladder' | 'branch', terrain, trip_min }`.

**The code that breaks.** `engine/road.ts:18` derives `lower` / `higher` from the **array index** of a
link, and `game/src/sim/road.ts:66` (`encounterZones`) takes the encounter zone cast from the zone of
each of the two settlements. A branch link breaks both, because index order is no longer zone order.
The link must carry its own **zone pair explicitly**; nothing may derive it from position in an array.

**X36 is not additive here.** `tools/check.ts:648` requires `links.length === zones - 1` and
`tools/check.ts:650-652` requires every link to be exactly `zoneNames[i] ↔ zoneNames[i+1]`. The
first branch link fails that guard immediately. X36 has to be rewritten to accept branch links, and
it has to be done in the same pass — not patched later.

**Branch links pay no purse.** `engine/road.ts:46` computes the daily cap as
`links.length × purse_gold`, so every added link silently raises the gold ceiling (8 links = 24
gold/day at present). Branch links with **no purse at all** keep X36 provable without changing the cap
formula, and keep the mint bound meaningful instead of arithmetically true. *Owner ruling wanted if a
branch link should pay something instead.*

## 5. Circuit — the idle unit

The unit of idling on the road is a **Circuit**: a player-chosen ordered list of links that repeats
until stopped. A single trip stays as the one-off case of reaching a settlement for the first time.

Undefined until the owner rules, and each needs a line in `save.md`:

- a **Push in the middle of a Circuit** skips to the next leg — it does **not** end the Circuit, or
  repeated Pushes loop forever
- **closing the game mid-Circuit** resolves the rest of the legs, then parks the character in a zone
  before normal idling resumes
- a Circuit is editable while standing in a settlement, and never while traveling

## 6. Offline on the road

`game/src/sim/game.ts:663` (`catchUp`) currently calls `endTrip(s, 'forfeit')` the moment an offline
session starts, and `towns.md` states the rule twice — "auto-completes at the destination" and
"AFK never runs on a Road". Both lines change.

The mint stays bounded without a new cap, because three existing guards already hold:

| Guard | Where | Why it still bounds the mint |
|---|---|---|
| Item quality floor while offline | `catchUp` (`online: false` floors the drop band) | offline drops never exceed the zone floor |
| no Elite, no boss while offline | `bossDueAt` frozen when offline | the tier-stone monopoly (G5) is untouched |
| purse capped once per link per day | `road.purse_once_per_link_per_day` | gold comes from the purse, not from the encounter count |

**Terrain tilt is online-only.** Offline uses the **base, untilted** weights. This is the load-bearing
rule of the whole change: if offline used the tilted table, a player would route a Circuit through
the heaviest-ambush terrain and the 12-hour offline Cap would pay out at full encounter rate. With
the base table offline, the Road can run while away and still cannot become a better faucet than
farming.

## 7. Terrain changes the encounter table

Each link carries a `terrain`. Each terrain carries a weight vector over the encounter kinds. The
vector is normalized so that the **weights still sum to 100** and `encounters_per_min` stays one
number.

- The expectation is that a forest route meets the **pedlar** more often and an ambush less often,
  and a mountain route the reverse. *Exact tilt numbers are owner's.*
- The chest becomes a fourth encounter kind in `engine.json` `road.encounters`, with `weight`,
  `mobs`, `resolve`, `win`, `loss` like every other kind (`tools/check.ts:653-655` requires all five
  and a weight total of 100).
- **The chest pays no crafting stones** (G5) and carries a per-link-per-day cap of the same shape as
  the purse, so it is not a third mint. It pays Item quality up to the ceiling of the **destination**
  zone, which makes an unopened route worth opening.
- A terrain must never be able to drive a kind's weight to zero. A zero-ambush route is free
  progress, and free progress is not a shortcut, it is a skip.

## 8. Map presentation

Two layers, and the split is what keeps X33 alive:

1. **Terrain background** — hand-drawn SVG, one large file, at `art/svg/ui-map-terrain.svg`. It is
   **not** drawn from the `1x1-*` slice of `art/svg/`, which is a third-party attribution library,
   and it does not reuse the 32 px stroke icons in the `icons-*` slice — a map is a different scale
   and a different style.
2. **Generated overlay** — nodes, links, fog, and the travel marker, written by a `tools/` writer
   from `map.json`.

`map.json` holds:

```
nodes    : [{ id, x, y }]                    one per settlement
links    : [{ a, b, terrain, path, anchor }] one per Road link
terrain  : [{ id, kind, weights }]           the tilt vectors from section 7
```

**Every terrain feature carries an `anchor`** naming a `node_id` or a `link_id`, so a new zone moves
its art instead of requiring the illustration to be redrawn.

**The ruling this needs.** Node coordinates are **presentation only**. The simulation reads node and
link ids and nothing else. Without an explicit decision saying so, `AGENT.md` section 5 reads a
coordinate table as the coordinate model it forbids (X33).

**What the map may not hide.** `towns-ui.md` section 2 already rules that an unvisited settlement is
shown **by name with no detail** — the map never hides that a place exists, only what it sells. A
capital above the player's level is drawn greyed with its real requirement. Fog extends that to art:
terrain is always drawn, node detail is not.

## 9. Eighteen zones · 180 levels

Eighteen zones at ten levels each, so the spawn range becomes 1-180 and the level cap rises with it.
The timeline is **not** a target: this is a game about playing, finding gear and finding a build.

### Power that moves as a consequence

| Quantity | Now (cap 100) | At cap 190 | Why |
|---|---|---|---|
| `stat_c` | 210 | 390 | `stat.base + stat.per_level × (L-1)`, linear in level |
| Core Stat ceiling | 535 | **715** | `stat_c + core_flat_max × item_slots` (D-112) — this moves by itself |
| skill multiplier | 1.340 | **1.646** | `1 + skill_per_level × L`, the last level multiplier left (H1) |
| mob_HP at the last zone edge | 10,709 | **~25,700** | stat growth × skill multiplier, at the same TTK |
| item count | 12 from L24 | 12 from L24 | `min(12, ceil(L/2))` is already saturated — gear stops growing, levels do not |

**Caps have to be walked one by one.** `aspd` 500 · `evasion` 80 · `cdr` 80 · `elem_res` 75 are all
set against a stat line that now runs 85% higher, and a Cap that cannot be reached is not a power
limit, it is a number that misleads the player (`AGENT.md` section 3). Reachability is re-proved per
Cap, not assumed.

### Cages this breaks

| Cage | What it asserts | Why it fails |
|---|---|---|
| X36 (`check.ts:648`) | `links.length === zones - 1` | 18 zones implies 17 links, plus branch links on top |
| X36 (`check.ts:658-661`) | purse ≤ 5% of a 6-hour junk mint; Standing ≤ 20% of the kills a trip costs | both bounds are denominated in **hours**, and hours are no longer a target — they must be rewritten as a **rate per encounter** |
| X23 (`check.ts:345`) | a zone has ≥ 5 roster entries and its own boss | 18 zones need **18 named bosses**, written rather than generated |

Content supply: 15 species and 120 roster entries cover 18 zones at an average of 6.7 entries each,
which clears the floor of 5 but leaves little slack, so species placement has to be re-spread over 18
zones instead of 9. Five Elements over 18 zones still works, since the rule is 1-2 innate Elements
per zone.

## 10. Numbers and names — agent proposal, veto-able

**These are proposals, not decisions.** They live here because owner parking is outside every cage,
so nothing becomes system truth until the numbers are moved into `tools/data/` and a writer prints
them. Every one is written to be argued with; the reasoning sits next to each.

### 10.1 The nine existing settlements

Zones 1-9 keep their names, their bands and their anchors untouched:

| Zone | Settlement | Capital | innate |
|---|---|---|---|
| 1 | Eastgate | — | fire |
| 2 | Millbrook | — | poison |
| 3 | Ashfall | low | fire |
| 4 | Ironrow | — | lightning |
| 5 | Wolf Cross | — | cold |
| 6 | Highspire | mid | cold · lightning |
| 7 | Bonegate | — | chaos |
| 8 | Frosthold | — | cold |
| 9 | Vermolch | high | poison · chaos |

Three capitals today, at zones 3 · 6 · 9. Vermolch stops being the endgame and becomes the ninth
step of eighteen.

**Note the band consequence before reading 10.2.** The `world.md` band table reads low 1-30 · mid
31-60 · high 61-90 — that is 30 levels per band. At 18 zones × 10 levels the world is 180 levels, so
each band is 60 levels. That is the real structural consequence of doubling the world and it is
costed in 10.6.

### 10.2 The nine new settlements

| Zone | Levels | Settlement | Capital | innate | flavour |
|---|---|---|---|---|---|
| 10 | 91-100 | Thornwake | — | poison | the old level 91-100 push band becomes a zone of its own |
| 11 | 101-110 | Greyfen | — | poison · chaos | wet lowland, spider country |
| 12 | 111-120 | Saltmarrow | mid | chaos | salt flats and a capital |
| 13 | 121-130 | Emberhold | — | fire | slag and foundry heat |
| 14 | 131-140 | Duskmoor | — | cold · chaos | open moor, the worst ambush country |
| 15 | 141-150 | Nettlecrag | mid | chaos · poison | thorn country, a capital |
| 16 | 151-160 | Blackwater Reach | — | poison | drowned river mouth |
| 17 | 161-170 | Wyrmback | — | fire · cold | wyrm breeding ground |
| 18 | 171-180 | The Pale Spire | high | chaos · poison | the new endgame, and the third capital |

Six capitals at zones 3 · 6 · 9 · 12 · 15 · 18 — one every three zones, which is the existing
low/mid/high pattern carried forward twice.

### 10.3 The nine new bosses

Nine species have never carried a boss, and they are what the nine new zones draw on. A species may
carry more than one, so this is a starting spread rather than a fixed pairing.

| Zone | Settlement | Boss | Carrier species |
|---|---|---|---|
| 10 | Thornwake | The Rootcoil | Drake |
| 11 | Greyfen | Greyfen Broodmother | Spider |
| 12 | Saltmarrow | The Salt Tyrant | Elf |
| 13 | Emberhold | Emberhold Slagheart | Golem |
| 14 | Duskmoor | Duskmoor Stalkers | Wolf |
| 15 | Nettlecrag | The Nettle Hag | Demon |
| 16 | Blackwater Reach | The Drowned Choir | Husk |
| 17 | Wyrmback | Wyrmback Sovereign | Drake |
| 18 | The Pale Spire | Pale Spire Silence | Seraph |

### 10.4 Terrain kinds and their tilt

Five kinds, chosen to be the features a map actually draws — and the tilt is what makes the map
mechanical rather than decoration (section 7).

| Terrain | ambush | caravan | pedlar | chest | Why |
|---|---|---|---|---|---|
| **road** | 48 | 28 | 16 | 8 | most traffic, most trade, least violence |
| **river** | 45 | 30 | 15 | 10 | a water route carries caravans and floating traders |
| **forest** | 62 | 18 | 10 | 10 | cover for ambush, poor for a caravan |
| **mountain** | 70 | 16 | 6 | 8 | the worst country and the fewest travellers |
| **moor** | 55 | 22 | 11 | 12 | open and quiet, and things get buried out there |

Each column sums to 100, each row sums to 100, and **no kind ever reaches zero** — a zero-ambush
route would be free progress, which is a skip rather than a shortcut.

**Base, untilted weights — the four kinds are now `ambush · caravan · pedlar · chest`:**

```
ambush 54 · caravan 24 · pedlar 12 · chest 10 = 100
```

This is the plain average of the five terrains above, and it is the table **offline uses**
(section 6). The current three weights sum to 100 already, so adding the chest is a renormalisation
of the existing numbers, not a new budget.

### 10.5 The chest

| Property | Value | Reason |
|---|---|---|
| weight | 10 in the base table | a tenth of encounters is the ceiling before the terrain tilts read as noise |
| cap | once per link per day | the same shape as the purse, so it cannot become a third mint |
| pays | Item quality up to the **destination** zone ceiling | an unopened route is worth opening |
| pays | **no crafting stones** | G5 — the tier-stone monopoly stays with Elite and boss |
| resolves offline | **no** — offline uses the base weights, and the chest is in them | keeps section 6 intact without a second rule |

### 10.6 The structural consequence nobody has costed yet

**Bands stretch from 30 levels to 60.** `world.md` reads low 1-30 · mid 31-60 · high 61-90. At 180
levels each band is 60 levels, and a band is defined by the **gear tier steps inside it** — the HP
jumps between zone edges are gear steps, not level steps. Look at the existing anchors: within a
zone the edges barely move (1,824 → 4,033 across a whole band), but across a band boundary they
nearly double (1,824 → 3,546 at the low→mid edge, 5,293 → 7,739 at the mid→high edge).

**So each band must now contain two gear-tier steps instead of one, and the intra-band HP curve has
to steepen to match.** That is the single largest open number in this document, and it is the reason
the 36 zone-edge anchors cannot be typed by hand — they have to come out of the engine.

The rule to hand to `engine/index.ts`, in place of 36 typed anchors:

```
zone edges        = 1, 10, 20, ... 180          (18 zones × 10 levels)
within-band step  = the existing intra-band growth, applied twice per band
band step         = the existing low→mid and mid→high steps, applied twice across the world
L180 anchor       = derived from stat_c(180) × skill multiplier(180), not typed
                   (the stat line reaches 390 and the multiplier 1.646, so the last zone edge
                   lands near 25,700 — see section 9)
```

Until that rule exists and prints, **section 9's `~25,700` is an order of magnitude, not a value.**

### 10.7 Routes, `trip_min`, and the branch links

17 ladder links + 4 branch links = **21 links** across 18 settlements.

| Kind | Count | `trip_min` | Purse | Terrain |
|---|---|---|---|---|
| ladder | 17 | 5 | yes | follows the river — the chain as it exists |
| branch | 4 | 8 | **no** | mountain — the shortcut over the pass |

A branch link skips one settlement: it joins zone *i* to zone *i+2*. Two ladder legs cost 10
minutes, the branch costs 8, so it is a real saving in time — and it pays no purse and grants
Standing only in the zone it arrives at, so it is **less Standing per minute than walking the long
way**. The trade is time against Standing, and neither side wins outright.

The four branch links, spread so no two are adjacent:

| From | To | Skips | Why there |
|---|---|---|---|
| 3 Ashfall | 5 Wolf Cross | Ironrow | the first capital is worth routing around |
| 6 Highspire | 8 Frosthold | Bonegate | the mountain pass above the mid band |
| 10 Thornwake | 12 Saltmarrow | Greyfen | the fen has no road worth taking |
| 15 Nettlecrag | 17 Wyrmback | Blackwater Reach | the long way round the drowned reach |

### 10.8 What still needs the owner, after all of the above

- **The 36 zone-edge anchors** — derived by the rule in 10.6, never typed
- **Whether a branch link may pay anything at all** — the proposal is no purse, ever
- **Whether the chest resolves offline** — the proposal is no
- **Species placement across 18 zones** — 120 roster entries over 9 zones is not enough density for
  18. Each species widens from its current 1-3 zones to roughly 4-6, and X23's floor of 5 entries per
  zone still has to hold at every one of the 18

## 11. Files this would touch, when it is time to build

Data first, then the writers, then the docs — never the other way round.

| File | Change |
|---|---|
| `tools/data/engine.json` | `road.links` → objects · per-terrain weight vectors · the chest kind · `mob.zones` 9 → 18 · `stat.level_cap` · `mob.curve.hp_at_player_level_cap` |
| `tools/data/town.json` | `settlements` 9 → 18, each with its zone, roster and NPCs |
| `tools/data/map.json` | **new** — nodes, link paths, terrain, anchors |
| `tools/data/bases.json` / `mods.json` | only if Item quality bands are re-cut for 18 zones |
| `engine/road.ts` | zone pair read from the link, never from array index · the Circuit · terrain vectors |
| `engine/types.ts` | `RoadCfg.links` becomes objects; a Circuit shape |
| `game/src/sim/road.ts` | Circuit start/stop/edit · the offline resolve |
| `game/src/sim/game.ts` | `catchUp` resolves the road instead of forfeiting the trip |
| `game/src/sim/types.ts` | `RoadTrip` → a Circuit state; `save.md` gains the schema |
| `tools/map.ts` | **new** — writes the generated overlay from `map.json` |
| `tools/check.ts` | X36 rewritten · X23 re-proved over 18 zones |
| `doc/world/world.md` | the zone table, regenerated |
| `doc/world/towns.md` · `towns-ui.md` | section 7 travel rules and the Map Page, regenerated |
| `doc/save.md` | the Circuit state and a schema version bump |
| `harness/decisions.md` | the offline ruling that replaces "AFK never runs on a Road", and the presentation-only coordinate ruling |

## 12. Do not

- **Do not** let the simulation read a coordinate. `map.json` positions are presentation (section 8).
- **Do not** let the Road become income. It is a content choice, not a faucet — the guard is that the
  purse stays capped and the chest pays no stones.
- **Do not** let terrain tilt apply offline (section 6).
- **Do not** let a Push end a Circuit.
- **Do not** add tiles, movement speed or aggro radius to make the map legible. Near and far are the
  reach queue and nothing else (X33).