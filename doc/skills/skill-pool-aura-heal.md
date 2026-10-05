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

**Numbers to control** — Int 510 (true ceiling) yields Max Mana **3,624** (including 16/level × 99) and mana regen **91.8/sec** · See formula.md section 5.

| reserve tier | % of pool | at pool 3,624 |
|---|---|---|
| cheap | 8% | 290 |
| mid | 11% | 399 |
| heavy | 14% | 507 |

- Reserve prices are **spread 8-14% on purpose.** With a flat price every aura would cost the same and the choice would carry no information; the spread is what makes "which auras to drop" a real question.
- **All the auras together reserve more of the pool than the block allows** — the sum is printed by the cage (**S9**), never typed here, and both guards now carry a tier like their weight. So the full set can never run. Dropping the single most expensive aura leaves 96% — the lightest legal set — and every other combination is the player's call.

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

<!-- BEGIN GENERATED:heal-heading -->
# 3 healing skills
<!-- END GENERATED:heal-heading -->

<!-- BEGIN GENERATED:heal-roster -->
| Skill | cd | mana | Duration | What it does |
|---|---|---|---|---|
| Heal | 20 sec | 20% | 8 sec | Restores 8% Max HP per second 8 sec (= +64% pool in long fights) |
| Greater Heal | 40 sec | 25% | Instant | Restores 45% Max HP instantly · Covers last-moment windows |
| Cleanse | 24 sec | 16% | Instant | Cleanses all statuses on self + restores 8% Max HP · Answer to 10-stack poison |
<!-- END GENERATED:heal-roster -->

<!-- BEGIN GENERATED:aura-heading -->
# 13 aura skills
<!-- END GENERATED:aura-heading -->

**Decision 1 (applied): these auras replace the old 6.** Reading the new list as additive would put two different auras under `Clarity` and `Grace`, because both names already existed with a different effect — so the old roster (Aura of Might · Aura of Grace · Aura of Fury · Aura of Clarity · Aura of Dread · Aura of Frost) is treated as **replaced**. The old Clarity role (a skill-mana-cost reduction) is **dropped, not moved**: it was the only sink that let a player fund skills 5-6 beyond what regen covers, and nothing in the new 12 replaces it.

<!-- BEGIN GENERATED:aura-roster -->
| Aura | Kind | reserve | At pool 3,824 | Effect at skill level 20 |
|---|---|---|---|---|
| Wraith of Fury | self | cheap 8% | 290 | aspd +12% |
| Clarity | self | cheap 8% | 290 | mana regen +25% |
| Haste | self | extreme 25% | 906 | global speed ×1.15: every cooldown ticks 15% faster (a post-cap cooldown multiplier) and final attack speed ×1.15 (still clamped by the 500 Cap) |
| Vitality | self | mid 11% | 399 | hp regen +30% |
| Herald of Ash | fire | heavy 14% | 507 | fire damage flat +50 · Alignment +6 |
| Herald of Frost | cold | heavy 14% | 507 | cold damage flat +50 · Alignment +6 |
| Herald of Lightning | lightning | heavy 14% | 507 | lightning damage flat +50 · Alignment +6 |
| Rimbo Form | debuff | mid 11% | 399 | nearby mob aspd −15% (stacks with chill; total may reach −35% · D-009 3a) |
| Elemental Fury | debuff | mid 11% | 399 | target Elemental res −12% |
| Trinity Form | defense | mid 11% | 399 | Elemental res +15% on fire / cold / lightning |
| Grace | defense | cheap 8% | 290 | Evasion flat +24 |
| Iron Guard | defense | mid 11% | 399 | Armour flat +32 |
| Energy Guard | defense | mid 11% | 399 | Energy Shield flat +48 |
<!-- END GENERATED:aura-roster -->

Sizing — this is the *reasoning* behind each value in the table above. The table is the source of the value; this text explains why it sits there, and deliberately does not restate it.

- **Wraith of Fury** (aspd) — War Cry and Berserk are *timed buffs*, so a permanent aura must sit below both. The aspd Cap is 500 = 5 times/sec (core-stats.md), a clock floor rather than a build target, so the aura is sized against ordinary Agi builds and not against the Cap.
- **Clarity** (mana regen) — `mana_regen = int × 0.18 × (1 + mregen_pct/100)` (formula-defense.md:49), so the aura is a % of an Int-driven value: at Int 510 it lifts regen from 91.8 to 114.8/sec. Deep Breath's burst is larger, so the permanent aura sits under it.
- **Vitality** (hp regen) — `hp_regen = vit × K_VIT_REGEN × (1 + hp_regen_pct/100)` (`formula-defense.md` §5). Push downtime is `Max HP ÷ (hp_regen × 8)` (`combat.md` §4), so the aura's published regen percentage shortens the walk back to camp by exactly that share on every build — biggest on the Vit build, which is the one that can least afford the trip.
- **Heralds** (Elemental power flat · Alignment) — Elemental power flat is 12-64 per item (mod-pool.md:122) ≈ one high-quality item held permanently; Elemental alignment % is 1-5% per item (mod-pool.md:125) ≈ 1.2 items. Alignment gates only status *application*, not damage (elements.md P0-1), so the Alignment half buys DoT uptime, not hit count. The flat is Element-only, or all three are one aura with three names. Both halves scale with skill level (level 1 ≈ 40% of the level-20 value). The Heralds are the only auras in the set that add **DPS**, which is why they are the most expensive tier.
- **Rimbo Form** (mob aspd) — `chill_pct` Cap is 20 (elements.md:116) and Cripple already gives −20%; the aura stacks past the Cap by design (D-009 3a).
- **Elemental Fury** (Elemental res) — Sunder gives −20% as a deliberate single-target press, and Void Lance pierces 100% res; an always-on aura must be weaker than a press.
- **Trinity Form** (Elemental res) — `elem_res_x = res_c × (1 + elem_res_pct_x/100)` (elements.md:83), a multiplier on Vit-derived `res_c`; the aura feeds the same `elem_res_pct_x` pool as a gear roll, so it is worth roughly one item (D-009 3b).
- **Grace** (Evasion flat) — the `Evasion flat` line is what every evasion slot rolls (`mod-pool.md`'s generated Defensive table), so the aura hands out one gear item's worth of the same line, held permanently. Flat is the right form because the Evasion chance is a ratio — a flat add moves it, a % of a small rating barely does (`formula-defense.md` §4). Priced at the same **80% of the Evasion item ceiling** the two guards sit at on their own line — re-priced after **D-112** merged Dodge into Evasion, which had left it below that fraction (`harness/decisions.md` D-116).
- **Iron Guard** (Armour flat) — Armour is `Str × K_ARMOUR` plus this flat, mitigating by `armour ÷ (armour + 5 × raw physical)` (formula-defense.md §5 · core-stats.md) — `K_ARMOUR` landed in D-022, so nothing here is blocked. Priced at **80% of the Armour item ceiling** (the range the generated Defensive table prints), the same fraction the Heralds sit at on their own line. The old *"armour for 10% mitigation against an on-level boss"* target is **rejected** — against the physical half of the zone-9 boss it prices an aura at a whole twelve-item Str-armour build, not one item (see the B-1 note in `harness/decisions.md`); the physical-damage % was folded into this flat rather than run as a second layer.
- **Energy Guard** (Energy Shield flat) — ES is `Int × K_INT_ES` (4) plus this flat; `K_INT_ES` landed in D-026 and **there is no `K_ENERGY_SHIELD` and no ES % Mod**, so flat is the only form (the ES % half is dropped, not deferred). Same 80%-of-ceiling rule (range 12-60). The Int-driven pool is large, so one flat item is a thin buffer on a pure caster — precisely as an ES *gear* item is thin there — which makes this aura the low-Int build's small buffer off its own mana line, not the caster's (who already holds the pool). Both guards keep D-035's **mid (11%)** reserve, which was never blocked on a K value; the effect sizes come from the ranges above and are printed by the writer, never typed here.
- **Haste** (global speed) — the only aura that moves the clock itself instead of a stat. It reserves `extreme` (25%) because ×1.15 on both cooldowns and final attack speed is worth more than any other aura. Cooldown is a **post-Cap** multiplier (it runs after the CDR Cap), while aspd still clamps at the 500 Cap. It is the reserved power the H1 fold must price first (`checks.md` D34). **Player-only:** it affects the player alone, and no mob ever carries Haste, even when mobs get their own skill lists.

- **Aura XP** is gained per second while **open**, independent of what it costs.

## Rulings (D-009)

- **Rimbo Form stacks past the chill Cap.** `chill_pct` Cap 20 governs chill alone; Rimbo Form stacks on top, so a chilled target under the aura can reach **−35%** total aspd. The aura pays reservation for the extra layer (D-009 3a · `elements.md`).
- **Trinity Form / Elemental Fury are straight %.** Both feed `elem_res_pct_x` exactly like a gear roll — no separate aura stat, no flat (D-009 3b · `elements.md`).
- **Grace keeps Evasion flat only.** Perfect dodge deletes the hit outright on trigger and is not opposed, but it is a ratio on the Lck line while `Grace` feeds the Evasion rating — a Perfect dodge bonus would miss the line she scales, so the half is dropped (D-009 3c · `combat.md`).
- **Heralds stay fire / cold / lightning.** Poison and chaos get no dedicated aura — they work through stacking DoT and marks (D-009 3d).

## Live numbers, not a frozen baseline

The old "3 attack-skill rotation" table was measured against the deleted aura-drain model, so it is gone rather than corrected in place. The live per-skill numbers (dmg/press · eff cd · presses/sec · mana%/s) come from `node tools/skills.ts --calc` and from the same view in `dashboard.html`; both read `tools/lib/skillmodel.ts`, so no rotation figure is hand-typed here and none can go stale.