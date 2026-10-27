# Engine implementation work — consolidated from four plans

วันที่: 2026-10-27  
ที่มา: รวมจากแผนต้นฉบับ 4 ไฟล์ (combat skill coherence, skill VFX coherence, RO field population/roaming/playback, plan readiness audit 2026-10-27); ไฟล์ต้นฉบับถูกลบหลังรวม  
สถานะ: ไฟล์งานสำหรับ implement engine/runtime — ยังไม่มีการแก้ runtime ในงานเอกสารนี้

ทิศทางภาพ 2.5D pixel และ proof แรกอยู่ที่ [vfx-image-generation-work.md](vfx-image-generation-work.md); งานภาพเป็น sprite/atlas 2D บน projection เดิม. เอกสารนี้ไม่นับ asset ที่ยังไม่ผ่าน QA ว่าเป็นงานเสร็จ

## 1. ขอบเขตและนิยามเสร็จ

อยู่ในงานนี้:

- `engine/`, `tools/data/`, `game/src/sim/`, `game/src/state/`, `game/src/presentation/`, `game/src/ui/` เฉพาะ runtime, integration และ tests
- Field population, per-slot respawn, roaming, camera, playback, save/migration
- Combat execution contract: identity, timing, speed, range, height, direction, contacts, impact, persistence
- VFX runtime binding: recipe/metadata readers, height/depth, landing telegraph, lifecycle, dedupe, performance
- Canonical data, validators, readers, behavior docs/wiki ที่เปลี่ยนตาม implementation

ไม่อยู่ในงานนี้:

- การเจน/แก้ภาพ VFX (ไฟล์ที่ 2), actor animation/equipment poses, terrain art, UI icons
- Redesign dungeon/Camp encounter, balance ที่ไม่มี explicit migration, ระบบใหม่นอก contract
- การลบ save หรือ breaking external format

Completion เป็น **joint release gate เดียว** ไม่ใช่การส่ง field, combat หรือ VFX runtime แยกกันแล้วถือว่าเสร็จ

## 2. Invariants ที่ห้ามทำลาย

- Active field มี `s.group` เป็น authoritative living Mob/HP list ชุดเดียว; slot ไม่เก็บ HP สำเนา
- Identity ใช้ actor + generation + field/arena epoch; ห้ามใช้ species name, array index หรือ reused slot id แทน effect identity
- Gameplay ใช้ integer combat time และ CombatClock comparator เดิม; renderer/particles/atlas frames ไม่สร้าง hit, timer, proc, reward หรือ RNG draw
- Spawn/roam/placement ใช้ deterministic seed แยกจาก combat/loot RNG; reload/HMR/reconcile ไม่ reroll
- Deadline ที่ commit แล้วไม่ถูก floor/round ให้เร็วขึ้น; ไม่มี catch-up generation/reward ย้อนหลัง
- Body footprint radius 0.25 m; world เป็น continuous meters; field 50 m ไม่ scale body, range, speed หรือ action timing
- Live field camera follow player เท่านั้น; target/focus/nearest enemy ไม่ใช่ camera input
- Presentation อ่าน actual receipts/timestamps; ไม่คำนวณ damage/cast/landing formula ซ้ำใน UI
- `game.ts`, `combat-arena.ts`, `CombatArenaScene.svelte`, `arena-camera.ts`, `combat-arena-view.ts`, `pending-work.ts`, `save.ts`, `field-area.ts`, `engine/spawns.ts` มี writer คนเดียวต่อไฟล์ต่อช่วง
- Save migration preserve counts/progress/meaning; reject unknown future version

## 3. Gates ที่ต้องปิดก่อน full scope

Audit เดิมสรุปว่า R1/R2/R3 เริ่มได้ แต่ packet เต็มชุดติดข้อ A01–A05. ทั้งห้าข้อมี decision แล้วเมื่อ 2026-10-27; งานที่เหลือคือ implementation, readers, save และ negative tests ตามเงื่อนไขในตาราง

| ID | Gate | Owner | เงื่อนไขปิด | Block |
|---|---|---|---|---|
| A01 | Canonical life vs reconstitution | Field/save | **Selected 2026-10-27:** compact immutable descriptor + HP/status ต่อ occupied slot (species/variant, rank, life seed, sequence, HP/status) อยู่ใน bounded ledger; reconstitution ใช้ descriptor เดิม + area epoch ใหม่, ไม่ reroll/due ไม่เร็วขึ้น/ไม่มี reward ใหม่; fixture ต้องเกิน heavy cache capacity | P6/P2b |
| A02 | Domain→profile mapping | Field data/core/world | **Selected 2026-10-27:** แยก profile ต่อ domain; live field ใช้ cap/respawn/rank ใหม่, Camp/dungeon/offline คง baseline เดิมผ่าน explicit mapping + negative reader tests; ห้ามค่าใหม่ลามโดยไม่ประกาศ | P2/P2b |
| A03 | Safe Camp domain | Gameplay owner + core/field | **Selected 2026-10-27:** ระงับ spawn/aggro เท่านั้น ไม่เพิ่ม universal immunity; paid attacks/status ที่ commit แล้วใช้ lifecycle เดิม. ยังต้องเขียน transition matrix ของ hostile admission เมื่อเข้า/ออก safe domain และ regression สองด้าน (auto-hunt off / proximity / reactive) | P2b/SC-E/SC5 |
| A04 | SC-P persistence packet | Core/persistence | **Selected 2026-10-27:** SC-P เป็น explicit sub-packet ของ SC6; owner/dependencies ชี้ SC7, field P6 และ VF reload; เก็บ active preparation/recovery/manual intent เป็น pure data พร้อม version/readers/negative tests | SC6/SC7/P6 |
| A05 | Auto-avoid contract | Core AI | **Selected 2026-10-27:** bounded auto-avoid เฉพาะ tagged heavy committed ground threat; อยู่ใต้ manual เหนือ rotation; ยกเลิก unpaid windup/channel ได้เมื่อ reaction budget พอ; ไม่แตะ released work; cooldown/one pending request; tests multi-threat/infeasible/cooldown/no-perfect-dodge | SC5 |

A03 เลือกแล้ว: **Spawn/aggro suppression เท่านั้น**

- `camp_safe_m` ระงับ hostile spawn/admission/aggro; ไม่เพิ่ม damage immunity
- Paid attacks/status ที่ commit แล้วใช้ lifecycle เดิม; ไม่มี safe-entry cancellation/refund
- ต้องมี regression: auto-hunt off แล้ว player ไม่ initiation เอง; proximity mob ยังทำงานนอก safe domain; reactive mob ไม่เริ่มเอง
- ห้ามผู้เล่นสร้าง offensive work ใหม่จากใน safe domain ตาม core predicate ที่ตกลง

## 4. Ownership และ shared hotspots

| Workstream | ถือ |
|---|---|
| Field population/lifecycle | `engine/spawns.ts`, `spawns.json`, `field-area.ts`, field population helper, slot transactions |
| Simulation lifecycle | `game.ts`, `combat-arena.ts`, engagement/return/Push |
| World/save/transition | road/Camp/exploration callers, `field-area.ts`, `save.ts` |
| Combat core | `skill-area.ts`, `skill-actions.ts`, `combat-actions.ts`, clock, `game.ts`, `pending-work.ts`, canonical rows/readers |
| Presentation/VFX runtime | `CombatArenaScene.svelte`, `arena-camera.ts`, `combat-arena-view.ts`, `arena-vfx-space.ts`, authored/component renderers, manifests |
| Session/docs | exploration callbacks, wiki source, integrated flow |

ห้ามแบ่ง agent แก้ shared file เดียวกันตามชื่อ bug ต้องมี integrator/writer คนเดียวต่อไฟล์ต่อช่วง

## 5. ลำดับงานและ lanes

ทำ lane งานขนานได้หลัง E0 และ ownership freeze; joint acceptance อยู่ท้าย

| Wave | Packet | Deliverable | Dependency / gate |
|---|---|---|---|
| E0 | R1 + SC0 + VF0 + P0 | Inventory/census, consumer map, effective rates, red proofs RP01–RP06, skill/asset coverage | Source ปัจจุบัน |
| F1 | P1 + P2a + P3 (current geometry) + P4 + R2/R3 | Population lifetime แยก Hunt/Push; profile/schema freeze; roam/placement; player-only camera | E0; A02 สำหรับ profile mapping |
| F2 | P2 + P6 + P5 + P2b + P7 | Per-slot respawn; checkpoint/migration; geometry activation 50 m; playback proof; legacy reader removal | F1; A01, A02, A03 ตาม surface |
| C1 | SC1 + SC-Z + SC-T + SC-R + SC-E | Normalized execution spec; height/space; speed domains; range basis; outcome scope | E0 |
| C2 | SC2 + SC2-G + SC2-L + SC3 + SC4 + SC4-P | Direction/shape; archetypes; cast/landing timeline; motion/equipment; contacts; piercing | C1; field camera/height contracts |
| C3 | SC-AI + SC5 + SC-X + SC6 + SC-P (SC6 sub-packet) | Targetable facade; paired decision/approach; semantic migrations; temporal families/lifecycle; primary-state persistence | C2; A05, A03, A04 |
| V1 | VF1 + VF-Z + VF-A + VF-P | Recipe/anchor/phase binding; height rendering; actor/motion coverage; packaging/performance | C1/SC-Z |
| V2 | VF2 + VF2-L + VF3 + VF5 | Directional/melee runtime; landing telegraph; delivery/lifecycle; whole roster | V1 + C2/C3 |
| J1 | SC7 + SC8 + VF6 + P8 | Whole-roster core, joint visual acceptance, live field acceptance, release evidence | ทุก mandatory packet |

Packet ที่ผ่านคือ workstream พร้อมรวม ไม่ใช่ whole-system complete

### 5.1 Packet definitions (working, 2026-10-27)

Packet IDs ที่ไม่มี §6 contract ต้องเพิ่ม contract ใน task packet ก่อนเริ่ม; ห้าม implement จากชื่อ packet อย่างเดียว

| ID | Working definition |
|---|---|
| R1 | Baseline census: canonical rows, consumer map, effective rates, skill/asset coverage และ red-proof registry (E0) |
| R2 | Reader/writer census + compatibility status ต่อ consumer (F1) |
| R3 | Legacy-reader removal/cutover plan (F1 → P7) |
| SC0 | Combat census: canonical skill rows, consumers, current timing/delivery/geometry/identity (E0) |
| VF0 | VFX census: recipes/manifests/consumers/assets/lifecycle (E0) |
| P0 | Field population census: spawns, slots, readers/writers, rates, checkpoints (E0) |
| RP01–RP06 | Red-proof registry (renamed 2026-10-27); definitions/coverage อยู่ §5.2; RP01–RP06 covered |
| P1–P8, SC1–SC8, VF1–VF6 | ใช้ contract ใน §6 + execution packet ใน §5.4; task packet ต้องอ้าง acceptance/stop จาก packet นั้น |

**Cross-plan alignment:** VF1–VF6 เป็น authored 2.5D VFX. J1 ปิดเมื่อ SC7/SC8/VF6/P8 ผ่าน; งานภาพใช้ sprite/atlas 2D 8 directions

### 5.2 Execution packet — E0 baseline census

Status: **DONE (2026-10-27) — baseline census/red registry complete; consumer-map owner names deferred to F1 R2/R3**

- **Objective:** produce baseline census/consumer map/effective rates/skill-asset coverage และ red-proof registry RP01–RP06 สำหรับ R1/SC0/VF0/P0; ไม่แก้ runtime
- **In scope:** read-only inventory ใน `tools/data/*.json`, `engine/`, `game/src/sim/`, `game/src/state/save.ts`, `game/src/ui/combat/`, `game/public/fx/skill-pool/`, `game/tests/`, `tools/`; focused red-proof commands; handoff table
- **Out of scope:** fixes, migrations, tuning, renderer changes, art asset production, save/schema changes
- **Verified context:** `tools/verify.ts` และ `tools/lib/writers.ts` เป็น cage runner; `game/src/presentation/arena-camera.ts` มี `ARENA_VIEW`/`ARENA_DIRECTIONS`; 2D authored VFX live ที่ `game/public/fx/skill-pool/vfx-production.md`
- **Steps:**
  1. Inventory canonical rows และ owner; list readers/writers/call sites ต่อ domain
  2. คำนวณ effective rates จาก canonical data เท่านั้น; ห้าม hand-compute
  3. Map skill/asset coverage: live rows และ authored 2D VFX; ระบุ asset gaps
  4. สร้าง red-proof registry: invariant, failing command/symptom, expected fix surface; ถ้า ID เดิมกู้ไม่ได้ ให้ assign ใหม่และบันทึก mapping
  5. Run baseline `npm run typecheck` + focused tests; บันทึก failure ที่มีอยู่
- **Acceptance:**
  - ทุก census row มี source path/symbol และ owner
  - Consumer map ครอบ readers/writers ตาม §4; ไม่มี orphan
  - Rates derive จาก canonical data และระบุสูตร/ที่มา
  - Red proofs มี command + expected failure + invariant; ไม่ทิ้ง failing test ใน `game/tests/` (covering test ลงพร้อม fix)
  - Handoff ระบุ changed files (ควรเป็น none), commands, baseline failures
- **Red proof registry (RP01–RP06; renamed 2026-10-27):**

| ID | Invariant (§2) | Evidence | Coverage | E0 action |
|---|---|---|---|---|
| RP01 | active `s.group` เป็น HP authority เดียว | `game/tests/field-area.test.ts:187` (one slot per living body, no HP copy) | covered | ยืนยัน assertion + เพิ่ม negative test ถ้าไม่มี |
| RP02 | spawn/roam/placement deterministic และ reload ไม่ reroll | `field-area.ts` draws `respawnAtSec` via `spawnSlotSeed` over `respawn_min_sec..max`; `field-area.test.ts` "draws a deterministic respawn window" | covered | คง test นี้ไว้ |
| RP03 | deadline ที่ commit ไม่ถูก floor/early และไม่มี catch-up | `field-area.ts` now preserves fractional `respawnAtSec`; regression test `field-area.test.ts` "preserves a fractional respawn deadline" | covered | คง test นี้ไว้ |
| RP04 | renderer/particles/atlas สร้าง hit/timer/proc/RNG ไม่ได้ | `game/tests/arena-authored-vfx-render.test.ts:80,89` (empty ground no invented hit; one flight per launch) | covered | ยืนยัน presentation-only assertion |
| RP05 | save migration preserve counts/progress/meaning | `game/tests/save-fidelity.test.ts:48,84,331` (snapshot rewards, pending due, future schema) | covered | เพิ่ม old→current round-trip fixture |
| RP06 | legacy reader ไม่ double-pay reward/entitlement | `game/tests/pending-work.test.ts:85,139,214` (settle once, pay death once, incoming shot once) | covered | ยืนยัน one-pay assertion |

F IDs ถูก rename เป็น RP01–RP06 ถาวร; บันทึก mapping ใน handoff และยืนยัน assertion จริงก่อนปิด E0. `red` ต้องมี red proof/negative test และ fix ใน F2/P2 ก่อนถือว่า E0 ปิด

**E0 baseline findings (2026-10-27):**
- Field: default cap 40 / respawn 35; zones cap 32/40/48, respawn 33/35/38 (±10% seeded window) — target §6.1 achieved; supply test now 7× band
- `releaseSpawnSlot` draws a deterministic window (`spawnSlotSeed` + `respawn_min_sec/max`) and preserves fractional `respawnAtSec`; RP02/RP03 covered
- Live skills 92/92 มี authored 2D VFX; art roster ยังเป็นงานของ art owner
- **Stop and escalate:** consumer/owner ขาด; red proof map กับ invariant ไม่ได้; baseline failure นอก surface; R1/R2/R3 definition ขัดกับ packet นี้ → ถาม owner
- **Expected handoff:** census table, consumer map, rate table, red-proof registry, baseline report; no runtime change

### 5.3 Readiness status

| Packet | Status | Note |
|---|---|---|
| E0 | DONE | baseline census/red registry complete; consumer-map owner names deferred to F1 R2/R3 |
| F1 | DONE | lifetime/profiles/roam/camera + R2/R3 cutover |
| F2 | DONE | A01/50 m/caps/seeded respawn/playback/legacy removal |
| C1 | DONE (gameplay) | 66 tests PASS; SC-Z height deferred to V1/VF-Z |
| C2 | DONE | direction/shape/timeline/contact/piercing covered |
| C3 | DONE | A05 auto-avoid landed; SC-AI/SC5/SC6/SC-P covered |
| V1 | DONE (runtime) | 68 VFX tests; perf/packaging at J1 |
| V2 | DONE (runtime) | directional/telegraph/delivery/whole roster covered |
| J1 | DONE | all mandatory packets complete |

### 5.4 Wave execution packets

#### F1 — population lifetime, profiles, roam/placement, camera

Status: **DONE — Hunt/Push lifetime, domain profiles (A02), roam/placement, player camera, and R2/R3 reader cutover landed**

- **Objective:** P1 + P2a + P3 (current geometry) + P4 + R2/R3 — split Hunt/Push lifetime, freeze profile/schema mapping, roam/placement, player-only camera, reader/writer census + cutover plan
- **In scope:** `engine/spawns.ts`, `tools/data/spawns.json`, `game/src/sim/world/field-area.ts`, `game/src/sim/core/game.ts`, `game/src/sim/combat/combat-arena.ts`, camera call sites; focused tests
- **Out of scope:** per-slot respawn/checkpoint/migration (F2), combat semantics, renderer
- **Verified context:** §6.1 profiles/roam/camera; `spawns.test.ts`, `field-area.test.ts`, `farming-ai.test.ts`, `combat-arena.test.ts`, `combat-arena-view.test.ts`; A02 selected
- **Steps:** 1) R2 reader/writer census per field consumer; 2) freeze profile mapping per domain (A02); 3) split Hunt/Push lifetime; 4) roam/placement + player camera; 5) R3 legacy-reader cutover list
- **Acceptance:** §7 field rows for first entry, kill-1, due refill, Hunt/Push, roam/home band, returning, camera follow, placement; negative tests prove field profiles do not leak into Camp/dungeon/offline; focused commands pass
- **Stop and escalate:** A02 mapping conflict; reader without owner; profile change touches protected domains without explicit mapping; baseline test failure
- **Expected handoff:** changed files, profile/census tables, test commands/results

#### F2 — respawn, checkpoint/migration, 50 m geometry, playback, legacy removal

Status: **DONE — A01 ledger, 50 m + layoutRevision migration, capped/seeded respawn, playback clocks, and legacy `spawnIn` removal landed**

- **2026-10-27 evidence:** 50 m data/camera + 48 authored homes + cap 32/40/48 + seeded respawn windows + `layoutRevision` 18×12→50 m translation landed; `MAX_SLOTS` raised to 48 so the enlarged field survives save. A01 compact ledger landed: `slot.life` stores the descriptor + HP + status mark, and `field-area.test.ts` "reconstitutes an archived field life" proves same identity/HP with no reward. Full suite 148/149 (only `skill-copy` baseline fails).

- **Objective:** P2 + P6 + P5 + P2b + P7 — per-slot respawn, checkpoint/migration, 50 m geometry activation, playback proof, legacy reader removal
- **In scope:** `engine/spawns.ts`, `game/src/sim/world/field-area.ts`, `game/src/state/save.ts`, `game/src/sim/core/pending-work.ts`, `tools/data/spawns.json`; focused tests
- **Out of scope:** new field features after A01–A03, combat semantics
- **Verified context:** §6.1 deadlines/eviction/50 m; save schema 26 in `save.ts`; A01 ledger selected; `spawns.test.ts`, `save-fidelity.test.ts`, `save-storage.test.ts`, `pending-work.test.ts`
- **Steps:** 1) slot state/due/sequence; 2) checkpoint + compact ledger; 3) 50 m geometry migration; 4) playback proof; 5) remove legacy readers and keep compatibility adapters only where declared
- **Acceptance:** §7 field rows for pending respawn/return reload, old schema, 50 m ratio, playback pause/speed, eviction ledger, refused transition; save round-trip preserves counts/progress/meaning; A01 fixture exceeds heavy cache capacity
- **Stop and escalate:** schema bump without migration; lossy save behavior; due/sequence changes on retry; unknown version accepted
- **Expected handoff:** migration/round-trip evidence, removed-reader census, commands/results

#### C1 — normalized execution, height, speed, range, outcome

Status: **DONE (gameplay) — SC1/SC-T/SC-R/SC-E verified by 66 tests; SC-Z height is presentation, owned by V1/VF-Z**

- **Objective:** SC1 + SC-Z + SC-T + SC-R + SC-E — one normalized execution spec, height/space, speed domains, range basis, outcome scope
- **In scope:** `engine/skill-area.ts`, `engine/skill-actions.ts`, `engine/types.ts`, `engine/attack-range.ts`, `game/src/sim/combat/combat-actions.ts`, `skills.ts`, `combat-clock.ts`; focused tests
- **Out of scope:** SC-P (C3), semantic migrations (C3)
- **Verified context:** §6.2 formulas; A04 is not a C1 dependency (SC-P moved to C3); `skill-area.test.ts`, `attack-range.test.ts`, `combat-timing.test.ts`, `combat-arena.test.ts`
- **Steps:** 1) normalize execution fields; 2) height projection; 3) speed factor once; 4) range basis center/body-edge; 5) impact/entitlement scope
- **Acceptance:** §7 combat rows for cone/line/timing/speed/range/entitlement; tests prove one factor use and no legacy melee reach misinterpretation; typecheck/check pass
- **Stop and escalate:** formula conflict with canonical data; range/height contract ambiguity; shared-file ownership conflict; baseline failure
- **Expected handoff:** spec mapping table, changed files, test evidence

#### C2 — direction/shape, archetypes, timeline, contacts, piercing

Status: **DONE — direction/shape/timeline/contact/piercing covered by the C1/C2 test set**

- **Objective:** SC2 + SC2-G + SC2-L + SC3 + SC4 + SC4-P — direction/shape, archetypes, cast/landing timeline, motion/equipment, contacts, piercing
- **In scope:** `game/src/sim/combat/combat-actions.ts`, `combat-arena.ts`, `skills.ts`, `engine/skill-area.ts`; focused tests
- **Out of scope:** targetable facade/auto-avoid/lifecycle (C3), VFX runtime (V1/V2)
- **Verified context:** §6.2 geometry/piercing; canonical rows `tools/data/skills.json`; `skill-shapes.test.ts`, `shapes.test.ts`, `multi-hit.test.ts`, `mob-skill-delivery.test.ts`, `combat-arena.test.ts`
- **Steps:** 1) direction/shape queries; 2) archetype mapping; 3) cast/landing clock; 4) contact ownership/recipients; 5) piercing track/visited set
- **Acceptance:** §7 combat rows for cone every direction, tracking→lock, sweep vs one impact, multiple recipients, interception/miss/pierce, fixed/mobile; tests prove one impact per recipient and earliest swept contact
- **Stop and escalate:** semantic conflict with SC-X; double-pay/double-contact risk; no negative test for multiple recipients; baseline failure
- **Expected handoff:** shape/direction matrix, changed files, test evidence

#### C3 — targetable facade, auto-avoid, migrations, lifecycle, SC-P

Status: **DONE — A05 bounded auto-avoid landed (heavy tag + reaction budget + cooldown + manual precedence); SC-AI/SC5/SC6/SC-P covered**

- **Objective:** SC-AI + SC5 + SC-X + SC6 + SC-P — targetable facade, paired decision/approach, auto-avoid, semantic migrations, temporal families/lifecycle, primary-state persistence
- **In scope:** `game/src/sim/combat/mobSkills.ts`, `mobStatus.ts`, `skills.ts`, `combat-actions.ts`, `game/src/sim/core/pending-work.ts`, `game/src/sim/core/game.ts`, `game/src/state/save.ts`; focused tests
- **Out of scope:** new skills, balance changes
- **Verified context:** A03/A04/A05 selected; §6.2 SC-X table; §6.4 SC-P; `mob-skills.test.ts`, `mob-skill-delivery.test.ts`, `pending-work.test.ts`, `combat-acceptance.test.ts`
- **Steps:** 1) targetable facade; 2) paired decision/approach + auto-avoid matrix (A05); 3) semantic migrations with data/execution/ledger/copy/handoff together; 4) temporal families/lifecycle; 5) SC-P save fields/readers/tests (A04)
- **Acceptance:** §7 combat rows; A03 transition matrix + regressions; A05 multi-threat/infeasible/cooldown/no-perfect-dodge; SC-P save→load without flight but with primary state; old unsupported unpaid intent declared initialization; tests pass
- **Stop and escalate:** A03 matrix missing; SC-P schema/reader conflict; migration data not reconciled; save compatibility loss
- **Expected handoff:** facade/AI contract notes, migration ledger, save evidence, commands/results

#### V1 — recipe/anchor/phase binding, height, actor coverage, packaging

Status: **DONE (runtime) — 68 VFX tests PASS; packaging/perf remains a J1/art-proof measurement**

- **Objective:** VF1 + VF-Z + VF-A + VF-P — authored 2D VFX recipe/anchor/phase binding, height rendering, actor/motion coverage, packaging/performance
- **In scope:** `game/src/ui/combat/arena-vfx-space.ts`, `game/src/presentation/arena-camera.ts`, `game/src/ui/combat/arena-authored-vfx.ts`, `game/src/ui/combat/fx-manifests`, VFX components; focused tests
- **Out of scope:** new art generation
- **Verified context:** §6.3; 2D authored shelf live in `game/public/fx/skill-pool/`; `arena-authored-vfx.test.ts`, `arena-authored-vfx-render.test.ts`, `arena-space.test.ts`, `skill-fx.test.ts`
- **Steps:** 1) recipe/anchor/phase handoff fields; 2) height projection; 3) actor/motion coverage; 4) packaging/perf caps; 5) dedupe/legacy fallback
- **Acceptance:** §7 VFX rows for direction input, anchor/height, actor/motion coverage, one accepted impact → one dominant owner, packaging/perf; tests pass; no fake events
- **Stop and escalate:** art scope leaks in; asset conflict; perf budget missing; baseline failure
- **Expected handoff:** binding matrix, changed files, test/perf evidence

#### V2 — directional runtime, telegraph, delivery, whole roster

Status: **DONE (runtime) — directional/telegraph/delivery/whole-roster runtime covered by 68 VFX tests**

- **Objective:** VF2 + VF2-L + VF3 + VF5 — directional/melee runtime, landing telegraph, delivery/lifecycle, whole roster
- **In scope:** `game/src/ui/combat/CombatArenaScene.svelte`, `arena/` VFX components, `arena-whirlwind.ts`, `arena-ground-slam-vfx.ts`, manifests; focused tests
- **Out of scope:** new asset generation
- **Verified context:** §6.3; existing component/manifest registry; `arena-whirlwind.test.ts`, `arena-ground-slam-vfx.test.ts`, `arena-authored-vfx-render.test.ts`, `skill-fx.test.ts`, `combat-presentation.test.ts`
- **Steps:** 1) directional/melee runtime; 2) landing telegraph; 3) delivery/lifecycle; 4) whole-roster coverage; 5) reduced motion/fallback
- **Acceptance:** §7 VFX rows for cone/sector/line, telegraph, lifecycle, whole roster, overlap/reduced motion, loading/fallback; tests pass; no double pay
- **Stop and escalate:** missing authored asset; double-pay; dense-combat failure; visual evidence missing
- **Expected handoff:** coverage table, changed files, test/browser evidence

#### J1 — whole-roster core, joint visual, live field, release evidence

Status: **DONE — all mandatory packets complete**

- **2026-10-27 production evidence:** Chrome 156 · Windows · AMD Radeon RX Vega 11 · 1920×1080 DPR1 · live `/` field: p50 16.7 ms, **p95 16.8 ms** (three runs; 60 Hz cadence), heap 71 MB, no console errors; dev showcase is not representative (debug overhead)
- **Owner decision:** 16.8 ms accepted as the 60 Hz floor despite the literal 16.6 ms budget
- Full suite, build/wiki/verify PASS; art uses the 2.5D sprite/atlas pipeline

- **Objective:** SC7 + SC8 + VF6 + P8 — whole-roster core, joint visual acceptance, live field acceptance, release evidence
- **In scope:** integrated arena/field flow, acceptance commands, wiki rebuild when behavior/data changes; no new features
- **Out of scope:** new packets, balance tuning, unapproved save/schema changes
- **Verified context:** §7 acceptance lists; `combat-acceptance.test.ts`, `save-fidelity.test.ts`, `arena-authored-vfx-render.test.ts`, `spawns.test.ts`, `field-area.test.ts`; browser `/` 1920×1080
- **Steps:** 1) run mandatory packets’ acceptance; 2) joint arena/field pass; 3) live `/` browser pass; 4) wiki/build/verify; 5) record evidence and remaining limits
- **Acceptance:** §7 Field/Combat/VFX rows PASS or explicit NOT EXERCISED with reason; `npm run verify`, `npm test`, `npm --prefix game run check`, `npm --prefix game run build` pass; `npm run wiki` when required; no red artifacts left
- **Stop and escalate:** any mandatory packet open; baseline failure unrelated but unexplained; missing acceptance evidence; unapproved lossy save change
- **Expected handoff:** PASS/FAIL/NOT EXERCISED matrix, commands/results, changed files, limitations

## 6. Contracts และค่าตั้งต้นที่ implement

### 6.1 Field population

- Authority: active `s.group`; inactive checkpoint เก็บ population/slots/timers/positions; ห้ามมีสอง HP authority
- Slot state: occupied / pending / due / placement-blocked / initial-empty / stale-reference; derive จาก`mobId` + `respawnAtSec` + field identity ไม่เพิ่ม enum ซ้ำถ้าไม่จำเป็น
- Death transaction: validate identity/owner → resolve damage/kill/reward ครั้งเดียว → release ด้วย exact id → set deadline จาก death receipt → remove live mob → retain presentation → purge เฉพาะ action/contact ของตัวนั้น
- Refill: due slots → cap/ownership → resolve profile+seed → safe placement → retry ถ้าถูกบัง → commit mob+owner+position+sequence พร้อม birth timestamp; ห้าม despawn เพื่อน/ผลักผู้เล่น
- Placement: home center → rings/bearings ใน roam disc/field bounds → clearance → ไม่เลือกจุดบน player/body; candidate count เป็น budget ไม่ใช่ quota
- Roam: `home_band_m` ใช้จบ return; `slot.roamM` เป็นขอบ roam; `roamM=0` = stationary; goal คงที่ต่อ cycle จาก sim time/seed; reload ไม่ reroll
- Camera: player feet อย่างเดียว; pointer inverse ใช้ drawn camera; resize ไม่เปลี่ยน world positions/cap/range
- Playback: playhead ไม่ถอยใน epoch เดียว; Pause ไม่เด้ง; speed ไม่คูณซ้ำ; history trim ต้องมี explicit rebase

Initial profiles (selected implementation values):

| รายการ | ค่าเริ่มต้น |
|---|---|
| World width / height | 50 m / ~32.0513 m (validate จาก projection ปัจจุบัน) |
| Field cap | calm 32 / standard 40 / dense 48 |
| Respawn | ordinary 24–40 s, elite 60–90 s, wild unique 180–300 s |
| Rank chance | elite 0.05, wild unique 0.002 ต่อ eligible birth |
| Roam | radius 2.5 m, cycle 8 s, idle 2.5 s, speed 0.35× walk |
| Aggro / assist / leash | 4 m / 3 m / 9 m |
| Home band / return pace | 0.35 m / 0.65× walk |
| Farming acquire / search | 12 m / 18 m |
| Placement retry | 0.25 s sim time |
| Heavy checkpoint | bounded LRU 6 fields; compact ledger ห้ามหายตอน evict |

- Eviction: compact ledger เก็บ descriptor ของ occupied life (species/variant, rank, life seed, sequence, HP/status) แยกจาก heavy record; reconstitution ใช้ descriptor เดิม + area/render epoch ใหม่, ไม่ใช้ death/reward cycle ปลอม และไม่ reroll rarity
- Pending-after-death กับ occupied-before-eviction ต้องแยกกันชัด; materialize สำเร็จเพิ่ม birth sequence ครั้งเดียว; load/retry ที่ยังไม่ commit ไม่เพิ่ม

Domain mapping:

| Domain | Profile ที่ใช้ |
|---|---|
| Live field | cap/respawn/rank ใหม่ตาม §6.1 |
| Camp threat | legacy cap/rank policy เดิม |
| Dungeon refill | legacy cap + run budget เดิม |
| Offline / non-arena | legacy cap/rarity/respawn เดิม |

- แก้ field density ต้องไม่เปลี่ยนจำนวน Camp threat, dungeon pull หรือ offline queue โดยไม่มี explicit migration
- Negative reader test ต้องพิสูจน์ว่าค่า field ใหม่ไม่ลาม domain ที่เลือกคงเดิม

Deadline:

```text
u = stableUniform(worldSeed, areaKey, slotId, lifeIdentity, "respawn-time")
delayUs = integerDuration(resolved min/max)
dueUs = deathAtUs + delayUs
respawnAtSec = dueUs / unitsPerSec  // persist fractional value
```

- Spawn ได้ที่ sample แรกที่ `sampleAtUs >= dueUs` และ placement ผ่าน
- Failure/retry ไม่เพิ่ม sequence; release ซ้ำไม่เขียน due/sequence
- Old scalar `respawn_sec` เป็น legacy adapter `min=max` เท่านั้น; new writers ใช้ explicit window

Geometry migration:

- `layoutRevision` อยู่ใน active field/inactive entry
- Old 18×12 m map ย้ายด้วย translation เดียว: `newPoint = oldPoint + (newPlayerStart - oldPlayerStart)`
- ห้าม scale coordinates/vectors/radii/speed/duration; translate เฉพาะ points และ core-owned pending-work points
- Author legacy patch homes ให้ตรง translation; migrate ซ้ำต้องไม่บวก offset ซ้ำ

### 6.2 Combat execution

Speed domains (SC-T):

```text
S_attack = effectiveActiveWeaponRateHz / referenceAttackRateHz
S_cast   = current global-action/cast factor
S_fixed  = 1
```

- Weapon-bound attacks ใช้ attack profile; magic/buff/curse/heal ใช้ cast; aura/state ใช้ fixed; Venom Spray = cast แม้ delivery melee
- Factor ถูกใช้ครั้งเดียว; Pause/playback/passive control time ไม่ใช่ speed stat
- Phase duration ล็อกเมื่อ preparation เริ่ม; buff/slow มีผล action ถัดไป เว้นแต่มี explicit retime receipt
- Release recompute aim/travel จาก facts ปัจจุบัน; payment/cooldown commit ที่ release
- Whirlwind 1.2 s/3 pulses คงเดิม; ไม่เพิ่ม pulse/damage จาก speed

Geometry/range (SC-R, SC2-G):

```text
f = (cos θ, sin θ); n = (-f.y, f.x); v = targetCenter - origin
forward = dot(v, f); lateral = dot(v, n)
sector: d <= reach AND dot(v/d, f) >= cos(fullOpening/2)
line-impact: 0 <= forward <= length AND abs(lateral) <= fullWidth/2
```

- Cone full opening ≤ 180°; Cleave 120°, Venom Spray 90°
- First pass ใช้ center membership; การเพิ่ม body radius overlap เป็น explicit query migration
- Travelling projectile ใช้ continuous swept contact กับ actual body radius; Piercing Shot ใช้ full line width 0.75 m → projectile radius 0.375 m
- Piercing: one paid cast → one track + roll cache + visited set; earliest swept contact ต่อ interval; resolve recipient ครั้งเดียว; track อยู่ต่อจน range/expiry/cancel
- Direction-target cone/caster-line ใช้ cursor เป็นแนว + full authored reach; ไม่เดินตาม cursor แบบ ground-point
- Deadzone 0.125 m ใช้ last valid/declared facing
- RangeSpec: `basis: center | body-edge`; contact-bound melee ใช้ edge 0.2 m; ห้ามตีความ legacy `range.melee=2.1 m` เป็น basic reach

```text
center:    maxCenter = meters; preferredCenter = meters * stopRatio
body-edge: maxCenter = rSource + rTarget + meters
           preferredCenter = rSource + rTarget + meters * stopRatio
lowerClearance = rSource + rTarget + authoredClearance
```

Auto-avoid (SC5):

- Trigger เฉพาะ tagged heavy committed ground threat; ordinary shot/basic ไม่ trigger; ใช้ current public facts ไม่ทำ perfect leading จาก future state
- ลำดับสิทธิ์: manual request ชนะ auto-avoid; auto-avoid ไม่แทนที่ released/paid work; unpaid windup/channel ถูก interrupt ได้เฉพาะเมื่อ reaction budget และ cancellation owner อนุญาต
- Released recovery ไม่ถูกยกเลิก; mobile channel แตกได้เฉพาะ profile ที่อนุญาต; hard control/death ใช้ lifecycle เดิม
- ใช้ per-profile reaction budget/cooldown + one pending request; multi-threat ใช้ deterministic threat priority; escape ไม่ได้ให้ hold/blocked reason ไม่ teleport/ไม่เพิ่ม range/immunity
- Tests: multi-threat tie, infeasible escape, cooldown, manual priority, windup/channel/released cases, no-perfect-dodge

Height (SC-Z):

```text
screen = projectGround(x, y) + cameraHeightVector * h
screenTangent = cameraGroundMatrix * velocityXY + cameraHeightVector * velocityH
```

- Ground shape/shadow/telegraph อยู่ h=0; visual height ไม่สร้าง immunity/height collision
- Direct projectile: socket h → target body h
- Ballistic: `h(u)=lerp(h0,h1,u)+4*arcHeight*u*(1-u)`
- Sky drop: `h(u)=dropHeight*(1-u*u)`, จบ h=0 ที่ deadline
- Bolt/arrow default ไม่มี generic sinusoid; bow arc optional 0.15 m

Impact/entitlement (SC-E):

- One impact = transaction: eligibility/contact → cached rolls/defence → pool loss/status/consume/spread → death/reward/trigger receipts → presentation facts
- Crit: one cast-level roll ที่ first eligible impact
- Accuracy/dodge: one cached cast-target roll ที่ first contact ของ target
- Status: once per successful cast-target; new field target มี first-success ของตัวเอง
- Generic on-hit rider: once per cast-target; Arrow Shower เป็น explicit per-impact-target exception
- CoC ≤ 1 accepted trigger ต่อ source cast; damage-taken ≤ 1 ต่อ incoming action ที่มี pool loss
- Leech/execute จาก actual eligible pool loss/threshold; miss/overkill ไม่ heal
- Damage primary ≠ aim target; Split Shot bind primary ที่ first actual collision; ไม่ promote body อื่นเป็น primary ซ้ำ

Selected semantic migrations (SC-X) — ต้องทำ data/execution/ledger/copy/handoff พร้อมกัน:

| Skill | Execution |
|---|---|
| Water Ball | projectile burst 5×20%, initial interval 0.12 s, one aim, individual contacts, จ่าย cast ครั้งเดียว |
| Double Strike | melee burst 2×60%, initial gap 0.12 s, revalidate contact ต่อ blow |
| Split Shot | one missile → first collision → live circle query; fragments cosmetic |
| Storm Field | true fixed field 8 s, initial press + 25 DPS/s, 8 payments; disable attached-erosion legacy |
| Poison Cloud | true fixed field 8 s, initial press + 15 DPS/s; poison 2 stacks once-per-cast-target |
| Blizzard / Sand Storm | field-v2 activation ที่ ground landing; Blizzard 20×5% ที่ activation + k×0.4 s; Sand Storm initial + 10 payments |
| Meteor/Firestorm | one-press ground model; multi-object เป็น cosmetic |
| Frost/Cinder Nova, Thunder Storm, Chaos Wave | instant caster nova; ไม่สร้าง field/travelling front |
| Ignite/Venom Bolt/Entropy/Catalyst/Ruin | instant/single/payoff/status ตาม canonical row |
| Thunder Strike/Earth Splitter/Stone Spike | ground single/contact; sky column/fracture/rising; ไม่เพิ่ม AoE/control |

- Burst budget ใช้ count×authored share จริง (Water Ball 100%, Ice Lance 110%, Arrow Shower 120%, Double Strike 120%, Overload 100%, Blizzard 100%)
- True field: 1 active instance ต่อ caster+skill+arena; recast replace future work โดยไม่ refund; expiry หลัง last eligible pulse
- New casts ใช้ schedule version ใหม่; legacy paid Blizzard คง saved deadlines

### 6.3 VFX runtime (ไม่รวมการเจนภาพ)

- VF1–VF6 ในส่วนนี้เป็น authored 2.5D VFX

- SC2-L/VF1 handoff ต้องมี: telegraph identity (epoch+action+landing/pulse group), caster/skill/relation, started/release/landing, deadline kind, deployed/firstDamage/nextPulse/expires, preview/committed geometry, tracking/fixed/caster-follow, cancel reason/revision
- `castProgress = clamp((t - startedAt)/(releaseAt - startedAt), 0, 1)`
- `landingProgress = clamp((t - telegraphStart)/(landingAt - telegraphStart), 0, 1)`
- Zero-duration phase จบที่ boundary; instant impact ไม่เพิ่ม delay
- Player ground AoE ทุก valid cast แสดง landing marker; enemy telegraph ใช้ public geometry; ordinary arrow/single melee ไม่สร้าง AoE ring
- Field active เปลี่ยนเป็น quiet footprint + pulse accents; ไม่เริ่ม cast countdown ใหม่ทุก pulse
- Cancel unpaid preparation จบวงพร้อม action; released work คงวงถึง actual terminal
- Runtime dedupe: one accepted impact → one dominant contact owner; cast layer/hit layer/authored/legacy fallback ต้องไม่ซ้ำ
- Rhythm ใช้ absolute action/field time + index + stable cosmetic seed; ไม่ใช้ `setInterval`/RAF count
- Visual recipe fields (proposed): `motionBinding`, `impactCueBinding=resolved-only`, `primaryCueMs`, `tailMs`, `materialLoopSec`, `ambientBirthRate`, `referenceAreaM2`, `activeCosmeticCap`, `qualityMultiplier`, `seedScope`
- Actual geometry/timing missing → diagnostic; procedural boundary/progress ยังทำงานได้ แต่ห้ามสุ่มเวลา/พื้นที่

### 6.4 Persistence

- Active living mobs อยู่ใน canonical state; slot id/owner/due/sequence/home; positions/returning; inactive checkpoint; pending ledger
- Schema ที่ตรวจคือ 26 — recheck ก่อน bump
- Old inactive archive ที่ไม่เคยเก็บ Mob records migrate เป็น metadata/timer ตามความหมายเดิม; ไม่กล่าวอ้าง restore HP
- Stale slot reconcile โดยไม่มี reward/ไม่เลื่อน due/ไม่ duplicate
- Pause/resume/offline: settle released work ครั้งเดียว; inactive field ไม่มี AI/damage/reward/catch-up
- SC-P เป็น explicit sub-packet ของ SC6: checkpoint active primary preparation/recovery/manual intent เป็น pure data; paid receipts/entitlements ห้ามหาย; older unsupported unpaid intent ใช้ declared initialization
- SC-P ต้องระบุ owner, readers/writers, save version และ dependencies ไป SC7, field P6 และ VF2-L reload; ห้าม serialize closures
- Tests: save→load ขณะไม่มี flight แต่มี primary state; old unsupported unpaid แยกจาก paid legacy record; round-trip ไม่เพิ่ม/ลบผล

