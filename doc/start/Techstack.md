# Tech Stack

import AGENT.md
import save.md

**Target:** a browser game, single-player, no server. This file fixes the stack; it is a design decision, not a number source.

# The one rule that matters most

The game and the cages must run the **same engine math**. Today the numbers live in `tools/data/*.json` and the math in `tools/lib/engine.ts`. The game imports the same JSON and calls the same functions — it never copies a formula. When a formula is needed on both sides it is extracted into one shared module that both import, so a cage and the game can never disagree. A second copy of a formula is the same defect as a second copy of a number (`AGENT.md` section 3).

# Stack

| Layer | Pick | Why |
|---|---|---|
| Language | TypeScript | The data model is large (13 slots, Mod / Item quality / Tier, 5 Elements, the full mob roster); types catch the drift this repo already fights |
| Build | Vite | Fast dev server, static output, no backend |
| UI | Svelte | Small bundle, low boilerplate for a panel-heavy idle UI (React or Solid are fine if preferred) |
| State | Svelte stores / a small reducer | No Redux-class dependency |
| Persistence | IndexedDB, localStorage fallback | Local only, 3 slots, JSON export/import (`save.md`) |
| Simulation | Fixed 1-second tick + offline catch-up | The idle loop; offline uses a monotonic clock and the 12-hour cap (`save.md`) |
| RNG | Seeded | Offline results are reproducible and a save cannot be rerolled for a better outcome |
| Tests | Vitest | Reuses the cage logic |
| Deploy | Static host (GitHub Pages / Netlify) | Replace-all git already fits this; add a PWA manifest to play offline |

TypeScript runs with **Node native type stripping — no build step, no runtime dependency**. `engine/`, `tools/`, and `game/` are all `.ts`; Node (and Vite) strip the types at load, so the cages and the client keep running the *same source files*. `npm run typecheck` (`tsc --noEmit`) is a dev-only checker that never emits.

# Layout — landed

```
engine/                the shared math, one home: index.ts (createEngine) · loot.ts (createLoot + rng)
tools/lib/engine.ts    an ESM bridge: loads tools/data/engine.json and re-exports engine/
game/
  src/
    engine/client.ts   imports the same JSON + createEngine the cages call
    sim/               tick loop, combat order, drops, offline catch-up
    state/save.ts      IndexedDB + localStorage fallback, 3 slots, JSON export/import
    App.svelte         the field HUD, the menu rail, and the sub-screen behind each tab
  tests/               Vitest: game values === cage values === the numbers the docs publish
```

`node tools/verify.ts` (12 cages) and `cd game && npx vitest run` (265 tests) are the two green signals.

# Shared engine home — decided at the first code commit

The shared engine lives in a top-level `engine/` as an ESM factory over the parsed data
(`createEngine(E)` · `createLoot(E, MODS)`). `tools/` reaches it through the `tools/lib/engine.ts`
bridge, which keeps the doc read-back on the cage side; the game imports `engine/` and
`tools/data/*.json` directly. No formula exists on both sides.

# Not used

- No backend, no accounts, no cloud — `save.md` is local only.
- No player trading.
- No graphics engine (Phaser / Three) — the game is panels and numbers, not motion.
- No Web Worker at first; a 1-second tick is cheap. Add one only if profiling says so.
