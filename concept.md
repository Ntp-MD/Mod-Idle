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

> **Closed**: offline cap = **12 hours** · Reason from numbers in loot.md: 12 hours = half of one zone crafting engine (Refine full set ~16 hours) and matches "1 work day" · Lower than this, players returning every morning will feel closing the game meant nothing · Higher than this, there is nothing urging a return.
> Offline gains match the table in this section: same drops but **quality is zone floor only** · No boss → no Add mod stones and no boss share of Reroll tier stones → the second half of the crafting engine is fully active (loot.md section 7).

# Game Breadth Replacing Skills

This game has no resource skills, but offers multiple parallel paths without click-switching.

| Path | What it is |
|---|---|
| **12 weapon types** | sword / axe / dagger / mace / spear / bow / crossbow / staff / rod / wand / two-handed sword / two-handed axe · Each type uses a different skill set (see equipment-weapon.md) |
| **5 Elements** | Each Element has different status and counter pairs · Must consider which monster Element will be faced |
| **43 skills** | Unlimited list, runs in order · Auras reserve Max Mana, player-managed · Buffs auto-recast on expiry (see `skill-pool.md`) |
| **Quality × Tier** | A single item can compete on multiple axes |
| **3 crafting commands** | Fix dropped items to fit the build |

**Weapon Mastery** — Each weapon type has its own XP, levels 1-20.
Bonuses have 2 layers: **while-equipped layer** (that weapon is lighter + skills of that weapon are stronger) and **account-wide layer** (+drop_rate per type reaching L10).
This lets players try swapping weapons to farm Mastery without ever leaving combat — because "collected" items count as permanent account bonuses.
Unlike Melvor, where skills must be swapped to farm XP — here only equipped items are swapped · And AFK still farms Mastery at full rate (formula + timeline in equipment-weapon.md).

> **Closed in equipment-weapon.md**: Mastery levels 1-20 per weapon type · XP from combat (1/hit + 4/kill) · L10 takes 0.73 hours at level 90. All 12 types account-wide = 8.8 hours.
> Bonuses = **weapon weight −1%/level** (while equipped) · **skill damage +0.5%/level from L5** (while equipped) · **drop_rate +1% per type at L10 or above** (account-wide, max +12%).
> Reason for no damage bonus: all weapon types are already tuned to equal DPS (`weapon_mult = 1.2 / weapon_aspd` · Proven equal at 9,847 across all 12 types). If Mastery granted damage, one weapon type would stay best forever and the "reason to try swapping weapons" would die · AFK still farms Mastery at full rate because it counts purely from attacks.

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
- **Decided (P0-2): "fast hit" stays as a hit-count build, not a DPS race.** Measured gap stands (Agi 12 = 3,830 vs Str 12 = 9,847) and its value must come from *hit count* (proc per hit · DoT tick · chill), with Riposte as its boss path (dodge-scaling damage). Full numeric rebalance deferred to the mob-sheet pass.

> **Fixed**: Wis previously had no outlet because there were no skills. Now `skill-pool.md` has skills that actually use CDR.
> Str/Int/Dex/Agi/Lck are stats that scale skills, so CDR values now have uses for every stat.

# Why Play This Instead of Melvor

| | Melvor | This game |
|---|---|---|
| Item depth | Items are tier + fixed craft values | mod × Item quality × tier × Element |
| Elements | None | 5 Elements with counters · Every zone has a native Element |
| Equipment slots | 10 slots differing only by name | 11 slots genuinely different, because Offensive comes from weapons only |
| Crafting | Craft by fixed recipe, inflexible | 3 commands: raise quality / raise slot / change slot |
| Skill count | ~20 | No resource-gathering skills · 43 skills = 31 active + 12 aura (the 12 passives became tree keystones) |
| What must be clicked | Swap across 20 things | Select zone and order the list |

# Failure Points

1. **Numbers offer nothing to watch except loot** — If the player sits in a zone with no progress, the game bores by day three. Answered by the task board (tasks.md): 3 visible slots with daily progress, plus the skill upgrade ladder.
2. **1 Offensive slot may be too narrow** — crit, attack speed, accuracy live on main hand alone (see `equipment-slot.md`). If every build feels identical in play, this rule must be relaxed.
3. **Random skill drops may frustrate players** — If bosses do not drop often enough, players will never get wanted skills no matter how long they play · Drop chances must be reviewed first.
4. ~~**Unlimited skill list**~~ **Answered with numbers** — Skill DPS is limited by mana_regen ÷ mana cost, not list length (K_SKILL=5 in skill-pool.md): a glass build casts ~0.13 times/sec whether placing 6 or 26 skills · A long list adds *flexibility against monsters*, not DPS · The real fix is list-ordering UI, not rules.
5. **Crafting may devalue dropped loot** — If raising tier to T1 is easy, good items equal common items. See open questions in `crafting.md`.
6. **Monsters still have no skills** — **Half-fixed in combat.md**: monsters need no skills to still shift our rhythm, because their Innate Element applies status to the player at 20% per landed hit — chill lowers aspd · shock stops attacks+regen · burn/poison are DoT · Our debuffs (Cripple · Blinding Mark) thus have real targets because monsters have their own clocks.
   **Decided (D-009 7b):** late-zone bosses gain 1-2 signature skills during zone design; normal and elite mobs keep innate Element only.

# Not Yet Defined

- ~~**Zone count and level pacing**~~ **Closed in world.md** — 9 zones × 10 levels · L10 0.5 hours · L30 3.1 · L60 12.6 · L90 31.2 · L100 40.2 hours.
- ~~**Game length**~~ **Closed** — Game ends at ~40 hours of real play (level 100) and ~31 hours for a finished crafted set · Levels 91-100 are the final 9 hours in zone 9 · **No prestige** in this version, because the post-completion loop must not break the calculated item quality core (original concern in this file).
- **Win condition — Decided** · Completion = **kill the zone 9 boss (level 90 · HP 283,516) within a single spawn without being Pushed** · A truly measurable number from combat.md section 7 (without heal: glass 125% / mix 117% / tank 114% / dodge 203% of pool = Push on every build · With ×1.52 heal: reduced to 82/77/75% = three of four pass). So it is not a gate requiring new items, but a gate requiring *heal casts*, which is what separates active play from AFK as G5 promised · Full-dodge is the only build that cannot finish without allocating slots to health (133%) · **After completion = continued improvement loop, no prestige**: levels 91-100 are the item-quality push in zone 9 (world.md) · Remaining goals are timed — Ascend full 12 pieces ~15 hours (E7) · Refine full set ~16 hours (E6) · Mastery 12 types to L20 ~39 hours · Full skill ranks for 2-4 skills ~24 hours/skill (E11).
- **Short-form content** — 9 bosses (1 per zone) per new zone numbers · **Achievements are cut** (D-009 7c) · Elite set at 1% of kills (loot.md).
- ~~**Settlements, travel and NPC stalls**~~ **Defined in towns.md** (doors chosen) — 3 capitals + 6 towns over the 9 zones · waypoints free, carriage priced, Road opt-in and online-only · NPC stalls sell space/time/information/appearance only · **gold now exists** as the quality-of-life medium, minted by the sell-or-dissolve choice and Road events only (`economy.md`, checks.md G6-G9) · Nothing gold buys grants power, so no new `mob_HP` term was needed (H1) and the 40.2 hr timeline stands.

(End of file - total 135 lines)
