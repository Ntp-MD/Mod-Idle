# Camp encounters — implementation plan

Status: DELIVERED. All six packets and C12 browser sign-off are complete. Verification: Camp encounter suite 21/21; full game suite 724 passed; `npm run check` clean; nine data cages pass; `npm run wiki` rebuilt successfully. Browser checks covered all eleven Showcase scenarios at 1920×1080, keyboard investigation/fight, policy and timeout, prowler supply protection, temporary nest pause/release, traveler news/barter, aid Standing credit, full-bag refusal, read-only controls and herd Follow with a moving pawn. The start-of-tick eligibility snapshot, working E2 Secure supplies action and E1 work pause are recorded in the game rules and wiki.

## 1. Goal and approved decisions

Give Field Camp seven visible encounters on the existing Adventure board. Show what approaches, available choices, automatic policy and actual outcomes. Reuse travel, combat, gathering, exploration, Expedition and Standing.

Owner approved all seven ideas and explicitly selected:

- Retreat remains available through existing actions. Leaving forfeits unresolved event opportunities, never reverses legitimate loot or kills already earned.
- Nests interrupt gathering temporarily; no permanent hex blocker or persistent nest registry.
- Passing herds offer clues and a route to ordinary hunting; no guaranteed Species or Elite spawn.

Out of scope: separately accepted trip forecasting, weather, new currencies/items/Species, guaranteed Elite/Unique spawns, new HUD regions, a quest framework, automatic spending/following and changes to ordinary retreat or loot.

## 2. Verified repository map

Paths are workspace-relative. Existing symbols below were inspected. New names in section 4 are proposed implementation contracts.

| Owner / path | Verified context |
|---|---|
| `game/src/sim/fieldwork.ts` | `FieldworkState`, `newFieldwork`, `campHere`, `fieldActionProblem`, `tickFieldwork`; `leaveCamp` and `returnToCamp` clear groups. `phase === 'camp'` is Push recovery, distinct from Field Camp. Cooking commits immediately. |
| `game/src/sim/game.ts` | `tick` calls world, discovery, Delivery, Black Market, then returns; recovery returns early inside world. `spawnMob` is private and normal mobs can upgrade to Unique. Combat uses group independently of hunting; automatic new groups require hunting. `onKill` pays ordinary rewards; `recordHuntKill` separately requires hunting. |
| `game/src/sim/road.ts` | `startWalk`, `warpTo` clear fights; `arrive` enables ordinary hunting on field arrival in the same tick. Preserve these rules. |
| `game/src/sim/exploration.ts` | `drivePatrol`, `recordPatrolGroupClear`, `driveAutoReturn`; Camp setup pauses Patrol. Preserve itinerary and existing resumption rules. |
| `game/src/sim/slots.ts` | `fitsTransaction` previews combined costs/grants using canonical buckets. `addTo` can increment stopped counters on refusal; never use it as a transaction preview. |
| `game/src/sim/farm.ts`, `engine/farm.ts` | `farm.potions[name]` / `farm.condensed[name]`; shared `farm.potionPct(potion, 'hp')` identifies healing bottles. Helping NPCs must not call player-drinking effects. |
| `game/src/sim/map-exploration.ts` | `MapJournal`, discovery and nearby survey. Do not use one-time trail-site claimedSites for recurring Camp events. |
| `game/src/ui/map-adventure.ts` | `adventureView`, `paintMapAdventure`, `campActivityArt`; nearby helper in `map-encounters.ts` uses player feet. |
| `game/src/App.svelte` | `transactionWriter`, Camp handlers, MapJourney/FieldworkBoard, Showcase map-adventure. Guard mutating actions. |
| `game/src/sim/town.ts` | `standingProgress`, `standingTier`, `standingShare`, `canBuy`, `progressTasks`; Standing derives from zoneKills and settlement budget. Expedition needs actual Elite + Species + subzone. |
| Standing readers | `ui/TownHub.svelte` and App display kills/next.kills; `ui/map-adventure.ts`, `ui/map-intel.ts` use tiers; `sim/collector.ts` uses standingTier. Searches for zoneKills/budget/helpers found no additional gameplay formula reader in engine/tools. `tools/trade.ts` validates tier data. Recheck after edits. |
| `game/src/state/save.ts` | Current schema 17; migrate/importJson/exportJson/snapshot restore. Imports currently support 14–17; reject unknown future versions. Existing additive normalization applies. |
| Canonical data/helpers | `tools/data/engine.json` owns fieldwork tuning; `tools/data/town.json` owns Standing/barter values; `engine/types.ts`, `engine/fieldwork.ts`, `game/src/engine/client.ts` provide types/helpers/bridge. `engine/loot.ts` exports mulberry32. No runtime import of map.json. |

## 3. Player behavior

### Lifecycle and policy

- Eligible only online, at the actual Field Camp, hunting=false, no group/walk/dungeon/Push recovery, no active Patrol or Auto-Return. Map selection is irrelevant.
- One active event, one latest recap, no queue. Timers use credited online simulation seconds, never wall clock/render frames.
- Freeze ID, origin, target, offers and prepared enemies once generated. Preview, reload, refusal and policy changes never reroll.
- Every possible fight has a warning. Harmful events pause gathering on warning; visitors/herd clues do not stop work until departure or a conflicting action.
- Successful walk/warp/relocation/ordinary-hunt/safe-Camp actions decline or retreat from the event and start cooldown once. Failed actions leave it untouched. Do not lock ordinary controls or revoke partial kill rewards.
- At most one resolution per tick; never generate another event on that tick. Relocation/reload cannot reset cooldown or exposure.
- A stopped gathering action requires explicit restart. A nest blocks restarting only while active.

Three saved policies, default avoid. The combat timing below applies to E2/E4/E7. E1 requires Investigate followed by explicit Fight; unattended sounds pass, and an unanswered post-Investigate choice withdraws. All policies automatically decline trades/help and herd-following at timeout, with no spending or travel.

| Policy | Hostile event without response |
|---|---|
| avoid | Pause work, shelter through warning + choice time, then let threat pass. Stay at Camp. |
| defend | Fight only when warned threat reaches Camp at the end of choice time. |
| engage | Begin the prepared fight at warning end, before it reaches the fire. Stay on the same hex. |

Manual Fight is available during warning. Display the policy outcome and remaining time before harm. E1 Investigate has its own explicit choice before fighting; it never starts an unannounced fight.

### Seven encounters

| ID / kind | Trigger / piece | Choices and outcomes |
|---|---|---|
| E1 sounds | Camp with legal adjacent field hex; silhouette/noise | Quiet/shelter: let it pass. Investigate: survey Camp + immediate neighbours once, reveal prepared ordinary group, then offer Fight/Withdraw. No extra reward. |
| E2 prowler | Silhouette approaches fire | Secure supplies: shelter with work stopped, no deducted stock. Confront/Fight: one prepared normal group. Timeout uses policy. No intimidation subsystem. |
| E3 traveler | NPC joins fire; frozen regional food/material offer | Listen: survey immediate neighbours and resolve. Trade: exchange frozen food for frozen ore/timber atomically and resolve. Decline. Listening and trading are mutually exclusive. |
| E4 nest | Mining/woodcutting with valid normal Species pool | Pause/shelter until timeout releases temporary blocker. Relocate through ordinary workflow/cost. Clear through one normal fight, then rest. No permanent hex record. |
| E5 herd | Unclaimed unfinished Expedition has accessible already-scouted subzone and matching Species | Show tracks toward subzone. Stay/dismiss. Follow: explicit ordinary startWalk, stop work, pause Patrol while preserving stops, resolve event on successful departure. Normal arrival/spawns/task credit apply. Refuse unchanged if task no longer qualifies. |
| E6 injured | NPC belongs to Camp zone's settlement and town help cap remains | Give frozen food bundle OR one frozen ordinary HP potion; decline. Each alternative grants the same frozen help credit once. No player healing, gold, stones or XP. |
| E7 discovered | Exposure reaches threshold; tracks accumulate visibly | Stay: policy applies. Shelter: threat passes with work stopped. Relocate through ordinary workflow/cost. Moving tent does not clear character-owned exposure/cooldown. |

Candidate rules:

- Filter unavailable hex/pool/town/task/food/material candidates before selection. Never retry-roll until something appears.
- Prepared combat uses the actual origin zone/subzone's normal pool. Respect map knowledge: silhouette before reveal; revealed preview and actual enemies must match.
- Camp fights cannot upgrade to Elite/Unique. Ordinary hunting after following a herd retains its existing rarity rolls.
- Survey means Camp + six neighbours, online only; reuse journal survey through a small explicit helper. Never mark surveyed cells walked-to or open Waypoints.
- Follow requires scouted target, valid Species/subzone task pair, visited owning settlement, legal route and normal startWalk preconditions. No following stage, reservation, spawn override or guaranteed task credit.

### Starter tuning

Provisional defaults for the first playable version, not balance gates. Put all numbers in canonical JSON and report them at handoff. Do not scatter tuning literals in runtime/UI.

| Config | Initial value |
|---|---|
| Arrival grace / check interval | 180 / 120 eligible online seconds |
| Check chance / kind weights | 0.5 / equal weight 1 among eligible kinds |
| Warning / choice / cooldown | 15 / 45 / 240 online seconds |
| Exposure threshold and cap | 900 online seconds at Camp |
| Exposure decay | 1 per credited online second outside Camp, none offline |
| Barter | 2 regional edible food for 1 ore OR timber, frozen at generation |
| Help costs | 2 regional edible food OR 1 uncondensed HP-restoring bottle |
| Help credit / lifetime cap per town | floor(1% / 10% of settlement budget); grant at least 1, at most remaining cap; budget/cap <= 0 excludes E6 |

For the potion alternative, freeze the lowest-HP-effect carried eligible authored bottle, ties by canonical name; use farm.potions only. Missing stock later refuses that option without substituting bottles. Generate E6 only when at least one payment alternative is affordable. Reuse existing regional food/material references; no new catalogue.

Exposure threshold makes E7 eligible; normal check/cooldown still apply. Resolving E7 by sheltering or defeating its threat resets exposure. Retreat/relocation declines it without resetting exposure. No per-hex exposure registry.

## 4. Technical contracts

### State, API and dependencies

- Add fieldwork.encounters: policy, RNG cursor, serial, grace/check/cooldown counters, exposure, active, recap. Add town.helpCredit keyed by settlement ID. Initialize the character-derived cursor in newGame and migration using the actual state.seed; default-only fieldwork helpers must not silently seed every character identically. No second quest store or persistent nest history.
- New `game/src/sim/camp-encounters.ts` owns lifecycle/transactions. Split types into `camp-encounter-types.ts` only if needed for cycles. Never runtime-import game.ts from it; use type-only GameState/Mob and passed callbacks for spawn/survey.
- Stages: warning, choice, combat. Active holds kind/ID/origin/frozen payload/timers. E1 Investigate is accepted once. Move preparedGroup into state.group on fight start, then retain only participating IDs; do not keep two mutable copies of the fight.
- Public tick/normalize/cancel/choose/setPolicy mutations require writer access; choose also requires event ID and correct stage. Stale/read-only requests fail with no state, counter, RNG or inventory changes.
- Validate typed choices against kind/stage. UI never supplies arbitrary item IDs, reward amounts or credit. Commit immediately; no replayable queued command. game.ts adapters provide the private spawn factory callback where needed.

### Tick, spawn and combat

1. Preserve existing order and RNG arguments: tickWorld → discovery → Delivery → Black Market.
2. After existing finalizers, reconcile event state, then advance Camp lifecycle online. writer=false remains a complete tick no-op.
3. Snapshot eligibility/event identity at tick start. Never generate merely because travel/recovery/combat ended this tick; start and end eligibility must hold. Pending combat can reconcile offline; warning/choice timers cannot advance offline.
4. On manual fight or automatic policy, assign prepared group after world work or during the validated UI action; stop fieldwork.action, hunting=false, player atkTimer=0, Patrol paused, travel='stay'. No extra attacks until next world tick.
5. Existing group combat and onKill grant ordinary rewards. hunting=false prevents automatic spawn loops and hunting-skill extra drops. No separate clear reward. Camp normal groups cannot advance Elite Expedition goals.
6. Cancel events at successful Camp/hunt/walk/warp actions before their ordinary state replacement; also reconcile stale state before world combat. A substituted group is never a Camp win. Failed actions do not cancel.
7. Victory resolves when participating IDs are gone. Push/retreat/replacement resolves interrupted. Never clear unrelated groups/statuses beyond the original action's own behavior. Existing Push recovery and offline loot rules stay intact.

Spawn change: optional final spawnMob options argument, default preserving all existing callers/draws. Camp calls disable only the normal branch's wild-Unique upgrade. Use eng.groupRangeOf(origin zone/subzone) and the existing normal factory with the Camp generator. Prepare the full group once at event generation; keep IDs/payload through save. No duplicated formulas, reroll loops or general-purpose exported factory.

### RNG and timers

Reuse engine/loot.ts mulberry32. Initialize Camp cursor deterministically with `(characterSeed ^ 0x43414d50) >>> 0`. At each actual check, instantiate a local generator from cursor and increment cursor once; all chance/selection/payload/preparation draws finish synchronously from that generator. Persist cursor before the next check. Normalization never draws or invents an event.

Camp generation never touches world rngState. Keep old draws pinned when Camp is inactive; actual added fights naturally change subsequent outcomes. Document the named-stream and online-only exceptions. No Math.random, clock seed, rendering draw, refusal draw or offline generation.

Pending timers advance online while their Camp eligibility remains valid; departure cancels them. Cooldown decreases in credited online time, including time away; grace/check counters advance only eligible time. Exposure increases online at Camp and decays online outside Camp. All pause offline. Do not decrement a newly initialized timer again in the same tick.

### Transactions and Standing

- fitsTransaction validates combined costs/grants on canonical buckets. After all validation, synchronously decrement/apply and mark resolved. Never preview with addTo, partially grant, or call player drink effects for NPC aid.
- Revalidate writer, ID/stage, origin/presence, counts, route/task where relevant, capacity and remaining help cap. Freeze offers; refuse unchanged if a frozen grant no longer fits remaining cap, rather than silently reducing it.
- Help credit never changes zoneKills, kill tasks, loot or Collector collections. Legitimate event-fight kills still pay ordinary kill progress.
- Extend StandingProgress with helpCredit and progress. kills stays actual kills; progress = kills + helpCredit. Tier/share/remaining use progress and existing thresholds. Preserve next.kills as the compatible threshold value; add next.requiredProgress for correct UI wording.
- Put the new credit/cap/progress calculation in a small shared `engine/standing.ts` helper; town.ts adapts GameState and calls it. Pass canonical budget and town Standing config into it, rather than importing game state or duplicating formulas in views. The engine helper is a new proposed file, not an existing verified symbol.
- Update TownHub/App to display actual kills + help credit, combined progress, and progress remaining. Tier-only map readers, canBuy and Collector continue through standingProgress. standingShare returns combined share. Change town.json earnt_from and wiki explanation.
- Help shares/cap live in town.json. At grant time enforce remaining cap. Normalization preserves legitimate historical credit if later tuning lowers a cap; no more aid credit until below it. Never reduce prior progress as housekeeping.

### Saves and offline

Use additive normalization at current schema 17, without a bump solely for optional fields. newFieldwork/migrate initialize encounters; newTown/migrate initialize helpCredit. Preserve currently supported imports 14–17 and unknown-version rejection. Snapshot restore follows the same normalization.

Validate kind/stage/ID, finite integer timers/cursor, origin, references, prepared mobs and credit. Discard unusable new event state with safe cooldown; never pay, reroll, respawn or erase unrelated state. Valid frozen payload and cursor must round-trip exactly. Combat normalization never rebuilds a missing group.

Offline never advances event timers/exposure/cooldown, resolves warning choices, reveals news, or creates events/backlog. Existing gathering continues unless already paused before leaving. Combat already started uses ordinary catchUp/catchUpAsync, may resolve once, and cannot generate a replacement event. Keep one recap.

## 5. UI and browser acceptance

Use map placements and existing contextual card/Journey space, not a modal per event or new HUD region. Show kind/location/time, automatic policy outcome, known costs/rewards and disabled-action reasons. Camp and map controls share one saved policy; changes never reroll.

Place silhouettes, visitor, tracks and temporary nest at real coordinates without obscuring Camp/Patrol/player controls. Show live fight and paused work, real ordinary Follow walk, native buttons, keyboard/focus, accessible status text and reduced motion.

Add deterministic Showcase fixtures for seven kinds plus warning/combat/timeout/full-bag/read-only, using sample state rather than real saves. Follow AGENTS.md: reuse port 5173, its Showcase URL, 1920 × 1080, one visible integrated tab with Playwright attachment; close after checking. Attachment failure blocks browser proof only; no headless substitute or mirror.

## 6. Verification map

Commands run from workspace root. They are instructions, not claims of passing results.

- B, existing baseline: `pnpm --dir game test tests/fieldwork.test.ts tests/exploration.test.ts tests/save-fidelity.test.ts tests/map-adventure.test.ts tests/map-encounters.test.ts tests/map-exploration.test.ts tests/black-market.test.ts tests/delivery.test.ts`
- C, new suite after creation: `pnpm --dir game test tests/camp-encounters.test.ts`
- S, root and Svelte checks: `pnpm check`
- W, after wiki/behavior changes: `pnpm wiki`
- F, final integration: `pnpm test` and `pnpm verify`

Place meaningful new tests in game/tests/camp-encounters.test.ts. These labels specify observable outcomes, not internal function shapes.

| ID | Required proof |
|---|---|
| C01 eligibility | Every forbidden state/writer=false causes no event/draw; no event on travel/recovery-completion tick. |
| C02 lifecycle | One event, warning before harm, three distinct policies, no auto-spending/follow, grace/cooldown, no same-tick replacement. |
| C03 randomness | Equal seed/actions give equal payloads; preview/refusal/load/offline never reroll. Existing offers/world rngState remain unchanged by generation alone. Compare inactive old-world projections with and without Camp eligibility using matched fixtures. |
| C04 combat | Preview matches actual normal group, no Unique/Elite upgrade, no hunting loop/work overlap, next-tick damage, ordinary kill rewards, victory/Push/retreat resolve once. |
| C05 cancellation | Successful walk/warp/Camp/hunt actions cancel; refusal preserves event; substituted group is not victory. Keep already-earned partial rewards. |
| C06 transactions | Full bag, insufficient stock, stale ID, wrong position/stage, duplicate click and read-only cause no state change. Costs freeing slots allow valid exchanges; combined same-key costs/grants are correct. |
| C07 content | All seven kinds work in suitable deterministic fixtures; temporary nest stops work and releases guard; Investigate surveys once; missing candidates excluded; visitor gives one outcome. |
| C08 herd | Exact scouted/accessible Expedition pair required; Follow starts actual walk and ordinary arrival hunt; no automatic task credit/reserved spawn. |
| C09 help | Correct food or ordinary potion bucket paid once; no condensed/player healing; cap, credit and kills stay distinct; services/Collector use combined tier. |
| C10 persistence | Supported old saves backfill, warning/choice/combat/credit round-trip and snapshot restore preserve meaning; invalid payload cannot mint/respawn; unknown outer versions reject. |
| C11 offline | No timer/exposure/news/backlog; existing fight follows offline rules; sync/async catch-up agree. |
| C12 views | Models reflect origin/knowledge/live group/stopped work; browser covers seven kinds, policy/timeout, refusal, actual Follow route, reload, keyboard and read-only. |

Include negative cases for stale ID, corrupt prepared payload, substituted group and duplicate payment. Assertions must catch double grants, world RNG used for generation and rebuilding lost fights. Do not gate fixed pacing, roster/content counts or tuning values. Run focused checks for changed inputs; repeat/broaden only for relevant changes or unresolved failures.

## 7. Sequential execution packets

One implementing agent, one packet at a time; no parallel edits. READY means specification is actionable, not implementation has passed. Dependencies require previous packet's actual evidence.

Shared entry/stop rules: inspect current sources; preserve unrelated work; run B before first code edit and record exact results. An unrelated baseline failure blocks only dependent work. Stop affected work for a new critical dependency, source changes since read, missing canonical references, lossy migration, or a contract requiring a new product choice. Report evidence to planner/owner; do not guess or fix unrelated failures. Browser attachment failure leaves UI sign-off pending while independent work can finish.

### P1 — Config, state and persistence

Status: READY; no prerequisite except baseline entry check.

Scope/context: engine types/fieldwork helpers, canonical JSON, FieldworkState/newFieldwork, newGame, newTown, save migrate/import/snapshots. No event generation/UI yet.

Steps: typed config/defaults → small state → additive normalization/reference validation → config/C10 tests. Keep schema/import compatibility and world RNG unchanged.

Acceptance/proof: B before edits; relevant C config/persistence cases, S and changed fieldwork/save-fidelity suites afterward. Counts/progress survive; invalid data cannot pay/spawn.

Stop: normalization needs to drop legitimate old progress or change supported imports. Handoff: files, config/state shape, supported versions, exact commands/results.

### P2 — Lifecycle, policies and prowler

Status: READY after P1.

Scope/context: new lifecycle module; game.ts tick/private spawn/adapters; successful-action cancellation in game/fieldwork/road; E2 only. No Standing formula or full visual layer.

Steps: own stream → hook/snapshots → prepared normal group → policy/choices → cancellation → combat/Push/offline reconciliation. Keep hunting=false. Enable other event kinds only when their packet lands; final delivery must include all seven.

Acceptance/proof: C01–C05/C11, affected baseline suites, S. Force a would-be Unique preparation and prove only Camp suppresses conversion. Check ordinary spawn callers preserve draw sequence. Use matched fixtures rather than Git/history comparison.

Stop: generic combat unexpectedly requires hunting=true or old callers/draws cannot stay intact. Handoff: hook locations, RNG lifecycle, combat proof and commands/results.

### P3 — Traveler, herd clue and injured transactions

Status: READY after P2.

Scope/context: E3/E5/E6, journal survey helper, fitsTransaction, task/route checks and helpCredit grant. UI/formula display follows P5. No forced spawns/new item systems.

Steps: freeze costs/grants → atomic barter/help → one-time news survey → eligible task/route clue → explicit ordinary Follow walk. Exclude unavailable candidates; never call player potion use for aid.

Acceptance/proof: C03/C06/C08 and C09 payment/cap cases, affected exploration/fieldwork suites, S. Prove costs free slots, stale task refuses unchanged, Follow resolves event without canceling its new walk.

Stop: an event requires invented item/route mechanics. Handoff: frozen payload examples, canonical references, transaction proof and commands/results.

### P4 — Sounds, temporary nest and exposure

Status: READY after P3.

Scope/context: E1/E4/E7, event-aware gathering restart guard; no permanent hex registry or relocation-price changes.

Steps: sounds Investigate/Withdraw/Fight → temporary mining/grove interruption → exposure/decay/discovered warning → enable complete eligible roster.

Acceptance/proof: C02/C05/C07/C11, fieldwork suite and S. Exercise seven kinds through deterministic fixtures; timeout releases nest guard without restarting work. Relocation cannot reset exposure/cooldown.

Stop: absent content would require new Species/locations. Handoff: triggers/actions/results, exposure/offline evidence, commands/results.

### P5 — Standing readers and Adventure board

Status: READY after P4.

Scope/context: shared engine/standing.ts helper, StandingProgress and consumers in section 2; map models/placements/styles, existing Camp/Journey panels, App writer handlers and Showcase. No new HUD region.

Steps: shared Standing calculations and adapter/consumers → shared policy UI → seven visual/card states → writer-safe actions → deterministic Showcase/accessibility. P3 may introduce the shared credit/cap part of the helper to avoid duplicating the formula.

Acceptance/proof: C09 tier/service/Collector cases, C12, S, affected map tests and integrated-browser scenarios. Observe actual walking, gathering pause and combat, not labels alone.

Stop: shared HUD rewrite/new region needed; ask planner to rescope. Browser failure blocks UI sign-off only. Handoff: actual interactions, keyboard/read-only proof, commands/results and limitations.

### P6 — Contracts, wiki and final review

Status: READY after P5.

Scope/context: affected game-rules/DECISIONS sections, glossary only for changed terms, wiki/pages.ts and generated wiki. No unrelated documentation cleanup.

Steps: document named-stream/offline exceptions, temporary nest/retreat/help formula → regenerate wiki → inspect critical edited implementation/evidence → clean task-owned temporary files.

Acceptance/proof: C/F/S/W on final inputs, reuse still-valid results. Every C01–C12 has passing evidence or an explicit blocker; browser sign-off covers current UI inputs. No success claim while required runtime/save/UI proof is blocked.

Handoff: seven delivered behaviors, files, exact commands/results, starter tuning and unresolved blockers. Reviewer independently inspects RNG, saves, transactions and Standing changes, not just the agent summary.

## 8. Completion record

Verdict: DELIVERED. P1–P6 are implemented and C12 browser acceptance is complete. All three gameplay choices are owner-approved. No product decision remains open.

| Gate | Result / evidence |
|---|---|
| G1 objective/scope | PASS: seven kinds, explicit non-goals and owner choices. |
| G2 repository grounding | PASS: tick/factory/group/retreat/save/transaction paths and Standing readers checked. |
| G3 decisions | PASS: retreat, temporary nest and herd behavior approved. |
| G4 contracts | PASS: own RNG stream, combat/cancel, transactions, Standing and additive saves implemented. |
| G5 edge cases | PASS: refusal, duplicate action, offline, Push, missing content, reload and invalid payload covered. |
| G6 testability | PASS: C01–C12 tests and browser proof. |
| G7 execution/stopping | PASS: P1–P6 completed in dependency order. |
| G8 isolation | PASS: implementation stayed within packets and existing modules. |

Previous findings: R1 resolved by ordinary retreat; R2 temporary nests; R3 ordinary herd hunting; R4 own stream/after-finalizer hook and negative proof; R5 verified readers/compatible progress fields; R6 bounded packets/commands/stops. No open critical planning finding remains in inspected sources.

| Finding | Severity before refinement | Evidence / disposition |
|---|---|---|
| R1 retreat mismatch | High | road.startWalk and fieldwork.returnToCamp clear groups; approved retreat now preserves those controls. C04/C05 verify event cleanup and partial rewards. |
| R2 persistent nest overreach | High | fieldActionProblem has no persistent blockers; owner selected a temporary lifecycle guard, tested by C07. |
| R3 herd spawn mismatch | High | game.spawnMob uses ordinary pools and town.progressTasks requires actual Elite identity; owner selected clue + normal walk/hunt. C08. |
| R4 RNG/lifecycle placement | High | game.tick finalizer order and world early return inspected; own stream, eligibility snapshots and post-finalizer event hook now explicit. C01/C03/C04/C11. |
| R5 Standing readers | Medium | town helpers, App/TownHub numeric displays, tier-only map/Collector readers inspected; shared formula and compatible fields specified. C09. |
| R6 oversized handoff | Medium | One prompt previously requested all layers; P1–P6 now have dependencies, scope, proof and stop rules. |

| Packet | G1 | G2 | G3 | G4 | G5 | G6 | G7 | G8 | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| P1 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY at baseline entry check |
| P2 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY after P1 evidence |
| P3 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY after P2 evidence |
| P4 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY after P3 evidence |
| P5 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY after P4 evidence |
| P6 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY after P5 evidence |

Verification detail: `npm test` passed with 724 tests. The optional drop-reference capture is skipped unless `DROP_CAPTURE_OUT` is set, so ordinary runs do not write generated fixtures. `npm run check` produced zero errors and warnings; `npm run verify` reports 9/9 cages; the wiki was regenerated. The integrated browser checked C12 at 1920×1080, including live pawn movement, timeout, keyboard actions, read-only controls and full-bag refusal.

## 9. Handoff

The local development server is available on port 5173. Open `http://localhost:5173/__showcase#showcase-field` and choose Map · Adventure board or a Camp encounter fixture to review the delivered behavior.
