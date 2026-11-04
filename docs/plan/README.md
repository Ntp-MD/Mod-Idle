# docs/plan — ที่รวมแผนงาน

กติกา: แผนไหนทำเสร็จครบแล้วให้**ลบไฟล์ทิ้ง** (git history เก็บ record ไว้แล้ว ไม่ต้องเก็บไฟล์ค้าง)

| ไฟล์ | สถานะ | ลบได้หรือยัง |
|---|---|---|
| [non-art-release-readiness.md](non-art-release-readiness.md) | แผนทำ v1 ให้พร้อมใช้งานโดยไม่รวมภาพ: R0–R6, decision table, session/legacy contract, journey, UX, performance และ final gates | ยังไม่ครบ — R0–R2 และ performance subplan ผ่านแล้ว; R3 หยุดที่ `inventory-policy-blocked`; R4/R5 browser ยังไม่มีเครื่องมือใน session นี้ |
| [combat-performance-plan.md](combat-performance-plan.md) | แผน offline snapshot, collision, skill selection และ CPU scheduling พร้อม regression/เกณฑ์รับงาน | implemented + verified 2026-11-03; เก็บไว้เป็นหลักฐานจนปิด release |
| `docs/active-skill-mechanics-plan.md` | เสร็จครบ stages 0–6 + gates ผ่าน (ลบไปแล้ว) | ลบแล้ว ✓ |
| `docs/active-skill-redesign-draft.md` | rollout ดำเนินอยู่: tuning ตรงตัว 8 แถว ✓ / retire 5 แถว ✓ / แถวใหม่ 9 แถว ✓ / rework 11 แถว ✓ (ตัวเลขยึดตาม draft; blizzard/meteor/thunder/arrow ใช้ค่าตั้งต้น + verify ด้วย `--calc` แล้ว) | **ยังห้ามลบ** — เป็นต้นทาง proposal เดียว |
| `docs/active-skill-redesign-draft.md` | งานที่ไม่ใช่ภาพปิดตาม R2/R3/R6 ของแผน non-art; ฐานตรวจล่าสุดผ่าน 2,326 tests / 227 ไฟล์ ไม่มี timeout และ Svelte check/build ผ่าน; VFX ยังเป็นงานแยก | รอให้ครบทั้ง rollout และภาพก่อนลบ |

ลบไฟล์แผน = `git rm` + `npm run sync` ตามปกติ
