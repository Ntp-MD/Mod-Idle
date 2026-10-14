# Do not read unless assigned & if assign and done back to delete clear slate

## Mission

## Feature (Wait User Assign on chat)

- remake passive tree like poe visual and progession like tree


## i'm thinking
- One zone's mobs, but a zone carries more than one sub-zone: how does the gameplay fill that? The idea is to separate them by drop — the gear type each sub-zone leans, e.g. forest 1 pays helmets at a high chance. How does that read?

## Investigation
## Add

## Adjust


## Remove

## Ui

- อาจะต้องออกแบบหน้า crafing เอง
- visual 2.5D player stand on hex , when map mode
- awarness scale ui follow viewport(vw)
- Radial ui
- Wheel ui

Reclassified / reported, not changed
Dungeon escrow "loss" is by design: refused stacks behave exactly like an ordinary refused drop (addTo refuses whole, counters.stopped ticks, the cleared line reports paid amounts). Not a bug.
Owner decisions pending: hardcoded constants in sim/engine (camp regen ×8, auto-brew 30s, control bound 0.15/15s vs caps.stun: null, GROUP_BONUS, tree tier split); respec gated only by a disabled button; repair() revives at from−1 while its comment says otherwise (broken_at dead); DECISIONS' "resistance cap raised only by a tree node" vs the elemental_resistance_cap_pct mod row.
What was actually traced: buildCharacter inputs at every caller + pool clamps; the drop→filter→collector→auto-equip path incl. rings and full-bag; ownership/reservation/recast; the full incoming layer order and DoT clocks; save migration/import; away-clock catch-up; a 12k-tick live soak (tests/soak.test.ts). Wiki prose already matched the corrected rules; wiki/ rebuilt.



You are auditing and repairing ModWorld in:
C:/Users/disda/Desktop/Mod-Idle

Objective
Perform a deep, end-to-end audit of the playable game. Find reproducible gameplay defects, fix them in the same task, and leave the implementation, tests, design rules, and generated wiki consistent. Do not stop after listing findings. Continue until every confirmed issue within scope is fixed and verified, or identify the specific blocker that prevents a fix.

Working rules
1. Follow the repository’s AGENTS.md. Read doc/start/glossary.md before touching game terminology, inspect doc/start/todo.md if it exists, and read only the DECISIONS.md sections relevant to the system being audited.
2. Treat tools/data/ as the source of every gameplay value, engine/ as shared math, game/src/sim/ as runtime behavior, game/src/state/save.ts as save behavior, and game/src/wiki/pages.ts as player-facing prose. wiki/ is generated output; rebuild it rather than editing it directly.
3. The working tree may contain extensive uncommitted changes. Preserve them. Do not reset, overwrite, commit, pull, or push. Inspect the current code before editing and keep each fix narrowly scoped.
4. This prompt authorizes fixes to confirmed bugs and the matching DECISIONS.md updates when a rule changes. Follow AGENTS.md’s remaining ask-first boundaries for dependencies, file or key renames, save-format changes, and shared size-token changes.
5. Do not change balance values merely because a number looks unusual. Establish the intended rule and demonstrate the failure before changing a value or formula.

Audit method
Start by running the existing cages, tests, and typechecks to establish a baseline. Record failures that predate your edits. Then trace each important gameplay flow from its data through the shared engine, runtime simulation, saved state, UI readout, and wiki description. Use deterministic seeds and small, focused reproductions. A passing unit test of an isolated function is insufficient when the reported behavior depends on the full flow.

For each suspected defect:
- State the rule that should apply and identify its source.
- Reproduce the current behavior with a deterministic test, script, or browser flow.
- Distinguish an implementation bug from intended behavior, an incorrect UI readout, stale save data, and stale documentation.
- Fix the cause at the owning layer rather than compensating in the UI or hardcoding a special case.
- Add a regression test that would fail before the fix and verifies the externally observable behavior afterward.
- Check adjacent states and edge cases affected by the fix.
- Remove temporary probes and generated diagnostic files when finished.

Audit these flows in particular

1. Character and equipment state
- Verify that only worn gear, allocated points, passives, active owned skills, and legitimate carried consumables affect the character sheet.
- Verify that equipment waiting in the adventure bag or stash contributes neither stats nor worn-gear bonuses.
- Trace every character statistic from Mod IDs and gear lines through buildCharacter, runtime combat, and the displayed character sheet.
- Check Max HP, Mana, Energy Shield, regeneration, resistance, Evasion, Accuracy, attack speed, weight, capacity, and caps when gear is equipped, replaced, removed, broken, or restored from a save.
- Check that current pools are clamped correctly after maximum-pool changes without silently granting or deleting unrelated resources.

2. Drops, Bag Filter, Auto Equip, and Collector
- Trace a real drop through rolling, Collector evaluation, filter decision, bag capacity, Auto Equip, displaced gear, and any overflow or dissolution.
- Compare a candidate with the correct worn cell. Test the two ring cells separately, including one empty cell and two occupied cells.
- Ensure a bag or stash item does not become the comparison baseline for whether a new drop upgrades worn gear.
- Test the opening set against real low-band drops, not only hand-authored high-value fixtures.
- Verify locked and Broken item behavior, configured equip margin, full bags, dungeon escrow payout, offline drops, and already reserved Collector pieces.
- Ensure Collector reservations do not suppress an upgrade that Auto Equip should wear. Verify the Collector still receives eligible non-upgrades.
- Check that the displayed “better than worn” reading, the Bag Filter, and Auto Equip use one coherent score and explain refusals accurately.

3. Skills, buffs, auras, and ownership
- A first owned skill may have a duplicate count of zero. Audit every ownership check for incorrect truthiness tests.
- Verify fresh versus duplicate drops, active-slot insertion, skill XP, cooldown ladders, and skill-level effects.
- Verify that a newly dropped buff or aura does not activate without the player choosing it.
- Verify that only owned skills can reserve Mana, apply effects, recast buffs, trigger auras, or appear as active effects in the HUD.
- Test buff expiration, automatic recasting while enabled, disabling a buff, persistent auras, reservation limits, and effects after save/load or import.
- Clean up orphaned active toggles from old or malformed saves without changing the save schema or disabling legitimately owned skills that the player intentionally enabled.
- Ensure the UI distinguishes “one owned copy, zero duplicates” from “no skill” and makes the way to disable an active buff or aura clear.

4. Combat and recovery
- Trace an incoming hit through perfect dodge, Evasion, block, Armour, Elemental resistance, damage-taken modifiers, Energy Shield, and HP.
- Test shield overflow on the same hit, including Energy Absorb and a partially filled shield.
- Verify that direct hits and burn use Energy Shield before HP, while poison and bleed DoT reach HP directly, according to current DECISIONS.md.
- Check status application, durations, DoT caps, stun or shock timing, recharge delay, HP/Mana regeneration, Hunger penalties, healing, leech, Push, and Camp recovery.
- Ensure the character sheet’s reported values match values actually used by the tick loop.

5. Progression and persistence
- Test level-up, stat allocation and respec, passive-tree effects, weapon Mastery, presets, crafting, fieldwork, food and Hunger, potions, farming, and dungeon state where they interact with combat or saves.
- Compare online ticks with offline catch-up for deterministic results and intended exceptions. Verify zone floor rules, boss clocks, drops, skill XP, and no double credit after reload.
- Check save migration and import for stale or impossible states without changing the schema unless approval is obtained.

6. Player-facing consistency
- Check whether the UI and wiki describe the behavior the game actually implements.
- Update game/src/wiki/pages.ts when mechanics or displayed rules change, then run npm run wiki.
- If you touch HUD layout or CSS, follow the HUD Layout Studio and sizing rules in AGENTS.md. Reuse the running server on port 3000 if browser verification is needed.

Prioritization
Fix data loss, broken saves, incorrect combat/resource routing, and automatic actions against the player’s choice first. Then fix incorrect calculations and contradictory UI or documentation. Do not spend time on speculative redesign or unrelated balance tuning. If a suspected issue cannot be reproduced, report it as unconfirmed rather than changing code.

Completion criteria
- Every confirmed issue found in this audit is fixed or has a concrete, documented blocker.
- Regression tests cover the failure path, including integration behavior where appropriate.
- Cages pass, the full game test suite passes, root typecheck passes, Svelte check passes, and the wiki is rebuilt.
- No new gameplay constants are hardcoded outside tools/data/.
- No temporary probes remain, and existing uncommitted work is preserved.

Final report
Lead with the outcome. For each confirmed issue, give:
- Symptom and root cause
- What changed and why
- Files changed
- The regression test or reproduction that proves the fix

Then report exact verification results, any pre-existing warnings or pending gates, unresolved or unconfirmed findings, and any behavior that still needs the player’s decision. Do not claim that a system was audited merely because its tests passed; state what was actually traced or exercised.
