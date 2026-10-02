# Decisions

Append-only log of design rulings that were actually applied. A patch that changes the
specs is recorded here with a status so its rationale survives after the patch file is
deleted. Newest first.

| id | status | decision | lands in |
|---|---|---|---|
| D-009 | applied | Gap pass: mob sheet + survival model · buff deferred · aura rulings · identity · crafting · loot · small gaps (see the section below) | multiple |
| D-008 | applied | Wiki editor + serve generalized to every data file (skills · tree included), not just engine/town | `tools/wiki.js` · `tools/lib/store.js` · `tools/lib/pages.js` |
| D-007 | applied | Skill workshop (live calculator) + `eff cd` / `presses/sec` columns in the attack table | `tools/lib/skillmodel.js` · `tools/skills.js --calc` · `tools/report.js` · `skill-pool-attack.md` |
| D-006 | applied | No 45% reservation Cap: the player manages the aura set; the only rule is total reserved mana may not reach 100% of the pool | `skill-pool-aura-heal.md` · `skill-pool.md` · `concept.md` · `skills.json` |
| D-005 | applied | Tree wiring is rename-proof: `skills.json` `renames` + `tree.js --write` updates node `Enables` cells; L7 broadened to all docs | `tools/tree.js` · `tools/data/skills.json` · `tools/lint.js` |
| D-004 | applied | Prose may not restate a generated value; L7 value-drift guard added and roster prose swept clean | `tools/lint.js` · `skill-pool-aura-heal.md` · `skill-pool.md` · `AGENT.md` |
| D-003 | applied | Normalization: skill/tree data → JSON, generated tables, id/ref linter | `tools/data/skills.json` · `tools/data/tree.json` · `tools/skills.js` · `tools/tree.js` · `tools/lint.js` · `tools/verify.js` |
| D-002 | applied | Aura roster 6 → 12; the old 6 are replaced, not extended | `skill-pool-aura-heal.md` · `skill-pool.md` · `checks.md` D18 |
| D-001 | applied | Aura cost model: reservation replaces drain | `skill-pool-aura-heal.md` · `skill-pool.md` · `skill-pool-system.md` |

## D-003 — Normalization infrastructure (applied)

**Problem** — a single roster change (aura 6 → 12) required hand-editing ~10 files, because
counts, names and cross-file references were typed as prose. The `patch/` file had to be
deleted after use, losing its rationale.

**Ruling** — extend the existing "data file → cage → generated block" pattern to the
roster and the tree wiring:

- `tools/data/skills.json` is the roster source of truth. Counts, names, reserves and
  effects are derived; no skill count is hand-typed.
- `tools/skills.js --write` regenerates the roster tables in `skill-pool*.md`; `--checks`
  runs the D18 mechanic gate.
- `tools/data/tree.json` owns branch/limb shape + the 18 keystones. `tools/tree.js` parses
  the 122 minor node tables, validates every `Enables` cell against the roster, and
  regenerates the summary in `skill-tree.md`. Known-pending refs are waived in
  `tree.json` `pending_refs`, so a *new* dangling ref fails but the tracked backlog does not.
- `tools/lint.js` is the referential guard: imports, markdown file references and line
  citations, deprecated terms, heading counts, marker balance.
- `tools/verify.js` runs every cage + the linter; `.githooks/pre-commit` calls it.

**Rule for future edits** — change the data file, run the writer, run `node tools/verify.js`.
A number or a name appears in exactly one non-generated place.

## D-009 — Gap pass (applied)

Answers collected one by one; items marked *(delegated)* were chosen by the agent on the user's instruction "เอาตามคุณ".

| # | decision | choice |
|---|---|---|
| D1 | Mob sheet + defense layer | **A** — define mob accuracy/evasion + `K_ARMOUR`/`K_EVASION`/`K_ENERGY_SHIELD` + mod ranges, then build `tools/survival.js` and rerun |
| D2 | Buff roster | **Deferred** — buff stays 0, marked planned; the 23 tree refs stay waived PENDING until buffs are designed |
| 3a | Rimbo Form vs chill Cap | **B** — Rimbo stacks with chill; mob aspd may reach −35%. `elements.md` Cap 20 governs chill alone |
| 3b | Trinity / Elemental Fury | *(delegated)* aura grants Elemental resistance **%** into the same `elem_res_pct_x` pool as gear; no new flat stat, formula unchanged |
| 3c | Grace / perfect dodge | *(delegated)* perfect dodge deletes the hit outright on trigger and is not opposed; Cap 5 stays, so Grace keeps **Dodge flat only** (perfect-dodge half dropped) |
| 3d | Heralds | **A** — fire / cold / lightning only |
| 4a | Fast hit | *(delegated)* **A** — keep as a hit-count build (procs, DoT ticks, Riposte boss path); numeric rebalance rides on D1 |
| 4b | Elements | *(delegated)* **A** — keep the gate (+21% per hit); not a full damage path |
| 5a | Quality Stone curve | *(delegated)* **tiered** — steps +1..+5 cost 1/2/3/4/5 stones · +6..+10 cost 7/9/11/13/15 |
| 5b | Per-item craft ceiling | **B** — no ceiling |
| 5c | Third-Rarity Unique Base | **B** — uniqueness cut; no special Base |
| 6a | F9 / F10 / F13 | *(delegated)* set from the existing flow (F9 from elite/boss kills, F10 = 1 Add + 8 tier per Ascend, F13 from kill rate) |
| 6b | Base bias | *(delegated)* keep pending until a keep-rate re-sim exists; no numbers typed |
| 6c | Collector without filter | *(delegated)* **A** — a set can be completed without opening the loot filter |
| 7a | Melee range | *(delegated)* **A** — 3 mobs count as "nearby" |
| 7b | Monster unique skills | *(delegated)* **A** — late-zone bosses gain 1-2 signature skills; normal/elite stay innate-Element only |
| 7c | Achievements | **B** — not built |

## D-008 — Wiki generalized to every data file (applied)

**Problem** — the wiki's `serve` routing, the write API key resolution, and the store's writer/verify tables were hardcoded to `engine` / `town`, so the new `skills.json` / `tree.json` collections 404'd in the live editor (the static build worked).

**Ruling** — make them data-file-generic: `rec-*` / `data-*` routes accept any `state.data` key; the write API reads the key from `st.DATA_FILES`; `store.js` gained `skills` / `tree` writers and verifies with every cage + lint; snapshots now cover the skill/tree generated files so a rollback is clean. Verified live: a `skills` write ran `skills.js --write` + `tree.js --write` + all cages + lint and kept the result.

## D-007 — Skill workshop and rate columns (applied)

**Ruling** — one shared model (`tools/lib/skillmodel.js`) computes per-press damage, effective cooldown, presses/sec and mana/sec from the skill data + `meta.formula` constants. It powers three views:

- `node tools/skills.js --calc [--stat N --power N --level N --cdr N --ladder N]`
- the live "Skill workshop" section in `dashboard.html` (`node tools/report.js`)
- the `eff cd` / `presses/sec` columns of the generated attack table, at `meta.formula.cast_reference` (default CDR 50 · ladder 30)

**Not done (deliberate)** — the published `damage` columns stay hand-carried; deriving them from the model is a separate decision (it would move published numbers and force a D15/D17 rerun). D-004 still forbids restating a value in prose.

## D-006 — No reservation Cap; the player manages the set (applied)

**Problem** — the 45% Cap was a system limit that decided how many auras could run, which took the choice away from the player.

**Ruling** — drop the Cap. The player opens and closes auras directly. The only system rule is a block: total reserved mana may not reach 100% of the pool, so some mana always stays usable for skills. `skills.json` `meta.reservation.max_pct` records the 100% block. With all 12 auras summing to 110% (3×8 + 4×11 + 3×14), the full set can never run and the player must choose.

**Removed** — the automatic top-down opening, the "auras open at once = 3-5" note, and the cheapest/heaviest legal-combination lines (all Cap-based).

## D-005 — Tree wiring is rename-proof (applied)

**Problem** — node `Enables` cells referenced skills by display name, so renaming a skill left stale names in `skill-tree-*.md` that only a human could fix.

**Ruling** — a rename is recorded once in `skills.json` `renames` (`"Old Name": "New Name"`). `tools/tree.js --checks` reports the affected cells as PENDING; `--write` rewrites them automatically. The node prose stays in the md (readable); the link lives in data. Verified: renaming `Frost Nova` flagged 2 cells, `--write` updated them, no md hand-edit.

**Also** — L7 (value drift) now covers every doc except `decisions.md`.

## D-004 — Prose must not restate a generated value (applied)

**Problem** — the JSON owned the roster, but prose still quoted the same values. Demonstrated: changing `Wraith of Fury` from `aspd +12%` to `+15%` in `skills.json` updated the generated table while the sizing bullet still read `+12%`, and `verify` passed — a silent drift.

**Ruling** — the generated table is the only place a skill/aura's own value appears. Text explains *why* and refers to the row. `tools/lint.js` L7 enforces it in `skill-pool*.md`: a line naming a skill/aura may not quote a signed percentage its data does not contain. The roster prose was swept clean (sizing bullets, blockers, the Cleave example).

**Still open** — the same pattern exists in `combat.md` / `checks.md` (derived combat numbers) and `decisions.md` (historical values). Those sit outside L7's scope by design: the first two are owned by the pending `tools/survival.js` rerun, the last is a log.

## D-002 — Aura roster 6 → 12 (applied)

The 12 new auras replace the old 6. `Clarity` and `Grace` keep their names with new effects.
The old Clarity role (*skill mana cost −10%*) is **dropped, not moved**. Skill count moves
51 → 43 against the current roster (buff 0): attack 18 · buff 0 · curse 10 · heal 3 · aura 12.
Reserve tiers: cheap 8% (388) · mid 11% (533) · heavy 14% (679). No cap — see D-006.

## D-001 — Reservation replaces drain (applied)

Auras reserve a % of Max Mana permanently instead of draining per second. The "mana ≥ 25%"
open rule and the Automatic on/off switch are deleted. Regen fills only the usable pool.
`Max Mana %` flips from aura-hostile to aura-friendly.

## Open blockers (not yet decided)

| id | question |
|---|---|
| B-1 | `Iron Guard` / `Energy Guard` reserve is TBD until `K_ARMOUR` / `K_ENERGY_SHIELD` land. Iron Guard's target is stated (10% mitigation vs an on-level boss = 731 armour); the flat lands with the K value. |
| B-2 | `Rimbo Form` −15% must share the chill Cap 20 with chill, not stack (else −35%). |
| B-3 | `Trinity Form` / `Elemental Fury`: keep the `res_x` multiplier (honest but weak vs gear) or make it a flat add (needs a ruling). |
| B-4 | `Grace`'s perfect-dodge half is dropped; the Cap 5 is reached at Lck 500, so it buys nothing for the builds that want it. |
| B-5 | Heralds cover fire/cold/lightning only — poison and chaos get no dedicated aura (decision, not omission). |
| B-6 | Tree: 23 `Enables` cells still name the cleared buff set; the 7-node Aura Economy limb needs a rewrite (D19). |
