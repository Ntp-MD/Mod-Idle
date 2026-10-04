# Task context — the live slot

The single live slot for the task in flight. Never a second one per topic. Read it at task start,
write it silently after every meaningful step, and **clear it back to this empty shape when the task
is done** — a task is not finished while this file still describes it.

Backlog items that have not started live in `harness/todo.md`, not here.

# Mission

Coding has started (the owner's go-ahead, 2026-10-03). Landed: `engine/` — the shared math as an ESM
factory (`createEngine` · `createLoot`) that `tools/lib/engine.js` now bridges and `game/` imports,
so the cages and the client resolve to one set of formulas (`Techstack.md`); and `game/` — Vite ·
Svelte · TypeScript client with the fixed 1-sec tick, seeded RNG, the `combat.md` §2 damage order in
both directions, Energy Shield, Push-instead-of-death with the camp walk-back, XP/levels off
`xp_to_next`, drops off the band drop chance, junk and gold off `junk.rarities`, the 9-zone select,
the character sheet, the bag with the Stat Mod split chosen at equip time, and 3-slot IndexedDB save
with the offline catch-up cap. Then the **skill layer**: `engine/skills.js` owns the roster
calculator (per-press, ladder-before-CDR, skill XP, group bonus, aura reservation) and
`tools/lib/skillmodel.js` + `tools/ladder.js` now call it instead of holding their own copy; the
client runs the 15-slot top-down rotation with no manual presses, pays skill XP per kill, drops
skills on the `skill_drop` rates and feeds duplicates into each skill's own ladder. Then the **town
layer**: settlements mapped from zones, the Counterhand where junk is sold by hand (gold is never
auto-credited), stall stock priced through `engine.goldPerMinute` so a drop-rate change moves the
prices with it, Standing tiers earned on zone kills, the bounded Road with its 8 links, and the Guild
board (3 slots, 1-hour refill, stones only) sized by `town.json` `task_sizing` and paid by
`engine.taskPayout`. Then the **craft bench**: `engine/craft.js` runs Reroll (never below the value
the line already holds), Refine (one Tier up, stops at T1), the 1-stone randomize (the only craft
allowed to roll lower), Ascend (the whole piece one Item quality step, every line moving into the
next band) and Remove (Legacy slots 1-2 immune), all priced from `engine.json` `craft`, and it sits
inside the settlement panel because crafting is Settlement-only. Then **Farming and potions**:
`engine/farm.js` owns the level curve (`floor(sqrt(xp ÷ 100)) + 1`, Cap 20), the tier unlocks
(low 1 · mid 6 · high 11), the herb roll (2% mid · 3% high, 1-3 per bundle) and the potion ladder
(`base + step × (index − 1)` → 10/20/30 HP · 15/25/35 mana); the client plants, grows on the 4-hour
timer through offline time, harvests, brews, condenses, and auto-drinks at the thresholds now stored
in `potions.auto_use_default` — with the shared 30-sec cooldown, the 3-sips-a-fight cap and the boss
suppression all enforced. Planting costs time only because no seed exists in the design
(`harness/todo.md` B11 · `harness/decisions.md` D-078). Then the **Bases and the weight tax**:
`tools/bases.js` (the 12th cage) imports `item-base.md`'s frame tables into
`tools/data/bases.json` — 27 Bases across 10 slots with weight, Primary and Secondary Mod pools and
the Gear Mod school — `tools/loot.js` now reads that file instead of parsing the doc, and the client
rolls real frames (`barbute`, `band`, `gauntlets`…) with only the lines their frame may carry.
`engine/index.js` gained `encumbranceOf` · `aspdEncumbered` · `weightAtQuality`, so the §11 tax
(`(used − capacity) / capacity`, Cap 50%, cutting aspd and never locking a slot) runs in the shared
module and shows on the character sheet.
`tools/loot.js` also lost its private copy of the roll primitives and the RNG —
it now calls `engine/loot.js`, and the loot cage still reproduces the published keep-rates (LT12).
Then **storage and travel**: stash tabs come from the Porter's lines and two per house (capped at six,
and a tab is organisation because no Bag Cap exists), deposit and withdraw are Settlement-only, and
`engine/road.js` runs the Road — mode C is the walk (5 min, 5 encounters drawn from the two zones'
casts at the shared weights, purse 3 gold once per link per day so the mint is bounded at 24/day,
Standing 15 kill-equivalents at the far end, a Push forfeits, no stones, and the offline catch-up
never runs it), which is also how an unopened settlement becomes reachable; mode B is the carriage
purchase and the Waypoint then returns free. The zone list now refuses any zone whose settlement has
not been opened, so walking is no longer a free bypass of the travel model. Then **weapon Mastery**:
`bases.json` gained the 12 weapon types and the weapon union pools (so `tools/loot.js` no longer
parses `equipment-weapon.md` or `equipment-slot-weapon.md` either), `engine/mastery.js` owns the curve
— 4 XP per kill to the held type, `floor(sqrt(xp ÷ 100)) + 1` to L20, weight −1% a level to −20%,
skill damage +0.5% a level from L5 to +8%, and +1% drop rate per type at L10 to +12% account-wide —
and the weapon panel reads `Mastery 3/20 · weight -3% · drop bonus 0%` the way `character-sheet.md`
asks. Mastery moves no DPS, and BS5-BS8 in the bases cage hold the equal-DPS rule and the 12-type
count in place. Then the **6 loadout presets**: `engine.json` `presets` carries the rules (six sets,
main index 0, auto-select by zone, cooldowns survive a Push, skill XP account-wide — D-079), each set
stores the 15-slot order plus the buff and aura toggles and the zones it answers for, a Push pulls the
Main set back without resetting a running cooldown, and the skill panel has the set bar with save and
zone-bind controls. Then the **Collector and the pedlar**: `engine/collector.js` reads the three sets
from `town.json` (Base · slot · school · quality, reward, and the rule that the sink runs before the
filter dissolves a wanted piece), the client holds a matching drop instead of dissolving it, and a
turn-in needs Tier II standing in that settlement, consumes one held piece per line, pays the item
itself (banner + preset slot · stash tab · prestige title) once per character and never any gold. The
Curio pedlar now restocks three appearance slots a real day, each priced inside its published
30-120 m band, and refuses a fourth. **Add mod stone now runs too**: `engine.json` `rarity` carries
the crafted ceilings (Common 3 · Rare 7), `mods_added` cap 2 and the 1-then-2 stone cost (D-081), the
stone draws the line from the piece's own Base pool and never repeats a line the piece holds, and
slots 6-7 stop offering a Stat Mod once the piece holds its two — which also makes the Remove + Add
identity change the docs describe reachable in the client. Then a **`save.md` fidelity pass**: offline
time is AFK for real (no boss income and no drop above the zone floor, both read from new data), the
boss is a stored per-character due time instead of a tick modulo, Reroll floors at the highest value
the slot ever held (`item.baselines`), 500 dissolved pieces owe one Reroll tier stone (F15), and the
save carries `SCHEMA_VERSION = 2` with a foreign version **rejected** on import plus a shared account
record that keeps the best Mastery across the three slots (D-082). Then the **filter and backup
pass**: every Elemental line stores its Element (the loot cage already did, the client did not, and
until now the Element keep-reason could not fire), `game/src/sim/filter.ts` keeps one threshold per
slot — margin, Rarity floor, and the Element switch — all defaulting to the published swap margin,
with the "Elements/slots not yet found" list stored from the gear actually worn (`loot.md` §4 ·
`save.md`), and `save.md` item 5 runs as three walking snapshots stored outside the record they
protect, owed on a level up, on a successful Ascend or Refine and on the `save.snapshot_interval_min`
timer, where a rewind takes the character back whole and rebuilds the account record from the slots
that survived (D-083). `tools/loot.js` calls the shared `keepsDrop` rather than holding its own copy
of the comparison, and it prints the same keep-rates as before. Then **the win condition landed**:
`engine/index.js` `winTarget` derives the gate from the last zone row, its level ceiling and the
boss's own mob-curve HP, so the panel reads the same figure `concept.md` publishes without quoting
it, and `game/src/sim/goal.ts` arms the gate on that spawn before the first swing and closes it only
if no Push happened during it (D-084). Completion is recorded once and the run continues, since
`concept.md` rules out prestige.
Then **skills began to do what they say**: 10 roster rows carry an `effects` list copied verbatim out
of their own `effect` sentence, the skill cage's S11 fails if a declared number stops appearing in its
row and S12 prints how many rows are still prose, `engine/skills.js` `aggregateEffects` folds them
once, and `buildCharacter` spends the result — so Iron Guard moves Armour by its row's number,
Warcry's ×1.20 lands inside the existing resistance Cap, and Greater Heal is one instant 45% again
instead of the 45%-per-second drip the prose parse produced (D-085).
Then **curses landed on the mob**: 5 rows carry `subject: "target"` effects copied from their own
sentence, `game/src/sim/curse.ts` keeps one store of mob id → line → value and seconds, a re-cast
refreshes a line while two different lines add, and both swing directions read it — Weaken and
Cripple compound onto the mob's priced `ps`, Blinding Mark cuts the accuracy behind both rolls, and
Expose and Jinx bite only against the cursed target (D-086). Sunder was the last row of that set to
wait, and the question it hinged on — whether a mob's own Armour and resistance cut our outgoing
damage — was answered by D-099 and now runs: the non-Element half answers the mob's Armour, the
Element half its resistance, and a chill cut lands before the ratio.
`game/tests/pacing.test.ts` now measures the built loop against the published hours: the measured kill rate
sits inside `loot.kill_rate_tolerance` of the band's published figure, which is the gate the test
actually uses and level 10 at 0.5 hr
exactly as `timeline_checkpoints_hr` says — and it exposes the dead end queued as `harness/todo.md` B17.
Then **the idle loop stopped dead-ending**: the filter's `upgrade` verdict now equips, the displaced
piece dissolves into the same 1 Reroll value stone a reject earns, and `game/tests/pacing.test.ts`
shows the mint paying in every hour instead of stopping at minute 34 (D-087).
Then **Elemental damage became per Element** (`harness/decisions.md` D-090): each Elemental line
keeps its own Element, `elemByElement` breaks the pool down without changing its total, and
`playerSwing` counters every pool separately in the same swing — the fire part of a fire-and-cold
weapon takes the ×1.5 weak line against a fire monster while the cold part takes the counter pair.
Measured at the same 1.00× of the band's published kill rate, so it moved distribution, not power.
Then **Phase 1 of the open queue began closing** (D-091): the character bag became a real thirty-slot bag charged one slot per full or partial stack with the doc's own `stop_pickup` verb (B15), and a planted crop now pays one herb of its tier as the seed the cycle names (B11). The Herb pouch now sells what its own line says it sells — one more character-bag slot (B14) — `save.md`
stopped promising to store stat points no rule produces (B16), and the bases cage's new **BS9** pins the
weapon frames at the 12 types until a variant list actually exists (B6 · B7).
Then **the Element counter was switched on**: the sim had been passing no weapon Element at all, so
`elements.md`'s table and the ×1.5 weak line never fired anywhere in the client, and where a
multiplier did reach the hit it was applied to the physical half too. The held piece's own Elemental
line now supplies the Element, steps 3-4 scale only the Elemental share, Chaos is exempt from the
weak line as the doc states (derived from the table, not named), and the AFK loop measured at
0.97× the band's published kill rate against 0.89× before (D-088).
`node tools/verify.js` 12/12 · `cd game && npx vitest run` 205/205, and the client reproduces the
published low-band pacing (a level-1 Eastgate character measures within one band-step of the rate
`loot.md` §2 publishes for that band — read the number there, not here).

Then **the weight tables stopped being hand-typed** (D-093): the three-paths table and the §11 tax table are printed from `tools/data/bases.json`, the balanced path now shows what the Base rows actually sum to, and the third copy in `equipment-weapon.md` was deleted because it needed a weapon weight column that does not exist yet (B13).
Then **the statuses we inflict on mobs were built** (D-094): a target-side store with the Alignment gate, the shared proc, per-status stack and decay rules, chill and shock bounded to a rolling 15% control budget, mark multiplying the hit it rides on and paying leech, bleed kept outside the Element DoT budget — and the uplift it adds is now a named debt on B1.
Then **the last three crafts stopped being locked** (D-095): `crafting.md`'s +1..+15 ladder, its protection and Broken rules, the 1 Repair stone revive and the 25/20/15/15/10/10/5 Corrupt table are data and run on the bench — with `gear_mod_per_level` left at 0 because the doc defers that one value to the mob-sheet pass, and a new gap (B21) recording that Quality, Repair and Corrupt stones have no income rate anywhere yet.
# Plan

The provision layer turned out to be already complete: `farm.md` rules auto-use per **line** (HP ·
mana) with a toggle plus a threshold and "always drinks the best available tier first", which is
exactly what the client does — so `save.md`'s looser "per-type toggle" needed no code. That reading
closed the last build-time question: what the queue holds now is balance, not features.

Every roster row states its strength in data (D-102): `engine/skills.js` folds a row's `effects`, its
`rules` word from the closed set, or the column named by `modelled_by`, and the client spends the
result — so the cast rotation, both swing directions, the mob-side status store and the curse store all
read the row rather than its sentence (`node tools/skills.js` prints the roster count and the split
live). The roster's shape is generated and gate-held, so nothing here retypes it. The last figure the
design withheld — what one Gear Mod step is worth — is now divided out of two it publishes (D-104), so
`craft.gear_mod_per_level` is non-zero, the bench says what a step adds, and **X42** and **SV7** keep it
inside the line it raises.

What the queue holds now is one owner question and one housekeeping line: **A11** (the hit-count
build’s proc leg is thin — raise the mob-side DoT budget, which re-prices `mob_HP`, or re-word
`concept.md` P0-2 so that build’s identity is swing count, chill uptime and Riposte’s dodge scaling;
both answers move a published promise, so neither is taken here) and **C1** (`npm run check` is not
green yet). Section B is empty: the audit ran end to end — B1 (D-103) · B3 (D-106) · B4 (D-105) · B5 ·
B8 · B9 · B10 · B13 · B21 — and each one’s numbers are in `harness/decisions.md` rather than in this
file.

Then **the client opened on one main screen** (D-107): the combat scene, the character sheet, the
carried inventory and the temporary inventory the hunt fills, all at once, with the two tabs that
used to hold the sheet and the bags retired instead of duplicated. Slots are squares in a grid the
way Melvor shows them, orderable five ways and switchable to an item list, and hovering a slot opens
the piece's own detail card — lines with their Tiers, what it weighs, the comparison against what is
worn in that slot, the Stat Mod's stat choice and the Equip button, because nothing equips itself
(D-089). The ranking comes out of `loot.score` with the Rarity and quality orders taken from the
roll's own tables (`game/src/ui/bag.ts`), and the carried bag draws from `bagStacks`, which is the
same list `slotsUsed` counts, so the grid and the `used / available` figure cannot drift apart. The
scene's bar row gained the two values `character-sheet.md` asks to see there — hits per second and
weight with the aspd it costs — and Energy Shield now sits above HP while it is present.

Reading the same card aloud found a defect that had been invisible (D-108): the opening sword carried no weight at all, so §11’s tax never bit minute one and the client swung faster than anything the cages priced. Weighed the way a drop is weighed, the starting piece is 35 against a level-1 capacity of 24 and the lightest main hand in the table is 25 — so no level-1 character carries any weapon untaxed, the cut is about 46% of aspd, and the doc’s 1.3-second first kill is the *untaxed* figure while the carried one is 2.5. The weapon-weight rule moved into `engine/index.js` so the cages and the client call the same function, gate **OP6** measures the carried opening, and `concept.md` now prints both timings. No dial was turned: `K_STR_WEIGHT`, the weapon column’s floor and zone 1’s mob HP are each a published number, so the choice is queued as **A12** for the owner.

Then **a pool can no longer spend what is not standing** (D-109). The incoming split measured the
shield against the sheet’s maximum while the caller subtracted from what was actually left, so a hit
landing on a half-recharged Energy Shield spent it twice, the stored number went under zero, and HP
took less than it should have for damage that had already been paid for. The swing now receives the
live pool and clamps to it — which moves damage between the two pools instead of deleting any — and
every second bounds both pools to what the sheet says they hold, because that is the state the bars
print straight. `game/tests/poolFloors.test.ts` proves a swing cannot spend more shield than stands
and totals the same either way, then reports the lowest shield and lowest mana over 3,000 seconds of
hunting and refuses to pass if the run never spent a pool. The page itself was stepped for 1,400
seconds and printed no minus anywhere: the lowest Energy Shield reading was exactly 0, which is the
case that used to go under.

Then **the two deferred rebalances were measured rather than argued** (D-105 · D-106). Mob skills
were ruled a re-timing of the mob’s own priced damage with no skill list existing to name a window,
so **SV8** bounds the window instead of inventing one: every AFK-reachable shape has to absorb at
least two seconds of its own damage before its target’s pool empties, which is what stops "burst
then gap" from becoming a one-hit kill, and the measured margin prints in the gate. The hit-count
build was promised its value from proc per hit, DoT tick and chill, so the geared driver now dresses
two themes out of **one** hunt — the same drops, the same zone, the bag rebuilt slot by slot around
each build’s own lines and each Stat Mod told the stat that build buys — and credits damage by what
dealt it (`counters.damageBy`: swing · press · status). The reading: the fast-hit build lands at
×0.87 of the big-hit build and carries the larger share of its damage through swings and what swings
leave behind, so the identity holds — and the proc leg itself came out thin, which is the finding
A11 now carries to the owner.

Then **the last withheld number was divided out of two published ones** (D-104): the Gear Mod is the
same school line `tools/loot.js` rolls from `mod_max`, so a full +15 ladder may not out-print one T1
line, and the smallest ceiling ÷ the ladder cap gives one step. The sheet spends it by looking the
school up from the piece’s Base in `bases.json`, so no item carries a copied field and no save needs
a migration; the bench stopped saying “pays nothing yet” and started saying what a step adds.
**X42** recomputes the value from the two ceilings and **SV7** re-runs the level-cap boss against a
full set — the heavy theme loses barely one point of pool, so the G5 promise holds and checks.md H1
is paid at the encounter instead of by moving `mob_HP`, which D-103 had already measured inside the
published pacing. That pass also closed `checks.md` D34: the six buffs and `Haste` are now inside a
measured list share rather than waiting to be hand-priced.

Then **the balance audit ran, and the fold came out as none** (D-103): `game/tests/gearedB1.test.ts`
walks the Road whenever the character outgrows its zone, dresses the bag through the same Equip verb
the button calls, and only then measures the bar empty against the bar full. At the top band the
geared, maxed character kills at 0.96× the rate `loot.md` publishes for that band, so the power
D-094 through D-102 added was already inside the pacing. The list itself measures worth more than the
curve spends, and that cannot also be paid for: writing the measured slope into
`mob.curve.skill_per_level` breaks **X27** and **X37** (the mob-damage table `world.md` publishes) and
**SV6** (the owner’s G5 promise that AFK cannot beat a boss), so it was tried, measured and reverted.
Wearing a piece moved out of `App.svelte` into `game/src/sim/gear.ts` on the way — a rule the panel
held and no test could reach — so the loop can now be dressed by anything that imports the sim, and
`game/tests/gear.test.ts` keeps the no-auto-pick ruling honest.

# Blockers

- (none blocking) The owner's three rulings are in (`harness/decisions.md` D-089): nothing equips
  itself, Element damage is split per Element and countered pool by pool (D-090), and travel is a
  `stay / forward` switch that defaults to staying (D-089).
- (none blocking) The AFK dead end **B17 is closed** by D-087: a kept upgrade is worn at once, so the
  bar rises, the bag fills at 119 min instead of 34, and the Reroll value mint pays in every measured
  hour.

# Hand-off Note

`engine/index.js` is the only place a formula may live; `tools/lib/engine.js` keeps doc read-back
and re-exports the shared values. Adding a stat-bearing Mod line to the client means adding it to
`game/src/sim/player.ts` `PCT_LINE` / `FLAT_LINE`, never to a component.
