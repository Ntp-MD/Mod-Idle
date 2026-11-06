# ModWorld — agent working agreement

Single-player, browser-only idle RPG; no server. Shared entry point for every coding agent.

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
- An unrelated failing check with no changed input is baseline/in-flight: report it, don't refix or rerun without new evidence. Preserve concurrent edits; say so when verification can't repeat.
- Stop when acceptance criteria and required checks pass; a long tool sequence never justifies skipping verification.

Gameplay numbers live in data JSON, formulas in `engine/`; do not duplicate either in the client. New game-content filenames use lowercase hyphens. `skill.md`, `skills.md`, `SKILL.md` and `.agents/skills/` are reserved for agent skills, not game content. Gate output is the run record; do not create transcript files.

## Answers & citations

- When the user asks for an answer, cite the supporting point briefly: file path + line, symbol, command output, or doc URL. Do not give bare claims with no source.
- If a point was not checked, say so explicitly; do not present a guess as a fact.
- Keep citations short — one reference per claim, no bibliography.

## UI integration

- Shared tokens: `game/src/styles/variables.css`; tag defaults: `base.css`; reusable appearance: `skins.css`; layout: component `<style>`. Read the tokens and the component. Keep static appearance in classes; inline bindings are for runtime values and HudLayout placement.
- UI icons and map glyphs are PNG shelf art through `.icon-mask` (`currentColor`); the map scene wraps glyphs in SVG. `<svg>` remains only as scene structure (tree/map geometry, marker frames/leaders, charts, effects) — never a standalone icon.
- Map markers: shelf PNG glyph in a circular medallion on a vertical leader from the hex centre; frame/leader use hover-hex blue (`--es`). Never repaint terrain for markers.
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
