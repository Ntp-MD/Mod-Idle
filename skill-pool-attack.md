# 18 attack skills

import glossary.md
import skill-pool.md

> Column "targets/hits" = targets struck / damage instances per single press · This number is what per-hit procs (Sonic Blow · Brute · Flurry · Jinx · stun from Alignment) count
> `eff cd` and `presses/sec` are computed from `cd` at the reference cast speed (`cdr_pct` / `ladder_pct` in `tools/data/skills.json` → `meta.formula.cast_reference`). Change a `cd` and rerun `node tools/skills.js --write` to watch the rate move. For any build, run `node tools/skills.js --calc --stat N --power N --level N --cdr N --ladder N`.

<!-- BEGIN GENERATED:attack-roster -->
| Skill | Group | Element | cd | eff cd | presses/sec | mana | Scale | Targets/Hits | Damage per press (glass / caster) | What it does |
|---|---|---|---|---|---|---|---|---|---|---|
| Cleave | melee | phys | 6 sec | 2.10 sec | 0.48 | 10% (AoE ×1.5) | Str 40% + weapon power 60% | 3/1 | 8,828 / 3,165 | Swing around, hits all in range |
| Elemental Break | melee | phys | 10 sec | 3.50 sec | 0.29 | 18% | Str 70% + weapon power 30% | 1/1 | 8,392 / 2,977 | Heavy hit + target takes +15% Element damage 8 sec (replaces Guard Break, which referenced a nonexistent system) |
| Whirlwind | melee | phys | 9 sec | 3.15 sec | 0.32 | 15% (AoE ×1.5) | Str 30% + weapon power 70% | 3/3 | 8,974 / 3,227 | Spin 3 rounds, 1 hit per target per round · Per-target hit count = proc engine |
| Shield Bash | melee | phys | 8 sec | 2.80 sec | 0.36 | 12% | Str 50% + weapon power 50% | 1/1 | 8,683 / 3,102 | Stops target attacks 1 sec (uses no chance, so does not hit the 15% stun Cap) |
| Puncture | melee | phys | 7 sec | 2.45 sec | 0.41 | 12% | Dex 40% + weapon power 60% | 1/1 | 6,465 / 2,868 | Applies 3 poison stacks (melee that feeds DoT) |
| Riposte | melee | phys | 9 sec | 3.15 sec | 0.32 | 14% | Agi 60% + weapon power 40% | 1/1 | 7,988 / 4,152 | Damage +3% per 1% player dodge chance (Cap +120%) · Gives dodge builds a boss path |
| Execute | all | phys | 14 sec | 4.90 sec | 0.20 | 18% | Str 50% + weapon power 50% | 1/1 | 8,683 / 3,102 | x2 if target HP below 20% |
| Retribution | all | phys | 11 sec | 3.85 sec | 0.26 | 16% | Vit 50% + weapon power 50% | 1/1 | 8,593 / 4,097 | Damage grows with lost HP (maximum x2 at 50% HP) · Tank tool on bosses |
| Piercing Shot | ranged | phys | 6 sec | 2.10 sec | 0.48 | 10% | Dex 30% + weapon power 70% | 1/1 | 7,201 / 3,005 | Single target · This hit does not roll dodge |
| Volley | ranged | phys | 8 sec | 2.80 sec | 0.36 | 14% (AoE ×1.5) | Dex 40% + weapon power 60% | 3/1 | 6,465 / 2,868 | Arrow spread hits all in range |
| Arrow Shower | ranged | phys | 7 sec | 2.45 sec | 0.41 | 13% | Dex 50% + weapon power 50% | 1/3 | 6,874 / 3,278 | 3 arrows, 40% each, 120% total of formula · Per-hit procs fire 3 times |
| Headshot | ranged | phys | 12 sec | 4.20 sec | 0.24 | 16% | Dex 60% + weapon power 40% | 1/1 | 4,992 / 2,595 | This hit +25% crit chance · Burst window for crit builds |
| Arcane Bolt | magic | follow | 5 sec | 1.75 sec | 0.57 | 12% | Int 60% + magic power 40% | 1/1 | 2,251 / 6,027 | Uses weapon Element · Hits at all ranges |
| Flame Lash | magic | fire | 6 sec | 2.10 sec | 0.48 | 13% | Int 50% + magic power 50% | 1/2 | 2,302 / 6,135 | Fire · Applies full 3 burn stacks in one press (fills the missing fire-skill slot) |
| Chain Spark | magic | lightning | 8 sec | 2.80 sec | 0.36 | 15% (AoE ×1.5) | Int 50% + magic power 50% | 3/1 | 2,302 / 6,135 | Lightning · Shocks all hit |
| Frost Nova | magic | cold | 9 sec | 3.15 sec | 0.32 | 16% (AoE ×1.5) | Int 50% + magic power 50% | 3/1 | 2,302 / 6,135 | Cold around self · Chills all |
| Toxic Spray | magic | poison | 12 sec | 4.20 sec | 0.24 | 20% (AoE ×1.5) | Int 40% + magic power 60% | 3/1 | 2,353 / 6,242 | 2 poison stacks to all in range |
| Void Lance | magic | chaos | 11 sec | 3.85 sec | 0.26 | 17% | Int 55% + magic power 45% | 1/1 | 2,276 / 6,081 | Chaos · Pierces 100% of target Elemental res on this hit (answer to res-required zones) |
<!-- END GENERATED:attack-roster -->
