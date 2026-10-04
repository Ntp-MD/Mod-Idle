# Formulas

import core-stats.md
import mod-pool.md
import equipment-slot.md
import elements.md
import formula-offense.md
import formula-defense.md
import formula-utility.md

Symbols: `x` = value from build · `x_c` = value from Core stat · `x_f` = value from Mod Flat · `x_p` = value from Mod %

# Detail files

- formula-offense.md — # 1. Physical power (incl weapon_mult) · # 2. Magic power · # 3. Critical
- formula-defense.md — # 4. Dodge (incl perfect dodge) · # 5. HP / Mana / Energy Shield · # 6. Cooldown reduction · # 9. Alignment and Elemental resistance
- formula-utility.md — # 7. Attack speed · # 8. Accuracy · # 10. Drop chance · # 11. Weight (full weight tax tables)
- This index keeps # 0. Numeric Targets · Summary of Set K Values · Caps Present · Base Numbers Still Missing. Detail formulas live in the 3 files above.

# 0. Numeric Targets

All numbers here are designed to pass this check — if any number change breaks this point, adjust the other values accordingly.

**Every value in this file must trace back to the Mod tables in `mod-pool.md`.** Any value set by feel without calculation is wrong. Fix it here, not by adjusting numbers to feel right.

**Levels** — character level Cap 100 · max zone level 90 · levels 91-100 mean more of the same zone-9 band (see world.md)

| Reference point | Value | Calculated from |
|---|---|---|
| Level 1 | every stat = 12 · sword attacks 1.2 times/sec | `stat_c` + section 7 |
| Level 100 (no gear) | every stat = 210 | `12 + 2 × 99` |
| Level 100 · single-stat ceiling | **816** | `(210 + 25×12 items) × (1 + 5%×12 items)` |
| Level 100 · split two stats evenly | 468 each | 6 items + 6 items |
| Level 100 · Str 12-item build | Physical power 4,826 · 2.09 times/sec | `(816×5 + 80) × 1.16` |
| Expected DPS at level 100 (max build) | **9,847 per second** | includes 80% hit and 1.22 average crit · there is no passive tree (D-046) |
| Time to kill level 100 mob | on-level gear + skill list - 1 sec - maxed skills - 0.70 sec - naked in-zone:

> **This number set replaces the old text stating stat ≈ 890 · power ≈ 5,000 · DPS ≈ 24,000 · mob HP ≈ 24,000**
> The old values assumed 13.2 items · applied crit 1.62 as if crit happened every hit, and did not subtract miss chance
> and the old attack speed formula did not work at level 1 (see section 7), so the whole set was rebuilt from real Mod tables.

**All 7 stats use the same formula.** No stat has an advantage.

```
stat_c = 12 + 2 * (level - 1)
stat   = (stat_c + core_stat_flat) * (1 + core_stat_pct/100)
```

- One item can roll at most 2 slots of Core stat = `core_stat_flat` 1 slot + `core_stat_pct` 1 slot **and both slots may be the same stat** (same rule as equipment-slot.md)
  If the 2 slots were forced to be different stats, the single-stat ceiling would drop to 510 instead of 816 and every K value below would break.
- At level 100, max Flat from gear is 300 (25 × 12 items) and max % is 60 (5% × 12 items), giving `(210 + 300) × 1.60 = 816`
- Order: Flat first, then multiply by % — if % is applied before Flat, Flat would be scaled by % against player intent.

## Expected DPS by 12-Item Split

Every row uses sword (`weapon_aspd` 1.2 · weapon_mult 1.0) · reference mob evasion at level 100 = 101 (mean species · Medium body · `formula-utility.md` section 8) · includes hit_chance and expected crit.

| Split (Str/Agi/Lck/Dex) | Str | Agi | power | times/sec | crit% | hit% | Expected DPS |
|---|---|---|---|---|---|---|---|
| Str 12 | 816 | 210 | 4,826 | 2.09 | 18.5 | 80 | **9,847** |
| Str 11 / Dex 1 | 752 | 210 | 4,450 | 2.09 | 18.5 | 82 | 9,370 |
| Str 10 / Agi 2 | 690 | 286 | 4,100 | 2.32 | 18.5 | 80 | 9,270 |
| Str 8 / Agi 4 | 574 | 372 | 3,420 | 2.58 | 18.5 | 80 | 8,600 |
| Str 6 / Agi 6 | 468 | 468 | 2,810 | 2.87 | 18.5 | 80 | 7,850 |
| Agi 12 | 210 | 816 | 1,310 | 3.00 | 18.5 | 80 | 3,830 |

**What this table states — and this is a ruling to be aware of:**

- "No stat has an advantage" is true at the *formula* level only (every stat uses the same 5-25 + 1-5% ranges with the same 816 ceiling), not at the *outcome* level.
- **Max DPS means stacking all 12 items on Str (9,847), and full Agi is lowest (3,830), a 2.6x gap.**
  The cause is Agi hitting the 300 Cap at ~512 Agi, so excess points become zero, while power from Str has no Cap.
- Effect on the attack-speed fantasy sold in concept.md: a "fast hit" build will never be faster in total DPS · its value must come from **hit count** (procs per hit · Sonic Blow · Flurry · chill · DoT tick count), not from the aggregate number.
  If the 2.6x gap is unacceptable, pick one: add a Cap to the power path · reduce the Str weight on phys · or give Agi value outside aspd.
- Base mob HP is **not** set from the top row · it is set from `DPS of on-level gear` (8,881 at level 100) times the skill-list multiplier · the lower rows of this table are the real cost for non-Str builds: split-stat builds still kill the same mob in 1.2-2.6 seconds (D4/D5 in checks.md)

# Summary of Set K Values

<!-- BEGIN GENERATED:k-table -->
| K | Value | Unit | Note |
|---|---|---|---|
| K_STR | 5 | phys / Str | Str 510 → 2,550 · main driver of Str |
| K_INT | 5 | magic / Int | main driver of Int |
| K_ELEM | 4 | elem / Int | lower than Int because it must pass Alignment first |
| K_VIT_HP | 20 | hp / Vit | Vit 510 → 10,200 raw |
| K_VIT_REGEN | 0.25 | hp regen / Vit | 128/sec at 510 |
| K_INT_MP | 4 | mana / Int | set to keep mana a constraint, see section 5 |
| K_INT_MREGEN | **0.15** | mana regen / Int | old 0.2 gave pool/regen 29.7 sec against 40 sec intent |
| K_INT_ES | 4 | Energy Shield / Int | Int 510 = 2,040 shield = 25% of that build''s 8,160 HP (X25) |
| K_INT_ESREGEN | 0.1 | ES recharge / Int | 51/sec · 5 sec delay · whole pool back in 40 sec |
| K_AGI_EVAS | 0.0333 | Evasion points / Agi | **30 Agi = 1 point** (owner ruling, D-112) · the mob side keeps K_MOB_DODGE for its own thin dodge (D-024) |
| K_AGI_ASPD | 0.25 | aspd % per Agi | `aspd = weapon_aspd × (100 + (agi−12)×0.25 + aspd_pct)` · level 1 sword = 1.2 times/sec |
| K_WIS_CDR | 0.03 | cdr / Wis | 15.3% at 510 · needs 11 Mod items to reach the 80 Cap |
| K_DEX_ACC | 1.5 | accuracy / Dex | no Cap; ratio formula limits itself |
| K_DEX_ALIGN | 0.05 | Alignment / Dex | shared by Element and status · Cap 50 |
| K_VIT_RES | 0.05 | elem res / Vit | no Flat · 25.5% at 510 |
| K_LCK_CRIT | 0.05 | crit chance / Lck | 25.5% at 510 + 8 from main hand |
| K_LCK_PDOGE | **0.03** | perfect dodge rate / Lck | ratio 21.2% at 510 · `K_PDOGE` 57 → Cap 25 binds first (reachable at Lck 634) |
| K_LCK_DROP | 0.01 | drop rate multiplier / Lck | 6.1x at 510 · Base drop still separate |
| K_STR_WEIGHT | 2 | weight / Str | 1,020 at Str 510 · overweight cuts aspd up to -50% (section 11) |
| K_dodge | **retired** | — | the flat divisor is gone: Evasion is a ratio plus Agi points (D-112) |
| K_EVASION | 0.5 | evasion / Dex | same line both sides: mob evasion = `stat_c × species.dex × 0.5 × body`, player evasion = `Dex × 0.5` (+ Gear Evasion flat 6-30) · replaces the old `mob evasion = level × 1` stand-in, which made a Slime and an Elf equally hard to hit |
| weapon_aspd | 0.7-1.5 | Base times/sec of weapon | multiplies whole parenthesis in section 7, not only the Agi term |
| weapon_mult | 1.2 / weapon_aspd | per weapon type | decided · equalizes DPS across types where Agi does not hit Cap |
<!-- END GENERATED:k-table -->

# Caps Present

<!-- BEGIN GENERATED:cap-table -->
| Value | Cap | Reachable at true ceiling? |
|---|---|---|
| Critical chance | **none** | the 100 Cap became a spill point: chance is held at 100 and the excess adds to crit damage (formula-offense.md section 3) |
| Evasion | **80** | Dex rating opposed by mob accuracy, + Agi ÷ 30 points, capped together · D-112 merged Dodge into this line · reachability closed by X20 |
| Perfect dodge | **25** | ratio tops at 21.2% at Lck 510 but the Cap binds first · reachable at Lck 634 · old no-Cap retired |
| Elemental Alignment | **50** | Dex 510 + amulet + gloves = 35.5 → exact · old 60 unreachable |
| Elemental resistance | 75 | requires Vit 510 + 3 res slots |
| Cooldown reduction | 80 | requires Wis 510 + 11 CDR slots |
| Attack speed | **500 (= 5 times/sec)** | the 0.2 sec floor between hits · a clock rule, not a build target: fastest weapon needs Agi 845 vs the 510 ceiling |
| Accuracy | ~~2,000~~ **removed** | ratio formula already forbids 100%; calculable ceiling 956 never hit old Cap |
<!-- END GENERATED:cap-table -->

All Caps must live together in one file, otherwise each system will set its own and collide.
And **every Cap must have a "reachable?" column** — a Cap that cannot be reached is not a power limit but a number that misleads players into thinking they can still progress.

# Base Numbers Still Missing

Already decided so removed: `weapon_mult` (= 1.2/weapon_aspd) · weapon Base power (none) · `accuracy_cap` (removed) · `mob evasion = level × 1` (replaced by `K_EVASION` on the mob's own Dex line)

Still truly missing, and each cannot be closed from this file alone:

- **K per skill** — "weapon power" in the skill table = character phys/magic power from sections 1-2 · but skill % versus normal attacks is still unset.
- **Alignment multiplier vs Element power** — see elements.md (next ruling needed: this gate leaves Element damage at ~35% of physical damage)
