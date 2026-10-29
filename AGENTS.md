# ModWorld — agent working agreement

Single-player, browser-only idle RPG; no server. Shared entry point for every coding agent.

## Design references

ROX / Ragnarok Origin is the reference for combat feel only. Do not use Melvor or any other idle game as the reference for engine or idle architecture; those decisions cite `engine/`, `tools/data/*.json` and our own measurements. The existing gameplay feature set stays as it is.

## Document map

| Source | Owns | Read when |
|---|---|---|
| `AGENTS.md` | Workflow, ownership, commands and verification | Starting work; reuse once loaded |
| `docs/glossary.md` | Short definitions of game terms | A term is ambiguous, new or renamed |
| `docs/map-art.md` | Map terrain artwork contract and the projected ground footprint | Producing or placing terrain hex art |
| `docs/animation.md` | Runtime identity → rig/clip resolution, sockets, phase floor and fallback naming | Importing a model, rig, clip or equipment socket |
| `docs/renderer-decision.md` | Renderer candidate, evidence and the hardware gate before cutover | Choosing or cutting over a world renderer |
| `game/src/assets/` | Runtime non-shelf images (backgrounds, skins); not keyed by the icon resolver | Adding a non-glyph runtime image |
| `tools/data/*.json` | Numbers, tuning, catalogues and content | Changing or tracing those values |
| `engine/`, `game/src/` | Implementation, interfaces and UI appearance | Working on the affected code |
| `game/src/icon/` | Art shelf for item, skill, mob, UI and map-glyph images; folders group by subject and resolvers key on the file name | Adding or sorting artwork |
| `game/src/ui/combat/arena/`, `game/src/ui/combat/fx-manifests/` | Runtime animation + VFX manifests embedded by import; data, not shelf art | Changing arena animation or authored VFX |
| `game/src/wiki/pages.ts` | Player-facing wiki source | Changing what the wiki explains |

Each fact has one owner; link, don't copy. Provider entry files carry no separate project rules.

## Tool calls

- Name the missing fact and how the call advances the task; reuse evidence when sufficient, keep the reasoning internal.
- Start from the path/symbol with bounded output; exclude dependencies, generated output, logs unless implicated. Expand only on evidence.
- Reuse verified reads/checks until inputs change or concrete uncertainty remains.
- Batch independent reads in one call; run dependents sequentially.
- On truncation narrow the query; on failure identify the cause, retry only with a changed approach or new evidence, else report a blocker.
- An unrelated failing check with no changed input is baseline/in-flight: report it, don't refix or rerun without new evidence. Preserve concurrent edits; say so when verification can't repeat.
- Stop when acceptance criteria and required checks pass; a long tool sequence never justifies skipping verification.

## Code and data ownership

| Location | Responsibility |
|---|---|
| `engine/` | Shared formulas and data-driven mechanics |
| `tools/data/engine.json` | Stats, combat, loot, craft, mobs/zones, inventory, fieldwork and dungeon configuration |
| `tools/data/spawns.json` | Field spawn layout, optional calibrated navigation geometry (origin, cell size, static obstacles with movement/sight/projectile flags), population cap, per-slot respawn, aggro/assist/leash ranges and offline engagement share |
| `tools/data/mods.json` | Mod ranges, quality bands and drop weights |
| `tools/data/town.json` | Town stock/prices, Standing, Collector, tasks, trade, Haggling, Delivery and Black Market |
| `tools/data/skills.json` | Skill roster, reserve tiers and skill configuration |
| `tools/data/mob-skills.json` | Mob-only skill library and the Unique/Boss/Variant/Species override kits |
| `tools/data/tree.json` | Passive-tree specification |
| `tools/data/tree-retired-baseline.json` | Frozen legacy retired node ids; update only for an intentional save migration |
| `tools/data/bases.json` | Hand-maintained frames, slots and Mod pools; never generate by parsing docs |
| `tools/data/map.json` | Presentation map layout, terrain and colours; never import in `engine/` or `game/src/` |
| `tools/` | Cages, reports and shared readers; `tools/map.ts` generates the overlay |
| `game/src/assets/` | Runtime non-shelf images (backgrounds, skins); not keyed by the icon resolver |
| `game/src/engine/client.ts` | Browser bridge to canonical JSON and shared engine factories |
| `game/src/sim/` | Runtime composition/state; `core/` sheet+loop, `combat/` fights+skills, `town/` markets+contracts, `gear/` loot+craft, `world/` map+field; `core/player.ts` composes the character sheet |
| `game/src/state/save.ts` | Save loading, migration and persistence |
| `game/src/ui/`, `game/src/App.svelte` | Components and application wiring |

Gameplay numbers live in data JSON, formulas in `engine/`; do not duplicate either in the client. New game-content filenames use lowercase hyphens. `skill.md`, `skills.md`, `SKILL.md` and `.opencode/skills/` are reserved for agent skills, not game content. Gate output is the run record; do not create transcript files.

## UI integration

- Shared tokens: `game/src/styles/variables.css`; tag defaults: `base.css`; reusable appearance: `skins.css`; layout: component `<style>`. Read the tokens and the component. Keep static appearance in classes; inline bindings are for runtime values and HudLayout placement.
- UI icons and map glyphs are PNG shelf art through `.icon-mask` (`currentColor`); the map scene wraps glyphs in SVG. `<svg>` remains only as scene structure (tree/map geometry, marker frames/leaders, charts, effects) — never a standalone icon.
- Map markers: shelf PNG glyph in a circular medallion on a vertical leader from the hex centre; frame/leader use hover-hex blue (`--es`). Never repaint terrain for markers.
- Current shell: fixed 15 × 15 Hub Grid, shared `HudLayout` regions, one scroll owner per region. Added/moved regions update `HudRegionId`, `HUD_REGION_META`, `DEFAULT_HUD_LAYOUT` in `game/src/ui/hud/hud-layout.ts` plus `App.svelte` wiring; backfill old layouts.
- New panels wire through `PANELS`, `RAIL`, icon/label maps, keyboard actions in `App.svelte`. Reuse shared controls like `CollapseToggle.svelte`.
- Keep native semantics, labels, keyboard access, visible focus. Map arrows select adjacent Blocks; Enter walks or uses a known Waypoint, with selection announcements.
- Inspect components with HMR at `http://localhost:5173/__showcase#showcase-field`, **1920 × 1080 only** unless requested. Default to the Playwright tools in headless mode: resize to 1920 × 1080, read the snapshot and console, interact, then close the browser. One tab per check. Reuse the dev server already on port 5173 — never start a second or kill one to reclaim the port. Headed browsing only when a human must watch; when no browser tool is available, say so and fall back to the dev server, focused tests and `npm --prefix game run check`.
- For HUD placement use `#panel-hud-layout-studio`: **Studio Apply** previews, **game Apply** saves. Verify the live region moves; preserve interactions and saved-layout compatibility.

## Commands and verification

Windows + PowerShell; forward slashes in code paths. Run commands from the applicable root or `game/` package.

- Development: `npm install`, `npm run dev`; **port 5173 only**. Check `Get-NetTCPConnection -LocalPort 5173` first. Reuse an existing server; never start a second or kill one to reclaim the port. `npm run lint` runs the conservative Biome baseline.
- Gameplay/data: relevant cages/tests and `npm run typecheck`; broaden checks when shared behavior changes. `npm run verify` runs all cages; `npm test` runs `game/tests/`.
- UI: typecheck, `npm --prefix game run check` (warnings fail), focused tests, `npm --prefix game run build`, and a headless-browser check for behavior/layout changes.
- Coverage (optional report): `npm --prefix game run test:coverage`; no threshold is enforced yet.
- Docs/comments only: inspect the edited files and local links; no gameplay suite or browser check.
- Wiki: `npm run wiki` when wiki source, displayed data/formulas or player-facing behavior changes. `docs/wiki/*.html` is generated; never hand-edit. UI-only changes do not trigger wiki rebuilds.
- Other generators: `npm run skills` or the relevant `tools/` entry point when its input changes.
- Verify correctness/compatibility, not pacing bands, prices, tuned windows, roster sizes, or content quotas. Don't rerun passing checks without a relevant change.
