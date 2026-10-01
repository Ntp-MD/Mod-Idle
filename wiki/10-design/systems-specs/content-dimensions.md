# Spec: Content

> Back to: [README.md](../../index.md) · rules: [rules.md](design-rules.md) · **Status: draft — awaiting O4 / O8**
> The actual zones, monsters and progression are in [spec-fantasy-content.md](../../01-world/regions/zones-and-monsters.md)

---

## 1. Content dimension map

| Layer | Which archetype/axis it creates | Genuinely a niche? (from evidence) |
|---|---|---|
| armour hit-size | FORCE + PEN | yes |
| armour adapting (ramps with hits/s) | FORCE vs CADENCE | yes (spread 81%) |
| evasion | PRECISION | yes |
| block | PRECISION (via block-break) | yes |
| push / tempo | CADENCE | yes |
| regen + HP phase | MASTERY (phase-break) | yes, after re-wiring (degenerate before) |
| amplify window (vulnerable/shatter/expose) | MASTERY + element | yes |
| pack size | CADENCE / cleave | yes |
| **resource pressure** (decay / steal = punish + conduit / ward-break = amplify) | Amulet: Momentum cap, regen, ICD | yes, once the dimension was added (O7) |
| **resist (punish only)** | — | no, needs an expose partner (`DIM-PAIRING`) → **O8** |
| **ailment immunity (alone)** | — | no, does nothing without amplify → **O8** |
| **flat subtraction armour** | — | no, cliff −84..−95% |

**Usable layer count: 9** → `AXIS-LAYER` wants >=8 → **passes for 4 axes** if O8 cuts nothing.

If O8 cuts resist and ailment immunity, the ones that were already marked ✘ go away, so the count stays at **9 — exactly at the limit, with no buffer.** If O1 finds a bug, an axis has to go.

⚠️ **The model has no elemental dimension at all**, which is why `resist` and the fire half of zone 6 have nothing to sit on. That absence *is* the O8 finding.

---

## 2. Cut order (when authoring volume does not fit)

Economy → pack → ailment+immunity:

| Order | What gets cut | Cost |
|---|---|---|
| 1 | **resist** + **ailment immunity** | lowest — both are punish-only and already measure 0% effect (`evidence/02`: −47% to −95%) |
| 2 | **resource pressure** | medium — the Amulet is not in the MVP slot set anyway |
| 3 | **pack combat** | high — requires the multi-target engine (D6) |
| 4 | high crafting tiers | high |

---

## 3. Two-tier magnitude — the rule that stops punishment while asleep

| Tier | Tag strength | Player state | Cliff allowed |
|---|---|---|---|
| **idle-safe** (~90% of the time) | weak · every loadout within ~20% of optimum | offline/asleep | no more than −20% |
| **contract/challenge** | strong · modifiers rotate every 12-24h | awake, opt-in | a full −60%, and *the player chose it* |

**Why:** no death offline → losing costs time → a cliff while asleep is punishment, not a choice.

And depth that only matters when you change zone (which an idle player does weekly) **does not justify 80 mods**.

D4 used the same logic to defuse a loot trap:
> *"Armor and Resistance penalties per Torment Tiers have been removed"*

---

## 4. Magnitude cap — bounded from the player's side

`MAG-CAP` was written as `armour_zone <= ~1.5 × player maxHit`, but PoE's own numbers say otherwise: 50% DR needs ~5x the damage and 90% DR needs 45x, so **1.5x gives roughly 23% DR**. The threshold has no derivation and has to be redefined in terms of DR — see [spec-fantasy-content.md §10.2](../../01-world/regions/zones-and-monsters.md).

Past that point the cliff moves from gear to **tag magnitude** — `evidence/06` measured the cliff surviving at:
```
armour 79/71% · evade 73/61% · pack 61%
```
So gear was never the fix; magnitude was.

---

## 5. The combined result (`evidence/04`, `evidence/06`)

`evidence/04` — spread per dimension (higher spread = decides more clearly):
```
pack 63% > push 36% > expose 33% > armour 16% > regen 5% > vulnerable 0% = shatter 0%
```
→ `pack` is the only dimension over the `SHARE-CAP` limit · `vulnerable`/`shatter` at 0% spread separate nothing in this model, even though the dependency probe says they are parasites

`evidence/06` — preset coverage across 15 zones, plus cliffs:
```
1 preset 78% · 2 -> 84% · 3 -> 88% · 4 -> 90-92%  ->  "unreachable in 4" at 95%
cliff >55%: armour-hi 80% · evade-hi 73% · exp-fire 71% · pack-10 68% · armour-max 65%
            shatter 65% · vuln 62% · pack-6 61%   (8 zones)
```

**Two things still fail, and they are exactly why gate 2 does not pass yet:**

1. **There are 8 cliff zones, not 3** — including `exp-fire` at 71% and `vuln`/`shatter` at 62-65%. The cliff comes from tag magnitude, not gear → fix with `MAG-CAP` + `CONTENT-TWOTIER`, not by changing gear.
2. **4 presets still miss 95%**, contradicting `evidence/03`, which got 99.6% with 2 presets at 8 zones. The difference is zone count → **O3 cannot be decided from `evidence/03` any more.**

---

## 6. Open

- [ ] **O4** — phase-1 dimension count (derived from `AXIS-LAYER`, not a matter of taste)
- [ ] **O8** — are resist / ailment immunity in scope? Decide **before** O1, because it changes the layer count
- [ ] `evidence/09` magnitudes for steal/decay were hand-set and too strong — usable for the **shape**, never for magnitude