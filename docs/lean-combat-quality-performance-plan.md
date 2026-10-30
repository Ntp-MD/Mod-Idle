# Lean combat, quality and performance plan

Status: **IN PROGRESS — P1–P5 implemented and covered by focused suites; P0 live baseline numbers, P6 profiling and P7 live acceptance remain.** Decisions are settled below; see the delivery log for what landed and what is still open.

Created 2026-10-29 after live-play feedback: field mobs feel staged, aggro is difficult to predict, and the browser can stall. This plan reduces overlapping behavior rules, protects combat/save correctness and measures responsiveness in the real application.

## Outcome and boundaries

Follow [AGENTS.md](../AGENTS.md). The existing roster, skills, stats, damage formulas, loot, rewards, resource costs and offline credit policies keep their canonical owners. This is a simplification of field behavior and runtime execution, not a content expansion or balance pass.

The target is a field where the reason for each body to move, attack or stop can be explained from its target, attack range, current action and explicit player commands. Each movement sample has one chosen movement command. UI selection, camera layout and skill-bar composition must not create hidden enemy awareness or movement restrictions.

The user's classic-inspired direction informs behavior simplicity. Exact parity with a particular Ragnarok version is not asserted here. Engine and idle architecture decisions use this repository and measurements, not another game's architecture.

Preserve seeded determinism, committed action timing, projectile/body/barrier contact, per-impact receipts, resource payment, rewards and save compatibility. Preserve exposed settings unless an explicit decision below changes their behavior. Do not reduce population, disable skills, discard elapsed simulation time or weaken collision correctness to obtain a performance pass.

Out of scope: new tactical roles, adaptive difficulty, anti-kite intelligence, a general behavior-tree framework, new skill adopters for cluster, new art/animation systems, renderer replacement, server work and unrelated tree/economy redesign.

## Starting evidence and ownership

These are observations from an evolving working tree, not a frozen implementation baseline. P0 must recheck them after concurrent changes land.

| Evidence | Consequence | Owner / entry point |
|---|---|---|
| Focus and an approach intent can add a distant body to engagement before a hostile contact. A controlled engagement-stage probe focused a body 29 m away and also pulled its neighbour. | Selection and preparation have enemy-side effects. | [engagement.ts](../game/src/sim/core/tick/engagement.ts), [intent-select.ts](../game/src/sim/core/tick/intent-select.ts) |
| Previously assisted bodies become depth-zero assist sources on the next sample. The probe expanded `A,B` to `A,B,C` to `A,B,C,D`. | The documented one-link rule cascades across samples. | [engagement.ts](../game/src/sim/core/tick/engagement.ts) |
| Aggro/assist currently use field-wide ranges without consulting per-mob aggression/assist eligibility or sight geometry. | Different mobs inherit the same awareness rule. | [engagement.ts](../game/src/sim/core/tick/engagement.ts), [spawns.json](../tools/data/spawns.json) |
| Anchor hold derives a pursuit boundary from equipped skill ranges; melee contact assignment reserves tiered bearings around the player. | Hidden restrictions and formations can make valid combat appear stuck. | [arena-step.ts](../game/src/sim/core/tick/arena-step.ts), [combat-arena.ts](../game/src/sim/combat/combat-arena.ts) |
| Idle movement follows a time-based sine/cosine orbit around fixed slot homes. | A repeated choreography is built into the simulation. | [combat-arena.ts](../game/src/sim/combat/combat-arena.ts), [spawns.json](../tools/data/spawns.json) |
| Field archives retain lives/statuses but clear actor positions. Boss spawning calls arena-wide cancellation. | Scene changes and population changes can alter unrelated combat state. | [field-area.ts](../game/src/sim/world/field-area.ts), [field-population.ts](../game/src/sim/core/tick/field-population.ts) |
| The original wake could execute up to eight simulation seconds synchronously. In an isolated root-page fight at speed ×4 and CPU throttle ×6, a requested 4 s observation took 11.33 s, with a maximum frame gap of 7.38 s and a 7.30 s long task. | Backlog processing can monopolize the browser thread. This synthetic stress case does not identify the user's exact hardware/save failure. | [loop.ts](../game/src/app/loop.ts), [clock.ts](../game/src/sim/core/clock.ts) |
| A wall-time yielding patch is already present and focused loop tests passed; equivalent live stress acceptance is still outstanding. | Reuse and validate this work instead of implementing a second scheduler. | [loop.ts](../game/src/app/loop.ts), [loop-pause.test.ts](../game/tests/app/loop-pause.test.ts) |
| A single isolated tab became read-only after HMR. Cleanup flushes before releasing its writer lease; the replacement component requests a lease immediately. | A same-document remount can mistake its own departing instance for another tab. The race is not yet repaired. | [App.svelte](../game/src/App.svelte), [accountWriterLock.ts](../game/src/state/accountWriterLock.ts) |
| Pending-work capture serializes attacker snapshots; restore currently groups roll caches by action ID. | Cost needs measurement, and independent C1/C3 payload caches must not be merged after reload. | [settlement-stage.ts](../game/src/sim/core/tick/settlement-stage.ts), [pending-work.ts](../game/src/sim/core/pending-work.ts) |

Other agents are already removing role-driven behavior, returning and role-driven kiting. Treat their final diff as P0 input. Do not restore their removed logic from stale tests or parallel patches.

Earlier combat work and historical gate passes do not satisfy the live behavior/performance acceptance of this plan. Re-establish acceptance against the integrated working tree.

## Proposed behavior contract

1. Focus is the player's selection. Approach is the player's movement intent. Neither alerts a mob by itself.
2. Enemy awareness begins through authored proximity aggression, a resolved hostile contact attempt or an eligible direct assist. A contact attempt includes hit/miss/block outcomes; a cancelled cast or empty area does not fabricate a contact.
3. Direct assist sources are retained as causes. An assisted body does not become a fresh proximity/attack source merely because it remains engaged on the next sample.
4. Acquisition and sight use the same authored navigation facts. Test open ground and sight-blocking geometry separately; never infer collision from decorative artwork.
5. An engaged mob approaches according to its actual attack/cast range and action commitment. Tactical formations and role-based spacing are absent from the lean baseline.
6. Player commands obey existing control and cancellation rules. A manual move does not silently establish a new pursuit mode. A skill-bar edit does not change how far the player is permitted to walk.
7. Death, control, target loss and explicit field transitions own their existing lifecycle consequences. No hidden home-heal reset, rank-spawn reset or new return state is introduced.
8. Collision and navigation remain authoritative. Simplifying formation must not permit stacking through walls, overlapping bodies or damage from outside reach.

The following data/policy decisions must be authored before the affected behavior is changed. Technical fixes and measurement work may proceed independently.

| Decision | Recommended lean direction | Affected work |
|---|---|---|
| D1: which existing mobs initiate proximity aggression and which assist whom | Small explicit eligibility fields in canonical mob data; no tactical role taxonomy. Do not label the entire roster passive or aggressive by guesswork. | P2 roster mapping |
| D2: when a mob loses an unavailable target, including sight loss or an unreachable route | One documented target-loss rule with bounded path retry; no home return/heal choreography. Exact retention semantics need an owner choice. | P2 chase termination |
| D3: the exposed Auto Avoid setting | Retain the setting and saved preference. Review its default and scope separately; do not silently delete it while removing role-driven kite. | P3 optional avoidance |
| D4: status lifetime while a field is inactive | State the existing intended hold/expiry rule and preserve rewards. Do not invent background simulation of every archived field. | P4 inactive status handling |

## Settled decisions (2026-10-29)

These resolutions are the authored policy for the packets below; an executor must not invent a different roster rule.

### D1 — Proximity aggression and same-species assist

Canonical shape: every `tools/data/engine.json` `mob.species` entry carries two fields, validated by the mob data cage:

- `"aggro": "proximity" | "retaliate"` — `proximity` initiates on the zone profile's `aggro_m` and clear sight; `retaliate` never initiates and only answers a resolved hostile contact.
- `"assist": true | false` — a directly alerted body with `true` wakes living bodies of the **same species** inside the zone profile's `assist_m`. Cross-species assist is not authored. An assisted body never becomes an assist source on a later sample.

The mapping follows each species' own authored trait line, not a new role taxonomy:

| Eligibility | Species |
|---|---|
| proximity, assist | goblin, orc, kobold, spider, wolf, human, lizardman, elf, werewolf, imp, hornet, harpy, bonehound, dryad, beetle |
| proximity, solo | ogre, troll, minotaur, skeleton, vampire, demon, dragon, giant, siren, wraith, wyvern, wisp, revenant, mirehydra, slaggolem, wyrmling |
| retaliate, assist | none |
| retaliate, solo | mummy, slime, golem, treant, ooze |

`retaliate` species still fight normally once contacted; the field simply stops staging them into the pull. Ranges stay owned by `spawns.json` (`aggro_m`, `assist_m`), not by species. Roster changes must update this table and the data in the same change.

### D2 — Target loss and pursuit retention

Engagement ends only on body death, player death or a field transition — the existing lifecycle. No leash timer, no home return, no home heal, no rank respawn. A body that cannot route to the player retries the route on the existing 250 ms replan beat and, after three consecutive failed plans with the goal unchanged, holds its current ground until the player moves at least 1 m or a plan succeeds. While holding it stays engaged and keeps its attack plan; this is a local blocked-route response, not a new state machine. Sight loss alone does not release a body that was alerted by contact; proximity acquisition additionally requires clear sight on `arena.nav`'s sight mask.

### D3 — Auto Avoid

The `autoAvoid` setting and its saved preference stay, default on. Its only scope is the current bounded escape from a heavy committed ground threat (`planAutoAvoid`): it plans a step outside that landing circle, holds until the flight lands, and never owns pursuit, anchoring or range decisions. Turning it off produces no avoidance movement; turning it on cannot replace the ordinary approach or a manual order.

### D4 — Status lifetime while a field is inactive

A living body's statuses and marks freeze with its identity, HP and ground position in `slot.life` while the field is archived, and restore with the same remaining stacks/seconds on re-entry. Nothing ticks, decays or pays rewards in an inactive field; respawn deadlines stay absolute clock seconds and refill when the field is current again. This is the existing hold rule stated explicitly, not a new mechanic.

### P0 scenario record

Reproducible inputs for before/after comparisons (fill the measured columns when the root page is profiled; a seeded fixture run is supplementary, never a substitute):

| Input | Value |
|---|---|
| Build / browser / hardware | record per run |
| Seed | `811` (seeded fixture) and the copied save's own seed for the root page |
| Field | zone 3, `forest-clearing`, authored cap |
| Loadout | level 60, `attack.firestorm` first slot; root page uses the copied save's own bar |
| Settings | defaults, `autoSkills` on, `autoAvoid` on, speed ×1/×2/×4 |
| Root-page script | load → enter field → fight 60 s → focus a body ≥ 20 m away → issue a move → ×4 → pause/resume → leave/re-enter → reload with a pending flight |

Measure engine step time separately from reactive render, persistence and startup; report p50/p95/p99, worst task, debt drain and retained counts. Record synthetic ×4 + CPU ×6 throttle as stress only.

## Work packets and order

| Packet | Deliverable | Dependency / shared-file rule |
|---|---|---|
| P0 | Freeze a reproducible baseline and reconcile concurrent cuts | First; one integration owner |
| P1 | Responsive wake and reliable startup/remount ownership | After P0; independent of behavior data decisions |
| P2 | Explicit aggro and direct assist | After P0; D1/D2 only block their respective policy portions |
| P3 | One movement decision; remove hidden hold and formation rules | After P2; run serially on shared arena files |
| P4 | Coherent field life and simple idle movement | After P3; D4 only blocks inactive-status semantics |
| P5 | Impact/cache ownership and scoped cancellation | After P2/P3; coordinate core and pending-work edits |
| P6 | Optimize measured hotspots | After the relevant P1–P5 behavior is stable |
| P7 | Real-application integration, documentation and final acceptance | Last |

### P0 — Reproducible baseline

- Read current diffs and record which role/returning/kite changes already landed. Assign a single editor to `combat-arena.ts`, `game.ts` and each tick module while they are shared.
- Reproduce with a copied save in an isolated browser profile; never wipe the user's save to make a check pass. Also keep one seeded fresh-character field scenario.
- Record seed, save/version, field/layout, authored population, loadout, settings, game speed, browser/build and hardware. Keep the same inputs for before/after comparisons.
- Capture a root-page session: start/load, enter a field, fight, focus a distant body, issue a move, change speed, pause/resume, leave/re-enter a field and reload with pending work.
- Measure engine execution separately from reactive state, rendering, persistence and startup. Label a 50 ms combat step separately from a whole world-second `tick`; do not compare the two as the same unit.

Acceptance: a bounded script reproduces the symptom or records its absence with the actual state/console. The baseline is not replaced by a showcase-only result or a helper-only assertion.

### P1 — Yield work and recover initialization correctly

Sources: [loop.ts](../game/src/app/loop.ts), [App.svelte](../game/src/App.svelte), [accountWriterLock.ts](../game/src/state/accountWriterLock.ts), [session.ts](../game/src/app/session.ts).

- Validate the existing wake budget patch: complete a step, check elapsed wall time, return to the browser at the `LIVE_STEP_MS()` budget, and retain all unexecuted simulation steps and the fractional remainder.
- Keep one simulation clock. Pause adds no new elapsed time; debt earned before pause remains payable. Input/rendering get another event-loop turn during a backlog.
- Coordinate same-document teardown flush and actual writer-lock release before the replacement instance requests ownership. Keep real cross-tab acquisition non-stealing and read-only when busy.
- Release the old lease even when flush fails, while preserving/reporting the storage failure. Abort waits and initialization safely when the component is disposed.
- Handle startup settings/catch-up failures through the existing error/read-only presentation. A failed initialization must not leave an apparently Running shell with a silently unarmed loop.

Acceptance: slow-step regression fails the original all-at-once wake and passes the budgeted wake; after debt drains, the same seed/commands reach the same simulation outcome. Test HMR during a delayed flush, actual lock release, flush rejection and a genuinely occupied second tab. Verify root-page ×4 stress still accepts pause/move commands.

Proof: extend the existing loop/pause, session, writer-action and save-storage suites only where the lifecycle is observable. Use an injected wall clock for deterministic scheduler tests; no busy-wait test or gameplay pacing assertion.

### P2 — Make aggro explainable

Sources: [engagement.ts](../game/src/sim/core/tick/engagement.ts), [intent-select.ts](../game/src/sim/core/tick/intent-select.ts), [player-basic.ts](../game/src/sim/core/tick/player-basic.ts), [game.ts](../game/src/sim/core/game.ts), [engine data](../tools/data/engine.json), [spawn data](../tools/data/spawns.json).

- Remove focus/approach as enemy awareness triggers. Trigger retaliation through the actual hostile contact lifecycle, retaining projectile interception and delayed-area membership.
- Separate directly alerted causes from assisted membership with the minimum required state. Fix cross-sample assist propagation; a permanent depth tree or second threat engine is unnecessary.
- Apply the D1 eligibility mapping and authored ranges. Keep explicit retaliation independent of proximity-aggression eligibility.
- Check sight where authored geometry exists. Apply the D2 target-loss rule at the acquisition/chase boundary; no per-frame target reset or hidden leash healing.
- Produce a small reason receipt for diagnostics only when engagement changes. Avoid per-sample log spam and a new player-facing debug panel.

Acceptance: focus at 29 m causes no awareness; a failed out-of-range/pre-release action causes none; a real attack attempt alerts the affected body once. In an `A–B–C–D` chain, direct A plus assisted B remains A/B across later samples until a new legitimate cause occurs. Cover passive/aggressive/assist eligibility, species restrictions, sight screens, target death and field exit through actual combat steps and action receipts.

### P3 — Remove overlapping movement policies

Sources: [arena-step.ts](../game/src/sim/core/tick/arena-step.ts), [combat-arena.ts](../game/src/sim/combat/combat-arena.ts), [auto-avoid.ts](../game/src/sim/combat/auto-avoid.ts).

- Choose one movement command per sample using existing death/control, manual-command and committed-action rules, followed by simple approach or idle movement.
- Remove implicit `anchorHold`/`anchorHoldFor` pursuit limits and the coupling to the longest equipped skill range. Preserve an explicitly exposed stay/travel setting according to its own contract.
- Remove tiered contact reservations and player-relative formation choreography. Retain attack-range stopping, body clearance, static collision and a minimal local response to a blocked route.
- Keep ranged bodies governed by their authored reach. Do not add tactical retreat, orbiting or anti-kite behavior through replacement names.
- Apply D3 independently. If Auto Avoid remains, it owns only its documented temporary escape; it cannot silently become a permanent anchor or generic pursuit policy.
- Remove obsolete runtime fields/readers/tests only after confirming their remaining consumers. Keep old save input compatible without persisting dead behavior.

Acceptance: a plain manual move does not create an invisible hold circle; changing the bar does not change pursuit permission. Melee bodies reach valid attack opportunities without waiting for a formation, while collisions and wall boundaries remain correct. Cover crowded contact, narrow passages, moving targets, manual cancellation, committed releases and Auto Avoid off/on separately.

### P4 — Preserve a field without staging it

Sources: [field-area.ts](../game/src/sim/world/field-area.ts), [field-population.ts](../game/src/sim/core/tick/field-population.ts), [combat-arena.ts](../game/src/sim/combat/combat-arena.ts), [spawns.ts](../engine/spawns.ts), [spawns.json](../tools/data/spawns.json).

- Replace continuous sine/cosine orbiting with a simple seeded idle decision: choose a reachable destination or wait, then decide again at an authored decision beat. Avoid a new tactical planner or RNG draw every render frame.
- Author any new idle decision interval or wait probability in canonical data before enabling it; no replacement magic numbers in runtime code.
- Keep idle RNG independent of combat outcome draws. Reuse slot identity and deterministic state; store/reconstruct only what a reload actually needs.
- Keep current authored spawn layouts, population, respawn and rank rates during the initial lean pass. Location variation is a later data decision if play review still finds the field staged; do not add uncalibrated geometry or arbitrary jitter.
- Archive living identities, HP and valid positions coherently. Re-entering a field must not relocate living bodies to slot homes merely because a renderer was recreated.
- Apply D4 explicitly. Verify respawn deadlines and partial/inactive life handling without introducing a second population or ticking every inactive map.

Acceptance: idle bodies do not follow synchronized circular paths; a repeated seed/save reproduces decisions. Leave/re-enter and reload preserve valid positions/lives under the documented status rule. Death refills only its own slot on its existing timer; no duplicated kill, reward or body.

### P5 — Protect action and save quality

Sources: [arena-work.ts](../game/src/sim/core/tick/arena-work.ts), [flights.ts](../game/src/sim/core/tick/flights.ts), [pending-work.ts](../game/src/sim/core/pending-work.ts), [field-population.ts](../game/src/sim/core/tick/field-population.ts).

- Give each cancellation an explicit owner and scope: action before release, individual blocked/fizzled payload, or actual encounter invalidation. A boss joining a continuing field is not automatically a reason to cancel unrelated released work.
- Preserve intended target identity separately from contact receipts and committed area geometry.
- Preserve cache ownership through capture/restore: ordinary shared-cache multi-hit/chain impacts stay shared; independent cluster children and targeted-burst payloads stay independent. An action ID alone must not decide cache sharing.
- Preserve one payment/CD per cast and exactly-once impact/status/proc/kill/reward handling. No new queue or dispatcher framework is required.
- Keep existing save envelopes and schema unless a demonstrated compatibility need requires a deliberate migration. Never discard valid pending work to silence a load problem.

Acceptance: reload between payloads produces the intended roll/cache scopes, no reroll of committed shared results, and no merged independent results. Boss spawn, body interception, obstacle stop, death, field exit and invalid saved input each have the correct bounded terminal outcome.

### P6 — Optimize the measured work

Profile after removing the unnecessary behavior work. Pick the largest measured cost, repair it, and remeasure before adding another optimization.

| Candidate | Measure first | Allowed direction / guard |
|---|---|---|
| Per-sample all-pairs contact/separation and repeated actor scans | Calls, candidate pairs and CPU share per combat step | Remove formation cost first; reuse a per-sample actor view or existing navigation buckets if needed. Preserve nearest/contact ordering and exact geometry. |
| Pending-work JSON copying and repeated Character snapshots | Capture time, copied bytes, flights and copies per cast | Reuse immutable per-cast facts and capture at a proven dirty/durable boundary. Save/unload must still capture every committed unsettled impact. |
| Character/target/skill derived work | Rebuild counts and dependencies under live reactive state | Cache only across unchanged inputs; invalidate on actual stat, gear, status, skill or target changes. Compare outcomes with the uncached path. |
| Scene history, DOM/SVG effects and allocation churn | Frame CPU, retained actions/frames/payloads, nodes and heap trend | Retain bounded history and read-only interpolation; coalesce presentation updates without dropping gameplay receipts. |
| Startup/tree and bundle loading | Startup timeline and input readiness | Defer view-only geometry/assets when profiling justifies it. Tree mechanics needed by the sheet remain available. Avoid solving geometry per render. |

Do not introduce a spatial index, object pool, worker migration, global cache or new scheduler unless a measured remaining cost requires it. No performance threshold may be satisfied by a smaller encounter or reduced gameplay work.

Acceptance: same inputs produce compatible simulation outcomes after scheduled debt drains; the declared live workload has lower measured cost and no new unbounded retained work. If a single step still exceeds the wake budget, profile and reduce that step; yielding alone does not close the performance work.

## Performance measurement and proposed budgets

Use the real root application at `http://localhost:5173/` with a copied save and the authored field. Use `http://localhost:5173/__showcase#showcase-field` as supplementary component evidence. Headless, 1920 × 1080, one tab per check; close the browser afterwards and reuse port 5173.

Run normal and crowded authored fields, direct/basic and existing multi-impact loadouts, and ×1/×2/×4. Repeat the ×4 CPU-throttle-×6 scenario as synthetic stress. Record cold and warmed samples separately and run timing checks without simultaneous builds, cages or full-suite workers.

Record p50/p95/p99 combat-step and wake wall time, input-to-judgement latency, frame gaps/long tasks, accumulated debt and drain progress, pending/generated events, history counts, snapshot bytes/cost and retained heap after repeated scenario cycles. Engine-only timings cannot certify browser responsiveness.

Proposed engineering acceptance budgets, to be recorded with the baseline hardware/browser:

- Wake work yields at `LIVE_STEP_MS()`; an individual wake can exceed it by at most the final completed step. All unexecuted time remains owed.
- Normal workload: p95 input judgement within 100 ms; ×4 synthetic stress: p95 within 250 ms. These are responsiveness targets, not combat timing or balance values.
- No repeated main-thread stall of 1 s or more in the bounded root-page scenario. Capture the worst task as well as percentiles.
- Pending work/history/cache counts stay within data-derived lifecycle bounds and return to their expected settled size after the scenario ends. Heap reaches a repeatable plateau rather than growing every cycle.
- Pause, save, load and target selection remain usable during a backlog. No exception/unhandled rejection and no unexplained read-only transition.

If a budget fails, retain the measurement and fix the responsible work. Do not quietly widen it, shorten the workload or label the plan COMPLETE from passing unit tests.

### P7 — Integration and handoff

- Run packet-focused regressions and relevant data cages after their inputs change. Broaden once after integration; preserve unrelated concurrent work and report baseline failures according to AGENTS.md.
- Verify the root-page script with the exact integrated code and copied save. Repeat HMR/reload and real cross-tab writer scenarios; a showcase-only pass is insufficient.
- Update [skill columns](skill-columns.md) and [wiki source](../game/src/wiki/pages.ts) only for behavior actually delivered. Rebuild wiki when player-facing behavior changes and review generated output. Never hand-edit generated HTML.
- Retire misleading comments, dead fields and tests that encode removed tactical policies. Keep regressions for range, timing, payments, contacts, determinism and saves.
- Record the final behavior contract, actual commands/results, before/after measurements, remaining decisions and any limits. Gate output is the run record; do not add transcript files.

## Delivery log (2026-10-30)

What landed, with the evidence that closes each packet's implementation (live acceptance stays open where stated):

- **P1** — [accountWriterLock.ts](../game/src/state/accountWriterLock.ts) gains a bounded `retryMs` handoff: a busy lock is retried with a real wait so a same-document replacement survives the departing instance's flush, while a genuinely occupied tab still resolves `busy`; the caller's abort signal ends the wait and a late grant is released. The live browser rejected `LockOptions.signal` and reported the writer unsupported, so cancellation is owned by the helper instead of that browser option. [App.svelte](../game/src/App.svelte) aborts that wait on disposal and releases the lease in `.finally`, so a rejected final flush is reported without stranding the browser-wide lock. Focused coverage: [writer-lock.test.ts](../game/tests/app/writer-lock.test.ts); the existing budgeted wake in [loop.ts](../game/src/app/loop.ts) keeps its passing [loop-pause suite](../game/tests/app/loop-pause.test.ts).
- **P2** — `tools/data/engine.json` authors `mob.engagement` (`proximity`, `assist`) exactly as D1 lists, validated in [validate.ts](../engine/validate.ts) with a negative test in [data-validation.test.ts](../game/tests/sim/data-validation.test.ts). [engagement.ts](../game/src/sim/core/tick/engagement.ts) now derives membership from authored proximity (with the sight mask), resolved contact, pinned released work and one same-Species assist link; focus, approach and intent no longer alert. Each member carries a persisted cause (`proximity`/`contact`/`assist`), which is the diagnostic receipt and stops assisted bodies from re-seeding. Contact alerts hook the canonical resolvers: player basic contact in [player-basic.ts](../game/src/sim/core/tick/player-basic.ts) and the cast report's `attempted` bodies in [skills.ts](../game/src/sim/combat/skills.ts) / [cast-trigger.ts](../game/src/sim/core/tick/cast-trigger.ts) (a dodge or block still counts; a cancelled or pre-release press does not). D2's bounded retry lives in [combat-arena.ts](../game/src/sim/combat/combat-arena.ts): a failed route retries on the 250 ms beat, and after three failures on an unchanged goal the body holds ground until the goal moves 1 m. Coverage: [engagement.test.ts](../game/tests/sim/engagement.test.ts), [field-area.test.ts](../game/tests/app/field-area.test.ts).
- **P3** — Removed `anchorHold`/`anchorHoldFor`, the `ManualControl.anchor` field and the tiered contact claims (`assignContactPoints`, `CONTACT_BEARING_TIERS_DEG`, `arena.contacts`, `waitingForContact`). A melee body now walks to its own attack stop distance; body clearance, static collision and a one-sample sidestep around a blocking neighbour answer a crowd. Auto Avoid keeps its existing bounded heavy-ground escape. Coverage: the updated [combat-arena](../game/tests/sim/combat-arena.test.ts), [arena-navigation](../game/tests/sim/arena-navigation.test.ts) and [detarget](../game/tests/sim/combat-arena-detarget.test.ts) suites, including "changing the bar does not change pursuit".
- **P4** — Idle movement is a seeded decision at an authored beat (`idle_decision_sec`, `idle_wait_pct` in [spawns.json](../tools/data/spawns.json), parsed in [spawns.ts](../engine/spawns.ts)): each unengaged body picks one spot inside its roam or waits, using `spawnSlotSeed` identity — no sine orbit. Field archives now retain living ground positions, and a restored field keeps saved ground for bodies the new renderer has not created yet. Coverage: the new archive-position regression in [field-area.test.ts](../game/tests/app/field-area.test.ts) plus the existing respawn/status cases.
- **P5** — Boss spawn no longer cancels all released arena work and boss death no longer cancels other bodies' committed work; the epoch still advances. Cache ownership through capture/restore keeps the `rollCacheId` identity captured per live cache, so shared multi-hit caches stay shared and independent cluster/targeted payloads stay separate. Coverage: [boss-arena](../game/tests/sim/boss-arena.test.ts), [pending-work](../game/tests/app/pending-work.test.ts), [arena-resync](../game/tests/sim/arena-resync.test.ts).
- **Docs** — The player-facing combat sentence in [wiki pages](../game/src/wiki/pages.ts) now states the proximity/contact/one-link assist rule; `npm run wiki` rebuilt `docs/wiki/`.
- **P0/P7 live smoke (partial, 2026-10-30)** — Root page, fresh browser profile (new character, no imported save), 1920 × 1080 headless: writer ownership acquired; Eastgate → Open Grassland; one fight at ×1 then ×4. At ×4 over 6 s the page produced 360 animation frames with p50 5.9 ms, p95 23.5 ms, p99 29.4 ms, worst 47.2 ms and **zero long tasks**; Pause froze `data-arena-time` exactly and Resume advanced it; an HMR remount of [App.svelte](../game/src/App.svelte) kept the writer (no read-only banner) and the sim kept advancing. This is a smoke record, not the P0 baseline or a full P7 pass — no copied-save reload with pending work, CPU-throttled stress, or cross-tab takeover was run.

Open, with the reason:

- **P0** — the scenario table has inputs but not the copied-save root-page measurements. The smoke above exercises the new-character path only; the seeded fixture run and the copied-save numbers still need the declared workload.
- **P6** — no profiling pass yet, so no hotspot has been selected or optimized. The work removed an entire per-sample formation solver and the per-sample intent/focus scans; those are measured next, not claimed as a pass.
- **P7** — the smoke covered the fresh-character field, ×4 pause/move and an HMR remount. Still open: a copied-save reload with pending work, a genuinely occupied second tab (read-only takeover), and the CPU ×6 stress repeat.
- **Known non-plan failures in the working tree** — `engine-agreement.test.ts` fails to load under the Node vitest invocation (`require` of a `.ts` bridge), and `combat-arena-view.test.ts` "F38 in-flight hazards" expects skill-tagged flights that the current scene filter intentionally excludes (ordinary-shot telegraphs only). `save-storage` "unreplaced stale mirror" timed out once only under the full-suite load and passes alone. None of the three is caused by this plan's changes; they are reported, not fixed here.

## Verification commands

Documentation-only planning changes require checking this file and local links, not running gameplay/browser suites.

For implementation, run focused Vitest files from `game/` through direct Node as needed for PowerShell forwarding. Select existing files by affected packet rather than copying a broad list into every slice. Relevant starting points include `loop-pause`, `combat-latency`, `field-baseline`, `field-area`, `arena-navigation`, `arena-release-guards`, `mob-default-attacks`, `pending-work`, `save-session`, `save-storage`, `cluster` and `lock-on` suites. Add regressions for uncovered behavior, not assertions that merely restate implementation.

Final applicable checks:

```powershell
npm run typecheck
npm --prefix game run check
npm run lint
npm run verify
npm --prefix game run test -- --maxWorkers=2
npm --prefix game run build
npm run wiki
```

Run skills/spawn checks when their canonical inputs change. Run the final full suite with no competing performance workload; the previous high-concurrency suite timed out an offline case which passed in isolation and in the two-worker run. Do not modify gameplay or mask assertions to work around resource contention.

## Completion rule

Close packets individually against demonstrated acceptance. Close the plan only when the behavior decisions affecting delivered changes are settled, root-page gameplay is understandable and responsive, combat/save compatibility passes, the measurement budgets pass on the declared workload, and the applicable integration checks pass. Record partial or blocked packets accurately; historical gate passes and a reduced implementation line count are not completion evidence.
