# Formulas — Defense

import core-stats.md
import mod-pool.md
import equipment-slot.md
import elements.md

Symbols: `x` = value from build · `x_c` = value from Core stat · `x_f` = value from Mod Flat · `x_p` = value from Mod %

# 4. Evasion

```
evasion_rating = (dex * K_EVASION + evasion_flat) * (1 + evasion_pct/100)
agi_points     = agi * K_AGI_EVAS                       # 30 Agi = 1 percentage point
evasion_chance = (1 - mob_accuracy / (mob_accuracy + evasion_rating)) * 100 + agi_points
evasion_chance = min(evasion_chance, 80)
```

- Evasion is **one avoidance layer** (D-112): the two retired avoidance Mod lines are now the `Evasion flat` / `Evasion %` pair, and Dex plus Agi are capped together rather than racing each other for a second Cap. The Mod ranges live in mod-pool.md's generated table.
- `K_EVASION` = 0.5 · `K_AGI_EVAS` = 1/30 · Cap is **80% evasion chance**, opposed by that mob's accuracy rather than a flat divisor — the same shape the mob side dodges with. **X20** proves it: reachable against the inaccurate lineages, out of reach against the accurate ones. `K_dodge` (the old flat 100) is deleted — it could not express that.
- Reason for the opposed form: under a flat model two avoidance items reach the rate Cap with no stat investment, so avoidance is an on/off switch instead of a stat that grows gradually. Under the opposed roll every Dex point buys chance and Agi adds the points on top, so how much lands depends on what is attacking.

<!-- BEGIN GENERATED:evasion-table -->
| build | Dex + Agi | Evasion flat | Dex rating | Agi points | Evasion |
|---|---|---|---|---|---|
| Full Dex + Agi 12 items + boots/gloves T1 | 535 | 15 + 15 | 298 | +17.8 | **67.7%** |
| Dex + Agi 6 items + 1 T1 item | 360 | 15 + 15 | 210 | +12 | **53.3%** |
| No investment + 1 low-Quality item | 210 | 6 | 111 | +7 | **34.1%** |

Evasion is one line (D-112): the Dex rating is rolled against the reference attacker (mean species · Medium body · accuracy tier ×1 · level 100 accuracy 299) as `1 − acc ÷ (acc + rating)`, then Agi adds **30 Agi per point** and the Cap 80 binds the sum — so this is a snapshot against an average mob, not a fixed Cap point.
<!-- END GENERATED:evasion-table -->

- Evasion uses a ratio, not direct addition, because excessive avoidance would make attacks never land and break the meta.
- Against a given attacker, more Dex and more Agi both buy avoidance until the Cap; past it Agi only helps attack speed and Dex only helps accuracy and Alignment.
- Evasion exists to receive mob groups · read the chance off the generated table above for the mob actually being fought (see world.md)

```
perfect_dodge_rate = lck * K_LCK_PDOGE
perfect_dodge      = perfect_dodge_rate / (perfect_dodge_rate + K_PDOGE)
perfect_dodge      = min(perfect_dodge, caps.perfect_dodge)
```

- Perfect dodge is separate from Evasion because it removes the hit outright instead of contesting it.
- `K_LCK_PDOGE` = **0.03** · `K_PDOGE` = **57** · the Cap is `engine.json` `caps.perfect_dodge`, printed with its reachability in the generated Cap table in formula.md. It sits just under the top the maxed Lck ratio reaches, so the Cap binds rather than standing behind a Lck build nobody can assemble (D-114 re-based it with the other four).
- A Cap on the Lck ratio keeps a pure-Lck build from becoming a permanent second health bar. The ratio is what *how much Lck you wore* decides; the Cap is the point where the game stops paying for the last of it.
- **Perfect dodge is not opposed** — when it triggers the hit is removed outright (D-009 3c) — so it is the answer to DoT ticks and to unconditional effects that Evasion cannot contest.

# 4b. Block

```
block_chance = min(caps.block, the shield's Block chance % line)   rolled last of the avoidance layers
```

- **Block is its own avoidance layer**: it overrules the one-avoidance-layer rule for the block path only — Evasion keeps its own Cap — and block is a separate roll that happens after perfect dodge and evasion. A blocked hit is deleted outright, before the physical/Element split, exactly like a dodge.
- The only source is the **shield's Base Mod line** (Buckler · Kite Shield): `block_chance` is the first line on those frames and never rolls on any other slot. `caps.block` in `engine.json` is a ceiling rather than a wall — the shield's own line at its top Tier and quality just reaches it, which the block gate proves (the same reachability rule every Cap carries).
- **Why a flat percentage, not a rating**: block is a shield's discrete "this one did not land", not a stat that grows with investment the way Evasion does. It is bought by wearing a shield and by the stone ladder on that one line, so it cannot be stacked from many slots the way Armour or Evasion can.
- **It is folded into `mob_HP` as debt, not as a silent buff**: a blocked hit is damage that never landed, so the survival tables price it as new defensive power and the checks file's debt line names it.

# 5. HP / Mana / Energy Shield

```
max_hp   = (hp_base + vit * K_VIT_HP + level_gain_hp) * (1 + hp_pct/100)
hp_regen = vit * K_VIT_REGEN * (1 + hp_regen_pct/100)

max_mana   = (mana_base + int * K_INT_MP + level_gain_mp) * (1 + mp_pct/100)
mana_regen = int * K_INT_MREGEN * (1 + mregen_pct/100)
```

- `K_VIT_HP` = 20 · `K_VIT_REGEN` = 0.25 · `hp_base` = 300 → Vit 510 gives 10,200 raw HP (14,460 once the per-level term and base are added) and 128/sec regen.
- `K_INT_MP` = 4 · `K_INT_MREGEN` = **0.18** (was 0.2) · `mana_base` = 100 → Int 510 gives 2,040 raw mana (3,724 once the per-level term and base are added) and 92/sec regen.
- `level_gain_hp` = 40 × (level − 1) → at level 100 gives 3,960 (the old text wrote 4,000, which overcounted by one level).
- `level_gain_mp` = 16 × (level − 1) → at level 100 gives 1,584.

<!-- BEGIN GENERATED:hp-mana-block -->
```
Max HP   level 100 · full Vit 12 items + 1 Max HP % slot = (10,700 + 3,960) × 1.16 = 17,354
Max Mana level 100 · full Int                            = (2,140 + 1,584)          = 3,824
pool ÷ regen                                              = 3,824 ÷ 96 = 39.7 seconds
```
<!-- END GENERATED:hp-mana-block -->

> **`K_INT_MREGEN` was 0.2 → 0.15 → 0.18** — the stated intent was "about 40 seconds per full mana pool."
> At 0.2 the actual ratio was 29.7 seconds · mana was therefore almost 40% larger than intended and made skills nearly free to spam.
> At 0.18 it is 40.6 seconds, matching intent · enough to keep pressing skills while still reserving a slice for auras.
> Players must choose how much of the pool to reserve as aura and how much to leave usable for skills (see skill-pool-aura-heal.md · reservation tiers at pool 3,724).

```
max_es   = int * K_INT_ES          (+ Gear Energy Shield flat · 12-60)
es_regen = int * K_INT_ESREGEN     starts after es_delay without a hit
es_delay = 3 sec
```

- `K_INT_ES` = 4 · `K_INT_ESREGEN` = 0.10 · Int 510 gives a **2,040** shield recharging at **51/sec**, so the whole pool is back in **40.0 sec** of not being hit — the same full-pool span the mana line was tuned to (B5) and about 2.4x faster than a Vit build recovers its HP.
- **The shield is 40.0% of the same Int build's 8,160 HP**, which is the ratio **X25** holds between 30% and 45%: enough that a caster trades raw HP for a rechargeable buffer, not enough to make it two health bars.
- **Order matters** — armour (combat.md step 5) and Elemental res (step 6) shrink the number that then drains ES, and only the remainder reaches HP (D-010). Chaos skips the shield entirely and hits HP.
- **Delay is the whole cost of the layer**: 3 sec without a hit is still long compared to a 1-sec trash clock, so ES refills *between* groups, not during a boss. That is what keeps the boss gate a pool-times-time question (combat.md section 7) instead of a heal loop.
- **Player-only.** Mobs have an Int line but no shield, because their survivability is already anchored on `mob_HP` — a second pool would count the same anchor twice (checks.md H1).


# 6. Cooldown reduction
```
cdr = (wis * K_WIS_CDR) * (1 + cdr_pct_total/100)
cdr = min(cdr, 80)

cooldown = base_cooldown * (1 - ladder/100) * (1 - cdr/100)
```

- `K_WIS_CDR` = 0.03 · Wis 510 gives 15.3%.
- Cap **80** is a **hard ceiling** (D-124): Wis 535 + 11 Mod items reaches `16.1 × 3.75 = **60.2**`, which sits *under* the Cap, so the Cap never binds and no build is cut (X11). The old Cap 55 was a build target set on the same K; at the 535 ceiling the owner raised the ceiling to 80 rather than the K, so 80 is now a line the build stays below (D-114 · formula.md section 0a).
- **There is no `cdr_flat`** — CDR is % only (see mod-pool.md). The old formula added a slot that does not exist.
- `cdr_pct_total` pools every source into one line — today that means only the Mod `Cooldown reduction %` (max 25 per item). A future buff may add to the same pool, but no Cap is allowed to *depend* on one: the Cap must be reachable from items alone.
- Path to the ceiling must be checkable without a buff: Wis 535 + 11 Mod items (every slot but the main hand) = `16.1 × 3.75 = **60.2**` → under Cap 80 (D-124) · 10 items = 56.2 · 9 items = 52.2 · Wis alone = 16.1.
  This keeps the original intent that CDR requires multi-item investment and that Wis alone is never enough — and the full set is the build's maximum, which the ceiling now sits above rather than at.
- **Wis is deliberately the only stat with a single benefit.** Every other stat gives power plus one utility (Str power + weight, Agi speed + Evasion points, Vit HP + regen, Int power + mana, Dex accuracy + evasion + alignment, Lck crit + perfect dodge + drop), but cooldown reduction is a **pacing** stat, not a power stat: it changes how often the list can be pressed, never what a press is worth. A second benefit would have to be a new stat — effect duration, or a mana reserve — and both are larger systems than the gap they would fill, so the sheet keeps Wis single on purpose (D-016).

# 9. Alignment and Elemental resistance

```
elem_align   = dex * K_DEX_ALIGN + elem_align_flat
elem_align   = min(elem_align, 50)

res_c        = vit * K_VIT_RES
elem_res_x   = res_c * (1 + elem_res_pct_x/100)
elem_res_x   = min(elem_res_x, 75)

status_align = dex * K_DEX_ALIGN     same value as elem_align
```

- `K_DEX_ALIGN` = 0.05 · Dex 510 gives 25.5% + the two Alignment slots on defensive items (amulet and gloves, +5 each) = 35.5% → Cap **50**, a **hard ceiling** the build stays under (X11 · D-124).
- `K_VIT_RES` = 0.05 · Vit 510 gives 25.5% before Mod multiplication.
- Merged away the old `status_res` once given by Str. No stat gives status res besides this.
- **Cap 75 is a hard ceiling** (D-124): Vit 510 + 3 res items tops out at `25.5 × (1 + 30+30+30)% = 48.5`, under the ceiling, so no build is cut. The old Cap 45 was the build target on the same figures; the owner raised the ceiling to 75 to match the intent that resistance is a per-item purchase with real effect, so the purchase is never clipped (D-114).
  Resistance remains a per-item purchase with real effect, not free from Vit alone.
- **Cap 50 is a hard ceiling** the two Alignment slots stay under. Dex 510 gives 25.5%, and the only two Alignment slots (amulet and gloves, +5 +5) take it to **35.5%**, so the ceiling is set above a full Alignment build rather than at it. The old Cap 35 was the build target the slots just reached; the owner raised it to 50 (D-124), and no expansion of the Alignment slot to the cape was needed because the ceiling no longer has to be a slot-pool number.
