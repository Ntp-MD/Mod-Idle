# Item Base

import glossary.md
import equipment-slot.md
import attribute-item.md
import item-rarity.md
import formula.md

**base = โครงของไอเทมใน slot หนึ่ง** · slot เดียวกันมีได้ 2-3 โครง · เป็นช่องที่เอกสารทุกไฟล์เคยเขียนว่า "ยังไม่ได้ออกแบบ"

base ทำสองอย่าง และ **ตั้งใจไม่ให้ทำอย่างอื่นเลย**

| base กำหนด | base ไม่กำหนด |
|---|---|
| **น้ำหนัก** (ช่องที่น้ำหนักต่างกันทำให้พิกัด Str มีผลจริง) | จำนวนช่อง affix → เป็นของ Rarity (glossary กติกาข้อ 2) |
| **affix ไหนเป็น Primary / Secondary** ของชิ้นนั้น | ค่าที่สุ่มในแต่ละช่อง → เป็นของคุณภาพ + tier |
| | ธาตุประจำชิ้น → เป็นของ affix pool เท่านั้น |

> เหตุผลที่ห้าม base แตะจำนวนช่อง: ถ้าทั้ง rarity และ base กำหนดจำนวนช่องได้ แกนสองแกนจะกลายเป็นเรื่องเดียวกัน และผู้เล่นจะแยกไม่ออกว่าของชิ้นนี้ "หายาก" หรือ "เป็นโครงหนัก"

# ตาราง base ต่อ slot

## helmet

| base | น้ำหนัก | Primary | Secondary |
|---|---|---|---|
| coif | 30 | Dodge % · Max HP flat | Elemental resistance % |
| barbute | 45 | Max HP flat · Max HP % | Elemental resistance % |
| circlet | 18 | Max Mana % · Cooldown reduction % | Elemental alignment % |

## chest

| base | น้ำหนัก | Primary | Secondary |
|---|---|---|---|
| mail | 60 | Dodge % · Max HP % | Elemental resistance % · Max HP flat |
| plate | 85 | Max HP flat · Max HP % | Elemental resistance % |
| vestments | 28 | Max Mana % · Max Mana flat | Cooldown reduction % |

## pant

| base | น้ำหนัก | Primary | Secondary |
|---|---|---|---|
| greaves | 50 | Dodge flat · Dodge % | Max HP flat |
| cuisses | 70 | Max HP flat · Max HP % | Elemental resistance % |
| wrap | 25 | Cooldown reduction % · Max Mana flat | Elemental alignment % |

## boots

| base | น้ำหนัก | Primary | Secondary |
|---|---|---|---|
| striders | 35 | Dodge flat · Dodge % | Cooldown reduction % |
| sabatons | 55 | Max HP flat · Max HP % | Elemental resistance % |
| soft boots | 30 | Max Mana flat · Cooldown reduction % | Dodge % |

## belt

| base | น้ำหนัก | Primary | Secondary |
|---|---|---|---|
| girdle | 40 | Max HP flat · Max HP % | Elemental resistance % |
| sash | 20 | Max Mana % · Cooldown reduction % | Elemental alignment % |
| clasp | 28 | Elemental resistance % · Max HP flat | Dodge flat |

## gloves

| base | น้ำหนัก | Primary | Secondary |
|---|---|---|---|
| gauntlets | 45 | Max HP % · Dodge flat | Elemental alignment % |
| wraps | 20 | Elemental alignment % · Cooldown reduction % | Max Mana flat |
| gloves | 25 | Dodge % · Dodge flat | Max HP % |

## ring (แต่ละวงเลือกอิสระ)

| base | น้ำหนัก | Primary | Secondary |
|---|---|---|---|
| band | 10 | Elemental resistance % · Cooldown reduction % | Max HP % |
| signet | 14 | Max Mana % · Cooldown reduction % | Max HP % |

## amulet

| base | น้ำหนัก | Primary | Secondary |
|---|---|---|---|
| pendant | 12 | Elemental alignment % · Elemental resistance % | Cooldown reduction % |
| talisman | 20 | Elemental resistance % · Max Mana flat | Elemental alignment % |

## cape

| base | น้ำหนัก | Primary | Secondary |
|---|---|---|---|
| cloak | 20 | Dodge % · Elemental resistance % | Cooldown reduction % |
| mantle | 32 | Max HP flat · Elemental resistance % | Max Mana flat |

## off hand

| base | น้ำหนัก | Primary | Secondary |
|---|---|---|---|
| buckler | 25 | Dodge % · Cooldown reduction % | Max HP flat |
| kite shield | 55 | Max HP flat · Max HP % | Dodge % |
| tome | 30 | Max Mana % · Cooldown reduction % | Max Mana flat · Elemental alignment % |

- อาวุธ main hand ไม่มี base แยก · **ชนิดอาวุธคือ base ของมันแล้ว** (12 ชนิดใน equipment-weapon.md มีน้ำหนัก + weapon_aspd + pool ของตัวเอง)
- ดาบคู่ (off hand เป็นอาวุธ) ใช้น้ำหนักของชนิดอาวุธนั้น × 0.8

# สามทางที่ base สร้างให้จริง (วัดแล้ว)

| ทางที่เลือก | armor รวม | ทั้งเซ็ต + อาวุธ (คุณภาพกลาง) | ทั้งเซ็ต (คุณภาพสูง) | ภาษี aspd ถ้าไม่ลง Str |
|---|---|---|---|---|
| cloth/glass (circlet · vestments · wrap · soft · sash · wraps · band · pendant · cloak + dagger + buckler) | 193 | 248 | 322 | **0%** |
| balanced (coif · mail · greaves · striders · clasp · gloves · band · pendant · cloak + sword + tome) | 300 | 390 | 507 | **−21%** |
| armored (barbute · plate · cuisses · sabatons · girdle · gauntlets · signet · talisman · mantle + 2h axe) | 420 | 505 | 657 | **−50% (ชนเพดานภาษี)** · ลง Str 2 ชิ้นเหลือ −26% · Str 6 ชิ้นพ้น |

- นี่คือสิ่งที่ทำให้ **Str มีงานที่สองจริง** โดยไม่ล็อกอะไร: เกราะหนักไม่ใช่ข้อห้าม มันคือใบเสร็จ
- และกลับกันก็เป็นจริงด้วย: build แก้วที่ใส่ cloth ไม่ต้องเสียช่องให้ Str เลย → ช่องว่าง fast-hit / burst ที่ combat.md กับ loot.md ชี้ไว้ **เบาลงกว่าที่กลัว** เพราะ build ที่ไม่ลง Str ไม่ได้โดนภาษีอัตโนมัติอีกต่อไป ถ้าเขาเลือกใส่ของเบา
- ภาษี -50% ที่ชนเพดานแปลว่า armored build ที่ไม่ลง Str ไม่ได้ตาย แค่ช้าลง — ซึ่งยังtank ได้ดี นั่นคือสิ่งที่ build นั้นเลือกแล้ว

# การสุ่ม base

- **base สุ่มเท่ากันทุกแบบใน slot นั้น** (helmet 1/3 · chest 1/3 · ring 1/2 · weapon ตามชนิดที่ดรอป)
- ผลที่ต้องรู้ตัว: โอกาสได้ *โครงที่ถูก* คือ 1/#base ของ slot นั้น · เมื่อคูณกับ Rarity (18% Rare) และ tier (T1 17%) ของที่จะ "ตรงสเปก" จริง ๆ คือของ 1 ใน ~30-60 ชิ้น → สิ่งนี้คืองานของ **Reroll/Refine/Ascend ไม่ใช่ของ luck** (loot.md)
- ถ้าอนาคตอยากให้ base ไม่สุ่มเท่ากัน (เช่น plate เกิดในโซนทหารมากกว่า) ต้องเพิ่มคอลัมน์ในตาราง zone ของ world.md และคำนวณ drops/ชม. ใหม่ใน loot.md

# สิ่งที่ไฟล์นี้ปลดล็อกให้ระบบอื่น

| ไฟล์ | ช่องที่ปิดไป |
|---|---|
| attribute-item.md | ตารางน้ำหนักต่อ slot เดียว → กลายเป็นน้ำหนักต่อ *base* |
| formula.md หัวข้อ 11 | ตัวเลข penalty ใหม่ตามสามทางข้างบน (cloth 0% · balanced −21% · armored −50%) |
| equipment-slot.md | Primary/Secondary ต่อ slot → ย้ายมาอยู่ที่นี่ตาม base · หมายเหตุข้อ 2 (dodge flat มีแค่ 2 ช่อง) และข้อ 3 (alignment มีแค่ 2 ช่อง) **เป็นจริงน้อยลงแล้ว** |
| item-rarity.md | เงื่อนไขของ rarity ระดับที่สาม (Unique) ที่เคยเขียนว่า "ต้องผูกกับคราฟ" → ตอนนี้ hooks ไว้ที่ **base พิเศษที่คราฟขึ้น** (ยังไม่สร้าง) |
| crafting.md | คำถาม "ฐานของไอเทม (base)" ในช่องที่ยังไม่ลง → มีคำตอบแล้ว · แต่เพดานจำนวนครั้งที่คราฟต่อชิ้น **ยังไม่มี** และควรผูกกับ base (plate คราฟได้กี่ครั้ง vs cloth) |
| loot.md หัวข้อ 1 | ลำดับการสุ่มเพิ่มขั้น "เลือก base" ก่อน Primary/Secondary |
