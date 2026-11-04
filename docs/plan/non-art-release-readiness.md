# Non-art v1 release readiness — execution plan

สถานะ: พร้อมลงมือ เริ่ม R0 แล้วทำ R1 → R6 ตามลำดับ

เป้าหมาย: ฟีเจอร์ปัจจุบันเล่นต่อเนื่องตั้งแต่ตัวละครใหม่จนผ่านเงื่อนไขชนะ เก็บความคืบหน้าและกลับมาเล่นต่อได้ พร้อมเปิดให้ผู้เล่นใช้งาน โดยงานภาพทั้งหมดอยู่นอกแผนนี้

แผนนี้ระบุการตัดสินใจของ v1 ไว้ล่วงหน้า ผู้ลงมือแก้ implementation ตามสัญญาด้านล่างได้ แต่ไม่เพิ่มฟีเจอร์ เปลี่ยนกติกา หรือเลือกราคาบาลานซ์ใหม่ระหว่างทำ หากคำสั่งใหม่ของเจ้าของเปลี่ยนสัญญา ให้แก้แผนก่อนทำส่วนที่ขึ้นกับการเปลี่ยนนั้น

## 1. ขอบเขตและเกณฑ์ 100%

ถือว่างานที่ไม่ใช่ภาพเสร็จเมื่อครบทุกข้อ:

- [ ] R0–R6 ผ่านครบด้วย input ชุดสุดท้าย ไม่มีสถานะ FAIL, BLOCKED หรือ INCOMPLETE ที่เกี่ยวกับ release
- [ ] ตัวละครใหม่และตัวละครที่โหลดใช้ session/clock เดียวกัน เซฟได้จริง และโหลดซ้ำไม่รับเวลาออฟไลน์ซ้ำ
- [ ] save/import/backup/error recovery/writer ownership ทำตามตาราง R1 โดยไม่ทำข้อมูลเดิมสูญหาย
- [ ] สกิลและเศรษฐกิจใช้ข้อมูล live ชุดเดียวกันทั้ง engine, sim, UI และ wiki; ปิดงาน rollout ด้านกลไกและ compatibility ตาม R2
- [ ] reference journey ใน R3 ชนะบอสจริงตาม `goal.target()` โดยใช้ทรัพยากรที่ได้ผ่านเกม แล้วเล่นต่อได้
- [ ] การใช้งานใน R4 ผ่าน headless browser ที่ 1920 × 1080 และผ่าน keyboard/focus/error feedback ที่กำหนด
- [ ] ผลวัด R5 ผ่านงบเวลาการทำงาน ไม่มีการทิ้ง simulation debt หรือยกเลิกข้อจำกัดเพื่อซ่อนปัญหา
- [ ] final gates R6 ผ่าน และผู้รายงานแยกผลตรวจจริงออกจากสิ่งที่ยังไม่ได้ตรวจ

ไม่นับการสร้าง/แก้ art, animation, icon, map art, VFX และไม่เพิ่มระบบใหม่จาก [stall idea](../stall-idea.md) เข้า scope การทำงานกับ scene ในแผนนี้จำกัดอยู่ที่ input, clock, UI behavior และการวัดประสิทธิภาพ

## 2. การตัดสินใจที่ล็อกไว้สำหรับ v1

| ID | การตัดสินใจ | ผลที่ผู้ลงมือต้องทำตาม |
|---|---|---|
| D01 | ใช้ฟีเจอร์และ catalogue live ปัจจุบันเป็นขอบเขต v1 | ไม่มีการเพิ่มระบบเกมหรือเติมข้อเสนอเก่าที่ไม่อยู่ใน live โดยอัตโนมัติ |
| D02 | จบ fresh-session phase ใน release | ลบ `FRESH_SESSION_PHASE` และ branch ชั่วคราวทั้งหมด; ไม่เพิ่ม configuration/feature flag ทดแทน |
| D03 | การโหลดสล็อตเป็นการกระทำที่ผู้เล่นเลือกเอง | boot เปิดหน้าต่าง Save และพัก simulation จนเลือก Load หรือ Start new character; ไม่เลือกสล็อตให้อัตโนมัติ |
| D04 | ตัวละครใหม่/import ยังไม่ผูกสล็อต | autosave เริ่มหลัง Save สำเร็จหรือ Load สำเร็จเท่านั้น; boot/new/import ไม่เขียนทับสล็อตเดิม |
| D05 | เวลาออฟไลน์จ่ายเมื่อโหลดสล็อตเท่านั้น | `createSessionActions().doLoad()` เป็น owner ของ catch-up; ลบ catch-up ของตัวละคร `newGame()` ใน boot |
| D06 | คงกติกาออฟไลน์ปัจจุบัน | ไม่เพิ่ม cap เวลา ไม่ให้เดินทาง/บอสออนไลน์เกิดระหว่าง away; cancel/error ต้องไม่ใช้เวลาซ้ำหรือทำสล็อตเดิมเสีย |
| D07 | บัญชีเดิมอยู่ต่อเมื่อสร้างตัวละครใหม่/import | ใช้ `readAccount()` + `applyAccount()`; Mastery ต่ออาวุธใช้ค่าสูงสุดตาม owner เดิม ไม่บวก XP ซ้ำ |
| D08 | ไม่เปลี่ยนรูปแบบ persistent state ในแผนนี้ | คง schema version ปัจจุบัน; startup choice, measurement และข้อความ guidance เป็น session/derived state |
| D09 | retired skill ที่ผู้เล่นมีอยู่ยังเป็นของผู้เล่น | เก็บ ID, ownership, duplicate count, XP, slots, modes, conditions และ presets; ไม่แปลงผ่าน `retired_to` และไม่ให้ replacement ฟรี |
| D10 | retired skill ไม่ถูกแจกใหม่ | drop/shop/reward/random offer ใช้ active pool เท่านั้น; owned view แสดงของเก่าเป็น Legacy และให้ถอด/จัดสล็อตได้ |
| D11 | ตัวเลข live เป็นค่า release candidate ของ v1 | ไม่เลือกค่าจากช่วงประมาณใน draft และไม่ปรับให้ทุกบิลด์มี DPS เท่ากัน; เก็บผลวัดก่อนปิดงาน |
| D12 | pending เรื่องรางวัล Task และ Reroll/Refine จบด้วยการคงค่า live | เมื่อ R2/R3 ผ่าน ให้ปิด pending พร้อม resolution ว่า v1 retains current authored values; ห้ามอ้างว่าค่าเหล่านี้เป็น optimum |
| D13 | ทดสอบ correctness ด้วย catalogue traversal และ synthetic cases | ชื่อ/จำนวน content, ราคา และเวลาพัฒนาตัวละครไม่เป็นค่าคงที่ใน assertions |
| D14 | คงระบบ HUD และ controls เดิม | ใช้ Save panel, Journey notices, Objective feed และ controls ที่มี; ไม่เพิ่ม HUD region หรือ tutorial framework |
| D15 | ข้อความและสูตรมี owner เดียว | ตัวเลขอยู่ JSON สูตรอยู่ engine; UI และ measurement เรียก reader เดิม ไม่คัดลอกสูตร |
| D16 | ตรวจที่ 1920 × 1080, headless, หนึ่ง tab ต่อ check | ไม่มี browser tool ให้รายงาน browser stage เป็น BLOCKED; ใช้ tests/check ทำงานส่วนอิสระต่อ แต่ยังปิด R4/R6 ไม่ได้ |
| D17 | ไม่มี publish หรือ Git checkpoint อัตโนมัติ | ไม่ commit/push/sync/reset/สร้าง branch/worktree; การ sync เป็นคำสั่งแยกจากเจ้าของ |
| D18 | CPU optimization มีแผนเจ้าของเฉพาะ | ทำตาม [combat performance plan](combat-performance-plan.md); แผนนี้เป็น owner ของ session/journey/UX/release acceptance และไม่ออกแบบ scheduler/ledger ใหม่ซ้ำ |

การอนุมัติให้ลงมือทำแผนนี้หมายถึงใช้สัญญา v1 ในตารางนี้ หากพบข้อมูล/โค้ดขัดกับสัญญา ให้ใช้ลำดับ owner: คำสั่งเจ้าของ → สัญญาแผนนี้ → mechanic contract ใน engine → live JSON → ข้อเสนอเชิงประวัติใน draft

## 3. ฐานที่ตรวจแล้วและแหล่งข้อมูล

ฐานจากการประเมินวันที่ 2026-11-03 ก่อนสร้างแผนนี้:

- `npm run typecheck`: ผ่าน
- `npm --prefix game run check`: ผ่าน 0 errors / 0 warnings
- `npm run verify`: 12/12 cages ผ่าน
- `npm test`: 2,293 ผ่าน; 1 timeout ใน `save-fidelity.test.ts` เคส `never spawns a boss while the player is away`
- `npm --prefix game run build`: ผ่าน มี large JS chunk warning; main ประมาณ 3,089 kB minified / 574 kB gzip ใน run นั้น
- fresh-session phase ยังเปิดอยู่; ตัวเลข catalogue และจำนวน tests เป็น snapshot ไม่ใช่ acceptance quota

ใช้ผลนี้ซ้ำเมื่อ input ที่เกี่ยวข้องยังไม่เปลี่ยน ไม่รัน full suite เพื่อยืนยันฐานเดิมซ้ำก่อนเริ่ม R0 และไม่สร้าง transcript/log file เพิ่ม Gate output เป็น run record

| สิ่งที่เป็นเจ้าของ | อ่าน/แก้ที่ |
|---|---|
| Session, load, import, reset, unload flush | [session.ts](../../game/src/app/session.ts), [saveSession.ts](../../game/src/state/saveSession.ts) |
| Storage, schema, migration, account merge, snapshots | [save.ts](../../game/src/state/save.ts) |
| Single writer | [accountWriterLock.ts](../../game/src/state/accountWriterLock.ts) |
| Boot และ wiring ของหน้าจอ | [App.svelte](../../game/src/App.svelte) |
| เวลา, live loop, away work | [clock.ts](../../game/src/sim/core/clock.ts), [loop.ts](../../game/src/app/loop.ts), [game.ts](../../game/src/sim/core/game.ts) |
| กลไกสกิล | [engine/skills.ts](../../engine/skills.ts), [skill-actions.ts](../../engine/skill-actions.ts), [sim skills.ts](../../game/src/sim/combat/skills.ts) |
| Catalogue และ balance values | [tools/data](../../tools/data), [skill rollout](../active-skill-redesign-draft.md) |
| Goal และคำแนะนำ | [goal.ts](../../game/src/sim/core/goal.ts), [guidance.ts](../../game/src/sim/core/guidance.ts), [tree-guide.ts](../../game/src/sim/core/tree-guide.ts) |
| UI tokens / reusable appearance | [variables.css](../../game/src/styles/variables.css), [skins.css](../../game/src/styles/skins.css) |
| Required workflow | [AGENTS.md](../../AGENTS.md) |
| Combat CPU/ledger/collision/selection/scheduling | [combat-performance-plan.md](combat-performance-plan.md) |

## 4. ลำดับงานและ dependency

| Stage | ผลลัพธ์ | ต้องผ่านก่อน |
|---|---|---|
| R0 | แก้ timeout fixture โดยรักษาการตรวจ offline boss | ไม่มี |
| R1 | Persistent session ที่ผู้เล่นใช้งานได้ครบ | R0 |
| R2 | ปิด mechanic/legacy/copy ของ skill rollout และ freeze v1 values | R1 |
| R3 | ปิด performance subplan แล้วได้ reference journey และรายงาน balance ที่เล่นผ่าน owner จริง | R2 |
| R4 | ผู้เล่นเริ่ม/เล่น/แก้ปัญหา/กลับมาเล่นได้จาก UI | R1–R3 |
| R5 | วัดและแก้ performance ตามลำดับที่กำหนด | R4 |
| R6 | ตรวจ input ชุดสุดท้ายและปิด non-art readiness | R0–R5 |

ทำทีละ stage อย่าเริ่ม stage ถัดไปด้วยผลที่ยัง FAIL/INCOMPLETE งานที่ทับไฟล์เดียวกันทำเรียงลำดับ งานตรวจอ่านอย่างเดียว batch ได้ รักษา concurrent edits และรายงาน baseline/in-flight failure ตาม AGENTS

## R0 — Offline boss regression ที่ตรวจที่ event boundary

- [ ] R0.1 แก้เฉพาะสองเคสแรกใน `game/tests/app/save-fidelity.test.ts` หมวด offline time

การเปลี่ยนที่กำหนด:

1. เคสห้ามบอสออฟไลน์: สร้าง fixture เดิม แล้วตั้ง `bossDueAt = clockSec + 2`; เรียก `catchUp(state, 5)` ให้ข้าม deadline ที่ตั้งไว้
2. assert ว่าได้ครบ 5 simulated seconds, ไม่มี boss spawn ใน log และไม่มี boss ใน group
3. เอา assertion ว่าต้องฆ่ามอนสเตอร์ได้ออกจากเคสนี้ เพราะการฆ่าขึ้นกับกำลังตัวละคร ไม่ใช่สัญญาเรื่อง boss; soak/combat tests เป็น owner ของ combat progress
4. เคส boss clock: ใช้ deadline และ away window แบบ synthetic เดียวกัน ตรวจ remaining time ก่อน/หลังเท่ากัน
5. ลบ timeout override `30000` ของเคสแรก ใช้ timeout ของ suite
6. คง online boss-spawn case และ tests ของ catch-up parity/cancellation เดิม

ตัวเลข 2/5 เป็น synthetic timeline เพื่อข้าม event boundary ไม่ใช่การเปลี่ยน cadence ของเกม ห้ามลดระยะ away ของ production หรือข้าม sim work เพื่อให้ test ผ่าน

- [ ] R0.2 รัน focused tests จาก `game/`:

```powershell
npm exec -- vitest run tests/app/save-fidelity.test.ts tests/sim/clock.test.ts tests/sim/mob-clock.test.ts
```

ผ่านเมื่อ: offline boundary/cadence/parity/cancellation ถูกตรวจครบ เคสเดิมไม่ต้องจำลอง 3 ชั่วโมงเพื่อพิสูจน์กติกาเดียว และไม่มีการเปลี่ยน gameplay values

## R1 — เปิด persistent session ให้ครบทั้งวงจร

### R1.1 ลบ phase ชั่วคราวและกำหนด boot

- [ ] ลบ `FRESH_SESSION_PHASE` จาก `state/saveSession.ts` และ import/branch ที่เกี่ยวข้องทั้งหมดใน `app/session.ts`, `App.svelte`, `tests/app/save-session.test.ts`
- [ ] เก็บ showcase guard, account writer lock, settings, layout migration และ read-only rules เดิม
- [ ] regular boot เริ่ม paused และเปิด Save panel; ข้อความ: `Load a character, or start a new one. Existing slots are kept.`
- [ ] ใช้ `startupPending` เป็น transient state ใน `App.svelte`; ส่ง `running && !startupPending` ให้ loop/run-mode reader เพื่อให้ `doLoad()` ที่เปลี่ยน `paused` ใน finally ไม่ปล่อย startup ที่ยังไม่สำเร็จให้เดินเวลา
- [ ] Load สำเร็จปิด startup state และ resume ตาม session flow; Load ล้มเหลวยังอยู่หน้า Save และ paused
- [ ] เพิ่มปุ่ม `Start new character` ใน Save panel เรียก session reset path เดียวกับ New character เดิม; หลังสำเร็จจึงปิด startup state และเริ่ม run
- [ ] ไม่มี auto-load, auto-overwrite หรือ auto-save ของตัวละครที่เพิ่งสร้างจาก boot
- [ ] ลบ boot catch-up block ที่คำนวณ away จาก `newGame().lastSavedAt`; `doLoad` เป็นจุดจ่าย away เพียงจุดเดียว
- [ ] ลงทะเบียน wake loop, autosave และ unload/visibility handlers หลัง boot initialization เสร็จเพียงชุดเดียว; unmount ต้องยกเลิกครบ

### R1.2 Session contract

- [ ] `reset()` เป็น async เพื่ออ่าน account แล้ว `applyAccount(account, newGame(...))`; detach สล็อตก่อนเปลี่ยน state และใช้ epoch ป้องกันผล read เก่ามาทับ run ใหม่
- [ ] `upload()` validate import ก่อน แล้ว apply shared account ด้วย owner เดิม จากนั้น detach และแสดง unsaved character; error เก็บ run/slot เดิม
- [ ] `doLoad()` รักษา previous run/slot/UI จน read+migration+catch-up สำเร็จ จึง attach สล็อต
- [ ] cancelled load ไม่ persist partial candidate และไม่เปลี่ยน timestamp บน stored slot; retry จ่าย away จาก stored input เดิมหนึ่งครั้ง
- [ ] Save สำเร็จหลัง durable write เท่านั้นจึง attach; write failure ไม่ทำให้ UI แสดง Saved หรือเริ่ม autosave ลงสล็อตที่ยังไม่เคยสำเร็จ
- [ ] เมื่อ slot attached แล้ว ใช้ autosave และ synchronous emergency mirror เดิม; ไม่เพิ่ม storage backend หรือ schema ใหม่
- [ ] unslotted character มี notice คงอยู่: `Not saved yet. Choose a slot to keep this character.` พร้อมปุ่มเปิด Save panel
- [ ] read-only/unsupported writer status ต้องอธิบายการพัก run และให้ export recovery เมื่อมี run ในหน่วยความจำ; ห้ามเขียนอ้อม lock
- [ ] showcase ไม่อ่าน/เขียน player save และไม่เข้าสู่ startup chooser

### R1.3 ตาราง regression ที่ต้องมี

ขยายไฟล์ tests เดิมก่อนสร้างไฟล์ใหม่ ใช้ storage fixtures/fakes ที่ repo มีอยู่ ไม่เพิ่ม dependency

| Case | Expected result | Test owner |
|---|---|---|
| Boot โดยไม่มี save | paused ที่ Save; New เริ่ม unslotted; สล็อตไม่ถูกเขียน | `save-session.test.ts` + browser R4 |
| Boot โดยมี save | ยังไม่ catch up/เขียน; Load ที่เลือกจึงทำงาน | `save-session.test.ts` |
| New หลังเคยโหลด | detach; old slot bytes เดิม; shared Mastery คงค่าที่ account มี | `save-session.test.ts` |
| Import ถูกต้อง | run ใหม่ unslotted; XP/ownership คง; account Mastery ไม่ลด | `save-session.test.ts`, `save-fidelity.test.ts` |
| Import/Load ผิด schema หรือ tree version | named error; run/slot/raw file เดิมคง | `save-fidelity.test.ts` |
| Save write ล้มเหลว | ไม่ attach/ไม่แสดง success; recovery export ใช้ได้ | `save-storage.test.ts`, `save-session.test.ts` |
| IndexedDB ใช้ไม่ได้แต่ mirror ใช้ได้ | read/write ผ่าน fallback เดิม และรายงาน durable success จริง | `save-storage.test.ts` |
| ทุก storage เขียนไม่ได้ | เก็บ run ใน memory; alert และ recovery export; ไม่กล่าวว่า Saved | `save-storage.test.ts` |
| Load A ค้าง แล้วเลือก B/New/Import | epoch เก่าทับ state หรือ attach slot ไม่ได้ | `save-session.test.ts` |
| Away ข้าม boss deadline | เวลา boss ออนไลน์คง; ไม่มีเดินทาง/บอสใหม่ออฟไลน์ | R0 + `clock.test.ts` |
| Reload หลัง catch-up และ save | ไม่จ่ายช่วงเวลาเดิมซ้ำ | `save-fidelity.test.ts` |
| Cancel catch-up | old run/slot คง; candidate ที่คำนวณบางส่วนไม่ถูกเซฟ | `save-session.test.ts` |
| Writer อีก tab ยึดอยู่/มี takeover | read-only ไม่ tick/เขียน; takeover reload ก่อน resume | writer-lock tests + `run-modes.test.ts` |
| Backup restore | restore ทั้ง state และ rebuild account ตามกติกาเดิม | `save-fidelity.test.ts` |
| Showcase | zero player storage I/O; preference rules เดิม | `save-session.test.ts` |

ผ่าน stage เมื่อ: ไม่มี symbol/ข้อความ fresh-session เหลือใน production path, unit regressions ทุก case ผ่าน และ startup/catch-up/wake มี owner เดียว Browser rows ของ R1 ไปตรวจใน R4 หลัง dependency พร้อม; ไม่เป็นเงื่อนไขย้อนกลับของ stage R1

```powershell
# game/
npm exec -- vitest run tests/app/save-session.test.ts tests/app/save-storage.test.ts tests/app/save-fidelity.test.ts tests/app/writer-lock.test.ts tests/app/account-writer-actions.test.ts tests/app/run-modes.test.ts tests/app/loop-pause.test.ts tests/app/settings-compat.test.ts
npm run check
```

## R2 — ปิด skill rollout, legacy compatibility และ freeze ค่า v1

### R2.1 Reconcile ตาม capability

- [x] อ่าน live `skills.json` แล้ว traverse active rows ผ่าน model; ใช้ draft เป็นประวัติข้อเสนอ ไม่ใช้หัวข้อ `PROPOSED NEW` เป็นข้อสรุปว่ายังไม่มี implementation
- [x] ตรวจสัญญาต่อไปนี้ด้วย regression แบบ synthetic และ current-catalogue traversal ใน tests เดิม:

| Capability | สัญญาที่ต้องตรงกันใน engine/sim/away/UI |
|---|---|
| consume status | จ่าย/ลบเฉพาะ stacks ที่ operator ระบุ ไม่มี damage ซ้ำจาก stack ที่ใช้แล้ว |
| footprint spread | snapshot จาก primary ก่อนกระจาย; ไม่สร้าง duration/stack ฟรีและไม่กระจายออกนอก footprint |
| distinct targets | acquisition แยกจาก radius ของ impact และแต่ละ target ไม่ถูกเลือกซ้ำใน budget เดียว |
| field impacts | initial impact อยู่ใน hit budget; interval และ first pulse ใช้ scheduler owner เดียว |
| per-impact / refresh-status | policy ของ row เกิดตาม impact ที่สัญญาระบุ ทั้ง live และ offline |
| ray channel | จ่าย mana เป็น discrete ticks; manual release/auto completion/trigger exclusion ตรงกัน |
| instant sweep | damage/control resolve ตาม instant mechanic; UI copy ไม่กล่าวว่ากลไกตีตามภาพทีละช่วง |
| cast lock | รวม windup/recovery จาก canonical readers โดยไม่บวก fixed windup ซ้ำ |

- [x] หาก contract test ล้ม ให้แก้ owner ของ behavior แล้วเช็ก callers; หาก runtime ตรง contract แต่ copy ต่าง ให้แก้ copy/wiki โดยคงตัวเลข
- [x] ขยาย `skill-mechanic-contracts`, `skill-level-effects`, `offline-spatial`, `skill-copy`, `skill-handoff` ที่มีอยู่ ห้ามสร้าง tests ผูกกับจำนวน/รายชื่อ roster ปัจจุบัน

### R2.2 Legacy policy ที่ต้องลงมือ

- [x] คง retired rows ใน `sm.byId`; active acquisition ใช้ active readers เดิมเท่านั้น
- [x] แก้ comment ของ active pool ให้ตรงสัญญาใหม่: `sm.all()` ยังคง active-only แต่ owned view รวม legacy จาก `byId` ได้; ใช้ isolated model/fixture สำหรับ retirement regression ไม่ mutate shared global catalogue
- [x] migrate/import/export คง owned retired IDs, duplicate/XP และ loadout metadata โดยไม่ย้ายไป `retired_to`
- [x] `SkillsWorkbench.svelte` อ่าน owned rows จาก owned IDs + `sm.byId` เพื่อไม่ทำของเก่าหายจาก UI; แสดง active ก่อน legacy แล้วใช้ sort เดิม
- [x] legacy row มีป้าย `Legacy` และข้อความ `No longer drops. Your owned copy and XP are kept.`; replacement name เป็นข้อมูลประกอบ ไม่มีปุ่มแจก replacement
- [x] ของเก่ายังถอด/ใส่/จัดลำดับได้ภายใต้ eligibility และ slot rules เดิม; ห้ามรีเซ็ต buff/XP เพราะเปิด owned view
- [x] test synthetic retirement ครอบคลุม duplicate, XP, manual/conditional mode, conditions, preset, export/import และ repeat migration; assert idempotence และไม่เกิด replacement ownership ฟรี
- [x] test traversal ว่า retired rows ไม่อยู่ใน new-drop/reward/shop pools และ active refs ไม่ชี้ missing/retired rows

ไฟล์หลัก: `engine/skills.ts`, `game/src/state/save.ts`, `game/src/sim/core/presets.ts`, `game/src/ui/character/SkillsWorkbench.svelte`; เพิ่ม regression ใน `save-fidelity`, `skill-identity`, `skill-eligibility`, `skill-handoff` ตาม owner

### R2.3 Balance freeze และการปิดเอกสาร

- [x] เก็บค่าตัวเลข live ไว้ระหว่างงาน correctness; ไม่แปลงช่วงประมาณ/ทางเลือกจาก draft เป็นค่าอนุมัติ
- [x] รัน skill calculations สอง reference builds ที่ tool รองรับและ economy baseline; output เป็นหลักฐานการวัด ไม่เป็น thresholds ใน tests:

```powershell
# root
npm run skills -- --checks
npm run skills -- --calc --build glass
npm run skills -- --calc --build caster
npm run economy:baseline
```

- [x] คงสองรายการ `town.json.pending` ที่ระบุ Task sizing และ Reroll/Refine ไว้เปิดจน R6; D12 กำหนด disposition แล้ว และ R6 เป็นจุดปิดหลังผล journey พร้อม ไม่เป็น dependency ย้อนกลับของ R2
- [x] ใน skill draft ปิดเฉพาะ mechanic/legacy/data/copy checklist ที่มีหลักฐานแล้ว; measurement และ final verification ปิดใน R6 หลัง R3 ผ่าน แยก visual remainder ไว้ชัดเจนและไม่กล่าวว่าทั้ง draft จบถ้า VFX ยังเหลือ
- [x] อัปเดต player-facing wiki ที่ owner [pages.ts](../../game/src/wiki/pages.ts); รัน `npm run wiki` หลัง behavioral/copy input ชุดสุดท้ายของ stage

ผ่านเมื่อ: แถว live อ่านตรงกันทุก consumer, legacy state ไม่สูญหาย, ไม่มี acquisition ของ retired rows และคำว่า closed ทุกจุดมีผลตรวจรองรับ

## R3 — พิสูจน์เส้นทางเล่นและวัดบาลานซ์โดยไม่สร้าง pacing assertions

### R3.0 Performance subplan ก่อนเล่นยาว

- [x] ทำ stages 0–5 ของ [combat-performance-plan.md](combat-performance-plan.md) ให้ครบก่อนเริ่ม journey ยาว ใช้ implementation, benchmark, regression และ acceptance ของไฟล์นั้นเป็น owner
- [x] ถ้าส่วนใดทำเสร็จแล้วให้ตรวจ diff/evidence และ reuse เมื่อ inputs ยังตรง ไม่ทำ optimization เดิมซ้ำ; ถ้า completed plan ถูกลบตามกติกา ให้อ่านฉบับสุดท้ายจาก Git history และตรวจผลกับ source/benchmark ปัจจุบัน
- [x] หลังเปลี่ยน CPU/scheduling ให้ focused session/clock/skill tests จาก R1/R2 ที่ได้รับผลผ่านอีกครั้งก่อนสร้าง journey checkpoint แรก
- [x] ใช้ผลใหม่แทน baseline เดิมเมื่อ inputs เปลี่ยน ไม่คัดลอก performance thresholds มาเป็นอีกชุดในแผนนี้

### R3.1 Measurement harness ที่กำหนด

- [x] เพิ่ม `tools/release-journey.mjs` และ script `measure:release` ใน root `package.json`: `node tools/release-journey.mjs`
- [x] runner ใช้ installed Vite ของ `game` ผ่าน `createRequire` anchored ที่ `game/package.json` แล้ว middleware-mode SSR ด้วย `game/vite.config.ts`, ปิด dependency discovery, ไม่เปิด listening port และ close ใน `finally` ตาม bootstrap pattern ของ performance subplan
- [x] เพิ่ม `game/measurements/release-journey.ts` เป็น owner ของ deterministic policy, slice advance และ outcome comparison; Node runner โหลดผ่าน Vite SSR และเป็น owner เฉพาะ CLI/checkpoint I/O ไม่มี Vitest config หรือ dependency เพิ่ม
- [x] เพิ่ม `game/tests/app/release-journey.test.ts` ตรวจ policy tie-break, pause/refusal, resume-vs-uninterrupted equivalence บน synthetic short run และ resource exit ที่ไม่กลายเป็น PASS; ไม่ให้ unit test รัน natural journey ทั้งเกม
- [x] ทุก scenario รายงาน `PASS`, `FAIL` หรือ `INCOMPLETE` พร้อมเหตุผล; exit code 0 เมื่อทุก scenario ผ่าน, 1 สำหรับ correctness failure, 2 สำหรับ resumable resource cutoff ไม่มีการแปลง resource timeout เป็น PASS
- [x] ใช้ `newGame(20261103)` สำหรับ reference run และ loop จาก `createGameLoop()` โดย call `step()`; ใช้ authored combat step และ settings ปัจจุบัน: auto skills/equip/avoid เปิด, hold position ปิด, target nearest, speed 1
- [x] adapter มี `transactionWriter/canWriteAccount = true` ใน memory, `equipCarriedBest = autoEquip(state, 0)` และ arena จาก public create/sync path; ไม่ใช้ browser storage ใน measurement
- [x] checkpoint เพื่อเปรียบเทียบใช้ `exportJson/importJson` ใน memory; natural journey ใช้ resumable state artifact ตามกติกาด้านล่าง ไม่ใช้ save ของผู้เล่นจริงและไม่สร้าง transcript
- [x] เพิ่ม exclusion เฉพาะ `game/.cache/release-journey/` ใน `.gitignore` ตอน implement; เก็บเฉพาะ exported GameState และ runner cursor ที่ต้องใช้ resume ไม่เก็บ log/report ซ้ำกับ gate output
- [x] checkpoint path คือ `game/.cache/release-journey/<fingerprint>.json`; fingerprint เป็น SHA-256 ของ path+content ที่เรียงลำดับจาก `engine/**/*.ts`, `tools/data/*.json`, `game/src/engine/*.ts`, `game/src/sim/**/*.ts`, `game/src/app/loop.ts`, `game/src/state/save.ts`, `tools/release-journey.mjs` และ `game/measurements/*.ts`
- [x] envelope มี `formatVersion: 1`, fingerprint, seed, exported save JSON, cursor ของ tree/policy, zone/Push/gear milestone ที่ใช้ตัดสิน retry; ไม่มีผลตรวจหรือภาพอยู่ในไฟล์นี้
- [x] command เดิม resume checkpoint ที่ fingerprint ตรงอัตโนมัติ; source เปลี่ยนใช้ path ใหม่และเริ่มใหม่ เก็บของเดิมไว้ ไม่ลบ cache/ข้อมูลผู้เล่นอัตโนมัติ; resume ไม่เรียก away catch-up จากเวลาผ่านไประหว่างการตรวจ

### R3.2 Reference-player policy — ลำดับตายตัว

ประเมิน action queue ทุกครั้งที่ `clockSec` เปลี่ยน ใช้ public sim actions เท่านั้น และไม่เริ่ม action ใหม่ขณะ walking/camp/committed action บังคับให้รอ ลำดับ:

1. ถ้า `goal.done` เกิดแล้ว ให้เดิน clock ต่อหนึ่ง world second ตรวจว่า run ยังทำงาน แล้วจบ PASS
2. ทำ pending fixed/choice quest reward ที่พร้อมรับ; choice ใช้ branch ID ที่เรียง lexical ตัวแรก เพื่อให้ replay คงที่
3. ใช้ auto-equip ผ่าน loop เดิม; สกิลจาก drop ใช้การ auto-fill เดิม ไม่ grant skill/gear/stone เพิ่ม
4. ใช้ tree recommendations วน `survival → mana → weapon → skills`; เลือก recommendation ที่ affordable ตามอันดับ reader เดิม แล้วซื้อผ่าน `allocateTreePath`; ทำจนไม่มีรายการที่ซื้อได้ เก็บแต้มที่ยังใช้ไม่ได้ไว้
5. คง `autoEat` defaults ของ `newGame()` และให้ hunger owner ทำงานเอง; ช่อง quickbar ว่างเติมเฉพาะ potion ที่มีจริงและยังไม่อยู่บน bar ตามลำดับ `ownedPotions()` โดยใช้ `cycleQuickbar()` จนถึงเป้าหมาย เก็บช่องที่เลือกไว้แล้ว ไม่เติม hunger/pools โดยตรงหรือเพิ่มค่า threshold ใหม่
6. ถ้ากระเป๋าเต็ม ให้เดินกลับ settlement เจ้าของพื้นที่ด้วย `startWalk`; เมื่อถึงเรียงการจัดของเป็น auto-equip → รับรางวัลที่ไม่ทำให้ล้น → ขาย junk ผ่าน market owner → ฝาก gear ที่ไม่ lock/reserve ลง tab ที่มีที่ว่างเรียง index → `runFilterNow` ตาม verdict เดิม
7. ถ้ายังเต็มและทุก action ปฏิเสธ ให้รายงาน `INCOMPLETE: inventory-policy-blocked` พร้อม refusal และ preview; ห้ามลบ item หรือปิด cap เพื่อให้ bot ไปต่อ
8. เลือกพื้นที่ถัดไปจาก authored zone order เมื่อถึง minimum level ของ zone นั้นและมี land route; เดินไปจริง ไม่ใช้ `huntZone` เป็นทางลัดเพราะ helper นั้นเปลี่ยนตำแหน่งในการตั้งฉากทดสอบ
9. เลือก hunt cell ที่ walkable, rank > 0, ไม่มี gathering site และอยู่ใน zone เป้าหมาย: route สั้นสุดก่อน แล้ว `q`, `r` น้อยสุด; เดินด้วย `startWalk` และเริ่มด้วย `huntHere`
10. หลัง Push จากพื้นที่ใหม่ กลับฟาร์ม zone ก่อนหน้าจนมี level-up หรือ gear swap จริง แล้วลองพื้นที่ใหม่อีกครั้ง; ไม่ลด mob stats หรือ force reward
11. เมื่อถึง final zone ให้รอบอสผ่าน online cadence ปกติจน `goal.onKill` บันทึก win; ไม่ force spawn/HP/PS, ไม่ `setLevel`, ไม่เติมเงิน/แต้ม/ทรัพยากร และไม่แก้ counters

ตัวเลือก/route ที่คะแนนเสมอกันทั้งหมดใช้ ID/coordinate lexical เป็น tie-break ไม่เพิ่ม randomness นอก RNG ของ run

### R3.3 Scenario และ output ที่ต้องได้

| Scenario | Input / วิธีตรวจ | ผ่านเมื่อ |
|---|---|---|
| Natural reference journey | policy ด้านบน ตั้งแต่ newGame ถึง goal.done | ได้ win จาก encounter จริงและ post-win tick ยังทำงาน |
| Zone checkpoints | ที่การเข้าแต่ละ zone ครั้งแรก export/import state | ownership, resources, location, pending work และ progression คง; ไม่มีผลตอบแทนซ้ำ |
| Away equivalence | clone checkpoint ที่กำลัง hunt: away 2 ชั่วโมงแบบ async หนึ่งครั้งเทียบหลาย slices | canonical sim state/ผลตอบแทนตรงกัน ไม่เดิน/เกิด boss และ cancel รักษา state boundary |
| Build capability matrix | traverse live rows ที่มี physical melee, physical ranged และ elemental magic capability; isolate battle fixtures ผ่าน test helpers | ทุก capability มีตัวแทนจริงและ resolve damage/resource/status/cast contract ได้; ขาด capability ให้ fail ระบุชื่อ |
| Craft/economy routes | traverse required inputs/outputs ผ่าน acquisition readers และ dependency graph เดิม | required resource มีทางได้ที่ทำได้จริงก่อน unlock ที่ต้องใช้; ค่า/จำนวน finite ไม่ติด dependency cycle |
| Trading and repeated actions | ใช้ market/delivery/forge/craft actions เดิมบน cloned earned checkpoints | ไม่เกิด duplication/free refund, storage cap/lock/reservation ถูกบังคับ และการจ่ายตรง preview |

Output เป็นตาราง stdout: milestone/zone, simulated online/away seconds, wall time, level, kills, Pushes, drops, gold earned/spent, bag/stash occupancy, gear swaps, tree spending, skill IDs ที่ใช้, action refusals และ first win record ตัวเลขอ่านจาก owners/counters จริง

resource guard ของหนึ่ง measurement invocation คือ wall time 30 นาที Guard นี้คุมต้นทุนการตรวจ ไม่ใช่เวลาเล่นที่ถือว่าบาลานซ์ดี เมื่อถึง guard ให้เขียน resumable state artifact แบบ atomic temp-file/rename ใน directory ของ harness แล้วรายงาน INCOMPLETE พร้อม milestone ล่าสุด ผู้ลงมือเรียก command เดิมเพื่อ resume ต่อจนได้ win จริง โดย R3 ยังไม่ผ่านระหว่างนั้น ห้ามเพิ่ม cap เวลา offline หรือลดความยากเพื่อให้พอดี guard

กรณี journey ไม่สำเร็จให้แยกตามตารางนี้:

| สาเหตุ | การทำงานที่กำหนด |
|---|---|
| Runner ไม่ใช้ action ตาม policy / ผิด eligibility | แก้ harness; ไม่แก้เกมให้ bot ได้สิทธิพิเศษ |
| Invalid/NaN, duplicate payout, unreachable required source, UI/sim จ่ายต่างกัน | แก้ owner ที่ผิดพร้อม synthetic regression แล้ววัด scenario ที่ได้รับผลใหม่ |
| ยังเล่นคืบหน้าแต่หมด resource guard | คง INCOMPLETE และ resume command เดิมจาก harness checkpoint; ไม่เรียกว่าเกม softlock และไม่ปิด R3 |
| ต้องเปลี่ยนกติกาหรือ balance values จึงจะผ่าน | รายงาน BLOCKED พร้อม checkpoint/action refusals; ไม่เลือกตัวเลขใหม่เอง สัญญา v1 ต้องถูกแก้โดยเจ้าของก่อน |

**R3 evidence (2026-11-04):** `npm run measure:release` produced zone 2 at level 17, then stopped at `INCOMPLETE: inventory-policy-blocked` with bag 100/100, 74 carried gear pieces, no stash tab bought, and one recorded refusal at `atSec 3637`. The checkpoint is under `game/.cache/release-journey/`; no item was deleted and no cap was relaxed. Away equivalence (7,200 s sync vs async), zone checkpoint round-trip, build capability matrix, economy-reference resolution and repeated-sale boundary all passed on the same run. Natural win is not achieved, so R3 remains open pending an owner decision on the inventory-policy block; no balance value or game rule was changed to force a win.

ผ่านเมื่อ: ทุก scenario ผ่าน มี lawful reference win และมีรายงาน pacing/economy จาก live values โดยไม่ตรึง tuned windows/ราคา/roster counts ใน correctness tests

## R4 — เส้นทางใช้งานของผู้เล่นและ onboarding

### R4.1 การแก้ UI ที่ระบุไว้

- [x] ใช้ startup Save panel และ unsaved notice จาก R1; อ่าน attached slot จาก `CharacterSaveSession` เท่านั้น
- [x] ต่อ context การเซฟเข้า `guidanceNotices()` ด้วย runtime context; ไม่เก็บ tutorial flags ลง save
- [x] notice priority: persistence error → writer restriction → startup/unsaved status → immediate blocked action → tracked objective → recommendation เดิม
- [x] ผู้เล่นออกเดินทางได้โดยไม่ต้องแก้ settings; หากยังไม่มีอาวุธ/สกิล ให้คำแนะนำว่าต่อสู้ unarmed และเก็บ drop ได้ โดยไม่แจก starter content ใหม่
- [x] goal/shortage buttons เปิด panel และ selection ของ owner เดิม; ห้าม copy สูตรราคา วัตถุดิบ หรือเดินทางใน UI
- [x] failed actions แสดงเหตุผลเดิมจาก verdict และบอก next action ที่ทำได้; ไม่ใช้ข้อความ success เมื่อ action ไม่เกิด
- [x] ใช้ controls, classes, tokens, focus restoration และ saved HUD layout migration เดิม; ไม่เพิ่ม region
- [x] final-goal completion แสดงจาก `goal.done` และเล่นต่อได้ ไม่สร้าง prestige/reset/reward ใหม่

### R4.2 Browser checks ที่กำหนด

reuse server port 5173; headless, 1920 × 1080, snapshot+console+interaction, ปิด browser หลังแต่ละ check ไม่ใช้ save/profile ของผู้เล่นจริง

| Check | ลำดับการกระทำ | Expected result |
|---|---|---|
| Fresh boot | เปิด storage ว่าง → Start new → Save slot1 → reload → Load slot1 | startup ชัดเจน; run คงและ away ถูกจ่ายครั้งเดียว |
| Owned slot | เล่นต่อ → Save → New → reload → Load เดิม | New ไม่ทับสล็อต; shared account คง |
| Import/export | export → import → เลือกสล็อตอื่น → reload/load | import ยัง unslotted จน Save; ของเดิมคงและ JSON กลับมาได้ |
| Backup/error | snapshot restore fixture และ invalid import fixture | state/error/recovery path ถูกต้อง ไม่มี console exception |
| First hunt | จาก town ใช้ map arrows เลือก adjacent block → Enter → hunt → ได้ drop → เปิด bag | selection ประกาศ; เดิน/ล่า/auto-equip ตรง state ไม่มี action ที่ดูสำเร็จแต่ไม่เกิด |
| Character build | เปิด tree → ซื้อ path → skills ใส่/ย้าย/ถอด → กลับ field | แต้ม/eligibility/copy ตรง owner และ focus กลับที่ควรอยู่ |
| Craft shortage | เปิด craft ที่ของไม่ครบ → กด source/goal → หา/รับของ → กลับ craft | รายการที่เลือกคง เหตุผลอัปเดตตามของจริง ไม่ทำ resources หาย |
| Town loop | ขายของ/รับ delivery/ส่งบางส่วน/เลือก bonus/รับครบ | quote/payment/slot/feedback ตรง sim ไม่มีจ่ายซ้ำ |
| Pause/hidden/resume | pause → รอ → resume และ hide/show อีก scenario | paused time ไม่กลายเป็น away; hidden backlog ไม่หาย |
| Showcase | เปิด `__showcase#showcase-field` → ใช้ controls ที่อนุญาต | ไม่มี player-save I/O และไม่มี startup chooser |

writer takeover หลาย tab ตรวจด้วย unit tests R1; browser check นี้คงหนึ่ง tab ตาม working agreement

**R4 evidence (2026-11-04):** no Playwright/browser automation tool is available in this session. The R4.1 source paths were inspected and `npm --prefix game run check` passes; the bag-full notice now sends its `map` action to the existing map owner. The R4.2 browser rows remain BLOCKED, so R4 is not claimed as passed.

ผ่านเมื่อ: ทุก flow ทำได้ด้วย keyboard และ pointer, มี label/visible focus/error feedback, console ไม่มี uncaught errors และไม่มี browser-required row ที่ยังไม่ได้ตรวจ

## R5 — Performance และ build readiness

- [ ] ใช้ production build สำหรับ load/interaction measurements; ใช้ HMR showcase สำหรับ component checks เท่านั้น
- [ ] เช็ก port 5173 ก่อนเสมอ ถ้าว่างให้ใช้ `npm run preview -- --port 5173 --strictPort` จาก `game/`; ถ้าเป็น production preview ที่มีอยู่ให้ reuse ถ้าเป็น dev server ให้ reuse สำหรับ R4 แต่ production measurement เป็น BLOCKED จนผู้ดูแล server เปลี่ยนโหมด ห้ามฆ่า server หรือเปิด port อื่นเอง
- [ ] วัด opening scene, crowded scene จาก catalogue ที่ population สูงสุด และ away load 24 ชั่วโมงจาก earned checkpoint
- [ ] หนึ่ง measurement series ใช้ 3 samples บนเครื่องเดียวกันและบันทึก browser/CPU/run inputs; รายงาน p50/p95/max ไม่เทียบคนละเครื่องเป็น regression

| สิ่งที่วัด | งบ operational ของ v1 | วิธีแก้เมื่อไม่ผ่านตามลำดับ |
|---|---|---|
| Sim step work | acceptance ของ performance subplan ต้องผ่านกับ final inputs | ใช้ benchmark/profile และ implementation stages ของแผนเจ้าของ; ไม่เพิ่ม architecture หรือ threshold ชุดใหม่ |
| Action → UI feedback | p95 ≤ 100 ms สำหรับเปิด panel/เลือก slot/ย้าย map selection | ตัด root state reassignment ที่ไม่จำเป็น → reuse derived owners → lazy-load panel ที่ trace ยืนยันว่าเป็นสาเหตุ |
| Away interaction | UI ได้ yield ภายใน 50 ms; cancel ตอบภายใน 250 ms | คง CPU-slice owner จาก performance subplan; แก้ bridge/lifecycle ที่ทำให้ browser ไม่ได้รับ yield โดยไม่ cap away หรือทิ้ง simulation debt |
| Browser correctness ระหว่าง load | ไม่มี uncaught error, freeze ที่ยกเลิกไม่ได้ หรือ duplicate catch-up | แก้ lifecycle/epoch/clock owner ก่อน optimize bundle |
| JS chunk warning | รายงานขนาดและ import graph | หากงบด้านบนผ่าน ให้ยอมรับ warning สำหรับ v1 พร้อมเหตุผล; หากไม่ผ่าน ให้แก้เฉพาะ module ที่ trace ระบุ ห้ามเพิ่ม warning limit เพื่อซ่อน |

งบ UI/CPU ไม่ใช่ gameplay pacing bands จึงแยกจาก balance measurement R3 ไม่มีการเปลี่ยนสูตร/ความยาก/จำนวน spawn เพื่อให้เครื่องทำงานเบาลง

ถ้าต้อง lazy-load ให้คง state ของ panel ผ่าน session owner เดิม และมี regression ว่าปิด/เปิด panel ไม่ล้าง selection, ไม่เพิ่ม wake loop และไม่เปลี่ยน save state ห้ามเพิ่ม dependency หรือย้าย shared formulas ออกจาก engine

**R5 evidence (2026-11-04):** `npm --prefix game run build` passes for the final inputs; the main chunk is 3,104.23 kB (578.30 kB gzip), the wiki chunk 259.79 kB and the passive-tree chunk 858.70 kB, so the existing >500 kB warning remains reported rather than hidden. No browser measurement series was possible without a browser automation tool; the production/preview interaction rows are therefore BLOCKED, and R5 is not claimed as passed.

ผ่านเมื่อ: operational budgets ผ่าน และมี comparison ก่อน/หลังสำหรับทุก optimization ที่ทำจริง

## R6 — Final verification และปิดงาน

- [ ] ตรวจ final diff ว่าแตะเฉพาะ non-art scope และรักษา concurrent edits
- [ ] อัปเดต skill rollout/README ด้วยสถานะที่มีหลักฐาน; ข้อความเก่า `9 failures` ไม่ใช่ผลตรวจปัจจุบัน
- [ ] เมื่อ R2 และ R3 ผ่านแล้ว ปิดสองรายการ `town.json.pending` ตาม D12 พร้อม resolution `v1 retains current authored values; correctness gates and release journey passed`; คงค่าราคา/รางวัลเดิม และปิด measurement/final verification ของ skill draft เฉพาะงานที่มีหลักฐาน
- [ ] wiki generation ทำหลัง input ด้าน player-facing behavior/formula/copy เปลี่ยนครั้งสุดท้าย; generated HTML ไม่ hand-edit
- [ ] รัน checks ต่อไปนี้กับ final inputs หนึ่งรอบ; reuse ผลผ่านก่อนหน้าได้เฉพาะ input ที่เกี่ยวข้องไม่เปลี่ยน:

```powershell
# root
npm run lint
npm run typecheck
npm run verify
npm test
npm run measure:release
```

```powershell
# game/
npm run check
npm run build
```

- [ ] ทำ browser matrix R4 และ measurements R5 กับ final code; มี screenshot/snapshot จากเครื่องมือได้ แต่ไม่สร้าง transcript files
- [ ] full tests ต้องไม่มี failure/timeout ที่ยังไม่อธิบายและแก้; ห้าม `skip`, ลด assertions, เพิ่ม worker จน load กลบปัญหา หรือแค่เพิ่ม timeout เพื่อปิด R0
- [ ] Svelte warnings เป็น failure; build chunk warning ใช้ disposition ที่ล็อกไว้ใน R5
- [ ] baseline/in-flight failure ที่เกิดจากไฟล์นอก scope ให้รายงานและหยุดส่วน release ที่ขึ้นกับมัน; ไม่แก้ concurrent work หรือรัน failing check เดิมซ้ำโดยไม่มี input/evidence ใหม่
- [ ] ทุกสถานะ PASS ต้องมาจาก run จริง; browser/tool/resource blocker คงเป็น BLOCKED/INCOMPLETE และยังไม่กล่าวว่า 100%

**R6 evidence (2026-11-04):** final inputs pass `npm run lint`, `npm run typecheck`, `npm run verify` (12/12 cages; three pre-existing tree PENDING rows), `npm test` (228 files / 2,330 tests), `npm --prefix game run check` and `npm --prefix game run build`. `npm run measure:release` reports `INCOMPLETE: inventory-policy-blocked` at zone 2, level 17, bag 100/100, so the natural-win row and the dependent `town.json.pending` closure are not claimed. Browser matrix and browser performance rows are BLOCKED by the missing browser automation tool. The release is therefore not 100%; the checkboxes above stay open where their evidence is missing.

รายงานสุดท้ายต้องมี: behavior ที่เปลี่ยน, legacy/save policy ที่ใช้, natural-win evidence, balance disposition, gates และข้อจำกัดที่ตรวจพบ ใช้ gate output เป็นหลักฐาน ไม่สร้างรายงานซ้ำที่คัดลอก data/formulas

เมื่อครบ definition of done จัดการ completed plan ตาม [README](README.md); การ sync ยังคงต้องมีคำสั่งและ approval แยกตาม AGENTS

## 5. คำสั่งส่งต่อให้ผู้ลงมือ

> ทำ `docs/plan/non-art-release-readiness.md` ตาม R0 → R6 โดยถือ decision table เป็น v1 contract เริ่มแก้ timeout fixture แล้วเปิด persistent session ให้ครบวงจร อย่าเพิ่มฟีเจอร์ งานภาพ dependency หรือ balance targets ใหม่ ใช้ synthetic tests สำหรับ mechanics และใช้ measurement แยกสำหรับ pacing หากเจอ BLOCKED/INCOMPLETE ให้รายงาน owner และหลักฐานที่ระบุในแผน ห้ามทำเช็กบ็อกซ์ผ่านแทนการตรวจจริง
