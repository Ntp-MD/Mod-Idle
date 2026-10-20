# ModWorld — calculation reference

Formulas, variables and calculation order. Coefficients live in `tools/data/`; implementations live in `engine/`. Read only the relevant section. Document ownership and update policy: [AGENTS.md](../AGENTS.md#document-map).

## Stats

1. Read level `L` and allocated points per Core attribute (`str` · `agi` · `vit` · `dex` · `int` · `wis` · `lck`).
2. Sum equipped, unbroken gear + passive-tree lines as flat / percent pools (weapon-specific tree lines apply only while held). Active effects modify only their named derived stats, never Core attributes.
3. `Core[k] = (statOf(allocatedPoints[k]) + flat[k]) × (1 + percent[k] / 100)`, then derive each stat, apply effects and weight tax, cap last.

```text
pointsAt(L) = points_per_level × (min(L, paragon_from - 1) - 1)
           + paragon_points_per_level × max(0, min(L, level_cap) - (paragon_from - 1))
statOf(points) = stat.base + points × stat.point_value
```

The reference line splits evenly (`pointsAt(L) / 7`); players use actual allocation.

## The passive tree

The tree's own numbers live in `tools/data/tree.json` and its formulas in `engine/tree.ts`. The tree never changes a published figure: `mobHP` excludes it, and the reference build allocates no tree at all.

**The shape.** Twelve wings on a pitch around a centre start. A node grants one or more lines, and the values it grants are written out in the file — the tree's numbers are the tree's own and do not move when a loot line's maximum moves. The geometry is derived from the topology: a node's depth and lane come from its parents, and the `layout` block turns those into positions. A node id is a save key, so it keeps its meaning for ever.

**The kinds.** A kind sets a node's rank count, its cost and the currency it is paid in.

| Kind | Ranks | Cost | Currency | Grants |
|---|---|---|---|---|
| `line` | 3 | 1 | tree | one line, three rising values |
| `mark` | 1 | 1 | tree | one line, one value |
| `notable` | 1 | 1 | tree | three lines at once |
| `keystone` | 1 | 1 | attainment | one line and a drawback |
| `capstone` | 1 | 1 | tree | three lines at once |

**The points.** Tree points come from the level curve — the level curve in `engine.json` owns the stat points, and the tree's own budget and rate live in the tree's spec (`points.currencies.tree`). A keystone is paid in **attainment** points, which a completed Delivery contract pays: the roll is made at offer time, last in the offer's roll order, and frozen into the contract before the player sees it.

**The rules.** A keystone may carry exactly one drawback, from a bounded vocabulary. There are no others: a rule outside this set is refused by name, so a node is never bought and quietly does nothing.

| Rule | Meaning |
|---|---|
| `remove` | the character no longer receives the named line — the drawback, applied after the gear and the tree have both folded, so the line is gone from the whole sheet |
| `cap_unlock` | raises a named Cap, through the same line the sheet already reads |
| `convert` | routes a percent of the physical share into a named Element, the route a conversion aura takes |

**The groups.** A keystone group is a one-of family: holding one member blocks its siblings, and it is the only exclusivity in the tree. There is no unlock condition on any node — a node is bought when it is connected to a path the character already owns.

**The budget.** A line has a budget, and the tree never hands out more of a line than its budget: the total across the whole tree is capped at 130% of that line's `mods.json` maximum. The values are derived from that budget, not typed; a rank never grants nothing and never grants less than the rank below it, so a line with many nodes can sit a little over its share, and a line that cannot carry a fraction gives one.

**Why the tree is shaped this way.** The wings are open to every character — the commitment lives in the keystone groups, not in a gate — and there is no attribute requirement on any node: the reference build splits its points evenly, so any absolute threshold would be passed by everybody or by nobody, and connectivity is a rule a player already understands. A keystone is paid in its own currency so it never competes with the ordinary nodes for the same point, and it may carry a drawback so the choice is a shape and not only a number. The budget exists because a value ladder would make the far nodes of a wing several times more point-efficient than the near ones, and a budget has no such preference: the worth of a point depends on the line, not on where the node sits.

### Derived stats

`C` = final Core-attribute values, `F` = flat lines, `P` = percent lines, `K_*` from `engine.json`.

| Final stat | Calculation |
|---|---|
| Max HP | `(hp_base + C.vit × K_VIT_HP + hp_per_level × (L - 1) + F.hp) × (1 + P.hp / 100)` |
| HP regen | `C.vit × K_VIT_REGEN × (1 + P.hp_regen / 100) + F.hp_regen` |
| Max Mana | `(mana_base + C.int × K_INT_MP + mp_per_level × (L - 1) + F.mana) × (1 + P.mana / 100)` |
| Mana regen | `C.int × K_INT_MREGEN × (1 + P.mana_regen / 100) + F.mana_regen` |
| Max Energy Shield | `(C.wis × K_WIS_ES + F.energy_shield) × (1 + P.energy_shield / 100)`; player only |
| Energy Shield regen | `maxES × energy_shield.regen_pct / 100 × (1 + P.es_regen / 100)` |
| Physical power | `(C.str × K_STR + F.physical) × (1 + P.physical / 100) × weapon_mult × physical_power_effect` |
| Magic power | `(C.int × K_INT + F.magic) × (1 + P.magic / 100) × weapon_mult` |
| Elemental power | Per Element: flat pool + `C.int × K_ELEM` for the weapon's Element, scaled by shared and Element-specific percents |
| Accuracy | `C.dex × K_DEX_ACC × (1 + P.accuracy / 100)` |
| Evasion rating | `(C.agi × K_EVASION + F.evasion) × (1 + P.evasion / 100) + evasion_effect` |
| Evasion chance | `r = max(0, rating)`; `effective = min(r, opening_rating) × opening_share + max(0, r - opening_rating) × earned_mult`; if `effective = 0` chance is 0, else `min(caps.evasion, effective / (effective + attackerAccuracy) × 100)` |
| Armour | `(C.str × K_ARMOUR + F.armour + armour_effect_add) × armour_effect_mult × (1 + P.armour / 100)` |
| Attack speed | `weapon_aspd × (100 + (C.agi - stat.base) × K_AGI_ASPD + P.aspd + effect_add) × effect_mult × (1 - encumbrance)`; cap `100 / caps.attack_interval_sec` |
| Crit chance | `min(C.lck × K_LCK_CRIT + P.crit, K_CRIT_CAP)` |
| Crit damage | `100 + P.crit_damage + (crit_pool - crit_chance) × K_CRIT_OVERFLOW` |
| Perfect dodge | `r / (r + K_PDOGE) × 100`, `r = C.lck × K_LCK_PDOGE × (1 + P.perfect_dodge / 100)` |
| Block | `max(0, P.block)`; Shield Frame Mod + passive tree |
| Elemental resistance | `min(caps.elem_res_max, caps.elem_res + P.resistance_cap, (P.resistance + P.all_resistance) × resistance_effect_mult)` |
| Elemental alignment | `(C.dex × K_DEX_ALIGN + P.alignment + effect_add) × effect_mult` |
| Stun chance | `max(0, alignment × K_STUN_PER_ALIGN + P.stun_chance)`; uncapped — a rolling control budget limits stop time, not chance |
| Stun recovery | `min(100, max(0, C.vit × K_VIT_STUNREC))`; remaining stop `stop_sec × (1 - recovery / 100)` |
| Cooldown reduction | `min(caps.cdr, C.wis × K_WIS_CDR × (1 + P.cdr / 100))` |
| Weight capacity | `weight_base + C.str × K_STR_WEIGHT` |
| Encumbrance | `min(caps.weight_overload, max(0, (weight_used - weight_capacity) / weight_capacity))`; attack speed × `1 - encumbrance` |

Armour penetration, status resistance, attack/spell damage, bleed chance, leech, damage taken, global speed, damage conversion: summed line/effect values, with their configured cap or multiplier.

## Combat order

One hit runs perfect dodge → Evasion → block → Armour → resistance → damage taken → ES → HP.

- `sizeMultOf` is one multiplier on the physical share, applied after mitigation; skill presses carry it, magic-damage presses are exempt.
- Crit runs one pool; chance is capped; only overflow past the cap buys crit damage.
- `capAspd` binds last — after the Agi term, the aspd band, buffs and the weight tax; the cap is a minimum interval.
- `mobArmourCut` / `mobResCut` / `armourPenCut` clamp to `[0,1]`; over-penetration is wasted; the res cut reads the correct Element.
- Evasion runs opening/earned split, opposed roll, then the cap.
- Elemental resistance applies the base, tree-raised and absolute caps from `engine.json` last.
- Damage and burn spend ES first; poison and bleed reach HP directly; shield overflow lands on HP once; ES absorb is not a second shield.

## Mob calculations

1. Select the Variant whose inclusive band covers the zone midpoint. In a gap use the closest earlier Variant; before the first band use the first. Later levels retain the final Variant. Field labels carry forward independently, falling back to the Species name.
2. Use the Variant's damage override when present; otherwise use the Species default. Read Core from the selected Variant; attacker level does not enter either selection.
3. Read fixed spawn level from `species.zone_levels[zoneId]`, within the displayed zone range. Derive base HP, Mana and Accuracy through the shared engine. Elite multiplies complete HP and replaces the Large-body DPS factor with its rank factor. Boss and wild-unique use their own Core profile and the Boss-body DPS factor; neither adds a separate HP multiplier.
4. Elite keeps the selected Variant Core and level. A zone Boss uses its authored zone profile and species level. A wild Unique uses its authored profile at the zone's upper level and replaces a normal spawn.

```text
mobCore[k] = selectedVariant.core[k]
mobDamageType = selectedVariant.damage ?? species.damage
[wPhys, wMagic] = damage_split[mobDamageType]
baseMobHP(level, core) = mobHpAt(level) + hp_per_level × (level - 1) + core.vit × K_VIT_HP
normalHP = baseMobHP(level, selectedCore)
eliteHP = baseMobHP(level, selectedCore) × mob.elite.hp
bossHP = baseMobHP(level, bossProfile.core)
uniqueHP = baseMobHP(zoneTopLevel, uniqueProfile.core)
mobMana(level) = mana_base + mana_per_level × (level - 1) + mobInt × K_INT_MP
mobAccuracy = mobDex × K_DEX_ACC × accuracy_mult
speciesPower(profile, damageType) = profile.power_base + K_MOB_PS_STAT × (wPhys × profile.str + wMagic × profile.int), where [wPhys, wMagic] = damage_split[damageType]
speciesPsMult(profile, damageType) = speciesPower(profile, damageType) / zoneMeanSpeciesPower
bodyDPS(level, bodyPS, speciesPsMult) = mobPsAt(level) × bodyPS / zoneBodyFactor × speciesPsMult
normalDPS = bodyDPS(level, selectedBody.ps, speciesPsMult(selectedProfile, mobDamageType))
eliteDPS = bodyDPS(level, mob.elite.ps, speciesPsMult(selectedProfile, mobDamageType))
bossDPS = bodyDPS(level, bossBody.ps, speciesPsMult(bossProfile, bossProfile.damage))
uniqueDPS = bodyDPS(zoneTopLevel, bossBody.ps, speciesPsMult(uniqueProfile, uniqueProfile.damage))
```

Boss and Unique HP have no rank multiplier: their Core profile supplies VIT. Elite, Boss and Unique XP use their respective multipliers in `engine.json`.

`mobHP` excludes equipment and passive-tree power. Live spawns and roster reports use the same level, Core, damage type, Species, zone, size and boss inputs, including the Elite zone-body factor.

## Standing progress

For settlement `s` in zone `z`, `progress = zoneKills[z] + town.helpCredit[s]`. `tier` is the number of configured shares whose `ceil(share × settlementBudget[z])` is at most `progress`. `share = progress / settlementBudget[z]` when the budget is positive; otherwise the tier and share are zero. Keep `zoneKills` as actual kills. Camp aid credit is settlement-owned and capped by `town.json`.

The shared helper is `engine/standing.ts`; `sim/town.ts` adapts saved state and every service, Collector and map reader uses the same tier result.

## Trade and currency

`engine/trade.ts` owns catalogue values and the integrated demand curve. Supply is measured in base gold per town/category; `now` is credited simulation time. `peak` selects the town's import, export or neutral coefficient.

```text
volume = floor(max(0, count)) × good.value
used = clamp(saved.used - max(0, now - saved.atSec) × capacity_gold / recovery_sec, 0, capacity_gold)
remaining = capacity_gold - used
area = (remaining² - max(0, remaining - volume)²) / (2 × capacity_gold)
rawGold = volume × floor_mult + area × (peak - floor_mult)
nextUsed = min(capacity_gold, used + volume)

scale = 10 ^ currency_decimals
paidGold = floor((rawGold × saleMult + savedCredit) × scale) / scale
nextCredit = rawGold × saleMult + savedCredit - paidGold

workshopUnitValue = sum(inputCount × inputBaseValue) × workshop_value_mult / yield
cookedValue = sum(inputCount × inputBaseValue) × recipe_value_mult
serviceGold = roundCurrency(priceMinutes × goldPerMinute(chargeBand) × serviceMult)
```

Currency flooring compensates for floating-point roundoff. The remaining fraction carries across sales and reloads. Junk rarity sets frequency so `dropChance × baseSaleValue` stays constant. `leanReweight` redistributes gear/herb/junk mass without changing total expected drops per kill. The reference loot TTK is `eng.REFERENCE.ttk`, republished by the roster with `--sync`.

## Haggling

`trade.haggling` reads `town.json.trade.haggling`. XP comes once per completed Delivery from its stored intrinsic difficulty.

```text
xpForLevel(L) = (L - 1)² × level_divisor
level = min(level_cap, floor(sqrt(max(0, xp) / level_divisor)) + 1)
progress = (level - 1) / (level_cap - 1)
saleMult = 1 + progress × sale_bonus_max_pct / 100
deliveryMult = 1 + progress × delivery_bonus_max_pct / 100
serviceMult = 1 - progress × service_discount_max_pct / 100
completionXp = difficulty × xp_per_difficulty
```

## Delivery derivation

`engine/delivery.ts` derives rewards from intrinsic acquisition; reachable production and travel determine the deadline. `game/src/sim/delivery.ts` snapshots the offer.

```text
difficulty = band_weight × rarity_weight × (1 + processing × processing_weight) × count ^ count_exponent
premium = 1 + (premium_base + difficulty × premium_per_difficulty - 1) × deliveryMult
completionGold = floorCurrency(rawQuoteAtOffer × (premium - 1))
stoneCount = max(minimum_stones, eng.taskPayout(band, reward_minutes × difficulty)[income])
fallbackCount = max(minimum_stones, eng.taskPayout(band, fallback_minutes × difficulty)[income])
deadline = max(deadline_min_sec, ceil(productionSec × production_allowance + travelSec + deadline_allowance_sec))
```

Intrinsic band, rarity and processing are independent of the chosen route and carried goods. Carried goods reduce missing production. Offer candidates must fit `deadline_max_sec`. Distance changes the deadline only. Partial hand-ins use the live sale formula; the frozen completion bonus pays once.

## Black Market prices

`engine/black-market.ts` snapshots prices from `town.json.black_market`.

```text
materialPriceEach = baseValue × maxTradePeak × resale_cover_multiplier × rarity_price_multiplier
price = floorCurrency(priceEach × count + smallestCurrencyUnit)
skillXpAfterPurchase = max(existingXp, skillXpForLevel(offeredLevel))
```

Stones and named Skill XP Level offers use their authored price.
