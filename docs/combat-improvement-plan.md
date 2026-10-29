# Combat improvement plan

**Handoff:** implement READY packets T1–T6 in order. Reproduce each defect before fixing; if already fixed, verify its regression. C1–C4 need owner decisions — do not guess them.

## Contract and readiness

Follow [AGENTS.md](../AGENTS.md). Data/tuning → tools/data/*.json, formulas → engine/, runtime → game/src/sim/. Preserve roster, tuning, reward policies and concurrent edits. Exclude art, sprites, animation, VFX, keybinds and persistence implementation. Runtime aim/facing stays in scope.

Overall: **READY**. All packets T1–T6 + C1–C4 decided 2026-10-29 (round 3); executor must still check implementation baselines. This revision changes the plan only.

| Packet | G1 | G2 | G3 | G4 | G5 | G6 | G7 | G8 | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| T1 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY |
| T2 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY |
| T3 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY |
| T4 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY |
| T5 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY |
| T6 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY |
| C1 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY |
| C2 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY |
| C3 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY |
| C4 | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY |

Material findings:

| ID | Severity | Evidence / consequence | Resolution |
|---|---|---|---|
| F1 | High | Split Shot contact point and positive-radius snapshot differ; moving the circle changes targeting. | T3 preserves the release-committed center. |
| F2 | High | [SkillAction](../engine/types.ts:1036-1041) has no cluster-child action; child values/policies unauthored. | Owner supplies C1; AoE repair proceeds independently. |
| F3 | High | Chain continuation, reaction recursion and rewards differ by mechanic. | T5 preserves baseline; new policies belong to C2. |
| F4 | High | Body-target identity and homing differ; bursts copy source/destination from first release, contact can overwrite action.targetId. | C3 separates intended target from contact receipts. |
| F5 | High | `hit_class` authored per row (`engine/types.ts:505,1048`) but unconsumed — zero refs in `combat.ts`, `skills.ts:859`, `incoming-hit.ts:49`. Active phys/magic share mob dodge; incoming basics/skills share Evasion/Perfect Dodge. | C4 defines the attack/spell matrix; READY repairs preserve current behavior. |

## Shared execution rules

Per READY packet: inspect sources and tests → reproduce with a failing assertion → smallest repair → focused tests. Use actual stepCombat/tick actions, timestamps, damage and receipts; helper-only assertions prove nothing. Require a real intent/action rather than substituting an expected value when absent.

Primary casts pay once at valid release; pre-release cancellation pays nothing. Follow-up contacts are not fresh casts. Reuse current queue, action/flight identities, collision helpers and roll caches; add only required fields. Separate acquisition, approach, target identity, bearing, body facing, release and impact. Lock-on implies neither homing nor guaranteed hit. Active/passive, damage basis/element, delivery and attack/spell class are independent; infer none from the others.

T1–T4 prepare independently but coordinate shared-file edits. T5 follows T3; T6 follows T1–T5. Run serially on one checkout.

### T1 — Focus and directional range (bugs 1–2)

Status: READY. Objective: honor new focus; cast usable cones/lines without chasing their bearing anchor.

Sources: `selectCombatIntent` / `intentInRange` [combat-actions.ts:146,187](../game/src/sim/combat/combat-actions.ts), [aimForSkill](../game/src/sim/combat/combat-arena.ts:313) (focus pin `:319-321`), [focus command](../game/src/App.svelte:229,241,1098-1099).

Contracts and acceptance:
- Automatic approach toward an old eastern target; select an equally useful northern focus. Assert non-null replacement intent, northward pursuit, newly started action on the focus.
- Preserve manual commands, committed windup/recovery, slot priority, equal-utility stability without focus change.
- Canonical Cleave: two bodies 2m away at ±40°, third 8m ahead. Assert release/hits on nearby occupants without chasing the distant anchor.
- Occupants present: near/far collinear manual Venom Spray yields same valid bearing and release. Automatic shapes with no eligible occupants still approach. Preserve caster-circle and target-origin range; empty manual directional casting undecided here.
- Score actual eligible footprints: exclude dead/returning bodies; preserve documented ties, range boundaries, target stability.

Proof: game/tests/sim/{combat-scenarios,combat-arena-detarget,directional-aim,skill-shapes,manual-control,farming-ai}.test.ts.

### T2 — Ground intent and terminal basic release (bugs 3 and 5)

Status: READY. Objective: keep spatial commands independent of incidental targets; finish failed releases once.

Sources: [intent-select.ts:13](../game/src/sim/core/tick/intent-select.ts), [player-basic.ts:44](../game/src/sim/core/tick/player-basic.ts), [intents.ts:25](../game/src/sim/core/tick/intents.ts), [mob-actions.ts:43](../game/src/sim/core/tick/mob-actions.ts), [arena-work.ts:13](../game/src/sim/core/tick/arena-work.ts).

Contracts and acceptance:
- Cover manual+aimPoint death checks during approach and windup, including the basic-kill cancellation path. Released basic kills Meteor's incidental primary; survivor stays in the placed circle. Assert unchanged point, valid release, current-occupant damage, one payment/CD.
- Ordinary body-targeted casts still cancel on target loss. Keep ownership, resource, ground-validity, control and encounter checks.
- 0.25m radii with authored 0.2m edge reach: move target beyond the 0.70m center limit at release, then back inside. Same action never revives.
- Record terminal outcome at the original release beat, no damage/projectile. Preserve recovery and next-opportunity cadence; cancellation grants no earlier attack. Compare player and mob behavior.

Proof: game/tests/sim/{manual-control,combat-timing,player-basic-delivery,attack-range}.test.ts and game/tests/ui/mob-default-attacks.test.ts.

### T3 — Split Shot impact circle (bug 4)

Status: READY. Objective: honor the existing 2m circle, independent of future cluster children.

Sources: [flights.ts:83-85,114-143](../game/src/sim/core/tick/flights.ts), [flightTargets](../game/src/sim/combat/combat-actions.ts:196-210), [release snapshot](../game/src/sim/core/tick/intents.ts:154-159,181-182), [split_shot](../tools/data/skills.json:2599) (`origin:target, radius_m:2`).

Contract: collision selects impact time; membership uses the stored release-committed target-circle center and live eligible centers. Preserve that center. Contact updates receipts, not positive-radius area origin. No forced primary/interceptor hit, no children, no offline three-target cap.

Acceptance:
- Four eligible bodies inside the circle hit once; outside/dead/returning spared. Preserve per-target damage/procs, one payment/CD.
- Interceptor plus bodies inside only the committed circle versus only a contact-centered circle. Assert committed-center result and unchanged action.area.center.
- Later scheduled arrival cannot repeat damage. Preserve encounter cancellation, projectile barrier/contact ordering, radius-zero Fireball behavior.

Proof: game/tests/sim/{skill-shapes,skill-area,combat-timing,player-basic-delivery}.test.ts.

### T4 — Spawn attack clock (bug 6)

Status: READY. Objective: resolve lowercase boss/unique ranks through the authored boss clock.

Sources: [mobClock / spawnMob](../game/src/sim/core/game.ts:105-108,305,413), [field-population.ts:30-35,63](../game/src/sim/core/tick/field-population.ts) (callback only), [mobSwing](../game/src/sim/combat/combat.ts:426,456), [clock data](../tools/data/engine.json:210-214) (`normal:1, elite:1, boss:0.8`).

Acceptance: compare spawned normal/elite/boss/unique rates against canonical formulas, including lineage multiplier and cap. Generate unique rank through the normal spawn API's unique options, not an unsupported 'unique' argument. Verify opportunity timestamps with per-hit normalization together. Observed boss mismatch was 1/s vs authored 0.8/s; follow data, do not freeze tuning. Frequency alone implies no raw-DPS increase.

Proof: add game/tests/sim/mob-clock.test.ts (NEW); reuse game/tests/sim/{mob-hp,mob-skills}.test.ts.

### T5 — Existing chains and reaction regressions

Status: READY for behavior-preserving data migration and coverage. Objective: make current rules explicit without new propagation policy.

Sources: [SkillAction](../engine/types.ts:1036-1041) (no cluster/hop fields; chain state lives in [combat-actions.ts:64-65](../game/src/sim/combat/combat-actions.ts)), [chain_lightning](../tools/data/skills.json:562-574) (`action:chain-strike`, no interval/share on row), [intents.ts:267-278](../game/src/sim/core/tick/intents.ts) (`sharePct:60, intervalSec:0.08`), [flights.ts:127,141](../game/src/sim/core/tick/flights.ts), [cast-trigger.ts:59,177-179](../game/src/sim/core/tick/cast-trigger.ts), [onKill](../game/src/sim/core/game.ts:675,707-710).

Steps/contracts:
1. Move Chain Lightning's runtime interval/share into canonical action data: retain 80ms and 60%. Reuse action.interval_sec; add narrowly typed hop-share field only where needed. Validate values without inventing tuning caps.
2. Preserve three contacts including primary, 3m hops, nearest unused living target, stable ID tie-break, shared roll/effect cache, one cost/CD, separate visited sets per cast.
3. Preserve continuation after a resolved contact attempt even when no damage landed, plus shared per-world-tick trigger guard.
4. Preserve ordinary rewarded chain kills vs Profane Bloom's nonrecursive, unrewarded secondary kills. Status spread, Demolition and Thornbound keep existing policies.

Acceptance: exact contact order, interval, shares, status and cost; deterministic ties and replay; simultaneous-cast isolation; finite counts; death/reward credit once. Exercise nearest vs array order, range boundaries, no neighbor, movement, last-target removal, area exit, trigger/reaction combinations. Record ambiguous invalid-hop behavior for C2; change nothing silently. Compare equivalent scheduler windows under existing determinism.

Proof: game/tests/app/multi-hit.test.ts; game/tests/sim/{data-validation,secondary-spatial}.test.ts; skills cage.

### T6 — Documentation and integration

Status: READY after T1–T5. Objective: explain behavior actually implemented.

Update [skill columns](skill-columns.md), canonical metadata and [wiki source](../game/src/wiki/pages.ts):
- Windup includes Fixed; distinguish haste, phase floors and recovery.
- Hits may aggregate damage or schedule burst/channel/field impacts; read action with effects.
- Zero-radius lines can hit multiple targets. Separate acquisition range, footprint, hop range and child spread.
- Heal affects the player; buffEffectPct scales strength, not duration. Explain clock modifiers.
- Document child/reaction rules only once C1–C2 supply them; never present pending features as implemented.

Preserve mob kits: release-tracked projectile/ground vs windup-locked charge. New facing-angle restrictions or mob cone/line skills need owner decisions. Keep optional navigation findings (sight-aware AoE acquisition, basic-shot contact ordering) recorded; do not activate an unassigned layout here.

Note: `skill-columns.md` is outside the AGENTS.md document map — keep it a view that links to `tools/data/skills.json` + `engine/skills.ts`, never a second source of numbers. `docs/wiki/*.html` stays generated.

Proof: focused suites above, final checks below, reviewed generated wiki diff.

## C1–C4 — Decisions needed for remaining scope

Not implementation packets — all four DECIDED 2026-10-29 (round 3), implementable in order after T1–T6. **Settled:** lock-on travel is per-skill (straight or homing); every canonical player/mob row declares `hit_class`. **Owner decisions:** C1 full cluster system — 100% damage split (parent + children = one press), overlap allowed (one body may take parent + child; rolls/status/proc per impact), impact spawn 2-way ±30° at parent speed/delay, footprint = parent; system lands with NO live adopter (reserved for a future new row). C2 preserve baseline — no implementation beyond T5 (continuation after attempt, Bloom nonrecursive unrewarded). C3 two new filler rows: `Double Strafe` (straight, phys/ranged/`hit_class:attack`) + `Seeker Strafe` (homing, lightning/magic/`hit_class:spell`); 3 payloads each; `cd:6, mana:15 flat, base_flat:1450, eff:68, cast.range_m:5`; pursuit bound 5m / 0.8s; target dead/returned → remaining payloads fizzle. C4 new `spell_dodge_pct` (base 0%, cap 30%, tree-only) + new `keystone.spellward` (Wis wing, 1 attainment, +20% spell dodge / −10% Evasion, incompat: `keystone.ironwall`); Perfect Dodge + Ghost Dance apply full to spell; `ignores_dodge` bypasses both; single routed roll; `hit_class` strict; offline mirrors live. Preserve existing hit outcomes.

| Item | Minimum owner input |
|---|---|
| C1: cluster projectiles / delayed explosions | DECIDED 2026-10-29 (full system, round 3: new-row-later): budget = parent + children split one press 100% (e.g. parent 60% + 2 children 20% each); overlap allowed with per-impact rolls/status/proc (exception to the no-duplicate rule, recorded here); spawn = 2 children at impact point, ±30° from parent bearing, parent speed/delay, parent footprint; kill credit once; deterministic directions/RNG. Lands with NO live adopter (`attack.double_strike` `tools/data/skills.json:2600` is an unrelated melee row, not reused). |
| C2: chain/reaction extensions | DECIDED 2026-10-29: preserve baseline — no implementation beyond T5. Continuation after a resolved attempt even on miss; Bloom secondaries nonrecursive + unrewarded; invalid-hop behavior recorded, not changed. |
| C3: lock-on / targeted burst | DECIDED 2026-10-29 (round 3, filler mirror): two NEW rows — `Double Strafe` (straight; phys/ranged/`hit_class:attack`) + `Seeker Strafe` (homing; lightning/magic/`hit_class:spell`); no existing row reused. Both: 3 payloads, `cd:6, mana:15 flat, base_flat:1450, eff:68, cast.range_m:5`; pursuit bound 5m / 0.8s; body-ID bound; per-payload range check; body/obstacle interception per payload; target dead/returned → remaining payloads fizzle (no re-acquire); straight keeps release-aim snapshot, homing tracks same body-ID; one cost/CD; rolls/proc per payload. |
| C4: attack dodge vs spell dodge | DECIDED 2026-10-29 (round 3): new `spell_dodge_pct`, base 0% cap 30%, tree-only (no base, no Core attribute, no gear lines — verified absent: only `evasion_flat/pct`, `perfect_dodge_pct` in `tree.json`/`mods.json`). New `keystone.spellward`: Wis wing (`needs` = nearest Wis notable, executor picks), 1 attainment, +20% spell dodge / −10% Evasion, incompat: `keystone.ironwall`. Perfect Dodge + Ghost Dance apply full to spell; `ignores_dodge` bypasses both. Single routed roll: `attack`→Evasion, `spell`→Spell Dodge, `none`→no dodge. `hit_class` strict: basics use own profile class, DoT never dodges, curse hit-only rolls its class. Offline mirrors live rates. |

Retain when decisions arrive:
- Distinguish impact-circle, travelling children, delayed explosions, AI density selection.
- Spawn each authored child once; handle miss/block/obstacle/target death; compare first body/barrier contact.
- Resolve each intended impact once. Parent plus children match the authored damage budget, not an assumed universal 100%.
- No extra Mana/CD, shared-cast contamination, duplicate status/proc/reward credit, infinite propagation, orphaned encounter work.
- Deterministic directions, RNG, timestamps, damage and rewards; data-derived finite event bounds. Measure generated/pending events and crowded-field cost before performance thresholds.
- AI scores eligible child coverage or valid hop sequences, preserves focus/priority/ties, uses full lifecycle tests. Bounded nearest-neighbor chain only; no global optimizer.
- Test both lock-on modes: move between payload releases or outrun the projectile, change UI focus mid-burst, kill/remove/return target between hits, leave initial cast range. Straight keeps declared aim snapshot; homing tracks same target within authored pursuit bound. Intended identity stays distinct from mutable contact receipts. Verify interception, one cost/CD, authored hit count; preserve hit/dodge and cache scopes unless explicitly changed.
- C4 baseline: every canonical row and basic profile authors `hit_class`; [playerSwing / mobSwing](../game/src/sim/combat/combat.ts:72,426) and [resolvePreparedCast](../game/src/sim/combat/skills.ts:859) do not consume it. [Incoming hits](../game/src/sim/core/tick/incoming-hit.ts:49) passes no classification to mobSwing. Player Dodge merged into Evasion; a split must not add duplicate avoidance rolls. Preserve curse hit-only checks and field-pulse exceptions until explicitly routed.
- C4 proof: cross attack vs spell with straight/homing, melee/projectile/ground, basic/active, player/mob, direct/child/reaction/DoT. Assert correct defense rolled and the other not, including bypasses, cached multi-hit rolls, cost/CD, status/proc results. Use controlled RNG and actual HP/byMob/receipts, not nominal report.damage. Update skill, row-mechanics and incoming-defense tests; new chance values stay owner-authored.

## Commands, stop conditions and handoff

PowerShell in game/ for focused tests — direct Node avoids npm forwarding issues in this workspace:

~~~powershell
$env:NODE_OPTIONS = (($env:NODE_OPTIONS, '--experimental-strip-types --disable-warning=ExperimentalWarning') | Where-Object { $_ }) -join ' '
node node_modules/vitest/vitest.mjs run --maxWorkers=4 tests/sim/manual-control.test.ts
~~~

Final path replaces the last line; braces abbreviate separate paths, not PowerShell expansion. Root checkpoints:

~~~powershell
npm run typecheck
node --experimental-strip-types --disable-warning=ExperimentalWarning tools/skills.ts --checks
npm run lint
npm run verify
npm test
npm run wiki
~~~

Focused tests + typecheck per code slice; applicable final gameplay/data gates once after integration, per AGENTS.md. UI edits add client check/build and prescribed browser check. Never hand-edit generated HTML.

Stop only the affected packet on conflicting contract, unexplained concurrent edit, unrelated baseline failure, or required persistence/schema change outside scope. Report exact evidence; continue independent READY work. Fix no unrelated failures; rerun no unchanged passing checks.

Handoff: changed contracts/files; exact commands/results; before/after regression evidence; wiki diff; remaining C1–C4 decisions and limits. Completion means all READY acceptance passes — not that unauthored cluster, lock-on or separate spell-dodge features exist.
