# Agent Rules — ModWorld

The working contract: where truth lives, what an agent may do without asking, and where it stops. Design detail is not here — this file routes to it.

An open-world idle RPG: grind monsters, assemble a build from dropped items, earn with the window open or shut. Single-player, in the browser, no server. The whole design is one file: `doc/DECISIONS.md`.

## Where things live

| Home | Owns |
|---|---|
| `engine/` | the shared math, pure over the data: `index.ts` (stat model, combat lines) · `loot.ts` · `craft.ts` · `skills.ts` · `mastery.ts` · `farm.ts` · `tree.ts` |
| `tools/data/` | every number, one file per domain — see the table below |
| `tools/` | the cages, their shared readers (`lib/engine.ts` · `lib/roster.ts` · `lib/skillmodel.ts` · `lib/json.ts`) and the entry points that print numbers on demand |
| `game/` | the client: `src/engine/client.ts` (the same JSON, the same `createEngine`) · `src/sim/` (tick, combat, drops, offline) · `src/state/save.ts` · `src/ui/` · `tests/` |
| `wiki/` | the player-facing pages — the static build of `game/src/wiki/pages.ts`. An output, never a source: rebuild it, never hand-edit it |
| `doc/` | the surviving prose — the design `DECISIONS.md` · `glossary.md` · `stone-list.md` — and the work file `todo.md`, which exists only while a task is open (its absence is normal) |
| root | `AGENTS.md` |

| Data file | Owns |
|---|---|
| `engine.json` | stat model · K values · caps · loot · mod weights · craft · status · herbs · farm · potions · skill drop · mob species, zones, bosses · elements · timeline · inventory · reach · junk · dungeon · imprint |
| `mods.json` | Mod value ranges, quality bands, the drop weight of each line |
| `town.json` | prices · rosters · stock · Standing · Collector sets · the board's `task_sizing` |
| `skills.json` | roster · reserve tiers · formula · renames |
| `tree.json` | the passive tree's spec |
| `bases.json` | Base frames per slot · weight · Primary / Secondary pools · Gear Mod school · the per-type Line-1 and weapon pools. The source: nothing parses a doc into it |
| `map.json` | the field's cells, terrain, ground colours and regions |
| `aliases.json` | renamed terms (gate X59) and retired docs pointing to their current homes (gate L10) |

File names stay lowercase with hyphens. Never create `skill.md`, `skills.md` or `SKILL.md` for game content, or a `.opencode/skills/` pattern — those names are reserved for agentic skills and get auto-loaded as instructions.

Gate output is the run record; do not add transcript files.

## Commands

Run from `<repo root | game/ | tools/>`.

- Install: `pnpm install`
- Client dev server: `pnpm dev` (port `5173` only)
- Tests: `pnpm test` (`game/tests/`)
- Typecheck: `pnpm typecheck`
- Cages: `pnpm verify`
- Print reports: `pnpm skills`, `pnpm gallery`, or the relevant `tools/` entry point

## Before You Start

- Treat the current local working tree as the source of truth. Use Graphify and Git history as context only; if either conflicts with the current local files or uncommitted changes, preserve and follow the local implementation.
- Read `doc/glossary.md` before touching any game term. Use current names only; retired words live in `tools/data/aliases.json`.
- Read only the `DECISIONS.md` section relevant to the task, not the whole file.
- Check `doc/todo.md` for the current work item. Update it when you finish or defer something.

## Authorized Scope and Autonomy

- A feature request authorizes related data, engine, simulation, UI, tests and documentation changes. Keep layers consistent; update `DECISIONS.md` as part of implementation. Do not override explicit owner rulings.
- Choose routine details and state minor assumptions. Ask only about unresolved choices that materially affect behavior, scope, existing saves or owner rules; inspect first and do not re-ask settled questions.
- When behavior is clear, implement and verify without another approval gate. For substantial uncertainty, write a proportionate plan. Optional skills cannot add approval gates to authorized work; higher-priority instructions still apply.

## Verification

- Numbers belong in `tools/data/<domain>.json`, never hardcoded in `engine/` or `game/src/`. `bases.json` is hand-maintained; never generate it from a doc.
- Update `DECISIONS.md` when a change alters a design rule.
- Gameplay/data changes: cages, tests and typecheck. UI changes: typecheck, relevant tests and interaction/visual checks when behavior or layout changes. Docs-only changes: check the text and diff; skip unrelated game checks.
- Rebuild `wiki/` with `pnpm wiki` when data, engine behavior, wiki source or player-facing wiki rules change. The build refreshes data reads, not hand-written prose.

## UI Workflow

- Begin UI work in the integrated browser at `http://localhost:5173/__showcase#showcase-field`. The Showcase renders the real game components with sample state and exposes panels that are normally hidden; open the relevant section and any affected tabs or collapsed controls while reviewing.
- Pair the Showcase with `http://localhost:5173/__showcase#panel-hud-layout-studio` for HUD layout work. The Studio positions live HUD groups on the same grid and controls the shared modal canvas; its Apply action updates the Showcase preview, while applying from the real game saves the layout.
- Keep the Showcase and game on the same `.svelte` components and CSS. Let Vite HMR update both; do not create mirrored showcase components or duplicate styles.
- When adding or moving a HUD group, include its current contents in the Studio, wire it to the shared `HudLayout`, and verify Apply changes the live field preview at 1920 × 1080. Inspect the affected Showcase states and Studio together so the same surfaces do not need a separate repeat audit.

## Dev Server

- Use only port `5173`. Check it before starting: `Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue`.
- Reuse the existing server. Never start a second server, switch ports, or kill the existing process to free the port.
- For Playwright/browser checks, use the IDE's integrated browser at `http://localhost:5173` only. Set the viewport to `1920 × 1080` (16:9); do not launch a separate browser.

## Sizing

Source of truth: `game/src/styles/variables.css`. Read it before writing or editing any CSS.

- Use semantic size tokens for shared dimensions. A component-specific size may use its own bounded `clamp()`.
  - Font size: `--font-xs` · `--font-sm` · `--font-md` · `--font-lg` · `--font-xl`
  - Icon, image: `--icon-xs` · `--icon-sm` · `--icon-md` · `--icon-lg` · `--icon-xl`
  - Padding, margin, gap: `--spacing-3xs` · `--spacing-2xs` · `--spacing-xs` · `--spacing-sm` · `--spacing-md` · `--spacing-lg` · `--spacing-xl` — the ladder runs from 2px to 42px at about ×1.62 a step
  - Border radius: `--radius-xs` (4px) · `--radius-sm` (8px) · `--radius-md` (12px) · `--radius-round` (50%, circles and capsules)
  - `--seam` is a 1px hairline that sits against a 1px border. It is not a spacing step and never scales. Do not use it for `gap`, `padding` or `margin`; use the spacing ladder, including `--spacing-3xs` for the tightest gap.
- A shadow, a blur, a border, an outline and a letter-spacing may keep a hardcoded figure under 5px. A `gap`, `padding` or `margin` may not — those are on the ladder, and a frozen 3px next to a panel that grew 35% is a different gap than the one that was designed.
- Responsive sizes use bounded width values in their own token or component rule: `clamp(<floor>px, <preferred vw>, <ceiling>px)`. Calibrate the preferred value against the 2066px design width.
- Keep floor and ceiling values as whole pixels. Viewport slopes may use two decimal places. Do not introduce a global multiplier such as `--ui-scale`; Grid Area owns position, and semantic size tokens own dimensions.
- If a component size exactly matches an existing bounded token, reference that token instead of copying its `clamp()`. Use a component-specific `clamp()` only when no existing token represents that dimension. No token fits exactly: use the nearest existing token. Do not add a new token for a one-off value.
- Do not reintroduce the retired `--box-*` scale. Use the existing semantic tokens for shared font, icon, spacing, and radius dimensions; use bounded component-local `clamp()` values for content widths and other one-off dimensions.
- Use the shared semantic color tokens in `variables.css` for recurring text, surface, status and item-rank colors. Keep one-off translucent overlays, blends and visual effects local; do not mint a shared token for a single effect.
- HUD-only dimensions such as `--icon-hub` and `--slot-skill-size` belong in `variables.css` and must not be reused outside the HUD.
- Ask first: adding a shared size token or changing an existing token's design figure.
- Done when: no `--ui-scale` remains, no unbounded viewport-size ramp is used, and no raw fixed size of 5px or more appears in component CSS.

## Boundaries

- Always: keep the HUD Layout Studio and the live HUD linked through one `HudLayout`. Every movable live HUD region must have a `HudRegionId`, appear in `HUD_REGION_META` and `DEFAULT_HUD_LAYOUT`, be positionable in the Studio, and use the same `hudLayout` values in `App.svelte`. Do not place a movable live HUD region with CSS-only coordinates outside that layout. Keep the Studio's descriptions and palette current with the controls inside each group. When adding a region, fill it from its default when loading older saved layouts so existing custom positions survive; verify that applying it in the Studio moves the live region.
- Within the requested scope: rename internal data files or keys when all readers, writers, validators, and documentation are updated together. Ask first if the rename breaks saved data, import/export compatibility, or external consumers.
- Within the requested scope: extend the save format in `game/src/state/save.ts` with automatic migration that preserves existing player data and its meaning. Verify loading older saves, migration, and round-trip save/import behavior. Ask first for changes that discard data, reinterpret existing data, or cannot migrate safely.
- Ask first before adding a dependency or overriding an owner ruling. Existing authorization for that exact action is sufficient.
- Never fold passive-tree power into `mob_HP`; read `map.json` from `engine/` or `game/src/`; or create `skill.md`, `skills.md`, or `SKILL.md` for game content.

## Git

- Never commit, push, or pull unless asked.
- "Replace all" means `<one line: which side overwrites which, and how>`.
- Commit format: `<type: short summary>`.

## Environment

- Windows, PowerShell commands; forward slashes in code paths.
