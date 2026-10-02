# Formulas — Defense

import core-stats.md
import mod-pool.md
import equipment-slot.md
import elements.md

Symbols: `x` = value from build · `x_c` = value from Core stat · `x_f` = value from Mod Flat · `x_p` = value from Mod %

# 4. Dodge

```
dodge_rate   = (agi * K_AGI_DODGE + dodge_flat) * (1 + dodge_pct/100)
dodge_chance = dodge_rate / (dodge_rate + K_dodge)
dodge_chance = min(dodge_chance, 90)
```

- `K_AGI_DODGE` = 0.15 · `K_dodge` = **100** (was 25) · Cap is **90% dodge chance** (P1-1 option A2, opposed by mob accuracy) · Reachable path pending mob sheet rebalance; old 60% table below is stale.
- Reason for the change: in the old model two dodge Flat items (40+40 = 80) hit rate Cap 75 with zero Agi · dodge was therefore an on/off switch, not a stat that grows gradually.
  Stretching the divisor to 100 and capping chance makes each Agi point actually buy dodge chance.
- The dodge Flat range is therefore reduced from 8-40 to **3-15** (already fixed in mod-pool.md).

| build | Agi | dodge Flat | rate | dodge chance |
|---|---|---|---|---|
| Full Agi 12 items + boots/gloves T1 | 816 | 15 + 15 | 152 | **60% (hits Cap)** |
| Agi 6 items + 1 T1 item | 468 | 15 | 85 | 46% |
| No Agi + 1 low-Quality item | 210 | 10 | 42 | 29% |

- Dodge structure uses a ratio, not direct addition, because excessive dodge would make attacks never land and break the meta.
- Agi beyond the Cap point buys no more dodge; it helps attack speed instead.
- Dodge exists to receive mob groups · a 5-mob group at 46% dodge = about 2.7 hits per round (see world.md)

```
perfect_dodge = lck * K_LCK_PDOGE
perfect_dodge = min(perfect_dodge, 5)
```

- Perfect dodge is separate from normal dodge and capped very low because it traps mobs.
- `K_LCK_PDOGE` = **0.01** (was 0.005) · at the old value Lck ceiling 816 reached only 4.1%, which could not hit Cap 5 without Mod help, and no perfect dodge Mod exists.
  At 0.01 the Cap is hit at Lck 500 · it requires real Lck investment, not a free bonus from other builds.
- **Cap 5 stays.** Perfect dodge is not opposed — when it triggers the hit is removed outright (D-009 3c) — but because the chance caps at Lck 500, an aura bonus to perfect dodge would be clipped for exactly the builds that want it. That is why `Grace` carries Dodge flat instead.

# 5. HP / Mana

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

```
Max HP   level 100 · full Vit 12 items + 1 Max HP % slot = (16,320 + 3,960) × 1.16 = 23,500
Max Mana level 100 · full Int                            = (3,264 + 1,584)          = 4,848
pool ÷ regen                                              = 4,848 ÷ 122 = 39.6 seconds
```

> **`K_INT_MREGEN` was 0.2 → 0.15** — the stated intent was "about 40 seconds per full mana pool."
> At 0.2 the actual ratio was 29.7 seconds · mana was therefore almost 40% larger than intended and made skills nearly free to spam.
> At 0.15 it is 39.6 seconds, matching intent · enough to keep pressing skills while still reserving a slice for auras.
> Players must choose how much of the pool to reserve as aura and how much to leave usable for skills (see skill-pool-aura-heal.md · reservation tiers at pool 4,848).

# 6. Cooldown reduction

```
cdr = (wis * K_WIS_CDR) * (1 + cdr_pct_total/100)
cdr = min(cdr, 50)

cooldown = base_cooldown * (1 - ladder/100) * (1 - cdr/100)
```

- `K_WIS_CDR` = 0.03 · Wis 816 gives 24.5%.
- Cap 50 because beyond this skill slots cycle too fast to play.
- **There is no `cdr_flat`** — CDR is % only (see mod-pool.md). The old formula added a slot that does not exist.
- `cdr_pct_total` pools all sources into one pool, both the Mod `Cooldown reduction %` (max 25 per item) and buffs from skills such as Battle Orders +15%.
- Path to Cap must be checkable: Wis 816 + 3 Mod items + Battle Orders = `24.5 × 1.90 = 46.6` **still not capped** · 4 items required = `24.5 × 2.15 = 52.6` to hit Cap.
  This confirms the original intent that CDR requires multi-item investment; Wis alone is never enough.

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
- **Old Alignment Cap 60 could not be hit** · the maximum allowed under current rules is Dex 816 (40.8%) + Alignment slots from amulet and gloves only (+5 +5) = **50.8%**.
  So the Cap is lowered to **50** as a ceiling an extreme Elemental build can actually touch (buffs like Focus +20% can still Push past briefly before being cut back).
  To make Cap 60 real, the Alignment slot would need expansion to cape — lowering the Cap was chosen first because it does not touch slot pools.
