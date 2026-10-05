# Todo

import AGENT.md
import harness/HARNESS.md
import checks.md
import harness/decisions.md

The **single work file**: only what is *not built yet*. Nothing here restates a number — every line
points at the file that owns it, so a decision lands in one home (`checks.md` holds the promises,
`harness/decisions.md` records what was already ruled and why). **When work is done the line is
deleted, not ticked.** Open items are split by who can close them: **A** waiting on the owner ·
**B** mine to build · **C** housekeeping that must not rot.

`node tools/verify.ts` green is the state of everything already built; this file is only what is *not*
built. **Do not copy the cage results in here** — `verify.ts` prints them live and a typed copy goes stale.

# Open work

## A · waiting on the owner

- **World scale — 18 zones · 180 levels** (`owner/travel-route-combat.md` sections 9-10). The four travel
  deltas shipped (D-133 · D-134); this one did **not**. It is a numeric-base rebalance, not a travel feature: it
  replaces the hand-typed zone-edge anchors with a derived curve, so `mob_HP` and everything measured off it move —
  the X37 anchors, `world.md`, the loot bands, the town budgets and the published timeline (`checks.md` E5). It also carries a fork the
  owner file states both ways: section 10.1 keeps zones 1-9 and their bands untouched, section 10.6 stretches every
  band to 60 levels. Costing sits in the owner file (§9 power table · §10.6 the 36 anchors "cannot be typed by hand").
  Answer by digit which side of the fork, then it is a build. Sub-items once the fork is chosen: new settlements and
  their stalls (`town.json`), a named boss per new zone, species re-spread with the X23 per-zone floor held, the
  derived zone-edge curve plus its anchors in `engine/`, X23/X26 re-proved over the new zone count, and a
  `world.md` regeneration.
- **MP3 mod band skew — one red client test.** `game/tests/craft.test.ts` "Refine pushes one Tier up and stops dead
  at T1" throws `no value range for mod "elemental_alignment"` out of `engine/loot.ts` `rangeOf`. The `mods.json`
  band for that line does not cover every quality/Tier cell the Refine path can ask for. It is **not** a travel
  regression and predates D-133/D-134 — it is MP3, left pending on purpose because re-cutting a band moves the
  craft timeline (`harness/decisions.md` · `checks.md` stones). Every other client test is green.
- **Client Road and Map screens — build or leave sim-only?** `towns-ui.md` §2 and §9 specify the Map page, the
  Circuit editor and the Road dialogs, and `tools/map.ts` now writes the overlay, but no Svelte component exists:
  the Road was sim-only before this work and still is. The owner file's build list for the travel deltas covered
  `game/src/sim` and `save.md`, not UI, so this is a scope call rather than a missing piece.

## B · mine to build

- (none — nothing is half-built. `node tools/verify.ts` is green; the client suite is green except the MP3 item above.)

## C · housekeeping that must not rot

- **Two ratchets now sit at their ceiling.** `L9` (prose carries no numbers) is at its cap with zero headroom, so
  the next doc line that puts a digit in prose outside a generated block fails `node tools/lint.ts`. `A-hr100` is at
  its copy cap in `tools/anchors.ts`. Deleting a stale quote lowers the cap in the same pass; a new copy must not be
  added.
- **`A-refine` now carries a context regex.** It shares its digits with the drop-rate multiplier at the stat
  ceiling, so it reads only lines that are about refining, a set or a piece. Widen the pattern, never the cap, if
  another unrelated figure collides with it.
