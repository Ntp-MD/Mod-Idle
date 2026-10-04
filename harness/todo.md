# Todo

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

**Coding-readiness gate — every original A-ruling (A1-A10) is now landed; there are no owner decisions left open before the first code commit (`AGENT.md` §0 freeze).** The two that remained were answered this session: **A9** Base frame-weight → ship even-weighted (D-071), **A10** weapon Bases → a type may carry multiple Bases (D-072). Two small UI preferences were also settled or deferred by the owner (Collector sets finishable without the filter · D-073; Svelte confirmed · D-074; Capitals map-tease is a build-time UI call with no number behind it). **One question is open now that the audit has run (A11):** `concept.md` P0-2 promises the hit-count build its value from "proc per hit · DoT tick · chill", and the geared measurement (D-106) found the swing-count half of that true while the statuses those swings plant are a sliver of its damage at the level cap. Either raise the mob-side DoT budget `elements.md` §6 sets — which is the number D-094 already folded into `mob_HP`, so it re-prices the curve — or re-word P0-2 so the identity is swing count, chill uptime and Riposte’s dodge scaling and the DoT leg belongs to the poison build instead. Nothing in the queue moves it, because both answers change a published promise.

- [ ] **A12 · minute one cannot carry its own starting weapon** — the weight column D-101 imported (`equipment-weapon.md`, the range `mod-pool.md` states) is taxed by `formula-utility.md` §11 against a capacity of `Str × K_STR_WEIGHT`, which is 24 at level 1, while the opening one-handed sword weighs 35 and even the lightest main hand in the table weighs 25. So the opening swing pays roughly a 46% aspd cut from the first second, and the curve's 1.3-sec first kill is the *untaxed* figure. The cage prints both now (**OP6**, and both numbers sit in `concept.md`'s Minute One block), so the client and the docs cannot disagree by silence again. Three dials, and each moves a published number: raise the level-1 capacity (`K_STR_WEIGHT` or the Base stat), lower the weapon column's floor, or accept the carried opening and re-price zone 1's mob HP against the slower swing. Mine to build the moment one is chosen, not mine to choose — the design's opening minute is currently priced against a character who cannot lift what the design hands them.

# B · No decision needed — mine to build

**Nothing is left to build here.** Every audit line the queue carried has run and is recorded in `harness/decisions.md` — B1 (D-103) · B3 (D-106) · B4 (D-105) · B5 (D-097) · B8 (D-099) · B9 (D-102) · B10 (D-104) · B13 (D-101) · B21 (D-100) — and the one question that pass surfaced is A11 in the section above, because both of its answers move a published promise. **What the method was, so it can be re-run rather than re-invented:** the client holds no number of its own, it imports `engine/` and `tools/data/*.json`, so a value that moves is moved in the data and every cage and the client follow it in the same commit. The geared driver is `game/tests/gearedB1.test.ts` (walk the Road → dress the bag through the Equip verb → measure the bar empty against the bar full), damage is credited by source in `counters.damageBy`, and `node tools/verify.js` re-checks the whole set.


**Post-release, not tracked:** levels 91-100 and per-skill stat assignment (D-042). The game ships with the level-70-90 zone-9 band as its endgame; nothing after level 100 is designed here.

# C · Housekeeping that must not rot

- [ ] **C1 · `npm run check` is not green, and it is the gate that found a duplicated field** — `cd game && npx svelte-check --tsconfig ./tsconfig.json` had never been run; when it first ran, one of its findings was real: `GameState` declared `travel` twice with two different comments, which no cage, no test and no build complains about. The production code (`game/src/`) is clean under it now, and two genuine client defects found the same way are gone — the town panel captured the zone the page opened on instead of following the character (so an auto-travel step left it showing the town walked away from), and one save test's rejection assertion hung off an always-true ternary. Two named jobs are left and the command prints both counts live. **The test files** need the craft result union narrowed — the honest fix is a typed helper in `game/tests/craft.test.ts` that throws with the refusal's reason when a craft fails, applied at each call site; annotating `engine/craft.js` with a loose JSDoc shape was weighed and rejected, because a permissive return type silences the gate without typing anything, which is a fake green. **`src/App.svelte`** reports its runes as untyped calls (`$state<GameState>(…)` reads as an untyped function, so `state` falls back to `any` and everything downstream of it is unknown) while the identical expression type-checks clean in a fresh component and the file's own `npx vite build` and the whole suite pass — the suspect is `@sveltejs/vite-plugin-svelte` 5.1.1 against the installed Svelte, two majors behind, so the first move is a dev-dependency bump rather than a rewrite of the panel. A `svelte.config.js` with `vitePreprocess` was added on the way and cleared the `Error in vite.config` family one level down; it did not reach this one.
