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
Evasion / res reduce incoming damage
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
1  hit_chance  = accuracy / (accuracy + mob evasion)   mob evasion is a Dex line on its own stat block (formula-utility.md §8)
2  crit?       = crit_chance → ×(1 + crit_dmg/100 − 1)   physical only · magic and the 5 Elements do not crit (D-017)
3  weak?       = ×1.5 if weapon Element matches mob innate Element
4  Element counter  = elements.md table
5  mob armour  = armour / (armour + 5 × the non-Element part)   the mob's own Str line, the same PoE ratio that answers its hit on us (D-099) · cut by our Armour penetration % (crossbow Base Mod, D-123)
6  mob res     = Elemental resistance of that Element            the mob's own Vit line, held by the same Cap 75 ours is (D-099)
7  bleed       = physical hits may inflict bleed, which is physical DoT and no Element (formula-offense.md §4)
8  subtract from mob HP
```

**Steps 5-6 are the mirror of the incoming order, and they are what makes the two lines `mob-roster.md` prints per species real** (B8 · D-099). The non-Element part of our hit — physical **and** spell — meets the mob's Armour; only the Element part meets its resistance. A Chill line cuts that Armour by `status.chill.armour_cut` before the ratio is taken, which is where the debuff finally spends itself, and the crossbow's Armour penetration % cuts the same ratio by its own fraction (over-penetration is wasted, never an amplifier — D-123). DoT is deliberately outside both steps: `status.mob_side` says burn, poison and bleed land in full, and formula-offense.md §4 says armour does not reduce bleed. A mob has no *mitigation* stat of its own beyond these two — no evasion double-dip, no damage reduction — and mobs have no resistance to status at all (D-067).

**Incoming (mobs hit us)** — PoE layer order: roll to miss, then every mitigation, then the pools (D-010).

```
1  perfect_dodge  (Capped by engine.json caps.perfect_dodge)   pass = nothing happens · this is the only path that blocks "undodgeable" effects
2  evasion        (Cap 80%)   Dex rating rolled against this mob's accuracy, then + Agi ÷ 30 points, capped together (D-112)
3  block          the shield's Base Mod line, rolled after evasion · pass = the hit is deleted outright (formula-defense.md, the block section)
4  damage split   = 50% physical + 50% Element by mob innate Element
5  armour         = armour / (armour + 5 × raw_physical) reduces the physical half only (PoE formula)
6  Elemental resistance of that Element (Cap 75) → reduces the Element half
7  damage_taken   × damage_taken_mult            buffs only · Berserker ×1.15 · Iron Will ×0.90
8  Energy Shield takes the mitigated damage before HP (chaos bypasses) · recharges after 3 sec
9  apply that Element status (gated by Alignment on the mob side, see section 5)
10 subtract from player HP
```

- **Perfect dodge is one roll and it answers everything** — it deletes the whole hit before the physical/Element split, so a magic-only species (Seraph · Slime) dies to it exactly like a physical one. That is what makes it the undodgeable answer, and why nothing else in this list is ordered ahead of it.
- **Block is a second avoidance layer, and the only exception to the one-avoidance-layer rule.** It is a flat percentage the shield's Base Mod line prints, bounded by `caps.block`, rolled after perfect dodge and evasion; a blocked hit is gone entirely, before the split, exactly like a dodge. Evasion keeps its own Cap — only the block path is exempted.
- **Step 7 is the only multiplier that runs after every mitigation layer and before the pools.** Armour, res, Evasion, block and perfect dodge each *remove* something; `damage_taken_mult` *scales what survived them*. That is why `Berserker` and `Iron Will` are exact opposites on the same line, and why Energy Shield at step 8 absorbs the multiplied number rather than the clean one.
- **No separate `def` stat.** Damage reduction is armour on the physical half and Elemental res on the Element half; Evasion and perfect dodge remove the hit instead of reducing it. HP and Energy Shield are receivers, not reducers.
- **Two umbrella multipliers are reserved, both ×1.00 today.** `global damage` multiplies outgoing damage once, after weak / Element counter / crit; `global defend` is this step-6 `damage_taken_mult` bucket. A future skill or aura feeds one bucket, so the two never stack as separate multipliers (`engine.json` `global`). `global speed` is a third reserved term: it scales the whole clock — cooldowns tick 15% faster (applied after the CDR Cap, so it is a post-cap speed multiplier) and final attack speed is ×1.15, still clamped by the 500 aspd Cap (`skill-pool-aura-heal.md`). **Player-only:** global speed affects the player alone; no mob ever carries Haste, even once mobs get their own skill lists.
- **Mob innate Element serves two ways**: it is the Element we hit for ×1.5, and it is the Element it hits us with → **res must be prepared from the zone played, not rolled randomly** (confirms the world.md line stating "res must be prepared in advance").

# 2b. Reach — near and far, without a grid

Near and far are a queue order, not a position. There is no movement, no range and no aggro model
in this game: the front slot hits the first 3 attackers and everything behind waits (section 1).

<!-- BEGIN GENERATED:reach-table -->
| Reach band | Slots it may hit | What that buys | Weapons |
|---|---|---|---|
| melee | 1 | the front slot only | sword · axe · dagger · mace |
| reach | 2 | front and second slot | spear · two-handed sword · two-handed axe |
| standoff | 3 | any slot in the group | bow · crossbow · staff · wand · book |

Stand-off lineages on the mob side: Elf · Demon · Seraph — they hold no front slot, so while a front mob lives they can only be reached by a reach-2 or reach-3 attack, and their half of incoming damage is the res-able one (D-030). A reach-1 attack waits one engage cycle (1 sec) when only stand-off mobs remain; the measured cost is nothing in zones 1-6 and at most 8.7% of the cycle in zone 9 (**X33**).
<!-- END GENERATED:reach-table -->

# 3. Mob Stats Per Level

Baseline is set from **DPS players at the same level actually have** per formula.md section 0, not set-then-tuned.

```
mob_HP(L)   = DPS of level L player with "mid-Tier + expected item count" gear x
              item count = min(12, ceil(L/2))   → L1 = 1 item · L24+ = full 12
               no tree multiplier                  (the passive tree is empty - see skill-tree.md)
mob_PS(L)   = typical_gear_DPS(L) / 27   (not mob_HP / 27)
skill multiplier = 1 + 0.0034 × L  → ×1.30 (L90) · ×1.34 (L100)   (HP line includes it · damage line excludes it)

> **Why the damage line is not set from mob_HP** - mob_PS is `typical_gear_DPS / 27`, a fraction of the player's own output, not a share of the mob's HP. `mob_HP` carries only the skill multiplier.
mob_acc     = no roll · mobs always swing · our side uses Evasion only
```

- The per-level curve, its HP anchors and the derived damage line are the generated `mob-curve` block in `world.md` (**X37**) — never typed here. The body-class and species multipliers (Normal · Elite · Boss · Small · Medium · Large) are the generated `mob-sheet` / `mob-stats` blocks in `world.md`.
- **TTK = 1 sec for on-level gear players** by the D1 definition · full T1 gear kills faster and a naked zone entrant slower (checks.md D3-D5). The curve already carries the skill multiplier; there is no tree factor (D-046).

# 4. `Push` — Mechanism Replacing Death

```
HP reaches 0  →  no death · no item loss
  1. Stop attacking immediately, leave zone back to camp
  2. Recover at camp_regen = hp_regen × 8 until full
  3. Re-enter the same zone automatically (AFK keeps walking, no input needed)
  4. Time lost = Max HP / (hp_regen × 8)
```

<!-- BEGIN GENERATED:push-table -->
| build | Vit | Max HP | hp_regen | Downtime per Push |
|---|---|---|---|---|
| glass | 210 | 19,910 | 53/sec | **47 sec** |
| mix | 285 | 23,570 | 71/sec | **41 sec** |
| tank | 535 | 35,770 | 134/sec | **33 sec** |
| evasion | 210 | 8,160 | 53/sec | **19 sec** |
<!-- END GENERATED:push-table -->

- **Vit pays twice**: raises the blood ceiling, and shortens downtime · the reason tanks are not "hard to kill" (nobody dies) but **lose less time**.
- No other penalty · no item loss, no XP loss, no zone rollback · the only loss is time · per the original decision.
- On Push, switch back to the main preset (skill-pool.md already states "on death return to main set" — that phrase now means Push).

# 5. Status Mobs Leave on Players

Uses all rules and numbers from elements.md, but the player is the target.

<!-- BEGIN GENERATED:mob-status -->
| Mob Element | Effect on player | Value | Counter |
|---|---|---|---|
| fire | burn | `elem_half × 0.30` per stack, max 5 stacks · 5 sec · **and cuts our HP regen 10% per stack (−50% at full)** | res · perfect dodge · regen is the only counter |
| cold | chill | aspd −10% (half of what mobs take) · 3 sec · does not stack · **and cuts our Armour 25%** | res |
| lightning | shock | stop attacking + stop regen 1 sec · rolls once per attack · **and −20% our attack speed, and −20% our Alignment against that target** | res |
| poison | poison | `elem_half × 0.08` per stack, max 10 · loses 1 stack/8 sec | res · perfect dodge |
| chaos | its own mark | its damage +1% per stack, max 25 stacks = **+25%** · +5.00% leech at full · decays 5 sec after firing stops | res · target switching |

- **20% status proc chance per landed hit** · innate Element is every mob's baseline skill; Large · Elite and Boss add a signature that only re-times its priced `mob_PS` (`combat.md` §5b · D-067).
- Every number in this table comes from `engine.json` `status` — the mob side runs the same K values the player does, so a change there moves this table with it. The chaos mark is the one row that once disagreed here; the table is generated now so it cannot again.
<!-- END GENERATED:mob-status -->

- `elem_half` = the Element half of calculated per-hit damage (section 2 item 3).
- **20% status proc chance per landed hit** · innate Element is every mob's baseline skill; Large · Elite and Boss add a signature that only re-times its priced `mob_PS` (section 5b · D-067).
- Every number in this table comes from `engine.json` `status` — the mob side runs the same K values the player does, so a change there moves this table with it. The chaos mark is the one row that once disagreed here; the table is generated now so it cannot again.
- **Healing skills have clear work from this table** — the magnitudes are in `skill-pool-aura-heal.md`; the point is that a status is answered by regen and by deleting the tick, not by mitigation.

# 5b. Mob Skills and the Status Mirror

Two questions the mob side left open (`formula-offense.md` kept the door open): do mobs get skills, and do the statuses we inflict mirror onto them. Both are ruled (D-067).

**Mob skills are a re-timing of `mob_PS`, never extra power.** A mob skill moves the same priced damage around the fight — a burst then a gap — it does not raise the average damage per second. `mob_PS = typical_gear_DPS ÷ 27` and the `mob_HP` curve are untouched, so kills/hour, drops/hour and the published timeline do not move (H1 · checks.md E5). `tools/survival.ts` keeps modeling mob incoming as the steady average, which is exactly what a re-timing leaves behind; a future cage may model the burst shape, but no number changes until it does. No mob carries `global speed` / `Haste` (D-061) and mobs get no new stat (AGENT.md §5 — no second resist, no mob Armour line beyond the Str one they already carry).

**Organization — skills follow the body, not the species** (D-009 7b extended):

| Body | Skills | What it is |
|---|---|---|
| Small · Medium | 0 | innate Element only · the 20% status proc (section 5) *is* the skill |
| Large | 1 | one signature that re-times its damage or adds a DoT slice |
| Elite | 1 + flag | the Large signature carried on the Elite multipliers (HP ×6 · damage ×4) |
| Boss | 1-2 | its own telegraphed burst, sized so one heal round still clears the fight (section 7) |

The signature is picked from what the species already means: the high-Str physical lineages (Orc · Golem · Troll · Drake) inflict **bleed**, the casters lean on their innate Element's status, and the accuracy-floor lineages re-time into bursts an Evasion build can drop. The species table in `mob-roster.md` is the input; nothing there blocks shipping.

**Bleed is the mob-side DoT** (engine.json `bleed`): it is a DoT so it lands on mobs in full from our `Lacerate`, and in the other direction it is the signature the physical lineages carry onto us — either way a slice of already-priced `mob_PS`, not added damage.

**The status mirror — three families (owner ruling: DoT yes, control no).**

- **DoT lands** — burn · poison · bleed apply to mobs at full value. They are the element build's damage, already folded into `mob_HP`, so applying them costs no new power.
- **Damage-shaping debuffs land** — every curse (Weaken · Expose · Sunder · Blinding Mark · Jinx · Mark of the Executioner · Venom Bind · Shatter · Pandemonium · Lacerate) plus chill's Armour cut apply: they change damage in or out, not whether the mob acts. This is why concept.md's "our debuffs have real targets" still holds.
- **Control is bounded, never a lockout** — a mob cannot be rooted, frozen, or held past its action, so no build deletes a boss's clock and no fight is stun-locked. The one control a mob suffers is the game's existing Cap-bounded proc: the ≤15% stun (elements.md lightning · C10) and the per-status aspd cuts (chill · shock · `Cripple`) — the same symmetric numbers a mob inflicts on us, gated so they read as a breather, not a chain. That keeps lightning's time-control identity and C10 real without letting control become the trivializing lock the ruling rejects. No mob resist stat exists; the gate is the Cap and the duration, not a defense line.

# 6. Measured Results: Which Build Survives What (All Numbers From `node tools/survival.ts` · No Hand-Typed Values)

> Rerun with `node tools/survival.ts` (gates SV1-SV8). The old hand-run tables are gone: they predated full Element damage, the opposed Evasion formula and the Elite multipliers, and they were labelled as tool output while no tool existed.

**Build definitions** — 12 worn items, every one carrying Stat Mod flat at high-quality T1; each theme then spends the slots its theme needs on the defensive Mods those slots are allowed to roll (`equipment-slot-pools.md` mod-matrix); the main hand holds the T1 offensive line (power Flat 80 / power % 16 / aspd 25% / crit 8%). There is no passive tree (D-046), so the skill list is the only multiplier above gear. This table is generated by `node tools/survival.ts` — never hand-typed.

<!-- BEGIN GENERATED:build-defs -->
| build | 13-item split | Str | Vit | Dex | Agi | Max HP | regen/sec | Evasion | res |
|---|---|---|---|---|---|---|---|---|---|---|
| glass | Str 13 | 535 | 210 | 210 | 210 | **19,910** | 53 | 33.0% | 10.5% |
| mix | Str 7 / Vit 3 / Agi 3 | 385 | 285 | 210 | 285 | **23,570** | 71 | 35.5% | 52.7% |
| tank | Vit 13 | 210 | 535 | 210 | 210 | **35,770** | 134 | 33.0% | 75.0% |
| evasion | Agi 13 | 210 | 210 | 210 | 535 | **8,160** | 53 | 75.4% | 38.9% |
<!-- END GENERATED:build-defs -->

**Field rules** (these 3 rules define the numbers below; changing any requires a rerun):

1. **Max 3 mobs engage at once** — groups of 5 do not hit with 5 sets at once · mobs 4-5 queue.
   Without this rule, 5 attackers replace 3 and the group cost scales by roughly 5/3, which is enough to Push every build while idle · the rule is therefore not taste but what makes the concept.md promise true (world.md zone properties section).
2. **hp_regen works during combat** — the reducer is `incoming damage − regen` · hence tanks beat bosses despite lowest DPS.
3. **These tables are `tools/survival.ts` output, not a hand run** · AoE follows the skill-pool.md AoE rule (60% per target · Cap 3 · mana ×1.5), which measures 20% faster on groups of 3+ and *slower* on groups of 1-2 than single target.

### Level 100 · the zone-9 mob (mob HP 10,709 · damage 304/sec)

<!-- BEGIN GENERATED:survival-mob -->
**Level 100 · one mob**

| build | Str | Vit | Dex | Agi | Max HP | regen/sec | evasion | res | taken/sec | pool used | time |
|---|---|---|---|---|---|---|---|---|---|---|
| glass | 535 | 210 | 210 | 210 | **19,910** | 53 | 33.0% | 10.5% | 73 | 0.1% | 1.1 sec |
| mix | 385 | 285 | 210 | 285 | **23,570** | 71 | 35.5% | 52.7% | 44 | 0.0% | 1.4 sec |
| tank | 210 | 535 | 210 | 210 | **35,770** | 134 | 33.0% | 75.0% | 27 | 0.0% | 2.9 sec |
| evasion | 210 | 210 | 210 | 535 | **8,160** | 53 | 75.4% | 38.9% | 28 | 0.0% | 2.0 sec |
<!-- END GENERATED:survival-mob -->

### Level 100 · a group of 5 (3 engage at once)

<!-- BEGIN GENERATED:survival-group -->
**Level 100 · a group of 5 (3 engage at once)**

| build | Str | Vit | Dex | Agi | Max HP | regen/sec | evasion | res | taken/sec | pool used | time |
|---|---|---|---|---|---|---|---|---|---|---|
| glass | 535 | 210 | 210 | 210 | **19,910** | 53 | 33.0% | 10.5% | 218 | 0.9% | 1.1 sec |
| mix | 385 | 285 | 210 | 285 | **23,570** | 71 | 35.5% | 52.7% | 133 | 0.4% | 1.4 sec |
| tank | 210 | 535 | 210 | 210 | **35,770** | 134 | 33.0% | 75.0% | 81 | 0.0% | 2.9 sec |
| evasion | 210 | 210 | 210 | 535 | **8,160** | 53 | 75.4% | 38.9% | 85 | 0.8% | 2.0 sec |
<!-- END GENERATED:survival-group -->

### Level 100 · an elite

<!-- BEGIN GENERATED:survival-elite -->
**Level 100 · an elite**

| build | Str | Vit | Dex | Agi | Max HP | regen/sec | evasion | res | taken/sec | pool used | time |
|---|---|---|---|---|---|---|---|---|---|---|
| glass | 535 | 210 | 210 | 210 | **19,910** | 53 | 33.0% | 10.5% | 521 | 16.1% | 6.8 sec |
| mix | 385 | 285 | 210 | 285 | **23,570** | 71 | 35.5% | 52.7% | 286 | 7.8% | 8.6 sec |
| tank | 210 | 535 | 210 | 210 | **35,770** | 134 | 33.0% | 75.0% | 164 | 1.5% | 17.4 sec |
| evasion | 210 | 210 | 210 | 535 | **8,160** | 53 | 75.4% | 38.9% | 156 | 15.1% | 11.9 sec |
<!-- END GENERATED:survival-elite -->

### Level 100 · the zone-9 boss

<!-- BEGIN GENERATED:survival-boss -->
**Level 100 · the zone-9 boss**

| build | Str | Vit | Dex | Agi | Max HP | regen/sec | evasion | res | taken/sec | pool used | time |
|---|---|---|---|---|---|---|---|---|---|---|
| glass | 535 | 210 | 210 | 210 | **19,910** | 53 | 33.0% | 10.5% | 2,604 | 219.4% | 17.1 sec → **Push** |
| mix | 385 | 285 | 210 | 285 | **23,570** | 71 | 35.5% | 52.7% | 1,356 | 117.1% | 21.5 sec → **Push** |
| tank | 210 | 535 | 210 | 210 | **35,770** | 134 | 33.0% | 75.0% | 754 | 75.6% | 43.6 sec |
| evasion | 210 | 210 | 210 | 535 | **8,160** | 53 | 75.4% | 38.9% | 688 | 231.8% | 29.8 sec → **Push** |
<!-- END GENERATED:survival-boss -->

heal = one round, `engine.json` `build.heal_pool_mult` · boss damage set at **×16** of mob PS (reason below item 2 + section 7).

Reading:

1. **AFK is safe in every build, and the reason is regen, not armour** — read the cost off the generated group table above (the Evasion build pays the most: smallest pool, least mitigation). A build whose regen outpaces the incoming rate simply never loses HP, which is why those numbers sit where they do.
2. **The boss Pushes most builds in the generated table above** — heal is the button that wins bosses, so an idle (AFK) player forfeits the spawn every 15 min. That is exactly the crafting.md intent that the second half of crafting is active play, and **SV6** holds it.
3. **The Elite is a real event** — the generated `survival-elite` block prices it *above* a group of 5 in every build. The old table called the Elite provably too weak; that was a symptom of the old field rule, and it no longer holds now that the Elite is 1 mob in 5 and worth ×6 HP.
4. **Armour and resistance do the work, Evasion does not** — the tank build barely registers the boss because 75% res plus Str armour covers it, while the Evasion build's chance leaves most of every hit landing on a small pool. Both are under the Cap; neither is a free win. (The percentages are in the generated table above.)
5. **DPS decides the length, not the outcome** — the tank build fights the boss longest and takes the least of its pool; glass kills it fastest and takes the most. Survival time and clear time are separate axes, which is why no single build is best at both.

# 7. Boss — Combat Rules (Measured For All Builds At All Zone Edges)

```
HP = mob_HP(zone level) × 15      damage = mob_PS × 16      always single      spawns every 15 min per zone
Loss = pushed → boss retreats + full HP + spawn ends (must wait for next spawn)
Potions = suppressed by boss aura (farm.md) — bosses are won with casted heals only
```

The "loss forfeits the spawn" rule is what gives the numbers below meaning: if continuous retries were allowed, bosses would be just long mobs because Push costs only a fraction of the 900 sec spawn cycle.

**Why boss damage is ×16, not the old ×4** — this is a rule change by evidence, not taste. `tools/survival.ts` prices the boss against the level-100 zone-9 fight, and two facts set the number: without heal most builds must be Pushed, or "AFK cannot kill bosses" (checks.md G5) is false; and with one heal round the boss stays a heal gate rather than a damage gate. At the old ×4 most builds killed the boss while idle; ×16 restores the promise, and **SV6** now gates both halves.

Every table in §6 and §7 is generated by `node tools/survival.ts` (field rules: max 3 mobs engage · regen works during combat · single-target · heal = one round of the heal skills).

<!-- BEGIN GENERATED:survival-boss-zones -->
**Boss at every zone edge** (player at that zone's level · boss damage ×16 · heal = pool ×2.09)

| Zone (level) | boss HP | build | fight time | no heal | with heal |
|---|---|---|---|---|---|
| 1 (10) | 9,435 | glass | 2.6 sec | 16% | 7% |
| 1 (10) | 9,435 | mix | 4.0 sec | 8% | 4% |
| 1 (10) | 9,435 | tank | 31.3 sec | 0% | 0% |
| 1 (10) | 9,435 | evasion | 19.2 sec | **113% Push** | 54% |
| 2 (20) | 19,575 | glass | 4.8 sec | 39% | 19% |
| 2 (20) | 19,575 | mix | 7.1 sec | 25% | 12% |
| 2 (20) | 19,575 | tank | 36.3 sec | 8% | 4% |
| 2 (20) | 19,575 | evasion | 22.7 sec | **144% Push** | 69% |
| 3 (30) | 27,360 | glass | 6.0 sec | 48% | 23% |
| 3 (30) | 27,360 | mix | 8.5 sec | 33% | 16% |
| 3 (30) | 27,360 | tank | 33.9 sec | 10% | 5% |
| 3 (30) | 27,360 | evasion | 21.4 sec | **121% Push** | 58% |
| 4 (40) | 60,495 | glass | 11.8 sec | **175% Push** | 84% |
| 4 (40) | 60,495 | mix | 16.4 sec | **120% Push** | 57% |
| 4 (40) | 60,495 | tank | 54.6 sec | 55% | 27% |
| 4 (40) | 60,495 | evasion | 34.9 sec | **329% Push** | **158% Push** |
| 5 (50) | 69,480 | glass | 12.2 sec | **160% Push** | 76% |
| 5 (50) | 69,480 | mix | 16.5 sec | **109% Push** | 52% |
| 5 (50) | 69,480 | tank | 48.1 sec | 51% | 24% |
| 5 (50) | 69,480 | evasion | 31.2 sec | **249% Push** | **119% Push** |
| 6 (60) | 79,395 | glass | 12.5 sec | **150% Push** | 72% |
| 6 (60) | 79,395 | mix | 16.6 sec | 99% | 48% |
| 6 (60) | 79,395 | tank | 43.8 sec | 49% | 23% |
| 6 (60) | 79,395 | evasion | 28.7 sec | **207% Push** | 99% |
| 7 (70) | 128,805 | glass | 18.3 sec | **308% Push** | **147% Push** |
| 7 (70) | 128,805 | mix | 23.9 sec | **195% Push** | 93% |
| 7 (70) | 128,805 | tank | 58.0 sec | **108% Push** | 52% |
| 7 (70) | 128,805 | evasion | 38.4 sec | **398% Push** | **190% Push** |
| 8 (80) | 144,075 | glass | 18.5 sec | **293% Push** | **140% Push** |
| 8 (80) | 144,075 | mix | 23.9 sec | **177% Push** | 85% |
| 8 (80) | 144,075 | tank | 54.0 sec | **103% Push** | 49% |
| 8 (80) | 144,075 | evasion | 36.1 sec | **355% Push** | **170% Push** |
| 9 (90) | 160,635 | glass | 18.8 sec | **282% Push** | **135% Push** |
| 9 (90) | 160,635 | mix | 23.9 sec | **161% Push** | 77% |
| 9 (90) | 160,635 | tank | 50.9 sec | 99% | 47% |
| 9 (90) | 160,635 | evasion | 34.4 sec | **320% Push** | **153% Push** |
<!-- END GENERATED:survival-boss-zones -->

Reading:

1. **Boss is an endurance + time gate, not a DPS gate** — read the fight times off the generated table above: a boss stretches the fight long enough that regen cannot close the gap on its own, which is why the no-heal column is a Push at the top of the game.
2. **Heal is the button that wins bosses** — one heal round turns the top-zone Pushes into passes, so an idle (AFK) player forfeits the spawn every 15 min. That is exactly the crafting.md intent that the second half of crafting is active play, and **SV6** holds it.
3. **Clear difficulty ladder** — read it off the table: the early zones barely threaten, the middle starts filtering, and the top zone is the wall, so the boss HP multiplier needs no per-zone lowering.
4. **Pure Evasion is the weakest build at a boss** — it carries the smallest pool and the slowest kill, so the generated table keeps it Pushed even with heal · the evidence-backed fix is to split items to Vit (the owner confirmed this is intended, D-041 A7) · links to the "can fast hit be a build" fork in checks.md group I.
5. **Tank wins but slowest, at the smallest pool cost** — the measured trade-off is fast = must press heal, slow = safe.

# 8. Gaps This File Still Cannot Close (With Reasons)

- **Only elite needs ruling** — the generated `survival-elite` block shows the elite is stronger than a group of 5 in every build, so it is a real event, not a weaker trash pack · AoE already fixed to Cap 3 targets + mana ×1.5 (skill-pool.md · checks.md D11 closed).
- **Should XP differ per monster type** — currently one figure per level for all types · if elite/boss should grant bonus XP it must be decided when setting the new time line.
