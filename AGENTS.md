# ModWorld — agent working agreement

Single-player, browser-only idle RPG; no server. Shared entry point for every coding agent.

## Design references

ROX / Ragnarok Origin is the reference for combat feel only. Do not use Melvor or any other idle game as the reference for engine or idle architecture; those decisions cite `engine/`, `tools/data/*.json` and our own measurements. The existing gameplay feature set stays as it is.

Each fact has one owner; link, don't copy. Provider entry files carry no separate project rules.

## Tool calls

- Name the missing fact and how the call advances the task; reuse evidence when sufficient, keep the reasoning internal.
- Start from the path/symbol with bounded output; exclude dependencies, generated output, logs unless implicated. Expand only on evidence.
- Reuse verified reads/checks until inputs change or concrete uncertainty remains.
- Batch independent reads in one call; run dependents sequentially.
- On truncation narrow the query; on failure identify the cause, retry only with a changed approach or new evidence, else report a blocker.
- An unrelated failing check with no changed input is baseline/in-flight: report it, don't refix or rerun without new evidence. Preserve concurrent edits; say so when verification can't repeat.
- Stop when acceptance criteria and required checks pass; a long tool sequence never justifies skipping verification.

Gameplay numbers live in data JSON, formulas in `engine/`; do not duplicate either in the client. New game-content filenames use lowercase hyphens. `skill.md`, `skills.md`, `SKILL.md` and `.agents/skills/` are reserved for agent skills, not game content. Gate output is the run record; do not create transcript files.

## UI integration

- Shared tokens: `game/src/styles/variables.css`; tag defaults: `base.css`; reusable appearance: `skins.css`; layout: component `<style>`. Read the tokens and the component. Keep static appearance in classes; inline bindings are for runtime values and HudLayout placement.
- UI icons and map glyphs are PNG shelf art through `.icon-mask` (`currentColor`); the map scene wraps glyphs in SVG. `<svg>` remains only as scene structure (tree/map geometry, marker frames/leaders, charts, effects) — never a standalone icon.
- Map markers: shelf PNG glyph in a circular medallion on a vertical leader from the hex centre; frame/leader use hover-hex blue (`--es`). Never repaint terrain for markers.
- Current shell: fixed 15 × 15 Hub Grid, shared `HudLayout` regions, one scroll owner per region. Added/moved regions update `HudRegionId`, `HUD_REGION_META`, `DEFAULT_HUD_LAYOUT` in `game/src/ui/hud/hud-layout.ts` plus `App.svelte` wiring; backfill old layouts.
- New panels wire through `PANELS`, `RAIL`, icon/label maps, keyboard actions in `App.svelte`. Reuse shared controls like `CollapseToggle.svelte`.
- Keep native semantics, labels, keyboard access, visible focus. Map arrows select adjacent Blocks; Enter walks or uses a known Waypoint, with selection announcements.
- Inspect components with HMR at `http://localhost:5173/__showcase#showcase-field`, **1920 × 1080 only** unless requested. Default to the Playwright tools in headless mode: resize to 1920 × 1080, read the snapshot and console, interact, then close the browser. One tab per check. Headed browsing only when a human must watch; when no browser tool is available, say so and fall back to the dev server, focused tests and `npm --prefix game run check`.
- For HUD placement use `#panel-hud-layout-studio`: **Studio Apply** previews, **game Apply** saves. Verify the live region moves; preserve interactions and saved-layout compatibility.

## Commands and verification

- Git sync (user-gated, replace-only): never run `npm run sync`, `npm run sync:pull`, `git commit`, or `git push` automatically. Run `npm run sync -- "describe the checkpoint"` to replace remote with local (`push --force`), or `npm run sync:pull -- "reason"` to replace local with remote (`reset --hard`), only when the user explicitly orders that checkpoint; ask each time with the message and file summary and wait for approval. Each run checkpoints every non-ignored file, keeps a backup under `refs/backup/modworld-sync/`, then replaces one side with the other. `.gitignore` owns exclusions on the winning side. For home/office handoff, the user picks which side wins; the losing side survives only in its backup ref. Coordinate agents so files are not edited during sync.
- Single shared worktree, single branch: do not create, move, or use another worktree (`worktree_create`, `session_move`, `git worktree ...`) and do not create, checkout, or push a new branch (`git branch`, `git checkout -b`, `git switch -c`). All sessions, agents, and providers work in this directory on the current branch and share through `npm run sync`. Subagents inherit this same directory.
- Use this sync command only after user approval. Its shared Git lock prevents overlapping syncs (dead-pid stale locks are removed automatically); an unfinished Git operation or missing tracked top-level directories stop it. If sync stops on a missing path, always ask whether you really deleted it (list the paths) and wait for confirmation; rerun with `--allow-missing` only on your explicit yes, otherwise restore first. Never bypass sync with manual `git add <path>` / `git commit` / `git push` / `git reset` / `git clean`; after an approved sync verify `git status --porcelain` is empty and ask before any rerun for leftover edits.
- Never delete or reinitialize `.git`, and never run manual `git reset --hard` / `git clean` / force-push. Only `npm run sync` / `npm run sync:pull` may replace after user approval. If you deleted files/folders yourself, order the push with `--allow-missing` (pull needs no flag; it restores from remote). Missing history or a missing source directory needs investigation. Sync keeps a backup under `refs/backup/modworld-sync/` before replacing.

Windows + PowerShell; forward slashes in code paths. Run commands from the applicable root or `game/` package.

- Development: `npm install`, `npm run dev`; **port 5173 only**. Check `Get-NetTCPConnection -LocalPort 5173` first. Reuse an existing server; never start a second or kill one to reclaim the port. `npm run lint` runs the conservative Biome baseline.
- Gameplay/data: relevant cages/tests and `npm run typecheck`; broaden checks when shared behavior changes. `npm run test:changed` runs tests related to the local working-tree diff only (no fetch/upstream), including related slow tests; full gate is `npm test` (runs `game/tests/`). `npm run verify` runs all cages. `test:fast` (game) is feedback while editing, not a merge gate.
- UI: typecheck, `npm --prefix game run check` (warnings fail), focused tests, `npm --prefix game run build`, and a headless-browser check for behavior/layout changes.
- Coverage (optional report): `npm --prefix game run test:coverage`; no threshold is enforced yet.
- Docs/comments only: inspect the edited files and local links; no gameplay suite or browser check.
- Wiki: `npm run wiki` when wiki source, displayed data/formulas or player-facing behavior changes. `docs/wiki/*.html` is generated; never hand-edit. UI-only changes do not trigger wiki rebuilds.
- Other generators: `npm run skills` or the relevant `tools/` entry point when its input changes.
- Verify correctness/compatibility, not pacing bands, prices, tuned windows, roster sizes, or content quotas. Don't rerun passing checks without a relevant change.
- Test current catalogues by traversal and capabilities, not fixed content names or ids. Use isolated synthetic rows for mechanics and add/rename/remove cases; fail clearly when a required capability is missing. Each new mechanic gets a focused regression.
