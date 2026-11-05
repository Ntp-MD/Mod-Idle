# docs/plan — ที่รวมแผนงาน

กติกา: แผนไหนทำเสร็จครบแล้วให้**ลบไฟล์ทิ้ง** (git history เก็บ record ไว้แล้ว ไม่ต้องเก็บไฟล์ค้าง)

| ไฟล์ | สถานะ | ลบได้หรือยัง |
|---|---|---|
| [release-remaining-work.md](release-remaining-work.md) | งาน release ที่ยังขาดหลักฐานและ final gates; หยุดการวัดตามคำสั่งเจ้าของ | ยังไม่ครบ — natural win, measurement coverage และ final closeout |
| [mob-variant-level-placement.md](mob-variant-level-placement.md) | แผน migrated ตัวและ Boss/Unique ให้มี level คงที่ ไม่ผูก band 10 level แต่ใช้ soft focus + overlap แบบ RO; มี acceptance และลำดับทำ | ยังไม่เริ่ม implement |
| [modular-hex-map-layout.md](modular-hex-map-layout.md) | แผนออกแบบ modular hex map 2.5D, hierarchy ตาม zoom, จุดทรัพยากร และ sequence trailer; MAP-0–MAP-5 พร้อมเกณฑ์ตรวจ | แผนเท่านั้น — ยังไม่เริ่ม implement หรือสร้างภาพ |
| [modular-hex-map-architecture.md](modular-hex-map-architecture.md) | แผน architecture: WorldMap, pure view model, shared DOM index, input และ renderer lifecycle; ARC-0–ARC-5 พร้อม API และ tests | แผนส่งต่อ — ยังไม่แก้ runtime |

ลบแผนเมื่อไม่มีงานเหลือ; commit/push เมื่อเจ้าของสั่งตาม [AGENTS.md](../../AGENTS.md)
