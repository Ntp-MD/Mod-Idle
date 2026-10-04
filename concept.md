# Concept

import glossary.md
import world.md
import skill-pool.md
import item-rarity.md
import crafting.md

Uses the Melvor Idle frame, but deliberately diverges from it.

**One line** — Grind monsters and assemble a build from dropped items. Every drop forces a keep-or-trash decision.

# Main Decision: No Resource Skills

Melvor has ~20 skills (gather/find/craft/cook). This game has only **combat**.

| Reason | |
|---|---|
| Every non-combat skill becomes a clicker the player ignores | The more skills there are, the more upkeep must be checked |
| If wood gathering existed, every drop would become mere material | Loot excitement would disappear |
| Depth should live in items, not in skill count | This game already offers mod × quality × tier × element × crafting decisions |

**Cost to accept** — While AFK the player has nothing else to switch to.
This is not fixed by adding skills, but by making **combat meaningful enough to repeat long-term**. See Rarity.

> **Narrow exception (farm.md): a 3-plot herb farm exists as timers only — no levels, no XP, no skill.** It costs 2 taps a day, outputs potion herbs only, never gear or power. It does not reopen the skill-count question above: nothing here levels, nothing here is upkeep-gated, and potions never heal on bosses.

# Core Loop

```
Select zone → Fight monsters → Gain XP + items + crafting currency → Decide equip/craft → Next zone
```
- The same loop, in place names (`towns.md`): arrive at a settlement → sell or dissolve the junk at its counter → use the stalls and the bench → take the Waypoint to the next zone. Settlements add no clicks to automate and no power.

| Layer | What it is | What it unlocks |
|---|---|---|
| **Zone** | Levels 1-90 divided into bands (see world.md) | Higher-level monsters · Item quality ceiling rises |
| **Build** | 11-slot set + weapon | Attack speed · What can be resisted |
| **Weapon Mastery** | Separate XP per weapon type | Lighter equipped weapon + stronger skills of that weapon · Account-wide +drop_rate |
| **Boss** | Special monster fightable at every level | Quality ceiling of that zone · Crafting currency |

# Active vs AFK

This is the most important design decision in this game. If designed wrong, the game dies on day two.

| | Active | AFK |
|---|---|---|
| What the player does | Select zone · Order skills in list · Enable aura · Switch preset | Do nothing |
| Loot | Full | Full |
| Item quality | Floor–ceiling | Floor only · No high-quality items from AFK |
| Boss | Yes | No |
| Efficiency per hour | 100% | 40-50% |

**Decision rule** — The player must gain something from staying in the game that closing the game does not give.

Three items currently planned:

1. **Quality ceiling** — AFK drops only floor quality of the zone. High-quality items require being online or coming from crafting.
2. **Skill ordering and aura** — Unlimited list length. The more skills known, the better the ordering, and auras reserve a share of Max Mana that the player manages directly (total may not reach 100%), so the player reads the aura budget up front instead of recalculating it while fighting.
3. **Boss** — The only place high-quality items drop without crafting · And the only place to get duplicates for upgrading skills.

> **Closed with numbers** (loot.md section 7): AFK kill rate is **identical at 100%** · Same drop count · **Full XP** (intentional) · Only 2 real differences are ① Drop quality is *zone floor only* ② Reroll tier stones are only 18 of 30 per hour (no boss) and Add mod stones = 0 (boss-bonus XP excluded too, P1-3) → the second half of the crafting engine is fully online.
> Combined, gear progress while AFK stays around **40-50%** as intended, without cutting kill rate · And **AFK grants full XP** because cutting both XP and quality would make closing the game feel like unmeasurable waste.
> Risk from these numbers: AFK is not *slower*, it is *shallower* · The game must keep "zone floor" progressing, otherwise the first night offline will feel empty.

> **Closed**: offline cap = **12 hours** · Reason from numbers in loot.md: 12 hours = about twice a full-set Refine pass (6.4 hr · E6) and matches "1 work day" · Lower than this, players returning every morning will feel closing the game meant nothing · Higher than this, there is nothing urging a return.
> Offline gains match the table in this section: same drops but **quality is zone floor only** · No boss → no Add mod stones and no boss share of Reroll tier stones → the second half of the crafting engine is fully active (loot.md section 7).

# Game Breadth Replacing Skills

This game has no resource skills, but offers multiple parallel paths without click-switching.

| Path | What it is |
|---|---|
| **12 weapon types** | sword / axe / dagger / mace / spear / bow / crossbow / staff / rod / wand / two-handed sword / two-handed axe · Each type uses a different skill set (see equipment-weapon.md) |
| **5 Elements** | Each Element has different status and counter pairs · Must consider which monster Element will be faced |
| **Combat skills** | Unlimited list, runs in order · Auras reserve Max Mana, player-managed · count and split in `skill-pool.md` |
| **Quality × Tier** | A single item can compete on multiple axes |
| **3 crafting commands** | Fix dropped items to fit the build |

**Weapon Mastery** — Each weapon type has its own XP, levels 1-20.
Bonuses have 2 layers: **while-equipped layer** (that weapon is lighter + skills of that weapon are stronger) and **account-wide layer** (+drop_rate per type reaching L10).
This lets players try swapping weapons to farm Mastery without ever leaving combat — because "collected" items count as permanent account bonuses.
Unlike Melvor, where skills must be swapped to farm XP — here only equipped items are swapped · And AFK still farms Mastery at full rate (formula + timeline in equipment-weapon.md).

> **Closed in equipment-weapon.md**: Mastery levels 1-20 per weapon type · XP from the character XP kill stream (4/kill, no hit term · D-065) · L10 takes 1.13 hours at level 90. All 12 types account-wide = 13.5 hours.
> Bonuses = **weapon weight −1%/level** (while equipped) · **skill damage +0.5%/level from L5** (while equipped) · **drop_rate +1% per type at L10 or above** (account-wide, max +12%).
> Reason for no damage bonus: all weapon types are already tuned to equal DPS (`weapon_mult = 1.2 / weapon_aspd` · Proven equal at 9,847 across all 12 types). If Mastery granted damage, one weapon type would stay best forever and the "reason to try swapping weapons" would die · AFK still farms Mastery at full rate because it counts purely from kills.

# Build

From the system in `formula.md` where all 7 stats use the same scale, builds are not separated by stat weighting but by **where Mods are invested**.

| Build | Weapon | Defensive pieces focus | What to watch |
|---|---|---|---|
| physical burst | sword / axe | Max HP % | crit chance + crit damage on main hand |
| magic burst | staff / rod / wand | Max Mana % · CDR % | Magic power + Alignment |
| fast hit | dagger / bow | Dodge Flat % | Attack speed % · Core stat Agi |
| elemental dot | any with Element | Elemental res of the used Element | Alignment + burn/poison |
| dodge tank | shield / mace | Dodge + Max HP | Core stat Vit + Agi |
| loot | anything | anything | Core stat Lck · drop rate |

- Every build uses Core stats from all pieces; they differ in which one is stacked.
- Lck is the only stat helping both DPS (crit) and loot (drop), so it is the most valuable long-term build. Must be watched so it does not dominate.
- **Decided (P0-2): "fast hit" stays as a hit-count build, not a DPS race.** Measured gap stands (Agi 12 = 3,830 vs Str 12 = 9,847) and its value must come from *hit count* (proc per hit · DoT tick · chill), with Riposte as its boss path (dodge-scaling damage). The numeric rebalance that line deferred to the mob-sheet pass has now run on geared characters (**D-106**): the same bag spent two ways leaves the hit-count build at ×0.87 of the big-hit build and carries **more** of its damage through a swing or something a swing left behind, so the identity holds and no number moved. The thin leg is the procs themselves — `harness/todo.md` B22.

> **Fixed**: Wis previously had no outlet because there were no skills. Now `skill-pool.md` has skills that actually use CDR.
> Str/Int/Dex/Agi/Lck are stats that scale skills, so CDR values now have uses for every stat.

# Why Play This Instead of Melvor

| | Melvor | This game |
|---|---|---|
| Item depth | Items are tier + fixed craft values | mod × Item quality × tier × Element |
| Elements | None | 5 Elements with counters · Every zone has a native Element |
| Equipment slots | 10 slots differing only by name | 11 slots genuinely different, because Offensive comes from weapons only |
| Crafting | Craft by fixed recipe, inflexible | 3 commands: raise quality / raise slot / change slot |
| Skill count | ~20 | Combat skills only in this count (count and split in `skill-pool.md` · the old passives became tree keystones) · the one life skill, Farming, is a separate provisioning track (`farm.md`), not in the combat roster |
| What must be clicked | Swap across 20 things | Select zone and order the list |

# Failure Points

1. **Numbers offer nothing to watch except loot** — If the player sits in a zone with no progress, the game bores by day three. Answered by the task board (tasks.md): 3 visible slots with daily progress, plus the skill upgrade ladder.
2. **1 Offensive slot may be too narrow** — crit, attack speed, accuracy live on main hand alone (see `equipment-slot.md`). If every build feels identical in play, this rule must be relaxed.
3. **Random skill drops may frustrate players** — If bosses do not drop often enough, players will never get wanted skills no matter how long they play · Drop chances must be reviewed first.
4. **Crafting may devalue dropped loot** — If raising tier to T1 is easy, good items equal common items. See open questions in `crafting.md`.
5. **Monster skills and the status mirror — Closed in `combat.md` §5b (D-067)** — mobs add skills by body tier (Small/Medium 0, Large and Elite 1, Boss 1-2) and every skill only re-times its priced `mob_PS`, so `mob_HP`, kills/hour and the timeline never move. Player statuses mirror three ways: DoT and damage-shaping debuffs land on mobs in full (our curses have real targets because monsters keep their own clocks), and control is Cap-bounded — a mob takes the ≤15% stun and the per-status aspd cuts but can never be locked, so no fight is stun-locked and no boss loses its clock. Innate Element stays every mob's baseline: its status still hits us at 20% per landed hit — chill lowers aspd · shock stops attacks+regen · burn/poison are DoT.

# Minute One

**A client builds the starting character from one read of `engine.json` `opening`.** Nothing below
is hand-typed — the table is generated, and five opening checks hold it against the mob curve.

<!-- BEGIN GENERATED:opening -->
| | Given | Why |
|---|---|---|
| Settlement | **Eastgate** (zone 1, levels 1-10) | the zone the player opens in |
| Level | **1** · 12 each stat · 240 Max HP · 3.0 regen/sec | level-1 baseline, no gear |
| Gear | **1 item**: one-handed sword, low quality T3, Physical power flat +15 | the floor of the low-quality table |
| Skills | **none** | the first skill is the first boss drop |
| Gold / stones | **0 / 0** | minute one buys nothing |
| First rule | **kill 5 in zone 1** (from the Guild counter, Eastgate) | the task board already exists and pays stones only |

**First fight, measured:** a level-1 character kills a zone-1 mob in **1.3 sec** as the curve prices it, and in **2.5 sec** as a character actually carrying the 35-weight sword swings it (§11 takes 46% of aspd against a 24 capacity · survives **168 sec** of the mob's return damage). Numbers come from the same engine the cages use, so the opening cannot drift away from the mob curve it is priced against.
<!-- END GENERATED:opening -->

- **Why the starting weapon is the worst roll in the table.** The mob-health curve already prices a
  level-1 zone-1 mob against a character holding one weapon, so a top-tier free weapon would pay out
  more damage than the curve allows. The floor of the low-quality table is what the curve expects.
- **Why there is no starting skill.** The curve gives a level-1 character almost no skill power, so
  a free attack skill would be power the mobs are not priced against. The first skill is the first
  boss drop, which is also the first moment the skill axis becomes visible.
- **Why the first rule is a hunt task.** The task board already exists and pays stones only, so the
  opening instruction costs no new system and no power outside the loot funnel.

# Not Yet Defined

- **Win condition — Decided** · Completion = **kill the zone 9 boss (level 90, HP 160,635) within a single spawn without being Pushed** · A truly measurable number from combat.md §6/§7 and `node tools/survival.js` (**SV6**): without heal three of the four builds are Pushed, and one heal round (pool ×2.09) passes all but the dodge build. So it is not a gate requiring new items, but a gate requiring *heal casts*, which is what separates active play from AFK as G5 promised · Full-dodge is the only build that cannot finish without allocating slots to health · **After completion = continued improvement loop, no prestige**: levels 91-100 are the item-quality push in zone 9 (world.md) · Remaining goals are timed — Ascend full 12 pieces ~15 hours (E7) · Refine full set ~16 hours (E6) · Mastery 12 types to L20 ~60 hours · Full skill ranks for 2-4 skills ~24 hours/skill (E11).
- **Short-form content** — 9 bosses (1 per zone) per new zone numbers · **Achievements are cut** (D-009 7c) · Elite set at 1 in 5 kills (D-041 · `engine.json` `elite_spawn_chance`).

(End of file - total 135 lines)
