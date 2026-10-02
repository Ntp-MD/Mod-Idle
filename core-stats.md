# Core Stats

Str - physical power , Weight
Vit - hp , hp regen , elemental resistance ทั้ง 5 ธาตุ
Dex - accuracy , elemental alignment
Agi - attack speed , dodge
Wis - cooldown reduction
Int - magic power , mana regen , elemental power
Lck - critical chance , drop chance , perfect dodge

# Combat Stats

Attack speed - % · `ครั้ง/วิ = aspd / 100` · cap 300 (= 3 ครั้ง/วิ)
Dodge - % cap 60 (cap นี้คือ *โอกาสหลบ* ไม่ใช่ค่า rate · เดิมเขียน 75 ซึ่ง dodge flat สองชิ้นชนได้โดยไม่ต้องมี Agi)
Perfect dodge - % cap 5 (Lck 500 ขึ้นไปชน) · นิยาม: หลบสิ่งที่ dodge ปกติกันไม่ได้ (DoT tick · ผลที่ไม่มีเงื่อนไขหลบ) — ลำดับจริงอยู่ใน combat.md หัวข้อ 2
Critical chance - % cap 100 (เพดานจาก stat ล้วน = 48.8% ที่ Lck 816 · ส่วนที่เหลือต้องมาจาก skill/buff)
Critical damage - % แยก physical / magic ไม่มี cap
Cooldown reduction - % cap 50 (ต้อง Wis 816 + ช่อง CDR 4 ชิ้น)
Accuracy - ตัวเลข ไม่มี cap · สูตร `acc / (acc + evasion)` ห้าม 100% อยู่แล้ว เดิมเขียน cap 2,000 ซึ่งไม่มีวันชน
Elemental alignment - % cap 50 (แตะได้ที่ Dex 816 + amulet + gloves · เดิม 60 แตะไม่ได้)
Elemental resistance - % แยก 5 ธาตุ cap 75 ต่อธาตุ (แตะได้ที่ Vit 816 + ช่อง res 3 ชิ้น)
Weight - หน่วย · capacity = Str × 2 (1,632 ที่ Str 816) · ถือเกินได้ ไม่ล็อกช่องใส่ แต่ตัด attack speed ตามส่วนที่เกิน สูงสุด -50% (formula.md หัวข้อ 11)

**cap ทุกตัวต้องเช็คได้ว่าแตะได้จริงจากตาราง affix ปัจจุบัน** · ตัวเลขอ้างอิงและวิธีคำนวณอยู่ที่ formula.md หัวข้อ 0 และตาราง Cap

# ไม่มีแล้ว

Status resistance — ยุบรวมเป็น elemental resistance ของ Vit
Status alignment — เปลี่ยนชื่อเป็น elemental alignment ใช้ตัวเดียวกัน