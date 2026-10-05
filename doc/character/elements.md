# Elements

import core-stats.md
import formula.md
import mod-pool.md
import equipment-slot.md

5 Elements — fire · cold · lightning · poison · chaos.
They serve as the third damage path beside physical and magic.

**Bleeding is not on this list.** It is a physical damage-over-time status copied from Path of Exile, with no Element tag, no Elemental resistance and no row in the counter-pair table — its rules live in `formula-offense.md` section 4.

# 1. The 5 Elements

<!-- BEGIN GENERATED:element-list -->
| Element | Core mechanic | Status left |
|---|---|---|
| fire | burn per second | burn |
| cold | slow target attack speed | chill |
| lightning | short interrupt | shock |
| poison | stacking layers, never expires alone | poison |
| chaos | long hits that grow stronger | mark |
<!-- END GENERATED:element-list -->

- One item can roll only one of 5 Elements. Two Elements on one item are forbidden.
- Element is only a damage tag; power numbers are still calculated as their own path.
- All Elements use the same power formula set; they differ in multiplier, status, and counter pair.

# 2. Elemental power

```
elem       = (int * K_ELEM + elem_flat) * (1 + elem_pct/100) * weapon_mult
elem_align = dex * K_DEX_ALIGN + elem_align_flat
elem_align = min(elem_align, 50)
elem_aligned_damage = elem * elem_align/100

dmg_per_hit = phys + magic + elem
dps         = dmg_per_hit * (aspd / 100)
status_gate = roll vs elem_align applies only to status application, never to elem damage
```

- Uses **Int** as the main driver because Elemental belongs to the magic family — no new stat needed.
- `K_ELEM` = 4, slightly lower than `K_INT` = 5, because Element builds must still invest Dex for status output.
- Uses Dex to confirm statuses, the same value as status Alignment. No separate new stat.
- **The direct hit lands in full and is never scaled by Alignment** (`dmg_per_hit` above uses raw `elem`) — that is the P0-1 decision.
- **The status it inflicts is scaled by Alignment.** `elem_aligned_damage` is what burn and poison are computed from, so Alignment pays twice: once as the gate that lets a status land at all, and once as the multiplier on that status's damage. Reason: a status that is only gated would not care how much Element damage the build has, which would make the Element stat itself stop mattering after the gate is passed.
- **Neither Element damage nor magic damage crits.** Crit belongs to physical hits alone (formula-offense.md section 3), so lightning's timing role is never swallowed by a crit that was going to happen anyway.

## Real Numbers of an Element Build (Measured From Current Mod Tables)

Build with Int 6 items / Dex 3 items / 2 Alignment slots at level 100:

| Value | Result |
|---|---|
| Magic power | 2,807 |
| Raw Elemental power | 2,207 |
| Elemental Alignment | 26.4% (gates status only) |
| **Full Element damage** | **2,207** = 79% added over magic power |
| burn 5 stacks (K_FIRE_BURN 0.30) | 875 per second |
| poison 10 stacks (K_POISON 0.08) | 466 per second |
| both together | 1,341 → **cut to 875** by the global DoT Cap (1.5× of 583 aligned damage) · five burn stacks alone already fill the whole budget |
| burn at 5 stacks | target HP regen **−50%** (10% per stack) |

- **Decided (P0-1 option A): the Element hit lands in full; Alignment scales the status it inflicts, and also gates whether that status lands.** The Int6/Dex3 example rises from ~6,180 to ~8,000 total per-hit output before DoT.
- Rebalance pending: `mob_HP` must fold ~10-15% uplift (checks.md D1/D17), and Stream gating nodes (Tuned Rod / Two Tongues) shift to status-output duty. Tables below keep old DoT K values until the rebalance pass.

# 3. Element Counter Pairs

<!-- BEGIN GENERATED:element-counter -->
| Attack ↓ / Target → | Fire | Cold | Lightning | Poison | Chaos |
|---|---|---|---|---|---|
| Fire | 1.00 | 0.60 | 1.10 | 1.20 | 1.00 |
| Cold | 0.60 | 1.00 | 1.10 | 1.00 | 1.00 |
| Lightning | 1.10 | 1.10 | 1.00 | 0.60 | 1.00 |
| Poison | 1.20 | 1.00 | 0.60 | 1.00 | 1.00 |
| Chaos | 1.15 | 1.15 | 1.15 | 1.15 | 1.15 |
<!-- END GENERATED:element-counter -->

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
- **Vit 510 (true ceiling) gives 25.5% raw**, not 44.5% as previously written · the old number was calculated from stat 890, which no build can actually reach.
  Cap 75 is now a **hard ceiling** (D-124): Vit 510 + 3 res slots tops out at `25.5 × (1 + 30+30+30)% = 48.5`, under the ceiling, so no build is clipped · two slots give 40.8% · the ceiling sits above what the slots reach rather than at it (D-114).

# 5. Status Per Element

**Every status in this section lives two ways** — we apply it to targets, and mobs apply it to us · values when on the player (20% proc chance per hit · chill/shock halved) are in combat.md section 5.

## Fire — burn

```
burn_dps  = elem_aligned_damage * K_FIRE_BURN     K_FIRE_BURN = 0.30
burn_time = 5 sec
burn_stack_max = 5

regen_mult = 1 - burn_stacks * K_BURN_REGEN_CUT   K_BURN_REGEN_CUT = 0.10
```

- Ticks per second. Does not crit and is not contested by Evasion — Perfect dodge still deletes a tick.
- Re-hitting with the same Element weapon resets duration; it does not extend the old duration.
- Max 5 stacks. Excess stacks reset the oldest stack instead of dropping.
- **Burn also cuts HP regen, by 10% of it per stack.** Five stacks is **−50% HP regen**, which is the whole effect: a build at 10 regen/sec is left at 5. There is no separate Cap because the stack count is the Cap.
- Reason this is the strongest Element debuff in the game: `hp_regen` is not a side stat. It is the tank's endurance (`combat.md` §4 sets Push downtime to `Max HP ÷ (hp_regen × 8)`) and field rule 2 makes tanks survive bosses *because* regen keeps working during the fight. Burn is the Element that reaches into that and turns it off.
- This is the sustained version of what shock already did for one second — shock stops regen outright for 1 sec, burn takes half of it away for 5.
- Value 0.30 makes full 5 stacks equal **1.50 of Element damage per second**, which is exactly the global DoT Cap. Five burn stacks therefore fill the whole DoT budget on their own and leave poison no room (§6).

## Cold — chill

```
aspd_mult = 1 - chill_pct/100      chill_pct Cap 20
acc_mult  = 1 - chill_acc/100      chill_acc Cap 30
chill_time = 3 sec
armour_mult = 1 - K_CHILL_ARMOUR_CUT              K_CHILL_ARMOUR_CUT = 0.25
```

- Reduces attack speed = fewer hits, not lower damage. The target must be prevented from barely attacking.
- The Cap 20 governs **chill alone** — it exists so chill by itself cannot suppress a target's damage. Aura `Rimbo Form` pays reservation to stack on top of it, so a chilled target under that aura can reach **−35%** total aspd (D-009 3a).
- Also reduces accuracy one more layer, because accuracy-focused players gain a special temporary edge.
- **Chill also cuts the target's Armour by 25%** (`armour_mult = 0.75`). Armour is what reduces the physical half of a hit (`combat.md` §2), so this is the Element answer to a tanky target.
  **It has a target now**: every mob carries Armour off its own Str line (`K_ARMOUR` 2 · the `armour` column of `mob-roster.md`), so chill cuts a real number on Golem · Knight · Troll · Orc and is worth almost nothing against a Rat. The rule is written now so it is correct the moment D1 gives mobs Armour — until then it is a line with no numbers behind it, and it must be re-verified in the same pass that introduces mob Armour.

## Lightning — shock

```
stun_chance = elem_align * K_LIGHTNING_STUN + the mace's Chance to stun % line   Cap 15
stun_time   = 1 sec
shock_aspd  = 20%                                Cap 20
shock_align_cut = 20%   applied to our own elem_align against this target
```

- Stun queues the target attack sequence. During stun it stops attacking and stops regen.
- Rolls once per attack, not per damage instance.
- **The stun Cap is `Alignment × K_STUN_PER_ALIGN` = 35 × 0.30 = 10.5%** (C10 prints 11) — at the old K 0.15 a ceiling Alignment of 50 reached only 7.5%, so the K was raised to 0.30 and the Cap now sits exactly where a full Alignment build lands (Dex 510 + amulet + gloves).
- **The mace adds a second source**: its Base Mod line carries `Chance to stun %`, forced with the frame, so a mace build reaches the `caps.stun` Cap that Alignment alone cannot. The two sources sum, and the Cap binds — the gear line is the only way past the Alignment ceiling.
- Values a real Element build sees: Dex 328 + amulet + gloves → Alignment 26.4% → 7.9% stun per attack.
- **Shock also cuts the target's attack speed by 20%** (its own Cap 20, separate from chill's). Shock does not stack, so this is a flat 20% while it is up.
- **Shock also cuts our own Alignment against that target by 20%** — the debuff is applied to the *target's* tolerance, not to our stat: `elem_align_used = elem_align × 0.80` for every further status we try to put on that target.
- **That is what turns shock from a debuff into a choice.** Shock is the only Element that fights our own Element: the more shock we land, the harder burn, chill, poison and mark are to apply to the same target. Time control and sustained status compete for the same target instead of stacking.
- Worst case to watch at balance audit: chill, shock and `Rimbo Form` can be up at the same time, and each Cap governs its own status, so the target's attack speed can fall by more than any single number here. Nothing sums them today; if that proves too strong, the fix is one shared attack-speed Cap, not smaller numbers.

## Poison — poison stack

```
poison_dps_per_stack = elem_aligned_damage * K_POISON    K_POISON = 0.08
poison_stack_max = 10
poison_decay = lose 1 stack every 8 sec
```

- Does not vanish immediately when firing stops, in exchange for lower damage per piece than fire.
- DoT is not contested by Evasion and does not crit, preventing targets from falsely missing and losing out.
- Stacks persist across weapon swaps because they live on the target, not on the item.
- Value 0.08 makes full 10 stacks equal 0.80 of Element damage per second, slightly below burn.

## Chaos — mark

```
chaos_stack_max = 25
stack_gain      = landed chaos hit that is not a Weak, gated by elem_align like every other status
dmg_mult = 1 + chaos_stack * K_CHAOS_DMG          K_CHAOS_DMG   = 0.01
leech    = chaos_stack * K_CHAOS_LEECH            K_CHAOS_LEECH = 0.002
mark_decay = lose 1 stack per second after 5 sec without firing
```

- Sustained fire on one target gives max damage, in exchange for resetting on target switch.
- Value 0.01 makes full 25 stacks +25% damage, not large enough to swallow crit.
- Leech is % of just-dealt damage. Value 0.002 gives 5% at full 25 stacks but must not exceed the per-second Max HP limit.
- In idle firing continuously at the same target, mark reaches full 25 stacks by itself.
- **Mark is the one status with no damage term of its own.** Every other Element's status converts the hit into a number (`elem_aligned_damage × K`); mark instead multiplies the hit it rides on. So Alignment enters mark exactly once, as the application gate, and there is no `elem_aligned_damage` term here. Reason: mark is the payoff for staying on one target, and letting Alignment scale it too would make the strongest stack payoff the one least about commitment.

# 6. Global DoT Cap

```
dot_total = burn + poison
dot_total = min(dot_total, elem_aligned_damage * 1.5)
```

- All DoT combined must not exceed **1.5x** of confirmed Element damage per second.
- Without this Cap, two-Element DoT would stack to 1.7x, exceeding direct hits during burn windows.
- **Five burn stacks reach the Cap exactly** (5 × 0.30 = 1.50), so a maxed fire build spends its whole DoT budget on burn and poison contributes nothing until burn drops a stack. That is the intended reading: the Cap is not a safety net that never binds, it is the wall a full fire build runs into.
- This Cap is the single point where all Element DoT meet; other differences fade one by one.
- Bleed is outside this Cap on purpose. It is physical, it does not stack, and its budget is `0.70 × physical_per_hit ÷ 5 sec` (formula-offense.md §4).

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

<!-- BEGIN GENERATED:element-k -->
| K | Value | Note |
|---|---|---|
| K_ELEM | 4 | elem / Int · lower than K_INT because it must pass Alignment |
| K_VIT_RES | 0.05 | elem res / Vit · no Flat |
| K_FIRE_BURN | 0.30 | burn per stack · max 5 stacks = 1.50, exactly the global DoT Cap |
| K_BURN_REGEN_CUT | 0.10 | HP regen cut per burn stack · 5 stacks = −50%, no separate Cap |
| K_CHILL_ARMOUR_CUT | 0.25 | target Armour × 0.75 · bites the lineages that carry Armour (D-022) |
| shock_aspd_pct | 20 | target attack speed · own Cap 20 · adds to chill, which has its own Cap 20 |
| shock_align_cut | 0.20 | our `elem_align` × 0.80 against a shocked target · shock is the only status that fights our own |
| K_POISON | 0.08 | poison per stack · 10 stacks = 0.80 |
| K_CHAOS_DMG | 0.01 | +dmg per mark stack · 25 stacks = +25% damage |
| K_CHAOS_LEECH | 0.002 | lifesteal per mark stack · 25 stacks = 0.05% |
| K_LIGHTNING_STUN | 0.30 | stun chance per Alignment · the Alignment reach lands at 11.0%, so the mace's Chance to stun % line is what reaches the Cap 15% (D-123 · D-124 · X43) |
| K_BLEED | 0.70 | bleed total as a fraction of the inflicting physical hit · physical DoT, not an Element — see formula-offense.md section 4 |
| bleed_time_sec | 5 | PoE base bleed duration · bleed does not stack |
| K_BLEED_CHANCE | 0.40 | chance per landed physical hit while `Lacerate` is up (curse, 10 sec ÷ 14 sec = 71% uptime) |
| global DoT Cap | 1.50 | burn + poison combined, as a multiple of confirmed Element damage per second |
<!-- END GENERATED:element-k -->
