# Agent Rules — ModWorld

The working contract: where truth lives, what an agent may do without asking, and where it stops. Design detail is not here — this file routes to it.

An open-world idle RPG: grind monsters, assemble a build from dropped items, earn with the window open or shut. Single-player, in the browser, no server. The whole design is one file: `doc/start/DECISIONS.md`.

## Where things live

| Home | Owns |
|---|---|
| `engine/` | the shared math, pure over the data: `index.ts` (stat model, combat lines) · `loot.ts` · `craft.ts` · `skills.ts` · `mastery.ts` · `farm.ts` · `tree.ts` |
| `tools/data/` | every number, one file per domain — see the table below |
| `tools/` | the cages, their shared readers (`lib/engine.ts` · `lib/roster.ts` · `lib/skillmodel.ts` · `lib/json.ts`) and the entry points that print numbers on demand |
| `game/` | the client: `src/engine/client.ts` (the same JSON, the same `createEngine`) · `src/sim/` (tick, combat, drops, offline) · `src/state/save.ts` · `src/ui/` · `tests/` |
| `wiki/` | the player-facing pages — the static build of `game/src/wiki/pages.ts`. An output, never a source: rebuild it, never hand-edit it |
| `doc/start/` | the surviving prose — the design `DECISIONS.md` · `glossary.md` · `stone-list.md` — and the work file `todo.md`, which exists only while a task is open (its absence is normal) |
| root | `AGENTS.md` |

| Data file | Owns |
|---|---|
| `engine.json` | stat model · K values · caps · loot · mod weights · craft · status · herbs · farm · potions · skill drop · mob species, zones, bosses · elements · timeline · inventory · reach · junk · dungeon · imprint |
| `mods.json` | Mod value ranges, quality bands, the drop weight of each line |
| `town.json` | prices · rosters · stock · Standing · Collector sets · the board's `task_sizing` |
| `skills.json` | roster · reserve tiers · formula · renames |
| `tree.json` | the passive tree's spec — its power is deliberately not folded into `mob_HP` (owner ruling: the published rates are the empty-tree baseline, permanently) |
| `bases.json` | Base frames per slot · weight · Primary / Secondary pools · Gear Mod school · the per-type Line-1 and weapon pools. The source: nothing parses a doc into it |
| `map.json` | the field — cells, terrain, ground colours, regions. Presentation only: nothing under `engine/` or `game/src/` reads it |
| `aliases.json` | what was renamed — `terms` (retired words, held by 
) and `docs` (retired doc names mapped to the file that owns their numbers now, held by L10) |

File names stay lowercase with hyphens. Never create `skill.md`, `skills.md` or `SKILL.md` for game content, or a `.opencode/skills/` pattern — those names are reserved for agentic skills and get auto-loaded as instructions.

A gate prints its own meaning on its own line, so the run is the documentation: there is no transcript file to keep in step with the cage.

## Commands

Run from `<repo root | game/ | tools/>`.

- Install: `<pnpm install>`
- Client dev server: `<pnpm dev>` (port `<3000>`)
- Tests: `<pnpm test>` (`game/tests/`)
- Typecheck: `<pnpm typecheck>`
- Cages (data validators): `<command>`
- Print numbers on demand: `<tools/ entry point>`
- Rebuild the wiki: `npm run wiki` (writes `wiki/`)

## Before You Start

- Read `doc/start/glossary.md` before touching any game term. Use current names only; retired words live in `tools/data/aliases.json`.
- Read only the `DECISIONS.md` section relevant to the task, not the whole file.
- Check `doc/start/todo.md` for the current work item. Update it when you finish or defer something.

## Changing Numbers

1. Edit the value in `tools/data/<domain>.json`. Never hardcode a number in `engine/` or `game/src/`.
2. Run the cages.
3. Run the tests.
4. If the change alters a design rule, update `DECISIONS.md` in the same change.
5. Rebuild the wiki: `npm run wiki`. A page reads the live engine, so any change that moves a number or a page's own read moves `wiki/` with it.

`bases.json` is a source file: never generate it from a doc.

## Dev Server

- Before starting a server, check whether one is already running on port `<3000>`:
  `Get-NetTCPConnection -LocalPort <3000> -ErrorAction SilentlyContinue`
- If it is running, reuse it. Do not start a second instance.
- 
## Sizing

Source of truth: `game/src/styles/variables.css`. Read it before writing or editing any CSS.

- Use semantic size tokens for shared dimensions. A component-specific size may use its own bounded `clamp()`.
  - Font size: `--font-xs` · `--font-sm` · `--font-md` · `--font-lg` · `--font-xl`
  - Icon, image: `--icon-xs` · `--icon-sm` · `--icon-md` · `--icon-lg` · `--icon-xl`
  - Padding, margin, gap: `--spacing-3xs` · `--spacing-2xs` · `--spacing-xs` · `--spacing-sm` · `--spacing-md` · `--spacing-lg` · `--spacing-xl` — the ladder runs from 2px to 42px at about ×1.62 a step
  - `--seam` is a 1px hairline that sits against a 1px border. It is not a spacing step and never scales: if the gap is between two lines or two controls, it is `--spacing-3xs`, not a seam.
- A shadow, a blur, a border, an outline and a letter-spacing may keep a hardcoded figure under 5px. A `gap`, `padding` or `margin` may not — those are on the ladder, and a frozen 3px next to a panel that grew 35% is a different gap than the one that was designed.
- Responsive sizes use bounded width values in their own token or component rule: `clamp(<floor>px, <preferred vw>, <ceiling>px)`. Calibrate the preferred value against the 2066px design width.
- Keep floor and ceiling values as whole pixels. Viewport slopes may use two decimal places. Do not introduce a global multiplier such as `--ui-scale`; Grid Area owns position, and semantic size tokens own dimensions.
- No token fits exactly: use the nearest existing token. Do not add a new token for a one-off value.
- HUD-only dimensions such as `--icon-hub` and `--slot-skill-size` belong in `variables.css` and must not be reused outside the HUD.
- Ask first: adding a shared size token or changing an existing token's design figure.
- Done when: no `--ui-scale` remains, no unbounded viewport-size ramp is used, and no raw fixed size of 5px or more appears in component CSS.

## Boundaries

- Always: edit `tools/data/`, `engine/`, `game/src/`, `game/tests/`.
- Always: keep the HUD Layout Studio and the live HUD linked through one `HudLayout`. Every movable live HUD region must have a `HudRegionId`, appear in `HUD_REGION_META` and `DEFAULT_HUD_LAYOUT`, be positionable in the Studio, and use the same `hudLayout` values in `App.svelte`. Do not place a movable live HUD region with CSS-only coordinates outside that layout. When adding a region, fill it from its default when loading older saved layouts so existing custom positions survive; verify that applying it in the Studio moves the live region.
- Ask first: add a dependency, rename a data file or key, change the save format in `game/src/state/save.ts`, edit `DECISIONS.md` rules.
- Never: fold passive-tree power into `mob_HP` (owner ruling), read `map.json` from `engine/` or `game/src/`, create `skill.md` / `skills.md` / `SKILL.md` for game content.

## Git

- Never commit, push, or pull unless asked.
- "Replace all" means `<one line: which side overwrites which, and how>`.
- Commit format: `<type: short summary>`.

## Environment

- Windows, cmd/PowerShell. Use PowerShell syntax in commands. Paths use forward slashes in code.
- Node `<version>`, package manager `<pnpm>`.

## Done When

- Cages pass, tests pass, typecheck passes.
- The wiki is rebuilt in the same change (`npm run wiki`). Engine updated and `wiki/` left behind is not done: the pages are the numbers a player reads, and an un-rebuilt wiki is a stale copy of them.
- The wiki's own PROSE moved with the change too: a rebuild refreshes what a page reads from the data, but a rule or a mechanic that changed usually also moved the hand-written sentences in `game/src/wiki/pages.ts` — grep the page for the old reading and fix it in the same change.
- No new hardcoded numbers outside `tools/data/`.
- `todo.md` updated if the task was on it.

## Output Policy

- Lead with the result, then only the necessary details.
- Show diffs or snippets, not whole files. Always give the file path.
- Report as: what changed / which files / verified or not. For lint/test output, report pass/fail and only the relevant errors.
- Ask at most one question, and only if the task would otherwise go the wrong way. Otherwise state your assumption in one line and proceed.
- Reply in the user's language. Keep identifiers, paths, and commands in English.
