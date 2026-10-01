# ModWorld

**text-based RPG idle, fantasy theme** (D13)

An idle game in the Melvor mould that adds weapon/attribute depth using ideas from PoE, PoE 2 and Diablo.

- Date: 2026-10-01
- Status: **not started** — scope and spec are still unstable. This document set is a record of arguing the idea through, not a design contract.
- ⚠️ Every number here comes from a **reduced model whose magnitudes were set by hand**. Use it to judge *direction* only. The scripts that produced those numbers were deleted, so every figure is `measured-but-unverifiable`: citable, not re-checkable.

---

## Index

| File | What it answers | Read it when |
|---|---|---|
| [thesis.md](thesis.md) | Why this idea has a chance, and why the part that seemed most important at first is the part that fails | First read · whenever the question is "why" |
| [decisions.md](decisions.md) | What is settled · what evidence overturned · **what is still unknown + the criterion for killing it** | Before answering any question |
| [rules.md](rules.md) | 36 design rules that must not be broken, each with a stable ID | Before touching a formula or adding a stat/affix |
| [spec-core.md](spec-core.md) | **Order of operations** — the calculation pipeline in sequence | **Before writing any code** |
| [spec-combat.md](spec-combat.md) | 4 core axes · formulas · the variance constraint | When answering O1 · when writing the engine |
| [spec-content.md](spec-content.md) | Content dimension map · two-tier magnitude | When answering O4/O5 · when designing zones |
| [spec-fantasy-content.md](spec-fantasy-content.md) | **10 zones + monsters + base types + progression + combat log lines, concretely** | Whenever touching game content |
| [spec-items.md](spec-items.md) | Item types · slots · contextual valuation | When answering O2/O6 · when designing loot |
| [spec-text-ui.md](spec-text-ui.md) | Every screen in text form | When answering O9/O10 |
| [spec-economy.md](spec-economy.md) | Currency · salvage · loot volume | Once combat is good enough |

---

## The chain the whole project rests on

If any link is missing, the idea collapses back to BI/Slot — strictly worse than Melvor:

```
small proc weight (<=1/3 of avg hit)
  => only +-9-12% variance per encounter
  => item valuation can be closed-form (no Monte Carlo)
  => contextual score for whole stash x all zones = 0.96s, not 27s
  => per-zone/build valuation becomes viable on mobile
  => monster tags actually change decisions
  => loot is genuinely *different*, not just *more*
```

The heart of the project: **what looked like one system is actually two systems that must ship together** — the item side and the monster/content side. The way projects like this die is by finishing the first one and discovering the second one does not exist (see [thesis.md §2](thesis.md)).

---

## Scope & gate

**First slice:** combat sim + valuation (already argued through), but it must include a multi-target engine because that is a precondition for the pack layer.

Gate (all must pass to continue):

1. >=3 archetypes are #1 in different zones, and nobody exceeds 30%
2. worst-pick loss sits between -30% and -50% (not -95%)
3. full-stash valuation matrix <1s on real hardware
4. every core stat axis has >=2 answering layers (`AXIS-LAYER`)
5. 7 consecutive days of play with at least one moment per day where you *hesitate* over which loadout to switch to — no hesitation means the depth is fake

**Cut first if the gate fails:** ailment + immunity (most expensive, least value, no amplify partner) → then pack combat → then high crafting tiers

**Risk of "one person building this solo":** the core hypothesis ("contextual gear choice is fun") has zero external validation. The cheap path is **prototype as a Melvor mod first** — modding is first-party and supports "introducing new skills and items", you can patch the runtime (`ctx.patch(Skill,'addXP').before(...)`), there is a Creator Toolkit in-game/on Steam/browser, and *"nobody will be banned for cheating. This is a single player game"*

Warning sign: *"Astrology was reworked in V1.1 and no longer has random modifiers"* → the dev team already killed another RNG system. You would be swimming against host design intent.

---

## Dependency: open question → what it unblocks

Read before starting work. Highest unblocking value first.

| Question | Unblocks | How expensive | Notes |
|---|---|---|---|
| **O10** what the player does in 60 seconds | everything — if the game passes every technical gate and still fails gate 5, nothing helps | highest · answerable only by designing and playing, never by measuring | decisions.md |
| **O9** render fidelity | spec-text-ui · decides whether D13 actually saves work | medium · can reverse D13 | decisions.md |
| **O1** 4 axes or 3 | spec-combat → `AXIS-LAYER` → gate 4 | very high — everything downstream is bound to the axis count | decisions.md |
| **O8** are resist / ailment immunity in scope | spec-content · resolves the contradiction in thesis §1 vs `DIM-PAIRING` | medium — cuttable if they have no amplify partner | decisions.md |
| **O4** how many dimensions in phase 1 | spec-content · supplies the number O1 needs | high — it is O1's input | decisions.md |
| **O5** does ailment stay | spec-combat (threshold) · spec-items (Helm slot) | medium — cuttable without affecting anything but Helm | decisions.md |
| **O6** how many base types | spec-items · authoring cost | low — decidable later | decisions.md |
| **O2** soft or hard requirements | smart drops (`DROP-SMART`) · loot economy | medium | decisions.md |
| **O3** respec / presets | spec-items (UI) · rotation content | **still undecidable** — `evidence/03` and `06` contradict each other | decisions.md |

---

## Next steps

1. **Answer O10 first** — what the player does in 60 seconds. Nothing blocks it, and it cannot be answered by measuring.
2. **Fix the two loose ends in [spec-fantasy-content.md §10.1](spec-fantasy-content.md)** — windows must bind to an axis · the pack layer belongs to someone.
3. Answer O1-O9 per the kill criteria in [decisions.md](decisions.md) — **these do not wait for step 1**, because the schema is data-driven.
4. Decide between Melvor mod and standalone prototype — the mod is far cheaper for answering gate 5, which is now the number-one risk.
5. When something actually needs measuring: invariants first, engine second (`HARNESS-INVARIANT`).
6. Lock budgets as named constants with provenance, not hard-coded values.
7. If a schema gets written: everything data-driven, trigger types a closed enum, every unique representable in the sim.