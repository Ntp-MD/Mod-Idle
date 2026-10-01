# Design rules — 36 rules that must not be broken

> Back to: [README.md](../../index.md) · decisions: [decisions.md](../game-design-document.md)

**28 original + 8 promoted out of prose.** `SLOT-BUDGET` `GROUP-EXCLUSIVE` `CUR-SOURCECAP` `CRAFT-GUARANTEED` used to be sentences buried inside other rules or inside the evidence; they became their own IDs because they change formulas. `BAND-DISPLAY` `TAGGED-VERBATIM` `TEXT-VERIFIABLE` `NO-DRAG` came from D13 (text-based). `PRESET-BOUNDED` came from the `evidence/03` vs `06` contradiction.

## How to use this file

**IDs are names, not sequence numbers** — never renumber. If a rule is removed, mark it `deprecated` and leave it there; everything cites it by name.

Find one with `rg -n "AXIS-LAYER" .`

### Namespace — things that are SHOUTED but are **not** rule IDs

| Name | What it is | Status |
|---|---|---|
| `FORCE` `CADENCE` `PRECISION` `MASTERY` | core stat axis names | **hypothesis awaiting O1** — not yet rules |
| `MIGHT` `GRACE` `FOCUS` | the discarded 3-axis set | do not use |
| `BREACH` `SUNDER` `CHAIN` `SURGE` `EXPOSED` `FRACTURE` `ERUPTION` `WARD-BREAK` | **window kinds** — each one amplifies exactly one axis | defined in [spec-fantasy-content.md §10.1](../../01-world/regions/zones-and-monsters.md) |
| `D1`-`D15` · `R1`-`R4` · `O1`-`O10` | decision / refutation / open question | live in [decisions.md](../game-design-document.md) |
| `SLOT-GATE` `AXIS-LAYER` etc. | **actual rule IDs** | live in this file |

→ `rg "MASTERY"` also hits the axis name in the specs, and `rg "BREACH"` hits a window kind. Do not read either as a rule.

| status | means |
|---|---|
| `ok` | confirmed by measurement or primary source |
| `fixed` | was wrong, now corrected — do not forget what was wrong |
| `prov` | still a hypothesis, must be measured in a real harness |

---

## Group A — formula bounds (enforced at the physical level)

| ID | Rule | Evidence | status |
|---|---|---|---|
| `MAXHIT-CAP` | <=2 lines in the max-hit axis and <=25% of the envelope combined — PoE2 itself caps the roll at +25% | `evidence/05`, patch notes | ok |
| `ACC-FORMULA` | **No accuracy affix under Melvor's accuracy formula** (saturates at 94-99%, +60% acc buys 0.4-6 points). If the hit/miss axis is kept, switch to PoE's hyperbolic formula | [thesis.md §2.1](../pillars-vision.md), `evidence/07` | **fixed** |
| `PROC-WEIGHT` | proc weight <=1/3 of avg hit (a heavy proc gives ±57%, forcing Monte Carlo, which breaks valuation) | `evidence/01` | ok |
| `SLOT-BUDGET` | at most 2 slots share one additive damage pool before a swap stops being felt (S=2 gives +11.1%, above the ±9% noise floor) | `evidence/08` | ok |
| `TREE-BUDGET` | passive-tree +%damage in the same pool as gear gets **<= ~25% increased** (crossover is 178%, after which gear is invisible) | [spec-items.md](../../04-items/items-and-slots.md) §perceptibility | ok |

## Group B — itemisation structure

| ID | Rule | Evidence | status |
|---|---|---|---|
| `LINE-BUDGET` | line budget **4/6**, not 6-8 — D4: base affixes 3→4, tempering lets you choose, masterworking no longer adds value | R1, D4 | **fixed** |
| `DOWNSIDE-PLACEMENT` | ~~downside on RNG~~ → **downside lives on recipes / named items only** · every rolled affix must be positive | 3 independent sources (R2) | **fixed** |
| `GROUP-EXCLUSIVE` | "Only one modifier from any given group may appear on an object" = naturally forces lines onto different axes · this is the correct BI/Slot guard, replacing downside | PoE1 (R2) | prov |
| `BASETYPE-CARRIER` | attack speed / crit / implicit live on the **base type**, not the affix pool — PoE1: dagger 1.20-1.50 APS, crit 8-9%; Vaal Axe 1.15 vs Despot 1.40 | PoE1 | ok |
| `IDENTITY-DEF` | identity = the number of **zone-conditional mod kinds**, not line count, gating or pool size — 12/18 mods generic means a score ladder | `evidence/05`, `evidence/06` | ok |
| `DMG-CONDITIONAL` | unconditional damage% is budget-limited (25% envelope, nearly all of it on the weapon) · zone-conditional damage% is the main source of depth, because it does not collapse into one DPS number | `evidence/08` | ok |
| `BUILD-SIG` | no classes → build signature = `(tree flags + weapon base + gear tags)` as the single valuation unit · cache key = build hash | [spec-items.md](../../04-items/items-and-slots.md) | ok |
| `DROP-SMART` | build-aware smart drops ~85/15 (D3 Loot 2.0) — the 15% off-signature is the gambling source | D3 | ok |
| `RNG-PITY` | pity / pooled randomness instead of raw chance | Firestone | ok |

## Group C — content dimensions

| ID | Rule | Evidence | status |
|---|---|---|---|
| `DIM-PAIRING` | a content dimension needs **both** punish and amplify · punish alone cannot create a niche (resist / ailment-immunity are dead tags without amplify) — see **O8** | `evidence/09` (punish-only → trigger loses every time) + PoE2 | ok |
| `AMPLIFY-PAIR` | amplify is a parasite — worthless without infliction, must ship as a pair · **but "has amplify" is not enough**: `decay + conduit` still loses to FLAT, so amplify has to be strong enough to offset its own punish | `evidence/04` dependency probe · `evidence/09` | ok |
| `AMPLIFY-TIERFALL` | amplify must scale down with monster tier — PoE2: *"Elemental Exposure now has 15% less effect on Magic monsters, 30% less on Rare, 50% less on Unique"* | patch notes | ok |
| `MAG-CAP` | content magnitude must be capped from the player's side — **the 1.5x threshold is currently unsupported, see spec-fantasy-content.md §10.2** | `evidence/06` | prov |
| `CONTENT-TWOTIER` | two-tier magnitude: idle-safe zones (every loadout within ~20% of optimum) + contract content allowed a full cliff, because the player *chooses* it and is *awake* | `evidence/06` | ok |
| `PRESET-BOUNDED` | presets needed <= the number of **distinct winners**, not the number of zones — zones with the same winner share one preset · the only viable answer so far to the `evidence/03` (2 presets = 99.6%) vs `06` (4 presets = 92% at 15 zones) contradiction | `evidence/03` vs `06` · [spec-fantasy-content.md](../../01-world/regions/zones-and-monsters.md) §3 | prov |
| `PACK-FORMULA` | ~~pack <=3~~ → `packBonus = 1 + (pack-1)^0.55 × cleave` | `evidence/04` | **fixed** |

## Group D — survival (matters because there is no death)

| ID | Rule | Evidence | status |
|---|---|---|---|
| `DEF-TEMPO` | defensive stats must express as **tempo**, not mitigation — the currency of losing is time, not a life (D3) | D3 + [thesis.md §2](../pillars-vision.md) | ok |
| `MOM-PERSEC` | Momentum must **gain per second**, not per hit — per-hit makes attack speed 2x the best stat in the game and every build takes it (measured: 1.3s→2.6s changes the result 2.5x per-hit but 1.3x per-sec) | `evidence/09` | ok |
| `MOM-FLOOR` | the resource economy must have a floor, `net <= 0` is forbidden outright (e.g. `net = max(0.35·gain, gain − drain)`) — if the trigger never fires, an item that traded away base damage silently drops to ~53% offline, which is punishment the player cannot detect, and it contradicts D3 / `CONTENT-TWOTIER` | `evidence/09` | ok |

## Group E — economy

| ID | Rule | Evidence | status |
|---|---|---|---|
| `CUR-TIERLOCK` | salvage currency must not convert across tiers | loop analysis | prov |
| `CUR-SOURCECAP` | currency needs a source cap that is not tied to loot volume (otherwise crafting is always free = no decisions) | [spec-economy.md](../../03-gameplay/economy/economy.md) | prov |
| `CRAFT-GUARANTEED` | crafting is guaranteed, limited to 1 crafted mod per item · RNG lives on drops + a pity timer only | R4, PoE2 | ok |

## Group G — text direction (D13)

| ID | Rule | Evidence | status |
|---|---|---|---|
| `BAND-DISPLAY` | show kills/h as a **p5-p95 band**, not a mean — text exposes variance head-on, and a single number reads as a broken build · the band's width is the feedback, and it matches `CONTENT-TWOTIER` (idle-safe narrow, contract wide) | `evidence/01` + D14 | ok |
| `TAGGED-VERBATIM` | every zone-conditional affix must state its condition **in words**, never left to guess — the number says *how much*, the text says *when* · this rescues `SLOT-BUDGET`, which says +5.3% is invisible on the 4th slot of a shared pool | `evidence/08` + D13 | ok |
| `TEXT-VERIFIABLE` | every number the player sees must come from the sim and be traceable — no value "guessed to look good", and no value without `provenance` (measured/sourced/assumed/opinion) | `evidence/05`: 12/18 generic mods in one model = dead letters | ok |
| `NO-DRAG` | interaction must work through **reading + choosing** alone · no drag-drop, no tiles, no positional arrangement — if a design needs drag, it also needs a non-drag alternative | D2 (mobile-first) + auto-salvage handles bulk | ok |

## Group F — harness and scope

| ID | Rule | Evidence | status |
|---|---|---|---|
| `AXIS-LAYER` | core stat count <= the number of monster layers that actually decide (**1 axis : >=2 layers**) | `evidence/07` | ok |
| `TREE-DIM` | any tree node cluster without a matching content dimension is dead text · a dimension with nothing in the tree or gear answering it is a niche with no owner | `evidence/04`, `evidence/07` | ok |
| `SLOT-GATE` | never ship an equipment slot before its content layer actually exists (MVP = 4 slots) | `evidence/07`, `evidence/08` | ok |
| `HARNESS-EQUALISE` | the harness must equalise every archetype at neutral before measuring · an archetype must be #1 in >=5% of the tag space | `evidence/04`/`05`/`06` all equalised (51.6/h) but **win count per archetype has never been measured** — that is harness test 2, still unrun | prov |
| `SHARE-CAP` | no archetype may take more than 30% of the rotation | `evidence/04` — **`pack` max spread 63%** breaks it · the specific archetype still has to be named to confirm the full rule | prov |
| `HARNESS-INVARIANT` | the harness must assert: no NaN, equalisation locked, ties separated from loss, distribution sums to 100% | below | ok |

### `HARNESS-INVARIANT` — the 5 bugs that have to be prevented up front

Five real rounds in one session. **Every round reported a result that looked reasonable** rather than simply crashing.

| # | Bug | What happened | invariant |
|---|---|---|---|
| 1 | self-set threshold (= the mean) lands 46% of the time | reads as "the chance build is broken" | no metric may depend on a threshold derived from the result |
| 2 | `resist` stored as an array but indexed with a string | every rate becomes NaN → "pen wins 100%" | assert no NaN before sorting or reporting |
| 3 | **a default field with the wrong value** (`firePct` missing · `pack=0` → `(-1)^.55`=NaN) | every rate NaN → model throws | assert every value finite · **never default a field to a blanket 0** |
| 4 | `hp` missing from the zone factory | throws | assert every field the model reads has a default |
| 5 | tie-break by sort order | an archetype "wins" while actually tied | separate ties from win/loss · always report spread |

→ These 5 all came from "run it and read the numbers", and each one led to a project-level wrong decision. **More grilling raises the risk of being wrong; it does not lower it.**

---

## Rules still `prov` — what is not actually proven

**These are hopes, not design. Do not write them into the engine before they clear `HARNESS-INVARIANT`.**

| ID | Why it is unknown | Where to measure |
|---|---|---|
| `CUR-TIERLOCK` | the loop analysis has never run in a real harness — **no script has ever measured the economy** | economy sim (does not exist) |
| `CUR-SOURCECAP` | a structural proposal, not a measured result | economy sim (does not exist) |
| `CRAFT-GUARANTEED` | borrowed from PoE2, which has a market to absorb the output · this game has no market, so whether guaranteed is even the right choice is unknown | economy sim + crafting sim |
| `GROUP-EXCLUSIVE` | mechanism borrowed from PoE1, untested at 4/6 lines in this game's context | `evidence/05` next round |
| `MAG-CAP` | the 1.5x threshold has no derivation behind it | spec-fantasy-content.md §10.2 |