# Items — overview

> [index](../index.md)

**Five functional types, ten slots, ten affix kinds.** Status: structure settled, **not one number measured**.

## The five types

| Type | Affixes | In the inventory list | Needs valuation |
|---|---|---|---|
| **Equipment** | yes, 2/4/6 lines | yes | yes, contextual per zone |
| **Consumable / Infusion** | no, single effect | yes | yes (phase-break window) · also a currency sink |
| **Salvage currency** | no | no, it is a counter | no |
| **Gated material** | no | no, it is a counter | no |
| **Contract token** | no | no, it is a counter | no |

**The player only calls two of these "items"** — equipment and consumable. The rest are numbers on a screen, which is why they are counters and not list entries: a counter needs no sort rule, no valuation and no kph figure that means nothing.

## The pages

| | |
|---|---|
| [`weapons/weapons.md`](weapons/weapons.md) | **eleven** weapons · hand rules · dual wield · why two-handed costs a slot |
| [`affixes.md`](affixes.md) | **ten** kinds, bound to a position · five tiers · four open problems |
| [`rarity-system.md`](rarity-system.md) | **unresolved** · blocks the whole affix budget |
| [`accessories/accessories.md`](accessories/accessories.md) | six slots · shield · none matched to a layer yet |
| [`sets-equipment-bonus/`](sets-equipment-bonus/) | not designed |
| [`armor/`](armor/) `consumables/` `materials/` `key-items/` | not designed |

---

## The rules an item has to obey

| Rule | |
|---|---|
| `MAXHIT-CAP` | <=2 lines in the max-hit axis, <=25% of the envelope combined |
| `DOWNSIDE-PLACEMENT` | **every rolled affix is positive.** Downside lives on recipes and named items only |
| `GROUP-EXCLUSIVE` | only one modifier from a group may appear, which forces lines onto different axes |
| `BASETYPE-CARRIER` | attack speed, crit, implicit live on the **weapon**, not the affix pool |
| `DMG-CONDITIONAL` | unconditional damage% is expensive and rare · zone-conditional damage% is the main source of depth, because it does not collapse into one DPS number |
| `BUILD-SIG` | the valuation unit is `(tree flags + weapon base + gear tags)`, keyed by build hash |
| `DROP-SMART` | ~85/15 build-aware drops · the 15% off-signature is the gambling source |
| **no auto-equip** | loot that drops while idle is **not equipped for you** — see below |

---

## Why no auto-equip is a balance rule, not a QoL choice

**It is the only mechanic in the project that manufactures hesitation**, which is exactly what gate 5 measures: *"at least one moment per day where you hesitate over which loadout to use"*.

A stash holding items better than what you have equipped, none of them applied, is a **standing queue of decisions**.

It also pairs with auto-salvage as a single rule:

```
auto-salvage  ->  discards what cannot be used
no auto-equip ->  keeps what can be used, and makes you choose
```

And it makes `DROP-SMART` pay off: 85% of drops match your build signature, so without auto-salvage filtering them, four fifths of your loot would be wasted.

**It must be filtered hard or it becomes a chore:**

| | |
|---|---|
| auto-salvage keeps only items **better than what you have equipped, in the zone you are in** | 0-5 items in the morning, not 50 |
| if too many survive | a wall of text, and the player stops opening the game |

**kill criterion:** if players skip the morning inventory more than half of days, the auto-salvage threshold is too loose.

---

## The additive budget is counted in slots, not just percent

The measurement: **2 slots sharing one additive pool give +11.1% on a swap (visible). 3 slots drop it to +7.1% (invisible).**

So the pool has a slot count as well as a 25% cap, and it is already full:

| | additive slots |
|---|---|
| one weapon | 1 |
| dual wield | **2 — at the ceiling** |
| + tree nodes | **over** |
| + accessory with flat damage% | **over** |

→ **Only the weapon may carry `atk%` and `atk-flat`.** Accessories are conditional or utility.

The passive tree does not just compete with weapons for power, it competes with them for **perceptibility** — every point of tree budget makes a weapon swap less noticeable. That is a sharper statement of `TREE-BUDGET` than the one currently written.

---

## The largest open question in items

**RESOLVED - the defensive half stays.**

`hp`, `def` and `eva%` are pure mitigation. `DEF-TEMPO` requires defensive stats to express as tempo, because there is no death offline and the currency of losing is time.

**If nothing can kill you, all three are worth zero.**

Answering this decides a third of the affix pool, and it is the one question in items that cannot be deferred.

---

## Open

- [ ] **does the player die while awake?** — decides whether the defensive affix half exists at all
- [ ] rarity line budget — blocks everything in [affixes.md](affixes.md)
- [ ] crit has no axis and no place in the pipeline
- [ ] `atk%` against `atk-flat` — why does flat exist?
- [ ] identity: is it 3 kinds or more? See the old measurement — 12 of 18 mods were generic
- [ ] the unique cap was derived from 4 base types and is stale
- [ ] no loot table per zone exists