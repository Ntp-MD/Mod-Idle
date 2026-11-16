# ModWorld completion plan

Merged from the former code-health and live-card-combat plans on 2026-11-16. Branch: master. English only.

<p id="plan-current" class="meta">Current: closeout (blocked by an unrelated VFX test failure). d2 and p7-4 done 2026-11-16.</p>

> **Direction.** Present the existing real-time fight through player and enemy cards, supported by a small, local map. The simulation keeps ownership of movement, targeting, skill timing, damage and rewards. Cards use simple, readable feedback so every skill does not need a new field VFX asset.

> **Status.** Check an item only after its requirement and checks pass. Checkbox state lives in this file; clicking a rendered box alone does not save progress. Earlier closeout evidence: full suite 2565 passed / 1 explicit skip / 0 failed; 12/12 cages; 9/9 map gates; svelte-check/tsc/lint clean; build OK. Evidence logs are in `.cache/`; completed-item history is in git.

## Owner decisions — code health

- [x] **OD1** — Delete orphaned tools `tools/monster-animation-normalize.py`, `tools/monster-animation-candidate-normalize.py`, `tools/monster-animation-restore-raw.py` and their test files. Default recommendation: delete; compose+qa superseded them. Gates e1. **Answered 2026-11-12: delete (plan default; owner unavailable).**
- [x] **OD2** — Refresh the animation art camera contract from 90° top-down to the code's 33° elevation (`arena-camera.ts:7`). Art-direction change; needs owner/art review. Gates e2. **Answered 2026-11-16: yes (owner).**
- [x] **OD3** — Approve typing work inside the save flow (`game/src/state/save.ts`). Save-flow edits need explicit approval. Gates b4. **Answered 2026-11-16: yes (owner).**
- [x] **OD4** — Promote a raw colour literal to a shared token only when the same value appears in 2+ files; unique scene paint stays component-local. Gates d3. **Answered 2026-11-12: adopt (plan default; owner unavailable).**

## P0 — Owner decisions and scope

- [x] **P0-1 Primary view** — accepted 2026-11-16. Card presentation is the live combat view. The existing rendered arena remains available to the player. The arena simulation stays authoritative in both views.
- [x] **P0-2 10 m visibility rule** — accepted 2026-11-16. The strict `< 10 m` filter applies to both enemy cards and the local map. It is presentation-only: no change to spawning, engagement, range or combat results.
- [x] **P0-3 Control design** — accepted 2026-11-16. Keep auto combat, WASD, skill-slot shortcuts, target focus and all existing commands, including commands beyond the local map. Add enemy selection on cards and the local map, plus local-map ground aiming and movement through the existing command handlers.
- [x] **P0-4 Off-view combat** — accepted 2026-11-16. Keep the existing combat history and add a generic out-of-view cue for real actions involving a hidden enemy. Show no card or distance for that enemy. Do not change the simulation to make the display simpler.
- [x] **P0-5** — Decisions above were accepted by the owner on 2026-11-16 and later criteria match them. Any unresolved behavior, balance, RNG-order or UX decision still stops work at that item for an owner answer.

## b4 — Type save.ts

- [x] Owner approval recorded in OD3 (2026-11-16).
- [x] 74 type-position `any` replaced with local DTO types; 4 prose words remain in comments. Transpile output and RNG/migration order unchanged. `TEMP_DISABLE_SLOT_SAVES` and `SCHEMA_VERSION` untouched.
- [x] `npx tsc --noEmit -p tsconfig.json` clean.
- [x] `npm exec vitest run tests/app/save-fidelity.test.ts tests/app/save-storage.test.ts` — 2 files / 77 tests passed (2026-11-16).

## c1 — Extract the DEV showcase shell from App.svelte

- [x] Move the `showcase-frame` markup, preview controls and their styles into a DEV-only component under `game/src/ui/dev/`; App keeps the boot gate and sample wiring only. No gameplay module changes.
- [x] Showcase samples and fixtures stay in `game/src/app/showcase/`; production bundle must not gain showcase code.
- [x] Focused showcase/UI tests, check and build green; browser pass at 1920×1080 recorded.

Evidence from 2026-11-12: controls moved to `game/src/ui/dev/showcase/ArenaPreviewControls.svelte` and `CombatFxPreviewControls.svelte`. Browser pass in headless Chrome (`game/.cache/showcase-after-field.png`, `showcase-after-fx.png`): banner, both control bars, focus/aim/skill/VFX selects, replay and animate toggle work; 0 console errors. Main JS 3,098.56 kB before / 3,098.63 kB after; showcase strings were already in the baseline bundle.

## d1 — Deduplicate reusable CSS rule bodies

- [x] Batch: TownHub `.qrow span` and ItemDetail `.section-heading p` now use shared `.text-note`; GearCare's duplicated table-head paint removed. Layout families stay component-local.
- [x] `npm run css:audit` 64 → 63 exact duplicate bodies.
- [x] `npm --prefix game run check` — 0 errors.
- [x] Five focused UI/town test files / 32 tests passed.
- [x] Headless 1920×1080 DOM check recorded 0 console errors and matching computed colour/font for the three edited selectors.

Earlier evidence from 2026-11-12: audit 66 → 64; shared `.text-note` and `.text-heading` promoted; UI suite 508 passed / 1 skipped; check and build green; showcase screenshots recorded.

## d2 — Resolve skins.css class-name collisions

- [x] Batch: moved the only-mount beat definitions `--orb-cycle` from `skins.css` `.life-orb`/`.mana-orb` into `App.svelte`, where those orbs are mounted. `skins.css` keeps the shared `.orb-energy` paint that consumes the inherited variable. No visual change intended.
- [x] `npm run css:audit` collision count 109 → 107; `npm --prefix game run check` 0 errors; 3 focused UI/component test files / 27 tests passed.

Earlier attempt 2026-11-16: SlotGrid's local `.empty` → `.vacant` did not drop the count because `.empty` is still shared by `skins.css` and SkillsWorkbench. Headless 1920×1080 browser pass on the live game after the orb change: both orbs present, inherited `--orb-cycle` reads `calc(650ms * 20)` and `calc(650ms * 12)`, 0 console errors.

## e1 — Remove orphaned animation tools

- [x] OD1 answer recorded.
- [x] Delete the approved scripts and any tests that exist only for them; update doc references.
- [x] Remaining animation tooling self-tests green; link check clean.

Evidence from 2026-11-12: three scripts plus `tools/test-monster-animation-candidate-normalize.py` deleted; compose 11/11, QA 17/17; `npm run verify` 12/12 cages PASS.

## e2 — Refresh the animation camera contract

- [x] OD2 answer recorded 2026-11-16 (owner approved).
- [x] README and base-prompt now state 33°, `d = sin33° ≈ 0.5446`, matrix `[[140,0],[0,76.2495]]`; derived angles and 8 sector centres recomputed from `arenaScreenAngleFor` / `arenaFacingIndex`; upright-sprite guidance and Thai voice preserved.
- [x] Grep confirms no stale 45.92° values; links resolve except a pre-existing missing harpy reference at README:16 (not introduced here).

## P1 — Preserve the live combat contract

Shared owners recorded 2026-11-16: fixed step and pause/speed bank — `game/src/app/loop.ts` (`createGameLoop`, `LIVE_STEP_MS`, `startWakeLoop`); authoritative fight, positions, vitals, targets and distance — `game/src/sim/combat/combat-arena.ts` (`createCombatArena`, `arenaDistance`, `arenaTarget`, `captureCombatArena`); deterministic intra-tick event order — `game/src/sim/combat/combat-clock.ts`; cast/hit facts — `game/src/sim/core/tick/cast-trigger.ts` and `FxEvent` in `game/src/sim/core/types.ts`; presentation playhead — `game/src/ui/combat/combat-arena-view.ts` (`createArenaPlaybackClock`, `arenaPlaybackTime`) with frames from `sampleCombatArena`; manual commands — `App.svelte` (`focusArenaEnemy`, `castArenaSlot`, `issueArenaGroundCommand`, WASD handlers). Cards and local map read these; neither writes them.

- [x] Trace the existing arena simulation, fixed-step loop, playback clock, frame sampling, FX events and manual commands. Shared owners recorded above.
- [x] One authoritative fight: `LiveCombatCards` and `NearbyFieldMap` read `combatArena`'s sampled frame and `FxEvent` ring only; no second arena, clock, damage roll or target selection was added. The `< 10 m` helper never mutates the group.
- [x] One playhead: `CombatArenaScene` emits its sampled frame through `onFrame`; cards and local map read `arenaCardFrame.atUs`. Pause/speed/delayed-frame behaviour stays in the existing `createArenaPlaybackClock`; the new views add no timer or animation clock.
- [x] No sim module, data file or command path changed for the display filter; movement, targeting, geometry, RNG, drops, dungeon and offline behaviour keep their existing owners.
- [x] Mob skills and slot saves stay disabled; no save-flow file was changed here (b4 was separately owner-approved). No audio added.

Starting points: [live loop](../../game/src/app/loop.ts), [arena state and targeting](../../game/src/sim/combat/combat-arena.ts), [arena playback](../../game/src/ui/combat/combat-arena-view.ts), [cast and hit events](../../game/src/sim/core/tick/cast-trigger.ts).

## P2 — A readable card battle

- [x] Cards reuse `Meter`, `SkillCastCue`, `Icon`/PNG icons, shared skins and the existing `PlayerVitalCard` (with `showActor={false}` so the arena stays the only body renderer). Identity, sampled HP, status chips and a focused state are shown.
- [x] Cards mount in the existing `field` HUD region while `arenaMode` stays on; arena scene, skill bar and command handlers are unchanged. No second arena renderer was added.
- [x] Cards and markers are keyed by `mob.id` and follow `gameState.group` order; a focused test asserts order stays stable as distances change.
- [x] The card list is a bounded `scroll-pane`; no qualifying body is dropped by the layout. Existing HUD layout and saved-layout IDs are untouched.
- [x] Empty state shown at town/no targets; dead or absent actors are filtered from the sampled frame, and `syncArenaFocus` still releases a dead pin. Panels veil the whole stage as before.

## P3 — Nearby map and the 10 m boundary

- [x] `NearbyFieldMap` is a north-up DOM view inside the Journey dock, beside the world-map controls. `WorldMap` and its hex renderer are untouched.
- [x] Player marker is centred; mob markers come from the same sampled frame and `arenaDistance`, filtered strictly `< 10 m` on the unrounded value. Only current-field actors are used.
- [x] Each marker's accessible name carries `nearbyDistanceLabel`; 9.96 m renders as `< 10 m`, never `10.0 m`. Tests cover the boundary. Skill range/LOS checks remain the sim's.
- [x] Markers use real relative positions and are buttons; the card list is the accessible selection alternative for dense groups. Overlap never moves a marker.
- [x] The same filter applies to cards and map; a hidden body remains in combat. No visibility rule touches spawn/engagement/range. Tidal Wave and area effects keep their authored rules.
- [x] Existing PNG `mobIcon`/`characterIcon` and HUD tokens/skins are used. No new HUD region was added, so no layout migration/backfill was needed; world-map keyboard and command ownership unchanged.

## P4 — Skill presentation that follows the result

- [x] Cards reuse `SkillCastCue` for the real skill name and add a phase read from the action's own timing (approach / windup / release / recovery / canceled). The existing swing windup bar stays.
- [x] Delivery cues stay in the arena scene and shared `FxEvent`/icon systems; cards add only compact text/status reads. No new sprite sheets.
- [x] Card HP and the impact flash key come from the sampled actor and real `hit` events; a cancelled action renders "canceled", and block words are shown as defence receipts, never damage.
- [x] Cards highlight only bodies in the sampled frame; area/chain/multi-hit facts stay with the arena's resolved receipts. Off-view actions use the generic P0 cue.
- [x] Cards honour the shared effect level (`calm` suppresses the impact flash) and `prefers-reduced-motion`; `SkillCastCue` already follows the project's reduced/minimal rules.

> **Worked example.** Fireball has a 5 m cast range in [skills data](../../tools/data/skills.json). With a target at 4.3 m, show the actual windup, release and projectile cue; flash the target card and show damage only when the hit resolves. At 7 m, show the existing approach or out-of-range state instead. For Firestorm, use its actual target area and resolved impacts, not every card that happens to be nearby.

## P5 — Interaction and accessibility

- [x] Card and marker selection call the existing `focusArenaEnemy`; skill-slot input and eligibility messaging stay in the existing bar. Focus state is shown with `aria-pressed` and a visible mark.
- [x] Local-map ground clicks call `issueArenaGroundCommand`, which preserves the armed aim vs walk decision and all existing keyboard aim/channel commands. Beyond-10 m commands stay on the existing controls per P0.
- [x] Cards, markers and Inspect are native buttons with names and visible focus; the local map adds no arrow/Enter handler, so world-map navigation is unchanged. The off-view cue is a single `role="status"` line.
- [x] Local-map clicks are scoped to its own element and only issue arena ground orders; world map, panels, character sheet and HUD controls remain as they were.

## P6 — Showcase and implementation review

- [x] The existing DEV-only `combat-field` sample now drives the same production cards and the same `CombatArenaScene`/fixture fight; no second renderer or gameplay branch was added to the showcase shell.
- [x] Browser check showed three nearby cards with 4.9/5.1 m reads; unit cases cover several targets, 9.999 m vs 10 m, dead/absent actors and off-view cues. Existing showcase controls replay the same fight for impact/area review.
- [x] One `onFrame` sample feeds both views; no second arena or FX ring was added. 1920×1080 showcase snapshot showed cards, arena, target bar, skill bar and HUD layout studio together with 0 console errors.

## P7 — Verification

- [x] `tests/ui/nearby-field.test.ts` covers strict `< 10 m`, 9.999 m rounding, group-order identity, dead/absent actors and off-view cues; 5/5 passed.
- [ ] Fast suite blocked by the unrelated VFX failure described under Closeout; `npm --prefix game run check` is green. Map files and command ownership were not changed, so map gates were not triggered.
- [x] Headless 1920×1080 showcase check: three nearby cards, arena, target bar, skill bar, HUD studio; 0 console errors. Live-game check: cards empty-state and nearby-map shell render in the Journey dock; 0 console errors. Browser closed after each check.
- [x] Busy-encounter check recorded 2026-11-16: headless 1920×1080 DEV field sample reached 10 nearby cards and 10 markers; repeated local casts ran for 5 s. Evaluate round-trip latency over 43 samples: avg 3.1 ms, p50 3 ms, p95 4 ms, max 10 ms. Body MutationObserver over 4 s: 97 mutations (24.3/s). Console 0 errors. One `onFrame` sample fed both views; no duplicate cards or markers. **Limitation:** the headless page reports `document.hidden = true`, so `requestAnimationFrame` and CDP sessions are unavailable; latency and mutation counts are proxies, not a frame-time profile.

## Closeout

Stopped 2026-11-16 at stop condition 3: `npm --prefix game run test:fast` failed one unrelated test, `tests/ui/vfx-catalog.test.ts` (`attack.fireball: expected [] to have a length of 1`). The working tree has an in-flight VFX asset swap (deleted sheet PNGs / rewritten meta.json / new untracked sheets); no VFX input was changed by this plan. Do not weaken the assertion.

- [ ] Full suite once (`npm --prefix game run test`), `npm run check`, `npm run verify`, `npm run map:check`, build, `git diff --check`.
- [ ] Record final css:audit numbers against the baseline (66 duplicates / 108 collisions / raw-literal counts).
- [ ] Record actual commands and results in this file; stop on any unexplained failure instead of weakening a check.

## Manual sign-off (human eyes — not agent checkboxes)

- Map sheet visuals after the a1 `--dim` fix (dim tone unchanged where intended).
- Showcase field presets at 1920×1080 after c1.
- Visual parity per CSS batch (d1–d3).
- Art contract refresh review (e2) before new atlas generation.
- At 1920 × 1080, the cards, nearby map and world map read as one coherent game screen and important combat remains easy to follow.
- Skill identity and impact feel satisfying without depending on detailed field VFX; inspect melee, projectile, area, self and sustained actions.
- A crowded or fast encounter remains readable and the 10 m boundary does not feel distracting. Human visual judgment stays open independently of mechanical test results.
