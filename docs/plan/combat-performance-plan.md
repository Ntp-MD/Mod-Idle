# Combat performance implementation plan

Status: implemented and verified on 2026-11-03. Scope: simulation and scheduling, excluding art and asset work.

Follow the [working agreement](../../AGENTS.md). This plan fixes the implementation choices; execute stages 0–5 in order. Do not replace a stage with a different architecture. If a stated assumption proves false, report the failing reproduction and leave that stage open.

## 1. Outcome and boundaries

The result must reduce offline catch-up cost and long foreground tasks while preserving combat outcomes and every credited second. In particular, retain:

- Seeded RNG consumption and event order, including same-timestamp priorities.
- The authored combat step and one-second world stages.
- Target membership, priority, approach hysteresis, collision corrections and navigation constraints.
- Mana/HP payment, cooldowns, control budgets, kills, drops, progression and economy.
- Pending work at every public simulation return, progress callback, cancellation return and save boundary.
- Current save shape and schema version, including shared roll-cache/once-effect/refresh identities.

No balancing, new dependencies, workers, ECS, spatial grid, save-schema migration, approximate targeting, collision-pass reduction, art changes, or general UI redesign belongs to this task. Do not disable validation, pending-work capture, collision, or effects to obtain a benchmark result.

The implementation uses four chosen changes:

1. Publish the offline pending-work ledger once per complete `tick`, while preserving publication after each public `stepCombat` call.
2. Reject distant collision pairs with a conservative axis test before the existing narrow-phase calculation.
3. Reject cooldown/disabled/weapon-incompatible automatic skill candidates before aim work, and reuse rotation order within a single selection call.
4. Use one 8 ms CPU-slice policy, with yielding continuations for live debt and asynchronous offline settlement.

## 2. Existing evidence and exact baseline protocol

The previous audit ran the production modules through Vite SSR, without browser rendering or Svelte proxies. These are observations, not CI timing thresholds:

| Scenario | Mean per 50 ms simulation step | P95 per step |
|---|---:|---:|
| 32 bodies | 0.45–1.18 ms | 1.1–3.6 ms |
| 48 bodies | 1.43–2.38 ms | 4.0–6.6 ms |
| 48 bodies with multiple skills | 2.10–4.16 ms | 5.3–10.0 ms |

Two 1,200-second offline runs took 4,610.4 / 3,424.8 ms. Each made 6,020 nonempty ledger copies containing 169.6 million JSON string code units in total. Stringify plus parse consumed 73.1% / 76.7% of elapsed time. This is cumulative allocation traffic, not a save-file size or an assertion that code units equal UTF-8 bytes.

CPU samples identified movement/separation, intent selection and allocation/GC as the significant live costs. The expensive `push` samples include the local collision correction function; do not mislabel them as combat-log overhead.

### Stage 0 — make the measurement repeatable

Files:

- Add `tools/performance-baseline.mjs`.
- Add `performance:baseline` to root `package.json`: `node tools/performance-baseline.mjs`.
- Reuse [encounter fixtures](../../game/tests/fixtures/encounter.ts); do not alter production game data or make benchmark assertions about catalogue counts.

Tool contract:

1. Load installed Vite from the `game` package using `createRequire` anchored at `game/package.json`. Start a middleware-mode Vite server with `game/vite.config.ts`, no listening port, dependency discovery disabled. Always close it in `finally`.
2. Load the existing encounter fixture and production modules through `ssrLoadModule`. Complete imports before timing. Do not use `encounter.run` for timed work: it rebuilds the sheet and records traces beyond what the live loop does.
3. Use seed 7. Select the smallest-cap and largest-cap live zone by traversing current zones and `spawns.profileFor(zone.id, null, 'live')`; break cap ties by ascending zone id. Use the selected cap as the fixture's requested population. Print actual zone, cap and living-body count.
4. For the skill-heavy scenario, traverse `sm.all()` in ascending id order. Select the first row for each of: `blizzard-field`, `meteor-field`, `thunder-field`, `ray-channel`, and `spread_status` with footprint scope. Fail with a capability-specific message if any capability is absent. Print selected ids.
5. Live cases: smallest-cap basic, largest-cap basic, largest-cap skill-heavy. Make every fixture body durable with `hp = hpMax = 1e9`; before each step set player HP to `1e9` and Mana to the fixture's computed maximum. These are benchmark-only controls preventing a changed fight duration from changing the workload.
6. For each live case use five independently seeded fixtures. Warm each for 600 direct `stepCombat` calls, then time 600 more calls using `performance.now()`. Report mean, P50, P95, P99, maximum and actual living-body counts for every repeat. Report medians of repeat means/P95 separately. A percentile is the sorted element at `min(length - 1, floor(length * p))`.
7. Offline case: five fresh largest-cap fixtures, with the selected meteor-field and blizzard-field rows, then `catchUp(state, 1200)`. Do not make the offline character invulnerable or change ordinary offline engagement rules. Print elapsed milliseconds, credited seconds and a deterministic outcome fingerprint for each repeat.
8. Count nonempty pending-ledger JSON copies only in the offline measurement process. A ledger object has `flights`, `actors` and finite `clockUs`. Wrap JSON stringify/parse locally in `try/finally`, retain their original functions, count matching copies and string code units, and restore the functions before printing. Record serialization timing separately. Never install this instrumentation in the game bundle.
9. Fingerprint the complete game state except wall-clock `lastSavedAt`. For live cases also include exact player/mob coordinates, facing, movement/path state, intent, action receipts and executable flights from the arena. Use JSON numbers without rounding and SHA-256 from `node:crypto`; sort map-like actor ids before encoding but preserve event/target array order. Do not include transient Vite/runtime functions. Print the digest and keep the comparator's field list explicit; never omit gameplay fields to make comparisons pass.
10. Print JSON lines to stdout. Do not write benchmark transcripts, CPU profiles or baseline JSON into the repo. Use `--self-test` for an assert-based check of percentile calculation, required-capability failure and restoration of JSON wrappers after an exception. Do not add more CLI options.

Run `npm run performance:baseline -- --self-test`, then `npm run performance:baseline` before performance implementation. Preserve that stdout as the session's baseline evidence. Previous audit figures above are context; use the new tool's before/after results for acceptance.

## 3. Stage 1 — remove intermediate offline ledger serialization

Owners:

- [game.ts](../../game/src/sim/core/game.ts): public simulation boundaries and whole-second batching.
- [offline-actions.ts](../../game/src/sim/core/tick/offline-actions.ts): the transient offline arena and its checkpoint.
- [pending-work.ts](../../game/src/sim/core/pending-work.ts): ledger shape, detached copy and restore semantics; keep these unchanged.

### Chosen implementation

Split the offline adapter's current `checkpoint(atUs)` into:

- `checkpoint(atUs)`: keep all existing death/area-exit cancellation, live-clock advancement, `adapter.nowUs`, and recovery-intent cleanup. Remove only the ledger assignment from this function.
- `publish()`: perform the existing `s.pendingWork = snapshotPendingWork(adapter, s.group)` assignment. Include the null result so the last completed flight clears the ledger.

Both methods remain on the object returned by `createOfflineActions`.

In `game.ts`:

1. Extract the existing public `stepCombat` body into a private `advanceCombatStep` function. Public `stepCombat` remains the same exported API and delegates to it.
2. Give the private function an optional per-call context `{ publishOffline?: () => void }`. Pass this context to private `tickWorld`; do not add a public `TickOptions` flag or store publication policy in `GameState`.
3. In the existing `tickWorld` `finally`, always run `offlineActions?.checkpoint(clock.nowUs)`. With no context, immediately run `offlineActions?.publish()`. With a context, retain `offlineActions.publish` in that context instead of serializing.
4. `tick` creates a fresh local context and calls the private step function in its existing loop. It does not call the public wrapper. After each substep, the transient arena remains authoritative and all clocks/events still advance.
5. On the last substep of a world second, flush and clear the retained publication callback **before** `closeSecond`. This retains the existing ordering of ledger capture relative to recovery, post-tick effects, Push and settlement. Do not move capture after those stages.
6. Wrap the `tick` loop in `try/finally`; flush and clear any callback still retained when the loop exits early or throws. Clear it before invoking it so the same callback cannot be invoked twice by nested cleanup.
7. An existing `writer: false` return must remain mutation-free and allocate no publication context. Do not broaden the guard limit or change the step/window calculations.
8. Preserve the public `stepCombat` behavior: a caller can export/save after any single 50 ms step and obtain an up-to-date ledger.

Reason this boundary is safe: current asynchronous catch-up calls `onProgress` and yields only after a complete `tick`. `createOfflineActions` uses its `WeakMap` arena once initialized; it does not restore the detached ledger on each substep. `settleSavedPendingWork` reads the ledger between complete tick calls. Recheck these owners before editing; do not expose an unpublished state to a callback.

### Required regressions

Extend `game/tests/app/pending-work.test.ts` and add `game/tests/sim/offline-checkpoint.test.ts`:

- Compare a complete `tick` with repeated public `stepCombat` calls until the same world boundary. Compare full state and detached pending ledger, including RNG, rewards and cache identity fields.
- Run the comparison after every possible partial-world-step offset derived from `COMBAT_STEP_US`, not a handwritten count of twenty. Start both states from the same initial snapshot and replay to the offset independently so their transient maps are valid.
- Use synthetic field, burst and ray rows. Cover shared and independent rolls, per-impact and refresh-status effects, a dead bound target, an area change, and fatal Push. Existing fixture installers must restore their rows in `finally`.
- Export/import after a public partial step, continue both paths, and prove no lost or duplicate impacts/payments/rewards.
- After a `tick` return, mutate live arena/character inputs and prove its published ledger remains detached as before.
- Prove an empty adapter publishes null after its last impact.
- Count matching nonempty ledger stringify calls in an isolated synchronous test with `try/finally` restoration: one completed `tick` must publish at most once; repeated public steps must still publish as needed at their individual boundaries. Do not add production counters.
- Cancel `catchUpAsync` at its first positive progress callback; its returned state must equal synchronous catch-up for exactly `result.simulated` seconds.

Acceptance: every correctness regression passes; snapshot/normalization format and `SCHEMA_VERSION` are unchanged. The offline benchmark median elapsed time must be at most 60% of stage-0 baseline on the same machine. If that report target is missed, leave this stage open and report the measured remaining hotspot; do not remove more save boundaries by guesswork.

## 4. Stage 2 — conservative collision broad rejection

Edit only the collision implementation in [combat-arena.ts](../../game/src/sim/combat/combat-arena.ts). Keep the sorted body order, pair order, player immovability, eight-pass upper bound, fixed-point exit, navigation sweep, clearance and correction arithmetic.

In the local `push(a, b, need, aShare)`:

1. Calculate the existing `dx` and `dy`.
2. Return immediately when `Math.abs(dx) >= need || Math.abs(dy) >= need`.
3. For remaining pairs, run the current `Math.hypot`, overlap comparison, zero-distance fallback and `stepTo` calculations unchanged.

Use this axis test rather than replacing `Math.hypot` with square-root arithmetic: all potentially overlapping pairs still take the original floating-point path. Do not add a grid, positional cache, or a "nobody moved" skip. An eight-pass sample can leave residual overlap; skipping its next sample would change the existing solver's behavior.

Extend `game/tests/sim/arena-performance.test.ts` and the existing navigation tests:

- Use isolated synthetic bodies: separated, touching exactly on each axis, diagonal near-contact, overlapping, coincident, player overlap, bounds edge and wall-adjacent cases. Add expected coordinates for the simple axis-aligned corrections, and use the stage-0 exact fingerprints plus existing deterministic replay tests for the complete solver. Do not duplicate the solver implementation inside a test.
- Assert exact resulting coordinates/order for the simple cases unaffected by navigation; retain existing navigation legality and replay tests for walls.
- Instrument `Math.hypot` only around one synchronous isolated no-movement sample with 32 synthetic, widely separated bodies, no navigation or idle goals and sufficiently large synthetic bounds; restore it in `finally`. Total calls must remain below the 496 mob-pair count, proving distant pairs did not enter the narrow phase. Overlapping cases must retain their expected correction. Do not assert a wall-clock threshold in unit tests.

Acceptance: no gameplay-state difference; live basic and skill-heavy median P95 must not regress by more than 10% versus stage 0. Report measured timing rather than promising a fixed percentage improvement from this stage alone.

## 5. Stage 3 — avoid aim work for impossible automatic candidates

Edit [combat-actions.ts](../../game/src/sim/combat/combat-actions.ts), using existing readers from [skills.ts](../../game/src/sim/combat/skills.ts). Do not add a second resource-pricing or condition engine.

### Chosen implementation

1. Compute `const order = rotationOrder(state.skills)` once in `selectCombatIntent`, before defining/using `pickIntent` candidates. Pass this same array into every private `pickIntent` call made by this selection. Retain its use in existing priority comparisons.
2. In `pickIntent`, before `aimForSkill`, skip a row when any of these facts holds:
   - `(state.skills.cd[id] || 0) > 0`;
   - `modeOf(state.skills, id) === 'never'`;
   - `(state.skills.autoMode?.[id] ?? row.auto) === 'manual'`;
   - `!sm.weaponFits(row, character.weaponName)`.
3. Use `sm.byId` and the existing `modeOf` reader. `rotationOrder` already filters ownership and missing rows; retain that owner rather than reimplementing it.
4. Keep full `skillEligibilityInState` at its current point after target resolution. It remains authoritative for Mana, HP, reservation, Mana debt, Trance, conditional OR rules, target status and Shock. Do not prefilter resource costs or conditional skills using a dummy target.
5. Preserve both fresh and in-range searches, their order, held-intent handling and manual paths. Do not cache a selection across movement samples and do not quantize positions.

These early checks are only safe rejection of candidates that the current final eligibility would reject. They do not produce UI reasons or replace full validation at release.

Extend `game/tests/sim/arena-performance.test.ts` and relevant auto/eligibility tests:

- A synthetic target-circle row on cooldown, Never, Manual-only and wrong-weapon must add zero aim misses/coverage checks. Verify each case with a fresh arena and existing `AIM_DIAGNOSTICS`.
- The same row becoming ready, changing to an eligible mode, or switching to a valid weapon must be selected on the next call.
- Conditional HP/status/pack-size and Trance-free casts must still reach the full eligibility reader; compare their selected intent and state with the previous behavior.
- A manual command for a row marked Manual-only or Never still follows its existing deliberate-cast bypass.
- Reordering slots during the same second affects the next selection; no stale cross-call rotation cache is allowed.
- Existing held-target, range, focus pin and approach hysteresis regressions must pass unchanged.

Acceptance: outcomes and RNG match; impossible rows perform no aim scan. The skill-heavy benchmark must report before/after aim diagnostics and satisfy the no-regression P95 rule above.

## 6. Stage 4 — short CPU slices with complete debt accounting

### One policy owner

Add `export const MAX_WORK_SLICE_MS = 8` to [core/clock.ts](../../game/src/sim/core/clock.ts), import/re-export it through `game.ts`, and use it from `app/loop.ts` and asynchronous catch-up. It is an execution budget, not a gameplay constant. Keep `movement_step_sec`, `LIVE_STEP_MS`, `MAX_BATCH`, movement/attack rates and speed controls unchanged.

### Live scheduler

In [app/loop.ts](../../game/src/app/loop.ts):

1. Replace the wake's `budgetMs = LIVE_STEP_MS()` with `MAX_WORK_SLICE_MS`. Check elapsed work after each completed step, as today. A single expensive step may exceed the budget; never interrupt a step halfway through.
2. Keep the current debt equation exactly: `acc = batch.acc + (batch.steps - completed) * stepSec`.
3. While `startWakeLoop` is active, queue one `setTimeout(..., 0)` continuation when at least one complete step remains in `acc` and the context can write, is running and is not paused.
4. Store exactly one continuation handle. Clear that handle before its callback calls `wake(readWallMs())`. The ordinary interval and continuation share the same `last`/`acc`; elapsed wall time must be accounted once.
5. Do not use a microtask, Promise recursion, busy waiting or a second interval. Direct test calls to `wake` must not schedule timers until `startWakeLoop` has been activated.
6. `startWakeLoop`'s returned cleanup clears both the interval and pending continuation and disables further scheduling. `restart` clears a pending continuation and resets `acc`, `last`, `started` as currently specified.
7. A queued callback that finds a paused/stopped/non-writer context must return through existing wake gating. Preserve already earned debt; never simulate paused elapsed time. A writer takeover must not leave a detached continuation advancing the old state.

### Offline scheduler, including saved-work settlement

The initial `settleSavedPendingWork` can currently execute up to the configured settlement cap before the first yield. Make it obey the same time-slice policy, rather than only shortening the later ordinary loop:

1. Extract a private single-second settlement operation from its loop. It receives the original pinned-id set, creates/restores an arena, performs at most one existing settlement `tick`, and returns 0 or 1 credited seconds. A restore with no executable work clears the ledger and returns 0.
2. Keep the synchronous settlement wrapper. It creates the pinned-id set once, applies the existing `min(away budget, SETTLE_SECONDS_CAP)` bound, loops over the shared operation, and writes the existing deferred-work receipt once when done. No callback/yield is added to synchronous `catchUp`.
3. In `catchUpAsync`, use that same single-second operation inside the work-slice loop before ordinary away ticks. Preserve the pinned-id set across yields. After settlement completes or exhausts its cap, finalize its receipt once and continue ordinary ticks for the remaining away budget.
4. Keep the existing 2,000-tick count ceiling per slice as a secondary guard; change the time ceiling from literal 16 to `MAX_WORK_SLICE_MS`.
5. Emit progress initially and after each completed slice, always with cumulative credited seconds. Emit final progress when complete. A callback can abort; honor that before another tick. A pre-aborted signal must leave state unchanged.
6. Before every `onProgress`, `await` and return, stage 1 must already have published the last completed tick's pending ledger. Never expose an intermediate substep with a stale ledger.
7. Keep `setTimeout(resolve, 0)` yielding between unfinished slices. Continue to apply boss/dungeon clock adjustments exactly once, based on total credited seconds, including cancelled runs.

### Required scheduler regressions

Extend [loop-pause tests](../../game/tests/app/loop-pause.test.ts), [clock tests](../../game/tests/sim/clock.test.ts), and [pending-work tests](../../game/tests/app/pending-work.test.ts):

- Inject the existing wall-clock reader: steps costing 3 ms execute three steps in an 8 ms slice, then yield; one step costing 20 ms executes once, then yields. These are fake-clock logic assertions, not machine timing thresholds.
- Prove total completed simulation time plus remainder equals total earned unpaused wall time times speed, across pause/resume, speed changes, writer loss and restart.
- In an isolated test in `loop-pause.test.ts`, use Vitest fake timers, start the wake loop, and supply the existing injected wall reader. A 60-second stall queues at most one continuation in addition to the interval; drain continuations at unchanged wall time and prove debt is paid without earning extra time. Cleanup/restart prevents a queued callback from advancing an old run. Always restore real timers in `finally`; do not change global Vitest configuration or add a production timer abstraction.
- A pending impact more than one world second away is settled across multiple async slices. Cancellation during settlement leaves a resumable ledger and agrees with synchronous catch-up for exactly the credited seconds.
- Test settlement with no remaining work, exhausted settlement cap, insufficient away budget and a pre-aborted signal. There must be no zero-progress infinite loop when the single-second operation returns 0.
- Keep command-latency, manual interruption and live/offline deterministic replay tests passing. No command waits behind a whole debt batch.

Acceptance: each wake/slice stops at the first completed simulation step that reaches the 8 ms fake-clock budget; debt is eventually paid by continuations without dropping time. Do not claim a hard 8 ms maximum for an indivisible step.

## 7. Stage 5 — verification, evidence and closeout

Run commands from the repository root. Follow the working agreement for current warnings, concurrent edits and baseline failures. Do not create a branch/worktree or run sync/commit/push.

### Per-stage checks

After stage 1:

```powershell
npm --prefix game run test -- tests/sim/offline-checkpoint.test.ts tests/app/pending-work.test.ts tests/sim/skill-mechanic-contracts.test.ts tests/sim/ray-channel.test.ts
npm run typecheck
npm run performance:baseline
```

After stages 2–3:

```powershell
npm --prefix game run test -- tests/sim/arena-performance.test.ts tests/sim/arena-navigation.test.ts tests/sim/combat-auto-regressions.test.ts tests/sim/skill-eligibility.test.ts tests/sim/combat-baseline.test.ts tests/sim/combat-trace.test.ts
npm run typecheck
npm run performance:baseline
```

After stage 4 and the final diff:

```powershell
npm --prefix game run test -- tests/app/loop-pause.test.ts tests/sim/clock.test.ts tests/app/pending-work.test.ts tests/sim/combat-latency.test.ts
npm run typecheck
npm --prefix game run check
npm --prefix game run build
npm run verify
npm test
npm run performance:baseline
```

Do not repeat an unchanged passing check simply for another status update. A relevant stage edit justifies its affected checks. New timing failures require a profile/reproduction; increasing timeouts or reducing assertion coverage is not a performance fix.

### Browser evidence

Use the existing server on port 5173; check the port before starting one. At 1920 × 1080 in one headless tab, inspect the field showcase, exercise a move/manual cast and pause/resume with live debt, read console errors, and close the tab. Exclude asset work from this task. If no browser tool exists, record that limitation and use the required focused tests, Svelte check and build; do not report FPS, INP or browser-frame improvements from Node measurements.

### Evidence required in the final response

Report stage completion, actual changed files, benchmark before/after medians and P95, ledger-copy count/volume, deterministic comparison results, full-suite result and any baseline failure. Keep this in gate output/final response; no transcript file.

At the start of this plan, the latest full run had 225 passing files and one `save-fidelity.test.ts` 30-second timeout in the away boss case. The test passed 2,293 individual cases overall. This is a recorded baseline, not permission to omit that check or claim a green full suite. An unchanged baseline timeout may be reported as such after the required run; any new failure or demonstrated correctness regression keeps its stage open.

No wiki rebuild is required for behavior-preserving performance edits. Do not refresh unrelated generated data. Tests must traverse current capabilities or use isolated synthetic rows, with catalogue add/rename/remove cases where selection depends on capabilities.

## 8. Completion checklist

- [x] Stage 0: benchmark command, self-check and before evidence exist.
- [x] Stage 1: complete-tick publication is batched; public partial steps/save boundaries stay exact; offline report target met.
- [x] Stage 2: conservative collision rejection preserves corrections and navigation; no solver-policy change.
- [x] Stage 3: impossible automatic candidates skip aim; final eligibility and manual semantics remain intact.
- [x] Stage 4: 8 ms work slicing and single queued continuations cover live debt and initial offline settlement; all time is conserved.
- [x] Stage 5: required checks, final measurements, actual limitations and any unchanged baseline failure are reported accurately.

**Closeout evidence (2026-11-03):** `tools/performance-baseline.mjs` self-test passed; stage-0 offline median 3,109.2 ms and 12,040 ledger stringify/parse copies (339.1M code units), final median 639.4 ms and 606 copies (16.0M code units), same deterministic digest. Final live medians/P95: smallest basic 0.347/0.784 ms, largest basic 0.737/2.089 ms, largest skill-heavy 0.960/2.458 ms; the stage-0 skill-heavy P95 was 3.569 ms, so it did not regress. Live digests equal stage 0. The stage-0 tool did not yet collect aim diagnostics; the final skill-heavy run reports 19 misses / 3,120 coverage checks, while the synthetic impossible-candidate regression asserts zero aim work for cooldown, Never, Manual-only and wrong-weapon rows. Full suite: 227 files / 2,326 tests passed; `npm run verify` 12/12 cages passed with the three pre-existing tree PENDING rows; Svelte check and build passed (the build keeps its existing >500 kB chunk warning). Browser evidence: no browser tool was available in this session; the required Node, focused-test, Svelte-check and build gates were used instead, so no FPS/INP claim is made.

The plan is complete only when every implementation box above is supported by evidence. The document itself is complete when its links and instructions have been inspected; creating this plan does not check any implementation box.
