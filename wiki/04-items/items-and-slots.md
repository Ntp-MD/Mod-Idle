# Spec: Items

> Back to: [README.md](README.md) · rules: [rules.md](rules.md) · **Status: draft — awaiting O2 / O6**

---

## 1. Item types — five functionally, split into two groups

| Type | Has affixes | In the inventory list | Needs valuation | Source |
|---|---|---|---|---|
| **Equipment** | yes, 2/4/6 lines | yes | yes, contextual per zone | §1.1 |
| **Consumable / Infusion** | no, single effect | yes | yes (phase-break window) | §3 · doubles as a currency sink |
| **Salvage currency** | no | no, it's a counter | no | `CUR-TIERLOCK` |
| **Gated material** | no | no, it's a counter | no | [spec-economy.md](spec-economy.md) §1 |
| **Contract token** | no | no, it's a counter | no | [spec-fantasy-content.md](spec-fantasy-content.md) §6 |

**Why the last three have to be counters rather than items** — if they sit in the list they need a sort rule, they need a valuation, and they need to show a kills/h figure that means nothing. This is a consequence of `NO-DRAG` plus the text direction (D13).

**The player only calls two of these "items"** — equipment and consumable. The rest are numbers on screen.

### 1.1 Rarity is not a sixth type — it is line count

```
magic 2 · rare 4 · ancestral 6 · unique = 1 signature that changes a rule
```

These numbers come from R1 (D4 S4: base affixes 3→4 · tempering lets you choose · masterworking no longer adds value) — **not the 6-8 originally assumed**.

### 1.2 Unique cap: 16 in phase 1

**Unique count = the number of new states the sim has to represent, not a matter of taste.**

Because of the next point, the structural ceiling is:

```
4 base types × 4 deciding axes = 16 uniques
```

Each one must clear `TEXT-VERIFIABLE` (its numbers must come from the sim) before it exists in the game.

**Waits on O6** — if only 3 bases survive, the cap drops to 12.

### 1.3 The bigger problem: identity is really only 3 kinds

`evidence/05` measured a pool of 18 mods → **12 are generic** (they help every archetype equally, which is a score ladder), leaving only 3 genuinely niche ones:

| mod | Zone | exclusivity |
|---|---|---|
| `+15% fire` | exp-fire | 8.9 |
| `+15% cold` | exp-cold | 5.9 |
| `+15% chaos` | exp-chaos | 6.7 |

→ **The game's identity space is 3 kinds, not 18**, and all three are the same axis (element).

That contradicts the thesis directly — [thesis.md §2.1](thesis.md) says a new affix has to target a slot the formula does not have yet, but if 12/18 collapse into one DPS number, only 3 things remain that can separate archetypes.

**Three possible routes, none chosen yet:**

| Route | What it takes | Cost |
|---|---|---|
| (a) accept 3 | design 3 identities properly · use the 16 uniques for variety instead | lowest, but the ceiling is low |
| (b) a second round of `evidence/05` | add zone-conditional mods covering every dimension in [spec-fantasy-content.md](spec-fantasy-content.md) §2 with the right window kind | medium · needs a new measurement |
| (c) drop affixes as the variety source | identity comes from base type + uniques only · affixes are just numbers | low, but `IDENTITY-DEF` has to be rewritten |

→ **Not chosen.** All three have to clear `TEXT-VERIFIABLE` and prove `IDENTITY-DEF` still holds.

---

## 2. The item system

- **Base type carries identity**: attack speed, crit base, damage range, implicit, skill grant — PoE2: *"Grants Skill: Spear Throw"*, *"25% increased Melee Strike Range"*, *"25% chance to Maim on Hit"*
- **Affix roll**: positive only, 4 lines (rare) / 6 (ancestral), **group exclusivity** forces different axes
- **Rarity = line count** — see §1.1
- **Signature/unique must be representable in the sim** before it gets built, ceiling 16 — see §1.2
- **Runeword/recipe**: the formula is known in advance (item type + socket count + order) = deterministic, readable once — the mechanism that suits idle best, borrowed from D2
- **Smart drops**: build signature per `BUILD-SIG`, with 15% off-signature released as the gambling source
- **Loot volume**: cap drops per session + auto-salvage below a threshold (≈200 items → valuation ~0.1s)
- **Valuation UI**: "+X% kills/h in the zone you are training in" — no global item score

---

## 3. Equipment slots — locked by math, not taste

From `evidence/08`: can a swap be felt when several slots share one additive damage pool? (noise floor ±9%)

| Slots sharing one pool | budget/slot (from a 25% envelope) | swapping one item | Result |
|---|---|---|---|
| 2 | 12.5% | +11.1% | **VISIBLE** |
| 3 | 8.3% | +7.1% | invisible |
| 4 | 6.3% | +5.3% | invisible |
| 8 | 3.1% | +2.6% | invisible |
| 11 (Melvor) | 2.3% | +1.9% | invisible |

And pushing 8-11 slots to *felt* would require expanding the total envelope to **195%-990%** = exponential numbers, which breaks the idle progression curve (`MAXHIT-CAP`).

> **Immediate consequence: Melvor has ~11 slots that accept +%damage / +%accuracy. Do it that way and every single item swaps with zero feeling.**

### The split the numbers allow

| Slot | Which term it enters | Layer it answers | Draws from the 25% envelope? |
|---|---|---|---|
| **Weapon** | damage (the additive pool) + base speed/crit/range/implicit | — (this *is* the pool) | **yes, the only one** |
| **Grip / Offhand** | interval & push recovery (tempo — a multiplier in a different term) | push / tempo | no |
| **Gloves** | penetration, armour shred | armour (hit-size + adapting) | no |
| **Belt / Legs** | target cap, chain, cleave | pack size | no |
| **Helm** | ailment infliction + magnitude vs threshold | ailment / immunity | no |
| **Chest** | amplify consumption (vulnerable / shatter / exposed taken) | amplify window | no |
| **Ring (left)** | chooses the element the build will expose / consume | resist + expose | no |
| **Ring (right)** | accuracy, unwavering (hit floor) | evasion | no |
| **Amulet** | trigger capacity: ICD reduction, Momentum cap/regen, on-spend | resource pressure (conduit / ward-break) | no |
| **Ammo / Infusion** (consumable) | element infusion, phase-break (execute window) | regen phase | no, and it is a currency sink |

### MVP slot set: 4

**Weapon, Grip, Gloves, Chest** — these four have layers that spec-content.md already vouches for.

`SLOT-GATE`: **never ship a slot before its content layer actually exists.** Otherwise the slot is a place to put pretty numbers that do nothing, and it leads straight into the trap `evidence/07` measured — archetypes dying because they have no dimension of their own.

⚠️ **The Amulet is still undecided.** O7 approved it (resource pressure has a real layer per `evidence/09`) but it was never added to the MVP set. Pick one:
- (a) expand the MVP to **5 slots** if resource pressure clears harness test 2 (>=5% of tag space)
- (b) pull the Amulet out of the MVP until the next round — no code wasted, because the layer stays in the dimension map

---

## 4. The rule this becomes (`DMG-CONDITIONAL`)

> **Unconditional damage% is expensive and rare (25% across the whole game, nearly all of it on the weapon)**
> **Conditional (zone-scoped) damage% is cheap and common, because it does not collapse into one DPS number**

Supporting figures: pen in a high-armour zone +33%, cleave in a pack-6 zone +63%, amplify in a vulnerable zone +90%, accuracy in an evasion zone +52% — and **0% outside those zones**.

Which means a tag slot's swap is felt **only when the player is about to change zone**, which matches `evidence/03`'s finding that 2 presets capture 99.6% of the value. That is not a defect — it is the **job** of the contextual score.

---

## 5. Perceptibility — why tree +%damage has to be capped

Computed as `E/(1+T)` with E = the 25% gear envelope, noise floor ±9%

| tree +%increased (same pool as gear) | gear swap | Felt? |
|---|---|---|
| 0% | +25% | yes |
| 100% | +12.5% | barely |
| **178%** | **+9%** | **invisible** |
| 300% | +6.3% | not at all |

`TREE-BUDGET`: passive-tree +%damage sharing a pool with gear gets **<= ~25% increased** — the crossover sits at 178%, after which gear is invisible.

---

## 6. Build signature

No classes, so the valuation unit is `(tree flags + weapon base + gear tags)` and the cache key is a build hash.

Why: without this unit, smart drops (`DROP-SMART` 85/15) roll without knowing whether the item is usable, and the contextual score recomputes over the whole stash every time.

---

## 7. Open

- [ ] **O2** — hard or soft requirements (kill criteria in decisions.md · tied to `DROP-SMART`)
- [ ] **O6** — base type count · cut to 4 if over → the §1.2 cap of 16 can only be confirmed once O6 is decided
- [ ] **Identity: 3 or 18 — §1.3** · still choosing between (a)/(b)/(c)
- [ ] **Loot table per zone** — still unknown what the 10 zones in [spec-fantasy-content.md](spec-fantasy-content.md) drop
- [ ] Amulet into the 5-slot MVP, or deferred
- [ ] **Passive tree** — waits on O1 (`TREE-DIM`)