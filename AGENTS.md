# ModWorld — agent working agreement

Single-player, browser-only idle RPG; no server. Shared entry point for every coding agent.

**No audio:** no music, sound effects, audio playback, or audio controls. Do not propose or add audio unless the user explicitly changes this requirement.

## Active temporary decisions (obey, do not "fix")

- **Slot saves are OFF until the game is finished** (`TEMP_DISABLE_SLOT_SAVES = true` in `game/src/state/save.ts`). No localStorage/IndexedDB slot writes, no autosave, no Save nag by design.
- Do NOT flip the flag back, do NOT add new slot-write/autosave paths, do NOT re-enable the disabled Save/Load/Import buttons, and do NOT treat the disabled state or the missing Save chooser at boot as a bug.
- Ask the user before touching anything in the save flow (`game/src/state/save.ts`, `game/src/app/session.ts`, Save panel in `App.svelte`).

## Always-on skills

`ponytail`, `lean-agent` and `polish-indent` live at `~/.agents/skills/` and in `Agent-skill/` and are **on by default in every session in this project, without being invoked**. Never wait for `/ponytail`, `/lean-agent`, `/polish-indent`, or a trigger phrase.

At the start of a session, read all files once so their full rules are in context:

- `C:/Users/ITOP/.agents/skills/ponytail/SKILL.md`
- `C:/Users/ITOP/.agents/skills/lean-agent/SKILL.md`
- `C:/Users/ITOP/.agents/skills/polish-indent/SKILL.md`

Re-read them after context compaction. Do not announce any mode.

### lean-agent — simplification lens

- Use as a simplification lens for repository implementation, fixes, reviews and investigation while preserving requested behavior and required verification.
- Task guidance for simplifying repository work, not a persistent voice. User intent and this file take precedence; tool, verification and scope policy live here — point to it rather than restating it.
- Simplify only when the result stays clear, maintainable and equivalent; complete the requested scope, correctness before effort.

### polish-indent — condense prose

- PolishIndent: condense prose, docs and UI copy without flattening the voice. Use when asked to shorten, tighten, trim or polish text.
- Cut words, never character — cut only repetition, not information or voice.
- Move numbers, tables, formulas, identifiers, file paths, commands, quotes and term names without paraphrasing; no register shift and no dropping a number, caveat or condition.

### ponytail — lazy senior dev

- Make the smallest complete change that fully solves the task. No unrequested features, options, abstractions, wrappers, or boilerplate.
- Reuse the codebase's helpers, patterns, and layers first; then stdlib/platform features; then installed dependencies. Never add a dependency for a few lines.
- Fix the root cause once in shared code, and carry the change through callers, tests, fixtures and config.
- Never cut validation at trust boundaries, error handling that prevents data loss, security, accessibility, or anything the user asked for.
- End every reply with one or two lines: what you skipped or did not check, and any risk.

## Tool calls

- Name the missing fact and how the call advances the task; reuse evidence when sufficient, keep the reasoning internal.
- Start from the path/symbol with bounded output; exclude dependencies, generated output, logs unless implicated. Expand only on evidence.
- Reuse verified reads/checks until inputs change or concrete uncertainty remains.
- Batch independent reads in one call; run dependents sequentially.
- On truncation narrow the query; on failure identify the cause, retry only with a changed approach or new evidence, else report a blocker.
- A gate that times out is retried in the same turn with a narrower scope (one file, `test:fast`, output to `.cache/`), not left for the next turn. Only a repeat with no new evidence is a blocker.
- An unrelated failing check with no changed input is baseline/in-flight: report it, don't refix or rerun without new evidence. Preserve concurrent edits; say so when verification can't repeat.
- Stop when the current task or plan item's acceptance criteria and required checks pass; a long tool sequence never justifies skipping verification. With an active plan, "pass" means checked against `docs/reference/known-failures.md`, then continue with the next unchecked item (see Plan files).

Gameplay numbers live in data JSON, formulas in `engine/`; do not duplicate either in the client. New game-content filenames use lowercase hyphens. `skill.md`, `skills.md`, `SKILL.md` and `.agents/skills/` are reserved for agent skills, not game content. Gate output is the run record; do not create transcript files.

Art guides, sources and review candidates live in topic folders under [docs/](docs/README.md): [vfx-skill](docs/vfx-skill/), [character](docs/character/animation.md) and [map](docs/map/README.md). Read the topic folder and relevant guide before art work; follow that topic's existing source/output folders. Approved runtime assets keep their established game paths.

## Answers & citations

- When the user asks for an answer, cite the supporting point briefly: file path + line, symbol, command output, or doc URL. Do not give bare claims with no source.
- If a point was not checked, say so explicitly; do not present a guess as a fact.
- Keep citations short — one reference per claim, no bibliography.

## UI integration

- Shared tokens: `game/src/styles/variables.css`; tag defaults: `base.css`; reusable appearance: `skins.css`; layout: component `<style>`. Read the tokens and the component. Keep static appearance in classes; inline bindings are for runtime values and HudLayout placement.
- UI icons use PNG shelf art through `.icon-mask` (`currentColor`); the map places the game's resolved PNG icons inside hex content. `<svg>` remains only as scene structure (tree/map geometry, charts, effects) — never a standalone icon.
- Map architecture, module ownership, shared sizing policy and extension checks: read [game/src/ui/map/AGENTS.md](game/src/ui/map/AGENTS.md) before changing the map, its App integration or generator. Keep game icons inside hexes, radius-derived sizing, north-up camera and existing command authority.
- Field showcase presets use the same `CombatArenaScene`, body models, sprite selection and skill geometry as the game. Vary sample state or explicit art review inputs; do not create a second field renderer or copy its scale formulas.
- The showcase is a DEV-only fixture layer: sample changes go in `game/src/app/showcase/samples.ts` and `fixtures.ts`, never in `App.svelte` branches or gameplay modules.
- Current shell: fixed 15 × 15 Hub Grid, shared `HudLayout` regions, one scroll owner per region. Added/moved regions update `HudRegionId`, `HUD_REGION_META`, `DEFAULT_HUD_LAYOUT` in `game/src/ui/hud/hud-layout.ts` plus `App.svelte` wiring; backfill old layouts.
- New panels wire through `PANELS`, `RAIL`, icon/label maps, keyboard actions in `App.svelte`. Reuse shared controls like `CollapseToggle.svelte`.
- Keep native semantics, labels, keyboard access, visible focus. Map arrows select adjacent Blocks; Enter walks or uses a known Waypoint, with selection announcements.
- Inspect components with HMR at `http://localhost:5173/__showcase#showcase-field`, **1920 × 1080 only** unless requested. Default to the Playwright tools in headless mode: resize to 1920 × 1080, read the snapshot and console, interact, then close the browser. One tab per check. Headed browsing only when a human must watch; when no browser tool is available, say so and fall back to the dev server, focused tests and `npm --prefix game run check`.
- For HUD placement use `#panel-hud-layout-studio`: **Studio Apply** previews, **game Apply** saves. Verify the live region moves; preserve interactions and saved-layout compatibility.

## Git Commit & Push Policy

- Local repository is the source of truth.
- When asked to commit and push, execute immediately without requesting confirmation.
- Stage all non-ignored changes using `git add -A`.
- Create a concise commit message describing the changes.
- Push to the current branch's matching remote branch.
- Use `git push --force-with-lease` when a normal push is rejected due to non-fast-forward history.
- Do not automatically pull, merge, rebase, or resolve remote conflicts.
- Do not delete branches or rewrite unrelated history.
- Do not retry failed pushes indefinitely. Report the exact error.
- After pushing, verify that the local and remote commit hashes match.
- Never claim success unless the push and verification succeed.
- Multi-session, one directory, one branch: every session and subagent works in this directory on the current branch. Never create, move, or use a worktree, and never create, checkout, or push a separate branch for incremental delivery.

## Plan files

- Every requested plan file is HTML in `docs/plan/`, English only.
- Each heading and requirement is a checklist item: `- [ ]` open, `- [x]` done; render them as real `<input type="checkbox">` in the page.
- When an item finishes, edit the file to check it and immediately continue with the next unchecked item in the same turn. Do not stop to report between items.
- Each plan keeps one resume marker in its meta block: `<p id="plan-current" class="meta">Current: <item-id></p>`. Update it when an item starts. After compaction, read the marker and continue from it, not from the top.
- Continuous execution: with an open plan, keep working until every checkbox is checked or a stop condition fires. Do not end a turn with a progress summary.
- Stop conditions, the only ones that end the turn:
  1. A save-flow edit needs explicit user approval (`game/src/state/save.ts`, `game/src/app/session.ts`, Save panel).
  2. A behavior, RNG-order, balance or UX decision has no owner answer in the plan.
  3. A failing check does not match `docs/reference/known-failures.md`, or a new failure appears with unchanged input.
  4. Tooling is unavailable (missing browser connector, unreachable server) and the item cannot be verified another way.
- Known baseline failures: read `docs/reference/known-failures.md` before judging a red gate. A failure is baseline only when its file and test name match that file. Never re-fix or re-run baseline failures to make a plan look green, and never tick an item because its only failure is baseline without recording that in the plan.
- Items that need human eyes (visual judgement, feel) go under a `Manual sign-off` heading and are not agent checkboxes. Agent verifies the mechanical part (DOM attribute, console, screenshot) and records it; the human check stays open.
- Never delete a plan file while any checkbox is open. Verify every item and record its evidence first. Delete only when the user explicitly forces deletion; the user may delete a plan themselves at any time.
- Long gates write to a log and read the summary, not the raw output: `npm --prefix game run test 2>&1 | Tee-Object -FilePath .cache/test.log | Select-String "Test Files|Tests |FAIL"`. `.cache/` and `.playwright-mcp/` are local, never commit them.
- During a plan, use `npm --prefix game run test:fast` plus focused specs; run the full suite once at closeout. Reuse recorded evidence until inputs change.
