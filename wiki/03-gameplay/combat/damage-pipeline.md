# Spec: Core — order of operations

> Back to: [README.md](../../index.md) · rules: [rules.md](../../10-design/systems-specs/design-rules.md) · **Status: `draft`**

**This is the "make the core solid first" part (D15)** — everything that has to be fixed before touching balance numbers.

⚠️ **Hard requirement: the schema must be data-driven.** Otherwise "solid core" turns into "permanently wrong core", because it will have baked in the answers to O1 and O8.

---

## 1. Schema principles

| Forbidden | Required |
|---|---|
| Core stat count hard-coded as fields | a list in data, so axes can be added or removed without touching logic |
| `resistFire: number` as a field | tags composed from a dimension list |
| Slot count as a fixed-size array | slots come from data and must always have a matching layer (`SLOT-GATE`) |
| Triggers as if/else branches | a closed enum that resolves |

**Why this is mandatory:** O1 (3 or 4 axes) and O8 (is resist in scope) are still unanswered. If the schema bakes in an answer, this document has to be torn up.

---

## 2. Order of operations — the most important part of this file

This was never written down before. Get the order wrong and every stat interacts wrongly, which cannot be fixed without rebuilding the game.

```
per hit:
  1. attack interval        <- CADENCE reduces it to the time left after push recovery
  2. hit chance             <- PRECISION: 1 - evasion/(2*acc)   (PoE hyperbolic, not Melvor)
       `-- miss -> this hit ends, no Momentum consumed
  3. base damage            <- FORCE: weapon roll within [min,max]
  4. + addends (flat)       <- e.g. +str bonus -> additive term per the Melvor formula
  5. x increasers (more/increased)
  6. [AMP] amplify consumption   <- chest spends amplify (vulnerable/exposed/shatter taken)
       `-- must sit AFTER 5, because it multiplies what increasers already expanded
       `-- must sit BEFORE 8, because DR is computed from D_raw
  7. [AMP] penetration           <- gloves
  8. [AMP] armour / DR curve     <- DR(A, D) = A/(A + 5*D_raw)  cap 90%
       `-- penetration must sit BEFORE DR (it reduces D_raw), not after
  9. [AMP] ailment infliction    <- threshold scales with pre-mitigation damage = value before step 8
 10. Momentum gain          <- per second, not per hit (`MOM-PERSEC`)
 11. Momentum spend         <- trigger ICD reduced, auto-spent while offline
 12. cleave / chain         <- target cap, belt/legs
 13. target HP decreases -> dead or not

per second:
 14. Momentum regen / decay <- floor `max(0.35*gain, gain - drain)` (`MOM-FLOOR`)
 15. phase / regen tick     <- ward, HP phase
 16. contract rotation      <- every 12-24h (`CONTENT-TWOTIER`)
```

`[AMP]` marks the steps where the **window kind** decides who benefits — see [spec-fantasy-content.md §10.1](../../01-world/regions/zones-and-monsters.md). Without that binding, one axis collects every window.

### Not settled — must be decided

| # | Question | Consequence | Options |
|---|---|---|---|
| A | does armour shred (gloves) sit before or after penetration? | both live on gloves, so the wrong order makes one of them worthless | shred first, so pen has value against an already-shredded target |
| B | amplify before or after increasers? | must be after increasers, or amplify gets expanded twice by increasers | hardcode after — once decided, write it as a comment with the reasoning |
| C | does the ailment threshold use pre-mitigation = before DR but **after** amplify? | PoE2 uses the hit's pre-mitigation value, which already includes amplify | include amplify |
| D | does cleave split off maxHit, or off the whole set already hit? | very different once pack > 2 and cleave is per target | split off the whole set (recursive but deterministic) |

→ A and D are **formula questions that need no measurement**, but they must be measured *after* being written, to confirm cleave does not break `SHARE-CAP`.

---

## 3. Entities

Every field the model reads **must have a default** — otherwise it is bug class 3 and 4 from the known-bug list in rules.md.

```
Item
  baseTypeId   -> points at BaseType (attack speed, crit, damage range, implicit, skill grant)
  rarity       -> magic | rare | ancestral | unique      (line count = rarity)
  affixes[]    -> Affix   (positive only — `DOWNSIDE-PLACEMENT`)
  implicit[]   -> from the base type only — `BASETYPE-CARRIER`
  crafted[]    -> max 1 — `CRAFT-GUARANTEED`
  groupUsed[]  -> group exclusivity — `GROUP-EXCLUSIVE`

Affix
  id, group, tier
  scope        -> flat | weapon | tempo | pen | pack | amplify | inflict | element | resource
  condition    -> null | zone_tag     <- non-null means zone-conditional (`DMG-CONDITIONAL`)
  magnitude    -> must always carry provenance

Zone / Monster
  tags[]       -> { type, polarity: punish | amplify, magnitude, tier }
  hp, evasion, dr, atkSpeed, maxHit
  tier         -> amplify scales down with tier (`AMPLIFY-TIERFALL`)

CoreStat axes -> a list in data (O1)
Derived       -> maxHit, interval, hitChance, inflictChance, amplifyMagnitude, kills/h
Resource      -> Momentum: gainPerSec, cap, regen, drain
```

### Tag polarity is enforced, not documented

```js
// every punish dimension must ship with an amplify partner, or it is dead
assert everyZoneHasPairedTag(zone)
```

The list from [spec-content.md](../../10-design/systems-specs/content-dimensions.md) §1 that O8 still has to resolve: `resist` and `ailment immunity` are punish-only, so if O8 cuts them they have to be removed from the data, not flagged off.

---

## 4. Invariants — five of them, as real assertions

From rules.md. These belong in code, not in a checklist.

```js
assert(allFinite(rates))                          // bugs 2, 3
assert(allFieldsPresent(zone, model.fields))       // bug 4
assert(!thresholdDerivedFromResult)               // bug 1
reportTiesSeparately(winCount, tieCount, spread)   // bug 5 — never report a net tally
assert(procWeight <= avgHit / 3)                  // `PROC-WEIGHT` — the validator must throw
```

⚠️ The bug-3 lesson generalises: **never default a field to a blanket 0.** `pack = 0` makes `(pack-1)^0.55` NaN. Per-field defaults, explicitly.

---

## 5. Budgets as constants

```js
const BUDGET = {
  MAXHIT_ENVELOPE: 0.25,   // `MAXHIT-CAP`      provenance: sourced (PoE2 caps at +25%)
  ADDITIVE_SLOTS: 2,       // `SLOT-BUDGET`    provenance: measured (evidence/08)
  LINE_BUDGET: { rare: 4, ancestral: 6 },  // `LINE-BUDGET` provenance: sourced (D4)
  NOISE_FLOOR: 0.09,       // provenance: measured (evidence/01) — per-encounter variance
  PACK_EXP: 0.55,          // `PACK-FORMULA`   provenance: measured (evidence/04)
  MOMENTUM_FLOOR: 0.35,    // `MOM-FLOOR`      provenance: assumed — no evidence yet
}
```

**Every value here needs a `provenance`.** Any value marked `assumed` needs a test that can make it **fail**, not merely assert that it is unchanged.

---

## 6. Open

- [ ] Decide A-D in §2 (formula questions, nothing to measure first)
- [ ] Write the schema as real data and verify it is genuinely data-driven (add an axis to the data and the harness still runs without touching logic)
- [ ] Put the invariants into real tests on a reduced model and see whether they catch the old bugs — **if they do not, the invariants are not enough**
- [ ] O1 / O8 do not have to be answered before this section, but it must be verified that the schema has not baked in an answer