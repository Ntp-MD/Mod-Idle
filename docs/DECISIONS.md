# ModWorld — core design brief

The owner's rules for the core game: stats, mobs, combat, travel, drops and economy, saves and the RNG stream.
Figures live in `tools/data/`; game terms live in `docs/glossary.md`.
An agent reads this brief and does not write to it unless the owner asks.

## Stats

1. Read level `L` and allocated points per Core stat (`str` · `agi` · `vit` · `dex` · `int` · `wis` · `lck`).
2. Sum equipped, unbroken gear + passive-tree lines as flat / percent pools (weapon-specific tree lines apply only while held). Active effects modify only their named derived stats, never Core.
3. `Core[k] = (statOf(allocatedPoints[k]) + flat[k]) × (1 + percent[k] / 100)`, then derive each stat, apply effects and weight tax, cap last.

```text
pointsAt(L) = points_per_level × (min(L, paragon_from - 1) - 1)
           + paragon_points_per_level × max(0, min(L, level_cap) - (paragon_from - 1))
statOf(points) = stat.base + points × stat.point_value
```

The reference line splits evenly (`pointsAt(L) / 7`); players use actual allocation.

### Derived stats

`C` = final Core, `F` = flat lines, `P` = percent lines, `K_*` from `engine.json`.

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
- `elem_res` ceiling is 75; the tree raises toward 90, clamped absolute however stacked.
- Damage and burn spend ES first; poison and bleed reach HP directly; shield overflow lands on HP once; ES absorb is not a second shield.

## Mob Core

- Race > Species > Variant. A Race is one broad fantasy category in `mob.races`; a Species (Goblin, Orc, Golem) belongs to one Race and owns the gameplay data. Race membership alone grants no mechanic.
- The Race registry is closed for now: Humanoid, Beast, Undead, Demon, Dragon, Insect, Plant, Fish, Formless, Elemental, Celestial. An empty Race is allowed and none is empty today — Celestial opened with Archon, Fish with Siren. Goblin and Orc are Humanoid Species, Golem belongs to Elemental, Wraith to Undead. A Species is fielded where its `zones` say it lives, and every zone it lists must show it on at least one subzone side (`mob.zones[].subzones[].species`); `habitat` is what it may move into later without a roster rewrite.
- There is no target count for Races, Species per Race, Variants per Species, field forms, uniques or Species junk alternatives. Existing content counts are not quotas.
- Sizes are per Species; normal Variants need Small or Medium; Large is the solo Elite body. Subzones are independent pools whose union covers the zone cast.
- Ladder length is a content choice, never a gate: the shipped ladders run five deep (`[1-20] [21-40] [41-60] [61-80] [81-100]`, two zones per rung). Each Variant authors its own integer Core, inclusive selection band and drop identity, and bands cannot overlap. A zone midpoint selects its covering Variant, or carries forward the closest earlier one when the ladder has a gap; before the first band it uses that first Variant. The Species' `zone_levels[zoneId]` supplies the actual fixed spawn level in every zone and must sit inside that zone's displayed range — neither the Variant band midpoint nor the attacker's level replaces it. A ladder change deletes the junk item of every Variant it removes; the schema is not public yet, so no migration carries an old stack forward — a save-format change is on the release checklist.
- Variant names are authored freely (a form that already names its Species — Wyrmling, Wolfman, Ash Imp — carries no extra suffix); the ladder is not name-pattern gated, because a name reading as a creature is not something a check can prove.
- A Species may author any subset of common/uncommon/rare junk alternatives. Variant rarity and lean remain Variant-owned; names connect the Species' material/culture with the Variant's role.
- Field forms are optional labels and may be sparse: a missing label reuses the latest earlier form, or the Species name when none exists. Variant Core remains the live combat Core.
- Levels 101–180 reuse the latest Variant and field label, with no equipment or passive tree.
- Elite = rank over the selected Variant (same name/junk, Large body, Elite mults). Clock Boss = fixed zone profile. Species may have zero or more wild Uniques: zone-top level, Elite stones, ×30 XP, crown junk.
- `humanoid` is not a gameplay/drop switch. Potion eligibility is the explicit per-Species `potion_source`; Race membership does not grant it.
- Zones impose no Element themes and filter no Species, so rosters stay broad. One-handed axe size multipliers stay neutral at 1.0.

```text
mobCore[k, form] = form.core[k]
```

The zone midpoint selects a Variant band for its name, Core and drop identity; `zone_levels[zoneId]` sets the Species' actual level. Levels 101–180 keep selecting the final Variant while continuing to use their authored per-zone levels. HP/combat use that fixed level and the selected Variant's Core with the shared engine's Species, zone, size and boss inputs.

```text
mobHP(level) = mobHpAt(level) + hp_per_level × (level - 1) + mobVit × K_VIT_HP
mobMana(level) = mana_base + mana_per_level × (level - 1) + mobInt × K_INT_MP
mobAccuracy = mobDex × K_DEX_ACC × accuracy_mult
```

Elite HP multiplies the complete `mobHP` value (curve, level grant and Vit) by `mob.elite.hp`; Boss and wild-unique HP use their profile's Vit. The roster report and live spawn share this formula, including the zone body factor in Elite PS.

## Travel and local exploration

- A Species' authored `zone_levels[zoneId]` is its fixed normal/Elite level in that zone; the zone midpoint selects the Variant name/Core/drop identity only. Nothing else scales or replaces a live spawn level.
- Forward walks to the next already-open settlement when the current zone band is behind; its first visit still needs a player-chosen walk. Manual Waypoints remain an instant gold-for-time option; a Push returns to the last held zone and keeps its level gate.
- Patrol is an optional circuit of 2–3 named subzones inside one visited zone: three groups cleared at a stop, then a walk to the next. The route may repeat or run once and the player can stop it. Walking and route advancement happen online; offline combat stays at the current stop.
- An Expedition task names one Species and one subzone and counts only that Species' Elites, defeated while hunting from that exact subzone. It has no deadline and pays the Elite task Tier-stone rate; Expedition offers take a quarter of the old 75% Elite share, so the combined Elite/Expedition share is unchanged.
- Auto-Return is optional and off in existing saves. During Patrol, at 90% of the adventure bag it waits for the current group to clear, walks to the owning settlement, stashes every unlocked gear piece and resumes the saved route if it freed space. Locked gear stays carried; if no gear can be moved, Patrol stops safely at town — nothing is auto-sold or discarded.
- A rolled trail food event uses the current zone's `fieldwork.regional_sources.food`, so the road's provisions identify the region. Its roll is independent of the ambush roll and adds no currency or crafting-stone faucet.

## Drops & economy

Every faucet and sink lives in `tools/data/`, measured in expectations. Every payout calls the engine function, never a copied formula or literal price. `loot.ttk_per_mob_sec` is the reference time-to-kill the roster computes (`eng.REFERENCE.ttk`), so the cage re-publishes it with `--sync` — it is never hand-typed, and a Species added or retired moves it. `mob_PS(L)` is the zone's **average** mob by construction: each Species' power reads over that same zone mean (`eng.speciesPsMult`), so the mean is 1 for every zone whatever the roster holds, and no zone edge, timeline or survival number moves when a Species is added, retired or re-tuned. That identity is a consequence of the model, so no gate re-checks it.

- `leanReweight` redistributes mass across gear/herb/junk; total expected drops/kill is unchanged.
- Junk rarity buys frequency at the reference value: chance × base sale value is flat. Realised gold depends on the destination market and its supplied demand.
- No band lets a player loop a sink back into a faucet.
- The Counterhand buys earned junk, field materials, provisions and farm herbs. Gold buys the existing town services only — markets never sell goods back into a profit or power loop; the Black Market below is the one owner-confirmed exception.
- `town.json.trade` owns base values, each town's import needs and abundant exports, demand capacity, recovery and processing value. Junk keeps its rarity base value; explicit commercial groups in `trade.junk_groups` classify Species drops independently of Race.
- Each town shares one saved supply pool per goods category, measured in base gold rather than item count. Deliveries consume demand, which recovers over credited simulation time online or offline. Viewing a quote, walking, reloading or changing the real-world date does not reset supply. Quotes integrate the declining premium across a sale, so splitting the same quantity cannot improve its payment.
- Sale payments use the currency's configured decimal precision; earned fractions carry in the save into the next sale, preserving value across split transactions and reloads.
- The Market compares current quotes for a chosen quantity, walking blocks, available Waypoint costs and net proceeds after the warp. Visiting a buyer and carrying the goods are required to sell. The quick Sell action handles junk only; provisions, herbs and materials need an explicit sale.
- `engine.json.fieldwork.regional_sources` owns each zone's Mine mineral, Grove wood and forage bonus; existing ore, timber and rarewood keys and stock are preserved. Regional resources supplement those common materials and feed distinct cooking or workshop recipes as well as trade.
- Workshops consume carried materials at a settlement and produce finished cargo. Cooking recipes define their edible cooked provision directly, including Hunger and the one active meal buff. Goods are not interchangeable currencies: selling ingredients gives up their Camp, food, brewing or processing uses.
- Market records and catalogue defaults backfill automatically in current-schema saves without changing existing item counts, gold, skill XP or market records; imports and exports keep their schema compatibility.

### Black Market (owner-confirmed 2026-10-16)

- Owner request: the Black Market sells **rare materials, craft stones, other whitelisted rare goods and named skills at a target Skill XP Level, for Gold** — an explicit exception to "gold buys town services only". No new currency; every other stall keeps the old rule, and the requested catalogue is never filtered back to services.
- Skill XP Level is distinct from the Duplicate Ladder and from life-skill Mastery. A purchase grants ownership when missing and sets XP to the greater of existing and the offered level's XP — never a downgrade, never a ladder duplicate, never an automatic toggle. An owned skill that cannot gain a level refuses the sale and charges nothing. Max-level offers mean `skill_xp.level_cap`, carry an explicit data weight and are generated like any other band.
- Stock is per visited town, frozen in the save and refreshed by seeded RNG on the online settlement tick only — after the same tick's world and delivery draws, in stable town order; offline time pauses the refresh and queues nothing. Viewing stock, walking away, reload, import or a real-clock change never rerolls it. There is no paid reroll and no mystery purchase.
- Purchases preview then commit once through the account writer, validating settlement presence, affordability, frozen stock and combined bag capacity; any refusal changes nothing. Material prices sit above peak trade value (`resale_cover_multiplier`) and resale goes through the ordinary demand curve, so a buy-and-resell loop is a guaranteed loss.

### Haggling (candidate · not implemented)

- Haggling is a design candidate, not an active system: potential delivery/sale XP, a base-sale multiplier, capacity/recovery and service discounts may be revisited later. Two rules bind any future version: higher premiums affect **new** contracts only and never multiply a stored completion bonus; and sale-driven leveling across split sales must be resolved before activation — either volume-based integration preserving XP/demand/carry/gold across identical-time subdivision, or no sale-driven price changes at all. No delivery, Market or Black Market code reads a Haggling configuration today.

### Town delivery contracts & life skills (implemented · owner-locked 2026-10-16)

- **Delivery contracts are a third town-side reward stream, minted the same way as tasks — never from nothing.** Each town offers a "want this good, this count, by this deadline" job; the full reward bundle (gold + a crafting/imprint stone + optionally one skill) is rolled at offer time. Reward size scales with the target's **difficulty** (source zone band · rarity · processed goods · count), **never with travel distance**. Gold is a premium multiple over the plain `quoteSale` value and stones come from `eng.taskPayout` — the same "board never mints a stone out of nothing" rule as the task board.
- **Offers are a per-town global state with no Accept** — each town rolls an active want on a ~30-min trigger chance (not all at once) and the player decides whether to serve it, handing goods in at the town within the window. **The countdown runs continuously, credited offline time included, and pauses only in defined pause states (Camp recovery · a dungeon run).** Delivery may be partial (across trips); **each hand-in pays the town's live `quoteSale` value immediately and the contract *bonus* — premium + stone + skill — pays once when the count is met; incomplete at expiry forfeits only the bonus.**
- **`town.json.income_bound_pct` is unenforced sizing guidance, not a gate** (no code reads it today); conservation is met by the derivation method, not a ceiling, and we invent no gate that prescribes a balance band.
- Reward bundles use a canonical intrinsic acquisition basis (band, rarity, processing, count), independent of the route chosen for the deadline; carried goods reduce missing acquisition without requiring their source again. The chosen production route snapshots its own source band and reachable station travel. Reward bundles and currency amounts freeze at trigger: demand changes, travel and later data tuning never re-price an existing completion bonus.
- Delivery clocks snapshot Camp/dungeon pause at tick start; offer draws finalize after the existing successful tick's draws, including its normal early-return paths. Only visited towns roll online opportunities; offline time advances unpaused deadlines within the credited catch-up cap and never queues missed offers. Read-only inspection does not advance simulation or commit transactions.
- Terminal delivery history is bounded: old acknowledged records leave first, excess unread records merge into a saved recap with actual goods/proceeds and separate paid rewards, forfeited bonuses and conditional skill/fallback promises, and IDs stay monotonic after pruning. Neither recaps nor repeated load/import can pay again.
- **Life skills are a Melvor-style exclusive activity, never a combat mana reserve.** Gathering (incl. Fishing) and fighting cannot run at the same time — `fieldwork.ts`'s exclusivity is the model. Life-skill XP/level/Mastery stay independent of character XP and never touch `mob_HP`; do **not** route a life skill through `s.auras` / `reservedPct` / `RESERVATION_LIMIT`. A life skill **may** grant a small, hard-capped combat stat (folded through `buildCharacter(effects)` like any effect, subordinate to gear/tree) — a deliberate, bounded softening of the decoupling.
- **Salvage is a two-resource chain:** dismantling a gear piece yields **base ore (e.g. iron) + `scrap`**, no direct Value stone. The **existing Alchemy loop** converts `scrap → reroll_value` stone; **Smithing** works ore into metal/components/cargo (never finished gear). The Tier-stone milestone re-anchors from salvage-count to Alchemy-count and stays in the same stone funnel (capped, no net gear→stone→gear loop; Alchemy available from the opening).
- **A dungeon Retreat/Flee rescues 1–2 random stacks from the run's escrow and forfeits the rest** — a seeded, capped rescue, never a full bank or a double payout. Selection counts each gear piece and each legal quantity stack uniformly, without expanding saved quantities; the run detaches before pickup/filter adjudication and the recap distinguishes selected, received and capacity-rejected units. Retreat clears the fight and starts the existing online-only cooldown even with empty escrow; Push remains full forfeit with no new cooldown.
- Tracking a delivery want is informational; it does not accept a contract or change `GoalState`, which remains only the final-boss win condition.
- A contract reward may grant a skill through the ownership path (`skills.owned[id] ||= 0`) — earned by delivery, distinct from the `invariants.banned_power_nouns` "gold never buys power" stall rule.

## Saves & offline

- Round-trip save → load → save produces no semantic drift; a reload mid-fight grants no double credit.
- Offline `catchUp` equals the same span ticked online except the documented AFK exceptions.
- Migration loads older saves, reinterprets only where allowed, loses nothing; unknown versions are rejected, never silently corrupted.
- Orphan toggles/buffs/auras are cleaned without touching legitimate skills and without a schema change.

## RNG stream

Every gameplay draw comes from the seeded stream (`newGame(seed)` persists seed and `rngState`; the tick draws through it).

- Draw order inside a tick is frozen; adding, removing or reordering one draw moves every later draw.
- A Guild task offer rolls its zone, then its kind; an Expedition consumes one additional draw to choose a Species/subzone pair. Non-Expedition offers keep their prior draw count.
- A save restores the stream: reload resumes the sequence, offline `catchUp` reproduces the span.
- Cosmetic rolls may change; loot, stones, junk and status application are pinned.
