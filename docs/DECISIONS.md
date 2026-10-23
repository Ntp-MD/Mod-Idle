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

**The shape.** Seven regions — Str, Agi, Dex, Int, Wis, Vit, Lck — share a free centre Start. `cluster-web-v6` uses the group sites and two-anchor road plan in `tools/data/tree.json`; `engine/tree-cluster-web.ts` derives the local loops, route steps and clear Keystone pockets. Normal roads cross region borders at different distances from Start and stay traversable without buying Notables or Keystones. Notables sit on local loops or in side pockets; each Keystone remains a leaf of its own Notable gate. Each gate has a direct entrance from Normal roads; a second catalogue slot branches from a different Normal instead of extending through the first Notable. Either Keystone can be chosen without buying the other branch Notable. Every live Normal serves a route between anchors; retirement is restricted to frozen legacy IDs. `needs` stores spanning parents and both parents of a bridge Notable; `links` stores additional routes. The browser uses the canonical coordinates directly. Spine/cluster placement fields identify stable v3 save keys rather than separate travel lanes. Redesigning the roads preserves live owned nodes, grants and wallets; a saved rank on a retired Ordinary node is refunded on load, and each live owned node remains a valid frontier even if its old route is rearranged. Characters predating v3 are still refused with their own message rather than silently filtered.

**The kinds.** A kind sets a node's cost, the currency it is paid in, and what it grants.

| Kind | Ranks | Cost | Currency | Grants |
|---|---|---|---|---|
| `normal` | 1 | 1 | tree | exactly +1 of its region's Core attribute, through `stat_mod_flat` with `stat` named |
| `notable` | 1 | 3 | tree | a resolved `profile`: two or three flat / percent lines, some naming an Element |
| `keystone` | 1 | 1 | attainment | one bundle `{kind:'keystone', key, params}`; it may be grantless |

A profile and `grants` are alternatives, not both. A keystone's number is its own: it changes a mechanic, it does not add a stat line, and there is no global keystone limit.

**The points.** Tree points are `tree base + the level ranges + quest bonuses − what the ranks spent`, and each half stays in its own wallet:

```
treePoints       = pointsAt(level) + questTreePointsEarned − spent('tree')
pointsAt(L)      = 3 + 3 × min(L − 1, 99) + max(0, L − 100)      // 3 / 300 / 301 / 390 at L 1 / 100 / 101 / 190
attainmentPoints = earned − spent('attainment')
```

`questTreePointsEarned` rises only when a Town task or Delivery claim actually pays its stored bonus. A keystone is paid in **attainment** points, which a completed Delivery contract pays: the roll is made at offer time — one extra draw after the offer's existing draws, even when it comes up zero — and frozen into the contract before the player sees it. A respec hands back both wallets at their spec prices; there is no per-node refund.

**The purchase graph.** Buying walks the undirected union of `needs` and `links`. There is no attribute requirement on any node (D3). An unpurchased Keystone is never a through-route; a path may end on one but not pass through it. The path search is multi-source Dijkstra from Start and the owned component, with a lexical id tie-break, and the whole path is validated (connectivity, currency, pair conflicts, bundle handler) before it is spent — never halfway.

**The rules.** A v3 keystone carries no `rule` drawback; its whole effect is its bundle. The bundle registry (`engine/keystones.ts`) owns each key's parameter names, units and ranges and the hooks its handler must answer; a key is purchasable only while the runtime table supplies every required hook.

**The conflicts.** Exclusivity is pairwise only, from `incompatibilities`: the 41 unordered pairs of the keystone table. There are no one-of groups and no transitive closure — a pair that is not listed may be held together.

**The mechanics line.** Cross-system constants live in `tree.mechanics`: Low Life at `low_life_pct` (50% of **Full Max HP**; a Keystone that reduces usable HP does not lower it, and Chaos Inoculation is never Low Life), the HP-cost floor, the combat clock's `combat_time_units_per_sec`, periodic payments, the control bucket, and the Camp minimum HP per second.

**Reservations.** Full Max HP and Full Max Mana are the final pools before reservation; auras, 34's fixed 40% Mana reserve and 35's fixed 25% HP reserve only reduce the **usable** share. Healing clamps to usable, never to a reduced Max, and the HUD shows Max, usable and reserved separately. Energy Shield is spent before Health, and the Chaos Inoculation hit path takes the damage its HP cannot through ES first.

**Why the tree is shaped this way.** Every region opens from Start — the commitment lives in the keystone pairs, not in gate — and there is no attribute requirement, because the reference build splits its points evenly and any absolute threshold would be passed by everybody or by nobody. A keystone is paid in its own currency so it never competes with the ordinary nodes, and each one is a change of rule rather than a bigger number.

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

## Skill presses and status payoffs

A row may name one status it exploits (`bonus_vs_status`, `consume_status` or `spread_status`). The status is read from that effect, so the row and its condition never hold two copies of the same fact.

- `bonus_vs_status`: while the target holds that status, `press_target = press × (1 + bonus_pct / 100)`.
- `consume_status`: `stacks = min(live_stacks, cap)`; `press_target = press × (1 + stacks × per_stack_pct / 100)`; the stacks are removed after the hit.
- `spread_status`: before the consume, the live line is copied to up to `value` other targets the row reaches. The copy keeps stacks, remaining seconds and `perSec`; it starts no new clock and never overwrites a stronger line.
- The auto-cast condition legs `statusPresent` and `statusStacksAtLeast` read the same exploited status. `selfDebuffed` reads the character's own live statuses. Like the other legs they are an OR list.
- A retired row keeps its id resolvable in `byId` for old saves, but it is excluded from drops, named rewards and the live roster. `retired_to` names the active row that carries its role; no save migration is required.

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

Variant Core is authored under `mob.core_spend`: Dex is capped at 22 / 25 / 28 / 31 / 34 by Variant band, and the cap bends down for a body whose Agi is below 18. Every live stat carries points, Wis is 0 and physical Int is 0; a magic profile keeps Int above Str. Boss and Unique profiles keep their own Core and the source Species Vit.

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
bonusMaterialChance = budget / (average quantity × material value), budget = 5% of the live junk gold/kill
mobResistance(Element) = Element === species.resistance.element ? min(caps.elem_res, species.resistance.pct) : 0
mobWeakness(Element) = Element === species.weakness.element ? 1 + species.weakness.taken_pct / 100 : 1
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

## Quest reward choices and milestones

`town.json delivery.reward_modes` selects an offer's mode by `(savedSerial - 1) % sequence.length`. Fixed uses the ordinary stored bonus. Choice gold is `floorCurrency(rawQuoteGold × (premium(difficulty, offerHagglingXP) - 1) × choice_reward_mult)`; its stone and skill-fallback alternatives call the existing `stoneBundle` with `difficulty × choice_reward_mult`. These calculations live in `engine/delivery.ts`. No additional loot draws are consumed: the former random Tree Point draw is retained, and Expedition reuses its former draw to select a useful named skill.

`town.json quest_rewards.milestone_tree_points` is promised once per `expedition:<zone>` or `delivery:<town>` objective. Open promises reserve their milestone; only successful final payout marks the saved ledger. These points never compete with consumable alternatives. Legacy saved random bonuses remain frozen; importing or backfilling grants nothing.

## Black Market prices

`engine/black-market.ts` snapshots prices from `town.json.black_market`.

```text
materialPriceEach = baseValue × maxTradePeak × resale_cover_multiplier × rarity_price_multiplier
price = floorCurrency(priceEach × count + smallestCurrencyUnit)
skillXpAfterPurchase = max(existingXp, skillXpForLevel(offeredLevel))
```

Stones and named Skill XP Level offers use their authored price.

## Forge

`engine/forge.ts` resolves a pattern and the chosen material; `tools/data/engine.json` `forge` owns the material families/grades, the pattern costs and both grade ladders. The client then rolls the piece with `loot.buildLines`, exactly the drop skeleton. `tools/forge.ts --checks` proves every material, Base and weapon Frame reference.

```text
grade = forge.materials[material].grade          // 1..3
q = grade - 1
span = item_level.spans[q]
band = span.band
ilvl = clamp(character level, span.from, span.to)
character gate: character level >= span.from
smithing gate:  smithing level >= forge.smithing_level[q]
count = forge.armour[slot].count             // armour pattern
      = forge.weapons[weaponType].count      // weapon pattern
xp = forge.xp_per_grade[q]
```

An armour pattern takes any family that names a Base for the slot; a weapon pattern has one family. The material's family picks the Base/Frame, and its grade picks the band. A forged piece carries the same line skeleton as a drop (line 1 + Bound pair + 2–5 Unbound lines), enters the bag unfiltered and then answers the same Craft bench verbs. There is no gold fee and no forge-specific saved state. Fancier Base variants remain drop-only.
