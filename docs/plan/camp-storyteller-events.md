# Shared storyteller — locked implementation specification

Status: **locked implementation specification; runtime work has not started**. This task edits documentation only. Start at ST-00 when implementation is ordered.

Continues [stall-idea.md](../stall-idea.md); keep this filename. Follow [AGENTS.md](../../AGENTS.md), including current-branch, concurrent-edit and commit/push rules. This plan authorizes no publishing.

Implement these contracts without redesign or tuning. Existing formulas keep their owners; new values move into the named JSON owners, which become authoritative. Report contradictions or failed acceptance with evidence; do not substitute another design.

## 1. Fixed product scope

| Topic | Fixed behavior |
|---|---|
| Shared interface | One `StoryScene` component for Camp, delivery requests/results, road outcomes, trail sites, dungeon transitions/results, market recommendations/promotions and the Forge. |
| Storytelling | Authored images and written text only. No music, voice, sound effects, runtime LLM, server or generated dialog. |
| Speakers | Narrator frames the world; existing NPCs speak at their own services. Use names from `TOWN.npcs`. No new NPC entity, relationship meter or reputation. |
| Player effort | No required greeting dismissal, extra transaction confirmation, typing animation or “read for reward” action. Existing direct working controls remain usable. |
| Common UI | Reuse media, heading/speaker, narration, fact rows, action buttons, unavailable reasons and receipts. Keep inventory, equipment comparison, market tables, the skill tree, map controls and combat arena as their current direct interfaces. |
| Mechanical ownership | Each domain validates and commits its own action. The renderer has no `GameState`, RNG, formulas, inventory access or command registry. |
| Event pools | Each source owns its candidate pool and selection policy. Camp gets the exact data catalog in 4.5; other sources retain the catalogs/derived contexts listed there. Story variants remain separate presentation data. |
| Town greeting | Context-sensitive, inline and deterministic. No popup on entering a town or reopening a panel. |
| Market | Explain current sale quotes/routes. Add one deterministic promotion for an eligible stocked town-stall line per simulation-time cycle. No sale-price multiplier, Black Market promotion or Forge material discount. |
| Blacksmith | Narrate the currently selected valid/invalid Forge plan, missing materials and actual result. Keep existing material cost, output roll, XP and repair rules. |
| Random item requests | Reuse existing local delivery generation and payouts, with NPC attribution. Do not add a second item-quest engine. |
| Cross-city requests | Add accepted courier contracts to the existing delivery store, using ordinary carried goods. Origin and destination differ; both must already be visited. Waypoints are allowed. No supplied parcel, cargo escrow, deposit or item tagging. |
| Camp addition | Preserve the five current kinds and add exactly `supply-cache` with safe timed recovery, immediate declared risk and a neutral exit. `herd` and `injured` are not implemented in this rollout. |
| Earn/loss | Show guaranteed cost, conditional grant, maximum total exposure and actual receipt separately. No gear destruction, level/skill loss, erased discovery or permanent lockout from new choices. |
| Art | Reuse existing shelf PNG glyphs in fixed scene compositions. No new image generation, portraits, asset promotion or art approval dependency in this rollout. |
| Language | Ship the exact English content in section 5, matching the current UI. Preserve existing names and displayed item/zone terms. No localization framework. |

A new authoring variant changes content data, not scene markup. A new domain still supplies a small explicit view mapping and its current callbacks; there is no graph interpreter, event bus, plugin registry, script evaluator or global modal queue.

## 2. Verified owners and compatibility requirements

Verified against the repository during this planning task. Symbols are the references when line numbers move.

| Owner | Contract to preserve |
|---|---|
| [camp-encounters.ts](../../game/src/sim/world/camp-encounters.ts): `candidates`, `makeEvent`, `chooseCampEncounter`, `tickCampEncounters` | Existing kinds: `sounds`, `prowler`, `traveler`, `nest`, `discovered`. Hostile groups are prepared once. `avoid / defend / engage`, warning/choice timers and work interruptions remain. |
| [fieldwork.ts](../../game/src/sim/world/fieldwork.ts): `CampEncounterActive`, `newCampEncounterState`, `normalizeCampEncounterState` | Camp uses its own saved RNG stream and serial. `sounds` is a compatibility key, presented through visible movement/tracks. `discovered` means a threat found Camp; `nest` obstructs work. |
| [game.ts](../../game/src/sim/core/game.ts): `closeSecond` | Current closing order is map discovery → trail sites → deliveries → Black Market → Camp, followed by existing finalization. Preserve this order. Insert courier generation only after the current Camp call. |
| [walk-stage.ts](../../game/src/sim/core/tick/walk-stage.ts): `advanceWalkStage`; [fieldwork.ts](../../game/src/sim/world/fieldwork.ts): `resolveTravelEvent` | Road events resolve once per crossed block online, update `mapJournal.lastEvent` and log. Keep those effects/RNG draws; narration never re-runs the event. |
| [map-exploration.ts](../../game/src/sim/world/map-exploration.ts): `investigateTrailSite` | Location/activity checks, partial pickup behavior, Hunger restoration and claimed-site recording remain owned here. |
| [dungeon.ts](../../game/src/sim/world/dungeon.ts); [game.ts](../../game/src/sim/core/game.ts): `completeDungeonRun` / `retreatDungeon` / `payoutStacks` call sites | Preserve run entry, completion, retreat rescue, Push forfeiture and bag rules. A recap displays actual results and never calls a payout. |
| [trade.ts](../../game/src/sim/town/trade.ts): `quoteSale`, `sellGoods`, `marketDestinations` | Prices, demand, city/basic-channel split, currency credit and travel comparisons retain their owners. Story text cannot promise a better sale than the actual quote. |
| [pricing.ts](../../game/src/sim/town/pricing.ts): `priceMinutes`, `priceGold`; [town.ts](../../game/src/sim/town/town.ts): `canBuy`, `buy`, `repairGear` | All stall and repair paths must use the same promoted quote. Preserve teaching prices, Haggling, stock/ladder checks, chosen repair target and ordinary non-promoted prices. |
| [forge.ts](../../game/src/sim/gear/forge.ts): `canForge`, `forgeGear`; [engine/forge.ts](../../engine/forge.ts) | Keep Forge inputs, item generation and XP. Build the output before subtracting material. Do not add a failure chance or a gold fee. |
| [delivery.ts](../../game/src/sim/town/delivery.ts); [engine/delivery.ts](../../engine/delivery.ts) | Local requests keep their generation RNG order, counts, acquisition solver, difficulty, reward modes, milestones, partial hand-ins and payouts. Distance affects deadlines, not intrinsic reward difficulty. |
| `tickDeliveries` | `deliveryClockSec` advances online AND offline unless the pause snapshot says otherwise. Offers are generated online only. Couriers use this clock; do not copy Camp's offline freeze. |
| [save.ts](../../game/src/state/save.ts): `SCHEMA_VERSION`, `migrate` | Verified schema is 28. At implementation, bump the then-current schema by exactly one for this rollout; preserve intervening migrations. Never hard-code an already occupied version. |
| [glossary.md](../glossary.md#combat) | HP zero means Push and recovery, not death. New supply risks must be explicit, recoverable and bounded. |

Read-only remains writer ownership, not a harmless inspection state. Use “Inspect” for observation. Existing IDs containing underscores/spaces keep their spelling; only new content identifiers use lowercase hyphens.

## 3. File map and exact responsibilities

Extend these owners. New files are limited to those named below; no second simulation store or replacement panel.

| Path | Required change |
|---|---|
| New `tools/data/storyteller.json` | Versioned presentation content, closed token lists, scene variants and source→media mapping from section 5. No prices, probabilities or resource quantities. |
| `tools/data/engine.json` → `fieldwork.camp_encounters.event_pool`, `.story` and `.cache` | Exact Camp pool/values in section 4; append `supply-cache` to `kinds`. Leave existing values unchanged. |
| `tools/data/town.json` → `storyteller_promotions` and `delivery.courier` | Exact promotion/courier additions from section 4. Leave existing NPC IDs, local delivery values, stock and shop rows unchanged. |
| New `engine/storyteller.ts` | `validateStoryData(raw, refs)`, `formatStoryLine(line, tokens)` and `storyHash32(text)`. Presentation validation/formatting and deterministic hashing only. |
| `engine/types.ts` | Add the closed Camp pool types in 4.5 and extend `FieldworkCfg` with `event_pool`. Reuse the engine kind type in the sim instead of duplicating its union. |
| `engine/fieldwork.ts` | Extend the current factory with the pure pool validation/filter/weighted selector in 4.5, then Camp variant and cache helpers in section 6. Keep existing returns/signatures working. |
| `engine/trade.ts` | Add pure promotion selection and service-price calculation in section 9. Do not change sale quotes or ledger formulas. |
| `engine/delivery.ts` | Retain current acquisition/reward helpers. Reuse them for couriers as specified in section 10; no new distance reward multiplier. |
| `game/src/engine/client.ts` | Import/validate storyteller JSON once, export `STORY`. After story validation and fieldwork construction, validate the Camp pool against the set of Camp scene IDs. Instantiate through existing typed seams. New mechanics read their canonical JSON fields here, not duplicated UI constants. |
| `game/src/sim/world/fieldwork.ts` | Extend Camp types/defaults/normalization. Add structured road/exploration outcome fields to the existing map-journal record through the source owners. |
| `game/src/sim/world/camp-encounters.ts` | Camp source integration, new cache lifecycle, receipts and exactly-once validation. |
| `game/src/sim/town/pricing.ts`, `town.ts` | Shared promotion-aware quotes and expected-quote validation for all live purchases/repairs. |
| `game/src/sim/town/delivery-types.ts`, `delivery.ts` | Extend existing contracts with kind, destination, issuer and courier acceptance. Add the separate courier stream/cadence inside this owner; retain local RNG and serial namespace. |
| `game/src/sim/core/types.ts`; `town.ts:newTown` | Add the exact saved fields in section 11. No account-wide progression change. |
| `game/src/sim/core/game.ts`; `core/tick/walk-stage.ts`; `world/dungeon.ts`; `world/map-exploration.ts` | Preserve simulation order; attach structured receipts at real result boundaries and call the courier tick at the specified point. |
| New `game/src/ui/story/story-scene.ts` | Exact view types in section 7. No simulation imports. |
| New `game/src/ui/story/story-presenters.ts` | Plain read-only source mapping functions in section 8. No state writes/RNG; no registry. |
| New `game/src/ui/story/StoryScene.svelte` | The single scene renderer and accessibility behavior in section 7. |
| Existing `MapJourney.svelte`, `TravelCard.svelte`, `Market.svelte`, `DeliveryNotice.svelte`, `DeliveryBoard.svelte`, `TownHub.svelte`, `inventory/Forge.svelte` | Replace only the duplicated narrative/action-frame markup listed in section 8. Keep their working controls. |
| `game/src/App.svelte` | Wire the existing callbacks, local actual-result views, courier handlers and showcase fixtures; preserve panel/HUD IDs and layout compatibility. |
| `game/src/state/save.ts` | One schema migration and normalization order from section 11. |
| `tools/check.ts` | Add named `storyteller-contract` validation inside the existing check pipeline; no numeric gate-ID renumbering. |
| Tests listed in section 14 | Add focused pure-rule, simulation, save and rendered-view coverage. Use existing test infrastructure; no dependency installation. |

Excluded: `camp-events.json`, generic story engine, new HUD region/dialog, service registry, localization library and transaction middleware.

## 4. Data values and closed algorithms

ST-01 writes these fixed initial values to their JSON owners. Existing values stay referenced at their owners.

### 4.1 Camp additions

| JSON path under `engine.json.fieldwork.camp_encounters` | Initial value / interpretation |
|---|---|
| `story.recent_limit` | `4` terminal/presentation history records. |
| `story.avoid_consecutive_kind` | `true`. After repeat-gap preference, exclude the immediately previous kind only when another kind remains. Singleton/same-kind pools remain eligible. |
| `cache.material_id` | `"ore"`. Resolve through existing material data. |
| `cache.careful_intervals` | `2`; remaining time = this multiplier × `fieldwork.actions.mine.interval_sec`. |
| `cache.careful_yield_mult` | `1` × `fieldwork.actions.mine.yield`. |
| `cache.outcomes` | In order: `{id:"gain", weight:2, yield_mult:2, food_loss:0}`; `{id:"mixed", weight:1, yield_mult:1, food_loss:1}`; `{id:"loss", weight:1, yield_mult:0, food_loss:1}`. Multipliers apply to ordinary mining yield; weights are normalized by their sum. |

Cache eligibility is existing Camp eligibility **and** no `fieldwork.action` **and** a valid regional food ID and cache material. Owning food is not required to see it: careful/leave remain available, while quick requires the maximum declared food loss. Only this new kind uses the new cache outcomes. No food drop, combat roll or permanent progression is added.

### 4.2 Town promotions

Add `town.json.storyteller_promotions` exactly:

~~~json
{
  "cycle_sec": 3600,
  "discount_pct": 10,
  "eligible_rows": ["repair", "repair_ironrow", "banner_coldres", "tint_heavy", "collector_hint"]
}
~~~

One eligible **stocked** row is promoted per settlement per cycle. A settlement with no eligible stocked row has no promotion. Owned/sold-out/unusable rows may still be the cycle's promotion; show its normal availability reason and never reroll to find something buyable. No changes to stock, daily limits or the old real-day pedlar rotation. “This cycle” is the displayed wording; do not claim a real-world daily offer.

### 4.3 Courier configuration

Add `town.json.delivery.courier` exactly:

~~~json
{
  "enabled": true,
  "active_slots": 1,
  "trigger_interval_mult": 1,
  "trigger_chance_mult": 1
}
~~~

Use one **character-wide** courier slot, saved countdown and independent RNG stream; local-request slots remain separate. Multiply the existing delivery interval/chance by these fields. Section 10 defines eligibility and rewards.

### 4.4 Deterministic selection

`storyHash32` is FNV-1a over UTF-16 code units: start `2166136261`; for each character XOR its `charCodeAt` and use `Math.imul(value, 16777619) >>> 0`. Return unsigned 32-bit. Hash IDs/context keys, not translated text. These constants are algorithm constants, not gameplay tuning.

- Scene variant selection is pure and consumes no simulation RNG.
- For a kind, take the variants in their JSON order; exclude IDs in the last `story.recent_limit` records if any variant remains. Otherwise use all variants.
- Choose `hash32(seed + "|" + encounterSerial + "|" + eventId) % available.length`, where `eventId` is the selected pool row ID. Record both event ID and variant when the instance is created, not when rendered.
- For one returning-traveler continuation: if the newest unconsumed terminal traveler history record is `trade-ore` or `trade-timber`, use `traveler-return` and mark that record consumed at creation. The next terminal traveler result may enable a later continuation. This changes narration only and grants no extra reward.
- Cache uses one additional Camp-stream draw at instance creation to freeze the quick outcome in table order. Existing hostile preparation must occur at its original point and receive the same stream inputs; decorative text adds no draws. No future outcome is selected on hover/open/retry.
- Initialize courier stream as `(state.seed ^ storyHash32("courier")) >>> 0`. Advance it exactly like the existing Camp stream: start `mulberry32(savedStream)` for one generation attempt and increment saved stream by `0x6d2b79f5` unsigned. Use that local generator only for the courier attempt.

### 4.5 Event pool contract — ready for implementation

At its existing trigger, each source selects an eligible situation, then its story variant. Opening the UI selects neither.

#### 4.5.1 Pool ownership across the seven sources

| Source | Candidate data/context owner | Selection policy and identity retained |
|---|---|---|
| Camp | New `engine.json.fieldwork.camp_encounters.event_pool` below | Source facts → repeat preference → one weighted selection; freeze the selected row ID on the active encounter. |
| Local item requests | Existing trade-good catalog, `town.json.delivery.target_weights` and `deliveryCandidates` | Preserve current weighted target draw and reward order. `contract.good` and contract ID already identify the frozen offer; do not add a template-selection roll. |
| Courier requests | Existing visited-town IDs × viable `deliveryCandidates(destination)` | The exact chance/destination/target process in section 10 is its pool. Freeze source, destination, good and reward in the existing contract store. |
| Road events | Existing `engine.json.fieldwork.travel_events.events` | Keep the existing chance and weighted event draw inside `resolveTravelEvent`; attach only the actual result receipt. |
| Trail-site discovery | Existing `fieldwork.map_exploration.kinds` and candidate cells in `rollTrailSite` | Keep current weighted kind/cell selection and saved trail-site ID. Inspection cannot repick the site or reward. |
| Market promotions | Existing stocked rows intersected with `storyteller_promotions.eligible_rows` | Deterministic cycle rotation in section 9; no weighted random draw and no extra catalog. |
| Market/Forge/NPC greetings | Existing current quote, selected Forge verdict, transaction result or request state | The fixed context priority in 8.1 selects the presentation scene; line variants use the pure hash. No gameplay event is generated. |
| Dungeon | Actual run/entry/result state | Render the existing run transition and final receipt. Do not randomly choose a dungeon consequence. |

The Camp catalog owns its eligibility bindings, weights, repeat gaps and scene binding. Other domains keep their prices, targets, rewards and pools; `storyteller.json` is presentation-only. Add no `pool-events.json`, global `EventPool` store or cross-domain weight table.

#### 4.5.2 Closed Camp pool schema

Add the following exported types to `engine/types.ts`:

~~~ts
export type CampPoolKind =
  | 'sounds' | 'prowler' | 'traveler' | 'nest' | 'discovered' | 'supply-cache';
export type CampPoolRequirement =
  | 'local-mobs' | 'traveler-offer' | 'worksite'
  | 'exposure-threshold' | 'idle-cache';
export type CampPoolRow = {
  id: string;
  kind: CampPoolKind;
  scene_id: string;
  weight: number;
  requires: readonly CampPoolRequirement[];
  repeat_gap_events: number;
};
export type CampPoolFacts = {
  localMobs: boolean;
  travelerOffer: boolean;
  worksite: boolean;
  exposureThreshold: boolean;
  idleCache: boolean;
};
export type CampPoolSeen = {
  eventId: string; kind: CampPoolKind; encounterId: number;
};
~~~

`FieldworkCfg.camp_encounters.event_pool` is `readonly CampPoolRow[]`. Its `kinds` enable-list type is `(CampPoolKind | 'herd' | 'injured')[]`, preserving the already authored legacy names without making them runtime candidates. No extra `enabled` flag is added to rows. Export the sim alias `CampEncounterKind = CampPoolKind` from its existing file so callers keep their imports.

Write this exact initial catalog at `engine.json.fieldwork.camp_encounters.event_pool`. JSON order is the stable selection order:

~~~json
[
  {"id":"camp-sounds","kind":"sounds","scene_id":"sounds-signs","weight":1,"requires":["local-mobs"],"repeat_gap_events":0},
  {"id":"camp-prowler","kind":"prowler","scene_id":"prowler-edge","weight":1,"requires":["local-mobs"],"repeat_gap_events":0},
  {"id":"camp-traveler","kind":"traveler","scene_id":"traveler-offer","weight":1,"requires":["traveler-offer"],"repeat_gap_events":0},
  {"id":"camp-nest","kind":"nest","scene_id":"nest-worksite","weight":1,"requires":["local-mobs","worksite"],"repeat_gap_events":0},
  {"id":"camp-discovered","kind":"discovered","scene_id":"camp-found","weight":1,"requires":["local-mobs","exposure-threshold"],"repeat_gap_events":0},
  {"id":"camp-supply-cache","kind":"supply-cache","scene_id":"cache-ledge","weight":1,"requires":["idle-cache"],"repeat_gap_events":0}
]
~~~

Equal initial weights retain legacy uniform selection for the same eligible kinds. Only cache and the specified repeat preference change candidates; no extra “event family” draw.

`kind` links to the legal actions/rule owner in 6.3; `scene_id` links to presentation. Keep labels, prices, outcomes, transitions and rewards at those owners. `traveler-return` is the bounded presentation continuation, with no seventh gameplay row or extra reward.

Use the existing Camp global cooldown. `repeat_gap_events` is a soft preference counted in selected encounter serials, not seconds, UI opens or resolved choices. Initial zero leaves cadence unchanged.

#### 4.5.3 Facts and eligibility

At each candidate check, `camp-encounters.ts` computes these booleans once from source-owned helpers/counts. No JSON expressions.

| Requirement | Exact source fact |
|---|---|
| `local-mobs` | Current `poolFor` has at least one species, exactly as the legacy `hasHuntPool` check. |
| `traveler-offer` | Existing settlement/home exists; regional food exists; carried count meets `CFG.barter_food`; at least one currently supported ore/timber material exists. Preserve that complete legacy condition. |
| `worksite` | `fieldwork.action.kind` is `mine` or `grove`. |
| `exposure-threshold` | Existing exposure argument passed to `candidates` is true. |
| `idle-cache` | No active fieldwork action and valid regional food/cache material, exactly as 4.1. |

Keep the overall Camp gate outside the catalog: position, safe tick snapshot and no hunt/fight/dungeon/recovery. Require `CFG.kinds` enablement and every listed condition. Facts contain no inventory amounts or side effects; rows cannot relax the gate.

After selection, build the explicit kind payload: existing preparation for the four hostile kinds, the current traveler food/material offer, or one frozen cache offer. Enumerating candidates never spawns groups or pays rewards.

#### 4.5.4 Pure API, weighted draw and empty pools

Extend the existing `createFieldwork` return with exactly:

~~~ts
validateCampPool(campSceneIds: ReadonlySet<string>): void;
eligibleCampPool(
  facts: CampPoolFacts,
  history: readonly CampPoolSeen[],
  nextSerial: number,
): readonly CampPoolRow[];
selectCampPool(
  rows: readonly CampPoolRow[],
  draw: number,
): CampPoolRow | null;
~~~

`eligibleCampPool` filters configured/enabled rows in JSON order, without mutating config/history or drawing:

1. Filter by enable list and all hard requirements. If empty, return `[]`.
2. For each row find its latest history serial. Unseen rows pass repeat preference. A seen row passes when `nextSerial-lastSeenSerial > repeat_gap_events`.
3. If any pass, use that preferred subset. If none pass, keep only base-eligible rows with the **oldest** last-seen serial. This explicit fallback prevents all rows being blocked forever while serials cannot advance. Never relax hard requirements.
4. If consecutive-kind avoidance is on and some retained row has a different kind from the newest valid history record, remove rows of that last kind. Otherwise retain the rows.
5. Return the remaining rows in their original order. Pruned history is sufficient because validation bounds each gap to `story.recent_limit`; a row absent from that window is treated as unseen.

`nextSerial` is the current Camp serial plus one, a positive safe integer. History passed to this helper has valid serials below it. Invalid explicit arguments throw before any source mutation.

`selectCampPool` returns null immediately for empty input and does not need a valid draw in that case. Otherwise require a finite `draw` in `[0,1)`, positive finite weights and a finite strictly increasing cumulative total. Let `point=draw*totalWeight` and return the first row where `point<cumulativeWeight`; if multiplication rounds to the total for a valid input, return the final row. This numeric boundary fallback consumes no second draw.

In `tickCampEncounters` retain the existing chance check/stream advancement. After it succeeds, calculate eligible rows. If empty, return with no selection draw, no serial increment, no new cooldown, no history entry and no active encounter. Wait for the normal next check. If nonempty, consume **one** existing selection draw and pass it to `selectCampPool`. No reroll loop or fallback event is created by the UI.

#### 4.5.5 Binding, save and authoring boundaries

At creation freeze `story.eventId`, bound `sceneId` (or the permitted traveler continuation), line index and outcome payload. History and Camp receipts include `eventId`; never serialize the catalog, weights or live eligibility facts.

Reopen, reload and failed cost/capacity checks never reselect a row. Revalidate actions against live inventory and retain Camp departure cancellation. Eligibility/weight changes apply only to future instances, never reclassifying or rerolling an active one.

Legacy story metadata missing `eventId` backfills the canonical row ID for its existing kind, with no RNG/serial/history effect. For unknown/mismatched event IDs on the five legacy kinds, discard only story metadata and retain a valid original group/timers with the legacy presentation fallback. An unknown/mismatched cache binding cancels that prospective cache through the existing invalid-cache normalization rule; no new grant/charge. Reject duplicate/unknown catalog definitions at the data boundary rather than inventing a runtime replacement.

Ship exactly these six rows. Presentation variants change only `storyteller.json`. A later instructed event can reuse supported kinds/requirements/resolvers through a new row and scene binding. New mechanics/requirements need typed source code and tests; no executable JSON conditions or arbitrary reward expressions.

## 5. Complete presentation content

### 5.1 JSON shape and tokens

`storyteller.json` has `version:1` and exactly `scenes`, `labels`, `media`. Each scene row is `{id, source, speaker, media, lines}`. `source` is one of `camp, delivery, journey, exploration, dungeon, market, forge`. `speaker` is `narrator` or an existing NPC ID. `media` is one of `camp, trail, discovery, dungeon, market, forge`. IDs are unique lowercase-hyphen keys; `lines` is a nonempty string array. Story data contains no arbitrary conditions, action scripts, HTML or mechanics.

Allowed token names are `town, destination, good, material, food, species, pattern, item, npc`. Values are source-owned display names. The fixed scenes below use only tokens actually supplied by their source. `formatStoryLine` replaces brace tokens as plain text; missing/unknown tokens are validation errors, not silently blank strings. Native Svelte text escaping is mandatory; no `{@html}`.

Each slash-separated quoted entry below is a separate `lines` array element, in the shown order. Use the strings exactly.

| Scene ID / source / speaker / media | Lines |
|---|---|
| `sounds-signs` / camp / narrator / camp | “The brush beyond the fire shifts. Fresh tracks lead away from Camp.” / “A silhouette stops at the edge of the firelight.” / “Something has disturbed the grass just outside Camp.” |
| `prowler-edge` / camp / narrator / camp | “A {species} circles the supplies, keeping beyond the fire.” / “Tracks end beside the supplies. A {species} is still nearby.” / “A {species} watches Camp from the tree line.” |
| `traveler-offer` / camp / narrator / camp | “A traveler with spare materials asks whether you can part with provisions.” / “A traveler offers road news and a small exchange.” / “A traveler pauses by the fire and lays out an offer.” |
| `traveler-return` / camp / narrator / camp | “The traveler you traded with returns and lays out a fresh offer.” |
| `nest-worksite` / camp / narrator / camp | “A nest beside the worksite has made the area unsafe to work.” / “The creatures near the nest keep returning to the worksite.” / “Movement around the nest has brought the work to a halt.” |
| `camp-found` / camp / narrator / camp | “A {species} has followed the traces back to Camp.” / “The tracks now lead toward your fire. A {species} has found Camp.” / “A {species} appears along the path into Camp.” |
| `cache-ledge` / camp / narrator / discovery | “A bundle of {material} is caught on the rocks. Some can be recovered carefully; reaching for all of it could spill your {food}.” / “Loose stones surround a bundle of {material}. You can take your time, risk the climb, or leave it.” / “Part of a {material} bundle hangs within reach. The rest lies above a narrow ledge.” |
| `cache-careful-result` / camp / narrator / discovery | “You bring the reachable materials down without disturbing your supplies.” |
| `cache-gain-result` / camp / narrator / discovery | “You secure the bundle and return with your provisions intact.” |
| `cache-mixed-result` / camp / narrator / discovery | “You bring some materials down, but part of your provisions falls between the rocks.” |
| `cache-loss-result` / camp / narrator / discovery | “The bundle slips away. Some provisions fall as you regain your footing.” |
| `cache-left-result` / camp / narrator / discovery | “You leave the bundle where it is and return to Camp.” |
| `cache-cancel-result` / camp / narrator / discovery | “The recovery ends. Any materials not yet collected are left behind.” |
| `delivery-request` / delivery / steward / market | “{town} needs {good}. Bring what you can before the request ends.” |
| `delivery-paid` / delivery / steward / market | “The goods are counted. Your payment is recorded below.” |
| `delivery-expired` / delivery / steward / market | “The request has ended. Earlier payments remain yours; the unearned completion offer has passed.” |
| `courier-request` / delivery / steward / market | “{destination} needs {good}. Will you take this request from {town} to them?” |
| `courier-accepted` / delivery / steward / market | “The request is yours. Bring the required goods to {destination} before it ends.” |
| `courier-paid` / delivery / steward / market | “The goods have reached {destination}. Here is the recorded payment.” |
| `road-result` / journey / narrator / trail | “Along the road, you find a brief opportunity.” |
| `site-inspect` / exploration / narrator / discovery | “There is something worth examining here.” |
| `site-result` / exploration / narrator / discovery | “You finish examining the site. The result is recorded below.” |
| `dungeon-entry` / dungeon / narrator / dungeon | “Beyond this entrance, the run keeps its spoils until it is resolved.” |
| `dungeon-result` / dungeon / narrator / dungeon | “The run has ended. These are the spoils retained and left behind.” |
| `market-greeting` / market / counterhand / market | “Let us see what your goods are worth here.” / “Check the buyers before you choose a road.” / “There may be a useful exchange among what you carry.” |
| `market-route` / market / counterhand / market | “Compare the buyers for {good}, then decide whether the journey is worth it.” |
| `market-promotion` / market / counterhand / market | “{item} costs less at this stall for the current cycle. The exact price and remaining time are below.” |
| `forge-greeting` / forge / armourer / forge | “Show me your materials, and we will see what can be made.” / “Choose the pattern first. I will tell you what it needs.” / “Good work begins with materials you can actually spare.” |
| `forge-ready` / forge / armourer / forge | “Your {material} can be used for {pattern}. The cost and resulting item band are below.” |
| `forge-blocked` / forge / armourer / forge | “This {pattern} is not ready to make. Here is what is still needed.” |
| `forge-result` / forge / armourer / forge | “{item} is finished. The materials spent and the piece produced are recorded below.” |

For the first five Camp families, the `lines` array elements are the exact variants; saved variant identity is `sceneId + "-" + zeroBasedLineIndex`. `traveler-return` is a separate ID. No new story branches beyond the current sounds warning→choice and the cache resolving/collect states are authored.

Add labels exactly: `investigate:Investigate`, `quiet:Stay quiet`, `fight:Fight`, `secure:Secure supplies`, `shelter:Shelter`, `pause:Wait it out`, `listen:Ask for news`, `trade-ore:Trade provisions for ore`, `trade-timber:Trade provisions for timber`, `decline:Send the traveler onward`, `cache-careful:Recover carefully`, `cache-quick:Reach for the whole bundle`, `cache-leave:Leave it`, `cache-collect:Collect recovered materials`, `cache-cancel:Abandon recovery`, `courier-accept:Accept request`, `courier-decline:Decline request`, `show-market:Open market`, `show-forge:Open Forge`, `show-deliveries:View requests`, `show-route:View route`. Also add `cache-title:Supplies on the ledge`, `signs-title:Movement near Camp`, `road-title:Along the road` and `dungeon-title:Dungeon run`. Existing quantity/reward/hand-in/repair labels remain in their controls.

### 5.2 Media presets

Use shelf icons through the existing `icon()` helper and `.icon-mask`, with source classes setting fixed placement/color. The preset definitions reference these glyph names only:

| Preset | Glyphs in back-to-front order | Base appearance |
|---|---|---|
| camp | `pine-tree`, `birch-trees`, `tent`, `rest-campfire` | `--ground-3`, `--glow-moss` |
| trail | `pine-tree`, `high-grass`, `adventure-bags` | `--ground`, `--glow-dusk` |
| discovery | `boulder`, `high-grass`, `adventure-bags` | `--ground-2`, `--gold` |
| dungeon | `boulder`, `adventure-bags` | `--ground`, `--dim` |
| market | `currency-strongbox`, `adventure-bags` | `--hud-face`, `--gold` |
| forge | `anvil-1`, `boulder` | `--ground-2`, `--hot-deep` |

These names already occur in the source/icon usage inspected for this plan except `anvil-1`, which is the existing TownHub Forge mark. ST-01 validates every glyph through the actual icon index. Missing required art is a failed data check; the runtime still has a usable text fallback if an image fails to load. No invented NPC portrait or standalone SVG icon is permitted.

## 6. Camp implementation contract

### 6.1 Pure helpers and saved shape

Add these pure `createFieldwork` methods; they accept plain data and never create an RNG:

~~~ts
selectCampVariant(input: {
  seed: number; serial: number; eventId: string;
  variantIds: readonly string[]; recentIds: readonly string[];
}): string;
cacheOffer(zone: number, regionalFoodId: string, draw: number): CacheOffer;
cachePreview(offer: CacheOffer, choice: 'careful' | 'quick'): CachePreview;
cacheResult(offer: CacheOffer, choice: 'careful' | 'quick'): CacheResult;
~~~

Require finite `draw` in `[0,1)` and a positive-integer `unitYield`. Freeze `quickOutcome`; the types below define the remaining `CacheOffer` fields. Compute `carefulSec = ceil(cache.careful_intervals * actions.mine.interval_sec)`. Quantities are integer products of the configured multiplier and `actions.mine.yield`; data validation rejects non-integer/nonpositive yield.

Result types:

~~~ts
type CacheOffer = {
  revision: 1; foodId: string; materialId: string; unitYield: number;
  carefulSec: number; quickOutcome: 'gain' | 'mixed' | 'loss';
};
type CachePreview = {
  choice: 'careful' | 'quick'; timeSec: number; maxFoodLoss: number;
  outcomes: readonly {
    id: 'careful' | 'gain' | 'mixed' | 'loss';
    chance: number; materialCount: number; foodLoss: number;
  }[];
};
type CacheResult = {
  outcome: 'careful' | 'gain' | 'mixed' | 'loss';
  materialCount: number; foodLoss: number; sceneId: string;
};
~~~

`CachePreview` reports time cost, all possible material grants, outcome probabilities and maximum food loss, derived as the maximum `food_loss` in the outcome table. The supply at risk is the origin zone's `regional_sources[zone].food`; there is no second loss-budget constant. `CacheResult` reports only the frozen selected outcome: material grant, food loss and result scene ID. Careful always uses `cache-careful-result`, grants its configured yield and loses no food; quick uses its frozen outcome and the corresponding result scene. The UI formats these facts; it does not recompute weights or amounts.

Extend the existing Camp types in `world/fieldwork.ts`:

~~~ts
type CampEncounterKind = CampPoolKind; // import type from engine/types.ts
type CampEncounterStage = 'warning' | 'choice' | 'combat' | 'resolving' | 'collect';
type CampStoryHistory = {
  encounterId: number;
  eventId: string;
  kind: CampEncounterKind;
  variantId: string;
  terminalAction: string | null;
  followupUsed: boolean;
};
type CampStoryInstance = {
  revision: 1;
  eventId: string;
  sceneId: string;
  lineIndex: number;
  beat: number;
  cache: CacheOffer | null;
  remainingSec: number;
};
~~~

Add `story:CampStoryInstance | null` to `CampEncounterActive`. Keep its existing ID, origin, prepared group, participant IDs and countdown fields. Add `storyHistory:CampStoryHistory[]` and `lastReceipt:CampStoryReceipt | null` to `CampEncounterState`. Legacy `recap` remains populated for old consumers/tests.

`CampStoryReceipt` is `{encounterId, eventId, kind, action, sceneId, elapsedSec, paid, earned, lost, info}`. Each resource array contains `{bucket:'food'|'material', id, count}` with positive integer counts; empty arrays mean no effect. `info` is a string array for real survey/termination facts. A receipt describes committed effects, never a payable promise. Keep only the latest Camp receipt.

### 6.2 Selection and creation order

1. Use the existing eligibility snapshot on both sides of the world tick. Do not open events on the same tick that a walk, fight or Push recovery ends.
2. Preserve grace/check/chance/cooldown/exposure behavior. Build the closed facts and eligible pool from 4.5; it preserves all five original conditions and adds only the specified cache condition.
3. Apply the exact repeat/weighted-selection process in 4.5.4. The six initial weights are equal; use the current one selection draw, not an additional template draw.
4. Prepare any existing hostile group using the current code, before decorative selection. Add no new combat RNG calls.
5. Freeze the selected event ID and attach its deterministic story variant. Append one history record including event ID and trim from the oldest end to `recent_limit`.
6. For cache only, consume one extra draw to create its frozen offer. Cache has an empty prepared group and does not interrupt fieldwork.
7. Use the current warning/choice durations for cache too. Cache never auto-fights under any policy; timeout closes neutrally with ordinary cooldown.

Keep `eligible`, Camp safety and hostile work interruptions, with only the specified cache/repetition changes. Returning alone does not trigger an event. Replace the hardcoded `candidates` push-list with source facts/payloads around the data pool.

### 6.3 Legal action matrix

Keep the current `CampEncounterAction` values for compatibility, but expose only legal implemented actions. `follow`, `relocate`, `dismiss` and aid aliases that currently have no applicable handler remain unexposed; do not invent behaviors for them.

| Kind/stage | Exposed actions | Result owner |
|---|---|---|
| sounds / warning | investigate, quiet | Current survey and transition/close |
| sounds / choice | fight, quiet | Current prepared fight or current quiet close |
| prowler / warning or choice | fight, secure | Current fight or supply-securing behavior |
| nest / warning or choice | fight, pause | Current fight or wait close |
| discovered / warning or choice | fight, shelter | Current fight or exposure reset/shelter |
| traveler / warning or choice | listen, trade-ore, trade-timber, decline | Current survey/barter/decline; all four actions remain reachable |
| supply-cache / warning or choice | cache-careful, cache-quick, cache-leave | New explicit actions below |
| supply-cache / resolving | cache-cancel | Cancel unfinished work; no reward |
| supply-cache / collect | cache-collect, cache-cancel | Claim one completed result or abandon it |
| any / combat | Existing ordinary combat/retreat controls only | No storyteller payout or second fight button |

Use a nested native `details` titled “Trade provisions” to hold the two barter buttons; keep news and decline as primary actions. This achieves a short primary menu without removing either trade.

Extend `chooseCampEncounter` by an optional fifth argument `expected?:{beat:number; stage:CampEncounterStage}`. All new UI calls pass it. Existing callers without it retain their current behavior; the active ID and existing legal-action checks still apply. With it, refuse a mismatch before any mutation. Increment `story.beat` on every successful transition only. A refused action may increment a host-local display error revision, never the saved beat/history.

### 6.4 Atomic cache outcomes

For quick, preview all configured outcomes. Require current food count ≥ maximum food loss and check `fitsTransaction` separately for every possible combined cost/loss/grant transaction, not only the secretly frozen outcome. A refusal changes no inventory, offer, clock, stage or RNG.

Once accepted, construct the selected receipt first, then synchronously apply the selected food loss and material grant, store the receipt, mark history terminal, close once and start the normal cooldown. `paid` is empty because quick has no guaranteed fee. Conditional food removal is `lost`. A gain-only result has an empty `lost` array. A mixed result has both `earned` and `lost`; a loss-only result has no `earned`.

Careful requires all possible careful grants to fit before starting and requires no food. It sets `stage:'resolving'`, `remainingSec:offer.carefulSec`, both unanswered-choice timers to zero and no immediate inventory delta. Record no completion receipt yet.

At each subsequent online Camp tick:

- Check still at Camp and ordinarily eligible first; otherwise cancel unfinished work with elapsed time only.
- In `resolving`, decrement remaining time once, not on the commitment tick. Do not process warning/choice policy timers.
- At zero, recheck grant capacity. If it fits, grant once and finish. If not, set `stage:'collect'` with zero time, retain the single completed result and show capacity refusal.
- `collect` has no deadline and opens no new Camp event. Collection rechecks current capacity, grants once and closes; it never charges more time or changes outcome.
- Leaving, Push or starting an incompatible activity discards the uncollected reward at the next Camp lifecycle check; explicit cancel does so immediately. Already elapsed time is the only cost. Cancel sets the ordinary cooldown and a neutral/cancel recap, not an inventory loss.
- Offline calls preserve the state exactly, including zero-time pending collection. Read-only tabs cannot commit, cancel or collect.

The receipt's elapsed time is `offer.carefulSec - remainingSec`, capped to the original duration; `collect` uses the full duration. Instant quick and neutral exits report no invented time fee. New safe actions do not resume or alter another field activity. For timed-work eligibility specifically require `eligible(s) && !s.fieldwork.action`, because the existing general Camp gate permits gathering. History terminalAction values are the actually committed legal action IDs, plus `timeout`, `cancelled`, `combat-won` and `combat-pushed` for source-owned terminal transitions. Cache abandonment uses `cache-cancel-result`.

### 6.5 Existing effects and deterministic receipts

For legacy choices, retain the old mutation order and set structured receipt fields from their actual results. Traveler barter reports its existing food cost under `paid` and material grant under `earned`. Map news reports newly revealed cell count by comparing the actual journal sets; if none changed, say “No new nearby map information.” Do not pay a substitute reward.

Combat start emits status only. Combat completion/Push uses the current combat outcome; Camp receipt has no duplicate kill, loot, XP or currency grant. Preserve existing combat cancellation notes. The new text layer does not change defensive policy or the normal retreat rules.

## 7. Shared UI contract and exact rendering

### 7.1 Types

Put these presentation-only types in `ui/story/story-scene.ts`. They import no simulation modules.

~~~ts
type StorySource = 'camp' | 'delivery' | 'journey' | 'exploration' | 'dungeon' | 'market' | 'forge';
type StoryTone = 'normal' | 'good' | 'loss' | 'muted';
type StoryFact = { id: string; label: string; value: string; tone: StoryTone };
type StoryAction = {
  id: string;
  label: string;
  kind: 'commit' | 'navigate' | 'dismiss';
  disabled: boolean;
  reason: string;
};
type StoryView = {
  key: string;
  source: StorySource;
  mode: 'decision' | 'receipt' | 'greeting';
  heading: string;
  speaker: string;
  media: 'camp' | 'trail' | 'discovery' | 'dungeon' | 'market' | 'forge';
  line: string;
  facts: readonly StoryFact[];
  actions: readonly StoryAction[];
  error: string;
};
type StoryIntent = { key: string; actionId: string };
~~~

Export these types. `StoryScene.svelte` props are `view:StoryView`, `onaction:(intent:StoryIntent)=>void` and `controls?:Snippet`. The optional Svelte snippet embeds existing working controls; it is not a custom form schema. There are no arbitrary HTML, renderer callbacks inside JSON or opaque domain objects in the view.

### 7.2 DOM, appearance and focus

Render a native `section.story-scene.card-read` with `data-story-source` and `data-story-key`. Inside, in order: media, `header` with speaker and `h3` heading, one narration `p`, `dl` fact rows, controls snippet, action row, and error/status text.

- Use media only in `decision` mode. Receipt and greeting modes are compact and omit the media area. No popup or overlay is created by this component.
- Media is decorative, `aria-hidden="true"`, source-class driven, `aspect-ratio:16/5`, `overflow:hidden`. Fixed glyph placement is CSS in the component; only the glyph URL binding uses inline runtime data.
- Use existing `--card-pad`, `--card-gap`, `--spacing-sm`, `--font-sm`, `--font-xs`, `--radius-card`, `--sheet-ink`, `--gold-lit`, `--good-lit`, `--alarm` and `--dim`. No new root tokens or copied hex colors.
- Apply shared `btn btn-quiet` to ordinary actions, `btn btn-gold` to the single primary commit, and `btn btn-flat` to navigation/dismissal. Existing controls retain their classes.
- Facts use text labels plus color; positive/negative meaning cannot rely on color alone. Display “Cost”, “Possible gain”, “Maximum loss”, “Paid”, “Earned”, “Lost”, “Time” or the source-specific factual label.
- Native buttons have `type="button"`, `data-story-action`, disabled state and a visible reason linked with `aria-describedby`. They are reachable in DOM order; no custom arrow-key system or numeric hotkeys.
- Heading has `tabindex="-1"` for intentional focus restoration, not routine render focus. On a manual beat transition, retain focus on the same action ID if legal; otherwise focus the next legal action, or heading if no actions remain. Automatic receipts never steal focus.
- One small `role="status" aria-live="polite"` announces a **new** receipt key or the manual action error. Do not make countdown/fact rerenders live. Preserve existing urgent alerts outside this view.
- No animation, typewriter effect, audio node, forced read delay or whole-scene reduced-motion exception is added.
- A failed art image leaves heading, narration, controls and facts intact. Hide the failed decorative glyph; do not display a broken-image placeholder.

Fixed media roles: four glyphs map to `left,right,anchor,accent`; three to `left,right,anchor`; two to `left,anchor`. In component CSS use absolute positions (percent of the media box): left `left:4%;bottom:0;width:34%;height:90%;opacity:.3`; right `right:4%;bottom:0;width:30%;height:80%;opacity:.25`; anchor `left:39%;bottom:0;width:22%;height:64%;opacity:.85`; accent `left:64%;bottom:0;width:10%;height:28%;opacity:1`. All use contained, nonrepeating masks. Background/accent tokens follow section 5.2; no runtime placement controls or extra art options are added.

Headings: Camp uses its existing kind title except `sounds` uses `signs-title` and cache uses `cache-title`; delivery uses the good's display name with source/destination shown as facts; market uses settlement name; Forge uses selected pattern name or its existing Forge title; road uses `road-title`; site uses its authored kind name; dungeon uses `dungeon-title`. Source names remain authoritative. Format currency with the existing town currency precision, item counts with existing number formatting, and countdowns with the host's existing timer formatter. Facts label paid/lost values as losses and actual received values as gains; conditional opportunities remain visibly conditional.

Use a local synchronous in-flight guard for the current commit key. Hosts revalidate the intent key and source preconditions before mutations. The guard is not payment idempotence: domain checks in section 12 remain required. Navigation remains possible in read-only mode; mutating controls remain writer-gated by their current host and source.

## 8. Source mappings, NPC greetings and App integration

View keys use the source plus its existing occurrence and relevant displayed revision: Camp ID/beat/stage; delivery ID/status/delivered/acceptance/quantity/reward choice/quote gold; market quote token; Forge kind/pattern/material/held/free slots; road/site last-event source/time/location/text hash; dungeon run start or final receipt key. Hosts append a local error revision when showing a failed-action reason. Do not include the continually changing clock unless it changes a price/status/commit precondition; ticking a display countdown alone must not reset focus or replay receipt announcements.

Put explicitly named read-only mappings in `story-presenters.ts`: `campStoryView`, `deliveryStoryView`, `roadStoryView`, `siteStoryView`, `dungeonStoryView`, `marketStoryView`, `forgeStoryView`. They receive the source state/preview and formatting helpers needed by that mapping. There is no dynamically registered adapter list. They emit formatted values, never call a commit, create a contract, initialize saved state or consume RNG.

| Host | Replacement and exact actions kept |
|---|---|
| `MapJourney.svelte` | Replace its Camp encounter section/recap framing with `StoryScene`. Keep Locate Camp and policy selector outside; wire to `doCampEncounter` and `doCampPolicy`. Nested barter controls follow 6.3. |
| `DeliveryNotice.svelte` | Replace its request heading/text/fact/action frame with the shared view. Existing Track want, View delivery and Dismiss intents retain their effects. Existing Panel visibility/closing behavior in App remains; add no extra popup source. |
| `DeliveryBoard.svelte` | Keep the list, history, quantities, `QuestBonusPicker`, shortage tools, pin/track and partial-hand-in controls. Replace each contract's narrative/preview/actual-recap frame with shared views; there is only one hand-in button for a contract in that view. |
| `Market.svelte` | Keep all tabs, price table, quantity, cargo filters, buyer comparison and ordinary buy/sell controls. Add a compact shared NPC context above the current working section and use the shared view for the selected promotion's facts and existing purchase intent. |
| `TownHub.svelte` | Replace the market/Forge service's decorative greeting text with compact shared greeting views; keep existing service-row navigation and service labels. Do not add a required conversation before `onopen`. |
| `inventory/Forge.svelte` | Keep pattern/family/material selectors, material sources, shortage goals, forge/salvage controls and result item access. Shared context reflects the selected `canForge` verdict; result reflects the returned item. Keep one existing Forge commit control, embedded in the snippet; do not add a second “confirm” button. |
| `TravelCard.svelte` / journey context | Use a compact road receipt from `mapJournal.lastEvent`. Keep map arrows/Enter, destination actions and arrival behavior. Suppress the old duplicate last-event text where the shared receipt is shown. |
| Existing trail-site action in App | Keep `doInvestigateTrailSite` / `investigateTrailSite` call path and map controls; show site inspection/results through the shared view. Use the existing callback rather than adding another action route. |
| Dungeon controls in App/TravelCard | Present entry/active transition facts and final receipt through the shared view; retain existing enter/retreat controls, arena and immediate action semantics. No mandatory confirmation dialog. |

`App.svelte` keeps `doBuy`, `doTrade`, `doProcess`, `doDelivery`, `doRepairGear`, `doCampEncounter` and `runForge` as the live action routes. Extend payloads only with the expected source revision/quote fields specified below. Continue current `transactionWriter` / `requireAccountWriter` guarding and `gameState={...gameState}` updates. Successful action callbacks pass the actual returned receipt to the view; opening a result view cannot invoke them again.

Do not change `HudRegionId`, `HUD_REGION_META`, `DEFAULT_HUD_LAYOUT`, `PANELS`, `RAIL` or saved layouts: all scenes live in existing hosts. Existing `JourneyNotices` urgency, errors and navigation remain.

### 8.1 Greeting selection and identity

Greetings use current facts only. The context key and chosen line are pure:

`lineIndex = storyHash32(seed + "|" + townId + "|" + npcId + "|" + contextKey + "|" + cycle) % lines.length`,

where `cycle=floor(clockSec / storyteller_promotions.cycle_sec)`. A changed context legitimately changes the line; rereading the same context does not. No “welcome back”, gratitude, friendship or remembered promise is generated without an actual retained source record.

Fixed NPC attribution: market → `counterhand`; Forge/repair → `armourer`; local/courier requests: material goods → `armourer`, food → `counterhand`, herbs → `herbalist`, junk → `steward`. Save the request's issuer ID at creation. The request/receipt's `speaker` is overridden by this actual issuer; use its display name from `npcOf`.

Context priority is, in order:

| Host | First matching context |
|---|---|
| Market | Latest actual result produced in this host → currently selected active promotion → selected carried good/current quote → generic greeting. |
| Forge | Latest actual Forge result produced in this host → selected valid Forge plan → selected invalid plan with its exact refusal reason → generic greeting. |
| Delivery | Selected contract and its actual status: unaccepted courier / accepted courier / local open / actual partial/completed payment / expired. |

Use source scenes from section 5. A merely open request is not accepted, completed or paid. A market promotion cannot speak as if the player has already bought it. Read-only previews can greet but cannot alter announcement/acknowledgement state.

### 8.2 Structured automatic receipts

Keep the existing `mapJournal.lastEvent` fields `q,r,text,atSec` and add optional `source:'road'|'site'`, `resourceDeltas` and `hungerDelta`. Extend `resolveTravelEvent` with an optional receipt sink callback so its old string/null return and RNG sequence stay intact. The actual pickup/restore branch calls the sink once with received amounts, including zero/bag-full; `advanceWalkStage` attaches these fields to its one existing last-event record. Do not call the resolver twice or parse its text.

`investigateTrailSite` writes the same optional fields from the actual pickup/restore it already performed. Preserve its existing partial-pickup and claim semantics; do not apply the cache's all-outcome capacity rule to exploration.

Add optional `startedAtSec` to `DungeonRun` and set it on new entry; old runs normalize it to saved `clockSec` without changing loot. Add `lastDungeonReceipt` to `GameState`, initially null: `{key,zone,atSec,reason:'cleared'|'retreated'|'pushed'|'left-zone',kept,forfeited,uncollected}`. Each bucket is a positive-entry resource list derived from actual escrow before/after and actual pickup results. Use the existing rescue/roll selection exactly once. For a cleared run, capacity-refused loot is `uncollected`; for a retreat, nonselected escrow is `forfeited`; Push/zone departure forfeits remaining escrow. This is a read-only latest result, never a claimable inventory queue.

Add `gear:{processed:number;retained:number;salvaged:number;rejected:number;forfeited:number}` to that receipt. Resource list entries use `{bucket:'junk'|'stone'|'herb'|'potion'|'material',id,count}`. Record gear forfeiture/rejection separately as counts, not fabricated item IDs. Snapshot ordinary stacks before payout/rescue; capture actual resource deltas before gear processing, then include any actual salvage-resource deltas. For each existing `adjudicateDrop` call, observe its returned state once: if that exact item object is retained in bag/gear, count retained; otherwise if the salvage counter rose, count routed-to-salvage; otherwise count rejected. Label salvage as processing, not retained equipment. No second filter invocation or new RNG is allowed.

Capture a dungeon receipt at the actual `payoutStacks`/`retreatDungeon`/`abandonRun` boundary before run data is discarded. Use `key = "dungeon:" + zone + ":" + startedAtSec + ":" + reason`. Preserve existing string log messages and counters. Receipt constructors must not request new random draws.

Market/Forge results are transient host-local values sourced from the already successful return, cleared by changing the selected working context or closing the host. Do not add a saved global story log. Existing delivery paid/last-hand-in records and Camp's latest receipt remain their own saved result owners.

## 9. Promotions and purchase consistency

### 9.1 Pure quote algorithm

Extend `createTrade` with `townPromotion(seed, townId, clockSec, stockedRowIds, config)` and `serviceGold(minutes, incomePerMinute, hagglingXp, discountPct=0)`.

`townPromotion` validates a known town and nonnegative finite clock. `cycle=floor(clockSec/config.cycle_sec)`. Filter the configured eligible row IDs against stocked IDs in configured order. If empty, return null. Otherwise let `start=storyHash32(seed + "|" + townId) % eligible.length` and select `eligible[(start+cycle)%eligible.length]`. Return `{id:"promotion:"+townId+":"+cycle+":"+rowId,townId,rowId,cycle,expiresAtSec:(cycle+1)*cycle_sec,discountPct}`. No state/RNG/cache mutation.

`serviceGold` moves the existing ordinary service calculation into the shared engine: calculate raw minutes × reference band income × existing Haggling `serviceMult`, multiply by `1-discountPct/100`, then round once to the existing currency precision. Its zero-discount output must equal the old `priceGold` output for every existing town/row fixture. `normalGold` is that same zero-discount result; do not discount an already rounded display value.

`pricing.ts` retains existing `priceMinutes` and charge-band/teaching-discount selection. It passes the resolved inputs to the shared helper. Introduce `quoteTownPurchase(state,settlementId,rowId,target?:{where:'gear'|'bag';index:number})` in `pricing.ts` returning `{normalGold,gold,promotion,token}`; `priceGold` returns its `gold`. With no state argument, there is no timed promotion and Haggling remains the current default. All prices displayed with state, `canBuy` and both repair paths use this helper.

The purchase token is stable serialization of `[settlementId,rowId,promotionIdOrNull,gold,state.counters.gold,ownedCountForRow,collectorHintPurchasedForRow,repairTargetFingerprintOrNull]`. Validate finite values before serialization. For repair, include the resolved target's where/index/whole-item fingerprint and broken flag in the expected token; never assume an Item ID. Stock/affordability/target checks still run at commit; a token is not authorization.

Move the current pure `firstBroken` lookup from `town.ts` into `pricing.ts` and import it back into town flow; do not duplicate its selection order. A repair quote without an explicit target uses this existing first-target order. A chosen repair quote resolves its supplied target. Its fingerprint is `[where,index,JSON.stringify(item)]`; absent target is null. No UI module is imported into the sim.

### 9.2 Source APIs and stale quotes

Define `TownPurchaseExpectation={token:string;target?:{where:'gear'|'bag';index:number}}`. Add optional `expected?:TownPurchaseExpectation` to `canBuy`, `buy` and `repairGear` after their existing arguments. Existing non-UI call sites can omit it for compatibility. Every live UI purchase and repair passes the displayed token and its repair target when applicable; update the existing `onbuy` and repair callback payloads and their direct callers. Do not create a second purchase route inside `StoryScene`.

`canBuy` recomputes the token using the expectation's target; ordinary `buy` still resolves the current first broken target and passes the same expectation through `repairGear`, which requires any supplied target to match its actual where/index. A supplied token mismatch returns `{ok:false,why:"The offer changed. Review the current price."}` before any gold/item/owned/repair mutation. Refresh the preview; do not automatically retry. Promotion expiration, Haggling changes, another purchase and a changed repair target are covered. If the first successful action changes its preconditions, a repeated stale intent is refused.

Successful result adds `normalGold`, `gold`, `promotionId` and `savedGold=normalGold-gold` from the committed quote to the existing return. Repair wrappers preserve these fields. Render “Normal price”, “Current price”, “Savings” and remaining simulation time for a promoted row. Non-promoted rows keep their current price display.

The promotion expires by `state.clockSec`, including its normal offline advance. It does not use `Date.now`, the real-day pedlar clock or a separate heartbeat. Reload/open cannot refresh it. Outside the allowlist, Black Market prices, selling demand, service stock, Forge material costs, Waypoint fares and progression purchases must be byte-for-byte/number-for-number unchanged in the regression fixtures.

## 10. Local requests and cross-city delivery

### 10.1 Contract shape and saved fields

Extend the existing `DeliveryContract` with:

~~~ts
kind: 'request' | 'courier';
destinationTown: string;
issuerNpcId: string;
acceptedAtDeliverySec: number | null;
offeredAtDeliverySec: number;
endReason: 'expired' | 'declined' | null;
~~~

`town` remains the issuing/source town and storage key in `town.contracts[town]`. A local request has `destinationTown===town` and `acceptedAtDeliverySec===null`; it remains actionable without accepting it. A courier has a distinct destination and requires acceptance at the source.

Add to `TownState`: `courierSerial:number`, `courierStreamState:number` and `courierTriggerRemainingSec:number`. Keep local `contractSerial` untouched by courier generation. Local IDs remain `delivery:<town>:<contractSerial>`. Courier IDs are `courier:<town>:<courierSerial>`. Both use the existing `serial` field for their own namespace; normalization tracks uniqueness separately by kind. No courier increments the local serial or changes local fixed/choice reward alternation.

Keep existing contract statuses `open/completed/expired`. `endReason` is null for open/completed, expired or declined for terminal expired contracts. A declined offer is not a fulfilled request and pays nothing. Existing expired contracts normalize `endReason:'expired'`.

### 10.2 Tick and generation

Add `tickCourierOffers(state, online, pausedAtStart, access)` to `delivery.ts` and call it at the end of the existing `closeSecond` source work, after Camp and before its current `finally` finalization.

1. Return without mutation for a nonwriter or disabled courier config. Countdown/generation require online and unpaused-at-start. A due offer can be attempted only at a visited settlement with no walk, hunting, living fight, dungeon, Camp recovery or active fieldwork.
2. Existing `tickDeliveries` advances the common clock and expires **both** request/courier contracts, setting `endReason:'expired'` on that timeout. Already terminal/declined records are unchanged. It continues generating local requests exactly as before, counting only `kind:'request'` against local active slots. It never accepts, generates or assigns RNG to a courier.
3. If any open courier exists anywhere, leave courier countdown unchanged and do not draw. Otherwise decrement the single countdown toward zero on every online, unpaused eligible-clock second, including while traveling/gathering. When it reaches zero outside an eligible source settlement, keep it at zero without drawing until a source becomes eligible.
4. At zero, reset to `delivery.trigger_interval_sec * courier.trigger_interval_mult` even if no offer can be formed. If no viable destination/target exists, consume no courier-stream draw.
5. Candidate destinations are distinct visited settlements, sorted by settlement ID. For each, use the current `deliveryCandidates(state,destination)` and acquisition context, which starts at the actual origin location. Exclude empty candidate sets. Keep existing level, source, deadline/max and count constraints.
6. Begin one courier-stream attempt. Draw chance first against `min(1,delivery.trigger_chance*courier.trigger_chance_mult)`. On failure, stop. Then draw destination uniformly in the sorted list, target with the existing target weights, count with the existing bounded count/shrink loop, and reward draws in the existing reward-builder order.
7. Refactor the existing reward-building block into a local helper parameterized by payment town, reward mode and permanent-reward eligibility. The local request path calls it with its original arguments/draw order and must retain exact seeded outputs.
8. Courier calls the helper for destination pricing, mode `fixed`, no milestone and no attainment. Retain the existing stone/optional useful-skill/fallback calculations, intrinsic difficulty, Haggling and gold bonus; no distance bonus or alternative reward. Consume the helper's normal attainment/reserved draws but discard their point result, so its draw order is explicit. `treePoints=0`, `attainment=0`, `milestone` and `alternative` absent.
9. Set deadline at creation with the existing `delivery.deadline(acquisition)` added to the current delivery clock. Require it ≤ existing deadline max. Do not restart it at acceptance.
10. Append one source-town courier contract with `offeredAtDeliverySec` equal to the current delivery clock, `acceptedAtDeliverySec:null` and `endReason:null`; local requests use `offeredAtDeliverySec:0`. Save issuer mapping, serial and frozen reward/route. Announced/recap defaults match local offers. Generation is independent of story views and does not open a new modal.

Couriers are optional requests to obtain/carry ordinary goods. The source does not grant inventory, reserve stacks or lend items. Goods can be acquired anywhere, withdrawn from storage and sent by any existing travel method; actual possession and destination are checked at each hand-in.

### 10.3 Accept, decline, hand in and settle

Add these two source functions, returning `{ok:boolean;why?:string}`:

- `acceptCourier(state,id,access)`: require writer, open unexpired courier, unaccepted, at its source and no incompatible active activity. Set acceptedAt to current delivery clock once; no goods/gold/reward/deadline change. Repeated acceptance refuses “This request is already accepted.”
- `declineCourier(state,id,access)`: require writer, open unexpired **unaccepted** courier, at source. Mark expired with `endReason:'declined'` and current terminal time; no item/gold change. The next generation still waits the saved cadence; decline cannot immediately reroll an offer.

Accepted couriers have no abandonment fee or special cancellation action. They can expire naturally; inventory remains the player's until an actual hand-in.

Extend `previewDelivery` / `deliver` with an optional expected snapshot `{delivered:number;status:'open';gold:number;acceptedAtDeliverySec:number|null}`. New shared UI hand-ins pass the current preview snapshot; old callers may omit it. Compare it before mutation and run existing validation again. A stale count/price/status refuses without payment. Use `destinationTown` for location, quote, source goods sale and acquisition destination navigation. Courier also requires acceptedAt not null. Local requests otherwise retain behavior.

Partial hand-ins remain allowed; each consumes the chosen amount and pays the current market value **at the destination** through existing `sellGoods`. Completion uses the frozen standard bonus once. Store actual `baseGold`, `lastGold`, `lastQuantity` and `paidBonus` exactly as today. Earlier paid market gold is retained on expiry. No new item loss, death, deposit or delivery fee occurs on decline, timeout, Push or leaving a town.

`trackDelivery` and acknowledgement remain existing source actions. Tracking is not acceptance. Closing/hiding a notice may mark announced through its existing Dismiss action, but never accepts/declines a courier. Read-only browsing never marks announced or acknowledges.

### 10.4 Boards, guidance and history

- Board rows appear when viewing the source **or** destination town; deduplicate by contract ID. Show “From <source> to <destination>” and acceptance/status. Store contracts only once under the source.
- Unaccepted courier: Accept and Decline work only at source; elsewhere show the source navigation action and reason. Accepted courier: hand-in at destination only, with current quantity/reward controls.
- `openDeliveryWant` browses destination for an accepted courier, source for an unaccepted courier, source for a local request. Pin/goal/acquisition helpers use the same destination rule. Existing shortage goals continue using the same delivery ID.
- Existing local auto-notice selection filters `kind:'request'`. Courier opportunities are inline in source TownHub/DeliveryBoard and journey notices, avoiding a second auto-popup.
- Keep history/pruning/folding under source town; order terminal rows by terminalAt, then kind, then serial. Apply the existing history limit separately to request and courier kinds so new couriers cannot evict unread local recaps earlier.
- Add `declined:number` to `DeliverySummary`, default zero and safe-nonnegative validation. Folding a declined courier increments unread/declined only, not completed/expired or forfeited reward totals. Show that count separately. Summary aggregation remains actual payments/forfeited promises. Never present declined/expired alternatives as combined paid rewards. Declined offers add no forfeited completion reward; expired accepted/unaccepted offers follow the existing forfeited-promise presentation and remove no inventory.
- Courier global active limit includes accepted and unaccepted open couriers. Paused time and offline expiration use the common `deliveryClockSec` rules exactly, while courier generation is online-only.

## 11. Save migration, defaults and validation

Implement this whole rollout under one schema bump from the then-current version. Add the comment describing storyteller metadata, cache resolution, courier contracts and latest dungeon receipts beside `SCHEMA_VERSION`. Do not rewrite existing migrations, account mastery, slot storage, backup logic or passive-tree version policy.

### 11.1 Defaults

- Change `newTown(seed=0)` to initialize `courierSerial:0`, `courierStreamState:(seed ^ storyHash32("courier"))>>>0` and `courierTriggerRemainingSec:delivery.trigger_interval_sec*courier.trigger_interval_mult`. Update `newGame(seed)` and `migrate` to pass the character's seed. Existing callers omitting seed remain valid.
- Camp defaults add `storyHistory:[]` and `lastReceipt:null`. New active instances include their frozen event ID and story metadata; legacy active instances may have `story:null`. Backfill missing event IDs only by the canonical kind→row mapping in 4.5, never by a new selection.
- New `GameState.lastDungeonReceipt` defaults to null. Legacy active dungeon gets `startedAtSec=state.clockSec`, preserving all existing run fields.
- `DeliverySummary.declined` defaults to zero and is validated with the other nonnegative summary counters. Existing local contracts backfill `kind:'request'`, `destinationTown:town`, issuer from the fixed good-bucket mapping, `acceptedAtDeliverySec:null` and `endReason` from their status. Never change target, reward, route, serial, deadline, delivered count or earlier payments.
- No promotion or greeting selection is saved. They are pure functions of canonical config, character seed, stock, clock and current context.
- Optional structured fields missing from a legacy map event do not invalidate its text. Render the old message; do not infer resource deltas from it.

Normalize Camp after current fieldwork defaults; normalize courier stream/countdown and extended delivery records inside `normalizeDeliveries`; normalize the dungeon receipt after the existing dungeon shape repair. Keep existing relative normalizer ordering, especially quest rewards, Black Market, map journal and passive tree checks.

### 11.2 Strict state rules

| Saved value | Required validation / response |
|---|---|
| Camp history | Array trimmed to configured limit; each valid record has a safe serial ≤ Camp serial, known kind, matching event ID, known variant/line, legal terminal action/null and boolean followup flag. Backfill missing legacy event IDs by kind, then drop invalid presentation-history entries only. |
| Legacy active Camp | Retain a valid prepared group/current fight and original timers. Derive a presentation fallback from existing kind/ID without RNG, survey or grant. Missing story metadata never cancels a valid legacy fight. |
| New cache | Known kind, revision 1, valid origin, no prepared/participant group, material ID equal to the canonical cache material, positive safe yield/duration exactly equal to the current revision-1 canonical cache values, regional food matching the saved origin's zone, allowed frozen outcome, nonnegative remaining time ≤ original careful duration. Only resolving/collect stages can have committed timed work; collect requires zero time. |
| Invalid/newer cache story revision | Cancel that prospective cache and apply normal cooldown; no inventory, gold, map or reward mutation. Keep already paid receipts as read-only records after validating their shape. |
| Camp receipt | Positive-entry resource arrays with known references, finite bounded elapsed time, valid source ID/action and known result. Invalid receipt clears the display record, not the inventory. |
| Courier scalar state | Safe unsigned 32-bit stream and nonnegative safe serial/countdown. Missing fields receive defaults; malformed supplied values fail through the existing delivery-save error boundary. Never reseed a valid zero stream. |
| Contract identity | `town` matches its single storage list. Request IDs/serials validate against `contractSerial`; courier IDs/serials against `courierSerial`. Uniqueness sets are namespaced by kind; duplicate full IDs always fail. |
| Destination/issuer | Valid settlement/NPC IDs. Request destination equals source; courier destination differs. Existing local records are backfilled before these checks. |
| Acceptance | Courier value is null or a safe delivery clock value between creation's effective clock and current delivery clock; completed courier must be accepted. Request acceptance is null. |
| Terminal state | Preserve existing completed/expired/progress/paidBonus invariants. Declined must be an unaccepted courier with zero delivered/payment, no paid bonus and terminalAt set. Open/completed have null endReason. |
| Rewards/routes | Keep all existing route, stone, skill, milestone and currency validation. Courier cannot carry alternative rewards or permanent points/milestones. Unknown/newer derivation remains a migration error, not a reroll. |
| Optional map receipt | Known road/site source, valid finite deltas and names. Invalid optional fields are removed while retaining valid legacy location/text/time. |
| Dungeon receipt | Known reason/zone and nonnegative clock; validate positive-entry known resource references and nonnegative gear counts. Invalid display-only receipt becomes null. It can never be paid. |

For courier acceptance validation, add `offeredAtDeliverySec:number` on new courier contracts; local/legacy requests set it to zero. Require `offeredAtDeliverySec <= acceptedAtDeliverySec <= dueAtDeliverySec` and ≤ current delivery clock. Do not compare the game's `triggeredAtClockSec` directly with the differently paused delivery clock. This field is a clock stamp, not another countdown.

`StoryData` uses exactly `{version:1,scenes:StorySceneRow[],labels:Record<string,string>,media:Record<MediaId,{glyphs:string[]}>}`. Token sets are closed per source: Camp = species/material/food; delivery = town/destination/good; market = town/good/item; Forge = material/pattern/item; journey/exploration/dungeon = no tokens. A renderer key includes no payable data that lacks source validation. Pool IDs live in Camp runtime metadata, not in a second presenter-owned selection store; include the frozen event ID in the Camp view key.

Use the existing export/import and save round-trip paths. Test native persisted JSON, not only `structuredClone`. Loading a save must never invoke selection, offer creation, purchase, payout, survey or new RNG draws.

## 12. Exactly-once actions and receipt semantics

Existing writer locks, domain IDs/transitions and expected preconditions enforce these actions; no universal transaction service.

| Action | Preconditions carried from the displayed view | Why a repeated stale action fails |
|---|---|---|
| Camp choice | Existing encounter ID plus expected beat/stage | First commit advances stage/beat or removes active. |
| Cache collect/cancel | Same ID, beat/stage and ordinary eligibility | First operation closes or transitions; no payable backlog. |
| Local/courier hand-in | Contract ID, previous delivered/status, actual quoted gold and acceptance stamp | First hand-in changes progress/payment/status; acceptance/expiry is revalidated. |
| Buy/repair | Exact purchase token, selected target fingerprint if repair | First payment, ownership/hint/target change or cycle expiry invalidates token; ordinary target checks still apply. |
| Forge | Selected kind/pattern/material, displayed held-material count and free-slot count | First forge changes material count/bag. Add an optional expected `{held:number;freeSlots:number}` argument after RNG to `forgeGear`; new UI passes it, stale values refuse before item RNG. |
| Market sale | Selected good/quantity, displayed carried count and actual quote | Add an optional expected `{carried:number;gold:number}` argument to `sellGoods`; new live sale UI passes it. Internal delivery calls use their own validated snapshot and the same commit path. |
| Trail-site claim | Existing site ID, current location/activity and not claimed | Existing claim guard rejects reuse. Do not invent a second claim action in a receipt. |
| Dungeon enter/retreat | Current run reference/entry conditions | Existing domain guard changes run state. Use the current selected run object in the host; no Item or run UUID service. |

The current `Item` type has no stable item ID. Do **not** add one for storyteller. Reuse [item-selection.ts](../../game/src/ui/inventory/item-selection.ts) in the UI to follow the selected object. For a quote token, fingerprint a target as `[where,index,JSON.stringify(item)]` after resolving the selection. This is a transient expected-value check, not a saved identity. Never dereference an assumed `item.id`.

Validate expected preconditions **before** a payment, RNG, mutation or receipt. Failed actions preserve the underlying state. They may update host-local error text and its view revision; that does not consume a gameplay beat, RNG or history slot. A changed error message is announced once, not once per countdown render.

A displayed receipt separates:

- `paid`: guaranteed resources/gold already spent;
- `earned`: goods/gold/points actually received;
- `lost`: conditional inventory reduction;
- `forfeited`: an unearned promise or unrescued escrow, explicitly labeled;
- `uncollected`: loot rejected by its existing pickup rule;
- `information`: real newly learned facts or neutral status.

Do not net all buckets into one misleading “profit” number. An alternative reward given up is not an inventory loss; an expired request does not claw back previous hand-in gold. No receipt contains a “claim” action unless it is the one active cache collection state specified in section 6.

## 13. Data validation and frozen content checks

`validateStoryData` accepts `raw:unknown` and `refs:{npcIds:ReadonlySet<string>}` and returns the validated `StoryData`. It throws a path-specific error for malformed input. Both the client seam and `tools/check.ts` call the same validator. The check pipeline separately scans existing `game/src/icon/**/*.png` basenames with the standard filesystem API and validates media glyph names; it does not import a Vite `import.meta.glob` module into Node.

Add these exact checks:

1. Version is exactly 1; only the specified top-level shape exists. All source/media values, speakers, scene IDs and action labels are known. Required scene IDs from section 5 are present; no duplicates.
2. Media is a map from the six named presets to `{glyphs:string[]}` in the specified order. Colors/placement remain fixed CSS classes. Required labels are a string map with the exact action IDs in section 5.
3. Every scene line is nonempty plain text, has only allowed braces/tokens for its source, contains no HTML/control characters and does not embed a probability, currency amount or combat number. Source-owned names may contain digits when substituted.
4. Camp configuration has positive safe history limit/duration/yield fields, a valid material/food reference path and the exact finite outcome IDs. Weights are positive finite; integer resource deltas cannot exceed the declared maximum or cause a negative inventory.
5. Every existing kind maps to its legal actions from section 6. Cache can never route to combat. Combat facts remain sourced from the existing fight; no story row contains a damage/cooldown/drop formula.
6. Promotion config has positive integer cycle length, `0<discount_pct<100`, unique existing repeatable allowlisted rows and no banned progression/Waypoint/pedlar row. At each stock list, the effective promoted choice is null or one of those actual stocked rows.
7. Courier config is enabled boolean, positive integer active limit/interval multiplier and positive finite chance multiplier. Its destination/target constraints call the current acquisition/deadline helpers.
8. Content data contains no schema-driven commands, arbitrary expressions, wall-clock triggers, arbitrary next-scene graph or new NPC IDs.
9. First-release content has the exact closed action/state routes in this plan; no unresolved next target, optional placeholder line or implementation-selected branch remains.
10. `validateCampPool` requires a nonempty array of closed-shape rows, unique lowercase-hyphen IDs, supported kinds, positive finite weights with a finite strictly increasing cumulative sum, unique known requirement enums and safe integer `0<=repeat_gap_events<=story.recent_limit`. An absent catalog is a data failure, not a reason to reinstate a hardcoded selection list.
11. A pool scene ID must exist among the validated Camp scenes. Required requirement sets by kind are exactly the minimum sets shown in the initial catalog; never allow a traveler row to omit its offer check or a threat/nest row to omit local-mob eligibility. The canonical first-release data fixture asserts the exact six IDs, bindings, weights and gaps shown in 4.5. Additional executable conditions, resource deltas, choice handlers and arbitrary fields in a row are rejected.
12. Catalog validation is called at the client seam and the existing `storyteller-contract` data gate using the same validated Camp scene-ID set. Every initial kind has its closed handler/action route from 6.3; `herd`/`injured` in the legacy enable list produce no candidate because they have no row. Scene variants and other domains' pools cannot supply a gameplay candidate here.

Register a new named `storyteller-contract` result in the existing `runChecks` output without renumbering other gates. Keep `--checks` read-only. Never use `--sync` to hide a contract mismatch.

## 14. Test matrix and fixed fixtures

Implementation must pass these tests using existing Vitest, Svelte and Playwright. This document supplies no runtime evidence or new test framework.

### 14.1 Focused files

| Test owner | Cases to add / preserve |
|---|---|
| New `game/tests/sim/storyteller-rules.test.ts` | Story/pool validators, closed tokens/IDs, exact initial catalog, hard eligibility, weighted boundaries, soft-repeat fallback, hash vectors, variant repetition, cache outcomes, promotion cycles/rounding and courier pure constraints. |
| Existing `tests/sim/camp-encounters.test.ts` | Every legacy action/policy, independent RNG, new cache neutral/gain/mixed/loss, timed work, capacity refusal/collection, cancellation, reload, stale duplicate, no extra combat reward. |
| New `game/tests/ui/story-presenters.test.ts` | All seven explicit source mappings; preview/receipt truth, token errors, ordinary versus conditional cost, alternative reward labels, writer availability and no source mutation/RNG. |
| Existing `tests/app/delivery.test.ts` / `quest-rewards.test.ts` | Byte-equivalent seeded local offers and old reward modes; partial/completion/expiry/ack; issuer metadata. |
| New `game/tests/app/courier.test.ts` | Generation/independent stream, global slot, acceptance, origin/destination/visited gates, partial destination sales, frozen bonus, no permanent reward, stale/duplicate, decline cadence, offline deadline and save migration. |
| Existing `tests/app/trade.test.ts` / `town-sinks.test.ts` | Exact old non-promoted prices/demand/currency credit; promoted live/commit quotes, expiry, Haggling and chosen repairs, refused stale expected token. |
| Existing `tests/app/forge.test.ts` | Unchanged costs/roll/XP, accurate preview/result, stale held/slot refusal before RNG, bag/full busy/writer host coverage. |
| Existing `tests/app/fieldwork.test.ts` / `exploration.test.ts` / `tests/ui/map-exploration.test.ts` | Road draw/order and automatic payout remain; real structured receipts; claim/pickup/location/keyboard behavior unchanged. |
| Existing `tests/sim/dungeon.test.ts` / `dungeon-retreat.test.ts` / `dungeon-rescue.test.ts` | One real rescue/payout, same RNG, correct forfeited/uncollected/processed gear receipt and no payment from viewing it. |
| Existing `tests/app/save-fidelity.test.ts` | Native persisted round trips and schema migration for all added saved states; valid old Camp/combat/local request preserved. |
| Existing `tests/app/guidance.test.ts` | Correct accepted/unaccepted courier navigation, no false acquisition destination, priority/alert preservation and no duplicated contract. |
| New `game/browser-tests/storyteller.spec.ts` | Actual shared component hosts, controls/focus/receipts, no extra confirmations, art failure, read-only and no console errors. |

Presenter tests compare the whole input state and RNG before/after repeated calls. Assert behavior, not just matching strings or copied properties.

### 14.2 Required deterministic cases

Use character seeds `7` and `73` for simulation comparisons. Algorithms also use these input boundaries, independent of the current numeric tuning values:

| ID | Setup / action | Expected result |
|---|---|---|
| T-01 | Hash empty string and `"courier"` twice | Empty returns `2166136261`; `"courier"` returns `2887494740`, both unsigned and without state/RNG access. |
| T-02 | Reopen each presenter repeatedly / change only rendering | Same offer, quote and future simulation RNG. A view-only run and a hidden-view run agree. |
| T-03 | Cache draw `0`, exact first cumulative boundary, exact second cumulative boundary, and `1-Number.EPSILON` | Table-order gain, mixed and loss intervals use `draw < cumulative/total`. Out-of-range/NaN refuses. |
| T-04 | Cache food below max exposure while frozen outcome is gain | Quick is unavailable/refused without revealing or changing the outcome; careful/leave remain usable. |
| T-05 | Any potential quick grant cannot fit | No food/material/stage/RNG change. After space is freed, same frozen outcome is used. |
| T-06 | Careful starts, online tick duration minus one, then final tick | No early reward; exactly one grant at completion. No unanswered timeout/policy transition during work. |
| T-07 | Fill bag after careful commitment | At completion, one collect state with zero time; no grant, reroll or new encounter. Free space and collect once. |
| T-08 | Leave/start incompatible work/Push while recovering or collecting | On the next Camp lifecycle check, cancel prospective reward, retain elapsed time only. A manual stale collect is refused immediately by eligibility. |
| T-09 | Offline ticks while cache is working/collecting | Camp work/timers/receipt unchanged, even though delivery deadlines can advance. |
| T-10 | Force each legacy threat policy and complete/push its prepared group | Same existing policy, one group and ordinary reward/Push ownership. |
| T-11 | Promotion at `cycle_sec-1`, exact `cycle_sec`, and after native save reload | Boundary rotates as specified; same cycle and seed never reroll. No eligibility fallback for an unusable promoted row. |
| T-12 | Buy/repair with old token after cycle, Haggling, gold or target changes | Refusal before payment/repair; updated token succeeds once. Unpromoted/Waypoint/pedlar prices remain old values. |
| T-13 | Local delivery generation with courier ticking disabled versus enabled but ineligible | Same local contract IDs, reward modes and world RNG; courier code consumes no world RNG. |
| T-14 | Only one visited town / no viable destination / full courier slot | No courier offer or stream draw; cadence behavior follows 10.2. |
| T-15 | Attempt acceptance remotely, after expiry, read-only, twice | Refusal with no goods/gold/deadline change; legal origin acceptance changes only acceptance metadata. |
| T-16 | Accepted courier handed in at source then at destination | Source refuses; destination consumes normal goods and pays actual destination market gold. Waypoint travel is valid. |
| T-17 | Partial hand-in, save/reload, complete, duplicate same preview | Partial market payments kept; frozen standard bonus once; duplicate stale preview refuses. No attainment/tree milestone reward. |
| T-18 | Decline at source then reopen / allow natural expiry online and offline | No item removal/payment; no immediate regeneration; common delivery clock controls expiry and pause. |
| T-19 | Two board contexts show one courier | One stored object/ID, same progress and one payment. Correct destination pin/goal. |
| T-20 | Trigger road/site/dungeon real result, then open/close receipt repeatedly | Same inventory, claimed flags, escrow, counters and RNG after viewing. |
| T-21 | Load legacy schema and each malformed new display-only receipt | Legacy playable state preserved; invalid display metadata dropped. Malformed payable contract/cache state follows section 11 without minting a reward. |
| T-22 | Use the initial pool with realistic idle/worksite facts, then disable cache and use empty history | Exact expected legacy eligibility is retained. For equal weights, each tested draw selects the same row as the old uniform index over that eligible order; one selection draw only. |
| T-23 | Give every base-eligible row a recent history record and a gap that excludes all; repeat with only one valid row | Explicit oldest-seen fallback terminates without reroll; singleton remains selectable. Local-mob, traveler and idle-cache hard requirements are never relaxed. |
| T-24 | Validate duplicate IDs, unknown kind/requirement/scene, wrong-source scene, zero/negative/NaN/overflow weight, fractional/too-large gap and executable/extra fields | Path-specific data failure before source mutation. The exact initial six-row catalog passes. |
| T-25 | Select a row, then reopen/reload/change inventory or selection weights; also import a legacy active group missing event ID | Same saved event/offer/outcome remains, with ordinary action precondition checks. No new pool draw, history entry or reward. Legacy identity backfills deterministically; unknown cache/legacy metadata follows the distinct rules in 4.5.5. |
| T-26 | Empty eligible pool; selection draws at zero, cumulative boundaries and the top valid endpoint; invalid nonempty draw | Empty pool creates no instance/serial/history and requests no selection RNG. Weighted boundary order is exact; invalid draw throws. Presenter calls leave every domain pool/RNG unchanged. |

For the economic bound, assert `maxCacheGrant / max(cooldown_sec,check_interval_sec) <= actions.mine.yield / actions.mine.interval_sec` from canonical data. Courier fixed completion bundles must equal the existing fixed local formula for the same quote/difficulty/Haggling inputs after excluding permanent bonuses; no route premium is invented. Promotions never affect prices outside the allowlist. These are release invariants; do not automatically tune numbers if they fail.

### 14.3 Browser fixtures and flows

Use App's existing `/__showcase#showcase-field` fixture mechanism for deterministic read-only and isolated writable scenarios. Select them through visible labeled controls on that route. Add no production route, debug account, persisted save or global test API.

Fixture labels are exactly:

- `Story: Camp warning`, `Story: Cache choices`, `Story: Cache working`, `Story: Cache bag full`, `Story: Cache results`.
- `Story: Delivery choices`, `Story: Courier unaccepted`, `Story: Courier destination`.
- `Story: Market promotion`, `Story: Forge ready`, `Story: Forge shortage`.
- `Story: Road result`, `Story: Site result`, `Story: Dungeon result`, `Story: Read-only`.

Use the same seeded source helpers, presenters and real host components. Existing App `transactionWriter` already allows isolated showcase samples except the read-only sample; preserve that mechanism and its no-save behavior. Isolated fixture callbacks call the real simulation entry points and mutate the fixture state only, never an account slot. Fixtures must not hand-write prices, rewards or success flags into view props. Fixture data may place a character or add owned test supplies in the isolated showcase, but must not write a game slot or claim production progress.

Add `storyteller.spec.ts` to the existing `hmr` project's explicit `testMatch` in `game/playwright.config.ts`. Preserve its viewport **1920 × 1080**, worker count, no retry and headless default. One tab per check; close it afterward.

Browser assertions:

1. Camp and delivery both render `[data-story-source]` from the same component; media/text/facts/actions appear once.
2. Tab/Enter operate existing controls, quantity input and radio reward choice; switching radio changes preview only, hand-in is the single commit.
3. Beat change preserves/relocates focus per 7.2. Automatic road receipt does not steal focus or stop walking.
4. Full bag, insufficient resources, read-only and stale action have visible reasons; failed actions change no source inventory/RNG.
5. Promotion expiry refreshes the quote and refuses a stale commit without silently charging the higher price.
6. Forge selectors and one forge button remain usable; shortage navigation and actual result remain accessible.
7. Site/map arrows/Enter retain their behavior. Dungeon entry/retreat keep one action and actual receipt cannot pay again.
8. Failed decorative image still leaves a complete usable scene. No audio elements, pending network narration, required reading step, modal queue or console errors.
9. Compare visible commit-action counts against the original Camp, delivery, sale/buy, Forge, site and dungeon controls. The storyteller adds no required commit/confirmation step.

Without a browser tool, use the dev server, focused tests and required Svelte check. Browser acceptance remains unverified.

## 15. Ordered delivery checklist

Old CAMP/STORY proposal IDs are superseded by this fixed sequence. All boxes remain unchecked until implementation and evidence exist.

| Step | Required work | Gate before next step |
|---|---|---|
| ST-00 | Read relevant owners/callers once, snapshot existing work with `git status`, run the focused existing baseline suites. Do not reset other sessions or create a branch/worktree. | Use the existing Camp, delivery, trade, Forge and save-fidelity commands from 16.2, excluding new test files that ST-01 has not created yet. Record existing failures as baseline; no unrelated fixes. |
| ST-01 | Add the exact Camp event catalog, JSON/schema/types/defaults and shared story/pool validators. Add all new saved fields/defaults and the one schema-bump migration skeleton now, so later commits do not require ad hoc schema choices. Implement the closed facts/filter/weighted-selector API plus pure hashing/cache/promotion helpers. | T-22–T-24/T-26, data validation, pure tests and typecheck pass for changed contracts. |
| ST-02 | Implement the single `StoryScene`, source view types and pure mappings, exact content/media and focus/action contract. | Presenter purity tests; render fixtures compile. |
| ST-03 | Replace the hardcoded Camp candidate push-list with the source-facts/data-pool pipeline. Integrate all five existing kinds/actions/receipts, freeze event IDs, and attach deterministic variants/bounded follow-up history. | Existing Camp lifecycle/policy/RNG regressions and T-25 pass. No second candidate catalog remains. |
| ST-04 | Add the one cache kind, declared immediate risk, timed recovery, collect/cancel and normalization. | T-03–T-10, native save round trip and cache resource-rate bound pass. |
| ST-05 | Implement shared promotion quote and update all live buy/repair callers with expected tokens. Preserve every non-promoted price. | T-11–T-12 and town/trade/repair regressions pass. |
| ST-06 | Integrate market/Forge/TownHub greetings, current quotes/plans and actual-result views. Keep working controls and panel wiring. | Forge/trade/presenter tests, Svelte check and relevant fixture interactions pass. |
| ST-07 | Integrate existing local request NPC attribution, shared notice/board framing and source-owned rewards. | Local seeded offers, partial/fixed/choice payouts, expiry, tracking and acknowledgement regressions pass. |
| ST-08 | Implement courier generation/stream/acceptance/destination settlement and update guidance/boards/history. | T-13–T-19, local RNG comparison and courier save tests pass. |
| ST-09 | Attach real road/site/dungeon receipts and integrate their shared view without adding gameplay prompts. | T-20, source RNG/counters/claim/escrow regressions pass. |
| ST-10 | Finish strict migration/unknown-version tests and native persistence for the complete rollout. | T-21 and existing save fidelity/storage/session suites pass; no old-save resets. |
| ST-11 | Complete showcase fixture wiring and Playwright flows at required resolution; remove the superseded narrative/action-frame markup only after each host is covered. | All browser assertions and accessibility/source-control checks pass. |
| ST-12 | Run final shared-data/type/UI checks once after the last relevant change; report acceptance, actual UI reuse, resource bounds and remaining failures. | All CE rows below have actual evidence; no automatic tuning or unrelated refactor. |

## 16. Acceptance and required commands

### 16.1 Acceptance matrix

| ID | Required evidence |
|---|---|
| CE-01 | Exact no-audio authored content, closed tokens, real NPC names and six shelf media presets validate. |
| CE-02 | One shared renderer is used by all seven sources; superseded framing removed, working controls retained. |
| CE-03 | All legacy Camp actions and semantics remain, including both trades, nest obstruction and discovered-Camp threat. |
| CE-04 | Cache gain-only, loss-only, mixed, careful and neutral results match preview/receipt with no negative inventory. |
| CE-05 | All-outcome affordability/capacity refusal is atomic and does not leak a rerolled opportunity. |
| CE-06 | Timed work/collection/cancellation/offline/reload follow the exact state machine. |
| CE-07 | Story views and decorative selection consume no world/combat RNG; existing prepared-group inputs remain. |
| CE-08 | Story receipts never issue a second combat, pickup, quest or dungeon payout. |
| CE-09 | Variants/kind repetition and one bounded returning-traveler continuation follow the closed algorithms. |
| CE-10 | Context greetings reflect actual source facts and never claim fabricated payments/memories. |
| CE-11 | Promotions use simulation time, exact stock allowlist, shared price formula and stale-token refusal. |
| CE-12 | Non-promoted prices, Waypoints, real-day pedlar, Black Market, Forge costs and market demand/credit are unchanged. |
| CE-13 | Existing local delivery seeded output and reward alternation remain; NPC metadata creates no extra reward. |
| CE-14 | Courier origin/destination, independent stream/global slot, acceptance and cadence follow section 10. |
| CE-15 | Destination partial/completion payments use ordinary goods and the existing fixed bonus once, without permanent points. |
| CE-16 | Decline, offline expiry, pauses, Push and navigation neither remove owned goods nor refresh an offer. |
| CE-17 | Cross-city board/guidance deduplicates and targets the correct source/destination. |
| CE-18 | Road and trail-site actual receipts retain current RNG, partial pickup and one-time claim semantics. |
| CE-19 | Dungeon clear/retreat/Push/departure receipts distinguish actual retained, processed, forfeited and rejected loot. |
| CE-20 | New schema/defaults/strict validation preserve old Camp fights, local contracts, items, gold and progression. |
| CE-21 | Duplicate/stale/read-only actions fail before effects; transient item selection uses existing identity helpers. |
| CE-22 | Keyboard/focus, visible unavailable reasons, image-failure fallback and urgent notices work at 1920 × 1080. |
| CE-23 | Showcase/Playwright assertions pass with no extra required confirmations, audio or console errors. |
| CE-24 | Cache economic bound and courier/promotion formula equivalence assertions pass from canonical inputs. |
| CE-25 | UI reuse evidence lists removed duplicated blocks and shared consumers; no claimed percentage without measurement. |
| CE-26 | No additional engine/framework/service, dependency, HUD region, real-day promotion, NPC relationship or unplanned content was added. |
| CE-27 | Camp's exact six-row gameplay pool is canonical data with typed eligibility/weights/gaps/scene bindings; choice/outcome formulas and narrative variants retain their existing owners. |
| CE-28 | Pool filtering/weighted boundaries/empty behavior are deterministic, pure and use only the one source-owned selection draw. No UI opening or failed action can reroll an event. |
| CE-29 | Soft-repeat exhaustion and singleton fallback terminate without bypassing hard eligibility or stalling permanently; existing trigger/cooldown/offline rules remain. |
| CE-30 | Saved pool identity, legacy backfill, unknown-binding behavior and all non-Camp source-pool policies pass T-22–T-26 without duplicate cost or reward. |

### 16.2 Implementation verification commands

Run the changed step's focused command from the repository root. These commands have not been run for this documentation task.

~~~powershell
node --experimental-strip-types --disable-warning=ExperimentalWarning tools/check.ts --checks
npm --prefix game run test -- tests/sim/storyteller-rules.test.ts tests/ui/story-presenters.test.ts tests/sim/camp-encounters.test.ts
npm --prefix game run test -- tests/app/trade.test.ts tests/app/town-sinks.test.ts tests/app/forge.test.ts
npm --prefix game run test -- tests/app/delivery.test.ts tests/app/quest-rewards.test.ts tests/app/courier.test.ts tests/app/guidance.test.ts
npm --prefix game run test -- tests/app/fieldwork.test.ts tests/app/exploration.test.ts tests/ui/map-exploration.test.ts tests/sim/dungeon.test.ts tests/sim/dungeon-retreat.test.ts tests/sim/dungeon-rescue.test.ts
npm --prefix game run test -- tests/app/save-fidelity.test.ts tests/app/save-storage.test.ts tests/app/save-session.test.ts
npm run check
npm run verify
~~~

For browser checks, start or reuse the existing HMR server at `http://localhost:5173`. If a new server is necessary, use `npm --prefix game run dev -- --host 127.0.0.1` as a hidden background process with the existing Windows process rules. Run:

~~~powershell
node game/node_modules/@playwright/test/cli.js test --config game/playwright.config.ts --project=hmr storyteller.spec.ts
~~~

Use existing screenshot/snapshot tools when available; no transcripts or synthetic production saves. Close each check's browser. Stop only a dev server started for this task; preserve shared servers.

Because shared engine, economy and save shapes change, run the existing full game test suite once at final integration (`npm --prefix game run test`). Do not repeat a passing full run without a relevant code/input change. A baseline or concurrent unrelated failure is reported with its original output, not repaired or retried without new evidence.

### 16.3 Implementation closeout

Report changed files, CE IDs with passed/unverified evidence, executed command results, source seed/fixture inputs, number/location of duplicate UI blocks removed, and any real blocker. Report actual before/after commit-action counts for Camp, delivery, market, Forge, trail-site and dungeon flows.

Live balance and UI performance remain unmeasured. Verify fixed values/invariants; changes to tuning, mechanics or scope require a separate instruction. Once all acceptance passes, update the checklist with evidence and link durable code/types/tests. Leave this specification for review; no automatic deletion, index restoration, commit or push.
