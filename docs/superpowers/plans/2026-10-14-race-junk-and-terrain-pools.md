# Race Junk and Terrain Spawn Pools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every race three new junk item choices, allow races to spawn in multiple terrain subzones, and record those rules in Mob Core.

**Architecture:** Keep zone eligibility on `mob.species[].zones` and subzone eligibility in each subzone's `races` pool; overlap is valid while the union still covers the zone roster. Store one extra junk item per rarity on each species, keep each variant's rarity and lean, and select between its existing item and the matching-rarity species item only after its junk rarity roll succeeds.

**Tech Stack:** TypeScript, JSON engine data, Vitest, existing Node data gates and wiki builder.

**Spec:** `docs/superpowers/specs/2026-10-14-race-junk-and-terrain-pools.md`

## Global Constraints

- Keep `map.json` presentation-only; terrain spawn pools stay in the engine data.
- Preserve existing variant rarity/lean semantics and expected junk gold per kill.
- Do not change save data format or add dependencies.
- Keep every mob's icon resolved by its race/species mapping.
- Local working-tree changes are user-owned and must remain untouched.

## Review Focus

- A species with a missing rarity choice, repeated item name, or cross-race junk name must fail the data gate; test the X39 roster rule.
- A same-rarity extra junk item must be selectable without changing its variant's rarity or lean; test the item-choice helper and the existing expected-gold gate.
- A race repeated across different environment pools must pass, while an unknown race or missing zone race must still fail X53; test overlapping configured pools and keep the gate's membership checks.
- A subzone must list normal variant names for every race it can spawn; retain X57 validation when expanding an overlap pool.
- All species must continue resolving their own icon; verify the existing mapping remains complete without adding a second icon system.

---

### Task 1: Pin junk selection and overlap behavior

**Files:**
- Modify: `game/tests/mob-terrain-drops.test.ts`
- Modify: `game/tests/simModules.test.ts`

**Interfaces:**
- Consumes: existing `engineData.mob` fixtures, seeded RNG helpers, and `mobIcon()`.
- Produces: regression assertions for one extra item per rarity and race, selection among the variant item and same-rarity race item, correct Counterhand sale pricing, an actual configured race overlap across different environments, and complete species icon resolution.

- [x] Add a helper behavior test by importing `engine/loot.ts` as a namespace, asserting `chooseJunkItem` exists, then verifying it returns the variant item or its matching-rarity race item from deterministic rolls; the missing export should be the expected RED failure.
- [x] Add a failing data assertion that every species has one extra junk name at each rarity, with all names unique and not shared with another species or variant's existing junk item.
- [x] Extend the Counterhand sale test to assert a race item sells for its declared rarity price; verify RED before changing `town.ts`.
- [x] Add a failing assertion that at least one race appears in two subzones with different environments, and that both subzones list its normal variants.
- [x] Assert every species id resolves to a distinct mapped icon through `mobIcon()`.
- [x] Run the targeted test files; new feature assertions failed before implementation and passed after it. `pnpm` could not run because its auto-install hit the ignored `esbuild` build-script policy, so direct Vitest/npm scripts were used.

### Task 2: Add race junk choices and preserve variant behavior

**Files:**
- Modify: `engine/types.ts`
- Modify: `engine/loot.ts`
- Modify: `game/src/sim/game.ts`
- Modify: `game/src/sim/town.ts`
- Modify: `tools/data/engine.json`
- Modify: `tools/check.ts`
- Test: `game/tests/mob-terrain-drops.test.ts`
- Test: `game/tests/simModules.test.ts`

**Interfaces:**
- `MobSpecies.junk_items: Record<string, string>` owns one extra item name for each of `common`, `uncommon`, and `rare`.
- `chooseJunkItem(rng: () => number, variantItem: string, rarity: string, raceItems: Record<string, string>): string` picks uniformly from the variant item and the species item at the same rarity; callers invoke it only after the variant's existing rarity chance succeeds.

- [x] Add the failing helper and sale-price tests before implementation and verify RED with focused Vitest commands.
- [x] Add `junk_items` to the species type and add exactly three distinct themed junk names per species, keyed one each by rarity, in `engine.json`.
- [x] Implement `chooseJunkItem` in `engine/loot.ts`; keep the existing variant item in the choice pool and include only the species item with matching rarity.
- [x] In `game/src/sim/game.ts`, resolve the species from the spawn's `speciesId` and select the item after the matching rarity roll; use the selected item for both normal inventory and dungeon escrow.
- [x] Update `game/src/sim/town.ts` so the sale lookup recognizes the new per-race items at their declared rarity.
- [x] Update X39 to validate one extra item per rarity per species, global uniqueness, and no collision with existing variant junk items; keep its rarity chance × sale price expected-gold invariant.
- [x] Run focused Vitest tests; the mob/terrain file passed 26/26 and the Counterhand sale test passed.

### Task 3: Enable overlapping terrain pools and update Mob Core

**Files:**
- Modify: `tools/data/engine.json`
- Modify: `tools/check.ts`
- Modify: `doc/DECISIONS.md`
- Modify: `game/tests/mob-terrain-drops.test.ts`

**Interfaces:**
- Consumes: `mob.species[].zones` as zone eligibility and `mob.zones[].subzones[].races` as independent spawn pools.
- Produces: one configured race overlap across different environment types; each affected subzone's `normal` list includes the added race's three normal variant names.

- [x] Add wolf to zone 1 Village Outskirts as well as Grassland and append its three normal variant names.
- [x] Update X53 wording to describe independent overlapping pools; continue requiring every pool member to belong to the zone cast and the union to cover the full cast.
- [x] Update `doc/DECISIONS.md` §Mob Core: subzone pools are not a partition; races may appear across different terrain environments; forms inherit their race's extra junk choices; icons remain species-specific.
- [x] Update `engine.json` Mob Core and variant-drop notes to match the new junk ownership and overlap rule.
- [x] Run `npm run verify` and targeted Vitest tests; X39, X53, X57 and the target tests pass.

### Task 4: Rebuild derived docs and finish checks

**Files:**
- Generate: `wiki/`

- [x] Run `npm run wiki` to rebuild the player-facing wiki from current sources.
- [x] Run `npm run typecheck` and `npm run check`; report remaining Svelte diagnostics without changing unrelated files.
- [x] Review `git diff --check` and `git status --short`; preserve all user-local edits.
- [x] Run production build; it succeeds with existing unresolved icon-path and large-chunk warnings.

## Verification notes

- `npm run verify`: 5/5 cages pass, including X39, X53 and X57.
- Focused Vitest: `mob-terrain-drops.test.ts` 26/26 pass; Counterhand sale test passes.
- Full Vitest: 409 tests pass; `tests/logBox.test.ts` cannot load the locally modified `game/src/ui/LogBox.svelte` because Vite reports invalid Svelte syntax. Left those user-local files untouched.
- `npm run typecheck`: passes. `npm run check`: still reports two existing `zone` possibly undefined diagnostics at `game/tests/mob-terrain-drops.test.ts:101` and `:103`; the new tests add no Svelte-check diagnostic.
- No commit, push or pull was made.

Run test commands from `game/`; run verification, wiki, typecheck and check commands from the repository root.
