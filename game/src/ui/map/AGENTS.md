# Modular hex map

Read this before changing the map or its integration in App, tools or tests. Root AGENTS.md still applies.

## Owners and data flow

```text
engine/world + sim state -> map-view-model -> MapPaintModel -> map.ts -> render/ -> SVG
generated SVG -> render/map-dom -> validated static cells --^
validated cell radius -> map-content-layout -> readonly layout -> render/map-content
map-input -> WorldMap MapIntent -> existing App/sim commands
```

| Module | Owns | Must not own |
|---|---|---|
| `map-types.ts` | Shared DTOs and presentation identity | Runtime imports, DOM nodes, SVG strings, GameState |
| `map-world.ts` | Canonical coordinate-to-content lookup for indexing | Reading gameplay facts from SVG attributes |
| `map-adventure.ts` | Read-only discovery, Camp/combat/resource signals and stacking priority | HTML/SVG, DOM, timers, rewards or sim writes |
| `map-view-model.ts` | One state-to-snapshot projection; resolved names, levels, titles and game icons | DOM, image measurement or mutation of GameState |
| `map-content-layout.ts` | The only sizing policy and geometry budget, derived from cell radius | Asset IDs, roles, DOM, camera zoom or gameplay units |
| `map.ts` | Renderer lifetime, dirty work, one index and one pending animation frame | Content decisions, gameplay queries, a second label/marker system |
| `render/map-dom.ts` | Validate/index the sheet once; use `map-world` for canonical facts | Treating `data-zone`, `data-site`, display keys or artwork as world authority |
| Other `render/` modules | Surface, in-hex content/signals, hover and scene paint from the snapshot | Engine/sim imports, species/discovery lookups, commands or saved state |
| `WorldMap.svelte`, `map-input.ts` | Host lifetime, pan/zoom, picking, keyboard and semantic intents | Travel pricing/execution, per-location or per-species rules |
| `map-camera`, `map-projection`, `map-view-transform` | Pure map-plan/CSS math over shared affine primitives | Field metres, DOM/state reads or another scale formula |
| `map-terrain`, `map-sprites`, `data/` | Shelf art, material/relief registration and measured source bounds | Hitboxes, route costs, discovery or spawning |
| `destination`, `map-intel`, panels | Existing action readiness and destination presentation | Another world graph or travel implementation |

Only the index may cross from render/ into `map-world`. Every painter must work with the supplied snapshot even if the game state changes after it was built. Resolve game icons, titles and spoiler rules in the model; never repair missing model fields with a live engine lookup inside paint.

## Rendering contract

- Axial `q,r` identifies the world cell. A1-style display keys and SVG `data-*` are presentation/debug metadata. Engine/sim remain the owners of movement, habitat, rewards, discovery and saves.
- The painted camera is north-up, uniform pan/zoom. Projection parameters used by calibration tests do not authorize a rotation control. Map-plan units never become field metres.
- One in-hex layout (`render/map-content.ts`) owns names, levels and the shared icon row (player, town, sites, actual species and activity). Far zoom shows level + town icon; names/roster wait for mid/near. Unknown fields show levels, with names/species/Unique clues gated in the model.
- Use the game's existing icon resolvers (`icon`, `mobSpeciesArt`, `characterIcon`) in the model. The snapshot carries resolved icon hrefs; painters only place images. No map-specific glyph vocabulary, medallions, tokens, stems, circular frames or separate player overlays.
- All icon boxes have one size, independent of role, count, source resolution or transparent padding. `HEX_CONTENT_SIZING` in `map-content-layout.ts` owns every size, gap, text row, outline and inset. Its values are reference map-plan units; the actual cell radius scales the entire layout. Camera zoom scales the painted scene once.
- The layout reserves a safe pointy-hex area for names, levels, icons and a separate overflow line. Invalid inputs or a policy that exceeds this budget fail explicitly. Painters consume its readonly positions and sizes; CSS owns colour/font family/weight, with no sizing literals or per-asset/per-kind overrides. Normalize artwork padding in the asset pipeline.
- Keep SVG text on `geometricPrecision`: hinting at fractional plan-unit font sizes can break proportional metrics and make adjacent rows overlap. Measure/fill text only when its retained markup changes; the layout owns the width limits.
- Player position also uses the standing hex edge and aria-current. Full names remain in cell titles and destination details when the in-hex caption is shortened/fitted.
- Terrain image fills are hidden on the world map; hex colours and borders supply the ground. Relief stays reversible and off by default. Do not re-enable terrain image fills without a product decision.
- Create content/signal children only when needed. The generated `.actor-scenery` is the content host; do not add empty scenery wrappers. Index hosts once, retain unchanged markup, never measure artwork per paint.
- Pointer/arrow/Enter behavior and selection announcements remain accessible. Renderer emits no gameplay mutations; existing command readiness is shared with the destination panel.

## Where to extend

- New signal: add a semantic descriptor and priority in `map-adventure`; resolve its game icon and reuse the in-hex row. Test discovery gating and deterministic stacking.
- New icon/art: register existing shelf PNGs/bounds in the owning registry. Keep sizes/placement shared. New art/style decisions need their own review.
- New terrain/biome: use the shared ground material registry and generator data; run Node map gates. Do not patch world IDs or terrain in a painter.
- New world feature/travel rule: change engine/data/sim and its contracts first; project the result here. No App/renderer branches for particular cells, species or skills.
- New view field: define its DTO, derive it in the model, consume it in its existing painter and update the relevant invalidation key. Do not introduce an unused future mode or compatibility wrapper.

## Required evidence

`tests/ui/map-architecture.test.ts` enforces layer imports, centralized sizing and retired renderer removal. `map-content-layout.test.ts` checks safe bounds, spacing and proportional scaling. `map-contracts.typecheck.ts` protects readonly layouts and prevents icon-specific dimensions. The browser spec checks real icon sizing and text/icon containment at multiple zooms. Keep those checks effective; update the architecture decision before relaxing them.

Run focused map/destination/trail tests, `npm run check`, `npm run map:check`, then `map.spec.ts` + `map-travel.spec.ts` headless at 1920 × 1080, build and `git diff --check`. Run the full game suite once for map architecture closeout. Verify no floating names/leaders, no empty wrappers, stable terrain corners, view toggles, keyboard actions and console. Add behavior tests for an actual new contract; do not preserve tests whose only purpose is exercising deleted helpers.
