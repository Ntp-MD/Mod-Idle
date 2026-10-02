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

> **ไม่มีช่อง skill** — skill ไม่ได้อยู่บนของสวมใส่ แต่อยู่ในลิสต์ของตัวละคร (ดู skill.md)

# Affix Pool by Slot

> **ตารางด้านล่างคือ "union" ของทุก base ใน slot นั้น** · ชิ้นที่drop มาจริงจะมี Primary/Secondary แค่ชุดเดียว ตาม base ที่มันสุ่มได้ (mail ≠ plate ≠ vestments) · ดู item-base.md
> กติกา offensive/defensive และ pool ของ core stat ข้างล่างยังใช้เหมือนกันทุก base

เกณฑ์ที่ใช้จัด pool

- **Primary** — ออกได้บ่อย (น้ำหนักปกติ)
- **Secondary** — ออกได้น้อยกว่า (น้ำหนักต่ำ)
- **Blocked** — ไม่ออกจากชิ้นนี้เด็ดขาด
- **Offensive** — ออกได้เฉพาะชิ้นที่เป็นอาวุธ
- **Defensive** — ชิ้นอื่นทั้งหมด ออกเฉพาะฝ่ายป้องกัน
- **Core stat** — ทุก slot รับได้เสมอ ทั้ง flat และ % (ดูหัวข้อถัดไป)
- ทุก slot ยิงค่าจากชุดช่วงของคุณภาพไอเทม และ tier ที่อยู่ในชุดนั้น (ดู glossary.md)

## Core stat (ทุกชิ้น)

**Core stat flat และ Core stat % เป็นค่าที่ทุกชิ้นสุ่มได้ ไม่มีข้อยกเว้น ไม่มี slot ไหน block**

| | |
|---|---|
| Core stat flat | สุ่มได้ทุกชิ้น · เลือกตัวจาก str / vit / dex / agi / wis / int / lck · ช่วง 5-25 แยกตามคุณภาพ |
| Core stat % | สุ่มได้ทุกชิ้น · เลือกตัวจาก str / vit / dex / agi / wis / int / lck · ช่วง 1-5% แยกตามคุณภาพ |

**กติกาเพิ่ม**

- 1 ชิ้นสุ่มได้ core stat สูงสุด 2 ช่อง (flat 1 + % 1) **และทั้ง 2 ช่องเป็น stat เดียวกันได้** เช่น str flat + str %
  กติกาเดิมที่บังคับให้ต้องคนละ stat ทำให้เพดาน stat เดียวเหลือ 510 แทนที่จะเป็น 816 แล้วตัวเลขอ้างอิงทั้งไฟล์ formula.md คำนวณไม่ถึง (ดู formula.md หัวข้อ 0)
- น้ำหนัก: Primary 1.0 · Secondary 0.5 · Core stat 1.0 (เท่ากับ Primary ทุกชิ้น) — แล้วคูณด้วย `value(affix)` จากหัวข้อ "น้ำหนักต่อ affix" อีกชั้น
- ถ้าชิ้นไหนมี core stat ตัวนั้นอยู่ใน Primary/Secondary อยู่แล้ว เช่น main hand มี Str flat ให้นับเป็นช่อง core stat ช่องนั้นไปเลย ห้ามสุ่มซ้ำช่องเดียวกันสองครั้ง
- เพดานของ 1 ชิ้นคือ flat 1 ช่อง (สูงสุด 25 ที่คุณภาพสูง T1) + % 1 ช่อง (สูงสุด 5%) · ทั้ง 12 ชิ้นรวมกันได้ 300 flat กับ 60% ซึ่งเป็นที่มาของเลข 816 ใน formula.md
- **core stat คือทางเดียวที่ stat ทั้ง 7 ตัวเข้าถึงได้จากทุกชิ้น** เพราะกติกา offensive/defensive ปิด affix ตรง ๆ ของ Str/Int/Dex/Agi/Wis ไว้ที่ main hand
- ชิ้นป้องกันไม่มี Vit % / Vit flat ใน pool ถ้าอยากได้ต้องมาทาง core stat เท่านั้น

# Defensive Pool

affix ฝ่ายป้องกันที่ทุกชิ้นนอก main hand หุ้มไว้ ต่างกันแค่ว่าชิ้นไหนเป็น Primary หรือ Secondary

| Affix | ช่วง |
|---|---|
| Max HP flat | 40-200 |
| Max HP % | 3-16% |
| Max Mana flat | 20-140 |
| Max Mana % | 3-16% |
| Dodge flat | 3-15 |
| Dodge % | 2-10% |
| Cooldown reduction % | 5-25% |
| Elemental resistance % | 15-30% |
| Elemental alignment % | 1-5% |

# Offensive Pool

affix ฝ่ายโจมตี ออกได้แค่ที่ main hand (และ off hand ตอนถือดาบคู่)

| Affix | ช่วง |
|---|---|
| Physical power flat / % | 15-80 / 3-16% |
| Magic power flat / % | 15-80 / 3-16% |
| Elemental power flat / % | 12-64 / 3-14% |
| Critical chance % | 1-8% |
| Critical damage % (physical / magic) | 12-120% |
| Attack speed % | 5-25% |
| Accuracy % | 5-25% |
| Str flat / % · Int flat / % | 5-25 / 1-5% (ตามชนิดอาวุธ) |

# น้ำหนักต่อ affix (ปิดช่องที่ค้างไว้ข้อ 4)

น้ำหนักที่ใช้ = **น้ำหนักตาม role × น้ำหนักตาม affix**

```
P(เลือก affix X จาก base นี้) = role(X) × value(X) ÷ Σ(role × value)
role: Primary = 1.0 · Secondary = 0.5 · core stat = 1.0 (ต่อ 1 ช่องที่ เหลือ)
```

`value(X)` ตั้งจาก **ค่า marginal ที่วัดได้จริง 1 เส้น** (คำนวณจากสูตรใน formula.md ที่ build ทุ่ม stat 12 ชิ้น) ไม่ใช่ความรู้สึก

| affix | ค่าที่เลเวล 100 | ค่าตอนต้นเกม (เลเวล 10 · ของต่ำ) | value | เหตุผล |
|---|---|---|---|---|
| Max HP % | +16% EHP | +7% | **0.8** | แรงสุดของฝั่งป้องกัน → ทำให้น้อยลงหน่อยเพื่อให้เป็นของหายาก |
| Physical/Magic power % | +16% DPS | +7% | **0.8** | เหมือนกันฝั่งโจมตี |
| Critical damage % | +22% DPS (ที่ crit 18.5%) | +5% | **0.7** | แรงสุดในตาราง · ต้องเป็นเป้าหมายไม่ใช่เรื่องบังเอิญ |
| Attack speed % | +16.5% DPS | +12% | 1.0 | |
| Elemental resistance % | +8.3% EHP | +1.6% | 1.0 | สายธาตุต้องหาซ้ำ ๆ จึงไม่ลด |
| Dodge flat | +11.4% EHP | +6.7% | 1.0 | เพิ่ม rate ตรง ๆ ใครใช้ก็ได้ |
| Critical chance % | +7.9% DPS | +9% | 1.0 | |
| Accuracy % | +4.2% DPS | +3% | 1.2 | ถูกแต่ช่วยพื้น hit 80% ให้สูงขึ้น · ให้เป็นตัวเติมที่ออกบ่อย |
| Core stat flat | +3.1% (บน stat ที่ทุ่มเต็ม) · **+11.9%** (บน stat ที่ไม่ลงเลย) | +5.5% | 1.0 | ตัวนี้คือเหตุผลที่ core stat ยังออกได้ทุกชิ้น |
| Core stat % | +5% ของ stat นั้น | +2% | 1.0 | |
| Elemental alignment % | +5 คะแนนจาก cap 50 (= +10% ของดาเมจธาตุ) | +5% | 1.0 | สายธาตุเท่านั้นที่ใช้ |
| Cooldown reduction % | +6.1 คะแนน CDR ≈ +1.9% DPS | +4% | **0.6** | skill ทั้งลิสต์มีค่าแค่ +7.7% DPS (skill.md) → CDR จึงเป็นเส้นรองจริง ๆ |
| Dodge % | +3.3% EHP | +0.2% | **0.7** | เป็นตัวคูณของ rate ที่ต่ำถ้าไม่มี Agi |
| Max HP flat | +1.0% EHP | +2.1% | **0.5 / 0.4 / 0.25** | ตายตอนปลายเกม · ใช้หนักต่างกันตามชั้นคุณภาพ (ตำเป๊า 0.5 · กลาง 0.4 · สูง 0.25) |
| Max Mana flat | +2.9% ของ pool · ไม่ช่วย EHP | +8% | **0.5 / 0.4 / 0.25** | มีค่าเฉพาะตอน pool ยังเล็ก |
| Max Mana % | +16% ของ pool · **แต่ทำให้ aura แพงขึ้น 16% ด้วย** (drain คิดจาก pool) | +8% | 0.8 | สาย cast กด skill ได้ยาวขึ้น · สาย aura จะเกลียดเส้นนี้ |
| Physical/Magic power flat | +2.0% DPS | +2.9% | **0.5 / 0.4 / 0.25** | เหมือน Max HP flat — เป็นเส้นต้นเกม |
| Elemental power flat / % | ผ่าน alignment gate แล้วเหลือ ~21% ของ hit | — | 1.0 | สายธาตุต้องใช้ |

- **กลุ่ม 0.5 คือ "เส้นต้นเกม"** — ตอนเลเวล 10 มันคือ 1 ใน 3 ของพลัง ตอนเลเวล 100 มันคือ 1% ซึ่งแปลว่า *ของdrop ที่เต็มไปด้วยเส้น flat จะหยุดเป็นอัปเกรดพอดีตอนที่ผู้เล่นย้ายขึ้นโซนสูง* นี่คือกลไกที่ทำให้การคราฟ (Refine/Ascend) เป็นคำตอบ ไม่ใช่ luck · ไม่ได้ตั้งใจตัดเส้นพวกนี้ทิ้ง เพราะมันคือบันไดช่วงแรก
- **Max Mana % เป็นเส้นที่มีสองหน้า**: pool ใหญ่ขึ้น = กด skill ได้ยาวขึ้น แต่ aura ที่กิน % ของ pool จะแพงขึ้นเท่ากัน · ผู้เล่นสาย aura จึงต้องอ่านเส้นนี้ผิดจากคนอื่น — เป็นความต่างที่ตั้งใจไว้
- ผลรวมที่ใช้ได้: ทุก base ใน item-base.md มีรายการ Primary/Secondary ของตัวเอง แล้วตารางนี้คูณเข้าไป · ไม่ต้องแก้ pool ของ slot ใด

- **ผลต่อ Reroll**: ช่วงของ T1 กว้างแค่ 1-2 คะแนน (เช่น Max HP % T1 = 15-16) · reroll ใน tier เดิมจึงขยับได้ ~6% ของเส้นนั้น = **~0.1-1% ของความแรงชิ้น** → Reroll คือเครื่องมือ *แก้ค่าที่ออกแย่* ไม่ใช่เครื่องมือไต่พลัง (ดู crafting.md)

## helmet

| Role | Affix |
|---|---|
| Primary | Max HP flat · Max HP % · Dodge % |
| Secondary | Cooldown reduction % · Elemental resistance % |
| Core stat | Core stat flat · Core stat % (ทุกชิ้น) |
| Blocked | — |

> ชิ้นที่ถูกใส่ก่อนเป็นส่วนใหญ่ ใส่แล้วเห็นผลทันที

## chest

| Role | Affix |
|---|---|
| Primary | Max HP % · Max HP flat |
| Secondary | Elemental resistance % · Max Mana % |
| Core stat | Core stat flat · Core stat % (ทุกชิ้น) |
| Blocked | — |

> ตัวกำหนด survivability · Max HP % ที่นี่มีน้ำหนักสูงสุดเพราะคูณทั้ง HP ดิบและ HP จาก core stat

## pant

| Role | Affix |
|---|---|
| Primary | Max HP flat · Dodge % |
| Secondary | Max HP % · Elemental resistance % |
| Core stat | Core stat flat · Core stat % (ทุกชิ้น) |
| Blocked | — |

## boots

| Role | Affix |
|---|---|
| Primary | Dodge flat · Dodge % |
| Secondary | Max Mana flat · Cooldown reduction % |
| Core stat | Core stat flat · Core stat % (ทุกชิ้น) |
| Blocked | — |

> dodge เยอะสุดที่นี้ · dodge ไม่มี flat แล้วต้องอาศัย Agi จาก core stat ช่วยด้วย

## belt

| Role | Affix |
|---|---|
| Primary | Max HP flat · Max HP % |
| Secondary | Cooldown reduction % · Elemental resistance % |
| Core stat | Core stat flat · Core stat % (ทุกชิ้น) |
| Blocked | — |

> ทำหน้าที่เป็นแถบคอสัมภูณิย์ · เหมือน chest แต่ได้ CDR เป็น secondary แทน mana

## gloves

| Role | Affix |
|---|---|
| Primary | Dodge % · Dodge flat |
| Secondary | Max HP % · Elemental alignment % |
| Core stat | Core stat flat · Core stat % (ทุกชิ้น) |
| Blocked | — |

> จับของ · ความเร็วโจมตีต้องมาจาก core stat Agi แทน

## ring * 2

| Role | Affix |
|---|---|
| Primary | Elemental resistance % · Cooldown reduction % |
| Secondary | Max HP % · Max Mana % |
| Core stat | Core stat flat · Core stat % (ทุกชิ้น) |
| Blocked | — |

> วงแหวนเปลี่ยนจาก crit เป็น res กับ CDR · ผู้เล่นสายธาตุจะซื้อหาธาตุเดียวกัน 2 ชิ้นเพื่อดัน res เป็นชิ้นต่อชิ้น

## amulet

| Role | Affix |
|---|---|
| Primary | Elemental resistance % · Elemental alignment % |
| Secondary | Max Mana flat · Cooldown reduction % |
| Core stat | Core stat flat · Core stat % (ทุกชิ้น) |
| Blocked | — |

> คอสัมภูณิย์ = ชิ้นที่ยืนยันธาตุได้มากที่สุด คู่กับ main hand ที่ออกดาเมจธาตุ

## cape

| Role | Affix |
|---|---|
| Primary | Elemental resistance % · Dodge % |
| Secondary | Cooldown reduction % · Max Mana % |
| Core stat | Core stat flat · Core stat % (ทุกชิ้น) |
| Blocked | — |

## main hand

| Role | Affix |
|---|---|
| Primary | Physical power flat · Physical power % · Critical chance % · Critical damage % (physical) |
| Secondary | Str flat · Str % · Attack speed % · Accuracy % |
| Core stat | Core stat flat · Core stat % (ทุกชิ้น) |
| Blocked | Max HP · Dodge · Cooldown reduction · Elemental resistance |

**ตามชนิดอาวุธ (ดู equipment-weapon.md)**

| Weapon | เปลี่ยนเป็น |
|---|---|
| sword / axe / dagger / spear / bow / crossbow | Physical power flat เป็น primary หลัก · Str flat/% |
| rod / wand / staff | Magic power flat · Magic power % แทน Physical · Int flat/% |
| ทุกชนิด | Elemental power flat เป็น secondary เสมอ เพราะทุกอาวุธมีธาตุประจำตัว |

## off hand

| Role | Affix |
|---|---|
| Shield | Max HP flat · Max HP % · Dodge % |
| Book | Max Mana flat · Max Mana % · Cooldown reduction % |
| Dual-wield weapon | ใช้ pool เดียวกับ main hand แต่ลดน้ำหนัก Primary ลงครึ่งหนึ่ง |
| Core stat | Core stat flat · Core stat % (ทุกชิ้น) |

- shield และ book เป็นชิ้นป้องกันตามกติกา
- **ดาบคู่เป็นข้อยกเว้นเดียวของกติกา** เพราะเป็นอาวุธชิ้นที่สอง จึงได้ดาเมจธาตุและ power แต่น้ำหนักลดครึ่ง
- ดาบคู่ใช้ได้เฉพาะอาวุธมือเดียวที่ระบุว่า dual-wield ได้

# กติกา Offensive / Defensive

**ชิ้นที่เป็นอาวุธสุ่มเฉพาะ affix ฝ่ายโจมตี · ชิ้นอื่นทั้ง 10 ช่องสุ่มเฉพาะ affix ฝ่ายป้องกัน**

| กลุ่ม | สมาชิก |
|---|---|
| Offensive | Power flat/% ทุกชนิด · Critical chance % · Critical damage % · Attack speed % · Accuracy % · Str %/flat · Int %/flat |
| Defensive | Max HP flat/% · Max Mana flat/% · Dodge flat/% · Cooldown reduction % · Elemental resistance % · Elemental alignment % |
| Core stat | ไม่ถูกจัดเข้ากลุ่มใด ทุกชิ้นรับได้เท่ากันตามหัวข้อ Core stat |

- main hand คือช่องเดียวที่เป็น offensive นอกจาก off hand ตอนถือดาบคู่
- **Elemental resistance นับเป็น defensive เสมอ ทุกธาตุ** ไม่มีทางเป็น offensive แม้ผู้เล่นจะใส่ธาตุเดียวกับที่มีอาวุธ
- Cooldown reduction จัดเป็น defensive เพราะเป็นการควบคุมจังหวะไม่ใช่ดาเมจ · แลกกับความจริงที่ไม่มีชิ้นไหนได้ crit เพิ่ม
- Core stat ไม่นับเป็นทั้งสองกลุ่ม เพราะสุ่มได้ทุกชิ้นอยู่แล้ว

# Slot Coverage Check

| Build ที่ต้องมีทางออก | ทางออก |
|---|---|
| Str / physical | main hand (power + Str) + core stat ทุกชิ้น |
| Int / magic | main hand (magic power + Int) + core stat ทุกชิ้น |
| Vit / tank | chest · pant · belt + core stat Vit ทุกชิ้น |
| Agi / dodge | boots · gloves · cape · helmet + core stat Agi ทุกชิ้น |
| Crit | main hand เท่านั้น — ใช้ **core stat Lck ที่สุ่มได้ทุกชิ้น** เป็นตัวหนุน crit หลักแทน crit affix |
| Wis / CDR | amulet · cape · ring · belt · boots |
| Dex / accuracy | main hand (Accuracy %) + core stat Dex ทุกชิ้น |
| ธาตุ | main hand / ดาบคู่ = ดาเมจ · ชิ้นป้องกันทุกชิ้น = res ของธาตุตัวเอง |
| Mana | amulet · boots · cape + core stat Int ทุกชิ้น |

> **สิ่งที่ยอมแลก**: crit chance / crit damage อยู่ที่ main hand ชิ้นเดียว แลกกับความเรียบง่ายของกติกา
> การชดเชยคือทำให้ Lck กลายเป็น stat ที่ต้องลงทุนทั่วไป ไม่ใช่แค่ต้องการใน main hand ชิ้นเดียว

# หมายเหตุ / ช่องที่ยังขาด

1. **ชิ้นป้องกันไม่มี Vit % / Vit flat ใน pool** — ผู้เล่นสาย tank ต้องพึ่ง core stat Vit อย่างเดียว ถ้ารู้สึกว่า tank หนักเกินไปควรเพิ่มกลับเข้า pool
2. ~~**Dodge ไม่มี flat แล้วในบางชิ้น**~~ **ปิดแล้วด้วย item-base.md** — Dodge flat ตอนนี้หาได้จาก 6 ทาง: greaves · striders · gauntlets · gloves · clasp · buckler · ชิ้นละสูงสุด 15 (T1 คุณภาพสูง)
   จุดชน cap คือ rate 150 ซึ่ง **มีสองทางถึง**: Agi 816 + dodge flat 2 ช่อง (122+30 = 152) หรือ Agi 468 + dodge flat 6 ช่อง (70+90 = 160) · ทั้งคู่ต้องทุ่มช่องครึ่งเซ็ตให้ dodge เหมือนเดิม cap จึงยัง mean อะไร
3. ~~**Alignment อยู่แค่ amulet กับ gloves**~~ **ปิดแล้วด้วย item-base.md** — elemental alignment อยู่บน circlet · wrap · wraps · sash · pendant · tome แล้ว (6 ช่อง × สูงสุด 5%) · ผลคือ extreme elemental build แตะ cap 50 ได้โดยไม่ต้องพึ่ง slot เฉพาะอีกต่อไป
4. ~~**weight ของ secondary ยังไม่ได้ปรับ**~~ **ปิดแล้ว** — ดูหัวข้อ "น้ำหนักต่อ affix" ด้านบน · secondary ทุกตัวไม่ได้ 0.5 เท่ากันอีกต่อไป แต่เป็น 0.5 × value(affix) ที่วัดจากค่า marginal จริง (เส้นต้นเกมอย่าง Max HP flat ถ่วงลง 0.5 · เส้นแรงสุดอย่าง crit damage ถ่วงลง 0.7
- **น้ำหนักเส้น flat เปลี่ยนตามชั้นคุณภาพ**: 0.5 (ของต่ำ) · 0.4 (กลาง) · 0.25 (สูง) — เพราะค่า marginal ของมันตกจาก +2.1% เหลือ +1.0% (Max HP) ขณะที่ % lines ยังเท่าเดิม · วัดผล: จำนวนเส้น flat ต่อชิ้นที่ตกในโซนสูงลดจาก 0.28 เหลือ 0.15 (-46%) และ keep-rate รวมแทบไม่ขยับ (1.01% → 1.02%) → ราคาสกุลคราฟใน crafting.md ใช้ต่อได้โดยไม่ต้องแก้)