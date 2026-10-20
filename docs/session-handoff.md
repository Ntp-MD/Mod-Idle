# Session handoff — 2026-10-20

State of the workspace when the session was stopped. [AGENTS.md](../AGENTS.md) owns the workflow;
[improvement-plan.md](improvement-plan.md) is the packet list this session executed. No commit was
made; every change is in the working tree.

## Where the work stands

| Packet | Status | Notes |
|---|---|---|
| **P0** baseline repair | **done** | The two reproducible regressions pass; the tree output is byte-identical. |
| **P1** key/type seam | **done** | Finite `K` keys, a runtime validator shared by the client and the cages, the consumed missing fields declared. |
| **P2** structural gates | **done** | BS6's roster quota removed, BS11 made unique, X21/X34/X40 split into hard structural gates, a pure check seam with a test. |
| **P3** shared drop builder | **done** | One builder in `engine/loot.ts`; both old paths proved reproduced from a pre-change reference. |
| **P4** remaining constants | **partly done** | The loot tier split and the skill ladder / conversion / group bonus now live in the data. `GROUP_AVG` and `CHECKPOINT_LEVELS` are **not** done — see "left open". |
| P5–P11 | **not started** | Elemental/HP helpers, fixture cleanup, references, modularity, typing, CI, UI audit. |

## What changed

### P0 — the baseline

- `engine/tree.ts`: `TreeSpec` gained `shallow_nodes`; the shallow boundary and the rank count are
  read from the spec (`readSpec`, engine/tree.ts:54), and a spec that lost a key is refused by name.
- `tools/data/tree.json`: `"shallow_nodes": 14` — the old literal, now data-owned.
- `game/tests/progression.test.ts`: the mutation test passes; one case covers the three malformed-config refusals.
- `game/tests/audit-regressions.test.ts`: added `sectionOf()` (fails on a missing or empty section) and
  repaired the assertions — the real heading is `Elite, Unique and Boss`, and the HP semantics are
  asserted as `BaseHP(L, Boss Core)` / `BaseHP(zoneTop, Unique Core)` / `BaseHP(L, Variant Core) ×`.
- `game/src/wiki/pages.ts`: **unchanged** — the wiki content was already correct; only the test extraction was broken.

Proof: the full `createTree` dump (75 nodes, values, ranks, costs, connectivity, `linesOf`,
`pointsSpent`) is SHA-256 identical before and after; node ids and rank caps are unchanged, so saved
allocations keep their meaning.

### P1 — keys and the configuration seam

- `engine/types.ts`: `KMap` is now `Record<(typeof K_KEYS)[number], number>` over an explicit
  `K_KEYS` list (31 constants). A constant the engine never declared fails the compiler; a constant
  the data lost fails the build (proved: the client typecheck errors when `K_VIT_HP` is removed).
- `engine/validate.ts` (new): a pure validator over the paths the factories read — required
  sections, every `K` constant, the stat and cap numbers, the Max HP press, the bag filter, the
  damage-split pairs, and the zone / species / body identities. Every refusal names the exact path.
- `game/src/engine/client.ts`: `ENGINE_DATA` is validated, not asserted; the `MODS`, `SKILLS`,
  `TREE`, `TD` and `BD` casts are gone (the declared views now match the data).
- `tools/lib/engine.ts`: the cages load the same validated data.
- `engine/types.ts`: `EngineData.max_hp_press` and `LootCfg.filter` declared (both are consumed by the
  client); `SkillRow.duration` corrected to `string` (the data says `"8 sec"`); `TownData.repeatable`
  corrected to a union of the price shapes the data really carries.
- `game/tests/data-validation.test.ts` (new, 11 tests).

### P2 — structural gates

- `tools/bases.ts`: BS6 no longer counts weapon types (the table's shape is the condition);
  the second BS11 became **BS14**; `checks(source?)` takes an in-memory object so a broken structure
  can be proved without writing a broken file; the CLI runs only when the file is the entry point.
- `tools/check.ts`: X21, X34 and X40 are hard gates again — each of their predicates is a rule, a
  copy or a shape, not a measured figure. The `mana_mult >= 1` bound is classified with its owning
  rule (the AoE trade) and stays hard.
- `game/tests/bases-gate.test.ts` (new, 7 tests): the real file passes, every gate has its own id,
  and four malformed structures FAIL.

### P3 — one drop builder

- `engine/loot.ts`: `pickWeighted`, `rollBase` (with the optional bias the cage's experiment needs)
  and `buildLines` (the whole line assembly, Tier draw first, every draw in its old position).
- `tools/loot.ts` and `game/src/sim/drop.ts`: each wrapper keeps its own slot choice, level source,
  quality index and output; both call the one builder. The cage's CLI no longer runs on import.
- `game/tests/dropReference.ts` + `game/tests/drop-parity.test.ts` (new): the reference captured
  **before** the change (424 items across 4 bands, 2 seeds, 4 item levels, plus the RNG position
  after each group). The new paths reproduce every item and every stream position.

Proof: `node tools/loot.ts --sim` is byte-identical before and after; the loot report numbers do not move.

### P4 — constants, partly done

- `tools/data/engine.json`: `loot.tier_split` = `[0.5, 0.83]` (moved from `engine/loot.ts`).
- `tools/data/skills.json`: `meta.formula.ladder` (the six rungs), `meta.formula.conversion_duplicates` = 2,
  `meta.formula.group_bonus` = 0.25 (moved from `engine/skills.ts`).
- `engine/skills.ts`: the model reads them and refuses a roster that lost them, so the wiki's
  "skills.json ladder" is now true.

## Left open (P4, then the rest of the plan)

1. **`GROUP_AVG` in `tools/check.ts:731`** — the duplicated `{ low: '1-2', mid: '2-3', high: '3-5' }`
   table. The plan's replacement: derive the band list from `item_level.spans` and the expected group
   average from `loot.bands[band].group_mobs` (the zone's `group` string must average to it), so the
   literals disappear and the gate keeps its meaning.
2. **`CHECKPOINT_LEVELS` in `engine/index.ts:823`** — split the gameplay levels (30 / 60 / 90 / 100:
   the band edges and the push window, which `BAND.*.band_kills` and `PUSH_KILLS_91_100` read) from
   the sampling levels (10 / 120 / 150 / 180 / 190, which only the report prints). The values stay as
   they are; only the two jobs are separated and named.
3. **P5** elemental power and mob HP helpers (`game/src/sim/player.ts` computes total and per-element
   power; `game.ts` repeats the flat HP terms `engine/index.ts` owns in `mobHpOf`).
4. **P6** the six mob builders in the tests.
5. **P7** stale references — `engine/tree.ts:3` still names a cage `tools/tree.ts` that does not exist;
   `tools/lib/roster.ts:4` names it too.
6. **P8** `engine/index.ts` (1,205 lines) and `App.svelte` (4,731 lines) modularity — optional.
7. **P9** `tools/map.ts` is `@ts-nocheck`; the craft and road boundaries use `any`.
8. **P10** CI — `.github/` has instructions and no workflow.
9. **P11** the UI/UX audit (`audit-ux-ui` skill) — bounded scope, 1920 × 1080, port 5173.

## Verification state at the handoff

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm --prefix game run check` (svelte-check) | PASS — 0 errors, 0 warnings |
| `npm run verify` | 9/9 cages PASS |
| `npm test` | 58 files, 724 tests, all pass |
| `npm run wiki` | 19 pages regenerated, byte-identical to before |

## Notes for whoever picks this up

- The client and the cages now share one validator (`engine/validate.ts`) and one drop builder
  (`engine/loot.ts`). A new data section should be declared in `engine/types.ts` **and** checked in
  the validator, so the client and the cages agree on what a valid file is.
- `engine/types.ts` is the declared view of the data; the client's JSON→engine assignments are typed,
  so removing a required key from a data file is a compile error. Keep it that way — do not re-add a
  cast.
- `tools/bases.ts` and `tools/loot.ts` only run their CLI when they are the entry point, so a test
  may import them. `tools/bases.ts` exports `checks(source?)` for the same reason.
- `game/tests/dropReference.ts` is a captured reference, not a copy of the source: do not regenerate
  it from the current code — it exists to fail when the roll moves.
