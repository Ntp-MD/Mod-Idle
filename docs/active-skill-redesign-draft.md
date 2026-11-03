# Active skill effect and capability draft

**Status:** Draft only. This file does not change game behavior.

Shared mechanic implementation and gates live in the [mechanic plan](active-skill-mechanics-plan.md). This file owns per-skill proposals and the later skill adjustment rollout.

**Scope:** All current skill rows in `tools/data/skills.json` (`skills` array): 86 skills — 50 attacks, 18 auras, 9 buffs, 6 curses, 3 heals. Retired rows (see `retired_to` in `skills.json`) and test fixtures are excluded. Rows tagged PROPOSED NEW are not in `skills.json`; rows tagged Proposed RETIRE are still counted in the 86 until approved.

`Current effect` copies each row's `effect` text. `New effect` and `Proposed capability` are blank for review and editing. Capability fields below break down targeting, anchor, impact-area shape, range, delivery, and other player-facing behavior into explicit columns.

`Hits` is a read-only snapshot rendered by `hitLineOf` from `action` + `effects` — never hand-write it. `Cast / Recovery: profile default (X)` means the row sets no timing override and runs on `meta.action_profiles[X]`. The `effect` text is not the full mechanical implementation. Actual behavior may also live in `effects`, `rules`, `action`, `area`, and `cast` fields. Keep all game data unchanged until this draft is reviewed. After approval, map accepted changes to their canonical fields.

Visual descriptions follow [skill VFX prompts](../art-reference/vfx/base-prompt.md).

---

## Attacks — 50

### `attack.acid_arrow` — Acid Arrow

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** projectile
- **Range:** 4.6m
- **Impact area:** primary only (radius 0)
- **Element:** poison
- **Mana / Reservation:** Mana 21 flat
- **Cast / Recovery:** profile default (projectile): cast 0.25s + recovery 0.25s
- **Duration:** —
- **Hits:** 1
- **Current:** Applies 3 poison stacks.
- **New effect:** —
- **Proposed capability:** —

### `attack.aftershock` — Aftershock

- **Type:** attack
- **Target:** Surround
- **Anchor:** caster
- **Delivery:** ground
- **Range:** 3m
- **Impact area:** circle r3m · authored max 3
- **Element:** earth
- **Mana / Reservation:** Mana 22 flat
- **Cast / Recovery:** cast 0.45s + fixed floor 0.1s + recovery 0.25s
- **Duration:** 6 sec
- **Hits:** 1
- **Current:** +25% damage against crippled targets. Grants +20% armour.
- **New effect:** Same cripple-payoff + 6s +20% armour window, but press base_flat 850→920 and eff 100→108 so solo (no cripple) stops being ~8% below the AoE line. With cripple it goes 152→~165 solo, ~206 with +25% — still a setup reward, just less dead without Earth Shock.
- **Proposed capability:** Keep anchor/target/range/area/cd 12/mana 22/cast/duration/rules (`every_target + self_window`). Update `base_flat: 850→920`, `eff: 100→108`. Verify pair DPS with Earth Shock, not solo.

### `attack.arrow_shower` — Arrow Shower

- **Type:** attack
- **Target:** Enemies in Area (proposed; was Single Enemy)
- **Anchor:** target
- **Delivery:** projectile
- **Range:** 5m
- **Impact area:** circle r3m · authored max 3 (proposed; was primary only radius 0)
- **Element:** physical
- **Mana / Reservation:** Mana 19 flat
- **Cast / Recovery:** cast 0.35s + fixed floor 0.05s + recovery 0.25s
- **Duration:** 3 sec (proposed; was —)
- **Hits:** 12 (proposed; was 3)
- **Current:** Each arrow can trigger effects.
- **New effect:** 3 sec arrow field — 12 hits at 0.25s interval in 3m circle. Each arrow can trigger effects. Per-hit ~7% (hit_pct ~7, total ~84%) so single-target lands near Cleave/Ground Slam AoE line instead of +16-20% above; pack damage scales by live targets in circle.
- **Proposed capability:** Keep anchor/range/element/cd 7/mana 19/cast. Update `area: { origin: target, radius_m: 3, max_targets: 3 }`, `offline_targets: 1→3`, `duration: 3s` + `action: { kind: projectile-burst, roll_policy: shared, interval_sec: 0.25 }` with `effects: hits 12 + hit_pct ~7`, `rules: every_target`. Verify with `tools/skills.ts --calc` (≈4617/cast ≈1884/s single at CDR50+ladder30) + pack clear vs Cleave; retune base_flat/eff down 10-12% if over.

### `attack.backstab` — Backstab

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** melee
- **Range:** 2m
- **Impact area:** primary only (radius 0)
- **Element:** physical
- **Mana / Reservation:** Mana 27 flat
- **Cast / Recovery:** cast 0.25s + fixed floor 0.05s + recovery 0.22s
- **Duration:** —
- **Hits:** 1
- **Current:** +25% crit chance on this press.
- **New effect:** —
- **Proposed capability:** —

### `attack.blizzard` — Blizzard

- **Type:** attack
- **Target:** Enemies in Area
- **Anchor:** target
- **Delivery:** ground
- **Range:** 5m
- **Impact area:** circle r3m · authored max 3
- **Element:** cold
- **Mana / Reservation:** Mana 20 flat
- **Cast / Recovery:** cast 2.5s + fixed floor 0.5s + recovery 0.25s (proposed; was cast 0.5s + fixed floor 0.15s + recovery 0.25s)
- **Duration:** 4 sec (proposed; was 8 sec)
- **Hits:** 16 (proposed; was 20)
- **Current:** Chills everything it touches.
- **New effect:** 4 sec field — 16 hits at 0.25s interval. Every hit chills. Per-hit ~6% (hit_pct ~6, total ~96-100%). WARNING: cast 2.5+0.5 locks the caster 3.25s of every 4.9s cycle — the row's own `--calc` rate is cd-gated so its line barely moves, but the other 15 rotation slots starve. Size the press by simmed ROTATION dps with/without the row: starting point base_flat 999.8→~1800-2000 and eff 117.83→~210-235 (≈+90%), or cut windup to ~1.2-1.5s. Pick one direction, then measure — do not lock the % from this note.
- **Proposed capability:** Keep anchor/target/range/area (target / ground / 5m / circle r3m max 3) and cd 13 / mana 20 flat. Update `cast: { windup_sec: 2.5, fixed_windup_sec: 0.5, recovery_sec: 0.25 }`, `duration: 4s` + `action: { kind: blizzard-field, roll_policy: shared, interval_sec: 0.25 }` with `effects: hits 16 + hit_pct ~6`, `rules: guaranteed_status + every_target`. Offline_targets stays 3. Verify with `tools/skills.ts --calc` alongside Meteor + rotation lock maths before locking base_flat/eff.

### `attack.chain_lightning` — Chain Lightning

- **Type:** attack
- **Target:** Enemies in Area
- **Anchor:** target
- **Delivery:** instant
- **Range:** 5m
- **Impact area:** circle r3m · authored max 3
- **Element:** lightning
- **Mana / Reservation:** Mana 24 flat
- **Cast / Recovery:** cast 0.3s + fixed floor 0.05s + recovery 0.15s
- **Duration:** —
- **Hits:** 1
- **Current:** Shocks everything it reaches.
- **New effect:** —
- **Proposed capability:** —

### `attack.chaos_bolt` — Chaos Bolt

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** projectile
- **Range:** 4.6m
- **Impact area:** primary only (radius 0)
- **Element:** chaos
- **Mana / Reservation:** Mana 19 flat
- **Cast / Recovery:** profile default (projectile): cast 0.25s + recovery 0.25s
- **Duration:** —
- **Hits:** 1
- **Current:** Applies 1 mark stack.
- **New effect:** —
- **Proposed capability:** —

### `attack.void_orb` — Void Orb (PROPOSED NEW — not in `skills.json`)

- **Type:** attack
- **Target:** Enemies in Area
- **Anchor:** caster
- **Delivery:** projectile
- **Range:** 5m
- **Impact area:** primary only (radius 0) — reach comes from `pursuit_range_m: 5` in `action`, not footprint (gate: `targeted-burst` requires radius 0, `data-validation.test.ts:85`)
- **Element:** chaos
- **Mana / Reservation:** Mana 22 flat
- **Cast / Recovery:** cast 0.3s + fixed floor 0s + recovery 0.25s
- **Duration:** —
- **Hits:** 6 (proposed; 1 orb per target, ~17% each, total ~102% — pack splitter, weak solo by design)
- **Current:** — (new row, no current text)
- **New effect:** Six void orbs hunt six DIFFERENT bodies around you (5m) — random pick, never the same target twice; leftovers fizzle when bodies run out (per-orb, not the whole volley like Seeker). Everything touched takes 1 mark stack for Unravel. Replaces the Schism fracture draft: same pack-splitter job, homing instead of fan.
- **Proposed capability:** New row `attack.void_orb`: `hit_class: spell, type: attack, group: magic, element: chaos, cd: 10, mana: 22 flat, basis: magic, offline_targets: 3`, `area: { origin: caster, radius_m: 0 }`, `cast: { delivery: projectile, range_m: 5, windup_sec: 0.3, fixed_windup_sec: 0, recovery_sec: 0.25 }`, `action: { kind: targeted-burst, roll_policy: independent, tracking: homing, interval_sec: 0.1, pursuit_range_m: 5, pursuit_sec: 0.8, distinct_targets: true }` (new param — reader required), `rules: [every_target]`, `effects: [{ stat: hits, op: add_flat, value: 6, subject: self }, { stat: hit_pct, op: add_pct, value: 17, subject: self }, { stat: mark_stacks, op: add_flat, value: 1, subject: target }]`, `base_flat: 700, eff: 85`. NEEDS ENGINE WORK: distinct-target acquisition for `targeted-burst` (visited-set like `chain-strike:1017`, one orb per body; dead body fizzles its orb only). Verify volley pacing + fizzle behaviour in sim before locking hit_pct.

### `attack.chaos_wave` — Chaos Wave

- **Type:** attack
- **Target:** Surround
- **Anchor:** caster
- **Delivery:** instant
- **Range:** 3m
- **Impact area:** circle r3m · authored max 3
- **Element:** chaos
- **Mana / Reservation:** Mana 24 flat
- **Cast / Recovery:** cast 0.3s + fixed floor 0.05s + recovery 0.15s
- **Duration:** —
- **Hits:** 1
- **Current:** Marks every enemy around you.
- **New effect:** Same instant surround + 1 mark, but press base_flat 550→630 and eff 100→115 so it sits on the magic AoE line (~165/s at cdr0) with its 3 nova siblings instead of ~13% below. Fast-cast identity unchanged.
- **Proposed capability:** Keep anchor/target/range/area/cd 10/mana 24/instant cast. Update `base_flat: 550→630`, `eff: 100→115`. Verify as a set of 3 with `--calc` (frost/cinder/chaos — thunder left for the Meteor/Blizzard template).

### `attack.cinder_nova` — Cinder Nova

- **Type:** attack
- **Target:** Surround
- **Anchor:** caster
- **Delivery:** instant
- **Range:** 3m
- **Impact area:** circle r3m · authored max 3
- **Element:** fire
- **Mana / Reservation:** Mana 24 flat
- **Cast / Recovery:** cast 0.3s + fixed floor 0.05s + recovery 0.15s
- **Duration:** —
- **Hits:** 1
- **Current:** Burns every enemy around you.
- **New effect:** Same instant surround burn, but press base_flat 550→630 and eff 100→115 so it sits on the magic AoE line with its 3 nova siblings. Fast-cast identity unchanged.
- **Proposed capability:** Keep anchor/target/range/area/cd 10/mana 24/instant cast. Update `base_flat: 550→630`, `eff: 100→115`. Verify as a set of 3 with `--calc` (frost/cinder/chaos).

### `attack.cleave` — Cleave

- **Type:** attack
- **Target:** Enemies in Area
- **Anchor:** caster
- **Delivery:** melee
- **Range:** 2.1m
- **Impact area:** cone 160deg r2.1m · authored max 2
- **Element:** physical
- **Mana / Reservation:** Mana 15 flat
- **Cast / Recovery:** profile default (melee): cast 0.18s + recovery 0.22s
- **Duration:** —
- **Hits:** 1
- **Current:** A 120° sweeping swing — one hit to every enemy in front of you.
- **New effect:** —
- **Proposed capability:** —

### `attack.hemotoxin` — Hemotoxin (PROPOSED NEW — not in `skills.json`)

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** projectile
- **Range:** 4.6m
- **Impact area:** primary only (radius 0)
- **Element:** poison
- **Mana / Reservation:** HP 20 flat (proposed; pays current HP, leaves 1 — only the test row uses `hp_cost` today)
- **Cast / Recovery:** cast 0.4s + fixed floor 0.05s + recovery 0.25s
- **Duration:** —
- **Hits:** 1
- **Current:** — (new row, no current text)
- **New effect:** Blood for venom — pays 20 current HP for one massive envenomed bolt carrying 5 poison stacks. Poison's only HP-price nuke: frees the mana rotation, taxes the HP pool instead (leech/regen economy, not mana, is the limiter).
- **Proposed capability:** New row `attack.hemotoxin`: `hit_class: spell, type: attack, group: magic, element: poison, cd: 12, hp_cost: 20 flat, basis: magic, offline_targets: 1`, `area: { origin: target, radius_m: 0 }`, `cast: { delivery: projectile, range_m: 4.6, windup_sec: 0.4, fixed_windup_sec: 0.05, recovery_sec: 0.25 }`, `effects: [{ stat: poison_stacks, op: add_flat, value: 5, subject: target }]`, `base_flat: 900, eff: 105`. All vocabulary works today (`hp_cost` reader exists). Verify HP math at low-HP builds + pair with Venom Bind (5 fresh stacks held = full DoT window).

### `attack.double_strafe` — Double Strafe

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** projectile
- **Range:** 5m
- **Impact area:** primary only (radius 0)
- **Element:** physical
- **Mana / Reservation:** Mana 15 flat
- **Cast / Recovery:** cast 0.3s + fixed floor 0s + recovery 0.25s
- **Duration:** —
- **Hits:** 3
- **Current:** Three straight bolts along the release aim; each payload checks range and can be intercepted.
- **New effect:** Same 3 bolts, each ~33% (was 40%). Total ~0.99× so it mirrors Seeker Strafe as a sidegrade: straight+interceptable vs homing+fizzle, same maths.
- **Proposed capability:** Keep anchor/target/range/area/cd 6/mana 15/cast. Update `effects: hits 3 + hit_pct 40→33`. Verify with `--calc` alongside Seeker (both ~1950/s at CDR50+ladder30).

### `attack.double_strike` — Double Strike

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** melee
- **Range:** 2m
- **Impact area:** primary only (radius 0)
- **Element:** physical
- **Mana / Reservation:** Mana 12 flat
- **Cast / Recovery:** cast 0.15s + fixed floor 0s + recovery 0.22s
- **Duration:** —
- **Hits:** 2
- **Current:** A pair of quick blows.
- **New effect:** Same 2 blows, each ~50% (was 60%). Total ~1.0× so the fastest filler (cd 5) stops floating +13% above the heavy band.
- **Proposed capability:** Keep anchor/target/range/area/cd 5/mana 12/cast. Update `effects: hits 2 + hit_pct 60→50`. Verify with `--calc` (target ~2180/s at CDR50+ladder30, down from 2612).

### `attack.unravel` — Unravel (PROPOSED NEW — not in `skills.json`)

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** projectile
- **Range:** 4.6m
- **Impact area:** primary only (radius 0)
- **Element:** chaos
- **Mana / Reservation:** Mana 24 flat
- **Cast / Recovery:** cast 0.5s + fixed floor 0.1s + recovery 0.25s
- **Duration:** —
- **Hits:** 1
- **Current:** — (new row, no current text)
- **New effect:** The mark detonator chaos never had — unravels EVERY mark stack on the target into raw chaos in one press. Flay/Wave/Blast stack marks, Unravel spends them; spending ends the mark-leech window, so sustain vs burst is a real rotation choice. NEEDS ENGINE WORK: first user of `consume_status` (gated vocabulary, no reader today — engine + sim + offline must implement spend-all-marks).
- **Proposed capability:** New row `attack.unravel`: `hit_class: spell, type: attack, group: magic, element: chaos, cd: 13, mana: 24 flat, basis: magic, offline_targets: 1`, `area: { origin: target, radius_m: 0 }`, `cast: { delivery: projectile, range_m: 4.6, windup_sec: 0.5, fixed_windup_sec: 0.1, recovery_sec: 0.25 }`, `effects: [{ stat: consume_status, status: mark, op: add_flat, value: 100, subject: target }]`, `base_flat: 1000, eff: 115` (nuke tier — the press must justify eating the whole stack plus the lost leech). Verify detonate scaling per stack count before locking press.

### `attack.earth_shock` — Earth Shock

- **Type:** attack
- **Target:** Enemies in Area
- **Anchor:** target
- **Delivery:** ground
- **Range:** 5m
- **Impact area:** circle r3m · authored max 3
- **Element:** earth
- **Mana / Reservation:** Mana 19 flat
- **Cast / Recovery:** cast 0.5s + fixed floor 0.15s + recovery 0.25s
- **Duration:** —
- **Hits:** 1
- **Current:** Applies cripple.
- **New effect:** —
- **Proposed capability:** —

### `attack.earth_splitter` — Earth Splitter

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** ground
- **Range:** 5m
- **Impact area:** primary only (radius 0)
- **Element:** earth
- **Mana / Reservation:** Mana 18 flat
- **Cast / Recovery:** cast 0.4s + fixed floor 0.1s + recovery 0.25s
- **Duration:** —
- **Hits:** 1
- **Current:** Adds 15% of the target's maximum pool as damage, halved against bosses.
- **New effect:** —
- **Proposed capability:** —

### `attack.elemental_break` — Elemental Break

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** melee
- **Range:** 2m
- **Impact area:** primary only (radius 0)
- **Element:** physical
- **Mana / Reservation:** Mana 27 flat
- **Cast / Recovery:** cast 0.25s + fixed floor 0.05s + recovery 0.22s
- **Duration:** 8 sec
- **Hits:** 1
- **Current:** The target takes +15% elemental damage.
- **New effect:** —
- **Proposed capability:** —

### `attack.fireball` — Fireball

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** projectile
- **Range:** 5m
- **Impact area:** primary only (radius 0)
- **Element:** fire
- **Mana / Reservation:** Mana 21 flat
- **Cast / Recovery:** cast 0.3s + fixed floor 0.05s + recovery 0.25s
- **Duration:** —
- **Hits:** 1
- **Current:** Applies 2 burn stacks.
- **New effect:** —
- **Proposed capability:** —

### `attack.firestorm` — Firestorm

- **Type:** attack
- **Target:** Enemies in Area
- **Anchor:** target
- **Delivery:** ground
- **Range:** 5m
- **Impact area:** circle r3m · authored max 3
- **Element:** fire
- **Mana / Reservation:** Mana 21 flat
- **Cast / Recovery:** cast 0.5s + fixed floor 0.15s + recovery 0.3s
- **Duration:** —
- **Hits:** 1
- **Current:** Applies 1 burn stack.
- **New effect:** —
- **Proposed capability:** —

### `attack.fissure` — Fissure

- **Type:** attack
- **Target:** Enemies in Area
- **Anchor:** caster
- **Delivery:** ground
- **Range:** 6m
- **Impact area:** line 6x1m · authored max 6
- **Element:** earth
- **Mana / Reservation:** Mana 22 flat
- **Cast / Recovery:** cast 0.5s + fixed floor 0.1s + recovery 0.25s
- **Duration:** —
- **Hits:** 1
- **Current:** Rends a line, stopping enemies for 1 sec.
- **New effect:** —
- **Proposed capability:** —

### `attack.frost_nova` — Frost Nova

- **Type:** attack
- **Target:** Surround
- **Anchor:** caster
- **Delivery:** instant
- **Range:** 3m
- **Impact area:** circle r3m · authored max 3
- **Element:** cold
- **Mana / Reservation:** Mana 24 flat
- **Cast / Recovery:** cast 0.3s + fixed floor 0.05s + recovery 0.15s
- **Duration:** —
- **Hits:** 1
- **Current:** Chills every enemy around you.
- **New effect:** Same instant surround chill, but press base_flat 550→630 and eff 100→115 so it sits on the magic AoE line with its 3 nova siblings. Also the chill applier for the Shatter/Frostbite pair — no mechanic change.
- **Proposed capability:** Keep anchor/target/range/area/cd 10/mana 24/instant cast. Update `base_flat: 550→630`, `eff: 100→115`. Verify as a set of 3 with `--calc` (frost/cinder/chaos).

### `attack.frostbite` — Frostbite

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** instant
- **Range:** 5m
- **Impact area:** primary only (radius 0)
- **Element:** cold
- **Mana / Reservation:** Mana 21 flat
- **Cast / Recovery:** cast 0.2s + recovery 0.15s
- **Duration:** 8 sec
- **Hits:** 1
- **Current:** +25% damage against chilled targets.
- **New effect:** —
- **Proposed capability:** —

### `attack.glacial_spike` — Glacial Spike

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** projectile
- **Range:** 5m
- **Impact area:** primary only (radius 0)
- **Element:** cold
- **Mana / Reservation:** Mana 20 flat
- **Cast / Recovery:** cast 0.5s + fixed floor 0.15s + recovery 0.25s
- **Duration:** —
- **Hits:** 1
- **Current:** Stops the target for 1.5 sec.
- **New effect:** —
- **Proposed capability:** —

### `attack.ground_slam` — Ground Slam

- **Type:** attack
- **Target:** Surround
- **Anchor:** caster
- **Delivery:** melee
- **Range:** 3m
- **Impact area:** circle r3m · authored max 3
- **Element:** physical
- **Mana / Reservation:** Mana 15 flat
- **Cast / Recovery:** cast 0.25s + fixed floor 0.05s + recovery 0.22s
- **Duration:** —
- **Hits:** 1
- **Current:** Stops targets for 1 sec.
- **New effect:** —
- **Proposed capability:** —

### `attack.headshot` — Headshot

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** projectile
- **Range:** 5m
- **Impact area:** primary only (radius 0)
- **Element:** physical
- **Mana / Reservation:** Mana 24 flat
- **Cast / Recovery:** cast 0.55s + fixed floor 0.15s + recovery 0.25s
- **Duration:** —
- **Hits:** 1
- **Current:** +25% crit chance on this hit.
- **New effect:** —
- **Proposed capability:** —

### `attack.ice_lance` — Ice Lance

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** projectile
- **Range:** 5m
- **Impact area:** primary only (radius 0)
- **Element:** cold
- **Mana / Reservation:** Mana 21 flat
- **Cast / Recovery:** cast 0.3s + fixed floor 0.05s + recovery 0.25s
- **Duration:** —
- **Hits:** 2
- **Current:** Chills the target.
- **New effect:** —
- **Proposed capability:** —

### `attack.ignite` — Ignite

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** instant
- **Range:** 5m
- **Impact area:** primary only (radius 0)
- **Element:** fire
- **Mana / Reservation:** Mana 19 flat
- **Cast / Recovery:** cast 0.2s + recovery 0.15s
- **Duration:** —
- **Hits:** 1
- **Current:** Applies 5 burn stacks.
- **New effect:** —
- **Proposed capability:** —

### `attack.impale` — Impale

- **Type:** attack
- **Target:** Enemies in Area (proposed; was Single Enemy)
- **Anchor:** caster
- **Delivery:** melee
- **Range:** 6m (proposed; was 2m — line rows acquire within length_m, so range follows the line)
- **Impact area:** line 6x1m · authored max 6 (proposed; was 2x1 max 2, Fissure geometry)
- **Element:** physical
- **Mana / Reservation:** Mana 22 flat
- **Cast / Recovery:** cast 0.25s + fixed floor 0.05s + recovery 0.22s
- **Duration:** —
- **Hits:** 1
- **Current:** A line thrust that pierces 100% of the resistance it meets.
- **New effect:** Same thrust, Fissure-long — one 6m thrust piercing 100% of resistance on every target in the line. Thrust stays melee/fast (0.25s cast) vs Fissure's ground 0.5s; that speed is why the press below must come down harder than Fissure's.
- **Proposed capability:** Update `area: { origin: caster, radius_m: 0, shape: line, length_m: 6, width_m: 1, max_targets: 6 }`, `offline_targets: 1→3`, `cast.range_m: 2→6`; add `rules: every_target`. Heavy press must leave the single-heavy band: propose `base_flat: 3401.7→~2000-2200`, `eff: 87→~72-76` (≈5177/cast ≈1640/s single at CDR50+ladder30, −27% vs Piercing Shot — 6-wide line + pierce is the compensation). Verify with `--calc` vs Piercing Shot single + 6-deep pack before locking; pierce value scales with mob res, so test high-res targets too.

### `attack.meteor` — Meteor

- **Type:** attack
- **Target:** Enemies in Area
- **Anchor:** target
- **Delivery:** ground
- **Range:** 5m
- **Impact area:** circle r3m · authored max 3
- **Element:** fire
- **Mana / Reservation:** Mana 22 flat
- **Cast / Recovery:** cast 2.5s + fixed floor 0.5s + recovery 0.3s (proposed; was cast 0.6s + fixed floor 0.2s + recovery 0.3s)
- **Duration:** 4 sec (proposed; was —)
- **Hits:** 16 (proposed; was 1)
- **Current:** Applies 2 burn stacks.
- **New effect:** Impact + 4 sec burn field — 16 hits at 0.25s interval. First hit applies 2 burn stacks; field hits refresh burn window and can trigger on-hit effects. Per-hit ~6% (total ~96-100%). WARNING: cast 2.5+0.5 locks the caster 3.3s of every 4.9s cycle — the row's own `--calc` rate is cd-gated so its line barely moves, but the other 15 rotation slots starve. Size the press by simmed ROTATION dps with/without the row: starting point base_flat 1076.7→~1900-2150 and eff 126.9→~230-255 (≈+90%), or cut windup to ~1.2-1.5s. Pick one direction, then measure — do not lock the % from this note.
- **Proposed capability:** Keep anchor/target/range/area (target / ground / 5m / circle r3m max 3) and cd 14 / mana 22 flat. Update `cast: { windup_sec: 2.5, fixed_windup_sec: 0.5, recovery_sec: 0.3 }`, add `duration: 4s` + `action: { kind: meteor-field, roll_policy: shared, interval_sec: 0.25 }` with `effects: hits 16 + hit_pct ~6 + burn_stacks 2 (first hit)`, `rules: every_target`. Offline_targets stays 3. Verify pricing with `tools/skills.ts --calc` + rotation lock maths before locking base_flat/eff.

### `attack.overload` — Overload

- **Type:** attack
- **Target:** Enemies in Area
- **Anchor:** target
- **Delivery:** ground
- **Range:** 5m
- **Impact area:** circle r2.5m · authored max 2
- **Element:** lightning
- **Mana / Reservation:** Mana 24 flat
- **Cast / Recovery:** cast 0.45s + fixed floor 0.1s + recovery 0.25s
- **Duration:** —
- **Hits:** 2
- **Current:** +30% damage against shocked targets.
- **New effect:** Same shock-payoff 2×50% (total 1.0×, already correct), but press base_flat 850→920 and eff 105→113 so solo stops being ~6% below the AoE line. With shock it goes 155→~167 solo, ~217 with +30%.
- **Proposed capability:** Keep anchor/target/range/area/cd 12/mana 24/cast/hits 2×50%. Update `base_flat: 850→920`, `eff: 105→113`. Verify pair DPS with Chain/Thunder Strike, not solo.

### `attack.piercing_shot` — Piercing Shot

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** caster
- **Delivery:** projectile
- **Range:** 5m
- **Impact area:** line 5x1m · authored max 5
- **Element:** physical
- **Mana / Reservation:** Mana 15 flat
- **Cast / Recovery:** cast 0.35s + fixed floor 0.05s + recovery 0.25s
- **Duration:** —
- **Hits:** 1
- **Current:** A piercing shot along a line; this hit cannot be dodged.
- **New effect:** —
- **Proposed capability:** —

### `attack.contagion` — Contagion (PROPOSED NEW — not in `skills.json`)

- **Type:** attack
- **Target:** Enemies in Area
- **Anchor:** target
- **Delivery:** projectile
- **Range:** 4.6m
- **Impact area:** circle r3m · authored max 3
- **Element:** poison
- **Mana / Reservation:** Mana 22 flat
- **Cast / Recovery:** cast 0.4s + fixed floor 0.05s + recovery 0.25s
- **Duration:** —
- **Hits:** 1
- **Current:** — (new row, no current text)
- **New effect:** The poison spreader — one press copies the primary target's CURRENT poison stacks onto every enemy around it. Stack high on one body (Hemotoxin/Acid), Contagion shares it with the pack. Useless on a clean target, devastating on a stacked one. NEEDS ENGINE WORK: first user of `spread_status` (gated vocabulary, no reader today — engine + sim + offline must implement copy-stacks-to-footprint).
- **Proposed capability:** New row `attack.contagion`: `hit_class: spell, type: attack, group: magic, element: poison, cd: 11, mana: 22 flat, basis: magic, offline_targets: 3`, `area: { origin: target, radius_m: 3, max_targets: 3 }`, `cast: { delivery: projectile, range_m: 4.6, windup_sec: 0.4, fixed_windup_sec: 0.05, recovery_sec: 0.25 }`, `rules: [every_target]`, `effects: [{ stat: spread_status, status: poison, op: add_flat, value: 100, subject: target }]`, `base_flat: 700, eff: 85` (utility press — the stacks ARE the damage). Verify copy semantics (snapshot at release? refresh or overwrite?) before locking.

### `attack.poison_bolt` — Poison Bolt

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** projectile
- **Range:** 4.6m
- **Impact area:** primary only (radius 0)
- **Element:** poison
- **Mana / Reservation:** Mana 19 flat
- **Cast / Recovery:** profile default (projectile): cast 0.25s + recovery 0.25s
- **Duration:** —
- **Hits:** 1
- **Current:** Applies 2 poison stacks.
- **New effect:** —
- **Proposed capability:** —

### `attack.poison_cloud` — Poison Cloud

- **Type:** attack
- **Target:** Enemies in Area
- **Anchor:** target
- **Delivery:** ground
- **Range:** 5m
- **Impact area:** circle r3m · authored max 3
- **Element:** poison
- **Mana / Reservation:** Mana 24 flat
- **Cast / Recovery:** cast 0.45s + fixed floor 0.05s + recovery 0.25s
- **Duration:** —
- **Hits:** 1
- **Current:** 2 poison stacks. Leaves a toxic cloud.
- **New effect:** Same 2 poison stacks + 8s toxic cloud (15 poison dps), but press base_flat 600→730 and eff 80→97 so press+linger together (~1472→~1790 per cast) lands near Firestorm instead of ~11% below. No new behaviour, just number lift.
- **Proposed capability:** Keep anchor/target/range/area/cd 10/mana 24/cast/linger 15×8s. Update `base_flat: 600→730`, `eff: 80→97`. Verify with `--calc` + linger maths (press+120) and `--levels poison_cloud`.

### `attack.puncture` — Puncture

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** melee
- **Range:** 2m
- **Impact area:** primary only (radius 0)
- **Element:** physical
- **Mana / Reservation:** Mana 18 flat
- **Cast / Recovery:** cast 0.15s + fixed floor 0s + recovery 0.22s
- **Duration:** —
- **Hits:** 1
- **Current:** Guarantees bleed at 100% chance and refreshes its duration.
- **New effect:** —
- **Proposed capability:** —

### `attack.reap` — Reap

- **Type:** attack
- **Target:** Surround (proposed; was Single Enemy)
- **Anchor:** caster (proposed; was target)
- **Delivery:** melee
- **Range:** 3m (proposed; was 2m)
- **Impact area:** circle r3m · authored max 3 (proposed; was primary only radius 0)
- **Element:** physical
- **Mana / Reservation:** Mana 19 flat (proposed; was 14 flat)
- **Cast / Recovery:** cast 0.25s + fixed floor 0s + recovery 0.22s
- **Duration:** 6 sec
- **Hits:** 1
- **Current:** Leeches 25% and grants ×1.10 physical power.
- **New effect:** No leech. One swing hits every enemy around you (3m), slows them (attack speed −20%, same vocabulary as Cripple, 6s refreshed on hit) and grants ×1.10 physical power 6s self window.
- **Proposed capability:** Update `area: { origin: caster, radius_m: 3, max_targets: 3 }`, `offline_targets: 1→3`, `cast.range_m: 2→3`. Replace `effects: leech 25` with `effects: attack_speed −20 (target)` + keep `physical_power ×1.10 (self)`; add `rules: every_target` (keep `self_window`). Heavy press must come down to the phys AoE line: propose `base_flat: 3401.7→~2000-2200`, `eff: 87→~72-76` (≈5177/cast ≈1640/s single at CDR50+ladder30, −16% vs Cleave — slow + ×3 pack is the compensation). Verify with `tools/skills.ts --calc` vs Ground Slam/Cleave (single) + pack, and pair check that slow does not stack past chill/rimbo caps.

### `attack.sand_storm` — Sand Storm

- **Type:** attack
- **Target:** Enemies in Area
- **Anchor:** target
- **Delivery:** ground
- **Range:** 5m
- **Impact area:** circle r3m · authored max 3
- **Element:** earth
- **Mana / Reservation:** Mana 19 flat
- **Cast / Recovery:** cast 0.5s + fixed floor 0.15s + recovery 0.25s
- **Duration:** —
- **Hits:** 1
- **Current:** Blinds with −20% accuracy.
- **New effect:** —
- **Proposed capability:** —

### `attack.seeker_strafe` — Seeker Strafe

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** projectile
- **Range:** 5m
- **Impact area:** primary only (radius 0)
- **Element:** lightning
- **Mana / Reservation:** Mana 15 flat
- **Cast / Recovery:** cast 0.3s + fixed floor 0s + recovery 0.25s
- **Duration:** —
- **Hits:** 3
- **Current:** Three homing bolts track one body within 5m and 0.8s; a dead or returned target fizzles the rest.
- **New effect:** Proposed RETIRE — strafe role consolidates on Double Strafe (same 1450/68 press, same cd 6/mana 15, straight+interceptable vs homing+fizzle was not enough of a split). No number tuning; row leaves the active roster on approval. Supersedes the earlier basis→phys sidegrade proposal.
- **Proposed capability:** After approval set `retired: true, retired_to: attack.double_strafe` in `skills.json`; row drops out of this draft (retired rows excluded). Saves resolve via `byId`, no save migration. Leave VFX/icon shelf files parked (do not delete art). Verify: no `town.json` weight / test references to seeker remain.

### `attack.venom_coffin` — Venom Coffin (PROPOSED NEW — not in `skills.json`)

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** projectile
- **Range:** 4.6m
- **Impact area:** primary only (radius 0)
- **Element:** poison
- **Mana / Reservation:** Mana 22 flat
- **Cast / Recovery:** cast 0.4s + fixed floor 0.05s + recovery 0.25s
- **Duration:** 6 sec
- **Hits:** 1
- **Current:** — (new row, no current text)
- **New effect:** Seal the venom in — one press applies 3 poison stacks AND holds them from falling for 6s. Compresses Venom Bind's job into the hit itself, so the curse slot stays free for Cripple/Weaken/Expose. The patient poisoner's opener: Embalm, walk away, let DoT work.
- **Proposed capability:** New row `attack.venom_coffin`: `hit_class: spell, type: attack, group: magic, element: poison, cd: 12, mana: 22 flat, basis: magic, offline_targets: 1`, `area: { origin: target, radius_m: 0 }`, `cast: { delivery: projectile, range_m: 4.6, windup_sec: 0.4, fixed_windup_sec: 0.05, recovery_sec: 0.25 }`, `effects: [{ stat: poison_stacks, op: add_flat, value: 3, subject: target }, { stat: poison_hold_sec, op: add_flat, value: 6, subject: target }]`, `base_flat: 445, eff: 96` (acid tier — applier pricing). All vocabulary works today. Verify hold window vs Venom Bind's 6s doesn't double-apply.

### `attack.shatter` — Shatter

- **Type:** attack
- **Target:** Enemies in Area
- **Anchor:** target
- **Delivery:** ground
- **Range:** 5m
- **Impact area:** circle r3m · authored max 3
- **Element:** cold
- **Mana / Reservation:** Mana 22 flat
- **Cast / Recovery:** cast 0.55s + fixed floor 0.15s + recovery 0.3s
- **Duration:** —
- **Hits:** 1
- **Current:** +30% damage against chilled targets. Stops them for 1 sec.
- **New effect:** Same chill-payoff + 1s stop, but press base_flat 900→970 and eff 110→118 so solo stops being ~9% below the AoE line. With chill it goes 150→~162 solo, ~211 with +30% — still a setup reward, just less dead without Blizzard/Ice Lance/Frost Nova.
- **Proposed capability:** Keep anchor/target/range/area/cd 13/mana 22/cast/stop 1s. Update `base_flat: 900→970`, `eff: 110→118`. Verify pair DPS with a chill applier, not solo.

### `attack.shield_bash` — Shield Bash

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** melee
- **Range:** 2m
- **Impact area:** primary only (radius 0)
- **Element:** physical
- **Mana / Reservation:** Mana 18 flat
- **Cast / Recovery:** cast 0.2s + fixed floor 0s + recovery 0.22s
- **Duration:** —
- **Hits:** 1
- **Current:** Stops the target for 1 sec.
- **New effect:** —
- **Proposed capability:** —

### `attack.sidestep` — Sidestep

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** melee
- **Range:** 2m
- **Impact area:** primary only (radius 0)
- **Element:** physical
- **Mana / Reservation:** Mana 18 flat
- **Cast / Recovery:** cast 0.15s + fixed floor 0s + recovery 0.22s
- **Duration:** —
- **Hits:** 1
- **Current:** +30% crit chance on this press.
- **New effect:** Proposed RETIRE — crit role consolidates on Backstab (heavy, +25%). No number tuning; row leaves the active roster on approval.
- **Proposed capability:** After approval set `retired: true, retired_to: attack.backstab` in `skills.json`; row drops out of this draft (retired rows excluded). Saves resolve via `byId`, no save migration. Leave VFX/icon shelf files parked (do not delete art). Verify: remove `town.json` weight entry, update `skill-handoff`/`skill-copy` tests referencing sidestep.

### `attack.skull_crack` — Skull Crack

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** melee
- **Range:** 2m
- **Impact area:** primary only (radius 0)
- **Element:** physical
- **Mana / Reservation:** Mana 18 flat
- **Cast / Recovery:** cast 0.2s + fixed floor 0s + recovery 0.22s
- **Duration:** —
- **Hits:** 1
- **Current:** +20% stun chance on this hit.
- **New effect:** —
- **Proposed capability:** —

### `attack.spark` — Spark

- **Type:** attack
- **Target:** Surround (proposed; was Single Enemy)
- **Anchor:** caster (proposed; was target)
- **Delivery:** projectile
- **Range:** 3m (proposed; was 5m)
- **Impact area:** circle r3m · authored max 3 (proposed; was primary only radius 0)
- **Element:** lightning
- **Mana / Reservation:** Mana 20 flat (proposed; was 13 flat)
- **Cast / Recovery:** cast 0.15s + recovery 0.25s
- **Duration:** —
- **Hits:** 1 (proposed; back to 1 — was 12 in the split draft)
- **Current:** Applies 1 shock stack.
- **New effect:** 12 sparks emitted clock-hand order around the caster covering 3m — sequential sweep, no field linger. Each spark is 1 full hit (no press split); each target is struck once as the hand passes and every hit shocks. Single-target = old full press (164.3 flat + 67.77% magic); pack damage scales by live targets in circle. Cooldown 4→8s still pays for the rate the old filler had (was 0.71 presses/s, fastest in roster). Supersedes the 12×8% split proposal.
- **Proposed capability:** Update `cd: 4→8`, `area: { origin: caster, radius_m: 3, max_targets: 3 }`, `offline_targets: 1→3`, `cast.range_m: 5→3`. No `action` (single-hit-per-target like Split Shot/Cleave — the 12-direction sweep choreography lives in VFX/cast report, not in hits). Keep `rules: guaranteed_status + every_target`. Verify with `tools/skills.ts --calc` vs Chain Lightning (single ~85/s at cdr0 — coverage tool, not DPS) + control-budget check: ring of shock touches shares the rolling stop cap (`mob_control_budget_pct`), so no lockout — confirm sweep timing in sim.

### `attack.split_shot` — Split Shot

- **Type:** attack
- **Target:** Enemies in Area
- **Anchor:** caster (proposed; was target)
- **Delivery:** projectile
- **Range:** 3m (proposed; was 5m — caster cone casts on bodies entering its radius, so range follows the fan)
- **Impact area:** cone 120deg r3m · authored max 2 (proposed; was circle r2m max 2)
- **Element:** physical
- **Mana / Reservation:** Mana 15 flat
- **Cast / Recovery:** cast 0.3s + fixed floor 0s + recovery 0.25s
- **Duration:** —
- **Hits:** 1
- **Current:** Splits on impact, hitting every enemy in a small circle.
- **New effect:** Fan shot instead of impact split — one 120° volley hitting every enemy in a 3m fan in front of you. Close-pack tool; the 5m single-target bow role stays with Double Strafe/Headshot/Piercing Shot.
- **Proposed capability:** Update `area: { origin: caster, radius_m: 3, shape: cone, angle_deg: 120, max_targets: 2 }`, `cast.range_m: 5→3`. Keep cd 7/mana 15/`weapon: bow`/press (1649.8/77.36)/offline_targets 3. Verify footprint vs Cleave (same 120°, r3 vs r2.1) in sim before locking radius.

### `attack.stone_spike` — Stone Spike

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** ground
- **Range:** 5m
- **Impact area:** primary only (radius 0)
- **Element:** earth
- **Mana / Reservation:** Mana 20 flat
- **Cast / Recovery:** cast 0.45s + fixed floor 0.1s + recovery 0.25s
- **Duration:** —
- **Hits:** 1
- **Current:** +30% damage against crippled targets.
- **New effect:** Same cripple-payoff, but press base_flat 900→970 and eff 105→113 so solo stops trailing Thunder Strike/Earth Splitter (160→~173/s at cdr0). With cripple ~225/s — still a setup reward, just less dead without Earth Shock.
- **Proposed capability:** Keep anchor/target/range/area/cd 12/mana 20/cast. Update `base_flat: 900→970`, `eff: 105→113`. Verify pair DPS with Earth Shock, not solo.

### `attack.storm_field` — Storm Field

- **Type:** attack
- **Target:** Enemies in Area
- **Anchor:** target
- **Delivery:** ground
- **Range:** 5m
- **Impact area:** circle r3m · authored max 3
- **Element:** lightning
- **Mana / Reservation:** Mana 20 flat
- **Cast / Recovery:** cast 0.5s + fixed floor 0.1s + recovery 0.25s
- **Duration:** —
- **Hits:** 1
- **Current:** Leaves a charged storm.
- **New effect:** Proposed RETIRE — lightning target-AoE role consolidates on Chain Lightning (same target/area/element, instant). Linger-storm identity leaves with the row; no other row inherits the 25×8s linger. Supersedes the earlier base-lift proposal.
- **Proposed capability:** After approval set `retired: true, retired_to: attack.chain_lightning` in `skills.json`; row drops out of this draft (retired rows excluded). Saves resolve via `byId`, no save migration. Leave VFX/icon shelf files parked (do not delete art). Verify: lightning keeps an applier for Overload via Chain/Thunder Strike/Thunder Storm, so the shock-payoff pair survives.

### `attack.thunder_storm` — Thunder Storm

- **Type:** attack
- **Target:** Enemies in Area (proposed; was Surround)
- **Anchor:** target (proposed; was caster)
- **Delivery:** ground (proposed; was instant)
- **Range:** 5m (proposed; was 3m)
- **Impact area:** circle r3m · authored max 3
- **Element:** lightning
- **Mana / Reservation:** Mana 24 flat
- **Cast / Recovery:** cast 2.5s + fixed floor 0.5s + recovery 0.15s (proposed; was cast 0.3s + fixed floor 0.05s + recovery 0.15s)
- **Duration:** 4 sec (proposed; was —)
- **Hits:** 16 (proposed; was 1)
- **Current:** Shocks every enemy around you.
- **New effect:** Lightning copy of the Meteor/Blizzard template — impact + 4 sec storm field, 16 hits at 0.25s interval, every hit shocks. Per-hit ~6% (hit_pct ~6, total ~96%). Fills the ground-lightning gap left by retiring Storm Field. WARNING: same cast-lock deal as Meteor — windup 2.5+0.5 locks the caster most of each cycle while the row's own `--calc` rate stays cd-gated. Size by simmed ROTATION dps: starting point base_flat 550→~1000-1080 and eff 100→~118-127, cd 10→13 (Blizzard parity). Measure, don't lock from this note. Still the shock applier for the Overload pair.
- **Proposed capability:** Update `area: { origin: target, radius_m: 3, max_targets: 3 }`, `cast: { delivery: ground, range_m: 5, windup_sec: 2.5, fixed_windup_sec: 0.5, recovery_sec: 0.15 }`, `cd: 10→13`, `duration: 4s` + `action: { kind: thunder-field, roll_policy: shared, interval_sec: 0.25 }` (new engine kind, same as the proposed meteor-field — needs a reader) with `effects: hits 16 + hit_pct ~6`, `rules: guaranteed_status + every_target`. Offline_targets stays 3. Verify the three nukes side by side with `tools/skills.ts --calc` + rotation lock maths before locking base_flat/eff.

### `attack.thunder_strike` — Thunder Strike

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** ground
- **Range:** 5m
- **Impact area:** primary only (radius 0)
- **Element:** lightning
- **Mana / Reservation:** Mana 18 flat
- **Cast / Recovery:** cast 0.4s + fixed floor 0.05s + recovery 0.25s
- **Duration:** —
- **Hits:** 1
- **Current:** Shocks the target.
- **New effect:** —
- **Proposed capability:** —

### `attack.tidal_wave` — Tidal Wave (PROPOSED NEW — not in `skills.json`)

- **Type:** attack
- **Target:** Enemies in Area
- **Anchor:** caster
- **Delivery:** ground
- **Range:** 10m (line rows acquire within length_m; exceeds the 4.6m magic band the same way Fissure's 6m does)
- **Impact area:** line 10x3m · authored max 6 (proposed; 5× Fissure's footprint — the largest line in the roster)
- **Element:** cold
- **Mana / Reservation:** Mana 26 flat (proposed; dearest ground line — pays for the footprint)
- **Cast / Recovery:** cast 0.6s + fixed floor 0.15s + recovery 0.3s (proposed; a beat slower than Fissure's 0.5s)
- **Duration:** —
- **Hits:** 1
- **Current:** — (new row, no current text)
- **New effect:** Sends a tidal wave down a 10m line, chilling everything it touches. Cold's wide-line applier for the Shatter/Frostbite pair (Fissure stops, Tidal chills). One hit per target, no linger.
- **Proposed capability:** New row `attack.tidal_wave`: `hit_class: spell, type: attack, group: magic, element: cold, cd: 14, mana: 26 flat, basis: magic, offline_targets: 3`, `area: { origin: caster, radius_m: 0, shape: line, length_m: 10, width_m: 3, max_targets: 6 }`, `cast: { delivery: ground, range_m: 10, windup_sec: 0.6, fixed_windup_sec: 0.15, recovery_sec: 0.3 }`, `rules: [guaranteed_status, every_target]` (chill comes from the rule, same as Blizzard/Chain — no new vocabulary). Press at Fissure parity `base_flat: 850, eff: 100`; the footprint is paid in cd/mana/cast, not press. Verify: `--calc` single (~130/s) + 3-deep pack vs Fissure; sim-check the 10×3 footprint against arena lanes before locking width_m.

### `attack.venom_bolt` — Venom Bolt

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** instant
- **Range:** 5m
- **Impact area:** primary only (radius 0)
- **Element:** poison
- **Mana / Reservation:** Mana 21 flat
- **Cast / Recovery:** cast 0.2s + recovery 0.15s
- **Duration:** —
- **Hits:** 1
- **Current:** Applies 5 poison stacks.
- **New effect:** Proposed RETIRE — poison single role consolidates on Acid Arrow (same 445.1/96.16 press, same projectile/4.6m; 3 stacks instead of 5). Instant-cast identity leaves with the row.
- **Proposed capability:** After approval set `retired: true, retired_to: attack.acid_arrow` in `skills.json`; row drops out of this draft (retired rows excluded). Saves resolve via `byId`, no save migration. Leave VFX/icon shelf files parked (do not delete art). Verify: poison keeps a stack applier via Acid Arrow/Poison Bolt/Poison Cloud, so Venom Bind still has targets.

### `attack.venom_spray` — Venom Spray

- **Type:** attack
- **Target:** Enemies in Area
- **Anchor:** caster
- **Delivery:** melee
- **Range:** 3m
- **Impact area:** cone 90deg r3m · authored max 3
- **Element:** poison
- **Mana / Reservation:** Mana 24 flat
- **Cast / Recovery:** cast 0.25s + fixed floor 0.05s + recovery 0.22s
- **Duration:** —
- **Hits:** 1
- **Current:** Sprays venom in a 90° cone, applying 1 poison stack.
- **New effect:** Proposed RETIRE — poison AoE role consolidates on Poison Cloud (same 3m area, same mana 24; 2 stacks + linger instead of cone 1 stack). Cone-melee identity leaves with the row.
- **Proposed capability:** After approval set `retired: true, retired_to: attack.poison_cloud` in `skills.json`; row drops out of this draft (retired rows excluded). Saves resolve via `byId`, no save migration. Leave VFX/icon shelf files parked (do not delete art). Verify: melee-range poison coverage is gone — Acid/Poison Bolt stay ranged, Cloud stays ground; confirm no build loses its only close poison tool.

### `attack.void_blast` — Void Blast

- **Type:** attack
- **Target:** Enemies in Area
- **Anchor:** target
- **Delivery:** ground
- **Range:** 5m
- **Impact area:** circle r3m · authored max 3
- **Element:** chaos
- **Mana / Reservation:** Mana 24 flat
- **Cast / Recovery:** cast 0.45s + fixed floor 0.1s + recovery 0.25s
- **Duration:** —
- **Hits:** 1
- **Current:** Applies 1 mark stack.
- **New effect:** —
- **Proposed capability:** —

### `attack.void_ray` — Void Ray (PROPOSED NEW — not in `skills.json`)

- **Type:** attack
- **Target:** Enemies in Area
- **Anchor:** caster
- **Delivery:** projectile
- **Range:** 8m (line rows acquire within length_m)
- **Impact area:** line 8x2m · authored max 4
- **Element:** chaos
- **Mana / Reservation:** Mana 10 flat + drain 10/s while held (proposed; NEW mechanic — no row drains mana per sec today)
- **Cast / Recovery:** cast 0.3s + fixed floor 0.05s + recovery 0.25s (cast opens the beam; the channel is the cost)
- **Duration:** 3 sec max channel (proposed)
- **Hits:** 6 (proposed; 1 per 0.5s tick, ~17% each, total ~102%)
- **Current:** — (new row, no current text)
- **New effect:** A channeled chaos beam down an 8m line — hold to keep it burning, release (or run dry) to stop. 6 ticks, each ~17%, applies 1 mark stack per press to feed Unravel. Stationary while channeling. NEEDS ENGINE WORK: new `action` kind `ray-channel` + new cost field `mana_drain_per_sec` + cancel rule (release/empty-mana ends channel, cooldown starts) + mana-bar drain UX. The drain IS the balance lever: full 3s costs 40 mana for ~1 press of damage.
- **Proposed capability:** New row `attack.void_ray`: `hit_class: spell, type: attack, group: magic, element: chaos, cd: 12, mana: 10 flat, mana_drain_per_sec: 10, basis: magic, offline_targets: 3`, `area: { origin: caster, radius_m: 0, shape: line, length_m: 8, width_m: 2, max_targets: 4 }`, `cast: { delivery: projectile, range_m: 8, windup_sec: 0.3, fixed_windup_sec: 0.05, recovery_sec: 0.25 }`, `action: { kind: ray-channel, roll_policy: shared, tick_sec: 0.5, max_sec: 3 }` (new kind — reader required), `duration: 3s`, `rules: [every_target]`, `effects: [{ stat: hits, op: add_flat, value: 6, subject: self }, { stat: hit_pct, op: add_pct, value: 17, subject: self }, { stat: mark_stacks, op: add_flat, value: 1, subject: target }]`, `base_flat: 900, eff: 105`. Verify drain pacing + early-release feel in sim before locking any number.

### `attack.entropy_well` — Entropy Well (PROPOSED NEW — not in `skills.json`)

- **Type:** attack
- **Target:** Enemies in Area
- **Anchor:** target
- **Delivery:** ground
- **Range:** 5m
- **Impact area:** circle r3m · authored max 3
- **Element:** chaos
- **Mana / Reservation:** Mana 22 flat
- **Cast / Recovery:** cast 0.5s + fixed floor 0.1s + recovery 0.25s
- **Duration:** —
- **Hits:** 1
- **Current:** — (new row, no current text)
- **New effect:** Chaos gets a linger it never had — a well that marks every target (1 stack) and leaves 8s of chaos decay (20/s). Takes over the linger niche Storm Field vacates, in an element with no DoT of its own; also a wide mark applier feeding Unravel.
- **Proposed capability:** New row `attack.entropy_well`: `hit_class: spell, type: attack, group: magic, element: chaos, cd: 12, mana: 22 flat, basis: magic, offline_targets: 3`, `area: { origin: target, radius_m: 3, max_targets: 3 }`, `cast: { delivery: ground, range_m: 5, windup_sec: 0.5, fixed_windup_sec: 0.1, recovery_sec: 0.25 }`, `rules: [every_target]`, `effects: [{ stat: mark_stacks, op: add_flat, value: 1, subject: target }, { stat: dot_dps, op: add_flat, value: 20, subject: target }, { stat: dot_sec, op: add_flat, value: 8, subject: target }]`, `base_flat: 700, eff: 90` (between Storm 800 and Cloud 600). All vocabulary works today. Verify chaos DoT against the shared 1.5× dot cap so it doesn't stack past burn/poison.

### `attack.water_ball` — Water Ball

- **Type:** attack
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** projectile
- **Range:** 4.6m
- **Impact area:** primary only (radius 0)
- **Element:** cold
- **Mana / Reservation:** Mana 20 flat
- **Cast / Recovery:** profile default (projectile): cast 0.25s + recovery 0.25s
- **Duration:** —
- **Hits:** 5
- **Current:** A volley of water spheres. Chills the target.
- **New effect:** —
- **Proposed capability:** —

### `attack.whirlwind` — Whirlwind

- **Type:** attack
- **Target:** Surround
- **Anchor:** caster
- **Delivery:** melee
- **Range:** 3m
- **Impact area:** circle r3m · authored max 3
- **Element:** physical
- **Mana / Reservation:** Mana 22 flat
- **Cast / Recovery:** cast 0.2s + fixed floor 0s + recovery 0.22s
- **Duration:** 3 sec (proposed; was —)
- **Hits:** 6 (proposed; was 3)
- **Current:** One hit per target per round.
- **New effect:** 3 sec channel — 6 rounds, one hit per target per round at 0.5s interval, still moving at ×0.6 speed. Per-round ~17% (hit_pct 33→~17, total ~102% ≈ today's 99%) so single-target sustained stays on the phys line; longer channel is the price of 6 rounds of full-circle coverage.
- **Proposed capability:** Keep anchor/target/range/area/cd 9/mana 22/cast. Update `duration: 3s` + `action: { kind: whirlwind-channel, roll_policy: shared, active_sec: 1.2→3, movement_speed_mult: 0.6, interval_sec: 0.5 }` with `effects: hits 6 + hit_pct ~17`. Offline_targets stays 3. Verify with `--calc` (single ~2015/s at CDR50+ladder30, unchanged) + sim-check that a 3s channel doesn't trap the rotation — interrupt/early-exit behaviour unchanged.

---

## Auras — 18

### `aura.cast_on_crit` — Cast on Crit

- **Type:** aura
- **Target:** Self
- **Anchor:** caster
- **Delivery:** —
- **Range:** —
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Reservation 14% (heavy)
- **Cast / Recovery:** —
- **Duration:** —
- **Hits:** —
- **Current:** Casts the first ready slot in the order. Mana ×2, damage ×0.7, 1 sec between triggers.
- **New effect:** —
- **Proposed capability:** —

### `aura.cast_on_damage_taken` — Cast on Damage Taken

- **Type:** aura
- **Target:** Self
- **Anchor:** caster
- **Delivery:** —
- **Range:** —
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Reservation 14% (heavy)
- **Cast / Recovery:** —
- **Duration:** —
- **Hits:** —
- **Current:** Casts the first ready slot in the order. Mana ×2, damage ×0.7, 1 sec between triggers.
- **New effect:** —
- **Proposed capability:** —

### `aura.clarity` — Clarity

- **Type:** aura
- **Target:** Self
- **Anchor:** caster
- **Delivery:** —
- **Range:** —
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Reservation 8% (cheap)
- **Cast / Recovery:** —
- **Duration:** —
- **Hits:** —
- **Current:** Mana regeneration +25%.
- **New effect:** —
- **Proposed capability:** —

### `aura.elemental_fury` — Elemental Fury

- **Type:** aura
- **Target:** Self
- **Anchor:** caster
- **Delivery:** —
- **Range:** —
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Reservation 11% (mid)
- **Cast / Recovery:** —
- **Duration:** —
- **Hits:** —
- **Current:** Foes' elemental resistance −12%.
- **New effect:** —
- **Proposed capability:** —

### `aura.ember_conversion` — Ember Conversion

- **Type:** aura
- **Target:** Self
- **Anchor:** caster
- **Delivery:** —
- **Range:** —
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Reservation 11% (mid)
- **Cast / Recovery:** —
- **Duration:** —
- **Hits:** —
- **Current:** 35% of physical damage converted to fire.
- **New effect:** —
- **Proposed capability:** —

### `aura.energy_guard` — Energy Guard

- **Type:** aura
- **Target:** Self
- **Anchor:** caster
- **Delivery:** —
- **Range:** —
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Reservation 11% (mid)
- **Cast / Recovery:** —
- **Duration:** —
- **Hits:** —
- **Current:** Energy Shield +48.
- **New effect:** —
- **Proposed capability:** —

### `aura.grace` — Grace

- **Type:** aura
- **Target:** Self
- **Anchor:** caster
- **Delivery:** —
- **Range:** —
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Reservation 8% (cheap)
- **Cast / Recovery:** —
- **Duration:** —
- **Hits:** —
- **Current:** Evasion +24.
- **New effect:** —
- **Proposed capability:** —

### `aura.haste` — Haste

- **Type:** aura
- **Target:** Self
- **Anchor:** caster
- **Delivery:** —
- **Range:** —
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Reservation 25% (extreme)
- **Cast / Recovery:** —
- **Duration:** —
- **Hits:** —
- **Current:** Global speed ×1.15: cooldowns tick 15% faster and final attack speed ×1.15. Clamped by the 500 Cap.
- **New effect:** —
- **Proposed capability:** —

### `aura.herald_of_ash` — Herald of Ash

- **Type:** aura
- **Target:** Self
- **Anchor:** caster
- **Delivery:** —
- **Range:** —
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Reservation 14% (heavy)
- **Cast / Recovery:** —
- **Duration:** —
- **Hits:** —
- **Current:** +50 Fire damage · Alignment +6%.
- **New effect:** —
- **Proposed capability:** —

### `aura.herald_of_frost` — Herald of Frost

- **Type:** aura
- **Target:** Self
- **Anchor:** caster
- **Delivery:** —
- **Range:** —
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Reservation 14% (heavy)
- **Cast / Recovery:** —
- **Duration:** —
- **Hits:** —
- **Current:** +50 Cold damage · Alignment +6%.
- **New effect:** —
- **Proposed capability:** —

### `aura.herald_of_lightning` — Herald of Lightning

- **Type:** aura
- **Target:** Self
- **Anchor:** caster
- **Delivery:** —
- **Range:** —
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Reservation 14% (heavy)
- **Cast / Recovery:** —
- **Duration:** —
- **Hits:** —
- **Current:** +50 Lightning damage · Alignment +6%.
- **New effect:** —
- **Proposed capability:** —

### `aura.iron_guard` — Iron Guard

- **Type:** aura
- **Target:** Self
- **Anchor:** caster
- **Delivery:** —
- **Range:** —
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Reservation 11% (mid)
- **Cast / Recovery:** —
- **Duration:** —
- **Hits:** —
- **Current:** Armour +32.
- **New effect:** —
- **Proposed capability:** —

### `aura.rimbo_form` — Rimbo Form

- **Type:** aura
- **Target:** Self
- **Anchor:** caster
- **Delivery:** —
- **Range:** —
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Reservation 11% (mid)
- **Cast / Recovery:** —
- **Duration:** —
- **Hits:** —
- **Current:** Nearby mobs attack −15% slower. Stacks with chill up to −35%.
- **New effect:** —
- **Proposed capability:** —

### `aura.rime_conversion` — Rime Conversion

- **Type:** aura
- **Target:** Self
- **Anchor:** caster
- **Delivery:** —
- **Range:** —
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Reservation 11% (mid)
- **Cast / Recovery:** —
- **Duration:** —
- **Hits:** —
- **Current:** 35% of physical damage converted to cold.
- **New effect:** —
- **Proposed capability:** —

### `aura.storm_conversion` — Storm Conversion

- **Type:** aura
- **Target:** Self
- **Anchor:** caster
- **Delivery:** —
- **Range:** —
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Reservation 11% (mid)
- **Cast / Recovery:** —
- **Duration:** —
- **Hits:** —
- **Current:** 35% of physical damage converted to lightning.
- **New effect:** —
- **Proposed capability:** —

### `aura.trinity_form` — Trinity Form

- **Type:** aura
- **Target:** Self
- **Anchor:** caster
- **Delivery:** —
- **Range:** —
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Reservation 11% (mid)
- **Cast / Recovery:** —
- **Duration:** —
- **Hits:** —
- **Current:** +15% resistance to fire, cold and lightning.
- **New effect:** —
- **Proposed capability:** —

### `aura.vitality` — Vitality

- **Type:** aura
- **Target:** Self
- **Anchor:** caster
- **Delivery:** —
- **Range:** —
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Reservation 11% (mid)
- **Cast / Recovery:** —
- **Duration:** —
- **Hits:** —
- **Current:** Health regeneration +30%.
- **New effect:** —
- **Proposed capability:** —

### `aura.wraith_of_fury` — Wraith of Fury

- **Type:** aura
- **Target:** Self
- **Anchor:** caster
- **Delivery:** —
- **Range:** —
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Reservation 8% (cheap)
- **Cast / Recovery:** —
- **Duration:** —
- **Hits:** —
- **Current:** Attack speed +12%.
- **New effect:** —
- **Proposed capability:** —

---

## Buffs — 9

### `buff.berserker` — Berserker

- **Type:** buff
- **Target:** Self
- **Anchor:** caster
- **Delivery:** instant
- **Range:** 0m
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Mana 15 flat
- **Cast / Recovery:** profile default (instant): cast 0.15s + recovery 0.15s
- **Duration:** 10 sec
- **Hits:** —
- **Current:** ×1.20 attack speed, +15% leech, and damage taken ×1.15.
- **New effect:** —
- **Proposed capability:** —

### `buff.earth_wall` — Earth Wall

- **Type:** buff
- **Target:** Self
- **Anchor:** caster
- **Delivery:** instant
- **Range:** 0m
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Mana 15 flat
- **Cast / Recovery:** profile default (instant): cast 0.15s + recovery 0.15s
- **Duration:** 10 sec
- **Hits:** —
- **Current:** Grants block charges that cut physical hits by the block rule, never deleting them: 5 at level 1, +1 every 3 levels, up to 10 at level 20.
- **New effect:** —
- **Proposed capability:** —

### `buff.energy_absorb` — Energy Absorb

- **Type:** buff
- **Target:** Self
- **Anchor:** caster
- **Delivery:** instant
- **Range:** 0m
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Mana 18 flat
- **Cast / Recovery:** profile default (instant): cast 0.15s + recovery 0.15s
- **Duration:** 3 sec
- **Hits:** —
- **Current:** Converts 15% of every incoming hit into Energy Shield, rising to 30% at level 20.
- **New effect:** —
- **Proposed capability:** —

### `buff.flame_guard` — Flame Guard

- **Type:** buff
- **Target:** Self
- **Anchor:** caster
- **Delivery:** instant
- **Range:** 0m
- **Impact area:** —
- **Element:** fire
- **Mana / Reservation:** Mana 18 flat
- **Cast / Recovery:** profile default (instant): cast 0.15s + recovery 0.15s
- **Duration:** 8 sec
- **Hits:** —
- **Current:** Grants a 350 Energy Shield pool that soaks damage while the guard is up.
- **New effect:** —
- **Proposed capability:** —

### `buff.ghost_dance` — Ghost Dance

- **Type:** buff
- **Target:** Self
- **Anchor:** caster
- **Delivery:** instant
- **Range:** 0m
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Mana 15 flat
- **Cast / Recovery:** profile default (instant): cast 0.15s + recovery 0.15s
- **Duration:** 10 sec
- **Hits:** —
- **Current:** Grants perfect-dodge charges that delete incoming hits outright: 3 at level 1, +1 every 5 levels, up to 7 at level 20.
- **New effect:** —
- **Proposed capability:** —

### `buff.holy_veil` — Holy veil

- **Type:** buff
- **Target:** Self
- **Anchor:** caster
- **Delivery:** instant
- **Range:** 0m
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Mana 18 flat
- **Cast / Recovery:** profile default (instant): cast 0.15s + recovery 0.15s
- **Duration:** 7 sec
- **Hits:** —
- **Current:** No Element debuff or bleed can be applied. Casting clears the ones on you.
- **New effect:** —
- **Proposed capability:** —

### `buff.iron_will` — Iron Will

- **Type:** buff
- **Target:** Self
- **Anchor:** caster
- **Delivery:** instant
- **Range:** 0m
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Mana 15 flat
- **Cast / Recovery:** profile default (instant): cast 0.15s + recovery 0.15s
- **Duration:** 10 sec
- **Hits:** —
- **Current:** ×1.20 Armour, damage taken ×0.90.
- **New effect:** —
- **Proposed capability:** —

### `buff.magia_drive` — Magia Drive

- **Type:** buff
- **Target:** Self
- **Anchor:** caster
- **Delivery:** instant
- **Range:** 0m
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Mana 18 flat
- **Cast / Recovery:** profile default (instant): cast 0.15s + recovery 0.15s
- **Duration:** 8 sec
- **Hits:** —
- **Current:** Energy Shield starts recharging at once, ignoring the 5 sec delay, and hits do not interrupt the recharge.
- **New effect:** —
- **Proposed capability:** —

### `buff.warcry` — Warcry

- **Type:** buff
- **Target:** Self
- **Anchor:** caster
- **Delivery:** instant
- **Range:** 0m
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Mana 15 flat
- **Cast / Recovery:** profile default (instant): cast 0.15s + recovery 0.15s
- **Duration:** 10 sec
- **Hits:** —
- **Current:** ×1.15 physical power, ×1.20 elemental alignment and elemental resistance.
- **New effect:** —
- **Proposed capability:** —

### `buff.enchant_poison` — Enchant Poison (PROPOSED NEW — not in `skills.json`)

- **Type:** buff
- **Target:** Self
- **Anchor:** caster
- **Delivery:** instant
- **Range:** 0m
- **Impact area:** —
- **Element:** poison
- **Mana / Reservation:** Mana 18 flat
- **Cast / Recovery:** profile default (instant): cast 0.15s + recovery 0.15s
- **Duration:** 10 sec (proposed; roster has no poison conversion today)
- **Hits:** —
- **Current:** — (new row, no current text)
- **New effect:** Coats your weapon in venom, RO-style: 40% of physical damage converted to poison while the buff holds. Timed counterpart to the aura conversions (fire/cold/lightning have one, poison has none) — stronger share than their 35% because it costs mana and only holds 50% uptime (10s on a 20s cooldown). Gives melee builds a poison route into Acid Arrow/Poison Cloud/Venom Bind. Note: buffs ride `buff_effect_pct`, so 40% reads ~72% at skill level 20 — verify that top rung against Ember/Rime/Storm before locking.
- **Proposed capability:** New row `buff.enchant_poison` (name per lowercase-hyphen rule): `hit_class: none, type: buff, cd: 20, mana: 18 flat, duration: 10 sec, cast: { delivery: instant, range_m: 0 }`, `effect` as above, `effects: [{ stat: damage_conversion, op: add_pct, value: 40, element: poison, subject: self }]`. No new vocabulary (`damage_conversion` already gated). Verify: stacking with a conversion aura sums shares (e.g. Ember 35 + Enchant 40 = 75% converted) — confirm intended; check buff-bar UI handles a 10th buff row.

---

## Curses — 6

### `curse.blinding_mark` — Blinding Mark

- **Type:** curse
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** instant
- **Range:** 4.6m
- **Impact area:** primary only (radius 0)
- **Element:** —
- **Mana / Reservation:** Mana 21 flat
- **Cast / Recovery:** profile default (instant): cast 0.15s + recovery 0.15s
- **Duration:** 8 sec
- **Hits:** —
- **Current:** The target's accuracy is −30%.
- **New effect:** —
- **Proposed capability:** —

### `curse.cripple` — Cripple

- **Type:** curse
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** instant
- **Range:** 4.6m
- **Impact area:** primary only (radius 0)
- **Element:** —
- **Mana / Reservation:** Mana 21 flat
- **Cast / Recovery:** profile default (instant): cast 0.15s + recovery 0.15s
- **Duration:** 8 sec
- **Hits:** —
- **Current:** The target's attack speed is −20%.
- **New effect:** —
- **Proposed capability:** —

### `curse.expose` — Expose

- **Type:** curse
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** instant
- **Range:** 5m
- **Impact area:** primary only (radius 0)
- **Element:** —
- **Mana / Reservation:** Mana 24 flat
- **Cast / Recovery:** cast 0.3s + fixed floor 0.05s + recovery 0.15s
- **Duration:** 8 sec
- **Hits:** —
- **Current:** The target takes +20% damage.
- **New effect:** —
- **Proposed capability:** —

### `curse.jinx` — Jinx

- **Type:** curse
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** instant
- **Range:** 5m
- **Impact area:** primary only (radius 0)
- **Element:** —
- **Mana / Reservation:** Mana 19 flat
- **Cast / Recovery:** cast 0.2s + recovery 0.15s
- **Duration:** 8 sec
- **Hits:** —
- **Current:** +15% chance to crit against the target.
- **New effect:** —
- **Proposed capability:** —

### `curse.venom_bind` — Venom Bind

- **Type:** curse
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** instant
- **Range:** 5m
- **Impact area:** primary only (radius 0)
- **Element:** —
- **Mana / Reservation:** Mana 21 flat
- **Cast / Recovery:** cast 0.3s + fixed floor 0.05s + recovery 0.15s
- **Duration:** 6 sec
- **Hits:** —
- **Current:** Poison stacks on the target stop falling.
- **New effect:** —
- **Proposed capability:** —

### `curse.weaken` — Weaken

- **Type:** curse
- **Target:** Single Enemy
- **Anchor:** target
- **Delivery:** instant
- **Range:** 4.6m
- **Impact area:** primary only (radius 0)
- **Element:** —
- **Mana / Reservation:** Mana 21 flat
- **Cast / Recovery:** profile default (instant): cast 0.15s + recovery 0.15s
- **Duration:** 8 sec
- **Hits:** —
- **Current:** The target deals −25% damage.
- **New effect:** —
- **Proposed capability:** —

---

## Heals — 3

### `heal.cleanse` — Cleanse

- **Type:** heal
- **Target:** Self
- **Anchor:** caster
- **Delivery:** instant
- **Range:** 0m
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Mana 24 flat
- **Cast / Recovery:** cast 0.2s + recovery 0.15s
- **Duration:** Instant
- **Hits:** —
- **Current:** Cleanses every status on you and restores 8% of Max HP.
- **New effect:** —
- **Proposed capability:** —

### `heal.greater_heal` — Greater Heal

- **Type:** heal
- **Target:** Self
- **Anchor:** caster
- **Delivery:** instant
- **Range:** 0m
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Mana 37 flat
- **Cast / Recovery:** cast 0.6s + fixed floor 0.2s + recovery 0.25s
- **Duration:** Instant
- **Hits:** —
- **Current:** Restores 60% of Max HP at once.
- **New effect:** —
- **Proposed capability:** —

### `heal.heal` — Heal

- **Type:** heal
- **Target:** Self
- **Anchor:** caster
- **Delivery:** instant
- **Range:** 0m
- **Impact area:** —
- **Element:** —
- **Mana / Reservation:** Mana 30 flat
- **Cast / Recovery:** cast 0.3s + fixed floor 0.05s + recovery 0.15s
- **Duration:** 8 sec
- **Hits:** —
- **Current:** Restores 10% of Max HP each second.
- **New effect:** —
- **Proposed capability:** —

---

## Skill adjustment rollout

**Prerequisite:** Complete the [mechanic gates](active-skill-mechanics-plan.md#6-close-the-mechanic-gates) and approve the per-skill proposals before changing the live pool. This section covers data rollout only.

**Proposal inventory:** 9 proposed new rows and 5 proposed retirements. These are planning counts, not catalogue test assertions.

**Execution boundary:** This rollout is a separate task after mechanic completion and approval of the relevant skill proposals. The mechanic task finishes without starting or waiting for this rollout. Review-only ranges and alternatives in the skill rows are not approved final balance values.

### Align approved rows with the mechanic contract

Use the [selected mechanic behavior](active-skill-mechanics-plan.md#selected-behavior-decisions) rather than reopening those implementation decisions during data mapping. The per-skill proposals above remain the source for intended content and tuning.

| Consumer | Required mapping after its mechanic gate passes |
|---|---|
| Unravel | Use the validated `consume_status` operator and all-stack semantics from mechanic stage 2. |
| Contagion | Opt into `spread_scope: footprint`; copy the primary snapshot under stage 2, not legacy recipient-count spread. |
| Void Orb | Opt into distinct-target acquisition; radius-zero impact does not define acquisition reach. |
| Meteor / Thunder Storm | Include the initial impact in the hit budget. Use the shared field scheduler and its specified first-pulse timing. |
| Arrow Shower / Blizzard / Thunder Storm | Opt into `per-impact` effects where the approved row promises repeated on-hit/status opportunities. |
| Meteor / Void Ray | Use `refresh-status` where the approved row grants stacks once and refreshes later. |
| Void Ray | Map duration/cadence to `active_sec` / `interval_sec`; remove proposed `max_sec` / `tick_sec` aliases. Copy must describe discrete tick payment, manual hold, automatic completion and trigger exclusion. |
| Spark | Describe the sweep as visual choreography; do not promise sequential mechanical damage/control with an instant area hit. |
| All cast-lock estimates | Recalculate from canonical total windup and recovery; do not add fixed windup twice. |

### Pool execution checklist

- [ ] Confirm the mechanic plan is complete with its required evidence, then identify the approved skill changes. Do not silently turn a review range or competing balance option into an approved value. Approval of mechanics alone is not approval of every content proposal.
- [ ] Map accepted additions and edits into [skills.json](../tools/data/skills.json). Include supported-vocabulary additions Hemotoxin, Venom Coffin, Entropy Well, Tidal Wave and Enchant Poison in the approved inventory; they do not bypass the mechanic gate.
- [ ] Apply the contract alignment above and update descriptions, timing and prices through canonical readers. Preserve hit-class, weapon and acquisition rules unless the approved proposal changes them.
- [ ] Apply accepted retirements with `retired_to` and remove their acquisition weights from [town.json](../tools/data/town.json). Traverse drops, rewards, owned views, presets and handoff/copy readers for stale active references; retain legacy IDs and art.
- [ ] Inspect current [save loading](../game/src/state/save.ts) and test legacy ownership, XP, modes, presets and export/import. `retired_to` is not itself an ownership/XP transfer. Make any intended automatic replacement explicit before claiming no migration is needed.
- [ ] Run `npm run skills -- --checks`, `npm run skills -- --calc` and focused single-target, pack and full-rotation simulations. Record measured results separately from draft estimates. These balance measurements inform the approved values; they are not hardcoded correctness bands in tests.
- [ ] Update [wiki source](../game/src/wiki/pages.ts), run `npm run wiki`, and inspect generated output and local links. Never hand-edit generated wiki HTML.
- [ ] Run the required gameplay/UI gates from [mechanic verification](active-skill-mechanics-plan.md#verification-commands) for the final changed inputs, including focused catalogue/copy/handoff/save regressions. Reuse still-valid passing results rather than repeating unchanged checks.
- [ ] Audit the final diff against the approved inventory. Report actual additions, retirements and edits from the resulting catalogue rather than asserting fixed roster counts. Report verification and material limitations; mark the rollout complete only when its own required work passes.

**Rollout evidence:** Pending approval and execution. This status does not block completion of the separate mechanic plan.
