# Skill Tree — Keystones

import glossary.md
import skill-pool.md
import combat.md

Part of skill-tree.md — keystone detail · Point budget and tree power budget live in skill-tree.md sections 1-3.

# 5. 12 original passives → all are keystones

| Original | Branch | Measured value (%) | Notes |
|---|---|---|---|
| Sonic Blow (every 5th ×2.5) | Impact | **+30%** | Slow-hitting builds benefit differently from fast ones → must check against aspd Cap |
| Rapid Fire (aspd +30% flat) | Control | +30% | May hit the 300 Cap at high Agi → this node is "empty" for some builds (acceptable) |
| Brute (+3%/kill to +30%) | Impact | +30% | Resets on dodge (original rule) |
| Overkill (carry excess damage) | Stream | +18% | Strong on groups · Weak on single bosses |
| Cheap Casting (mana −25%) | Control | +16% | *Adds casts* → adds true DPS under the mana ceiling |
| Flurry (cd −30% every 3) | Control | +13% | |
| Burning Focus (2× status length) | Stream | +8% | True value is DoT, not hits |
| Elemental Attunement | Stream | +6% | Element gate |
| Counter | Impact | +5% | |
| Cunning (+30% under 25% mana) | Control | +4.5% | **Conflict changed shape under reservation** — auras no longer switch off at 25%, so the hard exclusion is gone. Now a budget tension: Cunning wants a small usable pool, reservation wants a large one, so a Cunning build reserves little |
| Last Stand (+50% under 30% HP) | Impact | +12.5% | True value depends on how hard hits land |
| Noble Phantasm (reflect 30%) | Control | 0% DPS | It is EHP, not DPS · Check against combat.md: monster damage 4-329/sec |

# 5b. 6 more missing keystones (18 total = 9 exclusive pairs) — each value calculated from its rule, not set by feel

| Keystone | Branch | Rule | Calculated value | Conflicting pair |
|---|---|---|---|---|
| Finishing Blow | Impact | Damage ×2 against targets below 20% HP | **+11.1%** · Total kill time drops to 0.9x → `1/0.9 − 1` | Brute (both want long fights) |
| Weighted Edge | Impact | +20% damage if the target is *single* (solo mob/elite/boss) · Groups = no effect | **+7%** while farming (`20% × single-fight share ~35%`) · **+20% on true bosses** | Spreading Burn · And Overkill (group side) |
| Deep Pockets | Stream | Every 6 sec, skills on cd accelerate 25% for 3 sec (does not stack) | **+7%** · +25% casts × skill share of DPS (~28% from skill-pool.md) | Cunning (same mana economy) |
| Elemental Crossfeed | Stream | When a target carries statuses from *two Elements* at once, they detonate and consume both statuses | **+15%** · Equals ~1 extra skill press per 3 presses · Must tie to the Element gate (Attunement) | Elemental Attunement · Burning Focus |
| Spreading Burn | Stream | When a status-carrying target dies, 1 status stack jumps to the next unit (in radius · 3-target Cap per AoE rules) | **+16%** in groups of 3-5 · ~0% on single bosses | Weighted Edge · Sonic Blow |
| Anchor | Control | While held weight is *over 50% of capacity*, incoming damage drops 15% (weight tax becomes profit) | **0% DPS · +20% EHP** (counted like Noble Phantasm) | Rapid Fire (light-fast vs heavy-solid) |

**Pool accounting check** — 18 units = 12 original (mean 14.4%) + 6 new (mean 9.4%) → **whole-pool mean 12.7%**
- The calculated typical path = pick 6 averaging **14.2%** → still slightly above pool mean, meaning players must pick *adequately*, not randomly · Passes
- **But the perfect budget still breaks**: picking the 6 best in the pool (Sonic Blow 30 + Rapid Fire 30 + Brute 30 + Overkill 18 + Spreading Burn 16 + Crossfeed 15 = mean **23.2%**) yields tree **×2.39**, not the ×1.85 mob_HP assumes → fights shorten to ~0.78 sec, exactly matching "perfect build 0.79 sec" in D4b · **Therefore ×1.85 is the typical-path value, and ×2.39 is the ceiling mob_HP does not cover**. This is the original intent of the table (full-gear + full-tree players kill faster than 1 sec), not a bug · What must be preserved: if a new keystone pushes the *non-ceiling* path mean above 14.2%, the problem is in mob_HP, not the node
- **9 exclusive pairs**: 5 pairs from this table + Last Stand↔Overkill + Counter↔(crit-line node) + Flurry↔(cd-line node) + Cheap Casting↔Cunning · The latter 3 already have counterparts in section 5c → **all 9 pairs complete** · Remaining content work is the 122 minor nodes

# 5c. All 9 exclusive pairs complete (all 18 used, no pairless node)

| Pair | Why they truly cut each other (not paired by branch) |
|---|---|
| Sonic Blow ↔ Burning Focus | Two paths of "per-hit value" vs "per-stack flow value" · Pick one because they target different stats |
| Brute ↔ Finishing Blow | Brute grows with lingering hit count (wants long fights) · Finishing Blow shortens fights 10% → they uproot each other |
| Counter ↔ Noble Phantasm | Both punish attackers ( Riposte vs reflect); stacking becomes a full-backline pile → pick one |
| Overkill ↔ Last Stand | Carrying excess damage (plays monster HP) vs stronger at low own HP (plays own HP) · Opposite ends of the health bar |
| Rapid Fire ↔ Anchor | Light-fast (aspd +30%) vs heavy-solid (weight tax becomes −15% taken) · Opposite poles of weight in formula.md section 11 |
| Cheap Casting ↔ Cunning | Two levers of the same mana (lower cost vs strong under 25% mana) · weakened under reservation, since auras no longer cut out at 25% |
| Flurry ↔ Deep Pockets | Two cd reducers that would multiply uncontrollably (cd −30% every 3 + 25% burst acceleration) · Prevents silently hitting the 50 CDR Cap |
| Elemental Attunement ↔ Crossfeed | One path *widens the Element gate* for another Element · The other requires statuses from *two Elements* at once → never both |
| Weighted Edge ↔ Spreading Burn | Single-target hurts more vs group chains on · Opposite poles of targeting (and hits Overkill on the group side per the original table) |

**Measured band after pairing complete** (1 pick per pair · typical path picks 6):
- Best *legal* picks = 30/30/30/18/16/16 → mean **23.3%** → tree **×2.40** (the ceiling mob_HP does not cover · TTK ~0.77 sec = D4b)
- Worst *legal* picks = 12.5/11.1/8/7/7/6 → mean **8.6%** → tree **×1.52** (= low band of D15)
- The mob_HP baseline is set at **×1.85 (14.2% mean per unit)**, exactly mid-band 1.52-2.40 → *the typical path* is the correct answer for the baseline, not either extreme · And this is why all 9 exclusive pairs must be complete: they control this band width

- Mean **14% per keystone** is the source of `+85%` in section 3
- 2 intentionally conflicting units: Cunning vs aura · Last Stand vs Overkill → leave at opposite branch ends for players to choose
