# Skills

import skill-pool-attack.md
import skill-pool-buff.md
import skill-pool-curse.md
import skill-pool-aura-heal.md
import skill-pool-system.md

**First draft** — skills divide into 3 types: **active** (has cooldown, costs mana) · **aura** (persistent, reserves Max Mana) · **passive** (takes no slot, costs no mana)
The core rule is that a skill must change **what you do**, not just add numbers. If it is only numbers, it should be an Mod instead

# Detail files
- skill-pool-attack.md — attack skills (Fireball..Pierce the Veil)
- skill-pool-buff.md — buff skills (roster cleared for redesign)
- skill-pool-curse.md — curse skills + attach rule (Weaken..Pandemonium)
- skill-pool-aura-heal.md — Reservation + heals + auras + baseline
- skill-pool-system.md — combat clock + AoE + passives→keystones + acquisition + ladder + level + open numbers

<!-- BEGIN GENERATED:skill-count -->
# Skill count = 74

| Type | Count | Controlled by |
|---|---|---|
| **attack** | 39 | Order list · cd + mana |
| **buff** | 8 | Timed self-buff - own cd and duration, never persists between fights |
| **curse** | 11 | Attached to target · Uses same hit_chance as attacks |
| **heal** | 3 | Same list (key on bosses) |
| **aura** | 13 | Player-managed set · **Reserves Max Mana** |
| **total** | **74** | Attack set picked · buff + aura carried from the live roster |

> **The attack roster is the picked set.** The Elemental rows replaced the retired attacks and the physical block is carried from the live roster, so `skill-pool-attack.md` prints the roster's own count. The buff, curse, heal and aura rows are unchanged.
<!-- END GENERATED:skill-count -->

# Skill frame

| Property | Value |
|---|---|
| Element / type | physical · magic · fire · cold · lightning · poison · chaos · none |
| Base Cooldown | 4-12 seconds · aura has no cooldown |
| Mana cost | **% of Max Mana** or **flat units** — the row states which · skills pay on press · auras **reserve** a % of pool |
| Scales with stat | Str / Int / Dex / Agi / Wis / Lck |
| Weapon group | Usable with all weapons · Matching group grants bonus |
| Ladder | Reduces cooldown from duplicate skills |
| Skill level | Gains XP from use, maximum equals character level |

**A mana cost is written in one of two forms and the unit is part of it**: `%` charges that share of the usable pool, `flat` charges its own units. Both are read by the same resolver in `engine/skills.ts` (`manaSpec` → `manaCostOf`), which throws on a row whose unit is missing — a cost that parsed as nothing would make the skill free. **A flat cost is quoted at skill level 1 against the level-1 reference pool**, then grows on two terms the data owns: a per-level step steeper than the press ramp, and a power of the pool's own growth, so Int and `Max Mana` gear keep setting the price instead of only widening the bar. The keys are `skills.json` `meta.formula` and the reference pool is derived, never typed. The unit travels into every roster table because the tables print the row's own string; `tools/skills.ts --calc` prints what each row charges for a pool you pass.
**"Weapon power" in the skill table = character phys/magic power** from formula.md sections 1-2, not the power value of the weapon piece (this game has no Base power per weapon type · decided in formula.md).
- **A press is one percentage of the hit the build already deals**, taken from the finished physical hit or the magic hit plus Element — the full form and its level ramp live in `skill-pool-system.md`, and `tools/skills.ts` prints every row's measured press. The old `stat × K_stat × stat% + power × power%` split is retired: a skill inherits gear and globals rather than dipping into the stats a second time.
- **Cooldown calculation order**
```
cooldown = base_cooldown * (1 - ladder/100) * (1 - cdr/100)
```
- Ladder always applies before CDR, so CDR still matters at full ladder

# Weapon groups
**Skills fit all weapons**, then grant a bonus if the weapon matches the group
| Group | Weapons | Bonus |
|---|---|---|
| melee | sword · axe · dagger · mace · spear · two-handed sword · two-handed axe (7 types) | skill damage +25% |
| ranged | bow · crossbow (2 types) | skill damage +25% |
| magic | wand · staff (2 types) + book in off hand | skill damage +25% |
- **Dagger moved from ranged back to melee** · The old weapon-types file mislabeled a heading as "Ranged (one-handed)" even though the list was sword/axe/knife, so the table dragged dagger into ranged · Now follows equipment-weapon.md (11 types · melee 7 / ranged 2 / magic 2)
- **Mastery stacks on top of the group bonus**: held weapon gains +0.5% skill damage per Mastery level from L5 (maximum +8%) · Counted *after* this +25% group bonus (equipment-weapon.md) · And it is a bonus specific to "which weapon is held", not making any weapon type permanently better
**Why a bonus, not a requirement** — if matching weapons were required to equip, a sword player would never see dagger skills even when dropped. Dropped items would become unusable. With this design no skill is dead, but players are still pulled toward weapon choice

# How to equip skills
**Max 20 actives in the list**. Equip up to 20 owned actives · The game runs by **placed order**
## Active list
| Position in list | Meaning |
|---|---|
| Top | Used first |
| Lower | Used when upper ones are unavailable |
- The game cycles top to bottom, using the first skill with **cd ready and enough mana**
- No complex conditions · No manual presses · Players only arrange order
## Aura
**Not in the list, kept separately** because aura is not an action but a persistent state
| Property | Value |
|---|---|
| Cost | **Reserved % of Max Mana** — unusable by skills while the aura is open |
| Limit | **The player chooses the set; total reserved mana may not reach 100% of the pool** — no other cap |
| Switch | **Player-managed.** The player opens and closes auras; the system only blocks a selection that would reserve 100% |
- The player manages the set directly — there is no automatic top-down opening and no 45% Cap
- Because a reservation is static, the player can read the whole aura budget before pressing anything — unlike the old drain table, where auras opened and closed live against regen
- **The old "open while mana ≥ 25%" rule is deleted.** Full rules in `skill-pool-aura-heal.md`
## Buff
**In the list like active**, but with an extra switch
| Switch | Default | Effect |
|---|---|---|
| Re-use when expired | On | Game re-presses immediately when the buff expires, without counting as a press round |
- Turning this switch off = press once and hold without re-pressing, so it does not consume mana repeatedly
- Without this switch, the game would burn CDR and mana on buffs that have not expired, wasting the queue
## Preset
**6 sets can be stored**, with automatic selection per zone
- On Push (HP depleted · see combat.md), return to the main preset
- In an idle game players swap builds often; arranging one by one each time would waste time
