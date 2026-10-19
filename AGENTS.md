# ModWorld — agent working agreement

Single-player, browser-only idle RPG; no server. This is the shared entry point for every coding agent.

## Document map

| Source | Owns | Read when |
|---|---|---|
| `AGENTS.md` | Workflow, ownership, commands and verification | Starting work; reuse once loaded |
| `docs/DECISIONS.md` | Formulas, variables and calculation order | Changing the relevant calculation |
| `docs/glossary.md` | Short definitions of game terms | A term is ambiguous, new or renamed |
| `docs/game-rules.md` | Current gameplay intent and non-obvious behavior constraints | Changing the relevant game system |
| `tools/data/*.json` | Numbers, tuning, catalogues and content | Changing or tracing those values |
| `engine/`, `game/src/` | Implementation, interfaces and UI appearance | Working on the affected code |
| `game/src/wiki/pages.ts` | Player-facing wiki source | Changing what the wiki explains |

Each fact has one owner. Link to it rather than copying it. Provider entry files import or point here; they carry no separate project rules.

## Default working skill

For repository implementation, fixes, reviews and investigation, apply [lean-agent](.agents/skills/lean-agent/SKILL.md) by default. Read it once when needed; reuse it if already loaded. No manual invocation is required. Explicit user requests for another approach or more detail take precedence. Tool policy stays here; the skill owns implementation and communication habits.

## Scope and documentation

- The current user request can change earlier design choices. Documents describe the current design, not permanent restrictions. Do not ask again solely because a requested change differs from an old design.
- UI-only work starts from components/styles and does not require formula or game-rule documents.
- Keep UI appearance and placement in code. Do not document button positions, colours, spacing, control inventories or other changing visual details.
- Edit docs only when requested, or when this task changes a documented formula, term, behavior contract or integration point that future work relies on. Patch that section only; no incidental reorganization, changelogs or unrelated rewrites.
- Skills and audit prompts follow this scope; they create no extra approval steps, documentation work or redesigns outside the task.
- Work only in the active workspace/sandbox and on files supplied for the task. The current local files are the source of truth. Do not inspect Git state, history, branches, remotes or other worktrees; do not compare the workspace with committed content.
- Preserve in-flight changes. Plan briefly for risky/cross-layer work; implement straightforward changes directly. Delegate only independent work with nonoverlapping ownership when delegation is authorized.
- Ask about unclear scope, new dependencies, destructive operations or unsafe/lossy compatibility changes. Routine choices and explicitly requested design changes need no extra approval.

## Tool calls

- Before calling, identify the missing fact or required action and how its result advances the task. Use existing evidence when sufficient; keep this reasoning internal.
- Start with the relevant path/symbol and a bounded output. Exclude dependencies, generated output and logs unless implicated. Read matching sections; expand only when evidence calls for it.
- Reuse verified reads and passing checks until affected inputs change or a concrete uncertainty remains. Do not poll unchanged state without a reason.
- Batch independent searches/reads in one call and inspect each result. Run dependent actions sequentially; do not create unnecessary parallel work.
- If output is truncated, narrow the query or select a useful slice. On failure, identify the cause before retrying; retry only with a changed approach or new evidence. Repeated failure without new evidence calls for reassessment or a blocker report.
- Follow the verification scope below. Stop when acceptance criteria and required checks are satisfied. Review an unexpectedly long tool sequence for avoidable work; a call count never justifies skipping essential verification.

## Code and data ownership

| Location | Responsibility |
|---|---|
| `engine/` | Shared formulas and data-driven mechanics |
| `tools/data/engine.json` | Stats, combat, loot, craft, mobs/zones, inventory, fieldwork and dungeon configuration |
| `tools/data/mods.json` | Mod ranges, quality bands and drop weights |
| `tools/data/town.json` | Town stock/prices, Standing, Collector, tasks, trade, Haggling, Delivery and Black Market |
| `tools/data/skills.json` | Skill roster, reserve tiers and skill configuration |
| `tools/data/tree.json` | Passive-tree specification |
| `tools/data/bases.json` | Hand-maintained frames, slots and Mod pools; never generate by parsing docs |
| `tools/data/map.json` | Presentation map layout, terrain and colours; never import in `engine/` or `game/src/` |
| `tools/` | Cages, reports and shared readers; `tools/map.ts` generates the overlay |
| `game/src/engine/client.ts` | Browser bridge to canonical JSON and shared engine factories |
| `game/src/sim/` | Runtime composition/state; `player.ts` composes the character sheet |
| `game/src/state/save.ts` | Save loading, migration and persistence |
| `game/src/ui/`, `game/src/App.svelte` | Components and application wiring |

Gameplay numbers live in data JSON, formulas in `engine/`; do not duplicate either in the client. New game-content filenames use lowercase hyphens. `skill.md`, `skills.md`, `SKILL.md` and `.opencode/skills/` are reserved for agent skills, not game content. Gate output is the run record; do not create transcript files.

## UI integration

- Shared tokens: `game/src/styles/variables.css`; tag defaults: `base.css`; reusable appearance: `skins.css`; layout: component `<style>`. Read relevant tokens and the existing component. Keep static appearance in classes; inline bindings are for runtime values and HudLayout placement.
- Current shell: fixed 15 × 15 Hub Grid, shared `HudLayout` regions and one scroll owner per region. Added/moved regions update `HudRegionId`, `HUD_REGION_META`, `DEFAULT_HUD_LAYOUT` in `game/src/ui/hud-layout.ts` and matching `App.svelte` wiring; backfill old saved layouts. Appearance inside regions follows the requested design.
- New panels connect through `PANELS`, `RAIL`, icon/label maps and keyboard actions in `App.svelte`. Reuse existing shared controls such as `CollapseToggle.svelte` where appropriate; choose Grid/Flex and composition for the task.
- Keep native semantics, labels, keyboard access and visible focus. Map arrows select adjacent Blocks; Enter walks or uses a known Waypoint, with selection announcements.
- Inspect actual components with HMR in the integrated browser at `http://localhost:5173/__showcase#showcase-field`, **1920 × 1080 only** unless another viewport is requested. Use one visible tab; close it after verification. Attach Playwright to it; report attachment failure instead of launching a standalone/headless browser or building a mirror.
- For HUD placement also use `#panel-hud-layout-studio`: **Studio Apply** previews; **game Apply** saves. Verify the live region moves. Change shared layout machinery when the task calls for it, preserving working interactions and saved-layout compatibility.

## Commands and verification

Windows + PowerShell; forward slashes in code paths. Run commands from the applicable root or `game/` package.

- Development: `pnpm install`, `pnpm dev`; **port 5173 only**. Check `Get-NetTCPConnection -LocalPort 5173` first. Reuse an existing server; never start a second or kill one to reclaim the port.
- Gameplay/data: relevant cages/tests and `pnpm typecheck`; broaden checks when shared behavior changes. `pnpm verify` runs all cages; `pnpm test` runs `game/tests/`.
- UI: typecheck, focused tests for changed behavior, and integrated-browser interaction/appearance checks for behavior/layout changes.
- Docs/comments only: inspect the edited files and local links; no gameplay suite or browser check.
- Wiki: `pnpm wiki` when wiki source, displayed data/formulas or player-facing behavior changes. `docs/wiki/*.html` is generated; never hand-edit. UI-only changes do not trigger wiki rebuilds.
- Other generators: `pnpm skills`, `pnpm gallery`, or the relevant `tools/` entry point when its input changes.
- Verify correctness/compatibility, not prescribed balance or content counts. Do not gate pacing bands, prices, tuned windows, roster sizes or content quotas. Do not rerun passing checks without a relevant change or unresolved concern.

## Saves and workspace boundaries

- Migrations preserve counts, progress and meaning. Check old-save loading, migration and round-trip when saves change; reject unknown versions. Ask before lossy changes or breaking imports/exports/external consumers. Update all readers, writers and validators when changing data identities.
- Keep tree power out of `mob_HP`. One tab owns the exclusive Web Lock for writes; other tabs stay read-only until takeover. Without Web Locks, saving stays disabled.
- Do not commit, push or pull unless explicitly asked. Commit messages use `<type: short summary>`. Establish the winning side before replace-all operations.
- Finish when the requested behavior, affected layers and required checks agree. Review edited files and acceptance criteria directly, report changes/checks/blockers briefly, and stop.
