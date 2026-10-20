# ModWorld — engineering improvement plan

## 1. Scope and verdict

**Status: MIXED.** P0 baseline repair is READY. Later tasks depend on a green baseline and the specific evidence below. Optional refactors are candidates, not implementation commitments. This document does not itself authorize delegation, code changes, commits or dependency installation; execute only the work the user requests.

Reviewed against the active workspace on **2026-10-20**. [AGENTS.md](../AGENTS.md) owns workflow, commands, verification and workspace boundaries. This plan adds no approval requirements and does not override it.

Goal: reduce demonstrated correctness and maintenance risks while preserving gameplay values, calculation order, public callers and save meaning. No retuning, redesign, save-version change, lossy migration or external API break is included. Moving a calculation or tuning value must preserve its result.

### Latest verification evidence

| Check | Observed result | Evidence limit |
|---|---|---|
| `pnpm typecheck` | PASS on the latest run | Earlier five `camp_aid_credit_*` errors in `tools/trade.ts` no longer reproduce; its current type declares the fields. Do not schedule that repair again. |
| `pnpm verify` | 9/9 cages PASS in the preceding review | Not rerun for this document edit. Passing cages do not establish client/test correctness. |
| `pnpm test` | Preceding full run: 681 passed, 2 failed; 683 tests in 55 files | A snapshot, not a fixed test-count requirement. |
| `npm --prefix game run test -- tests/progression.test.ts tests/audit-regressions.test.ts` | Latest focused run: 44 passed, the same 2 failed | Tree configuration and wiki-section regression failures remain reproducible. |
| `pnpm check`, `pnpm build`, browser | Not run in this review | No client-build or rendered-UI verdict is claimed. |

A focused `pnpm --dir game exec ...` attempt triggered a dependency check/install and stopped on ignored esbuild build scripts before tests ran. Use the existing test script above; no package, lockfile or build-policy change is required by this plan.

## 2. Evidence and corrected findings

Paths are repository-relative. Symbols are primary anchors; line numbers are review-time pointers. Inspection covered the named paths and targeted callers, not a complete gameplay, UI/UX, accessibility or performance audit.

| ID | Priority | Confirmed evidence | Consequence / disposition |
|---|---|---|---|
| F0 | Blocker | `game/tests/progression.test.ts:50` changes `spec.shallow_nodes` and rank-tier arrays; `engine/tree.ts` uses `SHALLOW_NODES = 14` and `RANKS = 3`. `game/tests/audit-regressions.test.ts:322` extracts a literal `<h2>Elite and Boss</h2>` section and receives an empty string. | Repair baseline mismatches before broad refactoring. Empty extraction alone does not prove wiki content is wrong. |
| F1 | High | `engine/types.ts:33` uses `KMap = Record<string, number>`; `game/src/engine/client.ts` asserts JSON through `unknown`; `tools/lib/json.ts` casts parsed JSON to `T`. | Engine key typos can compile. Assertions do not validate configuration. Client exports such as `E` retain inferred JSON types, so not every removed key becomes a silent runtime failure. |
| F2 | Medium | `EngineData` lacks `max_hp_press`; `LootCfg` lacks `filter`, both read through inferred client JSON. The nine unmatched `mob` keys are `note`, `stat_block`, `power_note`, `level_rule`, `size_rules`, `species_rules`, `variant_drops_note`, `resist_rules`, `skills_note`; no executable reads of these keys were found in the searched code. | Type consumed configuration; do not describe metadata as nine missing live mechanics or require every JSON note in interfaces. |
| F3 | High | `tools/loot.ts` and `game/src/sim/drop.ts` separately implement weighted base selection and line assembly. Bias, empty dual-wield handling and frame-weight fallback differ. Cage `rollItem` draws `ilvl` after base selection; client `rollDrop` receives it. | Share common logic only with proof preserving each wrapper's RNG sequence and supported behavior. The functions are similar, not byte-identical. |
| F4 | High | LT15 in `tools/loot.ts` checks cage-generated lines against permitted baked stats. It neither invokes the client nor compares RNG traces. | Keep useful stat validation; correct the claim that it proves client parity or draw position. |
| F5 | Medium | `tools/bases.ts:93,174` reuse `BS11`; BS6 gates `weapons.length === 11`. `tools/check.ts` soft checks X21/X34/X40 mix structure and measurements. | Make IDs unique and enforce structure without content quotas or new balance gates. `mana_mult >= 1` needs classification against its owning rule. |
| F6 | Medium | Tuning literals occur in loot/skills/tree code. `CHECKPOINT_LEVELS` selects report samples; `GROUP_AVG` repeats group expectations in a cage. | Move actual tuning in separate tasks. Sampling is not automatically gameplay tuning; do not duplicate values derivable from data. |
| F7 | Medium | `game/src/sim/player.ts` computes total/per-element power; `game.ts` repeats flat HP terms encapsulated by private `mobHpOf` in `engine/index.ts`. | Candidates for engine ownership after exact caller tracing. Preserve attribution, Herald/conversion behavior and Elite multiplication order. These are not proven to be the only client formulas. |
| F8 | Low | Six test files build similar mobs; resistance tests include 75/90. Tests also use `vi.fn` and `vi.spyOn`. | Duplication is confirmed; differing scenario values are not proof of drift. No zero-mocks policy. Preserve independent expected results where they test formulas. |
| F9 | Low | `engine/index.ts` and `game/src/App.svelte` contain several domains; review-time sizes are 1,205 and 4,731 lines. | Size motivates investigation, not mandatory extraction. Require a concrete maintenance benefit before choosing module boundaries. |
| F10 | Low | Comments reference retired specs and nonexistent `tools/tree.ts`. `tools/lib/writers.ts` registers cages, not individual gate IDs. Tree tests already cover spending, adjacency, refunds and save fidelity. | Repair stale references. A new tree cage needs an uncovered structural risk; no cage does not mean no verification. Exact retired-document counts were not established. |
| F11 | Medium | `tools/map.ts` has `@ts-nocheck`; craft/client boundaries use `any`; both tsconfigs omit `noUncheckedIndexedAccess`. | Target dangerous boundaries first. The flag does not create a finite key union. No project-wide conversion is sized yet. |
| F12 | Low | `.github/` contains instructions and no workflow. | Consider CI after baseline repair; determine runtime/install policy from actual package and lockfile evidence. |

## 3. Execution rules

1. Follow current local files. Do not inspect Git state/history/remotes or other worktrees. Preserve in-flight changes; do not commit, push or pull without explicit authorization.
2. Work sequentially by default. Different packets may edit the same file at different times. Parallel delegation requires authorization and nonoverlapping ownership; this plan grants neither.
3. Preserve existing data values and saves. Add configuration only to replace an actual tuning literal; prefer derivation over redundant knobs. Do not add `note` properties to numeric maps/arrays that consumers iterate.
4. Read [DECISIONS.md](DECISIONS.md) and [game-rules.md](game-rules.md) for the affected calculation/behavior. Patch only affected documentation contracts. Appearance stays in code; definitions belong to [glossary.md](glossary.md).
5. Preserve existing `eng.*`, `loot.*`, `sm.*` callers. Add helpers where needed. Compare observable values, fields and RNG state rather than demanding byte-identical source or a fixed member count.
6. Known P0 failures are repair targets when implementation is requested. Diagnose new unrelated failures and replan before expanding scope. Never weaken an assertion or change balance merely to turn checks green.
7. Negative tests use in-memory clones or task-local temporary inputs. Do not assume cages accept an alternate-data CLI; do not mutate real data to inject failures or add a general CLI solely for tests.
8. Reuse passing checks until affected inputs change. Keep essential baselines in one task-specific temporary directory and remove it at completion. No transcript, duplicate source copy or backup file.

## 4. Order and readiness

P0 restores the baseline. Then prioritize P1 types/data and P2 gates, followed by P3 drop sharing and P5 formula ownership. Keep P4 tuning moves separate from P3. Optional structural work comes last. An engine split is not a prerequisite for an App extraction or a formula helper.

G1 scope; G2 grounding; G3 decisions; G4 contracts/dependencies; G5 safety; G6 proof; G7 stopping; G8 isolation. `P` = PASS, `F` = FAIL, `U` = UNKNOWN.

| Task | G1 | G2 | G3 | G4 | G5 | G6 | G7 | G8 | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| P0 baseline repair | P | P | P | P | P | P | P | P | READY |
| P1 key/type seam | P | U | P | F | P | U | P | P | BLOCKED on P0; then NEEDS CLARIFICATION from inspection |
| P2 structural gates | P | P | U | P | P | U | P | P | BLOCKED on P0; then NEEDS CLARIFICATION of predicates/test seam |
| P3 shared drop builder | P | P | U | U | U | F | P | U | BLOCKED on P0; then NEEDS CLARIFICATION of RNG proof |
| P4 tuning ownership | U | U | P | U | P | U | P | F | NEEDS CLARIFICATION; split by source/consumer set |
| P5 elemental/HP helpers | P | U | P | U | P | U | P | P | BLOCKED on P0; then NEEDS CLARIFICATION of inputs/tests |
| P6 fixture cleanup | P | U | P | P | P | U | P | P | Optional; NEEDS CLARIFICATION of preserved scenarios |
| P7 references/tree coverage | P | U | P | P | P | U | P | U | NEEDS CLARIFICATION; separate comments from a new cage |
| P8 engine/App modularity | U | U | U | U | U | U | P | F | Optional; NEEDS CLARIFICATION of a justified boundary |
| P9 targeted typing/strictness | U | U | U | U | P | U | P | F | NEEDS CLARIFICATION of scope/error inventory |
| P10 CI | P | U | U | U | P | U | P | P | NEEDS CLARIFICATION of runtime/install/workflow policy |
| P11 UI/UX audit | U | U | U | U | U | U | P | U | Not performed; define scope before scheduling fixes |

Unknowns are repository investigations, not questions the user must answer now. Ask only about an actual product decision, new dependency or unsafe compatibility change under `AGENTS.md`. Removing a forbidden roster-count gate while preserving structure needs no extra approval. A full UI audit is not required before every small behavior-preserving App extraction.

## 5. READY execution packet

### P0 — Restore the two reproducible regression contracts

**Objective:** repair tree-configuration and wiki regression checks without changing current balance, allocations or gameplay formulas.

**Verified context:** F0; `engine/tree.ts` (`TreeSpec`, `createTree`), `tools/data/tree.json` (`rank_tiers`, branches, graph), `game/tests/progression.test.ts` (configuration mutation test), `game/tests/audit-regressions.test.ts` (wiki extraction), `game/src/wiki/pages.ts` (page bodies). The latest typecheck passes; the focused run fails the two named checks.

**Scope:** these tree sources and two test files. Change wiki source only if tracing proves missing/incorrect content against `docs/DECISIONS.md`. Generate HTML only through `pnpm wiki`. No fixture cleanup, drop work, UI layout, save migration or new dependency.

**Dependencies:** available local sources/tooling; read exact tests and owning tree/HP contracts before editing.

**Contracts / invariants:**

- Current tree node IDs, graph, line values, costs and three ranks per node remain identical. Existing allocations load and produce identical lines/points.
- The shallow boundary becomes configurable with its current default in `tree.json`. Derive rank count from existing rank-tier arrays rather than adding a redundant `ranks` setting. Shallow/deep arrays must be nonempty and equal length; invalid configuration fails with a named reason.
- Wiki tests find a nonempty real section before asserting content. Preserve proof that body size supplies no missing HP multiplier, Boss/Unique HP comes from Core, and Elite multiplies complete HP. Use current section structure and meaningful assertions rather than an obsolete heading or one exact phrase.
- Do not skip/delete tests, restore stale headings to satisfy a brittle lookup, or change expectations without tracing the contract. If content is already correct, repair only the test extraction/assertions.

**Steps:**

1. Reproduce the two failures with the focused command in section 1; reuse that result if inputs are unchanged.
2. Capture current `createTree` output in memory or task temp storage. Include node metadata, values, ranks, costs, connectivity and representative `linesOf`/`pointsSpent` results for existing allocations.
3. Replace tree literals with the data-owned boundary and rank count derived from rank tiers; extend `TreeSpec`, add only the required key and validate shape/boundary cases without changing canonical output.
4. Trace actual world/combat blocks and HP rules. Fix section selection and semantic assertions; change wiki wording only for a demonstrated mismatch. Reuse the mutation test and add focused malformed-config coverage where it prevents incorrect tree construction.
5. Compare canonical tree results before/after. Run focused tests, then `pnpm typecheck`, `pnpm check`, `pnpm verify`, `pnpm test`. Run `pnpm wiki` because displayed tree inputs or wiki source are affected; inspect relevant generated pages. Never hand-edit generated HTML.

**Acceptance / proof:** the two regressions pass; malformed tree configuration is rejected; canonical tree output and saved allocation meaning are unchanged; all listed checks pass without unexplained test-count loss. Wiki assertions prove section existence and HP semantics. Build/browser checks are needed only if scope expands into UI behavior/layout.

**Stop / escalation:** report an exact conflict if the fix requires changing current values, IDs, formulas or save meaning, or owning sources disagree. Diagnose unrelated new failures before expanding scope; do not weaken checks.

**Handoff:** changed files/reasons, tree comparison, exact check results and affected generated wiki output. No commit or transcript.

## 6. Evidence needed to ready later tasks

These are preparation criteria, not implementation packets. Promote a task only when critical unknowns and its baseline dependency are resolved.

### P1 — Keys and configuration seam

Identify the required numeric key set independently of the existing string index. `keyof EngineData['K']` does not fix `K` while it remains `Record<string, number>`. A finite type may use a type-only view of canonical JSON or an explicit required-key contract; check resolution in both projects and ensure deleting a required data key is caught rather than silently shrinking the contract.

List consumed missing fields (`max_hp_press`, `loot.filter`). Remove casts only where actual row types and callers support it; keep tuple/union mismatches explicit. Do not enumerate every metadata note.

Choose a small validation boundary with real runtime required paths, numeric checks and the tuple/identity checks needed by affected factories. TypeScript interfaces are erased: `readJson<T>` cannot discover required keys from `T`. Keep file reading generic, pass an actual validator where required, and use the same pure validation on client imports and cage-loaded data, including `tools/lib/engine.ts`. No schema framework/dependency is presumed.

Before READY, specify proof that valid configuration loads, a required-key typo fails compilation, and missing/wrong-type inputs name the exact path without mutating canonical JSON. Checks: focused negative tests, `pnpm check` (root and client), cages and full tests.

### P2 — Structural gates

Classify affected predicates against their owning contracts. Missing/nonfinite required values, invalid IDs and broken references may fail. Tuned windows, prices, roster counts and numeric targets remain advisory. Positivity and `mana_mult >= 1` need semantic justification.

Remove BS6's count condition while retaining meaningful table/multiplier validation; avoid vacuous success on an empty required table. Make BS11 unique and search actual references. `tools/lib/writers.ts` changes only for cage registration, not every gate rename. Deleting unused `watch` is optional, not a success criterion.

Define a pure check seam accepting an in-memory mutated object to prove malformed structure causes FAIL/exit failure; assume no alternate-data option. Structural splits may add hard gates without promoting balance watches. Proof: focused cages, typecheck and full verify; wiki only when its source/displayed contract changes.

### P3 — Shared drop algorithm

Separate base selection from line assembly if it simplifies proof. A common line builder starts after slot/base selection and the cage's `ilvl` draw, with explicit slot, frame/weapon, level, quality and RNG. Keep the tier draw at its current position. Wrappers retain their level source, bias behavior and output enrichment.

Capture independent reference items and RNG draw counts/state from each old path across representative seeds, bands, slots, off hand and elemental/stat lines. Choose a pure boundary so importing a cage does not execute its CLI simulation. LT15 and the client baked-stat regression do not replace this reference.

Proof must cover each original wrapper versus its replacement using that wrapper's original full RNG stream, plus common outputs for identical builder inputs and aligned entry RNG state. Calling the same helper twice is insufficient alone. Raw cage/client wrappers need not return equal items from the same starting seed because the cage draws level separately.

Characterize supported differences, including bias, weight fallbacks and empty dual-weapon pools, before unifying behavior. Compare deterministic loot-report numbers before/after. Do not claim all aggregate rates depend solely on draw order. Checks: focused drop tests, `pnpm check`, cages and full tests. No simultaneous tuning move.

### P4 — Remaining constants

Split by canonical owner: loot tier split; skill ladder/conversion/group bonus; report/group expectations. P0 already owns tree configuration. Inspect exported `LADDER`/`CONVERSION` consumers before changing initialization or factory inputs.

Move tuning values unchanged; derive facts rather than introducing redundant knobs. Treat `CHECKPOINT_LEVELS` as sampling unless gameplay callers prove otherwise. Replace duplicated `GROUP_AVG` expectations with validation against the actual owning configuration/rules; moving a quota into JSON does not fix an inappropriate balance gate. Define equivalence checks and relevant generators for each packet.

### P5 — Elemental power and mob HP

Trace total/per-element power, weapon Element, unattributed remainder, Herald additions and percent order in `player.ts`; trace `mobHpOf`, `spawnAt` and Elite HP in `game.ts`. Reuse engine functions where sufficient; add only helpers needed for the actual formulas.

Specify independent before/after cases for mixed/no Element, flat/percent bonuses, Herald/conversion interaction and normal/Elite/Boss/Unique HP. Client and tools create separate objects from shared factories; do not assert one runtime instance. Checks: relevant element/mob/engine-agreement tests, `pnpm check`, cages, full tests and wiki when displayed formulas/data are affected. No engine split prerequisite.

### P6 — Optional test maintenance

Inventory all six mob builders and preserve every scenario's fields before considering a shared `Partial<Mob>` builder. Keep explicit overrides; merge only real duplication. One fixture for every scenario and eliminating all inline literals are not goals.

Replace 75/90 where the assertion means configured caps; preserve independently calculated expectations that catch formula errors. Preserve test meaning/count except deliberate explained coverage additions. Proof: focused files, `pnpm check` and full tests. No new framework or mock ban.

### P7 — References and tree coverage

Enumerate stale references in selected files; repair/remove only those comments and link canonical owners. Comment-only work needs file/link inspection, not gameplay/browser checks. Do not recreate deleted specs.

Separately compare existing tree tests/cages against uncovered structural risks. Add a cage only for a concrete gap, register it in `CAGES`, then verify. Gate/cage counts may change; do not gate node/rank quotas, power bands or pacing.

### P8 — Optional modularity

For `engine/index.ts`, demonstrate one cohesive boundary and dependencies before naming modules. Preserve flat API and initialization behavior without forcing consumer edits. Use sequential verification checkpoints, not required commits.

For `App.svelte`, inspect selected registry/keybind callers, closures, runes/stores and existing keybind/HUD tests. A bounded extraction can proceed without a full UI audit when its own behavior is verified. Preserve fixed 15 × 15 Hub Grid, saved-layout compatibility and panel/keyboard integration from `AGENTS.md`.

UI behavior/layout changes require focused tests, `pnpm check` and integrated-browser checks at `http://localhost:5173/__showcase#showcase-field`, 1920 × 1080, one visible tab, Playwright attached, closed afterwards. Reuse port 5173; report attachment failure instead of launching another browser. HUD placement also verifies Studio Apply preview, game Apply saving and live region movement. No redesign is implied by extraction.

### P9 — Targeted typing and optional strictness

Pick one dangerous boundary (map tooling, craft items or road/farm returns) and enumerate callers/errors. `@ts-nocheck` suppresses diagnostics; `tools/map.ts` remains included by the root project. Remove casts with actual types/guards, not non-null assertions hiding invalid states.

Evaluate `noUncheckedIndexedAccess` after finite-key work and a bounded diagnostic inventory. It is a compiler-project option; per-directory scope requires a specified tsconfig structure. No arbitrary error budget or whole-project flag change is pre-approved.

### P10 — CI

After baseline passes, inspect actual package manager, lockfiles, runtime requirements and check scripts. Define minimal workflow/install steps, OS and supported Node version from evidence. Do not guess or mandate a Windows matrix because development uses PowerShell.

Prefer existing commands, including client typechecking. Identify external Actions and versions; ask about actual new dependencies/policy decisions only as required by `AGENTS.md`. Workflow authoring does not authorize pushing or enabling services. Validate runnable commands/syntax and report hosted execution as unverified until observed.

### P11 — UI/UX audit candidate

Define a bounded scope before proposing fixes. Mixed state primitives, repeated markup and inline runtime values are not automatically defects. Ground accessibility findings in semantics/keyboard behavior, visual findings in the required viewport and performance claims in reproducible traces. Separate findings from approved redesign/gameplay changes.

## 7. Completion and handoff

Finish only the requested packet, preserve unrelated work, inspect edited files and report changes, checks, limitations and cleanup briefly. Plan-only edits require content/link inspection, not new gameplay/browser runs. Stop when acceptance criteria are satisfied. Plan revision is not implementation completion.
