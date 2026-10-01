# Affixes

> [index](../index.md) · [weapons](weapons/weapons.md) · [rarity](rarity-system.md) · [balance notes](../10-design/balance-notes.md)

**Ten kinds, bound to a position.** Status: designed, **never measured**.

## The pool

⚠️ **The "axis it serves" column is withdrawn.** There is no 4-axis system any more — there are six core stats: **STR DEX AGI INT WIS LUK**. See [core-stats](../03-gameplay/stats-attributes/core-stats.md). `atk-flat` is now held by **STR** (physical) and **INT** (magic).

**Offensive gear — 5 kinds, after the core-stat rework**

| affix | form | stat it serves | zone it answers |
|---|---|---|---|
| `crit-damage` | **% only** | none yet | any |
| `def-pen` | flat | STR / INT | armour zones |
| `eva-pen` | flat | DEX | evasion zones |
| `atk%` | % | **none — see below** | any |
| ~~`atk-flat`~~ | flat | **absorbed by STR / INT** | — |

**Defensive gear — 4 kinds**

| affix | form | stat it serves |
|---|---|---|
| `hp` | flat + % | none — sustain, no death exists |
| `def` | flat + % | AGI (cuts incoming `push`) |
| `eva%` | flat + % | AGI |

**Crit rate is no longer an affix** — LUK holds it as a core stat.

`crit-damage` and `crit-rate` are **percentage only**, matching PoE where flat crit does not exist. Everything else has both forms.

**Five tiers per affix.** Tier 1 is the weakest roll.

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

### 2. Crit — half of it is a core stat now

| | held by | form |
|---|---|---|
| crit **rate** | **LUK** | % |
| crit **damage** | **nobody** | % |

LUK holds crit rate because a classic stat list has no other home for it, and "luck" is the word players already expect to mean it.

**`crit-damage` has no home.** It is a burst multiplier on a hit that already landed, which is a different job from crit rate. Six classic stats do not cover it.

### 3. `eva-pen` is missing from the calculation order

There are two penetration stats and they act at different points:

| pen | acts at | answers |
|---|---|---|
| `eva-pen` | **step 2**, before hit chance is rolled | evasion zones |
| `def-pen` | **step 7**, before the DR curve | armour zones |

The pipeline currently has one penetration step. Sitting both pens at the same place makes `eva-pen` do nothing, because it would reduce armour against a hit that never landed.

The two map cleanly onto two axes, which is convenient — and the pipeline does not support it yet. See [damage-pipeline](../03-gameplay/combat/damage-pipeline.md).

### 4. Tier numbering — RESOLVED, follow PoE

**Tier 1 is the weakest roll and drops most often.** Higher tier is a stronger roll.

This is the PoE convention and it is kept as-is. The project notes had said tier 1 was the strongest, which would have inverted it: if the most common drop is also the best, the tier system carries no progression at all and only says how lucky you were.

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

- [x] ~~the defensive half~~ → `def`/`eva` keep tempo up by cutting incoming `push`. Their value is time, not survival. See [glossary](../00-getting-started/glossary.md)
- [x] ~~tier numbering direction~~ → follow PoE, tier 1 is the weakest roll
- [x] ~~line count per rarity~~ → common 2-4 · rare 4-5 · unique 5 + effect. See [rarity-system.md](rarity-system.md)
- [x] ~~crit placement in the axes~~ → `crit-rate` is now **LUK**, a core stat. `crit-damage` has no home, still open
> **Parked until polish.** Concept work is still in progress; exact numbers and interaction order wait for the design polish pass, before development.

- [ ] `eva-pen` at step 2 — the pipeline has one penetration step and cannot express two
- [x] ~~`atk-flat` versus `atk%`~~ → `atk-flat` is **absorbed by STR/INT** · the "both land in the same place" problem is gone because one form no longer exists
