# Thesis — why this idea has a chance

> Back to: [README.md](../index.md)

## 0. TL;DR

Original idea: a Melvor-style idle game that adds weapon/attribute depth using ideas from PoE, PoE 2 and Diablo.

**Locked direction (D13): text-based RPG idle, fantasy theme**

Conclusion after grilling: **the idea is worth continuing, but what looked like a single system is actually two systems that must ship together** — the item side and the monster/content side. The way projects like this die is by finishing the first one and discovering the second one does not exist.

The chain that carries the whole project (if any link is missing, the idea collapses back to BI/Slot) — see [README.md](../index.md#the-chain-the-whole-project-rests-on)

The three decisions that evidence overturned: see [decisions.md](game-design-document.md) §2 (R1-R4)

### What the text-based direction changes

| Gains | Loses |
|---|---|
| No art pipeline / animator / UI designer needed — matches D9 (one person, no revenue) | Cuts the *visual* half of loot dopamine |
| `+12% kph in the Ashwood Hollow` is a sentence — fits D4 exactly | `evidence/08` (+5.3% invisible) matters more now, because there is no art to help |
| sort / diff fall out for free — the "never-counted UI work" shrinks a lot | Render fidelity still has to be decided (O9), and it could reverse the direction |

---

## 0.1 Risk number one — text-based removes the feeling

**Mechanism:** a good share of loot satisfaction in Diablo/PoE is *visual* — the drop animation, the rainbow item card, the big number that grows as you upgrade. Text removes all of it.

What is left is the original measurement from `evidence/08`:

| slots sharing one additive pool | swapping one item |
|---|---|
| 2 | +11.1% visible |
| 3 | +7.1% invisible |
| **4** | **+5.3% invisible** |

MVP = 4 slots → with no visuals to lean on, the player sees only a number that changed by an amount they cannot perceive, which carries no meaning.

**The consequence to fear:** the game passes every technical gate (1-4 are measured from numbers) and then fails gate 5, which is measured from real human behaviour.

**The compensation that exists:** `TAGGED-VERBATIM` — the text carries the condition instead of the number. +5% is invisible, but `[ARMOUR HIGH]` tells you the item only has a life in the high-armour zone. This is an advantage text has and graphical UI makes very hard.

**Do not yet know whether it is enough** → this is the same question as O10. **If it cannot be answered, direction D13 has to be reopened.**

**Fastest test:** prototype a Melvor mod rendered as plain text → play 7 days → count how often you hesitate over which loadout to switch to. If under 1/day, D13 is dead without writing an engine.

### 0.2 The limit on all the evidence in this project

Every number cited anywhere here comes from a **reduced model whose magnitudes were set by hand**. That is not just approximation error — for some conclusions the *direction* depends on the chosen values (`evidence/09` itself declares that steal 0.2 shuts the whole economy, which is why the 0.53x that shows up on every punishing row is a product of tuning, not a measurement of impact). What is robust is the **shape of the tables**, not the values.

The scripts that produced them have since been deleted, so every figure is **`measured-but-unverifiable`**: citable, not re-checkable.

---

## 1. The original brief

| Topic | First-round answer |
|---|---|
| Combat | Melvor-style idle ticks + interval-based trigger skills |
| Source of depth | signature items + loot gambling + crafting ladder |
| Affix budget | 6-8 lines per weapon (PoE-lite) → **overturned to 4/6, see R1** |
| Target player | idle-first |
| Offline risk | no death while offline |
| Monster-side tag | armour+pen, ailment/immunity, resist, swarmCount (all four chosen) → **contradicts §3, see O8** |
| First vertical slice | combat sim + valuation |
| Downside affix | forced 1 line on every item from mid-tier up → **overturned to recipe-only, see R2** |
| Loot volume | drop-rate cap + auto-salvage *and* hard inventory cap + stash (mix of 1 and 3) |
| Currency | tier-locked salvage + gated mats |
| Monetization | built solo, no revenue |
| Scope | vertical slice with a gate |
| Class system | **no classes, but a passive tree** |

---

## 2. Why "add depth to weapons only" does not survive

### 2.1 Melvor weapons only reach three slots in the formula

The real formulas, from the Melvor wiki:

```
maxHit   = floor( M × (2.2 + effLvl/10 + ((effLvl+17) × StrBonus)/640) )
accRate  = floor( (effLvl+9) × (BaseAccBonus + 64) × (1 + AccMod/100) )
hit%     = 1 − TargetEvasion / (2 × AccRating)
```

A weapon contributes through `StrBonus` (an additive term), `BaseAccBonus` (a multiplier inside a product) and `AttackSpeed`.

Item share of maxHit (M=1) from `evidence/05`:

| StrBonus | 8 | 20 | 35 | 50 | 70 | 90 |
|---|---|---|---|---|---|---|
| share of maxHit | ~9% | 20% | 30% | 38-43% | 51% | 57% |

This share is **nearly constant across levels** (1→99 moves it less than 2 points), which means the shape of Melvor is correct but the combined ceiling is **~50%**.

**Structural conclusion:** every affix of the `+%max hit` / `+str bonus` / `+%accuracy` family lands in **the same slot** → collapses into a single DPS number → however many lines you add, it is still BI/Slot. A genuinely new affix has to target **a slot the formula does not have yet** → see `DMG-CONDITIONAL`.

### 2.2 The monster side has almost nothing to grab onto

Melvor monsters have `Hitpoints`, `Attack Speed`, `Max Hit`, `DR/AR` and nothing else — there is no elemental/damage-type resistance documented as a per-monster stat.

`+40% fire damage` only becomes a decision if some mob resists or exposes fire. **Item depth on a 4-slot schema collapses straight back into a single DPS number.**

### 2.3 Idle collides with loot RNG at the level of the whole business

Idle sells "you don't have to care". Itemization sells "you care about every piece". Offline combat produces loot all night → you open the game to a stash of a thousand items and must appraisal/salvage/filter before anything else, and item valuation becomes **contextual** (zone + build), not one number.

That is the reason valuation has to be *cheap* (0.96s for the whole stash × every zone), not merely "nice to have contextual".

---

## 3. Contradictions that were never resolved

This section exists because these are **contradictions**, not answers. Do not read row 1 of §1 as approved scope.

- **§1 chose all four monster tags** (including resist + ailment/immunity) but **spec-content marks both ✘** because they are punish-only, which violates `DIM-PAIRING` and gate 1 → must be decided as **O8** in decisions.md.
- **§8.1 sets MVP = 4 slots** but the Amulet was approved on the strength of `evidence/09` without being added to the MVP set → spec-items.md must decide whether to expand to 5 or drop the Amulet from the MVP.

Both sat in the original document with nobody noticing, because they lived in different sections. That is the kind of drift the file split exists to catch.

---

## 4. Melvor, and what B13 borrows from it

The question "should this work like Melvor?" has a different answer per part of the design.

### What Melvor already does, and B13 is that

Melvor's zones are a ladder where the harder zone pays better and you simply have to be strong enough to survive it. There is no yield penalty for failing — **you just do not get there.**

**B13 is Melvor's ladder plus a visible cost.** Melvor hides the failure by never letting you enter a zone you lose in; B13 lets you enter, and charges you in drop rate for being under-level.

### Where B13 and Melvor genuinely differ

| | Melvor | here |
|---|---|---|
| too weak for the zone | cannot enter | can enter, yield drops |
| the decision | "is this zone safe?" | "is this zone worth the loss?" |
| offline | safe zone only | safe zone never penalised |
| failure feedback | **none** | the yield number itself |

**This is the same argument as `CONTENT-TWOTIER`, one level down.** Melvor's answer is a gate before the zone. B13's answer is a price inside the zone.

### The one thing worth stealing: Melvor has no death punishment and is better for it

Melvor loses you nothing on death — you keep the session, you lose the time. That is the same `D3` position taken here, and it is why `D3` is worth keeping rather than re-deriving.

### Where B13 adds something Melvor does not have

Melvor has **no second axis**: every stat feeds one DPS number (§2.1 above, the item ceiling is ~50%). B13 creates a defensive build that is good for a different reason — it clears reliably — which is a decision Melvor cannot pose because defensive stats there are worth nothing.

**This is the argument for B13 in one line:** it is the first mechanic in this project that a Melvor-style idle game structurally cannot express.