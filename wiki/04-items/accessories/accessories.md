# Accessories

> [index](../../index.md) · [weapons](../weapons/weapons.md) · [affixes](../affixes.md) · [balance notes](../../10-design/balance-notes.md)

**Six slots. None of them is matched to a layer yet.** Status: slots exist, contents do not.

| # | Slot | Holds | Layer it was meant to answer |
|---|---|---|---|
| 1 | **Amulet** | accessory | Momentum cap, regen, ICD — **O7, the only accessory with a confirmed layer** |
| 2 | **Ring** (left) | accessory | element to expose / consume |
| 3 | **Ring** (right) | accessory | accuracy, hit floor |
| 4 | **Belt** | accessory | target cap, chain, cleave |
| 5 | **Cloak** | accessory | evasion |
| 6 | **Artifact** | anything, just held | passive stat or skill |
| 7 | **Shield** | accessory, **left hand only** | block |

## Artifact is the odd one

Every other slot holds something you wear. An artifact is simply **held** — one line in a list that grants a stat or a skill.

In a text game this is the cheapest possible implementation and the least embodied. Whether that makes it boring or obvious is untested.

---

## The problem: six slots, nine layers

`content-dimensions.md` has **9 usable layers**. Six accessory slots competing for them means some slots will have to share, and **nothing anywhere says what happens when they do.**

Worse, some assignments are already suspect:

| conflict | |
|---|---|
| Cloak answers evasion, Gloves answer evasion penetration | two slots working the same layer, one defending and one attacking |
| Belt answers cleave, and `Spear` has `+cleave` as its implicit | is the Belt redundant? |
| Ring-left answers element, Ring-right answers accuracy | two rings is two unrelated singletons, which is the opposite of a set |

---

## Two rules that keep accessories from breaking everything

### 1. No accessory may draw the additive pool

The measurement: **2 slots sharing one additive pool give +11.1% on a swap (visible). 3 slots drop it to +7.1% (invisible).**

The additive pool has a **slot count**, not just a percentage cap:

| | additive slots |
|---|---|
| one weapon | 1 |
| dual wield | **2 — at the ceiling** |
| + tree nodes | **over** |
| + accessory with flat damage% | **over** |

→ **every accessory must be conditional or utility.** Without this rule, ten slots each with some flat damage destroys every weapon swap. It also means `atk-flat` cannot roll on accessories — only on weapons, where it has a base to scale against.

### 2. `SLOT-GATE` is about item types, not slot uses

The rule says never ship a slot before its content layer exists. The left hand does two different things, which is **not a bug** — it is the Elden Ring model, where a slot is polymorphic and **the item carries the function**:

```
left hand + weapon     -> damage
left hand + shield     -> block
left hand + accessory  -> tempo
```

→ **restated: a slot may ship if at least one item type that fits it has a layer.** The failure mode is not "this slot does two things", it is "nothing that goes in this slot does anything".

---

## The MVP problem

The MVP was 4 slots (Weapon, Grip, Gloves, Chest). Accessories take it to **10**.

`SLOT-GATE` does not cap the count, but **authoring cost does**, and there is a third consideration: every extra slot with a flat percentage makes weapon swaps less noticeable, which is the thing the whole perceptibility budget is protecting.

---

## Open

- [ ] match the six slots to layers, and state what happens when two share one
- [ ] is Cloak redundant with Gloves, and is Belt redundant with Spear?
- [ ] two rings answering two unrelated things is not a set — should they pair?
- [ ] does Shield belong here or under weapons? It is left-hand-only, which makes it behave like a weapon
- [ ] whether the MVP stays at 4 or expands, given that ten slots is ten authoring commitments