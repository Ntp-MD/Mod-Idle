# Map art reference kit

เริ่มอ่านไฟล์นี้ก่อนส่งงานให้ agent เจนภาพ โฟลเดอร์นี้เป็นแม่แบบอ้างอิงชุดเดียวสำหรับรูปทรง มุมกล้อง วิธีสร้าง และการตรวจคุณภาพ ไม่ใช่การฝึกโมเดลหรือระบบที่รับประกันความแม่นของภาพเจน

แผนที่ปัจจุบันใช้กล้องมองจากด้านบนแบบคงที่ พื้น hex และ field ใช้ **surface texture สี่เหลี่ยมแบบราบ** ร่วมกันที่ `game/public/map/ground/`; ต้นไม้/อาคารเป็น sprite แยก ภาพ terrain ที่วาด perspective มาแล้วเก็บเป็นงานอ้างอิงรุ่นก่อน

ภาพที่ generate ทุกไฟล์ (raw, cutout, outputs) เก็บไว้ใต้ `docs/map/` เพื่อรอ approve ก่อนนำไปใช้จริง ห้ามคัดลอกเข้า `game/public/` หรืออ้างในโค้ดจนกว่าจะอนุมัติ

## เริ่มใช้งาน

1. เลือกประเภทงาน: **terrain เต็ม hex**, **surface texture**, หรือ **object/figure แยกชิ้น** ห้ามสลับประเภทงาน
2. ใช้มุมกล้องและสัดส่วนจาก [geometry ที่ refresh จากโค้ดจริง](geometry/hex-spec.json); อย่ากำหนดองศาจาก screenshot หรือคัดลอกค่าด้วยมือ
3. งาน terrain เต็ม hex: แนบ [hex-mask.png](geometry/hex-mask.png) เป็น **shape reference** และเลือกภาพสไตล์จาก [reference index](references/index.json)
4. วัดและตรวจตาม [checklist](review/checklist.md) แล้วทดลองวางในเกมก่อนทำประเภทถัดไป

## มีอะไรอยู่ที่ไหน

| ไฟล์/โฟลเดอร์ | หน้าที่ |
|---|---|
| `geometry/hex-mask.png` | รูปร่างฐานจริงสำหรับแนบกับ image generator; ไม่มีตัวเลขหรือเส้นตกแต่ง |
| `geometry/hex-mask.svg` | รูปร่างเดียวกันแบบ vector |
| `geometry/hex-guide.svg` | ภาพอธิบายจุดยอด 1–6 และจุดกลาง; ไม่ใช่ art reference สำหรับเจน |
| `geometry/hex-spec.json` | ค่ากล้อง สัดส่วน พิกัดจุดยอด และ matrix ที่คำนวณจากโค้ด |
| `calibration/` | ผลวัด registration ของภาพตัวอย่างและ screenshot ตรวจแนว hex ในเกม; เป็นหลักฐานตรวจ ไม่ใช่ตัวแทน geometry หรือมุมกล้อง |
| `references/` | ภาพตัวอย่างพร้อมบทบาทของแต่ละรูป ไม่ได้หมายความว่ามุมของทุกรูปถูกต้อง |
| `examples/footprint-format.json` | ตัวอย่าง metadata ของภาพป่า; ต้องวัดใหม่สำหรับภาพอื่น |
| `outputs/` | ที่เก็บผลงานใหม่แบบมีเลขรุ่น; ยังไม่ใช่การนำเข้าเกม |
| `manifest.json` | แหล่งที่มา hash ของสำเนา และข้อไม่ตรงกันที่พบตอน refresh |
| `terrain-inventory.json` | เทียบภาพต้นฉบับทุกไฟล์กับรุ่นใหม่ metadata และ catalogue; แยกข้อควรตรวจของ renderer เมือง |
| `field-backgrounds/` | วัสดุพื้นสนามรบ 12 ครอบครัว พร้อม manifest และ prompt ที่ใช้เจน |

ดู [calibration/README.md](calibration/README.md) เพื่อแยกมุมกล้องที่ใช้สร้างงานออกจากหลักฐานการวางแนวในเกมและผลวัดฐานภาพ และ [field-backgrounds/README.md](field-backgrounds/README.md) สำหรับพื้นสนามรบ

## อัปเดตจากโค้ดจริง

รันจาก root ของ repository บน PowerShell:

```powershell
./docs/map/refresh.ps1
```

สคริปต์อ่าน `game/src/ui/map/map-projection.ts` เพื่อสร้าง geometry ใหม่ จึงไม่ต้องคัดลอกค่ามุมด้วยมือ จากนั้นอัปเดตสำเนา reference และ manifest โดยไม่แก้ renderer, asset ต้นฉบับ หรือไฟล์ใน `outputs/`

วัด silhouette ของภาพใหม่ก่อนลงทะเบียนฐาน:

```powershell
./docs/map/measure.ps1 -Image docs/map/outputs/example-1.png -Output docs/map/outputs/example-1.measurement.json
```

เครื่องมือนี้อ่าน alpha แล้วประมาณจุดยอดฐานหกจุด พร้อมขนาดจริงและสีพื้นสำรอง ต้องตรวจรูปประกอบก่อนใช้ โดยเฉพาะภาพที่มีส่วนยื่นหรือเงานอกฐาน ผลวัดนี้ไม่รับรองมุมกล้องของวัตถุ

หลังลงทะเบียนและสร้างแผนที่แล้ว ตรวจพิกัดจุดยอด จุดกลาง รอยต่อส่วนย่อย ขนาด PNG และความตรงกันของไฟล์ที่ติดตั้ง:

```powershell
node docs/map/check-placement.mjs snow-1 grass-1
```

ผลนี้ตรวจ geometry และการติดตั้ง ยังต้องตรวจภาพบนแผนที่จริงตาม checklist

รายการต้นฉบับที่ต้องทำให้ครบอยู่ใน `source-assets.json` และอ้างไฟล์จริงใน `terrain/` กับ `landmark/` รวมหมู่บ้าน ค่าย เมือง และซากโบราณ ดูรายการที่ยังขาดใน `terrain-inventory.json` ซึ่งสร้างโดย `refresh.ps1` หรือ `node docs/map/inventory.mjs` ไม่ได้กำหนดจำนวนตายตัวในโค้ด

`geometry/` และ `references/` เป็น snapshot สำหรับส่งต่อ ถ้าเปลี่ยนกล้องให้ refresh ก่อนใช้งาน อ่าน warning ใน `manifest.json` ด้วย ข้อมูลต้นทางยังเป็นเจ้าของข้อเท็จจริง

**พื้นปัจจุบันเป็น texture ราบบน hex มุมมองจากด้านบน** ต้นไม้/อาคารเป็น sprite แยก ต้องตรวจมุมของวัตถุให้ตรงกับ geometry ปัจจุบัน; ภาพเก่าที่ผ่านการ warp ไม่ใช่หลักฐานความแม่นของมุมวัตถุ
