# Weapons

> [index](../../index.md) · [affixes](../affixes.md) · [rarity](../rarity-system.md) · [accessories](../accessories/accessories.md) · [balance notes](../../10-design/balance-notes.md)

**Twelve weapons, no families, no art.** Status: designed, **never measured**, and awaiting **O6**.

Sorted by attack speed (APS). Fast lands many light hits, slow lands few heavy ones.

| # | Weapon | Hands | Fills | APS | Axis | implicit |
|---|---|---|---|---|---|---|
| 1 | **Dagger** | 1 | either | 1.45 | PRECISION | +crit chance |
| 2 | **Bow** | **2** | both | 1.40 | CADENCE | +attack speed |
| 3 | **Rod** | 1 | either | 1.40 | MASTERY | +infliction magnitude |
| 4 | **Wand** | 1 | either | 1.30 | MASTERY | +amplify consumption |
| 5 | **Sword** | 1 | either | 1.25 | PRECISION | +hit chance |
| 6 | **Spear** | 1 | either | 1.25 | CADENCE | +cleave |
| 7 | **Staff** | **2** | both | 1.15 | MASTERY | +phase-break |
| 8 | **Mace** | 1 | either | 1.15 | FORCE | +max hit (flat) |
| 9 | **Greatsword** | **2** | both | 1.05 | PRECISION | +block-break |
| 10 | **Crossbow** | **2** | both | 0.95 | CADENCE | +target cap (knockback) |
| 11 | **Maul** | **2** | both | 0.90 | FORCE | +armour pen scaling with hit size |

**Cut by decision:** Greatmaul · Halberd · Glaive.
**No families** — a text game has no silhouette to recognise, so grouping by shape adds a label the player has to memorise for nothing. The name is a plain noun; how many hands it takes is a line property.

---

## The hand rules

| Rule | |
|---|---|
| a one-handed weapon goes in **either** hand | including **the same type twice** — two Swords is allowed |
| **except** Wand and Rod | implements are limited to **one per build**. You may move it between hands, not have two |
| five weapons are **two-handed** | Bow · Crossbow · Staff · Greatsword · Maul |
| left and right are **identical** | there is no hand-specific behaviour |
| **Shield** is left hand only | see [accessories](../accessories/accessories.md) |

### Why implements are limited to one

MASTERY is the amplify axis. Two Rods would stack one axis twice, which contradicts `AXIS-LAYER` (1 axis : >=2 layers) and `GROUP-EXCLUSIVE` (only one modifier per group).

### Why this is a real choice, not just a slot count

Staff is two-handed and large. Wand and Rod are one-handed and small. That is the whole MASTERY decision: **size versus keeping a hand free**.

And the cost of two hands is concrete — see the accessories page, the left hand is where tempo lives.

### Dual-wield lands exactly on the measured ceiling

`SLOT-BUDGET` measured that **2 slots sharing one additive pool give +11.1% on a swap (visible)**, while 3 slots drop to +7.1% (invisible).

Dual wield = 2 additive slots = **exactly the ceiling**. Not merely permitted — it is the measured optimum. A third additive source (tree, or a flat-damage accessory) pushes past it.

---

## What the two-handed weapons cost

A two-handed weapon fills both hand slots, so it unequips **two** items at once:

```
Maul   2 hands   0.90 APS   FORCE   +armour pen vs large hits
       FILLS:    right hand, left hand
       UNEQUIPS: Sword, Warden's Grip
```

**The Maul fights itself.** FORCE means big hits, big hits mean slow, and being two-handed locks the slot that gives tempo. It has to buy that back with hit size before it is worth it. The other two-handed weapons do not have this problem: PRECISION and MASTERY do not lean on tempo the way FORCE does.

---

## Unbalanced, and it shows

| Axis | Weapons | Zones won |
|---|---|---|
| CADENCE | 4 | 2 |
| PRECISION | 3 (+ shield) | 2 |
| MASTERY | 3 | 2 |
| **FORCE** | **2** | 2 |

A FORCE player picks from 2 of 11, while a CADENCE player picks from 4. It does not violate `AXIS-LAYER` (which counts zones, not weapons) but it is felt.

**Cuts if O6 forces it to 4:** Greatsword and Crossbow are the least load-bearing — PRECISION already has three one-handed options, CADENCE already has four.

---

## Weapons as the second axis of variety

The affix pool measurement found only **3 affix kinds that actually separate builds** out of 18. Affixes are currently a weak source of identity.

There is a fourth route that was never named: **let the weapon be the second axis.** "I give up my offhand for hit size" is a build decision that needs no affix at all.

⚠️ **The caveat:** base-type *gating of affixes* was measured and did nothing — 12/18 mods stayed flat, wand and bow were 100% flat. This proposal uses a **different mechanism**, implicit plus APS, which has never been measured in this project. Do not read the first result as evidence against the second; they are different things.

---

## Open

- [ ] **O6** — how many base types survive. The cap of 4 was set for authoring cost, and this list is 11.
- [ ] the unique cap was derived as `4 base types x 4 axes = 16` and is now stale → see [rarity-system.md](../rarity-system.md)
- [ ] no loot table: which zones drop which weapons is unknown, and it is gated on O6
- [ ] whether a one-handed weapon's implicit should differ between two copies of the same type, or two Daggers is just twice the same numbers