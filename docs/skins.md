# UI markup, CSS organization, and the Hub Grid

This guide defines where UI code belongs and how it is laid out. It does not prescribe colors, dimensions, compositions, or item counts. Shared CSS values live in `game/src/styles/variables.css`; the components are the source of truth for the current interface.

## HTML

- Use native elements for their purpose: buttons for actions, links for navigation, inputs and selects for editing, headings for structure, and tables for tabular data.
- Give controls accessible names and associate labels with inputs. Use ARIA when native semantics do not express an interaction.
- Keep DOM order and focus order consistent with the visual order. Controls that switch or reveal content must work with keyboard and pointer input.
- Keep content and interaction state in components rather than CSS-generated text.

## CSS ownership

| Location | Responsibility |
|---|---|
| `game/src/styles/base.css` | Shared defaults for bare HTML tags, box sizing, and focus treatment |
| `game/src/styles/skins.css` | Reusable appearance classes and their visual states |
| Component `<style>` | Layout, placement, sizing, and responsive behavior for that component |

- Give each property one owner. Do not restate a base or skin property in a component just to make a selector win.
- Name reusable appearance classes by element role and variant, such as `<family>-<variant>`. Use state classes for reusable visual states. Do not name a style after the screen that happens to use it.
- Reference global skin classes from Svelte markup; keep component layout selectors scoped. Avoid contextual appearance selectors such as `.panel button` when the button needs a reusable variant.
- Keep selectors simple and specificity low. Avoid `!important` for ordinary component styling.
- A visual state belongs with its appearance class; a state that changes placement or size belongs with component layout.
- Keep the layout vocabulary steady: **stage** is the shell, **Hub Grid** is the 15 × 15 region canvas, **region** is a placed group, **scroll owner** is the one element inside a region that scrolls.

## Shared Hub controls

Hub icon actions use `.hub-control` with `.toggle-ring` followed by `.cap`. The control owns the vertical icon/caption layout: captions always sit below icons. Navigation, travel, More, automation, and speed controls reuse this structure. Group containers own only the arrangement of controls; they must not override the control's direction, icon size, or caption placement. Appearance and states live in `skins.css`; layout lives in `App.svelte`.

Collapsible HUD groups reuse `CollapseToggle.svelte` and keep hidden content mounted so control state survives folding. Their parent owns the group placement; summaries read existing state and never change gameplay settings.

## Layout — the Hub Grid

Where a surface sits, what scrolls, and how new UI is added.

### One shell, one grid, one scroll owner

The whole client is laid out on **the Hub Grid**: one fixed shell, one 15 × 15 fractional grid, one scroll owner per region.

| Layer | Code | Rule |
| ----- | ---- | ---- |
| Shell | `.stage` in `game/src/App.svelte` | `position: fixed; inset: 0; overflow: hidden`. The shell is never taller than the viewport and never scrolls. |
| Grid | `hudLayoutAreas`, `repeat(15, minmax(0, 1fr))` | The cell is the unit of placement; `--screen-pad` frames the grid. |
| Region | `HudRegionId`, `HUD_REGION_META`, `DEFAULT_HUD_LAYOUT`, plus the matching values in `App.svelte` | A region occupies a cell rectangle (`grid-area`) and aligns inside it with `justify-self`/`align-self`. Placement comes from HudLayout, never from hand-written coordinates. |
| Scroll owner | the element that grows inside a region | Exactly one `min-height: 0; overflow: auto` per region. Everything between the region and that element stays `overflow: hidden`. |
| Opt-out | showcase and generated pages | `body.ui-showcase`, `.veil.showcase`, `.box.showcase`: height auto with ordinary page scroll, so the component gallery and `docs/wiki/*.html` read as documents. |

### Rules

- **The shell never scrolls.** A surface that outgrows its region scrolls inside the region, never on `body`.
- **One scroll owner per region.** Two nested scrollers, or a scroller under an `overflow: visible` ancestor,
  is content with no reliable way to reach it.
- **A panel is the same grid.** A panel draws a second Hub Grid over the stage: the `.box` sits at
  `--panel-grid-area` (default `2 / 3 / 15 / 14`) and its body follows the same one-scroll-owner rule.
- **Combat is a centered absolute overlay.** Its `HudLayout.field` rows set vertical bounds and its column span sets width. It reserves no grid cells and may overlap other regions, like the modal canvas. Other HUD regions retain exclusive grid cells.
- **Placement is data, not CSS.** Regions and their moves belong to `HudLayout` and the Studio
  (`#panel-hud-layout-studio`): **Studio Apply** previews, **game Apply** saves. New regions backfill
  `DEFAULT_HUD_LAYOUT` so older layouts keep their shape.
- **Never repair the opt-out in the shell.** Fixing a showcase or generated-page problem by loosening the
  shell breaks the no-scroll guarantee for the game.
- Let the region decide what scrolls: component CSS sizes the element inside that space instead of moving the space itself.

### Adding UI

- Numbers go to `tools/data/*.json`, formulas to `engine/`, composition and state to `game/src/sim/`, and
  markup with CSS to a component per the ownership table above.
- A new surface on the stage: register a `HudRegionId` in `HUD_REGION_META`, add its rectangle to
  `DEFAULT_HUD_LAYOUT`, then render the surface inside the named cell.
- A new screen or panel: add the id to `PANELS`, the entry to `RAIL`, its `RAIL_ICON`/`RAIL_LABEL`, a
  `SCREEN_ACTION` keybind, and a region when it also lives on the stage.
- A list that grows with the save (bag, stash, market stock) owns its region's single scroll owner.

## Variables and spacing

- Read `game/src/styles/variables.css` before editing styles. Reuse its custom properties for values shared across components, and add a shared variable when a new concept genuinely recurs. Keep one-off layout values local to the component.
- Put spacing between siblings on their flex or grid parent with `gap`. Use margins for document flow or to reset browser defaults, not to push a sibling into place.
- Choose Grid or Flexbox from the relationship between elements. Let repeated content fit the available width unless a fixed count is required by the feature itself.
- Let flexible children shrink where needed, for example with `min-width: 0`, and handle overflow intentionally.
- Keep responsive rules beside the component they affect. Use standard CSS and existing variables without encoding an arbitrary project-wide column count or design width.

## Verification

- Inspect the changed surface and its actual interactions in the integrated browser at **1920×1080 only**, unless the owner requests another size. Check keyboard focus, unintended overflow, and that the growing region scrolls on its own with nothing on `body` below the fold.
- Run `pnpm typecheck` and only the focused tests needed for the affected behavior. Review the final diff.
- Rebuild generated docs when source or player-facing rules change; edit their source rather than generated HTML.
