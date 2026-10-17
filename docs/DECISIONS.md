# Final Stat Calculation

## Inputs and order

1. Read level `L` and allocated points per Core stat (`str` · `agi` · `vit` · `dex` · `int` · `wis` · `lck`).
2. Sum equipped, unbroken gear + passive-tree lines as flat / percent pools (weapon-specific tree lines apply only while held). Active effects modify only their named derived stats, never Core.
3. `Core[k] = (statOf(allocatedPoints[k]) + flat[k]) × (1 + percent[k] / 100)`, then derive each stat, apply effects and weight tax, cap last.

```text
pointsAt(L) = points_per_level × (min(L, paragon_from - 1) - 1)
           + paragon_points_per_level × max(0, min(L, level_cap) - (paragon_from - 1))
statOf(points) = stat.base + points × stat.point_value
```

The reference line splits evenly (`pointsAt(L) / 7`); players use actual allocation.

## Derived stats

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

## Mob Core

- Race > Species > Variant. A Race is one broad fantasy category in `mob.races`; a Species (Goblin, Orc, Golem) belongs to one Race and owns gameplay data. Race membership alone grants no mechanic.
- The Race registry is closed for now: Humanoid, Beast, Undead, Demon, Dragon, Insect, Plant, Fish, Formless, Elemental, Celestial. An Empty Race is allowed but none is empty today — Celestial opened with Archon, Fish with Siren. Goblin and Orc are Humanoid Species; Golem belongs to Elemental, Wraith to Undead. A Species is fielded where its `zones` say it lives, and every zone it lists must show it on at least one subzone side (`mob.zones[].subzones[].species`); the wider `habitat` is what it may move into later without a roster rewrite.
- There is no target count for Races, Species per Race, Variants per Species, field forms, uniques or Species junk alternatives. Existing content counts are not quotas.
- Sizes are per Species; normal Variants need Small or Medium; Large is the solo Elite body.
- Subzones are independent pools; their union covers the zone cast.
- Ladder length is a content choice, never a gate: a Species may author any number of Variants. The shipped ladders run five deep (`[1-20] [21-40] [41-60] [61-80] [81-100]`, two zones per rung). Each Variant authors its own integer Core, inclusive selection band and drop identity; bands cannot overlap. A zone midpoint selects its covering Variant, or carries forward the closest earlier one when the ladder has a gap; before the first band it uses that first Variant. The Species' `zone_levels[zoneId]` supplies the actual fixed spawn level in every zone and must sit inside that zone's displayed range. Neither the Variant band midpoint nor the attacker's level replaces this authored level. A ladder change deletes the junk item of every Variant it removes; the schema is not public yet, so no migration carries an old stack forward — until release, local saves are simply rewritten by playing, and a save-format change is on the release checklist.
- Variant names are authored freely: a name should read as a creature, which no check can prove. The ladder is not name-pattern gated, so a form that already names its Species (Wyrmling, Wolfman, Ash Imp) carries no extra suffix.
- A Species may author any subset of common/uncommon/rare junk alternatives. Variant rarity and lean remain Variant-owned; names connect the Species' material/culture with the Variant's role.
- Field forms are optional labels and may be sparse. A missing label reuses the latest earlier form; when none exists, the Species name is used. Variant Core remains the live combat Core.
- Levels 101–180 reuse the latest Variant and field label, with no equipment or passive tree.
- Elite = rank over the selected Variant (same name/junk, Large body, Elite mults). Clock Boss = fixed zone profile. Species may have zero or more wild Uniques: zone-top level, Elite stones, ×30 XP, crown junk.
- `humanoid` is no longer a gameplay/drop switch. Potion eligibility is the explicit per-Species `potion_source`; Race membership does not grant it.
- `map.json` is presentation-only.
- **One terrain type owns exactly one authored colour.** `terrain_colors.<terrain>` is that colour and the only colour anyone types. The endless country outside the field is *derived* from it — `field.deep_close` closes the terrain's saturation and lightness onto the paper while holding its hue — so the field's border and the ground past it can never drift apart, and `ground_colors` is deleted. There is no distance fade and no weather: `fade_near`, `ground_fade`, `cloud_tone`, `cloud_opacity` and the whole cloud/fog/mist layer are deleted, so nothing is laid over the country outside the field — the only depth cue left is `deep_close` itself. `bare_tone` and `stroke` are the frame between hexes, not a terrain. Every one of these values is visual: gate M7 proves no file under `engine/` or `game/src/` reads `map.json`, so no terrain colour changes a number in play.

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

Zone Element summaries describe spawn data; zones impose no Element themes and filter no Species. Keep rosters broad. One-handed axe size multipliers stay neutral at 1.0.

## Travel and local exploration

- A Species' authored `zone_levels[zoneId]` is its fixed normal/Elite level in that zone and must fit the displayed band. The zone midpoint selects the Variant name/Core/drop identity only. Neither player level nor Variant-band midpoint scales or replaces a live spawn level.
- Forward walks to the next already-open settlement when the current zone band is behind. Its first visit still requires a player-chosen walk; manual Waypoints remain an instant gold-for-time option. A Push returns to the last held zone and keeps its level gate.
- Patrol is an optional circuit of 2–3 named subzones inside one visited zone. It clears three groups at a stop, then walks to the next stop; the route may repeat or run once, and the player can stop it. Walking and route advancement happen online; offline combat stays at the current stop.
- An Expedition task names one Species and one subzone, and counts only that Species' Elites defeated while hunting from that exact subzone. It has no deadline. Its Tier-stone reward uses the existing Elite task payout; Expedition offers take a quarter of the old 75% Elite share, so the combined Elite/Expedition Tier offer share remains unchanged.
- Auto-Return is optional and off in existing saves. During Patrol, at 90% of the adventure bag it waits until the current group clears, walks to the owning settlement, stashes every unlocked gear piece, and resumes the saved route if it freed space. Locked gear stays carried. If no gear can be moved, Patrol stops safely at town; nothing is auto-sold or discarded.
- A rolled trail food event uses the current zone's `fieldwork.regional_sources.food`, so the road's provisions identify the region. Its roll remains independent from the ambush roll and adds no currency or crafting-stone faucet.

## Combat order

One hit runs perfect dodge → Evasion → block → Armour → resistance → damage taken → ES → HP.

- `sizeMultOf` is one multiplier on the physical share, applied after mitigation; skill presses carry it, magic-damage presses are exempt.
- Crit runs one pool; chance is capped; only overflow past the cap buys crit damage.
- `capAspd` binds last — after the Agi term, the aspd band, buffs and the weight tax; the cap is a minimum interval.
- `mobArmourCut` / `mobResCut` / `armourPenCut` clamp to `[0,1]`; over-penetration is wasted; the res cut reads the correct Element.
- Evasion runs opening/earned split, opposed roll, then the cap.
- `elem_res` ceiling is 75; the tree raises toward 90, clamped absolute however stacked. The published `hitVs` anchor and the build's own value must be named apart.
- Damage and burn spend ES first; poison and bleed reach HP directly; shield overflow lands on HP once; ES absorb is not a second shield.

## Drops & economy

Every faucet and sink lives in `tools/data/`, measured in expectations. Every payout calls the engine function, never a copied formula or literal price. `loot.ttk_per_mob_sec` is the reference time-to-kill the roster computes (`eng.REFERENCE.ttk`), so the cage re-publishes it with `--sync` — it is never hand-typed, and a Species added or retired moves it. `mob_PS(L)` is the zone's **average** mob by construction: each Species' power reads over that same zone mean (`eng.speciesPsMult`), so the mean is 1 for every zone whatever the roster holds and no zone edge, timeline or survival number moves when a Species is added, retired or re-tuned. That identity is a consequence of the model, so no gate re-checks it.

- `leanReweight` redistributes mass across gear/herb/junk; total expected drops/kill is unchanged.
- Junk rarity buys frequency at the reference value: chance × base sale value is flat. Realised gold depends on the destination market and its supplied demand.
- No band lets a player loop a sink back into a faucet.

### Regional goods and town demand

- The Counterhand buys earned junk, field materials, provisions and farm herbs. Gold still buys the existing town services only; markets do not sell goods back into a profit or power loop. The Black Market below is the one owner-confirmed exception.

### Black Market (owner-confirmed 2026-10-16)

- Owner request: the Black Market sells **rare materials, craft stones, other whitelisted rare goods and named skills at a target Skill XP Level, for Gold** — an explicit exception to the "gold buys town services only" rule above. No new currency. Every other stall keeps the old rule; the requested catalogue is never filtered back to services.
- Skill XP Level is distinct from the Duplicate Ladder and from life-skill Mastery. A purchase grants ownership when missing and sets XP to the greater of existing and the offered level's XP — never a downgrade, never a ladder duplicate, never an automatic toggle. An owned skill that cannot gain a level refuses the sale and charges nothing. Max-level offers mean `skill_xp.level_cap`, carry an explicit data weight and are generated like any other band.
- Stock is per visited town, frozen in the save and refreshed by seeded RNG on the online settlement tick only — its draws run after the same tick's world and delivery draws, in stable town order; offline time pauses the refresh and queues nothing. Opening the panel, walking away, reload, import or a real-clock change never rerolls stock. There is no paid reroll and no mystery purchase.
- Purchases preview then commit once through the account writer, validating settlement presence, affordability, frozen stock and combined bag capacity; any refusal changes nothing. Material prices sit above peak trade value (`resale_cover_multiplier`), and resale goes through the ordinary demand curve, so a buy-and-resell loop is a guaranteed loss.

### Haggling (candidate · not implemented)

- Haggling remains a design candidate, not an active system: potential delivery/sale XP, a base-sale multiplier, capacity/recovery and service discounts may be revisited later. Two rules bind any future version: higher premiums affect **new** contracts only and never multiply a stored completion bonus; and sale-driven leveling across split sales must be resolved before activation — either volume-based integration preserving XP/demand/carry/gold across identical-time subdivision, or no sale-driven price changes at all. No delivery, Market or Black Market code reads a Haggling configuration today.
- `town.json.trade` owns base values, each town's import needs and abundant exports, demand capacity, recovery and processing value. Junk keeps its rarity base value; explicit commercial groups in `trade.junk_groups` classify Species drops independently of Race. Race membership grants no automatic mechanic.
- Each town shares one saved supply pool per goods category, measured in base gold rather than item count. Deliveries consume demand; it recovers over credited simulation time online or offline. Reading a quote, opening a screen, walking, reloading or changing the real-world date does not reset supply. Quotes integrate the declining premium across a sale so splitting the same quantity cannot improve its payment.
- Sale payments use the currency's configured decimal precision; earned fractions carry in the save into the next sale, preserving value across split transactions and reloads.
- The Market compares current quotes for a chosen quantity, walking blocks, available Waypoint costs and net proceeds after the warp. A route opens the existing map selection. Visiting a buyer and carrying the goods are required to sell. The quick Sell action handles junk only; provisions, herbs and materials require an explicit sale.
- `engine.json.fieldwork.regional_sources` owns each zone's Mine mineral, Grove wood and forage bonus. Existing ore, timber and rarewood keys and stock are preserved. Regional resources supplement those common materials and feed distinct cooking or workshop recipes as well as trade.
- Workshops consume carried materials at a settlement and produce finished cargo. Cooking recipes define their edible cooked provision directly, including Hunger and the one active meal buff. Goods are not interchangeable currencies: selling ingredients gives up their Camp, food, brewing or processing uses.
- Market records and catalogue defaults backfill automatically in current-schema saves without changing existing item counts, gold, skill XP or market records. Imports and exports keep their existing schema compatibility.

### Town delivery contracts & life skills (implemented · owner-locked 2026-10-16)

- **Delivery contracts are a third town-side reward stream, minted the same way as tasks — never from nothing.** Each town offers a "want this good, this count, by this deadline" job; the full reward bundle (gold + a crafting/imprint stone + optionally one skill) is rolled at offer time and shown up front so the player judges value before committing. Reward size scales with the target's **difficulty** (source zone band · rarity · processed goods · count), **never with travel distance**. Gold is a premium multiple over the plain `quoteSale` value and stones come from `eng.taskPayout` — the same "board never mints a stone out of nothing" rule as the task board.
- **Offers are a per-town global state with no Accept** — each town rolls an active want on a ~30-min trigger chance (not all at once); the player plans whether to serve it and hands goods in at the town within the window. **The countdown runs continuously, including credited offline time, and pauses only in defined pause states (Camp recovery · a dungeon run).** Delivery may be partial (across trips); **each hand-in pays the town's live `quoteSale` value immediately (nothing is silently lost) and the contract *bonus* — premium + stone + skill — pays once when the count is met; incomplete at expiry forfeits only the bonus.** A **recap card** reports, every delivery and on expiry, qty · market gold paid · bonus earned/forfeited.
- **`town.json.income_bound_pct` is unenforced sizing guidance, not a gate** (no code reads it today); per `AGENTS.md` we do not invent a hard gate that prescribes a balance band. Conservation is met by the derivation method, not a ceiling.
- Delivery rewards use a canonical intrinsic acquisition basis (band, rarity, processing and count), independent of the route chosen for the deadline. Carried goods reduce missing acquisition without requiring their source again. The chosen production route snapshots its own source band and reachable station travel separately. Reward bundles and currency amounts freeze at trigger; demand changes, travel and later data tuning never re-price an existing completion bonus.
- Delivery clocks snapshot Camp/dungeon pause at tick start; offer draws finalize after the existing successful tick's draws, including its normal early-return paths. Only visited towns roll online opportunities; offline time advances unpaused deadlines within the credited catch-up cap and never queues missed offers. Read-only tabs do not advance simulation or commit transactions.
- Terminal delivery history is bounded. Old acknowledged records leave first; excess unread records merge into a saved recap with actual goods/proceeds and separate paid rewards, forfeited bonuses and conditional skill/fallback promises. IDs remain monotonic after pruning. Neither recaps nor repeated load/import can pay again.
- **Life skills are a Melvor-style exclusive activity, never a combat mana reserve.** Gathering (incl. the new Fishing) and fighting cannot run at the same time; the existing `fieldwork.ts` exclusivity is the model. Life-skill XP/level/Mastery stay independent of character XP and never touch `mob_HP`. Do **not** route any life skill through `s.auras` / `reservedPct` / `RESERVATION_LIMIT`. **A life skill may grant a small, hard-capped combat stat** (folded through `buildCharacter(effects)` like any effect, subordinate to gear/tree) — a deliberate, bounded softening of the decoupling.
- **Salvage is reworked into a two-resource chain (REPLACE):** dismantling a gear piece yields **base ore (e.g. iron) + `scrap`**, no direct Value stone. The **existing Alchemy loop** converts `scrap → crafting stone (`reroll_value`)`; **Smithing** works the ore into metal/components/cargo (never finished gear). The Tier-stone milestone re-anchors from salvage-count to Alchemy-count and stays in the same stone funnel (re-express F15; capped, no net gear→stone→gear loop; Alchemy available from the opening).
- **A dungeon Retreat/Flee rescues 1–2 random stacks from the run's escrow and forfeits the rest** — a seeded, capped rescue, never a full bank or a double payout.
  Rescue selection counts each gear piece and each legal quantity stack uniformly, without expanding saved quantities. The run detaches before pickup/filter adjudication; the recap distinguishes selected, received and capacity-rejected units. Retreat clears the fight and starts the existing online-only cooldown even with empty escrow; Push remains full forfeit without a new cooldown.
- **A triggered want shows a popup with an optional Track; tracking is informational only (still no Accept).** Tracked wants surface in an Objectives list (a new light surface — `GoalState` is only the final-boss win condition).
- A contract reward may grant a skill through the ownership path (`skills.owned[id] ||= 0`) — that is earned by delivery, distinct from the `invariants.banned_power_nouns` "gold never buys power" stall rule.

## Player Vital Card and bottom-right commands (owner-confirmed 2026-10-17)

- The combat scene is mounted by state, not by CSS: the mob plates, the Player Vital Card, the mob debuff rails and the field floaters appear **only** on the Field tab (no screen open) or while a fight is live. A fight is `phase = fighting` with a group on the field — an idle hunt, a spawn countdown or a walk is not one, so those show the scene only because the Field tab is up. Opening the Map, a panel or a sheet takes the scene out; this replaces the earlier "the card stays visible while the Map opens" ruling. The one overlap is a fight that starts while the Map is open: the scene mounts, but the map keeps the readable surface — mob plates and hit effects stay hidden and only the Player Vital Card shows. The card keeps its original position inside the combat scene and moves with the shared `field` HUD region; on the Map its surface is click-through so the cells beneath it remain selectable, while its Allocate button remains available.
- Combat cards use the mob plate's 5:7 portrait ratio and shared `--card-w` width. Both card faces pad with `--spacing-md`, one value at every card size. The player card contains identity/name-level plus HP/ES/Mana/EXP; a mob card contains its identity/name-level and HP. Hunger and Status Alignment stay outside the player card. Active buff badges sit outside on the right and debuff badges outside on the left. Floating combat text stays unframed; circular borders are reserved for circular status/icon badges. HUD progress tracks, including EXP, use `--radius-xs` rather than capsule ends.
- The HP orb's glass carries the shield as well as the fill. The ES sheet's height *and* weight follow the pool (`--shield-strength`), and it is a film even at full: ES is the light over the pool, so the pool's own colour stays readable under it and a draining shield brings red up through the glass long before the waterline drops. A blow's ripple is split — its ring wears the shield's own light while the shield stands **and** the blow was not a damage-over-time tick, since poison and bleed reach HP directly, while its core keeps the attacker's Element, which the sim sets whether or not the shield ate the hit. ES is a pool rather than a body, so no event is raised for it going down: the client watches the pool itself and plays one inward-falling shatter on the transition to nothing, never on a loop. No low-pool threshold is set — the sheet's own weight is the warning.
- One card, one look: the player's card and a mob plate wear the same `card-combat` face, `card-portrait` ring, `card-name` ink, `track-meter` rails and `badge-status` marks. A card reads apart by what stands in it — the extra ES/Mana/EXP rails, the Element marks, the body's kind (`front`, `elite`, `boss`) — and never by its paint, so a mob plate is the player's card without the player's extras. A meter prints its figure alone and centred: the rail's colour names the resource, so no HP/ES/Mana word is written on it. The fill's travel stays with the surface rather than the skin — a plate's bar rides the sim's own step while the HUD's meters arrive already eased.
- The three automation controls (Auto Skills, Auto Equip, Field Camp) ride the top `menu` rail alongside the main screen navigation and the More menu. Skill Settings has no separate rail button: it opened the same `skills` panel as the Skills tab with the same key, so the duplicate entry was removed. The four Game controls (Speed ×1/×2/×4, Pause/Resume) keep the `commands` HUD region in the bottom-right block, rows 14–15 of columns 12–15, as one row of tabs that hugs the region's right edge.
- HUD layout v6 backfills defaults for prior layouts. Legacy `controls`, `player` and `automation` regions are retired; the `field` placement and every unrelated valid region remain in place. The Target bar occupies rows 1–2, columns 6–9; the Menu rail wraps inside row 1, columns 10–15, keeping the target centered over the combat field and clear of the rail at desktop widths. Field panels occupy rows 7–11, columns 13–15, below the rail. v4 and v5 stock regions migrate area by area only when an area exactly matches its old default; custom placements stay put. The Studio describes the top bar as the menu rail and the bottom-right block as Game controls.
- The top-left `objectives` column (rows 1–5 of columns 1–2) keeps only what is live: the minimap, the zone tag, the phase line, tracked wants that hold a clock and the bag-full alarm. Reference material belongs to the boxes that already hold it: the run's target is the Chronicle's last tab (**Objectives**), because the chronicle is the box that already holds what the run has done and the target has no events of its own to filter, and the **life-skill rungs** are the Sheet's own second tab (**Life skills**), beside the numbers they describe. The Sheet is therefore tabbed — `Stats` keeps the doll and the final values, `Life skills` holds the rung table and the one note that says what a rung pays. A long reference read pushes nothing: it scrolls inside its own box instead of growing a HUD column down into the box below it, which a bare `<details>` list used to do. The two live reads (phase, bag alarm) step up to `--font-sm`; the wants and the sheet's rung table stay at the dense `--font-xs`, and the note is a `<p>` rather than a `<small>`, because 0.8em of the dense read falls under the 12px floor. Rung rows are a three-column table — skill, level, next rung — so ten rungs read down a column each instead of running together as inline text.
- A row whose count is a design decision is a fixed-column grid, never `flex-wrap` and never `auto-fill`: the skill bar is 7 columns, the bag is 10 (100 adventure slots, 50 carried, a 30-item page all land on whole rows; the workshop's narrow pane is 6), the mob plate row is one centred nowrap row (largest authored group is five), and the Game controls dock is one row of 4. Floating combat text never sits on a card's own words: a mob's damage figures rise from the body below its identity and its defence word clears the top edge, while the player's taken figures and defence words rise from above the card, because the player card has no empty body to hold them. `flex-wrap` stays legal only where the content genuinely flows — tab strips, chips, meta lines.
- Icon and font ladders are monotonic by token: `--icon-xs` runs on `0.72vw`, below `--icon-sm`'s `1vw` at every width. A component that needs a size between tokens uses a bounded `clamp(<token>, …, <token>)`, never an open-ended `max()`/`min()` ramp.
- A control strip of buttons separates with `--spacing-sm`; `--spacing-xs` is reserved for dense read rows — chips, meta lines, status badges and grid cells. The two are not interchangeable: a control strip at `xs` reads as jammed buttons, a read row at `sm` reads as a list.
- **Every `<button>` takes its padding from the base `button` rule in `styles/base.css` and nowhere else.** No component overrides it, and `button.mini` carries no padding of its own. Icon-only controls keep their size from `--icon-*` / `--slot-skill-size` with the global `box-sizing: border-box`, so base padding shapes the inner box and never the outer one. A button that needs a different footprint changes its width or height token, not its padding.
- CSS is authored in three layers under the contract in `docs/skins.md`: `styles/base.css` owns tag geometry, `styles/skins.css` owns appearance as named skins, and a component's `<style>` owns layout only. A look is a skin (`btn-ghost`, `panel-bracket`, `card-combat`, `chip-rarity`) referenced by class, never repainted from context (`.desk-tabs button { … }` is the pattern being removed). State is one bare word on the skin (`.btn-ghost.toggled`) and paints without moving anything. Adding a skin or a design figure needs the owner's yes.
- Spacing between siblings belongs to `gap` on their parent layout; child margins never create or push apart layout spacing. Zero margins remain only to reset browser defaults.

- The Field Camp is read as a place, not as a form: three stations stand in one row on the camp's ground and each station is both the read and the press — a tent that is up or packed, a fire burning as well as its Hunger lets it, a pot with a meal in it. A station's controls hang under it, so a column is one part of the camp (where it stands, what it eats, what it cooks) rather than a slice of a table. Cooked dishes belong to the pot alone, because a dish is the only provision that carries a meal buff; the fire hands out what feeds Hunger and nothing else. The stores strip stays a plain read. Two skins carry the look: `btn-prop` (an object that *is* the control — it wears the station's state and an ember sized by the `--fed` the component sets) and `plate-ground` (the recessed ground, its horizon drawn at prop height). The props use the shelf's existing art (`tent`, `rest-campfire`, `cooking-cauldron`); no new asset.
- A walk has no line or floater for each crossed block. The map lights one cell per block and moves the standing hex; the HUD names the destination. Arrival, ambushes, and an independently rolled regional trail event are the travel beats. Patrol and Forward keep walking legible through that same route display.

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
