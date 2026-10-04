า# Todo

import AGENT.md
import harness/HARNESS.md
import checks.md
import harness/decisions.md

Work list, split by **who can close it**. Nothing here restates a number — every line points at the file that owns it, so a decision lands in one home (`checks.md` holds the promises, `harness/decisions.md` records what was already ruled and why).

`node tools/verify.js` green is the state of everything already built; this file is only what is *not* built. **Do not copy the cage results in here** — `verify.js` prints them live and a typed copy goes stale.

# What this repo is

Building now, first slice running. An idle loot game (Melvor-style: a combat core loop plus one Farming life skill): 9 zones × 10 levels, 12 item slots, the skill roster, 5 Elements, no death (Push instead). **The mob side is finished** — 15 species × 4 body classes across the 9 zones with Elite and 9 named bosses = 120 generated entries in `mob-roster.md`, each stat block resolved. All content is `.md`; every number is driven by JSON under `tools/data/` and projected into the docs by a writer. The client (`game/`) and the cages both call `engine/`, so no formula has a second home.

**Git is replace-all only** (`AGENT.md` §6): pull = `git fetch` + `git reset --hard`, push = `--force-with-lease`. Never merge.

# Where the numbers live

```
tools/data/engine.json   stat · K · caps · loot · mod_weights · craft · status · herbs · farm · potions · skill_drop · mob species/zones/bosses · elements · timeline
tools/data/mods.json     24 mod value ranges + quality bands
tools/data/town.json     prices · rosters · stock · Standing
tools/data/skills.json   roster · reserve tiers · formula · renames
tools/data/tree.json     empty shell (D-046 - there is no passive tree); `tools/tree.js` is the cage that holds it that way
tools/data/bases.json    Base frames per slot · weight · Primary / Secondary pools · Gear Mod school (`node tools/bases.js --write` imports, `--checks` gates)
tools/data/aliases.json  deprecated terms
```

Every derived table sits between `<!-- BEGIN GENERATED:key -->` markers. Never hand-edit between them — edit the data, run that file's writer, run `verify`. Shared readers: `tools/lib/engine.js` (numbers) · `roster.js` · `skillmodel.js` · `generated.js` · `registry.js` · `state.js`.

**The cages** (12, all run by `verify.js`): `check` (engine) · `town` · `skills` · `tree` · `ladder` · `loot` · `bases` · `timeline` · `survival` · `inventory` · `anchors` · `lint`.

**Rebuild the views after a doc edit:** `node tools/report.js` (dashboard.html) and `node tools/wiki.js build` (wiki/). The writer that owns a generated block is the `--write` flag of that block's cage.

# A · Waiting on the owner

**Coding-readiness gate — every A-ruling is now landed; there are no owner decisions left open before the first code commit (`AGENT.md` §0 freeze).** A1-A10 landed earlier (**A9** Base frame-weight → even-weighted, D-071 · **A10** weapon Bases → a type may carry multiple Bases, D-072 · the two UI preferences D-073 / D-074), and the last two are answered: **A11** — `concept.md` P0-2's hit-count promise was re-worded so the identity is **swing count · chill uptime · Riposte's Evasion-scaling damage**, with the DoT leg handed to the poison build, so no curve value was re-priced (D-106 measured the identity holding on geared characters). **A12** — the starting character's `weight_base` (D-115) lifts the level-1 capacity clear of every main hand, so minute one carries its own sword untaxed and OP6 prints 0%.

- [x] **A12 · minute one could not carry its own starting weapon — closed (D-115).** The owner set a starting-character base of `weight_base` 1,000 added to the Str bonus, so the level-1 capacity is 1,024 and the opening 35-weight sword is carried untaxed — the cage prints 0% (**OP6**) and `concept.md`'s Minute One block reads the same first-kill time priced and carried. The dial the line named was the Base stat; the owner chose it directly rather than through `K_STR_WEIGHT`.

# B · No decision needed — mine to build

**The audit is done; the two sizing follow-ups from the D-112 / D-114 re-base are now closed (D-116).** Every audit line the queue carried has run and is recorded in `harness/decisions.md` — B1 (D-103) · B3 (D-106) · B4 (D-105) · B5 (D-097) · B8 (D-099) · B9 (D-102) · B10 (D-104) · B13 (D-101) · B21 (D-100) — and the one question that pass surfaced is A11 in the section above, answered there. **What the method was, so it can be re-run rather than re-invented:** the client holds no number of its own, it imports `engine/` and `tools/data/*.json`, so a value that moves is moved in the data and every cage and the client follow it in the same commit. The geared driver is `game/tests/gearedB1.test.ts` (walk the Road → dress the bag through the Equip verb → measure the bar empty against the bar full), damage is credited by source in `counters.damageBy`, and `node tools/verify.js` re-checks the whole set.

- [x] **B23 · `Grace`'s Evasion flat — re-priced onto the 80% fraction (D-116).** D-112 merged `Dodge` into `Evasion` after the aura had been sized against the old range, leaving it below the share of the item ceiling `Iron Guard` and `Energy Guard` keep; it now reads the same 80% of `evasion_flat`'s own ceiling, and the skills writer re-printed the value. The §Sizing note in `skill-pool-aura-heal.md` states the fraction instead of an open item.
- [x] **B24 · the `Perfect dodge %` band — derivation re-stated (D-116).** D-111 derived `1-3` as 10% of `caps.perfect_dodge` (then 25); D-114 re-based that Cap to 21. The band stays `1-3` because a three-quality-band mod with one Tier slice per band spans at least three points (MP1), so the derivation is restated as `top = ceil(10% of the Cap)`, which reproduces the shipped band from Cap 21 with no data change.

**Post-release, not tracked:** levels 91-100 and per-skill stat assignment (D-042). The game ships with the level-70-90 zone-9 band as its endgame; nothing after level 100 is designed here.

# C · Housekeeping that must not rot

- [x] **C1 · `npm run check` is green (D-117).** The gate's findings were real and are closed: the `GameState.travel` duplicate, the town panel capturing the zone it opened on, and the always-true save-test assertion. The test files narrow the craft union with typed helpers (`made`/`refused`/`isMade`) rather than a loose JSDoc. `src/App.svelte`'s untyped-runes failure was **not** the plugin version — the registry has no newer `svelte-check`/`svelte`, and the cause is sveltejs/svelte#13715: a top-level `let state` makes svelte2tsx read every `$state` as the phantom `$state` store. Renaming the binding to `gameState` (the documented workaround) cleared it, alongside the stale `Dodge`/`perfect dodge` rows. `noEmit: true` clears the 8 `allowJs` overwrite warnings. **0 errors, 0 warnings.**
