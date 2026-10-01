# Spec: Combat

> Back to: [README.md](../../index.md) · rules: [rules.md](../../10-design/systems-specs/design-rules.md) · **Status: draft — awaiting O1**
> Calculation order lives in [spec-core.md](../combat/damage-pipeline.md)

⚠️ This whole file is written on the assumption of **4 axes**, which is **not decided** — see O1 in [decisions.md](../../10-design/game-design-document.md). If O1 comes out as 3, whatever is unrelated gets deleted rather than patched.

---

## 1. Core stats (draft — awaiting O1)

| Axis | Which slot of the formula it enters | Layers it answers | Punished by |
|---|---|---|---|
| **FORCE** | per-hit damage (the hit size in the DR curve) | armour hit-size · adapting armour | evasion · block |
| **CADENCE** | attack interval + push recovery (tempo) | push/tempo · (pack, by intent) | every form of armour |
| **PRECISION** | hit chance + block-break | evasion · block | — needs one more layer |
| **MASTERY** | infliction · amplify consumption · phase-break · cleave | amplify window · regen phase · pack | ailment immunity |

Derived (computed, not chosen): `maxHit`, `interval`, `hitChance`, `inflictChance`, `amplifyMagnitude`, `kills/h`

Tag (not a number): element type · status type · pen type · target cap

Resource: **one only**, Momentum (built by hits / spent by trigger, auto-spent while offline) — a second resource would make valuation branch

---

## 2. The axis set that was cut: 3 axes (MIGHT/GRACE/FOCUS)

`evidence/07` measured 3 axes against 8 layers and FOCUS got exactly 1 layer of 8 — a violation of `AXIS-LAYER` from the start. Ablation: removing armour kills MIGHT (0/13) · removing evade kills MIGHT (GRACE 12/13) · removing every layer kills MIGHT+FOCUS.

Win counts for the 4-axis version (7/8 rows decisive, no degenerate rows):

```
POWER 2 · MASTERY 3 (1 of which should be CADENCE) · PRECISION 2 · CADENCE 1
```

→ **CADENCE winning only once is exactly the case O1 has to re-measure.** If it still wins once across 3 runs, cut the axis.

---

## 3. The variance constraint — the heart of the whole project

`PROC-WEIGHT` is not an aesthetic choice. It is the condition that makes valuation cheap:

| build | dmg/hit | p5..p95 per encounter |
|---|---|---|
| 1 proc 30% on-hit +100% | ×1.3 | ±9% (24s) / ±4% (2min) |
| 6 stacked procs 15% | ×1.9 | ±12% / ±5.4% |
| heavy proc 5% +2000% | ×2.0 | **±57%** |
| charge-13 execute | ×1.31 | 0% |

→ **The variable is weight per proc, not the number of procs**

At session level, 8h (48,000 hits) gives ±0.1-1.4% in every case → variance is **not** a problem at that level, so the sim can be deterministic in the mean.

**If violated:** a heavy proc forces Monte Carlo → `evidence/08` measured that 2,000 items × 60 zones becomes **27s** instead of 0.96s → per-zone valuation on mobile dies → the chain in [README.md](../../index.md) breaks at exactly that link.

---

## 4. The formula worth stealing from PoE

```
DR(A, D_raw) = A / (A + 5·D_raw)     cap 90%
```

Two sentences that always have to be read together:
> *"To prevent 90% of damage, you need armour 45 times the damage"*
> *"armour is more effective against many smaller hits than fewer larger hits"*

→ it creates a **burst vs tempo** axis on its own, with no need for a separate `push` dimension · the 90% cap means no cliff from DR itself

But the cliff has not disappeared, it has **moved** — to the magnitude of the tag. See `MAG-CAP` + `CONTENT-TWOTIER`.

---

## 5. Ailment — a mechanism with built-in anti-inflation

> *"The chance to inflict ailments depends on the pre-mitigation damage of the hit and the target's ailment threshold"*
> *"Does not stack, only highest damage instance is active"*
> *"Each freeze increases target's ailment threshold against future freezes"*

The second and third are **anti-inflation by rule**, not by a cap — there is no stat saying "ailments may not exceed X".

The first hands over a coupling that is genuinely wanted: small fast hits infuse worse, so **FORCE and MASTERY connect through mechanics rather than through a shared number**.

**Still waiting on O5.** If it is cut, this whole section goes, including the Helm slot in [spec-items.md](../../04-items/items-and-slots.md).

---

## 6. Momentum — the single resource

| | value |
|---|---|
| gain | per **second** (`MOM-PERSEC`), not per hit |
| spend | when the trigger fires · auto-spent while offline |
| floor | `net = max(0.35·gain, gain − drain)` — `net <= 0` is forbidden (`MOM-FLOOR`) |

**Why those two rules are one rule:** `evidence/09` measured that a per-hit economy makes attack speed 2x **win with every build** (going from 1.3s to 2.6s changes the result 1.78x→0.72x, a 2.5x swing, while per-sec gives 1.80x→1.38x, only 1.3x). Then, once `net <= 0`, the trigger never fires and the build silently drops to 0.53x — the player loses ~47% of their rate offline **with no signal at all**.

→ that is punishment the player cannot detect, which contradicts D3 ("no death") and `CONTENT-TWOTIER` directly

---

## 7. Open

- [ ] O1 — 3 or 4 axes · blocks this whole file
- [ ] O5 — does ailment stay · blocks §5
- [ ] multi-target engine (D6) is not covered here — it is a precondition for the pack layer, see [spec-content.md](../../10-design/systems-specs/content-dimensions.md)