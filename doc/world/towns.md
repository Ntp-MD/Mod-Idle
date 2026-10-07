# Towns

import glossary.md
import concept.md
import world.md
import economy.md
import loot.md
import crafting.md
import farm.md
import tasks.md
import checks.md
import towns-stalls.md
import towns-ui.md

**Spec draft** — the three doors in section 9 are now chosen (D1 = real gold · D2 = convenience + services · D3 = all four travel modes, staged). Numbers still anchor to `checks.md` groups F/E and none of them change kill rates or `mob_HP`.

**This file is the index.** The prices, rosters, stock tables, Standing kill thresholds and Collector sets live in `towns-stalls.md`, and every one of those tables is *generated* from `tools/data/town.json` by `node tools/town.ts --write` (cage: `checks.md` group T). The screens that render them are specified in `towns-ui.md`.

# 0. What this layer is for

| Hole this fills | Evidence | Answer |
|---|---|---|
| The shop had no home | `farm.md` Shop listed 4 items with no owner and no place | settlement stalls with owners (section 5) |
| The task board had no home | `tasks.md` 3 level-gated slots, no fiction | Guild counter (section 5) |
| Spatial vocabulary was broken | `combat.md` section 4 Push step 1 said "leave zone back to **camp**" · `world.md` said "rolled on every **room** entry" · everything else said zone | one vocabulary, section 2 · `room` now removed |
| Per-zone Base bias was allowed but unused | `item-base.md` "if Bases should roll unequally (e.g. plate spawns more in soldier zones), add a column to the zone table" | settlement identity is that column (section 4, gated on a re-simulation) |
| No sink for non-craft income | gold had nowhere to go once the one-time purchases were done | repeatable sinks, `economy.md` table |
| Decision frequency collapses as the build fills | `loot.md` section 3 conclusion 1 · `concept.md` failure point 1 | "where do I sit, what do I sell for" is a new decision that costs no automation |

**The danger this layer must not create** — an NPC that sells power is a progression axis no `mob_HP` line covers (`checks.md` H1). Every rule here keeps purchases to **space · time · information · appearance**.

# 1. Reference notes — taken and refused

| Source | Mechanic | Taken here | Refused here |
|---|---|---|---|
| **Melvor Idle** | ~20 skills, area lists, clue/trail content, shared bank | settlement as hub (stash, bench, one click to a zone) · trail/Collector turn-in as a reason to travel | any skill gate on entry (combat only · `concept.md`) |
| **Path of Exile** | town hubs per act, one service per NPC, waypoint network, master vendors, divination-card turn-in | Waypoints · one NPC = one service, never a general store · Collector set turn-in · town as the place where all services concentrate | quest gating that blocks zone access (zones unlock by level only · `world.md`) |
| **Black Desert** | town reputation → vendor stock and worker slots · houses with storage · weight · camps | Standing that unlocks stock · house = stash + plot + waypoint anchor · weight system already lives in `formula.md` section 11 | workers, node managers, life skills, market buy-orders, player trading — all resource-skill or economy systems (`concept.md`, `economy.md`) |
| **Isekai anime** | guild registration, receptionist, request board, town as safe place, each town's merchants stock different goods, carriage between cities, "bring the materials to town" | 6 capitals + 12 towns over zones 1-18 · per-town specialty goods · Guild board = `tasks.md` · registration = Standing tiers · sell-or-dissolve at the counter is the "bring it back to town" loop | an NPC selling the hero a shortcut — no gear, no Mods, no potions, no stones |

# 2. Vocabulary

| Term | Meaning |
|---|---|
| **Settlement** | One named place holding services and NPCs. Never holds combat. |
| **Capital** | A settlement serving one quality band (low / mid / high) with the full service set. 6 total. |
| **Zone** | The combat area attached to a settlement. The 18 zones of `world.md` are unchanged — a settlement never replaces a zone. |
| **Road** | The link between two settlements. Travel only; content on it exists only in opt-in mode (section 7). |
| **Block** | The unit the Road is walked in, `road.walk.block_sec` to the block. A link is a chain of them (the walk, below). |
| **Route** | An ordered chain of links walked to a chosen settlement. A Circuit is a route with the loop set — one structure, two ends. |
| **Checkpoint** | A settlement. Warping to one is the only way to skip ground in the world (the walk, below). |
| **Waypoint** | A Road made instant by having visited its settlement once. |
| **Camp** | The Push rest location only (`combat.md` section 4) = the settlement owning the current zone. Not a general word for base. |
| **Standing** | Per-settlement unlock counter. Never spendable, never a currency, never grants a stat. |
| **Sell / Dissolve** | The bag filter's third choice on a rejected piece: 1 gold or 1 Reroll value stone, never both (`economy.md`). |

# 3. What travel may never cost

Kills are the whole economy: F1 589 kills a band and F3 139 drops per 1,000 kills assume the player fights every second they are in a zone. So the invariant for every travel mode in section 7 is:

```
travel that consumes real time  →  may never be mandatory
                                 →  may never be the best income choice
                                 →  may never be the state the character is in while offline
```

# 4. Map — 18 zones onto 6 capitals and 12 towns

Zone levels, group sizes and quality ceilings stay in `world.md`; this adds a place and a specialty. Element identity follows the `world.md` rule "one zone has 1-2 common innate Elements", which is also the reason to buy res from the right town (`elements.md`: res must be prepared from the zone played).

| Zone | Level | Settlement | Capital | Innate Element | Base bias (flavor until re-simulated) | NPCs |
|---|---|---|---|---|---|---|
| 1 | 1-10 | Eastgate | — | fire | cloth | Counterhand · Porter · Waypoint keeper |
| 2 | 11-20 | Millbrook | — | poison | cloth / light | Counterhand · Porter · Waypoint keeper · Herbalist |
| 3 | 21-30 | Ashfall | **low capital** | fire | light (Evasion) | full set + Collector |
| 4 | 31-40 | Ironrow | — | lightning | light / mail | Counterhand · Porter · Waypoint keeper · Armourer |
| 5 | 41-50 | Wolf Cross | — | cold | light | Counterhand · Porter · Waypoint keeper · Furrier |
| 6 | 51-60 | Highspire | **mid capital** | cold / lightning | mail | full set + Curio pedlar |
| 7 | 61-70 | Bonegate | — | chaos | heavy (Armour) | Counterhand · Porter · Waypoint keeper · Collector · Armourer |
| 8 | 71-80 | Frosthold | — | cold | heavy | Counterhand · Porter · Waypoint keeper · Siege Armourer |
| 9 | 81-90 | Vermolch | **high capital** | poison / chaos | heavy · cloth (glass endgame) | full set + Collector + Curio pedlar |

- **Base trio** = Counterhand · Porter · Waypoint keeper, in every settlement.
- **Full set** = base trio + Steward · Guild clerk · Armourer · Herbalist (capitals only, so "different NPCs per town" stays true without nine clone shops).
- **Collector** sits where a set is turned in: Ashfall · Bonegate · Vermolch. **Curio pedlar** at Highspire · Vermolch only. **Furrier** at Wolf Cross only. Frosthold's Armourer is the Siege variant.
- The generated roster matrix and per-settlement stock are in `towns-stalls.md` section 5 · the placement rules are checked as `checks.md` T-R / T-S.
- Capitals sit at the end of each quality band (zones 3 / 6 / 9), which is also the anime arc shape: one regional capital per band.
- Levels 91-100 add no settlement (`world.md`); endgame play sits in Vermolch.
- Base bias is **flavor only** until `loot.md` section 3 keep-rates are re-simulated with an unequal step-2 roll (`towns-stalls.md` section 8 · `checks.md` T15).

# 5. NPC roster — differentiated by inventory, bounded by purchase kind

Prices are in **gold**, written as kills of full-sell income (`economy.md`: 1 junk sold = 1 gold, 0.1341 gold per kill in the high band). The exact price of every line below is in `towns-stalls.md` sections 3-4, generated from `tools/data/town.json`.

| NPC | Where | Sells / does | Kind | Price anchor | Why it is not power |
|---|---|---|---|---|---|
| **Counterhand** | every settlement | The sell/dissolve switch itself, and the per-slot filter rules | information | free · extra preset slot 294.5 k | the filter already decides this; the counter only makes it legible |
| **Steward** | capitals | Plot deed 4, Plot deed 5 (from `farm.md`) · house (stash tabs + 1 farm plot + waypoint anchor) | space | 926-5301 k | farm outputs herbs only, never gear · house grants no combat effect |
| **Porter** | every settlement | Stash tab, Herb pouch II/III, category slot (herbs/stones/gear display) | space | 347.25-2945 k | `loot.md` section 4 has no Bag Cap today, so storage is a sink with a real product |
| **Guild clerk** | capitals | Task skip token: 1 extra skip per slot per day on top of the free skip in `tasks.md` | time | 78.5 k each · 3/day cap | capped at 1 per slot per day · payouts unchanged, so the tasks.md ≤10% bound is untouched |
| **Armourer** | all capitals + Ironrow, Bonegate, Frosthold | Repair service: clears Broken and refills protection for gold, no Repair stone | time | 157.1 k · 137.4 k at Ironrow, above the 32.7-kill elite floor | **D2 service class** — it converts a rare-stone dependency into gold, so it must never be cheaper than hunting. Blocked on F9/F13 rates |
| **Herbalist** | Millbrook, capitals | Sells plot upgrades and pouch tiers; buys nothing | space | up to 2356 k (high band) | **refused as a buyer**: converting herb drops into gold would be a third mint of the medium, i.e. the "money from what you already farm" trap `economy.md` was written to avoid. Herbs stay potion fuel only |
| **Waypoint keeper** | every settlement | Opens a Road link (first visit), shows the map, moves the anchor | time | 196.3 k per link (one-time) · 58.9 k re-anchor | convenience · this is travel mode B |
| **Collector** | Ashfall, Bonegate, Vermolch (one set each) | Turns in a named set of junk pieces for one cosmetic, one stash tab, or one title | space/appearance | item-only, no gold · hint line 147.25 k | turn-in is a sink of *items*, PoE divination-card shape without the Mod reward |
| **Curio pedlar** | Highspire, Vermolch | Rotating 3-slot stock, refreshes per real day: banners, Base tints, titles, extra plot slots | appearance | 294.5-1178 k · prestige title 2945 k | the rotation is a reason to log in, which is the `concept.md` "reason to return" line |
| **Furrier** | Wolf Cross | Bag category slots and the settlement's banner cosmetic | space/appearance | 441.75 k · 805.5 k | sells display space, never a pelt to grind: no gathering exists (`concept.md`) |
| **Vaal broker** | — | would sell Corrupt stones | — | — | **does not exist**: Corrupt stones are boss-only and the rarest income in F10; selling them breaks G5 |
| **General store** | — | would sell gear, Mods, potions, or gold↔stone exchange | — | — | **does not exist and must never exist** (`economy.md` single-medium rule) |

- Potions stay craft-only (`farm.md`): an NPC selling Draughts would put boss-fight sustain behind a purchase, and bosses are the active-play gate (G5).
- Standing gates *stock*, never stats.

# 6. Standing without an eighth currency

| Rule | Value |
|---|---|
| Earned by | kills in that settlement's zone · tasks there · boss kills there — counted from flows F1-F12 that already exist, so Standing mints nothing |
| Spendable | no. It only ever goes up and only unlocks vendor stock. Gold is the spendable medium (`economy.md`) |
| Tiers | 3 per settlement · threshold = that zone's time budget × 30% / 75% / 140%, converted to kills by F1 of its band — generated in `towns-stalls.md` section 6, checked as `checks.md` T12 · T13 |
| Grants | vendor stock lines, Collector set slots, map knowledge, saved filter presets, titles. Never stats, never Mod values, never anything `mob_HP` cares about |
| Scope | per character slot (`save.md` 3 slots), like zone progress |

# 7. Travel — all four modes, each with a job

| Mode | Rule | What it pays | Bound |
|---|---|---|---|
| **A Waypoint** | instant and free between visited settlements | nothing | default. F1-F3 untouched |
| **B Carriage** | first visit to an unlinked settlement costs gold | the link | 196.3 k of income per link (`checks.md` T9) · one-time · sink only |
| **C Road time** | opt-in: walk the Road block by block — one link, a plotted route, or a looping Circuit — instead of the Waypoint | Standing in the settlement each leg arrives at | every leg is a whole number of `road.walk.block_sec` blocks · a Circuit runs offline (its current lap only) · a plotted route never resolves while away · never required for anything |
| **D Road events** | on a Road leg, as the character crosses into a block: ambush, caravan escort, traveling pedlar, a chest — from the link's own terrain table | gold (ladder links) · Standing · one Item from a chest · cosmetic stock the towns do not carry | total ≤ the value of the same kill count spent farming, measured against F1/F5 · pays **no stones**, so boss and elite gates (G5, F7-F10) keep their monopoly on power · the chest is capped once per link per day |

- **C+D are a content choice, not an income choice.** A Road leg forfeits 589 kills for at most a few percent of that value, and that trade must be stated in the UI before the player steps onto the Road. Its purpose is the thing farming cannot give: the isekai travel beat, the encounter, the merchant who only travels.

### The walk — a block is the unit, and it is the only way to move

The Road is counted in **blocks** (`engine.json` `road.walk`) and the rule that makes that safe is one identity:

```
walk.block_sec x walk.encounter_gap_blocks x encounters_per_min  =  a minute
```

so a leg lasts exactly as long and carries exactly as many encounters as it did before it was measured in blocks — the ruler changed and nothing else (**M13** · **M14** · **X36**). `trip_min` still decides how many blocks a link is.

**Adjacency is the whole positional rule, and it is one sentence:** a block touches only the block before it and the block after it on its own link; the first block touches the settlement the leg left and the last the settlement it reaches. There is no other edge anywhere in the walk (**M15** · **X36**), so:

- a character can never be standing somewhere it did not walk to, and
- a route can never step between two blocks that do not touch — plotting draws a path, it does not jump it.

A block carries no coordinate. It is named `<zoneA>-<zoneB>#<n>`, the link id the map already used plus its position on it, so the sheet may draw the walk anywhere and the simulation still cannot read where the sheet put it (**M7** · **M16**).

**Route and Circuit are one structure.** A **route** is the shortest chain of links from the settlement you stand in to the settlement you chose, walked link by link and block by block, ending where it was aimed. A **Circuit** is the same list with the loop set, so it repeats until stopped. One validator serves both (`Circuit` row of the generated block below).

**The checkpoint is the only skip.** A settlement is a checkpoint; warping to one costs the carriage price **once per link** and is free and instant for every visit after that. That is mode B plus mode A unchanged, which is why the walk is never mandatory and never the cheaper option (the invariant above · G9 · T9). A per-warp toll was the alternative reading and was not taken: it would make gold a tax on every settlement change, re-open T4/T5/T9 and quietly make the Road — which costs no gold to walk — the default way to move instead of the opt-in.

**What a block does not do.** The sub-zone hexes on the sheet stay where they were — the places you fight in, named inside the hex each owns. A walk does not stand on one, so `zoneFocus` (`world.md`) is untouched and still the way a spawn's race pair and Element are chosen.

### What the Road actually is

Generated from `engine.json` `road` — edit the data, run `node tools/check.ts --write`. The mint bound and the Standing rate are guarded by **X36**, so the Road cannot become a second income faucet.

<!-- BEGIN GENERATED:road-rules -->
| Road element | Value |
|---|---|
| Ladder links (17, 5 min, pays the purse) | **Eastgate ↔ Millbrook** · ladder · forest · 5 min = 30 blocks · **Millbrook ↔ Ashfall** · ladder · road · 5 min = 30 blocks · **Ashfall ↔ Ironrow** · ladder · river · 5 min = 30 blocks · **Ironrow ↔ Wolf Cross** · ladder · forest · 5 min = 30 blocks · **Wolf Cross ↔ Highspire** · ladder · road · 5 min = 30 blocks · **Highspire ↔ Bonegate** · ladder · river · 5 min = 30 blocks · **Bonegate ↔ Frosthold** · ladder · forest · 5 min = 30 blocks · **Frosthold ↔ Vermolch** · ladder · road · 5 min = 30 blocks · **Vermolch ↔ Thornwake** · ladder · river · 5 min = 30 blocks · **Thornwake ↔ Greyfen** · ladder · forest · 5 min = 30 blocks · **Greyfen ↔ Saltmarrow** · ladder · road · 5 min = 30 blocks · **Saltmarrow ↔ Emberhold** · ladder · river · 5 min = 30 blocks · **Emberhold ↔ Duskmoor** · ladder · forest · 5 min = 30 blocks · **Duskmoor ↔ Nettlecrag** · ladder · road · 5 min = 30 blocks · **Nettlecrag ↔ Blackwater Reach** · ladder · river · 5 min = 30 blocks · **Blackwater Reach ↔ Wyrmback** · ladder · forest · 5 min = 30 blocks · **Wyrmback ↔ The Pale Spire** · ladder · road · 5 min = 30 blocks |
| Branch links (4, no purse) | **Ashfall ↔ Wolf Cross** · branch · mountain · 8 min = 48 blocks · no purse · **Highspire ↔ Frosthold** · branch · mountain · 8 min = 48 blocks · no purse · **Thornwake ↔ Saltmarrow** · branch · mountain · 8 min = 48 blocks · no purse · **Nettlecrag ↔ Wyrmback** · branch · mountain · 8 min = 48 blocks · no purse |
| Trip length · encounters | a link runs for its own `trip_min` · 1 encounter per Road minute |
| The block walk | a link is walked **one block at a time**, `walk.block_sec` to the block, so a `trip_min` leg is `trip_min x 60 / walk.block_sec` blocks (**M13** · **M14**) · an encounter fires on the way into every `walk.encounter_gap_blocks`-th block, which is the same 1-per-Road-minute cadence the leg always had |
| Adjacency | a block touches only the block before it and the block after it on its own link; the first touches the settlement the leg left and the last the settlement it reaches. There is no other edge in the walk, so a character can never be somewhere it did not walk to (**M15** · **X36**) |
| Route | pick any settlement and the shortest chain of links to it is plotted and walked link by link. A Circuit is the same list with `loop` set — one structure, one validator |
| Offline | a Circuit plays out the rest of its lap on the **untilted base table**, then parks the character in a zone before normal idling resumes — an away period can never be routed into ambush country. A plotted route is never resolved while away: it is dropped and the character stands where the walk stopped |
| Checkpoint | a settlement is a checkpoint and warping to one is the only way to skip ground: it costs the carriage price **once per link** and is free and instant for every visit after that, so walking is never mandatory and never the cheaper option (**G9** · **T9**) |

| Terrain | ambush | caravan | pedlar | chest |
|---|---|---|---|---|
| road | 48 | 28 | 16 | 8 |
| river | 45 | 30 | 15 | 10 |
| forest | 61 | 19 | 9 | 11 |
| mountain | 70 | 15 | 7 | 8 |
| moor | 46 | 28 | 13 | 13 |

Each row sums to 100 and none reaches 0 — a zero-ambush route is a skip, not a shortcut. Terrain tilts the encounter table; it is not decoration.

| Encounter | Base weight | Terrain tilt | Mobs | Win · loss |
|---|---|---|---|---|
| ambush | 54% | road 48 · river 45 · forest 61 · mountain 70 · moor 46 | 2-3 from the lower zone cast, at the player level clamped into that range | normal 8% drop roll + the link's purse · loss: Push as usual, the leg is forfeit and the purse is lost |
| caravan | 24% | road 28 · river 30 · forest 19 · mountain 15 · moor 28 | 1 Large from the higher zone cast + 2 Small from the lower | Standing only, no gold · loss: Standing 0 and the leg ends |
| pedlar | 12% | road 16 · river 15 · forest 9 · mountain 7 · moor 13 | none | gold sink only · loss: n/a |
| chest | 10% | road 8 · river 10 · forest 11 · mountain 8 · moor 13 | none | one Item at the destination zone's quality ceiling · loss: n/a |

The base column is the plain average of the terrain rows and is what an **offline** session rolls, so the tilt can never be farmed while away. The purse pays **1 gold on a ladder link only**, once per link per day, so the Road can never mint more than **17 gold/day** while one 6-hour farming session mints thousands by selling junk — Road gold is a rounding error, which is what "C+D are a content choice, not an income choice" has to mean. A chest pays one Item at the destination zone's ceiling, is capped once per link per day, and pays **no crafting stones**. Standing is granted in kill-equivalents (**7** per completed leg), under a fifth of what the same minutes would earn hunting (**X36**). Losing a one-off trip forfeits roughly 120 kills of progress and the purse; a Push mid-walk skips the rest of the leg. The walk changes the ruler and nothing else: `walk.block_sec` x `walk.encounter_gap_blocks` x `encounters_per_min` is a minute, so a leg is as long and as eventful as it always was, and **702** blocks are all that the world added.
<!-- END GENERATED:road-rules -->

- **Offline on the Road** — if the game closes mid-Circuit, the rest of that lap plays out on the **untilted base table** and the character is then parked in a zone, where ordinary offline idling resumes. The base table is what bounds the mint: routing a Circuit through the heaviest-ambush terrain cannot be paid at the tilted rate while the player is away. A one-off trip left alone resolves itself rather than forfeiting; only an active Push forfeits one. A **plotted route** is the third case and it is the strict one: it is never resolved while the client is closed — the walk is dropped, the character stays where it stopped, and ordinary offline idling resumes there. An away period can never be turned into free ground.
- Camp/Push is unchanged: a Push still returns the character to the Camp of the current zone (`combat.md` section 4). A Push mid-walk skips the rest of the block chain the character is on rather than ending the route, so a repeated Push cannot loop a Circuit forever; the camp branch holds the block clock still, and the walk resumes when the camp ends.

# 8. Compatibility audit

| System | Rule it holds | Effect of the town layer | Verdict |
|---|---|---|---|
| `concept.md` core loop | Select zone → fight → craft → next zone | adds "and where do I sit / sell", one click | **Compatible** — travel is instant by default |
| `concept.md` Active vs AFK | AFK keeps fighting · offline 12 h · quality floor only | a Circuit's current lap runs offline on the base table, then parks (section 7) | **Compatible, no table change** |
| `concept.md` no resource skills | only combat levels | no settlement level, no gathering, Standing counts kills | **Compatible** |
| `world.md` zone unlock | by level, not by boss or place | a settlement can never gate a zone | **Compatible** |
| `loot.md` F1-F3 | 589 kills a band, 139 drops per 1,000 kills | modes A/B cost zero time; C/D are opt-in and pay less | **Compatible** |
| `loot.md` F5-F10 | stone income = stone spend | gold takes all convenience purchases, so it no longer competes with craft prices at all | **Cleaner than before** |
| `loot.md` section 4 | rejected piece → 1 Reroll value stone instantly, no Bag Cap | now → 1 stone **or** 1 gold, chosen per filter rule, default dissolve | **Rule change, small** |
| `loot.md` section 1 step 2 | Base rolls equally in slot | per-settlement Base bias is the unused hook | **Needs re-simulation first** |
| `crafting.md` prices | 8 / 8 / 1+8 / N stones | untouched — no convenience is priced in stones anymore | **No change** |
| `farm.md` shop | 4 convenience items, convenience only | split between Steward (deeds) and Porter (pouch), repriced in gold | **Extension** |
| `tasks.md` bound | payouts ≤ ~10% of section 5 flow/day | skip tokens are purchases, not payouts | **Compatible** |
| `save.md` | 3 slots, local, JSON export with schema version | adds gold, visited settlements, Road links, Standing, pedlar stock + refresh day, Collector progress, per-slot sell/dissolve choice | **Additive · export schema version must bump** |
| `save.md` Road row | the leg being walked | adds the block the character is on and the route it belongs to — a walk has to survive a reload or the character reappears at a settlement it never left | **Additive** |
| `formula.md` section 11 weight | over capacity cuts aspd to -50% | "carry the loot home" is *not* modelled: pieces convert on the spot (`loot.md` section 4) | **Deliberately refused** |
| `elements.md` | res prepared from the zone played | town Element identity is the reason to shop by region | **Supports** |
| `combat.md` section 4/7 | Push rest, boss = active gate | Camp = settlement · Road pays no stones | **Compatible** |
| `checks.md` H1 | new power folds into `mob_HP` same step | nothing here grants a stat, so no new `mob_HP` term | **Compatible — and this is the reason the "no power" rule exists** |
| `checks.md` G1 | was "one stone-priced convenience shop only" | now gold-priced stalls across 9 settlements | **Rewritten: G1 + G6-G9** |
| `AGENT.md` section 6 | forbade currency/shops | user chose D1 = real gold | **Amended, with the power ban kept** |
| `skill-pool.md` `skill-tree.md` | no location dependency | none | **No change** |

# 9. Doors — chosen

| Door | Choice | Consequence |
|---|---|---|
| D1 currency | **Real gold from kills** — implemented as the sell/dissolve choice so it is a decision, not a clock (`economy.md`) | rewrote `economy.md` · `loot.md` sections 4 and 6 · `checks.md` G1, new G6-G9 · `AGENT.md` section 6 · `glossary.md` · `save.md` |
| D2 NPC scope | **Convenience + stone-saving services** (classes 1 and 2) | Armourer repair-for-gold is allowed but must stay more expensive than the elite time it replaces · blocked on F9/F13 |
| D3 travel | **All four modes**, staged by section 7 | C/D must be advertised as income-negative · a Circuit runs its current lap offline on the base table, then parks |

# 10. Open

**Closed by the generated tables** (`towns-stalls.md` sections 1-9 · `checks.md` group T):

- Exact gold price per line, in kills of income — every Steward · Porter · Guild clerk · Armourer · Waypoint keeper · pedlar line is priced and regenerated from `tools/data/town.json`.
- Standing tier kill thresholds — written from F1 kill counts, not invented (27 thresholds, `checks.md` T12).
- Collector set contents (3 sets × 3 pieces, one per Base school) and their payment — items only, no gold stipend, so gold keeps exactly two mints (`checks.md` G6 · T14).
- Pedlar refresh — per **real day**, not the 12-hour offline clock, so a refresh is a reason to return.
- Per-settlement NPC rosters and stock — the placement rules are checked, not repeated by hand (`checks.md` T-R · T-S).

**Still open:**

- The F9 and F13 lines that the Armourer floor and the pouch ladder depend on (`towns-stalls.md` section 9). F13 (herb bundles per 1,000 kills) is derived from `engine.json` `herbs` and the pouch ladder prices off it — a measurement `towns-stalls.md` section 9 prints, not a new rule.
- Whether Capitals are visible on the map before their level requirement, i.e. does the map tease the next band (`towns-ui.md` section 12 item 1). **Owner decision — a UI preference, no number depends on it.**

(End of file)
