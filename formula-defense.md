# Formulas — Defense

import core-stats.md
import mod-pool.md
import equipment-slot.md
import elements.md

Symbols: `x` = value from build · `x_c` = value from Core stat · `x_f` = value from Mod Flat · `x_p` = value from Mod %

# 4. Dodge

```
dodge_rate   = (agi * K_AGI_DODGE + dodge_flat) * (1 + dodge_pct/100)
dodge_chance = dodge_rate / (dodge_rate + mob_accuracy)   # the SAME opposed shape the mob side dodges with (X20)
dodge_chance = min(dodge_chance, 80)
```

- `K_AGI_DODGE` = 0.15 · Cap is **80% dodge chance**, opposed by that mob's accuracy rather than a flat divisor — the same shape the mob dodges with. **X20** proves it: reachable against the inaccurate lineages, out of reach against the accurate ones. `K_dodge` (the old flat 100) is deleted — it could not express that.
- Reason for the change: in the old model two dodge Flat items (40+40 = 80) hit the rate Cap with zero Agi · dodge was an on/off switch, not a stat that grows gradually. Under the opposed form every Agi point buys chance, and how much depends on what is attacking.
- The dodge Flat range is therefore reduced from 8-40 to **3-15** (already fixed in mod-pool.md).

<!-- BEGIN GENERATED:dodge-table -->
| build | Dex + Agi | Evasion flat | Dex rating | Agi points | Evasion |
|---|---|---|---|---|---|
| Full Dex + Agi 12 items + boots/gloves T1 | 816 | 15 + 15 | 438 | +27.2 | **80%** |
| Dex + Agi 6 items + 1 T1 item | 468 | 15 + 15 | 264 | +15.6 | **62.5%** |
| No investment + 1 low-Quality item | 210 | 6 | 111 | +7 | **34.1%** |

Evasion is one line (D-112): the Dex rating is rolled against the reference attacker (mean species · Medium body · accuracy tier ×1 · level 100 accuracy 299) as `1 − acc ÷ (acc + rating)`, then Agi adds **30 Agi per point** and the Cap 80 binds the sum — so this is a snapshot against an average mob, not a fixed Cap point.
<!-- END GENERATED:dodge-table -->

- Dodge structure uses a ratio, not direct addition, because excessive dodge would make attacks never land and break the meta.
- Against a given attacker, more Agi always buys more dodge chance until the 80 Cap; past that it only helps attack speed.
- Dodge exists to receive mob groups · read the chance off the generated table above for the mob actually being fought (see world.md)

```
perfect_dodge_rate = lck * K_LCK_PDOGE
perfect_dodge      = perfect_dodge_rate / (perfect_dodge_rate + K_PDOGE)
perfect_dodge      = min(perfect_dodge, 25)
```

- Perfect dodge is separate from normal dodge because it removes the hit outright instead of contesting it.
- `K_LCK_PDOGE` = **0.03** · `K_PDOGE` = **57** · **Cap 25.** The Lck ratio alone would top out at 30% (rate 24.5 at the 816 ceiling), so the Cap binds first — it arrives at Lck 633, under the ceiling, which makes it a real power limit rather than a fake number.
- A Cap on the Lck ratio keeps a pure-Lck build from becoming a permanent second health bar. The ratio is what *how much Lck you wore* decides; the Cap is the point where the game stops paying for the last of it.
- **Perfect dodge is not opposed** — when it triggers the hit is removed outright (D-009 3c) — so it is the answer to DoT ticks and to unconditional effects that dodge cannot contest.

# 5. HP / Mana / Energy Shield

```
max_hp   = (vit * K_VIT_HP + level_gain_hp) * (1 + hp_pct/100)
hp_regen = vit * K_VIT_REGEN * (1 + hp_regen_pct/100)

max_mana   = (int * K_INT_MP + level_gain_mp) * (1 + mp_pct/100)
mana_regen = int * K_INT_MREGEN * (1 + mregen_pct/100)
```

- `K_VIT_HP` = 20 · `K_VIT_REGEN` = 0.25 → Vit 816 gives 16,320 raw HP and 204/sec regen.
- `K_INT_MP` = 4 · `K_INT_MREGEN` = **0.15** (was 0.2) → Int 816 gives 3,264 raw mana and 122/sec regen.
- `level_gain_hp` = 40 × (level − 1) → at level 100 gives 3,960 (the old text wrote 4,000, which overcounted by one level).
- `level_gain_mp` = 16 × (level − 1) → at level 100 gives 1,584.

<!-- BEGIN GENERATED:hp-mana-block -->
```
Max HP   level 100 · full Vit 12 items + 1 Max HP % slot = (10,200 + 3,960) × 1.16 = 16,426
Max Mana level 100 · full Int                            = (2,040 + 1,584)          = 3,624
pool ÷ regen                                              = 3,624 ÷ 77 = 47.4 seconds
```
<!-- END GENERATED:hp-mana-block -->

> **`K_INT_MREGEN` was 0.2 → 0.15** — the stated intent was "about 40 seconds per full mana pool."
> At 0.2 the actual ratio was 29.7 seconds · mana was therefore almost 40% larger than intended and made skills nearly free to spam.
> At 0.15 it is 39.6 seconds, matching intent · enough to keep pressing skills while still reserving a slice for auras.
> Players must choose how much of the pool to reserve as aura and how much to leave usable for skills (see skill-pool-aura-heal.md · reservation tiers at pool 4,848).

```
max_es   = int * K_INT_ES          (+ Gear Energy Shield flat · 12-60)
es_regen = int * K_INT_ESREGEN     starts after es_delay without a hit
es_delay = 5 sec
```

- `K_INT_ES` = 4 · `K_INT_ESREGEN` = 0.10 · Int 816 gives a **3,264** shield recharging at **81.6/sec**, so the whole pool is back in **40.0 sec** of not being hit — the same full-pool span the mana line was tuned to (B5) and about 2.4x faster than a Vit build recovers its HP.
- **The shield is 40.0% of the same Int build's 8,160 HP**, which is the ratio **X25** holds between 30% and 45%: enough that a caster trades raw HP for a rechargeable buffer, not enough to make it two health bars.
- **Order matters** — armour (combat.md step 5) and Elemental res (step 6) shrink the number that then drains ES, and only the remainder reaches HP (D-010). Chaos skips the shield entirely and hits HP.
- **Delay is the whole cost of the layer**: 5 sec without a hit is long compared to a 1-sec trash clock, so ES refills *between* groups, not during a boss. That is what keeps the boss gate a pool-times-time question (combat.md section 7) instead of a heal loop.
- **Player-only.** Mobs have an Int line but no shield, because their survivability is already anchored on `mob_HP` — a second pool would count the same anchor twice (checks.md H1).


# 6. Cooldown reduction
```
cdr = (wis * K_WIS_CDR) * (1 + cdr_pct_total/100)
cdr = min(cdr, 80)

cooldown = base_cooldown * (1 - ladder/100) * (1 - cdr/100)
```

- `K_WIS_CDR` = 0.03 · Wis 816 gives 24.5%.
- Cap **80** because a full CDR set is what reaches it: Wis 816 + 11 Mod items = 91.8 before the cut, while 9 items stop short at 79.6 (D-041). It was lowered from the old 50, which only a buff that no longer exists could reach (D-029).
- **There is no `cdr_flat`** — CDR is % only (see mod-pool.md). The old formula added a slot that does not exist.
- `cdr_pct_total` pools every source into one line — today that means only the Mod `Cooldown reduction %` (max 25 per item). A future buff may add to the same pool, but no Cap is allowed to *depend* on one: the Cap must be reachable from items alone.
- Path to Cap must be checkable without a buff: Wis 816 + 11 Mod items (every slot but the main hand) = `24.5 × 3.75 = 91.8` → cut to **80** ✓ · 9 items = 79.6 (short) · 10 items = 85.7 ✓ · Wis alone = 24.5.
  This confirms the original intent that CDR requires multi-item investment; Wis alone is never enough.
- **Wis is deliberately the only stat with a single benefit.** Every other stat gives power plus one utility (Str power + weight, Agi speed + dodge, Vit HP + regen, Int power + mana, Dex accuracy + evasion + alignment, Lck crit + perfect dodge + drop), but cooldown reduction is a **pacing** stat, not a power stat: it changes how often the list can be pressed, never what a press is worth. A second benefit would have to be a new stat — effect duration, or a mana reserve — and both are larger systems than the gap they would fill, so the sheet keeps Wis single on purpose (D-016).

# 9. Alignment and Elemental resistance

```
elem_align   = dex * K_DEX_ALIGN + elem_align_flat
elem_align   = min(elem_align, 50)

res_c        = vit * K_VIT_RES
elem_res_x   = res_c * (1 + elem_res_pct_x/100)
elem_res_x   = min(elem_res_x, 75)

status_align = dex * K_DEX_ALIGN     same value as elem_align
```

- `K_DEX_ALIGN` = 0.05 · Dex 816 gives 40.8% + Alignment slot on defensive items (max 5% per item) = 45.8% with 1 item · Cap 50.
- `K_VIT_RES` = 0.05 · Vit 816 gives 40.8% before Mod multiplication.
- Merged away the old `status_res` once given by Str. No stat gives status res besides this.
- **Cap 75 is reachable but requires 3 items.** `40.8 × (1 + 30+30+30)% = 77.5 → cut to 75` · 2 items give 65.3% · no Mod gives 40.8%.
  Resistance remains a per-item purchase with real effect, not free from Vit alone.
- **Old Alignment Cap 60 could not be hit** · the stat ceiling above plus the only two Alignment slots (amulet and gloves, +5 +5) reach **50.8%**.
  So the Cap is lowered to **50** as a ceiling an extreme Elemental build can actually touch (buffs like Focus +20% can still Push past briefly before being cut back).
  To make Cap 60 real, the Alignment slot would need expansion to cape — lowering the Cap was chosen first because it does not touch slot pools.
