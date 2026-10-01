# Spec: Balance

> Back to: [README.md](../index.md) · rules: [rules.md](systems-specs/design-rules.md) · **Status: `draft` — blocked**

⚠️ **No number in this file has been measured.** The scripts that produced the original figures were deleted. Everything here is either (a) derived from a rule that *was* measured, with the derivation shown, or (b) marked as needing a number it does not have yet.

**This file designs balance as formulas, not as magic numbers** — because the project's own history is a list of confident numbers that turned out to be wrong.

---

## 0. Blockers — balance cannot be finished until these resolve

| # | Blocker | Consequence |
|---|---|---|
| B10 | rarity is now common/rare/unique, so **`Rarity = line count` is broken** | no affix budget exists, so §4 cannot be closed |
| B9 | 6 accessory slots, 9 layers, MVP was 4 slots | cannot say what competes for what |
| B6.1 | the zone table has no window-kind column | cannot verify which axis each zone is for |
| B6.3 | `MAG-CAP` has no derivation | §2 has to invent one |

---

## 1. What the currency actually is

There are only two kinds of power, and they have completely different rules.

| | **Additive** | **Conditional** |
|---|---|---|
| Examples | weapon base, weapon affix lines, tree +%damage | pen vs armour, cleave vs pack, amplify vs window |
| Budget | **hard cap 25% envelope**, all of it shared | **no cap** |
| Collapses to one DPS number? | **yes** — that is the trap | **no** — it only exists in one zone |
| Feels like | a bigger number | a different answer |

→ **The balance currency is not damage. It is the number of conditions a build can satisfy at once.**

`evidence/02` is the proof: pen is worth +33% in an armour zone and **0%** everywhere else. The same affix is either the best thing you own or worthless.

**So "is this build balanced?" means: against which zone?** There is no global answer, and that is `D4` (no global item score), not a dodge.

---

## 2. The floor forces where decisiveness has to come from

`CONTENT-TWOTIER` caps idle-safe zones at **−20%**. This is a hard budget and it constrains the whole design.

### Derivation: what armour value produces a −20% penalty?

kph is linear in effective dps (`kills = 3600·e/hp`), so a −20% kph budget is a −20% effective-dps budget.

PoE's formula, `DR(A, D) = A / (A + 5·D)`:

```
matched build   → gloves pen cancels the armour  →  A_eff ≈ 0   →  DR ≈ 0
mismatched build → no pen                          →  A_eff ≈ A   →  DR = A/(A+5·D)
```

For the mismatched build to lose exactly 20% of its dps:

```
1 − A/(A + 5·D) = 0.20
A/(A + 5·D)     = 0.80
A               = 0.80·A + 4·D
0.20·A          = 4·D
A               = 20·D
```

**→ `armour_zone ≈ 20 × player maxHit` puts a mismatched build exactly at the −20% idle-safe floor.**

That is a *derivation* for the threshold that `MAG-CAP` was missing (B6.3), and it is 13× the 1.5 that was written down without provenance.

### The consequence, and it is the most important thing in this file

**A base stat can only ever punish by 20%.** The floor is binding.

So the base stat **cannot** be what makes a zone decisive. Decisiveness has to come from somewhere the floor does not apply, and there is only one place: **the window.**

```
base stat  → bounded punishment   (idle-safe ≤20%, contract ≤60%)
window     → where decisiveness lives (uncapped)
```

This is exactly why `DIM-PAIRING` is the load-bearing rule, and exactly why the window-kind bug was severe: with every zone sharing one generic amplify, one stat collected all the decisiveness and MASTERY won 7 of 8 zones.

### Contract tier

Allowing −60% instead of −20% gives `A ≈ 5.6·D`. That is the whole budget a contract zone has.

---

## 3. Pen must be sized against armour, not against damage

If `armour_zone ≈ 20·D` for the idle-safe cap, then a pen that fully cancels it would be worth **+25% effective dps** — which is the entire `MAXHIT-CAP` envelope, spent on one stat.

So pen cannot be sized to cancel armour completely. The pairing has to be partial:

| | magnitude | why |
|---|---|---|
| `armour_zone` at a tier | ~20 × maxHit | derived above |
| gloves pen | a **fraction** of that | full cancel would eat the whole envelope |
| residue on matched build | still some DR | which is what keeps `MAG-CAP` relevant |

**→ rule: pen is a fraction of zone armour, and the fraction is the same at every tier.** Otherwise pen either stops mattering or eats the envelope.

Open: what fraction. It has to be set so that matched-build DR stays in a stated band, and there is no measurement for that band.

---

## 4. Additive envelope: power and perceptibility are the same budget

`MAXHIT-CAP` caps the additive pool at 25%. `TREE-BUDGET` puts the tree in the same pool. `evidence/08` measured what that does to *feeling*:

| slots sharing the pool | swap one item feels |
|---|---|
| 2 | +11.1% **visible** |
| 3 | +7.1% invisible |
| 4 | +5.3% invisible |

**→ the tree does not just compete with weapons for power, it competes with them for perceptibility.** Every point of tree budget makes weapon swaps less noticeable.

This is a sharper statement of `TREE-BUDGET` than the one currently written, and it applies to dual-wielding too: two weapons = 2 additive slots = exactly at the visible limit. A third additive source (tree, or a third weapon) drops it below.

**Everything that draws from the additive pool should be counted together, and the count should be ≤2.**

| | additive slots |
|---|---|
| one weapon | 1 |
| two weapons (dual wield) | **2 — at the limit** |
| + tree nodes | **over** |
| + accessory with flat damage% | **over** |

→ **rule: no accessory may draw from the additive pool.** It must be conditional or utility. Without this rule, 10 slots × some flat% destroys every weapon swap.

---

## 5. Per-zone condition demand — the real balance table

The only meaningful balance question per zone is: **which conditions does this zone demand, and which builds can satisfy them?**

Each stat owns a condition set:

⚠️ **This table was written for the withdrawn 4-axis system.** The job column still matters — the left column needs re-derivation against the seven stats.

| was | condition it satisfies | now |
|---|---|---|
| FORCE | big hits vs armour (hit-size) | **STR** / **INT** |
| CADENCE | many hits vs pack / tempo vs push | **AGI** |
| PRECISION | accuracy vs evasion, break vs block | **DEX** |
| MASTERY | burst vs amplify windows, phase-break vs regen | **DEX** (ailment chance) |
| — | nothing held crit rate | **LUK** |
| — | nothing held percentage damage | **nobody** — open |

**Parked until polish.** See [core-stats §8](../03-gameplay/stats-attributes/core-stats.md) for the full list of what the rework breaks.

Design rule, derived from `PRESET-BOUNDED`:

> **N zones are cheap if they cluster.** Zones that demand the same condition set are covered by the same preset.

So the balance target for 10 zones and 4 axes is:

```
2 zones per condition set  =  4 presets total
```

and each zone table row must record **which condition set it demands**, or the clustering cannot be checked.

**A zone that demands 2 conditions from different sets is a problem**, because no single build has both — unless dual-wield or accessories provide the second one. That is the entire justification for the extra slots.

→ **open: how many conditions per zone is too many?** One is too flat, four has no answer, two or three is the working range. Unmeasured.

---

## 6. The layers that vary *within* a condition set

A build that owns a condition set still has knobs. These are the balance surfaces *inside* an axis, and they are where future depth comes from once affix identity has been solved:

| Layer | Serves | Current rule |
|---|---|---|
| tempo | **AGI** | `packBonus = 1 + (pack−1)^0.55 × cleave` |
| cleave / chain | **AGI** | cap on how much of a pack one hit reaches |
| infliction | **DEX** | threshold scales with pre-mitigation damage |
| Momentum | resource | gain per second + a floor, `MOM-PERSEC` / `MOM-FLOOR` |

**Balance rule:** these must not add enough to make a build dominant *outside* its condition set. `evidence/09` is the cautionary case — with `decay + conduit` the trigger build still lost to FLAT, so even a paired punish/amplify zone is not automatically a trigger zone.

---

## 7. What still has no number

| | Needs |
|---|---|
| pen as a fraction of armour | §3 — needs a target matched-build DR band |
| conditions per zone | §5 — needs a test that "no single build answers this zone" |
| accessory allocation across 9 layers | blocked on B9 |
| affix line budget per rarity | blocked on B10 |
| tree share of the 25% envelope | needs to be counted against the 2-slot rule in §4 |
| contract magnitude | derived above (A ≈ 5.6·D) but unverified |