# Core Stats

Str - physical power, Weight, Armour
Vit - HP, HP regen, Stun Recovery (the share of a shock's stop it buys back)
Dex - accuracy, Elemental alignment, Evasion
Agi - attack speed, Evasion points
Wis - cooldown reduction (the only single-benefit stat, on purpose · formula-defense.md section 6)
Int - magic power, mana regen, elemental power, mana
Lck - critical chance, perfect dodge, drop chance

Elemental resistance and Energy Shield are gear lines. No Core stat feeds either (owner ruling),
so both are read off the Mod rows and neither is a build axis to spend points into.

# Core Stat Line

Every Core stat is **spent, not granted**. A level grants stat points, the player puts them
where it wants, and one point is worth one Flat:

```
stat = stat.base + points × stat.point_value
```

Points are banked and may be spent at any time, including mid-combat. Respec returns every point and is
free, but only inside a settlement. Two builds are published and both are priced: the **reference**
build (points split evenly over the seven stats) is what every published number and `mob_HP` are
measured against, and the **focused** build (every point in one stat) is printed beside it. Paragon
levels grant fewer points per level. `formula.md` section 0 carries the reference and focused values;
`character-sheet.md` carries the allocation panel.

# Combat Stats

<!-- BEGIN GENERATED:cap-lines -->
Attack speed - % · `hits/sec = aspd / 100` · Cap 500 (= 5 hits/sec · the 0.2 sec floor between hits · applied last: after the aspd Mod band, an aspd buff and the weight tax, so no build passes it)
Evasion - % Cap 80 (Dex rating ÷ (rating + mob accuracy), then + Agi ÷ 30 points, capped together · merged Dodge into this line · reachability settled by X20)
Perfect dodge - % Cap 21 · `lck × K_LCK_PDOGE ÷ (rate + K_PDOGE)` ratio tops at 18.6% but the Cap binds first (reachable at Lck 506) · definition: removes the hit that Evasion cannot contest (DoT ticks · effects with no avoidance roll) — actual order is in combat.md section 2
Critical chance - % no Cap · held at 100 and the excess adds to crit damage (`K_CRIT_OVERFLOW` 1 · formula-offense.md section 3) · stat-only ceiling = 29.7% at 433 Lck, so only buffs/skills create overflow
Critical damage - % physical only · magic and the 5 Elements never crit · no Cap · `100 + crit_dmg_pct + crit_overflow`
Cooldown reduction - % Cap 80 — a hard ceiling: 433 Wis + 11 CDR slots = 48.8, so the build tops out under it (9 slots reach only 42.3 · 10 slots reach 45.5)
Accuracy - numeric value, no Cap · formula `acc / (acc + evasion)` can never reach 100% by design · previously Cap 2,000 which was unreachable
Elemental alignment - % no Cap (owner ruling) · 433 Dex + amulet + gloves = 31.7 and it keeps climbing · the defensive `Status Alignment resistance %` is a separate Mod line (mod-pool.md · core-stats.md)
Elemental resistance - % split across 5 Elements, Cap 75 per Element — **gear only** (owner ruling): 15-30 + All Resistance 10-20 · no Core stat feeds it · 3 res slots at the max roll reach 90, so the Cap binds
Armour - numeric rating · `Str x K_ARMOUR` (2) + Gear Armour flat (8-40) · physical reduction% = armour / (armour + 5 × raw_hit) · no Cap (diminishing by design) · the mob side runs the same K off its own Str, so a Golem or Knight carries real armour and a Rat carries almost none (mob-roster.md)
Evasion - numeric rating · `Dex x K_EVASION` (0.5) + Gear Evasion flat (6-30) · PoE entropy roll vs attacker accuracy, contested once per hit · no hard Cap on the rating (the chance is the limit) · the same line runs the mob side, from the mob's own Dex (formula-utility.md section 8)
Energy Shield - second pool ahead of HP · **gear only** (owner ruling): Gear Energy Shield flat (12-60) x (1 + Max Energy Shield % 3-16/100) · chaos bypasses it · armour and Elemental resistance shrink the number that drains it · regen is 3% of the pool per sec after 3 sec without a hit, amplified by an `es_regen` skill, Mod or passive, so the base rate alone returns the whole pool in 33.3 sec · no Cap (X25)
Weight - units · capacity = weight_base (1,000) + Str x 2 (1,867 at 433 Str) · Over-capacity is allowed, does not lock equip slots, but reduces Attack speed proportionally up to -50% (formula.md section 11)
<!-- END GENERATED:cap-lines -->

**Every Cap states whether it is a build target or a hard ceiling ** · a build target must bind — a maxed build reaches at or above it · a hard ceiling must not bind — the build tops out under it · Reference values and calculation method are in formula.md section 0 and the Cap table

# Removed

Status alignment — renamed to Elemental alignment, uses the same stat

**Status resistance is back as a Mod line only (owner ruling 2026-10-04; redefined 2026-10-05 to cover crowd control).**
It was merged into Vit Elemental resistance and stayed gone until the owner
added `Status Alignment resistance %` to the Mod pool. It is a **% cut on
every status a mob lands on you** — the Elemental status proc
(`combat.md` §5) **and crowd control**: the stun and the stop that statuses and
mob abilities carry (`combat.md` §5b). So it is the one defensive answer to
being debuffed *or* locked out, and a build that fears a control-heavy zone buys
this line rather than chasing a separate resist. It is not a Core stat and not a
second resistance rating: Elemental resistance still only ever covers the Element
**half** of a hit, so nothing about this line touches mitigation. `Holy veil`
remains the hard answer (timed immunity plus a cleanse); this is the always-on
answer.

