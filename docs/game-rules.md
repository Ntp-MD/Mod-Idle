# ModWorld — gameplay intent

Current intent and non-obvious behavior constraints. These can change with the owner's request; consult only the affected system. Document ownership and update policy: [AGENTS.md](../AGENTS.md#document-map).

## Completion and progression

- The final zone's boss is the win target: defeat it in one spawn without a Push. Optional activities and tracked wants do not change that goal.
- A Push costs recovery/travel time, not character death. Core-attribute and passive-tree respecs are free at a settlement.

## Mobs and content

- Race > Species > Variant. The Race registry in `mob.races` is closed; empty Races are allowed. Race membership grants no mechanic or drop eligibility. Potion sources are explicit per Species.
- Species own gameplay data, sizes and a default damage type; a Variant may override damage type for its role. Physical damage reads Str, magic reads Int, and mixed reads both; magic-damage Variants keep Int above Str. Each Species attacks with one Element and authors a separate resistance line and weakness; Bosses and Uniques inherit that profile, and no Element counters another. Normal bodies are Small or Medium; the solo Elite body is Large. Every authored Species/zone pair must occur on a subzone side; the union of independent subzone pools covers the zone cast. `habitat` is future eligibility, not a live roster.
- Content counts and name patterns are not gates. Variant ladders may have gaps but no overlapping inclusive bands; Core is authored as integers. Dex follows the `mob.core_spend` band ceilings, a low-Agi body bends below its ceiling, every live stat carries points, Wis is 0 and physical Int is 0; magic profiles keep Int above Str. Field labels are optional. Species may have any subset of common/uncommon/rare junk alternatives; Variant rarity and lean remain Variant-owned.
- Elite is a rank over the selected Variant, retaining name and junk. Clock Bosses use fixed zone profiles. Wild Uniques use zone-top level, Elite stones, the configured unique XP multiplier and crown junk. Mobs have no gear or passive tree.
- Zones impose no Element theme or Species filter. One-handed axe size multipliers remain neutral.
- Retiring a Variant retires its junk identity. Before release, review the save-format consequences; do not invent a migration for retired stacks or silently change that ruling.

## Travel and exploration

- Forward may walk to an already-open settlement when the current zone band is behind. First arrival still requires a player-chosen walk. Manual Waypoints exchange gold for time; Push returns to the last held zone and retains its level gate.
- Patrol is an optional repeatable or one-shot circuit of 2–3 named subzones in one visited zone, clearing three groups per stop. Walking and advancement run online; offline combat stays at the current stop.
- Expedition tasks count only the named Species' Elites hunted from the named subzone, have no deadline, and use the Elite Tier-stone payout. Their offer share comes from the Elite share; combined share stays unchanged.
- A Field Camp may generate one nearby encounter at a time during eligible online time. Warning/choice timers, Camp exposure and encounter generation pause offline; each character resumes its saved seeded Camp stream. Policy can shelter, defend at timeout or engage at warning end. Existing walk/retreat controls remain available and partial kill rewards stay earned.
- Sounds can survey nearby hexes; travelers may exchange provisions for materials; injured travelers can accept provisions or an HP potion for capped Standing credit; passing herd tracks point to a scouted Expedition subzone but do not reserve or spawn a target. A threatened Camp stops the work while the threat is there, and a nest pauses mining or woodcutting temporarily. Encounter fights are ordinary normal groups and do not guarantee an Elite/Unique.
- Auto-Return defaults off for older saves. At the configured bag threshold it finishes the current group, walks to the owning settlement, stashes unlocked gear and resumes if space was freed. Locked gear stays carried. If nothing moves, stop at town without selling or discarding.
- Trail food uses the current region's `fieldwork.regional_sources.food`. Food and ambush rolls are independent; trail events add no currency or stone faucet.
- The map journal remembers explored blocks and nearby scouted blocks. Only online movement expands the journal; old saves reconstruct known settlement centres and the current block without inventing travel history. Geography stays visible while unscouted encounter details remain hidden.
- Authored trail sites are optional one-time stops per character: abandoned camps restore Hunger, provision caravans grant regional food under the existing bag-capacity rule, and hunting tracks survey surrounding blocks. Investigating requires standing on the site outside travel, recovery, dungeon runs and active fights; it stops hunting and pauses Patrol without clearing its itinerary. Establishing or relocating Field Camp also requires a clear field and pauses Patrol. A refused food bundle leaves the site available. These sites consume no loot RNG and grant no currency, stones or XP.

## Economy and town transactions

- Standing progress is actual kills in the settlement's zone plus one-time Camp aid credit recorded for that settlement. Aid credit has a data-configured lifetime cap and never increments kill counters or kill tasks.

- Faucets and sinks are data-driven expectations. Call shared engine payouts; no copied formulas or literal prices. Species power is normalized against its zone mean, so roster changes do not move zone edges or the survival timeline. Do not gate that mathematical identity separately.
- No sink loops back into a profit or power faucet. Ordinary gold stalls sell town services, organisation and appearance. Counterhands buy earned junk, materials, provisions and herbs; the Black Market is the explicit exception below.
- Trade groups classify goods independently of Race. Supply is saved per town/category and recovers through credited simulation time. Quotes, walks, reloads and the wall clock do not reset it. Equal-time subdivision preserves proceeds, demand and currency carry.
- Selling requires visiting the buyer and carrying the goods. Quick Sell handles junk only. Other goods require an explicit sale; selling ingredients gives up their other uses.
- Regional materials supplement existing common resources and retain their keys and stock. Workshops consume carried materials at settlements and produce cargo. Cooking recipes define their edible provision, Hunger restoration and one active meal buff.
- Market/catalogue backfills preserve counts, gold, XP and records without breaking imports or exports.

## Haggling

- Completed Deliveries grant Haggling XP once, after paying the final hand-in and frozen bonus. Partial hand-ins, expiry, refusals, sales, quotes, reloads and recap acknowledgement grant none. Existing completed contracts grant no retroactive XP.
- Levels improve sale prices, newly offered Delivery gold bonuses and ordinary town-service prices, including Waypoint fares. Existing contract rewards and Black Market stock prices remain frozen; stones and skills receive no Haggling multiplier.
- Sales do not change the level. This keeps identical-time split sales equivalent without an extra price-integration system. Market capacity and recovery retain their authored values.

## Delivery contracts

- Wants are per-town offers with no Accept step. Only visited towns roll online opportunities; offline time never queues offers. Targets, counts, deadlines, gold, stones and optional skills are shown at offer time. Tracking is informational and never changes the final-boss `GoalState`.
- Gold and reward bundles freeze at offer time; demand, travel, later tuning and Haggling level changes never re-price the stored bonus. Stones use the task-board funnel, not an extra faucet. `town.json.income_bound_pct` is sizing guidance, not a ceiling or a balance gate.
- Partial hand-ins pay live market value immediately. Completion pays the frozen bonus once; expiry forfeits only the unearned bonus. A useful promised skill grants ownership or a duplicate through the shared path; otherwise pay the promised fallback, never both.
- Deadlines advance through credited online/offline time within the catch-up cap and pause in configured Camp/dungeon states. Snapshot pause at tick start; finalize offer draws after the successful tick's existing draws, including early returns.
- Transactions validate writer access, town presence, quantities, carried goods and combined reward capacity before spending anything. Refusals change nothing. Read-only inspection neither advances simulation nor commits transactions.
- Keep terminal history bounded: remove acknowledged records first; merge excess unread records into a saved recap of actual goods/proceeds, paid rewards and forfeited bonuses, including conditional skill/fallback promises. IDs remain monotonic. Pruning, import, reload and acknowledgement never pay again.

## Black Market

- Gold buys whitelisted rare materials, craft stones, other named rare goods and named Skill XP Levels. No new currency; other stalls retain their restrictions.
- Skill XP Level differs from the Duplicate Ladder and life-skill Mastery. Purchases grant missing ownership and only raise XP, with no duplicate rung or automatic toggle. An owned skill with no level upgrade refuses without charging. Maximum-level offers use the configured skill cap and an explicit generation weight.
- Stock is saved per visited town. Seeded refresh runs on the online settlement tick after world and Delivery draws, in stable town order. Offline time pauses refresh and queues nothing. Viewing, leaving, reloading, importing and wall-clock changes never reroll it. No paid reroll or mystery purchase.
- Preview then commit once through the account writer, validating settlement presence, affordability, frozen stock and combined bag capacity. Refusal changes nothing. Material prices exceed maximum-Haggling full-demand resale; resale uses the ordinary demand curve.

## Life skills and dungeon escrow

- Life skills are exclusive activities: gathering (including Fishing) and fighting cannot overlap. XP/level/Mastery are separate from character XP, never affect `mob_HP`, and never enter combat mana reservations. Small hard-capped combat bonuses may pass through `buildCharacter(effects)`, subordinate to gear/tree.
- Salvage produces base ore plus `scrap`, without direct Value stones. Alchemy converts scrap to `reroll_value`; its output count owns the Tier-stone milestone. Smithing makes metal/components/cargo, never finished gear. Keep the same capped stone funnel; Alchemy is available from the opening.
- Dungeon Retreat/Flee detaches the run before pickup/filter adjudication, rescues the configured seeded 1–2 random escrow stacks uniformly over gear pieces and legal quantity stacks, and forfeits the rest. Do not expand saved quantities or pay twice. Recaps distinguish selected, received and capacity-rejected units.
- Retreat clears the fight and starts the existing online-only cooldown even with empty escrow. Push fully forfeits escrow without adding a cooldown.

## Saves, offline time and RNG

- Save → load → save preserves meaning; reload mid-fight cannot double-credit. Offline `catchUp` matches the same span online except documented AFK exceptions.
- Migrations preserve legitimate progress; reject unknown versions. Remove orphan toggles/buffs/auras without touching legitimate skills or changing the schema unnecessarily.
- Every gameplay draw uses the persisted seeded stream. Tick draw order is frozen: adding, removing or reordering a draw changes later results. Reload resumes the sequence; offline catch-up reproduces its span.
- Guild offers draw zone then kind. Expeditions consume one extra Species/subzone-pair draw; other task kinds keep their prior draw count. Cosmetic draws may change; loot, stones, junk and status application remain pinned.
