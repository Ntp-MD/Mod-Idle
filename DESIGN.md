# Design

The client already has a visual world. This file writes down its rules so the next change inherits them
instead of rebuilding them from taste. It names no values: every token, every palette entry and every
threshold has one owner file, listed at the bottom, and this page points there.

## The world

A dark map table. The game is a war-room read over a hex atlas: the ground is a generated SVG sheet in the
game's own dark, the HUD floats over it on translucent plates, and the one accent is the gold of a lit
map-pin. The mood is cartographic and military, not fantasy-purple: ink, brass, and a level band that walks
from dark green to deep red.

## Tokens

Declared once, in `game/src/app.css :root`. Nothing else may hardcode a colour, and this file does not
restate them either.

- `--bg`, `--panel`, `--line`, `--text`, `--dim` — the plate floor, a control's face, hairlines, ink, and a
  read the player need not act on.
- `--glass`, `--edge` — a HUD plate over the field, and its lit edge.
- `--gold` — the one accent: this is where you are, or this is pressable now.
- `--focus` — keyboard focus, and nothing else.
- `--es`, `--hp`, `--mana`, `--xp`, `--mob`, `--good` — gauges and their semantic states.
- `--rail`, `--dof`, `--dof-rest`, `--dof-near` — the gutter the menu rail owns, and the depth-of-field
  ladder.
- `--ui`, `--num` — the voice, and the figures.
- `--sel`, `--bar` — the browser's own paints (selection, scrollbar) themed from the same palette.

Terrain and ground colours are **not** client tokens: they are `tools/data/map.json` data, printed into the
generated sheet and read back off it, so the map's palette has one home.

## The three-state rule (focus, blur, highlight)

Blur is depth of field, not decoration. The sheet is a surface the player travels on, so it sharpens toward
attention and everything else recedes:

- **Resting** — the field is the subject: the ground sits at `--dof-rest`, dimmed, masked at the bottom.
- **Reached-for** — the pointer is on the ground: it comes to `--dof-near`, because a place is picked on it.
- **Map focus** — the ground is the subject: no blur, and the mob plates, the tracker and the zone banner
  leave the frame rather than ghost over it. A sharp map and a HUD printed across it cannot share a square.

A working screen inverts the same ladder: the field behind a Panel recedes (`--dof` on the stage) while the
screen itself stays sharp. There is exactly one ladder, driven by `--dof`, so a new screen cannot invent its
own.

**Highlight has three meanings and they never overlap.**
- `--gold` = where you are, or what is pressable right now.
- `--good` = the better option (a piece stronger than the worn one, a press that worked).
- `--focus` = the keyboard is here. Focus is never gold, or a focused-but-unavailable control would read as
  the recommended one.

## Component rules

- One screen, no page scroll; every read is pinned to an edge. The rail owns the right gutter and nothing
  reaches into it.
- A HUD plate is glass with a lit edge. A working screen is opaque floor with a shadow — a veil is for a
  screen you work in, an overlay is for a read you take mid-fight. A screen takes only the height its
  content needs, up to its ceiling, so a short one never leaves an empty plate over the field.
- The loudest thing on a mob plate is its HP. The loudest thing on a service row is what it costs.
- Digits always set in `--num` with tabular figures; prose never does.
- Plates carry a single radius step; pills are reserved for small controls. Declare elevation once — border
  or shadow, not both.
- Buttons name their action. A refusal names its reason on the control itself, in the player's own units.
- A grid of slots is a shelf: an empty side speaks across the whole width, never down one cell.

## Copy

Plain words over density. A row says what it does. Every hint has a button next to it. A number is stated in
the unit the player can act on — gold, stones, a percent they can see on the ladder — never in a shorthand
only the design docs use. Time is not a constraint, so no screen sells urgency.

## Keyboard

The rail prints each screen's own key on its tab, so the menu is its own key legend and a binding a player
never visited the settings over is still a binding they can find on screen. Bindings are client settings,
not character state; the table and its defaults live in `game/src/ui/keybinds.ts`, the stored override in
`game/src/state/save.ts`. A key press answers only when the hand is not already typing in a field, and the
browser keeps its own chords.

## Selection

The client is a game, so its chrome is not a document: selection is off at the root and opted back in on the
copyable minority — prose, table cells, the read-outs a player compares or quotes. The map frame and the
sheet's own labels never take a selection, because a drag there means pan.

## Responsive

Desktop and above only. The root font size is the whole client's zoom, so every rem-measured control scales
with the window and no second layout exists; the media queries only move what physically cannot fit, and
below the desktop floor the client says so instead of laying out a phone screen.

## Where each value lives

| Concern | Owner |
|---|---|
| colour tokens, root scaling, selection, scrollbars, selection ring | `game/src/app.css` |
| layout, the depth-of-field ladder, the responsive steps | `game/src/App.svelte` |
| terrain and ground palette, the fade factors | `tools/data/map.json` |
| the keyboard table and its defaults | `game/src/ui/keybinds.ts` |
| stored client settings | `game/src/state/save.ts` |
| every gameplay number | `tools/data/*.json` through `engine/` |
