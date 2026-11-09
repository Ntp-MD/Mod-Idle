# RimWorld of Magic — top-down skill VFX study

> **VFX version studied:** `@` RimWorld 1.6 — Torann's `A RimWorld of Magic` (Workshop `1201382956`, GitHub `TorannD/RWoM` `main` โครงสร้าง `v1.0–v1.6`, updated 2025-12-28) — อ่านเฉพาะข้อมูลเปิดเผยจาก Workshop/GitHub/Wiki ไม่ได้ดูในเกม/คลิปเกมจริง
> ModWorld counterpart: `art-reference/vfx/base-prompt.md` + `art-reference/vfx/angle-authoring.md` (140 px/m at 1920×1080 zoom 1; ground `a=d>0, b=c=0`) ฉบับปัจจุบัน ณ 2026-11-07

## แหล่งหลัก

- `https://steamcommunity.com/workshop/filedetails/?id=1201382956` — แพ็กเกจหลัก
- `https://github.com/TorannD/RWoM` — โค้ด DefXML
- `https://rwom.fandom.com/wiki/RimWorld_of_Magic_Wiki` — ฐานข้อมูลสกิล
- `https://github.com/Kon-on/rimworld-modding-skill/blob/master/library/02-%E6%A8%A1%E6%9D%BF/05-%E8%A1%A8%E7%8E%B0%E7%BA%BF/02-FleckDef.md` — นิยาม FleckDef
- `https://rimmods.com/mods/fleck-general-manager` — หลักการ FleckManager จำกัดจำนวนที่ render

## What RWoM does

- 35+ คลาส (Fire/Ice/Lightning/Arcane/Paladin/Summoner/Druid/Necro) แต่ละคลาสมีบทบาทเฉพาะ (healer/offensive/utility) และสกิลชุดของตัวเอง ไม่ใช่เวอร์ชันเดียวแบบหลายสี
- ใช้ `Ability/Projectile` แบบตาราง + `Effecter/Fleck/Mote` เป็นหลัก ศูนย์กลางความชัดเจนคือ **readability** ไม่ใช่ spectacle
- สกิล AoE อ่านด้วย pattern วง/เส้น/Cone บน tile ที่เทียบตรง gameplay โซนจริง (ดูสกิล AoE ที่คลิปไฮไลท์ว่าเป็นแสงวิ่งเข้า/ออก)
- ทุกภาพอยู่กะพื้นที่ UI (`Def`) ก่อน render — ไม่ต้องเล่นในเกมก็รู้รูปร่างก่อนใช้ หลักนี้ทำให้ค้นหาแบบนี้ยืดหยุ่น
- Effecter ไม่การันตียี่ห้อของ hitbox — รูปที่เห็นเป็นภาพประกอบ hitbox จาก `Ability`/`Tile` เย่ (`steamcommunity.com/workshop` ตัวอย่าง AoE แสงวิ่งเข้า)

## 4-layer pattern (อ่านง่ายบน top-down)

### 1) Telegraph บนพื้นก่อนระเบิด
- วงกลม/เส้น/Cone โปร่งแสง ขอบชัดบนพื้น เท่ากับโซนจริง
- ใช้ ground-air perspective `b=c=0`, `a=d>0` ไม่เพราะค่าทศนิยม
- RimWorld เน้น pattern รอบตัว AoE ที่พื้นไม่จอ ไม่ใช้ฟ้าฝ่า vertical

### 2) Fleck/Mote เล็กๆ แบบ capping
- `FleckDef` นิยามลักษณะ/อายุ/การเคลื่อนไหว ไม่กำหนดจังหวะเกิด — ทำงานร่วมกับ `EffecterDef`/โค้ด
- ใช้ FleckManager จำกัดจำนวนต่อระบบ ป้องกัน lag; ลบเก่าสุด (ยกเว้นไฟ) ตอนเกิน cap
- flecks หรือ sparks ประกาย/ไอน้ำ/เข็มไฟ ระดับเบา เฉพาะตัวผู้ร่าย (wind-up 0.4-0.8 วิ) และ burst วงเล็กที่ AoE กลาง

### 3) Ground pattern เป็นหลัก ไม่ vertical
- รูปคลี่ / Circling / ริงระลอก / ประกาย / spiral บน ground ไม่ใช่ pillar สูง
- Pattern วงคลื่นที่สะใจ เน้นเส้นขอบชัด ไม่ใช้ flash ขาวเต็มจอหรือ flare ยาว
- ของเหลว, มงคล, เมฆพิษ มาในรูปของ decals วงกลมที่กระจายพื้นแบบ opacity ต่ำกว่า sprites

### 4) Palette แยกตามธาตุ
- Fire แดง-ส้ม / Ice น้ำเงิน-ขาว / Lightning เหลือง / Arcane ม่วง-ม่วง
- ภาพหลักเก็บจางและอ่านเป็นรูปที่ชัดเจนเป็นสำคัญ ระดับความแข็งของภาพรองพยายามไม่ทับ sprites หลัก

## Applying to ModWorld field VFX

- Telegraph: วง/เส้น/โคนโปร่งแสง 15%-30% + ขอบชัดคงสัดส่วน gameplay
- Cast: Fleck/Mote ที่เท้า 0.4-0.8 วิ แล้ว ripple/burst ที่ AoE กลาง fade 1-2 วิ ไม่เปลี่ยนตำแหน่ง/ความเร็ว
- Flat ground เท่านั้น — ไม่มี vertical flare, ไม่มี screen flash, ไม่มีมุม perspective เร่งด่วน
- แยกธาตุด้วยสี+ลวดลายเท่ากันทุกตัว + จำกัดจำนวน particles ต่อ actor
- เทียบสี: cmd palette: ดูคลิปจุด gists ที่กันภาพ เข้าตากับ sprites/icons

## Notes

- RWoM ใช้ระบบ Eventer/Fleck/Mote จาก RimWorld เดิม ไม่ได้สร้างเอนจินใหม่
- RimWorld of Magic บนเกมจริงอาจทำสีเป็น 3-4 สเต็ปบนโซนพื้นนอก กันสลับจังหวะกับ hitbox เดิม
