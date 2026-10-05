# Private Ideas - New Active Skills and Buffs (parking)

OWNER ONLY. Agents must not read, list, quote, or import anything here
unless the owner assigns the exact file path in chat.

Idea parking. Nothing here is decided, priced, or folded into `mob_HP`.
A row becomes design only when the owner moves it into `skills.json` and
records it in `harness/decisions.md`. `final_pct` are placeholders inside
the live bands — real values come from `tools/skills.js --calc`.

Press model: `press = final_pct × basis × level ramp`
(`owner/ideas-attack-scaling-basis.md`). Bands: phys 135.8-145.2 · magic
102.3-105.8.

**Mana is a flat unit, not a percentage.** Costs are anchored to the
**level-1 pool of 100 mana** (300 HP alongside it), so a 15-cost skill is
15 units against 100 at the start, not 15% of a pool that later reaches
4,848. A flat cost is deliberately cheap in the late game and tight in the
first minutes, which is the pressure the early game wants.

Checked against the level-1 bar: all 20 skills together demand 297 mana
across 193 sec of cooldown = 1.5 mana/sec, and Int-12 regen is 1.8/sec, so
the whole bar runs on regen alone without touching the pool.

# New skill

## Reap (active)
- `leech` +25% and `physical_power` x1.10 while up
- duration none
- cooldown 9 sec
- mana 14
- melee, physical basis, 140%, 1 target · the leech buff lasts 6 sec

## Bloodletting (active)
- `heal_instant` 6% of Max HP and `leech` +15%
- duration none
- cooldown 11 sec
- mana 16
- melee, physical basis, 142%, 1 target

## Pierce the Veil (active)
- `ignores_dodge` and `mob_elemental_resistance_pct` -15
- duration none
- cooldown 7 sec
- mana 12
- ranged, physical basis, 138%, 1 target · the strip lasts 8 sec

## Widow Strike (active)
- `mob_elemental_damage_taken_pct` +25
- duration none
- cooldown 10 sec
- mana 14
- ranged, physical basis, 136%, 1 target · lasts 8 sec, and only applies while the target is chilled

## Volley of Blades (active)
- `hits` 5 x `hit_pct` 30% = 150% of one basis
- duration none
- cooldown 12 sec
- mana 20 (AoE x1.5)
- melee, physical basis, 145%, hits 3 targets · per-hit procs fire five times

## Impale (active)
- `hits` 3 x `hit_pct` 50% = 150% of one basis
- duration none
- cooldown 8 sec
- mana 14
- melee, physical basis, 143%, 1 target · per-hit procs fire three times

## Concussive Blow (active)
- `stop_sec` 1
- duration none
- cooldown 10 sec
- mana 15
- melee, physical basis, 138%, 1 target · `bypasses_control_cap`, uses no chance so it never hits the 15% stun Cap

## Sunder Strike (active)
- `mob_elemental_resistance_pct` -25
- duration none
- cooldown 11 sec
- mana 15
- melee, physical basis, 137%, 1 target · lasts 8 sec

## Brittle Target (active)
- `mob_elemental_damage_taken_pct` +20
- duration none
- cooldown 9 sec
- mana 13
- any weapon, physical basis, 139%, 1 target · lasts 8 sec

## Feint (active)
- `crit_chance` +30 on this press
- duration none
- cooldown 12 sec
- mana 14
- any weapon, physical basis, 136%, 1 target · the window is the press only, not a buff

## Retaliate (active)
- x1.00 + `damage_per_dodge_pct` 4 per 1% dodge chance, Cap +150%
- duration none
- cooldown 10 sec
- mana 15
- melee, physical basis, 141%, 1 target
- near-duplicate of the live `Riposte` (x1.00 + 3 per 1%, Cap +120%) — one boss path for the dodge build, cut one on the write

## Overreach (active)
- x1.00 at full HP rising to x2.2 at `missing_hp_pct_for_max` 60
- duration none
- cooldown 11 sec
- mana 16
- any weapon, physical basis, 140%, 1 target · the live `Retribution` peaks x2.0 at 50%

## Echo Strike (active)
- `hits` 2 x `hit_pct` 60% = 120% of one basis
- duration none
- cooldown 8 sec
- mana 13
- any weapon, physical basis, 140%, 1 target · per-hit procs fire twice

## Momentum (active)
- `attack_speed` +20% while up
- duration none
- cooldown 9 sec
- mana 12
- ranged, physical basis, 138%, 1 target · the speed buff itself lasts 6 sec

## Pyre Burst (active)
- `burn_stacks` +5
- duration none
- cooldown 8 sec
- mana 15
- magic, fire, 104%, 1 target · the live `Flame Lash` applies 3

## Plague Spit (active)
- `poison_stacks` +4 and `bleed_chance` +40%
- duration none
- cooldown 9 sec
- mana 16
- magic, poison, 105%, 1 target · the live `Toxic Spray` gives 2 stacks to 3 targets

## Thunderhead (active)
- `stop_sec` 1 on every target, `guaranteed_status` shock
- duration none
- cooldown 9 sec
- mana 16 (AoE x1.5)
- magic, lightning, 104%, hits 3 targets · `every_target`, so the shock and the stop both reach all three

## Glacial Nail (active)
- `stop_sec` 1 on every target, `guaranteed_status` chill
- duration none
- cooldown 10 sec
- mana 15
- magic, cold, 104%, hits 3 targets · `every_target`, same shape as `Thunderhead`

## Reality Rift (active)
- `resistance_pierce_pct` 100 and `spread_targets` 2
- duration none
- cooldown 12 sec
- mana 18
- magic, chaos, 103%, 1 target · the live `Pandemonium` spreads to 3

## Arcane Surge (active)
- `mana_regen` +25% and `attack_speed` +15% while up
- duration none
- cooldown 8 sec
- mana 14
- magic, follows the weapon Element, 102%, 1 target · both buffs last 6 sec

## Overdrive Flow (buff)
- `magic_power` x1.30 and `skill_mana_cost` x1.50 while up
- duration 10 sec
- cooldown 20 sec
- mana 12
- measured 77% of base magic DPS over its cycle: mana regen covers only 15% of a six-skill rotation's bill, so the extra cost comes straight off the press count, and break-even is +30% cost
- needs two stat words that do not exist yet — `magic_power` and `skill_mana_cost`. `EFFECT_STATS` carries `physical_power` only, and `player.ts:227` builds magic from gear lines while ignoring effects. Cost is parsed from the row's own `mana` string at `engine/skills.js:34` and applied at `game.ts:499`. Cannot ship with the rest
