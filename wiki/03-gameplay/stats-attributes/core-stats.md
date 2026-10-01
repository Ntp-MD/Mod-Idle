# Spec: Combat

> Back to: [index.md](../../index.md) · rules: [rules.md](../../10-design/systems-specs/design-rules.md) · **Status: draft**
> Calculation order lives in [damage-pipeline.md](../combat/damage-pipeline.md)

⚠️ **The 4-axis system (FORCE / CADENCE / PRECISION / MASTERY) is withdrawn.** O1 is answered: there are **seven classic stats** instead. Everything downstream that was written against axis names has to be re-pointed at the stat that now holds the job — see [affected documents](#8-what-this-rework-breaks).

---

## 1. Core stats — DECIDED

**The stat list is Ragnarok Online. The attack-speed half is Melvor.**

| stat | source | gives | also gives |
|---|---|---|---|
| **STR** | RO | flat attack | — |
| **DEX** | RO | attack accuracy | ailment chance |
| **AGI** | RO | **attack speed (Melvor)** | evasion |
| **INT** | RO | flat magic attack | mana per second |
| **WIS** | RO | skill cooldown reduction | — |
| **LUK** | RO | crit rate | drop rate |
| **VIT** | RO | flat HP | HP regen per second |

Seven stats, in the order a player would list them: **STR DEX AGI INT WIS LUK VIT**.

### Why this split of sources

**The names and the jobs are Ragnarok's.** RO is the reference every idle-RPG player already knows, and its stat list is six of these seven. Inventing names would have cost vocabulary for nothing.

**The attack-speed formula is Melvor's, not RO's.** RO gives AGI a *flat* attack-speed bonus and a per-class cap — that ceiling is a design that only works if a player is watching the screen, which is wrong for this game. Melvor's is derived from the interval, which is the thing an idle game actually has to compute:

```
attacks/s = 1 / interval        where interval is reduced by AGI
```

So the stat is RO's and the arithmetic behind it is Melvor's. That is the whole point of the split — **take the vocabulary, take the math from whichever game solved that specific problem for an idle context.**

**Where this departs from both:** RO has no percentage damage and Melvor collapses it into one DPS number. `atk%` has no home here yet.

Derived (computed, not chosen): `maxHit`, `matk`, `interval`, `hitChance`, `inflictChance`, `kph`, `maxMana`, `manaRegen`

Tag (not a number): element type · status type · pen type · target cap

Resources: **two** — **Mana** (player, spent by skills) · **Momentum** (built by hits, spent by triggers)

---

## 2. Attack rate, skills and mana

Attacks are counted per second. **A skill costs one tick and mana.** Both, not either.

```
attacks/s   = 1 / interval
skills/s    = min( 1 / cooldown , attacks/s , mana/s ÷ cost )
```

A skill fires only when all three gates allow it.

### The cooldown cap — 80%

Cooldown can be reduced by **at most 80%**.

```
cooldown_effective = cooldown_base × (1 − min(0.8, cdr))
```

**Why the cap matters: it keeps AGI alive.** Without one, WIS could drive cooldown to zero, a skill would fire every tick, and **AGI would become dead stat** — attack speed would gate nothing. 80% leaves that gate permanently in play, so all three terms in the `min` stay real.

**The consequence to accept:** at 80% CDR a skill fires 5x as often, so it wants 5x the mana. WIS and INT rise together or the build stops.

```
WIS ↑  →  skills/s ↑  →  mana/s needed ↑  →  INT ↑ ↑
```

That coupling is intended. It means a skill build cannot be tuned by improving one stat alone — the opposite of the score ladder the old affix pool turned into.

**⚠️ Undefined:** whether the 80% cap is **per skill** or **one value for the whole sheet**.

### Three clocks, not one

`cooldown`, `ICD` and the attack `interval` are separate things and the docs had been blurring them.

| | governs | reduced by |
|---|---|---|
| **interval** | attacks | AGI |
| **cooldown** | a **skill** | WIS, capped at 80% |
| **ICD** | a **trigger** | — |

ICD has no stat. It exists so that a trigger-per-chance unique effect (see [rarity](../../04-items/rarity-system.md)) cannot fire off every attack — otherwise *Thunder Strike* at 25% per trick would be gated by nothing except its own chance, and an ICD is the only thing standing between it and a 100% uptime loop.

### Two resources, and what that costs

The original rule was **one resource only**. `evidence/09` measured why a per-hit economy is dangerous: going from 1.3s to 2.6s intervals swung the result 2.5x, and once a build went resource-negative its trigger never fired and it silently dropped to 0.53x — the player loses ~47% of their rate offline with no signal.

**Momentum still follows the measured rules** — built per second, floored at `max(0.35·gain, gain − drain)`. Those are load-bearing and were measured, so they are not being re-opened.

**Mana is a second gate on a different thing**, and that is what needs care:

| | Momentum | Mana |
|---|---|---|
| what spends it | a **trigger** | a **skill** |
| built by | hits | INT (`mana/s`) |
| failure mode | trigger never fires | skill never fires |
| why a floor is mandatory | measured, kept | **not yet derived** |

**⚠️ The rule that has not been written yet:** a mana-starved build will have skills that silently never fire, and offline that failure is invisible. Momentum got an explicit floor because that exact problem was measured. Mana needs the same treatment — a mana pool floor, or a rule that a skill whose cost exceeds the pool is simply disabled with a visible note in the report. **Silent failure is the thing to avoid, not low output.**

### Why skills should cost mana at all

Without a mana cost, INT's `mana/s` is a stat with nothing to spend it on, and the skill gate stays purely `min(cooldown, attack speed)` — which means WIS and INT are both decorative and the third gate never exists.

**Exception — trigger-per-chance effects cost no tick and no mana.** These are the unique special effects (see [rarity](../../04-items/rarity-system.md)): *Thunder Strike* — 25% chance per Trick Attack to trigger. They ride along on an attack that already happened.

Without that exception, every skill build is gated by AGI and mana, and a unique effect has to compete for the same ticks. With it, a unique effect can add damage that **no other build can reach**, and it is immune to every gate that makes skills expensive.

### Adapting Melvor's formula rather than copying it

Melvor's real numbers, from its wiki:

```
maxHit  = floor( M × (2.2 + effLvl/10 + ((effLvl+17) × StrBonus)/640) )
accRate = floor( (effLvl+9) × (BaseAccBonus + 64) × (1 + AccMod/100) )
hit%    = 1 − TargetEvasion / (2 × AccRating)
```

**What is worth taking as-is:** three things, all of which are structural rather than cosmetic.

| from Melvor | why it survives |
|---|---|
| **hit size vs armour** — `DR = A / (A + 5·D)` | creates burst vs tempo on its own, and needs no separate `push` rule. The 90% cap means no cliff |
| **evasion as a subtraction** — `hit% = 1 − eva / (2·acc)` | eva can never reach 100%, so a high-evasion mob is never immune. That is a deliberate floor and it is already the right one |
| **interval-based attacks** | the only clock an idle game can compute offline |

**What is deliberately not taken: the three-tier accuracy split.** Melvor has `accRate` and `AccMod` as separate terms and a level term on top, so an accuracy affix can land in more than one place. That is the same collapsing failure the rest of this document keeps running into — the item ends up feeding one number.

**The one adaptation that matters:** in Melvor, `StrBonus` is additive *inside* the maxHit formula and there is no percentage damage slot at all. So every damage affix lands in the same additive pool, which is exactly the `evidence` finding that 12 of 18 mods were generic.

```
Melvor:  StrBonus (additive)  ×  nothing
ที่นี่:   STR flat (additive)   ×  ??? 
```

**The missing `???` is the only slot worth inventing here**, and it should be multiplicative rather than additive, because that is what makes the difference between a big hit and a many-hits build visible in the armour curve.

### The rule that replaces the central pool

**A percentage multiplies only its own stat. Never a shared pool.**

Melvor already does this in one place:

```
accRate = ... × (BaseAcc + 64) × (1 + AccMod/100)
                             └────┘
                             % multiplies accuracy alone
```

Applied consistently to all seven:

| flat | its percentage | what the % actually does |
|---|---|---|
| STR | STR% | the physical number gets bigger |
| INT | INT% | the magic number gets bigger |
| AGI | AGI% | the interval shrinks |
| DEX | DEX% | accuracy rises |
| hp | hp% | survives longer |
| def | def% | takes less `push` |
| LUK | LUK% | crits more often |

**Why this fixes the 12-of-18 problem.** When every affix lands in one additive pool, one number answers everything and the mods are interchangeable. Here a percentage is worth nothing without the flat stat behind it:

```
no STR  →  STR% does nothing at all
```

So the player chooses **which base to build, or which multiplier** — and the two cannot be substituted for each other. That is the decision the old pool could not pose.

**It also gives B13 its place.** `def%` → takes less `push` → kph holds up → yield holds up. No new mechanic needed, and no central pool created.

**Melvor has no central pool at all**, which is consistent: it needed `acc%` multiplying accuracy and stopped there. A generic `atk%` multiplying all damage is the thing that would have collapsed it.

**⚠️ `atk%` is no longer a name we need.** It was STR% and INT% before it was ever one thing.

**Parked until polish:** whether these fourteen numbers live on stats, on affixes, or on both — and whether seven percentages is one too many for a player to hold in their head.

---

## 3. Why the 4-axis and 3-axis versions were both abandoned

Kept for the record, because the reasoning still applies to whatever replaces them.

`evidence/07` measured 3 axes (MIGHT/GRACE/FOCUS) against 8 layers and FOCUS got exactly 1 layer of 8 — a violation of `AXIS-LAYER`. Ablation: removing armour kills MIGHT (0/13) · removing evade kills MIGHT (GRACE 12/13) · removing every layer kills MIGHT+FOCUS.

Win counts for 4 axes (7/8 rows decisive, no degenerate rows):

```
POWER 2 · MASTERY 3 (1 of which should be CADENCE) · PRECISION 2 · CADENCE 1
```

**CADENCE won once.** That was the argument for cutting it, and it is why inventing an axis set here was the wrong path — the axes did not fit the content.

Classic stats are not an abstraction over content layers. They are the vocabulary players already own, and each one names a job plainly: **STR hits, AGI is fast, DEX is accurate, LUK is lucky, INT is smart, WIS is ready, VIT is tough.** That vocabulary is Ragnarok's, taken wholesale rather than reinvented.

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

## 7. Resources — Momentum and Mana

### Momentum — the rules here are measured, do not re-open them

| | value |
|---|---|
| gain | per **second** (`MOM-PERSEC`), not per hit |
| spend | when the trigger fires · auto-spent while offline |
| floor | `net = max(0.35·gain, gain − drain)` — `net <= 0` is forbidden (`MOM-FLOOR`) |

**Why those two rules are one rule:** `evidence/09` measured that a per-hit economy makes attack speed 2x **win with every build** (going from 1.3s to 2.6s changes the result 1.78x→0.72x, a 2.5x swing, while per-sec gives 1.80x→1.38x, only 1.3x). Then, once `net <= 0`, the trigger never fires and the build silently drops to 0.53x — the player loses ~47% of their rate offline **with no signal at all**.

→ that is punishment the player cannot detect, which contradicts D3 ("no death") and `CONTENT-TWOTIER` directly

### Mana — the rules here do not exist yet

| | value |
|---|---|
| pool | `maxMana` — **no stat currently raises this** |
| gain | per second, from **INT** |
| spend | one cast costs a fixed amount (`manaCost`) |
| floor | **undecided — and this is the important one** |

**The two resources are not symmetric, and that is deliberate.** Momentum is an economy that has been tuned against measurement. Mana is a **gate on a single action**. A skill either fires or it does not, which is a cliff, not a slope — so mana needs a rule that makes the cliff visible.

Three options, none chosen:

| | rule | cost |
|---|---|---|
| **(ก)** | `maxMana` floor, same shape as `MOM-FLOOR` | keeps skills always firing, so INT's `mana/s` becomes a throughput stat rather than a gate — and then mana is barely a resource |
| **(ข)** | no floor; a skill the pool cannot pay for is **disabled and shown as disabled** in the report | makes the failure honest, and INT becomes a real requirement — but a build can be dead on arrival |
| **(ค)** | `maxMana` floor, but **offline only** — awake, skills stop when mana runs out | awake play gets the gate, idle play stays safe |

**⚠️ Undecided.** What matters in every option is that the player can see it. `MOM-FLOOR` exists because a silent −47% was measured; mana has the same failure shape and no floor yet.

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
| 4 layers in [balance-notes](../../10-design/balance-notes.md) | 7 stats | same file |
| one resource only | **two** — Mana and Momentum | [§7](#7-resources--momentum-and-mana) |
| DIM-PAIRING pairs | need re-derivation against 7 stats | [content-dimensions](../../10-design/systems-specs/content-dimensions.md) |
| O1 — 3 or 4 axes | **closed** | — |
| window kinds, one axis each | one stat each | [design-rules](../../10-design/systems-specs/design-rules.md) |

### Two holes this creates

**1. There is no percentage damage stat any more.** The old pool had `atk%` and `atk-flat`. `atk-flat` is now STR/INT, but `atk%` has no home — seven classic stats cover flat damage, speed, accuracy, cooldown, crit rate, evasion, HP and mana, and none of them is "increase damage".

Either percentage damage becomes an **affix** again, or it does not exist and every damage increase is flat. That is a real fork, not a formatting question.

**2. `crit-damage` has no home.** LUK holds crit *rate*. Crit damage is a different job and nothing holds it.

**3. `maxMana` is the one value nothing raises.** INT sets `mana/s`, the rate. The **pool** — the number that decides whether a skill fires at all — has no stat behind it. That is a hole in the middle of the resource system, not an edge case.

**4. The "one resource" rule is now false.** [§7](#7-resources--momentum-and-mana) held a single-resource rule; it now holds two. Momentum's measured rules stay. Mana has none yet.

---

## 9. Open — parked until polish

> **These are deliberately unresolved.** We are still choosing ideas and concepts. Depth work — the exact numbers, the derived curves, the interaction orders — waits until the game-design polish pass, before development starts. Nothing here blocks the next design conversation.

- [x] ~~O1 — 3 or 4 axes~~ → **seven classic stats: STR DEX AGI INT WIS LUK VIT**
- [x] ~~Is mana the second resource?~~ → **yes.** A skill costs a tick *and* mana. See §2
- [x] ~~the multiplicative damage slot~~ → **no central pool.** A percentage multiplies only its own stat. `atk%` is no longer a name. See §2
- [ ] **`crit-damage`** — LUK holds rate only. It would multiply crit hits alone, which is already scoped. Parked
- [ ] **`maxMana`** — INT sets the rate, nothing sets the pool
- [ ] **the mana floor** — see §7. A skill either fires or does not, so the cliff has to be visible
- [x] ~~WIS can be a dead stat~~ -> **closed by the 80% cap.** It can never drive cooldown to zero, so the tick gate stays real. See §2
- [ ] **is the 80% cap per skill, or one value for the whole sheet?**
- [ ] **ICD has no stat** — what reduces it, does it scale, does it interact with the cap? See §2
- [ ] **VIT sustain has no death to sustain against.** `hp regen/s` is worth nothing if nothing kills you, exactly like `hp` itself. It only pays if regen keeps you out of a `push` state
- [ ] O5 — does ailment stay · blocks §6
- [ ] multi-target engine (D6) is not covered here — it is a precondition for the pack layer, see [content-dimensions](../../10-design/systems-specs/content-dimensions.md)
