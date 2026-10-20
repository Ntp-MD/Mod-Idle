# Map art reference kit

เริ่มอ่านไฟล์นี้ก่อนส่งงานให้ agent เจนภาพ โฟลเดอร์นี้เป็นชุดอ้างอิงและ brief ไม่ใช่การฝึกโมเดลหรือระบบที่รับประกันความแม่นของภาพเจน

## เริ่มใช้งาน

1. ส่ง [agent-brief.md](agent-brief.md) ให้ agent อ่านก่อน
2. เลือกประเภทงาน: **terrain เต็ม hex**, **surface texture**, หรือ **object/figure แยกชิ้น** ห้ามใช้ prompt สลับประเภท
3. งาน terrain เต็ม hex: แนบ [hex-mask.png](geometry/hex-mask.png) เป็น **shape reference** และเลือกภาพสไตล์จาก [reference index](references/index.json)
4. ใช้ prompt ที่ตรงประเภทใน [prompts/](prompts/) และทำเพียงหนึ่งชิ้นก่อน
5. วัดและตรวจตาม [checklist](review/checklist.md) แล้วทดลองวางในเกมก่อนทำประเภทถัดไป

## มีอะไรอยู่ที่ไหน

| ไฟล์/โฟลเดอร์ | หน้าที่ |
|---|---|
| `geometry/hex-mask.png` | รูปร่างฐานจริงสำหรับแนบกับ image generator; ไม่มีตัวเลขหรือเส้นตกแต่ง |
| `geometry/hex-mask.svg` | รูปร่างเดียวกันแบบ vector |
| `geometry/hex-guide.svg` | ภาพอธิบายจุดยอด 1–6 และจุดกลาง; ไม่ใช่ art reference สำหรับเจน |
| `geometry/hex-spec.json` | ค่ากล้อง สัดส่วน พิกัดจุดยอด และ matrix ที่คำนวณจากโค้ด |
| `references/` | ภาพตัวอย่างพร้อมบทบาทของแต่ละรูป ไม่ได้หมายความว่ามุมของทุกรูปถูกต้อง |
| `prompts/` | Prompt ภาษาอังกฤษ แยกตามวิธี render |
| `examples/footprint-format.json` | ตัวอย่าง metadata ของภาพป่า; ต้องวัดใหม่สำหรับภาพอื่น |
| `outputs/` | ที่เก็บผลงานใหม่แบบมีเลขรุ่น; ยังไม่ใช่การนำเข้าเกม |
| `manifest.json` | แหล่งที่มา hash ของสำเนา และข้อไม่ตรงกันที่พบตอน refresh |
| `terrain-inventory.json` | เทียบภาพต้นฉบับทุกไฟล์กับรุ่นใหม่ metadata และ catalogue; แยกข้อควรตรวจของ renderer เมือง |

## อัปเดตจากโค้ดจริง

รันจาก root ของ repository บน PowerShell:

```powershell
./art-reference/map/refresh.ps1
```

สคริปต์อ่าน `game/src/ui/map-projection.ts` เพื่อสร้าง geometry ใหม่ จึงไม่ต้องคัดลอกค่ามุมด้วยมือ จากนั้นอัปเดตสำเนา reference และ manifest โดยไม่แก้ renderer, asset ต้นฉบับ หรือไฟล์ใน `outputs/`

วัด silhouette ของภาพใหม่ก่อนลงทะเบียนฐาน:

```powershell
./art-reference/map/measure.ps1 -Image art-reference/map/outputs/example-1.png -Output art-reference/map/outputs/example-1.measurement.json
```

เครื่องมือนี้อ่าน alpha แล้วประมาณจุดยอดฐานหกจุด พร้อมขนาดจริงและสีพื้นสำรอง ต้องตรวจรูปประกอบก่อนใช้ โดยเฉพาะภาพที่มีส่วนยื่นหรือเงานอกฐาน ผลวัดนี้ไม่รับรองมุมกล้องของวัตถุ

หลังลงทะเบียนและสร้างแผนที่แล้ว ตรวจพิกัดจุดยอด จุดกลาง รอยต่อส่วนย่อย ขนาด PNG และความตรงกันของไฟล์ที่ติดตั้ง:

```powershell
node art-reference/map/check-placement.mjs snow-1 grass-1
```

ผลนี้ตรวจ geometry และการติดตั้ง ยังต้องตรวจภาพบนแผนที่จริงตาม checklist

รายการต้นฉบับที่ต้องทำให้ครบอยู่ใน `source-assets.json` และอ้างไฟล์จริงใน `terrain/` กับ `landmark/` รวมหมู่บ้าน ค่าย เมือง และซากโบราณ ดูรายการที่ยังขาดใน `terrain-inventory.json` ซึ่งสร้างโดย `refresh.ps1` หรือ `node art-reference/map/inventory.mjs` ไม่ได้กำหนดจำนวนตายตัวในโค้ด

`geometry/` และ `references/` เป็น snapshot สำหรับส่งต่อ ถ้าเปลี่ยนกล้องให้ refresh ก่อนใช้งาน อ่าน warning ใน `manifest.json` ด้วย ข้อมูลต้นทางยังเป็นเจ้าของข้อเท็จจริงตาม [สัญญางาน art](../../docs/map-art.md)

**ฐานตรง hex ไม่ได้พิสูจน์ว่าต้นไม้/อาคารในภาพวาดด้วยกล้อง 38° จริง** ต้องตรวจมุมของวัตถุแยก และไม่ควรใช้ภาพที่ผ่านการ warp เป็นหลักฐานความแม่นของมุมวัตถุ
