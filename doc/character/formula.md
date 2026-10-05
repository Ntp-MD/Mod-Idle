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
- formula-defense.md — # 4. Evasion (incl perfect dodge) · # 5. HP / Mana / Energy Shield · # 6. Cooldown reduction · # 9. Alignment and Elemental resistance
- formula-utility.md — # 7. Attack speed · # 8. Accuracy · # 10. Drop chance · # 11. Weight (full weight tax tables)
- This index keeps # 0. Numeric Targets · Summary of Set K Values · Caps Present · Base Numbers Still Missing. Detail formulas live in the 3 files above.

# 0. Numeric Targets

All numbers here are designed to pass this check — if any number change breaks this point, adjust the other values accordingly.

**Every value in this file must trace back to the Mod tables in `mod-pool.md`.** Any value set by feel without calculation is wrong. Fix it here, not by adjusting numbers to feel right.

**Levels** — character level Cap 100 · max zone level 90 · levels 91-100 mean more of the same zone-9 band (see world.md)

| Reference point | Value | Calculated from |
|---|---|---|
| Level 1 | every stat = 12 · sword attacks 1.2 times/sec | `stat_c` + section 7 |
| Level 190 (no gear) | every stat = 108 | `12 + 675 ÷ 7` |
| Level 190 · single-stat ceiling | **433** | `(108.4 + 25×13 items)` · no Core Stat % term (D-114) |
| Level 190 · split two stats evenly | 532 each | 6 items + 6 items |
| Level 190 · Str 13-item build | Physical power 2,607 · 2.10 times/sec | `(433×5 + 80) × 1.16` |
| Expected DPS at level 100 (max build) | **7,518 per second** | includes 80% hit and 1.12 average crit · there is no passive tree (D-046) |
| Time to kill level 100 mob | on-level geared players — **1.00 sec**, the D1 anchor holds at ceiling 535 (see section 0a) |

## 0a. What Removing Core Stat % Moved (D-114)

Core Stat % is retired, so the level-100 single-stat ceiling fell **816 → 510**, a 37.5% cut. The table records what moved and how each was closed. Every close took the same route: the number that was set on 816 moved to the value 510 reaches, and **no Core Stat % term came back**.

| Promise | At 816 | At 510 | Resolution |
|---|---|---|---|
| Single-stat ceiling | 816 | **510** | settled by the ruling |
| Max build Expected DPS | 9,847 (all-Str) | **7,049** (Str 6/Agi 6) | moved −28% |
| Best-to-worst build spread | 2.6x, all-Str wins | **1.23x, split wins** | **inverted** — the ruling now says the opposite |
| Best-build TTK on a level-100 mob | 1.0 sec | **1.00 sec** | `mob_HP` is set from the new on-level DPS (8,881 · D1), so the 1 sec anchor holds |
| Crit from a Lck ceiling build | 40.8% pool | **25.5%** pool | Cap 100 no longer binds |
| Alignment reach | 45.8% | **35.5% → Cap 50** | Cap raised as a hard ceiling above the build (D-124) |
| Elemental res reach | 40.8% | **48.5% → Cap 75** | Cap raised as a hard ceiling above the build (D-124) |
| CDR reach | 91.8% | **57.4% → Cap 80** | Cap raised as a hard ceiling above the build (D-124) |
| Armour vs the zone-9 boss | in the 10-40% band | **7.7%** | X22 band re-based for a Str-driven line over a mob DPS that did not move (D-022) |
| Energy Shield vs a caster's HP | in the 30-45% band | **25.0%** | X25 band re-based — the pool follows the stat ceiling (D-026) |
| Mana pool ÷ regen | 40 sec | **39.5 sec** | `K_INT_MREGEN` 0.18 restores the 40 sec intent (B5 · X3) |
| Lck "junk line" bound | ×2.11 quoted by G8 | **×2.10** | matches the band (X7) |

**The shape change is permanent, and that is the ruling.** The split build is now the best and the spread is 1.23x instead of 2.6x, which is exactly the "no stat wins" property D-114 was for. Nothing here is pending: the Caps, `mob_HP` and the two mob-anchored bands were all re-stated to the 510 ceiling, so X11, X22, X25, X3 and the D1-D5 anchor rows hold. The K table is generated from `engine.json`, so any further move changes one file and the docs follow.

**All 7 stats use the same formula.** No stat has an advantage.

```
stat_c = 12 + 2 * (level - 1)
stat   = stat_c + core_stat_flat
```

- **Core Stat % is retired** (owner ruling, D-114). One item can roll at most **1 slot of Core stat = 25 Flat**, and all 12 items may roll the same stat.
  At level 100 that is `210 + 25×12 = **510**`, and 510 is the number every K value below is set on.
- The retired ceiling was `816` (`(210 + 300) × 1.60`). Removing the % term is the single largest balance change in the project and it moved three published promises — max DPS, the 1 sec TTK anchor, and Cap reachability. Section 0a records what moved and how each was closed.
- Flat is applied directly to `stat_c`; there is no multiply step left to get the order wrong.

## Expected DPS by 12-Item Split

Every row uses sword (`weapon_aspd` 1.2 · weapon_mult 1.0) · reference mob evasion at level 100 = 99.5 (mean species · Medium body · `formula-utility.md` section 8) · includes hit_chance and expected crit. Lck and Dex are 210 (levels only) in every row; the 12 items go to Str and Agi as the split names them.

| Split (Str/Agi/Lck/Dex) | Str | Agi | power | times/sec | crit% | hit% | Expected DPS |
|---|---|---|---|---|---|---|---|
| Str 12 | 510 | 210 | 3,051 | 2.10 | 10.5 | 80 | 5,752 |
| Str 11 / Dex 1 | 485 | 235 | 2,906 | 2.35 | 10.5 | 80 | 6,131 |
| Str 10 / Agi 2 | 460 | 260 | 2,761 | 2.60 | 10.5 | 80 | 6,445 |
| Str 8 / Agi 4 | 410 | 310 | 2,471 | 3.10 | 10.5 | 80 | 6,877 |
| Str 6 / Agi 6 | 360 | 360 | 2,181 | 3.60 | 10.5 | 80 | **7,049** |
| Agi 12 | 210 | 510 | 1,311 | 5.10 | 10.5 | 80 | 6,002 |

**What this table states — and this is a ruling to be aware of:**

- "No stat has an advantage" is now true at the *outcome* level too, not just the formula level: the spread is **1.23x** (7,049 down to 5,752). At the retired 816 ceiling it was 2.6x.
- **The winner inverted.** At 816 all-Str was best (9,847) and all-Agi worst (3,830), because Agi hit the 300 aspd Cap and wasted points while Str had no Cap. At 510 Agi no longer reaches that Cap, so **the 50/50 split is now the best build and all-Str is the worst** — the exact opposite of the published ruling.
- Effect on the attack-speed fantasy sold in concept.md: a "fast hit" build is now within 15% of the best build instead of 69% below it, so hit-count value (procs · Sonic Blow · Flurry · chill · DoT ticks) no longer has to carry a build that loses on aggregate.
- Base mob HP is **not** set from the top row · it is set from `DPS of on-level gear` (8,881 at level 100) times the skill-list multiplier. That figure was measured before the % term was removed, which is why the 1 sec TTK anchor no longer closes — see section 0a.

# Summary of Set K Values

<!-- BEGIN GENERATED:k-table -->
| K | Value | Unit | Note |
|---|---|---|---|
| K_STR | 5 | phys / Str | Str 433 → 2,167 · main driver of Str |
| K_INT | 5 | magic / Int | main driver of Int |
| K_ELEM | 4 | elem / Int | lower than Int because it must pass Alignment first |
| K_VIT_HP | 20 | hp / Vit | Vit 433 → 8,669 raw |
| K_VIT_REGEN | 0.25 | hp regen / Vit | 108/sec at 433 |
| K_INT_MP | 4 | mana / Int | set to keep mana a constraint, see section 5 |
| K_INT_MREGEN | **0.18** | mana regen / Int | old 0.2 gave pool/regen 29.7 sec against 40 sec intent |
| K_INT_ES | 4 | Energy Shield / Int | Int 433 = 1,734 shield = 17.3% of that build''s 10,029 HP (X25) |
| K_INT_ESREGEN | 0.1 | ES recharge / Int | 43.3/sec · 3 sec delay · whole pool back in 40 sec |
| K_AGI_EVAS | 0.0333 | Evasion points / Agi | **30 Agi = 1 point** (owner ruling, D-112) · the mob side keeps K_MOB_DODGE for its own thin dodge (D-024) |
| K_AGI_ASPD | 0.25 | aspd % per Agi | `aspd = weapon_aspd × (100 + (agi−12)×0.25 + aspd_pct)` · level 1 sword = 1.2 times/sec |
| K_WIS_CDR | 0.03 | cdr / Wis | 13% at 433 · 11 Mod items reach 48.8, under the hard-ceiling Cap 80 (D-124) |
| K_DEX_ACC | 1.5 | accuracy / Dex | no Cap; ratio formula limits itself |
| K_DEX_ALIGN | 0.05 | Alignment / Dex | shared by Element and status · Alignment has no Cap (owner ruling) |
| K_VIT_RES | 0.05 | elem res / Vit | no Flat · 21.7% at 433 |
| K_LCK_CRIT | 0.05 | crit chance / Lck | 21.7% at 433 + 8 from main hand |
| K_LCK_PDOGE | **0.03** | perfect dodge rate / Lck | ratio 18.6% at 433 · `K_PDOGE` 57 → Cap 21 binds first (reachable at Lck 506) |
| K_LCK_DROP | 0.01 | drop rate multiplier / Lck | 5.3x at 433 · Base drop still separate |
| K_STR_WEIGHT | 2 | weight / Str | 1,867 at Str 433 · overweight cuts aspd up to -50% (section 11) |
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
| Block chance | **no Cap** | the Shield offhand's Base Mod line (D-123) · the second avoidance layer, rolled after perfect dodge and evasion · open-ended (owner ruling) |
| Perfect dodge | **21** | ratio tops at 18.6% at Lck 433 but the Cap binds first · reachable at Lck 506 · old no-Cap retired |
| Elemental Alignment | **no Cap** | open-ended (owner ruling): Dex 433 + amulet + gloves = 31.7 and it keeps climbing — the `Status Alignment resistance %` Mod line is the separate defensive answer |
| Elemental resistance | 75 | a **hard ceiling** (D-124): Vit 433 + 3 res slots = 41.2, so the build tops out under it |
| Cooldown reduction | 80 | a **hard ceiling** (D-124): Wis 433 + 11 CDR slots = 48.8, so the build tops out under it |
| Attack speed | **500 (= 5 times/sec)** | the 0.2 sec floor between hits · a clock rule, not a build target: fastest weapon needs Agi 845 vs the 433 ceiling |
| Accuracy | ~~2,000~~ **removed** | ratio formula already forbids 100%; calculable ceiling 813 never hit old Cap |
<!-- END GENERATED:cap-table -->

All Caps must live together in one file, otherwise each system will set its own and collide.
And **every Cap must have a "reachable?" column** — a Cap that cannot be reached is not a power limit but a number that misleads players into thinking they can still progress.

# Base Numbers Still Missing

Already decided so removed: `weapon_mult` (= 1.2/weapon_aspd) · weapon Base power (none) · `accuracy_cap` (removed) · `mob evasion = level × 1` (replaced by `K_EVASION` on the mob's own Dex line)

Still truly missing, and each cannot be closed from this file alone:

- **K per skill** — "weapon power" in the skill table = character phys/magic power from sections 1-2 · but skill % versus normal attacks is still unset.
- **Alignment multiplier vs Element power** — see elements.md (next ruling needed: this gate leaves Element damage at ~35% of physical damage)
