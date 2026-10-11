# Decisions (draft — owner editing)

What the design means, in force now. Not a log: a rule that stops holding is deleted, not archived.

Judge a proposal on intent first and letter second. When intent and letter differ, ask the owner — never block on a reading the owner has not confirmed. An override is a normal follow-up, not a violation.

## How to think

**Start from the intent, then the model.** Read what the game means first, the rules and data second, and land the shape both make room for. A ban that fires against the game's own meaning is the ban misfiring, not the proposal.

## Standing intent (edit me)

- **[HIGHEST] One Core model, player and mob alike — Core is points, every line is `Base + K_core`.** A Core stat is a whole-number **point** value, never a fraction. Every derived line is a `Base` plus a `K_core` term through the **one** `K` table, shared by both sides: `Max HP = base_hp + Vit × K_VIT_HP`, `Armour = Str × K_ARMOUR`, `Accuracy = Dex × K_DEX_ACC`, and so on. A player's points come from level, gear and the tree; a mob's Core is its own fixed integer block, set above the player's even-split line to stand in for the gear and tree a mob does not wear. No mob gets a formula of its own and nothing about a mob is a decimal product. A derivation that ties one number to another — making the Core "equal" HP, re-deriving a published table from the Core — is out of bounds unless the owner names the coupling.
- **How long anything takes is never a design constraint (owner ruling).** No change, test, gate or number is gated on a play-length target. A band is a count of kills, an hour is the player's own pace, and the work is fix · balance · polish · verify.
- **One static HP table.** `mob_HP` is published per zone edge, never priced from player DPS; power is measured against it, never into it.
- **A dungeon run is a mode, not a place.** One dungeon per zone, on its settlement's first wild side. A run fields `mob_cap` normals in encounters of `group_cap` and pays the ordinary per-kill roll into escrow; escrow pays out on the last mob, a Push forfeits it, and a cleared run cools down for `cooldown_sec`. All four numbers live in `engine.json` `dungeon`.
- **One imprint stone per Mod.** An imprint stone rewrites one Unbound line as its own Mod with a fresh roll, one stone a use. A piece remembers the Unbound count it dropped with, so the Add cap is net (`item_level.mods_added_cap`): Remove refunds room, and every stone charges one piece a press.

## Product — what the game is

- **An open-world idle RPG.** Grind monsters, assemble a build from dropped items, and every drop forces a keep-or-trash decision. Pick a zone and fight it forever; the game earns with the window open or shut. Free.
- **One screen, never a site.** The field is watched (mob field · self plate · cast order · chronicle · pockets); a settlement is worked (buy · sell · enhance · craft · stash · tasks · travel); away still earns. No scroll, no navigation — panels cover and uncover.
- **Desktop and above only.** Pointer and keyboard; no touch, no phone layout.
- **The economy's shape.** Gold is minted only by selling junk; stones are spent at the bench; the Collector pays neither gold nor a Mod. Warehouse and stone services live in settlements, and the Waypoint warps for gold only where feet already went.
- **No death, no deletion.** A Push rests at camp and costs time only, so Respec is free in a settlement. A full bag, an overflow and a filter delete nothing: a piece that cannot be carried is left, a rejected drop dissolves into stones, and the client says which happened.
- **Risk before the press.** Every enhancement screen shows the step's odds and what failure costs before the stone is spent.

### The frame

It borrows the Melvor Idle frame and diverges on the axes where that frame is thin: item depth (Mod × Item quality × Tier × Element, not tier plus fixed craft values), Elements at all, slots that are genuinely different because Offensive comes from weapons only, crafting as commands rather than recipes, and a combat-only roster. What the player clicks is a zone and the skill order.

### Combat only — no resource skills

There is no gathering, finding, crafting or cooking skill. A non-combat skill becomes a clicker the player ignores and upkeep that must be checked; a gathering stream turns every drop into mere material and kills the loot decision; and the depth already lives in the item axes, not in a skill count.

- **Accepted cost** — while AFK the player has nothing else to switch to. Answered by making combat worth repeating, never by adding skills.
- **Narrow exception** — the herb farm (`engine.json` `farm` · `herbs`) is timers only: its own plot count, no levels, no XP, no skill, output is potion herbs, never gear or power, and potions never heal on bosses. Nothing there levels and nothing there is upkeep-gated, so it reopens nothing above.

### The loop

`Select zone → Fight monsters → Gain XP + items + crafting currency → Decide equip/craft → Next zone`

In place names: walk to a settlement the first time — arriving on its cell is what opens its Waypoint — sell or dissolve the junk at its counter, use the stalls and the bench, then take the Waypoint to the next zone, for gold. Every hex of the field is ground to stand on and hunt from, and every hex costs one block (`engine.json` `road`). Settlements add no clicks to automate and no power.

| Layer | What it is | What it unlocks |
|---|---|---|
| **Zone** | The level bands in `engine.json` `mob.zones` | Higher-level monsters · the item quality ceiling rises |
| **Build** | The slot set in `bases.json` `slots`, plus the weapon | Attack speed · what can be resisted |
| **Weapon Mastery** | Separate XP per weapon type (`bases.json` `mastery` · `engine/mastery.ts`) | Lighter equipped weapon + stronger skills of that weapon · account-wide +drop_rate |
| **Boss** | A special monster fightable at every level (`mob.bosses`) | That zone's quality ceiling · crafting currency |

### Active vs AFK — the most important decision

**The player must gain something from staying in the game that closing it does not give.** Three answers carry it, and all three are measured by the loot cage (`tools/loot.ts`), never argued:

- **Quality ceiling** — AFK drops the zone's floor quality only; high quality comes from being online or from crafting.
- **Skill ordering and auras** — the list is unlimited and runs in order; an aura reserves a share of Max Mana the player manages up front (`engine.json` `presets` · `skills.json`), so the budget is read before the fight rather than recalculated inside it.
- **Boss** — the only place high-quality items drop without crafting, and the only place a skill duplicate drops (`engine.json` `skill_drop`).

Kill rate and XP are whole either way: **AFK is shallower, not slower.** The two real differences are the zone-floor quality and the stone drip — no boss means no Add stones and no boss share of Tier stones (`loot.elite_tier_stones` · `loot.boss_tier_stones` · `loot.boss_add_stones`) — so the second half of the crafting engine is fully online. XP is deliberately not cut while away, because cutting XP and quality together makes closing the game feel like unmeasurable waste. Offline catch-up is capped by `inventory.offline_cap_hr`, and the seeded RNG keeps an offline result reproducible, so a save cannot be rerolled for a better outcome.

### Breadth instead of skills

Parallel paths the player never clicks between:

| Path | What it is |
|---|---|
| **Weapon types** | The roster in `bases.json` `weapons`, each with its own skill set in `weapon_pools` |
| **Elements** | The roster in `engine.json` `elements`; each carries its own status, every race owns one innate Element and resists it at the flat `mob.race_res_pct`. No counter pairs |
| **Combat skills** | `skills.json` `skills` — unlimited list, runs in order, auras player-managed |
| **Quality × Tier** | One item competes on several axes at once (`item_level`) |
| **Crafting commands** | The presses in `engine.json` `craft` · `engine/craft.ts` — fix a dropped item to fit the build |

**Weapon Mastery** — each type owns its own XP curve (`bases.json` `mastery`), earned from the kill stream (`xp`), with two layers: a while-equipped layer (that weapon lighter, its skills stronger) and an account-wide layer (+drop_rate once a type reaches its bonus level). So swapping weapons to farm Mastery never leaves combat, and AFK farms it at full rate because it counts purely from kills. Mastery grants no damage bonus on purpose: every weapon type is tuned to equal DPS (gate **X14**), and a damage bonus would leave one type permanently best and kill the reason to swap.

### Builds

All Core stats share one scale (`engine.json` `K`), so builds are separated by **where Mods are invested**, not by stat weighting.

| Build | Weapon | Defensive pieces focus | What to watch |
|---|---|---|---|
| physical burst | sword / axe | Max HP % | crit chance + crit damage on main hand |
| magic burst | staff / wand | Max Mana % · CDR % | Magic power + Alignment |
| fast hit | dagger / bow | Evasion flat · Evasion % | Attack speed % · Core stat Agi |
| elemental dot | any with Element | Elemental res of the used Element | Alignment + burn/poison |
| evasion tank | shield / mace | Evasion + Max HP | Core stat Vit + Agi |
| loot | anything | anything | Core stat Lck · drop rate |

- Every build spends Core stats from all pieces; they differ in which one is stacked.
- Lck feeds both damage (crit) and loot (drop), so it is the most valuable long-term build and is watched so it does not dominate.
- **"Fast hit" is a hit-count build, not a DPS race.** The big-hit build outscores it on raw damage per bag and no value in the `K` table changes that; its identity is swing count — more procs per second, more chill uptime, and the on-hit riders its extra swings carry as its boss path. The rebalance that ruling deferred has since run on geared characters: the same bag spent two ways leaves the hit-count build behind on damage while carrying more of it through a swing or what a swing left behind, so the identity holds and no number moved. The DoT leg is not this build's — burn and poison are the poison build's payload, spent on the curse lines.
- Every Core stat has an outlet: the skill roster uses CDR, and Str/Int/Dex/Agi/Lck/Wis all scale skills.

### Mobs and the status mirror

Mobs gain skills by body tier (`mob.size_rules`) and a mob skill only re-times its priced `mob_PS`, so `mob_HP`, the drop line and the timeline never move. Player statuses land three ways: DoT and damage-shaping debuffs hit mobs in full — monsters keep their own clocks, so the curses have real targets — and control is bounded: a mob takes the stun Cap (`caps.stun`) and the per-status aspd cuts but can never be locked, so no fight is stun-locked and no boss loses its clock. Innate Element stays every mob's baseline: its status still hits the player at the per-hit proc chance (`status.proc_chance`) — chill lowers aspd, shock stops attacks and regen, burn and poison are DoT.

### Minute one

The client builds the starting character from one read of `engine.json` `opening`, the same block the engine prices; gate **X60** holds it, so the set cannot come up a slot short or name a frame that is not in `bases.json`. The block is the whole of minute one — the settlement, the level, one frame at the floor of its own window per slot, no skill and nothing bought — and no piece is restated in prose.

- **The starting set is junk on purpose.** The mob-health curve already prices a first-zone, first-level mob against a character holding the sword this set gives, so a free top-tier weapon would pay out more damage than the curve allows. Every other slot takes its lightest frame, whose line is defence or utility: the set dresses the character without moving a price, and worn or not, only survival time moves. The off hand is a shield, not a book, because a book's own line is magic power — attack power the curve does not pay.
- **There is no starting skill.** The curve gives a first-level character almost no skill power, so a free attack skill would be power the mobs are not priced against. The first skill is the first boss drop, which is also when the skill axis becomes visible.
- **The first rule is an Elite task.** The board already exists and pays stones only, so the opening instruction costs no new system and no power outside the loot funnel — and it is the board's own Elite hunt, sized and paid by the board's own rule, because the plain kill-count task is gone.

### Completion and content

- **Win condition — decided.** Kill the last zone's boss within a single spawn without being Pushed. The engine prices it (`engine/index.ts` · `engine/goal.ts`) and the survival cage measures it (`tools/survival.ts`, gate **SV6**): unhealed, every build is Pushed, and one heal round clears it for the themes that spend their items on surviving — so the gate is *heal casts*, not new items, which is exactly what separates active play from AFK. The glass and Evasion themes are the two that cannot finish without allocating slots to health.
- **No prestige after completion** — the levels past the last zone are the item-quality push in the final band and the loop simply continues. The remaining goals are counted, never timed: a full Ascend set (`craft.ascend_add_stones` · `craft.ascend_tier_stones`), a full Refine pass (`craft.refine_slots_per_item`), Mastery across every type, and a skill to its full ladder. How long any of it takes is the player's own pace.
- **Short-form content** — one boss per zone (`mob.bosses`) · **achievements are cut** · Elite spawns are `loot.elite_spawn_chance`.

### Watches

The live risks the design has not yet had to settle into a rule:

- **Nothing to watch but loot.** A zone that stops showing progress bores fast — answered by the task board (§The task board) and the skill upgrade ladder, not by new systems.
- **One Offensive slot may be too narrow.** Crit, attack speed and accuracy live on the main hand alone (`bases.json` `weapon_pools`). If every build feels identical in play, this is the rule to relax.
- **Random skill drops may frustrate.** If bosses do not drop often enough a wanted skill never arrives; `skill_drop` is reviewed before anything else moves.
- **Crafting may devalue dropped loot.** If raising Tier is cheap, a good item equals a common one; the press costs in `craft` are read against the loot cage.
- **AFK must keep progressing at the zone floor.** AFK is shallower by design, and the first night offline reads as empty if the floor itself stops moving.

## Interface — the client's visual rules

- **A dark map table.** A war-room read over a generated hex sheet; plates float translucent, working screens opaque; the one accent is gold — where you are, or pressable now.
- **Tokens have one home.** Every colour lives in `styles/variables.css :root` (the map palette in `map.json`); nothing else hardcodes one.
- **Blur is a ladder.** The field sharpens toward attention and recedes elsewhere; a working screen inverts it — sharp screen, receded field. One ladder, one variable.
- **Highlight never overlaps.** Gold is you-or-pressable, green is the better option, the focus ink is the keyboard — and focus is never gold.
- **Plates read edge-first.** A mob plate leads with HP, the self plate stands on the field's near edge, a service row leads with cost. Every landed blow pops its own figure off the plate it hit — a direct hit flashes the rim, a status tick does not — and a dead body is gone at once, no outro kept. A hit flinches away from its striker, a strike runs at its victim, and a mutual exchange meets halfway. Motion is mounted by the event that happened, played once. Buttons name their action; a refusal names its reason in the player's own units.
- **No scrollbar, ever (owner ruling — important).** The field and every panel are sized to the viewport they open on; content that does not fit shrinks, clips or folds — it never scrolls. A scrollbar on any screen is a layout defect to fix at once, not a release valve.
- **Plain copy, no urgency.** Words over density, figures in the unit the player acts on, never a shorthand only the docs use. Time is not sold.
- **Floating circular HUD over a full-bleed field.** The portrait and its XP ring sit top-left, the minimap top-right (one press opens the full map), the objectives read slim along the left edge, the cast order is a row of orbs bottom-centre — the slot the rotation presses first the biggest — and the main wheel sits bottom-right: one plate split three ways (bags, skills, the character sheet) with five satellite knobs for the screens the loop reaches for next. The field runs full-bleed under all of it; the HUD floats, it never owns columns.
- **The parts have fixed names.** vitals · pockets · tracker · mob field · self plate · cast order · chronicle · map sheet · destination card · rail · pop panel. The **field** is the whole screen, the **mob field** is the middle of it, the **self plate** is the character's own card on the field's near edge; a bare **sheet** is the map, and the character sheet is spelled in full.
- **The rail prints its own captions.** Each tab wears the action's name under its icon and the purse read heads the bar; the key still lives in the tooltip, and the settings screen prints the full legend.
- **The chronicle is off by default.** The fight reads on the field; the chronicle is a toggle in the controls cluster, and the choice is a client setting that survives a reload.
- **Hands stay on keys.** Bindings are client settings that answer only outside a text field. Selection is off except on copy worth quoting; the map never takes one.

## Stack — fixed at the first code commit

A browser game, single-player, no server. This section fixes the stack; every number stays in `tools/data/*.json` (`AGENTS.md` — Numbers).

**The one rule: the game and the cages run the same engine math.** The numbers live in `tools/data/*.json`, the math in `engine/`, and the client imports the same JSON and calls the same functions — never a copied formula. A formula needed on both sides is extracted into one shared module both import, so a cage and the game cannot disagree.

| Layer | Pick | Why |
|---|---|---|
| Language | TypeScript | The data model is large (slots, Mod / quality / Tier, the Elements, the mob roster); types catch the drift this repo already fights |
| Runtime | Node native type stripping | No build step, no runtime dependency: `engine/`, `tools/` and `game/` are all `.ts`, types stripped at load, so the cages and the client run the *same source files*. `npm run typecheck` (`tsc --noEmit`) is dev-only and never emits |
| Build | Vite | Fast dev server, static output, no backend |
| UI | Svelte | Small bundle, low boilerplate for a panel-heavy idle UI |
| State | Svelte stores / a small reducer | No Redux-class dependency |
| Persistence | IndexedDB with a localStorage fallback | Local only, `save.snapshot_slots` slots, JSON export/import |
| Simulation | Fixed tick + offline catch-up | The idle loop; offline reads a monotonic clock and `inventory.offline_cap_hr` |
| RNG | Seeded | Offline results are reproducible and a save cannot be rerolled |
| Tests | Vitest | Reuses the cage logic |
| Deploy | Static host, plus a PWA manifest | Replace-all git already fits this; the manifest makes it playable offline |

```
engine/                the shared math, one home: index.ts (createEngine) · loot.ts (createLoot + rng)
tools/lib/engine.ts    an ESM bridge: loads tools/data/engine.json and re-exports engine/
game/
  src/
    engine/client.ts   imports the same JSON + createEngine the cages call
    sim/               tick loop, combat order, drops, offline catch-up
    state/save.ts      IndexedDB + localStorage fallback, the slots, JSON export/import
    App.svelte         the field HUD, the menu rail, and the sub-screen behind each tab
  tests/               Vitest: game values === cage values
```

**Not used** — no backend, no accounts, no cloud · no player trading · no graphics engine (Phaser / Three): the game is panels and numbers, not motion · no Web Worker at first, because the tick is cheap, and one is added only if profiling says so.

## The task board — the daily direction layer

The board answers the opening question above — nothing is visible except loot — without adding power outside the funnel the loot cage already measures. **Every figure here is `town.json` `task_sizing` or `engine.json`; this section names the key and never the value**, and the sizing is marked provisional and owner-veto-able in the data.

- **Where it lives** — the Guild counter in each Capital (`town.json` `settlements` · `npcs`). Doors there are chosen; the payout rules below do not change either way.
- **Payouts stay in stones** — a task reward never pays gold, because the filter-sold piece is gold's only mint (`engine.json` `junk` · the Counterhand). Counter purchases (skip tokens) are paid in gold, priced by the `skip_token` line in `town.json` `repeatable`.
- **The slot count, the refill clock and the free skip** are `task_sizing.slots`, `task_sizing.refill_sec` and `task_sizing.free_skip_per_day`. An empty slot offers a new task immediately; a finished or skipped slot refills when its clock runs out. Further skips are bought at the Guild counter in gold — the `skip_token` line owns its price and its per-day ceiling — never in stones.
- **The pool is level-gated** — only zones at or below the zone the player is fighting.

| Type | Objective | Progress while AFK | Reward |
|---|---|---|---|
| Elite hunt | Kill `task_sizing.elite_n` elites | Yes | Tier stones, sized at `task_sizing.reward_minutes_of_band_income` of that band's own stone income |
| Boss | Kill the zone's boss within one spawn | No — online only | `task_sizing.boss_reward`: a Remove stone, or the Reroll tier count it names, winner's choice |

- The board offers the two kinds against each other at `task_sizing.offer_weight_elite`.
- **The plain Hunt task — "kill N mobs in zone Z" — is gone.** It carried the majority of the roll, so the board offers the Elite hunt and the Boss hunt only, and the opening instruction (§Minute one) is the board's own Elite hunt (`engine.json` `opening`).
- **Income bound (hard rule)** — all task rewards combined stay inside `task_sizing.income_bound_pct` of the day's loot flows: bonus stones inside the same funnel, never new income on top. The rebalance pass sizes the elite count and the reward counts against the loot cage (`tools/loot.ts`). Retiring the plain Hunt task took the board's Reroll **value** stone drip out of that budget, so what the bound now covers is the Elite hunt's Reroll **tier** stones and the Boss hunt's own Remove stone.
- Task XP counts toward the bonus curve (`engine.json` `xp.elite_mult` · `xp.boss_mult`); the bound above covers it.
