# Plan readiness audit — field, combat and VFX

วันที่: 2026-10-27 — Asia/Bangkok  
ขอบเขต: ทุก implementation plan ที่อยู่ใน `docs/plans/` ตอนเริ่ม audit รวม 3 ไฟล์  
วิธีตรวจ: [plan-readiness-audit](../../.agents/skills/plan-readiness-audit/SKILL.md), current workspace และ AGENTS.md  
งานนี้เป็น audit เท่านั้น ไม่มีการแก้ runtime หรือแก้สาม source plans

## A. Verdict

**Overall: MIXED.** เริ่มงาน inventory/read-only QC และ current-camera/current-roam regressions ที่จำกัดขอบเขตได้ แต่ยังไม่พร้อมส่งทั้งสามแผนเป็น full implementation ที่อ้างว่า requirements ปิดครบแล้ว

| แผน | Verdict | เหตุหลัก |
|---|---|---|
| [Combat skill coherence](combat-skill-coherence-plan.md) | NEEDS CLARIFICATION สำหรับ full scope | Mandatory persistence work อ้าง SC-P แต่ไม่มีใน execution table; auto-avoid ยังไม่อยู่ใน priority/cancellation policy ที่ตัดสินครบ |
| [Skill VFX coherence](skill-vfx-coherence-plan.md) | MIXED | Source/QC/inventory พร้อม; integrated reload/lifecycle acceptance ต้องรอข้อสรุป core/field ที่มีผลต่อ identity และ deadlines |
| [RO field population](ro-field-population-roaming-playback-plan.md) | NEEDS CLARIFICATION สำหรับ full scope | Eviction/reconstitution ขัด anti-reroll, new field profiles มี shared consumers นอก field และ safe-domain interaction กับ paid work ยังไม่ปิด |

คำว่า READY ทั้ง G1–G8 ใน field plan เป็น self-assessment เดิม ไม่ใช่ผลของ audit นี้ จากข้อ A01–A05 ด้านล่างจึงยังใช้รับรองทั้งระบบไม่ได้

### สิ่งที่ตรวจจริง

- ทั้งสามแผน: objective/scope, shared units/time/geometry, selected migrations, ownership, packet dependencies, save/offline, asset handoff และ acceptance
- `AGENTS.md`, package scripts และ source readers ที่เกี่ยวข้องใน `engine/`, `sim/`, persistence และ Scene
- Live skill inventory จาก `tools/data/skills.json`: 110 records, 92 non-retired rows ณเวลาตรวจ
- Cast profiles และ representative rows ได้แก่ Water Ball, Double Strike, Split Shot, Blizzard, Arrow Shower, Ice Lance, Storm Field, Poison Cloud, Fissure และ enemy Boulder Toss
- `CombatClock` priority/comparator, pending-work shape, field normalizer, shared spawn-profile consumers และ camera function/Scene caller
- Local Markdown links ของทั้งสามแผน: ไม่พบ broken local link
- Source hashes เพื่อระบุ snapshot ของแผนที่ตรวจ ดูท้ายรายงาน

### ขอบเขตหลักฐาน

- Audit นี้ไม่ได้ implement แผน, เพิ่ม tests, รัน full gameplay suite หรือทดลอง browser ใหม่
- หลักฐาน runtime/probes ที่แผน field บันทึกไว้เป็น historical evidence ของรอบก่อน ไม่ถูกนับว่า audit นี้รันซ้ำแล้ว
- รายการใหม่ในแผนที่ยังไม่มี code ไม่ถูกนับเป็น finding เพียงเพราะยังไม่ implement; findings ด้านล่างเป็น contract/dependency gaps หรือข้อขัดแย้งที่ต้องปิดก่อนมอบ implementation เต็ม scope

### Read-only check ที่รันใน audit นี้

```powershell
python tools/check-authored-vfx.py --selected
```

ผล: **PASS**, live skills 92, selected skills 92, component atlases 3, checked atlases 95, failures 0

ขอบเขต checker คือ pixels/alpha/rectangles/coverage. ผลนี้ไม่พิสูจน์ motion, direction, contact, height, landing timing หรือ visual acceptance ในสนาม

## B. Findings

| ID | Severity | Claim / gap | Evidence | Consequence | Required action / owner |
|---|---|---|---|---|---|
| A01 | High | Field reconstitution เพิ่ม generation/birth sequence ใหม่ทั้งที่ life เดิมยังไม่ตาย ขัดกับ anti-reroll invariant | Field §14.3/§27.7: L577, L1464–1468; `spawnSlotSeed` ใน `engine/spawns.ts:81`; factory seed readers ใน `game.ts:1370–1380` | เดินให้ heavy cache ถูก evict แล้วกลับมาอาจได้ชีวิต/rarity roll ใหม่โดยไม่มี death/respawn cycle แม้ pending-death due จะถูกเก็บไว้ | Field/save owner ปิดความหมาย canonical life กับ presentation epoch และกำหนดว่า resolved spawn descriptor/seed ใดต้องคงเดิม พร้อม eviction regression |
| A02 | High | New field cap/rank/respawn profile ยังใช้ reader ร่วมกับ Camp, dungeon และ offline แต่ plan scope ไม่ได้เลือกผลต่อ domains เหล่านั้นครบ | Field §3.2 L82–83, §15.3 L608, §16.3 L633, initial cap L1320; `game.ts:1117`, `:1403`, `:1422`; `releaseSpawnSlot` ใน `field-area.ts:197–205` | เปิด cap 32–48 อาจทำให้ Camp threat/dungeon pull ใหญ่ขึ้นตาม และ new respawn/rank values เข้า offline path ด้วย | Field data/core/world owners ต้องทำ domain→profile mapping และระบุ compatible baseline/migration ก่อน P2b activation |
| A03 | High | Safe Camp เลือก block hostile impact เพื่อให้ immune แต่ยังไม่กำหนด boundary ของ paid outgoing fields/projectiles และ status effects ที่กำลังทำงาน | Field §27.5 L1404–1420; Core §6.5–6.6 L549–565; `SpawnProfile.camp_safe_m` ใน `engine/spawns.ts:37–38` ระบุ suppression ของ spawn/aggro ไม่ใช่ universal damage immunity | อาจยิง/วาง field จากข้างนอกแล้วเข้าที่ปลอดภัยเพื่อทำ damage ต่อโดยไม่มี retaliation หรืออีก implementer อาจ cancel paid work โดยไม่มี receipt/refund policy | Gameplay owner ตัดสิน safe-entry policy; core+field owners เขียน transition matrix ของทั้งสองฝั่งก่อน integration; VFX ใช้ terminal reason เดียวกัน |
| A04 | High | ข้อกำหนด SC-P มีจริง แต่ไม่ปรากฏเป็น packet หรือ dependency ที่ระบุเจ้าของใน execution table | Core L567 เทียบ table L577–600; `snapshotPendingWork` ใน `pending-work.ts:82` และ normalizer `:275` คืน null เมื่อไม่มี flights | งานเก็บ unpaid windup/recovery/manual intent อาจถูกข้าม ขณะที่ SC7/VF6 ผ่าน flow ปกติแต่ reload กลาง phase ยังไม่ครบ | Core/persistence owner เพิ่ม SC-P หรือ assign ข้อกำหนดนี้ให้ SC6 อย่าง explicit พร้อม dependencies/readers/version/negative tests และเชื่อม field P6/VF2-L |
| A05 | Medium | Auto-avoid เป็น selected feature ของ SC5 แต่ไม่มีตำแหน่งใน priority tuple และไม่มี policy ของ windup/channel interruption หรือ reaction profile ที่ freeze | Core priority L414 และ autoavoid L437; `game.ts:1662–1663` / `:2509` แสดงว่าปัจจุบัน manual move cancel preparation | Implementers อาจให้ automatic dodge override manual/rotation หรือใช้ manual-move path จน cancel ทุก windup หรือทำ avoidance ที่ไม่เคยมีสิทธิ์ทำงาน | Core AI owner ปิด priority/cancel/reaction contract และส่ง movement constraint ให้ field owner; แยก automatic movement จาก manual request identity |

### A01 — ทำไมไม่ใช่เพียงปัญหาชื่อ generation

Field plan ต้องการกันการเดินหลาย hex เพื่อ reroll rare และใช้ per-life seed ควบคุม rank/species/respawn แต่ reconstitution path กำหนดให้ occupied slot ที่ไม่มี heavy record แล้ว materialize เป็น generation ใหม่ พร้อมเพิ่ม birth sequence

Current `spawnSlotSeed` รับ respawn sequence เป็นส่วนหนึ่งของ hash และ current factory ใช้ seed นี้สร้างตัวใหม่ การเปลี่ยน life seed จึงเปลี่ยนผล selection ได้ ข้อกำหนดสองด้านนี้ไม่สามารถใช้รับรอง no-reroll พร้อมกันได้โดยไม่แยก canonical life descriptor ออกจาก render/area epoch

**Minimum action to READY:** ระบุข้อมูลที่ compact ledger ต้องรักษาสำหรับ occupied life รวม rank/species/seed entitlement และการใช้ epoch ใหม่เพื่อป้องกัน stale effects; เพิ่ม fixture ไปมากกว่า heavy-cache capacity แล้วกลับ field เดิมโดยไม่มี death. ตรวจว่าชีวิตเดิมไม่ถูก roll ใหม่, pending due ไม่เร็วขึ้น และไม่มี reward ใหม่

Audit ไม่เลือกว่าจะเก็บ full record, minimal immutable descriptor หรือ reconstruction แบบใดแทน owner แต่ผลที่ยอมรับต้องไม่ขัด invariant

### A02 — Shared consumers ที่ต้องปิดก่อนเปิด cap ใหม่

| Consumer ปัจจุบัน | Reader ที่ตรวจ | สิ่งที่เปลี่ยนตาม new profile โดยตรง |
|---|---|---|
| Camp threat factory | `game.ts:1117` ใช้ `spawns.profileFor(...).cap` เป็นจำนวน bodies | จำนวน threat ต่อ Camp encounter |
| Dungeon refill | `game.ts:1422` ใช้ `min(profile.cap, run.left)` | จำนวน bodies ที่เข้าพร้อมกัน แม้ total dungeon budget ไม่เปลี่ยน |
| Offline/current non-arena population | `game.ts:1403` จำกัด living cap เหลือหนึ่ง แต่ยังใช้ `spawnFieldMob` และ shared profile | Rank selection และเวลารอหลังตาย |
| Slot release | `field-area.ts:201–203` อ่าน profile เดียว | Respawn timing ทั้ง mode ที่เรียก helper |

ตัวอย่าง: ถ้า standard field profile เปลี่ยน cap จาก 6 เป็น 40, Camp reader ปัจจุบันจะขอ 40 bodies โดยไม่ต้องแก้ Camp code เพิ่ม ไม่ถือว่าเป็นการยืนยัน runtime ว่าเกิดขึ้นแล้ว เพราะแผนยังไม่ได้ activate ค่าใหม่

**Minimum action to READY:** ทำตาราง canonical policy ของ live field / Camp / dungeon / offline. แยก budget/profile ที่ควรเป็นอิสระ หรือประกาศ explicit migration ของ mode ที่ตั้งใจเปลี่ยน แล้วเพิ่ม negative reader test ว่าแก้ field density ไม่ลามไป mode ที่เลือกให้คงเดิม

การตรวจนี้ไม่บังคับรักษา old wave tuning. ประเด็นคือขอบเขตการเปลี่ยนต้องตรงกับ plan และผู้อ่านข้อมูล

### A03 — Scenario ที่ต้องมีคำตอบก่อนเขียน impact predicate

1. Player วาง persistent field บนศัตรู แล้วเดินเข้า Camp safe domain ก่อน field หมดอายุ
2. Player ยิง projectile แล้วเข้าสู่ safe domain ก่อน contact
3. Enemy ground attack/projectile commit แล้ว ผู้เล่นเดินเข้าที่ปลอดภัยก่อน impact
4. Active DoT/status หรือ secondary trigger กำลังมีสิทธิ์ทำงานขณะข้าม boundary

Field plan ปิดการเริ่มโจมตีใหม่และ hostile impacts ภายใน แต่ไม่ได้กำหนดว่า paid outgoing work จบหรือยังทำงานต่อ Core plan กำหนด paid work ให้มี lifecycle/terminal reasons ชัดเจน จึงห้ามแต่ละ reader ตัดสินเอง

**Minimum action to READY:** เลือก policy ในหัวข้อ D แล้วเพิ่ม matrix `source/recipient enters/exits safe domain × unpaid/released/field/status` พร้อม effective timestamp, cooldown/payment และ receipt. หลังจากนั้นจึง freeze `world eligibility` interface ให้ core/VFX

### A04 — Persistence packet ที่ขาดใน DAG

ไม่ใช่การกล่าวว่า new persistence ต้องมีอยู่แล้วก่อนเริ่ม implement. ปัญหาคือ plan เรียก requirement ด้วยชื่อ SC-P และกำหนดเป็นงานของ release แต่ไม่มี SC-P ในรายการที่จะนำไปมอบหมาย

Current ledger เซฟเฉพาะ released flights/mobFlights และหายไปเมื่อไม่มีทั้งสองประเภท การเก็บ active windup, recovery และ manual intent จึงไม่เกิดขึ้นเองจากการขยาย asset metadata หรือ serialize flight เพิ่มเล็กน้อย

**Minimum action to READY:** ผูก work item นี้กับ packet/owner ที่มีจริงและ dependencies ของ SC7, field P6 และ VFX reload acceptance ระบุ old unsupported unpaid state กับ paid legacy records คนละกรณี และเพิ่ม save→load tests ที่ไม่มี flight แต่ยังมี primary state

### A05 — Auto-avoid ที่ยังต้องปิด design

ข้อความว่าใช้ tagged heavy threat, reaction/cooldown และรักษา manual priority เป็นข้อจำกัดที่ดี แต่ยังไม่ตอบว่าหลีกเมื่อไรและมีสิทธิ์ยกเลิกอะไร

**Minimum action to READY:** เพิ่มแถว auto-avoid ใน priority/cancellation matrix, ระบุ behavior ระหว่าง windup/released recovery/mobile channel/manual move และระบุ data owner/default reaction budget. ต้องมี multi-threat tie, infeasible escape, cooldown และ no-perfect-dodge tests. ไม่จำเป็นต้องถามผู้ใช้เรื่อง implementation detail ถ้า core planning owner ปิด policy ให้สอดคล้องกับ direction ที่อนุมัติแล้วได้

## C. Readiness matrix

คำย่อ: **P = PASS**, **F = FAIL**, **U = UNKNOWN**. ไม่ใช่คะแนนความน่าจะเป็นสำเร็จ

| Task | G1 | G2 | G3 | G4 | G5 | G6 | G7 | G8 | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| Coordinated SC0/VF0/P0 inventory และ source-contract census | P | P | P | P | P | P | P | P | READY |
| Current field camera target-switch fix ที่จำกัด F05 | P | P | P | P | P | P | P | P | READY หลังมี exclusive Scene writer |
| Current roam/home-band fix ที่จำกัด F01 | P | P | P | P | P | P | P | P | READY หลังมี exclusive arena writer |
| VFX source pixels/coverage/metadata inventory | P | P | P | P | P | P | P | P | READY |
| Combat plan — full release scope | P | P | F | F | U | P | F | P | NEEDS CLARIFICATION |
| Field plan — full release scope | P | P | F | F | F | P | P | P | NEEDS CLARIFICATION |
| VFX full joint integration / reload / promotion | P | P | P | U | U | P | P | P | NEEDS CLARIFICATION upstream |
| Camp safe-entry product rule | P | P | F | U | U | P | U | P | HUMAN-OWNED จน policy ถูกเลือก |

เหตุของ F/U:

- Combat G3: A05; G4/G7: A04; G5: required phase/manual resume ยังไม่มี packet/schema contract ที่รับผิดชอบชัด
- Field G3/G4: A02/A03; G5: A01 และ safe-entry impacts ที่ยังไม่ปิด
- VFX G4/G5: upstream life/terminal/persistence facts จาก A01/A03/A04 ยังมีข้อขัดแย้ง ไม่ใช่ source-art coverage failure
- Camp rule ต้องมี gameplay decision ก่อนจึงกำหนด interface, compatibility และ cancellation cases ได้

P ที่ G8 หมายถึง packetization/one-writer rule ระบุได้ ไม่อนุญาตให้หลาย agent ลงมือแก้ `game.ts`/Scene/persistence พร้อมกัน

## D. คำถามที่บล็อก execution จริง

มีคำถามด้าน product หนึ่งข้อที่ source ปัจจุบันตัดสินแทนเจตนาใหม่ไม่ได้:

**Camp safe domain ต้องเป็น damage immunity จริงหรือเป็นพื้นที่ระงับ spawn/aggro ตามความหมายของ `camp_safe_m` ปัจจุบัน?**

| ทางเลือก | ผลที่ต้องยอมรับ/ระบุ |
|---|---|
| Spawn/aggro suppression; ไม่เพิ่ม universal impact immunity | สอดคล้องกับความหมาย current data มากกว่า แต่ paid attacks/status ที่ commit แล้วต้องมี lifecycle เดิม และต้องนิยามการตอบสนองเมื่อยิงจากพื้นที่นี้ |
| Hard immunity ตาม field draft | ต้องเพิ่ม explicit safe-entry boundary ของ offensive/hostile released work และ statuses เพื่อปิดยิงฟรีจากด้านใน พร้อม receipts และ no-refund/payment policy |

Owner: ผู้ตัดสิน gameplay ร่วมกับ core/field planning owners. Audit นี้ไม่เลือกหรือแก้แผนให้แทน

A01, A02, A04 และ A05 เป็นงานปิด contract/packet ของ planning owners ที่ทำต่อจาก repository และ direction ที่มีได้ ไม่จำเป็นต้องโยนคำถามเรื่องชื่อตัวแปรหรือโครงสร้าง helper กลับให้ผู้ใช้

## E. Execution packets — เฉพาะงาน READY

### Task R1: Coordinated inventory / interface census

Status: **READY**

**Objective:** Freeze snapshot ของ current source และระบุ facts/interfaces ที่ทุกแผนใช้ก่อนเริ่ม gameplay migrations

**Verified context:** สาม plans, `skills.json`, `mob-skills.json`, `spawns.json`, engine types/readers, `game.ts`, arena, pending-work, field/save normalizers, manifests และ existing tests

**Scope / non-goals:** Read-only inventory, symbol/caller/data-key census และ asset QC; ไม่มี runtime edits, tuning, promotion หรือการแก้ source plans ของ owner อื่น

**Dependencies:** ไม่มี gameplay packet prerequisite; ใช้ source ปัจจุบันและรักษางานที่กำลังทำ

**Contracts / invariants:** Single HP authority, common clock/units, known legacy adapters, per-mode spawn-profile mapping, immutable source versions และ one writer ต่อ shared file

**Steps:**

1. Enumerate current non-retired rows, actual mob profiles และ selected source assets
2. Map readers ของ field caps/rates, action phase/pending fields, safe-domain eligibility และ canonical life identity
3. ระบุ A01–A05 ว่าข้อใดเจ้าของปิดแล้ว/ยังเปิด โดยไม่ตัดสิน gameplay แทน
4. รัน read-only selected checker และตรวจ current owner tests ที่ตรง surface; ไม่ใช้ full suite เป็น proxy ของ new design
5. ส่ง accepted facts + unresolved contract rows ให้ planning owners

**Acceptance criteria and proof:** Inventory ตรง current data, ทุก finding มี ownerและ path/symbol evidence, ไม่มี malformed/new profile ถูกอ้างว่า support แล้วเพียงเพราะ manifest มีชื่อ

**Stop and escalate if:** Source เปลี่ยนซ้อนจน snapshot ทำซ้ำไม่ได้, asset version ถูก producer เขียนค้าง, หรือ domain mapping ต้องการ product decision

**Expected handoff:** Inventory/interface report, exact read-only commands/results, source versions และรายการที่ต้องปิดก่อน integration

### Task R2: Player-only field camera สำหรับ F05

Status: **READY ภายใต้ exclusive Scene ownership**

**Objective:** การเปลี่ยน target/focus ไม่ย้าย field camera เมื่อ player/world geometry คงเดิม

**Verified context:** Field §12/§23; `CombatArenaScene.svelte:123` ส่ง player และ target เข้า `arenaCameraOffset`; utility อยู่ `arena-camera.ts:24`; render tests อยู่ `arena-authored-vfx-render.test.ts`

**Scope / non-goals:** Current field camera input และ affected projection/depth tests เท่านั้น; ไม่ activate 50 m geometry, ไม่แก้ attack directions, height system, recipes หรือ shared art

**Dependencies:** Accepted player-only design มีอยู่แล้ว; ต้องมอบหมาย Scene writer คนเดียวและตรวจ consumer version ก่อนแก้

**Contracts / invariants:** World positions/ranges ไม่เปลี่ยน, pointer inverse ใช้ drawn camera, VFX/depth/cue positions อ่าน camera เดียวกัน, generic optional utility behavior ที่ consumer อื่นใช้ยังมีความหมาย

**Steps:**

1. สร้าง rendered regression player คงที่และ focus สองด้านให้เห็น pre-fix transform ต่างกัน
2. เปลี่ยน field-follow consumer ให้ใช้ sampled player ตาม design
3. ตรวจ pointer round-trip และ affected depth/attachment consumers
4. รัน focused view/render checks และ required UI checks; ตรวจ live field ที่ 1920 × 1080 ด้วย existing server

**Acceptance criteria and proof:** F05 red→green, camera transform คงเดิมเมื่อ focus เปลี่ยน, ground command/VFX alignment ยังถูก และไม่มีเปลี่ยน gameplay coordinates

**Stop and escalate if:** Scene ถูกอีก owner แก้พร้อมกัน, พบ mandatory cinematic framing ที่ยังไม่แยก mode หรือ projection migration ใหม่ยังไม่ freeze

**Expected handoff:** Scoped changed files, regression/check results และ browser evidence. ถือเป็น internal verified packet ไม่ใช่ whole field release complete

### Task R3: Roam disc แยกจาก return home band สำหรับ F01

Status: **READY ภายใต้ exclusive arena ownership**

**Objective:** Mob ที่ไม่ได้สู้เดินภายใน authored roam area ได้ ขณะที่ committed returning body ยังต้องเข้าบ้านก่อนจบ return

**Verified context:** Unengaged branch ใน `advanceCombatArena`, ปัจจุบัน `gap > band` ที่ `combat-arena.ts:756`; `slot.roamM` และ `actor.returning` มีแล้ว; owner suites คือ `combat-arena.test.ts`/`field-area.test.ts`

**Scope / non-goals:** Correct current roam/home semantics; ไม่เพิ่ม aggression profiles, timing windows, new caps, save schema หรือเปลี่ยน source-controlled conditions ของ skill actions

**Dependencies:** ไม่มี new action/profile migration; ต้องมี writer ของ arena ที่ไม่ชน SC/field workstream

**Contracts / invariants:** Body bounds/clearance/controlled speed ถูก, roam radius ศูนย์ตั้งใจ stationary, returning immunity/state ไม่ถูกยกเลิกก่อนเข้าบ้าน, deterministic movement ไม่กิน combat RNG

**Steps:**

1. เพิ่ม F01 regression เทียบ home band กับ authored roam disc และกรณี returning จริง
2. แก้การตัดสิน ordinary roaming กับ return ที่ owner branch
3. ตรวจ bounds, speed budget, stationary profile และ returning-save cases
4. รัน focused suites และตรวจ live behavior ก่อนเชื่อม new roam/idle profile ในแผนเต็ม

**Acceptance criteria and proof:** F01 red→green, ordinary body ออกนอก home band ภายใน roam disc ได้, return ยังเข้าบ้าน, ไม่ teleport/เกิน free-time walk budget

**Stop and escalate if:** พบ obstacle-navigation requirement, return-state schema เปลี่ยนซ้อน หรือจำเป็นต้องแก้ combat ownership เพื่อให้ fixture ผ่าน

**Expected handoff:** Scoped code/tests และ movement evidence. ไม่ประกาศ population/save/50 m map เสร็จจาก packet นี้

## F. สิ่งที่ยังไม่ออก implementation packet และ handoff rule

ยังไม่ออก full implementation packets สำหรับ new safe immunity, cache reconstitution, multi-mode profile activation และ full primary-state persistence จน A01–A05 ถูกปิดโดย owner ตาม minimum actions. การมี P0/P4/VF0 ที่เริ่มได้ไม่เป็นใบอนุญาตเปิด new geometry/rarity/semantics ทั้งชุด

ก่อน mark whole release READY ให้ reviewer ตรวจ plan revisions ที่แก้ finding, corresponding source contracts และ tests ที่จะพิสูจน์ negative paths โดยอิสระใน workspace เดิม

Implementing agents ต้องอ่าน current files, รักษางานที่ไม่เกี่ยว, ใช้ focused checks ก่อน broaden และรายงานคำสั่ง/ผลจริง ไม่อ้าง runtime complete จาก audit report นี้หรือจาก selected-atlas checker

## Snapshot fingerprints

ใช้ระบุแผนที่ตรวจ ไม่ใช่ Git comparison:

| File | SHA-256 |
|---|---|
| `combat-skill-coherence-plan.md` | `29A7AE1078161426DBE7F7C9B94324BE84EFFBEEF019FA8BC29620B5B08F69B7` |
| `skill-vfx-coherence-plan.md` | `89C15C83DC033DC9E7A72A91031BF9EC68EFFBDED75F4AFB774AAD451D0DDEA8` |
| `ro-field-population-roaming-playback-plan.md` | `3342EB05515C7B093F3677FD26BF04F451B6253BFFED8D3E957387F50002E020` |
