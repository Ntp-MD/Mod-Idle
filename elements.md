# Elements

import core-stats.md
import formula.md
import mod-pool.md
import equipment-slot.md

5 Elements — fire · cold · lightning · poison · chaos.
They serve as the third damage path beside physical and magic.

# 1. The 5 Elements

| Element | Core mechanic | Status left |
|---|---|---|
| Fire | burn per second | burn |
| Cold | slow target attack speed | chill |
| Lightning | short interrupt | shock |
| Poison | stacking layers, never expires alone | poison |
| Chaos | long hits that grow stronger | mark |

- One item can roll only one of 5 Elements. Two Elements on one item are forbidden.
- Element is only a damage tag; power numbers are still calculated as their own path.
- All Elements use the same power formula set; they differ in multiplier, status, and counter pair.

# 2. Elemental power

```
elem       = (int * K_ELEM + elem_flat) * (1 + elem_pct/100) * weapon_mult
elem_align = dex * K_DEX_ALIGN + elem_align_flat
elem_align = min(elem_align, 50)

dmg_per_hit = phys + magic + elem
dps         = dmg_per_hit * (aspd / 100)
status_gate = roll vs elem_align applies only to status application, never to elem damage
```

- Uses **Int** as the main driver because Elemental belongs to the magic family — no new stat needed.
- `K_ELEM` = 4, slightly lower than `K_INT` = 5, because Element builds must still invest Dex for status output.
- Uses Dex to confirm statuses, the same value as status Alignment. No separate new stat.
- Element damage lands in full on every hit; Alignment only gates burn/chill/shock/poison/mark application.
- **Element damage does not crit** — crit belongs to physical and magic only, so the timing control role of lightning is not swallowed.

## Real Numbers of an Element Build (Measured From Current Mod Tables)

Build with Int 6 items / Dex 3 items / 2 Alignment slots at level 100:

| Value | Result |
|---|---|
| Magic power | 2,807 |
| Raw Elemental power | 2,207 |
| Elemental Alignment | 26.4% (gates status only) |
| **Full Element damage** | **2,207** = 79% added over magic power |
| burn 3 stacks (K_FIRE_BURN 0.30) | 524 per second |
| poison 10 stacks (K_POISON 0.08) | 466 per second |

- **Decided (P0-1 option A): Element damage lands in full; Alignment gates only status application.** The Int6/Dex3 example rises from ~6,180 to ~8,000 total per-hit output before DoT.
- Rebalance pending: `mob_HP` must fold ~10-15% uplift (checks.md D1/D17), and Stream gating nodes (Tuned Rod / Two Tongues) shift to status-output duty. Tables below keep old DoT K values until the rebalance pass.

# 3. Element Counter Pairs

| Attack ↓ / Target → | Fire | Cold | Lightning | Poison | Chaos |
|---|---|---|---|---|---|
| Fire | 1.00 | 0.60 | 1.10 | 1.20 | 1.00 |
| Cold | 0.60 | 1.00 | 1.10 | 1.00 | 1.00 |
| Lightning | 1.10 | 1.10 | 1.00 | 0.60 | 1.00 |
| Poison | 1.20 | 1.00 | 0.60 | 1.00 | 1.00 |
| Chaos | 1.15 | 1.15 | 1.15 | 1.15 | 1.15 |

- **Chaos** gets 1.15 against all Elements including itself. It is the only Element with no counter.
- **Fire ↔ Cold** and **Lightning ↔ Poison** are counter pairs at 0.60.
- Status icons show the Element of the damage instance. No full name needed.

**Monsters** — each has 1 innate Element.

```
weak_mult = 1.5   if our Element matches the monster innate Element
```

# 4. Elemental resistance

```
res_c       = vit * K_VIT_RES                     K_VIT_RES = 0.05
elem_res_x  = res_c * (1 + elem_res_pct_x/100)
elem_res_x  = min(elem_res_x, 75)

incoming = base * (1 - elem_res_x/100) * Element counter
```

- Uses **Vit** to give raw res for all 5 Elements.
- **Res has no Flat** — the only slotable Mod is `Elemental resistance %` acting as a multiplier.
- **Auras feed the same pool.** `Trinity Form` grants an Elemental resistance % that joins `elem_res_pct_x` exactly like a gear roll — no separate aura stat and no flat (D-009 3b). `Elemental Fury` applies the same form on the target side as a reduction.
- Merged away the old `status_res` (once given by Str), leaving Elemental res only.
- Res is split per Element, not one value. The character sheet must show all 5 values.
- **Vit 816 (true ceiling) gives 40.8% raw**, not 44.5% as previously written · the old number was calculated from stat 890, which no build can actually reach.
  To hit Cap 75 requires `40.8 × (1 + 30+30+30)% = 77.5 → cut to 75`, i.e. 3 res slots · two slots give 65.3% · Cap 75 is therefore still reachable and still fair.

# 5. Status Per Element

**Every status in this section lives two ways** — we apply it to targets, and mobs apply it to us · values when on the player (20% proc chance per hit · chill/shock halved) are in combat.md section 5.

## Fire — burn

```
burn_dps  = elem_aligned_damage * K_FIRE_BURN     K_FIRE_BURN = 0.30
burn_time = 4 sec
burn_stack_max = 3
```

- Ticks per second. Does not crit and cannot be dodged.
- Re-hitting with the same Element weapon resets duration; it does not extend the old duration.
- Max 3 stacks. Excess stacks reset the oldest stack instead of dropping.
- Value 0.30 makes full 3 stacks equal 0.90 of Element damage per second.

## Cold — chill

```
aspd_mult = 1 - chill_pct/100      chill_pct Cap 20
acc_mult  = 1 - chill_acc/100      chill_acc Cap 30
chill_time = 3 sec
```

- Reduces attack speed = fewer hits, not lower damage. The target must be prevented from barely attacking.
- The Cap 20 governs **chill alone** — it exists so chill by itself cannot suppress a target's damage. Aura `Rimbo Form` pays reservation to stack on top of it, so a chilled target under that aura can reach **−35%** total aspd (D-009 3a).
- Also reduces accuracy one more layer, because accuracy-focused players gain a special temporary edge.

## Lightning — shock

```
stun_chance = elem_align * K_LIGHTNING_STUN     K_LIGHTNING_STUN = 0.30   Cap 15
stun_time   = 1 sec
```

- Stun queues the target attack sequence. During stun it stops attacking and stops regen.
- Rolls once per attack, not per damage instance.
- **Old K 0.15 made Cap 15 unreachable** — ceiling Alignment is 50 → max stun only 7.5% · K is set to 0.30 so 15% stun only happens when Alignment hits Cap (Dex 816 + amulet + gloves).
- Values a real Element build sees: Dex 328 + amulet + gloves → Alignment 26.4% → 7.9% stun per attack.
- This is the time-control Element, not sustained damage, so it suits idle that fires continuously.

## Poison — poison stack

```
poison_dps_per_stack = elem_aligned_damage * K_POISON    K_POISON = 0.08
poison_stack_max = 10
poison_decay = lose 1 stack every 8 sec
```

- Does not vanish immediately when firing stops, in exchange for lower damage per piece than fire.
- DoT cannot be dodged and does not crit, preventing targets from falsely missing and losing out.
- Stacks persist across weapon swaps because they live on the target, not on the item.
- Value 0.08 makes full 10 stacks equal 0.80 of Element damage per second, slightly below burn.

## Chaos — mark

```
chaos_stack_max = 25
dmg_mult = 1 + chaos_stack * K_CHAOS_DMG          K_CHAOS_DMG   = 0.01
leech    = chaos_stack * K_CHAOS_LEECH            K_CHAOS_LEECH = 0.002
mark_decay = lose 1 stack per second after 5 sec without firing
```

- Sustained fire on one target gives max damage, in exchange for resetting on target switch.
- Value 0.01 makes full 25 stacks +25% damage, not large enough to swallow crit.
- Leech is % of just-dealt damage. Value 0.002 gives 5% at full 25 stacks but must not exceed the per-second Max HP limit.
- In idle firing continuously at the same target, mark reaches full 25 stacks by itself.

# 6. Global DoT Cap

```
dot_total = burn + poison
dot_total = min(dot_total, elem_aligned_damage * 1.5)
```

- All DoT combined must not exceed **1.5x** of confirmed Element damage per second.
- Without this Cap, two-Element DoT would stack to 1.7x, exceeding direct hits during burn windows.
- This Cap is the single point where all Element DoT meet; other differences fade one by one.

# 7. Element Mod

| Mod | Group | Value range |
|---|---|---|
| Elemental power Flat | Offensive — main hand (half weight in dual wield) | 12-64 |
| Elemental power % | Offensive — main hand | 3-14% |
| Elemental resistance % | Defensive — other items | 15-30% |
| Elemental Alignment % | Defensive — other items | 1-5% |

- Split by the Offensive/Defensive rule in equipment-slot.md — main hand rolls Element power, other items roll resistance.
- **Elemental resistance % is always Defensive, for all Elements**, never Offensive even when matching the weapon Element.
- Res has no Flat, only %; power has both Flat and %.
- **Defensive items roll their own Element, not tied to the weapon** — because if tied to the weapon, players must pick a weapon first then hunt matching defensive items, making most items unusable.
- **Dual-wield off hand is a second weapon**, so it is the exception to the rule. It gets Elemental power but Primary weight is halved.
- Elemental power ranges are slightly lower than phys/magic (12-64 instead of 15-80) because they must pass another Alignment layer.
- Per-Element Tier tables are in mod-pool.md.

# 8. Display

- Character sheet shows Elemental power and Elemental res for all 5 Elements.
- Statuses lingering on targets show as Element icon + remaining time. No full name needed.
- Capped values display as `value / Cap` like other stats in character-sheet.md.
- Element counter multipliers are hidden from players. No display needed; only the changed numbers show when hitting an Element.
- The total DoT bar shows when hitting the global DoT Cap, so over-Element hits are visible.

# Summary of Element System K Values

| K | Value | Note |
|---|---|---|
| K_ELEM | 4 | elem / Int · lower than K_INT because it must pass Alignment |
| K_VIT_RES | 0.05 | elem res / Vit · no Flat |
| K_FIRE_BURN | 0.30 | burn per stack |
| K_POISON | 0.08 | poison per stack |
| K_CHAOS_DMG | 0.01 | +dmg per mark stack |
| K_CHAOS_LEECH | 0.002 | lifesteal per mark stack |
| K_LIGHTNING_STUN | 0.15 | stun chance per Alignment |
| global DoT Cap | 1.5 | burn + poison combined |
