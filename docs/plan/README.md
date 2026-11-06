# docs/plan — ที่รวมแผนงาน

กติกา: แผนไหนทำเสร็จครบแล้วให้**ลบไฟล์ทิ้ง** (git history เก็บ record ไว้แล้ว ไม่ต้องเก็บไฟล์ค้าง)

ใช้หน้านี้เป็นจุดเริ่มงานและ checklist ของแผนที่เหลือ รายละเอียดยังมีเจ้าของไฟล์เดียว ใช้ working directory และ branch ปัจจุบันตาม AGENTS.md:

| Part | ขอบเขต / แผนเจ้าของ | เกณฑ์จบก่อนส่งต่อ | สถานะ |
|---|---|---|---|
| **4 — Map art และ trailer** | [Map layout](modular-hex-map-layout.md): MAP-0–MAP-5; Highspire → Blackwater → ขยายสาม plates | สอง pilot ผ่านก่อนขยาย; agent ตรวจ/อนุมัติภาพตาม recipe/reference kit; HXM-01–HXM-12 มีหลักฐานจากเกมจริง | MAP-0–MAP-4 ผ่าน; MAP-5 trailer ติด blocker (ไม่มี progressed save ให้บันทึกจริง) |

Part 1–2 (mob placement migration) และ Part 3 (modular hex map architecture) เสร็จและตรวจผ่านครบแล้ว; แผนสองไฟล์นั้นถูกลบตาม P10/ARC-5 — contract ตัวจริงอยู่ใน `engine/types.ts`, `engine/index.ts` (`placementById`/`placementsIn`/`placementPool`/`uniquesOf`/`spawnAt`), `engine/catalog.ts`, `tools/check.ts` (X82–X88), `game/src/ui/map/{WorldMap.svelte,map-view-model.ts,map-dom.ts,map-input.ts,map.ts}` และ suites `exploration`, `mob-terrain-drops`, `mob-skills`, `save-fidelity`, `measurement-gameplay`, `ui/map-view-model`, `ui/map-input` พร้อม `game/browser-tests/map.spec.ts`

งานแยกที่พร้อมเริ่มตาม specification: [Skill VFX fallback](skill-vfx-fallback.md) — VFX-0–VFX-6 ครอบคลุม Base VFX, asset readiness/failure, payload/support/aura, showcase และ required tests งานนี้ไม่ต้องรอ footage/progressed save ของ MAP-5 และไม่เริ่ม runtime จากการบันทึกแผน

Checklist ส่งต่องานแต่ละ part:

- [x] Part 1: baseline 372 เคส PASS (seeds 7,73 · 120s) และ matrix preflight 314/18/36 ผ่าน
- [x] Part 2: full suite 241 ไฟล์ / 2451 เทสต์ PASS, verify 12/12 cages, svelte-check 0, browser map spec ผ่าน, post-run 372 เคส PASS และ compare เป็น balance-related ตาม watch
- [x] Part 3: ARC-01–ARC-13 ผ่านด้วย pure view model/index/input/renderer facade + dirty scheduler; full suite เขียว, real browser 2 เคส (interaction + isolated renderer index/flush/depth) ผ่าน, `map:check` 9/9, `verify` 12/12, svelte-check 0
- [x] Part 4 (MAP-0–MAP-4): pilot Highspire + Blackwater ผ่านหลังซ่อมแถบ calibration แดงของ ground/relief, ตั้ง `terrain_art_zones` ครบ 18, ground planar/relief upright, town/village/camp relief เฉพาะ location, anchor labels ที่ far, review records 15 ชิ้น; `map:check` 9/9, build ผ่าน, map suites 102/102, browser 2/2, fallback/arrow/Enter/console ผ่าน; performance flat vs full: far p50 16.7ms ทั้งคู่, near p50 ~50ms ทั้งคู่ (headless rAF cap — watch)
- [ ] Part 4 (MAP-5): trailer sequence ยังทำไม่ได้ — ต้องใช้ progressed save จริง (seed 7) ที่บันทึกระหว่าง pilot แต่ workspace นี้มีเพียง showcase แบบ read-only; การสร้าง save/teleport เพื่อถ่ายจะขัดข้อห้ามของแผน จึงยังไม่มี footage/HXM-10

เมื่อจบ part ให้รายงานไฟล์ที่เปลี่ยน, acceptance IDs ที่ผ่าน/ยังไม่ผ่าน, คำสั่งตรวจและผล/coverage, input/workload ที่ใช้, blocker ที่เหลือ และจุดเริ่ม part ถัดไป อัปเดตสถานะและ checkbox ในหน้านี้ตามหลักฐานจริง; gate/measurement stdout ยังคงเป็น run record ตาม AGENTS.md ไม่สร้างไฟล์ transcript หรือคัดลอก matrix/contracts มาไว้ใน checklist

กติกาปฏิบัติร่วม:

- ใช้ signature, shape, algorithm และลำดับ fallback ที่กำหนดไว้ในแต่ละแผน ไม่สร้าง implementation ทางเลือกหรือเพิ่ม dependency/framework
- ถ้าข้อกำหนดไม่ระบุรายละเอียดระดับบรรทัด ให้ย้าย/reuse implementation เดิมจาก owner ที่แผนชี้ไว้แบบตรงตัว รักษาค่าคงที่ ลำดับและ error handling เดิม ไม่ใช้ช่องว่างนี้ออกแบบ feature ใหม่
- ผู้ลงมือรับผิดชอบการตรวจและอนุมัติภาพ **เฉพาะ rollout นี้** ตาม checklist และ recipe ในแผน layout ตามคำสั่งมอบหมายข้างต้น เก็บหลักฐานจริงและแก้ภาพที่ไม่ผ่านตามลำดับที่ระบุ ไม่ขอเจ้าของเลือกภาพหรือยืนยันแต่ละภาพอีก ข้อนี้มอบหมายผู้ตรวจ ไม่ยกเว้น reference-kit review และไม่ถือว่าภาพปัจจุบันผ่านแล้ว
- hard check ล้ม: แก้ที่ owner เดิมแล้วตรวจเฉพาะส่วนที่ได้รับผล; watch เปลี่ยน: รายงานตัวเลขและคง matrix เดิม ไม่ปรับ balance อัตโนมัติ
- ถ้าข้อมูล canonical ไม่ตรง matrix หรือเครื่องมือที่จำเป็นใช้งานไม่ได้จนทำตาม recipe ไม่ได้ ให้รายงาน blocker พร้อม path/case/error และทำงานอิสระที่เหลือต่อ ไม่เดาค่า ไม่ข้าม acceptance และไม่เปลี่ยนไปใช้ design อื่น การติด blocker จริงไม่ใช่การขอให้เจ้าของเลือก implementation
- ไม่มีขั้นตอน commit/push, publish หรือเริ่ม runtime โดยอัตโนมัติจากการแก้ specification; ทำเมื่อคำสั่งงานนั้นให้อำนาจตาม AGENTS.md

ก่อนลบแผนที่เสร็จ ให้ปรับสถานะและลิงก์ของแผนที่ยังอยู่ไปยัง code/types/tests เจ้าของข้อเท็จจริง แล้วลบรายการแผนนั้นจากตารางนี้ด้วย ไม่คัดลอก contract ไปเก็บซ้ำในแผนอื่น และไม่เหลือลิงก์ไปไฟล์ที่ลบ

| ไฟล์ | สถานะ | ลบได้หรือยัง |
|---|---|---|
| [modular-hex-map-layout.md](modular-hex-map-layout.md) | ทิศทางภาพและขั้น implement: Highspire → Blackwater → สาม plates; เปิดภาพแบบ allowlist และตรวจ reference kit/HXM | ยังลบไม่ได้ — MAP-5 trailer/HXM-10 ยังไม่มี progressed-save footage |
| [skill-vfx-fallback.md](skill-vfx-fallback.md) | locked implementation specification: ready skin → ready default → Base; appearance, loading/failure, shared geometry/clock, UI และ tests กำหนดไว้ครบ | ยังไม่เริ่ม implement — เริ่ม VFX-0; ลบเมื่อ SVF-01–SVF-12 ผ่านและ closeout ครบ |

ลบแผนเมื่อไม่มีงานเหลือ; commit/push เมื่อเจ้าของสั่งตาม [AGENTS.md](../../AGENTS.md)
