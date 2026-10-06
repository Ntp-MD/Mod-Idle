<!-- BEGIN GENERATED:attack-heading -->
# 39 attack skills
<!-- END GENERATED:attack-heading -->

import glossary.md
import skill-pool.md

> Column "targets/hits" = targets struck / damage instances per single press · This number is what per-hit procs (Sonic Blow · Brute · Flurry · Jinx · stun from Alignment) count
> `eff cd` and `presses/sec` are computed from `cd` at the reference cast speed (`cdr_pct` / `ladder_pct` in `tools/data/skills.json` → `meta.formula.cast_reference`). Change a `cd` and rerun `node tools/skills.ts --write` to watch the rate move. For any build, run `node tools/skills.ts --calc --stat N --power N --level N --cdr N --ladder N`.

<!-- BEGIN GENERATED:attack-roster -->
| Skill | Group | Element | cd | eff cd | presses/sec | mana | Basis · final_pct (level 1) | Targets/Hits | Damage per press (glass / caster) | What it does |
|---|---|---|---|---|---|---|---|---|---|---|
| Arcane Pulse | magic | follow | 0 sec | 0.00 sec | the beat | 8% | magic · 103.19% | 1/1 | 750 / 3,581 | Uses the weapon Element · the caster's core press: no timer of its own, so mana and the beat are what gate it |
| Fireball | magic | fire | 6 sec | 2.10 sec | 0.48 | 14% | magic · 104.06% | 1/1 | 756 / 3,611 | Single target · applies 2 burn stacks |
| Flame Bolt | magic | fire | 5 sec | 1.75 sec | 0.57 | 11% | magic · 104.06% | 1/1 | 756 / 3,611 | Fast cheap fire bolt · 1 burn stack |
| Firestorm | magic | fire | 13 sec | 4.55 sec | 0.22 | 21 flat (AoE ×1.5) | magic · 105.81% | 3/1 | 769 / 3,672 | AoE firestorm · 1 burn stack to all hit |
| Meteor | magic | fire | 14 sec | 4.90 sec | 0.20 | 22 flat (AoE ×1.5) | magic · 105.81% | 3/1 | 769 / 3,672 | Heavy AoE slam · 2 burn stacks to all hit |
| Flame Wisp | magic | fire | 9 sec | 3.15 sec | 0.32 | 15% | magic · 104.06% | 1/1 | 756 / 3,611 | Single target · 3 burn stacks |
| Scorch Ray | magic | fire | 7 sec | 2.45 sec | 0.41 | 14% | magic · 104.06% | 1/1 | 756 / 3,611 | Heavy single hit · 2 burn stacks |
| Frost Bolt | magic | cold | 5 sec | 1.75 sec | 0.57 | 11% | magic · 104.06% | 1/1 | 756 / 3,611 | Fast cold bolt · 1 chill |
| Ice Shard | magic | cold | 6 sec | 2.10 sec | 0.48 | 13% | magic · 104.06% | 1/1 | 756 / 3,611 | Single target · 1 chill |
| Ice Lance | magic | cold | 8 sec | 2.80 sec | 0.36 | 14% | magic · 103.19% | 1/2 | 750 / 3,581 | 2 hits at 55% each · chills the target |
| Blizzard | magic | cold | 13 sec | 4.55 sec | 0.22 | 20 flat (AoE ×1.5) | magic · 104.06% | 3/1 | 756 / 3,611 | AoE storm · chills all hit |
| Frozen Orb | magic | cold | 10 sec | 3.50 sec | 0.29 | 16 flat (AoE ×1.5) | magic · 104.06% | 3/1 | 756 / 3,611 | Orb that chills all it touches |
| Frostbite | magic | cold | 8 sec | 2.80 sec | 0.36 | 14% | magic · 104.06% | 1/1 | 756 / 3,611 | +25% damage if the target is already chilled |
| Chain Lightning | magic | lightning | 9 sec | 3.15 sec | 0.32 | 16% (AoE ×1.5) | magic · 104.06% | 3/1 | 756 / 3,611 | Arcs to 3 targets · shocks all hit |
| Lightning Bolt | magic | lightning | 5 sec | 1.75 sec | 0.57 | 12% | magic · 104.06% | 1/1 | 756 / 3,611 | Fast single bolt · 1 shock |
| Spark | magic | lightning | 4 sec | 1.40 sec | 0.71 | 9% | magic · 103.19% | 1/1 | 750 / 3,581 | Cheapest fastest press · 1 shock |
| Thunder Strike | magic | lightning | 11 sec | 3.85 sec | 0.26 | 18 flat | magic · 105.81% | 1/1 | 769 / 3,672 | Heavy single hit · shocks the target (shock carries the 1 sec interrupt) |
| Storm Call | magic | lightning | 14 sec | 4.90 sec | 0.20 | 22 flat (AoE ×1.5) | magic · 105.81% | 3/1 | 769 / 3,672 | Big AoE storm · shocks all hit |
| Static Field | magic | lightning | 10 sec | 3.50 sec | 0.29 | 15% (AoE ×1.5) | magic · 104.06% | 3/1 | 756 / 3,611 | Field around self · shocks all hit |
| Poison Bolt | magic | poison | 6 sec | 2.10 sec | 0.48 | 13% | magic · 105.81% | 1/1 | 769 / 3,672 | Single target · 2 poison stacks |
| Venom Spray | magic | poison | 9 sec | 3.15 sec | 0.32 | 16% (AoE ×1.5) | magic · 105.81% | 3/1 | 769 / 3,672 | Spray · 1 poison stack to all hit |
| Acid Arrow | magic | poison | 7 sec | 2.45 sec | 0.41 | 14% | magic · 105.81% | 1/1 | 769 / 3,672 | Single target · 3 poison stacks |
| Toxic Cloud | magic | poison | 12 sec | 4.20 sec | 0.24 | 19 flat (AoE ×1.5) | magic · 105.81% | 3/1 | 769 / 3,672 | Lingering cloud · 2 poison stacks to all hit |
| Blight | magic | poison | 10 sec | 3.50 sec | 0.29 | 15 flat | magic · 105.81% | 1/1 | 769 / 3,672 | Heavy poison press · 4 poison stacks |
| Chaos Bolt | magic | chaos | 6 sec | 2.10 sec | 0.48 | 13% | magic · 103.19% | 1/1 | 750 / 3,581 | Single target · 1 mark stack |
| Void Blast | magic | chaos | 9 sec | 3.15 sec | 0.32 | 16% (AoE ×1.5) | magic · 103.19% | 3/1 | 750 / 3,581 | AoE blast · applies 1 mark stack to all hit |
| Nether Orb | magic | chaos | 12 sec | 4.20 sec | 0.24 | 19 flat | magic · 103.19% | 1/1 | 750 / 3,581 | This hit pierces 100% of the target's Elemental res |
| Entropy | magic | chaos | 10 sec | 3.50 sec | 0.29 | 15 flat | magic · 103.19% | 1/1 | 750 / 3,581 | Heavy press · applies 5 mark stacks |
| Cleave | melee | phys | 6 sec | 2.10 sec | 0.48 | 10% (AoE ×1.5) | phys · 142.84% | 3/1 | 4,784 / 995 | Swing around, hits all in range |
| Elemental Break | melee | phys | 10 sec | 3.50 sec | 0.29 | 18% | phys · 135.78% | 1/1 | 4,548 / 946 | Heavy hit + target takes +15% Element damage 8 sec (replaces Guard Break, which referenced a nonexistent system) |
| Whirlwind | melee | phys | 9 sec | 3.15 sec | 0.32 | 15% (AoE ×1.5) | phys · 145.19% | 3/3 | 4,863 / 1,011 | Spin 3 rounds, 1 hit per target per round · Per-target hit count = proc engine |
| Shield Bash | melee | phys | 8 sec | 2.80 sec | 0.36 | 12% | phys · 140.48% | 1/1 | 4,706 / 979 | Stops target attacks 1 sec (a flat stop, not a rolled stun chance) |
| Puncture | melee | phys | 7 sec | 2.45 sec | 0.41 | 12% | phys · 142.84% | 1/1 | 4,784 / 995 | Guarantees bleeding on the hit (100% bleed chance · bleed does not stack, a new hit refreshes its 5 sec) |
| Reap | melee | phys | 9 sec | 3.15 sec | 0.32 | 14 flat | phys · 140.48% | 1/1 | 4,706 / 979 | Leech +25% and physical power x1.10 for 6 sec · the window opens on the press and rides the skill's own duration |
| Bloodletting | melee | phys | 11 sec | 3.85 sec | 0.26 | 16 flat | phys · 142.84% | 1/1 | 4,784 / 995 | Instant heal 6% Max HP and leech +15% on the press |
| Piercing Shot | ranged | phys | 6 sec | 2.10 sec | 0.48 | 10% | phys · 145.19% | 1/1 | 4,863 / 1,011 | Single target · This hit does not roll dodge |
| Arrow Shower | ranged | phys | 7 sec | 2.45 sec | 0.41 | 13% | phys · 140.48% | 1/3 | 4,706 / 979 | 3 arrows, 40% each, 120% total of formula · Per-hit procs fire 3 times |
| Headshot | ranged | phys | 12 sec | 4.20 sec | 0.24 | 16% | phys · 138.13% | 1/1 | 4,627 / 962 | This hit +25% crit chance · Burst window for crit builds |
| Pierce the Veil | ranged | phys | 7 sec | 2.45 sec | 0.41 | 12 flat | phys · 138.13% | 1/1 | 4,627 / 962 | This hit does not roll dodge and strips the target's Elemental resistance -15% for 8 sec |

press = final_pct × basis × (1 + (skill_level − 1) × 1.5%) at skill level 20 (B5) — the two columns are the same press read on the two published reference builds:
glass = Str 12 · basis phys 2,607 · caster = Int 12 · basis magic 2,607 + elem 1,733.72 × Alignment 5.421428571428572% (94) = 2,701.
A phys-basis press can crit and a magic-basis one cannot, so neither column includes crit (formula.md section 0's DPS row does).
<!-- END GENERATED:attack-roster -->
