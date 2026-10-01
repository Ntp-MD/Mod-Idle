# Decisions — what is settled · what evidence overturned · what is still unknown

> Back to: [README.md](../index.md)

**Read before answering any question** — especially §2, which is what evidence overturned. Do not copy anything from PoE/Diablo before reading it.

## How to read status

| status | means |
|---|---|
| `measured` | came from a measurement in a past session — **not re-checkable**, the scripts were deleted |
| `sourced` | came from an external primary source (Melvor/PoE2/Diablo patch notes and wikis) |
| `assumed` | set by hand so a model could run — **never use these numbers to judge the real game** |
| `opinion` | judgement, no supporting evidence |

A reference to `evidence/0N` means a measurement from a script that used to exist. The number is still citable, but it **cannot be re-verified**, and `evidence/09` itself declares that its magnitudes were hand-set and too strong, so use it for the **shape**, not the **magnitude**.

---

## 1. What still stands

| # | Topic | Verdict | status |
|---|---|---|---|
| D1 | Combat | ticks + interval triggers; triggers must be deterministic in the mean | measured |
| D2 | Target player | idle-first (mobile/offline primary) | opinion |
| D3 | Offline risk | no death offline → **the currency of losing is time, not a life** | opinion (but it anchors `CONTENT-TWOTIER`) |
| D4 | Valuation UI | per-zone/per-build contextual score, no global item score | measured |
| D5 | DR math | multiplicative + cap + floor — upgrade to PoE's hit-size formula, see R3 | sourced |
| D6 | Pack combat | build a real multi-target engine (accepted as engine milestone 1) | opinion |
| D7 | Defensive stats | convert sustain into tempo entirely | opinion |
| D8 | Crafting currency | tier-locked salvage + gated mats | opinion |
| D9 | Monetization | no revenue → sidesteps store-policy risk | opinion |
| D10 | Build identity ownership | tree stakes the axes / gear answers layers / content picks the hot layer | measured |
| D11 | Inventory + equipment UI | belongs **inside the vertical slice**, not after it | opinion (supersedes "do UI later") |
| D12 | Equipment skeleton | **4 slots** (Weapon, Grip, Gloves, Chest) per `SLOT-GATE` + Amulet pending — not 11 PoE-style | measured (`evidence/08`) |
| D13 | **Game direction** | **text-based RPG idle, fantasy theme** | opinion · decided by the user |
| D14 | Valuation display | show a **p5-p95 band**, not the mean | opinion (based on `evidence/01`) |
| D15 | Work order | schema + invariants → combat engine → **balance math last** | opinion (based on 5 bugs in one session) |

### D13 — the direction: text-based

Decided 2026-10-01. Effect on the project:

| Gains | Loses |
|---|---|
| No art pipeline / animator / UI designer, matching D9 (solo, no revenue) | Removes the *visual* share of loot satisfaction → need a replacement |
| `+12% kills/h in the Ashwood Hollow` is a sentence, which fits D4 exactly | Render fidelity still has to be decided (O9) and it might reintroduce UI work |
| sort / diff fall out for free, so the "never-counted UI work" shrinks | **`evidence/08` matters more**: +5.3% invisible, with no visuals to soften it |

→ **Gate 5 moves from "check 5" to risk number one** — see [thesis.md §0.1](pillars-vision.md)

---

## 2. What evidence overturned (read before copying anything from PoE/Diablo)

### R1 — "6-8 affix lines" runs against what Diablo 4 concluded after watching real players

D4 Season 4 "Loot Reborn": *"reduced the number of affixes on items (down to 3 on Legendary items, 2 on Rare items)"* · Oct 2025: *"base affixes … from 3 to 4"*, *"You can now select which specific affix you want to apply to your item from a Tempering Recipe"*, *"Masterworking no longer increases your item's affix values"*

And from `evidence/05`: a pool of 18 mods → **12 are generic** (help every archetype equally = a score ladder), with only 3 niche-exclusive.
From `evidence/06`, once base-type gating is added: **83% still flat** (wand/bow = 100% flat).

→ New recommendation: 4 lines rare / 6 ancestral, and **the remaining lines are chosen by you through guaranteed crafting** rather than rolled in bulk.

**Replaced by:** `LINE-BUDGET` in [rules.md](systems-specs/design-rules.md)

### R2 — "force one downside line on every item from mid-tier up" rests on a memory I got wrong

Three independent sources agree:
- D2: *"magic affix pools are positive-only … negatives are a Diablo I thing"* · D2's downside tradeoffs live on **named items** (Delirium: *"14% Chance To Cast Level 13 Terror When Struck"*)
- PoE1: *"such negatives are uncommon: mostly uniques, corrupted implicits, downside crafting mods; rare affix pools are near-100% positive"*
- PoE2: the unique `Plaguefinger` → *"Cannot inflict Elemental Ailments"* (a downside on a named item)

→ Corrected to: **downside lives on recipes / named items only; every rolled affix must be positive.**
The mechanism that replaces downside as a BI/Slot guard (PoE1 has it and it is cheaper): *"Only one modifier from any given group may appear on an object"* = **group exclusivity**, which naturally forces 3-6 lines onto different axes.

**Replaced by:** `DOWNSIDE-PLACEMENT`

### R3 — the armour formula I recommended first should not be derived from "flat subtraction", and I had PoE backwards

I once said PoE armour "punishes small hits" — **that is backwards.** The real formula:

```
DR(A, D_raw) = A / (A + 5·D_raw)
"To prevent 90% of damage, you need armour 45 times the damage"
"armour is more effective against many smaller hits than fewer larger hits"
```

Armour is hit-size-dependent and **caps at 90%** (there is no shared three-layer ceiling as I once claimed; evade <=95% and block <=75→90% are separate independent layers).

→ This is the thing worth stealing: it creates a **burst vs tempo** axis on its own without adding a separate `push` dimension, and the 90% cap means no cliff from DR itself.
→ But the cliff can still be moved elsewhere, see `MAG-CAP` + `CONTENT-TWOTIER`

### R4 — the "orb gamble" crafting ladder is not what PoE2 does any more

> *"All crafted modifiers are now guaranteed, but items can only have 1 crafted modifier at a time."* · Alloys (replacing the base mod), Fluxes (converting element resistance), Desecrated (replacing veiled), Hinekora's Lock (see the result before you spend it) · gambling survives only on the drop side (Chaos Orb / Alchemy / Divine)

PoE1 crafting needs a *market* to absorb the junk. This game has no market, so **crafting = guaranteed + a limit of 1 crafted mod per item, with RNG kept on drops only.**

---

## 3. Still open — do not start coding before these are answered

Every item has **kill criteria**: the condition under which, if that is what the measurement says, it gets cut without further debate. That is what makes grilling *terminable*.

### O1 — core stat count: 4 (FORCE/CADENCE/PRECISION/MASTERY) or 3

**Why it is the most expensive:** everything downstream binds to it. Gate 4 (`AXIS-LAYER`) is measured with it. The whole of spec-combat is written on top of it.

**Decision rule (run 3 times, rotating the tag-assignment seed, then take the median):**

| Result | Verdict |
|---|---|
| 4 axes: some axis has <2 layers | violates `AXIS-LAYER` from the start → **must be 4** |
| 4 axes: every axis has >=2 layers but CADENCE wins only 1 of 8 rows across 3 runs | **cut to 3** — an axis that wins once is noise |
| 3 axes: some axis gets only 1 of 8 layers (FOCUS used to get exactly 1) | 3 axes cannot work → **must be 4**, so re-wire that axis instead of reducing the count |
| Both fail `AXIS-LAYER` | the real problem is not enough content dimensions → answer **O4** first, then measure again |

**kill:** if neither shape passes `AXIS-LAYER`, **cut axes that have no layer until the count matches what the content actually supports** — the axis count is an output, not an input. O4 sets it.

**Do not use:** the `net tally` in `evidence/07` is tie-break biased — use **win count + spread** only.

---

### O2 — soft or hard requirements

**Why it matters:** hard requirements break smart drops (`DROP-SMART`), because the item arrives unusable and becomes auto-salvage, so the whole box silently degrades — the same failure mode `MOM-FLOOR` warns about.

**Decision rule (measure on the vertical slice's real inventory):**
- off-signature salvage rate > **25%** of all drops → requirements are too hard → soften them
- signature drops usable < **75%** at target tier → same conclusion
- both pass → hard requirements are fine, and that number is the justification smart drops need

**kill:** if hard requirements make smart drops a no-op (more than half the time the drop is unusable), **remove the requirement system entirely** instead of building a soft version.

---

### O3 — respec: free / expensive / multiple loadout presets

**Why it matters:** rotation needs respec. Making it expensive turns content into a paywall, in a game with no money.

**Evidence that already answers part of it:** `evidence/03` — 1 preset reaches 91.3% of optimum, 2 presets 99.6%, 3 presets 100%.
→ **2 presets capture nearly the whole system's value**, which means rotation does not create depth, it creates a 3-way choice — beyond 2 there is nothing left to decide.

⚠️ **But `evidence/06` disagrees:** at 15 zones it gets 1 preset = 78% · 2 → 84% · 3 → 88% · **4 → 90-92% and "unreachable in 4" at 95%**
→ **the difference is zone count (8 vs 15), not script accuracy**, so "2 presets is enough" is an artefact of which 8 zones were picked → **O3 cannot be decided until the zone count is fixed**

**Decision rule:**
- if real zone count ~15 → **2 presets is not enough**, 4+ are needed and 95% is still out of reach → presets become a UI burden, not a tool
- if zone count ~8 → 2 presets suffice and a 3rd is worthless
- the more interesting option than either: **cut the zone count** until 4 presets cover it — and the cliffs shrink too, because cliffs come from tags no preset answers correctly

**kill:** if switching presets is harder than picking an item in the UI, **cut the preset system** and spend the effort on depth elsewhere.

---

### O4 — how many content dimensions the engine really supports in phase 1

**Why it matters:** it is the input to O1. Every archetype needs a dimension of its own; you do not start from your own archetype's dimension.

**Decision rule:** this is not a taste question, it is **derived**: `AXIS-LAYER` wants 4 axes × 2 layers = **>=8 layers**.
- fewer than 8 dimensions in phase 1 → **cut axes before cutting dimensions** — dimensions are what create depth, axes are just the language they speak in
- >=8 dimensions but 3 axes cannot use them all → the axis count has to drop, and that is the answer to O1

**kill:** if the authoring volume of the remaining dimensions is impossible in the time available → **content dimension count is an authoring constraint, not a taste question** — cut along the order in [spec-content.md](systems-specs/content-dimensions.md) and accept 3-4 axes in the MVP.

---

### O5 — do ailment/immunity stay

**Why it matters:** PoE2 has an Ailment Threshold that happens to fit deterministic idle (infliction depends on pre-mitigation damage, so small fast hits infuse worse — that genuinely couples FORCE to MASTERY), but it is **more expensive** than that.

**Decision rule:**
- needs an amplify partner (`DIM-PAIRING`) or immunity is a dead tag — `evidence/04` shows that removing amplify kills fire/cold/shock outright
- if no archetype inflicts status, drop it — `evidence/04` shows vulnerable/shatter stop discriminating without one
- drop first if the gate fails

**kill:** if in the first harness run no archetype is #1 because of ailment, **cut both (ailment and immunity) together** and give the Helm slot's layer to something else. It is the cheapest cut in this document.

---

### O6 — how many weapon base types

**Why it matters:** `BASETYPE-CARRIER` puts attack speed / crit / implicit on the base type rather than the affix pool, so base-type count = the number of "identity slots" that each need separate tuning.

**Decision rule (from `evidence/05` and `evidence/06`):**
- `evidence/06`, with base-type gating added, still has 12/18 mods flat (83%) → **base-type gating does not separate mods** → base-type count is not the answer to R1
- wand/bow = 100% flat → consider cutting them

**kill:** more than 4 base types in phase 1 → **cut to 4** (authoring cost is the reason, not design beauty).

---

### O7 — Amulet slot: which layer · closed

**Answer:** add a content dimension, **resource pressure** — punish side = decay/steal (monsters drain Momentum), amplify side = conduit/ward-break (spent Momentum converts to damage, a ward only breaks if you burst it), and the two must ship **together**.

Why the measurements force both halves (from `evidence/09`):
- gain **per second**, not per hit — otherwise attack speed 2x is the best build in the game
- there must be a floor, `net <= 0` is forbidden — otherwise the trigger build silently drops to ~53% offline, which is punishment the player cannot detect

**Still open:** the Amulet was approved but **was never added to the MVP slot set** (still 4 slots) → see spec-items.md

---

### O8 — are resist and ailment immunity in the phase-1 scope · **new**

**Why ask:** thesis §1 chose **all four** monster tags (including resist and ailment/immunity), but spec-content.md marks **both ✘** because they are punish-only, which violates `DIM-PAIRING`. They sat in different sections of the old document, so nobody ever saw them collide.

**Decision rule (uses existing evidence, nothing new to measure):**

| If | Then |
|---|---|
| resist ships **without** an expose partner | effect is 0% → **cut resist from phase 1** and fold it into the amplify window instead |
| ailment immunity ships **without** an infliction archetype | nobody cares about immunity → cut both, per O5 |
| both ship with amplify partners | must clear gate 1 (>=3 archetypes #1 in different zones) first — failing that, cut |

**kill:** if cutting both leaves fewer than 8 dimensions in phase 1, that is also the answer to O4, and the axis count has to drop per `AXIS-LAYER`.

---

### O9 — text render fidelity

**Why it matters:** "text-based" does not mean "no colour" — but **colour is doing semantic work**, not decoration: rarity (magic/rare/ancestral/unique), highlighting zone-conditional tags, and band width as a stability warning.

| Level | Gains | Loses |
|---|---|---|
| plain text | plays anywhere, trivial to write, screen-reader friendly | colour does nothing → rarity has to be spelled out |
| ANSI 8-16 colours | enough for rarity + highlight | tied to terminal themes, some phones have no colour |
| styled markup + renderer | full control | needs a renderer, which is UI work again — exactly the risk D13 just removed |

**Decision rule:**
- if level 3 makes the renderer harder than a PoE tooltip, **level 1 is better**
- if rarity spelled as `[rare]` is too slow to read, at least ANSI is needed
- test: play 5 minutes on a phone and ask how fast rare can be told from magic

**kill:** if colour does not actually speed up reading → **plain text only**, spell everything out, and never write a renderer.

---

### O10 — what the player *does* in the first 60 seconds · **new**

**Why this is the most important question in the document:** this game will pass every technical gate and then fail at gate 5 if the answer turns out to be "menus".

D13 (text-based) makes it sharper, because PoE-style UI at least has *pick-up and put-down* as an action. Remove the visuals and you are left with reading and choosing.

| Option | Effect on gate 5 |
|---|---|
| read a report of what happened overnight | boring by day 2 — not *hesitation* |
| choose zone / preset / allocation | **a real decision** ✓ but you need options ambiguous enough to hesitate over, and O3 is still self-contradictory |
| read combat prose like narrative | content, not gameplay — possible, but it is not the answer to gate 5 |

**Decision rule:** you have to be able to name **the thing the player can choose but is unsure about**. If not one such option exists, there is nothing to hesitate over.

**kill:** if the first 60 seconds are pure reading, **cut the Report screen** and open the game on Zone select instead, letting the player piece together what happened from a scrollback log.

---

## 4. The order to answer them in

Not numerical order — this is the order that unblocks the most work per answer:

```
O10 (what the player does in 60s)  ->  know what the game asks of the player -> pass or fail at gate 5
        ↓
O9 (render fidelity)      ->  know whether a renderer is needed at all -> spec-text-ui
        ↓
O8 (cut the monster tags that are dead)  ->  know how many layers really exist
        ↓
O4 (phase-1 dimension count — derived from AXIS-LAYER)
        ↓
O1 (3 or 4 axes — needs the layer count first)
        ↓
O5 (ailment)     O6 (base types)     O2 (requirements)     O3 (respec — still self-contradictory)
```

### Why O10 and O9 moved to the top

O10 is the only question that **cannot be answered by measuring** — it has to be designed and played, and if it is never answered, everything else may be wasted.

O9 sits high because it decides whether text UI needs a renderer, which in turn decides whether D13 actually saves work.

**O1-O8 do not wait for O10** because [spec-core.md](../03-gameplay/combat/damage-pipeline.md) is designed to be data-driven, so O1 and O8 can be answered later without reworking the schema.

⚠️ **O3 was corrected** — it used to read "answerable immediately because `evidence/03`", but `evidence/06` contradicts it (2 presets = 99.6% at 8 zones vs 4 presets = 92% and still short of 95% at 15 zones) → **still undecidable until the zone count is fixed**