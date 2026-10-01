# Rarity

> [index](../index.md) · [affixes](affixes.md) · [weapons](weapons/weapons.md)

**Status: unresolved, and it blocks the entire affix budget.**

## Two models that contradict each other

**Old model — rarity *is* the line count**

```
magic 2 · rare 4 · ancestral 6 · unique = 1 signature that changes a rule
```

This came from a real measurement: Diablo 4 cut affix counts, moved tempering to *"You can now select which specific affix you want to apply"*, and stopped masterworking from raising values. The conclusion was **4/6 rather than 6-8**.

**Current direction — four standard rarities**

```
common · rare · epic · unique
```

Under this model rarity is a **separate axis from line count**. The label says how good the roll is, not how many lines the item has. A common could have 1 line and an epic 5.

---

## Why it has to be resolved before balance

The line budget is what decides how much power an item can hold. Without it:

- there is no ceiling on an item's power
- `MAXHIT-CAP` has nothing to count
- the five affix tiers have no context to roll against

**Balance is currently blocked on this page.** See [balance notes §4](../10-design/balance-notes.md), where the additive envelope is measured in *slots* as well as percentages — and a slot count depends on knowing how many lines compete for it.

---

## The unique ceiling is also stale

It was derived as `4 base types x 4 axes = 16 uniques`, written when there were four base types.

There are now **eleven weapons**, so the derivation no longer holds. It probably wants to be per weapon type rather than per axis, but that is not decided.

The original reasoning still stands and is worth keeping: **a unique is worth adding only if the simulation can represent its state.** If the sim has no state for it, the item will lie quietly in the player's inventory. That is the ceiling that actually matters, and it is a claim about the engine, not about taste.

---

## Open

- [ ] how many lines per rarity?
- [ ] does the measured 4/6 still hold under a 4-tier model, or does it need a different number?
- [ ] is unique still "1 signature that changes a rule", or does it get a line count as well?
- [ ] which rarity holds **tier 1** of an affix? In PoE tier 1 is the weakest and drops most often.
- [ ] re-derive the unique cap from the weapon list

## Related

The 15% off-signature drop rate (`DROP-SMART`) is where gambling lives now that crafting is guaranteed. That assumes there is a spread of rarities worth gambling on — which is another reason this page matters.