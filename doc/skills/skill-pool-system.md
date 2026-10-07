# Skills system, AoE, passives, acquisition

import glossary.md
import formula.md
import combat.md
import world.md
import loot.md
import skill-tree.md

# How skills and normal attacks work together

**One clock · Two speed markets** — this is the core keeping "gear/skill" from overlapping in meaning (the passive tree is not folded into `mob_HP` yet —)

1. **Auto does not stop when pressing skills** · Pressing a skill does not "replace" attacks, shift the attack table, or reset aspd (combat.md section 3 already sets a continuous clock)
2. **Skill damage does not multiply aspd** because the formula is `per press × (1/cd)` → aspd accelerates only auto, CDR accelerates only skills · The two are therefore separate markets and do not hit each other's Cap · **This is the answer to the "fast hit" fork** (checks.md group I): fast builds buy *hit count* (per-hit procs), not total DPS
3. **But weight tax cuts only aspd** → auto can lose up to −50% (formula.md section 11) while skills lose nothing · Heavy builds are thus "slow but still strong with skills", not weak in both directions
4. **Mana is the shared resource of skill/buff/aura · Auto is free** (only Leech turns auto into recovery) → builds without Int slots naturally get fewer skills — glass at level 100 cannot charge Cleave in time for its cd (11.54 sec vs 6 sec base cd)
   - **Auras reserve rather than drain** (see `skill-pool-aura-heal.md`). This does not change the sharing rule above, but it changes *when* it bites: an aura is a **static** claim on the pool taken before the fight, while a skill is a **live** claim paid per press. The player trades a fixed slice for guaranteed uptime instead of racing regen

**When it counts as a "hit"** (items 5-9 are what all game procs reference)

5. Every **damage instance** of a skill counts as 1 hit for per-hit procs (Sonic Blow · Brute · Flurry · Jinx · stun from Alignment · 20% status chance) · The `targets/hits` column in the skill table is this number
6. **DoT ticks do not count as hits** — no crit, no per-hit procs, no refresh of "per-hit" buffs · They are damage-over-time only
7. **Hit roll (accuracy vs evasion) rolls per instance** · If a skill says "guaranteed hit", it skips the roll only for that hit (Piercing Shot) · Note: a mob can avoid a hit twice — the accuracy-vs-evasion roll and its own Agi dodge — so a "guaranteed hit" line skips both, not one
8. **Crit**: physical instances only · magic and the 5 Elements never crit (formula-offense.md section 3) · Headshot adds crit chance only to that hit
9. **Multi-hits on different targets roll separately** (Whirlwind 3 hits = 3 rolls) but per-Element status stacks still use the same Cap (5 burn stacks / 10 poison stacks)

**Order and queue**

10. **No GCD** — attack · curse and heal skills are instant and the game runs top-down through the **active slots** (count in `skill-pool.md`), casting the first slot that is ready, affordable, and **allowed to fire this tick** by its own mode (`skill-pool.md` · When a slot may fire) · A skill stuck at the top long blocks lower ones forever → list order is a real lever, not formatting
11. **Buffs and auras are a toggle track, not rotation entries** — a buff left switched on re-presses itself the moment it lapses, and an open aura holds its reservation; both run in parallel with the active slots and take **no slot**, costing only mana (buff) or reservation (aura) · Heal is an *active*, and bosses require heal (combat.md §7) — so it is the one row that wants its **mode** set rather than only its **place**: left on `always` and slotted high it fires every cycle into a full pool, and the `hpBelowPct` leg is what makes the same rotation hold in both a clean fight and a boss
12. **Cooldowns do not reset on Push** — HP depletion returns to the main preset, but skills already counting cd keep counting · Mobs do not die because we were pushed, so no fired work is lost

**True-number comparison** (glass Str 12 at level 100 · run `node tools/timeline.ts`)

| What the player sees | Normal attacks | Skill (Cleave) |
|---|---|---|
| Rate | 2.094 hits/sec (every 478 ms) | 1 press/11.54 sec (mana is the bottleneck · 6 sec base cd) |
| Per press | 5,897 (expected including crit · 79.7% hit) | 8,828 spread over 3 targets = 5,297 per target |
| Added DPS | 8,881 (baseline) | +459 = **+5%** from a single skill |
| Accelerated by | aspd (Agi + Mod + weight) | CDR (Wis + Mod + Battle Orders) |
| Resource | Free | 2,424 mana pool · 31.5/sec regen |
| Feeds procs | 2.09 rolls/sec | 3 rolls in one press |

**Does the funnel shift — no** · mob_HP is multiplied by the skill factor `1 + 0.0034 × L` (×1.34 at L100) as recorded in checks.md D1/D17 · the drop line · craft prices in loot.md therefore stay fixed (H1 preserved) · What changes is the *composition* of player-visible damage: Str builds get 75% auto + 25% skill, while 8-Int builds get 53% + 47% (rotation table at end of file) — and both remain under the gear ceiling

# AoE

**Monsters come in groups** (see world.md), so some skills hit more than 1 target

| Skill | How many it hits |
|---|---|
| Cleave · Blizzard · Static Field · Toxic Cloud | All in range |
| Chain Lightning | Arcs to 3 targets · the row's own AoE |
| Rimbo Form · Elemental Fury | All in range · While the aura is open |
| Lightning Bolt · Frost Bolt · Piercing Shot · Arrow Shower | Single target |
| All 5 debuffs | Single target |
| Self buffs · heals · auras | Self |

## Damage rules

<!-- BEGIN GENERATED:aoe-rules -->
```
single target → 100% damage · mana cost 1.0×
AoE           → 60% damage per target hit · Cap 3 targets · mana cost 1.5×

damage per mana: 1 target 0.40× · 2 targets 0.80× · 3+ targets 1.20×

a flat cost climbs 5% a skill level against the press ramp's 1.5%, so at level 20 one costs ×1.52 what the press grew 
```
<!-- END GENERATED:aoe-rules -->

- **Skills are gated by mana** (maximum casts/sec = mana_regen ÷ cost), so the true currency of AoE is damage landed on mob HP per mana, not damage per press.
- **AoE pays off at 3 targets**, breaks even at 2, and loses at 1. The mana cost is what makes it a choice, not a free upgrade.
- **Cap 3 targets is the funnel lock** — loot.md sets the clear cycle on it. Raising the Cap shifts craft income across the file (loot.md section 2).
- A group of 5 clears in 3.75 sec instead of 4.50 (1.20× faster); against 1-2 small mobs AoE deals 0.40-0.80× damage per mana, so single-target still wins there.
- Bosses are single, so AoE deals 0.40× damage per mana against them and stretches the fight ~2.5× — the trade holds at the boss gate too.
- Which 3 targets the AoE hits is the reach queue (`combat.md` section 2b), not a fixed set.

## What AoE adds beyond damage

- **Statuses land on all targets** — burn from Flame Wisp and poison from Toxic Cloud stay on every target hit
- **Debuffs remain single-target** — because the Expose target must be chosen; spreading after investing mana would dissolve the value
- **Creates work queues** — Blizzard chills all, so the remainder all attack slower equally

# 12 passives - withdrawn, and where they went

> This file no longer counts these 12 as skills — the live roster split is the generated block in `skill-pool.md` (`node tools/skills.ts`) · All 12 were moved to skill-tree keystones as decided in skill-tree.md section 5 · The table below remains as *value evidence* (5-30% each) referenced by the tree budget, not as a list players will equip

**Takes no skill slot · Costs no mana · Has no cooldown · Bought with skill points**

Passives are not plain numbers but combat-rule changes. Because if it were `+5% Str` it should be an Mod on gear instead, without needing a player-decision point

> **Withdrawn** - these twelve were waiting for a passive tree to live in. The tree is empty, so they are not part of the design.

| # | Passive | Cost | Effect |
|---|---|---|---|
| 1 | **Sonic Blow** | 1 | Every 5th normal attack deals 2.5x damage |
| 2 | **Cheap Casting** | 1 | All active-skill mana cost -25% |
| 3 | **Noble Phantasm** | 1 | Reflects 30% of taken damage back · No crit · Does not work with DoT |
| 4 | **Rapid Fire** | 2 | Continuous fire on same target: attack speed ramps to +30% maximum then holds |
| 5 | **Overkill** | 2 | Excess damage beyond target HP carries to the next slot, not discarded |
| 6 | **Elemental Attunement** | 2 | Confirms matching target Innate Element free, no roll |
| 7 | **Cunning** | 3 | While mana below 25%, normal attacks deal +30% damage |
| 8 | **Counter** | 3 | After being crit, next normal attack is guaranteed to crit back |
| 9 | **Last Stand** | 3 | While HP below 30%, all damage +50% |
| 10 | **Burning Focus** | 4 | Firing the same Element continuously over 5 sec doubles applied status duration |
| 11 | **Flurry** | 4 | Every 3 consecutive active-skill presses, the next one has -30% cooldown |
| 12 | **Brute** | 5 | Every monster kill: all damage +3%, maximum +30%, resets when a hit is evaded |

## Price rises with purchase order

> Tiered pricing is a **temporary method while there is no tree**. With a tree, price comes from distance in the tree instead. See skill-tree.md

```
Buy 1st-2nd → 1 point
Buy 3rd-4th → 2 points
Buy 5th-6th → 3 points
Buy 7th+ → 4 points
```

- **Full free respec anytime**. In an idle game, locking players into untestable builds makes them quit immediately

## Watch points

- **Overkill can be too strong**. If targets have low HP, all excess damage is discarded, speeding kills greatly · Must check against the lowest-HP mobs whether it is still fair
- **Cunning's conflict with auras changed shape.** The old rule was a hard mutual exclusion — auras switched *off* below 25% mana, exactly when Cunning starts. Reservation deletes that switch-off, so the specific conflict is gone, but a budget tension replaces it: **Cunning wants a small usable pool** (sitting below 25% more often is the point) while **reservation wants a large usable pool** (every reserved point is a point Cunning cannot reach). So a Cunning build reserves little. It is a budget trade, not a mutual exclusion — weaker as a design conflict
- **Last Stand pairs with Overkill and looks very strong**. Must check whether anything stops players from fighting at low HP like that
- **Brute must reset when a hit is evaded**. Without reset, players would accumulate to +30% permanently without killing anything

# Skill acquisition

**Random drops**, not fixed unlocks, and skills are no accident

| Source | Chance | Notes |
|---|---|---|
| boss | High | Main source · Each wave range has its own pool |
| normal mobs | Very low | Does not need to proc often; just enough that AFK players still have a chance |
| elite | Medium | Same pool as range boss |

- **Drop chance scales with Lck** through the existing `drop_rate` · This is why Lck must affect real drops, not just be an empty number
- Range pools must spread · If early bosses can drop late skills, players will farm cheap items and never go further back

## Duplicate-protection rules

**If skills the player lacks remain in the pool, the system always grants a new skill; only owned skills can roll duplicates**

```
1. Check whether the pool has skills the player lacks
  → Yes → roll a new skill
  → No → roll a duplicate for ladder upgrades
```

- Early on every drop is new; never wasted
- Late, when complete, duplicates go to ladder upgrades instead of discarded unwanted items
- This system removes the need to think about whether a drop should be kept or separated

# Duplicates → ladder

**Duplicate skills upgrade cooldown as a ladder**

| Step | Cooldown reduction | Duplicate cost | Cumulative |
|---|---|---|---|
| 1 | -5% | 1 | 1 |
| 2 | -10% | 1 | 2 |
| 3 | -15% | 2 | 4 |
| 4 | -20% | 2 | 6 |
| 5 | -25% | 3 | 9 |
| 6 | -30% (max) | 3 | **12** |

**12 duplicates total to maximum per 1 skill** (was 32 · fixed because of the funnel numbers below)

- Higher steps cost more cumulatively, so boss farming stays valuable even with a complete collection
- **Every skill uses its own ladder**, not an account-wide one
- Lets late-dropped skills still catch up; skills owned since early game are stronger
- Ladder stacks with CDR, so the same skill differs per player even for the same drop
- **2:1 duplicate conversion rule** — any 2 duplicates from the list can be converted in the skill menu into 1 of a chosen skill · Without this rule farming cannot target which one completes, and the 2-4 full target never happens (option 1 that was pending in this file, decided with numbers)
- **The funnel math is generated** — `node tools/ladder.ts` owns the numbers below and reads them from the roster (`skills.json`), the skills-per-1,000-kills line `loot.md` F12 derives and the level-100 checkpoint (`checks.md` E5). Do not hand-type them.

<!-- BEGIN GENERATED:ladder-math -->
| Quantity | Value |
|---|---|
| roster | 74 skills |
| pool per zone | 74 ÷ 18 = **4.1** |
| funnel | 0.0192/kill × 60,031 kills = **1151 pieces** |
| ladder to max one skill | 12 duplicates = **24 pieces** via the 2:1 conversion |
| 4 maxed targets | **96 pieces = 8% of funnel = 5,006 kills** |
| remaining 70 skills | 1055 pieces → **15.07 each** |
<!-- END GENERATED:ladder-math -->

# Skill level

```
skill_xp += 1            for every kill, per skill in the list (attack / curse / heal) or open (aura)
skill_level = floor(skill_xp / 400) + 1
skill_level = min(skill_level, 20)          # Cap 20, not character level
multiplier  = 1 + skill_level x 1.5/100     # at 20 = x1.30
```

- **XP is per kill, not per press.** A skill earns while it is slotted whether or not it fired this second, so a long list, a mana-bound rotation or a high-cooldown build never slows levelling, and the track is the same kill stream the rest of the game is priced on (kills, loot.md section 2). This is the PoE model (socketed gems gain on kill), which is what was answered with.
- **Why the old curve was deleted**: `skill_level = (xp/1000)^(1/3) + 1` with 1 XP per press needs **6.86M presses** to reach 20 - roughly 147 days of non-stop casting at the reference rate. It also meant the only way to level was to build for cast rate, taxing the axis it was supposed to reward.
- **Kills to max one skill** = 7,600 kills of using it, in any band — a count, never a clock (`DECISIONS.md` D12). A skill picked up mid-run therefore catches up inside roughly one zone of play, which is the point of the Cap.
- **One rule for every type.** Attack, curse and heal skills gain while slotted; an aura gains while it is open and reserves normally. The level multiplier is the same +1.5%/step for all of them, and ≈8,000 uses is the number this file already quoted - now it is the actual rule instead of a hope.
- **Unequipped skills gain nothing**, and levelling is *separate* from the duplicate ladder (skill-pool-system.md above): level buys damage/effect up to x1.30, the ladder buys cooldown. Two tracks, one visible each.

# Numbers not yet fixed

<!-- BEGIN GENERATED:skill-drop -->
| Source | Rate | Spawns per kill | Skills per 1,000 kills |
|---|---|---|---|
| Boss (single, always online-only) | 35.0% per boss kill | 0.01 per kill | 2.4 |
| Elite (1 in 5 kills) | 8.0% per elite kill | 0.20 per kill | 16.0 |
| Normal mob | 0.10% per kill | 0.80 per kill | 0.8 |

**19.2 skills per 1,000 kills** in the high band (boss 2.4 + elite 16.0 + normal 0.8) — the rare item the whole skill list is gated on. Every number above comes from engine.json; the rates were previously quoted in this file and stored nowhere, so nothing could check them.
<!-- END GENERATED:skill-drop -->
- **Pool size per level range → closed by `node tools/ladder.ts --checks`** — the generated ladder block above prints the roster ÷ the world's zone count (LD3), so the per-zone pool is never typed here · The zone-pool rule itself is unchanged: a zone boss drops only that zone's pool, so the first new skill in a zone still matters
- **Press per skill → re-cut to a fraction of the finished hit (B5)**
  ```
  press = final_pct × basis × (1 + (skill_level − 1) × 1.5%)   · skill_level Cap 20 · basis = the finished physical hit, or the magic hit + Element × Alignment/100
  ```
  The band it was set on still holds — "the whole rotation is ×1.1-1.4 of the build" (checks.md E12) — and **gate S10 now reads that Cap multiplier out of the calculator** and fails if it leaves the band, so re-cutting `level_step_pct` cannot drift. What the old K was fitted with (the per-build uplift of ×1.33 glass / ×1.30 mix / ×1.43 Int6-Wis3 / ×1.90 Int8) was measured on the `stat% / power%` split and is superseded: the same figures are re-measured by `node tools/skills.ts --calc --build glass|caster`, and the skill share mob_HP folds (checks.md D17 · D4) moves with that measurement — and that pass has now run on a geared character (****): the list measures ×1.29 · ×1.44 · ×1.76 at Cap against the ×1.10 · ×1.20 · ×1.31 the curve spends, while the geared player still sits *under* the priced line, so the fold taken was none, and `mob.curve.skill_per_level` stays where the published mob line fits it. The reason the fold is not taken off one build alone is unchanged — an Int-heavy build leans on its skills for a much larger share of its damage because its auto hit is the lowest, and a longer list still does not raise DPS beyond the mana ceiling (maximum casts = mana_regen ÷ cost).
  → **This number creates real paths**: Int+Wis builds rely on skills for 47% of the build, glass relies 25% (rotation table at end of file). And **a longer list does not raise DPS beyond the mana ceiling** (maximum casts = mana_regen ÷ cost)
- **Mana cost** — **two forms, both resolved by one function** (`engine/skills.ts` `manaSpec` → `manaCostOf`): a `%` row charges that share of the usable pool, a `flat` row charges its own units grown by the skill-level step and the pool-growth exponent in `skills.json` `meta.formula`, quoted against the derived level-1 reference pool. Gate **S15** refuses a paid row with no readable unit, a row carrying both, or a flat row that resolves to nothing, and **S16** publishes the cost step against the press ramp; **S17** refuses an `(AoE ×n)` suffix that disagrees with `engine.json` `aoe.mana_mult`, which is where the multiplier actually lives. The measured figures are not printed here — `node tools/skills.ts --calc --pool N` prints what each row charges against any pool, and the rotation table below carries the read-out. Meaning is unchanged for the `%` rows: the long cooldown unit still cannot fire continuously, mana is still a real bottleneck, and repeated (buff) skills still have to sit at the end of the list or they steal mana from attack skills.
- **Duplicate ladder → decided (ladder 12 + 2:1 conversion), measured on the old 51-skill roster** — old 32 pure-random measured as *unreachable*: at 51 skills clustered in 6-per-zone pools, maxing one takes far more than the whole level-100 run · Of the three once-pending options, only 1+3 were used together (2:1 duplicate conversion and ladder cut to 12) because option 2 (smaller pool per zone) became impossible once the roster grew to 51 · Measured result: 4 maxed = 96 of 184 pieces (52% of funnel) within the run · The remaining 61 average 1.44 pieces = sit at step 1, which is intentional (this game never intends every skill maxed) · **The historical figures were sized on the old 51-skill roster; the live ones are recomputed by `node tools/ladder.ts --checks`** (LD3-LD5). History forcing the cut: pure random on a 43-skill roster needed several whole games per skill · Moving to 51 + 6-per-zone pools worsened it · Option 2 (smaller pool) became unusable as the roster grew, leaving option 1 (2:1 conversion) + option 3 (ladder 12), decided above
- **Iron Guard / Energy Guard reserve** — **closed.** Both were priced at **mid (11%)**; the `K_ARMOUR` (2) landed while the ES coefficient `K_INT_ES` was **retired** (owner ruling), so there is no `K_ENERGY_SHIELD` either — the shield is a gear pool (`Energy Shield flat` + `Max Energy Shield %`), not an Int line. The effect flats are set to 80% of each line's item ceiling, the Grace parity rule, and printed by `node tools/skills.ts` (skill-pool-aura-heal.md). 
- **Melee range** — **3 mobs count as "nearby"** (matches the "max 3 engage at once" rule in world.md). Damage-reduction auras and debuffs read this number

# Questions — all decided

(Every question this file raised is now answered; kept so none is re-litigated.)

1. **Should duplicates upgrade cooldown or duration** — decided: cooldown only (ladder in this file).
2. **Do monsters have skills** — decided (extended): skills follow the body tier — Small/Medium 0 (innate Element only), Large and Elite 1, Boss 1-2 — and each skill only re-times the mob's priced `mob_PS`, so `mob_HP` and the timeline never move (`combat.md` §5b). Normal mobs keep innate Element as their baseline.
3. **25% weapon-group bonus** — kept at 25% (P3). Strong enough to pull weapon choice without killing cross-group skills.
4. **Unlimited list, any problem with a complete collection** — decided: the active bar is **15 slots** (`skill-pool.md` owns the number), remainder stay in reserve · Buffs and auras sit on a separate toggle track and cost none of the 15.
