# Skill art references

โฟลเดอร์นี้เป็น holding area สำหรับภาพอ้างอิงและภาพที่ generate แล้ว ยังไม่ใช่ game asset shelf ภาพทุกไฟล์ต้องผ่านการตรวจและอนุมัติก่อนคัดลอกเข้าเกม

## มีอะไรอยู่ที่ไหน

| ไฟล์/โฟลเดอร์ | หน้าที่ |
|---|---|
| `skill-effect-design.md` | brief ภาษาภาพของ skill แต่ละหมวด (pose, VFX, ธาตุ) ใช้เป็นเกณฑ์ตรวจงาน |
| `* skills pack v1.png`, `* skill icons v1.png`, `* icon pack v1.png` | แพ็กภาพอ้างอิงที่นำเข้ามา 10 ไฟล์ คงชื่อเดิมไว้ |
| `generated/` | ภาพที่ generate ใหม่และยังรอ review/อนุมัติ |
| `vfx-production.md`, `vfx-production-roster.json` | งานสร้าง VFX สำหรับ Active skills ใหม่ทีละสกิล; ตัวที่ยังไม่ผ่านคงใช้ VFX ปัจจุบัน |

## กติกาการตั้งชื่อ

- ไฟล์อ้างอิงที่นำเข้ามาแล้วคงชื่อเดิม ไม่เปลี่ยนชื่อย้อนหลัง
- ไฟล์ใหม่ของโปรเจกต์ใช้ kebab-case และลงท้ายรุ่น เช่น `fire-skill-icons-v2.png`
- ภาพ effect ที่ generate ให้ยึด skill ID เป็นชื่ออ้างอิงตาม `skill-effect-design.md` เช่น `attack.fireball`; ถ้าต้องใช้ชื่อที่ปลอดภัยกับทุกเครื่องให้แทน `.` ด้วย `-` เป็น `attack-fireball-v1.png`

## ขั้นตอนอนุมัติ

ชุด Active VFX 23 สกิลตาม [production queue](vfx-production.md) ได้รับคำสั่งให้ทำครบแล้วใส่พร้อมกัน โดยไม่ต้องขออนุมัติแยกสกิล ใช้ผลตรวจ asset และ runtime เป็นเกณฑ์เปิดใช้ชุดนี้

1. ภาพ effect ที่ generate ใหม่ลงตรง `game/public/fx/authored/<skill-slug>/v1/` ได้เลย ไม่ต้องย้ายทีหลัง แต่ยังไม่ live จนกว่าจะเพิ่ม `AUTHORED_VFX` entry — ระหว่างทำเกมจะไม่โหลด
2. เก็บ prompt, raw, atlas meta, QC และ preview ไว้ใต้ `generated/<skill>-v1/` (ไม่ ship ไปกับเกม) แล้วตรวจกับ `skill-effect-design.md`: pose ตรงสกิล, ภาษาธาตุไม่ปนกัน, พื้นหลังโปร่งใส และไม่มีชิ้นส่วนตัวละครหรือ effect เกินขอบ
3. เปิด live ด้วยการเพิ่ม entry ใน `AUTHORED_VFX` (`game/src/ui/combat/arena-authored-vfx.ts`) อย่างเดียว:
   - skill icon → `game/src/icon/skill/` (ชื่อไฟล์เป็น key ให้ resolver)
   - raster skill effect → อ่านจาก `game/public/fx/authored/` ตรง ๆ (ไม่วางใน icon shelf)
4. เก็บต้นฉบับ/ภาพอ้างอิงไว้ในโฟลเดอร์นี้ และห้ามให้ runtime code อ้าง `art-reference/` โดยตรง

ไฟล์ภาพในโฟลเดอร์นี้ไม่ถูกโหลดโดยเกม และการมีอยู่ของไฟล์ไม่ถือเป็นการอนุมัติ
