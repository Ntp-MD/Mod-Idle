# Feature plan v2 — Delivery Contracts (A) · Dungeon Retreat (D) · Life Skills (B) · Haggling (F)

**v2 is the single source of truth** (v1 `plan-town-delivery-field-camp.md` deleted). Consolidated, fresh-eyes-review-folded plan. **Status: plan only — no source edits yet.** Tracked tasks #4–#17.

Locked 2026-10-16 by the owner. Obeys `AGENTS.md`: numbers in `tools/data/*.json`; `engine/` owns shared math; save extends via `game/src/state/save.ts` with meaning-preserving migration; UI uses existing clean files + shared tokens; **no gate prescribes a balance band or content minimum**; wiki regenerated from `game/src/wiki/pages.ts`. On this host run scripts via `npm` / `node --experimental-strip-types tools/…` (no `pnpm`).

## Sequence & ship order
**A (A0→A1→A2→A3→A4→A6→A5, +A7 deferred) → D → B (B1a→B1→B2→B3) → F (candidate).**
Ship **A fully green before starting B1a** — B1a rewrites the salvage→stone economy and is the riskiest change; keep it independently reversible.

---

## Fresh-eyes review — resolutions folded in

| # | Issue | Decision baked below |
|---|---|---|
| 1 | Retreat vs death asymmetry = free-lunch | **Retreat rescues 1–2 random stacks (voluntary cut-loss); death/Push forfeits ALL.** Not symmetric on purpose — that's the greed tension. Retreat resets the run + respects the existing dungeon entry cooldown (no bail-spam). Continuing must stay worth it (clear = full bank). |
| 2 | Offline offer churn (unseen triggers pile up) | **New offers only trigger for *visited* towns and the trigger clock pauses while away.** Already-live offer *deadlines* still run offline (countdown rule holds) — you only lose time you chose to spend. |
| 3 | Idle vs gather XOR (what runs offline?) | Offline `catchUp` advances the **last-chosen activity** (combat-hunt OR a fieldwork gather), never both — set before closing. Ties to B3 activity-switch. |
| 4 | Random skill can dead-roll (ladder-capped / off-class) | Skill pool **excludes skills at their ladder cap** and is **zone/level-weighted** by the offer's difficulty tier; still fully random within that pool (owner: "random all" preserved). |
| 5 | Incomplete = no bonus feels pointless | Kept full-only completion (owner); softened by feasible deadlines (#6) + attractive premium (provisional tuning). |
| 6 | Fixed deadline vs far town = impossible | **Deadline window MAY scale with travel/zone reachability (feasibility); reward VALUE still never reads distance.** |
| 7 | A premium × F Haggling multiplier inflate | **Haggling sell-multiplier applies to the market-base portion only, never the contract bonus; combined premium capped.** |
| 8 | 8 life-skill combat stats = a 2nd ladder | **Per-skill cap ≤ ~3% AND an aggregate cap on total life-skill combat contribution** (one shared budget) so it never rivals gear/tree. |
| 9 | scrap/ore carry weight + bag overflow | salvage emits **weight-bearing `iron`+`scrap` into the bag under the ordinary stop_pickup/full-bag rules**; both are **sellable trade.goods** so a pile can be vented, never silently lost. |
| 10 | New rng consumers break golden sequence | Contract triggers + retreat rescue + skill roll are **seeded**; re-baseline any golden-sequence/engine-agreement test in A4/B. |

---

## A — Town Delivery Contracts

**Model (locked):** per-town **global want-list**, **no Accept**. Each *visited* town fires a new want on a **~30-min trigger chance** (trigger clock pauses while away; ≤ `open_slots` live at once). Player sees the want + **rolled reward** (in Market / an Objectives list), plans whether it's worth serving, travels there, and **hands goods in within the window**.

**Economy (conservation, no mint):**
- Each hand-in **pays the town's live `quoteSale` market value immediately** (same demand curve + `marketCredit` as a normal sale) and adds to `delivered`.
- On `delivered == count`, pay the **contract bonus** once: premium delta (`quoteSale × (premium_mult−1)`, Haggling NOT applied to this part) + a `reroll_value`/`tier` stone slice from `eng.taskPayout` + a skill grant.
- Incomplete at expiry: bonus never pays, already-sold goods stay sold. **A recap card** always reports qty · market gold paid · bonus earned/forfeited.
- **`income_bound_pct`/T19 are unenforced guidance** — no balance-band gate; conservation is met by the `taskPayout`/`quoteSale` derivation. `standing.never_grants` = stat/Mod/stone → contracts are **not** a Standing earner.

**Reward roll (at trigger, shown up front):** gold premium mult · stone key+count · **skill = random from a zone-weighted, ladder-cap-excluded pool** (unowned → `owned[id]=0`; owned-not-maxed → `owned[id]+=1` upgrade). Difficulty (source zone band · rarity · processed · count) scales count, deadline feasibility window, and bonus value — **never distance for value.**

### A1 · data → `town.json` `delivery` (mirror `task_sizing` provisional style)
`offer_trigger{trigger_interval_sec≈1800, trigger_chance}`, `visited_only:true`, `pause_offline:true`, `open_slots`, `target_pool`+`weights`, `count_sizing` by band (**≤ `E.inventory.stack_size`**), `deadline_sec_band` (**+ feasibility term**), `reward{gold_premium_mult, stone_key, stone_minutes_of_band_income, skill_grant{pool:"zone_weighted", exclude_at_cap:true}}`, `difficulty_inputs` (value never reads distance).

### A0 · `engine/delivery.ts` (shared math) + `DeliveryCfg` type
Pure difficulty→(count, deadline) + reward derivation (`taskPayout` slice, `quoteSale × premium`). One home so sim + any cage agree. Add `DeliveryCfg` in `engine/types.ts` (no `TOWN.delivery as any`).

### A2 · `game/src/sim/delivery.ts`
- `tickContracts(state, rng, online)`: per **visited** town, advance its trigger clock **only while online**; on interval boundary roll `trigger_chance`; on hit + free slot → `rollContract`. Advance live deadlines via `clockSec` (incl `catchUp`); past due → `expired` (void bonus only). Wired beside `tickTown` (game.ts:870).
- `rollContract(rng, town, state)`: seeded; farmable target (`trade.byId` ∩ zone `regional_sources`); count ≤ stack cap; feasible deadline; **bundle rolled once, stored**.
- `deliver(state, townId, goodId, count)`: requires `atSettlement`; **no Accept**; pays base quote at once + accrues `delivered`; on completion pays bonus once; emits recap card; refusals lose nothing.

### A3 · state + save (`types.ts` + `save.ts`)
`TownState += contracts: Record<string, DeliveryContract[]>`, `contractNextTrigger: Record<string,number>`, `tracked: string[]`. `DeliveryContract { town, goodId, count, delivered, difficulty, reward{goldMult,stoneKey,stoneCount,skillId?}, triggeredAt, dueAt, status:'open'|'expired', paid }`. `newTown()` inits; `migrate` adds `||=` defaults (additive, SCHEMA stays 14). Multi-tab (§L): only the account-writer tab triggers/advances. Verify old-save load + export/import round-trip.

### A4 · tests + cage
Trigger determinism (seeded, live vs catchUp parity); partial hand-in pays base each trip + bonus once; refusals lose nothing; **expiry keeps sold, voids bonus**; recap fields; conservation (gold/stone/skill once); **skill dup→upgrade, at-cap excluded, no 2nd mint**; save round-trip. Cage `tools/trade.ts TC*`: offer resolvability (farmable, count≤cap) + reward derivation/finiteness — **no balance band**.

### A6/A7 · UI (clean file + Objectives)
- **`Market.svelte`** (clean): open want list (remote/plan view) + per-town current want, reward, countdown, Deliver, **[Track]**, expired greyed; recap card on deliver/expiry. Interim **Objectives tab** = tracked wants (town/good/delivered-count/time-left). Do **not** touch `App.svelte`/`hud-layout`/`TownHub`/`FieldPlates` (in-flight).
- **A7 (deferred):** promote Objectives to a real **HUD region** via shared `HudLayout` (HudRegionId/META/DEFAULT + App.svelte, backfill old layouts) once the in-flight HUD workstream lands.

### A5 · docs
`pages.ts` towns/economy + `DECISIONS.md` (note already added — extend). Add glossary terms **Delivery Contract / Track / Objectives / Retreat / `scrap`**. Rebuild wiki only after in-flight `docs/wiki` edits land.

---

## D — Dungeon Retreat

`engine/dungeon.ts`: add **Retreat/Flee** = end run, **rng-select 1–2 random stacks from `s.dungeon.escrow`** (data `E.dungeon.retreat_keep_min=1/max=2`), pay those via the pickup rule, discard the rest; **resets the run + respects the existing dungeon entry cooldown**. **Death/Push stays full-forfeit** (asymmetry is the intended tension). §J probes: rescue ≤ escrow, no double-pay, no re-enter for a second rescue, seeded deterministic, bail-spam rate-limited. Re-baseline rng.

---

## B — Life skills (Melvor exclusive activity, small bounded combat)

Ruling: gathering and fighting are mutually exclusive (already enforced `fieldwork.ts:211/:233/:177`); **never a mana reserve** (`s.auras`/`reservedPct` untouched). Each skill: own XP/level/Mastery, independent of character XP, never `mob_HP`.

**Bonus model** per 10-level rung (cap ~100):
- Own-line throughput: yield / speed / rare / carry-cap / efficiency.
- **Small combat stat**, folded via `buildCharacter(effects)`: **per-skill ≤ ~3% AND under an aggregate life-skill combat budget** so it never rivals gear/tree. Proposed: Mining→Armour · Woodcutting→Evasion · Hunting→Accuracy · Cooking→HP-regen · Farming→regen · Fishing→Mana-regen · Smithing→Armour-Pen.

**B1a (riskiest — the salvage→stone economy rewrite):**
- Salvage of a gear piece yields **weight-bearing `iron` + `scrap`** (NO direct Value stone), into the bag under stop_pickup/full-bag rules; both sellable trade.goods.
- **Alchemy** (existing farm/alchemy station, not a new skill) gains recipe `scrap → reroll_value`; **Smithing** works `iron` into metal bars/components/cargo (**never finished gear**).
- Tier milestone re-anchors **salvage-count → Alchemy-count**; **F15 re-expressed** against it; re-anchor `eng.stonesForMinutes` `rerollValueStonesPerHr` to the Alchemy output (else A/task quote a stale rate). Capped, no gear→stone→gear net loop.
- **Onboarding:** Alchemy available from opening; first scrap→stone cheap/fast.
- Update salvage tests (`audit-follow` "manual salvage", `salvageBag`) + reroll_value rate tests. Coordinate Alchemy/CraftBoard/FieldworkBoard UI (in-flight).

**B1:** Fishing (gather, reuse exclusivity) + Smithing skill track; extend `FieldSkillId` (fieldwork.ts:7) + curves in `engine.json`.
**B2:** per-skill goals via `goal.ts` (data-defined milestones; no pacing gates).
**B3:** activity-switch UI affordance ("gathering X vs fighting", sets the offline mode) — clean file / coordinate (`FieldworkBoard` in-flight).

---

## F — Haggling (candidate, go pending)

Town-side life skill (3rd track like Farming, NOT a `FieldSkillId`). XP = **delivery contracts (A) + very small XP from ordinary sales**. Capped **gold-efficiency** bonuses: +market-base sell multiplier (NOT the contract bonus — see review #7), +capacity / faster recovery, −town service price, +contract premium. Apply as a final-gold multiplier or on capacity/recovery — **never re-shape the premium curve mid-sale** (preserve `quoteSale` bulk==split). Extend trade conservation/identity tests + a combined-premium bound check. Own save track + wiki. Sequence after A.

---

## Cross-cutting cautions
- **RNG stream:** every new seeded consumer (A triggers, D rescue, skill roll) — verify golden-sequence/engine-agreement, re-baseline deterministically.
- **In-flight UI:** `App.svelte`, `TownHub`, `FieldPlates`, `CraftBoard`, `CraftWorkshop`, `FieldworkBoard`, `bag.ts`, all `docs/wiki/*.html` are modified by another workstream. Re-check `git status` before any UI/save/pages edit; **A0 engine + B1a `stonesForMinutes`** both touch engine income → merge carefully.
- **Aggregate power ceiling:** A premium × F Haggling and the B aggregate combat cap are the two compounding-inflation guards to keep honest in tests.
