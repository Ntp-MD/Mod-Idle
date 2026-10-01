# Affixes

> [index](../index.md) · [weapons](weapons/weapons.md) · [rarity](rarity-system.md) · [balance notes](../10-design/balance-notes.md)

**Ten kinds, bound to a position.** Status: designed, **never measured**.

## The pool

**Offensive gear — 6 kinds**

| affix | form | axis it serves | zone it answers |
|---|---|---|---|
| `atk%` | % | FORCE | any |
| `atk-flat` | flat | FORCE | any |
| `crit-rate` | **% only** | PRECISION (proposed) | any |
| `crit-damage` | **% only** | FORCE (proposed) | any |
| `def-pen` | flat | FORCE | armour zones |
| `eva-pen` | flat | PRECISION | evasion zones |

**Defensive gear — 4 kinds**

| affix | form | status |
|---|---|---|
| `hp` | flat + % | **blocked, see below** |
| `def` | flat + % | **blocked** |
| `eva%` | flat + % | **blocked** |

`crit-rate` and `crit-damage` are **percentage only**, matching PoE where flat crit does not exist. Everything else has both forms.

**Five tiers per affix.**

---

## Why this pool replaces the old one

The previous pool had 18 mods and the measurement found **12 of 18 were generic** — they helped every archetype equally, which is a score ladder rather than a decision.

Two changes fix that at the source instead of trying to manufacture identity out of 18 mods:

1. **ten kinds instead of eighteen**
2. **bound to a position** — offensive gear cannot roll defensive affixes

Ten kinds also fits what is actually implementable. `evidence/06` found that adding base-type gating left 83% of mods flat, so a bigger pool gated by weapon type was never going to work either.

---

## Four problems this pool creates

### 1. ~~The defensive half has no purpose yet~~ — RESOLVED

`DEF-TEMPO` requires defensive stats to express as **tempo, not mitigation**, because there is no death offline and the currency of losing is time.

But `hp`, `def` and `eva%` are pure mitigation, and **if nothing can kill you, all three are worth zero.**

RESOLVED. The value is tempo, not survival: `def`/`eva` cut incoming `push`, so kph does not fall, so drops per hour do not fall. The currency of losing is time.

→ see [glossary](../00-getting-started/glossary.md)

### 2. Crit has no axis

| Axis | What it is |
|---|---|
| FORCE | per-hit damage |
| CADENCE | attack interval |
| PRECISION | hit chance + block-break |
| MASTERY | infliction / amplify consumption |

**Nothing holds crit.** Proposed split: `crit-rate` → PRECISION (it is a chance, like hit chance) · `crit-damage` → FORCE (a burst multiplier on a hit that already landed).

### 3. `eva-pen` is missing from the calculation order

There are two penetration stats and they act at different points:

| pen | acts at | answers |
|---|---|---|
| `eva-pen` | **step 2**, before hit chance is rolled | evasion zones |
| `def-pen` | **step 7**, before the DR curve | armour zones |

The pipeline currently has one penetration step. Sitting both pens at the same place makes `eva-pen` do nothing, because it would reduce armour against a hit that never landed.

The two map cleanly onto two axes, which is convenient — and the pipeline does not support it yet. See [damage-pipeline](../03-gameplay/combat/damage-pipeline.md).

### 4. "Tier 1 = highest value" inverts PoE

In PoE, **tier 1 is the weakest** and drops most often.

If tier 1 is the strongest, then **the most common drop is the best roll**, and the tier system carries no progression at all — it only says how lucky you were.

→ Choose: follow PoE (1 = weakest, most common), or invert the numbering and call them **ranks**.

---

## Open: `atk%` against `atk-flat`

In the current pipeline, flat damage is added before the increasers, so both forms get multiplied by the same things and end up **numerically close**.

| | computed from | consequence |
|---|---|---|
| `atk%` | nothing — a flat percentage | the same value on every weapon |
| `atk-flat` | **the base of the weapon you are holding** | better on a good weapon, worthless on a bad one |

If the two are close enough to be interchangeable then one is redundant and should be cut. If they are meant to differ, the difference has to be large enough for the player to feel, not merely a smaller number.

→ **Why does `atk-flat` exist at all?**

There is a version worth considering: flat affixes **reward having a good base**, which makes them a decision about which weapon to keep rather than a stat to stack. That is only interesting if the difference is big enough to notice.

---

## Open

- [ ] CONFIRMED: `def`/`eva` keep tempo up by cutting incoming `push`. Their value is time, not survival. See [glossary](../00-getting-started/glossary.md)
- [ ] crit placement in the pipeline and in the axes
- [ ] `eva-pen` at step 2
- [ ] tier numbering direction
- [ ] `atk-flat` versus `atk%`
- [ ] line count per rarity — see [rarity-system.md](rarity-system.md), currently unresolved and blocking the whole budget