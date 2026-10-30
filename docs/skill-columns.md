# Skill Table Columns — What Each Header Means

> A view, not a source: `tools/data/skills.json` (`meta.*` + each row) owns every number, `engine/skills.ts` is the sole calculator called by both the client and the cages — the numbers you see in the table are the numbers the game actually runs (`AGENTS.md: tools/data/*.json` + `engine/`). Nothing below invents tuning; follow the links when a value matters.

## 15-Column Summary

| Header | Field in data | What it means | Rule / how it is used |
|---|---|---|---|
| **Skill** | `id` / `name` `skills.json:270` | The skill's canonical key `engine/skills.ts:105` `byId` | Retired rows stay in `byId` so old saves still resolve, but they never drop again |
| **Type** | `type` `skills.json:39` | `attack` / `buff` / `curse` / `heal` / `aura` (`type_meta` `skills.json:46`) | `attack`=goes in the order list, pays `cd+mana`; `buff`=timed self-buff with `duration`, ends between fights; `curse`=attached to target, same `hit_chance` as attacks; `heal`=same list but lands on the player (drip or instant restore, never a mob target); `aura`=reserves `Reserve Max Mana`, no cd |
| **Shape** | `area.shape` `skills.json:702` | Footprint shape: `circle` (default if omitted) / `cone` / `line` | `cone` requires `angle_deg`, `line` requires `length_m`×`width_m` (`engine/skill-area.ts:38`); line/cone membership reads the committed cast direction, never the camera |
| **Delivery** | `cast.delivery` `skills.json:281` | How the hit is delivered: `instant` / `melee` / `projectile` / `ground` | Picks `meta.action_profiles` `skills.json:9` as the default `windup/recovery/hit_radius/projectile_speed` unless the row overrides it |
| **Target** | `targets` (`"1"/"3"`) + `area` | Roster label the player sees (`Single Enemy / Enemies in Area / All Enemies Around Me / Self`) | `targets` is the offline queue approximation; live membership is the committed footprint rule below, not this label — a zero-radius line still reads `Single Enemy` in the column while hitting every body along its line |
| **Origin** | `area.origin` `skills.json:280` | Footprint anchor: `caster` / `target` (`spatial_targeting` `skills.json:5`) | `caster`=footprint around self — casts when a body enters `radius_m`; `target`=acquire within `cast.range_m`, then resolve around the committed center/direction. The snapshot is rebuilt at release from live positions; Split Shot keeps its release-committed target circle while the projectile travels — a later contact updates receipts, never the circle center |
| **Range** | `cast.range_m` | Acquisition range in meters: how far away the primary may be picked up | A line row acquires within its `length_m` instead; a caster-origin row uses its `radius_m` as the trip wire. If omitted, the engine uses its canonical center range for the skill group; basics resolve through `normal_attack.profiles` |
| **AoE** | `area.radius_m` | Circle radius for circle footprints — and the hop reach for chain rows | A positive radius hits every `living center` in the circle with no target-count cap. Zero radius with a `line` shape still hits every body along the line (`Impale`, `Piercing Shot`, `Fissure`); zero radius with no shape is the primary only. On `attack.chain_lightning` the same field is hop reach, not a circle |
| **CD** | `cd` in seconds | Base cooldown | `effCd = cd × (1-cdr%) × (1-ladder%)` `engine/skills.ts:192` ladder always applies first (`ladder` `skills.json:83`); cooldowns tick down on the cooldown haste lever (`game/src/sim/combat/skills.ts:1287`) |
| **Mana** | `mana: "N flat"` `skills.json:277` | Cost as flat mana (or `hp_cost` as flat current-HP, never both) | `engine/skills.ts:145` applies the canonical level cost step from `skills.json`; the same price applies to one target or many, paid once at valid release, and a cancelled windup pays nothing |
| **Hits** | `action` + `effects` (`hits` / `hit_pct` / `dot_dps`+`dot_sec`), rendered by `engine/skills.ts:379` `hitLineOf` | How many times one press lands | Two paths, one press, one cost/CD: a direct resolve aggregates (`resolvePreparedCast` multiplies the press by `hits × hit_pct%`); a row with `action` schedules its impacts instead — `projectile-burst` / `ground-pulse-burst` (staggered payloads), `whirlwind-channel` (caster-following pulses over `active_sec`), `blizzard-field` / `sand-field` (lingering field pulses), `chain-strike` (hops to the nearest unused living body in reach), `targeted-burst` (straight or homing payloads bound to one body) and `cluster-burst` (one parent impact splitting into authored children). Scheduled impacts share one roll/effect cache; C1 children and C3 payloads opt into independent rolls where their rows say so. A lone `hit_pct` with no `hits` (e.g. Sidestep accuracy) is not a repeat |
| **Dur** | `duration: "8 sec"` `skills.json:482` | How long the buff/field lasts, parsed off the row's own duration words | `buffEffectPct` scales a buff/aura effect's **strength**, never its duration (`engine/skills.ts:85-104`; duration comes from `buffCastOutcome` reading the row). Buff/aura values open whole and climb a higher ramp than `effect_pct`, rounded to whole numbers |
| **Windup** | `cast.windup_sec` | Whole windup: `fixed + variable` (`engine/skill-actions.ts:16-25`) | Only the variable part compresses under haste (`castSpeed` from `global_speed`, capped by `caps.speed_mult`); `fixed_windup_sec` never compresses. Windup and recovery keep their combat-step and animation phase floors from canonical engine data |
| **Fixed** | `cast.fixed_windup_sec` | Locked portion of the cast | Not hasted — total `windup = fixed + variable` as shown in `castProfileOf` `engine/skills.ts:110`; the readable commitment (F44) |
| **Recov** | `cast.recovery_sec` | Delay after release on its own haste lever | `recoverySpeed` compresses only the variable part above `fixed_recovery_sec`; recovery blocks the next primary cast but never re-prices it. Cancelling before release costs no `Mana/CD` (`docs/wiki/skills.html:610`) |

## Acquisition, footprint, hop range, child spread — four different numbers

They share no field; do not read one as the other:

- **Acquisition** (`cast.range_m`, or `length_m` for lines) answers "which primary may this cast pick up".
- **Footprint** (the committed `SkillAreaSnapshot`: shape + center + direction) answers "which bodies does this impact test" — circles test centers, lines/cones test the aimed shape, and the snapshot is fixed at release.
- **Hop range** (chain rows only, read off `area.radius_m`) answers "how far the next contact may jump" — nearest unused living body, stable id tie-break, one shared roll cache, one cost/CD, continuation after a resolved attempt even on a miss.
- **Child spread** (`action.kind: "cluster-burst"`, `spread_deg`) answers "where each child flies after the parent impact" — two children leave the parent's impact point at ±spread around the parent bearing, with the parent's travel and delay. The system is implemented but has **no live adopter** (`attack.double_strike` `skills.json:2600` is an unrelated melee row, not a cluster parent), so no live row spawns children today.

## Hit avoidance class

`hit_class` is authored for every canonical player and mob skill, separately from `type`, damage `basis`, weapon group, Element and `cast.delivery`.

| Value | Assignment rule |
|---|---|
| `attack` | Basic weapon actions and physical weapon or body strikes. A magic-weapon basic bolt is still an Attack action. |
| `spell` | Cast magic, curses and supernatural effects. Delivery can be melee, projectile, ground or instant. |
| `none` | Buffs, heals and auras with no hostile hit. |

Examples: Cleave is an active `attack` with physical basis and melee delivery; Fireball is an active `attack` type with `spell` hit class, magic basis and projectile delivery; Venom Spray is `spell` despite melee delivery; Ground Slam is `attack` despite its area. Class is explicit per row; do not infer it from type, basis, Element, name or delivery. When the player receives a hit, routing is strict: `attack` rolls Evasion, `spell` rolls Spell Dodge, and `none` rolls neither. Perfect Dodge applies to attack and spell; Ghost Dance also responds to Spell Dodge. `ignores_dodge` bypasses Perfect Dodge and the routed roll. `spell_dodge_pct` is a flat tree-only chance with a base of zero and a cap defined in `tools/data/engine.json`; the Wis-wing `keystone.spellward` grants Spell Dodge and reduces Evasion, with its values in `tools/data/tree.json`. Player casts still use the target mob's authored dodge because mobs have no Spell Dodge stat. A magic-weapon basic bolt still uses its profile's `attack` class, so a spell-shaped basic is an attack unless its profile says otherwise. DoT ticks do not make an incoming-hit roll.

## Default Delivery Profiles (`skills.json:9`)

`meta.action_profiles` owns each delivery's windup, recovery, impact delay, projectile speed and hit radius. The row can override its default with `cast.windup_sec`, `fixed_windup_sec` or `recovery_sec`; `fixed_*` lives per row, not per profile.

## Clocks that move a press

- **Player cast:** `global_speed` drives `castSpeed` (windup) and `recoverySpeed` (tail) independently; cooldowns tick on the third lever. All haste sits under `caps.speed_mult`.
- **Player basics:** attack-interval phases with the same animation floor; a released basic that kills an incidental primary still resolves its placed circle once, then ends (terminal release, no revival).
- **Mob clock** (`tools/data/engine.json`): rank clocks and the attack-interval cap are canonical data. A fast-clock lineage multiplies its own clock while its swing divides by the same factor, so DPS stays published.

## Mob kits (preserved, not redesigned)

Mob strikes replace the next basic swing for exactly that swing's damage. Projectile and ground mob casts are **release-tracked** (source/destination read at release; `game/src/sim/core/tick/mob-actions.ts:174-214`), while a **charge is windup-locked** (travels to the point frozen at windup, never the player's new feet; `:90-116`). No new facing-angle restrictions and no mob cone/line skills are authored — those need owner decisions and are not described here.

## Recorded but inactive

Sight-aware AoE acquisition and basic-shot contact-ordering findings stay recorded only; no unassigned navigation layout is activated by this document.

## Follow-up mechanics (C1–C4) — implemented behavior and limits

- **C1 cluster:** implemented as a data-driven `cluster-burst` action. One press splits its authored `parent_share_pct + child_count × child_share_pct` budget, children spawn at the parent impact point at ±`spread_deg` with the parent's travel and delay, overlap is allowed with independent per-impact rolls, and kill credit stays once. It has **no live adopter**: no roster row uses `cluster-burst` today.
- **C2 chains/reactions:** baseline preserved only — continuation after a resolved attempt, shared per-world-tick trigger guard, ordinary rewarded chain kills vs Profane Bloom's nonrecursive unrewarded secondaries (`game/src/sim/core/game.ts:670-713`). Invalid-hop quirks are recorded in `flights.ts:114-119` and were not changed.
- **C3 lock-on bursts:** `attack.double_strafe` (straight, physical/ranged/`attack`) and `attack.seeker_strafe` (homing, lightning/magic/`spell`) are live. Their payload count, interval, cost and homing bounds come from `tools/data/skills.json`; straight keeps the release-aim snapshot, homing tracks the bound body, and a dead or returned target fizzles the remaining payloads with no re-acquire. Each payload can be intercepted; contact receipts do not replace the action's intended body.
- **C4 spell dodge:** live. Incoming `attack` hits roll Evasion, `spell` hits roll the tree-only Spell Dodge stat, and `none` hits roll no dodge. Chance limits and the Spellward/Evasion tradeoff are authored in `tools/data/engine.json` and `tools/data/tree.json`. Perfect Dodge and Ghost Dance apply to spells; `ignores_dodge` bypasses Perfect Dodge and the routed roll. Player casts retain the target mob's existing dodge because mobs have no Spell Dodge stat. Live and offline incoming hits use the same routing.

## How to Read a Row

`attack.fireball` `skills.json:270`:
`Type=attack` · `Delivery=projectile` · `Origin=target` · `Range=cast.range_m` · `AoE=area.radius_m` · `CD=cd` · `Mana=mana` · `Windup=cast.windup_sec` · `Fixed=cast.fixed_windup_sec` · `Recov=cast.recovery_sec`

`attack.firestorm` `skills.json:318`:
`Origin=target` · `Delivery=ground` · `area.radius_m` · `cast.range_m` · `cast.windup_sec` · `cast.fixed_windup_sec` — a committed circle around an acquired target; the row owns the exact values.

`attack.chain_lightning` `skills.json:562`:
`targets` · `AoE` is the hop reach, not a circle · `action=chain-strike` — primary plus its authored number of hops to the nearest unused living bodies, with share and cadence read from the action; one cost/CD.

`attack.double_strafe` / `attack.seeker_strafe` `skills.json:2600`:
`action=targeted-burst` — straight payloads use the release aim; homing payloads track the same body within the row's pursuit bounds. Payload count, range, cadence, damage and cost are read from each canonical row; the press pays once.

`attack.piercing_shot` `skills.json:1495`:
`shape=line` · `length_m` · `width_m` — the Target column can read `Single Enemy` while the committed line holds every body along it.

## Quick Tuning Rules

* Change the feel → swap `delivery`
* Bigger circle → `area.radius_m`, longer reach → `cast.range_m`, move the explosion → swap `origin`
* Longer line → `length_m`, wider line → `width_m`, wider cone → `angle_deg`
* Chain reach → `area.radius_m` on a `chain-strike` row only; hop damage → `action.hop_share_pct`; cadence → `action.interval_sec`
* `CD / Mana / base_flat / eff` is the per-press price — true per-press damage is `(base_flat + eff%×power + max_hp_pct%×MaxHP) × damage_pct(Lv)` `engine/skills.ts:181`
* Never hand-write `Hits` — set `action` plus `effects: hits / hit_pct / dot_dps+dot_sec` and let `hitLineOf` render the `Hits` line
