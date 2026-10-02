# Handoff

State of the design repo for the next agent/session. Read this first, then `AGENT.md` (rules) and `decisions.md` (why).

## 1. What this repo is

Design phase, no game code. An idle loot game (Melvor-style, combat only): 9 zones × 10 levels, 12 item slots, 43 skills (roster mid-redesign), 5 Elements, no death (Push instead). All content is `.md`; all numbers are driven by JSON under `tools/data/` and projected into the docs by cages.

**Git is replace-all only** (`AGENT.md` §6): pull = `git fetch` + `git reset --hard`, push = `--force-with-lease`. Never merge.

## 2. Green state

`node tools/verify.js` → exit 0. Cages and last known result:

| Cage | Result |
|---|---|
| `tools/check.js --checks` | 60/60 PASS |
| `tools/town.js --checks` | 21/22 PASS · 1 PENDING (T10b, waits on F9) |
| `tools/skills.js --checks` | 9/9 PASS |
| `tools/tree.js --checks` | 5/5 · T5 PENDING (23 waived cleared-buff refs) |
| `tools/ladder.js --checks` | 5/5 PASS |
| `tools/timeline.js --checks` | 3/3 PASS |
| `tools/lint.js` | 7/7 PASS |

Rebuild views after doc edits: `node tools/report.js` (dashboard.html) and `node tools/wiki.js build` (wiki/). Live editor: `node tools/wiki.js serve --open` (loopback only; edits engine · town · skills · tree with validate → snapshot → writers → all cages + lint → rollback on fail).

## 3. Architecture

```
tools/data/engine.json   stat · K · caps · loot · craft · xp · timeline   → check.js, town.js, timeline.js
tools/data/town.json     prices · rosters · stock · Standing              → town.js
tools/data/skills.json   roster · reserve tiers · formula · renames       → skills.js, tree.js, ladder.js
tools/data/tree.json     branches · 18 keystones · pending_refs           → tree.js
tools/data/aliases.json  deprecated terms                                → lint.js
```

Every derived table lives between `<!-- BEGIN GENERATED:key -->` markers. Never hand-edit between them; edit the data, run the writer, run `verify`. Current generated blocks: 22.

Shared readers: `tools/lib/engine.js` (numbers), `tools/lib/roster.js` (skills), `tools/lib/skillmodel.js` (damage/cd math), `tools/lib/generated.js` (block I/O), `tools/lib/registry.js` (data schema for the wiki editor), `tools/lib/state.js` (wiki state).

## 4. How to change things

| Want to | Do |
|---|---|
| change a stat/K/Mod/craft number | edit `engine.json` → `node tools/check.js --write` + `town.js --write` + `timeline.js --write` → `verify` |
| change a skill (cd · mana · scale · effect) | edit `skills.json` → `node tools/skills.js --write` → `verify` |
| rename a skill | change `name` + add `"Old": "New"` to `skills.json` `renames` → `node tools/tree.js --write` |
| change an aura reserve/effect | edit `skills.json` → `skills.js --write` |
| add/remove a tree node | edit the table in `skill-tree-*.md` (prose) + update `tree.json` counts if needed → `tree.js --write` |
| see a value's effect | `node tools/skills.js --calc --stat N --power N --level N --cdr N --ladder N`, or the dashboard "Skill workshop" |
| edit data with a form | `node tools/wiki.js serve --open` |

Rules that are enforced: prose must not restate a generated value (lint L7) · counts/headings must match `skills.json` (L5) · every import, markdown file reference and line citation must resolve (L1-L3) · no deprecated term (L4) · generated markers balanced (L6).

## 5. Decisions

Full log in `decisions.md`. Summary:
- **D-001** auras reserve Max Mana (no drain).
- **D-002** aura roster 6 → 12.
- **D-003** normalization: data files + cages + generated blocks.
- **D-004** prose may not restate a generated value (L7).
- **D-005** tree wiring is rename-proof via `skills.json` `renames`.
- **D-006** no reservation Cap; player manages the set, only a 100% block.
- **D-007** skill workshop + `eff cd` / `presses/sec` columns.
- **D-008** wiki editor generalized to every data file.
- **D-009** gap pass — see below.

**D-009 answers (applied):** D1 = A (define mob sheet + `survival.js`) · D2 = buff roster **deferred**, stays 0, tree refs stay waived · 3a Rimbo Form stacks with chill to −35% · 3b res is a straight % into `elem_res_pct_x` · 3c perfect dodge deletes the hit on trigger, not opposed; Grace keeps Dodge flat only · 3d Heralds fire/cold/lightning only · 4a fast hit stays a hit-count build · 4b Elements stay a gate · 5a Quality Stone tiered `1/2/3/4/5 · 7/9/11/13/15 · 18/21/24/27/30` · 5b no per-item craft ceiling · 5c Unique cut · 6a F9/F10/F13 set from flow · 6b Base bias stays pending · 6c Collector completable without the filter · 7a melee "nearby" = 3 mobs · 7b late-zone bosses get signature skills · 7c achievements cut.

## 6. Open work (priority order)

### D1 — mob sheet + `tools/survival.js` (biggest)
The defense layers exist as rules but not as numbers. `P1-1 option A2` (dodge opposed by mob accuracy) is **referenced everywhere but defined nowhere** — it must be written before the sim can run. Needed:
1. mob accuracy curve + player evasion (`K_EVASION`, mod range) — PoE entropy ahead of dodge.
2. `K_ARMOUR` + armour flat range → physical half of incoming, curve `armour/(armour+5×raw_hit)`.
3. `K_ENERGY_SHIELD` + range → pre-HP pool, chaos bypass, recharge after 5 sec.
4. Build `tools/survival.js` and replace: `checks.md` D6-D14 · `combat.md` §6/§7 tables · AoE clear-time table in `skill-pool-system.md` · C1 dodge reachability.
5. Then price `Iron Guard` / `Energy Guard` reserves (they are `TBD` in `skills.json`).

Anchor targets already stated in the docs: Iron Guard = 10% mitigation vs an on-level boss (1,316/sec at L100); ES ≈ 20-30% of HP pool; dodge Cap 90 must be reachable (C1). Build cards are in `combat.md` §6 (glass/mix/tank/dodge).

### D6 — loot numbers
`F9` (Add-mod stone rate) · `F10` (Ascend/hr) · `F13` (herb bundles/hr) · Base-bias keep-rate re-sim (`T15`) · Collector rule wiring.

### Other known pending
- **Aura Economy limb** (`skill-tree-control.md`): 7 nodes still describe the deleted drain mechanic / old auras; 4 rows read "no subject"/"dead name". Rewrite before D19 references can pass.
- **Buff roster**: deferred. `skills.json` buff count is 0; 11 unique buff names still referenced by tree nodes are waived in `tree.json` `pending_refs`. When buffs are designed, add them to `skills.json` and the refs resolve.
- **`combat.md` / `checks.md` derived combat numbers** are hand-carried and stale; owned by D1.
- `tools/ladder.js` and `tools/timeline.js` now generate D20/E11 and the world.md XP table — those rows are current.

## 7. Gotchas

- `decisions.md` is excluded from lint L7 (it is a historical log).
- `tree.js` T5 distinguishes waived pending refs (`tree.json` `pending_refs`) from new breakage — a rename not recorded in `skills.json` `renames` will FAIL.
- The wiki `serve` router and write API are generic over `state.data` keys; if a new data file is added, register it in `tools/lib/state.js` `DATA_FILES`, `tools/lib/registry.js` specs, and (if it has writers) `tools/lib/store.js` `WRITERS`/`VERIFY`.
- `.githooks/pre-commit` calls `verify.js`; enable with `git config core.hooksPath .githooks` (not enabled by default).
- `wiki/` and `dashboard.html` are generated views; `wiki/` is gitignored, `dashboard.html` is not.

## 8. File map (root)

Indexes: `AGENT.md` · `concept.md` · `decisions.md` · `checks.md` · `formula.md` · `skill-pool.md` · `skill-tree.md` · `equipment-slot.md` · `towns.md`.
Details: `formula-*.md` · `skill-pool-*.md` · `skill-tree-*.md` · `equipment-slot-*.md` · `towns-*.md`.
Data: `tools/data/*.json`. Cages: `tools/*.js`. Shared: `tools/lib/*.js`.
