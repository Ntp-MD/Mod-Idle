# Todo

import AGENT.md
import checks.md

The **single work file**: only what is _not built yet_, split by who can close it — **A** waiting on the
owner · **B** mine to build · **C** housekeeping that must not rot. **When work is done the line is
deleted, not ticked.** `node tools/verify.ts` green is the state of everything already built, so never
copy a cage result in here.

# Open work

**C — housekeeping**

- **The settlement field is wider than its own canvas.** `map.json`'s `view` is 2000×1200 but the tuned node coordinates spread owned hexes over 1432 units vertically, so the field sits right of the sheet's centre (dead plate on the left) and the generator's border-fill lattice runs ~145 units past the rim. Two rim sub-zones (Glacier Teeth · Throne Abyss) are clipped by under a pixel at the fit view. Fixing it means re-tuning the 18 node coordinates to fit, or growing `VIEW` and stretching `map-terrain.svg` with it — both owner calls, because distance from the sheet's centre is the difficulty rule. The client reads the canvas off the overlay and adds a 72-unit bleed, so nothing else is cut.
- **Cluster names can collide on the sheet.** `Millbrook` and its sub-zone `Thunder Gulch` overprint, and neighbours `Frosthold` / `Wolf Cross` sit close. `M9` checks that every name is drawn, not that the names are legible; separating them is a generator layout change (`tools/map.ts`).
