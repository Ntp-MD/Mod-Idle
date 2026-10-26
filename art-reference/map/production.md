# Map background — production prompt

## 1. เป้าหมายและขอบเขต

ต้นทางสำหรับสร้าง **ภาพ BG map แบบ pixel art** โดยใช้ความรู้สึกของฉากวาดใน Tree of Savior เป็นทิศทาง: รูปทรงเป็นธรรมชาติ มีชั้นความลึก บรรยากาศนุ่ม และสถานที่อ่านออก แต่สร้างด้วย pixel clusters ที่ตั้งใจวาง ไม่ใช่นำภาพวาดมาลดความละเอียดหรือใส่ pixel filter

เอกสารนี้กำหนดภาษาภาพร่วมก่อนเลือก theme ของ terrain. ยังไม่เลือกว่าเป็นป่า หิมะ เมือง หรือพื้นที่ชนิดใด และยังไม่สั่ง generation หรือ integration

งานเป้าหมายเป็นภาพสถานที่ต่อเนื่อง ไม่ใช่ภาพ terrain diorama ตั้งแยกบนฐาน hex. ไม่ออกแบบรายละเอียดระบบ field, collision, ระยะเดิน หรือ gameplay ใหม่ในเอกสารนี้

## 2. กติกาภาพร่วม

### กล้องและพื้นที่ภาพ

- ใช้ orthographic / parallel projection มองจากด้านบนแบบสามในสี่ ไม่มี vanishing point หรือมุมกล้องระดับสายตา
- มุมอ้างอิงปัจจุบันมาจาก [map-projection.ts](../../game/src/ui/map/map-projection.ts): elevation 38° เหนือพื้น และ default board yaw −16°. ตรวจค่าจริงอีกครั้งก่อนผลิต; ไม่ใช้ตัวเลขใน prompt เป็นเจ้าของกล้องอีกชุด
- ภาพหนึ่งใบมีมุมวาดหนึ่งมุม. เอกสารนี้ไม่ได้อนุมัติการปิดระบบหมุนกล้องในเกม. ก่อนนำ BG ไปใช้ ต้องตกลงพฤติกรรมกล้องกับฝั่ง integration; ภาพเดียวไม่สร้างด้านที่มองไม่เห็นเมื่อหมุนกล้อง
- ขอบเขตภาพและ aspect ratio อ่านจากช่องแสดงผล/พื้นที่ BG ที่ตกลงสำหรับชิ้นนั้น. **1024 × 625 ใน kit เดิมเป็น canvas ของ projected hex ไม่ใช่ขนาดมาตรฐานของ BG นี้**
- ไม่แนบ hex mask เป็นกรอบภาพ BG. ถ้าต้องผลิต tile หรือ surface texture ให้แยก brief และใช้ contract ของงานชนิดนั้น

### Pixel language

- วาดรูปทรงด้วย pixel clusters ชัดเจน ขอบมีจังหวะ ไม่ใช่ภาพสมจริงที่ถูกทำให้แตกเป็นพิกเซล
- ใช้ขนาดพิกเซลเชิงภาพเดียวกันในพื้น วัตถุ และเงา. หากมี reference ตัวละคร ให้ระบุว่าใช้เทียบ pixel density และความอ่านง่ายเท่านั้น
- สร้างปริมาตรด้วยกลุ่มสีและพื้นที่เงา. ความนุ่มมาจากการเลือกสีและลำดับน้ำหนัก ไม่ใช้ blur หรือ soft airbrush กลบโครงสร้างพิกเซล
- รายละเอียดต้องอ่านออกเมื่อแสดงในขนาดใช้งานจริง; ไม่ทำรายละเอียดระดับจุดจนกลายเป็น noise เมื่อย่อ
- จำนวนสีและขนาด native pixel grid ยังไม่ล็อกเป็นตัวเลข. ต้องเลือกจากภาพต้นแบบที่เทียบกับช่องแสดงผลจริง ก่อนใช้เป็น reference ของชุดถัดไป

### องค์ประกอบและความลึก

- พื้นเป็นผืนต่อเนื่อง. รูปทรงของสถานที่เชื่อมกันอย่างมีเหตุผล ไม่วางของประดับกระจายสม่ำเสมอเต็มภาพ
- แบ่งน้ำหนักเป็น foreground / main ground / background ด้วยการซ้อนรูปทรง ขนาด และ contrast โดยยังใช้กล้องเดียวกัน
- จัดกลุ่มรายละเอียดเป็นพื้นที่เด่น สลับพื้นที่พักสายตา. บริเวณที่มีตัวละคร หมุด หรือข้อมูลทับต้องอ่านได้
- ภาพไม่ต้องมี landmark เด่นกลางภาพเสมอไป. จุดเด่นและพื้นที่ว่างอิง overlay/layout reference ของชิ้นงาน ไม่เดาตำแหน่ง HUD
- วัตถุสัมผัสพื้นชัด เงาสัมพันธ์กับพื้น ไม่ลอยอยู่บน pedestal หรือขอบฐานหนา

### สีและแสง

- ใช้สีที่สัมพันธ์กันทั้งภาพ มีความต่างระหว่างวัสดุ และไม่เร่ง saturation ทุกส่วนพร้อมกัน
- แสงหลักจากด้านซ้ายบนของภาพเป็นค่าเริ่มต้นร่วม. เงาสัมผัสพื้นอ่านออก; ไม่ bake แสงกระพริบหรือเหตุการณ์ชั่วคราวลง BG
- ใช้ contrast สูงเฉพาะจุดสำคัญ. BG ไม่ควรแย่งการอ่านตัวละคร หมุด และ UI
- Hue, วัสดุ, พืชพรรณ, สภาพอากาศ และบรรยากาศเฉพาะพื้นที่เป็นข้อมูลของ theme brief ภายหลัง ไม่ล็อกไว้ใน prompt ต้นทาง

### มาตราส่วน

- Character footprint diameter 0.5m เป็นข้อมูลพื้นที่ยืนของตัวละคร ไม่ใช่ความสูงของ sprite และไม่บังคับให้ World Map ทั้งใบใช้มาตราส่วนกายภาพเดียวกัน
- ใช้ตัวละครเป็น reference ด้านภาษาภาพและความอ่านง่ายได้ แต่ไม่ bake ตัวละครลง BG
- ไม่กำหนดเมตรต่อพิกเซล ขนาดเมือง หรือตารางเดินจาก prompt นี้. ถ้างานภายหลังต้องเป็นฉากที่ใช้ระยะจริง ต้องมี spatial brief เพิ่มจากเจ้าของระบบก่อน

### สิ่งที่ไม่อยู่ในภาพ BG

- ไม่มีตัวละคร ศัตรู ชื่อสถานที่ ตัวเลข ป้ายข้อความ หมุด เส้นเลือกเป้า หรือ UI
- ไม่มีขอบ hex, grid, เส้นทางที่เป็น UI overlay, กรอบภาพ, watermark, checkerboard หรือฐาน diorama
- ถนน/ทางกายภาพไม่ถูกเพิ่มอัตโนมัติเพื่อแต่ง composition; ต้องมีอยู่ใน theme/layout brief
- Default เป็น **opaque full-bleed background** เต็ม canvas. Transparent foreground หรือ object cutout ต้องสั่งเป็น asset แยก ไม่ปะปนกับ BG

## 3. ข้อมูลที่เติมก่อนส่ง generator

| Input | หน้าที่ |
| --- | --- |
| Output role | ยืนยันว่าเป็น BG ต่อเนื่องทั้งใบหรือขอบเขตที่ระบุ ไม่ใช่ hex tile |
| Canvas and display | ขนาดภาพที่ขอ, aspect ratio, ขนาดแสดงผล และระดับซูมที่ต้องอ่านออก |
| Camera reference | ภาพหรือ geometry อ้างอิงจากกล้องปัจจุบัน; ระบุว่าควบคุม perspective เท่านั้น |
| Pixel style reference | ภาพต้นแบบที่ผ่านการเลือกแล้ว; ควบคุม pixel density, cluster treatment และระดับรายละเอียด |
| Layout/overlay reference | ขอบเขตภาพ ตำแหน่งที่ต้องอ่านได้ จุดยึด และขอบต่อเนื่องถ้ามี |
| Theme brief | เติมภายหลัง: identity, วัสดุ, รูปทรงเด่น, palette และสิ่งที่ไม่ควรปรากฏ |

Theme brief เพิ่มเนื้อหาของสถานที่ แต่ไม่เปลี่ยนกล้อง pixel language หรือ output role เอง. ถ้าขัดกันให้แก้ brief ให้ตรงกันก่อน generation ไม่ส่งคำสั่งสองแนวทางให้ generator เลือกเอง

## 4. Master prompt

ส่วนนี้เป็น template. เติม input ให้ครบและลบ placeholder ก่อนใช้งานจริง. ยังไม่มี terrain theme ใดถูกเลือก

```text
PROJECT: ModWorld.
ASSET ROLE: One continuous map background illustration, not a hex tile,
standalone diorama, surface texture, UI screen or playable-field specification.

VISUAL DIRECTION:
An original pixel-art environment with the gentle illustrated atmosphere,
organic silhouettes and layered scenic composition associated with
Tree of Savior. Translate that feeling into deliberate pixel clusters;
do not render a smooth painting and apply a pixelation filter afterward.

REFERENCE ROLES:
<Identify each attached image and its permitted role: camera/perspective,
pixel treatment, layout/overlay, or theme. Do not copy unrelated content.>

CAMERA:
Orthographic / parallel, three-quarter overhead.
Use the verified current map camera: <elevation above ground> and
<board orientation>, matching the supplied camera reference.
No horizon-level view, wide-angle distortion or vanishing point.
Keep all ground and upright forms consistent with this single painted view.

PIXEL TREATMENT:
Crisp intentional pixel clusters, coherent pixel scale across materials,
readable silhouettes and grouped shading. Softness comes from palette
relationships and value grouping, not blur, soft airbrush or photographic texture.
Match <approved pixel-style reference / native pixel-grid specification>.
Preserve readability at <actual display size and review zoom>.

COMPOSITION:
One connected place with continuous ground and meaningful groups of forms.
Layer foreground, main ground and background with a common camera.
Use detailed focal groups and quieter resting areas.
Respect <layout / overlay readability zones and required anchors>.
Do not invent a central landmark or scatter decorative objects uniformly.

LIGHT AND MATERIAL:
Consistent upper-left key light, grounded contact shadows and restrained
contrast behind actors and map overlays. Materials remain distinguishable.
Theme-specific hues, weather and scenery follow the appended theme brief.

CANVAS AND DELIVERY:
<Requested width> x <requested height>, <aspect ratio>.
Opaque full-bleed BG; fill the complete canvas with the environment.
<Required edge continuity, or explicitly state that none is required.>
No transparent outer cutout, thick platform, pedestal or isolated tile framing.

EXCLUDE:
Characters, creatures, text, labels, numbers, UI, markers, grid lines,
hex borders, selection rings, checkerboard and watermarks.
Do not add physical roads, paths or buildings unless the theme/layout brief asks.

THEME BRIEF:
<Append the separately agreed theme brief here.>
```

## 5. เกณฑ์ตรวจและการส่งต่อ

1. ตรวจ camera, composition และ pixel treatment แยกกัน. การใช้ prompt หรือกรอก metadata ไม่ใช่หลักฐานว่าภาพวาดถูกมุม
2. ตรวจภาพที่ขนาดแสดงผลจริง รวมบริเวณที่จะมี actor/marker/UI ทับ; ภาพเต็มความละเอียดอย่างเดียวไม่รับรองความอ่านง่าย
3. ตรวจ actual dimensions, format, alpha และ framing จากไฟล์จริง. BG ต้องไม่มีขอบโปร่งใสหรือพื้น checkerboard ที่ถูกวาดติดมา
4. ตรวจว่าภาพไม่กลับไปเป็น terrain บนฐาน hex, ภาพ painterly ที่ใส่ pixel filter หรือชุดวัตถุที่ใช้ perspective คนละมุม
5. เก็บ prompt ที่ส่งจริง, reference roles และไฟล์ต้นฉบับไว้กับ candidate รุ่นนั้นใต้ `art-reference/map/outputs/`. ใช้ชื่อมี version และไม่เขียนทับภาพเดิม
6. ภาพต้นแบบชิ้นแรกใช้ตัดสิน pixel language และความเข้ากับกล้องก่อนผลิตชุด theme. ยังไม่ถือว่าผ่าน integration หรือเปลี่ยน catalogue จากการสร้างภาพสำเร็จ

**ขอบเขตที่ยังต้องตกลงก่อนผลิต:** theme แรก, canvas/display slot, reference ภาพจริง, native pixel density และพฤติกรรมกล้องขณะใช้ BG. เอกสารนี้ไม่เดาคำตอบแทนและไม่แก้ renderer หรือ asset ปัจจุบัน
