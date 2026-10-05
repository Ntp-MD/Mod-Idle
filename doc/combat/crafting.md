# Crafting

import glossary.md
import item-rarity.md
import mod-pool.md
import equipment-slot.md

**Spec complete** — the three tiers, the seven stones and their prices are set; the set-numbers table is generated from `tools/data/engine.json` by `node tools/check.ts --write`.

The crafting system has a single duty: **let players reach high Item quality without fighting high-level zones**.
If crafting does not serve this duty, the item Item quality axis separated from monster level becomes a redundant name.

**Crafting is Settlement-only** — the bench lives in a settlement (`towns.md`), so the player must leave Adventure and return to craft and to deposit the adventure bag into the stash. A long run therefore ends in a trip home (`loot.md` section 4 · D-056).

# 3 Crafting Tiers

Each tier upgrades one step at a time, and each step uses different crafting currency.

| Tier | Effect on item | Can do | Cannot do |
|---|---|---|---|
| **Reroll** | No slot change | Reroll the value in the selected slot, staying in the same Tier | Change Mod name · Change Element · Change Item quality |
| **Refine** | No slot change | Push the selected slot up 1 Tier (T3 → T2 → T1) | Change slot · Change Element · Exceed T1 |
| **Ascend** | Change whole-item Item quality | Raise Item quality 1 step (low → mid → high). All mods move together | Exceed high Item quality · Add Mod count |

- Ascend is the most valuable tier, because it strengthens **all mods** at once, and is the only path to high Item quality without fighting high-level zones.
- Refine is the most frequently used tier, because it fixes a single weak point of an item.
- Every tier crafts only one slot at a time, except Ascend which affects the whole piece.

# Blocking Rules

1. **Element cannot be locked** — Reroll and Refine can change values but cannot change Element.
   Reason: if crafting could change Element, players would reach near-Cap res in every Element and Element choice would disappear from the whole system.
   Element is therefore the **only thing left to luck** on items.
2. **Mod count grows only via Add mod stone, up to the Rarity crafted max** — Common to 3, Rare to 7 (net counting, `mods_added 0-2` per item). No other craft touches count. Dropped Rare never exceeds 5.
3. **Mod identity changes only via the Remove + Add combo** — Remove mod stone deletes one random non-legacy mod (slots 1-2 are Legacy mod and can never be hit); Add mod stone then fills the freed slot from the Base pool. Direct rename in place is forbidden.
4. **Cannot skip Item quality steps** — Ascend moves one step at a time only. Skipping would need a finer currency-level system.
5. **Reroll tier stone is the only craft allowed to roll lower.** Reroll value stone never rolls below the old value; Refine never steps down.
6. **Add mod stone never offers a Mod line the item already has.** One item holds each Mod line at most once, and with the `Stat Mod %` sibling retired (D-114) there is no flat+% pairing left (mod-pool.md). The Add always rolls from the Base Primary/Secondary pool and is never chosen by the player — the stone draws, it does not ask.
   Reason: a chosen-mod Add would make Add mod stone a guaranteed line instead of a gamble, and the whole crafting duty here is "raise Item quality by luck you paid for", not "buy a specific stat".

# Crafting Stones

7 stones are the only media. No Dust, no cluster dust, no Core wallets. Flows below carry the ex-wallet rates; exact incomes finalize in the rebalance pass.

| Stone | Used for | Source |
|---|---|---|
| Reroll value stone | Reroll value | Every junk dissolve = 1 (ex-Dust flow) |
| Reroll tier stone | Reroll tier / Refine | High-level monsters, elites, bosses (ex-cluster flow) |
| Add mod stone | Add / Ascend | Elite / boss only |
| Remove mod stone | Remove | Elite / boss |
| Quality Stone | Upgrade | Monsters → elites → bosses by step |
| Corrupt stone | Corrupt (section below, one use per piece) | Boss only, rarest stone |
| Repair stone | Repair | Elite / boss only |

- Reroll value stones are the only stones farmable from normal play, making tier work something that costs effort.
- Ascend is the only thing requiring advance planning, because Add mod stones come only from elites and bosses.
- Bosses are the main source of stones and randomly dropped skills, at the same time.

**Skills cannot be crafted** — No Mod, no Item quality. The only action is rank-up from duplicates.
The crafting system therefore never touches skills. The two systems are fully separate.

# Stones (simple names)

Registry lives in item-list.md section 1; the table below is the usage view.

| Stone | Effect | Source |
|---|---|---|
| Add mod stone | Fill one empty slot up to the Rarity crafted max (net counting) · 1st fill costs 1, 2nd fill on the same item costs 2 | Elite / boss only |
| Reroll value stone | Reroll value inside the same Tier, never lower · **8 per use** | Every monster, large amounts (415/hour → ~52 uses/hour) |
| Reroll tier stone | Reroll Tier + value of one slot with drop weights (T3 50 / T2 33 / T1 17), may roll lower · Mod name and Element unchanged · **1 per randomize, 8 per deterministic Refine (+1 tier)** | High-level monsters, elites, bosses (30/hour → ~3.75 Refines/hour) |
| Remove mod stone | Remove one random non-legacy mod (slots 3+, Legacy mod slots 1-2 immune) | Elite / boss |
| Quality Stone | Attempt +1 (section below) · **tiered cost** (section below) | Steps 1-5 monsters · 6-10 elites · 11-15 bosses |
| Repair stone | Revive one Broken piece at its pre-break level and refill protection to 5 | Elite / boss only |
| Corrupt stone | One gamble per piece (section below) · corrupted pieces accept no further stones | Boss only, rarest stone |

# Upgrade (+1 to +15, Ragnarok style, online only)

```
+1 to +4   100% (safe)
+5 to +10  90% down to 60% · fail drops 1 level, never breaks
+11 to +15 50% down to 20% · fail breaks the piece (Broken: unequippable, stats 0, kept at its level)
protection   5 per piece from birth · each would-be break consumes 1 instead and drops a level · Repair stone refills to 5
cost          steps +1..+5   = 1/2/3/4/5 Quality Stones
              steps +6..+10  = 7/9/11/13/15
              steps +11..+15 = 18/21/24/27/30
              source shifts 1-5 monsters · 6-10 elites · 11-15 bosses (D-009 5a)
```

- Refining runs only while online (like bosses). AFK never refines, so nothing breaks offline.
- Each +1 raises only the piece Gear Mod (next section) by `craft.gear_mod_per_level`, whose value is the published ceiling of the very line it raises: a full +15 ladder lands exactly on the smallest of the three school ceilings, so no upgraded piece can out-print a T1 rolled line (**X42** reads both numbers out of `engine.json` and `mod_max`). Rolled Mod values are never touched by Quality Stone.
- The uplift is paid for at the encounter, not at `mob_HP`: gate **SV7** re-runs the level-cap boss against a full +15 set and the G5 promise still holds (D-103 measured `mob_HP` as already inside the published pacing, so nothing may move there).

# Corrupt (Vaal style, one use per piece)

| Roll | Outcome |
|---|---|
| 25% | Corrupted only, nothing changes |
| 20% | Reroll all values inside current Tiers |
| 15% | +1 Mod (respects Rarity crafted max and the Core slot cap) |
| 15% | Remove 1 random non-legacy Mod |
| 10% | Reroll Element (the only Element change in the game) |
| 10% | Gear Mod +2 |
| 5% | Item quality −1 step (never destroys the piece) |

- One use per piece. A corrupted piece accepts no further stones of any kind.
- Weights pending rebalance.

# Gear Mod (PoE mechanics)

Bases map to one school: heavy (Sallet · Plate Vest · Cuisses · Plated Greaves · Iron Gauntlets · Heavy Mantle) = Armour · light (Hood · Ring Mail · Breeches · Strapped Boots · Nimble Mitts · Traveler's Cloak) = Evasion · cloth (Circlet · Vestment · Legwraps · Silk Slippers · Silk Wraps · Silk Drape) = Energy Shield.

```
armour reduction% = armour / (armour + 5 × raw_hit)   physical half only
evasion           = PoE entropy roll vs mob accuracy, contested once per hit (combat.md section 2)
energy shield     = second pool ahead of HP · Int x K_INT_ES · chaos bypasses · recharges after 3 sec without a hit (D-026)
```

- Evasion is the only avoidance layer (D-112): the retired Dodge lines feed this one roll, and its Cap is proven reachable by **X20** rather than asserted.

# Item Quality Sources — Summary

| Path to Item quality | Reaches level |
|---|---|
| Drop from low-level monsters | Low |
| Drop from mid-level monsters | Mid |
| Drop from high-level monsters | High |
| Ascend with Core | High without fighting high-level zones |

- **Ascend is not limited by the drop-source ceiling** (fixed from the earlier text "can raise at most to the ceiling of that item").
  Reason: that sentence contradicts the first line of this file defining the crafting duty as "let players reach high Item quality without fighting high-level zones" · If still capped, items dropped in mid zones could never become high no matter how many Add mod stones are spent.
  The real cost that remains is **Add mod stones come only from elites and bosses, and AFK cannot fight bosses** → the ceiling "high Item quality must come from players staying in the game" still holds, but moves from *drop-source limit* to *stone limit*, which is what players can actually work toward.
- Intended side effect: plain items dropped in low zones can still climb to high **if** time is spent collecting Add mod stones · Makes "leave the zone and sit down to craft" a real path, not a slogan · The *drop* Item quality ceiling stays tied to zones as before (item-rarity.md).

# Set Numbers (source: loot.md section 5)

<!-- BEGIN GENERATED:craft-set -->
| Tier | Price | Actual casts/hour at high zone | Meaning |
|---|---|---|---|
| Reroll value | 8 Reroll value stones | ~52 | Cheap, can spam · Keeps values inside the same Tier |
| Refine | 8 Reroll tier stones | ~3.75 | Main upgrade path · Tier stones come only from elites (1 in 5, 5% drop) + bosses |
| Ascend | 8 Add mod stones + 8 Reroll tier stones | ~0.78 | Slowest and needs planning · Add stones come only from elites and bosses (no AFK path) |
| Add (1st / 2nd fill) | 1 / 2 Add mod stones | boss-gated | Expands to Rarity crafted max (net counting) |
| Upgrade +N | tiered Quality Stones: 1/2/3/4/5 · 7/9/11/13/15 · 18/21/24/27/30 (sources shift monsters → elites → bosses by step) | set (D-009 5a) | Raises Gear Mod only |
| Repair | 1 Repair stone | elite / boss only | Revives Broken + refills protection |

```
Refine full set (12 pieces × 2 steps = 24 casts, because Tier belongs to the piece · D-033) ≈ 6.4 hours
Ascend full set (12 pieces)                             ≈ 15.4 hours
```
<!-- END GENERATED:craft-set -->

# Closed

- **Crafting currency prices and sources** → Table above, tied to drops/hour and elite/boss spawn chances in loot.md.
- **Preventing Reroll from ruining items** → **Decided: Reroll cannot roll below the old value** (keep the slot maximum as baseline · Reroll climbs or stays equal).
  The old option was "confirm every click", which at ~52 casts/hour is fiddly work to click all day in an idle game · Passive protection needs no clicks at all.
  Accepted cost: Reroll looks "one-way climbing" and thus less exciting — compensated by letting Refine/Ascend carry the real quality pulls.
- **Cross-level stone crafting** → Not yet done, and not needed now, because Reroll tier stone flow at 3.8 casts/hour already covers 60 casts for a full set.

## Polish vs Tier Jump (measured from real T1 ranges in mod-pool.md)

T1 ranges differ per line: `%` spans 1-2 points · crit damage 12 · **Max HP Flat 19 · Max Mana Flat 20**.

```
1 Reroll on a mid-value line → moves ≈ half of the T1 range
Average across all lines ≈ 4.9 points · Full 12-piece set × ~3 mods ≈ 100 casts to fully polish
At 52 casts/hour = about 2 hours per set
```

- **Reroll is cheap and fast by design** because its real duty is "fix bad rolls", not climbing power · The slow ones are Refine (16 hours/set) and Ascend (15 hours/set), which are the true *tier movers*.
- **Measured shape problem**: lines with the widest T1 ranges (Max HP Flat 19 · Max Mana Flat 20) are the least valuable late-game lines (+1% and +0%) → meaning *polishing looks most effective in the most worthless mods*.
  **Mitigated (without squeezing ranges)**: equipment-slot.md weights Flat lines at 0.5/0.4/0.25 by Item quality tier → at high zones the chance a Reroll lands on a Flat line drops from ~8% to ~4.4% of all mods · Flat ranges in mod-pool.md stay unchanged (they are still needed early-game: Max HP Flat 90 = +2.1% EHP at level 10 vs +1.0% at 100 — lines designed to *expire*).

# Additionally Closed (after item-base.md was created)

- **Crafts per piece: no separate limit** (decided) because structural ceilings already exist — Refine stops at T1 · Ascend stops at high Item quality · The real cost is currency prices in the "Set Numbers" section · Adding another limit would stack a second rule over the first which players cannot distinguish.
- The 60 Refine / 12 Ascend lines per set are therefore a "natural ceiling", not a per-piece Cap to record → save.md need not store per-piece craft counters.

# Still Open

Nothing in this file is open. The one item it used to carry — **Mod secondary weights** — is **closed in `equipment-slot.md` section "per-Mod weights"** (every secondary weighted by `value` measured from real marginal value, and that weight is already inside the `loot.md` section 3 taper simulation).

