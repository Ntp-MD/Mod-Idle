# Aura, auto-press, healing, aura skills

import glossary.md
import formula.md
import skill-pool.md

# Aura

**Reserves Max Mana as a % of pool — nothing drains per second**

```
aura_reserved_x = pool x reserve_x/100
usable_pool     = pool - sum(reserved auras)

The player opens auras. The system blocks any selection whose total
reserved mana would reach 100% of the pool — some mana must stay
usable for skills. There is no other cap.
```

- **Reserved mana is unusable by skills while an aura is open** — it is not a pool to spend and refill.
- **There is no low-mana threshold.** The old rule *"an aura can open only while mana remains ≥ 25% of Max Mana"* is deleted.
- **Regen fills only the usable pool**, so every point of Int regen reaches skills instead of being split against aura cost.
- **The player manages the set.** There is no automatic opening and no 45% Cap: the player chooses which auras to run. The only system rule is the 100% block above.
- The budget is **static and readable before a fight**, not a live regen race.
- **Side effect to know**: reservation scales as % of pool, so `Max Mana %` slots lock a **fixed percentage** and leave a bigger usable pool. This line is good for aura builds — the reverse of the old drain table, where a bigger pool meant a bigger bill.

**Numbers to control** — Int 816 (true ceiling) yields Max Mana **4,848** (including 16/level × 99) and mana regen **122/sec** · See formula.md section 5.

| reserve tier | % of pool | at pool 4,848 |
|---|---|---|
| cheap | 8% | 388 |
| mid | 11% | 533 |
| heavy | 14% | 679 |

- Reserve prices are **spread 8-14% on purpose.** With a flat price every aura would cost the same and the choice would carry no information; the spread is what makes "which auras to drop" a real question.
- **All 12 auras together reserve 110% of the pool** (3×8 + 4×11 + 3×14), so the full set can never run. Dropping the single most expensive aura leaves 96% — the lightest legal set — and every other combination is the player's call.

# Auto-press rules

```
Round 1 → if skill 1 is ready (cd done and enough mana), use it
Round 2 → skill 2
Round 3 → skill 3
...
If mana insufficient → skip that one, try the next
```

- No mana → no skill fires at all, not just slower
- If mana is so low that only one can fire, the placed order determines which one fires
- **Auras never fire here.** They hold no action in the queue and consume no press.

# 3 healing skills

<!-- BEGIN GENERATED:heal-roster -->
| Skill | Scale | cd | mana | Duration | What it does |
|---|---|---|---|---|---|
| Heal | Wis | 20 sec | 20% | 8 sec | Restores 4% Max HP per second 8 sec (= +32% pool in long fights) |
| Greater Heal | Vit | 40 sec | 25% | Instant | Restores 20% Max HP instantly · Covers last-moment windows |
| Cleanse | Vit | 24 sec | 16% | Instant | Cleanses all statuses on self + restores 8% Max HP · Answer to 10-stack poison |
<!-- END GENERATED:heal-roster -->

# 12 aura skills

**Decision 1 (applied): these 12 replace the old 6.** Reading the new list as additive would put two different auras under `Clarity` and `Grace`, because both names already existed with a different effect — so the old roster (Aura of Might · Aura of Grace · Aura of Fury · Aura of Clarity · Aura of Dread · Aura of Frost) is treated as **replaced**. The old Clarity role (a skill-mana-cost reduction) is **dropped, not moved**: it was the only sink that let a player fund skills 5-6 beyond what regen covers, and nothing in the new 12 replaces it.

<!-- BEGIN GENERATED:aura-roster -->
| Aura | Kind | reserve | At pool 4,848 | Effect at skill level 20 |
|---|---|---|---|---|
| Wraith of Fury | self | cheap 8% | 388 | aspd +12% |
| Clarity | self | cheap 8% | 388 | mana regen +25% |
| Vitality | self | mid 11% | 533 | hp regen +30% |
| Herald of Ash | fire | heavy 14% | 679 | fire damage flat +50 · Alignment +6 |
| Herald of Frost | cold | heavy 14% | 679 | cold damage flat +50 · Alignment +6 |
| Herald of Lightning | lightning | heavy 14% | 679 | lightning damage flat +50 · Alignment +6 |
| Rimbo Form | debuff | mid 11% | 533 | nearby mob aspd −15% (**shares the chill Cap 20** · Blocker 2) |
| Elemental Fury | debuff | mid 11% | 533 | target Elemental res −12% |
| Trinity Form | defense | mid 11% | 533 | Elemental res +15% on fire / cold / lightning (Blocker 3) |
| Grace | defense | cheap 8% | 388 | Dodge flat +12 |
| Iron Guard | defense | **TBD** | — | Armour flat (the "physical damage 5-15%" is folded into the flat, not a second layer) |
| Energy Guard | defense | **TBD** | — | Energy Shield flat (the "ES %" half is dropped — no ES % Mod exists) |
<!-- END GENERATED:aura-roster -->

Sizing — this is the *reasoning* behind each value in the table above. The table is the source of the value; this text explains why it sits there, and deliberately does not restate it.

- **Wraith of Fury** (aspd) — War Cry and Berserk are *timed buffs*, so a permanent aura must sit below both. The aspd Cap is 300 (core-stats.md) and Agi 816 already reaches 204, so the aura is sized to keep mid-Agi builds under the Cap instead of wasting it.
- **Clarity** (mana regen) — `mana_regen = int × 0.15 × (1 + mregen_pct/100)` (formula-defense.md:49), so the aura is a % of an Int-driven value: at Int 816 it lifts regen from 122 to 152/sec. Deep Breath's burst is larger, so the permanent aura sits under it.
- **Vitality** (hp regen) — `hp_regen = vit × 0.25 × (1 + hp_regen_pct/100)` (formula-defense.md:46); on a tank build it lifts regen from 204 to 265/sec, cutting Push downtime from 12.6 to 9.7 sec.
- **Heralds** (Elemental power flat · Alignment) — Elemental power flat is 12-64 per item (mod-pool.md:122) ≈ one high-quality item held permanently; Elemental alignment % is 1-5% per item (mod-pool.md:125) ≈ 1.2 items. Alignment gates only status *application*, not damage (elements.md P0-1), so the Alignment half buys DoT uptime, not hit count. The flat is Element-only, or all three are one aura with three names. Both halves scale with skill level (level 1 ≈ 40% of the level-20 value). The Heralds are the only auras in the set that add **DPS**, which is why they are the most expensive tier.
- **Rimbo Form** (mob aspd) — `chill_pct` Cap is 20 (elements.md:116) and Cripple already gives −20%. See Blocker 2.
- **Elemental Fury** (Elemental res) — Sunder gives −20% as a deliberate single-target press, and Void Lance pierces 100% res; an always-on aura must be weaker than a press.
- **Trinity Form** (Elemental res) — `elem_res_x = res_c × (1 + elem_res_pct_x/100)` (elements.md:83), a multiplier on Vit-derived `res_c`; gear `Elemental resistance %` rolls a higher range per item, so the aura is worth roughly one item but weaker per point than a gear roll. See Blocker 3.
- **Grace** (Dodge flat) — `Dodge flat 3-15` per item (mod-pool.md:88) ≈ one gear item held permanently. Flat is the right form because `dodge_chance = rate / (rate + 100)` (formula-defense.md:13) is a ratio — a flat add moves it, a % barely does.
- **Iron Guard / Energy Guard are unpriced** — reservation must be priced against the strength of the effect, and their effect sizes wait on `K_ARMOUR` / `K_ENERGY_SHIELD` (mod-pool.md:95 · equipment-slot-pools.md:55-57). Iron Guard's target is statable now — *the armour that yields 10% mitigation against an on-level boss* (1,316/sec at L100) is 731 armour — but the L100 flat lands when `K_ARMOUR` arrives, and AGENT.md section 4 forbids hand-typing it.

- **Aura XP** is gained per second while **open**, independent of what it costs.

## Blockers carried from the balancing pass

- **Blocker 2 — Rimbo Form vs the mob aspd Cap.** chill is capped at 20 because a target with reduced aspd stops producing damage itself (elements.md:121-122), and Cripple already gives −20%. Rimbo Form's value must **share the Cap 20 with chill**, not stack into it — stacking would double what the Cap exists to prevent.
- **Blocker 3 — Trinity Form / Elemental Fury currency.** `res_x` is a multiplier on Vit-derived `res_c`, and gear `Elemental resistance %` multiplies the same `res_c`, so the aura is simply a cheaper way to buy what one gear item already gives. Ruling needed: keep it a multiplier (honest to the formula, but strictly worse value than gear, so nobody runs it) or make it a flat add to `res_x` (competes on equal terms, but needs a ruling that an aura may touch `res_x` directly). Same question for Elemental Fury.
- **Blocker 4 — Grace's perfect-dodge half is dropped.** `perfect_dodge` Cap 5 is reached at Lck 500 (`K_LCK_PDOGE = 0.01` · formula-defense.md:40), so a perfect-dodge bonus is clipped to the Cap for exactly the builds that would want it — zero at either reading. The dodge-flat half is kept; the perfect-dodge half returns only if the Cap moves.
- **Coverage gap** — the Heralds cover fire / cold / lightning only. Poison and chaos get no dedicated aura. That is a decision to make, not an omission.
- **Tree knock-on** — the Control branch "Aura Economy limb" still names the old auras and 4 of its 7 nodes describe the deleted drain mechanic; it must be rewritten before `checks.md` D19 passes (see `skill-tree-control.md`).

## Measured baseline (3 attack-skill rotation + support that mana allows)

| Build | Auto DPS | 3 skills | Total | Skill share | % of old gear ceiling |
|---|---|---|---|---|---|
| glass | 9,847 | 3,253 | 13,100 | 25% | 133% |
| mix | 6,695 | 1,985 | 8,679 | 23% | 88% |
| skill | 5,728 | 2,489 | 8,217 | 30% | 83% |
| caster | 3,574 | 3,226 | 6,800 | 47% | 69% |

> Read these rows like the combat.md §6 cards: glass is the full-Str build (least mana → skills add only +33% of auto) · caster gives 8 slots to Int (low auto but skills are 47% of the build core, and the total is still 31% below the gear ceiling) → **Gear is still #1, tree #2, skill #3 in the order concept.md sells**, and because mob_HP is multiplied by the skill factor (1 + 0.0034 × L), loot.md kills/hour does not shift (checks.md D17)

> **Stale under reservation — these rows are measured against the old drain table**, where two auras ate 80% of regen (24/sec reached skills). Reservation returns all 122/sec to the skill list, so the "3 skills" column and every skill-share percentage here are now understated. `checks.md` D17 (`skillF(L) = 1 + 0.0034 × L`) was measured on the drain numbers too and needs a rerun. `node tools/skills.js` does not exist yet, so no corrected figures are proposed here.