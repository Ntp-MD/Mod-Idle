# Equipment Slots

## Slot List

- helmet
- chest
- pant
- boots
- belt
- gloves
- ring * 2
- amulet
- cape
- main hand
- off hand

# Affix Pool by Slot

เกณฑ์ที่ใช้จัด pool

- **Primary** — ออกได้บ่อย (น้ำหนักปกติ)
- **Secondary** — ออกได้น้อยกว่า (น้ำหนักต่ำ)
- **Blocked** — ไม่ออกจากชิ้นนี้เด็ดขาด
- **Core stat** — ทุก slot รับได้เสมอ ทั้ง flat และ % (ดูหัวข้อถัดไป)
- ทุก slot สุ่ม Tier 1–4 ตาม rarity ของไอเทม

## Core stat (ทุกชิ้น)

**Core stat flat และ Core stat % เป็นค่าที่ทุกชิ้นสุ่มได้ ไม่มีข้อยกเว้น ไม่มี slot ไหน block**

| | |
|---|---|
| Core stat flat | สุ่มได้ทุกชิ้น · เลือกตัวจาก str / vit / dex / agi / wis / int / lck · ค่า 5-25 ตาม tier |
| Core stat % | สุ่มได้ทุกชิ้น · เลือกตัวจาก str / vit / dex / agi / wis / int / lck · ค่า 1-5% ตาม tier |

**กติกาเพิ่ม**

- 1 ชิ้นสุ่มได้ core stat สูงสุด 2 ช่อง (flat 1 + % 1) ถ้าได้ทั้งคู่ต้องเป็น **คนละตัวกัน** เช่น str flat + agi %
- น้ำหนัก: Primary 1.0 · Secondary 0.5 · Core stat 1.0 (เท่ากับ Primary ทุกชิ้น)
- ถ้าชิ้นไหนมี core stat ตัวนั้นอยู่ใน Primary/Secondary อยู่แล้ว เช่น chest มี Vit % ให้ถือว่าเป็นช่อง core stat นั้นไปเลย ห้ามสุ่มซ้ำตัวเดียวกันสองช่อง
- flat/% ของตัวเดียวกันอนุญาตให้อยู่คนละชิ้นกันได้ แต่ไม่อนุญาตให้อยู่คนละช่องบนชิ้นเดียวกัน

## helmet

| Role | Affix |
|---|---|
| Primary | Physical power flat/% · Magic power flat/% |
| Secondary | Critical chance % · Dodge % · Vit % |
| Core stat | Core stat flat · Core stat % (ทุกชิ้น) |
| Blocked | Critical damage |

> จุดกึนสีสายตา มักเป็นที่แรกของ power % ในชุด

## chest

| Role | Affix |
|---|---|
| Primary | Vit % · Vit flat |
| Secondary | Physical power % · Magic power % · Physical power flat · Magic power flat |
| Core stat | Core stat flat · Core stat % (ทุกชิ้น) |
| Blocked | Critical chance % · Dodge % |

> ตัวกำหนด survivability ถ้าเป็นเกราะควรบังคับเป็น Vit เสมอ

## pant

| Role | Affix |
|---|---|
| Primary | Vit % · Vit flat |
| Secondary | Physical power % · Magic power % · Dodge % |
| Core stat | Core stat flat · Core stat % (ทุกชิ้น) |
| Blocked | Critical chance % · Critical damage |

## boots

| Role | Affix |
|---|---|
| Primary | Agi % · Agi flat · Dodge % · Dodge flat |
| Secondary | Vit % · Physical power % |
| Core stat | Core stat flat · Core stat % (ทุกชิ้น) |
| Blocked | Critical damage |

> dodge เยอะสุดที่นี่ ถ้าไม่มี CDR affix ก็ยังได้ dodge เป็นทางเลือกแทน

## belt

| Role | Affix |
|---|---|
| Primary | Vit flat · Str % |
| Secondary | Physical power flat/% · Magic power % |
| Core stat | Core stat flat · Core stat % (ทุกชิ้น) |
| Blocked | Critical chance % · Critical damage |

> ทำหน้าที่เป็นแถบคอสัมภูณิย์

## gloves

| Role | Affix |
|---|---|
| Primary | Agi % · Physical power % · Magic power % |
| Secondary | Critical chance % · Physical power flat · Magic power flat · Str % |
| Core stat | Core stat flat · Core stat % (ทุกชิ้น) |
| Blocked | — |

> รองเท้าจับของ + ความเร็วโจมตี

## ring * 2

| Role | Affix |
|---|---|
| Primary | Critical chance % · Critical damage % |
| Secondary | Int % · Wis % · Str % · Magic power % · Physical power % |
| Core stat | Core stat flat · Core stat % (ทุกชิ้น) |
| Blocked | — |

> แหวนคือที่ทำ crit meta ได้เร็วที่สุด 2 ชิ้นเท่ากับโบนัสเป็น 2 เท่า

## amulet

| Role | Affix |
|---|---|
| Primary | Magic power % · Magic power flat · Int % |
| Secondary | Wis % · Critical damage % · Physical power % |
| Core stat | Core stat flat · Core stat % (ทุกชิ้น) |
| Blocked | — |

> คอสัมภูณิย์ = magic scaling ตัวหลัก

## cape

| Role | Affix |
|---|---|
| Primary | Dodge % · Dodge flat · Vit % |
| Secondary | Magic power % · Physical power % · Wis % |
| Core stat | Core stat flat · Core stat % (ทุกชิ้น) |
| Blocked | — |

## main hand

| Role | Affix |
|---|---|
| Primary | Physical power flat · Critical chance % · Critical damage % |
| Secondary | Str % · Str flat · Physical power % · Agi % |
| Core stat | Core stat flat · Core stat % (ทุกชิ้น) |
| Blocked | — |

**ตามชนิดอาวุธ (ดู equpment-weapon.md)**

| Weapon | เปลี่ยนเป็น |
|---|---|
| sword / axe / dagger / spear / bow / crossbow | Physical power flat เป็น primary หลัก |
| rod / wand / staff | Magic power flat · Magic power % แทน Physical |
| shield / book (off hand มีดาบคู่) | ใช้ pool ตามมือหลัก |

## off hand

| Role | Affix |
|---|---|
| Shield | Vit % · Vit flat · Physical power % · Dodge % |
| Book | Int % · Wis % · Magic power % · Magic power flat |
| Dual-wield weapon | ใช้ pool เดียวกับ main hand แต่ลดน้ำหนัก Primary ลงครึ่งหนึ่ง |
| Core stat | Core stat flat · Core stat % (ทุกชิ้น) |

# Slot Coverage Check

ควรกระจายแบบนี้เพื่อไม่ให้ meta เอียงที่เดียว

| Build ที่ต้องมีทางออก | สล็อตหลักที่ควรตอบสนอง |
|---|---|
| Str / physical | gloves · main hand · helmet · belt |
| Int / magic | amulet · off hand (book) · cape · main hand (rod/wand) |
| Vit / tank | chest · pant · boots · off hand (shield) |
| Agi / dodge | boots · gloves · helmet |
| Crit | ring ×2 · main hand · gloves · helmet (chance เท่านั้น) |
| Wis / CDR | **ยังไม่มีสล็อตรับ** — ดูหมายเหตุด้านล่าง |

# หมายเหตุ / ช่องที่ยังขาด

1. **CDR ไม่มี affix** — Wis ให้ cooldown reduction แต่ไม่มีชิ้นไหนออก CDR ได้ ควรเพิ่ม `Cooldown reduction %` เป็น secondary ใน amulet / cape / off hand (book) / ring
2. **Attack speed ไม่มี affix** — Agi ให้ attack speed แต่ไม่มีชิ้นไหนออก attack speed ได้ ควรเพิ่ม `Attack speed %` เป็น primary ใน gloves และ secondary ใน main hand
3. **Critical damage ผูกกับ base Physical power** — magic build จะไม่มี crit scaling ถ้าจะให้วงแหวน/อาวุธเมฆใช้ได้ ควรแยกเป็น `Critical damage % (physical)` และ `Critical damage % (magic)`
4. **Flat power ไม่มีตัวคูณ** — ตอนนี้ Physical power flat 15–80 ไม่ถูกอะไรคูณ ควรทำเป็น `% of base power` หรือบวกเข้าหลังคำนวณ Str