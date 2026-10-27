# RO-style field population, roaming and continuous combat playback

วันที่ตรวจและจัดทำ: 2026-10-27 — Asia/Bangkok  
ประเภทงาน: implementation handoff สำหรับผู้รับงานคนอื่น  
สถานะเอกสาร: **FINAL IMPLEMENTATION HANDOFF — เขียนสเปกและลำดับรับงานครบ พร้อมเริ่ม P0; runtime ยังไม่ได้ implement ตามแผนนี้**  
ทิศทางที่ผู้ใช้ระบุ: mob เป็นประชากรประจำแผนที่ เดินในแผนที่แบบ RO, respawn เป็นรายตัว, เลิกการรอกรุ๊ปใหม่; การเดินเปลี่ยนพื้นที่ยังเป็น modular hex

ขนาดที่ผู้ใช้อนุญาตเพิ่ม: local field ใช้แกนกว้างประมาณ **50 เมตร** และออกแบบกรอบพื้นที่ตามอัตราส่วนจอ monitor ไม่กำหนดเป็น 50 × 50 m ดูสัญญา world bounds / projection / viewport ใน §23

## 1. คำสั่งส่งต่อที่ต้องอ่านก่อนเริ่ม

ผู้รับงานต้องอ่าน [AGENTS.md](../../AGENTS.md) และ source ปัจจุบันก่อนแก้ อาจมี agent อื่นเปลี่ยน combat, skills หรือ VFX อยู่ใน workspace เดียวกัน ห้ามใช้ Git state/history เป็น baseline และห้ามล้างงานคนอื่น

ทำตาม packet ในเอกสารนี้ เริ่มจากกรณีที่พิสูจน์ได้ก่อน ห้ามอ้างว่าทำเสร็จจากการเปลี่ยนชื่อ `group` เป็น `population`, ลด respawn time, ขยายสนาม หรือเพิ่ม animation อย่างเดียว

เส้นทาง live field ต้องมี population lifecycle ของตัวเอง การเริ่ม/หยุด auto hunt, ผู้เล่นเปลี่ยนเป้า หรือผู้เล่นแพ้ ไม่ใช่การสร้าง encounter ชุดใหม่

การรื้อระบบเก่าในแผนนี้หมายถึง **wave/group lifecycle ที่ยังปนใน field farming** ไม่อนุญาตให้ลบกติกา dungeon escrow, Boss, Camp encounter, loot, save หรือ progression ที่ไม่เกี่ยวโดยอาศัยการค้นคำว่า `group`

เอกสารนี้ไม่พึ่งแผน combat เก่าที่ถูกลบ ใช้ path และ symbol ที่ตรวจพบจริงด้านล่าง

### 1.1 สัญญาส่งมอบครั้งแรก — ระบบ field ครบวงจร

ผู้ใช้ต้องการให้ implementation ครั้งแรกส่งมอบระบบที่ใช้งานได้ครบ การแบ่ง P0–P8 คือ dependency/ownership/verification ระหว่างทำงาน ไม่ใช่การอนุมัติให้ส่งระบบครึ่งหนึ่งแล้วเลื่อน save, migration, roaming, camera หรือ legacy removal ไปเวอร์ชันถัดไป

การเปิดใช้และการส่งมอบมี **joint release gate เดียว** ครอบคลุม:

1. Population / per-slot death-respawn / placement / roam-idle / return-home / contact waiting
2. Player control, farming search, same-field Hunt/Push/recovery และ combat-session integration
3. Field ตาม monitor ratio, world ground, camera, pointer projection และ playback correctness
4. Hex departure/revisit, active-inactive authority, old-save migration และ pending work
5. Data readers, tuning ของระบบใหม่, docs/wiki และการเลิก live wave authority
6. Normal-game acceptance และหลักฐานของ negative paths ครบตาม §19

Packet ที่ผ่านถือว่า workstream นั้นพร้อมรวม ไม่ใช่ whole-system complete. Production activation ใน §23.9 เป็น internal integration checkpoint; ส่งให้ผู้ใช้เมื่อ P8 และ joint gate ผ่านแล้ว

Temporary diagnostics, blockout terrain และ current working assets ใช้พิสูจน์ระหว่างทำงานได้ Final field release ต้องมี usable ground presentation และ action/VFX baseline ที่ผ่านการเชื่อมจริง ไม่ส่งรายการ asset gap หรือ TODO ของฟีเจอร์สำคัญแทนผลงาน

### 1.2 อิสระในการออกแบบตามทิศทาง RO + PoE

ผู้ใช้อนุญาตให้พัฒนาระบบใหม่ตามประสบการณ์ที่ต้องการ ไม่ต้องรักษา old wave tuning, old flow หรือ old test assumptions เป็นข้อบังคับด้าน product ใช้ข้อมูลเก่าเพื่อเปรียบเทียบผลและ migrate อย่างปลอดภัย ส่วนค่าที่ควรใช้จริงให้อยู่ใน canonical data ของระบบใหม่

ความเข้ากันได้ที่ต้องรักษาคือ progress/ความหมายของเซฟ, identities, authoritative state, event/reward correctness และ interfaces ที่ workstream อื่นใช้ ไม่ใช่การบังคับให้ระบบใหม่สร้างจังหวะเหมือนระบบเก่าทุกวินาที

รายละเอียด design direction อยู่ §24 และขอบเขตไม่ชนแผนที่ agent อื่นร่างอยู่ใน §25

## 2. ประสบการณ์ที่ต้องส่งมอบ

ผู้เล่นเดินจากเมืองเข้า hunting hex ผ่าน map travel ตามปกติ แล้วพบสัตว์ประหลาดที่อยู่ในบริเวณนั้นอยู่แล้ว บางตัวเดินเล่น บางตัวยืนพัก และตัวที่เข้าเงื่อนไข aggro จึงเข้าสู้

เมื่อฆ่า mob หนึ่งตัว:

1. ตัวนั้นตาย ลง reward ครั้งเดียว และแสดง death ตามเวลาจริง
2. Spawn slot ของตัวนั้นเข้าสู่เวลารอเฉพาะตัว
3. Mob ตัวอื่นคง id, HP, ตำแหน่ง, AI state และจังหวะของตัวเอง
4. เมื่อ slot นั้นถึงเวลาและมีพื้นที่เกิด จึงสร้างตัวใหม่ที่จุดเกิดของมัน
5. ไม่มีเงื่อนไขว่าต้องฆ่าทั้งสนาม ต้องไม่มี engaged mob หรือ `s.group` ต้องว่างก่อนจึงเกิดได้

เมื่อผู้เล่นเปลี่ยนเป้าหรือฆ่าเป้าหมาย กล้องไม่กระชากทั้งสนามไปหาเป้าใหม่ เมื่อผู้เล่นแพ้ mob ที่ยังอยู่ในแผนที่ไม่หายทั้งหมดเพื่อรอเปิดกรุ๊ปใหม่

ความสมูทต้องวัดจากตำแหน่งบนพื้นและเวลา playback ไม่ใช้การซ่อน mob ที่ค้างหรือ animation ที่ยังเดินทั้งที่ตำแหน่งไม่ได้เคลื่อน

## 3. ขอบเขตที่เลือกให้ชัด

### 3.1 อยู่ในงานนี้

- Population ของ live field แยกจาก player auto-hunt และ combat session
- Spawn/death/respawn ราย slot รวมการ retry เมื่อจุดเกิดถูกบัง
- รักษาประชากรเดิมเมื่อ Hunt ซ้ำ, หยุดฟาร์ม, Push และพักฟื้นในพื้นที่เดิม
- Roam, idle, return-home, approach และ waiting-for-contact ที่มีเหตุผลตรวจได้
- การเข้า/ออก hex และ active/inactive field checkpoint โดยไม่มี HP authority ซ้ำ
- เลิกใช้ wave pacing ใน field spawn และเลิกใช้ group-clear เป็นสัญญาณล้างแผนที่
- กล้องที่ยึดผู้เล่น และการตรวจ playback discontinuity / physics displacement
- Save/load, offline boundaries, travel, patrol และ regression ที่ได้รับผล

### 3.2 อยู่นอกงานนี้

- เจนหรือเปลี่ยน asset VFX/sprite ใหม่
- เปลี่ยน modular hex เป็น continuous world; local world-ground presentation และ first-party ground assets ที่จำเป็นต่อสนามใหม่อยู่ใน scope
- สร้าง obstacle navigation, multiplayer หรือ server population
- เปลี่ยนสูตร damage, XP, loot โดยไม่มี packet/owner ของระบบนั้น หรือเพิ่ม difficulty เพื่อกลบ defect
- เปลี่ยน offline income โดยผลข้างเคียงที่ไม่รายงาน; field cap, respawn, rarity และ layout author ใหม่ได้ตาม §8/§23/§24 พร้อม before/after evidence
- รื้อ dungeon encounter budget ให้เป็น open field ทั้งหมด

### 3.3 ข้อเลือกด้านพฤติกรรมในแผนนี้

| เรื่อง | ข้อเลือกสำหรับ implementation |
|---|---|
| World population | มีชีวิตแยกจากการเปิด/ปิด player auto-hunt ใน active hunting hex |
| Town | ไม่มี hostile population บน settlement hex |
| Hunting flag | ควบคุม player automatic acquisition/attack; ไม่ลบหรือสร้างประชากรใหม่ |
| Aggro ขณะปิด hunting | Mob admission อ่าน aggression profile และ world geometry แยกจาก player auto-hunt; reactive/proximity และ safe-domain policy ตาม §27 |
| Initial map entry | Restore ประชากรเดิมก่อน; หากไม่มี checkpoint ให้เติม slot เริ่มต้นตาม cap และ placement ที่ถูกต้อง |
| Respawn | Clock ราย slot จาก death receipt; ไม่ใช้เวลาจบไฟต์หรือผู้เล่นพร้อมตีเป็นตัวตั้ง |
| ตัวเลข pacing | Author จาก field density, movement, pull size และ desired RO + PoE loop; old rates เป็น comparison baseline ไม่ใช่ constraint |
| Local field size | แกนกว้างประมาณ 50 m; projected field footprint อิง ratio จอ 16:9 ของ canonical 1920 × 1080 |
| Respawn spread | ใช้ deterministic authored interval ราย slot/life ตาม §27 สุ่ม due ครั้งเดียวตอนตายและ persist ค่าเดิม |
| Mob เกิดพร้อมกัน | อนุญาตเมื่อหลาย slot ถึงเวลาพร้อมกันจริง แต่ไม่มี barrier รอ slot อื่น |
| Player Push | ยุติ player action/combat session; ประชากรที่ยังมีชีวิตใน field เดิมคงอยู่และออกจากการต่อสู้ตาม return policy |
| Camera | Follow ผู้เล่น; เปลี่ยน target/focus ไม่เป็น camera input ของ field scene |
| Inactive field | ไม่จำลอง AI/ต่อสู้; เก็บประชากรและ due times แบบ checkpoint ที่มีขอบเขต |
| เวลาระหว่างอยู่ hex อื่น | Clock โลกเดินต่อได้; slot ที่ว่างอาจพร้อมเกิดเมื่อกลับมา ไม่มีการจำลองวงจรเกิด-ตายย้อนหลัง |
| Pause | หยุด sim time ตามระบบเดิม; ไม่ใช้ wall clock แอบ respawn ระหว่าง Pause |
| Offline | ไม่มี AI/camera simulation ทุก field; settle pending work ของ active encounter ก่อน แล้วใช้ offline contract เดิม |

ข้อเลือกนี้เป็นสเปกของแผนที่ต้อง implement; อย่าสับสนกับสถานะ runtime ปัจจุบัน

## 4. Source map และ ownership ที่ตรวจแล้ว

| Path / symbol | สิ่งที่เป็นเจ้าของ | ผู้รับงานต้องระวัง |
|---|---|---|
| [engine/spawns.ts](../../engine/spawns.ts) — `SpawnProfile`, `createSpawns`, `spawnSlotSeed` | Profile resolution, validation และ seed ของแต่ละ slot | Validator ต้องอ่านทุก key ใหม่จริง |
| [tools/data/spawns.json](../../tools/data/spawns.json) | Layout, cap, respawn, roam, home band, leash | เป็นบ้านของ tuning ไม่ใส่สำเนาใน UI |
| [tools/data/engine.json](../../tools/data/engine.json) | Arena geometry, body footprint, attack profiles และ baseline numbers ที่ต้อง freeze | ขยายโลกโดยไม่ scale body/range; อย่าแก้ wave constants เพื่อควบคุม field ใหม่ |
| [game/src/sim/world/field-area.ts](../../game/src/sim/world/field-area.ts) — `FieldState`, `FieldSpawnSlot`, `syncFieldState`, `releaseSpawnSlot` | Active field identity, slot/timer และ checkpoint metadata | ปัจจุบัน archive ยังไม่มี authoritative Mob records ของพื้นที่ที่ออกไป |
| [game/src/sim/core/game.ts](../../game/src/sim/core/game.ts) — `spawnFieldMob`, `ensureFieldPopulation` | สร้าง live mob จาก slot | ยังมี wave-rate adaptation และ hunting gate |
| `game.ts` — `huntHere`, `huntZone` | เริ่ม hunt / เปลี่ยนที่ล่า | ปัจจุบันมีการล้าง `s.group` |
| `game.ts` — `refreshReturning`, `syncEngagement`, `advanceArenaAt` | Home return, membership และ sub-tick simulation | เป็น code ใหม่ที่มีอยู่แล้ว ต้องรักษาไว้ |
| `game.ts` — Push branch / `hadEngagement` / `hadGroupBeforeDamage` | จบ combat session และ recovery | มี group cleanup และ clear callback ที่ต้องแยก lifecycle |
| [game/src/sim/combat/combat-arena.ts](../../game/src/sim/combat/combat-arena.ts) — `advanceCombatArena`, `assignContactPoints`, `separateBodies` | Movement, roam, collision และ contact | Roam ถูกตัดด้วย home band; separation อาจปิดบัง spawn overlap |
| [game/src/sim/world/road.ts](../../game/src/sim/world/road.ts) — `startWalk`, `arrive`, waypoint path | Modular hex transition | ต้อง checkpoint ก่อนล้าง active population |
| [game/src/sim/world/fieldwork.ts](../../game/src/sim/world/fieldwork.ts) — Camp helpers / `finishPushAtCamp` | Camp activity และ recovery | บางเส้นทางล้าง `group` เพื่อหยุด hunt |
| [game/src/sim/world/exploration.ts](../../game/src/sim/world/exploration.ts) — `recordPatrolGroupClear` | Patrol progress / Auto-Return | ห้ามนับ session สองครั้งหรือบังคับให้โลกว่างเพื่อเดินต่อ |
| [game/src/presentation/arena-camera.ts](../../game/src/presentation/arena-camera.ts) — `arenaCameraOffset` | Projection และ camera offset | ปัจจุบันรองรับ midpoint กับ target |
| [game/src/ui/combat/CombatArenaScene.svelte](../../game/src/ui/combat/CombatArenaScene.svelte) | เลือก target/camera, RAF, sampled actor rendering | ตอนนี้เปลี่ยน focus ทำให้ camera input เปลี่ยนทันที |
| [game/src/ui/combat/combat-arena-view.ts](../../game/src/ui/combat/combat-arena-view.ts) — `arenaPlaybackTime` | Playback clock และ action-to-pose | ต้องพิสูจน์ clock discontinuity ก่อนเปลี่ยน |
| [game/src/App.svelte](../../game/src/App.svelte) — `step`, `resetArena`, scheduler | เชื่อม tick และ render arena | บาง host ใช้ scheduler คนละเส้นทาง; ต้องตรวจ `/` จริงด้วย |
| [game/src/state/save.ts](../../game/src/state/save.ts) — schema / `migrate` | Persisted state และ old-save migration | เวอร์ชันที่ตรวจคือ 26; ตรวจซ้ำก่อนเพิ่ม version |
| [docs/glossary.md](../glossary.md) | คำศัพท์ที่ player-facing consumers ใช้ร่วมกัน | Source/data และ wiki เป็นสิ่งอ้างอิงปัจจุบัน; เอกสาร rules/decisions เก่าถูกลบแล้ว |
| [game/src/wiki/pages.ts](../../game/src/wiki/pages.ts) | Player-facing source | HTML wiki ต้องสร้างผ่าน generator |

## 5. หลักฐานจากการลองเล่นและ probe

### 5.1 Browser flow ที่ตรวจจริง

Host: `http://localhost:5173/` ที่ 1920 × 1080

1. เริ่มที่ Eastgate บน settlement hex H10, character level 1, skill bar ว่าง
2. เลือก Open Grassland H11 ผ่านลูกศรแผนที่
3. ใช้ Walk here แล้วเปิด Field
4. พบ mob เกิดและมีการต่อสู้จริง จึง **ไม่ใช่กรณีไม่มี spawn implementation เลย**
5. ระหว่างฟาร์ม จำนวน mob ที่เหลือบนสนามลดลงและมีบางตัวไม่อยู่ใน viewport ของกล้อง
6. อ่าน DOM พบทั้ง actor ที่ attack และ actor ที่ walk แต่ `data-moving=false` ในบาง sample ต้องตรวจ history/settle state ก่อนสรุปว่า AI ค้าง
7. หยุดเกมไว้ใน Open Grassland เพื่อไม่ปล่อยให้ทดลองต่อโดยไม่มีผู้ดู

การทดลองนี้ไม่ได้แตะเซฟผ่านคำสั่ง import/export หรือแก้ state ภายในด้วย browser evaluation การอ่าน browser ใช้ DOM ที่แสดงผลจริง

### 5.2 กรณีที่พิสูจน์ให้ fail ได้

มี probe ชั่วคราวใน owner test files แล้วนำออกหลังเก็บผล เพื่อไม่ส่ง test suite ที่ตั้งใจแดงให้ workstream อื่น ผู้ implement ต้องสร้าง regressions กลับใน packet ที่รับผิดชอบ

| ID | พฤติกรรมที่พิสูจน์ | ผลก่อนแก้ที่สังเกต | Root location |
|---|---|---|---|
| F01 | Idle mob เริ่มที่ home แล้วเดินเล่น 30 s | ออกห่างได้ไกลสุดประมาณ 0.406 m ทั้งที่ slot roam radius 1.8 m | Unengaged branch ใน `advanceCombatArena` |
| F02 | เรียก `huntHere` ซ้ำใน field เดิมที่มี mob สองตัว | `s.group` เปลี่ยนจากสอง id เป็น `[]`; HP/timer continuity หาย | `huntHere` |
| F03 | ผู้เล่น HP เป็นศูนย์ใน field ที่ยังมี mob | Push branch ล้างประชากรที่ยังมีชีวิตทั้งหมด | Push cleanup ใน `game.ts` |
| F04 | เรียก `releaseSpawnSlot` ซ้ำกับ mob id เดิม | ครั้งที่สองยังคืน `true` และแก้ timer/counter ได้ | `releaseSpawnSlot` |
| F05 | Render scene ที่ player หยุดนิ่ง เปลี่ยน focus ระหว่างสอง mob ไกลกัน | Camera transform เปลี่ยนแนวนอนประมาณ 923 px โดย world position ของ player ไม่เปลี่ยน | Scene camera input |

Focused baseline ก่อนเพิ่ม probes ผ่าน 58 tests ใน `combat-arena`, `combat-arena-view`, `field-area`, `farming-ai` ตัวเลขนี้เป็น run evidence ไม่ใช่ quota

### 5.3 พบจาก source แต่ยังต้องพิสูจน์ผลแยก

| ID | ข้อสังเกต | สิ่งที่ยังห้ามอ้าง |
|---|---|---|
| L01 | `spawnFieldMob` ใช้ `group_spawn_sec`, `ttk_per_mob_sec` และ expected group เพื่อแปลง rarity rate | ยังไม่ใช่หลักฐานว่า timer ทุกตัวรอ group clear |
| L02 | `ensureFieldPopulation` ถูก gate ด้วย `s.hunting`, phase และ player HP | ต้องพิสูจน์ว่า field ที่พักอยู่ไม่เติม/ไม่เดินตาม desired contract |
| L03 | ทั้ง engagement-empty และ group-empty path เรียก Patrol clear logic | ต้องทำ regression นับ callback/progress จริงก่อนประกาศ double-count defect |
| L04 | Spawn ใช้ home ตรง ๆ แล้ว separation ตามหลัง | ต้องสร้าง occupied-home fixture ก่อนอ้างว่า physics warp มาจาก spawn |
| L05 | Playback re-anchor ตาม packet; main host และ showcase scheduler ต่างกัน | อาการ freeze/rewind ยังไม่มี timing trace ที่ยืนยันสาเหตุ |
| L06 | Active field archive เก็บ slots/metadata แต่ล้าง actor positions และไม่มี Mob population | ต้องตรวจ departure call sites ก่อนเลือกจุดย้าย authority |
| L07 | `normalizeFieldState` ปัจจุบัน floor ค่า `respawnAtSec` | Reader ทำ deadline เศษวินาทีเร็วขึ้นได้; ต้องเพิ่ม save regression และแก้ semantics เมื่อใช้ exact death time |

**Freeze ยังไม่ถูกพิสูจน์ว่าเกิดจาก engine ช้า, renderer ช้า, clock เดินย้อน หรือ mob ถูกล็อก action** ต้องคงสถานะนี้ไว้จนมี trace แยกสาเหตุได้

## 6. Invariants ที่ห้ามทำลาย

### 6.1 Population identity

- Active field มี `s.group` เป็น authoritative living Mob/HP list หนึ่งชุด
- Slot เก็บ owner id, home และ respawn facts; ไม่เก็บ HP อีกสำเนา
- Mob ที่ยังมีชีวิตมี owner slot ไม่เกินหนึ่ง slot
- Slot ที่มี mob id ต้องชี้ authoritative live mob ของ field เดียวกัน หรืออยู่ในขั้น migration/reconciliation ที่มีเหตุผลชัด
- การเรียง list, เปลี่ยน target, toggling automation หรือเปิด panel ไม่เปลี่ยน identity ของประชากร
- หมายเลข `respawnCount` ปัจจุบันเป็น seed sequence ที่ถูกใช้แล้ว ห้าม reset หรือ reinterpret จนลำดับเกิดที่บันทึกไว้เสียความหมาย

### 6.2 Time และ RNG

- Spawn deadlines ใช้ game clock เดียวกับ field; ไม่ใช้ `Date.now()` เป็น gameplay timer ใหม่
- Timer ที่ตั้งแล้วไม่สุ่มซ้ำเมื่อ reload, HMR, reconcile หรือเปลี่ยน focus และไม่ floor/round ให้เร็วกว่าค่า deadline ที่ commit แล้ว
- Spawn selection / placement / optional timing variation ไม่ดึง RNG จาก damage/loot stream
- ไม่เกิด catch-up loop ที่สร้างและฆ่า mob ย้อนหลังเพียงเพราะผู้เล่นไม่อยู่ field
- ไม่มี reward จากการ restore, reconcile, respawn, return-home หรือการนำ checkpoint กลับมา

### 6.3 Combat และพื้นที่

- Body footprint และ attack range ใช้ contracts ปัจจุบัน ไม่ย้อนกลับไป melee 2.1 m
- Preserve action id, release/impact/recovery และ source-independent released work ตามระบบที่มีแล้ว
- Spawn placement ไม่ผลักผู้เล่น/ตัวที่มีอยู่หลายเมตรเพื่อเปิดที่ให้ตัวใหม่
- Movement ที่ไม่ใช่ forced correction ต้องไม่เกินความเร็ว × free elapsed time
- World position, camera offset, source crop และ sprite local pose เป็นคนละข้อมูล ต้อง trace แยกกัน

### 6.4 Compatibility

- Character, gear, skills, mastery, XP, money, kill counts และ progress เดิมต้องไม่สูญหายจากงานนี้
- กุญแจ save เก่าอย่าง `spawnIn` หรือ `groupsCleared` อาจคงอยู่เพื่ออ่าน compatibility แต่ห้ามเป็น field spawn authority
- ต้องอัปเดต readers, writers และ validators พร้อมกันหากเพิ่ม checkpoint population
- ไม่ลบ whole encounter state จาก string search โดยไม่แยก dungeon / camp / field

## 7. Model ของ population ที่ต้องใช้

### 7.1 แยกสามสิ่ง

| สิ่ง | ความหมาย | ตัวอย่างการสิ้นสุด |
|---|---|---|
| Field population | ประชากรของแผนที่ | ออกจาก active field แล้วย้าย authority ไป checkpoint |
| Engagement | Bodies ที่กำลังมีเหตุเข้าต่อสู้ | หลุด leash, ตาย, player defeat หรือออก encounter |
| Combat session | ช่วงต่อสู้ที่ใช้ potion budget / Patrol progress | Quiet boundary หลัง engagement จบ |

Session จบไม่ได้แปลว่า population ต้องว่าง และไม่ได้สั่งเติมทั้งแผนที่

### 7.2 Slot state machine — derive จาก facts ที่มีอยู่

```text
uninitialized / restored-empty
              ↓ reconcile initial population
available-for-spawn → placement-blocked → retry same slot
              ↓ commit spawn
            occupied
              ↓ one death receipt
          respawn-pending
              ↓ now >= due
       available-for-spawn
```

ไม่จำเป็นต้องเพิ่ม persisted enum ถ้า `mobId` + `respawnAtSec` + field identity แทนสถานะได้ครบ หลีกเลี่ยงสถานะที่ต้อง sync ซ้ำสองชุด

| Derived state | Facts | สิ่งที่ทำได้ |
|---|---|---|
| Occupied | Slot owner เป็น living mob ของ field นี้ | AI / combat ของ mob นั้น |
| Pending | ไม่มี owner และ `now < respawnAtSec` | รอ timer ของตัวเอง |
| Due | ไม่มี owner และ `now >= respawnAtSec` | ลอง placement ของ slot นี้ |
| Placement blocked | Due แต่ไม่มี candidate ที่ปลอดภัย | คง due เดิม ลองใหม่ตาม sample policy |
| Initial empty | Slot ใหม่ที่ไม่เคยมี body | เติมตาม field activation; ไม่รอ death cycle ปลอม |
| Stale reference | Owner id ไม่มี live record | Reconcile แบบบันทึกเหตุผล; ไม่จ่าย reward และไม่ทับ future timer |

### 7.3 Death transaction

Commit การตายต้องมีลำดับที่ทดสอบได้:

1. ยืนยัน identity/ownership ของ mob กับ slot และ field ใน core kill transaction; หาก field helper รับ receipt หลัง resolve ตายแล้ว ให้ใช้ validated death receipt ไม่กำหนดว่า HP ต้องยังมากกว่าศูนย์
2. Resolve damage/kill/reward ด้วย pipeline เดิมเพียงครั้งเดียว
3. ปล่อย slot ด้วย id check แบบตรงกัน ไม่ยอมให้ owner ที่ว่างแล้วรับ release ซ้ำ
4. ตั้ง respawn deadline จาก death receipt และ profile ที่ author ไว้
5. Remove live mob ตาม authority เดิม; retain death body/action สำหรับ presentation
6. ทิ้ง action/contact/target references ที่ควรหมดอายุ โดยไม่ล้างเพื่อนทั้ง field

การยิงหลาย projectile เข้าเป้าที่ตายแล้ว หรือสอง impact ตรงเวลาเดียวกัน ต้องไม่เลื่อน deadline ไม่เพิ่ม sequence และไม่รับ reward ซ้ำ

### 7.4 Refill transaction

1. รับรายการ slot ที่ due โดยไม่ต้องอ่านว่า fight หรือ group จบหรือยัง
2. ตรวจ population cap ของ field และ ownership ของ slot
3. Resolve profile + spawn identity จาก deterministic per-slot seed
4. หาตำแหน่งที่วาง body ได้ใน home/roam footprint
5. ถ้าวางไม่ได้ ให้คง due และ retry โดยไม่ล็อก slot อื่น
6. หากวางได้ จึง commit Mob, slot owner, position และ sequence ใน transaction เดียว
7. Capture birth snapshot ที่ถูกต้อง; ก่อน birth timestamp ไม่มี actor นี้ในภาพ

ห้ามเพิ่ม counter ก่อน placement สำเร็จแล้ว rollback แบบเดา counter คืน และห้ามใช้การ despawn เพื่อนหรือผลักผู้เล่นเป็น fallback

## 8. เลิก wave pacing ใน field spawn

### 8.1 สิ่งที่ต้องออกจาก live field path

- การรอ `s.group.length === 0` เพื่อเติม ordinary field population
- การผูก spawn availability กับ `spawnIn`, group clear หรือ combat-session clear
- `waveSec`, `slotRate` และการคำนวณ rarity จาก `group_spawn_sec` / `ttk_per_mob_sec` ภายใน `spawnFieldMob`
- การล้างประชากรเพื่อเริ่ม Hunt ในพื้นที่เดิม
- การล้าง population ทุกตัวเมื่อ player Push อยู่ใน field เดิม
- การใช้ Patrol progress หรือ UI selection สร้าง encounter ชุดใหม่

### 8.2 วิธีเลิก dependency และ author pacing ของระบบใหม่อย่างชัดเจน

1. P0 อ่าน effective elite/unique probability และ population pacing ปัจจุบันผ่าน shared engine reader **ก่อนเปลี่ยน field bounds, cap หรือ layout** เพื่อเป็น comparison baseline
2. รายงานค่าที่เลือกใหม่พร้อมเหตุผลเรื่อง density, encounter pressure และ reward opportunities ไม่สร้าง transcript หรือ helper ถาวรโดยไม่จำเป็น
3. เพิ่ม per-spawn probability ที่ explicit ใน `SpawnProfile` เช่น `elite_chance` และ `unique_chance` พร้อม validator `[0,1]`
4. Author per-spawn probability/respawn ของระบบใหม่ตาม habitat และ encounter roles ใน §24; context ที่ต่างกันต้องมี override จริง ไม่บังคับเท่ากับ effective wave probability เดิม
5. Live field อ่านโอกาสต่อตัวจาก profile โดยตรง ตัด runtime wave-rate conversion ออก
6. ทดสอบ reader ว่า profile override เปลี่ยนผล selection จริงและ old wave constants ไม่ควบคุม field timer/selection แล้ว

ชื่อ field เป็นข้อเสนอ schema ต้องให้ data owner freeze พร้อม types และ consumers ก่อน agent อื่น author rows

Lifecycle correctness กับ tuning ต้องรายงานแยกกัน แต่ทั้งสองเป็นงานที่ต้องทำให้ลงตัวใน first release นี้ อย่า gate ว่า supply ต้องอยู่ใน ±5% ของ old group kill target หรือเลื่อนการตัดสินใจค่าจริงไปหลังส่งมอบ

### 8.3 Tests/gates ที่ต้องเปลี่ยนความหมาย

`game/tests/spawns.test.ts` ปัจจุบันมี assertion ว่า population supply ต้องใกล้ old group-derived kill target ภายใน 5% ให้แทนด้วย correctness tests ของ per-slot independence, profile inheritance, probability validity, stable seed และ capacity

อย่าลบ assertions เรื่อง finite values, bounds, unknown zones หรือการเกิดเกิน cap การเลิก balance gate ไม่ใช่การเลิก validation

### 8.4 Data/schema checklist ที่ต้อง freeze ก่อน authoring

| Field | หน่วย/ความหมาย | Validation | Compatibility |
|---|---|---|---|
| `cap` | จำนวน living owners สูงสุดในแผนที่ | Positive integer ไม่เกิน available authored slots | Author ใหม่ได้; ไม่ truncate living records ของ save |
| `respawn_sec` | ระยะเวลาจาก death receipt ถึง slot due | Finite และมากกว่าศูนย์ | Future timers ที่ตั้งไว้แล้วคงเดิม |
| `elite_chance` — เสนอใหม่ | โอกาสเลือก Elite ต่อ spawn ที่สำเร็จ | `[0,1]` พร้อม inheritance | ค่าเก่าใช้เปรียบเทียบ; ค่าจริงตาม encounter design ใหม่ |
| `unique_chance` — เสนอใหม่ | Wild Unique chance ตาม rank priority ที่ resolver ประกาศ | `[0,1]`; ต้องระบุ conditional/unconditional ให้ตรง `spawnMob` | ไม่ตีความว่าเกิด Boss/Unique พร้อมกันได้ |
| `roam_m` / slot override | ขอบเขตเดินเล่นจาก home | Nonnegative; footprint อยู่ใน field | ศูนย์เป็น intentionally stationary |
| `home_band_m` | ขอบเขตที่ committed return จบ | Positive และอยู่ใน home footprint ที่ valid | ไม่ใช้เป็นขอบ roam |
| `return_speed_mult` | อัตราเร็วตอนกลับบ้านเทียบ walk speed | `(0,1]` | ใช้ค่าเดิม |

Rank priority ต้องคงลำดับที่มีอยู่: ถ้าเป็น scheduled Boss ให้ใช้ Boss policy; ordinary roll เลือก Elite ก่อน และ Wild Unique ใช้เงื่อนไขที่ `spawnMob` รองรับจริง อย่า author chance field ที่ชื่อเหมือนกันแต่สถิติคนละความหมาย

หากเพิ่ม idle/roam scheduling ให้ data owner freeze เป็นกลุ่มเดียวกับ `SpawnProfile` ก่อนส่ง P3 ทำพฤติกรรม แยกจาก combat RNG และไม่เปิด field ใหม่ที่ยังไม่มี reader

## 9. World population ต้องเดินต่อแม้ไม่ได้กำลังสู้

### 9.1 Gate ที่ถูกต้อง

แยกคำถามออกจากกัน:

```text
is active hunting-ground hex? → population lifetime
is player auto-hunting?       → player auto acquisition / attack
is body engaged?              → offensive mob actions
is actor returning?           → return commitment / immunity
is world paused?              → sim clock advancement
```

`ensureFieldPopulation` ไม่ควรตอบทั้งห้าคำถามผ่าน `s.hunting` ตัวเดียว

### 9.2 Active field ที่ auto-hunt ปิด

- Existing bodies คงอยู่และ idle/roam ตามเวลาโลก
- Empty due slots เติมได้ตาม profile
- ไม่เดินผู้เล่นอัตโนมัติไปหา nearest mob
- ไม่สร้าง automatic primary casts/basic swings เพราะมีประชากรให้ renderer วาด
- Manual move/cast/focus ใช้กติกาของคำสั่งนั้นและ commitment เดิม
- Mob ที่เป็น proximity-aggressive ยังตรวจผู้เล่นใน field ได้เมื่อ auto-hunt ปิด ส่วน reactive mob ต้องถูกโจมตีหรือได้รับ eligible assistance ก่อน การปิด auto-hunt ไม่ใช่ immunity; safe-domain policy ตาม §27

### 9.3 Camp / Push recovery ใน field เดิม

- Player recovery และ world population เป็นคนละ clock consumer
- ยกเลิก unpaid player/mob actions ตาม defeat boundary; released work ใช้ fatal/encounter cancellation policy เดิม
- Engaged ordinary mob ที่ถูกปลดจากไฟต์ reset/return ตามกติกาเดิมครั้งเดียว
- Mob ที่ไม่เกี่ยวข้องไม่ถูกลบเพื่อรอ refill ทั้ง field
- ระหว่าง recovery ยังอัปเดต positions ของ population และ respawn ที่ due โดยไม่เปิดการทำร้าย player ที่อยู่ใน recovery
- เมื่อกลับมาจาก Camp ใน hex เดิม ต้องรักษาประชากรและ timers; ถ้า Camp อยู่คนละ hex ต้องใช้ field departure/activation transaction
- Boss, Unique และ Camp encounter ไม่ได้รับ ordinary returning immunity โดยบังเอิญ

### 9.4 Town และ travel

- Settlement hex ไม่มี hostile field population ยกเว้น encounter ที่มีกติกา explicit ของตัวเอง
- `huntZone` แบบเก่าต้องไม่ teleport ผู้เล่นไป generic town hunt แล้วล้าง population หาก UI ขอเริ่มล่า zone ให้เลือก hunting destination ที่ route resolver รู้จักและเดินตาม hex
- Caller ที่มี destination อยู่แล้วใช้ destination นั้น; caller ที่มีแต่ zone ใช้ hunting hex ที่ discovered และเข้าถึงได้ใกล้ที่สุดด้วย road graph ไม่เดา world coordinates
- ถ้าไม่มี field destination ที่ valid ให้คืนเหตุผลที่ใช้งานได้แทนการสร้างสนามจาก settlement ตรง ๆ
- รักษา exported helper compatibility เท่าที่ทำได้; บอก call sites ที่เปลี่ยนและอย่าปล่อย UI ใช้ signature เก่าโดยเงียบ

## 10. Roam และ mob ที่ยืนนิ่ง

### 10.1 สาเหตุ F01

Unengaged branch ปัจจุบันเปรียบเทียบ `distance(actor, home)` กับ home band ที่ใช้จบ return-home แทนที่จะตรวจ roam area จึงสั่งกลับเมื่อ mob เดินเล่นออกจากวงเล็ก

### 10.2 State ที่แยกกัน

| State | Movement target | เหตุให้เปลี่ยน state |
|---|---|---|
| Idle | คง foot position | หมดเวลาพัก / aggro / forced displacement |
| Roam | Authored/deterministic goal ภายใน home roam disc | ถึง goal, aggro, control |
| Return-home | Home band | ถึง band จึงจบ commitment |
| Approach | Contact claim หรือ ranged stop band | เข้า range, target invalid, blocked |
| Waiting-for-contact | Queue/holding point ที่ไม่ซ้อน body | มี claim ว่าง / player หรือเพื่อนขยับ |
| Prepare / recover | Action owns feet | เวลา phase / cancellation boundary |
| Controlled | ตาม hard-control policy | Control expiry |

อาจ derive จาก facts เดิมแทน persisted enum แต่ inspection ต้องแยกเหตุหยุดเหล่านี้ได้

### 10.3 กติกา roam

- `home_band_m` ใช้จบ committed return ไม่ใช่ขอบเขตเดินเล่นทั้งหมด
- `slot.roamM` เป็นขอบเขต ordinary roam ที่ source of truth author ไว้
- Ordinary roaming body ที่ยังอยู่ใน roam disc ไม่ถูกดึงกลับเพราะเดินพ้น home band
- `roamM=0` เป็น intentional stationary profile ไม่ถือว่า AI ค้าง
- Roam goal ไม่เปลี่ยนทุก render frame; เลือกตาม sim time / stable actor seed
- หากเพิ่ม idle durations หรือ roam speed ให้เก็บใน profile พร้อม bounded validation ไม่ใส่หลาย literal ซ้ำใน sim/UI
- ไม่ใช้ combat RNG เพื่อเลือกทิศเดินเล่น และไม่สุ่ม goal ใหม่เมื่อ reload
- Returning flag ต้องจบเมื่อเข้าบ้านจริง แล้วจึงกลับไป roam ได้

เลือกการเดินเล่นเป็นช่วง goal ที่คงที่สลับพัก เป็น deliverable ของ first release โดยเพิ่ม `roam_cycle_sec`, `roam_idle_sec` และ `roam_speed_mult`. ต้องมี `cycle > idle >= 0` และ speed อยู่ใน `[0,1]` ใช้ initial profile ใน §27 แล้วปรับจากหลักฐานเล่นจริงก่อนส่งมอบ ไม่ใช้ตัวเลข tuning เป็น test threshold

ใช้ stable per-actor phase offset เพื่อไม่ให้ทุกตัวออกเดิน/หยุดพร้อมกัน แต่ละ cycle เลือก goal เดียวภายใน roam disc จาก field/slot/actor seed; derive จาก sim time ได้เพื่อไม่ reroll ตอน reload เมื่อถึง goal ก่อนจบ move window ให้ idle จน cycle ถัดไป โดยเก็บ foot position เดิม ห้ามสร้าง goal ใหม่ทุก sample เพื่อบังคับให้ขยับตลอดเวลา

ช่วง idle เป็น deliberate state ที่ inspection อธิบายได้ ต้องมีอย่างน้อยหนึ่ง live movement cycle ที่พิสูจน์ว่าเดินและพักสลับกันจริง แยกจากอาการ freeze ของทั้งสนาม

### 10.4 Crowd และการรอเข้า contact

Contact claims ใหม่มีอยู่แล้ว ต้องตรวจเหตุของตัวที่รอแทนการเปิดสิทธิ์ตีไกล:

- หากทุก contact point ถูกจอง ตัวหลังมี waiting reason ชัดเจน
- หาจุดรอใกล้แนวเข้าประชิดที่ไม่ซ้อน body แทนการยืนนิ่ง ณ จุดเกิดไกล ๆ ถ้าปลอดภัยและมี path แบบสนามเปิด
- Claim ต้องถูกปล่อยเมื่อ owner ตาย, disengage, return, target หาย หรือ encounter เปลี่ยน
- Retry เมื่อ relevant geometry เปลี่ยน ใช้ลำดับ stable ids และ bounded candidate search
- ห้ามใช้ separation ปลายทางดัน body ฝ่าฝูงแทน approach
- ไม่อ้างว่ารองรับ obstacle pathfinding จากการแก้ waiting point

## 11. ป้องกัน spawn overlap และ physics warp

### 11.1 Placement contract

ผู้รับงานต้องสร้าง reproduction ก่อน: ให้ living body ยืนตรง spawn home แล้วปล่อย slot อีกตัวให้ due ตรวจ displacement ก่อน/หลังเกิด

เลือก placement แบบ bounded deterministic search ภายใน footprint ของ slot:

1. ตรวจ home center ก่อน
2. ตรวจ candidate rings/bearings ที่อยู่ใน roam disc และ field bounds
3. ระยะระหว่าง body edges ต้องผ่าน clearance ที่ canonical spatial policy ใช้อยู่
4. ไม่เลือกจุดที่อยู่บนผู้เล่นหรือเพื่อนเพื่อให้ solver ผลักออกภายหลัง
5. หากไม่มีตำแหน่ง ให้ slot นี้ pending placement ต่อ โดย slot due อื่นยังลองเกิดได้

Candidate count เป็น implementation budget ไม่ใช่ content quota; ไม่เพิ่ม navigation grid/framework เมื่อสนามยังไม่มี obstacles

### 11.2 แยก displacement ใน trace

```text
worldDelta = voluntaryWalkDelta + deliberateForcedMoveDelta + separationCorrection
screenDelta = projected(worldDelta) - cameraDelta + localPoseDelta
```

หาก worldDelta ผิด ให้แก้ movement/collision; หาก worldDelta ถูกแต่ cameraDelta กระโดด ให้แก้ camera; หากทั้งสองถูกแต่ silhouette กระโดด ให้ตรวจ foot anchor/crop/frame scale

ห้ามเพิ่ม interpolation กลบการย้าย body หลายเมตรที่ simulation ทำผิด เพราะจะทำให้ภาพ hitbox และการตรวจโดนแยกจากกัน

## 12. Camera ที่ไม่ย้ายสนามตาม target

### 12.1 นโยบายที่เลือก

- Live field camera follow ผู้เล่น
- การเลือก target / focus / nearest enemy / เป้าตาย ไม่เปลี่ยน camera target
- การ framing skill preview หรือ cinematic ภายหลังต้องเป็น explicit presentation mode; ไม่ใช่ผลข้างเคียงของ target selection
- Projection และ pointer unprojection ใช้ camera เดียวกับที่วาดจริง

### 12.2 แก้ที่ consumer ที่ถูกต้อง

เลือกให้ field scene เรียก player-only offset ของ `arenaCameraOffset` และรักษา optional target-midpoint utility เฉพาะ consumers ที่ใช้งานจริงอยู่นอก field-follow policy ผู้รับงานต้องทำ caller census และทดสอบ rendered scene จึงไม่จำเป็นต้องเปลี่ยน shared utility signature เพื่อแก้ camera jump ของ field

ข้อบังคับคือ rendered field ไม่เปลี่ยน camera transform เมื่อเปลี่ยน focus โดย player/world geometry คงเดิม ห้ามเพียงเปลี่ยน expected transform ใน test ให้ตรง implementation

### 12.3 Follow smoothing

เริ่มจาก player-only follow ก่อน ยังไม่ต้องเพิ่ม spring/lerp หาก player position ที่ sample มาแล้วต่อเนื่องอยู่

เพิ่ม smoothing เฉพาะเมื่อ trace แสดงว่าต้องใช้ และต้องมี:

- Time-based response ที่ไม่ขึ้นกับ frame rate
- Reset boundary สำหรับ teleport จริง, เปลี่ยน hex, load และ explicit seek
- Pointer mapping ที่ใช้ actual drawn camera
- เงื่อนไขลด motion และความสามารถทำซ้ำเมื่อ inspect timeline

ไม่ใช้ camera smoothing ทำให้ player command ลงคนละจุดกับที่ผู้เล่นคลิก

## 13. Freeze / stutter / playback — งานที่ต้องพิสูจน์เพิ่ม

### 13.1 แยกอาการก่อนเลือก fix

| อาการ | หลักฐานที่ต้องเก็บ | เส้นทางที่น่าตรวจ |
|---|---|---|
| Mob ตัวเดียวหยุด แต่ player/ตัวอื่นเดิน | AI/action/control/claim ของ actor นั้น | `actionFeetUntil`, contact, returning |
| ทั้งสนามหยุด แต่ UI อื่นยังอัปเดต | Playback time เทียบ latest sim time | RAF / packet re-anchor / pause |
| ทั้งหน้า UI ค้าง | Frame delta และ tick execution duration | Scheduler batch / render cost |
| ก้าวกระโดดหลังเป้าตาย | Camera delta เทียบ world delta | Focus/camera input |
| กระโดดหลัง respawn | Birth receipt + separation correction | Spawn placement |
| กระโดดหลังซ่อนแล้วเปิดแท็บ | Sim backlog, oldest retained frame, visibility transition | Catch-up / history / replay boundary |

### 13.2 Trace ที่เสนอ — dev only, bounded

บันทึกได้ผ่าน code ของ dev inspection ไม่ดึง hidden application state ผ่าน browser script:

```ts
type FieldPlaybackTrace = {
  wallMs: number;
  simNowUs: number;
  playheadUs: number;
  oldestFrameUs: number;
  latestFrameUs: number;
  areaKey: string;
  arenaEpoch: number;
  camera: { x: number; y: number };
  actors: Array<{
    id: string;
    world: { x: number; y: number };
    moving: boolean;
    actionId?: number;
    reason: string;
  }>;
};
```

ใช้ bounded ring buffer และ export/inspect เฉพาะเมื่อ dev mode เปิด ห้ามเพิ่ม logging ไม่จำกัดหรือเขียนไฟล์ trace ทุก tick ใน production

### 13.3 Playback invariants

- ระหว่างเดินเวลาไปข้างหน้าใน epoch เดียว playhead ไม่ถอยเพราะ packet ใหม่มาถึง
- ไม่ sample เกินเวลาที่ simulation resolve แล้ว
- Pause เก็บเฟรมที่เห็นอยู่ ไม่เด้งกลับต้นหน้าต่างหนึ่งวินาที
- Resume ไม่ชดเชย paused wall time เป็นการเคลื่อนที่ทันที
- เปลี่ยน speed ไม่ย้อน playhead และไม่เปลี่ยน hit timestamps
- ถ้า packet มาช้าจนถึง latest sample อาจ hold ที่ latest ได้ แต่ไม่มีการสร้างตำแหน่งอนาคตเอง
- ถ้า history เก่าถูก trim ไปแล้ว ต้องมี explicit rebase boundary; ห้ามบอกว่าเป็น continuous interpolation ของข้อมูลที่ไม่มี
- Explicit timeline seek และเปลี่ยน encounter เป็นเหตุให้ย้อนเวลาได้; อย่านำไปปนกับ ordinary playback regression

### 13.4 วิธีตรวจ performance

ใช้ input/seed/scene/viewport/speed เดียวกัน วัดก่อนและหลัง:

- Wall time ต่อ `step()` / tick และจำนวน ticks ต่อ wake
- RAF interval distribution และช่วงที่ latest simulation ไม่เปลี่ยน
- Count ของ live actors, retained frames/actions และ VFX instances
- ช่วงเวลาเมื่อตาย, respawn, เปลี่ยน focus, เกิด Boss และ auto-travel

รายงานสาเหตุที่วัดได้ ไม่ใช้ FPS เป้าหมายที่ไม่ได้วัดหรือการผ่าน typecheck เป็นหลักฐานว่าอาการค้างหายแล้ว

## 14. Modular hex และ inactive field checkpoints

### 14.1 Authority transfer

เลือกให้ inactive checkpoint เก็บ Mob records ได้ แต่ต้องเป็น authority ของ field ที่ **inactive เท่านั้น**:

```text
active field:
  s.group = living Mob authority
  s.field = slots + timers + positions + lifecycle facts

leave field:
  snapshot population + slot facts into bounded inactive checkpoint
  cancel area-owned work according to transition contract
  unload active population

enter field:
  take checkpoint population into s.group
  remove the inactive authority entry
  reconcile positions/slots/timers
  spawn only due empty slots
```

ห้ามมีทั้ง active `s.group` และ active `field.population` ที่แก้ HP กันคนละชุด

Payload ที่เสนอสำหรับ inactive entry คือ existing `FieldArchiveEntry` พร้อม `population: Mob[]`; slot/actor positions เดิมยังอยู่ใน entry เดียวกัน ไม่มี `hpBySlot` เพิ่มอีกชุด New writers ต้องเก็บเฉพาะ living mobs ของ field นั้น ส่วน old readers/migration ยอมรับการไม่มี `population` ได้เฉพาะ legacy metadata ตาม §15

### 14.2 จุดสำคัญของ departure

ปัจจุบัน `startWalk`, waypoint, Camp helpers และ hunting helpers บางตัวล้าง group ก่อน `syncFieldState` ได้เห็น population ที่ต้องเก็บ การแก้ archive ภายหลังอย่างเดียวจึงกู้ identity ไม่ได้

เพิ่ม transition operation เล็กที่เรียกได้ก่อนล้าง active state เช่น `checkpointFieldBeforeLeave` โดยวางใน module ที่ไม่ import `game.ts` ย้อนกลับจนเป็น circular dependency

ต้องครอบ:

- Walk ไปอีก hex / กลับเมือง
- Waypoint ที่ผู้เล่นอนุญาตให้ใช้ตาม UI เดิม
- Camp อยู่คนละ hex
- เข้า/ออก dungeon
- Auto-Return / Patrol ที่เริ่ม travel
- โหลด save / สลับ character / เปลี่ยน zone ผ่าน helper ที่มีอยู่

อย่าล้าง active population เพียงเพื่อให้ `walk.secLeft <= 0 && !s.group.length` ผ่าน ให้ travel ตรวจ lifecycle ที่ถูกต้องว่า active field ถูก unload แล้ว แทนการใช้ living count เป็นล็อกเดิน

### 14.3 Inactive time

- Living mobs ของ inactive field คง HP/identity/lifecycle ที่ checkpoint ไว้ ไม่มี AI หรือ damage ระหว่างไม่อยู่
- Empty slot ที่ deadline ผ่านไปแล้วพร้อมเกิดเมื่อกลับมา; ไม่เพิ่มหลาย generations ย้อนหลัง
- ไม่มี XP/drop/potion/session reward จากเวลาที่ field inactive
- Live body ที่ยังอยู่ใน checkpoint ไม่ถูกเกิดทับเพราะเวลาผ่านไปนาน
- เก็บจำนวน checkpoints ตามขอบเขตที่ระบบมีหรือค่าที่ author ไว้ ไม่เปิด unbounded world save
- ก่อนเปลี่ยน eviction semantics ต้องตรวจพฤติกรรม cap ปัจจุบันและ preserve player progress; ไม่สัญญา persistence ทุกแผนที่หาก checkpoint ถูก evict ตามกติกาที่ประกาศไว้
- Timer/sequence ledger ของ field ที่ถูก evict ต้องยังป้องกันการ reset respawn หรือ reroll ด้วยการเดินหลาย hex; heavy population cache กับ compact lifecycle ledger เป็นคนละขอบเขตการเก็บ ดู §27

## 15. Save, migration และ pending work

### 15.1 สิ่งที่ต้องเก็บ

- Active living Mob records อยู่ใน canonical state เดิม
- Slot id, owner id, respawn deadline, sequence และ home footprint
- Actor position และ returning commitment ที่จำเป็นต่อการต่อเนื่องหลัง reload
- Inactive population checkpoint สำหรับ field ที่เก็บอยู่
- Pending work ผ่าน ledger ปัจจุบันพร้อม encounter identity; ไม่ serialize RAF, DOM หรือ camera wall time

### 15.2 Migration strategy

Schema ที่ตรวจคือ version 26 ผู้รับงานต้องตรวจอีกครั้งก่อน bump:

1. เพิ่ม typed checkpoint payload และ normalizer ที่ตรวจ finite HP/positions, known identity และ bounds
2. เก็บ numeric counters/timers เดิม ห้าม reset ทุก field เพื่อหลบข้อมูลเก่า
3. Old inactive archive ที่ไม่มี Mob records ไม่สามารถกู้ HP ที่ไม่เคยบันทึกได้ ให้ migrate เป็น metadata/timer checkpoint ตามความหมายเดิม โดยไม่อ้างว่า restore living records สำเร็จ
4. Slot stale ids ใน old archive ต้องถูก reconcile โดยไม่จ่าย reward ไม่ลด future due และไม่สร้าง duplicate body
5. Active old-save population ต้องโหลดต่อได้พร้อม counts/HP ที่มีจริง
6. Unknown future schema ยัง reject ตามกติกาเดิม
7. Save → load → continue ใน active field และ inactive revisit ต้องให้ identity/timer progression เดียวกับ uninterrupted path ภายในขอบเขตที่ประกาศไว้

หากพบว่าจำเป็นต้องทิ้ง progress หรือเปลี่ยน external save format แบบกู้คืนไม่ได้ ให้หยุดตาม AGENTS.md พร้อมชี้ resource ที่สูญเสียจริง ไม่เพิ่ม approval step สำหรับ migration ที่ preserve ได้ครบ

### 15.3 Offline

- Settle released pending work ของ active encounter ครั้งเดียวก่อน ordinary offline approximation
- การเกิดใหม่ไม่สร้าง attack/reward ย้อนหลังให้ inactive fields
- Save/reload ไม่เปลี่ยน deterministic spawn sequence เพื่อ reroll rarity
- อย่าแก้ offline budget ทั้งระบบเป็นผลข้างเคียงของการตัด live wave dependency
- แยก tests ที่พิสูจน์ continuity กับ tests ที่รายงาน pacing; ห้ามบังคับ live/offline ดาเมจเท่ากันทุกวินาทีเมื่อ contract เป็น approximation

## 16. Patrol, Auto-Return, Boss และ Camp integration

### 16.1 Combat session completion

- ใช้ session id และ quiet boundary เป็น event ที่นับได้ครั้งเดียว
- Empty population และ empty engagement อาจเกิดพร้อมกัน แต่ห้ามเรียก completion สองครั้ง
- Session จบไม่รีเซ็ต spawn timers หรือ living population
- ป้องกัน Quiet → Combat → Quiet ที่เกิดจาก actor join/leave ระหว่าง sample ทำให้ counter เพิ่มหลายครั้งใน tick เดียว

### 16.2 Patrol compatibility

- `recordPatrolGroupClear` ปัจจุบันและ saved `groupsCleared` ต้องถูก audit ว่าเป็น legacy group progress หรือเป็น proxy ของ pulls/sessions
- สำหรับ live field ให้ใช้ completed combat sessions ที่มี id เป็น source; เก็บค่าความคืบหน้าเดิมของ save ไว้
- หากเปลี่ยน public term ใน UI เป็น combat sessions ให้แก้ glossary/wiki ที่อธิบาย ไม่เปลี่ยนแค่ข้อความปุ่ม
- Auto-travel เริ่มเมื่อ session อนุญาตให้เดิน ไม่รอแผนที่ไร้ mob
- Checkpoint population ก่อนเริ่ม travel ทุกครั้ง

### 16.3 Boss / Unique / Camp encounter

- Boss เป็น encounter/epoch policy แยกจาก ordinary respawn slot; ต้องตรวจพฤติกรรมปัจจุบันก่อนรวม owner
- การเกิด Boss ไม่ล้าง ordinary population เพื่อเปิดสนามใหม่โดยอัตโนมัติ เว้นแต่ encounter contract ระบุ explicit transition
- Boss defeat/cancel receipt ไม่ reset ordinary slot timers หรือให้ reward ตัวเก่าซ้ำ
- Camp combat ที่มี authored threat budget ยังเป็น event ของมันเอง ไม่แปลงเป็น ambient farm โดยไม่เลือก policy
- Field Camp recovery ใน hex เดิมไม่เรียก helper ที่ลบประชากรโดยอ้างว่าหยุด hunting

## 17. Execution packets

### P0 — Freeze evidence and field lifecycle census

สถานะ: READY สำหรับ investigation / regression preparation

**Objective:** รับ source ปัจจุบันและแยก confirmed failure ออกจากอาการที่ยังไม่มี trace

**อ่านก่อน:** `game.ts`, `field-area.ts`, `combat-arena.ts`, `road.ts`, `fieldwork.ts`, `exploration.ts`, `CombatArenaScene.svelte`, owner tests

**Steps:**

1. ตรวจ AGENTS และ baseline focused suites หนึ่งครั้ง
2. ตรวจว่าข้อ F01–F05 ยังเกิดบน source ล่าสุด สร้าง regressions ที่ owner tests
3. ทำ census ทุก path ที่ล้าง/แทน `s.group`, reset `spawnIn`, เปลี่ยน field key หรือ reset arena
4. ระบุแต่ละ path ว่า same-field control, area departure, dungeon หรือ actual population death
5. เก็บ effective per-spawn rarity ของทุก profile context และคำสั่งที่คำนวณผ่าน shared engine
6. ตรวจ L03–L06 เพิ่มโดย fixture/trace ที่เล็กที่สุด ไม่เดาสาเหตุ freeze

**Acceptance:** มี red proof ของ defect ที่จะรับแก้; census มี owner/action สำหรับทุก live-field path; known unrelated failures ถูกระบุแยก

**Stop:** source สำคัญถูกแก้ซ้อนระหว่าง probe จนผลทำซ้ำไม่ได้ ให้แจ้ง exact paths และถือ baseline ใหม่ก่อนเริ่ม mutation

### P1 — Separate population lifetime from Hunt/Push

สถานะ: READY หลัง P0 ยืนยัน call sites

**Files:** `game.ts`, `field-area.ts`, Camp helpers และ player-auto guards ที่เกี่ยว

**Steps:**

1. แยก active hunting-ground predicate จาก `s.hunting`
2. Hunt ซ้ำใน field เดิมเปลี่ยน player automation state โดยไม่แทน live population
3. Stop Hunt ไม่ despawn; ปิด auto movement/primary attack อย่างครบทุก reader
4. Push ใน field เดิมจบ action/session และปล่อย mob คืนบ้านตาม policy โดยรักษา survivor ids
5. ให้ ambient movement/respawn เดินต่อระหว่าง field recovery โดยไม่มี offensive hits ใส่ recovering player
6. ใน packet นี้ preserve เฉพาะ field key เดิม; กรณีไป Camp คนละ hex ต้องคง area boundary ที่ถูกต้อง P6 จึงเพิ่ม checkpoint ก่อน departure ภายหลัง ห้ามคง mob ของแผนที่ผิดที่เพื่อให้ same-field test ผ่าน

**Acceptance:** F02/F03 ผ่าน; auto-hunt off ยังเห็น population เดิม แต่ไม่มี accidental auto attack; same-field recovery ไม่เปิดกรุ๊ปใหม่

**Stop:** ถ้า helper หนึ่งใช้ทั้ง field และ dungeon แล้วไม่แยก context ได้ ให้เพิ่ม explicit context ก่อนแก้ cleanup ไม่ใช้ global replace

### P2 — Per-slot respawn authority and field data

สถานะ: READY หลัง data context จาก P0

**Files:** `engine/spawns.ts`, `spawns.json`, `spawnFieldMob`, `ensureFieldPopulation`, `releaseSpawnSlot`, spawn/field tests

**Steps:**

1. Freeze schema ของ per-spawn rarity และ update validators/readers
2. ย้าย rate authority ออกจาก runtime wave conversion และ author ค่าใหม่พร้อม comparison baseline ตาม §8/§24
3. ปล่อย slot ได้ครั้งเดียวด้วย exact owner id
4. ตั้ง/รักษา timer แยกต่อ death; refill ระหว่างที่ตัวอื่นยังสู้หรือยังมีชีวิต
5. แยก prepare/commit ของ spawn เพื่อให้ P3 ตรวจ placement ก่อน commit ได้ ทดสอบ packet นี้ด้วย home ที่ว่าง และคง counter advancement เฉพาะ spawn ที่สำเร็จ
6. เอา old group-derived supply gate ออก แทนด้วย behavior tests ที่ไม่ล็อก tuning
7. ตรวจ `spawnIn`, `group_spawn_sec`, `ttk_per_mob_sec` ไม่มี live-field authority เหลือ

**Acceptance:** F04 ผ่าน; ฆ่าหนึ่งตัวแล้วเกิดหนึ่ง slot ตาม due โดยเพื่อนคงอยู่; เปลี่ยน old wave constants ไม่เปลี่ยน field due/selection; override profile มีผลจริง

**Stop:** หากขาด context จนระบุไม่ได้ว่า probability หมายถึงต่อ spawn, ต่อ kill หรือต่อ session ให้ส่ง exact reader/data conflict ก่อน author อย่าใช้สูตร wave เก่าเป็น fallback เพียงเพื่อจบ packet

### P3 — Placement, roaming and waiting reasons

สถานะ: READY หลัง P0 สำหรับ F01; ส่วน placement และวงจร roam ต้องรอ data/interface freeze จาก P2

**Files:** `combat-arena.ts`, spatial helpers ที่มี, field placement resolver, inspection adapter และ owner tests

**Steps:**

1. F01 แยก committed return จาก ordinary roam
2. ใช้ roam disc เต็มตาม profile และรองรับ intentional stationary radius
3. ทำ deterministic spawn placement ที่ไม่ teleport/push existing bodies
4. ตรวจ blocked contact ว่า claim ownership/freeing/retry ถูกต้อง
5. เพิ่ม bounded waiting approach เมื่อมีพื้นที่ โดยไม่ให้ตัวแถวหลังตีทะลุ
6. ส่ง reason ที่ derive จาก actual sim state ให้ inspection

**Acceptance:** Roaming body ออกนอก home band ได้ภายใน roam radius; active return ยังเข้าบ้านจริงก่อนจบ; spawn บน occupied home ไม่ทำให้ตัวเดิมกระโดด; blocked slot ไม่ block slot อื่น

**Stop:** พบข้อจำกัดที่ต้องใช้ obstacle navigation ให้รายงานเป็นขอบเขตใหม่ ไม่สร้าง pathfinding framework ใน packet นี้

### P4 — Stable field camera

สถานะ: READY แยกทำได้หลัง P0 โดยไม่ชน scheduler

**Files:** `CombatArenaScene.svelte`, camera utility เฉพาะถ้าจำเป็น, scene render tests

**Steps:**

1. สร้าง F05 ให้ fail ใน rendered component จริง
2. ตัด target/focus/nearest enemy ออกจาก field camera input
3. ตรวจ pointer-world mapping, ground VFX, depth sorting และ release socket consumers
4. ใช้ sampled player feet เป็น camera source เดียว
5. ตรวจตัวอย่าง target ตาย, focus เปลี่ยนข้าง และ no-target → target

**Acceptance:** Camera transform คงเดิมเมื่อ player/world position คงเดิม แม้ focus เปลี่ยน; click ground ยังได้ world point ที่เห็น; VFX ไม่หลุด layer

**Stop:** Consumer อื่นใช้ cinematic framing จริง ให้แยก explicit mode แทนลบ math โดยไม่อัปเดต caller

### P5 — Playback discontinuity and stall proof

สถานะ: READY สำหรับ investigation; fix ต้องมี trace เป็น prerequisite

**Files:** Scene RAF/clock, `arenaPlaybackTime`, App scheduler, captured frames และ clock/view tests

**Steps:**

1. วัด main host `/` และ showcase ด้วยสถานการณ์เดียวกัน
2. แยก single actor lock / world hold / main-thread stall / camera jump ตามตาราง §13
3. ทดสอบ packet jitter, pause/resume, speed change, delayed batch, history trimming และ visibility
4. ถ้า clock ถอยเพราะ re-anchor ให้ปรับ clock owner โดย preserve monotonic playhead และ known simulation bound
5. ถ้าเป็น expensive tick/render ให้เปรียบเทียบ source cost และลดงานซ้ำตรงที่วัดได้
6. ถ้าอาการเดิมหายจากการแก้ P1–P4 ให้พิสูจน์ด้วย controlled replay/trace ของ flow เดิมและครบ negative cases ใน §13; ไม่จำเป็นต้องสร้าง timing patch ที่ไม่มี defect แต่ห้ามจบด้วยคำว่า reproduce ไม่ได้โดยไม่มีหลักฐาน acceptance

**Acceptance:** ทุก fix มี pre-fix trace/regression และ post-fix proof; pause/seek/epoch behavior ไม่เสีย; ไม่มี hidden extrapolation หรือการละทิ้งเวลาเกม

**Stop:** ต้องเปลี่ยน offline budget / scheduler semantics ที่กระทบ progression ให้ทำ bounded design review ก่อน ไม่ลด ticks เพื่อให้ภาพเร็วขึ้น

### P6 — Hex departure, revisit and save migration

สถานะ: READY หลัง P1/P2 contracts freeze; ต้องเป็น owner เดียวกับ transition/save

**Files:** `field-area.ts`, road/Camp/exploration departure callers, `save.ts`, field/save/manual-control tests

**Steps:**

1. เพิ่ม inactive checkpoint population ที่มี authority ชัด และ normalizer ที่ตรวจข้อมูลจริง
2. Snapshot ก่อน departure paths ล้าง state
3. Restore ด้วยการย้าย authority เข้า `s.group` แล้วเอา inactive entry ออก
4. Reconcile due slots, stale references, returning flag และ saved positions
5. Bump schema เมื่อจำเป็น พร้อม old-save migration ที่ preserve ข้อมูลที่มีจริง
6. ทดสอบ same-field load และ A → B → A; ไม่มี wave refill ทับ living checkpoint
7. ตรวจ eviction, unknown future save และ pending-work encounter boundaries

**Acceptance:** Population/timers ที่อยู่ใน checkpoint ต่อเนื่องตาม §14–15; travel ไม่ค้างรอ group ว่าง; ไม่มี HP authorities สองชุด; save round-trip ไม่เพิ่มของ/ฆ่า/XP

**Stop:** ต้องสูญเสีย counts/progress/meaning ของ save หรือ format consumer ที่ไม่มี compatibility path ให้ชี้รายการเสียหายและขอ owner decision ตาม AGENTS

### P7 — Session integration and legacy reader removal

สถานะ: READY หลัง P1/P2/P6

**Files:** `game.ts`, exploration session callback, compatibility readers, behavior docs/wiki

**Steps:**

1. จบ combat session ด้วย identity/quiet boundary ที่นับครั้งเดียว
2. เอา live-field group-empty completion ซ้ำออกหลังมี proof
3. Patrol/Auto-Return เปลี่ยนพื้นที่ผ่าน checkpoint transaction
4. เก็บ deprecated save keys เป็น adapters ที่ไม่มี spawn authority
5. ตรวจ Boss/Camp/dungeon ว่าได้รับ explicit context ไม่ถูกตัดทิ้งตามชื่อกลุ่ม
6. แก้ docs/wiki ที่กล่าวถึง live groups/waves ให้ตรง implementation ใหม่

**Acceptance:** ไม่มี field spawn reader ผูกกับ group clear; session/Patrol ไม่ double-count; compatibility load ผ่าน; data lineage ตามไปถึง reader ได้ครบ

**Stop:** พบ exported API ที่ผู้ใช้/consumer ภายนอกยังใช้งาน ต้องรักษา adapter หรือระบุ breaking change ก่อนลบ

### P8 — Integrated live acceptance and handoff

สถานะ: READY หลัง packets ที่ได้รับมอบหมายผ่าน evidence ของตน

**Steps:**

1. ตรวจ acceptance matrix ใน §19 ด้วย focused tests
2. เล่น normal game จากเมือง เข้า field ผ่าน hex จริง หยุด/เริ่ม Hunt เปลี่ยนเป้า ตาย/พักฟื้น และกลับแผนที่เดิม
3. ตรวจ mob life cycles ต่อเนื่องอย่างน้อยหลาย death/respawn events โดยไม่ใช้การเร่งเวลาที่ข้าม ownership
4. ตรวจ debug timeline และ main host render ที่ 1920 × 1080
5. Run affected broad checks, rebuild wiki เมื่อเปลี่ยน behavior และแยก unrelated failures
6. ส่งรายชื่อ files, actual commands/results, remaining limits และ reproduction ที่ผู้ใช้ทำตามได้

**Acceptance:** ผู้เล่นเห็นประชากรแผนที่ต่อเนื่องและการเกิดใหม่รายตัว พร้อมหลักฐานว่ากล้อง/physics/clock ไม่ถูกนำมาปนกันในการอ้างว่า warp หาย

## 18. Dependencies และการแบ่งงานโดยไม่ชนกัน

```text
P0 evidence/census
 ├─ P1 population lifetime ────────┐
 ├─ P2 slot/data ── P3 placement ──┼─ P6 travel/save ─ P7 session cleanup ─ P8
 ├─ P3 roam/waiting ───────────────┤
 └─ P4 camera ─ P5 playback proof ─┘
```

| Workstream | ไฟล์ที่ถือ | เงื่อนไขก่อนเริ่ม |
|---|---|---|
| Data/rank/slot owner | `engine/spawns.ts`, `spawns.json`, slot transition | Schema freeze และ baseline effective rates |
| Simulation lifecycle owner | `game.ts`, arena movement, engagement | คนเดียวเป็นเจ้าของ shared loop ณ เวลาเดียวกัน |
| World/save owner | `field-area.ts`, road, Camp helpers, `save.ts` | Active/inactive authority contract ชัด |
| Presentation owner | Scene, camera/view math และ render tests | ใช้ simulation contracts; ไม่สร้าง gameplay flags เอง |
| Session/integration owner | exploration callbacks, docs/wiki, integrated flow | เข้าหลัง lifecycle interfaces freeze |

`field-area.ts`, `game.ts` และ `CombatArenaScene.svelte` เป็น shared hotspots ห้ามให้หลาย agent แก้ไฟล์เดียวกันพร้อมกันโดยแบ่งตามชื่อ bug

เริ่ม parallel ได้เฉพาะเมื่อผู้ใช้อนุญาตและ ownership ไม่ทับกัน การส่งข้อความหรือสร้าง thread ให้ agent อื่นไม่ใช่ส่วนที่เอกสารนี้สั่งให้ทำอัตโนมัติ

## 19. Acceptance matrix และ proof ที่ต้องส่ง

| ID | Scenario | ผลที่ต้องเห็น | Proof owner |
|---|---|---|---|
| A01 | เข้า hunting hex ครั้งแรก | Populate ตาม configured cap เมื่อ placement พร้อม | Field population test + live scene |
| A02 | ฆ่า 1 ตัว เหลือเพื่อนหลายตัว | Slot เดียว pending; เพื่อน id/HP คงเดิม | Field/kill integration |
| A03 | Slot หนึ่ง due ขณะเพื่อนยังสู้ | ตัวใหม่เกิดได้โดยไม่รอ clear | Field test |
| A04 | ตัวตายคนละเวลา | Deadlines แยกและ reload ไม่สลับ | Timer/save test |
| A05 | Release id เดิมซ้ำ | ครั้งหลังไม่มี state/reward/counter change | F04 regression |
| A06 | Hunt ซ้ำ / stop-start ใน hex เดิม | ไม่มีล้าง population / reroll | F02 + manual control |
| A07 | Hunt off แต่ยังอยู่ field | Population roam/refill ต่อ; ไม่มี accidental player auto action | Ambient lifetime test |
| A08 | ผู้เล่น Push ใน field เดิม | Surviving population ไม่หาย และ recovery ปลอดภัย | F03 + recovery test |
| A09 | Camp recovery คนละ hex | Authority ย้ายถูกที่ ไม่มี mob จากแผนที่เก่าหลงมา | Travel/Camp/save test |
| A10 | Roam จาก home | ออกนอก home band ได้ อยู่ใน roam disc | F01 regression |
| A11 | Roam radius ศูนย์ | หยุดนิ่งโดยมี intentional reason | Negative profile test |
| A12 | Returning body | จบที่ home band ก่อน roam; ไม่แกว่ง return ทุกก้าว | Existing return tests + new roam test |
| A13 | Contact เต็ม | Waiting reason และ retry หลัง claim ว่าง; ไม่ตีไกล | Crowd integration |
| A14 | Spawn home ถูก player/เพื่อนบัง | ไม่ warp ตัวเดิม; retry slot นี้โดยตัวอื่นยังเกิดได้ | Placement test |
| A15 | Focus เปลี่ยนซ้าย–ขวา | Player/world คงเดิม → camera คงเดิม | F05 rendered test |
| A16 | เป้าตาย / เป้าใหม่เกิด | ไม่มี field-wide camera jump | Live trace |
| A17 | Packet มาช้าหรือ batch หลาย tick | ไม่ย้อน ordinary playhead; ไม่มี extrapolated hit | Playback test + trace |
| A18 | Pause/resume/speed | ไม่ย้อน/ไม่ชดเชย paused wall time | View/clock tests |
| A19 | Body เคลื่อนเกิน speed × time | แยก voluntary/forced/separation และอธิบายได้ | Movement trace/test |
| A20 | A → B → A | Restore live checkpoint และ due slots ถูกต้อง | Field archive test |
| A21 | Save/load ระหว่าง pending respawn | ไม่มี reset deadline / reroll generation | Save-fidelity test |
| A22 | Save/load ระหว่าง return | Commitment ต่อเนื่อง ไม่มีโจมตีตัว immune ฟรี | Existing return save test |
| A23 | Old schema / missing archive Mob records | โหลด active progress ได้; metadata old archive ถูก reconcile อย่างชัด | Migration tests |
| A24 | Offline แล้วกลับ | Settle work ครั้งเดียว ไม่มี inactive-field reward ย้อนหลัง | Pending/offline tests |
| A25 | Group ว่างและ engagement ว่างพร้อมกัน | Session/Patrol progress เพิ่มครั้งเดียว | L03 regression |
| A26 | เปลี่ยน old wave pacing values | Field slot timing/rank profile ไม่ตามค่าเก่า | Reader mutation/negative test |
| A27 | เปลี่ยน profile ใหม่ที่ valid | Runtime reader เปลี่ยนตาม authoring จริง | Data-reader test |
| A28 | Town, dungeon และ Boss | ขอบเขตเดิมที่ไม่ใช่ ordinary field ยังทำงาน | Existing domain tests |
| A29 | Field ขยายเป็นแกนกว้าง 50 m | Projected footprint ได้ ratio จอที่เลือก โดย body/meters ไม่ถูก scale ตาม | Projection/data test |
| A30 | Player เดินข้าม field ใหญ่ | Ground, actors, marks, click และ VFX ใช้ world camera เดียวกัน | Live flow + pointer test |
| A31 | Resize viewport | Population, spawn ids, world positions และระยะโจมตีคงเดิม | Viewport test |
| A32 | Old field / pending work เข้า geometry ใหม่ | Translate world points อย่างสอดคล้อง; HP/timers/distances/IDs คงความหมาย | Migration + pending-work tests |
| A33 | Population density สำหรับ field ใหญ่ | มี mob กระจายตามพื้นที่จริง; profiler ไม่มี unbounded actor/trace growth | Layout/soak/trace |
| A34 | Render culling | ซ่อนเฉพาะ presentation ของสิ่งนอกจอ ไม่ despawn หรือหยุด AI ทั่วโลก | Sim/render separation test |
| A35 | Auto-hunt off / reactive / proximity / safe domain | Player ไม่ auto offense; hostile mob admission และ safe-domain rules ตรง §27 โดยไม่มียิงฟรีจาก immunity | Admission + manual/core integration |
| A36 | Fractional respawn deadline → save/load | Deadline ไม่ถูก floor เร็วขึ้นและไม่ reroll; spawn ได้ที่ sample แรกหลัง due | L07 + persistence regression |
| A37 | Roam/idle cycle และ per-actor phase | Goal คงที่ใน cycle, เดิน/พักจริง, load ไม่ reroll และไม่หยุดพร้อมกันทั้ง map | Deterministic roam test + live trace |
| A38 | Profile capacity กับ old save | ไม่ silently slice living records/slots และทุก reader รองรับ configured bound | Data/save validation |
| A39 | Heavy checkpoint eviction | Compact due/sequence ยังอยู่; revisit ไม่เร่ง respawn หรือรับ reward/rare generation ซ้ำ | Archive/ledger tests |
| A40 | Refused/invalid field transition | ไม่มีแก้ population/HP/timers ก่อน destination valid และไม่มี save จับครึ่ง commit | Transition negative tests |
| A41 | World transform กับ accepted combat/VFX handoff | Footprint, cast/landing time, elevated projectile และ actual contacts ยังเป็น contract ของ owner เดิมหลังขยายสนาม | Joint integration proof |

จำนวน actor ใน fixture เป็นสถานการณ์ทดสอบ ไม่ใช่ roster quota ใช้ cap ที่ profile author ไว้สำหรับ production validation

## 20. Verification commands และ baseline discipline

เริ่ม targeted baseline โดยดู scripts ปัจจุบันก่อน:

```powershell
npm --prefix game test -- tests/spawns.test.ts tests/field-area.test.ts tests/farming-ai.test.ts tests/combat-arena.test.ts tests/combat-arena-detarget.test.ts tests/combat-arena-view.test.ts tests/arena-authored-vfx-render.test.ts
```

หลังแก้ packet ที่เกี่ยว ให้เพิ่ม owner suites ตามผลกระทบ เช่น:

```powershell
npm --prefix game test -- tests/manual-control.test.ts tests/fieldwork.test.ts tests/camp-encounters.test.ts tests/exploration.test.ts tests/save-fidelity.test.ts tests/pending-work.test.ts tests/save-storage.test.ts
npm run check
```

ก่อน integrated completion เมื่อ shared contracts เปลี่ยน:

```powershell
npm run verify
npm test
npm --prefix game run build
npm run wiki
```

ไม่รัน wiki generator เพื่อเปลี่ยนแผนเอกสารอย่างเดียว แต่ implementation ที่เปลี่ยน behavior ต้องแก้ player-facing source และ rebuild ตาม AGENTS

ตรวจ live host `/` ด้วยจริง ไม่ใช้ showcase อย่างเดียว เพราะ scheduler/loaded save / auto-hunt routing ต่างกัน ทดสอบ showcase เพิ่มเพื่อ scrub action timeline แบบ deterministic

หาก baseline นอก surface ล้ม ให้รายงานชื่อ test, symptom และเหตุที่ไม่เกี่ยว ไม่แก้ VFX/data อื่นเพื่อทำให้ผลเขียว และไม่รันซ้ำโดยไม่มี input เปลี่ยน

การเปลี่ยน schema/migration ต้องใช้ regression ที่ preserve existing counts/progress ไม่ใช้การล้าง save เป็นวิธีผ่าน test

## 21. Readiness audit สำหรับส่งต่อ

ใช้เกณฑ์ของ [plan-readiness-audit](../../.agents/skills/plan-readiness-audit/SKILL.md) โดยแยก investigation ที่พร้อมทำจาก fix ที่ยังต้องมี proof

| Gate | ผล | หลักฐาน / ข้อจำกัด |
|---|---|---|
| G1 Objective/scope | PASS | §2–3 แยก live field, combat session, dungeon และ art |
| G2 Repository grounding | PASS | Source map และ F01–F05 มี source/probe; L01–L06 แยกไว้ |
| G3 Decisions | PASS สำหรับสเปกนี้ | §3 ปิด map lifetime, camera และ pacing policy; ไม่เลือก balance ใหม่เงียบ ๆ |
| G4 Contracts/dependencies | PASS สำหรับ handoff | Slot/authority/packets ระบุแล้ว; §25 กำหนด minimum contracts และ shared-file ownership กับอีกสองแผนก่อนเริ่ม integration |
| G5 Safety/edge cases | PASS แบบมี checkpoints | Save/HP ownership, pending work, Push, return และ stale slot มี acceptance; ผู้รับงานต้องตรวจ schema ปัจจุบันซ้ำ |
| G6 Testability | PASS | §19 ผูก requirement กับ owner tests/live trace; freeze ไม่ถูกอ้างว่าพิสูจน์แล้ว |
| G7 Execution/stopping | PASS | แต่ละ packet มี steps, acceptance และ stop conditions |
| G8 Isolation | PASS เมื่อรับเป็น packets | ไม่พร้อมสำหรับโยนทั้งเอกสารให้หลาย agent แก้ shared files พร้อมกัน |

**Verdict: READY สำหรับ sequential/owned packets ตาม §17–18 และ activation checkpoint ใน §23.9.** P5 พร้อมสำหรับการพิสูจน์อาการก่อนเลือก repair; ไม่ใช่การอนุมัติ speculative timing patch

Readiness ตามขอบเขตของแต่ละ packet; `PASS` หมายถึงมี objective/contract/verification ที่รับทำได้ ไม่ได้หมายความว่างาน prerequisite เสร็จแล้ว:

| Task | G1 | G2 | G3 | G4 | G5 | G6 | G7 | G8 | Verdict |
|---|---|---|---|---|---|---|---|---|---|
| P0 evidence/census | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY |
| P1 same-field lifetime | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY หลัง P0 |
| P2a profile/schema freeze | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY หลัง P0 |
| P3 roam/placement | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY ตาม interface checkpoint |
| P4 camera/ground | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY แยก owner |
| P5 investigation | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY สำหรับ proof; repair ต้องผ่าน evidence gate |
| P6 checkpoint/migration | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY หลัง P2a contract freeze |
| P2b geometry activation | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY เฉพาะเมื่อ P3/P4/P6 ผ่าน |
| P7/P8 integration | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PASS | READY หลัง owner packets ส่งหลักฐาน |

Critical unknown ที่ผู้รับงานต้องปิดผ่าน P0/P5 คือ actual stall cause และ departure ordering ใน source เวอร์ชันที่ตนรับ ไม่ใช่คำถามให้ผู้ใช้เลือก implementation detail

## 22. Handoff format และ Definition of done

ผู้ implement ต้องส่ง:

1. Files/symbols ที่เปลี่ยน พร้อม authority ที่เปลี่ยนในแต่ละจุด
2. Regression ที่เห็น fail ก่อนแก้และผลหลังแก้ พร้อม command จริง
3. Old-reader census: อะไรถูกลบ อะไรเหลือเป็น compatibility และอะไรยังมี live authority
4. Save migration / round-trip / revisit evidence หากแก้ persisted checkpoint
5. Live gameplay flow ที่ตรวจ, viewport และข้อจำกัดของ screenshot/DOM evidence
6. Remaining failures/limits ที่ยังไม่ผ่าน ห้ามรวมเป็นคำว่าเสร็จทั้งหมด

ถือว่าเสร็จเมื่อ:

- Map มี population lifetime ของตัวเองและ refill ต่อ slot ตาม due
- Hunt controls, session completion และ player defeat ไม่สร้างกรุ๊ปใหม่ใน field เดิม
- Mob roam ได้ตามพื้นที่ และตัวที่หยุดมี reason ตรงกับ simulation
- Spawn ไม่สร้าง physics displacement ใหญ่เพื่อเปิดที่
- การเปลี่ยน target ไม่ย้าย camera ของ field
- อาการ freeze ที่ทำซ้ำได้ถูกพิสูจน์และแก้; หากมี blocker ค้าง ให้รายงานว่างานยังไม่ complete ไม่ใช้ blocker เป็นทางผ่านของ release gate
- Modular hex travel / checkpoints / save คง identity/timers/progress ตามขอบเขตที่ประกาศไว้
- Validation และ runtime อ่านข้อมูลใหม่จริง ไม่มี dead key หรือ old wave gate มาคุม field ต่อ
- ตรวจ `/` จริงและทำ required checks แล้วรายงานตามผลจริง
- ไม่ commit/push และไม่มี temporary probes, red tests ที่ทิ้งไว้โดยไม่ตั้งใจ หรือ helper processes ของงานนี้ค้าง

## 23. Field กว้างประมาณ 50 m โดยยึด ratio ของ monitor

### 23.1 แยกขนาดโลกออกจากขนาดจอ

ผู้ใช้แก้ทิศทางชัดเจนว่าไม่ใช้ 50 × 50 m แบบสี่เหลี่ยมจัตุรัส ให้คิดตามอัตราส่วน monitor

- Canonical viewport สำหรับ authoring/verification คือ 1920 × 1080 หรือ 16:9
- ใช้ความกว้างแกนหลักของ field 50 m เป็นฐาน แล้วหา depth ให้ **projected field footprint** ได้อัตราส่วน 16:9 ผ่าน projection ที่เกมใช้จริง
- World bounds เป็นข้อมูล canonical ที่ persist ได้ ไม่คำนวณใหม่จากขนาดหน้าต่างของผู้เล่นทุกครั้ง
- Runtime resize เปลี่ยน viewport/camera/culling; ไม่ย้าย home points ไม่เปลี่ยน cap ไม่ขยายรัศมีสกิลหรือ body
- Camera เห็นพื้นที่รอบผู้เล่น ขนาดสนามทั้งหมดไม่ใช่ระยะที่ต้อง fit ลงในจอเดียว

### 23.2 สูตรและค่าตั้งต้นจาก projection ปัจจุบัน

ให้ ground projection ที่ไม่รวม translation เป็น:

```text
screenX = a * worldX + b * worldY
screenY = c * worldX + d * worldY

projectedWidth  = abs(a) * W + abs(b) * H
projectedHeight = abs(c) * W + abs(d) * H
R = viewportWidth / viewportHeight

H = W * (abs(a) - R * abs(c)) / (R * abs(d) - abs(b))
```

จาก `arena-camera.ts` ปัจจุบัน `a=42, b=10, c=-8, d=30` ก่อน common scale เมื่อ `W=50` และ `R=16/9` จะได้ **ground bounds ประมาณ 50 × 32.0513 m** ซึ่งฉายออกมาเป็น bounding footprint 16:9

ตัวเลข depth นี้ไม่ได้หมายความว่าจอเป็นสัดส่วน 50:32 แต่เกิดจากแกนพื้นเอียงของเกม หากเป็น orthogonal top-down projection จึงจะใช้ 50 × 28.125 m ตรง ๆ ได้ ห้ามเลือก 28.125 หรือ 32.0513 โดยข้าม projection validation

ผู้ implement ต้องอ่าน coefficient ปัจจุบันจาก shared projection แล้วทดสอบผลที่คำนวณ ไม่สร้างค่าทั้งสองชุดแยกใน component และ data ข้อจำกัด:

- Denominator ต้องเป็นบวกและ H ต้อง finite/positive
- ตรวจรวม body/roam margins และ field corners จริง
- ถ้า projection เปลี่ยน ต้อง re-author bounds/layout ด้วย revision ที่ชัดเจน ไม่เปลี่ยนโลกของ saved field แบบเงียบ
- ไม่เพิ่ม runtime settings ที่ผู้เล่นเปลี่ยน ratio แล้วขยายโลก/ดึง mob ให้เข้า range ได้

### 23.3 Ground ต้องเป็นส่วนของโลกที่ camera เลื่อน

ปัจจุบัน painted ground image อยู่คนละชั้นกับ camera-translated actors จึงต้องตรวจด้วยว่าผู้เล่นเดินแล้วมี optical motion ของพื้นจริง ไม่ใช่ player อยู่กลางจอคงที่ขณะที่พื้นนิ่งและมีแต่ mob เลื่อนเข้ามา

เมื่อขยาย field:

1. กำหนด world-ground extent จาก bounds และ projected corners
2. Ground features, spawn landmarks, actor feet, range shapes และ VFX ใช้ camera transform เดียวกัน
3. Screen HUD อยู่ด้านนอก world transform
4. ใช้ first-party terrain ที่มีเป็น blockout/reusable patches ตามขนาดจริง ไม่ยืด actor/อาวุธให้เข้ากับภาพพื้น
5. ถ้า asset พื้นเดิมไม่พอแสดงพื้นที่ 50 m ให้ส่ง art brief แยกพร้อม world footprint; geometry/AI tests ยังต้องทำได้ด้วย blockout ก่อน
6. ไม่อ้างว่า background ที่วาดขยายด้วย CSS เท่ากับมีสนามเดินได้ 50 m

อย่าใช้ terrain hex สำหรับ travel เป็น local combat floor โดยสมมติ scale/anchor เดียวกัน ต้องยึด [map-art.md](../map-art.md) สำหรับงาน hex และสัญญา local ground ใน packet นี้แยกกัน

### 23.4 Layout และ population density

สนามเดิม 18 × 12 m มีพื้นที่ 216 m² สนามตาม projection ตัวอย่างข้างต้นประมาณ 1,602.56 m² หรือใหญ่ขึ้นประมาณ 7.42 เท่า การเก็บ population 6–8 ตัวและจุดเดิมทั้งหมดจะทำให้พื้นที่ใหม่โล่งเกินไป

ให้ data owner ใช้ density ของ field เดิมเป็น comparison hypothesis แล้วเลือก density ของ field ใหม่จาก habitat, visible encounters, travel และ pressure ที่ต้องการ:

```text
initialDensity = oldAuthoredCap / oldGroundArea
proposedNewCap = round(initialDensity * newGroundArea)
```

ตัวอย่าง old cap 6/8 จะได้จุดตั้งต้นประมาณ 45/59 ตัว ตัวเลขนี้เป็นข้อเสนอ authoring เริ่มต้น ไม่ใช่ content quota หรือ fixed expected count ใน tests ให้ตรวจ profiler/encounter pressure ก่อน freeze production values

สูตรนี้ไม่ใช่ข้อบังคับว่าระบบใหม่ต้องมี density เท่าเดิม ผู้ใช้อนุญาต redesign แบบ RO + PoE ตาม §24; first delivery ต้องมีตัวเลขที่ทดลองและเลือกแล้ว ไม่ค้างไว้เป็นคำว่า tune later

- Author respawn interval และ rarity **ต่อตัว** ตาม loop ใหม่; ใช้ baseline ที่เก็บก่อนขยายสนามเทียบผล ไม่คำนวณค่าใหม่ผ่าน wave formula เก่า
- กระจาย home points เป็น hunting patches ตามพื้นที่และเส้นทางเดิน โดยมีช่องว่างระหว่าง patches ไม่ให้ assist chain ปลุกทั้งแผนที่จากจุดเดียว
- การมี patches ไม่ได้เพิ่ม wave barrier แต่ละ slot ยังตาย/เกิดตามเวลาเฉพาะตัว
- Zone/subzone cap overrides เดิม 6/8 ต้องถูกตรวจและ author ใหม่ ไม่เปลี่ยนแค่ defaults แล้วปล่อย overrides ทำให้โลกยังมีแค่ไม่กี่ตัว
- Inventory bounds อย่าง `MAX_SLOTS=16` และ `MAX_ACTORS=64` ใน `field-area.ts` ต้องตรวจพร้อม data, normalize, save และ test fixtures ก่อนเพิ่ม cap ห้ามแก้ limit จุดเดียว
- หาก profiler แสดงว่า density ตัวอย่างสูงเกิน budget ให้ปรับ authored density อย่างเปิดเผยพร้อมก่อน/หลัง อย่า silently truncate population ตอนโหลด
- แยก alive density กับจำนวนศัตรูที่เข้าไฟต์พร้อมกัน ความสามารถของ contact ring และ aggro ยังต้องเป็น physical geometry จริง
- การเพิ่มจำนวน living slots เพิ่ม available supply ของ field; ไม่อ้างว่า global XP/drop ต่อเวลาคงเดิมเพียงเพราะรักษา rarity ต่อ kill ต้องรายงาน encounter pressure และ throughput ที่วัดจริง

### 23.5 การค้นหาเป้าของ auto-farming ในแผนที่ใหญ่

ตรวจ current `arenaTarget`/skill aim ว่ากำลังเลือก nearest body ทั้ง map หรืออยู่ใน acquisition policy ที่ตั้งใจไว้ อย่าเปลี่ยนจาก 18 m เป็น 50 m แล้วปล่อยให้ player วิ่งหา target อีกมุมแผนที่โดยไม่มี reason

P0 ต้องทำ fixture ที่ไม่มีเป้าใกล้แต่มี mob อยู่อีก patch แล้วบันทึก behavior ปัจจุบัน จากนั้นใช้ policy ต่อไปนี้ในงาน field ใหญ่:

- Profile ของ farming มี acquisition/search radius ชัดเจนที่ data เป็นเจ้าของ
- ถ้ามี target ที่ eligible ภายในพื้นที่ค้นหา ให้ใช้ identity/priority policy ปัจจุบัน
- ถ้าไม่มี target และ auto-hunt เปิด ให้ทำ bounded search movement ไปยัง authored/derived search point ในบริเวณ farming anchor แล้วประเมินใหม่
- ถ้า auto-hunt ปิด ให้ idle ตาม manual control ไม่เริ่ม search เอง
- Search ไม่ย้ายผู้เล่นข้าม hex และไม่ใช้ teleport
- อย่าแสดง waiting-for-contact กับ no-target-in-search-area เป็น reason เดียวกัน

ค่า search radius/anchor bounds ต้อง freeze ใน P0/data packet จากขนาด viewport และ hunting patches ที่ author จริง ไม่แอบยืม `range.melee` หรือ `aggro_m` ของ mob มาเป็นระยะมองเห็นของผู้เล่น

ใช้ initial 12 m / 18 m ใน §27 เพื่อเริ่ม implementation และ playtest ปรับได้ด้วย data พร้อมหลักฐานก่อน release; คำว่า freeze ข้างต้นคือการตกลง profile ที่ code จะอ่าน ไม่ใช่การรอให้ผู้ implement เดาค่าเอง

### 23.6 Migration ของตำแหน่งเดิม

เลือกเพิ่ม `layoutRevision` หรือ identity ของ layout ที่บอกได้ว่า field ใช้ geometry ใด เก็บใน active field และ inactive checkpoint ก่อนเปลี่ยน bounds production

สำหรับ old 18 × 12 m field ให้ย้ายระบบพิกัดด้วย **translation เดียว** ไปยัง legacy patch ภายในสนามใหม่ เพื่อรักษาระยะเดิมของ action ที่กำลังทำงาน ตัวอย่าง mapping ที่ชัดเจน:

```text
offset = newPlayerStart - oldPlayerStart
newWorldPoint = oldWorldPoint + offset
```

- ไม่คูณ world coordinates ด้วย 50/18 หรือ H/12 เพราะจะเปลี่ยนระยะระหว่างคู่ต่อสู้และ committed area
- Translate player position, farming anchor, actor feet, slot homes และ world-space pending-work points ให้สอดคล้อง
- Translate เฉพาะ points; vectors/directions/radii/speed/duration/HP/timers ไม่ถูก translate หรือ scale
- ตรวจ source/destination/area centers ของ pending work ตาม canonical ledger จริง ห้ามเดารายชื่อ keys จากคำว่า x/y แล้วแก้ทุก object
- คง occupied slot ids, owner ids, sequence และ future deadlines; อย่าลบ slot เดิมเพื่อสร้าง layout ใหม่ทั้งชุด
- Author legacy patch homes ให้ตรงกับ translation และเพิ่มพื้นที่/points ใหม่รอบนอก ไม่ทำให้ mob ที่มีชีวิตอยู่กลายเป็น out-of-leash ทันทีเพราะย้ายบ้านมันไปอีกฝั่ง
- New slots เติมได้ตาม population activation policy โดยไม่ทับ living bodies เดิม
- บันทึก revision หลัง migration สำเร็จและทดสอบ migrate ซ้ำว่าไม่บวก offset ซ้ำ

หาก source ใหม่มี layout revision อยู่แล้ว ให้ reuse contract นั้น ไม่เพิ่ม revision ซ้ำอีกชุด

### 23.7 Performance และ rendering

- Gameplay actors ต้องยังอยู่ใน simulation แม้อยู่นอก viewport; culling ลดเฉพาะงานวาด
- Cull ด้วย projected bounds + authored art/VFX margins ไม่ใช่ foot position อย่างเดียวจนตัดอาวุธหรือ effect ที่ยังอยู่ในจอ
- ผู้ที่อยู่นอกจอไม่หายจาก slot registry และไม่ถือว่าตาย/พร้อม respawn
- วัด contact/assist/separation ที่ population ใหม่ เพราะ cost บางส่วนเป็นคู่ actor ต่อคู่
- เริ่มจาก bounded loops ที่มีอยู่และลดงานซ้ำที่วัดได้ ใช้ spatial indexing เมื่อมีหลักฐานว่าจำเป็น ไม่สร้าง framework เผื่อไว้
- Retained frames/trace/checkpoints ต้องมีขอบเขต รองรับ cap ที่ author โดยไม่โตตามเวลาเล่น

### 23.8 เพิ่มข้อรับงานให้ packets เดิม

| Packet | งานเพิ่มสำหรับ field อิง monitor ratio |
|---|---|
| P0 | Freeze old rates/caps/coordinate schema; วัด viewport/projection และทำ fixture เป้าอยู่คนละ patch |
| P1 | Population lifetime ต้องรองรับ field ใหญ่และ search ที่ไม่ผูกกับ wave |
| P2 | Author bounds, layout revision, cap/rarity/profile inheritance และตรวจ hardcoded size limits |
| P3 | Roam/placement ใน patches, retry และ waiting points ที่ไม่พาตัวละครข้าม map แบบไร้เหตุผล |
| P4 | Player camera + world ground motion + pointer/area projection ที่ตรงกัน |
| P5 | Profile main host ที่ population ใหม่, viewport resize และ offscreen culling |
| P6 | Translate old field/pending work อย่าง lossless และ restore geometry revision ถูกต้อง |
| P7 | เอา old-group assumptions ออกจาก field completion และ bounds/slots readers |
| P8 | เดินจากกลาง field ไปขอบ/corners จริง; ตรวจ density, depth, spawn visibility และ save/revisit |

การขยายสนามเป็นงานข้อมูล+world geometry+presentation+save ร่วมกัน ไม่ถือว่าเสร็จจากการตั้ง `width: 50` และ `height` เพียงสองค่า

### 23.9 Activation checkpoint — ห้ามเปิด geometry ใหม่ก่อน migration พร้อม

ขยาย dependency ของ P2/P6 ให้ทำได้โดยไม่มีวงจร:

1. **P2a:** Freeze profile/geometry revision contract และเตรียม resolver/validation ด้วย fixtures ของ field ใหม่ ยังใช้ production bounds/layout เดิม
2. **P3/P4:** เตรียม movement/placement และ player-camera/world-ground consumers ให้รับ bounds จาก contract โดยไม่มีค่าขนาดสนามฝังใน component
3. **P6:** Implement/test old-save translation, inactive checkpoint และ pending-work mapping ตาม revision ที่ P2a freeze โดยพิสูจน์ผ่าน fixtures ก่อนเปลี่ยน production default
4. **P2b activation:** Author field geometry/layout/cap ใหม่และเปิด revision ใหม่ เมื่อ P3/P4/P6 พร้อมรับข้อมูลชุดนั้นแล้ว
5. **P5/P7/P8:** ตรวจ performance ที่ density ใหม่, completion readers และ normal gameplay/save/revisit แบบครบวงจร

ไม่ต้องสร้าง runtime feature-flag framework เพื่อ staging นี้ ให้เก็บการเปลี่ยน production default เป็นขั้นตอนรวมที่ตรวจได้หลัง consumers และ migration พร้อม การ review ต้องเห็นว่าถ้าโหลด save เก่าทันทีหลัง activation จะผ่าน transaction ใดและไม่มีช่วงใช้บ้านใหม่กับ actor coordinates เก่าปนกัน

World/slot bounds ที่ author ต้องมีบ้านเดียวใน canonical data ส่วน migration อ่าน geometry revision เดิมผ่าน resolver ที่ประกาศชัด ห้ามมี width/height ซ้ำใน JSON, component และ save migration จนเปลี่ยนไม่พร้อมกัน

## 24. Product direction — RO world + PoE combat expression

### 24.1 สิ่งอ้างอิงและความหมายที่นำมาใช้

- [Ragnarok Online — Helpful Start Guide](https://renewal.playragnarok.com/gameguide/helpfulstartguide.aspx): แหล่งทางการอธิบายการใช้ map เลือกพื้นที่มอนสเตอร์ที่เหมาะกับระดับ ใช้เป็นทิศทางเรื่องการเลือกจุดฟาร์มและความหมายของแต่ละพื้นที่
- [Path of Exile — Game Overview](https://www.pathofexile.com/game): แหล่งทางการอธิบาย skill behavior ที่เปลี่ยนได้ด้วย support และ character customization ผ่าน passive tree ใช้เป็นทิศทางเรื่อง build identity ที่มองเห็นผลในการเล่น

ข้อกำหนด population/respawn ในเอกสารนี้มาจากผู้ใช้ ส่วนข้อออกแบบด้านล่างเป็นการประยุกต์ของ ModWorld ไม่อ้างว่าเป็นสูตร, AI algorithm หรือ respawn implementation ที่คัดจากสองเกมนั้น

เลือกให้โลกฟาร์มของงานนี้เป็น persistent local field ตามทิศทาง RO และให้ระบบต่อสู้ใช้ action/build expression ตามทิศทาง PoE การสุ่มสร้าง instance/map reset ของเกมอ้างอิงไม่ได้ถูกนำมาแทน population lifetime ของงานนี้

### 24.2 ความรู้สึกหลักของแผนที่

ผู้เล่นต้องจำพื้นที่ได้จาก habitat, การจัดวาง mob และจังหวะการต่อสู้:

1. **เลือกจุดล่า:** รู้ว่าพื้นที่นั้นมีศัตรูและของที่ต้องการ รวมถึงความเสี่ยงที่คาดหมายได้
2. **อ่านบริเวณก่อนเข้า:** เห็น mob ที่อาศัยอยู่ การเคลื่อนที่ และช่องเดิน ไม่ใช่สนามโล่งที่เปิด encounter เมื่อผู้เล่นพร้อม
3. **เลือกจังหวะดึงศัตรู:** เดินเข้าระยะหรือเลือกเป้าหมายแล้ว engagement เกิดจากตำแหน่งจริง
4. **แก้สถานการณ์ด้วยบิลด์:** ประชิด, projectile และ ground-area build ใช้พื้นที่ต่างกันตาม mechanics ที่มี
5. **เดินต่อและกลับมาได้:** ตำแหน่งของ survivors และรอบเกิดของ slot ทำให้สนามมีความต่อเนื่อง; ผู้เล่นไม่ต้องรอ wave

Automatic rotation/auto-farming ยังคงเป็นรูปแบบควบคุมหลัก Manual focus, move และ ground cast เป็น deliberate intervention ที่มีผลจริง ไม่ต้องเพิ่มการกดหลบถี่ ๆ เป็นเงื่อนไขให้ core loop เล่นได้

### 24.3 Hunting patches ที่เป็นพื้นที่จริง

Layout ควรมีพื้นที่พักสายตา ทางเข้าถึง และจุดหนาแน่นที่มีเหตุผลด้าน habitat ไม่กระจาย points ด้วย grid อย่างเดียว

| บริเวณ | หน้าที่ในการเล่น | การ author |
|---|---|---|
| Entry / approach space | เข้าพื้นที่แล้วอ่านทิศเดินและกลุ่มใกล้เคียงได้ | ระยะจาก player start และ spawn footprint ไม่ทับกัน |
| Common habitat | พื้นที่ฟาร์มปกติ มี mob เดินและพัก | หลาย independent slots ที่เข้าถึงได้จริง |
| Contested pocket | ให้การดึงศัตรูหลายตัวมีผลกับการวางตำแหน่ง | Cohort/assist ที่สัมพันธ์กับ patch ไม่ chain ทั้ง map โดยปริยาย |
| Threat pocket | มีศัตรูที่เปลี่ยนการตัดสินใจ เช่น ranged, ground-control หรือ Elite ตาม content ที่มี | Reuse actual mob kits; skill behavior อยู่ owner ของ combat plan |
| Return / reposition corridor | ช่วยถอย ปรับจุดยืน และย้าย farming anchor | Physical space; ไม่ใช้ hidden teleport หรือ despawn เพื่อเปิดทาง |

Patch id เป็น spatial/content grouping เท่านั้น ห้ามกลายเป็น wave owner, kill counter ที่ล็อก spawn หรือ HP list อีกชุด หากเพิ่ม patch membership เพื่อจำกัด assist ให้ author ใน spawn data และทดสอบว่าการเกิดแต่ละ slot ยังเป็นอิสระ

ไม่มีข้อบังคับว่าทุก map ต้องมีจำนวน patches/Elites เท่ากัน ความครบวัดจากเส้นทางเล่นและความอ่านออก ไม่วัดจาก quota

### 24.4 บิลด์ต้องเปลี่ยนวิธีฟาร์มที่มองเห็นได้

ใช้ stats, skills, mods และ passive mechanics ที่มีอยู่จริง ไม่เพิ่ม support-gem/passive-tree subsystem ใหม่ใน field workstream:

| Build ที่ใช้พิสูจน์ | พฤติกรรมที่ควรแตกต่าง | หลักฐาน |
|---|---|---|
| Melee / close weapon | เข้าถึง contact, เลือกช่องยืน และย้ายไปเป้าถัดไปอย่างต่อเนื่อง | Feet/claim/reach trace + live movement |
| Projectile / ranged | ใช้ระยะยืนและแนวยิง; ไม่เดินชนเป้าเพื่อปล่อยกระสุน | Release/path/contact จาก combat owner |
| Ground AoE | เลือกจุดที่คุ้มกับตำแหน่งศัตรูและเวลาลงจริง | Actual committed area/landing ตาม combat + VFX plans |
| Fast / slow action profile | Attack/cast tempo และช่วงที่เดินต่อได้ต่างตาม effective timing | Existing canonical stats + action timing; ไม่เร่ง atlas อย่างเดียว |
| Sustain / fragile loadout | เลือกพื้นที่และขนาด pull ได้ต่างกันตามทรัพยากรจริง | HP/ES/resource และ retreat behavior ที่มี ไม่เติม hidden safety buff |

Field owner ให้ geometry, population และพื้นที่ตัดสินใจ ส่วน direction, proc, timing, weapon binding และ skill composition รับจากเจ้าของแผนที่เกี่ยวข้อง ไม่ re-implement ใน field planner

### 24.5 Pacing ใหม่ที่ไม่ถูกล็อกด้วย wave เดิม

- Author cap, per-slot respawn window, habitat membership และ rarity ใน data ให้ได้พื้นที่ที่ยังมีชีวิตตลอด loop
- Common supply ต้องรองรับการเดินต่อ ไม่ออกแบบให้ฆ่าไม่กี่ตัวแล้วเจอช่วงว่างยาวทุกครั้ง
- การเกิดใหม่อาจใช้ช่วงเวลาที่สุ่มแบบ stable ต่อ slot ได้เมื่อจำเป็นต่อ design แต่ต้อง persist due เดียว ไม่ reroll ระหว่างรอหรือ reload
- Threat/Elite เกิดจาก content profile ที่ชัดเจน มีการอ่านอันตรายตาม combat/VFX contract ไม่ใช้ rank เพิ่มเพื่อแอบแก้ mob ที่ค้าง
- ตัวเลขเดิมเป็น before/after baseline ไม่ใช่ความสำเร็จที่ต้องรักษาไว้ทุกวินาที ผู้ implement มีหน้าที่ author และทดลองค่าจริงภายใน first release นี้
- รายงาน encounter pressure, travel between targets, idle reasons และ reward opportunities ที่วัดได้ พร้อม trade-offs ไม่ซ่อนการปรับ tuning ไว้ใน code

ยังคงใช้ original first-party art direction ของ ModWorld ไม่คัดชื่อ asset, sprite, UI หรือ style ทั้งชุดจากเกมอ้างอิง

## 25. ขอบเขตกับสองแผนที่ agent อื่นกำลังร่าง — read-only references

### 25.1 เอกสารของอีก workstream

- [Combat skill coherence plan](combat-skill-coherence-plan.md): action identity/time, continuous aim/committed geometry, motion/equipment, contacts, cast/landing timeline, approach policy และ lifecycle
- [Skill VFX coherence plan](skill-vfx-coherence-plan.md): source orientation/pivot, bindings, choreography/material, component composition, landing telegraph, art production/promotion และ visual acceptance

ทั้งสองไฟล์ยังเป็นแผนที่เจ้าของกำลังปรับ ผู้ร่าง/implement งาน field ต้องอ่านฉบับล่าสุดและเคารพ ownership. งานเอกสารนี้แก้เฉพาะไฟล์ field plan ของตัวเอง ไม่เขียนแทรกหรือปรับลำดับ packet ในสองไฟล์นั้น

ชื่อ packet เช่น SC1/SC2-L/SC5 และ VF1/VF2-L ใช้ระบุสิ่งที่อ่านพบในฉบับปัจจุบัน ไม่ถือว่าฟรีซชื่อหรือ API แทนเจ้าของ ให้ re-resolve ตามชื่อหน้าที่หากเจ้าของปรับโครงสร้าง

### 25.2 Ownership ที่ต้องไม่สร้างซ้ำ

| เรื่อง | เจ้าของหลัก | Field workstream รับ/ส่งอะไร |
|---|---|---|
| Mob birth/death/respawn, home/roam/return | Field population owner | Stable actor identity, field/epoch, positions, body radius และ state changes |
| Player/skill intent + actual action schedule | Combat core owner | Field ส่ง availability/positions/reasons; รับ committed actions ที่ต้องเคารพ |
| Skill range/shape/direction | Combat core / canonical geometry | Field ใช้ shared predicates และแสดง world space ไม่สร้าง collider จากภาพ |
| Contact reservation / crowd placement | Field movement owner ร่วมกับ combat approach owner | Claim/stand constraints และ waiting reasons; final skill-stand decision มาจาก agreed intent contract |
| Weapon/grip/tip/muzzle/body animation | Combat animation / art owner | Field ส่ง sampled feet/facing; ปัญหา socket/crop ส่งให้ owner ไม่แก้ equipment manifest ใน packet field |
| Cast finish / first landing / pulse clocks | Combat timeline owner | Field/playback ส่ง sample time ที่ถูกต้อง; ไม่สร้าง deadline ใหม่ |
| Telegraph ring/progress/style | VFX integration owner ตาม core handoff | Field จัด world camera/depth/culling; ไม่เพิ่มระบบวงนับเวลาซ้อน |
| World ground, player-follow camera, field bounds | Field presentation owner | ส่ง actual camera/vector transforms ที่ skill/VFX consumers ใช้ร่วมกัน |
| VFX recipes/components/material density | VFX owner / producer | Field profilerรายงาน cost; VFX owner เลือก visual degradation ที่ไม่ตัด essential threats |
| Pending work data | Combat/persistence owner | Field ส่ง area transition/revision transform; canonical ledger owner ชี้ points/vectors ที่ต้อง migrate |

### 25.3 Shared-file rules

`game.ts`, `combat-arena.ts`, `CombatArenaScene.svelte`, `arena-camera.ts`, `combat-arena-view.ts`, `pending-work.ts` และ `save.ts` เป็น shared hotspots ต้องมี integrator/writer คนเดียวต่อไฟล์ต่อช่วง ไม่แบ่ง agent แก้พร้อมกันโดยเรียกงานตัวเองว่า mobs, camera หรือ skills

- Field owner เตรียม exact changed-surface/contract และ regressions ของตน
- Combat owner เป็นเจ้าของ action semantics และการปรับ schema ที่ skill/VFX ใช้
- Scene integrator รวม world transform กับ actor/skill consumers ในจุดเดียว
- ผู้อื่นทำ pure helper/tests/data/art ที่ไม่ทับ ownership ได้ตามที่มอบหมาย
- หาก source เปลี่ยนกลางงานจน proof ใช้ไม่ได้ ให้ refresh context และประสานผ่านช่องทางที่ผู้ใช้อนุญาต ไม่ overwrite draft หรือ runtime ของคนอื่น

เอกสารนี้ไม่ได้ให้สิทธิ์ส่งข้อความ สร้าง thread หรือสั่งงาน agent อื่นเอง

### 25.4 Minimum integration contract

ใช้ records/types ที่ core owner มีอยู่ก่อนเสนอ fields ใหม่ ต้องตกลง facts ต่อไปนี้ก่อน world activation:

1. Stable actor identity + birth/generation และ field/arena epoch; species name, slot index หรือ reused slot id ไม่ใช่ effect identity
2. Sampled world feet, previous/current positions, radius, facing และ effective AI/action state
3. World→view point/vector transforms และ inverse ที่อ้าง actual camera ตัวเดียว
4. Action id, primary end, release/impact/cancel receipts และ actual recipient facts จาก canonical clock
5. Birth/despawn/return/area-exit boundaries ที่ renderer/VFX ใช้หยุด attachment หรือคืน cache ได้ถูกตัว
6. Geometry revision transform สำหรับ persisted world points โดยไม่แตะ vectors, radii หรือ action deadlines
7. Viewport/culling visibility ที่ไม่ลบ gameplay actor/event และไม่ตัด telegraph/weapon spill ที่ยังมองเห็น

Clock ของ field playback ไม่ใช่ cast clock: การแก้ frame pacing ต้องไม่เลื่อน `releaseAtUs`, first landing, pulse interval หรือใช้ generic impact delay แทน schedule ที่ combat owner resolve แล้ว

### 25.5 ไม่สร้าง circular completion gate

Field และ combat/VFX ทำ independent code/data work ต่อได้หลัง minimum contract freeze ไม่ต้องรอทุกภาพใหม่ของอีกแผนก่อนเริ่มเขียน population

First field release ต้องพิสูจน์การทำงานร่วมกับ accepted combat/VFX version ที่ใช้จริง รวม hostile ground threat, projectile และ melee ในโลกที่เคลื่อนตามกล้อง. Current promoted art ที่ผ่านใช้ได้; ภาพ/telegraph ใหม่ที่ยังร่างอยู่คง ownership ของอีก workstream ไม่ถูกบังคับ promote เพื่อปิด field ticket

ถ้า consumer contract ที่จำเป็นยังไม่พร้อม ให้ field work แสดงเป็น pending integration และทำงานอิสระต่อ ไม่ประกาศ whole field complete และไม่แก้แผนอีกฝ่ายให้ตนผ่าน gate

## 26. First-release completion gate — ใช้รับงานครั้งแรก

### 26.1 ระดับการเสร็จที่ต้องรายงาน

| ระดับ | ความหมาย |
|---|---|
| Packet verified | งานย่อยผ่าน contract/tests ของตน พร้อมรวม |
| Integrated candidate | Shared contracts เชื่อมกันแล้ว กำลังทำ live acceptance |
| First field release complete | ทุก required behavior ใน §1.1, §19, §23 และ integration boundary ใน §25 ผ่าน |

การมี blocker, critical TODO, red regression ที่เกี่ยวข้อง, data reader ที่ยังไม่เชื่อม หรือ UI ที่ยังเดินระบบเก่า หมายถึงยังไม่ถึงระดับสุดท้าย

### 26.2 ต้องจบใน first delivery เดียวกัน

- Population เกิด/เดิน/พัก/สู้/ตาย/เกิดใหม่รายตัว; เพื่อนร่วม map ไม่ถูกล้าง
- Hunt off/on, Push และ recovery ในพื้นที่เดิมผ่านครบ
- Return-home และ waiting-for-contact ไม่กลายเป็น actor ที่หยุดแบบไร้สาเหตุ
- Field กว้างประมาณ 50 m ตาม projected monitor ratio พร้อม ground motion, camera, pointer และ layout/cap ที่ author ใช้จริง
- Bounded farming search เมื่อไม่มีเป้าใกล้ และ manual commands ที่ยกเลิก/แทน intent ตาม contract
- Save/load, active→inactive→active field, old-save migration, pending work และ viewport resize
- Session/Patrol/Auto-Return/Boss/Camp/dungeon integration ที่ได้รับผลจากการรื้อ field group lifecycle
- Old wave assumptions ไม่มี live field authority; compatibility adapters มีขอบเขตชัด
- Main-host playback ผ่าน pause/speed/hitch/visibility cases และอาการที่ report มี trace/acceptance ปิด
- Field visual/readability พร้อมใช้กับ accepted combat/VFX version ไม่จบที่ debug-only scene หรือ terrain blockout
- Initial profiles และ lifecycle interfaces ใน §27 ถูก implement/author หรือปรับจากผลทดลองพร้อมบันทึกเหตุผลก่อน release ไม่มี critical tuning/schema ค้างเป็น TODO

### 26.3 Review scenarios ที่ต้องดูร่วมกัน

1. เริ่ม character/โหลดเซฟเก่าในเมือง → เดินเข้า hunting hex → พบ population ที่ใช้งานได้
2. ฟาร์มด้วย melee, projectile และ ground-area reference loadouts โดยใช้ mechanics ปัจจุบัน
3. ฆ่าบางตัว เหลือ survivors → เห็น independent refill โดยยังมีการเดิน/ต่อสู้ของตัวอื่น
4. Hunt off/on → manual move/focus/cast → เปลี่ยนเป้า/เป้าตาย โดยกล้องและ intent ต่อเนื่อง
5. Player Push → field recovery/ต่าง hex ตามกรณี → เล่นต่อโดยไม่มี population reset ที่ผิดสัญญา
6. เดินข้าม field และขอบ/corners → ออกจาก hex → กลับมา → save/load ระหว่าง timer และ return
7. มี crowded pull, occupied spawn point, hostile ground threat และ released projectile พร้อมกัน
8. Pause/resume, speed change, hidden→visible และ delayed packet โดยไม่ replay hit/reward หรือทำให้ body warp

สำหรับแต่ละ flow ส่ง observable evidence และ exact version ของ contracts/selected assets ที่ใช้ ไม่ยึดจำนวนการรันทดสอบแทนความครบของ flow

### 26.4 วิธีปิดงาน

ผู้รับงานต้องใช้ acceptance matrix เป็น release checklist ในผลส่งมอบ ระบุ PASS/FAIL/NOT EXERCISED ต่อแถวและเหตุผล หาก critical row เป็น FAIL หรือ NOT EXERCISED ให้ทำต่อหรือส่ง exact blocker โดยคงสถานะ incomplete

การจัดทำแผนนี้ไม่ได้รับประกันว่าไม่มี defect ใดเหลืออยู่ สิ่งที่ first implementation ต้องส่งคือระบบครบตาม contract พร้อมหลักฐานของ flows และ negative paths ที่ระบุ และไม่มีการเลื่อนส่วนสำคัญของ scope ไปเป็นงานอนาคตเพื่อประกาศ complete

## 27. Closed implementation decisions — สเปกตั้งต้นที่รับไปเขียนได้

ส่วนนี้ปิดรายละเอียดที่ไม่ควรปล่อยให้แต่ละ agent เลือกคนละแบบ ชื่อ API/data ใหม่เป็น selected implementation contract ไม่ใช่คำอ้างว่าไฟล์หรือ schema เหล่านั้นมีใน runtime แล้ว ผู้ implement ต้อง map ลง existing types ก่อนเพิ่มซ้ำ และรายงาน deviation ที่จำเป็น

### 27.1 ที่อยู่ของ responsibilities

| Responsibility | Selected home |
|---|---|
| Profile/layout resolution, stable seed และ validation | `engine/spawns.ts` + `tools/data/spawns.json` |
| Living Mob factory และ reward/damage transaction | Existing `spawnMob` / kill pipeline ใน `sim/core/game.ts`; ไม่ย้ายสูตร combat ไป field module |
| Slot lifecycle prepare/commit และ active population reconciliation | เสนอไฟล์ใหม่ `game/src/sim/world/field-population.ts` ถ้ายังไม่มี equivalent helper; imports types/shared readers, ไม่ import `game.ts` ย้อนกลับ |
| Field identity, slots, active/inactive checkpoint และ normalization | Existing `sim/world/field-area.ts` |
| Movement, placement predicates และ contact constraints | Existing arena/spatial helpers ตาม field/core ownership ที่ freeze |
| World activation/departure orchestration | One integration point ใน world lifecycle; callers road/Camp/Patrol เรียก operation เดียว |
| Renderer และ visual clock | Existing Scene/view/camera owners; ไม่สร้าง gameplay timer ใน component |

Mob factory ที่ส่งเข้า population helper ต้องรับ resolved slot/seed/profile แล้วคืน candidate Mob ที่ยังไม่ถูก append หรือจ่าย reward Population helper เป็นผู้ commit owner+position+sequence พร้อมกันเมื่อ placement สำเร็จ

ไม่ต้องสร้าง event bus, ECS, background service, pathfinding library หรือ clock ใหม่เพื่อแบ่ง responsibilities นี้

### 27.2 Initial data profiles สำหรับ first release

ค่าด้านล่างเป็น **ค่าเริ่มต้นที่เลือกสำหรับการ implement และ playtest รอบนี้** ให้ author ใน canonical JSON แล้วรับค่าจริงจาก readers. เป็นการตัดสินใจออกแบบ ไม่ใช่ผล benchmark หรือข้อบังคับด้าน balance ใน tests ผู้ implement ปรับได้จากหลักฐานก่อนส่งมอบ และต้องระบุค่าที่เลือกสุดท้าย

| รายการ | Initial selection | หมายเหตุ |
|---|---|---|
| World width | 50 m | Canonical local field ไม่ใช่ screen FOV |
| World height | ประมาณ 32.051282 m สำหรับ projection ปัจจุบัน | ตรวจ projected 16:9 ตาม §23; ห้าม scale skill/body ตามตัวเลขนี้ |
| New player start | กลาง usable ground bounds | World point ต้อง radius-inset และไม่ทับ spawn homes |
| Active population | Calm 32 / standard 40 / dense 48 | Author ต่อ map/profile; ไม่เอา old zone overrides 6/8 ค้างโดยไม่ได้ตรวจ |
| Slot/actor capacity | รองรับอย่างน้อย configured slots + encounter reserves ภายใน hard bound ที่เลือกไว้ | เริ่มประเมิน bounded capacity 64; ตรวจทุก validator/save reader ไม่ silently slice |
| Ordinary respawn window | 24–40 s | เลือก due หนเดียวต่อ death ไม่ใช่ retry random ทุก tick |
| Elite respawn window | 60–90 s | อ่าน normalized rank ที่ factory ยืนยัน ไม่ทายจาก body size/ชื่อภาพ |
| Wild Unique respawn window | 180–300 s | Scheduled Boss ยังใช้ encounter policy ของตัวเอง |
| Ordinary-slot Elite chance | 0.05 ต่อ successful eligible birth | Threat pockets override ได้ด้วย explicit data |
| Ordinary-slot Wild Unique chance | 0.002 ต่อ eligible ordinary birth | รักษาความหมาย conditional ตาม factory ไม่บวก chance ซ้ำ |
| Ordinary roam radius | 2.5 m หรือ per-point override | Goal ต้องอยู่ใน home disc และ field bounds |
| Roam cycle | 8 s | Stable phase offset ต่อ actor |
| Idle window ต่อ cycle | 2.5 s | จงใจพัก; ถึง goal เร็วให้พักจน cycle ถัดไป |
| Roam speed | 0.35 × ordinary walk speed | ไม่เปลี่ยน combat pursuit speed |
| Aggro / assistance / home leash | 4 m / 3 m / 9 m | Initial data; same-patch assist policy ด้านล่าง |
| Home band / return pace | 0.35 m / 0.65 × walk speed | Return commitment แยกจาก roam radius |
| Farming acquisition radius | 12 m | ไม่ใช่ skill cast range และไม่ใช่ระยะตรวจโดน |
| Farming search radius รอบ anchor | 18 m | Clip ด้วย usable field; manual completed move ตั้ง anchor ใหม่ |
| Placement retry cadence | 0.25 s ใน sim time | Due เดิมคงอยู่ ไม่ block slots อื่น |
| Heavy inactive checkpoint window | 6 fields แบบ bounded LRU | Compact timer/sequence ledger ต้องไม่หายตาม eviction |

ต้อง author layout ให้รองรับ profile ที่เปิดจริง พร้อม patch grouping ที่สมเหตุผล ไม่กำหนดว่าทุก field ต้องเปิดจำนวนเดียวกัน การเติม population ยังคงอิสระแม้วางหลาย home อยู่ใน patch เดียวกัน

Fallback ของ old scalar `respawn_sec` อ่านเป็น `min=max=respawn_sec` สำหรับ migration/legacy profile เท่านั้น New writers ใช้ explicit windows ที่ reader รองรับ ไม่มี legacy runtime wave fallback

### 27.3 Spawn profile shape และ deadline semantics

Selected shape ของข้อมูลใหม่:

```ts
type RespawnWindow = { min_sec: number; max_sec: number };
type AggressionMode = 'reactive' | 'proximity';

// Logical addition to SpawnProfile; merge with current fields instead of defining a second profile.
type FieldLifeProfile = {
  respawn_by_rank: {
    ordinary: RespawnWindow;
    elite: RespawnWindow;
    unique: RespawnWindow;
  };
  default_aggression: AggressionMode;
  elite_chance: number;
  unique_chance: number;
  roam_cycle_sec: number;
  roam_idle_sec: number;
  roam_speed_mult: number;
  farm_acquire_m: number;
  farm_search_m: number;
  placement_retry_sec: number;
};
```

Per-species/variant aggression หรือ per-slot threat overrides ต้อง resolve ผ่าน content owner ที่มี ไม่สร้าง arbitrary mutable combat flags ใน renderer New spawn point มี stable `patch_id` สำหรับ layout/assistance; patch ไม่เก็บ HP หรือ spawn-clear counter

Validation ต้องตรวจ finite values, `0 < min <= max`, `cycle > idle >= 0`, probabilities, speed multipliers, field/roam bounds, known rank mapping และ profile references. ไม่ fallback NaN ไปเป็น default โดยเงียบ

Death receipt ให้ exact combat timestamp:

```text
u = stable uniform from (worldSeed, areaKey, slotId, life identity, "respawn-time")
delayUs = one integer duration inside the resolved min/max window
dueUs = deathAtUs + delayUs
persisted respawnAtSec = dueUs / unitsPerSec
```

- Normalizer รักษา fractional deadline ที่ finite; ไม่ floor ให้เกิดเร็วขึ้นหลัง load
- Spawn ได้ที่ authoritative sample แรกซึ่ง `sampleAtUs >= dueUs` และ placement ผ่าน ไม่เกิดก่อน due
- Namespace ของ rank, Mob factory, placement และ roam แยกจาก respawn-time และ combat/loot RNG
- Failure/retry ไม่เพิ่ม life sequence; death release ซ้ำไม่เขียน due/sequence ทับ
- Persist committed due เป็นตัวเลขจริง ไม่ persist แค่ min/max แล้วคำนวณใหม่ตอน load
- Life identity ใช้ actor/generation contract ที่ core owner freeze ไม่สร้าง counter ซ้ำกับ SC1; `respawnCount` เดิมเป็น opaque seed sequence ที่ต้อง migrate อย่างมีความหมาย

### 27.4 Ordered spatial sample และ birth visibility

ให้หนึ่ง authorized spatial sample มีลำดับสอดคล้องกัน:

1. Advance clocks/control ตาม existing comparator และช่วงเวลาที่ผ่านจริง
2. เคลื่อน existing actors ด้วย free-time budget; resolve bounded separation ที่จำเป็น
3. Reconcile due slots และลอง safe placement โดยไม่ขยับ existing actors เพื่อเปิดที่
4. Commit successful births และ owner links พร้อม birth timestamp
5. Refresh return/engagement membership และ schedule remaining-window actions สำหรับผู้ที่เพิ่งเข้าร่วม
6. Capture coherent frame/receipts แล้วจึงให้ presentation sample

Damage/event ordering ที่อยู่เวลาเดียวกันยังเป็นของ CombatClock/core owner ไม่สร้าง priority enum อีกชุด เพียงต้องพิสูจน์ว่าไม่มี actor ถูกวาดหรือถูก hit ก่อน birth และไม่มี orphan slot ระหว่าง sample

เกิดใหม่มี windup/action rules จริงเหมือน mob อื่น ไม่มี instant damage เพื่อชดเชย opportunity ที่สะสมขณะ slot ว่าง Visual birth cue ใช้ accepted presentation contract; effect ไม่เป็นผู้ commit Mob

### 27.5 Aggression, auto-hunt และ safe domains

เลือกแยกอิสระดังนี้:

- `s.hunting` เปิด/ปิดการเลือกเป้า เดินหาเป้า และ primary attacks อัตโนมัติของผู้เล่น
- Mob profile แบบ `proximity` ตรวจผู้เล่นใน aggro radius ได้แม้ auto-hunt ปิด; ค่า default ของ ordinary hostile field คือ proximity
- `reactive` เริ่มจากการถูกโจมตี/explicit provocation หรือ eligible same-patch assistance ไม่ใช่เพียงยืนใน aggro circle
- Assistance แพร่ผ่าน living eligible neighbors ภายใน patch เดียวด้วย membership ที่ไม่ขึ้นกับ array order; cross-patch assistance ต้องเป็น explicit content policy
- Town, phase recovery และ safe Camp domain เป็น eligibility facts ของ world ไม่ใช่การซ่อน body หรือเติม defensive stats
- ใน protected safe domain ต้องปิดทั้ง offensive initiation ของผู้เล่นและ hostile admission/impact ตาม agreed core predicate เพื่อไม่ให้ยิงฟรีจาก immunity
- ผู้เล่นที่ต้องการโจมตีออกจาก safe domain ก่อน ไม่ย้ายวงอันตรายหรือ hit geometry เพื่อยกเว้นให้ยิงจากด้านใน

Field Camp ต้องมี world anchor ที่แน่นอนเมื่อเลือกใช้ `camp_safe_m`. `FieldCamp` ปัจจุบันที่ตรวจมีเพียง cell/zone: เพิ่ม/resolve ground anchor ใน world/Camp owner เมื่อสร้าง Camp และ migrate camp เก่าจาก canonical player-start ของ geometry revision นั้น ไม่ใช้ target position หรือ camera offset แทน

Core owner รับ world eligibility callback/facts ไปใช้กับ actual impacts; Field owner ไม่เขียน damage prevention ซ้ำใน UI. Boss/Unique/Camp threat event ใช้ boundary policy ที่ระบุของตน ไม่ได้รับ ordinary safe/return immunity โดยอัตโนมัติ

การเปลี่ยน admission นี้ต้องมี regressions สองด้าน: auto-hunt off แล้ว player ไม่ออก offense เอง และ proximity mob ยังทำงานเมื่อผู้เล่นไม่อยู่ safe domain ขณะที่ reactive mob ไม่เริ่มตีเอง

### 27.6 Auto-farming search ที่จบได้

เมื่อ auto-hunt เปิด:

1. ใช้ held eligible target ก่อนตาม intent policy ของ combat owner
2. หากไม่มี ให้ค้นหาใน acquisition radius ที่ field profile กำหนด
3. ไม่มีเป้าแล้วเดินไป search waypoint ที่ deterministic ภายใน farming-anchor domain และ usable field
4. Waypoint cycle ต้องเยี่ยมพื้นที่ค้นหาต่างกัน ไม่วนสลับสองจุดที่ไม่เปลี่ยน acquisition coverage
5. ถึง waypoint, มี target ใหม่ หรือ relevant geometry เปลี่ยน จึงประเมินใหม่ด้วย core intent resolver
6. Manual move/focus/cast ยังคง priority; การเปลี่ยน target เพราะ path/contact blocked ต้องรายงาน constraint ให้ SC5 owner ไม่ force-drop deliberate focus โดย field helper เอง

Search state ต้องแยก `no-target`, `travel-to-search`, `waiting-for-contact`, `recovering`, `controlled` และ `returning` ได้ Mob ที่มองเห็นไกลอยู่อีก patch ไม่ทำให้ player วิ่งข้าม map โดยไม่มี acquisition/search decision

ไม่ต้องเพิ่ม AI planning framework; state เล็กที่ keyed ด้วย player/field epoch และ route generation ที่ bounded เพียงพอ Transient search progress ที่หายหลัง load ต้อง reconstruct โดยไม่ teleport หรือ reset population

### 27.7 Transition/checkpoint contract ที่เลือก

เลือก operation กลางสองแบบใน world lifecycle:

```text
checkpointFieldBeforeLeave(state, transitionContext, coreWorkHooks)
activateField(state, destinationContext, coreWorkHooks)
```

ชื่อเป็น selected responsibility ไม่บังคับสร้าง wrapper ซ้อนเมื่อ source ล่าสุดมี equivalent operation ที่ครบแล้ว

Transition context ต้องระบุ source/destination area, cause, actual sim time และ geometry revision. Core hooks เป็น interface เดียวสำหรับ cancel/settle ตาม area-exit policy ไม่ให้ field moduleอ่าน/แก้ action ledger ทุกชนิดเอง

ก่อน commit:

- Destination/route/access valid; refusal ไม่แก้ population/timers
- Snapshot authoritative living records, local actor state และ effects ที่ policy อนุญาตให้อยู่ใน inactive checkpoint
- ปิด unpaid work และ released work ที่ area exit ยกเลิกตาม contract; ไม่เร่ง future impacts มาจ่ายก่อนออก

ขณะ commit:

- ย้าย authority ไป inactive checkpoint ก่อน unload active list
- อัปเดต area/epoch แล้ว restore/activate destination
- Capture หลัง state coherent; ไม่มี await ที่เปิดช่อง autosave จับครึ่ง transaction

Checkpoint ภายใน heavy retention window รักษา Mob HP/identity และ per-mob status/curse facts ที่ต้องต่อเนื่องร่วมกับ source owner. Inactive field ไม่มี damage, AI, RNG หรือ rewards; remaining effect time ที่เลือก freeze ต้องไม่ถูกนำไปใช้ซ้ำสองชุดเมื่อกลับมา

Heavy checkpoint eviction ไม่ลบ compact per-slot lifecycle ledger ของ visited fields: owner/generation reference ที่จำเป็น, next-due และ sequence ต้องยังกันการเดินหลาย hex เพื่อเร่งเกิดหรือ reroll rare. Ledger ถูก bounded ด้วย known/visited field identities และ available authored slots ไม่ใช่ unbounded user-supplied keys

หากต้อง materialize field หลัง heavy cache ถูก evict ให้ประกาศเป็น reconstitution ตาม retention policy รักษา due/sequence/paid rewards และไม่อ้างว่า restore HP ที่ไม่ได้เก็บอยู่ได้. ขอบเขต persistence ที่ผู้เล่นเห็นต้องตรงกับกติกานี้ ไม่มี silently truncated archive

Compact ledger ต้องแยก `pending-after-death` กับ `occupied-before-eviction` อย่างชัดเจน: รายการ pending รอ due เดิม; รายการ occupied ที่ไม่มี heavy record แล้ว materialize เป็น generation ใหม่ผ่าน safe placement โดยไม่สร้าง death/reward ปลอมและไม่ reuse effect identity เก่า. การ materialize สำเร็จเพิ่ม birth sequence ครั้งเดียว; load/retry ที่ยังไม่ commit ไม่เพิ่ม การกลับไป field ที่ยังมี heavy checkpoint ต้อง restore exact records ไม่ใช้ reconstitution path

Per-mob effect ที่ checkpoint เก็บต้อง export/restore ตาม clock semantics ของ core owner: relative remaining durations กับ absolute expiry ไม่ใช่ชนิดเดียวกัน ห้ามคัด timestamp แล้วแอบทำให้ debuff หมดอายุหรือยืดเวลาเมื่อ inactive กลับมา

### 27.8 Geometry revision ที่เลือก

- Active geometry ใช้ canonical `combat_arena` data เป็นบ้านของ width/height/player start และมี `layout_revision`
- Historical geometry facts ที่ใช้ migrate เก็บเป็น versioned canonical legacy geometry record; ไม่คัด literals 18/12/old start ไปฝังหลายไฟล์
- `FieldState` และ inactive entries บันทึก `layoutRevision`; old saves ที่ไม่มีค่า map ผ่าน migration ที่รู้ revision เดิม
- New bounds ขึ้น production เมื่อ transform ของ active/inactive points และ core-owned pending work ผ่านแล้วเท่านั้น
- Translation ต้องใช้ก่อน normalize/clamp ด้วย geometry ใหม่ ไม่ให้ normalizer ทำลายตำแหน่งเดิมก่อนคำนวณ offset
- Body scale, cast radius, movement speed, vectors, elevations และ action timestamps ไม่ถูก scale ตามขนาด field หรือ monitor ratio

ข้อต้องการจากข้อความแนบเรื่อง linear/cone, แนวสูง/แนวดิ่ง, cast time และ landing ring ยังอยู่ในสองแผน combat/VFX ของเจ้าของเดิม Field ให้ actual projection/camera/bounds และ lifecycle ที่ consumer ใช้ได้ ไม่เขียน arc physics หรือ landing clock ซ้อนเพื่อปิดงานนี้

## 28. Implementation entry sheet และแผนจบงาน

### 28.1 ลำดับที่ให้ผู้รับงานเริ่มทันที

1. อ่าน §1/§3/§25/§27 และ current source; รับ ownership ของ shared files กับ integrator ก่อน mutation
2. รัน targeted baseline; ทำ F01–F05 และ L07 เป็น regressions ใน owner test files ขณะที่เก็บ L01–L06 แยกตามหลักฐาน
3. Freeze P2a profile/schema + minimum core handoff; เขียน active population lifetime และ slot transactions โดยยังไม่เปิด geometry ใหม่
4. ทำ roam-idle, aggression/search, safe placement และ camera/ground consumer; ทดสอบ current geometry กับ fixture ใหม่
5. Implement checkpoint/migration และ geometry revision; ผ่าน old-save และ pending-work tests ก่อน P2b activation
6. Author actual layout/density/rates สำหรับ field ใหม่และเปิด revision พร้อม consumers ที่พร้อม
7. ปิด session/Patrol/Auto-Return/legacy readers และ trace playback/performance ที่ population ใหม่
8. ทำ P8 joint acceptance บน `/` จริงและส่ง release evidence ตาม §26 พร้อม chosen final profiles

ไม่มี packet ใดมีอำนาจเลื่อนฟีเจอร์สำคัญออกจาก first release; แต่ละ intermediate state มีไว้ลดความเสี่ยงในการ implement ไม่ใช่ user-facing milestone ที่นับว่าเสร็จทั้งระบบ

### 28.2 Evidence ที่ต้องแนบในผลส่งมอบ

ใช้ตารางต่อไปนี้ในรายงานของ implementing agent โดยเติมผลจริง:

| Evidence | สิ่งที่ต้องกรอก |
|---|---|
| Contract versions | Field geometry/profile revision และ accepted combat/VFX interfaces ที่ใช้ |
| Regressions | ชื่อ test/scenario, pre-fix result และ post-fix result |
| Data decisions | Actual cap/layout/respawn/rarity/search/roam values และเหตุผลของ deviation จาก §27 |
| Reader census | Old wave keys/clear callbacks ที่เลิกใช้ และ compatibility-only readers ที่เหลือ |
| Persistence | Old save, active load, inactive revisit, fractional deadline, no reroll และ geometry migration results |
| Live evidence | Normal-game flows ใน §26.3, viewport, input/loadouts และภาพ/DOM/trace ที่ตรงเวอร์ชัน |
| Performance | Same-scenario baseline/candidate traces, actor/frame/cache bounds และสาเหตุ stall ที่ปิดแล้ว |
| Required checks | Exact commands, exit/result, baseline failures ที่ไม่เกี่ยว และ remaining limitations |
| Final state | PASS/FAIL/NOT EXERCISED ของ acceptance rows และสถานะ joint release gate |

### 28.3 Final document audit

- แผนเขียนครบสำหรับเริ่ม implementation; คำว่า FINAL ระบุสถานะเอกสาร ไม่ใช่สถานะ runtime
- การตัดสินใจหลักปิดแล้ว: population ราย slot, no live wave authority, field ตาม monitor ratio, player-only field camera, roam/idle, aggression แยก auto-hunt, spawn windows, exact deadlines, bounded search และ checkpoint transfer
- Actual stall root cause ยังคงเป็นงานพิสูจน์ใน P5 ตามแผนที่ชัดเจน ไม่ใช่ช่องให้เติม speculative fix หรือยกเว้น acceptance
- ค่า tuning ใน §27 เป็น explicit initial design; implementing agent ต้องลงค่าและทดลองให้เสร็จใน delivery เดียว ไม่ต้องรอคำตอบสำหรับ routine tuning
- Source/schema ที่เปลี่ยนใน workspace ต้อง revalidate ตาม P0; ไม่ยึดเลข version, line number หรือ test count ในเอกสารเป็น truth แทนไฟล์จริง
- แผน combat-skill/VFX ของ agent อื่นเป็น read-only coordination references งานนี้ไม่แก้สองไฟล์นั้นหรือย้าย ownership ของพวกเขา
- งานเอกสารนี้ตรวจ structure, references, decisions และ dependencies; ผล implementation ต้องส่ง proof แยกตาม entry sheet นี้
