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
| Decision frequency collapses to 1-5/hour | `loot.md` section 3 conclusion 1 · `concept.md` failure point 1 | "where do I sit, what do I sell for" is a new decision that costs no automation |

**The danger this layer must not create** — an NPC that sells power is a progression axis no `mob_HP` line covers (`checks.md` H1). Every rule here keeps purchases to **space · time · information · appearance**.

# 1. Reference notes — taken and refused

| Source | Mechanic | Taken here | Refused here |
|---|---|---|---|
| **Melvor Idle** | ~20 skills, area lists, clue/trail content, shared bank | settlement as hub (stash, bench, one click to a zone) · trail/Collector turn-in as a reason to travel | any skill gate on entry (combat only · `concept.md`) |
| **Path of Exile** | town hubs per act, one service per NPC, waypoint network, master vendors, divination-card turn-in | Waypoints · one NPC = one service, never a general store · Collector set turn-in · town as the place where all services concentrate | quest gating that blocks zone access (zones unlock by level only · `world.md`) |
| **Black Desert** | town reputation → vendor stock and worker slots · houses with storage · weight · camps | Standing that unlocks stock · house = stash + plot + waypoint anchor · weight system already lives in `formula.md` section 11 | workers, node managers, life skills, market buy-orders, player trading — all resource-skill or economy systems (`concept.md`, `economy.md`) |
| **Isekai anime** | guild registration, receptionist, request board, town as safe place, each town's merchants stock different goods, carriage between cities, "bring the materials to town" | 3 capitals + 6 towns over zones 1-9 · per-town specialty goods · Guild board = `tasks.md` · registration = Standing tiers · sell-or-dissolve at the counter is the "bring it back to town" loop | an NPC selling the hero a shortcut — no gear, no Mods, no potions, no stones |

# 2. Vocabulary

| Term | Meaning |
|---|---|
| **Settlement** | One named place holding services and NPCs. Never holds combat. |
| **Capital** | A settlement serving one quality band (low / mid / high) with the full service set. 3 total. |
| **Zone** | The combat area attached to a settlement. The 9 zones of `world.md` are unchanged — a settlement never replaces a zone. |
| **Road** | The link between two settlements. Travel only; content on it exists only in opt-in mode (section 7). |
| **Waypoint** | A Road made instant by having visited its settlement once. |
| **Camp** | The Push rest location only (`combat.md` section 4) = the settlement owning the current zone. Not a general word for base. |
| **Standing** | Per-settlement unlock counter. Never spendable, never a currency, never grants a stat. |
| **Sell / Dissolve** | The bag filter's third choice on a rejected piece: 1 gold or 1 Reroll value stone, never both (`economy.md`). |

# 3. What travel may never cost

Kills are the whole economy: F1 1,800 kills/hour and F3 418 drops/hour assume the player fights every second they are in a zone. So the invariant for every travel mode in section 7 is:

```
travel that consumes real time  →  may never be mandatory
                                 →  may never be the best income choice
                                 →  may never be the state the character is in while offline
```

# 4. Map — 9 zones onto 3 capitals and 6 towns

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

Prices are in **gold**, written as minutes of full-sell income (`economy.md`: 1 junk sold = 1 gold, 6.9 gold per minute in the high band). The exact price of every line below is in `towns-stalls.md` sections 3-4, generated from `tools/data/town.json`.

| NPC | Where | Sells / does | Kind | Price anchor | Why it is not power |
|---|---|---|---|---|---|
| **Counterhand** | every settlement | The sell/dissolve switch itself, and the per-slot filter rules | information | free · extra preset slot 30 m | the filter already decides this; the counter only makes it legible |
| **Steward** | capitals | Plot deed 4, Plot deed 5 (from `farm.md`) · house (stash tabs + 1 farm plot + waypoint anchor) | space | 120-540 m | farm outputs herbs only, never gear · house grants no combat effect |
| **Porter** | every settlement | Stash tab, Herb pouch II/III, category slot (herbs/stones/gear display) | space | 30-300 m | `loot.md` section 4 has no Bag Cap today, so storage is a sink with a real product |
| **Guild clerk** | capitals | Task skip token: 1 extra skip per slot per day on top of the free skip in `tasks.md` | time | 8 m each · 3/day cap | capped at 1 per slot per day · payouts unchanged, so the tasks.md ≤10% bound is untouched |
| **Armourer** | all capitals + Ironrow, Bonegate, Frosthold | Repair service: clears Broken and refills protection for gold, no Repair stone | time | 14 m · 12 m at Ironrow, above the 3.3 m elite floor | **D2 service class** — it converts a rare-stone dependency into gold, so it must never be cheaper than hunting. Blocked on F9/F13 rates |
| **Herbalist** | Millbrook, capitals | Sells plot upgrades and pouch tiers; buys nothing | space | 60-240 m | **refused as a buyer**: converting herb drops into gold would be a third mint of the medium, i.e. the "money from what you already farm" trap `economy.md` was written to avoid. Herbs stay potion fuel only |
| **Waypoint keeper** | every settlement | Opens a Road link (first visit), shows the map, moves the anchor | time | 20 m per link (one-time) · 6 m re-anchor | convenience · this is travel mode B |
| **Collector** | Ashfall, Bonegate, Vermolch (one set each) | Turns in a named set of junk pieces for one cosmetic, one stash tab, or one title | space/appearance | item-only, no gold · hint line 15 m | turn-in is a sink of *items*, PoE divination-card shape without the Mod reward |
| **Curio pedlar** | Highspire, Vermolch | Rotating 3-slot stock, refreshes per real day: banners, Base tints, titles, extra plot slots | appearance | 30-120 m · prestige title 300 m | the rotation is a reason to log in, which is the `concept.md` "reason to return" line |
| **Furrier** | Wolf Cross | Bag category slots and the settlement's banner cosmetic | space/appearance | 45 m · 90 m | sells display space, never a pelt to grind: no gathering exists (`concept.md`) |
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
| **B Carriage** | first visit to an unlinked settlement costs gold | the link | 20 m of income per link (`checks.md` T9) · one-time · sink only |
| **C Road time** | opt-in: walk the Road, or loop a Circuit, instead of the Waypoint, a few real minutes per leg | Standing in the settlement each leg arrives at | ladder leg 5 min, branch leg 8 or 12 · a Circuit runs offline (its current lap only) · never required for anything |
| **D Road events** | on a Road leg: ambush, caravan escort, traveling pedlar, a chest — one encounter per Road minute, from the link's own terrain table | gold (ladder links) · Standing · one Item from a chest · cosmetic stock the towns do not carry | total ≤ the value of an equal hour spent farming, measured against F1/F5 · pays **no stones**, so boss and elite gates (G5, F7-F10) keep their monopoly on power · the chest is capped once per link per day |

- **C+D are a content choice, not an income choice.** A Road hour forfeits 1,800 kills for at most a few percent of that value, and that trade must be stated in the UI before the player steps onto the Road. Its purpose is the thing farming cannot give: the isekai travel beat, the encounter, the merchant who only travels.

### What the Road actually is

Generated from `engine.json` `road` — edit the data, run `node tools/check.ts --write`. The mint bound and the Standing rate are guarded by **X36**, so the Road cannot become a second income faucet.

<!-- BEGIN GENERATED:road-rules -->
| Road element | Value |
|---|---|
| Ladder links (8, 5 min, pays the purse) | **Eastgate ↔ Millbrook** · ladder · river · 5 min · **Millbrook ↔ Ashfall** · ladder · forest · 5 min · **Ashfall ↔ Ironrow** · ladder · road · 5 min · **Ironrow ↔ Wolf Cross** · ladder · mountain · 5 min · **Wolf Cross ↔ Highspire** · ladder · moor · 5 min · **Highspire ↔ Bonegate** · ladder · mountain · 5 min · **Bonegate ↔ Frosthold** · ladder · forest · 5 min · **Frosthold ↔ Vermolch** · ladder · river · 5 min |
| Branch links (3, no purse) | **Eastgate ↔ Ashfall** · branch · mountain · 8 min · no purse · **Highspire ↔ Frosthold** · branch · mountain · 8 min · no purse · **Wolf Cross ↔ Bonegate** · branch · river · 12 min · no purse |
| Trip length · encounters | a link runs for its own `trip_min` · 1 encounter per Road minute |
| Circuit | an ordered list of links that repeats until stopped; a single trip is the one-link case. A Push skips the rest of the leg — it never ends the Circuit. Editable only while standing in a settlement, never while travelling |
| Offline | the Circuit plays out the rest of its lap on the **untilted base table**, then parks the character in a zone before normal idling resumes — an away period can never be routed into ambush country |
| After the first visit | the Waypoint is free and instant; opening a link costs the carriage price in `towns.md` section 5 |

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
| ambush | 54% | road 48 · river 45 · forest 61 · mountain 70 · moor 46 | 2-3 from the lower zone cast, at the player level clamped into that range | normal 8% drop roll + a 3 gold purse · loss: Push as usual, the leg is forfeit and the purse is lost |
| caravan | 24% | road 28 · river 30 · forest 19 · mountain 15 · moor 28 | 1 Large from the higher zone cast + 2 Small from the lower | Standing only, no gold · loss: Standing 0 and the leg ends |
| pedlar | 12% | road 16 · river 15 · forest 9 · mountain 7 · moor 13 | none | gold sink only · loss: n/a |
| chest | 10% | road 8 · river 10 · forest 11 · mountain 8 · moor 13 | none | one Item at the destination zone's quality ceiling · loss: n/a |

The base column is the plain average of the terrain rows and is what an **offline** session rolls, so the tilt can never be farmed while away. The purse pays **3 gold on a ladder link only**, once per link per day, so the Road can never mint more than **24 gold/day** while one 6-hour farming session mints thousands by selling junk — Road gold is a rounding error, which is what "C+D are a content choice, not an income choice" has to mean. A chest pays one Item at the destination zone's ceiling, is capped once per link per day, and pays **no crafting stones**. Standing is granted in kill-equivalents (**15** per completed leg), under a fifth of what the same minutes would earn hunting (**X36**). Losing a one-off trip forfeits roughly 120 kills of progress and the purse; a Push inside a Circuit simply skips the leg.
<!-- END GENERATED:road-rules -->

- **Offline on the Road** — if the game closes mid-Circuit, the rest of that lap plays out on the **untilted base table** and the character is then parked in a zone, where ordinary offline idling resumes. The base table is what bounds the mint: routing a Circuit through the heaviest-ambush terrain cannot be paid at the tilted rate while the player is away. A one-off trip left alone resolves itself rather than forfeiting; only an active Push forfeits one.
- Camp/Push is unchanged: a Push still returns the character to the Camp of the current zone (`combat.md` section 4).

# 8. Compatibility audit

| System | Rule it holds | Effect of the town layer | Verdict |
|---|---|---|---|
| `concept.md` core loop | Select zone → fight → craft → next zone | adds "and where do I sit / sell", one click | **Compatible** — travel is instant by default |
| `concept.md` Active vs AFK | AFK keeps fighting · offline 12 h · quality floor only | a Circuit's current lap runs offline on the base table, then parks (section 7) | **Compatible, no table change** |
| `concept.md` no resource skills | only combat levels | no settlement level, no gathering, Standing counts kills | **Compatible** |
| `world.md` zone unlock | by level, not by boss or place | a settlement can never gate a zone | **Compatible** |
| `loot.md` F1-F3 | 1,800 kills/hr, 418 drops/hr | modes A/B cost zero time; C/D are opt-in and pay less | **Compatible** |
| `loot.md` F5-F10 | stone income = stone spend | gold takes all convenience purchases, so it no longer competes with craft prices at all | **Cleaner than before** |
| `loot.md` section 4 | rejected piece → 1 Reroll value stone instantly, no Bag Cap | now → 1 stone **or** 1 gold, chosen per filter rule, default dissolve | **Rule change, small** |
| `loot.md` section 1 step 2 | Base rolls equally in slot | per-settlement Base bias is the unused hook | **Needs re-simulation first** |
| `crafting.md` prices | 8 / 8 / 1+8 / N stones | untouched — no convenience is priced in stones anymore | **No change** |
| `farm.md` shop | 4 convenience items, convenience only | split between Steward (deeds) and Porter (pouch), repriced in gold | **Extension** |
| `tasks.md` bound | payouts ≤ ~10% of section 5 flow/day | skip tokens are purchases, not payouts | **Compatible** |
| `save.md` | 3 slots, local, JSON export with schema version | adds gold, visited settlements, Road links, Standing, pedlar stock + refresh day, Collector progress, per-slot sell/dissolve choice | **Additive · export schema version must bump** |
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

- Exact gold price per line, in minutes of income — every Steward · Porter · Guild clerk · Armourer · Waypoint keeper · pedlar line is priced and regenerated from `tools/data/town.json`.
- Standing tier kill thresholds — written from F1 kills/hour, not invented (27 thresholds, `checks.md` T12).
- Collector set contents (3 sets × 3 pieces, one per Base school) and their payment — items only, no gold stipend, so gold keeps exactly two mints (`checks.md` G6 · T14).
- Pedlar refresh — per **real day**, not the 12-hour offline clock, so a refresh is a reason to return.
- Per-settlement NPC rosters and stock — the placement rules are checked, not repeated by hand (`checks.md` T-R · T-S).

**Still open:**

- The F9 and F13 lines that the Armourer floor and the pouch ladder depend on (`towns-stalls.md` section 9). F13 (herb bundles/hr) is derived from `engine.json` `herbs` and the pouch ladder prices off it — a measurement for `harness/todo.md` section B, not a new rule.
- Whether Capitals are visible on the map before their level requirement, i.e. does the map tease the next band (`towns-ui.md` section 12 item 1). **Owner decision — a UI preference, no number depends on it.**

(End of file)
