# Skills system, AoE, passives, acquisition

import glossary.md
import formula.md
import combat.md
import world.md
import loot.md
import skill-tree.md

# How skills and normal attacks work together

**One clock · Two speed markets** — this is the core keeping "gear/tree/skill" from overlapping in meaning

1. **Auto does not stop when pressing skills** · Pressing a skill does not "replace" attacks, shift the attack table, or reset aspd (combat.md section 3 already sets a continuous clock)
2. **Skill damage does not multiply aspd** because the formula is `per press × (1/cd)` → aspd accelerates only auto, CDR accelerates only skills · The two are therefore separate markets and do not hit each other's Cap · **This is the answer to the "fast hit" fork** (checks.md group I): fast builds buy *hit count* (per-hit procs), not total DPS
3. **But weight tax cuts only aspd** → auto can lose up to −50% (formula.md section 11) while skills lose nothing · Heavy builds are thus "slow but still strong with skills", not weak in both directions
4. **Mana is the shared resource of skill/buff/aura · Auto is free** (only Leech turns auto into recovery) → builds without Int slots naturally get fewer skills — glass at level 100 cannot charge Cleave in time for its cd (11.54 sec vs 6 sec base cd)
   - **Auras reserve rather than drain** (see `skill-pool-aura-heal.md`). This does not change the sharing rule above, but it changes *when* it bites: an aura is a **static** claim on the pool taken before the fight, while a skill is a **live** claim paid per press. The player trades a fixed slice for guaranteed uptime instead of racing regen

**When it counts as a "hit"** (items 5-9 are what all game procs reference)

5. Every **damage instance** of a skill counts as 1 hit for per-hit procs (Sonic Blow · Brute · Flurry · Jinx · stun from Alignment · 20% status chance) · The `targets/hits` column in the skill table is this number
6. **DoT ticks do not count as hits** — no crit, no per-hit procs, no refresh of "per-hit" buffs · They are damage-over-time only
7. **Hit roll (accuracy vs evasion) rolls per instance** · If a skill says "guaranteed hit", it skips the roll only for that hit (Piercing Shot) · Note: in this game *monsters have no dodge* (formula.md section 9), so the old text "never misses from dodge" has been fixed
8. **Crit**: phys/magic instances crit normally · Elements do not crit per the original rule · Headshot adds crit chance only to that hit
9. **Multi-hits on different targets roll separately** (Whirlwind 3 hits = 3 rolls) but per-Element status stacks still use the same Cap (3 burn stacks / 10 poison stacks)

**Order and queue**

10. **No GCD** — skills are instant and the game runs top-down through the list, using the first skill with cd ready *and* enough mana · A skill stuck at the top long blocks lower ones forever → list order is a real lever, not formatting
11. Buffs have a "re-press when expired" switch (default on) · When off, no repeated mana cost · Heal should be set to the top of the list in boss zones because bosses require heal (combat.md §7)
12. **Cooldowns do not reset on Push** — HP depletion returns to the main preset, but skills already counting cd keep counting · Mobs do not die because we were pushed, so no fired work is lost

**True-number comparison** (glass Str 12 at level 100 · run `node tools/timeline.js`)

| What the player sees | Normal attacks | Skill (Cleave) |
|---|---|---|
| Rate | 2.094 hits/sec (every 478 ms) | 1 press/11.54 sec (mana is the bottleneck · 6 sec base cd) |
| Per press | 5,897 (expected including crit · 79.7% hit) | 8,828 spread over 3 targets = 5,297 per target |
| Added DPS | 9,847 (baseline) | +459 = **+5%** from a single skill |
| Accelerated by | aspd (Agi + Mod + weight) | CDR (Wis + Mod + Battle Orders) |
| Resource | Free | 2,424 mana pool · 31.5/sec regen |
| Feeds procs | 2.09 rolls/sec | 3 rolls in one press |

**Does the funnel shift — no** · mob_HP is multiplied by the skill factor `1 + 0.0034 × L` (×1.34 at L100) as recorded in checks.md D1/D17 · kills/hour · drops/hour · craft prices in loot.md therefore stay fixed (H1 preserved) · What changes is the *composition* of player-visible damage: Str builds get 75% auto + 25% skill, while 8-Int builds get 53% + 47% (rotation table at end of file) — and both remain under the gear ceiling

# AoE

**Monsters come in groups** (see world.md), so some skills hit more than 1 target

| Skill | How many it hits |
|---|---|
| Cleave · Volley · Frost Nova · Toxic Spray | All in range |
| Chain Spark | Main target + spread to 2 more |
| Rimbo Form · Elemental Fury | All in range · While the aura is open |
| Arcane Bolt · Piercing Shot · Guard Break · Arrow Shower · Execute | Single target |
| All 5 debuffs | Single target |
| Self buffs · heals · auras | Self |

## Damage rules

```
single target → 100% damage · mana cost 1.0×
AoE           → falloff per target · 5-target Cap · mana cost 1.0×
1 target 100% · 2 targets 85% · 3 targets 70% · 4 targets 60% · 5 targets 50%
```

- **Decided (P0-3): mana stays 1.0x for AoE and single alike; balance lives in the falloff only.** 2-target interpolated values (85% / 60%) are placeholders pending the rebalance pass with P0-2.
- **Skills are gated by mana** (maximum casts/sec = mana_regen ÷ cost) · The true currency of AoE is therefore "damage landed on monster HP per mana", not damage per press

| Targets hit | Damage/mana vs single (mana 1.0x) | Group clear time at L90 (glass) | Damage taken % of pool |
|---|---|---|---|
| 1 target | 1.00× | 0.90 sec (same as single — pending rerun) | 2% (same as single) |
| 2 targets | 1.70× | pending rerun (`tools/survival.js`) | pending rerun |
| 3 targets | **2.10×** | pending rerun | pending rerun |
| 5 targets | 2.50× (hits 5 Cap) | pending rerun | pending rerun |

- **AoE pays off at 2+ targets** → zones 1 (1-2 mobs) break-even · zones 4+ win clearly · Rebalance pending with P0-2.
- **Boss gate broken by this change and must be re-established in the rebalance pass.** Bosses are single → AoE now deals 1.00× damage per mana → fight length no longer stretches 2.5x. Old line (0.40× → 312% of pool = certain Push) no longer holds. Options for the pass: single-target damage bonus vs AoE, or boss AoE resistance. Old clear-time column above is stale until `tools/survival.js` reruns.
- **The 5-target Cap is the funnel lock** — loot.md sets kills/hour on this number. Raising the Cap from 3 to 5 shifts craft income across the file (see loot.md section 2). Rebalance pending.

## What AoE adds beyond damage

- **Statuses land on all targets** — burn from Arcane Bolt and poison from Toxic Spray stay on every target hit
- **Debuffs remain single-target** — because the Expose target must be chosen; spreading after investing mana would dissolve the value
- **Creates work queues** — Frost Nova chills all, so the remainder all attack slower equally

# 12 passives → now tree keystones

> This file no longer counts these 12 as skills (skill count = 43, i.e. attack 18 + buff 0 + curse 10 + heal 3 + aura 12 — buff roster cleared for redesign) · All 12 were moved to skill-tree keystones as decided in skill-tree.md section 5 · The table below remains as *value evidence* (5-30% each) referenced by the tree budget, not as a list players will equip

**Takes no skill slot · Costs no mana · Has no cooldown · Bought with skill points**

Passives are not plain numbers but combat-rule changes. Because if it were `+5% Str` it should be an Mod on gear instead, without needing a player-decision point

> **Not yet the final list** — expected to move into the skill tree (see skill-tree.md). This table exists to show what good nodes look like; true cost and placement wait for tree design

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
| 12 | **Brute** | 5 | Every monster kill: all damage +3%, maximum +30%, resets when dodged |

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
- **Brute must reset on dodge**. Without reset, players would accumulate to +30% permanently without killing anything

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
- **The funnel math is generated** — `node tools/ladder.js` owns the numbers below and reads them from the roster (`skills.json`), the 4.6 pieces/hr rate (loot.md F12) and the 40 hr game (checks.md E5). Do not hand-type them.

<!-- BEGIN GENERATED:ladder-math -->
| Quantity | Value |
|---|---|
| roster | 43 skills |
| pool per zone | 43 ÷ 9 = **4.8** |
| funnel | 4.6/hr × 40 hr = **184 pieces** |
| ladder to max one skill | 12 duplicates = **24 pieces** via the 2:1 conversion |
| 4 maxed targets | **96 pieces = 52% of funnel = 20.9 hr** |
| remaining 39 skills | 88 pieces → **2.26 each** |
<!-- END GENERATED:ladder-math -->

# Skill level

```
skill_xp gained from using that skill
skill_level = floor((skill_xp / 1000) ^ (1/3)) + 1
skill_level = min(skill_level, 20)          # 20-step Cap, not character level
multiplier = (1 + skill_level × 1.5/100)        # maxed = ×1.30
```

- **Fixed from "Cap = character level"** · The old model gave ×2.0 at level 100, which combined with a 3-skill rotation pushed every build DPS up 33-133% beyond the gear ceiling and broke the folded `mob_HP` (×1.34) across the line · The 20-step Cap (×1.30) keeps `node tools/skills.js` numbers inside the band checks.md D17 sets
- More frequent firing levels faster, like Melvor using this formula · 1 XP per press per instance (multi-hit grants multiple XP per press)
- **Cap at 20** lets mid-game new skills still "catch up" within 1 week of real play (20 steps ≈ 8,000 uses)
- Unequipped skills gain no XP · Auras gain XP per open second, independent of what they cost

# Numbers not yet fixed

- ~~**Max Mana must be reduced** — currently `K_INT_MP` = 8~~ **This text is left over from an old version** · `K_INT_MP` has long been 4. What was truly wrong is `K_INT_MREGEN` = 0.2, which left pool/regen at 29.7 seconds instead of the intended 40 · Fixed to 0.15 in formula.md section 5
- **Drop chance per skill range** — set in loot.md: **boss 35% per kill · elite 8% · normal mobs 0.1%**. In the high zone this yields about boss 1.4 + elite 1.4 + normal 1.8 = **~4.6 skills per hour** · The duplicate-protection rule in this file makes every early piece guaranteed new
- **Pool size per level range → needs rerun (was closed for 51 skills)** — 9 zones ÷ 51 skills = 6 per zone was the old answer · **At the current roster of 43 it becomes 4.8**, which makes the ladder *easier* (fewer targets to spread 184 pieces across) · The zone-pool rule itself is unchanged: a zone boss drops only that zone's pool, so the first new skill in a zone still matters · `node tools/ladder.js` does not exist yet, so no corrected figure is proposed here
- **K per skill → re-decided: `K_SKILL = 1.5` (was 5)**
  ```
  skill_damage = (stat × K_stat × stat%/100 + power × power%/100) × K_SKILL × (1 + skill_level × 1.5/100)   · skill_level Cap 20
  ```
  The 1.5 comes from the target "whole rotation = ×1.1-1.4 of build" (old 5 was set for a single skill · 3-skill rotation exceeded the gear ceiling 33-133%). Measured across all builds (level 100 · average 1.6 presses per 8 sec): at K_SKILL = 1.5 with a 3-skill rotation (run `node tools/skills.js`): uplift per build = glass ×1.33 · mix ×1.30 · Int6/Wis3 ×1.43 · Int8 ×1.90 but *all totals still below the gear ceiling* (133% / 88% / 83% / 69% of 9,847) · The honest conclusion: the ×1.1-1.4 band written in skill-tree.md section 3 **holds only for builds spending slots on non-Int Str/Vit/Agi**. Builds giving 8 slots to Int get skills as the majority of the build (47%) because their auto is low — not stronger than glass but *more skill-dependent*, and this is why mob_HP must fold ×1.34 (D17), not fold to any single build
  → **This number creates real paths**: Int+Wis builds rely on skills for 47% of the build, glass relies 25% (rotation table at end of file). And **a longer list does not raise DPS beyond the mana ceiling** (maximum casts = mana_regen ÷ cost), which answers concern 4 in concept.md with numbers, not limits
- **Mana cost** — ~~half-checked~~ **fully checked across the roster** (line below) · The old line still holds at pool 4,848 / 122/sec regen: 10% skill = 485 mana = 4.0 sec of regen per press. Meaning the 6-sec-cd unit cannot fire continuously (mana is a true bottleneck as designed) · But 2-3 units in 10 seconds still work. Verified with `node tools/skills.js` · 3 attack-skill + 3 support rotation consumes almost all regen on every build (glass cannot charge Cleave in time for cd: 11.54 sec vs 6 sec cd) → *mana is a true bottleneck as designed*, and repeated (buff) skills must sit at the end of the list or they steal mana from attack skills
- **Duplicate ladder → decided (ladder 12 + 2:1 conversion), measured on the old 51-skill roster** — old 32 pure-random measured as *unreachable*: at 51 skills clustered in 6-per-zone pools, maxing one takes 41.7 hours (almost the whole 40-hour game) · Of the three once-pending options, only 1+3 were used together (2:1 duplicate conversion and ladder cut to 12) because option 2 (smaller pool per zone) became impossible once the roster grew to 51 · Measured result: 4 maxed = 96 of 184 pieces (52% of funnel) in 20.9 hours · The remaining 47 average 1.9 pieces = sit at step 1, which is intentional (this game never intends every skill maxed) · **All of these figures are sized on 51 skills. The roster is now 43, so every number here is stale** — re-check with `node tools/ladder.js --checks` when that tool exists. History forcing the cut: pure random on 43 needed ~300 hours each (7x the whole game) · Moving to 51 + 6-per-zone pools worsened it (41.7 hours each) · Option 2 (smaller pool) became unusable as the roster grew, leaving option 1 (2:1 conversion) + option 3 (ladder 12), decided above
- **Iron Guard / Energy Guard reserve** — the two unpriced auras cannot be given a reserve value until `K_ARMOUR` / `K_ENERGY_SHIELD` land (skill-pool-aura-heal.md · Blocker 1). Do not hand-pick a number by feel
- **Melee range** — **3 mobs count as "nearby"** (matches the "max 3 engage at once" rule in world.md · D-009 7a). Damage-reduction auras and debuffs read this number
- ~~**Death rules**~~ **Closed in combat.md** — no death · Uses `Push` (HP depleted → rest `Max HP ÷ (hp_regen × 8)` sec). Heal therefore buys *time*, not *life*, and is measurable (combat.md section 6 · `node tools/survival.js`): at the level-100 boss, the full-Str build takes 87% of pool, which already passes · The one that gets **pushed is dodge at 137%** because pool equals glass but kills 2.6x slower · Heal (Greater Heal + Heal = pool ×1.52) pulls dodge down to 90% → narrow pass · The role of heal in this game is "opening boss doors for non-tanky builds", not "preventing general death". This is the direct answer to the old question "without death, do healing skills lose meaning"

# Questions to decide

1. **Should duplicates upgrade cooldown or duration** — decided: cooldown only (ladder in this file).
2. **Do monsters have skills** — decided: late-zone bosses gain 1-2 signature skills during zone design. Normal and elite mobs keep innate Element only.
3. **25% weapon-group bonus** — kept at 25% (P3). Strong enough to pull weapon choice without killing cross-group skills.
4. **Unlimited list, any problem with a complete collection** — decided: max 20 actives in the list, remainder stay in reserve.
