# Skin System — CSS authoring contract

This file is the working rule for how the client's CSS is written. It exists so any agent (or human) can refactor a surface without asking what the house style is, and get the same answer every time. Numeric values live in `styles/variables.css`; design rulings live in `docs/DECISIONS.md`; this file owns **how a style is authored**.

## The three layers

| Layer | File | Owns | Never owns |
|---|---|---|---|
| **base** | `styles/base.css` | geometry of a bare HTML tag: `padding`, `border-radius`, `font`, `box-sizing`, focus ring | colour themes, per-screen looks |
| **skin** | `styles/skins.css` | appearance: background, border colour, glow, shadow, motion, state paint | `padding`, `margin`, `gap`, `width`, `height`, position |
| **component** | `<Component>.svelte` `<style>` | layout and composition: grid/flex tracks, placement, region size, which skins are applied | re-painting a skin, restating base geometry |

One property has exactly one home. If a skin needs a size, the size belongs to the component or a token — not the skin.

## Naming

```
<family>-<skin>            appearance variant
<family>-<skin>.<state>    that variant under one state
```

- Family is the element's job, not its owner: `btn`, `panel`, `card`, `chip`, `badge`, `track`, `gauge`, `tab`, `text`, `selectable`, `plate`, `pop`, `notice`, `slot`, `field`.
- Skin name is the look, said once: `ghost`, `dagger`, `veil`, `solid`, `gold`, `danger`.
- State is a bare word, no `is-`/`has-` prefix, one word per meaning: `toggled`, `picked`, `busy`, `off`, `ready`, `locked`.
- Never name a skin after the screen that uses it. `btn-desk` is wrong; the desk wears `btn-quiet`.

```svelte
<button class="btn btn-quiet" class:toggled={open}>Field</button>
<section class="box panel-solid" class:busy={saving}>…</section>
<div class="card card-combat">…</div>
```

## Hard rules

1. **No contextual appearance selectors.** `.desk-tabs button { … }`, `.bar button { … }`, `.pop .quit { … }` are the pattern being removed. A component may position a child; it may not decide what a button looks like.
2. **Every `<button>` takes padding from the base tag rule** (`--spacing-xs --spacing-md`). `button.mini` keeps its font size, never a padding. A control that must be smaller changes its `--icon-*` / `--slot-skill-size`, not its padding.
3. **Specificity budget:** skin alone = 1 class; skin + state = 2 classes; a component layout rule may not exceed the specificity of a skin it must not fight. `!important` is not used.
4. **Tokens only.** Skins read `--gold`, `--glass`, `--edge`, `--font-*`, `--icon-*`, `--spacing-*`, `--radius-*`, `--z-*`. A new token or a new design figure needs the owner's yes first. No one-off `gap`, `padding` or `margin` in a component either — that rule is unchanged.
5. **Parent-owned spacing.** Space between siblings comes from `gap` on their flex/grid parent. Never use a child's margin to create space or push it away; put the gap or alignment rule on the parent. A zero margin may reset a browser default, but margins never provide layout spacing.
6. **A state class paints, it does not move.** `.toggled` may change colour, border and glow. If a state also changes size or position, that is a layout fact and belongs to the component.
7. **Motion stays in the skin that owns the look**, using the named motion tokens. Keyframes live next to the skin that uses them.
8. **Svelte scoping:** skins are global CSS (`skins.css` is imported once, unscoped). Components reference them as plain class strings and must not redefine them inside `<style>`.

## Migration recipe (per surface)

1. Name the family and the skins the surface actually uses. If a needed skin is not in `skins.css` yet, add it there — once — and reuse it everywhere.
2. Replace the markup's contextual class with `class="<family> <family>-<skin>"` plus state classes.
3. Delete the appearance declarations from the component `<style>`; keep only layout, placement and size.
4. Check the four states every control has: default, hover, focus-visible, disabled — they must come from the skin, not from a local rule.
5. Verify with Playwright (below), then move to the next surface. Never mix a refactor of one surface with gameplay or data changes.

## Skin inventory

| Family | Skins | Used by |
|---|---|---|
| `btn` | `quiet` (compact control), `quiet.toggled` (the one that is on), `quiet.picked` (holds a choice, gold wash), `dagger` (primary action), `gold` (primary inside a board), `ghost` (faceless, edge only), `ghost.toggled`, `danger` (destructive), `icon` (fixed `--icon-*` square, geometry from the component), `prop` (an object the player works with; states `toggled`, `off`, `busy`; wears `--fed` as the ember at its feet) | rail tabs, command dock, travel actions, panel close, pager, verbs, picklist, market sell, Field Camp stations |
| `panel` | `veil` (modal scrim), `solid` (modal canvas), `showcase` (framed, no scrim), `head` (gold-washed title strip, owns its h2/h3/.sub type), `bracket` (HUD desk: face + two gold crop marks) | `Panel.svelte` `.veil`/`.box`/`.panel-head`, the allocate desk `.pop` |
| `notice` | `toast` (the welcome-back line over the field) | `App.svelte` `.toast` |
| `card` | `combat` (the fight's card face; states `front`, `elite`, `boss`), `portrait` (gold ring), `name` (the card's line; states `elite`, `boss`), `read` (info card), `picked` state | mob plates, Player Vital Card, market/want cards |
| `chip` | `rarity` (wears `--rar`), `tag` (states `picked`, `here`, `locked`, `element`, `xp`, `upper`) | filters, item metadata, waypoint choices, status chips |
| `badge` | `status` (states `buff`, `debuff`), `count` (states `urgent`, `xp`) | buff/debuff rails, mob debuff rail, tab and slot counters |
| `track` | `hud` (progress bar, `--radius-xs`), `meter` (states `hp`, `es`, `mana`, `exp`) | HP/ES/Mana/EXP bars, mob plate health bar |
| `pop` | `damage` (states `critical`, `dot`, `incoming`), `word` (defence text), `loot` | floating combat text, drop pills |
| `slot` | `gear` (states `worn`, `selected`, `held`, `locked`), `stack` (states `selected`, `held`), `empty` | bag/stash cells, equipment doll |
| `text` | `note` (muted, `--font-xs`), `dim` (muted, parent size), `value` (gold numeric), `good` (settled gain), `accent` (deadline), `alarm` (refusal, forfeit) | market, delivery, black market, camp, chronicle, notices |
| `selectable` | state `selected` (gold edge + wash) | market tabs, cargo rows |
| `plate` | `mark` (framed icon tile), `ground` (the recessed ground a row of objects stands on) | fieldwork camp/activity heads, Field Camp scene |
| `tab` | `rail` (states `active`; a press in a segmented strip) | chronicle filters |
| `gauge` | `hunger` (states `empty`) | Field Camp Hunger rail |

## Verification protocol

Run after each surface, and once for the whole pass:

- Playwright scan of the showcase (`/__showcase`) and the live hub at **1920×1080** and **1366×768**:
  - every `<button>` computes to the base padding,
  - no HTML text under 12px, no element with `scrollWidth > clientWidth`,
  - fixed-count rows keep their count (skill bar 7, bag 10, commands 4, plate row single).
- `npx svelte-check --tsconfig ./game/tsconfig.json` → 0 errors 0 warnings.
- `npm run test` (42 files / 576 tests) and `npm run typecheck` stay green.
- Screenshots of the touched surface before/after, kept outside the repo.

## What "done" looks like

A component's `<style>` block reads as layout only. Changing a look means editing one skin in `skins.css` and every surface wearing it moves together. An agent who has never seen the file can pick a family, apply a skin, and be correct.

## Handoff brief

Paste this when delegating a surface. It is the whole contract in five lines; the detail is this file.

> Refactor **`<Component>.svelte`** to the skin system in `docs/skins.md`.
> 1. Read `docs/skins.md` first — three layers, naming, hard rules, verification.
> 2. Touch only that component's markup and its `<style>`, plus `styles/skins.css` if a skin is genuinely missing.
> 3. Move every appearance declaration out of contextual selectors into a named skin; leave the component owning layout, placement and size only.
> 4. Do not add a token, a raw size, or a new colour. If the look needs one, stop and report it instead of inventing it.
> 5. Verify per the protocol in this file (Playwright showcase + hub at 1920 and 1366, `svelte-check`, `npm run test`) and report the numbers, not the intent.

Scope a delegate to **one surface at a time** — buttons, or `Panel`/modal, or the combat cards. Mixed CSS + gameplay work is how a refactor drifts.

## Order of work

| Step | Surface | Why this order |
|---|---|---|
| 1 | `styles/skins.css` created, `btn` family only | proves the layer split on the simplest element; padding is already base-only |
| 2 | `panel` + `notice` (`Panel.svelte`, `.pop`, toast) | one owner, high reuse, no HUD geometry at stake |
| 3 | `card` + `track` + `pop` (combat scene) | the surfaces with state paint (`picked`, `ready`) that most need a skin |
| 4 | `chip`, `badge`, `slot` | dense reads; verify the bag grid keeps 10 columns |
| 5 | HUD controls (`btn-icon` on rail/command dock) | last, because it can move live regions — re-check the Studio layout at 1920×1080 |
