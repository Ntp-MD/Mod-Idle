# ModWorld — audit & repair brief

An end-to-end audit of the playable game that ends in fixes, not a list. The audit's real product is
**agreement between the layers that claim to share one source of truth** — and the regression probe that
keeps them agreeing.

Read `AGENTS.md` first. Read `doc/glossary.md` before touching a game term. Read only the
`DECISIONS.md` sections the audited system needs. Keep `doc/todo.md` current if it exists.

Status vocabulary used throughout: **confirmed** (reproduced) · **fixed** · **blocked** (a named ruling
or missing decision stops the fix) · **unconfirmed** (could not reproduce — never change code for it) ·
**out-of-scope** (real, but belongs to another workstream).

---

## 0. Mission

1. Reproduce a defect from the data through the engine, the runtime, the save file, the UI readout and the
   wiki sentence — then fix it **at the layer that owns the rule**.
2. Prove the fix with a probe that fails before and passes after, at the level the player observes
   (not an isolated unit test when the behavior spans layers).
3. Leave data, engine, sim, save, UI, gates, tests, prose and the generated wiki consistent in one change.
4. Close or explicitly block every confirmed finding. Do not stop at a findings list.

---

## 1. Non-negotiables

- Preserve the working tree. **Do not** reset, checkout, stash, clean, rewrite history, or commit
  (AGENTS.md: never commit unless asked).
- Another workstream may hold files open. Edit **only** what the fix needs, **never** reformat, reorder or
  restructure a file you are not fixing, and never revert someone else's in-flight change to make a probe
  pass. Read the current source before asserting a signature — symbols move.
- `tools/data/*.json` is the only home of a gameplay number. `engine/` and `game/src/` hold no literal
  balance value.
- `wiki/` is generated output: rebuild it (`npm run wiki`), never hand-edit it.
- Do not change a value because it looks odd. Name the rule, name its source, reproduce the failure, then
  change the owner of the rule.
- Ask first (AGENTS.md boundaries): new dependency · file/key rename · save-format change · shared size
  token · overriding an explicit owner ruling.
- No speculative rebalance, no redesign of a system that is not part of the finding.

---

## 2. Ground truth map

`AGENTS.md` owns where things live, which file owns which numbers, and the command list. **Do not sync a
copy of its table by hand** — this section carries only what an auditor needs and AGENTS does not: the
symbols to trace, one row per layer. If AGENTS moves, AGENTS wins.

| Layer | Home | Symbols to trace |
|---|---|---|
| Maths | `engine/` | `index.ts`: `createEngine` · `statAt` · `physOf`/`magicOf`/`weaponMult` · `sizeMultOf`+`applySizeMult` · `critPool`→`critChanceOf`→`critDmgOf` · `capAspd` · `evasionChance` · `blockChance` · `armourPenCut` · `mobResCut` · `stunChanceFrom` · `bleedChanceFrom` · `mobHpAt`/`spawnAt`/`mobRoster` · `dropChance` · `floorLevelOf` ‖ `loot.ts`: `createLoot` · `leanReweight` · frame/line roll |
| Client seam | `game/src/engine/client.ts` | `eng` · `E` · `BASES` · `WEAPON_BY_NAME` — the client's read of the same JSON + engine |
| Runtime | `game/src/sim/` | `player.ts`: `buildCharacter` · `openingGear` · `gearModOf` ‖ `game.ts`: `newGame` · `tick` · `catchUp` · `catchUpPlan` · `spawnMob` · `adjudicateDrop` · `huntZone` ‖ `drop.ts`: `rollDrop` ‖ `filter.ts` · `gear.ts` (`autoEquip`) · `slots.ts` · `skills.ts` · `craft.ts` · `fieldwork.ts` · `farm.ts` · `town.ts` · `collector.ts` · `curse.ts` · `mobStatus.ts` · `road.ts` · `mastery.ts` · `presets.ts` · `respec.ts` |
| Save | `game/src/state/save.ts` | `SCHEMA_VERSION` (14) · `migrate` · `newAccount` · `mergeMastery`/`applyAccount` · `listSnapshots`/`restoreSnapshot` · settings |
| Cages | `tools/` | `verify.ts` runs the five cages in `lib/writers.ts` (`CAGES`); `lib/engine.ts` is the cage bridge. A gate prints its own meaning on its own line: **the run is the documentation**. |

The prose home is `game/src/wiki/pages.ts` (an output built into `wiki/` by `tools/wiki.ts build`), and the
test roster is Appendix B.

---

## 3. Baseline, then commands

**Before any edit**, record the pre-existing state: run every cage, the suite, both typechecks. A failure
present before your first edit is baseline, not your regression.

AGENTS.md owns the command table and prints it with placeholders; the block below spells the same commands
out for this run (a renamed script moves in AGENTS.md first — do not let the two drift).

```
npm run verify                 # every cage in one run (engine · skills · loot · bases · imprint)
npm run test                   # game test suite
npm run typecheck              # root tsc (engine + tools)
npm run check                  # root tsc + svelte-check (game)
npm run wiki                   # rebuild wiki/ (only when data/engine/wiki source moved)
npm run gallery                # only if art shelves moved
```

Per cage, when isolating: `node tools/check.ts --checks|--sync` · `node tools/loot.ts --checks|--bias` ·
`node tools/bases.ts --checks|--write` · `node tools/skills.ts --checks` · `node tools/tree.ts` ·
`node tools/imprint.ts --checks`.

Browser checks: reuse a running dev server if one is up (check the port before starting a second). The wiki
hosts both the live pages (`wiki.html#<page>`) and the game; state in the report which host you exercised.

Baseline numbers belong in the report: gate count, test count, the pre-existing FAIL/`watch` lines.

---

## 4. The relationship audit (the core of this brief)

Every number and rule has **one home** and **many readers**. A defect is usually a reader that drifted:
it re-derives, rounds differently, reads the wrong block, or was never wired up. Audit the *edges*, not
just the features. For each contract below: state the invariant, find the readers, probe the invariant,
and record the verdict in §7.

### A. One home per number

- Invariant: no balance value is typed in `engine/` or `game/src/`; each number is read from
  `tools/data/*.json`; derived anchors that are *published* (e.g. the hit-chance anchor) are re-published
  by the cage (`node tools/check.ts --sync`) rather than hand-edited.
- Probe: for each number a finding touches, grep its literal in `engine/` and `game/src/`; confirm zero
  hits outside `tools/data/`, and confirm the gate that pins it (`X15` mod maxima, `X16` drop pins, and the
  family the owning cage prints).
- Failure mode: a second copy that passes today because the two happen to agree.

### B. One engine, every reader

- Invariant: the client and the cages resolve to the **same** `engine/index.ts` over the **same** JSON
  (through `game/src/engine/client.ts` and `tools/lib/engine.ts`).
- Probe: `game/tests/engine-agreement.test.ts` already compares derived ceilings, bands, `mobHpAt`,
  `xpToNext`, `aspdOf` across the two bridges. Extend it for any line the finding touches (one row per
  derived figure), rather than testing the client in isolation.
- Failure mode: the client re-implements a formula "just for the sheet".

### C. Twin implementations must agree

Two modules computing the same thing for two callers. Each twin is a defect waiting to happen; the audit
pins the equality with one probe per pair.

| Twin | Agreement to pin |
|---|---|
| `game/src/sim/drop.ts` `rollDrop` ⟷ `tools/loot.ts` roll | same seed + band + ilvl ⇒ the same item: same slot, frame, level, lines, values |
| `game/src/sim/filter.ts` score ⟷ `tools/loot.ts` keep-rate sim | the same margin and the same keep decision on a shared fixture set |
| `game/src/sim/gear.ts` `autoEquip` ⟷ the filter's comparison | one score, one comparison cell (ring ×2 cells, empty cell), one refusal sentence |
| `game/src/sim/item-name.ts` frame lookup ⟷ `bases.json weapon_frames` | a rolled `frame_mod` resolves to exactly one named frame (first-match risk) |
| engine skill-model ⟷ `tools/lib/skillmodel.ts` | same row ⇒ same damage, cost, cooldown, AoE multiplier |
| engine mastery/loot bonus ⟷ `tools/lib/roster.ts` readers | same multipliers, same caps |
| `engine/index.ts` weapon damage multiplier ⟷ `bases.json weapons[].weapon_mult` / `engine.json weapons` | one home for the type's multiplier; nothing derives it twice (current flashpoint) |
| `engine/index.ts` `sizeMultOf` ladder ⟷ `bases.json weapons[].size_mult` | same three columns (`tools/check.ts` compares them) |
| `game/src/sim/road.ts` cell/site reading ⟷ `game/src/ui/map.ts` | the same cell resolves to the same sub-zone/wild site (index-based, so ordering is a contract) |

Probe shape: a fixture + a fixed seed, asserting equality of the observable output, not of the internals.

### D. Pairing and ordering inside the engine

A rule applied in the wrong order, or half-applied, is invisible to a unit test of either half.

| Pair / order | What must hold |
|---|---|
| `sizeMultOf` + `applySizeMult` | one multiplier on the **physical share**, applied **after** mitigation, never on the armour cut; skill presses carry it too; a magic-damage press is exempt |
| `critPool` → `critChanceOf` → `critDmgOf` | one pool; chance capped; **only the overflow** past the cap buys crit damage; no double count |
| `capAspd` | binds **last** — after the Agi term, the aspd Mod band, multiplicative buffs and the weight tax; the cap is a minimum interval |
| `mobArmourCut` / `mobResCut` / `armourPenCut` | each clamps to `[0,1]`; over-penetration is wasted, never an amplifier; the res cut is compared against the correct Element |
| `evasionChance` + `caps.evasion` | the opening/earned split, then the opposed roll, then the cap |
| `hitVs` default vs build value | the published anchor uses the max Accuracy % Mod; the game passes its own — the two must be named apart |
| `resistanceOf` + cap bonus | `elem_res` ceiling 75, tree node raises toward 90, clamps at the absolute ceiling however stacked |
| Damage → ES → HP routing | a hit and burn spend ES first; poison and bleed DoT reach HP directly; shield overflow lands on HP once; ES absorb is not a second shield |
| `leanReweight` | redistributes **mass** across gear/herb/junk: total expected drops/kill is unchanged (drops/hr and the timeline do not move) |
| Junk rarity → gold | rarity buys frequency, not income: chance × sell is flat |

### E. Reader and dead-key sweep

Procedure, per data block in `tools/data/`:

1. List the keys. 2. `grep` each key through `engine/`, `game/src/`, `tools/`. 3. Classify:
   **live** (read at runtime) · **presentation** (cited as such) · **display-only** (read for a readout) ·
   **dead** (no reader). 4. For each live key, name the gate that pins it — a live key with no gate is a
   cage gap, and a gate with no live key is a stale gate.

Record the classification in §7. Current flashpoints to settle in this sweep (re-verify first — see
Appendix C): `mob.species[].habitat`,
`subzones[].environment`, `subzones[].element`, `map.json` (terrain/regions/wild kind), `carries_weapon`,
`weapon_pools` vs `frame_mod.weapons`, `frame.weight`, `power_base`.

### F. Save ⇄ runtime ⇄ offline parity

- Round-trip: save → load → save produces no semantic drift (`save-fidelity`), and a reload mid-fight
  grants no double credit.
- Offline: `catchUp` vs the same span ticked online is deterministic for zone floor, boss clock, drops,
  skill XP, Hunger — differences must be the *documented* AFK exceptions only.
- Migration: an older save loads, is reinterpreted only where the rule allows, loses no item/point/skill,
  and is rejected rather than silently corrupted when the version is unknown.
- Orphans: an active toggle/buff/aura that is no longer owned is cleaned **without** touching legitimately
  enabled skills, and without a schema change.

### G. Sheet, UI and wiki against the rule

- Every figure on the character sheet must equal the value the tick loop uses (same engine call), not a
  parallel calculation; a cap is printed as the cap that binds.
- Every wiki sentence that states a rule must match the implemented rule, and data read live must be
  rebuilt (`npm run wiki`). A rebuild refreshes data reads — **not** the hand-written sentences.
- A UI refusal ("not an upgrade", "cannot equip", "aura reserved") must name the true cause.

### H. HUD layout (only if the finding touches HUD)

One `HudLayout` links the Studio and the live HUD: every movable region has a `HudRegionId`, appears in
`HUD_REGION_META` and `DEFAULT_HUD_LAYOUT`, is positionable in the Studio, and reads the same values in
`App.svelte`. A new region fills from its default when an older saved layout loads; verify applying it in
the Studio moves the live region. Sizing follows `game/src/styles/variables.css` (semantic tokens only, no
`--ui-scale`, no unbounded viewport ramps — AGENTS.md "Sizing").

### I. RNG stream discipline

The measured rates (`drop/hr`, stones/hr, junk gold/kill) are only meaningful if the random stream is
reproducible. `newGame(seed)` persists `seed` and `rngState` (`game/src/sim/game.ts`), and the tick draws
through `mulberry32(s.rngState++)`.

- Invariant: every gameplay draw comes from the seeded stream. Probe: `grep -n "Math.random" engine/ game/src/`
  must return nothing on a gameplay path (a UI-only cosmetic use must be named as such).
- Invariant: the **order** of draws inside a tick is frozen. Adding, removing or reordering one draw shifts
  every later draw, so all published rates move without a data edit. Probe: a golden-sequence test — fixed
  seed, N ticks, snapshot the roll sequence; any diff must be an intentional, stated change.
- Invariant: a save restores the stream (reload mid-hunt resumes the same sequence; offline `catchUp` from
  the saved `rngState` reproduces the same span).
- Adjacent: which draws are allowed to change (cosmetic rolls) versus which are pinned (loot, stones, junk,
  status application).

### J. Time, loop integrity and exploit surfaces

An idle game's sharpest edge: the clock and the reload. `clock.test.ts` already pins the three clock callers
(live scheduler · `catchUp` · `catchUpAsync`) to byte-identical states — extend from there.

- Clock is not trusted input: system clock moved forward/back, timezone or DST change, tab suspended and
  resumed, long sleep. Offline accrual needs its cap; a backward jump must not refund or replay.
- No double credit: reload during a tick, `restoreSnapshot` then continue, hidden→visible, dungeon escrow
  payout on the last mob, a Push mid-run, a boss clock across a reload. Probe: replay the same span by all
  three paths and by save→load→continue; the states must match.
- Exploit surfaces to attack by hand (each is a probe, not a code read): toggle an aura/buff to dodge its
  reservation cost, a HP-cost press at 1 HP, respec or preset switching to bypass the reservation limit,
  filter-rule spam, entering and leaving a dungeon to farm escrow, waypoint/travel gold rounding, selling
  with a full bag, salvage and re-craft loops.
- Each refusal or clamp must be the documented rule, not an accident of ordering.
- Scope: a hand probe counts only once it names its seed/fixture **and** lands as a test in the audit's own
  file. A probe that cannot be made reproducible is an **unconfirmed** finding, not a fix.

### K. Numeric hygiene

- Display versus truth: the formatters (`r1`/`r2`/`fmt`, `sheetFixture.ts`) must round only for the readout.
  Any comparison (upgrade margin, threshold, cap) reads the raw value. Probe: a value that prints as equal
  must not decide an equality branch.
- Accumulated drift: a long soak of many small adds (regen, junk stacks, gold) must not diverge from the
  closed-form expectation; `soak.test.ts` proves finiteness — add the numeric identity where a finding
  touches it.
- Degenerate inputs: zero/negative divisors (armour cut with `raw = 0`), `NaN`/`Infinity`/negative zero,
  overflow at max level with a full build, exact-threshold comparisons (`>=` vs `>`), and off-by-one at a
  Cap boundary.
- Every Cap must be provably binding or provably not (the `X11` shape: a target Cap must be reachable, a
  hard ceiling must not be).
- Scope: bind the drift hunt and the degenerate-input pass to the value the finding touches. A soak-long
  hunt is not a finding unless a rule states the closed-form expectation to compare against.

### L. Storage, platform and session robustness

`save.ts`: IndexedDB with a synchronous localStorage mirror, three slots, export/import, snapshots,
`SCHEMA_VERSION` with an import rejection on mismatch.

- Quota exceeded (the current code drops the mirror — confirm the DB copy survives), private mode, storage
  disabled, DB blocked by another open tab, corrupt/partial JSON, a truncated mirror read on
  `beforeunload`.
- **Two tabs on one slot**: no cross-tab lock is visible in the code — verify what a second writer does to
  the first, and to the mirror.
- Snapshot growth: confirm snapshots rotate or are capped, so a long session cannot grow the save without
  bound.
- Export → import round-trip is semantically identical (item by item, point by point, clock included).
- Platform: the game and the wiki must both work from `http` and from `file://` (the owner opens the wiki
  from disk); a suspended/backgrounded mobile tab returning no later than the offline path allows.

### M. Economy conservation

Every faucet and sink lives in `tools/data/` and is measured in expectations, so conservation is testable.

- Per hour and per band: gold, junk, stones and craft currency in = out within the published tolerance
  (`loot.kill_rate_tolerance`), with no band where a player can loop a sink back into a faucet
  (buy→craft→sell, salvage→re-craft, escrow enter/leave).
- Every payout calls the engine function, never a copied formula or a literal price.
- Junk rarity buys frequency, not income (`X39` shape); `leanReweight` conserves expected drops/kill. Any
  new bias or gate added by a fix must keep those two identities.

### N. Performance and long sessions

- Tick cost at the level Cap with a full bag, a full stash and every toggle on; the offline path's slicing
  (`catchUpPlan`, `schedulerBatch`, `MAX_BATCH`) must not change any number while keeping first paint alive.
- Save cost: the deep copy per write and per snapshot at a large state; a save must not stall the tick.
- DOM cost only where the audit touches UI: long lists (stash, wiki icon grid), and the repaint path that
  rewrites a subtree and re-injects a script (`game/src/wiki/main.ts`) — confirm repeated paints do not
  accumulate listeners or nodes.
- `soak.test.ts` is the long-walk harness: extend it for the invariant a performance finding actually
  breaks (a stalled batch, a growing pile, a leaked list).
- Scope: the data holds no timing budget, so this section only becomes actionable once a baseline is
  measured (ticks/sec at the Cap with a full bag, save cost at a large state). Hold that number across the
  audit, or leave the section unused — an unfalsifiable performance item is noise.

### O. Gate meta-audit (do the gates actually bite?)

A gate that cannot fail is decoration, and this repository's correctness claim rests on its cages.

- For every gate named in §7, break its invariant in a scratch copy (edit the value in `tools/data/`, or the
  engine expression) and confirm the gate goes **red**, then restore. Record the ones that stayed green.
- Hunt the stale-figure trap: a gate comparing a stored copy against itself (both sides read the same
  source) proves nothing — the sync path (`node tools/check.ts --sync`) must be the only writer of a
  published anchor.
- Pair the sweep in §4E with the gate list: a live key with no gate is a cage gap; a gate whose subject is
  dead data is a stale gate.
- Scope: only the gates the ledger names. A sweep of every gate is not the job (the engine cage alone
  carries 45 of them).

### P. Doc and ruling drift census

- Every `DECISIONS.md` line that states a rule has a live reader in `engine/` or `game/src/`; the lines with
  none are either retired or unimplemented — say which.
- Every owner ruling (the `*_note` / `base_bias` / `player_only` style blocks, and the AGENTS.md boundaries)
  has a gate or an in-code comment marking it, so a later change cannot quietly reverse it.
- `aliases.json` retired terms have no stale usage in code or in `pages.ts` prose.
- Every rule sentence printed to the player in `pages.ts` can be grepped back to the implementing site.
- Scope: a ruling with no gate is **not** automatically a defect — record it as a prose-only ruling. A
  finding is a ruling that a change silently reversed.

### Q. Test hygiene and negative paths

- Tests are deterministic: fixed seeds, no wall-clock or timezone dependence, no ordering dependence between
  files, no network.
- Every refusal path the audit touches has a test (filter declines, aura over the limit is refused, equip
  refused, bag full, Broken gear, dungeon Push forfeits) — the positive path alone hides the interesting
  half. Not every refusal in the game; the ones a finding moves.
- A test asserting one layer does not clear a flow: the probe for a cross-layer finding belongs in
  `engine-agreement` (bridges), `save-fidelity` (persistence) or the audit's own file.
- New probes go into `audit-follow.test.ts` / `audit-regressions.test.ts` unless a better-owned file exists.

---

## 5. Flow audits

For each flow: **trace it end to end with function names**, then probe. A green unit test over one function
does not clear a flow.

1. **Character & equipment state** — Mod lines → `buildCharacter` → combat read → sheet. Nothing worn-less
   may contribute (bag, stash, escrow). Check Max HP/Mana/ES, regeneration, resistance, Evasion, Accuracy,
   aspd, weight, capacity and caps across equip / replace / remove / break / repair / restore; current pools
   clamp after a max change without granting or deleting anything else.
2. **Drops, filter, Auto Equip, Collector** — one real drop through roll → Collector → filter → capacity →
   Auto Equip → displaced gear → overflow. Both ring cells, one empty cell, a bag item never the baseline,
   real low-band drops (not hand-authored fixtures), locked/Broken pieces, `equipMargin`, full bag, dungeon
   escrow, offline drops, already-reserved pieces. One score across readout, filter and Auto Equip; refusals
   explained.
3. **Skills, buffs, auras, ownership** — first copy has **zero** duplicates: hunt truthiness checks.
   Fresh vs duplicate, slot insertion, skill XP, cooldown ladder, level effects. A new drop must not
   self-activate. Only owned skills may reserve, apply, recast or appear in the HUD. Expiry, auto-recast,
   disable, reservation limit, save/load and import. Orphan cleanup per §4F.
4. **Combat and recovery** — incoming hit through perfect dodge → Evasion → block → Armour →
   resistance → damage-taken → ES → HP (§4D ordering). Shield overflow including ES absorb and a partly
   filled shield. Status application/duration/DoT caps, stun/shock timing, recharge delay, regen, Hunger,
   healing, leech, Push, Camp. Sheet values equal tick values.
5. **Progression and persistence** — level-up, allocation, respec, tree, Mastery, presets, craft, fieldwork,
   food/Hunger, potions, farming, dungeon ↔ combat and save interactions; §4F parity and migration.
6. **Player-facing consistency** — §4G. Rebuild the wiki, and fix the sentence, in the same change.

---

## 6. Defect adjudication

For each candidate:

1. **Rule** — the invariant and its home (data key, engine function, DECISIONS line, cage gate).
2. **Repro** — a deterministic probe: fixed seed, smallest possible fixture, or a named browser flow.
   A probe that cannot be written is an unconfirmed finding, and unconfirmed findings change no code.
3. **Class** — implementation bug · intended behavior (say which ruling) · stale UI readout · stale save
   data · stale prose · cage gap (a real contract with no gate).
4. **Owner** — fix where the rule lives. Compensating in the UI, or special-casing a caller, is a bug.
5. **Regression** — a test that fails before and passes after, asserting the **observable** behavior at the
   right level (`engine-agreement` for cross-bridge, `save-fidelity` for persistence, a new file for a new
   contract).
6. **Adjacent states** — the same path at band edges, empty slots, broken/uncraftable gear, max-level,
   offline, resumed-from-snapshot.
7. **Ledger** — record it in §7 and delete temporary probes when the finding closes.

---

## 7. Finding ledger

Keep this table live in this file while the audit runs. `Probe` names the test, script or flow that proves
the verdict; `Rule` cites the home.

| # | Area (A–H / flow) | Symptom | Rule + home | Class | Verdict | Probe | Files changed |
|---|---|---|---|---|---|---|---|
| 1 | | | | | | | |

Open questions that need the owner (a ruling, a saved-data decision, a size token) go here as
**blocked**, each with the specific decision being asked for. Behaviour that needs the player's call is not
a fix — it is a question.

---

## 8. Completion criteria

- Every confirmed finding is fixed, or blocked with the decision named. Nothing is left "noted".
- The relationship contracts touched by a fix each have a probe (§4), and the ledger names it.
- Every gate named in §7 has been shown to bite (mutation probe, §4O), and every live key read by a fix has
  a gate or a recorded cage gap.
- `npm run verify` (every cage), `npm run test`, `npm run typecheck`, `npm run check` pass.
- `npm run wiki` rebuilt whenever data, engine behavior, wiki source or a player-facing rule moved; the
  hand-written sentences fixed, not just the data reads.
- No new literal outside `tools/data/`; no temporary probe or generated diagnostic file left behind; the
  pre-existing working tree preserved.

---

## 9. Non-goals

Balance tuning without a rule violation · speculative redesign · new content (species, zones, items,
skills) · a save-schema change without approval · cosmetic refactors · anything in another workstream's
in-flight file.

---

## 10. Report format

Lead with the outcome. Then, per finding: **symptom** · **root cause** · **rule and its home** · **what
changed and why** · **files** · **the probe that proves it** (before → after). Finish with: exact
verification results (gate/test/typecheck counts, pre-existing warnings), unresolved or unconfirmed
findings, blocked decisions, and the contracts from §4 that you exercised versus merely read. Do not claim
a system was audited because its tests passed — say what you traced.

---

## Appendix A — cages

`npm run verify` runs, concurrently: **engine cage** (`tools/check.ts --checks`) · **skills cage** ·
**loot cage** (`tools/loot.ts --checks`, whose generated section carries the `T15` Base-bias experiment) ·
**bases cage** (`tools/bases.ts --checks`) · **imprint cage**. `tools/lib/writers.ts` owns the list.
Engine cage families seen in code: `X*`, `OP*`, `MP*`, `L*`. `--sync` re-publishes derived anchors into the
data; `tools/loot.ts --bias` and the keep-rate sim are the measurement tools behind frame weights.

## Appendix B — tests

Treat `game/tests/` as the contract registry: before adding a probe, check whether the file that should own
it exists. `sheetFixture.ts` is shared fixture code, not a test. `simModules.test.ts`, `clock.test.ts`,
`soak.test.ts` and `viewModels.test.ts` cover the tick loop and the read models; `audit-follow.test.ts` and
`audit-regressions.test.ts` are audit-owned regressions — extend them rather than editing an unrelated file.

## Appendix C — leads to confirm (reconnaissance; re-verify before acting)

Recorded **2026-10-14** against the tree as it stood then. The engine, the data and the wiki source are under
active change, and another workstream may hold them open: re-verify each lead against the current source
before acting, and delete a lead the moment this audit settles it. The doc that owns each data block's
numbers is AGENTS.md's data-file table, and `doc/DECISIONS.md` holds the surviving rules — it moves in
the same change as the code.

1. `mob.species_rules` claims a weapon-slot piece may come only from a weapon-carrying species, while the
   drop roll draws all 13 slots for every kill and `carries_weapon` is only carried onto the roster readout.
2. `map.json` `terrain` (12 words) vs `mob.zones[].subzones[].environment` (45 words) share four words;
   neither is read at runtime; `map.json` `regions` (10) does not match zone `region` (17); `cells[].wild`
   carries no site kind, so Mine/Grove/Dungeon are positional only.
3. One `weight` field on a weapon frame is read as **drop weight** by the loot roller while the wiki prints
   it as a carried-weight column.
4. ~~`item-name.ts` frame lookup risk~~ — **settled, no lead**: `tools/bases.ts` already gates frame
   identity uniqueness over `frame_mod` + `legacy_frame_mod` (`:156`) and requires a legacy identity on
   every frame (`:161`), so a duplicate cannot shadow a name silently.
5. `mob.variant_drops` leans gear·herb·junk by variant position for every species, so species identity does
   not by itself change the drop mix — confirm this is intended and gated.
6. `weapon_size_mult` rows for one-handed sword and axe are flat (`1/1/1`); the gate requires only the
   reference row to be flat — confirm the axe row is deliberate, not unfinished.
7. `subzones[].element` is described in code as flavour (a spawn wears its species' Element), while
   `mob.zones[].elements` is presented as zone content — confirm which layer owns "what you fight here".
8. `core.wis` is 0 for every species and the species gate rejects a non-zero value; confirm nothing on the
   mob path reads Wis (ES is player-only; mobs carry no skills).
9. `weaponMult` and the per-type multiplier in `bases.json`/`engine.json` are a current flashpoint: confirm
   exactly one home before touching weapon damage.
10. `town.json` `base_bias` records a closed owner ruling (ship even-weighted, `T15`) and its
    `forbidden_until_closed` list — any geographic gear-weight proposal is blocked unless the owner reopens
    it.
