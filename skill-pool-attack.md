<!-- BEGIN GENERATED:attack-heading -->
# 18 attack skills
<!-- END GENERATED:attack-heading -->

import glossary.md
import skill-pool.md

> Column "targets/hits" = targets struck / damage instances per single press · This number is what per-hit procs (Sonic Blow · Brute · Flurry · Jinx · stun from Alignment) count
> `eff cd` and `presses/sec` are computed from `cd` at the reference cast speed (`cdr_pct` / `ladder_pct` in `tools/data/skills.json` → `meta.formula.cast_reference`). Change a `cd` and rerun `node tools/skills.js --write` to watch the rate move. For any build, run `node tools/skills.js --calc --stat N --power N --level N --cdr N --ladder N`.

<!-- BEGIN GENERATED:attack-roster -->
| Skill | Group | Element | cd | eff cd | presses/sec | mana | Basis · final_pct (level 1) | Targets/Hits | Damage per press (glass / caster) | What it does |
|---|---|---|---|---|---|---|---|---|---|---|
| Cleave | melee | phys | 6 sec | 2.10 sec | 0.48 | 10% (AoE ×1.5) | phys · 142.84% | 3/1 | 5,600 / 1,927 | Swing around, hits all in range |
| Elemental Break | melee | phys | 10 sec | 3.50 sec | 0.29 | 18% | phys · 135.78% | 1/1 | 5,323 / 1,832 | Heavy hit + target takes +15% Element damage 8 sec (replaces Guard Break, which referenced a nonexistent system) |
| Whirlwind | melee | phys | 9 sec | 3.15 sec | 0.32 | 15% (AoE ×1.5) | phys · 145.19% | 3/3 | 5,692 / 1,959 | Spin 3 rounds, 1 hit per target per round · Per-target hit count = proc engine |
| Shield Bash | melee | phys | 8 sec | 2.80 sec | 0.36 | 12% | phys · 140.48% | 1/1 | 5,507 / 1,895 | Stops target attacks 1 sec (uses no chance, so does not hit the 15% stun Cap) |
| Puncture | melee | phys | 7 sec | 2.45 sec | 0.41 | 12% | phys · 142.84% | 1/1 | 5,600 / 1,927 | Applies 3 poison stacks (melee that feeds DoT) |
| Riposte | melee | phys | 9 sec | 3.15 sec | 0.32 | 14% | phys · 138.13% | 1/1 | 5,415 / 1,864 | Damage +3% per 1% player Evasion chance (Cap +120%) · Gives Evasion builds a boss path |
| Execute | all | phys | 14 sec | 4.90 sec | 0.20 | 18% | phys · 140.48% | 1/1 | 5,507 / 1,895 | x2 if target HP below 20% |
| Retribution | all | phys | 11 sec | 3.85 sec | 0.26 | 16% | phys · 140.48% | 1/1 | 5,507 / 1,895 | Damage grows with lost HP (maximum x2 at 50% HP) · Tank tool on bosses |
| Piercing Shot | ranged | phys | 6 sec | 2.10 sec | 0.48 | 10% | phys · 145.19% | 1/1 | 5,692 / 1,959 | Single target · This hit does not roll dodge |
| Volley | ranged | phys | 8 sec | 2.80 sec | 0.36 | 14% (AoE ×1.5) | phys · 142.84% | 3/1 | 5,600 / 1,927 | Arrow spread hits all in range |
| Arrow Shower | ranged | phys | 7 sec | 2.45 sec | 0.41 | 13% | phys · 140.48% | 1/3 | 5,507 / 1,895 | 3 arrows, 40% each, 120% total of formula · Per-hit procs fire 3 times |
| Headshot | ranged | phys | 12 sec | 4.20 sec | 0.24 | 16% | phys · 138.13% | 1/1 | 5,415 / 1,864 | This hit +25% crit chance · Burst window for crit builds |
| Arcane Bolt | magic | follow | 5 sec | 1.75 sec | 0.57 | 12% | magic · 102.32% | 1/1 | 1,497 / 4,293 | Uses weapon Element · Hits at all ranges |
| Flame Lash | magic | fire | 6 sec | 2.10 sec | 0.48 | 13% | magic · 104.06% | 1/2 | 1,522 / 4,366 | Fire · Applies full 3 burn stacks in one press (fills the missing fire-skill slot) |
| Chain Spark | magic | lightning | 8 sec | 2.80 sec | 0.36 | 15% (AoE ×1.5) | magic · 104.06% | 3/1 | 1,522 / 4,366 | Lightning · Shocks all hit |
| Frost Nova | magic | cold | 9 sec | 3.15 sec | 0.32 | 16% (AoE ×1.5) | magic · 104.06% | 3/1 | 1,522 / 4,366 | Cold around self · Chills all |
| Toxic Spray | magic | poison | 12 sec | 4.20 sec | 0.24 | 20% (AoE ×1.5) | magic · 105.81% | 3/1 | 1,548 / 4,439 | 2 poison stacks to all in range |
| Void Lance | magic | chaos | 11 sec | 3.85 sec | 0.26 | 17% | magic · 103.19% | 1/1 | 1,509 / 4,329 | Chaos · Pierces 100% of target Elemental res on this hit (answer to res-required zones) |

press = final_pct × basis × (1 + (skill_level − 1) × 1.5%) at skill level 20 (D-070 · B5) — the two columns are the same press read on the two published reference builds:
glass = Str 12 · basis phys 3,051 · caster = Int 12 · basis magic 3,051 + elem 2,040 × Alignment 10.5% (214) = 3,265.
A phys-basis press can crit and a magic-basis one cannot, so neither column includes crit (formula.md section 0's DPS row does).
<!-- END GENERATED:attack-roster -->
