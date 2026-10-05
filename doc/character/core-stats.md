# Core Stats

Str - physical power, Weight, Armour
Vit - HP, HP regen, Elemental resistance for all 5 Elements
Dex - accuracy, Elemental alignment, Evasion
Agi - attack speed, Evasion points
Wis - cooldown reduction (the only single-benefit stat, on purpose · formula-defense.md section 6)
Int - magic power, mana regen, elemental power, Energy Shield
Lck - critical chance, perfect dodge, drop chance

# Combat Stats

<!-- BEGIN GENERATED:cap-lines -->
Attack speed - % · `hits/sec = aspd / 100` · Cap 500 (= 5 hits/sec · the 0.2 sec floor between hits)
Evasion - % Cap 80 (Dex rating ÷ (rating + mob accuracy), then + Agi ÷ 30 points, capped together · D-112 merged Dodge into this line · reachability settled by X20)
Perfect dodge - % Cap 21 · `lck × K_LCK_PDOGE ÷ (rate + K_PDOGE)` ratio tops at 22% but the Cap binds first (reachable at Lck 506) · definition: removes the hit that Evasion cannot contest (DoT ticks · effects with no avoidance roll) — actual order is in combat.md section 2
Critical chance - % no Cap · held at 100 and the excess adds to crit damage (`K_CRIT_OVERFLOW` 1 · formula-offense.md section 3) · stat-only ceiling = 34.8% at 535 Lck, so only buffs/skills create overflow
Critical damage - % physical only · magic and the 5 Elements never crit · no Cap · `100 + crit_dmg_pct + crit_overflow`
Cooldown reduction - % Cap 80 — a hard ceiling (D-124): 535 Wis + 11 CDR slots = 60.2, so the build tops out under it (9 slots reach only 52.2 · 10 slots reach 56.2 · D-041)
Accuracy - numeric value, no Cap · formula `acc / (acc + evasion)` can never reach 100% by design · previously Cap 2,000 which was unreachable
Elemental alignment - % Cap 50 — a hard ceiling (D-124): 535 Dex + amulet + gloves = 36.8, under it (previously 60, then a binding 35)
Elemental resistance - % split across 5 Elements, Cap 75 per Element — a hard ceiling (D-124): 535 Vit + 3 res slots = 50.8, under it
Armour - numeric rating · `Str x K_ARMOUR` (2) + Gear Armour flat (8-40) · physical reduction% = armour / (armour + 5 × raw_hit) · no Cap (diminishing by design) · the mob side runs the same K off its own Str, so a Golem or Knight carries real armour and a Rat carries almost none (mob-roster.md)
Evasion - numeric rating · `Dex x K_EVASION` (0.5) + Gear Evasion flat (6-30) · PoE entropy roll vs attacker accuracy, contested once per hit · no hard Cap on the rating (the chance is the limit) · the same line runs the mob side, from the mob's own Dex (formula-utility.md section 8)
Energy Shield - second pool ahead of HP · `Int x K_INT_ES` (4) + Gear Energy Shield flat (12-60) · chaos bypasses it · armour and Elemental resistance shrink the number that drains it · recharges after 3 sec without a hit at `Int x K_INT_ESREGEN` (0.1) per sec, so the whole pool returns in 40 sec · no Cap (D-026 · X25)
Weight - units · capacity = Str x 2 (2,070 at 535 Str) · Over-capacity is allowed, does not lock equip slots, but reduces Attack speed proportionally up to -50% (formula.md section 11)
<!-- END GENERATED:cap-lines -->

**Every Cap states whether it is a build target or a hard ceiling (D-124)** · a build target must bind — a maxed build reaches at or above it · a hard ceiling must not bind — the build tops out under it · Reference values and calculation method are in formula.md section 0 and the Cap table

# Removed

Status alignment — renamed to Elemental alignment, uses the same stat

**Status resistance is back as a Mod line only (D-111, owner ruling 2026-10-04).**
It was merged into Vit Elemental resistance and stayed gone until the owner
added `Status Alignment resistance %` to the Mod pool. It is a **% cut on the
20% status proc** (`combat.md` §5), not a Core stat and not a second resistance
rating: Elemental resistance still only ever covers the Element **half** of a hit,
so nothing about this line touches mitigation. `Holy veil` remains the hard answer
(timed immunity plus a cleanse); this is the always-on answer.

