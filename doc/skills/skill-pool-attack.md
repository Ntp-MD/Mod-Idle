<!-- BEGIN GENERATED:attack-heading -->
# 31 attack skills
<!-- END GENERATED:attack-heading -->

import glossary.md
import skill-pool.md

> Column "targets/hits" = targets struck / damage instances per single press · This number is what per-hit procs (Sonic Blow · Brute · Flurry · Jinx · stun from Alignment) count
> `eff cd` and `presses/sec` are computed from `cd` at the reference cast speed (`cdr_pct` / `ladder_pct` in `tools/data/skills.json` → `meta.formula.cast_reference`). Change a `cd` and rerun `node tools/skills.ts --write` to watch the rate move. For any build, run `node tools/skills.ts --calc --stat N --power N --level N --cdr N --ladder N`.

<!-- BEGIN GENERATED:attack-roster -->
| Skill | Group | Element | cd | eff cd | presses/sec | mana | Basis · final_pct (level 1) | Targets/Hits | Damage per press (glass / caster) | What it does |
|---|---|---|---|---|---|---|---|---|---|---|
| Cleave | melee | phys | 6 sec | 2.10 sec | 0.48 | 10% (AoE ×1.5) | phys · 142.84% | 3/1 | 4,784 / 995 | Swing around, hits all in range |
| Elemental Break | melee | phys | 10 sec | 3.50 sec | 0.29 | 18% | phys · 135.78% | 1/1 | 4,548 / 946 | Heavy hit + target takes +15% Element damage 8 sec (replaces Guard Break, which referenced a nonexistent system) |
| Whirlwind | melee | phys | 9 sec | 3.15 sec | 0.32 | 15% (AoE ×1.5) | phys · 145.19% | 3/3 | 4,863 / 1,011 | Spin 3 rounds, 1 hit per target per round · Per-target hit count = proc engine |
| Shield Bash | melee | phys | 8 sec | 2.80 sec | 0.36 | 12% | phys · 140.48% | 1/1 | 4,706 / 979 | Stops target attacks 1 sec (a flat stop, not a rolled stun chance) |
| Puncture | melee | phys | 7 sec | 2.45 sec | 0.41 | 12% | phys · 142.84% | 1/1 | 4,784 / 995 | Applies 3 poison stacks (melee that feeds DoT) |
| Riposte | melee | phys | 9 sec | 3.15 sec | 0.32 | 14% | phys · 138.13% | 1/1 | 4,627 / 962 | Damage +3% per 1% player Evasion chance (Cap +120%) · Gives Evasion builds a boss path |
| Execute | all | phys | 14 sec | 4.90 sec | 0.20 | 18% | phys · 140.48% | 1/1 | 4,706 / 979 | x2 if target HP below 20% |
| Retribution | all | phys | 11 sec | 3.85 sec | 0.26 | 16% | phys · 140.48% | 1/1 | 4,706 / 979 | Damage grows with lost HP (maximum x2 at 50% HP) · Tank tool on bosses |
| Piercing Shot | ranged | phys | 6 sec | 2.10 sec | 0.48 | 10% | phys · 145.19% | 1/1 | 4,863 / 1,011 | Single target · This hit does not roll dodge |
| Volley | ranged | phys | 8 sec | 2.80 sec | 0.36 | 14% (AoE ×1.5) | phys · 142.84% | 3/1 | 4,784 / 995 | Arrow spread hits all in range |
| Arrow Shower | ranged | phys | 7 sec | 2.45 sec | 0.41 | 13% | phys · 140.48% | 1/3 | 4,706 / 979 | 3 arrows, 40% each, 120% total of formula · Per-hit procs fire 3 times |
| Headshot | ranged | phys | 12 sec | 4.20 sec | 0.24 | 16% | phys · 138.13% | 1/1 | 4,627 / 962 | This hit +25% crit chance · Burst window for crit builds |
| Reap | melee | phys | 9 sec | 3.15 sec | 0.32 | 14 flat | phys · 140.48% | 1/1 | 4,706 / 979 | Leech +25% and physical power x1.10 for 6 sec · the window opens on the press and rides the skill's own duration |
| Arcane Bolt | magic | follow | 5 sec | 1.75 sec | 0.57 | 12% | magic · 102.32% | 1/1 | 744 / 3,551 | Uses weapon Element · Hits at all ranges |
| Flame Lash | magic | fire | 6 sec | 2.10 sec | 0.48 | 13% | magic · 104.06% | 1/2 | 756 / 3,611 | Fire · Applies full 3 burn stacks in one press (fills the missing fire-skill slot) |
| Chain Spark | magic | lightning | 8 sec | 2.80 sec | 0.36 | 15% (AoE ×1.5) | magic · 104.06% | 3/1 | 756 / 3,611 | Lightning · Shocks all hit |
| Frost Nova | magic | cold | 9 sec | 3.15 sec | 0.32 | 16% (AoE ×1.5) | magic · 104.06% | 3/1 | 756 / 3,611 | Cold around self · Chills all |
| Toxic Spray | magic | poison | 12 sec | 4.20 sec | 0.24 | 20% (AoE ×1.5) | magic · 105.81% | 3/1 | 769 / 3,672 | 2 poison stacks to all in range |
| Void Lance | magic | chaos | 11 sec | 3.85 sec | 0.26 | 17% | magic · 103.19% | 1/1 | 750 / 3,581 | Chaos · Pierces 100% of target Elemental res on this hit (answer to res-required zones) |
| Bloodletting | melee | phys | 11 sec | 3.85 sec | 0.26 | 16 flat | phys · 142.84% | 1/1 | 4,784 / 995 | Instant heal 6% Max HP and leech +15% on the press |
| Pierce the Veil | ranged | phys | 7 sec | 2.45 sec | 0.41 | 12 flat | phys · 138.13% | 1/1 | 4,627 / 962 | This hit does not roll dodge and strips the target's Elemental resistance -15% for 8 sec |
| Widow Strike | ranged | phys | 10 sec | 3.50 sec | 0.29 | 14 flat | phys · 135.78% | 1/1 | 4,548 / 946 | A chilled target takes +25% Elemental damage for 8 sec |
| Volley of Blades | melee | phys | 12 sec | 4.20 sec | 0.24 | 20 flat (AoE ×1.5) | phys · 145.19% | 3/5 | 4,863 / 1,011 | 5 hits at 30% each = 150% of one basis · per-hit procs fire 5 times |
| Impale | melee | phys | 8 sec | 2.80 sec | 0.36 | 14 flat | phys · 142.84% | 1/3 | 4,784 / 995 | 3 hits at 50% each = 150% of one basis · per-hit procs fire 3 times |
| Echo Strike | all | phys | 8 sec | 2.80 sec | 0.36 | 13 flat | phys · 140.48% | 1/2 | 4,706 / 979 | 2 hits at 60% each = 120% of one basis · per-hit procs fire 2 times |
| Momentum | ranged | phys | 9 sec | 3.15 sec | 0.32 | 12 flat | phys · 138.13% | 1/1 | 4,627 / 962 | Attack speed +20% for 6 sec · the speed buff rides the press |
| Plague Spit | magic | poison | 9 sec | 3.15 sec | 0.32 | 16 flat | magic · 105.81% | 1/1 | 769 / 3,672 | Applies 4 poison stacks and +40% bleed chance to the target |
| Thunderhead | magic | lightning | 9 sec | 3.15 sec | 0.32 | 16 flat (AoE ×1.5) | magic · 104.06% | 3/1 | 756 / 3,611 | Stops every target 1 sec and shocks all of them |
| Glacial Nail | magic | cold | 10 sec | 3.50 sec | 0.29 | 15 flat | magic · 104.06% | 3/1 | 756 / 3,611 | Stops every target 1 sec and chills all of them |
| Reality Rift | magic | chaos | 12 sec | 4.20 sec | 0.24 | 18 flat | magic · 103.19% | 1/1 | 750 / 3,581 | This hit pierces 100% of the target's Elemental res and the curse spreads to 2 neighbours |
| Arcane Surge | magic | follow | 8 sec | 2.80 sec | 0.36 | 14 flat | magic · 102.32% | 1/1 | 744 / 3,551 | Mana regen +25% and attack speed +15% for 6 sec · both buffs ride the press |

press = final_pct × basis × (1 + (skill_level − 1) × 1.5%) at skill level 20 (D-070 · B5) — the two columns are the same press read on the two published reference builds:
glass = Str 12 · basis phys 2,607 · caster = Int 12 · basis magic 2,607 + elem 1,733.72 × Alignment 5.421428571428572% (94) = 2,701.
A phys-basis press can crit and a magic-basis one cannot, so neither column includes crit (formula.md section 0's DPS row does).
<!-- END GENERATED:attack-roster -->
