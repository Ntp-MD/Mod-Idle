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

**Spec draft** — the three doors in section 9 are now chosen (D1 = real gold · D2 = convenience + services · D3 = walking, with a Waypoint that opens on the first arrival on foot). Numbers still anchor to `checks.md` groups F/E and none of them change kill rates or `mob_HP`.

**This file is the index.** The prices, rosters, stock tables, Standing kill thresholds and Collector sets live in `towns-stalls.md`, and every one of those tables is *generated* from `tools/data/town.json` by `node tools/town.ts --write` (cage: `checks.md` group T). The screens that render them are specified in `towns-ui.md`.

# 0. What this layer is for

| Hole this fills | Evidence | Answer |
|---|---|---|
| The shop had no home | `farm.md` Shop listed 4 items with no owner and no place | settlement stalls with owners (section 5) |
| The task board had no home | `tasks.md` 3 level-gated slots, no fiction | Guild counter (section 5) |
| Spatial vocabulary was broken | `combat.md` section 4 Push step 1 said "leave zone back to **camp**" · `world.md` said "rolled on every **room** entry" · everything else said zone | one vocabulary, section 2 · `room` now removed |
| Per-zone Base bias was allowed but unused | `item-base.md` "if Bases should roll unequally (e.g. plate spawns more in soldier zones), add a column to the zone table" | settlement identity is that column (section 4, gated on a re-simulation) |
| No sink for non-craft income | gold had nowhere to go once the one-time purchases were done | repeatable sinks, `economy.md` table |
| Decision frequency collapses as a zone is farmed | `loot.md` section 3 conclusion 1 · `concept.md` failure point 1 | "where do I sit, what do I sell for" is a new decision that costs no automation |

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
| **Block** | One hex on the lattice. Walking is counted in blocks, and the blocks between two settlements are their hex distance (section 7). |
| **Walk** | Crossing blocks to reach a settlement. Every block costs seconds and rolls one chance of an ambush. |
| **Waypoint** | A settlement opened by arriving on foot: after that a warp there is free and instant (section 7). |
| **Waystone** | The planned second kind of Waypoint destination. Not yet in the world. |
| **Camp** | The Push rest location only (`combat.md` section 4) = the settlement owning the current zone. Not a general word for base. |
| **Standing** | Per-settlement unlock counter. Never spendable, never a currency, never grants a stat. |
| **Sell / Dissolve** | The bag filter's third choice on a rejected piece: 1 gold or 1 Reroll value stone, never both (`economy.md`). |

# 3. What travel may never cost

Kills are the whole economy: the band's kill stream and its drop line assume the player fights every second they are in a zone. So the invariant for travel in section 7 is:

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
| 2 | 11-20 | Highspire | **low capital** | cold / lightning | Ring Mail | full set + Herbalist + Curio pedlar |
| 3 | 21-30 | Wolf Cross | — | cold | light | Counterhand · Porter · Waypoint keeper · Furrier |
| 4 | 31-40 | Greyfen | — | poison / chaos | waste | Counterhand · Porter · Waypoint keeper |
| 5 | 41-50 | Saltmarrow | **mid capital** | chaos | salt | full set + Herbalist |
| 6 | 51-60 | The Pale Spire | **mid capital** | chaos / poison | rock | full set + Herbalist |
| 7 | 61-70 | Blackwater Reach | — | poison | water | Counterhand · Porter · Waypoint keeper |
| 8 | 71-80 | Bonegate | — | chaos | heavy (Armour) | Counterhand · Porter · Waypoint keeper · Armourer · Collector |
| 9 | 81-90 | Frosthold | — | cold | heavy | Counterhand · Porter · Waypoint keeper · Armourer |
| 10 | 91-100 | Vermolch | **low capital** | poison / chaos | heavy · cloth (glass endgame) | full set + Collector + Curio pedlar + Herbalist |
| 11 | 101-110 | Duskmoor | — | cold / chaos | moor | Counterhand · Porter · Waypoint keeper |
| 12 | 111-120 | Nettlecrag | **low capital** | chaos / poison | forest · rock | full set + Herbalist |
| 13 | 121-130 | Emberhold | — | fire | ash | Counterhand · Porter · Waypoint keeper |
| 14 | 131-140 | Millbrook | — | poison | cloth / light | Counterhand · Porter · Waypoint keeper · Herbalist |
| 15 | 141-150 | Wyrmback | — | fire / cold | water · snow | Counterhand · Porter · Waypoint keeper |
| 16 | 151-160 | Ashfall | **high capital** | fire | light (Evasion) | full set + Collector + Herbalist |
| 17 | 161-170 | Ironrow | — | lightning | light / Ring Mail | Counterhand · Porter · Waypoint keeper · Armourer |
| 18 | 171-180 | Thornwake | — | poison | forest · marsh | Counterhand · Porter · Waypoint keeper |

- **Base trio** = Counterhand · Porter · Waypoint keeper, in every settlement.
- **Full set** = base trio + Steward · Guild clerk · Armourer · Herbalist (capitals only, so "different NPCs per town" stays true without nine clone shops).
- **Collector** sits where a set is turned in: Ashfall · Bonegate · Vermolch. **Curio pedlar** at Highspire · Vermolch only. **Furrier** at Wolf Cross only. Frosthold's Armourer is the Siege variant.
- The generated roster matrix and per-settlement stock are in `towns-stalls.md` section 5 · the placement rules are checked as `checks.md` T-R / T-S.
- A capital keeps its town, and its band label follows the town, because bands now run out from the start by distance rather than closing on the zone list: Highspire (low) · Saltmarrow (mid) · The Pale Spire (mid) · Vermolch (low) · Nettlecrag (low) · Ashfall (high). A band therefore no longer ends on a capital, and a capital's house line is still sold by its own Steward in its own town.
- Levels 91-100 add no settlement (`world.md`); endgame play sits in Vermolch.
- Base bias is **flavor only** until `loot.md` section 3 keep-rates are re-simulated with an unequal step-2 roll (`towns-stalls.md` section 8 · `checks.md` T15).

# 5. NPC roster — differentiated by inventory, bounded by purchase kind

Prices are in **gold**, charged at the band of the place that sells them (`economy.md`: 1 junk sold = 1 gold, 0.136 gold per kill in the high band). The exact price of every line below is in `towns-stalls.md` sections 3-4, generated from `tools/data/town.json`.

| NPC | Where | Sells / does | Kind | Price anchor | Why it is not power |
|---|---|---|---|---|---|
| **Counterhand** | every settlement | The sell/dissolve switch itself, and the per-slot filter rules | information | free · extra preset slot 30 m | the filter already decides this; the counter only makes it legible |
| **Steward** | capitals | Plot deed 4, Plot deed 5 (from `farm.md`) · house (stash tabs + 1 farm plot + waypoint anchor) | space | 120-540 m | farm outputs herbs only, never gear · house grants no combat effect |
| **Porter** | every settlement | Stash tab, Herb pouch II/III, category slot (herbs/stones/gear display) | space | 30-300 m | `loot.md` section 4 has no Bag Cap today, so storage is a sink with a real product |
| **Guild clerk** | capitals | Task skip token: 1 extra skip per slot per day on top of the free skip in `tasks.md` | time | 8 m each · 3/day cap | capped at 1 per slot per day · payouts unchanged, so the tasks.md ≤10% bound is untouched |
| **Armourer** | all capitals + Ironrow, Bonegate, Frosthold | Repair service: clears Broken and refills protection for gold, no Repair stone | time | 14 m · 12 m at Ironrow, above the 3.3 m elite floor | **D2 service class** — it converts a rare-stone dependency into gold, so it must never be cheaper than hunting. Blocked on F9/F13 rates |
| **Herbalist** | Millbrook, capitals | Sells plot upgrades and pouch tiers; buys nothing | space | 60-240 m | **refused as a buyer**: converting herb drops into gold would be a third mint of the medium, i.e. the "money from what you already farm" trap `economy.md` was written to avoid. Herbs stay potion fuel only |
| **Waypoint keeper** | every settlement | Shows the map and opens this settlement's Waypoint — it costs nothing, because you opened it by walking here | information | free | not a line on the price list: a Waypoint opens on foot and warps free, so there is nothing to sell |
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

# 7. Travel — walking, and the Waypoint it opens

Travel has one rule and one convenience:

- **Walking** is how a settlement is reached the first time. The world is a hex lattice; the blocks between two settlements are their hex distance, and the character crosses them one at a time. Every block costs real seconds and rolls one chance of an ambush.
- **A Waypoint** opens the first time the character arrives at a settlement on foot, costs nothing, and after that warps there free and instantly. A **Waystone** will be a second destination kind on the same rule — it is a thing a Waypoint may target, not a thing that changes what walking costs.

There is no Carriage, no link to buy, no branch shortcut and no Circuit. The block count *is* the distance, so a route you pay for is a route that costs no more time than walking it, and a loop you do not drive costs nothing to keep.

**What an ambush pays is a kill's pay.** It is an ordinary mob group from the zone the walk joins, fought with the ordinary rules, and it rolls the ordinary drop. There is no gold purse, no chest, no Standing for a leg and no crafting stone: gold is minted by selling junk at the Counterhand and by nothing else (`economy.md`, `checks.md` G6), and Standing is earned by kills in a settlement's own zone (section 6).

**A Push does not cost you the road.** It is the ordinary Push (`combat.md` section 4): rest at the Camp of the zone you were ambushed in, then walk back in on the block you were ambushed on. The walk keeps its blocks, so a Push costs time and nothing else.

### What the walk actually is

Generated from `engine.json` `road` — edit the data, run `node tools/check.ts --write`. The shape is guarded by **X36** (the graph is closed and the walk mints nothing) and **X46** (it is online-only and Push-neutral).

<!-- BEGIN GENERATED:road-rules -->
| Walk element | Value |
|---|---|
| The world | a pointy-top hex lattice; a settlement owns its own hex and the blocks between two settlements are their hex distance, derived from the axial coordinates and never typed |
| Every pair | walkable — there is no link list, no route to buy and no branch shortcut, because the block count *is* the distance |
| A block | 10 real seconds |
| An encounter | 16.6667% per block crossed · Eastgate → Highspire is 3 blocks, so 0.50 fights in expectation |
| What a fight pays | the ordinary drop roll and nothing else — no gold purse, no chest, no Standing, no crafting stones |
| A Push | the ordinary Push: rest at the camp of the zone it was ambushed in, then walk back in on the block it was ambushed on. It never ends a walk and never gives back a block |
| A Waypoint | unlocked by arriving on foot, once, and it costs nothing · warps to any unlocked settlement free and instantly · never gates a zone · a Waystone will be a second destination kind |
| Offline | a walk is online only — an away period never crosses a block |

| Settlement | Zone | Distance from the first settlement |
|---|---|---|
| Eastgate | zone 1 | 0 blocks · 0s from Eastgate |
| Highspire | zone 2 | 3 blocks · 30s from Eastgate |
| Wolf Cross | zone 3 | 3 blocks · 30s from Eastgate |
| Greyfen | zone 4 | 4 blocks · 40s from Eastgate |
| Saltmarrow | zone 5 | 4 blocks · 40s from Eastgate |
| The Pale Spire | zone 6 | 5 blocks · 50s from Eastgate |
| Blackwater Reach | zone 7 | 6 blocks · 60s from Eastgate |
| Bonegate | zone 8 | 6 blocks · 60s from Eastgate |
| Frosthold | zone 9 | 6 blocks · 60s from Eastgate |
| Vermolch | zone 10 | 6 blocks · 60s from Eastgate |
| Duskmoor | zone 11 | 7 blocks · 70s from Eastgate |
| Nettlecrag | zone 12 | 7 blocks · 70s from Eastgate |
| Emberhold | zone 13 | 9 blocks · 90s from Eastgate |
| Millbrook | zone 14 | 9 blocks · 90s from Eastgate |
| Wyrmback | zone 15 | 9 blocks · 90s from Eastgate |
| Ashfall | zone 16 | 10 blocks · 100s from Eastgate |
| Ironrow | zone 17 | 10 blocks · 100s from Eastgate |
| Thornwake | zone 18 | 10 blocks · 100s from Eastgate |

Distances are hex distances computed from the walk graph, so the sheet and the rule can never disagree about how far a place is.
<!-- END GENERATED:road-rules -->

- **Offline** — a walk is online only. An away period never crosses a block and never opens a Waypoint, so closing the game mid-walk leaves the character where it stood on that block and the walk exactly as long as it was. Ordinary offline idling resumes where it always does.
- Camp/Push is unchanged: a Push still returns the character to the Camp of the current zone (`combat.md` section 4), and the walk resumes from the block it was ambushed on.

# 8. Compatibility audit

| System | Rule it holds | Effect of the town layer | Verdict |
|---|---|---|---|
| `concept.md` core loop | Select zone → fight → craft → next zone | adds "and where do I sit / sell", one click | **Compatible** — a Waypoint warps free once walked to |
| `concept.md` Active vs AFK | AFK keeps fighting · offline 12 h · quality floor only | a walk is online only and an away period never crosses a block (section 7) | **Compatible, no table change** |
| `concept.md` no resource skills | only combat levels | no settlement level, no gathering, Standing counts kills | **Compatible** |
| `world.md` zone unlock | by level, not by boss or place | a settlement can never gate a zone | **Compatible** |
| `loot.md` F1-F3 | the band's kill stream and its drop line | a Waypoint warp costs no time and pays nothing; a walk costs blocks and pays kills | **Compatible** |
| `loot.md` F5-F10 | stone income = stone spend | gold takes all convenience purchases, so it no longer competes with craft prices at all | **Cleaner than before** |
| `loot.md` section 4 | rejected piece → 1 Reroll value stone instantly, no Bag Cap | now → 1 stone **or** 1 gold, chosen per filter rule, default dissolve | **Rule change, small** |
| `loot.md` section 1 step 2 | Base rolls equally in slot | per-settlement Base bias is the unused hook | **Needs re-simulation first** |
| `crafting.md` prices | 8 / 8 / 1+8 / N stones | untouched — no convenience is priced in stones anymore | **No change** |
| `farm.md` shop | 4 convenience items, convenience only | split between Steward (deeds) and Porter (pouch), repriced in gold | **Extension** |
| `tasks.md` bound | payouts ≤ ~10% of section 5 flow/day | skip tokens are purchases, not payouts | **Compatible** |
| `save.md` | 3 slots, local, JSON export with schema version | adds gold, visited settlements (which *are* the Waypoints), Standing, pedlar stock + refresh day, Collector progress, per-slot sell/dissolve choice | **Additive · export schema version must bump** |
| `formula.md` section 11 weight | over capacity cuts aspd to -50% | "carry the loot home" is *not* modelled: pieces convert on the spot (`loot.md` section 4) | **Deliberately refused** |
| `elements.md` | res prepared from the zone played | town Element identity is the reason to shop by region | **Supports** |
| `combat.md` section 4/7 | Push rest, boss = active gate | Camp = settlement · a Push keeps the walk's blocks | **Compatible** |
| `checks.md` H1 | new power folds into `mob_HP` same step | nothing here grants a stat, so no new `mob_HP` term | **Compatible — and this is the reason the "no power" rule exists** |
| `checks.md` G1 | was "one stone-priced convenience shop only" | now gold-priced stalls across 9 settlements | **Rewritten: G1 + G6-G9** |
| `AGENT.md` section 6 | forbade currency/shops | user chose D1 = real gold | **Amended, with the power ban kept** |
| `skill-pool.md` `skill-tree.md` | no location dependency | none | **No change** |

# 9. Doors — chosen

| Door | Choice | Consequence |
|---|---|---|
| D1 currency | **Real gold from kills** — implemented as the sell/dissolve choice so it is a decision, not a clock (`economy.md`) | rewrote `economy.md` · `loot.md` sections 4 and 6 · `checks.md` G1, new G6-G9 · `AGENT.md` section 6 · `glossary.md` · `save.md` |
| D2 NPC scope | **Convenience + stone-saving services** (classes 1 and 2) | Armourer repair-for-gold is allowed but must stay more expensive than the elite time it replaces · blocked on F9/F13 |
| D3 travel | **Walking**, with a Waypoint opening on first arrival on foot | no travel line to buy and nothing to price · an ambush pays a kill's pay and nothing more · a Push costs no block |

# 10. Open

**Closed by the generated tables** (`towns-stalls.md` sections 1-9 · `checks.md` group T):

- Exact gold price per line, at the selling band — every Steward · Porter · Guild clerk · Armourer · pedlar line is priced and regenerated from `tools/data/town.json`. The Waypoint keeper has no line, because a Waypoint is not for sale.
- Standing tier kill thresholds — written from the band's kill stream, not invented (27 thresholds, `checks.md` T12).
- Collector set contents (3 sets × 3 pieces, one per Base school) and their payment — items only, no gold stipend, so gold keeps exactly two mints (`checks.md` G6 · T14).
- Pedlar refresh — per **real day**, not the 12-hour offline clock, so a refresh is a reason to return.
- Per-settlement NPC rosters and stock — the placement rules are checked, not repeated by hand (`checks.md` T-R · T-S).

**Still open:**

- The F9 and F13 lines that the Armourer floor and the pouch ladder depend on (`towns-stalls.md` section 9). F13 (herb bundles per kill) is derived from `engine.json` `herbs` and the pouch ladder prices off it — a measurement `towns-stalls.md` section 9 prints, not a new rule.
- Whether Capitals are visible on the map before their level requirement, i.e. does the map tease the next band (`towns-ui.md` section 12 item 1). **Owner decision — a UI preference, no number depends on it.**

(End of file)
