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

**Levels** — the character level cap, the mob spawn cap and the last zone's band live in `world.md`; past the spawn cap the gear factor is held flat.

| Reference point | Value | Calculated from |
|---|---|---|
| Level 1 | every stat = 12 · sword attacks 1.2 times/sec | `stat_c` + section 7 |
| Level 190 (no gear) | every stat = 108 | `12 + 675 ÷ 7` |
| Level 190 · single-stat ceiling | **433** (focused: 1,012) | `(108.4 + 25×13 items)` · reference points with every item on one stat · the focused build spends every point there too |
| Level 190 · split two stats evenly | 271 each | 6 + 7 items (`SPLIT`) |
| Level 190 · Str 13-item build | Physical power 2,607 · 1.79 times/sec | `(433×5 + 80) × 1.16`, Agi at the level-only 108 |
| Expected DPS at level 100 (max build) | **3,965 per second** | includes 80% hit and 1.16 average crit · the passive tree is not folded into this line yet (owner ruling) |
| Time to kill level 100 mob | the **reference** build — **5.11 sec** · the focused build 0.22 sec (see section 0a) |

## 0a. Which ruling prices this line

Two rulings reshaped the Core stat line: the Core Stat % term was retired, then automatic per-level growth was replaced by **spent stat points** (the point economy in `core-stats.md`). This file prices the current line only — the **reference** build, the level's points split evenly across the seven stats, is what every published number and `mob_HP` are measured against, and the **focused** build puts every point in one stat, printed beside it. The re-base is registered here: the reference build reads 1,775 DPS (2,378 with the skill list) against the retired all-stats-390 character's 21,058, so the level-100 mob's TTK is **5.11 sec**; `loot.ttk_per_mob_sec`, the three `kills_per_hr_published` figures, every loot band, the craft count rows and the E1-E5 checkpoints all re-derived from it, `mob_HP` did not move, and the ENERGY-share, mob-dodge and armour-vs-trash bands were re-based with their rules unchanged. The funnel's new length is the honest consequence of that TTK and stands: play-length is not a design constraint, so `xp.kills_anchors` keeps the published line and no compensating cut is applied to it.

**All 7 stats use the same formula**, and under allocation that describes the reference build rather than the player's only option. A Core stat is `stat.base + points × stat.point_value` — no multiply step is left to get the order wrong.

## Expected DPS by the Split

Every row uses sword (`weapon_aspd` 1.2 · weapon_mult 1.0) · reference mob evasion at the level cap = 51.4 (mean species · Medium body · `formula-utility.md` section 8) · includes hit_chance and expected crit. Lck and Dex are 108 (the level-only reference line) in every row; the 12 items go to Str and Agi as the split names them.

| Split (Str/Agi/Lck/Dex) | Str | Agi | power | times/sec | crit% | hit% | Expected DPS |
|---|---|---|---|---|---|---|---|
| Str 12 | 408 | 108 | 2,462 | 1.79 | 5.4 | 80 | **3,745** |
| Str 11 / Dex 1 | 383 | 108 | 2,317 | 1.79 | 5.4 | 83 | 3,662 |
| Str 10 / Agi 2 | 358 | 158 | 2,172 | 1.94 | 5.4 | 80 | 3,580 |
| Str 8 / Agi 4 | 308 | 208 | 1,882 | 2.09 | 5.4 | 80 | 3,342 |
| Str 6 / Agi 6 | 258 | 258 | 1,592 | 2.24 | 5.4 | 80 | 3,030 |
| Agi 12 | 108 | 408 | 722 | 2.69 | 5.4 | 80 | 1,650 |

**What this table states — and this is a ruling to be aware of:**

- The spread is **2.27x** (3,745 down to 1,650) on the reference line, because 108 base Agi buys aspd far below the 500 Cap while Str has no Cap — every item on the measured stat wins, and the split pays for its freedom.
- **The winner inverted again.** The 510 line made the 50/50 split best and all-Str worst; at the lower reference line Agi no longer competes, so **all-Str is best and all-Agi worst**, and the 50/50 split is a middle row. That is the same shape the 816 line had, for the same reason (Agi cannot reach the Cap).
- Effect on the attack-speed fantasy sold in concept.md: a "fast hit" build now has to earn its place from hit-count value (procs · Sonic Blow · Flurry · chill · DoT ticks), because on aggregate it loses to the heavy split — the same trade the focused row below makes explicit.
- Base mob HP is **not** set from the top row · it is set from `DPS of on-level gear` times the skill-list multiplier. On that line the reference build reads 1,775 (2,378 with the skill list), so the level-100 mob takes **5.11 sec** — the TTK the kill rates, the loot bands and the catch-up budget are all written at (section 0a · `checks.md` D3-D5).

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
| K_INT_MREGEN | **0.28** | mana regen / Int | retuned with the pool the level cap 190 line gives: 40.0 sec against the 40 sec intent (B5) |
| K_INT_ES | **retired** | — | Energy Shield left Int (owner ruling); the pool is the Gear Energy Shield flat + Max Energy Shield % (X25) |
| K_INT_ESREGEN | **retired** | — | the regen is `energy_shield.regen_pct` (3%/sec of the pool) plus any `es_regen` skill, Mod or passive — a Core stat would have made the shield a build axis the owner took out |
| K_AGI_EVAS | 0.0333 | Evasion points / Agi | **30 Agi = 1 point** (owner ruling) · the mob side keeps K_MOB_DODGE for its own thin dodge |
| K_AGI_ASPD | 0.25 | aspd % per Agi | `aspd = weapon_aspd × (100 + (agi−12)×0.25 + aspd_pct)` · level 1 sword = 1.2 times/sec |
| K_WIS_CDR | 0.03 | cdr / Wis | 13% at 433 · 11 Mod items reach 48.8, under the hard-ceiling Cap 80 |
| K_DEX_ACC | 1.5 | accuracy / Dex | no Cap; ratio formula limits itself |
| K_DEX_ALIGN | 0.05 | Alignment / Dex | shared by Element and status · Alignment has no Cap (owner ruling) |
| K_MOB_RES | 0.05 | elem res / mob | **mob side only** — no Core stat feeds player Elemental resistance any more (owner ruling); the same value keeps all 22 species where they were |
| K_VIT_STUNREC | 0.1154 | stun recovery / Vit | the owner's own example: Vit 433 = 50%, so the 1 sec shock leaves 0.5 sec (X48) |
| K_LCK_CRIT | 0.05 | crit chance / Lck | 21.7% at 433 + 8 from main hand |
| K_LCK_PDOGE | **0.03** | perfect dodge rate / Lck | ratio 18.6% at 433 · `K_PDOGE` 57 → Cap 21 binds first (reachable at Lck 506) |
| K_LCK_DROP | 0.01 | drop rate multiplier / Lck | 5.3x at 433 · Base drop still separate |
| K_STR_WEIGHT | 2 | weight / Str | 1,867 at Str 433 · overweight cuts aspd up to -50% (section 11) |
| K_dodge | **retired** | — | the flat divisor is gone: Evasion is a ratio plus Agi points |
| K_EVASION | 0.5 | evasion / Dex | same line both sides: mob evasion = `stat_c × species.dex × 0.5 × body`, player evasion = `Dex × 0.5` (+ Gear Evasion flat 6-30) · replaces the old `mob evasion = level × 1` stand-in, which made a Slime and an Elf equally hard to hit |
| weapon_aspd | 0.7-1.5 | Base times/sec of weapon | multiplies whole parenthesis in section 7, not only the Agi term |
| weapon_mult | 1.2 / weapon_aspd | per weapon type | decided · equalizes DPS across types where Agi does not hit Cap |
<!-- END GENERATED:k-table -->

# Caps Present

<!-- BEGIN GENERATED:cap-table -->
| Value | Cap | Reachable at true ceiling? |
|---|---|---|
| Critical chance | **none** | the 100 Cap became a spill point: chance is held at 100 and the excess adds to crit damage (formula-offense.md section 3) |
| Evasion | **80** | Dex rating opposed by mob accuracy, + Agi ÷ 30 points, capped together · merged Dodge into this line · reachability closed by X20 |
| Block chance | **no Cap** | the Shield offhand's Base Mod line · the second avoidance layer, rolled after perfect dodge and evasion · open-ended (owner ruling) |
| Perfect dodge | **21** | ratio tops at 18.6% at Lck 433 but the Cap binds first · reachable at Lck 506 · old no-Cap retired |
| Elemental Alignment | **no Cap** | open-ended (owner ruling): Dex 433 + amulet + gloves = 31.7 and it keeps climbing — the `Status Alignment resistance %` Mod line is the separate defensive answer |
| Elemental resistance | 75 | gear-only (owner ruling) — no Core stat feeds it, so the Cap **binds**: 3 res slots at the max roll reach 90 and stop at the Cap |
| Cooldown reduction | 80 | a **hard ceiling**: Wis 433 + 11 CDR slots = 48.8, so the build tops out under it |
| Attack speed | **500 (= 5 times/sec)** | the 0.2 sec floor between hits · a clock rule, not a build target: fastest weapon needs Agi 845 vs the 433 ceiling · applied LAST, after the aspd Mod band, an aspd buff and the weight tax |
| Accuracy | ~~2,000~~ **removed** | ratio formula already forbids 100%; calculable ceiling 813 never hit old Cap |
<!-- END GENERATED:cap-table -->

All Caps must live together in one file, otherwise each system will set its own and collide.
And **every Cap must have a "reachable?" column** — a Cap that cannot be reached is not a power limit but a number that misleads players into thinking they can still progress.

# Base Numbers Still Missing

Already decided so removed: `weapon_mult` (= 1.2/weapon_aspd) · weapon Base power (none) · `accuracy_cap` (removed) · `mob evasion = level × 1` (replaced by `K_EVASION` on the mob's own Dex line)

Still truly missing, and each cannot be closed from this file alone:

- **K per skill** — "weapon power" in the skill table = character phys/magic power from sections 1-2 · but skill % versus normal attacks is still unset.
- **Alignment multiplier vs Element power** — see elements.md (next ruling needed: this gate leaves Element damage at ~35% of physical damage)
