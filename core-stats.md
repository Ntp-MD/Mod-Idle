# Core Stats

Str - physical power, Weight, Armour
Vit - HP, HP regen, Elemental resistance for all 5 Elements
Dex - accuracy, Elemental alignment, Evasion
Agi - attack speed, dodge
Wis - cooldown reduction
Int - magic power, mana regen, elemental power, Energy Shield
Lck - critical chance, drop chance, perfect dodge

# Combat Stats

Attack speed - % · `hits/sec = aspd / 100` · Cap 300 (= 3 hits/sec)
Dodge - % Cap 90 (opposed by mob accuracy · P1-1 option A2 · reachable path pending mob sheet rebalance)
Perfect dodge - % Cap 5 (reached at 500+ Lck) · Definition: dodges what normal dodge cannot block (DoT ticks · effects with no dodge condition) — actual order is in combat.md section 2
Critical chance - % Cap 100 (stat-only ceiling = 48.8% at 816 Lck · remainder must come from skills/buffs)
Critical damage - % split physical / magic, no Cap
Cooldown reduction - % Cap 50 (requires 816 Wis + 4 CDR slots)
Accuracy - numeric value, no Cap · formula `acc / (acc + evasion)` can never reach 100% by design · previously Cap 2,000 which was unreachable
Elemental alignment - % Cap 50 (reachable at 816 Dex + amulet + gloves · previously 60, unreachable)
Elemental resistance - % split across 5 Elements, Cap 75 per Element (reachable at 816 Vit + 3 res slots)
Armour - numeric rating · physical reduction% = armour / (armour + 5 × raw_hit) · no Cap (diminishing by design) · driven by Str · K value pending mob sheet rebalance
Evasion - numeric rating · PoE entropy roll vs attacker accuracy ahead of dodge · no hard Cap (chance derived) · driven by Dex · K value pending mob sheet rebalance
Energy Shield - pool · takes damage before HP, chaos bypasses, recharges after 5 sec without a hit · driven by Int · K value pending mob sheet rebalance
Weight - units · capacity = Str x 2 (1,632 at 816 Str) · Over-capacity is allowed, does not lock equip slots, but reduces Attack speed proportionally up to -50% (formula.md section 11)

**Every Cap must be verifiable as reachable from the current Mod tables** · Reference values and calculation method are in formula.md section 0 and the Cap table

# Removed

Status resistance — merged into Vit Elemental resistance
Status alignment — renamed to Elemental alignment, uses the same stat

(End of file - total 29 lines)
