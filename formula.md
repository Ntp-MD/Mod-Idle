# Formulas

import core-stats.md
import attribute-item.md
import equipment-slot.md

สัญลักษณ์: `x` = ค่าที่ได้จาก build · `x_c` = ค่าจาก core stat · `x_f` = ค่าจาก affix flat · `x_p` = ค่าจาก affix %

# 1. Core stat รวม

ค่าสุดทุกตัวคำนวณจาก 3 แหล่งแล้วนำมาก่อนเข้าสูตรอื่น

```
x_c = base + level_gain + gear_flat
x   = x_c * (1 + gear_pct/100)
```

ลำดับ: flat ก่อน แล้วค่อยคูณ % — เพราะถ้าคูณ % ก่อน flat ค่า flat จะถูกขยายตาม % ซึ่งไม่ตรงกับเจตนาของผู้เล่น

# 2. Physical power

```
phys = (str * K_STR + phys_flat) * (1 + phys_pct/100) * weapon_mult
```

- `K_STR` = ค่าต่อ Str 1 แต้ม (ค่าคงที่ของเกม ต้องตั้ง)
- `phys_flat` = Physical power flat รวมทุกชิ้น
- `phys_pct` = Physical power % รวมทุกชิ้น
- `weapon_mult` = ตัวคูณจากชนิดอาวุธ (ดู equpment-weapon.md)

> **ค้างอยู่**: flat power ยังไม่มีตัวคูณ ถ้าอยากให้ flat มีความหมายตลอดเกม ให้ตั้ง `K_STR` ให้สูงพอที่ flat จะยังรู้สึกได้ หรือเปลี่ยน `phys_flat` เป็น `% ของ base phys` แทน

# 3. Magic power

```
magic = (int * K_INT + magic_flat) * (1 + magic_pct/100) * weapon_mult
```

โครงเดียวกับ physical แต่ไม่แตะ Str

# 4. Critical

```
crit_cap = 100
crit_chance = lck * K_LCK_CRIT + crit_chance_pct + (dex หรืออะไรคิดเป็น % ได้ภายหลัง)
crit_chance = min(crit_chance, crit_cap)

crit_dmg_p = 100 + crit_dmg_phys_pct
crit_dmg_m = 100 + crit_dmg_magic_pct

ดาเมจ = power * crit_chance/100 * (เลือก crit_dmg_p หรือ crit_dmg_m)
```

- Lck ให้ crit chance → ต้องตั้ง `K_LCK_CRIT` ว่า Lck 1 แต้มเท่ากี่ % (หน่วยเล็กมาก เช่น 0.05)
- crit chance ต้องมี capเสมอ ไม่งั้น dodge/miss จะพัง
- crit damage เกิน 100 ได้ ไม่ต้อง cap

> **ค้างอยู่**: ตอนนี้มีแค่ `Critical damage %` ชนิดเดียว ผูกกับ base Physical power → magic build ไม่มี crit scaling ต้องแยกเป็น physical / magic ตามหมายเหตุท้าย equipment-slot.md

# 5. Dodge

```
dodge_rate = agi * K_AGI_DODGE + dodge_flat
dodge_rate = min(dodge_rate, dodge_cap)
dodge_chance = dodge_rate / (dodge_rate + K_dodge)
```

- **โครงสร้าง dodge ใช้สัดส่วนไม่ใช้บวกตรง** (เหมือน crit chance) เพราะ dodge สูงเกินจะทำให้ตีไม่โดนเลย ทำให้ meta เสีย
- `dodge_cap` ปักที่ประมาณ 75-80%
- Lck ให้ perfect dodge แยกออกไป ไม่ปนกับ dodge ปกติ

# 6. HP / Mana

```
max_hp   = (vit * K_VIT_HP + level_gain_hp) * (1 + vit_hp_pct/100)
hp_regen = vit * K_VIT_REGEN * (1 + hp_regen_pct/100)

max_mana   = (int * K_INT_MP + level_gain_mp) * (1 + int_mp_pct/100)
mana_regen = int * K_INT_MREGEN * (1 + mregen_pct/100)
```

Vit ให้ทั้ง hp และ regen ใช้สเกล K คนละตัว เพื่อปรับสมดุลแยกได้

# 7. Cooldown reduction

```
cdr_cap = 50
cdr = (wis * K_WIS_CDR + cdr_flat) * (1 + cdr_pct/100)
cdr = min(cdr, cdr_cap)

cooldown = base_cooldown * (1 - cdr/100)
```

- ต้องมี cap เสมอ (50-60%) ไม่งั้นสล็อต skill จะหายไป
- Wis ยังไม่มี affix รองรับ ต้องเพิ่ม `Cooldown reduction %` ก่อน (ดูหมายเหตุท้าย equipment-slot.md)

# 8. Attack speed

```
aspd_cap = 200
aspd = (agi * K_AGI_ASPD * weapon_aspd + aspd_flat) * (1 + aspd_pct/100)
aspd = min(aspd, aspd_cap)

interval = base_interval * 100 / aspd
dps      = power / interval
```

- `weapon_aspd` = ความเร็วโจมตีของอาวุธ (ดาบเร็ว โบวมือช้า) คูณเข้าไปแทนบวก เพราะ Agi ควรช่วยอาวุธช้าได้มากกว่าอาวุธเร็ว
- Agi ยังไม่มี affix รองรับ ต้องเพิ่ม `Attack speed %` ก่อน

# 9. Accuracy / Status

```
accuracy    = dex * K_DEX_ACC + accuracy_flat
hit_chance  = accuracy / (accuracy + evasion_target)

status_res  = str * K_STR_RES + status_res_flat
status_res  = min(status_res, status_res_cap)   cap ~ 75%

status_align = dex * K_DEX_ALIGN   chance ต่านสถานะเป็น % (ต้องตรวจกันสองทางฝ่ายผู้โจมตี/เป้าหมาย)
```

Dex มี 2 ด้านคือ accuracy (ยิงโดน) กับ status alignment (ตรึงสถานะ) ต้องตั้ง K แยก เพราะคนละเรื่อง

# 10. Drop chance

```
drop_rate = 1 + lck * K_LCK_DROP
```

Lck มีผลกับ drop ด้วย ต้องระวังไม่ให้ Lck เป็น stat ที่คุ้มทุกทางจนเด่นเกินตัวอื่น

# สรุป K ที่ต้องตั้ง

| K | หน่วย | หมายเหตุ |
|---|---|---|
| K_STR | phys / Str | ตัวหลักของ Str |
| K_STR_RES | status res / Str | |
| K_INT | magic / Int | ตัวหลักของ Int |
| K_INT_MP | mana / Int | |
| K_INT_MREGEN | mana regen / Int | |
| K_VIT_HP | hp / Vit | |
| K_VIT_REGEN | hp regen / Vit | |
| K_AGI_DODGE | dodge / Agi | |
| K_AGI_ASPD | aspd / Agi | |
| K_WIS_CDR | cdr / Wis | |
| K_DEX_ACC | accuracy / Dex | |
| K_DEX_ALIGN | status align / Dex | |
| K_LCK_CRIT | crit chance / Lck | หน่วยเล็กมาก |
| K_LCK_DROP | drop rate / Lck | |
| K_dodge | ตัวหารสูตร dodge | ควบคุมความชัน |
| weapon_aspd | ต่อชนิดอาวุธ | ดู equpment-weapon.md |
| weapon_mult | ต่อชนิดอาวุธ | ดู equpment-weapon.md |

# Cap ที่ต้องมี

| ค่า | cap |
|---|---|
| Critical chance | 100 |
| Dodge | 75-80 |
| Status resistance | 75 |
| Cooldown reduction | 50-60 |
| Attack speed | 200 |

Cap ทั้งหมดนี้ควรอยู่ร่วมกันในไฟล์เดียว ไม่งั้นแต่ละระบบจะตั้งค่าเองแล้วชนกัน

# ยังไม่มีข้อมูลตั้งต้น

- ค่า K ทั้งหมดยังไม่ได้ตั้ง
- base power ของอาวุธแต่ละชนิดยังไม่มี
- ต้องการค่า level gain ของ core stat และ hp/mana ต่อ level

ช่องเหล่านี้คือตัวเลขที่ต้องหามาเพื่อให้สูตรทั้งหมดรันได้จริง