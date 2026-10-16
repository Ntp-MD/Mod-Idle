# Major patch plan — Delivery Contracts · Dungeon Retreat · Life Skills · Black Market · Player Vital Card

Status: plan only, revised 2026-10-16. Edit/implement from the current working tree. Existing owner decisions are in `docs/DECISIONS.md`; the implementation defaults below are proposals, not new owner-lock claims. Tasks #4–#17 are historical references, not proof of completion. F remains a candidate.

## Scope and sequence

Preserve: per-town wants with no Accept, live market payment for partial deliveries, a full-only bonus shown upfront, deadline pauses during Camp recovery/dungeon, gathering/combat exclusivity, limited Retreat rescue, and salvage → resources → Alchemy. Track is informational. Contracts grant no Standing; distance affects deadline feasibility, never reward value.

Additional requested scope: Black Market and one Player Vital Card containing the You identity/icon, existing HP/ES/Mana readouts, Hunger bar and the current Game controls. This revision adds planning work only; game code is unchanged.

| Phase | Deliverable | Exit evidence |
| --- | --- | --- |
| A0 → A1 → A3 → A2 | Shared delivery math/config, state/migration, then sim | A acceptance below; saved rewards and old saves survive round-trip |
| A4 → A6 → A5 | Tests/cage, Market + interim Objectives, docs/wiki | Correctness checks, real UI interactions, regenerated wiki |
| D | Retreat, payout and cooldown | Subset/identity checks, re-entry refusal, clear/Push regression |
| B1a | Salvage/resources/Alchemy and milestone migration | Every dissolve route, exact legacy credit, coherent income derivation |
| B1 → B2 → B3 | Tracks/bonuses, milestones, activity UI | Progression, aggregate budget, offline XOR and save checks |
| C0 → C1 | Black Market catalogue/config, then data/sim/UI | Rare materials/stones/goods and high/max-level skills; safe transactions, frozen stock and save checks |
| H1 → H2, coordinated | Player Vital Card and HUD migration | You/icon/vitals/Hunger/controls in one stable card; keyboard and layout checks |
| A7, coordinated | Objectives HUD region | Shared HudLayout/default backfill and live region movement |
| F, candidate | Haggling design | Resolve split-sale leveling before activation |

Implement gameplay rows A → D → B in order. H can ship independently after coordinating shared HUD files with A7; register all affected regions/migrations together. C0 defines the requested shop; C1 follows its specification. Ship A before B1a changes income formulas. Each shipped phase includes its wiki; coordinate overlaps instead of postponing generated output. B3 improves visibility; earlier phases already persist and simulate the chosen activity correctly.

Numbers belong in `tools/data/*.json`, formulas in `engine/`, mutations in `game/src/sim/`, migrations in `game/src/state/save.ts`. Use shared readers, lowercase hyphenated new content IDs and glossary terms. Never import `map.json` into engine/client sim. Add no dependencies. Recheck actual file ownership/schema/scripts; old in-flight lists and version-14 assumptions are not authority.

## Current baseline and proposed defaults

Verified against the current sources; baseline values are context, not new literals for code.

| Area | Current baseline | Proposed patch default |
| --- | --- | --- |
| Inventory | Adventure gear and character stacks are separate; 100/50 slots; material/food cap 100, stone cap 999 | Preserve caps and weight/encumbrance behavior; look up capKind per good |
| Progression | Field/Farming level cap 20, sqrt XP/divisor 100; field Mastery cap 99/divisor 25 | Raise level caps to 100; preserve XP/divisors/unlocks; Mastery stays 99 |
| Salvage | One Value stone per dissolved gear; Tier milestone every 500 successful counter increments | One `iron-ore` + one `scrap`; one scrap → one Value; Tier per 500 eligible Alchemy outputs |
| Gathering | Mine/Grove use 10-second actions, 15 XP, 1 Mastery XP | Fishing reuses that initial cadence/XP; no new RNG fish roster |
| Workshop | Metal recipes currently grant Mining XP; planks grant Woodcutting XP | Preserve existing recipe ownership/unlocks; new Smithing recipes use their own track |

New tuning is provisional data, not a balance gate. Changing a proposal later updates all readers/docs and never recalculates a stored reward or reinterprets earned XP silently.

## A — Delivery Contracts

### A0/A1 · catalogue, sizing and rewards

Add typed `DeliveryCfg` and shared `engine/delivery.ts`. `town.json.delivery` owns online trigger interval/chance (initial interval 1800 seconds), active slots, target/skill weights, difficulty/count/deadline sizing, reward income slices, pause states and history limits. `income_bound_pct`/T19 remain unenforced guidance. Keep task-style tuning provisional; validate ranges/references, not prescribed income or content counts.

Resolve namespaced goods through `trade.byId`. Gather acquisition paths from baseline/regional sources, variant/species/unique drops, herbs/provisions and workshop/cooking recipes. Recursively require obtainable inputs, skill unlocks and usable stations/zones. Detect missing references/cycles. Use existing road/unlock facts from sim; no map parsing. Skip unresolved/inaccessible targets, consume the opportunity if the pool is empty, and choose multi-source routes deterministically. Snapshot the chosen route/difficulty.

Count is a positive integer capped by the target's existing stack rule: material/food/herb use their own capKind; junk uses the existing stone cap. A feasible deadline includes estimated production/processing, reachable travel and a data-defined allowance; an expected rare-drop time is not a guaranteed arrival time. Owned inputs reduce acquisition time. Reward difficulty uses band/rarity/processing/count only.

Freeze completion gold at trigger:

`bonusGold = floorToCurrencyUnit(rawEngineQuote.gold × (premiumMult − 1))`

Quote the full count at the issuing town's current supply/`clockSec`, with no supply mutation, currency carry or Haggling. Use configured currency precision/shared rounding, never literal ×100. Store the quote basis, exact bonus, `taskPayout`-derived stone bundle and conditional skill fallback. Show exact amounts upfront. Later demand/data/income changes affect new offers only.

### A3 · state, identity and saves

Town state adds `deliveryClockSec`, `contractTriggerRemainingSec` per town, monotonic `contractSerial`, `contracts` per town, `trackedContractIds` and recap summaries. Each contract stores:

- Stable ID, town, namespaced good, target/delivered count, acquisition/difficulty snapshot and derivation version.
- Frozen bonus gold/quote basis, stone key/count, optional skill ID and fallback stone key/count.
- `triggeredAtClockSec`, `dueAtDeliverySec`, `status: open | completed | expired`, terminal time/outcome.
- Cumulative base gold paid, last-delivery qty/gold, actual bonus paid and recap acknowledgement.

Only open contracts occupy slots. Deliver/Track use ID, not good/index; duplicate wants stay independent. Terminal status guards payment; do not add a contradictory mutable `paid` flag. Allocate serials only on valid offer commits, never reuse after pruning, and remove terminal IDs from active tracking.

Bound terminal history using configured retention. Show every new terminal recap; evict oldest acknowledged records first. Fold excess unread entries into a saved per-town summary: counts, qty/base gold by good, actual bonus paid and promised bonus forfeited, plus unread count. Keep conditional skill/fallback promises distinct from paid rewards. Show the summary as unread until acknowledged; retain no unbounded ID/event lists and never reconstruct proceeds from today's quote.

Defaults start delivery time at zero and newly visited town triggers at a full interval. Migration backfills missing fields without replacing valid values, RNG or payment. Validate IDs/references, safe counts, finite times, unique serials and legal transitions using existing save normalization. Removed content needs explicit migration; never reroll a saved reward to hide an unknown ID. Only the account-writer tab advances/commits. Cover load, repeat migration and export/import for every status.

### A2 · clocks, RNG and tick order

1. Snapshot pause state at tick start. Advance `deliveryClockSec` once per credited second unless starting in Camp recovery/active dungeon. Expire at `deliveryClockSec >= dueAtDeliverySec`.
2. Count credited offline seconds only within existing catch-up limits. No wall-clock expiry charge beyond the credited window. UI derives time-left/pause reason from saved sim state.
3. Decrement visited-town trigger remaining time only online. Camp/dungeon pause deadlines, not online opportunities. Reset each elapsed interval even when slots are full or targets unavailable; no queued backlog.
4. Use stable configured town order. Full slots spend no trigger RNG. Chance/target/skill draws have a documented order; failed eligibility creates no reward/ID.
5. Append offer-generation draws after existing per-tick consumers. Ensure clock advancement and trigger finalization each run once despite early returns; snapshot flags before other systems change them. Avoid `finally` that generates offers after a failed tick.
6. Completion releases a slot but does not force an immediate offer. Delivery reads the deadline clock again; expiry mutation belongs to tick reconciliation, preserving refusal atomicity.

Sync/async catch-up must agree. Online/offline contract/RNG identity is intentionally different because only online triggers offers; verify the defined differences, not a false global parity claim. Review new draw sites before changing golden expectations.

### A2 · delivery transaction and skill entitlement

`deliver(state, contractId, count)` previews, then commits synchronously:

1. Require writer ownership, an open/unexpired contract, `atSettlement(state, contract.town)`, positive safe-integer count ≤ remaining and enough carried goods. Walking/recovery/wrong town refuse. Stashed goods are not silently consumed; show the carried quantity even when the town bag view defaults to Stash.
2. Preview the existing live market sale, goods consumption, supply/credit changes and delivered count without mutation.
3. On completion resolve the stored skill/fallback and check the entire stone bundle against projected character inventory after goods leave. No partial reward and no sale-then-rollback.
4. Any refusal preserves inventory, gold, supply, credit, progress, status and RNG. A bag-full final delivery remains retryable until expiry.
5. Commit live sale once, then frozen completion bonus once, mark completed and emit recap. Terminal/repeated/stale requests cannot pay again. Expiry keeps previous sale proceeds and forfeits only the unearned bonus.

Reuse sale preview/commit precision logic: each partial sale settles `marketCredit` once, and whole-unit bonus gold never multiplies it. Identically timed bulk/split deliveries retain equal base proceeds + carry and the same completion bonus.

At trigger, use data-owned band/skill-ID weights with positive default weight, without class restrictions. Unowned skills qualify; owned skills qualify only below `LADDER_MAX_DUPLICATES` and with a useful cooldown ladder (`cd > 0`). A duplicate can advance toward a rung without immediately changing cooldown. Unowned aura/zero-CD skills remain collectible; owned ones use fallback rather than promise a useless ladder duplicate.

Store a fixed fallback from a configured `taskPayout` slice and display “named skill, or these stones if no useful duplicate remains.” Empty eligible pool shows stone-only reward. Recheck usefulness at completion; grant the named skill **or** fallback, never both or a rerolled skill. Extract a named-skill helper preserving XP/defaults and existing collection/slot behavior; do not change ordinary random skill drops as collateral work.

### A6/A7/A5 · player surfaces and docs

Market shows remote wants, issuing town, progress, exact bonus/fallback, countdown/pause, Deliver, Track and recap/history. A trigger popup offers optional Track. Remote viewing cannot deliver. Interim Objectives lists tracked IDs; A7 adds the region through `HudRegionId`, `HUD_REGION_META`, `DEFAULT_HUD_LAYOUT` and matching `App.svelte` values with save backfill. Keep Studio descriptions current.

Update glossary/DECISIONS player rules and `game/src/wiki/pages.ts`, then regenerate wiki. Verify real HMR components and full-bag/fallback/partial/final/expired interactions at 1920 × 1080. HUD work also verifies Studio Apply/game Apply and live region movement. Use shared CSS tokens; close the temporary browser tab.

## D — Dungeon Retreat

- Engine owns pure rescue selection (`E.dungeon.retreat_keep_min`/`retreat_keep_max`, initially 1–2); sim owns escrow, payout, combat cleanup and cooldown. Validate active run/writer and finite safe escrow quantities before RNG; invalid requests change nothing.
- Normalize in stable bucket/key order: gear is one entry per item; quantity buckets are legal stack-sized entries. Draw the keep-count uniformly from the configured range clamped to available entries, then select uniformly without replacement. Empty escrow rescues zero without selection draws. Use virtual indexing/counts rather than expanding large saved quantities into arrays.
- Preserve gear identity/counts; never reroll. Detach the run before ordinary stack pickup/gear adjudication, as clear does. Selected loot may be capacity-rejected; report selected, received and rejected amounts. Forfeit the rest.
- Clear dungeon group/target/spawn references; preserve unrelated state. Stamp existing cooldown anchor at Retreat's current `clockSec`, including empty-run Retreat. Retain clear's existing offline-paused cooldown settlement in both catch-up paths.
- Push stays full-forfeit under existing behavior. After clear/Push/Retreat there is no run to rescue twice. Use persisted gameplay RNG, never `Math.random` or preview-time draws.
- Revisit selection buckets when B1a adds material escrow. Update glossary/DECISIONS/wiki and verify Retreat, clear, Push and re-entry interactions.

## B1a — Salvage and Alchemy

### Resources, capacity and every dissolve route

Proposed initial data: one gear → one canonical `iron-ore` + one new `scrap`; one scrap → one `reroll_value`. Scrap is a sellable field material with existing material weight/cap rules and a data-owned trade value. Alchemy is an immediate settlement recipe, accessible in the opening town with no unlock/gold cost; no new life-skill/automation or production timer. Batch is repeated individual transactions. Preserve unrelated potion/condensing behavior.

Manual salvage preflights both outputs before removing gear. Removing an Adventure piece frees **no character stack slot**. Recompute carried weight through existing encumbrance, not a new weight-based refusal. Locked/Collector-promised gear stays protected. Auto-filter conversion preflights the same whole bundle; overflow gives neither resource, reports stop_pickup and increments no successful-salvage count.

Audit manual salvage, enabled filter rejection, auto-dissolve level floor, `swapWeakestKept`, and clear/Retreat adjudication. For bag replacement, preflight displaced gear outputs before swapping. If they cannot fit, keep the old piece and leave the new drop unpicked; never swap and silently delete the displaced piece. A normal rejected drop receives the existing unpicked-drop treatment; no new ground-loot persistence.

Inside a dungeon, salvage outputs enter a new materials escrow bucket. Backfill saved runs; clear/Retreat/Push include it. Escrow accepts the full bundle; exit pickup may reject it under normal capacity. Historical salvage increments on successful conversion into bag/escrow, independent of later forfeiture.

### Tier progress and migration

Alchemy preflights scrap plus all Value/Tier outputs together. Only successfully produced Value units from this recipe advance its milestone; deliveries, potion crafts, imported stones and failed attempts do not. Default interval is the existing 500; definition stays data-owned.

Retain `counters.salvaged` as history. Add versioned Alchemy eligible-output count `N`, paid milestone count `P`, and exact one-time legacy credit `r/Told`, where `r = oldSalvaged mod Told`. `Told` comes from the versioned pre-change migration definition, not mutable current data.

`newTierDue = floorDiv(N × Told + r × Tnew, Tnew × Told) − P`

Use BigInt intermediates and safe-range validation; persist ordinary safe integers, not BigInt JSON. Preview future `N` and all Tier due, then atomically consume scrap, pay outputs and advance `N/P`. Never pay old `floor(oldSalvaged/Told)` again. Migration pays nothing, preserves resources and repeats safely. Fresh/missing optional history starts with zero credit. Snapshot a ledger's interval/version; later tuning needs explicit progress migration rather than interpreting the same count under a new denominator.

Preserve task/contract reward bundles and active escrow. Rollback restores matching pre-B1a code/save together; an old writer must not drop the new ledger.

### Income derivation

Re-anchor `rerollValueStonesPerHr`, `stonesForMinutes`, `taskPayout` consumers and the historical F15 invariant through shared salvage/Alchemy data. Existing `BAND.junk_per_hr` means non-upgrade gear (`drops_per_hr − upgrades_per_hr`), not the trade-good junk stream; reuse that expected salvage input and document the filter/carry assumptions. No second rate table or new balance gate for an obsolete check label.

With immediate Alchemy, expected Value production is supply-limited: eligible gear/hour × scrap/gear × Value/scrap. Separate stone production from reroll uses (`stoneIncome / stonesPerUse`): the current cost is 1 but future costs must not alter stone grants. Audit STONE/craft/report readers and keep `stonesForMinutes` in actual stone units. Expected source income is not a promised banked reward under full bags/manual processing. Include the Alchemy Tier share once beside other Tier sources; probe configured craft loops for resource creation, without a tuned income-band gate.

## B1/B2/B3 — Tracks, progression and activity

### Concrete proposed defaults

| Track | Production/access | XP/Mastery and compatibility |
| --- | --- | --- |
| Fishing | `fish` action at a Field Camp in a zone with authored fishing sources. Seed sources from existing regional `river-fish`/`shellfish` entries; do not infer water geometry. Base catch 1 each 10 seconds; preserve other existing fish sources | 15 skill XP + 1 Mastery XP per successful primary catch; Mastery keyed by food ID. Reuse gathering harvest/drop caps; primary full-bag refusal stops action without XP |
| Smithing | Immediate settlement recipes, safe/idle only, no walking/run/gathering/combat. Initial `iron-bar`: 2 iron-ore → 1 bar, level 1/20 XP; `iron-brackets`: 2 bars + 1 timber → 1 brackets, level 3/35 XP | 1 Mastery XP per successful recipe, keyed by recipe ID. Register material/trade/icon fallbacks and input-derived values. Existing metal/plank recipes keep their owners/unlocks; no finished gear |
| Existing field tracks | Preserve stored XP/Mastery, recipe/source IDs and current early unlocks | Extend cap 20 → 100 with the same sqrt/divisor-100 curve; stored excess XP becomes visible progress. Preserve Mastery cap 99/divisor 25 and existing harvest milestones/drop cap |
| Farming | Preserve passive plots, deeds, tiers, automation and readyAt snapshots; not a new exclusive active action | Extend level cap identically. Add tier-keyed Mastery starting at zero; 1 XP per successful harvest. No retrospective mastery from guessed harvest counts |

Reuse the current fieldwork track schema for Fishing/Smithing; Farming remains in `farm`. New tracks backfill at zero, existing values survive. Fieldwork/Hunger/road/return-to-Camp readers must recognize `fish`; no new map site index. Saved mine/grove actions retain their deadlines. A new action schedules its first future interval, with no offline-time backlog borrowed from a different activity.

Life-skill XP/Mastery are independent of character XP; neither crafting nor gathering grants character XP through this patch. Preserve per-kill gear/stone drop probabilities; own-line bonuses do not modify those rolls.

Own-line benefits remain bounded: preserve existing field harvest/drop formulas; Fishing uses them. Farming Mastery reduces **future** growth duration by up to 10%, proportional to tier Mastery/cap; never shorten an existing readyAt or re-harvest a paid crop. Cooking/Smithing Mastery enables batch size `1 + floor(mastery / 20)`; batch repeats single crafts with unchanged costs/yields, stopping at first refusal. No Alchemy yield bonus, free ingredients or automatic offline Smithing/Cooking.

### Combat contribution without mixed units or power regression

Data owns a fixed budget `B` (proposed 3 normalized points), per-track ceiling (≤3), fixed weights (initially 1/7 each for the seven tracks) and level rungs (10 levels through cap 100).

`p_i = clamp(unlockedConfiguredRungs(level_i) / configuredRungCount, 0, 1)`

`b_i = min(trackCap_i, B × weight_i × p_i)`

Weights sum to at most one and do not redistribute when other tracks level; unused allocation stays unused. Thus progressing a skill cannot reduce a previous bonus, and total normalized allocation never exceeds B. This budget measures allocation, not equal DPS value across unlike stats. Future tracks require authored weights; never divide dynamically by the current roster.

Mining→Armour %, Woodcutting→Evasion %, Hunting→Accuracy %, Cooking/Farming→HP regeneration %, Fishing→Mana regeneration %, Smithing→Armour penetration percentage points. Add each to the matching existing modifier channel once; same-stat contributions add before the normal formula/caps. Zero-base percentage effects create no flat stat. Extend missing accuracy/evasion/penetration effect channels in shared composition explicitly; merely passing a new effect name currently changes nothing there. Keep all math in shared engine helpers and composition in `buildCharacter`; never alter mob_HP or mana reservation.

### Milestones and saved activity

B2 extends `goal.ts` readers with separate data-defined life-skill milestones; final-boss `GoalState` stays intact and is not delivery tracking. Initial milestones show informational level-rung progress, with no new reward mint. Any later reward-bearing milestone needs once-only claim state and inventory preflight.

B3 derives safe idle/combat/gathering from existing `hunting`/`fieldwork.action` state, not a competing saved mode flag. Starting an activity clears incompatible state; recovery/walk/dungeon retain their existing transitions. Hunting stays combat with per-kill XP; mine/grove/fish are the alternate timed loops. Passive farm and existing safe manual-craft guards remain; no second offline craft activity. Persist through account-writer ownership. For legacy simultaneous hunting/action flags, preserve hunting and clear the invalid action as current `tickFieldwork` does; new transitions never create that combination.

## C — Black Market

### C0 · rare goods and high-level skills

Owner request: Black Market sells **materials, stones, other rare goods, and high-level skills that may reach max level**. This supplies a new acquisition route; do not replace Market, Counterhand, Pedlar or delivery wants. Eligible rare goods use an explicit whitelist of existing canonical IDs; the phrase other rare goods is not permission to expose every item automatically.

**Owner-confirmed: Gold + Skill XP Level.** Use existing Gold, with no new currency system. Black Market is an explicit exception to the older town rule that gold buys services only; its requested stone/skill catalogue must not be filtered back to services. Record the exception in DECISIONS/wiki when implementing, keep other stalls unchanged, and validate that purchase/processing/resale cannot generate a repeatable net-profit cycle. Other stock/pricing defaults below remain proposals.

**Stock/access defaults:** a dedicated settlement service with per-town, band-weighted offers available only while standing at the issuing town. Use visited-town eligibility and a configured remaining-online-time refresh timer; offline pauses refresh and does not accumulate unseen rolls. At a refresh boundary replace the stock once in stable town order through seeded RNG. Store offer IDs, item/skill details, exact prices, remaining quantity and refresh progress. Opening panels, walking away/back, reload/import and real-clock changes never reroll stock. No paid reroll or mystery purchase is added.

`town.json.black_market` owns access, eligible IDs/weights, quantity ranges, refresh interval, scarcity/band price inputs and skill-level offer bands. Catalogue items stay with their existing domain owners. Prices use shared engine math and configured currency precision, including rarity/acquisition cost and high-level premium; authored tuning remains data. Show the exact good, quantity, skill level and total cost before buying. Max-level skill offers must have an explicit data weight; do not silently exclude them from the generator.

**Confirmed skill level meaning:** XP Level is distinct from Duplicate Ladder and life-skill Mastery. Roll/store a named skill and target XP level up to `E.skill_xp.level_cap`. A max offer means that cap, not character level. Through the shared named-skill helper, grant ownership if missing and set XP to `max(existingXP, skillXpForLevel(offeredLevel))`. Never downgrade existing progress or activate a toggle automatically. Preserve an owned skill's Duplicate Ladder; a newly owned skill starts at zero duplicates. A Black Market purchase grants no ladder duplicates. An already-owned skill with no useful XP-level gain cannot be purchased/charged; show the reason. Skill offers are individual entitlements, not quantity-stacked duplicate upgrades.

### C1 · data, transaction, save and UI contract

- Add typed Black Market data and pure offer/price derivation; the sim owns stock/purchases. Reuse existing catalogue/skill helpers and the ordinary Market sale path for subsequent resale; no copied demand curve or special sell-back faucet.
- Purchases/exchanges preview the entire cost/output/stock transaction, including combined capacity after costs leave. Validate settlement/access, safe quantities, affordability and stock before committing once. Refusal changes nothing; no double charge/grant, negative stock or sell-back profit cycle. The account-writer alone commits.
- Persist frozen stock/offers and online refresh progress. Backfill old saves without charging/granting or rerolling existing stock. Initialize a new town once through its normal online sim path, not from UI reads; sync/async catch-up preserve the remaining refresh time. Document RNG placement alongside A's trigger finalization.
- Add a clear Black Market entry in the agreed town surface, with item/service identity, price, stock/refresh state, affordability, capacity refusals and empty/locked/read-only states. Keep Market delivery/trade behavior intact. Use the icon registry and existing category fallback.
- Extend town/trade/skill tests and cages for transaction identity, conservation, refresh boundaries, no reload reroll, high/max-level generation, fresh/owned skill purchase, no downgrade/useless charge, per-town stock and old-save round-trip. Update glossary/DECISIONS player rules/wiki and verify actual shop interactions at 1920 × 1080, including sold-out, full-bag and account read-only states.

## H — Player Vital Card

### H1 · combine identity, resources and controls

Use the current self card in `game/src/ui/FieldPlates.svelte` as the source. It already displays You, `characterIcon()` and HP/conditional ES/Mana. Extract/recompose it as a stable `PlayerVitalCard.svelte`; `App.svelte` supplies the existing derived character/vital values and action callbacks. Keep one sim/read model; do not duplicate stat/Hunger formulas or create a character-name save field for the label You.

Card content, in scan/tab order:

1. Character icon and visible name **You**, using the existing portrait registry/fallback.
2. HP, ES when a pool exists, and Mana with current/max values from the existing read model; preserve reservation/status information and self-hit/effect feedback.
3. A labelled **Hunger bar** and numeric percentage from `fieldwork.hunger / fieldwork.F.hunger.max`, with clamped finite fill and accessible current/min/max values. At empty Hunger explain the configured HP-regeneration penalty and unchanged ES recharge; do not change Hunger drain or Auto Eat behavior.
4. The **whole existing Game controls group**: Speed options through `SPEEDS`/`setSpeed`, then Pause/Resume through the current running-state handler. Preserve selected/pressed state, shortcut and accessible names. Travel, automation and activity handlers keep their current responsibilities; this request relocates the existing Game controls.

Remove the old standalone Hunger read from the objective tracker and the old controls dock when their card replacements mount. Preserve the minimap/location/objective reads and existing skill/EXP dock; any retained resource orbs read the same values. Give the card an accessible label, visible keyboard focus and stable tab order. Test zero/max resources, no ES, reserved Mana, low/empty Hunger and Pause/Resume state.

Controls must remain outside hit-keyed/remounted animation subtrees. Animate only portrait/resource feedback; no lunging root, flashing overlay or pointer interception over buttons. Remove the original self-card DOM after extraction and pass its new portrait anchor to combat FX rather than retaining a duplicate card/hidden interactive copy. Keep buff/debuff and self-hit feedback correctly anchored. Respect reduced motion and modal focus/stacking. Normal field, settlement and map views retain the card; transitions never reset speed, pause or character state.

### H2 · shared HUD region and layout compatibility

Register a `player` region through `HudRegionId`, `HUD_REGION_META`, `DEFAULT_HUD_LAYOUT` and matching `App.svelte` values; Studio moves the entire composite card. Update actionbar/field/objectives descriptions for the new composition. Retire the standalone `controls` placement only together with all readers, validators, Studio import/export and a legacy layout migration.

New defaults reserve a nonoverlapping right-side grid area large enough for the complete card. For an existing layout, map its old controls anchor to player, then expand within free adjacent grid cells without moving other customized groups. If no expansion fits, preserve the old area with internal scrolling and a Studio resize notice; never discard the whole custom layout, hide controls or overlap another region. Backfill missing regions and retain every unaffected placement. A7 Objectives registration must use the same current layout version/migration chain.

Read `game/src/styles/variables.css` before CSS work. Use existing fonts/icon/spacing/radius/color/motion tokens, `--pad-area` for the HUD frame, and bounded component sizing where needed. No CSS-only position coordinates, new shared design token or arbitrary global scaling.

Acceptance: one You identity/card icon, one relocated Hunger read and one mounted Game controls group; working mouse/keyboard shortcuts at every configured speed and Pause/Resume; no lost focus during repeated hits; status/reservation reads preserved; no overflow/overlap in the default layout at 1920 × 1080. Verify legacy cramped/custom layouts, import/export, resize and reload. Studio Apply previews and game Apply saves; both move the live composite card. Use the integrated browser/current showcase, coordinate HUD edits, update HUD documentation/wiki as applicable and close the verification tab.

## F — Haggling candidate

Potential delivery/sale XP, base-sale multiplier, capacity/recovery and service discounts; higher premiums affect **new** contracts only. Never multiply a stored completion bonus.

Before activation, resolve sale-driven levels across subdivisions: freezing one call's multiplier does not prevent leveling between split calls. Use volume-based integration preserving XP/demand/carry/gold across identical-time subdivision, or remove sale-driven price changes. Define demand transitions when capacity/recovery changes and service-price floors. F remains outside the active implementation sequence; no unresolved F choice blocks A/D/B/C/H.

## Acceptance and verification

| Requirement | Required proof before shipping its phase |
| --- | --- |
| Delivery economy/skill | Bulk/split with existing carry; demand/data changes; fresh/useful duplicate, zero-CD ownership, cap during offer, empty pool/fallback; no second payment after reload |
| Clock/RNG | Boundary expiry, Camp/dungeon transitions inside catch-up, credited-time cap, no offline generation/backlog, full slots, stable draws, sync/async agreement, no skipped early-return finalization |
| Delivery transaction | Wrong town, walking/recovery, invalid/oversized qty, insufficient goods, expired/terminal IDs and combined reward overflow refuse unchanged; consumed goods can free reward slots |
| Catalogue/history | Every target type, namespace collision, blocked/cyclic source, empty pool, independent duplicate IDs, slot release, bounded unread/acknowledged history, exact summary totals |
| Retreat | Empty/single/multiple legal stacks, subset/uniform selection, gear identity/filter behavior, no double pay/stale fight, re-entry boundary, saved/offline cooldown |
| Salvage/Alchemy | Every dissolve caller including swap; separate bags, locks/promises, all-output overflow, materials escrow, failed/successful batch, no loop/double Tier/income counting |
| Saves/progression | Old/fresh saves, migration twice/import/export, legacy remainders below/at/above threshold, different interval versions, active runs, held rewards/plot times, XP beyond former cap, missing new tracks/Mastery |
| Life skills | Reachable fish source, correct new recipe owners, batch==single, no ingredient-free output, monotone bounded budget, same-stat addition, zero-base effects, no mob_HP/reservation change |
| Black Market | Requested rare materials/stones/goods and high/max-level skills are representable/generated; Gold cost, XP-level upgrade without ladder duplicates, price/stock/cost/output identity, no downgrade/useless skill charge, full-bag/read-only refusals, refresh/reload/import/offline boundaries, no double grant/profit loop; real shop UI/wiki |
| Player Vital Card | You/icon + HP/ES/Mana + Hunger + Speed/Pause/Resume in one stable card; no duplicate Hunger/controls, focus survives hits, shortcuts work, old/custom HUD layouts migrate and Studio/game Apply move the live card |
| Activity/UI/docs | Reload/takeover and sync/async XOR, passive-farm preservation, actual Market/Track/recap/Retreat/activity interactions at 1920 × 1080; HUD Studio/live verification for A7; generated wiki matches |

Run focused tests first. Engine/data phases use root `pnpm typecheck`; UI phases use `pnpm check`, which already includes typecheck. Run relevant cages via `pnpm verify` and broader `pnpm test` when shared behavior changes. Generate wiki with `pnpm wiki`; run `pnpm build` for shipped client integration. Reuse passing results until a relevant edit invalidates them. Use existing npm/node equivalents only when needed. Test mathematical/state invariants, not prescribed pacing, balance bands or content counts.

Inspect the final diff, scripts, current source and actual evidence against every row; a green unrelated gate proves nothing about a new path. Docs-only revisions check content/diff without gameplay suites. Use only the integrated browser and current components; never launch standalone/headless Playwright. Start/reuse port 5173 under AGENTS rules and close the verification tab.

Each phase is complete only with its checks, migration, player rules/glossary and generated wiki. No unrelated edits or blind golden rebaselines; no commit/push/pull without request. Delete this draft when active work is done or explicitly preserved elsewhere; retain F's candidate status in the handoff.
