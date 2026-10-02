# Elements

import core-stats.md
import formula.md
import attribute-item.md
import equipment-slot.md

ธาตุ 5 ตัว — fire · cold · lightning · poison · chaos
ทำหน้าที่เป็นช่องดาเมจที่ 3 อยู่ข้าง physical กับ magic

# 1. ธาตุทั้ง 5

| ธาตุ | กลไกหลัก | สถานะที่ทิ้ง |
|---|---|---|
| Fire | เผาไหม้ต่อวินาที | burn |
| Cold | ลดความเร็วโจมตีเป้าหมาย | chill |
| Lightning | สะดุดสั้น ๆ | shock |
| Poison | สะสมชั้น ไม่หายเอง | poison |
| Chaos | ยิงยาวแล้วแรงขึ้น | mark |

- 1 ชิ้นสุ่มได้ธาตุเดียว ห้าม 2 ธาตุในชิ้นเดียว
- ธาตุเป็นแค่ tag ของดาเมจ ตัวเลขพลังยังคำนวณแยกเป็นช่องของตัวเอง
- ทุกธาตุใช้สูตร power ชุดเดียวกัน ต่างกันที่ตัวคูณ สถานะ และคู่ต้าน

# 2. Elemental power

```
elem       = (int * K_ELEM + elem_flat) * (1 + elem_pct/100) * weapon_mult
elem_align = dex * K_DEX_ALIGN + elem_align_flat
elem_align = min(elem_align, 50)

dmg_per_hit = phys + magic + elem * elem_align/100
dps         = dmg_per_hit * (aspd / 100)
```

- ใช้ **Int** เป็นตัวหลัก เพราะ elemental อยู่ฝั่ง magic family — ไม่ต้องเพิ่ม stat ใหม่
- `K_ELEM` = 4 ต่ำกว่า `K_INT` = 5 เล็กน้อย เพราะดาเมจธาตุต้องผ่าน alignment ก่อนจึงจะออก
- ใช้ Dex เป็นตัวยืนยันธาตุ ตัวเดียวกับ status alignment เดิม ไม่ต้องแยก stat ใหม่
- ตีโดนธาตุได้ก็ต่อเมื่อสุ่มผ่าน alignment ไม่งั้นไม่ได้ดาเมจ
- **ดาเมจธาตุไม่ crit** — crit เป็นสิทธิของ physical กับ magic เท่านั้น หน้าที่ควบคุมเวลาของ lightning จึงไม่ถูกกลืน

## ตัวเลขจริงของ build ธาตุ (วัดจากตาราง affix ปัจจุบัน)

build ที่ลง Int 6 ชิ้น / Dex 3 ชิ้น / ช่อง alignment 2 ชิ้น ที่เลเวล 100:

| ค่า | ผล |
|---|---|
| Magic power | 2,807 |
| Elemental power ดิบ | 2,207 |
| Elemental alignment | 26.4% |
| **ดาเมจธาตุที่ผ่านการ gate แล้ว** | **582** = เพิ่มจาก magic power 21% เท่านั้น |
| burn 3 ชั้น (K_FIRE_BURN 0.30) | 524 ต่อวินาที |
| poison 10 ชั้น (K_POISON 0.08) | 466 ต่อวินาที |

- **ธาตุตอนนี้เป็นของแถม ไม่ใช่ทางเดินของ build** · ต่อครั้ง elem ผ่าน gate แล้วเพิ่มจาก magic แค่ +21% และ DoT ทั้งก้อน (burn 3 ชั้น = 524/วิ) คิดเป็น **8% ของ DPS build นั้น (6,180/วิ)**
- ถ้าจะคงคำว่า "elemental dot" ไว้ในรายการ build ของ concept.md ต้องตัดสินใจอย่างใดอย่างหนึ่ง: ให้ alignment gate เฉพาะ *การติดสถานะ* แล้วดาเมจธาตุผ่านเต็ม หรือให้ DoT นับเป็นดาเมจหลักที่ mob HP ถูกตั้งจากมัน
- ข้อนี้ยังไม่แก้ในไฟล์นี้ เพราะต้องตั้ง curve ของ HP มอนก่อน (HP คือตัวที่กำหนดว่า DoT มีค่าเท่าไร) — ดู combat.md ที่จะเปิดถัดไป

# 3. คู่ต้านธาตุ

| โจมตี ↓ / เป้าหมาย → | Fire | Cold | Lightning | Poison | Chaos |
|---|---|---|---|---|---|
| Fire | 1.00 | 0.60 | 1.10 | 1.20 | 1.00 |
| Cold | 0.60 | 1.00 | 1.10 | 1.00 | 1.00 |
| Lightning | 1.10 | 1.10 | 1.00 | 0.60 | 1.00 |
| Poison | 1.20 | 1.00 | 0.60 | 1.00 | 1.00 |
| Chaos | 1.15 | 1.15 | 1.15 | 1.15 | 1.15 |

- **Chaos** ได้ 1.15 กับทุกธาตุ รวมถึงตัวเอง เป็นธาตุเดียวที่ไม่มีคู่ต้าน
- **Fire ↔ Cold** และ **Lightning ↔ Poison** เป็นคู่ต้านกันที่ 0.60
- ไอคอนสถานะบอกธาตุของ damage instance ได้ ไม่ต้องระบุชื่อ

**มอนสเตอร์** — แต่ละตัวมี innate element 1 ธาตุ

```
weak_mult = 1.5   ถ้าธาตุของเราตรงกับ innate ของมอนสเตอร์
```

# 4. Elemental resistance

```
res_c       = vit * K_VIT_RES                     K_VIT_RES = 0.05
elem_res_x  = res_c * (1 + elem_res_pct_x/100)
elem_res_x  = min(elem_res_x, 75)

incoming = base * (1 - elem_res_x/100) * คู่ต้านธาตุ
```

- ใช้ **Vit** ให้ res ครบ 5 ธาตุ เป็นค่าดิบทั้งหมด
- **res ไม่มี flat** — affix ที่ใส่ได้มีแค่ `Elemental resistance %` ที่ทำหน้าที่เป็นตัวคูณ
- ยุบ `status_res` เดิม (เคยให้ Str) ทิ้ง เหลือแค่ elemental res แล้ว
- res แยกตามธาตุ ไม่ใช่ค่าเดียว หน้าตัวละครต้องแสดงครบ 5 ค่า
- **Vit 816 (เพดานจริง) ได้ 40.8% ดิบ** ไม่ใช่ 44.5% ที่เขียนไว้เดิม · ตัวเลขเดิมคำนวณจาก stat 890 ซึ่งไม่มี build ไหนแตะได้จริง
  ถึง cap 75 ต้อง `40.8 × (1 + 30+30+30)% = 77.5 → ตัดที่ 75` คือลงช่อง res ครบ 3 ชิ้น · สองชิ้นได้ 65.3% · cap 75 จึงยังแตะได้และยังเหมาะ

# 5. สถานะของแต่ละธาตุ

**ทุกสถานะในหัวข้อนี้อยู่ได้สองทาง** — เราทิ้งใส่เป้าหมาย และมอนทิ้งใส่เรา และมอนทิ้งใส่เรา · ค่าเมื่ออยู่บนผู้เล่น (โอกาสติด 20% ต่อการตี · chill/shock ถูก halve) อยู่ใน combat.md หัวข้อ 5

## Fire — burn

```
burn_dps  = elem_aligned_damage * K_FIRE_BURN     K_FIRE_BURN = 0.30
burn_time = 4 วิ
burn_stack_max = 3
```

- tick ต่อวินาที ไม่ crit และไม่ถูก dodge
- ยิงด้วยอาวุธธาตุเดิมซ้ำจะรีเซ็ตเวลา ไม่ต่อเวลาเดิม
- สูงสุด 3 ชั้น ชั้นที่เกินให้รีเซ็ตชั้นเก่าแทนที่จะทิ้ง
- ค่า 0.30 ทำให้ 3 ชั้นเต็มได้ 0.90 ของดาเมจธาตุต่อวินาที

## Cold — chill

```
aspd_mult = 1 - chill_pct/100      chill_pct cap 20
acc_mult  = 1 - chill_acc/100      chill_acc cap 30
chill_time = 3 วิ
```

- ลดความเร็วโจมตี = ตีถี่น้อยลง ไม่ใช่ดาเมจลด ต้องกันไม่ให้เป้าหมายตีแทบไม่โดน
- cap ไว้ต่ำเพราะเป้าหมายที่ถูกลด aspd จะหยุดสร้างดาเมจเอง
- ลด accuracy เพิ่มอีกชั้น เพราะผู้เล่นสาย accuracy จะได้เปรียบเป็นพิเศษชั่วคราว

## Lightning — shock

```
stun_chance = elem_align * K_LIGHTNING_STUN     K_LIGHTNING_STUN = 0.30   cap 15
stun_time   = 1 วิ
```

- stun เข้าคิวการโจมตีของเป้าหมาย ระหว่างนั้นหยุดโจมตีและหยุด regen
- สุ่ม 1 ครั้งต่อการโจมตี 1 ครั้ง ไม่สุ่มทุก damage instance
- **K เดิม 0.15 ทำให้ cap 15 แตะไม่ได้เลย** — alignment เพดานคือ 50 → stun สูงสุดแค่ 7.5% · ตั้ง K เป็น 0.30 เพื่อให้ stun 15% เกิดได้เฉพาะตอน alignment ชน cap (Dex 816 + amulet + gloves)
- ค่าที่ build ธาตุจะเจอจริง: Dex 328 + amulet + gloves → alignment 26.4% → stun 7.9% ต่อการโจมตี
- เป็นธาตุที่ควบคุมเวลา ไม่ใช่ดาเมจต่อเนื่อง จึงเหมาะกับ idle ที่ยิงเรื่อย ๆ

## Poison — poison stack

```
poison_dps_per_stack = elem_aligned_damage * K_POISON    K_POISON = 0.08
poison_stack_max = 10
poison_decay = ลด 1 ชั้น ทุก 8 วิ
```

- ไม่หายทันทีที่หยุดยิง แลกกับดาเมจต่อชิ้นที่ต่ำกว่า fire
- DoT ไม่โดน dodge ไม่ crit ป้องกันเป้าหมายโกหกยิงพลาดแล้วเสียเปรียบ
- สะสมข้ามการเปลี่ยนอาวุธ เพราะอยู่บนเป้าหมายไม่ใช่บนชิ้น
- ค่า 0.08 ทำให้เต็ม 10 ชั้นได้ 0.80 ของดาเมจธาตุต่อวินาที ต่ำกว่า burn เล็กน้อย

## Chaos — mark

```
chaos_stack_max = 25
dmg_mult = 1 + chaos_stack * K_CHAOS_DMG          K_CHAOS_DMG   = 0.01
leech    = chaos_stack * K_CHAOS_LEECH            K_CHAOS_LEECH = 0.002
mark_decay = ลด 1 ชั้น ต่อวินาที หลังหยุดยิงครบ 5 วิ
```

- ยิงต่อเนื่องยาวได้ดาเมจสูงสุด แลกกับการสลับเป้าหมายแล้วเริ่มนับใหม่
- ค่า 0.01 ทำให้เต็ม 25 ชั้นได้ +25% ดาเมจ ไม่มากเกินจนกลืน crit
- leech เป็น % ของดาเมจที่เพิ่งตี ค่า 0.002 ให้เต็ม 25 ชั้นได้ 5% แต่ห้ามเกิน HP สูงสุดต่อวินาทีที่กำหนด
- ใน idle ที่ยิงเป้าหมายเดิมต่อเนื่อง mark จะขึ้นเต็ม 25 ชั้นเอง

# 6. Global DoT cap

```
dot_total = burn + poison
dot_total = min(dot_total, elem_aligned_damage * 1.5)
```

- ทุก DoT รวมกันแล้วห้ามเกิน **1.5 เท่า** ของดาเมจธาตุที่ยืนยันสำเร็จต่อวินาที
- ไม่มี cap นี้ DoT สองธาตุจะซ้อนกันได้ 1.7 เท่า ซึ่งมากกว่าการตีตรง ๆ ในช่วงที่ burn ติด
- cap นี้คือจุดเดียวที่ DoT ทุกธาตุชน ตัวอื่นต่างหายไปทีละอย่าง

# 7. Affix ของธาตุ

| Affix | กลุ่ม | ช่วงค่า |
|---|---|---|
| Elemental power flat | Offensive — main hand (ลดน้ำหนักครึ่งในดาบคู่) | 12-64 |
| Elemental power % | Offensive — main hand | 3-14% |
| Elemental resistance % | Defensive — ชิ้นอื่น | 15-30% |
| Elemental alignment % | Defensive — ชิ้นอื่น | 1-5% |

- แบ่งตามกติกา offensive/defensive ใน equipment-slot.md — main hand ออกพลังธาตุ ชิ้นอื่นออดความต้าน
- **Elemental resistance % เป็น defensive เสมอ ทุกธาตุ** ไม่มีทางเป็น offensive แม้ใส่ธาตุเดียวกับอาวุธ
- res ไม่มี flat มีแค่ % ส่วน power มีทั้ง flat และ %
- **ชิ้นป้องกันสุ่มธาตุของตัวเอง ไม่ผูกกับอาวุธ** — เพราะถ้าผูกกับอาวุธ ผู้เล่นจะต้องเลือกอาวุธก่อนแล้วค่อยหาชิ้นป้องกันให้ตรง ซึ่งทำให้ชิ้นส่วนใหญ่ใช้ไม่ได้
- **off hand ดาบคู่เป็นอาวุธชิ้นที่สอง** จึงเป็นข้อยกเว้นของกติกา ได้ elemental power แต่น้ำหนัก Primary ลดครึ่ง
- ช่วง elemental power ต่ำกว่า phys/magic เล็กน้อย (12-64 แทน 15-80) เพราะต้องผ่าน alignment อีกชั้นก่อน
- ตาราง tier แยกของธาตุอยู่ใน attribute-item.md

# 8. การแสดงผล

- หน้าตัวละครแสดง elemental power และ elemental res ครบ 5 ธาตุ
- สถานะที่ค้างบนเป้าหมายแสดงเป็นไอคอนธาตุ + เวลาที่เหลือ ไม่ต้องเขียนชื่อเต็ม
- ค่าที่มี cap แสดงเป็น `ค่า / cap` เหมือน stat อื่นใน character-sheet.md
- ตัวคูณคู่ต้านธาตุซ่อนจากผู้เล่น ไม่ต้องแสดง ให้เห็นแค่ว่าตีธาตุนี้แล้วตัวเลขเปลี่ยน
- แถบ DoT รวมแสดงตอนชน global DoT cap เพื่อให้เห็นว่าตีธาตุอะไรเกินแล้ว

# สรุป K ของระบบธาตุ

| K | ค่า | หมายเหตุ |
|---|---|---|
| K_ELEM | 4 | elem / Int · ต่ำกว่า K_INT เพราะต้องผ่าน alignment |
| K_VIT_RES | 0.05 | elem res / Vit · ไม่มี flat |
| K_FIRE_BURN | 0.30 | burn ต่อชั้น |
| K_POISON | 0.08 | poison ต่อชั้น |
| K_CHAOS_DMG | 0.01 | +dmg ต่อ mark ชั้น |
| K_CHAOS_LEECH | 0.002 | lifesteal ต่อ mark ชั้น |
| K_LIGHTNING_STUN | 0.15 | stun chance ต่อ alignment |
| global DoT cap | 1.5 | รวม burn + poison |