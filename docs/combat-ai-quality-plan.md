# Combat AI quality plan — mob AI, auto combat, field map, spawner, skill-driven

Goal: fix correctness gaps and make the five systems data-driven without changing art or the existing feature set. Numbers stay in `tools/data/*.json`, formulas in `engine/`, runtime in `game/src/sim/`. For the next agent: implement packets in order, keep diffs scoped, preserve unrelated worktree edits.

Constraints: Windows + PowerShell, port 5173 only (`Get-NetTCPConnection -LocalPort 5173` first; reuse server). Headless browser only, 1920×1080, one tab per check. Verify correctness/compatibility, not pacing or quotas. `docs/wiki/*.html` generated — never hand-edit. Gate output is the run record.

## Cancelled — do not implement

Owner decision 2026-10-30: the game has changed enough; these systems stay exactly as they are. A removal was started and fully reverted; the code, data, tests, wiki and glossary are back to their prior state (verified: typecheck + svelte-check clean, 12/12 cages, wiki regenerated).

- Camp encounters (`sim/world/camp-encounters.ts`, `campEncounters` state, tick wiring, UI, `engine.json` `camp_encounters`, wiki, tests) — keep.
- Provision caravans + abandoned camps (trail sites: `map-exploration.ts` trail ledger, `rollTrailSite`, `map_exploration.spawn/kinds`, investigate flow, markers, tests) — keep.
- Do not propose their removal again without a new explicit owner decision.

## Approved removals — Wild side, Expedition, Patrol, Hunt toggle, Standing

Owner decision 2026-10-30: remove these five systems for real. Hunt becomes always-on (no toggle; combat triggers whenever in the field). Order is dependency-safe:

1. **Expedition** (most separable): `town.json` `task_sizing` expedition weights, `rollTask` expedition branch, `progressTasks` species/subzone match, Guild board UI, `quest_rewards` expedition milestone/skill-choice, camp `herd` bridge, wiki, cages, tests. Standing stays until phase 2.
2. **Standing**: tier/progress/`helpCredit`, shop `required_standing_tier` gates (open when removed), Collector tier gate (open), TownHub/TravelCard/map-intel UI, `TOWN.standing` data + cages, wiki, tests. Kill-count progression itself stays.
3. **Patrol + Auto-Return** (coupled — Auto-Return cannot survive without a saved route): `exploration.ts` patrol + auto-return, `automation.ts` tick, Forward gate fix, `normalizeExplorationState`, MapJourney/TravelCard/HUD UI, `road.patrol` config, wiki, tests.
4. **Wild side**: wild cells, `wild_site_index`, `siteAt`, gathering mine/grove entry, dungeon map entry, map gen/UI.entry decision required before cutting (see open question below) — cutting cells without a replacement kills gathering and dungeon entry.
5. **Forward travel mode** — approved and cut: `tick/forward.ts` deleted (auto-select on zone change kept inline in `tickWorld`), `travel`/`forwardSafe*` fields removed, Push fallback + HUD mode switch + showcase/travel copy removed.
6. **Hunt toggle → always-on**: delete `leaveCamp`/`returnToCamp` toggles + tent/UI verbs; re-gate spawns, engagement, hunger drain, workshop/forge/alchemy busy-checks, gather/cook guards on position (`rankOf===0`/`atSettlement`/`campHere`) or fight state (`fieldInFight`); update status copy and ~70 test setups.

Open: where do gathering (mine/grove) and dungeon entry live after wild cells are gone — removed with them, or relocated? No code cut for phase 4–5 until answered.

## Handoff — state at 2026-10-30 (read this first)

Tree is green at this handoff: `npm run typecheck` clean, `npm --prefix game run check` 0/0, `npm run verify` 12/12 cages, `npm --prefix game run build` passes, `npm run test:changed` 1933/1934. The single failure is the pre-existing baseline `tests/ui/combat-arena-view.test.ts > F38` (hazard telegraph), which also fails on untouched HEAD paths — report it, do not refix it as part of these packets.

### Done (implemented, verified)

- **P1 Engagement** — pinned ids reserved before the slot cap (`engagement.ts`), truncation receipt `field.engagementTruncated`, unresolved mob shots of departed owners cancelled (ground shots kept). Tests in `game/tests/sim/engagement.test.ts`.
- **P2 Mob movement/strike** — melee release needs sight when `arena.nav` exists; out-of-reach ready strike walks to `strikeReach`; wall slide instead of snap-back (no `voluntaryM` zeroing); route-hold stops replanning. All new branches are `arena.nav`-gated, so the shipped no-nav fields behave as before.
- **P3 Auto combat (data+sim)** — `SkillRow.auto: auto|manual|both` (default `both`, cage S27), mana-reserve gate for zero-CD fillers, `approachRange` hysteresis. **UI still pending** (per-row control, `holdPosition`, target priority).
- **P4 Nav activation** — new `forest-ridge` layout (same 48 homes + 2 ridge boxes + 1 thicket); **zone 2 is now the only zone with `nav`**; `aimForSkill` focus pin re-tests sight; scene clamp includes body radius. Coverage now `2 layouts · 96 points`.
- **P6 Skill live/offline** — `roll_policy` honoured offline, independent caches for targeted-burst/cluster, chain nearest-hop, Sand Storm live-parity (no erosion on the initial pulse), dev-only `test_fixtures` (cluster 60/20/20, HP cost), duration/targets/profile parsing validated by cage instead of throwing. Documented remaining difference: offline has no flight clock, so it uses the prepared queue plus the `targets` cap (queue-only), and target-burst assumes the bound body stays in reach.
- **P7 Damage/status** — skills apply curse `damage_taken`, Headsman executes on both paths, mob DoT uses the player ladder/mean, Block precedes `takenScale`, Anvil uses pre-mitigation raw, Shock spends fractional time. Tests in `game/tests/sim/combat-correctness.test.ts`.
- **P9 Boss/perf/cages** — phase sampled every scheduling pass (heal-then-recross refires), `aimForSkill` coverage memo (4.28x on the benchmark) and allocation-trimmed `captureCombatArena` (1.62x), new cages PH1/SA1/SP2. Tests `arena-performance`, `slot-determinism`.
- Earlier, already landed: `grove-slice` removed, pending-work silent slices removed, `separateBodies` fixed-point break, **Forward travel mode cut** (`tick/forward.ts` deleted; auto-select kept inline in `tickWorld`; `travel`/`forwardSafe*` gone).

### Not started

- **P5 Spawner parity** — zero code written. The dispatch was interrupted before any edit; `field-area.ts`, `field-population.ts`, `engine/dungeon.ts` have no P5 hunks. Work remains: dungeon slot timers + `spawnSlotSeed` + `group_cap`, boss phase adds through the slot/cap queue, receipt for dropped save data, and the 48/48/48 headroom fix (pick the least invasive: lower max zone cap or add points).
- **P8 Determinism/save parity** — zero code written (only the pending-work slice removal from an earlier pass landed). Work remains: split or document the RNG stream order (`game.ts` `rngState++`, `spawnMob` id draw), per-action pending-work budgets with receipt, save-normalize reporting, finite `rngState/seed/streamState`.

### Removals (serial — same files, do not parallelise)

Order is dependency-safe. **Wild side is on hold by owner decision.**

1. **Expedition** — `town.json` `task_sizing` expedition weights + `quest_rewards` expedition fields, `town.ts` `rollTask`/`progressTasks`/`taskReward`, Guild board UI in `App.svelte`, camp `herd` bridge (`camp-encounters.ts`), wiki, `tools/delivery.ts` DC5, tests (`app/exploration`, `app/quest-rewards`, `sim/camp-encounters`, `ui/map-*`).
2. **Standing** — `engine/standing.ts`, `TOWN.standing` + `collector_required_tier` + every shop `required_standing_tier` (open the gates), `town.ts` `standingProgress`, `collector.ts` gate, TownHub/TravelCard/map-intel copy, `helpCredit` (and its camp-encounter bridge), `tools/trade.ts` TC11, tests.
3. **Patrol + Auto-Return** (coupled) — `world/exploration.ts` (delete the file), `tick/automation.ts`, `game.ts` call sites, `types.ts` patrol/autoReturn, save `normalizeExplorationState`, MapJourney/TravelCard/HUD/gear-care UI, `road.patrol` config, wiki, ~6 test files.
4. **Hunt toggle → always on** — delete `leaveCamp`/`returnToCamp` and the tent verbs; re-gate spawn, engagement, hunger drain, workshop/forge/alchemy busy checks, gather/cook guards on position (`rankOf===0`/`atSettlement`/`campHere`) or `fieldInFight`; update status copy and ~70 test fixtures that set `hunting`.
   `s.hunting` itself may stay as a constant if that keeps the diff small, but no UI may toggle it.

### Guardrails for the next agent

- The five cancelled systems (camp encounters, caravans/abandoned camps) stay. Do not propose cutting them again.
- Wild side stays until the owner answers where gathering and dungeon entry live.
- Re-read any file before editing; several packets touched the same files (`game.ts`, `combat-arena.ts`, `skills.ts`, `App.svelte`).
- Do not hand-edit `docs/wiki/*.html`; run `npm run wiki` when player-facing copy changes.
- Verification per packet: focused tests → `npm run test:changed` → `npm run typecheck` → `npm run verify` → `npm --prefix game run check` → `npm --prefix game run build`.

## Findings (evidence, highest value only)

- Engagement truncates `pinnedIds` last: `game/src/sim/core/tick/engagement.ts:139-142`. Impact-owed targets can drop while alive; beats bail at `mob-actions.ts:274,299`.
- No leash by design (`engagement.ts:14-15,109-110`); disengage cancels only unreleased prep (`:147-151`), in-flight `mobFlights` still resolve (`mob-shots.ts:100-106`).
- Strike out-of-reach silently skips; mob never walks to enable it (`mob-actions.ts:307-313`). Non-contact damage may never pull (alert only on resolved hostile contact, `game.ts:1365-1373`).
- Auto has no per-row auto-only/manual-only, no target priority, no hold-position, no mana reserve for next timed nuke; `approachRange` on first-ready row can oscillate (`game.ts:1440-1458`, `skills.ts:798-831`, `combat-actions.ts:150-194`).
- Live map has no obstacles: all zones use `forest-clearing` (no `nav`); the unused `grove-slice` layout is removed — nav coverage now uses inline fixtures (`spawns.test.ts`, `obstacle-slice.test.ts`). Focus path bypasses sight (`combat-arena.ts:310-321,447-450`); mob melee release checks reach only (`mob-actions.ts:149-150`).
- Separation pushes without obstacle knowledge then snaps back and zeroes progress (`combat-arena.ts:709-772`); unreachable route silently holds (`:626-676`).
- Spawner live/offline diverge ~7x by design (live cap 32/40/48 vs legacy 6/8, solo-pull offline `engagement.ts:75-96`, cap collapse `field-population.ts:87`); dungeon has no slots/timers and ignores `group_cap` (`field-population.ts:102-111`); boss phase adds bypass slots/caps (`game.ts:1648-1663`); cap 48 = points 48 = `MAX_SLOTS` 48, zero headroom (`field-area.ts:60,84`).
- Skill-driven: `cluster-burst` has zero live rows; `targeted-burst` live independent caches/pursuit have no offline equivalent; `roll_policy` ignored offline; live chain/AoE vs offline `targets` cap mismatch; live `sand-field` vs offline `setErosion` divergence (`flights.ts:34-146,219-435`, `skills.ts:683-690,915-930,977-1241`).
- Damage/status: skills ignore curse `damage_taken` (`combat.ts:341` vs `skills.ts:1107-1146`); execution only on swings (`combat.ts:372-376` vs `skills.ts:949-954`); mob DoT overwrites `perSec` per stack (`mobStatus.ts:138-141`); block/`takenScale` order contradicts comment (`combat.ts:508-522`); shock 0.5s consumes 1s clock (`post-tick.ts:40-43` vs `game.ts:1412`).
- Determinism/save: single `rngState++` stream shared by spawns/ids/drops (`game.ts:1084,388`); offline is a different sim (solo-pull + legacy caps + `floorLevel` drops); pending-work silently slices 32/16/32/64 (`pending-work.ts:316-347`); save normalize drops state silently (`save.ts:833-876`, `field-area.ts:329-347`).
- Boss/perf: single phase gate in data vs N-threshold `mobPhase()`; adds bypass slots/caps; `separateBodies` 8×O(n²) per sample, `aimForSkill` O(n²) per cast, per-step allocs in `captureCombatArena`; no cage for mob-skills/phase/offline parity.

## Packets

### P1 — Engagement correctness (mob AI)
Files: `game/src/sim/core/tick/engagement.ts`, `game/tests/sim/*engagement*`, `field-area.test.ts`.
- Reserve pinned ids before `slice(0, slots.length)`; never drop `pinnedIds` to cap. Log/count truncation via combat receipt, no silent drop.
- Cancel or re-target in-flight `mobFlights`/ground shots whose owner disengaged; keep damage already resolved.
- Add `leash_m` to `SpawnProfile` (`engine/spawns.ts`, `tools/data/spawns.json` defaults inherit) defaulting to current behavior (empty = no leash); when set, release by distance with same `cancelMobPreparation('leashed')` path. Data-only tuning, no hard-coded meters.
Accept: whole-cap + boss-adds field keeps pinned engaged; disengaged owner deals no new hits; leash unset = today's behavior byte-identical.

### P2 — Mob movement and strike intent
Files: `combat-arena.ts` (`approach`, `blockingNeighbour`, `nextRoutePoint`, `separateBodies`, `settleStaticClearance`), `mob-actions.ts:307-331`, `mob-shots.ts`.
- Melee release requires `sight` clear when `arena.nav` exists (keep radius-only when no nav); keep `arenaMobInReach` as range gate.
- Out-of-reach ready strike: walk to `strikeReach` instead of skipping basic; only skip when `stopped` or no path after `ROUTE_HOLD_FAILS`.
- Separation: slide along wall (clamp push to `sweepDisc` clear) instead of snap-back + zero `voluntaryM`; surface `routeFailed/unreachable` to scheduling (hold, don't spin).
Accept: wall-adjacent crowd keeps progress; thin-wall melee through box misses; long-kit mob closes distance.

### P3 — Auto combat controls (no new UI art)
Files: `game/src/sim/combat/skills.ts` (`rotationOrder`, `skillEligibility`), `combat-actions.ts` (`pickIntent`, `aimForSkill`), `tick/player-action.ts`, `tick/intents.ts`, `App.svelte` + `SkillsWorkbench.svelte` wiring only, `tools/data/skills.json` flags.
- Add per-row `auto` flag (`auto|manual|both`, default `both`) checked in eligibility for auto path only; manual `intent-select.ts:46` bypass unchanged.
- Add `holdPosition` auto stance (no auto approach; basics/avoid still fire) and target-priority (`nearest|lowest-hp|highest-hp`, default `nearest`) threaded through `arenaTarget`/`aimForSkill`.
- Mana reserve: skip filler when a higher-priority timed row becomes ready within its `cd` and current mana + regen won't cover it (read-only lookahead, no new resource).
- `approachRange` hysteresis: keep held intent while in range; switch only when held invalid or new `now` strictly closer by band.
Accept: manual-only row never auto-fires; hold-position never auto-steps; filler never starves next timed nuke in fixture.

### P4 — Field map activation
Files: `engine/spawns.ts` (`navigation`, `checkSpawnNavigation`), `tools/data/spawns.json`, `combat-arena.ts:495-498`, `CombatArenaScene.svelte` clamp.
- DONE (data cut): `grove-slice` removed from `spawns.json`; `spawns.test.ts` + `obstacle-slice.test.ts` build the same ridge/thicket geometry inline, so nav-engine coverage stays without dead live data. Coverage assertion updated (`layouts: 1, points: 48`).
- Remaining: point one low zone at an authored `nav` layout only when a zone actually needs obstacles; until then keep all zones on `forest-clearing`.
- Focus pin and `intentTargets` re-test `sight` when nav exists; manual ground `isClear` unchanged.
- Fix display clamp to include body radius to match sim.
Accept: ridge blocks sight/projectiles but thicket blocks movement only; pinned target behind ridge not attackable; `map:check` + navigation tests pass.

### P5 — Spawner parity and headroom
Files: `field-area.ts`, `field-population.ts`, `game.ts` (`spawnMob`, boss adds, dungeon), `engine/dungeon.ts`, `tools/data/spawns.json`.
- Dungeon uses slot timers + `spawnSlotSeed` + `group_cap` clamp like field (same `respawn_sec` window semantics); boss phase adds go through slots/cap (queue when full, never silent over-cap).
- Add one layout with >48 points OR lower max zone cap so growth doesn't trip `cap > points` validator; document which.
- Report dropped bad slots/archives/`offlineCredit` clamps to combat receipt instead of silent drop.
- No throughput retune; keep live vs legacy numbers as-is.
Accept: full field + boss adds never exceeds slots; dungeon refill deterministic per slot; invalid save data visible in receipt.

### P6 — Skill live/offline agreement
Files: `engine/skills.ts`, `engine/skill-actions.ts`, `game/src/sim/combat/skills.ts`, `tick/flights.ts`, `tick/cast-trigger.ts`, `tools/data/skills.json` (fixtures only, no live-row retune).
- Wire `roll_policy` offline (independent = per-target cache like live; shared = one crit like live).
- `targeted-burst` offline: independent caches + pursuit/range approximated by queue order with documented limit; or mark unsupported offline with receipt (pick one, no silent shared-crit).
- Chain offline hops nearest-unused-in-radius (not flat AoE split); circle live stays centre-in-centre (documented), offline `targets` cap labeled queue-only.
- `sand-field` offline suppresses erosion/riders like live initial pulse, or live adds them (pick one; keep one rule).
- Add one synthetic `cluster-burst` + one HP-cost fixture row (dev/test only) proving parent/children shares and `hp>=1` rule; no live roster change.
- Fix fragile parsing (`duration` regex, `targets "a/b"` split, missing `cast.profile` throw → validate with cage error).
Accept: same seed + same targets live vs offline agree on hits/caches/DoT within documented queue-vs-spatial difference; fixtures cover cluster + HP cost.

### P7 — Damage and status correctness
Files: `game/src/sim/combat/combat.ts`, `game/src/sim/combat/skills.ts`, `game/src/sim/combat/mobStatus.ts`, `tick/post-tick.ts`, `tick/live-clocks.ts`.
- Skills apply curse `damage_taken` via same `takenMult` path as swings; execution works on both paths (skill kill check mirrors swing threshold).
- Mob DoT stacks like player (ladder/sum, no weak-hit overwrite); block lands before `takenScale` per comment; `Anvil` ratio uses pre-mitigation raw.
- Shock consumes fractional clock on both rate and expiry; buff/cooldown Haste rules match documented behavior (one rule, both paths).
Accept: curse/execute/DoT/block fixtures agree swing vs skill; fractional shock advances fractional expiry.

### P8 — Determinism and offline/save parity
- DONE (cut): silent `.slice(0, 32/16/64/32)` caps removed from `normalizePendingWork`; every shape-valid entry is preserved. Save-size guard, if ever needed, must be an explicit validated budget with a receipt — not a silent slice.
Files: `game.ts` (RNG/spawn/clock/catch-up), `pending-work.ts`, `state/save.ts`, `field-area.ts`.
- Split RNG streams by purpose (spawn vs drop vs encounter) or document single-stream order; `spawnMob` id draw must not shift later rolls between live/offline pull sizes.
- Pending-work: replace silent slices with per-action budget validation + receipt; settle owed flights within cap instead of deferring past budget.
- Save normalize: report dropped slots/archives/credit/skill-ids to receipt; clamp `rngState/seed/streamState` to finite ints.
Accept: same seed live vs offline agree on draws/order within documented solo-vs-spatial limit; no silent truncation; reload preserves owed work.

### P9 — Boss, performance, cages
Files: `mobSkills.ts` (`mobPhase`), `game.ts:1648-1663`, `combat-arena.ts` (`separateBodies`, `aimForSkill`, `captureCombatArena`), `tools/check.ts`, `tools/lib/writers.ts`.
- Phase evaluated on damage crossing (not once-per-plan); heal-then-recross refires per documented rule; adds go through P5 slot/cap queue.
- DONE (cut): `separateBodies` breaks out when a full pass moves nothing (fixed point — later passes would repeat identically). Worst case still 8 passes; average case drops. Determinism unchanged (sorted ids, no RNG).
- Cages: validate `mob-skills.json` phase gates, `phase_adds`, `cluster-burst` zero-live, `roll_policy`/offline parity, dungeon slot determinism.
Accept: multi-phase fixture fires in order; full-field + adds bounded; cages fail on bad phase/kit data; measured allocs/passes down.

## Verification (per packet, then full gate)
- Focused: `npm --prefix game run test -- <changed-area-tests>` (e.g. engagement, arena-navigation, field-area, spawns, multi-hit, cluster, lock-on, mob-actions, skill-area).
- Shared-behavior change: broaden to `npm run test:changed`, `npm run typecheck`, `npm run verify`.
- Data/schema change: `tools/check.ts` cages via `npm run verify`; `npm run skills` / `npm run map` when those inputs change; `npm run wiki` only if player-facing copy/formulas change.
- UI/behavior change: `npm --prefix game run check` (warnings fail), `npm --prefix game run build`, headless 1920×1080 snapshot + console, one tab, then close.
- Final gate once: `npm run typecheck`, `npm test`, `npm run verify`, `npm --prefix game run check`, `npm --prefix game run build`, `npm run wiki` (if needed).
