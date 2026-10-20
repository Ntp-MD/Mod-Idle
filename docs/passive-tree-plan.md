# ModWorld — passive skill tree: expansion plan

Status: PLAN ONLY, NOT AUTHORIZED FOR IMPLEMENTATION. **The seven owner decisions in section 12 are approved (2026-10-20) and are now binding on this document** — the design in sections 4–11 is written to them. Phases T1–T4 can be delegated once the baseline is green. Jewels, Ascendancy and the Mastery grid are separate plans (section 14) and are deliberately excluded here.

Reviewed against the active workspace on **2026-10-20**. Another agent was editing `engine/tree.ts`, `tools/data/tree.json` and `game/tests/progression.test.ts` while this document was written (files written 16:48). Every fact in section 3 was re-verified against the workspace as it stood at 16:55; re-verify it again before acting, because that area is in flight.

[AGENTS.md](../AGENTS.md) owns workflow, commands, verification and workspace boundaries. This plan adds no approval requirements and does not override it. [docs/improvement-plan.md](improvement-plan.md) owns the general engineering work; this document owns the tree only and does not restate it.

## 1. Goal

Turn the passive tree from a three-wing ring of single-line nodes into a large, varied network in the Path-of-Exile tradition: several node kinds, nodes that grant more than one line, path-defining keystones, threshold clusters, weapon-specific sub-wings, and a board that can carry a few hundred nodes without becoming unreadable.

Out of scope for this plan: any change to a published number (mob HP curve, drop rates, XP ladder, item windows), any new item type, any new point currency that the owner has not approved, and any change to the save schema version. The tree grows; nothing else moves.

## 2. Method

### 2.1 Ground rules

1. `tools/data/tree.json` owns the tree's content and shape. `engine/tree.ts` owns the reading and the rules. `game/src/sim/tree.ts` owns the spending. `game/src/sim/player.ts` owns the sheet. No formula is written twice.
2. **Node id stability is the hard rule.** A node id in a shipped save must keep its meaning forever. Existing ids (`impact.1`…`impact.26`, `control.1`…`control.25`, `stream.1`…`stream.24`) keep their exact line and values. New nodes get new ids. A rename is a save migration and needs its own approved packet.
3. A phase that changes a published number is a failed phase. Capture the before state, diff it after.
4. One phase owns one concern. Two phases must never edit the same file; if they would, they are one phase.
5. Run the focused check first, then the broad one. Do not re-run a passing check with no relevant change behind it.
6. Stop and escalate on: a missing critical fact, a conflicting contract, an unexpected change to a published number, a failing baseline, an unsafe migration, or an owner decision this plan did not settle.

### 2.2 Verification commands

| Purpose | Command |
|---|---|
| Typecheck engine + tools | `pnpm typecheck` |
| Typecheck + svelte-check client | `pnpm check` |
| All cages | `pnpm verify` |
| Test suite | `pnpm test` |
| Wiki rebuild (the tree is displayed there) | `pnpm wiki` |
| Client build | `pnpm build` |

The tree is a UI feature, so any phase that changes the board also needs the integrated-browser check at 1920 × 1080 on `http://localhost:5173` — one visible tab, closed afterwards, Playwright attached to the running server rather than a second browser.

### 2.3 Phase rules

Each phase below carries: objective, verified context, scope, contracts, steps, acceptance criteria with proof, and stop conditions. The implementing agent inspects the local files itself, preserves unrelated changes, runs the listed verification and reports exact commands and results. A green suite is not proof of behaviour no test covers. Gate output is the run record; no transcript files are produced.

## 3. Current state — verified

### 3.1 The spec: `tools/data/tree.json`

| Key | Value |
|---|---|
| `point_cost_per_rank` | `1` |
| `shallow_nodes` | `14` |
| `rank_tiers.shallow` | `[0.0333…, 0.0666…, 0.1]` — rank 3 is a tenth of the line's `mods.json` max |
| `rank_tiers.deep` | `[0.0666…, 0.1333…, 0.2]` — rank 3 is a fifth |
| `graph` | polar layout: start at `(50, 50)`, `nodes_per_ring: 7`, radii `[15, 29, 42]`, `extra_radius: 47`, `arc_span_deg: 60`, wing angles `impact 270° / control 30° / stream 150°`, `crosslink_ranks [7, 14, 21]` |
| `branches` | `impact` 26 entries (5 weapon-specific), `control` 25 (3 weapon-specific), `stream` 24 (3 weapon-specific) — **75 nodes, 225 ranks** |

Each branch entry is `{ line, values? , name?, weapon? }`: **one** `mods.json` line per node, with either authored `values` (weapon-specific nodes) or a tier-derived value (`engine/tree.ts:80` computes `maxOf(line) × tier` and never falls or reaches zero).

**The spec's own note is stale.** `tree.json` `meta.note` still claims "21 nodes per wing and a 22nd control node… 64 nodes, 192 ranks". The arrays hold 26 + 25 + 24 = **75 nodes and 225 ranks**. The note also claims "there are no keystones" — true, but it is stated as a permanent ruling rather than a description, and this plan proposes to change it.

### 3.2 The reader: `engine/tree.ts` (128 lines)

- `readSpec(spec)` (`:54-65`) validates `rank_tiers.shallow`/`deep` are nonempty and equal-length, and that `shallow_nodes` is a whole number. Each refusal names the key at fault. *(Changed at 16:48 by the concurrent agent: the shallow boundary and rank count now read from the data instead of constants.)*
- `createTree(spec, mods)` (`:67`) derives the node list from the branch arrays: id `branch.index` (`:88`), tier from the index against `shallowNodes` (`:75`), values from `maxOf(line) × tier` (`:80`), and **geometry from the polar `graph` block** (`:81-93`).
- `needs` is the previous node in the same branch, or `['start']` for the first (`:94`); the cross-link ranks then add a ring connection between wings (`:101-108`).
- `linesOf(ranks, weaponName)` (`:111-121`) emits `{ id, value }` for every owned rank, skipping a node whose `weapon` is not the one held. **It emits exactly one line per node — a multi-line node cannot be expressed today.**
- `pointsSpent(ranks)` (`:124-125`) sums rank × cost.
- Returns `{ nodes, byId, branches, graph, cost, ranks, shallowNodes, linesOf, pointsSpent }` — no reachability helper, no attribute check, no cluster counter.

### 3.3 The spending: `game/src/sim/tree.ts` (59 lines)

- `canSpendTree(state, nodeId)` (`:23-33`): node exists → a banked point is available → the node is not already at its rank cap → the node is connected to an owned path (`needs.includes('start')` or any parent with a rank). Nothing else.
- `spendTreePoint` (`:36-43`) spends one point, one rank.
- `respecTree` (`:46-53`) is **free** and only at a settlement (`atSettlement`), per `docs/game-rules.md:8`.
- `treeLines(state)` (`:56-59`) calls `tree.linesOf(state.player.treeRanks, mainHandName)`.

### 3.4 The sheet: `game/src/sim/player.ts`

- `sumLines(gear, extra?)` (`:67`) folds the tree's lines into the **same buckets gear uses** — "a bought rank moves the same number the piece would have" (`:74-75`).
- `buildCharacter(..., treeRanks)` (`:241`) calls `tree.linesOf(treeRanks, mainHand?.base || '')`.
- `elemental_resistance_cap_pct` is **tree-exclusive**: it is skipped on the gear path (`:94-95`) and drives `resCap` (`:356-357`).
- `PCT_LINE` / `FLAT_LINE` (`:10`, and the flat table beside it) are fixed id→bucket maps. **A line id that is not in either table contributes nothing** — a new node line needs a bucket, and a *new kind of effect* (a conversion, a removal, a condition) has no bucket at all.
- The engine already implements **damage conversion** (`engine/index.ts:323-326`), fed today by the aura effect keys `damage_conversion:<element>` (`game/src/sim/player.ts:264-272`). The mechanic exists; the tree has no route into it.

### 3.5 The save: `game/src/state/save.ts`

- `state.player.treeRanks` is `Record<nodeId, rank>` (`:529` backfills `{}` for pre-tree saves).
- `treePoints` is clamped to `eng.treePointsAt(lv)` (`:679`).
- A rank on a node the tree no longer carries is dropped (`:690-692`).
- If the spent points exceed the granted points, **every rank is deleted** and the points are restored (`:694-697`). This is a nuclear rule and it must be revisited the moment a second currency exists.
- Schema version is `17` (`:44`); `migrate` rejects a non-integer or out-of-range version (`:400`).

### 3.6 The board: `game/src/ui/PassiveTreeBoard.svelte` (128 lines)

One `<svg viewBox="0 0 100 100">`, links as `<line>`, nodes as `<circle r="1.05">` coloured by wing (`.impact` / `.control` / `.stream` stroke colours), an owned marker dot, a start marker, and a detail aside showing the selected node's ranks and a Buy button. `onNodeKey` (`:31-35`) handles Enter/Space to **select** only. There is no pan, no zoom, no search, no filter, no path highlight, no node-kind shape, and the coordinates are a 0–100 box.

### 3.7 The budget

`engine.json` `stat`: `tree_points_base: 3`, `tree_points_per_level: 1`, `level_cap: 190` → **192 points at the level cap**. The tree offers **225 ranks**. The tree is already 33 ranks wider than the point budget, so the "the tree's ranks are exactly what the level cap grants" identity in `engine.json`'s `stat.note` — and "There are 64 nodes, 192 ranks" in `tree.json`'s `meta.note` — are **both already false**. The tree is already a PoE-shaped budget, and the documentation does not say so. **D8 raises the rate to two a level — 381 points — which is recorded in section 12.**

### 3.8 Documentation and verification gaps

- `engine/tree.ts:5` claims "The cage (`tools/tree.ts`) gates the same object the client spends". **That file does not exist.** The passive tree is the only major system with no cage.
- `docs/DECISIONS.md:8` — tree lines join the gear flat/percent pools; weapon-specific tree lines apply only while held. `:42` — Block comes from the Shield Frame Mod *and the passive tree*. `:94` — `mobHP` excludes passive-tree power. `docs/game-rules.md:8` — respec is free at a settlement. `:15` — mobs have no gear and no passive tree.
- `game/src/wiki/pages.ts:870-872` publishes the tree table (wing, nodes, ranks, points) and the `treePoints(L)` formula; `:179` and `:489-495` publish the node count, the cross-link ranks and the tree point budget. The wiki is generated — `pnpm wiki` only, never hand-edited.
- `game/tests/` touches the tree in ten files. The tree's spending, adjacency, refund and save fidelity are already covered.

### 3.9 What the tree cannot do today

Verified against the code above:

- More than one line per node.
- A node that costs more than one point, or a second point currency.
- An attribute requirement (Str/Dex/Int) on a node.
- A path-defining node — a keystone, a notable, a rule, a drawback.
- A threshold/cluster node ("per 10 points allocated in this wing").
- A condition ("while above 80% Max HP").
- A skill-gated node ("requires a press you own").
- A node that changes how damage is routed, except through the aura route the tree cannot reach.
- Hand-placed geometry. Positions are derived from the polar `graph` block, so the tree can only be three rings of seven per wing.
- Any number of wings beyond three. `branch_angle_deg` is a map, but `arc_span_deg` and `nodes_per_ring` are shared by every wing, so a fourth wing would overlap the others.
- Pan, zoom, search, filter, path highlight, or multi-point allocation on the board.
- A gate over the tree's own integrity.

## 4. Design targets

The PoE features below, and what each becomes in ModWorld. "New code" is the honest cost.

| PoE feature | ModWorld form | New code | Phase |
|---|---|---|---|
| Class trees | Wings become named **archetypes** (impact / control / stream stay; more are added). Every archetype is open to every character — the class choice stays the weapon and the skill, not the tree. The commitment moves into the **keystone groups**: one member per family (D1) | data only | T5 |
| Ascendancy | **Excluded from this plan** — separate plan | — | §14 |
| Keystone | A node that grants several lines **and** applies one rule from a bounded vocabulary (section 5.4) | rule engine | T3–T4 |
| Notable node | A named, single-rank node granting 2–3 lines, sized larger on the board | multi-line grant | T2–T3 |
| Small / medium / large node | Node **kinds**: `line` (3 ranks, small), `notable` (1 rank, medium), `keystone` (1 rank, large) | node kinds | T2 |
| Attribute requirement | **Dropped (D3).** No node carries an unlock condition — connectivity to an owned path is the only rule | none | — |
| Jewel socket | **Excluded from this plan** — separate plan (it is a new item type) | — | §14 |
| Threshold node | A **cluster** counts points allocated in a stated scope and grants a line per step | cluster counter | T3–T4 |
| Weapon-specific section | Already exists as `weapon` on a node; expanded into per-weapon-family sub-wings | data only | T5 |
| Skill-gated node | **Dropped (D3).** A skill requirement is an unlock condition, and D3 leaves connectivity as the only rule | none | — |
| Reservation node | A node that reserves a share of Max Mana for an aura-like bonus, using the existing reserve-tier machinery | partial | T4 |
| Curse / Omen (upside with drawback) | A keystone that grants a large upside and applies a **drawback**, expressed as the bounded `remove` rule (D4) — the character stops receiving a named line | removal rule | T3 |
| Mastery grid | **Excluded from this plan** — separate plan | — | §14 |
| Instinct point | Not a fit for this game; skipped | — | — |

## 5. Target data contract — `tree.json` v2

### 5.1 Shape

```jsonc
{
  "version": 2,
  "meta": { "note": "…" },

  // TWO CURRENCIES (D2). `tree` points come from levels exactly as today; `attainment` points come
  // from named content milestones and buy keystones only, so a keystone never competes with the
  // ordinary nodes for the same scarce point.
  "points": {
    "currencies": {
      "tree":       { "base": 3, "per_level": 1 },
      "attainment": { "base": 0, "sources": [ { "id": "boss.elite", "per": 1 } ] }
    }
  },

  // A node's COST, RANK COUNT and the currency it is paid in come from its kind.
  "node_kinds": {
    "line":     { "ranks": 3, "cost": 1, "currency": "tree" },
    "notable":  { "ranks": 1, "cost": 1, "currency": "tree" },
    "keystone": { "ranks": 1, "cost": 1, "currency": "attainment" }
  },

  // A keystone group is a one-of family (D1): the player may hold at most one member.
  "keystone_groups": [
    { "id": "impact.embers", "name": "Ember",
      "members": ["keystone.ember", "keystone.ash", "keystone.pyre"] }
  ],

  "rank_tiers": { "shallow": [ … ], "deep": [ … ] },

  // The LAYOUT is derived, not authored (D6). The data holds the topology; this block holds the
  // parameters the deterministic layout generator reads.
  "layout": {
    "algorithm": "radial-topology",
    "start": { "x": 0, "y": 0 },
    "wing_anchor_deg": { "impact": 270, "control": 30, "stream": 150 },
    "nodes_per_ring": 7, "ring_gap": 42, "arc_span_deg": 60
  },

  "nodes": [
    // A `line` node: one grant, three ranks, tier-derived values written out once and frozen.
    { "id": "impact.1", "wing": "impact", "kind": "line", "needs": ["start"],
      "grants": [ { "id": "physical_power_flat", "values": [4, 8, 12] } ] },

    // A `notable`: named, one rank, several grants, a keystone group. There is no unlock
    // condition on any node (D3) — connectivity to an owned path is the only rule.
    { "id": "notable.ember", "wing": "impact", "kind": "notable", "needs": ["impact.7"],
      "name": "Ember",
      "grants": [ { "id": "attack_damage_pct", "values": [8] },
                  { "id": "physical_power_flat", "values": [40] } ] },

    // A `keystone`: one rank, paid in attainment points, grants a line and applies one rule (D4).
    { "id": "keystone.ember", "wing": "impact", "kind": "keystone", "needs": ["notable.ember"],
      "name": "Ember", "group": "impact.embers",
      "grants": [ { "id": "physical_power", "values": [10] } ],
      "rule": { "kind": "remove", "target": "block_chance" } }
  ],

  "clusters": [
    { "id": "cluster.impact", "wing": "impact",
      "condition": { "kind": "per_points", "scope": "wing", "target": "impact", "per": 10 },
      "grants": [ { "id": "physical_power", "values": [2] } ] }
  ]
}
```

### 5.2 The rules this shape encodes

1. **Topology is authored; geometry is derived.** A node declares its parents in `needs`; the layout block's parameters drive a deterministic generator that assigns `x`/`y`. The polar `graph` block is replaced. Hand-placing hundreds of nodes is neither reviewable nor collision-free; the topology is what is actually designed.
2. **`grants` is a list.** A node grants one or more lines. The existing 75 nodes keep exactly one grant each, with the values they have today.
3. **A grant's values are authored (D5).** `{ "id": line, "values": [ … ] }` is the only form. The tier derivation (`maxOf(line) × tier`) is used once, in T1, to freeze the 75 existing nodes' current numbers into the file; after that the tree's numbers are the tree's own and no longer move when a loot line's max moves. The tier tables stay in the file because a new line node may still be drafted from them.
4. **`kind` sets cost, rank count and currency.** A `line` and a `notable` are paid in tree points; a `keystone` is paid in attainment points. A kind may be added without touching the engine, as long as it uses a currency that exists.
5. **`keystone_groups` makes a keystone family one-of (D1).** Holding a member of a group blocks the other members. The rule is the shape the loot engine already uses for the Stat Mod family (`engine/loot.ts:234` `blockedBy`).
6. **No unlock condition (D3).** A node carries no requirement. The spending layer checks connectivity and the currency and nothing else.
7. **`rule` is a bounded vocabulary**, not free-form effects (section 5.4).
8. **`clusters` carry threshold grants**, keyed by a condition over the allocation state.
9. **Node ids are stable.** The 75 existing ids keep their meaning and their values. New ids are namespaced by kind (`notable.*`, `keystone.*`, `cluster.*`) so a new family never collides with a `branch.index` id.

### 5.3 Migration from v1 to v2

The v2 file is the **same content in a new shape**, not new content. The conversion is mechanical:

- 75 branch entries → 75 `nodes` entries, id unchanged, wing unchanged, `kind: "line"`, `needs` = the parent the v1 engine derived (the previous node in the branch, plus the cross-link at ranks 7, 14 and 21), `grants` = one entry, `values` = **the values the v1 engine computes today, written out and frozen** (D5).
- The 11 weapon-specific nodes keep their `name` and `weapon` fields.
- The polar `graph` block is replaced by the `layout` block, and the layout generator replaces the derived positions.
- `meta.note` is rewritten to describe what the file actually holds (the current note is wrong).

The conversion is a one-time edit to `tools/data/tree.json`, checked by the new cage and by the tree's existing tests, which compare the derived values before and after.

### 5.4 Rule vocabulary (bounded)

A keystone's rule must be one of these. Each is a small, testable addition to the sheet, and none of them touches the mob model.

| Rule | Meaning | Sheet plumbing needed |
|---|---|---|
| `cap_unlock` | Raise a named Cap (the pattern `elemental_resistance_cap_pct` already uses) | a line id and a bucket |
| `convert` | Route a percent of one damage type into another (the mechanic already exists at `engine/index.ts:323-326`) | a route from tree lines into `damage_conversion:<element>` |
| `remove` | The character no longer receives a named line — the keystone's drawback (D4) | a removal set applied after `sumLines` |
| `conditional` | The grants apply only under a stated condition | a condition check at sheet build time |
| `reserve` | Hold back a share of Max Mana for a bonus | the existing reserve-tier machinery |

Anything not in this table is out of scope. A free-form effect engine is a different plan. **Negative values on existing lines are not part of this plan** (D4): every consumer of every line — the bag filter's score, the craft presses, the loot roll — would have to tolerate them.

## 6. Target engine API — `engine/tree.ts` v2

```ts
createTree(spec, mods) → {
  nodes: TreeNode[],            // now: kind, grants[], rule?, group?, x, y (laid out), needs[], wing
  byId, wings, cost, ranks,
  layout: { x, y, width, height },   // NEW — the derived world box the board pans over
  linesOf(ranks, weaponName) → { id, value }[],   // one entry per grant, not per node
  pointsSpent(ranks, currency) → number,
  reachableFrom(ranks) → Set<string>,            // NEW — what the next point can open
  groupOk(node, ranks) → boolean,                 // NEW — one-of keystone groups (D1)
  clusterCounters(ranks) → Record<string, number> // NEW — threshold clusters
}
```

- `linesOf` becomes multi-grant: a notable emits two lines, a keystone emits its grants plus its rule's effect.
- `reachableFrom` is what the board's "what can I buy next" highlight needs, and what the shift-allocate helper needs.
- `groupOk` needs the current ranks, so it also lives in the spending layer.
- **The layout is derived.** A deterministic generator reads the topology in `needs` and the `layout` block and assigns each node a position. The same spec must always produce the same layout, and the cage checks that no two nodes overlap. The board never computes positions itself.

## 7. The sheet — `game/src/sim/player.ts`

Multi-line grants need no change: `sumLines` already folds a list of `{ id, value }` into the buckets, and the tree already passes a list.

New node kinds need the sheet to carry effects the buckets do not have:

1. **A bucket per new line id.** Any line a node grants must be in `PCT_LINE` or `FLAT_LINE`, or it contributes nothing. The cage in section 10 must therefore check the tree's grants against the sheet's line tables, not only against `mods.json` — this is the check that would have caught a silent no-op node.
2. **A route into conversion.** The engine's conversion already exists; the tree needs to feed `damage_conversion:<element>`. Either the tree contributes to the effects bag the sheet already reads, or `sumLines` learns a conversion bucket. The plan picks one route in T4 and keeps the other out.
3. **A removal set.** A `remove` rule needs a place to say "this line no longer applies", applied after the gear and tree folds and before the stats are derived.
4. **The mob model must not move.** `docs/DECISIONS.md:94` — `mobHP` excludes passive-tree power; `docs/game-rules.md:15` — mobs have no gear and no passive tree. A rule that touches damage conversion must not change the mob curve. This is a hard acceptance criterion on every phase.

## 8. Save compatibility

- `state.player.treeRanks` keeps its shape: node id → rank. A `notable` or `keystone` with one rank fits it exactly, and `save.ts:692` already clamps a rank to the node's own rank count.
- **A node kind with a different cost needs no shape change** — the cost lives in the spec, and the spend function reads it.
- **The second currency (D2) needs one additive field**: `state.player.attainmentPoints`, backfilled to `0` beside the existing `treeRanks` backfill at `save.ts:529`. Additive, so **no schema bump** is needed and no migration is required. The attainment income is credited by the sim at the named sources in `points.currencies.attainment.sources`.
- **`save.ts:694-697` — the "spent more than granted" rule must be evaluated per currency (D2).** With one currency it stays as it is. With two, the wipe must only clear the ranks of the currency that overflowed, or a single bad allocation deletes the whole build. This is the single most dangerous line in the tree's save path and it gets a focused test in T3.
- `save.ts:690-692` — a rank on an unknown node is dropped. That is the right behaviour for a save written by a newer build, and it stays.

## 9. The board — PoE-style

The current board cannot present 300+ nodes. The target board needs:

| Capability | Why | Notes |
|---|---|---|
| Pan and zoom | A large graph does not fit a fixed viewport | a transform layer over the derived world box; the current `viewBox="0 0 100 100"` becomes a viewport, not the world |
| Node kind shapes | A keystone must not look like a line node | `small` circle, `medium` square/rounded, `large` keystone ring |
| Colour by line, tinted by wing | PoE colours by stat; the game has 40 line ids and 3 wings | the line is the primary read, the wing the secondary |
| Hover tooltip | Numbers matter on a big board | full grant list, rank values, rule text, keystone group |
| Search / filter by line | "show me every node that grants attack speed" | a filter that dims rather than removes |
| Reachable highlight | "what does my next point open" | uses `reachableFrom` |
| Path highlight | A shared path across wings | PoE's most-used affordance |
| **Shift-allocate a path** | A few hundred nodes of one-point clicking is not playable (D7) | Shift-clicking a node allocates every node on the path from the owned frontier to that node; the count it will spend is shown before the click lands |
| Keyboard navigation | Existing board already handles Enter/Space | arrow keys move between nodes, Enter buys, Escape clears the selection |
| Respec control | `respecTree` already exists and is free at a settlement | the board should say where and when it is available, and why it is disabled elsewhere |
| Currency readout | Two currencies (D2) must both be visible | tree points and attainment points, each with what they buy |

Accessibility is not optional: the current board gives each node a `role="button"`, `tabindex` and an `aria-label` describing branch, line, rank and connectivity (`:58-61`). The new board keeps that, and every added affordance has a keyboard path and a name. A node that is not yet reachable still announces itself as such rather than being hidden.

## 10. The missing cage — `tools/tree.ts`

`engine/tree.ts:5` already promises this cage. It is the tree's only structural guard, and the tree is about to grow by an order of magnitude. It must be written before the content phase, and registered in `tools/lib/writers.ts` so `pnpm verify` runs it.

Gates (structure — these FAIL):

- Every node's `needs` names a node that exists, or the start marker.
- Every node is reachable from the start. **The `needs` graph is not required to be acyclic**: the existing tree's cross-links are mutual (`engine/tree.ts:101-108` makes `impact.7` and `control.7` each require the other), and `needs` is an OR, not an AND, so a ring is intended. Reachability is the check; a cycle is not a defect.
- Every grant names a line that exists in `mods.json`.
- Every grant's line id is in the sheet's `PCT_LINE` / `FLAT_LINE` table **or** is in an explicitly listed exception set (the tree-exclusive Cap line is one).
- A grant's values never fall between ranks and never reach zero.
- A grant's values are authored numbers (D5) and sit inside the line's `mods.json` max, except where the spec says so.
- A node's kind exists in `node_kinds`; its rank count and currency match the kind; the currency exists in `points.currencies`.
- A node's `group`, if it has one, names a group in `keystone_groups`, and the node is listed in that group's members; a group has at least two members (D1).
- A `rule` uses a verb from the bounded vocabulary, and its arguments are real (a real Element, a real line, a real Cap).
- A cluster's condition is well formed and its grants are real.
- Two nodes never share an id.
- **The derived layout gives every node a position, and no two nodes overlap** (D6). The layout is deterministic: the same spec must produce the same coordinates on every run.

Watches (figures — these print PENDING and never fail, per the `tools/lib/gates.ts` contract):

- The total rank count against the point budget at the level cap, per currency.
- The number of keystones, notables and clusters — a design target, not a gate. `AGENTS.md` forbids gating roster sizes and content quotas.
- The share of nodes per wing.
- The total value the tree gives each line, against that line's budget. This is the balance watch (D9), and it is read by eye, never enforced.

The gate that would have caught the existing defect — the spec's note claiming 64 nodes while the file holds 75 — is a **watch on the note's own figures**, or simply a correction of the note.

## 11. Phases

### T0 — Baseline and the tree cage

**Objective.** Green baseline; the tree has a cage; the stale note is corrected.

**Depends on.** `docs/improvement-plan.md` P0 (the tree-configuration and wiki regressions). That work was in flight at 16:48 — confirm it landed and the suite is green before starting.

**Scope.** `tools/tree.ts` (new), `tools/lib/writers.ts`, `tools/data/tree.json` `meta.note`, `engine/tree.ts:5`.

**Steps.** Write the cage in the shape of the existing cages (`tools/lib/gates.ts` — `add` for structure, `soft`/`watch` for figures). Gate the v1 shape first, since the spec is still v1: a node's line exists, values never fall or vanish, `needs` resolves, the graph is acyclic, the branch angles are distinct, the cross-link ranks exist in every wing. Correct `meta.note` to the real figures (75 nodes, 225 ranks, 26/25/24 per wing). Register the cage in `tools/lib/writers.ts`.

**Acceptance and proof.** `pnpm verify` runs the new cage and passes. A deliberately broken node id in a **temporary copy** of `tree.json` makes the cage FAIL — never edit the real file. `pnpm typecheck` exits 0. The test count is unchanged.

**Stop and escalate if.** The baseline is not green, or the cage needs a number that the data does not own.

---

### T1 — The v2 spec, read but not yet used

**Objective.** `tree.json` carries the v2 shape and the numbers it holds today, unchanged.

**Scope.** `tools/data/tree.json`, `engine/types.ts` (the `TreeSpec` type), `engine/tree.ts` (the reader, accepting v2).

**Steps.** Convert the spec to v2: 75 nodes with explicit ids, wings, kinds, parents and grants; the rank tiers and the shallow boundary carried across; the polar `graph` block replaced by the `layout` block, and a deterministic layout generator that derives each node's position from the topology (D6). **Freeze the values (D5): write each node's current granted values into the file as authored numbers**, so the tree's numbers stop moving when a loot line's max moves. Add the `TreeSpec` v2 type.

**Acceptance and proof.** The tree's existing tests pass unchanged — they assert spending, adjacency, refunds and save fidelity. A temporary script compares the derived values of every node before and after: **identical for all 75**. The layout generator is deterministic: two runs over the same spec give the same coordinates, and no two nodes overlap. `pnpm typecheck` exits 0. `pnpm verify` passes, with the new cage still green against the v2 shape.

**Stop and escalate if.** Any node's value moves, or the layout generator produces an overlap or a different result on a second run. Those are failed phases, not details to accept.

---

### T2 — Multi-line nodes and node kinds

**Objective.** A node can grant several lines and can be a notable or a keystone.

**Scope.** `engine/tree.ts`, `game/src/sim/tree.ts`, `game/src/sim/player.ts` (only if a bucket is missing), `game/src/ui/PassiveTreeBoard.svelte` (node-kind shapes and the detail panel).

**Steps.** Extend `TreeNode` with `kind` and `grants[]`. `linesOf` emits one entry per grant. The spending layer charges a kind's cost and caps at a kind's rank count. The board draws the three kinds at three sizes and lists every grant in the detail panel. A multi-line node must sum into the same buckets — verify against `sumLines`, which already folds a list.

**Acceptance and proof.** A test that allocates a two-grant notable produces both lines on the character sheet. The existing tree tests pass unchanged. The board shows the three kinds distinctly — verified in the integrated browser at 1920 × 1080.

**Stop and escalate if.** A grant id is not in the sheet's line tables — that is a missing bucket, and it needs a decision (add the bucket, or drop the grant).

---

### T1b — Two tree points a level (D8)

**Objective.** A level-cap character holds 381 tree points instead of 192, and an existing save receives the difference.

**Scope.** `tools/data/engine.json` (`stat.tree_points_per_level` and the `stat.note` text), `game/src/state/save.ts` (the pool recompute), `game/src/wiki/pages.ts` (the published rate), `game/tests/save-fidelity.test.ts`.

**Steps.** Set `tree_points_per_level` to 2. Rewrite `stat.note` so it states the rule that is true now: the level curve grants two tree points a level, the tree is wider than the budget, and the ranks are not what the level cap grants. Replace the clamp at `save.ts:679` with a recompute of `treePointsAt(lv) - pointsSpent(ranks)`, keeping the overflow wipe at `:694-697` and the "a rank on an unknown node is dropped" rule at `:690-692` exactly as they are. Rebuild the wiki with `pnpm wiki`.

**Acceptance and proof.** A character at the level cap holds 381 banked points (`eng.treePointsAt(190)`). A save written before the change, loaded after it, has its banked pool raised to 381 minus what it spent — proven by a save-fidelity test that loads an old-shaped save and checks `banked + spent === treePointsAt(level)`. A save at a level whose budget shrank still wipes correctly. `pnpm typecheck` exits 0, `pnpm verify` passes, `pnpm test` passes, and `pnpm wiki` reproduces the page. The published anchors `build.hit_chance_pct` and `loot.ttk_per_mob_sec` are **unchanged** — that is the proof that the reference build reads no tree.

**Stop and escalate if.** Any published number moves. The reference build allocates no tree, so nothing in the published frame may change; if something does, the change is not in this phase and the phase stops.

---

### T3 — Rules, clusters, currencies and groups

**Objective.** The bounded rule vocabulary, threshold clusters, the second currency and the one-of keystone groups. There is no unlock condition on a node (D3), so the spending layer checks connectivity, the currency and the group and nothing else.

**Scope.** `engine/tree.ts`, `engine/delivery.ts` (the config type), `game/src/sim/tree.ts`, `game/src/sim/player.ts`, `game/src/sim/delivery.ts`, `game/src/sim/delivery-types.ts` (the reward shape), `game/src/sim/types.ts` (the new player field), `game/src/state/save.ts` (the attainment field and the per-currency wipe), `tools/data/tree.json`, `tools/data/town.json`.

**Steps.**

- There is no unlock condition on a node (D3). The spending layer checks connectivity, the currency and the keystone group, and nothing else.
- `rule` applies one verb from section 5.4; each verb gets one focused implementation and one focused test. The `remove` verb (D4) takes a named line away and needs a removal set applied after the gear and tree folds.
- `clusters` count allocated points in their scope and grant a line per step.
- **The second currency (D2).** `points.currencies` names the currencies; the spending layer charges a node in its kind's currency; the save carries `state.player.attainmentPoints`; and `save.ts:694-697` is rewritten to evaluate the overflow **per currency**.
- **The attainment income (D2).** `town.json.delivery` gains `attainment_chance` (0.08) and `attainment_band_weights` (`{ low: 0.5, mid: 1, high: 2 }`). The roll is made **at offer time**, **last in the documented roll order** at `game/src/sim/delivery.ts:71`, and frozen into `contract.reward.attainment` and the preview. Completion grants the point next to `grantNamedSkill` (`game/src/sim/delivery.ts:190`).
- **The one-of keystone groups (D1).** A node's `group` blocks its siblings while one of them is held — the shape `engine/loot.ts:234` already uses for the Stat Mod family. The spending layer enforces it, and the board says which sibling is holding the slot.

**Acceptance and proof.** One focused test per rule verb. A node with an unmet requirement cannot be bought and the reason is shown. A cluster grants the right steps at the right allocation. A keystone bought from one group blocks its siblings and is refused with a reason. Spending the last attainment point leaves the ordinary points untouched, and overflowing one currency does not clear the other currency's ranks. **The delivery tests' scripted rng is updated** so the attainment roll misses, and one focused test forces a hit and shows the point credited on completion. The mob HP curve is unchanged — `pnpm verify` still passes the mob gates, and `docs/DECISIONS.md:94` still holds.

**Stop and escalate if.** A rule would need an effect outside the bounded vocabulary, a keystone group cannot be expressed as a one-of, or any of this would move a published number.

---

### T4 — The board rebuild

**Objective.** A board that carries a few hundred nodes.

**Scope.** `game/src/ui/PassiveTreeBoard.svelte`, plus a new `game/src/ui/tree-board/` module set if the component outgrows one file. `game/src/ui/hud-layout.ts` only if the panel's footprint changes.

**Steps.** Replace the fixed viewBox with a viewport over the derived world box. Add pan and zoom. Colour by line, tinted by wing. Draw the three node kinds at three sizes. Add hover tooltip, search and filter, reachable highlight, path highlight, the currency readout, and **shift-allocate (D7): shift-clicking a node allocates every node on the path from the owned frontier to that node, and the number it will spend is shown before the click lands**. Keep the existing `role`, `tabindex` and `aria-label` on every node, and give every new affordance a keyboard path.

**Acceptance and proof.** The integrated-browser check at 1920 × 1080: pan, zoom, search, filter, path highlight and shift-allocate all work; shift-allocate spends exactly the announced number of points and refuses when it cannot afford the path; the keyboard path reaches every node; a screen reader announces node kind, wing, line, rank and connectivity. `pnpm check` passes.

**Stop and escalate if.** The board needs a HUD layout change — that is a separate concern and it updates `hud-layout.ts` in the same change.

---

### T5 — Content: the wings and the nodes

**Objective.** The tree is large and varied.

**Scope.** `tools/data/tree.json` only.

**Steps.** Add the wings and the nodes: more archetypes, per-weapon-family sub-wings (the `weapon` gate already exists), notables, keystones and threshold clusters. Every new node uses a real `mods.json` line, a real kind, a real currency and a real rule verb, and its value comes out of that line's budget (D9). Each wing concentrates a few lines and pushes them further than the broad existing wings do, so the wing choice is the build choice. Design targets, in the spirit of the request for scale and variety — **targets, not gates**: roughly 8–10 wings, 300–400 nodes, 20–30 keystones, 60–100 notables, several threshold clusters.

**Acceptance and proof.** The cage passes. The tree's own tests pass. A walk from the start reaches every node. A build that spends all 381 points in one wing is legal and the sheet shows the expected lines.

**Stop and escalate if.** A node would need a line that does not exist, or a rule verb outside the vocabulary.

---

### T6 — Publish

**Objective.** The wiki, the docs and the player-facing text describe the tree that exists.

**Scope.** `game/src/wiki/pages.ts`, `docs/DECISIONS.md` (the tree section only), `docs/game-rules.md` (only if a rule changed), `docs/glossary.md` (only if a term was renamed).

**Steps.** Rebuild the wiki with `pnpm wiki` — never hand-edit the generated HTML. Update the tree table (wing, nodes, ranks, points) and the point-budget lines. Record the new node kinds and the rule vocabulary in `docs/DECISIONS.md` so a later reader knows what a keystone is and what it may do.

**Acceptance and proof.** `pnpm wiki` produces the page, and the page's figures match the data. The wiki's own regression test passes.

---

## 12. Owner decisions — approved 2026-10-20

These were answered by the owner and are now binding. Each entry records what was chosen, what it means in practice, and what the plan therefore commits to. A later change to one of them is a new decision, not an implementation detail.

### D1 — Wings open, keystones one-of per family — **APPROVED**

**Chosen.** Every wing stays open to every character. The commitment lives in the **keystone groups**: a player may hold at most one member of a group, and holding one blocks its siblings.

**In practice.** A build is never locked out of a wing, so the free-respec culture of `docs/game-rules.md:8` still holds and no character creation screen is needed. The interesting decision is "which ember do I take", not "which wing may I enter".

**Commits the plan to.** `keystone_groups` in the spec (section 5.1), `groupOk` in the engine and the one-of refusal in the spending layer (T3), the sibling-holding message on the board (T4), and the cage gates on group shape (section 10).

### D2 — Two currencies — **APPROVED**

**Chosen.** `tree` points (381 from levels, after D8) buy ordinary nodes. `attainment` points buy keystones. A keystone never competes with an ordinary node for the same point.

**In practice.** The player is strong and expressive at the same time: the ordinary points decide how strong, the attainment points decide what shape. Keystones are unlocks, not line items in the same budget.

**Where an attainment point comes from — the quest board, as a very rare reward.** The Delivery board is the town's quest system: a contract is offered every `trigger_interval_sec` (1800 s) with `trigger_chance` (0.4), so roughly one contract per 75 minutes of play, and completing it pays gold, a stone bundle and — already today — a Skill XP Level on a `skill_chance` (0.2) roll. The attainment point joins that reward pool on the same pattern and with a much smaller number:

- `town.json.delivery.attainment_chance` — the base chance, **0.08**
- `town.json.delivery.attainment_band_weights` — `{ low: 0.5, mid: 1, high: 2 }`, so the chance is 4% in the low band, 8% in the mid band and 16% in the high band. The hard band is where the rare prize lives, the same way the stone bundles scale with `band_weights`.
- The roll happens **at offer time** and is frozen into `contract.reward.attainment` (0 or 1), exactly like the skill extra. An offer never changes after the player sees it.
- The point is paid on completion, next to `grantNamedSkill` (`game/src/sim/delivery.ts:190`).

**The income arithmetic, so the number can be argued with.** One contract per 75 minutes, and the chance is 4% in the low band and 16% in the high band:

| Playtime | low band | mid band | high band |
|---|---|---|---|
| 10 h | 0.3 | 0.6 | 1.3 |
| 25 h | 0.8 | 1.6 | 3.2 |
| 50 h | 1.6 | 3.2 | 6.4 |

There are twelve keystones, each costing one attainment point, and the keystone groups allow one per group. A player who plays a long game in the high band can afford two or three keystones; a player who never leaves the low band may never see one. That is the intent: a keystone is a treasure, not a line item.

**Why the Delivery board and not the Black Market.** The Black Market also has a weighted pool with rare entries and already sells named Skill XP Levels. Putting the attainment point there would make it a **gold sink** — a purchase — and this game already has six stone types filling that role. A free drop from a completed quest is a treasure, and it costs the player no gold, only the run.

**Commits the plan to.** `points.currencies` with the named income source, `town.json.delivery.attainment_chance` and `attainment_band_weights`, the `attainmentPoints` save field (additive, no schema bump), the reward shape on the contract and the preview, the per-currency rewrite of the overflow rule at `save.ts:694-697`, a currency readout on the board, and per-currency budget watches in the cage.

**The implementation trap this creates.** `game/src/sim/delivery.ts:71` documents the roll order — "target → count → stone → optional skill chance → optional named skill" — and the delivery tests drive it with a scripted rng of `() => 0` or `() => draws.shift() ?? 0`. A roll written as `rng() < chance` therefore **hits every time** under those tests, because a zero draw is below any chance. The attainment roll must go **last** in the documented order (so no earlier roll changes value), and the existing tests' scripted rng must be updated to miss it, with one focused test that forces a hit. Writing the comparison as `rng() >= 1 - chance` would leave the tests untouched, but an inverted comparison that exists to please a test is a trap for the next reader.

### D3 — No unlock conditions: connectivity only — **APPROVED** (changed 2026-10-20)

**Chosen.** A node is bought when it is **connected to a path the character already owns**. There is no attribute requirement, no stat threshold and no second-attribute case on any node. The `requires` key is gone from the schema.

**Why this is defensible.** The engine's reference build splits its stat points evenly over the seven attributes (`engine/index.ts:48`), so at the level cap a spread character already holds about **109 in every attribute**. Any absolute gate below 110 is passed by everybody and any gate above it is unreachable by a spread build. A percentage gate fixes that but puts a number on the node the player cannot read without knowing the reference line. Connectivity is a rule the player already understands, and it is the rule Path of Exile uses.

**What replaces the gate as the thing that makes a wing worth choosing** is the content: each new wing concentrates a few lines and pushes them much further than the broad existing wings do. The balance rule in D9 is what makes that meaningful.

**Commits the plan to.** No `requires` in the schema, no `gateOk` in the spending layer, no attribute badge and no "I qualify" filter on the board, and no cage gate about requirements.

### D4 — A keystone may carry a drawback, as a bounded removal — **APPROVED**

**Chosen.** The `remove` rule: a keystone takes a named line away ("you gain no Block"). Negative values on existing lines are **not** part of this plan.

**In practice.** A keystone is a real choice with a real cost, which is what makes it path-defining rather than a large number. The cost stays bounded: the drawback is a named line the character stops receiving, not a negative number every consumer of every line would have to tolerate.

**Commits the plan to.** The `remove` verb in the rule vocabulary, a removal set applied after the gear and tree folds and before the stats are derived, and one focused test per verb.

### D5 — Node values are authored — **APPROVED**

**Chosen.** Every node's granted values are written into the file. The tier derivation is used once, in T1, to freeze the 75 existing nodes' current numbers; after that the tree's numbers are its own.

**In practice.** The tree is a build axis of its own rather than a copy of the gear curve. A loot retune no longer silently retunes the tree, and a tree line can grant a fraction of a line that no piece ever grants.

**Commits the plan to.** The freeze step and its before/after comparison in T1, authored values as the only grant form in the v2 shape, and the cage gate that a grant's values are authored and sit inside the line's `mods.json` max.

### D6 — Topology is authored, geometry is derived — **APPROVED**

**Chosen.** The data holds each node's parents. A deterministic layout generator reads the topology and the `layout` block and assigns every node a position. Nodes are not hand-placed.

**In practice.** What gets designed is the shape of the network, which is the part that matters; the pixels are computed. The file stays reviewable at a few hundred nodes, and the same spec always produces the same board.

**Commits the plan to.** The `layout` block replacing the polar `graph` block, the generator inside `engine/tree.ts`, the `layout` world box the board pans over, and the cage gates that the layout is deterministic and produces no overlap.

### D7 — Shift-allocate the whole path — **APPROVED**

**Chosen.** Shift-clicking a node allocates every node on the path from the owned frontier to that node. The amount it will spend is shown before the click lands.

**In practice.** Building a tree becomes "design a shape" rather than "click eighty times", which is the difference between a tree that is a core activity and a tree that is a menu opened once.

**Commits the plan to.** Shift-allocate in the board rebuild (T4), the announced-cost preview, and the refusal path when the path cannot be afforded. The finer "allocate N points along the path" is a later refinement, not part of this plan.

### D8 — Two tree points a level — **APPROVED**

**Chosen.** `tools/data/engine.json` `stat.tree_points_per_level` goes from `1` to `2`. A character at the level cap holds **381** tree points (3 + 189 × 2) instead of 192, and the 564-point tree is 68% buyable — close to Path of Exile's own ratio of about 72%.

**Why two, and not one.** A node in this tree has **three ranks**, so one point a level buys a third of a node and a node completes every three levels. PoE gives a whole node a level. Two points a level closes most of that gap: a focused node completes every level and a half, and a level-cap character can max the three free wings (240 points) and still have 141 left for the committed wings — about four of them.

**What this does not touch.** The published numbers do not move. The reference build allocates **no tree at all** — `engine/index.ts:634-647` `buildLine()` takes only the even-split stat line plus its share of the thirteen items — so `build.hit_chance_pct` (93) and `loot.ttk_per_mob_sec` stay exactly where they are, and `tools/check.ts --sync` has nothing to re-publish. `docs/DECISIONS.md:94` still holds: `mobHP` excludes passive-tree power. No cage breaks, because no cage reads the tree today.

**What this does change, and the one that is not optional.**

1. **An existing save would not receive the extra points.** `game/src/state/save.ts:679` clamps the banked pool to `Math.min(eng.treePointsAt(lv), stored)`. A level-190 save holding 192 banked points would be clamped to 192 forever, because points are granted on level up and that character is already at the cap. The load path must **recompute** the pool as `treePointsAt(lv) - pointsSpent(ranks)` — the same expression `game/src/sim/game.ts:107` already uses in `setLevel` — instead of clamping to the stored value. It is one line, it needs no schema bump, and it restores the invariant "banked + spent = budget". `game/tests/save-fidelity.test.ts:326` and `:380-391` already assert against `treePointsAt(level)` and will show whether the change is right.
2. **`tools/data/engine.json:24` `stat.note` must be rewritten.** It states the identity that "the tree's ranks are exactly what the level cap grants". That identity is already false — the tree holds 225 ranks against 192 points — and at two points a level it is false by a wide margin. The note is owner-owned text and it has to say what the rule is now.
3. **`game/src/wiki/pages.ts:489` and `:872` publish the rate and the formula.** The wiki source is edited, the HTML is rebuilt with `pnpm wiki`, and the generated file is never hand-edited.

**Commits the plan to.** `tree_points_per_level: 2`, the recompute at `save.ts:679`, the rewritten `stat.note`, the wiki rebuild, and the updated totals in the content design (68% instead of 34%).

### D9 — One balance rule for the whole tree — **APPROVED, with one fork still open**

**Chosen.** A line has a **tree budget**, and the tree never hands out more of a line than its budget.

> Every line's total value across the whole tree is capped at **130% of its `mods.json` max**. A node's value is a slice of the budget of the line it grants, divided by the points spent on that line. The values are written into the file once and never derived from the loot tables at run time (D5), but the rule is what produced them, so they can be checked.

**Why 130%, and why a budget at all.** A value ladder makes the *far* nodes of a wing several times more point-efficient than the near ones, so the optimal play is to walk past everything and buy the far nodes. A budget has no such preference: the value of a point depends on the line, not on where the node sits. 130% is the smallest cap that leaves every one of the nine new wings a workable budget **and** that keeps the new wings' value per point equal to the existing tree's — the existing 75 nodes hand out **3.67 units per point**, the nine new wings at 130% hand out **3.65**.

**What the rule exposed.** The existing tree's own balance is lopsided, and this is the measurement behind the decision. It hands out **213%** of `all_stat_flat`'s maximum and **138%** of `critical_chance`'s, and it never touches `stat_mod_flat`, `attack_damage_pct` or `spell_damage_pct` at all. Six lines are already at or over their whole maximum. The consequence for the new content is concrete: the four lines with almost nothing left in their budget — `accuracy`, `armour_pen`, `bleed_chance`, `perfect_dodge_pct` — produce nodes worth **1** each, because there is nothing to divide.

**The fork — still the owner's call.** Three ways to answer that:

- **Option A (recommended): rebalance the existing 75 nodes to 78% of their max, once, by hand.** Every line then sits at a consistent 78%, the new wings fill the remaining 52%, and no line is starved. The cost: this **changes what an existing character's tree is worth** — a crit-damage build loses about 22% of its crit damage, an accuracy build about 23%, while a block, mana or armour-percent build gains a great deal. The tree's total value goes from 826 units to 1117, up 35% but very differently distributed. It is a deliberate, one-time re-authoring of seventy-five numbers and a balance change to a game that already has characters.
- **Option B: raise the cap to 200%.** The existing tree is untouched, every line has room, and the new wings come out at 6.47 units per point against the existing tree's 3.67 — the tree then has two economies and the new wings are 76% richer per point, so a player would walk into a new wing and never come back.
- **Option C: leave the existing tree alone and size each new wing by the budget its lines have left.** No balance change at all, and the board tells the truth: `edge` and `aim` have almost nothing left to give and stay small, while `lore` and `hex` have a lot and grow large. The cost is a lopsided board and four thin wings.

**Commits the plan to.** The per-line budget in the tree spec, the derived values written into the file, the balance watch in the cage (section 10), and — once the fork is settled — the content in [passive-tree-content.md](passive-tree-content.md) section 2.

### Decisions this plan does not cover

Jewels, Ascendancy, the Mastery grid and gem sockets remain separate plans (section 14). D2's second currency is the seam an ascendancy tree would later plug into; nothing in this plan assumes it.

## 13. Risks

| Risk | Consequence | Mitigation |
|---|---|---|
| A node's grant id is not in the sheet's line tables | The node is bought and does nothing — a silent, lossless-looking failure | The cage in section 10 gates the tree's grants against the sheet's tables, not only against `mods.json` |
| A keystone's rule changes a published number | The mob HP curve, the drop line or the XP ladder moves | Every phase captures the before state; `docs/DECISIONS.md:94` is an acceptance criterion |
| The point budget and the rank budget drift apart | A character at the level cap can neither fill nor finish the tree | The budget relationship is a **watch** in the cage, and the numbers are stated in the data's own note |
| The `save.ts:694-697` wipe fires on a new cost or currency | A whole build is deleted by a normal allocation | The wipe is evaluated per currency; the save-fidelity test covers the overflow path |
| The board cannot render a few hundred nodes | The tree exists in data and not in play | T4 ships before T5 adds volume |
| The concurrent agent is still editing the tree files | Conflicting edits and a broken baseline | Re-verify section 3 before each phase; the tree files were in flight at 16:48 |

## 14. Out of scope — separate plans

Each of these is a real system, not a tree feature, and each needs its own plan:

- **Jewels** — a new item type with a slot in the bag, its own drop and crafting path, and a save field.
- **Ascendancy** — a second tree with its own currency, an unlock condition and a new screen.
- **The Mastery grid** — a second allocation screen with its own currency and its own respec rule.
- **Gem sockets in the tree** — a socket is an item socket, and the game has no gem system.

## 15. Completion and handoff

The tree is done when: the spec is v2 and describes what it actually holds; a node can grant several lines; keystones, gates and clusters work; the board carries the tree; a cage gates the tree's integrity; the wiki and the docs describe the tree that exists; and no published number moved.

The implementing agent reports changed files with a one-line reason each, exact commands and results, and anything left unresolved. It does not claim success without evidence and it does not continue past a stop condition. The reviewer inspects the edited files and the evidence independently, in the active sandbox. No commit, no push, no transcript.
