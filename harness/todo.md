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

- **World scale — 18 zones · 180 levels** (`owner/travel-route-combat.md` sections 9-10). **Built, and the
  curve was NOT rebalanced** — the owner's 10.6 ladder rule was rejected in favour of holding the published
  numbers: zones 1-9 keep their exact anchors, and zones 10-18 are computed by holding the gear factor flat at
  its level-90 measured value (`mob.curve.extend`), so mob_HP(180) lands at 25,741 against the owner's ~25,700
  projection. Level cap 190 · spawn cap 180 · timeline reaches 198.8 hr with levels 1-100 unmoved. Ships:
  18 zones, 18 bosses, 18 settlements with a capital every three zones, 21 road links, the species re-spread
  over 18 zones, and the map overlay. **Open:** three survival gates are red because the larger cap changes what
  the old floor prices were calibrated against — see B.
- **Circuit expedition objective — needs a reward-mint ruling.** A goal on a multi-settlement circuit
  (finish a lap with no Push) wants a reward, and the parked idea specified gold and stones. A gold bonus
  would exceed the published 24 gold/day Road purse cap (D-133 · G6-G9 · E5); a stone bonus would be a new
  stone source. Blocked until the owner rules whether the cap may rise or the reward is non-material (a
  completion log). The objective itself is cheap once that is decided — `advanceLeg` already counts laps.

## B · mine to build

- **Three survival gates are red at the new cap, and both fixes are owner calls.** `SV2` wants the tank build to
  beat glass by at least 1.5x, but a full Vit spread now gives only 1.42x: the flat per-level HP term
  (`hp_per_level × 189`) outweighs the Vit K term, so stat investment matters proportionally less the longer
  the game runs. Raising `K_VIT_HP` 20 → 29 restores 1.5x and is real player power; lowering the floor to 1.4
  accepts that Vit is a thinner lever at the endgame. `SV6`/`SV7` are the G5 boss gate and now report 0-of-4
  builds Pushed, where the published answer expects some to fail — the same cause, the boss no longer threatens.

## C · housekeeping that must not rot

- **Two ratchets now sit at their ceiling.** `L9` (prose carries no numbers) is at its cap with zero headroom, so
  the next doc line that puts a digit in prose outside a generated block fails `node tools/lint.ts`. `A-hr100` is at
  its copy cap in `tools/anchors.ts`. Deleting a stale quote lowers the cap in the same pass; a new copy must not be
  added.
- **`A-refine` now carries a context regex.** It shares its digits with the drop-rate multiplier at the stat
  ceiling, so it reads only lines that are about refining, a set or a piece. Widen the pattern, never the cap, if
  another unrelated figure collides with it.

## Post-release · deliberately not tracked

- Client Road/Map cosmetics beyond the shipped Map page and Circuit editor — waypoint and link dialogs, richer map markers.
