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
| **Range** | `cast.range_m` | Acquisition range in meters: how far away the primary may be picked up | A line row acquires within its `length_m` instead; a caster-origin row uses its `radius_m` as the trip wire. If omitted, fallback `engine/skills.ts:116` `range[group \|\| melee]` = `2.1 melee / 5.2 ranged / 4.6 magic` (the legacy centre table; basics resolve through `normal_attack.profiles`) |
| **AoE** | `area.radius_m` | Circle radius for circle footprints — and the hop reach for chain rows | Circle `>0` hits every `living center` in the circle with no target-count cap. `0` with a `line` shape still hits every body along the line (`Impale`, `Piercing Shot`, `Fissure`); `0` with no shape is the primary only. On `attack.chain_lightning` the same field is the 3m hop reach between contacts, not a circle |
| **CD** | `cd` in seconds | Base cooldown | `effCd = cd × (1-cdr%) × (1-ladder%)` `engine/skills.ts:192` ladder always applies first (`ladder` `skills.json:83`); cooldowns tick down on the cooldown haste lever (`game/src/sim/combat/skills.ts:1287`) |
| **Mana** | `mana: "N flat"` `skills.json:277` | Cost as flat mana (or `hp_cost` as flat current-HP, never both) | `engine/skills.ts:145` `cost = N × (1+(Lv-1)×5%)` (`mana_level_step_pct` `skills.json:78`) same price on one target or many; paid once at valid release, and a cancelled windup pays nothing |
| **Hits** | `action` + `effects` (`hits` / `hit_pct` / `dot_dps`+`dot_sec`), rendered by `engine/skills.ts:379` `hitLineOf` | How many times one press lands | Two paths, one press, one cost/CD: a direct resolve aggregates (`resolvePreparedCast` multiplies the press by `hits × hit_pct%`); a row with `action` schedules its impacts instead — `projectile-burst` / `ground-pulse-burst` (staggered payloads), `whirlwind-channel` (caster-following pulses over `active_sec`), `blizzard-field` / `sand-field` (lingering field pulses), `chain-strike` (hops to the nearest unused living body in reach). Scheduled impacts share one roll/effect cache. A lone `hit_pct` with no `hits` (e.g. Sidestep accuracy) is not a repeat |
| **Dur** | `duration: "8 sec"` `skills.json:482` | How long the buff/field lasts, parsed off the row's own duration words | `buffEffectPct` scales a buff/aura effect's **strength**, never its duration (`engine/skills.ts:85-104`; duration comes from `buffCastOutcome` reading the row). Buff/aura values open whole and climb a higher ramp than `effect_pct`, rounded to whole numbers |
| **Windup** | `cast.windup_sec` | Whole windup: `fixed + variable` (`engine/skill-actions.ts:16-25`) | Only the variable part compresses under haste (`castSpeed` from `global_speed`, capped by `caps.speed_mult`); `fixed_windup_sec` never compresses. Neither phase finishes below the combat-step floor (`movement_step_sec` 0.05s) or the animation phase floor (0.1s) |
| **Fixed** | `cast.fixed_windup_sec` | Locked portion of the cast | Not hasted — total `windup = fixed + variable` as shown in `castProfileOf` `engine/skills.ts:110`; the readable commitment (F44) |
| **Recov** | `cast.recovery_sec` | Delay after release on its own haste lever | `recoverySpeed` compresses only the variable part above `fixed_recovery_sec`; recovery blocks the next primary cast but never re-prices it. Cancelling before release costs no `Mana/CD` (`docs/wiki/skills.html:610`) |

## Acquisition, footprint, hop range, child spread — four different numbers

They share no field; do not read one as the other:

- **Acquisition** (`cast.range_m`, or `length_m` for lines) answers "which primary may this cast pick up".
- **Footprint** (the committed `SkillAreaSnapshot`: shape + center + direction) answers "which bodies does this impact test" — circles test centers, lines/cones test the aimed shape, and the snapshot is fixed at release.
- **Hop range** (chain rows only, read off `area.radius_m`) answers "how far the next contact may jump" — nearest unused living body, stable id tie-break, one shared roll cache, one cost/CD, continuation after a resolved attempt even on a miss.
- **Child spread** answers nothing today: the C1 cluster system is decided but has **no live adopter** (`attack.double_strike` `skills.json:2600` is an unrelated melee row, not a cluster parent), so no row spawns children and no overlap rule is in force.

## Hit avoidance class

`hit_class` is authored for every canonical player and mob skill, separately from `type`, damage `basis`, weapon group, Element and `cast.delivery`.

| Value | Assignment rule |
|---|---|
| `attack` | Basic weapon actions and physical weapon or body strikes. A magic-weapon basic bolt is still an Attack action. |
| `spell` | Cast magic, curses and supernatural effects. Delivery can be melee, projectile, ground or instant. |
| `none` | Buffs, heals and auras with no hostile hit. |

Examples: Cleave is an active `attack` with physical basis and melee delivery; Fireball is an active `attack` type with `spell` hit class, magic basis and projectile delivery; Venom Spray is `spell` despite melee delivery; Ground Slam is `attack` despite its area. Class is explicit per row; do not infer it from type, basis, Element, name or delivery. This metadata records the dodge family for future hit resolution; by itself it changes no chance, roll or outcome (C4 is decided but not implemented — there is no `spell_dodge_pct`, no `keystone.spellward`, and resolution consumes no classification today).

## Default Delivery Profiles (`skills.json:9`)

| Delivery | Windup | Recovery | Impact delay | Projectile speed | Hit radius |
|---|---|---|---|---|---|
| `instant` | 0.15 | 0.15 | 0.00 | — | 0.45 |
| `melee` | 0.18 | 0.22 | 0.00 | — | 0.55 |
| `projectile` | 0.25 | 0.25 | 0.00 | 9.0 m/s | 0.35 |
| `ground` | 0.40 | 0.25 | 0.45 | — | 0.50 |

> If a row writes `cast.windup_sec / fixed_windup_sec / recovery_sec` itself, it overrides these defaults. `fixed_*` lives per row, not per profile.

## Clocks that move a press

- **Player cast:** `global_speed` drives `castSpeed` (windup) and `recoverySpeed` (tail) independently; cooldowns tick on the third lever. All haste sits under `caps.speed_mult`.
- **Player basics:** attack-interval phases with the same animation floor; a released basic that kills an incidental primary still resolves its placed circle once, then ends (terminal release, no revival).
- **Mob clock** (`engine.json:210`): normal and elite swing 1/sec, boss and unique 0.8/sec through the authored boss clock, capped at `1 / caps.attack_interval_sec` — the same ceiling the player obeys. A fast-clock lineage multiplies its own clock while its swing divides by the same number, so DPS stays published.

## Mob kits (preserved, not redesigned)

Mob strikes replace the next basic swing for exactly that swing's damage. Projectile and ground mob casts are **release-tracked** (source/destination read at release; `game/src/sim/core/tick/mob-actions.ts:174-214`), while a **charge is windup-locked** (travels to the point frozen at windup, never the player's new feet; `:90-116`). No new facing-angle restrictions and no mob cone/line skills are authored — those need owner decisions and are not described here.

## Recorded but inactive

Sight-aware AoE acquisition and basic-shot contact-ordering findings stay recorded only; no unassigned navigation layout is activated by this document.

## Decided but not live (C1–C4) — read as plans, not behavior

- **C1 cluster:** full system decided (budget split, overlap with per-impact rolls, 2-way ±30° spawn, parent footprint) with NO live adopter. Nothing in the roster uses it.
- **C2 chains/reactions:** preserve baseline only — continuation after a resolved attempt, shared per-world-tick trigger guard, ordinary rewarded chain kills vs Profane Bloom's nonrecursive unrewarded secondaries (`game/src/sim/core/game.ts:670-713`). Invalid-hop quirks are recorded in `flights.ts:114-119`, changed nothing.
- **C3 lock-on bursts:** two new filler rows (`Double Strafe` straight, `Seeker Strafe` homing) are specified, not authored — no live row behaves this way.
- **C4 spell dodge:** specified, not implemented — every row authors `hit_class` but no roll reads it.

## How to Read a Row

`attack.fireball` `skills.json:270`:
`Type=attack` · `Delivery=projectile` · `Origin=target` · `Range=5` · `AoE=0` · `CD=6` · `Mana=21 flat` · `Hits=-` · `Windup=0.3 Fixed=0.05 Recov=0.25`

`attack.firestorm` `skills.json:318`:
`Origin=target` · `AoE=3` · `Delivery=ground` · `Windup=0.5 Fixed=0.15` — 3m circle around a target acquired within 5m, hits everything inside.

`attack.chain_lightning` `skills.json:562`:
`targets=3` · `AoE=3` is the hop reach, not a circle · `action=chain-strike` — primary plus up to 2 hops to the nearest unused living bodies, 60% share each, one cost/CD.

`attack.piercing_shot` `skills.json:1495`:
`AoE=0` · `shape=line` `5×1` — the Target column reads `Single Enemy` but the committed 5m line holds every body along it.

## Quick Tuning Rules

* Change the feel → swap `delivery`
* Bigger circle → `area.radius_m`, longer reach → `cast.range_m`, move the explosion → swap `origin`
* Longer line → `length_m`, wider line → `width_m`, wider cone → `angle_deg`
* Chain reach → `area.radius_m` on a `chain-strike` row only; hop damage → `action.hop_share_pct`; cadence → `action.interval_sec`
* `CD / Mana / base_flat / eff` is the per-press price — true per-press damage is `(base_flat + eff%×power + max_hp_pct%×MaxHP) × damage_pct(Lv)` `engine/skills.ts:181`
* Never hand-write `Hits` — set `action` plus `effects: hits / hit_pct / dot_dps+dot_sec` and let `hitLineOf` render the `Hits` line
