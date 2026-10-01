# Rarity

> [index](../index.md) · [affixes](affixes.md) · [weapons](weapons/weapons.md)

**The core idea comes from PoE.** Three rarities, and **rarity is the line count** — not a separate axis.

## Decided

| rarity | affix lines | special |
|---|---|---|
| **common** | 2-4 | — |
| **rare** | 4-5 | — |
| **unique** | 5 | + 1 special effect |

**`epic` is cut.** It was a fourth label doing nothing the other three did not.

### What makes a unique unique

**A gameplay effect, not a bigger number.**

> e.g. *Thunder Strike* — 25% chance per Trick Attack to trigger a special effect

So a unique = 5 affix lines **plus** something that changes how the game plays. The affix lines on a unique are normal; the special effect is the point. **Which effect goes on which weapon is a separate conversation** and is not settled here.

---

## What this buys

1. **`MAXHIT-CAP` now has something to count.** It was blocked because there was no ceiling on an item's power. The ceiling is now **5 lines, and a unique adds one effect on top**.
2. **The additive envelope has a frame.** `balance-notes.md` measures the budget in slots as well as percentages. A slot count needs to know how many lines compete for it — that is now **2 to 5**.
3. **It stays close to PoE.** PoE's rarity tier is exactly this: the name tells you how big the item is. Cutting epic keeps the ladder short enough to read.

---

## Open

- [x] **tier 1 — strongest or weakest? → follow PoE.** Tier 1 is the **weakest** roll and drops most often; higher tier is a stronger roll
> **Parked until polish.** Concept work is still in progress; exact numbers and interaction order wait for the design polish pass, before development.

- [ ] **common at 2 lines and rare at 4 lines both land on 4.** So a rare can roll *fewer* lines than a common. Is that allowed, or does rare use 4-5 where the floor guarantees a rare is never smaller than a lucky common?
- [ ] **the unique cap** — the old derivation was `4 base types x 4 axes = 16`, written when there were four base types. There are now eleven weapons. The ceiling that actually matters is not a number, it is this: **a unique is only worth adding if the simulation can represent its state.** No state, no unique — it would sit in the inventory and lie
- [ ] does the unique special effect cost a line, or sit outside the line budget entirely? It reads as outside, but that has not been confirmed against the additive envelope

## Related

The 15% off-signature drop rate (`DROP-SMART`) is where gambling lives now that crafting is guaranteed. Under this model there is a real spread to gamble on: **common can roll 4 lines and rare can roll 4 too**, so the label alone does not tell you which is better. That is the part worth keeping from PoE.
