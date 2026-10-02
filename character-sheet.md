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
| Weight | ของที่ถือ / ขนาดสูงสุด · ถ้าเกินแสดง `% aspd ที่เสีย` ต่อท้าย เช่น `566 / 420 (aspd −35%)` |

# Core Stats

แสดง 7 ตัว พร้อมแจกแจงว่ามาจากอะไร

| Stat | ให้อะไร | แสดงค่าคำนวณร่วมด้วยไหม |
|---|---|---|
| Str | Physical power, Weight | Physical power, Weight capacity |
| Vit | HP, HP regen, Elemental resistance ทั้ง 5 ธาตุ | Max HP, HP regen, Elemental res ครบ 5 ธาตุ |
| Dex | Accuracy, elemental alignment | Accuracy, Elemental alignment % |
| Agi | Attack speed, Dodge | Attack speed, Dodge % |
| Wis | Cooldown reduction | CDR % |
| Int | Magic power, Mana regen, Elemental power | Magic power, Mana regen, Elemental power |
| Lck | Critical chance, Drop chance, Perfect dodge | ทั้ง 3 ค่า |

**แสดงแบบแยก 3 ส่วน** เพื่อให้ผู้เล่นเห็นว่าตัวเลขไหนมาจากอะไร

```
Str              125        ( base 12 + level 60 + gear 45 ) × 1.07
Physical power   715        ( 125 × 5 + 37 ) × 1.08
```

- ตัวอย่างนี้คำนวณจริงที่เลเวล 31: `stat_c = 12 + 2×30 = 72` · Str flat 15 สามชิ้น = 45 · Str % 3% + 4% = 7% → `(72 + 45) × 1.07 = 125`
- Physical power = `(125 × 5 + 37 ช่อง power flat จาก main hand) × 1.08 (power % ช่องเดียว) = 715`
- แสดงเป็น `( base + level + gear flat ) × %` ตามลำดับที่สูตรคำนวณจริง
  ตัวเลขเดิม `(base 40 · level +60 · gear +20)` ใช้ไม่ได้เพราะไม่มีเลข 40 ในสูตรเลย — base คือ 12 ที่เลเวล 1 เสมอ และ 125 × 5 = 625 ไม่ใช่ 1,450

# Combat Stats

| ค่า | หน่วย | หมายเหตุ |
|---|---|---|
| Physical power | ตัวเลข | |
| Magic power | ตัวเลข | |
| Elemental power | ตัวเลข | ต้องผ่าน alignment ก่อนถึงจะออกดาเมจ |
| Critical chance | % | แสดง cap 100 ด้วย (เพดานจาก stat ล้วน 48.8%) |
| Critical damage | % | แสดงแยก physical / magic |
| Dodge | % | แสดง cap **60** ด้วย (เดิมเขียน 75 · เป็น cap ของ rate ไม่ใช่โอกาส) |
| Attack speed | ครั้ง/วิ | แสดง cap 300% = 3 ครั้ง/วิ ด้วย |
| Cooldown reduction | % | แสดง cap 50 ด้วย |
| Accuracy | ตัวเลข | **ไม่ต้องแสดง cap** — ลบ cap 2,000 ทิ้งแล้ว สูตรสัดส่วนห้าม 100% อยู่เอง |
| Elemental alignment | % | แสดง cap **50** ด้วย · ใช้ร่วมกับสถานะทุกชนิด (ไม่มี status alignment อีกแล้ว) |
| Perfect dodge | % | แสดง cap 5 ด้วย |
| Drop chance | ตัวคูณ | แสดงเป็น `×9.2` ไม่ใช่ % — `drop_rate` เป็นตัวคูณของ base drop chance |
| HP regen | /วิ | |
| Mana regen | /วิ | |

**ทุกค่าที่มี cap แสดงเป็น `ค่า / cap`** เช่น `Crit chance 42% / 100%` เพื่อไม่ให้ผู้เล่นเพิ่มอีกแล้วไม่เห็นผล

# Elemental

แสดง res ครบ 5 ธาตุเสมอ ไม่ว่าจะยุ่งธาตุไหน เพราะผู้เล่นต้องเห็นว่าตัวเองเปิดช่องว่างตรงไหน

```
Elemental res
  Fire       45% / 75%
  Cold       32% / 75%
  Lightning  18% / 75%
  Poison     45% / 75%
  Chaos       0% / 75%
Elemental alignment    44% / 50%
```

- ค่า 0 ก็แสดง ไม่ซ่อน
- เรียงตามลำดับธาตุคงที่เสมอ ไม่สลับตามที่ผู้เล่นจัด เพื่อให้เทียบกับของเก่าได้
- ตัวคูณคู่ต้านธาตุของเป้าหมายไม่ต้องแสดง

# Offense / Defense แยกกัน

ตัวอย่างด้านล่างเป็น **ตัวละครเลเวล 31 ใส่ของ Rare คุณภาพกลาง** ทั้งหมด คำนวณจาก formula.md แล้ว (ไม่ใช่ตัวเลขสมมติ)

## Offense

```
Attack speed      1.5 /วิ      (aspd 154 = 1.2 × (100 + (125−12)×0.25))
Physical power    715          ( (125 × 5 + 37) × 1.08 )
Magic power       0            (ยังไม่ได้ลง Int — แสดง 0 ไว้ ไม่ซ่อน)
Critical chance   10% / 100%   (Lck 125 × 0.05 + affix 4)
Critical damage   152% / 100%  (physical / magic)
```

## Defense

```
Max HP            3,910        HP regen   31/วิ
Max Mana          816          Mana regen 13/วิ
Dodge             24% / 60%    (rate 125×0.15 + 12 = 31 → 31/131)
Accuracy          135
Elem alignment    8% / 50%
Perfect dodge     1% / 5%
```

- ตรวจย้อนทีละเลข: `stat_c(31) = 12 + 2×30 = 72` · Vit 125 → `HP = (125×20 + 40×30) × 1.06 = 3,914` · Int 84 → `mana = 84×4 + 16×30 = 816` · regen `= 84×0.15 = 12.6`
- ตัวเลขเดิมในไฟล์นี้ (`2.4 /วิ · power 1,450 · HP 4,200 · Dodge 28% / 75% · Accuracy 340 / 2,000`) ผูกกับสูตรและ cap ชุดเก่าที่แก้ไปแล้วใน formula.md จึงเขียนใหม่ทั้งคู่

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
| base power ของอาวุธ | ไม่มีค่านี้แล้ว — ทุกอาวุธดึง power จากตัวละคร (equipment-weapon.md) |
| Mana regen / HP regen ถ้ายังไม่มีสถานะ regen | แสดงแล้วผู้เล่นสงสัยว่ามีผลไหม |

# ช่องที่เคยขาดแต่ตอนนี้มีสูตรแล้ว

ทั้ง 4 ข้อเดิมได้ค่าแล้วใน formula.md

1. **Status resistance** — ยุบรวมเป็น elemental res ของ Vit แล้ว ไม่มี status res แยกอีก
2. **Weight capacity** — `K_STR_WEIGHT` = 2 ต่อ Str 1 แต้ม
3. **Drop chance / Perfect dodge** — Drop เป็นตัวคูณ `1 + Lck × 0.01` (9.2 เท่าที่ Lck 816) · Perfect dodge = `Lck × 0.01` และ cap 5% (K เดิม 0.005 ทำให้ชน cap ไม่ได้)
4. **Base stat ต่อ level** — base 12 ที่เลเวล 1 และ +2 ต่อเลเวล ทำให้แสดง `(base · level · gear)` ได้

# ยังขาด

1. ~~**ที่มาของน้ำหนักของไอเทม**~~ **ปิดแล้ว** — ตารางต่อ slot + ชนิดอาวุธใน attribute-item.md · ตัวคูณคุณภาพ 0.8/1.0/1.3 · พิกัด = Str × 2 และเกินแล้วตัด aspd (formula.md หัวข้อ 11)
2. ~~**ดาเมจที่ผู้เล่นได้รับ**~~ **ปิดแล้ว** — combat.md หัวข้อ 3 ตั้ง `mob ดาเมจ/วิ = DPS_typical ÷ 27` และหัวข้อ 6 มีตาราง "รอด/ไม่รอด" ต่อ build · แผง Defense จึงมีเส้นฐานเทียบได้จริงว่า "รับได้กี่วิ"
3. ~~**ช่อง Weight ต้องมีหน่วย**~~ **ปิดแล้ว** — แสดงเป็น `used / capacity` พร้อม `% aspd ที่เสีย` ต่อท้าย (ดูตารางแผงหลัก 4 ช่องข้างบน)
4. ~~**ระดับของแต่ละ stat ที่แสดงผลได้**~~ **ปิดแล้ว** — เพดาน stat เดียวที่เลเวล 100 คือ 816 (= 12 ชิ้น × flat 25 แล้วคูณ 12 ชิ้น × 5%) คำนวณย้อนได้เต็มตารางใน formula.md หัวข้อ 0

# เหลือช่องเดียว

- ~~**ฐานของไอเทม (base)**~~ **ปิดแล้วใน item-base.md** — ทุก slot มี 2-3 โครง (mail / plate / vestments ฯลฯ) กำหนดน้ำหนัก + ว่าจะ emphasis affix ไหน · tooltip ของไอเทมจึงควรมีบรรทัด "โครง · น้ำหนัก" อยู่เหนือรายการ affix เพราะมันอธิบายว่าทำไมสองชิ้น slot เดียวกันคนละหน้า

# เกณฑ์การแสดงที่ควรยึด

- แสดงตัวเลขสูงสุด (max) เสมอ ไม่ใช่ค่าที่ยังไม่คำนวณจริง เช่น Max HP ไม่ใช่ HP ปัจจุบัน
- ค่า 0 ก็แสดง ไม่ซ่อน — ผู้เล่นต้องเห็นว่า Int ของตัวเองเป็น 0 เพราะยังไม่ได้ลงจุดใน magic power
- ทศนิยมไม่เกิน 1 ตำแหน่ง และปัดลง ไม่ปัดขึ้น
- แสดง cap เสมอสำหรับ crit / dodge / perfect dodge / cdr / aspd / alignment / elem res · **accuracy ไม่มี cap แล้ว** จึงแสดงเป็นตัวเลขเปล่า
- ไม่มี status alignment กับ status resistance แยกอีกแล้ว ใช้ Elemental alignment แทน