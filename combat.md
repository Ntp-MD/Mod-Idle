# Combat

import core-stats.md
import formula.md
import elements.md
import world.md
import skill-pool.md

Closes gaps referenced by other files but never defined: **how hard mobs hit back · how fast · damage order · and what happens when HP runs out.**

Prior decision still in force (from earlier notes · commit `908cbf7` in git history): **no death · the currency of this game is time · Defensive value comes from `Push`, not from survival.**
This file is the mechanism that makes that statement actually calculable.

```
dodge / res reduce incoming damage
  → less Push
    → less wasted time
      → kph does not drop
        → items per hour do not drop
```

# 1. Attack Clock

**No turns · every unit has its own timer.**

| Timer owner | Value |
|---|---|
| Player | attacks every `100/aspd` seconds (Cap = 3 times/sec) |
| Normal / elite mobs | 1 time/sec |
| Boss | 0.8 times/sec (slow but heavy · gives time to read status) |
| All DoT ticks | tick once per 1 second |
| Status (chill/shock/mark) | counts down in real time on target |

- A real idle game must run continuously, not in turns · world.md already states "all units in the group attack in the same round", which in this model means every unit has its own timer running together.
- `shock` stops the target clock for 1 sec (attacks stop + regen stops) — the reason lightning stun matters when we are the ones hit.

# 2. Damage Order, Player Side

**Outgoing (we hit mobs)**

```
1  hit_chance  = accuracy / (accuracy + evasion_mobs)      evasion = mob_level × 1
2  crit?       = crit_chance → ×(1 + crit_dmg/100 − 1)      physical / magic only · Elements do not crit
3  weak?       = ×1.5 if weapon Element matches mob innate Element
4  Element counter  = elements.md table (0.60–1.15)
5  subtract from mob HP
```

**Incoming (mobs hit us)** — ordered differently because we have no evasion stat.

```
1  perfect_dodge  (Cap 5%)   pass = nothing happens · this is the only path that blocks "undodgeable" effects
2  evasion        (PoE entropy vs mob accuracy)  pass = no hit · new layer, numbers pending mob sheet
3  dodge          (Cap 90%)  pass = no hit · opposed by mob accuracy (P1-1 option A2)
4  split damage   = 50% physical (reduced by armour) + 50% Element by mob innate Element
5  armour         = armour / (armour + 5 × raw_hit) reduces the physical half only (PoE formula)
6  Energy Shield takes damage before HP (chaos bypasses) · recharges after 5 sec without a hit
7  Elemental resistance of that Element (Cap 75) → reduces only the Element half
8  apply that Element status (gated by Alignment on the mob side, see section 5)
9  subtract from player HP
```

- **No separate `def` / armor / damage reduction** — damage reduction has only dodge and Elemental res. These two are therefore all players can use against incoming damage (HP is the receiver, not the reducer).
- **Mob innate Element serves two ways**: it is the Element we hit for ×1.5, and it is the Element it hits us with → **res must be prepared from the zone played, not rolled randomly** (confirms the world.md line stating "res must be prepared in advance").
- Perfect dodge must come before dodge because its definition is "dodge the undodgeable" (DoT tick · unconditional effects such as an aura's debuff). **Dodge is an opposed roll against accuracy; perfect dodge is not opposed** — when it triggers, the hit is removed outright (D-009 3c). Without this order the stat is meaningless.

# 3. Mob Stats Per Level

Baseline is set from **DPS players at the same level actually have** per formula.md section 0, not set-then-tuned.

```
mob_HP(L)   = DPS of level L player with "mid-Tier + expected item count" gear × tree multiplier × 1 second
              item count = min(12, ceil(L/2))   → L1 = 1 item · L24+ = full 12
              tree multiplier = 1 + 0.0085 × L   → ×1.25 (L30) · ×1.85 (L100) · see skill-tree.md section 3
mob_PS(L)   = typical_gear_DPS(L) / 27   (not mob_HP / 27)
skill multiplier = 1 + 0.0034 × L  → ×1.30 (L90) · ×1.34 (L100)   (HP line includes it · damage line excludes it)

> **Why the damage line is not set from mob_HP** — mob_HP is multiplied by the tree factor (×1.85 at L100) to keep TTK at 1 sec · if that same number were divided by 27, damage would also grow ×1.85 while the player pool does not grow with tree (tree is the speed side, not the endurance side) · the result is on-level gear+tree players dying in 14 sec instead of 27 sec, and groups of 5 pushing every build, which destroys the AFK promise in concept.md · the damage line is therefore set from `typical DPS (gear only) ÷ 27` = "one mob kills an on-level player in 27 sec", measured on players who *have* tree already · intended side effect: tree power shortens fights = less danger · if an endurance tree is ever added, this line must be moved back to divide the pool (recorded in checks.md group I)
mob_acc     = no roll · mobs always swing · our side uses dodge only
```

| Level | 1 | 5 | 10 | 20 | 30 | 40 | 60 | 80 | 90 | 100 |
|---|---|---|---|---|---|---|---|---|---|---|
| mob HP | 121 | 271 | 682 | 1,527 | 2,289 | 5,404 | 7,992 | 16,137 | 18,901 | 22,016 |
| mob damage/sec | 4 | 9 | 23 | 45 | 61 | 131 | 163 | 280 | 304 | 329 |

- This line is calculated from `mod-pool.md` (T2 ranges of each Item quality tier) + `formula.md` sections 0-7 · full table and per-zone time lines are in world.md.
- **TTK = 1 sec for on-level gear+tree players** · full T1 gear + typical tree = 0.90 sec · full T1 gear but *no tree* = 1.67 sec (mob HP already includes tree) · naked entering a new zone = 2-8 sec · per skill-tree.md section 3 formula.
- Numbers in the table are **gear × tree × skill** · split to see origin: typical gear = 8,881 · full T1 gear = 9,847 · multiplied by tree (+85%) and skill list (+34%) factors = **22,016** that typical players have at level 100 · see skill-tree.md section 3.

| Player gear level (Str-stacked build) | Level 1 | Level 30 | Level 60 | Level 100 |
|---|---|---|---|---|
| No gear · level-only stats | DPS 69 | 390 | 833 | 1,610 |
| Full Quality-tier gear (12 T1 items of that tier) | — | 1,980 | 4,860 | 9,847 |
| → **Actual mob HP set (typical gear × tree × skill by level)** | 121 | 2,289 | 7,992 | 22,016 |

- Full-tier gear is **5-6x stronger than no gear** at level 100 (9,847 vs 1,610) and 5.1x at level 30 · this number is the ceiling loot can buy, and the reason this is a loot game, not a level game.
- **The two rows above are the lower-upper bounds of a single player at that level** · the mob HP table above is set *between the two rows* (T2 gear with expected item count) so fresh zone entrants can still kill and full-gear players feel no drag · full-tier gear is 5-6x stronger than no gear at level 100 (9,847 vs 1,610). This is why this is a loot game, not a level game.

| Type | HP | damage/sec | Count | Reference |
|---|---|---|---|---|
| Normal | ×1 | ×1 | comes in groups 1-5 (world.md) | |
| Elite | ×6 | ×4 | always 1, spawn 0.5% of kills, drops 2 Reroll tier stones | mini-boss · Item quality floor +1 tier (P1-2 option A) |
| Boss | ×15 | ×4 | always 1 | zone Quality ceiling + craft currency + skill |

# 4. `Push` — Mechanism Replacing Death

```
HP reaches 0  →  no death · no item loss
  1. Stop attacking immediately, leave zone back to camp
  2. Recover at camp_regen = hp_regen × 8 until full
  3. Re-enter the same zone automatically (AFK keeps walking, no input needed)
  4. Time lost = Max HP / (hp_regen × 8)
```

| Build at level 100 | Vit invested | Max HP | hp_regen | Downtime per Push |
|---|---|---|---|---|
| Full Str all 12 items (glass) | 210 (none) | 9,466 | 53/sec | **23 sec** |
| Str 6 / Agi 3 / Vit 2 / Lck 1 | 286 | 11,225 | 72/sec | 20 sec |
| Vit 10 / Agi 2 (tank) | 690 | 20,602 | 173/sec | **15 sec** |
| Agi 8 / Vit 4 (dodge) | 372 | 13,224 | 93/sec | 18 sec |

- **Vit pays twice**: raises the blood ceiling, and shortens downtime · the reason tanks are not "hard to kill" (nobody dies) but **lose less time**.
- No other penalty · no item loss, no XP loss, no zone rollback · the only loss is time · per the original decision.
- On Push, switch back to the main preset (skill-pool.md already states "on death return to main set" — that phrase now means Push).

# 5. Status Mobs Leave on Players

Uses all rules and numbers from elements.md, but the player is the target.

| Mob Element | Effect on player | Value | Counter |
|---|---|---|---|
| fire | burn | `elem_half × 0.30` per stack, max 3 stacks · 4 sec | res · perfect dodge |
| cold | chill | aspd −10% (half of what mobs take) · 3 sec · does not stack | res |
| lightning | shock | stop attacking + stop regen 1 sec · rolls once per attack | res |
| poison | poison | `elem_half × 0.08` per stack, max 10 · loses 1 stack/8 sec | res · perfect dodge |
| chaos | its own mark | its damage +0.5% per stack, max +10% | res · target switching |

- **20% status proc chance per landed hit** · mobs need no skills of their own · innate Element is their skill.
- `elem_half` = the Element half of calculated per-hit damage (section 2 item 3).
- Reason chill/shock are halved on players: the only target this game must beat is our own time. Reducing our aspd 20% across 5 mobs at once = over half DPS gone with no player input.
- **Healing skills have clear work from this table**: Heal (4% Max HP/sec × 8 sec) = +32% pool · Greater Heal (20% instant) = blocks Push at the last few %.

# 6. Measured Results: Which Build Survives What (All Numbers From `node tools/survival.js` · No Hand-Typed Values)

> Stale pending rerun: tables below predate P0-1 (full Element damage), P0-3 (AoE falloff), P1-1 (dodge 90 + mob accuracy + PoE defense), and P1-2 (Elite ×6/×4). Rules above are decided; numbers below rerun in the rebalance pass. Do not hand-edit.

**Build definitions** — 12 worn items split to Core stat only · main hand holds same T1 Mod of the Quality tier (power Flat 80 / power % 16 / aspd 25% / crit 8%) for all builds · level 100 `stat_c` = 210 · all builds have on-level tree (DPS ×1.85).

| build | 12-item split | Str | Vit | Agi | Max HP | regen/sec | dodge | res |
|---|---|---|---|---|---|---|---|---|
| glass | Str 12 | 816 | 210 | 210 | 8,160 | 53 | 38% | 10.5% |
| mix | Str 6 / Vit 3 / Agi 3 | 468 | 328 | 328 | 10,515 | 82 | 44% | 16.4% |
| tank | Vit 12 | 210 | 816 | 210 | 20,280 | 204 | 38% | 40.8% |
| dodge | Agi 12 | 210 | 210 | 816 | 8,160 | 53 | 60% (old cap; new cap 90, opposed by mob accuracy, path pending) | 10.5% |

**Field rules** (these 3 rules define the numbers below; changing any requires a rerun):

1. **Max 3 mobs engage at once** — groups of 5 do not hit with 5 sets at once · mobs 4-5 queue.
   Without this rule, "group of 5" numbers jump from 23-46% → **109-180%** of pool → AFK breaks immediately · the rule is therefore not taste but what makes the concept.md promise true (world.md zone properties section).
2. **hp_regen works during combat** — the reducer is `incoming damage − regen` · hence tanks beat bosses despite lowest DPS.
3. **Kill one by one in spawn order** for this table · AoE follows the skill-pool.md AoE rule (60% per target · Cap 3 · mana ×1.5), which measures 20% faster on groups of 3+ and *slower* on groups of 1-2 than single target.

### Level 100 · mob HP 22,016 · mob damage 329/sec

| build | Total DPS with tree | Actual taken (after dodge+res) | 1 mob | group of 5 | elite | boss | boss + heal |
|---|---|---|---|---|---|---|---|
| glass | 18,217 | 59% of incoming | 2% (0.9 sec) | 29% (4.5 sec) | 11% (2.7 sec) | **119% (13.5 sec) → Push** | 78% |
| mix | 12,385 | 51% | 1% (1.3 sec) | 27% (6.6 sec) | 10% (4.0 sec) | **112% (19.9 sec) → Push** | 74% |
| tank | 4,948 | 49% | 0% (3.3 sec) | 23% (16.6 sec) | 6% (10.0 sec) | **109% (49.8 sec) → Push** | 72% |
| dodge | 7,089 | 38% | 2% (2.3 sec) | 46% (11.6 sec) | 17% (7.0 sec) | **190% (34.8 sec) → Push** | **125% → Push again** |

heal = ×1.52 of pool (Greater Heal 20% + Heal 4%/sec × 8 sec) · boss damage set at **×4** of mob PS (reason below item 2 + section 7).

Reading:

1. **AFK is truly safe in all builds** — groups of 5 cost 23-46% of pool and Push nobody at matching level (and 0-10% in lower zones) · this is the number confirming the concept.md promise, not just text.
2. **Boss is an active-play gate, not a DPS gate** — at boss damage ×3 only the dodge build is pushed, while glass 87% / mix 80% / tank 69% *kill while idle* → conflicts with the rule stated in crafting.md/checks.md G5 that "AFK cannot kill bosses" · raised to ×4, all builds are pushed at zone 9 without heal, and with heal three of four pass (78/74/72%) · this number is why ×4 was chosen, not taste.
3. **Pure dodge loses to bosses even with heal (125%)** — same pool as glass but fight lasts 2.6x longer. The fix is already in the numbers: split 4 items to Vit to drop to ~97% of pool with heal (at L90) · a "dodge everything" build must therefore reserve slots for blood, not pure 12-item dodge · links to the fast-hit fork in checks.md group I.
4. **Elite is provably too weak** — only 6-17% of pool, *lower than groups of 5 in every build* despite being a special event · still a fork for player ruling (D12).
5. **AoE is now a choice, not free** — under the new rule (Cap 3 targets · mana ×1.5) groups of 5 take 3.75 sec instead of 4.50 sec and take 25% instead of 31%, still better *but* single targets take 2.5x longer and bosses 2.5x longer = 312% of pool = certain Push · details in skill-pool.md AoE section (D11 closed).

# 7. Boss — Combat Rules (Measured For All Builds At All Zone Edges)

```
HP = mob_HP(zone level) × 15      damage = mob_PS × 4      always single      spawns every 15 min per zone
Loss = pushed → boss retreats + full HP + spawn ends (must wait for next spawn)
Potions = suppressed by boss aura (farm.md) — bosses are won with casted heals only
```

The "loss forfeits the spawn" rule is what gives the numbers below meaning: if continuous retries were allowed, bosses would be just long mobs because Push costs only 12-19 sec (calculated table in section 4 · glass 19 sec / tank 12 sec) against a 900 sec spawn cycle.

**Why boss damage is ×4 not ×3** — this is a rule change by evidence, not taste · at ×3 only the dodge build was pushed at zone 9, while glass 87% / mix 80% / tank 69% *killed bosses while idle*, contradicting the announced rule across files that "AFK cannot kill bosses" (checks.md G5 · crafting.md) · at ×4 all builds are pushed at zone 9 without heal, and with heal three of four pass · the real gate happens at this number.

All tables run from `node tools/survival.js` (field rules: max 3 mobs engage · regen works during combat · single-target).

| Zone (level) | boss HP | build | Fight time | No heal | With heal |
|---|---|---|---|---|---|
| 10 | 9,898 | glass | 2.0 sec | 12% | 8% |
| 10 | 9,898 | mix | 3.6 sec | 4% | 2% |
| 10 | 9,898 | tank | 23.3 sec | 0% | 0% |
| 10 | 9,898 | dodge | 12.1 sec | 44% | 29% |
| 30 | 31,158 | glass | 4.5 sec | 27% | 18% |
| 30 | 31,158 | mix | 7.8 sec | 19% | 13% |
| 30 | 31,158 | tank | 32.1 sec | 0% | 0% |
| 30 | 31,158 | dodge | 17.9 sec | 65% | 43% |
| 60 | 99,563 | glass | 9.2 sec | 72% | 48% |
| 60 | 99,563 | mix | 14.6 sec | 64% | 42% |
| 60 | 99,563 | tank | 44.6 sec | 52% | 34% |
| 60 | 99,563 | dodge | 27.6 sec | **132% Push** | 87% |
| 90 | 283,516 | glass | 13.5 sec | **125% Push** | 82% |
| 90 | 283,516 | mix | 20.2 sec | **117% Push** | 77% |
| 90 | 283,516 | tank | 52.4 sec | **114% Push** | 75% |
| 90 | 283,516 | dodge | 35.5 sec | **203% Push** | **133% Push** |

Reading:

1. **Boss is an endurance + time gate, not a DPS gate** — even max-DPS glass is pushed at zone 9 because bosses stretch to 13.5-52 sec, long enough that regen cannot yet close the gap · the only *survivor* without heal is tank at zone 60 (52%).
2. **Heal is the button that wins bosses** — ×1.52 of pool turns all three zone 9 pushes into 82/77/75% · meaning idle (AFK) players forfeit the spawn every 15 min = matches crafting.md intent that the second half of crafting is active play.
3. **Clear difficulty ladder**: zones 1-3 barely threaten (0-65%) · zone 60 starts filtering (only dodge loses) · zone 90 is the wall · so the boss HP multiplier in early zones no longer needs lowering (the old proposal to cut 15 → 10 no longer applies · old numbers were set on ×3 damage).
4. **Pure dodge is the only build that cannot beat bosses** — 203% / 133% even with heal because same pool as glass but 2.6x longer · evidenced fix: split 4 items to Vit → ~97% of pool at zone 9 (still marginal) · links to the "can fast hit be a build" fork in checks.md group I.
5. **Tank wins but 3-4x slower** (52.4 sec vs 13.5 sec) with the smallest pool cost · measured trade-off: fast = must press heal, slow = safe.

# 8. Gaps This File Still Cannot Close (With Reasons)

- ~~HP/PS between levels~~ **Closed** — formula `min(12, ceil(L/2))` items + full table above + 9 zones in world.md.
- ~~Mobs per group per zone~~ **Closed in world.md** — 1-2 (zones 1-3) · 2-3 (zones 4-6) · 3-5 (zones 7-9).
- ~~Base kph~~ **Closed in loot.md** — 980 / 1,385 / 1,800 kills/hour by Quality tier · drops 133 / 255 / 418 items/hour (`node tools/check.js --checks` reads both lines back out of loot.md).
- **Only elite needs ruling** — elite is weaker than groups of 5 (17% vs 46% at worst for dodge) · AoE already fixed to Cap 3 targets + mana ×1.5 (skill-pool.md · checks.md D11 closed).
- **Should XP differ per monster type** — currently `xp = 10 × level` for all types · if elite/boss should grant bonus XP it must be decided when setting the new time line.
