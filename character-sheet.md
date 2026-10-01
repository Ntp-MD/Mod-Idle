# Character Sheet

import core-stats.md
import formula.md

ค่าที่แสดงบนหน้าตัวละคร คำนวณจาก formula.md

# แผงหลัก 4 ช่อง

| ช่อง | แสดงอะไร |
|---|---|
| HP | ค่าปัจจุบัน / ค่าสูงสุด |
| Mana | ค่าปัจจุบัน / ค่าสูงสุด |
| Attack speed | ครั้งต่อวินาที (hit per second) |
| Weight | ของที่ถือ / ขนาสูงสุด |

# Core Stats

แสดง 7 ตัว พร้อมแจกแจงว่ามาจากอะไร

| Stat | ให้อะไร | แสดงค่าคำนวณร่วมด้วยไหม |
|---|---|---|
| Str | Physical power, Weight | Physical power, Weight capacity |
| Vit | HP, HP regen | Max HP, HP regen |
| Dex | Accuracy, status alignment | Accuracy, status alignment % |
| Agi | Attack speed, Dodge | Attack speed, Dodge % |
| Wis | Cooldown reduction | CDR % |
| Int | Magic power, Mana regen | Magic power, Mana regen |
| Lck | Critical chance, Drop chance, Perfect dodge | ทั้ง 3 ค่า |

**แสดงแบบแยก 3 ส่วน** เพื่อให้ผู้เล่นเห็นว่าตัวเลขไหนมาจากอะไร

```
Str              120        (base 40 · level +60 · gear +20)
Physical power   1,450      (จาก Str)
```

# Combat Stats

| ค่า | หน่วย | หมายเหตุ |
|---|---|---|
| Physical power | ตัวเลข | มี cap ที่แสดงเป็นเส้น ถ้าแตะ cap |
| Magic power | ตัวเลข | |
| Critical chance | % | แสดง cap 100 ด้วย |
| Critical damage | % | แสดงแยก physical / magic ถ้าแยกแล้ว |
| Dodge | % | แสดง cap ด้วย |
| Attack speed | ครั้ง/วิ | แสดง cap ด้วย |
| Cooldown reduction | % | แสดง cap ด้วย |
| Accuracy | ตัวเลข | |
| Status alignment | % | |
| Status resistance | % | ถ้ายังใช้ ดูหมายเหตุด้านล่าง |
| Perfect dodge | % | |
| Drop chance | % | ไม่ต้องแสดงก็ได้ อยู่ในสถิติ |
| HP regen | /วิ | |
| Mana regen | /วิ | |

**ทุกค่าที่มี cap แสดงเป็น `ค่า / cap`** เช่น `Crit chance 42% / 100%` เพื่อไม่ให้ผู้เล่นเพิ่มอีกแล้วไม่เห็นผล

# Offense / Defense แยกกัน

## Offense

```
Attack speed      2.4 /วิ
Physical power    1,450
Magic power       0
Critical chance   42% / 100%
Critical damage   180% / 240%
```

## Defense

```
Max HP            4,200        HP regen   38/วิ
Max Mana          900         Mana regen 12/วิ
Dodge             28% / 75%
Accuracy          340
Status alignment  22%
Status resistance 45% / 75%
Perfect dodge     3%
```

# แสดง cap แบบไหน

3 ทางเลือก

| วิธี | ข้อดี | ข้อเสีย |
|---|---|---|
| ข้อความ `42% / 100%` | ชัดที่สุด กระชับ | ตารางรก |
| แถบโปรเกรส | เห็นภาพ | กินพื้นที่ |
| สี + ไอคอนล็อก | สวย | เข้าใจยากกว่า |

แนะนำ: ใช้ข้อความ `/` เป็นหลัก แล้วแถบโปรเกรสเฉพาะในหน้าสรุป (Tab ใหญ่) ที่มีที่ว่าง

# ไม่ควรแสดง

| ค่า | เหตุผล |
|---|---|
| ค่า K ทั้งหมด | เป็นตัวเลขภายใน ผู้เล่นไม่ต้องรู้ |
| สูตรย่อย | ไม่มีประโยชน์กับการเล่น |
| base power ของอาวุธ | รายละเอียดเกิน ให้ดูในหน้าอาวุธแทน |
| Mana regen / HP regen ถ้ายังไม่มีสถานะ regen | แสดงแล้วผู้เล่นสงสัยว่ามีผลไหม |

# ยังไม่มีใน core-stats.md

1. **Status resistance ไม่มี stat ให้แล้ว** — เดิม Str ให้ status res แต่เปลี่ยนเป็น Weight แล้ว ตอนนี้ไม่มี stat ไหนให้ status res เลย ต้องเลือกว่าจะให้ Vit หรือ Str หรือตัดออก
2. **Weight capacity ยังไม่มีสูตร** — มี Str → Weight แต่ไม่ระบุว่า Str 1 แต้มถือของได้เท่าไร
3. **Drop chance / Perfect dodge ไม่ระบุหน่วย** — เป็น % หรือค่าคงที่ต่อ Str
4. **Base stat ต่อ level** — ยังไม่มี ทำให้แสดงแตกข้างในกล่อง `(base · level · gear)` ยังไม่ได้

# เกณฑ์การแสดงที่ควรยึด

- แสดงตัวเลขสูงสุด (max) เสมอ ไม่ใช่ค่าที่ยังไม่คำนวณจริง เช่น Max HP ไม่ใช่ HP ปัจจุบัน
- ค่า 0 ก็แสดง ไม่ซ่อน — ผู้เล่นต้องเห็นว่า Int ของตัวเองเป็น 0 เพราะยังไม่ได้ลงจุดใน magic power
- ทศนิยมไม่เกิน 1 ตำแหน่ง และปัดลง ไม่ปัดขึ้น
- แสดง cap เสมอสำหรับ crit / dodge / cdr / aspd / status res