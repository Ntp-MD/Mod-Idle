# Core Stats

Str - physical power, Weight, Armour
Vit - HP, HP regen, Elemental resistance for all 5 Elements
Dex - accuracy, Elemental alignment, Evasion
Agi - attack speed, dodge
Wis - cooldown reduction (the only single-benefit stat, on purpose · formula-defense.md section 6)
Int - magic power, mana regen, elemental power, Energy Shield
Lck - critical chance, perfect dodge, drop chance

# Combat Stats

<!-- BEGIN GENERATED:cap-lines -->
Attack speed - % · `hits/sec = aspd / 100` · Cap 500 (= 5 hits/sec · the 0.2 sec floor between hits)
Evasion - % Cap 80 (Dex rating ÷ (rating + mob accuracy), then + Agi ÷ 30 points, capped together · D-112 merged Dodge into this line · reachability settled by X20)
Perfect dodge - % Cap 25 · `lck × K_LCK_PDOGE ÷ (rate + K_PDOGE)` ratio tops at 21.2% but the Cap binds first (reachable at Lck 634) · definition: dodges what normal dodge cannot block (DoT ticks · effects with no dodge condition) — actual order is in combat.md section 2
Critical chance - % no Cap · held at 100 and the excess adds to crit damage (`K_CRIT_OVERFLOW` 1 · formula-offense.md section 3) · stat-only ceiling = 33.5% at 510 Lck, so only buffs/skills create overflow
Critical damage - % physical only · magic and the 5 Elements never crit · no Cap · `100 + crit_dmg_pct + crit_overflow`
Cooldown reduction - % Cap 80 (reachable at 510 Wis + 11 CDR slots = 57.4 before the cut · 9 slots reach only 49.7, so the Cap needs the full set · 10 slots reach 53.6 · D-041)
Accuracy - numeric value, no Cap · formula `acc / (acc + evasion)` can never reach 100% by design · previously Cap 2,000 which was unreachable
Elemental alignment - % Cap 50 (reachable at 510 Dex + amulet + gloves · previously 60, unreachable)
Elemental resistance - % split across 5 Elements, Cap 75 per Element (reachable at 510 Vit + 3 res slots)
Armour - numeric rating · `Str x K_ARMOUR` (2) + Gear Armour flat (8-40) · physical reduction% = armour / (armour + 5 × raw_hit) · no Cap (diminishing by design) · the mob side runs the same K off its own Str, so a Golem or Knight carries real armour and a Rat carries almost none (mob-roster.md)
Evasion - numeric rating · `Dex x K_EVASION` (0.5) + Gear Evasion flat (6-30) · PoE entropy roll vs attacker accuracy ahead of dodge · no hard Cap (the ratio is the limit) · the same line runs the mob side, from the mob's own Dex (formula-utility.md section 8)
Energy Shield - second pool ahead of HP · `Int x K_INT_ES` (4) + Gear Energy Shield flat (12-60) · chaos bypasses it · armour and Elemental resistance shrink the number that drains it · recharges after 5 sec without a hit at `Int x K_INT_ESREGEN` (0.1) per sec, so the whole pool returns in 40 sec · no Cap (D-026 · X25)
Weight - units · capacity = Str x 2 (1,020 at 510 Str) · Over-capacity is allowed, does not lock equip slots, but reduces Attack speed proportionally up to -50% (formula.md section 11)
<!-- END GENERATED:cap-lines -->

**Every Cap must be verifiable as reachable from the current Mod tables** · Reference values and calculation method are in formula.md section 0 and the Cap table

# Removed

Status alignment — renamed to Elemental alignment, uses the same stat

**Status resistance is back as a Mod line only (D-111, owner ruling 2026-10-04).**
It was merged into Vit Elemental resistance and stayed gone until the owner
added `Status Alignment resistance %` to the Mod pool. It is a **% cut on the
20% status proc** (`combat.md` §5), not a Core stat and not a second resistance
rating: Elemental resistance still only ever covers the Element **half** of a hit,
so nothing about this line touches mitigation. `Holy veil` remains the hard answer
(timed immunity plus a cleanse); this is the always-on answer.

(End of file - total 29 lines)
