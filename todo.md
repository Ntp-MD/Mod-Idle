# Todo

import AGENTS.md

The **single work file**: only what is _not built yet_, split by who can close it — **A** waiting on the
owner · **B** mine to build · **C** housekeeping that must not rot. **When work is done the line is
deleted, not ticked.** `node tools/verify.ts` green is the state of everything already built, so never
copy a cage result in here.

## A — waiting on the owner

## B — mine

_None._


## C — housekeeping

- Tests that re-implement a pipeline instead of calling the sim (`basicAttack` bolt, `block` physical hit, `engine-agreement` aspd) and weak assertions (`newModLines`, `filter`, `skillMode:86`, `potionDrop` rate) — tighten as each is next touched.
- Stale deleted-doc names (`checks.md`, `mod-pool.md`, `formula.md`, `towns-stalls.md`, …) still sit in comments across `tools/` and `game/tests/` — trim when the file is next edited.

_Post-release, deliberately not tracked: the wiki view (reads `tools/data/*.json` + `engine/`)._
