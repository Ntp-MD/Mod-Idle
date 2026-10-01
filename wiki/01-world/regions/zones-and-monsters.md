# Spec: Content — the actual game

> Back to: [README.md](../../index.md) · [spec-content.md](../../10-design/systems-specs/content-dimensions.md) (dimensions) · [spec-core.md](../../03-gameplay/combat/damage-pipeline.md) (order of operations) · **Status: `draft`**
> Closes the biggest gap: D13 locked "fantasy theme" but there was no zone, monster or progression behind it.

⚠️ **Every number and name here is `assumed`.** Nothing has been measured. All magnitudes were set by hand and must be torn up and rebuilt in a real harness.

**This file does not answer O1** — it is the *hypothesis* to be tested, not the answer.

---

## 1. Principle: every zone is a choice, never a tax

From `evidence/09`: punish-only makes the trigger build worse **every time**, and `DIM-PAIRING` forbids it.

```
every zone = base stat (makes the wrong build worse) + window (makes the right build spike)
```

→ no zone is a pure tax. Losing has to come from *choosing wrong*, never from bad luck.

**This is the rule that replaces `evidence/04`, which does not actually exist**, and it replaces `resist` / `ailment immunity`, which O8 may cut.

⚠️ **`DIM-PAIRING` as first written was too loose** — see §10.1.

---

## 2. Ten zones

Designed so each axis gets exactly two zones, satisfying `AXIS-LAYER`.

| # | Zone | base stat (punish) | window (amplify) | intended axis | tier |
|---|---|---|---|---|---|
| 1 | **Ashwood Hollow** | high evasion | EXPOSED — every hit leaves a mark | **PRECISION** | idle-safe |
| 2 | **Weeping Gate** | armour *adapting* (the longer you hit it, the harder it gets) | BREACH — hit hard enough and the gate splits | **FORCE** | idle-safe |
| 3 | **Sunken Reliquary** | flat heavy armour, no adaptation | SUNDER — sustained attacks accumulate cracks | **FORCE** | idle-safe |
| 4 | **Rusted Colosseum** | pack of 8 | CHAIN — a hit leaps to three more | **CADENCE** | idle-safe |
| 5 | **Thornwake Fen** | push/tempo drained every second | SURGE — spend Momentum wide | **CADENCE** | idle-safe |
| 6 | **Emberdeep Warren** | 90% fire resist | ERUPTION — the surviving pack heats and detonates | **MASTERY** | idle-safe |
| 7 | **Wardspire** | HP regen in phases | WARD-BREAK — every 4s the ward fails for one round | **MASTERY** | idle-safe |
| 8 | **Gravebound Sepulchre** | 75% block | FRACTURE — 5 blocked hits cracks the guard | **PRECISION** | idle-safe |
| 9 | **Hollowroot Maze** | adapting armour + pack + evasion **at once** | **none** | ? | **contract** |
| 10 | **The Ashen Crown** | everything, but softened | CROWN — a single burst window per cycle | ? | **contract** |

**Zone 6 caveat:** its fire-resist half has no matching layer in spec-content.md, because element resist was cut there under `DIM-PAIRING`. Resolving this is part of **O8**.

### `AXIS-LAYER` check — two zones per axis, exactly

```
PRECISION  1, 8   = 2
FORCE      2, 3   = 2
CADENCE    4, 5   = 2
MASTERY    6, 7   = 2
                                  passes with zero buffer
```

Exactly 2 per axis means **no slack**: if O1 cuts an axis, or a bug turns up, there is nothing to spare.

**Zone 9 tests `DIM-PAIRING` on purpose** — it has no window, which by the rule should make it a dead zone. If it does not die, the rule is wrong.

### `DIM-PAIRING` check — no zone is a pure tax

Every zone 1-8 has both a base stat and a window. Zones 9-10 are contract tier, where `CONTENT-TWOTIER` permits a full cliff.

### `MAG-CAP` — currently unusable

Zones 2, 3 and 9 are the ones at risk of pushing `armour_zone` past the cap. **The threshold itself has no derivation** — see §10.2.

---

## 3. `PRESET-BOUNDED` — a candidate answer to the `evidence/03` vs `06` contradiction

**The problem:** `evidence/03` (8 zones) gets 2 presets = 99.6%, but `evidence/06` (15 zones) gets 4 presets = 92% and still misses 95%. O3 cannot be decided.

**The likely cause:** the number of presets needed is the **number of distinct winners**, not the number of zones.

→ If these 10 zones have only 4 winners (1,2,3 = FORCE · 4,5 = CADENCE · 6,7 = MASTERY · 1,8 = PRECISION), then **4 presets cover all 10 zones**.

**This is a proposal to test, not a conclusion** — `evidence/03` and `06` have to be rerun against this roster. Note that neither script still exists.

---

## 4. Monsters — three per zone

| Zone | Signature | Skeletons | Boss |
|---|---|---|---|
| 1 Ashwood Hollow | **Gloomwarden** (evade) | Hollow Stalker x3 | Elder Stag |
| 2 Weeping Gate | **Gateward** (adapting armour) | Weeping Sentinel x2 | The Gatekeeper |
| 3 Sunken Reliquary | **Reliquary Golem** (flat armour) | Drowned Warden x2 | Ossuary King |
| 4 Rusted Colosseum | **Rustfang** (pack) | Arena Hound x7 | Gladiarch |
| 5 Thornwake Fen | **Bramblewretch** (tempo drain) | Fen Leech x4 | Motherfen |
| 6 Emberdeep Warren | **Cinder Maw** (fire resist) | Ashling Swarm x6 | Vulcanox |
| 7 Wardspire | **Warden Golem** (regen phase) | Spire Sentinel x2 | The Steward |
| 8 Gravebound Sepulchre | **Sepulcher Shade** (block) | Ossuary Guard x3 | The Interred |
| 9 Hollowroot Maze | **Hollowroot** (3 tags) | Thicket Crawler x5 | — |
| 10 The Ashen Crown | **Ashen Crown** | Remnant x4 | The Crowned |

**Generation rule:** generate from a seeded table. Skeletons reuse the base with different tag intensity, so authoring volume does not grow 10x.

---

## 5. Four base types — a first pass at O6

Authoring cost caps archetypes / weapon bases at 4 → **cut to 4**.

| Base | Main axis | implicit (per `BASETYPE-CARRIER`) | Strong in | Weak in |
|---|---|---|---|---|
| **Emberforged Maul** | FORCE | +armour pen scaling with hit size | 2, 3 | 5, 7 (too slow) |
| **Ashwood Longbow** | CADENCE | +hit chance, shorter interval | 1, 4, 5 | 2 (small hits lose to armour) |
| **Runeshard Blade** | PRECISION | +block-break | 8 | 6 (no payoff) |
| **Warden Halberd** | MASTERY | +amplify magnitude (window becomes flat) | 6, 7 | 1, 8 |

**Why MASTERY is not tied to ailment** — so it survives if O8 cuts ailment immunity. MASTERY uses the amplify window and regen phase, which live in its own two zones.

**Distribution:** 4 bases across 10 zones means at least one base is *strong* per axis, which is what would confirm `BASETYPE-CARRIER` — that the weapon base really carries identity rather than being skin.

---

## 6. Progression — how you unlock when there is no death

**Answer: unlock on a kills/h threshold, not on survival.**

| tier | Unlocks when | Reward |
|---|---|---|
| 1 (zone 1) | start | — |
| 2 (zones 2-3) | kills/h on the previous tier >= 80% of optimum | new base type + new affix group |
| 3 (zones 4-5) | same | — |
| 4 (zones 6-8) | same | first crafted slot |
| 5 (zones 9-10, contract) | **opt in** — not a threshold | contract currency |

Reason: D3 ("no death offline → the currency of losing is time"). Unlocking on survival would make players too afraid to log in, which is a paywall in a game with no money. A kills/h threshold forces you to *gain power* to progress rather than to hide.

**Contracts are always opt-in**, because `CONTENT-TWOTIER` only permits a full cliff while the player is awake and choosing.

---

## 7. Contracts — modifiers rotating every 12-24h

Six examples, rotating by tier:

| modifier | Effect | What it forces |
|---|---|---|
| **Cinder Moon** | pack +50% · amplify −25% | forces cleave, punishes burst |
| **Iron Vigil** | armour ×1.4 · window halved | forces patience and timing |
| **Silt Tide** | momentum drain ×2 · conduit ×1.6 | resource builds shine, flat builds suffer |
| **Hollow Choir** | evasion +40% · EXPOSED never fires | removes PRECISION from the answer |
| **Still Hour** | push/tempo = 0 · SURGE still works | removes CADENCE from the answer |
| **Quiet Warden** | regen ×2 · ward-break window shorter | removes MASTERY from the answer |

→ The last four are **the removal of a winner from a given zone**, which is the direct way to test `HARNESS-EQUALISE` and `AXIS-LAYER`. If you delete an axis and nothing else takes over, that dimension was never creating a niche.

---

## 8. Combat log lines — the fantasy layer that makes text an RPG

This is what substitutes for the visual feeling (see [thesis.md §0.1](../../10-design/pillars-vision.md)). **The number sits inside the sentence, never beside it.**

```
[04:12:03]  Your Emberforged Maul bites deep into the Gateward for 3,910.
            Its gate knits closed — smaller blows will glance.

[04:12:03]  BREACH.  The gate splits.  Your Maul lands for 11,480.

[04:12:07]  The Gloomwarden slips the blow.  It is already fading into the ferns.

[04:12:11]  EXPOSED.  The Gloomwarden is marked — your next 3 strikes pierce evasion.

[04:12:44]  The Rustfang pack closes in — 8 bodies, one killing stroke.

[04:12:44]  CHAIN.  The spark leaps.  8 kills.  Your Momentum surges wide.

[04:19:02]  WARD BREAK.  The Steward's ward fails for one breath.

[04:19:02]  14,006 damage.  The Steward crumbles.
```

**Principles:**

1. The number is always inside a sentence. No floating numeric line.
2. **Every window has a keyword** (BREACH / EXPOSED / CHAIN / WARD BREAK) so the player can learn the pattern without reading the numbers.
3. The big numbers always come from a **window**, never from an ordinary hit — which teaches the player that you have to wait for the moment.
4. "Its gate knits closed" is a **penalty told in prose** rather than a subtracted number.

---

## 9. Not designed yet

| Topic | Why it is missing |
|---|---|
| **Passive tree** | `TREE-DIM` says a node with no matching dimension is dead text · needs the axis count from O1 first |
| **Loot table per zone** | unknown until it is known which of the 4 base types compete and how · needs O6 |
| **Ailment** | needs O5 — if cut, zone 6 loses its window |
| **resist / ailment immunity** | needs O8 — if cut, zone 6 needs a different window |
| **Report screen (O10)** | this file supplies the data, but not the *decision* the player makes |
| **Where the idle-safe / contract line actually falls** | currently by tier · unknown whether players will opt into contracts while awake |

---

## 10. What has to be measured before this file can be trusted

```
1. AXIS-LAYER      -> every axis decides >=2 zones (designed 2/2/2/2 = no buffer)
2. DIM-PAIRING     -> the windowless zone must decide less than the windowed ones
3. PRESET-BOUNDED  -> how many presets does this roster need for 95% · >4 means no saving
4. HARNESS-EQUALISE -> all 4 bases equal at neutral first
5. MAG-CAP         -> armour_zone in zones 2/3/9 must stay under the agreed threshold
6. CONTRACT-ABLATION -> the four contracts that remove a winner must promote another axis
```

**If tests 1-5 pass, there is a real game. If test 1 fails, go back and answer O1 before designing more content.**

### 10.1 Measured once, then the script was withdrawn (2026-10-01)

A roster test was written and run, then deleted on request — no script measures this roster any more. Two findings are kept, because they are **design conclusions, not measurements**, and without them this file is silently wrong:

**1. `DIM-PAIRING` in §1 was over-stated — "every zone has a window" is not enough**

The first version gave every zone `vulnerable`/`shatter`, which are **MASTERY-specific** mechanics. Result: MASTERY won **7 of 8** idle-safe zones and `AXIS-LAYER` failed.

→ The correct rule is: **the window must amplify the axis that zone is for**, not merely exist.

| window kind | amplifies | zones |
|---|---|---|
| `BREACH` / `SUNDER` | FORCE (only big hits break through) | 2, 3 |
| `CHAIN` / `SURGE` | CADENCE (only fast hits cash in) | 4, 5 |
| `EXPOSED` / `FRACTURE` | PRECISION (only accurate hits cash in) | 1, 8 |
| `ERUPTION` / `WARD-BREAK` | MASTERY (only burst cashes in) | 6, 7 |

→ **§2 has to carry a window-kind column.** Without it a reader has to guess the window→axis mapping, and will guess wrong — which is exactly the bug that handed MASTERY 7 zones.

**2. The `pack` multiplier still belongs to MASTERY, while it was meant to be CADENCE**

`evidence/07` already flagged this as `MISMATCH (intended CADENCE)`, but §5 above still assigns the Longbow to zone 4 following the original intent.

→ **Still to decide while talking:** is the pack layer CADENCE's or MASTERY's? If MASTERY's, move the Longbow to another axis. If CADENCE's, strip the mastery term out of `PACK-FORMULA`.

### 10.2 `MAG-CAP` has no usable threshold

The original criterion was `armour_zone <= 1.5 × player maxHit`, but PoE itself says armour at 50% DR needs ~5× the damage and at 90% DR needs 45× → **1.5× gives about 23% DR**, which is nowhere near the "half" the rule was trying to prevent.

→ It is not known what produced the `1.5`. **The threshold has to be redefined as "DR above this much is too much", and expressed as DR, not as a ratio.**

### 10.3 Still unknown

`PRESET-BOUNDED` (3) and contract ablation (6) were never measured reliably — the numbers obtained before the script was withdrawn had a distorted metric of their own, so they were not recorded.