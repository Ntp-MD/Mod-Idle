# Spec: Combat

> Back to: [index.md](../../index.md) · rules: [rules.md](../../10-design/systems-specs/design-rules.md) · **Status: draft**
> Calculation order lives in [damage-pipeline.md](../combat/damage-pipeline.md)

⚠️ **The 4-axis system (FORCE / CADENCE / PRECISION / MASTERY) is withdrawn.** O1 is answered: there are **six classic stats** instead. Everything downstream that was written against axis names has to be re-pointed at the stat that now holds the job — see [affected documents](#8-what-this-rework-breaks).

---

## 1. Core stats — DECIDED

| stat | gives | also gives |
|---|---|---|
| **STR** | flat attack | — |
| **DEX** | attack accuracy | ailment chance |
| **AGI** | attack speed | evasion |
| **INT** | flat magic attack | — |
| **WIS** | skill cooldown reduction | — |
| **LUK** | crit rate | drop rate |

Derived (computed, not chosen): `maxHit`, `matk`, `interval`, `hitChance`, `inflictChance`, `kph`

Tag (not a number): element type · status type · pen type · target cap

Resource: **one only**, Momentum

---

## 2. Attack rate and the tick rule

Attacks are counted per second. **A skill costs one tick**, so the rate of skills is capped by attack speed.

```
attacks/s   = 1 / interval
skills/s    = min( 1 / cooldown , attacks/s )
```

**Exception — trigger-per-chance effects cost no tick.** These are the unique special effects (see [rarity](../../04-items/rarity-system.md)): *Thunder Strike* — 25% chance per Trick Attack to trigger. They ride along on an attack that already happened.

### Why the exception matters

Without it, every skill build is gated by AGI and WIS is dead stat. With it, a unique effect can add damage that **no other build can reach**, and it does not compete for the tick.

**⚠️ Unresolved:** if `1/cooldown` is already faster than `attacks/s`, then WIS does nothing for that skill. WIS only pays off where cooldown is the binding constraint. That may be fine, but it needs a deliberate answer rather than an accident.

---

## 3. Why the 4-axis and 3-axis versions were both abandoned

Kept for the record, because the reasoning still applies to whatever replaces them.

`evidence/07` measured 3 axes (MIGHT/GRACE/FOCUS) against 8 layers and FOCUS got exactly 1 layer of 8 — a violation of `AXIS-LAYER`. Ablation: removing armour kills MIGHT (0/13) · removing evade kills MIGHT (GRACE 12/13) · removing every layer kills MIGHT+FOCUS.

Win counts for 4 axes (7/8 rows decisive, no degenerate rows):

```
POWER 2 · MASTERY 3 (1 of which should be CADENCE) · PRECISION 2 · CADENCE 1
```

**CADENCE won once.** That was the argument for cutting it, and it is why inventing an axis set here was the wrong path — the axes did not fit the content.

Six classic stats are not an abstraction over content layers. They are the vocabulary players already own from every other RPG, and each one names a job plainly: **STR hits, AGI is fast, DEX is accurate, LUK is lucky, INT is smart, WIS is ready.**

---

## 4. The variance constraint — the heart of the whole project

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

## 5. The formula worth stealing from PoE

```
DR(A, D_raw) = A / (A + 5·D_raw)     cap 90%
```

Two sentences that always have to be read together:
> *"To prevent 90% of damage, you need armour 45 times the damage"*
> *"armour is more effective against many smaller hits than fewer larger hits"*

→ it creates a **burst vs tempo** axis on its own, with no need for a separate `push` dimension · the 90% cap means no cliff from DR itself

But the cliff has not disappeared, it has **moved** — to the magnitude of the tag. See `MAG-CAP` + `CONTENT-TWOTIER`.

---

## 6. Ailment — a mechanism with built-in anti-inflation

> *"The chance to inflict ailments depends on the pre-mitigation damage of the hit and the target's ailment threshold"*
> *"Does not stack, only highest damage instance is active"*
> *"Each freeze increases target's ailment threshold against future freezes"*

The second and third are **anti-inflation by rule**, not by a cap — there is no stat saying "ailments may not exceed X".

The first hands over a coupling that is genuinely wanted: small fast hits infuse worse, so **FORCE and MASTERY connect through mechanics rather than through a shared number**.

**Still waiting on O5.** If it is cut, this whole section goes, including the Helm slot in [spec-items.md](../../04-items/items-and-slots.md).

---

## 7. Momentum — the single resource

| | value |
|---|---|
| gain | per **second** (`MOM-PERSEC`), not per hit |
| spend | when the trigger fires · auto-spent while offline |
| floor | `net = max(0.35·gain, gain − drain)` — `net <= 0` is forbidden (`MOM-FLOOR`) |

**Why those two rules are one rule:** `evidence/09` measured that a per-hit economy makes attack speed 2x **win with every build** (going from 1.3s to 2.6s changes the result 1.78x→0.72x, a 2.5x swing, while per-sec gives 1.80x→1.38x, only 1.3x). Then, once `net <= 0`, the trigger never fires and the build silently drops to 0.53x — the player loses ~47% of their rate offline **with no signal at all**.

→ that is punishment the player cannot detect, which contradicts D3 ("no death") and `CONTENT-TWOTIER` directly

---

## 8. What this rework breaks

Every document that named an axis now points at a stat instead.

| was | now | where |
|---|---|---|
| FORCE (per-hit damage) | **STR** for physical, **INT** for magic | [affixes](../../04-items/affixes.md) |
| CADENCE (attack interval) | **AGI** | [affixes](../../04-items/affixes.md) |
| PRECISION (hit chance) | **DEX** | [affixes](../../04-items/affixes.md) |
| MASTERY (infliction) | **DEX** (ailment chance) | [affixes](../../04-items/affixes.md) |
| crit rate | **LUK** | [affixes](../../04-items/affixes.md) |
| crit damage | **nobody holds it** — still open | [affixes](../../04-items/affixes.md) |
| evasion | **AGI** | [affixes](../../04-items/affixes.md) |
| `atk-flat` affix | **absorbed by STR / INT** — see below | [affixes](../../04-items/affixes.md) |
| `atk%` affix | **nobody holds it** — see below | [affixes](../../04-items/affixes.md) |
| 4 layers in [balance-notes](../../10-design/balance-notes.md) | 6 stats | same file |
| DIM-PAIRING pairs | need re-derivation against 6 stats | [content-dimensions](../../10-design/systems-specs/content-dimensions.md) |
| O1 — 3 or 4 axes | **closed** | — |
| window kinds, one axis each | one stat each | [design-rules](../../10-design/systems-specs/design-rules.md) |

### Two holes this creates

**1. There is no percentage damage stat any more.** The old pool had `atk%` and `atk-flat`. `atk-flat` is now STR/INT, but `atk%` has no home — six classic stats cover flat damage, speed, accuracy, cooldown, crit rate and evasion, and none of them is "increase damage".

Either percentage damage becomes an **affix** again, or it does not exist and every damage increase is flat. That is a real fork, not a formatting question.

**2. `crit-damage` has no home.** LUK holds crit *rate*. Crit damage is a different job and nothing holds it.

---

## 9. Open

- [x] ~~O1 — 3 or 4 axes~~ → **six classic stats: STR DEX AGI INT WIS LUK**
- [ ] **`atk%`** — no core stat holds it. Affix again, or does not exist?
- [ ] **`crit-damage`** — LUK holds rate only. Where does damage go?
- [ ] **WIS can be a dead stat** — if cooldown is already faster than attack rate, reducing it changes nothing
- [ ] O5 — does ailment stay · blocks §6
- [ ] multi-target engine (D6) is not covered here — it is a precondition for the pack layer, see [content-dimensions](../../10-design/systems-specs/content-dimensions.md)
- [ ] O5 — does ailment stay · blocks §5
- [ ] multi-target engine (D6) is not covered here — it is a precondition for the pack layer, see [spec-content.md](../../10-design/systems-specs/content-dimensions.md)