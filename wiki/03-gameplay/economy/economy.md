# Spec: Economy

> Back to: [README.md](../../index.md) · rules: [rules.md](../../10-design/systems-specs/design-rules.md) · **Status: draft — everything is `prov`**

⚠️ **Nothing in this area has any evidence behind it.** No script ever measured the economy. Everything below is a structural proposal and has to clear `HARNESS-INVARIANT` before it becomes a formula.

---

## 1. Currency

- salvage yields **tier-locked** currency that cannot convert across tiers, plus gated mats from designated content
- crafting is guaranteed, limited to 1 crafted mod per item · RNG lives on drops and a pity timer only
- currency needs a **source cap** that is not tied to loot volume

### Why tier-lock

`CUR-TIERLOCK` — it stops offline grinding from flattening the crafting ladder.

Structurally: idle produces the **largest** amount of loot precisely when the player is not playing. If currency converts across tiers, the player grinds the lowest tier that yields the best material while offline, then spends it at a high tier — and the entire ladder becomes flat.

### Why a source cap

`CUR-SOURCECAP` — **otherwise crafting is always free, which means no decisions.**

It is the same principle as loot volume: if currency flow tracks the number of items dropped, the currency rate tracks play time (or offline time) directly, which makes **every crafting test a no-op**. The player has nothing to decide, and all the decision-making migrates to the drop side instead.

---

## 2. Loot volume — where idle collides with loot RNG

From [thesis.md §2.3](../../10-design/pillars-vision.md): offline combat produces loot all night, so you open the game to a stash of a thousand items and must appraisal/salvage/filter before anything else.

| Mechanism | Why |
|---|---|
| cap drop rate per session | item count must not scale with offline time |
| auto-salvage below a threshold | ~200 items → valuation ~0.1s |
| hard inventory cap + stash | forces periodic decisions |

**The condition that has to hold:** if auto-salvage uses the contextual score, it has to run in 0.1s on real hardware, not on a dev machine — see gate 3.

---

## 3. Cost model

| Cost | Figure | Source |
|---|---|---|
| MC valuation, whole stash × 60 zones | **27s** | `evidence/08` — why `PROC-WEIGHT` may not be violated |
| analytic closed-form, whole stash × 60 zones | **0.96s** | `evidence/08` |
| real offline combat, 8h × pack 6 | ~0.06s (~288k ticks) | `evidence/08` |

→ these figures are why the combat engine has to be deterministic from the start rather than optimised later.

---

## 4. Open

- [ ] Write an economy sim to prove `CUR-TIERLOCK` and `CUR-SOURCECAP` — **neither has ever existed**; both are `prov` in [rules.md](../../10-design/systems-specs/design-rules.md)
- [ ] Loop analysis for tier-lock (do gated mats and the loot cap actually coexist?)
- [ ] Set the loot volume cap from a measurement on real hardware, not from the guessed 200